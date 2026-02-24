import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const KB_DIR = path.resolve(process.cwd(), '..', 'knowledge_base')

// Allowed subdirectories
const CATEGORIES = ['berkshire_letters', 'book_principles', 'marks_memos', 'munger_speeches'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_LABELS: Record<Category, string> = {
  berkshire_letters: 'Berkshire Hathaway Letters',
  book_principles: 'Book Principles',
  marks_memos: 'Howard Marks Memos',
  munger_speeches: 'Munger Speeches',
}

interface KBFile {
  category: string
  categoryLabel: string
  filename: string
  path: string
  sizeBytes: number
  modifiedAt: string
}

function listKBFiles(): KBFile[] {
  const files: KBFile[] = []

  for (const category of CATEGORIES) {
    const dirPath = path.join(KB_DIR, category)
    if (!fs.existsSync(dirPath)) continue

    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      if (!entry.endsWith('.txt') && !entry.endsWith('.md')) continue
      const filePath = path.join(dirPath, entry)
      const stat = fs.statSync(filePath)
      files.push({
        category,
        categoryLabel: CATEGORY_LABELS[category],
        filename: entry,
        path: `${category}/${entry}`,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      })
    }
  }

  return files.sort((a, b) => a.category.localeCompare(b.category) || a.filename.localeCompare(b.filename))
}

/**
 * GET /api/knowledge-base
 * List all knowledge base files, or read a specific file.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('file')

  if (filePath) {
    // Read a specific file
    const safePath = filePath.replace(/\.\./g, '') // prevent directory traversal
    const fullPath = path.join(KB_DIR, safePath)

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ status: 'error', error: 'File not found' }, { status: 404 })
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    return NextResponse.json({ status: 'ok', content, path: safePath })
  }

  // List all files
  const files = listKBFiles()

  // Count by category
  const categoryCounts: Record<string, number> = {}
  for (const f of files) {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1
  }

  return NextResponse.json({
    status: 'ok',
    files,
    categories: CATEGORIES.map(c => ({
      id: c,
      label: CATEGORY_LABELS[c],
      count: categoryCounts[c] || 0,
    })),
    totalFiles: files.length,
    totalSizeBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
  })
}

/**
 * POST /api/knowledge-base
 * Add or update a knowledge base file, or trigger rebuild.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body

  if (action === 'rebuild') {
    return await rebuildKB()
  }

  if (action === 'save') {
    const { category, filename, content } = body
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ status: 'error', error: 'Invalid category' }, { status: 400 })
    }
    if (!filename || !content) {
      return NextResponse.json({ status: 'error', error: 'Filename and content required' }, { status: 400 })
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    const ext = safeName.endsWith('.txt') || safeName.endsWith('.md') ? '' : '.txt'
    const finalName = safeName + ext

    const dirPath = path.join(KB_DIR, category)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    fs.writeFileSync(path.join(dirPath, finalName), content, 'utf-8')

    return NextResponse.json({
      status: 'ok',
      message: `Saved ${category}/${finalName}`,
      path: `${category}/${finalName}`,
    })
  }

  return NextResponse.json({ status: 'error', error: 'Unknown action' }, { status: 400 })
}

/**
 * DELETE /api/knowledge-base
 * Delete a knowledge base file.
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('file')

  if (!filePath) {
    return NextResponse.json({ status: 'error', error: 'File path required' }, { status: 400 })
  }

  const safePath = filePath.replace(/\.\./g, '')
  const fullPath = path.join(KB_DIR, safePath)

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ status: 'error', error: 'File not found' }, { status: 404 })
  }

  fs.unlinkSync(fullPath)
  return NextResponse.json({ status: 'ok', message: `Deleted ${safePath}` })
}

async function rebuildKB(): Promise<NextResponse> {
  return new Promise((resolve) => {
    const projectRoot = path.resolve(process.cwd(), '..')
    const scriptPath = path.join(projectRoot, 'scripts', 'build_knowledge_base.py')

    const proc = spawn('python', [scriptPath], {
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 600_000,  // 10 min — first run downloads embedding model
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(NextResponse.json({
          status: 'ok',
          message: 'Knowledge base rebuilt successfully',
          output: stdout,
        }))
      } else {
        resolve(NextResponse.json({
          status: 'error',
          error: `Build failed with code ${code}`,
          output: stdout + '\n' + stderr,
        }, { status: 500 }))
      }
    })

    proc.on('error', (err) => {
      resolve(NextResponse.json({
        status: 'error',
        error: `Failed to start build: ${err.message}`,
      }, { status: 500 }))
    })
  })
}
