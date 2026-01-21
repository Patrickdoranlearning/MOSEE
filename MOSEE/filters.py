"""
MOSEE Stock Filtering Module

Provides filtering capabilities for stock universe based on:
- Country (include/exclude lists)
- Market capitalization (mega, large, mid, small)
- Industry/sector
- Minimum confidence level
"""

import pandas as pd
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field


@dataclass
class FilterConfig:
    """Configuration for stock filtering."""
    
    # Country filters
    countries: Optional[List[str]] = None  # None = all countries
    exclude_countries: List[str] = field(default_factory=lambda: ["Russia"])
    
    # Market cap filters
    cap_sizes: Optional[List[str]] = None  # Options: mega, large, mid, small
    
    # Industry filters
    industries: Optional[List[str]] = None  # None = all industries
    exclude_industries: List[str] = field(default_factory=list)
    
    # Confidence filter
    min_confidence: str = "LOW"  # LOW, MEDIUM, HIGH
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert filter config to dictionary."""
        return {
            "countries": self.countries,
            "exclude_countries": self.exclude_countries,
            "cap_sizes": self.cap_sizes,
            "industries": self.industries,
            "exclude_industries": self.exclude_industries,
            "min_confidence": self.min_confidence
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FilterConfig":
        """Create filter config from dictionary."""
        return cls(
            countries=data.get("countries"),
            exclude_countries=data.get("exclude_countries", ["Russia"]),
            cap_sizes=data.get("cap_sizes"),
            industries=data.get("industries"),
            exclude_industries=data.get("exclude_industries", []),
            min_confidence=data.get("min_confidence", "LOW")
        )


# Preset filter configurations
PRESET_FILTERS = {
    "us_only": FilterConfig(
        countries=["United States"],
        cap_sizes=["mega", "large"],
    ),
    "developed_markets": FilterConfig(
        countries=["United States", "United Kingdom", "Germany", "France", 
                   "Japan", "Canada", "Australia", "Netherlands", "Switzerland"],
        exclude_countries=["Russia", "China"],
        cap_sizes=["mega", "large"],
    ),
    "global_mega": FilterConfig(
        cap_sizes=["mega"],
        exclude_countries=["Russia"],
    ),
    "tech_focus": FilterConfig(
        industries=["Software - Infrastructure", "Semiconductors", 
                    "Internet Content & Information", "Consumer Electronics",
                    "Software - Application", "Information Technology Services"],
        exclude_countries=["Russia", "China"],
    ),
    "dividend_stocks": FilterConfig(
        industries=["Banks - Diversified", "Insurance - Diversified",
                    "Utilities - Regulated Electric", "Oil & Gas Integrated"],
        cap_sizes=["mega", "large"],
    ),
}


def get_available_countries(ticker_df: pd.DataFrame) -> List[str]:
    """Get list of unique countries from ticker data."""
    if 'country' in ticker_df.columns:
        return sorted(ticker_df['country'].dropna().unique().tolist())
    return []


def get_available_industries(ticker_df: pd.DataFrame) -> List[str]:
    """Get list of unique industries from ticker data."""
    if 'industry' in ticker_df.columns:
        return sorted(ticker_df['industry'].dropna().unique().tolist())
    return []


def get_available_cap_sizes(ticker_df: pd.DataFrame) -> List[str]:
    """Get list of unique market cap sizes from ticker data."""
    if 'cap' in ticker_df.columns:
        return sorted(ticker_df['cap'].dropna().unique().tolist())
    return []


def apply_filters(ticker_df: pd.DataFrame, config: FilterConfig) -> pd.DataFrame:
    """
    Apply filter configuration to ticker DataFrame.
    
    Args:
        ticker_df: DataFrame with columns: ticker, cap, country, industry
        config: FilterConfig with filtering criteria
        
    Returns:
        Filtered DataFrame
    """
    filtered_df = ticker_df.copy()
    
    # Apply country filter (include list)
    if config.countries:
        filtered_df = filtered_df[filtered_df['country'].isin(config.countries)]
    
    # Apply country exclusion
    if config.exclude_countries:
        filtered_df = filtered_df[~filtered_df['country'].isin(config.exclude_countries)]
    
    # Apply market cap filter
    if config.cap_sizes:
        filtered_df = filtered_df[filtered_df['cap'].isin(config.cap_sizes)]
    
    # Apply industry filter (include list)
    if config.industries:
        filtered_df = filtered_df[filtered_df['industry'].isin(config.industries)]
    
    # Apply industry exclusion
    if config.exclude_industries:
        filtered_df = filtered_df[~filtered_df['industry'].isin(config.exclude_industries)]
    
    return filtered_df


def filter_by_confidence(profiles: List[Dict], min_confidence: str) -> List[Dict]:
    """
    Filter investment profiles by minimum confidence level.
    
    Args:
        profiles: List of investment profile dictionaries
        min_confidence: Minimum confidence level (LOW, MEDIUM, HIGH)
        
    Returns:
        Filtered list of profiles
    """
    confidence_levels = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    min_level = confidence_levels.get(min_confidence.upper(), 0)
    
    filtered = []
    for profile in profiles:
        profile_level = confidence_levels.get(
            profile.get("confidence", {}).get("level", "LOW").upper(), 0
        )
        if profile_level >= min_level:
            filtered.append(profile)
    
    return filtered


def get_filter_summary(ticker_df: pd.DataFrame, config: FilterConfig) -> Dict[str, Any]:
    """
    Get summary of filter results.
    
    Args:
        ticker_df: Original ticker DataFrame
        config: Filter configuration applied
        
    Returns:
        Dictionary with filter statistics
    """
    filtered_df = apply_filters(ticker_df, config)
    
    return {
        "original_count": len(ticker_df),
        "filtered_count": len(filtered_df),
        "removed_count": len(ticker_df) - len(filtered_df),
        "countries_included": filtered_df['country'].nunique() if 'country' in filtered_df.columns else 0,
        "industries_included": filtered_df['industry'].nunique() if 'industry' in filtered_df.columns else 0,
        "cap_distribution": filtered_df['cap'].value_counts().to_dict() if 'cap' in filtered_df.columns else {},
    }
