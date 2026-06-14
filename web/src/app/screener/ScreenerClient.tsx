'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { ScreenerRow, Verdict, QualityGrade } from '@/types/mosee'
import { VerdictBadge } from '@/components/VerdictBadge'
import { QualityBadge } from '@/components/QualityBadge'
import { formatCurrency, formatMoS, formatPercent, VERDICT_PRIORITY } from '@/types/mosee'

// 1.1487^5 ≈ 2.0 — i.e. priced to double over 5 years.
const DOUBLER_RETURN = 0.1487
const DOUBLER_MIN_CONFIDENCE = 50
const DOUBLER_MAX_MOS = 1.0
const STALE_DAYS = 45

type Preset = 'doubler' | 'all'
type SortField =
  | 'ticker' | 'price' | 'fair_value' | 'implied_return'
  | 'mos' | 'confidence' | 'verdict' | 'quality' | 'analysis_date'
type SortDirection = 'asc' | 'desc'

const GRADE_ORDER: Record<string, number> = { 'A+': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'F': 6 }

function formatCapSize(cap: string | null): string {
  if (!cap) return 'N/A'
  const map: Record<string, string> = { mega: 'Mega', extra_large: 'XL', large: 'Large', medium: 'Mid', small: 'Small', extra_small: 'Micro' }
  return map[cap] || cap
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 86_400_000)
}

function isHighOrMedium(conf: string | null): boolean {
  if (!conf) return false
  const c = conf.toUpperCase()
  return c === 'HIGH' || c === 'MEDIUM'
}

function meetsDoubler(s: ScreenerRow): boolean {
  return (
    s.implied_annual_return != null &&
    s.implied_annual_return >= DOUBLER_RETURN &&
    s.confidence_score != null &&
    s.confidence_score >= DOUBLER_MIN_CONFIDENCE &&
    isHighOrMedium(s.valuation_confidence) &&
    s.margin_of_safety != null &&
    s.margin_of_safety <= DOUBLER_MAX_MOS
  )
}

interface ScreenerClientProps {
  stocks: ScreenerRow[]
}

