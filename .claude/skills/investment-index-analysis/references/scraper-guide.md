# Scraper Guide — Sub-agent A (manual indicator fetch)

> **You are Sub-agent A.** Your only job: fetch the 7 JS-rendered / manual indicators that have no
> free JSON API, then write them to `E:\CC项目\scraped-indicators.json`. The 10 API indicators are
> fetched separately by `fetch_market_data.js` — you do NOT touch them.
>
> This is the **single source of truth** for URLs and DOM selectors. Read it fully before fetching.

---

## 0. Workflow (do these in order)

1. **Load Playwright tools.** `ToolSearch({ query: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate", max_results: 2 })`. (The `browser_evaluate` schema uses the **`function`** parameter, not `expression`.)
2. Fetch the 5 Playwright sources — **strictly 2 calls each** (`browser_navigate` → `browser_evaluate`). Never `browser_snapshot`. Never an extra `browser_wait_for` (the evaluate polls internally).
3. WebFetch NAAIM and compute the 4-week moving averages.
4. Write `E:\CC项目\scraped-indicators.json` with all keys you obtained + `generatedAt` = today (`YYYY-MM-DD`).
5. Return **one line only**: `OK: N/7 keys written (failed: <comma-list or none>)`.

**Failure policy (critical):** if a source returns a CAPTCHA / login wall / empty result, **omit that key
entirely** from the JSON. Do **not** fabricate a value, do **not** carry forward an old value (the
downstream `fetch_market_data.js` handles carry-forward), do **not** stop to ask the user for a DOM
paste, do **not** abort the run. Just leave the key out and note it in the failed-list.

**Browser lifecycle:** your first `browser_navigate` (re)creates the page on demand — it works whether
or not a previous skill run in this session left the browser open, so **do not assume a clean slate and
do not try to reset it**. **Do NOT call `browser_close`** — Sub-agent B reuses this same browser after
you and owns teardown. Navigations reuse the one tab, so they don't accumulate.

---

## 1. The 7 keys you produce

| Key | Source | Method | Output shape |
|-----|--------|--------|--------------|
| `fundFlow` | coinank.com | Playwright | `{ items:[{label,value,dir}×6], date }` |
| `cnnFG` | macromicro 50108 | Playwright | `{ value, change, dir, date }` |
| `mm` | macromicro 142681 | Playwright | `{ mmCurrent, mmPrev, sp500Current, sp500Prev, date }` |
| `aaii` | macromicro 77072 | Playwright | `{ bullCurrent, bullPrev, bearCurrent, bearPrev, date }` |
| `naaim` | naaim.org | WebFetch | `{ current, prev, ma4w, ma4wPrev, date }` |
| `ca5yGoc` | canadaici.com `[0]` | Playwright | `{ value, change, dir, date }` |
| `ca5yCmb` | canadaici.com `[2]` | Playwright | `{ value, change, dir, date }` |

Shapes must match exactly — `fetch_market_data.js` copies them verbatim into `market-index.json`,
and the renderer reads these field names directly.

---

## 2. Playwright discipline — 2 calls per source

```
1. browser_navigate({ url: "https://..." })
2. browser_evaluate({ function: `async () => { /* poll internally, then return JSON */ }` })
```

**Do NOT** add a separate `browser_wait_for` — the evaluate polls internally. **Never** use
`browser_snapshot` (it dumps the full accessibility tree — thousands of lines into context).

Internal-poll idiom (reused everywhere):
```js
async () => {
  for (let i = 0; i < 30; i++) {                 // ~6s max for slow SPAs
    if (/* target element has a non-empty value */) break;
    await new Promise(r => setTimeout(r, 200));
  }
  return /* extracted JSON */;
}
```
> **Fallback** (only if evaluate returns empty): older MCP builds reject `async` functions. Run
> `browser_wait_for({ time: 3 })` once, then re-run a plain `() => {...}` (sync) version.

⚡ **Hard cap: ≤2 evaluate attempts per source** (the documented one + the single fallback). Do **not**
iterate on selectors, re-navigate, or "debug" a page — if it's still empty after the fallback, **omit
that key and move to the next source**. Tweaking selectors mid-run is the main source of wasted calls
and wall-time; the selectors here are verified, so an empty result means the source is blocked, not
that the selector is wrong.

---

## 3. Per-source patterns

### MacroMicro — CNN F&G (50108) · MM Bull/Bear (142681) · AAII (77072)

