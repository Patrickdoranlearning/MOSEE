# Jimmy Quick Commands (MOSEE)

## Quick Start
```
# === CORE (most-used) ===
jimmy fix [X]            # Fix a bug (--urgent for hotfix)
jimmy build [X]          # Build a feature (auto-detects scope)
jimmy plan [X]           # Plan a feature (--dual for competing plans)
jimmy dual-plan [X]      # Two competing plans (shorthand for plan --dual)
jimmy execute PLAN.md    # Run the plan (--mode standard|thorough|paranoid)
jimmy methodology [X]    # Change how MOSEE scores/values stocks (council + quant gate)

# === ALSO AVAILABLE ===
jimmy review             # Code review (auto-scales depth)
jimmy ship               # Full ship pipeline
jimmy audit              # Full codebase audit (4 agents parallel)
jimmy status             # Where am I?
jimmy continue           # Resume from STATUS.md
jimmy wrap up            # End session properly (4 pillars)

# === COUNCIL BRIDGE ===
jimmy ask [agent] [X]    # One council agent (buffett, munger, fisher, lopez_de_prado, actuary...)
jimmy war-room [X]       # Buffett + Munger + Actuary stress test
jimmy quant-bench [X]    # LdP + Actuary + Data Engineer on numbers
jimmy council [X]        # Full 7-agent council

# === GIT & DOCS ===
jimmy commit-msg         # Draft a conventional commit message from diff
jimmy doc-sync           # Check/update docs/ to match code changes
jimmy roadmap show       # View product roadmap with status
```

**Rule**: Complex feature? `dual-plan`. Touching scoring/valuation/verdicts? `methodology` — never plain `build`. Schema? `schema` — both stacks or it didn't happen.

---

## The Two Halves of the System

| | Dev Agents | Advisory Council |
|---|---|---|
| **Who** | jimmy, planner, context-scout, db-engineer, quant-reviewer, feature-builder, verifier, reviewer, tester, validator, drift-detector | Buffett, Munger, Fisher, Lopez de Prado, Actuary, Software Eng, Data Eng |
| **Job** | Build, fix, verify, ship code | Judge methodology, stress-test ideas |
| **Lives in** | `.claude/agents/*.md` | `.claude/agents/prompts/*.md` |
| **Invoked by** | `jimmy build/fix/ship/...` | `jimmy ask/council/war-room` + all CLAUDE.md triggers |

Jimmy bridges them: a methodology change starts with council judgment and ends with the quant-reviewer gate.

---

## Core Commands

### `jimmy build [X]` — Build a Feature
```
context-scout → [plan if complex] → [db-engineer if DB] → feature-builder → verifier → tester → validator
```
**Example**: `jimmy build sector-filter-on-picks-page`

### `jimmy fix [X]` — Fix a Bug
```
context-scout → [Jimmy debug if complex] → feature-builder → verifier → tester → validator
```
**Example**: `jimmy fix confidence-score-shows-nan`

### `jimmy methodology [X]` — Methodology Change (MOSEE-specific)
```
council consult → planner → Karen → feature-builder → verifier → quant-reviewer → tester
```
For weights, thresholds, new signals, verdict logic. Requires a before/after verdict comparison on named tickers.
**Example**: `jimmy methodology add-momentum-lens`

### `jimmy schema [X]` — Database Change (always paranoid)
```
db-engineer (design both stacks) → APPROVAL GATE → feature-builder → verifier → db-engineer parity check
```
**Example**: `jimmy schema add-sector-column`

### `jimmy plan [X]` / `jimmy dual-plan [X]`
```
context-scout → planner → validator [Karen review] → PLAN.md (Status: Ready)
```
A plan is NOT done at `Status: Draft` — Karen must approve or escalate.

### `jimmy review` — Code Review
```
reviewer [+ quant-reviewer if methodology files touched] (parallel)
```

### `jimmy ship` — Ship Pipeline
```
verifier → (reviewer + quant-reviewer) parallel → doc-sync --auto → validator → STATUS.md sync
```

### `jimmy audit` — Full Codebase Audit
```
(reviewer + quant-reviewer + validator + drift-detector) ALL parallel → synthesized report
```

---

## Managing Commands

| Command | Action |
|---------|--------|
| `jimmy status` | Session summary |
| `jimmy pending` | Uncommitted changes, failing checks, TODOs |
| `jimmy wrap up` | 4 pillars: **Verify** (validator + dual-stack check) → **Registry** (FIXED-REGISTRY gate) → **Commit** (user-approved) → **Handover** (doc-sync + RESUME POINT + PROGRESS.md) |
| `jimmy continue` | Read RESUME POINT in STATUS.md → latest PROGRESS.md entry → git status → resume |

