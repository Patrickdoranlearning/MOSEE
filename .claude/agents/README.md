# MOSEE Agent Council

A network of specialized advisory agents that help develop and improve the MOSEE investment analysis platform. Each agent embodies a distinct personality and domain expertise.

## Architecture

```
You (Patrick)
    |
    v
Claude Code (THE CONDUCTOR)
    |  Reads agent prompts from .claude/agents/prompts/
    |  Spawns sub-agents via Task tool
    |  Orchestrates pipeline & debate modes
    |  Synthesizes results
    |
    +-- Warren Buffett        (value investing, moats, margin of safety)
    +-- Charlie Munger         (mental models, inversion, bias detection)
    +-- Philip A. Fisher       (growth investing, scuttlebutt, qualitative)
    +-- Marcos Lopez de Prado  (quant ML, backtesting, statistical rigor)
    +-- Software Engineer      (code quality, architecture, testing)
    +-- Data Engineer          (pipelines, data quality, schema design)
    +-- Actuary                (risk modeling, probability, tail risk)
```

## Agents

### Investment Philosophy Agents

| Agent | File | Focus |
|-------|------|-------|
| Warren Buffett | `prompts/buffett.md` | Value investing, moats, owner earnings, margin of safety, range-based valuation |
| Charlie Munger | `prompts/munger.md` | Mental models, inversion thinking, behavioral biases, multidisciplinary analysis |
| Philip A. Fisher | `prompts/fisher.md` | Growth quality, scuttlebutt method, 15 Points framework, long-term conviction |

### Quantitative Agent

| Agent | File | Focus |
|-------|------|-------|
| Marcos Lopez de Prado | `prompts/lopez_de_prado.md` | Financial ML, backtest overfitting, feature importance, triple-barrier method, bet sizing |

### Technical Agents

| Agent | File | Focus |
|-------|------|-------|
| Software Engineer | `prompts/software_engineer.md` | Code quality, SOLID principles, testing, performance, DRY, architecture |
| Data Engineer | `prompts/data_engineer.md` | Data pipelines, yfinance reliability, caching, database schema, data quality |
| Actuary | `prompts/actuary.md` | Risk modeling, probability distributions, confidence calibration, tail risk |

## Interaction Modes

### Single Agent
Ask one agent directly:
> "Ask Buffett to review the margin of safety thresholds"

### Pipeline Mode
Sequential — each agent sees previous responses:
> "Run a methodology review"

### Debate Mode
Parallel — agents respond independently, conductor synthesizes:
> "Debate: Should we add momentum?"

### Council Mode
All 7 agents weigh in:
> "Convene the full council"

## Toolbox — Multi-Agent Workflows

Pre-built parallel combinations defined in `toolbox.md`:

| Trigger | Agents | Purpose |
|---------|--------|---------|
| **war room** | Buffett + Munger + Actuary | Stress-test any idea |
| **quant bench** | Lopez de Prado + Actuary + Data Eng | Review numbers & stats |
| **build squad** | Software Eng + Data Eng | Code & architecture review |
| **investment committee** | Buffett + Munger + Fisher + LdP | Methodology decisions |
| **stress test** | Munger + Actuary + Lopez de Prado | Find everything that could break |
| **full council** | All 7 | Maximum perspectives |
| **due diligence** | Buffett + Fisher + Data Eng | Coverage & signal gaps |
| **architect table** | Software Eng + Data Eng + Munger | Design & planning |

## Predefined Pipelines (Sequential)

- **methodology-review**: Buffett -> Munger -> Fisher -> Lopez de Prado
- **code-review**: Software Engineer -> Data Engineer
- **risk-assessment**: Actuary -> Munger -> Lopez de Prado
- **new-feature**: Buffett -> Fisher -> Software Engineer -> Data Engineer
- **valuation-audit**: Buffett -> Munger -> Actuary -> Lopez de Prado

## Adding a New Agent

1. Create a new `.md` file in `prompts/` following the existing format:
   - Identity section
   - Personality & Communication Style
   - Core Principles
   - Expertise Areas (mapped to MOSEE modules)
   - Response Format
   - Boundaries
2. Add the agent to the table in `CLAUDE.md`
3. The conductor will automatically be able to spawn it

## Design Principles

- **Agents have full tool access** — they can Read, Grep, Glob the MOSEE codebase
- **Agents stay in character** — each has distinct voice, principles, and boundaries
- **Agents stay in their lane** — investment agents don't advise on code, engineers don't advise on methodology
- **The conductor synthesizes** — individual agent responses are combined into consensus/disagreements/actions
- **Stateless between sessions** — each invocation starts fresh; prompts are durable, conversations are not
