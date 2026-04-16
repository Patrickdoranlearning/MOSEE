'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'

interface YearValue {
  year: number
  value: number
}

export interface ShareholderReturnsData {
  dividendYield: number | null
  buybackYield: number | null
  dividendGrowthRate: number | null
  buybackGrowthRate: number | null
  historicalDividends: YearValue[]
  historicalNetBuybacks: YearValue[]
  historicalSharesOutstanding: YearValue[]
}

export function ShareholderReturnsTab({ data }: { data: ShareholderReturnsData }) {
  const totalYield = (data.dividendYield || 0) + (data.buybackYield || 0)

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Shareholder Returns</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Tile
            label="Dividend Yield"
            value={formatPct(data.dividendYield)}
            color={data.dividendYield && data.dividendYield > 0.02 ? 'text-green-600' : undefined}
          />
          <Tile
            label="Buyback Yield"
            value={formatPct(data.buybackYield)}
            sublabel={data.buybackYield != null && data.buybackYield < 0 ? 'Net issuer' : undefined}
            color={
              data.buybackYield != null && data.buybackYield > 0.02 ? 'text-green-600'
                : data.buybackYield != null && data.buybackYield < 0 ? 'text-red-500' : undefined
            }
          />
          <Tile
            label="Total Shareholder Yield"
            value={formatPct(totalYield)}
            color={totalYield > 0.04 ? 'text-green-600' : totalYield > 0.02 ? 'text-yellow-600' : undefined}
          />
          <Tile
            label="Dividend Growth"
            value={data.dividendGrowthRate != null ? `${data.dividendGrowthRate > 0 ? '+' : ''}${(data.dividendGrowthRate * 100).toFixed(1)}%/yr` : 'N/A'}
            color={data.dividendGrowthRate != null && data.dividendGrowthRate > 0 ? 'text-green-600' : data.dividendGrowthRate != null && data.dividendGrowthRate < 0 ? 'text-red-500' : undefined}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DividendChart
          historicalDividends={data.historicalDividends}
          growthRate={data.dividendGrowthRate}
        />
        <ShareCapitalChart
          historicalNetBuybacks={data.historicalNetBuybacks}
          historicalShares={data.historicalSharesOutstanding}
        />
      </div>
    </div>
  )
}

function Tile({ label, value, sublabel, color }: {
  label: string; value: string; sublabel?: string; color?: string
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
    </div>
  )
}

// --- Dividend History Chart ---

