import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getExpenseEntries, createExpenseEntry, deleteExpenseEntry } from '@/lib/wealth-tree-db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') ?? undefined
    const endDate = searchParams.get('endDate') ?? undefined

    const entries = await getExpenseEntries(session.user.id, startDate, endDate)
    return NextResponse.json({ entries })
  } catch (e) {
    console.error('GET /api/wealth-tree/expenses error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch expense entries' },
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

    if (!body.entry_date || !body.category || body.amount == null) {
      return NextResponse.json(
        { error: 'entry_date, category, and amount are required' },
        { status: 400 }
      )
    }

    const entry = await createExpenseEntry(session.user.id, {
      entry_date: body.entry_date,
      category: body.category,
      amount: body.amount,
      is_recurring: body.is_recurring,
      recurrence_frequency: body.recurrence_frequency || null,
      notes: body.notes,
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/expenses error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create expense entry' },
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

    const deleted = await deleteExpenseEntry(session.user.id, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/wealth-tree/expenses error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete expense entry' },
      { status: 500 }
    )
  }
}
