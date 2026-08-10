// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DefralTestBase} from "./Base.t.sol";
import {IDefralPool} from "../src/interfaces/IDefralPool.sol";
import {DefralVaultFactory} from "../src/DefralVaultFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice MockLendingPool — the escrow that is real (plan.md G2, C3) and the liquidation
///         that actually moves collateral (plan.md G1, C1, C2), unlike the predecessor's
///         `LastResortDefault` (pure ()) and `Unlock` (no holder consent needed).
contract MockLendingPoolTest is DefralTestBase {
    function test_collateralRegistry_bothInstrumentsRegistered() public view {
        assertTrue(pool.isYieldBearing(address(dUST)));
        assertFalse(pool.isYieldBearing(address(mXAU)));
    }

    function test_liquidateSeizesCollateralAndPaysBonus() public {
        address victim = makeAddr("victim");
        uint256 collateral = 10_000e18;
        uint256 debt = 9_200e6; // health 10870 bps, below LIQUIDATION_BPS (11000)

        dUST.mint(victim, collateral);
        vm.prank(victim);
        dUST.approve(address(pool), collateral);
        pool.openPosition(victim, address(dUST), collateral, debt);

        assertEq(pool.healthRatioBps(victim), 10_870);

        dUSD.mint(liquidator, debt);
        vm.prank(liquidator);
        dUSD.approve(address(pool), debt);

        vm.prank(liquidator);
        pool.liquidate(victim);

        // owed units = 9,200 (debt value at $1.00) * 1.05 bonus = 9,660 dUST to the liquidator;
        // the remaining 340 dUST (of the 10,000 pledged) refunds to the victim.
        assertEq(dUST.balanceOf(liquidator), 9_660e18);
        assertEq(dUST.balanceOf(victim), 340e18);
        assertEq(pool.debtOf(victim), 0);
        assertEq(pool.collateralOf(victim), 0);
    }

    function test_liquidateRefusesHealthyPosition() public {
        address victim = makeAddr("healthyVictim");
        dUST.mint(victim, 10_000e18);
        vm.prank(victim);
        dUST.approve(address(pool), 10_000e18);
        pool.openPosition(victim, address(dUST), 10_000e18, 6_000e6); // 16667 bps

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotLiquidatable.selector, uint16(16_667)));
        vm.prank(liquidator);
        pool.liquidate(victim);
    }

    /// @notice C4/K7: health is the PRIMARY gate — an active grace window only delays an
    ///         already-unguarded liquidation, it can never protect a position above threshold.
    function test_graceDelaysLiquidation_butNeverProtectsAHealthyPosition() public {
        address unguarded = makeAddr("unguarded");
        dUST.mint(unguarded, 10_000e18);
        vm.prank(unguarded);
        dUST.approve(address(pool), 10_000e18);
        pool.openPosition(unguarded, address(dUST), 10_000e18, 9_200e6); // 10870 bps

        pool.openGracePeriod(unguarded, 1 hours);

        dUSD.mint(liquidator, 9_200e6);
        vm.prank(liquidator);
        dUSD.approve(address(pool), 9_200e6);

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.GraceStillOpen.selector, block.timestamp + 1 hours));
        vm.prank(liquidator);
        pool.liquidate(unguarded);

        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(liquidator);
        pool.liquidate(unguarded); // grace expired -> proceeds
        assertEq(pool.debtOf(unguarded), 0);

        // A healthy position, even with a (long-expired) grace entry, is never liquidatable —
        // it never reaches the grace check at all, because the health check runs first.
        address healthy = makeAddr("healthy");
        dUST.mint(healthy, 10_000e18);
        vm.prank(healthy);
        dUST.approve(address(pool), 10_000e18);
        pool.openPosition(healthy, address(dUST), 10_000e18, 6_000e6); // 16667 bps
        pool.openGracePeriod(healthy, 0);
        vm.warp(block.timestamp + 1);

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotLiquidatable.selector, uint16(16_667)));
        vm.prank(liquidator);
        pool.liquidate(healthy);
    }

    function test_withdrawCollateral_revertsWhileDebtOutstanding() public {
        address who = makeAddr("withdrawer");
        dUST.mint(who, 5_000e18);
        vm.prank(who);
        dUST.approve(address(pool), 5_000e18);
        pool.openPosition(who, address(dUST), 5_000e18, 1_000e6);

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.DebtOutstanding.selector, uint256(1_000e6)));
        vm.prank(who);
        pool.withdrawCollateral(5_000e18);
    }

    function test_withdrawCollateral_succeedsOnceDebtCleared() public {
        address who = makeAddr("withdrawer2");
        dUST.mint(who, 5_000e18);
        vm.prank(who);
        dUST.approve(address(pool), 5_000e18);
        pool.openPosition(who, address(dUST), 5_000e18, 1_000e6);

        pool.registerRepayer(address(this)); // test contract stands in as an authorized repayer
        pool.applyRepayment(who, 1_000e6);

        vm.prank(who);
        pool.withdrawCollateral(5_000e18);

        assertEq(dUST.balanceOf(who), 5_000e18);
        assertEq(pool.collateralOf(who), 0);
    }

    function test_applyRepayment_onlyAuthorizedRepayer() public {
        address who = makeAddr("borrowerX");
        dUST.mint(who, 5_000e18);
        vm.prank(who);
        dUST.approve(address(pool), 5_000e18);
        pool.openPosition(who, address(dUST), 5_000e18, 1_000e6);

        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotAuthorizedRepayer.selector, stranger));
        vm.prank(stranger);
        pool.applyRepayment(who, 500e6);
    }

    function test_registerRepayer_onlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotOwner.selector, stranger));
        vm.prank(stranger);
        pool.registerRepayer(stranger);
    }

    function test_allowCollateral_onlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(IDefralPool.NotOwner.selector, stranger));
        vm.prank(stranger);
        pool.allowCollateral(address(0xBEEF), "fake", 18, false);
    }

    // ───────── D2: one position, one price ─────────

    /// @notice The pool's feed is write-once. If the owner could repoint it after vaults exist,
    ///         every vault deployed under the old feed would silently start disagreeing with
    ///         liquidate() about the same position's health.
    function test_setPriceFeed_isWriteOnce() public {
        vm.expectRevert(abi.encodeWithSelector(IDefralPool.PriceFeedAlreadySet.selector, address(dUST)));
        pool.setPriceFeed(address(dUST), address(goldOracle));

        assertEq(pool.priceFeedOf(address(dUST)), address(oracle)); // unchanged
    }

    function test_setPriceFeed_rejectsUnregisteredCollateral() public {
        vm.expectRevert(abi.encodeWithSelector(IDefralPool.CollateralNotAllowed.selector, address(0xBEEF)));
        pool.setPriceFeed(address(0xBEEF), address(oracle));
    }

    /// @notice The other half of the same invariant: a vault may only pin the feed its pool
    ///         already prices that collateral with. Supplying mXAU's feed for a dUST position
    ///         would give guardRepay() and liquidate() two different health ratios.
    function test_deployVault_rejectsOracleThatPoolDoesNotUse() public {
        vm.expectRevert(
            abi.encodeWithSelector(DefralVaultFactory.OracleMismatch.selector, address(oracle), address(goldOracle))
        );
        vm.prank(stranger);
        factory.deployVault(agentExecutor, dUST, goldOracle, TRIGGER_BPS, TARGET_BPS, MAX_REPAY, true);
    }

    function test_deployVault_rejectsUnregisteredCollateral() public {
        vm.expectRevert(abi.encodeWithSelector(DefralVaultFactory.CollateralNotRegistered.selector, address(0xBEEF)));
        vm.prank(stranger);
        factory.deployVault(agentExecutor, IERC20(address(0xBEEF)), oracle, TRIGGER_BPS, TARGET_BPS, MAX_REPAY, true);
    }
}