function DividendChart({
  historicalDividends,
  growthRate,
}: {
  historicalDividends: YearValue[]
  growthRate: number | null
}) {
  if (historicalDividends.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Dividend History</h3>
        <p className="text-sm text-gray-400 text-center py-12">No dividend data available</p>
      </div>
    )
  }

  const sorted = [...historicalDividends].sort((a, b) => a.year - b.year)
  const allZero = sorted.every(d => d.value === 0)

  if (allZero) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Dividend History</h3>
        <p className="text-sm text-gray-400 text-center py-12">This company does not pay dividends</p>
      </div>
    )
  }

  const chartData = sorted.map((d, i) => {
    const prev = i > 0 ? sorted[i - 1].value : null
    const yoyGrowth = prev && prev > 0 ? ((d.value - prev) / prev) * 100 : null
    return { ...d, yoyGrowth }
  })

  const trendLabel = growthRate != null
    ? growthRate > 0.01 ? 'Growing' : growthRate < -0.01 ? 'Declining' : 'Stable'
    : null
  const trendColor = growthRate != null
    ? growthRate > 0.01 ? 'text-green-600' : growthRate < -0.01 ? 'text-red-500' : 'text-gray-600'
    : 'text-gray-600'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Dividend History</h3>
        {trendLabel && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendLabel} ({growthRate! > 0 ? '+' : ''}{(growthRate! * 100).toFixed(1)}%/yr)
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={compactAxis} width={60} />
          <Tooltip content={<DividendTooltip />} />
          <Bar dataKey="value" name="Dividends Paid" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.value > 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function DividendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { yoyGrowth: number | null } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const val = payload[0].value
  const yoy = payload[0].payload?.yoyGrowth
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-green-600">Dividends: {formatCompactSigned(val)}</p>
      {yoy != null && (
        <p className={yoy >= 0 ? 'text-green-600' : 'text-red-500'}>
          YoY: {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

// --- Share Capital Chart ---

function ShareCapitalChart({
  historicalNetBuybacks,
  historicalShares,
}: {
  historicalNetBuybacks: YearValue[]
  historicalShares: YearValue[]
}) {
  const hasAnyData = historicalNetBuybacks.length > 0 || historicalShares.length > 0

  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Share Capital Activity</h3>
        <p className="text-sm text-gray-400 text-center py-12">No share capital data available</p>
      </div>
    )
  }

  const buybacksByYear = new Map<number, number>()
  for (const d of historicalNetBuybacks) buybacksByYear.set(d.year, d.value)
  const sharesByYear = new Map<number, number>()
  for (const d of historicalShares) sharesByYear.set(d.year, d.value)

  const allYears = new Set<number>()
  buybacksByYear.forEach((_, y) => allYears.add(y))
  sharesByYear.forEach((_, y) => allYears.add(y))

  const chartData = Array.from(allYears).sort((a, b) => a - b).map(year => ({
    year,
    netBuyback: buybacksByYear.get(year) ?? null,
    sharesOutstanding: sharesByYear.get(year) ?? null,
  }))

  const shareEntries = chartData.filter(d => d.sharesOutstanding != null)
  let shareChange: { pct: number; direction: string } | null = null
  if (shareEntries.length >= 2) {
    const first = shareEntries[0].sharesOutstanding!
    const last = shareEntries[shareEntries.length - 1].sharesOutstanding!
    if (first > 0) {
      const pctChange = ((last - first) / first) * 100
      shareChange = {
        pct: pctChange,
        direction: pctChange < -1 ? 'Shrinking' : pctChange > 1 ? 'Diluting' : 'Stable',
      }
    }
  }

  const directionColor = shareChange
    ? shareChange.direction === 'Shrinking' ? 'text-green-600'
      : shareChange.direction === 'Diluting' ? 'text-red-500' : 'text-gray-600'
    : 'text-gray-600'

  const hasShares = chartData.some(d => d.sharesOutstanding != null)
  const hasBuybacks = chartData.some(d => d.netBuyback != null)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Share Capital Activity</h3>
        {shareChange && (
          <span className={`text-xs font-medium ${directionColor}`}>
            Shares {shareChange.direction} ({shareChange.pct >= 0 ? '+' : ''}{shareChange.pct.toFixed(1)}%)
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          {hasBuybacks && (
            <YAxis yAxisId="buyback" tick={{ fontSize: 11 }} tickFormatter={compactAxis} width={60} />
          )}
          {hasShares && (
            <YAxis yAxisId="shares" orientation="right" tick={{ fontSize: 11 }} tickFormatter={compactAxis} width={60} />
          )}
          <Tooltip content={<ShareCapitalTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId={hasBuybacks ? "buyback" : "shares"} y={0} stroke="#d1d5db" />
          {hasBuybacks && (
            <Bar yAxisId="buyback" dataKey="netBuyback" name="Net Buyback" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.netBuyback != null && entry.netBuyback >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          )}
          {hasShares && (
            <Line yAxisId="shares" dataKey="sharesOutstanding" name="Shares Outstanding" type="monotone" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Buying back shares
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Issuing / diluting
        </span>
      </div>
    </div>
  )
}

function ShareCapitalTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{label}</p>
      {payload.map((entry, i) => {
        if (entry.value == null) return null
        if (entry.dataKey === 'netBuyback') {
          const isBuyback = entry.value >= 0
          return (
            <p key={i} className={isBuyback ? 'text-green-600' : 'text-red-500'}>
              {isBuyback ? 'Net Buyback' : 'Net Issuance'}: {formatCompactSigned(Math.abs(entry.value))}
            </p>
          )
        }
        if (entry.dataKey === 'sharesOutstanding') {
          return <p key={i} className="text-indigo-600">Shares: {formatCompact(entry.value)}</p>
        }
        return null
      })}
    </div>
  )
}

// --- Helpers ---

function formatPct(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return 'N/A'
  return `${(val * 100).toFixed(1)}%`
}

function formatCompact(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return 'N/A'
  const abs = Math.abs(val)
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toFixed(0)}`
}

function formatCompactSigned(val: number): string {
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function compactAxis(val: number): string {
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`
  return `${val}`
}
