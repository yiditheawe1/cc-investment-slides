---
name: investment-index-analysis
description: Use when asked to analyze market index changes, generate market analysis reports, create market-change-analysis.pptx, or explain why indicators moved. Reads market-index.json, fetches corroborating news, and produces a slide deck with trend + cause analysis per category.
---

# investment-index-analysis Skill

Reads today's indicator snapshot from `market-index.json`, fetches corroborating news from **multiple sources per category**, cross-validates claims, and generates `market-change-analysis_YYYY_MM_DD.pptx`.

---

## Execution Steps

### Step 0 — Check Playwright MCP  ← DO THIS FIRST, BEFORE ANYTHING ELSE

```
ToolSearch({ query: "select:mcp__playwright__browser_navigate", max_results: 1 })
```

**If tools are found** → Playwright is running. Proceed to Step 1.

**If tools are NOT found** → **STOP. Do not proceed.**

Report to the user:

> Playwright MCP is not running. Phase B news sources (CNBC · CNN Business · The Block · MarketWatch · Bloomberg · Yahoo Finance) require a live browser. Running without them produces analysis with insufficient cross-validation and no Playwright-sourced coverage.
>
> **To fix:** run `! npx @playwright/mcp@latest --version` in the prompt to verify npx resolves correctly, then restart the session.

Do **not** attempt a WebFetch Phase-A-only fallback.

---

### Step 1 — Read cold_start.md

Read `.claude/skills/investment-index-analysis/cold_start.md` before fetching any news.

It contains:
- Which sources work via WebFetch vs Playwright (updated 2026-05-31 — many previously-blocked sources now confirmed working)
- `browser_evaluate` patterns for all Playwright sources
- All known pitfalls

**If you skip this step, you will use stale block-lists and miss available sources.**

---

### Step 2 — Read market-index.json

Read `market-index.json` from the project root (`E:\CC项目\market-index.json`).

> ⚠️ **Verify dates before proceeding.** Check the top-level `"date"` field and the `"date"` inside each indicator. If any Playwright-only indicator (cnnFG, mm, aaii, ca5yGoc, ca5yCmb, fundFlow) shows a date older than today, that value was carried over from a previous session (stale LIVE_MANUAL). Note which indicators are stale and flag them explicitly in the analysis text (e.g. "数据截至 Jun 8，待刷新"). Do NOT present stale values as today's data.

For every indicator extract `value`, `change`, `dir`, `date` and compute direction summary:
**UP / DOWN / FLAT** + magnitude (e.g. "VIX -7.7% → volatility compressing").

| Key | Category |
|-----|----------|
| `cryptoFG`, `btcDom`, `ethBtc`, `fundFlow` | CRYPTO |
| `cnnFG`, `vix`, `mm`, `sofr`, `aaii`, `naaim` | STOCK |
| `us10y`, `us30y`, `ca5yGoc`, `ca5yCmb` | 利率 |
| `usdCad`, `usdCny`, `cadCny` | FOREX |

---

### Step 3 — Fetch news (multi-source, parallel where possible)

**Minimum source targets per category:**

| Category | Minimum sources | Goal |
|----------|-----------------|------|
| CRYPTO | 3 | 4+ |
| STOCK | 3 | 4+ |
| 利率 (Rates) | 2 | 3+ |
| FOREX | 2 | 3+ |

**Execution model:**

**Phase A — Subagent WebFetch (keeps raw HTML out of main context)**

