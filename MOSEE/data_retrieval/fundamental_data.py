from financetoolkit import Toolkit
import pandas as pd
from sklearn.linear_model import LinearRegression


def fundamental_downloads(ticker_temp, API_KEY, start_date='2015-05-01'):
    """
    This function will download from financial model prep of all the fundamental data.

    Args:
    - ticker_temp: the ticker of the security we are investigating
    - start_date string: The start date looking back x years. Typically, 7 or 10 years in the past
    - API_KEY: This is the api_key from financial model prep

    Returns:
    - fundamentals dictionary: of all fundamental dat
    """

    fundamentals = {}

    financial_prep = Toolkit([ticker_temp], api_key=API_KEY, start_date=start_date, convert_currency=False)

    balance_sheet_statements = financial_prep.get_balance_sheet_statement()
    cash_flow_statements = financial_prep.get_cash_flow_statement()
    income_sheet_statements = financial_prep.get_income_statement()

    fundamentals['balance_sheet_statements'] = balance_sheet_statements
    fundamentals['cash_flow_statements'] = cash_flow_statements
    fundamentals['income_sheet_statements'] = income_sheet_statements

    return fundamentals


def balance_sheet_data(balance_sheet_statements_fmp):
    """
    This function will extract certain assets and liabilities of interest from the balance sheet statement

    Args:
    - balance_sheet_statements_fmp dataframe: takes in the balance statement from the financial model prep

    Returns:
    - balance_sheet dictionary:  which contains key data from balance sheet,
    """
    balance_sheet = {}
    cash_df = balance_sheet_statements_fmp.loc['Cash and Cash Equivalents']
    cash_onhand = cash_df.iloc[-1]
    current_assets = balance_sheet_statements_fmp.loc['Total Current Assets']
    current_liabilities = balance_sheet_statements_fmp.loc['Total Current Liabilities']
    intangible_assets = balance_sheet_statements_fmp.loc['Intangible Assets']
    total_assets = balance_sheet_statements_fmp.loc['Intangible Assets']
    total_liabilities = balance_sheet_statements_fmp.loc['Total Liabilities']
    tangible_assets = total_assets - intangible_assets
    net_assets = total_assets - total_liabilities

    balance_sheet['cash_df'] = cash_df
    balance_sheet['cash_onhand'] = cash_onhand
    balance_sheet['current_assets'] = current_assets
    balance_sheet['current_liabilities'] = current_liabilities
    balance_sheet['intangible_assets'] = intangible_assets
    balance_sheet['total_assets'] = total_assets
    balance_sheet['total_liabilities'] = total_liabilities
    balance_sheet['tangible_assets'] = tangible_assets
    balance_sheet['net_assets'] = net_assets

    return balance_sheet


def net_income_expected(cash_flow_statement_fmp, years_projection=10, decay_rate=1.25):
    """
    This function will return the net_income statistics and projections

    Args:
    - cash_flow_statement_fmp: DataFrame, takes in the cashflow statement from the financial model prep.
        Need to be previously downloaded.
    - years_projection int:
    - decay_rate float: weights the expected earnings to more recent years

    Returns:
    - net_income: disctionary containing the following keys:
        - net_income_df
        - expected_net_income
        - net_income_average
        - net_income_average_growth

    """
    # Cashflow fundamentals
    net_income = {}
    net_income_df = cash_flow_statement_fmp.loc['Net Income']

    net_income_average = net_income_df.values.mean()

    numerical_years = list(range(len(net_income_df)))

    # Prepare your data
    X = pd.DataFrame(numerical_years)
    y = net_income_df.values  # Dependent variable (net income)

    # Fit a linear regression model
    weights = [decay_rate ** i for i in range(len(y))]
    model = LinearRegression()
    model.fit(X, y, sample_weight=weights)
    net_income_average_growth = model.coef_[0] / (net_income_average * years_projection)

    # Make predictions for future time points
    future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
    expected_net_income = model.predict(future_time_points)

    net_income['net_income_df'] = net_income_df
    net_income['expected_net_income'] = expected_net_income
    net_income['net_income_average'] = net_income_average
    net_income['net_income_average_growth'] = net_income_average_growth

    return net_income
