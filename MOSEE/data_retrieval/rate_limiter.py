"""
Rate limiter and retry utilities for yfinance API calls.

Yahoo Finance implements rate limiting that can block requests when too many are made.
As of 2024-2025, Yahoo has become significantly more aggressive with rate limiting,
often returning empty data instead of explicit 429 errors.

This module provides utilities to:
1. Throttle request frequency (1.5s minimum between requests)
2. Retry failed requests with exponential backoff
3. Cache responses to avoid redundant requests
4. Use a persistent session with browser-like headers
5. Detect "silent" rate limiting (empty responses)
6. Reuse Ticker objects to minimize API calls
"""

import time
import random
import functools
import threading
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional, TypeVar
import yfinance as yf
import pandas as pd

# Type variable for generic return type
T = TypeVar('T')

# Global rate limiter settings - MORE CONSERVATIVE for Yahoo's 2024+ limits
_rate_limit_settings = {
    'min_request_interval': 1.5,  # Increased from 0.5s - Yahoo is stricter now
    'max_retries': 5,
    'base_delay': 3.0,  # Increased from 2.0s for exponential backoff
    'max_delay': 120.0,  # Increased from 60s - allow longer waits
    'jitter': 0.4,  # Slightly more jitter to avoid patterns
    'enable_caching': True,
    'cache_ttl_minutes': 30,  # Increased from 15 - reduce redundant calls
    'empty_response_threshold': 3,  # Number of empty responses before treating as rate limit
}

# Thread-safe last request timestamp
_last_request_time = 0.0
_request_lock = threading.Lock()

# In-memory cache for yfinance responses
_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = threading.Lock()

# Ticker object cache - reuse Ticker objects to avoid redundant API calls
_ticker_cache: Dict[str, Dict[str, Any]] = {}
_ticker_cache_lock = threading.Lock()

# Track consecutive empty responses (silent rate limiting detection)
_empty_response_count = 0
_empty_response_lock = threading.Lock()


def _refresh_ticker_cache():
    """
    Clear the ticker cache (useful after hitting rate limits).
    yfinance 1.0+ handles sessions internally with curl_cffi, so we just need to
    clear our ticker object cache to force fresh API calls.
    """
    with _ticker_cache_lock:
        _ticker_cache.clear()
    
    print("Ticker cache cleared due to rate limiting detection")


def configure_rate_limiter(
    min_request_interval: float = None,
    max_retries: int = None,
    base_delay: float = None,
    max_delay: float = None,
    jitter: float = None,
    enable_caching: bool = None,
    cache_ttl_minutes: int = None
):
    """
    Configure global rate limiter settings.
    
    Args:
        min_request_interval: Minimum seconds between requests (default 1.5)
        max_retries: Maximum retry attempts (default 5)
        base_delay: Base delay for exponential backoff in seconds (default 3.0)
        max_delay: Maximum delay between retries in seconds (default 120.0)
        jitter: Random jitter factor 0-1 (default 0.4)
        enable_caching: Whether to cache responses (default True)
        cache_ttl_minutes: Cache time-to-live in minutes (default 30)
    """
    global _rate_limit_settings
    
    if min_request_interval is not None:
        _rate_limit_settings['min_request_interval'] = min_request_interval
    if max_retries is not None:
        _rate_limit_settings['max_retries'] = max_retries
    if base_delay is not None:
        _rate_limit_settings['base_delay'] = base_delay
    if max_delay is not None:
        _rate_limit_settings['max_delay'] = max_delay
    if jitter is not None:
        _rate_limit_settings['jitter'] = jitter
    if enable_caching is not None:
        _rate_limit_settings['enable_caching'] = enable_caching
    if cache_ttl_minutes is not None:
        _rate_limit_settings['cache_ttl_minutes'] = cache_ttl_minutes


def _wait_for_rate_limit():
    """
    Ensures minimum time between requests (thread-safe).
    """
    global _last_request_time
    
    with _request_lock:
        current_time = time.time()
        time_since_last = current_time - _last_request_time
        min_interval = _rate_limit_settings['min_request_interval']
        
        if time_since_last < min_interval:
            sleep_time = min_interval - time_since_last
            # Add small random jitter to prevent synchronized requests
            jitter = random.uniform(0, _rate_limit_settings['jitter'] * min_interval)
            time.sleep(sleep_time + jitter)
        
        _last_request_time = time.time()


