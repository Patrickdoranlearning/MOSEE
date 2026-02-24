import os
import yfinance as yf
from forex_python.converter import CurrencyRates
import freecurrencyapi
from datetime import date, timedelta, datetime



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

    # Get closing price as scalar (yfinance may return Series with ticker index)
    closing_price = stock_data['Close'].iloc[-1]
    if hasattr(closing_price, 'item'):
        closing_price = closing_price.item()
    elif hasattr(closing_price, 'iloc'):
        closing_price = closing_price.iloc[0]

    currency = tick_info['currency']

    # Handle minor currency units (e.g., GBp=pence, ILA=agorot, ZAc=cents)
    # yfinance returns prices in these minor units for some exchanges,
    # but financial statements are in major units (GBP, ILS, ZAR).
    # Convert prices to major currency units for consistency.
    minor_to_major = {
        'GBp': ('GBP', 100),
        'ILA': ('ILS', 100),
        'ZAc': ('ZAR', 100),
    }
    if currency in minor_to_major:
        major_currency, divisor = minor_to_major[currency]
        print(f"  Converting {currency} to {major_currency} (÷{divisor})")
        stock_data['Close'] = stock_data['Close'] / divisor
        stock_data['Open'] = stock_data['Open'] / divisor
        stock_data['High'] = stock_data['High'] / divisor
        stock_data['Low'] = stock_data['Low'] / divisor
        closing_price = closing_price / divisor
        currency = major_currency

    if shares_outstanding is not None:
        mcap = shares_outstanding * closing_price
    else:
        mcap = tick_info['market_cap']

    # Ensure mcap is a scalar value
    if hasattr(mcap, 'item'):
        mcap = mcap.item()
    elif hasattr(mcap, 'iloc'):
        mcap = mcap.iloc[0]

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

currency_api_key = os.environ.get('CURRENCY_API_KEY', '')


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
    currency_from = currency_from.upper()
    currency_to = currency_to.upper()

    try:
        # Try accessing the exchange rate from the DataFrame
        exchange_rate = fx_df[(fx_df['Currency_From'] == currency_from) &
                              (fx_df['Currency_To'] == currency_to)]['Exchange_Rate'].values[0]
        last_download_date = fx_df[(fx_df['Currency_From'] == currency_from) &
                                   (fx_df['Currency_To'] == currency_to)]['date'].values[0]
        if type(last_download_date) == str:
            last_download_date = datetime.strptime(last_download_date, '%d/%m/%Y').date()
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


def get_exchange_rate_to_usd(from_currency: str) -> float:
    """
    Get the exchange rate to convert from a given currency to USD.

    Args:
        from_currency: The currency code to convert from (e.g., 'JPY', 'EUR', 'GBP')

    Returns:
        Exchange rate (multiply by this to convert to USD)
        Returns 1.0 if from_currency is USD or if rate cannot be fetched
    """
    from_currency = from_currency.upper()

    if from_currency == 'USD':
        return 1.0

    # Try freecurrencyapi first
    try:
        client = freecurrencyapi.Client(currency_api_key)
        result = client.latest(base_currency='USD')
        # API returns rates relative to USD, so we need the inverse
        if from_currency in result['data']:
            rate_usd_to_foreign = result['data'][from_currency]
            return 1.0 / rate_usd_to_foreign
    except Exception as e:
        print(f"freecurrencyapi failed for {from_currency}: {e}")

    # Fallback to forex_python
    try:
        c = CurrencyRates()
        rate = c.get_rate(from_currency, 'USD')
        return rate
    except Exception as e:
        print(f"forex_python failed for {from_currency}: {e}")

    # Last resort: use yfinance for major currency pairs
    try:
        if from_currency in ['JPY', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF',
                              'DKK', 'SEK', 'NOK', 'NZD', 'HKD', 'SGD',
                              'INR', 'KRW', 'BRL', 'MXN']:
            pair = f"{from_currency}USD=X"
            ticker = yf.Ticker(pair)
            hist = ticker.history(period='1d')
            if not hist.empty:
                return hist['Close'].iloc[-1]
    except Exception as e:
        print(f"yfinance currency fallback failed for {from_currency}: {e}")

    print(f"WARNING: Could not get exchange rate for {from_currency}, using 1.0")
    return 1.0


