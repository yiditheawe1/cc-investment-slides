---
name: investment-index-analysis
description: Use when asked to analyze market index changes, generate market analysis reports, create market-change-analysis.pptx, or explain why indicators moved. Reads market-index.json, fetches corroborating news, and produces a slide deck with trend + cause analysis per category.
---

# investment-index-analysis Skill

Reads today's indicator snapshot from `market-index.json`, fetches corroborating news from credible sources, synthesizes cause analysis, and generates `market-change-analysis_YYYY_MM_DD.pptx`.

---

## Execution Steps

### Step 0 — Read cold_start.md  ← DO THIS FIRST, EVERY TIME

Read `.claude/skills/investment-index-analysis/cold_start.md` before fetching any news.

It contains:
- Which news sources work via WebFetch vs Playwright vs blocked entirely
- The reusable `browser_evaluate` pattern for CNBC Markets
- Recommended 4-request workflow (3 WebFetch + 1 Playwright)
- All known pitfalls from the first run (Bloomberg paywalled, Reuters/MarketWatch blocked, etc.)

**If you skip this step, you will waste requests on known-blocked sources.**

### Step 1 — Read market-index.json

Read `market-index.json` from the project root (`E:\CC项目\market-index.json`).

Extract these fields for every indicator (use `value`, `change`, `dir`, `date` where present):

| Key | Category |
|-----|----------|
| `cryptoFG` | CRYPTO |
| `btcDom` | CRYPTO |
| `ethBtc` | CRYPTO |
| `fundFlow` | CRYPTO |
| `cnnFG` | STOCK |
| `vix` | STOCK |
| `mm` | STOCK |
| `sofr` | STOCK |
| `aaii` | STOCK |
| `naaim` | STOCK |
| `us10y` | 利率 |
| `us30y` | 利率 |
| `ca5yGoc` | 利率 |
| `ca5yCmb` | 利率 |
| `usdCad` | FOREX |
| `usdCny` | FOREX |
| `cadCny` | FOREX |

Compute direction summary per indicator: **UP / DOWN / FLAT** + magnitude (e.g. "VIX -5% → risk-off easing").

---

### Step 1 — Fetch news per category

For each category, fetch from **at least 2 credible sources**. Cross-validate: if sources conflict, note the discrepancy. Use WebFetch first; fall back to Playwright MCP if the page returns 403 or is JS-rendered.

Extract per article: **headline · date · 1-sentence summary · URL**.

Only use articles dated **today or yesterday** (relative to `market-index.json` date field).

#### CRYPTO sources (priority order)

| Source | URL |
|--------|-----|
| CoinDesk | https://www.coindesk.com/ |
| The Block | https://www.theblock.co/ |
| CoinGlass | https://www.coinglass.com/ |
| Alternative.me | https://alternative.me/crypto/fear-and-greed-index/ |
| CryptoQuant | https://cryptoquant.com/ |
| CoinMarketCap | https://coinmarketcap.com/headlines/ |
| Investing.com Crypto News | https://www.investing.com/news/cryptocurrency-news |
| Investing.com Crypto Analysis | https://www.investing.com/analysis/cryptocurrency |

Relate news to: F&G direction, BTC dominance shift, ETH/BTC trend, fund flow sign change.

#### STOCK sources (priority order)

| Source | URL |
|--------|-----|
| CNN Markets | https://www.cnn.com/business/investing |
| CNBC Markets | https://www.cnbc.com/markets/ |
| NAAIM Index | https://naaim.org/programs/naaim-exposure-index/ |
| MacroMicro | https://en.macromicro.me/ |
| Investing.com Stock News | https://www.investing.com/news/stock-market-news |
| Investing.com Stock Analysis | https://www.investing.com/analysis/stock-markets |

Relate news to: CNN F&G score, VIX level, MM Bull/Bear move, AAII bull/bear shift, NAAIM manager positioning.

#### SOFR / 利率 sources (priority order)

| Source | URL |
|--------|-----|
| NY Fed SOFR | https://www.newyorkfed.org/markets/reference-rates/sofr |
| US Treasury | https://home.treasury.gov/resource-center/data-chart-center/interest-rates/ |
| Bank of Canada | https://www.bankofcanada.ca/rates/ |
| Investing.com Bond Analysis | https://www.investing.com/analysis/bonds |

Relate news to: SOFR rate vs percentiles, US 10Y/30Y direction, Canada 5Y CMB move.

#### FOREX sources (priority order)

| Source | URL |
|--------|-----|
| Investing.com Forex News | https://www.investing.com/news/forex-news |
| Investing.com Forex Analysis | https://www.investing.com/analysis/forex |

Relate news to: USD/CAD, USD/CNY, CAD/CNY direction and magnitude.

#### 市场总览 / Breaking News sources (use to supplement any category)

| Source | URL |
|--------|-----|
| Investing.com Market Overview | https://www.investing.com/analysis/market-overview |
| Investing.com Breaking News | https://www.investing.com/news/headlines |

Use these when cross-category context is needed (e.g. macro events driving simultaneous equity + forex + rates moves). Extract headlines dated today or yesterday and assign each to the most relevant category in the analysis.

---

### Step 2 — Synthesize analysis per category

For each category produce three text blocks (keep concise — these go on slides):

**a. 市场走势** (≤80 words): Describe what moved, by how much, vs prior value. Use numbers from `market-index.json`.

