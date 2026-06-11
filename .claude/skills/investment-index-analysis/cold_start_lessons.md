# Cold Start Lessons — investment-index-analysis Skill

> 历史经验、来源分工、工作流模板、叙事模板。  
> **日常运行无需读此文件**——cold_start.md（Sections 1+2）已包含所有操作所需内容。  
> 仅在调试来源异常、需要历史教训参考或查阅叙事模板时读取。

---

## 3. 数据来源分工（推荐组合，2026-05-31 更新）

| 类别 | 主力来源 | 补充来源 | 说明 |
|------|----------|----------|------|
| CRYPTO 新闻 | CoinDesk (WebFetch) + The Block (Playwright) | Alternative.me + CoinMarketCap (WebFetch) | The Block 已确认可用 Playwright |
| STOCK 新闻 | CNBC (Playwright) + CNN Business/Investing (Playwright) | MarketWatch (Playwright) + NAAIM (WebFetch) | 3 个 Playwright 股票源，覆盖大幅提升 |
| SOFR / 利率 | market-index.json 数据 + CNBC 政策报道 | **Investing.com/analysis/market-overview**（bonds 偶尔为空时的主力替补） | ⚠️ Investing.com/analysis/bonds 偶尔完全空页；market-overview 是更稳定的利率驱动来源 |
| FOREX | Investing.com forex (WebFetch) + CNBC (Playwright) | Investing.com/analysis/market-overview | MarketWatch 也可作外汇驱动背景补充 |
| 跨板块宏观 | Bloomberg Markets (Playwright，仅标题) + Investing.com market-overview (WebFetch) | Yahoo Finance News (Playwright) | Bloomberg 标题层可用，但不引用付费墙内容 |

**核心原则**：Playwright 现覆盖 8 个来源（旧：仅 CNBC）。优先 WebFetch，403 或 JS 渲染时切换 Playwright。

---

## 4. 经验教训

| 教训 | 原因 | 解决方法 |
|------|------|----------|
| ~~Bloomberg 在 Playwright 下也是登录墙~~ **已更新** | 2026-05-31 实测：Playwright 可抓标题层 | 可用于标题补充，正文付费墙不引用具体论点 |
| ~~Yahoo Finance /news/ 返回 503~~ **已更新** | 2026-05-31 实测：Playwright 可抓 10 条完整标题 | 直接用 Playwright evaluate |
| ~~Reuters 和 MarketWatch 完全阻断~~ **部分更新** | MarketWatch 2026-05-31 实测可用；Reuters 仍实际阻断（仅 3 条无实质内容） | MarketWatch 改用 Playwright；Reuters 仍用 CNBC/Investing.com 替代 |
| ~~Bank of Canada `/rates/` 只有导航~~ **重新修正（2026-05-31 第二次测试）** | /rates/ 和 /rates/interest-rates/ 均为纯导航页，browser_evaluate 仅返回链接列表，无数值。第一次测试结论有误 | 放弃 Bank of Canada 作为 Playwright 数据源；利率数据读 market-index.json，利率分析来源从 CNBC + Investing.com 补充 |
| ~~CNN `business/investing` 为 451~~ **已更新** | 2026-05-31 实测：Playwright 可抓 10 条完整标题 | 直接用 Playwright evaluate（注：旧 URL `cnn.com/markets/fear-and-greed` 仍 451） |
| ~~The Block 403~~ **已更新** | 2026-05-31 实测：Playwright 可抓完整新闻标题 | 直接用 Playwright evaluate |
| US Treasury 原 URL 已 404 | `home.treasury.gov/resource-center/data-chart-center/interest-rates/` 页面已下线 | 不尝试此 URL；10Y/30Y 数据直接读 market-index.json |
| AAII 返回空 body | 对 WebFetch 完全不响应 | 实际数据读 market-index.json；在分析文本中引用 AAII 作为来源名称即可 |
| CNBC 用 WebFetch 返回 403 | 需要真实浏览器 UA | 改用 Playwright + evaluate（不要用 snapshot） |
| `browser_close()` 返回 "No open tabs" | 前序 Playwright 调用已隐式关闭页面，或页面在两次工具调用间自动关闭 | 正常现象，可忽略；不需要重新导航或报错 |
| Investing.com/analysis/bonds 偶尔返回 0 篇文章 | 2026-05-31 实测：bonds 分析页当天完全无文章（页面加载但内容列表为空） | 不要为此重试；利率分析转用 Investing.com/analysis/market-overview + CNBC 作为主力来源，可完全覆盖利率驱动分析 |
| Phase A subagent 大幅减少 Phase B 需求 | 2026-05-31 首次实测 subagent 模式：13 个 URL 并行返回 <1000 words 摘要，CRYPTO 获 5 个来源、STOCK 3 个、FOREX 2 个，仅需 1 次 Phase B Playwright（CNBC），较旧模式减少 6 次调用 | subagent 模式已验证可用；Phase B 应按实际缺口决定，而非固定跑完全部 7 个来源 |
| market-index.json 中 ca5yCmb 曾存错误值 | 首次抓 canadaici.com 用 `[0]` 取到 GOC（3.19%）而非 CMB（3.32%） | 利率分析时区分 GOC 和 CMB；market-index.json 现已同时含两个字段 |
| Playwright MCP tools not found at session start (2026-06-03) | `settings.local.json` 中 playwright MCP 条目有 `autoRestart` 等生命周期标志，但**缺少 `command` 和 `args`**，harness 无法启动进程，服务器静默失败 | 修复：在 `settings.local.json` 的 playwright 条目中加入 `"command": "node"` 和 `"args": ["E:\\CC项目\\node_modules\\@playwright\\mcp\\cli.js"]`，然后**重启 session**。 |
| mid-session `npx @playwright/mcp@latest &` 无效 (2026-06-09) | MCP 使用 stdio；harness 在 session 启动时建立连接，之后无法中途注入新进程——bash `&` 启动的进程对 harness 不可见，ToolSearch 仍返回空 | 唯一有效的修复是**重启 session**（让 harness 重新走启动序列）。mid-session 手动启动没有意义，不要尝试。 |
| Playwright 不可用时 LIVE_MANUAL 旧值被复用 (2026-06-09) | Playwright 启动失败，slides skill 在 WebFetch-only 模式下保留了脚本中的 Jun 8 数据（cnnFG/ca5y），Jun 9 的幻灯片和 market-index.json 中出现了昨天的数字 | **分析前必须检查 market-index.json 中每个 Playwright-only 指标的 `date` 字段**。若日期早于今天，在分析文本中标注"数据截至 X 日，待刷新"，不得将其作为当天数据引用。 |

