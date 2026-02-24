'use client'

import { useState, useEffect } from 'react'
import { SEVEN_CURES, TIER_COLORS } from '@/types/wealth-tree'
import type { WealthGoal, CureNumber } from '@/types/wealth-tree'
import { formatWealthCurrency } from '@/types/wealth-tree'

export default function GoalsPage() {
  const [goals, setGoals] = useState<WealthGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCure, setSelectedCure] = useState<CureNumber>(1)
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_amount: '',
    target_date: '',
  })

  useEffect(() => {
    fetchGoals()
  }, [])

  async function fetchGoals() {
    try {
      const res = await fetch('/api/wealth-tree/goals')
      if (res.ok) {
        const data = await res.json()
        setGoals(data)
      }
    } catch (e) {
      console.error('Failed to fetch goals:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const cure = SEVEN_CURES.find(c => c.number === selectedCure)!
    try {
      const res = await fetch('/api/wealth-tree/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cure_number: selectedCure,
          title: form.title,
          description: form.description || undefined,
          target_amount: form.target_amount ? Number(form.target_amount) : undefined,
          target_date: form.target_date || undefined,
          tree_tier: cure.tier,
        }),
      })
      if (res.ok) {
        const goal = await res.json()
        setGoals([...goals, goal])
        setForm({ title: '', description: '', target_amount: '', target_date: '' })
        setShowForm(false)
      }
    } catch (e) {
      console.error('Failed to create goal:', e)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateStatus(id: string, status: 'active' | 'completed' | 'paused') {
    try {
      const res = await fetch('/api/wealth-tree/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setGoals(goals.map(g => g.id === id ? { ...g, status } : g))
      }
    } catch (e) {
      console.error('Failed to update goal:', e)
    }
  }

  async function handleUpdateProgress(id: string, current_amount: number) {
    try {
      const res = await fetch('/api/wealth-tree/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, current_amount }),
      })
      if (res.ok) {
        setGoals(goals.map(g => g.id === id ? { ...g, current_amount } : g))
      }
    } catch (e) {
      console.error('Failed to update progress:', e)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch('/api/wealth-tree/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setGoals(goals.filter(g => g.id !== id))
      }
    } catch (e) {
      console.error('Failed to delete goal:', e)
    }
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

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
          <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-500 text-sm mt-1">Set goals tied to the 7 Cures for a Lean Purse</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          {showForm ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{goals.length}</p>
          <p className="text-sm text-gray-500">Total Goals</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{activeGoals.length}</p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{completedGoals.length}</p>
          <p className="text-sm text-gray-500">Completed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">
            {new Set(goals.map(g => g.cure_number)).size}/7
          </p>
          <p className="text-sm text-gray-500">Cures Active</p>
        </div>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Linked Cure</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {SEVEN_CURES.map(cure => {
                const colors = TIER_COLORS[cure.tier]
                const isSelected = selectedCure === cure.number
                return (
                  <button key={cure.number} type="button"
                    onClick={() => setSelectedCure(cure.number)}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      isSelected ? `${colors.bg} ${colors.border}` : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <p className={`text-xs font-medium ${isSelected ? colors.text : 'text-gray-500'}`}>
                      Cure {cure.number}
                    </p>
                    <p className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'} truncate`}>
                      {cure.title}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                placeholder="e.g. Build 6-month emergency fund"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount (optional)</label>
              <input type="number" step="0.01" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })}
                placeholder="$0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Date (optional)</label>
              <input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Goal'}
          </button>
        </form>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Goals</h2>
          <div className="space-y-3">
            {activeGoals.map(goal => {
              const cure = SEVEN_CURES.find(c => c.number === goal.cure_number)!
              const colors = TIER_COLORS[cure.tier]
              const progress = goal.target_amount && Number(goal.target_amount) > 0
                ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
                : 0

              return (
                <div key={goal.id} className={`bg-white rounded-xl border ${colors.border} p-5`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full`}>
                          Cure {goal.cure_number}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{goal.tree_tier}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                      {goal.description && <p className="text-sm text-gray-500 mt-1">{goal.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleUpdateStatus(goal.id, 'completed')}
                        className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors">
                        Complete
                      </button>
                      <button onClick={() => handleUpdateStatus(goal.id, 'paused')}
                        className="text-xs px-3 py-1 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        Pause
                      </button>
                      <button onClick={() => handleDelete(goal.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>

                  {goal.target_amount && Number(goal.target_amount) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {formatWealthCurrency(Number(goal.current_amount))} of {formatWealthCurrency(Number(goal.target_amount))}
                        </span>
                        <span className="font-medium text-gray-900">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: colors.accent,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Update progress"
                          className="px-2 py-1 border border-gray-300 rounded text-xs w-28"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = Number((e.target as HTMLInputElement).value)
                              if (val > 0) {
                                handleUpdateProgress(goal.id, val);
                                (e.target as HTMLInputElement).value = ''
                              }
                            }
                          }}
                        />
                        <span className="text-xs text-gray-400">Press Enter to update</span>
                      </div>
                    </div>
                  )}

                  {goal.target_date && (
                    <p className="text-xs text-gray-400 mt-2">
                      Target: {new Date(goal.target_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Completed</h2>
          <div className="space-y-2">
            {completedGoals.map(goal => (
              <div key={goal.id} className="bg-green-50 rounded-lg border border-green-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700 font-medium">{goal.title}</span>
                  <span className="text-xs text-green-600">Cure {goal.cure_number}</span>
                </div>
                <button onClick={() => handleDelete(goal.id)}
                  className="text-xs text-gray-400 hover:text-red-500">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">No goals yet. Set your first goal to start building your Wealth Tree.</p>
          <p className="text-sm text-gray-400 italic">&ldquo;Where the determination is, the way can be found.&rdquo;</p>
        </div>
      )}
    </div>
  )
}
