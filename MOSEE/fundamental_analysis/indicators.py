"""
MOSEE Fundamental Indicators Module

Contains investment criteria from classic value investing books:
- Benjamin Graham: Graham Number, 7 Defensive Criteria
- Warren Buffett: ROE, ROIC, Owner Earnings metrics
- Various quality and efficiency ratios
"""

import math
import pandas as pd
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass


# =============================================================================
# GRAHAM METRICS (The Intelligent Investor, Security Analysis)
# =============================================================================

@dataclass
class GrahamCriteriaResult:
    """Results of Graham's 7 Defensive Criteria check."""
    score: int  # 0-7, number of criteria passed
    max_score: int  # Always 7
    criteria_passed: List[str]
    criteria_failed: List[str]
    details: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "max_score": self.max_score,
            "criteria_passed": self.criteria_passed,
            "criteria_failed": self.criteria_failed,
            "details": self.details
        }


def calculate_graham_number(eps: float, book_value_per_share: float) -> float:
    """
    Calculate Graham Number - the maximum price a defensive investor should pay.
    
    Formula: Graham Number = sqrt(22.5 × EPS × Book Value Per Share)
    
    The 22.5 comes from Graham's criteria that:
    - P/E should not exceed 15
    - P/B should not exceed 1.5
    - Therefore P/E × P/B should not exceed 22.5
    
    Source: The Intelligent Investor, Chapter 14
    
    Args:
        eps: Earnings per share (trailing twelve months)
        book_value_per_share: Book value per share
        
    Returns:
        Graham Number (maximum fair price per share)
    """
    if eps <= 0 or book_value_per_share <= 0:
        return 0.0
    
    graham_number = math.sqrt(22.5 * eps * book_value_per_share)
    return graham_number


