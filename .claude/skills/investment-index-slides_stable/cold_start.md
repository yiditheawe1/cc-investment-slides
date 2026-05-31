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
| Canada 5Y CMB | https://www.canadaici.com/market-data/ | `div.widgetTableCell.field3.col3 a` → e.g. `3.34%` |

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

### Pattern C — Canada 5Y CMB (canadaici.com)

Dynamic widget — value in:
```html
<div class="widgetTableCell field3 col3 down material-symbols-outlined" ...>
  <a ...>3.34%</a>   <!-- ← this is the CMB yield -->
</div>
```

**Selector:** `div.widgetTableCell.field3.col3 a`

> ⚠️ The Bank of Canada API (`V80691335`) returns conventional 5-year **mortgage rate** (~6%), NOT the CMB yield (~3%). Do not substitute.

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

## 5. Slide Structure & Card Layout

```
Slide 0: Cover
Slide 1: CRYPTO  — gcell(2, 2)  → 2×2 grid, 4 cards
Slide 2: STOCK   — gcell(3, 2)  → 3×2 grid, 6 slots
  Row 0: Fear&Greed | VIX | MM Bull/Bear
  Row 1: SOFR      | AAII 牛熊  | NAAIM
Slide 3: 利率     — gcell(3, 1)  → 3×1 row, 3 cards
Slide 4: Forex    — gcell(3, 1)  → 3×1 row, 3 cards
```

### Card Data Object (standard `addCard`)
```js
{ nm: 'Label',   // indicator name (slate 10pt)
  val: '58.57',  // main value (white bold; auto-sizes font for long strings)
  lbl: 'Greed',  // sentiment label (teal italic) — optional
  sub: 'prev 58.06 • Greed',  // change / sub line — optional
  pos: true,     // true=green, false=red, null=muted gray
  dt:  'May 22', // as-of date shown bottom-right — optional
}
```

### Special Cards
| Card | Function | Data shape |
|------|----------|-----------|
| Fund Flow | `addFundFlowCard(s,pr,x,y,w,h,d)` | `{ date, items:[{label,value,dir}×6] }` — 3×2 grid, 13pt bold, color by dir |
| NAAIM | `addNaaimCard(s,pr,x,y,w,h,d)` | `{ current, prev, ma4w, ma4wPrev, date }` |
| SOFR | `addSofrCard(s,pr,x,y,w,h,d)` | `{ date, cells:[{label,value}×6] }` — 3×2 grid |
| MM Bull/Bear | `addQuadCard(s,pr,x,y,w,h,cfg)` | `{ title, tl, tr, bl, br, note }` |
| AAII | `addQuadCard(s,pr,x,y,w,h,cfg)` | same as MM |

### Color Palette (`C` object — no `#` prefix)
```js
const C = {
  bg:'0F172A', card:'1E293B', white:'FFFFFF', slate:'94A3B8',
  teal:'0D9488', green:'22C55E', red:'EF4444', div:'2D3F55',
  muted:'64748B', amber:'F59E0B', blue:'3B82F6',
  purple:'8B5CF6', emerald:'10B981',
};
```

### Category Accent Colors
| Slide | Accent |
|-------|--------|
| CRYPTO | `C.amber` — #F59E0B |
| STOCK | `C.blue` — #3B82F6 |
| 利率 | `C.purple` — #8B5CF6 |
| Forex | `C.emerald` — #10B981 |

---

## 6. Recommended Cold-Start Workflow

**The script is self-contained — 10 APIs are fetched automatically at run time.**
Only 6 Playwright/manual indicators need updating in `LIVE_MANUAL` before each run.

**Step 1 — WebFetch NAAIM:**
```
WebFetch → https://www.naaim.org/programs/naaim-exposure-index/
Extract ≥5 weekly rows, compute 4W MAs (see Section 4).
```

