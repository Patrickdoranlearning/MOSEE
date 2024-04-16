import yfinance as yf
from forex_python.converter import CurrencyRates


def get_stock_data(ticker, start_date, end_date):
    """

    :type ticker: object
    :param start_date:
    :param end_date:

    """
    # download market data
    stock_data = yf.download(ticker, start=start_date, end=end_date)
    # download shares outstanding
    tick = yf.Ticker(ticker)
    tick_info = tick.fast_info
    shares_outstanding = tick_info['shares']
    closing_price = stock_data['Close'][-1]
    currency = tick_info['currency']
    if shares_outstanding is not None:
        mcap = shares_outstanding * closing_price
    else:
        mcap = tick_info['market_cap']

    return stock_data, mcap, currency


def get_ticker_info(ticker):
    """

    :type ticker: object
    """
    ticker_object = yf.Ticker(ticker)
    ticker_info = ticker_object.get_info()
    return ticker_info


def convert_currency(amount, currency_from, currency_to):
    """
    Production---
    Convert a specified amount from one currency to another.
    The amount can be a single float value or a dataframe

    Args:
    - amount (float or dataframe): The amount of currency to convert.
    - currency_from (str): The currency code to convert from.
    - currency_to (str): The currency code to convert to.

    Returns:
    - float: The converted amount in the target currency.
    """
    c = CurrencyRates()
    exchange_rate = c.get_rate(currency_from, currency_to)
    converted_amount = amount * exchange_rate
    return converted_amount
