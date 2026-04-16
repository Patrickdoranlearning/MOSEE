import { promises as fs } from 'fs'
import path from 'path'
import { getStockSummaries, getAnalysisStats } from '@/lib/db'
import { StockLookup } from './StockLookup'
import type { TickerEntry } from '@/types/mosee'

export const revalidate = 3600

export const metadata = {
  title: 'Stock Lookup - MOSEE',
  description: 'Browse and filter all 7,000+ stocks by verdict, industry, quality grade, and more.',
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') { inQuotes = false } else { current += ch }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

async function loadTickerUniverse(): Promise<TickerEntry[]> {
  const csvPath = path.join(process.cwd(), '..', 'data', 'ticker_data_enhanced.csv')
  const csv = await fs.readFile(csvPath, 'utf-8')
  const lines = csv.trim().split('\n')
  // Skip header: ticker,cap,country,industry,financial_currency,currency
  const tickers: TickerEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 6) continue
    tickers.push({
      ticker: cols[0],
      company_name: null,
      industry: cols[3] || null,
      country: cols[2] || null,
      cap_size: cols[1] || null,
      currency: cols[5] || null,
      analyzed: false,
      current_price: null,
      market_cap: null,
      verdict: null,
      quality_grade: null,
      quality_score: null,
      margin_of_safety: null,
      has_margin_of_safety: false,
      buy_below_price: null,
      pad_mosee: null,
      dcf_mosee: null,
      book_mosee: null,
      confidence_level: null,
      confidence_score: null,
    })
  }

  return tickers
}

export default async function StocksPage() {
  let universe: TickerEntry[] = []
  let stats: Awaited<ReturnType<typeof getAnalysisStats>> = null
  let error: string | null = null

  try {
    const [tickers, summaries, analysisStats] = await Promise.all([
      loadTickerUniverse(),
      getStockSummaries(),
      getAnalysisStats(),
    ])
    stats = analysisStats

    // Build lookup of analyzed tickers
    const analyzedMap = new Map(summaries.map(s => [s.ticker.toUpperCase(), s]))

    // Merge: overlay analysis data onto universe entries
    universe = tickers.map(entry => {
      const analysis = analyzedMap.get(entry.ticker.toUpperCase())
      if (analysis) {
        return {
          ...entry,
          analyzed: true,
          company_name: analysis.company_name,
          industry: analysis.industry || entry.industry,
          country: analysis.country || entry.country,
          cap_size: analysis.cap_size || entry.cap_size,
          current_price: analysis.current_price,
          market_cap: analysis.market_cap,
          verdict: analysis.verdict,
          quality_grade: analysis.quality_grade,
          quality_score: analysis.quality_score,
          margin_of_safety: analysis.margin_of_safety,
          has_margin_of_safety: analysis.has_margin_of_safety,
          buy_below_price: analysis.buy_below_price,
          pad_mosee: analysis.pad_mosee,
          dcf_mosee: analysis.dcf_mosee,
          book_mosee: analysis.book_mosee,
          confidence_level: analysis.confidence_level,
          confidence_score: analysis.confidence_score,
        }
      }
      return entry
    })

    // Add any analyzed tickers not in the CSV (edge case)
    const universeSet = new Set(universe.map(t => t.ticker.toUpperCase()))
    for (const s of summaries) {
      if (!universeSet.has(s.ticker.toUpperCase())) {
        universe.push({
          ticker: s.ticker,
          company_name: s.company_name,
          industry: s.industry,
          country: s.country,
          cap_size: s.cap_size,
          currency: null,
          analyzed: true,
          current_price: s.current_price,
          market_cap: s.market_cap,
          verdict: s.verdict,
          quality_grade: s.quality_grade,
          quality_score: s.quality_score,
          margin_of_safety: s.margin_of_safety,
          has_margin_of_safety: s.has_margin_of_safety,
          buy_below_price: s.buy_below_price,
          pad_mosee: s.pad_mosee,
          dcf_mosee: s.dcf_mosee,
          book_mosee: s.book_mosee,
          confidence_level: s.confidence_level,
          confidence_score: s.confidence_score,
        })
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load stock data'
  }

  const analyzedCount = universe.filter(t => t.analyzed).length

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Stock Lookup</h1>
          <p className="text-gray-500 mt-1">
            Browse all {universe.length.toLocaleString()} stocks
            {stats?.analysisDate && (
              <span>
                {' '}&middot; Last analyzed{' '}
                {new Date(stats.analysisDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
          </p>
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{universe.length.toLocaleString()}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Tickers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{analyzedCount}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Analyzed</p>
            </div>
            {stats && (
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.buyCount}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Buy Signals</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Unable to load stock data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Stock Lookup with filters and pagination */}
      <StockLookup stocks={universe} />
    </div>
  )
}