def calculate_graham_defensive_criteria(
    revenue: float,
    current_assets: float,
    current_liabilities: float,
    long_term_debt: float,
    net_income_history: pd.Series,
    dividends_history: pd.Series,
    eps_current: float,
    eps_10yr_ago: float,
    current_price: float,
    book_value_per_share: float,
    revenue_threshold: float = 500_000_000,  # $500M default
    years_required: int = 5
) -> GrahamCriteriaResult:
    """
    Evaluate Graham's 7 Defensive Criteria from The Intelligent Investor.
    
    The 7 Criteria:
    1. Adequate Size - Revenue > threshold (default $500M)
    2. Strong Financial Condition - Current Ratio >= 2.0
    3. Earnings Stability - Positive earnings each of last N years
    4. Dividend Record - Uninterrupted dividends for N+ years
    5. Earnings Growth - EPS growth >= 33% over 10 years (using start/end)
    6. Moderate P/E - P/E <= 15
    7. Moderate P/B - P/B <= 1.5 (or P/E × P/B <= 22.5)
    
    Args:
        revenue: Annual revenue (latest)
        current_assets: Total current assets
        current_liabilities: Total current liabilities
        long_term_debt: Long-term debt
        net_income_history: Series of net income values
        dividends_history: Series of dividend values
        eps_current: Current EPS
        eps_10yr_ago: EPS from 10 years ago (or earliest available)
        current_price: Current stock price
        book_value_per_share: Book value per share
        revenue_threshold: Minimum revenue for adequate size
        years_required: Years of data required for stability checks
        
    Returns:
        GrahamCriteriaResult with score and details
    """
    criteria_passed = []
    criteria_failed = []
    details = {}
    
    # 1. Adequate Size
    if revenue >= revenue_threshold:
        criteria_passed.append("adequate_size")
        details["adequate_size"] = f"Revenue ${revenue/1e9:.1f}B >= ${revenue_threshold/1e9:.1f}B threshold"
    else:
        criteria_failed.append("adequate_size")
        details["adequate_size"] = f"Revenue ${revenue/1e9:.1f}B < ${revenue_threshold/1e9:.1f}B threshold"
    
    # 2. Strong Financial Condition (Current Ratio >= 2.0)
    current_ratio = current_assets / current_liabilities if current_liabilities > 0 else 0
    details["current_ratio"] = round(current_ratio, 2)
    if current_ratio >= 2.0:
        criteria_passed.append("strong_financial_condition")
        details["strong_financial_condition"] = f"Current Ratio {current_ratio:.2f} >= 2.0"
    else:
        criteria_failed.append("strong_financial_condition")
        details["strong_financial_condition"] = f"Current Ratio {current_ratio:.2f} < 2.0"
    
    # 3. Earnings Stability (positive earnings each year)
    if isinstance(net_income_history, pd.Series) and len(net_income_history) >= years_required:
        positive_years = (net_income_history > 0).sum()
        total_years = len(net_income_history)
        details["earnings_years_positive"] = f"{positive_years}/{total_years}"
        if positive_years == total_years:
            criteria_passed.append("earnings_stability")
            details["earnings_stability"] = f"Positive earnings all {total_years} years"
        else:
            criteria_failed.append("earnings_stability")
            details["earnings_stability"] = f"Only {positive_years}/{total_years} years profitable"
    else:
        criteria_failed.append("earnings_stability")
        details["earnings_stability"] = "Insufficient earnings history"
    
    # 4. Dividend Record (uninterrupted dividends)
    if isinstance(dividends_history, pd.Series) and len(dividends_history) >= years_required:
        dividend_years = (dividends_history > 0).sum()
        total_years = len(dividends_history)
        details["dividend_years"] = f"{dividend_years}/{total_years}"
        if dividend_years >= years_required:
            criteria_passed.append("dividend_record")
            details["dividend_record"] = f"Dividends paid {dividend_years} consecutive years"
        else:
            criteria_failed.append("dividend_record")
            details["dividend_record"] = f"Only {dividend_years} years of dividends"
    else:
        criteria_failed.append("dividend_record")
        details["dividend_record"] = "Insufficient dividend history"
    
    # 5. Earnings Growth (>= 33% over 10 years, or ~3% CAGR)
    if eps_10yr_ago > 0 and eps_current > 0:
        eps_growth = (eps_current - eps_10yr_ago) / eps_10yr_ago
        details["eps_growth_pct"] = round(eps_growth * 100, 1)
        if eps_growth >= 0.33:  # 33% total growth
            criteria_passed.append("earnings_growth")
            details["earnings_growth"] = f"EPS growth {eps_growth:.1%} >= 33%"
        else:
            criteria_failed.append("earnings_growth")
            details["earnings_growth"] = f"EPS growth {eps_growth:.1%} < 33%"
    else:
        criteria_failed.append("earnings_growth")
        details["earnings_growth"] = "Cannot calculate EPS growth"
    
    # 6. Moderate P/E (<= 15)
    pe_ratio = current_price / eps_current if eps_current > 0 else float('inf')
    details["pe_ratio"] = round(pe_ratio, 2) if pe_ratio != float('inf') else None
    if pe_ratio <= 15:
        criteria_passed.append("moderate_pe")
        details["moderate_pe"] = f"P/E {pe_ratio:.1f} <= 15"
    else:
        criteria_failed.append("moderate_pe")
        details["moderate_pe"] = f"P/E {pe_ratio:.1f} > 15"
    
    # 7. Moderate P/B (<= 1.5) or P/E × P/B <= 22.5
    pb_ratio = current_price / book_value_per_share if book_value_per_share > 0 else float('inf')
    pe_pb_product = pe_ratio * pb_ratio if pe_ratio != float('inf') and pb_ratio != float('inf') else float('inf')
    details["pb_ratio"] = round(pb_ratio, 2) if pb_ratio != float('inf') else None
    details["pe_pb_product"] = round(pe_pb_product, 2) if pe_pb_product != float('inf') else None
    
    if pb_ratio <= 1.5 or pe_pb_product <= 22.5:
        criteria_passed.append("moderate_pb")
        if pb_ratio <= 1.5:
            details["moderate_pb"] = f"P/B {pb_ratio:.2f} <= 1.5"
        else:
            details["moderate_pb"] = f"P/E×P/B {pe_pb_product:.1f} <= 22.5"
    else:
        criteria_failed.append("moderate_pb")
        details["moderate_pb"] = f"P/B {pb_ratio:.2f} > 1.5 and P/E×P/B {pe_pb_product:.1f} > 22.5"
    
    return GrahamCriteriaResult(
        score=len(criteria_passed),
        max_score=7,
        criteria_passed=criteria_passed,
        criteria_failed=criteria_failed,
        details=details
    )


def get_graham_margin_of_safety(current_price: float, graham_number: float) -> float:
    """
    Calculate margin of safety based on Graham Number.
    
    Args:
        current_price: Current stock price
        graham_number: Calculated Graham Number
        
    Returns:
        Margin of safety (0.5 = buying $1 for $0.50)
    """
    if graham_number <= 0:
        return float('inf')
    return current_price / graham_number


