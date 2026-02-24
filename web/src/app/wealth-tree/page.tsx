import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getWealthDashboard } from '@/lib/wealth-tree-db'
import {
  TREE_TIERS,
  SEVEN_CURES,
  formatWealthCurrency,
  formatPercent,
} from '@/types/wealth-tree'
import type { WealthDashboard, TreeTier, CureNumber } from '@/types/wealth-tree'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'yellow' | 'blue'
}) {
  const accentClasses: Record<string, string> = {
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    yellow: 'border-l-yellow-500',
    blue: 'border-l-blue-500',
  }
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 border-l-4 ${
        accent ? accentClasses[accent] : 'border-l-gray-300'
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function CureHealthBar({ cure, score }: { cure: number; score: number }) {
  const config = SEVEN_CURES.find((c) => c.number === cure)
  if (!config) return null

  const barColor =
    score >= 75 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-gray-400 w-4 text-right">{cure}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-medium text-gray-700 truncate pr-2">{config.title}</p>
          <span className="text-xs text-gray-500 tabular-nums">{score}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TreeVisualization({ dashboard }: { dashboard: WealthDashboard }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Wealth Tree Health</h2>
      <div className="space-y-3">
        {TREE_TIERS.map((tier) => {
          const goals = dashboard.goals_by_tier[tier.tier as TreeTier]
          const totalGoals = goals?.total ?? 0
          const completedGoals = goals?.completed ?? 0
          const progress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0

          return (
            <div
              key={tier.tier}
              className={`rounded-lg border p-4 ${tier.bgColor} ${tier.borderColor}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold text-sm ${tier.color}`}>
                    {tier.label} &middot; {tier.subtitle}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">{tier.description}</p>
                </div>
                <div className="text-right">
                  {totalGoals > 0 ? (
                    <>
                      <p className={`text-lg font-bold ${tier.color}`}>{progress}%</p>
                      <p className="text-xs text-gray-500">
                        {completedGoals}/{totalGoals} goals
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">No goals yet</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function WealthTreeDashboard() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const dashboard = await getWealthDashboard(session.user.id)

  if (!dashboard.profile) {
    redirect('/wealth-tree/onboarding')
  }

  const currency = dashboard.profile.currency || 'USD'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Wealth Tree</h1>
        <p className="text-sm text-gray-500 mt-1 italic">
          &ldquo;Wealth, like a tree, grows from a tiny seed. The first copper you save is the
          seed from which your tree of wealth shall grow.&rdquo;
        </p>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={formatWealthCurrency(dashboard.net_worth, currency)}
          accent="blue"
        />
        <StatCard
          label="Income (Month)"
          value={formatWealthCurrency(dashboard.income_this_month, currency)}
          sub={`YTD: ${formatWealthCurrency(dashboard.income_ytd, currency)}`}
          accent="green"
        />
        <StatCard
          label="Expenses (Month)"
          value={formatWealthCurrency(dashboard.expenses_this_month, currency)}
          sub={`YTD: ${formatWealthCurrency(dashboard.expenses_ytd, currency)}`}
          accent="red"
        />
        <StatCard
          label="Savings Rate"
          value={formatPercent(dashboard.savings_rate_actual)}
          sub={`Target: ${formatPercent(dashboard.savings_rate_target)}`}
          accent={dashboard.savings_rate_actual >= dashboard.savings_rate_target ? 'green' : 'yellow'}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Savings"
          value={formatWealthCurrency(dashboard.total_savings, currency)}
        />
        <StatCard
          label="Investments"
          value={formatWealthCurrency(dashboard.total_investments, currency)}
        />
        <StatCard
          label="Total Debt"
          value={formatWealthCurrency(dashboard.total_debt, currency)}
          accent={dashboard.total_debt > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Emergency Fund"
          value={formatPercent(dashboard.emergency_fund_progress)}
          sub={`${dashboard.profile.emergency_fund_target_months} months target`}
          accent={dashboard.emergency_fund_progress >= 1 ? 'green' : 'yellow'}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tree visualization */}
        <TreeVisualization dashboard={dashboard} />

        {/* Seven Cures health */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Seven Cures for a Lean Purse
          </h2>
          <div className="space-y-3">
            {([1, 2, 3, 4, 5, 6, 7] as CureNumber[]).map((cure) => (
              <CureHealthBar
                key={cure}
                cure={cure}
                score={dashboard.cure_scores[cure] || 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
