def calculate_average_price(stock_data):
    """
    Function to calculate the average stock price
    :type stock_data: object
    """
    average_price = stock_data['Close'].mean()
    return average_price
