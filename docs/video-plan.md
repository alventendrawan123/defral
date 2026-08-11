# Video Plan — Defral Demo

**Deadline:** Kamis 13 Agt 17:00 WIB  
**Target rekam:** Rabu 12 Agt, siang/sore  
**Durasi target:** 3–5 menit

---

## Persiapan sebelum rekam

### Checklist teknis (islakun)

- [ ] `cd backend && pnpm dev:server` jalan di port 3001
- [ ] `cd backend && pnpm dev:agent` dengan `LEDGER=keeperhub` jalan
- [ ] `cd frontend && pnpm dev` jalan di port 3000
- [ ] `frontend/docs/evidence/chain-snapshot.json` sudah diregenerasi (FIX-2)
- [ ] Dashboard menampilkan `source: 'chain'` (bukan snapshot banner)
- [ ] Backend `/health` return 200: `curl http://localhost:3001/health`

### Checklist chain (alven)

- [ ] Push NAV ke **1.00** sebelum rekam supaya posisi sehat untuk opening shot:
  ```bash
  cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
    "setPrice(int256)" 100000000 \
    --private-key $PUBLISHER_KEY \
    --rpc-url https://base-sepolia-rpc.publicnode.com
  ```
- [ ] Konfirmasi health demo vault ≥ 13000 setelah push
- [ ] Siap push NAV turun on camera waktu adegan rescue
- [ ] Pre-buka tab BaseScan untuk vault demo, oracle, dan token dUSD

### Checklist recording

- [ ] Resolusi 1080p minimum
- [ ] Browser zoom 100% (bukan 90% atau 110%)
- [ ] Terminal font size cukup besar untuk dibaca di video
- [ ] Tutup notifikasi OS
- [ ] Microphone test (kalau ada narasi)

---

## Shot list

Setiap klaim harus ada bukti chain dalam 10 detik. Jangan show UI tanpa artifact.

### Beat 1 — Opening (0:00–0:45)

**Screen:** Dashboard `http://localhost:3000/dashboard`

Yang ditampilkan:
- Health ratio — harus ≥ 13000 bps (posisi sehat)
- Outstanding debt
- Reserve balance
- Oracle price = $1.00, age < 1 jam
- Posture badge: "Armed and idle"
- Source: chain (bukan snapshot banner)

**Narasi:** *"This is the live position on Base Sepolia. The agent is armed and watching."*

---

### Beat 2 — Vault policy (0:45–1:15)

**Screen:** Vault page `http://localhost:3000/vault`

Yang ditampilkan:
- Reserve (berapa dUSD di wallet borrower)
- Trigger: 130.00%
- Target: 145.00%
- Max repay per event: 2,000 dUSD
- Agent: armed (not revoked)
- Copy: "Your reserve stays in your wallet"

**Narasi:** *"Two zero-argument calls. The contract knows what to do — no parameters, no destinations."*

---

### Beat 3 — Price dip (1:15–1:45)

**Screen:** Terminal (alven) + Dashboard split atau alt-tab

alven runs:
```bash
cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
  "setPrice(int256)" <calculated_dip_price> \
  --private-key $PUBLISHER_KEY \
  --rpc-url https://base-sepolia-rpc.publicnode.com
```

Dip price dihitung dari outstanding saat ini supaya health turun ke ~11500 bps.  
(Script `pnpm prove` menghitung ini otomatis — bisa pakai angka dari sana)

Yang ditampilkan:
- Tx hash di terminal
- Dashboard refresh → health turun, posture berubah ke "Would defend now"
- Oracle price menunjukkan harga baru

**Narasi:** *"Price dropped below the trigger. The defence window is open."*

---

### Beat 4 — Rescue (1:45–2:30)

**Screen:** Agent log (terminal islakun) + BaseScan

Agent log shows:
```
Price dipped X%. Repaid $Y from your reserve. Position safe. — Defral
```

Kemudian buka BaseScan tx dari KeeperHub execution:
- Buka **Logs tab** (bukan Overview)
- Tunjukkan `Rescued` event
- Fields: borrower, kind=1, amount, healthBefore, healthAfter, price, roundId
- `healthAfter` = 14500 (target)
- `From` = KeeperHub relayer (bukan borrower — gas disponsori)

