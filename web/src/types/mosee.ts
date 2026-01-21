// MOSEE Stock Analysis Types

export type Verdict = 
  | 'STRONG BUY' 
  | 'BUY' 
  | 'ACCUMULATE' 
  | 'HOLD' 
  | 'WATCHLIST' 
  | 'REDUCE' 
  | 'SELL' 
  | 'AVOID' 
  | 'INSUFFICIENT DATA'

export type QualityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export interface Perspective {
  philosopher: string
  score: number
  grade: string
  key_metric: string
  verdict: string
  insight: string
}

export interface StockAnalysis {
  id: string
  run_id: string
  ticker: string
  company_name: string | null
  industry: string | null
  country: string | null
  cap_size: string | null
  analysis_date: string
  current_price: number | null
  market_cap: number | null
  verdict: Verdict
  quality_grade: QualityGrade | null
  quality_score: number | null
  margin_of_safety: number | null
  has_margin_of_safety: boolean
  buy_below_price: number | null
  valuation_conservative: number | null
  valuation_base: number | null
  valuation_optimistic: number | null
  valuation_confidence: string | null
  perspectives: Perspective[]
  strengths: string[]
  concerns: string[]
  action_items: string[]
  all_metrics: Record<string, unknown>
  pad_mos: number | null
  dcf_mos: number | null
  book_mos: number | null
  pad_mosee: number | null
  dcf_mosee: number | null
  book_mosee: number | null
  confidence_level: string | null
  confidence_score: number | null
  created_at: string
  updated_at: string
}

export interface AnalysisRun {
  id: string
  run_date: string
  stocks_analyzed: number
  status: 'running' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

// Verdict colors for UI
export const VERDICT_COLORS: Record<Verdict, string> = {
  'STRONG BUY': '#16a34a',
  'BUY': '#22c55e',
  'ACCUMULATE': '#0ea5e9',
  'HOLD': '#eab308',
  'WATCHLIST': '#3b82f6',
  'REDUCE': '#f97316',
  'SELL': '#ef4444',
  'AVOID': '#dc2626',
  'INSUFFICIENT DATA': '#6b7280',
}

// Quality grade colors
export const GRADE_COLORS: Record<QualityGrade, string> = {
  'A+': '#16a34a',
  'A': '#22c55e',
  'B': '#84cc16',
  'C': '#eab308',
  'D': '#f97316',
  'F': '#ef4444',
}

// Verdict priority for sorting
export const VERDICT_PRIORITY: Record<Verdict, number> = {
  'STRONG BUY': 1,
  'BUY': 2,
  'ACCUMULATE': 3,
  'WATCHLIST': 4,
  'HOLD': 5,
  'REDUCE': 6,
  'SELL': 7,
  'AVOID': 8,
  'INSUFFICIENT DATA': 9,
}

// Helper to format currency
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  
  if (Math.abs(value) >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else {
    return `$${value.toFixed(2)}`
  }
}

// Helper to format percentage
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

// Helper to format MoS ratio
export function formatMoS(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return 'N/A'
  if (value > 10) return '>10x'
  return `${(value * 100).toFixed(0)}%`
}
