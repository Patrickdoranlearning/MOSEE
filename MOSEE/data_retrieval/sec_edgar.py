"""
SEC EDGAR Company Facts API — Extended Historical Financial Data

Yahoo Finance (yfinance) only returns 4 years of annual financial statements.
This module supplements that with 10-20 years of historical data from SEC EDGAR,
which is free, requires no API key, and is authoritative (direct from SEC filings).

Data flow:
1. Resolve ticker -> CIK via SEC's company_tickers.json
2. Fetch company facts from data.sec.gov/api/xbrl/companyfacts/
3. Extract annual (10-K) financial data, deduplicating by fiscal year
4. Return DataFrames in the same format as yfinance (rows=items, cols=dates)

Limitations:
- US-listed companies only (SEC filings)
- XBRL taxonomy changes mean some fields use different names pre-2018
- Rate limit: SEC asks for max 10 requests/second with proper User-Agent
"""

import time
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import pandas as pd
import numpy as np

# Cache for CIK lookups and company facts
_cik_cache: Dict[str, Optional[int]] = {}
_facts_cache: Dict[str, Tuple[dict, float]] = {}  # ticker -> (data, timestamp)
_ticker_map: Optional[Dict[str, int]] = None
_ticker_map_loaded_at: float = 0

# SEC requires a descriptive User-Agent
_USER_AGENT = "MOSEE StockAnalysis contact@mosee.dev"
_CACHE_TTL = 3600  # 1 hour cache for company facts
_TICKER_MAP_TTL = 86400  # 24 hour cache for ticker-to-CIK map

# Rate limiting: SEC allows 10 req/sec, we'll be conservative
_last_request_time = 0
_MIN_REQUEST_INTERVAL = 0.15  # 150ms between requests


def _rate_limited_get(url: str) -> Optional[bytes]:
    """Make a rate-limited GET request to SEC EDGAR."""
    global _last_request_time

    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)

    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})

    try:
        _last_request_time = time.time()
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        if e.code == 429:
            print(f"  [SEC EDGAR] Rate limited, waiting 2s...")
            time.sleep(2)
            _last_request_time = time.time()
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read()
        print(f"  [SEC EDGAR] HTTP {e.code} for {url}")
        return None
    except Exception as e:
        print(f"  [SEC EDGAR] Request failed: {e}")
        return None


def _load_ticker_map() -> Dict[str, int]:
    """Load the SEC ticker-to-CIK mapping (cached for 24h)."""
    global _ticker_map, _ticker_map_loaded_at

    if _ticker_map is not None and (time.time() - _ticker_map_loaded_at) < _TICKER_MAP_TTL:
        return _ticker_map

    data = _rate_limited_get("https://www.sec.gov/files/company_tickers.json")
    if data is None:
        _ticker_map = {}
        return _ticker_map

    parsed = json.loads(data)
    _ticker_map = {}
    for entry in parsed.values():
        ticker = entry.get("ticker", "").upper()
        cik = entry.get("cik_str")
        if ticker and cik:
            _ticker_map[ticker] = int(cik)

    _ticker_map_loaded_at = time.time()
    return _ticker_map


def resolve_cik(ticker: str) -> Optional[int]:
    """Resolve a stock ticker to its SEC CIK number."""
    ticker_upper = ticker.upper().replace(".", "-")  # SEC uses hyphens (BRK-B not BRK.B)

    if ticker_upper in _cik_cache:
        return _cik_cache[ticker_upper]

    ticker_map = _load_ticker_map()
    cik = ticker_map.get(ticker_upper)

    # Also try without the hyphen variant
    if cik is None and "-" in ticker_upper:
        cik = ticker_map.get(ticker_upper.replace("-", ""))

    _cik_cache[ticker_upper] = cik
    return cik


def get_company_facts(ticker: str) -> Optional[dict]:
    """
    Fetch all XBRL facts for a company from SEC EDGAR.

    Returns the full companyfacts JSON or None if not available.
    """
    # Check cache
    if ticker in _facts_cache:
        data, ts = _facts_cache[ticker]
        if (time.time() - ts) < _CACHE_TTL:
            return data

    cik = resolve_cik(ticker)
    if cik is None:
        return None

    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
    raw = _rate_limited_get(url)
    if raw is None:
        return None

    data = json.loads(raw)
    _facts_cache[ticker] = (data, time.time())
    return data


