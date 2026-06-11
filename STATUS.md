# MOSEE Status

## RESUME POINT

- **Current state**: `4fe67fd` deep-dive feature (manual button + monthly cron → GitHub Actions, live progress, dual-stack schema), `d5f7d4a` gitignore /lib/ fix (rescued untracked web/src/lib sources), plus the Jimmy agent system (this commit). All pushed to main.
- **What's next**: Set Vercel env vars — `GITHUB_REPO=Patrickdoranlearning/MOSEE`, `GITHUB_DISPATCH_TOKEN` (PAT with actions:write), `CRON_SECRET` — then test the Deep Dive button end-to-end on the picks page (trigger returns 500 until the vars exist).
- **Blockers / known state**: No Python test suite (`tests/` doesn't exist — verifier falls back to compileall + import checks). Pre-existing lint debt: 29 eslint errors (10 = `SortHeader` declared inside render in `StockLookup.tsx`; rest in login/signup/search components) — none introduced by recent work, build unaffected.
- **Standing rules**: Never push without explicit ask. Schema changes land in both `db_client.py` and `db.ts` or not at all. Methodology changes need quant-reviewer before merge. `.gitignore` `/lib/` stays root-anchored (see FIXED-REGISTRY).
- **Intentional leftovers**: Lint debt left untouched (out of wrap-up scope — tracked on ROADMAP). Doc comment in `deep-dive.ts` says "POST /api/cron/deep-dive" but the route is GET (cosmetic).

---

## Session Handoffs

*(Wrap-up Pillar 4 appends detailed session summaries here, newest on top. The RESUME POINT block above is rewritten each session — it is the 5-bullet TL;DR the next session reads first.)*

### 2026-06-11 — Jimmy agent system installed + deep-dive work landed
- Built the Jimmy coordinator system (modeled on HortiTrack's): 11 dev agents in `.claude/agents/`, command reference in `.claude/jimmy-commands.md`, state files (this file, PROGRESS.md, ROADMAP.md, plans/, FIXED-REGISTRY.md). Council unchanged — Jimmy bridges to it for methodology judgment.
- First `jimmy wrap up` run verified and landed the pre-existing deep-dive work (`4fe67fd`): compileall ✓, tsc ✓, next build ✓, dual-stack parity ✓, cron/auth gating ✓, dispatch↔workflow input wiring ✓.
- **Pillar 1 catch**: bare `lib/` in .gitignore was silently untracking `web/src/lib/deep-dive.ts`, `auth-db.ts`, `wealth-tree-db.ts` — GitHub copy of the repo couldn't build. Fixed (`d5f7d4a`), registered in FIXED-REGISTRY.
- Registry: 1 entry added (root-anchored /lib/). Commits: `d5f7d4a`, `4fe67fd`, + Jimmy system commit. Pushed to main on Patrick's instruction.
