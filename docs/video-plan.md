# Defral — Remotion Video Plan

**Hackathon:** KeeperHub Agents Onchain · DoraHacks  
**Deadline submit:** Kamis 13 Agt 17:00 WIB  
**Target selesai video:** Rabu 12 Agt 23:59 WIB  
**Durasi video:** **3 menit 30 detik** (210 detik)  
**Stack:** Remotion + React + Tailwind, render ke MP4 1080p

---

## Struktur Remotion project

```
video/
├── src/
│   ├── Root.tsx              # registerRoot, composition 210 detik 30fps
│   ├── Video.tsx             # <Sequence> orchestrator
│   ├── scenes/
│   │   ├── 00-Intro.tsx      # 0–5s   — logo + tagline
│   │   ├── 01-Problem.tsx    # 5–25s  — Rina's problem, defence window diagram
│   │   ├── 02-Dashboard.tsx  # 25–55s — screenshot/screencast dashboard
│   │   ├── 03-Vault.tsx      # 55–75s — vault policy page
│   │   ├── 04-PriceDip.tsx   # 75–100s — price dip animation + terminal
│   │   ├── 05-Rescue.tsx     # 100–140s — agent fires, BaseScan Logs tab
│   │   ├── 06-Proof.tsx      # 140–185s — proof page walk, NotAgent tx zoom
│   │   ├── 07-NoCustody.tsx  # 185–205s — agent EOA balance = 0
│   │   └── 08-Outro.tsx      # 205–210s — tagline + repo
│   ├── components/
│   │   ├── DefenceWindow.tsx  # animated bps diagram
│   │   ├── Terminal.tsx       # typewriter terminal output
│   │   ├── TxBadge.tsx        # "verified on BaseScan" pill
│   │   ├── Caption.tsx        # renders SRT captions per frame
│   │   └── AddressPill.tsx    # 0x… truncated address
│   └── captions/
│       └── narration.srt      # full narration, synced to scenes
├── public/
│   ├── screenshots/           # screenshot per scene (bima capture)
│   └── fonts/
├── remotion.config.ts
└── package.json
```

---

## Scene breakdown

Semua durasi dalam **detik**. FPS = 30. Frame = detik × 30.

### Scene 00 — Intro (0–5s · 150 frames)

**Visual:**
- Background hitam, logo "DEFRAL" fade in tengah
- Tagline muncul di bawah: *"A loan that defends itself."*
- Subtle glow animation pada teks

**Elemen Remotion:**
```tsx
<AbsoluteFill style={{ background: '#0a0a0a' }}>
  <spring> logo scale 0→1 </spring>
  <Sequence from={30}> tagline fade in </Sequence>
</AbsoluteFill>
```

---

### Scene 01 — The Problem (5–25s · 600 frames)

**Visual:**
- Teks: *"Rina borrowed $6,000 against $10,000 of tokenized Treasury."*
- Defence Window diagram animasi: garis dari 16667 turun ke 13000 → 11000
- Angka health ratio animate turun: 16,667 → 12,667
- Label: DEFENCE WINDOW (amber) dan LIQUIDATION (red)
- Teks: *"She was asleep."*

**Elemen Remotion:**
```tsx
<DefenceWindow
  from={healthBps}    // animates 16667 → 12667
  trigger={13000}
  liquidation={11000}
/>
```

**Key copy:**
> *"When price dips, there's a 2000 basis-point window between the guard trigger and liquidation. That window is the only job of the reserve."*

---

### Scene 02 — Dashboard Live (25–55s · 900 frames)

**Visual:**
- Screenshot dashboard `http://localhost:3000/dashboard`
- Zoom in ke health ring (166.67%)
- Highlight: "Armed and idle", oracle price $1.00
- Zoom ke AddressPill borrower + vault address
- Caption: *"Every number read from the vault contract on Base Sepolia. Not recomputed."*

**Asset needed:** screenshot `public/screenshots/dashboard-healthy.png`

