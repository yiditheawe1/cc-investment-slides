# investment-index-slides Skill

Generate a market indicators PowerPoint presentation with live data fetched from financial URLs.

## Trigger

Use this skill when asked to:
- Generate / update the investment index slides
- Create a market indicators PPT / presentation
- Refresh the investment dashboard

## Data Sources

**Single source of truth: `indicators.md`** (same directory as this file).

That file defines every indicator's name, primary fetch URL, fallback URLs, and DOM extraction hints.
Do not use any URL that is not listed in `indicators.md`. Do not invent or substitute URLs.

---

## Execution Steps

### Step 0 — Read cold_start.md  ← DO THIS FIRST, EVERY TIME

Read `.claude/skills/investment-index-slides/cold_start.md` in full before doing anything else.

It contains:
- Which URLs are blocked to plain WebFetch and must use the **`playwright` MCP server** instead
- Confirmed working fallback URLs for VIX, US 10Y/30Y, and S&P 500
- The correct pptxgenjs `require` path for Windows
- NAAIM 4W MA calculation method
- Playwright MCP fetch patterns for each blocked source (Section 9)
- All known pitfalls that caused wasted time in past sessions

**If you skip this step, you will repeat the same mistakes: ~8 wasted WebFetch calls on known-403 URLs.**

### Step 1 — Read indicators.md

After reading `cold_start.md`, read `.claude/skills/investment-index-slides/indicators.md` in full.

From it, extract for each indicator:
- **Category** (CRYPTO / STOCK / 利率 / Forex)
- **Indicator name**
- **Primary URL** — the first `https://…` link in that row
- **Fallback URLs** — any additional `https://…` links in that row (try only if primary fails)
- **DOM hints** — any CSS selectors, HTML snippets, or extraction notes in that row

Use only URLs and DOM selectors found in `indicators.md`. If an indicator has no usable URL, mark it `N/A`.

### Step 2 — Fetch live data

Use the WebFetch tool on each URL found in `indicators.md`. For each indicator extract:
- **Current value** (number, percentage, or index level)
- **Change / trend** (up/down, day change, or sentiment label if available)
- **As-of date or time** (if shown on the page)

Fetch all URLs in parallel using WebFetch. If a URL returns 403 or no parseable value:
1. Try its fallback URL (if any in `indicators.md`)
2. If still blocked, **use the `playwright` MCP server** — see `cold_start.md` Section 9 for the exact `browser_navigate` + `browser_snapshot` sequence per source
3. Only mark `N/A` if Playwright also fails (CAPTCHA / login wall)

**Never stop mid-run to ask the user for DOM paste — generate the PPT first, then offer to fill gaps.**

#### Parsing rules by indicator type (apply DOM hints from indicators.md)

**MacroMicro sidebar pattern** — applies to any indicator whose `indicators.md` row references a `div.sidebar-sec.chart-stat-lastrows` DOM hint:
- `li:nth-child(N) .stat-val .val` → current value
- `li:nth-child(N) .prev-val .val` → previous value
- `li:nth-child(N) .date-label` → date

**CNN Fear & Greed**: derive sentiment label from numeric value:
0–24 = Extreme Fear · 25–44 = Fear · 45–54 = Neutral · 55–74 = Greed · 75–100 = Extreme Greed.
Render as a standard card: value = 当前, change line = `"prev <前值> • <label>"`.

**NAAIM (4 values required)** — fetch the URL in `indicators.md` and extract the full weekly historical table:
- **a. 当前值** — most recent week's mean
- **b. 前值** — previous week's mean
- **c. 4W MA 当前** — average of the 4 most recent mean values
- **d. 4W MA 前值** — average of weeks 2–5

**SOFR (6 values required)** — WebFetch returns 403. Use Playwright MCP: `browser_navigate` → `browser_wait_for({ selector: "table" })` → `browser_snapshot`. First tbody row = DATE · RATE · 1st%ile · 25th%ile · 75th%ile · 99th%ile · Vol($B).

**Canada 5Y CMB** — JS-rendered, WebFetch gets no data. Use Playwright MCP: navigate → wait 4s → snapshot. Look for `div.widgetTableCell.field3.col3 a` value (e.g. `3.34%`).

**MM Bull/Bear (4 values)** — WebFetch returns 403. Use Playwright MCP with macromicro.me URL. If Playwright also fails, use the S&P 500 Yahoo Finance fallback for sp500Current/sp500Prev only; set mm values to N/A.

**AAII (4 values)** — WebFetch returns 403. Use Playwright MCP with sc.macromicro.me URL. li[0] = 看多, li[1] = 看空. If Playwright also fails, mark N/A.

**加密货币资金流 — BTC Fund Flow (6 values)** — WebFetch gets no data. Use Playwright MCP: navigate → wait 4s → snapshot. Save snapshot to file (output is large). Grep for `BTC BTC` row. Column order: 货币 | 5m | 15m | 1h | 2h | 4h | 6h | 8h | 1D | 7D | 30D | 市值($) | 资金信号合约?. Extract: 15m (col 3), 4h (col 6), 7D (col 10), 30D (col 11), 市值($) (col 12), 资金信号合约? (col 13). Dir: positive value = `'up'`, negative = `'down'`, 市值 = `'neutral'`.

