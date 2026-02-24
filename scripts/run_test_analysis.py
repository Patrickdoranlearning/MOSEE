#!/usr/bin/env python3
"""
MOSEE Test Analysis Script

Run analysis on a small set of specific tickers for testing.
This clears existing data and runs fresh analysis.

Usage:
    python scripts/run_test_analysis.py                    # Uses default test tickers
    python scripts/run_test_analysis.py AAPL MSFT GOOGL   # Uses specified tickers
"""

import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from MOSEE.db_client import MOSEEDatabaseClient, init_database

# Import the analysis function from weekly analysis
from scripts.run_weekly_analysis import run_single_analysis

# Default test tickers - a mix of different types
DEFAULT_TEST_TICKERS = [
    {"ticker": "AAPL", "name": "Apple Inc.", "country": "United States", "industry": "Technology", "cap": "mega", "currency": "USD"},
    {"ticker": "BRK-B", "name": "Berkshire Hathaway Inc.", "country": "United States", "industry": "Financial Services", "cap": "mega", "currency": "USD"},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "country": "United States", "industry": "Technology", "cap": "mega", "currency": "USD"},
    {"ticker": "JNJ", "name": "Johnson & Johnson", "country": "United States", "industry": "Healthcare", "cap": "mega", "currency": "USD"},
    {"ticker": "KO", "name": "The Coca-Cola Company", "country": "United States", "industry": "Consumer Defensive", "cap": "large", "currency": "USD"},
]


def clear_database():
    """Clear all existing analysis data from the database."""
    from MOSEE.db_client import get_client

    client = get_client()
    conn = client._get_conn()
    cur = conn.cursor()

    try:
        # Delete all stock analyses
        cur.execute("DELETE FROM mosee_stock_analyses")
        # Delete all analysis runs
        cur.execute("DELETE FROM mosee_analysis_runs")
        conn.commit()
        print("  ✓ Cleared existing data")
    except Exception as e:
        print(f"  ✗ Error clearing data: {e}")
        conn.rollback()
    finally:
        cur.close()


def main():
    print("=" * 60)
    print("MOSEE Test Analysis")
    print("=" * 60)
    print("")

    # Check for database URL
    postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not postgres_url:
        print("ERROR: POSTGRES_URL environment variable is required.")
        print('  export POSTGRES_URL="postgres://user:pass@host:5432/db"')
        sys.exit(1)

    # Get tickers from command line or use defaults
    if len(sys.argv) > 1:
        tickers = [
            {"ticker": t.upper(), "name": t.upper(), "country": "United States", "industry": "Unknown", "cap": "large", "currency": "USD"}
            for t in sys.argv[1:]
        ]
        print(f"Using command-line tickers: {[t['ticker'] for t in tickers]}")
    else:
        tickers = DEFAULT_TEST_TICKERS
        print(f"Using default test tickers: {[t['ticker'] for t in tickers]}")

    print("")

    # Initialize database
    print("Initializing database...")
    init_database()
    print("  ✓ Database initialized")

    # Clear existing data
    print("Clearing existing data...")
    clear_database()

    # Create client and start run
    print("Starting analysis run...")
    client = MOSEEDatabaseClient()
    run_id = client.start_analysis_run()
    print(f"  ✓ Created run: {run_id}")

    # Run analysis
    print("")
    print("Running analysis...")

    start_date = "2020-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")

    results = []
    for idx, ticker_info in enumerate(tickers):
        ticker = ticker_info["ticker"]
        print(f"  [{idx + 1}/{len(tickers)}] Analyzing {ticker}...", end=" ")

        try:
            result = run_single_analysis(ticker, start_date, end_date, ticker_info)

            if result:
                results.append(result)
                verdict = result.get('intelligence_report', {}).get('verdict', 'N/A')
                print(f"✓ {verdict}")
            else:
                print("✗ No data")
        except Exception as e:
            print(f"✗ Error: {e}")

    # Save results
    print("")
    print("Saving results...")
    saved_count = client.save_batch_results(run_id, results)
    print(f"  ✓ Saved {saved_count} results")

    # Complete run
    client.complete_analysis_run(run_id, len(results))

    print("")
    print("=" * 60)
    print(f"Test analysis complete! Analyzed {len(results)} stocks.")
    print("Visit your web app to see the results.")
    print("=" * 60)


if __name__ == "__main__":
    main()
