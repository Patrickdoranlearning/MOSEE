#!/usr/bin/env python3
"""
MOSEE Local Report Generator

Run MOSEE analysis on stock(s) and generate PDF reports locally.
No database or web integration required.

Usage:
    # Single stock
    python scripts/run_local_report.py AAPL

    # Multiple stocks
    python scripts/run_local_report.py AAPL MSFT GOOGL

    # From file (one ticker per line)
    python scripts/run_local_report.py --file tickers.txt

    # Output to specific directory
    python scripts/run_local_report.py AAPL --output ./my_reports

    # Simple one-page report (faster)
    python scripts/run_local_report.py AAPL --simple

Options:
    --output, -o    Output directory for PDF reports (default: ./outputs/reports)
    --file, -f      Read tickers from file (one per line)
    --simple        Generate simple one-page report instead of comprehensive
    --no-charts     Skip charts in report (faster generation)
    --json          Also output JSON data alongside PDF
    --csv           Also output CSV summary
    --debug         Show detailed debug output
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


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
    ║   Local Report Generator - PDF Export                           ║
    ╚══════════════════════════════════════════════════════════════════╝
    """)


def run_single_analysis(
    ticker: str,
    start_date: str,
    end_date: str,
    debug: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Run MOSEE analysis on a single ticker.

    Returns analysis data dictionary or None if analysis failed.
    """
    from MOSEE.data_retrieval.fundamental_data import (
        fundamental_downloads, net_income_expected,
        balance_sheet_data_dic, dividends_expected_dic,
        income_statement_data_dic, cash_flow_data_dic,
        get_owners_earnings, get_invested_capital, get_shares_outstanding,
        dataframe_to_json
    )
    from MOSEE.data_retrieval.market_data import (
        get_stock_data, get_ticker_info, get_reporting_currency,
        get_exchange_rate_to_usd, convert_dataframe_to_usd, convert_value_to_usd
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
    from MOSEE.mosee_intelligence import generate_mosee_intelligence
    import pandas as pd

    try:
        if debug:
            print(f"    Fetching stock data...")

        # Get stock data
        stock_data, stock_cap, stock_currency = get_stock_data(ticker, start_date, end_date)

        if stock_data is None or stock_data.empty:
            print(f"    No market data found for {ticker}")
            return None

        current_price = stock_data['Close'].iloc[-1]
        # Ensure current_price is a scalar (yfinance may return Series with ticker index)
        if hasattr(current_price, 'item'):
            current_price = current_price.item()
        elif hasattr(current_price, 'iloc'):
            current_price = current_price.iloc[0]
        if pd.isnull(current_price):
            print(f"    No current price for {ticker}")
            return None

        # Fetch company info (name, industry, sector)
        company_name = ticker
        industry = None
        sector = None
        country = None
        try:
            ticker_info = get_ticker_info(ticker)
            company_name = ticker_info.get('shortName') or ticker_info.get('longName') or ticker
            industry = ticker_info.get('industry')
            sector = ticker_info.get('sector')
            country = ticker_info.get('country')
        except Exception as e:
            if debug:
                print(f"    Could not fetch company info: {e}")

        if debug:
            print(f"    Company: {company_name}")
            print(f"    Current price: ${current_price:.2f}, Market cap: ${stock_cap:,.0f}")
            print(f"    Fetching fundamental data...")

        # Get fundamental data
        fundamentals = fundamental_downloads(ticker)
        cash_flow = fundamentals['cash_flow_statements']
        balance_sheet = fundamentals['balance_sheet_statements']
        income_statement = fundamentals['income_sheet_statements']

        if cash_flow is None or cash_flow.empty:
            print(f"    No cash flow data for {ticker}")
            return None
        if balance_sheet is None or balance_sheet.empty:
            print(f"    No balance sheet data for {ticker}")
            return None

        # ========== CAPTURE RAW DATA (before currency conversion) ==========
        raw_balance_sheet = dataframe_to_json(balance_sheet)
        raw_income_statement = dataframe_to_json(income_statement)
        raw_cash_flow = dataframe_to_json(cash_flow)

        # ========== CURRENCY CONVERSION ==========
        # Get reporting currency and convert all financial data to USD
        reporting_currency = get_reporting_currency(ticker)

        # Get exchange rates (fetch once and reuse for efficiency)
        reporting_to_usd_rate = get_exchange_rate_to_usd(reporting_currency)
        trading_to_usd_rate = get_exchange_rate_to_usd(stock_currency)

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

        if debug:
            print(f"    Calculating metrics...")

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

        # Basic Valuations (with detailed breakdowns for transparency)
        dcf_value, dcf_breakdown = dcf_valuation(net_income_dic, detailed=True)
        pad_value, pad_breakdown = pad_valuation(net_income_dic, detailed=True)
        market_average_value = calculate_average_price(stock_data)
        pad_dividend_valuation, pad_div_breakdown = pad_valuation_dividend(dividends_dic, detailed=True)
        book_valuation, book_breakdown = book_value(balance_sheet_dic, detailed=True)

        # Calculate per-share values
        book_value_per_share = book_valuation / shares_outstanding if shares_outstanding > 0 else 0
        eps = income_dic.get('eps_latest', net_income_dic['net_income_average'] / shares_outstanding if shares_outstanding > 0 else 0)

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

        if debug:
            print(f"    Calculating confidence score...")

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

        if debug:
            print(f"    Generating intelligence report...")

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
        current_year = 2025
        pad_projections = []
        # Scenario growth rates (flip direction for negative growth)
        if growth_rate >= 0:
            pad_cons_growth = growth_rate * 0.7
            pad_opt_growth = min(growth_rate * 1.2, 0.20)
        else:
            pad_cons_growth = growth_rate * 1.3
            pad_opt_growth = growth_rate * 0.5
        for i in range(10):
            projected_year = current_year + i + 1
            projected_income = net_income_avg * ((1 + growth_rate) ** (i + 1))
            cons_income = (net_income_avg * 0.9) * ((1 + pad_cons_growth) ** (i + 1))
            opt_income = (net_income_avg * 1.1) * ((1 + pad_opt_growth) ** (i + 1))
            pad_projections.append({
                'year': projected_year,
                'net_income': max(0, float(projected_income)) if not pd.isna(projected_income) else 0,
                'conservative': max(0, float(cons_income)),
                'optimistic': max(0, float(opt_income)),
            })

        # DCF projected earnings (from linear regression)
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
        all_metrics['net_income_average'] = float(net_income_avg) if not pd.isna(net_income_avg) else 0
        all_metrics['net_income_growth_rate'] = float(growth_rate) if not pd.isna(growth_rate) else 0

        # Add critical metrics for earnings power check in verdict determination
        all_metrics['earnings_equity'] = earnings_equity
        all_metrics['market_cap'] = stock_cap
        all_metrics['net_income'] = net_income_dic.get('net_income_average', 0)

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

        # Generate intelligence report
        intel_report = generate_mosee_intelligence(
            ticker=ticker,
            current_price=current_price,
            metrics=all_metrics,
            required_mos=0.7
        )

        # Transparency data: valuation range, verdict rationale, quality breakdown, recommendation, confidence
        all_metrics['valuation_range_details'] = intel_report.valuation.to_dict()
        all_metrics['verdict_rationale'] = intel_report.verdict_rationale
        all_metrics['quality_breakdown'] = intel_report.quality_breakdown
        all_metrics['recommendation_text'] = intel_report.recommendation
        all_metrics['confidence_breakdown'] = confidence.to_dict()

        # Calculate per-share valuations for consistency with intelligence report
        pad_per_share = pad_value / shares_outstanding if shares_outstanding > 0 else 0
        dcf_per_share = dcf_value / shares_outstanding if shares_outstanding > 0 else 0

        # Determine cap size based on market cap
        if stock_cap >= 200e9:
            cap_size = 'mega'
        elif stock_cap >= 10e9:
            cap_size = 'large'
        elif stock_cap >= 2e9:
            cap_size = 'mid'
        elif stock_cap >= 300e6:
            cap_size = 'small'
        else:
            cap_size = 'micro'

        return {
            'Ticker Symbol': ticker,
            'company_name': company_name,
            'industry': industry or sector,
            'country': country,
            'cap_size': cap_size,
            'Market MoS': market_mos,
            'PAD MoS': pad_mos,
            'Pad Dividend MoS': pad_dividend_mos,
            'DCF MoS': dcf_mos,
            'Book MoS': book_mos,
            'Average Market Price': market_average_value,
            'Current Price': current_price,
            # Per-share valuations (for consistency with intelligence report)
            'PAD Value': pad_per_share,
            'PAD Dividend Value': pad_dividend_valuation / shares_outstanding if shares_outstanding > 0 else 0,
            'DCF Value': dcf_per_share,
            'Book Value': book_value_per_share,
            # Keep total values for reference
            'PAD Value Total': pad_value,
            'DCF Value Total': dcf_value,
            'Book Value Total': book_valuation,
            'Market Cap': stock_cap,
            'Shares Outstanding': shares_outstanding,
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
        if debug:
            import traceback
            traceback.print_exc()
        print(f"    Error: {e}")
        return None


def generate_reports(
    tickers: List[str],
    output_dir: str,
    simple: bool = False,
    include_charts: bool = True,
    include_json: bool = False,
    include_csv: bool = False,
    debug: bool = False
) -> List[str]:
    """
    Generate PDF reports for the given tickers.

    Returns list of generated file paths.
    """
    from MOSEE.profile import build_profile, rank_profiles
    from MOSEE.outputs.pdf_report import (
        generate_pdf_report,
        generate_comprehensive_pdf_report
    )
    import json
    import csv

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Date range for analysis
    start_date = "2020-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")

    results = []
    profiles = []
    generated_files = []

    print(f"\nAnalyzing {len(tickers)} stock(s)...")
    print("-" * 50)

    for i, ticker in enumerate(tickers):
        ticker = ticker.upper().strip()
        print(f"\n[{i + 1}/{len(tickers)}] {ticker}")
        print(f"    Analyzing...", end=" ")

        result = run_single_analysis(ticker, start_date, end_date, debug)

        if result:
            results.append(result)

            # Build profile
            profile = build_profile(
                ticker=ticker,
                analysis_data=result,
                ticker_info={
                    'name': result.get('company_name'),
                    'industry': result.get('industry'),
                    'country': result.get('country'),
                    'cap': result.get('cap_size'),
                },
                confidence_info=result.get('confidence', {})
            )
            profiles.append(profile)

            verdict = result.get('intelligence_report', {}).get('verdict', 'N/A')
            print(f"✓ {verdict}")
        else:
            print("✗ Failed")

    if not profiles:
        print("\nNo successful analyses to report on.")
        return []

    # Rank profiles
    ranked_profiles = rank_profiles(profiles)

    print(f"\n" + "-" * 50)
    print(f"Generating PDF reports...")

    for profile in ranked_profiles:
        ticker = profile.company.ticker
        print(f"  Generating {ticker}...", end=" ")

        try:
            if simple:
                pdf_path = str(output_path / f"{ticker}.pdf")
                generate_pdf_report(profile, pdf_path)
            else:
                pdf_path = str(output_path / f"{ticker}_comprehensive.pdf")
                generate_comprehensive_pdf_report(
                    profile,
                    pdf_path,
                    include_charts=include_charts,
                    include_price_history=include_charts
                )

            generated_files.append(pdf_path)
            print(f"✓")

            # Generate JSON if requested
            if include_json:
                json_path = str(output_path / f"{ticker}.json")
                with open(json_path, 'w') as f:
                    json.dump(profile.to_dict(), f, indent=2)
                generated_files.append(json_path)

        except Exception as e:
            print(f"✗ Error: {e}")
            if debug:
                import traceback
                traceback.print_exc()

    # Generate CSV summary if requested
    if include_csv and profiles:
        csv_path = str(output_path / "summary.csv")
        try:
            with open(csv_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'Rank', 'Ticker', 'Verdict', 'Quality Grade', 'Quality Score',
                    'MoS Ratio', 'Buy Below', 'Current Price', 'Confidence'
                ])
                for profile in ranked_profiles:
                    intel = profile.intelligence
                    writer.writerow([
                        profile.rank,
                        profile.company.ticker,
                        intel.verdict if intel else profile.recommendation,
                        intel.quality_grade if intel else 'N/A',
                        f"{intel.quality_score:.0f}" if intel else 'N/A',
                        f"{intel.margin_of_safety:.2f}" if intel else 'N/A',
                        f"${intel.buy_below_price:.2f}" if intel and intel.buy_below_price else 'N/A',
                        f"${profile.market_data.current_price:.2f}" if profile.market_data.current_price else 'N/A',
                        profile.confidence.level
                    ])
            generated_files.append(csv_path)
            print(f"\n  Summary CSV: {csv_path}")
        except Exception as e:
            print(f"\n  Failed to create CSV: {e}")

    return generated_files


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="MOSEE Local Report Generator - Generate PDF stock analysis reports",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/run_local_report.py AAPL
    python scripts/run_local_report.py AAPL MSFT GOOGL
    python scripts/run_local_report.py AAPL --output ./my_reports
    python scripts/run_local_report.py --file tickers.txt --csv
        """
    )

    parser.add_argument(
        'tickers',
        nargs='*',
        help='Stock ticker symbol(s) to analyze'
    )
    parser.add_argument(
        '--file', '-f',
        type=str,
        help='Read tickers from file (one per line)'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./outputs/reports',
        help='Output directory for reports (default: ./outputs/reports)'
    )
    parser.add_argument(
        '--simple',
        action='store_true',
        help='Generate simple one-page report instead of comprehensive'
    )
    parser.add_argument(
        '--no-charts',
        action='store_true',
        help='Skip charts in report (faster generation)'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Also output JSON data alongside PDF'
    )
    parser.add_argument(
        '--csv',
        action='store_true',
        help='Also output CSV summary of all analyzed stocks'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Show detailed debug output'
    )

    args = parser.parse_args()

    # Collect tickers
    tickers = list(args.tickers) if args.tickers else []

    # Read from file if specified
    if args.file:
        try:
            with open(args.file, 'r') as f:
                file_tickers = [line.strip() for line in f if line.strip() and not line.startswith('#')]
                tickers.extend(file_tickers)
        except FileNotFoundError:
            print(f"Error: File not found: {args.file}")
            sys.exit(1)

    # Validate we have tickers
    if not tickers:
        print("Error: No tickers provided. Use positional arguments or --file option.")
        print("\nUsage examples:")
        print("  python scripts/run_local_report.py AAPL")
        print("  python scripts/run_local_report.py AAPL MSFT GOOGL")
        print("  python scripts/run_local_report.py --file tickers.txt")
        sys.exit(1)

    # Remove duplicates while preserving order
    seen = set()
    unique_tickers = []
    for t in tickers:
        t_upper = t.upper().strip()
        if t_upper not in seen:
            seen.add(t_upper)
            unique_tickers.append(t_upper)
    tickers = unique_tickers

    print_banner()
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Tickers: {', '.join(tickers)}")
    print(f"Output: {args.output}")
    print(f"Report type: {'Simple' if args.simple else 'Comprehensive'}")

    # Generate reports
    generated_files = generate_reports(
        tickers=tickers,
        output_dir=args.output,
        simple=args.simple,
        include_charts=not args.no_charts,
        include_json=args.json,
        include_csv=args.csv,
        debug=args.debug
    )

    if generated_files:
        print(f"\n" + "=" * 50)
        print(f"✓ Generated {len(generated_files)} file(s):")
        for f in generated_files:
            print(f"  - {f}")
        print(f"\nReports saved to: {args.output}")
    else:
        print("\n✗ No reports generated.")
        sys.exit(1)


if __name__ == "__main__":
    main()
