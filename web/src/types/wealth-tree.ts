/**
 * Wealth Tree Types
 *
 * Data types for the personal finance hub inspired by
 * "The Richest Man in Babylon" — 7 Cures for a Lean Purse.
 */

// ─── Enum-like types ────────────────────────────────────────

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
export type TreeTier = 'roots' | 'trunk' | 'branches' | 'canopy' | 'fruits'
export type CureNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type GoalStatus = 'active' | 'completed' | 'paused'
export type SkillStatus = 'planned' | 'in_progress' | 'completed'

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly'
export type IncomeSource = 'salary' | 'freelance' | 'dividends' | 'rental' | 'business' | 'other'
export type ExpenseCategory =
  | 'housing' | 'food' | 'transport' | 'insurance'
  | 'healthcare' | 'education' | 'entertainment'
  | 'utilities' | 'clothing' | 'personal' | 'giving' | 'other'
export type AssetType = 'stock' | 'etf' | 'bond' | 'real_estate' | 'crypto' | 'cash' | 'other'
export type AccountType = 'taxable' | 'ira' | '401k' | 'roth' | 'hsa' | 'savings' | 'other'
export type DebtType = 'mortgage' | 'student_loan' | 'auto_loan' | 'credit_card' | 'personal' | 'other'

// ─── Core entities ──────────────────────────────────────────

export interface WealthProfile {
  id: string
  user_id: string
  currency: string
  annual_income: number | null
  savings_rate_target: number
  emergency_fund_target_months: number
  retirement_age_target: number
  current_age: number | null
  risk_tolerance: RiskTolerance
  created_at: string
  updated_at: string
}

export interface IncomeEntry {
  id: string
  user_id: string
  entry_date: string
  source: IncomeSource
  amount: number
  is_recurring: boolean
  recurrence_frequency: RecurrenceFrequency | null
  recurring_parent_id: string | null
  notes: string | null
  created_at: string
}

export interface ExpenseEntry {
  id: string
  user_id: string
  entry_date: string
  category: ExpenseCategory
  amount: number
  is_recurring: boolean
  recurrence_frequency: RecurrenceFrequency | null
  recurring_parent_id: string | null
  notes: string | null
  created_at: string
}

export interface SavingsEntry {
  id: string
  user_id: string
  entry_date: string
  amount: number
  account_type: string
  notes: string | null
  created_at: string
}

export interface Investment {
  id: string
  user_id: string
  asset_type: AssetType
  name: string
  ticker: string | null
  purchase_date: string | null
  purchase_price: number | null
  quantity: number | null
  current_value: number | null
  account: AccountType
  notes: string | null
  created_at: string
  updated_at: string
}

export interface NetWorthSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, number>
  created_at: string
}

export interface WealthGoal {
  id: string
  user_id: string
  cure_number: CureNumber
  title: string
  description: string | null
  target_amount: number | null
  current_amount: number
  target_date: string | null
  status: GoalStatus
  tree_tier: TreeTier
  created_at: string
  updated_at: string
}

