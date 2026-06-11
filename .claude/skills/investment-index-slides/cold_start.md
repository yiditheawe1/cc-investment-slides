# Cold Start Guide — investment-index-slides Skill

> Read this before any new session. It captures every lesson learned so you don't repeat the same mistakes.

---

## 1. Generate the File — Boilerplate

```bash
node generate_investment_index_slides.js        # in e:\CC项目\
```

**There is only ONE script file.** `generate_slides.js` was a duplicate created by mistake and has been deleted.

- pptxgenjs require path — always use `path.resolve` to handle Windows + non-ASCII directories:
  ```js
  const pptxgen = require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));
  ```
- Output filename **must be dynamic**: `investment-index-slides_YYYY_MM_DD.pptx` (UTC date)
- Current script variable name: `pptx` (not `prs`) — the user refactored to `PptxGenJS`

### pptxgenjs hard rules (violations silently break the file)
| Rule | Wrong | Right |
|------|-------|-------|
| Hex colors | `"#0F172A"` | `"0F172A"` |
| 8-char hex opacity | `"0F172A80"` | use `transparency` property instead |
| Shape type strings | `prs.ShapeType.rect` | `'rect'` |
| Line thickness | `line: { width:1 }` | `line: { pt: 0.5 }` |

---

## 2. Data Sources — Traffic-light Status

### ✅ Auto-fetched at runtime by `generate_investment_index_slides.js` (free JSON APIs, no key)

These 10 indicators are fetched automatically every time the script runs — no separate step needed.

| Indicator | API endpoint |
|-----------|-------------|
| Crypto Fear & Greed | https://api.alternative.me/fng/?limit=2 |
| BTC Dominance | https://api.coingecko.com/api/v3/global |
| ETH/BTC | https://api.binance.com/api/v3/ticker/24hr?symbol=ETHBTC |
| SOFR (6 values) | https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json (⚠ needs `secured/` prefix — plain `/sofr/last/1.json` returns 400) |
| CBOE VIX | https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX (unofficial but stable) |
| US 10Y Treasury | https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX |
| US 30Y Treasury | https://query1.finance.yahoo.com/v8/finance/chart/%5ETYX |
| USD/CAD | https://query1.finance.yahoo.com/v8/finance/chart/USDCAD=X |
| USD/CNY | https://query1.finance.yahoo.com/v8/finance/chart/USDCNY=X |
| CAD/CNY | https://query1.finance.yahoo.com/v8/finance/chart/CADCNY=X |

Yahoo Finance `v8/finance/chart` response: `chart.result[0].meta.regularMarketPrice` (current) and `chartPreviousClose` (previous). No API key required; add `User-Agent` header.

### ✅ Auto-fetchable via WebFetch (HTML scraping)

| Indicator | URL | Prompt hint |
|-----------|-----|-------------|
| NAAIM | https://www.naaim.org/programs/naaim-exposure-index/ | **full table** — need ≥5 rows |
| S&P 500 (fallback) | https://finance.yahoo.com/quote/%5EGSPC/ | current + prev close |

### ✅ Previously blocked — now fetchable via Playwright MCP

These return 403 to plain WebFetch but load fine in a real browser.
**Use the `playwright` MCP server** (`browser_navigate` + `browser_snapshot`). See Section 9 for exact tool sequence.

| Indicator | URL | DOM hint |
|-----------|-----|----------|
| CNN Fear & Greed | https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed | `div.sidebar-sec.chart-stat-lastrows li:first-child` → `.stat-val .val` / `.prev-val .val` |
| MM Bull/Bear + S&P 500 | https://en.macromicro.me/collections/34/us-stock-relative/142681/us-mm-bull-and-bear-indicator | same sidebar pattern; li[0]=MM Bull/Bear, li[1]=S&P 500 |
| AAII 牛熊 | https://sc.macromicro.me/charts/77072/AAII-niu-xiong-yu-biao-pu-500-guan-xi | same sidebar pattern; li[0]=看多, li[1]=看空 |
| Canada 5Y GOC | https://www.canadaici.com/market-data/ | `querySelectorAll('div.widgetTableCell.field3.col3 a')[0]` → GOC 5Y (e.g. `3.19%`) |
| Canada 5Y CMB | https://www.canadaici.com/market-data/ | `querySelectorAll('div.widgetTableCell.field3.col3 a')[2]` → CMB 5Y (e.g. `3.32%`) ⚠️ index [0] is GOC, not CMB |

