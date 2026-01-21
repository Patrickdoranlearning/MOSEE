# MOSEE Documentation

**MOSEE - Margin of Safety & Earnings to Equity**

Version 2.1.0

## Overview

MOSEE is an intelligent investment analysis system that combines wisdom from classic value investing books into a comprehensive stock screening and analysis framework.

## Documentation Index

| Document | Description |
|----------|-------------|
| [System Architecture](./architecture.md) | Overall system design and data flow |
| [Investment Book Intelligence](./book-intelligence.md) | Metrics from each investment philosophy |
| [Valuation Range Framework](./valuation-range.md) | Range-based valuation approach |
| [Decision Framework](./decision-framework.md) | How MOSEE makes recommendations |
| [API Reference](./api-reference.md) | Module and function documentation |
| [Quick Start Guide](./quickstart.md) | Getting started with MOSEE |

## Core Philosophy

MOSEE is built on three foundational principles:

1. **Value is a Range, Not a Number** - We acknowledge uncertainty in all valuations
2. **Quality Affects Fair Value** - Better businesses deserve higher multiples
3. **Margin of Safety is Non-Negotiable** - Always buy below conservative value

## Source Books

The intelligence in MOSEE comes from these classic investing texts:

- **Benjamin Graham** - The Intelligent Investor, Security Analysis
- **Warren Buffett** - Berkshire Hathaway Letters to Shareholders
- **Charlie Munger** - Poor Charlie's Almanack
- **Seth Klarman** - Margin of Safety
- **Peter Lynch** - One Up on Wall Street
- **Joel Greenblatt** - The Little Book That Beats the Market
- **Philip Fisher** - Common Stocks and Uncommon Profits
- **Robert Hagstrom** - The Warren Buffett Way
- **George Clason** - The Richest Man in Babylon

## Quick Example

```python
from MOSEE import generate_mosee_intelligence

report = generate_mosee_intelligence(
    ticker="AAPL",
    current_price=185.00,
    metrics=calculated_metrics
)

print(report.summary())
# Output:
# VERDICT: WATCHLIST
# Quality company but no margin of safety.
# Buy below: $142.50
```

## License

MIT License - See LICENSE file for details.
