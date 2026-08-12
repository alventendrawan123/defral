# Defral Demo Video — Remotion project

Implements `docs/video-plan.md`. 3:30 (210s @ 30fps = 6300 frames), 1920×1080.

## Structure

```
video/
├── src/
│   ├── Root.tsx           # registerRoot, single composition "DefralDemo"
│   ├── Video.tsx           # scene orchestrator + SCENES timing table
│   ├── theme.ts             # colors/radius/shadow mirrored from frontend/src/styles/globals.css
│   │                         # + canonical demo numbers (DEMO.*) from docs/CONTRACTS.md
│   ├── scenes/
│   │   ├── 00-Intro.tsx       0:00–0:05   logo + tagline
│   │   ├── 01-Problem.tsx     0:05–0:25   Rina's problem, DefenceWindow ladder
│   │   ├── 02-Dashboard.tsx   0:25–0:55   dashboard recreation (health ring, oracle, position)
│   │   ├── 03-Vault.tsx       0:55–1:15   vault policy page recreation
│   │   ├── 04-PriceDip.tsx    1:15–1:40   split: cast send terminal + live health ring
│   │   ├── 05-Rescue.tsx      1:40–2:20   3 sub-beats: agent log → BaseScan Logs tab → ring update
│   │   ├── 06-Proof.tsx       2:20–3:05   3 sub-beats: proof overview → NotAgent tx → refusal record
│   │   ├── 07-NoCustody.tsx   3:05–3:25   agent EOA balance = 0
│   │   └── 08-Outro.tsx       3:25–3:30   logo + repo link
│   └── components/
│       ├── HealthRing.tsx     mirrors frontend/src/components/ui/HealthRing.tsx, animatable
│       ├── AddressPill.tsx    mirrors frontend/src/components/ui/AddressPill.tsx
│       ├── DefenceWindow.tsx  the 16667→13000→11000 bps ladder diagram
│       ├── Terminal.tsx       deterministic typewriter terminal (no wall-clock timers)
│       ├── BaseScanFrame.tsx  faithful BaseScan tx page recreation (Overview + Logs tabs)
│       ├── TxBadge.tsx        verified / reverted / execution-record status pill
│       └── Captions.tsx       reads public/captions/narration.srt, renders synced subtitle bar
└── public/
    └── captions/narration.srt   47-entry narration, timestamps match SCENES table exactly
```

## Why JSX recreation instead of screenshots

The plan called for `public/screenshots/*.png` captured from the live app. Since
this environment has no way to run `pnpm dev` + a browser + capture pixels,
every screen (dashboard, vault, BaseScan tx pages) is rebuilt in JSX using the
**real** design tokens (`theme.ts` mirrors `globals.css` exactly) and the
**real** canonical numbers, addresses, and tx hashes from `docs/CONTRACTS.md`
and `docs/evidence/prove-run-*.json`.

This has one advantage over screenshots: everything stays editable in Remotion
Studio, and numbers can't silently drift from a stale PNG.

If real screenshots are preferred for scenes 02/03 (Dashboard/Vault) or the
BaseScan frames, swap the JSX block for `<Img src={staticFile('screenshots/...')} />`
per `docs/video-plan.md` — the scene files are structured so this is a
localized change.

## Commands

```bash
cd video
npm i                        # already run
npx remotion studio          # live preview + timeline scrubbing
npx tsc --noEmit              # type check
npx eslint src                # lint
npx remotion still DefralDemo out/stills/check.png --frame=N --scale=0.5   # spot-check a frame
npx remotion render DefralDemo out/defral-demo.mp4 --codec=h264 --crf=18    # full render
```

## Verified checkpoints

12 still frames rendered and visually reviewed across the full timeline — every
scene composes correctly, no overlapping text, captions sync to the SRT
timestamps, refusal records never carry a BaseScan link (per the video rules
in `docs/video-plan.md`).

One layout bug was found and fixed during review: the Proof scene's scrolling
entry list was translating the whole scene (including the fixed header) instead
of a clipped inner viewport. Fixed by wrapping the scroll content in its own
`overflow: hidden` container.

## Not yet done

- No audio track (voice-over or music) — plan marks this optional
- Full render to MP4 not yet run (render takes several minutes; run when ready)
- Real screenshots not substituted for the JSX recreations (see above)
