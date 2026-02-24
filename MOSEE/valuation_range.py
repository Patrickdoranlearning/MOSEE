"""
MOSEE Valuation Range Module

Implements Warren Buffett's key insight: intrinsic value is always a RANGE, 
never a precise number. We must acknowledge uncertainty and build margin of 
safety against the conservative end of the range.

"It's better to be approximately right than precisely wrong." - Warren Buffett

Key Concepts:
1. Every valuation produces a range (conservative, base, optimistic)
2. Quality/predictability affects the WIDTH of the range
3. Multiple valuation methods triangulate the range
4. Margin of Safety is measured against the CONSERVATIVE end
5. Confidence level reflects how tight the range is
"""

import math
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum


class ValueConfidence(Enum):
    """Confidence in valuation range."""
    HIGH = "HIGH"          # Narrow range, predictable business
    MEDIUM = "MEDIUM"      # Moderate uncertainty
    LOW = "LOW"            # Wide range, high uncertainty
    SPECULATIVE = "SPECULATIVE"  # Too uncertain to value reliably


@dataclass
class ValuationRange:
    """
    Represents a range of intrinsic values rather than a single point estimate.
    
    Buffett's insight: We can never know exact value, but we can estimate
    a range and demand a price below the conservative end.
    """
    # Core range values
    conservative: float      # Bear case / pessimistic (USE THIS FOR MoS)
    base: float             # Most likely / expected value
    optimistic: float       # Bull case / best scenario
    
    # Metadata
    method: str             # Which valuation method produced this
    confidence: ValueConfidence
    assumptions: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def range_width(self) -> float:
        """Width of the range as percentage of base value."""
        if self.base == 0:
            return float('inf')
        return (self.optimistic - self.conservative) / self.base
    
    @property
    def midpoint(self) -> float:
        """Midpoint of the range."""
        return (self.conservative + self.optimistic) / 2
    
    def margin_of_safety(self, current_price: float) -> float:
        """
        Calculate MoS against CONSERVATIVE value (not base!).
        
        MoS < 1.0 means price is below conservative value (good)
        MoS > 1.0 means price is above conservative value (no safety)
        """
        if self.conservative <= 0:
            return float('inf')
        return current_price / self.conservative
    
    def is_buyable(self, current_price: float, required_mos: float = 0.7) -> bool:
        """
        Determine if stock is buyable with required margin of safety.
        
        Args:
            current_price: Current stock price
            required_mos: Required MoS ratio (0.7 = 30% discount to conservative)
        """
        return self.margin_of_safety(current_price) <= required_mos
    
    def buy_below_price(self, required_mos: float = 0.7) -> float:
        """Calculate the maximum price to pay for required MoS."""
        return self.conservative * required_mos
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conservative": round(self.conservative, 2),
            "base": round(self.base, 2),
            "optimistic": round(self.optimistic, 2),
            "method": self.method,
            "confidence": self.confidence.value,
            "range_width_pct": round(self.range_width * 100, 1),
            "assumptions": self.assumptions
        }