**Step 2 — Playwright MCP for the 5 JS-rendered sources:**
The `playwright` MCP server is installed at user scope (`npx @playwright/mcp@latest`).
Use `browser_navigate` → `browser_wait_for` → `browser_snapshot({ target: "main" })`.
Fetch in sequence (Playwright is stateful — one browser tab at a time):
1. CNN F&G → https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed
2. MM Bull/Bear → https://en.macromicro.me/collections/34/us-stock-relative/142681/us-mm-bull-and-bear-indicator
3. AAII → https://sc.macromicro.me/charts/77072/AAII-niu-xiong-yu-biao-pu-500-guan-xi
4. Canada 5Y CMB → https://www.canadaici.com/market-data/
5. 加密货币资金流 (BTC) → https://coinank.com/zh/fund/fundSwap

If Playwright also fails (CAPTCHA / login wall), mark N/A and continue — do NOT ask the user for DOM paste.

**Step 3 — Edit `LIVE_MANUAL` (6 keys), then run:**

After Steps 1–2, edit only these keys in `generate_investment_index_slides.js`:

```
cnnFG    → { value, change, dir, date }
mm       → { mmCurrent, mmPrev, sp500Current, sp500Prev, date }
aaii     → { bullCurrent, bullPrev, bearCurrent, bearPrev, date }
naaim    → { current, prev, ma4w, ma4wPrev, date }
ca5yCmb  → { value, change, dir, date }
fundFlow → { date, items: [{label, value, dir}×6] }
           labels: '15m' | '4h' | '7D' | '30D' | '市值($)' | '资金信号'
           dir: 'up' (positive) | 'down' (negative) | 'neutral' (市值)
```

Then run — it fetches the 10 APIs and generates the PPTX in one shot:
```bash
cd "e:\CC项目" && node generate_investment_index_slides.js
```

The script prints `API: X/10 fetched` then `SUCCESS: investment-index-slides_YYYY_MM_DD.pptx`.

> `fetch_live_data.js` is now obsolete — the API logic lives inside the main script.
> Do NOT run `fetch_live_data.js` or use it to patch the LIVE block.

---

## 7. CNN Fear & Greed — Sentiment Label Lookup

| Value range | Label |
|-------------|-------|
| 0–24 | Extreme Fear |
| 25–44 | Fear |
| 45–54 | Neutral |
| 55–74 | Greed |
| 75–100 | Extreme Greed |

---

## 8. Known Pitfalls Summary

| Pitfall | What Happened | Fix |
|---------|--------------|-----|
| Rewrote script from scratch | `generate_investment_index_slides.js` already exists on disk; rewrote 250 lines + first run failed on require path → ~3 min wasted | Read the existing file, edit only the LIVE block |
| CNBC blocked | cnbc.com returns 403 for VIX and treasury quotes | Use Yahoo Finance instead |
| CNN blocked | cnn.com/markets/fear-and-greed returns 451 | Use macromicro.me chart 50108 via Playwright MCP |
| Bank of Canada API returns wrong value | V80691335 series = conventional mortgage ~6%, not CMB ~3.34% | Only use canadaici.com via Playwright MCP |
| macromicro.me always 403 to WebFetch | All macromicro.me and sc.macromicro.me URLs blocked for plain HTTP | Use Playwright MCP — do not ask user for DOM paste |
| SOFR FRED also 403 | fred.stlouisfed.org also blocked | Use NY Fed via Playwright MCP |
| aaii.com returns empty | aaii.com/sentimentsurvey serves blank body to WebFetch | Use macromicro.me chart 77072 via Playwright MCP |
| canadaici.com page dynamic | WebFetch gets no data | Use Playwright MCP for `div.widgetTableCell.field3.col3 a` |
| coinank.com dynamic | WebFetch gets no usable data | Use Playwright MCP: navigate → wait 4s → `browser_evaluate` (preferred, ~2× faster) or `browser_snapshot({ filename: "coinank_snapshot.md" })` + Grep for `BTC BTC` row |
| coinank snapshot too large to inline | Full `browser_snapshot()` returns 2000+ lines — floods context and slows parsing | Always pass `filename: "coinank_snapshot.md"` to save to file, then `Grep pattern: "BTC BTC"` to extract just the row; or use `browser_evaluate` to skip the snapshot entirely |
| pptxgenjs `#` in colors | Silently ignored, colors not applied | Strip `#` from all hex strings |
| pptxgenjs `line.width` | Should be `line.pt` | Use `pt` for line thickness |
| Hardcoded filename | Previous versions had hardcoded date | Always compute filename dynamically from `new Date()` UTC |
| Old require path | `require(".claude/...")` or `require("./.claude/...")` fails on Windows with Chinese-character paths | Use `require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'))` |
| Stopped mid-run to ask for DOM paste | After auto-fetching, paused execution to request blocked-source DOM from user → no PPT generated | Always generate PPT immediately with N/A for blocked sources; offer Playwright fetch or DOM paste only after file is confirmed created |
| SOFR: browser_wait_for text timeout | Used `browser_wait_for({ text: "SOFR" })` — the word "SOFR" appears in a hidden nav link before the data table renders, causing a 30s TimeoutError | Use `browser_wait_for({ time: 4 })` (fixed delay), then `browser_snapshot({ target: "table" })` |
| MacroMicro: stale element ref crash | Used `browser_snapshot({ target: "generic[ref=e178]" })` — ref was copied from the previous page's snapshot and doesn't exist on the new page | Never reuse element refs across page navigations; always use semantic targets like `"main"` |
| MacroMicro: depth-limited snapshot too shallow | Used `browser_snapshot({ depth: 4 })` — collapses the stats block and makes values invisible | Use `browser_snapshot({ target: "main" })` for focused but complete content |

