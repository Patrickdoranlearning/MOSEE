'use client'

import Link from 'next/link'
import { StockSummary, formatCurrency, formatMoS } from '@/types/mosee'
import { VerdictBadge } from './VerdictBadge'
import { QualityBadge } from './QualityBadge'

interface FeaturedStockCardProps {
  stock: StockSummary
  rank: number
}

function getMoseeColor(score: number | null | undefined): string {
  if (score == null || !isFinite(score)) return 'text-gray-400'
  if (score >= 0.15) return 'text-green-600'
  if (score >= 0.10) return 'text-emerald-600'
  if (score >= 0.05) return 'text-yellow-600'
  if (score > 0) return 'text-orange-500'
  return 'text-red-500'
}

export function FeaturedStockCard({ stock, rank }: FeaturedStockCardProps) {
  const moseeScore = stock.pad_mosee ?? stock.dcf_mosee ?? stock.book_mosee

  return (
    <Link href={`/stock/${stock.ticker}`} className="block">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all hover:border-blue-200 relative">
        {/* Rank badge */}
        <div className="absolute -top-2 -left-2 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
          #{rank}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{stock.ticker}</h3>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">
              {stock.company_name || stock.ticker}
            </p>
          </div>
          <QualityBadge grade={stock.quality_grade} score={stock.quality_score} showScore />
        </div>

        {/* Verdict */}
        <div className="mb-4">
          <VerdictBadge verdict={stock.verdict} size="md" />
        </div>

        {/* MOSEE Score */}
        <div className="mb-4 p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">MOSEE Score</span>
            <span className={`text-2xl font-bold ${getMoseeColor(moseeScore)}`}>
              {moseeScore != null ? moseeScore.toFixed(3) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Price and metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p className="text-gray-500 text-xs">Current Price</p>
            <p className="font-semibold text-gray-900">{formatCurrency(stock.current_price)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Buy Below</p>
            <p className="font-semibold text-green-600">
              {stock.buy_below_price ? formatCurrency(stock.buy_below_price) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Margin of Safety</p>
            <p className={`font-semibold ${stock.has_margin_of_safety ? 'text-green-600' : 'text-orange-500'}`}>
              {formatMoS(stock.margin_of_safety)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Industry</p>
            <p className="font-medium text-gray-700 truncate">{stock.industry || 'N/A'}</p>
          </div>
        </div>

        {/* Top strength */}
        {stock.strengths && stock.strengths.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-green-700 bg-green-50 px-2 py-1.5 rounded-md truncate">
              {stock.strengths[0]}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