# ============================================================================
# XBRL field mappings — maps yfinance row names to SEC EDGAR XBRL concepts
# Some concepts changed names over the years, so we try multiple.
# ============================================================================

# Income statement fields
_INCOME_STMT_FIELDS = {
    "Total Revenue": [
        "RevenueFromContractWithCustomerExcludingAssessedTax",  # ASC 606 (2018+)
        "Revenues",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
    ],
    "Gross Profit": ["GrossProfit"],
    "EBIT": [
        "OperatingIncomeLoss",
    ],
    "Operating Income": [
        "OperatingIncomeLoss",
    ],
    "Net Income": [
        "NetIncomeLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ],
    "Net Income Common Stockholders": [
        "NetIncomeLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ],
    "Interest Expense": [
        "InterestExpense",
        "InterestExpenseDebt",
    ],
    "Tax Provision": [
        "IncomeTaxExpenseBenefit",
    ],
    "Basic EPS": [
        "EarningsPerShareBasic",
    ],
    "Diluted EPS": [
        "EarningsPerShareDiluted",
    ],
}

# Balance sheet fields
_BALANCE_SHEET_FIELDS = {
    "Cash And Cash Equivalents": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsAndShortTermInvestments",
    ],
    "Current Assets": [
        "AssetsCurrent",
    ],
    "Current Liabilities": [
        "LiabilitiesCurrent",
    ],
    "Total Assets": [
        "Assets",
    ],
    "Total Liabilities Net Minority Interest": [
        "Liabilities",
    ],
    "Goodwill And Other Intangible Assets": [
        "IntangibleAssetsNetIncludingGoodwill",
        "Goodwill",
    ],
    "Stockholders Equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "Total Debt": [
        "LongTermDebtAndCapitalLeaseObligations",
        "LongTermDebt",
    ],
    "Long Term Debt": [
        "LongTermDebtNoncurrent",
        "LongTermDebt",
    ],
    "Current Debt": [
        "ShortTermBorrowings",
        "LongTermDebtCurrent",
    ],
    "Inventory": [
        "InventoryNet",
        "InventoryFinishedGoodsAndWorkInProcess",
    ],
    "Accounts Receivable": [
        "AccountsReceivableNetCurrent",
        "AccountsReceivableNet",
    ],
    "Net PPE": [
        "PropertyPlantAndEquipmentNet",
    ],
    "Accounts Payable": [
        "AccountsPayableCurrent",
        "AccountsPayable",
    ],
    "Common Stock Shares Outstanding": [
        "CommonStockSharesOutstanding",
        "EntityCommonStockSharesOutstanding",
    ],
}

# Cash flow fields
_CASH_FLOW_FIELDS = {
    "Net Income From Continuing Operations": [
        "NetIncomeLoss",
    ],
    "Net Income": [
        "NetIncomeLoss",
    ],
    "Depreciation And Amortization": [
        "DepreciationDepletionAndAmortization",
        "DepreciationAmortizationAndAccretionNet",
        "Depreciation",
    ],
    "Capital Expenditure": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
    ],
    "Operating Cash Flow": [
        "NetCashProvidedByOperatingActivities",
    ],
    "Cash Dividends Paid": [
        "PaymentsOfDividends",
        "PaymentsOfDividendsCommonStock",
    ],
    "Repurchase Of Capital Stock": [
        "PaymentsForRepurchaseOfCommonStock",
        "StockRepurchasedAndRetiredDuringPeriodValue",
    ],
    "Issuance Of Capital Stock": [
        "ProceedsFromIssuanceOfCommonStock",
        "ProceedsFromStockOptionsExercised",
    ],
}


