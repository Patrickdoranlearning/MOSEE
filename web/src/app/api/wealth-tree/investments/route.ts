import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getInvestments, createInvestment } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const investments = await getInvestments(session.user.id)
    return NextResponse.json(investments)
  } catch (e) {
    console.error('GET /api/wealth-tree/investments error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch investments' },
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

    if (!body.asset_type || !body.name) {
      return NextResponse.json(
        { error: 'asset_type and name are required' },
        { status: 400 }
      )
    }

    const investment = await createInvestment(session.user.id, body)
    return NextResponse.json(investment, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/investments error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create investment' },
      { status: 500 }
    )
  }
}
