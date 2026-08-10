// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice PROBE 0-2 harness: confirms msg.sender under KeeperHub gas sponsorship,
///         confirms reverted txs still broadcast with a hash, before any real logic exists.
contract Probe {
    uint256 public v;
    address public lastCaller;

    function value() external view returns (uint256) {
        return v;
    }

    function bump() external {
        v++;
        lastCaller = msg.sender;
    }

    function boom() external pure {
        revert("PROBE: boom");
    }
}
