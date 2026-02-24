"""
MOSEE Investment Knowledge Base

RAG (Retrieval-Augmented Generation) knowledge base built from
investment wisdom: Berkshire letters, Howard Marks memos,
Munger speeches, and principles from classic investment books.

Uses ChromaDB (local) for vector storage and sentence-transformers
for embeddings. No external services required.

Knowledge sources are stored as text files in knowledge_base/ directory,
organized by author/source. Each chunk is tagged with topics for
targeted retrieval.
"""

import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# Default paths
DEFAULT_SOURCE_DIR = Path(__file__).parent.parent.parent / "knowledge_base"
DEFAULT_CHROMA_DIR = DEFAULT_SOURCE_DIR / ".chromadb"
COLLECTION_NAME = "mosee_investment_wisdom"

# Chunking parameters
CHUNK_SIZE = 500       # tokens (roughly 2000 chars)
CHUNK_OVERLAP = 50     # tokens overlap between chunks
CHARS_PER_TOKEN = 4    # rough estimate

# Topic keywords for auto-tagging chunks
TOPIC_KEYWORDS = {
    "moats": ["moat", "competitive advantage", "barrier to entry", "switching cost",
              "brand", "network effect", "pricing power", "durable", "franchise"],
    "management": ["management", "CEO", "leadership", "capital allocat", "incentive",
                   "compensation", "candor", "integrity", "insider", "owner-operator"],
    "capital_allocation": ["buyback", "repurchase", "dividend", "acquisition", "M&A",
                           "reinvest", "capital expenditure", "ROIC", "return on capital"],
    "risk": ["risk", "downside", "tail", "black swan", "leverage", "debt",
             "recession", "bankruptcy", "concentration", "cyclical"],
    "accounting": ["accounting", "revenue recognition", "off-balance", "goodwill",
                   "write-off", "impairment", "GAAP", "non-GAAP", "audit", "restatement"],
    "growth": ["growth", "compounding", "reinvestment", "TAM", "market share",
               "scalable", "organic growth", "secular trend", "runway"],
    "valuation": ["valuation", "intrinsic value", "margin of safety", "discount",
                  "P/E", "earnings yield", "book value", "DCF", "owner earnings",
                  "price to", "fair value", "overvalued", "undervalued"],
}


def _try_import_chromadb():
    """Import chromadb, returning None if not installed."""
    try:
        import chromadb
        return chromadb
    except ImportError:
        logger.warning("chromadb not installed. Run: pip install chromadb>=0.5.0")
        return None


def _try_import_sentence_transformers():
    """Import sentence_transformers for the embedding function."""
    try:
        from chromadb.utils import embedding_functions
        return embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
    except ImportError:
        logger.warning(
            "sentence-transformers not installed. "
            "Run: pip install sentence-transformers>=3.0.0"
        )
        return None


def _chunk_text(text: str, source: str) -> List[Dict[str, Any]]:
    """
    Split text into overlapping chunks with topic auto-tagging.

    Returns list of dicts with keys: text, source, topics, chunk_index
    """
    chunk_chars = CHUNK_SIZE * CHARS_PER_TOKEN
    overlap_chars = CHUNK_OVERLAP * CHARS_PER_TOKEN
    step = chunk_chars - overlap_chars

    chunks = []
    for i in range(0, len(text), step):
        chunk_text = text[i:i + chunk_chars].strip()
        if len(chunk_text) < 100:  # Skip tiny trailing chunks
            continue

        # Auto-detect topics based on keyword presence
        text_lower = chunk_text.lower()
        topics = [
            topic for topic, keywords in TOPIC_KEYWORDS.items()
            if any(kw in text_lower for kw in keywords)
        ]
        if not topics:
            topics = ["general"]

        chunks.append({
            "text": chunk_text,
            "source": source,
            "topics": topics,
            "chunk_index": len(chunks),
        })

    return chunks


def _read_source_files(source_dir: Path) -> List[Dict[str, Any]]:
    """
    Read all .txt and .md files from knowledge_base/ subdirectories.

    Expected structure:
        knowledge_base/
        ├── berkshire_letters/
        │   ├── 2023.txt
        │   ├── 2022.txt
        │   └── ...
        ├── book_principles/
        │   ├── intelligent_investor.txt
        │   ├── common_stocks_uncommon_profits.txt
        │   └── ...
        ├── marks_memos/
        │   ├── 2024_sea_change.txt
        │   └── ...
        └── munger_speeches/
            ├── psychology_of_misjudgment.txt
            └── ...
    """
    all_chunks = []

    if not source_dir.exists():
        logger.warning(f"Knowledge base directory not found: {source_dir}")
        return []

    for subdir in sorted(source_dir.iterdir()):
        if not subdir.is_dir() or subdir.name.startswith('.'):
            continue

        for filepath in sorted(subdir.glob("**/*.txt")) + sorted(subdir.glob("**/*.md")):
            try:
                text = filepath.read_text(encoding='utf-8')
                if len(text.strip()) < 200:
                    continue

                # Source name: "berkshire_letters/2023"
                source_name = f"{subdir.name}/{filepath.stem}"
                chunks = _chunk_text(text, source_name)
                all_chunks.extend(chunks)

                logger.info(f"  Processed {source_name}: {len(chunks)} chunks")

            except Exception as e:
                logger.warning(f"Error reading {filepath}: {e}")

    return all_chunks


