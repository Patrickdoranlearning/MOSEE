/**
 * Middleware — Protect Wealth Tree routes.
 * Unauthenticated users are redirected to /login.
 */

import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected =
    pathname.startsWith('/wealth-tree') ||
    pathname.startsWith('/api/wealth-tree')

  if (isProtected && !req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/wealth-tree/:path*', '/api/wealth-tree/:path*'],
}
