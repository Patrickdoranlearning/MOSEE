'use client'

import { useState } from 'react'

interface DownloadReportButtonProps {
  ticker: string
}

export function DownloadReportButton({ ticker }: DownloadReportButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownloadPDF = async () => {
    setIsLoading(true)
    setError(null)

    // Abort after 30 seconds to prevent hanging
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(`/api/report/${ticker}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate report')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticker}_MOSEE_Report.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Report generation timed out. Please try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to download report')
      }
    } finally {
      clearTimeout(timeout)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleDownloadPDF}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
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
        ) : (
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        Download PDF Report
      </button>
      {error && (
        <p className="absolute top-full left-0 mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
