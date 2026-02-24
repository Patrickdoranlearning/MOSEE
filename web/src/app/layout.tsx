import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { SearchBar } from '@/components/SearchBar'
import { CommandPalette } from '@/components/CommandPalette'
import { AuthButton } from '@/components/AuthButton'
import { SessionWrapper } from '@/components/SessionWrapper'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MOSEE - Stock Investment Intelligence',
  description: 'Margin of Safety & Earnings to Equity Analyzer - Weekly stock picks powered by investment book wisdom',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <SessionWrapper>
          {/* Navigation */}
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <Link href="/" className="flex items-center gap-2">
                    <Image src="/mosee-logo.png" alt="MOSEE" width={36} height={36} />
                    <span className="font-bold text-xl text-gray-900">MOSEE</span>
                  </Link>
                </div>
                <div className="flex items-center space-x-4">
                  <SearchBar />
                  <Link
                    href="/"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Home
                  </Link>
                  <Link
                    href="/picks"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Weekly Picks
                  </Link>
                  <Link
                    href="/wealth-tree"
                    className="text-green-600 hover:text-green-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Wealth Tree
                  </Link>
                  <Link
                    href="/knowledge"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Knowledge Base
                  </Link>
                  <Link
                    href="/about"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    About
                  </Link>
                  <AuthButton />
                </div>
              </div>
            </div>
          </nav>

          {/* Command Palette (Cmd+K search) */}
          <CommandPalette />

          {/* Main Content */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center text-gray-500 text-sm">
                <p>MOSEE - Margin of Safety & Earnings to Equity Analyzer</p>
                <p className="mt-1">
                  Investment Intelligence from Graham, Buffett, Lynch, Fisher & Greenblatt
                </p>
                <p className="mt-4 text-xs text-gray-400">
                  Disclaimer: This tool is for educational purposes only. Always do your own research before making investment decisions.
                </p>
              </div>
            </div>
          </footer>
        </SessionWrapper>
      </body>
    </html>
  )
}
