# MOSEE Roadmap

Managed via `jimmy roadmap` commands (`show` / `add` / `plan` / `sync` / `release` / `status`). Items link to plans in `plans/` and optionally to GitHub Issues.

**Status values**: `planned` · `in-progress` · `done` · `blocked` | **Priority**: P0 (critical) → P3 (nice-to-have)

## Current Milestone — (set via `jimmy roadmap add`)

| Item | Status | Plan | Issues | Priority |
|------|--------|------|--------|----------|
| Land in-flight cron + deep-dive work | done (2026-06-11, `4fe67fd`) | — | — | P1 |
| Configure Vercel env vars for deep-dive (GITHUB_REPO, GITHUB_DISPATCH_TOKEN, CRON_SECRET) | planned | — | — | P1 |
| World-class MOSEE remediation (deep-dive findings: security P0s, methodology, data, validation, UX) | planned — **blocked on Patrick decisions D1–D4** | `plans/PLAN-world-class-mosee.md` | — | P0 |
| Wealth education layer (books/gurus registry, Skills page, honest cure scores, debt-payoff UI) | done (2026-06-12, `0267b6f`) | `plans/completed/PLAN-wealth-education.md` | — | P1 |

## Backlog

| Item | Priority | Notes |
|------|----------|-------|
| Python test suite (`tests/`) | P1 | Verifier currently falls back to compileall — pytest coverage for scoring/valuation would harden the quant gate |
| Clear web lint debt (30 errors) | P2 | 10× SortHeader-in-render in StockLookup.tsx + login/signup/search components + 1 accepted set-state-in-effect in CommandPalette.tsx:81 (consistent with file's 2 pre-existing) — build unaffected |
