"""
MOSEE Scoring Module

Combines investment criteria from multiple sources into composite scores.
"""

from .composite_score import (
    CompositeScore,
    InvestmentStyle,
    calculate_composite_score,
    get_style_weights,
    calculate_all_component_scores
)

__all__ = [
    'CompositeScore',
    'InvestmentStyle',
    'calculate_composite_score',
    'get_style_weights',
    'calculate_all_component_scores'
]
