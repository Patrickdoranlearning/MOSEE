#!/usr/bin/env python3
"""
Build MOSEE Investment Knowledge Base

Reads all text files from knowledge_base/ subdirectories,
chunks them, generates embeddings, and stores in ChromaDB.

Run this once after adding or updating source documents:
    python scripts/build_knowledge_base.py

The knowledge base is used by the AI annual report analyzer
to retrieve relevant investment wisdom via RAG.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from MOSEE.ai_analysis.knowledge_base import (
    build_knowledge_base,
    get_kb_stats,
    DEFAULT_SOURCE_DIR,
)


def main():
    print("=" * 60)
    print("  MOSEE Investment Knowledge Base Builder")
    print("=" * 60)
    print()

    # Check if source directory exists and has content
    if not DEFAULT_SOURCE_DIR.exists():
        print(f"Error: Knowledge base directory not found at:")
        print(f"  {DEFAULT_SOURCE_DIR}")
        print()
        print("Create the directory and add source documents:")
        print("  knowledge_base/")
        print("  ├── berkshire_letters/   (Buffett annual letters as .txt)")
        print("  ├── book_principles/    (Key principles from investment books)")
        print("  ├── marks_memos/        (Howard Marks memos)")
        print("  └── munger_speeches/    (Munger speeches and talks)")
        sys.exit(1)

    # Count source files
    txt_files = list(DEFAULT_SOURCE_DIR.glob("**/*.txt"))
    md_files = list(DEFAULT_SOURCE_DIR.glob("**/*.md"))
    source_files = [f for f in txt_files + md_files if not f.parent.name.startswith('.')]

    if not source_files:
        print(f"No source documents found in {DEFAULT_SOURCE_DIR}")
        print("Add .txt or .md files to the subdirectories.")
        sys.exit(1)

    print(f"Source directory: {DEFAULT_SOURCE_DIR}")
    print(f"Source files found: {len(source_files)}")
    print()

    # List sources by subdirectory
    subdirs = set(f.parent.name for f in source_files if f.parent != DEFAULT_SOURCE_DIR)
    for subdir in sorted(subdirs):
        count = len([f for f in source_files if f.parent.name == subdir])
        print(f"  {subdir}/: {count} files")
    print()

    # Build the knowledge base
    num_chunks = build_knowledge_base()

    if num_chunks == 0:
        print("\nNo chunks created. Check that source files have content.")
        sys.exit(1)

    # Show stats
    print()
    stats = get_kb_stats()
    print(f"Knowledge base status: {stats['status']}")
    print(f"Total chunks indexed: {stats.get('chunks', 0)}")
    print(f"Stored at: {stats.get('path', 'unknown')}")
    print()
    print("Done! The knowledge base is ready for AI analysis.")


if __name__ == "__main__":
    main()
