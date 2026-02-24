import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

interface RouteContext {
  params: Promise<{ ticker: string }>
}

function fetchPreview(ticker: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd(), '..')
    const scriptPath = path.join(projectRoot, 'scripts', 'fetch_preview.py')

    const proc = spawn('python', [scriptPath, ticker], {
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 20_000,
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
        console.log(`[preview/${ticker}] ${stderr}`)
      }

      const lines = stdout.trim().split('\n')
      const lastLine = lines[lines.length - 1]

      try {
        resolve(JSON.parse(lastLine))
      } catch {
        reject(new Error(
          code !== 0
            ? `Preview failed with code ${code}`
            : 'Failed to parse preview output'
        ))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start preview process: ${err.message}`))
    })
  })
}

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
    const result = await fetchPreview(sanitized)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