@dataclass
class CompositeValuationRange:
    """
    Combines multiple valuation methods into a single range.
    
    Each method (DCF, PAD, Book Value, etc.) contributes to our understanding
    of where value likely lies. We triangulate to get a more robust range.
    """
    ticker: str
    individual_ranges: List[ValuationRange]
    quality_score: float  # 0-100, affects range width
    
    # Computed composite range
    composite_conservative: float = 0
    composite_base: float = 0
    composite_optimistic: float = 0
    composite_confidence: ValueConfidence = ValueConfidence.LOW
    
    def __post_init__(self):
        """Calculate composite range from individual valuations."""
        if self.individual_ranges:
            self._calculate_composite()
    
    def _calculate_composite(self):
        """
        Triangulate multiple valuation methods into a composite range.
        
        Strategy:
        - Conservative: Use the LOWEST conservative value (most pessimistic)
        - Base: Use weighted average of base values
        - Optimistic: Use average of optimistic values (not highest - avoid anchoring)
        - Adjust width based on quality/predictability
        """
        valid_ranges = [r for r in self.individual_ranges 
                       if r.conservative > 0 and r.base > 0]
        
        if not valid_ranges:
            return
        
        # Conservative: Take the lowest (most pessimistic) conservative value
        # This is key - we want true margin of safety
        self.composite_conservative = min(r.conservative for r in valid_ranges)
        
        # Base: Weighted average (higher confidence methods get more weight)
        confidence_weights = {
            ValueConfidence.HIGH: 1.5,
            ValueConfidence.MEDIUM: 1.0,
            ValueConfidence.LOW: 0.5,
            ValueConfidence.SPECULATIVE: 0.25
        }
        
        total_weight = sum(confidence_weights[r.confidence] for r in valid_ranges)
        self.composite_base = sum(
            r.base * confidence_weights[r.confidence] for r in valid_ranges
        ) / total_weight if total_weight > 0 else 0
        
        # Optimistic: Average (not max - avoid over-optimism)
        self.composite_optimistic = np.mean([r.optimistic for r in valid_ranges])
        
        # Adjust range based on quality score
        # Higher quality = narrower range (more predictable)
        self._adjust_for_quality()
        
        # Determine overall confidence
        self._calculate_confidence()
    
    def _adjust_for_quality(self):
        """
        Adjust range width based on business quality/predictability.
        
        High quality businesses (consistent ROE, stable margins, strong moat)
        have more predictable futures, so the range should be narrower.
        
        Low quality businesses are harder to predict, so range should be wider.
        """
        if self.composite_base == 0:
            return
        
        # Quality score 0-100
        # High quality (80+) = narrow range (±15%)
        # Medium quality (50-80) = moderate range (±25%)
        # Low quality (<50) = wide range (±40%)
        
        if self.quality_score >= 80:
            uncertainty_factor = 0.15
        elif self.quality_score >= 60:
            uncertainty_factor = 0.25
        elif self.quality_score >= 40:
            uncertainty_factor = 0.35
        else:
            uncertainty_factor = 0.50
        
        # Set a floor so one wildly pessimistic method doesn't drag conservative too low,
        # but use the LOWER of composite_conservative and the floor to preserve real margin of safety.
        # The floor prevents obviously wrong values (e.g., one method returning near-zero).
        floor_conservative = self.composite_base * (1 - uncertainty_factor)
        # Only raise to floor if conservative is unreasonably low (< 50% of floor)
        # This preserves genuine margin of safety from conservative valuation methods
        if self.composite_conservative < floor_conservative * 0.5:
            self.composite_conservative = floor_conservative
        
        # Ensure optimistic doesn't exceed (1 + uncertainty) of base
        max_optimistic = self.composite_base * (1 + uncertainty_factor)
        self.composite_optimistic = min(self.composite_optimistic, max_optimistic)
    
    def _calculate_confidence(self):
        """Determine overall confidence level."""
        if not self.individual_ranges:
            self.composite_confidence = ValueConfidence.SPECULATIVE
            return
        
        # Factors that increase confidence:
        # 1. Multiple valuation methods agree (low dispersion)
        # 2. High quality score
        # 3. Individual methods have high confidence
        
        # Check agreement between methods
        bases = [r.base for r in self.individual_ranges if r.base > 0]
        if len(bases) >= 2:
            cv = np.std(bases) / np.mean(bases) if np.mean(bases) > 0 else 1
        else:
            cv = 0.5  # Default moderate uncertainty
        
        # Score based on agreement and quality
        confidence_score = 0
        
        # Agreement bonus (lower CV = better agreement)
        if cv < 0.2:
            confidence_score += 40
        elif cv < 0.4:
            confidence_score += 25
        elif cv < 0.6:
            confidence_score += 10
        
        # Quality bonus
        confidence_score += self.quality_score * 0.4
        
        # Number of methods bonus
        confidence_score += min(20, len(self.individual_ranges) * 5)
        
        # Map to confidence level
        # If we have at least 2 valid valuation methods, never go below LOW
        # This prevents showing "INSUFFICIENT DATA" when we actually have valuations
        min_confidence = ValueConfidence.SPECULATIVE
        if len(self.individual_ranges) >= 2:
            min_confidence = ValueConfidence.LOW

        if confidence_score >= 70:
            self.composite_confidence = ValueConfidence.HIGH
        elif confidence_score >= 50:
            self.composite_confidence = ValueConfidence.MEDIUM
        elif confidence_score >= 20:
            self.composite_confidence = ValueConfidence.LOW
        else:
            # Use minimum confidence based on number of valuation methods
            self.composite_confidence = min_confidence
    
    def margin_of_safety(self, current_price: float) -> float:
        """MoS against composite conservative value."""
        if self.composite_conservative <= 0:
            return float('inf')
        return current_price / self.composite_conservative
    
    def get_verdict(self, current_price: float, required_mos: float = 0.7) -> Dict[str, Any]:
        """
        Generate investment verdict with full context.
        
        Returns actionable insight acknowledging the range nature of value.
        """
        mos = self.margin_of_safety(current_price)
        buy_below = self.composite_conservative * required_mos
        
        # Determine position relative to range
        if current_price <= self.composite_conservative * required_mos:
            position = "DEEP_VALUE"
            recommendation = "STRONG BUY"
        elif current_price <= self.composite_conservative:
            position = "VALUE"
            recommendation = "BUY"
        elif current_price <= self.composite_base:
            position = "FAIR_VALUE"
            recommendation = "HOLD"
        elif current_price <= self.composite_optimistic:
            position = "FULL_VALUE"
            recommendation = "HOLD/TRIM"
        else:
            position = "OVERVALUED"
            recommendation = "SELL/AVOID"
        
        # Adjust for confidence
        if self.composite_confidence == ValueConfidence.SPECULATIVE:
            recommendation = f"UNCERTAIN - {recommendation} (low confidence)"
        
        return {
            "ticker": self.ticker,
            "current_price": current_price,
            "recommendation": recommendation,
            "position": position,
            "margin_of_safety": round(mos, 3),
            "has_margin_of_safety": mos <= required_mos,
            "buy_below_price": round(buy_below, 2),
            "valuation_range": {
                "conservative": round(self.composite_conservative, 2),
                "base": round(self.composite_base, 2),
                "optimistic": round(self.composite_optimistic, 2),
            },
            "confidence": self.composite_confidence.value,
            "range_width_pct": round(
                (self.composite_optimistic - self.composite_conservative) / 
                self.composite_base * 100 if self.composite_base > 0 else 0, 1
            ),
            "insight": self._generate_insight(current_price, mos, buy_below)
        }
    
    def _generate_insight(self, price: float, mos: float, buy_below: float) -> str:
        """Generate human-readable insight."""
        range_str = f"${self.composite_conservative:.0f}-${self.composite_optimistic:.0f}"
        
        if mos <= 0.5:
            return (f"Exceptional value. Price ${price:.0f} is well below conservative "
                   f"value range {range_str}. Strong margin of safety.")
        elif mos <= 0.7:
            return (f"Good value with margin of safety. Price ${price:.0f} is below "
                   f"conservative estimate. Value range: {range_str}.")
        elif mos <= 1.0:
            return (f"Fair value but limited margin of safety. Price ${price:.0f} is "
                   f"near conservative estimate. Consider buying below ${buy_below:.0f}. "
                   f"Value range: {range_str}.")
        elif mos <= 1.3:
            return (f"Priced at or above base value. Current ${price:.0f} offers no "
                   f"margin of safety. Wait for pullback to ${buy_below:.0f} or below. "
                   f"Value range: {range_str}.")
        else:
            return (f"Significantly overvalued. Price ${price:.0f} exceeds even "
                   f"optimistic estimates. Value range: {range_str}. "
                   f"Would need to fall to ${buy_below:.0f} for adequate margin of safety.")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "composite_range": {
                "conservative": round(self.composite_conservative, 2),
                "base": round(self.composite_base, 2),
                "optimistic": round(self.composite_optimistic, 2),
            },
            "confidence": self.composite_confidence.value,
            "quality_score": self.quality_score,
            "individual_valuations": [r.to_dict() for r in self.individual_ranges],
            "range_width_pct": round(
                (self.composite_optimistic - self.composite_conservative) / 
                self.composite_base * 100 if self.composite_base > 0 else 0, 1
            )
        }


