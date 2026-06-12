'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TeachingCard } from '@/components/wealth-tree/TeachingCard'
import { formatWealthCurrency } from '@/types/wealth-tree'
import type { NetWorthSnapshot } from '@/types/wealth-tree'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatWealthCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

interface DerivedSnapshot {
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: { savings: number; investments: number; debt: number }
}

export default function NetWorthPage() {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    snapshot_date: new Date().toISOString().split('T')[0],
    total_assets: '',
    total_liabilities: '',
  })

  // Auto-snapshot (derived from current dashboard totals) state
  const [deriving, setDeriving] = useState(false)
  const [derived, setDerived] = useState<DerivedSnapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  async function handleDeriveSnapshot() {
    setDeriving(true)
    setSnapshotError(null)
    setShowForm(false)
    try {
      const res = await fetch('/api/wealth-tree/dashboard')
      if (!res.ok) throw new Error('Failed to load current data')
      const dashboard = await res.json()
      // Coerce defensively — dashboard numbers may arrive as strings/null.
      const savings = Number(dashboard.total_savings) || 0
      const investments = Number(dashboard.total_investments) || 0
      const debt = Number(dashboard.total_debt) || 0
      const totalAssets = savings + investments
      setDerived({
        total_assets: totalAssets,
        total_liabilities: debt,
        net_worth: totalAssets - debt,
        breakdown: { savings, investments, debt },
      })
    } catch (e) {
      setSnapshotError(e instanceof Error ? e.message : 'Failed to compute snapshot')
    } finally {
      setDeriving(false)
    }
  }

  async function handleConfirmSnapshot() {
    if (!derived) return
    setSubmitting(true)
    setSnapshotError(null)
    try {
      const res = await fetch('/api/wealth-tree/net-worth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_date: new Date().toISOString().split('T')[0],
          total_assets: derived.total_assets,
          total_liabilities: derived.total_liabilities,
          breakdown: derived.breakdown,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save snapshot')
      }
      await fetchSnapshots()
      setDerived(null)
    } catch (e) {
      setSnapshotError(e instanceof Error ? e.message : 'Failed to save snapshot')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchSnapshots()
  }, [])

  async function fetchSnapshots() {
    try {
      const res = await fetch('/api/wealth-tree/net-worth')
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data)
      }
    } catch (e) {
      console.error('Failed to fetch net worth:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/wealth-tree/net-worth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_date: form.snapshot_date,
          total_assets: Number(form.total_assets),
          total_liabilities: Number(form.total_liabilities),
        }),
      })
      if (res.ok) {
        await fetchSnapshots()
        setShowForm(false)
        setForm({ snapshot_date: new Date().toISOString().split('T')[0], total_assets: '', total_liabilities: '' })
      }
    } catch (e) {
      console.error('Failed to save snapshot:', e)
    } finally {
      setSubmitting(false)
    }
  }

  // Chart data sorted by date ascending
  const chartData = [...snapshots]
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map(s => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      'Net Worth': Number(s.net_worth),
      'Assets': Number(s.total_assets),
      'Liabilities': Number(s.total_liabilities),
    }))

  const latest = snapshots.length > 0 ? snapshots[0] : null
  const previous = snapshots.length > 1 ? snapshots[1] : null
  const change = latest && previous ? Number(latest.net_worth) - Number(previous.net_worth) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Net Worth</h1>
          <p className="text-gray-500 text-sm mt-1">Track your wealth over time</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDeriveSnapshot} disabled={deriving}
            className="px-4 py-2 bg-white border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
            {deriving ? 'Computing...' : 'Snapshot from current data'}
          </button>
          <button onClick={() => { setShowForm(!showForm); setDerived(null) }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add manually'}
          </button>
        </div>
      </div>

      <TeachingCard topics={['net-worth', 'compounding']} />

      {/* Snapshot error */}
      {snapshotError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{snapshotError}</p>
        </div>
      )}

      {/* Auto-snapshot confirm step */}
      {derived && (
        <div className="bg-white rounded-xl border-2 border-green-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Confirm snapshot</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Derived from your current savings, investments, and debt totals as of today.
              Review before saving.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Savings</p>
              <p className="text-lg font-bold text-gray-900">
                {formatWealthCurrency(derived.breakdown.savings)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Investments</p>
              <p className="text-lg font-bold text-gray-900">
                {formatWealthCurrency(derived.breakdown.investments)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Debt</p>
              <p className="text-lg font-bold text-gray-900">
                {formatWealthCurrency(derived.breakdown.debt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Total Assets</p>
              <p className="text-xl font-bold text-green-600">
                {formatWealthCurrency(derived.total_assets)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Liabilities</p>
              <p className="text-xl font-bold text-red-600">
                {formatWealthCurrency(derived.total_liabilities)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Worth</p>
              <p className="text-xl font-bold text-gray-900">
                {formatWealthCurrency(derived.net_worth)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleConfirmSnapshot} disabled={submitting}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save this snapshot'}
            </button>
            <button onClick={() => setDerived(null)} disabled={submitting}
              className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Current Net Worth</p>
          <p className="text-2xl font-bold text-gray-900">
            {latest ? formatWealthCurrency(Number(latest.net_worth)) : '$0'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-green-600">
            {latest ? formatWealthCurrency(Number(latest.total_assets)) : '$0'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600">
            {latest ? formatWealthCurrency(Number(latest.total_liabilities)) : '$0'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Monthly Change</p>
          <p className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change !== 0 ? `${change >= 0 ? '+' : ''}${formatWealthCurrency(change)}` : '-'}
          </p>
        </div>
      </div>

      {/* Add Snapshot Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.snapshot_date} onChange={e => setForm({ ...form, snapshot_date: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Assets</label>
              <input type="number" step="0.01" value={form.total_assets} onChange={e => setForm({ ...form, total_assets: e.target.value })} required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Liabilities</label>
              <input type="number" step="0.01" value={form.total_liabilities} onChange={e => setForm({ ...form, total_liabilities: e.target.value })} required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Snapshot'}
          </button>
        </form>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Net Worth Over Time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => formatWealthCurrency(v)} tick={{ fontSize: 12 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Net Worth" stroke="#059669" fill="#d1fae5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History Table */}
      {snapshots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Assets</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Liabilities</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Net Worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(s.snapshot_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                    {formatWealthCurrency(Number(s.total_assets))}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                    {formatWealthCurrency(Number(s.total_liabilities))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                    {formatWealthCurrency(Number(s.net_worth))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
