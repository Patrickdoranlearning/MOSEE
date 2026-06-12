# PLAN: Wealth Education Layer — Books & Gurus
**Status**: Ready (Karen-approved 2026-06-11)
**Revision**: 1
**Date**: 2026-06-11
**Mode recommendation**: standard
**Original ask**: "Jimmy Plan, execute and test: The entire wealth section of the app. I think we might be onto something here it's about applying eduation for the core books i have read and from the investing gurus"

## Goal
Take the wealth-tree section from "works" to "complete + differentiated": a typed book/guru education registry whose teachings surface contextually inside every wealth tool, a generalized Learn section with a book Library, and the four known orphans finished (Skills page, debt-payoff calculator UI, net-worth auto-snapshot, honest cure scores 5/6/7).

## Non-Goals
- **No new DB tables or columns.** `wt_skills` already exists with full API + types. Zero schema changes means no db-engineer gate. If a builder discovers a schema change is truly unavoidable, STOP and escalate to Jimmy for a db-engineer gate — do not improvise.
- **No CMS / no DB-driven content.** v1 education content is a hardcoded typed TS registry. The knowledge-base `book_principles` backend is NOT wired in beyond a link.
- **No changes to MOSEE Python scoring, valuation, or verdict logic.** Nothing in `MOSEE/` is touched.
- **No auth changes.** Existing `auth()` gating pattern is reused verbatim.
- **No rebuild of the knowledge section** (`web/src/app/knowledge/page.tsx` stays as-is; we only link to it).
- **No PATCH/edit UI for skills** in v1 — create, list, delete only (matches savings/income pattern).
- **No `.gitignore` edits of any kind** (FIXED-REGISTRY landmine: root-anchored `lib/` pattern; `web/src/lib/*.ts` must stay tracked).

## Approach
**Content as code.** A single typed registry `web/src/lib/wealth-education.ts` holds books, gurus, and teachings keyed by topic + cure. This mirrors the proven `SEVEN_CURES` / `CURE_CONTENT` pattern already in the codebase (hardcoded TS in `types/wealth-tree.ts` and `learn/[cure]/page.tsx`), so it ships with zero infra, is fully type-checked, renders server-side for free, and is trivially extendable when Patrick names more books (add an object, `tsc` enforces the shape).

**Alternatives rejected:**
- *DB-driven content via the existing knowledge-base `book_principles` category*: ready-made backend, but adds query latency to every tool page, needs seeding/migration tooling, and makes content edits a DB operation instead of a PR. Wrong trade for v1 static content. Revisit if Patrick wants in-app content editing.
- *MDX/content files*: nicer authoring, but adds a build dependency and a second content convention; the existing codebase precedent is typed TS constants.
- *One teaching component per page, hand-written*: maximum contextual fit but no reuse; a shared `<TeachingCard topic=...>` with per-page topic tags gets 90% of the fit at 10% of the code.

**Cure scores 5/6/7 — honest computation, no fabricated numbers.** The data to compute 5 and 6 partially exists already: `wt_investments.asset_type` includes `'real_estate'`, `wt_investments.account` includes `'ira' | '401k' | 'roth' | 'hsa'`, `wt_debts.debt_type` includes `'mortgage'`, and `wt_skills` is populated once the Skills page ships. Where data is absent, the score becomes `null` and the UI says "Not tracked" — never a silent 0 (which currently mislabels these cures "Critical" in red). This changes the `cure_scores` contract from `Record<CureNumber, number>` to `Record<CureNumber, number | null>` — a deliberate, contained type change (consumers: `CureCard`, dashboard page, possibly `WealthTreeVisualization`/`TreeTierCard`; builder must check all four).

