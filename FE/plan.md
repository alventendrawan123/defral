# FE — Plan Frontend (bima)

**Defral · KeeperHub Agents Onchain Hackathon · deadline 2026-08-13 17:00 WIB**
**React 19 · Vite · Tailwind 4 · Zustand · vitest**

> Dokumen ini ditulis supaya bisa dieksekusi langsung bareng Claude. Tiap task punya acceptance criteria.

---

## 0. Dua deliverable lo

Dua hal, dan yang kedua lebih penting dari kelihatannya:

1. **Produknya** — dashboard yang nunjukin posisi loan yang membela dirinya sendiri
2. 🎬 **VIDEO 3 MENIT** — dan **video ini yang menentukan kita masuk 10 finalis atau enggak**

> Riset lapangan: ~120 repo pesaing, **didominasi CLI dan README**. Kita punya UI polished + sistem komik hand-built + 13 panel `.webp` yang **nol tim lain punya**. Dan **finalis pitch LIVE 17-19 Agustus.**
>
> **Aset visual lo adalah keunggulan struktural. Pakai.**

---


---

## 0.5 Requirement yang lo tutup

PRD (`../PRD-defral.md`) menjawab **APA** dan **KENAPA**. Dokumen ini menjawab **GIMANA**.

> **Kalau keduanya bertentangan:** `plan.md` menang untuk **signature dan endpoint**; PRD menang untuk **perilaku dan batasan**. Kalau lo nemu pertentangan, lapor ke grup — bukan pilih sendiri.

Tiap requirement di bawah punya acceptance criteria di **PRD §10**. Kolom **Gap** menunjuk ke temuan audit Cermin di **PRD §6** yang requirement itu tutup.

| Req | Yang harus benar | Gap | Di plan ini |
|---|---|---|---|
| **F4** | Capability Matrix: tiap baris punya tx nyata **atau** pernyataan fungsinya tidak ada | — | §4.1 |
| **F3** | Posisi tak terjaga yang dilikuidasi, **berdampingan** dengan yang dijaga | G1 | §4.4 |
| **F5** | Halaman bukti baca **JSON statik ter-commit**, bukan API live | — | §4.3 |
| **B1** | UI menyatakan vault **tidak punya** `withdraw` — non-custody | G3 | §4.1 baris terakhir |
| **D3** | Dua kontrol UI yang dulu mati (`setGuardTrigger`, toggle sweep) **hidup lagi** | G7 | K4 |
| **D7** | **Dua** jaminan di UI — treasury (yield) dan emas (non-yield) | G10 | K5 |
| **D5** | Jaminan non-yield: panel sweep bilang "tidak berlaku", **bukan error** | G8 | K5 |
| **A1-A4** | UI menyampaikan batas otoritas agent, bukan klaim privasi | G11 | §3, §4.1 |
| **Goal 1** | Juri bisa memverifikasi batas otoritas **tanpa mempercayai kami** | — | §4.1, §5 video |
| **Goal 2** | Jalur borrower lengkap **tanpa menyentuh terminal** | — | §1.1 |

> 🔴 **Sebelum mulai: baca section ATURAN DESAIN YANG MENGIKAT** (paling bawah). Isinya keputusan yang sudah dikunci dari audit, dan melanggarnya berarti mengulang bug yang sudah kami temukan.

**Yang tidak ada di tabel ini bukan pekerjaan lo.** Kalau agent lo mulai ngerjain sesuatu yang tidak menutup satu pun baris di atas, hentikan.


## 1. Permukaan produk yang harus dibangun

Tidak ada yang perlu lo cari di folder lain. Stack: **React 19 + Vite + Tailwind 4 + Zustand + vitest**.

### 1.1 Screen

