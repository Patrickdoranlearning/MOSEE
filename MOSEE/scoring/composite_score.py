"""
MOSEE Composite Scoring Module

Combines investment criteria from multiple classic investing books:
- Benjamin Graham (The Intelligent Investor, Security Analysis)
- Warren Buffett (Letters to Shareholders, The Warren Buffett Way)
- Charlie Munger (Poor Charlie's Almanack)
- Peter Lynch (One Up on Wall Street)
- Joel Greenblatt (The Little Book That Beats the Market)
- Philip Fisher (Common Stocks and Uncommon Profits)
- Seth Klarman (Margin of Safety)

Each investor's approach is weighted to create a composite score that
balances value, quality, and growth factors.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum


class InvestmentStyle(Enum):
    """Investment style presets with different weightings."""
    DEEP_VALUE = "deep_value"           # Graham/Klarman focus
    QUALITY_VALUE = "quality_value"     # Buffett/Munger focus
    GARP = "garp"                        # Growth at Reasonable Price (Lynch)
    MAGIC_FORMULA = "magic_formula"     # Greenblatt's approach
    GROWTH = "growth"                   # Fisher focus
    BALANCED = "balanced"               # Equal weighting


@dataclass
class ComponentScore:
    """Individual component score."""
    name: str
    score: float  # 0-100
    weight: float  # 0-1
    weighted_score: float
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "score": round(self.score, 1),
            "weight": round(self.weight, 3),
            "weighted_score": round(self.weighted_score, 2),
            "details": self.details
        }


@dataclass
class CompositeScore:
    """Complete composite investment score."""
    ticker: str
    total_score: float  # 0-100
    grade: str  # A, B, C, D, F
    investment_style: str
    components: List[ComponentScore]
    recommendation: str
    strengths: List[str]
    weaknesses: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "total_score": round(self.total_score, 1),
            "grade": self.grade,
            "investment_style": self.investment_style,
            "components": [c.to_dict() for c in self.components],
            "recommendation": self.recommendation,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses
        }


def get_style_weights(style: InvestmentStyle) -> Dict[str, float]:
    """
    Get component weights for each investment style.
    
    Components:
    - graham: Graham's defensive criteria and margin of safety
    - buffett: Owner earnings, ROE, ROIC, quality metrics
    - lynch: PEG ratio, growth characteristics
    - greenblatt: Magic Formula (earnings yield + return on capital)
    - fisher: Sales growth, margin trends, reinvestment efficiency
    
    All weights should sum to 1.0.
    
    Args:
        style: Investment style enum
        
    Returns:
        Dictionary of component weights
    """
    weights = {
        InvestmentStyle.DEEP_VALUE: {
            "graham": 0.35,
            "buffett": 0.25,
            "lynch": 0.10,
            "greenblatt": 0.20,
            "fisher": 0.10
        },
        InvestmentStyle.QUALITY_VALUE: {
            "graham": 0.15,
            "buffett": 0.40,
            "lynch": 0.15,
            "greenblatt": 0.15,
            "fisher": 0.15
        },
        InvestmentStyle.GARP: {
            "graham": 0.15,
            "buffett": 0.20,
            "lynch": 0.35,
            "greenblatt": 0.10,
            "fisher": 0.20
        },
        InvestmentStyle.MAGIC_FORMULA: {
            "graham": 0.10,
            "buffett": 0.15,
            "lynch": 0.15,
            "greenblatt": 0.45,
            "fisher": 0.15
        },
        InvestmentStyle.GROWTH: {
            "graham": 0.10,
            "buffett": 0.15,
            "lynch": 0.25,
            "greenblatt": 0.10,
            "fisher": 0.40
        },
        InvestmentStyle.BALANCED: {
            "graham": 0.20,
            "buffett": 0.20,
            "lynch": 0.20,
            "greenblatt": 0.20,
            "fisher": 0.20
        }
    }
    
    return weights.get(style, weights[InvestmentStyle.BALANCED])


def calculate_graham_score(
    graham_criteria_score: int,
    graham_mos: Optional[float],
    pe_ratio: Optional[float],
    pb_ratio: Optional[float],
    current_ratio: Optional[float]
) -> ComponentScore:
    """
    Calculate Graham component score.
    
    Based on:
    - Graham's 7 Defensive Criteria (0-7 score)
    - Margin of Safety vs Graham Number
    - P/E and P/B ratios
    - Current ratio
    
    Args:
        graham_criteria_score: Number of Graham criteria passed (0-7)
        graham_mos: Margin of safety vs Graham Number
        pe_ratio: Price to earnings ratio
        pb_ratio: Price to book ratio
        current_ratio: Current assets / current liabilities
        
    Returns:
        ComponentScore for Graham metrics
    """
    score = 0
    details = {}
    
    # Defensive criteria (40 points max)
    criteria_score = (graham_criteria_score / 7) * 40
    score += criteria_score
    details["criteria_score"] = f"{graham_criteria_score}/7 criteria passed"
    
    # Margin of Safety vs Graham Number (30 points max)
    if graham_mos is not None and graham_mos > 0:
        if graham_mos < 0.5:
            mos_score = 30
        elif graham_mos < 0.75:
            mos_score = 25
        elif graham_mos < 1.0:
            mos_score = 15
        else:
            mos_score = max(0, 30 - (graham_mos - 1) * 15)
        score += mos_score
        details["graham_mos"] = f"{graham_mos:.2f}"
    
    # P/E ratio (15 points max)
    if pe_ratio is not None and pe_ratio > 0:
        if pe_ratio <= 10:
            pe_score = 15
        elif pe_ratio <= 15:
            pe_score = 12
        elif pe_ratio <= 20:
            pe_score = 8
        elif pe_ratio <= 25:
            pe_score = 4
        else:
            pe_score = 0
        score += pe_score
        details["pe_ratio"] = f"{pe_ratio:.1f}"
    
    # P/B ratio (15 points max)
    if pb_ratio is not None and pb_ratio > 0:
        if pb_ratio <= 1.0:
            pb_score = 15
        elif pb_ratio <= 1.5:
            pb_score = 12
        elif pb_ratio <= 2.0:
            pb_score = 8
        elif pb_ratio <= 3.0:
            pb_score = 4
        else:
            pb_score = 0
        score += pb_score
        details["pb_ratio"] = f"{pb_ratio:.2f}"
    
    return ComponentScore(
        name="Graham (Value/Safety)",
        score=min(100, score),
        weight=0,  # Set later
        weighted_score=0,  # Set later
        details=details
    )


def calculate_buffett_score(
    roe: Optional[float],
    roic: Optional[float],
    debt_to_equity: Optional[float],
    interest_coverage: Optional[float],
    owner_earnings_yield: Optional[float]
) -> ComponentScore:
    """
    Calculate Buffett/Munger quality component score.
    
    Based on:
    - Return on Equity (ROE)
    - Return on Invested Capital (ROIC)
    - Debt levels
    - Interest coverage
    - Owner earnings yield
    
    Args:
        roe: Return on equity as decimal
        roic: Return on invested capital as decimal
        debt_to_equity: Debt to equity ratio
        interest_coverage: Interest coverage ratio
        owner_earnings_yield: Owner earnings / market cap
        
    Returns:
        ComponentScore for Buffett metrics
    """
    score = 0
    details = {}
    
    # ROE (25 points max) - Buffett wants > 15%
    if roe is not None:
        if roe >= 0.20:
            roe_score = 25
        elif roe >= 0.15:
            roe_score = 20
        elif roe >= 0.10:
            roe_score = 12
        elif roe >= 0.05:
            roe_score = 5
        else:
            roe_score = 0
        score += roe_score
        details["roe"] = f"{roe:.1%}"
    
    # ROIC (25 points max) - Buffett wants > 10%
    if roic is not None:
        if roic >= 0.20:
            roic_score = 25
        elif roic >= 0.15:
            roic_score = 20
        elif roic >= 0.10:
            roic_score = 15
        elif roic >= 0.05:
            roic_score = 8
        else:
            roic_score = 0
        score += roic_score
        details["roic"] = f"{roic:.1%}"
    
    # Debt to Equity (20 points max) - lower is better
    if debt_to_equity is not None:
        if debt_to_equity <= 0.3:
            de_score = 20
        elif debt_to_equity <= 0.5:
            de_score = 15
        elif debt_to_equity <= 1.0:
            de_score = 10
        elif debt_to_equity <= 2.0:
            de_score = 5
        else:
            de_score = 0
        score += de_score
        details["debt_to_equity"] = f"{debt_to_equity:.2f}"
    
    # Interest Coverage (15 points max) - higher is better
    if interest_coverage is not None:
        if interest_coverage >= 10:
            ic_score = 15
        elif interest_coverage >= 5:
            ic_score = 12
        elif interest_coverage >= 3:
            ic_score = 8
        elif interest_coverage >= 1.5:
            ic_score = 4
        else:
            ic_score = 0
        score += ic_score
        details["interest_coverage"] = f"{interest_coverage:.1f}x"
    
    # Owner Earnings Yield (15 points max)
    if owner_earnings_yield is not None:
        if owner_earnings_yield >= 0.10:
            oey_score = 15
        elif owner_earnings_yield >= 0.07:
            oey_score = 12
        elif owner_earnings_yield >= 0.05:
            oey_score = 8
        elif owner_earnings_yield >= 0.03:
            oey_score = 4
        else:
            oey_score = 0
        score += oey_score
        details["owner_earnings_yield"] = f"{owner_earnings_yield:.1%}"
    
    return ComponentScore(
        name="Buffett (Quality)",
        score=min(100, score),
        weight=0,
        weighted_score=0,
        details=details
    )


def calculate_lynch_score(
    peg_ratio: Optional[float],
    earnings_growth: Optional[float],
    net_cash_per_share: Optional[float],
    current_price: Optional[float]
) -> ComponentScore:
    """
    Calculate Peter Lynch component score.
    
    Based on:
    - PEG Ratio (< 1 is good)
    - Earnings growth rate
    - Net cash position
    
    Args:
        peg_ratio: PEG ratio
        earnings_growth: Earnings growth rate as decimal
        net_cash_per_share: Net cash per share
        current_price: Current stock price
        
    Returns:
        ComponentScore for Lynch metrics
    """
    score = 0
    details = {}
    
    # PEG Ratio (50 points max) - Lynch's key metric
    if peg_ratio is not None and peg_ratio > 0:
        if peg_ratio < 0.5:
            peg_score = 50
        elif peg_ratio < 1.0:
            peg_score = 40
        elif peg_ratio < 1.5:
            peg_score = 25
        elif peg_ratio < 2.0:
            peg_score = 10
        else:
            peg_score = 0
        score += peg_score
        details["peg_ratio"] = f"{peg_ratio:.2f}"
    
    # Earnings Growth (30 points max)
    if earnings_growth is not None:
        if earnings_growth >= 0.20:
            growth_score = 30
        elif earnings_growth >= 0.15:
            growth_score = 25
        elif earnings_growth >= 0.10:
            growth_score = 18
        elif earnings_growth >= 0.05:
            growth_score = 10
        else:
            growth_score = 0
        score += growth_score
        details["earnings_growth"] = f"{earnings_growth:.1%}"
    
    # Net Cash Position (20 points max) - positive net cash is good
    if net_cash_per_share is not None and current_price is not None and current_price > 0:
        cash_pct = net_cash_per_share / current_price
        if cash_pct > 0.3:
            cash_score = 20
        elif cash_pct > 0.1:
            cash_score = 15
        elif cash_pct > 0:
            cash_score = 10
        elif cash_pct > -0.2:
            cash_score = 5
        else:
            cash_score = 0
        score += cash_score
        details["net_cash_pct"] = f"{cash_pct:.1%}"
    
    return ComponentScore(
        name="Lynch (GARP)",
        score=min(100, score),
        weight=0,
        weighted_score=0,
        details=details
    )


def calculate_greenblatt_score(
    earnings_yield: Optional[float],
    return_on_capital: Optional[float],
    magic_formula_percentile: Optional[float] = None
) -> ComponentScore:
    """
    Calculate Greenblatt Magic Formula component score.
    
    Based on:
    - Earnings Yield (EBIT / EV)
    - Return on Capital (EBIT / tangible capital)
    - Combined Magic Formula rank percentile
    
    Args:
        earnings_yield: Earnings yield as decimal
        return_on_capital: Return on capital as decimal
        magic_formula_percentile: Percentile rank in Magic Formula (0-100)
        
    Returns:
        ComponentScore for Greenblatt metrics
    """
    score = 0
    details = {}
    
    # If we have percentile rank, use it directly
    if magic_formula_percentile is not None:
        score = magic_formula_percentile
        details["magic_formula_percentile"] = f"{magic_formula_percentile:.0f}%"
    else:
        # Otherwise calculate from components
        
        # Earnings Yield (50 points max)
        if earnings_yield is not None:
            if earnings_yield >= 0.15:
                ey_score = 50
            elif earnings_yield >= 0.10:
                ey_score = 40
            elif earnings_yield >= 0.07:
                ey_score = 28
            elif earnings_yield >= 0.05:
                ey_score = 18
            else:
                ey_score = 0
            score += ey_score
            details["earnings_yield"] = f"{earnings_yield:.1%}"
        
        # Return on Capital (50 points max)
        if return_on_capital is not None:
            if return_on_capital >= 0.30:
                roc_score = 50
            elif return_on_capital >= 0.20:
                roc_score = 40
            elif return_on_capital >= 0.15:
                roc_score = 30
            elif return_on_capital >= 0.10:
                roc_score = 20
            else:
                roc_score = 0
            score += roc_score
            details["return_on_capital"] = f"{return_on_capital:.1%}"
    
    return ComponentScore(
        name="Greenblatt (Magic Formula)",
        score=min(100, score),
        weight=0,
        weighted_score=0,
        details=details
    )


def calculate_fisher_score(
    sales_cagr: Optional[float],
    margin_trend_score: Optional[float],
    growth_quality_score: Optional[float]
) -> ComponentScore:
    """
    Calculate Philip Fisher growth component score.
    
    Based on:
    - Sales CAGR
    - Margin trends
    - Overall growth quality
    
    Args:
        sales_cagr: Sales compound annual growth rate
        margin_trend_score: Margin trend score (-1 to 1)
        growth_quality_score: Overall growth quality (0-100)
        
    Returns:
        ComponentScore for Fisher metrics
    """
    # If we have the overall growth quality score, use it
    if growth_quality_score is not None:
        details = {
            "sales_cagr": f"{sales_cagr:.1%}" if sales_cagr else "N/A",
            "margin_trend": f"{margin_trend_score:.2f}" if margin_trend_score else "N/A"
        }
        return ComponentScore(
            name="Fisher (Growth)",
            score=min(100, growth_quality_score),
            weight=0,
            weighted_score=0,
            details=details
        )
    
    # Otherwise calculate manually
    score = 0
    details = {}
    
    # Sales CAGR (50 points max)
    if sales_cagr is not None:
        if sales_cagr >= 0.20:
            cagr_score = 50
        elif sales_cagr >= 0.15:
            cagr_score = 40
        elif sales_cagr >= 0.10:
            cagr_score = 30
        elif sales_cagr >= 0.05:
            cagr_score = 18
        else:
            cagr_score = 0
        score += cagr_score
        details["sales_cagr"] = f"{sales_cagr:.1%}"
    
    # Margin Trend (50 points max)
    if margin_trend_score is not None:
        # Score of 1.0 = 50 points, 0 = 25 points, -1.0 = 0 points
        trend_score = 25 + (margin_trend_score * 25)
        score += trend_score
        details["margin_trend_score"] = f"{margin_trend_score:.2f}"
    
    return ComponentScore(
        name="Fisher (Growth)",
        score=min(100, score),
        weight=0,
        weighted_score=0,
        details=details
    )


def calculate_all_component_scores(metrics: Dict[str, Any]) -> Dict[str, ComponentScore]:
    """
    Calculate all component scores from a metrics dictionary.
    
    Args:
        metrics: Dictionary containing all calculated metrics
        
    Returns:
        Dictionary of component scores
    """
    scores = {}
    
    # Graham score
    scores["graham"] = calculate_graham_score(
        graham_criteria_score=metrics.get("graham_criteria_score", 0),
        graham_mos=metrics.get("graham_mos"),
        pe_ratio=metrics.get("pe_ratio"),
        pb_ratio=metrics.get("pb_ratio"),
        current_ratio=metrics.get("current_ratio")
    )
    
    # Buffett score
    scores["buffett"] = calculate_buffett_score(
        roe=metrics.get("roe"),
        roic=metrics.get("roic"),
        debt_to_equity=metrics.get("debt_to_equity"),
        interest_coverage=metrics.get("interest_coverage"),
        owner_earnings_yield=metrics.get("owner_earnings_yield")
    )
    
    # Lynch score
    scores["lynch"] = calculate_lynch_score(
        peg_ratio=metrics.get("peg_ratio"),
        earnings_growth=metrics.get("earnings_growth"),
        net_cash_per_share=metrics.get("net_cash_per_share"),
        current_price=metrics.get("current_price")
    )
    
    # Greenblatt score
    scores["greenblatt"] = calculate_greenblatt_score(
        earnings_yield=metrics.get("earnings_yield"),
        return_on_capital=metrics.get("return_on_capital"),
        magic_formula_percentile=metrics.get("magic_formula_percentile")
    )
    
    # Fisher score
    scores["fisher"] = calculate_fisher_score(
        sales_cagr=metrics.get("sales_cagr"),
        margin_trend_score=metrics.get("margin_trend_score"),
        growth_quality_score=metrics.get("growth_quality_score")
    )
    
    return scores


def calculate_composite_score(
    ticker: str,
    metrics: Dict[str, Any],
    style: InvestmentStyle = InvestmentStyle.BALANCED
) -> CompositeScore:
    """
    Calculate composite investment score combining all book methodologies.
    
    Args:
        ticker: Stock ticker symbol
        metrics: Dictionary containing all calculated metrics
        style: Investment style for weighting
        
    Returns:
        CompositeScore object with full analysis
    """
    # Get component scores
    component_scores = calculate_all_component_scores(metrics)
    
    # Get weights for chosen style
    weights = get_style_weights(style)
    
    # Apply weights and calculate total
    total_score = 0
    components = []
    
    for name, comp_score in component_scores.items():
        weight = weights.get(name, 0.2)
        comp_score.weight = weight
        comp_score.weighted_score = comp_score.score * weight
        total_score += comp_score.weighted_score
        components.append(comp_score)
    
    # Determine grade
    if total_score >= 80:
        grade = "A"
    elif total_score >= 70:
        grade = "B"
    elif total_score >= 55:
        grade = "C"
    elif total_score >= 40:
        grade = "D"
    else:
        grade = "F"
    
    # Identify strengths and weaknesses
    strengths = []
    weaknesses = []
    
    for comp in components:
        if comp.score >= 70:
            strengths.append(f"{comp.name}: {comp.score:.0f}/100")
        elif comp.score < 40:
            weaknesses.append(f"{comp.name}: {comp.score:.0f}/100")
    
    # Generate recommendation
    if grade == "A":
        recommendation = "STRONG BUY - Excellent across all criteria"
    elif grade == "B":
        recommendation = "BUY - Good overall with some standout qualities"
    elif grade == "C":
        recommendation = "HOLD - Average characteristics, watch for improvement"
    elif grade == "D":
        recommendation = "SELL - Below average, significant concerns"
    else:
        recommendation = "AVOID - Poor performance across most criteria"
    
    return CompositeScore(
        ticker=ticker,
        total_score=total_score,
        grade=grade,
        investment_style=style.value,
        components=components,
        recommendation=recommendation,
        strengths=strengths,
        weaknesses=weaknesses
    )
