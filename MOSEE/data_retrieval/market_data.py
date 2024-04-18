import yfinance as yf
from forex_python.converter import CurrencyRates
import freecurrencyapi
from datetime import date, timedelta, datetime
CURRENCY_API = "fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5"



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


import pandas as pd
from datetime import date, timedelta
from forex_python.converter import CurrencyRates
import freecurrencyapi

currency_api_key = 'fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5'


def convert_currency(amount, currency_from, currency_to, fx_df):
    """
    Production---
    Convert a specified amount from one currency to another.
    The amount can be a single float value or a dataframe

    Args:
    - amount (float or dataframe): The amount of currency to convert.
    - currency_from (str): The currency code to convert from.
    - currency_to (str): The currency code to convert to.
    - fx_df (DataFrame): DataFrame containing exchange rates.

    Returns:
    - float: The converted amount in the target currency.
    """
    try:
        # Try accessing the exchange rate from the DataFrame
        exchange_rate = fx_df[(fx_df['Currency_From'] == currency_from) &
                              (fx_df['Currency_To'] == currency_to)]['Exchange_Rate'].values[0]
        last_download_date_str = fx_df[(fx_df['Currency_From'] == currency_from) &
                                   (fx_df['Currency_To'] == currency_to)]['date'].values[0]
        last_download_date = datetime.strptime(last_download_date_str, '%d/%m/%Y').date()
        print(last_download_date)
        if date.today() - last_download_date > timedelta(weeks=4) or pd.isna(last_download_date):
            try:
                # Try accessing the second API as a backup
                client = freecurrencyapi.Client(currency_api_key)
                result = client.latest([currency_from])
                exchange_rate = result['data'][currency_to]
                today = date.today()
                print(today)

                # Create a new DataFrame with the new row data
                new_row_df = pd.DataFrame({
                    'Currency_From': [currency_from, currency_to],
                    'Currency_To': [currency_to, currency_from],
                    'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                    'date': [today, today]
                })

                print(new_row_df)

                # Concatenate the new row DataFrame with the existing fx_df
                fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)

            except Exception as e:
                print(f"Error accessing free currency API: {e}")
                try:
                    c = CurrencyRates()
                    exchange_rate = c.get_rate(currency_from, currency_to)
                    today = date.today()
                    # Create a new DataFrame with the new row data
                    new_row_df = pd.DataFrame({
                        'Currency_From': [currency_from, currency_to],
                        'Currency_To': [currency_to, currency_from],
                        'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                        'date': [today, today]
                    })

                    # Concatenate the new row DataFrame with the existing fx_df
                    fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)
                except Exception as e:
                    print(f"Error accessing forex API: {e}")
                    raise ValueError(f"Error accessing second API: {e}")

    except IndexError:
        # If the exchange rate is not available in the DataFrame, update it
        try:
            # Try accessing the second API as a backup
            client = freecurrencyapi.Client(currency_api_key)
            result = client.latest([currency_from])
            exchange_rate = result['data'][currency_to]
            today = date.today()
            print('here')
            # Create a new DataFrame with the new row data
            for currency_to_temp, exchange_rate_temp in result['data'].items():
                filtered_df = fx_df[
                    (fx_df['Currency_From'] == currency_from) & (fx_df['Currency_To'] == currency_to_temp)]
                if not filtered_df.empty:
                    exchange_rate = filtered_df['Exchange_Rate'].values[0]  # Assuming you want the first rate
                    print(f"Exchange rate: {exchange_rate}")
                else:
                    new_row_df = pd.DataFrame({
                        'Currency_From': [currency_from],
                        'Currency_To': [currency_to_temp],
                        'Exchange_Rate': [exchange_rate_temp],
                        'date': [today]
                    })
                    # Concatenate the new row DataFrame with the existing fx_df
                    fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)

        except Exception as e:
            print(f"Error accessing free currency API: {e}")

            try:
                # Try accessing the first API
                c = CurrencyRates()
                exchange_rate = c.get_rate(currency_from, currency_to)
                today = date.today()
                # Create a new DataFrame with the new row data
                new_row_df = pd.DataFrame({
                    'Currency_From': [currency_from, currency_to],
                    'Currency_To': [currency_to, currency_from],
                    'Exchange_Rate': [exchange_rate, 1 / exchange_rate],
                    'date': [today, today]
                })

                # Concatenate the new row DataFrame with the existing fx_df
                fx_df = pd.concat([fx_df, new_row_df], ignore_index=True)
            except Exception as e:
                print(f"Error accessing forex API: {e}")
                try:
                    # Try accessing the exchange rate from the DataFrame
                    exchange_rate = fx_df[(fx_df['Currency_From'] == currency_from) &
                                          (fx_df['Currency_To'] == currency_to)]['Exchange_Rate'].values[0]
                except Exception as e:
                    print(f"Error accessing no currency value found: {e}")
                    raise ValueError(f"Error accessing second API: {e}")

    converted_amount = amount * exchange_rate
    return converted_amount, fx_df

