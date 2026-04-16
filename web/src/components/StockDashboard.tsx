'use client'

import { useState, useMemo } from 'react'
import { StockSummary, Verdict, QualityGrade } from '@/types/mosee'
import { StockTable } from './StockTable'
import { StockCard } from './StockCard'
import { DashboardFilters } from './DashboardFilters'
import type { StockAnalysis } from '@/types/mosee'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

interface StockDashboardProps {
  stocks: StockSummary[]
}

export function StockDashboard({ stocks }: StockDashboardProps) {
  const [quickFilter, setQuickFilter] = useState('all')
  const [selectedVerdict, setSelectedVerdict] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [textSearch, setTextSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Extract unique filter values
  const verdicts = useMemo(() => [...new Set(stocks.map(s => s.verdict))], [stocks])
  const industries = useMemo(
    () => [...new Set(stocks.map(s => s.industry).filter(Boolean))] as string[],
    [stocks]
  )
  const countries = useMemo(
    () => [...new Set(stocks.map(s => s.country).filter(Boolean))] as string[],
    [stocks]
  )
  const grades = useMemo(
    () => [...new Set(stocks.map(s => s.quality_grade).filter(Boolean))] as QualityGrade[],
    [stocks]
  )

  const handleQuickFilterChange = (filter: string) => {
    setQuickFilter(filter)
    setSelectedVerdict('')
    setSelectedIndustry('')
    setSelectedCountry('')
    setSelectedGrade('')
    setCurrentPage(1)
  }

  const handleDropdownChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setQuickFilter('all')
    setCurrentPage(1)
  }

  const handleTextSearchChange = (value: string) => {
    setTextSearch(value)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Quick filters
      if (quickFilter === 'strong-buys' && stock.verdict !== 'STRONG BUY') return false
      if (quickFilter === 'buy-signals' && !['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(stock.verdict)) return false
      if (quickFilter === 'high-quality' && !['A+', 'A'].includes(stock.quality_grade || '')) return false
      if (quickFilter === 'undervalued' && !stock.has_margin_of_safety) return false

      // Dropdown filters
      if (selectedVerdict && stock.verdict !== selectedVerdict) return false
      if (selectedIndustry && stock.industry !== selectedIndustry) return false
      if (selectedCountry && stock.country !== selectedCountry) return false
      if (selectedGrade && stock.quality_grade !== selectedGrade) return false

      // Text search
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
  }, [stocks, quickFilter, selectedVerdict, selectedIndustry, selectedCountry, selectedGrade, textSearch])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedStocks = filteredStocks.slice(startIndex, startIndex + pageSize)

  // Generate page numbers to show
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">All Stocks</h2>

      <DashboardFilters
        quickFilter={quickFilter}
        onQuickFilterChange={handleQuickFilterChange}
        selectedVerdict={selectedVerdict}
        selectedIndustry={selectedIndustry}
        selectedCountry={selectedCountry}
        selectedGrade={selectedGrade}
        onVerdictChange={handleDropdownChange(setSelectedVerdict)}
        onIndustryChange={handleDropdownChange(setSelectedIndustry)}
        onCountryChange={handleDropdownChange(setSelectedCountry)}
        onGradeChange={handleDropdownChange(setSelectedGrade)}
        textSearch={textSearch}
        onTextSearchChange={handleTextSearchChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        verdicts={verdicts}
        industries={industries}
        countries={countries}
        grades={grades}
        filteredCount={filteredStocks.length}
        totalCount={stocks.length}
      />

      {/* Content */}
      <div className="mt-4">
        {filteredStocks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-500">No stocks match your filters.</p>
            <button
              onClick={() => handleQuickFilterChange('all')}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <StockTable stocks={paginatedStocks as unknown as StockAnalysis[]} compact />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {paginatedStocks.map((stock) => (
              <StockCard key={stock.id} stock={stock as unknown as StockAnalysis} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredStocks.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>per page</span>
            <span className="text-gray-400 ml-2">
              {startIndex + 1}&ndash;{Math.min(startIndex + pageSize, filteredStocks.length)} of {filteredStocks.length}
            </span>
          </div>

          {/* Page navigation */}
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