export function ScreenerClient({ stocks }: ScreenerClientProps) {
  const [preset, setPreset] = useState<Preset>('all')
  const [textSearch, setTextSearch] = useState('')
  const [minReturn, setMinReturn] = useState('')          // percent, e.g. "14.87"
  const [minConfidence, setMinConfidence] = useState('')  // 0-100
  const [maxMoS, setMaxMoS] = useState('')                // ratio, e.g. "1.0"
  const [selectedVerdict, setSelectedVerdict] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedCapSize, setSelectedCapSize] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [sortField, setSortField] = useState<SortField>('implied_return')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Filter option lists derived from the data
  const verdicts = useMemo(() => [...new Set(stocks.filter(s => s.verdict).map(s => s.verdict))] as Verdict[], [stocks])
  const grades = useMemo(() => [...new Set(stocks.filter(s => s.quality_grade).map(s => s.quality_grade!))] as QualityGrade[], [stocks])
  const capSizes = useMemo(() => [...new Set(stocks.map(s => s.cap_size).filter(Boolean))] as string[], [stocks])
  const countries = useMemo(() => [...new Set(stocks.map(s => s.country).filter(Boolean))].sort() as string[], [stocks])
  const industries = useMemo(() => [...new Set(stocks.map(s => s.industry).filter(Boolean))].sort() as string[], [stocks])

  // True when no row has a computed implied return yet (pre-migration dataset).
  const allReturnsNull = useMemo(
    () => stocks.length > 0 && stocks.every(s => s.implied_annual_return == null),
    [stocks],
  )

  const resetFilters = () => {
    setTextSearch('')
    setMinReturn('')
    setMinConfidence('')
    setMaxMoS('')
    setSelectedVerdict('')
    setSelectedGrade('')
    setSelectedCapSize('')
    setSelectedCountry('')
    setSelectedIndustry('')
  }

  const applyPreset = (p: Preset) => {
    setPreset(p)
    if (p === 'doubler') {
      // Surface the Doubler thresholds in the adjustable controls so they're
      // visible and tweakable; the preset gate adds valuation-confidence too.
      setTextSearch('')
      setMinReturn((DOUBLER_RETURN * 100).toFixed(2))
      setMinConfidence(String(DOUBLER_MIN_CONFIDENCE))
      setMaxMoS(String(DOUBLER_MAX_MOS))
      setSelectedVerdict('')
      setSelectedGrade('')
      setSelectedCapSize('')
      setSelectedCountry('')
      setSelectedIndustry('')
    } else {
      resetFilters()
    }
  }

  const minReturnFrac = minReturn !== '' && !isNaN(Number(minReturn)) ? Number(minReturn) / 100 : null
  const minConfidenceNum = minConfidence !== '' && !isNaN(Number(minConfidence)) ? Number(minConfidence) : null
  const maxMoSNum = maxMoS !== '' && !isNaN(Number(maxMoS)) ? Number(maxMoS) : null

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Doubler preset is a hard gate on top of the adjustable filters.
      if (preset === 'doubler' && !meetsDoubler(stock)) return false

      if (minReturnFrac != null) {
        if (stock.implied_annual_return == null || stock.implied_annual_return < minReturnFrac) return false
      }
      if (minConfidenceNum != null) {
        if (stock.confidence_score == null || stock.confidence_score < minConfidenceNum) return false
      }
      if (maxMoSNum != null) {
        if (stock.margin_of_safety == null || stock.margin_of_safety > maxMoSNum) return false
      }
      if (selectedVerdict && stock.verdict !== selectedVerdict) return false
      if (selectedGrade && stock.quality_grade !== selectedGrade) return false
      if (selectedCapSize && stock.cap_size !== selectedCapSize) return false
      if (selectedCountry && stock.country !== selectedCountry) return false
      if (selectedIndustry && stock.industry !== selectedIndustry) return false

      if (textSearch) {
        const q = textSearch.toLowerCase()
        if (
          !stock.ticker.toLowerCase().includes(q) &&
          !(stock.company_name?.toLowerCase().includes(q) ?? false)
        ) {
          return false
        }
      }

      return true
    })
  }, [stocks, preset, minReturnFrac, minConfidenceNum, maxMoSNum, selectedVerdict, selectedGrade, selectedCapSize, selectedCountry, selectedIndustry, textSearch])

  const sortedStocks = useMemo(() => {
    // Sentinels push nulls to the bottom regardless of direction by flipping
    // with the sort direction below.
    return [...filteredStocks].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'price':
          comparison = (a.current_price ?? -1) - (b.current_price ?? -1)
          break
        case 'fair_value':
          comparison = (a.valuation_base ?? -1) - (b.valuation_base ?? -1)
          break
        case 'implied_return': {
          // NULLs always last: keep them at the bottom for both directions.
          const ar = a.implied_annual_return
          const br = b.implied_annual_return
          if (ar == null && br == null) return 0
          if (ar == null) return 1
          if (br == null) return -1
          comparison = ar - br
          break
        }
        case 'mos':
          // Lower MoS ratio is better; nulls sort large so they land last on asc.
          comparison = (a.margin_of_safety ?? 9999) - (b.margin_of_safety ?? 9999)
          break
        case 'confidence':
          comparison = (a.confidence_score ?? -1) - (b.confidence_score ?? -1)
          break
        case 'verdict':
          comparison = (VERDICT_PRIORITY[a.verdict] ?? 99) - (VERDICT_PRIORITY[b.verdict] ?? 99)
          break
        case 'quality':
          comparison = (GRADE_ORDER[a.quality_grade || ''] || 99) - (GRADE_ORDER[b.quality_grade || ''] || 99)
          break
        case 'analysis_date':
          comparison = new Date(a.analysis_date || 0).getTime() - new Date(b.analysis_date || 0).getTime()
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredStocks, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      // Returns/confidence/fair value/quality read best high-to-low first.
      const descByDefault: SortField[] = ['implied_return', 'confidence', 'fair_value', 'quality', 'analysis_date', 'price']
      setSortDirection(descByDefault.includes(field) ? 'desc' : 'asc')
    }
  }

  const hasAdjustableFilters =
    !!textSearch || !!minReturn || !!minConfidence || !!maxMoS ||
    !!selectedVerdict || !!selectedGrade || !!selectedCapSize || !!selectedCountry || !!selectedIndustry

  // Human-readable summary of what's active
  const activeFilterParts: string[] = []
  if (preset === 'doubler') activeFilterParts.push('Doubler preset')
  if (minReturn) activeFilterParts.push(`return ≥ ${minReturn}%/yr`)
  if (minConfidence) activeFilterParts.push(`confidence ≥ ${minConfidence}`)
  if (maxMoS) activeFilterParts.push(`MoS ≤ ${maxMoS}`)
  if (selectedVerdict) activeFilterParts.push(selectedVerdict)
  if (selectedGrade) activeFilterParts.push(`grade ${selectedGrade}`)
  if (selectedCapSize) activeFilterParts.push(formatCapSize(selectedCapSize))
  if (selectedCountry) activeFilterParts.push(selectedCountry)
  if (selectedIndustry) activeFilterParts.push(selectedIndustry)
  if (textSearch) activeFilterParts.push(`“${textSearch}”`)

  const renderSortHeader = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-gray-400">
          {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  )

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Preset pills */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => applyPreset('doubler')}
          className={`flex flex-col items-start px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            preset === 'doubler'
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
          }`}
        >
          <span className="font-semibold">Doubler</span>
          <span className={`text-[11px] font-normal ${preset === 'doubler' ? 'text-green-50' : 'text-green-700'}`}>
            ≥14.87%/yr · conf ≥50 · val HIGH/MED · MoS ≤1.0
          </span>
        </button>
        <button
          onClick={() => applyPreset('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            preset === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
          }`}
        >
          All stocks
        </button>
      </div>

      {/* Pre-migration banner: every row's implied return is null */}
      {allReturnsNull && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">Implied returns aren’t available yet.</p>
          <p className="mt-1 text-blue-800">
            They appear after the next analysis run. Until then, the other filters still work —
            but the <span className="font-medium">Doubler</span> preset will be empty, because it
            excludes stocks without a computed implied return (correct behavior).
          </p>
        </div>
      )}

      {/* Adjustable filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Min return %/yr</label>
            <input type="number" inputMode="decimal" step="0.1" value={minReturn}
              onChange={e => { setMinReturn(e.target.value); setPreset('all') }}
              placeholder="e.g. 14.87" className={`${inputClass} w-32`} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Min confidence</label>
            <input type="number" inputMode="numeric" step="1" value={minConfidence}
              onChange={e => { setMinConfidence(e.target.value); setPreset('all') }}
              placeholder="0–100" className={`${inputClass} w-28`} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Max MoS ratio</label>
            <input type="number" inputMode="decimal" step="0.05" value={maxMoS}
              onChange={e => { setMaxMoS(e.target.value); setPreset('all') }}
              placeholder="e.g. 1.0" className={`${inputClass} w-28`} />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Verdict</label>
            <select value={selectedVerdict} onChange={e => { setSelectedVerdict(e.target.value); setPreset('all') }} className={inputClass}>
              <option value="">All</option>
              {verdicts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Grade</label>
            <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setPreset('all') }} className={inputClass}>
              <option value="">All</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Cap size</label>
            <select value={selectedCapSize} onChange={e => { setSelectedCapSize(e.target.value); setPreset('all') }} className={inputClass}>
              <option value="">All</option>
              {capSizes.map(c => <option key={c} value={c}>{formatCapSize(c)}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Country</label>
            <select value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setPreset('all') }} className={inputClass}>
              <option value="">All</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Industry</label>
            <select value={selectedIndustry} onChange={e => { setSelectedIndustry(e.target.value); setPreset('all') }} className={`${inputClass} max-w-[200px]`}>
              <option value="">All</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-500 mb-1">Search</label>
            <input type="text" value={textSearch}
              onChange={e => { setTextSearch(e.target.value); setPreset('all') }}
              placeholder="Ticker or company name…" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Result count + active filter summary */}
      <div className="text-sm text-gray-500 mb-3">
        Showing <span className="font-medium text-gray-700">{sortedStocks.length.toLocaleString()}</span> of {stocks.length.toLocaleString()} analyzed stocks
        {activeFilterParts.length > 0 && (
          <span className="text-gray-400"> · {activeFilterParts.join(' · ')}</span>
        )}
        {(preset === 'doubler' || hasAdjustableFilters) && (
          <button onClick={() => applyPreset('all')} className="ml-2 text-blue-600 hover:text-blue-700">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {renderSortHeader('ticker', 'Ticker')}
                {renderSortHeader('price', 'Price')}
                {renderSortHeader('fair_value', 'Fair Value')}
                {renderSortHeader('implied_return', 'Implied Return/yr')}
                {renderSortHeader('mos', 'MoS')}
                {renderSortHeader('confidence', 'Confidence')}
                {renderSortHeader('verdict', 'Verdict')}
                {renderSortHeader('quality', 'Quality')}
                {renderSortHeader('analysis_date', 'Analyzed')}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStocks.map(stock => {
                const age = daysSince(stock.analysis_date)
                const stale = age != null && age > STALE_DAYS
                return (
                  <tr key={stock.ticker} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/stock/${encodeURIComponent(stock.ticker)}`} className="block">
                        <div className="font-medium text-blue-600 hover:text-blue-700">{stock.ticker}</div>
                        {stock.company_name && (
                          <div className="text-sm text-gray-500 max-w-[160px] truncate">{stock.company_name}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700">
                      {stock.current_price != null ? formatCurrency(stock.current_price) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700">
                      {stock.valuation_base != null ? formatCurrency(stock.valuation_base) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      {stock.implied_annual_return != null ? (
                        <span className={stock.implied_annual_return >= DOUBLER_RETURN ? 'text-green-600 font-medium' : 'text-gray-700'}>
                          {formatPercent(stock.implied_annual_return)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      <span className={stock.margin_of_safety != null && stock.margin_of_safety <= 1 ? 'text-green-600 font-medium' : 'text-orange-500'}>
                        {formatMoS(stock.margin_of_safety)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700">
                      {stock.confidence_score != null ? (
                        <span>
                          {stock.confidence_score.toFixed(0)}
                          {stock.confidence_level && (
                            <span className="text-gray-400 text-xs ml-1">{stock.confidence_level}</span>
                          )}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stock.verdict ? <VerdictBadge verdict={stock.verdict} size="sm" /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {stock.quality_grade ? <QualityBadge grade={stock.quality_grade} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-500">
                      {stock.analysis_date ? (
                        <span className="inline-flex items-center gap-1.5">
                          {new Date(stock.analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {stale && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700"
                              title={`Analyzed ${age} days ago`}
                            >
                              stale
                            </span>
                          )}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {sortedStocks.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            {preset === 'doubler' && allReturnsNull
              ? 'No Doublers yet — implied returns are computed on the next analysis run.'
              : 'No stocks match these filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