| Screen | Isi |
|---|---|
| `Landing` | Hero · **Capability Matrix** (§4.1) · **diagram Defence Window** (§K3) · panel komik |
| `Connect` | Sambung wallet / pilih demo borrower |
| `Onboarding` | Stepper: pilih collateral → pinjam → set reserve → set trigger |
| `BorrowFlow` | Pilih collateral (dUST **atau** mXAU) · jumlah · konfirmasi |
| `Dashboard` | **HealthRing** · PriceChart · ActivityFeed · reserve · kontrol policy |
| `Vault` | Set reserve (= `approve`) · set Guard Trigger · toggle Coupon Sweep |
| `Proof` | Halaman bukti (§4.3) — render `docs/evidence/*.json` |

### 1.2 Komponen inti

`HealthRing` (donut, warna per zona: hijau ≥ trigger, kuning di defence window, merah < 11000) · `PriceChart` (dengan garis `defensePrice` dan `protectionFloorPrice`) · `ActivityFeed` ("catatan Defral", first-person) · `CapabilityMatrix` · `ReceiptChip` · `DefenceWindow` · `AuthorityBadge` · `AddressPill` (`0x1234…abcd`) · `OnboardingStepper` · `Card` · `Toggle` · `ThemeToggle` · `NavBar`

### 1.3 🔴 `src/lib/health.ts` — turunan risiko. Ini aset produk nyata.

**Nol dashboard Aave punya angka ini.** Tulis persis:

```ts
/** Health Ratio dalam bps. 13000 = 130%. */
export function computeHealthRatioBps(collateralQty: number, price: number, debt: number): number {
  if (debt <= 0) return Number.POSITIVE_INFINITY;
  return Math.round((collateralQty * price / debt) * 10000);
}

/** DEFENCE PRICE — harga di mana agent akan fire.
 *  "Defral bertindak kalau harga menyentuh $0.78" */
export function defensePrice(collateralQty: number, debt: number, triggerBps: number): number {
  return (debt * triggerBps / 10000) / collateralQty;
}

/** PROTECTION FLOOR — harga terendah yang masih bisa diselamatkan reserve.
 *  Di bawah ini, Defral membuka grace period, bukan fire-sale.
 *  Selesaikan: (qty * p) / (debt - reserve) = triggerBps/10000 untuk p. */
export function protectionFloorPrice(
  collateralQty: number, debt: number, reserve: number, triggerBps: number,
): number {
  const maxRepayable = Math.min(reserve, debt);
  return ((debt - maxRepayable) * triggerBps / 10000) / collateralQty;
}

/** PROTECTION RUNWAY — persentase penurunan harga yang bisa diserap reserve
 *  dari harga sekarang sampai protection floor. Ini angka yang paling
 *  ditanya user: "gue tahan turun berapa persen?" */
export function protectionRunwayPct(currentPrice: number, floorPrice: number): number {
  if (currentPrice <= 0) return 0;
  return Math.max(0, (1 - floorPrice / currentPrice) * 100);
}

/** Berapa yang bakal dibayar agent kalau fire sekarang. */
export function computeGuardRepay(
  collateralQty: number, price: number, debt: number,
  targetBps: number, maxRepayPerEvent: number, reserve: number,
): number {
  const needed = Math.max(0, debt - (collateralQty * price * 10000) / targetBps);
  return Math.min(needed, maxRepayPerEvent, reserve);
}

/** Zona status buat warna ring. */
export function healthStatus(bps: number, triggerBps: number): "safe" | "defending" | "critical" {
  if (bps >= triggerBps) return "safe";
  if (bps >= 11000) return "defending";     // di dalam defence window
  return "critical";                        // bisa dilikuidasi
}
```

**Angka demo yang harus keluar** — sama persis dengan Solidity alven dan agent islakun:

| | |
|---|---|
| collateral 10.000 @ 1.00, utang 6.000 | **16667 bps** |
| harga 0.76 | **12667 bps** → repay **758.62** → **14500 bps** |
| kupon | **112.50** → utang **5128.88** → **14818 bps** |
| trigger 13000, reserve 1500 | defensePrice **0.78** · floor **0.585** |

### 1.4 State — Zustand `src/store.ts`

