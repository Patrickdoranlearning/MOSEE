/**
 * MOSEE Database Client for Next.js
 *
 * Connects to PostgreSQL (Vercel Postgres) to retrieve stock analysis data
 * written by the Python weekly analysis scripts.
 */

import { sql } from '@vercel/postgres'
import type { StockAnalysis, StockSummary, StockRawData, RawFinancialStatement, ScreenerRow } from '@/types/mosee'

/**
 * Convert PostgreSQL NUMERIC fields (returned as strings) to JavaScript numbers.
 * This is needed because @vercel/postgres returns NUMERIC as strings to preserve precision.
 */
function convertNumericFields(row: Record<string, unknown>): StockAnalysis {
  const numericFields = [
    'current_price', 'market_cap', 'quality_score', 'margin_of_safety',
    'buy_below_price', 'valuation_conservative', 'valuation_base', 'valuation_optimistic',
    'pad_mos', 'dcf_mos', 'book_mos', 'pad_mosee', 'dcf_mosee', 'book_mosee',
    'confidence_score', 'implied_annual_return'
  ]

  const result = { ...row } as Record<string, unknown>

  for (const field of numericFields) {
    if (result[field] !== null && result[field] !== undefined) {
      const converted = Number(result[field])
      // Guard against NaN from bad data
      result[field] = isNaN(converted) ? null : converted
    }
  }

  return result as unknown as StockAnalysis
}

/**
 * Get the latest analysis for every ticker.
 * Results are sorted by verdict priority (best picks first).
 */
export async function getAllAnalyses(): Promise<StockAnalysis[]> {
  const { rows } = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (ticker) *
      FROM mosee_stock_analyses
      ORDER BY ticker, analysis_date DESC
    ) latest
    ORDER BY
      CASE verdict
        WHEN 'STRONG BUY' THEN 1
        WHEN 'BUY' THEN 2
        WHEN 'ACCUMULATE' THEN 3
        WHEN 'WATCHLIST' THEN 4
        WHEN 'HOLD' THEN 5
        WHEN 'REDUCE' THEN 6
        WHEN 'SELL' THEN 7
        WHEN 'AVOID' THEN 8
        ELSE 9
      END,
      quality_score DESC NULLS LAST
  `

  return rows.map(row => convertNumericFields(row as Record<string, unknown>))
}

/**
 * Get top stock picks with the best verdicts.
 * @param limit - Maximum number of results to return
 */
export async function getTopPicks(limit: number = 10): Promise<StockAnalysis[]> {
  const { rows } = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (ticker) *
      FROM mosee_stock_analyses
      ORDER BY ticker, analysis_date DESC
    ) latest
    WHERE verdict IN ('STRONG BUY', 'BUY', 'ACCUMULATE')
    ORDER BY
      CASE verdict
        WHEN 'STRONG BUY' THEN 1
        WHEN 'BUY' THEN 2
        WHEN 'ACCUMULATE' THEN 3
        ELSE 4
      END,
      quality_score DESC NULLS LAST,
      margin_of_safety DESC NULLS LAST
    LIMIT ${limit}
  `

  return rows.map(row => convertNumericFields(row as Record<string, unknown>))
}

/**
 * Get summary statistics from the most recent analysis.
 */
export async function getAnalysisStats(): Promise<{
  totalAnalyzed: number
  buyCount: number
  analysisDate: string | null
} | null> {
  const { rows } = await sql`
    SELECT
      COUNT(*) as total_analyzed,
      COUNT(*) FILTER (WHERE verdict IN ('STRONG BUY', 'BUY', 'ACCUMULATE')) as buy_count,
      MAX(analysis_date) as analysis_date
    FROM (
      SELECT DISTINCT ON (ticker) verdict, analysis_date
      FROM mosee_stock_analyses
      ORDER BY ticker, analysis_date DESC
    ) latest
  `
  
  if (rows.length === 0) {
    return null
  }
  
  const row = rows[0]
  return {
    totalAnalyzed: Number(row.total_analyzed) || 0,
    buyCount: Number(row.buy_count) || 0,
    analysisDate: row.analysis_date ? String(row.analysis_date) : null,
  }
}

/**
 * Get a single stock analysis by ticker symbol.
 * Returns the most recent analysis for the ticker.
 * @param ticker - Stock ticker symbol (e.g., "AAPL")
 */
