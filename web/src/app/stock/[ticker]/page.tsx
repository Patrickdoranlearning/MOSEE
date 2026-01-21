import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStockAnalysis } from '@/lib/db'
import { formatCurrency, formatMoS, VERDICT_COLORS, Perspective } from '@/types/mosee'
import { VerdictBadge } from '@/components/VerdictBadge'
import { QualityBadge } from '@/components/QualityBadge'

// Revalidate every 5 minutes
export const revalidate = 300

interface PageProps {
  params: Promise<{ ticker: string }>
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params
  
  let stock: Awaited<ReturnType<typeof getStockAnalysis>> = null
  try {
    stock = await getStockAnalysis(ticker)
  } catch {
    // Database not set up yet
  }
  
  if (!stock) {
    notFound()
  }
  
  const perspectives = stock.perspectives || []
  const strengths = stock.strengths || []
  const concerns = stock.concerns || []
  const actionItems = stock.action_items || []
  
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
            <div className="text-right mt-2">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(stock.current_price)}
              </div>
              <div className="text-sm text-gray-500">Current Price</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Valuation Range */}
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
              <p className="text-sm text-gray-500 mt-4">
                Valuation confidence: {stock.valuation_confidence}
              </p>
            )}
          </div>
          
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
              <MetricRow label="PAD MOSEE" value={stock.pad_mosee?.toFixed(2) || 'N/A'} />
              <MetricRow label="DCF MOSEE" value={stock.dcf_mosee?.toFixed(2) || 'N/A'} />
              <MetricRow label="Book MOSEE" value={stock.book_mosee?.toFixed(2) || 'N/A'} />
            </div>
          </div>
          
          {/* Confidence */}
          {stock.confidence_level && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Confidence</h2>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stock.confidence_level}
                </div>
                {stock.confidence_score && (
                  <div className="text-sm text-gray-500 mt-1">
                    Score: {(stock.confidence_score * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          )}
          
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
