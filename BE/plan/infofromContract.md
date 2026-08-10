# Dari SC (alven) buat islakun — update 11 Agt, plus KOREKSI atas catatan 10 Agt

**Tanggal:** 2026-08-11 · **Menggantikan:** versi 10 Agt malam · **Prioritas:** 🔴 §1 mengoreksi hal yang bikin lo salah tulis error handling

Baca dokumen ini saja. Yang lama sudah tidak akurat di satu titik penting.

---

## 1. 🔴 KOREKSI — penolakan kontrak balik **HTTP 202**, bukan 400

Catatan 10 Agt bilang: *"call yang pasti revert → HTTP 400, nol `executionId`, nol apa pun buat di-poll"*, dan menyuruh lo nangkep non-2xx langsung setelah POST.

**Itu cuma benar untuk sebagian kasus.** Setelah `DefralVault` asli ter-deploy dan gua tembak beneran, hasilnya beda:

```
POST /api/execute/contract-call  { contractAddress: <vault>, functionName: "guardRepay", simulate: false }

HTTP 202
{ "executionId": "yjh4l0m4d9jgy7qtt6g6r",
  "status": "failed",
  "error": "Contract call failed: Refused_Healthy(16667, 13000)" }
```

**202, ada `executionId`, `status:"failed"`, dan custom error kontrak sudah ter-decode lengkap dengan argumennya.**

Bedanya dengan tes lama: probe 10 Agt pakai `Probe.boom()` yang isinya `revert("PROBE: boom")` — string revert biasa, di kontrak harness. Kontrak asli kita pakai **custom error** dan sudah **verified di BaseScan**. Jalur kodenya beda.

### Yang harus lo tangani: DUA bentuk kegagalan, bukan satu

```ts
// bentuk A — HTTP 2xx, tapi status failed (INI yang kena kontrak kita)
{ executionId: string, status: 'failed', error: string }

// bentuk B — HTTP 4xx, flat, tanpa executionId
{ error: string }
```

Kalau `assertTerminalSuccess` lo cuma jaga bentuk B, **penolakan agent kita akan lolos sebagai sukses** karena HTTP-nya 202. Itu bug diam yang paling mahal: dashboard bilang "agent bertindak", padahal kontrak menolak.

Saran konkret: cek `status !== 'completed'` **selalu**, tidak peduli kode HTTP-nya berapa.

### Satu lagi: endpoint status

`GET /api/execute/{executionId}` balik **405**, `GET /api/executions/{id}` balik **404**. Gua belum ketemu rute poll yang benar. Kabar baiknya, POST-nya sendiri sudah balik status terminal (`completed` / `failed`) di body — jadi buat Direct Execution lo mungkin tidak perlu polling sama sekali. Kalau lo nemu rute status yang benar, kabari, gua update dokumen ini.

---

## 2. ✅ Jalur guard SUDAH terbukti tembus, ujung ke ujung

Ini yang paling lo butuh tahu: **`guardRepay()` lewat KeeperHub berhasil di posisi hidup.**

```
NAV $1,00 -> $0,76   health 16667 -> 12667   (di bawah trigger 13000)

POST /api/execute/contract-call  guardRepay()
  -> 202 { executionId: "buxszjcotqofnaz5ixo7h", status: "completed" }

tx    0xb8f47a89115841e5d0176fd6cd3a0d8d9ec1141baaafde37c4ad11afb3a46c9e
      status 0x1, block 45307067, gasUsed 132484
      from  0xdcf4bac4...  <- relayer KeeperHub
      to    0x5af5194b...  <- entrypoint

utang   6.000,000000 -> 5.241,379310   (bayar 758,620690)
health  12667 -> 14500                 (tepat targetBps)
reserve turun persis 758,620690        (dari dompet borrower, bukan vault)
```

**Gas disponsori penuh.** Borrower tidak bayar, dan nonce agent EOA tidak bergerak — akunnya ter-delegasi EIP-7702, bukan bertransaksi langsung. Jadi jangan pakai nonce agent sebagai indikator "sudah eksekusi belum"; tidak akan pernah naik.

