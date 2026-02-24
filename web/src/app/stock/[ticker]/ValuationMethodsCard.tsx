'use client'

import { useState } from 'react'
import {
  formatCurrency,
  formatMoS,
  StockAnalysis,
  ValuationRangeDetail,
  ValuationRangeScenario,
  OwnerEarningsScenario,
  ValuationBreakdown,
  BookValueBreakdown,
} from '@/types/mosee'
import {
  InputsTable,
  CalculationChain,
  YearByYearTable,
  BookValueSection,
} from './ValuationBasisSection'

// ============================================================================
// Types & config
// ============================================================================

interface MethodData {
  key: string
  displayName: string
  // Dollar values
  intrinsicValueTotal: number | null // total company value
  intrinsicValuePerShare: number | null
  impliedMarketCap: number | null
  upsidePercent: number | null
  // Range (from valuation_range_details if available)
  conservative: number | null
  base: number | null
  optimistic: number | null
  conservativeMcap: number | null
  baseMcap: number | null
  optimisticMcap: number | null
  // Scores
  mos: number | null
  mosee: number | null
  confidence: string | null
  // Key inputs summary
  keyInputs: string | null
  // Drill-down data sources
  basisData: ValuationBreakdown | null
  bookData: BookValueBreakdown | null
  rangeDetail: ValuationRangeDetail | null
}

// ============================================================================
// Helpers
// ============================================================================

function formatPct(val: number | null): string {
  if (val == null) return ''
  return `${val > 0 ? '+' : ''}${val.toFixed(0)}%`
}

function pctColor(val: number | null): string {
  if (val == null) return 'text-gray-400'
  if (val > 0) return 'text-green-600'
  if (val < -10) return 'text-red-600'
  return 'text-orange-500'
}

function mosColor(mos: number | null): string {
  if (mos == null || !isFinite(mos)) return 'text-gray-500'
  if (mos < 0.5) return 'text-green-600'
  if (mos < 0.75) return 'text-emerald-600'
  if (mos < 1.0) return 'text-yellow-600'
  return 'text-red-600'
}

// ============================================================================
// Method card (one per valuation method)
// ============================================================================

function MethodCard({
  method,
  currentPrice,
  marketCap,
  isExpanded,
  onToggle,
}: {
  method: MethodData
  currentPrice: number | null
  marketCap: number | null
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasRange = method.conservative != null && method.base != null && method.optimistic != null
  const hasValue = method.intrinsicValuePerShare != null && method.intrinsicValuePerShare > 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* ── Header bar ── */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              &#9654;
            </span>
            <h3 className="font-bold text-gray-900">{method.displayName}</h3>
            {method.confidence && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                {method.confidence}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {method.mos != null && (
              <div className="text-right">
                <div className="text-xs text-gray-500">MoS</div>
                <div className={`text-sm font-bold ${mosColor(method.mos)}`}>
                  {formatMoS(method.mos)}
                </div>
              </div>
            )}
            {method.mosee != null && isFinite(method.mosee) && (
              <div className="text-right">
                <div className="text-xs text-gray-500">MOSEE</div>
                <div className="text-sm font-bold text-gray-900">{method.mosee.toFixed(3)}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Value & Market Cap row (always visible) ── */}
        {hasValue ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <span className="text-xs text-gray-500">Intrinsic Value: </span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(method.intrinsicValuePerShare)}
              </span>
              <span className="text-sm text-gray-500">/share</span>
            </div>
            {method.impliedMarketCap != null && (
              <div>
                <span className="text-xs text-gray-500">Implied Mkt Cap: </span>
                <span className="text-sm font-semibold text-gray-800">
                  {formatCurrency(method.impliedMarketCap)}
                </span>
                {method.upsidePercent != null && (
                  <span className={`ml-1 text-sm font-semibold ${pctColor(method.upsidePercent)}`}>
                    ({formatPct(method.upsidePercent)})
                  </span>
                )}
              </div>
            )}
            {currentPrice != null && method.intrinsicValuePerShare != null && (
              <div className="text-xs text-gray-400">
                vs current {formatCurrency(currentPrice)}/share
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            Insufficient data for this valuation method
          </div>
        )}

        {/* ── 3-scenario row (when range details exist) ── */}
        {hasRange && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <ScenarioBox
              label="Conservative"
              perShare={method.conservative!}
              mcap={method.conservativeMcap}
              marketCap={marketCap}
              color="red"
            />
            <ScenarioBox
              label="Base"
              perShare={method.base!}
              mcap={method.baseMcap}
              marketCap={marketCap}
              color="yellow"
            />
            <ScenarioBox
              label="Optimistic"
              perShare={method.optimistic!}
              mcap={method.optimisticMcap}
              marketCap={marketCap}
              color="green"
            />
          </div>
        )}

        {/* ── Key inputs teaser ── */}
        {method.keyInputs && (
          <div className="mt-2 text-xs text-gray-500">
            {method.keyInputs}
          </div>
        )}
      </button>

      {/* ── Expanded drill-down ── */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
          <h4 className="text-sm font-bold text-gray-800 mb-3">
            How We Calculated: {method.displayName}
          </h4>
          <DrillDown method={method} />
        </div>
      )}
    </div>
  )
}