def create_dcf_range(
    base_cashflow: float,
    growth_rate: float,
    discount_rate: float,
    terminal_growth: float = 0.03,
    years: int = 10,
    shares_outstanding: float = 1
) -> ValuationRange:
    """
    Create DCF valuation range with scenario analysis.

    Conservative: Lower growth, higher discount rate
    Base: Expected values
    Optimistic: Higher growth, lower discount rate
    """
    # Cap growth rate at sustainable levels - no company grows 50%+ forever
    MAX_GROWTH = 0.15  # 15% max
    growth_rate = min(growth_rate, MAX_GROWTH)

    def dcf_value_detailed(cf, g, r, tg, n):
        """Calculate DCF value with year-by-year breakdown."""
        value = 0
        year_by_year = []
        for i in range(1, n + 1):
            future_cf = cf * (1 + g) ** i
            pv = future_cf / (1 + r) ** i
            value += pv
            year_by_year.append({
                'year': i,
                'future_cf': round(future_cf, 2),
                'discount_factor': round(1 / (1 + r) ** i, 6),
                'present_value': round(pv, 2),
            })

        # Terminal value
        terminal_cf = cf * (1 + g) ** n * (1 + tg)
        terminal_value = terminal_cf / (r - tg) if r > tg else 0
        pv_terminal = terminal_value / (1 + r) ** n
        value += pv_terminal

        per_share = value / shares_outstanding if shares_outstanding > 0 else 0
        return per_share, year_by_year, round(pv_terminal / shares_outstanding if shares_outstanding > 0 else 0, 2)

    # Scenario adjustments with full breakdowns
    cons_val, cons_years, cons_terminal = dcf_value_detailed(
        base_cashflow * 0.9,  # 10% lower cash flow
        growth_rate * 0.7,    # 30% lower growth
        discount_rate + 0.02,  # 2% higher discount (more risk)
        terminal_growth * 0.8,
        years
    )

    base_val, base_years, base_terminal = dcf_value_detailed(
        base_cashflow,
        growth_rate,
        discount_rate,
        terminal_growth,
        years
    )

    opt_val, opt_years, opt_terminal = dcf_value_detailed(
        base_cashflow * 1.1,   # 10% higher cash flow
        growth_rate * 1.2,     # 20% higher growth
        discount_rate - 0.01,  # 1% lower discount
        terminal_growth * 1.1,
        years
    )

    return ValuationRange(
        conservative=cons_val,
        base=base_val,
        optimistic=opt_val,
        method="DCF",
        confidence=ValueConfidence.MEDIUM,
        assumptions={
            "base_cashflow": base_cashflow,
            "growth_rate": growth_rate,
            "discount_rate": discount_rate,
            "terminal_growth": terminal_growth,
            "years": years,
            "shares_outstanding": shares_outstanding,
            "scenarios": {
                "conservative": {
                    "cashflow_adj": "90% of base",
                    "growth_adj": "70% of base",
                    "discount_adj": "+2%",
                    "year_by_year": cons_years,
                    "terminal_pv_per_share": cons_terminal,
                    "value_per_share": round(cons_val, 2),
                },
                "base": {
                    "cashflow_adj": "100%",
                    "growth_adj": "100%",
                    "discount_adj": "0%",
                    "year_by_year": base_years,
                    "terminal_pv_per_share": base_terminal,
                    "value_per_share": round(base_val, 2),
                },
                "optimistic": {
                    "cashflow_adj": "110% of base",
                    "growth_adj": "120% of base",
                    "discount_adj": "-1%",
                    "year_by_year": opt_years,
                    "terminal_pv_per_share": opt_terminal,
                    "value_per_share": round(opt_val, 2),
                },
            }
        }
    )