```ts
interface DefralState {
  position: PositionView | null;      // dari GET /api/position
  events:   RescueEventView[];        // dari GET /api/events
  executions: ExecutionView[];        // dari GET /api/executions  (receipt chip)
  priceHistory: PricePoint[];
  mode: "mock" | "live";

  // aksi borrower — tx wallet, BUKAN lewat KeeperHub
  openPosition(...): Promise<void>;
  setReserve(amount): Promise<void>;      // = dUSD.approve(vault, amount)
  setPolicy(trigger, target, cap, sweep): Promise<void>;
  revokeAgent(): Promise<void>;

  // aksi agent = TIDAK ADA. Agent yang eksekusi, bukan UI.
}
```

> 🔴 **`isBackendMode()` parachute — WAJIB ADA.** `npm run dev` tanpa `VITE_API_URL` harus tetap menceritakan **seluruh cerita** pakai data mock. Kalau KeeperHub down pas penjurian 17-20 Agt, ini yang nyelamatin demo.

### 1.5 Identitas visual

Lapangan ini (~120 repo) **didominasi CLI dan README**. UI yang polished adalah **keunggulan struktural**, dan **finalis pitch LIVE 17-19 Agustus**.

Bangun sistem "comic/ink": kartu bergaris tebal, halftone dot pattern, speech bubble buat suara Defral, burst animation pas rescue mendarat. Maskot yang **menonton** (idle) dan **melindungi** (rescue). Nada: neobank yang ramah, bukan terminal DeFi.

> Kalau waktu mepet: **potong maskot dan animasi, JANGAN potong Capability Matrix atau halaman Proof.** Dua itu yang bawa argumennya.

### Yang lo tulis

| File | Perkiraan | Bagian |
|---|---|---|
| `src/components/CapabilityMatrix.tsx` | ~180 | §4.1 |
| `src/components/DefenceWindow.tsx` | ~90 | §K3 |
| `src/components/ReceiptChip.tsx` | ~60 | §4.2 |
| `src/screens/Proof.tsx` | ~200 | §4.3 |
| `src/lib/health.ts` + test | ~150 | §1.3 |
| screen + komponen sisanya | ~1.200 | §1.1-1.2 |
| `PROVENANCE.md` + README | — | §4.5 |
| 🎬 **video 3 menit** | — | §5 |

## 2. Repo & commit hygiene (Minggu jam 0 — lo yang pegang)

```bash
git clone https://github.com/alventendrawan123/defral.git
cd defral/FE
npm create vite@latest frontend -- --template react-ts
cd frontend && npm i -D tailwindcss @tailwindcss/vite vitest && npm i zustand
npm run dev                      # → localhost:5173
```

**Seri commit lo: 08-10 → 08-12. JANGAN DI-SQUASH.**

> 🔴 **Kenapa commit hygiene penting di sini.** Defral berakar pada Cermin-RWA, project Canton yang tim ini kirim ke Build on Canton (Encode Club) bulan Juli. Repo itu punya **3 commit, semuanya 2026-07-20 — nol di dalam window hackathon ini.**
>
> Aturan DoraHacks **mengizinkan** reuse — sudah diverifikasi, nol klausa originality di ToS maupun di aturan KeeperHub, dan halaman Prizes malah bilang *"top three can come from anywhere, including the same topic area"*.
>
> Tapi yang bikin kita kehilangan shortlist adalah **kesan, bukan aturan.** Seri commit 08-10→08-12 di repo ini adalah **bukti** bahwa kerja KeeperHub-nya kerja hackathon ini. Itu sebabnya `PROVENANCE.md` (§4.5) ditaruh di paragraf pertama README — **disampaikan sebelum ada yang bertanya.**

## 3. 🔴 Klaim yang boleh dan tidak boleh dibuat

Ini bukan soal gaya penulisan. Ini soal **satu-satunya cara paling cepat kehilangan juri**.

### 3.1 Klaim privasi: DILARANG, tanpa pengecualian

Produk pendahulu kami — Cermin-RWA di Canton — punya privasi party-scoped yang **nyata**: reserve borrower dan tiap rescue secara struktural tidak terlihat oleh lending pool. README-nya menulis *"impossible to replicate on a public EVM chain."*

