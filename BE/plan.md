# BE — Plan Backend (islakun)

**Defral · KeeperHub Agents Onchain Hackathon · deadline 2026-08-13 17:00 WIB**
**TypeScript · Node 20+ · viem · vitest · Express**

> Dokumen ini ditulis supaya bisa dieksekusi langsung bareng Claude. Tiap task punya acceptance criteria yang bisa dicek.

---

## 0. Yang lo bangun, dalam satu kalimat

**Agent otonom yang mengeksekusi SETIAP perubahan state lewat KeeperHub, dan yang bisa dibuktikan TIDAK BISA melakukan hal lain.**

Bukti itu bukan paragraf README. Bukti itu **transaksi reverted yang bisa diklik**: kita sengaja menyuruh agent nyerang vault-nya sendiri, mem-broadcast tx yang pasti gagal, dan menautkan hash-nya.

---

## 1. Kode inti yang harus lo tulis — semuanya ada di sini

Repo mulai **kosong**. Tidak ada yang perlu lo cari di folder lain. Empat potong di bawah ini adalah fondasinya — tulis persis, lalu bangun di atasnya.

### 1.1 `agent/src/types.ts` — bentuk data

```ts
export type Party = string;                    // di EVM: alamat 0x...
export interface Contract<T> { contractId: string; payload: T; }

export interface PriceFeed  { oracle: Party; instrumentId: string; price: number; }
export interface Loan       { borrower: Party; poolOperator: Party; guardAgent: Party;
                              loanId: string; principal: number; outstanding: number;
                              rateBps: number; collateralInstrumentId: string;
                              collateralAmount: number; }
export interface GuardPolicy{ borrower: Party; guardAgent: Party; triggerRatioBps: number;
                              targetRatioBps: number; maxRepayPerEvent: number;
                              couponSweep: boolean; }
export interface ShadowVault{ borrower: Party; guardAgent: Party; balance: number; }
export interface GracePeriod{ borrower: Party; guardAgent: Party; poolOperator: Party;
                              loanId: string; startedAt: string; expiresAt: string; }
export interface CouponDistribution { issuer: Party; owner: Party; guardAgent: Party;
                                      instrumentId: string; amount: number; }
export interface RescueEvent{ guardAgent: Party; borrower: Party; loanId: string;
                              description: string; amount: number;
                              healthBefore: number; healthAfter: number; at: string; }
```

### 1.2 `agent/src/health.ts` — math murni, nol I/O

```ts
/** Bulatkan ke sen, half-away-from-zero. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Health Ratio dalam basis points. 13000 = 130%.
 *  outstanding 0 = tidak ada utang untuk dilindungi = maksimal sehat. */
export function healthRatioBps(collateralAmount: number, price: number, outstanding: number): number {
  if (outstanding <= 0) return Number.POSITIVE_INFINITY;
  return Math.round((collateralAmount * price / outstanding) * 10000);
}

/** Berapa yang harus dibayar supaya health balik ke target.
 *  needed = outstanding - collateralValue / (targetBps / 10000)
 *  repay  = min(needed, maxRepayPerEvent, vaultBalance), minimum 0. */
export function repayAmountToTarget(
  collateralAmount: number, price: number, outstanding: number,
  targetRatioBps: number, maxRepayPerEvent: number, vaultBalance: number,
): number {
  const collateralValue   = collateralAmount * price;
  const targetOutstanding = collateralValue / (targetRatioBps / 10000);
  const needed = Math.max(0, outstanding - targetOutstanding);
  return roundMoney(Math.max(0, Math.min(needed, maxRepayPerEvent, vaultBalance)));
}

/** Persentase penurunan harga terhadap par (1.00), untuk kalimat log manusia. */
export function priceDipPct(price: number, parPrice = 1.0): number {
  return roundMoney((1 - price / parPrice) * 100);
}
```

> 🔴 **Angka ini harus persis.** collateral 10.000 @ 1.00 lawan outstanding 6.000 → **16667 bps**. Harga 0.76 → **12667 bps** → repay **758.62** → outstanding **5241.38** @ **14500 bps**. Kupon 112.50 → **5128.88** @ **14818 bps**. Angka yang sama harus keluar dari Solidity alven. **Itu argumen "dua implementasi independen, satu angka".**

### 1.3 🔴 `agent/src/ledger.ts` — THE SEAM. Bentuknya tidak boleh berubah.

