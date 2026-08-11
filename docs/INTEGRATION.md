# Defral — Integration Status
## Frontend × Backend × Smart Contract

> **Deadline:** Kamis 2026-08-13 · 17:00 WIB  
> **Updated:** Rabu 2026-08-12 · 00:30 WIB  
> **Chain:** Base Sepolia `84532`

---

## 1. Status sekarang (semua layer)

| Layer | Status | Owner |
|---|---|---|
| Smart Contract | ✅ Deployed, verified, live di BaseScan | alven |
| Backend agent | ✅ 36/36 tests green, berjalan dengan `LEDGER=keeperhub` | islakun |
| Backend HTTP server | ✅ Running di `:3001`, Scalar docs di `/docs` | islakun |
| Frontend | ✅ 53/53 tests green, terhubung ke backend | bima |
| Frontend ↔ Backend | ✅ `GET /api/position` + `GET /api/events` terwired | islakun |
| Prove chain | ✅ 8/8 steps green live di Base Sepolia | islakun |

**Yang masih pending (bima, Rabu pagi):**
- `chain-snapshot.json` regenerate dari backend live
- `proof-archive.json` tambah entry demo vault
- Backend `ALLOWED_ORIGIN` untuk production URL

Detail ada di `docs/FRONTEND-FIXES.md` dan `frontend/agents/plan/plan-v3.md`.

---

## 2. Arsitektur

```
NavOracle (Base Sepolia)
    │  price push (alven, publisher key)
    ▼
DefralVault ◄──── KeeperHub EOA (agentExecutor 0x5515...)
    │                     ▲
    │              KeeperHub REST API
    │                     ▲
    │              backend/agent/src/
    │              (guard loop, poll 5 menit)
    │              viem multicall reads
    │
    ▼
backend/src/index.ts (Express :3001)
    ├── GET /api/position   → multicall snapshot
    ├── GET /api/events     → Rescued event log
    ├── GET /api/executions/:id → KeeperHub proxy
    ├── GET /openapi.json
    └── GET /docs           → Scalar UI
              │
              ▼
    frontend (Next.js :3000)
    NEXT_PUBLIC_API_URL=http://localhost:3001
    ├── /dashboard   → loadVaultSnapshot() → /api/position
    ├── /vault       → loadVaultSnapshot() → /api/position
    └── /proof       → readProofArchiveLive() → /api/events
```

**Fallback chain (frontend):**
```
backend mode? → GET /api/position
    └── gagal → readVaultSnapshot() via viem RPC
                    └── gagal → readCommittedSnapshot() (chain-snapshot.json)
```

---

## 3. Addresses (Base Sepolia)

| Contract | Address |
|---|---|
| DefralVault (demo) | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| MockLendingPool | `0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD` |
| NavOracle (dUST) | `0x44B94bb593F6De51Ad3385264C0168eEc8E56392` |
| MockUSD (dUSD) | `0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838` |
| MockTreasury (dUST) | `0x0A72124d5e606aB4264a653B6942738CBAbd2D43` |

| Actor | Address |
|---|---|
| agentExecutor | `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3` |
| borrower demo | `0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2` |
| NAV publisher | `0x104bd087D5e4767370D8569A32B2DD986c3b1c4A` |
| deployer | `0xe2d3B7FEA35Ea3B7B8d530cfF58a8227ce62BFAD` |

---

## 4. Angka kanonik

Wajib identik di Solidity, agent, dan UI. Kalau salah satu beda, klaim utama runtuh.

| Stage | Health (bps) | Outstanding (dUSD) | Event |
|---|---|---|---|
| Buka | 16,667 | 6,000.000000 | par $1.00 |
| NAV $1.00 → $0.76 | 12,667 | 6,000.000000 | di bawah trigger 13000 |
| `guardRepay()` | **14,500** | **5,241.379310** | repaid **758.620690** |
| `sweepCoupon()` | 14,818 | 5,128.879310 | swept **112.500000** |

Decimals: `dUSD = 6dp · dUST = 18dp · oracle = 8dp · health = bps`

---

## 5. Commands

