---
name: investment-index-analysis
description: Use when asked to analyze market index changes, generate a daily market analysis report, create market-change-analysis.pptx, explain why indicators moved, OR generate/refresh the investment index slides / market indicators PPT / investment dashboard. Fetches 17 indicators (10 API + 7 scraped) and corroborating news via sub-agents, then renders one slide deck with trend + cause analysis per category.
---

# investment-index-analysis Skill

Produces **one** deliverable — `market-change-analysis_YYYY_MM_DD.pptx` — covering CRYPTO · STOCK ·
SOFR · 利率 · FOREX with per-category indicator cards, trend text, cause analysis, plus 配置建议 and
关键风险 slides. (This single skill replaces the old slides + analysis pair.)

All heavy lifting is pushed to sub-agents and static scripts. The main thread reads only this file,
runs two `node` scripts, and spawns two sub-agents — keeping browser output and raw news out of
context. **Never edit `fetch_market_data.js` or `generate_investment_index_analysis.js`** — they are
static renderers. All per-run data flows through JSON files.

## Architecture

```
Sub-agent A (scrape)        node fetch_market_data.js     Sub-agent B (research+synthesize)   node generate_investment_index_analysis.js
reads scraper-guide.md  →   reads scraped-indicators  →   reads news-guide.md             →   reads market-index.json + analysis-data.json
Playwright 5 sites          + 10 API (parallel)           reads market-index.json             writes market-change-analysis_*.pptx
WebFetch NAAIM              + carry-forward                writes analysis-data.json
writes scraped-indicators   writes market-index.json      returns ≤200-char summary
returns 1-line status       prints provenance table
```

> ⚠️ Sub-agents A and B **share the one Playwright browser** → run them **strictly sequentially**.
> Never spawn them in parallel.

### Re-running in the same session (verified 2026-06-11)

This skill is **safe to run multiple times in one session** — no restart needed between runs:

- The Playwright MCP server is persistent for the whole session; only the *page* is opened/closed.
- **Teardown is owned by Sub-agent B**, which calls `browser_close()` as its final action. After a
  close there are no open tabs (the server reports *"Navigate to a URL to create one"*).
- **Sub-agent A always opens with `browser_navigate`, which re-creates the page on demand** — whether
  the previous run closed cleanly, left the browser open (run aborted between A and B), or this is the
  first run. Empirically confirmed: `navigate → evaluate → close → navigate → evaluate` all succeed.
- Navigations **reuse the single tab** (no tab accumulation), and we never cache element refs across
  pages, so nothing stale carries between runs.

Net effect: a previous run's browser state cannot affect a later run. The only hard prerequisite is
the Step 0 MCP check (the server itself must be up — that does require a session that started with it).

---

## Step 0 — Check Playwright MCP (DO THIS FIRST)

```
ToolSearch({ query: "select:mcp__playwright__browser_navigate", max_results: 1 })
```
- **Found** → proceed to Step 1.
- **Not found** → **STOP.** Report to the user:
  > Playwright MCP is not running — the scraped indicators (CNN F&G, MM, AAII, Canada yields,
  > fund flow) and Phase-B news need a live browser. Fix: ensure `settings.local.json` →
  > `mcpServers.playwright` has `"command":"node","args":["E:\\CC项目\\node_modules\\@playwright\\mcp\\cli.js"]`,
  > then **restart the session** (mid-session `npx` launch has no effect). See `references/maintenance.md`.

Do not attempt a browser-less fallback.

---

## Step 1 — Spawn Sub-agent A (scrape the 7 manual indicators)

Spawn a `general-purpose` agent with this prompt:

> Read `E:\CC项目\.claude\skills\investment-index-analysis\references\scraper-guide.md` first — it is
> the only source of URLs and DOM selectors. Then: load the Playwright tools via ToolSearch; fetch
> the 5 Playwright sources (coinank, macromicro ×3, canadaici) using **exactly 2 calls each**
> (`browser_navigate` → `browser_evaluate`; never `browser_snapshot`, never an extra `browser_wait_for`);
> WebFetch NAAIM and compute the 4-week MAs. Write all keys you obtained (shapes per the guide) plus
> `generatedAt` (today, `YYYY-MM-DD`) to `E:\CC项目\scraped-indicators.json`. If a source fails
> (CAPTCHA / login wall / empty), **omit that key** — do not fabricate, do not carry forward, do not
> stop to ask for a DOM paste, do not abort. Start with `browser_navigate` (it (re)creates the page
> regardless of any prior run's state); **do NOT call `browser_close`** — Sub-agent B owns teardown so
> the browser stays open for it. Return **one line only**:
> `OK: N/7 keys written (failed: <list|none>)`.

---

## Step 2 — Build market-index.json

```bash
node fetch_market_data.js        # in E:\CC项目\
```
Prints a provenance table (each key tagged `api` / `scraped (date)` / `carried-forward STALE (date)`).
If `scraped-indicators.json` is missing or its `generatedAt` ≠ today, the script warns loudly and
carries forward the previous values — **note the warning but continue** (PPT-first principle). Only a
failure to *write* market-index.json is fatal.

---

## Step 3 — Spawn Sub-agent B (research + synthesize)

Spawn a `general-purpose` agent with this prompt:

> Read `E:\CC项目\.claude\skills\investment-index-analysis\references\news-guide.md` first. Then read
> `E:\CC项目\market-index.json` (your numbers + stale-check source) and the existing
> `E:\CC项目\analysis-data.json` (your recs/watches baseline). For any manual indicator whose `date`
> is earlier than the top-level `date`, write its trend as "（数据截至 X，待刷新）". Phase A: WebFetch
> the 13 news URLs in parallel. Phase B: Playwright only for categories with <3 quality sources
> (sequential, 2 calls/source, `browser_evaluate` only). Synthesize per category — `trend` ≤80字 using
> only market-index.json numbers; `cause` ≤150字 with cross-validation (≥2 sources = consensus, single
> source = "(单一来源，待交叉验证)"); `sources` 3–5 `{name,url}`. Keep `recs`/`watches` unchanged unless
> a material reversal occurred (criteria in the guide). Write `E:\CC项目\analysis-data.json` matching
> the guide's schema exactly, self-check it parses, then call `browser_close()` as your **final
> action** (do this even if synthesis hit problems — it leaves the session clean for the next run;
> skip silently only if the tool is unavailable). Return a **≤200-character** summary: per category
> direction + main cause + source count, any stale indicators, and whether recs/watches changed.
> Do NOT return raw news or browser output.

---

## Step 4 — Render the deck

```bash
node generate_investment_index_analysis.js        # in E:\CC项目\
```
Reads market-index.json + analysis-data.json, validates the analysis schema, writes
`market-change-analysis_YYYY_MM_DD.pptx`.

---

## Step 5 — QA & report

- Confirm the `.pptx` exists; report its path.
- Relay Sub-agent B's ≤200-char summary and list any indicators flagged STALE by Step 2.
- **If Step 4 fails on a schema error**: re-spawn Sub-agent B **once** with the error excerpt appended.
  If it fails **twice**: `git checkout -- analysis-data.json` and render with the last good analysis,
  adding an explicit "分析数据过期" caveat in your report. (Each re-spawn of Sub-agent B still ends with
  its own `browser_close()`; if the run aborts before B closed, it's harmless — the next run's
  Sub-agent A re-opens the browser on its first `browser_navigate`.)
- Do not open or preview the file — report the path only.
