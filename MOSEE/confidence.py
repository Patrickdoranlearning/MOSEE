"""
MOSEE Confidence Scoring Module

Calculates confidence scores based on:
1. Data Quality - completeness of financial data
2. Metric Consistency - agreement between valuation methods

Combined confidence levels:
- HIGH: Score >= 80
- MEDIUM: Score 50-79
- LOW: Score < 50
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ConfidenceScore:
    """Confidence score result."""
    level: str  # HIGH, MEDIUM, LOW
    score: float  # 0-100
    data_quality_score: float  # 0-100
    metric_consistency_score: float  # 0-100
    details: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "level": self.level,
            "score": self.score,
            "data_quality_score": self.data_quality_score,
            "metric_consistency_score": self.metric_consistency_score,
            "details": self.details
        }


def calculate_data_quality_score(
    cash_flow_df: Optional[pd.DataFrame],
    balance_sheet_df: Optional[pd.DataFrame],
    market_cap: Optional[float],
    current_price: Optional[float],
    min_years: int = 3
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate data quality score based on completeness of financial data.
    
    Args:
        cash_flow_df: Cash flow statement DataFrame
        balance_sheet_df: Balance sheet DataFrame
        market_cap: Market capitalization
        current_price: Current stock price
        min_years: Minimum years of data required for full score
        
    Returns:
        Tuple of (score 0-100, details dict)
    """
    score = 0
    max_score = 100
    details = {}
    
    # Cash flow data completeness (40 points)
    if cash_flow_df is not None and not cash_flow_df.empty:
        years_of_data = len(cash_flow_df.columns) if hasattr(cash_flow_df, 'columns') else 0
        
        # Check for key metrics
        has_net_income = any(name in cash_flow_df.index for name in [
            'Net Income', 'Net Income From Continuing Operations',
            'Net Income From Continuing Operation Net Minority Interest'
        ]) if hasattr(cash_flow_df, 'index') else False
        
        if years_of_data >= min_years:
            score += 25
            details["cash_flow_years"] = f"{years_of_data} years (sufficient)"
        elif years_of_data > 0:
            score += 15 * (years_of_data / min_years)
            details["cash_flow_years"] = f"{years_of_data} years (limited)"
        else:
            details["cash_flow_years"] = "No data"
            
        if has_net_income:
            score += 15
            details["has_net_income"] = True
        else:
            details["has_net_income"] = False
    else:
        details["cash_flow_years"] = "No data"
        details["has_net_income"] = False
    
    # Balance sheet completeness (30 points)
    if balance_sheet_df is not None and not balance_sheet_df.empty:
        # Check for key metrics
        key_fields = [
            'Total Assets', 'Total Liabilities', 'Total Liabilities Net Minority Interest',
            'Cash And Cash Equivalents', 'Current Assets', 'Current Liabilities'
        ]
        
        found_fields = 0
        if hasattr(balance_sheet_df, 'index'):
            for field in key_fields:
                if field in balance_sheet_df.index:
                    found_fields += 1
        
        field_score = (found_fields / len(key_fields)) * 30
        score += field_score
        details["balance_sheet_fields"] = f"{found_fields}/{len(key_fields)} key fields"
    else:
        details["balance_sheet_fields"] = "No data"
    
    # Market cap availability (15 points)
    if market_cap is not None and market_cap > 0:
        score += 15
        details["has_market_cap"] = True
    else:
        details["has_market_cap"] = False
    
    # Current price availability (15 points)
    if current_price is not None and current_price > 0:
        score += 15
        details["has_current_price"] = True
    else:
        details["has_current_price"] = False
    
    return min(score, max_score), details


