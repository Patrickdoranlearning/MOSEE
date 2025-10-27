import yfinance as yf
from forex_python.converter import CurrencyRates
import freecurrencyapi
from datetime import date, timedelta, datetime
import pandas as pd

CURRENCY_API = "fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5"
currency_api_key = 'fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5'


def get_stock_data(ticker, start_date, end_date):
    """

    :type ticker: object
    :param start_date:
    :param end_date:

    """
    # download market data
    print('getting stock data')
    stock_data = yf.download(ticker, start=start_date, end=end_date)
    # download shares outstanding
    tick = yf.Ticker(ticker)
    tick_info = tick.fast_info
    shares_outstanding = tick_info['shares']
    closing_price = stock_data['Close'].iloc[-1]
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


def convert_currency(amount, currency_from, currency_to, fx_df, currency_api_key):
    """
    Production---
    Convert a specified amount from one currency to another.
    The amount can be a single float value or a dataframe

    Args:
    - amount (float or dataframe): The amount of currency to convert.
    - currency_from (str): The currency code to convert from.
    - currency_to (str): The currency code to convert to.
    - fx_df (DataFrame): DataFrame containing exchange rates.
    - currency_api_key (str): API key for the currency converter.

    Returns:
    - float: The converted amount in the target currency.
    """
    currency_from = currency_from.upper()
    currency_to = currency_to.upper()

    # Check if the exchange rate is in the DataFrame
    exchange_rate_row = fx_df[(fx_df['Currency_From'] == currency_from) &
                              (fx_df['Currency_To'] == currency_to)]

    if not exchange_rate_row.empty:
        exchange_rate = exchange_rate_row['Exchange_Rate'].values[0]
        last_download_date = exchange_rate_row['date'].values[0]

        if isinstance(last_download_date, str):
            last_download_date = datetime.strptime(last_download_date, '%d/%m/%Y').date()

        if date.today() - last_download_date > timedelta(weeks=4) or pd.isna(last_download_date):
            client = freecurrencyapi.Client(currency_api_key)
            result = client.latest([currency_from])

            if currency_to in result['data']:
                exchange_rate = result['data'][currency_to]
                today = date.today()

                new_row_df = pd.DataFrame({
                    'Currency_From': [currency_from, currency_to],
                    'Currency_To': [currency_to, currency_from],
                    'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                    'date': [today, today]
                })

                fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)
            else:
                c = CurrencyRates()
                exchange_rate = c.get_rate(currency_from, currency_to)
                today = date.today()

                new_row_df = pd.DataFrame({
                    'Currency_From': [currency_from, currency_to],
                    'Currency_To': [currency_to, currency_from],
                    'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                    'date': [today, today]
                })

                fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)

    else:
        client = freecurrencyapi.Client(currency_api_key)
        result = client.latest([currency_from])

        if currency_to in result['data']:
            exchange_rate = result['data'][currency_to]
            today = date.today()

            for currency_to_temp, exchange_rate_temp in result['data'].items():
                filtered_df = fx_df[
                    (fx_df['Currency_From'] == currency_from) & (fx_df['Currency_To'] == currency_to_temp)]
                if filtered_df.empty:
                    new_row_df = pd.DataFrame({
                        'Currency_From': [currency_from],
                        'Currency_To': [currency_to_temp],
                        'Exchange_Rate': [exchange_rate_temp],
                        'date': [today]
                    })
                    fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)
        else:
            c = CurrencyRates()
            exchange_rate = c.get_rate(currency_from, currency_to)
            today = date.today()

            new_row_df = pd.DataFrame({
                'Currency_From': [currency_from, currency_to],
                'Currency_To': [currency_to, currency_from],
                'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                'date': [today, today]
            })

            fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)

    converted_amount = amount * exchange_rate
    return converted_amount, fx_df