**Kalimat itu benar, dan justru karena benar ia tidak ikut pindah.** Di Base Sepolia setiap storage slot dan setiap event log terbaca dunia.

| ❌ Jangan pernah tulis | Kenapa |
|---|---|
| "private", "shadow", "invisible", "hidden", "no one can see" | Salah di chain publik. Juri buka BaseScan, selesai |
| "encrypted", "confidential" | Tidak ada enkripsi di sini |
| Sinyal ZK / private mempool "coming soon" | Mengklaim privasi yang belum dibangun = cara tercepat kehilangan juri teknis |
| Pengganti yang "mirip privasi" | Melemahkan klaim lebih buruk daripada menghapusnya |

**Yang menggantikannya adalah BATAS OTORITAS** (PRD §4) — dan itu justru **lebih kuat** di chain publik, karena pihak ketiga bisa memverifikasinya sendiri tanpa mempercayai kami.

### 3.2 Framing pengganti: TEMPORAL

| ✅ Pakai ini | Kenapa jalan |
|---|---|
| *"Ia tidak pernah menjadi likuidasi"* | Benar, bisa diverifikasi, dan itu memang produknya |
| *"Anda tidur melewatinya"* | Manfaat nyata, nol klaim teknis |
| *"Agent kami mencoba mengambil uang saat posisi Anda sehat. Chain menolak. Ini hash-nya."* | **Kalimat terkuat yang kita punya.** Bisa diklik |
| *"Kami tidak pernah memegang cadangan Anda — tidak ada fungsinya"* | Harfiah benar, diverifikasi satu `grep` |

Plus satu baris jujur di suatu tempat yang terlihat: **Base Sepolia itu publik.**

### 3.3 Satu kalimat yang WAJIB ada — biaya nol

> *"Di bawah protection floor, saya membuka grace period, bukan fire-sale — tidak ada likuidasi paksa di sini."*

Ini caption chart, first-person, suara Defral. **Satu string yang membedakan Defral dari 14 liquidation guardian di hackathon yang sama.** Jangan hilang.

### 3.4 Suara produk

First-person, dari sisi Defral, ke borrower. Bukan pasif, bukan korporat.

| ❌ | ✅ |
|---|---|
| "Repayment executed successfully" | *"Harga turun 24%. Saya bayar $758.62 dari cadangan Anda. Posisi aman."* |
| "Health factor is nominal" | *"Diperiksa jam 03.20. Sehat. Tidak ada tindakan."* |
| "Insufficient reserve" | *"Cadangan Anda tidak cukup untuk menutup ini. Saya buka grace period dan memberi tahu pool."* |

> Notifikasi **no-op** itu intinya, bukan noise. *"Diperiksa. Sehat. Tidak ada tindakan."* — **itu membuktikan gerbangnya bekerja, tiap siklus.**

### 3.5 Istilah — pakai yang benar sejak awal

| ❌ | ✅ | Kenapa |
|---|---|---|
| "auto-rebalancing" | **"autonomous deleveraging"** | Yang dibangun mengecilkan **penyebut** dan tidak pernah menyentuh pembilang. "Rebalancing" ngundang juri nanya *"antar leg apa?"* |
| "vault", "shadow vault" | **"cadangan" / "reserve"** | Kita tidak punya vault yang memegang uang — itu inti non-custody-nya |
| "bot" | **"agent"** | Konsisten dengan bahasa hackathon |

---
## 4. Yang dibangun baru

### 4.1 🔴 Capability Matrix — pengganti Privacy Matrix

Komponen `<table>` responsif yang **sama persis** (table di md+, card stack di bawah). Cuma barisnya yang ganti. **Tiap sel bawa `transactionLink` NYATA.**

