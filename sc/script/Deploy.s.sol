// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Probe} from "../src/Probe.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockTreasury} from "../src/MockTreasury.sol";
import {NavOracle} from "../src/NavOracle.sol";
import {MockLendingPool} from "../src/MockLendingPool.sol";
import {DefralVaultFactory} from "../src/DefralVaultFactory.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploy script for plan.md TASK 0 (§2) and §6 Selasa. `run()` is the core system
///         deploy — Probe + every contract + factory, everything islakun/bima need to build
///         against a real address. Demo position setup is two follow-up entrypoints
///         (`openDemoPosition`, `deployDemoVault`), split apart because each needs its own
///         deployer/borrower broadcast sequence (see plan.md K7/§0.0 on separate keys).
///
///         Usage:
///           forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify -vvvv
///
///         Requires .env (see .env.example): PRIVATE_KEY, PUBLISHER_KEY, AGENT_EXECUTOR.
///         🔴 PRIVATE_KEY, PUBLISHER_KEY, and BORROWER_KEY must be three DIFFERENT keys —
///         plan.md §0.0: if publisher and agent share a key, the whole "the agent can't move
///         the price it acts on" argument collapses.
contract Deploy is Script {
    // ───────── demo parameters — plan.md §5, PRD Appendix B ─────────
    int256 internal constant PAR_PRICE = 1e8; // $1.00, 8dp (Chainlink convention)
    uint256 internal constant DEMO_COLLATERAL = 10_000e18; // 10,000 dUST
    uint256 internal constant DEMO_DEBT = 6_000e6; // 6,000 dUSD -> 16667 bps at par
    uint16 internal constant DEFAULT_TRIGGER_BPS = 13_000;
    uint16 internal constant DEFAULT_TARGET_BPS = 14_500;
    uint256 internal constant DEFAULT_MAX_REPAY = 2_000e6;
    uint256 internal constant DEMO_RESERVE = 3_000e6; // borrower's approved defence reserve

    /// @notice Core system deploy. No demo positions opened here — see `openDemoPositions`.
    function run()
        external
        returns (
            Probe probe,
            MockUSD dUSD,
            MockTreasury dUST,
            MockTreasury mXAU,
            NavOracle oracleDUST,
            NavOracle oracleMXAU,
            MockLendingPool pool,
            DefralVaultFactory factory
        )
    {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address publisher = vm.addr(vm.envUint("PUBLISHER_KEY"));
        address agentExecutor = vm.envAddress("AGENT_EXECUTOR");

        vm.startBroadcast(deployerKey);

        probe = new Probe();

        dUSD = new MockUSD();
        dUST = new MockTreasury("Defral Mock Treasury", "dUST");
        mXAU = new MockTreasury("Defral Mock Gold", "mXAU");

        oracleDUST = new NavOracle(publisher, PAR_PRICE);
        oracleMXAU = new NavOracle(publisher, PAR_PRICE);

        pool = new MockLendingPool(deployer, dUSD);
        pool.allowCollateral(address(dUST), "dUST", 18, true); // yield-bearing
        pool.allowCollateral(address(mXAU), "mXAU", 18, false); // non-yield
        pool.setPriceFeed(address(dUST), address(oracleDUST));
        pool.setPriceFeed(address(mXAU), address(oracleMXAU));

        factory = new DefralVaultFactory(dUSD, pool);

        vm.stopBroadcast();

        console2.log("Probe:", address(probe));
        console2.log("dUSD:", address(dUSD));
        console2.log("dUST:", address(dUST));
        console2.log("mXAU:", address(mXAU));
        console2.log("NavOracle dUST:", address(oracleDUST));
        console2.log("NavOracle mXAU:", address(oracleMXAU));
        console2.log("MockLendingPool:", address(pool));
        console2.log("DefralVaultFactory:", address(factory));
        console2.log("agentExecutor (kh wallet info --json):", agentExecutor);
    }

    /// @notice Step 1: mints demo collateral to the borrower and opens the pool position
    ///         (10,000 dUST @ $1.00, 6,000 dUSD debt -> 16667 bps). Run after `run()`:
    ///
    ///           forge script script/Deploy.s.sol:Deploy \
    ///             --sig "openDemoPosition(address,address)" <dUST> <pool> \
    ///             --rpc-url base_sepolia --broadcast -vvvv
    function openDemoPosition(address dUST_, address pool_) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 borrowerKey = vm.envUint("BORROWER_KEY");
        address borrower = vm.addr(borrowerKey);

        vm.startBroadcast(deployerKey);
        MockTreasury(dUST_).mint(borrower, DEMO_COLLATERAL);
        vm.stopBroadcast();

        vm.startBroadcast(borrowerKey);
        MockTreasury(dUST_).approve(pool_, DEMO_COLLATERAL);
        vm.stopBroadcast();

        vm.startBroadcast(deployerKey);
        MockLendingPool(pool_).openPosition(borrower, dUST_, DEMO_COLLATERAL, DEMO_DEBT);
        vm.stopBroadcast();
    }

    /// @notice Step 2: deploys the borrower's vault, registers it as an authorized repayer,
    ///         approves its defence reserve ("Set cadangan", plan.md §11 step 2), and declares
    ///         the first quarterly coupon so sweepCoupon() has something to spend. Run after
    ///         `openDemoPosition`:
    ///
    ///           forge script script/Deploy.s.sol:Deploy \
    ///             --sig "deployDemoVault(address,address,address,address)" <dUSD> <dUST> <pool> <factory> \
    ///             --rpc-url base_sepolia --broadcast -vvvv
    function deployDemoVault(address dUSD_, address dUST_, address pool_, address factory_)
        external
        returns (address vault)
    {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 borrowerKey = vm.envUint("BORROWER_KEY");
        address borrower = vm.addr(borrowerKey);
        address agentExecutor = vm.envAddress("AGENT_EXECUTOR");
        // Read the feed the pool already prices dUST with — the factory now REQUIRES the vault's
        // oracle to equal it exactly, so a position can never have two disagreeing health ratios.
        address oracle = MockLendingPool(pool_).collateralInfo(dUST_).priceFeed;

        vm.startBroadcast(borrowerKey);
        vault = DefralVaultFactory(factory_)
            .deployVault(
                agentExecutor,
                IERC20(dUST_),
                AggregatorV3Interface(oracle),
                DEFAULT_TRIGGER_BPS,
                DEFAULT_TARGET_BPS,
                DEFAULT_MAX_REPAY,
                true
            );
        vm.stopBroadcast();

        // registerRepayer is onlyOwner (the deployer), not onlyBorrower — separate broadcast.
        vm.startBroadcast(deployerKey);
        MockLendingPool(pool_).registerRepayer(vault);
        vm.stopBroadcast();

        vm.startBroadcast(borrowerKey);
        // The defence reserve NEVER leaves this wallet — this approval IS the mechanism,
        // there is no topUp()/deposit() to call instead (plan.md B2).
        MockUSD(dUSD_).approve(vault, DEMO_RESERVE);
        vm.stopBroadcast();

        // Issuer declares the first quarter's coupon (112.50 dUSD on the demo numbers) and
        // mints the tokens that back it. Coupon is accrued STATE, not a formula — without this
        // sweepCoupon() has nothing to spend and correctly refuses with Refused_NoCouponDue.
        vm.startBroadcast(deployerKey);
        uint256 coupon = MockLendingPool(pool_).accrueQuarterlyCoupon(borrower);
        vm.stopBroadcast();

        console2.log("Demo vault:", vault);
        console2.log("Coupon accrued (6dp):", coupon);
    }
}
