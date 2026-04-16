"""
Fisher Scuttlebutt Scoring Module

Philip Fisher's "Common Stocks and Uncommon Profits" outlined 15 qualitative
points for evaluating a company's competitive advantage.  Most are qualitative
(management interviews, channel checks) but many leave measurable financial
fingerprints.

This module scores 8 quantitative dimensions that approximate Fisher's
scuttlebutt signals, producing a 0-100 composite "Competitive Advantage Score".

Dimensions:
  1. Growth Engine      — Revenue CAGR + growth consistency
  2. Margin Power       — Gross margin level + trend (pricing power)
  3. R&D Efficiency     — R&D intensity paired with revenue growth
  4. Operating Leverage  — SGA/Revenue trend (scale advantage)
  5. Capital Stewardship — FCF conversion, low dilution, smart debt
  6. Earnings Quality   — Steady compounder classification, low CV
  7. Employee Productivity — Revenue per employee
  8. Insider Alignment  — Insider + institutional ownership
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional
import math
import pandas as pd
import numpy as np


@dataclass
class ScuttlebuttDimension:
    """A single scuttlebutt dimension score."""
    name: str
    score: float          # 0-100
    weight: float         # contribution weight (sums to 1.0)
    detail: str           # human-readable explanation
    raw_values: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "score": round(self.score, 1),
            "weight": self.weight,
            "weighted_score": round(self.score * self.weight, 1),
            "detail": self.detail,
            "raw_values": {k: _safe_json(v) for k, v in self.raw_values.items()},
        }


@dataclass
class ScuttlebuttScore:
    """Complete Fisher scuttlebutt assessment."""
    total_score: float
    grade: str
    dimensions: list  # list[ScuttlebuttDimension]
    strengths: list   # list[str]
    weaknesses: list  # list[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_score": round(self.total_score, 1),
            "grade": self.grade,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
        }


def _safe_json(val):
    """Make a value JSON-safe."""
    if val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return round(val, 4)
    if isinstance(val, (int, str, bool)):
        return val
    return str(val)


def _safe_float(val, default=None) -> Optional[float]:
    """Extract a float from various types."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val) if math.isfinite(val) else default
    if isinstance(val, pd.Series):
        v = val.iloc[-1] if len(val) > 0 else default
        if v is not None and isinstance(v, (int, float)) and math.isfinite(v):
            return float(v)
    return default


def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


# ============================================================================
# Dimension scorers — each returns a ScuttlebuttDimension
# ============================================================================

