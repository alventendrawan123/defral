// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IDefralPool} from "./interfaces/IDefralPool.sol";
import {MockUSD} from "./MockUSD.sol";
import {DefralMath} from "./libraries/DefralMath.sol";

/// @notice Holds escrowed collateral, tracks outstanding debt, and is the ONLY place jaminan
///         can actually change hands — via a real, permissionless liquidate() (plan.md G1, C1, C2).
/// @dev    This contract is explicitly NOT mainnet-ready (plan.md §9.10) — a real deployment
///         would sit behind a real lending protocol. What DOES have to survive to mainnet is
///         the shape DefralVault depends on: applyRepayment() is bookkeeping-only, collateral
///         is real ERC20 custody, and liquidation is gated on health first, grace second (K7).
contract MockLendingPool is IDefralPool {
    using SafeERC20 for IERC20;

    /// "Pinjam 100, jaminan 110" in basis points (plan.md K1, PRD §4.3). Below this, anyone may liquidate.
    uint16 public constant LIQUIDATION_BPS = 11_000;

    /// The liquidator's incentive: they repay the debt and receive its value in collateral
    /// PLUS this bonus, capped at whatever is actually escrowed (plan.md C2, PRD §4.3).
    uint16 public constant LIQUIDATION_BONUS_BPS = 500;

    /// Flat quarterly coupon rate applied to yield-bearing collateral's notional quantity.
    /// 10_000 units @ 450bps / 4 = 112.50 — the exact number plan.md §5's test_couponAmount asserts.
    uint16 public constant COUPON_RATE_BPS = 450;

    uint256 internal constant BPS_DENOM = 10_000;

    address public immutable owner;
    MockUSD public immutable dUSD;

    mapping(address => CollateralInfo) internal _collateralInfo;
    mapping(address => bool) public isRepayer;
    mapping(address => Loan) internal _loans;

    /// Coupon ACCRUED and not yet swept, per borrower. This is the replay bound on sweepCoupon():
    /// a coupon is a thing that happened once, so it must be state, not a formula. Deriving it
    /// from `collateralAmount` instead would return the same number on every call — and since
    /// a sweep never changes collateral, the agent could sweep in a loop and erase the whole
    /// loan book with nothing behind it (the predecessor's "reserve with no funding source",
    /// reproduced). Backed by real tokens in accrueQuarterlyCoupon.
    mapping(address => uint256) public override pendingCoupon;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier onlyRepayer() {
        if (!isRepayer[msg.sender]) revert NotAuthorizedRepayer(msg.sender);
        _;
    }

    constructor(address owner_, MockUSD dUSD_) {
        owner = owner_;
        dUSD = dUSD_;
    }

    // ───────────────────────── owner / demo setup ─────────────────────────

    /// @notice Registers a collateral instrument the pool will accept and price.
    /// @dev    SIAPA: only `owner` (deployer). KENAPA BOLEH: this is demo setup, run once per
    ///         instrument before any position opens — it is not part of the agent's authority
    ///         surface at all. Called twice in the demo (dUST, mXAU) to prove the same engine
    ///         protects both a yield-bearing and a non-yield instrument (plan.md K3).
    function allowCollateral(address token, string calldata instrumentId, uint8 decimals_, bool yieldBearing)
        external
        override
        onlyOwner
    {
        _collateralInfo[token] = CollateralInfo({
            allowed: true,
            yieldBearing: yieldBearing,
            decimals: decimals_,
            instrumentId: instrumentId,
            priceFeed: address(0)
        });
        emit CollateralAllowed(token, instrumentId, decimals_, yieldBearing);
    }

    /// @notice Binds a price feed to a collateral instrument. Settable ONCE, never changed.
    /// @dev    Write-once is load-bearing, not tidiness. A DefralVault pins its oracle as an
    ///         `immutable` at construction; this pool resolves price per collateral. If this
    ///         were re-settable, the owner could point the pool at a different feed and the two
    ///         would disagree about the same position — guardRepay() reading one number while
    ///         liquidate() reads another. Requirement D2 says one position has one health ratio;
    ///         making this immutable-after-first-set is how that survives an untrusted owner.
    function setPriceFeed(address token, address feed) external override onlyOwner {
        if (!_collateralInfo[token].allowed) revert CollateralNotAllowed(token);
        if (_collateralInfo[token].priceFeed != address(0)) revert PriceFeedAlreadySet(token);
        if (feed == address(0)) revert NoPriceFeed(token);
        _collateralInfo[token].priceFeed = feed;
        emit PriceFeedSet(token, feed);
    }

    /// @notice Authorizes a DefralVault to call applyRepayment() on behalf of its borrower.
    /// @dev    SIAPA: only `owner`. KENAPA BOLEH: EVM has no equivalent of Daml's co-signed
    ///         `Loan` propagating pool authority automatically — the pool must allowlist each
    ///         vault explicitly (plan.md §4.4 note: this is a WEAKER fidelity than Canton, and
    ///         we say so). YANG SENGAJA TIDAK BISA: an unregistered address can never move debt.
    function registerRepayer(address vault) external override onlyOwner {
        isRepayer[vault] = true;
        emit RepayerRegistered(vault);
    }

    /// @notice Opens a demo position: pulls real collateral into escrow, mints the loan principal.
    /// @dev    SIAPA: only `owner`. This is test/demo scaffolding, not a borrower-facing entry
    ///         point — plan.md §6 Selasa schedule calls this "openPosition dengan angka demo persis".
    function openPosition(address borrower, address collateralToken, uint256 collateralAmt, uint256 principal)
        external
        override
        onlyOwner
    {
        if (_loans[borrower].exists) revert LoanAlreadyExists(borrower);
        if (!_collateralInfo[collateralToken].allowed) revert CollateralNotAllowed(collateralToken);

        _loans[borrower] = Loan({
            borrower: borrower,
            collateralToken: collateralToken,
            collateralAmount: collateralAmt,
            outstanding: principal,
            graceExpiry: 0,
            exists: true
        });

        IERC20(collateralToken).safeTransferFrom(borrower, address(this), collateralAmt);
        dUSD.mint(borrower, principal);

        emit PositionOpened(borrower, collateralToken, collateralAmt, principal);
    }

    /// @notice Demo lever for C4: opens a grace window that delays — but never overrides —
    ///         the health gate on liquidate() (plan.md K7). Grace exists as state here, not
    ///         as a full 72-hour engine (plan.md §15).
    function openGracePeriod(address borrower, uint256 duration) external override onlyOwner {
        if (!_loans[borrower].exists) revert NoSuchLoan(borrower);
        uint256 expiry = block.timestamp + duration;
        _loans[borrower].graceExpiry = expiry;
        emit GraceOpened(borrower, expiry);
    }

    /// @notice Issuer accrues one quarter's coupon and BACKS IT with real tokens.
    /// @dev    SIAPA: only `owner` (the demo issuer). KENAPA BOLEH: the issuer of a
    ///         yield-bearing instrument is who actually owes the coupon.
    ///         YANG SENGAJA TIDAK BISA: accrue on a non-yield instrument, or accrue without
    ///         minting the tokens that back it. The mint is the point: a coupon sweep reduces
    ///         debt, so something real has to arrive first, or the debt reduction is invented.
    function accrueQuarterlyCoupon(address borrower) external override onlyOwner returns (uint256 amount) {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) revert NoSuchLoan(borrower);
        if (!_collateralInfo[loan.collateralToken].yieldBearing) revert NotYieldBearing(loan.collateralToken);

        amount = DefralMath.quarterlyCoupon(loan.collateralAmount, COUPON_RATE_BPS);
        dUSD.mint(address(this), amount); // mock issuer: the coupon arrives as real balance
        pendingCoupon[borrower] += amount;

        emit CouponAccrued(borrower, amount, pendingCoupon[borrower]);
    }

    // ───────────────────────── vault-only ─────────────────────────

    /// @notice Reduces a borrower's outstanding debt for a repayment whose tokens ALREADY moved.
    /// @dev    SIAPA: only a vault this pool's owner has `registerRepayer`'d.
    ///         KENAPA BOLEH: the vault transferred the dUSD to this pool in the same transaction
    ///         before calling — this function is bookkeeping-only, it never itself moves a token.
    ///         YANG SENGAJA TIDAK BISA: be used for a coupon sweep. A sweep has no incoming
    ///         transfer, so routing it here would reduce debt with nothing behind it. Coupons
    ///         go through applyCouponSweep, which spends accrued balance instead.
    function applyRepayment(address borrower, uint256 amount) external override onlyRepayer {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) revert NoSuchLoan(borrower);

        uint256 applied = DefralMath.min(amount, loan.outstanding);
        loan.outstanding -= applied;

        _maybeClearGrace(loan, borrower);
        emit RepaymentApplied(borrower, applied, loan.outstanding);
    }

    /// @notice Spends accrued coupon and reduces debt, atomically, in that order.
    /// @dev    SIAPA: only a registered vault. KENAPA BOLEH: the tokens are already here —
    ///         accrueQuarterlyCoupon minted them into this pool when the coupon was declared.
    ///         YANG SENGAJA TIDAK BISA: spend more coupon than was accrued. That single check
    ///         is what bounds sweepCoupon(): one accrual funds exactly one sweep of that size,
    ///         and a second call on the same accrual reverts instead of erasing more debt.
    ///         EFFECTS BEFORE ANYTHING: pendingCoupon is decremented first, so even a reentrant
    ///         path sees the balance already spent.
    function applyCouponSweep(address borrower, uint256 amount) external override onlyRepayer {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) revert NoSuchLoan(borrower);

        uint256 accrued = pendingCoupon[borrower];
        if (amount > accrued) revert CouponExceedsAccrued(accrued, amount);

        pendingCoupon[borrower] = accrued - amount; // EFFECTS first — this is the replay bound

        uint256 applied = DefralMath.min(amount, loan.outstanding);
        loan.outstanding -= applied;

        _maybeClearGrace(loan, borrower);
        emit CouponSwept(borrower, applied, pendingCoupon[borrower], loan.outstanding);
    }

    // ───────────────────────── permissionless ─────────────────────────

    /// @notice Seizes an unguarded position's collateral. Callable by ANYONE — that is the point
    ///         (plan.md G1, C1): the previous implementation's seizure choice was `pure ()` and
    ///         never moved a token. This one does.
    /// @dev    SIAPA: anyone. KENAPA BOLEH: health < LIQUIDATION_BPS is a fact anyone can verify
    ///         onchain themselves — no permission needed to act on public information.
    ///         GATE ORDER: health is checked FIRST and is the only gate that can never be
    ///         bypassed; grace only delays an already-unhealthy position, it never protects
    ///         a healthy one (plan.md K7, requirement C4).
    function liquidate(address borrower) external override {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) revert NoSuchLoan(borrower);

        uint16 h = healthRatioBps(borrower);
        if (h >= LIQUIDATION_BPS) revert NotLiquidatable(h);
        if (loan.graceExpiry > block.timestamp) revert GraceStillOpen(loan.graceExpiry);

        address token = loan.collateralToken;
        int256 price = _priceOf(token);
        uint256 debt = loan.outstanding;
        uint256 collateralQty = loan.collateralAmount;

        uint256 owedUnits = DefralMath.collateralUnitsForDebtValue(debt, price);
        uint256 seized = DefralMath.min((owedUnits * (BPS_DENOM + LIQUIDATION_BONUS_BPS)) / BPS_DENOM, collateralQty);
        uint256 refund = collateralQty - seized;

        loan.outstanding = 0;
        loan.collateralAmount = 0;

        IERC20(address(dUSD)).safeTransferFrom(msg.sender, address(this), debt);
        IERC20(token).safeTransfer(msg.sender, seized);
        if (refund > 0) IERC20(token).safeTransfer(loan.borrower, refund);

        emit Liquidated(borrower, msg.sender, seized, refund, h);
    }

    // ───────────────────────── borrower-only ─────────────────────────

    /// @notice Reclaims escrowed collateral. Reverts while any debt is outstanding — this is
    ///         what makes the escrow real (plan.md G2, C3): the predecessor's `Unlock` had no
    ///         such check and a borrower could walk away with pledged collateral mid-loan.
    function withdrawCollateral(uint256 amount) external override {
        Loan storage loan = _loans[msg.sender];
        if (!loan.exists) revert NoSuchLoan(msg.sender);
        if (loan.outstanding > 0) revert DebtOutstanding(loan.outstanding);
        if (amount > loan.collateralAmount) revert InsufficientCollateral(loan.collateralAmount, amount);

        loan.collateralAmount -= amount;
        IERC20(loan.collateralToken).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    // ───────────────────────── views ─────────────────────────

    function healthRatioBps(address borrower) public view override returns (uint16) {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) revert NoSuchLoan(borrower);
        int256 price = _priceOf(loan.collateralToken);
        return DefralMath.healthRatioBps(loan.collateralAmount, price, loan.outstanding);
    }

    function debtOf(address borrower) external view override returns (uint256) {
        return _loans[borrower].outstanding;
    }

    function collateralOf(address borrower) external view override returns (uint256) {
        return _loans[borrower].collateralAmount;
    }

    function collateralTokenOf(address borrower) external view override returns (address) {
        return _loans[borrower].collateralToken;
    }

    function isYieldBearing(address token) external view override returns (bool) {
        return _collateralInfo[token].yieldBearing;
    }

    function priceFeedOf(address token) external view override returns (address) {
        return _collateralInfo[token].priceFeed;
    }

    /// @notice Coupon ACCRUED and not yet swept — uncapped against debt, because the debt cap
    ///         (K5) belongs to the caller so the UI can still show "what did the collateral
    ///         generate" separately from "how much of it could be applied".
    /// @dev    This reads STATE, deliberately. An earlier revision derived it from
    ///         `collateralAmount` — a pure function that returns the same number forever, which
    ///         made sweepCoupon() unbounded: sweeping never changes collateral, so the agent
    ///         could loop and erase the entire loan. A coupon happened once; it must be spent once.
    function couponDue(address borrower) public view override returns (uint256) {
        Loan storage loan = _loans[borrower];
        if (!loan.exists) return 0;
        if (!_collateralInfo[loan.collateralToken].yieldBearing) return 0;
        return pendingCoupon[borrower];
    }

    function getLoan(address borrower) external view override returns (Loan memory) {
        return _loans[borrower];
    }

    function collateralInfo(address token) external view returns (CollateralInfo memory) {
        return _collateralInfo[token];
    }

    function _priceOf(address token) internal view returns (int256) {
        address feed = _collateralInfo[token].priceFeed;
        if (feed == address(0)) revert NoPriceFeed(token);
        (, int256 price,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        // Staleness is DefralVault's concern for guardRepay (plan.md A3); the pool only needs
        // "has a price ever been pushed" — updatedAt == 0 means the feed is misconfigured.
        if (updatedAt == 0) revert NoPriceFeed(token);
        return price;
    }

    function _maybeClearGrace(Loan storage loan, address borrower) internal {
        if (loan.graceExpiry == 0) return;
        int256 price = _priceOf(loan.collateralToken);
        uint16 h = DefralMath.healthRatioBps(loan.collateralAmount, price, loan.outstanding);
        if (h >= LIQUIDATION_BPS) {
            loan.graceExpiry = 0;
            emit GraceCleared(borrower);
        }
    }
}
