'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StockSummary, VERDICT_COLORS, formatCurrency } from '@/types/mosee'

interface MarketResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState<StockSummary[]>([])
  const [marketResults, setMarketResults] = useState<MarketResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Fetch stock data on first open
  useEffect(() => {
    if (isOpen && !loaded) {
      fetch('/api/search')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setStocks(data)
            setLoaded(true)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, loaded])

  // Auto-focus input when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const results = useMemo(() => {
    if (!query.trim()) return stocks.slice(0, 8)
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

  // When the local (analyzed-stocks) filter yields few/no hits, resolve the
  // query against Yahoo's search so company names map to tickers (e.g.
  // "everplay" -> EVPL.L). Debounced to avoid hammering the endpoint.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || results.length >= 3) {
      setMarketResults([])
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return
          setMarketResults(Array.isArray(data?.results) ? data.results : [])
        })
        .catch(() => {
          if (!cancelled) setMarketResults([])
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, results.length])

  // Drop market candidates whose symbol already appears in local results.
  const localTickers = useMemo(
    () => new Set(results.map(s => s.ticker.toUpperCase())),
    [results]
  )
  const marketCandidates = useMemo(
    () => marketResults.filter(m => !localTickers.has(m.symbol.toUpperCase())),
    [marketResults, localTickers]
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
  }, [])

  const navigate = useCallback((ticker: string) => {
    router.push(`/stock/${ticker}`)
    close()
  }, [router, close])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.length + marketCandidates.length + (query.trim() ? 1 : 0)
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
      } else if (selectedIndex < results.length + marketCandidates.length) {
        navigate(marketCandidates[selectedIndex - results.length].symbol)
      } else if (query.trim()) {
        navigate(query.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      close()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-gray-200">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks..."
            className="w-full px-3 py-4 text-base focus:outline-none placeholder-gray-400"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-mono text-gray-400 bg-gray-100 rounded border border-gray-200">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && marketCandidates.length === 0 && query.trim() && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No analyzed stocks match &ldquo;{query}&rdquo;
            </div>
          )}

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

          {/* Market search — resolve company names to tickers via Yahoo */}
          {marketCandidates.length > 0 && (
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 border-t border-gray-100">
              Market search
            </div>
          )}
          {marketCandidates.map((m, i) => {
            const idx = results.length + i
            return (
              <button
                key={m.symbol}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => navigate(m.symbol)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-gray-900 shrink-0">{m.symbol}</span>
                  <span className="text-sm text-gray-500 truncate">{m.name}</span>
                </div>
                {m.exchange && (
                  <span className="text-xs text-gray-400 shrink-0 ml-3">{m.exchange}</span>
                )}
              </button>
            )
          })}

          {/* Search on market option */}
          {query.trim() && (
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-gray-100 transition-colors ${
                selectedIndex === results.length + marketCandidates.length ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => navigate(query.trim().toUpperCase())}
              onMouseEnter={() => setSelectedIndex(results.length + marketCandidates.length)}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm text-gray-600">
                Look up <span className="font-semibold text-gray-900">{query.trim().toUpperCase()}</span> on Yahoo Finance
              </span>
            </button>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↑↓</kbd> navigate
            <span className="mx-2">|</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↵</kbd> select
          </span>
          <span>{stocks.length} stocks indexed</span>
        </div>
      </div>
    </div>
  )
}