# =============================================================================
# BUFFETT/MUNGER METRICS (Warren Buffett's Letters, Poor Charlie's Almanack)
# =============================================================================

def calculate_roe(net_income: float, stockholders_equity: float) -> float:
    """
    Calculate Return on Equity.
    
    ROE = Net Income / Stockholders' Equity
    
    Buffett looks for companies with consistent ROE > 15%.
    
    Args:
        net_income: Net income (annual)
        stockholders_equity: Total stockholders' equity
        
    Returns:
        ROE as decimal (0.15 = 15%)
    """
    if stockholders_equity <= 0:
        return 0.0
    return net_income / stockholders_equity


def calculate_roe_history(net_income_series: pd.Series, equity_series: pd.Series) -> Dict[str, Any]:
    """
    Calculate ROE history and consistency metrics.
    
    Args:
        net_income_series: Series of net income values
        equity_series: Series of stockholders equity values
        
    Returns:
        Dictionary with ROE metrics
    """
    if not isinstance(net_income_series, pd.Series) or not isinstance(equity_series, pd.Series):
        return {"roe_latest": 0, "roe_avg": 0, "roe_consistency": 0, "years_above_15pct": 0}
    
    # Align indexes and calculate ROE for each year
    roe_series = net_income_series / equity_series.replace(0, float('nan'))
    roe_series = roe_series.dropna()
    
    if len(roe_series) == 0:
        return {"roe_latest": 0, "roe_avg": 0, "roe_consistency": 0, "years_above_15pct": 0}
    
    roe_latest = roe_series.iloc[-1]
    roe_avg = roe_series.mean()
    roe_std = roe_series.std()
    
    # Consistency score (lower std relative to mean = more consistent)
    roe_consistency = 1 - (roe_std / abs(roe_avg)) if roe_avg != 0 else 0
    roe_consistency = max(0, min(1, roe_consistency))  # Bound between 0 and 1
    
    # Years with ROE > 15%
    years_above_15pct = (roe_series > 0.15).sum()
    
    return {
        "roe_latest": round(roe_latest, 4),
        "roe_avg": round(roe_avg, 4),
        "roe_consistency": round(roe_consistency, 2),
        "years_above_15pct": int(years_above_15pct),
        "total_years": len(roe_series),
        "roe_history": roe_series.to_dict()
    }


def calculate_roic(nopat: float, invested_capital: float) -> float:
    """
    Calculate Return on Invested Capital.
    
    ROIC = NOPAT / Invested Capital
    where NOPAT = EBIT × (1 - Tax Rate)
    
    Buffett and Greenblatt look for ROIC > 10% consistently.
    
    Args:
        nopat: Net Operating Profit After Tax
        invested_capital: Total invested capital
        
    Returns:
        ROIC as decimal (0.10 = 10%)
    """
    if invested_capital <= 0:
        return 0.0
    return nopat / invested_capital


def calculate_interest_coverage(ebit: float, interest_expense: float) -> float:
    """
    Calculate Interest Coverage Ratio.
    
    Interest Coverage = EBIT / Interest Expense
    
    Measures ability to pay debt obligations. Buffett looks for >= 5x coverage.
    
    Args:
        ebit: Earnings Before Interest and Taxes
        interest_expense: Annual interest expense
        
    Returns:
        Interest coverage ratio
    """
    if interest_expense <= 0:
        return float('inf')  # No debt = infinite coverage
    return ebit / interest_expense


def calculate_debt_to_equity(total_debt: float, stockholders_equity: float) -> float:
    """
    Calculate Debt to Equity ratio.
    
    Lower is better. Buffett prefers companies with low debt.
    
    Args:
        total_debt: Total debt (short + long term)
        stockholders_equity: Total stockholders' equity
        
    Returns:
        Debt to equity ratio
    """
    if stockholders_equity <= 0:
        return float('inf')
    return total_debt / stockholders_equity


# =============================================================================
# PETER LYNCH METRICS (One Up on Wall Street)
# =============================================================================

class LynchCategory:
    """Peter Lynch's stock categories."""
    SLOW_GROWER = "Slow Grower"      # < 5% growth (utilities, mature companies)
    STALWART = "Stalwart"             # 5-12% growth (large, stable companies)
    FAST_GROWER = "Fast Grower"       # > 12% growth (smaller, aggressive growers)
    CYCLICAL = "Cyclical"             # Earnings tied to economic cycles
    TURNAROUND = "Turnaround"         # Company recovering from problems
    ASSET_PLAY = "Asset Play"         # Hidden asset value


