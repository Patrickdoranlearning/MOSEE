'use client'

import Link from 'next/link'
import { StockAnalysis, formatCurrency, formatMoS } from '@/types/mosee'
import { VerdictBadge } from './VerdictBadge'
import { QualityBadge } from './QualityBadge'

interface StockTableProps {
  stocks: StockAnalysis[]
}

export function StockTable({ stocks }: StockTableProps) {
  if (stocks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No stock analyses found. Run the analysis script to populate data.
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ticker
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Verdict
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quality
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Buy Below
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              MoS
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Industry
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Country
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {stocks.map((stock) => (
            <tr key={stock.id} className="hover:bg-gray-50 cursor-pointer">
              <td className="px-4 py-4 whitespace-nowrap">
                <Link href={`/stock/${stock.ticker}`} className="block">
                  <div className="font-medium text-gray-900">{stock.ticker}</div>
                  <div className="text-sm text-gray-500 max-w-[150px] truncate">
                    {stock.company_name}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <Link href={`/stock/${stock.ticker}`}>
                  <VerdictBadge verdict={stock.verdict} size="sm" />
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <Link href={`/stock/${stock.ticker}`}>
                  <QualityBadge grade={stock.quality_grade} />
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm">
                <Link href={`/stock/${stock.ticker}`} className="block">
                  {formatCurrency(stock.current_price)}
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                <Link href={`/stock/${stock.ticker}`} className="block">
                  {stock.buy_below_price ? formatCurrency(stock.buy_below_price) : 'N/A'}
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm">
                <Link href={`/stock/${stock.ticker}`} className="block">
                  <span className={stock.has_margin_of_safety ? 'text-green-600 font-medium' : 'text-orange-500'}>
                    {formatMoS(stock.margin_of_safety)}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                <Link href={`/stock/${stock.ticker}`} className="block max-w-[120px] truncate">
                  {stock.industry || 'N/A'}
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                <Link href={`/stock/${stock.ticker}`} className="block">
                  {stock.country || 'N/A'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
