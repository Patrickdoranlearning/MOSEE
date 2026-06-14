import math


def _is_valid_marker(value_marker) -> bool:
    """A value marker is usable only when it's a finite, positive number.

    NaN/Inf/None/<=0 markers poison MoS (and downstream MOSEE) — e.g. a NaN
    book value silently propagates 'Book MoS = NaN' into the persisted row.
    Callers must treat a None return as 'this method unavailable'.
    """
    if value_marker is None:
        return False
    try:
        if math.isnan(value_marker) or not math.isfinite(value_marker):
            return False
    except (TypeError, ValueError):
        return False
    return value_marker > 0


def mos_dollar(market_value, value_marker):
    """
    This function takes in the current market value and an intrinsic value marker,
    calculates the margin of safety or value per dollar equity.
    market_value can be market cap or closing price.

    args:
    - market_value: float - Market Cap or closing price
    - value_marker: float - DCF, Pad_value, book value, average market value, intrinsic value

    Return: mos_share as float, or None when value_marker is NaN/Inf/None/<=0
    """
    if not _is_valid_marker(value_marker):
        return None
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

    Return: debt_coverage as float, or None when debt_interest is NaN/Inf/None/<=0
    """
    if not _is_valid_marker(debt_interest):
        return None
    debt_coverage = earnings / debt_interest
    return debt_coverage
