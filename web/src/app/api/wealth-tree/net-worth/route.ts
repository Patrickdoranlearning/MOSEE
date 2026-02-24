import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getNetWorthHistory, upsertNetWorthSnapshot } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const history = await getNetWorthHistory(session.user.id)
    return NextResponse.json(history)
  } catch (e) {
    console.error('GET /api/wealth-tree/net-worth error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch net worth history' },
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

    if (!body.snapshot_date || body.total_assets == null || body.total_liabilities == null) {
      return NextResponse.json(
        { error: 'snapshot_date, total_assets, and total_liabilities are required' },
        { status: 400 }
      )
    }

    const snapshot = await upsertNetWorthSnapshot(session.user.id, body)
    return NextResponse.json(snapshot, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/net-worth error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save net worth snapshot' },
      { status: 500 }
    )
  }
}
