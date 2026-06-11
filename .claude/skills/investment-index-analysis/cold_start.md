# Cold Start Guide — investment-index-analysis Skill

> 每次新 session 前阅读。记录了第一次运行（2026-05-28）的全部经验教训，避免重蹈覆辙。

---

## 1. 消息源可用性总表

### ✅ WebFetch 可直接抓取

| 消息源 | 板块 | URL | 抓取提示 |
|--------|------|-----|----------|
| CoinDesk | CRYPTO | https://www.coindesk.com/ | 直接返回正文；提取 headline + date + summary |
| Alternative.me | CRYPTO | https://alternative.me/crypto/fear-and-greed-index/ | 返回 F&G 当前值、前日值、分类标签及方法论说明 |
| CoinMarketCap 新闻 | CRYPTO | https://coinmarketcap.com/headlines/ | 返回简短标题列表；内容较浅，适合补充覆盖 |
| NAAIM 指数 | STOCK | https://naaim.org/programs/naaim-exposure-index/ | 返回完整历史周表格；可计算 4W MA |
| Investing.com 加密新闻 | CRYPTO | https://www.investing.com/news/cryptocurrency-news | 标题 + 日期 + 摘要；提取今日/昨日文章 |
| Investing.com 加密分析 | CRYPTO | https://www.investing.com/analysis/cryptocurrency | 深度分析文章；提取标题 + 关键论点 |
| Investing.com 股市新闻 | STOCK | https://www.investing.com/news/stock-market-news | S&P 500、VIX、Fed 政策相关标题 |
| Investing.com 股市分析 | STOCK | https://www.investing.com/analysis/stock-markets | 股市深度分析；聚焦宏观叙事 |
| Investing.com 债券分析 | 利率 | https://www.investing.com/analysis/bonds | 美债收益率、Fed 政策、加拿大利率相关分析 |
| Investing.com 外汇新闻 | FOREX | https://www.investing.com/news/forex-news | USD/CAD、USD/CNY、油价、BoC/Fed 驱动因素 |
| Investing.com 外汇分析 | FOREX | https://www.investing.com/analysis/forex | 外汇深度分析；提取主要货币对观点 |
| Investing.com 市场总览 | 跨板块 | https://www.investing.com/analysis/market-overview | 宏观事件驱动多板块联动时使用；提取关键论点分配至相关板块 |
| Investing.com 突发新闻 | 跨板块 | https://www.investing.com/news/headlines | 补充跨板块宏观/地缘事件；提取今日/昨日标题 |

### ✅ Playwright MCP 可抓取（WebFetch 返回 403/451）

经 2026-05-31 实测确认，以下来源用 Playwright MCP 均可获取实质内容：

| 消息源 | URL | 提取方式 |
|--------|-----|----------|
| CNBC Markets | https://www.cnbc.com/markets/ | `browser_evaluate` — 见 Section 2 |
| CNN Business/Investing | https://www.cnn.com/business/investing | `browser_evaluate` — 见 Section 2 |
| The Block | https://www.theblock.co/ | `browser_evaluate` — 见 Section 2 |
| Bloomberg Markets | https://www.bloomberg.com/markets | `browser_evaluate`（标题可抓；正文付费墙，仅用于标题补充） |
| Yahoo Finance News | https://finance.yahoo.com/news/ | `browser_evaluate` — 见 Section 2 |
| NY Fed SOFR 页面 | https://www.newyorkfed.org/markets/reference-rates/sofr | `browser_evaluate` 可读完整数据表（已有 JSON API，一般不需要） |
| Bank of Canada /rates/ | https://www.bankofcanada.ca/rates/ | ⚠️ **实测（2026-05-31）：/rates/ 和 /interest-rates/ 均为导航页，browser_evaluate 返回仅为链接列表，无实际数值**。利率数据直接读 market-index.json；驱动分析从 CNBC/Investing.com 获取 |
| MarketWatch | https://www.marketwatch.com/ | `browser_evaluate` — 见 Section 2 |

### ❌ 实际阻断

