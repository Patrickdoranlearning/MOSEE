import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getWealthProfile, upsertWealthProfile } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getWealthProfile(session.user.id)
    return NextResponse.json(profile)
  } catch (e) {
    console.error('GET /api/wealth-tree/profile error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch profile' },
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
    const profile = await upsertWealthProfile(session.user.id, body)
    return NextResponse.json(profile, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/profile error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save profile' },
      { status: 500 }
    )
  }
}
