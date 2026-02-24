import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSkills, createSkill } from '@/lib/wealth-tree-db'

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
