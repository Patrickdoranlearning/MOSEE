'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StockPreview, TickerSuggestion, formatCurrency } from '@/types/mosee'

interface RunAnalysisPageProps {
  ticker: string
}

type PreviewState = 'loading' | 'loaded' | 'error'
type AnalysisState = 'idle' | 'running' | 'success' | 'error'

export function RunAnalysisPage({ ticker }: RunAnalysisPageProps) {
  const [previewState, setPreviewState] = useState<PreviewState>('loading')
  const [preview, setPreview] = useState<StockPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const router = useRouter()

  // Fetch preview on mount
  useEffect(() => {
    const controller = new AbortController()

    async function loadPreview() {
      try {
        const res = await fetch(`/api/preview/${ticker}`, { signal: controller.signal })
        const data = await res.json()

        if (data.status === 'success' && data.data) {
          // If the ticker was resolved to a different symbol (e.g., "APPLE" -> "AAPL"),
          // redirect to the correct ticker page
          if (data.resolvedTicker && data.resolvedTicker.toUpperCase() !== ticker.toUpperCase()) {
            router.replace(`/stock/${data.resolvedTicker}`)
            return
          }
          setPreview(data.data)
          setPreviewState('loaded')
        } else {
          setPreviewError(data.error || 'Could not load preview data')
          if (data.suggestions) {
            setSuggestions(data.suggestions)
          }
          setPreviewState('error')
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setPreviewError('Failed to fetch stock data')
        setPreviewState('error')
      }
    }

    loadPreview()
    return () => controller.abort()
  }, [ticker, router])

  // Elapsed timer for analysis
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (analysisState === 'running') {
      interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [analysisState])

  const handleRunAnalysis = async () => {
    setAnalysisState('running')
    setAnalysisError(null)
    setElapsed(0)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const response = await fetch(`/api/analyze/${ticker}`, {
        method: 'POST',
        signal: controller.signal,
      })
      const data = await response.json()

      if (data.status === 'success') {
        setAnalysisState('success')
        router.refresh()
      } else {
        setAnalysisState('error')
        setAnalysisError(data.error || 'Analysis failed')
      }
    } catch (err) {
      setAnalysisState('error')
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAnalysisError('Analysis timed out. The stock may require too long to process.')
      } else {
        setAnalysisError(err instanceof Error ? err.message : 'Failed to run analysis')
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  const progressMessage = () => {
    if (elapsed < 8) return 'Fetching market data...'
    if (elapsed < 20) return 'Downloading financial statements...'
    if (elapsed < 35) return 'Calculating valuation models...'
    if (elapsed < 50) return 'Generating intelligence report...'
    if (elapsed < 70) return 'Saving results...'
    return 'Almost done...'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="mb-4">
        <Link href="/picks" className="text-blue-600 hover:text-blue-700">
          &larr; Back to All Picks
        </Link>
      </nav>

      {previewState === 'loading' && <PreviewSkeleton ticker={ticker} />}
      {previewState === 'error' && <PreviewError ticker={ticker} error={previewError} suggestions={suggestions} />}
      {previewState === 'loaded' && preview && (
        <>
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{ticker}</h1>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Not Yet Analyzed
                  </span>
                </div>
                <p className="text-lg text-gray-600">{preview.companyName}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 flex-wrap">
                  {preview.sector && <span>{preview.sector}</span>}
                  {preview.industry && <><span>•</span><span>{preview.industry}</span></>}
                  {preview.country && <><span>•</span><span>{preview.country}</span></>}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="text-3xl font-bold text-gray-900">
                  {preview.currency !== 'USD' && (
                    <span className="text-sm font-normal text-gray-400 mr-1">{preview.currency}</span>
                  )}
                  {formatCurrency(preview.currentPrice)}
                </div>
                {preview.dayChange != null && preview.dayChangePercent != null && (
                  <div className={`text-sm font-medium ${preview.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {preview.dayChange >= 0 ? '+' : ''}{preview.dayChange.toFixed(2)}
                    {' '}({preview.dayChange >= 0 ? '+' : ''}{preview.dayChangePercent.toFixed(2)}%)
                  </div>
                )}
                {preview.currency !== 'USD' && (
                  <div className="text-xs text-gray-400 mt-1">
                    Prices in {preview.currency}. Full analysis converts to USD.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* 52-Week Range */}
              {preview.fiftyTwoWeekLow != null && preview.fiftyTwoWeekHigh != null && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">52-Week Range</h2>
                  <FiftyTwoWeekBar
                    low={preview.fiftyTwoWeekLow}
                    high={preview.fiftyTwoWeekHigh}
                    current={preview.currentPrice}
                  />
                </div>
              )}

              {/* Key Ratios */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Key Ratios</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <RatioItem label="Trailing P/E" value={preview.trailingPE?.toFixed(2)} />
                  <RatioItem label="Forward P/E" value={preview.forwardPE?.toFixed(2)} />
                  <RatioItem label="Price/Book" value={preview.priceToBook?.toFixed(2)} />
                  <RatioItem
                    label="Dividend Yield"
                    value={preview.dividendYield != null ? `${(preview.dividendYield * 100).toFixed(2)}%` : undefined}
                  />
                  <RatioItem label="Beta" value={preview.beta?.toFixed(2)} />
                  <RatioItem
                    label="Avg Volume"
                    value={preview.averageVolume != null ? formatVolume(preview.averageVolume) : undefined}
                  />
                </div>
              </div>

              {/* Market Data */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Market Data</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <RatioItem label="Market Cap" value={formatCurrency(preview.marketCap)} />
                  <RatioItem label="Exchange" value={preview.exchange} />
                  <RatioItem label="Currency" value={preview.currency} />
                  <RatioItem label="Previous Close" value={preview.previousClose?.toFixed(2)} />
                  <RatioItem label="52-Week Low" value={preview.fiftyTwoWeekLow?.toFixed(2)} />
                  <RatioItem label="52-Week High" value={preview.fiftyTwoWeekHigh?.toFixed(2)} />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Run Analysis Card */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
                {analysisState === 'idle' && (
                  <>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Run Full MOSEE Analysis</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Get a complete investment analysis including valuation range, margin of safety,
                      and multi-lens perspectives from Graham, Buffett, Lynch, Fisher &amp; Greenblatt.
                    </p>
                    <button
                      onClick={handleRunAnalysis}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg cursor-pointer"
                    >
                      Run Analysis
                    </button>
                    <p className="text-xs text-gray-400 mt-3 text-center">
                      Typically takes 15&ndash;60 seconds
                    </p>
                  </>
                )}

                {analysisState === 'running' && (
                  <div className="space-y-4 text-center">
                    <div className="flex justify-center">
                      <svg
                        className="animate-spin h-10 w-10 text-blue-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900">Analyzing {ticker}...</p>
                    <p className="text-sm text-gray-500">{progressMessage()}</p>
                    <p className="text-xs text-gray-400">{elapsed}s elapsed</p>
                  </div>
                )}

                {analysisState === 'success' && (
                  <div className="space-y-4 text-center">
                    <div className="flex justify-center">
                      <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900">Analysis complete!</p>
                    <p className="text-sm text-gray-500">Loading results...</p>
                  </div>
                )}

                {analysisState === 'error' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 font-medium">Analysis Failed</p>
                      <p className="text-red-600 text-sm mt-1">{analysisError}</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleRunAnalysis}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Try Again
                      </button>
                      <Link
                        href="/picks"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Browse Picks
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* What MOSEE Analyzes */}
              {analysisState === 'idle' && (
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">What MOSEE Analyzes</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      Intrinsic value range (conservative / base / optimistic)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      Margin of Safety &amp; MOSEE score
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      Financial health (ROE, ROIC, debt ratios)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      5 investment perspectives (Graham, Buffett, Lynch, Fisher, Greenblatt)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      Strengths, concerns &amp; action items
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function PreviewSkeleton({ ticker }: { ticker: string }) {
  return (
    <>
      {/* Header skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{ticker}</h1>
              <div className="h-6 w-28 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mt-2" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-3" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="h-6 w-36 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="h-12 w-full bg-blue-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </>
  )
}

function PreviewError({ ticker, error, suggestions }: { ticker: string; error: string | null; suggestions: TickerSuggestion[] }) {
  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{ticker}</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="text-red-800 font-medium">Could not find stock data</p>
          <p className="text-red-600 text-sm mt-1">
            {error || `No data found for ${ticker}. Please check the ticker symbol and try again.`}
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-sm font-medium text-gray-700 mb-3">Did you mean?</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <Link
                  key={s.symbol}
                  href={`/stock/${s.symbol}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-blue-600">{s.symbol}</span>
                    <span className="text-gray-600 text-sm ml-2">{s.name}</span>
                  </div>
                  {s.exchange && (
                    <span className="text-xs text-gray-400">{s.exchange}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center mt-6">
          <Link
            href="/picks"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Picks
          </Link>
        </div>
      </div>
    </div>
  )
}

function FiftyTwoWeekBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low
  const position = range > 0 ? Math.min(100, Math.max(0, ((current - low) / range) * 100)) : 50

  return (
    <div className="relative pt-8 pb-2">
      <div className="relative h-8 bg-gradient-to-r from-red-100 via-yellow-100 to-green-100 rounded-lg">
        {/* Current price marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
          style={{ left: `${position}%` }}
        >
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">
              Current: {current.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <div>
          <span className="font-semibold text-red-600">{low.toFixed(2)}</span>
          <span className="text-gray-400 ml-1">Low</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">High</span>
          <span className="font-semibold text-green-600">{high.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function RatioItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{value || 'N/A'}</div>
    </div>
  )
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`
  return vol.toString()
}
