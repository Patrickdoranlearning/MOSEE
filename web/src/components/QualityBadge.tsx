'use client'

import { QualityGrade, GRADE_COLORS } from '@/types/mosee'

interface QualityBadgeProps {
  grade: QualityGrade | null
  score?: number | null
  showScore?: boolean
}

export function QualityBadge({ grade, score, showScore = false }: QualityBadgeProps) {
  if (!grade) {
    return <span className="text-gray-400">N/A</span>
  }
  
  const color = GRADE_COLORS[grade]
  
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-flex items-center justify-center w-8 h-8 font-bold rounded-lg text-white"
        style={{ backgroundColor: color }}
      >
        {grade}
      </span>
      {showScore && score != null && (
        <span className="text-sm text-gray-500">({score.toFixed(0)})</span>
      )}
    </span>
  )
}
