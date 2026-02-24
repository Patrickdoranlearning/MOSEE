"""
MOSEE AI Analysis Module

AI-powered qualitative analysis of annual reports (10-K filings)
using RAG + Gemini 2.5 Flash. Reads filings through the lens of
Graham, Buffett, Munger, Fisher, and other great investors.

Key components:
- edgar_fetcher: Downloads and parses SEC 10-K filings
- knowledge_base: RAG vector store of investment wisdom
- report_analyzer: Core Gemini Flash analysis engine
- prompts: Prompt templates for structured analysis
"""

from .report_analyzer import analyze_annual_reports, AIAnalysisResult, AIDimension

__all__ = [
    'analyze_annual_reports',
    'AIAnalysisResult',
    'AIDimension',
]