**Narasi:** *"The agent fired automatically. Open the Logs tab — that's where the proof lives. From is the KeeperHub relayer, the action ran as an internal call."*

---

### Beat 5 — Proof page (2:30–3:15)

**Screen:** Proof page `http://localhost:3000/proof`

Yang ditampilkan:
- Entry #1: "The address that deployed the entire system is refused" — `NotAgent` tx on demo vault
- Entry #2: "A defence that landed" — rehearsal vault tx (label "rehearsal vault" visible)
- Entry #3–5: refusal execution records — no BaseScan button, only decoded error
- Entry #6: "The live demo vault refuses the agent when healthy" — `Refused_Healthy(19497, 13000)`
- Footer: "This page reads a JSON archive committed to the repository"

**Narasi:** *"Every entry ends in something permanent. The deployer of the entire system was refused. That's on the demo vault itself."*

Zoom in ke entry #1:
- Caller: deployer address
- Error: `NotAgent(0xe2d3B7...)`  
- BaseScan link → klik, show tx reverted

---

### Beat 6 — Non-custody proof (3:15–3:45)

**Screen:** BaseScan token tab

URL: `https://sepolia.basescan.org/token/0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838?a=0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3`

Yang ditampilkan:
- Agent EOA (`0x5515844...`) dUSD balance = **0**
- Tidak ada transfer masuk ke agent address

**Narasi:** *"The agent moved other people's money through gates it cannot widen, and kept none."*

---

### Beat 7 — API docs (3:45–4:00) *(opsional)*

**Screen:** `http://localhost:3001/docs`

Yang ditampilkan:
- Scalar UI
- Endpoints: `/api/position`, `/api/events`, `/api/executions/:id`

**Narasi:** *"The backend is documented and open."*

---

## Rules saat recording

1. **Jangan show UI tanpa artifact** — setiap klaim harus ada chain evidence dalam 10 detik
2. **Jangan show rehearsal vault tanpa label** — selalu ada copy "rehearsal vault" terlihat
3. **Jangan klik "View on BaseScan" untuk refusal** — tidak ada tx. Hanya show execution record + decoded error
4. **Kalau oracle stale saat rekam** — tunjukkan amber state dan narasi: *"This is the freshness gate. Above one hour the contract refuses to act by design."*
5. **Kalau dashboard show snapshot banner** — jangan panik, narasi: *"The RPC is catching up. The committed snapshot shows the last known state."*
6. **Jangan klaim "kami tidak pernah pegang private key"** — framing yang benar: *"The owner can export the key, and it changes nothing — the vault only accepts two zero-argument calls."*

---

## Backup plan

Kalau RPC down saat rekam:

- Frontend fallback ke committed snapshot otomatis — masih bisa show semua halaman
- BaseScan tab sudah pre-buka — navigasi langsung ke tx tanpa refresh
- `docs/evidence/prove-run-*.json` committed — proof page tetap jalan offline

Kalau KeeperHub slow:

- Agent log mungkin delay 30–60 detik setelah price dip
- Tetap di recording — tunggu sampai muncul, jangan cut
- Kalau > 2 menit, alt-tab ke BaseScan dan cari Rescued event manual

---

## Commit setelah rekam

Setelah video selesai, jalankan `pnpm prove` sekali lagi untuk fresh evidence:

```bash
cd backend && pnpm prove
```

Kemudian commit:
```bash
git add docs/evidence/prove-run-*.json
git commit -m "docs: add final prove run evidence before submission"
```

---

## Checklist final sebelum submit (Kamis 13 Agt pagi)

- [ ] Video ter-upload dan link aktif
- [ ] Repo public — test clone bersih: `git clone ... && cd backend && pnpm test`
- [ ] `forge test` green (alven konfirmasi)
- [ ] `pnpm test` 53/53 green (frontend)
- [ ] `pnpm test` 36/36 green (backend)
- [ ] Buka semua BaseScan links dari incognito — tidak ada yang 404
- [ ] Buka `http://localhost:3001/docs` — Scalar loads
- [ ] Buka `/proof` — semua entries terlihat, tidak ada "Block undefined"
- [ ] Agent EOA dUSD balance = 0 di BaseScan
- [ ] Zero code commits setelah freeze
