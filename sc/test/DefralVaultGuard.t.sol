// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DefralTestBase} from "./Base.t.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {IDefralVault} from "../src/interfaces/IDefralVault.sol";

/// @notice guardRepay() — the narrow gate. Transcribed scenarios from plan.md §5's
///         GuardTests.daml-derived table. Every `revert` in guardRepay() gets its own test
///         here (plan.md §9.8), and the two headline numbers (16667, 12667) are asserted
///         exactly, not "close to" — that exactness IS the cross-implementation argument.
contract DefralVaultGuardTest is DefralTestBase {
    function test_healthAtPar() public {
        DefralVault vault = _seedDemoPosition(); // 10,000 @ $1.00, debt 6,000
        assertEq(vault.healthRatioBps(), 16667);
    }

    function test_healthAtDip() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE; // $0.76
        DefralVault vault = _seed(s);
        assertEq(vault.healthRatioBps(), 12667);
    }

    function test_rescueRestoresTarget() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        assertEq(vault.healthRatioBps(), 12667);
        assertEq(pool.debtOf(borrower), 6_000e6);

        vm.expectEmit(true, true, false, true, address(vault));
        emit IDefralVault.Rescued(borrower, 1, 758_620_690, 12667, 14500, DIP_PRICE, 2, uint64(block.timestamp));

        vm.prank(agentExecutor);
        vault.guardRepay();

        assertEq(pool.debtOf(borrower), 5_241_379_310);
        assertEq(vault.healthRatioBps(), 14500);
    }

    function test_refuseWhenHealthy() public {
        DefralVault vault = _seedDemoPosition(); // 16667 bps, well above 13000 trigger

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.Refused_Healthy.selector, uint16(16667), uint16(13000)));
        vm.prank(agentExecutor);
        vault.guardRepay();
    }

    function test_refuseStaleOracle() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        uint256 updatedAt = block.timestamp;
        vm.warp(block.timestamp + vault.MAX_STALE() + 1);

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.Refused_StaleOracle.selector, updatedAt, vault.MAX_STALE()));
        vm.prank(agentExecutor);
        vault.guardRepay();
    }

    function test_refuseSameRound() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        vm.prank(agentExecutor);
        vault.guardRepay(); // succeeds, sets lastActedRound to the current oracle round

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.Refused_AlreadyActed.selector, uint80(2)));
        vm.prank(agentExecutor);
        vault.guardRepay(); // same round, no new observation — must refuse
    }

    function test_refuseAfterRevoke() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        DefralVault vault = _seed(s);

        vm.prank(borrower);
        vault.revokeAgent();

        vm.expectRevert(IDefralVault.Refused_AgentRevoked.selector);
        vm.prank(agentExecutor);
        vault.guardRepay();
    }

    function test_cappedByMaxRepay() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE; // needed = 758.62..., well above the cap below
        s.maxRepayPerEvent = 100e6;
        DefralVault vault = _seed(s);

        vm.prank(agentExecutor);
        vault.guardRepay();

        assertEq(pool.debtOf(borrower), 6_000e6 - 100e6);
    }

    function test_cappedByReserve() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        s.reserve = 50e6; // far below the 758.62 needed, and below maxRepayPerEvent
        DefralVault vault = _seed(s);

        vm.prank(agentExecutor);
        vault.guardRepay();

        assertEq(pool.debtOf(borrower), 6_000e6 - 50e6);
    }

    function test_refuseNoReserve() public {
        Seed memory s = _defaultSeed();
        s.price = DIP_PRICE;
        s.reserve = 0;
        DefralVault vault = _seed(s);

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.Refused_NoReserve.selector, uint256(0)));
        vm.prank(agentExecutor);
        vault.guardRepay();
    }

    function test_refuseNotAgent() public {
        DefralVault vault = _seedDemoPosition();

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.NotAgent.selector, stranger));
        vm.prank(stranger);
        vault.guardRepay();
    }

    function test_reserveIsMinOfBalanceAndAllowance() public {
        DefralVault vault = _seedDemoPosition();
        // balance = debt (6,000) + reserve (5,000) = 11,000; allowance = 5,000 -> reserve = 5,000
        assertEq(vault.reserve(), 5_000e6);

        vm.prank(borrower);
        dUSD.approve(address(vault), 1_000e6); // shrink allowance below balance
        assertEq(vault.reserve(), 1_000e6);
    }
}
