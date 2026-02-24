'use client'

import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { formatCurrency } from '@/types/mosee'

interface EarningsDataPoint {
  year: number
  net_income: number
  conservative?: number
  optimistic?: number
}

interface EarningsChartProps {
  historicalEarnings: EarningsDataPoint[]
  padProjections: EarningsDataPoint[]
  dcfProjections: EarningsDataPoint[]
  netIncomeAverage: number
  growthRate: number
}

// Custom tooltip formatter
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<{ name: string; value: number; color: string; dataKey: string; payload: any }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  // Filter out internal range fields
  const displayEntries = payload.filter(entry =>
    !entry.dataKey?.includes('_conservative') &&
    !entry.dataKey?.includes('_band')
  )

  // Build range lookup from the full data point
  const dataPoint = payload[0]?.payload
  const padCons = dataPoint?.pad_conservative
  const padBand = dataPoint?.pad_band
  const dcfCons = dataPoint?.dcf_conservative
  const dcfBand = dataPoint?.dcf_band

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {displayEntries.map((entry, index) => (
        <div key={index}>
          <p className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
          {entry.dataKey === 'pad' && padCons != null && padBand != null && padBand > 0 && (
            <p className="text-xs text-gray-500 ml-2">
              Range: {formatCurrency(padCons)} &ndash; {formatCurrency(padCons + padBand)}
            </p>
          )}
          {entry.dataKey === 'dcf' && dcfCons != null && dcfBand != null && dcfBand > 0 && (
            <p className="text-xs text-gray-500 ml-2">
              Range: {formatCurrency(dcfCons)} &ndash; {formatCurrency(dcfCons + dcfBand)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export function EarningsChart({
  historicalEarnings,
  padProjections,
  dcfProjections,
  netIncomeAverage,
  growthRate
}: EarningsChartProps) {
  // Combine all data for the chart
  const combinedData = [
    ...historicalEarnings.map(d => ({
      year: d.year,
      historical: d.net_income,
      type: 'historical'
    })),
    ...padProjections.map((d, i) => {
      const dcf = dcfProjections[i]
      const padCons = d.conservative ?? d.net_income
      const padOpt = d.optimistic ?? d.net_income
      const dcfBase = dcf?.net_income ?? 0
      const dcfCons = dcf?.conservative ?? dcfBase
      const dcfOpt = dcf?.optimistic ?? dcfBase
      return {
        year: d.year,
        pad: d.net_income,
        dcf: dcfBase,
        // PAD range band (stacked area: invisible base + visible band)
        pad_conservative: padCons,
        pad_band: padOpt - padCons,
        // DCF range band
        dcf_conservative: dcfCons,
        dcf_band: dcfOpt - dcfCons,
        type: 'projected'
      }
    })
  ]

  // Sort by year
  combinedData.sort((a, b) => a.year - b.year)

  // Format large numbers for Y axis
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(0)}B`
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(0)}M`
    }
    return `$${value.toFixed(0)}`
  }

  // Get the dividing year between historical and projected
  const lastHistoricalYear = historicalEarnings.length > 0
    ? Math.max(...historicalEarnings.map(d => d.year))
    : 2024

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={combinedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
          />

          {/* Reference line for average */}
          {netIncomeAverage > 0 && (
            <ReferenceLine
              y={netIncomeAverage}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              label={{
                value: `Avg: ${formatCurrency(netIncomeAverage)}`,
                position: 'right',
                fontSize: 11,
                fill: '#6b7280'
              }}
            />
          )}

          {/* Reference line between historical and projected */}
          <ReferenceLine
            x={lastHistoricalYear + 0.5}
            stroke="#d1d5db"
            strokeDasharray="3 3"
          />

          {/* PAD confidence band (stacked area trick: transparent base + visible band) */}
          <Area
            dataKey="pad_conservative"
            stackId="padRange"
            fill="transparent"
            stroke="none"
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="pad_band"
            stackId="padRange"
            fill="#22c55e"
            fillOpacity={0.12}
            stroke="none"
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
          />

          {/* DCF confidence band */}
          <Area
            dataKey="dcf_conservative"
            stackId="dcfRange"
            fill="transparent"
            stroke="none"
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="dcf_band"
            stackId="dcfRange"
            fill="#f97316"
            fillOpacity={0.12}
            stroke="none"
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
          />

          {/* Historical earnings (bars) */}
          <Bar
            dataKey="historical"
            name="Historical Net Income"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />

          {/* PAD projection (line) */}
          <Line
            dataKey="pad"
            name="PAD Projection (Compound Growth)"
            type="monotone"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 4, fill: '#22c55e' }}
            connectNulls
          />

          {/* DCF projection (line) */}
          <Line
            dataKey="dcf"
            name="DCF Projection (Linear Regression)"
            type="monotone"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 4, fill: '#f97316' }}
            strokeDasharray="5 5"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">PAD Valuation</h4>
          <p className="text-green-700 text-xs leading-relaxed">
            Projects future earnings using average net income ({formatCurrency(netIncomeAverage)})
            with compound growth rate ({(growthRate * 100).toFixed(1)}% per year).
            Discounts future cash flows at 4% risk-free rate.
          </p>
          <p className="text-green-600 text-xs mt-1 italic">
            Shaded range: conservative (90% base, 70% growth) to optimistic (110% base, 120% growth).
          </p>
          <p className="text-green-600 text-xs mt-2 font-mono">
            Value = &Sigma; (AvgIncome &times; (1+growth)^n) / (1+r)^n
          </p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <h4 className="font-medium text-orange-800 mb-2">DCF Valuation</h4>
          <p className="text-orange-700 text-xs leading-relaxed">
            Uses weighted linear regression on historical earnings to predict
            future cash flows. More recent years weighted higher (1.25x decay).
            Discounts at 4% risk-free rate.
          </p>
          <p className="text-orange-600 text-xs mt-1 italic">
            Shaded range widens over time to reflect increasing forecast uncertainty (10-28% band).
          </p>
          <p className="text-orange-600 text-xs mt-2 font-mono">
            Value = &Sigma; predicted_CF_n / (1+r)^n
          </p>
        </div>
      </div>
    </div>
  )
}

