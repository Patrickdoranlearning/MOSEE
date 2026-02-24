'use client'

import { useState, useEffect } from 'react'
import { formatWealthCurrency } from '@/types/wealth-tree'
import type { Investment } from '@/types/wealth-tree'

const ASSET_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bond' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const ACCOUNT_TYPES = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'ira', label: 'IRA' },
  { value: '401k', label: '401(k)' },
  { value: 'roth', label: 'Roth IRA' },
  { value: 'hsa', label: 'HSA' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
]

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    asset_type: 'stock',
    name: '',
    ticker: '',
    purchase_date: '',
    purchase_price: '',
    quantity: '',
    current_value: '',
    account: 'taxable',
    notes: '',
  })

  useEffect(() => {
    fetchInvestments()
  }, [])

  async function fetchInvestments() {
    try {
      const res = await fetch('/api/wealth-tree/investments')
      if (res.ok) {
        const data = await res.json()
        setInvestments(data)
      }
    } catch (e) {
      console.error('Failed to fetch investments:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/wealth-tree/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          current_value: form.current_value ? Number(form.current_value) : undefined,
          ticker: form.ticker || undefined,
          purchase_date: form.purchase_date || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (res.ok) {
        const entry = await res.json()
        setInvestments([entry, ...investments])
        setForm({ asset_type: 'stock', name: '', ticker: '', purchase_date: '', purchase_price: '', quantity: '', current_value: '', account: 'taxable', notes: '' })
        setShowForm(false)
      }
    } catch (e) {
      console.error('Failed to add investment:', e)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch('/api/wealth-tree/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setInvestments(investments.filter(i => i.id !== id))
      }
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  const totalValue = investments.reduce((sum, i) => sum + (Number(i.current_value) || 0), 0)
  const totalCost = investments.reduce((sum, i) => {
    const cost = (Number(i.purchase_price) || 0) * (Number(i.quantity) || 0)
    return sum + cost
  }, 0)
  const totalReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0

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
          <h1 className="text-2xl font-bold text-gray-900">Investments</h1>
          <p className="text-gray-500 text-sm mt-1">Cure 3: Make thy gold multiply</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Investment'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatWealthCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Cost Basis</p>
          <p className="text-2xl font-bold text-gray-900">{formatWealthCurrency(totalCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Return</p>
          <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                placeholder="e.g. Vanguard S&P 500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticker (optional)</label>
              <input type="text" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="e.g. VOO"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
              <input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input type="number" step="0.0001" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
              <input type="number" step="0.01" value={form.current_value} onChange={e => setForm({ ...form, current_value: e.target.value })} required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select value={form.account} onChange={e => setForm({ ...form, account: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add Investment'}
          </button>
        </form>
      )}

      {/* Investments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {investments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No investments yet. Add your first investment to start tracking.</p>
            <p className="text-sm text-gray-400 mt-2 italic">&ldquo;Put each coin to laboring that it may reproduce its kind.&rdquo;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Asset</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Cost</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Value</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Return</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Account</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {investments.map(inv => {
                  const cost = (Number(inv.purchase_price) || 0) * (Number(inv.quantity) || 0)
                  const value = Number(inv.current_value) || 0
                  const returnPct = cost > 0 ? ((value - cost) / cost) * 100 : 0
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{inv.name}</div>
                        {inv.ticker && <div className="text-xs text-gray-500">{inv.ticker}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{inv.asset_type.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{inv.quantity || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{cost > 0 ? formatWealthCurrency(cost) : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatWealthCurrency(value)}</td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {cost > 0 ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">{inv.account}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(inv.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-sm">
                          Delete
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
