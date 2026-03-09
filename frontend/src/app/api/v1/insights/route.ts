import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'

  try {
    const response = await fetch(
      `${backendUrl}/api/v1/insights?session_id=${encodeURIComponent(sessionId)}`,
      { next: { revalidate: 0 } }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: response.status })
    }

    const data = await response.json()

    // Backend wraps in { success, data } — unwrap to match frontend expectations
    if (data.success && data.data) {
      return NextResponse.json(data.data)
    }

    return NextResponse.json(
      { error: data.error ?? 'No insights available' },
      { status: 404 }
    )
  } catch (err) {
    console.error('Insights proxy error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
