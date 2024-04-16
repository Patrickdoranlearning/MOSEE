def mos_dollar(market_value, value_marker):
    """
    This function takes in the current market value and an intrinsic value marker,
    calculates the margin of safety or value per dollar equity.
    market_value can be market cap or closing price.

    args:
    - market_value: float - Market Cap or closing price
    - value_marker: float - DCF, Pad_value, book value, average market value, intrinsic value

    Return: mos_share: single float representing the pre-dollar value of a stock
    """
    mos_share = market_value / value_marker
    return mos_share