function ScenarioBox({
  label,
  perShare,
  mcap,
  marketCap,
  color,
}: {
  label: string
  perShare: number
  mcap: number | null
  marketCap: number | null
  color: 'red' | 'yellow' | 'green'
}) {
  const bg = { red: 'bg-red-50', yellow: 'bg-yellow-50', green: 'bg-green-50' }[color]
  const text = { red: 'text-red-700', yellow: 'text-yellow-700', green: 'text-green-700' }[color]
  const labelColor = { red: 'text-red-600', yellow: 'text-yellow-600', green: 'text-green-600' }[color]
  const upside = mcap != null && marketCap ? ((mcap - marketCap) / marketCap) * 100 : null

  return (
    <div className={`${bg} rounded-lg p-2.5 text-center`}>
      <div className={`text-xs font-medium ${labelColor}`}>{label}</div>
      <div className={`text-sm font-bold ${text}`}>{formatCurrency(perShare)}/sh</div>
      {mcap != null && (
        <div className="text-xs text-gray-600">{formatCurrency(mcap)}</div>
      )}
      {upside != null && (
        <div className={`text-xs font-semibold ${pctColor(upside)}`}>{formatPct(upside)}</div>
      )}
    </div>
  )
}

// ============================================================================
// Drill-down content (shown when a card is expanded)
// ============================================================================

function DrillDown({ method }: { method: MethodData }) {
  const rangeDetail = method.rangeDetail
  const basisData = method.basisData
  const bookData = method.bookData

  // Route to the right drill-down
  if (method.key === 'pad' || method.key === 'quality-adjusted p/e') {
    return <PADDrillDown rangeDetail={rangeDetail} basisData={basisData} />
  }
  if (method.key === 'dcf') {
    return <DCFDrillDown rangeDetail={rangeDetail} basisData={basisData} />
  }
  if (method.key === 'book' || method.key === 'quality-adjusted book value') {
    return <BookDrillDown rangeDetail={rangeDetail} bookData={bookData} />
  }
  if (method.key === 'owner earnings (buffett)') {
    return <OwnerEarningsDrillDown rangeDetail={rangeDetail} />
  }

  // Generic fallback: show whatever basis data exists
  if (basisData) {
    return (
      <div className="space-y-3">
        <InputsTable inputs={basisData.inputs} />
        <YearByYearTable rows={basisData.year_by_year} />
        <TotalPVBadge value={basisData.total_present_value} />
      </div>
    )
  }

  return <p className="text-sm text-gray-500">No calculation details available. Re-analyse this stock to see full breakdown.</p>
}

function TotalPVBadge({ value, label = 'Total Present Value' }: { value: number | null | undefined; label?: string }) {
  if (value == null) return null
  return (
    <div className="flex justify-end mt-3">
      <div className="bg-green-50 px-4 py-2 rounded-lg">
        <span className="text-xs text-green-600">{label}: </span>
        <span className="text-sm font-bold text-green-800">{formatCurrency(value)}</span>
      </div>
    </div>
  )
}

