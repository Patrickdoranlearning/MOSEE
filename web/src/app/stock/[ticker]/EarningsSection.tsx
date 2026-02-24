'use client'

import { useState } from 'react'
import { EarningsChart, EarningsKeyMetrics } from '@/components/EarningsChart'
import { formatCurrency, StockAnalysis } from '@/types/mosee'

interface EarningsSectionProps {
  stock: StockAnalysis
}

interface EarningsDataPoint {
  year: number
  net_income: number
  conservative?: number
  optimistic?: number
}

export function EarningsSection({ stock }: EarningsSectionProps) {
  const [showChart, setShowChart] = useState(true)
  const metrics = stock.all_metrics || {}

  // Extract earnings data from all_metrics
  const historicalEarnings: EarningsDataPoint[] = (metrics.historical_earnings as EarningsDataPoint[]) || []
  const padProjections: EarningsDataPoint[] = (metrics.pad_projections as EarningsDataPoint[]) || []
  const dcfProjections: EarningsDataPoint[] = (metrics.dcf_projections as EarningsDataPoint[]) || []
  const netIncomeAverage = (metrics.net_income_average as number) || 0
  const growthRate = (metrics.net_income_growth_rate as number) || 0

  // Get latest earnings from historical data
  const latestEarnings = historicalEarnings.length > 0
    ? historicalEarnings[historicalEarnings.length - 1].net_income
    : 0

  // Calculate total valuations from projections using actual year offsets
  const discountRate = 0.04
  const currentYear = new Date().getFullYear()
  const calculatePresentValue = (projections: EarningsDataPoint[]) => {
    return projections.reduce((total, proj) => {
      const yearsFromNow = proj.year - currentYear
      if (yearsFromNow <= 0) return total + proj.net_income // Already past, no discounting
      const discountFactor = 1 / Math.pow(1 + discountRate, yearsFromNow)
      return total + proj.net_income * discountFactor
    }, 0)
  }

  const padValue = calculatePresentValue(padProjections)
  const dcfValue = calculatePresentValue(dcfProjections)

  // Get book value from valuation
  const sharesOutstanding = stock.market_cap && stock.current_price
    ? stock.market_cap / stock.current_price
    : 0
  const bookValue = (stock.valuation_base || 0) * sharesOutstanding

  // If no earnings data available, show placeholder
  if (historicalEarnings.length === 0 && padProjections.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Earnings & Valuation</h2>
        <div className="text-center py-8 text-gray-500">
          <p>Earnings data not available for this stock.</p>
          <p className="text-sm mt-2">Run a new analysis to generate earnings projections.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Earnings & Valuation</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChart(true)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              showChart
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setShowChart(false)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              !showChart
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Summary
          </button>
        </div>
      </div>

      {showChart ? (
        <EarningsChart
          historicalEarnings={historicalEarnings}
          padProjections={padProjections}
          dcfProjections={dcfProjections}
          netIncomeAverage={netIncomeAverage}
          growthRate={growthRate}
        />
      ) : (
        <EarningsKeyMetrics
          netIncomeAverage={netIncomeAverage}
          growthRate={growthRate}
          latestEarnings={latestEarnings}
          padValue={padValue}
          dcfValue={dcfValue}
          bookValue={bookValue}
          marketCap={stock.market_cap || 0}
        />
      )}

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wide">P/E Ratio</div>
          <div className="text-lg font-semibold text-gray-900">
            {metrics.pe_ratio && typeof metrics.pe_ratio === 'number'
              ? metrics.pe_ratio.toFixed(1)
              : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wide">EPS</div>
          <div className="text-lg font-semibold text-gray-900">
            {metrics.eps && typeof metrics.eps === 'number'
              ? formatCurrency(metrics.eps)
              : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wide">ROE</div>
          <div className="text-lg font-semibold text-gray-900">
            {metrics.roe && typeof metrics.roe === 'number'
              ? `${(metrics.roe * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Growth Rate</div>
          <div className="text-lg font-semibold text-gray-900">
            {growthRate
              ? `${(growthRate * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  )
}