def convert_value_to_usd(value, from_currency: str, exchange_rate: float = None) -> float:
    """
    Convert a single value to USD.

    Args:
        value: The value to convert (can be float, int, or array-like)
        from_currency: The source currency code
        exchange_rate: Pre-fetched exchange rate (optional, will fetch if not provided)

    Returns:
        Value converted to USD
    """
    if from_currency.upper() == 'USD':
        return value

    if exchange_rate is None:
        exchange_rate = get_exchange_rate_to_usd(from_currency)

    return value * exchange_rate


def convert_dataframe_to_usd(df: pd.DataFrame, from_currency: str, exchange_rate: float = None) -> pd.DataFrame:
    """
    Convert all numeric values in a DataFrame to USD.

    Args:
        df: DataFrame with financial data (e.g., cash flow statement)
        from_currency: The source currency code
        exchange_rate: Pre-fetched exchange rate (optional, will fetch if not provided)

    Returns:
        DataFrame with values converted to USD
    """
    if from_currency.upper() == 'USD':
        return df

    if df is None or df.empty:
        return df

    if exchange_rate is None:
        exchange_rate = get_exchange_rate_to_usd(from_currency)

    # Create a copy to avoid modifying the original
    df_converted = df.copy()

    # Convert all numeric columns
    for col in df_converted.columns:
        if pd.api.types.is_numeric_dtype(df_converted[col]):
            df_converted[col] = df_converted[col] * exchange_rate

    # If the DataFrame has a numeric index (for transposed data), convert index values too
    # But typically financial statements have date indices, so we just convert values

    return df_converted


def get_reporting_currency(ticker: str) -> str:
    """
    Get the currency in which a company reports its financial statements.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Currency code (e.g., 'USD', 'JPY', 'EUR')
    """
    # Import rate limiter utilities
    from MOSEE.data_retrieval.rate_limiter import get_ticker_info as rl_get_ticker_info

    try:
        # Use rate-limited ticker info
        info = rl_get_ticker_info(ticker)

        # yfinance provides 'financialCurrency' for reporting currency
        reporting_currency = info.get('financialCurrency')

        if reporting_currency:
            return reporting_currency.upper()

        # Fallback to trading currency if reporting currency not available
        trading_currency = info.get('currency')
        if trading_currency:
            return trading_currency.upper()

    except Exception as e:
        print(f"Could not get reporting currency for {ticker}: {e}")

    # Last resort: infer from ticker suffix
    # Common exchange suffixes
    ticker_upper = ticker.upper()
    if '.T' in ticker_upper or ticker_upper.endswith('.T'):
        return 'JPY'  # Tokyo Stock Exchange
    elif '.L' in ticker_upper or ticker_upper.endswith('.L'):
        return 'GBP'  # London Stock Exchange
    elif '.DE' in ticker_upper or ticker_upper.endswith('.DE'):
        return 'EUR'  # German exchanges
    elif '.PA' in ticker_upper or ticker_upper.endswith('.PA'):
        return 'EUR'  # Paris Stock Exchange
    elif '.AS' in ticker_upper or ticker_upper.endswith('.AS'):
        return 'EUR'  # Amsterdam Stock Exchange
    elif '.MI' in ticker_upper or ticker_upper.endswith('.MI'):
        return 'EUR'  # Milan Stock Exchange
    elif '.TO' in ticker_upper or ticker_upper.endswith('.TO'):
        return 'CAD'  # Toronto Stock Exchange
    elif '.AX' in ticker_upper or ticker_upper.endswith('.AX'):
        return 'AUD'  # Australian Stock Exchange
    elif '.HK' in ticker_upper or ticker_upper.endswith('.HK'):
        return 'HKD'  # Hong Kong Stock Exchange
    elif '.SS' in ticker_upper or ticker_upper.endswith('.SS'):
        return 'CNY'  # Shanghai Stock Exchange
    elif '.SZ' in ticker_upper or ticker_upper.endswith('.SZ'):
        return 'CNY'  # Shenzhen Stock Exchange

    # Default to USD if we can't determine
    return 'USD'

