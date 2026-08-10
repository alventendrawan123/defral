# Dari SC (alven) buat bima — kontrak sudah live, ini cara konsumsinya

**Tanggal:** 2026-08-11 · **Chain:** Base Sepolia `84532` · **Status:** deploy selesai, verified, dan sudah terbukti jalan end-to-end lewat KeeperHub

Semua di dokumen ini sudah dibaca langsung dari chain, bukan dari rencana. Kalau ada yang beda antara dokumen ini dan catatan lama, yang ini yang benar.

---

## 1. Yang sudah kami bangun

Sembilan kontrak hidup dan terverifikasi di BaseScan. Yang penting buat lo cuma tiga: **DefralVault**, **MockLendingPool**, **NavOracle**.

Inti sistemnya satu kalimat: **agent punya tepat dua fungsi atas uang borrower, keduanya nol argumen, dan uangnya tidak pernah pindah ke vault.**

- `guardRepay()` — bayar sebagian utang sampai health kembali ke target
- `sweepCoupon()` — pakai kupon obligasi yang sudah ter-akrual buat menurunkan utang

Itu saja. Tidak ada `topUp()`, tidak ada `withdraw()`, tidak ada fungsi ber-argumen. Sudah dikunci fuzz test.

Dana pertahanan **tetap di dompet borrower**. Vault cuma pegang `allowance`. `reserve()` = `min(saldo dUSD borrower, allowance ke vault)`. Borrower cabut approval → agent lumpuh, tanpa perlu izin siapa pun.

---

## 2. Alamat

| Kontrak | Alamat |
|---|---|
| **DefralVault (demo)** | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| MockLendingPool | `0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD` |
| NavOracle (dUST) | `0x44B94bb593F6De51Ad3385264C0168eEc8E56392` |
| DefralVaultFactory | `0x1cbb29944ecfe0c5d8961f31bec296504615ac19` |
| MockUSD (dUSD) | `0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838` |
| MockTreasury (dUST) | `0x0A72124d5e606aB4264a653B6942738CBAbd2D43` |

Aktor:

```
borrower demo    0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2
agentExecutor    0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3
NAV publisher    0x104bd087D5e4767370D8569A32B2DD986c3b1c4A
```

> ⚠️ Ada vault kedua `0x8E11A9a4...` — itu rig rehearsal, sudah terpakai dan **agent-nya sudah dicabut permanen**. Jangan pakai. Vault demo di atas masih perawan: `lastActedRound = 0`.

**ABI: `docs/abi/*.json`.** Sudah di-export dari artifact build, tinggal import.

---

## 3. Fungsi yang lo baca

Semua **nol argumen**. Itu bukan kebetulan — satu vault satu borrower, jadi vault sudah tahu semuanya.

| Fungsi | Return | Arti |
|---|---|---|
| `healthRatioBps()` | `uint16` | rasio kesehatan dalam bps. 16667 = 166,67% |
| `quoteGuardRepay()` | `uint256` | dUSD yang **akan** dibayar kalau agent bertindak sekarang |
| `amountToReachTarget()` | `uint256` | kebutuhan mentah sebelum dibatasi reserve/maxRepay |
| `couponDue()` | `uint256` | kupon ter-akrual yang belum tersapu |
| `reserve()` | `uint256` | `min(saldo, allowance)` borrower |
| `lastActedRound()` | `uint80` | round oracle terakhir agent bertindak |
| `revoked()` | `bool` | borrower sudah cabut agent? |
| `agentExecutor()` | `address` | immutable, tidak bisa diganti |
| `borrower()` | `address` | immutable |
| `policy()` | `(uint16,uint16,uint256,bool)` | trigger, target, maxRepayPerEvent, couponSweep |
| `getPosition()` | struct | semuanya sekaligus — **pakai ini** |

`getPosition()` urutannya:

