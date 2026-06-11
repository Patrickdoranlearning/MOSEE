import { NextRequest, NextResponse } from 'next/server'
import { triggerDeepDive } from '@/lib/deep-dive'

/**
 * Vercel Cron entry point. Vercel pings GET on schedule with a bearer token
 * matching CRON_SECRET. If the secret is not configured we refuse to trigger
 * rather than running unauthenticated — a missing secret is a misconfiguration,
 * not a license to fire.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await triggerDeepDive({
    kind: 'scheduled',
    triggeredBy: 'vercel-cron',
    // Cron always honors the cooldown — if a manual run already happened this
    // month, the scheduled one stands down.
    force: false,
  })

  if (!result.ok) {
    // 409/429 here mean "we deliberately skipped" — return 200 so Vercel
    // doesn't keep retrying.
    const skipped = result.status === 409 || result.status === 429
    return NextResponse.json(
      { ok: false, skipped, error: result.error, run: result.run ?? null },
      { status: skipped ? 200 : result.status }
    )
  }

  return NextResponse.json({ ok: true, run: result.run })
}