---

## 9. Playwright MCP — Fetch Patterns for Blocked Sources

The `playwright` MCP server is registered at user scope and runs `npx @playwright/mcp@latest`.
It provides a real Chromium browser, bypassing 403 blocks and JS-rendering issues.

### Standard tool sequence

```
1. browser_navigate({ url: "https://..." })
2. browser_wait_for({ time: 3 })             ← wait 3s — unit is SECONDS, not ms (3000 is wrong)
3. browser_snapshot()                         ← returns accessibility tree as structured text
4. Parse values from snapshot text
```

If the snapshot is empty or the key element is missing, try `browser_wait_for({ selector: "<css>" })` instead of the fixed 3s wait.

### Per-source patterns

**MacroMicro (CNN F&G · MM Bull/Bear · AAII)** — all three follow the same pattern:
```
browser_navigate({ url: "<macromicro chart URL>" })
browser_wait_for({ time: 3 })                ← wait 3 seconds (not 3000 — unit is seconds, not ms)
browser_snapshot({ target: "main" })         ← always target "main"; do NOT use depth-limited
                                               snapshots (depth: 4 collapses too much and hides
                                               the stats block); do NOT use element refs from a
                                               previous page's snapshot (refs don't transfer across
                                               page navigations and will throw "does not match")
→ Look for the "Latest Stats" / "最新数据" section inside main
  Pattern A DOM:  li[0] = first indicator, li[1] = second indicator
  For each li:    current value in generic[ref=eN87] text, prev in generic[ref=eN88] "Prev: X"
                  date shown in generic[ref=eN86] beside the series link
```

**SOFR** (newyorkfed.org — Angular table):
```
browser_navigate({ url: "https://www.newyorkfed.org/markets/reference-rates/sofr" })
browser_wait_for({ time: 4 })                ← do NOT use browser_wait_for({ text: "SOFR" }) —
                                               the word "SOFR" exists in hidden nav elements
                                               before the data table loads, causing a 30s timeout
browser_snapshot({ target: "table" })        ← target the table directly; cleaner than full snapshot
→ First data row: DATE · RATE · 1st%ile · 25th%ile · 75th%ile · 99th%ile · Vol($B)
```

**Canada 5Y CMB** (canadaici.com — JS widget):
```
browser_navigate({ url: "https://www.canadaici.com/market-data/" })
browser_wait_for({ time: 4 })               ← widget is slow to load (unit: seconds)
browser_snapshot()
→ Find the CMB yield cell — value looks like "3.34%" near "Canada 5 Year"
  CSS selector reference: div.widgetTableCell.field3.col3 a
```

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