---

## Special Commands

| Command | Action |
|---------|--------|
| `jimmy auto [task]` | Auto-detect workflow from description |
| `jimmy paranoid [X]` | Maximum caution: approval gates on every step |
| `jimmy test [X]` | tester validates behavior (edge-case battery included) |
| `jimmy drift` | drift-detector health check → `reports/drift-report-*.md` |
| `jimmy debug [X]` | Jimmy investigates directly (Fable) |
| `jimmy snapshot [X]` | Screenshot a working UI element → FIXED-REGISTRY visual protection |

---

## Git & Docs

| Command | Action |
|---------|--------|
| `jimmy commit-msg` | Read diff → conventional commit message → print (read-only) |
| `jimmy doc-sync` | Map diff to `docs/` + README → propose updates |
| `jimmy doc-sync --auto` | Apply without asking (inside `jimmy ship`) |
| `jimmy doc-sync --check-only` | Report staleness only |

### Commit scopes
`methodology` · `analysis` · `data` · `db` · `api` · `web` · `scripts` · `ci` · `docs` · `tooling`

---

## Roadmap

| Command | Action |
|---------|--------|
| `jimmy roadmap show` | View ROADMAP.md with status |
| `jimmy roadmap add [item]` | Add item (asks milestone + priority) |
| `jimmy roadmap plan [item]` | Break into a plan, link back |
| `jimmy roadmap sync` | Push items to GitHub Issues (`gh issue create`) |
| `jimmy roadmap release [ver]` | Release notes since last tag |
| `jimmy roadmap status` | done / in-progress / planned / blocked counts |

---

## Execution Modes

| Mode | Trigger | Adds |
|------|---------|------|
| `lightweight` | Typos, copy | Direct fix + verifier only |
| `standard` | Normal features/bugs | Full pipeline |
| `thorough` | data_retrieval, auth, CI, fixes without tests | + validator + extra review |
| `paranoid` | Schema, scoring/valuation/verdict/confidence | + quant-reviewer/db-engineer gates + approval stops |

---

## MOSEE Invariants (Jimmy halts anything that threatens these)

1. **Dual-stack schema** — every DB change lands in BOTH `MOSEE/db_client.py` and `web/src/lib/db.ts`
2. **NaN/Inf safety** — bad data lowers confidence; never crashes, never fabricates
3. **Valuation range order** — conservative ≤ base ≤ optimistic
4. **Score bounds** — scores in range; weights sum to 1.0
5. **No look-ahead** — only data available at analysis time
6. **Verdict consistency** — Python thresholds and web display stay in sync
7. **Rate-limit respect** — all yfinance through the limiter/cache
8. **Confidence honesty** — missing data is never silently imputed

---

## Examples

```bash
# === BUILDING ===
jimmy build watchlist-export-csv
jimmy build deep-dive-caching            # auto-detects DB → db-engineer first

# === FIXING ===
jimmy fix picks-page-empty-after-cron
jimmy fix yfinance-429-errors --urgent
jimmy debug verdict-flipped-for-AAPL     # deep investigation

# === METHODOLOGY ===
jimmy methodology rebalance-lens-weights
jimmy ask munger "what bias does our confidence score have?"
jimmy war-room "should MOSEE add momentum?"
jimmy quant-bench "is the margin-of-safety formula statistically sound?"

# === SHIPPING ===
jimmy review
jimmy ship
jimmy audit

# === SESSION ===
jimmy continue
jimmy wrap up
```

---

## Stop Conditions

Jimmy **HALTS** and alerts if:
- A change would silently flip verdicts on already-analyzed stocks
- A migration would drop/corrupt analysis history or warehouse tables
- A schema change lands in only one stack
- Secrets (`.env*`, `PAT.txt`, `DATABASE_URL`, keys) are about to be committed
- A "fix" disables yfinance rate limiting

---

## See Also

- `.claude/agents/jimmy.md` — Full Jimmy documentation
- `.claude/agents/` — Dev agent definitions
- `.claude/agents/prompts/` — Advisory council personas
- `.claude/agents/toolbox.md` — Council multi-agent workflows
- `.claude/FIXED-REGISTRY.md` — Protected fixes
- `plans/` — Active plans · `plans/completed/` — shipped plans
- `STATUS.md` — Session context (RESUME POINT at top)
- `PROGRESS.md` — Ledger of shipped work
- `ROADMAP.md` — Product roadmap
