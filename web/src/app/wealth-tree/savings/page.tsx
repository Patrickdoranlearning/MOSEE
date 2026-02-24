'use client'

import { useState, useEffect, useCallback } from 'react'
import { SavingsRateGauge } from '@/components/wealth-tree/SavingsRateGauge'
import type { SavingsEntry } from '@/types/wealth-tree'
import { formatWealthCurrency } from '@/types/wealth-tree'

const ACCOUNT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'emergency', label: 'Emergency Fund' },
  { value: 'general', label: 'General Savings' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'education', label: 'Education' },
]

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

export default function SavingsPage() {
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Dashboard-level data for the gauge
  const [savingsRateActual, setSavingsRateActual] = useState(0)
  const [savingsRateTarget, setSavingsRateTarget] = useState(0.1)

  // Form state
  const [date, setDate] = useState(todayString())
  const [amount, setAmount] = useState('')
  const [accountType, setAccountType] = useState('general')
  const [notes, setNotes] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [entriesRes, dashRes] = await Promise.all([
        fetch('/api/wealth-tree/savings'),
        fetch('/api/wealth-tree/dashboard'),
      ])

      if (!entriesRes.ok) throw new Error('Failed to fetch savings entries')
      const entriesData = await entriesRes.json()
      setEntries(entriesData.entries || [])

      if (dashRes.ok) {
        const dashData = await dashRes.json()
        setSavingsRateActual(dashData.savings_rate_actual ?? 0)
        setSavingsRateTarget(dashData.savings_rate_target ?? 0.1)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/wealth-tree/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: date,
          amount: Number(amount),
          account_type: accountType,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add entry')
      }
      const data = await res.json()
      // The upsert might update an existing entry, so replace or add
      setEntries((prev) => {
        const existing = prev.findIndex((entry) => entry.id === data.entry.id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data.entry
          return updated
        }
        return [data.entry, ...prev]
      })
      setAmount('')
      setNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wealth-tree/savings?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete entry')
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Total savings
  const totalSavings = entries.reduce((sum, e) => sum + Number(e.amount), 0)

  // Group by account type
  const byAccount = new Map<string, number>()
  for (const entry of entries) {
    const key = entry.account_type || 'general'
    byAccount.set(key, (byAccount.get(key) || 0) + Number(entry.amount))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Savings</h1>
        <p className="text-sm text-gray-500 mt-1">
          For every ten coins thou placest within thy purse, take out for use but nine.
        </p>
      </div>

      {/* Gauge + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Savings Rate Gauge */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Savings Rate
          </p>
          <SavingsRateGauge
            actualRate={savingsRateActual}
            targetRate={savingsRateTarget}
            size={140}
          />
        </div>

        {/* Total savings */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 border-l-4 border-l-green-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Saved
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatWealthCurrency(totalSavings)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {entries.length} entries across {byAccount.size} account{byAccount.size !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Account breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            By Account
          </p>
          {byAccount.size > 0 ? (
            <div className="space-y-2">
              {Array.from(byAccount.entries()).map(([account, total]) => {
                const label = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === account)?.label || account
                return (
                  <div key={account} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{label}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {formatWealthCurrency(total)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No savings data yet.</p>
          )}
        </div>
      </div>

      {/* Add entry form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Savings Entry</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly emergency fund contribution"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !amount}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving...' : 'Add Savings'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Entries table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Savings History</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No savings entries yet. Start building your purse above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Amount
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => {
                  const label =
                    ACCOUNT_TYPE_OPTIONS.find((o) => o.value === entry.account_type)?.label ||
                    entry.account_type
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                        {entry.entry_date}
                      </td>
                      <td className="px-5 py-3 text-gray-700">{label}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium text-right tabular-nums">
                        {formatWealthCurrency(Number(entry.amount))}
                      </td>
                      <td className="px-5 py-3 text-gray-500 truncate max-w-[200px]">
                        {entry.notes || '--'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="Delete entry"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
