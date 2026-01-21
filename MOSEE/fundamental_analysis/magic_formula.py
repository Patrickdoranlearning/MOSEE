"""
Joel Greenblatt's Magic Formula Module

From "The Little Book That Beats the Market"

The Magic Formula ranks stocks by:
1. Earnings Yield (EBIT / Enterprise Value) - "cheap" stocks rank higher
2. Return on Capital (EBIT / (Net Working Capital + Net Fixed Assets)) - "good" stocks rank higher

Combined rank = EY rank + ROC rank (lower is better)

The idea: Buy good companies at cheap prices.
"""

import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class MagicFormulaResult:
    """Results of Magic Formula calculation for a single stock."""
    ticker: str
    earnings_yield: float
    return_on_capital: float
    earnings_yield_rank: Optional[int] = None
    return_on_capital_rank: Optional[int] = None
    combined_rank: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "earnings_yield": round(self.earnings_yield, 4) if self.earnings_yield else None,
            "return_on_capital": round(self.return_on_capital, 4) if self.return_on_capital else None,
            "earnings_yield_rank": self.earnings_yield_rank,
            "return_on_capital_rank": self.return_on_capital_rank,
            "combined_rank": self.combined_rank
        }


def calculate_enterprise_value(
    market_cap: float,
    total_debt: float,
    cash: float,
    preferred_stock: float = 0,
    minority_interest: float = 0
) -> float:
    """
    Calculate Enterprise Value.
    
    EV = Market Cap + Total Debt + Preferred Stock + Minority Interest - Cash
    
    Args:
        market_cap: Market capitalization
        total_debt: Total debt (short + long term)
        cash: Cash and cash equivalents
        preferred_stock: Preferred stock value
        minority_interest: Minority interest
        
    Returns:
        Enterprise Value
    """
    return market_cap + total_debt + preferred_stock + minority_interest - cash


def calculate_earnings_yield(ebit: float, enterprise_value: float) -> float:
    """
    Calculate Earnings Yield for Magic Formula.
    
    Earnings Yield = EBIT / Enterprise Value
    
    This is Greenblatt's preferred measure because:
    - Uses EBIT (not affected by capital structure or taxes)
    - Uses Enterprise Value (accounts for debt)
    
    Higher is better - indicates cheaper stock.
    
    Args:
        ebit: Earnings Before Interest and Taxes
        enterprise_value: Enterprise Value
        
    Returns:
        Earnings Yield as decimal (0.10 = 10%)
    """
    if enterprise_value <= 0:
        return 0.0
    return ebit / enterprise_value


def calculate_return_on_capital(
    ebit: float,
    net_working_capital: float,
    net_fixed_assets: float
) -> float:
    """
    Calculate Return on Capital for Magic Formula.
    
    ROC = EBIT / (Net Working Capital + Net Fixed Assets)
    
    Net Working Capital = Current Assets - Current Liabilities (excluding excess cash)
    Net Fixed Assets = Property, Plant & Equipment (net)
    
    This measures how efficiently the company uses its tangible capital.
    Higher is better - indicates better quality business.
    
    Args:
        ebit: Earnings Before Interest and Taxes
        net_working_capital: Current Assets - Current Liabilities
        net_fixed_assets: Net Property, Plant & Equipment
        
    Returns:
        Return on Capital as decimal (0.20 = 20%)
    """
    tangible_capital = net_working_capital + net_fixed_assets
    if tangible_capital <= 0:
        return 0.0
    return ebit / tangible_capital


def calculate_magic_formula_metrics(
    ticker: str,
    ebit: float,
    market_cap: float,
    total_debt: float,
    cash: float,
    current_assets: float,
    current_liabilities: float,
    net_ppe: float
) -> MagicFormulaResult:
    """
    Calculate Magic Formula metrics for a single stock.
    
    Args:
        ticker: Stock ticker symbol
        ebit: Earnings Before Interest and Taxes
        market_cap: Market capitalization
        total_debt: Total debt
        cash: Cash and equivalents
        current_assets: Total current assets
        current_liabilities: Total current liabilities
        net_ppe: Net Property, Plant & Equipment
        
    Returns:
        MagicFormulaResult with earnings yield and return on capital
    """
    # Calculate Enterprise Value
    ev = calculate_enterprise_value(market_cap, total_debt, cash)
    
    # Calculate Net Working Capital
    net_wc = current_assets - current_liabilities
    
    # Calculate metrics
    earnings_yield = calculate_earnings_yield(ebit, ev)
    return_on_capital = calculate_return_on_capital(ebit, net_wc, net_ppe)
    
    return MagicFormulaResult(
        ticker=ticker,
        earnings_yield=earnings_yield,
        return_on_capital=return_on_capital
    )


