# SC — Plan Smart Contract (alven)

**Defral · KeeperHub Agents Onchain Hackathon · deadline 2026-08-13 17:00 WIB**
**Chain: Base Sepolia `84532` · Foundry · Solidity ^0.8.24**

> Dokumen ini ditulis supaya bisa dieksekusi langsung bareng Claude. Tiap task punya acceptance criteria yang bisa dicek. Kalau agent lo nanya "ini maunya gimana", jawabannya ada di sini.

---

## 0. Kenapa kontrak ini ada

Agent otonom yang mindahin duit punya satu masalah universal: **kalau kunci agent bocor, apa yang bisa dia lakukan?**

Lapangan hackathon ini (14 tim liquidation guardian) jawab "apa aja" — agent pegang `approve(bot, MAX)` dan ngitung keputusan off-chain, jadi **agent itu sendiri satu-satunya pemeriksa keselamatan**.

**Defral mindahin pemeriksaan ke dalam callee.** KeeperHub Turnkey EOA cuma punya **dua fungsi zero-argument**, dan dua-duanya baca ulang oracle + posisi lalu **revert kalau posisi sehat**.

> **Kalimat yang harus benar setelah lo selesai:**
> *"Tidak ada satu pun fungsi `onlyAgent` di `DefralVault` yang menerima parameter `address` atau `uint256`. Vault tidak pernah memegang dana reserve. Juri memverifikasinya dengan satu grep."*

Kalau ada perubahan desain yang bikin kalimat itu jadi salah — **jangan lakukan**, atau umumkan di grup dulu.

---


---

## 0.5 Requirement yang lo tutup

PRD (`../PRD-defral.md`) menjawab **APA** dan **KENAPA**. Dokumen ini menjawab **GIMANA**.

> **Kalau keduanya bertentangan:** `plan.md` menang untuk **signature dan endpoint**; PRD menang untuk **perilaku dan batasan**. Kalau lo nemu pertentangan, lapor ke grup — bukan pilih sendiri.

Tiap requirement di bawah punya acceptance criteria di **PRD §10**. Kolom **Gap** menunjuk ke temuan audit implementasi pendahulu di **PRD §6** yang requirement itu tutup.

| Req | Yang harus benar | Gap | Di plan ini |
|---|---|---|---|
| **A1** | Agent punya **tepat dua** fungsi, keduanya nol argumen | — | §3, §5 `test_abiSurface` |
| **A2** | `guardRepay()` revert saat rasio ≥ trigger | G11 | §4.1 |
| **A3** | `guardRepay()` revert saat oracle basi | — | §4.1 |
| **A4** | `guardRepay()` revert pada observasi harga yang sudah ditindak | G5 | §4.1 `lastActedRound` |
| **A5** | Borrower bisa mencabut agent sepihak, kapan saja | — | §3 `revokeAgent` |
| **A6** | Nol proxy, nol `delegatecall`, nol upgrade, nol `owner` | — | §4.1 |
| **B1** | Vault **tidak punya** `withdraw()` maupun `topUp()` | G3 | §3, §5 |
| **B2** | Cadangan = `min(balanceOf, allowance)`, transfer langsung borrower→pool | G3 | §4.1 |
| **C1** | `liquidate()` bisa dipanggil **siapa pun** saat rasio < 11000 | G1 | §4.4 |
| **C2** | Likuidasi **benar-benar memindahkan** jaminan + bonus 500 bps | G1 | §4.4 |
| **C3** | Jaminan **di-escrow**; tidak bisa ditarik selagi utang hidup | G2 | §4.4 |
| **C4** | Grace **menunda** likuidasi, health tetap gerbang primer | G1 | §4.4, K7 |
| **D1** | Jumlah bayar dihitung **callee**: `min(kebutuhan, cap, cadangan)` | G4 | §4.1 |
| **D2** | Angka **identik** dengan agent dan UI | — | §5, K2 |
| **D3** | `setPolicy` hidup, dibatasi 12000-15000 bps | G7 | §3, K6 |
| **D4** | `sweepCoupon()` **tanpa** gerbang health | G4 | §4.1 |
| **D5** | Jaminan non-yield → no-op, **bukan abort** | G8 | K4 |
| **D6** | Sweep ter-cap `min(couponDue, debt)` | G9 | K5 |
| **D7** | `allowCollateral(token, yieldBearing)`, **dua** jaminan terdaftar | G10 | K3 |
| **E6** | Empat tipe trigger dipakai, masing-masing beralasan domain | — | §6 Sel/Rab |

> 🔴 **Sebelum mulai: baca section ATURAN DESAIN YANG MENGIKAT** (paling bawah). Isinya keputusan yang sudah dikunci dari audit, dan melanggarnya berarti mengulang bug yang sudah kami temukan.

**Yang tidak ada di tabel ini bukan pekerjaan lo.** Kalau agent lo mulai ngerjain sesuatu yang tidak menutup satu pun baris di atas, hentikan.


## 1. Keputusan yang sudah dikunci

| # | Keputusan | Kenapa |
|---|---|---|
| D1 | **Non-custodial.** Vault **tidak pernah** memegang dUSD reserve | Reserve = `min(dUSD.balanceOf(borrower), dUSD.allowance(borrower, vault))`. Nol `topUp()`, nol `withdraw()` |
| D2 | **Satu vault per borrower**, di-deploy `DefralVaultFactory` | Vault gak nyimpen apa-apa → deploy per-borrower murah. Ini yang bikin `guardRepay()` **zero-argument**, dan zero-arg yang bikin `check-and-execute` bisa dipakai |
| D3 | **Collateral DI-ESCROW** di `MockLendingPool` | Itu memang arti pledge. Beda dengan reserve — dan bedanya adalah cerita produknya |
| D4 | Defence = **REPAY**, bukan top-up collateral | Terverifikasi dari implementasi pendahulu: `TopUpCollateral` controller-nya **borrower**, agent gak bisa manggil. Dan `/api/execute/swap` KeeperHub adalah **stub 501** |
| D5 | **`liquidate()` ADA dan bisa dipanggil siapa pun** | Implementasi Canton sebelumnya **tidak pernah** menyita collateral (`LastResortDefault` badannya `pure ()`). Di EVM kita bisa, dan itu bikin taruhannya bisa diklik |
| D6 | Oracle **berbentuk `AggregatorV3Interface`** | `roundId` monoton = penerus EVM dari consuming choice Canton. Jalur mainnet nanti = ganti satu alamat |

---

## 2. 🔴 TASK 0 — 3 JAM PERTAMA. Ini nge-gate seluruh tim.

islakun dan bima **tidak bisa mulai integrasi nyata** sampai lo selesai task ini. Kerjakan **berurutan**, jangan diacak.

### 0.0 Bootstrap Foundry (15 menit) — sebelum apa pun

