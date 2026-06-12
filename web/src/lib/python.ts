import path from 'path'
import fs from 'fs'

// Resolve the Python interpreter that has MOSEE's dependencies installed.
// Bare 'python' breaks whenever the dev shell's active environment lacks
// yfinance et al. Priority: MOSEE_PYTHON env var -> repo venv311 -> 'python'.
export function moseePython(projectRoot: string): string {
  if (process.env.MOSEE_PYTHON) return process.env.MOSEE_PYTHON
  const venv = path.join(projectRoot, 'venv311', 'bin', 'python')
  if (fs.existsSync(venv)) return venv
  return 'python'
}
