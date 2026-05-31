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

| 消息源 | URL | 提取方式 |
|--------|-----|----------|
| CNBC Markets | https://www.cnbc.com/markets/ | `browser_evaluate` — 见 Section 2 |

### ❌ 完全阻断（WebFetch + Playwright 均无法获取新闻正文）

| 消息源 | 失败原因 | 替代方案 |
|--------|----------|----------|
| The Block | 403 Forbidden | 改用 CoinDesk |
| Bloomberg（所有子页面） | 登录墙，Playwright 只返回导航链接 | 改用 Investing.com / CoinDesk |
| Yahoo Finance /news/ | HTTP 503 | — |
| NY Fed SOFR 页面 | 403（HTML 页面） | 改用 NY Fed JSON API（已在 investment-index-slides 脚本中） |
| US Treasury 收益率页面 | 60 秒超时 | 改用 market-index.json 已有数据 |
| Bank of Canada /rates/ | 只返回导航，无实际利率数据 | 只用于政策背景描述；具体利率读 market-index.json |

---

## 2. 可复用抓取 Pattern

### CNBC Markets — Playwright browser_evaluate

```
browser_navigate({ url: "https://www.cnbc.com/markets/" })
browser_wait_for({ time: 3 })
browser_evaluate({
  function: `() => {
    const articles = [...document.querySelectorAll('a[href*="/YEAR/"], a[href*="article"]')];
    const headlines = [];
    articles.forEach(a => {
      const text = a.textContent.trim();
      if (text.length > 30 && text.length < 200 && !headlines.includes(text)) {
        headlines.push(text);
      }
    });
    return headlines.slice(0, 15);
  }`
})
```

把 `YEAR` 替换为当前年份（如 `2026`）。返回标题字符串数组，无需 snapshot。
**注意**：不要用 `browser_snapshot`——CNBC 的 accessibility tree 过大，用 evaluate 更快。

### CoinDesk — WebFetch prompt

```
WebFetch(url="https://www.coindesk.com/", prompt="Extract top 5-8 news headlines from today or yesterday (YYYY-MM-DD or YYYY-MM-DD-1). For each: headline, date, 1-sentence summary. Focus on Bitcoin, BTC dominance, ETH, fund flows, market sentiment.")
```

### Alternative.me — WebFetch prompt

```
WebFetch(url="https://alternative.me/crypto/fear-and-greed-index/", prompt="Current Fear & Greed value, classification, previous day value, and any explanation of current sentiment.")
```

---

## 3. 数据来源分工（推荐组合）

| 类别 | 主力来源 | 补充来源 | 说明 |
|------|----------|----------|------|
| CRYPTO 新闻 | CoinDesk (WebFetch) | Alternative.me + CoinMarketCap (WebFetch) | 3 源全部 WebFetch，不需 Playwright |
| STOCK 新闻 | CNBC (Playwright evaluate) | NAAIM (WebFetch) | CNBC 是唯一可靠的股票新闻源 |
| SOFR / 利率 | market-index.json 数据 + CNBC 政策报道 | Bank of Canada 背景 | 利率数据直接读 JSON；新闻背景从 CNBC |
| FOREX | CNBC 外汇/能源标题 | market-index.json 数据 | Reuters/MarketWatch 均阻断；CNBC 标题中有汇率驱动因素 |

**核心原则**：利率和外汇类新闻不需要专门的财经数据页面——CNBC 的综合市场新闻已覆盖驱动因素（加息预期、油价、地缘事件）。

---

## 4. 经验教训

