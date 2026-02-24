import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getGoals, createGoal } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const goals = await getGoals(session.user.id)
    return NextResponse.json(goals)
  } catch (e) {
    console.error('GET /api/wealth-tree/goals error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch goals' },
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

    if (body.cure_number == null || !body.title || !body.tree_tier) {
      return NextResponse.json(
        { error: 'cure_number, title, and tree_tier are required' },
        { status: 400 }
      )
    }

    const goal = await createGoal(session.user.id, body)
    return NextResponse.json(goal, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/goals error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create goal' },
      { status: 500 }
    )
  }
}
