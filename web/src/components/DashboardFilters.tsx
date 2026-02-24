'use client'

import { Verdict, QualityGrade } from '@/types/mosee'

interface DashboardFiltersProps {
  // Quick filter
  quickFilter: string
  onQuickFilterChange: (filter: string) => void
  // Dropdown filters
  selectedVerdict: string
  selectedIndustry: string
  selectedCountry: string
  selectedGrade: string
  onVerdictChange: (v: string) => void
  onIndustryChange: (v: string) => void
  onCountryChange: (v: string) => void
  onGradeChange: (v: string) => void
  // Text search
  textSearch: string
  onTextSearchChange: (v: string) => void
  // View toggle
  viewMode: 'table' | 'cards'
  onViewModeChange: (mode: 'table' | 'cards') => void
  // Data
  verdicts: Verdict[]
  industries: string[]
  countries: string[]
  grades: QualityGrade[]
  filteredCount: number
  totalCount: number
}

const QUICK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'strong-buys', label: 'Strong Buys' },
  { key: 'buy-signals', label: 'Buy Signals' },
  { key: 'high-quality', label: 'High Quality' },
  { key: 'undervalued', label: 'Undervalued' },
]

export function DashboardFilters({
  quickFilter, onQuickFilterChange,
  selectedVerdict, selectedIndustry, selectedCountry, selectedGrade,
  onVerdictChange, onIndustryChange, onCountryChange, onGradeChange,
  textSearch, onTextSearchChange,
  viewMode, onViewModeChange,
  verdicts, industries, countries, grades,
  filteredCount, totalCount,
}: DashboardFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onQuickFilterChange(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              quickFilter === key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dropdown Filters + Search + View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Verdict */}
        <select
          value={selectedVerdict}
          onChange={(e) => onVerdictChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Verdicts</option>
          {verdicts.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Industry */}
        <select
          value={selectedIndustry}
          onChange={(e) => onIndustryChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Industries</option>
          {industries.sort().map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Country */}
        <select
          value={selectedCountry}
          onChange={(e) => onCountryChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Countries</option>
          {countries.sort().map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Quality Grade */}
        <select
          value={selectedGrade}
          onChange={(e) => onGradeChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Grades</option>
          {grades.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Text search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={textSearch}
            onChange={(e) => onTextSearchChange(e.target.value)}
            placeholder="Filter..."
            className="pl-8 pr-3 py-1.5 w-36 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Table view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('cards')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'cards' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Card view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Result count */}
      <div className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{filteredCount}</span> of {totalCount} stocks
        {filteredCount !== totalCount && (
          <button
            onClick={() => onQuickFilterChange('all')}
            className="ml-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
