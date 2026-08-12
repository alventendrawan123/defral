# Panduan Tes Manual Frontend

**Ditulis 2026-08-12 · untuk `frontend/`**

Dokumen ini buat ngecek frontend pakai tangan, bukan lewat `bun run test`.
Tujuannya satu: **memastikan setiap angka di layar sama persis dengan yang ada
di chain.** Kalau beda, yang salah frontend-nya, bukan chain-nya.

---

## 0. Aturan emas

> Chain adalah sumber kebenaran. Kalau angka di UI tidak cocok sama `cast`,
> UI-nya yang salah. Itu inti seluruh argumen submission ini, jadi jangan
> pernah "dibenerin" dengan cara menyesuaikan angka di frontend.

---

## 1. Siapin dulu

```bash
cd frontend
bun install
bun run dev          # jalan di http://localhost:3000
```

**Backend tidak perlu dinyalain.** Ini pertanyaan pertama semua orang, jadi
dijawab di depan: frontend baca chain langsung pakai viem, tanpa perantara.

Fallback-nya tiga lapis, dan yang dipakai secara default adalah lapis kedua:

| Lapis | Kapan kepakai | Butuh backend? |
|---|---|---|
| Backend API | cuma kalau `NEXT_PUBLIC_API_URL` diisi | ya |
| **RPC langsung** | **default, tanpa env var apa pun** | **tidak** |
| Snapshot ter-commit | kalau RPC juga mati | tidak |

Jadi tanpa env var apa pun, semua angka di layar tetap datang dari chain
beneran. Backend cuma relevan buat §7.

⚠️ **Jangan pernah `rm -rf .next` atau jalanin `next build` selagi `bun run dev`
hidup.** Dua-duanya bikin dev server 404 di semua route sampai di-restart. Ini
sudah kejadian sekali dan makan waktu.

---

## 2. Cara baca kebenaran dari chain

Semua perbandingan di bawah dibandingkan ke sini. Jalanin ini dulu tiap kali
mau tes, karena state-nya berubah.

```bash
RPC=https://sepolia.base.org
V=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
O=0x44B94bb593F6De51Ad3385264C0168eEc8E56392

cast call $V "getPosition()((address,uint256,uint256,uint16,uint16,uint256,bool,uint256,uint80,bool))" --rpc-url $RPC
cast call $V "healthRatioBps()(uint16)"   --rpc-url $RPC
cast call $V "quoteGuardRepay()(uint256)" --rpc-url $RPC
cast call $V "couponDue()(uint256)"       --rpc-url $RPC
cast call $O "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $RPC
```

Urutan field `getPosition()`:

```
borrower, outstanding, collateralAmount, triggerBps, targetBps,
maxRepayPerEvent, couponSweep, reserve, lastActedRound, revoked
```

### Cara ngonversi angka mentah jadi angka layar

Ini bagian yang paling sering bikin salah baca.

| Yang dibaca | Desimal | Contoh mentah | Di layar |
|---|---|---|---|
| `outstanding`, `reserve`, `couponDue`, `quoteGuardRepay` (dUSD) | 6 | `2887500000` | `2,887.50 dUSD` |
| `collateralAmount` (dUST) | 18 | `10000000000000000000000` | `10,000 dUST` |
| harga oracle | 8 | `37100519` | `$0.37` |
| health, trigger, target, liquidation | basis point | `12849` | `128.49%` |

**`2887500000` itu dua ribu delapan ratus, bukan 2,8 miliar.** Bagi `1e6`.

---

## 3. State chain saat dokumen ini ditulis

Dipakai sebagai contoh. **Cek ulang pakai §2, jangan percaya tabel ini kalau
sudah beda hari.**

| Field | Nilai mentah | Artinya |
|---|---|---|
| `outstanding` | `2887500000` | 2.887,50 dUSD |
| `collateralAmount` | `10000e18` | 10.000 dUST |
| `reserve` | `0` | **habis, agent tidak punya amunisi** |
| `triggerBps` | `13000` | 130,00% |
| `targetBps` | `14500` | 145,00% |
| `maxRepayPerEvent` | `2000000000` | 2.000,00 dUSD |
| `lastActedRound` | `16` | sudah pernah dijaga beneran |
| `revoked` | `false` | agent masih aktif |
| `healthRatioBps` | `12849` | 128,49%, **di bawah trigger** |
| `quoteGuardRepay()` | `0` | nol karena reserve habis, **bukan karena sehat** |
| `couponDue()` | `0` | benar, belum ada akrual. Jangan dianggap error |
| oracle | round `16`, `37100519`, updatedAt `1786463936` | $0,37 dan sudah basi lebih dari 1 jam |

---

## 4. Tes per halaman

### 4.1 `/dashboard`, yang paling penting

