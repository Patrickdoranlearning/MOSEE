'use client'

import { useState } from 'react'
import { QualityBreakdown, QualityComponent } from '@/types/mosee'

interface QualityScoreBreakdownProps {
  breakdown: QualityBreakdown | null | undefined
}

const COMPONENT_COLORS: Record<string, string> = {
  'Graham (Value/Safety)': 'bg-blue-500',
  'Buffett (Quality)': 'bg-purple-500',
  'Lynch (GARP)': 'bg-emerald-500',
  'Greenblatt (Magic Formula)': 'bg-amber-500',
  'Fisher (Growth)': 'bg-rose-500',
}

const COMPONENT_SHORT_NAMES: Record<string, string> = {
  'Graham (Value/Safety)': 'Graham',
  'Buffett (Quality)': 'Buffett',
  'Lynch (GARP)': 'Lynch',
  'Greenblatt (Magic Formula)': 'Greenblatt',
  'Fisher (Growth)': 'Fisher',
}

function ComponentBar({ component }: { component: QualityComponent }) {
  const color = COMPONENT_COLORS[component.name] || 'bg-gray-500'
  const shortName = COMPONENT_SHORT_NAMES[component.name] || component.name
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
          <span className="font-medium text-sm text-gray-900 truncate">{shortName}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-700">
            {component.score.toFixed(0)}/100
          </span>
          <span className="text-xs text-gray-400">
            ×{(component.weight * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-gray-400">{showDetails ? '−' : '+'}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, component.score)}%` }}
        />
      </div>

      {/* Contribution */}
      <div className="mt-1 text-xs text-gray-500 text-right">
        Contributes {component.weighted_score.toFixed(1)} pts to total
      </div>

      {/* Details (expandable) */}
      {showDetails && Object.keys(component.details).length > 0 && (
        <div className="mt-2 bg-gray-50 rounded p-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(component.details).map(([key, val]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-gray-500">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className="font-mono text-gray-700">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function QualityScoreBreakdown({ breakdown }: QualityScoreBreakdownProps) {
  const [open, setOpen] = useState(false)

  if (!breakdown || !breakdown.components || breakdown.components.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quality Score Breakdown</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Score: {breakdown.total_score.toFixed(0)}/100 ({breakdown.grade}) — {breakdown.investment_style.replace(/_/g, ' ')} weighting
          </p>
        </div>
        <span className="text-gray-400 text-lg">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {breakdown.components.map((comp, i) => (
            <ComponentBar key={i} component={comp} />
          ))}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {breakdown.strengths.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                  Strengths
                </div>
                {breakdown.strengths.map((s, i) => (
                  <div key={i} className="text-sm text-green-800">+ {s}</div>
                ))}
              </div>
            )}
            {breakdown.weaknesses.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
                  Weaknesses
                </div>
                {breakdown.weaknesses.map((w, i) => (
                  <div key={i} className="text-sm text-red-800">- {w}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
