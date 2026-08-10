// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice SATU VAULT PER BORROWER. Vault ini TIDAK PERNAH memegang dana reserve.
///         Reserve = min(dUSD.balanceOf(borrower), dUSD.allowance(borrower, vault)).
///         Karena itu tidak ada topUp() dan tidak ada withdraw(): kami tidak pernah memegangnya.
interface IDefralVault {
    // ───────── struct ─────────
    struct Position {
        address borrower;
        uint256 outstanding; // utang dUSD, 6 desimal
        uint256 collateralAmount; // dUST di-escrow di pool, 18 desimal
        uint16 triggerBps; // 13000
        uint16 targetBps; // 14500
        uint256 maxRepayPerEvent; // 2000e6
        bool couponSweep;
        uint256 reserve; // min(balanceOf, allowance) — TIDAK dipegang vault
        uint80 lastActedRound;
        bool revoked;
    }

    // ───────── error (satu per alasan penolakan) ─────────
    error Refused_Healthy(uint16 healthBps, uint16 triggerBps);
    error Refused_StaleOracle(uint256 updatedAt, uint256 maxStale);
    error Refused_AlreadyActed(uint80 roundId);
    error Refused_NothingToRepay();
    error Refused_NoReserve(uint256 available);
    error Refused_CouponSweepOff();
    error Refused_NoCouponDue();
    error Refused_AgentRevoked();
    error NotAgent(address caller);
    error NotBorrower(address caller);

    // ───────── event ─────────
    /// @param kind 1 = RESCUE, 2 = COUPON.  uint8 ber-enum, JANGAN PERNAH free text.
    event Rescued(
        address indexed borrower,
        uint8 indexed kind,
        uint256 amount,
        uint16 healthBefore,
        uint16 healthAfter,
        int256 price,
        uint80 roundId,
        uint64 at
    );
    event PolicySet(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep);
    event AgentRevoked();

    // ───────── view — siapa pun ─────────
    function healthRatioBps() external view returns (uint16); // ZERO-ARG. Untuk check-and-execute.
    function reserve() external view returns (uint256); // min(balanceOf, allowance)
    function quoteGuardRepay() external view returns (uint256);
    function amountToReachTarget() external view returns (uint256);
    function couponDue() external view returns (uint256);
    function getPosition() external view returns (Position memory);
    function agentExecutor() external view returns (address);
    function borrower() external view returns (address);

    // ───────── onlyBorrower ─────────
    function setPolicy(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep) external;
    function revokeAgent() external; // KILL SWITCH

    // ───────── onlyAgent — DUA FUNGSI. ITU SAJA. KEDUANYA ZERO-ARGUMENT. ─────────
    function guardRepay() external;
    function sweepCoupon() external;
}
