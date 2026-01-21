"""
MOSEE Fundamental Analysis Module

Contains valuation and indicator calculations from classic investing books:
- Benjamin Graham
- Warren Buffett / Charlie Munger
- Peter Lynch
- Joel Greenblatt
- Philip Fisher
"""

from .indicators import (
    # Graham metrics
    calculate_graham_number,
    calculate_graham_defensive_criteria,
    get_graham_margin_of_safety,
    GrahamCriteriaResult,
    # Buffett/Munger metrics
    calculate_roe,
    calculate_roe_history,
    calculate_roic,
    calculate_interest_coverage,
    calculate_debt_to_equity,
    # Lynch metrics
    calculate_peg_ratio,
    classify_lynch_category,
    calculate_net_cash_per_share,
    calculate_lynch_fair_value,
    get_lynch_metrics,
    LynchCategory,
    # Existing
    get_assets_light_factor,
    get_earnings_equity,
    get_ROIC
)

from .valuation import (
    calculate_average_price,
    pad_valuation,
    pad_valuation_dividend,
    dcf_valuation,
    net_net_working_capital,
    book_value,
    tangible_book_value
)

from .magic_formula import (
    calculate_enterprise_value,
    calculate_earnings_yield,
    calculate_return_on_capital,
    calculate_magic_formula_metrics,
    rank_by_magic_formula,
    get_magic_formula_interpretation,
    MagicFormulaResult
)

from .growth_metrics import (
    calculate_cagr,
    calculate_sales_cagr,
    calculate_margin_trend,
    calculate_reinvestment_efficiency,
    calculate_sustainable_growth_rate,
    calculate_growth_quality_score,
    get_fisher_metrics,
    get_fisher_interpretation,
    GrowthMetricsResult
)

__all__ = [
    # Graham
    'calculate_graham_number',
    'calculate_graham_defensive_criteria',
    'get_graham_margin_of_safety',
    'GrahamCriteriaResult',
    # Buffett/Munger
    'calculate_roe',
    'calculate_roe_history',
    'calculate_roic',
    'calculate_interest_coverage',
    'calculate_debt_to_equity',
    # Lynch
    'calculate_peg_ratio',
    'classify_lynch_category',
    'calculate_net_cash_per_share',
    'calculate_lynch_fair_value',
    'get_lynch_metrics',
    'LynchCategory',
    # Valuation
    'calculate_average_price',
    'pad_valuation',
    'pad_valuation_dividend',
    'dcf_valuation',
    'net_net_working_capital',
    'book_value',
    'tangible_book_value',
    # Magic Formula
    'calculate_enterprise_value',
    'calculate_earnings_yield',
    'calculate_return_on_capital',
    'calculate_magic_formula_metrics',
    'rank_by_magic_formula',
    'get_magic_formula_interpretation',
    'MagicFormulaResult',
    # Growth metrics
    'calculate_cagr',
    'calculate_sales_cagr',
    'calculate_margin_trend',
    'calculate_reinvestment_efficiency',
    'calculate_sustainable_growth_rate',
    'calculate_growth_quality_score',
    'get_fisher_metrics',
    'get_fisher_interpretation',
    'GrowthMetricsResult',
    # Existing
    'get_assets_light_factor',
    'get_earnings_equity',
    'get_ROIC'
]
