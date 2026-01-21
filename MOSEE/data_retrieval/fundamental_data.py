import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

# Import rate limiter utilities
from MOSEE.data_retrieval.rate_limiter import (
    get_financial_statements,
    get_ticker_info,
    get_ticker_object,
    with_rate_limit,
)


def fundamental_downloads(ticker_temp):
    """
    This function will download fundamental data using yfinance (FREE).
    
    Includes rate limiting and retry logic to handle Yahoo Finance rate limits.

    Args:
    - ticker_temp: the ticker of the security we are investigating

    Returns:
    - fundamentals dictionary: of all fundamental data
    """

    fundamentals = {}

    # Use rate-limited function to get all financial statements
    statements = get_financial_statements(ticker_temp)
    
    balance_sheet_statements = statements.get('balance_sheet', pd.DataFrame())
    cash_flow_statements = statements.get('cashflow', pd.DataFrame())
    income_sheet_statements = statements.get('financials', pd.DataFrame())

    # Transpose to match the expected format (items as index, dates as columns)
    # and sort columns chronologically (oldest to newest)
    if not balance_sheet_statements.empty:
        balance_sheet_statements = balance_sheet_statements.sort_index(axis=1)
    if not cash_flow_statements.empty:
        cash_flow_statements = cash_flow_statements.sort_index(axis=1)
    if not income_sheet_statements.empty:
        income_sheet_statements = income_sheet_statements.sort_index(axis=1)

    fundamentals['balance_sheet_statements'] = balance_sheet_statements
    fundamentals['cash_flow_statements'] = cash_flow_statements
    fundamentals['income_sheet_statements'] = income_sheet_statements

    return fundamentals


def _get_row_safe(df, possible_names, default=0):
    """
    Helper function to get a row from a DataFrame trying multiple possible names.
    yfinance uses different field names than FMP, so we need to try alternatives.

    Args:
    - df: DataFrame to search
    - possible_names: list of possible row names to try
    - default: default value if none found

    Returns:
    - Series or default value
    """
    for name in possible_names:
        if name in df.index:
            return df.loc[name]
    # Return a series of zeros with same columns if not found
    return pd.Series(default, index=df.columns)


