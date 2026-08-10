// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Lending-pool side of the escrow. NOT the frozen agent ABI (that's IDefralVault) —
///         a DefralVault only ever calls applyRepayment(); everything else here is pool-owned
///         bookkeeping the agent's two zero-argument functions never touch.
/// @dev    liquidate() is the one function anyone may call directly, by design (plan.md C1, G1).
interface IDefralPool {
    struct CollateralInfo {
        bool allowed;
        bool yieldBearing;
        uint8 decimals;
        string instrumentId;
        address priceFeed;
    }

    struct Loan {
        address borrower;
        address collateralToken;
        uint256 collateralAmount;
        uint256 outstanding;
        uint256 graceExpiry;
        bool exists;
    }

    error NotOwner(address caller);
    error NotAuthorizedRepayer(address caller);
    error NotBorrower(address caller);
    error NotLiquidatable(uint16 healthBps);
    error GraceStillOpen(uint256 expiry);
    error DebtOutstanding(uint256 outstanding);
    error CollateralNotAllowed(address token);
    error NoPriceFeed(address token);
    error LoanAlreadyExists(address borrower);
    error NoSuchLoan(address borrower);
    error InsufficientCollateral(uint256 available, uint256 requested);
    error NotYieldBearing(address token);
    error CouponExceedsAccrued(uint256 accrued, uint256 requested);
    error PriceFeedAlreadySet(address token);

    event CollateralAllowed(address indexed token, string instrumentId, uint8 decimals, bool yieldBearing);
    event PriceFeedSet(address indexed token, address indexed feed);
    event RepayerRegistered(address indexed vault);
    event PositionOpened(address indexed borrower, address indexed token, uint256 collateralAmount, uint256 principal);
    event RepaymentApplied(address indexed borrower, uint256 amount, uint256 outstandingAfter);
    event Liquidated(
        address indexed borrower, address indexed liquidator, uint256 seized, uint256 refunded, uint16 healthBps
    );
    event GraceOpened(address indexed borrower, uint256 expiry);
    event GraceCleared(address indexed borrower);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event CouponAccrued(address indexed borrower, uint256 amount, uint256 pendingAfter);
    event CouponSwept(address indexed borrower, uint256 amount, uint256 pendingAfter, uint256 outstandingAfter);

    // ───────── owner (demo/setup surface — NOT the frozen agent ABI) ─────────
    function allowCollateral(address token, string calldata instrumentId, uint8 decimals_, bool yieldBearing) external;
    function setPriceFeed(address token, address feed) external;
    function registerRepayer(address vault) external;
    function openPosition(address borrower, address collateralToken, uint256 collateralAmt, uint256 principal) external;
    function openGracePeriod(address borrower, uint256 duration) external;

    /// @notice Issuer accrues one quarter's coupon for a yield-bearing position, and BACKS IT
    ///         with real tokens. Without this, a coupon sweep would reduce debt with nothing
    ///         behind it — the same "reserve with no funding source" defect the predecessor had.
    function accrueQuarterlyCoupon(address borrower) external returns (uint256 amount);

    // ───────── vault-only ─────────

    /// @notice Debt bookkeeping for a repayment whose tokens have ALREADY moved to this pool.
    /// @dev    Callers MUST transfer before calling. See applyCouponSweep for the coupon path,
    ///         which consumes accrued balance instead and must never route through here.
    function applyRepayment(address borrower, uint256 amount) external;

    /// @notice Consumes accrued coupon and reduces debt ATOMICALLY, in that order.
    /// @dev    The single entry point for sweepCoupon(). Consuming accrued balance is what makes
    ///         the sweep bounded: one accrual, one sweep. Calling it twice on one accrual reverts.
    function applyCouponSweep(address borrower, uint256 amount) external;

    // ───────── permissionless ─────────
    function liquidate(address borrower) external;

    // ───────── borrower-only ─────────
    function withdrawCollateral(uint256 amount) external;

    // ───────── views ─────────
    function healthRatioBps(address borrower) external view returns (uint16);
    function debtOf(address borrower) external view returns (uint256);
    function collateralOf(address borrower) external view returns (uint256);
    function collateralTokenOf(address borrower) external view returns (address);
    function isYieldBearing(address token) external view returns (bool);

    /// @notice The one price feed bound to a collateral instrument. Write-once in the pool, and
    ///         checked by the factory at deploy, so a vault can never be pointed at a different
    ///         feed than the pool prices the same position with (requirement D2).
    function priceFeedOf(address token) external view returns (address);

    /// @notice Coupon ACCRUED and not yet swept. State, not a formula — a formula would return
    ///         the same number forever and make sweepCoupon() repeatable without limit.
    function couponDue(address borrower) external view returns (uint256);
    function pendingCoupon(address borrower) external view returns (uint256);
    function getLoan(address borrower) external view returns (Loan memory);
}