export async function getStockAnalysis(ticker: string): Promise<StockAnalysis | null> {
  const { rows } = await sql`
    SELECT *
    FROM mosee_stock_analyses
    WHERE UPPER(ticker) = UPPER(${ticker})
    ORDER BY analysis_date DESC
    LIMIT 1
  `

  if (rows.length === 0) {
    return null
  }

  return convertNumericFields(rows[0] as Record<string, unknown>)
}

/**
 * Get raw yfinance data for a stock (for data transparency/auditing).
 * Returns the most recent raw data for the ticker.
 */
export async function getStockRawData(ticker: string): Promise<StockRawData | null> {
  const { rows } = await sql`
    SELECT *
    FROM mosee_raw_data
    WHERE UPPER(ticker) = UPPER(${ticker})
    ORDER BY analysis_date DESC
    LIMIT 1
  `

  if (rows.length === 0) {
    return null
  }

  return rows[0] as unknown as StockRawData
}

/**
 * Get accumulated financial history from the warehouse.
 * Returns all years for all 3 statement types, reconstructed in
 * the same format as mosee_raw_data (line_items + years).
 */
export async function getFinancialHistory(ticker: string): Promise<{
  income_statement: RawFinancialStatement
  balance_sheet: RawFinancialStatement
  cash_flow: RawFinancialStatement
} | null> {
  const { rows } = await sql`
    SELECT statement_type, fiscal_year, data
    FROM mosee_financial_history
    WHERE UPPER(ticker) = UPPER(${ticker})
    ORDER BY statement_type, fiscal_year ASC
  `

  if (rows.length === 0) {
    return null
  }

  // Reconstruct {line_items, years} per statement type
  const result: Record<string, { line_items: Record<string, Record<string, number | null>>; years: string[] }> = {}

  for (const row of rows) {
    const stmtType = row.statement_type as string
    const year = String(row.fiscal_year)
    const data = (row.data || {}) as Record<string, number | null>

    if (!result[stmtType]) {
      result[stmtType] = { line_items: {}, years: [] }
    }
    result[stmtType].years.push(year)

    for (const [field, value] of Object.entries(data)) {
      if (!result[stmtType].line_items[field]) {
        result[stmtType].line_items[field] = {}
      }
      result[stmtType].line_items[field][year] = value
    }
  }

  return {
    income_statement: result['income_statement'] || { line_items: {}, years: [] },
    balance_sheet: result['balance_sheet'] || { line_items: {}, years: [] },
    cash_flow: result['cash_flow'] || { line_items: {}, years: [] },
  }
}

/**
 * Get stocks in the same industry for competitor comparison.
 * Returns the latest analysis for each peer, excluding the given ticker.
 */