def create_earnings_range(
    eps: float,
    growth_rate: float,
    quality_score: float,
    industry_pe: float = 15
) -> ValuationRange:
    """
    Create earnings-based valuation range.

    Quality affects what P/E multiple is deserved.
    """
    # Cap growth rate at sustainable levels
    MAX_GROWTH = 0.20  # 20% max for P/E adjustment
    growth_rate = min(growth_rate, MAX_GROWTH)

    # Quality-adjusted P/E
    # High quality (80+) deserves premium (1.5x industry)
    # Low quality (<40) deserves discount (0.6x industry)
    
    if quality_score >= 80:
        quality_multiple = 1.5
    elif quality_score >= 60:
        quality_multiple = 1.2
    elif quality_score >= 40:
        quality_multiple = 1.0
    else:
        quality_multiple = 0.7
    
    # Growth adjustment (PEG-inspired)
    growth_multiple = min(2.0, max(0.5, 1 + growth_rate))
    
    fair_pe = industry_pe * quality_multiple * growth_multiple

    # Cap P/E at reasonable levels - even great companies rarely sustain 40+ P/E
    MAX_PE = 40
    fair_pe = min(fair_pe, MAX_PE)

    conservative = eps * fair_pe * 0.7   # 30% discount
    base = eps * fair_pe
    optimistic = eps * fair_pe * 1.3     # 30% premium

    return ValuationRange(
        conservative=conservative,
        base=base,
        optimistic=optimistic,
        method="Quality-Adjusted P/E",
        confidence=ValueConfidence.MEDIUM if quality_score >= 50 else ValueConfidence.LOW,
        assumptions={
            "eps": eps,
            "industry_pe": industry_pe,
            "quality_score": quality_score,
            "quality_multiple": quality_multiple,
            "growth_rate": growth_rate,
            "growth_multiple": round(growth_multiple, 2),
            "fair_pe": round(fair_pe, 1),
            "calculation_chain": [
                f"Industry P/E = {industry_pe}",
                f"Quality Multiple = {quality_multiple}x (quality score {quality_score:.0f})",
                f"Growth Multiple = {growth_multiple:.2f}x (growth {growth_rate:.1%})",
                f"Fair P/E = {industry_pe} x {quality_multiple} x {growth_multiple:.2f} = {fair_pe:.1f}",
                f"Base Value = EPS(${eps:.2f}) x Fair P/E({fair_pe:.1f}) = ${base:.2f}",
                f"Conservative = Base x 0.7 = ${conservative:.2f}",
                f"Optimistic = Base x 1.3 = ${optimistic:.2f}",
            ],
        }
    )