// ── PAD (Quality-Adjusted P/E) drill-down ──

function PADDrillDown({
  rangeDetail,
  basisData,
}: {
  rangeDetail: ValuationRangeDetail | null
  basisData: ValuationBreakdown | null
}) {
  const assumptions = rangeDetail?.assumptions || {}
  const calcChain = assumptions.calculation_chain as string[] | undefined

  // Build inputs from range detail assumptions (the intelligence engine inputs)
  const rangeInputs: Record<string, number | string> = {}
  if (assumptions.eps != null) rangeInputs['EPS'] = `$${(assumptions.eps as number).toFixed(2)}`
  if (assumptions.industry_pe != null) rangeInputs['Industry P/E'] = `${assumptions.industry_pe}x`
  if (assumptions.quality_score != null) rangeInputs['Quality Score'] = (assumptions.quality_score as number).toFixed(0)
  if (assumptions.quality_multiple != null) rangeInputs['Quality Multiple'] = `${assumptions.quality_multiple}x`
  if (assumptions.growth_rate != null) rangeInputs['Growth Rate'] = `${((assumptions.growth_rate as number) * 100).toFixed(1)}%`
  if (assumptions.growth_multiple != null) rangeInputs['Growth Multiple'] = `${assumptions.growth_multiple}x`
  if (assumptions.fair_pe != null) rangeInputs['Fair P/E'] = `${(assumptions.fair_pe as number).toFixed(1)}x`

  return (
    <div className="space-y-4">
      {/* Range detail inputs + calculation chain */}
      {Object.keys(rangeInputs).length > 0 && <InputsTable inputs={rangeInputs} />}
      {calcChain && <CalculationChain steps={calcChain} />}

      {/* PAD year-by-year projections (from valuation_basis) */}
      {basisData && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Earnings Projections (PAD — Compound Growth)
          </div>
          <InputsTable inputs={basisData.inputs} />
          <YearByYearTable rows={basisData.year_by_year} cashFlowLabel="Projected Cash Flow" />
          <TotalPVBadge value={basisData.total_present_value} />
        </div>
      )}
    </div>
  )
}

// ── DCF drill-down ──

