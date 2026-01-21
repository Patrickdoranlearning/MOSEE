"""
MOSEE Intelligence Module - The Smart Investment Analysis Engine

This module brings together all the investment book wisdom into a cohesive
intelligent system that:

1. Calculates RANGE-based valuations (not single points)
2. Adjusts fair value based on quality (Buffett/Munger)
3. Always requires margin of safety (Graham/Klarman)
4. Provides multi-lens perspective (Graham, Buffett, Lynch, Fisher)
5. Generates actionable, contextual insights

Key Principle (Buffett): "Price is what you pay, value is what you get"
- We must estimate VALUE (a range)
- We must demand MARGIN OF SAFETY (price below conservative value)
- Quality affects what value IS, but doesn't remove need for MoS
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum

from .valuation_range import (
    CompositeValuationRange,
    build_composite_valuation,
    ValueConfidence
)
from .scoring.composite_score import (
    calculate_composite_score,
    InvestmentStyle,
    CompositeScore
)


class InvestmentVerdict(Enum):
    """Final investment verdict."""
    STRONG_BUY = "STRONG BUY"           # MoS + Quality
    BUY = "BUY"                          # Good MoS, acceptable quality
    ACCUMULATE = "ACCUMULATE"            # Decent MoS, building position
    HOLD = "HOLD"                        # Fair value, no action needed
    WATCHLIST = "WATCHLIST"              # Quality but no MoS - wait
    REDUCE = "REDUCE"                    # Overvalued, trim position
    SELL = "SELL"                        # Significantly overvalued
    AVOID = "AVOID"                      # Poor quality or very overvalued
    INSUFFICIENT_DATA = "INSUFFICIENT DATA"


@dataclass
class InvestmentLens:
    """Single perspective on the investment."""
    philosopher: str          # Graham, Buffett, Lynch, Fisher
    score: float             # 0-100
    grade: str               # A-F
    key_metric: str          # What this lens focuses on
    verdict: str             # Buy/Hold/Sell from this perspective
    insight: str             # Explanation
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "philosopher": self.philosopher,
            "score": self.score,
            "grade": self.grade,
            "key_metric": self.key_metric,
            "verdict": self.verdict,
            "insight": self.insight
        }


@dataclass
class MOSEEIntelligenceReport:
    """
    Complete MOSEE Intelligence Report for a stock.
    
    This is the output of the intelligent analysis system,
    combining all perspectives into actionable insight.
    """
    ticker: str
    current_price: float
    
    # Range-based valuation
    valuation: CompositeValuationRange
    
    # Quality assessment
    quality_score: float
    quality_grade: str
    
    # Margin of Safety
    margin_of_safety: float
    has_margin_of_safety: bool
    buy_below_price: float
    
    # Multi-lens perspectives
    lenses: List[InvestmentLens]
    
    # Final verdict
    verdict: InvestmentVerdict
    recommendation: str
    confidence: str
    
    # Actionable insights
    strengths: List[str]
    concerns: List[str]
    action_items: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "current_price": self.current_price,
            "valuation": self.valuation.to_dict(),
            "quality": {
                "score": self.quality_score,
                "grade": self.quality_grade
            },
            "margin_of_safety": {
                "ratio": round(self.margin_of_safety, 3),
                "has_mos": self.has_margin_of_safety,
                "buy_below": self.buy_below_price
            },
            "perspectives": [l.to_dict() for l in self.lenses],
            "verdict": self.verdict.value,
            "recommendation": self.recommendation,
            "confidence": self.confidence,
            "strengths": self.strengths,
            "concerns": self.concerns,
            "action_items": self.action_items
        }
    
    def summary(self) -> str:
        """Generate human-readable summary."""
        lines = [
            f"{'='*60}",
            f"MOSEE INTELLIGENCE REPORT: {self.ticker}",
            f"{'='*60}",
            f"",
            f"CURRENT PRICE: ${self.current_price:.2f}",
            f"",
            f"VALUATION RANGE:",
            f"  Conservative: ${self.valuation.composite_conservative:.2f}",
            f"  Base:         ${self.valuation.composite_base:.2f}",
            f"  Optimistic:   ${self.valuation.composite_optimistic:.2f}",
            f"",
            f"QUALITY: {self.quality_grade} ({self.quality_score:.0f}/100)",
            f"",
            f"MARGIN OF SAFETY: {self.margin_of_safety:.1%} of conservative value",
            f"  {'✓ Has adequate margin of safety' if self.has_margin_of_safety else '✗ NO margin of safety'}",
            f"  Buy below: ${self.buy_below_price:.2f}",
            f"",
            f"VERDICT: {self.verdict.value}",
            f"",
            f"MULTI-LENS PERSPECTIVES:",
        ]
        
        for lens in self.lenses:
            lines.append(f"  {lens.philosopher}: {lens.grade} - {lens.verdict}")
            lines.append(f"    {lens.insight}")
        
        lines.extend([
            f"",
            f"STRENGTHS:",
            *[f"  + {s}" for s in self.strengths],
            f"",
            f"CONCERNS:",
            *[f"  - {c}" for c in self.concerns],
            f"",
            f"ACTION ITEMS:",
            *[f"  → {a}" for a in self.action_items],
            f"",
            f"{'='*60}",
        ])
        
        return "\n".join(lines)


def _calculate_quality_grade(score: float) -> str:
    """Convert quality score to letter grade."""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 50:
        return "D"
    else:
        return "F"


def _create_graham_lens(metrics: Dict[str, Any], mos: float) -> InvestmentLens:
    """Create Graham's perspective on the investment."""
    graham_score = metrics.get('graham_score', 0)
    pe = metrics.get('pe_ratio')
    pb = metrics.get('pb_ratio')
    
    # Graham verdict based on defensive criteria and MoS
    if graham_score >= 5 and mos <= 0.7:
        verdict = "Strong Buy"
        grade = "A"
    elif graham_score >= 4 and mos <= 0.85:
        verdict = "Buy"
        grade = "B"
    elif graham_score >= 3 and mos <= 1.0:
        verdict = "Hold"
        grade = "C"
    else:
        verdict = "Avoid"
        grade = "D" if graham_score >= 2 else "F"
    
    score = (graham_score / 7 * 50) + ((1 - min(mos, 2) / 2) * 50)
    
    insight = f"Passes {graham_score}/7 defensive criteria."
    if pe and pe <= 15:
        insight += f" P/E of {pe:.1f} is attractive."
    elif pe and pe > 25:
        insight += f" P/E of {pe:.1f} is expensive by Graham standards."
    
    return InvestmentLens(
        philosopher="Graham",
        score=score,
        grade=grade,
        key_metric=f"Defensive Score: {graham_score}/7",
        verdict=verdict,
        insight=insight
    )


