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


def mos_debt(earnings, debt_interest):
    """
    This function calculates how many times earnings covers the interest payments on debt.
    Companies are at risk if they cannot cover debt repayments. This may mean they will 
    have to eat into shareholder value.

    A higher ratio is better - it indicates the company can easily cover its debt obligations.
    Generally, a ratio > 2 is considered safe.

    args:
    - earnings: float - Operating earnings or EBIT
    - debt_interest: float - Annual interest expense on debt

    Return: debt_coverage: float representing how many times earnings covers debt interest
    """
    if debt_interest == 0:
        return float('inf')  # No debt interest means infinite coverage
    debt_coverage = earnings / debt_interest
    return debt_coverage