def _extract_annual_series(
    facts: dict,
    xbrl_concepts: list,
    unit_type: str = "USD",
    require_full_year: bool = True,
) -> Dict[str, float]:
    """
    Extract annual (10-K) values for a given XBRL concept.

    Args:
        facts: The 'us-gaap' facts dict from companyfacts
        xbrl_concepts: List of XBRL concept names to try (first match wins)
        unit_type: 'USD', 'USD/shares', or 'shares'
        require_full_year: If True, only include entries spanning >= 300 days
            (filters out quarterly data reported in 10-K amendments)

    Returns:
        Dict mapping fiscal year end date string (YYYY-MM-DD) to value
    """
    for concept in xbrl_concepts:
        concept_data = facts.get(concept, {})
        units = concept_data.get("units", {})

        # Try the requested unit type
        entries = units.get(unit_type, [])
        if not entries and unit_type == "USD":
            # Some fields might be in USD/shares
            entries = units.get("USD/shares", [])
        if not entries and unit_type == "shares":
            entries = units.get("shares", [])

        if not entries:
            continue

        # Filter to 10-K filings only
        annual = [e for e in entries if e.get("form") == "10-K"]
        if not annual:
            continue

        # Filter to full-year entries (not quarterly segments within 10-K)
        if require_full_year:
            filtered = []
            for entry in annual:
                if "start" in entry:
                    start = datetime.strptime(entry["start"], "%Y-%m-%d")
                    end = datetime.strptime(entry["end"], "%Y-%m-%d")
                    if (end - start).days < 300:
                        continue
                filtered.append(entry)
            annual = filtered if filtered else annual

        # Deduplicate by end date — take the most recently filed version
        by_end: Dict[str, Tuple[str, float]] = {}
        for entry in annual:
            end_date = entry["end"]
            filed = entry.get("filed", "")
            val = entry["val"]
            if end_date not in by_end or filed > by_end[end_date][0]:
                by_end[end_date] = (filed, val)

        if by_end:
            return {end: val for end, (_, val) in sorted(by_end.items())}

    return {}