def _create_buffett_lens(metrics: Dict[str, Any], quality_score: float) -> InvestmentLens:
    """Create Buffett's perspective on the investment."""
    roe = metrics.get('roe', 0)
    roic = metrics.get('roic', 0)
    debt_to_equity = metrics.get('debt_to_equity', 1)
    owner_earnings_yield = metrics.get('owner_earnings_yield', 0)
    
    # Buffett cares about quality first
    buffett_score = quality_score
    
    if roe >= 0.15 and roic >= 0.12 and debt_to_equity < 0.5:
        verdict = "Quality Business"
        grade = "A" if buffett_score >= 75 else "B"
        insight = f"Excellent economics: ROE {roe:.1%}, ROIC {roic:.1%}, manageable debt."
    elif roe >= 0.12 and roic >= 0.10:
        verdict = "Good Business"
        grade = "B" if buffett_score >= 60 else "C"
        insight = f"Good economics: ROE {roe:.1%}, ROIC {roic:.1%}."
    else:
        verdict = "Mediocre Business"
        grade = "C" if roe >= 0.08 else "D"
        insight = f"Average economics: ROE {roe:.1%}. Buffett would want better."
    
    return InvestmentLens(
        philosopher="Buffett",
        score=buffett_score,
        grade=grade,
        key_metric=f"ROE: {roe:.1%}, ROIC: {roic:.1%}",
        verdict=verdict,
        insight=insight
    )