def build_knowledge_base(
    source_dir: str = None,
    chroma_dir: str = None,
) -> int:
    """
    Build (or rebuild) the ChromaDB knowledge base from source documents.

    Args:
        source_dir: Path to knowledge_base/ directory
        chroma_dir: Path to store ChromaDB data

    Returns:
        Number of chunks indexed
    """
    chromadb = _try_import_chromadb()
    if chromadb is None:
        return 0

    embedding_fn = _try_import_sentence_transformers()
    if embedding_fn is None:
        return 0

    source_path = Path(source_dir) if source_dir else DEFAULT_SOURCE_DIR
    chroma_path = Path(chroma_dir) if chroma_dir else DEFAULT_CHROMA_DIR

    # Read and chunk all source documents
    print(f"Reading source documents from {source_path}...")
    chunks = _read_source_files(source_path)

    if not chunks:
        print("No source documents found. Add .txt or .md files to knowledge_base/ subdirectories.")
        return 0

    print(f"Created {len(chunks)} chunks from source documents")

    # Create/reset ChromaDB collection
    chroma_path.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(chroma_path))

    # Delete existing collection if it exists
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"description": "MOSEE investment wisdom knowledge base"},
    )

    # Add chunks in batches
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        collection.add(
            ids=[f"chunk_{i + j}" for j in range(len(batch))],
            documents=[c["text"] for c in batch],
            metadatas=[{
                "source": c["source"],
                "topics": ",".join(c["topics"]),
                "chunk_index": c["chunk_index"],
            } for c in batch],
        )
        print(f"  Indexed {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")

    print(f"\nKnowledge base built: {len(chunks)} chunks in {chroma_path}")
    return len(chunks)


def retrieve_wisdom(
    query: str,
    topics: Optional[List[str]] = None,
    top_k: int = 10,
    chroma_dir: str = None,
) -> List[str]:
    """
    Retrieve relevant investment wisdom for a given analysis context.

    Args:
        query: The analysis context (e.g., company description + key metrics)
        topics: Optional list of topics to filter by (e.g., ["moats", "management"])
        top_k: Number of chunks to retrieve
        chroma_dir: Path to ChromaDB data

    Returns:
        List of relevant text chunks from the knowledge base
    """
    chromadb = _try_import_chromadb()
    if chromadb is None:
        return []

    embedding_fn = _try_import_sentence_transformers()
    if embedding_fn is None:
        return []

    chroma_path = Path(chroma_dir) if chroma_dir else DEFAULT_CHROMA_DIR

    if not chroma_path.exists():
        logger.warning(f"Knowledge base not found at {chroma_path}. Run build_knowledge_base() first.")
        return []

    try:
        client = chromadb.PersistentClient(path=str(chroma_path))
        collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn,
        )
    except Exception as e:
        logger.warning(f"Could not open knowledge base: {e}")
        return []

    # Build query filter for topics if provided
    where_filter = None
    if topics:
        # ChromaDB $contains filter on the comma-separated topics string
        # We use $or to match any of the requested topics
        if len(topics) == 1:
            where_filter = {"topics": {"$contains": topics[0]}}
        else:
            where_filter = {
                "$or": [{"topics": {"$contains": t}} for t in topics]
            }

    try:
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter,
        )

        if results and results['documents']:
            return results['documents'][0]  # First query's results
        return []

    except Exception as e:
        logger.warning(f"Knowledge base query failed: {e}")
        return []


def get_kb_stats(chroma_dir: str = None) -> Dict[str, Any]:
    """Get statistics about the knowledge base."""
    chromadb = _try_import_chromadb()
    if chromadb is None:
        return {"status": "chromadb not installed"}

    chroma_path = Path(chroma_dir) if chroma_dir else DEFAULT_CHROMA_DIR

    if not chroma_path.exists():
        return {"status": "not built", "path": str(chroma_path)}

    try:
        client = chromadb.PersistentClient(path=str(chroma_path))
        collection = client.get_collection(name=COLLECTION_NAME)
        count = collection.count()
        return {
            "status": "ready",
            "chunks": count,
            "path": str(chroma_path),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