**Books to seed** (matches MOSEE's five scoring lenses + existing in-app references):
1. The Richest Man in Babylon — Clason (existing content is the template; spine of the section)
2. The Intelligent Investor — Graham
3. Warren Buffett (shareholder letters / well-known quotes)
4. Poor Charlie's Almanack — Munger
5. One Up on Wall Street — Lynch
6. Common Stocks and Uncommon Profits — Fisher
7. The Little Book That Beats the Market — Greenblatt
8. The Little Book of Common Sense Investing — Bogle

**Content honesty rule** (applies the confidence-honesty invariant to prose): direct quotes must be genuinely attributable; anything reconstructed is stored with `attribution: 'paraphrase'` and rendered without quote marks. No invented quotes.

## Invariant Checklist
- [ ] **Dual-stack schema**: NOT touched. No DDL changes in `MOSEE/db_client.py`; `web/src/lib/wealth-tree-db.ts` gets query-only edits (cure scores + 3 new aggregate subqueries against existing tables). If any builder believes a schema change is needed: halt, escalate for db-engineer gate.
- [ ] **NaN/Inf safety**: every new ratio in `getWealthDashboard` (home-equity ratio, mortgage paydown, retirement multiple) guards divide-by-zero and clamps to [0, 100]; absent data → `null`, never `NaN`/`Infinity`/fabricated 0. Auto-snapshot uses `Number(...) || 0` coercion like the rest of the file.
- [ ] **Score bounds**: all cure scores remain 0–100 or `null`. `CureCard` already clamps; it additionally gains an explicit `null` branch.
- [ ] **Rate limiting / yfinance**: not touched (no Python, no market-data calls).
- [ ] **Verdict consistency**: N/A (no MOSEE scoring change).
- [ ] **No look-ahead**: N/A (no time-series modeling; net-worth snapshot uses current aggregates only).
- [ ] **Auth + user scoping**: the only API edit is adding `DELETE` to `/api/wealth-tree/skills/route.ts`, copying the savings route pattern exactly (`auth()` 401 guard, `?id=` query param, `deleteSkill(session.user.id, id)` which is already user-scoped in `wealth-tree-db.ts:532`). No other routes change. Net-worth auto-snapshot reuses existing authed GET dashboard + POST net-worth — no new route.
- [ ] **FIXED-REGISTRY**: no `.gitignore` edits; new file `web/src/lib/wealth-education.ts` lands under `web/src/lib/` which is confirmed tracked — builder must verify `git status` shows it as untracked-then-added, not ignored.

---

## Phases

### Phase 1: Education content registry
The foundation everything else consumes. Pure data + pure functions, no React, no DB.

| Task | Files | Agent | Notes |
|------|-------|-------|-------|
| 1.1 Create the registry: types + data | **CREATE** `web/src/lib/wealth-education.ts` | feature-builder | See shape below. No `'use client'` — must be importable by server and client components. |
| 1.2 Seed 8 books + ≥3 teachings per topic (~35–45 teachings total) | same file | feature-builder | Babylon teachings lift from existing `CURE_CONTENT` quotes/lessons (do NOT delete `CURE_CONTENT` — Phase 2 augments that page, doesn't replace it). Quotes follow the content honesty rule. |

**Registry shape** (exact contract — builder implements this, names load-bearing):

```ts
export type WealthTopic =
  | 'saving' | 'budgeting' | 'debt' | 'investing' | 'compounding'
  | 'risk' | 'income' | 'goals' | 'net-worth' | 'skills' | 'home'

export interface Book {
  id: string            // slug, e.g. 'intelligent-investor' — used in /learn/library/[book]
  title: string
  author: string
  guru: string          // display name, e.g. 'Benjamin Graham'
  year: number
  tagline: string       // one-line "why this book"
  coreIdeas: string[]   // 3-6 bullets for the library page
  moseeConnection: string // how it maps to MOSEE lenses / wealth-tree cures
}

export interface Teaching {
  id: string
  bookId: string                       // FK into BOOKS by id
  topics: WealthTopic[]                // where it surfaces
  cures: CureNumber[]                  // ties into 7-cures spine ([] allowed)
  text: string                         // the quote or paraphrased teaching
  attribution: 'quote' | 'paraphrase'  // honesty flag; paraphrases render without quote marks
  application: string                  // 1-2 sentences: what to DO in this MOSEE tool
}

export const BOOKS: Book[]
export const TEACHINGS: Teaching[]
export function getBook(id: string): Book | undefined
export function getTeachingsForTopic(topic: WealthTopic): Teaching[]
export function getTeachingsForCure(cure: CureNumber): Teaching[]
export function getTeachingsForBook(bookId: string): Teaching[]
```

`CureNumber` is imported from `@/types/wealth-tree`. Every `Teaching.bookId` must match a `Book.id`; builder adds a small compile-time or module-load assertion (e.g. a `satisfies` check or a dev-only validation loop) so a typo'd `bookId` fails fast.

**Topic coverage requirement** (so no tool page renders an empty card): every one of the 11 topics has ≥3 teachings, drawn from ≥2 different books.

**Exit criteria**: `npx tsc --noEmit` exits 0; a quick node/tsx spot-check (or unit assertion) confirms all 11 topics return ≥3 teachings and all bookIds resolve.

---

### Phase 2: Contextual surfacing + Learn library
The differentiator: teachings appear inside the tools, and Learn gains a books dimension.

| Task | Files | Agent | Notes |
|------|-------|-------|-------|
| 2.1 Create `<TeachingCard topics={...} />` | **CREATE** `web/src/components/wealth-tree/TeachingCard.tsx` | feature-builder | Client component. Pools `getTeachingsForTopic` across its topics, dedupes by id. Initial teaching chosen **deterministically** (day-of-year % pool length — NOT `Math.random()` in render; pages are client components but may be SSR'd, hydration must match). "Another teaching" button cycles the pool. Shows teaching text (quote-marked only when `attribution === 'quote'`), guru + book title, the `application` line, and a link to `/wealth-tree/learn/library/[bookId]`. Amber/parchment styling consistent with the existing Arkad quote block in `learn/page.tsx`. |
| 2.2 Mount TeachingCard on all 8 tool surfaces | **EDIT** `web/src/app/wealth-tree/income/IncomePageClient.tsx` (topics: `income`, `skills`) · `expenses/ExpensesPageClient.tsx` (`budgeting`, `saving`) · `savings/page.tsx` (`saving`) · `debts/page.tsx` (`debt`, `risk`) · `investments/page.tsx` (`investing`, `risk`) · `net-worth/page.tsx` (`net-worth`, `compounding`) · `goals/page.tsx` (`goals`) · `calculator/page.tsx` (`compounding`; switches to `debt` on the Phase-3 debt tab — render with the active tab's topic) | feature-builder | One `<TeachingCard>` per page, placed below the page header / above or beside the main content — additive only, no layout rewrites. Calculator topic prop depends on Phase 3 task 3.3 tabs; if Phase 2 lands first, mount with `compounding` and let 3.3 make it tab-aware. |
| 2.3 Library: per-book page | **CREATE** `web/src/app/wealth-tree/learn/library/[book]/page.tsx` | feature-builder | Mirrors `learn/[cure]/page.tsx` pattern: server component, `generateStaticParams` from `BOOKS`, `notFound()` on unknown slug. Renders title/author/year/tagline, `coreIdeas`, `moseeConnection`, then all `getTeachingsForBook` teachings grouped with links to the cures they touch. Back-link to `/wealth-tree/learn`. |
| 2.4 Library index + KB bridge | **EDIT** `web/src/app/wealth-tree/learn/page.tsx` | feature-builder | Keep 7-Cures list as the spine. Add a "Library" section below: card grid of all `BOOKS` linking to `/wealth-tree/learn/library/[id]`. Add one quiet link card to `/knowledge` ("Knowledge Base: book principles & deeper research") — that is the entire KB bridge. |
| 2.5 Gurus on cure pages | **EDIT** `web/src/app/wealth-tree/learn/[cure]/page.tsx` | feature-builder | Append a "What the gurus say" section using `getTeachingsForCure(cure)` (exclude Babylon book to avoid duplicating `CURE_CONTENT`). `CURE_CONTENT` untouched. |

**Exit criteria**: `tsc` clean; every tool page renders a teaching (manual click-through of all 8); `/wealth-tree/learn/library/intelligent-investor` renders; unknown slug 404s; cure pages show guru section.

---

### Phase 3: Orphan completion
Finish what exists. Independent of Phase 2 except the calculator-tab/topic handshake noted in 2.2.

| Task | Files | Agent | Notes |
|------|-------|-------|-------|
| 3.1 Skills DELETE endpoint | **EDIT** `web/src/app/api/wealth-tree/skills/route.ts` | feature-builder | Add `DELETE` handler copying `savings/route.ts` exactly: `auth()` guard → `?id=` param → `deleteSkill(session.user.id, id)` (already exists, user-scoped) → 404 if not found. |
| 3.2 Skills page (Cure 7) + nav | **CREATE** `web/src/app/wealth-tree/skills/page.tsx` · **EDIT** `web/src/components/wealth-tree/WealthTreeSidebar.tsx` | feature-builder | Page: client component following the debts/savings page pattern — list `SkillInvestment` rows (GET), add form (POST: name required; category, cost, expected_income_increase, start/completion dates, status `planned/in_progress/completed`), delete button. Header frames it as **"Increase Thy Ability to Earn"** (Cure 7 — invest in your own education); summary tiles: total invested in skills, expected income increase, counts by status. Mount `<TeachingCard topics={['skills','income']} />`. Sidebar: insert "Skills" item between Goals and Learn (graduation-cap or lightbulb SVG, same 10-item pattern; nav goes 10 → 11). |
| 3.3 Debt-payoff calculator UI | **EDIT** `web/src/app/wealth-tree/calculator/page.tsx` | feature-builder | Two tabs: "Compound Growth" (existing UI unchanged) and "Debt Payoff". Debt tab: inputs current_balance, interest_rate (% in UI → decimal in payload, matching compound tab's `/100` convention — the API expects annual decimal, it divides by 12 itself), monthly_payment → POST `/api/wealth-tree/calculator/debt-payoff` → render payoff summary (months to free, total interest paid) + balance-over-time chart (recharts, reuse page conventions) + amortization table (collapsed/scrollable). **Surface the API's 400 error message** (payment ≤ first-month interest) in the UI — do not swallow it. TeachingCard topic follows active tab (`compounding` / `debt`). |
| 3.4 Net-worth auto-snapshot | **EDIT** `web/src/app/wealth-tree/net-worth/page.tsx` | feature-builder | "Snapshot from current data" button beside "Add manually": client fetches `/api/wealth-tree/dashboard` (existing, authed), computes assets = `total_savings + total_investments`, liabilities = `total_debt`, POSTs to existing `/api/wealth-tree/net-worth` with today's date and a `breakdown` of `{savings, investments, debt}`. Show the derived numbers in a confirm step before POST (user sees what's being snapshotted — honesty). No new API route. |
| 3.5 Honest cure scores 5/6/7 | **EDIT** `web/src/lib/wealth-tree-db.ts` (`getWealthDashboard`, ~lines 541–636) · `web/src/types/wealth-tree.ts` (`WealthDashboard.cure_scores` → `Record<CureNumber, number \| null>`) · `web/src/components/wealth-tree/CureCard.tsx` (null branch) · **CHECK** `web/src/app/wealth-tree/page.tsx`, `WealthTreeVisualization.tsx`, `TreeTierCard.tsx` for other `cure_scores` consumers | feature-builder | Add 3 parallel queries to the existing `Promise.all` (all against existing tables): real-estate investments (`asset_type='real_estate'`: SUM current_value), mortgage debts (`debt_type='mortgage'`: SUM current_balance, SUM original_amount), retirement investments (`account IN ('ira','401k','roth','hsa')`: SUM current_value), skills counts by status. Formulas (each clamped 0–100, divide-by-zero guarded): **Cure 5**: if RE value > 0 → equity ratio `round(((reValue − mortgageBalance) / reValue) * 100)` floored at 0; elif mortgage with `original_amount > 0` → paydown `round((1 − balance/original) * 100)`; else `null`. **Cure 6**: if retirement total > 0 AND `profile.annual_income > 0` → `min(100, round((retirementTotal / (10 × annualIncome)) × 100))` (10× income rule of thumb — label as heuristic in a code comment); if retirement total > 0 but no income on profile → `null` (UI hint: complete profile); else `null`. **Cure 7**: if no `wt_skills` rows → `null`; else `min(100, 30 + completedCount × 20 + inProgressCount × 10)` (engagement heuristic, commented as such). Cures 1–4 formulas unchanged. **CureCard `score: number \| null`**: null renders gray "Not tracked" pill, no red bar, sublabel "Add data to track this cure", still links to the relevant page. Builder updates every consumer the type change breaks — let `tsc` find them all. |

**Exit criteria**: `tsc` clean; skills CRUD round-trip works in browser; sidebar shows 11 items; debt payoff renders a schedule and shows the 400 message for an underpayment; auto-snapshot creates a snapshot matching dashboard totals; dashboard shows "Not tracked" (not red 0/Critical) for cures 5/6/7 on an account without that data, and real scores once data exists.

---

### Phase 4: Verification & polish

| Task | Files | Agent | Notes |
|------|-------|-------|-------|
| 4.1 Type/lint/build gates | — | verifier | `npx tsc --noEmit`, `npx next lint` (or project eslint config), `npx next build` in `web/` — all exit 0. |
| 4.2 Full acceptance pass | — | tester | Run the acceptance criteria below as a real user (fresh-ish account AND a data-rich account). |
| 4.3 Review | — | reviewer | Focus: the `cure_scores` type-change blast radius, hydration-safety of TeachingCard, no scope creep into knowledge/ or MOSEE/. |

**Exit criteria**: all gates green, tester sign-off, no FIXED-REGISTRY violations (`git check-ignore web/src/lib/wealth-education.ts` returns nothing).

---

## Verification (tester acceptance criteria)

**Phase 1/2 — education layer:**
1. Each of the 8 tool pages (income, expenses, savings, debts, investments, net-worth, goals, calculator) shows a teaching card with guru + book attribution and an application line; "Another teaching" cycles without page reload; book link lands on the right library page.
2. Reload a tool page: no hydration warning in console (deterministic initial teaching).
3. `/wealth-tree/learn` shows 7 cures + Library grid of 8 books + one Knowledge Base link; `/wealth-tree/learn/library/poor-charlies-almanack` (and all 8 slugs) render; `/wealth-tree/learn/library/nonsense` → 404.
4. Each cure page (`/wealth-tree/learn/1`…`7`) shows existing Babylon content unchanged plus a "What the gurus say" section with non-Babylon teachings.
5. Spot-check 5 quotes marked `attribution: 'quote'` against the source books/letters — they must be real.

**Phase 3 — orphans:**
6. Sidebar shows Skills between Goals and Learn; `/wealth-tree/skills` lists, creates (name-only minimum), and deletes a skill; unauthenticated `curl` to GET/POST/DELETE `/api/wealth-tree/skills` returns 401; DELETE with another user's skill id returns 404.
7. Calculator has two tabs; Debt Payoff with balance 10000, rate 20%, payment 100 returns the "must exceed first month's interest" error visibly; payment 300 renders schedule, chart, months-to-free, and total interest; compound tab behavior unchanged.
8. Net-worth "Snapshot from current data" shows derived assets/liabilities for confirmation, then the new snapshot appears in the chart/list and equals dashboard `total_savings + total_investments` / `total_debt`.
9. Account with no real-estate/retirement/skills data: dashboard cures 5/6/7 show "Not tracked" in gray — NOT 0/"Critical"/red. Add one completed skill → cure 7 shows a numeric score; add a `real_estate` investment → cure 5 numeric; add an `ira` investment + profile annual income → cure 6 numeric and ≤100.
10. Cures 1–4 scores identical before/after this change for the same data (regression check — capture dashboard JSON before Phase 3 lands).

**Global:**
11. `npx tsc --noEmit` and `npx next build` exit 0; `git check-ignore web/src/lib/wealth-education.ts` outputs nothing; `git diff` contains no changes under `MOSEE/`, `web/src/app/knowledge/`, or any `.gitignore`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `cure_scores` type change (`number` → `number \| null`) breaks an unmapped consumer (e.g. `WealthTreeVisualization`) | Medium | Task 3.5 explicitly mandates a `tsc`-driven sweep of all consumers; reviewer focus item; regression check #10. |
| Fabricated/misattributed guru quotes | Medium | `attribution` field forces the choice at authoring time; tester spot-checks 5 quotes (criterion #5); paraphrases render unquoted. |
| TeachingCard hydration mismatch from random selection | Medium | Deterministic day-of-year initial index specified in task 2.1; tester checks console (criterion #2). |
| Cure 6 "10× income" heuristic reads as authoritative advice | Low | `null` when inputs are missing; code comment labels it a heuristic; CureCard already shows a coarse 0–100 band, not a dollar prescription. |
| Calculator tab refactor regresses the working compound flow | Low | Task 3.3 keeps existing compound UI untouched inside its tab; criterion #7 covers both tabs. |
| Registry grows unwieldy as Patrick adds books | Low | Single-file typed registry is fine to ~20 books; if it outgrows that, split into `web/src/lib/wealth-education/` per-book modules — no consumer API change. |
| Auto-snapshot double-counts (e.g. savings entries that were later invested) | Low | Confirm step shows derived numbers before POST; breakdown stored per snapshot so anomalies are inspectable; manual entry remains available. |

## Ambiguities flagged (simplest reading taken)
- "The entire wealth section" could imply redesigning existing tools; read as **complete + differentiate**, per Jimmy's steer — existing tool UIs only gain an additive teaching card.
- Patrick's exact book list is unknown; seeded the 8 that match MOSEE's scoring lenses + in-app references. The registry shape makes adding his actual list a content-only follow-up — confirm the list with Patrick before or during Phase 1.
- Cure 6 scoring has no canonical formula; chose the common 10×-income retirement heuristic with `null` fallbacks rather than inventing a proprietary score. If Patrick wants something richer (age-adjusted glide path), that's a follow-up, possibly with actuary council input.
