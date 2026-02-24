import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDebts, createDebt } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const debts = await getDebts(session.user.id)
    return NextResponse.json(debts)
  } catch (e) {
    console.error('GET /api/wealth-tree/debts error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch debts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name || !body.debt_type || body.current_balance == null) {
      return NextResponse.json(
        { error: 'name, debt_type, and current_balance are required' },
        { status: 400 }
      )
    }

    const debt = await createDebt(session.user.id, body)
    return NextResponse.json(debt, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/debts error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create debt' },
      { status: 500 }
    )
  }
}
