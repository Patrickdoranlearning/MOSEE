/**
 * Auth Database Queries
 *
 * User CRUD operations for the Wealth Tree authentication system.
 */

import { sql } from '@vercel/postgres'

export interface DBUser {
  id: string
  email: string
  name: string | null
  password_hash: string | null
  email_verified: string | null
  image: string | null
  created_at: string
  updated_at: string
}

export async function getUserByEmail(email: string): Promise<DBUser | null> {
  const { rows } = await sql`
    SELECT * FROM mosee_users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as DBUser) : null
}

export async function getUserById(id: string): Promise<DBUser | null> {
  const { rows } = await sql`
    SELECT * FROM mosee_users
    WHERE id = ${id}
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as DBUser) : null
}

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string
): Promise<DBUser> {
  const { rows } = await sql`
    INSERT INTO mosee_users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name || null})
    RETURNING *
  `
  return rows[0] as unknown as DBUser
}

export async function findOrCreateOAuthUser(
  email: string,
  name: string | null,
  image: string | null,
  provider: string,
  providerAccountId: string
): Promise<DBUser> {
  // Check if user exists
  let user = await getUserByEmail(email)

  if (!user) {
    // Create user
    const { rows } = await sql`
      INSERT INTO mosee_users (email, name, image, email_verified)
      VALUES (${email}, ${name}, ${image}, NOW())
      RETURNING *
    `
    user = rows[0] as unknown as DBUser
  }

  // Upsert account link
  await sql`
    INSERT INTO mosee_accounts (user_id, type, provider, provider_account_id)
    VALUES (${user.id}, 'oauth', ${provider}, ${providerAccountId})
    ON CONFLICT (provider, provider_account_id) DO NOTHING
  `

  return user
}
