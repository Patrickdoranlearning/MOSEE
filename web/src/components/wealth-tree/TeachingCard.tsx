'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getBook,
  getTeachingsForTopic,
  type Teaching,
  type WealthTopic,
} from '@/lib/wealth-education'

/**
 * Day-of-year (1-366) for the current local date. Used to pick a deterministic
 * initial teaching so server-render and client-hydration agree — NEVER
 * Math.random() during render, which would mismatch on hydration.
 */
function dayOfYear(): number {
  const now = new Date()
  const start = Date.UTC(now.getUTCFullYear(), 0, 0)
  const diff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start
  return Math.floor(diff / 86_400_000)
}

interface TeachingCardProps {
  topics: WealthTopic[]
}

/**
 * Surfaces a contextual book/guru teaching inside a wealth tool. Pools the
 * teachings for the given topics (deduped by id), shows one deterministically
 * chosen by day-of-year, and lets the reader cycle the pool post-hydration.
 */
export function TeachingCard({ topics }: TeachingCardProps) {
  // Pool teachings across all topics, deduped by id. Stable for the prop set.
  const pool = useMemo<Teaching[]>(() => {
    const seen = new Set<string>()
    const out: Teaching[] = []
    for (const topic of topics) {
      for (const t of getTeachingsForTopic(topic)) {
        if (!seen.has(t.id)) {
          seen.add(t.id)
          out.push(t)
        }
      }
    }
    return out
  }, [topics])

  // Deterministic initial index (hydration-safe); cycling is post-hydration state.
  const initialIndex = useMemo(
    () => (pool.length > 0 ? dayOfYear() % pool.length : 0),
    [pool.length],
  )
  const [step, setStep] = useState(0)

  if (pool.length === 0) return null

  const teaching = pool[(initialIndex + step) % pool.length]
  const book = getBook(teaching.bookId)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
          From the Gurus
        </p>
        {pool.length > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Another teaching &rarr;
          </button>
        )}
      </div>

      <blockquote className="text-amber-800 italic">
        {teaching.attribution === 'quote'
          ? `“${teaching.text}”`
          : teaching.text}
      </blockquote>

      <p className="text-amber-600 text-sm mt-3">
        &mdash; {book?.guru ?? teaching.bookId}
        {book && (
          <>
            , <span className="italic">{book.title}</span>
          </>
        )}
      </p>

      <p className="text-sm text-amber-900 mt-3">
        <span className="font-semibold">Apply it:</span> {teaching.application}
      </p>

      {book && (
        <Link
          href={`/wealth-tree/learn/library/${book.id}`}
          className="inline-block mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
        >
          More from {book.guru} &rarr;
        </Link>
      )}
    </div>
  )
}

export default TeachingCard
