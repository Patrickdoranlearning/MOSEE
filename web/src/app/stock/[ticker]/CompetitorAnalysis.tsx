import Link from 'next/link'
import { VerdictBadge } from '@/components/VerdictBadge'
import { QualityBadge } from '@/components/QualityBadge'
import type { StockAnalysis } from '@/types/mosee'
import { formatCurrency, formatMoS } from '@/types/mosee'

interface CompetitorAnalysisProps {
  stock: StockAnalysis
  peers: StockAnalysis[]
}

export function CompetitorAnalysis({ stock, peers }: CompetitorAnalysisProps) {
  if (!stock.industry) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">No industry data available for competitor comparison.</p>
      </div>
    )
  }

  if (peers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Competitor Analysis</h2>
        <p className="text-gray-500">
          No other companies in <span className="font-medium">{stock.industry}</span> have been analysed yet.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Run analysis on more stocks in this industry to enable comparisons.
        </p>
      </div>
    )
  }

  const allCompanies = [stock, ...peers]
  const metrics = (s: StockAnalysis) => (s.all_metrics || {}) as Record<string, unknown>

  const safeNum = (val: unknown): number | null => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return null
    return val
  }

  const formatPct = (val: unknown) => {
    const n = safeNum(val)
    if (n == null) return 'N/A'
    return `${(n * 100).toFixed(1)}%`
  }

  const formatRatio = (val: unknown) => {
    const n = safeNum(val)
    if (n == null) return 'N/A'
    return n.toFixed(2)
  }

  // Rank helpers — returns 1-based rank (1 = best)
  const rankDesc = (values: (number | null)[]) => {
    const sorted = values
      .map((v, i) => ({ v, i }))
      .filter(x => x.v != null)
      .sort((a, b) => (b.v as number) - (a.v as number))
    const ranks = new Array(values.length).fill(null)
    sorted.forEach((x, rank) => { ranks[x.i] = rank + 1 })
    return ranks
  }

  const rankAsc = (values: (number | null)[]) => {
    const sorted = values
      .map((v, i) => ({ v, i }))
      .filter(x => x.v != null)
      .sort((a, b) => (a.v as number) - (b.v as number))
    const ranks = new Array(values.length).fill(null)
    sorted.forEach((x, rank) => { ranks[x.i] = rank + 1 })
    return ranks
  }

  const getRankColor = (rank: number | null, total: number) => {
    if (rank == null) return ''
    if (rank === 1) return 'bg-green-50 text-green-700 font-semibold'
    if (rank === 2 && total > 2) return 'bg-emerald-50 text-emerald-700'
    if (rank === total) return 'bg-red-50 text-red-600'
    return ''
  }

  // Compute mosee scores for ranking
  const moseeScores = allCompanies.map(s => safeNum(s.pad_mosee ?? s.dcf_mosee ?? s.book_mosee))
  const qualityScores = allCompanies.map(s => safeNum(s.quality_score))
  const mosValues = allCompanies.map(s => safeNum(s.margin_of_safety))
  const roeValues = allCompanies.map(s => safeNum(metrics(s).roe))
  const roicValues = allCompanies.map(s => safeNum(metrics(s).roic))
  const peValues = allCompanies.map(s => safeNum(metrics(s).pe_ratio))
  const pegValues = allCompanies.map(s => safeNum(metrics(s).peg_ratio))
  const debtValues = allCompanies.map(s => safeNum(metrics(s).debt_to_equity))
  const growthValues = allCompanies.map(s => safeNum(metrics(s).earnings_growth))
  const mcapValues = allCompanies.map(s => safeNum(s.market_cap))

  const moseeRanks = rankDesc(moseeScores)
  const qualityRanks = rankDesc(qualityScores)
  const mosRanks = rankAsc(mosValues) // lower MoS ratio = better (more undervalued)
  const roeRanks = rankDesc(roeValues)
  const roicRanks = rankDesc(roicValues)
  const peRanks = rankAsc(peValues) // lower PE = cheaper
  const pegRanks = rankAsc(pegValues) // lower PEG = better
  const debtRanks = rankAsc(debtValues) // lower debt = better
  const growthRanks = rankDesc(growthValues)

  const total = allCompanies.length

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">Competitor Analysis</h2>
          <span className="text-sm text-gray-500">{stock.industry}</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Comparing {stock.ticker} against {peers.length} peer{peers.length !== 1 ? 's' : ''} in the same industry
        </p>

        {/* Comparison Table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-semibold text-gray-700 sticky left-0 bg-white min-w-[100px]">Metric</th>
                {allCompanies.map((s, i) => (
                  <th key={s.ticker} className={`text-center py-3 px-3 min-w-[120px] ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    <Link href={`/stock/${s.ticker}`} className="text-blue-600 hover:text-blue-700 font-bold">
                      {s.ticker}
                    </Link>
                    <div className="text-xs text-gray-400 font-normal truncate max-w-[120px]">
                      {s.company_name || ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Verdict */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Verdict</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    <VerdictBadge verdict={s.verdict} size="sm" />
                  </td>
                ))}
              </tr>

              {/* Quality */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Quality</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''} ${getRankColor(qualityRanks[i], total)}`}>
                    <QualityBadge grade={s.quality_grade} score={s.quality_score} showScore />
                  </td>
                ))}
              </tr>

              {/* Price */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Price</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 font-medium ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    {formatCurrency(s.current_price)}
                  </td>
                ))}
              </tr>

              {/* Market Cap */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Market Cap</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    {formatCurrency(s.market_cap)}
                  </td>
                ))}
              </tr>

              {/* MOSEE Score */}
              <ComparisonRow
                label="MOSEE"
                values={moseeScores}
                ranks={moseeRanks}
                total={total}
                format={(v) => v != null ? v.toFixed(3) : 'N/A'}
              />

              {/* Margin of Safety */}
              <ComparisonRow
                label="MoS Ratio"
                values={mosValues}
                ranks={mosRanks}
                total={total}
                format={(v) => formatMoS(v)}
              />

              {/* Fair Value */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Fair Value</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    {formatCurrency(s.valuation_base)}
                  </td>
                ))}
              </tr>

              {/* P/E Ratio */}
              <ComparisonRow
                label="P/E"
                values={peValues}
                ranks={peRanks}
                total={total}
                format={(v) => formatRatio(v)}
              />

              {/* PEG Ratio */}
              <ComparisonRow
                label="PEG"
                values={pegValues}
                ranks={pegRanks}
                total={total}
                format={(v) => formatRatio(v)}
              />

              {/* ROE */}
              <ComparisonRow
                label="ROE"
                values={roeValues}
                ranks={roeRanks}
                total={total}
                format={(v) => formatPct(v)}
              />

              {/* ROIC */}
              <ComparisonRow
                label="ROIC"
                values={roicValues}
                ranks={roicRanks}
                total={total}
                format={(v) => formatPct(v)}
              />

              {/* Debt/Equity */}
              <ComparisonRow
                label="Debt/Equity"
                values={debtValues}
                ranks={debtRanks}
                total={total}
                format={(v) => formatRatio(v)}
              />

              {/* Earnings Growth */}
              <ComparisonRow
                label="Earnings Growth"
                values={growthValues}
                ranks={growthRanks}
                total={total}
                format={(v) => formatPct(v)}
              />

              {/* Confidence */}
              <tr>
                <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">Confidence</td>
                {allCompanies.map((s, i) => (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      s.confidence_level === 'HIGH' ? 'bg-green-100 text-green-700' :
                      s.confidence_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      s.confidence_level === 'LOW' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {s.confidence_level || 'N/A'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Where {stock.ticker} Ranks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <RankCard label="MOSEE Score" rank={moseeRanks[0]} total={total} />
          <RankCard label="Quality" rank={qualityRanks[0]} total={total} />
          <RankCard label="MoS (Value)" rank={mosRanks[0]} total={total} />
          <RankCard label="ROE" rank={roeRanks[0]} total={total} />
          <RankCard label="ROIC" rank={roicRanks[0]} total={total} />
          <RankCard label="P/E (Cheapness)" rank={peRanks[0]} total={total} />
          <RankCard label="Debt Level" rank={debtRanks[0]} total={total} />
          <RankCard label="Earnings Growth" rank={growthRanks[0]} total={total} />
        </div>
      </div>

      {/* Competitive Advantage — Fisher Scuttlebutt */}
      <CompetitiveAdvantageSection allCompanies={allCompanies} />
    </div>
  )
}

function ComparisonRow({
  label,
  values,
  ranks,
  total,
  format,
}: {
  label: string
  values: (number | null)[]
  ranks: (number | null)[]
  total: number
  format: (v: number | null) => string
}) {
  const getRankColor = (rank: number | null, total: number) => {
    if (rank == null) return ''
    if (rank === 1) return 'bg-green-50 text-green-700 font-semibold'
    if (rank === 2 && total > 2) return 'bg-emerald-50 text-emerald-700'
    if (rank === total) return 'bg-red-50 text-red-600'
    return ''
  }

  return (
    <tr>
      <td className="py-3 pr-4 text-gray-600 sticky left-0 bg-white">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''} ${getRankColor(ranks[i], total)}`}>
          {format(v)}
        </td>
      ))}
    </tr>
  )
}