def calculate_peg_ratio(pe_ratio: float, earnings_growth_rate: float) -> float:
    """
    Calculate PEG Ratio (Price/Earnings to Growth).
    
    PEG = P/E Ratio / (Earnings Growth Rate × 100)
    
    Peter Lynch's rule: PEG < 1.0 indicates undervaluation
    - PEG < 0.5 = Very undervalued
    - PEG 0.5-1.0 = Fairly valued to undervalued
    - PEG 1.0-2.0 = Fairly valued to overvalued
    - PEG > 2.0 = Overvalued
    
    Source: One Up on Wall Street
    
    Args:
        pe_ratio: Price to earnings ratio
        earnings_growth_rate: Earnings growth rate as decimal (0.15 = 15%)
        
    Returns:
        PEG ratio
    """
    if earnings_growth_rate <= 0 or pe_ratio <= 0:
        return float('inf')
    
    # Convert growth rate to percentage for PEG calculation
    growth_pct = earnings_growth_rate * 100
    return pe_ratio / growth_pct


def classify_lynch_category(
    earnings_growth_rate: float,
    revenue_correlation_gdp: Optional[float] = None,
    recent_turnaround: bool = False,
    hidden_assets: bool = False
) -> str:
    """
    Classify stock into Peter Lynch's categories.
    
    Args:
        earnings_growth_rate: Earnings growth rate as decimal
        revenue_correlation_gdp: Correlation of revenue with GDP (for cyclical detection)
        recent_turnaround: Whether company recently had losses and is recovering
        hidden_assets: Whether company has significant hidden asset value
        
    Returns:
        Lynch category string
    """
    if hidden_assets:
        return LynchCategory.ASSET_PLAY
    
    if recent_turnaround:
        return LynchCategory.TURNAROUND
    
    if revenue_correlation_gdp is not None and abs(revenue_correlation_gdp) > 0.7:
        return LynchCategory.CYCLICAL
    
    if earnings_growth_rate < 0.05:
        return LynchCategory.SLOW_GROWER
    elif earnings_growth_rate < 0.12:
        return LynchCategory.STALWART
    else:
        return LynchCategory.FAST_GROWER


def calculate_net_cash_per_share(
    cash: float,
    total_debt: float,
    shares_outstanding: float
) -> float:
    """
    Calculate Net Cash Per Share.
    
    Net Cash Per Share = (Cash - Total Debt) / Shares Outstanding
    
    Lynch liked companies with significant net cash - provides safety
    and potential for buybacks/dividends.
    
    Args:
        cash: Total cash and equivalents
        total_debt: Total debt (short + long term)
        shares_outstanding: Total shares outstanding
        
    Returns:
        Net cash per share
    """
    if shares_outstanding <= 0:
        return 0.0
    return (cash - total_debt) / shares_outstanding


def calculate_inventory_sales_ratio(inventory: float, revenue: float) -> float:
    """
    Calculate Inventory to Sales ratio.
    
    Lynch watched this ratio - rising inventory faster than sales
    could indicate problems.
    
    Args:
        inventory: Total inventory
        revenue: Annual revenue
        
    Returns:
        Inventory to sales ratio
    """
    if revenue <= 0:
        return 0.0
    return inventory / revenue


def calculate_lynch_fair_value(
    eps: float,
    growth_rate: float,
    dividend_yield: float = 0
) -> float:
    """
    Calculate fair value using Lynch's simplified formula.
    
    Fair P/E = Growth Rate (as %) + Dividend Yield (as %)
    Fair Value = EPS × Fair P/E
    
    Example: 15% growth + 2% dividend = Fair P/E of 17
    
    Args:
        eps: Earnings per share
        growth_rate: Earnings growth rate as decimal (0.15 = 15%)
        dividend_yield: Dividend yield as decimal (0.02 = 2%)
        
    Returns:
        Fair value per share
    """
    if eps <= 0:
        return 0.0
    
    fair_pe = (growth_rate * 100) + (dividend_yield * 100)
    return eps * fair_pe


