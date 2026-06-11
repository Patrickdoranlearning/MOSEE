import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { triggerDeepDive } from '@/lib/deep-dive'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const force = body?.force === true

    const result = await triggerDeepDive({
      kind: 'manual',
      triggeredBy: session.user.email ?? session.user.id,
      force,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, run: result.run ?? null },
        { status: result.status }
      )
    }

    return NextResponse.json({ run: result.run }, { status: 202 })
  } catch (e) {
    console.error('POST /api/deep-dive/trigger error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to trigger deep dive' },
      { status: 500 }
    )
  }
}
