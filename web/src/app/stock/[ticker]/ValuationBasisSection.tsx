'use client'

import { useState } from 'react'
import {
  formatCurrency,
  StockAnalysis,
  YearByYearRow,
  ValuationBreakdown,
  BookValueBreakdown,
  FinancialStatements,
  YearlyDataPoint,
} from '@/types/mosee'

interface ValuationBasisSectionProps {
  stock: StockAnalysis
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <span className="text-gray-400 text-lg">{open ? '-' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}

export function InputsTable({ inputs }: { inputs: Record<string, number | string> }) {
  return (
    <div className="mt-3 bg-blue-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
        Inputs / Assumptions
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(inputs).map(([key, val]) => (
          <div key={key}>
            <div className="text-xs text-blue-600">
              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </div>
            <div className="text-sm font-medium text-blue-900">
              {typeof val === 'number'
                ? Math.abs(val) < 1
                  ? `${(val * 100).toFixed(1)}%`
                  : formatCurrency(val)
                : val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function YearByYearTable({
  rows,
  cashFlowLabel = 'Future Cash Flow',
}: {
  rows: YearByYearRow[]
  cashFlowLabel?: string
}) {
  if (!rows || rows.length === 0) return null

  const first = rows[0]
  const hasFutureCF = first.future_cash_flow != null
  const hasProjectedCF = first.projected_cash_flow != null
  const hasFutureCFShort = first.future_cf != null
  const cfField = hasFutureCF ? 'future_cash_flow' : hasProjectedCF ? 'projected_cash_flow' : hasFutureCFShort ? 'future_cf' : null
  const hasCumulativePV = first.cumulative_pv != null

  const getCashFlow = (row: YearByYearRow): number | undefined => {
    if (hasFutureCF) return row.future_cash_flow
    if (hasProjectedCF) return row.projected_cash_flow
    if (hasFutureCFShort) return row.future_cf
    return undefined
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Year</th>
            {cfField && (
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                {cashFlowLabel}
              </th>
            )}
            <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
              Discount Factor
            </th>
            <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
              Present Value
            </th>
            {hasCumulativePV && (
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                Cumulative PV
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-1.5 px-2 text-gray-700">{row.year}</td>
              {cfField && (
                <td className="py-1.5 px-2 text-right text-gray-900 font-mono">
                  {formatCurrency(getCashFlow(row))}
                </td>
              )}
              <td className="py-1.5 px-2 text-right text-gray-600 font-mono">
                {row.discount_factor?.toFixed(4)}
              </td>
              <td className="py-1.5 px-2 text-right text-gray-900 font-mono">
                {formatCurrency(row.present_value)}
              </td>
              {hasCumulativePV && (
                <td className="py-1.5 px-2 text-right text-gray-700 font-mono">
                  {formatCurrency(row.cumulative_pv)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CalculationChain({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 bg-amber-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
        Calculation Steps
      </div>
      <ol className="space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
            <span className="text-amber-600 font-medium min-w-[1.5rem]">{i + 1}.</span>
            <span className="font-mono text-xs leading-5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ValuationMethodBreakdown({
  title,
  breakdown,
}: {
  title: string
  breakdown: ValuationBreakdown
}) {
  return (
    <CollapsibleSection title={title}>
      <InputsTable inputs={breakdown.inputs} />
      <YearByYearTable rows={breakdown.year_by_year} />
      <div className="mt-3 flex justify-end">
        <div className="bg-green-50 px-4 py-2 rounded-lg">
          <span className="text-xs text-green-600">Total Present Value: </span>
          <span className="text-sm font-bold text-green-800">
            {formatCurrency(breakdown.total_present_value)}
          </span>
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function BookValueSection({ data }: { data: BookValueBreakdown }) {
  return (
    <CollapsibleSection title="Book Value Breakdown">
      <div className="mt-3 bg-blue-50 rounded-lg p-3">
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
          Latest (Assets - Liabilities = Book Value)
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-blue-600">Total Assets</div>
            <div className="text-sm font-bold text-blue-900">
              {formatCurrency(data.latest.total_assets)}
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-600">Total Liabilities</div>
            <div className="text-sm font-bold text-blue-900">
              {formatCurrency(data.latest.total_liabilities)}
            </div>
          </div>
          <div>
            <div className="text-xs text-green-600">Book Value</div>
            <div className="text-sm font-bold text-green-800">
              {formatCurrency(data.latest.book_value)}
            </div>
          </div>
        </div>
      </div>

      {data.historical && data.historical.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div className="text-xs text-gray-500 mb-2">Historical Trend</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Year</th>
                <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                  Total Assets
                </th>
                <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                  Total Liabilities
                </th>
                <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                  Book Value
                </th>
              </tr>
            </thead>
            <tbody>
              {data.historical.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-1.5 px-2 text-gray-700">{row.year}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(row.total_assets)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    {formatCurrency(row.total_liabilities)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-medium">
                    {formatCurrency(row.book_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  )
}

function YearlySeriesTable({
  title,
  series,
  columns,
}: {
  title: string
  series: Record<string, YearlyDataPoint[] | number | string>
  columns: Array<{ key: string; label: string; isPercent?: boolean }>
}) {
  // Get all years from the first non-empty series
  const years = new Set<number>()
  Object.values(series).forEach((s) => {
    if (Array.isArray(s)) {
      s.forEach((dp) => years.add(dp.year))
    }
  })
  const sortedYears = Array.from(years).sort()

  if (sortedYears.length === 0) return null

  // Build lookup: series_key -> year -> value
  const lookup: Record<string, Record<number, number>> = {}
  for (const col of columns) {
    lookup[col.key] = {}
    const s = series[col.key]
    if (Array.isArray(s)) {
      s.forEach((dp) => {
        lookup[col.key][dp.year] = dp.value
      })
    }
  }

  return (
    <CollapsibleSection title={title}>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Year</th>
              {columns.map((col) => (
                <th key={col.key} className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((year, i) => (
              <tr key={year} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-1.5 px-2 text-gray-700">{year}</td>
                {columns.map((col) => {
                  const val = lookup[col.key]?.[year]
                  return (
                    <td key={col.key} className="py-1.5 px-2 text-right font-mono text-gray-900">
                      {val != null
                        ? col.isPercent
                          ? `${(val * 100).toFixed(1)}%`
                          : formatCurrency(val)
                        : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

function OwnerEarningsSection({
  data,
}: {
  data: FinancialStatements['owner_earnings']
}) {
  const years = new Set<number>()
  const allSeries = [data.net_income, data.depreciation, data.capex, data.owners_earnings]
  allSeries.forEach((s) => {
    if (Array.isArray(s)) s.forEach((dp) => years.add(dp.year))
  })
  const sortedYears = Array.from(years).sort()

  if (sortedYears.length === 0) return null

  const buildLookup = (s: YearlyDataPoint[]) => {
    const m: Record<number, number> = {}
    if (Array.isArray(s)) s.forEach((dp) => (m[dp.year] = dp.value))
    return m
  }
  const niLookup = buildLookup(data.net_income)
  const depLookup = buildLookup(data.depreciation)
  const capexLookup = buildLookup(data.capex)
  const oeLookup = buildLookup(data.owners_earnings)

  return (
    <CollapsibleSection title="Owner Earnings (Buffett)">
      <div className="mt-3 bg-amber-50 rounded-lg p-3 mb-3">
        <div className="text-xs font-semibold text-amber-700">Formula</div>
        <div className="text-sm font-mono text-amber-900 mt-1">{data.formula}</div>
        <div className="text-xs text-amber-600 mt-1">
          Average CapEx (maintenance proxy): {formatCurrency(data.avg_capex)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Year</th>
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Net Income</th>
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">+ D&A</th>
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">- CapEx</th>
              <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">
                = Owner Earnings
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((year, i) => (
              <tr key={year} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-1.5 px-2 text-gray-700">{year}</td>
                <td className="py-1.5 px-2 text-right font-mono">
                  {niLookup[year] != null ? formatCurrency(niLookup[year]) : '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-green-700">
                  {depLookup[year] != null ? formatCurrency(depLookup[year]) : '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-red-600">
                  {capexLookup[year] != null ? formatCurrency(capexLookup[year]) : '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-medium">
                  {oeLookup[year] != null ? formatCurrency(oeLookup[year]) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}


export function ValuationBasisSection({ stock }: ValuationBasisSectionProps) {
  const metrics = stock.all_metrics || {}
  const valuationBasis = metrics.valuation_basis as Record<string, ValuationBreakdown | BookValueBreakdown> | undefined
  const financials = metrics.financial_statements as FinancialStatements | undefined
  if (!valuationBasis && !financials) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Financial Data & Projections</h2>
      <p className="text-sm text-gray-500 mb-6">
        Underlying financial data, cash flow projections, and historical trends used in our valuations.
        Expand each section to cross-reference the raw numbers.
      </p>

      <div className="space-y-3">
        {/* Individual valuation method breakdowns */}
        {valuationBasis?.pad && (
          <ValuationMethodBreakdown
            title="PAD Valuation (Compound Growth)"
            breakdown={valuationBasis.pad as ValuationBreakdown}
          />
        )}

        {valuationBasis?.dcf && (
          <ValuationMethodBreakdown
            title="DCF Valuation (Linear Regression)"
            breakdown={valuationBasis.dcf as ValuationBreakdown}
          />
        )}

        {valuationBasis?.pad_dividend && (
          <ValuationMethodBreakdown
            title="PAD Dividend Valuation"
            breakdown={valuationBasis.pad_dividend as ValuationBreakdown}
          />
        )}

        {valuationBasis?.book_value && (
          <BookValueSection data={valuationBasis.book_value as BookValueBreakdown} />
        )}

        {/* Financial Statement summaries */}
        {financials?.income_statement && (
          <YearlySeriesTable
            title="Income Statement"
            series={financials.income_statement}
            columns={[
              { key: 'revenue', label: 'Revenue' },
              { key: 'gross_profit', label: 'Gross Profit' },
              { key: 'ebit', label: 'EBIT' },
              { key: 'net_income', label: 'Net Income' },
              { key: 'net_margin', label: 'Net Margin', isPercent: true },
            ]}
          />
        )}

        {financials?.cash_flow && (
          <YearlySeriesTable
            title="Cash Flow Statement"
            series={financials.cash_flow}
            columns={[
              { key: 'operating_cash_flow', label: 'Operating CF' },
              { key: 'capex', label: 'CapEx' },
              { key: 'free_cash_flow', label: 'Free CF' },
              { key: 'depreciation', label: 'D&A' },
            ]}
          />
        )}

        {financials?.balance_sheet && (
          <YearlySeriesTable
            title="Balance Sheet"
            series={financials.balance_sheet}
            columns={[
              { key: 'total_assets', label: 'Assets' },
              { key: 'total_liabilities', label: 'Liabilities' },
              { key: 'stockholders_equity', label: 'Equity' },
              { key: 'total_debt', label: 'Debt' },
            ]}
          />
        )}

        {financials?.owner_earnings && (
          <OwnerEarningsSection data={financials.owner_earnings} />
        )}
      </div>
    </div>
  )
}
