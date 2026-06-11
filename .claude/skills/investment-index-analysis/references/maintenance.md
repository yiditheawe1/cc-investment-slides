# Maintenance — investment-index-analysis

> **Not read during normal runs.** Consult only when: Playwright MCP won't start, you're modifying
> the renderer's card layout, or you hit one of the historical pitfalls below.

---

## 1. Playwright MCP — startup troubleshooting

The `playwright` MCP server is configured in `E:\CC项目\.claude\settings.local.json` under
`mcpServers.playwright`. **Current working config (verified 2026-06-11):**
```json
"playwright": {
  "command": "node",
  "args": ["E:\\CC项目\\node_modules\\@playwright\\mcp\\cli.js"],
  "autoRestart": true, "restartOnNewSession": true, "killOnSessionEnd": true, "autoStart": true
}
```

**If Step 0's `ToolSearch` finds no `mcp__playwright__*` tools:**
1. Verify `mcpServers.playwright` has BOTH `command` and `args`. A missing `command`/`args` pair
   means the harness has nothing to launch and the server silently never starts.
2. Confirm the local install exists: `E:\CC项目\node_modules\@playwright\mcp\cli.js`. If absent,
   `npm install @playwright/mcp@0.0.75` in the project root. To upgrade: install the new version,
   then update the path in `args`.
3. **Restart the session.** MCP uses stdio and the harness only establishes the connection at
   session startup. Running `npx @playwright/mcp@latest &` mid-session has **no effect** —
   ToolSearch will still find nothing. The only fix is a restart.

> **Superseded:** earlier notes recommended `"command":"npx","args":["@playwright/mcp@latest"]`.
> That was abandoned (2026-06-09) — `npx` contacts the npm registry on every launch, and a slow
> network / timeout caused silent startup failures. The local `node` + `cli.js` path needs no
> network and starts instantly. Use the local-path config above, not `npx`.

A SessionStart hook also kills stray `mcp-chrome` Chrome processes — leave it in place.

**Install (verified 2026-06-11):** `@playwright/mcp@0.0.75` is a project dependency in `package.json`
(`"@playwright/mcp": "^0.0.75"`), so `npm install` in the project root restores both `cli.js` and the
bundled `playwright` + chromium. No global/`npx` fetch is involved.

**Multi-run safety (verified 2026-06-11):** the skill is safe to run repeatedly in one session without
a restart. The MCP server is session-persistent; only the *page* opens/closes. Sub-agent B closes the
page at the end of each run (`browser_close` → "No open tabs"); Sub-agent A's first `browser_navigate`
re-creates it on the next run. Confirmed empirically: `navigate → evaluate → close → navigate →
evaluate` all succeed in sequence. Navigations reuse the single tab (no accumulation) and no element
refs are cached across pages, so a prior run's state never leaks into a later one.

---

## 2. Carry-forward strategy (supersedes old "never carry forward" rule)

The old slides skill's lessons said: *"Never carry forward old values — set N/A instead; a stale
number is worse than N/A."* **This is superseded** by the current architecture:

- `fetch_market_data.js` carries forward each manual key from the previous `market-index.json` when
  Sub-agent A didn't supply it, **but retains the old per-key `date`** as an explicit STALE signal.
- Sub-agent B's stale-check (news-guide §0.2) compares each manual indicator's `date` to the
  top-level `date` and writes "（数据截至 X，待刷新）" into the trend text when they differ.

So staleness is now **surfaced honestly** rather than hidden — which is what the old rule was trying
to protect against. Carry-forward + date-flagging > hard N/A, because it preserves continuity while
staying truthful. N/A shapes still apply only when there is no prior value at all (first run).

---

## 3. Renderer card-layout specs (only when editing generate_investment_index_analysis.js)

