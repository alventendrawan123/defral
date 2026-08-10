// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @notice Mock NAV price feed, shaped exactly like AggregatorV3Interface so the mainnet
///         path is "swap one constructor address for a real Chainlink feed" (plan.md §9.10, §15.5).
/// @dev    SIAPA BOLEH DORONG HARGA: only `publisher` — a key that must stay separate from
///         `agentExecutor` (plan.md §0.0). If they were the same key, "the agent can't move
///         the price it acts on" collapses and the whole defence-window argument with it.
contract NavOracle is AggregatorV3Interface {
    error NotPublisher(address caller);
    error InvalidPrice(int256 price);
    error OnlyLatestRoundAvailable(uint80 requested, uint80 latest);

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);
    event PublisherTransferred(address indexed previousPublisher, address indexed newPublisher);

    /// Chainlink convention: 8 decimals. Baked into DefralMath's fixed-decimal assumption.
    uint8 public constant override decimals = 8;
    string public constant override description = "Defral Mock NAV Oracle";
    uint256 public constant override version = 1;

    address public publisher;

    /// roundId is the ONLY replay-protection anchor DefralVault.guardRepay() relies on
    /// (plan.md G5) — it MUST strictly increase on every push, never reused, never reset.
    uint80 public roundId;
    int256 public answer;
    uint256 public updatedAt;

    modifier onlyPublisher() {
        if (msg.sender != publisher) revert NotPublisher(msg.sender);
        _;
    }

    constructor(address publisher_, int256 initialPrice) {
        publisher = publisher_;
        _push(initialPrice);
    }

    /// @notice Publisher pushes a new price observation.
    /// @dev    SIAPA: only `publisher`. KENAPA BOLEH: it is the sole key this contract trusts
    ///         to move price, set once at deploy and rotatable only by itself.
    ///         YANG SENGAJA TIDAK BISA: `agentExecutor` cannot call this — there is no path
    ///         from the agent's two functions into this one.
    function setPrice(int256 newPrice) external onlyPublisher {
        _push(newPrice);
    }

    function transferPublisher(address newPublisher) external onlyPublisher {
        emit PublisherTransferred(publisher, newPublisher);
        publisher = newPublisher;
    }

    function _push(int256 newPrice) internal {
        if (newPrice <= 0) revert InvalidPrice(newPrice);
        roundId++; // MONOTON — EVM successor to Canton's consuming-choice cid churn (plan.md K10)
        answer = newPrice;
        updatedAt = block.timestamp;
        emit AnswerUpdated(newPrice, roundId, block.timestamp);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId_, int256 answer_, uint256 startedAt_, uint256 updatedAt_, uint80 answeredInRound_)
    {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (uint80 roundId_, int256 answer_, uint256 startedAt_, uint256 updatedAt_, uint80 answeredInRound_)
    {
        // Mock only retains the latest observation — no historical round storage.
        if (_roundId != roundId) revert OnlyLatestRoundAvailable(_roundId, roundId);
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
