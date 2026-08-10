// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IDefralVault} from "./interfaces/IDefralVault.sol";
import {IDefralPool} from "./interfaces/IDefralPool.sol";
import {DefralMath} from "./libraries/DefralMath.sol";

/// @notice ONE vault per borrower (deployed by DefralVaultFactory). Holds NO reserve — reserve
///         is always `min(dUSD.balanceOf(borrower), dUSD.allowance(borrower, this))`, read live.
///         The agent's ENTIRE authority is two zero-argument functions, both of which re-read
///         the oracle and the position inside the same transaction they act in.
/// @dev    Nol proxy, nol delegatecall, nol upgrade path, nol owner (plan.md A6). Every address
///         below is immutable — set once at construction, provably unchangeable by any function
///         in this file, compiler-enforced rather than promised (plan.md §9.5).
contract DefralVault is IDefralVault {
    using SafeERC20 for IERC20;

    /// Borrower-adjustable bounds for triggerBps (plan.md K6, D3). Below 12000 leaves no real
    /// defence window before LIQUIDATION_BPS (11000); above 15000 the agent fires so often it
    /// burns through reserve for drift that would have recovered on its own.
    uint16 public constant MIN_TRIGGER_BPS = 12_000;
    uint16 public constant MAX_TRIGGER_BPS = 15_000;

    /// Oracle staleness ceiling for guardRepay() (plan.md A3). sweepCoupon() does not read this —
    /// a coupon sweep is a proactive paydown, not a price-triggered defence (plan.md K5).
    uint256 public constant MAX_STALE = 1 hours;

    uint8 internal constant KIND_RESCUE = 1;
    uint8 internal constant KIND_COUPON = 2;

    address public immutable override borrower;
    address public immutable override agentExecutor;
    IERC20 public immutable dUSD;
    IERC20 public immutable collateralToken;
    AggregatorV3Interface public immutable oracle;
    IDefralPool public immutable pool;

    struct Policy {
        uint16 triggerBps;
        uint16 targetBps;
        uint256 maxRepayPerEvent;
        bool couponSweep;
    }

    Policy public policy;

    /// Sole replay-protection anchor for guardRepay() — one oracle observation, one action
    /// (plan.md A4, G5). Anchored to NavOracle's monotonic roundId, not a timestamp or a
    /// contract-id churn Solidity has no equivalent of.
    uint80 public lastActedRound;

    /// Borrower's unilateral kill switch (plan.md A5). Once true, every onlyAgent call reverts
    /// forever — there is no un-revoke path, and no function anywhere sets this back to false.
    bool public revoked;

    error InvalidTriggerBps(uint16 triggerBps, uint16 min, uint16 max);
    error InvalidTargetBps(uint16 targetBps, uint16 triggerBps);
    error InvalidMaxRepayPerEvent();

    /// @dev SIAPA: only `agentExecutor` — the Turnkey enclave EOA, whose private key this
    ///      project never holds (plan.md §0.0, PRD §9). KENAPA BOLEH: it is the one address
    ///      fixed at construction for exactly this purpose. YANG SENGAJA TIDAK BISA: act after
    ///      `revoked` is set — the borrower's kill switch overrides this modifier unconditionally.
    modifier onlyAgent() {
        if (msg.sender != agentExecutor) revert NotAgent(msg.sender);
        if (revoked) revert Refused_AgentRevoked();
        _;
    }

    /// @dev SIAPA: only `borrower`. KENAPA BOLEH: it is their own position, their own reserve,
    ///      their own policy — nobody else's consent is needed to change either.
    modifier onlyBorrower() {
        if (msg.sender != borrower) revert NotBorrower(msg.sender);
        _;
    }

    constructor(
        address borrower_,
        address agentExecutor_,
        IERC20 dUSD_,
        IERC20 collateralToken_,
        AggregatorV3Interface oracle_,
        IDefralPool pool_,
        uint16 triggerBps_,
        uint16 targetBps_,
        uint256 maxRepayPerEvent_,
        bool couponSweep_
    ) {
        borrower = borrower_;
        agentExecutor = agentExecutor_;
        dUSD = dUSD_;
        collateralToken = collateralToken_;
        oracle = oracle_;
        pool = pool_;

        _setPolicy(triggerBps_, targetBps_, maxRepayPerEvent_, couponSweep_);
    }

    // ───────────────────────── views — siapa pun ─────────────────────────

    /// @notice The single number check-and-execute polls. Zero arguments by construction —
    ///         there is nothing a caller could pass that would change what this reads.
    function healthRatioBps() public view returns (uint16) {
        (, int256 price,,,) = oracle.latestRoundData();
        return DefralMath.healthRatioBps(pool.collateralOf(borrower), price, pool.debtOf(borrower));
    }

    /// @notice min(balanceOf, allowance) — the ONLY definition of "reserve" anywhere in this
    ///         system (plan.md B2, PRD §4.2). This vault never holds the tokens it counts.
    function reserve() public view returns (uint256) {
        uint256 bal = dUSD.balanceOf(borrower);
        uint256 all = dUSD.allowance(borrower, address(this));
        return bal < all ? bal : all;
    }

    /// @notice Previews exactly what guardRepay() would transfer if it fired right now,
    ///         ignoring the health/staleness/replay gates — those decide WHETHER it fires,
    ///         this decides HOW MUCH. Same formula the agent and the UI both call (plan.md D2).
    function quoteGuardRepay() public view returns (uint256) {
        return DefralMath.min(amountToReachTarget(), DefralMath.min(policy.maxRepayPerEvent, reserve()));
    }

    function amountToReachTarget() public view returns (uint256) {
        (, int256 price,,,) = oracle.latestRoundData();
        return
            DefralMath.amountToReachTarget(pool.collateralOf(borrower), price, pool.debtOf(borrower), policy.targetBps);
    }

    /// @notice Flat quarterly yield on the registered collateral, uncapped — the cap against
    ///         outstanding debt (plan.md K5) is applied inside sweepCoupon(), not here, so this
    ///         view always answers "what did the collateral generate" for the UI.
    function couponDue() public view returns (uint256) {
        return pool.couponDue(borrower);
    }

    function getPosition() external view returns (Position memory) {
        return Position({
            borrower: borrower,
            outstanding: pool.debtOf(borrower),
            collateralAmount: pool.collateralOf(borrower),
            triggerBps: policy.triggerBps,
            targetBps: policy.targetBps,
            maxRepayPerEvent: policy.maxRepayPerEvent,
            couponSweep: policy.couponSweep,
            reserve: reserve(),
            lastActedRound: lastActedRound,
            revoked: revoked
        });
    }

    // ───────────────────────── onlyBorrower ─────────────────────────

    /// @notice Changes the guard policy. Bounds are enforced onchain, not just in the UI —
    ///         plan.md K6: the predecessor's `GuardPolicy` was immutable and two shipped UI
    ///         controls silently did nothing. This function is what makes them real.
    function setPolicy(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep)
        external
        onlyBorrower
    {
        _setPolicy(triggerBps, targetBps, maxRepayPerEvent, couponSweep);
    }

    /// @notice Borrower's unilateral kill switch (plan.md A5). Irreversible: nothing in this
    ///         contract ever sets `revoked` back to false.
    function revokeAgent() external onlyBorrower {
        revoked = true;
        emit AgentRevoked();
    }

    // ───────────────────────── onlyAgent — DUA FUNGSI. ITU SAJA. ─────────────────────────

    /// @notice The agent's only way to move borrower funds. Re-reads oracle and position in
    ///         this same transaction and refuses on a healthy position (plan.md §4.1, A2).
    /// @dev    SIAPA: only `agentExecutor`. KENAPA BOLEH: borrower approved this exact vault
    ///         for exactly this reserve; no other authority is exercised.
    ///         YANG SENGAJA TIDAK BISA: send to any address but `pool`, send a caller-chosen
    ///         amount, or act on a position that is not, right now, below `policy.triggerBps`.
    ///         None of the three is an oversight — they are the product's entire thesis.
    /// @dev Packed into a memory struct — not style, necessity: this function's checks alone
    ///      need ~9 live values, past what the EVM's 16-deep stack tolerates as separate
    ///      locals once external calls and an 8-field event are added on top. A memory
    ///      struct is one stack slot regardless of field count. `via_ir` stays false
    ///      (plan.md §0.0) — this is the non-via-IR way to avoid "stack too deep".
    struct GuardRead {
        uint80 roundId;
        int256 price;
        uint256 updatedAt;
        uint256 collateralAmount;
        uint256 outstanding;
        uint16 h0;
        uint256 avail;
        uint256 amount;
    }

    function guardRepay() external onlyAgent {
        // 1. CHECKS — every read, every refusal, nothing written yet.
        GuardRead memory g;
        (g.roundId, g.price,, g.updatedAt,) = oracle.latestRoundData();

        if (g.updatedAt + MAX_STALE < block.timestamp) revert Refused_StaleOracle(g.updatedAt, MAX_STALE);
        if (g.roundId == lastActedRound) revert Refused_AlreadyActed(g.roundId);

        g.collateralAmount = pool.collateralOf(borrower);
        g.outstanding = pool.debtOf(borrower);

        g.h0 = DefralMath.healthRatioBps(g.collateralAmount, g.price, g.outstanding);
        if (g.h0 >= policy.triggerBps) revert Refused_Healthy(g.h0, policy.triggerBps); // THE GATE

        g.avail = reserve();
        if (g.avail == 0) revert Refused_NoReserve(0);

        uint256 needed = DefralMath.amountToReachTarget(g.collateralAmount, g.price, g.outstanding, policy.targetBps);
        g.amount = DefralMath.min(needed, DefralMath.min(policy.maxRepayPerEvent, g.avail));
        if (g.amount == 0) revert Refused_NothingToRepay();

        // 2. EFFECTS — written before any external call, so a reentrant call sees this round as acted.
        lastActedRound = g.roundId;

        // 3. INTERACTIONS — external calls last. Non-custodial: dUSD moves from the borrower's
        //    own wallet straight to `pool`; this contract's balance of it is always zero.
        dUSD.safeTransferFrom(borrower, address(pool), g.amount);
        pool.applyRepayment(borrower, g.amount);

        uint16 h1 = DefralMath.healthRatioBps(g.collateralAmount, g.price, g.outstanding - g.amount);
        emit Rescued(borrower, KIND_RESCUE, g.amount, g.h0, h1, g.price, g.roundId, uint64(block.timestamp));
    }

    /// @notice Channels the registered collateral's yield into the debt. Proactive paydown,
    ///         not a breach response — SENGAJA NOL health gate (plan.md K5, D4), matching
    ///         Coupon.daml's own comment that a coupon sweep is not a defence action.
    /// @dev    SIAPA: only `agentExecutor`. KENAPA BOLEH: borrower opted in via
    ///         `policy.couponSweep`; nothing here touches the borrower's wallet at all.
    ///         YANG SENGAJA TIDAK BISA: pay more than what is actually owed — capped at
    ///         outstanding debt (plan.md K5), unlike the uncapped Daml original that would
    ///         have reverted instead of clamping. And, just as deliberately, it cannot spend
    ///         a coupon twice: `applyCouponSweep` debits accrued balance, so one declared
    ///         coupon funds exactly one sweep of that size and a repeat call reverts.
    ///         That bound is why this function needs no `lastActedRound` of its own —
    ///         guardRepay is bounded by the price observation, this one by the accrual.
    function sweepCoupon() external onlyAgent {
        if (!policy.couponSweep) revert Refused_CouponSweepOff();

        uint256 due = couponDue(); // accrued-and-unswept, not a formula (see MockLendingPool)
        if (due == 0) revert Refused_NoCouponDue();

        uint256 outstanding = pool.debtOf(borrower);
        uint256 amount = DefralMath.min(due, outstanding); // K5 cap — Daml's SweepToLoan would revert instead
        if (amount == 0) revert Refused_NoCouponDue();

        pool.applyCouponSweep(borrower, amount);

        (uint80 roundId, int256 price,,,) = oracle.latestRoundData();
        uint256 collateralAmount = pool.collateralOf(borrower);
        uint16 h0 = DefralMath.healthRatioBps(collateralAmount, price, outstanding);
        uint16 h1 = DefralMath.healthRatioBps(collateralAmount, price, outstanding - amount);

        emit Rescued(borrower, KIND_COUPON, amount, h0, h1, price, roundId, uint64(block.timestamp));
    }

    // ───────────────────────── internal ─────────────────────────

    function _setPolicy(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep) internal {
        if (triggerBps < MIN_TRIGGER_BPS || triggerBps > MAX_TRIGGER_BPS) {
            revert InvalidTriggerBps(triggerBps, MIN_TRIGGER_BPS, MAX_TRIGGER_BPS);
        }
        if (targetBps < triggerBps) revert InvalidTargetBps(targetBps, triggerBps);
        if (maxRepayPerEvent == 0) revert InvalidMaxRepayPerEvent();

        policy = Policy({
            triggerBps: triggerBps, targetBps: targetBps, maxRepayPerEvent: maxRepayPerEvent, couponSweep: couponSweep
        });
        emit PolicySet(triggerBps, targetBps, maxRepayPerEvent, couponSweep);
    }
}
