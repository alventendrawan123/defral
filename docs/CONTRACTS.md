# Defral — kontrak live di Base Sepolia

Serah terima SC → BE/FE. Semua alamat sudah ter-deploy, terverifikasi, dan **sudah dibuktikan
jalan lewat KeeperHub** (lihat `docs/evidence/p0-guard-path-end-to-end.json`).

Chain: **Base Sepolia, `84532`** · Explorer: <https://sepolia.basescan.org>

---

## Alamat

| Kontrak | Alamat |
|---|---|
| **DefralVault (demo)** | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| DefralVaultFactory | `0x1cbb29944ecfe0c5d8961f31bec296504615ac19` |
| MockLendingPool | `0x35371ed6e29dde1fde4dbe8a6048ffb0c860b9ed` |
| NavOracle (dUST) | `0x44b94bb593f6de51ad3385264c0168eec8e56392` |
| NavOracle (mXAU) | `0x16c683d93e6a49b6e444e4c6b2bce218b934ae11` |
| MockUSD (dUSD, 6dp) | `0x9d9734fbb490b603a27f82ec0e23cdfdd9d6b838` |
| MockTreasury (dUST, 18dp, yield-bearing) | `0x0a72124d5e606ab4264a653b6942738cbabd2d43` |
| MockTreasury (mXAU, 18dp, non-yield) | `0x8b45b4842b70031c1a43f129484a6d4e0f69454d` |
| Probe (harness) | `0x530d16039a39dddd1dac290ee0c7e87af920e45b` |

Aktor:

| Peran | Alamat |
|---|---|
| **agentExecutor** (KeeperHub) | `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3` |
| borrower demo | `0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2` |
| publisher NAV | `0x104bd087D5e4767370D8569A32B2DD986c3b1c4A` |
| deployer / owner pool | `0xe2d3B7FEA35Ea3B7B8d530cfF58a8227ce62BFAD` |

> Ada vault **kedua** di `0x8E11A9a4f43271a37f75AFE6e64746A824A06094` (borrower =
> deployer). Itu rig rehearsal, sudah terpakai — utangnya sudah turun ke 5241,379310.
> **Jangan dipakai untuk demo.** Vault demo di atas masih perawan.

ABI: `docs/abi/*.json`.

---

## Yang dibaca FE / BE

Semua **nol argumen** — itu memang inti desainnya (satu vault satu borrower).

```
guardRepay()        0x12f9862e   onlyAgent, menulis
sweepCoupon()       (lihat ABI)  onlyAgent, menulis
healthRatioBps()    0x4ec19fd1   view, bps
quoteGuardRepay()   0x9cad9d2c   view, jumlah dUSD yang AKAN dibayar
couponDue()         0xc84648d4   view, kupon ter-akrual belum tersapu
reserve()           0xcd3293de   view, min(saldo, allowance) borrower
getPosition()       0x7398ab18   view, struct lengkap
lastActedRound()    0x34a63e2b   view, round oracle terakhir bertindak
agentExecutor()     0xfe18c798   view, immutable
```

`quoteGuardRepay()` adalah angka yang **wajib** ditampilkan FE sebagai pratinjau. Sudah
terbukti sama persis dengan yang benar-benar bergerak on-chain (758620690 diprediksi,
758620690 dibayar). Jangan hitung ulang di frontend — baca dari kontrak.

Desimal: **dUSD 6**, **dUST/mXAU 18**, **harga oracle 8**, **health dalam bps**.

---

## Cara memicu agent (terbukti jalan)

```bash
curl -X POST https://app.keeperhub.com/api/execute/contract-call \
  -H "Authorization: Bearer $KEEPERHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <unik-per-aksi>" \
  -d '{
    "contractAddress": "0x4f634d7173eFf255973E762c3Fe04DF4887FfB35",
    "chainId": 84532,
    "functionName": "guardRepay",
    "functionArgs": "[]",
    "simulate": false
  }'
```

Sukses → `202 { "executionId": "...", "status": "completed" }`, gas **disponsori penuh**
(relayer `0xdcf4bac4...` yang bayar, bukan borrower, bukan agent).

---

## 🔴 Tiga hal yang mengubah desain BE

### 1. KeeperHub TIDAK broadcast panggilan yang diprediksi revert

Diuji tiga jalur independen (`contract-call`, `check-and-execute` leg action,
`node/web3-write-contract`) — semuanya menolak sebelum broadcast. `simulate:false` tidak
mengubah apa pun. Detail: `docs/evidence/probe-2-revert-broadcast.json`.

**Artinya**: kalau desain workflow-mu mengandalkan "agent broadcast lalu chain menolak,
ada hash-nya di BaseScan" — itu tidak akan pernah terjadi lewat KeeperHub.

Yang lo dapat sebagai gantinya, dan ini sudah terbukti:

```json
{ "executionId": "yjh4l0m4d9jgy7qtt6g6r", "status": "failed",
  "error": "Contract call failed: Refused_Healthy(16667, 13000)" }
```

Rekaman eksekusi asli, dengan nama error kontraknya sendiri **beserta angka hidupnya**.
Tampilkan itu. Jangan janjikan link BaseScan untuk penolakan — tidak ada.

### 2. Kupon bisa nol, dan itu jawaban yang benar

`couponDue()` membaca state ter-akrual, bukan rumus. Nol sampai issuer memanggil
`accrueQuarterlyCoupon()`. `Refused_NoCouponDue` **bukan error** — itu perilaku benar.
Jangan tampilkan sebagai kegagalan sistem.

### 3. Kuota eksekusi 5.000/bulan

Poll 60 detik = jatah habis 3,5 hari, sebelum penjurian. **Pakai 5 menit saat idle.**
Perhitungannya di `docs/KEEPERHUB-SETUP.md`.

---

## Angka demo (sudah direproduksi on-chain)

| Tahap | Health | Utang | Aksi |
|---|---|---|---|
| Buka | 16667 | 6.000,000000 | — |
| NAV $1,00 → $0,76 | 12667 | 6.000,000000 | di bawah trigger 13000 |
| `guardRepay()` | **14500** | **5.241,379310** | bayar **758,620690** |
| `sweepCoupon()` | 14818 | 5.128,879310 | sapu **112,500000** |

Trigger 13000 · target 14500 · maxRepayPerEvent 2.000 · likuidasi 11000.

Angka baris 1-3 sudah dibuktikan on-chain di rig rehearsal, bukan hitungan di atas kertas.

---

## Cara membangkitkan dip

```bash
cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 "setPrice(int256)" 76000000 \
  --private-key $PUBLISHER_KEY --rpc-url https://sepolia.base.org
```

`76000000` = $0,76 (8 desimal). Balikkan dengan `100000000`.

Kunci publisher **terpisah** dari agent, dan itu bukan kerapian — itu tesisnya. Agent tidak
bisa menggerakkan harga yang dia baca.