Buka http://localhost:3000/dashboard

**Yang harus cocok sama chain:**

| Di layar | Dibandingkan ke |
|---|---|
| Angka besar di cincin | `healthRatioBps()` dibagi 100, jadi `12849` → `128.49%` |
| Debt | `outstanding` / 1e6 |
| Reserve | `reserve` / 1e6 |
| Collateral | `collateralAmount` / 1e18 |
| Would repay now | `quoteGuardRepay()` / 1e6 |
| Guard Trigger | `triggerBps` / 100 |
| Restore target | `targetBps` / 100 |
| Max repay per event | `maxRepayPerEvent` / 1e6 |
| Coupon due | `couponDue()` / 1e6 |
| Last price | harga oracle / 1e8 |
| Oracle round | `roundId` |

**Cek badge postur di panel "Price and posture".** Ini logika yang paling
gampang salah, urutan prioritasnya:

| Badge | Muncul kalau | Cek manual |
|---|---|---|
| `Authority revoked` | `revoked == true` | prioritas paling tinggi |
| `Price is stale` | umur oracle > `MAX_STALE` (3600 detik) | `now - updatedAt > 3600` |
| `Would defend now` | `quoteGuardRepay() > 0` | ada angka di "Would repay now" |
| `Reserve spent` | health < trigger **tapi** quote = 0 | reserve habis |
| `Armed and idle` | health >= trigger dan quote = 0 | posisi sehat |

🔴 **Ini bug yang pernah ada dan wajib dicek:** kalau `quoteGuardRepay()` nol
**dan** health di bawah trigger, badge **tidak boleh** bilang `Armed and idle`
atau bilang posisi ada di atas trigger. Nol di situ artinya *reserve habis*,
bukan *sehat*. Sekarang harus muncul `Reserve spent`, atau `Price is stale`
kalau oracle-nya kebetulan basi (stale menang duluan).

Cara maksa ngetes `Reserve spent` tanpa nunggu chain: lihat §6.

**Cek juga baris kecil di bawah "Price age":** harus nulis `Refused above 1h 0m`.
Itu `MAX_STALE` dari kontrak, bukan angka ketikan.

### 4.2 `/proof`, halaman bukti

Buka http://localhost:3000/proof

- **Entri paling atas wajib `NotAgent`**, yaitu transaksi si deployer sistem
  ditolak vault. Ini artefak terkuat yang kita punya, jadi posisinya nomor satu.
- Hitung entri: harus **7**. Tiga di antaranya `demo vault`, sisanya
  `rehearsal vault`. Setiap entri wajib nulis vault-nya yang mana.
- **Entri penolakan agent TIDAK BOLEH punya tombol BaseScan.** Harus nulis
  `no transaction exists for this refusal` plus `executionId` dan nama error
  kontraknya, misalnya `Refused_Healthy(19497, 13000)`.
- Cuma dua entri yang boleh punya link BaseScan: `NotAgent` dan defence yang
  berhasil di rehearsal vault.
- Klik dua link itu, harus kebuka di BaseScan dan statusnya cocok: satu
  `Fail` (NotAgent), satu `Success`.

⚠️ Transaksi yang sponsored: kolom `From` di BaseScan itu relayer KeeperHub,
bukan wallet kita. Aksi kita jalan sebagai internal call. Buka tab **Logs**.
Halaman `/proof` sudah nulis peringatan ini di bawah, pastikan masih ada.

### 4.3 `/`, landing

- **Capability Matrix**: 8 baris, tiap baris wajib punya bukti. Nol baris kosong.
- Baris penolakan agent: chip `execution record` + nama error + executionId, dan
  **tanpa** link transaksi.
- Baris `Withdraw your reserve` dan `Send your reserve to any other address`:
  harus nulis `no such function`.
- **Defence window**: garis trigger dan likuidasi harus cocok sama chain
  (`13000` dan `11000`), bukan angka hardcode.
- Di lebar layar `md` ke atas tampil sebagai tabel, di bawahnya jadi kartu.
  Kecilin browser buat ngetes.

### 4.4 `/vault`

- Semua nilai policy dibaca dari chain. **Tidak boleh ada tombol, slider, atau
  toggle apa pun** yang kelihatan bisa mengubah sesuatu. Frontend tidak pernah
  menulis ke kontrak.
- Baris `Last acted round`: kalau `lastActedRound > 0`, catatannya jangan bilang
  "never been defended".

### 4.5 `/connect` dan `/onboarding`

- `/connect`: tiga kunci terpisah (borrower, agent, deployer) plus penjelasan
  apa yang **tidak** bisa mereka lakukan.
- `/onboarding`: empat langkah, nilainya dibaca balik dari chain.

### 4.6 Halaman error

