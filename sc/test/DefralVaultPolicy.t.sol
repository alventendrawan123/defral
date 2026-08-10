// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DefralTestBase} from "./Base.t.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {IDefralVault} from "../src/interfaces/IDefralVault.sol";

/// @notice setPolicy() / revokeAgent() — the borrower's own controls (plan.md K6, A5) —
///         plus the view-parity checks that back D2 ("identical numbers in contract, agent,
///         and UI"): quoteGuardRepay() must predict exactly what guardRepay() applies.
contract DefralVaultPolicyTest is DefralTestBase {
    function test_setPolicy_updatesTriggerAndTarget() public {
        DefralVault vault = _seedDemoPosition();

        vm.prank(borrower);
        vault.setPolicy(12_500, 14_000, 1_000e6, false);

        IDefralVault.Position memory p = vault.getPosition();
        assertEq(p.triggerBps, 12_500);
        assertEq(p.targetBps, 14_000);
        assertEq(p.maxRepayPerEvent, 1_000e6);
        assertFalse(p.couponSweep);
    }

    function test_setPolicy_revertsBelowMinTrigger() public {
        DefralVault vault = _seedDemoPosition();
        vm.expectRevert(
            abi.encodeWithSelector(
                DefralVault.InvalidTriggerBps.selector, uint16(11_999), uint16(12_000), uint16(15_000)
            )
        );
        vm.prank(borrower);
        vault.setPolicy(11_999, 14_500, MAX_REPAY, true);
    }

    function test_setPolicy_revertsAboveMaxTrigger() public {
        DefralVault vault = _seedDemoPosition();
        vm.expectRevert(
            abi.encodeWithSelector(
                DefralVault.InvalidTriggerBps.selector, uint16(15_001), uint16(12_000), uint16(15_000)
            )
        );
        vm.prank(borrower);
        vault.setPolicy(15_001, 15_500, MAX_REPAY, true);
    }

    function test_setPolicy_revertsTargetBelowTrigger() public {
        DefralVault vault = _seedDemoPosition();
        vm.expectRevert(abi.encodeWithSelector(DefralVault.InvalidTargetBps.selector, uint16(12_999), uint16(13_000)));
        vm.prank(borrower);
        vault.setPolicy(13_000, 12_999, MAX_REPAY, true);
    }

    function test_setPolicy_revertsZeroMaxRepay() public {
        DefralVault vault = _seedDemoPosition();
        vm.expectRevert(DefralVault.InvalidMaxRepayPerEvent.selector);
        vm.prank(borrower);
        vault.setPolicy(TRIGGER_BPS, TARGET_BPS, 0, true);
    }

    function test_setPolicy_onlyBorrower() public {
        DefralVault vault = _seedDemoPosition();
        vm.expectRevert(abi.encodeWithSelector(IDefralVault.NotBorrower.selector, stranger));
        vm.prank(stranger);
        vault.setPolicy(TRIGGER_BPS, TARGET_BPS, MAX_REPAY, true);
    }

    function test_constructor_rejectsOutOfBoundsPolicy() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                DefralVault.InvalidTriggerBps.selector, uint16(9_000), uint16(12_000), uint16(15_000)
            )
        );
        vm.prank(borrower);
        factory.deployVault(agentExecutor, dUST, oracle, 9_000, 14_500, MAX_REPAY, true);
    }

    function test_revokeAgent_isPermanentAndOnlyBorrower() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.NotBorrower.selector, stranger));
        vm.prank(stranger);
        vault.revokeAgent();

        vm.prank(borrower);
        vault.revokeAgent();
        assertTrue(vault.revoked());

        vm.expectRevert(IDefralVault.Refused_AgentRevoked.selector);
        vm.prank(agentExecutor);
        vault.guardRepay();

        vm.expectRevert(IDefralVault.Refused_AgentRevoked.selector);
        vm.prank(agentExecutor);
        vault.sweepCoupon();
    }

    /// @notice D2: the number the UI would preview (quoteGuardRepay) must be EXACTLY what
    ///         guardRepay() actually moves — one formula, not three that happen to agree.
    function test_quoteGuardRepay_matchesActualRepay() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        uint256 quoted = vault.quoteGuardRepay();
        assertEq(quoted, 758_620_690);

        uint256 debtBefore = pool.debtOf(borrower);
        vm.prank(agentExecutor);
        vault.guardRepay();

        assertEq(debtBefore - pool.debtOf(borrower), quoted);
    }

    function test_getPosition_reflectsLiveState() public {
        DefralVault vault = _seedDemoPosition();
        IDefralVault.Position memory p = vault.getPosition();

        assertEq(p.borrower, borrower);
        assertEq(p.outstanding, 6_000e6);
        assertEq(p.collateralAmount, 10_000e18);
        assertEq(p.triggerBps, TRIGGER_BPS);
        assertEq(p.targetBps, TARGET_BPS);
        assertEq(p.reserve, 5_000e6);
        assertEq(p.lastActedRound, 0);
        assertFalse(p.revoked);
    }

    function test_agentExecutorAndBorrowerAreImmutable() public {
        DefralVault vault = _seedDemoPosition();
        assertEq(vault.agentExecutor(), agentExecutor);
        assertEq(vault.borrower(), borrower);
    }
}
