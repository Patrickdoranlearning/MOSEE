from datetime import datetime
from typing import Optional, Union

import pandas as pd
import yfinance as yf
from sklearn.linear_model import LinearRegression


BALANCE_SHEET_RENAMES = {
    'CashAndCashEquivalents': 'Cash and Cash Equivalents',
    'TotalCurrentAssets': 'Total Current Assets',
    'TotalCurrentLiabilities': 'Total Current Liabilities',
    'IntangibleAssets': 'Intangible Assets',
    'TotalAssets': 'Total Assets',
    'TotalLiab': 'Total Liabilities',
    'TotalLiabilitiesNetMinorityInterest': 'Total Liabilities',
}

CASH_FLOW_RENAMES = {
    'NetIncome': 'Net Income',
    'DividendsPaid': 'Dividends Paid',
    'RepurchaseOfCapitalStock': 'Common Stock Purchased',
    'RepurchaseOfStock': 'Common Stock Purchased',
    'CommonStockRepurchased': 'Common Stock Purchased',
    'IssuanceOfCapitalStock': 'Common Stock Issued',
    'IssuanceOfStock': 'Common Stock Issued',
    'CommonStockIssued': 'Common Stock Issued',
}

INCOME_STATEMENT_RENAMES = {
    'NetIncome': 'Net Income',
}


def _rename_statement_index(statement: pd.DataFrame, rename_map: dict) -> pd.DataFrame:
    if statement is None or statement.empty:
        return statement
    applicable = {old: new for old, new in rename_map.items() if old in statement.index}
    if applicable:
        statement = statement.rename(index=applicable)
    return statement


def _get_statement_row(statement: pd.DataFrame, *names: str,
                       default: Optional[Union[float, int]] = None) -> pd.Series:
    if statement is None or statement.empty:
        raise KeyError("Statement is empty")
    for name in names:
        if name in statement.index:
            return statement.loc[name]
    if default is not None:
        return pd.Series(default, index=statement.columns, dtype='float64')
    raise KeyError(f"None of the provided row names {names} were found in the statement index")


def _normalise_statement(statement: pd.DataFrame,
                         rename_map: dict,
                         start_date: Optional[str]) -> pd.DataFrame:
    """Prepare Yahoo Finance statements so they resemble the historical Toolkit layout."""

    if statement is None or statement.empty:
        return pd.DataFrame()

    statement = statement.copy()
    statement = _rename_statement_index(statement, rename_map)

    # Drop duplicate columns that occasionally appear in Yahoo data
    statement = statement.loc[:, ~statement.columns.duplicated()]

    # Filter the look-back window if the caller supplied a start date
    if start_date:
        try:
            cutoff = pd.Timestamp(start_date)
            statement = statement.loc[:, statement.columns >= cutoff]
        except Exception:
            # If the start date cannot be parsed we keep all data to avoid surprises
            pass

    # Sort oldest->newest to match the Toolkit responses and convert to string labels
    statement = statement.sort_index(axis=1)
    formatted_columns = []
    for column in statement.columns:
        if isinstance(column, (pd.Timestamp, datetime)):
            formatted_columns.append(column.strftime('%Y-%m-%d'))
        else:
            formatted_columns.append(str(column))
    statement.columns = formatted_columns

    # Yahoo returns numeric values alongside NaNs; keep the numeric view consumers expect
    return statement.fillna(0)


def fundamental_downloads(ticker_temp, API_KEY=None, start_date='2015-05-01'):
    """
    Download the fundamental statements for a ticker using Yahoo Finance.

    Args:
    - ticker_temp: the ticker of the security we are investigating
    - start_date string: The start date looking back x years. Typically, 7 or 10 years in the past
    - API_KEY: Kept for backwards compatibility, not used

    Returns:
    - fundamentals dictionary: of all fundamental dat
    """

    fundamentals = {}

    ticker = yf.Ticker(ticker_temp)

    balance_sheet_statements = _normalise_statement(ticker.balance_sheet, BALANCE_SHEET_RENAMES, start_date)
    cash_flow_statements = _normalise_statement(ticker.cashflow, CASH_FLOW_RENAMES, start_date)
    income_sheet_statements = _normalise_statement(ticker.financials, INCOME_STATEMENT_RENAMES, start_date)

    fundamentals['balance_sheet_statements'] = balance_sheet_statements
    fundamentals['cash_flow_statements'] = cash_flow_statements
    fundamentals['income_sheet_statements'] = income_sheet_statements

    return fundamentals


