
def calculate_average_price(stock_data_df):
    """
    Calculate Average Price of stock over x years
    - This is a good gauge of where the market has perceived the stock
    - This is a very basic way to find potentially missed priced assets

    args:
    -stock_data: data of the stock in a dataframe over x years

    returns:
    - average_price: the average price paid over the years
    """

    average_price = stock_data_df['Close'].mean()

    # Ensure we return a scalar value (yfinance may return Series with ticker index)
    if hasattr(average_price, 'item'):
        average_price = average_price.item()
    elif hasattr(average_price, 'iloc'):
        average_price = average_price.iloc[0]

    return average_price


def pad_valuation(net_income_dictionary, risk_free_rate=.04, years=10, detailed=False):
    """
    Calculate the present value of projected cash flows based on average net income,
    average growth rate, and risk-free discount rate.

    Args:
    - net_income_dictionary: dictionary containing net_income balances from cashflow statement
    - risk_free_rate (float): Risk-free interest rate (annualized) used for discounting.
    - years int: Number of years to project
    - detailed (bool): If True, return (value, breakdown_dict) with year-by-year data.

    Returns:
    - value (float): Present value of the projected cash flows
    - breakdown (dict): Only when detailed=True. Year-by-year calculation data.
    """

    net_income_growth = net_income_dictionary['net_income_average_growth']
    net_income_earning = net_income_dictionary['net_income_average']
    value = 0
    year_by_year = []
    # Calculate present value for each future period
    for i in range(years):
        # Project future cash flow with growth
        future_cf = net_income_earning * (1 + net_income_growth) ** (i + 1)
        # Discount back to present value
        discount_factor = 1 / ((1 + risk_free_rate) ** (i + 1))
        value_temp = future_cf * discount_factor
        value = value + value_temp

        if detailed:
            year_by_year.append({
                'year': i + 1,
                'future_cash_flow': float(future_cf),
                'discount_factor': round(float(discount_factor), 6),
                'present_value': float(value_temp),
                'cumulative_pv': float(value),
            })

    if detailed:
        return value, {
            'method': 'PAD (Compound Growth)',
            'inputs': {
                'net_income_average': float(net_income_earning),
                'growth_rate': float(net_income_growth),
                'discount_rate': float(risk_free_rate),
                'projection_years': years,
            },
            'year_by_year': year_by_year,
            'total_present_value': float(value),
        }
    return value

def pad_valuation_dividend(dividends_dic, risk_free_rate=.04, years=10, detailed=False):
    """
    Calculate the present value of projected dividend cash flows based on average dividends,
    average growth rate, and risk-free discount rate.

    Args:
    - dividends_dic: dictionary containing dividend data from cashflow statement
    - risk_free_rate (float): Risk-free interest rate (annualized) used for discounting.
    - years int: Number of years to project
    - detailed (bool): If True, return (value, breakdown_dict) with year-by-year data.

    Returns:
    - value (float): Present value of the projected dividend cash flows
    - breakdown (dict): Only when detailed=True. Year-by-year calculation data.
    """

    dividend_growth = dividends_dic['dividend_average_growth']
    dividend_average = dividends_dic['dividends_average']
    value = 0
    year_by_year = []
    # Calculate present value for each future period
    for i in range(years):
        # Project future dividend with growth
        future_dividend = dividend_average * (1 + dividend_growth) ** (i + 1)
        # Discount back to present value
        discount_factor = 1 / ((1 + risk_free_rate) ** (i + 1))
        value_temp = future_dividend * discount_factor
        value = value + value_temp

        if detailed:
            year_by_year.append({
                'year': i + 1,
                'future_cash_flow': float(future_dividend),
                'discount_factor': round(float(discount_factor), 6),
                'present_value': float(value_temp),
                'cumulative_pv': float(value),
            })

    if detailed:
        return value, {
            'method': 'PAD Dividend (Compound Growth)',
            'inputs': {
                'dividend_average': float(dividend_average),
                'growth_rate': float(dividend_growth),
                'discount_rate': float(risk_free_rate),
                'projection_years': years,
            },
            'year_by_year': year_by_year,
            'total_present_value': float(value),
        }
    return value


