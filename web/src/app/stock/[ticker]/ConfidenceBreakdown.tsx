'use client'

import { useState } from 'react'
import { ConfidenceBreakdownData } from '@/types/mosee'

interface ConfidenceBreakdownProps {
  data: ConfidenceBreakdownData | null | undefined
  /** Fallback values from top-level stock fields */
  fallbackLevel?: string | null
  fallbackScore?: number | null
}

function ScoreBar({ label, score, description }: { label: string; score: number; description?: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{score.toFixed(0)}/100</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor(score)}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
  )
}

export function ConfidenceBreakdown({ data, fallbackLevel, fallbackScore }: ConfidenceBreakdownProps) {
  const [showDetails, setShowDetails] = useState(false)

  const level = data?.level || fallbackLevel
  // Confidence score is already 0-100 from the backend — do NOT multiply by 100
  const score = data?.score ?? fallbackScore

  if (!level) return null

  const getLevelColor = (l: string) => {
    switch (l.toUpperCase()) {
      case 'HIGH': return 'text-green-600 bg-green-50'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50'
      case 'LOW': return 'text-red-600 bg-red-50'
      case 'SPECULATIVE': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const hasBreakdown = data && data.data_quality_score != null && data.metric_consistency_score != null

  // Extract detail descriptions for tooltips
  const dqDetails = data?.details?.data_quality as Record<string, unknown> | undefined
  const mcDetails = data?.details?.metric_consistency as Record<string, unknown> | undefined

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Confidence</h2>

      {/* Overall level */}
      <div className={`text-center p-4 rounded-lg ${getLevelColor(level)}`}>
        <div className="text-2xl font-bold">{level}</div>
        {score != null && (
          <div className="text-sm mt-1 opacity-80">
            Score: {score.toFixed(0)}%
          </div>
        )}
      </div>

      {/* Breakdown */}
      {hasBreakdown && (
        <div className="mt-4 space-y-3">
          <ScoreBar
            label="Data Quality"
            score={data.data_quality_score}
            description="Completeness of financial statements, cash flow, balance sheet"
          />
          <ScoreBar
            label="Metric Consistency"
            score={data.metric_consistency_score}
            description="Agreement between DCF, PAD, and Book Value methods"
          />

          {/* Expandable details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-700 mt-2"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-3">
              {/* Data Quality details */}
              {dqDetails && (
                <div>
                  <div className="font-semibold text-gray-600 mb-1">Data Quality Details</div>
                  <div className="space-y-0.5">
                    {dqDetails.cash_flow_years != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cash Flow Data</span>
                        <span className="text-gray-700">{String(dqDetails.cash_flow_years)}</span>
                      </div>
                    )}
                    {dqDetails.has_net_income != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Net Income Available</span>
                        <span className={dqDetails.has_net_income ? 'text-green-600' : 'text-red-600'}>
                          {dqDetails.has_net_income ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {dqDetails.balance_sheet_fields != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Balance Sheet</span>
                        <span className="text-gray-700">{String(dqDetails.balance_sheet_fields)}</span>
                      </div>
                    )}
                    {dqDetails.has_market_cap != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Market Cap</span>
                        <span className={dqDetails.has_market_cap ? 'text-green-600' : 'text-red-600'}>
                          {dqDetails.has_market_cap ? 'Available' : 'Missing'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metric Consistency details */}
              {mcDetails && (
                <div>
                  <div className="font-semibold text-gray-600 mb-1">Metric Consistency Details</div>
                  <div className="space-y-0.5">
                    {mcDetails.agreement_level != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Agreement Level</span>
                        <span className="text-gray-700 capitalize">{String(mcDetails.agreement_level)}</span>
                      </div>
                    )}
                    {mcDetails.coefficient_of_variation != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Coefficient of Variation</span>
                        <span className="font-mono text-gray-700">{Number(mcDetails.coefficient_of_variation).toFixed(3)}</span>
                      </div>
                    )}
                    {mcDetails.methods_compared != null && Array.isArray(mcDetails.methods_compared) && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Methods Compared</span>
                        <span className="text-gray-700 uppercase">{(mcDetails.methods_compared as string[]).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hint for old analyses */}
      {!hasBreakdown && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Run a new analysis to see confidence breakdown details.
        </p>
      )}
    </div>
  )
}
