# Cold Start Lessons — investment-index-slides Skill

> 幻灯片结构参考、冷启动工作流、CNN F&G 标签查找表、已知陷阱。
> **日常运行无需读此文件**——cold_start.md（Sections 1–4 + Section 9）已包含所有操作所需内容。
> 仅在调试布局异常、工作流参考或查阅已知陷阱时读取。

---

## 5. Slide Structure & Card Layout

```
Slide 0: Cover
Slide 1: CRYPTO  — gcell(2, 2)  → 2×2 grid, 4 cards
Slide 2: STOCK   — gcell(3, 2)  → 3×2 grid, 6 slots
  Row 0: Fear&Greed | VIX | MM Bull/Bear
  Row 1: SOFR      | AAII 牛熊  | NAAIM
Slide 3: 利率     — gcell(2, 2)  → 2×2 grid, 4 cards (US10Y · US30Y · CA5YGOC · CA5YCMB)
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
4. Canada 5Y GOC + CMB → https://www.canadaici.com/market-data/
5. 加密货币资金流 (BTC) → https://coinank.com/zh/fund/fundSwap

If Playwright also fails (CAPTCHA / login wall), mark N/A and continue — do NOT ask the user for DOM paste.

**Step 3 — Edit `LIVE_MANUAL` (6 keys), then run:**

> ⚠️ **Never carry forward old values.** If Playwright is unavailable and a source cannot be fetched, set that key's `value` to `"N/A"` and `dir` to `"neutral"`. Stale numbers from a previous run are worse than N/A — they appear current but aren't.

After Steps 1–2, edit only these keys in `generate_investment_index_slides.js`:

```
cnnFG    → { value, change, dir, date }
mm       → { mmCurrent, mmPrev, sp500Current, sp500Prev, date }
aaii     → { bullCurrent, bullPrev, bearCurrent, bearPrev, date }
naaim    → { current, prev, ma4w, ma4wPrev, date }
ca5yGoc  → { value, change, dir, date }   ← querySelectorAll(...)[0] from canadaici.com (GOC 5Y)
ca5yCmb  → { value, change, dir, date }   ← querySelectorAll(...)[2] from canadaici.com (CMB 5Y)
fundFlow → { date, items: [{label, value, dir}×6] }
           labels: '15m' | '4h' | '7D' | '30D' | '市值($)' | '资金信号'
           dir: 'up' (positive) | 'down' (negative) | 'neutral' (市值)
```

Then run — it fetches the 10 APIs and generates the PPTX in one shot:
```bash
cd "e:\CC项目" && node generate_investment_index_slides.js
```

The script prints `API: X/10 fetched` then `SUCCESS: investment-index-slides_YYYY_MM_DD.pptx`.

After the slides script completes, **invoke the `investment-index-analysis` Claude skill** (via `Skill` tool). That skill fetches news, updates the `ANALYSIS` block in `generate_investment_index_analysis.js`, and generates `market-change-analysis_YYYY_MM_DD.pptx` with fresh content. **Do NOT run `generate_investment_index_analysis.js` directly** — it only re-renders stale hardcoded text.

> ⚠️ **fundFlow 时效性**：若 analysis skill 在 slides 完成 2小时以上后才运行，analysis skill 开始前应先重新抓取 coinank.com 的最新 fundFlow 值（资金信号、7D、4h 等方向最容易翻转），然后更新 market-index.json 对应字段，再进行新闻抓取。

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
| fundFlow 是 6 个 LIVE_MANUAL 中唯一高频翻转的指标 | 2026-05-31 两次运行对比：15m 从 +365万↑ 翻转为 -1,309万↓，4h 从 -992万↓ 翻转为 +350万↑，资金信号从 -33 改善至 -27，间隔约 8 小时。其余 5 个值（cnnFG · mm · aaii · naaim · ca5yGoc · ca5yCmb）当天内基本稳定，通常无需重新抓取 | 每次运行都应重新抓取 fundFlow（coinank.com）；其他 5 个值在当天第二次运行时可直接复用，只需确认日期一致 |
| Rewrote script from scratch | `generate_investment_index_slides.js` already exists on disk; rewrote 250 lines + first run failed on require path → ~3 min wasted | Read the existing file, edit only the LIVE block |
| CNBC blocked | cnbc.com returns 403 for VIX and treasury quotes | Use Yahoo Finance instead |
| CNN blocked | cnn.com/markets/fear-and-greed returns 451 | Use macromicro.me chart 50108 via Playwright MCP |
| Bank of Canada API returns wrong value | V80691335 series = conventional mortgage ~6%, not CMB ~3.34% | Only use canadaici.com via Playwright MCP |
| macromicro.me always 403 to WebFetch | All macromicro.me and sc.macromicro.me URLs blocked for plain HTTP | Use Playwright MCP — do not ask user for DOM paste |
| SOFR FRED also 403 | fred.stlouisfed.org also blocked | Use NY Fed via Playwright MCP |
| aaii.com returns empty | aaii.com/sentimentsurvey serves blank body to WebFetch | Use macromicro.me chart 77072 via Playwright MCP |
| canadaici.com page dynamic | WebFetch gets no data | Use Playwright MCP for `div.widgetTableCell.field3.col3 a` |
| GOC confused with CMB | `querySelectorAll(...)[0]` returns GOC 5Y (3.19%), not CMB 5Y (3.32%) — same CSS class for all rows | Use index [2] for CMB 5Y; index [0] for GOC 5Y. Page order: GOC5Y[0] · GOC10Y[1] · CMB5Y[2] · CMB10Y[3] |
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
| Playwright MCP tools not found at session start (2026-06-03) | `settings.local.json` had the playwright MCP entry with lifecycle flags (`autoRestart` etc.) but **no `command` or `args`** — the harness had nothing to launch, server silently never started | Fix: add `"command": "npx"` and `"args": ["@playwright/mcp@latest"]` to the playwright entry in `settings.local.json`, then **restart the session**. If tools still missing after restart, read `settings.local.json` first before trying `npx @playwright/mcp@latest &` as manual fallback. |
| Reused stale LIVE_MANUAL values when Playwright unavailable (2026-06-09) | Playwright MCP failed to start; skill fell back to "WebFetch-only mode" and silently kept Jun 8 cnnFG/ca5y values in the Jun 9 slides — slides appeared current but contained yesterday's data | **Never carry forward.** If a Playwright source cannot be fetched, set `value: "N/A"`, `dir: "neutral"`. An N/A card is honest; a stale number is misleading. |
| Running `npx @playwright/mcp@latest &` mid-session has no effect (2026-06-09) | MCP uses stdio; the harness establishes the connection at session startup only. A bash `&` process started mid-session is unknown to the harness — ToolSearch will still return no tools | The only fix is to restart the session. Mid-session manual launch is never effective. |
| `npx` registry check caused silent startup failure on every session (2026-06-09) | `npx` contacts the npm registry on each run even with a pinned version; slow network or timeout causes silent failure — MCP never starts | **Fixed (2026-06-09):** installed `@playwright/mcp@0.0.75` locally (`npm install @playwright/mcp@0.0.75` in project root); updated `settings.local.json` to `"command":"node","args":["E:\\CC项目\\node_modules\\@playwright\\mcp\\cli.js"]` — no network needed, starts instantly. To upgrade: `npm install @playwright/mcp@X.Y.Z` then update the path in args. |
