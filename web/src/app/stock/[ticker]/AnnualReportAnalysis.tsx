'use client'

import { useState, useEffect } from 'react'
import { AIAnalysis, AIDimension } from '@/types/mosee'

interface Props {
  ticker: string
}

function ScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const width = Math.max(0, Math.min(100, score))
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-blue-500' :
    score >= 40 ? 'bg-yellow-500' :
    'bg-red-500'

  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2'
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className={`w-full ${trackHeight} bg-gray-200 rounded-full overflow-hidden`}>
      <div
        className={`${barHeight} ${color} rounded-full transition-all duration-500`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function DimensionCard({ dimension }: { dimension: AIDimension }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900 text-sm">{dimension.name}</h4>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{dimension.score}/100</span>
            <span className="text-xs text-gray-400">
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>
        <ScoreBar score={dimension.score} size="sm" />
        <p className="text-xs text-gray-500 mt-2">{dimension.summary}</p>
      </button>

      {expanded && dimension.evidence.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Evidence (confidence: {(dimension.confidence * 100).toFixed(0)}%)
          </p>
          <ul className="space-y-1.5">
            {dimension.evidence.map((ev, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-blue-400 mt-0.5 shrink-0">&bull;</span>
                <span className="italic">&ldquo;{ev}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AnnualReportAnalysis({ ticker }: Props) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check for existing analysis on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch(`/api/ai-analysis/${ticker}`)
        const data = await res.json()
        if (data.status === 'found' && data.analysis) {
          setAnalysis(data.analysis)
        }
      } catch {
        // No existing analysis — that's fine
      } finally {
        setChecking(false)
      }
    }
    checkExisting()
  }, [ticker])

  async function runAnalysis() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/ai-analysis/${ticker}`, { method: 'POST' })
      const data = await res.json()

      if (data.status === 'completed' && data.analysis) {
        setAnalysis(data.analysis)
      } else if (data.status === 'error') {
        setError(data.error || 'Analysis failed')
      } else {
        setError('Analysis completed but no results returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Still checking for existing analysis
  if (checking) {
    return null
  }

  // No analysis yet — show trigger button
  if (!analysis) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI Annual Report Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              AI reads the last 3 years of 10-K filings through the lens of Buffett, Graham, and Fisher
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing 10-K Filings...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Analysis
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    )
  }

  // Show analysis results
  const dimensions = analysis.dimensions || []
  const compositeScore = analysis.composite_ai_score || 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">AI Annual Report Analysis</h2>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
            Score: {compositeScore.toFixed(0)}/100
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Filings: {(analysis.filing_years || []).join(', ')}</span>
          <span>&bull;</span>
          <span>{analysis.model_used}</span>
        </div>
      </div>

      {/* Executive Summary */}
      {analysis.executive_summary && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-indigo-900">{analysis.executive_summary}</p>
        </div>
      )}

      {/* Composite Score Bar */}
      <div className="mb-6">
        <ScoreBar score={compositeScore} />
      </div>

      {/* Dimension Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {dimensions.map((dim, i) => (
          <DimensionCard key={i} dimension={dim} />
        ))}
      </div>

      {/* Key Findings */}
      {analysis.key_findings && analysis.key_findings.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Findings</h3>
          <ul className="space-y-1.5">
            {analysis.key_findings.map((finding, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-blue-500 shrink-0">&bull;</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competitive Advantages & Red Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {analysis.competitive_advantages && analysis.competitive_advantages.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-800 mb-2">Competitive Advantages</h3>
            <ul className="space-y-1.5">
              {analysis.competitive_advantages.map((adv, i) => (
                <li key={i} className="text-sm text-green-700 flex gap-2">
                  <span className="shrink-0">+</span>
                  {adv}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.red_flags && analysis.red_flags.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Red Flags</h3>
            <ul className="space-y-1.5">
              {analysis.red_flags.map((flag, i) => (
                <li key={i} className="text-sm text-amber-700 flex gap-2">
                  <span className="shrink-0">!</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Management Assessment */}
      {analysis.management_assessment && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Management Assessment</h3>
          <p className="text-sm text-gray-600">{analysis.management_assessment}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Powered by {analysis.model_used} &bull; AI-generated analysis &bull; Not investment advice
        </p>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {loading ? 'Re-analyzing...' : 'Re-run Analysis'}
        </button>
      </div>
    </div>
  )
}