```ts
export interface GuardRepayArgs   { priceFeedCid: string; loanCid: string; guardPolicyCid: string; }
export interface SweepToLoanArgs  { guardPolicyCid: string; loanCid: string; }

export interface GuardRepayResult {
  vault: Contract<ShadowVault>; loan: Contract<Loan>; rescueEvent: Contract<RescueEvent>;
  amountRepaid: number; healthBefore: number; healthAfter: number;
}
export interface SweepToLoanResult { amount: number; loan: Contract<Loan>; }

/** Satu-satunya hal yang guard.ts tahu. Ia tidak pernah tahu backend-nya apa. */
export interface Ledger {
  getActivePriceFeeds():          Promise<Contract<PriceFeed>[]>;
  getActiveLoans():               Promise<Contract<Loan>[]>;
  getActiveGuardPolicies():       Promise<Contract<GuardPolicy>[]>;
  getActiveShadowVaults():        Promise<Contract<ShadowVault>[]>;
  getActiveGracePeriods():        Promise<Contract<GracePeriod>[]>;
  getActiveCouponDistributions(): Promise<Contract<CouponDistribution>[]>;

  exerciseGuardRepay(vaultCid: string, args: GuardRepayArgs):     Promise<GuardRepayResult>;
  exerciseStartGracePeriod(loanCid: string):                      Promise<Contract<GracePeriod>>;
  exerciseSweepToLoan(couponCid: string, args: SweepToLoanArgs):  Promise<SweepToLoanResult>;
}
```

Tulis juga **`MockLedger implements Ledger`** — in-memory, deterministik, nol network. Method `seedX()` untuk setup test, `updatePrice()` yang **mengganti contractId** (ini yang mensimulasikan observasi harga baru), dan `exerciseGuardRepay` yang mereplikasi aturan bisnis: assert health < trigger, hitung `repayAmountToTarget`, kurangi outstanding dan vault, catat `RescueEvent`.

> **Kenapa seam ini load-bearing:** `guard.ts` ditulis **hanya** melawan interface ini. `MockLedger` dan `KeeperHubLedger` dua-duanya mengimplementasikannya, jadi **suite test yang sama lulus melawan dua backend eksekusi yang sepenuhnya berbeda** — satu in-memory, satu blockchain sungguhan lewat KeeperHub. Juri jalanin sendiri: `npm test`.
>
> Kalau lo tergoda "ganti signature dikit biar rapi" — **jangan.** Itu mbuang klaim terkuat kita.

### 1.4 `agent/src/guard.ts` — satu poll cycle

Algoritmanya, tulis persis urutan ini:

```ts
export interface GuardState { lastActedPriceFeedCidByLoan: Map<string, string>; }
export const createGuardState = (): GuardState => ({ lastActedPriceFeedCidByLoan: new Map() });

/** 🔴 Key = borrower + loanId, BUKAN loanId saja.
 *  Di testnet bersama, banyak borrower bisa share loanId "loan-1" dan semuanya
 *  bertindak atas satu observasi harga global. Key by loanId saja bikin rescue
 *  borrower pertama menandai harga itu "sudah ditindak" dan diam-diam MELEWATI
 *  semua borrower lain. */
const loanKey = (loan: Loan) => `${loan.borrower} ${loan.loanId}`;

export async function runGuardCycle(ledger: Ledger, state: GuardState, log = console.log) {
  const [feeds, loans, policies, vaults, graces, coupons] = await Promise.all([
    ledger.getActivePriceFeeds(), ledger.getActiveLoans(), ledger.getActiveGuardPolicies(),
    ledger.getActiveShadowVaults(), ledger.getActiveGracePeriods(),
    ledger.getActiveCouponDistributions(),
  ]);

  // 🔴 PER-ITEM ERROR ISOLATION: satu exercise yang throw TIDAK BOLEH melewati
  //    loan/coupon sisanya di poll ini. Log lalu lanjut; poll berikutnya retry
  //    secara alami dari state chain yang segar.
  for (const loanC of loans) {
    try { await guardOneLoan(ledger, state, log, loanC, { feeds, policies, vaults, graces }); }
    catch (err) { log(`guard error on loan ${loanC.payload.loanId}: ${msg(err)}`); }
  }
  for (const couponC of coupons) {
    try { /* policy.couponSweep? -> exerciseSweepToLoan */ }
    catch (err) { log(`coupon error ${couponC.contractId}: ${msg(err)}`); }
  }
}

async function guardOneLoan(ledger, state, log, loanC, { feeds, policies, vaults, graces }) {
  const loan = loanC.payload;
  const policyC = policies.find(p => p.payload.borrower === loan.borrower);
  const vaultC  = vaults.find(v => v.payload.borrower === loan.borrower);
  const priceC  = feeds.find(f => f.payload.instrumentId === loan.collateralInstrumentId);
  if (!policyC || !vaultC || !priceC) return;          // belum lengkap, tidak ada yang dijaga

  const ratio = healthRatioBps(loan.collateralAmount, priceC.payload.price, loan.outstanding);
  if (ratio >= policyC.payload.triggerRatioBps) return; // sehat — dan tidak thrash tick berikutnya

  const key = loanKey(loan);
  if (state.lastActedPriceFeedCidByLoan.get(key) === priceC.contractId) return;  // ◀ lihat Bug 2

  if (vaultC.payload.balance < 1) {                     // MIN_REPAYABLE_BALANCE
    const graceLive = graces.some(g => g.payload.loanId === loan.loanId
                                    && g.payload.borrower === loan.borrower);
    if (!graceLive) await ledger.exerciseStartGracePeriod(loanC.contractId);
    state.lastActedPriceFeedCidByLoan.set(key, priceC.contractId);
    return;
  }

  const amount = repayAmountToTarget(loan.collateralAmount, priceC.payload.price,
                  loan.outstanding, policyC.payload.targetRatioBps,
                  policyC.payload.maxRepayPerEvent, vaultC.payload.balance);
  if (amount <= 0) return;

  const result = await ledger.exerciseGuardRepay(vaultC.contractId, {
    priceFeedCid: priceC.contractId, loanCid: loanC.contractId, guardPolicyCid: policyC.contractId,
  });
  state.lastActedPriceFeedCidByLoan.set(key, priceC.contractId);
  log(`Price dipped ${priceDipPct(priceC.payload.price)}%. Repaid $${result.amountRepaid.toFixed(2)} ` +
      `from your reserve. Position safe. — Defral`);
}
```