def balance_sheet_data_dic(balance_sheet_statements):
    """
    This function will extract certain assets and liabilities of interest from the balance sheet statement

    Args:
    - balance_sheet_statements dataframe: takes in the balance statement from yfinance

    Returns:
    - balance_sheet dictionary: which contains key data from balance sheet,
    """
    balance_sheet = {}

    # yfinance field names (may vary, so we try alternatives)
    cash_df = _get_row_safe(balance_sheet_statements, [
        'Cash And Cash Equivalents',
        'Cash And Cash Equivalents And Short Term Investments',
        'Cash Cash Equivalents And Short Term Investments',
        'Cash'
    ])
    cash_onhand = cash_df.iloc[-1] if len(cash_df) > 0 else 0

    current_assets = _get_row_safe(balance_sheet_statements, [
        'Current Assets',
        'Total Current Assets'
    ])

    current_liabilities = _get_row_safe(balance_sheet_statements, [
        'Current Liabilities',
        'Total Current Liabilities'
    ])

    intangible_assets = _get_row_safe(balance_sheet_statements, [
        'Goodwill And Other Intangible Assets',
        'Intangible Assets',
        'Other Intangible Assets',
        'Goodwill'
    ])

    total_assets = _get_row_safe(balance_sheet_statements, [
        'Total Assets'
    ])

    total_liabilities = _get_row_safe(balance_sheet_statements, [
        'Total Liabilities Net Minority Interest',
        'Total Liabilities',
        'Total Liabilities And Stockholders Equity'
    ])

    tangible_assets = total_assets - intangible_assets
    net_assets = total_assets - total_liabilities

    # Additional fields for investment book metrics (Graham, Buffett, Lynch, Greenblatt)
    
    # Debt metrics (Graham, Buffett)
    total_debt = _get_row_safe(balance_sheet_statements, [
        'Total Debt',
        'Long Term Debt And Capital Lease Obligation',
        'Long Term Debt'
    ])
    
    long_term_debt = _get_row_safe(balance_sheet_statements, [
        'Long Term Debt',
        'Long Term Debt And Capital Lease Obligation'
    ])
    
    short_term_debt = _get_row_safe(balance_sheet_statements, [
        'Current Debt',
        'Current Debt And Capital Lease Obligation',
        'Short Term Debt'
    ])
    
    # Stockholders equity (Graham, Buffett - for ROE)
    stockholders_equity = _get_row_safe(balance_sheet_statements, [
        'Stockholders Equity',
        'Total Stockholders Equity',
        'Common Stock Equity',
        'Total Equity Gross Minority Interest'
    ])
    
    # Inventory (Lynch)
    inventory = _get_row_safe(balance_sheet_statements, [
        'Inventory',
        'Total Inventory'
    ])
    
    # Accounts receivable
    accounts_receivable = _get_row_safe(balance_sheet_statements, [
        'Accounts Receivable',
        'Receivables',
        'Net Receivables'
    ])
    
    # Property, plant & equipment (Greenblatt - for Return on Capital)
    net_ppe = _get_row_safe(balance_sheet_statements, [
        'Net PPE',
        'Net Property Plant And Equipment',
        'Property Plant Equipment Net'
    ])
    
    # Working capital components
    net_working_capital = current_assets - current_liabilities

    balance_sheet['cash_df'] = cash_df
    balance_sheet['cash_onhand'] = cash_onhand
    balance_sheet['current_assets'] = current_assets
    balance_sheet['current_liabilities'] = current_liabilities
    balance_sheet['intangible_assets'] = intangible_assets
    balance_sheet['total_assets'] = total_assets
    balance_sheet['total_liabilities'] = total_liabilities
    balance_sheet['tangible_assets'] = tangible_assets
    balance_sheet['net_assets'] = net_assets
    
    # New fields for investment book metrics
    balance_sheet['total_debt'] = total_debt
    balance_sheet['long_term_debt'] = long_term_debt
    balance_sheet['short_term_debt'] = short_term_debt
    balance_sheet['stockholders_equity'] = stockholders_equity
    balance_sheet['inventory'] = inventory
    balance_sheet['accounts_receivable'] = accounts_receivable
    balance_sheet['net_ppe'] = net_ppe
    balance_sheet['net_working_capital'] = net_working_capital

    return balance_sheet


