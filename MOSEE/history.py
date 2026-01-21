"""
MOSEE History Tracking Module

Stores monthly snapshots of investment profiles and provides
comparison capabilities for tracking changes over time.
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

from .profile import InvestmentProfile


@dataclass
class HistoryConfig:
    """Configuration for history storage."""
    base_path: str = "outputs/history"
    use_sqlite: bool = True  # Use SQLite for efficient querying
    keep_json: bool = True   # Also keep JSON files for human readability


class HistoryTracker:
    """Tracks investment profile history over time."""
    
    def __init__(self, config: Optional[HistoryConfig] = None):
        self.config = config or HistoryConfig()
        self.base_path = Path(self.config.base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        if self.config.use_sqlite:
            self.db_path = self.base_path / "mosee_history.db"
            self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                analysis_date TEXT NOT NULL,
                analysis_month TEXT NOT NULL,
                confidence_level TEXT,
                confidence_score REAL,
                pad_mos REAL,
                dcf_mos REAL,
                pad_mosee REAL,
                dcf_mosee REAL,
                current_price REAL,
                market_cap REAL,
                recommendation TEXT,
                profile_json TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ticker, analysis_month)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_ticker ON profiles(ticker)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_month ON profiles(analysis_month)
        """)
        
        conn.commit()
        conn.close()
    
    def save_profile(self, profile: InvestmentProfile) -> None:
        """
        Save an investment profile to history.
        
        Args:
            profile: InvestmentProfile to save
        """
        analysis_month = profile.analysis_date[:7]  # YYYY-MM
        
        # Save to SQLite
        if self.config.use_sqlite:
            self._save_to_sqlite(profile, analysis_month)
        
        # Save to JSON
        if self.config.keep_json:
            self._save_to_json(profile, analysis_month)
    
    def _save_to_sqlite(self, profile: InvestmentProfile, analysis_month: str) -> None:
        """Save profile to SQLite database."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO profiles 
            (ticker, analysis_date, analysis_month, confidence_level, confidence_score,
             pad_mos, dcf_mos, pad_mosee, dcf_mosee, current_price, market_cap,
             recommendation, profile_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            profile.company.ticker,
            profile.analysis_date,
            analysis_month,
            profile.confidence.level,
            profile.confidence.score,
            profile.mos_scores.pad_mos,
            profile.mos_scores.dcf_mos,
            profile.mosee_scores.pad_mosee,
            profile.mosee_scores.dcf_mosee,
            profile.market_data.current_price,
            profile.market_data.market_cap,
            profile.recommendation,
            profile.to_json()
        ))
        
        conn.commit()
        conn.close()
    
    def _save_to_json(self, profile: InvestmentProfile, analysis_month: str) -> None:
        """Save profile to JSON file."""
        month_path = self.base_path / analysis_month
        month_path.mkdir(parents=True, exist_ok=True)
        
        file_path = month_path / f"{profile.company.ticker}.json"
        with open(file_path, 'w') as f:
            f.write(profile.to_json())
    
    def save_batch(self, profiles: List[InvestmentProfile]) -> None:
        """
        Save multiple profiles efficiently.
        
        Args:
            profiles: List of profiles to save
        """
        if not profiles:
            return
        
        analysis_month = profiles[0].analysis_date[:7]
        
        if self.config.use_sqlite:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            for profile in profiles:
                cursor.execute("""
                    INSERT OR REPLACE INTO profiles 
                    (ticker, analysis_date, analysis_month, confidence_level, confidence_score,
                     pad_mos, dcf_mos, pad_mosee, dcf_mosee, current_price, market_cap,
                     recommendation, profile_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    profile.company.ticker,
                    profile.analysis_date,
                    analysis_month,
                    profile.confidence.level,
                    profile.confidence.score,
                    profile.mos_scores.pad_mos,
                    profile.mos_scores.dcf_mos,
                    profile.mosee_scores.pad_mosee,
                    profile.mosee_scores.dcf_mosee,
                    profile.market_data.current_price,
                    profile.market_data.market_cap,
                    profile.recommendation,
                    profile.to_json()
                ))
            
            conn.commit()
            conn.close()
        
        if self.config.keep_json:
            for profile in profiles:
                self._save_to_json(profile, analysis_month)
    
    def get_profile(self, ticker: str, month: Optional[str] = None) -> Optional[InvestmentProfile]:
        """
        Get a profile for a specific ticker and month.
        
        Args:
            ticker: Stock ticker symbol
            month: Month in YYYY-MM format (default: current month)
            
        Returns:
            InvestmentProfile if found, None otherwise
        """
        if month is None:
            month = datetime.now().strftime("%Y-%m")
        
        if self.config.use_sqlite:
            return self._get_from_sqlite(ticker, month)
        else:
            return self._get_from_json(ticker, month)
    
    def _get_from_sqlite(self, ticker: str, month: str) -> Optional[InvestmentProfile]:
        """Get profile from SQLite."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT profile_json FROM profiles
            WHERE ticker = ? AND analysis_month = ?
        """, (ticker, month))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            data = json.loads(row[0])
            return InvestmentProfile.from_dict(data)
        return None
    
    def _get_from_json(self, ticker: str, month: str) -> Optional[InvestmentProfile]:
        """Get profile from JSON file."""
        file_path = self.base_path / month / f"{ticker}.json"
        
        if file_path.exists():
            with open(file_path, 'r') as f:
                data = json.load(f)
                return InvestmentProfile.from_dict(data)
        return None
    
    def get_previous_profile(self, ticker: str, current_month: str) -> Optional[InvestmentProfile]:
        """
        Get the most recent profile before the current month.
        
        Args:
            ticker: Stock ticker symbol
            current_month: Current month in YYYY-MM format
            
        Returns:
            Previous InvestmentProfile if found, None otherwise
        """
        if self.config.use_sqlite:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT profile_json FROM profiles
                WHERE ticker = ? AND analysis_month < ?
                ORDER BY analysis_month DESC
                LIMIT 1
            """, (ticker, current_month))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                data = json.loads(row[0])
                return InvestmentProfile.from_dict(data)
        
        return None
    
    def get_ticker_history(self, ticker: str, months: int = 12) -> List[InvestmentProfile]:
        """
        Get historical profiles for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            months: Number of months of history to retrieve
            
        Returns:
            List of InvestmentProfiles ordered by date
        """
        if self.config.use_sqlite:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT profile_json FROM profiles
                WHERE ticker = ?
                ORDER BY analysis_month DESC
                LIMIT ?
            """, (ticker, months))
            
            rows = cursor.fetchall()
            conn.close()
            
            profiles = []
            for row in rows:
                data = json.loads(row[0])
                profiles.append(InvestmentProfile.from_dict(data))
            
            return profiles[::-1]  # Reverse to get chronological order
        
        return []
    
    def get_available_months(self) -> List[str]:
        """Get list of months with stored data."""
        if self.config.use_sqlite:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT DISTINCT analysis_month FROM profiles
                ORDER BY analysis_month DESC
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            return [row[0] for row in rows]
        
        return sorted([d.name for d in self.base_path.iterdir() if d.is_dir()], reverse=True)
    
    def compare_months(
        self, 
        current_profile: InvestmentProfile,
        previous_profile: Optional[InvestmentProfile]
    ) -> Dict[str, Any]:
        """
        Compare current profile with previous month's profile.
        
        Args:
            current_profile: Current month's profile
            previous_profile: Previous month's profile
            
        Returns:
            Dictionary with comparison metrics
        """
        if previous_profile is None:
            return {"has_previous": False}
        
        comparison = {
            "has_previous": True,
            "previous_month": previous_profile.analysis_date[:7],
            "changes": {}
        }
        
        # Price change
        if current_profile.market_data.current_price and previous_profile.market_data.current_price:
            price_change = (
                (current_profile.market_data.current_price - previous_profile.market_data.current_price)
                / previous_profile.market_data.current_price * 100
            )
            comparison["changes"]["price_change_pct"] = round(price_change, 2)
        
        # PAD MoS change
        if current_profile.mos_scores.pad_mos and previous_profile.mos_scores.pad_mos:
            mos_change = current_profile.mos_scores.pad_mos - previous_profile.mos_scores.pad_mos
            comparison["changes"]["pad_mos_change"] = round(mos_change, 3)
        
        # PAD MOSEE change
        if current_profile.mosee_scores.pad_mosee and previous_profile.mosee_scores.pad_mosee:
            mosee_change = current_profile.mosee_scores.pad_mosee - previous_profile.mosee_scores.pad_mosee
            comparison["changes"]["pad_mosee_change"] = round(mosee_change, 4)
        
        # Confidence change
        confidence_change = current_profile.confidence.score - previous_profile.confidence.score
        comparison["changes"]["confidence_change"] = round(confidence_change, 1)
        
        # Recommendation change
        if current_profile.recommendation != previous_profile.recommendation:
            comparison["changes"]["recommendation_changed"] = True
            comparison["changes"]["previous_recommendation"] = previous_profile.recommendation
        else:
            comparison["changes"]["recommendation_changed"] = False
        
        # Rank change (if available)
        if current_profile.rank and previous_profile.rank:
            rank_change = previous_profile.rank - current_profile.rank  # Positive = improved
            comparison["changes"]["rank_change"] = rank_change
        
        return comparison
    
    def enrich_with_history(self, profile: InvestmentProfile) -> InvestmentProfile:
        """
        Enrich a profile with historical comparison data.
        
        Args:
            profile: Current investment profile
            
        Returns:
            Profile with previous_month and month_over_month_change filled in
        """
        current_month = profile.analysis_date[:7]
        previous = self.get_previous_profile(profile.company.ticker, current_month)
        
        if previous:
            profile.previous_month = previous.to_dict()
            profile.month_over_month_change = self.compare_months(profile, previous)
        
        return profile
    
    def get_top_movers(self, current_month: str, metric: str = "pad_mosee", top_n: int = 10) -> Dict[str, List[Dict]]:
        """
        Get stocks with biggest changes from previous month.
        
        Args:
            current_month: Current month in YYYY-MM format
            metric: Metric to track (pad_mosee, pad_mos, etc.)
            top_n: Number of results to return
            
        Returns:
            Dictionary with 'gainers' and 'losers' lists
        """
        if not self.config.use_sqlite:
            return {"gainers": [], "losers": []}
        
        # Calculate previous month
        year, month = map(int, current_month.split('-'))
        if month == 1:
            prev_month = f"{year-1}-12"
        else:
            prev_month = f"{year}-{month-1:02d}"
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Get column name for the metric
        column_map = {
            "pad_mosee": "pad_mosee",
            "dcf_mosee": "dcf_mosee",
            "pad_mos": "pad_mos",
            "dcf_mos": "dcf_mos"
        }
        column = column_map.get(metric, "pad_mosee")
        
        cursor.execute(f"""
            SELECT 
                c.ticker,
                c.{column} as current_value,
                p.{column} as previous_value,
                (c.{column} - p.{column}) as change
            FROM profiles c
            INNER JOIN profiles p ON c.ticker = p.ticker
            WHERE c.analysis_month = ? AND p.analysis_month = ?
            AND c.{column} IS NOT NULL AND p.{column} IS NOT NULL
            ORDER BY change DESC
        """, (current_month, prev_month))
        
        rows = cursor.fetchall()
        conn.close()
        
        gainers = [
            {"ticker": r[0], "current": r[1], "previous": r[2], "change": r[3]}
            for r in rows[:top_n] if r[3] > 0
        ]
        
        losers = [
            {"ticker": r[0], "current": r[1], "previous": r[2], "change": r[3]}
            for r in rows[-top_n:][::-1] if r[3] < 0
        ]
        
        return {"gainers": gainers, "losers": losers}