`sweepCoupon()` juga terbukti: `34evm46bd6wcpvtg1lkwa`, utang 5.241,379310 → **5.128,879310**.

---

## 3. Rekaman penolakan yang bisa lo pakai buat F2

Empat rekaman eksekusi asli, semua dari vault beneran:

| executionId | Panggilan | Hasil |
|---|---|---|
| `buxszjcotqofnaz5ixo7h` | `guardRepay()` posisi tidak sehat | `completed` + tx hash |
| `yjh4l0m4d9jgy7qtt6g6r` | `guardRepay()` posisi sehat | `Refused_Healthy(16667, 13000)` |
| `fh8e4y796hirzz6woa0pj` | `guardRepay()` round sama | `Refused_AlreadyActed(2)` |
| `1ewhomgsu2j8grqchsule` | `sweepCoupon()` tanpa kupon | `Refused_NoCouponDue` |
| `l280jtb9vhbwuoqrnpl4i` | `sweepCoupon()` kedua kali | `Refused_NoCouponDue` |

Dua dari lima membawa **angka hidup** di dalam pesan errornya. Itu jauh lebih kuat dari sekadar "gagal".

> ⚠️ **Penolakan tidak punya tx hash.** Jangan render link BaseScan untuk baris `failed`. Tidak ada yang di-broadcast.

---

## 4. Alamat — vault demo sudah ada sekarang

| Kontrak | Alamat |
|---|---|
| **DefralVault (demo)** | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| DefralVaultFactory | `0x1cbb29944ecfe0c5d8961f31bec296504615ac19` |
| MockLendingPool | `0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD` |
| NavOracle (dUST) | `0x44B94bb593F6De51Ad3385264C0168eEc8E56392` |
| NavOracle (mXAU) | `0x16c683d93e6a49B6E444E4c6b2bCE218b934AE11` |
| MockUSD (dUSD) | `0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838` |
| MockTreasury (dUST) | `0x0A72124d5e606aB4264a653B6942738CBAbd2D43` |
| MockTreasury (mXAU) | `0x8b45b4842b70031C1a43f129484A6d4e0f69454D` |

```
agentExecutor  0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3
borrower demo  0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2
NAV publisher  0x104bd087D5e4767370D8569A32B2DD986c3b1c4A
```

ABI ada di `docs/abi/*.json`.

> Vault `0x8E11A9a4...` itu rig rehearsal — sudah terpakai dan **agent-nya dicabut permanen**. Semua panggilan agent di situ revert `Refused_AgentRevoked`. Jangan masukkan ke konfigurasi apa pun.

---

## 5. Kuota eksekusi — ini bisa membunuh demo

Free tier **5.000 eksekusi/bulan per organisasi**.

| Interval poll | Per hari | 10 hari |
|---|---|---|
| 60 detik | 1.440 | **14.400 — jebol hari ke-3,5** |
| 5 menit | 288 | 2.880 ✅ |
| 15 menit | 96 | 960 ✅ |

Sekarang 11 Agt, penjurian 17-20 Agt. **Pakai 5 menit saat idle.** Rapatkan ke 60 detik cuma saat rekaman.

Health posisi demo 16667, trigger 13000. Harga cuma bergerak kalau `PUBLISHER_KEY` yang mendorongnya — jadi polling rapat tidak menambah keamanan apa pun, cuma membakar kuota.

Kalau kuota habis dan funding wallet kosong, workflow **berhenti**. Tidak ada tagihan, tapi demo mati. Detail di `docs/KEEPERHUB-SETUP.md`.

---

## 6. Yang masih berlaku dari catatan lama

**`web3/write-contract` (node action) TIDAK disponsori.** Beda dari `contract-call` / `check-and-execute` Direct Execution yang sponsored. Kalau W1-W4 pakai action node itu, agent EOA butuh native ETH sendiri. Sudah gua kirim 0.00005 ETH ke `0x5515844B...` waktu probing, jadi ada sedikit di sana.