def dcf_valuation(net_income_dictionary, risk_free_rate=.04, detailed=False):
    """
    Calculate the present value of cash flows.

    Args:
    - net_income_dictionary : Dictionary from net_income_expected function
                              contains list containing expected cash flows. which were obtained using linear regression
    - risk_free_rate (float): Risk-free interest rate (annualized).
    - detailed (bool): If True, return (value, breakdown_dict) with year-by-year data.

    Returns:
    - value (float): Present value of the expected cash flows.
    - breakdown (dict): Only when detailed=True. Year-by-year calculation data.
    """
    cashflows = net_income_dictionary['expected_net_income']

    value = 0
    year_by_year = []

    for i, cashflow in enumerate(cashflows):
        discount_factor = 1 / ((1 + risk_free_rate) ** (i + 1))
        discounted_value = cashflow * discount_factor
        value = value + discounted_value

        if detailed:
            year_by_year.append({
                'year': i + 1,
                'projected_cash_flow': float(cashflow),
                'discount_factor': round(float(discount_factor), 6),
                'present_value': float(discounted_value),
                'cumulative_pv': float(value),
            })

    if detailed:
        return value, {
            'method': 'DCF (Linear Regression)',
            'inputs': {
                'discount_rate': float(risk_free_rate),
                'projection_years': len(cashflows),
                'regression_model': 'Weighted Linear Regression (decay=0.8)',
            },
            'year_by_year': year_by_year,
            'total_present_value': float(value),
        }
    return value

def net_net_working_capital(balance_sheet_dic):
    """
    net net working capital or net current asset value is a rough gauge of the liquidation value of a company.
    This should only be used for distressed companies or companies whose discounted cashflow is negative.

    Args:
    - balance_sheet_dic : Dictionary of balance sheet data

    Returns:
    - net_net_working_capital (float): Value of the company given it closes today and liquidates
    """
    current_assets = balance_sheet_dic['current_assets']
    total_liabilities = balance_sheet_dic['total_liabilities']

    net_net_working_capital_series = current_assets - total_liabilities
    # Return the most recent value as a float
    net_net_wc = net_net_working_capital_series.iloc[-1]

    return net_net_wc

def book_value(balance_sheet_dic, detailed=False):
    """
    calculated book value of a firm,

    args:
    balance_sheet_dic dictionary: containing balance sheet key data points
    detailed (bool): If True, return (value, breakdown_dict) with historical data.

    returns:
    book_value: shareholders equity (latest)
    breakdown (dict): Only when detailed=True. Historical assets/liabilities/equity.
    """

    total_assets = balance_sheet_dic['total_assets']
    total_liabilities = balance_sheet_dic['total_liabilities']

    book_value_df = total_assets - total_liabilities
    bv = book_value_df.iloc[-1]

    if detailed:
        import pandas as pd
        historical = []
        for i in range(len(book_value_df)):
            date_idx = book_value_df.index[i] if hasattr(book_value_df, 'index') else i
            year = date_idx.year if hasattr(date_idx, 'year') else str(date_idx)[:4]
            historical.append({
                'year': int(year),
                'total_assets': float(total_assets.iloc[i]) if not pd.isna(total_assets.iloc[i]) else 0,
                'total_liabilities': float(total_liabilities.iloc[i]) if not pd.isna(total_liabilities.iloc[i]) else 0,
                'book_value': float(book_value_df.iloc[i]) if not pd.isna(book_value_df.iloc[i]) else 0,
            })
        return bv, {
            'method': 'Book Value (Assets - Liabilities)',
            'latest': {
                'total_assets': float(total_assets.iloc[-1]) if not pd.isna(total_assets.iloc[-1]) else 0,
                'total_liabilities': float(total_liabilities.iloc[-1]) if not pd.isna(total_liabilities.iloc[-1]) else 0,
                'book_value': float(bv) if not pd.isna(bv) else 0,
            },
            'historical': historical,
        }
    return bv

def tangible_book_value(balance_sheet_dic):
    """
    calculate the tangible book value of a firm,

    args:
    balance_sheet_dic dictionary: containing balance sheet key data points

    returns:
    book_value_df: dataframe of shareholders equity, going back the number of years of the balance sheet
    """

    tangible_assets = balance_sheet_dic['tangible_assets']
    total_liabilities = balance_sheet_dic['total_liabilities']

    tangible_book_value_df = tangible_assets - total_liabilities
    tangible_book_value = tangible_book_value_df.iloc[-1]

    return tangible_book_value

def value_created():
    """
    TODO: Not yet implemented.

    This function will look at the net income, compare it against the dividend, buybacks and return on capital employed
    We want companies who give shareholders a positive return from monies earned.

    How will we do this?
    - If we take the net income subtract dividends and buy backs we will get monies retained. from this we will look at
    how well management turns those monies retained into additional earnings growth over the years studied.
    - If management is re-purchasing stock, is this at a price that will destroy value or gain value? are they buying
    over the intrinsic value of the cashflows. If so they are buying future dollars for more than $1
    """
    # TODO: Implement this function
    raise NotImplementedError("value_created() is not yet implemented")

