'use client'

import { useState } from 'react'
import type {
  TreeTierConfig,
  WealthDashboard,
  CureNumber,
} from '@/types/wealth-tree'
import { SEVEN_CURES, TIER_COLORS } from '@/types/wealth-tree'
import { CureCard } from './CureCard'

interface TreeTierCardProps {
  config: TreeTierConfig
  dashboard: WealthDashboard
  defaultExpanded?: boolean
}

export function TreeTierCard({
  config,
  dashboard,
  defaultExpanded = true,
}: TreeTierCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const colors = TIER_COLORS[config.tier]
  const tierCures = SEVEN_CURES.filter((c) => config.cures.includes(c.number))
  const tierGoals = dashboard.goals_by_tier[config.tier] ?? {
    total: 0,
    completed: 0,
  }

  // Average score of cures in this tier
  const cureScores = config.cures.map(
    (n) => dashboard.cure_scores[n as CureNumber] ?? 0
  )
  const avgScore =
    cureScores.length > 0
      ? cureScores.reduce((a, b) => a + b, 0) / cureScores.length
      : 0
  const roundedAvg = Math.round(avgScore)

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Thriving'
    if (score >= 60) return 'Healthy'
    if (score >= 40) return 'Growing'
    if (score >= 20) return 'Developing'
    return 'Needs Attention'
  }

  const getHealthBarColor = (score: number): string => {
    if (score >= 66) return 'bg-green-500'
    if (score >= 33) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div
      className={`rounded-xl border-2 ${colors.border} ${colors.bg} overflow-hidden transition-all`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/80 border shadow-sm"
            style={{ borderColor: colors.accent }}
          >
            <TierIcon tier={config.tier} accent={colors.accent} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-lg font-bold ${colors.text}`}>
                {config.label}
              </h3>
              <span className="text-sm text-gray-500">{config.subtitle}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Health indicator */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {getHealthLabel(roundedAvg)}
              </span>
              <span className={`text-sm font-bold ${colors.text}`}>
                {roundedAvg}
              </span>
            </div>
            <div className="w-24 h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${getHealthBarColor(roundedAvg)} transition-all duration-500`}
                style={{ width: `${roundedAvg}%` }}
              />
            </div>
          </div>

          {/* Goals count */}
          {tierGoals.total > 0 && (
            <div className="hidden sm:block text-xs text-gray-500">
              {tierGoals.completed}/{tierGoals.total} goals
            </div>
          )}

          {/* Expand/collapse chevron */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          {/* Mobile health bar */}
          <div className="sm:hidden mb-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${getHealthBarColor(roundedAvg)} transition-all duration-500`}
                style={{ width: `${roundedAvg}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{roundedAvg}/100</span>
          </div>

          {/* Cure cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tierCures.map((cure) => (
              <CureCard
                key={cure.number}
                cure={cure}
                score={
                  dashboard.cure_scores[cure.number as CureNumber] ?? 0
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Small SVG icons for each tier
function TierIcon({ tier, accent }: { tier: string; accent: string }) {
  const iconClass = 'w-5 h-5'

  switch (tier) {
    case 'fruits':
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="14" r="7" />
          <path d="M12 7V3" />
          <path d="M9 3c3 0 4 2 4 4" />
        </svg>
      )
    case 'canopy':
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22V8" />
          <path d="M5 12H2a10 10 0 0020 0h-3" />
          <path d="M8 8a4 4 0 018 0" />
        </svg>
      )
    case 'branches':
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22V2" />
          <path d="M12 8l-4-4" />
          <path d="M12 8l4-4" />
          <path d="M12 14l-6-3" />
          <path d="M12 14l6-3" />
        </svg>
      )
    case 'trunk':
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="4" width="6" height="16" rx="2" />
          <path d="M9 10H6" />
          <path d="M15 14h3" />
        </svg>
      )
    case 'roots':
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v8" />
          <path d="M12 10c-3 4-7 8-9 10" />
          <path d="M12 10c3 4 7 8 9 10" />
          <path d="M12 14c-1 3-2 6-2 8" />
          <path d="M12 14c1 3 2 6 2 8" />
        </svg>
      )
    default:
      return null
  }
}
