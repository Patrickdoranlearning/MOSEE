# MOSEE API Reference

## Main Package (MOSEE)

### Core Functions

#### `mos_dollar(market_value, value_marker)`
Calculate margin of safety as a ratio.

```python
from MOSEE import mos_dollar

mos = mos_dollar(market_value=100, value_marker=150)
# Returns: 0.67 (paying $0.67 for each $1 of value)
```

#### `generate_mosee_intelligence(ticker, current_price, metrics, required_mos=0.7)`
Generate comprehensive intelligence report.

```python
from MOSEE import generate_mosee_intelligence

report = generate_mosee_intelligence(
    ticker="AAPL",
    current_price=185.00,
    metrics={...},
    required_mos=0.7
)

print(report.summary())
print(report.verdict)  # InvestmentVerdict enum
```

**Returns:** `MOSEEIntelligenceReport`

---

## Data Retrieval Module

### `fundamental_downloads(ticker)`
Download all fundamental data for a ticker.

```python
from MOSEE.data_retrieval.fundamental_data import fundamental_downloads

data = fundamental_downloads("AAPL")
# Returns dict with:
# - balance_sheet_statements
# - cash_flow_statements
# - income_sheet_statements
```

### `balance_sheet_data_dic(balance_sheet_statements)`
Extract key balance sheet metrics.

```python
from MOSEE.data_retrieval.fundamental_data import balance_sheet_data_dic

bs_data = balance_sheet_data_dic(data['balance_sheet_statements'])
# Returns dict with:
# - cash_onhand, current_assets, current_liabilities
# - total_assets, total_liabilities, tangible_assets
# - total_debt, stockholders_equity, inventory, net_ppe
```

### `income_statement_data_dic(income_statement)`
Extract key income statement metrics.

```python
from MOSEE.data_retrieval.fundamental_data import income_statement_data_dic

income_data = income_statement_data_dic(data['income_sheet_statements'])
# Returns dict with:
# - revenue, ebit, net_income, interest_expense
# - gross_margin, operating_margin, net_margin
# - eps, tax_rate
```

### `get_owners_earnings(income_statement, cash_flow_statement)`
Calculate Buffett's owner earnings.

```python
from MOSEE.data_retrieval.fundamental_data import get_owners_earnings

oe = get_owners_earnings(income_stmt, cash_flow)
# Returns dict with:
# - owners_earnings (Series)
# - owners_earnings_latest, owners_earnings_avg
# - depreciation, capex, avg_capex
```

### `get_invested_capital(balance_sheet_statements)`
Calculate invested capital for ROIC.

```python
from MOSEE.data_retrieval.fundamental_data import get_invested_capital

ic = get_invested_capital(balance_sheet)
# Returns dict with:
# - invested_capital (Series)
# - invested_capital_latest, invested_capital_avg
```

---

## Fundamental Analysis Module

### Graham Metrics

#### `calculate_graham_number(eps, book_value_per_share)`
```python
from MOSEE.fundamental_analysis import calculate_graham_number

graham_num = calculate_graham_number(eps=5.0, book_value_per_share=25.0)
# Returns: 75.0 (max price Graham would pay)
```

#### `calculate_graham_defensive_criteria(...)`
```python
from MOSEE.fundamental_analysis import calculate_graham_defensive_criteria

criteria = calculate_graham_defensive_criteria(
    revenue=10_000_000_000,
    current_assets=5_000_000_000,
    current_liabilities=2_000_000_000,
    long_term_debt=1_000_000_000,
    net_income_history=net_income_series,
    dividends_history=dividends_series,
    eps_current=5.0,
    eps_10yr_ago=3.0,
    current_price=75.0,
    book_value_per_share=25.0
)

print(f"Score: {criteria.score}/7")
print(f"Passed: {criteria.criteria_passed}")
```

**Returns:** `GrahamCriteriaResult`

### Buffett/Munger Metrics

#### `calculate_roe(net_income, stockholders_equity)`
```python
from MOSEE.fundamental_analysis import calculate_roe

roe = calculate_roe(net_income=1_000_000, stockholders_equity=5_000_000)
# Returns: 0.20 (20%)
```

#### `calculate_roic(nopat, invested_capital)`
```python
from MOSEE.fundamental_analysis import calculate_roic

roic = calculate_roic(nopat=800_000, invested_capital=6_000_000)
# Returns: 0.133 (13.3%)
```

#### `calculate_interest_coverage(ebit, interest_expense)`
```python
from MOSEE.fundamental_analysis import calculate_interest_coverage

coverage = calculate_interest_coverage(ebit=500_000, interest_expense=50_000)
# Returns: 10.0 (10x coverage)
```

### Lynch Metrics

#### `get_lynch_metrics(...)`
```python
from MOSEE.fundamental_analysis import get_lynch_metrics

lynch = get_lynch_metrics(
    current_price=150.0,
    eps=5.0,
    earnings_growth_rate=0.15,
    cash=10_000_000_000,
    total_debt=5_000_000_000,
    shares_outstanding=1_000_000_000
)

print(f"PEG: {lynch['peg_ratio']}")
print(f"Category: {lynch['lynch_category']}")
print(f"Net Cash/Share: ${lynch['net_cash_per_share']}")
```

