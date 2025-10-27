def book_value(balance_sheet_statements_fmp):
    """
    calculated book value of a firm,

    args:
    balance_sheet_statements_fmp: dataframe- takes balance sheet from financial model prep

    returns:
    book_value_df: dataframe of shareholders equity, going back the number of years of the balance sheet
    """

    total_assets = balance_sheet_statements_fmp.loc['Intangible Assets']
    total_liabilities = balance_sheet_statements_fmp.loc['Total Liabilities']

    book_value_df = total_assets - total_liabilities

    return book_value_df


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


