import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEVEN_CURES } from '@/types/wealth-tree'
import { BOOKS, getBook, getTeachingsForBook } from '@/lib/wealth-education'

export function generateStaticParams() {
  return BOOKS.map((b) => ({ book: b.id }))
}

export default async function BookLibraryPage({
  params,
}: {
  params: Promise<{ book: string }>
}) {
  const { book: bookSlug } = await params
  const book = getBook(bookSlug)

  if (!book) {
    notFound()
  }

  const teachings = getTeachingsForBook(book.id)

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Link href="/wealth-tree/learn" className="text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to Learn
      </Link>

      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-amber-900">{book.title}</h1>
        <p className="text-amber-700 mt-1">
          {book.author} &middot; {book.year}
        </p>
        <p className="text-gray-700 mt-4 italic">{book.tagline}</p>
      </div>

      {/* Core ideas */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Core Ideas</h2>
        <ul className="space-y-2">
          {book.coreIdeas.map((idea, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-700">{idea}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* MOSEE connection */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">How It Connects to MOSEE</h2>
        <p className="text-gray-700 leading-relaxed">{book.moseeConnection}</p>
      </section>

      {/* Teachings */}
      {teachings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Teachings</h2>
          <div className="space-y-4">
            {teachings.map((teaching) => (
              <div
                key={teaching.id}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <blockquote className="text-gray-800 italic">
                  {teaching.attribution === 'quote'
                    ? `“${teaching.text}”`
                    : teaching.text}
                </blockquote>
                <p className="text-sm text-gray-700 mt-3">
                  <span className="font-semibold">Apply it:</span> {teaching.application}
                </p>
                {teaching.cures.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {teaching.cures.map((cureNumber) => {
                      const cure = SEVEN_CURES.find((c) => c.number === cureNumber)
                      return (
                        <Link
                          key={cureNumber}
                          href={`/wealth-tree/learn/${cureNumber}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Cure {cureNumber}
                          {cure ? `: ${cure.title}` : ''}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
