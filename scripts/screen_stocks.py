#!/usr/bin/env python3
"""
MOSEE Stock Screener

Filters the latest analysis per ticker on the implied annual return metric and
prints an aligned text table sorted by implied return (descending).

The default filters form the "Doubler" preset: stocks whose implied annual
return clears ~14.87%/yr (a ~2x over 5 years), with a confidence floor, a
margin-of-safety ceiling, and a freshness window.

Usage:
    python scripts/screen_stocks.py
    python scripts/screen_stocks.py --min-implied-return 0.20 --verdicts "BUY,STRONG BUY"
    python scripts/screen_stocks.py --all          # list everything, no filters

Environment Variables Required:
    POSTGRES_URL - PostgreSQL connection URL (same env as db_client.py)
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


# The "Doubler" preset: ~2x over 5 years => (2 ** (1/5)) - 1 ≈ 0.1487/yr.
DEFAULT_MIN_IMPLIED_RETURN = 0.1487
DEFAULT_MIN_CONFIDENCE = 50.0      # vs confidence_score (0-100)
DEFAULT_MAX_MOS = 1.0              # vs margin_of_safety (price/conservative, LOWER is better)
DEFAULT_MAX_AGE_DAYS = 60         # vs analysis_date
DEFAULT_LIMIT = 50


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Screen MOSEE analyses by implied annual return (Doubler preset by default).",
    )
    parser.add_argument(
        "--min-implied-return", type=float, default=DEFAULT_MIN_IMPLIED_RETURN,
        help=f"Minimum implied annual return as a decimal fraction (default {DEFAULT_MIN_IMPLIED_RETURN} ≈ 14.87%%/yr).",
    )
    parser.add_argument(
        "--min-confidence", type=float, default=DEFAULT_MIN_CONFIDENCE,
        help=f"Minimum confidence_score, 0-100 (default {DEFAULT_MIN_CONFIDENCE:.0f}).",
    )
    parser.add_argument(
        "--max-mos", type=float, default=DEFAULT_MAX_MOS,
        help=f"Maximum margin_of_safety = price/conservative; LOWER is better (default {DEFAULT_MAX_MOS}).",
    )
    parser.add_argument(
        "--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS,
        help=f"Maximum age of the analysis in days (default {DEFAULT_MAX_AGE_DAYS}).",
    )
    parser.add_argument(
        "--verdicts", type=str, default=None,
        help="Optional CSV of verdicts to keep, e.g. \"BUY,STRONG BUY,ACCUMULATE\".",
    )
    parser.add_argument(
        "--limit", type=int, default=DEFAULT_LIMIT,
        help=f"Maximum rows to print (default {DEFAULT_LIMIT}).",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Drop all filters and list every ticker (including NULL implied return).",
    )
    return parser.parse_args(argv)


def fetch_latest_rows(client):
    """Fetch the latest analysis row per ticker (DISTINCT ON), newest first."""
    conn = client._get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT ON (ticker)
            ticker, company_name, current_price, valuation_base,
            implied_annual_return, margin_of_safety, confidence_score,
            verdict, analysis_date
        FROM mosee_stock_analyses
        ORDER BY ticker, analysis_date DESC
        """
    )
    rows = cur.fetchall()
    cur.close()
    # RealDictCursor rows are dict-like; normalise to plain dicts.
    return [dict(r) for r in rows]


def _apply_filters(rows, args):
    """Apply the active filter set, returning (kept_rows, filter_header)."""
    if args.all:
        return rows, "Filters: NONE (--all: listing everything, including NULL implied return)"

    verdict_set = None
    if args.verdicts:
        verdict_set = {v.strip().upper() for v in args.verdicts.split(",") if v.strip()}

    today = datetime.now().date()
    kept = []
    for r in rows:
        iar = r.get("implied_annual_return")
        if iar is None:
            continue  # NULL implied return excluded unless --all
        if float(iar) < args.min_implied_return:
            continue

        conf = r.get("confidence_score")
        if conf is None or float(conf) < args.min_confidence:
            continue

        mos = r.get("margin_of_safety")
        if mos is None or float(mos) > args.max_mos:
            continue

        adate = r.get("analysis_date")
        if adate is not None:
            age_days = (today - adate).days
            if age_days > args.max_age_days:
                continue

        if verdict_set is not None:
            v = (r.get("verdict") or "").upper()
            if v not in verdict_set:
                continue

        kept.append(r)

    header = (
        "Filters: "
        f"min_implied_return>={args.min_implied_return:.4f} ({args.min_implied_return * 100:.2f}%/yr), "
        f"min_confidence>={args.min_confidence:.0f}, "
        f"max_mos<={args.max_mos:.2f}, "
        f"max_age_days<={args.max_age_days}"
    )
    if verdict_set is not None:
        header += f", verdicts={sorted(verdict_set)}"
    return kept, header


def _fmt_num(value, places=2):
    if value is None:
        return "-"
    try:
        return f"{float(value):.{places}f}"
    except (TypeError, ValueError):
        return "-"


def _fmt_pct(value):
    if value is None:
        return "-"
    try:
        return f"{float(value) * 100:.2f}%"
    except (TypeError, ValueError):
        return "-"


def print_table(rows, limit):
    """Print an aligned text table sorted by implied_annual_return desc."""
    def sort_key(r):
        iar = r.get("implied_annual_return")
        # NULLs (only present under --all) sort to the bottom.
        return float(iar) if iar is not None else float("-inf")

    rows = sorted(rows, key=sort_key, reverse=True)[:limit]

    headers = [
        "TICKER", "COMPANY", "PRICE", "VAL_BASE",
        "IMPL_RET", "MOS", "CONF", "VERDICT", "DATE",
    ]
    table = [headers]
    for r in rows:
        company = (r.get("company_name") or "")[:28]
        table.append([
            str(r.get("ticker") or "-"),
            company,
            _fmt_num(r.get("current_price")),
            _fmt_num(r.get("valuation_base")),
            _fmt_pct(r.get("implied_annual_return")),
            _fmt_num(r.get("margin_of_safety")),
            _fmt_num(r.get("confidence_score"), 0),
            str(r.get("verdict") or "-"),
            str(r.get("analysis_date") or "-"),
        ])

    # Compute column widths.
    widths = [max(len(row[i]) for row in table) for i in range(len(headers))]

    def render(row):
        return "  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row))

    print(render(table[0]))
    print("  ".join("-" * w for w in widths))
    for row in table[1:]:
        print(render(row))

    print("")
    print(f"{len(rows)} row(s) shown.")


def main(argv=None):
    args = parse_args(argv)

    postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not postgres_url:
        print("ERROR: POSTGRES_URL environment variable is required.")
        print('  export POSTGRES_URL="postgres://user:pass@host:5432/db"')
        sys.exit(1)

    from MOSEE.db_client import MOSEEDatabaseClient

    client = MOSEEDatabaseClient()
    try:
        rows = fetch_latest_rows(client)
    finally:
        client.close()

    kept, header = _apply_filters(rows, args)
    print(header)
    print("")
    print_table(kept, args.limit)


if __name__ == "__main__":
    main()
