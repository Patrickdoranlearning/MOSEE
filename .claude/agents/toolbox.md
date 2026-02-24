# MOSEE Agent Toolbox

Pre-built multi-agent workflows. Each tool spawns multiple agents in parallel, then the conductor synthesizes results.

---

## Tool 1: The War Room

**Trigger:** "war room" + topic
**Agents:** Buffett + Munger + Actuary (parallel debate)
**Purpose:** Stress-test any idea. Buffett evaluates the investment logic, Munger inverts to find flaws, the Actuary quantifies the risk.

**Best for:** Evaluating a proposed change to scoring, thresholds, or verdict logic before implementing it.

**Example:** "War room: Should we lower the MoS threshold for A-grade stocks?"

---

## Tool 2: The Quant Bench

**Trigger:** "quant bench" + topic
**Agents:** Lopez de Prado + Actuary + Data Engineer (parallel debate)
**Purpose:** Evaluate anything involving numbers, statistics, or data rigor. Lopez de Prado checks for overfitting and false discoveries, the Actuary checks probability assumptions, the Data Engineer checks data quality.

**Best for:** Reviewing formulas, thresholds, confidence calculations, growth projections, or any new quantitative feature.

**Example:** "Quant bench: Is the confidence scoring in confidence.py statistically sound?"

---

## Tool 3: The Build Squad

**Trigger:** "build squad" + topic
**Agents:** Software Engineer + Data Engineer (parallel)
**Purpose:** Technical review of any code, architecture, or infrastructure change. The Software Engineer reviews code quality and architecture, the Data Engineer reviews data flow and reliability.

**Best for:** Code reviews, refactoring plans, new module design, database changes, pipeline improvements.

**Example:** "Build squad: Review the rate_limiter.py caching strategy"

---

## Tool 4: The Investment Committee

**Trigger:** "investment committee" + topic
**Agents:** Buffett + Munger + Fisher + Lopez de Prado (parallel debate)
**Purpose:** All four investment-minded agents evaluate a methodology question from their distinct perspectives. Value vs growth vs quant vs mental models.

**Best for:** Major methodology decisions — adding new scoring dimensions, changing how verdicts work, evaluating new investment factors.

**Example:** "Investment committee: Should MOSEE incorporate insider buying/selling data?"

---

## Tool 5: The Stress Test

**Trigger:** "stress test" + topic
**Agents:** Munger + Actuary + Lopez de Prado (parallel)
**Purpose:** Pure adversarial analysis. Munger inverts, the Actuary models tail risk, Lopez de Prado checks for overfitting. No optimists allowed.

**Best for:** Before deploying any change to production. Finding everything that could go wrong.

**Example:** "Stress test: Our new quality-adjusted MoS thresholds"

---

## Tool 6: The Full Council

**Trigger:** "full council" + topic
**Agents:** All 7 agents (parallel debate)
**Purpose:** Maximum perspectives. Every agent weighs in independently, then the conductor synthesizes consensus, disagreements, and recommended actions.

**Best for:** Major architectural decisions, quarterly reviews of MOSEE's overall approach, or when you're genuinely unsure which perspectives matter most.

**Example:** "Full council: How should MOSEE handle cyclical companies?"

---

## Tool 7: The Due Diligence

**Trigger:** "due diligence" + topic
**Agents:** Buffett + Fisher + Data Engineer (parallel)
**Purpose:** Evaluate whether MOSEE is capturing the right data and signals for a specific type of analysis. Buffett checks value signals, Fisher checks growth signals, Data Engineer checks data availability and quality.

**Best for:** Evaluating coverage gaps — what data is MOSEE missing? What qualitative factors can't be captured?

**Example:** "Due diligence: Are we capturing enough signals to evaluate tech companies?"

---

## Tool 8: The Architect Table

**Trigger:** "architect table" + topic
**Agents:** Software Engineer + Data Engineer + Munger (parallel)
**Purpose:** Design review combining engineering rigor with Munger's mental models. The engineers evaluate feasibility and architecture, Munger identifies hidden complexity and second-order effects.

**Best for:** Planning new features, major refactors, or system redesigns before writing code.

**Example:** "Architect table: Design a historical performance tracking system for MOSEE verdicts"

---

## Quick Reference

| Tool | Trigger | Agents | Use When |
|------|---------|--------|----------|
| War Room | "war room" | Buffett + Munger + Actuary | Stress-test an idea |
| Quant Bench | "quant bench" | Lopez de Prado + Actuary + Data Eng | Review numbers & stats |
| Build Squad | "build squad" | Software Eng + Data Eng | Code & architecture review |
| Investment Committee | "investment committee" | Buffett + Munger + Fisher + LdP | Methodology decisions |
| Stress Test | "stress test" | Munger + Actuary + Lopez de Prado | Find everything that could break |
| Full Council | "full council" | All 7 | Maximum perspectives |
| Due Diligence | "due diligence" | Buffett + Fisher + Data Eng | Coverage & signal gaps |
| Architect Table | "architect table" | Software Eng + Data Eng + Munger | Design & planning |