| Bisakah agent… | | Bukti |
|---|---|---|
| Baca health ratio lo | ✅ YA | `tx` |
| Bayar utang lo dari reserve saat TIDAK sehat | ✅ YA | `tx` |
| Bayar saat posisi SEHAT | ❌ **TIDAK PERNAH** | **tx reverted** `verified ✓` |
| Bertindak pada oracle basi | ❌ **TIDAK PERNAH** | **tx reverted** `verified ✓` |
| Bertindak lagi di round harga yang sama | ❌ **TIDAK PERNAH** | **tx reverted** `verified ✓` |
| Bertindak setelah lo revoke | ❌ **TIDAK PERNAH** | **tx reverted** `verified ✓` |
| Kirim reserve lo ke alamat lain | ❌ **TIDAK ADA FUNGSINYA** | tabel ABI |
| **Menarik reserve lo** | ❌ **TIDAK ADA FUNGSINYA — kami tidak pernah memegangnya** | non-custodial |

> 🔴 **Baris terakhir harfiah benar.** Defral **non-custodial**: reserve lo tetap di wallet lo. Reserve = `min(balanceOf, allowance)`. Vault tidak punya `topUp()`, tidak punya `withdraw()`. **Itu bukan kalimat marketing — itu ketiadaan fungsi di ABI.**

### 4.2 Receipt chip
Tiap kartu rescue dapat chip status dari `GET /api/executions`:
`verified ✓` (hijau) · `reverted` (merah, **dan ini BAGUS** kalau di baris penolakan) · `unconfirmed` (kuning) · `sponsored` (badge terpisah)

### 4.3 Halaman `/proof`
Render `docs/evidence/*.json`: tiap baris = nama serangan · `executionId` · `Idempotency-Key` (hex penuh) · hasil simulate (`wouldRevert` + `revertReason`) · hasil broadcast · `transactionLink` · `gasUsed` · `receiptStatus`.

> ⚠️ **Baca dari JSON statik yang ter-commit, JANGAN dari API live.** Juri menilai 17-20 Agt, tx kita 11-12 Agt, retensi log free-tier tidak terverifikasi. **Halaman ini harus tetap hidup walau KeeperHub kehilangan log kita.**

### 4.4 🔴 Beat baru — "inilah yang terjadi tanpa Defral"

Demo punya **posisi kedua yang TIDAK dijaga**. Harga turun sama → siapa pun panggil `pool.liquidate()` → **collateral benar-benar disita**.

Render **side-by-side**:

| | Tanpa Defral | Dengan Defral |
|---|---|---|
| NAV 1.00 → 0.76 | | |
| Hasil | 🔴 **`Liquidated`** — collateral disita | 🟢 **`Rescued`** — 758.62 dibayar |
| | `tx` | `tx` |

**Juri klik dua transaksi: satu kehilangan collateral, satu tidak.** Taruhan berhenti jadi klaim.

### 4.5 `PROVENANCE.md` + README

Provenance **di paragraf pertama README**, sebelum ada yang nanya. Draf lengkapnya ada di PRD PRD §11 — copy dari sana.

Intinya: apa yang dibawa dari build Canton · apa yang ditulis baru minggu ini · **dan yang hilang, tanpa pura-pura sebaliknya** (klaim privasi tidak selamat; kami menggantinya, bukan mereplikasinya).

Plus section **"Apa yang nyata vs apa yang mock"**.

> 🔴 **Deskripsi GitHub harus ditulis ulang memimpin dengan KeeperHub.** Repo lama masih masarin "Build on Canton Hackathon (Encode Club)" di tagline-nya sendiri.

---

## 5. 🎬 VIDEO — 3:00. Ini deliverable terpenting lo.

> **Aturan produksi yang mengikat: nol beat menampilkan UI tanpa transaksi di sebelahnya. Tiap klaim berakhir di BaseScan dalam 10 detik. Beat yang tidak bisa berakhir di BaseScan — dipotong.**

