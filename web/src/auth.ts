/**
 * Auth.js (NextAuth v5) Configuration
 *
 * Supports email/password credentials and Google OAuth.
 * Uses JWT sessions stored in HTTP-only cookies.
 */

import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { getUserByEmail, findOrCreateOAuthUser } from '@/lib/auth-db'

// Build providers list — only include Google if credentials are configured
const providers: Provider[] = [
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      try {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await getUserByEmail(email)
        if (!user || !user.password_hash) return null

        const isValid = await bcrypt.compare(password, user.password_hash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      } catch (err) {
        console.error('[auth] authorize error:', err)
        return null
      }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle OAuth sign-in: create/link user in our DB
      if (account?.provider === 'google' && user.email) {
        await findOrCreateOAuthUser(
          user.email,
          user.name || null,
          user.image || null,
          account.provider,
          account.providerAccountId
        )
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        // On initial sign-in, look up the DB user to get the UUID
        const dbUser = await getUserByEmail(user.email!)
        if (dbUser) {
          token.userId = dbUser.id
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
      }
      return session
    },
  },
})
