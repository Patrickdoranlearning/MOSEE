from datetime import date, datetime, timedelta

import pandas as pd
import yfinance as yf
from forex_python.converter import CurrencyRates
import freecurrencyapi

CURRENCY_API = "fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5"
currency_api_key = 'fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5'


def get_stock_data(ticker, start_date, end_date):
    """Download price history and share data from Yahoo Finance."""

    print('getting stock data')
    stock_data = yf.download(ticker, start=start_date, end=end_date)
    tick = yf.Ticker(ticker)
    raw_fast_info = getattr(tick, "fast_info", None)
    tick_info = dict(raw_fast_info) if raw_fast_info else {}

    shares_outstanding = tick_info.get('shares')
    closing_price = stock_data['Close'].iloc[-1] if not stock_data.empty else None
    currency = tick_info.get('currency')

    if shares_outstanding is None:
        try:
            info = tick.get_info()
        except Exception:
            info = {}
        shares_outstanding = info.get('sharesOutstanding')
        currency = currency or info.get('currency')

    if closing_price is None or shares_outstanding is None:
        mcap = tick_info.get('market_cap') or info.get('marketCap') if 'info' in locals() else None
    else:
        mcap = shares_outstanding * closing_price

    return stock_data, mcap, currency


def get_ticker_info(ticker):
    ticker_object = yf.Ticker(ticker)
    return ticker_object.get_info()


def convert_currency(amount, currency_from, currency_to, fx_df, currency_api_key):
    """Convert a single value or dataframe between currencies."""

    currency_from = currency_from.upper()
    currency_to = currency_to.upper()

    if currency_from == currency_to:
        return amount, fx_df

    def _parse_date(value):
        if pd.isna(value):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, pd.Timestamp):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        return None

    def _store_rate(rate, dataframe):
        today = date.today().strftime('%d/%m/%Y')
        reciprocal = 1 / rate
        mask = (
            ((dataframe['Currency_From'] == currency_from) & (dataframe['Currency_To'] == currency_to)) |
            ((dataframe['Currency_From'] == currency_to) & (dataframe['Currency_To'] == currency_from))
        )
        dataframe = dataframe.loc[~mask].copy()
        new_rows = pd.DataFrame({
            'Currency_From': [currency_from, currency_to],
            'Currency_To': [currency_to, currency_from],
            'Exchange_Rate': [rate, reciprocal],
            'date': [today, today]
        })
        return pd.concat([dataframe, new_rows], ignore_index=True)

    def _download_rate():
        rate = None
        try:
            client = freecurrencyapi.Client(currency_api_key)
            result = client.latest(base_currency=currency_from, currencies=[currency_to])
            rate = result.get('data', {}).get(currency_to)
        except Exception:
            rate = None

        if rate is None:
            try:
                c = CurrencyRates()
                rate = c.get_rate(currency_from, currency_to)
            except Exception:
                rate = None
        return rate

    exchange_rate_row = fx_df[(fx_df['Currency_From'] == currency_from) &
                              (fx_df['Currency_To'] == currency_to)]

    if not exchange_rate_row.empty:
        latest_row = exchange_rate_row.iloc[-1]
        exchange_rate = latest_row['Exchange_Rate']
        last_download_date = _parse_date(latest_row['date'])

        needs_refresh = last_download_date is None or date.today() - last_download_date > timedelta(weeks=4)
        if needs_refresh:
            exchange_rate = _download_rate()
            if exchange_rate is None:
                raise RuntimeError(f"Unable to download exchange rate for {currency_from}/{currency_to}")
            fx_df = _store_rate(exchange_rate, fx_df)
    else:
        exchange_rate = _download_rate()
        if exchange_rate is None:
            raise RuntimeError(f"Unable to download exchange rate for {currency_from}/{currency_to}")
        fx_df = _store_rate(exchange_rate, fx_df)

    converted_amount = amount * exchange_rate
    return converted_amount, fx_df
