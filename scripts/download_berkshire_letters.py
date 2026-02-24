#!/usr/bin/env python3
"""
Download all Berkshire Hathaway shareholder letters (1977-2024)
and save as text files in knowledge_base/berkshire_letters/

Letters are freely available at berkshirehathaway.com/letters/
- 1977-1997: HTML format (direct)
- 1998-2003: PDF format (non-standard URLs)
- 2004-2024: PDF format (standard URLs)

Usage:
    python scripts/download_berkshire_letters.py
    python scripts/download_berkshire_letters.py --year 2023     # Single year
    python scripts/download_berkshire_letters.py --start 2015    # From 2015 onwards
    python scripts/download_berkshire_letters.py --force          # Re-download all
"""

import argparse
import io
import os
import re
import time

import requests
from bs4 import BeautifulSoup

# Prefer pdfplumber (cleaner extraction), fall back to PyPDF2
try:
    import pdfplumber
    HAS_PDF = True
    PDF_LIB = "pdfplumber"
except ImportError:
    try:
        from PyPDF2 import PdfReader
        HAS_PDF = True
        PDF_LIB = "PyPDF2"
    except ImportError:
        HAS_PDF = False
        PDF_LIB = None

# --- Configuration ---

BASE_URL = "https://www.berkshirehathaway.com/letters/"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge_base", "berkshire_letters")

# HTML letters (direct content, 1977-1997)
HTML_LETTERS = {year: f"{year}.html" for year in range(1977, 1998)}

# PDF letters with correct URLs
# 1998-2003 have non-standard filenames on berkshirehathaway.com
PDF_LETTERS = {
    1998: "1998pdf.pdf",
    1999: "final1999pdf.pdf",
    2000: "2000pdf.pdf",
    2001: "2001pdf.pdf",
    2002: "2002pdf.pdf",
    2003: "2003ltr.pdf",
}
for year in range(2004, 2025):
    PDF_LETTERS[year] = f"{year}ltr.pdf"

ALL_LETTERS = {**HTML_LETTERS, **PDF_LETTERS}

HEADERS = {
    "User-Agent": "MOSEE Investment Analysis Tool (educational/research use)"
}

REQUEST_DELAY = 1.5  # seconds between requests


def clean_text(text: str) -> str:
    """Clean extracted text: normalize whitespace, remove artifacts."""
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    text = '\n'.join(line.rstrip() for line in text.split('\n'))
    return text.strip()


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using best available library."""
    if PDF_LIB == "pdfplumber":
        pdf = pdfplumber.open(io.BytesIO(pdf_bytes))
        pages = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
        pdf.close()
        return '\n\n'.join(pages)
    else:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
        return '\n\n'.join(pages)


def fetch_html_letter(year: int) -> str:
    """Download and extract text from an HTML-format letter."""
    url = BASE_URL + HTML_LETTERS[year]
    print(f"  Fetching HTML: {url}")

    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'html.parser')

    for tag in soup(['script', 'style', 'head']):
        tag.decompose()

    text = soup.get_text(separator='\n')
    text = clean_text(text)

    header = f"BERKSHIRE HATHAWAY SHAREHOLDER LETTER — {year}\n"
    header += "Warren E. Buffett, Chairman\n"
    header += "=" * 60 + "\n\n"

    return header + text


def fetch_pdf_letter(year: int) -> str:
    """Download and extract text from a PDF-format letter."""
    if not HAS_PDF:
        print(f"  WARNING: No PDF library installed, skipping {year}")
        print(f"  Install with: pip install pdfplumber")
        return ""

    url = BASE_URL + PDF_LETTERS[year]
    print(f"  Fetching PDF ({PDF_LIB}): {url}")

    resp = requests.get(url, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    text = extract_pdf_text(resp.content)
    text = clean_text(text)

    header = f"BERKSHIRE HATHAWAY SHAREHOLDER LETTER — {year}\n"
    header += "Warren E. Buffett, Chairman\n"
    header += "=" * 60 + "\n\n"

    return header + text


def download_letter(year: int, force: bool = False) -> bool:
    """Download a single letter and save to disk. Returns True on success."""
    output_path = os.path.join(OUTPUT_DIR, f"berkshire_{year}.txt")

    if not force and os.path.exists(output_path):
        size = os.path.getsize(output_path)
        if size > 5000:
            print(f"  [{year}] Already exists ({size:,} bytes), skipping")
            return True

    try:
        if year in HTML_LETTERS:
            text = fetch_html_letter(year)
        elif year in PDF_LETTERS:
            text = fetch_pdf_letter(year)
        else:
            print(f"  [{year}] Unknown year, skipping")
            return False

        if not text or len(text) < 500:
            print(f"  [{year}] WARNING: Extracted text too short ({len(text)} chars)")
            return False

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)

        print(f"  [{year}] Saved: {len(text):,} chars")
        return True

    except requests.exceptions.RequestException as e:
        print(f"  [{year}] ERROR downloading: {e}")
        return False
    except Exception as e:
        print(f"  [{year}] ERROR processing: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download Berkshire Hathaway shareholder letters")
    parser.add_argument('--year', type=int, help='Download a specific year only')
    parser.add_argument('--start', type=int, default=1977, help='Start year (default: 1977)')
    parser.add_argument('--end', type=int, default=2024, help='End year (default: 2024)')
    parser.add_argument('--force', action='store_true', help='Re-download even if file exists')
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if args.year:
        years = [args.year]
    else:
        years = [y for y in range(args.start, args.end + 1) if y in ALL_LETTERS]

    print("Berkshire Hathaway Shareholder Letters Downloader")
    print("=" * 50)
    print(f"Years: {years[0]}-{years[-1]} ({len(years)} letters)")
    print(f"Output: {OUTPUT_DIR}")
    print(f"PDF library: {PDF_LIB or 'NONE — install pdfplumber!'}")
    if args.force:
        print("Mode: FORCE re-download")
    print()

    success = 0
    failed = 0

    for i, year in enumerate(years):
        print(f"[{i+1}/{len(years)}] Year {year}:")
        if download_letter(year, force=args.force):
            success += 1
        else:
            failed += 1

        if i < len(years) - 1:
            time.sleep(REQUEST_DELAY)

    print()
    print(f"Done! {success} downloaded, {failed} failed")
    print(f"Files saved to: {OUTPUT_DIR}")

    if success > 0:
        total_size = sum(
            os.path.getsize(os.path.join(OUTPUT_DIR, f))
            for f in os.listdir(OUTPUT_DIR)
            if f.endswith('.txt')
        )
        print(f"Total size: {total_size / (1024*1024):.1f} MB")
        print()
        print("Next step: Rebuild the knowledge base vector store:")
        print("  python scripts/build_knowledge_base.py")
        print("  — or use the 'Rebuild Vector Store' button on the Knowledge Base page")


if __name__ == '__main__':
    main()
