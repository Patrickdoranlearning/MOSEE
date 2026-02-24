'use client'

import { Verdict, VERDICT_COLORS } from '@/types/mosee'

interface VerdictCount {
  verdict: Verdict
  count: number
}

interface VerdictDistributionBarProps {
  verdictCounts: VerdictCount[]
  total: number
}

export function VerdictDistributionBar({ verdictCounts, total }: VerdictDistributionBarProps) {
  if (total === 0) return null

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {verdictCounts.map(({ verdict, count }) => {
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={verdict}
              className="relative group"
              style={{
                width: `${pct}%`,
                backgroundColor: VERDICT_COLORS[verdict],
              }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {verdict}: {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {verdictCounts.map(({ verdict, count }) => {
          if (count === 0) return null
          return (
            <div key={verdict} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: VERDICT_COLORS[verdict] }}
              />
              <span className="text-xs text-gray-500">
                {verdict.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')} ({count})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
