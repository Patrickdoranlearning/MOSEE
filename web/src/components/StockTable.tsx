'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { StockAnalysis, formatCurrency, formatMoS, VERDICT_PRIORITY } from '@/types/mosee'
import { VerdictBadge } from './VerdictBadge'
import { QualityBadge } from './QualityBadge'

interface StockTableProps {
  stocks: StockAnalysis[]
  compact?: boolean
}

type SortField = 'ticker' | 'verdict' | 'quality' | 'price' | 'mosee' | 'mos' | 'industry' | 'country' | 'cap_size'
type SortDirection = 'asc' | 'desc'

// Grade to numeric value for sorting
const GRADE_ORDER: Record<string, number> = {
  'A+': 1,
  'A': 2,
  'B': 3,
  'C': 4,
  'D': 5,
  'F': 6,
}

const CAP_ORDER: Record<string, number> = {
  'Mega': 1,
  'Large': 2,
  'Mid': 3,
  'Small': 4,
  'Micro': 5,
  'Nano': 6,
}

function formatMOSEE(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return 'N/A'
  return value.toFixed(3)
}

function getMOSEEColor(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return 'text-gray-400'
  if (value >= 0.15) return 'text-green-600 font-medium'
  if (value >= 0.10) return 'text-emerald-600'
  if (value >= 0.05) return 'text-yellow-600'
  return 'text-orange-500'
}

export function StockTable({ stocks, compact = false }: StockTableProps) {
  const [sortField, setSortField] = useState<SortField>('verdict')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'verdict':
          comparison = (VERDICT_PRIORITY[a.verdict] || 99) - (VERDICT_PRIORITY[b.verdict] || 99)
          break
        case 'quality': {
          const gradeA = GRADE_ORDER[a.quality_grade || 'F'] || 99
          const gradeB = GRADE_ORDER[b.quality_grade || 'F'] || 99
          comparison = gradeA - gradeB
          break
        }
        case 'price':
          comparison = (a.current_price || 0) - (b.current_price || 0)
          break
        case 'mosee': {
          const moseeA = a.pad_mosee ?? a.dcf_mosee ?? a.book_mosee ?? 0
          const moseeB = b.pad_mosee ?? b.dcf_mosee ?? b.book_mosee ?? 0
          comparison = moseeA - moseeB
          break
        }
        case 'mos': {
          const mosA = a.margin_of_safety ?? 999
          const mosB = b.margin_of_safety ?? 999
          comparison = mosA - mosB
          break
        }
        case 'industry':
          comparison = (a.industry || '').localeCompare(b.industry || '')
          break
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '')
          break
        case 'cap_size': {
          const capA = CAP_ORDER[a.cap_size || ''] || 99
          const capB = CAP_ORDER[b.cap_size || ''] || 99
          comparison = capA - capB
          break
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [stocks, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      const descByDefault = ['mosee', 'quality', 'price']
      setSortDirection(descByDefault.includes(field) ? 'desc' : 'asc')
    }
  }

  const cellPad = compact ? 'px-3 py-2.5' : 'px-4 py-4'
  const headerPad = compact ? 'px-3 py-2' : 'px-4 py-3'

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className={`${headerPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-gray-400">
          {sortField === field ? (
            sortDirection === 'asc' ? '↑' : '↓'
          ) : (
            '↕'
          )}
        </span>
      </div>
    </th>
  )

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
            <SortableHeader field="ticker">Ticker</SortableHeader>
            <SortableHeader field="verdict">Verdict</SortableHeader>
            <SortableHeader field="quality">Quality</SortableHeader>
            <SortableHeader field="price">Price</SortableHeader>
            <th className={`${headerPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
              Buy Below
            </th>
            <SortableHeader field="mosee">MOSEE</SortableHeader>
            <SortableHeader field="mos">MoS</SortableHeader>
            <SortableHeader field="industry">Industry</SortableHeader>
            <SortableHeader field="cap_size">Cap Size</SortableHeader>
            <th className={`${headerPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
              Report
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStocks.map((stock) => {
            const moseeScore = stock.pad_mosee ?? stock.dcf_mosee ?? stock.book_mosee
            return (
              <tr key={stock.id} className="hover:bg-gray-50 cursor-pointer">
                <td className={`${cellPad} whitespace-nowrap`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    <div className="font-medium text-gray-900">{stock.ticker}</div>
                    <div className="text-sm text-gray-500 max-w-[150px] truncate">
                      {stock.company_name}
                    </div>
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap`}>
                  <Link href={`/stock/${stock.ticker}`}>
                    <VerdictBadge verdict={stock.verdict} size="sm" />
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap`}>
                  <Link href={`/stock/${stock.ticker}`}>
                    <QualityBadge grade={stock.quality_grade} />
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    {formatCurrency(stock.current_price)}
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm text-green-600 font-medium`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    {stock.buy_below_price ? formatCurrency(stock.buy_below_price) : 'N/A'}
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    <span className={getMOSEEColor(moseeScore)}>
                      {formatMOSEE(moseeScore)}
                    </span>
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    <span className={stock.has_margin_of_safety ? 'text-green-600 font-medium' : 'text-orange-500'}>
                      {formatMoS(stock.margin_of_safety)}
                    </span>
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm text-gray-500`}>
                  <Link href={`/stock/${stock.ticker}`} className="block max-w-[120px] truncate">
                    {stock.industry || 'N/A'}
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm text-gray-500`}>
                  <Link href={`/stock/${stock.ticker}`} className="block">
                    {stock.cap_size || 'N/A'}
                  </Link>
                </td>
                <td className={`${cellPad} whitespace-nowrap text-sm`}>
                  <Link
                    href={`/stock/${stock.ticker}`}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