**Elemen Remotion:**
```tsx
<Img src={staticFile('screenshots/dashboard-healthy.png')} />
<ZoomIn target="health-ring" from={25 * 30} />
```

---

### Scene 03 — Vault Policy (55–75s · 600 frames)

**Visual:**
- Screenshot vault page
- Zoom ke Reserve card: *"min(balance, allowance) — stays in your wallet"*
- Highlight policy: Trigger 130%, Target 145%, Max repay 2,000 dUSD
- Zoom ke "Agent: armed" badge

**Key copy:**
> *"Two zero-argument calls. The contract knows what to do. No parameters, no destinations."*

**Asset needed:** screenshot `public/screenshots/vault-policy.png`

---

### Scene 04 — Price Dip (75–100s · 750 frames)

**Visual:**
- Split screen: Terminal kiri + Dashboard kanan
- Terminal typewriter: `cast send ... "setPrice(int256)" 58982112`
- Tx hash muncul: `0x4bc491...`
- Dashboard refresh animation: health bar turun dari 16667 → 11500
- Posture badge berubah: "Armed and idle" → "Would defend now" (amber)
- Oracle price update: $1.00 → $0.59

**Elemen Remotion:**
```tsx
<Terminal lines={[
  '$ cast send 0x44b94bb... "setPrice(int256)" 58982112',
  '  --private-key $PUBLISHER_KEY',
  '  --rpc-url https://base-sepolia-rpc.publicnode.com',
  '',
  'blockHash: 0x4bc491317cd8...',
  'status: 1 (success)',
]} />
```

**Key copy:**
> *"The publisher key is separate from the agent key. The agent cannot push prices — it can only respond to them."*

---

### Scene 05 — Rescue (100–140s · 1200 frames)

**Visual (3 sub-beats):**

**Sub-beat A (100–115s):** Agent log terminal
```
Price dipped 41.02%. Repaid $Y from your reserve. Position safe. — Defral
```

**Sub-beat B (115–130s):** BaseScan tx
- Buka tx dari KeeperHub execution
- Highlight **Logs tab** (bukan Overview)
- Zoom ke `Rescued` event fields:
  - `borrower`: `0x0a25a...`
  - `kind`: 1 (guard-repay)
  - `healthBefore`: 11500
  - `healthAfter`: 14500
  - `From`: KeeperHub relayer (bukan borrower)

**Sub-beat C (130–140s):** Health ring update
- Ring animate: 11500 → 14500
- Caption: *"Landed exactly on target. Not near it — exactly on it."*

**Asset needed:**
- screenshot `public/screenshots/basescan-rescued-log.png`
- screenshot `public/screenshots/agent-terminal.png`

**Key copy:**
> *"The agent fired automatically. Open the Logs tab — that's where the proof lives. From is the KeeperHub relayer. The action ran as an internal call."*

---

### Scene 06 — Proof Page (140–185s · 1350 frames)

**Visual (3 sub-beats):**

**Sub-beat A (140–155s):** Proof page overview
- Screenshot `/proof` page
- Scroll animasi menampilkan semua 6 entries
- Footer visible: *"reads a JSON archive committed to this repository"*

**Sub-beat B (155–170s):** NotAgent tx zoom
- Zoom ke entry #1: "The address that deployed the entire system is refused"
- Caller: `0xe2d3B7...` (deployer)
- Error: `NotAgent(0xe2d3B7...)`
- BaseScan link → cut ke BaseScan reverted tx

**Sub-beat C (170–185s):** Refusal execution records
- Zoom ke entry "Refused_Healthy(19497, 13000)"
- Show: no BaseScan button, hanya decoded error
- Caption overlay: *"KeeperHub declines to broadcast a call it predicts will revert. No transaction exists. This is the execution record."*

**Asset needed:**
- screenshot `public/screenshots/proof-page-full.png`
- screenshot `public/screenshots/basescan-not-agent-tx.png`