| 教训 | 原因 | 解决方法 |
|------|------|----------|
| Bloomberg 在 Playwright 下也是登录墙 | 即使用真实浏览器，未登录用户只能看到导航链接 | 不要尝试 Bloomberg；用 CNBC 代替 |
| Yahoo Finance /news/ 子页面返回 503 | Yahoo Finance 新闻聚合页面对 bot 有限制 | 个别 quote 页面（如 `^VIX`）可以抓到市场数据，但新闻标题不可靠 |
| Reuters 和 MarketWatch 完全阻断 | Claude Code 环境层面屏蔽，非 403 | 标注"Playwright fallback"并用 CNBC 代替，在 PPT 消息源中说明 |
| Bank of Canada `/rates/` 只有导航 | 这是一个索引页，不展示实际数据 | 只用该域名的政策语境（"April 2026 报告"），实际利率数据来自 market-index.json |
| AAII 返回空 body | 与 investment-index-slides 一致——该网站对 WebFetch 完全不响应 | 实际数据读 market-index.json；在分析文本中引用 AAII 作为来源名称即可 |
| US Treasury 页面超时 | 页面较重，60 秒内无响应 | 不尝试此 URL；10Y/30Y 数据直接读 market-index.json |
| CNBC 用 WebFetch 返回 403 | 需要真实浏览器 UA | 改用 Playwright + evaluate（不要用 snapshot） |
| 不要为消息源标注"blocked"让 PPT 显得不专业 | — | 在 sources 字段写法：`reuters.com/markets/currencies`，用括号注明 fallback 来源（仅限内部文档，PPT 显示简洁 URL 即可） |
| market-index.json 中 ca5yCmb 曾存错误值 | 首次抓 canadaici.com 用 `[0]` 取到 GOC（3.19%）而非 CMB（3.32%）；两者同页同 CSS 类 | 利率分析时区分 GOC（政府债）和 CMB（联邦按揭债）；market-index.json 现已同时含 `ca5yGoc` 和 `ca5yCmb` 两个字段 |

---

## 5. 推荐工作流（下次 session）

```
Step 1 — 并行 WebFetch（最多 9 个，全部无需 Playwright）:
  CRYPTO:  a. CoinDesk
           b. Alternative.me (F&G context)
           c. CoinMarketCap /headlines/
           d. Investing.com /news/cryptocurrency-news
           e. Investing.com /analysis/cryptocurrency   （可选，深度分析）
  STOCK:   f. Investing.com /news/stock-market-news
           g. Investing.com /analysis/stock-markets    （可选）
  利率:    h. Investing.com /analysis/bonds
  FOREX:   i. Investing.com /news/forex-news
  跨板块:  j. Investing.com /analysis/market-overview
           k. Investing.com /news/headlines            （可选，突发补充）

Step 2 — Playwright CNBC（若 MCP 可用，可补充 stock + rates 深度覆盖）:
  browser_navigate → wait 3s → browser_evaluate (headline extractor)
  ⚠️ 非必须：Investing.com WebFetch 已可覆盖同类内容

Step 3 — WebFetch NAAIM（如 market-index.json 数据需要最新）:
  可选；若 market-index.json 已有当日数据则跳过

Step 4 — 综合 market-index.json 数据，写 ANALYSIS 对象，运行脚本:
  node generate_investment_index_analysis.js
```

最低配置（Playwright 不可用时）：**9 次 WebFetch** 即可覆盖全部 5 个分析板块。

---

## 6. 关键分析叙事模板

以下为可复用的分析框架（根据当日数据填入具体数字）：

**CRYPTO**：`{地缘/宏观事件}` 引发 `{爆仓金额}` 多空清算，BTC 跌至 `{价位}`，F&G 降至 `{值}`（极度恐惧）。资金流向数据显示 `{净流入/净流出}`，暗示 `{机构吸筹/散户恐慌出逃}`。

**STOCK**：标普 500 `{上涨/下跌}` 受 `{事件}` 驱动，VIX `{变化方向}` 至 `{值}`。NAAIM 经理人仓位 `{值}`（`{高位/低位}`区间），AAII 散户 `{看多%}` vs `{看空%}`——两者`{一致/背离}`。

**利率**：美债收益率 `{下行/上行}` 受 `{避险需求/降息预期/通胀}` 驱动；SOFR 维稳于 `{值}`，联储信号`{鸽/鹰}`；加拿大 5Y GOC `{+/-X bps}`、CMB `{+/-X bps}`，利差 `{稳定/扩大/收窄}`，反映`{加央行政策路径}`。

**FOREX**：USD/CAD `{升/降}`，`{加元走软/走强}` 与`{油价/BoC政策}`相关；USD/CNY `{升/降}`，`{人民币走强/走软}`反映`{政策稳汇/贸易预期}`；两者形成`{一致/背离}`格局。
