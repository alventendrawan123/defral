// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {DefralVault} from "./DefralVault.sol";
import {IDefralPool} from "./interfaces/IDefralPool.sol";

/// @notice Deploys one DefralVault per borrower. This is WHY guardRepay()/sweepCoupon() can be
///         zero-argument (plan.md D2, §4.2): each vault already knows its one borrower, one
///         agent, one collateral, one oracle — nothing needs to be passed in at call time.
contract DefralVaultFactory {
    error VaultAlreadyExists(address borrower, address existingVault);
    error NotBorrower(address caller);
    error CollateralNotRegistered(address collateralToken);
    error OracleMismatch(address expected, address supplied);

    event VaultDeployed(address indexed borrower, address indexed vault, address indexed collateralToken);

    mapping(address => address) public vaultOf;

    IERC20 public immutable dUSD;
    IDefralPool public immutable pool;

    constructor(IERC20 dUSD_, IDefralPool pool_) {
        dUSD = dUSD_;
        pool = pool_;
    }

    /// @notice Deploys `msg.sender`'s own vault. One per address, forever — there is no
    ///         redeploy or replace path, matching "one vault per borrower" as a fact about
    ///         the system, not a convention callers are trusted to follow.
    /// @dev    SIAPA: only the borrower being onboarded, for themselves — `msg.sender ==
    ///         borrower` is enforced so nobody can stand up a vault a victim never asked for
    ///         and never approved (it would sit inert regardless, since reserve() reads the
    ///         victim's own allowance, but there is no reason to allow it).
    function deployVault(
        address agentExecutor,
        IERC20 collateralToken,
        AggregatorV3Interface oracle,
        uint16 triggerBps,
        uint16 targetBps,
        uint256 maxRepayPerEvent,
        bool couponSweep
    ) external returns (address vault) {
        address existing = vaultOf[msg.sender];
        if (existing != address(0)) revert VaultAlreadyExists(msg.sender, existing);

        // ONE position, ONE price. The vault pins `oracle` as an immutable and the pool resolves
        // price per collateral; if a caller could supply any feed here, the two would answer
        // differently for the same position — guardRepay() acting on one number while
        // liquidate() reads another. Requirement D2 says a position has one health ratio, so the
        // supplied oracle must be exactly the feed this pool already prices that collateral with.
        // The pool's feed is write-once, so this equality holds for the life of the vault.
        address poolFeed = pool.priceFeedOf(address(collateralToken));
        if (poolFeed == address(0)) revert CollateralNotRegistered(address(collateralToken));
        if (address(oracle) != poolFeed) revert OracleMismatch(poolFeed, address(oracle));

        vault = address(
            new DefralVault(
                msg.sender,
                agentExecutor,
                dUSD,
                collateralToken,
                oracle,
                pool,
                triggerBps,
                targetBps,
                maxRepayPerEvent,
                couponSweep
            )
        );
        vaultOf[msg.sender] = vault;
        emit VaultDeployed(msg.sender, vault, address(collateralToken));
    }
}
