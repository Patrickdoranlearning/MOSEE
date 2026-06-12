"""
Yahoo Finance Timeseries API — Extended Historical Financial Data

yfinance hardcodes start_dt to 2016-12-31 and caps at 4 years of annual data.
However, Yahoo's fundamentals-timeseries endpoint can return more data when
queried with period1=0 (earliest available).

This module directly calls the timeseries API with the full date range,
bypassing yfinance's artificial limit. This works for ALL stocks on Yahoo
Finance — US, European, Asian, etc.

The approach:
1. Use yfinance's session (handles crumb/cookies automatically)
2. Call the timeseries API with period1=0 for maximum history
3. Parse the response into DataFrames matching yfinance format
"""

import time
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import pandas as pd
import numpy as np

# Rate limiting
_last_request_time = 0
_MIN_INTERVAL = 1.5  # conservative, matches yfinance rate limiter
# Only NON-EMPTY results are cached (see get_extended_financials). A transient
# timeout/connection failure must stay retryable later in the same process.
_cache: Dict[str, Dict[str, pd.DataFrame]] = {}

# Transient-fetch retry policy: retry only on timeout/connection errors, never
# on a clean empty response (a real "no data" answer should not be hammered).
_MAX_RETRIES = 2          # 2 retries = up to 3 total attempts
_RETRY_BACKOFF = 2.0      # seconds, added on top of the rate-limit interval


# All annual fundamental types available via Yahoo timeseries API
_INCOME_TYPES = [
    "annualTotalRevenue",
    "annualGrossProfit",
    "annualOperatingIncome",
    "annualNetIncome",
    "annualEBIT",
    "annualEBITDA",
    "annualInterestExpense",
    "annualIncomeTaxExpense",
    "annualBasicEPS",
    "annualDilutedEPS",
]

_BALANCE_TYPES = [
    "annualTotalAssets",
    "annualCurrentAssets",
    "annualCurrentLiabilities",
    "annualTotalLiabilitiesNetMinorityInterest",
    "annualCashAndCashEquivalents",
    "annualStockholdersEquity",
    "annualLongTermDebt",
    "annualTotalDebt",
    "annualGoodwillAndOtherIntangibleAssets",
    "annualNetPPE",
    "annualInventory",
    "annualAccountsReceivable",
    "annualAccountsPayable",
    "annualCommonStockEquity",
]

_CASHFLOW_TYPES = [
    "annualNetIncomeFromContinuingOperations",
    "annualDepreciationAndAmortization",
    "annualCapitalExpenditure",
    "annualOperatingCashFlow",
    "annualFreeCashFlow",
    "annualCashDividendsPaid",
    "annualRepurchaseOfCapitalStock",
    "annualIssuanceOfCapitalStock",
]

# Map Yahoo timeseries type names -> yfinance-compatible row names
_TYPE_TO_YFINANCE = {
    # Income
    "annualTotalRevenue": "Total Revenue",
    "annualGrossProfit": "Gross Profit",
    "annualOperatingIncome": "Operating Income",
    "annualNetIncome": "Net Income",
    "annualEBIT": "EBIT",
    "annualEBITDA": "EBITDA",
    "annualInterestExpense": "Interest Expense",
    "annualIncomeTaxExpense": "Tax Provision",
    "annualBasicEPS": "Basic EPS",
    "annualDilutedEPS": "Diluted EPS",
    # Balance sheet
    "annualTotalAssets": "Total Assets",
    "annualCurrentAssets": "Current Assets",
    "annualCurrentLiabilities": "Current Liabilities",
    "annualTotalLiabilitiesNetMinorityInterest": "Total Liabilities Net Minority Interest",
    "annualCashAndCashEquivalents": "Cash And Cash Equivalents",
    "annualStockholdersEquity": "Stockholders Equity",
    "annualLongTermDebt": "Long Term Debt",
    "annualTotalDebt": "Total Debt",
    "annualGoodwillAndOtherIntangibleAssets": "Goodwill And Other Intangible Assets",
    "annualNetPPE": "Net PPE",
    "annualInventory": "Inventory",
    "annualAccountsReceivable": "Accounts Receivable",
    "annualAccountsPayable": "Accounts Payable",
    "annualCommonStockEquity": "Common Stock Equity",
    # Cash flow
    "annualNetIncomeFromContinuingOperations": "Net Income From Continuing Operations",
    "annualDepreciationAndAmortization": "Depreciation And Amortization",
    "annualCapitalExpenditure": "Capital Expenditure",
    "annualOperatingCashFlow": "Operating Cash Flow",
    "annualFreeCashFlow": "Free Cash Flow",
    "annualCashDividendsPaid": "Cash Dividends Paid",
    "annualRepurchaseOfCapitalStock": "Repurchase Of Capital Stock",
    "annualIssuanceOfCapitalStock": "Issuance Of Capital Stock",
}


