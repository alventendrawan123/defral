# KeeperHub — setup akun & koneksi agent

Catatan setup org KeeperHub Defral. Ditulis 10 Agt 2026.
Semua di sini **bukan rahasia** — tidak ada API key, tidak ada private key, tidak ada
`hmacSecret`. Yang rahasia hidup di `SC/.env` (gitignored) dan `~/.keeperhub/wallet.json`.

Dashboard: <https://app.keeperhub.com>

---

## 1. `AGENT_EXECUTOR` — ambil dari `/api/user/wallet`, BUKAN dari CLI wallet

```bash
curl -s -H "Authorization: Bearer kh_..." https://app.keeperhub.com/api/user/wallet
```

```json
{
  "walletAddress": "0x5515844b92dd96c3298fd7d62fb87cee279f18d3",
  "organizationId": "4e1464a1-c918-451f-a730-4053c46b7653",
  "canExportKey": true,
  "isOwner": true,
  "walletId": "6f8232d0-c7fd-541d-95d6-7243a3942219",
  "createdAt": "2026-08-10T16:19:13.442Z"
}
```

**`0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3`** inilah `AGENT_EXECUTOR`, dan nilai yang
dibekukan sebagai `immutable agentExecutor` di setiap `DefralVault`. `organizationId`-nya
sama persis dengan org yang memiliki workflow (terbaca dari `/api/workflows`).

Di Base Sepolia alamat ini **EOA dengan delegasi EIP-7702**:

```
cast code 0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3
0xef0100955d84139e7621bc571b117d8eb5d28a4a222c6f
   ^^^^^^ designator 7702      ^^^ target delegasi
```

Itu sebabnya `require(msg.sender == agentExecutor)` tetap lolos meskipun gas-nya
disponsori: relayer cuma pengirim tx terluar, eksekusinya tetap *atas nama* akun ini.
Alamat ini juga sudah punya `nonce=1` — benar-benar pernah bertransaksi.

`canExportKey: true` — owner **bisa** mengekspor key enclave. Jangan pernah klaim
"kami tidak pernah pegang private key-nya". Framing yang benar: owner bisa mengekspornya,
dan itu tidak mengubah apa pun, karena vault cuma mengizinkan dua fungsi nol-argumen yang
keduanya membaca ulang oracle dan revert kalau posisi sehat.

### ⚠️ Jebakan: `keeperhub-wallet` menghasilkan wallet yang SALAH

```bash
npx -p @keeperhub/wallet keeperhub-wallet add    # JANGAN dipakai untuk AGENT_EXECUTOR
```

Perintah ini memanggil `POST /api/agentic-wallet/provision` dan **tidak butuh akun
KeeperHub** — dia membuat *subOrg berdiri sendiri* yang tidak tersambung ke organisasi
mana pun. Hasilnya di mesin ini:

```
subOrgId:      4fadf45f-e760-4e40-8ae2-6702d792cc89   <- BUKAN org 4e1464a1-...
walletAddress: 0xE36Af70EdD19f112BeefBeF582126af137704050
on-chain:      nonce=0, tanpa delegasi 7702, tidak pernah bertransaksi
```

Alamat yatim. Kalau dipakai sebagai `agentExecutor`, vault-nya **mati permanen** — field
itu immutable, dan wallet yang benar-benar mengeksekusi tidak akan pernah cocok.

Berlaku juga untuk `kh wallet add` / `kh wallet info --json` (CLI Go `kh` cuma pembungkus
tipis paket npm yang sama). `SC/plan.md` masih menyebut `kh wallet info --json` sebagai
sumber `AGENT_EXECUTOR` di beberapa tempat — **itu salah, perlu diperbaiki.**

File `~/.keeperhub/wallet.json` boleh dibiarkan; isinya tidak dipakai Defral. `hmacSecret`
di dalamnya tetap tidak pernah masuk `.env` maupun repo.

### Cara memastikan sendiri

```bash
cast nonce <addr> --rpc-url https://sepolia.base.org   # 0 = belum pernah eksekusi
cast code  <addr> --rpc-url https://sepolia.base.org   # 0xef0100... = delegasi 7702
```

Bukti paling kuat tetap empiris: panggil `Probe.sol` lewat KeeperHub, lalu baca
`lastCaller()`. Itu `msg.sender` yang sebenarnya, bukan yang didokumentasikan.

---

## 2. API key (`KEEPERHUB_API_KEY`)

Butuh akun + **2FA aktif** lebih dulu.

Settings → **API Keys** → tab **Organisation** → **Create New Key**. Ditampilkan sekali.

| Prefix | Tab | Fungsi |
|---|---|---|
| `kh_` | Organisation | REST API, MCP server, plugin Claude Code — **ini yang dipakai Defral** |
| `wfb_` | (user, default) | autentikasi webhook trigger saja |

Tertukar → 401. Dikirim sebagai `Authorization: Bearer kh_...`.

