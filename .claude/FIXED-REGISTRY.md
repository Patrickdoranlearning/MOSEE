# MOSEE Fixed Registry

Confirmed fixes and protected patterns. Before modifying any file listed here, agents MUST verify the protected fix survives their edit. A regression against this registry = automatic REJECTED from validator.

**How entries get here**: Jimmy's Fix Registration Gate — after a fix is confirmed working, Patrick approves which fixes to protect (never auto-registered).

## Entry Format

```markdown
### [Short description]
- **File**: `path/to/file.py`
- **Lines**: ~42-55
- **What was fixed**: [bug description]
- **What the fix looks like**: [key code pattern to preserve]
- **Date**: YYYY-MM-DD
- **Protected until**: permanent
```

Visual snapshots (from `jimmy snapshot`) use the same format plus a **Screenshot** path under `reports/snapshots/`.

---

## Protected Fixes

### Root-anchored lib/ gitignore pattern
- **File**: `.gitignore`
- **Lines**: ~13-15
- **What was fixed**: Bare `lib/` (Python packaging template) matched `web/src/lib/` too, silently untracking source files (`deep-dive.ts`, `auth-db.ts`, `wealth-tree-db.ts`) — the GitHub copy of the repo couldn't build
- **What the fix looks like**: `/lib/` and `/lib64/` root-anchored with a comment explaining why. NEVER revert to bare `lib/`. New files under `web/src/lib/` must show up in `git status`
- **Date**: 2026-06-11
- **Protected until**: permanent
