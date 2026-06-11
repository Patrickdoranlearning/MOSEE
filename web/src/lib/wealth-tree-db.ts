/**
 * Wealth Tree Database Client
 *
 * Query functions for all Wealth Tree tables.
 * Follows the pattern established in db.ts for MOSEE stock analyses.
 */

import { sql } from '@vercel/postgres'
import type {
  WealthProfile,
  IncomeEntry,
  ExpenseEntry,
  SavingsEntry,
  Investment,
  NetWorthSnapshot,
  WealthGoal,
  DebtEntry,
  SkillInvestment,
  WealthDashboard,
  TreeTier,
  RecurrenceFrequency,
} from '@/types/wealth-tree'

// ─── Numeric conversion helper ──────────────────────────────

function toNum(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

// ─── Profile ────────────────────────────────────────────────

export async function getWealthProfile(userId: string): Promise<WealthProfile | null> {
  const { rows } = await sql`
    SELECT * FROM wt_profiles WHERE user_id = ${userId} LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    annual_income: toNum(r.annual_income),
    savings_rate_target: toNum(r.savings_rate_target) ?? 0.10,
    emergency_fund_target_months: Number(r.emergency_fund_target_months) || 6,
    retirement_age_target: Number(r.retirement_age_target) || 65,
    current_age: toNum(r.current_age),
  } as WealthProfile
}

export async function upsertWealthProfile(
  userId: string,
  data: Partial<Omit<WealthProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<WealthProfile> {
  const { rows } = await sql`
    INSERT INTO wt_profiles (user_id, currency, annual_income, savings_rate_target,
      emergency_fund_target_months, retirement_age_target, current_age, risk_tolerance)
    VALUES (
      ${userId},
      ${data.currency || 'USD'},
      ${data.annual_income ?? null},
      ${data.savings_rate_target ?? 0.10},
      ${data.emergency_fund_target_months ?? 6},
      ${data.retirement_age_target ?? 65},
      ${data.current_age ?? null},
      ${data.risk_tolerance || 'moderate'}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      currency = EXCLUDED.currency,
      annual_income = EXCLUDED.annual_income,
      savings_rate_target = EXCLUDED.savings_rate_target,
      emergency_fund_target_months = EXCLUDED.emergency_fund_target_months,
      retirement_age_target = EXCLUDED.retirement_age_target,
      current_age = EXCLUDED.current_age,
      risk_tolerance = EXCLUDED.risk_tolerance,
      updated_at = now()
    RETURNING *
  `
  return rows[0] as unknown as WealthProfile
}

// ─── Recurring generation helpers ───────────────────────────

function toDateOnly(raw: unknown): string {
  // Neon returns DATE columns as JS Date objects
  if (raw instanceof Date) return raw.toISOString().split('T')[0]
  // Handle ISO strings like "2026-02-27T00:00:00.000Z"
  const s = String(raw)
  if (s.includes('T')) return s.split('T')[0]
  return s
}

function addInterval(dateStr: string, frequency: RecurrenceFrequency): string {
  const clean = toDateOnly(dateStr)
  const d = new Date(clean + 'T00:00:00')
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14)
      break
    case 'monthly': {
      const origDay = d.getDate()
      d.setMonth(d.getMonth() + 1)
      // Clamp to end of month if the original day overflows (e.g., Jan 31 -> Feb 28)
      if (d.getDate() !== origDay) d.setDate(0)
      break
    }
  }
  return d.toISOString().split('T')[0]
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

async function generateRecurringIncome(userId: string): Promise<void> {
  const today = todayStr()

  // Find all recurring templates (entries that ARE templates, not generated children)
  const { rows: templates } = await sql`
    SELECT * FROM wt_income
    WHERE user_id = ${userId}
      AND recurrence_frequency IS NOT NULL
      AND recurring_parent_id IS NULL
  `

  for (const tpl of templates) {
    const freq = tpl.recurrence_frequency as RecurrenceFrequency

    // Find the latest generated entry for this template
    const { rows: lastRows } = await sql`
      SELECT MAX(entry_date) as last_date FROM wt_income
      WHERE recurring_parent_id = ${tpl.id}
    `
    const lastDate = lastRows[0]?.last_date
      ? toDateOnly(lastRows[0].last_date)
      : null

    // Start from next interval after the latest entry (or after the template date)
    let nextDate = addInterval(lastDate || toDateOnly(tpl.entry_date), freq)

    while (nextDate <= today) {
      await sql`
        INSERT INTO wt_income (user_id, entry_date, source, amount, is_recurring, recurrence_frequency, recurring_parent_id, notes)
        VALUES (${userId}, ${nextDate}, ${tpl.source}, ${tpl.amount}, true, NULL, ${tpl.id}, ${tpl.notes})
      `
      nextDate = addInterval(nextDate, freq)
    }
  }
}

async function generateRecurringExpenses(userId: string): Promise<void> {
  const today = todayStr()

  const { rows: templates } = await sql`
    SELECT * FROM wt_expenses
    WHERE user_id = ${userId}
      AND recurrence_frequency IS NOT NULL
      AND recurring_parent_id IS NULL
  `

  for (const tpl of templates) {
    const freq = tpl.recurrence_frequency as RecurrenceFrequency

    const { rows: lastRows } = await sql`
      SELECT MAX(entry_date) as last_date FROM wt_expenses
      WHERE recurring_parent_id = ${tpl.id}
    `
    const lastDate = lastRows[0]?.last_date
      ? toDateOnly(lastRows[0].last_date)
      : null

    let nextDate = addInterval(lastDate || toDateOnly(tpl.entry_date), freq)

    while (nextDate <= today) {
      await sql`
        INSERT INTO wt_expenses (user_id, entry_date, category, amount, is_recurring, recurrence_frequency, recurring_parent_id, notes)
        VALUES (${userId}, ${nextDate}, ${tpl.category}, ${tpl.amount}, true, NULL, ${tpl.id}, ${tpl.notes})
      `
      nextDate = addInterval(nextDate, freq)
    }
  }
}

// ─── Income ─────────────────────────────────────────────────

export async function getIncomeEntries(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<IncomeEntry[]> {
  // Auto-generate any missing recurring entries before fetching
  await generateRecurringIncome(userId)

  if (startDate && endDate) {
    const { rows } = await sql`
      SELECT * FROM wt_income
      WHERE user_id = ${userId} AND entry_date BETWEEN ${startDate} AND ${endDate}
      ORDER BY entry_date DESC
    `
    return rows as unknown as IncomeEntry[]
  }
  const { rows } = await sql`
    SELECT * FROM wt_income WHERE user_id = ${userId} ORDER BY entry_date DESC LIMIT 100
  `
  return rows as unknown as IncomeEntry[]
}

export async function createIncomeEntry(
  userId: string,
  data: {
    entry_date: string; source: string; amount: number;
    is_recurring?: boolean; recurrence_frequency?: RecurrenceFrequency | null; notes?: string
  }
): Promise<IncomeEntry> {
  const isRecurring = data.recurrence_frequency ? true : (data.is_recurring ?? false)
  const { rows } = await sql`
    INSERT INTO wt_income (user_id, entry_date, source, amount, is_recurring, recurrence_frequency, notes)
    VALUES (${userId}, ${data.entry_date}, ${data.source}, ${data.amount},
            ${isRecurring}, ${data.recurrence_frequency || null}, ${data.notes || null})
    RETURNING *
  `
  return rows[0] as unknown as IncomeEntry
}

export async function deleteIncomeEntry(userId: string, id: string): Promise<boolean> {
  // Deleting a template cascades to all generated children via FK ON DELETE CASCADE
  const { rowCount } = await sql`
    DELETE FROM wt_income WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Expenses ───────────────────────────────────────────────

export async function getExpenseEntries(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<ExpenseEntry[]> {
  // Auto-generate any missing recurring entries before fetching
  await generateRecurringExpenses(userId)

  if (startDate && endDate) {
    const { rows } = await sql`
      SELECT * FROM wt_expenses
      WHERE user_id = ${userId} AND entry_date BETWEEN ${startDate} AND ${endDate}
      ORDER BY entry_date DESC
    `
    return rows as unknown as ExpenseEntry[]
  }
  const { rows } = await sql`
    SELECT * FROM wt_expenses WHERE user_id = ${userId} ORDER BY entry_date DESC LIMIT 100
  `
  return rows as unknown as ExpenseEntry[]
}

export async function createExpenseEntry(
  userId: string,
  data: {
    entry_date: string; category: string; amount: number;
    is_recurring?: boolean; recurrence_frequency?: RecurrenceFrequency | null; notes?: string
  }
): Promise<ExpenseEntry> {
  const isRecurring = data.recurrence_frequency ? true : (data.is_recurring ?? false)
  const { rows } = await sql`
    INSERT INTO wt_expenses (user_id, entry_date, category, amount, is_recurring, recurrence_frequency, notes)
    VALUES (${userId}, ${data.entry_date}, ${data.category}, ${data.amount},
            ${isRecurring}, ${data.recurrence_frequency || null}, ${data.notes || null})
    RETURNING *
  `
  return rows[0] as unknown as ExpenseEntry
}

export async function deleteExpenseEntry(userId: string, id: string): Promise<boolean> {
  // Deleting a template cascades to all generated children via FK ON DELETE CASCADE
  const { rowCount } = await sql`
    DELETE FROM wt_expenses WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Savings ────────────────────────────────────────────────

export async function getSavingsEntries(userId: string): Promise<SavingsEntry[]> {
  const { rows } = await sql`
    SELECT * FROM wt_savings WHERE user_id = ${userId} ORDER BY entry_date DESC LIMIT 100
  `
  return rows as unknown as SavingsEntry[]
}

export async function createSavingsEntry(
  userId: string,
  data: { entry_date: string; amount: number; account_type?: string; notes?: string }
): Promise<SavingsEntry> {
  const { rows } = await sql`
    INSERT INTO wt_savings (user_id, entry_date, amount, account_type, notes)
    VALUES (${userId}, ${data.entry_date}, ${data.amount},
            ${data.account_type || 'general'}, ${data.notes || null})
    ON CONFLICT (user_id, entry_date, account_type) DO UPDATE SET
      amount = EXCLUDED.amount,
      notes = EXCLUDED.notes
    RETURNING *
  `
  return rows[0] as unknown as SavingsEntry
}

export async function deleteSavingsEntry(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM wt_savings WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Investments ────────────────────────────────────────────

export async function getInvestments(userId: string): Promise<Investment[]> {
  const { rows } = await sql`
    SELECT * FROM wt_investments WHERE user_id = ${userId} ORDER BY updated_at DESC
  `
  return rows as unknown as Investment[]
}

export async function createInvestment(
  userId: string,
  data: {
    asset_type: string; name: string; ticker?: string; purchase_date?: string;
    purchase_price?: number; quantity?: number; current_value?: number;
    account?: string; notes?: string
  }
): Promise<Investment> {
  const { rows } = await sql`
    INSERT INTO wt_investments (user_id, asset_type, name, ticker, purchase_date,
      purchase_price, quantity, current_value, account, notes)
    VALUES (${userId}, ${data.asset_type}, ${data.name}, ${data.ticker || null},
      ${data.purchase_date || null}, ${data.purchase_price ?? null},
      ${data.quantity ?? null}, ${data.current_value ?? null},
      ${data.account || 'taxable'}, ${data.notes || null})
    RETURNING *
  `
  return rows[0] as unknown as Investment
}

export async function updateInvestment(
  userId: string,
  id: string,
  data: Partial<Investment>
): Promise<Investment | null> {
  const { rows } = await sql`
    UPDATE wt_investments SET
      asset_type = COALESCE(${data.asset_type ?? null}, asset_type),
      name = COALESCE(${data.name ?? null}, name),
      ticker = COALESCE(${data.ticker ?? null}, ticker),
      current_value = COALESCE(${data.current_value ?? null}, current_value),
      notes = COALESCE(${data.notes ?? null}, notes),
      updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return rows.length > 0 ? (rows[0] as unknown as Investment) : null
}

export async function deleteInvestment(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM wt_investments WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Debts ──────────────────────────────────────────────────

export async function getDebts(userId: string): Promise<DebtEntry[]> {
  const { rows } = await sql`
    SELECT * FROM wt_debts WHERE user_id = ${userId} ORDER BY current_balance DESC
  `
  return rows as unknown as DebtEntry[]
}

export async function createDebt(
  userId: string,
  data: {
    name: string; debt_type: string; original_amount?: number; current_balance: number;
    interest_rate?: number; minimum_payment?: number; monthly_payment?: number;
    payoff_date?: string; notes?: string
  }
): Promise<DebtEntry> {
  const { rows } = await sql`
    INSERT INTO wt_debts (user_id, name, debt_type, original_amount, current_balance,
      interest_rate, minimum_payment, monthly_payment, payoff_date, notes)
    VALUES (${userId}, ${data.name}, ${data.debt_type}, ${data.original_amount ?? null},
      ${data.current_balance}, ${data.interest_rate ?? null},
      ${data.minimum_payment ?? null}, ${data.monthly_payment ?? null},
      ${data.payoff_date || null}, ${data.notes || null})
    RETURNING *
  `
  return rows[0] as unknown as DebtEntry
}

export async function updateDebt(
  userId: string,
  id: string,
  data: Partial<DebtEntry>
): Promise<DebtEntry | null> {
  const { rows } = await sql`
    UPDATE wt_debts SET
      current_balance = COALESCE(${data.current_balance ?? null}, current_balance),
      monthly_payment = COALESCE(${data.monthly_payment ?? null}, monthly_payment),
      notes = COALESCE(${data.notes ?? null}, notes),
      updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return rows.length > 0 ? (rows[0] as unknown as DebtEntry) : null
}

export async function deleteDebt(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM wt_debts WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Net Worth ──────────────────────────────────────────────

export async function getNetWorthHistory(userId: string, limit: number = 24): Promise<NetWorthSnapshot[]> {
  const { rows } = await sql`
    SELECT * FROM wt_net_worth
    WHERE user_id = ${userId}
    ORDER BY snapshot_date DESC
    LIMIT ${limit}
  `
  return rows as unknown as NetWorthSnapshot[]
}

export async function upsertNetWorthSnapshot(
  userId: string,
  data: { snapshot_date: string; total_assets: number; total_liabilities: number; breakdown?: Record<string, number> }
): Promise<NetWorthSnapshot> {
  const netWorth = data.total_assets - data.total_liabilities
  const { rows } = await sql`
    INSERT INTO wt_net_worth (user_id, snapshot_date, total_assets, total_liabilities, net_worth, breakdown)
    VALUES (${userId}, ${data.snapshot_date}, ${data.total_assets}, ${data.total_liabilities},
            ${netWorth}, ${JSON.stringify(data.breakdown || {})})
    ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
      total_assets = EXCLUDED.total_assets,
      total_liabilities = EXCLUDED.total_liabilities,
      net_worth = EXCLUDED.net_worth,
      breakdown = EXCLUDED.breakdown
    RETURNING *
  `
  return rows[0] as unknown as NetWorthSnapshot
}

// ─── Goals ──────────────────────────────────────────────────

export async function getGoals(userId: string): Promise<WealthGoal[]> {
  const { rows } = await sql`
    SELECT * FROM wt_goals WHERE user_id = ${userId} ORDER BY cure_number, created_at
  `
  return rows as unknown as WealthGoal[]
}

export async function createGoal(
  userId: string,
  data: {
    cure_number: number; title: string; description?: string; target_amount?: number;
    target_date?: string; tree_tier: string
  }
): Promise<WealthGoal> {
  const { rows } = await sql`
    INSERT INTO wt_goals (user_id, cure_number, title, description, target_amount, target_date, tree_tier)
    VALUES (${userId}, ${data.cure_number}, ${data.title}, ${data.description || null},
            ${data.target_amount ?? null}, ${data.target_date || null}, ${data.tree_tier})
    RETURNING *
  `
  return rows[0] as unknown as WealthGoal
}

export async function updateGoal(
  userId: string,
  id: string,
  data: Partial<WealthGoal>
): Promise<WealthGoal | null> {
  const { rows } = await sql`
    UPDATE wt_goals SET
      current_amount = COALESCE(${data.current_amount ?? null}, current_amount),
      status = COALESCE(${data.status ?? null}, status),
      title = COALESCE(${data.title ?? null}, title),
      description = COALESCE(${data.description ?? null}, description),
      updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return rows.length > 0 ? (rows[0] as unknown as WealthGoal) : null
}

export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM wt_goals WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Skills ─────────────────────────────────────────────────

export async function getSkills(userId: string): Promise<SkillInvestment[]> {
  const { rows } = await sql`
    SELECT * FROM wt_skills WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return rows as unknown as SkillInvestment[]
}

export async function createSkill(
  userId: string,
  data: {
    name: string; category?: string; cost?: number; expected_income_increase?: number;
    start_date?: string; completion_date?: string; status?: string; notes?: string
  }
): Promise<SkillInvestment> {
  const { rows } = await sql`
    INSERT INTO wt_skills (user_id, name, category, cost, expected_income_increase,
      start_date, completion_date, status, notes)
    VALUES (${userId}, ${data.name}, ${data.category || null}, ${data.cost ?? 0},
      ${data.expected_income_increase ?? null}, ${data.start_date || null},
      ${data.completion_date || null}, ${data.status || 'planned'}, ${data.notes || null})
    RETURNING *
  `
  return rows[0] as unknown as SkillInvestment
}

export async function deleteSkill(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM wt_skills WHERE id = ${id} AND user_id = ${userId}
  `
  return (rowCount ?? 0) > 0
}

// ─── Dashboard Aggregation ──────────────────────────────────

export async function getWealthDashboard(userId: string): Promise<WealthDashboard> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = `${year}-${month}-01`
  const yearStart = `${year}-01-01`
  const monthEnd = new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0]

  // Run all queries in parallel
  const [
    profileResult,
    incomeMonthResult,
    incomeYtdResult,
    expensesMonthResult,
    expensesYtdResult,
    savingsResult,
    investmentsResult,
    debtsResult,
    netWorthResult,
    goalsResult,
  ] = await Promise.all([
    sql`SELECT * FROM wt_profiles WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM wt_income WHERE user_id = ${userId} AND entry_date BETWEEN ${monthStart} AND ${monthEnd}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM wt_income WHERE user_id = ${userId} AND entry_date >= ${yearStart}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM wt_expenses WHERE user_id = ${userId} AND entry_date BETWEEN ${monthStart} AND ${monthEnd}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM wt_expenses WHERE user_id = ${userId} AND entry_date >= ${yearStart}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM wt_savings WHERE user_id = ${userId}`,
    sql`SELECT COALESCE(SUM(current_value), 0) as total FROM wt_investments WHERE user_id = ${userId}`,
    sql`SELECT COALESCE(SUM(current_balance), 0) as total FROM wt_debts WHERE user_id = ${userId}`,
    sql`SELECT * FROM wt_net_worth WHERE user_id = ${userId} ORDER BY snapshot_date DESC LIMIT 1`,
    sql`SELECT tree_tier, status, COUNT(*) as cnt FROM wt_goals WHERE user_id = ${userId} GROUP BY tree_tier, status`,
  ])

  const profile = profileResult.rows.length > 0 ? (profileResult.rows[0] as unknown as WealthProfile) : null
  const incomeMonth = Number(incomeMonthResult.rows[0]?.total) || 0
  const incomeYtd = Number(incomeYtdResult.rows[0]?.total) || 0
  const expensesMonth = Number(expensesMonthResult.rows[0]?.total) || 0
  const expensesYtd = Number(expensesYtdResult.rows[0]?.total) || 0
  const totalSavings = Number(savingsResult.rows[0]?.total) || 0
  const totalInvestments = Number(investmentsResult.rows[0]?.total) || 0
  const totalDebt = Number(debtsResult.rows[0]?.total) || 0
  const latestNetWorth = netWorthResult.rows.length > 0 ? Number(netWorthResult.rows[0]?.net_worth) || 0 : totalSavings + totalInvestments - totalDebt

  // Calculate savings rate
  const savingsRateActual = incomeMonth > 0 ? (incomeMonth - expensesMonth) / incomeMonth : 0
  const savingsRateTarget = profile ? Number(profile.savings_rate_target) || 0.10 : 0.10

  // Emergency fund progress
  const monthlyExpenses = expensesMonth || (expensesYtd / Math.max(now.getMonth() + 1, 1))
  const targetEmergencyFund = monthlyExpenses * (profile?.emergency_fund_target_months || 6)
  const emergencyFundProgress = targetEmergencyFund > 0 ? Math.min(totalSavings / targetEmergencyFund, 1) : 0

  // Goals by tier
  const tiers: TreeTier[] = ['roots', 'trunk', 'branches', 'canopy', 'fruits']
  const goalsByTier = {} as Record<TreeTier, { total: number; completed: number }>
  for (const tier of tiers) {
    goalsByTier[tier] = { total: 0, completed: 0 }
  }
  for (const row of goalsResult.rows) {
    const tier = row.tree_tier as TreeTier
    if (goalsByTier[tier]) {
      goalsByTier[tier].total += Number(row.cnt) || 0
      if (row.status === 'completed') {
        goalsByTier[tier].completed += Number(row.cnt) || 0
      }
    }
  }

  // Simple cure health scores (0-100)
  const cureScores: Record<number, number> = {
    1: Math.min(Math.round((savingsRateActual / savingsRateTarget) * 100), 100),
    2: incomeMonth > 0 ? Math.min(Math.round(((incomeMonth - expensesMonth) / incomeMonth) * 100), 100) : 0,
    3: totalInvestments > 0 ? Math.min(50 + Math.round((totalInvestments / (incomeYtd || 1)) * 50), 100) : 0,
    4: Math.round(emergencyFundProgress * 100),
    5: 0, // Would need real estate data
    6: 0, // Would need retirement tracking
    7: 0, // Would need skills data
  }

  return {
    profile,
    income_this_month: incomeMonth,
    income_ytd: incomeYtd,
    expenses_this_month: expensesMonth,
    expenses_ytd: expensesYtd,
    savings_rate_actual: savingsRateActual,
    savings_rate_target: savingsRateTarget,
    total_savings: totalSavings,
    total_investments: totalInvestments,
    total_debt: totalDebt,
    net_worth: latestNetWorth,
    emergency_fund_progress: emergencyFundProgress,
    goals_by_tier: goalsByTier,
    cure_scores: cureScores as unknown as Record<1 | 2 | 3 | 4 | 5 | 6 | 7, number>,
  }
}