### Greenblatt Magic Formula

#### `calculate_magic_formula_metrics(...)`
```python
from MOSEE.fundamental_analysis import calculate_magic_formula_metrics

mf = calculate_magic_formula_metrics(
    ticker="AAPL",
    ebit=100_000_000_000,
    market_cap=2_500_000_000_000,
    total_debt=100_000_000_000,
    cash=50_000_000_000,
    current_assets=150_000_000_000,
    current_liabilities=100_000_000_000,
    net_ppe=40_000_000_000
)

print(f"Earnings Yield: {mf.earnings_yield:.2%}")
print(f"Return on Capital: {mf.return_on_capital:.2%}")
```

**Returns:** `MagicFormulaResult`

### Fisher Growth Metrics

#### `get_fisher_metrics(...)`
```python
from MOSEE.fundamental_analysis import get_fisher_metrics

fisher = get_fisher_metrics(
    revenue_series=revenue_df,
    operating_margin_series=margin_df,
    net_income_series=net_income_df,
    roe=0.25
)

print(f"Sales CAGR: {fisher.sales_cagr:.2%}")
print(f"Margin Trend: {fisher.margin_trend}")
print(f"Growth Quality: {fisher.growth_quality_score}")
```

**Returns:** `GrowthMetricsResult`

---

## Valuation Range Module

### `build_composite_valuation(ticker, metrics, quality_score)`
```python
from MOSEE.valuation_range import build_composite_valuation

valuation = build_composite_valuation(
    ticker="AAPL",
    metrics={
        'eps': 6.50,
        'book_value_per_share': 4.25,
        'roe': 0.25,
        'earnings_growth': 0.15,
        'free_cash_flow': 100_000_000_000,
        'shares_outstanding': 15_000_000_000
    },
    quality_score=80
)

print(f"Conservative: ${valuation.composite_conservative}")
print(f"Base: ${valuation.composite_base}")
print(f"Optimistic: ${valuation.composite_optimistic}")
```

**Returns:** `CompositeValuationRange`

### `CompositeValuationRange.get_verdict(current_price, required_mos=0.7)`
```python
verdict = valuation.get_verdict(current_price=185.00)

print(verdict['recommendation'])
print(verdict['has_margin_of_safety'])
print(verdict['buy_below_price'])
print(verdict['insight'])
```

---

## Scoring Module

### `calculate_composite_score(ticker, metrics, style)`
```python
from MOSEE.scoring import calculate_composite_score, InvestmentStyle

score = calculate_composite_score(
    ticker="AAPL",
    metrics={...},
    style=InvestmentStyle.BALANCED
)

print(f"Total Score: {score.total_score}")
print(f"Grade: {score.grade}")
print(f"Recommendation: {score.recommendation}")
```

**Returns:** `CompositeScore`

### Investment Styles

```python
from MOSEE.scoring import InvestmentStyle

InvestmentStyle.DEEP_VALUE       # Graham/Klarman focus
InvestmentStyle.QUALITY_VALUE   # Buffett/Munger focus
InvestmentStyle.GARP            # Lynch focus
InvestmentStyle.MAGIC_FORMULA   # Greenblatt focus
InvestmentStyle.GROWTH          # Fisher focus
InvestmentStyle.BALANCED        # Equal weighting
```

---

## Filter Module

### `FilterConfig`
```python
from MOSEE.filters import FilterConfig

filters = FilterConfig(
    countries=["United States"],
    exclude_countries=["Russia", "China"],
    cap_sizes=["mega", "large"],
    industries=None,  # All industries
    min_confidence="MEDIUM"
)
```

### `apply_filters(ticker_df, config)`
```python
from MOSEE.filters import apply_filters

filtered = apply_filters(tickers_df, filters)
```

---

## Data Classes Reference

### `MOSEEIntelligenceReport`
```python
@dataclass
class MOSEEIntelligenceReport:
    ticker: str
    current_price: float
    valuation: CompositeValuationRange
    quality_score: float
    quality_grade: str
    margin_of_safety: float
    has_margin_of_safety: bool
    buy_below_price: float
    lenses: List[InvestmentLens]
    verdict: InvestmentVerdict
    recommendation: str
    confidence: str
    strengths: List[str]
    concerns: List[str]
    action_items: List[str]
    
    def summary(self) -> str: ...
    def to_dict(self) -> Dict: ...
```

### `ValuationRange`
```python
@dataclass
class ValuationRange:
    conservative: float
    base: float
    optimistic: float
    method: str
    confidence: ValueConfidence
    
    def margin_of_safety(self, price: float) -> float: ...
    def is_buyable(self, price: float, required_mos: float) -> bool: ...
    def buy_below_price(self, required_mos: float) -> float: ...
```

### `InvestmentVerdict` (Enum)
```python
class InvestmentVerdict(Enum):
    STRONG_BUY = "STRONG BUY"
    BUY = "BUY"
    ACCUMULATE = "ACCUMULATE"
    HOLD = "HOLD"
    WATCHLIST = "WATCHLIST"
    REDUCE = "REDUCE"
    SELL = "SELL"
    AVOID = "AVOID"
    INSUFFICIENT_DATA = "INSUFFICIENT DATA"
```