| Waktu | Beat |
|---|---|
| **0:00-0:22** | 🔴 **COLD OPEN — agent kami mencoba mencuri.** Nol judul, nol problem statement. Terminal: `npm run prove`. Voice-over kalimat pertama: *"Ini agent kami sedang mencoba mengambil uang yang tidak boleh diambilnya."* → `wouldRevert: true`, `revertReason: "Refused_Healthy"` → broadcast → **BaseScan Status: Fail.** *"Itu transaksi nyata di Base Sepolia. Agent kami mencoba. Chain menolak. Anda bisa mengklik hash itu sekarang."*<br>**(14 tim buka dengan grafik health factor turun. 20 detik pertama satu-satunya kesempatan mematahkan pattern-match.)** |
| 0:22-0:48 | **TESIS.** Diagram statis tiga kunci: publisher (gerakkan NAV — bukan milik agent) · borrower (reserve, **di wallet sendiri**) · Turnkey EOA (**`GUARD_ROLE` saja, kami tidak pernah pegang private key-nya**). *"Agent ini punya dua fungsi atas uang Anda. Keduanya nol argumen. Dan uangnya tidak pernah meninggalkan dompet Anda."* Split-screen 4 detik: `kh wallet info --json` vs BaseScan `agentExecutor()` — alamat sama, **nol komentar** |
| 0:48-1:30 | **RESCUE.** Ring 16667 hijau → `setPrice(0.76)` **kunci publisher** → ring merah 12667 → body `check-and-execute` ditampilkan penuh → poll → **BaseScan Success**, event `Rescued`, **758.62, 12667→14500**. Tutup: `getPosition()` → `5241.38`. *"Angka itu sama persis dengan test suite yang kami tulis untuk ledger berbeda tiga minggu lalu."* |
| **1:30-1:52** | 🔴 **BEAT BARU — taruhannya.** Posisi kedua, tidak dijaga, harga sama. Siapa pun panggil `liquidate()`. **Collateral disita, tx di BaseScan.** *"Ini yang terjadi tanpa Defral. Dua transaksi, harga yang sama, hasil yang berbeda."* |
| 1:52-2:22 | **NEGATIVE CONTROL.** Double-fire → `Refused_AlreadyActed`. Revoke (borrower tekan tombol, tx viem **bukan** KeeperHub) → `Refused_AgentRevoked` — *"Uang Anda sekarang hanya bisa bergerak ke Anda."* Lalu tabel ABI: *"Serangan ini tidak punya transaksi karena tidak ada yang bisa dikirim."* Penutup: *"Reverted transaction adalah transaction. Punya hash, membakar gas, permanen. Itu sebabnya kami membakar gas untuk gagal."* |
| 2:22-2:46 | **RELIABILITY.** #1840 side-by-side: derivasi docs → 3 replay, `idempotentReplay: true` disorot, **nol tx**; derivasi kami → key baru, tx mendarat. Lalu `OVERLAP_GUARD=off` → 6 submit duplikat → `lastActedRound` onchain nangkep 5 |
| 2:46-3:00 | **PROVENANCE, diucapkan sendiri.** Scroll `PROVENANCE.md`. *"Health math, decision loop, dan UI ini dibangun untuk hackathon Canton di Juli. Contract, integrasi KeeperHub, reliability layer, dan seluruh yang baru saja Anda tonton gagal — ditulis minggu ini. Klaim privasi Canton kami tidak ikut pindah, dan kami menghapusnya alih-alih melemahkannya."* Frame akhir statis 4 detik: link sukses + link liquidation + 2 link reverted |

### ⚠️ Wajib ada teks di layar saat buka BaseScan
> *"tx ini sponsored — kolom `From` adalah relayer KeeperHub, aksi kami berjalan sebagai internal call, jadi tidak muncul di riwayat wallet. Yang di-link adalah `transactionLink` dari KeeperHub."*

**Tim yang gak tahu ini bakal nautin wallet history kosong dan terlihat seperti mockup.**

---

## 6. Jadwal

### MINGGU 10 AGT — nol blocker, mulai sekarang
1. Repo + commit import (§2)
2. Purge copy Canton + `AddressPill` (§3)
3. **Capability Matrix** shell dengan fixture data (§4.1) — 8 baris, tiap baris punya slot bukti
4. **Jam 3+:** alven serahkan alamat stub → sambungkan ke alamat nyata

