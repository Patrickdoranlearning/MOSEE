'use client'

import Link from 'next/link'
import type { CureConfig } from '@/types/wealth-tree'

interface CureCardProps {
  cure: CureConfig
  score: number // 0-100
}

function getScoreColor(score: number): {
  bar: string
  text: string
  bg: string
} {
  if (score >= 66) return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' }
  if (score >= 33) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' }
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' }
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 66) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 33) return 'Needs Work'
  return 'Critical'
}

export function CureCard({ cure, score }: CureCardProps) {
  const colors = getScoreColor(score)
  const clampedScore = Math.max(0, Math.min(100, score))

  return (
    <Link href={`/wealth-tree/learn/${cure.number}`}>
      <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
              {cure.number}
            </span>
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {cure.title}
            </h4>
          </div>
          <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {clampedScore}
          </div>
        </div>

        {/* Principle text */}
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {cure.principle}
        </p>

        {/* Mini progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {getScoreLabel(clampedScore)}
          </span>
        </div>
      </div>
    </Link>
  )
}
