import { NextResponse } from 'next/server'
import { getStockSummaries } from '@/lib/db'

export async function GET() {
  try {
    const summaries = await getStockSummaries()
    return NextResponse.json(summaries)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch stock data' },
      { status: 500 }
    )
  }
}
