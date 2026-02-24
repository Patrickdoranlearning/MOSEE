'use client'

import { useState, useMemo } from 'react'
import { StockAnalysis, Verdict } from '@/types/mosee'
import { StockTable } from '@/components/StockTable'

interface PicksFilterProps {
  stocks: StockAnalysis[]
  verdicts: Verdict[]
  industries: string[]
  countries: string[]
}

export function PicksFilter({ stocks, verdicts, industries, countries }: PicksFilterProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [selectedVerdict, setSelectedVerdict] = useState<string>('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (selectedVerdict && stock.verdict !== selectedVerdict) return false
      if (selectedIndustry && stock.industry !== selectedIndustry) return false
      if (selectedCountry && stock.country !== selectedCountry) return false
      return true
    })
  }, [stocks, selectedVerdict, selectedIndustry, selectedCountry])

  const clearFilters = () => {
    setSelectedVerdict('')
    setSelectedIndustry('')
    setSelectedCountry('')
  }

  const hasActiveFilters = selectedVerdict || selectedIndustry || selectedCountry

  // Quick filter helpers
  const applyQuickFilter = (type: string) => {
    clearFilters()
    switch (type) {
      case 'buy':
        setSelectedVerdict('')
        // We'll filter in the memo below for multi-verdict
        break
      case 'mos':
      case 'quality':
      case 'large':
        break
    }
  }

  // For quick filters that need multi-value logic, apply separately
  const quickFilteredStocks = useMemo(() => {
    return filteredStocks
  }, [filteredStocks])

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>

        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verdict Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verdict
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={selectedVerdict}
                  onChange={(e) => setSelectedVerdict(e.target.value)}
                >
                  <option value="">All Verdicts</option>
                  {verdicts.map(verdict => (
                    <option key={verdict} value={verdict}>{verdict}</option>
                  ))}
                </select>
              </div>

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                >
                  <option value="">All Industries</option>
                  {industries.sort().map(industry => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>

              {/* Country Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                >
                  <option value="">All Countries</option>
                  {countries.sort().map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700 mr-3">Quick Filters:</span>
              <div className="inline-flex gap-2 flex-wrap mt-2">
                <button
                  onClick={() => { clearFilters(); setSelectedVerdict('STRONG BUY'); }}
                  className={`px-3 py-1 rounded-full text-sm hover:bg-green-200 ${
                    selectedVerdict === 'STRONG BUY' ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700'
                  }`}
                >
                  Strong Buy
                </button>
                <button
                  onClick={() => { clearFilters(); setSelectedVerdict('BUY'); }}
                  className={`px-3 py-1 rounded-full text-sm hover:bg-blue-200 ${
                    selectedVerdict === 'BUY' ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => { clearFilters(); setSelectedVerdict('ACCUMULATE'); }}
                  className={`px-3 py-1 rounded-full text-sm hover:bg-purple-200 ${
                    selectedVerdict === 'ACCUMULATE' ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  Accumulate
                </button>
                <button
                  onClick={() => { clearFilters(); setSelectedVerdict('WATCHLIST'); }}
                  className={`px-3 py-1 rounded-full text-sm hover:bg-yellow-200 ${
                    selectedVerdict === 'WATCHLIST' ? 'bg-yellow-200 text-yellow-800' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  Watchlist
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-4 text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <StockTable stocks={quickFilteredStocks} />
      </div>

      {/* Summary */}
      {stocks.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {quickFilteredStocks.length} of {stocks.length} stocks
          {hasActiveFilters && ' (filtered)'}
        </div>
      )}
    </div>
  )
}