def balance_sheet_data_dic(balance_sheet_statements_fmp):
    """
    This function will extract certain assets and liabilities of interest from the balance sheet statement

    Args:
    - balance_sheet_statements_fmp dataframe: takes in the balance statement retrieved for the ticker

    Returns:
    - balance_sheet dictionary:  which contains key data from balance sheet,
    """
    balance_sheet = {}
    cash_df = _get_statement_row(balance_sheet_statements_fmp, 'Cash and Cash Equivalents', 'CashAndCashEquivalents')
    cash_on_hand = cash_df.iloc[-1]
    current_assets = _get_statement_row(balance_sheet_statements_fmp, 'Total Current Assets', 'TotalCurrentAssets')
    current_liabilities = _get_statement_row(balance_sheet_statements_fmp, 'Total Current Liabilities',
                                            'TotalCurrentLiabilities')
    intangible_assets = _get_statement_row(balance_sheet_statements_fmp, 'Intangible Assets', 'IntangibleAssets',
                                           default=0).fillna(0)
    total_assets = _get_statement_row(balance_sheet_statements_fmp, 'Total Assets', 'TotalAssets')
    total_liabilities = _get_statement_row(balance_sheet_statements_fmp, 'Total Liabilities', 'TotalLiabilities',
                                           'TotalLiab', 'TotalLiabilitiesNetMinorityInterest')
    tangible_assets = total_assets - intangible_assets
    net_assets = total_assets - total_liabilities

    balance_sheet['cash_df'] = cash_df
    balance_sheet['cash_on_hand'] = cash_on_hand
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
    - cash_flow_statement_fmp: DataFrame, takes in the cashflow statement retrieved for the ticker.
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
    net_income_df = _get_statement_row(cash_flow_statement_fmp, 'Net Income', 'NetIncome')

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


def dividends_expected_dic(cash_flow_statement_fmp, years_projection=10):
    """
    This function will calculate the money returned to investors either by dividends or stock buy backs

    Args:
    - cash_flow_statements: takes in the cashflow statement retrieved for the ticker
    - years_projection: how many years into the future are you looking to project

    Returns:
    - dividends_dic dictionary
    """
    import pandas as pd
    from sklearn.linear_model import LinearRegression

    # Cashflow fundamentals
    dividends_dic = {}
    dividends_df = - _get_statement_row(cash_flow_statement_fmp, 'Dividends Paid', 'DividendsPaid')

    dividend_average = dividends_df.values.mean()

    # Assuming dividends_df contains your DataFrame with dividend data
    numerical_years = list(range(len(dividends_df)))

    # Prepare your data
    X = pd.DataFrame(numerical_years)
    y = dividends_df.values  # Dependent variable (dividends)

    # Fit a linear regression model
    model = LinearRegression()
    model.fit(X, y)

    # Make predictions for future time points
    future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
    expected_dividend = model.predict(future_time_points)
    dividend_average_growth = model.coef_[0] / (dividend_average * years_projection)

    dividends_dic['dividends_df'] = dividends_df
    dividends_dic['dividend_average_growth'] = dividend_average_growth
    dividends_dic['expected_dividend'] = expected_dividend
    dividends_dic['dividends_average'] = dividend_average

    return dividends_dic


