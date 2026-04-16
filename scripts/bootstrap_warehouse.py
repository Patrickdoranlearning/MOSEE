#!/usr/bin/env python3
"""
MOSEE Financial Data Warehouse — Bulk Bootstrap Script

Downloads 30 years of financial history for ALL tickers in your universe
and saves to the mosee_financial_history warehouse. Run this once with a
paid FMP subscription to seed the warehouse, then cancel.

Data sources (in order):
1. SEC EDGAR — US stocks, free, no key needed, 10-20 years
2. FMP — Global stocks, paid plan gets 30+ years for all exchanges
3. Yahoo Timeseries — All stocks, bypasses yfinance 4yr limit

Usage:
    # Bootstrap everything (US via EDGAR, international via FMP)
    python scripts/bootstrap_warehouse.py

    # Only US stocks via EDGAR (no FMP key needed)
    python scripts/bootstrap_warehouse.py --edgar-only

    # Only specific tickers
    python scripts/bootstrap_warehouse.py --tickers AAPL,MSFT,EDEN.PA

    # Resume from where you left off (skip first N)
    python scripts/bootstrap_warehouse.py --skip 500

    # Limit batch size
    python scripts/bootstrap_warehouse.py --limit 100

    # Dry run (show what would be fetched, don't save)
    python scripts/bootstrap_warehouse.py --dry-run
"""

import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import pandas as pd
from MOSEE.db_client import MOSEEDatabaseClient, init_database
from MOSEE.data_retrieval.sec_edgar import (
    get_extended_financials as edgar_get_financials,
    resolve_cik,
)
from MOSEE.data_retrieval.fmp_client import (
    get_extended_financials as fmp_get_financials,
)
from MOSEE.data_retrieval.fundamental_data import dataframe_to_json


def load_tickers(ticker_filter: str = None) -> pd.DataFrame:
    """Load ticker list from CSV."""
    csv_path = Path(__file__).parent.parent / "data" / "ticker_data_enhanced.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found")
        sys.exit(1)
    df = pd.read_csv(csv_path)
    if ticker_filter:
        tickers = [t.strip().upper() for t in ticker_filter.split(",")]
        df = df[df["ticker"].str.upper().isin(tickers)]
    return df


