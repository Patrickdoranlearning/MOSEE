"""
Philip Fisher Growth Metrics Module

From "Common Stocks and Uncommon Profits"

Fisher focused on:
1. Sales growth - companies with sustainable revenue growth
2. Profit margins - improving margins indicate competitive advantage
3. Research & Development - investment in future growth
4. Management quality - though this is harder to quantify

This module provides quantitative metrics inspired by Fisher's approach.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class GrowthMetricsResult:
    """Results of growth metrics calculation."""
    sales_cagr: float  # Compound Annual Growth Rate
    margin_trend: str  # Improving, Stable, Declining
    margin_trend_score: float  # -1 to 1
    reinvestment_efficiency: float
    growth_quality_score: float  # 0-100
    details: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sales_cagr": round(self.sales_cagr, 4),
            "margin_trend": self.margin_trend,
            "margin_trend_score": round(self.margin_trend_score, 3),
            "reinvestment_efficiency": round(self.reinvestment_efficiency, 4) if self.reinvestment_efficiency else None,
            "growth_quality_score": round(self.growth_quality_score, 1),
            "details": self.details
        }


def calculate_cagr(start_value: float, end_value: float, years: int) -> float:
    """
    Calculate Compound Annual Growth Rate.
    
    CAGR = (End Value / Start Value)^(1/years) - 1
    
    Args:
        start_value: Starting value
        end_value: Ending value
        years: Number of years
        
    Returns:
        CAGR as decimal (0.10 = 10%)
    """
    if start_value <= 0 or end_value <= 0 or years <= 0:
        return 0.0
    
    return (end_value / start_value) ** (1 / years) - 1


def calculate_sales_cagr(revenue_series: pd.Series) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate Sales/Revenue CAGR.
    
    Fisher looked for companies with consistent, sustainable sales growth.
    
    Args:
        revenue_series: Series of annual revenue values
        
    Returns:
        Tuple of (CAGR, details dict)
    """
    details = {}
    
    if not isinstance(revenue_series, pd.Series) or len(revenue_series) < 2:
        return 0.0, {"error": "Insufficient data"}
    
    # Clean data
    clean_revenue = revenue_series.dropna()
    if len(clean_revenue) < 2:
        return 0.0, {"error": "Insufficient clean data"}
    
    start_value = clean_revenue.iloc[0]
    end_value = clean_revenue.iloc[-1]
    years = len(clean_revenue) - 1
    
    cagr = calculate_cagr(start_value, end_value, years)
    
    # Also calculate year-over-year growth rates for consistency check
    yoy_growth = clean_revenue.pct_change().dropna()
    
    details["start_revenue"] = start_value
    details["end_revenue"] = end_value
    details["years"] = years
    details["yoy_growth_avg"] = yoy_growth.mean() if len(yoy_growth) > 0 else 0
    details["yoy_growth_std"] = yoy_growth.std() if len(yoy_growth) > 0 else 0
    details["positive_growth_years"] = (yoy_growth > 0).sum() if len(yoy_growth) > 0 else 0
    details["total_growth_years"] = len(yoy_growth)
    
    # Growth consistency score (less volatility = more consistent)
    if details["yoy_growth_avg"] != 0:
        cv = details["yoy_growth_std"] / abs(details["yoy_growth_avg"])
        details["growth_consistency"] = max(0, 1 - cv)
    else:
        details["growth_consistency"] = 0
    
    return cagr, details


