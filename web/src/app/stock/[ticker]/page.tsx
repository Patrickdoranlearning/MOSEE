import Link from 'next/link'
import { getStockAnalysis } from '@/lib/db'
import { formatCurrency, formatMoS, VERDICT_COLORS, Perspective, VerdictRationale, QualityBreakdown, ConfidenceBreakdownData } from '@/types/mosee'
import { VerdictBadge } from '@/components/VerdictBadge'
import { QualityBadge } from '@/components/QualityBadge'
import { DownloadReportButton } from '@/components/DownloadReportButton'
import { ReAnalyseButton } from '@/components/ReAnalyseButton'
import { EarningsSection } from './EarningsSection'
import { ValuationBasisSection } from './ValuationBasisSection'
import { ValuationMethodsCard } from './ValuationMethodsCard'
import { VerdictExplanation } from './VerdictExplanation'
import { QualityScoreBreakdown } from './QualityScoreBreakdown'
import { ConfidenceBreakdown } from './ConfidenceBreakdown'
import { RunAnalysisPage } from './RunAnalysisPage'
import { AnnualReportAnalysis } from './AnnualReportAnalysis'

// Revalidate every hour (data updates weekly)
export const revalidate = 3600

interface PageProps {
  params: Promise<{ ticker: string }>
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params

  let stock: Awaited<ReturnType<typeof getStockAnalysis>> = null
  let dbError: string | null = null
  try {
    stock = await getStockAnalysis(ticker)
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database error'
  }

