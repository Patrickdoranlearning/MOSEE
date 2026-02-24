"""
SEC EDGAR 10-K Filing Fetcher

Downloads and parses annual reports (10-K filings) from SEC EDGAR
using the edgartools library. Extracts key sections for AI analysis:
- Item 1: Business Description
- Item 1A: Risk Factors
- Item 7: MD&A (Management Discussion & Analysis)
- Item 7A: Market Risk Disclosures

Caches fetched filings in PostgreSQL to avoid re-downloading.
Returns None gracefully for international stocks or missing filings.
"""

import os
import time
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Section names we extract from 10-K filings
TARGET_SECTIONS = {
    "business": ["Item 1", "ITEM 1"],
    "risk_factors": ["Item 1A", "ITEM 1A"],
    "mda": ["Item 7", "ITEM 7"],
    "market_risk": ["Item 7A", "ITEM 7A"],
}


@dataclass
class FilingSection:
    """A single extracted section from a 10-K filing."""
    name: str           # e.g., "business", "risk_factors", "mda", "market_risk"
    title: str          # e.g., "Item 7 - Management's Discussion and Analysis"
    text: str           # Clean text content
    char_count: int = 0

    def __post_init__(self):
        self.char_count = len(self.text)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "title": self.title,
            "text": self.text,
            "char_count": self.char_count,
        }


@dataclass
class AnnualFiling:
    """A parsed 10-K filing for one fiscal year."""
    ticker: str
    filing_year: int
    filing_date: str
    sections: Dict[str, FilingSection] = field(default_factory=dict)

    @property
    def total_chars(self) -> int:
        return sum(s.char_count for s in self.sections.values())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "filing_year": self.filing_year,
            "filing_date": self.filing_date,
            "sections": {k: v.to_dict() for k, v in self.sections.items()},
            "total_chars": self.total_chars,
        }


def _try_import_edgar():
    """Import edgartools, returning None if not installed."""
    try:
        import edgar
        return edgar
    except ImportError:
        logger.warning("edgartools not installed. Run: pip install edgartools>=3.0.0")
        return None


def _setup_edgar_identity():
    """Set SEC EDGAR identity (required by SEC fair use policy)."""
    edgar = _try_import_edgar()
    if edgar is None:
        return None

    # SEC requires a User-Agent with contact email
    email = os.environ.get("SEC_EDGAR_EMAIL", "mosee-analyzer@example.com")
    edgar.set_identity(email)
    return edgar


def _extract_sections_from_filing(filing, ticker: str, year: int) -> Optional[AnnualFiling]:
    """
    Extract target sections from a single 10-K filing object.

    Uses edgartools' built-in section extraction which handles
    HTML-to-text conversion and section boundary detection.
    """
    try:
        tenk = filing.obj()  # Get the TenK object with parsed sections
    except Exception as e:
        logger.warning(f"Could not parse 10-K for {ticker} ({year}): {e}")
        return None

    filing_date = str(filing.filing_date) if hasattr(filing, 'filing_date') else str(year)

    annual = AnnualFiling(
        ticker=ticker,
        filing_year=year,
        filing_date=filing_date,
    )

    # Try to extract each target section
    for section_key, section_names in TARGET_SECTIONS.items():
        text = None

        # Try using the TenK object's built-in section accessors
        try:
            if section_key == "business" and hasattr(tenk, 'item1'):
                text = str(tenk.item1) if tenk.item1 else None
            elif section_key == "risk_factors" and hasattr(tenk, 'item1a'):
                text = str(tenk.item1a) if tenk.item1a else None
            elif section_key == "mda" and hasattr(tenk, 'item7'):
                text = str(tenk.item7) if tenk.item7 else None
            elif section_key == "market_risk" and hasattr(tenk, 'item7a'):
                text = str(tenk.item7a) if tenk.item7a else None
        except Exception as e:
            logger.debug(f"Section accessor failed for {section_key} ({ticker} {year}): {e}")

        if text and len(text.strip()) > 100:  # Minimum viable section
            annual.sections[section_key] = FilingSection(
                name=section_key,
                title=section_names[0],
                text=text.strip(),
            )

    return annual if annual.sections else None


