import { getScreenerRows, getAnalysisStats } from '@/lib/db'
import { ScreenerClient } from './ScreenerClient'
import type { ScreenerRow } from '@/types/mosee'

export const revalidate = 3600

export const metadata = {
  title: 'Screener - MOSEE',
  description: 'Filter analyzed stocks by MOSEE metrics. Find "Doublers" priced to return 100% over 5 years.',
}

export default async function ScreenerPage() {
  let rows: ScreenerRow[] = []
  let stats: Awaited<ReturnType<typeof getAnalysisStats>> = null
  let error: string | null = null

  try {
    const [screenerRows, analysisStats] = await Promise.all([
      getScreenerRows(),
      getAnalysisStats(),
    ])
    rows = screenerRows
    stats = analysisStats
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load screener data'
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Screener</h1>
          <p className="text-gray-500 mt-1">
            Filter analyzed stocks by your metrics
            {stats?.analysisDate && (
              <span>
                {' '}&middot; Last analyzed{' '}
                {new Date(stats.analysisDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Unable to load screener data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Screener filters + table */}
      {!error && <ScreenerClient stocks={rows} />}
    </div>
  )
}
