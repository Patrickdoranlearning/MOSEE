import { getTopPicks, getAnalysisStats } from '@/lib/db'
import { StockCard } from '@/components/StockCard'
import Link from 'next/link'

// Revalidate every 5 minutes
export const revalidate = 300

export default async function Home() {
  let topPicks: Awaited<ReturnType<typeof getTopPicks>> = []
  let stats: Awaited<ReturnType<typeof getAnalysisStats>> = null
  
  try {
    topPicks = await getTopPicks(10)
    stats = await getAnalysisStats()
  } catch {
    // Database not set up yet or no data
  }
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              MOSEE Stock Intelligence
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Weekly stock analysis powered by investment wisdom from Graham, Buffett, Lynch, Fisher & Greenblatt
            </p>
            
            {/* Stats */}
            {stats && (
              <div className="flex flex-wrap justify-center gap-8 mt-8">
                <div className="bg-white/10 rounded-lg px-6 py-4">
                  <div className="text-3xl font-bold">{stats.totalAnalyzed}</div>
                  <div className="text-blue-200 text-sm">Stocks Analyzed</div>
                </div>
                <div className="bg-white/10 rounded-lg px-6 py-4">
                  <div className="text-3xl font-bold">{stats.buyCount}</div>
                  <div className="text-blue-200 text-sm">Buy Signals</div>
                </div>
                <div className="bg-white/10 rounded-lg px-6 py-4">
                  <div className="text-3xl font-bold">
                    {stats.analysisDate ? new Date(stats.analysisDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                  </div>
                  <div className="text-blue-200 text-sm">Last Updated</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Top Picks Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">This Week&apos;s Top Picks</h2>
            <p className="text-gray-500 mt-1">Stocks with the best investment verdicts</p>
          </div>
          <Link
            href="/picks"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            View All Picks →
          </Link>
        </div>
        
        {topPicks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topPicks.map((stock) => (
              <StockCard key={stock.id} stock={stock} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analysis Data Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Run the weekly analysis script to populate stock data. 
              Check back after the analysis completes.
            </p>
          </div>
        )}
      </div>
      
      {/* How It Works Section */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            How MOSEE Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Book Intelligence</h3>
              <p className="text-gray-500 text-sm">
                Metrics from 10 classic investing books by Graham, Buffett, Lynch & more
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Range Valuation</h3>
              <p className="text-gray-500 text-sm">
                Conservative, base, and optimistic value estimates - not single points
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Margin of Safety</h3>
              <p className="text-gray-500 text-sm">
                Non-negotiable safety check before any buy recommendation
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👁️</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Multi-Lens Analysis</h3>
              <p className="text-gray-500 text-sm">
                See how Graham, Buffett, Lynch & Fisher would each view the stock
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
