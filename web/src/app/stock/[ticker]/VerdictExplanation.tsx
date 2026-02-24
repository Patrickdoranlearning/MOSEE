'use client'

import { useState } from 'react'
import { VerdictRationale, VerdictGate } from '@/types/mosee'

interface VerdictExplanationProps {
  rationale: VerdictRationale | null | undefined
  recommendationText: string | null | undefined
}

function GateStep({ gate, isLast }: { gate: VerdictGate; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Status icon + vertical line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            gate.passed ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {gate.passed ? '✓' : '✗'}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[16px] ${gate.passed ? 'bg-green-200' : 'bg-red-200'}`} />
        )}
      </div>

      {/* Content */}
      <div className="pb-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">{gate.gate}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              gate.passed
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {gate.passed ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{gate.detail}</p>
      </div>
    </div>
  )
}

export function VerdictExplanation({ rationale, recommendationText }: VerdictExplanationProps) {
  const [open, setOpen] = useState(true)

  // Show recommendation text even without full rationale data
  if (!rationale && !recommendationText) return null

  const gates = rationale?.gates || []
  const summary = rationale?.summary
  const thresholds = rationale?.thresholds

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-xl font-bold text-gray-900">How Did We Reach This Verdict?</h2>
        <span className="text-gray-400 text-lg">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4">
          {/* Summary / Recommendation */}
          {(summary || recommendationText) && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-5">
              <p className="text-sm font-medium text-blue-900">
                {summary || recommendationText}
              </p>
            </div>
          )}

          {/* Decision Gates */}
          {gates.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Decision Gates
              </h3>
              <div>
                {gates.map((gate, i) => (
                  <GateStep key={i} gate={gate} isLast={i === gates.length - 1} />
                ))}
              </div>
            </div>
          )}

          {/* Thresholds reference */}
          {thresholds && (
            <div className="bg-gray-50 rounded-lg p-3 mt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                MOSEE Thresholds Used
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">MOSEE min: </span>
                  <span className="font-mono font-medium text-gray-700">{thresholds.mosee_min}</span>
                </div>
                <div>
                  <span className="text-gray-500">Payback max: </span>
                  <span className="font-mono font-medium text-gray-700">{thresholds.payback_max} yrs</span>
                </div>
                <div>
                  <span className="text-gray-500">MoS required: </span>
                  <span className="font-mono font-medium text-gray-700">{(thresholds.mos_required * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Quality min: </span>
                  <span className="font-mono font-medium text-gray-700">{thresholds.quality_min}/100</span>
                </div>
                <div>
                  <span className="text-gray-500">Strong Buy MoS: </span>
                  <span className="font-mono font-medium text-gray-700">≤{(thresholds.strong_buy_mos * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Buy MoS: </span>
                  <span className="font-mono font-medium text-gray-700">≤{(thresholds.buy_mos * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Fallback for old analyses */}
          {!rationale && recommendationText && (
            <p className="text-xs text-gray-400 mt-3">
              Run a new analysis to see the full decision breakdown.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
