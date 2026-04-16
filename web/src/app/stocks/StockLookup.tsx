'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { TickerEntry, Verdict, QualityGrade } from '@/types/mosee'
import { VerdictBadge } from '@/components/VerdictBadge'
import { QualityBadge } from '@/components/QualityBadge'
import { formatCurrency, formatMoS, VERDICT_PRIORITY } from '@/types/mosee'

const PAGE_SIZE_OPTIONS = [50, 100, 200]

type SortField = 'ticker' | 'verdict' | 'quality' | 'price' | 'mosee' | 'mos' | 'industry' | 'country' | 'cap_size' | 'analyzed'
type SortDirection = 'asc' | 'desc'

const GRADE_ORDER: Record<string, number> = { 'A+': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'F': 6 }
const CAP_ORDER: Record<string, number> = { 'mega': 1, 'Mega': 1, 'extra_large': 2, 'large': 3, 'Large': 3, 'medium': 4, 'Mid': 4, 'small': 5, 'Small': 5, 'extra_small': 6, 'Micro': 6, 'Nano': 7 }

function formatCapSize(cap: string | null): string {
  if (!cap) return 'N/A'
  const map: Record<string, string> = { mega: 'Mega', extra_large: 'XL', large: 'Large', medium: 'Mid', small: 'Small', extra_small: 'Micro' }
  return map[cap] || cap
}

function formatMOSEE(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '-'
  return value.toFixed(3)
}

function getMOSEEColor(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return 'text-gray-300'
  if (value >= 0.15) return 'text-green-600 font-medium'
  if (value >= 0.10) return 'text-emerald-600'
  if (value >= 0.05) return 'text-yellow-600'
  return 'text-orange-500'
}

interface StockLookupProps {
  stocks: TickerEntry[]
}

