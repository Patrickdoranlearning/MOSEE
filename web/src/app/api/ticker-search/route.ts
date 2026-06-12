import { NextRequest, NextResponse } from 'next/server'

interface TickerSearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

interface YahooQuote {
  symbol?: string
  shortname?: string
  longname?: string
  exchDisp?: string
  typeDisp?: string
  quoteType?: string
}

// Resolve a company name (or partial ticker) to candidate tickers via Yahoo's
// public search endpoint. /api/search only knows already-analyzed tickers from
// Postgres, so this fills the name -> ticker gap (e.g. "everplay" -> EVPL.L).
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 })
  }

  const url =
    'https://query2.finance.yahoo.com/v1/finance/search?q=' +
    encodeURIComponent(q) +
    // enableFuzzyQuery: typo tolerance — "evenplay" still finds EVPL.L
    // (verified: without it Yahoo returns 0 results for misspellings).
    '&quotesCount=8&newsCount=0&enableFuzzyQuery=true'

  try {
    const res = await fetch(url, {
      // Yahoo 429s default fetch user agents; mimic a browser.
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ results: [], error: true })
    }

    const data = await res.json()
    const quotes: YahooQuote[] = Array.isArray(data?.quotes) ? data.quotes : []

    const results: TickerSearchResult[] = quotes
      .filter((qt) => qt.quoteType === 'EQUITY' && qt.symbol)
      .map((qt) => ({
        symbol: qt.symbol as string,
        name: qt.shortname || qt.longname || (qt.symbol as string),
        exchange: qt.exchDisp || '',
        type: qt.typeDisp || '',
      }))

    return NextResponse.json({ results })
  } catch {
    // Network error / timeout / bad JSON — never throw to the client.
    return NextResponse.json({ results: [], error: true })
  }
}
