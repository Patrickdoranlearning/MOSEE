import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSavingsEntries, createSavingsEntry, deleteSavingsEntry } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entries = await getSavingsEntries(session.user.id)
    return NextResponse.json({ entries })
  } catch (e) {
    console.error('GET /api/wealth-tree/savings error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch savings entries' },
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

    if (!body.entry_date || body.amount == null) {
      return NextResponse.json(
        { error: 'entry_date and amount are required' },
        { status: 400 }
      )
    }

    const entry = await createSavingsEntry(session.user.id, body)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/savings error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create savings entry' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const deleted = await deleteSavingsEntry(session.user.id, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/wealth-tree/savings error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete savings entry' },
      { status: 500 }
    )
  }
}
