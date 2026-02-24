'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  formatCurrency,
  type StockAnalysis,
  type FinancialStatements,
  type YearlyDataPoint,
  type QualityBreakdown,
} from '@/types/mosee'

// ============================================================================
// Shared helpers
// ============================================================================

function formatYAxis(value: number) {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatPercentAxis(value: number) {
  return `${(value * 100).toFixed(0)}%`
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

function PercentTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {(entry.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

function ChartCard({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function NoDataNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
      {message}
    </div>
  )
}

/** Convert YearlyDataPoint[] to { year, value } sorted by year */
function toSorted(points: YearlyDataPoint[] | undefined): YearlyDataPoint[] {
  if (!Array.isArray(points) || points.length === 0) return []
  return [...points].sort((a, b) => a.year - b.year)
}

/** Merge multiple YearlyDataPoint[] series into a flat array keyed by year */
function mergeSeries(
  series: Record<string, YearlyDataPoint[]>
): Array<Record<string, number>> {
  const byYear: Record<number, Record<string, number>> = {}
  for (const [key, points] of Object.entries(series)) {
    for (const pt of toSorted(points)) {
      if (!byYear[pt.year]) byYear[pt.year] = { year: pt.year }
      byYear[pt.year][key] = pt.value
    }
  }
  return Object.values(byYear).sort((a, b) => a.year - b.year)
}

// ============================================================================
// Chart components
// ============================================================================

function RevenueEarningsChart({ data }: { data: FinancialStatements['income_statement'] }) {
  const merged = mergeSeries({
    Revenue: toSorted(data.revenue),
    'Gross Profit': toSorted(data.gross_profit),
    'Net Income': toSorted(data.net_income),
  })
  if (merged.length === 0) return <NoDataNotice message="No income statement data available" />

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={merged} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Gross Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Net Income" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MarginTrendsChart({ data }: { data: FinancialStatements['income_statement'] }) {
  const merged = mergeSeries({
    'Gross Margin': toSorted(data.gross_margin),
    'Operating Margin': toSorted(data.operating_margin),
    'Net Margin': toSorted(data.net_margin),
  })
  if (merged.length === 0) return <NoDataNotice message="No margin data available" />

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={merged} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={formatPercentAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={<PercentTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Line type="monotone" dataKey="Gross Margin" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Operating Margin" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Net Margin" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CashFlowChart({ data }: { data: FinancialStatements['cash_flow'] }) {
  const merged = mergeSeries({
    'Operating CF': toSorted(data.operating_cash_flow),
    CapEx: toSorted(data.capex),
    'Free CF': toSorted(data.free_cash_flow),
  })
  if (merged.length === 0) return <NoDataNotice message="No cash flow data available" />

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={merged} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Bar dataKey="Operating CF" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="CapEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Free CF" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function BalanceSheetChart({ data }: { data: FinancialStatements['balance_sheet'] }) {
  const merged = mergeSeries({
    'Total Assets': toSorted(data.total_assets),
    'Total Liabilities': toSorted(data.total_liabilities),
    'Stockholders Equity': toSorted(data.stockholders_equity),
  })
  if (merged.length === 0) return <NoDataNotice message="No balance sheet data available" />

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={merged} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Area type="monotone" dataKey="Total Assets" stroke="#3b82f6" fill="#3b82f680" strokeWidth={2} />
        <Area type="monotone" dataKey="Total Liabilities" stroke="#ef4444" fill="#ef444480" strokeWidth={2} />
        <Area type="monotone" dataKey="Stockholders Equity" stroke="#22c55e" fill="#22c55e80" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function OwnerEarningsChart({ data }: { data: FinancialStatements['owner_earnings'] }) {
  const merged = mergeSeries({
    'Net Income': toSorted(data.net_income),
    'Depreciation': toSorted(data.depreciation),
    'CapEx': toSorted(data.capex),
    'Owner Earnings': toSorted(data.owners_earnings),
  })
  if (merged.length === 0) return <NoDataNotice message="No owner earnings data available" />

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={merged} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Bar dataKey="Net Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Depreciation" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="CapEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Owner Earnings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const RADAR_COLORS: Record<string, string> = {
  graham: '#3b82f6',
  buffett: '#8b5cf6',
  lynch: '#10b981',
  greenblatt: '#f59e0b',
  fisher: '#f43f5e',
}

function QualityRadarChart({ breakdown }: { breakdown: QualityBreakdown }) {
  if (!breakdown.components || breakdown.components.length === 0) {
    return <NoDataNotice message="No quality score data available" />
  }

  const data = breakdown.components.map((c) => ({
    philosopher: c.name,
    score: c.score,
    fullMark: 100,
  }))

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="philosopher"
          tick={{ fontSize: 12, fill: '#374151' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
        />
        <Radar
          name="Quality Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number | undefined) => {
            if (value == null) return ['N/A', 'Score']
            return [`${value.toFixed(0)}/100`, 'Score']
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function ValuationComparisonChart({ stock }: { stock: StockAnalysis }) {
  const currentPrice = stock.current_price
  if (!currentPrice) return <NoDataNotice message="No price data available" />

  const methods = [
    { name: 'Conservative', value: stock.valuation_conservative, color: '#ef4444' },
    { name: 'Base', value: stock.valuation_base, color: '#f59e0b' },
    { name: 'Optimistic', value: stock.valuation_optimistic, color: '#22c55e' },
  ].filter((m) => m.value != null && m.value > 0)

  if (methods.length === 0) return <NoDataNotice message="No valuation data available" />

  const data = methods.map((m) => ({
    name: m.name,
    value: m.value!,
    color: m.color,
    upside: ((m.value! - currentPrice) / currentPrice) * 100,
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 60, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip
            formatter={(value: number | undefined) => {
              if (value == null) return ['N/A', 'Value']
              return [formatCurrency(value), 'Value']
            }}
          />
          <ReferenceLine x={currentPrice} stroke="#374151" strokeWidth={2} strokeDasharray="5 5" label={{
            value: `Current: ${formatCurrency(currentPrice)}`,
            position: 'top',
            fontSize: 11,
            fill: '#374151',
          }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Upside/downside labels */}
      <div className="flex justify-center gap-6 mt-2">
        {data.map((d) => (
          <div key={d.name} className="text-center">
            <div className="text-xs text-gray-500">{d.name}</div>
            <div className={`text-sm font-semibold ${d.upside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {d.upside >= 0 ? '+' : ''}{d.upside.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Main client component
// ============================================================================

interface PlotsClientProps {
  stock: StockAnalysis
}

export function PlotsClient({ stock }: PlotsClientProps) {
  const allMetrics = (stock.all_metrics || {}) as Record<string, unknown>
  const financials = allMetrics.financial_statements as FinancialStatements | undefined
  const qualityBreakdown = allMetrics.quality_breakdown as QualityBreakdown | undefined

  const hasFinancials = financials != null
  const hasIncomeStatement = hasFinancials && financials.income_statement != null
  const hasCashFlow = hasFinancials && financials.cash_flow != null
  const hasBalanceSheet = hasFinancials && financials.balance_sheet != null
  const hasOwnerEarnings = hasFinancials && financials.owner_earnings != null

  if (!hasFinancials && !qualityBreakdown) {
    return (
      <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-800">
        No financial data available for charts. Re-run the analysis to generate chart data.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Revenue & Earnings */}
      {hasIncomeStatement && (
        <ChartCard
          title="Revenue & Earnings"
          description="Historical revenue, gross profit, and net income trends."
        >
          <RevenueEarningsChart data={financials!.income_statement} />
        </ChartCard>
      )}

      {/* Margin Trends */}
      {hasIncomeStatement && (
        <ChartCard
          title="Margin Trends"
          description="Gross, operating, and net margin evolution over time."
        >
          <MarginTrendsChart data={financials!.income_statement} />
        </ChartCard>
      )}

      {/* Two-column layout for Cash Flow and Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasCashFlow && (
          <ChartCard
            title="Cash Flow"
            description="Operating cash flow, capital expenditure, and free cash flow."
          >
            <CashFlowChart data={financials!.cash_flow} />
          </ChartCard>
        )}

        {hasBalanceSheet && (
          <ChartCard
            title="Balance Sheet"
            description="Total assets, liabilities, and stockholders equity over time."
          >
            <BalanceSheetChart data={financials!.balance_sheet} />
          </ChartCard>
        )}
      </div>

      {/* Owner Earnings */}
      {hasOwnerEarnings && (
        <ChartCard
          title="Owner Earnings (Buffett)"
          description="Net income + depreciation - CapEx = owner earnings. The true cash a business generates for its owners."
        >
          <OwnerEarningsChart data={financials!.owner_earnings} />
        </ChartCard>
      )}

      {/* Two-column layout for Quality Radar and Valuation Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {qualityBreakdown && (
          <ChartCard
            title="Quality Score Breakdown"
            description="Multi-lens scoring: Graham, Buffett, Lynch, Fisher, Greenblatt."
          >
            <QualityRadarChart breakdown={qualityBreakdown} />
          </ChartCard>
        )}

        <ChartCard
          title="Valuation Comparison"
          description="Conservative, base, and optimistic valuations vs current price."
        >
          <ValuationComparisonChart stock={stock} />
        </ChartCard>
      </div>
    </div>
  )
}
