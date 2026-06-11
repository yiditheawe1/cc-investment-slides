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

### Step 0 — Start Playwright MCP  ← DO THIS FIRST, BEFORE ANYTHING ELSE

Before reading any files or fetching any data, ensure the Playwright MCP server is running.

**Check availability:**
```
ToolSearch({ query: "select:mcp__playwright__browser_navigate", max_results: 1 })
```

**If tools are found** → Playwright is running. Proceed to Step 1.

**If tools are NOT found** → **STOP. Do not proceed.**

Report to the user:

> Playwright MCP is not running. 6 indicators (CNN F&G · MM Bull/Bear · AAII · Canada 5Y GOC/CMB · BTC Fund Flow) require a live browser and cannot be fetched without it. Running without Playwright would either produce stale data (if old LIVE_MANUAL values exist) or N/A cards — neither is acceptable for a live market dashboard.
>
> **To fix:** run `! npx @playwright/mcp@latest --version` in the prompt to verify npx resolves correctly, then restart the session. If the version resolves but MCP still doesn't appear, check `.claude/settings.local.json` → `mcpServers.playwright` entry.

Do **not** attempt a WebFetch-only fallback. Do **not** reuse any existing LIVE_MANUAL values from the script.

> **Root cause note**: The `.playwright-mcp/` directory in the project root is the Playwright MCP server's browser profile. Do NOT delete or modify its contents — doing so crashes the MCP server.

---

### Step 1 — Read cold_start.md

Read `.claude/skills/investment-index-slides/cold_start.md` in full.

It contains:
- Which URLs are blocked to plain WebFetch and must use the **`playwright` MCP server** instead
- Confirmed working fallback URLs for VIX, US 10Y/30Y, and S&P 500
- The correct pptxgenjs `require` path for Windows
- NAAIM 4W MA calculation method
- Playwright MCP fetch patterns for each blocked source (Section 9)
- All known pitfalls that caused wasted time in past sessions

**If you skip this step, you will repeat the same mistakes: ~8 wasted WebFetch calls on known-403 URLs.**

### Step 2 — Read indicators.md

After reading `cold_start.md`, read `.claude/skills/investment-index-slides/indicators.md` in full.

From it, extract for each indicator:
- **Category** (CRYPTO / STOCK / 利率 / Forex)
- **Indicator name**
- **Primary URL** — the first `https://…` link in that row
- **Fallback URLs** — any additional `https://…` links in that row (try only if primary fails)
- **DOM hints** — any CSS selectors, HTML snippets, or extraction notes in that row

Use only URLs and DOM selectors found in `indicators.md`. If an indicator has no usable URL, mark it `N/A`.

### Step 3 — Fetch live data

Use the WebFetch tool on each URL found in `indicators.md`. For each indicator extract:
- **Current value** (number, percentage, or index level)
- **Change / trend** (up/down, day change, or sentiment label if available)
- **As-of date or time** (if shown on the page)

Fetch all URLs in parallel using WebFetch. If a URL returns 403 or no parseable value:
1. Try its fallback URL (if any in `indicators.md`)
2. If still blocked, **use the `playwright` MCP server** — see `cold_start.md` Section 9 for the exact `browser_navigate` + `browser_evaluate` sequence per source
3. Only mark `N/A` if Playwright also fails (CAPTCHA / login wall)

**Never stop mid-run to ask the user for DOM paste — generate the PPT first, then offer to fill gaps.**

> **⚡ Token/time discipline (Playwright):** the 5 Playwright sources share ONE browser tab and run sequentially. Per source use exactly **2 calls**: `browser_navigate` → `browser_evaluate` (the evaluate polls internally; do **not** add a separate `browser_wait_for` call — that is a wasted round-trip). **Never** use `browser_snapshot` here — it dumps the full accessibility tree (thousands of lines) into context. See `cold_start.md` Section 9 for the folded patterns.

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

**SOFR (6 values required)** — Auto-fetched via NY Fed JSON API (`markets.newyorkfed.org/api/rates/secured/sofr/last/1.json`) inside the main script. No Playwright needed. `refRates[0]` contains: `effectiveDate` / `percentRate` / `percentPercentile1` / `percentPercentile25` / `percentPercentile75` / `percentPercentile99` / `volumeInBillions`.

**Canada 5Y CMB** — JS-rendered, WebFetch gets no data. Use Playwright MCP: navigate → one `browser_evaluate` with internal poll (cold_start Section 9 returns GOC + CMB in a single evaluate). Look for `div.widgetTableCell.field3.col3 a` value (e.g. `3.34%`).

**MM Bull/Bear (4 values)** — WebFetch returns 403. Use Playwright MCP with macromicro.me URL. If Playwright also fails, use the S&P 500 Yahoo Finance fallback for sp500Current/sp500Prev only; set mm values to N/A.

**AAII (4 values)** — WebFetch returns 403. Use Playwright MCP with sc.macromicro.me URL. li[0] = 看多, li[1] = 看空. If Playwright also fails, mark N/A.