def _get_cache_key(func_name: str, *args, **kwargs) -> str:
    """Generate a cache key from function name and arguments."""
    key_parts = [func_name]
    key_parts.extend(str(arg) for arg in args)
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    return "|".join(key_parts)


def _get_from_cache(cache_key: str) -> Optional[Any]:
    """Get value from cache if exists and not expired."""
    if not _rate_limit_settings['enable_caching']:
        return None
        
    with _cache_lock:
        if cache_key in _cache:
            entry = _cache[cache_key]
            expiry = entry.get('expiry')
            if expiry and datetime.now() < expiry:
                return entry.get('value')
            else:
                # Expired, remove from cache
                del _cache[cache_key]
    return None


def _set_cache(cache_key: str, value: Any):
    """Store value in cache with TTL."""
    if not _rate_limit_settings['enable_caching']:
        return
        
    with _cache_lock:
        _cache[cache_key] = {
            'value': value,
            'expiry': datetime.now() + timedelta(minutes=_rate_limit_settings['cache_ttl_minutes'])
        }


def clear_cache():
    """Clear the entire cache."""
    global _cache
    with _cache_lock:
        _cache.clear()
    with _ticker_cache_lock:
        _ticker_cache.clear()


def _is_rate_limit_error(error: Exception) -> bool:
    """Check if an exception is a rate limit error."""
    error_str = str(error).lower()
    rate_limit_indicators = [
        'rate limit',
        'too many requests',
        '429',
        'exceeded',
        'throttl',
        'blocked',
        'temporarily unavailable',
        'try again later',
        'forbidden',
        '403',
    ]
    return any(indicator in error_str for indicator in rate_limit_indicators)


def _is_empty_response(result: Any) -> bool:
    """
    Check if a response is empty - Yahoo often returns empty data when rate limited
    instead of returning a proper error.
    """
    if result is None:
        return True
    if isinstance(result, pd.DataFrame):
        return result.empty
    if isinstance(result, dict):
        # Check if dict is empty or contains only None/empty values
        if not result:
            return True
        # Check if all meaningful values are None or empty
        meaningful_keys = ['shares', 'market_cap', 'marketCap', 'sharesOutstanding', 
                          'currency', 'currentPrice', 'regularMarketPrice']
        has_meaningful_data = any(
            result.get(k) is not None and result.get(k) != 0 
            for k in meaningful_keys if k in result
        )
        return not has_meaningful_data and len(result) < 3
    return False


def _track_empty_response(is_empty: bool):
    """
    Track consecutive empty responses. Multiple empty responses in a row
    likely indicate silent rate limiting.
    """
    global _empty_response_count
    
    with _empty_response_lock:
        if is_empty:
            _empty_response_count += 1
            threshold = _rate_limit_settings['empty_response_threshold']
            
            if _empty_response_count >= threshold:
                print(f"Warning: {_empty_response_count} consecutive empty responses detected. "
                      "This may indicate silent rate limiting.")
                _empty_response_count = 0  # Reset counter
                return True  # Signal that we should back off
        else:
            _empty_response_count = 0  # Reset on successful response
    
    return False


def _calculate_backoff_delay(attempt: int) -> float:
    """Calculate delay with exponential backoff and jitter."""
    base = _rate_limit_settings['base_delay']
    max_delay = _rate_limit_settings['max_delay']
    jitter = _rate_limit_settings['jitter']
    
    # Exponential backoff: base * 2^attempt
    delay = base * (2 ** attempt)
    
    # Add random jitter
    jitter_amount = delay * random.uniform(-jitter, jitter)
    delay = delay + jitter_amount
    
    # Cap at max delay
    return min(delay, max_delay)


def _get_cached_ticker(ticker: str) -> yf.Ticker:
    """
    Get a cached Ticker object or create a new one.
    Reusing Ticker objects avoids redundant API calls since yfinance
    caches data within the Ticker object.
    
    Note: yfinance 1.0+ handles sessions internally with curl_cffi,
    so we don't need to manage sessions ourselves.
    """
    cache_key = ticker.upper()
    
    with _ticker_cache_lock:
        if cache_key in _ticker_cache:
            entry = _ticker_cache[cache_key]
            expiry = entry.get('expiry')
            if expiry and datetime.now() < expiry:
                return entry.get('ticker')
            else:
                del _ticker_cache[cache_key]
        
        # Create new Ticker - yfinance 1.0+ handles sessions internally
        tick = yf.Ticker(ticker)
        
        # Cache for 30 minutes
        _ticker_cache[cache_key] = {
            'ticker': tick,
            'expiry': datetime.now() + timedelta(minutes=30)
        }
        
        return tick


