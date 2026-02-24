'use client'

import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { ExpenseEntry, ExpenseCategory, RecurrenceFrequency } from '@/types/wealth-tree'
import { formatWealthCurrency } from '@/types/wealth-tree'

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'housing', label: 'Housing' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'personal', label: 'Personal' },
  { value: 'giving', label: 'Giving' },
  { value: 'other', label: 'Other' },
]

const PIE_COLORS = [
  '#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#a855f7', '#64748b',
]

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const FREQUENCY_BADGES: Record<string, { label: string; color: string }> = {
  weekly: { label: 'Weekly', color: 'bg-purple-50 text-purple-700' },
  biweekly: { label: 'Biweekly', color: 'bg-blue-50 text-blue-700' },
  monthly: { label: 'Monthly', color: 'bg-teal-50 text-teal-700' },
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

interface PieData {
  name: string
  value: number
}

export default function ExpensesPageClient() {
  const [entries, setEntries] = useState<ExpenseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [date, setDate] = useState(todayString())
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency | ''>('')
  const [notes, setNotes] = useState('')

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/wealth-tree/expenses')
      if (!res.ok) throw new Error('Failed to fetch expense entries')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : data.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/wealth-tree/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: date,
          category,
          amount: Number(amount),
          recurrence_frequency: frequency || null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add entry')
      }
      const data = await res.json()
      const newEntry = data.entry || data
      setEntries((prev) => [newEntry, ...prev])
      setAmount('')
      setFrequency('')
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
      const res = await fetch(`/api/wealth-tree/expenses?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete entry')
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Monthly total and pie chart data
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthEntries = entries.filter((e) => e.entry_date.startsWith(currentMonth))
  const monthlyTotal = monthEntries.reduce((sum, e) => sum + Number(e.amount), 0)

  // Group by category for pie chart
  const categoryTotals = new Map<string, number>()
  for (const entry of monthEntries) {
    const cat = entry.category
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + Number(entry.amount))
  }

  const pieData: PieData[] = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({
      name: CATEGORY_OPTIONS.find((c) => c.value === name)?.label || name,
      value,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <p className="text-sm text-gray-500 mt-1">
          Control thy expenditures -- budget wisely between needs and desires.
        </p>
      </div>

      {/* Monthly total + Pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 border-l-4 border-l-red-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            This Month&apos;s Expenses
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatWealthCurrency(monthlyTotal)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {monthEntries.length} transaction{monthEntries.length !== 1 ? 's' : ''} this month
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Budget Breakdown
          </p>
          {pieData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatWealthCurrency(Number(value))}
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">
              No expenses this month to chart.
            </div>
          )}
        </div>
      </div>

      {/* Add entry form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Expense</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency | '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
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
              placeholder="e.g. Grocery run, Monthly rent"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !amount}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Expense'}
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
          <h2 className="text-sm font-semibold text-gray-900">Recent Expenses</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No expense entries yet. Start tracking above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Amount
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Frequency</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{entry.entry_date}</td>
                    <td className="px-5 py-3 text-gray-700 capitalize">{entry.category.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium text-right tabular-nums">
                      {formatWealthCurrency(Number(entry.amount))}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {entry.recurrence_frequency ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FREQUENCY_BADGES[entry.recurrence_frequency]?.color || 'bg-blue-50 text-blue-700'}`}>
                          {FREQUENCY_BADGES[entry.recurrence_frequency]?.label || entry.recurrence_frequency}
                          {!entry.recurring_parent_id && <span className="ml-1" title="Template">&#8635;</span>}
                        </span>
                      ) : entry.recurring_parent_id ? (
                        <span className="text-xs text-gray-400">Auto</span>
                      ) : (
                        <span className="text-xs text-gray-400">One-time</span>
                      )}
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
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
