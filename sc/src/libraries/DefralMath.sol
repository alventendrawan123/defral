// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Fixed-point health-ratio math shared verbatim by DefralVault and MockLendingPool,
///         so the two never silently compute a different number for the same position
///         (plan.md §9.6 — "one source of truth, used by contract, agent, and UI").
/// @dev    Decimal assumption is baked in BY DESIGN, not generic: collateral tokens 18dp
///         (dUST, mXAU — see MockTreasury.sol), Chainlink-style price 8dp (plan.md K10),
///         dUSD debt 6dp (MockUSD.sol). No scenario in plan.md §5 exercises any other
///         combination, so a generic n-decimal path would be unverified surface, not safety.
library DefralMath {
    uint256 internal constant BPS_DENOM = 10_000;

    uint256 internal constant COLLATERAL_DECIMALS = 18;
    uint256 internal constant PRICE_DECIMALS = 8;
    uint256 internal constant DEBT_DECIMALS = 6;

    /// Collapses collateralAmount(18dp) * price(8dp) straight to debt-token scale (6dp),
    /// so every downstream formula works in ONE unit system instead of juggling three.
    uint256 internal constant VALUE_SCALE = 10 ** (COLLATERAL_DECIMALS + PRICE_DECIMALS - DEBT_DECIMALS);

    error NonPositivePrice(int256 price);

    /// @dev Half-up (half away from zero) — matches Credit.daml `round`, NOT Solidity's
    ///      truncating division. Load-bearing: plan.md K2, PRD Appendix B. Skipping the
    ///      `+ d/2` turns 12666.67 into 12666, not 12667, and the "one number, three
    ///      independent implementations" argument dies with it.
    function mulDivRound(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
        return (a * b + d / 2) / d;
    }

    /// @dev USD value of `collateralAmount` at `price`, expressed at debt-token scale (6dp).
    function collateralValueDebtScale(uint256 collateralAmount, int256 price) internal pure returns (uint256) {
        if (price <= 0) revert NonPositivePrice(price);
        // casting to 'uint256' is safe because price > 0 is already enforced above
        // forge-lint: disable-next-line(unsafe-typecast)
        return (collateralAmount * uint256(price)) / VALUE_SCALE;
    }

    /// @dev healthRatioBps = round(collateralAmount * price * 10000 / outstanding) — Credit.daml:15-17.
    ///      A fully-repaid position (outstanding == 0) is maximally healthy by definition,
    ///      not a division-by-zero panic.
    function healthRatioBps(uint256 collateralAmount, int256 price, uint256 outstanding)
        internal
        pure
        returns (uint16)
    {
        if (outstanding == 0) return type(uint16).max;
        uint256 value = collateralValueDebtScale(collateralAmount, price);
        uint256 bps = mulDivRound(value, BPS_DENOM, outstanding);
        // casting to 'uint16' is safe because the ternary clamps bps to type(uint16).max first
        // forge-lint: disable-next-line(unsafe-typecast)
        return bps > type(uint16).max ? type(uint16).max : uint16(bps);
    }

    /// @dev needed = outstanding - (collateralAmount * price * 10000 / targetBps) — Credit.daml:23-25.
    ///      Truncated toward zero, deliberately NOT rounded — Daml doesn't round this one
    ///      either (plan.md K2). Floors at 0 when already at/above target.
    function amountToReachTarget(uint256 collateralAmount, int256 price, uint256 outstanding, uint16 targetBps)
        internal
        pure
        returns (uint256)
    {
        uint256 value = collateralValueDebtScale(collateralAmount, price);
        uint256 targetOutstanding = (value * BPS_DENOM) / targetBps;
        return outstanding > targetOutstanding ? outstanding - targetOutstanding : 0;
    }

    /// @dev Inverse of collateralValueDebtScale: how many collateral units (18dp) a given
    ///      debt-scale value (6dp) is worth at `price`. Used by MockLendingPool.liquidate()
    ///      to convert "debt repaid" into "collateral owed to the liquidator".
    function collateralUnitsForDebtValue(uint256 debtValue, int256 price) internal pure returns (uint256) {
        if (price <= 0) revert NonPositivePrice(price);
        // casting to 'uint256' is safe because price > 0 is already enforced above
        // forge-lint: disable-next-line(unsafe-typecast)
        return (debtValue * VALUE_SCALE) / uint256(price);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @dev Flat quarterly coupon on a collateral QUANTITY (18dp), rescaled to debt-token
    ///      scale (6dp) so it can be applied straight to `outstanding`. Deliberately takes
    ///      no price: plan.md K9 — Coupon.daml's `faceValue` (a bond's dollar face value)
    ///      becomes collateral quantity here, not a USD-converted value. 10,000 units @
    ///      450bps / 4 = 112.50 — plan.md §5's test_couponAmount asserts this exact figure.
    function quarterlyCoupon(uint256 collateralAmount, uint16 couponRateBps) internal pure returns (uint256) {
        uint256 scaled = mulDivRound(collateralAmount, couponRateBps, BPS_DENOM) / 4;
        return scaled / (10 ** (COLLATERAL_DECIMALS - DEBT_DECIMALS));
    }
}