def bootstrap_ticker(
    ticker: str,
    currency: str,
    db_client: MOSEEDatabaseClient,
    edgar_only: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Download all available history for a single ticker and save to warehouse.

    Returns dict with stats: {source, years_saved, statement_types}
    """
    stats = {"ticker": ticker, "source": None, "years_saved": 0}

    ext_data = None
    source = None

    # 1) Try SEC EDGAR first (US stocks — free, no key)
    is_us = resolve_cik(ticker) is not None
    if is_us:
        try:
            ext_data = edgar_get_financials(ticker)
            if ext_data:
                source = "SEC EDGAR"
        except Exception as e:
            print(f"    EDGAR error: {e}")

    # 2) Try FMP (all stocks — needs paid key for international)
    if ext_data is None and not edgar_only:
        try:
            ext_data = fmp_get_financials(ticker)
            if ext_data:
                source = "FMP"
        except Exception as e:
            print(f"    FMP error: {e}")

    if ext_data is None:
        stats["source"] = "no data"
        return stats

    stats["source"] = source

    if dry_run:
        for key, df in ext_data.items():
            if df is not None and not df.empty:
                stats["years_saved"] = max(stats["years_saved"], len(df.columns))
        return stats

    # Save each statement type to warehouse
    stmt_map = {
        "financials": "income_statement",
        "balance_sheet": "balance_sheet",
        "cashflow": "cash_flow",
    }

    total_saved = 0
    for ext_key, stmt_type in stmt_map.items():
        df = ext_data.get(ext_key)
        if df is None or df.empty:
            continue

        # Convert DataFrame to JSON format for warehouse storage
        json_data = dataframe_to_json(df)
        if not json_data.get("years"):
            continue

        saved = db_client.save_financial_history(
            ticker=ticker,
            statement_type=stmt_type,
            statement_json=json_data,
            currency=currency,
            source=source,
        )
        total_saved += saved

    stats["years_saved"] = total_saved
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap MOSEE financial data warehouse"
    )
    parser.add_argument(
        "--tickers", type=str, default=None,
        help="Comma-separated list of tickers (default: all)"
    )
    parser.add_argument(
        "--edgar-only", action="store_true",
        help="Only use SEC EDGAR (US stocks, no FMP key needed)"
    )
    parser.add_argument(
        "--skip", type=int, default=0,
        help="Skip first N tickers (resume from where you left off)"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Maximum number of tickers to process"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be fetched without saving"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  MOSEE Financial Data Warehouse — Bulk Bootstrap")
    print("=" * 60)
    print()

    # Check FMP key
    fmp_key = os.environ.get("FMP_API_KEY")
    if not args.edgar_only:
        if fmp_key:
            print(f"  FMP API key: {fmp_key[:8]}...{fmp_key[-4:]}")
        else:
            print("  FMP API key: NOT SET (only EDGAR/US stocks will work)")
            print("  Set FMP_API_KEY env var for international stocks")
    else:
        print("  Mode: EDGAR only (US stocks)")

    if args.dry_run:
        print("  ** DRY RUN — no data will be saved **")
    print()

    # Load tickers
    ticker_df = load_tickers(args.tickers)
    total = len(ticker_df)
    print(f"  Loaded {total} tickers")

    # Apply skip/limit
    if args.skip > 0:
        ticker_df = ticker_df.iloc[args.skip:]
        print(f"  Skipping first {args.skip}, {len(ticker_df)} remaining")
    if args.limit:
        ticker_df = ticker_df.head(args.limit)
        print(f"  Limiting to {len(ticker_df)} tickers")

    # Initialize database
    if not args.dry_run:
        print()
        print("  Connecting to database...")
        try:
            db = MOSEEDatabaseClient()
            init_database()
            print("  Connected")
        except Exception as e:
            print(f"  Database connection failed: {e}")
            sys.exit(1)
    else:
        db = None

    # Process tickers
    print()
    print(f"  Processing {len(ticker_df)} tickers...")
    print("-" * 60)

    processed = 0
    saved_total = 0
    errors = 0
    sources = {"SEC EDGAR": 0, "FMP": 0, "no data": 0}
    start_time = time.time()

    for idx, (_, row) in enumerate(ticker_df.iterrows()):
        ticker = row["ticker"]
        currency = row.get("financial_currency", row.get("currency", "USD"))
        progress = f"[{idx + 1}/{len(ticker_df)}]"

        try:
            stats = bootstrap_ticker(
                ticker, currency, db,
                edgar_only=args.edgar_only,
                dry_run=args.dry_run,
            )

            source = stats["source"] or "no data"
            years = stats["years_saved"]
            sources[source] = sources.get(source, 0) + 1
            saved_total += years
            processed += 1

            if years > 0:
                print(f"  {progress} {ticker:12s} {source:15s} +{years} records")
            else:
                print(f"  {progress} {ticker:12s} {source}")

        except Exception as e:
            errors += 1
            print(f"  {progress} {ticker:12s} ERROR: {e}")

        # Progress stats every 50 tickers
        if (idx + 1) % 50 == 0:
            elapsed = time.time() - start_time
            rate = (idx + 1) / elapsed * 60
            remaining = (len(ticker_df) - idx - 1) / (rate / 60) if rate > 0 else 0
            print(f"  --- {idx + 1} done | {rate:.0f}/min | ~{remaining:.0f}s remaining ---")

    # Summary
    elapsed = time.time() - start_time
    print()
    print("=" * 60)
    print("  BOOTSTRAP COMPLETE")
    print("=" * 60)
    print(f"  Tickers processed: {processed}")
    print(f"  Total records saved: {saved_total}")
    print(f"  Errors: {errors}")
    print(f"  Time: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print()
    print("  By source:")
    for source, count in sorted(sources.items()):
        print(f"    {source}: {count} tickers")
    print()

    if not args.dry_run and saved_total > 0:
        print("  Warehouse is ready. Future analysis runs will use this data")
        print("  as the primary source (no external API calls needed).")


if __name__ == "__main__":
    main()