def _create_lynch_lens(metrics: Dict[str, Any]) -> InvestmentLens:
    """Create Lynch's perspective on the investment."""
    peg = metrics.get('peg_ratio')
    growth = metrics.get('earnings_growth', 0)
    category = metrics.get('lynch_category', 'Unknown')
    
    if peg is None or peg <= 0:
        return InvestmentLens(
            philosopher="Lynch",
            score=50,
            grade="C",
            key_metric="PEG: N/A",
            verdict="Cannot Assess",
            insight="Insufficient data for PEG analysis."
        )
    
    # Lynch loved PEG < 1
    if peg < 0.5:
        verdict = "Strong Buy"
        grade = "A"
        score = 95
        insight = f"Exceptional PEG of {peg:.2f}. Growth of {growth:.1%} at a bargain price."
    elif peg < 1.0:
        verdict = "Buy"
        grade = "B"
        score = 80
        insight = f"Good PEG of {peg:.2f}. Reasonable price for {growth:.1%} growth."
    elif peg < 1.5:
        verdict = "Fair"
        grade = "C"
        score = 60
        insight = f"PEG of {peg:.2f} is fair. Not a bargain, but not overpriced."
    elif peg < 2.0:
        verdict = "Expensive"
        grade = "D"
        score = 40
        insight = f"PEG of {peg:.2f} suggests overvaluation relative to growth."
    else:
        verdict = "Avoid"
        grade = "F"
        score = 20
        insight = f"PEG of {peg:.2f} is too high. Price doesn't justify growth."
    
    return InvestmentLens(
        philosopher="Lynch",
        score=score,
        grade=grade,
        key_metric=f"PEG: {peg:.2f} ({category})",
        verdict=verdict,
        insight=insight
    )


def _create_fisher_lens(metrics: Dict[str, Any]) -> InvestmentLens:
    """Create Fisher's perspective on the investment."""
    sales_cagr = metrics.get('sales_cagr', 0)
    margin_trend = metrics.get('margin_trend', 'Unknown')
    growth_quality = metrics.get('growth_quality_score', 50)
    
    score = growth_quality
    
    if sales_cagr >= 0.15 and margin_trend == "Improving":
        verdict = "Excellent Growth"
        grade = "A"
        insight = f"Strong {sales_cagr:.1%} sales growth with improving margins. Fisher ideal."
    elif sales_cagr >= 0.10:
        verdict = "Good Growth"
        grade = "B" if margin_trend != "Declining" else "C"
        insight = f"Solid {sales_cagr:.1%} sales growth. Margins are {margin_trend.lower()}."
    elif sales_cagr >= 0.05:
        verdict = "Moderate Growth"
        grade = "C"
        insight = f"Moderate {sales_cagr:.1%} growth. Fisher would want more."
    else:
        verdict = "Slow/No Growth"
        grade = "D" if sales_cagr > 0 else "F"
        insight = f"Minimal growth ({sales_cagr:.1%}). Not a Fisher-style investment."
    
    return InvestmentLens(
        philosopher="Fisher",
        score=score,
        grade=grade,
        key_metric=f"Sales CAGR: {sales_cagr:.1%}",
        verdict=verdict,
        insight=insight
    )