def with_rate_limit(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator that adds rate limiting, caching, and retry logic to a function.
    
    Usage:
        @with_rate_limit
        def my_yfinance_call(ticker):
            return yf.Ticker(ticker).info
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> T:
        # Check cache first
        cache_key = _get_cache_key(func.__name__, *args, **kwargs)
        cached_value = _get_from_cache(cache_key)
        if cached_value is not None:
            return cached_value
        
        last_error = None
        max_retries = _rate_limit_settings['max_retries']
        
        for attempt in range(max_retries + 1):
            try:
                # Wait for rate limit before making request
                _wait_for_rate_limit()
                
                # Make the actual call
                result = func(*args, **kwargs)
                
                # Check for empty response (silent rate limiting)
                if _is_empty_response(result):
                    should_backoff = _track_empty_response(True)
                    if should_backoff and attempt < max_retries:
                        delay = _calculate_backoff_delay(attempt)
                        print(f"Empty response detected (possible silent rate limit). "
                              f"Waiting {delay:.1f}s before retry {attempt + 1}/{max_retries}...")
                        _refresh_ticker_cache()
                        time.sleep(delay)
                        continue
                else:
                    _track_empty_response(False)
                
                # Cache successful results (only cache non-empty results)
                if result is not None:
                    if isinstance(result, pd.DataFrame):
                        if not result.empty:
                            _set_cache(cache_key, result)
                    elif isinstance(result, dict):
                        if result:
                            _set_cache(cache_key, result)
                    else:
                        _set_cache(cache_key, result)
                
                return result
                
            except Exception as e:
                last_error = e
                
                # Check if it's a rate limit error
                if _is_rate_limit_error(e):
                    if attempt < max_retries:
                        delay = _calculate_backoff_delay(attempt)
                        print(f"Rate limit hit. Waiting {delay:.1f}s before retry {attempt + 1}/{max_retries}...")
                        _refresh_ticker_cache()
                        time.sleep(delay)
                        continue
                    else:
                        print(f"Rate limit: Max retries ({max_retries}) exceeded")
                        raise
                else:
                    # Non-rate-limit error, don't retry
                    raise
        
        # Should not reach here, but just in case
        if last_error:
            raise last_error
    
    return wrapper


# ============================================================================
# Pre-wrapped yfinance functions with rate limiting
# ============================================================================

def get_ticker_object(ticker: str) -> yf.Ticker:
    """
    Get a yfinance Ticker object with rate limiting and caching.
    Reuses Ticker objects to minimize API calls.
    """
    return _get_cached_ticker(ticker)


@with_rate_limit
def download_stock_data(ticker: str, start: str, end: str, progress: bool = False) -> pd.DataFrame:
    """Download stock data with rate limiting. yfinance 1.0+ handles sessions internally."""
    return yf.download(ticker, start=start, end=end, progress=progress)


def get_ticker_info(ticker: str) -> dict:
    """
    Get ticker info with rate limiting and caching.
    Uses fast_info first, falls back to full info if needed.
    Reuses Ticker objects to minimize API calls.
    """
    cache_key = f"ticker_info|{ticker}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached
    
    _wait_for_rate_limit()
    
    try:
        # Use cached Ticker object
        tick = _get_cached_ticker(ticker)
        
        # Try fast_info first (faster, less likely to hit rate limits)
        info = {}
        try:
            fast = tick.fast_info
            info = {
                'shares': getattr(fast, 'shares', None),
                'currency': getattr(fast, 'currency', None),
                'market_cap': getattr(fast, 'market_cap', None),
                'lastPrice': getattr(fast, 'last_price', None),
            }
        except Exception:
            pass
        
        # If fast_info didn't work well, try full info
        if not info.get('market_cap') or not info.get('shares'):
            _wait_for_rate_limit()
            try:
                full_info = tick.info
                if full_info:
                    info.update(full_info)
            except Exception as e:
                if _is_rate_limit_error(e):
                    raise
        
        # Check for empty response
        if _is_empty_response(info):
            should_backoff = _track_empty_response(True)
            if should_backoff:
                # Back off and retry once
                delay = _calculate_backoff_delay(0)
                print(f"Empty ticker info response. Waiting {delay:.1f}s...")
                _refresh_ticker_cache()
                time.sleep(delay)
                
                # Retry with fresh ticker
                tick = _get_cached_ticker(ticker)
                _wait_for_rate_limit()
                info = tick.info or {}
        else:
            _track_empty_response(False)
        
        if info:
            _set_cache(cache_key, info)
        return info
        
    except Exception as e:
        if _is_rate_limit_error(e):
            # Retry with backoff
            for attempt in range(_rate_limit_settings['max_retries']):
                delay = _calculate_backoff_delay(attempt)
                print(f"Rate limit on ticker info. Waiting {delay:.1f}s...")
                _refresh_ticker_cache()
                time.sleep(delay)
                try:
                    _wait_for_rate_limit()
                    tick = _get_cached_ticker(ticker)
                    info = tick.info or {}
                    if info:
                        _set_cache(cache_key, info)
                    return info
                except Exception as retry_e:
                    if not _is_rate_limit_error(retry_e):
                        raise retry_e
            raise
        raise


def get_financial_statements(ticker: str) -> dict:
    """
    Get all financial statements with rate limiting and caching.
    Returns dict with balance_sheet, cashflow, and financials DataFrames.
    
    Optimized to reuse a single Ticker object for all statements.
    """
    cache_key = f"financial_statements|{ticker}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached
    
    _wait_for_rate_limit()
    
    result = {
        'balance_sheet': pd.DataFrame(),
        'cashflow': pd.DataFrame(),
        'financials': pd.DataFrame(),
    }
    
    max_retries = _rate_limit_settings['max_retries']
    
    for attempt in range(max_retries + 1):
        try:
            # Use cached Ticker object - ONE object for all statements
            tick = _get_cached_ticker(ticker)
            
            # Get balance sheet (no additional rate limit wait - ticker caches internally)
            try:
                bs = tick.balance_sheet
                if bs is not None and not bs.empty:
                    result['balance_sheet'] = bs
            except Exception as e:
                if _is_rate_limit_error(e):
                    raise
                print(f"Warning: Could not get balance sheet for {ticker}: {e}")
            
            # Small delay between different data types
            time.sleep(0.3)
            
            # Get cash flow
            try:
                cf = tick.cashflow
                if cf is not None and not cf.empty:
                    result['cashflow'] = cf
            except Exception as e:
                if _is_rate_limit_error(e):
                    raise
                print(f"Warning: Could not get cashflow for {ticker}: {e}")
            
            # Small delay
            time.sleep(0.3)
            
            # Get income statement (financials)
            try:
                fin = tick.financials
                if fin is not None and not fin.empty:
                    result['financials'] = fin
            except Exception as e:
                if _is_rate_limit_error(e):
                    raise
                print(f"Warning: Could not get financials for {ticker}: {e}")
            
            # Check if we got mostly empty data (silent rate limiting)
            empty_count = sum(1 for v in result.values() if isinstance(v, pd.DataFrame) and v.empty)
            if empty_count >= 2:  # 2 or more empty statements suggests rate limiting
                should_backoff = _track_empty_response(True)
                if should_backoff and attempt < max_retries:
                    delay = _calculate_backoff_delay(attempt)
                    print(f"Mostly empty financial data for {ticker}. "
                          f"Possible silent rate limit. Waiting {delay:.1f}s...")
                    _refresh_ticker_cache()
                    time.sleep(delay)
                    continue
            else:
                _track_empty_response(False)
            
            # Cache the result if we have at least some data
            if any(not v.empty for v in result.values() if isinstance(v, pd.DataFrame)):
                _set_cache(cache_key, result)
            
            return result
            
        except Exception as e:
            if _is_rate_limit_error(e) and attempt < max_retries:
                delay = _calculate_backoff_delay(attempt)
                print(f"Rate limit on financial statements. Waiting {delay:.1f}s before retry...")
                _refresh_ticker_cache()
                time.sleep(delay)
                continue
            raise
    
    return result


def batch_get_ticker_info(tickers: list) -> dict:
    """
    Get info for multiple tickers efficiently.
    Uses caching and rate limiting.
    
    Args:
        tickers: List of ticker symbols
        
    Returns:
        Dict mapping ticker to info dict
    """
    results = {}
    
    # Check cache first
    uncached_tickers = []
    for ticker in tickers:
        cache_key = f"ticker_info|{ticker}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            results[ticker] = cached
        else:
            uncached_tickers.append(ticker)
    
    if not uncached_tickers:
        return results
    
    # Process uncached tickers with rate limiting
    for ticker in uncached_tickers:
        try:
            info = get_ticker_info(ticker)
            results[ticker] = info
        except Exception as e:
            print(f"Error getting info for {ticker}: {e}")
            results[ticker] = {}
    
    return results
