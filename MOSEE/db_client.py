"""
MOSEE Database Client Module

Handles all database operations for storing and retrieving
stock analysis results using PostgreSQL (Vercel Postgres).
"""

import os
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, parse_qs
import json

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
except ImportError:
    raise ImportError(
        "psycopg2 is required. Install with: pip install psycopg2-binary"
    )


def get_connection():
    """
    Create a database connection using environment variables.
    
    Supports Neon/Vercel Postgres connection strings.
    """
    # Try Vercel's combined URL first
    database_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    
    if database_url:
        # Parse the URL to extract components
        # Neon URLs look like: postgres://user:pass@host/dbname?sslmode=require
        parsed = urlparse(database_url)
        
        # Extract connection parameters
        dbname = parsed.path[1:] if parsed.path else None  # Remove leading /
        user = parsed.username
        password = parsed.password
        host = parsed.hostname
        port = parsed.port or 5432
        
        # Parse query parameters for sslmode
        query_params = parse_qs(parsed.query)
        sslmode = query_params.get('sslmode', ['require'])[0]
        
        return psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port,
            sslmode=sslmode,
            cursor_factory=RealDictCursor
        )
    
    # Fall back to individual variables
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST"),
        database=os.environ.get("POSTGRES_DATABASE"),
        user=os.environ.get("POSTGRES_USER"),
        password=os.environ.get("POSTGRES_PASSWORD"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        sslmode="require",
        cursor_factory=RealDictCursor
    )