def _fetch_timeseries(ticker: str, types: List[str]) -> Dict[str, List[Tuple[str, float]]]:
    """
    Fetch fundamentals-timeseries data from Yahoo Finance.

    Uses yfinance's Ticker object to get a session with valid crumb/cookies,
    then calls the timeseries API with period1=0 for maximum history.

    Returns dict mapping type name -> list of (date_str, value) tuples.
    """
    global _last_request_time

    import yfinance as yf

    # Rate limit
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)

    try:
        tick = yf.Ticker(ticker)
        # Access .history to ensure session is initialized with crumb
        tick.history(period="1d")
    except Exception:
        pass

    # Get the session from yfinance (has valid cookies + crumb)
    try:
        session = tick._data._session
        if session is None:
            return {}
    except (AttributeError, Exception):
        return {}

    # Build URL — period1=0 means "from the beginning of time"
    base_url = f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{ticker}"
    params = {
        "type": ",".join(types),
        "period1": "0",
        "period2": str(int(datetime.now().timestamp())),
        "merge": "false",
    }

    # Retry only on timeout / connection errors (transient). A non-200 status
    # or a clean empty payload is a real answer and is NOT retried.
    try:
        import requests
        _transient_errors = (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
        )
    except Exception:
        _transient_errors = ()

    resp = None
    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):
        # Respect the rate limiter on every attempt, plus extra backoff on retries.
        elapsed = time.time() - _last_request_time
        wait = max(0.0, _MIN_INTERVAL - elapsed)
        if attempt > 0:
            wait += _RETRY_BACKOFF * attempt
        if wait > 0:
            time.sleep(wait)
        _last_request_time = time.time()
        try:
            resp = session.get(base_url, params=params, timeout=15)
            break
        except _transient_errors as e:
            last_exc = e
            resp = None
            continue
        except Exception as e:
            # Non-transient request error — do not retry.
            print(f"  [Yahoo Timeseries] Request error for {ticker}: {e}")
            return {}

    if resp is None:
        if last_exc is not None:
            print(f"  [Yahoo Timeseries] {ticker}: giving up after {_MAX_RETRIES + 1} attempts ({last_exc})")
        return {}

    try:
        if resp.status_code != 200:
            return {}

        data = resp.json()
        results = data.get("timeseries", {}).get("result", [])

        parsed = {}
        for series in results:
            type_name = series.get("meta", {}).get("type", [None])[0]
            if not type_name:
                continue

            entries = series.get(type_name, [])
            if not entries:
                continue

            values = []
            for entry in entries:
                if entry is None:
                    continue
                date = entry.get("asOfDate", "")
                raw_val = entry.get("reportedValue", {}).get("raw")
                if date and raw_val is not None:
                    values.append((date, float(raw_val)))

            if values:
                parsed[type_name] = values

        return parsed

    except Exception as e:
        print(f"  [Yahoo Timeseries] Error for {ticker}: {e}")
        return {}


def _build_dataframe(
    parsed: Dict[str, List[Tuple[str, float]]],
    types: List[str],
) -> pd.DataFrame:
    """Build a DataFrame from parsed timeseries data, matching yfinance format."""
    if not parsed:
        return pd.DataFrame()

    all_dates = set()
    for type_name in types:
        if type_name in parsed:
            for date_str, _ in parsed[type_name]:
                all_dates.add(date_str)

    if not all_dates:
        return pd.DataFrame()

    sorted_dates = sorted(all_dates)
    datetime_cols = [pd.Timestamp(d) for d in sorted_dates]

    rows = {}
    for type_name in types:
        yf_name = _TYPE_TO_YFINANCE.get(type_name)
        if not yf_name or type_name not in parsed:
            continue

        # Build lookup
        val_map = {d: v for d, v in parsed[type_name]}
        row = [val_map.get(d, np.nan) for d in sorted_dates]
        rows[yf_name] = row

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame.from_dict(rows, orient="index", columns=datetime_cols)

    # Deduplicate by fiscal year (keep latest date per year)
    seen_years = {}
    cols_to_keep = []
    for col in reversed(df.columns):
        year = col.year
        if year not in seen_years:
            seen_years[year] = col
            cols_to_keep.append(col)
    cols_to_keep.reverse()
    if len(cols_to_keep) < len(df.columns):
        df = df[cols_to_keep]

    return df


def get_extended_financials(ticker: str) -> Optional[Dict[str, pd.DataFrame]]:
    """
    Fetch extended historical financial statements via Yahoo's timeseries API.

    This bypasses yfinance's 4-year limit by querying with period1=0.
    Works for all stocks on Yahoo Finance (US, European, Asian, etc.).

    Returns dict with keys matching yfinance format, or None if no data.
    """
    if ticker in _cache:
        return _cache[ticker]

    # Fetch all types in one batch per statement to minimize API calls
    all_types = _INCOME_TYPES + _BALANCE_TYPES + _CASHFLOW_TYPES
    parsed = _fetch_timeseries(ticker, all_types)

    if not parsed:
        # Empty/failed fetch — do NOT cache, so a later attempt can retry.
        return None

    income_df = _build_dataframe(parsed, _INCOME_TYPES)
    balance_df = _build_dataframe(parsed, _BALANCE_TYPES)
    cashflow_df = _build_dataframe(parsed, _CASHFLOW_TYPES)

    max_years = max(
        len(income_df.columns) if not income_df.empty else 0,
        len(balance_df.columns) if not balance_df.empty else 0,
        len(cashflow_df.columns) if not cashflow_df.empty else 0,
    )

    if max_years == 0:
        return None

    if max_years > 4:
        print(f"  [Yahoo Timeseries] {ticker}: {max_years} years of historical data")

    result = {
        "financials": income_df,
        "balance_sheet": balance_df,
        "cashflow": cashflow_df,
    }
    _cache[ticker] = result
    return result
