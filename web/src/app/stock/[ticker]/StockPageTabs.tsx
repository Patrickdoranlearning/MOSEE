'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'

interface Tab {
  id: string
  label: string
  content?: ReactNode
  href?: string
}

interface StockPageTabsProps {
  ticker: string
  tabs: Tab[]
  defaultTab?: string
}

export function StockPageTabs({ ticker, tabs, defaultTab }: StockPageTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  return (
    <div>
      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent whitespace-nowrap transition-colors"
                >
                  {tab.label}
                </Link>
              )
            }

            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {tabs.map((tab) => {
        if (tab.href || !tab.content) return null
        return (
          <div
            key={tab.id}
            className={activeTab === tab.id ? '' : 'hidden'}
          >
            {tab.content}
          </div>
        )
      })}
    </div>
  )
}