def income_statement_data_dic(income_statement):
    """
    Extract key metrics from the income statement for investment book criteria.
    
    Used by:
    - Graham: P/E ratio, earnings stability
    - Greenblatt: EBIT for earnings yield and return on capital
    - Fisher: Revenue growth, profit margins
    - Buffett: Interest coverage
    
    Args:
        income_statement: DataFrame from yfinance financials
        
    Returns:
        Dictionary with income statement metrics
    """
    income_data = {}
    
    # Revenue / Sales (Fisher)
    revenue = _get_row_safe(income_statement, [
        'Total Revenue',
        'Revenue',
        'Operating Revenue'
    ])
    
    # Gross Profit (Fisher - for margin analysis)
    gross_profit = _get_row_safe(income_statement, [
        'Gross Profit'
    ])
    
    # Operating Income / EBIT (Greenblatt)
    ebit = _get_row_safe(income_statement, [
        'EBIT',
        'Operating Income',
        'Operating Profit'
    ])
    
    # Net Income (Graham, Buffett)
    net_income = _get_row_safe(income_statement, [
        'Net Income',
        'Net Income Common Stockholders',
        'Net Income From Continuing Operations'
    ])
    
    # Interest Expense (Buffett - debt coverage)
    interest_expense = _get_row_safe(income_statement, [
        'Interest Expense',
        'Interest Expense Non Operating',
        'Net Interest Income'
    ])
    # Interest expense is typically negative, make it positive for ratio calculation
    if isinstance(interest_expense, pd.Series):
        interest_expense = interest_expense.abs()
    
    # Tax expense (for NOPAT calculation)
    tax_expense = _get_row_safe(income_statement, [
        'Tax Provision',
        'Income Tax Expense'
    ])
    
    # EPS (Graham)
    eps = _get_row_safe(income_statement, [
        'Basic EPS',
        'Diluted EPS'
    ])
    
    # Calculate margins
    gross_margin = gross_profit / revenue if isinstance(revenue, pd.Series) and (revenue != 0).any() else pd.Series(0, index=revenue.index if hasattr(revenue, 'index') else [])
    operating_margin = ebit / revenue if isinstance(revenue, pd.Series) and (revenue != 0).any() else pd.Series(0, index=revenue.index if hasattr(revenue, 'index') else [])
    net_margin = net_income / revenue if isinstance(revenue, pd.Series) and (revenue != 0).any() else pd.Series(0, index=revenue.index if hasattr(revenue, 'index') else [])
    
    # Calculate effective tax rate for NOPAT
    if isinstance(tax_expense, pd.Series) and isinstance(ebit, pd.Series):
        # Avoid division by zero - replace inf with NaN before operating
        tax_rate = (tax_expense / (ebit - interest_expense))
        tax_rate = tax_rate.replace([np.inf, -np.inf], np.nan).fillna(0.25)  # Default 25% if can't calculate
        tax_rate = tax_rate.clip(0, 0.5)  # Reasonable bounds
    else:
        tax_rate = 0.25
    
    income_data['revenue'] = revenue
    income_data['gross_profit'] = gross_profit
    income_data['ebit'] = ebit
    income_data['net_income'] = net_income
    income_data['interest_expense'] = interest_expense
    income_data['tax_expense'] = tax_expense
    income_data['eps'] = eps
    income_data['gross_margin'] = gross_margin
    income_data['operating_margin'] = operating_margin
    income_data['net_margin'] = net_margin
    income_data['tax_rate'] = tax_rate
    
    # Get latest values for convenience
    income_data['revenue_latest'] = revenue.iloc[-1] if isinstance(revenue, pd.Series) and len(revenue) > 0 else 0
    income_data['ebit_latest'] = ebit.iloc[-1] if isinstance(ebit, pd.Series) and len(ebit) > 0 else 0
    income_data['net_income_latest'] = net_income.iloc[-1] if isinstance(net_income, pd.Series) and len(net_income) > 0 else 0
    income_data['interest_expense_latest'] = interest_expense.iloc[-1] if isinstance(interest_expense, pd.Series) and len(interest_expense) > 0 else 0
    income_data['eps_latest'] = eps.iloc[-1] if isinstance(eps, pd.Series) and len(eps) > 0 else 0
    
    return income_data