Key di-hash SHA256 di sisi server; cuma prefix-nya yang disimpan untuk identifikasi.

Jangan tebak URL langsung — `/settings/api-keys` dan `/settings` dua-duanya **404**.
Navigasi dari dalam app.

**Backend yang pegang key ini. Browser tidak pernah melihatnya** (lihat `BE/plan.md`).

### Terverifikasi live — 10 Agt 2026, 23:36 WIB

Key `defral-be` dibuat dengan "Full access", dan `GET /api/keys` melaporkan scope-nya:

```
scope: "mcp:read mcp:write mcp:admin"
```

Hasil probe dengan key itu:

| Endpoint | Status |
|---|---|
| `GET /api/keys` | 200 |
| `GET /api/workflows` | 200 |
| `GET /api/address-book` | **200** |
| `GET /api/user/wallet/balances` | **200** |
| `GET /api/keys` *tanpa* header Authorization | 401 |
| `GET /.well-known/x402` (tanpa auth) | 200 |

Dua baris tebal itu **bukti untuk `docs/TEARDOWN.md`**: issue #1869 mendaftarkan
`/api/address-book` dan `/api/user/wallet/balances` sebagai gap yang menolak `kh_` key.
Keduanya menerimanya hari ini. 401 pada kontrol tanpa auth membuktikan endpoint-nya memang
terproteksi, jadi 200 di atas bukan karena rute publik.

ID org yang terbaca dari `/api/workflows`:

```
organizationId: 4e1464a1-c918-451f-a730-4053c46b7653
```

---

## 3. Kuota eksekusi

Free tier: **5.000 eksekusi/bulan per organisasi**. Lewat itu $0.01/eksekusi dalam USDC
gasless (x402 di Base), ditarik dari org funding wallet. Tanpa kartu kredit — funding
wallet kosong berarti workflow berhenti, bukan menimbulkan tagihan.

Org funding wallet: `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3`
Cap bawaan: $5/hari, $50/bulan.

> Alamat funding wallet **sama dengan `AGENT_EXECUTOR`**. Satu wallet org, dua peran:
> menandatangani eksekusi on-chain, dan menjadi sumber USDC untuk biaya x402 kalau free
> tier terlampaui. Tidak ada konflik — biaya x402 ditarik off-chain oleh KeeperHub, sedang
> `msg.sender` di kontrak Defral tetap alamat yang sama.

Anggaran poll — deadline 13 Agt, penjurian 17-20 Agt:

| Interval | Eksekusi/hari | 10 hari | Muat di 5.000? |
|---|---|---|---|
| 60 detik | 1.440 | 14.400 | ❌ jebol di hari ke-3,5 |
| 5 menit | 288 | 2.880 | ✅ sisa 2.120 |
| 15 menit | 96 | 960 | ✅ lega |

**Pakai 5 menit saat idle.** Health posisi demo 16667 bps, trigger 13000 — harga cuma
bergerak kalau `PUBLISHER_KEY` yang mendorongnya, jadi polling rapat tidak menambah
keamanan apa pun. Rapatkan ke 60 detik hanya saat merekam demo.

Kuota habis sebelum penjurian = demo mati bukan karena kontraknya salah. Ini risiko nyata.

---

## 4. Sambungkan Claude Code (MCP)

MCP endpoint:

```
https://app.keeperhub.com/mcp
```

Tambah server:

```bash
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp
```

Lalu `/mcp` di Claude Code dan selesaikan sign-in browser.

Alternatif lewat plugin:

```
/plugin marketplace add KeeperHub/claude-plugins
/plugin install keeperhub@keeperhub-plugins
```

Restart Claude Code, lalu:

```
/keeperhub:login
/keeperhub:status
```

Catatan:

- Login MCP butuh sesi Claude Code **interaktif** (ada alur OAuth browser). Sesi headless
  atau cron tidak bisa.
- MCP ini akses **tulis**: agent yang tersambung bisa membuat dan mengubah workflow di org.
- Ada juga MCP anonim di `/mcp/public` yang mengembalikan `serverInfo` tanpa kredensial.

---

## Ringkasan nilai

| Item | Nilai | Rahasia? |
|---|---|---|
| Dashboard | `https://app.keeperhub.com` | tidak |
| MCP endpoint | `https://app.keeperhub.com/mcp` | tidak |
| organizationId | `4e1464a1-c918-451f-a730-4053c46b7653` | tidak |
| `AGENT_EXECUTOR` | `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3` | tidak |
| ~~wallet yatim~~ | ~~`0xE36Af70EdD19f112BeefBeF582126af137704050`~~ **jangan dipakai** | tidak |
| `KEEPERHUB_API_KEY` | `kh_...` | **ya** — `SC/.env` / BE env |
| `hmacSecret` | — | **ya** — `~/.keeperhub/wallet.json`, jangan disalin |
