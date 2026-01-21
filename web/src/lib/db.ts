import { sql } from '@vercel/postgres'
import { StockAnalysis, AnalysisRun } from '@/types/mosee'

// Get the latest analysis date
export async function getLatestAnalysisDate(): Promise<string | null> {
  const { rows } = await sql`
    SELECT analysis_date FROM mosee_stock_analyses 
    ORDER BY analysis_date DESC 
    LIMIT 1
  `
  return rows[0]?.analysis_date || null
}

// Get top picks from latest analysis
export async function getTopPicks(limit: number = 10): Promise<StockAnalysis[]> {
  const { rows } = await sql`
    SELECT * FROM mosee_stock_analyses
    WHERE analysis_date = (SELECT MAX(analysis_date) FROM mosee_stock_analyses)
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
      quality_score DESC NULLS LAST,
      pad_mosee DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows as StockAnalysis[]
}

// Get all analyses from latest date
export async function getAllAnalyses(): Promise<StockAnalysis[]> {
  const { rows } = await sql`
    SELECT * FROM mosee_stock_analyses
    WHERE analysis_date = (SELECT MAX(analysis_date) FROM mosee_stock_analyses)
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
      pad_mosee DESC NULLS LAST
  `
  return rows as StockAnalysis[]
}

// Get single stock analysis
export async function getStockAnalysis(ticker: string): Promise<StockAnalysis | null> {
  const { rows } = await sql`
    SELECT * FROM mosee_stock_analyses
    WHERE ticker = ${ticker.toUpperCase()}
    ORDER BY analysis_date DESC
    LIMIT 1
  `
  return (rows[0] as StockAnalysis) || null
}

// Get analysis stats
export async function getAnalysisStats() {
  const { rows } = await sql`
    SELECT 
      COUNT(*) as total_analyzed,
      MAX(analysis_date) as latest_date,
      COUNT(*) FILTER (WHERE verdict IN ('STRONG BUY', 'BUY')) as buy_count
    FROM mosee_stock_analyses
    WHERE analysis_date = (SELECT MAX(analysis_date) FROM mosee_stock_analyses)
  `
  
  if (!rows[0] || !rows[0].latest_date) {
    return null
  }
  
  return {
    totalAnalyzed: parseInt(rows[0].total_analyzed),
    analysisDate: rows[0].latest_date,
    buyCount: parseInt(rows[0].buy_count),
  }
}

// Get recent analysis runs
export async function getRecentRuns(limit: number = 5): Promise<AnalysisRun[]> {
  const { rows } = await sql`
    SELECT * FROM mosee_analysis_runs
    ORDER BY run_date DESC
    LIMIT ${limit}
  `
  return rows as AnalysisRun[]
}