### 1.5 `agent/src/index.ts` — loop, dengan Bug 1 sudah dihindari

```ts
async function main() {
  const ledger = buildLedger();                 // "mock" | "keeperhub"
  const state  = createGuardState();
  const pollMs = Number(process.env.POLL_MS ?? "15000");   // 🔴 15000, JANGAN 2000

  // Escape hatch demo: OVERLAP_GUARD=off mematikan proteksi supaya kita bisa
  // MENUNJUKKAN bug-nya sedang gagal di video, lalu menunjukkan lastActedRound
  // onchain menangkap submit duplikatnya.
  const guardOn = (process.env.OVERLAP_GUARD ?? "on") !== "off";

  let running = true, inFlight = false;
  process.on("SIGINT", () => { running = false; });

  while (running) {
    if (!guardOn || !inFlight) {
      inFlight = true;
      try { await runGuardCycle(ledger, state, console.log); }
      catch (e) { console.log(`cycle error: ${e}`); }
      finally { inFlight = false; }
    }
    await sleep(pollMs);
  }
}
```

### 1.6 Pola `stubFetch()` — fondasi `keeperhub.test.ts`

```ts
interface RecordedCall { url: string; init?: { body?: string; headers?: Record<string, string> }; }

/** fetch stub: routing berdasarkan suffix URL, merekam SETIAP panggilan.
 *  Ini yang bikin lo bisa assert body request dan header Idempotency-Key
 *  tanpa satu pun network call. */
function stubFetch(routes: Record<string, unknown>, calls: RecordedCall[]): typeof fetch {
  return (async (url: unknown, init?: unknown) => {
    const u = String(url);
    calls.push({ url: u, init: init as RecordedCall["init"] });
    for (const [suffix, body] of Object.entries(routes)) {
      if (u.endsWith(suffix)) {
        return new Response(JSON.stringify(body), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(`no stub for ${u}`, { status: 404 });
  }) as typeof fetch;
}
```

### 1.7 Test yang harus lo tulis — `agent/test/guard.test.ts`

Sepuluh test melawan `MockLedger`. **Tulis dulu, sebelum `KeeperHubLedger`** — begitu keduanya `implements Ledger`, suite yang sama jalan melawan dua-duanya tanpa diubah.

| # | Test |
|---|---|
| 1 | trigger fire saat health turun di bawah `triggerRatioBps` |
| 2 | **tidak** fire saat sehat |
| 3 | repay ter-cap oleh `maxRepayPerEvent` |
| 4 | repay ter-cap oleh saldo reserve |
| 5 | grace period dibuka saat reserve kosong |
| 6 | grace dibuka **tepat sekali**, bukan tiap tick |
| 7 | coupon sweep jalan saat `couponSweep = true` |
| 8 | coupon sweep **tidak** jalan saat `false` |
| 9 | **tidak pernah fire dua kali** pada observasi harga yang sama |
| 10 | 🔴 **dua borrower berbagi loanId yang sama, dua-duanya diselamatkan dalam satu poll** |
| — | plus: satu exercise yang throw **tidak** melewati loan sisanya (error isolation) |