> **SOFR removed from this list** — now auto-fetched via the official NY Fed JSON API inside the main script.

**Also blocked (do not try these as alternatives):**
- `www.cnbc.com/quotes/.VIX` — 403
- `www.cnn.com/markets/fear-and-greed` — 451
- `fred.stlouisfed.org` — 403
- `www.wsj.com` — blocked
- `www.marketwatch.com` — blocked
- `www.aaii.com/sentimentsurvey` — returns empty body
- `api.aaii.com/sentiment` — ECONNREFUSED
- Bank of Canada API → returns conventional mortgage rate, **not CMB yield** (different thing)

### ✅ Previously blocked — now fetchable via Playwright MCP (continued)

| Indicator | URL | DOM hint |
|-----------|-----|----------|
| 加密货币资金流 (BTC, 6 values) | https://coinank.com/zh/fund/fundSwap | JS-rendered SPA. Use Playwright MCP: navigate → wait 4s → `browser_evaluate` to extract BTC row cells (fastest), OR save snapshot to file + Grep. Extract: (1) 15m (2) 4h (3) 7D (4) 30D (5) 市值 (6) 资金信号. See Section 9 for exact pattern. |

---

## 3. DOM Extraction Patterns

### Pattern A — MacroMicro Sidebar (used by 3 indicators)

Same HTML structure on every macromicro.me chart page. Locate:
```html
<div class="sidebar-sec chart-stat-lastrows">
  <ul>
    <li>
      <div class="stat-name"><a>INDICATOR NAME</a></div>
      <div class="date-label">2026-05-22</div>
      <div class="stat-val"><span class="val">VALUE</span><span class="unit">%</span></div>
      <div class="prev-val"><span class="val">PREV</span><span class="unit">%</span></div>
    </li>
    <!-- more li items... -->
  </ul>
</div>
```

**Selectors:**
- Current value: `div.sidebar-sec.chart-stat-lastrows li:nth-child(N) .stat-val .val`
- Previous value: `div.sidebar-sec.chart-stat-lastrows li:nth-child(N) .prev-val .val`

| Page | li[0] | li[1] |
|------|-------|-------|
| CNN Fear & Greed (chart 50108) | CNN F&G current + prev | S&P 500 current + prev |
| MM Bull/Bear (chart 142681) | MM Bull/Bear current + prev | S&P 500 current + prev |
| AAII 牛熊 (chart 77072) | 看多 current + prev | 看空 current + prev |

---

### Pattern B — SOFR Table (newyorkfed.org)

Angular app — `table.p-datatable-table`. First `tbody tr` = latest date.

```html
<tbody class="p-datatable-tbody">
  <tr>  <!-- row 0 = most recent date -->
    <td><span>05/21</span></td>  <!-- [0] DATE -->
    <td>3.51</td>                <!-- [1] RATE (%) -->
    <td>3.48</td>                <!-- [2] 1ST PERCENTILE -->
    <td>3.51</td>                <!-- [3] 25TH PERCENTILE -->
    <td>3.55</td>                <!-- [4] 75TH PERCENTILE -->
    <td>3.62</td>                <!-- [5] 99TH PERCENTILE -->
    <td>3,077</td>               <!-- [6] VOLUME ($Billions) -->
  </tr>
```

**Selector:** `table.p-datatable-table tbody tr:first-child td` → indices 0–6

---

### Pattern C — Canada 5Y GOC & CMB (canadaici.com)

Dynamic widget. The page has two sections: **GOC Yields** first, then **CMB**. All yield links share the same selector class, so index matters critically:

```
querySelectorAll('div.widgetTableCell.field3.col3 a')
  [0] → GOC 5-Year  (e.g. 3.19%)
  [1] → GOC 10-Year
  [2] → CMB 5-Year  (e.g. 3.32%)  ← this is what you want for Canada 5Y CMB
  [3] → CMB 10-Year
  [4] → CORRA 1-Month
  [5] → CORRA 3-Month
  [6] → Prime Rate
  [7] → Next BoC announcement
```

To extract with section context use `browser_evaluate` with `.closest('.Section')` and `.closest('.TableRow')` for prev/BPS values.

> ⚠️ The Bank of Canada API (`V80691335`) returns conventional 5-year **mortgage rate** (~6%), NOT the CMB yield (~3%). Do not substitute.
> ⚠️ Using index [0] alone returns GOC, not CMB — always use index [2] for CMB.

---

## 4. NAAIM — 4-Value Calculation

Source: https://www.naaim.org/programs/naaim-exposure-index/ (auto-fetchable ✓)

Ask WebFetch to extract the **full historical weekly table** (need at least 5 rows).

```
Example table rows:
  05/20/2026: 82.02
  05/13/2026: 77.34
  05/06/2026: 96.67
  04/29/2026: 93.79
  04/22/2026: 94.15
```

Calculate:
```
4W MA (当前) = (row1 + row2 + row3 + row4) / 4   = (82.02+77.34+96.67+93.79)/4 = 87.46
4W MA (前值) = (row2 + row3 + row4 + row5) / 4   = (77.34+96.67+93.79+94.15)/4 = 90.49
```

The page does **not** publish a separate MA column — always compute it from the raw table.

---

> Sections 5–8（幻灯片结构·冷启动工作流·CNN F&G 标签·已知陷阱）已移至 `cold_start_lessons.md`，仅调试时读取。

## 9. Playwright MCP — Fetch Patterns for Blocked Sources

The `playwright` MCP server is registered at user scope and runs `npx @playwright/mcp@latest`.
It provides a real Chromium browser, bypassing 403 blocks and JS-rendering issues.

### Standard tool sequence — 2 calls per source (navigate + evaluate)

```
1. browser_navigate({ url: "https://..." })
2. browser_evaluate({ function: `async () => { /* poll internally, then return JSON */ }` })
```

**Do NOT add a separate `browser_wait_for` call** — the page is already loading after navigate, and the evaluate polls internally for the target element (pattern below). This cuts one round-trip (and one snapshot-laden tool response) per source. **Never** use `browser_snapshot` — it dumps the full accessibility tree.

The internal-poll idiom (reused by every pattern below):
```js
async () => {
  for (let i = 0; i < 20; i++) {               // up to ~4s; bump to 30 (~6s) for slow SPAs
    if (/* target element has a non-empty value */) break;
    await new Promise(r => setTimeout(r, 200));
  }
  return /* extracted JSON */;
}
```

> **Fallback (only if evaluate returns empty):** older MCP builds may reject `async` functions. If the first evaluate comes back empty, run `browser_wait_for({ time: 3 })` once, then re-run a plain `() => {...}` (sync) version of the same evaluate.

### Per-source patterns

**MacroMicro (CNN F&G · MM Bull/Bear · AAII)** — all three use the same `browser_evaluate` pattern (verified 2026-06-09):
```
browser_navigate({ url: "<macromicro chart URL>" })
browser_wait_for({ time: 2 })                ← 2s is sufficient; macromicro loads in ~1.5s
browser_evaluate({
  function: `() => {
    const rows = document.querySelectorAll('div.sidebar-sec.chart-stat-lastrows li');
    return [...rows].map((li, i) => ({
      index:   i,
      name:    li.querySelector('.stat-name a')?.innerText?.trim(),
      date:    li.querySelector('.date-label')?.innerText?.trim(),
      current: li.querySelector('.stat-val .val')?.innerText?.trim(),
      prev:    li.querySelector('.prev-val .val')?.innerText?.trim(),
    }));
  }`
})
```
Returns clean JSON array. Index mapping per page:
| Page | li[0] | li[1] |
|------|-------|-------|
| CNN F&G (chart 50108) | CNN F&G current+prev | S&P 500 current+prev |
| MM Bull/Bear (chart 142681) | MM Bull/Bear current+prev | S&P 500 current+prev |
| AAII (chart 77072) | 看多 current+prev | 看空 current+prev |