```bash
# install foundry kalau belum
curl -L https://foundry.paradigm.xyz | bash && foundryup

cd D:\defral\SC
forge init . --no-git --force        # --no-git: repo defral sudah ada
forge install OpenZeppelin/openzeppelin-contracts
forge install smartcontractkit/chainlink-brownie-contracts   # AggregatorV3Interface
```

`SC/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false

[rpc_endpoints]
base_sepolia = "https://sepolia.base.org"

[etherscan]
base_sepolia = { key = "${ETHERSCAN_API_KEY}", chain = 84532 }
```

`SC/.env` — **jangan pernah di-commit**, sudah masuk `.gitignore`:
```
PRIVATE_KEY=0x...            # kunci deployer
PUBLISHER_KEY=0x...          # 🔴 TERPISAH — kunci oracle. Agent tidak boleh punya ini
BORROWER_KEY=0x...           # 🔴 TERPISAH — kunci borrower demo
ETHERSCAN_API_KEY=...
KEEPERHUB_API_KEY=kh_...
AGENT_EXECUTOR=0x...         # dari GET /api/user/wallet -> walletAddress
```

> 🔴 **`AGENT_EXECUTOR` JANGAN diambil dari `kh wallet info --json`.** Perintah itu membaca
> subOrg berdiri sendiri yang tidak tersambung ke organisasi KeeperHub kita, dan alamatnya
> tidak pernah mengeksekusi apa pun. Sumber yang benar `GET /api/user/wallet` →
> `walletAddress`. Nilai ini di-bake sebagai `immutable agentExecutor` di setiap vault —
> salah isi berarti vault mati permanen. Kejadian beneran waktu setup; lihat
> `docs/KEEPERHUB-SETUP.md` §1.

> 🔴 **Tiga kunci itu WAJIB terpisah.** Itu yang bikin demo bukan sandiwara, dan itu jawaban pertama kita untuk pertanyaan juri paling mematikan (PRD §17). Kalau publisher dan agent pakai kunci yang sama, seluruh argumen runtuh.

**Layout:**
```
SC/
├── src/
│   ├── interfaces/IDefralVault.sol   ← §3, BEKU
│   ├── DefralVault.sol · DefralVaultFactory.sol
│   ├── NavOracle.sol · MockLendingPool.sol
│   ├── MockUSD.sol · MockTreasury.sol
│   └── Probe.sol                     ← §0.2, deploy DULUAN
├── test/  · script/  · foundry.toml
```

**Perintah yang dipakai berulang:**
```bash
forge build && forge test -vv
forge test --match-test test_abiSurface -vvvv

# deploy
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia --broadcast --verify -vvvv

# verify manual kalau --verify gagal (SERING, jangan panik)
forge verify-contract <ADDR> src/DefralVault.sol:DefralVault \
  --chain 84532 --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
     $BORROWER $AGENT_EXECUTOR $DUSD $ORACLE)

# fallback Blockscout kalau Basescan rewel
forge verify-contract <ADDR> src/DefralVault.sol:DefralVault \
  --chain 84532 --verifier blockscout \
  --verifier-url https://base-sepolia.blockscout.com/api

# baca chain
cast call <ADDR> "healthRatioBps()(uint16)" --rpc-url base_sepolia
```

> **`forge verify-contract` non-opsional.** Seluruh argumen kita — *"juri bisa baca `require()` sendiri"* — bergantung pada source terverifikasi. Kalau `--verify` gagal saat deploy, verify manual **hari itu juga**, jangan ditunda.

---

### 0.1 Akses KeeperHub (20 menit)
```bash
# signup app.keeperhub.com, verifikasi email (Turnkey wallet auto-provisioned)
# Settings -> API Keys -> tab ORGANISATION -> Create New Key
# 🔴 SALIN kh_... SEKARANG — cuma ditampilkan sekali

curl -sf -H "Authorization: Bearer kh_..." https://app.keeperhub.com/api/keys

brew install keeperhub/tap/kh   # atau: go install github.com/keeperhub/cli/cmd/kh@latest
kh auth login
kh wallet info --json           # 🔴 CATAT alamat EOA enclave — ini jadi immutable agentExecutor
```

### 0.2 Deploy `Probe.sol` (15 menit)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Probe {
    uint256 public v;
    address public lastCaller;
    function value() external view returns (uint256) { return v; }
    function bump() external { v++; lastCaller = msg.sender; }
    function boom() external pure { revert("PROBE: boom"); }
}
```

### 0.3 🔴 PROBE 1 — `msg.sender` di bawah gas sponsorship (15 menit)

> **UPDATE: docs sekarang MENJAWAB ini, dan jawabannya mendukung desain kita.**
>
> Tabel mode signer di `/wallet-management/safe`:
>
> | Aspect | **EOA only** | Safe (Sender ON) |
> |---|---|---|
> | **`msg.sender` at the target contract** | **Turnkey EOA** | Safe |
> | ERC4337 gas sponsorship eligible | **Yes** | No |
>
> Relayer memang muncul sebagai pengirim tx **LUAR** di explorer — tapi wallet org **di-delegate** (*"remaining your wallet, under your address"*), jadi panggilan dalam dieksekusi dalam konteks alamat wallet. **`require(msg.sender == agentExecutor)` jalan.**
>
> Probe ini **tetap dijalankan** sebagai konfirmasi empiris. Turun dari kill-condition jadi verifikasi.

Kalau probe **membantah** docs, jangan panik dan jangan pakai allowlist relayer — relayer dipakai bersama semua org KeeperHub, jadi allowlist bikin klaim *"cuma agent kami"* bohong.

**Pakai fallback ini:** hapus `onlyAgent` dari `guardRepay()` dan `sweepCoupon()`, buat keduanya **permissionless**. Skenario terburuknya: penyerang memaksa pembayaran utang borrower, dari allowance borrower, saat posisi memang tidak sehat, dibatasi `maxRepayPerEvent`, hanya ke pool. Itu persis yang borrower minta.

Tesisnya justru menguat: **"kerugian tidak dijaga oleh SIAPA yang memanggil, melainkan oleh APA yang fungsinya sanggup ekspresikan."** Empat refusal receipt tetap hidup (`Healthy`, `StaleOracle`, `AlreadyActed`, `Revoked`); yang hilang cuma `NotAgent`.

### 0.4 🔴 PROBE 2 — apakah KeeperHub mem-broadcast tx yang bakal revert (15 menit)
```bash
# panggil boom() dengan simulate:false
# 🔴 CEK: response punya transactionHash?
```
Kalau **tidak** → 6 dari 7 tx demo lenyap, negative control runtuh jadi "percaya log kami". Lapor ke grup **sekarang**, jangan nanti.

### 0.5 PROBE 3 — `check-and-execute` pada view zero-arg (15 menit)
```bash
curl -s -X POST https://app.keeperhub.com/api/execute/check-and-execute \
  -H "Authorization: Bearer kh_..." -H "Content-Type: application/json" \
  -d '{"chainId":84532,"contractAddress":"<PROBE>","functionName":"value",
       "condition":{"operator":"gte","value":"0"},
       "action":{"contractAddress":"<PROBE>","functionName":"bump","functionArgs":"[]"}}' | jq
