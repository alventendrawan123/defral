// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo stablecoin borrowers hold as reserve and owe as debt. 6 decimals (USDC-style).
/// @dev    mint() is PUBLIC on purpose (plan.md §4.5) — the demo must never be blocked on a
///         testnet faucet's rate limit. This mock is explicitly NOT mainnet-ready (plan.md §9.10);
///         mainnet swaps this constructor for real USDC, nothing in DefralVault changes.
contract MockUSD is ERC20 {
    constructor() ERC20("Defral Mock USD", "dUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
