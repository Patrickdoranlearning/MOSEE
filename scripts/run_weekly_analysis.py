#!/usr/bin/env python3
"""
MOSEE Weekly Analysis Runner

This script runs the full MOSEE stock analysis and pushes results to Supabase.
Designed to be run weekly via GitHub Actions or manually.

Usage:
    python scripts/run_weekly_analysis.py
    
Environment Variables Required:
    POSTGRES_URL - PostgreSQL connection URL (Vercel Postgres)
    
Optional:
    MOSEE_DEBUG - Set to "1" to analyze fewer stocks for testing
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

from MOSEE.db_client import MOSEEDatabaseClient, init_database


def print_banner():
    """Print MOSEE banner."""
    print("""
    ╔══════════════════════════════════════════════════════════════════╗
    ║   ███╗   ███╗ ██████╗ ███████╗███████╗███████╗                   ║
    ║   ████╗ ████║██╔═══██╗██╔════╝██╔════╝██╔════╝                   ║
    ║   ██╔████╔██║██║   ██║███████╗█████╗  █████╗                     ║
    ║   ██║╚██╔╝██║██║   ██║╚════██║██╔══╝  ██╔══╝                     ║
    ║   ██║ ╚═╝ ██║╚██████╔╝███████║███████╗███████╗                   ║
    ║   ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝                   ║
    ║                                                                  ║
    ║   Weekly Analysis Runner - Supabase Integration                  ║
    ╚══════════════════════════════════════════════════════════════════╝
    """)


def load_ticker_data() -> pd.DataFrame:
    """Load ticker data from CSV."""
    csv_path = Path(__file__).parent.parent / "data" / "ticker_data_enhanced.csv"
    
    if not csv_path.exists():
        raise FileNotFoundError(f"Ticker data file not found: {csv_path}")
    
    return pd.read_csv(csv_path)


def run_single_analysis(
    ticker: str,
    start_date: str,
    end_date: str,
    ticker_info: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Run MOSEE analysis on a single ticker with full intelligence.
    
    Returns analysis data dictionary or None if analysis failed.
    """
    from MOSEE.data_retrieval.fundamental_data import (
        fundamental_downloads, net_income_expected,
        balance_sheet_data_dic, dividends_expected_dic,
        income_statement_data_dic, cash_flow_data_dic,
        get_owners_earnings, get_invested_capital, get_shares_outstanding
    )
    from MOSEE.data_retrieval.market_data import get_stock_data
    from MOSEE.fundamental_analysis.indicators import (
        get_earnings_equity, calculate_graham_number,
        calculate_roe, calculate_roic, calculate_interest_coverage,
        calculate_debt_to_equity, get_lynch_metrics,
        calculate_graham_defensive_criteria
    )
    from MOSEE.fundamental_analysis.valuation import (
        dcf_valuation, pad_valuation, pad_valuation_dividend,
        book_value, calculate_average_price
    )
    from MOSEE.fundamental_analysis.magic_formula import calculate_magic_formula_metrics
    from MOSEE.fundamental_analysis.growth_metrics import get_fisher_metrics
    from MOSEE.MOS import mos_dollar
    from MOSEE.confidence import calculate_confidence
    from MOSEE.mosee_intelligence import generate_mosee_intelligence
    
    try:
        # Get stock data
        stock_data, stock_cap, stock_currency = get_stock_data(ticker, start_date, end_date)
        
        if stock_data is None or stock_data.empty:
            return None
        
        current_price = stock_data['Close'].iloc[-1]
        if pd.isnull(current_price):
            return None
        
        # Get fundamental data
        fundamentals = fundamental_downloads(ticker)
        cash_flow = fundamentals['cash_flow_statements']
        balance_sheet = fundamentals['balance_sheet_statements']
        income_statement = fundamentals['income_sheet_statements']
        
        if cash_flow is None or cash_flow.empty:
            return None
        if balance_sheet is None or balance_sheet.empty:
            return None
        
        # Get shares outstanding
        shares_outstanding = get_shares_outstanding(ticker)
        if shares_outstanding == 0:
            shares_outstanding = stock_cap / current_price if current_price > 0 else 1
        
        # Calculate base metrics
        net_income_dic = net_income_expected(cash_flow, 10)
        balance_sheet_dic = balance_sheet_data_dic(balance_sheet)
        dividends_dic = dividends_expected_dic(cash_flow)
        
        # Income statement metrics
        income_dic = {}
        if income_statement is not None and not income_statement.empty:
            income_dic = income_statement_data_dic(income_statement)
        
        # Cash flow metrics
        cf_dic = cash_flow_data_dic(cash_flow)
        
        # Owner earnings (Buffett)
        owners_earnings_dic = get_owners_earnings(income_statement, cash_flow)
        
        # Invested capital
        invested_capital_dic = get_invested_capital(balance_sheet)
        
        # Basic Valuations
        dcf_value = dcf_valuation(net_income_dic)
        pad_value = pad_valuation(net_income_dic)
        market_average_value = calculate_average_price(stock_data)
        pad_dividend_valuation = pad_valuation_dividend(dividends_dic)
        book_valuation = book_value(balance_sheet_dic)
        
        # Calculate per-share values
        book_value_per_share = book_valuation / shares_outstanding if shares_outstanding > 0 else 0
        eps = income_dic.get('eps_latest', net_income_dic['net_income_average'] / shares_outstanding if shares_outstanding > 0 else 0)
        
        # Earnings/Equity
        earnings_equity = get_earnings_equity(net_income_dic, stock_cap)
        
        # ========== BOOK INTELLIGENCE METRICS ==========
        
        # Graham Metrics
        graham_number = calculate_graham_number(eps, book_value_per_share)
        graham_mos = current_price / graham_number if graham_number > 0 else float('inf')
        
        revenue = income_dic.get('revenue_latest', 0)
        current_assets_latest = balance_sheet_dic['current_assets'].iloc[-1] if hasattr(balance_sheet_dic['current_assets'], 'iloc') else 0
        current_liabilities_latest = balance_sheet_dic['current_liabilities'].iloc[-1] if hasattr(balance_sheet_dic['current_liabilities'], 'iloc') else 1
        long_term_debt_latest = balance_sheet_dic['long_term_debt'].iloc[-1] if hasattr(balance_sheet_dic['long_term_debt'], 'iloc') else 0
        
        net_income_series = pd.Series()
        if 'net_income_df' in net_income_dic and isinstance(net_income_dic['net_income_df'], pd.Series):
            net_income_series = net_income_dic['net_income_df']
        
        dividends_series = pd.Series()
        if 'dividends_df' in dividends_dic and isinstance(dividends_dic['dividends_df'], pd.Series):
            dividends_series = dividends_dic['dividends_df']
        
        eps_10yr_ago = eps * 0.7
        
        graham_criteria = calculate_graham_defensive_criteria(
            revenue=revenue,
            current_assets=current_assets_latest,
            current_liabilities=current_liabilities_latest,
            long_term_debt=long_term_debt_latest,
            net_income_history=net_income_series,
            dividends_history=dividends_series,
            eps_current=eps,
            eps_10yr_ago=eps_10yr_ago,
            current_price=current_price,
            book_value_per_share=book_value_per_share
        )
        graham_score = graham_criteria.score
        
        pe_ratio = current_price / eps if eps > 0 else None
        pb_ratio = current_price / book_value_per_share if book_value_per_share > 0 else None
        
        # Buffett/Munger Metrics
        stockholders_equity = balance_sheet_dic['stockholders_equity'].iloc[-1] if hasattr(balance_sheet_dic['stockholders_equity'], 'iloc') else 0
        net_income_latest = income_dic.get('net_income_latest', net_income_dic['net_income_average'])
        
        roe = calculate_roe(net_income_latest, stockholders_equity)
        
        invested_capital = invested_capital_dic.get('invested_capital_latest', 0)
        ebit = income_dic.get('ebit_latest', 0)
        tax_rate = 0.25
        nopat = ebit * (1 - tax_rate)
        roic = calculate_roic(nopat, invested_capital) if invested_capital > 0 else 0
        
        total_debt_latest = balance_sheet_dic['total_debt'].iloc[-1] if hasattr(balance_sheet_dic['total_debt'], 'iloc') else 0
        interest_expense = income_dic.get('interest_expense_latest', 0)
        
        debt_to_equity = calculate_debt_to_equity(total_debt_latest, stockholders_equity)
        interest_coverage = calculate_interest_coverage(ebit, interest_expense)
        
        owner_earnings_latest = owners_earnings_dic.get('owners_earnings_latest', 0)
        owner_earnings_per_share = owner_earnings_latest / shares_outstanding if shares_outstanding > 0 else 0
        owner_earnings_yield = owner_earnings_latest / stock_cap if stock_cap > 0 else 0
        
        # Lynch Metrics
        earnings_growth = net_income_dic.get('net_income_average_growth', 0)
        if earnings_growth == 0:
            earnings_growth = 0.05
        
        cash_on_hand = balance_sheet_dic.get('cash_onhand', 0)
        
        lynch_metrics = get_lynch_metrics(
            current_price=current_price,
            eps=eps,
            earnings_growth_rate=abs(earnings_growth),
            cash=cash_on_hand,
            total_debt=total_debt_latest,
            shares_outstanding=shares_outstanding,
            inventory=balance_sheet_dic['inventory'].iloc[-1] if hasattr(balance_sheet_dic['inventory'], 'iloc') else 0,
            revenue=revenue,
            dividend_yield=0
        )
        peg_ratio = lynch_metrics.get('peg_ratio')
        lynch_category = lynch_metrics.get('lynch_category', 'Unknown')
        net_cash_per_share = lynch_metrics.get('net_cash_per_share', 0)
        
        # Greenblatt Magic Formula
        net_ppe = balance_sheet_dic['net_ppe'].iloc[-1] if hasattr(balance_sheet_dic['net_ppe'], 'iloc') else 0
        
        magic_formula = calculate_magic_formula_metrics(
            ticker=ticker,
            ebit=ebit,
            market_cap=stock_cap,
            total_debt=total_debt_latest,
            cash=cash_on_hand,
            current_assets=current_assets_latest,
            current_liabilities=current_liabilities_latest,
            net_ppe=net_ppe
        )
        earnings_yield = magic_formula.earnings_yield
        return_on_capital = magic_formula.return_on_capital
        
        # Fisher Growth Metrics
        revenue_series = income_dic.get('revenue', pd.Series())
        operating_margin_series = income_dic.get('operating_margin', pd.Series())
        net_margin_series = income_dic.get('net_margin', pd.Series())
        
        fisher_metrics = get_fisher_metrics(
            revenue_series=revenue_series,
            operating_margin_series=operating_margin_series,
            net_margin_series=net_margin_series,
            net_income_series=net_income_series,
            dividends_series=dividends_series,
            roe=roe
        )
        sales_cagr = fisher_metrics.sales_cagr
        margin_trend = fisher_metrics.margin_trend
        margin_trend_score = fisher_metrics.margin_trend_score
        growth_quality_score = fisher_metrics.growth_quality_score
        
        # MoS Calculations
        market_mos = mos_dollar(current_price, market_average_value) if market_average_value != 0 else 0
        pad_mos = mos_dollar(stock_cap, pad_value) if pad_value != 0 else 0
        dcf_mos = mos_dollar(stock_cap, dcf_value) if dcf_value != 0 else 0
        pad_dividend_mos = mos_dollar(stock_cap, pad_dividend_valuation) if pad_dividend_valuation != 0 else 0
        book_mos = mos_dollar(stock_cap, book_valuation) if book_valuation != 0 else 0
        
        # MOSEE calculations
        if (market_mos < 0 or pad_mos < 0 or dcf_mos < 0) and earnings_equity < 0:
            market_MOSEE = pad_MOSEE = dcf_MOSEE = pad_dividend_MOSEE = book_MOSEE = 0
        else:
            market_MOSEE = earnings_equity * (1 / market_mos) if market_mos != 0 else 0
            pad_MOSEE = earnings_equity * (1 / pad_mos) if pad_mos != 0 else 0
            dcf_MOSEE = earnings_equity * (1 / dcf_mos) if dcf_mos != 0 else 0
            pad_dividend_MOSEE = earnings_equity * (1 / pad_dividend_mos) if pad_dividend_mos != 0 else 0
            book_MOSEE = earnings_equity * (1 / book_mos) if book_mos != 0 else 0
        
        # Confidence score
        confidence = calculate_confidence(
            cash_flow_df=cash_flow,
            balance_sheet_df=balance_sheet,
            market_cap=stock_cap,
            current_price=current_price,
            dcf_value=dcf_value,
            pad_value=pad_value,
            book_value=book_valuation
        )
        
        # Compile all metrics for intelligence engine
        all_metrics = {
            'graham_score': graham_score,
            'graham_criteria_score': graham_score,
            'graham_mos': graham_mos,
            'pe_ratio': pe_ratio,
            'pb_ratio': pb_ratio,
            'current_ratio': current_assets_latest / current_liabilities_latest if current_liabilities_latest > 0 else 0,
            'roe': roe,
            'roic': roic,
            'debt_to_equity': debt_to_equity,
            'interest_coverage': interest_coverage,
            'owner_earnings_yield': owner_earnings_yield,
            'owner_earnings_per_share': owner_earnings_per_share,
            'peg_ratio': peg_ratio,
            'earnings_growth': abs(earnings_growth),
            'lynch_category': lynch_category,
            'net_cash_per_share': net_cash_per_share,
            'current_price': current_price,
            'earnings_yield': earnings_yield,
            'return_on_capital': return_on_capital,
            'sales_cagr': sales_cagr,
            'margin_trend': margin_trend,
            'margin_trend_score': margin_trend_score,
            'growth_quality_score': growth_quality_score,
            'eps': eps,
            'book_value_per_share': book_value_per_share,
            'free_cash_flow': cf_dic.get('fcf_latest', 0),
            'shares_outstanding': shares_outstanding,
            'industry_pe': 15,
        }
        
        # Generate intelligence report
        intel_report = generate_mosee_intelligence(
            ticker=ticker,
            current_price=current_price,
            metrics=all_metrics,
            required_mos=0.7
        )
        
        return {
            'Ticker Symbol': ticker,
            'company_name': ticker_info.get('name'),
            'industry': ticker_info.get('industry'),
            'country': ticker_info.get('country'),
            'cap_size': ticker_info.get('cap'),
            'Market MoS': market_mos,
            'PAD MoS': pad_mos,
            'Pad Dividend MoS': pad_dividend_mos,
            'DCF MoS': dcf_mos,
            'Book MoS': book_mos,
            'Average Market Price': market_average_value,
            'Current Price': current_price,
            'PAD Value': pad_value,
            'PAD Dividend Value': pad_dividend_valuation,
            'DCF Value': dcf_value,
            'Book Value': book_valuation,
            'Market Cap': stock_cap,
            'Earnings per Dollar Equity': earnings_equity,
            'Market MOSEE': market_MOSEE,
            'PAD MOSEE': pad_MOSEE,
            'Pad Dividend MOSEE': pad_dividend_MOSEE,
            'DCF MOSEE': dcf_MOSEE,
            'Book MOSEE': book_MOSEE,
            'confidence': confidence.to_dict(),
            'intelligence_report': intel_report.to_dict(),
            'all_metrics': all_metrics,
        }
        
    except Exception as e:
        print(f"    Error analyzing {ticker}: {e}")
        return None


