// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Generic mintable ERC20 used for BOTH demo collateral instruments: dUST (tokenized
///         Treasury, yield-bearing) and mXAU (tokenized gold, non-yield). One contract, two
///         deployments — proof that `allowCollateral` protects any instrument with the same
///         engine (plan.md K3), not that the token itself is special.
/// @dev    18 decimals for both deployments — keeps DefralMath's fixed-decimal assumption
///         valid across every registered collateral without a second decimal-conversion path
///         that no scenario in plan.md §5 actually exercises. mint() is PUBLIC (plan.md §4.5).
contract MockTreasury is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
