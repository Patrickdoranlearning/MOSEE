import { getTopPicks, getAnalysisStats, getAllAnalyses } from '@/lib/db'
import { HeroSearch } from '@/components/HeroSearch'
import { TopPicksShowcase } from '@/components/TopPicksShowcase'
import { MarketPulse } from '@/components/MarketPulse'
import { StockDashboard } from '@/components/StockDashboard'
import type { StockSummary } from '@/types/mosee'

export const revalidate = 3600

// Strip heavy fields from StockAnalysis to create lightweight summaries for client components
function toSummary(stock: Awaited<ReturnType<typeof getAllAnalyses>>[number]): StockSummary {
  return {
    id: stock.id,
    ticker: stock.ticker,
    company_name: stock.company_name,
    industry: stock.industry,
    country: stock.country,
    cap_size: stock.cap_size,
    current_price: stock.current_price,
    market_cap: stock.market_cap,
    verdict: stock.verdict,
    quality_grade: stock.quality_grade,
    quality_score: stock.quality_score,
    margin_of_safety: stock.margin_of_safety,
    has_margin_of_safety: stock.has_margin_of_safety,
    buy_below_price: stock.buy_below_price,
    valuation_conservative: stock.valuation_conservative,
    valuation_base: stock.valuation_base,
    valuation_optimistic: stock.valuation_optimistic,
    pad_mosee: stock.pad_mosee,
    dcf_mosee: stock.dcf_mosee,
    book_mosee: stock.book_mosee,
    confidence_level: stock.confidence_level,
    confidence_score: stock.confidence_score,
    strengths: stock.strengths || [],
  }
}

export default async function Home() {
  let allAnalyses: Awaited<ReturnType<typeof getAllAnalyses>> = []
  let topPicks: Awaited<ReturnType<typeof getTopPicks>> = []
  let stats: Awaited<ReturnType<typeof getAnalysisStats>> = null
  let dbError: string | null = null

  try {
    ;[allAnalyses, topPicks, stats] = await Promise.all([
      getAllAnalyses(),
      getTopPicks(10),
      getAnalysisStats(),
    ])
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Failed to connect to database'
  }

  const summaries = allAnalyses.map(toSummary)
  const topPickSummaries = topPicks.map(toSummary)

  return (
    <div className="min-h-screen">
      {/* Error banner */}
      {dbError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-red-800 font-medium text-sm">Unable to load stock data</p>
            <p className="text-red-600 text-xs mt-0.5">{dbError}</p>
          </div>
        </div>
      )}

      {/* 1. Command Center Search */}
      <HeroSearch stocks={summaries} stats={stats} />

      {/* 2. Top Picks Showcase */}
      <TopPicksShowcase topPicks={topPickSummaries} />

      {/* 3. Market Pulse */}
      <MarketPulse analyses={summaries} />

      {/* 4. All Stocks Dashboard */}
      <StockDashboard stocks={summaries} />
    </div>
  )
}