Plus `health.test.ts` — pin `16667`, `12667`, `758.62`, `112.50`.

### Yang lo tulis setelah fondasi ini

| File | Perkiraan | Bagian |
|---|---|---|
| `agent/src/keeperhub-ledger.ts` | ~370 | §4.1 |
| `agent/test/keeperhub.test.ts` | ~250 | §4.3 |
| `agent/src/chaos.ts` | ~80 | §4.5 |
| `backend/src/index.ts` (Express, rate limiter, CORS, error handler) | ~190 | §4.6 |
| `backend/src/evm-ledger.ts` | ~250 | §4.6 |
| `backend/src/reconciler.ts` | ~120 | §4.7 |
| `scripts/prove.ts` | ~300 | §4.4 |

## 2. 🔴 Dua jebakan yang membunuh port ini. Hindari dari baris pertama.

Dua-duanya ditemukan lewat audit versi Canton dari produk ini. Dua-duanya **tidak akan lo sadari sampai demo hari** kalau lo gak tahu duluan.

### Jebakan 1 — `setInterval` tanpa overlap guard = rescue yang sama disubmit belasan kali

```ts
setInterval(tick, 2000)     // ❌ JANGAN PERNAH. Ini yang dipakai versi Canton.
```

Di Canton `submit-and-wait` balik **~1 detik** → aman. Lewat KeeperHub, satu `guardRepay` = submit + poll status + fetch receipt = **10-60 detik**. Tick ke-2 sampai ke-30 jalan sementara tick pertama **masih menunggu**. Dan karena idempotency ditandai **SETELAH** `await` selesai, rescue yang sama **disubmit belasan kali**.

```ts
// ✅ async while + flag inFlight eksplisit
let running = true, inFlight = false;
while (running) {
  if (!inFlight) {
    inFlight = true;
    try { await runGuardCycle(ledger, state, log); }
    catch (e) { log(`cycle error: ${e}`); }
    finally { inFlight = false; }
  }
  await sleep(POLL_MS);       // 15000, JANGAN 2000
}
```

> **Sediakan escape hatch `OVERLAP_GUARD=off`.** Bukan buat produksi — buat **video**. Matikan proteksinya di depan kamera → 6 submit duplikat mengalir → `lastActedRound` onchain nangkep 5 di antaranya. **Itu beat reliability terbaik yang kita punya**, dan ia butuh bug-nya bisa dinyalakan lagi sesuka hati.

### Jebakan 2 — idempotency key yang patah SENYAP di EVM

Versi Canton nge-key idempotency ke **contract id PriceFeed**:

```ts
if (state.lastActedPriceFeedCidByLoan.get(key) === priceC.contractId) return;
```

Itu bekerja **hanya karena** di Canton, `UpdatePrice` adalah **consuming choice** — archive + recreate → **cid berubah tiap tick harga**. Harga baru = identitas baru.

Di EVM, **alamat oracle TETAP SELAMANYA**. Kalau `getActivePriceFeeds()` balik `contractId = alamat oracle`, maka setelah rescue pertama key-nya **selalu cocok** → agent **tidak akan pernah fire lagi**.

> 🔴 **Nol error. Nol log. Nol exception. Agent-nya cuma diam.** Lo baru sadar pas demo, dan pas itu udah telat.

```ts
// ✅ fix di KeeperHubLedger — BUKAN di guard.ts
contractId: `${oracleAddress}@${roundId}`
```

**`roundId` monoton dari `NavOracle` adalah penerus EVM dari consuming choice Canton.** Minta alven pastiin `pushPrice()` menaikkan `roundId` tiap kali — angka itu satu-satunya yang menjaga properti ini.

## 3. Arsitektur