def cash_flow_data_dic(cash_flow_statement):
    """
    Extract key metrics from cash flow statement for investment book criteria.
    
    Used by:
    - Buffett: Owner earnings (depreciation, capex)
    
    Args:
        cash_flow_statement: DataFrame from yfinance cashflow
        
    Returns:
        Dictionary with cash flow metrics
    """
    cash_flow_data = {}
    
    # Depreciation & Amortization (Buffett - Owner Earnings)
    depreciation = _get_row_safe(cash_flow_statement, [
        'Depreciation And Amortization',
        'Depreciation',
        'Depreciation Amortization Depletion'
    ])
    
    # Capital Expenditures (Buffett - Owner Earnings)
    capex = _get_row_safe(cash_flow_statement, [
        'Capital Expenditure',
        'Purchase Of PPE',
        'Capital Expenditures'
    ])
    # CapEx is typically negative in cash flow, make positive
    if isinstance(capex, pd.Series):
        capex = capex.abs()
    
    # Free Cash Flow
    operating_cash_flow = _get_row_safe(cash_flow_statement, [
        'Operating Cash Flow',
        'Cash Flow From Continuing Operating Activities',
        'Net Cash Provided By Operating Activities'
    ])
    
    # Calculate Free Cash Flow
    free_cash_flow = operating_cash_flow - capex if isinstance(operating_cash_flow, pd.Series) else pd.Series(0)
    
    cash_flow_data['depreciation'] = depreciation
    cash_flow_data['capex'] = capex
    cash_flow_data['operating_cash_flow'] = operating_cash_flow
    cash_flow_data['free_cash_flow'] = free_cash_flow
    
    # Get averages and latest values
    cash_flow_data['depreciation_avg'] = depreciation.mean() if isinstance(depreciation, pd.Series) and len(depreciation) > 0 else 0
    cash_flow_data['capex_avg'] = capex.mean() if isinstance(capex, pd.Series) and len(capex) > 0 else 0
    cash_flow_data['capex_latest'] = capex.iloc[-1] if isinstance(capex, pd.Series) and len(capex) > 0 else 0
    cash_flow_data['fcf_latest'] = free_cash_flow.iloc[-1] if isinstance(free_cash_flow, pd.Series) and len(free_cash_flow) > 0 else 0
    cash_flow_data['fcf_avg'] = free_cash_flow.mean() if isinstance(free_cash_flow, pd.Series) and len(free_cash_flow) > 0 else 0
    
    return cash_flow_data


def net_income_expected(cash_flow_statement, years_projection=10, decay_rate=1.25):
    """
    This function will return the net_income statistics and projections

    Args:
    - cash_flow_statement: DataFrame, takes in the cashflow statement from yfinance.
        Need to be previously downloaded.
    - years_projection int:
    - decay_rate float: weights the expected earnings to more recent years

    Returns:
    - net_income: dictionary containing the following keys:
        - net_income_df
        - expected_net_income
        - net_income_average
        - net_income_average_growth

    """
    # Cashflow fundamentals
    net_income = {}

    # yfinance uses 'Net Income' or 'Net Income From Continuing Operations'
    net_income_df = _get_row_safe(cash_flow_statement, [
        'Net Income',
        'Net Income From Continuing Operations',
        'Net Income From Continuing Operation Net Minority Interest'
    ])

    if isinstance(net_income_df, pd.Series) and len(net_income_df) > 0:
        # Drop NaN values for calculations
        net_income_clean = net_income_df.dropna()
        
        if len(net_income_clean) > 1:  # Need at least 2 points for regression
            net_income_average = net_income_clean.values.mean()

            numerical_years = list(range(len(net_income_clean)))

            # Prepare your data
            X = pd.DataFrame(numerical_years)
            y = net_income_clean.values  # Dependent variable (net income)

            # Fit a linear regression model
            weights = [decay_rate ** i for i in range(len(y))]
            model = LinearRegression()
            model.fit(X, y, sample_weight=weights)
            net_income_average_growth = model.coef_[0] / net_income_average if net_income_average != 0 else 0

            # Make predictions for future time points
            future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
            expected_net_income = model.predict(future_time_points)
        elif len(net_income_clean) == 1:
            net_income_average = float(net_income_clean.values[0])
            net_income_average_growth = 0
            expected_net_income = [net_income_average] * years_projection
        else:
            net_income_average = 0
            net_income_average_growth = 0
            expected_net_income = [0] * years_projection
    else:
        net_income_average = 0
        net_income_average_growth = 0
        expected_net_income = [0] * years_projection

    net_income['net_income_df'] = net_income_df
    net_income['expected_net_income'] = expected_net_income
    net_income['net_income_average'] = net_income_average
    net_income['net_income_average_growth'] = net_income_average_growth

    return net_income