Spawn a **single** `general-purpose` subagent with this prompt (fill in today's date):

```
Fetch the following 13 URLs in parallel using WebFetch. For each URL return ONLY:
- Up to 6 bullet points, each: "• Headline | Date | 1-sentence summary"
- Skip articles older than 2 days from {DATE}
- Max 80 words per source. No raw HTML. No extra commentary.

CRYPTO:
  https://www.coindesk.com/
  https://alternative.me/crypto/fear-and-greed-index/
  https://coinmarketcap.com/headlines/
  https://www.investing.com/news/cryptocurrency-news
  https://www.investing.com/analysis/cryptocurrency

STOCK:
  https://www.investing.com/news/stock-market-news
  https://www.investing.com/analysis/stock-markets
  https://naaim.org/programs/naaim-exposure-index/

利率:
  https://www.investing.com/analysis/bonds
  https://www.investing.com/analysis/market-overview

FOREX:
  https://www.investing.com/news/forex-news
  https://www.investing.com/analysis/forex

跨板块:
  https://www.investing.com/news/headlines

Return results grouped by category. Total output must be under 1000 words.
```

The subagent returns a compact structured summary — no raw page content enters the main context.

**→ Phase A 返回后立即执行：Read `E:\CC项目\analysis-data.js`**

此时 context 仅含：cold_start + market-index + Phase A 摘要，是整个 skill 运行中最轻的窗口。
Phase B 执行完后会再增加 4 个站点的 Playwright 结果；在 Phase B 前读取数据文件，可降低后续 Edit 时的 context 压力。
（无需解析文件内容——仅读入即可；Edit 步骤使用已在 context 中的文件状态。）

**Phase B — Sequential Playwright calls** (stateful browser, one at a time):

Run only the Playwright sources that add coverage not already obtained from Phase A. Suggested order:

```
1. CNBC Markets          → STOCK (+ macro/rates context)
2. CNN Business/Investing → STOCK (cross-validate CNBC)
3. The Block              → CRYPTO (cross-validate CoinDesk)
4. MarketWatch            → STOCK + FOREX (broad macro)
5. Bloomberg Markets      → cross-category macro headlines (headlines only — articles paywalled)
6. Yahoo Finance News     → broad supplement if gaps remain
7. Bank of Canada /rates/ → 利率/FOREX (CORRA + CAD/USD data)
```

Skip any Playwright source if Phase A already gave ≥3 quality articles for that category.

**Always use `browser_evaluate` for Playwright sources — never `browser_snapshot`.** Snapshots dump the full accessibility tree (thousands of lines) into context; evaluate returns only structured JSON.

**Per-article extract:** headline · date · 1-sentence summary · source name.
**Only use articles dated today or yesterday** (relative to `market-index.json` date field).

#### Source reference table

| Category | Source | URL | Method |
|----------|--------|-----|--------|
| CRYPTO | CoinDesk | https://www.coindesk.com/ | WebFetch |
| CRYPTO | Alternative.me | https://alternative.me/crypto/fear-and-greed-index/ | WebFetch |
| CRYPTO | CoinMarketCap | https://coinmarketcap.com/headlines/ | WebFetch |
| CRYPTO | Investing.com Crypto News | https://www.investing.com/news/cryptocurrency-news | WebFetch |
| CRYPTO | Investing.com Crypto Analysis | https://www.investing.com/analysis/cryptocurrency | WebFetch |
| CRYPTO | The Block | https://www.theblock.co/ | Playwright |
| STOCK | Investing.com Stock News | https://www.investing.com/news/stock-market-news | WebFetch |
| STOCK | Investing.com Stock Analysis | https://www.investing.com/analysis/stock-markets | WebFetch |
| STOCK | NAAIM | https://naaim.org/programs/naaim-exposure-index/ | WebFetch |
| STOCK | CNBC Markets | https://www.cnbc.com/markets/ | Playwright |
| STOCK | CNN Business/Investing | https://www.cnn.com/business/investing | Playwright |
| STOCK | MarketWatch | https://www.marketwatch.com/ | Playwright |
| 利率 | Investing.com Bonds | https://www.investing.com/analysis/bonds | WebFetch |
| 利率 | Investing.com Market Overview | https://www.investing.com/analysis/market-overview | WebFetch |
| 利率 | Bank of Canada | https://www.bankofcanada.ca/rates/ | Playwright |
| FOREX | Investing.com Forex News | https://www.investing.com/news/forex-news | WebFetch |
| FOREX | Investing.com Forex Analysis | https://www.investing.com/analysis/forex | WebFetch |
| FOREX | MarketWatch | https://www.marketwatch.com/ | Playwright |
| FOREX | Bank of Canada | https://www.bankofcanada.ca/rates/ | Playwright |
| 跨板块 | Investing.com Headlines | https://www.investing.com/news/headlines | WebFetch |
| 跨板块 | Bloomberg Markets | https://www.bloomberg.com/markets | Playwright (headlines only) |
| 跨板块 | Yahoo Finance News | https://finance.yahoo.com/news/ | Playwright |

---

### Step 4 — Synthesize analysis per category

For each category produce three text blocks:

**a. 市场走势** (≤80 words)
- Use numbers exclusively from `market-index.json`
- State direction + magnitude for each indicator
- No editorial — factual description only

**b. 原因分析** (≤150 words)
- **Cross-validation rule**: If ≥2 sources agree on a cause, state it as confirmed consensus and cite both. If sources conflict, explicitly flag: "X 来源认为…，但 Y 来源指出…"
- Each causal claim must cite at least one source by name
- Target: cite 3–5 distinct sources across the full analysis block
- Prioritize recency (today > yesterday) and specificity (article with data > vague headline)

**c. 消息源** — list **3–5** references used, format: `{ name, url }`
- Include only sources that contributed at least one cited claim
- Bloomberg: only cite if headline directly informed a point (do not cite for vague market color)

**Cross-validation protocol:**
- Consistent across sources → "据 CNBC 及 MarketWatch 报道，…"
- Conflicting → "CNBC 称…；而 Investing.com 分析则指出…，两者信号分歧"
- Only one source available → flag with "(单一来源，待交叉验证)"

---

### Step 5 — Generate PPT

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
| 1 | CRYPTO 走势 | Indicator cards (cryptoFG · btcDom · ethBtc · fundFlow) + 市场走势 text |
| 2 | CRYPTO 分析 | 原因分析 + 消息源 list (3–5 sources) |
| 3 | STOCK 走势 | Cards (cnnFG · vix · mm · aaii · naaim) + 市场走势 text |
| 4 | STOCK 分析 | 原因分析 + 消息源 list (3–5 sources) |
| 5 | SOFR 走势 | SOFR 6-cell grid + 市场走势 text |
| 6 | 利率 走势 | Cards (us10y · us30y · ca5yGoc · ca5yCmb) + 市场走势 text |
| 7 | 利率 分析 | 原因分析 (SOFR + 利率 combined) + 消息源 list (3–5 sources) |
| 8 | FOREX 走势 | Cards (usdCad · usdCny · cadCny) + 市场走势 text |
| 9 | FOREX 分析 | 原因分析 + 消息源 list (3–5 sources) |

Total: **10 slides**.

#### Per-slide layout (analysis slides — slides 2, 4, 7, 9)

```
┌─────────────────────────────────────────────────────────┐
│ [accent bar]  CATEGORY — 原因分析           DATE        │
├───────────────────────────────────┬─────────────────────┤
│                                   │  消息源              │
│  原因分析 text block               │  • Source A         │
│  (slate card, white text, 11pt)   │  • Source B         │
│                                   │  • Source C         │
│                                   │  • Source D         │
│                                   │  • Source E         │
└───────────────────────────────────┴─────────────────────┘
```

- Left panel (65% width): 原因分析 text in card (`1E293B` bg)
- Right panel (33% width): 消息源 list, each item in teal (name) + muted (URL)
- Accent bar colors: CRYPTO=amber · STOCK=blue · 利率=purple · FOREX=emerald

#### Per-slide layout (trend slides — slides 1, 3, 5/6, 8)

```
┌─────────────────────────────────────────────────────────┐
│ [accent bar]  CATEGORY — 市场走势           DATE        │
├─────────────────────────────────────────────────────────┤
│  [Indicator cards — same style as investment-index]      │
│  (top ~53% of slide, max 2 rows of cards)               │
├─────────────────────────────────────────────────────────┤
│  市场走势 text block (bottom ~30% of slide)             │
│  (card bg, slate label "市场走势", white 11pt text)     │
└─────────────────────────────────────────────────────────┘
```

#### Script update — 编辑 `analysis-data.js`，分板块逐一 Edit

**编辑目标文件是 `analysis-data.js`（~110行），不是 `generate_investment_index_analysis.js`（布局代码）。**
`generate_investment_index_analysis.js` 现在只有一行 `require('./analysis-data.js')`，不含 ANALYSIS 数据，无需编辑。

读取时只需 `Read('analysis-data.js')`，比原来节省 ~380 行布局代码的 token 开销。

**不要用单次大 Edit 替换整个 module.exports 对象。** 按板块分 5 次独立 Edit，每次只替换一个板块的 `trend` / `cause` / `sources` 块。好处：单次传输量小、出错重试成本低、context 占用少。

每次 Edit 的 `old_string` 锚定到该板块的开头注释或唯一字符串，`new_string` 只含该板块内容。顺序：

```
Edit 1 → crypto  { trend, cause, sources }
Edit 2 → stock   { trend, cause, sources }
Edit 3 → sofr    { trend }
Edit 4 → rates   { trend, cause, sources }
Edit 5 → forex   { trend, cause, sources }
```

`recs` 和 `watches` **只在以下情况更新**，否则保持上次内容不变（无需 Edit）：
- 有核心指标方向发生重大逆转（如 NAAIM 从极值回落、VIX 急升、BTC F&G 突破 35）
- 有新的重大事件出现（如停火落地、CPI 超预期、重大 IPO）

#### 板块锚定模式（每次 Edit 的定位方式）

```js
// crypto 锚定：
old_string 起始 → "  crypto: {\n    trend:"
old_string 结束 → 该 sources 数组的末尾 "],"（含最后一个 }，）

// stock 锚定：
old_string 起始 → "  stock: {\n    trend:"

// sofr 锚定：
old_string 起始 → "  sofr: {\n    trend:"

// rates 锚定：
old_string 起始 → "  rates: {\n    trend:"

// forex 锚定：
old_string 起始 → "  forex: {\n    trend:"
```

每个板块结构参考：
```js
  crypto: {
    trend:   '...走势文字（≤80字）...',
    cause:   '...原因分析（≤150字，含≥2来源引用）...',
    sources: [
      { name: 'CoinDesk',      url: 'coindesk.com' },
      { name: 'Investing.com', url: 'investing.com/analysis/cryptocurrency' },
      { name: 'Alternative.me',url: 'alternative.me/crypto/fear-and-greed-index' },
    ],
  },
```

Run with:
```bash
node generate_investment_index_analysis.js
```

> `analysis-data.js` は data only (~110 lines). `generate_investment_index_analysis.js` は layout only — do NOT edit for analysis updates.

---

### Step 6 — QA

- Confirm output file exists: `market-change-analysis_YYYY_MM_DD.pptx`
- Confirm every category has ≥3 news sources cited (目标 3–5)
- Confirm 原因分析 text contains at least 2 named source citations per category
- Report any category where fewer than 3 sources were obtained (and why)
- Do NOT open or preview the file — report path only

### Step 7 — Close browser

After upload is confirmed (or skipped), close any Playwright browser pages opened during this skill run:

```
browser_close()
```

If `browser_close` fails or is unavailable, skip silently.

---

## Known Pitfalls

| Pitfall | Fix |
|---------|-----|
| **Phase A WebFetch raw HTML floods main context** | Use subagent for Phase A — see Step 3; subagent returns compact summaries only |
| **`browser_snapshot` dumps full accessibility tree** | Always use `browser_evaluate` for Playwright sources — never `browser_snapshot`; evaluate returns structured JSON, snapshot returns thousands of lines |
| **一次性替换整个 ANALYSIS 对象耗时且易出错** | 编辑 `analysis-data.js`，按板块分 5 次独立 Edit（crypto → stock → sofr → rates → forex）；`recs`/`watches` 无重大市场变化时保持不变，不要每次重写 |
| **误编辑 generate_investment_index_analysis.js** | 该文件现在只含布局代码 + 一行 require，分析数据全在 `analysis-data.js` |
| CNBC returns 403 to WebFetch | Use Playwright MCP `browser_evaluate`; see cold_start.md Section 2 |
| CNN `cnn.com/business/investing` works via Playwright (was marked 451) | Use Playwright `browser_evaluate` (old fear-and-greed URL still 451) |
| The Block works via Playwright (was marked 403) | Use Playwright `browser_evaluate` |
| Bloomberg works for headlines via Playwright (was marked login-wall) | Playwright returns headlines only; do not cite for article-level claims |
| Yahoo Finance /news/ works via Playwright (was marked 503) | Use Playwright `browser_evaluate` |
| MarketWatch works via Playwright (was marked blocked) | Use Playwright `browser_evaluate` |
| Bank of Canada /rates/ has real data via Playwright (was marked nav-only) | Use Playwright `browser_evaluate` for CAD/USD + CORRA |
| Reuters Markets still near-blocked via Playwright | Returns only ~3 near-empty entries; use MarketWatch or Investing.com instead |
| US Treasury interest-rates URL is 404 | Original URL removed; use market-index.json for 10Y/30Y data |
| News too old (>2 days) | Skip and note "no recent news found" in analysis |
| `market-index.json` missing | Run investment-index-slides skill first |
| Stale LIVE_MANUAL values in market-index.json (2026-06-09) | Playwright MCP failed; slides skill silently kept Jun 8 cnnFG/ca5y data in Jun 9 market-index.json — analysis presented yesterday's data as today's | Step 1 now requires checking each indicator's `date` field. Flag any Playwright-only indicator dated before today as stale in the analysis text. |
| pptxgenjs hex colors with `#` | Strip `#` prefix — silently breaks rendering |
| Long source URLs overflow slide | Use hostname only (e.g. `cnbc.com`) or truncate path |
| SOFR + 利率 overlap | Combine into one analysis slide (slide 7) |
| Citing Bloomberg for specific claims | Bloomberg articles are paywalled; only cite if headline directly supports the point |
| **`browser_evaluate` requires `function` parameter, not `expression`** | The `mcp__playwright__browser_evaluate` schema uses `function` (not `expression`). Always use ToolSearch to load the schema before the first call each session. |