```
[1] agent/src/index.ts          async while + inFlight flag
      |
[2] agent/src/guard.ts          runGuardCycle()   ← 183 baris, TIDAK DIUBAH
      |                         cuma bicara ke interface Ledger
      v
[3] agent/src/keeperhub-ledger.ts   class KeeperHubLedger implements Ledger
      |
      +── READS (6 method) ──► viem, SATU multicall, SATU blok
      |     KeeperHub TIDAK PUNYA verb read. Semua read lewat viem publicClient.
      |     getPosition() satu panggilan melayani 4 dari 6 method.
      |     contractId disintesis:  vault/loan/policy = `${vault}:${borrower}`
      |                             PRICE FEED       = `${oracle}@${roundId}`  ◀ WAJIB
      |
      +── PREFLIGHT ─────────► POST /api/execute/contract-call {simulate: true}
      |     → {wouldRevert, gasEstimate, revertReason}
      |     ⚠️ dry run TIDAK menulis directExecutions row. Hasil simulate BUKAN bukti.
      |        Untuk artefak, harus benar-benar broadcast.
      |
      +── WRITE ─────────────► POST /api/execute/check-and-execute   (utama)
      |                        POST /api/execute/contract-call        (fallback)
      |     Header: Idempotency-Key: sha256(chainId|vault|borrower|roundId|attemptEpoch)
      |
      +── POLL ──────────────► GET /api/execute/{executionId}/status
      |     tidur PERSIS X-Poll-Interval-Hint detik (0 = terminal)
      |     success   → selesai, simpan transactionLink
      |     reverted  → penolakan TERVERIFIKASI. Juga artefak.
      |     timeout | not_found | unconfirmed → UNKNOWN, BUKAN failed. JANGAN re-broadcast.
      |                                          Rekonsiliasi via event Rescued kita sendiri.
      |
      +── DECODE ────────────► viem getTransactionReceipt + decodeEventLog(Rescued)
            → {amountRepaid, healthBefore, healthAfter}
            KeeperHub TIDAK mengembalikan decoded return value.
```

---

## 4. Task

### 4.1 `agent/src/keeperhub-ledger.ts` (~370 baris) — P0

Implementasi 9 method `interface Ledger`.

**READS — semua via viem, nol KeeperHub:**
```ts
const [pos, round] = await publicClient.multicall({ contracts: [
  { address: vault, abi, functionName: 'getPosition' },
  { address: oracle, abi: aggV3, functionName: 'latestRoundData' },
]});
```
> Multicall3 di `0xcA11bde05977b3631167028862bE2a173976CA11`. **Snapshot atomik satu blok.** Read terpisah bisa mengangkangi blok — health ratio lo bisa mencampur harga blok N dengan outstanding blok N+2, dan bertindak atas posisi yang **tidak pernah ada**.

**WRITES:**
```ts
// preflight
POST /api/execute/contract-call
{ chainId: 84532,                      // NUMBER di REST
  contractAddress: vault,
  functionName: "guardRepay",          // REST pakai functionName
  functionArgs: "[]",                  // JSON-stringified array posisional
  abi: JSON.stringify(ABI),            // JSON STRING, bukan array → silent 422
  simulate: true }                     // boolean, di BODY

// broadcast — sama tanpa simulate, + header Idempotency-Key
// poll
GET /api/execute/{executionId}/status  // hormati X-Poll-Interval-Hint
```

**🔴 Terjemahan revert → throw (~20 baris, jangan dilewati):**
```ts
function assertTerminalSuccess(st: Status) {
  if (st.status === 'failed') throw new ExecutionRevertedError(st.error);
  const r = st.receipts?.[0];
  if (r?.receiptStatus === 'reverted') throw new ExecutionRevertedError(r.hash);
  if (['timeout','not_found','unconfirmed'].includes(r?.receiptStatus ?? ''))
    throw new ExecutionUnknownError(r);      // ◀ kelas BEDA, jangan retry broadcast
}
```
> KeeperHub balikin tx yang ter-revert sebagai **HTTP 200**, bukan exception. Kalau gak diterjemahkan, seluruh per-item error isolation di `guard.ts:73-79` **diam-diam melaporkan SUKSES pada rescue yang gagal.** Ini pembeda antara "kami menangani reliability" dan "kami tidak sadar."