| 消息源 | 失败原因 | 替代方案 |
|--------|----------|----------|
| Reuters Markets | Playwright 仅返回 3 条无实质内容的条目，有效阻断 | 改用 MarketWatch / Investing.com |
| US Treasury 收益率页面（原 URL） | 404 页面已失效 | 利率数据直接读 market-index.json（来自 Yahoo Finance API）|

---

## 2. 可复用抓取 Pattern

所有 Playwright 来源通用 evaluate 模板（去重 + 过滤短字符串）：
```js
() => {
  const els = [...document.querySelectorAll('h2, h3, [class*="headline"]')];
  return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 20))].slice(0, 15);
}
```

### MacroMicro (CNN F&G · MM Bull/Bear · AAII) — Playwright browser_evaluate (verified 2026-06-09)

Same single pattern works for all three pages:
```
browser_navigate({ url: "<macromicro chart URL>" })
browser_wait_for({ time: 2 })
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
Returns clean JSON — do NOT use `browser_snapshot` on macromicro pages.

### CNBC Markets — Playwright browser_evaluate

```
browser_navigate({ url: "https://www.cnbc.com/markets/" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const articles = [...document.querySelectorAll('a[href*="/2026/"], a[href*="article"]')];
    const headlines = [];
    articles.forEach(a => {
      const text = a.textContent.trim();
      if (text.length > 30 && text.length < 200 && !headlines.includes(text)) headlines.push(text);
    });
    return headlines.slice(0, 15);
  }`
})
```
**注意**：不要用 `browser_snapshot`——CNBC accessibility tree 过大，用 evaluate 更快。

### CNN Business/Investing — Playwright browser_evaluate

```
browser_navigate({ url: "https://www.cnn.com/business/investing" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const els = [...document.querySelectorAll('a[data-link-type="article"], [class*="container__headline"], h2, h3')];
    return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 15))].slice(0, 15);
  }`
})
```
注：旧 `www.cnn.com/markets/fear-and-greed` 仍 451；只用 `/business/investing` 子页。

### The Block — Playwright browser_evaluate

```
browser_navigate({ url: "https://www.theblock.co/" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const els = [...document.querySelectorAll('h2, h3, a[href*="/post/"]')];
    return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 15))].slice(0, 15);
  }`
})
```

### Bloomberg Markets — Playwright browser_evaluate（标题层）

```
browser_navigate({ url: "https://www.bloomberg.com/markets" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const els = [...document.querySelectorAll('h1, h2, h3, [class*="headline"], [class*="story"]')];
    return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 15))].slice(0, 15);
  }`
})
```
**注意**：正文仍在付费墙后，只能用于标题级别补充，不要引用具体论点。

### Yahoo Finance News — Playwright browser_evaluate

```
browser_navigate({ url: "https://finance.yahoo.com/news/" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const els = [...document.querySelectorAll('h3, [class*="headline"], a[href*="/news/"]')];
    return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 20))].slice(0, 15);
  }`
})
```

### MarketWatch — Playwright browser_evaluate

```
browser_navigate({ url: "https://www.marketwatch.com/" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const els = [...document.querySelectorAll('h3, h2, [class*="headline"]')];
    return [...new Set(els.map(e => e.innerText?.trim()).filter(t => t && t.length > 20))].slice(0, 15);
  }`
})
```

### CoinDesk — WebFetch prompt

```
WebFetch(url="https://www.coindesk.com/", prompt="Extract top 5 news headlines from today or yesterday only. For each: headline | date | 1-sentence summary (max 20 words). Focus on BTC, ETH, fund flows, sentiment. Max 80 words total.")
```

### Alternative.me — WebFetch prompt

```
WebFetch(url="https://alternative.me/crypto/fear-and-greed-index/", prompt="Return only: current value, classification label, previous day value. Max 30 words.")
```

### Investing.com sources — WebFetch prompt template

All Investing.com URLs use this prompt pattern (substitute category as needed):

```
WebFetch(url="https://www.investing.com/...", prompt="Extract top 5 articles from today or yesterday only. For each: headline | date | 1-sentence summary (max 20 words each). Skip articles older than 2 days. Max 80 words total.")
```

---

> Sections 3–6（来源分工·经验教训·工作流·叙事模板）已移至 `cold_start_lessons.md`，仅调试时读取。

