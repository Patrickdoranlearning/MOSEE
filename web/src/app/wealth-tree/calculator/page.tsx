'use client'

import { useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TeachingCard } from '@/components/wealth-tree/TeachingCard'
import { formatWealthCurrency } from '@/types/wealth-tree'
import type { GrowthProjection, DebtPayoffSchedule } from '@/types/wealth-tree'

type CalcTab = 'compound' | 'debt'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900 mb-2">Year {label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatWealthCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function CalculatorPage() {
  const [activeTab, setActiveTab] = useState<CalcTab>('compound')

  // ─── Compound growth state (unchanged) ─────────────────────
  const [initialAmount, setInitialAmount] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(500)
  const [annualReturn, setAnnualReturn] = useState(7)
  const [years, setYears] = useState(30)
  const [inflationRate, setInflationRate] = useState(3)
  const [projections, setProjections] = useState<GrowthProjection[]>([])
  const [calculating, setCalculating] = useState(false)

  // ─── Debt payoff state ─────────────────────────────────────
  const [debtBalance, setDebtBalance] = useState(10000)
  const [debtRate, setDebtRate] = useState(20)
  const [debtPayment, setDebtPayment] = useState(300)
  const [schedule, setSchedule] = useState<DebtPayoffSchedule[]>([])
  const [debtCalculating, setDebtCalculating] = useState(false)
  const [debtError, setDebtError] = useState<string | null>(null)
  const [showAmortization, setShowAmortization] = useState(false)

  async function calculateDebt() {
    setDebtCalculating(true)
    setDebtError(null)
    try {
      const res = await fetch('/api/wealth-tree/calculator/debt-payoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_balance: debtBalance,
          // % in UI -> annual decimal, matching the compound tab's /100 convention.
          // The API divides by 12 itself.
          interest_rate: debtRate / 100,
          monthly_payment: debtPayment,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Surface the API's 400 message (e.g. payment <= first-month interest).
        setSchedule([])
        throw new Error(data.error || 'Failed to compute debt payoff')
      }
      setSchedule(data as DebtPayoffSchedule[])
    } catch (e) {
      setDebtError(e instanceof Error ? e.message : 'Failed to compute debt payoff')
    } finally {
      setDebtCalculating(false)
    }
  }

  async function calculate() {
    setCalculating(true)
    try {
      const res = await fetch('/api/wealth-tree/calculator/compound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_amount: initialAmount,
          monthly_contribution: monthlyContribution,
          annual_return: annualReturn / 100,
          years,
          inflation_rate: inflationRate / 100,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProjections(data.projections)
      }
    } catch (e) {
      console.error('Calculation failed:', e)
    } finally {
      setCalculating(false)
    }
  }

  const finalNominal = projections.length > 0 ? projections[projections.length - 1].nominal_value : 0
  const finalReal = projections.length > 0 ? projections[projections.length - 1].real_value : 0
  const totalContributed = projections.length > 0 ? projections[projections.length - 1].total_contributions : 0
  const totalGrowth = projections.length > 0 ? projections[projections.length - 1].total_growth : 0

  // Debt payoff derived figures
  const monthsToFree = schedule.length
  const totalInterestPaid = schedule.reduce((sum, row) => sum + (Number(row.interest) || 0), 0)
  const debtChartData = schedule.map((row) => ({
    month: row.month,
    'Remaining Balance': Number(row.remaining_balance),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calculators</h1>
        <p className="text-gray-500 text-sm mt-1">
          {activeTab === 'compound'
            ? 'See how your gold multiplies over time'
            : 'See how fast you can break free of debt'}
        </p>
      </div>

      {/* The TeachingCard re-pools when its topics prop changes — switching tabs
          swaps compounding teachings for debt teachings. */}
      <TeachingCard topics={activeTab === 'debt' ? ['debt'] : ['compounding']} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('compound')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'compound'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Compound Growth
        </button>
        <button
          onClick={() => setActiveTab('debt')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'debt'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Debt Payoff
        </button>
      </div>

      {activeTab === 'compound' && (
      <>
      {/* Input Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initial Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input type="number" value={initialAmount} onChange={e => setInitialAmount(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Contribution</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Annual Return (%)</label>
            <input type="number" step="0.1" value={annualReturn} onChange={e => setAnnualReturn(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Years</label>
            <input type="number" value={years} onChange={e => setYears(Number(e.target.value))}
              min={1} max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Inflation (%)</label>
            <input type="number" step="0.1" value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
          </div>
        </div>
        <button onClick={calculate} disabled={calculating}
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
          {calculating ? 'Calculating...' : 'Calculate Growth'}
        </button>
      </div>

      {/* Results */}
      {projections.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Final Value (Nominal)</p>
              <p className="text-2xl font-bold text-gray-900">{formatWealthCurrency(finalNominal)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Final Value (Real)</p>
              <p className="text-2xl font-bold text-green-600">{formatWealthCurrency(finalReal)}</p>
              <p className="text-xs text-gray-400 mt-1">Adjusted for {inflationRate}% inflation</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Contributed</p>
              <p className="text-2xl font-bold text-blue-600">{formatWealthCurrency(totalContributed)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Investment Growth</p>
              <p className="text-2xl font-bold text-emerald-600">{formatWealthCurrency(totalGrowth)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {totalContributed > 0 ? `${((totalGrowth / totalContributed) * 100).toFixed(0)}% return on contributions` : ''}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Growth Over Time</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v: number) => formatWealthCurrency(v)}
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total_contributions"
                    name="Contributions"
                    fill="#bfdbfe"
                    stroke="#3b82f6"
                    fillOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="nominal_value"
                    name="Nominal Value"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="real_value"
                    name="Real Value"
                    stroke="#d97706"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 italic">
              &ldquo;The gold we may retain from our earnings is but the start. The earnings it will make shall build our fortunes.&rdquo;
            </p>
            <p className="text-xs text-amber-600 mt-1">&mdash; The Richest Man in Babylon</p>
          </div>
        </>
      )}
      </>
      )}

      {activeTab === 'debt' && (
      <>
      {/* Debt Payoff Input Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input type="number" min={0} value={debtBalance} onChange={e => setDebtBalance(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
            <input type="number" step="0.1" min={0} value={debtRate} onChange={e => setDebtRate(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Payment</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input type="number" min={0} value={debtPayment} onChange={e => setDebtPayment(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
        </div>
        <button onClick={calculateDebt} disabled={debtCalculating}
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
          {debtCalculating ? 'Calculating...' : 'Calculate Payoff'}
        </button>
      </div>

      {/* Debt payoff error (surface the API's 400 message) */}
      {debtError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">{debtError}</p>
        </div>
      )}

      {/* Debt Results */}
      {schedule.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Months to Debt-Free</p>
              <p className="text-2xl font-bold text-gray-900">{monthsToFree}</p>
              <p className="text-xs text-gray-400 mt-1">
                {Math.floor(monthsToFree / 12)}y {monthsToFree % 12}m
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Interest Paid</p>
              <p className="text-2xl font-bold text-red-600">{formatWealthCurrency(totalInterestPaid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Repaid</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatWealthCurrency(schedule.reduce((sum, row) => sum + (Number(row.payment) || 0), 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">Principal + interest</p>
            </div>
          </div>

          {/* Balance over time chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Balance Over Time</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={debtChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v: number) => formatWealthCurrency(v)}
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Remaining Balance"
                    name="Remaining Balance"
                    fill="#fecaca"
                    stroke="#dc2626"
                    fillOpacity={0.4}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Amortization table (collapsible, scrollable) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowAmortization(!showAmortization)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-lg font-semibold text-gray-900">Amortization Schedule</h2>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showAmortization ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAmortization && (
              <div className="max-h-96 overflow-y-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">Month</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">Payment</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">Principal</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">Interest</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schedule.map((row) => (
                      <tr key={row.month} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{row.month}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                          {formatWealthCurrency(Number(row.payment))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-green-700">
                          {formatWealthCurrency(Number(row.principal))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-600">
                          {formatWealthCurrency(Number(row.interest))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900 font-medium">
                          {formatWealthCurrency(Number(row.remaining_balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      </>
      )}
    </div>
  )
}
