import { getAllAnalyses } from '@/lib/db'
import { StockTable } from '@/components/StockTable'
import { PicksFilter } from './PicksFilter'

// Revalidate every 5 minutes
export const revalidate = 300

export default async function PicksPage() {
  let picks: Awaited<ReturnType<typeof getAllAnalyses>> = []
  
  try {
    picks = await getAllAnalyses()
  } catch {
    // Database not set up yet
  }
  
  const analysisDate = picks[0]?.analysis_date
  
  // Extract unique values for filters
  const verdicts = [...new Set(picks.map(p => p.verdict))]
  const industries = [...new Set(picks.map(p => p.industry).filter(Boolean))] as string[]
  const countries = [...new Set(picks.map(p => p.country).filter(Boolean))] as string[]
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Stock Picks</h1>
        <p className="text-gray-500 mt-1">
          {analysisDate 
            ? `Analysis from ${new Date(analysisDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
            : 'No analysis data available'
          }
        </p>
      </div>
      
      {/* Filters */}
      <PicksFilter 
        verdicts={verdicts}
        industries={industries}
        countries={countries}
      />
      
      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <StockTable stocks={picks} />
      </div>
      
      {/* Summary */}
      {picks.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {picks.length} stocks from latest analysis
        </div>
      )}
    </div>
  )
}
