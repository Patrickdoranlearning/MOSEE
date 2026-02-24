# MOSEE Investment Knowledge Base

This directory contains the source documents that feed MOSEE's AI analysis engine via RAG (Retrieval-Augmented Generation). The AI reads these alongside a company's 10-K filing to analyze annual reports through the lens of great investors.

## Directory Structure

```
knowledge_base/
├── berkshire_letters/     # Berkshire Hathaway annual letters (1965-present)
│   ├── 2024.txt
│   ├── 2023.txt
│   └── ...
├── book_principles/       # Key principles from investment books
│   ├── intelligent_investor.txt
│   ├── security_analysis.txt
│   ├── common_stocks_uncommon_profits.txt
│   ├── one_up_on_wall_street.txt
│   └── margin_of_safety.txt
├── marks_memos/           # Howard Marks Oaktree memos
│   ├── sea_change_2023.txt
│   └── ...
├── munger_speeches/       # Charlie Munger speeches and talks
│   ├── psychology_of_misjudgment.txt
│   └── ...
└── .chromadb/             # Auto-generated vector database (do not edit)
```

## How to Add Documents

1. Place `.txt` or `.md` files in the appropriate subdirectory
2. Run `python scripts/build_knowledge_base.py` to rebuild the vector store
3. The AI analyzer will automatically use the updated knowledge base

## Document Format

- Plain text (`.txt`) or Markdown (`.md`)
- No special formatting required — the system automatically chunks and indexes
- Each chunk is auto-tagged with topics (moats, management, risk, valuation, etc.)
- Longer documents produce more chunks and better retrieval

## Sources

### Berkshire Letters
Available free at berkshirehathaway.com. Copy the text of each annual letter into a separate `.txt` file named by year.

### Book Principles
Write or paste the key principles, frameworks, and criteria from each book. Focus on actionable concepts — what to look for in annual reports, how to evaluate management, what constitutes a good business, etc.

### Howard Marks Memos
Available at oaktreecapital.com. Copy memo text into `.txt` files.

### Munger Speeches
Available from various sources. Key speeches include "The Psychology of Human Misjudgment" and USC commencement addresses.

## Rebuilding

After adding or modifying documents:

```bash
python scripts/build_knowledge_base.py
```

This reads all files, chunks them (~500 tokens each), generates embeddings locally using all-MiniLM-L6-v2, and stores them in ChromaDB at `.chromadb/`.