def fetch_annual_reports(
    ticker: str,
    years: int = 3,
    db_client=None,
) -> Optional[Dict[int, AnnualFiling]]:
    """
    Fetch the last N years of 10-K filings for a US-listed company.

    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        years: Number of annual filings to fetch (default 3)
        db_client: Optional MOSEEDatabaseClient for caching

    Returns:
        Dict mapping filing year to AnnualFiling, or None if unavailable.
        Example: {2024: AnnualFiling(...), 2023: AnnualFiling(...), 2022: AnnualFiling(...)}
    """
    # Check cache first
    if db_client:
        cached = _load_from_cache(ticker, years, db_client)
        if cached:
            logger.info(f"Using cached filings for {ticker} ({len(cached)} years)")
            return cached

    edgar = _setup_edgar_identity()
    if edgar is None:
        return None

    try:
        company = edgar.Company(ticker)
    except Exception as e:
        logger.info(f"Could not find {ticker} on EDGAR (may be international): {e}")
        return None

    # Fetch 10-K filings
    try:
        filings = company.get_filings(form="10-K")
        if filings is None or len(filings) == 0:
            # Try 10-K/A (amended) as fallback
            filings = company.get_filings(form="10-K/A")
            if filings is None or len(filings) == 0:
                logger.info(f"No 10-K filings found for {ticker}")
                return None
    except Exception as e:
        logger.warning(f"Error fetching filings for {ticker}: {e}")
        return None

    # Take the most recent N filings
    recent_filings = list(filings[:years])

    results = {}
    for filing in recent_filings:
        try:
            year = filing.filing_date.year if hasattr(filing, 'filing_date') else None
            if year is None:
                continue

            annual = _extract_sections_from_filing(filing, ticker, year)
            if annual:
                results[year] = annual
                logger.info(
                    f"  Extracted {len(annual.sections)} sections from {ticker} "
                    f"{year} 10-K ({annual.total_chars:,} chars)"
                )

            # Respect SEC rate limits (10 req/sec max)
            time.sleep(0.2)

        except Exception as e:
            logger.warning(f"Error processing {ticker} filing: {e}")
            continue

    if not results:
        logger.info(f"Could not extract any sections for {ticker}")
        return None

    # Cache results
    if db_client:
        _save_to_cache(results, db_client)

    return results


def _load_from_cache(
    ticker: str, years: int, db_client
) -> Optional[Dict[int, AnnualFiling]]:
    """Load cached filings from database if available and fresh (< 90 days old)."""
    try:
        rows = db_client.fetch_cached_filings(ticker, years)
        if not rows:
            return None

        results = {}
        for row in rows:
            sections_data = row.get('sections', {})
            sections = {}
            for key, sec_dict in sections_data.items():
                sections[key] = FilingSection(
                    name=sec_dict['name'],
                    title=sec_dict['title'],
                    text=sec_dict['text'],
                )

            results[row['filing_year']] = AnnualFiling(
                ticker=ticker,
                filing_year=row['filing_year'],
                filing_date=row.get('filing_date', str(row['filing_year'])),
                sections=sections,
            )

        return results if results else None

    except Exception as e:
        logger.debug(f"Cache lookup failed for {ticker}: {e}")
        return None


def _save_to_cache(filings: Dict[int, AnnualFiling], db_client) -> None:
    """Save fetched filings to database cache."""
    try:
        for year, annual in filings.items():
            db_client.save_filing(
                ticker=annual.ticker,
                filing_year=year,
                filing_type="10-K",
                sections={k: v.to_dict() for k, v in annual.sections.items()},
            )
    except Exception as e:
        logger.warning(f"Failed to cache filings: {e}")


def get_filing_summary(filings: Dict[int, AnnualFiling]) -> str:
    """Get a human-readable summary of fetched filings."""
    if not filings:
        return "No filings available"

    lines = []
    for year in sorted(filings.keys(), reverse=True):
        annual = filings[year]
        sections = ", ".join(annual.sections.keys())
        lines.append(f"  {year}: {len(annual.sections)} sections ({annual.total_chars:,} chars) [{sections}]")

    return f"Filings fetched:\n" + "\n".join(lines)
