import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getWealthDashboard } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dashboard = await getWealthDashboard(session.user.id)
    return NextResponse.json(dashboard)
  } catch (e) {
    console.error('GET /api/wealth-tree/dashboard error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch dashboard' },
      { status: 500 }
    )
  }
}
