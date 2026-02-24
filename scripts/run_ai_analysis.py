#!/usr/bin/env python3
"""
MOSEE AI Annual Report Analyzer — On-Demand CLI

Run AI-powered qualitative analysis on selected stocks.
Reads 10-K filings from SEC EDGAR, retrieves investment wisdom
via RAG, and sends to Gemini 2.5 Flash for structured analysis.

Usage:
    # Analyze specific tickers
    python scripts/run_ai_analysis.py AAPL MSFT BRK-B

    # Analyze all stocks with a specific verdict from the latest run
    python scripts/run_ai_analysis.py --from-db --verdict "STRONG BUY" "BUY"

    # Analyze with a different model
    python scripts/run_ai_analysis.py AAPL --model gemini-2.5-pro

Environment Variables Required:
    GEMINI_API_KEY  - Google AI Studio API key
    POSTGRES_URL    - PostgreSQL connection URL (for fetching metrics + storing results)
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from MOSEE.db_client import MOSEEDatabaseClient, init_database
from MOSEE.ai_analysis.report_analyzer import analyze_annual_reports


def print_banner():
    print("""
    ╔══════════════════════════════════════════════════════════════════╗
    ║   MOSEE AI Annual Report Analyzer                              ║
    ║   Powered by Gemini 2.5 Flash + RAG Knowledge Base             ║
    ╚══════════════════════════════════════════════════════════════════╝
    """)


def get_tickers_from_db(db_client: MOSEEDatabaseClient, verdicts: list) -> list:
    """Fetch tickers from the database filtered by verdict."""
    try:
        conn = db_client._get_conn()
        cur = conn.cursor()

        # Get the latest analysis date
        cur.execute("""
            SELECT DISTINCT ticker, company_name, verdict, quality_grade
            FROM mosee_stock_analyses
            WHERE analysis_date = (SELECT MAX(analysis_date) FROM mosee_stock_analyses)
              AND verdict = ANY(%s)
            ORDER BY ticker
        """, (verdicts,))

        rows = cur.fetchall()
        cur.close()

        tickers = []
        for row in rows:
            tickers.append({
                'ticker': row['ticker'],
                'company_name': row['company_name'],
                'verdict': row['verdict'],
                'quality_grade': row['quality_grade'],
            })
        return tickers

    except Exception as e:
        print(f"Error fetching tickers from DB: {e}")
        return []


def analyze_ticker(
    ticker: str,
    db_client: MOSEEDatabaseClient,
    model_name: str = None,
) -> bool:
    """Run AI analysis on a single ticker. Returns True on success."""

    # Fetch existing quantitative metrics from the database
    stock_data = db_client.fetch_stock_metrics(ticker)

    if not stock_data:
        print(f"  No quantitative analysis found for {ticker} in database.")
        print(f"  Run the weekly analysis first, then come back for AI analysis.")
        return False

    all_metrics = stock_data.get('all_metrics', {})
    company_name = stock_data.get('company_name', ticker)

    print(f"\n{'='*60}")
    print(f"  Analyzing: {ticker} — {company_name}")
    print(f"{'='*60}")

    # Run the AI analysis
    result = analyze_annual_reports(
        ticker=ticker,
        all_metrics=all_metrics,
        company_name=company_name,
        db_client=db_client,
        model_name=model_name,
    )

    if not result:
        print(f"  AI analysis could not be completed for {ticker}")
        return False

    # Save to database
    saved = db_client.save_ai_analysis(result.to_dict())
    if saved:
        print(f"  Saved to database")
    else:
        print(f"  Warning: Failed to save to database")

    # Print summary
    print(f"\n  AI Composite Score: {result.composite_ai_score:.1f}/100")
    print(f"  Model: {result.model_used}")
    print(f"  Filings analyzed: {result.filing_years}")
    print(f"\n  Executive Summary:")
    print(f"  {result.executive_summary}")

    if result.competitive_advantages:
        print(f"\n  Competitive Advantages:")
        for adv in result.competitive_advantages:
            print(f"    + {adv}")

    if result.red_flags:
        print(f"\n  Red Flags:")
        for flag in result.red_flags:
            print(f"    ! {flag}")

    print(f"\n  Dimension Scores:")
    for dim in result.dimensions:
        bar = "█" * int(dim.score / 5) + "░" * (20 - int(dim.score / 5))
        conf = f"(conf: {dim.confidence:.0%})"
        print(f"    {dim.name:25s} {bar} {dim.score:5.1f} {conf}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="MOSEE AI Annual Report Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/run_ai_analysis.py AAPL MSFT BRK-B
  python scripts/run_ai_analysis.py --from-db --verdict "STRONG BUY" "BUY"
  python scripts/run_ai_analysis.py AAPL --model gemini-2.5-pro
        """,
    )
    parser.add_argument(
        'tickers', nargs='*',
        help='Stock tickers to analyze (e.g., AAPL MSFT BRK-B)',
    )
    parser.add_argument(
        '--from-db', action='store_true',
        help='Select tickers from the database instead of specifying them',
    )
    parser.add_argument(
        '--verdict', nargs='+', default=['STRONG BUY', 'BUY'],
        help='Filter tickers by verdict when using --from-db (default: STRONG BUY, BUY)',
    )
    parser.add_argument(
        '--model', default=None,
        help='Gemini model to use (default: gemini-2.5-flash)',
    )
    parser.add_argument(
        '--verbose', '-v', action='store_true',
        help='Enable verbose logging',
    )

    args = parser.parse_args()

    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
        datefmt='%H:%M:%S',
    )

    print_banner()

    # Check for GEMINI_API_KEY
    if not os.environ.get('GEMINI_API_KEY'):
        print("Error: GEMINI_API_KEY environment variable not set.")
        print("Get an API key from: https://aistudio.google.com/apikey")
        print("Then set it: export GEMINI_API_KEY=your_key_here")
        sys.exit(1)

    # Check for database URL
    if not (os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL')):
        print("Error: POSTGRES_URL or DATABASE_URL environment variable not set.")
        sys.exit(1)

    # Initialize database (creates tables if needed)
    try:
        init_database()
    except Exception as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)

    db_client = MOSEEDatabaseClient()

    # Determine which tickers to analyze
    if args.from_db:
        print(f"Fetching tickers from database with verdicts: {args.verdict}")
        ticker_data = get_tickers_from_db(db_client, args.verdict)
        if not ticker_data:
            print("No matching tickers found in database.")
            sys.exit(0)

        print(f"\nFound {len(ticker_data)} stocks:")
        for td in ticker_data:
            print(f"  {td['ticker']:8s} {td['company_name'] or '':30s} {td['verdict']:15s} {td['quality_grade'] or ''}")

        tickers = [td['ticker'] for td in ticker_data]
    elif args.tickers:
        tickers = [t.upper() for t in args.tickers]
    else:
        parser.print_help()
        sys.exit(1)

    print(f"\nAnalyzing {len(tickers)} stock(s): {', '.join(tickers)}")
    model = args.model or os.environ.get('MOSEE_AI_MODEL', 'gemini-2.5-flash')
    print(f"Model: {model}")
    print()

    # Analyze each ticker
    success_count = 0
    fail_count = 0

    for ticker in tickers:
        try:
            if analyze_ticker(ticker, db_client, model_name=model):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"  Unexpected error analyzing {ticker}: {e}")
            fail_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"  Analysis Complete")
    print(f"  Successful: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"{'='*60}")

    db_client.close()


if __name__ == "__main__":
    main()
