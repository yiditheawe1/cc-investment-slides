# Investment Index Indicators

> **Fetch method key**
> - `fetch_live_data.js` — run `node fetch_live_data.js` first; patches LIVE block automatically
> - `WebFetch` — plain HTTP scraping, works without a browser
> - `Playwright MCP` — requires real browser (JS-rendered or 403 to plain fetch)

## CRYPTO

| Indicator | Fetch method | URL / API endpoint |
|-----------|--------------|-------------------|
| Crypto Fear and Greed Index | `fetch_live_data.js` | API: https://api.alternative.me/fng/?limit=2 — `data[0].value` / `data[0].value_classification` / `data[1]` for prev |
| Bitcoin Dominance Chart | `fetch_live_data.js` | API: https://api.coingecko.com/api/v3/global — `data.market_cap_percentage.btc` |
| ETH/BTC | `fetch_live_data.js` | API: https://api.binance.com/api/v3/ticker/24hr?symbol=ETHBTC — `lastPrice` / `priceChange` / `priceChangePercent` |
| 加密货币资金流数据统计 (BTC, 6 values) | `Playwright MCP` | https://coinank.com/zh/fund/fundSwap — JS-rendered; use Playwright MCP. Extract BTC row: (1) 15m (2) 4h (3) 7d (4) 30d (5) 市值 (6) 资金信号. See cold_start.md Section 9 for pattern. |

## STOCK

| Indicator | Fetch method | URL / API endpoint |
|-----------|--------------|-------------------|
| Fear & Greed Index (2 values: 当前 + 前值) | `Playwright MCP` | https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed — DOM: `div.sidebar-sec.chart-stat-lastrows li:first-child` → `.stat-val .val` (current) / `.prev-val .val` (prev). Fallback: https://www.cnn.com/markets/fear-and-greed (HTTP 451). |
| CBOE Volatility Index (VIX) | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d — `chart.result[0].meta.regularMarketPrice` / `chartPreviousClose` |
| US MM Bull and Bear Indicator (4 values) | `Playwright MCP` | https://en.macromicro.me/collections/34/us-stock-relative/142681/us-mm-bull-and-bear-indicator — DOM: `div.sidebar-sec.chart-stat-lastrows li` → `.stat-val .val` (current) / `.prev-val .val` (prev). li[0]=MM Bull/Bear, li[1]=S&P 500. S&P 500 fallback: https://finance.yahoo.com/quote/%5EGSPC/ |
| Secured Overnight Financing Rate (SOFR) — 6 values | `fetch_live_data.js` | API: https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json — `refRates[0]`: `effectiveDate` / `percentRate` / `percentPercentile1` / `percentPercentile25` / `percentPercentile75` / `percentPercentile99` / `volumeInBillions` |
| AAII与标普500关系 (4 values) | `Playwright MCP` | https://sc.macromicro.me/charts/77072/AAII-niu-xiong-yu-biao-pu-500-guan-xi — DOM: same `div.sidebar-sec.chart-stat-lastrows li` pattern. li[0]=看多, li[1]=看空. Fallback: https://www.aaii.com/sentimentsurvey |
| 美国NAAIM经理人持仓指数 (4 values) | `WebFetch` | https://www.naaim.org/programs/naaim-exposure-index/ — extract weekly table: (a) current mean, (b) prev mean, (c) 4W MA = avg of 4 most-recent weeks, (d) 4W MA prev = avg of weeks 2–5 |

## 利率 (Rates)

| Indicator | Fetch method | URL / API endpoint |
|-----------|--------------|-------------------|
| U.S. 10 Year Treasury | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d — `chart.result[0].meta.regularMarketPrice` / `chartPreviousClose` |
| U.S. 30 Year Treasury | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/%5ETYX?interval=1d&range=5d — `chart.result[0].meta.regularMarketPrice` / `chartPreviousClose` |
| Canada 5-year CMB | `Playwright MCP` | https://www.canadaici.com/market-data/ — extract from `div.widgetTableCell.field3.col3 a` (dynamic page; value example: `3.34%`) |

## Forex

| Indicator | Fetch method | URL / API endpoint |
|-----------|--------------|-------------------|
| USD/CAD | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/USDCAD=X?interval=1d&range=5d — `regularMarketPrice` / `chartPreviousClose` |
| USD/CNY | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/USDCNY=X?interval=1d&range=5d — `regularMarketPrice` / `chartPreviousClose` |
| CAD/CNY | `fetch_live_data.js` | API: https://query1.finance.yahoo.com/v8/finance/chart/CADCNY=X?interval=1d&range=5d — `regularMarketPrice` / `chartPreviousClose` |
