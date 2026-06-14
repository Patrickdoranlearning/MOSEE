# PLAN: World-Class MOSEE — Deep-Dive Remediation & Roadmap

**Status**: Ready (Karen-approved 2026-06-12)
**Revision**: 2
**Date**: 2026-06-12
**Source**: `reports/DEEP-DIVE-2026-06-12.md` (9-agent deep dive: full audit + investment committee + data research + UX review)
**Original ask (verbatim)**: "I want a complete deep dive of mosee find its weaknesses. see where we can make this into a world leading stock screening and picking tool. How can we make it easier for users. How can i use it to pick better stocks. I follow strict investment rules and i think these are important how can we work within these and make buffet like returns. Think outside the box, Can we get more data from other sources, how can we move this forward."

**Recommended execution mode**: paranoid for Phases 0–1 and 3 (verdict/valuation logic + security); standard elsewhere.

---

## Patrick's decisions needed first (blockers — nothing in Phase 1 ships without these)

| # | Decision | Context |
|---|----------|---------|
| D1 | **Rotate/revoke leaked credentials** | freecurrencyapi key in public repo (`run_mosee.py:190`); 2 GitHub PATs in `PAT.txt` + `.ipynb_checkpoints/PAT-checkpoint.txt`. Only Patrick can rotate these. |
| D2 | **DECIDED (2026-06-12): revert to `min()` now; build the range-position model after** | Patrick's direction: company value is a *range* and the verdict should come from where price sits in it — **winner = price below the credible floor**. Interim: revert the conservative leg to `min()` (task 0.4) so the WIP can be committed and the monthly run unbroken. The proper fix is the new Phase 3 task 3.8 (credible-floor range + price-position verdicts), full quant-gated pipeline. |
| D3 | **DECIDED (2026-06-12): invite code** | Open signup closes behind an invite code (task 1.3). |
| D4 | **Write down the investment rules** | Only the Doubler target (14.87% CAGR) is codified. Patrick supplies the rules; we encode them (Phase 3.7). |

---

## Phase 0 — Stop the bleeding (same day, ~2h work after D1/D2)

