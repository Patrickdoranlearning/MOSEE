'use client'

import { StockSummary, Verdict, VERDICT_COLORS, VERDICT_PRIORITY, GRADE_COLORS, QualityGrade } from '@/types/mosee'
import { VerdictDistributionBar } from './VerdictDistributionBar'

interface MarketPulseProps {
  analyses: StockSummary[]
}

function getGradeForScore(score: number): QualityGrade {
  if (score >= 90) return 'A+'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'F'
}

export function MarketPulse({ analyses }: MarketPulseProps) {
  if (analyses.length === 0) return null

  // Verdict distribution
  const verdictMap = new Map<Verdict, number>()
  for (const a of analyses) {
    verdictMap.set(a.verdict, (verdictMap.get(a.verdict) || 0) + 1)
  }
  const verdictCounts = Array.from(verdictMap.entries())
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => (VERDICT_PRIORITY[a.verdict] || 99) - (VERDICT_PRIORITY[b.verdict] || 99))

  // Average quality score
  const qualityScores = analyses.filter(a => a.quality_score != null).map(a => a.quality_score!)
  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((s, v) => s + v, 0) / qualityScores.length
    : null
  const avgGrade = avgQuality != null ? getGradeForScore(avgQuality) : null

  // Best MOSEE score
  let bestMosee: StockSummary | null = null
  let bestMoseeScore = -Infinity
  for (const a of analyses) {
    const score = a.pad_mosee ?? a.dcf_mosee ?? a.book_mosee ?? -Infinity
    if (score > bestMoseeScore) {
      bestMoseeScore = score
      bestMosee = a
    }
  }

  // Stocks with MoS
  const mosCount = analyses.filter(a => a.has_margin_of_safety).length

  // Top 3 industries
  const industryMap = new Map<string, number>()
  for (const a of analyses) {
    if (a.industry) {
      industryMap.set(a.industry, (industryMap.get(a.industry) || 0) + 1)
    }
  }
  const topIndustries = Array.from(industryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="bg-white border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Market Pulse</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {/* Verdict Distribution */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-xs text-gray-400 mb-2">Verdict Spread</p>
            <VerdictDistributionBar verdictCounts={verdictCounts} total={analyses.length} />
          </div>

          {/* Average Quality */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Avg Quality</p>
            {avgQuality != null && avgGrade ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 font-bold rounded-lg text-white text-sm"
                  style={{ backgroundColor: GRADE_COLORS[avgGrade] }}
                >
                  {avgGrade}
                </span>
                <span className="text-lg font-bold text-gray-900">{avgQuality.toFixed(0)}</span>
              </div>
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </div>

          {/* Best MOSEE */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Top MOSEE</p>
            {bestMosee && bestMoseeScore > -Infinity ? (
              <div>
                <span className="text-lg font-bold text-green-600">{bestMoseeScore.toFixed(3)}</span>
                <p className="text-xs text-gray-500 font-medium">{bestMosee.ticker}</p>
              </div>
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </div>

          {/* MoS Count */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Margin of Safety</p>
            <div>
              <span className="text-lg font-bold text-gray-900">{mosCount}</span>
              <span className="text-sm text-gray-400">/{analyses.length}</span>
            </div>
            <p className="text-xs text-gray-500">stocks below fair value</p>
          </div>

          {/* Top Industries */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-xs text-gray-400 mb-2">Top Industries</p>
            <div className="space-y-1">
              {topIndustries.map(([industry, count]) => (
                <div key={industry} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate mr-2">{industry}</span>
                  <span className="text-gray-400 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
