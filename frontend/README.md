# Defral frontend

Next.js App Router, TypeScript, Tailwind, Zustand, Zod, Vitest. See the repository
root [README.md](../README.md) and [PROVENANCE.md](../PROVENANCE.md) first.

```bash
bun install
bun run dev
```

No environment variable is required. With `NEXT_PUBLIC_API_URL` unset the app
runs on committed fixtures and still tells the whole story, which is deliberate:
judging happens days after the demo, so a backend outage must not take the
submission down with it.

## Layout

```
src/
├── app/          one folder per route, each with a private _components/
│   ├── (landing)/_components/   container, hero, capability matrix, defence window, outcomes
│   ├── connect/_components/     container, borrower card
│   ├── dashboard/_components/   container, price chart, activity feed, stats, states
│   ├── onboarding/_components/  container, one file per step
│   ├── proof/_components/       container, evidence list
│   └── vault/_components/       container, collateral switch, reserve form, policy controls
├── components/ui/  shared primitives only
├── constants/    chain, protocol parameters, routes, and all user facing copy
├── hooks/        composition of store state and derived values
├── services/     API client, Zod schemas, fixtures, committed evidence archive
├── stores/       Zustand state and borrower actions
├── styles/       design tokens and global CSS
├── types/        shared types
└── utils/        pure helpers, health math lives here
docs/evidence/    committed JSON that /proof renders
```

Every `page.tsx` is three lines: it imports `Container` from its own
`_components/` and renders it. A route folder owns its components. Anything two
routes share moves to `components/ui/`, with one exception noted in the vault
folder.

## Rules that are enforced by tests

- No banned claim term appears in user facing copy, and no em dash appears anywhere.
- Every Capability Matrix row carries evidence. There are no empty rows.
- The health math matches the canonical demo numbers shared with the contracts
  and the agent: 16667 bps opening, 12667 under stress, 758.62 repaid, 14500
  restored, 14818 after the coupon sweep.

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Development server |
| `bun run lint` | ESLint |
| `bun run type-check` | `tsc --noEmit` |
| `bun run test` | Vitest |
| `bun run build` | Production build |
