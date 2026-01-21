'use client'

import { useState } from 'react'
import { Verdict } from '@/types/mosee'

interface PicksFilterProps {
  verdicts: Verdict[]
  industries: string[]
  countries: string[]
}

export function PicksFilter({ verdicts, industries, countries }: PicksFilterProps) {
  const [showFilters, setShowFilters] = useState(false)
  
  return (
    <div className="mb-6">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {showFilters ? 'Hide Filters' : 'Show Filters'}
      </button>
      
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Verdict Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verdict
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">All Verdicts</option>
                {verdicts.map(verdict => (
                  <option key={verdict} value={verdict}>{verdict}</option>
                ))}
              </select>
            </div>
            
            {/* Industry Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">All Industries</option>
                {industries.sort().map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
            
            {/* Country Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">All Countries</option>
                {countries.sort().map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Quick Filters */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700 mr-3">Quick Filters:</span>
            <div className="inline-flex gap-2 flex-wrap mt-2">
              <button className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200">
                Strong Buy / Buy
              </button>
              <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200">
                Has MoS
              </button>
              <button className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200">
                Quality A+/A
              </button>
              <button className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm hover:bg-yellow-200">
                Large Cap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
