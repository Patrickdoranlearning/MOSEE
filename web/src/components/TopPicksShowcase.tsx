'use client'

import { StockSummary } from '@/types/mosee'
import { FeaturedStockCard } from './FeaturedStockCard'
import { StockCard } from './StockCard'
import type { StockAnalysis } from '@/types/mosee'

interface TopPicksShowcaseProps {
  topPicks: StockSummary[]
}

export function TopPicksShowcase({ topPicks }: TopPicksShowcaseProps) {
  if (topPicks.length === 0) return null

  const featured = topPicks.slice(0, 3)
  const remaining = topPicks.slice(3)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        This Week&apos;s Top Picks
      </h2>

      {/* Featured Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {featured.map((stock, i) => (
          <FeaturedStockCard key={stock.id} stock={stock} rank={i + 1} />
        ))}
      </div>

      {/* Remaining picks in horizontal scroll */}
      {remaining.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
          {remaining.map((stock) => (
            <div key={stock.id} className="min-w-[220px] max-w-[250px] shrink-0">
              <StockCard stock={stock as unknown as StockAnalysis} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
