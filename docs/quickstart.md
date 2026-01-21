# MOSEE Quick Start Guide

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/MOSEE_2.0.git
cd MOSEE_2.0

# Install dependencies
pip install -r requirements.txt

# Install MOSEE package
pip install -e .
```

## Basic Usage

### 1. Run the Full Screener

```bash
cd scripts
python run_mosee.py
```

This will:
- Load tickers from `data/ticker_data_enhanced.csv`
- Analyze each stock using all investment book metrics
- Generate a CSV shortlist with scores
- Create PDF reports for top stocks

### 2. Analyze a Single Stock

```python
from MOSEE import generate_mosee_intelligence
from MOSEE.data_retrieval.fundamental_data import fundamental_downloads
from MOSEE.data_retrieval.market_data import get_stock_data

# Get data
ticker = "AAPL"
fundamentals = fundamental_downloads(ticker)
stock_data, market_cap, currency = get_stock_data(ticker, "2020-01-01", "2024-01-01")

# Calculate metrics (simplified - see run_mosee.py for full implementation)
metrics = {
    'eps': 6.50,
    'book_value_per_share': 4.25,
    'roe': 0.25,
    'roic': 0.22,
    'earnings_growth': 0.15,
    'pe_ratio': 28,
    'pb_ratio': 7.5,
    'current_ratio': 1.2,
    # ... more metrics
}

# Generate intelligence report
report = generate_mosee_intelligence(
    ticker=ticker,
    current_price=185.00,
    metrics=metrics
)

# View results
print(report.summary())
print(f"\nVerdict: {report.verdict.value}")
print(f"Buy below: ${report.buy_below_price:.2f}")
```

### 3. Using Filters

```python
from MOSEE.filters import FilterConfig, apply_filters
import pandas as pd

# Load tickers
tickers = pd.read_csv('data/ticker_data_enhanced.csv')

# Create filter
filters = FilterConfig(
    countries=["United States", "United Kingdom"],
    exclude_countries=["Russia", "China"],
    cap_sizes=["mega", "large"],
    min_confidence="MEDIUM"
)

# Apply filters
filtered_tickers = apply_filters(tickers, filters)
print(f"Filtered to {len(filtered_tickers)} tickers")
```

### 4. Working with Valuation Ranges

```python
from MOSEE.valuation_range import build_composite_valuation

# Build valuation range
valuation = build_composite_valuation(
    ticker="MSFT",
    metrics={
        'eps': 11.50,
        'book_value_per_share': 30.00,
        'roe': 0.35,
        'earnings_growth': 0.12,
        'free_cash_flow': 65_000_000_000,
        'shares_outstanding': 7_500_000_000,
    },
    quality_score=80
)

# Check current price against range
current_price = 380.00
verdict = valuation.get_verdict(current_price)

print(f"Valuation Range:")
print(f"  Conservative: ${valuation.composite_conservative:.2f}")
print(f"  Base: ${valuation.composite_base:.2f}")
print(f"  Optimistic: ${valuation.composite_optimistic:.2f}")
print(f"\nMargin of Safety: {verdict['margin_of_safety']:.2%}")
print(f"Has MoS: {verdict['has_margin_of_safety']}")
print(f"Buy Below: ${verdict['buy_below_price']:.2f}")
print(f"\n{verdict['insight']}")
```

### 5. Using Investment Style Weights

```python
from MOSEE.scoring import calculate_composite_score, InvestmentStyle

# Different styles emphasize different metrics
styles = [
    InvestmentStyle.DEEP_VALUE,      # Graham/Klarman focus
    InvestmentStyle.QUALITY_VALUE,   # Buffett/Munger focus
    InvestmentStyle.GARP,            # Lynch focus
    InvestmentStyle.MAGIC_FORMULA,   # Greenblatt focus
    InvestmentStyle.GROWTH,          # Fisher focus
    InvestmentStyle.BALANCED,        # Equal weighting
]

for style in styles:
    score = calculate_composite_score("AAPL", metrics, style)
    print(f"{style.value}: {score.total_score:.1f} ({score.grade})")
```

## Output Formats

### CSV Output
The main screener outputs a CSV with columns:

| Category | Columns |
|----------|---------|
| Basic | Ticker, Current Price, Market Cap |
| Original MOSEE | PAD MoS, DCF MoS, Book MoS, MOSEE scores |
| Graham | Graham Number, Graham Score (0-7), P/E, P/B |
| Buffett | Owner Earnings, ROE, ROIC, Debt/Equity |
| Lynch | PEG Ratio, Lynch Category, Net Cash |
| Greenblatt | Earnings Yield, Return on Capital |
| Fisher | Sales CAGR, Margin Trend, Growth Quality |
| Composite | Composite Score, Grade (A-F) |

### Intelligence Report
```
════════════════════════════════════════════════════════════
MOSEE INTELLIGENCE REPORT: AAPL
════════════════════════════════════════════════════════════

CURRENT PRICE: $185.00

VALUATION RANGE:
  Conservative: $145.00
  Base:         $185.00  
  Optimistic:   $220.00

QUALITY: A (82/100)

MARGIN OF SAFETY: 127.6% of conservative value
  ✗ NO margin of safety
  Buy below: $101.50

VERDICT: WATCHLIST

MULTI-LENS PERSPECTIVES:
  Graham: D - Avoid
    P/E of 28 exceeds Graham's limits.
  Buffett: A - Quality Business
    Excellent economics: ROE 25%, ROIC 22%.
  Lynch: B - Buy  
    Good PEG of 1.1 for growth rate.
  Fisher: A - Excellent Growth
    Strong growth with improving margins.

STRENGTHS:
  + High quality business (score: 82)
  + Strong ROE of 25.0%
  + Excellent ROIC of 22.0%

CONCERNS:
  - No margin of safety - trading at 128% of conservative value

ACTION ITEMS:
  → Add to watchlist - quality company but needs better price
  → Set price alert at $101.50 for margin of safety
════════════════════════════════════════════════════════════
```

## Configuration Options

### run_mosee.py Settings

```python
# Data sources
tickers_csv = '../data/ticker_data_enhanced.csv'
forex_csv = '../outputs/forex_data_update.csv'

# Date range
start_date = '2020-01-01'
end_date = None  # Use today

# Output options
save_shortlist = '../outputs/shortlist.csv'
take_top_X = 500
minimum_MOS = None  # Filter by max MoS ratio

# Run options
test_and_debug = True   # Only 10 tickers for testing
batch_run = True
batch_size = 100

# PDF reports
generate_pdfs = True
pdf_count = 10
```

## Next Steps

1. **Customize filters** - Focus on your preferred markets/sectors
2. **Adjust style weights** - Match your investment philosophy
3. **Set up alerts** - Monitor watchlist stocks for price drops
4. **Review regularly** - Re-run analysis monthly
5. **Track history** - Use HistoryTracker for month-over-month changes

## Need Help?

- Check the [Architecture](./architecture.md) for system design
- See [Book Intelligence](./book-intelligence.md) for metric details
- Read [Valuation Range](./valuation-range.md) for valuation methodology
- Review [Decision Framework](./decision-framework.md) for verdict logic
