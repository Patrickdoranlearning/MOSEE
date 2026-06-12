'use client'

import { useState, useEffect, useCallback } from 'react'
import { TeachingCard } from '@/components/wealth-tree/TeachingCard'
import type { SkillInvestment, SkillStatus } from '@/types/wealth-tree'
import { formatWealthCurrency } from '@/types/wealth-tree'

const STATUS_OPTIONS: { value: SkillStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_BADGE: Record<SkillStatus, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInvestment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [cost, setCost] = useState('')
  const [expectedIncome, setExpectedIncome] = useState('')
  const [startDate, setStartDate] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [status, setStatus] = useState<SkillStatus>('planned')

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/wealth-tree/skills')
      if (!res.ok) throw new Error('Failed to fetch skills')
      const data = await res.json()
      setSkills(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/wealth-tree/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          cost: cost ? Number(cost) : 0,
          expected_income_increase: expectedIncome ? Number(expectedIncome) : null,
          start_date: startDate || null,
          completion_date: completionDate || null,
          status,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add skill')
      }
      const skill = await res.json()
      setSkills((prev) => [skill, ...prev])
      setName('')
      setCategory('')
      setCost('')
      setExpectedIncome('')
      setStartDate('')
      setCompletionDate('')
      setStatus('planned')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wealth-tree/skills?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete skill')
      setSkills((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Totals
  const totalInvested = skills.reduce((sum, s) => sum + (Number(s.cost) || 0), 0)
  const totalExpectedIncome = skills.reduce(
    (sum, s) => sum + (Number(s.expected_income_increase) || 0),
    0
  )
  const plannedCount = skills.filter((s) => s.status === 'planned').length
  const inProgressCount = skills.filter((s) => s.status === 'in_progress').length
  const completedCount = skills.filter((s) => s.status === 'completed').length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Increase Thy Ability to Earn</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cure 7 -- invest in your own education and skills. The most profitable investment
          is often the one you make in yourself.
        </p>
      </div>

      <TeachingCard topics={['skills', 'income']} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 border-l-4 border-l-amber-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Invested
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatWealthCurrency(totalInvested)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {skills.length} skill investment{skills.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Expected Income Increase
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalExpectedIncome > 0 ? formatWealthCurrency(totalExpectedIncome) : '--'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Projected annual uplift</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <p>
              <span className="font-semibold text-gray-900">{completedCount}</span> completed
            </p>
            <p>
              <span className="font-semibold text-gray-900">{inProgressCount}</span> in progress
            </p>
            <p>
              <span className="font-semibold text-gray-900">{plannedCount}</span> planned
            </p>
          </div>
        </div>
      </div>

      {/* Add skill form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Skill Investment</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Skill / Course <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Python certification, MBA"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Technical, Finance, Leadership"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Expected Income Increase
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={expectedIncome}
                onChange={(e) => setExpectedIncome(e.target.value)}
                placeholder="Annual, optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SkillStatus)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Completion Date
              </label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Skill'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Skills table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">All Skill Investments</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : skills.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">No skill investments yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Add a course, certification, or program above to track your growing earning power.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Skill</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Cost
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                    Expected +Income
                  </th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {skills.map((skill) => {
                  const statusLabel =
                    STATUS_OPTIONS.find((o) => o.value === skill.status)?.label || skill.status
                  return (
                    <tr key={skill.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-medium">{skill.name}</td>
                      <td className="px-5 py-3 text-gray-700">
                        {skill.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {skill.category}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-900 font-medium text-right tabular-nums">
                        {Number(skill.cost) > 0 ? formatWealthCurrency(Number(skill.cost)) : '--'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {Number(skill.expected_income_increase) > 0 ? (
                          <span className="text-green-600 font-medium">
                            {formatWealthCurrency(Number(skill.expected_income_increase))}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[skill.status]}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleDelete(skill.id)}
                          disabled={deletingId === skill.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="Delete skill"
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
