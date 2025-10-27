import os
import yfinance as yf

import pandas as pd
from datetime import datetime
from financetoolkit import Toolkit

from MOSEE.MOS import mos_dollar
from MOSEE.data_retrieval.fundamental_data import net_income_expected
from MOSEE.data_retrieval.market_data import get_stock_data, convert_currency
from MOSEE.fundamental_analysis.indicators import get_earnings_equity
from MOSEE.fundamental_analysis.valuation import (dcf_valuation, pad_valuation, calculate_average_price, book_value)

from MOSEE.data_retrieval.fundamental_data import balance_sheet_data_dic, dividends_expected_dic

from MOSEE.fundamental_analysis.valuation import pad_valuation_dividend

from MOSEE.fundamental_analysis.indicators import set_early_screen


def create_MOSEE_df(ticker_df, forex_data_df, start_date, end_date, API_KEY):
    """
    TODO
    - Look at dividend valuation for banks only or other industries
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
    - forex_df: return new forex dataframe
    """

    shortlist_df = pd.DataFrame()

    for ticker, industry in zip(ticker_df['ticker'], ticker_df['industry']):
        print(ticker)

        if set_early_screen(ticker) == 1:
            print('Good value potential')

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
                financial_prep = Toolkit([ticker], api_key=API_KEY, start_date=start_date, end_date=end_date,
                                         convert_currency=False)
                cash_flow = financial_prep.get_cash_flow_statement()
                balance_sheet = financial_prep.get_balance_sheet_statement()
                currency = financial_prep.get_statistics_statement()
                reported_currency = currency.loc['Reported Currency', '2022']
                print('finished all downloads and reported currency ')
                # check to see if api has collected data
                if cash_flow is None or cash_flow.empty:
                    print(f"No data found for {ticker}. Skipping...")
                    continue

                # checking to see if my two data sources are using the same currency, if not they are converted
                if reported_currency != stock_currency:
                    print('exchanging')
                    cash_flow, forex_data_df = convert_currency(cash_flow, reported_currency, stock_currency,
                                                                forex_data_df)
                    balance_sheet = convert_currency(balance_sheet, reported_currency, stock_currency)

                net_income_dic = net_income_expected(cash_flow, 10)
                balance_sheet_dic = balance_sheet_data_dic(balance_sheet)


                # Value Metrics
                dcf_value = dcf_valuation(net_income_dic)
                if "bank" not in industry:
                    pad_value = pad_valuation(net_income_dic)  ## Add in if statement here, take our dividend valuation
                else:
                    dividends_dic = dividends_expected_dic(cash_flow)
                    pad_value = pad_valuation_dividend(dividends_dic)
                    if pad_value == None:
                        pad_value = pad_valuation(net_income_dic)

                market_average_value = calculate_average_price(stock_data)
                book_valuation = book_value(balance_sheet_dic)

                # Outputs
                earnings_equity = get_earnings_equity(net_income_dic, stock_cap)

                # Calculating the margin of safety price of 1 dollar trying to by 1 dollar for less than 50 cents
                market_mos = mos_dollar(current_price, market_average_value)
                pad_mos = mos_dollar(stock_cap, pad_value)
                dcf_mos = mos_dollar(stock_cap, dcf_value)
                book_mos = mos_dollar(stock_cap, book_valuation)

                # Equity/Earning * MOS -- Bigger is better
                if (market_mos < 0 or pad_mos < 0 or dcf_mos < 0) and earnings_equity < 0:
                    print('One or more of the MOS values are negative as well as the earnings equity')
                    market_MOSEE = 0
                    pad_MOSEE = 0
                    dcf_MOSEE = 0
                    book_MOSEE = 0

                else:
                    print('calculating MOSEE values')
                    market_MOSEE = earnings_equity * (1 / market_mos)  # needs 1/mos as it is better if big
                    pad_MOSEE = earnings_equity * (1 / pad_mos)
                    dcf_MOSEE = earnings_equity * (1 / dcf_mos)
                    book_MOSEE = earnings_equity * (1 / book_mos)

                # Add company information to the shortlist DataFrame
                new_data = {
                    'Ticker Symbol': ticker,  # More descriptive column name
                    'Market MoS': market_mos,
                    'PAD MoS': pad_mos,
                    'DCF MoS': dcf_mos,
                    'Book MoS': book_mos,
                    'Average Market Price': market_average_value,
                    'Current Price': current_price,
                    'PAD Value': pad_value,
                    'DCF Value': dcf_value,
                    'Book Value': book_valuation,
                    'Market Cap': stock_cap,
                    'Earnings per Dollar Equity': earnings_equity,
                    'Market MOSEE': market_MOSEE,
                    'PAD MOSEE': pad_MOSEE,
                    'DCF MOSEE': dcf_MOSEE,
                    'Book MOSEE': book_MOSEE,
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

    return shortlist_df, forex_data_df


def main(tickers_csv, forex_csv, start_date, end_date, API_KEY, save_shortlist, take_top_X, minimum_MOS, test_and_debug,
         batch_run, batch_size, batch_start):
    print(f'Reading the tickers from {tickers_csv}')
    tickers = pd.read_csv(tickers_csv)
    forex_df = pd.read_csv(forex_csv, index_col = 0)
    todays_date = datetime.today().strftime('%Y-%m-%d')

    if test_and_debug:
        print('WARNING: On Test and Debug mode - Only looking at 3 tickers')
        tickers = tickers[1000:1050]

    if batch_run:
        print(f'BATCH: tickers {batch_start} to {batch_start + batch_size - 1}')
        tickers_batch = tickers[batch_start:batch_start + batch_size]
        remaining_tickers = tickers[batch_start + batch_size:]
    else:
        tickers_batch = tickers
        remaining_tickers = pd.DataFrame()

    if end_date is None:
        end_date = todays_date
        print(f'Using today\'s date as the end date: {end_date}')

    shortlist, forex_df = create_MOSEE_df(tickers_batch, forex_df, start_date, end_date, API_KEY)

    if save_shortlist is not None:
        if minimum_MOS is not None:
            print(f'Filtering the MoS to be less than {minimum_MOS} before saving')
            cols = ['Market MoS', 'PAD MoS', 'DCF MoS']
            shortlist[cols] = shortlist[shortlist[cols] <= minimum_MOS][cols]
        if take_top_X is not None:
            print(f'Only saving the top {take_top_X} companies')
            shortlist = shortlist.head(take_top_X)

        folder_path = f"../outputs/{todays_date}/"
        if test_and_debug:
            file_name = "shortlist_debug_mode"
        elif batch_run:
            file_name = f"shortlist_batch_{batch_start}_{batch_start + batch_size - 1}"
        else:
            file_name = "shortlist"
        if not os.path.exists(folder_path):
            # If not, create the folder
            os.makedirs(folder_path)
            print(f"Folder '{folder_path}' created.")

        print(f'Saving short list to {folder_path}/{file_name}.csv')
        shortlist.to_csv(f'{folder_path}/{file_name}.csv')
        forex_df.to_csv(f'../outputs/forex_data_update.csv')

    return remaining_tickers


if __name__ == "__main__":
    tickers_csv = '/Users/patrickdoran/Documents/Python/Investment_Decisions/ticker_data_enhanced.csv'
    forex_csv = '/Users/patrickdoran/repos/MOSEE/outputs/forex_data_update.csv'
    start_date = '2014-01-01'
    end_date = '2024-04-16'  # if using today's date leave as None
    API_KEY = "n2t40UpDfJuZHZA4UvbY95Wf294lqFs4"
    CURRENCY_API = "fca_live_yILyu6NthjaHqQuxOZkf7W2sQCQdv39hVatcTTh5"
    save_shortlist = '../outputs/shortlist_2024.csv'
    save_forex = '../outputs/forex_data_update.csv'
    take_top_X = 500
    minimum_MOS = None
    test_and_debug = True
    batch_run = False
    batch_size = 1000
    batch_start = 000
    print('Variables set up, running main next')

    while True:
        remaining_tickers = main(tickers_csv, forex_csv, start_date, end_date, API_KEY, save_shortlist, take_top_X,
                                 minimum_MOS, test_and_debug, batch_run, batch_size, batch_start)
        if len(remaining_tickers) == 0:
            break
        else:
            batch_start += batch_size
