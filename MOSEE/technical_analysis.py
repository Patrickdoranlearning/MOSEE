from datetime import datetime


# Note: calculate_average_price is defined in fundamental_analysis/valuation.py
# Use that version for consistency across the codebase


def current_price(stock_data):
    """
    Function to calculate the average stock price
    :type stock_data: object
    """
    current_price = stock_data['Close'][-1]
    return current_price

def get_price_lag_max(stock_data, years = 1):
    """
    TODO
    Function to calculate the average stock price
    :type stock_data: object
    """
    last_year = (datetime.now().year - years)
    max_price = stock_data.loc[(stock_data['Date'].dt.year == last_year), ['Date', 'Close']].groupby('Date').max()
    return max_price

def get_price_lag_min(stock_data, years = 1):
    """
    TODO
    Function to calculate the average stock price
    :type stock_data: object
    """
    last_year = (datetime.now().year - years)
    min_price = stock_data.loc[(stock_data['Date'].dt.year == last_year), ['Date', 'Close']].groupby('Date').min()
    return min_price


