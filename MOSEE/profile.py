"""
MOSEE Investment Profile Module

Builds structured investment profiles for each analyzed company,
containing all metrics, valuations, and recommendations.
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from enum import Enum


class Recommendation(Enum):
    """Investment recommendation levels."""
    STRONG_BUY = "STRONG BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    AVOID = "AVOID"
    INSUFFICIENT_DATA = "INSUFFICIENT DATA"


@dataclass
class Valuations:
    """Valuation metrics for a company."""
    dcf: Optional[float] = None
    pad: Optional[float] = None
    pad_dividend: Optional[float] = None
    book: Optional[float] = None
    market_average: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: round(v, 2) if v is not None else None for k, v in asdict(self).items()}


@dataclass
class MOSScores:
    """Margin of Safety scores."""
    dcf_mos: Optional[float] = None
    pad_mos: Optional[float] = None
    pad_dividend_mos: Optional[float] = None
    book_mos: Optional[float] = None
    market_mos: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: round(v, 3) if v is not None else None for k, v in asdict(self).items()}
    
    def best_mos(self) -> Optional[float]:
        """Return the best (lowest) MoS score."""
        scores = [s for s in [self.dcf_mos, self.pad_mos, self.book_mos, self.market_mos] 
                  if s is not None and s > 0]
        return min(scores) if scores else None


@dataclass
class MOSEEScores:
    """Combined MOSEE scores (MoS * Earnings/Equity)."""
    dcf_mosee: Optional[float] = None
    pad_mosee: Optional[float] = None
    pad_dividend_mosee: Optional[float] = None
    book_mosee: Optional[float] = None
    market_mosee: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: round(v, 4) if v is not None else None for k, v in asdict(self).items()}
    
    def best_mosee(self) -> Optional[float]:
        """Return the best (highest) MOSEE score."""
        scores = [s for s in [self.dcf_mosee, self.pad_mosee, self.book_mosee, self.market_mosee] 
                  if s is not None]
        return max(scores) if scores else None


@dataclass
class CompanyInfo:
    """Basic company information."""
    ticker: str
    name: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    cap_size: Optional[str] = None
    currency: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass 
class MarketData:
    """Market data for a company."""
    current_price: Optional[float] = None
    market_cap: Optional[float] = None
    earnings_per_share: Optional[float] = None
    earnings_equity: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: round(v, 4) if v is not None else None for k, v in asdict(self).items()}


@dataclass
class ConfidenceInfo:
    """Confidence score information."""
    level: str = "LOW"
    score: float = 0
    data_quality_score: float = 0
    metric_consistency_score: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class IntelligenceData:
    """Intelligence report data from MOSEE Intelligence Engine."""
    verdict: str = "INSUFFICIENT DATA"
    quality_score: float = 0
    quality_grade: str = "F"
    margin_of_safety: float = 0
    has_margin_of_safety: bool = False
    buy_below_price: float = 0
    
    # Valuation range
    valuation_conservative: float = 0
    valuation_base: float = 0
    valuation_optimistic: float = 0
    valuation_confidence: str = "LOW"
    
    # Multi-lens perspectives (Graham, Buffett, Lynch, Fisher)
    perspectives: List[Dict[str, Any]] = field(default_factory=list)
    
    # Insights
    strengths: List[str] = field(default_factory=list)
    concerns: List[str] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "verdict": self.verdict,
            "quality_score": round(self.quality_score, 1) if self.quality_score else 0,
            "quality_grade": self.quality_grade,
            "margin_of_safety": round(self.margin_of_safety, 3) if self.margin_of_safety else 0,
            "has_margin_of_safety": self.has_margin_of_safety,
            "buy_below_price": round(self.buy_below_price, 2) if self.buy_below_price else 0,
            "valuation_range": {
                "conservative": round(self.valuation_conservative, 2) if self.valuation_conservative else 0,
                "base": round(self.valuation_base, 2) if self.valuation_base else 0,
                "optimistic": round(self.valuation_optimistic, 2) if self.valuation_optimistic else 0,
                "confidence": self.valuation_confidence
            },
            "perspectives": self.perspectives,
            "strengths": self.strengths,
            "concerns": self.concerns,
            "action_items": self.action_items
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntelligenceData":
        val_range = data.get("valuation_range", {})
        # Handle both nested and flat structures
        if "valuation" in data:
            val_data = data["valuation"]
            if isinstance(val_data, dict):
                val_range = {
                    "conservative": val_data.get("composite_range", {}).get("conservative", 0),
                    "base": val_data.get("composite_range", {}).get("base", 0),
                    "optimistic": val_data.get("composite_range", {}).get("optimistic", 0),
                    "confidence": val_data.get("confidence", "LOW")
                }
        
        # Handle margin_of_safety which can be a dict or a float
        mos_data = data.get("margin_of_safety", {})
        if isinstance(mos_data, dict):
            margin_of_safety = mos_data.get("ratio", 0)
            has_margin_of_safety = mos_data.get("has_mos", False)
            buy_below_price = mos_data.get("buy_below", 0)
        else:
            # It's a float/number
            margin_of_safety = float(mos_data) if mos_data else 0
            has_margin_of_safety = data.get("has_margin_of_safety", margin_of_safety < 0.7 if margin_of_safety else False)
            buy_below_price = data.get("buy_below_price", 0)
        
        # Handle quality which can be a dict or separate fields
        quality_data = data.get("quality", {})
        if isinstance(quality_data, dict):
            quality_score = quality_data.get("score", data.get("quality_score", 0))
            quality_grade = quality_data.get("grade", data.get("quality_grade", "F"))
        else:
            quality_score = data.get("quality_score", 0)
            quality_grade = data.get("quality_grade", "F")
        
        return cls(
            verdict=data.get("verdict", "INSUFFICIENT DATA"),
            quality_score=quality_score,
            quality_grade=quality_grade,
            margin_of_safety=margin_of_safety,
            has_margin_of_safety=has_margin_of_safety,
            buy_below_price=buy_below_price,
            valuation_conservative=val_range.get("conservative", 0) if isinstance(val_range, dict) else 0,
            valuation_base=val_range.get("base", 0) if isinstance(val_range, dict) else 0,
            valuation_optimistic=val_range.get("optimistic", 0) if isinstance(val_range, dict) else 0,
            valuation_confidence=val_range.get("confidence", "LOW") if isinstance(val_range, dict) else "LOW",
            perspectives=data.get("perspectives", []),
            strengths=data.get("strengths", []),
            concerns=data.get("concerns", []),
            action_items=data.get("action_items", [])
        )


@dataclass
class InvestmentProfile:
    """Complete investment profile for a company."""
    
    # Basic info
    company: CompanyInfo
    analysis_date: str
    
    # Scores and valuations
    confidence: ConfidenceInfo
    valuations: Valuations
    mos_scores: MOSScores
    mosee_scores: MOSEEScores
    market_data: MarketData
    
    # Recommendation
    recommendation: str = "INSUFFICIENT DATA"
    recommendation_reasons: List[str] = field(default_factory=list)
    
    # Historical comparison (filled in by history module)
    previous_month: Optional[Dict[str, Any]] = None
    month_over_month_change: Optional[Dict[str, Any]] = None
    
    # Ranking info
    rank: Optional[int] = None
    percentile: Optional[float] = None
    
    # NEW: Intelligence Report Data
    intelligence: Optional[IntelligenceData] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert profile to dictionary."""
        result = {
            "ticker": self.company.ticker,
            "company": self.company.to_dict(),
            "analysis_date": self.analysis_date,
            "confidence": self.confidence.to_dict(),
            "valuations": self.valuations.to_dict(),
            "mos_scores": self.mos_scores.to_dict(),
            "mosee_scores": self.mosee_scores.to_dict(),
            "market_data": self.market_data.to_dict(),
            "recommendation": self.recommendation,
            "recommendation_reasons": self.recommendation_reasons,
            "previous_month": self.previous_month,
            "month_over_month_change": self.month_over_month_change,
            "rank": self.rank,
            "percentile": self.percentile,
        }
        # Add intelligence data if available
        if self.intelligence:
            result["intelligence"] = self.intelligence.to_dict()
        return result
    
    def to_json(self, indent: int = 2) -> str:
        """Convert profile to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InvestmentProfile":
        """Create profile from dictionary."""
        # Parse intelligence data if present
        intelligence = None
        if "intelligence" in data:
            intelligence = IntelligenceData.from_dict(data["intelligence"])
        elif "intelligence_report" in data:
            intelligence = IntelligenceData.from_dict(data["intelligence_report"])
        
        return cls(
            company=CompanyInfo(**data.get("company", {"ticker": data.get("ticker", "UNKNOWN")})),
            analysis_date=data.get("analysis_date", datetime.now().strftime("%Y-%m-%d")),
            confidence=ConfidenceInfo(**data.get("confidence", {})),
            valuations=Valuations(**{k: v for k, v in data.get("valuations", {}).items() if v is not None}),
            mos_scores=MOSScores(**{k: v for k, v in data.get("mos_scores", {}).items() if v is not None}),
            mosee_scores=MOSEEScores(**{k: v for k, v in data.get("mosee_scores", {}).items() if v is not None}),
            market_data=MarketData(**{k: v for k, v in data.get("market_data", {}).items() if v is not None}),
            recommendation=data.get("recommendation", "INSUFFICIENT DATA"),
            recommendation_reasons=data.get("recommendation_reasons", []),
            previous_month=data.get("previous_month"),
            month_over_month_change=data.get("month_over_month_change"),
            rank=data.get("rank"),
            percentile=data.get("percentile"),
            intelligence=intelligence
        )


def determine_recommendation(
    confidence_level: str,
    pad_mos: Optional[float],
    dcf_mos: Optional[float],
    earnings_equity: Optional[float]
) -> tuple[str, List[str]]:
    """
    Determine investment recommendation based on metrics.
    
    Criteria:
    - MoS < 0.5 indicates buying $1 for less than $0.50 (good)
    - MoS < 0.3 indicates exceptional value
    - Earnings/Equity > 0.1 indicates good returns
    
    Returns:
        Tuple of (recommendation, list of reasons)
    """
    reasons = []
    
    # Insufficient data check
    if confidence_level == "LOW":
        reasons.append("Low confidence in data quality")
        return Recommendation.INSUFFICIENT_DATA.value, reasons
    
    if pad_mos is None and dcf_mos is None:
        reasons.append("No valuation metrics available")
        return Recommendation.INSUFFICIENT_DATA.value, reasons
    
    # Use PAD MoS as primary (or DCF if PAD not available)
    primary_mos = pad_mos if pad_mos is not None else dcf_mos
    
    # Scoring system
    score = 0
    
    # MoS scoring
    if primary_mos is not None:
        if primary_mos < 0:
            reasons.append(f"Negative MoS ({primary_mos:.2f}) - potential issues")
            score -= 2
        elif primary_mos < 0.3:
            reasons.append(f"Exceptional value: MoS of {primary_mos:.2f} (buying $1 for ${primary_mos:.2f})")
            score += 3
        elif primary_mos < 0.5:
            reasons.append(f"Good value: MoS of {primary_mos:.2f} (buying $1 for ${primary_mos:.2f})")
            score += 2
        elif primary_mos < 0.75:
            reasons.append(f"Fair value: MoS of {primary_mos:.2f}")
            score += 1
        elif primary_mos < 1.0:
            reasons.append(f"Slight premium: MoS of {primary_mos:.2f}")
            score += 0
        else:
            reasons.append(f"Overvalued: MoS of {primary_mos:.2f} (paying ${primary_mos:.2f} for $1)")
            score -= 1
    
    # Earnings/Equity scoring
    if earnings_equity is not None:
        if earnings_equity > 0.15:
            reasons.append(f"Strong earnings yield: {earnings_equity:.1%} per dollar equity")
            score += 2
        elif earnings_equity > 0.1:
            reasons.append(f"Good earnings yield: {earnings_equity:.1%} per dollar equity")
            score += 1
        elif earnings_equity > 0.05:
            reasons.append(f"Moderate earnings yield: {earnings_equity:.1%}")
            score += 0
        elif earnings_equity > 0:
            reasons.append(f"Low earnings yield: {earnings_equity:.1%}")
            score -= 1
        else:
            reasons.append(f"Negative earnings: {earnings_equity:.1%}")
            score -= 2
    
    # Confidence adjustment
    if confidence_level == "HIGH":
        reasons.append("High confidence in analysis")
        score += 1
    
    # Map score to recommendation
    if score >= 4:
        return Recommendation.STRONG_BUY.value, reasons
    elif score >= 2:
        return Recommendation.BUY.value, reasons
    elif score >= 0:
        return Recommendation.HOLD.value, reasons
    elif score >= -2:
        return Recommendation.SELL.value, reasons
    else:
        return Recommendation.AVOID.value, reasons


def build_profile(
    ticker: str,
    analysis_data: Dict[str, Any],
    ticker_info: Optional[Dict[str, Any]] = None,
    confidence_info: Optional[Dict[str, Any]] = None
) -> InvestmentProfile:
    """
    Build an investment profile from analysis data.
    
    Args:
        ticker: Stock ticker symbol
        analysis_data: Dictionary with analysis results (from create_MOSEE_df output)
        ticker_info: Optional additional ticker information
        confidence_info: Optional confidence score information
        
    Returns:
        InvestmentProfile object
    """
    ticker_info = ticker_info or {}
    confidence_info = confidence_info or {"level": "LOW", "score": 0}
    
    # Build company info
    company = CompanyInfo(
        ticker=ticker,
        name=ticker_info.get("name"),
        country=ticker_info.get("country"),
        industry=ticker_info.get("industry"),
        cap_size=ticker_info.get("cap"),
        currency=ticker_info.get("currency")
    )
    
    # Build confidence info
    confidence = ConfidenceInfo(
        level=confidence_info.get("level", "LOW"),
        score=confidence_info.get("score", 0),
        data_quality_score=confidence_info.get("data_quality_score", 0),
        metric_consistency_score=confidence_info.get("metric_consistency_score", 0)
    )
    
    # Build valuations
    valuations = Valuations(
        dcf=analysis_data.get("DCF Value"),
        pad=analysis_data.get("PAD Value"),
        pad_dividend=analysis_data.get("PAD Dividend Value"),
        book=analysis_data.get("Book Value"),
        market_average=analysis_data.get("Average Market Price")
    )
    
    # Build MoS scores
    mos_scores = MOSScores(
        dcf_mos=analysis_data.get("DCF MoS"),
        pad_mos=analysis_data.get("PAD MoS"),
        pad_dividend_mos=analysis_data.get("Pad Dividend MoS"),
        book_mos=analysis_data.get("Book MoS"),
        market_mos=analysis_data.get("Market MoS")
    )
    
    # Build MOSEE scores
    mosee_scores = MOSEEScores(
        dcf_mosee=analysis_data.get("DCF MOSEE"),
        pad_mosee=analysis_data.get("PAD MOSEE"),
        pad_dividend_mosee=analysis_data.get("Pad Dividend MOSEE"),
        book_mosee=analysis_data.get("Book MOSEE"),
        market_mosee=analysis_data.get("Market MOSEE")
    )
    
    # Build market data
    market_data = MarketData(
        current_price=analysis_data.get("Current Price"),
        market_cap=analysis_data.get("Market Cap"),
        earnings_equity=analysis_data.get("Earnings per Dollar Equity")
    )
    
    # Build intelligence data if available
    intelligence = None
    intel_report = analysis_data.get("intelligence_report")
    if intel_report:
        intelligence = IntelligenceData.from_dict(intel_report)
    
    # Determine recommendation - use intelligence verdict if available
    if intelligence and intelligence.verdict != "INSUFFICIENT DATA":
        recommendation = intelligence.verdict
        reasons = []
        if intelligence.strengths:
            reasons.extend([f"Strength: {s}" for s in intelligence.strengths[:2]])
        if intelligence.concerns:
            reasons.extend([f"Concern: {c}" for c in intelligence.concerns[:2]])
        if not reasons:
            reasons = [f"Quality: {intelligence.quality_grade} ({intelligence.quality_score:.0f}/100)"]
    else:
        recommendation, reasons = determine_recommendation(
            confidence.level,
            mos_scores.pad_mos,
            mos_scores.dcf_mos,
            market_data.earnings_equity
        )
    
    return InvestmentProfile(
        company=company,
        analysis_date=datetime.now().strftime("%Y-%m-%d"),
        confidence=confidence,
        valuations=valuations,
        mos_scores=mos_scores,
        mosee_scores=mosee_scores,
        market_data=market_data,
        recommendation=recommendation,
        recommendation_reasons=reasons,
        intelligence=intelligence
    )


def rank_profiles(profiles: List[InvestmentProfile], sort_by: str = "pad_mosee") -> List[InvestmentProfile]:
    """
    Rank profiles by a specific metric.
    
    Args:
        profiles: List of investment profiles
        sort_by: Metric to sort by (pad_mosee, dcf_mosee, pad_mos, etc.)
        
    Returns:
        Sorted list of profiles with rank and percentile filled in
    """
    def get_sort_value(profile: InvestmentProfile) -> float:
        if sort_by == "pad_mosee":
            return profile.mosee_scores.pad_mosee or float('-inf')
        elif sort_by == "dcf_mosee":
            return profile.mosee_scores.dcf_mosee or float('-inf')
        elif sort_by == "pad_mos":
            # Lower is better for MoS, so we negate
            val = profile.mos_scores.pad_mos
            return -val if val is not None and val > 0 else float('inf')
        elif sort_by == "confidence":
            return profile.confidence.score
        else:
            return profile.mosee_scores.pad_mosee or float('-inf')
    
    # Sort (higher is better for MOSEE, so reverse=True)
    reverse = sort_by not in ["pad_mos", "dcf_mos", "book_mos", "market_mos"]
    sorted_profiles = sorted(profiles, key=get_sort_value, reverse=reverse)
    
    # Assign ranks and percentiles
    total = len(sorted_profiles)
    for i, profile in enumerate(sorted_profiles):
        profile.rank = i + 1
        profile.percentile = round((total - i) / total * 100, 1)
    
    return sorted_profiles