def create_book_value_range(
    book_value_per_share: float,
    roe: float,
    quality_score: float
) -> ValuationRange:
    """
    Create book value based range.

    High ROE companies deserve premium to book.
    """
    # ROE-based multiple with graduated scale
    # Very high ROEs (>50%) are typically unsustainable, so we cap the premium
    # ROE 30%+ = 4x book (capped)
    # ROE 20-30% = 3x book
    # ROE 15-20% = 2x book
    # ROE 10-15% = 1.5x book
    # ROE < 10% = 1x book or less

    if roe >= 0.30:
        roe_multiple = 4.0  # Cap at 4x even for exceptional ROEs
    elif roe >= 0.20:
        roe_multiple = 3.0
    elif roe >= 0.15:
        roe_multiple = 2.0
    elif roe >= 0.10:
        roe_multiple = 1.5
    else:
        roe_multiple = max(0.5, 1.0 + roe * 5)
    
    # Quality adjustment
    quality_adj = 0.7 + (quality_score / 100) * 0.6  # 0.7 to 1.3
    
    fair_multiple = roe_multiple * quality_adj
    
    conservative = book_value_per_share * fair_multiple * 0.6
    base = book_value_per_share * fair_multiple
    optimistic = book_value_per_share * fair_multiple * 1.4

    return ValuationRange(
        conservative=conservative,
        base=base,
        optimistic=optimistic,
        method="Quality-Adjusted Book Value",
        confidence=ValueConfidence.HIGH if quality_score >= 60 else ValueConfidence.MEDIUM,
        assumptions={
            "book_value_per_share": book_value_per_share,
            "roe": round(roe, 3),
            "roe_multiple": roe_multiple,
            "quality_score": quality_score,
            "quality_adjustment": round(quality_adj, 2),
            "fair_pb_multiple": round(fair_multiple, 2),
            "calculation_chain": [
                f"ROE = {roe:.1%} -> ROE Multiple = {roe_multiple}x",
                f"Quality Adjustment = {quality_adj:.2f} (score {quality_score:.0f})",
                f"Fair P/B = {roe_multiple} x {quality_adj:.2f} = {fair_multiple:.2f}x",
                f"Base Value = BVPS(${book_value_per_share:.2f}) x {fair_multiple:.2f} = ${base:.2f}",
                f"Conservative = Base x 0.6 = ${conservative:.2f}",
                f"Optimistic = Base x 1.4 = ${optimistic:.2f}",
            ],
        }
    )