**`Idempotency-Key` bekerja.** Replay dengan key yang sama balik `idempotentReplay: true` dan `executionId` yang sama, tanpa eksekusi ulang. Derivasi key lo aman dipakai apa adanya.

**`check-and-execute` dengan condition + action nol-argumen jalan bersih.** Arsitektur satu-vault-satu-borrower valid, tidak perlu redesign.

**Workflow event-triggered (W1, trigger `Event` → `AnswerUpdated`) belum pernah difire live.** Masih punya lo. Kalau perilakunya beda dari Direct Execution, kabari — gua update dokumen ini.

---

## 7. Perilaku kontrak yang harus BE hormati

**Kupon bisa nol, dan itu benar.** `couponDue()` membaca state ter-akrual, bukan rumus. Nol sampai penerbit memanggil `accrueQuarterlyCoupon()`. `Refused_NoCouponDue` **bukan error sistem** — jangan alert, jangan retry.

**Satu aksi per round oracle.** `guardRepay()` kedua di round yang sama balik `Refused_AlreadyActed(N)`. Jangan retry; tunggu round berikutnya. Retry cuma membakar kuota tanpa hasil.

**Sapu kupon berbatas.** Satu akrual mendanai tepat satu sapuan sebesar itu. Panggilan kedua di akrual yang sama revert. (Ini bug kritis yang ketemu waktu audit dan sudah ditambal — dulu 47 panggilan bisa menghapus seluruh utang tanpa satu token pun bergerak. Sekarang terbukti mati di kontrak live.)

**Desimal:** dUSD 6, dUST 18, harga oracle 8, health bps.

---

## 8. Status pengujian kontrak

Setiap fungsi di setiap kontrak sudah dipanggil di chain:

- **80 pembacaan**, 2 revert yang memang disengaja
- **31 tes otoritas**, semua lolos — termasuk `setPrice` oleh agent → `NotPublisher` (itu tesisnya, on-chain)
- **Semua jalur tulis** dijalankan sungguhan: `guardRepay`, `sweepCoupon`, `setPolicy`, `accrueQuarterlyCoupon`, `openGracePeriod`, `revokeAgent`, `liquidate`, `withdrawCollateral`, `transferPublisher`, `allowCollateral`, `setPriceFeed`
- **Foundry:** 47/47 hijau

Likuidasi diuji di posisi kurban berjaminan mXAU (feed terpisah), jadi posisi demo tidak pernah terancam. Angkanya cocok sampai wei: liquidator terima 9692,307692307692307691 mXAU, borrower kembali 307,692307692307692309, jumlahnya persis 10.000.

Detail: `docs/evidence/live-contract-function-sweep.json`.

---

## 9. Kalau butuh dari gua

- dorong NAV naik/turun kapan pun buat testing
- akrual kupon baru
- posisi/vault demo tambahan
- alamat atau ABI apa pun yang kurang

Ping saja. Yang gua **tidak** bisa: mem-broadcast transaksi revert dari agent. `guardRepay()` itu `onlyAgent`, dan satu-satunya pihak yang bisa menandatangani atas nama alamat itu — KeeperHub — menolak mem-broadcast panggilan yang dia prediksi revert. Itu sudah dites tiga jalur. Jangan buang waktu mencarinya.

---

## Referensi

- `docs/CONTRACTS.md` — alamat, selector, resep curl yang terbukti
- `docs/KEEPERHUB-SETUP.md` — akun, API key, kuota, MCP
- `docs/evidence/p0-guard-path-end-to-end.json` — pertahanan berhasil, ujung ke ujung
- `docs/evidence/probe-2b-revert-salvage.json` — kenapa penolakan tidak punya hash, dan apa gantinya
- `docs/evidence/live-contract-function-sweep.json` — setiap fungsi diuji di chain
