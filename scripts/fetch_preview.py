"""
Lightweight stock preview fetcher.

Fetches basic ticker info from yfinance and outputs JSON to stdout.
Used by the web API to show a quick preview before running full MOSEE analysis.

Usage: python scripts/fetch_preview.py AAPL
"""

import sys
import os
import json
import re

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from MOSEE.data_retrieval.rate_limiter import get_ticker_info


def search_suggestions(query: str, max_results: int = 5) -> list:
    """Search Yahoo Finance for ticker suggestions."""
    try:
        import yfinance as yf
        results = yf.Search(query)
        suggestions = []
        for q in (results.quotes or [])[:max_results]:
            if not q.get("symbol") or not q.get("isYahooFinance", True):
                continue
            suggestions.append({
                "symbol": q["symbol"],
                "name": q.get("longname") or q.get("shortname") or q["symbol"],
                "exchange": q.get("exchDisp") or q.get("exchange"),
                "type": q.get("typeDisp") or q.get("quoteType"),
            })
        return suggestions
    except Exception as e:
        print(f"Search failed: {e}", file=sys.stderr)
        return []


def resolve_ticker(query: str) -> str | None:
    """Try to resolve a company name or partial query to a ticker symbol via Yahoo Finance search."""
    try:
        import yfinance as yf
        results = yf.Search(query)
        quotes = results.quotes or []
        if quotes:
            # Return the first equity/stock result
            for q in quotes:
                qtype = (q.get("quoteType") or q.get("typeDisp") or "").upper()
                if qtype in ("EQUITY", "ETF", "MUTUALFUND", ""):
                    return q.get("symbol")
            # Fallback to first result
            return quotes[0].get("symbol")
    except Exception as e:
        print(f"Ticker resolution failed: {e}", file=sys.stderr)
    return None


def _has_useful_data(info: dict | None) -> bool:
    """Check if ticker info has meaningful data (not just empty/None fields)."""
    if not info:
        return False
    # Check for key fields that indicate real stock data
    return bool(
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("marketCap")
        or info.get("longName")
    )


def fetch_preview(ticker: str) -> dict:
    """Fetch basic preview data for a ticker."""
    info = get_ticker_info(ticker)

    # If direct lookup fails or returns empty data, try resolving via search
    # (handles company names like "APPLE" -> "AAPL")
    resolved_ticker = None
    if not _has_useful_data(info):
        resolved_ticker = resolve_ticker(ticker)
        if resolved_ticker and resolved_ticker.upper() != ticker.upper():
            resolved_info = get_ticker_info(resolved_ticker)
            if _has_useful_data(resolved_info):
                info = resolved_info
                ticker = resolved_ticker  # Use the resolved ticker from here on

    if not info:
        suggestions = search_suggestions(ticker)
        result = {"status": "error", "ticker": ticker, "error": f"No data found for {ticker}"}
        if suggestions:
            result["suggestions"] = suggestions
        return result

    # Check for required fields - if missing, ticker is likely invalid
    current_price = (
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("lastPrice")
    )
    market_cap = info.get("marketCap") or info.get("market_cap")

    if not current_price and not market_cap:
        suggestions = search_suggestions(ticker)
        result = {
            "status": "error",
            "ticker": ticker,
            "error": f"Invalid ticker or insufficient data for {ticker}",
        }
        if suggestions:
            result["suggestions"] = suggestions
        return result

    previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

    # Handle minor currency units (GBp -> GBP, ILA -> ILS, ZAc -> ZAR)
    currency = info.get("currency") or info.get("financialCurrency") or "USD"
    price_divisor = 1
    if currency == "GBp":
        currency = "GBP"
        price_divisor = 100
    elif currency == "ILA":
        currency = "ILS"
        price_divisor = 100
    elif currency == "ZAc":
        currency = "ZAR"
        price_divisor = 100

    def adjust_price(val):
        if val is None:
            return None
        return round(val / price_divisor, 2)

    # Calculate day change after currency adjustment
    adj_price = adjust_price(current_price)
    adj_close = adjust_price(previous_close)
    day_change = None
    day_change_percent = None
    if adj_price and adj_close and adj_close > 0:
        day_change = round(adj_price - adj_close, 2)
        day_change_percent = round((day_change / adj_close) * 100, 2)

    def safe_number(val):
        if val is None:
            return None
        try:
            f = float(val)
            if f != f:  # NaN check
                return None
            if abs(f) == float("inf"):
                return None
            return f
        except (TypeError, ValueError):
            return None

    average_volume = info.get("averageVolume") or info.get("averageDailyVolume10Day")

    result = {
        "status": "success",
        "ticker": ticker,
        "data": {
            "companyName": info.get("longName") or info.get("shortName") or ticker,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "exchange": info.get("exchange"),
            "currency": currency,
            "currentPrice": safe_number(adj_price),
            "previousClose": safe_number(adj_close),
            "dayChange": safe_number(day_change),
            "dayChangePercent": safe_number(day_change_percent),
            "marketCap": safe_number(market_cap),
            "trailingPE": safe_number(info.get("trailingPE")),
            "forwardPE": safe_number(info.get("forwardPE")),
            "priceToBook": safe_number(info.get("priceToBook")),
            "dividendYield": safe_number(info.get("dividendYield")),
            "fiftyTwoWeekHigh": adjust_price(safe_number(info.get("fiftyTwoWeekHigh"))),
            "fiftyTwoWeekLow": adjust_price(safe_number(info.get("fiftyTwoWeekLow"))),
            "averageVolume": safe_number(average_volume),
            "beta": safe_number(info.get("beta")),
        },
    }

    # If we resolved the ticker from a search query, include the resolved ticker
    # so the frontend can redirect (e.g., "APPLE" -> "AAPL")
    if resolved_ticker:
        result["resolvedTicker"] = ticker

    return result


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "error": "Usage: fetch_preview.py TICKER"}))
        sys.exit(1)

    ticker = sys.argv[1].upper().strip()

    if not re.match(r"^[A-Z0-9.\-]{1,10}$", ticker):
        print(json.dumps({"status": "error", "ticker": ticker, "error": "Invalid ticker format"}))
        sys.exit(1)

    try:
        result = fetch_preview(ticker)
        print(json.dumps(result))
        sys.exit(0 if result["status"] == "success" else 1)
    except Exception as e:
        print(f"Error fetching preview: {e}", file=sys.stderr)
        print(json.dumps({"status": "error", "ticker": ticker, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
