import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ensureDeepDiveSchema, getActiveRun, getLatestRun, sweepStaleRuns } from '@/lib/db'
import type { AnalysisRun } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * triggered_by holds a user email. The route stays public so DeepDiveButton can
 * poll without a session, but we only expose triggered_by to authenticated
 * callers — anonymous responses omit it (clients tolerate the absent field).
 */
function redactRun(run: AnalysisRun | null, includePii: boolean): AnalysisRun | null {
  if (!run || includePii) return run
  return { ...run, triggered_by: null }
}

export async function GET() {
  try {
    await ensureDeepDiveSchema()
    await sweepStaleRuns()
    const [session, active, latest] = await Promise.all([
      auth(),
      getActiveRun(),
      getLatestRun(),
    ])
    const includePii = Boolean(session?.user?.id)
    return NextResponse.json({
      active: redactRun(active, includePii),
      latest: redactRun(latest, includePii),
    })
  } catch (e) {
    console.error('GET /api/deep-dive/status error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load status' },
      { status: 500 }
    )
  }
}
