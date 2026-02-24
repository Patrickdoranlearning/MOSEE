'use client'

import { useEffect, useState } from 'react'

export function SearchBar() {
  const [isMac, setIsMac] = useState<boolean | null>(null)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  const triggerOpen = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: !isMac,
        bubbles: true,
      })
    )
  }

  return (
    <button
      onClick={triggerOpen}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span className="hidden sm:inline">Search</span>
      {isMac !== null && (
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 bg-white border border-gray-200 rounded">
          {isMac ? '⌘' : 'Ctrl'}K
        </kbd>
      )}
    </button>
  )
}
