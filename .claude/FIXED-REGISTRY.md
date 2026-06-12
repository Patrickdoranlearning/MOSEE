# MOSEE Fixed Registry

Confirmed fixes and protected patterns. Before modifying any file listed here, agents MUST verify the protected fix survives their edit. A regression against this registry = automatic REJECTED from validator.

**How entries get here**: Jimmy's Fix Registration Gate — after a fix is confirmed working, Patrick approves which fixes to protect (never auto-registered).

## Entry Format

```markdown
### [Short description]
- **File**: `path/to/file.py`
- **Lines**: ~42-55
- **What was fixed**: [bug description]
- **What the fix looks like**: [key code pattern to preserve]
- **Date**: YYYY-MM-DD
- **Protected until**: permanent
```

Visual snapshots (from `jimmy snapshot`) use the same format plus a **Screenshot** path under `reports/snapshots/`.

---

## Protected Fixes

### Root-anchored lib/ gitignore pattern
- **File**: `.gitignore`
- **Lines**: ~13-15
- **What was fixed**: Bare `lib/` (Python packaging template) matched `web/src/lib/` too, silently untracking source files (`deep-dive.ts`, `auth-db.ts`, `wealth-tree-db.ts`) — the GitHub copy of the repo couldn't build
- **What the fix looks like**: `/lib/` and `/lib64/` root-anchored with a comment explaining why. NEVER revert to bare `lib/`. New files under `web/src/lib/` must show up in `git status`
- **Date**: 2026-06-11
- **Protected until**: permanent

### Honest cure scores 5/6/7 — null means "Not tracked", never a silent 0
- **File**: `web/src/lib/wealth-tree-db.ts` (cure score block in `getWealthDashboard`), `web/src/components/wealth-tree/CureCard.tsx`, `web/src/components/wealth-tree/TreeTierCard.tsx`, `web/src/components/wealth-tree/WealthTreeVisualization.tsx`, `web/src/app/wealth-tree/page.tsx`
- **Lines**: ~620-700 (db), null branches in each consumer
- **What was fixed**: Cures 5/6/7 were hardcoded `0`, rendering a false red "Critical" for users with no real-estate/retirement/skills data
- **What the fix looks like**: `cure_scores: Record<CureNumber, number | null>`; missing data → `null` → gray "Not tracked" pill. Averages EXCLUDE nulls (never coerce `null` to 0 with `|| 0`). Cure formulas clamp to [0, 100] and guard every denominator
- **Date**: 2026-06-12
- **Protected until**: permanent

### TeachingCard UTC day-of-year (hydration safety)
- **File**: `web/src/components/wealth-tree/TeachingCard.tsx`
- **Lines**: ~17-22
- **What was fixed**: Local-timezone day-of-year made server (UTC) and client disagree near midnight → React hydration mismatch
- **What the fix looks like**: `dayOfYear()` computed entirely from `Date.UTC`/`getUTC*` parts; initial teaching index stays deterministic (`dayOfYear() % pool.length`). NEVER use `Math.random()` or local-time date math for the initial render
- **Date**: 2026-06-12
- **Protected until**: permanent

### Cure 5 home-equity score clamped to [0, 100]
- **File**: `web/src/lib/wealth-tree-db.ts`
- **Lines**: ~633-638
- **What was fixed**: Equity branch only floored at 0; bad data (negative mortgage balance) could push the score above 100
- **What the fix looks like**: `Math.max(0, Math.min(100, Math.round(((reValue - mortgageBalance) / reValue) * 100)))` — both branches of cure 5 carry both clamps
- **Date**: 2026-06-12
- **Protected until**: permanent

### FX never-fabricate contract — None propagates, never a fake 1.0
- **File**: `MOSEE/data_retrieval/market_data.py` (`get_exchange_rate_to_usd`, `convert_value_to_usd`, `convert_dataframe_to_usd`), `MOSEE/data_retrieval/rate_limiter.py` (`get_fx_pair_rate`), `scripts/run_local_report.py` (~166-178), `scripts/run_weekly_analysis.py` (~186-193)
- **Lines**: see functions above
- **What was fixed**: FX rates now come exclusively from yfinance pair tickers (`{CCY}USD=X`) through the rate limiter with TTL cache — freecurrencyapi/forex_python removed. A failed/unknown rate returns `None`, the ticker is skipped with a warning, and the on-demand path no longer crashes with TypeError
- **What the fix looks like**: NO code path may return or substitute a default rate (1.0 or otherwise). `get_fx_pair_rate` guards empty history/NaN/Inf/zero/negative and never caches None. `convert_value_to_usd` returns None and `convert_dataframe_to_usd` returns the df unconverted (with warning) when the rate is None. Both analysis scripts skip the ticker on a None rate. NEVER reintroduce a keyed FX API or a fabricated fallback rate
- **Date**: 2026-06-12
- **Protected until**: permanent

### Calculator "Total Repaid" derived from the computed schedule
- **File**: `web/src/app/wealth-tree/calculator/page.tsx`
- **Lines**: ~350
- **What was fixed**: Total Repaid read the live balance input, so editing inputs after calculating silently desynced it from the displayed schedule
- **What the fix looks like**: `schedule.reduce((sum, row) => sum + (Number(row.payment) || 0), 0)` — always derived from the schedule rows, never from input state
- **Date**: 2026-06-12
- **Protected until**: permanent