def calculate_metric_consistency_score(
    dcf_value: Optional[float],
    pad_value: Optional[float],
    book_value: Optional[float],
    market_cap: Optional[float]
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate metric consistency score based on agreement between valuation methods.
    
    Lower variance between normalized valuations = higher confidence.
    
    Args:
        dcf_value: DCF valuation
        pad_value: PAD valuation
        book_value: Book value
        market_cap: Market capitalization (for normalization)
        
    Returns:
        Tuple of (score 0-100, details dict)
    """
    details = {}
    
    # Collect valid valuations
    valuations = {}
    if dcf_value is not None and dcf_value != 0:
        valuations["dcf"] = dcf_value
    if pad_value is not None and pad_value != 0:
        valuations["pad"] = pad_value
    if book_value is not None and book_value != 0:
        valuations["book"] = book_value
    
    if len(valuations) < 2:
        details["reason"] = "Insufficient valuation methods"
        details["methods_available"] = list(valuations.keys())
        return 30, details  # Low confidence if we can't compare
    
    # Normalize valuations by market cap if available
    if market_cap and market_cap > 0:
        normalized = {k: v / market_cap for k, v in valuations.items()}
    else:
        # Use median for normalization
        median_val = np.median(list(valuations.values()))
        if median_val != 0:
            normalized = {k: v / median_val for k, v in valuations.items()}
        else:
            normalized = valuations.copy()
    
    values = list(normalized.values())
    
    # Calculate coefficient of variation (CV)
    mean_val = np.mean(values)
    std_val = np.std(values)
    
    if mean_val != 0:
        cv = abs(std_val / mean_val)
    else:
        cv = float('inf')
    
    # Score based on CV
    # CV < 0.2 = excellent agreement (100)
    # CV 0.2-0.5 = good agreement (70-100)
    # CV 0.5-1.0 = moderate agreement (40-70)
    # CV > 1.0 = poor agreement (0-40)
    
    if cv < 0.2:
        score = 100
        agreement = "excellent"
    elif cv < 0.5:
        score = 70 + (0.5 - cv) * 100
        agreement = "good"
    elif cv < 1.0:
        score = 40 + (1.0 - cv) * 60
        agreement = "moderate"
    else:
        score = max(0, 40 - (cv - 1.0) * 20)
        agreement = "poor"
    
    details["coefficient_of_variation"] = round(cv, 3)
    details["agreement_level"] = agreement
    details["methods_compared"] = list(valuations.keys())
    details["normalized_values"] = {k: round(v, 3) for k, v in normalized.items()}
    
    return min(score, 100), details


def calculate_confidence(
    cash_flow_df: Optional[pd.DataFrame] = None,
    balance_sheet_df: Optional[pd.DataFrame] = None,
    market_cap: Optional[float] = None,
    current_price: Optional[float] = None,
    dcf_value: Optional[float] = None,
    pad_value: Optional[float] = None,
    book_value: Optional[float] = None,
    data_weight: float = 0.5,
    consistency_weight: float = 0.5
) -> ConfidenceScore:
    """
    Calculate combined confidence score.
    
    Args:
        cash_flow_df: Cash flow statement DataFrame
        balance_sheet_df: Balance sheet DataFrame
        market_cap: Market capitalization
        current_price: Current stock price
        dcf_value: DCF valuation
        pad_value: PAD valuation
        book_value: Book value
        data_weight: Weight for data quality score (default 0.5)
        consistency_weight: Weight for metric consistency score (default 0.5)
        
    Returns:
        ConfidenceScore object
    """
    # Calculate component scores
    data_score, data_details = calculate_data_quality_score(
        cash_flow_df, balance_sheet_df, market_cap, current_price
    )
    
    consistency_score, consistency_details = calculate_metric_consistency_score(
        dcf_value, pad_value, book_value, market_cap
    )
    
    # Calculate combined score
    combined_score = (data_score * data_weight) + (consistency_score * consistency_weight)
    
    # Determine confidence level
    if combined_score >= 80:
        level = "HIGH"
    elif combined_score >= 50:
        level = "MEDIUM"
    else:
        level = "LOW"
    
    return ConfidenceScore(
        level=level,
        score=round(combined_score, 1),
        data_quality_score=round(data_score, 1),
        metric_consistency_score=round(consistency_score, 1),
        details={
            "data_quality": data_details,
            "metric_consistency": consistency_details
        }
    )


def get_confidence_color(level: str) -> str:
    """Get color code for confidence level (for terminal display)."""
    colors = {
        "HIGH": "green",
        "MEDIUM": "yellow",
        "LOW": "red"
    }
    return colors.get(level.upper(), "white")


def get_confidence_emoji(level: str) -> str:
    """Get emoji indicator for confidence level."""
    emojis = {
        "HIGH": "🟢",
        "MEDIUM": "🟡",
        "LOW": "🔴"
    }
    return emojis.get(level.upper(), "⚪")
