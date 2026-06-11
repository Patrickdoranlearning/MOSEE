/**
 * Shared logic for the deep-dive trigger:
 *  - guards (no concurrent runs, monthly cooldown unless force=true)
 *  - inserts a 'pending' mosee_analysis_runs row
 *  - dispatches the GitHub Actions workflow with that run id
 *  - rolls the row back to 'failed' if dispatch fails so the UI never gets stuck
 *
 * Used by:
 *  - POST /api/deep-dive/trigger  (auth'd users hitting the button)
 *  - POST /api/cron/deep-dive     (Vercel monthly cron)
 */

import {
  ensureDeepDiveSchema,
  getActiveRun,
  getLatestRun,
  createPendingRun,
  markRunFailed,
  sweepStaleRuns,
  type AnalysisRun,
} from '@/lib/db'

// One full deep-dive per month. Manual button respects this unless `force` is set.
const COOLDOWN_DAYS = 28

export type TriggerResult =
  | { ok: true; run: AnalysisRun }
  | { ok: false; status: number; error: string; run?: AnalysisRun }

export async function triggerDeepDive(args: {
  kind: 'manual' | 'scheduled'
  triggeredBy: string | null
  force?: boolean
}): Promise<TriggerResult> {
  const repo = process.env.GITHUB_REPO          // e.g. "Patrickdoranlearning/MOSEE_2.0"
  const token = process.env.GITHUB_DISPATCH_TOKEN // PAT with `actions:write`
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'weekly-analysis.yml'

  if (!repo || !token) {
    return {
      ok: false,
      status: 500,
      error: 'Server is missing GITHUB_REPO or GITHUB_DISPATCH_TOKEN.',
    }
  }

  await ensureDeepDiveSchema()
  await sweepStaleRuns()

  // Block if a run is already in-flight.
  const active = await getActiveRun()
  if (active) {
    return {
      ok: false,
      status: 409,
      error: 'A deep-dive is already in progress.',
      run: active,
    }
  }

  // Cooldown unless explicitly forced.
  if (!args.force) {
    const latest = await getLatestRun()
    if (latest?.finished_at) {
      const ageDays = (Date.now() - new Date(latest.finished_at).getTime()) / 86_400_000
      if (ageDays < COOLDOWN_DAYS) {
        return {
          ok: false,
          status: 429,
          error: `Last deep-dive finished ${Math.floor(ageDays)} days ago. Cooldown is ${COOLDOWN_DAYS} days; pass force=true to override.`,
          run: latest,
        }
      }
    }
  }

  // Reserve the row first so the UI can show "pending" the instant the
  // dispatch fires (it might take a few seconds for Actions to spin up).
  const run = await createPendingRun({
    kind: args.kind,
    triggeredBy: args.triggeredBy,
  })

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`

  let resp: Response
  try {
    resp = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_REF || 'main',
        inputs: {
          run_id: run.id,
          run_kind: args.kind,
          triggered_by: args.triggeredBy ?? '',
          full_market: 'true',
          debug_mode: 'false',
        },
      }),
    })
  } catch (e) {
    await markRunFailed(run.id, `Workflow dispatch threw: ${e instanceof Error ? e.message : String(e)}`)
    return {
      ok: false,
      status: 502,
      error: 'Failed to reach GitHub Actions.',
      run,
    }
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    await markRunFailed(run.id, `Workflow dispatch returned ${resp.status}: ${detail.slice(0, 500)}`)
    return {
      ok: false,
      status: 502,
      error: `GitHub returned ${resp.status} when dispatching the workflow.`,
      run,
    }
  }

  return { ok: true, run }
}
