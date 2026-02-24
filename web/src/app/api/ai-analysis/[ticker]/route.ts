import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { sql } from '@vercel/postgres'

interface RouteContext {
  params: Promise<{ ticker: string }>
}

// Track active AI analyses to prevent concurrent runs
const activeAnalyses = new Set<string>()

function runAIAnalysis(ticker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd(), '..')
    const scriptPath = path.join(projectRoot, 'scripts', 'run_ai_analysis.py')

    const proc = spawn('python', [scriptPath, ticker, '--verbose'], {
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 180_000, // 3 minutes — AI analysis takes longer
    })

    let stderr = ''

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (stderr) {
        console.log(`[ai-analysis/${ticker}] ${stderr}`)
      }

      if (code === 0) {
        resolve()
      } else {
        reject(new Error(
          `AI analysis process exited with code ${code}: ${stderr.slice(-300)}`
        ))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start AI analysis process: ${err.message}`))
    })
  })
}

async function fetchAIAnalysis(ticker: string) {
  const result = await sql`
    SELECT * FROM mosee_ai_analyses
    WHERE ticker = ${ticker}
    ORDER BY analysis_date DESC
    LIMIT 1
  `
  return result.rows.length > 0 ? result.rows[0] : null
}

/**
 * POST /api/ai-analysis/[ticker]
 * Trigger on-demand AI analysis of annual reports for a stock.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { ticker } = await context.params
  const sanitized = ticker.toUpperCase().replace(/[^A-Z0-9.\-]/g, '')

  if (!sanitized || sanitized.length > 10) {
    return NextResponse.json(
      { status: 'error', error: 'Invalid ticker symbol' },
      { status: 400 }
    )
  }

  // Check for GEMINI_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { status: 'error', error: 'GEMINI_API_KEY not configured on server' },
      { status: 503 }
    )
  }

  if (activeAnalyses.has(sanitized)) {
    return NextResponse.json(
      { status: 'error', error: 'AI analysis already in progress for this ticker' },
      { status: 409 }
    )
  }

  activeAnalyses.add(sanitized)

  try {
    await runAIAnalysis(sanitized)

    const analysis = await fetchAIAnalysis(sanitized)

    if (analysis) {
      return NextResponse.json({
        status: 'completed',
        analysis,
      })
    }

    return NextResponse.json({
      status: 'completed',
      analysis: null,
      message: 'Analysis completed but no results found in database',
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'AI analysis failed' },
      { status: 500 }
    )
  } finally {
    activeAnalyses.delete(sanitized)
  }
}

/**
 * GET /api/ai-analysis/[ticker]
 * Fetch existing AI analysis for a stock (if available).
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { ticker } = await context.params
  const sanitized = ticker.toUpperCase().replace(/[^A-Z0-9.\-]/g, '')

  if (!sanitized || sanitized.length > 10) {
    return NextResponse.json(
      { status: 'error', error: 'Invalid ticker symbol' },
      { status: 400 }
    )
  }

  try {
    const analysis = await fetchAIAnalysis(sanitized)

    if (analysis) {
      return NextResponse.json({
        status: 'found',
        analysis,
      })
    }

    return NextResponse.json({
      status: 'not_found',
      analysis: null,
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Failed to fetch AI analysis' },
      { status: 500 }
    )
  }
}