All three pages share one DOM structure. Same evaluate for all:
```
browser_navigate({ url: "<macromicro chart URL>" })
browser_evaluate({
  function: `async () => {
    for (let i=0;i<20;i++){ if(document.querySelector('div.sidebar-sec.chart-stat-lastrows li .stat-val .val')) break; await new Promise(r=>setTimeout(r,200)); }
    const rows = document.querySelectorAll('div.sidebar-sec.chart-stat-lastrows li');
    return [...rows].map((li,i)=>({
      index:i,
      name:    li.querySelector('.stat-name a')?.innerText?.trim(),
      date:    li.querySelector('.date-label')?.innerText?.trim(),
      current: li.querySelector('.stat-val .val')?.innerText?.trim(),
      prev:    li.querySelector('.prev-val .val')?.innerText?.trim(),
    }));
  }`
})
```

URLs + index mapping:
| Key | URL | li[0] | li[1] |
|-----|-----|-------|-------|
| `cnnFG` | https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed | CNN F&G current+prev | S&P 500 (ignore) |
| `mm` | https://en.macromicro.me/collections/34/us-stock-relative/142681/us-mm-bull-and-bear-indicator | MM Bull/Bear current+prev | S&P 500 current+prev |
| `aaii` | https://sc.macromicro.me/charts/77072/AAII-niu-xiong-yu-biao-pu-500-guan-xi | 看多 current+prev | 看空 current+prev |

Build the output shapes:
- `cnnFG` = `{ value: li0.current, change: "prev <li0.prev> • <CNN_LABEL(current)>", dir: current>=prev?'up':'down', date: li0.date }`
- `mm`    = `{ mmCurrent: li0.current, mmPrev: li0.prev, sp500Current: li1.current, sp500Prev: li1.prev, date: li0.date }`
- `aaii`  = `{ bullCurrent: li0.current, bullPrev: li0.prev, bearCurrent: li1.current, bearPrev: li1.prev, date: li0.date }`

Normalize `date` to a short display like `Jun 10` (the renderer just prints it). AAII/MM dates are weekly.

### canadaici.com — Canada 5Y GOC `[0]` + CMB `[2]` (one navigate, one evaluate)

```
browser_navigate({ url: "https://www.canadaici.com/market-data/" })
browser_evaluate({
  function: `async () => {
    for (let i=0;i<30;i++){ if(document.querySelectorAll('div.widgetTableCell.field3.col3 a').length>=3) break; await new Promise(r=>setTimeout(r,200)); }
    const links = document.querySelectorAll('div.widgetTableCell.field3.col3 a');
    const prevOf = el => el?.closest('.TableRow')?.querySelector('.widgetTableCell.field4')?.innerText?.trim();
    return { goc5y:{value:links[0]?.innerText?.trim(), prev:prevOf(links[0])},
             cmb5y:{value:links[2]?.innerText?.trim(), prev:prevOf(links[2])} };
  }`
})
```
⚠️ **Index matters.** `[0]` = GOC 5Y, `[2]` = CMB 5Y. Page order: GOC5Y[0] · GOC10Y[1] · CMB5Y[2] · CMB10Y[3].
Using `[0]` for CMB is the classic mistake — it returns GOC. The Bank of Canada API (`V80691335`)
returns the conventional **mortgage** rate (~6%), NOT the CMB yield (~3.3%) — never substitute it.

Build (compute bps from value − prev, rounded; sign drives `dir`):
- `ca5yGoc` = `{ value: goc5y.value, change: "prev <goc5y.prev> • <±N> bps", dir: value<prev?'down':value>prev?'up':'neutral', date: <today short, e.g. Jun 10> }`
- `ca5yCmb` = same from `cmb5y`.

### coinank.com — 加密货币资金流 BTC row