interface EarningsKeyMetricsProps {
  netIncomeAverage: number
  growthRate: number
  latestEarnings: number
  padValue: number
  dcfValue: number
  bookValue: number
  marketCap: number
}

export function EarningsKeyMetrics({
  netIncomeAverage,
  growthRate,
  latestEarnings,
  padValue,
  dcfValue,
  bookValue,
  marketCap
}: EarningsKeyMetricsProps) {
  const yearsToPayback = netIncomeAverage > 0 ? marketCap / netIncomeAverage : null

  return (
    <div className="space-y-4">
      {/* Core Earnings Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Average Net Income</div>
          <div className="text-xl font-bold text-blue-900">{formatCurrency(netIncomeAverage)}</div>
          <div className="text-xs text-blue-600 mt-1">
            Based on {growthRate >= 0 ? 'growing' : 'declining'} at {(Math.abs(growthRate) * 100).toFixed(1)}%/yr
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-xs text-purple-600 uppercase tracking-wide mb-1">Latest Annual Earnings</div>
          <div className="text-xl font-bold text-purple-900">{formatCurrency(latestEarnings)}</div>
          <div className="text-xs text-purple-600 mt-1">
            Most recent full year
          </div>
        </div>
      </div>

      {/* Valuation Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Valuation Methods</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">PAD (Compound Growth)</span>
            <span className="font-medium">{formatCurrency(padValue)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">DCF (Linear Regression)</span>
            <span className="font-medium">{formatCurrency(dcfValue)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Book Value</span>
            <span className="font-medium">{formatCurrency(bookValue)}</span>
          </div>
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between items-center text-sm">
            <span className="text-gray-600">Current Market Cap</span>
            <span className="font-medium">{formatCurrency(marketCap)}</span>
          </div>
        </div>
      </div>

      {/* Years to Payback */}
      {yearsToPayback && yearsToPayback > 0 && yearsToPayback < 500 && (
        <div className={`rounded-lg p-4 ${
          yearsToPayback <= 10 ? 'bg-green-50' :
          yearsToPayback <= 20 ? 'bg-yellow-50' : 'bg-red-50'
        }`}>
          <div className={`text-xs uppercase tracking-wide mb-1 ${
            yearsToPayback <= 10 ? 'text-green-600' :
            yearsToPayback <= 20 ? 'text-yellow-600' : 'text-red-600'
          }`}>Years to Payback (at avg earnings)</div>
          <div className={`text-2xl font-bold ${
            yearsToPayback <= 10 ? 'text-green-900' :
            yearsToPayback <= 20 ? 'text-yellow-900' : 'text-red-900'
          }`}>
            {yearsToPayback.toFixed(1)} years
          </div>
          <div className={`text-xs mt-1 ${
            yearsToPayback <= 10 ? 'text-green-600' :
            yearsToPayback <= 20 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {yearsToPayback <= 10 ? 'Strong earnings power' :
             yearsToPayback <= 20 ? 'Moderate earnings power' : 'Weak earnings power'}
          </div>
        </div>
      )}
    </div>
  )
}
