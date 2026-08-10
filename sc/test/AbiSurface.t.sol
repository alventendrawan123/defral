// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DefralTestBase} from "./Base.t.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {IDefralVault} from "../src/interfaces/IDefralVault.sol";

/// @notice Proves the PERMUKAAN of agent authority, not its behavior (plan.md §9.8).
///
///         Half of this is already compiler-enforced and not worth re-testing at runtime:
///         `DefralVault is IDefralVault`, and the frozen interface declares
///         `guardRepay()` / `sweepCoupon()` with zero parameters — Solidity will not compile
///         an override with a different arity, full stop.
///
///         What the compiler does NOT stop a contract from doing is defining an EXTRA
///         function beyond its interface — e.g. some `guardRepay(address)` sibling that
///         nobody asked for. That is the actual regression surface this test guards:
///         calling every plausible parametrized sibling of the two agent functions, as the
///         agent, and confirming none of them exist (Solidity's default dispatcher reverts
///         with EMPTY returndata when no function or fallback matches a selector — a REAL
///         function, even one that itself reverts, always returns non-empty custom-error data).
contract AbiSurfaceTest is DefralTestBase {
    function test_abiSurface_onlyTwoAgentFunctionsExist_bothZeroArgument() public {
        DefralVault vault = _seedDemoPosition();

        // The real surface exists and is gated — proves guardRepay()/sweepCoupon() are there.
        vm.expectRevert(abi.encodeWithSelector(IDefralVault.NotAgent.selector, stranger));
        vm.prank(stranger);
        vault.guardRepay();

        vm.expectRevert(abi.encodeWithSelector(IDefralVault.NotAgent.selector, stranger));
        vm.prank(stranger);
        vault.sweepCoupon();

        // No parametrized sibling of either function exists, at any arity we can think to check.
        _assertSelectorDoesNotExist(address(vault), "guardRepay(address)", agentExecutor);
        _assertSelectorDoesNotExist(address(vault), "guardRepay(uint256)", agentExecutor);
        _assertSelectorDoesNotExist(address(vault), "guardRepay(address,uint256)", agentExecutor);
        _assertSelectorDoesNotExist(address(vault), "sweepCoupon(address)", agentExecutor);
        _assertSelectorDoesNotExist(address(vault), "sweepCoupon(uint256)", agentExecutor);
        _assertSelectorDoesNotExist(address(vault), "sweepCoupon(address,uint256)", agentExecutor);
    }

    /// @notice Fuzzed version of the same check: whatever address/uint256 an attacker might
    ///         try to smuggle in, calling the parametrized sibling selector still hits "no
    ///         such function" — the arguments are never even decoded because the function
    ///         they'd belong to does not exist.
    function testFuzz_abiSurface_noParametrizedAgentFunctionAcceptsFuzzedArgs(address a, uint256 n) public {
        DefralVault vault = _seedDemoPosition();

        bytes4[4] memory forbidden = [
            bytes4(keccak256("guardRepay(address)")),
            bytes4(keccak256("guardRepay(uint256)")),
            bytes4(keccak256("sweepCoupon(address)")),
            bytes4(keccak256("sweepCoupon(uint256)"))
        ];

        for (uint256 i = 0; i < forbidden.length; i++) {
            bytes memory data = i % 2 == 0
                ? abi.encodePacked(forbidden[i], abi.encode(a))
                : abi.encodePacked(forbidden[i], abi.encode(n));

            vm.prank(agentExecutor);
            (bool ok, bytes memory ret) = address(vault).call(data);

            assertFalse(ok, "a parametrized agent-function sibling unexpectedly exists");
            assertEq(ret.length, 0, "revert carried data -> a real function exists at this selector");
        }
    }

    function _assertSelectorDoesNotExist(address target, string memory signature, address caller) internal {
        bytes4 selector = bytes4(keccak256(bytes(signature)));
        bytes memory data = abi.encodePacked(selector, abi.encode(uint256(0)));

        vm.prank(caller);
        (bool ok, bytes memory ret) = target.call(data);

        assertFalse(ok, string.concat(signature, " unexpectedly callable"));
        assertEq(ret.length, 0, string.concat(signature, " reverted WITH data -> it actually exists"));
    }
}