  // Distinguish between DB error and stock not found
  if (dbError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to load stock data</h1>
        <p className="text-red-600 mb-4">{dbError}</p>
        <Link href="/picks" className="text-blue-600 hover:text-blue-700">
          &larr; Back to picks
        </Link>
      </div>
    )
  }

  if (!stock) {
    return <RunAnalysisPage ticker={ticker.toUpperCase()} />
  }
  
  const perspectives = stock.perspectives || []
  const strengths = stock.strengths || []
  const concerns = stock.concerns || []
  const actionItems = stock.action_items || []
  const allMetrics = (stock.all_metrics || {}) as Record<string, unknown>
  const verdictRationale = allMetrics.verdict_rationale as VerdictRationale | undefined
  const qualityBreakdown = allMetrics.quality_breakdown as QualityBreakdown | undefined
  const confidenceBreakdown = allMetrics.confidence_breakdown as ConfidenceBreakdownData | undefined
  const recommendationText = allMetrics.recommendation_text as string | undefined
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4">
        <Link href="/picks" className="text-blue-600 hover:text-blue-700">
          ← Back to All Picks
        </Link>
      </nav>
      
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{stock.ticker}</h1>
              <QualityBadge grade={stock.quality_grade} score={stock.quality_score} showScore />
            </div>
            <p className="text-lg text-gray-600">{stock.company_name || stock.ticker}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>{stock.industry || 'N/A'}</span>
              <span>•</span>
              <span>{stock.country || 'N/A'}</span>
              <span>•</span>
              <span>{stock.cap_size || 'N/A'} cap</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <VerdictBadge verdict={stock.verdict} size="lg" />
            {recommendationText && (
              <p className="text-sm text-gray-600 text-right max-w-xs">{recommendationText}</p>
            )}
            <div className="text-right mt-2">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(stock.current_price)}
              </div>
              <div className="text-sm text-gray-500">Current Price</div>
            </div>
            <div className="flex items-center gap-2">
              <ReAnalyseButton ticker={stock.ticker} />
              <DownloadReportButton ticker={stock.ticker} />
              <Link
                href={`/stock/${stock.ticker}/plots`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM9 9h2v12H9zM15 5h2v16h-2zM21 1h2v20h-2z" />
                </svg>
                View Plots
              </Link>
              <Link
                href={`/stock/${stock.ticker}/data`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                View Data
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Investment Horizon Note */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-6 text-sm text-blue-700">
        MOSEE analyses companies as <strong>5-10 year investments</strong>. Reports reflect long-term fundamentals, not short-term price movements.
      </div>

      {/* Verdict Explanation — How did we reach this verdict? */}
      <div className="mb-6">
        <VerdictExplanation rationale={verdictRationale} recommendationText={recommendationText} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Valuation Range */}
          <ValuationRangeCard stock={stock} />

          {/* Valuation Methods Comparison */}
          <ValuationMethodsCard stock={stock} />

          {/* Earnings & Valuation Methodology */}
          <EarningsSection stock={stock} />

          {/* Valuation Basis Data - Detailed breakdowns for cross-referencing */}
          <ValuationBasisSection stock={stock} />

          {/* Financial Health */}
          <FinancialHealthCard stock={stock} />

          {/* Growth & Value Metrics */}
          <GrowthValueCard stock={stock} />

          {/* Quality Score Breakdown — how each philosopher scored this stock */}
          <QualityScoreBreakdown breakdown={qualityBreakdown} />

          {/* Multi-Lens Perspectives */}
          {perspectives.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Investment Perspectives</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {perspectives.map((perspective: Perspective, index: number) => (
                  <div 
                    key={index}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {perspective.philosopher}
                      </h3>
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${VERDICT_COLORS[perspective.verdict as keyof typeof VERDICT_COLORS] || '#6b7280'}20`,
                          color: VERDICT_COLORS[perspective.verdict as keyof typeof VERDICT_COLORS] || '#6b7280'
                        }}
                      >
                        {perspective.verdict}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      Grade: <span className="font-medium">{perspective.grade}</span>
                      {' • '}
                      Key: {perspective.key_metric}
                    </div>
                    <p className="text-sm text-gray-600">{perspective.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Annual Report Analysis */}
          <AnnualReportAnalysis ticker={stock.ticker} />

          {/* Strengths and Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            {strengths.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Strengths
                </h2>
                <ul className="space-y-2">
                  {strengths.map((strength: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Concerns */}
            {concerns.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-red-500">⚠</span>
                  Concerns
                </h2>
                <ul className="space-y-2">
                  {concerns.map((concern: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-red-500 mt-0.5">•</span>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Action Items */}
          {actionItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Action Items</h2>
              <ul className="space-y-3">
                {actionItems.map((item: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Right Column - Key Metrics */}
        <div className="space-y-6">
          {/* MOSEE Score - The Key One-Look Metric */}
          <MOSEEScoreCard stock={stock} />

          {/* Margin of Safety */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Margin of Safety</h2>

            <div className={`text-center p-4 rounded-lg ${stock.has_margin_of_safety ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className={`text-3xl font-bold ${stock.has_margin_of_safety ? 'text-green-600' : 'text-orange-500'}`}>
                {formatMoS(stock.margin_of_safety)}
              </div>
              <div className={`text-sm ${stock.has_margin_of_safety ? 'text-green-700' : 'text-orange-600'}`}>
                {stock.has_margin_of_safety ? 'Sufficient MoS' : 'Insufficient MoS'}
              </div>
            </div>

            {stock.buy_below_price && (
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-500">Buy Below Price</div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(stock.buy_below_price)}
                </div>
              </div>
            )}
          </div>

          {/* Key Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Key Metrics</h2>

            <div className="space-y-3">
              <MetricRow label="Market Cap" value={formatCurrency(stock.market_cap)} />
              <MetricRow label="PAD MoS" value={formatMoS(stock.pad_mos)} />
              <MetricRow label="DCF MoS" value={formatMoS(stock.dcf_mos)} />
              <MetricRow label="Book MoS" value={formatMoS(stock.book_mos)} />
            </div>
          </div>
          
          {/* Confidence — with detailed breakdown */}
          <ConfidenceBreakdown
            data={confidenceBreakdown}
            fallbackLevel={stock.confidence_level}
            fallbackScore={stock.confidence_score}
          />
          
          {/* Analysis Date */}
          <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
            Analysis Date: {new Date(stock.analysis_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

interface MOSEEScoreCardProps {
  stock: NonNullable<Awaited<ReturnType<typeof getStockAnalysis>>>
}

function MOSEEScoreCard({ stock }: MOSEEScoreCardProps) {
  // Get the best MOSEE score (PAD is primary)
  const moseeScore = stock.pad_mosee ?? stock.dcf_mosee ?? stock.book_mosee
  const mosScore = stock.pad_mos ?? stock.dcf_mos ?? stock.book_mos

  // Calculate earnings equity from MOSEE and MoS
  // MOSEE = earnings_equity × (1/MoS), so earnings_equity = MOSEE × MoS
  const earningsEquity = moseeScore && mosScore && mosScore > 0
    ? moseeScore * mosScore
    : null

  // Calculate years to payback (inverse of earnings equity)
  const yearsToPayback = earningsEquity && earningsEquity > 0
    ? (1 / earningsEquity).toFixed(1)
    : null

  // Determine quality of MOSEE score
  // Higher is better: >0.15 excellent, >0.10 good, >0.05 fair, <0.05 poor
  const getMoseeQuality = (score: number | null | undefined) => {
    if (score == null || !isFinite(score)) return { color: 'gray', label: 'N/A', bg: 'bg-gray-50' }
    if (score >= 0.15) return { color: 'text-green-600', label: 'Excellent', bg: 'bg-green-50' }
    if (score >= 0.10) return { color: 'text-emerald-600', label: 'Good', bg: 'bg-emerald-50' }
    if (score >= 0.05) return { color: 'text-yellow-600', label: 'Fair', bg: 'bg-yellow-50' }
    if (score > 0) return { color: 'text-orange-600', label: 'Below Average', bg: 'bg-orange-50' }
    return { color: 'text-red-600', label: 'Poor', bg: 'bg-red-50' }
  }

  const quality = getMoseeQuality(moseeScore)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">MOSEE Score</h2>
        <div className="group relative">
          <span className="text-gray-400 cursor-help text-sm">ⓘ</span>
          <div className="absolute right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <strong>MOSEE</strong> = Margin of Safety × Earnings Equity
            <br /><br />
            Combines how undervalued a stock is with how profitable it is relative to market cap.
            <br /><br />
            <strong>Higher is better.</strong> A MOSEE of 0.15+ is excellent.
          </div>
        </div>
      </div>

      <div className={`text-center p-4 rounded-lg ${quality.bg}`}>
        <div className={`text-4xl font-bold ${quality.color}`}>
          {moseeScore != null && isFinite(moseeScore) ? moseeScore.toFixed(3) : 'N/A'}
        </div>
        <div className={`text-sm font-medium ${quality.color}`}>
          {quality.label}
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-4 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Earnings Equity</span>
          <span className="font-medium text-gray-900">
            {earningsEquity != null ? `${(earningsEquity * 100).toFixed(1)}%` : 'N/A'}
          </span>
        </div>
        {yearsToPayback && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Years to Payback</span>
            <span className="font-medium text-gray-900">{yearsToPayback} years</span>
          </div>
        )}

        {/* All MOSEE scores */}
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide">By Valuation Method</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-gray-500 text-xs">PAD</div>
              <div className="font-semibold">{stock.pad_mosee?.toFixed(3) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">DCF</div>
              <div className="font-semibold">{stock.dcf_mosee?.toFixed(3) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Book</div>
              <div className="font-semibold">{stock.book_mosee?.toFixed(3) || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        Earnings Equity shows how many years of profits it takes to recoup the market cap.
        Lower is better (faster payback). Combined with MoS, MOSEE tells you if the stock
        is both undervalued AND has strong earnings power.
      </p>
    </div>
  )
}

interface ValuationRangeCardProps {
  stock: NonNullable<Awaited<ReturnType<typeof getStockAnalysis>>>
}

function ValuationRangeCard({ stock }: ValuationRangeCardProps) {
  // Calculate shares outstanding from market cap and price
  const sharesOutstanding = stock.market_cap && stock.current_price && stock.current_price > 0
    ? stock.market_cap / stock.current_price
    : null

  // Calculate implied market caps for each valuation scenario
  const impliedMarketCaps = sharesOutstanding ? {
    conservative: stock.valuation_conservative ? stock.valuation_conservative * sharesOutstanding : null,
    base: stock.valuation_base ? stock.valuation_base * sharesOutstanding : null,
    optimistic: stock.valuation_optimistic ? stock.valuation_optimistic * sharesOutstanding : null,
  } : null

  // Calculate upside/downside vs current market cap
  const getUpsidePercent = (impliedMcap: number | null) => {
    if (!impliedMcap || !stock.market_cap) return null
    return ((impliedMcap - stock.market_cap) / stock.market_cap) * 100
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Valuation Range</h2>

      <div className="relative pt-8 pb-4">
        {/* Valuation Bar */}
        <div className="relative h-12 bg-gradient-to-r from-red-100 via-yellow-100 to-green-100 rounded-lg">
          {/* Current Price Marker */}
          {stock.current_price && stock.valuation_conservative && stock.valuation_optimistic && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
              style={{
                left: `${Math.min(100, Math.max(0,
                  ((stock.current_price - stock.valuation_conservative) /
                  (stock.valuation_optimistic - stock.valuation_conservative)) * 100
                ))}%`
              }}
            >
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">
                  Current: {formatCurrency(stock.current_price)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-3 text-sm">
          <div className="text-center">
            <div className="font-semibold text-red-600">
              {formatCurrency(stock.valuation_conservative)}
            </div>
            <div className="text-gray-500">Conservative</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-yellow-600">
              {formatCurrency(stock.valuation_base)}
            </div>
            <div className="text-gray-500">Base</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">
              {formatCurrency(stock.valuation_optimistic)}
            </div>
            <div className="text-gray-500">Optimistic</div>
          </div>
        </div>
      </div>

      {stock.valuation_confidence && (
        <p className="text-sm text-gray-500 mt-2 mb-4">
          Valuation confidence: {stock.valuation_confidence}
        </p>
      )}

      {/* Implied Market Cap Section */}
      {impliedMarketCaps && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Implied Market Cap</h3>
          <div className="text-xs text-gray-500 mb-3">
            Current: {formatCurrency(stock.market_cap)}
          </div>

          <div className="space-y-2">
            <ImpliedMarketCapRow
              label="Conservative"
              value={impliedMarketCaps.conservative}
              upside={getUpsidePercent(impliedMarketCaps.conservative)}
              colorClass="text-red-600"
            />
            <ImpliedMarketCapRow
              label="Base"
              value={impliedMarketCaps.base}
              upside={getUpsidePercent(impliedMarketCaps.base)}
              colorClass="text-yellow-600"
            />
            <ImpliedMarketCapRow
              label="Optimistic"
              value={impliedMarketCaps.optimistic}
              upside={getUpsidePercent(impliedMarketCaps.optimistic)}
              colorClass="text-green-600"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ImpliedMarketCapRow({
  label,
  value,
  upside,
  colorClass
}: {
  label: string
  value: number | null
  upside: number | null
  colorClass: string
}) {
  if (value === null) return null

  const upsideColor = upside !== null
    ? upside > 0 ? 'text-green-600' : upside < -10 ? 'text-red-600' : 'text-orange-500'
    : 'text-gray-400'

  return (
    <div className="flex justify-between items-center text-sm">
      <span className={`font-medium ${colorClass}`}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-700">{formatCurrency(value)}</span>
        {upside !== null && (
          <span className={`text-xs font-medium ${upsideColor}`}>
            {upside > 0 ? '+' : ''}{upside.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Financial Health Card
// ============================================================================

interface FinancialHealthCardProps {
  stock: NonNullable<Awaited<ReturnType<typeof getStockAnalysis>>>
}

function FinancialHealthCard({ stock }: FinancialHealthCardProps) {
  const metrics = stock.all_metrics || {}

  const formatPct = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return `${(val * 100).toFixed(1)}%`
  }

  const formatRatio = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return val.toFixed(2)
  }

  const formatMultiple = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return `${val.toFixed(1)}x`
  }

  const getRoeColor = (val: unknown) => {
    if (val == null || typeof val !== 'number') return 'text-gray-900'
    if (val >= 0.20) return 'text-green-600'
    if (val >= 0.12) return 'text-emerald-600'
    if (val >= 0.05) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDebtColor = (val: unknown) => {
    if (val == null || typeof val !== 'number') return 'text-gray-900'
    if (val <= 0.3) return 'text-green-600'
    if (val <= 0.7) return 'text-emerald-600'
    if (val <= 1.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getInterestColor = (val: unknown) => {
    if (val == null || typeof val !== 'number') return 'text-gray-900'
    if (val >= 10) return 'text-green-600'
    if (val >= 5) return 'text-emerald-600'
    if (val >= 2) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Check if we have any financial health data
  const hasData = metrics.roe != null || metrics.roic != null || metrics.debt_to_equity != null

  if (!hasData) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Health</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Returns */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Returns</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">ROE</span>
              <span className={`font-semibold text-sm ${getRoeColor(metrics.roe)}`}>
                {formatPct(metrics.roe)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">ROIC</span>
              <span className={`font-semibold text-sm ${getRoeColor(metrics.roic)}`}>
                {formatPct(metrics.roic)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Owner Earnings/Share</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.owner_earnings_per_share != null && typeof metrics.owner_earnings_per_share === 'number'
                  ? formatCurrency(metrics.owner_earnings_per_share)
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Debt & Liquidity */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Debt & Liquidity</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Debt/Equity</span>
              <span className={`font-semibold text-sm ${getDebtColor(metrics.debt_to_equity)}`}>
                {formatRatio(metrics.debt_to_equity)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Interest Coverage</span>
              <span className={`font-semibold text-sm ${getInterestColor(metrics.interest_coverage)}`}>
                {formatMultiple(metrics.interest_coverage)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Current Ratio</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatRatio(metrics.current_ratio)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Generation */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cash Generation</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Free Cash Flow</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.free_cash_flow != null && typeof metrics.free_cash_flow === 'number'
                  ? formatCurrency(metrics.free_cash_flow)
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Owner Earnings Yield</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatPct(metrics.owner_earnings_yield)}
              </span>
            </div>
          </div>
        </div>

        {/* Per Share */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Per Share</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Book Value/Share</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.book_value_per_share != null && typeof metrics.book_value_per_share === 'number'
                  ? formatCurrency(metrics.book_value_per_share)
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Net Cash/Share</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.net_cash_per_share != null && typeof metrics.net_cash_per_share === 'number'
                  ? formatCurrency(metrics.net_cash_per_share)
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Growth & Value Metrics Card
// ============================================================================

interface GrowthValueCardProps {
  stock: NonNullable<Awaited<ReturnType<typeof getStockAnalysis>>>
}

function GrowthValueCard({ stock }: GrowthValueCardProps) {
  const metrics = stock.all_metrics || {}

  const formatPct = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return `${(val * 100).toFixed(1)}%`
  }

  const formatRatio2 = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return val.toFixed(2)
  }

  const formatScore = (val: unknown) => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return 'N/A'
    return `${val.toFixed(0)}/100`
  }

  const getPegColor = (val: unknown) => {
    if (val == null || typeof val !== 'number') return 'text-gray-900'
    if (val < 0.5) return 'text-green-600'
    if (val <= 1.0) return 'text-emerald-600'
    if (val <= 2.0) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Check if we have any growth/value data
  const hasData = metrics.pe_ratio != null || metrics.peg_ratio != null ||
    metrics.earnings_yield != null || metrics.sales_cagr != null

  if (!hasData) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Growth & Value Metrics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Value Ratios */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Value Ratios</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">P/E Ratio</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatRatio2(metrics.pe_ratio)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">P/B Ratio</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatRatio2(metrics.pb_ratio)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">PEG Ratio</span>
              <span className={`font-semibold text-sm ${getPegColor(metrics.peg_ratio)}`}>
                {formatRatio2(metrics.peg_ratio)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Graham Score</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.graham_score != null && typeof metrics.graham_score === 'number'
                  ? `${metrics.graham_score}/7`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Greenblatt (Magic Formula) */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Magic Formula</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Earnings Yield</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatPct(metrics.earnings_yield)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Return on Capital</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatPct(metrics.return_on_capital)}
              </span>
            </div>
            {metrics.lynch_category != null && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-600">Lynch Category</span>
                <span className="font-semibold text-sm text-gray-900">
                  {String(metrics.lynch_category)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Growth (Fisher) */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Growth (Fisher)</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Sales CAGR</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatPct(metrics.sales_cagr)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Margin Trend</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.margin_trend != null ? String(metrics.margin_trend) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Growth Quality</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatScore(metrics.growth_quality_score)}
              </span>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Earnings</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">EPS</span>
              <span className="font-semibold text-sm text-gray-900">
                {metrics.eps != null && typeof metrics.eps === 'number'
                  ? formatCurrency(metrics.eps)
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Earnings Growth</span>
              <span className={`font-semibold text-sm ${
                typeof metrics.earnings_growth === 'number' && metrics.earnings_growth < 0
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}>
                {formatPct(metrics.earnings_growth)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-600">Earnings Equity</span>
              <span className="font-semibold text-sm text-gray-900">
                {formatPct(metrics.earnings_equity)}
              </span>
            </div>
            {/* Earnings Classification */}
            {metrics.earnings_classification != null && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-600">Earnings Pattern</span>
                <span className={`font-semibold text-sm px-2 py-0.5 rounded ${
                  metrics.earnings_classification === 'Steady Compounder' ? 'bg-green-100 text-green-700' :
                  metrics.earnings_classification === 'Cyclical' ? 'bg-yellow-100 text-yellow-700' :
                  metrics.earnings_classification === 'Turnaround' ? 'bg-blue-100 text-blue-700' :
                  metrics.earnings_classification === 'Distressed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {String(metrics.earnings_classification)}
                </span>
              </div>
            )}
            {/* Earnings CV */}
            {metrics.earnings_cv != null && typeof metrics.earnings_cv === 'number' && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-600">Earnings Volatility (CV)</span>
                <span className={`font-semibold text-sm ${
                  metrics.earnings_cv < 0.3 ? 'text-green-600' :
                  metrics.earnings_cv < 0.8 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(metrics.earnings_cv as number).toFixed(2)}
                </span>
              </div>
            )}
            {/* Projection Method & R² */}
            {metrics.projection_method != null && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-600">Projection Method</span>
                <span className="font-semibold text-sm text-gray-700 capitalize">
                  {String(metrics.projection_method)}
                </span>
              </div>
            )}
            {metrics.projection_r_squared != null && typeof metrics.projection_r_squared === 'number' && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-600">Projection Fit (R²)</span>
                <span className={`font-semibold text-sm ${
                  metrics.projection_r_squared >= 0.7 ? 'text-green-600' :
                  metrics.projection_r_squared >= 0.3 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(metrics.projection_r_squared as number).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