```
Gagal → fallback `contract-call`. **Downgrade, bukan kill.**

### 0.6 PROBE 4 — repro issue #1840 (15 menit)
Kirim `boom()` **2×** dengan `Idempotency-Key` identik. Tangkap `"idempotentReplay": true` di **body** response. **Simpan seluruh JSON — ini isi PR bounty.**

### 0.7 🔴🔴 FREEZE ABI + DEPLOY STUB (40 menit) — LANGKAH PALING PENTING

**Tulis `SC/src/interfaces/IDefralVault.sol` (§3), publish, deploy stub, serahkan alamat + ABI ke grup.**

Stub = signature lengkap, body trivial:
```solidity
function guardRepay() external { emit Rescued(borrower, 1, 0, 0, 0, 0, 0, uint64(block.timestamp)); }
function healthRatioBps() external pure returns (uint16) { return 16667; }
```

> **Setelah ini, nol orang di tim yang nganggur.** islakun bangun `KeeperHubLedger` ke ABI nyata, bima render ke alamat nyata. Lo isi logikanya sambil jalan.
>
> **Signature TIDAK BOLEH berubah setelah menit ini.** Kalau kepaksa, umumkan di grup **sebelum** commit.

**Post ke grup:**
```
✅ TX-0: <transactionLink>
✅ EOA enclave: 0x...
✅ PROBE 1: lastCaller == enclave? YA/TIDAK
✅ PROBE 2: revert tx punya hash? YA/TIDAK
✅ PROBE 3: check-and-execute zero-arg? YA/TIDAK
✅ PROBE 4: #1840 nyata? YA/TIDAK
🔒 ABI BEKU: SC/src/interfaces/IDefralVault.sol
📍 STUB: DefralVault=0x... Factory=0x... dUSD=0x... dUST=0x... Oracle=0x... Pool=0x...
```

---

## 3. Interface beku — `SC/src/interfaces/IDefralVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice SATU VAULT PER BORROWER. Vault ini TIDAK PERNAH memegang dana reserve.
///         Reserve = min(dUSD.balanceOf(borrower), dUSD.allowance(borrower, vault)).
///         Karena itu tidak ada topUp() dan tidak ada withdraw(): kami tidak pernah memegangnya.
interface IDefralVault {
    // ───────── struct ─────────
    struct Position {
        address borrower;
        uint256 outstanding;       // utang dUSD, 6 desimal
        uint256 collateralAmount;  // dUST di-escrow di pool, 18 desimal
        uint16  triggerBps;        // 13000
        uint16  targetBps;         // 14500
        uint256 maxRepayPerEvent;  // 2000e6
        bool    couponSweep;
        uint256 reserve;           // min(balanceOf, allowance) — TIDAK dipegang vault
        uint80  lastActedRound;
        bool    revoked;
    }

    // ───────── error (satu per alasan penolakan) ─────────
    error Refused_Healthy(uint16 healthBps, uint16 triggerBps);
    error Refused_StaleOracle(uint256 updatedAt, uint256 maxStale);
    error Refused_AlreadyActed(uint80 roundId);
    error Refused_NothingToRepay();
    error Refused_NoReserve(uint256 available);
    error Refused_CouponSweepOff();
    error Refused_NoCouponDue();
    error Refused_AgentRevoked();
    error NotAgent(address caller);
    error NotBorrower(address caller);

    // ───────── event ─────────
    /// @param kind 1 = RESCUE, 2 = COUPON.  uint8 ber-enum, JANGAN PERNAH free text.
    event Rescued(
        address indexed borrower,
        uint8   indexed kind,
        uint256 amount,
        uint16  healthBefore,
        uint16  healthAfter,
        int256  price,
        uint80  roundId,
        uint64  at
    );
    event PolicySet(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep);
    event AgentRevoked();

    // ───────── view — siapa pun ─────────
    function healthRatioBps()      external view returns (uint16);   // ZERO-ARG. Untuk check-and-execute.
    function reserve()             external view returns (uint256);  // min(balanceOf, allowance)
    function quoteGuardRepay()     external view returns (uint256);
    function amountToReachTarget() external view returns (uint256);
    function couponDue()           external view returns (uint256);
    function getPosition()         external view returns (Position memory);
    function agentExecutor()       external view returns (address);
    function borrower()            external view returns (address);

    // ───────── onlyBorrower ─────────
    function setPolicy(uint16 triggerBps, uint16 targetBps, uint256 maxRepayPerEvent, bool couponSweep) external;
    function revokeAgent() external;   // KILL SWITCH

