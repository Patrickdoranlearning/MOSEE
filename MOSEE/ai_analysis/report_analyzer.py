"""
MOSEE AI Report Analyzer

Core analysis engine that orchestrates:
1. Fetch 10-K filings from SEC EDGAR
2. Retrieve relevant investment wisdom from knowledge base (RAG)
3. Send everything to Gemini 2.5 Flash for structured analysis
4. Parse and validate the response
5. Return a structured AIAnalysisResult

This module is the main entry point for AI analysis.
"""

import os
import json
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

from .edgar_fetcher import fetch_annual_reports, AnnualFiling
from .knowledge_base import retrieve_wisdom, get_kb_stats
from .prompts import (
    SYSTEM_PROMPT,
    build_analysis_prompt,
    build_metrics_summary,
)

logger = logging.getLogger(__name__)


@dataclass
class AIDimension:
    """A single dimension of the AI analysis."""
    name: str
    score: float          # 0-100
    confidence: float     # 0.0-1.0
    summary: str
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "score": round(self.score, 1),
            "confidence": round(self.confidence, 2),
            "summary": self.summary,
            "evidence": self.evidence,
        }


@dataclass
class AIAnalysisResult:
    """Complete AI analysis result for a stock."""
    ticker: str
    filing_years: List[int]
    dimensions: List[AIDimension]
    executive_summary: str
    key_findings: List[str]
    red_flags: List[str]
    competitive_advantages: List[str]
    management_assessment: str
    composite_ai_score: float     # 0-100 (weighted average of dimensions)
    model_used: str
    analysis_date: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "filing_years": self.filing_years,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "executive_summary": self.executive_summary,
            "key_findings": self.key_findings,
            "red_flags": self.red_flags,
            "competitive_advantages": self.competitive_advantages,
            "management_assessment": self.management_assessment,
            "composite_ai_score": round(self.composite_ai_score, 1),
            "model_used": self.model_used,
            "analysis_date": self.analysis_date,
        }


# Dimension weights for composite score
DIMENSION_WEIGHTS = {
    "Management Quality": 0.20,
    "Competitive Moat": 0.20,
    "Capital Allocation": 0.15,
    "Risk Assessment": 0.15,
    "Growth Drivers": 0.10,
    "Accounting Quality": 0.10,
    "Corporate Governance": 0.05,
    "Strategic Consistency": 0.05,
}


