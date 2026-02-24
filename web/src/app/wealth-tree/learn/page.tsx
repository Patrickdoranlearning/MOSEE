import Link from 'next/link'
import { SEVEN_CURES, TIER_COLORS } from '@/types/wealth-tree'

export default function LearnPage() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">The 7 Cures for a Lean Purse</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          From <span className="italic">The Richest Man in Babylon</span> by George S. Clason.
          These timeless principles, taught by Arkad — the richest man in ancient Babylon — form
          the foundation of building lasting wealth.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <blockquote className="text-amber-800 italic">
          &ldquo;Wealth, like a tree, grows from a tiny seed. The first copper you save is the seed
          from which your tree of wealth shall grow. The sooner you plant that seed, the sooner
          shall the tree grow. And the more faithfully you nourish and water that tree with
          consistent savings, the sooner may you bask in contentment beneath its shade.&rdquo;
        </blockquote>
        <p className="text-amber-600 text-sm mt-3">&mdash; Arkad, The Richest Man in Babylon</p>
      </div>

      <div className="space-y-4">
        {SEVEN_CURES.map((cure) => {
          const colors = TIER_COLORS[cure.tier]
          return (
            <Link
              key={cure.number}
              href={`/wealth-tree/learn/${cure.number}`}
              className={`block ${colors.bg} border ${colors.border} rounded-xl p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: colors.accent }}
                >
                  {cure.number}
                </div>
                <div className="flex-1">
                  <h2 className={`text-lg font-semibold ${colors.text}`}>{cure.title}</h2>
                  <p className="text-gray-600 text-sm mt-1">{cure.principle}</p>
                  <p className="text-gray-500 text-sm mt-2">{cure.description}</p>
                  <span className={`inline-block mt-3 text-sm font-medium ${colors.text}`}>
                    Learn more &rarr;
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