def run_analysis(
    ticker_df: pd.DataFrame,
    countries: Optional[List[str]] = None,
    cap_sizes: Optional[List[str]] = None,
    max_stocks: Optional[int] = None,
    debug: bool = False
) -> List[Dict[str, Any]]:
    """
    Run MOSEE analysis on filtered stocks.
    
    Args:
        ticker_df: DataFrame with ticker data
        countries: Filter to specific countries
        cap_sizes: Filter to specific cap sizes
        max_stocks: Maximum number of stocks to analyze
        debug: If True, analyze fewer stocks for testing
        
    Returns:
        List of analysis result dictionaries
    """
    # Apply filters
    filtered_df = ticker_df.copy()
    
    # Default filters for quality analysis
    if countries is None:
        countries = ["United States", "United Kingdom", "Canada", "Germany", "France", "Japan", "Australia"]
    
    if cap_sizes is None:
        cap_sizes = ["mega", "large"]
    
    # Exclude Russia
    filtered_df = filtered_df[~filtered_df['country'].isin(['Russia'])]
    
    # Apply country filter
    if countries:
        filtered_df = filtered_df[filtered_df['country'].isin(countries)]
    
    # Apply cap size filter
    if cap_sizes and 'cap' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['cap'].isin(cap_sizes)]
    
    # Limit for debug mode
    if debug:
        filtered_df = filtered_df.head(5)
        print(f"  [DEBUG MODE] Limiting to {len(filtered_df)} stocks")
    elif max_stocks:
        filtered_df = filtered_df.head(max_stocks)
    
    print(f"  Analyzing {len(filtered_df)} stocks...")
    
    # Date range
    start_date = "2020-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")
    
    results = []
    total = len(filtered_df)
    
    for idx, (_, row) in enumerate(filtered_df.iterrows()):
        ticker = row['ticker']
        
        ticker_info = {
            'name': row.get('name'),
            'country': row.get('country'),
            'industry': row.get('industry'),
            'cap': row.get('cap'),
            'currency': row.get('currency'),
        }
        
        print(f"  [{idx + 1}/{total}] Analyzing {ticker}...", end=" ")
        
        try:
            result = run_single_analysis(ticker, start_date, end_date, ticker_info)
            
            if result:
                results.append(result)
                verdict = result.get('intelligence_report', {}).get('verdict', 'N/A')
                print(f"✓ {verdict}")
            else:
                print("✗ No data")
        except Exception as e:
            print(f"✗ Error: {e}")
    
    return results


