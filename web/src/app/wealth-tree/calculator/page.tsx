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
import { formatWealthCurrency } from '@/types/wealth-tree'
import type { GrowthProjection } from '@/types/wealth-tree'

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
  const [initialAmount, setInitialAmount] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(500)
  const [annualReturn, setAnnualReturn] = useState(7)
  const [years, setYears] = useState(30)
  const [inflationRate, setInflationRate] = useState(3)
  const [projections, setProjections] = useState<GrowthProjection[]>([])
  const [calculating, setCalculating] = useState(false)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compound Growth Calculator</h1>
        <p className="text-gray-500 text-sm mt-1">See how your gold multiplies over time</p>
      </div>

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
    </div>
  )
}