def dividends_expected_dic(cash_flow_statement, years_projection=10):
    """
    This function will calculate the money returned to investors either by dividends or stock buy backs

    Args:
    - cash_flow_statement: takes in the cashflow statement from yfinance
    - years_projection: how many years into the future are you looking to project

    Returns:
    - dividends_dic dictionary
    """
    # Cashflow fundamentals
    dividends_dic = {}

    # yfinance uses different names for dividends
    dividends_df = _get_row_safe(cash_flow_statement, [
        'Cash Dividends Paid',
        'Common Stock Dividend Paid',
        'Payment Of Dividends',
        'Dividends Paid'
    ])

    # Dividends paid is typically negative in cash flow, so we negate it
    if isinstance(dividends_df, pd.Series):
        dividends_df = -dividends_df

    if isinstance(dividends_df, pd.Series) and len(dividends_df) > 0:
        # Drop NaN values for calculations
        dividends_clean = dividends_df.dropna()
        
        if len(dividends_clean) > 1:  # Need at least 2 points for regression
            dividend_average = dividends_clean.values.mean()

            numerical_years = list(range(len(dividends_clean)))

            # Prepare your data
            X = pd.DataFrame(numerical_years)
            y = dividends_clean.values  # Dependent variable (dividends)

            # Fit a linear regression model
            model = LinearRegression()
            model.fit(X, y)

            # Make predictions for future time points
            future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
            expected_dividend = model.predict(future_time_points)
            dividend_average_growth = model.coef_[0] / dividend_average if dividend_average != 0 else 0
        elif len(dividends_clean) == 1:
            dividend_average = float(dividends_clean.values[0])
            dividend_average_growth = 0
            expected_dividend = [dividend_average] * years_projection
        else:
            dividend_average = 0
            dividend_average_growth = 0
            expected_dividend = [0] * years_projection
    else:
        dividend_average = 0
        dividend_average_growth = 0
        expected_dividend = [0] * years_projection

    dividends_dic['dividends_df'] = dividends_df
    dividends_dic['dividend_average_growth'] = dividend_average_growth
    dividends_dic['expected_dividend'] = expected_dividend
    dividends_dic['dividends_average'] = dividend_average

    return dividends_dic


def stock_buybacks_expected(cash_flow_statement, years_projection=10, decay_rate=1.5):
    """
    This function will calculate the value of stock buybacks using weighted linear regression.

    Args:
    - cash_flow_statement: cash flow statement from yfinance
    - years_projection: how many years into the future you want to project
    - decay_rate: rate of exponential decay for assigning weights (default is 1.5)

    Returns:
    - stock_buybacks_dic: dictionary containing information about stock buybacks
    """
    # Cashflow fundamentals
    stock_buybacks_dic = {}

    # yfinance uses different field names for stock operations
    stock_repurchased = _get_row_safe(cash_flow_statement, [
        'Repurchase Of Capital Stock',
        'Common Stock Payments',
        'Repurchase Of Common Stock'
    ])

    stock_issued = _get_row_safe(cash_flow_statement, [
        'Issuance Of Capital Stock',
        'Common Stock Issuance',
        'Proceeds From Stock Option Exercised'
    ])

    # Net buybacks (repurchases are typically negative, issuances positive)
    stock_buybacks_df = -stock_repurchased - stock_issued

    if isinstance(stock_buybacks_df, pd.Series) and len(stock_buybacks_df) > 0:
        # Drop NaN values for calculations
        buybacks_clean = stock_buybacks_df.dropna()
        
        if len(buybacks_clean) > 1:  # Need at least 2 points for regression
            buyback_average = buybacks_clean.values.mean()

            numerical_years = list(range(len(buybacks_clean)))

            # Prepare your data
            X = pd.DataFrame(numerical_years)
            y = buybacks_clean.values  # Dependent variable (stock buybacks)

            # Fit a weighted linear regression model
            weights = [decay_rate ** i for i in range(len(y))]
            model = LinearRegression()
            model.fit(X, y, sample_weight=weights)
            buyback_average_growth = model.coef_[0] / buyback_average if buyback_average != 0 else 0

            # Make predictions for future time points
            future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
            expected_buyback = model.predict(future_time_points)
        elif len(buybacks_clean) == 1:
            buyback_average = float(buybacks_clean.values[0])
            buyback_average_growth = 0
            expected_buyback = [buyback_average] * years_projection
        else:
            buyback_average = 0
            buyback_average_growth = 0
            expected_buyback = [0] * years_projection
    else:
        buyback_average = 0
        buyback_average_growth = 0
        expected_buyback = [0] * years_projection

    stock_buybacks_dic['stock_buybacks_df'] = stock_buybacks_df
    stock_buybacks_dic['buyback_average_growth'] = buyback_average_growth
    stock_buybacks_dic['expected_buyback'] = expected_buyback
    stock_buybacks_dic['buyback_average'] = buyback_average
    stock_buybacks_dic['stock_issued'] = stock_issued if isinstance(stock_issued, pd.Series) else pd.Series()

    return stock_buybacks_dic


