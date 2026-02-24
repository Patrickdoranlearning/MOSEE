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

    # Transparency data
    verdict_rationale: Dict[str, Any] = field(default_factory=dict)
    quality_breakdown: Dict[str, Any] = field(default_factory=dict)
    
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
            "action_items": self.action_items,
            "verdict_rationale": self.verdict_rationale,
            "quality_breakdown": self.quality_breakdown
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
    """
    Create Buffett's perspective on the investment.

    Buffett looks for:
    1. Durable competitive advantage (moat)
    2. Consistent high ROE (>15%)
    3. Strong ROIC (>12%)
    4. Manageable debt
    5. Quality management

    Note: Some great businesses like Berkshire itself may not fit standard
    metrics due to unique accounting or capital structure.
    """
    roe = metrics.get('roe', 0)
    roic = metrics.get('roic', 0)
    debt_to_equity = metrics.get('debt_to_equity', 1)
    owner_earnings_yield = metrics.get('owner_earnings_yield', 0)
    interest_coverage = metrics.get('interest_coverage', 0)

    # Buffett cares about quality first
    buffett_score = quality_score

    # Calculate a Buffett-specific quality score based on his key metrics
    buffett_quality_points = 0

    # ROE contribution (max 30 points)
    if roe >= 0.20:
        buffett_quality_points += 30
    elif roe >= 0.15:
        buffett_quality_points += 25
    elif roe >= 0.12:
        buffett_quality_points += 18
    elif roe >= 0.10:
        buffett_quality_points += 12

    # ROIC contribution (max 25 points)
    if roic >= 0.20:
        buffett_quality_points += 25
    elif roic >= 0.15:
        buffett_quality_points += 20
    elif roic >= 0.12:
        buffett_quality_points += 15
    elif roic >= 0.10:
        buffett_quality_points += 10

    # Debt management contribution (max 20 points)
    if debt_to_equity <= 0.3:
        buffett_quality_points += 20
    elif debt_to_equity <= 0.5:
        buffett_quality_points += 15
    elif debt_to_equity <= 1.0:
        buffett_quality_points += 10
    elif debt_to_equity <= 1.5:
        buffett_quality_points += 5

    # Interest coverage contribution (max 15 points)
    if interest_coverage >= 10:
        buffett_quality_points += 15
    elif interest_coverage >= 5:
        buffett_quality_points += 12
    elif interest_coverage >= 3:
        buffett_quality_points += 8
    elif interest_coverage >= 1.5:
        buffett_quality_points += 4

    # Owner earnings yield contribution (max 10 points)
    if owner_earnings_yield >= 0.10:
        buffett_quality_points += 10
    elif owner_earnings_yield >= 0.07:
        buffett_quality_points += 8
    elif owner_earnings_yield >= 0.05:
        buffett_quality_points += 5

    # Use the higher of composite score or Buffett-specific score
    buffett_score = max(quality_score, buffett_quality_points)

    # Determine verdict and grade based on Buffett quality points
    if buffett_quality_points >= 75:
        verdict = "Quality Business"
        grade = "A"
        insight = f"Excellent economics: ROE {roe:.1%}, ROIC {roic:.1%}, manageable debt. Buffett's ideal."
    elif buffett_quality_points >= 60:
        verdict = "Quality Business"
        grade = "B"
        insight = f"Strong economics: ROE {roe:.1%}, ROIC {roic:.1%}. Good Buffett candidate."
    elif buffett_quality_points >= 45:
        verdict = "Good Business"
        grade = "C"
        insight = f"Solid economics: ROE {roe:.1%}, ROIC {roic:.1%}. Acceptable but not exceptional."
    else:
        verdict = "Mediocre Business"
        grade = "D" if buffett_quality_points >= 25 else "F"
        insight = f"Weak economics: ROE {roe:.1%}. Buffett would likely pass."

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

    # Negative growth makes PEG meaningless — Lynch wouldn't use PEG here
    if growth < 0:
        return InvestmentLens(
            philosopher="Lynch",
            score=30,
            grade="D",
            key_metric=f"Growth: {growth:.1%}",
            verdict="Declining Earnings",
            insight=f"Earnings declining at {growth:.1%}. Lynch wouldn't use PEG for declining companies."
        )

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
    confidence: str,
    mosee_score: float = None,
    years_to_payback: float = None
) -> tuple:
    """
    Determine final investment verdict with rationale.

    Key principles:
    1. ALWAYS require margin of safety.
    2. Quality affects what we're willing to pay, but doesn't remove MoS requirement.
    3. MOSEE score and years to payback are critical - high payback years = poor investment.

    MOSEE thresholds:
    - >= 0.15: Excellent (undervalued + strong earnings)
    - >= 0.10: Good
    - >= 0.05: Fair
    - < 0.05: Below Average - NEVER buy regardless of MoS

    Years to payback thresholds:
    - <= 15: Excellent
    - <= 25: Good
    - <= 50: Fair
    - > 50: Poor - NEVER buy regardless of MoS

    Returns:
        Tuple of (InvestmentVerdict, rationale_dict)
    """
    is_quality = quality_score >= 65

    # Build rationale as we go through each gate
    gates = []
    thresholds = {
        "mosee_min": 0.05,
        "payback_max": 50,
        "mos_required": 0.70,
        "quality_min": 65,
        "strong_buy_mos": 0.50,
        "buy_mos": 0.70,
    }

    # Gate 1: Data Quality
    if confidence == "SPECULATIVE":
        gates.append({
            "gate": "Data Quality",
            "passed": False,
            "detail": f"Confidence is SPECULATIVE — insufficient data for analysis"
        })
        rationale = {
            "gates": gates,
            "thresholds": thresholds,
            "summary": "INSUFFICIENT DATA: Confidence level is SPECULATIVE. Not enough reliable data to make a recommendation."
        }
        return InvestmentVerdict.INSUFFICIENT_DATA, rationale

    gates.append({
        "gate": "Data Quality",
        "passed": True,
        "detail": f"Confidence: {confidence} (not SPECULATIVE)"
    })

    # Gate 2: Earnings Power
    has_poor_earnings_power = False
    earnings_details = []

    if mosee_score is not None and mosee_score < 0.05:
        has_poor_earnings_power = True
        earnings_details.append(f"MOSEE score {mosee_score:.3f} < 0.05 threshold")

    if years_to_payback is not None and years_to_payback > 50:
        has_poor_earnings_power = True
        earnings_details.append(f"Years to payback {years_to_payback:.0f} > 50 year threshold")

    if has_poor_earnings_power:
        gates.append({
            "gate": "Earnings Power",
            "passed": False,
            "detail": "; ".join(earnings_details) + " — poor earnings power blocks any BUY rating"
        })
    else:
        ep_parts = []
        if mosee_score is not None:
            ep_parts.append(f"MOSEE {mosee_score:.3f} >= 0.05")
        if years_to_payback is not None:
            ep_parts.append(f"payback {years_to_payback:.1f} yrs <= 50")
        gates.append({
            "gate": "Earnings Power",
            "passed": True,
            "detail": ", ".join(ep_parts) if ep_parts else "Acceptable earnings power"
        })

    # If poor earnings power, downgrade verdict significantly
    if has_poor_earnings_power:
        if mos_ratio <= 1.0:
            verdict = InvestmentVerdict.WATCHLIST if is_quality else InvestmentVerdict.HOLD
            gates.append({
                "gate": "Margin of Safety",
                "passed": True,
                "detail": f"MoS ratio {mos_ratio:.2f} <= 1.00 (trading below intrinsic value)"
            })
            gates.append({
                "gate": "Quality Check",
                "passed": is_quality,
                "detail": f"Quality score {quality_score:.0f} {'≥' if is_quality else '<'} 65"
            })
            summary = f"{verdict.value}: {'Quality company' if is_quality else 'Company'} (score {quality_score:.0f}) but poor earnings power ({'; '.join(earnings_details)}). Even with margin of safety, earnings are too low to justify a BUY."
        elif mos_ratio <= 1.5:
            verdict = InvestmentVerdict.REDUCE
            gates.append({
                "gate": "Margin of Safety",
                "passed": False,
                "detail": f"MoS ratio {mos_ratio:.2f} — no margin of safety"
            })
            summary = f"REDUCE: Poor earnings power combined with no margin of safety (MoS {mos_ratio:.0%}). Consider trimming."
        else:
            verdict = InvestmentVerdict.SELL if not is_quality else InvestmentVerdict.REDUCE
            gates.append({
                "gate": "Margin of Safety",
                "passed": False,
                "detail": f"MoS ratio {mos_ratio:.2f} — significantly overvalued"
            })
            summary = f"{verdict.value}: Poor earnings power and significantly overvalued (MoS {mos_ratio:.0%})."

        rationale = {"gates": gates, "thresholds": thresholds, "summary": summary}
        return verdict, rationale

    # Gate 3: Margin of Safety
    gates.append({
        "gate": "Margin of Safety",
        "passed": has_mos,
        "detail": f"MoS ratio {mos_ratio:.2f} {'<=' if has_mos else '>'} 0.70 threshold — {'trading below' if has_mos else 'trading above'} conservative intrinsic value"
    })

    # Gate 4: Quality Check
    gates.append({
        "gate": "Quality Check",
        "passed": is_quality,
        "detail": f"Quality score {quality_score:.0f}/100 {'≥' if is_quality else '<'} 65 threshold"
    })

    # Standard verdict logic for stocks with acceptable earnings power
    if has_mos:  # Price below conservative value
        if mos_ratio <= 0.5:
            verdict = InvestmentVerdict.STRONG_BUY if is_quality else InvestmentVerdict.BUY
            summary = f"{verdict.value}: {'Quality company' if is_quality else 'Company'} (score {quality_score:.0f}) trading at just {mos_ratio:.0%} of conservative value — excellent margin of safety."
        elif mos_ratio <= 0.7:
            verdict = InvestmentVerdict.BUY if is_quality else InvestmentVerdict.ACCUMULATE
            summary = f"{verdict.value}: {'Quality company' if is_quality else 'Company'} (score {quality_score:.0f}) trading at {mos_ratio:.0%} of conservative value with good margin of safety."
        else:  # mos 0.7-1.0
            verdict = InvestmentVerdict.ACCUMULATE if is_quality else InvestmentVerdict.HOLD
            summary = f"{verdict.value}: Trading at {mos_ratio:.0%} of conservative value. {'Quality business worth accumulating.' if is_quality else 'Modest discount but quality concerns.'}"
    else:  # No margin of safety
        if mos_ratio <= 1.15:  # Slightly overvalued
            if is_quality:
                verdict = InvestmentVerdict.WATCHLIST
                summary = f"WATCHLIST: Quality company (score {quality_score:.0f}) but trading at {mos_ratio:.0%} of conservative value — no margin of safety. Wait for price below buy-below target."
            else:
                verdict = InvestmentVerdict.HOLD
                summary = f"HOLD: Trading near fair value (MoS {mos_ratio:.0%}) with below-threshold quality (score {quality_score:.0f}). No action needed."
        elif mos_ratio <= 1.5:
            if not is_quality:
                verdict = InvestmentVerdict.REDUCE
                summary = f"REDUCE: Overvalued (MoS {mos_ratio:.0%}) with below-threshold quality (score {quality_score:.0f}). Consider trimming."
            else:
                verdict = InvestmentVerdict.HOLD
                summary = f"HOLD: Quality company (score {quality_score:.0f}) but overvalued at {mos_ratio:.0%} of conservative value. Hold existing position but don't add."
        else:  # Significantly overvalued
            if not is_quality:
                verdict = InvestmentVerdict.SELL
                summary = f"SELL: Significantly overvalued (MoS {mos_ratio:.0%}) with poor quality (score {quality_score:.0f}). Exit position."
            else:
                verdict = InvestmentVerdict.REDUCE
                summary = f"REDUCE: Quality company (score {quality_score:.0f}) but significantly overvalued at {mos_ratio:.0%} of conservative value. Consider trimming."

    rationale = {"gates": gates, "thresholds": thresholds, "summary": summary}
    return verdict, rationale


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

    # Risk-adjusted MoS: cyclical/distressed companies need MORE margin of safety
    earnings_classification = metrics.get('earnings_classification', 'Unknown')
    if earnings_classification in ('Cyclical', 'Turnaround'):
        required_mos = min(required_mos, 0.60)  # 40% discount required
    elif earnings_classification == 'Distressed':
        required_mos = min(required_mos, 0.50)  # 50% discount required

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

    # Calculate MOSEE score and years to payback
    # Earnings equity = Net Income / Market Cap (how much of market cap you earn per year)
    earnings_equity = metrics.get('earnings_equity')
    market_cap = metrics.get('market_cap')
    net_income = metrics.get('net_income')

    # Calculate earnings equity if not provided but we have the components
    if earnings_equity is None and market_cap and net_income and market_cap > 0:
        earnings_equity = net_income / market_cap

    # MOSEE score = (1 / MoS) * earnings_equity
    # Higher is better: combines value (MoS) with earnings power
    mosee_score = None
    years_to_payback = None

    if earnings_equity is not None and earnings_equity > 0:
        mosee_score = (1 / mos_ratio) * earnings_equity if mos_ratio > 0 else None
        years_to_payback = min(1 / earnings_equity, 999)  # Cap at 999 years to prevent extreme values

    # Create multi-lens perspectives
    lenses = [
        _create_graham_lens(metrics, mos_ratio),
        _create_buffett_lens(metrics, quality_score),
        _create_lynch_lens(metrics),
        _create_fisher_lens(metrics)
    ]

    # Determine verdict (now considers MOSEE score and years to payback)
    verdict, verdict_rationale = _determine_verdict(
        has_mos,
        quality_score,
        mos_ratio,
        valuation.composite_confidence.value,
        mosee_score=mosee_score,
        years_to_payback=years_to_payback
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
        concerns.append(f"Declining earnings ({metrics.get('earnings_growth', 0):.1%} growth)")

    # Cyclicality concerns
    if earnings_classification == 'Cyclical':
        concerns.append("Cyclical earnings pattern — projections use normalized (average) earnings")
    elif earnings_classification == 'Turnaround':
        concerns.append("Turnaround company — recovering from losses, high uncertainty")
    elif earnings_classification == 'Distressed':
        concerns.append("Distressed earnings — persistent losses or extreme volatility")

    r_squared = metrics.get('projection_r_squared')
    if r_squared is not None and r_squared < 0.3:
        concerns.append(f"Low projection reliability (R²={r_squared:.2f}) — earnings too volatile to forecast")

    # MOSEE and years to payback concerns
    if years_to_payback is not None and years_to_payback > 50:
        concerns.append(f"Extremely high years to payback ({years_to_payback:.0f} years) - poor earnings power relative to price")
    elif years_to_payback is not None and years_to_payback > 25:
        concerns.append(f"High years to payback ({years_to_payback:.0f} years)")

    if mosee_score is not None and mosee_score < 0.05:
        concerns.append(f"Low MOSEE score ({mosee_score:.3f}) - poor combination of value and earnings")

    # MOSEE and years to payback strengths
    if mosee_score is not None and mosee_score >= 0.15:
        strengths.append(f"Excellent MOSEE score ({mosee_score:.3f}) - strong value and earnings")
    elif mosee_score is not None and mosee_score >= 0.10:
        strengths.append(f"Good MOSEE score ({mosee_score:.3f})")

    if years_to_payback is not None and years_to_payback <= 15:
        strengths.append(f"Fast payback ({years_to_payback:.1f} years)")
    
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
        action_items=action_items,
        verdict_rationale=verdict_rationale,
        quality_breakdown=composite.to_dict()
    )