### SENIN 11 AGT
Capability Matrix melawan **data nyata**, tiap sel bawa `transactionLink` · Receipt chip (§4.2) · Halaman `/proof` (§4.3) · **Mulai tulis shot list video**

### SELASA 12 AGT
| Jam | |
|---|---|
| 09-12 | Halaman bukti final + beat side-by-side liquidation (§4.4) + rapikan untuk rekaman |
| 12-13 | README + **Provenance di paling atas** (§4.5) |
| 13-14 | **DRESS REHEARSAL** — semua nonton, tandai shot list |
| **14-16** | 🎬 **REKAM VIDEO.** Satu take penuh, review, satu re-take. **Jangan lebih dari dua** |
| 16-17 | **Deskripsi GitHub ditulis ulang memimpin dengan KeeperHub, bukan Canton** |
| 17-19 | 🔴 **SUBMIT** — upload video. **Selesai 19.00, bukan tengah malam** |

---

## 7. Definition of Done

- [ ] Nol string "Canton" di UI (kecuali section Provenance yang memang sengaja)
- [ ] Nol string terlarang §3.1 di seluruh UI (`private`, `hidden`, `invisible`, `encrypted`, `shadow`)
- [ ] Tiap baris Capability Matrix bawa `transactionLink` nyata atau *"TIDAK ADA FUNGSINYA"*
- [ ] Receipt chip render `verified` / `receiptStatus` / `sponsored`
- [ ] `/proof` baca **JSON statik ter-commit**, bukan API live
- [ ] Beat side-by-side liquidation ada, dua tx bisa diklik
- [ ] Parachute `isBackendMode()` masih jalan
- [ ] Kalimat grace-period §3.3 ada di chart, first-person
- [ ] `PROVENANCE.md` ditautkan dari **paragraf pertama** README
- [ ] Deskripsi GitHub memimpin dengan KeeperHub
- [ ] 🎬 **Video ≤3:00, tiap klaim berakhir di BaseScan dalam 10 detik**
- [ ] Video bisa diputar dari **incognito**
- [ ] `pnpm test` hijau (suite frontend yang diwarisi harus tetap lulus)

---

---

---

## 8. 🔴 ATURAN DESAIN YANG MENGIKAT — turunan audit Cermin

Tujuh aturan di bawah ini **bukan saran**. **K1 adalah pole terpanjang di frontend dan tidak ada yang menyangkanya — baca duluan.**


### K1. 🔴🔴 COPY PRIVASI DI-PIN OLEH TEST. Lo bakal ketemu test merah.

**Ini pole terpanjang di frontend dan gak ada yang nyangka.** Pas lo purge copy privasi (§3), test yang diwarisi **GAGAL**:

| Test | Yang di-pin |
|---|---|
| `Landing.test.ts` | assert **nol** string terlarang §3.1 muncul di render |
| `strategies.test.ts` | assert **tiap** string suara Defral first-person (§3.4) |
| `CapabilityMatrix.test.ts` | assert **tiap** baris punya `transactionLink` **atau** pernyataan fungsi-tidak-ada — nol baris kosong |

**Update test-nya bareng copy-nya, dalam commit yang sama.** Jangan skip test — juri jalanin `pnpm test`.

### K2. Copy pengganti — framing TEMPORAL, jangan pernah selective-disclosure

| Opsi | Verdict |
|---|---|
| **Temporal** — *"ia tidak pernah menjadi likuidasi"*, *"Anda tidur melewatinya"* | ✅ **PAKAI INI** |
| Selective-disclosure — nyinggung ZK / private mempool | ❌ **JANGAN.** Mengklaim privasi yang belum dibangun, di chain yang tidak punya privasi, adalah **cara tercepat kehilangan juri yang membuka BaseScan** |

Plus satu baris jujur: **Base Sepolia itu publik.**

### K3. 🔴 Diagram DEFENCE WINDOW — taruh di Landing, ini penjelas produk terbaik

