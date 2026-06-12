import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSkills, createSkill, deleteSkill } from '@/lib/wealth-tree-db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const skills = await getSkills(session.user.id)
    return NextResponse.json(skills)
  } catch (e) {
    console.error('GET /api/wealth-tree/skills error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch skills' },
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

    if (!body.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const skill = await createSkill(session.user.id, body)
    return NextResponse.json(skill, { status: 201 })
  } catch (e) {
    console.error('POST /api/wealth-tree/skills error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create skill' },
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

    const deleted = await deleteSkill(session.user.id, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/wealth-tree/skills error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete skill' },
      { status: 500 }
    )
  }
}
