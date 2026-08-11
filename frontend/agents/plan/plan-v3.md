# Frontend Plan v3 — remaining fixes

**Defral · deadline 2026-08-13 17:00 WIB**  
**Updated 2026-08-12 00:21 WIB**

Scope: frontend code only. Video dan demo tidak ada di sini — lihat `docs/video-plan.md`.

---

## Status sekarang

| Item | Status |
|---|---|
| Chain reads, backend integration, capability matrix | ✅ done |
| Dashboard, vault, proof pages — live data | ✅ done |
| Oracle-stale amber copy | ✅ done |
| blockNumber undefined guard | ✅ done (commit `6259048`) |
| `NEXT_PUBLIC_RPC_URL` | ✅ done (commit `6259048`) |
| 53 tests | ✅ green |
| Type check | ✅ zero errors |

---

## Fixes yang masih harus dikerjakan

### FIX-2 🔴 Regenerate `chain-snapshot.json`

**File:** `frontend/docs/evidence/chain-snapshot.json`

Snapshot sekarang stale — `outstanding` dan `reserve` sudah berubah dari prove runs.

**Cara:**
```bash
# Jalankan backend dulu
cd backend && pnpm dev:server

# Di terminal lain, dari repo root:
curl -s http://localhost:3001/api/position | node -e "
const c=[];
process.stdin.on('data',d=>c.push(d));
process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c).toString());
  process.stdout.write(JSON.stringify({
    vault:d.vault,blockNumber:d.blockNumber,
    position:d.position,guardRepayQuote:d.guardRepayQuote,
    couponDue:d.couponDue,healthRatioBps:d.healthRatioBps,
    liquidationBps:d.liquidationBps,maxStaleSeconds:d.maxStaleSeconds,
    oracle:d.oracle,tokens:d.tokens
  },null,2));
});" > frontend/docs/evidence/chain-snapshot.json
```

**Acceptance:** file punya `lastActedRound > 0` dan `outstanding` sesuai chain sekarang.

---

### FIX-4 🔴 Tambah demo vault entry ke `proof-archive.json`

**File:** `frontend/docs/evidence/proof-archive.json`

Semua 5 entry sekarang pointing ke rehearsal vault. Tambahkan entry dari demo vault (executionId ada dari prove run tadi malam).

**Tambahkan setelah entry terakhir:**
```json
{
  "id": "refused-healthy-demo",
  "rank": 6,
  "title": "The live demo vault refuses the agent when healthy",
  "claim": "The demo vault — never defended — re-reads the oracle and refuses while above trigger.",
  "caller": "0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3",
  "callerRole": "agentExecutor",
  "target": "0x4f634d7173eFf255973E762c3Fe04DF4887FfB35",
  "targetLabel": "demo vault",
  "kind": "execution-record",
  "contractError": "Refused_Healthy(19497, 13000)",
  "executionId": "18s842dcekxxtkz0tq61d",
  "transactionLink": null,
  "receiptStatus": "reverted",
  "blockNumber": null,
  "gasUsed": null,
  "isSponsored": true,
  "reading": "The demo position has never been defended. The contract returned its own error with live health 19497 vs trigger 13000."
}
```

**Juga update `sourceFiles`:**
```json
"sourceFiles": [
  "docs/evidence/p3-refusal-evidence.json",
  "docs/evidence/p0-guard-path-end-to-end.json",
  "docs/evidence/live-contract-function-sweep.json",
  "docs/evidence/prove-run-2026-08-11T15-47-41-190Z.json"
]
```

**Acceptance:** `/proof` page punya ≥1 entry `targetLabel: "demo vault"`. `pnpm test` masih green.

---

### FIX-CORS 🔴 Backend CORS untuk production URL

**File:** `backend/.env`

Kalau frontend di-deploy ke Vercel, CORS akan block semua API calls dan frontend diam-diam fallback ke snapshot.

**Fix:** tambahkan ke `backend/.env`:
```env
ALLOWED_ORIGIN=https://<your-vercel-url>.vercel.app
```

Atau kalau mau allow semua origin (OK untuk hackathon):
```env
ALLOWED_ORIGIN=*
```

**Acceptance:** dashboard shows `source: 'chain'` saat dibuka dari production URL.

---

## Execution order (Rabu 12 Agt pagi)

```
1. pnpm dev:server (backend)
2. pnpm dev (frontend) — confirm dashboard live
3. FIX-2  — regenerate chain-snapshot.json (~10 menit)
4. FIX-4  — add demo vault entry + update sourceFiles (~5 menit)
5. FIX-CORS — set ALLOWED_ORIGIN di backend .env (~2 menit)
6. pnpm test && pnpm type-check && pnpm build
7. commit: "fix(frontend): refresh snapshot and add demo vault proof entry"
```

**Total: ~30 menit**

---

## Definition of done

- [x] blockNumber undefined guard fixed
- [x] `NEXT_PUBLIC_RPC_URL` added to `.env`
- [ ] `chain-snapshot.json` has `lastActedRound > 0`
- [ ] `proof-archive.json` has entry with `targetLabel: "demo vault"`
- [ ] Backend `ALLOWED_ORIGIN` set for production
- [ ] `pnpm test` 53/53 green
- [ ] `pnpm type-check` zero errors
- [ ] `pnpm build` succeeds

---

## Cut list (kalau waktu habis)

1. `/onboarding` dan `/connect` cleanup — tidak muncul di video, aman dipotong
2. `PROVENANCE.md` rewrite — judges baca README dulu
3. Outcome comparison numbers check

**Jangan pernah potong:** capability matrix, proof page, chain-snapshot refresh, CORS.
