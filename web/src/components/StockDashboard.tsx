'use client'

import { useState, useMemo } from 'react'
import { StockSummary, Verdict, QualityGrade } from '@/types/mosee'
import { StockTable } from './StockTable'
import { StockCard } from './StockCard'
import { DashboardFilters } from './DashboardFilters'
import type { StockAnalysis } from '@/types/mosee'

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
    // Reset dropdown filters when changing quick filter
    setSelectedVerdict('')
    setSelectedIndustry('')
    setSelectedCountry('')
    setSelectedGrade('')
  }

  const handleDropdownChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setQuickFilter('all') // Reset quick filter when using dropdowns
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
        onTextSearchChange={setTextSearch}
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
            <StockTable stocks={filteredStocks as unknown as StockAnalysis[]} compact />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {filteredStocks.map((stock) => (
              <StockCard key={stock.id} stock={stock as unknown as StockAnalysis} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