Palette (`C` object, **no `#` prefix** — `#` silently breaks pptxgenjs):
```js
const C = { bg:'0F172A', card:'1E293B', white:'FFFFFF', slate:'94A3B8', teal:'0D9488',
  green:'22C55E', red:'EF4444', muted:'64748B', divider:'2D3F55', amber:'F59E0B',
  blue:'3B82F6', purple:'8B5CF6', emerald:'10B981' };
```
Accent per category: CRYPTO=amber · STOCK=blue · 利率/SOFR=purple · FOREX=emerald.
Layout: `LAYOUT_16x9` (10" × 5.625"). Line thickness uses `line.pt`, not `line.width`.

Deck = 12 slides: 0 Cover · 1 CRYPTO走势 · 2 CRYPTO分析 · 3 STOCK走势 · 4 STOCK分析 ·
5 SOFR走势 · 6 利率走势 · 7 利率&SOFR分析 · 8 FOREX走势 · 9 FOREX分析 · 10 配置建议 · 11 关键风险&观察指标.

Card functions and data shapes:
| Card | Function | Shape |
|------|----------|-------|
| Standard | `addCard(s,pr,x,y,w,h,{name,value,change,dir,date})` | value `'N/A'` → renders N/A; change `'—'` hidden |
| Fund Flow (3×2) | `addFundFlowCard(s,pr,x,y,w,h,d)` | `{ items:[{label,value,dir}×6], date }` — 13pt bold, color by dir (up=green/down=red/neutral=slate) |
| SOFR (3×2) | `addSofrCard(s,pr,x,y,w,h,d)` | `{ cells:[{label,value}×6], date }` — Vol($B) white, rest teal |
| Quad (2×2) | `addQuadCard(s,pr,x,y,w,h,cfg)` | `{ title, tl, tr, bl, br, note }` — top row white, bottom row teal; used by MM and AAII |
| NAAIM (2×2) | `addNaaimCard(s,pr,x,y,w,h,d)` | `{ current, prev, ma4w, ma4wPrev, date }` — current/prev white, MAs teal |
| Trend strip | `addTrendBlock(s,pr,x,y,w,h,text)` | bottom strip of trend slides |
| Analysis | `buildAnalysisSlide(pres,title,accent,causeText,sources)` | left 65% cause card, right 33% sources list |
| Recs table | `buildRecsSlide(pres)` | reads `ANALYSIS.recs[]` — 资产/方向/调仓幅度/信心/核心理由 |
| Watches | `buildWatchSlide(pres)` | reads `ANALYSIS.watches[]` — label + detail |

---

## 4. Historical pitfalls (reference)

| Pitfall | Fix |
|---------|-----|
| `browser_evaluate` requires `function` param, not `expression` | Load schema via ToolSearch before first call each session |
| `browser_snapshot` dumps full a11y tree (thousands of lines) | Always `browser_evaluate`; returns compact JSON |
| canadaici GOC vs CMB confusion | `[0]`=GOC 5Y, `[2]`=CMB 5Y; same CSS class for all rows |
| Bank of Canada API `V80691335` | Returns mortgage rate ~6%, not CMB yield ~3.3% — never substitute |
| macromicro / aaii.com / fred / cnbc quotes | All block plain WebFetch; Playwright (macromicro) or JSON API (SOFR) only |
| pptxgenjs `#` hex / `line.width` | Strip `#`; use `line.pt` |
| Windows Chinese-path require | `require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'))` |
| Stopped mid-run to ask for DOM paste | Always generate the PPT first; offer DOM paste only after the file exists |
| SOFR `browser_wait_for({text:"SOFR"})` 30s timeout | "SOFR" appears in a hidden nav link first; use a fixed `time` delay (or internal poll) |
| Reusing element refs across navigations | Refs are page-specific; never reuse a ref from a prior snapshot |
| fundFlow flips within hours | Always fetch fresh; it's the only high-frequency manual indicator |
| Long source URLs overflow the slide | Use hostname only (e.g. `cnbc.com`) |
