'use client'

import { Verdict, VERDICT_COLORS } from '@/types/mosee'

interface VerdictBadgeProps {
  verdict: Verdict
  size?: 'sm' | 'md' | 'lg'
}

export function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  const color = VERDICT_COLORS[verdict]
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  }
  
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full text-white ${sizeClasses[size]}`}
      style={{ backgroundColor: color }}
    >
      {verdict}
    </span>
  )
}
