'use client'

import type { WealthDashboard } from '@/types/wealth-tree'
import { formatWealthCurrency, formatPercent } from '@/types/wealth-tree'
import { SavingsRateGauge } from './SavingsRateGauge'

interface WealthSummaryCardsProps {
  dashboard: WealthDashboard
}

interface SummaryCardProps {
  label: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: 'positive' | 'negative' | 'neutral'
}

function SummaryCard({ label, value, subtitle, icon, trend }: SummaryCardProps) {
  const trendColor =
    trend === 'positive'
      ? 'text-green-600'
      : trend === 'negative'
        ? 'text-red-600'
        : 'text-gray-900'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-400">
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold ${trendColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

export function WealthSummaryCards({ dashboard }: WealthSummaryCardsProps) {
  const currency = dashboard.profile?.currency ?? 'USD'
  const netWorthTrend: 'positive' | 'negative' | 'neutral' =
    dashboard.net_worth > 0
      ? 'positive'
      : dashboard.net_worth < 0
        ? 'negative'
        : 'neutral'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Monthly Income */}
      <SummaryCard
        label="Monthly Income"
        value={formatWealthCurrency(dashboard.income_this_month, currency)}
        subtitle={`YTD: ${formatWealthCurrency(dashboard.income_ytd, currency)}`}
        trend="positive"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      {/* Monthly Expenses */}
      <SummaryCard
        label="Monthly Expenses"
        value={formatWealthCurrency(dashboard.expenses_this_month, currency)}
        subtitle={`YTD: ${formatWealthCurrency(dashboard.expenses_ytd, currency)}`}
        trend="negative"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
      />

      {/* Savings Rate - with gauge */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col items-center justify-center">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Savings Rate
        </span>
        <SavingsRateGauge
          actualRate={dashboard.savings_rate_actual}
          targetRate={dashboard.savings_rate_target}
          size={100}
        />
      </div>

      {/* Net Worth */}
      <SummaryCard
        label="Net Worth"
        value={formatWealthCurrency(dashboard.net_worth, currency)}
        subtitle={
          dashboard.total_debt > 0
            ? `Debt: ${formatWealthCurrency(dashboard.total_debt, currency)}`
            : undefined
        }
        trend={netWorthTrend}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />

      {/* Total Investments */}
      <SummaryCard
        label="Investments"
        value={formatWealthCurrency(dashboard.total_investments, currency)}
        subtitle={`Emergency: ${formatPercent(dashboard.emergency_fund_progress)} funded`}
        trend="positive"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />
    </div>
  )
}