def get_lynch_metrics(
    current_price: float,
    eps: float,
    earnings_growth_rate: float,
    cash: float,
    total_debt: float,
    shares_outstanding: float,
    inventory: float = 0,
    revenue: float = 0,
    dividend_yield: float = 0
) -> Dict[str, Any]:
    """
    Calculate all Peter Lynch metrics in one call.
    
    Args:
        current_price: Current stock price
        eps: Earnings per share
        earnings_growth_rate: Earnings growth rate as decimal
        cash: Total cash
        total_debt: Total debt
        shares_outstanding: Shares outstanding
        inventory: Total inventory
        revenue: Annual revenue
        dividend_yield: Dividend yield as decimal
        
    Returns:
        Dictionary with all Lynch metrics
    """
    pe_ratio = current_price / eps if eps > 0 else float('inf')
    
    peg = calculate_peg_ratio(pe_ratio, earnings_growth_rate)
    category = classify_lynch_category(earnings_growth_rate)
    net_cash_per_share = calculate_net_cash_per_share(cash, total_debt, shares_outstanding)
    fair_value = calculate_lynch_fair_value(eps, earnings_growth_rate, dividend_yield)
    
    # Calculate margin of safety vs Lynch fair value
    lynch_mos = current_price / fair_value if fair_value > 0 else float('inf')
    
    result = {
        "pe_ratio": round(pe_ratio, 2) if pe_ratio != float('inf') else None,
        "peg_ratio": round(peg, 2) if peg != float('inf') else None,
        "lynch_category": category,
        "net_cash_per_share": round(net_cash_per_share, 2),
        "lynch_fair_value": round(fair_value, 2),
        "lynch_margin_of_safety": round(lynch_mos, 3) if lynch_mos != float('inf') else None,
        "earnings_growth_rate": round(earnings_growth_rate, 4)
    }
    
    # PEG interpretation
    if peg != float('inf'):
        if peg < 0.5:
            result["peg_interpretation"] = "Very undervalued"
        elif peg < 1.0:
            result["peg_interpretation"] = "Undervalued"
        elif peg < 2.0:
            result["peg_interpretation"] = "Fair to overvalued"
        else:
            result["peg_interpretation"] = "Overvalued"
    else:
        result["peg_interpretation"] = "Cannot calculate"
    
    if inventory > 0 and revenue > 0:
        result["inventory_sales_ratio"] = round(calculate_inventory_sales_ratio(inventory, revenue), 4)
    
    return result


# =============================================================================
# EXISTING FUNCTIONS (preserved and enhanced)
# =============================================================================

def get_assets_light_factor(balance_sheet_dictionary, net_income_dictionary):
    """
    This will calculate which equities have high earnings to assets.
    This might mean that they have higher goodwill built into their share price.
    If goodwill is low or negative and they have high earnings to tangible assets, they are a worthy purchase.

    Args:
    - balance_sheet_dictionary dictionary: dictionary with all balance sheet data -- using tangible assets
    - net_income_dictionary dictionary: Dictionary with all net income data -- using net income average

    Returns:
    - asset_light float: Ratio of earnings to tangible assets (higher is better)
    """
    tangible_assets = balance_sheet_dictionary['tangible_assets']
    # Get the most recent tangible assets value if it's a Series
    if hasattr(tangible_assets, 'iloc'):
        tangible_assets = tangible_assets.iloc[-1]
    
    if tangible_assets == 0:
        return 0
    
    asset_light = net_income_dictionary['net_income_average'] / tangible_assets

    return asset_light


def get_earnings_equity(net_income_dictionary, market_cap):
    """
    This will calculate the earnings to equity of a business. It is the value returned annually per dollar equity

    Args:
    - net_income_dictionary dictionary: Dictionary with all net income data -- using net income average
    - market_cap float: market cap of a business

    Returns:
    - earnings_equity float: ratio of earnings to equity. The higher the better
    """

    earnings_equity = net_income_dictionary['net_income_average'] / market_cap

    return earnings_equity

def get_ROIC(owners_earnings, invested_capital):
    """
    this is the return on invested capital by the company, look for companies who have a history of high ROIC.
    ROIC above 10% is good. One can consider lower ROIC in the case that the company has a wide moat.

    Args:
    - owners_earnings float: operating profit + deprecation + amortisation of goodwill
                            - federal income tax (average) - cost of stock options
                            - maintenance costs(essential capital expenditures)
                            - any income from unsustainable sources
    - invested_capital float: total_assets - cash - short term investments + past accounting charges

    Returns:
    - ROIC float: higher is better
    """

    ROIC = owners_earnings/invested_capital

    return ROIC