```
16667 bps ← posisi lo sekarang
          │
13000 bps ← Guard Trigger — agent bertindak di bawah ini
          │   ◀━━━━ DEFENCE WINDOW (2000 bps)
          │         Seluruh tugas reserve: jaga lo keluar dari sini
11000 bps ← LIKUIDASI — siapa pun boleh menyita collateral lo
```

**`11000 bps` ADALAH "$110 lawan $100".** Itu model mental tim sendiri, dirender persis. **Menjelaskan produk ke juri dalam lima detik.**

### K4. 🔴 `setGuardTrigger` dan toggle Coupon Sweep — HIDUPKAN LAGI

Di Cermin, `GuardPolicy` **immutable** (nol choice), jadi dua kontrol yang sudah ter-ship diam-diam tidak melakukan apa-apa: `setGuardTrigger` no-op di live mode, dan toggle Coupon Sweep disembunyikan.

Kontrak EVM punya **`setPolicy()`**. **Dua kontrol yang sudah ter-ship dan terlihat itu jadi hidup.** Buang cabang no-op, buang kondisi yang nyembunyiin.

### K5. Collateral kedua di UI — bukti klaim "dalam bentuk apapun"

Kontrak daftarin **dua** collateral: `dUST` (treasury, yield) dan **`mXAU` (emas, non-yield)**.

Tunjukin **engine yang sama** melindungi dua-duanya. Buat emas, panel Coupon Sweep bilang *"instrumen ini tidak membayar yield — sweep tidak aktif"* — **bukan error, bukan disembunyikan.**

### K6. Copy: "auto-rebalancing" → **"autonomous deleveraging"**

Ganti di semua copy. Yang dibangun mengecilkan penyebut dan tidak pernah menyentuh pembilang.

### K7. Field yang gak akan pernah keisi — hapus dari UI

Di Cermin, `CollateralState` punya field `couponRateBps` dan `maturity` yang **tidak pernah diisi dari backend** — live mode me-render seed mock (450bps, 2030) **seolah-olah itu state ledger, selamanya.** Jangan ulangi: setiap field yang ditampilkan harus datang dari kontrak, atau tidak usah ditampilkan.

`maturity` juga **dead field di Daml** — di-set 4 tempat, dibaca nol choice. **Hapus dari UI**, atau ambil beneran dari kontrak.

---

## 9. Prompt awal buat Claude lo

```
Baca dua dokumen ini lengkap, urut:
  1. D:\defral\PRD-defral.md   — APA dan KENAPA. Fokus §1 (write-up), §2 (masalah), §4 (tesis), §17 (FAQ).
  2. D:\defral\FE\plan.md      — GIMANA.

Requirement yang lo tutup: F3, F4, F5, B1, D3, D5, D7, plus Goal 1 dan Goal 2. Tabelnya di plan §0.5.

Urutan kerja:
  1. plan §3 — klaim yang boleh dan tidak boleh dibuat. BACA DULUAN, ini nentuin tiap string
     yang lo tulis setelahnya.
  2. plan §2 — repo + commit hygiene.
  3. plan §4.1 — Capability Matrix pakai fixture. Ini komponen paling penting di UI.
  4. plan §5 — video. Ini deliverable terpenting lo, dan shot list-nya sudah lengkap.

Baca plan §8 (ATURAN DESAIN YANG MENGIKAT).

Aturan keras:
- Nol string terlarang §3.1 di seluruh UI. Tulis test yang menegakkannya.
- Tiap baris Capability Matrix WAJIB punya bukti: transactionLink nyata, atau pernyataan
  eksplisit bahwa fungsinya tidak ada di ABI. Nol baris tanpa bukti.
- Halaman /proof baca JSON statik ter-commit, bukan API live. Juri menilai 17-20 Agt,
  transaksi kita 11-12 Agt, dan retensi log KeeperHub free-tier tidak terverifikasi.
- Video: nol beat menampilkan UI tanpa transaksi di sebelahnya.
```
