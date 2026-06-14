# MOSEE Progress Ledger

Sequential record of shipped work. Wrap-up Pillar 4 appends an entry whenever commits land in a session.

**Convention**: `## YYYY-MM-DD — Title`, newest on top, 5-10 bullets max per entry (commit SHAs + what shipped + plan link). Full detail lives in commit messages and plan files.

---

## 2026-06-12 — Wealth education layer

- `0267b6f` feat(web): wealth education layer — book/guru teachings registry (8 books, 48 teachings, attribution honesty flags), TeachingCard on all 8 wealth tools, Learn Library + guru sections on cure pages, Skills page (Cure 7) + DELETE endpoint, debt-payoff calculator tab, net-worth auto-snapshot, honest cure scores 5/6/7 (`number | null`, "Not tracked" UI)
- Plan: `plans/completed/PLAN-wealth-education.md` (Karen-approved, fully executed)
- Gates: tsc/eslint/next-build green; tester 10/11 live pass; reviewer approved (3 P2 fixes applied); validator VALIDATED; 4 FIXED-REGISTRY entries added
- Zero schema changes; cures 1–4 regression-verified byte-identical; not pushed

## 2026-06-11 — Jimmy agent system + deep-dive runs

- `d5f7d4a` fix: root-anchor `/lib/` in .gitignore — rescued silently-untracked `web/src/lib/` sources (deep-dive.ts, auth-db.ts, wealth-tree-db.ts); GitHub copy of the repo was unbuildable
- `4fe67fd` feat(web): on-demand + monthly deep-dive analysis runs — picks-page button (auth, cooldown, concurrency guard) and Vercel cron dispatch the GitHub Actions workflow; pending-row claim + live progress; dual-stack schema columns on `mosee_analysis_runs`; conservative MOSEE display in StockLookup
- Jimmy agent system (this commit): coordinator + 10 dev agents, jimmy-commands reference, STATUS/PROGRESS/ROADMAP/plans/FIXED-REGISTRY scaffolding, CLAUDE.md wiring
- Follow-up required before deep-dive works in prod: Vercel env vars `GITHUB_REPO`, `GITHUB_DISPATCH_TOKEN`, `CRON_SECRET`

## Pre-Jimmy history (from git log)

- `f153a91` feat: extended history, scuttlebutt scoring, warehouse, and stock UI refresh
- `3b0935c` feat: Full platform with auth, wealth tree, AI analysis, and knowledge base
- `5f7ad97` fix: Parse Neon connection URL properly for psycopg2
- `5f92427` feat: Full-stack web app with Vercel Postgres
- `9b82f52` adding gitignor