def _call_gemini(system_prompt: str, user_prompt: str, model_name: str = None) -> Optional[str]:
    """
    Call Gemini API and return the text response.

    Returns None if the API call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not set")
        return None

    try:
        import google.generativeai as genai
    except ImportError:
        logger.error("google-generativeai not installed. Run: pip install google-generativeai>=0.8.0")
        return None

    if model_name is None:
        model_name = os.environ.get("MOSEE_AI_MODEL", "gemini-2.5-flash")

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,  # Low temperature for consistent, factual analysis
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )

    try:
        response = model.generate_content(user_prompt)
        return response.text
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return None


def _parse_gemini_response(response_text: str) -> Optional[Dict[str, Any]]:
    """Parse and validate the JSON response from Gemini."""
    if not response_text:
        return None

    # Strip markdown code fences if present
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (code fences)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.debug(f"Response text: {text[:500]}")
        return None

    # Validate required fields
    required_fields = ["dimensions", "executive_summary", "key_findings",
                       "red_flags", "competitive_advantages", "management_assessment"]
    for f in required_fields:
        if f not in data:
            logger.error(f"Missing required field in AI response: {f}")
            return None

    # Validate dimensions
    if len(data["dimensions"]) != 8:
        logger.warning(f"Expected 8 dimensions, got {len(data['dimensions'])}")

    return data


def _build_analysis_result(
    ticker: str,
    filing_years: List[int],
    parsed_data: Dict[str, Any],
    model_name: str,
) -> AIAnalysisResult:
    """Convert parsed JSON into an AIAnalysisResult dataclass."""
    dimensions = []
    for dim_data in parsed_data.get("dimensions", []):
        dimensions.append(AIDimension(
            name=dim_data.get("name", "Unknown"),
            score=float(dim_data.get("score", 50)),
            confidence=float(dim_data.get("confidence", 0.5)),
            summary=dim_data.get("summary", ""),
            evidence=dim_data.get("evidence", []),
        ))

    # Calculate composite score (weighted average, adjusted by confidence)
    total_weight = 0
    weighted_sum = 0
    for dim in dimensions:
        weight = DIMENSION_WEIGHTS.get(dim.name, 0.1)
        # Weight by both the assigned weight and the confidence
        effective_weight = weight * dim.confidence
        weighted_sum += dim.score * effective_weight
        total_weight += effective_weight

    composite = weighted_sum / total_weight if total_weight > 0 else 50.0

    return AIAnalysisResult(
        ticker=ticker,
        filing_years=filing_years,
        dimensions=dimensions,
        executive_summary=parsed_data.get("executive_summary", ""),
        key_findings=parsed_data.get("key_findings", []),
        red_flags=parsed_data.get("red_flags", []),
        competitive_advantages=parsed_data.get("competitive_advantages", []),
        management_assessment=parsed_data.get("management_assessment", ""),
        composite_ai_score=composite,
        model_used=model_name,
        analysis_date=datetime.now().strftime("%Y-%m-%d"),
    )


def analyze_annual_reports(
    ticker: str,
    all_metrics: Dict[str, Any],
    company_name: str = None,
    years: int = 3,
    db_client=None,
    model_name: str = None,
) -> Optional[AIAnalysisResult]:
    """
    Run full AI analysis on a stock's annual reports.

    This is the main entry point. It:
    1. Fetches 10-K filings from SEC EDGAR (with caching)
    2. Retrieves relevant investment wisdom from the knowledge base
    3. Sends everything to Gemini 2.5 Flash
    4. Returns structured analysis results

    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        all_metrics: MOSEE's all_metrics dict for this stock
        company_name: Company name (optional, for better prompts)
        years: Number of years of filings to analyze (default 3)
        db_client: Optional MOSEEDatabaseClient for caching
        model_name: Override the Gemini model (default: gemini-2.5-flash)

    Returns:
        AIAnalysisResult or None if analysis cannot be performed
    """
    if model_name is None:
        model_name = os.environ.get("MOSEE_AI_MODEL", "gemini-2.5-flash")

    # Check for API key
    if not os.environ.get("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY not set. Cannot run AI analysis.")
        return None

    logger.info(f"Starting AI analysis for {ticker}...")

    # Step 1: Fetch 10-K filings
    logger.info(f"  Fetching 10-K filings from SEC EDGAR...")
    filings = fetch_annual_reports(ticker, years=years, db_client=db_client)

    if not filings:
        logger.info(f"  No filings available for {ticker}. Skipping AI analysis.")
        return None

    filing_years = sorted(filings.keys(), reverse=True)
    logger.info(f"  Got filings for years: {filing_years}")

    # Step 2: Retrieve relevant investment wisdom
    wisdom_chunks = []
    kb_stats = get_kb_stats()
    if kb_stats.get("status") == "ready":
        # Build a query from the company's key characteristics
        query_parts = [f"{ticker} {company_name or ''}"]
        industry = all_metrics.get('industry', '')
        if industry:
            query_parts.append(industry)

        # Determine relevant topics based on metrics
        topics = []
        dte = all_metrics.get('debt_to_equity', 0)
        if isinstance(dte, (int, float)) and dte > 1.0:
            topics.append("risk")
        roe = all_metrics.get('roe', 0)
        if isinstance(roe, (int, float)) and roe > 0.15:
            topics.append("moats")
        eg = all_metrics.get('earnings_growth', 0)
        if isinstance(eg, (int, float)) and eg > 0.10:
            topics.append("growth")

        topics.extend(["management", "valuation", "capital_allocation"])

        logger.info(f"  Retrieving investment wisdom (topics: {topics})...")
        wisdom_chunks = retrieve_wisdom(
            query=" ".join(query_parts),
            topics=topics,
            top_k=8,
        )
        logger.info(f"  Retrieved {len(wisdom_chunks)} wisdom chunks")
    else:
        logger.info(f"  Knowledge base not available ({kb_stats.get('status')}). Proceeding without RAG.")

    # Step 3: Build prompt and call Gemini
    logger.info(f"  Building analysis prompt...")
    prompt = build_analysis_prompt(
        ticker=ticker,
        company_name=company_name or ticker,
        metrics=all_metrics,
        filings=filings,
        wisdom_chunks=wisdom_chunks,
    )

    prompt_chars = len(SYSTEM_PROMPT) + len(prompt)
    logger.info(f"  Prompt size: ~{prompt_chars:,} chars (~{prompt_chars // 4:,} tokens)")
    logger.info(f"  Calling {model_name}...")

    response_text = _call_gemini(SYSTEM_PROMPT, prompt, model_name=model_name)

    if not response_text:
        logger.error(f"  Gemini returned empty response for {ticker}")
        return None

    # Step 4: Parse response
    logger.info(f"  Parsing AI response...")
    parsed = _parse_gemini_response(response_text)

    if not parsed:
        logger.error(f"  Failed to parse Gemini response for {ticker}")
        return None

    # Step 5: Build result
    result = _build_analysis_result(ticker, filing_years, parsed, model_name)
    logger.info(
        f"  AI analysis complete for {ticker}: "
        f"composite score {result.composite_ai_score:.1f}/100, "
        f"{len(result.red_flags)} red flags, "
        f"{len(result.competitive_advantages)} moats identified"
    )

    return result
