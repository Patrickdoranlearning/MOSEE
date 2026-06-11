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
    ticker_info: Dict[str, Any],
    db_client=None,
) -> Optional[Dict[str, Any]]:
    """
    Run MOSEE analysis on a single ticker with full intelligence.

    Returns analysis data dictionary or None if analysis failed.
    """
    from MOSEE.data_retrieval.fundamental_data import (
        fundamental_downloads, net_income_expected,
        balance_sheet_data_dic, dividends_expected_dic, stock_buybacks_expected,
        income_statement_data_dic, cash_flow_data_dic,
        get_owners_earnings, get_invested_capital, get_shares_outstanding,
        dataframe_to_json
    )
    from MOSEE.data_retrieval.market_data import (
        get_stock_data, get_reporting_currency, get_exchange_rate_to_usd,
        convert_dataframe_to_usd, convert_value_to_usd
    )
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
    from MOSEE.mosee_intelligence import generate_mosee_intelligence, compute_implied_annual_return
    
    try:
        # Get stock data
        stock_data, stock_cap, stock_currency = get_stock_data(ticker, start_date, end_date)
        
        if stock_data is None or stock_data.empty:
            return None
        
        current_price = stock_data['Close'].iloc[-1]
        # Ensure current_price is a scalar (yfinance may return Series with ticker index)
        if hasattr(current_price, 'item'):
            current_price = current_price.item()
        elif hasattr(current_price, 'iloc'):
            current_price = current_price.iloc[0]
        if pd.isnull(current_price):
            return None
        
        # Get fundamental data (warehouse-first, then external APIs)
        fundamentals = fundamental_downloads(ticker, db_client=db_client)
        cash_flow = fundamentals['cash_flow_statements']
        balance_sheet = fundamentals['balance_sheet_statements']
        income_statement = fundamentals['income_sheet_statements']

        if cash_flow is None or cash_flow.empty:
            print(f"✗ Empty cash flow statement", end=" ")
            return None
        if balance_sheet is None or balance_sheet.empty:
            print(f"✗ Empty balance sheet", end=" ")
            return None
        # An empty income statement otherwise produces a full row with zeroed
        # earnings (EPS, revenue, margins all 0) — abort like the other statements.
        if income_statement is None or income_statement.empty:
            print(f"✗ Empty income statement", end=" ")
            return None

        # ========== HISTORY METADATA ==========
        income_years = len(income_statement.columns) if income_statement is not None and not income_statement.empty else 0
        balance_years = len(balance_sheet.columns) if balance_sheet is not None and not balance_sheet.empty else 0
        cashflow_years = len(cash_flow.columns) if cash_flow is not None and not cash_flow.empty else 0
        max_years = max(income_years, balance_years, cashflow_years)
        # Detect which extended source was used based on year count.
        # yfinance alone caps at ~4 years; any more means an external source helped.
        # The actual source is determined by the priority chain in fundamental_downloads():
        #   1. Yahoo Timeseries (all stocks)  2. SEC EDGAR (US)  3. FMP (global, key needed)
        if max_years > 5:
            from MOSEE.data_retrieval.sec_edgar import resolve_cik
            is_us = resolve_cik(ticker) is not None
            data_source = "yfinance + SEC EDGAR" if is_us else "yfinance + Yahoo Extended"
        else:
            data_source = "yfinance"
        print(f"    Data coverage: {max_years} years ({data_source})")

        # ========== CAPTURE RAW DATA (before currency conversion) ==========
        raw_balance_sheet = dataframe_to_json(balance_sheet)
        raw_income_statement = dataframe_to_json(income_statement)
        raw_cash_flow = dataframe_to_json(cash_flow)

        # ========== SAVE TO FINANCIAL HISTORY WAREHOUSE ==========
        # Stored in original reporting currency (before USD conversion).
        # Append-only: historical years never overwritten, builds up over time.
        reporting_currency = get_reporting_currency(ticker)
        if db_client is not None:
            wh_saved = 0
            wh_saved += db_client.save_financial_history(
                ticker, 'income_statement', raw_income_statement,
                currency=reporting_currency, source=data_source)
            wh_saved += db_client.save_financial_history(
                ticker, 'balance_sheet', raw_balance_sheet,
                currency=reporting_currency, source=data_source)
            wh_saved += db_client.save_financial_history(
                ticker, 'cash_flow', raw_cash_flow,
                currency=reporting_currency, source=data_source)
            if wh_saved > 0:
                print(f"    [Warehouse] Saved {wh_saved} new year-records")

        # ========== CURRENCY CONVERSION ==========
        # Get reporting currency and convert all financial data to USD
        # (reporting_currency already fetched above for warehouse)

        # Get exchange rates (fetch once and reuse for efficiency).
        # USD never needs a lookup. A None rate for a non-USD currency means the
        # FX fetch failed — skip the ticker rather than convert with a fabricated
        # 1.0 rate, which would corrupt every value in the row.
        reporting_to_usd_rate = 1.0 if reporting_currency == 'USD' else get_exchange_rate_to_usd(reporting_currency)
        trading_to_usd_rate = 1.0 if stock_currency == 'USD' else get_exchange_rate_to_usd(stock_currency)

        if reporting_currency != 'USD' and reporting_to_usd_rate is None:
            print(f"✗ No FX rate for reporting currency {reporting_currency}", end=" ")
            return None
        if stock_currency != 'USD' and trading_to_usd_rate is None:
            print(f"✗ No FX rate for trading currency {stock_currency}", end=" ")
            return None

        # Convert financial statements from reporting currency to USD
        if reporting_currency != 'USD':
            print(f"    Converting financials from {reporting_currency} to USD (rate: {reporting_to_usd_rate:.6f})")
            cash_flow = convert_dataframe_to_usd(cash_flow, reporting_currency, reporting_to_usd_rate)
            balance_sheet = convert_dataframe_to_usd(balance_sheet, reporting_currency, reporting_to_usd_rate)
            if income_statement is not None and not income_statement.empty:
                income_statement = convert_dataframe_to_usd(income_statement, reporting_currency, reporting_to_usd_rate)

        # Convert market cap and price from trading currency to USD
        if stock_currency != 'USD':
            print(f"    Converting market data from {stock_currency} to USD (rate: {trading_to_usd_rate:.6f})")
            current_price = convert_value_to_usd(current_price, stock_currency, trading_to_usd_rate)
            stock_cap = convert_value_to_usd(stock_cap, stock_currency, trading_to_usd_rate)
        
        # Get shares outstanding
        shares_outstanding = get_shares_outstanding(ticker)
        if shares_outstanding == 0:
            shares_outstanding = stock_cap / current_price if current_price > 0 else 1
        
        # ========== BUILD RAW DATA SNAPSHOT ==========
        raw_data = {
            'balance_sheet': raw_balance_sheet,
            'income_statement': raw_income_statement,
            'cash_flow': raw_cash_flow,
            'market_data': {
                'current_price': float(current_price) if not pd.isna(current_price) else None,
                'market_cap': float(stock_cap) if not pd.isna(stock_cap) else None,
                'shares_outstanding': float(shares_outstanding) if not pd.isna(shares_outstanding) else None,
                'stock_currency': stock_currency,
                'reporting_currency': reporting_currency,
                'trading_to_usd_rate': float(trading_to_usd_rate) if not pd.isna(trading_to_usd_rate) else 1.0,
                'reporting_to_usd_rate': float(reporting_to_usd_rate) if not pd.isna(reporting_to_usd_rate) else 1.0,
            },
            'currency_info': {
                'stock_currency': stock_currency,
                'reporting_currency': reporting_currency,
                'trading_to_usd_rate': float(trading_to_usd_rate) if not pd.isna(trading_to_usd_rate) else 1.0,
                'reporting_to_usd_rate': float(reporting_to_usd_rate) if not pd.isna(reporting_to_usd_rate) else 1.0,
                'converted_to_usd': reporting_currency != 'USD' or stock_currency != 'USD',
            },
        }

        # Calculate base metrics
        # Pass income_statement to get accurate net income (cash flow's "Net Income From
        # Continuing Operations" can be pretax for some companies like DTE.DE)
        net_income_dic = net_income_expected(cash_flow, 10, income_statement=income_statement)
        balance_sheet_dic = balance_sheet_data_dic(balance_sheet)
        dividends_dic = dividends_expected_dic(cash_flow)
        stock_buybacks_dic = stock_buybacks_expected(cash_flow)

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
        
        # Basic Valuations (with detailed breakdowns)
        dcf_value, dcf_breakdown = dcf_valuation(net_income_dic, detailed=True)
        pad_value, pad_breakdown = pad_valuation(net_income_dic, detailed=True)
        market_average_value = calculate_average_price(stock_data)
        pad_dividend_valuation, pad_div_breakdown = pad_valuation_dividend(dividends_dic, detailed=True)
        book_valuation, book_breakdown = book_value(balance_sheet_dic, detailed=True)
        
        # Calculate per-share values
        book_value_per_share = book_valuation / shares_outstanding if shares_outstanding > 0 else 0
        # Prefer income statement EPS, fall back to latest net income (not average) for current EPS
        eps = income_dic.get('eps_latest', 0)
        if not eps and shares_outstanding > 0:
            latest_ni = income_dic.get('net_income_latest', 0)
            if not latest_ni:
                latest_ni = net_income_dic.get('net_income_average', 0)
            eps = latest_ni / shares_outstanding

        # Normalize EPS when latest year is an outlier (e.g. EXOR 2024 spike).
        # The outlier detection in classify_earnings_pattern() already flags this,
        # but the raw eps_latest was still flowing into PAD valuation unchanged.
        # Use median-based normalized earnings for cyclical/outlier companies.
        earnings_cls_data = net_income_dic.get('earnings_classification', {})
        if earnings_cls_data.get('latest_is_outlier') and shares_outstanding > 0:
            normalized_ni = earnings_cls_data.get('normalized_earnings', 0)
            if normalized_ni > 0:
                normalized_eps = normalized_ni / shares_outstanding
                print(f"    [Outlier] Normalizing EPS: ${eps:.2f} -> ${normalized_eps:.2f} "
                      f"(latest {earnings_cls_data.get('latest_ratio', '?'):.1f}x prior median)")
                eps = normalized_eps
        
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
        
        # Graham criterion 5 (10yr earnings growth) compares historical earnings
        # against per-share eps_current. Pass a PER-SHARE net income series so the
        # iloc[-10] lookup inside the criterion is also per-share — otherwise TOTAL
        # net income is compared to per-share EPS and the test always fails for
        # long-history stocks. Caveat: uses the CURRENT share count for old years.
        # (Sign-invariant criterion 3 is unaffected by the constant division.)
        if isinstance(net_income_series, pd.Series) and len(net_income_series) > 0 and shares_outstanding > 0:
            net_income_per_share_series = net_income_series / shares_outstanding
        else:
            net_income_per_share_series = net_income_series

        # Use actual historical EPS if available, otherwise mark as unavailable
        if isinstance(net_income_series, pd.Series) and len(net_income_series) >= 3 and shares_outstanding > 0:
            eps_10yr_ago = float(net_income_series.iloc[0]) / shares_outstanding
        else:
            eps_10yr_ago = 0  # Unknown — Graham criterion will fail honestly

        graham_criteria = calculate_graham_defensive_criteria(
            revenue=revenue,
            current_assets=current_assets_latest,
            current_liabilities=current_liabilities_latest,
            long_term_debt=long_term_debt_latest,
            net_income_history=net_income_per_share_series,
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
        # None (not 0) when absent: a missing interest expense is unknown, not
        # "no debt" — defaulting to 0 falsely awarded max interest-coverage points.
        interest_expense = income_dic.get('interest_expense_latest', None)

        debt_to_equity = calculate_debt_to_equity(total_debt_latest, stockholders_equity)
        interest_coverage = calculate_interest_coverage(ebit, interest_expense)
        
        owner_earnings_latest = owners_earnings_dic.get('owners_earnings_latest', 0)
        owner_earnings_per_share = owner_earnings_latest / shares_outstanding if shares_outstanding > 0 else 0
        owner_earnings_yield = owner_earnings_latest / stock_cap if stock_cap > 0 else 0
        
        # Lynch Metrics
        # Keep earnings_growth as-is (0 stays 0). Imputing a phantom 5% growth
        # for data-poor stocks doubles fair value in the owner-earnings perpetuity.
        earnings_growth = net_income_dic.get('net_income_average_growth', 0)

        cash_on_hand = balance_sheet_dic.get('cash_onhand', 0)
        
        lynch_metrics = get_lynch_metrics(
            current_price=current_price,
            eps=eps,
            earnings_growth_rate=earnings_growth,
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
        # mos_dollar returns None when the value marker is NaN/Inf/<=0 — that
        # method's MoS/MOSEE is then stored as None (unknown), not a poison NaN.
        market_mos = mos_dollar(current_price, market_average_value)
        pad_mos = mos_dollar(stock_cap, pad_value)
        dcf_mos = mos_dollar(stock_cap, dcf_value)
        pad_dividend_mos = mos_dollar(stock_cap, pad_dividend_valuation)
        book_mos = mos_dollar(stock_cap, book_valuation)

        # MOSEE calculations — per-method, not blanket zeroing
        # MOSEE = earnings_equity × (1/MoS). Only valid when both MoS > 0 and earnings_equity > 0.
        # When MoS is None/negative (intrinsic value unknown or negative), or earnings
        # are negative, that method's MOSEE is None — but other methods may still be valid.
        def _calc_mosee(mos_val, ee):
            if mos_val is None or ee is None or mos_val <= 0 or ee <= 0:
                return None
            return ee * (1 / mos_val)

        market_MOSEE = _calc_mosee(market_mos, earnings_equity)
        pad_MOSEE = _calc_mosee(pad_mos, earnings_equity)
        dcf_MOSEE = _calc_mosee(dcf_mos, earnings_equity)
        pad_dividend_MOSEE = _calc_mosee(pad_dividend_mos, earnings_equity)
        book_MOSEE = _calc_mosee(book_mos, earnings_equity)
        
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
            'earnings_growth': earnings_growth,
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
            # Critical metrics for earnings power check in verdict determination
            'earnings_equity': earnings_equity,
            'market_cap': stock_cap,
            'net_income': net_income_dic.get('net_income_average', 0),
            # History metadata — how much data backs the analysis
            'years_of_history': max_years,
            'data_source': data_source,
            'income_years': income_years,
            'balance_sheet_years': balance_years,
            'cashflow_years': cashflow_years,
            # Shareholder return metrics
            'dividend_yield': dividends_dic.get('dividends_average', 0) / stock_cap if stock_cap > 0 else 0,
            'buyback_yield': stock_buybacks_dic.get('buyback_average', 0) / stock_cap if stock_cap > 0 else 0,
        }

        # Add earnings data for visualization
        # Historical net income (serialize pandas Series to dict)
        historical_earnings = []
        if 'net_income_df' in net_income_dic and isinstance(net_income_dic['net_income_df'], pd.Series):
            ni_series = net_income_dic['net_income_df'].dropna()
            for date_idx, value in ni_series.items():
                year = date_idx.year if hasattr(date_idx, 'year') else str(date_idx)[:4]
                historical_earnings.append({
                    'year': int(year),
                    'net_income': float(value) if not pd.isna(value) else 0
                })

        # PAD projected earnings (compound growth from average)
        net_income_avg = net_income_dic.get('net_income_average', 0)
        growth_rate = net_income_dic.get('net_income_average_growth', 0)
        projection_method = net_income_dic.get('projection_method', 'flat')
        earnings_cls = net_income_dic.get('earnings_classification', {})
        current_year = datetime.now().year
        pad_projections = []

        # Use the same logic as the projection engine:
        # For cyclical/turnaround/poor-fit, use normalized earnings with modest growth
        if projection_method == 'normalized':
            normalized_base = earnings_cls.get('normalized_earnings', net_income_avg)
            modest_growth = max(0, min(growth_rate, 0.05))
            cons_growth_n = modest_growth * 0.5
            opt_growth_n = min(modest_growth * 1.5, 0.08)
            for i in range(10):
                projected_year = current_year + i + 1
                projected_income = normalized_base * ((1 + modest_growth) ** (i + 1))
                cons_income = (normalized_base * 0.85) * ((1 + cons_growth_n) ** (i + 1))
                opt_income = (normalized_base * 1.15) * ((1 + opt_growth_n) ** (i + 1))
                pad_projections.append({
                    'year': projected_year,
                    'net_income': max(0, float(projected_income)) if not pd.isna(projected_income) else 0,
                    'conservative': max(0, float(cons_income)),
                    'optimistic': max(0, float(opt_income)),
                })
        else:
            # Scenario growth rates (flip direction for negative growth)
            if growth_rate >= 0:
                cons_growth = growth_rate * 0.7
                opt_growth = min(growth_rate * 1.2, 0.20)
            else:
                cons_growth = growth_rate * 1.3   # steeper decline
                opt_growth = growth_rate * 0.5    # slower decline
            for i in range(10):
                projected_year = current_year + i + 1
                projected_income = net_income_avg * ((1 + growth_rate) ** (i + 1))
                cons_income = (net_income_avg * 0.9) * ((1 + cons_growth) ** (i + 1))
                opt_income = (net_income_avg * 1.1) * ((1 + opt_growth) ** (i + 1))
                pad_projections.append({
                    'year': projected_year,
                    'net_income': max(0, float(projected_income)) if not pd.isna(projected_income) else 0,
                    'conservative': max(0, float(cons_income)),
                    'optimistic': max(0, float(opt_income)),
                })

        # DCF projected earnings (from linear regression / normalized — already floored at 0)
        # Widening uncertainty band: 10% at year 1, +2% per year → 28% at year 10
        dcf_projections = []
        expected_net_income = net_income_dic.get('expected_net_income', [])
        for i, income in enumerate(expected_net_income):
            projected_year = current_year + i + 1
            base_income = max(0, float(income)) if not pd.isna(income) else 0
            uncertainty_pct = 0.10 + 0.02 * i
            dcf_projections.append({
                'year': projected_year,
                'net_income': base_income,
                'conservative': max(0, base_income * (1 - uncertainty_pct)),
                'optimistic': base_income * (1 + uncertainty_pct),
            })

        all_metrics['historical_earnings'] = historical_earnings
        all_metrics['pad_projections'] = pad_projections
        all_metrics['dcf_projections'] = dcf_projections

        # ===== SHAREHOLDER RETURNS: Dividends & Share Capital =====
        # Historical dividends paid (positive = cash returned to shareholders)
        if 'dividends_df' in dividends_dic and isinstance(dividends_dic['dividends_df'], pd.Series):
            div_series = dividends_dic['dividends_df'].dropna()
            all_metrics['historical_dividends'] = []
            for date_idx, val in div_series.items():
                year = date_idx.year if hasattr(date_idx, 'year') else int(str(date_idx)[:4])
                all_metrics['historical_dividends'].append({
                    'year': int(year),
                    'value': float(val) if not pd.isna(val) else 0
                })
        else:
            all_metrics['historical_dividends'] = []

        all_metrics['dividend_growth_rate'] = float(dividends_dic.get('dividend_average_growth', 0))

        # Historical share repurchases and issuances (separate series for clarity)
        # Repurchases: positive = money spent buying back shares
        # Issuances: positive = money received from issuing shares
        # Net buybacks: positive = net buyer (reducing shares), negative = net issuer (diluting)
        repurchases_series = stock_buybacks_dic.get('stock_buybacks_df', pd.Series())
        issuances_series = stock_buybacks_dic.get('stock_issued', pd.Series())

        historical_repurchases = []
        if isinstance(repurchases_series, pd.Series):
            for date_idx, val in repurchases_series.dropna().items():
                year = date_idx.year if hasattr(date_idx, 'year') else int(str(date_idx)[:4])
                historical_repurchases.append({
                    'year': int(year),
                    'value': float(val) if not pd.isna(val) else 0
                })
        all_metrics['historical_net_buybacks'] = historical_repurchases

        historical_issuances = []
        if isinstance(issuances_series, pd.Series):
            for date_idx, val in issuances_series.dropna().items():
                year = date_idx.year if hasattr(date_idx, 'year') else int(str(date_idx)[:4])
                historical_issuances.append({
                    'year': int(year),
                    'value': float(val) if not pd.isna(val) else 0
                })
        all_metrics['historical_issuances'] = historical_issuances

        all_metrics['buyback_growth_rate'] = float(stock_buybacks_dic.get('buyback_average_growth', 0))

        # Historical shares outstanding from balance sheet
        historical_shares = []
        if balance_sheet is not None and not balance_sheet.empty:
            for name in ['Share Issued', 'Ordinary Shares Number', 'Common Stock Shares Outstanding']:
                if name in balance_sheet.index:
                    shares_series = balance_sheet.loc[name].dropna()
                    for date_idx, val in shares_series.items():
                        year = date_idx.year if hasattr(date_idx, 'year') else int(str(date_idx)[:4])
                        historical_shares.append({
                            'year': int(year),
                            'value': float(val) if not pd.isna(val) else 0
                        })
                    break
        all_metrics['historical_shares_outstanding'] = historical_shares
        all_metrics['net_income_average'] = float(net_income_avg) if not pd.isna(net_income_avg) else 0
        all_metrics['net_income_growth_rate'] = float(growth_rate) if not pd.isna(growth_rate) else 0

        # Earnings classification and projection quality
        earnings_cls = net_income_dic.get('earnings_classification', {})
        all_metrics['earnings_classification'] = earnings_cls.get('classification', 'Unknown')
        all_metrics['earnings_cv'] = earnings_cls.get('cv')
        all_metrics['earnings_has_negative_years'] = earnings_cls.get('has_negative_years', False)
        all_metrics['earnings_negative_year_count'] = earnings_cls.get('negative_year_count', 0)
        all_metrics['projection_r_squared'] = net_income_dic.get('r_squared')
        all_metrics['projection_method'] = net_income_dic.get('projection_method', 'flat')

        # ===== VALUATION BASIS DATA =====
        all_metrics['valuation_basis'] = {
            'pad': pad_breakdown,
            'dcf': dcf_breakdown,
            'pad_dividend': pad_div_breakdown,
            'book_value': book_breakdown,
        }

        # ===== FINANCIAL STATEMENT SUMMARIES =====
        def series_to_yearly(series):
            """Convert pandas Series with datetime index to list of {year, value} dicts."""
            if not isinstance(series, pd.Series):
                return []
            result = []
            for date_idx, val in series.dropna().items():
                year = date_idx.year if hasattr(date_idx, 'year') else str(date_idx)[:4]
                result.append({'year': int(year), 'value': float(val) if not pd.isna(val) else 0})
            return result

        all_metrics['financial_statements'] = {
            'balance_sheet': {
                'total_assets': series_to_yearly(balance_sheet_dic.get('total_assets', pd.Series())),
                'total_liabilities': series_to_yearly(balance_sheet_dic.get('total_liabilities', pd.Series())),
                'stockholders_equity': series_to_yearly(balance_sheet_dic.get('stockholders_equity', pd.Series())),
                'total_debt': series_to_yearly(balance_sheet_dic.get('total_debt', pd.Series())),
                'cash_on_hand': float(balance_sheet_dic.get('cash_onhand', 0)) if not pd.isna(balance_sheet_dic.get('cash_onhand', 0)) else 0,
                'current_ratio': float(current_assets_latest / current_liabilities_latest) if current_liabilities_latest > 0 else 0,
            },
            'income_statement': {
                'revenue': series_to_yearly(income_dic.get('revenue', pd.Series())),
                'gross_profit': series_to_yearly(income_dic.get('gross_profit', pd.Series())),
                'ebit': series_to_yearly(income_dic.get('ebit', pd.Series())),
                'net_income': series_to_yearly(income_dic.get('net_income', pd.Series())),
                'gross_margin': series_to_yearly(income_dic.get('gross_margin', pd.Series())),
                'operating_margin': series_to_yearly(income_dic.get('operating_margin', pd.Series())),
                'net_margin': series_to_yearly(income_dic.get('net_margin', pd.Series())),
            },
            'cash_flow': {
                'operating_cash_flow': series_to_yearly(cf_dic.get('operating_cash_flow', pd.Series())),
                'capex': series_to_yearly(cf_dic.get('capex', pd.Series())),
                'free_cash_flow': series_to_yearly(cf_dic.get('free_cash_flow', pd.Series())),
                'depreciation': series_to_yearly(cf_dic.get('depreciation', pd.Series())),
            },
            'owner_earnings': {
                'net_income': series_to_yearly(owners_earnings_dic.get('net_income', pd.Series())),
                'depreciation': series_to_yearly(owners_earnings_dic.get('depreciation', pd.Series())),
                'capex': series_to_yearly(owners_earnings_dic.get('capex', pd.Series())),
                'avg_capex': float(owners_earnings_dic.get('avg_capex', 0)),
                'owners_earnings': series_to_yearly(owners_earnings_dic.get('owners_earnings', pd.Series())),
                'formula': 'Net Income + Depreciation - Average CapEx',
            },
        }

        # ===== PRICE HISTORY FOR SNAPSHOT =====
        # 52-week high/low from ticker info
        all_metrics['fifty_two_week_high'] = ticker_info.get('fiftyTwoWeekHigh')
        all_metrics['fifty_two_week_low'] = ticker_info.get('fiftyTwoWeekLow')

        # 5-year monthly closing prices for sparkline chart
        if stock_data is not None and not stock_data.empty:
            close_col = stock_data['Close']
            # Flatten MultiIndex columns if present (yfinance sometimes returns ticker-indexed columns)
            if hasattr(close_col, 'columns'):
                close_col = close_col.iloc[:, 0]
            monthly = close_col.resample('ME').last().dropna()
            price_history = []
            for date_idx, val in monthly.items():
                price_val = float(val.item()) if hasattr(val, 'item') else float(val)
                if not pd.isna(price_val):
                    price_history.append({
                        'date': date_idx.strftime('%Y-%m'),
                        'price': price_val
                    })
            all_metrics['price_history_monthly'] = price_history
        else:
            all_metrics['price_history_monthly'] = []

        # Generate intelligence report
        intel_report = generate_mosee_intelligence(
            ticker=ticker,
            current_price=current_price,
            metrics=all_metrics,
            required_mos=0.7
        )

        # Store individual valuation range details for frontend transparency
        all_metrics['valuation_range_details'] = intel_report.valuation.to_dict()

        # Transparency data: verdict rationale, quality breakdown, recommendation, confidence
        all_metrics['verdict_rationale'] = intel_report.verdict_rationale
        all_metrics['quality_breakdown'] = intel_report.quality_breakdown
        all_metrics['recommendation_text'] = intel_report.recommendation
        all_metrics['confidence_breakdown'] = confidence.to_dict()

        # Implied annualised return (composite_base convergence over 5yr + clamped
        # dividend yield). None when guardrails fail — never a fabricated number.
        implied_annual_return = compute_implied_annual_return(intel_report, all_metrics)
        all_metrics['implied_annual_return'] = implied_annual_return

        return {
            'implied_annual_return': implied_annual_return,
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
            'raw_data': raw_data,
        }
        
    except Exception as e:
        import traceback
        print(f"    Error analyzing {ticker}: {e}")
        traceback.print_exc()
        return None


def run_analysis(
    ticker_df: pd.DataFrame,
    countries: Optional[List[str]] = None,
    cap_sizes: Optional[List[str]] = None,
    max_stocks: Optional[int] = None,
    skip_stocks: int = 0,
    debug: bool = False,
    db_client=None,
    run_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Run MOSEE analysis on filtered stocks.

    Args:
        ticker_df: DataFrame with ticker data
        countries: Filter to specific countries
        cap_sizes: Filter to specific cap sizes
        max_stocks: Maximum number of stocks to analyze
        skip_stocks: Number of stocks to skip (for batch processing, e.g., skip=100 to start at 101)
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
    else:
        # Apply skip and limit for batch processing
        if skip_stocks > 0:
            filtered_df = filtered_df.iloc[skip_stocks:]
            print(f"  Skipping first {skip_stocks} stocks")
        if max_stocks:
            filtered_df = filtered_df.head(max_stocks)
    
    print(f"  Analyzing {len(filtered_df)} stocks...")

    # Date range
    start_date = "2020-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")

    results = []
    saved_count = 0
    total = len(filtered_df)

    # Seed total_stocks so the UI can show a denominator immediately.
    if run_id and db_client and total:
        db_client.update_run_progress(run_id, current_index=0, total_stocks=total, current_ticker=None)

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

        if run_id and db_client:
            db_client.update_run_progress(
                run_id,
                current_index=idx + 1,
                total_stocks=total,
                current_ticker=ticker,
            )

        try:
            result = run_single_analysis(ticker, start_date, end_date, ticker_info, db_client=db_client)

            if result:
                verdict = result.get('intelligence_report', {}).get('verdict', 'N/A')

                # Persist immediately so a crash mid-run (these runs span hours)
                # doesn't lose everything. The (ticker, analysis_date) upsert is
                # idempotent. raw_data is large — save it, then drop it from the
                # retained dict so the in-memory list can't OOM a long run.
                if db_client and run_id:
                    if db_client.save_analysis_result(run_id, result):
                        saved_count += 1
                    raw = result.pop('raw_data', None)
                    if raw:
                        db_client.save_raw_data(ticker, raw)

                results.append(result)
                print(f"✓ {verdict}")
            else:
                print("✗ No data")
        except Exception as e:
            print(f"✗ Error: {e}")

    return results, saved_count


def clear_all_data(client: MOSEEDatabaseClient):
    """Clear all existing analysis data from the database."""
    conn = client._get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM mosee_stock_analyses")
        cur.execute("DELETE FROM mosee_analysis_runs")
        conn.commit()
        print("  ✓ Cleared all existing data")
    except Exception as e:
        print(f"  ✗ Error clearing data: {e}")
        conn.rollback()
    finally:
        cur.close()


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

    # Check for debug mode and clear flag
    debug_mode = os.environ.get("MOSEE_DEBUG", "0") == "1"
    clear_data = "--clear" in sys.argv

    # Full-market deep-dive: MOSEE_FULL=1 disables the per-batch cap.
    full_market = os.environ.get("MOSEE_FULL", "0") == "1"

    # Batch processing: MOSEE_SKIP=100 MOSEE_LIMIT=100 runs stocks 101-200
    skip_stocks = int(os.environ.get("MOSEE_SKIP", "0"))
    max_stocks: Optional[int] = None if full_market else int(os.environ.get("MOSEE_LIMIT", "100"))

    # Run-id + trigger metadata supplied by the API route (or the cron job).
    preassigned_run_id = os.environ.get("MOSEE_RUN_ID") or None
    run_kind = os.environ.get("MOSEE_RUN_KIND", "scheduled")  # 'manual' | 'scheduled'
    triggered_by = os.environ.get("MOSEE_TRIGGERED_BY") or None

    print(f"Starting MOSEE Weekly Analysis - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Debug mode: {'ON' if debug_mode else 'OFF'}")
    print(f"  Full market: {'ON' if full_market else 'OFF'}")
    print(f"  Clear data: {'YES' if clear_data else 'NO'}")
    if full_market:
        print(f"  Skip: {skip_stocks}, Limit: ALL (full-market deep-dive)")
    else:
        print(f"  Skip: {skip_stocks}, Limit: {max_stocks} (stocks {skip_stocks + 1}-{skip_stocks + max_stocks})")
    if preassigned_run_id:
        print(f"  Claiming pre-assigned run: {preassigned_run_id} ({run_kind})")
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

    # Clear existing data if requested
    if clear_data:
        print("")
        print("Clearing existing data...")
        clear_all_data(client)

    # Start analysis run (claim a pre-assigned id if the API handed us one).
    print("")
    print("Starting analysis run...")
    run_id = client.start_analysis_run(
        run_id=preassigned_run_id,
        kind=run_kind,
        triggered_by=triggered_by,
        scope={
            "full_market": full_market,
            "debug": debug_mode,
            "skip": skip_stocks,
            "limit": max_stocks,
        },
    )
    print(f"  ✓ Run id: {run_id}")

    try:
        # Load ticker data
        print("")
        print("Loading ticker data...")
        ticker_df = load_ticker_data()
        print(f"  ✓ Loaded {len(ticker_df)} tickers")

        # Run analysis. Each ticker is now persisted incrementally inside the
        # loop (analysis + raw data) so a crash during these multi-hour runs
        # doesn't lose completed work. saved_count is the count of successful
        # incremental saves; raw_data has already been written and dropped.
        print("")
        print("Running analysis...")
        results, saved_count = run_analysis(
            ticker_df,
            debug=debug_mode,
            max_stocks=max_stocks if not debug_mode else None,
            skip_stocks=skip_stocks if not debug_mode else 0,
            db_client=client,
            run_id=run_id,
        )

        print("")
        print(f"Analysis complete: {len(results)} stocks analyzed successfully")
        print(f"  ✓ Saved {saved_count} results to Supabase (incremental)")

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
