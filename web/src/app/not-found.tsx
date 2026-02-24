import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Stock Not Found</h2>
        <p className="text-gray-600 mb-6">
          The stock you&apos;re looking for hasn&apos;t been analyzed yet, or the ticker symbol may be incorrect.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/picks"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            View all picks
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