def main():
    """Main entry point for the weekly analysis."""
    print_banner()
    
    # Check for required environment variable
    postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not postgres_url:
        print("ERROR: POSTGRES_URL environment variable is required.")
        print("Set it to your Vercel Postgres connection URL.")
        print("")
        print("Example:")
        print('  export POSTGRES_URL="postgres://user:pass@host:5432/db"')
        print('  python scripts/run_weekly_analysis.py')
        sys.exit(1)
    
    # Check for debug mode
    debug_mode = os.environ.get("MOSEE_DEBUG", "0") == "1"
    
    print(f"Starting MOSEE Weekly Analysis - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Debug mode: {'ON' if debug_mode else 'OFF'}")
    print("")
    
    # Initialize database tables
    print("Initializing database...")
    try:
        init_database()
        print("  ✓ Database initialized")
    except Exception as e:
        print(f"  ✗ Failed to initialize database: {e}")
        sys.exit(1)
    
    # Create database client
    print("Connecting to database...")
    try:
        client = MOSEEDatabaseClient()
        print("  ✓ Connected to database")
    except Exception as e:
        print(f"  ✗ Failed to connect: {e}")
        sys.exit(1)
    
    # Start analysis run
    print("")
    print("Starting analysis run...")
    run_id = client.start_analysis_run()
    print(f"  ✓ Created run: {run_id}")
    
    try:
        # Load ticker data
        print("")
        print("Loading ticker data...")
        ticker_df = load_ticker_data()
        print(f"  ✓ Loaded {len(ticker_df)} tickers")
        
        # Run analysis
        print("")
        print("Running analysis...")
        results = run_analysis(
            ticker_df,
            debug=debug_mode,
            max_stocks=100 if not debug_mode else None  # Limit to top 100 for reasonable runtime
        )
        
        print("")
        print(f"Analysis complete: {len(results)} stocks analyzed successfully")
        
        # Save results to Supabase
        print("")
        print("Saving results to Supabase...")
        
        def progress_callback(current, total):
            print(f"  Saving: {current}/{total}", end="\r")
        
        saved_count = client.save_batch_results(run_id, results, progress_callback)
        print(f"  ✓ Saved {saved_count} results to Supabase")
        
        # Complete the run
        client.complete_analysis_run(run_id, saved_count)
        print("")
        print(f"✓ Analysis run completed successfully!")
        print(f"  Run ID: {run_id}")
        print(f"  Stocks analyzed: {saved_count}")
        print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
    except Exception as e:
        # Mark run as failed
        client.complete_analysis_run(run_id, 0, str(e))
        print(f"")
        print(f"✗ Analysis run failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
