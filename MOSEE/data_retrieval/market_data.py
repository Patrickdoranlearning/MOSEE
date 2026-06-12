import yfinance as yf
import pandas as pd

from MOSEE.data_retrieval.rate_limiter import get_fx_pair_rate as rl_get_fx_pair_rate


# Minor currency units that yfinance reports for some exchanges. Each maps to its
# major unit and the divisor needed to convert prices into the major unit.
# South Africa: yfinance reports JSE quotes in 'ZAc' (cents), verified live against
# NPN.JO/AGL.JO/SOL.JO (all returned 'ZAc'; SOL price 21482 ZAc = R214.82 confirms
# the ÷100). 'ZAr' is unobserved in practice (kept defensively, divisor 1); if it
# ever appears it would denote whole rand. Both normalize to ZAR. Shared by
# get_stock_data (which divides prices) and get_reporting_currency (code-only).
MINOR_TO_MAJOR = {
    'GBp': ('GBP', 100),
    'ILA': ('ILS', 100),
    'ZAc': ('ZAR', 100),
    'ZAr': ('ZAR', 1),
}


def normalize_currency_code(currency):
    """
    Normalize a currency code to its major-unit equivalent (code only, no price
    division). E.g. 'GBp' -> 'GBP', 'ILA' -> 'ILS', 'ZAc'/'ZAr' -> 'ZAR'.

    Args:
        currency: A currency code, possibly a minor unit. May be None.

    Returns:
        The upper-cased major-unit currency code, or the original (upper-cased)
        code when no normalization applies. Returns the input unchanged when it
        is falsy.
    """
    if not currency:
        return currency
    if currency in MINOR_TO_MAJOR:
        return MINOR_TO_MAJOR[currency][0]
    return currency.upper()


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
    # Convert prices to major currency units for consistency. Uses the shared
    # MINOR_TO_MAJOR map (same source of truth as get_reporting_currency).
    if currency in MINOR_TO_MAJOR:
        major_currency, divisor = MINOR_TO_MAJOR[currency]
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


def get_scuttlebutt_info(ticker: str) -> dict:
    """
    Extract qualitative / scuttlebutt data from yfinance ticker info.

    Returns dict with employee_count, insider_held, institutional_held, beta,
    shares_short_ratio, and forward_pe.  All values may be None.
    """
    try:
        from MOSEE.data_retrieval.rate_limiter import get_ticker_info as rl_get_ticker_info
        info = rl_get_ticker_info(ticker)
    except Exception:
        info = {}

    return {
        'employee_count': info.get('fullTimeEmployees'),
        'insider_held': info.get('heldPercentInsiders'),
        'institutional_held': info.get('heldPercentInstitutions'),
        'beta': info.get('beta'),
        'short_ratio': info.get('shortRatio'),
        'forward_pe': info.get('forwardPE'),
    }

# Per-process cache of {currency: rate} so each currency is fetched once per run.
# Cleared implicitly when the process exits. None is never cached (a transient
# failure should be retried on the next ticker rather than poisoning the cache).
_exchange_rate_cache = {}


def get_exchange_rate_to_usd(from_currency: str):
    """
    Get the exchange rate to convert from a given currency to USD.

    Args:
        from_currency: The currency code to convert from (e.g., 'JPY', 'EUR', 'GBP')

    Returns:
        Exchange rate (multiply by this to convert to USD), 1.0 for USD, or
        None when the rate cannot be fetched. Callers must NOT treat None as 1.0
        — fabricating a 1.0 rate for a non-USD currency corrupts every converted
        value. A non-USD ticker with a None rate should be skipped.
    """
    from_currency = normalize_currency_code(from_currency)

    if from_currency == 'USD':
        return 1.0

    if from_currency in _exchange_rate_cache:
        return _exchange_rate_cache[from_currency]

    # yfinance FX pairs are the sole rate source — no API key, same data source
    # as every other fetch. Whitelist the currencies present in our universe so
    # we never request a malformed pair for a bad/unknown code.
    supported_currencies = {
        'JPY', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'HKD',
        'DKK', 'SEK', 'NOK', 'NZD', 'SGD', 'INR', 'KRW',
        'BRL', 'MXN', 'CNY', 'ILS', 'ZAR',
    }

    if from_currency not in supported_currencies:
        print(f"WARNING: No FX pair configured for {from_currency} — skipping (no fabricated 1.0)")
        return None

    # Route the yfinance fetch through the rate limiter's throttle + long TTL cache.
    pair = f"{from_currency}USD=X"
    rate = rl_get_fx_pair_rate(pair)

    if rate is not None:
        # rl_get_fx_pair_rate already guards NaN/Inf/non-positive.
        _exchange_rate_cache[from_currency] = rate
        return rate

    print(f"WARNING: Could not get exchange rate for {from_currency} — skipping (no fabricated 1.0)")
    return None


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

    if exchange_rate is None:
        print(f"WARNING: No exchange rate for {from_currency} — cannot convert value (no fabricated 1.0)")
        return None

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

    if exchange_rate is None:
        print(f"WARNING: No exchange rate for {from_currency} — skipping DataFrame conversion (no fabricated 1.0)")
        return df

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

        # yfinance provides 'financialCurrency' for reporting currency.
        # Normalize minor units (GBp/ILA/ZAc) to their major code so this matches
        # the currency get_stock_data reports after its ÷100 price adjustment.
        reporting_currency = info.get('financialCurrency')

        if reporting_currency:
            return normalize_currency_code(reporting_currency)

        # Fallback to trading currency if reporting currency not available
        trading_currency = info.get('currency')
        if trading_currency:
            return normalize_currency_code(trading_currency)

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