def _determine_verdict(
    has_mos: bool,
    quality_score: float,
    mos_ratio: float,
    confidence: str
) -> InvestmentVerdict:
    """
    Determine final investment verdict.
    
    Key principle: ALWAYS require margin of safety.
    Quality affects what we're willing to pay, but doesn't remove MoS requirement.
    """
    is_quality = quality_score >= 65
    
    if confidence == "SPECULATIVE":
        return InvestmentVerdict.INSUFFICIENT_DATA
    
    if has_mos:  # Price below conservative value
        if mos_ratio <= 0.5:
            return InvestmentVerdict.STRONG_BUY if is_quality else InvestmentVerdict.BUY
        elif mos_ratio <= 0.7:
            return InvestmentVerdict.BUY if is_quality else InvestmentVerdict.ACCUMULATE
        else:  # mos 0.7-1.0
            return InvestmentVerdict.ACCUMULATE if is_quality else InvestmentVerdict.HOLD
    else:  # No margin of safety
        if mos_ratio <= 1.15:  # Slightly overvalued
            if is_quality:
                return InvestmentVerdict.WATCHLIST  # Good company, wait for better price
            else:
                return InvestmentVerdict.HOLD
        elif mos_ratio <= 1.5:
            return InvestmentVerdict.REDUCE if not is_quality else InvestmentVerdict.HOLD
        else:  # Significantly overvalued
            return InvestmentVerdict.SELL if not is_quality else InvestmentVerdict.REDUCE


def _generate_action_items(
    verdict: InvestmentVerdict,
    buy_below: float,
    current_price: float,
    ticker: str
) -> List[str]:
    """Generate specific action items based on verdict."""
    items = []
    
    if verdict in [InvestmentVerdict.STRONG_BUY, InvestmentVerdict.BUY]:
        items.append(f"Consider initiating or adding to position in {ticker}")
        items.append("Review position sizing relative to portfolio")
    
    elif verdict == InvestmentVerdict.ACCUMULATE:
        items.append(f"Consider small position or adding on further weakness")
        items.append(f"Set alert for price drops below ${buy_below:.2f}")
    
    elif verdict == InvestmentVerdict.WATCHLIST:
        items.append(f"Add to watchlist - quality company but needs better price")
        items.append(f"Set price alert at ${buy_below:.2f} for margin of safety")
        items.append("Monitor quarterly results for any deterioration")
    
    elif verdict == InvestmentVerdict.HOLD:
        items.append("No action needed if already owned")
        items.append("Do not add at current prices")
    
    elif verdict == InvestmentVerdict.REDUCE:
        items.append("Consider trimming position if significantly overweight")
        items.append("Lock in some profits if position has appreciated substantially")
    
    elif verdict == InvestmentVerdict.SELL:
        items.append("Consider exiting position - overvalued with insufficient quality")
        items.append("Reallocate capital to better opportunities")
    
    elif verdict == InvestmentVerdict.AVOID:
        items.append("Do not invest - poor risk/reward")
    
    return items