**b. 原因分析** (≤120 words): Explain *why* based on the fetched news. Cross-reference at least 2 sources. Note any conflicting signals.

**c. 消息源**: List 2–4 references used (website name + URL or article title).

---

### Step 3 — Generate PPT

Output file: `market-change-analysis_YYYY_MM_DD.pptx` (use date from `market-index.json`).

Use pptxgenjs via:
```js
const pptxgen = require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));
```

#### Color palette (same as investment-index-slides — no `#` prefix)
```js
const C = {
  bg:'0F172A', card:'1E293B', white:'FFFFFF', slate:'94A3B8',
  teal:'0D9488', green:'22C55E', red:'EF4444', muted:'64748B',
  divider:'2D3F55', amber:'F59E0B', blue:'3B82F6',
  purple:'8B5CF6', emerald:'10B981',
};
```

#### Slide structure

| Slide | Section | Content |
|-------|---------|---------|
| 0 | Cover | "Market Change Analysis" · date · "CRYPTO · STOCK · RATES · FOREX" |
| 1 | CRYPTO 走势 | Indicator values card grid (cryptoFG · btcDom · ethBtc · fundFlow) + 市场走势 text |
| 2 | CRYPTO 分析 | 原因分析 + 消息源 list |
| 3 | STOCK 走势 | Values (cnnFG · vix · mm · aaii · naaim) + 市场走势 text |
| 4 | STOCK 分析 | 原因分析 + 消息源 list |
| 5 | SOFR 走势 | SOFR 6-cell grid + 市场走势 text |
| 6 | 利率 走势 | Values (us10y · us30y · ca5yCmb) + 市场走势 text |
| 7 | 利率 分析 | 原因分析 (SOFR + 利率 combined) + 消息源 list |
| 8 | FOREX 走势 | Values (usdCad · usdCny · cadCny) + 市场走势 text |
| 9 | FOREX 分析 | 原因分析 + 消息源 list |

Total: **10 slides**. SOFR and 利率 share one analysis slide (slide 7) since they are closely related.

#### Per-slide layout (analysis slides — slides 2, 4, 7, 9)

```
┌─────────────────────────────────────────────────────────┐
│ [accent bar]  CATEGORY — 原因分析           DATE        │
├───────────────────────────────────┬─────────────────────┤
│                                   │  消息源              │
│  原因分析 text block               │  • Source A (URL)   │
│  (slate card, white text, 12pt)   │  • Source B (URL)   │
│                                   │  • Source C         │
└───────────────────────────────────┴─────────────────────┘
```

- Left panel (65% width): 原因分析 text in card (`1E293B` bg)
- Right panel (33% width): 消息源 list, each item in teal link style
- Accent bar colors: same as investment-index-slides per category

#### Per-slide layout (trend slides — slides 1, 3, 5/6, 8)

```
┌─────────────────────────────────────────────────────────┐
│ [accent bar]  CATEGORY — 市场走势           DATE        │
├─────────────────────────────────────────────────────────┤
│  [Indicator cards — same style as investment-index]      │
│  (top half of slide, max 2 rows of cards)               │
├─────────────────────────────────────────────────────────┤
│  市场走势 text block (bottom 30% of slide)              │
│  (card bg, slate label "市场走势", white 11pt text)     │
└─────────────────────────────────────────────────────────┘
```

#### Script pattern

Write the analysis content into a JS object, then pass to slide builder:

```js
const ANALYSIS = {
  crypto: {
    trend:   '...走势文字...',
    cause:   '...原因分析文字...',
    sources: [
      { name: 'CoinDesk', url: 'https://www.coindesk.com/...' },
      { name: 'CoinGlass', url: 'https://www.coinglass.com/...' },
    ],
  },
  stock:  { trend: '...', cause: '...', sources: [...] },
  sofr:   { trend: '...', cause: '...', sources: [...] },
  rates:  { trend: '...', cause: '...', sources: [...] },
  forex:  { trend: '...', cause: '...', sources: [...] },
};
```

Run with:
```bash
node generate_investment_index_analysis.js
```

---

### Step 4 — QA

- Confirm output file exists: `market-change-analysis_YYYY_MM_DD.pptx`
- Confirm all 5 categories have ≥ 2 news sources cited
- Report any indicators where news was not found (mark N/A in analysis)
- Do NOT open or preview the file — report path only

### Step 5 — Close browser

After QA is confirmed, close any Playwright browser pages opened during this skill run:

```
browser_close()
```

This releases the browser process. If `browser_close` fails or is unavailable, skip silently — do not retry or report as an error.

---

## Known Pitfalls

| Pitfall | Fix |
|---------|-----|
| CNBC returns 403 | Use Playwright MCP; if unavailable, Investing.com stock/overview covers the same news |
| CoinGlass JS-rendered | Use Playwright MCP: navigate → wait 4s → snapshot |
| News too old (>2 days) | Skip and note "no recent news found" in analysis |
| `market-index.json` missing | Run investment-index-slides skill first to generate it |
| pptxgenjs hex colors with `#` | Strip `#` — silently breaks rendering |
| Long source URLs overflow slide | Truncate to hostname + path, or use website name only |
| SOFR + 利率 overlap in analysis | Combine into one analysis slide (slide 7); no duplication needed |
