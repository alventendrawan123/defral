// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockTreasury} from "../src/MockTreasury.sol";
import {NavOracle} from "../src/NavOracle.sol";
import {MockLendingPool} from "../src/MockLendingPool.sol";
import {DefralVaultFactory} from "../src/DefralVaultFactory.sol";
import {DefralVault} from "../src/DefralVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @notice Shared world for every test file: actors, tokens, oracles, pool, factory — plus
///         the `_seed` helper (plan.md §9.8) so each test is "3 lines: seed, act, assert"
///         instead of re-deriving the whole system per scenario.
abstract contract DefralTestBase is Test {
    address internal publisher = makeAddr("publisher");
    address internal borrower = makeAddr("borrower");
    address internal agentExecutor = makeAddr("agentExecutor");
    address internal liquidator = makeAddr("liquidator");
    address internal stranger = makeAddr("stranger");

    MockUSD internal dUSD;
    MockTreasury internal dUST; // yield-bearing collateral
    MockTreasury internal mXAU; // non-yield collateral
    NavOracle internal oracle; // dUST price feed
    NavOracle internal goldOracle; // mXAU price feed
    MockLendingPool internal pool;
    DefralVaultFactory internal factory;

    uint16 internal constant TRIGGER_BPS = 13_000;
    uint16 internal constant TARGET_BPS = 14_500;
    uint256 internal constant MAX_REPAY = 2_000e6;

    // Demo numbers, plan.md §5 / PRD Appendix B: 10,000 dUST @ $1.00, 6,000 dUSD debt.
    int256 internal constant PAR_PRICE = 1e8;
    int256 internal constant DIP_PRICE = 76_000_000; // $0.76 -> 12667 bps
    uint256 internal constant DEMO_COLLATERAL = 10_000e18;
    uint256 internal constant DEMO_DEBT = 6_000e6;

    struct Seed {
        int256 price;
        uint256 collateral;
        uint256 debt;
        uint256 reserve;
        uint16 triggerBps;
        uint16 targetBps;
        uint256 maxRepayPerEvent;
        bool couponSweep;
    }

    function setUp() public virtual {
        dUSD = new MockUSD();
        dUST = new MockTreasury("Defral Mock Treasury", "dUST");
        mXAU = new MockTreasury("Defral Mock Gold", "mXAU");

        oracle = new NavOracle(publisher, PAR_PRICE);
        goldOracle = new NavOracle(publisher, PAR_PRICE);

        pool = new MockLendingPool(address(this), dUSD);
        pool.allowCollateral(address(dUST), "dUST", 18, true);
        pool.allowCollateral(address(mXAU), "mXAU", 18, false);
        pool.setPriceFeed(address(dUST), address(oracle));
        pool.setPriceFeed(address(mXAU), address(goldOracle));

        factory = new DefralVaultFactory(dUSD, pool);
    }

    function _defaultSeed() internal pure returns (Seed memory) {
        return Seed({
            price: PAR_PRICE,
            collateral: DEMO_COLLATERAL,
            debt: DEMO_DEBT,
            reserve: 5_000e6,
            triggerBps: TRIGGER_BPS,
            targetBps: TARGET_BPS,
            maxRepayPerEvent: MAX_REPAY,
            couponSweep: true
        });
    }

    /// @notice Opens a dUST-collateralized position for `borrower`, deploys+wires its vault,
    ///         and funds the reserve — everything a test needs before it can act as the agent.
    function _seed(Seed memory s) internal returns (DefralVault vault) {
        dUST.mint(borrower, s.collateral);
        vm.prank(borrower);
        dUST.approve(address(pool), s.collateral);
        pool.openPosition(borrower, address(dUST), s.collateral, s.debt);

        vm.prank(borrower);
        address v = factory.deployVault(
            agentExecutor,
            IERC20(address(dUST)),
            AggregatorV3Interface(address(oracle)),
            s.triggerBps,
            s.targetBps,
            s.maxRepayPerEvent,
            s.couponSweep
        );
        vault = DefralVault(v);
        pool.registerRepayer(v);

        // Minted on top of the loan principal so balanceOf never binds — only allowance does,
        // unless a test deliberately wants the balance itself to be the constraint.
        dUSD.mint(borrower, s.reserve);
        vm.prank(borrower);
        dUSD.approve(v, s.reserve);

        // One quarter's coupon, declared by the issuer and backed by real tokens in the pool.
        // Coupon is ACCRUED STATE, not a formula, so a sweep is bounded by what was declared —
        // tests that expect couponDue() == 112.50 need this to have happened first.
        pool.accrueQuarterlyCoupon(borrower);

        if (s.price != PAR_PRICE) {
            vm.prank(publisher);
            oracle.setPrice(s.price);
        }
    }

    function _seedDemoPosition() internal returns (DefralVault vault) {
        return _seed(_defaultSeed());
    }
}