// ============================================================================
// Competitive Advantage — Fisher Scuttlebutt Comparison
// ============================================================================

interface ScuttlebuttDimension {
  name: string
  score: number
  weight: number
  weighted_score: number
  detail: string
}

interface ScuttlebuttData {
  total_score: number
  grade: string
  dimensions: ScuttlebuttDimension[]
  strengths: string[]
  weaknesses: string[]
}

function CompetitiveAdvantageSection({ allCompanies }: { allCompanies: StockAnalysis[] }) {
  // Extract scuttlebutt data from all_metrics
  const scuttlebuttData = allCompanies.map(s => {
    const m = (s.all_metrics || {}) as Record<string, unknown>
    return m.scuttlebutt as ScuttlebuttData | undefined
  })

  // Check if any company has scuttlebutt data
  const hasAnyData = scuttlebuttData.some(d => d != null)
  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Competitive Advantage (Fisher Scuttlebutt)</h3>
        <p className="text-sm text-gray-500">
          Re-run analysis to generate scuttlebutt scores. This evaluates growth engine, margin power, R&D efficiency, operating leverage, capital stewardship, earnings quality, employee productivity, and insider alignment.
        </p>
      </div>
    )
  }

  const safeNum = (val: unknown): number | null => {
    if (val == null || typeof val !== 'number' || !isFinite(val)) return null
    return val
  }

  // Get total scores for ranking
  const totalScores = scuttlebuttData.map(d => safeNum(d?.total_score))
  const totalRanks = rankDesc(totalScores)
  const total = allCompanies.length

  // Get all dimension names from the first company that has data
  const dimNames = scuttlebuttData.find(d => d != null)?.dimensions.map(d => d.name) || []

  // Build per-dimension scores for comparison
  const dimScoresByName: Record<string, (number | null)[]> = {}
  for (const name of dimNames) {
    dimScoresByName[name] = scuttlebuttData.map(d => {
      const dim = d?.dimensions.find(dd => dd.name === name)
      return safeNum(dim?.score)
    })
  }

  const getGradeColor = (grade: string | undefined) => {
    if (!grade) return 'bg-gray-100 text-gray-600'
    if (grade === 'A') return 'bg-green-100 text-green-700'
    if (grade === 'B') return 'bg-emerald-100 text-emerald-700'
    if (grade === 'C') return 'bg-yellow-100 text-yellow-700'
    if (grade === 'D') return 'bg-orange-100 text-orange-700'
    return 'bg-red-100 text-red-700'
  }

  const getScoreColor = (score: number | null) => {
    if (score == null) return 'text-gray-400'
    if (score >= 70) return 'text-green-600 font-semibold'
    if (score >= 50) return 'text-yellow-600'
    if (score >= 35) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRankColor = (rank: number | null, total: number) => {
    if (rank == null) return ''
    if (rank === 1) return 'bg-green-50'
    if (rank === total) return 'bg-red-50'
    return ''
  }

  // Helper: rank descending (redefine locally since the outer one isn't accessible)
  function rankDesc(values: (number | null)[]) {
    const sorted = values
      .map((v, i) => ({ v, i }))
      .filter(x => x.v != null)
      .sort((a, b) => (b.v as number) - (a.v as number))
    const ranks = new Array(values.length).fill(null)
    sorted.forEach((x, rank) => { ranks[x.i] = rank + 1 })
    return ranks
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-900">Competitive Advantage</h3>
        <span className="text-xs text-gray-400">Fisher Scuttlebutt Analysis</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Who is likely to win over the next decade? Scores qualitative competitive signals from financial data.
      </p>

      {/* Overall Scuttlebutt Score */}
      <div className="overflow-x-auto -mx-6 px-6 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 pr-4 font-semibold text-gray-700 sticky left-0 bg-white min-w-[140px]">Dimension</th>
              {allCompanies.map((s, i) => (
                <th key={s.ticker} className={`text-center py-3 px-3 min-w-[100px] ${i === 0 ? 'bg-blue-50/50' : ''}`}>
                  <Link href={`/stock/${s.ticker}`} className="text-blue-600 hover:text-blue-700 font-bold text-xs">
                    {s.ticker}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Total Score */}
            <tr className="bg-gray-50/50 font-semibold">
              <td className="py-3 pr-4 text-gray-900 sticky left-0 bg-gray-50/50">Overall Score</td>
              {allCompanies.map((s, i) => {
                const d = scuttlebuttData[i]
                return (
                  <td key={s.ticker} className={`text-center py-3 px-3 ${i === 0 ? 'bg-blue-50/50' : ''} ${getRankColor(totalRanks[i], total)}`}>
                    {d ? (
                      <div>
                        <span className={getScoreColor(d.total_score)}>{d.total_score.toFixed(0)}</span>
                        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${getGradeColor(d.grade)}`}>{d.grade}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Per-Dimension Rows */}
            {dimNames.map(dimName => {
              const scores = dimScoresByName[dimName]
              const ranks = rankDesc(scores)
              return (
                <tr key={dimName}>
                  <td className="py-2.5 pr-4 text-gray-600 text-xs sticky left-0 bg-white">{dimName}</td>
                  {scores.map((score, i) => {
                    const dim = scuttlebuttData[i]?.dimensions.find(d => d.name === dimName)
                    return (
                      <td key={i} className={`text-center py-2.5 px-3 ${i === 0 ? 'bg-blue-50/50' : ''} ${getRankColor(ranks[i], total)}`}>
                        <div className={`text-xs ${getScoreColor(score)}`}>
                          {score != null ? score.toFixed(0) : 'N/A'}
                        </div>
                        {dim && (
                          <div className="text-[10px] text-gray-400 truncate max-w-[100px]" title={dim.detail}>
                            {dim.detail}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Strengths & Weaknesses for the primary stock */}
      {scuttlebuttData[0] && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          {scuttlebuttData[0].strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2">{allCompanies[0].ticker} Competitive Strengths</h4>
              <ul className="space-y-1">
                {scuttlebuttData[0].strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scuttlebuttData[0].weaknesses.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">{allCompanies[0].ticker} Competitive Weaknesses</h4>
              <ul className="space-y-1">
                {scuttlebuttData[0].weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">-</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RankCard({ label, rank, total }: { label: string; rank: number | null; total: number }) {
  if (rank == null) return null

  const isTop = rank === 1
  const isBottom = rank === total
  const color = isTop
    ? 'text-green-600 bg-green-50 border-green-200'
    : isBottom
    ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-gray-700 bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <div className="text-2xl font-bold">
        #{rank}
      </div>
      <div className="text-xs mt-1">of {total}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  )
}
