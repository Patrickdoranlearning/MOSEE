"""Diagnose MOSEE score components for specific tickers and the overall distribution."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

from MOSEE.db_client import get_connection

TICKERS = ("CDI.PA", "FISV")

with get_connection() as conn, conn.cursor() as cur:
    cur.execute(
        """
        SELECT ticker, company_name, country, current_price, market_cap,
               verdict, quality_grade, margin_of_safety,
               valuation_conservative, valuation_base, valuation_optimistic,
               pad_mos, dcf_mos, book_mos,
               pad_mosee, dcf_mosee, book_mosee,
               all_metrics->'earnings_equity' AS earnings_equity_metric,
               all_metrics->'net_income'      AS net_income_metric,
               all_metrics->'eps'             AS eps_metric,
               all_metrics->'pe_ratio'        AS pe_metric,
               all_metrics->'earnings_growth' AS eg_metric,
               concerns
          FROM mosee_stock_analyses
         WHERE ticker = ANY(%s)
         ORDER BY ticker, analysis_date DESC
        """,
        (list(TICKERS),),
    )
    rows = cur.fetchall()
    seen = set()
    print("=" * 80)
    print("PER-TICKER COMPONENTS")
    print("=" * 80)
    for row in rows:
        if row["ticker"] in seen:
            continue
        seen.add(row["ticker"])
        for k, v in row.items():
            print(f"  {k:30s} {v}")
        print("-" * 80)

    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE pad_mosee IS NOT NULL)                          AS n,
          MIN(pad_mosee)                                                         AS min,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY pad_mosee)                AS p25,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY pad_mosee)                AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY pad_mosee)                AS p75,
          percentile_cont(0.90) WITHIN GROUP (ORDER BY pad_mosee)                AS p90,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY pad_mosee)                AS p95,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY pad_mosee)                AS p99,
          MAX(pad_mosee)                                                         AS max,
          AVG(pad_mosee)                                                         AS mean
        FROM (
          SELECT DISTINCT ON (ticker) ticker, pad_mosee
            FROM mosee_stock_analyses
           WHERE pad_mosee IS NOT NULL
           ORDER BY ticker, analysis_date DESC
        ) t
        """
    )
    dist = cur.fetchone()
    print("\nPAD_MOSEE DISTRIBUTION (latest per ticker)")
    print("=" * 80)
    for k, v in dist.items():
        if isinstance(v, (int, float)) and v is not None:
            print(f"  {k:6s} {float(v):.4f}")
        else:
            print(f"  {k:6s} {v}")

    cur.execute(
        """
        SELECT ticker, company_name, current_price, pad_mos, pad_mosee,
               all_metrics->'earnings_equity' AS earnings_equity
          FROM (
            SELECT DISTINCT ON (ticker) ticker, company_name, current_price,
                   pad_mos, pad_mosee, all_metrics, analysis_date
              FROM mosee_stock_analyses
             WHERE pad_mosee IS NOT NULL
             ORDER BY ticker, analysis_date DESC
          ) t
         ORDER BY pad_mosee DESC
         LIMIT 10
        """
    )
    print("\nTOP 10 BY PAD_MOSEE")
    print("=" * 80)
    for r in cur.fetchall():
        print(
            f"  {r['ticker']:10s} pad_mosee={float(r['pad_mosee']):.4f}  "
            f"pad_mos={float(r['pad_mos']) if r['pad_mos'] is not None else None}  "
            f"EY={r['earnings_equity']}  price={r['current_price']}  {r['company_name']}"
        )
