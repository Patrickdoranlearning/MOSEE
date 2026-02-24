import Link from 'next/link'
import { getStockAnalysis, getStockRawData } from '@/lib/db'
import { formatCurrency, formatPercent, type RawFinancialStatement } from '@/types/mosee'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ ticker: string }>
}

// Format large numbers for financial statements
function formatFinancialValue(value: number | null): string {
  if (value == null) return '—'
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(2)
}

// Collapsible financial statement table
function FinancialStatementTable({
  title,
  statement,
  defaultOpen = false,
}: {
  title: string
  statement: RawFinancialStatement
  defaultOpen?: boolean
}) {
  if (!statement || !statement.line_items || Object.keys(statement.line_items).length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-2">No data available</p>
      </div>
    )
  }

  const years = statement.years || []
  const lineItems = statement.line_items

  return (
    <details open={defaultOpen} className="bg-white rounded-xl shadow-sm border border-gray-100">
      <summary className="p-6 cursor-pointer hover:bg-gray-50 rounded-xl">
        <span className="text-lg font-semibold text-gray-900">{title}</span>
        <span className="text-sm text-gray-500 ml-2">
          ({Object.keys(lineItems).length} line items, {years.length} years)
        </span>
      </summary>
      <div className="px-6 pb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-600 sticky left-0 bg-white min-w-[200px]">
                Line Item
              </th>
              {years.map((year) => (
                <th key={year} className="text-right py-2 px-3 font-medium text-gray-600 min-w-[100px]">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(lineItems).map(([item, values]) => (
              <tr key={item} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pr-4 text-gray-800 sticky left-0 bg-white font-mono text-xs">
                  {item}
                </td>
                {years.map((year) => {
                  const val = values[year]
                  return (
                    <td
                      key={year}
                      className={`text-right py-1.5 px-3 font-mono text-xs ${
                        val != null && val < 0 ? 'text-red-600' : 'text-gray-700'
                      }`}
                    >
                      {formatFinancialValue(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// Metric display row
function MetricRow({ label, value, formula }: { label: string; value: string; formula?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {formula && <span className="text-xs text-gray-400 ml-2">({formula})</span>}
      </div>
      <span className="text-sm font-mono text-gray-900">{value}</span>
    </div>
  )
}

export default async function DataPage({ params }: PageProps) {
  const { ticker } = await params

  let stock: Awaited<ReturnType<typeof getStockAnalysis>> = null
  let rawData: Awaited<ReturnType<typeof getStockRawData>> = null
  let dbError: string | null = null

  try {
    stock = await getStockAnalysis(ticker)
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database error'
  }

  // Fetch raw data separately — this table may not exist yet, and that's OK.
  // The page gracefully shows a notice when rawData is null.
  if (stock && !dbError) {
    try {
      rawData = await getStockRawData(ticker)
    } catch {
      // mosee_raw_data table may not exist yet — silently fall through
    }
  }

  if (dbError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to load data</h1>
        <p className="text-red-600 mb-4">{dbError}</p>
        <Link href="/picks" className="text-blue-600 hover:text-blue-700">
          &larr; Back to picks
        </Link>
      </div>
    )
  }

  if (!stock) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">No analysis found</h1>
        <p className="text-gray-600 mb-4">
          Run an analysis for {ticker.toUpperCase()} first to see data.
        </p>
        <Link href={`/stock/${ticker.toUpperCase()}`} className="text-blue-600 hover:text-blue-700">
          &larr; Go to {ticker.toUpperCase()}
        </Link>
      </div>
    )
  }

  const allMetrics = (stock.all_metrics || {}) as Record<string, unknown>
  const marketData = rawData?.market_data
  const currencyInfo = rawData?.currency_info

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/picks" className="text-blue-600 hover:text-blue-700">
          All Picks
        </Link>
        <span className="text-gray-400">/</span>
        <Link href={`/stock/${stock.ticker}`} className="text-blue-600 hover:text-blue-700">
          {stock.ticker}
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">Data</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {stock.ticker} — Data Audit
            </h1>
            <p className="text-gray-600">{stock.company_name || stock.ticker}</p>
            <p className="text-sm text-gray-500 mt-1">
              Analysis date: {String(stock.analysis_date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/stock/${stock.ticker}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              &larr; Back to Analysis
            </Link>
          </div>
        </div>
      </div>

      {/* No raw data notice */}
      {!rawData && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 mb-6 text-sm text-yellow-800">
          Raw data is not yet available for this stock. Re-run the analysis to capture raw yfinance data.
          Only the computed metrics from the existing analysis are shown below.
        </div>
      )}

      {/* Section 1: Market Data Snapshot */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Data Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(stock.current_price)}
            </div>
            {marketData && marketData.stock_currency !== 'USD' && (
              <div className="text-xs text-gray-400">
                Trading: {marketData.stock_currency}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500">Market Cap</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(stock.market_cap)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Shares Outstanding</div>
            <div className="text-lg font-semibold text-gray-900">
              {marketData?.shares_outstanding
                ? formatFinancialValue(marketData.shares_outstanding)
                : (allMetrics.shares_outstanding
                    ? formatFinancialValue(allMetrics.shares_outstanding as number)
                    : 'N/A')}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Analysis Date</div>
            <div className="text-lg font-semibold text-gray-900">
              {String(stock.analysis_date)}
            </div>
          </div>
        </div>

        {/* Currency conversion details */}
        {currencyInfo && currencyInfo.converted_to_usd && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Currency Conversion</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Stock Currency:</span>{' '}
                <span className="font-medium">{currencyInfo.stock_currency}</span>
              </div>
              <div>
                <span className="text-gray-500">Reporting Currency:</span>{' '}
                <span className="font-medium">{currencyInfo.reporting_currency}</span>
              </div>
              <div>
                <span className="text-gray-500">Trading → USD:</span>{' '}
                <span className="font-mono">{currencyInfo.trading_to_usd_rate.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-gray-500">Reporting → USD:</span>{' '}
                <span className="font-mono">{currencyInfo.reporting_to_usd_rate.toFixed(6)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              All values below are in the original reporting currency (pre-conversion).
              The analysis page shows USD-converted values.
            </p>
          </div>
        )}
      </div>

      {/* Section 2: Raw Financial Statements */}
      {rawData && (
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Raw Financial Statements
            <span className="text-sm font-normal text-gray-500 ml-2">(from yfinance)</span>
          </h2>
          <FinancialStatementTable
            title="Income Statement"
            statement={rawData.income_statement}
            defaultOpen
          />
          <FinancialStatementTable
            title="Balance Sheet"
            statement={rawData.balance_sheet}
          />
          <FinancialStatementTable
            title="Cash Flow Statement"
            statement={rawData.cash_flow}
          />
        </div>
      )}

      {/* Section 3: Computed Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Computed Metrics
          <span className="text-sm font-normal text-gray-500 ml-2">(derived from raw data)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profitability */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Profitability
            </h3>
            <MetricRow
              label="ROE"
              value={formatPercent(allMetrics.roe as number | undefined)}
              formula="Net Income / Equity"
            />
            <MetricRow
              label="ROIC"
              value={formatPercent(allMetrics.roic as number | undefined)}
              formula="NOPAT / Invested Capital"
            />
            <MetricRow
              label="Owner Earnings Yield"
              value={formatPercent(allMetrics.owner_earnings_yield as number | undefined)}
              formula="Owner Earnings / Market Cap"
            />
            <MetricRow
              label="Earnings Yield"
              value={formatPercent(allMetrics.earnings_yield as number | undefined)}
              formula="EBIT / Enterprise Value"
            />
          </div>

          {/* Valuation */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Valuation
            </h3>
            <MetricRow label="P/E Ratio" value={fmtNum(allMetrics.pe_ratio)} />
            <MetricRow label="P/B Ratio" value={fmtNum(allMetrics.pb_ratio)} />
            <MetricRow
              label="PEG Ratio"
              value={fmtNum(allMetrics.peg_ratio)}
              formula="P/E / Growth Rate"
            />
            <MetricRow label="Graham Score" value={fmtNum(allMetrics.graham_score)} formula="0-7" />
            <MetricRow
              label="Earnings Equity"
              value={formatPercent(allMetrics.earnings_equity as number | undefined)}
              formula="Net Income / Market Cap"
            />
          </div>

          {/* Financial Health */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Financial Health
            </h3>
            <MetricRow label="Debt/Equity" value={fmtNum(allMetrics.debt_to_equity)} />
            <MetricRow label="Interest Coverage" value={fmtNum(allMetrics.interest_coverage)} formula="EBIT / Interest" />
            <MetricRow label="Current Ratio" value={fmtNum(allMetrics.current_ratio)} />
            <MetricRow
              label="Net Cash/Share"
              value={`$${fmtNum(allMetrics.net_cash_per_share)}`}
            />
          </div>

          {/* Per Share */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Per Share
            </h3>
            <MetricRow label="EPS" value={`$${fmtNum(allMetrics.eps)}`} />
            <MetricRow label="Book Value/Share" value={`$${fmtNum(allMetrics.book_value_per_share)}`} />
            <MetricRow label="Owner Earnings/Share" value={`$${fmtNum(allMetrics.owner_earnings_per_share)}`} />
          </div>

          {/* Growth */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Growth
            </h3>
            <MetricRow
              label="Earnings Growth"
              value={formatPercent(allMetrics.earnings_growth as number | undefined)}
            />
            <MetricRow
              label="Sales CAGR"
              value={formatPercent(allMetrics.sales_cagr as number | undefined)}
            />
            <MetricRow
              label="Margin Trend"
              value={String(allMetrics.margin_trend ?? 'N/A')}
            />
            <MetricRow label="Growth Quality" value={fmtNum(allMetrics.growth_quality_score)} />
          </div>

          {/* Magic Formula */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Magic Formula (Greenblatt)
            </h3>
            <MetricRow
              label="Earnings Yield"
              value={formatPercent(allMetrics.earnings_yield as number | undefined)}
              formula="EBIT / EV"
            />
            <MetricRow
              label="Return on Capital"
              value={formatPercent(allMetrics.return_on_capital as number | undefined)}
              formula="EBIT / (NWC + Net PPE)"
            />
            <MetricRow label="Lynch Category" value={String(allMetrics.lynch_category ?? 'N/A')} />
          </div>
        </div>
      </div>

      {/* Section 4: Valuation Inputs & Outputs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Valuation Summary
          <span className="text-sm font-normal text-gray-500 ml-2">(per method)</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Method</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Conservative</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Base</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Optimistic</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">MoS</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">MOSEE</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-gray-800">PAD</td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {formatCurrency(stock.valuation_conservative)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {formatCurrency(stock.valuation_base)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {formatCurrency(stock.valuation_optimistic)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.pad_mos)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.pad_mosee)}
                </td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-gray-800">DCF</td>
                <td className="text-right py-2 px-3 font-mono text-gray-700" colSpan={3}></td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.dcf_mos)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.dcf_mosee)}
                </td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-gray-800">Book</td>
                <td className="text-right py-2 px-3 font-mono text-gray-700" colSpan={3}></td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.book_mos)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-gray-700">
                  {fmtNum(stock.book_mosee)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="text-lg font-semibold">{formatCurrency(stock.current_price)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Buy Below</div>
            <div className="text-lg font-semibold text-green-700">
              {formatCurrency(stock.buy_below_price)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Margin of Safety</div>
            <div className={`text-lg font-semibold ${stock.has_margin_of_safety ? 'text-green-700' : 'text-orange-600'}`}>
              {stock.margin_of_safety != null ? `${(stock.margin_of_safety * 100).toFixed(0)}%` : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Confidence</div>
            <div className="text-lg font-semibold">
              {stock.confidence_level || 'N/A'}
              {stock.confidence_score != null && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({stock.confidence_score.toFixed(0)})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Data */}
      {(allMetrics.historical_earnings != null || allMetrics.net_income_average != null) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Earnings Data</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500">Avg Net Income</div>
              <div className="text-base font-semibold">
                {formatFinancialValue(allMetrics.net_income_average as number)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Growth Rate</div>
              <div className="text-base font-semibold">
                {formatPercent(allMetrics.net_income_growth_rate as number | undefined)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Free Cash Flow</div>
              <div className="text-base font-semibold">
                {formatFinancialValue(allMetrics.free_cash_flow as number)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">EPS</div>
              <div className="text-base font-semibold">
                ${fmtNum(allMetrics.eps)}
              </div>
            </div>
          </div>

          {/* Historical earnings table */}
          {Array.isArray(allMetrics.historical_earnings) && (allMetrics.historical_earnings as Array<{year: number; net_income: number}>).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-600">Year</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Net Income</th>
                  </tr>
                </thead>
                <tbody>
                  {(allMetrics.historical_earnings as Array<{year: number; net_income: number}>).map(
                    (e) => (
                      <tr key={e.year} className="border-b border-gray-50">
                        <td className="py-1.5 pr-4 text-gray-700">{e.year}</td>
                        <td className={`text-right py-1.5 px-3 font-mono ${e.net_income < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {formatFinancialValue(e.net_income)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Simple number formatter
function fmtNum(value: unknown): string {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return 'N/A'
  if (Math.abs(n) >= 1000) return n.toFixed(0)
  if (Math.abs(n) >= 100) return n.toFixed(1)
  return n.toFixed(2)
}