| Task | Files | Agent | Acceptance |
|------|-------|-------|------------|
| 0.1 Remove hardcoded key; read from env (key itself rotated by Patrick) | `scripts/run_mosee.py:190` (or delete the legacy script — see 2.4) | feature-builder | No secrets in tracked files; `git grep` for key pattern clean |
| 0.2 Delete `PAT.txt` + checkpoint copy after Patrick revokes | repo root, `.ipynb_checkpoints/` | Patrick + feature-builder | Files gone |
| 0.3 Zero-saves guard: run fails loudly when `saved_count == 0` (or <50%) | `scripts/run_weekly_analysis.py:1037-1043` | feature-builder | A simulated all-fail run exits 1 and marks the DB run failed |
| 0.4 Execute D2 decision: **revert conservative leg to `min()`** (keep the weighted *base*), fix stale docstring AND the code comments at `:140-155` (the `sorted()` safety net at `:176` already guarantees range ordering, so the revert is safe), run before/after verdict comparison | `MOSEE/valuation_range.py:129-179` | feature-builder → **quant-reviewer (mandatory)** | Before/after table on fixed ticker set; no undocumented verdict flips |
| 0.5 Commit the WIP engine changes (unbreaks monthly deep-dive ImportError). **Blocked until 0.4 is resolved** — if D2 = revert, the revert lands in the same commit; the contested conservative-leg change must never be committed un-reviewed | working tree | Jimmy (with Patrick's approval) | `git show HEAD` contains `compute_implied_annual_return`; Actions run saves rows; 0.4 resolution included |

**Invariant checks**: 0.4 is verdict-flipping by definition → quant-reviewer gate + before/after documentation per methodology rule.

## Phase 1 — Correctness & security (week 1)

| Task | Files | Agent | Acceptance |
|------|-------|-------|------------|
| 1.1 Fix FX bug: convert before computing `market_average_value` | `scripts/run_weekly_analysis.py:263,429`, `fundamental_analysis/valuation.py` | feature-builder → quant-reviewer | Non-USD ticker Market MoS sane — hand-check tickers fixed in advance: **7203.T (Toyota, JPY)** and **ASML.AS (ASML, EUR)** |
| 1.2 Unify discount rates: retire/relabel 4% legacy PAD/DCF | `fundamental_analysis/valuation.py:26,131` vs `valuation_range.py:707` | feature-builder → quant-reviewer | One discount-rate policy, documented |
| 1.3 Auth-gate `analyze` + `ai-analysis` routes; implement D3 | `web/src/app/api/analyze/`, `api/ai-analysis/`, signup route | feature-builder → reviewer (security) | Unauthenticated requests 401; signup gated |
| 1.4 First Python tests: range ordering, implied-return guardrails, verdict gates, currency conversion, missing-data handling | new `tests/` | feature-builder → verifier | `pytest tests/` green in CI |
| 1.5 Single-source Doubler thresholds (web + CLI read one definition) | `screen_stocks.py:39-43`, `ScreenerClient.tsx:11-14` | feature-builder | Same preset → same stock list both surfaces |
| 1.6 Missing data → None + confidence penalty (kill fabricated defaults: growth 0.05, ROE 0.10, D/E 1.0, current-liabilities 1) | `valuation_range.py:706-727`, `mosee_intelligence.py:251`, `run_weekly_analysis.py:301` | feature-builder → quant-reviewer | No financial default substitutes for missing data; confidence drops instead |

## Phase 2 — Unify the engine (weeks 2–3)

| Task | Files | Agent | Acceptance |
|------|-------|-------|------------|
| 2.1 Extract single `MOSEE/pipeline.py`; weekly/local/on-demand become thin wrappers | `run_weekly_analysis.py`, `run_local_report.py`, `run_on_demand.py` | planner mini-plan → feature-builder → verifier → tester | All three paths produce identical rows (incl. implied_annual_return + scuttlebutt); on-demand tickers appear in Doubler screen |
| 2.2 One schema owner (fold `ensureDeepDiveSchema` into Python migrations; delete try/catch column fallbacks) | `db.ts:256-283,352-466`, `db_client.py` | **db-engineer (gate)** → feature-builder | Dual-stack parity check passes; one DDL source |
| 2.3 One canonical conviction metric in web (implied return × confidence band) replacing the 3 ranking philosophies | `StockTable.tsx`, `FeaturedStockCard.tsx`, `StockLookup.tsx`, `types/mosee.ts` | feature-builder → tester | Same stock shows same signal on every page |
| 2.4 Cleanup: delete `run_mosee.py`, dead `PicksFilter` code, stale `build/`/`dist/`/egg-info; route rate-limiter bypasses through limiter | various | feature-builder | drift-detector re-scan clean on these items |

## Phase 3 — Methodology upgrades (weeks 3–6, council-approved direction; each lands via `jimmy methodology`)

| Task | What | Acceptance |
|------|------|------------|
| 3.1 Doubler quality gates | Default `quality_score ≥ 65` + verdict filter (BUY/STRONG BUY/ACCUMULATE) in the preset | Value-trap names drop off the default list; before/after documented |
| 3.2 Growth leg for implied return | Second leg: sustainable EPS growth × terminal multiple; surface both legs separately | Compounders can qualify on growth, not just convergence |
| 3.3 Moat durability sub-score | 10-yr ROE/ROIC consistency (uses existing `calculate_roe_history`), incremental ROIC, share-count trend, margin stability | New sub-score visible with its inputs; weights documented |
| 3.4 Maintenance capex fix | D&A or industry capex/sales proxy instead of average capex | Owner earnings no longer penalize reinvesting growers |
| 3.5 Verdict hysteresis | No flip inside noise band; previous verdict shown beside current | Weekly flip count drops; UI shows prior verdict |
| 3.6 Confidence honesty | Penalize correlated-input agreement; industry-specific `industry_pe`; book-value confidence capped for asset-light firms | Confidence no longer maxes out from 5 lenses chewing the same data |
| 3.7 **Codify Patrick's rules** | `RULES.md` + machine-readable gates the screener/verdicts enforce | Rules visible in repo; screen results annotated against them |
| 3.8 **Range-position verdict model (Patrick's D2 direction)** | (a) **Credible floor**: exclude low-confidence methods from the range (e.g. book value for asset-light firms) so one garbage method can't drag the floor; floor = lowest *credible* conservative. (b) Verdict from price position in range: **below floor = winner/buy zone**, lower third = accumulate, middle = watch, top = reduce. (c) UI shows price plotted on the range everywhere a verdict appears. Supersedes the interim 0.4 revert; replaces the contested weighted-average approach | Before/after verdict comparison on fixed ticker set; floor never raised by averaging; winner gate = price < credible floor |

**Every Phase 3 task**: council consult done (this deep dive) → feature-builder → verifier → **quant-reviewer mandatory** → tester before/after run.

## Phase 4 — Data expansion (parallel with Phase 3)

| Task | Source | Cost |
|------|--------|------|
| 4.1 Finnhub insider transactions + sentiment → real "Insider Alignment" in scuttlebutt | Finnhub free (60/min) | $0 |
| 4.2 SEC EDGAR Form 4 parsing + submissions + 10-K full-text → AI knowledge base | EDGAR | $0 |
| 4.3 FMP Starter: EU fundamentals (unlock existing 402-ing client) + earnings-call transcripts | FMP | ~$25/mo (Patrick approves spend) |
| 4.4 (Later) IBKR price feed / SimFin+ point-in-time fundamentals | IBKR / SimFin | $0 / ~€15/mo |

## Phase 5 — Validation loop (starts the day Phase 0 lands; Lopez de Prado's minimum credible loop)

| Task | What | Acceptance |
|------|------|------------|
| 5.1 Freeze weights + version strategies | Any weight/threshold change = new named strategy version stored with each run. **Baseline rule**: the current (post-Phase-0/1 correctness fixes) methodology is frozen as **strategy v1-baseline** and keeps being computed and logged on every weekly run alongside any Phase 3 variants until the IC report (5.3) exists — Phase 3 changes create new versions but NEVER stop or restart the v1-baseline clock | Strategy version column populated; v1-baseline rows present in every weekly run |
| 5.2 Forward-return tracker | Join each analysis row to +3/6/12-month price; store realized vs SPY | Script + table; runs in weekly cron |
| 5.3 IC report (at 12 months of data) | Spearman IC of implied_annual_return and total_score vs realized 12-month excess return | Report page; decision rule: IC ≈ 0 → re-examine before adding features |
| 5.4 Guardrail | No backtesting on Yahoo extended history (survivorship); no weight tuning until 5.3 has data | Documented in RULES.md |

## Phase 6 — Decision-tool UX (weeks 4–8)

| Task | Feature |
|------|---------|
| 6.1 Weekly diff digest as landing experience: verdict changes, new Doubler entrants, price-crossed-buy-below | 
| 6.2 "Actionable now" list: price ≤ buy_below AND confidence ≥ threshold |
| 6.3 Watchlist + persisted research checklist + decision journal (buy/pass + why + price) |
| 6.4 Link wealth-tree holdings to analyses: "you own this; verdict changed since purchase" |
| 6.5 Fisher "15 Points Worksheet" per candidate: pre-filled from data (insiders, transcripts when 4.x lands), unanswered questions listed for hand-scuttlebutt |
| 6.6 Ranges-with-confidence in all list views (kill naked 3-decimal point estimates); plain-language labels for PAD/Book/MoS jargon |

---

## Sequencing & dependencies

```
D1–D4 (Patrick, morning)
  → Phase 0 (same day) → Phase 1 (wk 1)
       → Phase 2 (wks 2–3) ─┬→ Phase 3 (methodology, quant-gated)
       → Phase 5.1–5.2 (start immediately — evidence clock)
                            ├→ Phase 4 (data, parallel)
                            └→ Phase 6 (UX, after 2.3 canonical metric)
```

## Risks

- **D2 wrong call risk**: keeping the weighted-average conservative quietly loosens every margin of safety — mitigated by mandatory before/after run and quant-reviewer gate.
- **Phase 2.1 regression risk**: pipeline extraction touches everything — mitigated by Phase 1.4 tests landing first and tester before/after row comparison.
- **Scope risk**: Phases 3–6 are a quarter of work; each task ships independently. Karen reviews scope per phase, not per task. **Phases 4 and 6 each get their own mini-plan (with acceptance criteria) before execution** — this plan fixes their direction and ordering only.
- **Evidence-clock risk**: Phase 3 methodology changes must not silently replace the baseline — see 5.1 baseline rule; correctness fixes (Phases 0–1) land *before* the v1-baseline freeze so the clock starts on sound numbers.

## Verification criteria (plan-level)

- All P0s from the report closed (credentials rotated, monthly run fails loudly, D2 resolved with documentation, FX fixed, routes gated).
- `pytest tests/` exists and runs in CI.
- One pipeline, one schema owner, one Doubler definition, one conviction metric.
- Evidence clock running: every weekly run logged as an immutable, versioned prediction.