def stock_buybacks_expected(cash_flow_statement_fmp, years_projection=10, decay_rate=1.5):
    """
    TODO
    This function will calculate the value of stock buybacks using weighted linear regression.

    Args:
    - cash_flow_statement_fmp: cash flow statement retrieved for the ticker
    - years_projection: how many years into the future you want to project
    - decay_rate: rate of exponential decay for assigning weights (default is 0.9)

    Returns:
    - stock_buybacks_dic: dictionary containing information about stock buybacks
    """
    # Cashflow fundamentals
    stock_buybacks_dic = {}
    stock_buybacks_df = (- _get_statement_row(cash_flow_statement_fmp, 'Common Stock Purchased',
                                             'Repurchase Of Capital Stock', 'RepurchaseOfCapitalStock',
                                             'RepurchaseOfStock', 'CommonStockRepurchased')
                         - _get_statement_row(cash_flow_statement_fmp, 'Common Stock Issued',
                                             'Issuance Of Capital Stock', 'IssuanceOfCapitalStock',
                                             'IssuanceOfStock', 'CommonStockIssued', default=0))

    buyback_average = stock_buybacks_df.values.mean()

    # Assuming stock_buybacks_df contains your DataFrame with stock buybacks data
    numerical_years = list(range(len(stock_buybacks_df)))

    # Prepare your data
    X = pd.DataFrame(numerical_years)
    y = stock_buybacks_df.values  # Dependent variable (stock buybacks)

    # Fit a weighted linear regression model
    weights = [decay_rate ** i for i in range(len(y))]
    model = LinearRegression()
    model.fit(X, y, sample_weight=weights)
    buyback_average_growth = model.coef_[0] / (buyback_average * years_projection)

    # Make predictions for future time points
    future_time_points = [[max(numerical_years) + i + 1] for i in range(years_projection)]
    expected_buyback = model.predict(future_time_points)

    stock_buybacks_dic['stock_buybacks_df'] = stock_buybacks_df
    stock_buybacks_dic['buyback_average_growth'] = buyback_average_growth
    stock_buybacks_dic['expected_buyback'] = expected_buyback
    stock_buybacks_dic['buyback_average'] = buyback_average
    stock_buybacks_dic['stock_issued'] = buyback_average  # how many shares were sold as options to insiders?
    # TODO
    # stock_buybacks_dic['treasury_stocks_added'] = treasury_stock  # now many shares were taken out of circulation?

    return stock_buybacks_dic


def earnings_return_to_shareholders(cash_flow_statement_fmp, years_projection=10):
    """
    This function will calculate the earnings returned to investors either by dividends or stock buy backs

    Args:
    - cash_flow_statements: takes in the cashflow statement retrieved for the ticker

    Returns:
    - dividends: the dividends paid to shareholders
    - dividends_growth: growth in the dividends being paid
    - stock_buybacks: the value of stock buybacks
    - total_value_returned: dividends & stock_buybacks
    - net_income: Net income
    - retained_earnings: Net_income - total_value_returned
    """
    total_earnings_returned = {}
    dividends_dic = dividends_expected_dic(cash_flow_statement_fmp, years_projection)
    buybacks_dic = stock_buybacks_expected(cash_flow_statement_fmp, years_projection)

    total_earnings_returned['past_value'] = dividends_dic['dividends_df'] + buybacks_dic['stock_buybacks_df']
    total_earnings_returned['future_value'] = dividends_dic['expected_dividend'] + buybacks_dic['expected_buyback']

    return total_earnings_returned


def get_owners_earnings(balance_sheet_statements_fmp, cash_flow_statement_fmp):
    """
    TODO
    owners_earnings float: operating profit + deprecation + amortisation of goodwill
                            - federal income tax (average) - cost of stock options
                            - maintenance costs(essential capital expenditures)
                            - any income from unsustainable sources

    Args:
    - cash_flow_statements: takes in the cashflow statement retrieved for the ticker

    Returns:
    - owners_earnings float:
    """

    pass

    return


def get_invested_capital(balance_sheet_statements_fmp):
    """
    TODO
    owners_earnings float: operating profit + deprecation + amortisation of goodwill
                            - federal income tax (average) - cost of stock options
                            - maintenance costs(essential capital expenditures)
                            - any income from unsustainable sources

    Args:
    - cash_flow_statements: takes in the cashflow statement retrieved for the ticker

    Returns:
    - owners_earnings float:
    """

    return invested_capital


def get_debt_calls(_sheet_statements_fmp):
    """
    TODO
    Calculates how much debt held by the company & how much that company will need to pay annually to service the debts

    Args:
    - Cashflow_statements: takes in the cashflow statement retrieved for the ticker

    Returns:
    - owners_earnings float:
    """

    return invested_capital