export function StockLookup({ stocks }: StockLookupProps) {
  const [textSearch, setTextSearch] = useState('')
  const [selectedCapSize, setSelectedCapSize] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedVerdict, setSelectedVerdict] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'analyzed' | 'unanalyzed'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<SortField>('analyzed')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Extract unique filter values
  const capSizes = useMemo(() => [...new Set(stocks.map(s => s.cap_size).filter(Boolean))] as string[], [stocks])
  const industries = useMemo(() => [...new Set(stocks.map(s => s.industry).filter(Boolean))].sort() as string[], [stocks])
  const countries = useMemo(() => [...new Set(stocks.map(s => s.country).filter(Boolean))].sort() as string[], [stocks])
  const verdicts = useMemo(() => [...new Set(stocks.filter(s => s.verdict).map(s => s.verdict!))] as Verdict[], [stocks])
  const grades = useMemo(() => [...new Set(stocks.filter(s => s.quality_grade).map(s => s.quality_grade!))] as QualityGrade[], [stocks])

  const resetFilters = () => {
    setTextSearch('')
    setSelectedCapSize('')
    setSelectedIndustry('')
    setSelectedCountry('')
    setSelectedVerdict('')
    setSelectedGrade('')
    setAnalysisFilter('all')
    setCurrentPage(1)
  }

  const setFilterAndReset = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setCurrentPage(1)
  }

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (analysisFilter === 'analyzed' && !stock.analyzed) return false
      if (analysisFilter === 'unanalyzed' && stock.analyzed) return false

      if (selectedCapSize && stock.cap_size !== selectedCapSize) return false
      if (selectedIndustry && stock.industry !== selectedIndustry) return false
      if (selectedCountry && stock.country !== selectedCountry) return false
      if (selectedVerdict && stock.verdict !== selectedVerdict) return false
      if (selectedGrade && stock.quality_grade !== selectedGrade) return false

      if (textSearch) {
        const q = textSearch.toLowerCase()
        if (
          !stock.ticker.toLowerCase().includes(q) &&
          !(stock.company_name?.toLowerCase().includes(q) ?? false) &&
          !(stock.industry?.toLowerCase().includes(q) ?? false)
        ) {
          return false
        }
      }

      return true
    })
  }, [stocks, analysisFilter, selectedCapSize, selectedIndustry, selectedCountry, selectedVerdict, selectedGrade, textSearch])

  // Sorting
  const sortedStocks = useMemo(() => {
    return [...filteredStocks].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'analyzed':
          comparison = (a.analyzed ? 1 : 0) - (b.analyzed ? 1 : 0)
          break
        case 'verdict':
          comparison = (VERDICT_PRIORITY[a.verdict as Verdict] ?? 99) - (VERDICT_PRIORITY[b.verdict as Verdict] ?? 99)
          break
        case 'quality':
          comparison = (GRADE_ORDER[a.quality_grade || ''] || 99) - (GRADE_ORDER[b.quality_grade || ''] || 99)
          break
        case 'price':
          comparison = (a.current_price || 0) - (b.current_price || 0)
          break
        case 'mosee': {
          const ma = a.pad_mosee ?? a.dcf_mosee ?? a.book_mosee ?? -1
          const mb = b.pad_mosee ?? b.dcf_mosee ?? b.book_mosee ?? -1
          comparison = ma - mb
          break
        }
        case 'mos':
          comparison = (a.margin_of_safety ?? 999) - (b.margin_of_safety ?? 999)
          break
        case 'industry':
          comparison = (a.industry || '').localeCompare(b.industry || '')
          break
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '')
          break
        case 'cap_size':
          comparison = (CAP_ORDER[a.cap_size || ''] || 99) - (CAP_ORDER[b.cap_size || ''] || 99)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredStocks, sortField, sortDirection])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedStocks.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedStocks = sortedStocks.slice(startIndex, startIndex + pageSize)

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'analyzed' ? 'desc' : 'asc')
    }
  }

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('ellipsis')
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
        pages.push(i)
      }
      if (safePage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  const hasActiveFilters = analysisFilter !== 'all' || selectedCapSize || selectedIndustry || selectedCountry || selectedVerdict || selectedGrade || textSearch

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-gray-400">
          {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Analysis status tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'analyzed', 'unanalyzed'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => { setAnalysisFilter(filter); setCurrentPage(1) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                analysisFilter === filter
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter === 'all' ? `All (${stocks.length.toLocaleString()})` :
               filter === 'analyzed' ? `Analyzed (${stocks.filter(s => s.analyzed).length})` :
               `Not Analyzed (${stocks.filter(s => !s.analyzed).length.toLocaleString()})`}
            </button>
          ))}
        </div>

        {/* Dropdown filters + search */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedCapSize} onChange={e => { setSelectedCapSize(e.target.value); setCurrentPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Cap Sizes</option>
            {capSizes.map(v => <option key={v} value={v}>{formatCapSize(v)}</option>)}
          </select>

          <select value={selectedIndustry} onChange={e => { setSelectedIndustry(e.target.value); setCurrentPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Industries</option>
            {industries.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setCurrentPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Countries</option>
            {countries.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          {analysisFilter !== 'unanalyzed' && (
            <>
              <select value={selectedVerdict} onChange={e => { setSelectedVerdict(e.target.value); setCurrentPage(1) }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Verdicts</option>
                {verdicts.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setCurrentPage(1) }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Grades</option>
                {grades.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}

          <div className="flex-1" />

          {/* Text search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={textSearch}
              onChange={e => { setTextSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Search ticker, name, industry..."
              className="pl-8 pr-3 py-1.5 w-56 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Result count */}
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium text-gray-700">{filteredStocks.length.toLocaleString()}</span> of {stocks.length.toLocaleString()} tickers
          {hasActiveFilters && (
            <button onClick={resetFilters} className="ml-2 text-blue-600 hover:text-blue-700 text-sm">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortHeader field="ticker">Ticker</SortHeader>
                <SortHeader field="analyzed">Status</SortHeader>
                <SortHeader field="verdict">Verdict</SortHeader>
                <SortHeader field="quality">Quality</SortHeader>
                <SortHeader field="price">Price</SortHeader>
                <SortHeader field="mosee">MOSEE</SortHeader>
                <SortHeader field="mos">MoS</SortHeader>
                <SortHeader field="industry">Industry</SortHeader>
                <SortHeader field="country">Country</SortHeader>
                <SortHeader field="cap_size">Cap Size</SortHeader>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStocks.map((stock) => {
                const moseeScore = stock.pad_mosee ?? stock.dcf_mosee ?? stock.book_mosee
                const href = stock.analyzed
                  ? `/stock/${encodeURIComponent(stock.ticker)}`
                  : `/api/preview/${encodeURIComponent(stock.ticker)}`

                return (
                  <tr key={stock.ticker} className={`hover:bg-gray-50 ${stock.analyzed ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{stock.ticker}</div>
                      {stock.company_name && (
                        <div className="text-sm text-gray-500 max-w-[150px] truncate">{stock.company_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stock.analyzed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Analyzed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stock.verdict ? <VerdictBadge verdict={stock.verdict} size="sm" /> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stock.quality_grade ? <QualityBadge grade={stock.quality_grade} /> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      {stock.current_price ? formatCurrency(stock.current_price) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      <span className={getMOSEEColor(moseeScore)}>{formatMOSEE(moseeScore)}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      {stock.analyzed ? (
                        <span className={stock.has_margin_of_safety ? 'text-green-600 font-medium' : 'text-orange-500'}>
                          {formatMoS(stock.margin_of_safety)}
                        </span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-500 max-w-[140px] truncate">
                      {stock.industry || 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-500">
                      {stock.country || 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-500">
                      {formatCapSize(stock.cap_size)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      {stock.analyzed ? (
                        <Link
                          href={`/stock/${encodeURIComponent(stock.ticker)}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          View
                        </Link>
                      ) : (
                        <Link
                          href={`/stock/${encodeURIComponent(stock.ticker)}`}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-md transition-colors"
                        >
                          Preview
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredStocks.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>per page</span>
            <span className="text-gray-400 ml-2">
              {startIndex + 1}&ndash;{Math.min(startIndex + pageSize, filteredStocks.length)} of {filteredStocks.length.toLocaleString()}
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              {getPageNumbers().map((page, i) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      page === safePage
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
