import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { GrowthProjection } from '@/types/wealth-tree'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      initial_amount,
      monthly_contribution,
      annual_return,
      years,
      inflation_rate,
    } = body

    if (
      initial_amount == null ||
      monthly_contribution == null ||
      annual_return == null ||
      years == null ||
      inflation_rate == null
    ) {
      return NextResponse.json(
        { error: 'initial_amount, monthly_contribution, annual_return, years, and inflation_rate are required' },
        { status: 400 }
      )
    }

    if (years <= 0 || years > 100) {
      return NextResponse.json(
        { error: 'years must be between 1 and 100' },
        { status: 400 }
      )
    }

    const projections: GrowthProjection[] = []
    const monthlyReturn = annual_return / 12
    const monthlyInflation = inflation_rate / 12

    let nominalValue = initial_amount
    let totalContributions = initial_amount

    for (let year = 1; year <= years; year++) {
      // Compound monthly for this year
      for (let month = 0; month < 12; month++) {
        nominalValue = nominalValue * (1 + monthlyReturn) + monthly_contribution
        totalContributions += monthly_contribution
      }

      // Calculate inflation-adjusted (real) value
      const cumulativeInflation = Math.pow(1 + inflation_rate, year)
      const realValue = nominalValue / cumulativeInflation

      const totalGrowth = nominalValue - totalContributions

      projections.push({
        year,
        nominal_value: Math.round(nominalValue * 100) / 100,
        real_value: Math.round(realValue * 100) / 100,
        total_contributions: Math.round(totalContributions * 100) / 100,
        total_growth: Math.round(totalGrowth * 100) / 100,
      })
    }

    return NextResponse.json(projections)
  } catch (e) {
    console.error('POST /api/wealth-tree/calculator/compound error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to compute compound growth' },
      { status: 500 }
    )
  }
}
