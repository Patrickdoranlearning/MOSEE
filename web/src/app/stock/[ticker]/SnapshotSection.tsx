'use client'

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface YearValue {
  year: number
  value: number
}

interface PricePoint {
  date: string
  price: number
}

export interface SnapshotData {
  // Metric tiles
  marketCap: number | null
  currentPrice: number | null
  valuationConservative: number | null
  valuationOptimistic: number | null
  marginOfSafety: number | null
  hasMarginOfSafety: boolean
  buyBelowPrice: number | null
  earningsEquity: number | null
  ownerEarningsYield: number | null
  qualityGrade: string | null
  qualityScore: number | null
  // Charts
  revenueHistory: YearValue[]
  earningsHistory: YearValue[]
  // 52-week range
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  // 5-year price
  priceHistoryMonthly: PricePoint[]
}

export function SnapshotSection({ data }: { data: SnapshotData }) {
  const yearsToPayback = data.earningsEquity && data.earningsEquity > 0
    ? Math.min(1 / data.earningsEquity, 999)
    : null

  const shares = data.marketCap && data.currentPrice && data.currentPrice > 0
    ? data.marketCap / data.currentPrice
    : null

  // Margin of safety as upside percentage: MoS of 0.5 means price is 50% of value → 100% upside
  // MoS = price / conservative_value, so upside = (1/MoS - 1) * 100
  const mosUpside = data.marginOfSafety && data.marginOfSafety > 0 && data.marginOfSafety < 10
    ? ((1 / data.marginOfSafety) - 1) * 100
    : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Snapshot</h2>

      {/* Row 1: Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MetricTile
          label="Market Cap"
          value={formatCompact(data.marketCap)}
        />
        <MetricTile
          label="Valuation Range"
          value={
            data.valuationConservative != null && data.valuationOptimistic != null && shares
              ? `${formatCompact(data.valuationConservative * shares)} – ${formatCompact(data.valuationOptimistic * shares)}`
              : 'N/A'
          }
          small
        />
        <MetricTile
          label="Margin of Safety"
          value={mosUpside != null ? `${mosUpside >= 0 ? '+' : ''}${mosUpside.toFixed(0)}%` : 'N/A'}
          sublabel={data.buyBelowPrice ? `Buy below ${formatPrice(data.buyBelowPrice)}` : undefined}
          color={data.hasMarginOfSafety ? 'text-green-600' : mosUpside != null && mosUpside < 0 ? 'text-red-500' : 'text-orange-500'}
        />
        <MetricTile
          label="Years to Payback"
          value={yearsToPayback != null ? `${yearsToPayback.toFixed(1)}` : 'N/A'}
          sublabel="years"
          color={
            yearsToPayback != null && yearsToPayback <= 15 ? 'text-green-600'
              : yearsToPayback != null && yearsToPayback <= 25 ? 'text-yellow-600'
                : yearsToPayback != null ? 'text-red-500' : undefined
          }
        />
        <MetricTile
          label="Earnings Yield"
          value={data.ownerEarningsYield != null ? `${(data.ownerEarningsYield * 100).toFixed(1)}%` : 'N/A'}
          color={
            data.ownerEarningsYield != null && data.ownerEarningsYield >= 0.08 ? 'text-green-600'
              : data.ownerEarningsYield != null && data.ownerEarningsYield >= 0.04 ? 'text-yellow-600'
                : data.ownerEarningsYield != null ? 'text-red-500' : undefined
          }
        />
        <MetricTile
          label="Quality"
          value={data.qualityGrade || 'N/A'}
          sublabel={data.qualityScore != null ? `${data.qualityScore}/100` : undefined}
          color={
            data.qualityGrade === 'A' || data.qualityGrade === 'B' ? 'text-green-600'
              : data.qualityGrade === 'C' ? 'text-yellow-600'
                : data.qualityGrade === 'D' || data.qualityGrade === 'F' ? 'text-red-500' : undefined
          }
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <MiniBarChart
          title="Revenue"
          data={data.revenueHistory}
          color="#3b82f6"
        />
        <MiniBarChart
          title="Earnings"
          data={data.earningsHistory}
          color="#22c55e"
          allowNegative
        />
      </div>

      {/* Row 3: Price info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FiftyTwoWeekRange
          low={data.fiftyTwoWeekLow}
          high={data.fiftyTwoWeekHigh}
          current={data.currentPrice}
        />
        <PriceSparkline
          data={data.priceHistoryMonthly}
          currentPrice={data.currentPrice}
        />
      </div>
    </div>
  )
}

// --- Metric Tile ---

function MetricTile({
  label,
  value,
  sublabel,
  color,
  small,
}: {
  label: string
  value: string
  sublabel?: string
  color?: string
  small?: boolean
}) {
  return (
    <div className="text-center px-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold ${color || 'text-gray-900'} leading-tight`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>
      )}
    </div>
  )
}

// --- Mini Bar Chart (Revenue / Earnings) ---

function MiniBarChart({
  title,
  data,
  color,
  allowNegative,
}: {
  title: string
  data: YearValue[]
  color: string
  allowNegative?: boolean
}) {
  if (data.length === 0) {
    return (
      <div className="border border-gray-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-6">No data available</p>
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => a.year - b.year)

  // Calculate CAGR if we have at least 2 years
  let cagr: number | null = null
  if (sorted.length >= 2) {
    const first = sorted[0].value
    const last = sorted[sorted.length - 1].value
    const years = sorted.length - 1
    if (first > 0 && last > 0 && years > 0) {
      cagr = (Math.pow(last / first, 1 / years) - 1) * 100
    }
  }

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {cagr != null && (
          <span className={`text-xs font-medium ${cagr >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            CAGR {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={sorted} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={compactAxis} width={50} axisLine={false} tickLine={false} />
          <Tooltip content={<BarTooltip title={title} />} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {sorted.map((entry, index) => (
              <Cell
                key={index}
                fill={allowNegative && entry.value < 0 ? '#ef4444' : color}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarTooltip({ active, payload, label, title }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  title: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-gray-600">{title}: {formatCompactSigned(payload[0].value)}</p>
    </div>
  )
}

// --- 52-Week Range ---

function FiftyTwoWeekRange({
  low,
  high,
  current,
}: {
  low: number | null
  high: number | null
  current: number | null
}) {
  if (low == null || high == null || current == null || high <= low) {
    return (
      <div className="border border-gray-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">52-Week Range</h3>
        <p className="text-sm text-gray-400 text-center py-4">No data available</p>
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">52-Week Range</h3>
      <div className="relative pt-6 pb-2">
        {/* Bar */}
        <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full" />
        {/* Current price marker */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-xs font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
            {formatPrice(current)}
          </span>
          <div className="w-0.5 h-3 bg-gray-800 mt-0.5" />
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatPrice(low)}</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  )
}

// --- 5-Year Price Sparkline ---

function PriceSparkline({
  data,
  currentPrice,
}: {
  data: PricePoint[]
  currentPrice: number | null
}) {
  if (data.length < 2) {
    return (
      <div className="border border-gray-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Price History</h3>
        <p className="text-sm text-gray-400 text-center py-4">No data available</p>
      </div>
    )
  }

  const first = data[0].price
  const last = data[data.length - 1].price
  const totalReturn = first > 0 ? ((last - first) / first) * 100 : null
  const isPositive = totalReturn != null && totalReturn >= 0

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Price History</h3>
        {totalReturn != null && (
          <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{totalReturn.toFixed(0)}% total
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.2} />
              <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 5) - 1)}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => formatPrice(v)}
            width={55}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<PriceTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth={1.5}
            fill="url(#priceGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PriceTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{formatPrice(payload[0].value)}</p>
    </div>
  )
}

// --- Helpers ---

function formatCompact(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return 'N/A'
  const abs = Math.abs(val)
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(0)}K`
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

function formatPrice(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return 'N/A'
  if (Math.abs(val) >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${val.toFixed(2)}`
}
