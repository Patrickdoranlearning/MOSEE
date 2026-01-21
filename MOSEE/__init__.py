"""
MOSEE - Margin of Safety & Earnings to Equity Stock Analyzer

A comprehensive stock analysis toolkit that evaluates investments based on:
- Margin of Safety (MoS) using multiple valuation methods
- Earnings to Equity ratios
- Combined MOSEE scores for ranking opportunities
- Confidence scoring based on data quality
- Investment book intelligence (Graham, Buffett, Lynch, Greenblatt, Fisher)

Modules:
    - MOS: Core margin of safety calculations
    - data_retrieval: Stock and fundamental data fetching
    - fundamental_analysis: Valuation and indicator calculations (enhanced with book intelligence)
    - scoring: Composite scoring from multiple investment philosophies
    - technical_analysis: Technical analysis tools
    - filters: Stock filtering by country, industry, cap
    - confidence: Data quality and metric consistency scoring
    - profile: Investment profile building
    - history: Historical tracking and comparisons
    - outputs: Terminal, CSV, and PDF output generators

Investment Book Intelligence:
    - Benjamin Graham: Graham Number, 7 Defensive Criteria (The Intelligent Investor)
    - Warren Buffett: Owner Earnings, ROE, ROIC (Berkshire Letters, The Warren Buffett Way)
    - Charlie Munger: Quality metrics, Moat indicators (Poor Charlie's Almanack)
    - Peter Lynch: PEG Ratio, Lynch Categories (One Up on Wall Street)
    - Joel Greenblatt: Magic Formula (The Little Book That Beats the Market)
    - Philip Fisher: Growth metrics, Margin trends (Common Stocks and Uncommon Profits)
    - Seth Klarman: Margin of Safety philosophy (Margin of Safety)

Usage:
    # Run CLI
    python mosee_cli.py
    
    # Or use programmatically
    from MOSEE.profile import build_profile
    from MOSEE.confidence import calculate_confidence
    from MOSEE.filters import FilterConfig, apply_filters
    from MOSEE.scoring import calculate_composite_score, InvestmentStyle
"""

__version__ = '2.1.0'
__author__ = 'Patrick Doran'

# Core modules
from .MOS import mos_dollar, mos_debt

# New modules
from .filters import FilterConfig, apply_filters, PRESET_FILTERS
from .confidence import calculate_confidence, ConfidenceScore
from .profile import InvestmentProfile, build_profile, rank_profiles
from .history import HistoryTracker, HistoryConfig

# Scoring module (Investment Book Intelligence)
from .scoring import (
    calculate_composite_score,
    InvestmentStyle,
    CompositeScore
)

# Range-based Valuation (Buffett's key insight)
from .valuation_range import (
    ValuationRange,
    CompositeValuationRange,
    build_composite_valuation,
    ValueConfidence
)

# MOSEE Intelligence Engine
from .mosee_intelligence import (
    generate_mosee_intelligence,
    MOSEEIntelligenceReport,
    InvestmentVerdict,
    InvestmentLens
)

__all__ = [
    # Version
    '__version__',
    
    # Core
    'mos_dollar',
    'mos_debt',
    
    # Filters
    'FilterConfig',
    'apply_filters',
    'PRESET_FILTERS',
    
    # Confidence
    'calculate_confidence',
    'ConfidenceScore',
    
    # Profile
    'InvestmentProfile',
    'build_profile',
    'rank_profiles',
    
    # History
    'HistoryTracker',
    'HistoryConfig',
    
    # Scoring (Investment Book Intelligence)
    'calculate_composite_score',
    'InvestmentStyle',
    'CompositeScore',
    
    # Range-based Valuation
    'ValuationRange',
    'CompositeValuationRange',
    'build_composite_valuation',
    'ValueConfidence',
    
    # MOSEE Intelligence Engine
    'generate_mosee_intelligence',
    'MOSEEIntelligenceReport',
    'InvestmentVerdict',
    'InvestmentLens',
]
