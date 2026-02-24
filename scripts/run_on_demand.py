#!/usr/bin/env python3
"""
MOSEE On-Demand Analysis Script

Runs analysis on a single ticker, saves to database, and prints JSON to stdout.
Used by the web API for on-demand analysis requests.

Usage:
    python scripts/run_on_demand.py AAPL

Output (stdout):
    {"status": "success", "ticker": "AAPL", "verdict": "BUY", "company_name": "Apple Inc.", ...}
    {"status": "error", "ticker": "AAPL", "error": "No market data found"}

Exit codes:
    0 = success
    1 = error
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def log(msg: str):
    """Print to stderr so stdout stays clean for JSON output."""
    print(msg, file=sys.stderr)


def run_on_demand(ticker: str) -> dict:
    """
    Run MOSEE analysis on a single ticker and save to database.

    Returns a dict with status and result summary.
    """
    # Import run_single_analysis from run_local_report via importlib
    # (scripts/ is not a Python package, so we load by file path)
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "run_local_report",
        Path(__file__).parent / "run_local_report.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    run_single_analysis = mod.run_single_analysis

    from MOSEE.db_client import MOSEEDatabaseClient

    log(f"Starting analysis for {ticker}...")

    start_date = "2020-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")

    # Run the analysis (reuses run_local_report's self-contained version)
    result = run_single_analysis(ticker, start_date, end_date)

    if result is None:
        return {
            "status": "error",
            "ticker": ticker,
            "error": f"No data found for {ticker}. The ticker may be invalid or have insufficient financial data."
        }

    # Save to database
    log("Saving to database...")
    try:
        db = MOSEEDatabaseClient()
        run_id = db.start_analysis_run()
        saved = db.save_analysis_result(run_id, result)
        db.complete_analysis_run(run_id, 1 if saved else 0)

        # Save raw data for data transparency page
        raw = result.get('raw_data')
        if raw:
            db.save_raw_data(ticker, raw)

        if not saved:
            log("Warning: Failed to save to database")
    except Exception as e:
        log(f"Warning: Database save failed: {e}")
        # Continue — we still have the analysis result

    # Build success response
    intel = result.get("intelligence_report", {})
    quality = intel.get("quality", {})

    return {
        "status": "success",
        "ticker": ticker,
        "company_name": result.get("company_name", ticker),
        "verdict": intel.get("verdict", "INSUFFICIENT DATA"),
        "quality_grade": quality.get("grade") if isinstance(quality, dict) else intel.get("quality_grade"),
        "current_price": result.get("Current Price"),
        "market_cap": result.get("Market Cap"),
    }


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "ticker": "", "error": "Usage: python run_on_demand.py TICKER"}))
        sys.exit(1)

    ticker = sys.argv[1].upper().strip()

    # Validate ticker format
    if not re.match(r'^[A-Z0-9.\-]{1,10}$', ticker):
        print(json.dumps({"status": "error", "ticker": ticker, "error": "Invalid ticker format"}))
        sys.exit(1)

    try:
        result = run_on_demand(ticker)
        print(json.dumps(result))
        sys.exit(0 if result["status"] == "success" else 1)
    except Exception as e:
        log(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "error", "ticker": ticker, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