```bash
# Backend
cd backend
pnpm test           # 36/36 — jalankan sebelum deploy apapun
pnpm dev:agent      # guard agent (LEDGER=mock untuk dry run)
pnpm dev:server     # HTTP API di :3001
pnpm prove          # 8-step proof chain live di Base Sepolia

# Frontend
cd frontend
pnpm test           # 53/53
pnpm type-check     # zero errors
pnpm dev            # :3000

# Smart contract (alven)
cd sc
forge test
forge script ...

# Push harga (alven, publisher key)
cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
  "setPrice(int256)" 76000000 \              # $0.76 — dip
  --private-key $PUBLISHER_KEY \
  --rpc-url https://base-sepolia-rpc.publicnode.com

cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
  "setPrice(int256)" 100000000 \             # $1.00 — restore
  --private-key $PUBLISHER_KEY \
  --rpc-url https://base-sepolia-rpc.publicnode.com

# Kill port 3001 (PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force
```

---

## 6. Environment variables

### `backend/.env`

```env
RPC_URL=https://base-sepolia-rpc.publicnode.com
CHAIN_ID=84532
VAULT_ADDRESS=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
LENDING_POOL_ADDRESS=0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD
NAV_ORACLE_ADDRESS=0x44B94bb593F6De51Ad3385264C0168eEc8E56392
DUSD_ADDRESS=0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838
DUST_ADDRESS=0x0A72124d5e606aB4264a653B6942738CBAbd2D43
KEEPERHUB_API_KEY=kh_...
LEDGER=keeperhub
POLL_MS=300000
OVERLAP_GUARD=on
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000   # ganti ke Vercel URL saat deploy
PUBLISHER_KEY=0x...                    # hanya untuk pnpm prove
```

### `frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

---

## 7. Prove run evidence

Semua prove run ter-commit di `docs/evidence/`. File terpenting:

| File | Isi |
|---|---|
| `prove-run-2026-08-11T15-47-41-190Z.json` | 8/8 green, price dip ke 0.589 |
| `prove-run-2026-08-11T15-56-55-164Z.json` | 8/8 green, RPC publicnode |

Untuk refresh sebelum submit:
```bash
cd backend && pnpm prove
git add docs/evidence/prove-run-*.json
git commit -m "docs: add final prove run evidence"
```

---

## 8. File ownership

| Path | Owner | Jangan diubah oleh |
|---|---|---|
| `sc/` | alven | islakun, bima |
| `docs/abi/*.json` | alven | islakun, bima |
| `frontend/src/` | bima | alven, islakun |
| `frontend/docs/evidence/` | bima (dengan panduan islakun) | — |
| `backend/agent/` | islakun | — |
| `backend/src/` | islakun | — |
| `docs/evidence/` | islakun | — |
| `docs/CONTRACTS.md` | alven | — |

---

## 9. Checklist submission (Kamis 13 Agt)

**Frontend (bima):**
- [ ] `chain-snapshot.json` regenerated, `lastActedRound > 0`
- [ ] `proof-archive.json` punya entry `targetLabel: "demo vault"`
- [ ] `pnpm test` 53/53 green
- [ ] `pnpm type-check` zero errors
- [ ] `pnpm build` succeeds

**Backend (islakun):**
- [ ] `pnpm test` 36/36 green
- [ ] `pnpm prove` final run, evidence committed
- [ ] `ALLOWED_ORIGIN` diset untuk production URL
- [ ] `pnpm dev:agent` + `pnpm dev:server` jalan bersamaan

**Smart contract (alven):**
- [ ] `forge test` green
- [ ] Demo vault punya reserve cukup
- [ ] NAV segar (< 1 jam) sebelum judging buka

**Semua:**
- [ ] Repo public
- [ ] `git clone && cd backend && pnpm install --ignore-scripts && pnpm test` green dari clean clone
- [ ] Semua BaseScan links valid (buka dari incognito)
- [ ] Agent EOA dUSD balance = 0 di BaseScan
- [ ] Zero code commits setelah freeze (Kamis pagi)

---

## 10. Dokumen terkait

| Dokumen | Isi |
|---|---|
| `docs/CONTRACTS.md` | Addresses, selectors, cast examples |
| `docs/FRONTEND-FIXES.md` | 3 fixes yang masih pending untuk bima |
| `docs/video-plan.md` | Shot list dan checklist rekam video |
| `frontend/agents/plan/plan-v3.md` | Frontend remaining fixes detail |
| `backend/README.md` | Backend architecture + test breakdown |
| `README.md` | Project overview untuk judges |