---

## 5. 推荐工作流（2026-05-31 更新，含上下文优化）

目标：每板块 ≥3 来源，CRYPTO/STOCK 争取 4+。

```
Phase A — 单个 subagent 并行 WebFetch（原始 HTML 不进主上下文）:
  用 Agent tool 派发 general-purpose subagent，prompt 要求：
  · 并行 fetch 全部 13 个 URL
  · 每个 URL 最多返回 6 条 bullet（headline | date | 1句摘要，≤20字）
  · 每个来源总计 ≤80 words，整体 ≤1000 words
  · 仅保留今日或昨日文章，更早的直接跳过

→ Phase A 返回后立即 Read analysis-data.js（context 最轻窗口）

Phase B — 顺序 Playwright（主上下文，MCP 可用时）:
  ⚠️ 全程只用 browser_evaluate，禁止 browser_snapshot
  1. CNBC Markets          → STOCK + 宏观背景
  2. CNN Business/Investing → STOCK 交叉验证
  3. The Block              → CRYPTO 交叉验证
  4. MarketWatch            → STOCK + FOREX 补充
  5. Bloomberg Markets      → 跨板块标题层（仅标题，正文付费墙）
  6. Yahoo Finance News     → 有缺口的板块补充

  ⚠️ 若某板块已有 ≥3 个高质量 Phase A 来源，可跳过对应 Playwright 步骤

Phase C — 综合并写分析:
  - 对每板块汇总所有来源的标题/摘要
  - ≥2 来源验证的论点标注"共识"；仅单一来源的标注"待验证"
  - 5 次 Edit 写入 analysis-data.js
  - node generate_investment_index_analysis.js
```

**上下文控制原则**：
- Phase A 的 13 次 WebFetch 通过 subagent 处理，主上下文节省约 300–500KB 原始 HTML
- Phase B 的 browser_evaluate 每次返回 <2KB JSON；browser_snapshot 每次可达 50KB+
- analysis-data.js 在 Phase B 前读取，避免 Playwright 结果将其挤出可见窗口

最低配置（Playwright 完全不可用）：**Phase A subagent** 已可覆盖全部板块（CRYPTO 5 源、STOCK 3 源、利率 2 源、FOREX 2 源）。

---

## 6. 关键分析叙事模板

以下为可复用的分析框架（根据当日数据填入具体数字）：

**CRYPTO**：`{地缘/宏观事件}` 引发 `{爆仓金额}` 多空清算，BTC 跌至 `{价位}`，F&G 降至 `{值}`（极度恐惧）。资金流向数据显示 `{净流入/净流出}`，暗示 `{机构吸筹/散户恐慌出逃}`。

**STOCK**：标普 500 `{上涨/下跌}` 受 `{事件}` 驱动，VIX `{变化方向}` 至 `{值}`。NAAIM 经理人仓位 `{值}`（`{高位/低位}`区间），AAII 散户 `{看多%}` vs `{看空%}`——两者`{一致/背离}`。

**利率**：美债收益率 `{下行/上行}` 受 `{避险需求/降息预期/通胀}` 驱动；SOFR 维稳于 `{值}`，联储信号`{鸽/鹰}`；加拿大 5Y GOC `{+/-X bps}`、CMB `{+/-X bps}`，利差 `{稳定/扩大/收窄}`，反映`{加央行政策路径}`。

**FOREX**：USD/CAD `{升/降}`，`{加元走软/走强}` 与`{油价/BoC政策}`相关；USD/CNY `{升/降}`，`{人民币走强/走软}`反映`{政策稳汇/贸易预期}`；两者形成`{一致/背离}`格局。