def _score_growth_engine(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """Revenue CAGR + growth consistency."""
    cagr = _safe_float(metrics.get('sales_cagr'), 0)
    consistency = _safe_float(metrics.get('growth_consistency'), 0)

    # CAGR component: 20%+ → 60 pts, scales linearly from 0
    cagr_pts = _clamp(cagr * 300, 0, 60)

    # Consistency component: 0-1 scale → 0-40 pts
    cons_pts = _clamp(consistency * 40, 0, 40)

    score = cagr_pts + cons_pts

    return ScuttlebuttDimension(
        name="Growth Engine",
        score=score,
        weight=0.15,
        detail=f"Revenue CAGR {cagr:.1%}, consistency {consistency:.0%}",
        raw_values={"sales_cagr": cagr, "growth_consistency": consistency},
    )


def _score_margin_power(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """Gross margin level + margin trend."""
    gross_margin = _safe_float(metrics.get('gross_margin_latest'), 0)
    margin_trend_score = _safe_float(metrics.get('margin_trend_score'), 0)  # -1 to 1

    # Gross margin: 50%+ → 50pts, 0% → 0pts
    gm_pts = _clamp(gross_margin * 100, 0, 50)

    # Margin trend: improving (+1) → 50pts, declining (-1) → 0pts
    trend_pts = _clamp((margin_trend_score + 1) * 25, 0, 50)

    score = gm_pts + trend_pts

    return ScuttlebuttDimension(
        name="Margin Power",
        score=score,
        weight=0.15,
        detail=f"Gross margin {gross_margin:.1%}, trend {'improving' if margin_trend_score > 0.05 else 'declining' if margin_trend_score < -0.05 else 'stable'}",
        raw_values={"gross_margin": gross_margin, "margin_trend_score": margin_trend_score},
    )


def _score_rd_efficiency(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """R&D intensity paired with revenue growth.

    Fisher valued companies that invest in R&D AND get results.
    High R&D + high growth = innovation engine.
    High R&D + no growth = money pit.
    No R&D data = neutral (many industries don't report it).
    """
    rd_intensity = _safe_float(metrics.get('rd_intensity_latest'))
    cagr = _safe_float(metrics.get('sales_cagr'), 0)

    if rd_intensity is None or rd_intensity == 0:
        return ScuttlebuttDimension(
            name="R&D Efficiency",
            score=50,  # neutral when no data
            weight=0.10,
            detail="R&D data not available — scored neutral",
            raw_values={"rd_intensity": None, "sales_cagr": cagr},
        )

    # R&D intensity sweet spot: 5-15% is ideal for tech/pharma
    intensity_pts = _clamp(rd_intensity * 300, 0, 40)  # up to 40pts for ~13%+

    # Growth return on R&D: if spending R&D and growing, it's working
    if cagr > 0.10:
        growth_return_pts = 60
    elif cagr > 0.05:
        growth_return_pts = 40
    elif cagr > 0:
        growth_return_pts = 20
    else:
        growth_return_pts = 0  # spending on R&D but shrinking = red flag

    score = intensity_pts * 0.4 + growth_return_pts * 0.6

    return ScuttlebuttDimension(
        name="R&D Efficiency",
        score=score,
        weight=0.10,
        detail=f"R&D intensity {rd_intensity:.1%}, revenue growth {cagr:.1%}",
        raw_values={"rd_intensity": rd_intensity, "sales_cagr": cagr},
    )


def _score_operating_leverage(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """SGA/Revenue trend — declining ratio = scale advantage."""
    sga_ratio_latest = _safe_float(metrics.get('sga_ratio_latest'))
    sga_ratio_earliest = _safe_float(metrics.get('sga_ratio_earliest'))

    if sga_ratio_latest is None:
        return ScuttlebuttDimension(
            name="Operating Leverage",
            score=50,
            weight=0.10,
            detail="SGA data not available — scored neutral",
            raw_values={},
        )

    # Low SGA ratio = efficient (20% → 80pts, 50% → 30pts)
    efficiency_pts = _clamp((0.5 - sga_ratio_latest) * 160, 0, 60)

    # Improving trend = scale advantage
    trend_pts = 20  # neutral default
    if sga_ratio_earliest is not None and sga_ratio_earliest > 0:
        change = (sga_ratio_latest - sga_ratio_earliest) / sga_ratio_earliest
        if change < -0.10:
            trend_pts = 40  # improved by >10%
        elif change < 0:
            trend_pts = 30
        elif change > 0.10:
            trend_pts = 0   # worsened by >10%

    score = efficiency_pts + trend_pts

    return ScuttlebuttDimension(
        name="Operating Leverage",
        score=score,
        weight=0.10,
        detail=f"SGA/Revenue {sga_ratio_latest:.1%}" + (f" (was {sga_ratio_earliest:.1%})" if sga_ratio_earliest else ""),
        raw_values={"sga_ratio_latest": sga_ratio_latest, "sga_ratio_earliest": sga_ratio_earliest},
    )


def _score_capital_stewardship(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """FCF conversion, debt management, dilution avoidance."""
    fcf = _safe_float(metrics.get('free_cash_flow'), 0)
    net_income = _safe_float(metrics.get('net_income_latest'), 0)
    debt_to_equity = _safe_float(metrics.get('debt_to_equity'), 0)
    interest_coverage = _safe_float(metrics.get('interest_coverage'), 0)

    # FCF conversion: FCF / Net Income > 1.0 = excellent cash generation
    fcf_conversion = fcf / net_income if net_income > 0 else 0
    fcf_pts = _clamp(fcf_conversion * 30, 0, 35)

    # Low debt: D/E <= 0.3 → 35pts, > 1.5 → 0pts
    debt_pts = _clamp((1.5 - debt_to_equity) / 1.2 * 35, 0, 35)

    # Interest coverage: >10x → 30pts
    ic_pts = _clamp(interest_coverage / 10 * 30, 0, 30)

    score = fcf_pts + debt_pts + ic_pts

    return ScuttlebuttDimension(
        name="Capital Stewardship",
        score=score,
        weight=0.15,
        detail=f"FCF conversion {fcf_conversion:.0%}, D/E {debt_to_equity:.2f}, IC {interest_coverage:.1f}x",
        raw_values={"fcf_conversion": fcf_conversion, "debt_to_equity": debt_to_equity, "interest_coverage": interest_coverage},
    )


def _score_earnings_quality(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """Steady compounder classification, low coefficient of variation."""
    classification = metrics.get('earnings_classification', 'Unknown')
    earnings_cv = _safe_float(metrics.get('earnings_cv'))

    # Classification bonus
    cls_map = {
        'Steady Compounder': 50,
        'Cyclical': 25,
        'Turnaround': 15,
        'Distressed': 0,
    }
    cls_pts = cls_map.get(classification, 20)

    # Low CV = consistent earnings (CV < 0.2 → 50pts, CV > 1.0 → 0pts)
    cv_pts = 25  # default if no CV data
    if earnings_cv is not None:
        cv_pts = _clamp((1.0 - earnings_cv) * 50, 0, 50)

    score = cls_pts + cv_pts

    return ScuttlebuttDimension(
        name="Earnings Quality",
        score=score,
        weight=0.15,
        detail=f"{classification}, CV {'N/A' if earnings_cv is None else f'{earnings_cv:.2f}'}",
        raw_values={"earnings_classification": classification, "earnings_cv": earnings_cv},
    )


def _score_employee_productivity(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """Revenue per employee — proxy for organizational efficiency."""
    employee_count = metrics.get('employee_count')
    revenue = _safe_float(metrics.get('revenue_latest'), 0)

    if not employee_count or employee_count <= 0 or revenue <= 0:
        return ScuttlebuttDimension(
            name="Employee Productivity",
            score=50,
            weight=0.10,
            detail="Employee data not available — scored neutral",
            raw_values={},
        )

    rev_per_employee = revenue / employee_count

    # Benchmark: $500K/employee = good, $1M+ = excellent
    # Tech companies often hit $1M+, manufacturing might be $200K
    score = _clamp(rev_per_employee / 10000, 0, 100)  # $1M → 100pts

    return ScuttlebuttDimension(
        name="Employee Productivity",
        score=score,
        weight=0.10,
        detail=f"${rev_per_employee:,.0f}/employee ({employee_count:,} employees)",
        raw_values={"revenue_per_employee": rev_per_employee, "employee_count": employee_count},
    )


def _score_insider_alignment(metrics: Dict[str, Any]) -> ScuttlebuttDimension:
    """Insider + institutional ownership signals."""
    insider = _safe_float(metrics.get('insider_held'))
    institutional = _safe_float(metrics.get('institutional_held'))

    if insider is None and institutional is None:
        return ScuttlebuttDimension(
            name="Insider Alignment",
            score=50,
            weight=0.10,
            detail="Ownership data not available — scored neutral",
            raw_values={},
        )

    # Insider: 5-30% sweet spot (enough skin in game, not too concentrated)
    insider_pts = 25  # default
    if insider is not None:
        if 0.05 <= insider <= 0.30:
            insider_pts = 50
        elif insider > 0.30:
            insider_pts = 35  # still good, just concentrated
        elif insider > 0.01:
            insider_pts = 20
        else:
            insider_pts = 10

    # Institutional: >50% = smart money likes it
    inst_pts = 25
    if institutional is not None:
        inst_pts = _clamp(institutional * 70, 0, 50)

    score = insider_pts + inst_pts

    parts = []
    if insider is not None:
        parts.append(f"Insider {insider:.1%}")
    if institutional is not None:
        parts.append(f"Institutional {institutional:.1%}")

    return ScuttlebuttDimension(
        name="Insider Alignment",
        score=score,
        weight=0.10,
        detail=", ".join(parts) if parts else "N/A",
        raw_values={"insider_held": insider, "institutional_held": institutional},
    )


# ============================================================================
# Main entry point
# ============================================================================

def calculate_scuttlebutt_score(metrics: Dict[str, Any]) -> ScuttlebuttScore:
    """
    Calculate the Fisher Scuttlebutt Competitive Advantage Score.

    Args:
        metrics: Dictionary containing all available metrics. Expected keys:
            - sales_cagr, growth_consistency
            - gross_margin_latest, margin_trend_score
            - rd_intensity_latest
            - sga_ratio_latest, sga_ratio_earliest
            - free_cash_flow, net_income_latest, debt_to_equity, interest_coverage
            - earnings_classification, earnings_cv
            - revenue_latest, employee_count
            - insider_held, institutional_held

    Returns:
        ScuttlebuttScore with total score, grade, dimensions, strengths, weaknesses
    """
    dimensions = [
        _score_growth_engine(metrics),
        _score_margin_power(metrics),
        _score_rd_efficiency(metrics),
        _score_operating_leverage(metrics),
        _score_capital_stewardship(metrics),
        _score_earnings_quality(metrics),
        _score_employee_productivity(metrics),
        _score_insider_alignment(metrics),
    ]

    # Weighted total
    total = sum(d.score * d.weight for d in dimensions)

    # Grade
    if total >= 80:
        grade = "A"
    elif total >= 65:
        grade = "B"
    elif total >= 50:
        grade = "C"
    elif total >= 35:
        grade = "D"
    else:
        grade = "F"

    # Extract strengths and weaknesses
    strengths = []
    weaknesses = []
    for d in sorted(dimensions, key=lambda x: x.score, reverse=True):
        if d.score >= 70:
            strengths.append(f"{d.name}: {d.detail}")
        elif d.score < 35:
            weaknesses.append(f"{d.name}: {d.detail}")

    return ScuttlebuttScore(
        total_score=total,
        grade=grade,
        dimensions=dimensions,
        strengths=strengths,
        weaknesses=weaknesses,
    )
