import Link from 'next/link'
import { getStockAnalysis } from '@/lib/db'
import { PlotsClient } from './PlotsClient'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ ticker: string }>
}

export default async function PlotsPage({ params }: PageProps) {
  const { ticker } = await params

  let stock: Awaited<ReturnType<typeof getStockAnalysis>> = null
  let dbError: string | null = null

  try {
    stock = await getStockAnalysis(ticker)
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database error'
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
          Run an analysis for {ticker.toUpperCase()} first to see plots.
        </p>
        <Link href={`/stock/${ticker.toUpperCase()}`} className="text-blue-600 hover:text-blue-700">
          &larr; Go to {ticker.toUpperCase()}
        </Link>
      </div>
    )
  }

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
        <span className="text-gray-600">Plots</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {stock.ticker} — Financial Charts
            </h1>
            <p className="text-gray-600">{stock.company_name || stock.ticker}</p>
            <p className="text-sm text-gray-500 mt-1">
              Analysis date: {String(stock.analysis_date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/stock/${stock.ticker}/data`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View Data
            </Link>
            <Link
              href={`/stock/${stock.ticker}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              &larr; Back to Analysis
            </Link>
          </div>
        </div>
      </div>

      <PlotsClient stock={stock} />
    </div>
  )
}
