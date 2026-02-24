'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ReAnalyseButtonProps {
  ticker: string
}

export function ReAnalyseButton({ ticker }: ReAnalyseButtonProps) {
  const [state, setState] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const router = useRouter()

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (state === 'running') {
      interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state])

  const progressMessage = () => {
    if (elapsed < 8) return 'Fetching market data...'
    if (elapsed < 20) return 'Downloading financial statements...'
    if (elapsed < 35) return 'Calculating valuation models...'
    if (elapsed < 50) return 'Generating intelligence report...'
    if (elapsed < 70) return 'Saving results...'
    return 'Almost done...'
  }

  const handleReAnalyse = async () => {
    setState('running')
    setError(null)
    setElapsed(0)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const response = await fetch(`/api/analyze/${ticker}`, {
        method: 'POST',
        signal: controller.signal,
      })

      const data = await response.json()

      if (data.status === 'success') {
        setState('success')
        router.refresh()
        // Reset to idle after page refreshes
        setTimeout(() => setState('idle'), 3000)
      } else {
        setState('error')
        setError(data.error || 'Analysis failed')
      }
    } catch (err) {
      setState('error')
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Analysis timed out. Please try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to run analysis')
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  if (state === 'running') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium">
        <svg
          className="animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <span>{progressMessage()}</span>
        <span className="text-xs text-gray-400">{elapsed}s</span>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Updated! Reloading...
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={handleReAnalyse}
        disabled={state === 'error'}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6" />
          <path d="M2.5 22v-6h6" />
          <path d="M2.5 11.5a10 10 0 0 1 18.4-4.5" />
          <path d="M21.5 12.5a10 10 0 0 1-18.4 4.5" />
        </svg>
        Re-Analyse
      </button>
      {state === 'error' && error && (
        <div className="absolute top-full right-0 mt-1 z-10 w-64">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">
            <p>{error}</p>
            <button
              onClick={handleReAnalyse}
              className="mt-1 text-red-700 underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