**加密货币资金流 — BTC Fund Flow (6 values)** — WebFetch gets no data. Use Playwright MCP: navigate → one `browser_evaluate` with internal poll that returns ONLY the BTC row cells (cold_start Section 9). **Do NOT snapshot to file** — the evaluate returns ~12 cell strings directly. Column order: 货币 | 5m | 15m | 1h | 2h | 4h | 6h | 8h | 1D | 7D | 30D | 市值($) | 资金信号合约?. Extract: 15m (col 2), 4h (col 5), 7D (col 9), 30D (col 10), 市值($) (col 11), 资金信号合约? (col 12). Dir: positive value = `'up'`, negative = `'down'`, 市值 = `'neutral'`.

### Step 4 — Organize data

Structure the fetched data into four category objects matching the sections in `indicators.md`:

```
CRYPTO   → Fear&Greed, BTC Dominance, ETH/BTC, Fund Flow
STOCK    → Fear&Greed, VIX, MM Bull/Bear, SOFR, AAII, NAAIM
RATES    → US 10Y, US 30Y, Canada 5Y CMB
FOREX    → USD/CAD, USD/CNY, CAD/CNY
```

### Step 4.5 — `market-index.json` (written automatically by the script)

`generate_investment_index_slides.js` writes `market-index.json` to the project root automatically after all data is assembled — no manual Write step needed.

The JSON contains **all 16 indicators** (6 manual + 10 API) using the exact key names from the script:

```json
{
  "date": "YYYY-MM-DD",
  "cryptoFG":  { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "btcDom":    { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "ethBtc":    { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "sofr":      { "date": "...", "cells": [ { "label": "RATE (%)", "value": "..." }, "..." ] },
  "vix":       { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "us10y":     { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "us30y":     { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "usdCad":    { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "usdCny":    { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "cadCny":    { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "fundFlow":  { "date": "...", "items": [ { "label": "15m", "value": "...", "dir": "..." }, "..." ] },
  "cnnFG":     { "value": "...", "change": "...", "dir": "...", "date": "..." },
  "mm":        { "mmCurrent": "...", "mmPrev": "...", "sp500Current": "...", "sp500Prev": "...", "date": "..." },
  "aaii":      { "bullCurrent": "...", "bullPrev": "...", "bearCurrent": "...", "bearPrev": "...", "date": "..." },
  "naaim":     { "current": "...", "prev": "...", "ma4w": "...", "ma4wPrev": "...", "date": "..." },
  "ca5yCmb":   { "value": "...", "change": "...", "dir": "...", "date": "..." }
}
```

---

### Step 5 — Generate PPT using pptxgenjs

> Full slide structure, per-category layout, color palette, card grid sizing → `SKILL_lessons.md` (only needed when writing the script from scratch).

### Step 6 — Update and run the script

1. **Read ONLY the `LIVE_MANUAL` block, not the full 500-line script.** The functions/layout/API code are stable and never edited — reading them wastes ~5k tokens every run. Use `Read('generate_investment_index_slides.js', { offset: 43, limit: 55 })` to pull just the `LIVE_MANUAL` object (the only thing that changes run-to-run). Then Edit only the changed indicator values/dates inside it.
   - If the file does not exist at all: only then Read/write it fresh using the template in `cold_start.md` Section 5.
   - If the offset/limit window misses `LIVE_MANUAL` (script was refactored): Grep for `const LIVE_MANUAL` to find the new line range, then Read that range — still avoid reading the whole file.
2. Run it with: `node generate_investment_index_slides.js`
   - The script must `require` pptxgenjs using `path.resolve`:
     `const pptxgen = require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));`
3. Output filename must include a date suffix: `investment-index-slides_YYYY_MM_DD.pptx` (e.g. `investment-index-slides_2026_05_25.pptx`). Use the run date (UTC).
4. Verify the file was created.
5. Report the output path and a summary table of all fetched indicator values.

> Card layout specs (Fund Flow · SOFR · Quad · NAAIM) → `SKILL_lessons.md` (only needed when implementing card functions from scratch).

### Step 7 — Invoke investment-index-analysis skill

After confirming the slides PPTX was created successfully, immediately invoke the `investment-index-analysis` skill:

```
Skill({ skill: 'investment-index-analysis' })
```

This skill fetches corroborating news, generates fresh analysis text (市场走势、原因分析、配置建议、关键风险&观察指标), updates `generate_investment_index_analysis.js`, and produces an updated `market-change-analysis_YYYY_MM_DD.pptx`.

**Do NOT run `generate_investment_index_analysis.js` directly** — it only re-renders stale hardcoded text. The analysis skill is what updates the content.

### Step 8 — QA

After both files are confirmed created, report:
- Which indicators were successfully fetched vs. N/A
- Both output file paths (`investment-index-slides_*.pptx` and `market-change-analysis_*.pptx`)
- Any errors encountered

Do NOT open or preview the files — just report their paths.

---

## Error handling

- If WebFetch returns 403, use the `playwright` MCP server (see `cold_start.md` Section 9). Only mark `N/A` if Playwright also fails. Never ask the user for DOM paste before the PPT is generated.
- If pptxgenjs is not found at the expected path, check `.claude/skills/pptx/node_modules/pptxgenjs` relative to the project root.
- If the script fails, show the error, fix it, and re-run once.