def _build_dataframe(
    facts: dict,
    field_mapping: Dict[str, list],
    min_years: int = 5,
    unit_overrides: Optional[Dict[str, str]] = None,
) -> pd.DataFrame:
    """
    Build a DataFrame from SEC EDGAR facts matching yfinance format.

    Returns DataFrame with:
    - Index: field names (matching yfinance row names)
    - Columns: datetime timestamps (fiscal year end dates)
    """
    if not facts:
        return pd.DataFrame()

    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    if not us_gaap:
        return pd.DataFrame()

    all_dates = set()
    series_data = {}

    for yf_name, xbrl_concepts in field_mapping.items():
        unit = "USD"
        if unit_overrides and yf_name in unit_overrides:
            unit = unit_overrides[yf_name]
        elif "EPS" in yf_name:
            unit = "USD/shares"
        elif "Shares" in yf_name:
            unit = "shares"

        values = _extract_annual_series(us_gaap, xbrl_concepts, unit_type=unit)
        if values:
            series_data[yf_name] = values
            all_dates.update(values.keys())

    if not all_dates:
        return pd.DataFrame()

    # Convert date strings to datetime and sort
    sorted_dates = sorted(all_dates)
    datetime_cols = [pd.Timestamp(d) for d in sorted_dates]

    # Build the DataFrame: fields as rows, dates as columns
    rows = {}
    for field_name, values in series_data.items():
        row = []
        for d in sorted_dates:
            row.append(values.get(d, np.nan))
        rows[field_name] = row

    df = pd.DataFrame.from_dict(rows, orient="index", columns=datetime_cols)

    # Deduplicate columns that fall in the same fiscal year.
    # SEC filings can have slightly different period-end dates for the same
    # fiscal year (e.g., 2023-12-31 vs 2024-01-01). Keep the latest date.
    seen_years = {}
    cols_to_keep = []
    for col in reversed(df.columns):  # reverse so we keep the latest date per year
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
    Fetch extended historical financial statements from SEC EDGAR.

    Returns dict with keys matching yfinance format:
    - 'financials': income statement (rows=items, cols=dates)
    - 'balance_sheet': balance sheet
    - 'cashflow': cash flow statement

    Returns None if the ticker is not found in SEC (e.g., non-US stocks).
    """
    facts = get_company_facts(ticker)
    if facts is None:
        return None

    entity_name = facts.get("entityName", ticker)

    income_stmt = _build_dataframe(facts, _INCOME_STMT_FIELDS)
    balance_sheet = _build_dataframe(
        facts,
        _BALANCE_SHEET_FIELDS,
        unit_overrides={"Common Stock Shares Outstanding": "shares"},
    )
    cashflow = _build_dataframe(facts, _CASH_FLOW_FIELDS)

    # Make capital expenditure and dividends negative to match yfinance convention
    for field in ["Capital Expenditure"]:
        if field in cashflow.index:
            cashflow.loc[field] = -cashflow.loc[field].abs()

    # Dividends paid should be negative (cash outflow)
    for field in ["Cash Dividends Paid"]:
        if field in cashflow.index:
            cashflow.loc[field] = -cashflow.loc[field].abs()

    # Stock repurchases should be negative (cash outflow)
    for field in ["Repurchase Of Capital Stock"]:
        if field in cashflow.index:
            cashflow.loc[field] = -cashflow.loc[field].abs()

    years_available = max(
        len(income_stmt.columns) if not income_stmt.empty else 0,
        len(balance_sheet.columns) if not balance_sheet.empty else 0,
        len(cashflow.columns) if not cashflow.empty else 0,
    )

    if years_available > 0:
        print(f"  [SEC EDGAR] {entity_name}: {years_available} years of historical data")

    return {
        "financials": income_stmt,
        "balance_sheet": balance_sheet,
        "cashflow": cashflow,
    }


def merge_with_yfinance(
    yf_data: Dict[str, pd.DataFrame],
    edgar_data: Dict[str, pd.DataFrame],
) -> Dict[str, pd.DataFrame]:
    """
    Merge SEC EDGAR historical data with yfinance data.

    Strategy:
    - yfinance is authoritative for the most recent years (better field coverage)
    - EDGAR fills in older historical years that yfinance doesn't have
    - For overlapping years, yfinance takes priority

    Returns merged dict with same keys as yfinance format.
    """
    merged = {}

    for key in ["financials", "balance_sheet", "cashflow"]:
        yf_df = yf_data.get(key, pd.DataFrame())
        edgar_df = edgar_data.get(key, pd.DataFrame())

        if edgar_df.empty:
            merged[key] = yf_df
            continue
        if yf_df.empty:
            merged[key] = edgar_df
            continue

        # Normalize column timestamps to dates for comparison
        # yfinance uses Timestamps, EDGAR uses Timestamps too
        yf_dates = set()
        for col in yf_df.columns:
            if hasattr(col, "year"):
                yf_dates.add(col.year)

        # Find EDGAR columns that are NOT in yfinance (older history)
        older_cols = []
        for col in edgar_df.columns:
            if hasattr(col, "year") and col.year not in yf_dates:
                older_cols.append(col)

        if not older_cols:
            # No additional history from EDGAR
            merged[key] = yf_df
            continue

        # Get the subset of EDGAR data for older years
        edgar_older = edgar_df[older_cols]

        # Only keep rows (field names) that exist in yfinance data
        # to maintain compatibility with downstream code
        common_rows = edgar_older.index.intersection(yf_df.index)
        if len(common_rows) == 0:
            # No matching field names — EDGAR uses different names
            # Try to use all EDGAR rows; downstream will pick what it needs
            combined = pd.concat([edgar_older, yf_df], axis=1)
        else:
            edgar_subset = edgar_older.loc[common_rows]
            combined = pd.concat([edgar_subset, yf_df], axis=1)

        # Sort columns chronologically (oldest to newest)
        combined = combined.sort_index(axis=1)

        # Also add any EDGAR-only rows that yfinance is missing
        edgar_only_rows = edgar_older.index.difference(yf_df.index)
        if len(edgar_only_rows) > 0:
            for row in edgar_only_rows:
                if row not in combined.index:
                    # Add the EDGAR row with NaN for yfinance years
                    new_row = pd.Series(np.nan, index=combined.columns, name=row)
                    for col in older_cols:
                        if col in combined.columns and col in edgar_older.columns:
                            new_row[col] = edgar_older.loc[row, col]
                    combined = pd.concat([combined, new_row.to_frame().T])

        merged[key] = combined

    return merged
