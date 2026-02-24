'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DebtEntry, DebtType } from '@/types/wealth-tree'
import { formatWealthCurrency } from '@/types/wealth-tree'

const DEBT_TYPE_OPTIONS: { value: DebtType; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'auto_loan', label: 'Auto Loan' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'other', label: 'Other' },
]

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [debtType, setDebtType] = useState<DebtType>('credit_card')
  const [balance, setBalance] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')

  const fetchDebts = useCallback(async () => {
    try {
      const res = await fetch('/api/wealth-tree/debts')
      if (!res.ok) throw new Error('Failed to fetch debts')
      const data = await res.json()
      setDebts(data.debts || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDebts()
  }, [fetchDebts])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !balance || Number(balance) <= 0) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/wealth-tree/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          debt_type: debtType,
          current_balance: Number(balance),
          interest_rate: interestRate ? Number(interestRate) : null,
          monthly_payment: monthlyPayment ? Number(monthlyPayment) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add debt')
      }
      const data = await res.json()
      setDebts((prev) => [...prev, data.debt].sort((a, b) => Number(b.current_balance) - Number(a.current_balance)))
      setName('')
      setBalance('')
      setInterestRate('')
      setMonthlyPayment('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wealth-tree/debts?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete debt')
      setDebts((prev) => prev.filter((debt) => debt.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Totals
  const totalDebt = debts.reduce((sum, d) => sum + Number(d.current_balance), 0)
  const totalMonthlyPayments = debts.reduce(
    (sum, d) => sum + (Number(d.monthly_payment) || 0),
    0
  )
  const highestRate = debts.reduce(
    (max, d) => Math.max(max, Number(d.interest_rate) || 0),
    0
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Debts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guard thy treasures from loss -- manage and eliminate debt systematically.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 border-l-4 border-l-red-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Debt</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatWealthCurrency(totalDebt)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {debts.length} active debt{debts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Monthly Payments
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatWealthCurrency(totalMonthlyPayments)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total across all debts</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Highest Interest
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {highestRate > 0 ? `${highestRate.toFixed(1)}%` : '--'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {highestRate > 15 ? 'Consider paying this first' : 'Annual rate'}
          </p>
        </div>
      </div>

      {/* Add debt form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Debt</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Debt Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chase Visa, Student Loan"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Debt Type</label>
              <select
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as DebtType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                {DEBT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Current Balance <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Monthly Payment
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !balance}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Debt'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Debts table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">All Debts</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : debts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">No debts recorded. Excellent!</p>
            <p className="text-xs text-gray-400 mt-1">
              If you have debts, add them above to track your payoff journey.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Balance
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Rate
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Payment/mo
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {debts.map((debt) => {
                  const typeLabel =
                    DEBT_TYPE_OPTIONS.find((o) => o.value === debt.debt_type)?.label ||
                    debt.debt_type
                  const rate = Number(debt.interest_rate)
                  const isHighRate = rate > 15
                  return (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-medium">{debt.name}</td>
                      <td className="px-5 py-3 text-gray-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-900 font-medium text-right tabular-nums">
                        {formatWealthCurrency(Number(debt.current_balance))}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {rate > 0 ? (
                          <span className={isHighRate ? 'text-red-600 font-medium' : 'text-gray-700'}>
                            {rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700 text-right tabular-nums">
                        {Number(debt.monthly_payment) > 0
                          ? formatWealthCurrency(Number(debt.monthly_payment))
                          : '--'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleDelete(debt.id)}
                          disabled={deletingId === debt.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="Delete debt"
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

      {/* Debt payoff tip */}
      {debts.length > 1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">Payoff Strategy Tip</p>
          <p className="text-xs text-yellow-700 mt-1">
            The <strong>avalanche method</strong> saves the most money: pay minimums on all debts,
            then throw extra at the highest interest rate first. The <strong>snowball method</strong>
            {' '}builds momentum: pay off the smallest balance first for quick wins.
          </p>
        </div>
      )}
    </div>
  )
}