function DCFDrillDown({
  rangeDetail,
  basisData,
}: {
  rangeDetail: ValuationRangeDetail | null
  basisData: ValuationBreakdown | null
}) {
  const [activeScenario, setActiveScenario] = useState<string>('base')

  const assumptions = rangeDetail?.assumptions || {}
  const scenarios = assumptions.scenarios as Record<string, ValuationRangeScenario> | undefined

  // Range detail inputs
  const rangeInputs: Record<string, number | string> = {}
  if (assumptions.base_cashflow != null) rangeInputs['Base Cash Flow'] = assumptions.base_cashflow as number
  if (assumptions.growth_rate != null) rangeInputs['Growth Rate'] = assumptions.growth_rate as number
  if (assumptions.discount_rate != null) rangeInputs['Discount Rate'] = assumptions.discount_rate as number
  if (assumptions.terminal_growth != null) rangeInputs['Terminal Growth'] = assumptions.terminal_growth as number
  if (assumptions.years != null) rangeInputs['Projection Years'] = assumptions.years as number
  if (assumptions.shares_outstanding != null) rangeInputs['Shares Outstanding'] = formatCurrency(assumptions.shares_outstanding as number)

  const scenarioOrder = ['conservative', 'base', 'optimistic'] as const
  const scenarioColors: Record<string, string> = {
    conservative: 'border-red-300 bg-red-50 text-red-700',
    base: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    optimistic: 'border-green-300 bg-green-50 text-green-700',
  }
  const activeColorMap: Record<string, string> = {
    conservative: 'bg-red-600 text-white',
    base: 'bg-yellow-600 text-white',
    optimistic: 'bg-green-600 text-white',
  }

  const currentScenario = scenarios?.[activeScenario]

  return (
    <div className="space-y-4">
      {Object.keys(rangeInputs).length > 0 && <InputsTable inputs={rangeInputs} />}

      {/* Scenario switcher + year-by-year (from range details) */}
      {scenarios && (
        <>
          <div className="flex gap-2">
            {scenarioOrder.map((s) => (
              <button
                key={s}
                onClick={() => setActiveScenario(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  activeScenario === s ? activeColorMap[s] : scenarioColors[s]
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {currentScenario && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
                {'cashflow_adj' in currentScenario && (
                  <>
                    <span>Cash Flow: <span className="font-medium text-gray-900">{currentScenario.cashflow_adj}</span></span>
                    <span>Growth: <span className="font-medium text-gray-900">{currentScenario.growth_adj}</span></span>
                    <span>Discount: <span className="font-medium text-gray-900">{currentScenario.discount_adj}</span></span>
                  </>
                )}
              </div>
              {currentScenario.year_by_year?.length > 0 && (
                <YearByYearTable
                  rows={currentScenario.year_by_year.map((row) => ({
                    year: row.year,
                    future_cf: row.future_cf,
                    discount_factor: row.discount_factor,
                    present_value: row.present_value,
                  }))}
                  cashFlowLabel="Future Cash Flow"
                />
              )}
              <div className="mt-3 flex flex-wrap gap-4 justify-end">
                {currentScenario.terminal_pv_per_share != null && (
                  <div className="bg-purple-50 px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-purple-600">Terminal PV/Share: </span>
                    <span className="text-sm font-bold text-purple-800">{formatCurrency(currentScenario.terminal_pv_per_share)}</span>
                  </div>
                )}
                {currentScenario.value_per_share != null && (
                  <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-green-600">Value/Share: </span>
                    <span className="text-sm font-bold text-green-800">{formatCurrency(currentScenario.value_per_share)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Fallback: show basis data if no scenario data */}
      {!scenarios && basisData && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            DCF Projections (Linear Regression)
          </div>
          <InputsTable inputs={basisData.inputs} />
          <YearByYearTable rows={basisData.year_by_year} />
          <TotalPVBadge value={basisData.total_present_value} />
        </div>
      )}
    </div>
  )
}

// ── Book Value drill-down ──

function BookDrillDown({
  rangeDetail,
  bookData,
}: {
  rangeDetail: ValuationRangeDetail | null
  bookData: BookValueBreakdown | null
}) {
  const assumptions = rangeDetail?.assumptions || {}
  const calcChain = assumptions.calculation_chain as string[] | undefined

  const rangeInputs: Record<string, number | string> = {}
  if (assumptions.book_value_per_share != null) rangeInputs['Book Value/Share'] = `$${(assumptions.book_value_per_share as number).toFixed(2)}`
  if (assumptions.roe != null) rangeInputs['ROE'] = `${((assumptions.roe as number) * 100).toFixed(1)}%`
  if (assumptions.roe_multiple != null) rangeInputs['ROE Multiple'] = `${assumptions.roe_multiple}x`
  if (assumptions.quality_score != null) rangeInputs['Quality Score'] = (assumptions.quality_score as number).toFixed(0)
  if (assumptions.quality_adjustment != null) rangeInputs['Quality Adj.'] = `${assumptions.quality_adjustment}x`
  if (assumptions.fair_pb_multiple != null) rangeInputs['Fair P/B'] = `${(assumptions.fair_pb_multiple as number).toFixed(2)}x`

  return (
    <div className="space-y-4">
      {Object.keys(rangeInputs).length > 0 && <InputsTable inputs={rangeInputs} />}
      {calcChain && <CalculationChain steps={calcChain} />}
      {bookData && <BookValueSection data={bookData} />}
    </div>
  )
}

// ── Owner Earnings (Buffett) drill-down ──

function OwnerEarningsDrillDown({ rangeDetail }: { rangeDetail: ValuationRangeDetail | null }) {
  if (!rangeDetail) {
    return <p className="text-sm text-gray-500">Owner Earnings data requires re-analysis to display.</p>
  }

  const assumptions = rangeDetail.assumptions || {}
  const formula = assumptions.formula as string | undefined
  const scenarios = assumptions.scenarios as Record<string, OwnerEarningsScenario> | undefined

  const inputs: Record<string, number | string> = {}
  if (assumptions.owner_earnings_per_share != null) inputs['Owner Earnings/Share'] = `$${(assumptions.owner_earnings_per_share as number).toFixed(2)}`
  if (assumptions.growth_rate != null) inputs['Growth Rate'] = `${((assumptions.growth_rate as number) * 100).toFixed(1)}%`
  if (assumptions.required_return != null) inputs['Required Return'] = `${((assumptions.required_return as number) * 100).toFixed(1)}%`

  const scenarioOrder = ['conservative', 'base', 'optimistic'] as const
  const scenarioColorMap = {
    conservative: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    base: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    optimistic: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  }

  return (
    <div className="space-y-4">
      {formula && (
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Formula</div>
          <div className="text-sm font-mono text-amber-900">{formula}</div>
        </div>
      )}
      {Object.keys(inputs).length > 0 && <InputsTable inputs={inputs} />}
      {scenarios && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scenarioOrder.map((s) => {
            const scenario = scenarios[s]
            if (!scenario) return null
            const colors = scenarioColorMap[s]
            return (
              <div key={s} className={`${colors.bg} ${colors.border} border rounded-lg p-3`}>
                <div className={`text-xs font-semibold ${colors.text} uppercase tracking-wide mb-2 capitalize`}>{s}</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Owner Earnings</span><span className="font-mono font-medium">${scenario.owner_earnings}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Growth</span><span className="font-mono font-medium">{scenario.growth}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Required Return</span><span className="font-mono font-medium">{scenario.required_return}</span></div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-200">
                    <span className={`font-semibold ${colors.text}`}>Value/Share</span>
                    <span className={`font-mono font-bold ${colors.text}`}>{formatCurrency(scenario.value)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

interface ValuationMethodsCardProps {
  stock: StockAnalysis
}

export function ValuationMethodsCard({ stock }: ValuationMethodsCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const allMetrics = (stock.all_metrics || {}) as Record<string, unknown>
  const rangeDetails = allMetrics.valuation_range_details as {
    individual_valuations?: ValuationRangeDetail[]
  } | undefined
  const valuationBasis = allMetrics.valuation_basis as Record<string, ValuationBreakdown | BookValueBreakdown> | undefined
  const metricsShares = allMetrics.shares_outstanding as number | undefined

  // Build lookup from valuation_range_details
  const rangeLookup: Record<string, ValuationRangeDetail> = {}
  if (rangeDetails?.individual_valuations) {
    for (const v of rangeDetails.individual_valuations) {
      rangeLookup[v.method.toLowerCase()] = v
    }
  }

  // Calculate shares outstanding (prefer all_metrics, fallback to market_cap / price)
  const sharesOutstanding =
    metricsShares && metricsShares > 0
      ? metricsShares
      : stock.market_cap && stock.current_price && stock.current_price > 0
        ? stock.market_cap / stock.current_price
        : null

  // ── Build unified method data from all available sources ──
  const methods: MethodData[] = []

  // 1. PAD (Primary)
  const padBasis = valuationBasis?.pad as ValuationBreakdown | undefined
  const padRange = rangeLookup['quality-adjusted p/e'] || null
  const padTotal = padBasis?.total_present_value ?? null
  const padPerShare = padTotal && sharesOutstanding ? padTotal / sharesOutstanding : padRange?.base ?? null
  const padMcap = padPerShare && sharesOutstanding ? padPerShare * sharesOutstanding : padTotal
  methods.push(buildMethod({
    key: padRange ? 'quality-adjusted p/e' : 'pad',
    displayName: 'PAD (Quality-Adjusted P/E)',
    totalValue: padTotal,
    perShareValue: padPerShare,
    mcap: padMcap,
    marketCap: stock.market_cap,
    sharesOutstanding,
    mos: stock.pad_mos,
    mosee: stock.pad_mosee,
    rangeDetail: padRange,
    basisData: padBasis ?? null,
    bookData: null,
    keyInputsSummary: buildKeyInputs(padBasis?.inputs, padRange?.assumptions),
  }))

  // 2. DCF
  const dcfBasis = valuationBasis?.dcf as ValuationBreakdown | undefined
  const dcfRange = rangeLookup['dcf'] || null
  const dcfTotal = dcfBasis?.total_present_value ?? null
  const dcfPerShare = dcfTotal && sharesOutstanding ? dcfTotal / sharesOutstanding : dcfRange?.base ?? null
  const dcfMcap = dcfPerShare && sharesOutstanding ? dcfPerShare * sharesOutstanding : dcfTotal
  methods.push(buildMethod({
    key: dcfRange ? 'dcf' : 'dcf',
    displayName: 'DCF (Discounted Cash Flow)',
    totalValue: dcfTotal,
    perShareValue: dcfPerShare,
    mcap: dcfMcap,
    marketCap: stock.market_cap,
    sharesOutstanding,
    mos: stock.dcf_mos,
    mosee: stock.dcf_mosee,
    rangeDetail: dcfRange,
    basisData: dcfBasis ?? null,
    bookData: null,
    keyInputsSummary: buildKeyInputs(dcfBasis?.inputs, dcfRange?.assumptions),
  }))

  // 3. Book Value
  const bookBasis = valuationBasis?.book_value as BookValueBreakdown | undefined
  const bookRange = rangeLookup['quality-adjusted book value'] || null
  const bookTotal = bookBasis?.latest?.book_value ?? null
  const bookPerShare = bookTotal && sharesOutstanding ? bookTotal / sharesOutstanding : bookRange?.base ?? null
  const bookMcap = bookPerShare && sharesOutstanding ? bookPerShare * sharesOutstanding : bookTotal
  methods.push(buildMethod({
    key: bookRange ? 'quality-adjusted book value' : 'book',
    displayName: 'Book Value',
    totalValue: bookTotal,
    perShareValue: bookPerShare,
    mcap: bookMcap,
    marketCap: stock.market_cap,
    sharesOutstanding,
    mos: stock.book_mos,
    mosee: stock.book_mosee,
    rangeDetail: bookRange,
    basisData: null,
    bookData: bookBasis ?? null,
    keyInputsSummary: bookRange
      ? buildKeyInputs(null, bookRange.assumptions)
      : bookBasis?.latest
        ? `Assets: ${formatCurrency(bookBasis.latest.total_assets)} - Liabilities: ${formatCurrency(bookBasis.latest.total_liabilities)}`
        : null,
  }))

  // 4. Owner Earnings (only from range details)
  const oeRange = rangeLookup['owner earnings (buffett)'] || null
  if (oeRange) {
    methods.push(buildMethod({
      key: 'owner earnings (buffett)',
      displayName: 'Owner Earnings (Buffett)',
      totalValue: null,
      perShareValue: oeRange.base,
      mcap: oeRange.base && sharesOutstanding ? oeRange.base * sharesOutstanding : null,
      marketCap: stock.market_cap,
      sharesOutstanding,
      mos: null,
      mosee: null,
      rangeDetail: oeRange,
      basisData: null,
      bookData: null,
      keyInputsSummary: buildKeyInputs(null, oeRange.assumptions),
    }))
  }

  // Filter out methods with zero data
  const visibleMethods = methods.filter(
    (m) => m.intrinsicValuePerShare != null || m.mos != null || m.basisData != null || m.bookData != null || m.rangeDetail != null
  )

  if (visibleMethods.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Valuation Methods Comparison</h2>
        <p className="text-sm text-gray-500">No valuation data available. Run an analysis to see detailed breakdowns.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Valuation Methods Comparison</h2>
      <p className="text-sm text-gray-500 mb-2">
        How we valued this company using {visibleMethods.length} methods. Click any method to see the full calculation.
      </p>

      {/* Current reference bar */}
      {stock.market_cap && stock.current_price && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mb-4 pb-3 border-b border-gray-100">
          <div>Current Price: <span className="font-semibold text-gray-900">{formatCurrency(stock.current_price)}</span></div>
          <div>Market Cap: <span className="font-semibold text-gray-900">{formatCurrency(stock.market_cap)}</span></div>
          {sharesOutstanding && (
            <div>Shares: <span className="font-semibold text-gray-900">{formatCurrency(sharesOutstanding)}</span></div>
          )}
        </div>
      )}

      {/* Method cards */}
      <div className="space-y-3">
        {visibleMethods.map((method) => (
          <MethodCard
            key={method.key}
            method={method}
            currentPrice={stock.current_price}
            marketCap={stock.market_cap}
            isExpanded={expanded === method.key}
            onToggle={() => setExpanded(expanded === method.key ? null : method.key)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Builder helpers
// ============================================================================

function buildMethod(opts: {
  key: string
  displayName: string
  totalValue: number | null
  perShareValue: number | null
  mcap: number | null
  marketCap: number | null
  sharesOutstanding: number | null
  mos: number | null
  mosee: number | null
  rangeDetail: ValuationRangeDetail | null
  basisData: ValuationBreakdown | null
  bookData: BookValueBreakdown | null
  keyInputsSummary: string | null
}): MethodData {
  const r = opts.rangeDetail
  const sh = opts.sharesOutstanding
  const mk = opts.marketCap

  return {
    key: opts.key,
    displayName: opts.displayName,
    intrinsicValueTotal: opts.totalValue,
    intrinsicValuePerShare: opts.perShareValue,
    impliedMarketCap: opts.mcap,
    upsidePercent: opts.mcap != null && mk ? ((opts.mcap - mk) / mk) * 100 : null,
    conservative: r?.conservative ?? null,
    base: r?.base ?? null,
    optimistic: r?.optimistic ?? null,
    conservativeMcap: r?.conservative != null && sh ? r.conservative * sh : null,
    baseMcap: r?.base != null && sh ? r.base * sh : null,
    optimisticMcap: r?.optimistic != null && sh ? r.optimistic * sh : null,
    mos: opts.mos,
    mosee: opts.mosee,
    confidence: r?.confidence ?? null,
    keyInputs: opts.keyInputsSummary,
    basisData: opts.basisData,
    bookData: opts.bookData,
    rangeDetail: opts.rangeDetail,
  }
}

function buildKeyInputs(
  basisInputs: Record<string, number | string> | null | undefined,
  rangeAssumptions: Record<string, unknown> | null | undefined,
): string | null {
  const parts: string[] = []

  // From basis inputs
  if (basisInputs) {
    const dr = basisInputs.discount_rate ?? basisInputs.risk_free_rate
    if (dr != null) parts.push(`Discount: ${typeof dr === 'number' ? `${(dr * 100).toFixed(1)}%` : dr}`)
    const tg = basisInputs.terminal_growth
    if (tg != null) parts.push(`Terminal Growth: ${typeof tg === 'number' ? `${(tg * 100).toFixed(1)}%` : tg}`)
    const yrs = basisInputs.years
    if (yrs != null) parts.push(`${yrs}yr projection`)
  }

  // From range assumptions
  if (rangeAssumptions) {
    if (!parts.length && rangeAssumptions.discount_rate != null) {
      parts.push(`Discount: ${((rangeAssumptions.discount_rate as number) * 100).toFixed(1)}%`)
    }
    if (rangeAssumptions.fair_pe != null) parts.push(`Fair P/E: ${(rangeAssumptions.fair_pe as number).toFixed(1)}x`)
    if (rangeAssumptions.fair_pb_multiple != null) parts.push(`Fair P/B: ${(rangeAssumptions.fair_pb_multiple as number).toFixed(2)}x`)
    if (rangeAssumptions.formula != null) parts.push(rangeAssumptions.formula as string)
    if (!parts.length && rangeAssumptions.growth_rate != null) {
      parts.push(`Growth: ${((rangeAssumptions.growth_rate as number) * 100).toFixed(1)}%`)
    }
  }

  return parts.length > 0 ? parts.join(' · ') : null
}
