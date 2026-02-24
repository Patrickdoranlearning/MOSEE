/**
 * MOSEE Database Client for Next.js
 *
 * Connects to PostgreSQL (Vercel Postgres) to retrieve stock analysis data
 * written by the Python weekly analysis scripts.
 */

import { sql } from '@vercel/postgres'
import type { StockAnalysis, StockSummary, StockRawData } from '@/types/mosee'

/**
 * Convert PostgreSQL NUMERIC fields (returned as strings) to JavaScript numbers.
 * This is needed because @vercel/postgres returns NUMERIC as strings to preserve precision.
 */
function convertNumericFields(row: Record<string, unknown>): StockAnalysis {
  const numericFields = [
    'current_price', 'market_cap', 'quality_score', 'margin_of_safety',
    'buy_below_price', 'valuation_conservative', 'valuation_base', 'valuation_optimistic',
    'pad_mos', 'dcf_mos', 'book_mos', 'pad_mosee', 'dcf_mosee', 'book_mosee',
    'confidence_score'
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
 * Get lightweight stock summaries for search and dashboard.
 * Excludes heavy JSON fields (all_metrics, perspectives, concerns, action_items).
 */
export async function getStockSummaries(): Promise<StockSummary[]> {
  const { rows } = await sql`
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

  const summaryNumericFields = [
    'current_price', 'market_cap', 'quality_score', 'margin_of_safety',
    'buy_below_price', 'valuation_conservative', 'valuation_base', 'valuation_optimistic',
    'pad_mosee', 'dcf_mosee', 'book_mosee', 'confidence_score'
  ]

  return rows.map(row => {
    const result = { ...row } as Record<string, unknown>
    for (const field of summaryNumericFields) {
      if (result[field] !== null && result[field] !== undefined) {
        const converted = Number(result[field])
        result[field] = isNaN(converted) ? null : converted
      }
    }
    return result as unknown as StockSummary
  })
}