Do NOT use `browser_snapshot` for macromicro — it dumps the full accessibility tree (hundreds of lines) into context; `browser_evaluate` returns ~300 bytes of structured JSON.

**SOFR** — auto-fetched via NY Fed JSON API inside the script. No Playwright needed.

**Canada 5Y GOC + CMB** (canadaici.com — JS widget) — one navigate, one evaluate, both values (verified 2026-06-09):
```
browser_navigate({ url: "https://www.canadaici.com/market-data/" })
browser_wait_for({ time: 4 })               ← widget is slow; 4s needed
browser_evaluate({
  function: `() => {
    const links = document.querySelectorAll('div.widgetTableCell.field3.col3 a');
    const bps   = el => el?.closest('.TableRow')?.querySelector('.widgetTableCell.field4')?.innerText?.trim();
    return {
      goc5y: { value: links[0]?.innerText?.trim(), prev: bps(links[0]) },
      cmb5y: { value: links[2]?.innerText?.trim(), prev: bps(links[2]) },
    };
  }`
})
```
Returns `{ goc5y: { value: "3.23%", prev: "3.19%" }, cmb5y: { value: "3.38%", prev: "3.35%" } }`.
`field4` column contains the previous day's value. Compute dir by comparing value vs prev.

**加密货币资金流 — BTC row (coinank.com SPA)**:

> **Performance note**: The full accessibility tree for this SPA is 2000+ lines. Use
> `browser_evaluate` (preferred) to extract only the BTC row cells in one JS call,
> avoiding snapshot generation entirely. Fallback: save snapshot to file + Grep.

**Preferred — `browser_evaluate` (fastest, ~1s after wait):**
```
browser_navigate({ url: "https://coinank.com/zh/fund/fundSwap" })
browser_wait_for({ time: 4 })                ← unit: seconds; SPA needs ~4s to render table
browser_evaluate({
  expression: `(() => {
    const rows = [...document.querySelectorAll('tr')];
    const btcRow = rows.find(r => r.cells[0] && r.cells[0].textContent.trim().startsWith('BTC'));
    if (!btcRow) return null;
    return [...btcRow.cells].map(c => c.textContent.replace(/\\s+/g, ' ').trim());
  })()`
})
→ Returns an array of cell strings. Column index map (0-based):
  [0]  货币        — "BTC BTC"    (skip)
  [1]  5m          — skip
  [2]  15m         ← extract (dir: positive='up', negative='down')
  [3]  1h          — skip
  [4]  2h          — skip
  [5]  4h          ← extract
  [6]  6h          — skip
  [7]  8h          — skip
  [8]  1D          — skip
  [9]  7D          ← extract
  [10] 30D         ← extract
  [11] 市值($)     ← extract (dir: always 'neutral')
  [12] 资金信号     ← extract (e.g. "-10 流向均衡"; dir by sign: negative='down', positive='up')
```

**Fallback — snapshot to file + Grep (if browser_evaluate fails):**
```
browser_navigate({ url: "https://coinank.com/zh/fund/fundSwap" })
browser_wait_for({ time: 4 })
browser_snapshot({ filename: "coinank_snapshot.md" })   ← MUST use filename; do NOT inline
→ Then: Grep pattern "BTC BTC" on the saved file to extract the row string.
  Row format: "BTC BTC <5m> <15m> <1h> <2h> <4h> <6h> <8h> <1D> <7D> <30D> <市值> <信号>"
  Use the same column index map above.
```

### If Playwright also fails
CAPTCHA or login wall → mark the indicator `N/A`, continue to PPT generation.
Do **not** stop execution to ask the user for DOM paste.