def calculate_margin_trend(margin_series: pd.Series) -> Tuple[str, float, Dict[str, Any]]:
    """
    Analyze margin trend over time.
    
    Fisher valued companies with improving or stable margins, indicating
    competitive advantage and pricing power.
    
    Args:
        margin_series: Series of margin values (gross, operating, or net margin)
        
    Returns:
        Tuple of (trend description, trend score -1 to 1, details)
    """
    details = {}
    
    if not isinstance(margin_series, pd.Series) or len(margin_series) < 2:
        return "Unknown", 0, {"error": "Insufficient data"}
    
    # Clean data
    clean_margins = margin_series.dropna()
    if len(clean_margins) < 2:
        return "Unknown", 0, {"error": "Insufficient clean data"}
    
    # Calculate linear regression slope
    x = np.arange(len(clean_margins))
    y = clean_margins.values
    
    # Simple linear regression
    slope = np.polyfit(x, y, 1)[0]
    
    # Normalize slope by average margin
    avg_margin = clean_margins.mean()
    if avg_margin != 0:
        normalized_slope = slope / abs(avg_margin)
    else:
        normalized_slope = 0
    
    # Determine trend
    if normalized_slope > 0.05:  # > 5% improvement per year relative to average
        trend = "Improving"
        trend_score = min(1.0, normalized_slope * 5)  # Cap at 1.0
    elif normalized_slope < -0.05:  # > 5% decline per year
        trend = "Declining"
        trend_score = max(-1.0, normalized_slope * 5)  # Cap at -1.0
    else:
        trend = "Stable"
        trend_score = 0.0
    
    details["start_margin"] = clean_margins.iloc[0]
    details["end_margin"] = clean_margins.iloc[-1]
    details["avg_margin"] = avg_margin
    details["slope"] = slope
    details["normalized_slope"] = normalized_slope
    details["margin_std"] = clean_margins.std()
    
    return trend, trend_score, details


def calculate_reinvestment_efficiency(
    earnings_growth: float,
    retained_earnings_ratio: float
) -> float:
    """
    Calculate Reinvestment Efficiency.
    
    This measures how effectively the company turns retained earnings into growth.
    
    Reinvestment Efficiency = Earnings Growth / Retention Ratio
    
    High efficiency means the company generates good returns on reinvested capital.
    
    Args:
        earnings_growth: Earnings growth rate as decimal
        retained_earnings_ratio: Portion of earnings retained (1 - payout ratio)
        
    Returns:
        Reinvestment efficiency ratio
    """
    if retained_earnings_ratio <= 0:
        return 0.0
    
    return earnings_growth / retained_earnings_ratio


def calculate_sustainable_growth_rate(roe: float, retention_ratio: float) -> float:
    """
    Calculate Sustainable Growth Rate.
    
    SGR = ROE × Retention Ratio
    
    This is the maximum rate a company can grow without external financing.
    
    Args:
        roe: Return on Equity as decimal
        retention_ratio: Portion of earnings retained (1 - payout ratio)
        
    Returns:
        Sustainable growth rate as decimal
    """
    return roe * retention_ratio


def calculate_growth_quality_score(
    sales_cagr: float,
    margin_trend_score: float,
    growth_consistency: float,
    roe: float = None
) -> float:
    """
    Calculate overall growth quality score.
    
    Components:
    - Sales growth rate (40%)
    - Margin trend (30%)
    - Growth consistency (20%)
    - ROE bonus (10%)
    
    Args:
        sales_cagr: Sales CAGR as decimal
        margin_trend_score: Margin trend score (-1 to 1)
        growth_consistency: Growth consistency score (0 to 1)
        roe: Return on Equity (optional bonus)
        
    Returns:
        Quality score from 0-100
    """
    score = 0
    
    # Sales growth component (40 points max)
    # 20% growth = 40 points, scales linearly
    sales_score = min(40, max(0, sales_cagr * 200))
    score += sales_score
    
    # Margin trend component (30 points max)
    # Score of 1.0 = 30 points, 0 = 15 points, -1.0 = 0 points
    margin_score = 15 + (margin_trend_score * 15)
    score += margin_score
    
    # Consistency component (20 points max)
    consistency_score = growth_consistency * 20
    score += consistency_score
    
    # ROE bonus (10 points max)
    if roe is not None and roe > 0:
        # ROE of 20% = 10 points
        roe_score = min(10, roe * 50)
        score += roe_score
    
    return min(100, max(0, score))


