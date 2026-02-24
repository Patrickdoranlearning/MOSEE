'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface KBFile {
  category: string
  categoryLabel: string
  filename: string
  path: string
  sizeBytes: number
  modifiedAt: string
}

interface Category {
  id: string
  label: string
  count: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KBFile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null)

  // Add/Edit modal state
  const [showEditor, setShowEditor] = useState(false)
  const [editCategory, setEditCategory] = useState('book_principles')
  const [editFilename, setEditFilename] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // View modal state
  const [viewFile, setViewFile] = useState<string | null>(null)
  const [viewContent, setViewContent] = useState('')
  const [viewLoading, setViewLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-base')
      const data = await res.json()
      if (data.status === 'ok') {
        setFiles(data.files)
        setCategories(data.categories)
        setTotalSize(data.totalSizeBytes)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function handleRebuild() {
    setRebuilding(true)
    setRebuildMessage(null)
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild' }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setRebuildMessage(`Knowledge base rebuilt successfully! ${data.output?.match(/Total chunks indexed: \d+/)?.[0] || ''}`)
      } else {
        setRebuildMessage(`Error: ${data.error}${data.output ? '\n' + data.output.slice(-500) : ''}`)
      }
    } catch (err) {
      setRebuildMessage(`Error: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setRebuilding(false)
    }
  }

  async function handleSave() {
    if (!editFilename.trim() || !editContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          category: editCategory,
          filename: editFilename,
          content: editContent,
        }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setShowEditor(false)
        setEditFilename('')
        setEditContent('')
        fetchFiles()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(filePath: string) {
    if (!confirm(`Delete ${filePath}?`)) return
    try {
      await fetch(`/api/knowledge-base?file=${encodeURIComponent(filePath)}`, { method: 'DELETE' })
      fetchFiles()
    } catch {
      // ignore
    }
  }

  async function handleView(filePath: string) {
    setViewFile(filePath)
    setViewLoading(true)
    try {
      const res = await fetch(`/api/knowledge-base?file=${encodeURIComponent(filePath)}`)
      const data = await res.json()
      setViewContent(data.content || '')
    } catch {
      setViewContent('Error loading file')
    } finally {
      setViewLoading(false)
    }
  }

  async function handleEdit(filePath: string) {
    try {
      const res = await fetch(`/api/knowledge-base?file=${encodeURIComponent(filePath)}`)
      const data = await res.json()
      const parts = filePath.split('/')
      setEditCategory(parts[0])
      setEditFilename(parts.slice(1).join('/').replace(/\.txt$/, '').replace(/\.md$/, ''))
      setEditContent(data.content || '')
      setShowEditor(true)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4">
        <Link href="/" className="text-blue-600 hover:text-blue-700">
          &larr; Home
        </Link>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
            <p className="text-sm text-gray-500 mt-1">
              Investment wisdom that feeds MOSEE&apos;s AI annual report analysis via RAG
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditFilename('')
                setEditContent('')
                setEditCategory('book_principles')
                setShowEditor(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + Add Document
            </button>
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                rebuilding
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {rebuilding ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Rebuilding...
                </>
              ) : (
                'Rebuild Vector Store'
              )}
            </button>
          </div>
        </div>

        {rebuildMessage && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            rebuildMessage.startsWith('Error')
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-green-50 text-green-700 border border-green-100'
          }`}>
            {rebuildMessage}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-lg border border-gray-100 p-4">
            <div className="text-2xl font-bold text-gray-900">{cat.count}</div>
            <div className="text-sm text-gray-500">{cat.label}</div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6 text-sm text-blue-700">
        <strong>{files.length} documents</strong> ({formatBytes(totalSize)}) across {categories.length} categories.
        Add Berkshire letters, book principles, Marks memos, or Munger speeches — then hit <strong>Rebuild Vector Store</strong> to update the AI&apos;s knowledge.
      </div>

      {/* File List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Document</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Category</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Size</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {files.map(file => (
              <tr key={file.path} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <button
                    onClick={() => handleView(file.path)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {file.filename}
                  </button>
                </td>
                <td className="px-6 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {file.categoryLabel}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">{formatBytes(file.sizeBytes)}</td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleEdit(file.path)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(file.path)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  No documents yet. Click &ldquo;Add Document&rdquo; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{viewFile}</h3>
              <button onClick={() => setViewFile(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {viewLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">{viewContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {editFilename ? `Edit: ${editFilename}` : 'Add New Document'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="berkshire_letters">Berkshire Hathaway Letters</option>
                    <option value="book_principles">Book Principles</option>
                    <option value="marks_memos">Howard Marks Memos</option>
                    <option value="munger_speeches">Munger Speeches</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filename</label>
                  <input
                    type="text"
                    value={editFilename}
                    onChange={e => setEditFilename(e.target.value)}
                    placeholder="e.g., berkshire_2024 or intelligent_investor"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">.txt extension added automatically</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={20}
                  placeholder="Paste or type the document content here...&#10;&#10;For Berkshire letters: paste the full text of the annual letter.&#10;For book principles: write key frameworks and criteria.&#10;For memos/speeches: paste the full text."
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm font-mono leading-relaxed resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {editContent.length.toLocaleString()} characters (~{Math.round(editContent.length / 4).toLocaleString()} tokens)
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editFilename.trim() || !editContent.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  saving || !editFilename.trim() || !editContent.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {saving ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
