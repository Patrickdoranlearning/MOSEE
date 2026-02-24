'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StockSummary, VERDICT_COLORS, formatCurrency } from '@/types/mosee'

interface HeroSearchProps {
  stocks: StockSummary[]
  stats: { totalAnalyzed: number; buyCount: number; analysisDate: string | null } | null
}

export function HeroSearch({ stocks, stats }: HeroSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return stocks
      .filter(s =>
        s.ticker.toLowerCase().includes(q) ||
        (s.company_name?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 8)
  }, [query, stocks])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navigate = (ticker: string) => {
    router.push(`/stock/${ticker}`)
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.length + (query.trim() ? 1 : 0) // +1 for "search on market" option
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex < results.length) {
        navigate(results[selectedIndex].ticker)
      } else if (query.trim()) {
        navigate(query.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const showDropdown = isOpen && query.trim().length > 0

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-6">
          MOSEE Stock Intelligence
        </h1>

        {/* Search Input */}
        <div className="relative">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search by ticker or company name..."
              className="w-full pl-12 pr-4 py-4 text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
            />
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              {results.map((stock, i) => (
                <button
                  key={stock.id}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    i === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => navigate(stock.ticker)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-gray-900 shrink-0">{stock.ticker}</span>
                    <span className="text-sm text-gray-500 truncate">
                      {stock.company_name || stock.ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span
                      className="px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: VERDICT_COLORS[stock.verdict] }}
                    >
                      {stock.verdict}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(stock.current_price)}
                    </span>
                  </div>
                </button>
              ))}

              {/* Search on market option */}
              {query.trim() && (
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-gray-100 transition-colors ${
                    selectedIndex === results.length ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => navigate(query.trim().toUpperCase())}
                  onMouseEnter={() => setSelectedIndex(results.length)}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">
                    Look up <span className="font-semibold text-gray-900">{query.trim().toUpperCase()}</span> on Yahoo Finance
                  </span>
                </button>
              )}

              {results.length === 0 && query.trim() && (
                <div className="px-4 py-3 text-sm text-gray-500 border-b border-gray-100">
                  No analyzed stocks match &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Strip */}
        {stats && (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-gray-400">
            <span>
              <span className="font-semibold text-white">{stats.totalAnalyzed}</span> stocks analyzed
            </span>
            <span className="hidden sm:inline text-gray-600">|</span>
            <span>
              <span className="font-semibold text-green-400">{stats.buyCount}</span> buy signals
            </span>
            <span className="hidden sm:inline text-gray-600">|</span>
            <span>
              Updated{' '}
              <span className="font-semibold text-white">
                {stats.analysisDate
                  ? new Date(stats.analysisDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'N/A'}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