```solidity
(
  address borrower,
  uint256 outstanding,        // 6 desimal
  uint256 collateralAmount,   // 18 desimal
  uint16  triggerBps,
  uint16  targetBps,
  uint256 maxRepayPerEvent,   // 6 desimal
  bool    couponSweep,
  uint256 reserve,            // 6 desimal
  uint80  lastActedRound,
  bool    revoked
)
```

Satu panggilan, satu render. Jangan bikin 8 `useReadContract` terpisah.

### Desimal — ini yang paling sering bikin salah tampil

```
dUSD (utang, reserve, kupon)   6 desimal
dUST (jaminan)                18 desimal
harga oracle                   8 desimal
health                         basis point (bagi 100 untuk persen)
```

`6000000000` itu **6.000,00 dUSD**, bukan 6 miliar.

---

## 4. 🔴 Aturan yang mengikat FE

### a. `quoteGuardRepay()` adalah angka pratinjau. Jangan hitung sendiri.

Requirement D2 bilang kontrak, agent, dan UI harus menampilkan angka yang identik. Sudah kami buktikan on-chain: kontrak memprediksi `758620690`, dan yang benar-benar bergerak `758620690`. Persis.

Kalau lo hitung ulang di frontend pakai float JS, lo akan meleset — pembulatannya half-up (`(a*b + d/2)/d`), dan pemotongan biasa menghasilkan 12666, bukan 12667. Angka meleset satu di depan juri lebih merusak daripada tidak menampilkan apa-apa.

**Baca dari kontrak. Titik.**

### b. Saat posisi sehat, `quoteGuardRepay()` return **0**, bukan revert.

Sengaja — biar UI lo tidak perlu `try/catch`. Render `0` sebagai *"tidak ada yang perlu dibayar"*, bukan sebagai error.

### c. `couponDue()` bisa nol, dan itu **benar**.

Kupon adalah state ter-akrual, bukan rumus. Nol sampai penerbit memanggil `accrueQuarterlyCoupon()`. Kalau agent menolak dengan `Refused_NoCouponDue`, itu **perilaku benar**, bukan sistem rusak. Jangan tampilkan merah.

### d. Jangan pernah klaim "kami tidak pernah pegang private key agent".

Docs KeeperHub sendiri bilang owner org **bisa** mengekspornya (`canExportKey: true`, sudah kami verifikasi lewat API). Kalau juri menggali dan menemukan klaim itu bolong, seluruh demo kehilangan kredibilitas.

Framing yang benar dan lebih kuat:

> Owner bisa mengekspornya, dan itu tidak mengubah apa pun — karena vault cuma mengizinkan dua fungsi nol-argumen, keduanya membaca ulang oracle di transaksi yang sama dan menolak kalau posisi sehat.

### e. Penolakan agent **tidak punya link BaseScan**.

KeeperHub menolak mem-broadcast panggilan yang dia prediksi akan revert. Sudah kami uji tiga jalur independen. Yang lo dapat sebagai bukti penolakan adalah **rekaman eksekusi**, bukan transaksi:

```json
{ "executionId": "yjh4l0m4d9jgy7qtt6g6r", "status": "failed",
  "error": "Contract call failed: Refused_Healthy(16667, 13000)" }
```

Render itu apa adanya — nama error kontraknya sendiri, lengkap dengan angka hidupnya. **Jangan pasang tombol "lihat di BaseScan" untuk penolakan.** Tidak ada yang bisa dilihat.

Yang **punya** link BaseScan: pertahanan yang berhasil, dan satu transaksi revert dari pihak non-agent (§6).

---

## 5. Angka demo — sudah direproduksi on-chain, bukan di atas kertas

| Tahap | Health | Utang | Peristiwa |
|---|---|---|---|
| Buka | **16667** | 6.000,000000 | par $1,00 |
| NAV $1,00 → $0,76 | **12667** | 6.000,000000 | di bawah trigger 13000 |
| `guardRepay()` | **14500** | **5.241,379310** | bayar **758,620690** |
| `sweepCoupon()` | 14818 | **5.128,879310** | sapu **112,500000** |

