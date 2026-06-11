# MOSEE Roadmap

Managed via `jimmy roadmap` commands (`show` / `add` / `plan` / `sync` / `release` / `status`). Items link to plans in `plans/` and optionally to GitHub Issues.

**Status values**: `planned` · `in-progress` · `done` · `blocked` | **Priority**: P0 (critical) → P3 (nice-to-have)

## Current Milestone — (set via `jimmy roadmap add`)

| Item | Status | Plan | Issues | Priority |
|------|--------|------|--------|----------|
| Land in-flight cron + deep-dive work | done (2026-06-11, `4fe67fd`) | — | — | P1 |
| Configure Vercel env vars for deep-dive (GITHUB_REPO, GITHUB_DISPATCH_TOKEN, CRON_SECRET) | planned | — | — | P1 |

## Backlog

| Item | Priority | Notes |
|------|----------|-------|
| Python test suite (`tests/`) | P1 | Verifier currently falls back to compileall — pytest coverage for scoring/valuation would harden the quant gate |
| Clear web lint debt (29 errors) | P2 | 10× SortHeader-in-render in StockLookup.tsx + login/signup/search components — pre-existing, build unaffected |
