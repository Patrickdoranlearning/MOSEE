def get_assets_light_factor(balance_sheet_dictionary, net_income_dictionary):
    """
    this will calculate which equities have high earnings to assets.
    this might mean that they have higher good will be built into there share price.
    if goodwill is low or negative and they have high earnings to tangible assets, they are a worthy purchase

    Args:
    - balance_sheet_dictionary dictionary: dictionary with all balance sheet data -- using tangible assets
    - net_income_dictionary dictionary: Dictionary with all net income data -- using net income average

    Returns:
    - asset_light float: Of the earnings to assets
    """
    asset_light = net_income_dictionary['net_income_average'] / balance_sheet_dictionary['tangible_assets']

    return asset_light


def get_earnings_equity(net_income_dictionary, market_cap):
    """
    This will calculate the earnings to equity of a business. It is the value returned annually per dollar equity

    Args:
    - net_income_dictionary dictionary: Dictionary with all net income data -- using net income average
    - market_cap float: market cap of a business

    Returns:
    - earnings_equity float: ratio of earnings to equity. The higher the better
    """

    earnings_equity = net_income_dictionary['net_income_average'] / market_cap

    return earnings_equity

def get_ROIC(owners_earnings, invested_capital):
    """
    this is the return on invested capital by the company, look for companies who have a history of high ROIC.
    ROIC above 10% is good. One can consider lower ROIC in the case that the company has a wide moat.

    Args:
    - owners_earnings float: operating profit + deprecation + amortisation of goodwill
                            - federal income tax (average) - cost of stock options
                            - maintenance costs(essential capital expenditures)
                            - any income from unsustainable sources
    - invested_capital float: total_assets - cash - short term investments + past accounting charges

    Returns:
    - ROIC float: higher is better
    """

    ROIC = owners_earnings/invested_capital

    return ROIC

