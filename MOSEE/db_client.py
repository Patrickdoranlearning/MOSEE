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

import numpy as np


def convert_numpy_types(value):
    """Convert numpy types to Python native types for database storage."""
    if value is None:
        return None
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, (np.integer, np.int64, np.int32)):
        return int(value)
    if isinstance(value, (np.floating, np.float64, np.float32)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    # Handle Python float NaN
    if isinstance(value, float) and (value != value or value == float('inf') or value == float('-inf')):
        return None
    return value


def clean_dict_for_json(d):
    """Recursively clean a dict/list, converting NaN/Inf/numpy types to JSON-safe values."""
    if isinstance(d, dict):
        return {k: clean_dict_for_json(v) for k, v in d.items()}
    if isinstance(d, list):
        return [clean_dict_for_json(item) for item in d]
    return convert_numpy_types(d)


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

    # Create raw data table for data transparency/auditing
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_raw_data (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticker TEXT NOT NULL,
            analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
            balance_sheet JSONB DEFAULT '{}'::jsonb,
            income_statement JSONB DEFAULT '{}'::jsonb,
            cash_flow JSONB DEFAULT '{}'::jsonb,
            market_data JSONB DEFAULT '{}'::jsonb,
            currency_info JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(ticker, analysis_date)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_raw_data_ticker ON mosee_raw_data(ticker)")

    # Create SEC filings cache table (for AI analysis)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_sec_filings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticker VARCHAR(20) NOT NULL,
            filing_year INTEGER NOT NULL,
            filing_type VARCHAR(10) DEFAULT '10-K',
            sections JSONB DEFAULT '{}'::jsonb,
            fetched_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(ticker, filing_year, filing_type)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON mosee_sec_filings(ticker)")

    # Create AI analysis results table (separate from quantitative analyses)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_ai_analyses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticker VARCHAR(20) NOT NULL,
            analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
            filing_years JSONB DEFAULT '[]'::jsonb,
            dimensions JSONB DEFAULT '[]'::jsonb,
            executive_summary TEXT,
            key_findings JSONB DEFAULT '[]'::jsonb,
            red_flags JSONB DEFAULT '[]'::jsonb,
            competitive_advantages JSONB DEFAULT '[]'::jsonb,
            management_assessment TEXT,
            composite_ai_score NUMERIC(5,2),
            model_used VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(ticker, analysis_date)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_analyses_ticker ON mosee_ai_analyses(ticker)")

    # ─── Wealth Tree Auth Tables ─────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            password_hash TEXT,
            email_verified TIMESTAMPTZ,
            image TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mosee_users_email ON mosee_users(email)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS mosee_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            provider TEXT NOT NULL,
            provider_account_id TEXT NOT NULL,
            refresh_token TEXT,
            access_token TEXT,
            expires_at INTEGER,
            token_type TEXT,
            scope TEXT,
            id_token TEXT,
            UNIQUE(provider, provider_account_id)
        )
    """)

    # ─── Wealth Tree Data Tables ─────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID UNIQUE NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            currency TEXT NOT NULL DEFAULT 'USD',
            annual_income NUMERIC,
            savings_rate_target NUMERIC DEFAULT 0.10,
            emergency_fund_target_months INTEGER DEFAULT 6,
            retirement_age_target INTEGER DEFAULT 65,
            current_age INTEGER,
            risk_tolerance TEXT DEFAULT 'moderate'
                CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_income (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            entry_date DATE NOT NULL,
            source TEXT NOT NULL DEFAULT 'salary',
            amount NUMERIC NOT NULL,
            is_recurring BOOLEAN DEFAULT true,
            recurrence_frequency TEXT DEFAULT NULL
                CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly')),
            recurring_parent_id UUID REFERENCES wt_income(id) ON DELETE CASCADE,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_income_user_date ON wt_income(user_id, entry_date DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_income_recurring ON wt_income(user_id) WHERE recurrence_frequency IS NOT NULL AND recurring_parent_id IS NULL")

    # Migration: add recurring columns if tables already exist
    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE wt_income ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT DEFAULT NULL;
            ALTER TABLE wt_income ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES wt_income(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_expenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            entry_date DATE NOT NULL,
            category TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            is_recurring BOOLEAN DEFAULT false,
            recurrence_frequency TEXT DEFAULT NULL
                CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly')),
            recurring_parent_id UUID REFERENCES wt_expenses(id) ON DELETE CASCADE,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_expenses_user_date ON wt_expenses(user_id, entry_date DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_expenses_recurring ON wt_expenses(user_id) WHERE recurrence_frequency IS NOT NULL AND recurring_parent_id IS NULL")

    # Migration: add recurring columns if tables already exist
    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE wt_expenses ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT DEFAULT NULL;
            ALTER TABLE wt_expenses ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES wt_expenses(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_savings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            entry_date DATE NOT NULL,
            amount NUMERIC NOT NULL,
            account_type TEXT DEFAULT 'general',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(user_id, entry_date, account_type)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_savings_user_date ON wt_savings(user_id, entry_date DESC)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_investments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            asset_type TEXT NOT NULL,
            name TEXT NOT NULL,
            ticker TEXT,
            purchase_date DATE,
            purchase_price NUMERIC,
            quantity NUMERIC,
            current_value NUMERIC,
            account TEXT DEFAULT 'taxable',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_investments_user ON wt_investments(user_id)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_net_worth (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            snapshot_date DATE NOT NULL,
            total_assets NUMERIC NOT NULL DEFAULT 0,
            total_liabilities NUMERIC NOT NULL DEFAULT 0,
            net_worth NUMERIC NOT NULL DEFAULT 0,
            breakdown JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(user_id, snapshot_date)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_net_worth_user_date ON wt_net_worth(user_id, snapshot_date DESC)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            cure_number INTEGER NOT NULL CHECK (cure_number BETWEEN 1 AND 7),
            title TEXT NOT NULL,
            description TEXT,
            target_amount NUMERIC,
            current_amount NUMERIC DEFAULT 0,
            target_date DATE,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
            tree_tier TEXT NOT NULL CHECK (tree_tier IN ('roots', 'trunk', 'branches', 'canopy', 'fruits')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_goals_user ON wt_goals(user_id)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_debts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            debt_type TEXT NOT NULL,
            original_amount NUMERIC,
            current_balance NUMERIC NOT NULL,
            interest_rate NUMERIC,
            minimum_payment NUMERIC,
            monthly_payment NUMERIC,
            payoff_date DATE,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_debts_user ON wt_debts(user_id)")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wt_skills (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES mosee_users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT,
            cost NUMERIC DEFAULT 0,
            expected_income_increase NUMERIC,
            start_date DATE,
            completion_date DATE,
            status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wt_skills_user ON wt_skills(user_id)")

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
                convert_numpy_types(result.get("Current Price")),
                convert_numpy_types(result.get("Market Cap")),
                intel.get("verdict", "INSUFFICIENT DATA"),
                quality_grade,
                convert_numpy_types(quality_score),
                convert_numpy_types(margin_of_safety),
                convert_numpy_types(has_margin_of_safety),
                convert_numpy_types(buy_below_price),
                convert_numpy_types(valuation_conservative),
                convert_numpy_types(valuation_base),
                convert_numpy_types(valuation_optimistic),
                valuation_confidence,
                Json(clean_dict_for_json(intel.get("perspectives", []))),
                Json(clean_dict_for_json(intel.get("strengths", []))),
                Json(clean_dict_for_json(intel.get("concerns", []))),
                Json(clean_dict_for_json(intel.get("action_items", []))),
                Json(clean_dict_for_json(result.get("all_metrics", {}))),
                convert_numpy_types(result.get("PAD MoS")),
                convert_numpy_types(result.get("DCF MoS")),
                convert_numpy_types(result.get("Book MoS")),
                convert_numpy_types(result.get("PAD MOSEE")),
                convert_numpy_types(result.get("DCF MOSEE")),
                convert_numpy_types(result.get("Book MOSEE")),
                result.get("confidence", {}).get("level"),
                convert_numpy_types(result.get("confidence", {}).get("score")),
            ))
            
            conn.commit()
            cur.close()
            return True
            
        except Exception as e:
            print(f"Error saving analysis for {result.get('Ticker Symbol', 'unknown')}: {e}")
            # Rollback the transaction to reset connection state
            try:
                conn = self._get_conn()
                conn.rollback()
            except:
                pass
            return False
    
    def save_raw_data(self, ticker: str, raw_data: Dict[str, Any]) -> bool:
        """
        Save raw yfinance data for a ticker (for data transparency/auditing).

        Args:
            ticker: Stock ticker symbol
            raw_data: Dictionary with keys: balance_sheet, income_statement,
                      cash_flow, market_data, currency_info
        """
        try:
            conn = self._get_conn()
            cur = conn.cursor()

            cur.execute("""
                INSERT INTO mosee_raw_data (
                    ticker, analysis_date,
                    balance_sheet, income_statement, cash_flow,
                    market_data, currency_info
                ) VALUES (
                    %s, CURRENT_DATE,
                    %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT (ticker, analysis_date) DO UPDATE SET
                    balance_sheet = EXCLUDED.balance_sheet,
                    income_statement = EXCLUDED.income_statement,
                    cash_flow = EXCLUDED.cash_flow,
                    market_data = EXCLUDED.market_data,
                    currency_info = EXCLUDED.currency_info
            """, (
                ticker,
                Json(clean_dict_for_json(raw_data.get('balance_sheet', {}))),
                Json(clean_dict_for_json(raw_data.get('income_statement', {}))),
                Json(clean_dict_for_json(raw_data.get('cash_flow', {}))),
                Json(clean_dict_for_json(raw_data.get('market_data', {}))),
                Json(clean_dict_for_json(raw_data.get('currency_info', {}))),
            ))

            conn.commit()
            cur.close()
            return True

        except Exception as e:
            print(f"Error saving raw data for {ticker}: {e}")
            try:
                conn = self._get_conn()
                conn.rollback()
            except:
                pass
            return False

    # ===== SEC Filing Cache Methods =====

    def save_filing(
        self,
        ticker: str,
        filing_year: int,
        filing_type: str,
        sections: Dict[str, Any],
    ) -> bool:
        """Cache a downloaded SEC filing."""
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mosee_sec_filings (ticker, filing_year, filing_type, sections)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (ticker, filing_year, filing_type) DO UPDATE SET
                    sections = EXCLUDED.sections,
                    fetched_at = NOW()
            """, (ticker, filing_year, filing_type, Json(clean_dict_for_json(sections))))
            conn.commit()
            cur.close()
            return True
        except Exception as e:
            print(f"Error caching filing for {ticker} {filing_year}: {e}")
            try:
                self._get_conn().rollback()
            except:
                pass
            return False

    def fetch_cached_filings(
        self, ticker: str, years: int = 3
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch cached SEC filings for a ticker.
        Returns None if no fresh cache exists (< 90 days old).
        """
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT ticker, filing_year, filing_type, sections,
                       fetched_at
                FROM mosee_sec_filings
                WHERE ticker = %s
                  AND fetched_at > NOW() - INTERVAL '90 days'
                ORDER BY filing_year DESC
                LIMIT %s
            """, (ticker, years))
            rows = cur.fetchall()
            cur.close()
            return [dict(r) for r in rows] if rows else None
        except Exception as e:
            print(f"Error fetching cached filings for {ticker}: {e}")
            return None

    # ===== AI Analysis Methods =====

    def save_ai_analysis(self, result: Dict[str, Any]) -> bool:
        """Save an AI analysis result."""
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mosee_ai_analyses (
                    ticker, analysis_date, filing_years, dimensions,
                    executive_summary, key_findings, red_flags,
                    competitive_advantages, management_assessment,
                    composite_ai_score, model_used
                ) VALUES (
                    %s, CURRENT_DATE, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s
                )
                ON CONFLICT (ticker, analysis_date) DO UPDATE SET
                    filing_years = EXCLUDED.filing_years,
                    dimensions = EXCLUDED.dimensions,
                    executive_summary = EXCLUDED.executive_summary,
                    key_findings = EXCLUDED.key_findings,
                    red_flags = EXCLUDED.red_flags,
                    competitive_advantages = EXCLUDED.competitive_advantages,
                    management_assessment = EXCLUDED.management_assessment,
                    composite_ai_score = EXCLUDED.composite_ai_score,
                    model_used = EXCLUDED.model_used
            """, (
                result.get('ticker'),
                Json(result.get('filing_years', [])),
                Json(clean_dict_for_json(result.get('dimensions', []))),
                result.get('executive_summary'),
                Json(result.get('key_findings', [])),
                Json(result.get('red_flags', [])),
                Json(result.get('competitive_advantages', [])),
                result.get('management_assessment'),
                convert_numpy_types(result.get('composite_ai_score')),
                result.get('model_used'),
            ))
            conn.commit()
            cur.close()
            return True
        except Exception as e:
            print(f"Error saving AI analysis for {result.get('ticker', 'unknown')}: {e}")
            try:
                self._get_conn().rollback()
            except:
                pass
            return False

    def fetch_ai_analysis(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetch the most recent AI analysis for a ticker."""
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM mosee_ai_analyses
                WHERE ticker = %s
                ORDER BY analysis_date DESC
                LIMIT 1
            """, (ticker,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None
        except Exception as e:
            print(f"Error fetching AI analysis for {ticker}: {e}")
            return None

    def fetch_stock_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetch the latest all_metrics and company info for a ticker."""
        try:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT ticker, company_name, industry, country, all_metrics
                FROM mosee_stock_analyses
                WHERE ticker = %s
                ORDER BY analysis_date DESC
                LIMIT 1
            """, (ticker,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None
        except Exception as e:
            print(f"Error fetching metrics for {ticker}: {e}")
            return None

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
