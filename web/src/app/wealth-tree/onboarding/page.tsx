'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RiskTolerance } from '@/types/wealth-tree'

const STEPS = ['Basic Info', 'Financial Details', 'Risk Profile']

const RISK_OPTIONS: { value: RiskTolerance; label: string; description: string }[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    description:
      'Preserve capital first. You prefer bonds, savings accounts, and low-volatility investments. You can tolerate small losses.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description:
      'Balanced approach. You accept moderate ups and downs for better long-term growth. A mix of stocks and bonds suits you.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description:
      'Maximize growth. You are comfortable with significant short-term volatility for higher long-term returns. Heavy equity allocation.',
  },
]

interface FormData {
  name: string
  current_age: string
  currency: string
  annual_income: string
  savings_rate_target: string
  emergency_fund_target_months: string
  retirement_age_target: string
  risk_tolerance: RiskTolerance
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    name: '',
    current_age: '',
    currency: 'USD',
    annual_income: '',
    savings_rate_target: '10',
    emergency_fund_target_months: '6',
    retirement_age_target: '65',
    risk_tolerance: 'moderate',
  })

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function canAdvance(): boolean {
    if (step === 0) {
      return form.current_age.trim() !== '' && Number(form.current_age) > 0
    }
    if (step === 1) {
      return form.annual_income.trim() !== '' && Number(form.annual_income) > 0
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        currency: form.currency,
        current_age: Number(form.current_age) || null,
        annual_income: Number(form.annual_income) || null,
        savings_rate_target: Number(form.savings_rate_target) / 100,
        emergency_fund_target_months: Number(form.emergency_fund_target_months) || 6,
        retirement_age_target: Number(form.retirement_age_target) || 65,
        risk_tolerance: form.risk_tolerance,
      }

      const res = await fetch('/api/wealth-tree/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile')
      }

      router.push('/wealth-tree')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plant Your Wealth Tree</h1>
        <p className="text-sm text-gray-500 mt-2">
          Let us set up your personal finance profile inspired by the Seven Cures for a Lean Purse.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i <= step
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs mt-1 ${
                  i <= step ? 'text-green-700 font-medium' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 mb-5 ${
                  i < step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="How should we greet you?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Optional -- we will use your account name by default.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={form.current_age}
                onChange={(e) => update('current_age', e.target.value)}
                placeholder="e.g. 30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="JPY">JPY</option>
                <option value="CHF">CHF</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Financial Details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Income <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.annual_income}
                onChange={(e) => update('annual_income', e.target.value)}
                placeholder="e.g. 75000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Gross annual income before taxes.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Savings Rate Target (%)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={form.savings_rate_target}
                onChange={(e) => update('savings_rate_target', e.target.value)}
                placeholder="10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Babylon wisdom: save at least 10% of all you earn.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Fund (months of expenses)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={form.emergency_fund_target_months}
                onChange={(e) => update('emergency_fund_target_months', e.target.value)}
                placeholder="6"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Retirement Age
              </label>
              <input
                type="number"
                min="30"
                max="100"
                value={form.retirement_age_target}
                onChange={(e) => update('retirement_age_target', e.target.value)}
                placeholder="65"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Step 3: Risk Profile */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-2">
              Choose the investment approach that best matches your comfort level with risk.
            </p>
            {RISK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('risk_tolerance', opt.value)}
                className={`w-full text-left border rounded-lg p-4 transition-colors ${
                  form.risk_tolerance === opt.value
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      form.risk_tolerance === opt.value
                        ? 'border-green-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {form.risk_tolerance === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                    )}
                  </div>
                  <span className="font-medium text-sm text-gray-900">{opt.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-7">{opt.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Plant My Tree'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
