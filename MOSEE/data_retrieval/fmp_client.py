"""
Financial Modeling Prep (FMP) — Extended Historical Data for Non-US Stocks

SEC EDGAR covers US companies. For European and other international stocks,
FMP provides 30+ years of financial statement history on a free tier.

Free tier: requires API key (sign up at financialmodelingprep.com), 250 req/day.

Data flow:
1. Fetch income statement, balance sheet, cash flow from FMP REST API
2. Convert to DataFrames matching yfinance format (rows=items, cols=dates)
3. Used as fallback when SEC EDGAR has no data for the ticker
"""

import os
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Optional, List
import pandas as pd
import numpy as np

_FMP_BASE_URL = "https://financialmodelingprep.com/stable"
_CACHE: Dict[str, dict] = {}
_last_request_time = 0
_MIN_REQUEST_INTERVAL = 0.3  # FMP free tier: 5 req/sec max


def _get_api_key() -> Optional[str]:
    """Get FMP API key from environment."""
    return os.environ.get("FMP_API_KEY")


def _rate_limited_get(url: str) -> Optional[list]:
    """Make a rate-limited GET request to FMP."""
    global _last_request_time

    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)

    req = urllib.request.Request(url)
    try:
        _last_request_time = time.time()
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if isinstance(data, dict) and "Error Message" in data:
                return None
            return data
    except urllib.error.HTTPError as e:
        if e.code == 402:
            # Paid plan required for this ticker (e.g., European stocks on free tier)
            return None
        if e.code == 429:
            print("  [FMP] Rate limited, waiting 2s...")
            time.sleep(2)
            _last_request_time = time.time()
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read())
            except Exception:
                return None
        print(f"  [FMP] HTTP {e.code}")
        return None
    except Exception as e:
        print(f"  [FMP] Request failed: {e}")
        return None


# ============================================================================
# Field mappings: FMP field names -> yfinance-compatible row names
# ============================================================================

_INCOME_FIELD_MAP = {
    "revenue": "Total Revenue",
    "grossProfit": "Gross Profit",
    "operatingIncome": "Operating Income",
    "netIncome": "Net Income",
    "interestExpense": "Interest Expense",
    "incomeTaxExpense": "Tax Provision",
    "eps": "Basic EPS",
    "epsdiluted": "Diluted EPS",
    "ebitda": "EBITDA",
}

_BALANCE_SHEET_FIELD_MAP = {
    "cashAndCashEquivalents": "Cash And Cash Equivalents",
    "totalCurrentAssets": "Current Assets",
    "totalCurrentLiabilities": "Current Liabilities",
    "totalAssets": "Total Assets",
    "totalLiabilities": "Total Liabilities Net Minority Interest",
    "goodwillAndIntangibleAssets": "Goodwill And Other Intangible Assets",
    "totalStockholdersEquity": "Stockholders Equity",
    "totalDebt": "Total Debt",
    "longTermDebt": "Long Term Debt",
    "shortTermDebt": "Current Debt",
    "inventory": "Inventory",
    "netReceivables": "Accounts Receivable",
    "propertyPlantEquipmentNet": "Net PPE",
    "accountPayables": "Accounts Payable",
}

_CASHFLOW_FIELD_MAP = {
    "netIncome": "Net Income",
    "depreciationAndAmortization": "Depreciation And Amortization",
    "capitalExpenditure": "Capital Expenditure",
    "operatingCashFlow": "Operating Cash Flow",
    "dividendsPaid": "Cash Dividends Paid",
    "commonStockRepurchased": "Repurchase Of Capital Stock",
    "commonStockIssued": "Issuance Of Capital Stock",
    "freeCashFlow": "Free Cash Flow",
}


def _statements_to_dataframe(
    statements: List[dict],
    field_map: Dict[str, str],
) -> pd.DataFrame:
    """
    Convert FMP statement list to a DataFrame matching yfinance format.

    FMP returns a list of dicts, one per year, newest first.
    We convert to: rows=field names, columns=datetime (sorted oldest to newest).
    """
    if not statements:
        return pd.DataFrame()

    # Sort by date ascending (oldest first)
    statements = sorted(statements, key=lambda x: x.get("date", ""))

    dates = []
    data_by_field: Dict[str, list] = {yf_name: [] for yf_name in field_map.values()}

    for stmt in statements:
        date_str = stmt.get("date", "")
        if not date_str:
            continue

        dates.append(pd.Timestamp(date_str))

        for fmp_key, yf_name in field_map.items():
            val = stmt.get(fmp_key)
            if val is not None:
                data_by_field[yf_name].append(float(val))
            else:
                data_by_field[yf_name].append(np.nan)

    if not dates:
        return pd.DataFrame()

    df = pd.DataFrame(data_by_field, index=dates).T
    df.columns = dates

    # Remove rows that are all NaN
    df = df.dropna(how="all")

    return df


def get_extended_financials(ticker: str) -> Optional[Dict[str, pd.DataFrame]]:
    """
    Fetch extended historical financial statements from FMP.

    Returns dict with keys matching yfinance format, or None if FMP is not
    configured or the ticker isn't found.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    # Cache check
    cache_key = f"fmp|{ticker}"
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    # FMP uses the same ticker format as yfinance for most exchanges
    # (e.g., EDEN.PA, SAP.DE, NESN.SW)

    income_data = _rate_limited_get(
        f"{_FMP_BASE_URL}/income-statement?symbol={ticker}&period=annual&apikey={api_key}"
    )
    balance_data = _rate_limited_get(
        f"{_FMP_BASE_URL}/balance-sheet-statement?symbol={ticker}&period=annual&apikey={api_key}"
    )
    cashflow_data = _rate_limited_get(
        f"{_FMP_BASE_URL}/cash-flow-statement?symbol={ticker}&period=annual&apikey={api_key}"
    )

    income_df = _statements_to_dataframe(income_data or [], _INCOME_FIELD_MAP)
    balance_df = _statements_to_dataframe(balance_data or [], _BALANCE_SHEET_FIELD_MAP)
    cashflow_df = _statements_to_dataframe(cashflow_data or [], _CASHFLOW_FIELD_MAP)

    max_years = max(
        len(income_df.columns) if not income_df.empty else 0,
        len(balance_df.columns) if not balance_df.empty else 0,
        len(cashflow_df.columns) if not cashflow_df.empty else 0,
    )

    if max_years == 0:
        # Empty/failed fetch — do NOT cache, so a later attempt can retry.
        return None

    # FMP reports each statement's currency under "reportedCurrency". Expose it
    # so callers can refuse to stitch FMP years onto a base series reported in a
    # different currency (which would distort growth math). Prefer the income
    # statement, then balance sheet, then cash flow; None if FMP omits it.
    reported_currency = None
    for stmts in (income_data, balance_data, cashflow_data):
        if isinstance(stmts, list):
            for stmt in stmts:
                if isinstance(stmt, dict) and stmt.get("reportedCurrency"):
                    reported_currency = stmt["reportedCurrency"]
                    break
        if reported_currency:
            break

    print(f"  [FMP] {ticker}: {max_years} years of historical data")

    result = {
        "financials": income_df,
        "balance_sheet": balance_df,
        "cashflow": cashflow_df,
        "reported_currency": reported_currency,
    }
    _CACHE[cache_key] = result
    return result