def init_database():
    """
    Initialize database tables if they don't exist.
    Call this once when setting up the database.
    """
    conn = get_connection()
    cur = conn.cursor()
    
    # Create analysis runs table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_analysis_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_date TIMESTAMPTZ NOT NULL DEFAULT now(),
            stocks_analyzed INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    
    # Create stock analyses table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_stock_analyses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id UUID REFERENCES mosee_analysis_runs(id) ON DELETE CASCADE,
            ticker TEXT NOT NULL,
            company_name TEXT,
            industry TEXT,
            country TEXT,
            cap_size TEXT,
            analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
            current_price NUMERIC,
            market_cap NUMERIC,
            verdict TEXT NOT NULL CHECK (verdict IN (
                'STRONG BUY', 'BUY', 'ACCUMULATE', 'HOLD', 
                'WATCHLIST', 'REDUCE', 'SELL', 'AVOID', 'INSUFFICIENT DATA'
            )),
            quality_grade TEXT CHECK (quality_grade IN ('A+', 'A', 'B', 'C', 'D', 'F')),
            quality_score NUMERIC,
            margin_of_safety NUMERIC,
            has_margin_of_safety BOOLEAN DEFAULT false,
            buy_below_price NUMERIC,
            valuation_conservative NUMERIC,
            valuation_base NUMERIC,
            valuation_optimistic NUMERIC,
            valuation_confidence TEXT,
            perspectives JSONB DEFAULT '[]'::jsonb,
            strengths JSONB DEFAULT '[]'::jsonb,
            concerns JSONB DEFAULT '[]'::jsonb,
            action_items JSONB DEFAULT '[]'::jsonb,
            all_metrics JSONB DEFAULT '{}'::jsonb,
            pad_mos NUMERIC,
            dcf_mos NUMERIC,
            book_mos NUMERIC,
            pad_mosee NUMERIC,
            dcf_mosee NUMERIC,
            book_mosee NUMERIC,
            confidence_level TEXT,
            confidence_score NUMERIC,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(ticker, analysis_date)
        )
    """)
    
    # Create indexes
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_analyses_ticker ON mosee_stock_analyses(ticker)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_analyses_date ON mosee_stock_analyses(analysis_date DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_analyses_verdict ON mosee_stock_analyses(verdict)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_analyses_quality ON mosee_stock_analyses(quality_grade)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_analyses_run_id ON mosee_stock_analyses(run_id)")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("Database tables initialized successfully!")


class MOSEEDatabaseClient:
    """
    Client for MOSEE database operations.
    """
    
    def __init__(self):
        """Initialize the client."""
        self.conn = None
    
    def _get_conn(self):
        """Get or create a connection."""
        if self.conn is None or self.conn.closed:
            self.conn = get_connection()
        return self.conn
    
    def close(self):
        """Close the connection."""
        if self.conn and not self.conn.closed:
            self.conn.close()
    
    def start_analysis_run(self) -> str:
        """
        Create a new analysis run record.
        
        Returns:
            The ID of the created run.
        """
        conn = self._get_conn()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO mosee_analysis_runs (status, stocks_analyzed)
            VALUES ('running', 0)
            RETURNING id
        """)
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        
        return str(result['id'])
    
    def complete_analysis_run(
        self, 
        run_id: str, 
        stocks_analyzed: int, 
        error_message: Optional[str] = None
    ):
        """Mark an analysis run as completed or failed."""
        conn = self._get_conn()
        cur = conn.cursor()
        
        status = "failed" if error_message else "completed"
        
        cur.execute("""
            UPDATE mosee_analysis_runs 
            SET status = %s, stocks_analyzed = %s, error_message = %s
            WHERE id = %s
        """, (status, stocks_analyzed, error_message, run_id))
        
        conn.commit()
        cur.close()
    
    def save_analysis_result(self, run_id: str, result: Dict[str, Any]) -> bool:
        """
        Save a single stock analysis result.
        """
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            
            # Extract intelligence data
            intel = result.get("intelligence_report", {})
            
            # Handle nested structures
            if "quality" in intel:
                quality_grade = intel.get("quality", {}).get("grade")
                quality_score = intel.get("quality", {}).get("score")
            else:
                quality_grade = intel.get("quality_grade")
                quality_score = intel.get("quality_score")
            
            if "margin_of_safety" in intel and isinstance(intel["margin_of_safety"], dict):
                margin_of_safety = intel.get("margin_of_safety", {}).get("ratio")
                has_margin_of_safety = intel.get("margin_of_safety", {}).get("has_mos", False)
                buy_below_price = intel.get("margin_of_safety", {}).get("buy_below")
            else:
                margin_of_safety = intel.get("margin_of_safety")
                has_margin_of_safety = intel.get("has_margin_of_safety", False)
                buy_below_price = intel.get("buy_below_price")
            
            # Get valuation range
            valuation = intel.get("valuation", {})
            if isinstance(valuation, dict):
                composite = valuation.get("composite_range", {})
                valuation_conservative = composite.get("conservative")
                valuation_base = composite.get("base")
                valuation_optimistic = composite.get("optimistic")
                valuation_confidence = valuation.get("confidence")
            else:
                valuation_conservative = None
                valuation_base = None
                valuation_optimistic = None
                valuation_confidence = None
            
            # Upsert the record
            cur.execute("""
                INSERT INTO mosee_stock_analyses (
                    run_id, ticker, company_name, industry, country, cap_size,
                    analysis_date, current_price, market_cap, verdict,
                    quality_grade, quality_score, margin_of_safety, has_margin_of_safety,
                    buy_below_price, valuation_conservative, valuation_base, valuation_optimistic,
                    valuation_confidence, perspectives, strengths, concerns, action_items,
                    all_metrics, pad_mos, dcf_mos, book_mos, pad_mosee, dcf_mosee, book_mosee,
                    confidence_level, confidence_score
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    CURRENT_DATE, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT (ticker, analysis_date) DO UPDATE SET
                    run_id = EXCLUDED.run_id,
                    company_name = EXCLUDED.company_name,
                    current_price = EXCLUDED.current_price,
                    market_cap = EXCLUDED.market_cap,
                    verdict = EXCLUDED.verdict,
                    quality_grade = EXCLUDED.quality_grade,
                    quality_score = EXCLUDED.quality_score,
                    margin_of_safety = EXCLUDED.margin_of_safety,
                    has_margin_of_safety = EXCLUDED.has_margin_of_safety,
                    buy_below_price = EXCLUDED.buy_below_price,
                    valuation_conservative = EXCLUDED.valuation_conservative,
                    valuation_base = EXCLUDED.valuation_base,
                    valuation_optimistic = EXCLUDED.valuation_optimistic,
                    perspectives = EXCLUDED.perspectives,
                    strengths = EXCLUDED.strengths,
                    concerns = EXCLUDED.concerns,
                    action_items = EXCLUDED.action_items,
                    all_metrics = EXCLUDED.all_metrics,
                    pad_mos = EXCLUDED.pad_mos,
                    dcf_mos = EXCLUDED.dcf_mos,
                    book_mos = EXCLUDED.book_mos,
                    pad_mosee = EXCLUDED.pad_mosee,
                    dcf_mosee = EXCLUDED.dcf_mosee,
                    book_mosee = EXCLUDED.book_mosee,
                    confidence_level = EXCLUDED.confidence_level,
                    confidence_score = EXCLUDED.confidence_score,
                    updated_at = now()
            """, (
                run_id,
                result.get("Ticker Symbol", result.get("ticker")),
                result.get("company_name"),
                result.get("industry"),
                result.get("country"),
                result.get("cap_size"),
                result.get("Current Price"),
                result.get("Market Cap"),
                intel.get("verdict", "INSUFFICIENT DATA"),
                quality_grade,
                quality_score,
                margin_of_safety,
                has_margin_of_safety,
                buy_below_price,
                valuation_conservative,
                valuation_base,
                valuation_optimistic,
                valuation_confidence,
                Json(intel.get("perspectives", [])),
                Json(intel.get("strengths", [])),
                Json(intel.get("concerns", [])),
                Json(intel.get("action_items", [])),
                Json(result.get("all_metrics", {})),
                result.get("PAD MoS"),
                result.get("DCF MoS"),
                result.get("Book MoS"),
                result.get("PAD MOSEE"),
                result.get("DCF MOSEE"),
                result.get("Book MOSEE"),
                result.get("confidence", {}).get("level"),
                result.get("confidence", {}).get("score"),
            ))
            
            conn.commit()
            cur.close()
            return True
            
        except Exception as e:
            print(f"Error saving analysis for {result.get('Ticker Symbol', 'unknown')}: {e}")
            return False
    
    def save_batch_results(
        self, 
        run_id: str, 
        results: List[Dict[str, Any]],
        progress_callback: Optional[callable] = None
    ) -> int:
        """Save multiple analysis results."""
        saved_count = 0
        total = len(results)
        
        for i, result in enumerate(results):
            if self.save_analysis_result(run_id, result):
                saved_count += 1
            
            if progress_callback:
                progress_callback(i + 1, total)
        
        return saved_count


def get_client() -> MOSEEDatabaseClient:
    """Get a configured MOSEE database client."""
    return MOSEEDatabaseClient()