export async function getIndustryPeers(industry: string, excludeTicker: string): Promise<StockAnalysis[]> {
  const { rows } = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (ticker) *
      FROM mosee_stock_analyses
      WHERE industry = ${industry}
        AND UPPER(ticker) != UPPER(${excludeTicker})
      ORDER BY ticker, analysis_date DESC
    ) latest
    ORDER BY quality_score DESC NULLS LAST
    LIMIT 10
  `

  return rows.map(row => convertNumericFields(row as Record<string, unknown>))
}

// ─── Deep-dive runs ────────────────────────────────────────────────────────

export type AnalysisRun = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  kind: 'manual' | 'scheduled'
  triggered_by: string | null
  total_stocks: number
  current_index: number
  current_ticker: string | null
  stocks_analyzed: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

/**
 * Idempotent migration for the deep-dive run schema. Mirrors the additive DDL
 * in MOSEE/db_client.py:init_database so the API can insert 'pending' rows
 * before the Python script has ever booted in this environment.
 */
export async function ensureDeepDiveSchema(): Promise<void> {
  await sql`
    ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'scheduled'
  `
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS triggered_by TEXT`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS total_stocks INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS current_index INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS current_ticker TEXT`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ`
  await sql`ALTER TABLE mosee_analysis_runs ADD COLUMN IF NOT EXISTS scope JSONB DEFAULT '{}'::jsonb`

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'mosee_analysis_runs'::regclass
          AND conname = 'mosee_analysis_runs_status_check'
      ) THEN
        ALTER TABLE mosee_analysis_runs DROP CONSTRAINT mosee_analysis_runs_status_check;
      END IF;
      ALTER TABLE mosee_analysis_runs
        ADD CONSTRAINT mosee_analysis_runs_status_check
        CHECK (status IN ('pending', 'running', 'completed', 'failed'));
    END $$;
  `
}

/**
 * Mark abandoned runs as failed so the UI doesn't show ghosts forever.
 *  - 'running' for >20h is past our 18h workflow timeout — definitely dead.
 *  - 'pending' for >1h means dispatch silently failed or the runner never picked up.
 */
export async function sweepStaleRuns(): Promise<number> {
  const { rowCount } = await sql`
    UPDATE mosee_analysis_runs
    SET status = 'failed',
        error_message = COALESCE(error_message, 'Marked failed by stale-run sweep'),
        finished_at = COALESCE(finished_at, now())
    WHERE
      (status = 'running' AND COALESCE(started_at, created_at) < now() - interval '20 hours')
      OR
      (status = 'pending' AND created_at < now() - interval '1 hour')
  `
  return rowCount ?? 0
}

export async function getLatestRun(): Promise<AnalysisRun | null> {
  const { rows } = await sql`
    SELECT id, status, kind, triggered_by, total_stocks, current_index, current_ticker,
           stocks_analyzed, error_message, started_at, finished_at, created_at
    FROM mosee_analysis_runs
    ORDER BY created_at DESC
    LIMIT 1
  `
  return (rows[0] as AnalysisRun | undefined) ?? null
}

export async function getActiveRun(): Promise<AnalysisRun | null> {
  const { rows } = await sql`
    SELECT id, status, kind, triggered_by, total_stocks, current_index, current_ticker,
           stocks_analyzed, error_message, started_at, finished_at, created_at
    FROM mosee_analysis_runs
    WHERE status IN ('pending', 'running')
    ORDER BY created_at DESC
    LIMIT 1
  `
  return (rows[0] as AnalysisRun | undefined) ?? null
}

export async function createPendingRun(args: {
  kind: 'manual' | 'scheduled'
  triggeredBy: string | null
}): Promise<AnalysisRun> {
  const { rows } = await sql`
    INSERT INTO mosee_analysis_runs (status, kind, triggered_by)
    VALUES ('pending', ${args.kind}, ${args.triggeredBy})
    RETURNING id, status, kind, triggered_by, total_stocks, current_index, current_ticker,
              stocks_analyzed, error_message, started_at, finished_at, created_at
  `
  return rows[0] as AnalysisRun
}

export async function markRunFailed(runId: string, message: string): Promise<void> {
  await sql`
    UPDATE mosee_analysis_runs
    SET status = 'failed', error_message = ${message}, finished_at = now()
    WHERE id = ${runId}::uuid AND status IN ('pending', 'running')
  `
}

/**
 * Get lightweight stock summaries for search and dashboard.
 * Excludes heavy JSON fields (all_metrics, perspectives, concerns, action_items).
 */
export async function getStockSummaries(): Promise<StockSummary[]> {
  // implied_annual_return is added by a Python migration that runs on the next
  // analysis. In a DB that hasn't migrated yet the column is missing, so we try
  // the full SELECT first and fall back to the legacy column list on error.
  let rows: Record<string, unknown>[]
  try {
    const res = await sql`
      SELECT * FROM (
        SELECT DISTINCT ON (ticker)
          id, ticker, company_name, industry, country, cap_size,
          current_price, market_cap, verdict, quality_grade, quality_score,
          margin_of_safety, has_margin_of_safety, buy_below_price,
          valuation_conservative, valuation_base, valuation_optimistic,
          pad_mosee, dcf_mosee, book_mosee,
          confidence_level, confidence_score, implied_annual_return, strengths
        FROM mosee_stock_analyses
        ORDER BY ticker, analysis_date DESC
      ) latest
      ORDER BY
        CASE verdict
          WHEN 'STRONG BUY' THEN 1
          WHEN 'BUY' THEN 2
          WHEN 'ACCUMULATE' THEN 3
          WHEN 'WATCHLIST' THEN 4
          WHEN 'HOLD' THEN 5
          WHEN 'REDUCE' THEN 6
          WHEN 'SELL' THEN 7
          WHEN 'AVOID' THEN 8
          ELSE 9
        END,
        quality_score DESC NULLS LAST
    `
    rows = res.rows as Record<string, unknown>[]
  } catch {
    const res = await sql`
      SELECT * FROM (
        SELECT DISTINCT ON (ticker)
          id, ticker, company_name, industry, country, cap_size,
          current_price, market_cap, verdict, quality_grade, quality_score,
          margin_of_safety, has_margin_of_safety, buy_below_price,
          valuation_conservative, valuation_base, valuation_optimistic,
          pad_mosee, dcf_mosee, book_mosee,
          confidence_level, confidence_score, strengths
        FROM mosee_stock_analyses
        ORDER BY ticker, analysis_date DESC
      ) latest
      ORDER BY
        CASE verdict
          WHEN 'STRONG BUY' THEN 1
          WHEN 'BUY' THEN 2
          WHEN 'ACCUMULATE' THEN 3
          WHEN 'WATCHLIST' THEN 4
          WHEN 'HOLD' THEN 5
          WHEN 'REDUCE' THEN 6
          WHEN 'SELL' THEN 7
          WHEN 'AVOID' THEN 8
          ELSE 9
        END,
        quality_score DESC NULLS LAST
    `
    rows = res.rows as Record<string, unknown>[]
  }

  const summaryNumericFields = [
    'current_price', 'market_cap', 'quality_score', 'margin_of_safety',
    'buy_below_price', 'valuation_conservative', 'valuation_base', 'valuation_optimistic',
    'pad_mosee', 'dcf_mosee', 'book_mosee', 'confidence_score', 'implied_annual_return'
  ]

  return rows.map(row => {
    const result = { ...row } as Record<string, unknown>
    if (!('implied_annual_return' in result)) result.implied_annual_return = null
    for (const field of summaryNumericFields) {
      if (result[field] !== null && result[field] !== undefined) {
        const converted = Number(result[field])
        result[field] = isNaN(converted) ? null : converted
      }
    }
    return result as unknown as StockSummary
  })
}

/**
 * Get latest-per-ticker rows for the Screener page.
 *
 * implied_annual_return is added by a Python migration that runs on the next
 * analysis. In a DB that hasn't migrated yet the column is missing, so we try
 * the SELECT that includes it first and fall back to the same SELECT without
 * it on error — those rows then carry implied_annual_return: null.
 */
export async function getScreenerRows(): Promise<ScreenerRow[]> {
  let rows: Record<string, unknown>[]
  try {
    const res = await sql`
      SELECT DISTINCT ON (ticker)
        ticker, company_name, industry, country, cap_size, analysis_date,
        current_price, market_cap, verdict, quality_grade, quality_score,
        margin_of_safety, valuation_conservative, valuation_base, valuation_optimistic,
        valuation_confidence, confidence_score, confidence_level, implied_annual_return
      FROM mosee_stock_analyses
      ORDER BY ticker, analysis_date DESC
    `
    rows = res.rows as Record<string, unknown>[]
  } catch {
    const res = await sql`
      SELECT DISTINCT ON (ticker)
        ticker, company_name, industry, country, cap_size, analysis_date,
        current_price, market_cap, verdict, quality_grade, quality_score,
        margin_of_safety, valuation_conservative, valuation_base, valuation_optimistic,
        valuation_confidence, confidence_score, confidence_level
      FROM mosee_stock_analyses
      ORDER BY ticker, analysis_date DESC
    `
    rows = res.rows as Record<string, unknown>[]
  }

  const screenerNumericFields = [
    'current_price', 'market_cap', 'quality_score', 'margin_of_safety',
    'valuation_conservative', 'valuation_base', 'valuation_optimistic',
    'confidence_score', 'implied_annual_return'
  ]

  return rows.map(row => {
    const result = { ...row } as Record<string, unknown>
    if (!('implied_annual_return' in result)) result.implied_annual_return = null
    for (const field of screenerNumericFields) {
      if (result[field] !== null && result[field] !== undefined) {
        const converted = Number(result[field])
        result[field] = isNaN(converted) ? null : converted
      }
    }
    return result as unknown as ScreenerRow
  })
}