```
browser_navigate({ url: "https://coinank.com/zh/fund/fundSwap" })
browser_evaluate({
  function: `async () => {
    let btc=null;
    for (let i=0;i<30;i++){
      const rows=[...document.querySelectorAll('tr')];
      btc=rows.find(r=>r.cells[0] && r.cells[0].textContent.trim().startsWith('BTC'));
      if(btc) break; await new Promise(r=>setTimeout(r,200));
    }
    if(!btc) return null;
    return [...btc.cells].map(c=>c.textContent.replace(/\\s+/g,' ').trim());
  }`
})
```
Column index map (0-based) — extract only these 6:
```
[2]  15m       → label '15m'
[5]  4h        → label '4h'
[9]  7D        → label '7D'
[10] 30D       → label '30D'
[11] 市值($)   → label '市值($)'   (dir always 'neutral')
[12] 资金信号  → label '资金信号'
```
`dir`: value starting with `-` → `'down'`, otherwise `'up'`; 市值($) → always `'neutral'`.
Output: `fundFlow = { items: [ {label:'15m',value,dir}, {label:'4h',...}, {label:'7D',...}, {label:'30D',...}, {label:'市值($)',value,dir:'neutral'}, {label:'资金信号',value,dir} ], date: '<today short, e.g. Jun 11>' }`.

> **fundFlow is the only high-frequency indicator** — 15m / 4h / 资金信号 can flip within hours.
> Always fetch it fresh; it's the most time-sensitive of the 7.

---

## 4. NAAIM — WebFetch + 4-week MA computation

```
WebFetch(url="https://www.naaim.org/programs/naaim-exposure-index/",
         prompt="Extract the weekly NAAIM Exposure Index table — at least the 5 most recent rows, each as DATE: VALUE. No commentary.")
```
You get rows like:
```
06/03/2026: 86.82
05/27/2026: 98.39
05/20/2026: 82.02
05/13/2026: 77.34
05/06/2026: 96.67
```
Compute (the page has **no** MA column — always compute it):
```
current  = row1.value
prev     = row2.value
ma4w     = (row1+row2+row3+row4)/4
ma4wPrev = (row2+row3+row4+row5)/4
date     = row1.date            // keep MM/DD/YYYY form
```
Output: `naaim = { current, prev, ma4w, ma4wPrev, date }` (values as strings, MAs to 2 decimals).

---

## 5. CNN Fear & Greed — sentiment label bands

| Value | Label |
|-------|-------|
| 0–24 | Extreme Fear |
| 25–44 | Fear |
| 45–54 | Neutral |
| 55–74 | Greed |
| 75–100 | Extreme Greed |

---

## 6. Output file — `scraped-indicators.json`

Write to `E:\CC项目\scraped-indicators.json` (use an absolute path). Include `generatedAt` = today
in `YYYY-MM-DD`, plus every key you successfully fetched. Omit keys you failed to fetch.

```json
{
  "generatedAt": "2026-06-11",
  "fundFlow": { "items": [ { "label": "15m", "value": "3.34亿", "dir": "up" }, "...6 total..." ], "date": "Jun 11" },
  "cnnFG":   { "value": "27.46", "change": "prev 32.49 • Fear", "dir": "down", "date": "Jun 10" },
  "mm":      { "mmCurrent": "72.12", "mmPrev": "71.08", "sp500Current": "7,266.99", "sp500Prev": "7,386.65", "date": "May 2026" },
  "aaii":    { "bullCurrent": "36.26%", "bullPrev": "35.56%", "bearCurrent": "37.00%", "bearPrev": "41.85%", "date": "Jun 4" },
  "naaim":   { "current": "86.82", "prev": "98.39", "ma4w": "86.14", "ma4wPrev": "88.61", "date": "06/03/2026" },
  "ca5yGoc": { "value": "3.20%", "change": "prev 3.23% • -3 bps", "dir": "down", "date": "Jun 10" },
  "ca5yCmb": { "value": "3.35%", "change": "prev 3.38% • -3 bps", "dir": "down", "date": "Jun 10" }
}
```

Self-check before returning:
```
node -e "const o=JSON.parse(require('fs').readFileSync('E:/CC项目/scraped-indicators.json','utf8')); console.log('keys:', Object.keys(o).filter(k=>k!=='generatedAt').length, 'generatedAt:', o.generatedAt)"
```

Then return one line: `OK: N/7 keys written (failed: <list|none>)`.

---

## 7. Known blocks (do not waste calls on these)

- `www.cnn.com/markets/fear-and-greed` → 451 (use macromicro 50108)
- `www.cnbc.com/quotes/.VIX`, `fred.stlouisfed.org`, `www.wsj.com`, `www.marketwatch.com`,
  `www.aaii.com/sentimentsurvey`, `api.aaii.com/sentiment` → blocked/empty
- Bank of Canada `V80691335` API → mortgage rate, not CMB yield
- All `macromicro.me` URLs → 403 to plain WebFetch; only Playwright works