**Key copy:**
> *"The deployer of the entire system — the address that owns the pool and holds every admin key — was refused. That's on the demo vault itself, permanent, and you can click it."*

---

### Scene 07 — Non-custody Proof (185–205s · 600 frames)

**Visual:**
- BaseScan token tab: `dUSD token, holder: 0x5515844...`
- Big number: **0 dUSD**
- Caption overlay: *"The agent moved other people's money through gates it cannot widen, and kept none."*
- Animate counter: money flowing through → balance stays at 0
- Cut ke: vault contract BaseScan → no withdraw() function in ABI

**Asset needed:**
- screenshot `public/screenshots/basescan-agent-balance-zero.png`

---

### Scene 08 — Outro (205–210s · 150 frames)

**Visual:**
- Background hitam
- Logo "DEFRAL" fade in
- Tagline: *"It never becomes a liquidation."*
- Bawah: `github.com/alventendrawan123/defral`
- Fade out

---

## Narration — full script (untuk .srt)

Urutan sesuai scene. Setiap baris adalah satu caption subtitle.

```
[00:00–00:05] Defral. A loan that defends itself.

[00:05–00:10] Rina borrowed six thousand dollars against ten thousand
              dollars of tokenized Treasury.

[00:10–00:17] When price dips, there's a two-thousand basis-point window
              between the guard trigger and liquidation.

[00:17–00:25] That window is the only job of the reserve.
              She was asleep.

[00:25–00:35] This is the live position on Base Sepolia.
              The agent is armed and watching.

[00:35–00:45] Every number here was read from the vault contract.
              Not recomputed. Not estimated.

[00:45–00:55] The reserve stays in your wallet.
              Setting it is an approve, not a transfer.

[00:55–01:05] Two zero-argument calls.
              The contract knows what to do.
              No parameters, no destinations.

[01:05–01:15] Trigger at one hundred thirty percent.
              Target at one hundred forty-five.
              Max repay: two thousand dUSD per event.

[01:15–01:25] The publisher key is separate from the agent key.
              The agent cannot push prices — it can only respond to them.

[01:25–01:40] Price dropped to fifty-nine cents.
              Health ratio: eleven thousand five hundred basis points.
              The defence window is open.

[01:40–01:55] The agent fired automatically.
              Open the Logs tab — that's where the proof lives.

[01:55–02:10] From is the KeeperHub relayer.
              The action ran as an internal call.
              Health: eleven thousand five hundred, to fourteen thousand five hundred.
              Landed exactly on target.

[02:10–02:20] The proof page reads a JSON archive
              committed to this repository.
              It keeps working even after execution logs expire.

[02:20–02:35] The deployer of this entire system —
              the address that owns the pool and holds every admin key —
              was refused.

[02:35–02:45] NotAgent. That's on the demo vault itself.
              Permanent. You can click it.

[02:45–02:55] KeeperHub declines to broadcast a call it predicts will revert.
              No transaction exists for a refusal.
              This is the execution record: the contract's own decoded error.

[02:55–03:05] The agent moved other people's money
              through gates it cannot widen,
              and kept none.

[03:05–03:15] Agent EOA: zero dUSD.
              No withdraw function.
              We never held it.

[03:15–03:30] Defral. It never becomes a liquidation.
              github.com/alventendrawan123/defral
```

---

## SRT file plan

File: `video/src/captions/narration.srt`

Format standar SRT:
```
1
00:00:00,000 --> 00:00:05,000
Defral. A loan that defends itself.

2
00:00:05,000 --> 00:00:10,000
Rina borrowed six thousand dollars against
ten thousand dollars of tokenized Treasury.

...dst
```

Total: **~28 caption entries** untuk 210 detik.

---

## Assets yang perlu disiapkan (bima)

Sebelum mulai coding Remotion, capture semua screenshot ini:

| File | URL | Catatan |
|---|---|---|
| `dashboard-healthy.png` | `localhost:3000/dashboard` | Health ≥ 13000, source: chain |
| `vault-policy.png` | `localhost:3000/vault` | Reserve, trigger, target visible |
| `agent-terminal.png` | Terminal islakun | Log setelah rescue |
| `basescan-rescued-log.png` | BaseScan tx Logs tab | healthBefore/After visible |
| `basescan-not-agent-tx.png` | BaseScan tx reverted | NotAgent error visible |
| `proof-page-full.png` | `localhost:3000/proof` | Semua 6 entries visible |
| `basescan-agent-balance-zero.png` | BaseScan token tab | Balance = 0 |

---

## Remotion tech spec

```
FPS: 30
Duration: 210 detik = 6300 frames
Resolution: 1920×1080
Format: MP4 H.264
Audio: narasi voice-over (opsional) atau musik background
Caption: <Caption> component reads narration.srt, interpolates per frame
```

### Dependencies

```bash
pnpm create video@latest   # atau pnpm add remotion @remotion/cli
pnpm add @remotion/player  # kalau mau preview di browser
```

### Composition setup

```tsx
// Root.tsx
import { Composition } from 'remotion';
import { DefralVideo } from './Video';

export const RemotionRoot = () => (
  <Composition
    id="DefralDemo"
    component={DefralVideo}
    durationInFrames={6300}   // 210s × 30fps
    fps={30}
    width={1920}
    height={1080}
  />
);
```

### Render command

```bash
npx remotion render src/index.ts DefralDemo out/defral-demo.mp4 \
  --codec=h264 \
  --crf=18 \
  --gl=angle
```

---

## Execution order (Rabu 12 Agt)

```
Pagi 09:00–10:00 — bima
  1. Capture semua screenshots (backend + frontend harus running)
  2. Run pnpm prove sekali — ambil agent log screenshot

Pagi 10:00–12:00 — bima
  3. pnpm create video@latest → setup project di video/
  4. Build Scene 00 (Intro) + Scene 08 (Outro) — 30 menit
  5. Build DefenceWindow component + animation — 45 menit
  6. Build Caption component dari narration.srt — 30 menit

Siang 12:00–15:00 — bima
  7. Build Scene 01 (Problem) dengan DefenceWindow
  8. Build Scene 02–03 (Dashboard + Vault) dari screenshots
  9. Build Scene 04 (Price Dip) — Terminal typewriter

Sore 15:00–18:00 — bima
  10. Build Scene 05 (Rescue) — 3 sub-beats
  11. Build Scene 06 (Proof) — zoom animations
  12. Build Scene 07 (Non-custody)
  13. Wire semua Sequence di Video.tsx
  14. Tulis narration.srt lengkap

Malam 18:00–20:00 — bima
  15. Preview di Remotion Studio
  16. Render MP4
  17. Upload + share link
```

---

## Aturan video yang tidak boleh dilanggar

1. **Setiap klaim harus ada chain artifact dalam 10 detik** — screenshot BaseScan atau execution record
2. **Jangan show rehearsal vault tanpa label** — selalu ada copy "rehearsal vault" visible
3. **Jangan render "View on BaseScan" untuk refusal** — tidak ada tx. Hanya decoded error
4. **Jangan klaim "kami tidak pernah pegang private key"** — framing yang benar: *"The owner can export the key, and it changes nothing."*
5. **Balance = 0 harus dari BaseScan langsung** — bukan angka di UI

---

## Risiko

| Risiko | Mitigasi |
|---|---|
| RPC down saat capture screenshot | Pakai `chain-snapshot.json` fallback — UI tetap jalan |
| Rescue belum ter-trigger saat capture | Jalankan `pnpm prove` — step 4 guaranteed trigger rescue |
| Remotion render lama | Mulai render paralel dengan final review, target malam Rabu |
| Screenshot resolusi tidak 1920px | Set browser zoom 100%, window maximize sebelum capture |
