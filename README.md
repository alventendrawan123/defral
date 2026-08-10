# Defral

A loan position that defends itself, built on KeeperHub for Base Sepolia. An
autonomous agent watches the oracle and deleverages your position before it can
be liquidated, using a reserve that never leaves your wallet. This project reuses
work from an earlier Canton build by the same team, and the boundary between what
was carried over and what was written this week is documented up front in
[PROVENANCE.md](./PROVENANCE.md), including the one claim that did not survive
the move.

The agent has exactly two capabilities, both zero-argument, and the contract
refuses both while your position is healthy. It never becomes a liquidation.

Base Sepolia is a public chain. Every storage slot and every event log this
product writes is readable by anyone, and we make no privacy claim of any kind.

## Layout

| Path | What lives there |
|---|---|
| `SC/` | Solidity contracts, Foundry |
| `BE/` | Agent workflows and the KeeperHub integration |
| `frontend/` | Next.js App Router frontend |
| `frontend/docs/evidence/` | Committed execution archive that `/proof` reads |
| `frontend/agents/` | PRD, plan, and project rules |

## Running the frontend

```bash
cd frontend
bun install
bun run dev
```

It opens on http://localhost:3000 and tells the whole story on fixture data with
no backend configured. Point it at a live backend by setting `NEXT_PUBLIC_API_URL`
in `.env.local`; see `frontend/.env.example`.

```bash
bun run lint
bun run type-check
bun run test
bun run build
```

## Verification

Every claim on the site is meant to end in something you can open yourself.

- The Capability Matrix lists eight things the agent might do, with a transaction
  for each, or an explicit statement that the function does not exist in the ABI.
- `/proof` renders a JSON archive committed to this repository rather than a live
  API, so it keeps working after execution logs expire.
- The liquidation comparison shows the same price move against a guarded and an
  unguarded position.

Sponsored transactions do not appear in wallet history: the `From` column on the
explorer is the KeeperHub relayer and our action runs as an internal call. Open
the Logs tab.