**🔴 Derivasi Idempotency-Key (issue #1840):**
```ts
sha256(`${chainId}|${vault}|${borrower}|${roundId}|${attemptEpoch}`)  // lowercase hex
```
| Kelas kegagalan | Aksi |
|---|---|
| Network error / timeout | **PAKAI ULANG key** — itu gunanya idempotency |
| Terminal onchain revert | **`attemptEpoch++` → key BARU** — dunia bisa berubah semenit kemudian |

> #1840 **disengaja** (`lib/idempotency.ts:204-212` — *"a failed record means the prior attempt reached the broadcast path, so re-running could double-spend"*), dipin **24 jam**. Deteksi jalur basi lewat `idempotentReplay: true` di **response BODY**, bukan header.

**Acceptance:** 🔴 **10 test `guard.test.ts` lulus TANPA DIUBAH** melawan `KeeperHubLedger` yang di-stub. Checkpoint **Senin 15.00**.

### 4.2 Perbaikan agent (~60 baris) — P0
Bug 1 + Bug 2 dari §2. Kerjakan **paling pertama**, Minggu jam 0-1.

### 4.3 `agent/test/keeperhub.test.ts` (~250 baris) — P0
**Tulis SEBELUM implementasinya.** Pakai pola `stubFetch()` dari §1.6 — routing per suffix URL, merekam setiap panggilan, nol network. Pin: body request, header Idempotency-Key, `failed`→throw, `reverted`→throw, penghormatan `X-Poll-Interval-Hint`, derivasi key.

### 4.4 `scripts/prove.ts` — P0. **Ini artefak submission-nya.**

Satu perintah, **nol argumen**, dijalankan **live di panggung**:

```
1  NAV 1.00, health 16667. simulate → wouldRevert:true "Refused_Healthy"
   BROADCAST TETAP (gas testnet gratis)
   → receiptStatus "reverted", verified TRUE           >>> REFUSAL RECEIPT #1 <<<
2  Kunci publisher dorong NAV 1.00 → 0.76. roundId baru.
   (Kunci agent TIDAK BISA melakukan ini — kunci terpisah)
3  Agent fire tanpa diminta → "success", verified true  >>> RESCUE RECEIPT <<<
   Rescued(borrower, 1, 758.62, 12667, 14500, 0.76, roundId)
4  🔴 POSISI KEDUA yang TIDAK dijaga → siapa pun panggil pool.liquidate()
   → collateral BENAR-BENAR disita                     >>> LIQUIDATION RECEIPT <<<
   "Ini yang terjadi tanpa Defral. Klik dua-duanya."
5  Kupon dibayar → Schedule trigger sweep 112.50 → 5128.88 @ 14818 bps
6  Ulangi (1) pada posisi yang sekarang sehat          >>> REFUSAL RECEIPT #2 <<<
7  ASSERT saldo dUSD Turnkey EOA == 0
   Ia memindahkan 871.12 uang orang lain lewat gerbang yang tidak bisa ia lebarkan,
   dan tidak menyimpan sepeser pun.
```

Output: `docs/evidence/prove-run-<ts>.json` + tabel markdown.

### 4.5 Chaos suite — P1
`FlakyKeeperHubLedger` — polanya **sudah ada di repo lo**, di `agent/test/guard.test.ts` sekitar baris 322-335. Buka file itu: object literal yang mendelegasikan kesembilan method ke `MockLedger` sungguhan, dengan satu di-override supaya throw. Contek pola itu — **~15 baris per failure mode**:

```ts
const flaky: Ledger = {
  ...realLedger,                                   // delegasi 8 method lainnya
  exerciseGuardRepay: async (cid, args) => {
    if (mode === "timeout")   throw new ExecutionUnknownError({ receiptStatus: "timeout" });
    if (mode === "replay1840") return realLedger.exerciseGuardRepay(cid, args); // + idempotentReplay:true
    return realLedger.exerciseGuardRepay(cid, args);
  },
};
```

Inject: `timeout` · `not_found` · **`unconfirmed`** (status kelima non-terminal tak terdokumentasi, dari `execution-service.ts` KEEP-966) · replay #1840.

### 4.6 Backend `EvmLedger` + route (~250 baris, net −630) — P1
`GET /api/position` (viem multicall → `PositionView` yang sudah ada, **plus `maxRepayPerEvent`** yang `PolicyView` lama lupakan) · `GET /api/events` (log `Rescued` → `RescueEventView` dengan **`uint8 kind`**, jangan pernah lagi substring match) · `GET /api/executions` (proxy `/status` biar UI bisa render `verified`/`receiptStatus`/`transactionLink`).

> 🔴 **Backend pegang `kh_` key. Browser TIDAK PERNAH melihatnya.**

### 4.7 Reconciler (~120 baris) — P1
`Query Contract Events` (Web3 plugin, auto-batch 2000 blok) × `status.receipts[]`. **Ini jalur pemulihan untuk `timeout`/`not_found`/`unconfirmed`** — ubah timeout ambigu dari *"gue re-broadcast dan risiko double-spend?"* jadi query log dua detik.

### 4.8 Arsip bukti — P0
Flush **setiap** response `/status` ke `docs/evidence/*.json` dan **commit**.
> Retensi log free-tier **tidak terverifikasi**. Tx kita 11-12 Agt, **juri menilai 17-20 Agt.** Kalau dashboard KeeperHub kehilangan log kita, submission tetap utuh.

---

## 5. Jadwal

### MINGGU 10 AGT
| Jam | |
|---|---|
| 0-1 | 🔴 Bug 1 (overlap guard). 15 baris. **Paling pertama** |
| 1-3 | Scaffold `keeperhub-ledger.ts` + **tulis `keeperhub.test.ts` DULU** |
| **3** | 🔴 **alven serahkan ABI beku + alamat stub** — mulai integrasi nyata |
| 3-EOD | `KeeperHubLedger` melawan **kontrak stub nyata**. Wajib: `${oracle}@${roundId}` |

### SENIN 11 AGT
| Jam | |
|---|---|
| 09-15 | `KeeperHubLedger` lengkap: polling, receipt decode, revert→throw, idempotency `attemptEpoch` |
| **15** | 🔴 **CHECKPOINT: 10 test `guard.test.ts` lulus tanpa diubah** |
| 15-19 | 🔴 **RESCUE NYATA PERTAMA.** `setPrice(0.76)` → agent fire → BaseScan Success |
| 19-21 | Chaos suite |

### SELASA 12 AGT
`09-12` `prove.ts` lengkap · `12-13` reconciler + arsip JSON, **commit** · `13-14` dress rehearsal · `14-16` bantu bima rekam · `16-17` `pnpm test` hijau dari clone bersih · `17-19` **SUBMIT**

---

## 6. Gotcha KeeperHub

| Gotcha | Konsekuensi |
|---|---|
| Base URL `https://app.keeperhub.com` — path **sudah termasuk `/api`** | doubled prefix |
| `chainId` **NUMBER** di REST, **STRING** di node config workflow | silent failure |
| `abi` = **JSON STRING**, bukan array | silent 422 |
| `simulate` boolean **di BODY** — jangan query param (#1959) | broadcast beneran |
| `functionArgs` = array posisional **di-JSON-stringify** | — |
| `kh_` (org) vs `wfb_` (user, **hanya** webhook auth) — **tidak bisa saling gantikan** | `kh_` di webhook → 401 |
| Rate limit **60/min per API key** | token bucket 50/min + `ConcurrencyLimiter` (**diwarisi**, `agent/src/ledger.ts:773-790`) |
| `403 "Daily spending cap exceeded"` | state **non-retryable** tersendiri — hentikan submit, banner. **Bukan** retry loop |
| `receiptStatus` **5 nilai** + `unconfirmed` tak terdokumentasi | 3 terakhir = UNKNOWN |
| Chain sponsored: `From` = relayer, aksi = internal call, **gak muncul di history wallet** | **selalu `transactionLink`** |
| **Testnet gas GRATIS** | broadcast kegagalan sengaja itu murah |

---

## 7. Definition of Done

- [ ] 🔴 **10 test `guard.test.ts` lulus tanpa satu karakter pun diubah**
- [ ] `interface Ledger` **tidak berubah bentuknya**
- [ ] Nol panggilan ke `/api/execute/transfer` di **seluruh** codebase (#1959) — dan alasannya di README
- [ ] `${oracle}@${roundId}` terpasang
- [ ] Overlap guard terpasang, `POLL_MS` 15000
- [ ] `failed`/`reverted` → throw · `timeout`/`not_found`/`unconfirmed` → kelas **UNKNOWN**, jangan re-broadcast
- [ ] `attemptEpoch` naik **hanya** pada terminal revert
- [ ] `prove.ts` jalan satu perintah, hasilkan **≥2 refusal + 1 rescue + 1 liquidation**
- [ ] Saldo dUSD Turnkey EOA **persis nol** di akhir
- [ ] `docs/evidence/*.json` ter-commit
- [ ] `pnpm test` hijau dari clone bersih

---

---

---

## 8. 🔴 KOREKSI v2 — dari audit exhaustif seluruh repo Cermin

### K1. 🔴 Kebijakan retry #1840 — BRANCH ON `revertReason`, lebih presisi dari attemptEpoch

Ganti aturan `attemptEpoch` di §4.1 dengan ini:

| Kondisi | Arti | Aksi |
|---|---|---|
| `status: "failed"` **DENGAN** `revertReason` | **Deterministik.** Observasi harga sudah dinilai dan ditolak. | **JANGAN retry.** Log. Tunggu `roundId` berikutnya. Replay cached 24 jam justru **BENAR** — itu lapisan idempotency kedua di bawah map in-memory agent |
| `status: "failed"` **TANPA** `revertReason`, atau 5xx / network throw | **Infra.** Gak tahu mendarat atau enggak. | **Retry dengan key yang SAMA** — itu gunanya idempotency |

Lebih tajam dari `attemptEpoch++`, dan **memanfaatkan** #1840 alih-alih melawannya. Key tetap `sha256(chainId|vault|borrower|roundId)` — `roundId` yang berganti, bukan counter.

### K2. 🔴 Kesenjangan idempotency kedua yang Cermin punya dan lo warisi

`StartGracePeriod` di Cermin **nonconsuming tanpa idempotency guard** → agent mencetak GracePeriod baru **tiap poll tick** selama vault kosong. Di EVM: cek `graceExpiry[borrower] == 0` sebelum manggil, dan kontrak juga nge-guard. Jangan warisi bug-nya.

### K3. `sweepCoupon` di Cermin uncapped — bakal REVERT, bukan cap

`SweepToLoan` nol cap. Kalau kupon > outstanding, `ApplyRepayment` **revert**. Kontrak EVM meng-cap di `min(couponDue, debt)` (SC K5) — jadi `KeeperHubLedger` lo **tidak perlu** meng-cap di sisi TypeScript. Jangan duplikasi logikanya.

### K4. Demo Branch B — angka persisnya

`prove.ts` §4.4 langkah 4, pakai angka ini:

```
Branch A (dijaga):    reserve 1500 · harga 1.00 → 0.76 · health 12667 < 13000
                      → guardRepay → reserve 741.38, debt 5241.38, health 14500
                      → TIDAK PERNAH menyentuh 11000                    ◀ HEADLINE TX
Branch B (TIDAK dijaga): reserve 0 · harga → 0.60 · health 10000 < 11000
                      → openGracePeriod (GraceOpened, terlihat pool)
                      → liquidate() → collateral BENAR-BENAR PINDAH     ◀ LIQUIDATION TX
```

Dua link BaseScan berdampingan: **apa yang dicegah vault, dan apa yang terjadi saat dia kosong.**

### K5. 🔴 Jalankan `liquidate()` LEWAT KEEPERHUB JUGA, dari identitas kedua

Rekomendasi audit: bukan cuma `guardRepay` yang lewat KeeperHub. Jalankan `liquidate()` lewat `POST /api/execute/contract-call` dari **API key / identitas kedua**.

Biayanya satu panggilan API ekstra, dan itu **membuktikan framework agent-nya melakukan lebih dari satu peran** — bukan satu bot dengan satu tombol.

### K6. Batasan yang harus lo tahu — Cermin single-instrument permanen

`TopUpCollateral` assert `token.instrumentId == collateralInstrumentId`, `AcceptOffer` assert `token.faceValue == collateralAmount` dengan **kesetaraan Decimal PERSIS**. Nol basket, nol partial pledge. `Position` EVM juga pin satu `collateralToken`. **Nyatakan di submission** daripada dibiarkan ketemu juri.

### K7. Copy: "auto-rebalancing" → **"autonomous deleveraging"**

Yang lo bangun mengecilkan **penyebut** dan tidak pernah menyentuh pembilang. *"Rebalancing"* ngundang juri nanya *"lo nyeimbangin antar leg apa?"*. **"Autonomous deleveraging"** adalah yang lo bangun, dan klaimnya lebih tajam.

---

## 9. Prompt awal buat Claude lo

```
Baca D:\defral\BE\plan.md lengkap, lalu D:\defral\SC\plan.md §3 (interface kontrak beku).

Kode warisan SUDAH ADA di repo — lo tidak butuh folder lain:
  D:\defral\BE\agent\src\ledger.ts      <- interface Ledger di baris 59. JANGAN UBAH BENTUKNYA
  D:\defral\BE\agent\src\guard.ts       <- dipakai apa adanya
  D:\defral\BE\agent\src\health.ts      <- dipakai apa adanya
  D:\defral\BE\agent\src\index.ts       <- Bug 1 SUDAH diperbaiki, baca komentarnya
  D:\defral\BE\agent\test\guard.test.ts <- 10 test, HARUS LULUS TANPA DIUBAH

Verifikasi dulu semuanya hijau:
  cd D:\defral\BE\agent && npm install && npm test     # -> 20 pass, 0 fail

Lalu mulai dari §4.3 (tulis test dulu), baru §4.1 (KeeperHubLedger).

Aturan keras:
- Bentuk interface Ledger tidak boleh berubah. 10 test itu klaim headline kita.
- Nol panggilan ke /api/execute/transfer.
- contractId price feed WAJIB `${oracle}@${roundId}` — kalau salah, agent fire
  sekali lalu diam selamanya tanpa error.
- Baca §KOREKSI v2 — kebijakan retry #1840 di situ menggantikan §4.1.
```
