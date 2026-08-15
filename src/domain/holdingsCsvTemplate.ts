export const holdingsCsvTemplateFileName = "cogvest-holdings-v1.csv";

export const holdingsCsvTemplate = [
  "cogvest_version,name,ticker,symbol,asset_class,instrument_type,sector,currency,exchange,quantity,average_cost,current_price,valuation_as_of,first_purchase_date",
  "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,1678.25,2026-08-15,2024-04-15",
  "1,Nifty 50 ETF,NIFTYBEES.NS,NIFTYBEES,etf,etf,diversified,INR,NSE,40,200,,,unknown",
  "",
].join("\n");