export interface DebtEntry {
  id: string
  user_id: string
  name: string
  debt_type: DebtType
  original_amount: number | null
  current_balance: number
  interest_rate: number | null
  minimum_payment: number | null
  monthly_payment: number | null
  payoff_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SkillInvestment {
  id: string
  user_id: string
  name: string
  category: string | null
  cost: number
  expected_income_increase: number | null
  start_date: string | null
  completion_date: string | null
  status: SkillStatus
  notes: string | null
  created_at: string
}

// ─── Calculator types ───────────────────────────────────────

export interface GrowthScenario {
  name: string
  initial_amount: number
  monthly_contribution: number
  annual_return: number      // decimal: 0.07 = 7%
  years: number
  inflation_rate: number     // decimal: 0.03 = 3%
}

export interface GrowthProjection {
  year: number
  nominal_value: number
  real_value: number         // inflation-adjusted
  total_contributions: number
  total_growth: number
}

export interface DebtPayoffSchedule {
  month: number
  payment: number
  principal: number
  interest: number
  remaining_balance: number
}

// ─── Dashboard aggregation ──────────────────────────────────

export interface WealthDashboard {
  profile: WealthProfile | null
  income_this_month: number
  income_ytd: number
  expenses_this_month: number
  expenses_ytd: number
  savings_rate_actual: number
  savings_rate_target: number
  total_savings: number
  total_investments: number
  total_debt: number
  net_worth: number
  emergency_fund_progress: number  // 0-1
  goals_by_tier: Record<TreeTier, { total: number; completed: number }>
  cure_scores: Record<CureNumber, number>  // 0-100 health score per cure
}

// ─── Tree configuration ─────────────────────────────────────

export interface TreeTierConfig {
  tier: TreeTier
  label: string
  subtitle: string
  cures: CureNumber[]
  color: string
  bgColor: string
  borderColor: string
  description: string
}

export const TREE_TIERS: TreeTierConfig[] = [
  {
    tier: 'fruits',
    label: 'Fruits',
    subtitle: 'Results',
    cures: [6, 7],
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Passive income, wealth milestones, growing earning power',
  },
  {
    tier: 'canopy',
    label: 'Canopy',
    subtitle: 'Protection',
    cures: [4],
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Guard your treasures — diversification, risk management',
  },
  {
    tier: 'branches',
    label: 'Branches',
    subtitle: 'Growth',
    cures: [3, 5],
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Make your gold multiply — investments, real estate',
  },
  {
    tier: 'trunk',
    label: 'Trunk',
    subtitle: 'Core',
    cures: [1, 2],
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Save at least 10%, control your expenditures',
  },
  {
    tier: 'roots',
    label: 'Roots',
    subtitle: 'Foundation',
    cures: [4],
    color: 'text-stone-700',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-200',
    description: 'Emergency fund, debt management, insurance',
  },
]

export interface CureConfig {
  number: CureNumber
  title: string
  principle: string
  tier: TreeTier
  description: string
}

export const SEVEN_CURES: CureConfig[] = [
  {
    number: 1,
    title: 'Start Thy Purse to Fattening',
    principle: 'Save at least 10% of income',
    tier: 'trunk',
    description: 'For every ten coins thou placest within thy purse, take out for use but nine.',
  },
  {
    number: 2,
    title: 'Control Thy Expenditures',
    principle: 'Budget wisely — needs vs desires',
    tier: 'trunk',
    description: 'Budget thy expenses that thou mayest have coins to pay for thy necessities and still have coins for thy enjoyments.',
  },
  {
    number: 3,
    title: 'Make Thy Gold Multiply',
    principle: 'Invest for compound growth',
    tier: 'branches',
    description: 'Put each coin to laboring that it may reproduce its kind even as the flocks of the field.',
  },
  {
    number: 4,
    title: 'Guard Thy Treasures from Loss',
    principle: 'Protect against risk',
    tier: 'canopy',
    description: 'Guard thy treasure from loss by investing only where thy principal is safe and where it may be reclaimed.',
  },
  {
    number: 5,
    title: 'Make of Thy Dwelling a Profitable Investment',
    principle: 'Own your home',
    tier: 'branches',
    description: 'Own thy own home. Reduce the cost of living, and have more to spend on enjoyment and building wealth.',
  },
  {
    number: 6,
    title: 'Ensure a Future Income',
    principle: 'Plan for retirement & passive income',
    tier: 'fruits',
    description: 'Provide in advance for the needs of thy growing age and the protection of thy family.',
  },
  {
    number: 7,
    title: 'Increase Thy Ability to Earn',
    principle: 'Invest in yourself — skills & education',
    tier: 'fruits',
    description: 'Cultivate thy own powers, study and become wiser, become more skillful. So act as to respect thyself.',
  },
]

// ─── Color helpers ──────────────────────────────────────────

export const TIER_COLORS: Record<TreeTier, { bg: string; border: string; text: string; accent: string }> = {
  fruits: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: '#d97706' },
  canopy: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: '#059669' },
  branches: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: '#15803d' },
  trunk: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', accent: '#a16207' },
  roots: { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-700', accent: '#57534e' },
}

export const RISK_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
}

// ─── Formatting helpers ─────────────────────────────────────

export function formatWealthCurrency(value: number, currency: string = 'USD'): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function getCureForTier(tier: TreeTier): CureConfig[] {
  return SEVEN_CURES.filter(c => c.tier === tier)
}
