import { getAllAnalyses } from '@/lib/db'
import { PicksFilter } from './PicksFilter'

// Revalidate every hour (data updates weekly, not every 5 minutes)
export const revalidate = 3600

export default async function PicksPage() {
  let picks: Awaited<ReturnType<typeof getAllAnalyses>> = []
  let error: string | null = null

  try {
    picks = await getAllAnalyses()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load analysis data'
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

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">Failed to load data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Filters + Table (client component handles both) */}
      <PicksFilter
        stocks={picks}
        verdicts={verdicts}
        industries={industries}
        countries={countries}
      />
    </div>
  )
}