def rank_by_magic_formula(results: List[MagicFormulaResult]) -> List[MagicFormulaResult]:
    """
    Rank stocks by Magic Formula (combined EY + ROC rank).
    
    Process:
    1. Rank all stocks by Earnings Yield (highest = rank 1)
    2. Rank all stocks by Return on Capital (highest = rank 1)
    3. Combined Rank = EY Rank + ROC Rank
    4. Sort by Combined Rank (lowest = best)
    
    Args:
        results: List of MagicFormulaResult objects
        
    Returns:
        Sorted list with ranks filled in
    """
    if not results:
        return results
    
    # Filter out invalid results
    valid_results = [r for r in results if r.earnings_yield > 0 and r.return_on_capital > 0]
    invalid_results = [r for r in results if r.earnings_yield <= 0 or r.return_on_capital <= 0]
    
    if not valid_results:
        return results
    
    # Rank by Earnings Yield (higher is better, so reverse=True)
    sorted_by_ey = sorted(valid_results, key=lambda x: x.earnings_yield, reverse=True)
    for i, result in enumerate(sorted_by_ey):
        result.earnings_yield_rank = i + 1
    
    # Rank by Return on Capital (higher is better, so reverse=True)
    sorted_by_roc = sorted(valid_results, key=lambda x: x.return_on_capital, reverse=True)
    for i, result in enumerate(sorted_by_roc):
        result.return_on_capital_rank = i + 1
    
    # Calculate combined rank
    for result in valid_results:
        result.combined_rank = result.earnings_yield_rank + result.return_on_capital_rank
    
    # Sort by combined rank (lower is better)
    valid_results.sort(key=lambda x: x.combined_rank)
    
    # Add invalid results at the end with no rank
    for result in invalid_results:
        result.combined_rank = None
    
    return valid_results + invalid_results


def get_magic_formula_score(combined_rank: int, total_stocks: int) -> float:
    """
    Convert Magic Formula rank to a 0-100 score.
    
    Args:
        combined_rank: Combined EY + ROC rank
        total_stocks: Total number of stocks ranked
        
    Returns:
        Score from 0-100 (100 = best)
    """
    if total_stocks <= 0 or combined_rank is None:
        return 0.0
    
    # Percentile-based score
    percentile = (total_stocks - combined_rank + 1) / total_stocks
    return percentile * 100


def magic_formula_screen(
    results: List[MagicFormulaResult],
    min_market_cap: float = 50_000_000,  # $50M minimum
    exclude_financials: bool = True,
    exclude_utilities: bool = True,
    top_n: int = 30
) -> List[MagicFormulaResult]:
    """
    Apply Greenblatt's screening criteria.
    
    Greenblatt's original criteria excluded:
    - Financial companies (banks, insurance)
    - Utility companies
    - Foreign companies (ADRs)
    - Very small companies
    
    Args:
        results: List of MagicFormulaResult objects
        min_market_cap: Minimum market cap (Greenblatt used $50M+)
        exclude_financials: Whether to exclude financial companies
        exclude_utilities: Whether to exclude utility companies
        top_n: Number of top stocks to return
        
    Returns:
        Top N stocks by Magic Formula rank
    """
    # Rank all stocks
    ranked = rank_by_magic_formula(results)
    
    # Return top N
    return ranked[:top_n]


def get_magic_formula_interpretation(
    earnings_yield: float,
    return_on_capital: float
) -> Dict[str, str]:
    """
    Provide interpretation of Magic Formula metrics.
    
    Args:
        earnings_yield: Earnings yield as decimal
        return_on_capital: Return on capital as decimal
        
    Returns:
        Dictionary with interpretations
    """
    interpretation = {}
    
    # Earnings Yield interpretation
    if earnings_yield > 0.15:
        interpretation["earnings_yield"] = "Very cheap (EY > 15%)"
    elif earnings_yield > 0.10:
        interpretation["earnings_yield"] = "Cheap (EY > 10%)"
    elif earnings_yield > 0.05:
        interpretation["earnings_yield"] = "Fair value (EY 5-10%)"
    else:
        interpretation["earnings_yield"] = "Expensive (EY < 5%)"
    
    # Return on Capital interpretation
    if return_on_capital > 0.25:
        interpretation["return_on_capital"] = "Excellent business (ROC > 25%)"
    elif return_on_capital > 0.15:
        interpretation["return_on_capital"] = "Good business (ROC > 15%)"
    elif return_on_capital > 0.10:
        interpretation["return_on_capital"] = "Average business (ROC 10-15%)"
    else:
        interpretation["return_on_capital"] = "Poor business (ROC < 10%)"
    
    # Combined interpretation
    if earnings_yield > 0.10 and return_on_capital > 0.20:
        interpretation["overall"] = "Magic Formula candidate - Good company at a cheap price"
    elif earnings_yield > 0.10:
        interpretation["overall"] = "Cheap but may lack quality"
    elif return_on_capital > 0.20:
        interpretation["overall"] = "Quality company but may be expensive"
    else:
        interpretation["overall"] = "Neither cheap nor high quality"
    
    return interpretation