### Step 3 — Organize data

Structure the fetched data into four category objects matching the sections in `indicators.md`:

```
CRYPTO   → Fear&Greed, BTC Dominance, ETH/BTC, Fund Flow
STOCK    → Fear&Greed, VIX, MM Bull/Bear, SOFR, AAII, NAAIM
RATES    → US 10Y, US 30Y, Canada 5Y CMB
FOREX    → USD/CAD, USD/CNY, CAD/CNY
```

### Step 4 — Generate PPT using pptxgenjs

Use the pptx skill's pptxgenjs.md reference to write and execute a Node.js script.
Output file: `investment-index-slides.pptx` in the current working directory.

#### Slide structure (5 slides total)

**Slide 0 — Cover**
- Title: "Market Index Dashboard"
- Subtitle: current date (YYYY-MM-DD) + time (HH:MM UTC/local)
- Dark background (#0F172A), white text
- Accent bar in brand teal (#0D9488)

**Slide 1 — CRYPTO**
**Slide 2 — STOCK**
**Slide 3 — 利率 (Rates)**
**Slide 4 — Forex**

#### Per-category slide layout

Each slide must follow this layout:

```
┌─────────────────────────────────────────┐
│  [Category accent bar left edge]        │
│  CATEGORY TITLE          DATE / TIME    │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Indicator│  │ Indicator│  │ ...   │ │
│  │  Value   │  │  Value   │  │       │ │
│  │  +change │  │  label   │  │       │ │
│  └──────────┘  └──────────┘  └───────┘ │
│  (repeat in grid rows as needed)        │
└─────────────────────────────────────────┘
```

- **Layout**: LAYOUT_16x9 (10" × 5.625")
- **Background**: dark navy (#0F172A)
- **Slide title**: white, bold, 28pt, left-aligned, 0.4" from top
- **Date/time**: gray (#94A3B8), 12pt, top-right corner
- **Indicator cards**: white rounded rectangles with subtle shadow
  - Card background: #1E293B
  - Indicator name: slate (#94A3B8), 11pt
  - Value: white, bold, 24pt
  - Change/trend: green (#22C55E) for positive, red (#EF4444) for negative, gray for neutral
  - Sentiment label: teal (#0D9488), italic, 11pt

#### Category accent colors

| Category | Accent color |
|----------|-------------|
| CRYPTO   | #F59E0B (amber) |
| STOCK    | #3B82F6 (blue) |
| 利率      | #8B5CF6 (purple) |
| Forex    | #10B981 (emerald) |

Left edge accent bar: 0.08" wide × full slide height, accent color.

#### Card grid sizing

Distribute cards evenly. Examples:
- 4 indicators → 2×2 grid
- 6 indicators → 3×2 grid
- 3 indicators → 3×1 row

Card dimensions: adjust to fill the slide body (below title, above bottom margin 0.2").
Horizontal padding between cards: 0.15".
Vertical padding between card rows: 0.15".
Outer horizontal margin: 0.4" (after accent bar).

### Step 5 — Update and run the script

1. **Read the existing `generate_slides.js`** first. It persists between runs — do NOT rewrite it from scratch.
   - If it exists: edit only the data values (indicator numbers, dates). The functions and layout are stable.
   - If it does not exist: write it fresh using the template in `cold_start.md` Section 5.
2. Run it with: `node generate_investment_index_slides.js`
   - The script must `require` pptxgenjs using `path.resolve`:
     `const pptxgen = require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));`
3. Output filename must include a date suffix: `investment-index-slides_YYYY_MM_DD.pptx` (e.g. `investment-index-slides_2026_05_25.pptx`). Use the run date (UTC).
4. Verify the file was created.
5. Report the output path and a summary table of all fetched indicator values.

#### Fund Flow card — 3×2 six-value layout

The 加密货币资金流 tile uses a 3-column × 2-row sub-grid. Implement as `addFundFlowCard(slide, pres, x, y, w, h, d)` where `d` is:
```js
{
  date: "May 25",
  items: [
    { label: '15m',      value: '-327.33万',   dir: 'down'    },  // col0, row0
    { label: '4h',       value: '-1.02亿',     dir: 'down'    },  // col1, row0
    { label: '7D',       value: '-2.96亿',     dir: 'down'    },  // col2, row0
    { label: '30D',      value: '+49.96亿',    dir: 'up'      },  // col0, row1
    { label: '市值($)',  value: '15,445.73亿', dir: 'neutral' },  // col1, row1
    { label: '资金信号', value: '+16 均衡',    dir: 'up'      },  // col2, row1
  ],
}
```

```
┌──────────────────────────────────┐
│ 加密货币资金流            May 25 │  slate 10pt + muted 8pt
├──────────┬────────────┬──────────┤  divider #2D3F55
│   15m    │    4h      │    7D    │  label gray 8pt center
│ -327万   │ -1.02亿   │ -2.96亿  │  value 13pt bold, red (down)
├──────────┼────────────┼──────────┤  divider #2D3F55
│   30D    │  市值($)  │ 资金信号  │  label gray 8pt center
│ +49.96亿 │ 15,445亿  │ +16 均衡  │  value 13pt bold: green/slate/green
└──────────┴────────────┴──────────┘
```

All 6 values use identical font (13pt bold). Color by `dir`: `'up'` → green (#22C55E), `'down'` → red (#EF4444), `'neutral'` → slate (#94A3B8). Vertical dividers between all 3 columns, horizontal divider between 2 rows.

#### SOFR card — 3×2 hex-value layout

The SOFR tile uses a 3-column × 2-row sub-grid. Implement as `addSofrCard(slide, x, y, w, h, d)` where `d` is:
```js
{
  date: "2026-05-21",
  cells: [
    { label: "RATE (%)",   value: "3.51%" },  // col0, row0
    { label: "1st %ile",   value: "3.48%" },  // col1, row0
    { label: "25th %ile",  value: "3.51%" },  // col2, row0
    { label: "75th %ile",  value: "3.55%" },  // col0, row1
    { label: "99th %ile",  value: "3.62%" },  // col1, row1
    { label: "Vol ($B)",   value: "3,077"  },  // col2, row1
  ],
}
```

```
┌──────────────────────────────────┐
│ SOFR                  as of DATE │  gray 10pt + muted 8pt
├──────────┬────────────┬──────────┤  divider #2D3F55
│ RATE (%) │ 1st %ile  │ 25th %ile│  label gray 8pt
│ 3.51%    │ 3.48%     │ 3.51%    │  value teal 15pt bold
├──────────┼────────────┼──────────┤  divider #2D3F55
│ 75th %ile│ 99th %ile │ Vol ($B) │
│ 3.55%    │ 3.62%     │ 3,077    │  Vol value white 15pt bold
└──────────┴────────────┴──────────┘
```

Vertical dividers between all 3 columns, horizontal divider between 2 rows.

#### Generic quad-value card — used by NAAIM, MM Bull/Bear, AAII

Three cards share the same 2×2 sub-grid layout. Implement as `addQuadCard(slide, x, y, w, h, cfg)` where `cfg` is:
```js
{
  title: "card title",           // slate 10pt
  topLeft:   { label, value },   // row-1 left  — value white 20pt bold
  topRight:  { label, value },   // row-1 right — value white 20pt bold
  botLeft:   { label, value },   // row-2 left  — value teal  20pt bold
  botRight:  { label, value },   // row-2 right — value teal  20pt bold
  footnote:  "as of YYYY-MM-DD", // bottom-right 8pt muted
}
```

```
┌──────────────────────────────────┐
│ <title>                          │  slate 10pt
├─────────────────┬────────────────┤  divider #2D3F55
│ <topLeft.label> │ <topRight.label>│  slate 9pt
│ <topLeft.value> │ <topRight.value>│  white 20pt bold
├─────────────────┼────────────────┤  divider #2D3F55
│ <botLeft.label> │ <botRight.label>│  slate 9pt
│ <botLeft.value> │ <botRight.value>│  teal  20pt bold
│               <footnote>         │  muted 8pt right-align
└──────────────────────────────────┘
```

#### NAAIM card — special 4-value layout

The NAAIM card in the STOCK slide must display a 2×2 sub-grid instead of a single value:

```
┌──────────────────────────────────┐
│ NAAIM 经理人持仓                  │  ← card title (slate, 11pt)
├─────────────────┬────────────────┤
│ 当前             │ 前值            │  ← sub-labels (slate, 9pt)
│ 82.02           │ 77.34          │  ← values (white, 18pt bold)
├─────────────────┼────────────────┤
│ 4W MA (当前)    │ 4W MA (前值)   │  ← sub-labels (slate, 9pt)
│ 87.46           │ 90.49          │  ← values (teal, 18pt bold)
└─────────────────┴────────────────┘
```

Implement this as a dedicated `addNaaimCard(slide, x, y, w, h, data)` function. `data` has shape:
```js
{ current: "82.02", prev: "77.34", ma4w: "87.46", ma4wPrev: "90.49", date: "2026-05-20" }
```

### Step 6 — QA

After generation, report:
- Which indicators were successfully fetched vs. N/A
- The output file path
- Any errors encountered

Do NOT open or preview the file — just report its path.

---

## Error handling

- If WebFetch returns 403, use the `playwright` MCP server (see `cold_start.md` Section 9). Only mark `N/A` if Playwright also fails. Never ask the user for DOM paste before the PPT is generated.
- If pptxgenjs is not found at the expected path, check `.claude/skills/pptx/node_modules/pptxgenjs` relative to the project root.
- If the script fails, show the error, fix it, and re-run once.
