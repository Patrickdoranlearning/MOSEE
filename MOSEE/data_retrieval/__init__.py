"""
MOSEE Data Retrieval Module

Handles downloading and processing financial data from yfinance.
Includes rate limiting utilities to handle Yahoo Finance API limits.
"""

from .fundamental_data import (
    fundamental_downloads,
    balance_sheet_data_dic,
    income_statement_data_dic,
    cash_flow_data_dic,
    net_income_expected,
    dividends_expected_dic,
    stock_buybacks_expected,
    earnings_return_to_shareholders,
    get_owners_earnings,
    get_invested_capital,
    get_shares_outstanding
)

from .market_data import (
    get_stock_data,
    get_ticker_info,
    convert_currency
)

from .rate_limiter import (
    configure_rate_limiter,
    clear_cache,
    with_rate_limit
)

__all__ = [
    # Fundamental data
    'fundamental_downloads',
    'balance_sheet_data_dic',
    'income_statement_data_dic',
    'cash_flow_data_dic',
    'net_income_expected',
    'dividends_expected_dic',
    'stock_buybacks_expected',
    'earnings_return_to_shareholders',
    'get_owners_earnings',
    'get_invested_capital',
    'get_shares_outstanding',
    # Market data
    'get_stock_data',
    'get_ticker_info',
    'convert_currency',
    # Rate limiting
    'configure_rate_limiter',
    'clear_cache',
    'with_rate_limit'
]
