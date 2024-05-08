
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

    return average_price


def pad_valuation(net_income_dictionary, risk_free_rate=.04, years=10):
    """
    Here i will explore a projected cashflow of a firm based on average net income,
    average growth and risk-free rate.

    Args:
    - net_income_dictionary: dictionary containing net_income balances from cashflow statement
    - risk_free_rate (float): Risk-free interest rate (annualized).
    - years int:

    Returns:
    - value (float): Present value of the generalised cash flows
    """

    net_income_growth = net_income_dictionary['net_income_average_growth']
    net_income_earning = net_income_dictionary['net_income_average']
    value = 0
    # Calculate discount factor for each time period
    for i in range(years):
        value_temp = net_income_earning * (1 + net_income_growth - risk_free_rate) ** (i+1)
        value = value + value_temp
    return value

def pad_valuation_dividend(dividends_dic, risk_free_rate=.04, years=10):
    """
    Here i will explore a projected cashflow of a firm based on average net income,
    average growth and risk-free rate.

    Args:
    - net_income_dictionary: dictionary containing net_income balances from cashflow statement
    - risk_free_rate (float): Risk-free interest rate (annualized).
    - years int:

    Returns:
    - value (float): Present value of the generalised cash flows
    """

    dividend_growth = dividends_dic['dividend_average_growth']
    dividend_average = dividends_dic['dividends_average']
    value = 0
    # Calculate discount factor for each time period
    for i in range(years):
        value_temp = dividend_average * (1 + dividend_growth - risk_free_rate) ** (i+1)
        value = value + value_temp
    return value


def dcf_valuation(net_income_dictionary, risk_free_rate=.04):
    """
    Calculate the present value of cash flows.

    Args:
    - net_income_dictionary : Dictionary from net_income_expected function
                              contains list containing expected cash flows. which were obtained using linear regression
    - risk_free_rate (float): Risk-free interest rate (annualized).

    Returns:
    - value (float): Present value of the expected cash flows.
    """
    cashflows = net_income_dictionary['expected_net_income']

    value = 0

    for i, cashflow in enumerate(cashflows):
        discount_factor = 1 / ((1 + risk_free_rate) ** (i + 1))
        discounted_value = cashflow * discount_factor
        value = value + discounted_value
    return value

def net_net_working_capital(balance_sheet_dic):
    """
    net net working capital or net current asset value is a rough gauge of the liquidation value of a company.
    This should only be used for distressed companies. or companies who's discounted cashflow is negative.

    Args:
    - balance_sheet_dic : Dictionary of balance sheet data. Contains most

    Returns:
    - net_net_working_capital (float): Value of the company given it closes today and liquidates
    """
    current_assets = balance_sheet_dic['current_assets']
    total_liabilities = balance_sheet_dic['total_liabilities']
    current_liabilities = balance_sheet_dic['current_liabilities']

    net_working_capital = current_assets - current_liabilities
    net_net_working_capital = current_assets - total_liabilities

    return net_net_working_capital

def book_value(balance_sheet_dic):
    """
    calculated book value of a firm,

    args:
    balance_sheet_dic dictionary: containing balance sheet key data points

    returns:
    book_value_df: dataframe of shareholders equity, going back the number of years of the balance sheet
    """

    total_assets = balance_sheet_dic['total_assets']
    total_liabilities = balance_sheet_dic['total_liabilities']

    book_value_df = total_assets - total_liabilities
    book_value = book_value_df[-1]


    return book_value

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
    tangible_book_value = tangible_book_value_df[-1]

    return tangible_book_value

def value_created():
    """
    TODO

    This function will look at the net income, compare it against the dividend, buybacks and return on capital employed
    We want companies who give shareholders a positive return from monies earned.

    How will we do this?
    - If we take the net income subtract dividends and buy backs we will get monies retained. from this we will look at
    how well management turns those monies retained into additional earnings growth over the years studied.
    - If management is re-purchasing stock, is this at a price that will destroy value or gain value? are they buying
    over the intrinsic value of the cashflows. If so they are buying future dollars for more than $1
    """
    value_derived

