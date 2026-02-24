import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

interface RouteContext {
  params: Promise<{ ticker: string }>
}

// Track active analyses to prevent concurrent runs for the same ticker
const activeAnalyses = new Set<string>()

function runAnalysis(ticker: string): Promise<{ status: string; ticker: string; [key: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd(), '..')
    const scriptPath = path.join(projectRoot, 'scripts', 'run_on_demand.py')

    const proc = spawn('python', [scriptPath, ticker], {
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 120_000,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (stderr) {
        console.log(`[analyze/${ticker}] ${stderr}`)
      }

      // Parse the last line of stdout as JSON (in case there's extra output)
      const lines = stdout.trim().split('\n')
      const lastLine = lines[lines.length - 1]

      try {
        const result = JSON.parse(lastLine)
        resolve(result)
      } catch {
        reject(new Error(
          code !== 0
            ? `Analysis process exited with code ${code}: ${stderr.slice(-200)}`
            : 'Failed to parse analysis output'
        ))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start analysis process: ${err.message}`))
    })
  })
}

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

  if (activeAnalyses.has(sanitized)) {
    return NextResponse.json(
      { status: 'error', error: 'Analysis already in progress for this ticker' },
      { status: 409 }
    )
  }

  activeAnalyses.add(sanitized)

  try {
    const result = await runAnalysis(sanitized)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  } finally {
    activeAnalyses.delete(sanitized)
  }
}
