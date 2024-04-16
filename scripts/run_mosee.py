import pandas as pd
from datetime import datetime
from financetoolkit import Toolkit

from MOSEE.MOS import mos_dollar
from MOSEE.data_retrieval.fundamental_data import net_income_expected
from MOSEE.data_retrieval.market_data import get_stock_data, convert_currency
from MOSEE.fundamental_analysis.indicators import get_earnings_equity
from MOSEE.fundamental_analysis.valuation import dcf_valuation, pad_valuation, calculate_average_price

def create_MOSEE_df(ticker_df, start_date, end_date, API_KEY):
    """
    DEV ---
    This function will look through many tickers to try find companies with a high margin of safety and high earnings
    to equity, i will also include assetlightness and if two stocks have the same or similar metrics this will help decide
    which is a better option for investment

    Args:
    - ticker_df: DataFrame containing all tickers
    - start_date: how many years in the past are we looking to go
    - end_date: if we want to back test we can use this
    - API_key: this is the api key for FMP

    Returns:
    - DataFrame: DataFrame containing the shortlist of stocks to invest in
    """

    shortlist_df = pd.DataFrame()

    for ticker in ticker_df['ticker']:
        print(ticker)
        try:
            # Fetching historical stock data
            stock_data, stock_cap, stock_currency = get_stock_data(ticker, start_date, end_date)
            # Check if stock data is retrieved successfully
            if stock_data is None or stock_data.empty:
                print(f"No data found for {ticker}. Skipping...")
                continue

            # Technical Analysis
            # Calculating the current stock price (using the latest available closing price)
            current_price = stock_data['Close'].iloc[-1]
            # Check if current price is available
            if pd.isnull(current_price):
                print(f"Current price not available for {ticker}. Skipping...")
                continue

            # Get Fundamental Data
            finanal_prep = Toolkit([ticker], api_key=API_KEY, start_date=start_date, convert_currency=False)
            cash_flow = finanal_prep.get_cash_flow_statement()
            balance_sheet = finanal_prep.get_balance_sheet_statement()
            currency = finanal_prep.get_statistics_statement()
            reported_currency = currency.loc['Reported Currency', '2022']

            # check to see if api has collected data
            if cash_flow is None or cash_flow.empty:
                print(f"No data found for {ticker}. Skipping...")
                continue

            # checking to see if my two data sources are using the same currency, if not they are converted
            if reported_currency != stock_currency:
                print('exchanging')
                cash_flow = convert_currency(cash_flow, reported_currency, stock_currency)
                # will be used later for asset light
                balance_sheet = convert_currency(balance_sheet, reported_currency, stock_currency)

            net_income_dic = net_income_expected(cash_flow, 10)

            # Value Metrics
            dcf_value = dcf_valuation(net_income_dic)
            pad_value = pad_valuation(net_income_dic)
            market_average_value = calculate_average_price(stock_data)

            # Outputs
            earnings_equity = get_earnings_equity(net_income_dic['net_income_average'], stock_cap)

            # Calculating the margin of safety price of 1 dollar trying to by 1 dollar for less than 50 cents
            market_mos = mos_dollar(current_price, market_average_value)
            pad_mos = mos_dollar(stock_cap, pad_value)
            dcf_mos = mos_dollar(stock_cap, dcf_value)

            # Equity/Earning * MOS -- Bigger is better
            if (market_mos < 0 or pad_mos < 0 or dcf_mos < 0) and earnings_equity < 0:
                market_MOSEE = 0
                pad_MOSEE = 0
                dcf_MOSEE = 0
            else:
                market_MOSEE = earnings_equity * (1 / market_mos)  # needs 1/mos as it is better if big
                pad_MOSEE = earnings_equity * (1 / pad_mos)
                dcf_MOSEE = earnings_equity * (1 / dcf_mos)

            # Add company information to the shortlist DataFrame
            new_data = {
                'Ticker Symbol': ticker,  # More descriptive column name
                'Market MoS': market_mos,
                'PAD MoS': pad_mos,
                'DCF MoS': dcf_mos,
                'Average Market Price': market_average_value,
                'Current Price': current_price,
                'PAD Value': pad_value,
                'DCF Value': dcf_value,
                'Market Cap': stock_cap,
                'Earnings per Dollar Equity': earnings_equity,
                'Market MOSEE': market_MOSEE,
                'PAD MOSEE': pad_MOSEE,
                'DCF MOSEE': dcf_MOSEE,
            }
            new_df = pd.DataFrame(new_data, index=[ticker])

            try:
                # Concatenate with error handling (replace with appropriate exception)
                shortlist_df = pd.concat([shortlist_df, new_df], ignore_index=True)
            except TypeError as e:
                print("Error: Data type mismatch encountered during concatenation. Please check data types.")
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            # Log the error or handle it in another appropriate way

    # Sorting the shortlist based on margin of safety in descending order
    shortlist_df = shortlist_df.sort_values(by='PAD MOSEE', ascending=False)

    return shortlist_df


def main(tickers_csv, start_date, end_date, API_KEY, save_shortlist, take_top_X, minimum_MOS, test_and_debug):
    tickers = pd.read_csv(tickers_csv)

    if test_and_debug:
        print('WARNING: On Test and Debug mode - Only looking at 3 tickers')
        tickers = tickers[:3]
   
    if end_date == None:
        end_date = datetime.today().strftime('%Y-%m-%d')
        print(f'Using todays date as the end date: {end_date}')
        
    shortlist = create_MOSEE_df(tickers, start_date, end_date, API_KEY)

    if save_shortlist != None:
        if minimum_MOS != None:
            print(f'Filtering the MoS to be less than {minimum_MOS} before saving')
            cols = ['Market MoS', 'PAD MoS', 'DCF MoS']
            shortlist[cols] = shortlist[shortlist[cols] <= minimum_MOS][cols]
        if take_top_X != None:
            print(f'Only saving the top {take_top_X} companies')
            shortlist = shortlist.head(take_top_X)

        print(f'Saving short list to {save_shortlist}')
        shortlist.to_csv(save_shortlist)


if __name__ == "__main__":
    tickers_csv = '/Users/patrickdoran/Documents/Python/Investment_Decisions/ticker_grouped.csv'
    start_date = '2016-01-01'
    end_date = '2024-01-01'  # if using today's date leave as None
    API_KEY = "n2t40UpDfJuZHZA4UvbY95Wf294lqFs4"
    save_shortlist = '../outputs/shortlist.csv'
    take_top_X = 100
    minimum_MOS = 0.7
    test_and_debug = True
    print('Variables set up, running main next')
    main(tickers_csv, start_date, end_date, API_KEY, save_shortlist, take_top_X, minimum_MOS, test_and_debug)