def create_owner_earnings_range(
    owner_earnings_per_share: float,
    growth_rate: float,
    required_return: float = 0.10
) -> ValuationRange:
    """
    Create Buffett-style owner earnings valuation range.

    Value = Owner Earnings / (Required Return - Growth Rate)
    This is essentially a growing perpetuity formula.
    """
    # Cap growth rate - perpetuity formula explodes when g approaches r
    # Max sustainable long-term growth is ~GDP growth + inflation (~5%)
    MAX_PERPETUITY_GROWTH = 0.06  # 6% max for perpetuity calculations
    growth_rate = min(growth_rate, MAX_PERPETUITY_GROWTH)

    def perpetuity_value(oe, g, r):
        if r <= g:
            return oe * 20  # Cap at 20x if growth exceeds required return
        value = oe / (r - g)
        # Cap at 30x owner earnings to prevent absurd valuations
        return min(value, oe * 30)
    
    cons_oe = owner_earnings_per_share * 0.85
    cons_g = growth_rate * 0.6
    cons_r = required_return + 0.03
    conservative = perpetuity_value(cons_oe, cons_g, cons_r)

    base_oe = owner_earnings_per_share
    base_g = growth_rate
    base_r = required_return
    base = perpetuity_value(base_oe, base_g, base_r)

    opt_oe = owner_earnings_per_share * 1.15
    opt_g = min(growth_rate * 1.3, required_return - 0.01)
    opt_r = required_return - 0.02
    optimistic = perpetuity_value(opt_oe, opt_g, opt_r)

    return ValuationRange(
        conservative=conservative,
        base=base,
        optimistic=optimistic,
        method="Owner Earnings (Buffett)",
        confidence=ValueConfidence.MEDIUM,
        assumptions={
            "owner_earnings_per_share": owner_earnings_per_share,
            "growth_rate": growth_rate,
            "required_return": required_return,
            "formula": "Value = Owner Earnings / (Required Return - Growth Rate)",
            "scenarios": {
                "conservative": {
                    "owner_earnings": round(cons_oe, 2),
                    "growth": f"{cons_g:.1%}",
                    "required_return": f"{cons_r:.1%}",
                    "value": round(conservative, 2),
                },
                "base": {
                    "owner_earnings": round(base_oe, 2),
                    "growth": f"{base_g:.1%}",
                    "required_return": f"{base_r:.1%}",
                    "value": round(base, 2),
                },
                "optimistic": {
                    "owner_earnings": round(opt_oe, 2),
                    "growth": f"{opt_g:.1%}",
                    "required_return": f"{opt_r:.1%}",
                    "value": round(optimistic, 2),
                },
            },
        }
    )


def build_composite_valuation(
    ticker: str,
    metrics: Dict[str, Any],
    quality_score: float
) -> CompositeValuationRange:
    """
    Build comprehensive valuation range from all available methods.
    
    This is the main entry point for creating a full valuation analysis.
    """
    ranges = []
    
    # DCF-based range
    if metrics.get('free_cash_flow') and metrics.get('shares_outstanding'):
        fcf_per_share = metrics['free_cash_flow'] / metrics['shares_outstanding']
        if fcf_per_share > 0:
            dcf_range = create_dcf_range(
                base_cashflow=fcf_per_share * metrics['shares_outstanding'],
                growth_rate=metrics.get('earnings_growth', 0.05),
                discount_rate=metrics.get('discount_rate', 0.10),
                shares_outstanding=metrics['shares_outstanding']
            )
            ranges.append(dcf_range)
    
    # Earnings-based range
    if metrics.get('eps') and metrics['eps'] > 0:
        earnings_range = create_earnings_range(
            eps=metrics['eps'],
            growth_rate=metrics.get('earnings_growth', 0.05),
            quality_score=quality_score,
            industry_pe=metrics.get('industry_pe', 15)
        )
        ranges.append(earnings_range)
    
    # Book value range
    if metrics.get('book_value_per_share') and metrics['book_value_per_share'] > 0:
        book_range = create_book_value_range(
            book_value_per_share=metrics['book_value_per_share'],
            roe=metrics.get('roe', 0.10),
            quality_score=quality_score
        )
        ranges.append(book_range)
    
    # Owner earnings range (Buffett method)
    if metrics.get('owner_earnings_per_share') and metrics['owner_earnings_per_share'] > 0:
        oe_range = create_owner_earnings_range(
            owner_earnings_per_share=metrics['owner_earnings_per_share'],
            growth_rate=metrics.get('earnings_growth', 0.05),
            required_return=metrics.get('required_return', 0.10)
        )
        ranges.append(oe_range)

    # Sanity check: Cap all valuations at reasonable P/E multiples
    # Even the best companies rarely sustain 50x P/E over the long term
    MAX_PE_CAP = 50
    eps = metrics.get('eps', 0)
    if eps and eps > 0:
        max_reasonable_value = eps * MAX_PE_CAP
        for r in ranges:
            r.conservative = min(r.conservative, max_reasonable_value * 0.7)
            r.base = min(r.base, max_reasonable_value)
            r.optimistic = min(r.optimistic, max_reasonable_value * 1.3)

    return CompositeValuationRange(
        ticker=ticker,
        individual_ranges=ranges,
        quality_score=quality_score
    )
