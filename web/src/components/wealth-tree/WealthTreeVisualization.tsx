'use client'

import type { WealthDashboard } from '@/types/wealth-tree'
import { TREE_TIERS, TIER_COLORS } from '@/types/wealth-tree'
import { WealthSummaryCards } from './WealthSummaryCards'
import { TreeTierCard } from './TreeTierCard'

interface WealthTreeVisualizationProps {
  dashboard: WealthDashboard
}

export function WealthTreeVisualization({
  dashboard,
}: WealthTreeVisualizationProps) {
  // TREE_TIERS is already ordered: fruits -> canopy -> branches -> trunk -> roots
  // (top of tree to bottom), which is the render order we want.
  const tiers = TREE_TIERS

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <WealthSummaryCards dashboard={dashboard} />

      {/* Tree visualization */}
      <div className="relative">
        {/* Vertical trunk line connecting tiers */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 hidden lg:block">
          <div className="w-full h-full bg-gradient-to-b from-amber-300 via-green-400 to-stone-400 rounded-full opacity-40" />
        </div>

        {/* Tier cards */}
        <div className="relative space-y-4">
          {tiers.map((tierConfig, index) => {
            const colors = TIER_COLORS[tierConfig.tier]
            return (
              <div key={tierConfig.tier} className="relative">
                {/* Connector dot on the trunk line */}
                <div className="absolute left-1/2 top-6 -translate-x-1/2 hidden lg:flex items-center justify-center z-10">
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>

                {/* Tier card with slight indent on large screens */}
                <div className={`lg:mx-8 ${index % 2 === 0 ? 'lg:mr-16' : 'lg:ml-16'}`}>
                  <TreeTierCard
                    config={tierConfig}
                    dashboard={dashboard}
                    defaultExpanded={index < 2}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Overall tree health summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Overall Wealth Tree Health
        </h3>
        <OverallHealthBar dashboard={dashboard} />
      </div>
    </div>
  )
}

function OverallHealthBar({ dashboard }: { dashboard: WealthDashboard }) {
  const cureValues = Object.values(dashboard.cure_scores)
  const overallScore =
    cureValues.length > 0
      ? Math.round(cureValues.reduce((a, b) => a + b, 0) / cureValues.length)
      : 0

  const getLabel = (score: number): string => {
    if (score >= 80) return 'Your Wealth Tree is thriving!'
    if (score >= 60) return 'Your Wealth Tree is healthy and growing.'
    if (score >= 40) return 'Your Wealth Tree is developing -- keep going.'
    if (score >= 20) return 'Your Wealth Tree needs more attention.'
    return 'Time to plant the seeds of your Wealth Tree.'
  }

  const getBarColor = (score: number): string => {
    if (score >= 66) return 'bg-green-500'
    if (score >= 33) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">Overall Score</span>
        <span className="text-lg font-bold text-gray-900">{overallScore}/100</span>
      </div>
      <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${getBarColor(overallScore)} transition-all duration-700`}
          style={{ width: `${overallScore}%` }}
        />
      </div>
      <p className="text-sm text-gray-500">{getLabel(overallScore)}</p>
    </div>
  )
}
