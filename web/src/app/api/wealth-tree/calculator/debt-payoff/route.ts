import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { DebtPayoffSchedule } from '@/types/wealth-tree'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { current_balance, interest_rate, monthly_payment } = body

    if (current_balance == null || interest_rate == null || monthly_payment == null) {
      return NextResponse.json(
        { error: 'current_balance, interest_rate, and monthly_payment are required' },
        { status: 400 }
      )
    }

    if (current_balance <= 0) {
      return NextResponse.json(
        { error: 'current_balance must be greater than 0' },
        { status: 400 }
      )
    }

    const monthlyRate = interest_rate / 12

    // Check if payment is sufficient to cover at least the first month's interest
    const firstMonthInterest = current_balance * monthlyRate
    if (monthly_payment <= firstMonthInterest) {
      return NextResponse.json(
        {
          error: `Monthly payment ($${monthly_payment.toFixed(2)}) must exceed the first month's interest ($${firstMonthInterest.toFixed(2)}) to pay off the debt`,
        },
        { status: 400 }
      )
    }

    const schedule: DebtPayoffSchedule[] = []
    let remainingBalance = current_balance
    let month = 0
    const maxMonths = 1200 // 100-year safety cap

    while (remainingBalance > 0 && month < maxMonths) {
      month++
      const interest = remainingBalance * monthlyRate
      const payment = Math.min(monthly_payment, remainingBalance + interest)
      const principal = payment - interest
      remainingBalance = Math.max(remainingBalance - principal, 0)

      schedule.push({
        month,
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remaining_balance: Math.round(remainingBalance * 100) / 100,
      })
    }

    return NextResponse.json(schedule)
  } catch (e) {
    console.error('POST /api/wealth-tree/calculator/debt-payoff error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to compute debt payoff schedule' },
      { status: 500 }
    )
  }
}
