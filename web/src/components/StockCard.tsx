'use client'

import Link from 'next/link'
import { StockAnalysis, formatCurrency, formatMoS } from '@/types/mosee'
import { VerdictBadge } from './VerdictBadge'
import { QualityBadge } from './QualityBadge'

interface StockCardProps {
  stock: StockAnalysis
}

export function StockCard({ stock }: StockCardProps) {
  return (
    <Link href={`/stock/${stock.ticker}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{stock.ticker}</h3>
            <p className="text-sm text-gray-500 truncate max-w-[180px]">
              {stock.company_name || stock.ticker}
            </p>
          </div>
          <QualityBadge grade={stock.quality_grade} />
        </div>
        
        <div className="mb-3">
          <VerdictBadge verdict={stock.verdict} size="sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Price</p>
            <p className="font-semibold">{formatCurrency(stock.current_price)}</p>
          </div>
          <div>
            <p className="text-gray-500">Buy Below</p>
            <p className="font-semibold text-green-600">
              {stock.buy_below_price ? formatCurrency(stock.buy_below_price) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">MoS</p>
            <p className={`font-semibold ${stock.has_margin_of_safety ? 'text-green-600' : 'text-orange-500'}`}>
              {formatMoS(stock.margin_of_safety)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Industry</p>
            <p className="font-medium truncate">{stock.industry || 'N/A'}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