Kebijakan: trigger **13000**, target **14500**, maxRepayPerEvent **2.000**, ambang likuidasi **11000**.

Jendela pertahanan yang lo gambar: **16667 → 13000 (trigger) → 11000 (likuidasi)**. Ruang antara 13000 dan 11000 itu yang dijaga agent.

---

## 6. Bukti yang bisa lo tautkan

| Apa | Link |
|---|---|
| Pertahanan berhasil, gas disponsori | [`0xb8f47a89...`](https://sepolia.basescan.org/tx/0xb8f47a89115841e5d0176fd6cd3a0d8d9ec1141baaafde37c4ad11afb3a46c9e) |
| Vault demo (source terbaca) | [`0x4f634d71...`](https://sepolia.basescan.org/address/0x4f634d7173eff255973e762c3fe04df4887ffb35) |
| **Deployer sistem ditolak vault** | [`0xb6a01688...`](https://sepolia.basescan.org/tx/0xb6a01688e55ebb71713a01c02b46318b6a71039bc79e155d1fd90e957700139d) |

Yang ketiga itu bahan cerita paling kuat yang kami punya. Pemanggilnya adalah alamat yang men-deploy setiap kontrak, memiliki pool, dan memegang seluruh admin key. Transaksinya **revert** dengan `NotAgent`. Vault menjawab tepat satu alamat, dan alamat itu tidak bisa diubah.

Kalau lo bikin halaman bukti, taruh itu di paling atas.

---

## 7. Contoh baca (viem)

```ts
import { createPublicClient, http, formatUnits } from 'viem'
import { baseSepolia } from 'viem/chains'
import vaultAbi from '@/abi/DefralVault.json'

const VAULT = '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35' as const

const client = createPublicClient({ chain: baseSepolia, transport: http() })

const p = await client.readContract({
  address: VAULT, abi: vaultAbi, functionName: 'getPosition',
})

const view = {
  healthPct:  (Number(p.triggerBps) / 100).toFixed(2),      // bps -> persen
  outstanding: formatUnits(p.outstanding, 6),                // dUSD
  collateral:  formatUnits(p.collateralAmount, 18),          // dUST
  reserve:     formatUnits(p.reserve, 6),
  armed:       !p.revoked,
}
```

Untuk pratinjau jumlah bayar:

```ts
const quote = await client.readContract({
  address: VAULT, abi: vaultAbi, functionName: 'quoteGuardRepay',
})
// quote === 0n  -> "posisi sehat, tidak ada yang dibayar"
// quote  >  0n  -> formatUnits(quote, 6) + " dUSD"
```

Semua ini **read-only**. FE tidak pernah menulis ke kontrak, dan **tidak pernah memegang `kh_` API key** — itu punya islakun, di backend.

---

## 8. Kalau butuh state berubah untuk testing

Minta gua. Yang bisa gua lakukan on-demand:

- dorong NAV turun/naik (butuh `PUBLISHER_KEY`)
- akrual kupon baru
- buka posisi demo tambahan

Jangan pakai vault rehearsal buat eksperimen — agent-nya sudah dicabut permanen, semua panggilan agent di situ revert `Refused_AgentRevoked`.

---

## 9. Referensi

- `docs/CONTRACTS.md` — alamat + selector + resep curl
- `docs/abi/` — ABI siap import
- `docs/evidence/p0-guard-path-end-to-end.json` — bukti pertahanan berhasil
- `docs/evidence/p3-refusal-evidence.json` — bukti penolakan
- `docs/evidence/live-contract-function-sweep.json` — setiap fungsi diuji di chain

Ping gua kalau ada yang tidak jelas, atau kalau ada angka di UI yang tidak cocok dengan yang gua tulis di sini. Kalau tidak cocok, salah satu dari kita salah, dan lebih baik ketahuan sekarang.