def generate_mosee_intelligence(
    ticker: str,
    current_price: float,
    metrics: Dict[str, Any],
    required_mos: float = 0.7
) -> MOSEEIntelligenceReport:
    """
    Generate complete MOSEE Intelligence Report.
    
    This is the main entry point for intelligent analysis.
    
    Args:
        ticker: Stock ticker symbol
        current_price: Current stock price
        metrics: Dictionary containing all calculated metrics
        required_mos: Required margin of safety (default 0.7 = 30% discount)
        
    Returns:
        MOSEEIntelligenceReport with full analysis
    """
    # Calculate quality score using composite scoring
    composite = calculate_composite_score(ticker, metrics, InvestmentStyle.BALANCED)
    quality_score = composite.total_score
    quality_grade = _calculate_quality_grade(quality_score)
    
    # Build range-based valuation
    valuation_metrics = {
        'eps': metrics.get('eps', 0),
        'book_value_per_share': metrics.get('book_value_per_share', 0),
        'roe': metrics.get('roe', 0.10),
        'earnings_growth': metrics.get('earnings_growth', 0.05),
        'free_cash_flow': metrics.get('free_cash_flow', 0),
        'owner_earnings_per_share': metrics.get('owner_earnings_per_share', 0),
        'shares_outstanding': metrics.get('shares_outstanding', 1),
        'industry_pe': metrics.get('industry_pe', 15)
    }
    
    valuation = build_composite_valuation(ticker, valuation_metrics, quality_score)
    
    # Calculate margin of safety
    mos_ratio = valuation.margin_of_safety(current_price)
    has_mos = mos_ratio <= required_mos
    buy_below = valuation.composite_conservative * required_mos
    
    # Create multi-lens perspectives
    lenses = [
        _create_graham_lens(metrics, mos_ratio),
        _create_buffett_lens(metrics, quality_score),
        _create_lynch_lens(metrics),
        _create_fisher_lens(metrics)
    ]
    
    # Determine verdict
    verdict = _determine_verdict(
        has_mos, 
        quality_score, 
        mos_ratio,
        valuation.composite_confidence.value
    )
    
    # Generate recommendation text
    if verdict == InvestmentVerdict.STRONG_BUY:
        recommendation = f"Strong Buy - Quality business with excellent margin of safety"
    elif verdict == InvestmentVerdict.BUY:
        recommendation = f"Buy - Good value with adequate margin of safety"
    elif verdict == InvestmentVerdict.ACCUMULATE:
        recommendation = f"Accumulate - Building position, decent risk/reward"
    elif verdict == InvestmentVerdict.WATCHLIST:
        recommendation = f"Watchlist - Quality company, wait for price below ${buy_below:.2f}"
    elif verdict == InvestmentVerdict.HOLD:
        recommendation = f"Hold - Fair value, no action needed"
    elif verdict == InvestmentVerdict.REDUCE:
        recommendation = f"Reduce - Overvalued, consider trimming"
    elif verdict == InvestmentVerdict.SELL:
        recommendation = f"Sell - Significantly overvalued"
    elif verdict == InvestmentVerdict.AVOID:
        recommendation = f"Avoid - Poor risk/reward profile"
    else:
        recommendation = "Insufficient data for recommendation"
    
    # Identify strengths and concerns
    strengths = []
    concerns = []
    
    if quality_score >= 70:
        strengths.append(f"High quality business (score: {quality_score:.0f})")
    if metrics.get('roe', 0) >= 0.15:
        strengths.append(f"Strong ROE of {metrics['roe']:.1%}")
    if metrics.get('roic', 0) >= 0.12:
        strengths.append(f"Excellent ROIC of {metrics['roic']:.1%}")
    if has_mos:
        strengths.append(f"Trading with margin of safety ({mos_ratio:.0%} of conservative value)")
    if metrics.get('peg_ratio') and metrics['peg_ratio'] < 1:
        strengths.append(f"Attractive PEG ratio of {metrics['peg_ratio']:.2f}")
    if metrics.get('interest_coverage', 0) >= 5:
        strengths.append("Strong interest coverage - low debt risk")
    
    if not has_mos:
        concerns.append(f"No margin of safety - trading at {mos_ratio:.0%} of conservative value")
    if quality_score < 50:
        concerns.append(f"Below average quality (score: {quality_score:.0f})")
    if metrics.get('debt_to_equity', 0) > 1:
        concerns.append(f"High debt to equity: {metrics['debt_to_equity']:.2f}")
    if metrics.get('roe', 0) < 0.10:
        concerns.append(f"Low ROE of {metrics.get('roe', 0):.1%}")
    if metrics.get('earnings_growth', 0) < 0:
        concerns.append("Declining earnings")
    
    # Generate action items
    action_items = _generate_action_items(verdict, buy_below, current_price, ticker)
    
    return MOSEEIntelligenceReport(
        ticker=ticker,
        current_price=current_price,
        valuation=valuation,
        quality_score=quality_score,
        quality_grade=quality_grade,
        margin_of_safety=mos_ratio,
        has_margin_of_safety=has_mos,
        buy_below_price=buy_below,
        lenses=lenses,
        verdict=verdict,
        recommendation=recommendation,
        confidence=valuation.composite_confidence.value,
        strengths=strengths,
        concerns=concerns,
        action_items=action_items
    )
