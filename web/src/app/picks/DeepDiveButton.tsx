'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

type Run = {
  id: string
  status: RunStatus
  kind: 'manual' | 'scheduled'
  triggered_by: string | null
  total_stocks: number
  current_index: number
  current_ticker: string | null
  stocks_analyzed: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

type StatusPayload = {
  active: Run | null
  latest: Run | null
}

const POLL_MS_ACTIVE = 5_000
const POLL_MS_IDLE = 60_000

function fmtAge(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days}d ago`
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours}h ago`
  const mins = Math.max(1, Math.floor(ms / 60_000))
  return `${mins}m ago`
}

function fmtEta(run: Run): string | null {
  if (!run.started_at || run.current_index <= 0 || run.total_stocks <= 0) return null
  const elapsed = Date.now() - new Date(run.started_at).getTime()
  const perStock = elapsed / run.current_index
  const remaining = perStock * (run.total_stocks - run.current_index)
  if (!Number.isFinite(remaining) || remaining <= 0) return null
  const hours = remaining / 3_600_000
  if (hours >= 1) return `~${hours.toFixed(1)}h left`
  const mins = Math.max(1, Math.round(remaining / 60_000))
  return `~${mins}m left`
}

export function DeepDiveButton() {
  const [active, setActive] = useState<Run | null>(null)
  const [latest, setLatest] = useState<Run | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/deep-dive/status', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as StatusPayload
      setActive(data.active)
      setLatest(data.latest)
    } catch {
      // Network blips during polling are non-fatal.
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, active ? POLL_MS_ACTIVE : POLL_MS_IDLE)
    return () => clearInterval(interval)
  }, [fetchStatus, active])

  const onClick = async (force = false) => {
    setSubmitting(true)
    setError(null)
    setNeedsAuth(false)
    try {
      const res = await fetch('/api/deep-dive/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAuth(true)
        } else {
          setError(data?.error ?? `Request failed (${res.status}).`)
        }
        if (data?.run) setActive(data.run.status === 'pending' || data.run.status === 'running' ? data.run : null)
      } else {
        setActive(data.run)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const isInFlight = active && (active.status === 'pending' || active.status === 'running')
  const eta = isInFlight ? fmtEta(active!) : null
  const pct =
    isInFlight && active!.total_stocks > 0
      ? Math.min(100, Math.round((active!.current_index / active!.total_stocks) * 100))
      : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Deep Dive</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Re-run MOSEE across the entire market. Runs automatically once a month.
          </p>
        </div>

        {!isInFlight && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClick(false)}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:bg-blue-300"
          >
            {submitting ? 'Starting…' : 'Run Deep Dive'}
          </button>
        )}
      </div>

      {isInFlight && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>
              {active!.status === 'pending' ? 'Waiting for runner…' : 'Running'}
              {active!.current_ticker ? ` ✦ ${active!.current_ticker}` : ''}
            </span>
            <span className="tabular-nums text-gray-500">
              {active!.current_index}/{active!.total_stocks || '—'}
              {eta ? ` ✦ ${eta}` : ''}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-100">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Started {fmtAge(active!.started_at ?? active!.created_at)} • triggered by{' '}
            {active!.triggered_by ?? 'unknown'} ({active!.kind})
          </p>
        </div>
      )}

      {!isInFlight && latest && (
        <p className="mt-3 text-xs text-gray-500">
          Last run: {latest.status} • {fmtAge(latest.finished_at ?? latest.created_at)} •{' '}
          {latest.stocks_analyzed} stocks
          {latest.status === 'failed' && latest.error_message ? ` • ${latest.error_message}` : ''}
        </p>
      )}

      {needsAuth && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          You need to be signed in to run a deep dive.{' '}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent('/picks')}`}
            className="font-medium underline hover:text-amber-700"
          >
            Sign in
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
          <p className="text-amber-900">{error}</p>
          {error.toLowerCase().includes('cooldown') && (
            <button
              type="button"
              onClick={() => onClick(true)}
              className="mt-2 text-amber-900 underline hover:text-amber-700"
            >
              Run anyway
            </button>
          )}
        </div>
      )}
    </div>
  )
}
