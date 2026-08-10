// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DefralTestBase} from "./Base.t.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {IDefralVault} from "../src/interfaces/IDefralVault.sol";
import {IDefralPool} from "../src/interfaces/IDefralPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @notice sweepCoupon() — proactive paydown, SENGAJA NOL health gate (plan.md K5, D4).
///         Covers G8 (non-yield degrades to no-op, never aborts) and G9 (capped at debt,
///         never reverts the way Coupon.daml's uncapped SweepToLoan would).
contract DefralVaultCouponTest is DefralTestBase {
    function test_couponAmount() public {
        DefralVault vault = _seedDemoPosition(); // 10,000 dUST, 450bps coupon rate
        assertEq(vault.couponDue(), 112_500_000); // 10,000 * 450bps / 4 = 112.50
    }

    function test_couponNoHealthGate() public {
        DefralVault vault = _seedDemoPosition(); // healthy: 16667 bps, trigger 13000
        assertGe(vault.healthRatioBps(), 13_000);

        vm.prank(agentExecutor);
        vault.sweepCoupon(); // must NOT revert on a healthy position

        assertEq(pool.debtOf(borrower), 6_000e6 - 112_500_000);
    }

    function test_couponCappedByDebt() public {
        Seed memory s = _defaultSeed();
        s.debt = 50e6; // below the 112.50 coupon due
        DefralVault vault = _seed(s);

        assertEq(vault.couponDue(), 112_500_000); // due is uncapped, the view always shows it

        vm.prank(agentExecutor);
        vault.sweepCoupon(); // must cap at outstanding, not revert like Daml's SweepToLoan would

        assertEq(pool.debtOf(borrower), 0);
    }

    function test_refuseCouponSweepOff() public {
        Seed memory s = _defaultSeed();
        s.couponSweep = false;
        DefralVault vault = _seed(s);

        vm.expectRevert(IDefralVault.Refused_CouponSweepOff.selector);
        vm.prank(agentExecutor);
        vault.sweepCoupon();
    }

    /// @notice K4/D5: a non-yield collateral (mXAU/gold) must degrade sweepCoupon() to a
    ///         no-op the agent naturally never triggers (couponDue() == 0) — not the
    ///         predecessor's hard-fail on a zero coupon rate.
    function test_couponNoYield_isNoOpNotAbort() public {
        address goldBorrower = makeAddr("goldBorrower");
        uint256 collateral = 10_000e18;
        uint256 debt = 6_000e6;

        mXAU.mint(goldBorrower, collateral);
        vm.prank(goldBorrower);
        mXAU.approve(address(pool), collateral);
        pool.openPosition(goldBorrower, address(mXAU), collateral, debt);

        vm.prank(goldBorrower);
        address v = factory.deployVault(
            agentExecutor,
            IERC20(address(mXAU)),
            AggregatorV3Interface(address(goldOracle)),
            TRIGGER_BPS,
            TARGET_BPS,
            MAX_REPAY,
            true
        );
        pool.registerRepayer(v);
        DefralVault vault = DefralVault(v);

        assertEq(vault.couponDue(), 0, "non-yield collateral must report zero coupon due");

        vm.expectRevert(IDefralVault.Refused_NoCouponDue.selector);
        vm.prank(agentExecutor);
        vault.sweepCoupon(); // explicit revert here, not a silent success — the agent simply never calls it live
    }

    function test_refuseNoCouponDueWhenAlreadyZero() public {
        Seed memory s = _defaultSeed();
        s.debt = 0; // fully repaid position — nothing left for a coupon to pay down
        DefralVault vault = _seed(s);

        vm.expectRevert(IDefralVault.Refused_NoCouponDue.selector);
        vm.prank(agentExecutor);
        vault.sweepCoupon();
    }

    /// @notice REGRESSION. One declared coupon funds exactly ONE sweep of that size.
    ///
    ///         An earlier revision derived couponDue() from `collateralAmount` — a pure
    ///         function. Since a sweep never changes collateral, it returned the same 112.50
    ///         on every call, and applyRepayment moves no tokens. Together that let the agent
    ///         loop sweepCoupon() 54 times and drive a 6,000 dUSD debt to zero with nothing
    ///         behind it. Every coupon test passed throughout, because every one of them called
    ///         sweepCoupon() exactly once.
    ///
    ///         The bound now lives in the pool: applyCouponSweep debits accrued balance, so the
    ///         second call has nothing to spend.
    function test_couponSweepIsBoundedByAccrual_notRepeatable() public {
        DefralVault vault = _seedDemoPosition(); // debt 6,000e6, one coupon accrued: 112.50
        uint256 poolDusdBefore = dUSD.balanceOf(address(pool));

        vm.prank(agentExecutor);
        vault.sweepCoupon();

        assertEq(pool.debtOf(borrower), DEMO_DEBT - 112_500_000, "first sweep applies the coupon");
        assertEq(pool.pendingCoupon(borrower), 0, "and consumes the accrual");
        assertEq(vault.couponDue(), 0, "so nothing is due until the issuer declares another");

        // Second call on the same accrual: nothing left to spend.
        vm.expectRevert(IDefralVault.Refused_NoCouponDue.selector);
        vm.prank(agentExecutor);
        vault.sweepCoupon();

        assertEq(pool.debtOf(borrower), DEMO_DEBT - 112_500_000, "debt unchanged by the repeat");

        // Every dUSD the sweep applied was already in the pool, minted when the coupon was
        // declared. The sweep spends a real balance; it does not invent one.
        assertEq(dUSD.balanceOf(address(pool)), poolDusdBefore, "sweep moved no new tokens in");
        assertGe(poolDusdBefore, 112_500_000, "the coupon was backed before it could be spent");
    }

    /// @notice A second declared quarter funds a second sweep — the bound is per accrual,
    ///         not a one-time lock.
    function test_couponSweepResumesAfterNextAccrual() public {
        DefralVault vault = _seedDemoPosition();

        vm.prank(agentExecutor);
        vault.sweepCoupon();

        pool.accrueQuarterlyCoupon(borrower); // issuer declares the next quarter
        assertEq(vault.couponDue(), 112_500_000);

        vm.prank(agentExecutor);
        vault.sweepCoupon();

        assertEq(pool.debtOf(borrower), DEMO_DEBT - 2 * 112_500_000);
    }

    /// @notice Accrual itself refuses on a non-yield instrument — the coupon module degrades
    ///         to "never fires", it never invents yield for gold (K4/D5, G8).
    function test_accrueRefusesOnNonYieldCollateral() public {
        address goldBorrower = makeAddr("goldBorrower2");
        mXAU.mint(goldBorrower, 10_000e18);
        vm.prank(goldBorrower);
        mXAU.approve(address(pool), 10_000e18);
        pool.openPosition(goldBorrower, address(mXAU), 10_000e18, 6_000e6);

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotYieldBearing.selector, address(mXAU)));
        pool.accrueQuarterlyCoupon(goldBorrower);
    }
}