def earnings_return_to_shareholders(cash_flow_statement, years_projection=10):
    """
    This function will calculate the earnings returned to investors either by dividends or stock buy backs

    Args:
    - cash_flow_statement: takes in the cashflow statement from yfinance

    Returns:
    - dividends: the dividends paid to shareholders
    - dividends_growth: growth in the dividends being paid
    - stock_buybacks: the value of stock buybacks
    - total_value_returned: dividends & stock_buybacks
    - net_income: Net income
    - retained_earnings: Net_income - total_value_returned
    """
    total_earnings_returned = {}
    dividends_dic = dividends_expected_dic(cash_flow_statement, years_projection)
    buybacks_dic = stock_buybacks_expected(cash_flow_statement, years_projection)

    total_earnings_returned['past_value'] = dividends_dic['dividends_df'] + buybacks_dic['stock_buybacks_df']
    total_earnings_returned['future_value'] = dividends_dic['expected_dividend'] + buybacks_dic['expected_buyback']

    return total_earnings_returned


def get_owners_earnings(income_statement, cash_flow_statement):
    """
    Calculate Owner Earnings - Warren Buffett's preferred measure of true earning power.
    
    Owner Earnings = Net Income + Depreciation & Amortization - Average CapEx
    
    This represents the cash that owners could extract from the business while
    maintaining its competitive position (maintenance capex only).
    
    Source: Warren Buffett's Letters to Shareholders
    
    Args:
        income_statement: DataFrame from yfinance financials
        cash_flow_statement: DataFrame from yfinance cashflow
        
    Returns:
        Dictionary with owner earnings metrics
    """
    owners_earnings_dic = {}
    
    # Get net income
    net_income = _get_row_safe(cash_flow_statement, [
        'Net Income',
        'Net Income From Continuing Operations',
        'Net Income From Continuing Operation Net Minority Interest'
    ])
    
    # Get depreciation & amortization
    depreciation = _get_row_safe(cash_flow_statement, [
        'Depreciation And Amortization',
        'Depreciation',
        'Depreciation Amortization Depletion'
    ])
    
    # Get capital expenditures (make positive)
    capex = _get_row_safe(cash_flow_statement, [
        'Capital Expenditure',
        'Purchase Of PPE',
        'Capital Expenditures'
    ])
    if isinstance(capex, pd.Series):
        capex = capex.abs()
    
    # Calculate owner earnings for each year
    if isinstance(net_income, pd.Series) and isinstance(depreciation, pd.Series) and isinstance(capex, pd.Series):
        # Use average capex as proxy for maintenance capex (conservative estimate)
        avg_capex = capex.mean() if len(capex) > 0 else 0
        
        # Owner Earnings = Net Income + D&A - Maintenance CapEx
        # We use average capex as a proxy for maintenance capex
        owners_earnings = net_income + depreciation - avg_capex
        
        owners_earnings_dic['owners_earnings'] = owners_earnings
        owners_earnings_dic['owners_earnings_latest'] = owners_earnings.iloc[-1] if len(owners_earnings) > 0 else 0
        owners_earnings_dic['owners_earnings_avg'] = owners_earnings.mean() if len(owners_earnings) > 0 else 0
        owners_earnings_dic['net_income'] = net_income
        owners_earnings_dic['depreciation'] = depreciation
        owners_earnings_dic['capex'] = capex
        owners_earnings_dic['avg_capex'] = avg_capex
    else:
        owners_earnings_dic['owners_earnings'] = pd.Series(0)
        owners_earnings_dic['owners_earnings_latest'] = 0
        owners_earnings_dic['owners_earnings_avg'] = 0
        owners_earnings_dic['net_income'] = net_income
        owners_earnings_dic['depreciation'] = depreciation
        owners_earnings_dic['capex'] = capex
        owners_earnings_dic['avg_capex'] = 0
    
    return owners_earnings_dic