    // ───────── onlyAgent — DUA FUNGSI. ITU SAJA. KEDUANYA ZERO-ARGUMENT. ─────────
    function guardRepay()  external;
    function sweepCoupon() external;
}
```

> **Aturan yang tidak boleh dilanggar:** nol fungsi `onlyAgent` yang menerima `address` atau `uint256`. Nol proxy. Nol `delegatecall`. Nol upgrade path. Nol `owner`. Nol fungsi yang bisa mengirim token ke alamat sembarang.

---

## 4. Kontrak yang harus ditulis

### 4.1 `DefralVault.sol` (~220 baris) — bintangnya

```solidity
contract DefralVault is IDefralVault {
    address public immutable borrower;
    address public immutable agentExecutor;   // dari `kh wallet info`
    IERC20  public immutable dUSD;
    IERC20  public immutable dUST;
    AggregatorV3Interface public immutable oracle;
    IDefralPool public immutable pool;

    uint256 public constant MAX_STALE = 1 hours;

    Policy  public policy;
    uint80  public lastActedRound;
    bool    public revoked;
    uint256 public couponAccrued;

    modifier onlyAgent()    { if (msg.sender != agentExecutor) revert NotAgent(msg.sender);
                              if (revoked) revert Refused_AgentRevoked(); _; }
    modifier onlyBorrower() { if (msg.sender != borrower) revert NotBorrower(msg.sender); _; }
```

**`healthRatioBps()` — transkripsi verbatim dari `Credit.daml:15-17`:**
```
healthRatioBps = round(collateralAmount * price * 10000 / outstanding)
```
⚠️ Daml pakai `round` (half away from zero), Solidity integer division **truncate**. Tambahkan `+ denom/2` sebelum bagi biar cocok dengan angka demo. **Test-nya harus meng-assert 16667 dan 12667 persis.**

**`amountToReachTarget()` — dari `Credit.daml:23-25`:**
```
needed = outstanding - (collateralAmount * price * 10000 / targetBps)
```

**`guardRepay()` — transkripsi `Guard.daml:116-159`, satu `require` untuk satu `assertMsg`:**
```solidity
function guardRepay() external onlyAgent {
    (uint80 roundId, int256 price,, uint256 updatedAt,) = oracle.latestRoundData();

    if (updatedAt + MAX_STALE < block.timestamp) revert Refused_StaleOracle(updatedAt, MAX_STALE);
    if (roundId == lastActedRound)               revert Refused_AlreadyActed(roundId);

    uint16 h0 = _healthBps(price);
    if (h0 >= policy.triggerBps) revert Refused_Healthy(h0, policy.triggerBps);   // ◀ THE GATE

    uint256 avail  = reserve();
    if (avail == 0) revert Refused_NoReserve(0);

    uint256 needed = _amountToTarget(price);
    uint256 amount = _min(needed, _min(policy.maxRepayPerEvent, avail));
    if (amount == 0) revert Refused_NothingToRepay();

    lastActedRound = roundId;                                   // effects SEBELUM interactions
    dUSD.transferFrom(borrower, address(pool), amount);         // non-custodial: dari wallet borrower
    pool.applyRepayment(borrower, amount);

    uint16 h1 = _healthBps(price);
    emit Rescued(borrower, 1, amount, h0, h1, price, roundId, uint64(block.timestamp));
}
```

**`sweepCoupon()` — dari `Coupon.daml:73-108`. ⚠️ SENGAJA NOL health gate** — komentar Daml-nya eksplisit: *"sweeping a coupon is a proactive paydown, not a breach response"*. Cuma cek `policy.couponSweep` dan `couponDue() > 0`.

**`reserve()` — inti non-custodial:**
```solidity
function reserve() public view returns (uint256) {
    uint256 bal = dUSD.balanceOf(borrower);
    uint256 all = dUSD.allowance(borrower, address(this));
    return bal < all ? bal : all;
}
```

### 4.2 `DefralVaultFactory.sol` (~50 baris)
`deployVault(address borrower, ...)` → vault baru. Simpan `mapping(address => address) vaultOf`. **Ini yang memungkinkan `guardRepay()` zero-argument.**

### 4.3 `NavOracle.sol` (~60 baris) — berbentuk AggregatorV3
```solidity
function setPrice(int256 newPrice) external onlyPublisher {
    roundId++;                                    // ◀ MONOTON — penerus consuming choice Canton
    answer = newPrice; updatedAt = block.timestamp;
    emit AnswerUpdated(newPrice, roundId, block.timestamp);
}
function latestRoundData() external view
    returns (uint80, int256, uint256, uint256, uint80);
```
⚠️ **Kunci `publisher` HARUS terpisah dari `agentExecutor`.** Ini yang bikin demo bukan self-dealt.

### 4.4 `MockLendingPool.sol` (~120 baris) — 🔴 ADA `liquidate()`

Ini nutup lubang yang ketahuan dari audit implementasi pendahulu: versi Canton **tidak pernah menyita apa pun** (`LastResortDefault` badannya `pure ()`).

```solidity
uint16 public constant LIQUIDATION_THRESHOLD = 11000;  // 110%
uint16 public constant LIQUIDATION_BONUS     = 500;    // 5% diskon buat liquidator

function openPosition(address borrower, uint256 collateralAmt, uint256 principal, ...) external;
function applyRepayment(address borrower, uint256 amount) external onlyAuthorizedRepayer;
function registerRepayer(address vault) external onlyOwner;   // pengganti EVM dari
                                                              // propagasi otoritas Daml

/// @notice SIAPA PUN bisa panggil. Ini yang ditunjukkan demo pada posisi yang TIDAK dijaga.
function liquidate(address borrower) external {
    uint16 h = healthRatioBps(borrower);
    if (h >= LIQUIDATION_THRESHOLD) revert NotLiquidatable(h);
    uint256 seized = /* collateral + bonus */;
    dUST.transfer(msg.sender, seized);            // ◀ collateral BENAR-BENAR pindah
    emit Liquidated(borrower, seized, h);
}
```

> **`registerRepayer` adalah pengganti EVM dari `Credit.daml:38-43`.** Di Daml, `ApplyRepayment` membawa otoritas pool karena borrower+pool ko-menandatangani `Loan` — *"the pool consented once."* Di EVM nol propagasi otoritas, jadi pool harus **meng-allowlist vault secara eksplisit**. Tulis ini di README: fidelitasnya **WEAKER**, dan kita bilang begitu.

### 4.5 `MockUSD.sol` + `MockTreasury.sol` (~90 baris)
`dUSD` 6 desimal, `dUST` 18 desimal. **`mint()` publik** — jangan bergantung rate limit faucet Circle.

---

## 5. Foundry test — `SC/test/`

Terjemahkan skenario dari logic Daml aslinya. **Lo tidak butuh repo lain** — inilah tiga potong logic yang harus ditranskripsi, disalin verbatim dari sumbernya:

```haskell
-- Credit.daml:15-17 — formula health ratio KANONIK. round = half away from zero.
healthRatioBps collateralAmount price outstanding =
  round (collateralAmount * price * 10000.0 / outstanding)

-- Credit.daml:23-25 — berapa yang harus dibayar buat balik ke target
amountToReachTarget collateralAmount price outstanding targetBps =
  outstanding - (collateralAmount * price * 10000.0 / intToDecimal targetBps)

-- Coupon.daml:12-14 — kupon kuartalan. 10000 face @ 450bps = 112.50
quarterlyCouponAmount faceValue couponRateBps =
  faceValue * intToDecimal couponRateBps / 10000.0 / 4.0

-- Guard.daml:116-159 — GuardRepay. INI YANG DITRANSKRIPSI, satu require per satu assertMsg.
choice GuardRepay : GuardRepayResult
  with priceFeedCid, loanCid, policyCid
  controller guardAgent
  do
    policy <- fetch policyCid ; loan <- fetch loanCid ; feed <- fetch priceFeedCid
    assertMsg "policy belongs to a different borrower"  (policy.borrower   == borrower)
    assertMsg "loan belongs to a different borrower"    (loan.borrower     == borrower)
    assertMsg "guard agent mismatch on policy"          (policy.guardAgent == guardAgent)
    assertMsg "guard agent mismatch on loan"            (loan.guardAgent   == guardAgent)
    assertMsg "price feed is for a different instrument"
      (feed.instrumentId == loan.collateralInstrumentId)

    let healthBefore = healthRatioBps loan.collateralAmount feed.price loan.outstanding
    -- ◀◀◀ THE NARROW GATE. Ini satu baris yang jadi seluruh tesis produk.
    assertMsg "Health Ratio is at/above the Guard Trigger; auto-repay refused"
      (healthBefore < policy.triggerRatioBps)

    let needed      = amountToReachTarget loan.collateralAmount feed.price
                                          loan.outstanding policy.targetRatioBps
    let repayAmount = min needed (min policy.maxRepayPerEvent balance)
    assertMsg "nothing to repay (vault empty or target already met)" (repayAmount > 0.0)

    newLoanCid <- exercise loanCid ApplyRepayment with repayAmount
    -- create RescueEvent + recreate vault dengan balance dikurangi

-- Guard.daml:167-199 — StartGracePeriod. NONCONSUMING. Assert yang sama, PLUS:
    assertMsg "vault balance is sufficient; run GuardRepay instead of opening grace"
      (balance < needed)
    -- graceWindow now = now + 72 jam

-- Coupon.daml:73-108 — SweepToLoan. ⚠️ SENGAJA NOL health gate.
    assertMsg "coupon sweep is not enabled on this policy" policy.couponSweep
    -- "sweeping a coupon is a proactive paydown, not a breach response"
    -- ⚠️ Versi Daml TIDAK meng-cap ini. Di EVM WAJIB di-cap: min(couponDue, debt). Lihat K5.
```

### Skenario test yang harus dicover (dari `GuardTests.daml`)

| Test | Assert |
|---|---|
| `test_healthAtPar` | harga 1.00 → **16667** bps persis |
| `test_healthAtDip` | harga 0.76 → **12667** bps persis |
| `test_rescueRestoresTarget` | repay **758.62**, outstanding **5241.38**, health **14500** |
| `test_refuseWhenHealthy` | `vm.expectRevert(Refused_Healthy.selector)` |
| `test_refuseStaleOracle` | `warp(MAX_STALE + 1)` → `Refused_StaleOracle` |
| `test_refuseSameRound` | 2× `guardRepay` pada roundId sama → `Refused_AlreadyActed` |
| `test_refuseAfterRevoke` | `revokeAgent()` → `Refused_AgentRevoked` |
| `test_cappedByMaxRepay` | repay ter-cap di 2000 |
| `test_cappedByReserve` | allowance kecil → repay ter-cap di allowance |
| `test_couponNoHealthGate` | `sweepCoupon()` **berhasil pada posisi sehat** |
| `test_couponAmount` | 10000 × 450bps ÷ 4 = **112.50** |
| `test_liquidateSeizes` | health < 11000 → collateral benar-benar pindah |
| `test_liquidateRefusesHealthy` | health ≥ 11000 → revert |
| 🔴 `test_abiSurface` | **fuzz: nol fungsi `onlyAgent` yang menerima `address`/`uint256`.** Ini yang membuktikan tesisnya |

---

## 6. Jadwal

### SENIN 10 AGT
- **Jam 0-3:** TASK 0 lengkap (§2). 🔴 **Gate: ABI beku + stub ter-deploy + posting ke grup**
- **Jam 3-EOD:** `DefralVault` asli + `NavOracle` + mock + Foundry test. **Target: `forge test` hijau lokal**

### SELASA 11 AGT
- **09-12:** Deploy semua + **`forge verify-contract` di BaseScan** (non-opsional — seluruh argumen "juri bisa baca `require()` sendiri" bergantung padanya). `registerRepayer(vault)`. `openPosition` dengan angka demo persis. **Umumkan alamat baru — ABI tidak berubah**
- **12-15:** `test_abiSurface` + adversarial mirror + siapkan prasyarat tiap serangan (oracle basi, round sama, posisi kedua yang TIDAK dijaga buat demo `liquidate`)
- **15-21:** **W1 `defral-guard`** (trigger `Event` → `AnswerUpdated`) + **W2 `defral-coupon`** (trigger `Schedule` → `sweepCoupon`). Discord node di **KEDUA** branch.
  ⚠️ Buat dengan **`enabled: true`** — `create_workflow` ninggalin disabled dan **nol yang fire**

### RABU 12 AGT
- **09-12:** **W3 `Block` watchdog** + **W4 `Manual` read-only** + jalur `check-and-execute`
- **12-13:** `docs/TEARDOWN.md` — hasil 4 probe + temuan audit + **koreksi issue #1869** (gap #4 dan #5 faktual salah: `/api/address-book` dan `/api/user/wallet/balances` **menerima `kh_` key hari ini**)
- **13-14:** dress rehearsal · **14-16:** bantu bima rekam · **16-17:** verifikasi tiap tx link di incognito · **17-19:** SUBMIT


### KAMIS 13 AGT — BUFFER. Deadline **17.00 WIB**.

**Nol commit kode.** Hanya: buka ulang tiap tautan tx di incognito · konfirmasi frontend ter-deploy hidup · konfirmasi video bisa diputar · konfirmasi repo public · jawab pertanyaan panitia.

**Kalau seluruh tim menganggur hari ini, rencananya berhasil.**

---

## 7. Gotcha KeeperHub yang bakal nabrak lo

| Gotcha | Konsekuensi |
|---|---|
| `chainId` **NUMBER** di Direct Execution REST, **STRING** `"84532"` di node config workflow | silent failure |
| `functionName` di REST, **`abiFunction`** di workflow node | issue #1927 |
| `abi` harus **JSON STRING**, bukan array | silent 422 |
| `simulate` **boolean, di BODY** — jangan string, jangan query param | issue #1959 |
| `functionArgs` = array posisional yang **di-JSON-stringify** | — |
| `create_workflow` bikin workflow **DISABLED** | nol yang fire |
| Chain sponsored: `From` di explorer = **relayer**, aksi lo = **internal call**, **gak muncul di history wallet** | **selalu link `transactionLink` dari KeeperHub** |
| `receiptStatus` punya 5 nilai + status ke-6 non-terminal tak terdokumentasi **`unconfirmed`** | jangan perlakukan sebagai failed |
| Rate limit **60/min per API key** | — |
| Gas sponsorship **butuh public mempool** → **mutually exclusive dengan private routing** | — |
| **Testnet gas GRATIS** | broadcast kegagalan sengaja itu murah — **manfaatkan** |
| **EIP-55 ketat di `/api/execute/transfer`** | Alamat mixed-case yang checksum-nya salah **ditolak**: `Invalid recipient address`. Pakai lowercase penuh atau checksum yang benar |
| **Gas limit override absolut per node** | Bisa set gas limit langsung, **bypass multiplier**. Berguna kalau estimasi meleset |
| **Ada retry on out-of-gas** | Docs: *"KeeperHub's retry logic may re-attempt with the default multiplier"* |
| **Wallet org punya bytecode** | Explorer melabelinya *delegated* / *smart account*. **Normal** — itu yang bikin `msg.sender` tetap alamat wallet |
| **Safe = nol gas sponsorship** | Kalau suatu saat pakai Safe sebagai Sender, sponsorship mati dan EOA wajib punya native gas |
| **Zodiac Roles tidak ada di Base Sepolia** | Cuma Ethereum, Base, Arbitrum, Optimism, Polygon, **Ethereum Sepolia**. Jalur mainnet, bukan sekarang |

---

## 8. Definition of Done

- [ ] `interface IDefralVault` beku dan **tidak berubah** sejak Senin menit 150
- [ ] Semua kontrak ter-deploy + **source-verified** di BaseScan
- [ ] `forge test` hijau, termasuk `test_abiSurface`
- [ ] `agentExecutor` == alamat dari `kh wallet info --json`
- [ ] **Nol fungsi `onlyAgent` yang menerima `address` atau `uint256`**
- [ ] **Nol `topUp`, nol `withdraw`** di vault — non-custodial, dan Capability Matrix bilang begitu
- [ ] `liquidate()` bisa dipanggil siapa pun dan **benar-benar memindahkan collateral**
- [ ] 4 workflow ada dan `enabled: true`
- [ ] `docs/TEARDOWN.md` ter-commit
- [ ] TX-0 tersimpan sejak jam pertama

---

---

## 9. STANDAR REKAYASA — cara nulis kode yang bertahan dibaca juri

Juri menilai *"kualitas kode & dokumentasi"* sebagai **1 dari 4 kriteria**, dan lo menyetir Claude agent — agent akan dengan senang hati menghasilkan kode yang jalan tapi tidak bisa dipertahankan, kecuali lo mengikatnya.

**Aturan buat agent lo:** kalau ia menghasilkan sesuatu yang melanggar standar di bawah, tolak dan minta ulang. Jangan "nanti dirapikan" — tidak akan sempat.

### 9.1 Doc comment menjawab SIAPA BOLEH APA, bukan mengulang nama fungsi

Ini standar tunggal yang paling menaikkan kualitas terbaca kontrak lo. Tiap fungsi yang mengubah state dapat blok yang menyatakan **siapa boleh memanggil, kenapa ia berhak, dan apa yang secara sengaja TIDAK bisa ia lakukan.**

```solidity
/// @notice Satu-satunya jalan agent memindahkan dana borrower.
/// @dev    SIAPA: hanya `agentExecutor` — EOA enclave yang kuncinya tidak pernah kita pegang.
///         KENAPA BOLEH: borrower memberi allowance ke vault ini; tidak ada
///         otoritas lain yang dibawa fungsi ini ke mana pun.
///         YANG SENGAJA TIDAK BISA: mengirim ke alamat mana pun selain `pool`,
///         mengirim jumlah pilihan sendiri, atau bertindak pada posisi sehat.
///         Ketiganya bukan kelalaian — itu tesis produknya.
function guardRepay() external onlyAgent { ... }
```

Pembaca berikutnya — dan juri — tidak akan menyimpulkan itu dari `function guardRepay()`.

### 9.2 Satu `require` untuk satu invariant, dengan error yang menyebut alasannya

```solidity
// ❌ satu revert, dua kemungkinan, nol informasi
require(h0 < policy.triggerBps && block.timestamp - updatedAt < MAX_STALE, "bad state");

// ✅ tiap penolakan punya nama sendiri, dan namanya muncul di BaseScan
if (updatedAt + MAX_STALE < block.timestamp) revert Refused_StaleOracle(updatedAt, MAX_STALE);
if (h0 >= policy.triggerBps)                 revert Refused_Healthy(h0, policy.triggerBps);
```

> 🔴 **Ini deliverable, bukan preferensi.** Nama error custom lo **muncul di halaman BaseScan** transaksi ter-revert, dan transaksi ter-revert adalah bukti utama submission. `Refused_Healthy(16667, 13000)` menceritakan seluruh cerita tanpa satu baris dokumentasi. `"bad state"` tidak menceritakan apa pun.

Custom error juga lebih murah dari string revert. Pakai custom error, selalu.

### 9.3 Checks-Effects-Interactions, tanpa pengecualian

```solidity
function guardRepay() external onlyAgent {
    // 1. CHECKS — semua pembacaan dan semua penolakan
    (uint80 roundId, int256 price,, uint256 updatedAt,) = oracle.latestRoundData();
    if (roundId == lastActedRound)               revert Refused_AlreadyActed(roundId);
    uint16 h0 = _healthBps(price);
    if (h0 >= policy.triggerBps)                 revert Refused_Healthy(h0, policy.triggerBps);
    uint256 amount = _min(_needed(price), _min(policy.maxRepayPerEvent, reserve()));
    if (amount == 0)                             revert Refused_NothingToRepay();

    // 2. EFFECTS — tulis state SEBELUM panggil keluar
    lastActedRound = roundId;

    // 3. INTERACTIONS — panggilan eksternal paling akhir
    dUSD.transferFrom(borrower, address(pool), amount);
    pool.applyRepayment(borrower, amount);
    emit Rescued(borrower, KIND_RESCUE, amount, h0, _healthBps(price), price, roundId, uint64(block.timestamp));
}
```

`lastActedRound` ditulis **sebelum** transfer. Kalau dibalik, satu token dengan callback bisa masuk lagi sebelum penanda tertulis.

### 9.4 Konstanta bernama, dengan alasan angkanya — bukan angka telanjang

```solidity
/// Ambang di mana siapa pun boleh menyita. 11000 bps = "pinjam 100, jaminan 110".
uint16 public constant LIQUIDATION_BPS = 11_000;

/// Batas policy borrower. Di bawah 12000 tidak menyisakan defence window;
/// di atas 15000 agent bertindak terlalu sering dan membakar cadangan.
uint16 public constant MIN_TRIGGER_BPS = 12_000;
uint16 public constant MAX_TRIGGER_BPS = 15_000;
```

Pakai pemisah digit (`11_000`, bukan `11000`). Angka yang salah baca adalah bug yang paling mahal dan paling tidak kelihatan.

### 9.5 `immutable` sebagai dokumentasi yang dipaksakan compiler

```solidity
address public immutable borrower;
address public immutable agentExecutor;   // dari `kh wallet info` — tidak ada jalan menggantinya
IERC20  public immutable dUSD;
```

Juri yang membaca `immutable agentExecutor` langsung tahu **tidak ada fungsi tersembunyi yang menggantinya** — dan compiler yang menjaminnya, bukan janji lo.

Aturannya: kalau sebuah alamat di-set di constructor dan tidak ada alasan bisnis untuk mengubahnya, ia **wajib** `immutable`.

### 9.6 View yang menjawab pertanyaan, bukan membocorkan storage

```solidity
// ❌ memaksa tiap pemanggil menghitung sendiri — dan menghitung beda
function debt() external view returns (uint256);
function collateralQty() external view returns (uint256);

// ✅ satu sumber kebenaran, dipakai kontrak, agent, dan UI
function healthRatioBps()      external view returns (uint16);
function quoteGuardRepay()     external view returns (uint256);
function amountToReachTarget() external view returns (uint256);
```

Setiap angka yang ditampilkan UI atau dipakai agent **harus punya view function-nya sendiri**. Kalau tiga lapisan menghitung rasio sendiri-sendiri, tiga lapisan itu akan menyimpang — dan penyimpangannya baru ketahuan saat demo.

### 9.7 Math: satu helper, satu komentar yang menjelaskan pembulatannya

```solidity
/// @dev Half-up, mencocokkan pembulatan half-away-from-zero di agent dan UI.
///      JANGAN pakai pembagian biasa: truncate menghasilkan 12666, bukan 12667,
///      dan angka itu muncul identik di tiga implementasi — kesamaan itu argumennya.
function _mulDivRound(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
    return (a * b + d / 2) / d;
}
```

Nol pembagian mentah tersebar di kontrak.

### 9.8 Test menulis skenario, dan gagal dengan nilai sebenarnya

```solidity
function test_refusesWhenHealthy() public {
    _seedDemoPosition();                  // 10.000 @ 1.00, utang 6.000 -> 16667 bps
    vm.prank(agentExecutor);
    vm.expectRevert(abi.encodeWithSelector(
        IDefralVault.Refused_Healthy.selector, 16667, 13000));
    vault.guardRepay();
}
```

**Satu helper seed dengan override**, supaya tiap test tinggal 3 baris:

```solidity
struct Seed { uint256 price; uint256 debt; uint256 reserve; bool couponSweep; }

function _seedDemoPosition() internal { _seed(Seed(1e8, 6_000e6, 1_500e6, false)); }
function _seed(Seed memory s) internal { ... }   // tiap test override yang relevan saja
```

Nama test = kalimat yang bisa dibaca stakeholder: `test_refusesWhenHealthy`, bukan `testGuardRepay3`. **Tiap `revert` wajib punya test-nya sendiri.**

Plus satu test yang membuktikan tesisnya, bukan cuma perilakunya:

```solidity
/// Membuktikan PERMUKAAN otoritas agent, bukan perilakunya.
/// Tiap fungsi non-view yang lolos onlyAgent harus ber-arity NOL.
/// Kalau ada yang menerima address atau uint256, tesis kita bohong.
function test_abiSurface() public view { ... }
```

### 9.9 Gejala agent lo menghasilkan kode buruk

| Gejala | Perbaikan |
|---|---|
| Fungsi 80 baris yang "melakukan semuanya" | Pecah di batas checks / effects / interactions |
| `require(cond)` tanpa pesan | Custom error dengan parameter |
| Angka telanjang di tengah logic | Konstanta bernama + alasan angkanya |
| Test cuma happy path | Tiap `revert` punya test sendiri |
| Doc comment mengulang nama fungsi | Ganti: siapa boleh, kenapa, apa yang sengaja tidak bisa |
| `public` padahal cukup `external`/`private` | Visibilitas paling sempit yang masih jalan |

---

### 9.10 Tulis untuk mainnet, deploy ke testnet

Tidak ada satu pun keputusan di kontrak ini yang boleh mengunci kita di testnet. Aturan konkretnya:

| Aturan | Kenapa |
|---|---|
| **Nol alamat hardcoded.** Semua — token, oracle, pool — masuk lewat constructor | Mainnet = argumen deploy yang beda, nol perubahan kode |
| **Oracle wajib berbentuk `AggregatorV3Interface`** | Ganti ke feed Chainlink asli = **satu alamat**. Ini alasan bentuk itu dipilih, bukan kebetulan |
| **Nol asumsi gas gratis** | Di mainnet sponsorship punya plafon lalu jatuh ke EOA. Docs: *"it fails if that wallet has no native balance"*. Jangan pernah menulis logic yang mengandaikan gas nol |
| **`allowCollateral` menerima instrumen apa pun** | Menambah RWA di mainnet = satu panggilan, bukan deploy ulang |
| **Nol `chainId` hardcoded di kontrak** | Kalau butuh, baca `block.chainid` |
| **Konstanta ekonomi (`LIQUIDATION_BPS`, bonus, batas trigger) = `constant`, bukan magic number** | Kalau mainnet butuh angka beda, satu tempat yang berubah dan compiler yang menemukannya |

Satu hal yang **sengaja tidak** disiapkan untuk mainnet: `MockUSD`, `MockTreasury`, `MockLendingPool`, dan `NavOracle`. Itu memang perancah demo, dan README menyatakannya. Yang harus mainnet-ready adalah `DefralVault` — dan ia tidak pernah tahu bahwa tetangganya mock.

---

## 10. 🔴 ATURAN DESAIN YANG MENGIKAT — turunan audit implementasi pendahulu

Sepuluh aturan di bawah ini **bukan saran**. Semuanya turunan langsung dari audit baris-per-baris atas implementasi pendahulu, dan semuanya menutup satu baris di PRD §6. **Baca sebelum menulis satu baris Solidity.**


Audit membaca **setiap** file implementasi pendahulu. Temuan yang **mengubah kontrak lo**. Baca ini sebelum nulis Solidity.

### K1. `LIQUIDATION_BPS = 11000` ADALAH "$110 lawan $100" milik tim, dalam basis points

Ini rekonsiliasi paling bersih di seluruh proyek. **Taruh di slide:**

```
16667 bps ← posisi sehat (10.000 @ 1.00 lawan utang 6.000)
          │
13000 bps ← triggerBps  — agent bertindak DI BAWAH ini
          │
          │   ◀━━━━ DEFENCE WINDOW. Seluruh tugas reserve adalah
          │         menjaga lo keluar dari jendela 2000 bps ini.
          │
11000 bps ← LIQUIDATION_BPS — siapa pun boleh menyita
```

`LIQUIDATION_BPS = 11000` · `LIQUIDATION_BONUS_BPS = 500` · **permissionless**.
Pool-only seizure kelihatan kayak fungsi admin dan ngundang pertanyaan *"jadi siapa yang manggil ini?"*

### K2. 🔴 Rounding half-up itu LOAD-BEARING

Daml pakai `round` (half away from zero). Solidity integer division **truncate**.

```solidity
function _mulDivRound(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
    return (a * b + d / 2) / d;      // ◀ WAJIB. Tanpa ini 12666.66 jadi 12666, bukan 12667
}
```

Angka demo **12667** muncul di 4 file spesifikasi + README + `Demo.daml:181` (`rescue.healthBefore === 12667`). Kalau meleset 1 bps, argumen *"tiga implementasi independen, satu angka"* mati. **Test harus assert `16667` dan `12667` persis.**

`amountToReachTarget` **truncate ke bawah** ke unit terkecil debt token — Daml juga gak membulatkannya.

### K3. 🔴 `allowCollateral()` + collateral KEDUA = bukti klaim "dalam bentuk apapun". 10 menit.

```solidity
function allowCollateral(address token, string calldata instrumentId, uint8 decimals_, bool yieldBearing) external onlyOwner;
```

Daftarkan **dua**: `dUST` (treasury, `yieldBearing = true`) dan **`mXAU`** (emas, `yieldBearing = false`).

Demo nunjukin **engine yang sama** melindungi dua-duanya. Satu panggilan `allowCollateral` ekstra = seluruh bukti klaim tim, dan makan **sepuluh menit**.

### K4. 🔴 Coupon harus DEGRADE jadi no-op, JANGAN PERNAH abort

Bug di implementasi pendahulu: `payCoupon` dengan `couponRateBps = 0` menghitung `0.0`, melanggar `ensure amount > 0.0` (`Coupon.daml:42`) → **transaksi THROW**. Jalanin demo implementasi pendahulu pakai emas → **hard failure di `Demo.daml:224`**, bukan no-op senyap.

Di EVM: collateral non-yield → `pendingCoupon` tetap 0 → `sweepCoupon()` revert `Refused_NoCouponDue()` **dan agent gak pernah manggilnya** karena `couponDue() == 0`. Loop agent jalan nol kali. **Itu degradasi yang Daml gak pernah punya.**

### K5. 🔴 Cap `sweepCoupon` — versi Daml TIDAK meng-cap-nya

`SweepToLoan` (`Coupon.daml:73-108`) **uncapped, unthrottled, nol health assert**. Kalau kupon > outstanding, `ApplyRepayment` **REVERT** (`assertMsg "cannot repay more than outstanding"`) — lebih buruk dari cap.

```solidity
uint256 amount = _min(couponDue(), position.debt);   // ◀ cap, jangan revert
```

Health gate tetap **sengaja tidak ada** — sweep itu paydown proaktif (`Coupon.daml:70-72`). Itu benar, pertahankan.

### K6. 🔴 `setPolicy` WAJIB ADA — ada 2 kontrol UI yang sekarang diam-diam gak ngapa-ngapain

`GuardPolicy` Daml punya **nol choice** — immutable. Akibatnya dua kontrol UI yang sudah ter-ship diam-diam tidak melakukan apa-apa: set-trigger no-op di live mode, dan toggle Coupon Sweep disembunyikan. **`setPolicy` menghidupkan dua-duanya** (PRD G7, req D3).

`setPolicy` ~6 baris dan **menghidupkan dua-duanya**. Pertahankan `ensure` Daml sebagai `require()`:
```solidity
require(triggerBps >= 12000 && triggerBps <= 15000);   // MIN/MAX_TRIGGER_BPS
require(targetBps >= triggerBps);
require(maxRepayPerEvent > 0);
```

### K7. 🔴 Likuidasi di-gate HEALTH sebagai PRIMARY, grace cuma penunda

Bug di implementasi pendahulu: `LastResortDefault` **nol health check** — dia gak fetch PriceFeed sama sekali. Posisi sehat 16667 bps **bisa di-default** pakai `GracePeriod` kedaluwarsa mana pun. Dan `GracePeriod` nol choice + Daml nol auto-archive → **marker itu abadi**.

Lebih parah: `StartGracePeriod` **nonconsuming tanpa idempotency guard** → agent mencetak trigger default permanen baru **tiap poll tick** selama vault kosong.

```solidity
function liquidate(address borrower) external {
    uint16 h = healthRatioBps(borrower);
    if (h >= LIQUIDATION_BPS) revert NotLiquidatable(h);     // ◀ PRIMARY gate
    if (graceExpiry[borrower] > block.timestamp) revert GraceStillOpen(graceExpiry[borrower]);
    ...
}
function _clearGrace(address b) internal;   // ◀ panggil saat health pulih
```

### K8. Escrow BENERAN — `Lock` versi Daml cuma disclosure

`Assets.daml:65-69` `Unlock` **satu-satunya assert-nya** `isSome lockedBy`. Nol loan di-fetch, nol saldo dicek, **`lockHolder` gak bisa protes**. **Borrower bisa unlock dan mentransfer collateral yang di-pledge kapan saja selagi loan hidup.**

Jadi `Loan.collateralAmount` **bisa gak di-back apa-apa**. Escrow ERC20 nyata di EVM **memperbaiki** ini — bukan mereproduksinya. Tulis di README: ini satu tempat lagi versi EVM lebih kuat.

### K9. `maturity` mati total — hapus. `faceValue` → `collateralQty`

`maturity` di-set di 4 tempat, **dibaca nol choice**, gak pernah dibandingkan `getTime`. Dekorasi.

`faceValue` itu bahasa obligasi buat **kuantitas** — ons buat emas, sats buat wBTC. Pakai `collateralQty`.

### K10. Oracle: `roundId` monoton + harga **8 desimal** (konvensi Chainlink)

`pushPrice` **HARUS** mengembalikan `uint80` yang naik monoton. Angka itu **seluruh pengganti** dari cid-churn consuming-choice Daml, jadi satu-satunya properti keamanan yang bergantung padanya.

---

### ✅ Yang TIDAK berubah — desain lo tetap

Audit ngusulin kontrak **monolitik + custodial + `guardRepay(address, uint80)`**. **Ditolak**, karena:

| | Usulan audit | **Defral (dipertahankan)** |
|---|---|---|
| Reserve | custodial, `topUpReserve`/`withdrawReserve` | **non-custodial** — keputusan tim |
| `guardRepay` | `(address, uint80)` | **zero-arg** — agent gak bisa ngirim apa pun |
| Struktur | satu kontrak monolitik | **factory + vault per borrower** |
| `check-and-execute` | ❌ mati (condition read gak boleh punya arg) | ✅ **jalan native** |

Zero-arg **itu tesisnya**. Non-custodial **keputusan tim**. Dua-duanya menang.

---

## 11. Prompt awal buat Claude lo

```
Baca dua dokumen ini lengkap, urut:
  1. D:\defral\PRD-defral.md   — APA dan KENAPA. Fokus §4 (tesis), §6 (peta perbaikan G1-G11), §10 (requirement).
  2. D:\defral\SC\plan.md      — GIMANA. Semua yang lo butuh ada di dalamnya.

Logic Daml aslinya sudah ditulis inline di plan §5, jadi lo TIDAK butuh repo lain.

Requirement yang lo tutup: A1-A6, B1-B2, C1-C4, D1-D7, E6. Tabelnya di plan §0.5.
Acceptance criteria tiap requirement ada di PRD §10 — pakai itu sebagai definition of done,
bukan perasaan "kayaknya udah jalan".

Mulai dari TASK 0 (plan §2). JANGAN tulis DefralVault sebelum interface-nya beku dan stub-nya
ter-deploy — islakun dan bima nunggu ABI itu, dan itu blocker CP3 di PRD §14.

Baca plan §10 (ATURAN DESAIN YANG MENGIKAT) SEBELUM nulis satu baris Solidity. Sepuluh aturan
di situ turunan audit baris-per-baris, dan melanggarnya berarti mengulang bug yang sudah ketemu.

Aturan keras:
- Nol fungsi onlyAgent yang menerima address atau uint256. Tepat DUA fungsi, keduanya ZERO-ARGUMENT.
- Vault tidak pernah memegang dana cadangan. Nol withdraw(), nol topUp().
- Rounding half-up: _mulDivRound(a,b,d) = (a*b + d/2)/d.
  Test HARUS assert 16667 dan 12667 PERSIS — angka itu muncul identik di agent dan UI, dan
  kesamaan itu adalah argumennya.
```