def get_fisher_metrics(
    revenue_series: pd.Series,
    gross_margin_series: pd.Series = None,
    operating_margin_series: pd.Series = None,
    net_margin_series: pd.Series = None,
    net_income_series: pd.Series = None,
    dividends_series: pd.Series = None,
    roe: float = None
) -> GrowthMetricsResult:
    """
    Calculate all Fisher-inspired growth metrics.
    
    Args:
        revenue_series: Series of annual revenue
        gross_margin_series: Series of gross margins
        operating_margin_series: Series of operating margins
        net_margin_series: Series of net margins
        net_income_series: Series of net income
        dividends_series: Series of dividends paid
        roe: Current ROE
        
    Returns:
        GrowthMetricsResult with all metrics
    """
    details = {}
    
    # Calculate Sales CAGR
    sales_cagr, sales_details = calculate_sales_cagr(revenue_series)
    details["sales"] = sales_details
    
    # Calculate margin trends (use best available)
    margin_series = None
    margin_type = None
    
    if operating_margin_series is not None and isinstance(operating_margin_series, pd.Series) and len(operating_margin_series) >= 2:
        margin_series = operating_margin_series
        margin_type = "operating"
    elif gross_margin_series is not None and isinstance(gross_margin_series, pd.Series) and len(gross_margin_series) >= 2:
        margin_series = gross_margin_series
        margin_type = "gross"
    elif net_margin_series is not None and isinstance(net_margin_series, pd.Series) and len(net_margin_series) >= 2:
        margin_series = net_margin_series
        margin_type = "net"
    
    if margin_series is not None:
        margin_trend, margin_trend_score, margin_details = calculate_margin_trend(margin_series)
        details["margin"] = margin_details
        details["margin_type"] = margin_type
    else:
        margin_trend = "Unknown"
        margin_trend_score = 0
        details["margin"] = {"error": "No margin data available"}
    
    # Calculate reinvestment efficiency
    reinvestment_efficiency = 0
    if net_income_series is not None and dividends_series is not None:
        if isinstance(net_income_series, pd.Series) and isinstance(dividends_series, pd.Series):
            if len(net_income_series) >= 2 and len(dividends_series) >= 2:
                # Calculate earnings growth
                earnings_cagr, _ = calculate_sales_cagr(net_income_series.clip(lower=0.01))  # Avoid negative
                
                # Calculate average retention ratio - replace inf with NaN before operating
                payout_series = (dividends_series / net_income_series)
                payout_series = payout_series.replace([np.inf, -np.inf], np.nan)
                payout_ratio = payout_series.mean()
                payout_ratio = max(0, min(1, payout_ratio)) if not pd.isna(payout_ratio) else 0.5
                
                retention_ratio = 1 - payout_ratio
                
                if retention_ratio > 0:
                    reinvestment_efficiency = calculate_reinvestment_efficiency(earnings_cagr, retention_ratio)
                
                details["earnings_cagr"] = earnings_cagr
                details["retention_ratio"] = retention_ratio
    
    # Calculate growth quality score
    growth_consistency = sales_details.get("growth_consistency", 0)
    growth_quality_score = calculate_growth_quality_score(
        sales_cagr, margin_trend_score, growth_consistency, roe
    )
    
    return GrowthMetricsResult(
        sales_cagr=sales_cagr,
        margin_trend=margin_trend,
        margin_trend_score=margin_trend_score,
        reinvestment_efficiency=reinvestment_efficiency,
        growth_quality_score=growth_quality_score,
        details=details
    )


def get_fisher_interpretation(metrics: GrowthMetricsResult) -> Dict[str, str]:
    """
    Provide interpretation of Fisher growth metrics.
    
    Args:
        metrics: GrowthMetricsResult object
        
    Returns:
        Dictionary with interpretations
    """
    interpretation = {}
    
    # Sales growth interpretation
    if metrics.sales_cagr > 0.15:
        interpretation["sales_growth"] = "Excellent growth (>15% CAGR)"
    elif metrics.sales_cagr > 0.10:
        interpretation["sales_growth"] = "Strong growth (10-15% CAGR)"
    elif metrics.sales_cagr > 0.05:
        interpretation["sales_growth"] = "Moderate growth (5-10% CAGR)"
    elif metrics.sales_cagr > 0:
        interpretation["sales_growth"] = "Slow growth (<5% CAGR)"
    else:
        interpretation["sales_growth"] = "Declining sales"
    
    # Margin trend interpretation
    interpretation["margin_trend"] = f"Margins are {metrics.margin_trend.lower()}"
    
    # Overall Fisher score interpretation
    if metrics.growth_quality_score >= 80:
        interpretation["overall"] = "Excellent growth characteristics - Fisher would approve"
    elif metrics.growth_quality_score >= 60:
        interpretation["overall"] = "Good growth characteristics"
    elif metrics.growth_quality_score >= 40:
        interpretation["overall"] = "Average growth characteristics"
    else:
        interpretation["overall"] = "Below average growth - may not meet Fisher criteria"
    
    return interpretation