def get_invested_capital(balance_sheet_statements):
    """
    Calculate Invested Capital for ROIC calculation.
    
    Invested Capital = Total Assets - Cash - Non-interest-bearing Current Liabilities
    
    Alternative: Invested Capital = Debt + Equity - Cash
    
    Source: Warren Buffett, Joel Greenblatt
    
    Args:
        balance_sheet_statements: DataFrame from yfinance balance sheet
        
    Returns:
        Dictionary with invested capital metrics
    """
    invested_capital_dic = {}
    
    # Get total assets
    total_assets = _get_row_safe(balance_sheet_statements, ['Total Assets'])
    
    # Get cash
    cash = _get_row_safe(balance_sheet_statements, [
        'Cash And Cash Equivalents',
        'Cash And Cash Equivalents And Short Term Investments',
        'Cash'
    ])
    
    # Get current liabilities (non-interest bearing)
    current_liabilities = _get_row_safe(balance_sheet_statements, [
        'Current Liabilities',
        'Total Current Liabilities'
    ])
    
    # Get accounts payable (non-interest bearing)
    accounts_payable = _get_row_safe(balance_sheet_statements, [
        'Accounts Payable',
        'Payables'
    ])
    
    # Get current debt (interest bearing - should be excluded from non-interest bearing)
    current_debt = _get_row_safe(balance_sheet_statements, [
        'Current Debt',
        'Current Debt And Capital Lease Obligation',
        'Short Term Debt'
    ])
    
    # Non-interest bearing current liabilities = Current Liabilities - Current Debt
    nibcl = current_liabilities - current_debt
    
    # Invested Capital = Total Assets - Cash - Non-interest-bearing Current Liabilities
    if isinstance(total_assets, pd.Series) and isinstance(cash, pd.Series) and isinstance(nibcl, pd.Series):
        invested_capital = total_assets - cash - nibcl
        
        invested_capital_dic['invested_capital'] = invested_capital
        invested_capital_dic['invested_capital_latest'] = invested_capital.iloc[-1] if len(invested_capital) > 0 else 0
        invested_capital_dic['invested_capital_avg'] = invested_capital.mean() if len(invested_capital) > 0 else 0
    else:
        invested_capital_dic['invested_capital'] = pd.Series(0)
        invested_capital_dic['invested_capital_latest'] = 0
        invested_capital_dic['invested_capital_avg'] = 0
    
    invested_capital_dic['total_assets'] = total_assets
    invested_capital_dic['cash'] = cash
    invested_capital_dic['nibcl'] = nibcl
    
    return invested_capital_dic


def get_shares_outstanding(ticker_symbol, ticker_info=None):
    """
    Get shares outstanding for per-share calculations.
    
    Uses rate limiting and caching to handle Yahoo Finance rate limits.
    
    Args:
        ticker_symbol: Stock ticker symbol
        ticker_info: Optional pre-fetched ticker info dict to avoid redundant API calls
        
    Returns:
        Shares outstanding (float)
    """
    try:
        # Use pre-fetched info if available, otherwise fetch with rate limiting
        if ticker_info is None:
            ticker_info = get_ticker_info(ticker_symbol)
        
        shares = ticker_info.get('shares') or ticker_info.get('sharesOutstanding') or ticker_info.get('impliedSharesOutstanding', 0)
        return shares or 0
    except Exception:
        return 0