```
http://localhost:3000/halaman-yang-tidak-ada    → harus 404 yang dirancang, bukan layar putih
```

---

## 5. Tes parachute (paling penting buat penjurian)

Penjurian jalan berhari-hari setelah demo. Kalau RPC publik mati atau kena rate
limit, frontend **tidak boleh ikut mati**.

**Cara ngetes: putus internet, atau arahkan RPC ke alamat yang salah.**

```bash
# di frontend/.env.local
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org.invalid
```

Restart dev server, lalu buka `/dashboard`.

**Yang harus terjadi:**
- Halaman tetap tampil lengkap, tidak blank, tidak error.
- Muncul banner: *"The live node did not answer, so this is the committed
  snapshot..."* lengkap dengan nomor block.
- Angkanya sama dengan isi `frontend/docs/evidence/chain-snapshot.json`.

**Yang TIDAK boleh terjadi:** layar putih, pesan error mentah, atau angka
snapshot ditampilkan seolah-olah data live tanpa banner.

Jangan lupa balikin lagi env-nya setelah selesai.

---

## 6. Maksa state tertentu buat ngetes

Kadang chain-nya lagi tidak di kondisi yang mau dites. Cara paling aman:
**edit sementara `frontend/docs/evidence/chain-snapshot.json`**, lalu pakai
trik RPC salah di §5 supaya frontend dipaksa baca snapshot.

Contoh, mau lihat badge `Reserve spent`:

```jsonc
{
  "healthRatioBps": 12849,      // di bawah trigger
  "guardRepayQuote": "0",       // tidak ada yang bisa dibayar
  "position": { "reserve": "0", "triggerBps": 13000, ... },
  "oracle": { "updatedAtSeconds": <isi dengan waktu sekarang> }
}
```

`updatedAtSeconds` diisi `date +%s` biar oracle-nya dianggap segar, supaya
badge `Price is stale` tidak menang duluan.

🔴 **Setelah selesai, WAJIB balikin:**

```bash
cd frontend
node scripts/snapshot-chain.mjs   # regenerate dari chain beneran
git diff docs/evidence/chain-snapshot.json   # pastikan bersih
```

**Jangan pernah commit snapshot hasil edit tangan.** Seluruh nilai submission
ini ada di klaim bahwa angkanya nyata. Satu angka karangan yang ke-commit
merusak itu.

---

## 7. Mode backend (opsional)

Kalau backend jalan:

```bash
cd backend && pnpm dev:server     # :3001
```

Lalu di `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Urutan fallback-nya tiga lapis: **backend → RPC langsung → snapshot ter-commit**.

Cara mastiin lapisan mana yang kepakai: matikan backend, refresh, harusnya tetap
jalan lewat RPC tanpa banner apa pun. Matikan dua-duanya, baru banner snapshot
muncul.

⚠️ Catatan penting kalau nanti deploy: **backend di `localhost` tidak akan bisa
dijangkau dari server Vercel.** Fetch-nya gagal diam-diam lalu jatuh ke snapshot
tanpa pesan error. Jangan isi `NEXT_PUBLIC_API_URL` di production sebelum
backend punya URL publik.

---

## 8. Checklist cepat sebelum rekaman video

- [ ] `bun run lint` bersih
- [ ] `bun run type-check` nol error
- [ ] `bun run test` hijau (60 tes)
- [ ] `bun run build` sukses , **matikan dev server dulu**
- [ ] Enam route balik 200 semua
- [ ] Angka dashboard cocok sama `cast` (§2)
- [ ] Badge postur benar, bukan `Armed and idle` padahal di bawah trigger
- [ ] `/proof` dipimpin `NotAgent`, dan nol link BaseScan di baris penolakan agent
- [ ] Capability matrix 8 baris, nol baris tanpa bukti
- [ ] Parachute jalan (§5), lalu env dibalikin
- [ ] `git status` bersih, tidak ada snapshot hasil edit tangan

**Wajib diminta ke alven sebelum rekaman:** push NAV baru. Oracle basi lebih
dari satu jam bikin kontrak menolak bertindak sama sekali, dan itu mengubah apa
yang tampil di layar pas direkam.

---

## 9. Kalau ada yang tidak cocok

1. Jangan ubah angka di frontend biar cocok. Cari kenapa bedanya.
2. Cek desimalnya dulu (§2). Ini penyebab nomor satu.
3. Cek apakah halamannya lagi baca snapshot, bukan chain. Lihat banner-nya.
4. Ingat `revalidate = 30`, jadi data bisa telat sampai 30 detik. Refresh lagi.
5. Kalau memang frontend yang salah, itu bug. Catat angka `cast`-nya dan angka
   layarnya di laporan, biar bisa dibandingkan.
