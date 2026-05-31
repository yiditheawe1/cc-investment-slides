'use strict';
const path    = require('path');
const fs      = require('fs');
const pptxgen = require(require('path').resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));

const C = {
  bg:'0F172A', card:'1E293B', white:'FFFFFF', slate:'94A3B8',
  teal:'0D9488', green:'22C55E', red:'EF4444', muted:'64748B',
  divider:'2D3F55', amber:'F59E0B', blue:'3B82F6',
  purple:'8B5CF6', emerald:'10B981',
};
const mkShadow = () => ({ type:'outer', color:'000000', blur:5, offset:2, angle:135, opacity:0.18 });

// ── Load market snapshot
const MKT  = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'market-index.json'), 'utf8'));
const DATE = MKT.date;
const DATE_DISPLAY = new Date(DATE + 'T12:00:00Z')
  .toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

// ════════════════════════════════════════════════════════════
//  ANALYSIS  — synthesized from live news (May 31 2026)
//  Sources: CoinDesk · Alternative.me · CoinMarketCap ·
//           Investing.com (Crypto/Stock/Forex/Bonds/Overview)
// ════════════════════════════════════════════════════════════
const ANALYSIS = {
  crypto: {
    trend:
      '加密恐惧贪婪指数从 23（极度恐惧）回升至 28（恐惧），情绪阶段性改善但仍处低迷区间。' +
      'BTC 主导率 57.2%，ETH/BTC 维持 0.02743（+0.15%）。' +
      '资金流分化：短期（15m -1,104万、4h -1.14亿）净流出，中长期（7D +4,651万、30D +57.91亿）仍正；' +
      '资金信号 +35 净流入，结构多头但短期承压。',
    cause:
      'BTC 与 ETH ETF 过去两周合计净流出约 20 亿美元，分析师警告跌势或将延续（Investing.com / CoinDesk）。' +
      'CME 集团 5 月 31 日正式推出全天候 24/7 加密货币期货交易，标志机构基础设施重要里程碑（Investing.com）。' +
      '美国"经济愤怒行动"没收约 10 亿美元伊朗加密资产，监管不确定性上升（CoinDesk）。' +
      'XRP ETF 同期逆势净流入 3,500 万美元，资金向山寨赛道轮动（CoinDesk）。',
    sources: [
      { name: 'CoinDesk',        url: 'coindesk.com' },
      { name: 'Investing.com',   url: 'investing.com/news/cryptocurrency-news' },
      { name: 'Alternative.me',  url: 'alternative.me/crypto/fear-and-greed-index' },
      { name: 'CoinMarketCap',   url: 'coinmarketcap.com/headlines' },
    ],
  },
  stock: {
    trend:
      'CNN 恐惧贪婪指数 60.17（贪婪），微升自 60.09。' +
      'VIX 进一步下跌至 15.32（-7.66%），波动率压缩至年内低位，市场做多情绪显著。' +
      'MM 牛熊指标 68.22（前值 61.69），NAAIM 经理人仓位 98.39（前值 82.02，4W均线 88.61）。' +
      'AAII 看多 35.56%（↑），看空 41.85%（↓），散户净空头但改善中；标普 500 维持 7,580 高位。',
    cause:
      '美伊停火谈判及乌克兰潜在停火预期推动九周连涨；市场聚焦新任美联储主席 Kevin Warsh' +
      '政策立场——鹰鸽特征尚不明朗，为市场定价增添不确定性（Investing.com）。' +
      'AI 经济正打破传统宏观指标框架，AI/半导体成为本轮最强赛道（Investing.com Market Overview）。' +
      'NAAIM 专业经理仓位 98.39 逼近历史极值，与 AAII 散户净空头并存；' +
      '两极分化格局历史上往往先于短期调整出现，VIX 15.32 预示尾部风险未定价。',
    sources: [
      { name: 'Investing.com Stock',    url: 'investing.com/news/stock-market-news' },
      { name: 'Investing.com Overview', url: 'investing.com/analysis/market-overview' },
      { name: 'NAAIM',                  url: 'naaim.org/programs/naaim-exposure-index' },
    ],
  },
  sofr: {
    trend:
      'SOFR 利率 3.62%（截至 5 月 28 日，周末无更新），处于 25th 分位（3.60%）与 75th 分位（3.68%）之间，' +
      '日成交量 3,139 亿美元。1st 分位 3.58%，99th 分位 3.72%，' +
      '分布区间稳定，短端资金市场平稳运行，美联储政策维持现状，无转向信号。',
  },
  rates: {
    trend:
      '美国 10 年期收益率 4.453%（-4.0 bps），30 年期 4.993%（-3.3 bps），从近期高点 5.197%（2007 年后最高）持续回落。' +
      '加拿大 5 年期 GOC 3.23%（+4 bps），CMB 3.37%（+5 bps）。' +
      'GOC/CMB 利差 14 bps，SOFR 3.62% 短端锚定，美债与加债方向背离延续。',
    cause:
      '【美债 / 长端】美伊停火谈判降低地缘风险溢价，美债收益率温和走低；' +
      '新任 Fed 主席 Kevin Warsh 货币政策方向不明，Investing.com 分析指出' +
      '"债券市场已不再相信旧有经济假设"，30Y 从 5.197% 高点回落反映短期避险买盘（Investing.com Bonds）。' +
      '财政部加速借贷持续收紧流动性，构成长端利率上行压力。\n\n' +
      '【SOFR / 短端】SOFR 在 3.62% 稳定，与 Fed 现持观望立场吻合；降息预期尚未实质推进。\n\n' +
      '【加拿大 GOC/CMB】+4/+5 bps 反映上周五定价；CMB 高于 GOC 反映住房信贷溢价，BoC 宽松时间表不明朗。',
    sources: [
      { name: 'Investing.com Bonds',    url: 'investing.com/analysis/bonds' },
      { name: 'Investing.com Headlines', url: 'investing.com/news/headlines' },
      { name: 'NY Fed SOFR',            url: 'newyorkfed.org/markets/reference-rates/sofr' },
      { name: 'Bank of Canada',         url: 'bankofcanada.ca/rates' },
    ],
  },
  forex: {
    trend:
      'USD/CAD 1.3795（前值 1.3802），加元微升约 0.05%。' +
      'USD/CNY 6.7657（前值 6.7945），人民币升值约 0.43%。' +
      'CAD/CNY 4.9041（前值 4.9219），加元对人民币走弱约 0.36%。' +
      '美元对人民币明显偏弱；加元在三边格局中相对承压。',
    cause:
      '【美元偏弱】伊朗 / 乌克兰潜在停火提升风险偏好，美元承压；' +
      '摩根大通预判美元长期偏弱，因高债务与财政挑战削弱美元结构性支撑（Investing.com Forex）。' +
      '尽管美元 5 月受高利率支撑录得月度上涨，短期在停火预期下走软。\n\n' +
      '【人民币走强】中国制造业竞争优势支撑人民币，贸易顺差结构性支持，油价回落改善进口成本。\n\n' +
      '【加元相对弱势】油价从峰值回落逾 20% 压制资源货币；BoC 降息路径不明令 CAD 承压；' +
      'CAD/CNY 跌幅（-0.36%）大于 USD/CAD（-0.05%），反映加元三边相对弱势。',
    sources: [
      { name: 'Investing.com Forex',    url: 'investing.com/news/forex-news' },
      { name: 'Investing.com Overview', url: 'investing.com/analysis/market-overview' },
    ],
  },

  // ── Slide 10: 配置建议
  recs: [
    { asset: 'BTC',          dir: '谨慎做多', isLong: true,  adj: '+3%',  conviction: '低',
      reason: 'F&G 28 从极恐区回升，CME 24/7 期货上线标志机构基础设施扩展；但 ETF 持续净流出（$20亿）且分析师警告跌势或延续，建议小仓试探，以 F&G 升破 35 为加仓信号' },
    { asset: '美股（大盘）', dir: '持有观望', isLong: null,  adj: '持平',  conviction: '中',
      reason: 'VIX 15.32 年内低位、NAAIM 98.39 历史极值，市场充分定价乐观预期；Kevin Warsh 政策立场不明增添不确定性，九周连涨后缺乏新催化剂，建议持仓不追高' },
    { asset: 'AI / 半导体',  dir: '增持',    isLong: true,  adj: '+5%',  conviction: '高',
      reason: '美股九周连涨中 AI/半导体为最强赛道；AI 经济正打破传统宏观框架（Investing.com），结构性增长逻辑完整；VIX 低位期权成本低，可用 covered call 策略降低持仓成本' },
    { asset: '美债 10Y/30Y', dir: '短期持有', isLong: true,  adj: '+3%',  conviction: '中',
      reason: '30Y 从 5.197% 历史高位回落，收益率温和下行；停火谈判 + 短期避险买盘支撑；止盈位 10Y 4.38%，若 Warsh 鹰派转向或 CPI 超预期则快速止损' },
    { asset: '加元（CAD）',  dir: '轻度减仓', isLong: false, adj: '−3%',  conviction: '中',
      reason: '油价从峰值跌 20%，CAD/CNY 三边最弱，BoC 降息路径不明；若 WTI 跌破 $80 则加速减仓，若油价企稳则重新评估' },
    { asset: '人民币资产',   dir: '关注增持', isLong: true,  adj: '+3%',  conviction: '中',
      reason: '制造业竞争优势支撑人民币升值，摩根大通看淡美元长期走势形成对比；油价回落改善贸易条件；可逐步建立敞口' },
  ],

  // ── Slide 11: 关键风险 & 观察指标
  watches: [
    { label: '美伊 / 乌克兰停火谈判（本周关键）',
      detail: '若正式停火协议落地 → 油价承压、加元走软、VIX 有望降至 14 以下，美债短期反弹；若谈判破裂 → VIX 快速回升 20+，地缘风险溢价重新定价。' },
    { label: 'Kevin Warsh 货币政策立场明朗化',
      detail: 'Warsh 鹰鸽特征尚不确认；Investing.com 分析指出"债券市场已不再相信旧有经济假设"。若暗示鹰派 → 长端收益率反弹，成长股承压；若鸽派确认 → VIX 进一步压缩，AI/科技继续受益。' },
    { label: 'NAAIM 超买（6 月 3 日披露）',
      detail: '若仓位维持 95+ 则超买风险持续累积；历史数据显示 NAAIM 98+ 后 2 周内标普平均回调 2-3%；若回落至 85 以下则调整风险缓解。' },
    { label: 'BTC ETF 资金流向逆转',
      detail: '连续净流出是加密下行的核心压制。三项反转信号：① 日净流入转正 ② F&G 升破 35 连续 2 日 ③ 短期资金流（15m/4h）由负转正，满足两项即为确认信号。' },
    { label: '美联储 6 月议息 & 5 月 CPI（6/11）',
      detail: 'Warsh 政策立场不明下，CPI 若超预期 → 收益率反弹、NAAIM 高仓位面临重新定价；若符合或低于预期 → VIX 进一步压缩，AI/半导体继续受益。' },
  ],
};

// ════════════════════════════════════════════════════════════
//  SLIDE HELPERS
// ════════════════════════════════════════════════════════════

function accentBar(slide, pres, color) {
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.08, h:5.625, fill:{color}, line:{color, width:0} });
}

function slideHeader(slide, pres, title, accent) {
  slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:0.24, w:0.07, h:0.07, fill:{color:accent}, line:{color:accent, width:0} });
  slide.addText(title, { x:0.67, y:0.1, w:7.3, h:0.44, fontSize:20, bold:true, color:C.white, valign:'middle', margin:0 });
  slide.addText(DATE_DISPLAY, { x:7.9, y:0.1, w:1.95, h:0.44, fontSize:9, color:C.slate, align:'right', valign:'middle', margin:0 });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:0.63, w:9.3, h:0.018, fill:{color:C.divider}, line:{color:C.divider, width:0} });
}

function addCard(slide, pres, x, y, w, h, { name, value, change, dir, date }) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const isNA = !value || value === 'N/A';
  const pad=0.13, cx=x+pad, cw=w-pad*2, cy=y+h/2;
  slide.addText(name, { x:cx, y:y+0.1, w:cw, h:0.22, fontSize:9, color:C.slate, margin:0 });
  if (isNA) {
    slide.addText('N/A', { x:cx, y:cy-0.15, w:cw, h:0.3, fontSize:18, bold:true, color:C.muted, align:'center', margin:0 });
  } else {
    const fs = value.length > 9 ? 17 : 22;
    slide.addText(value, { x:cx, y:cy-0.3, w:cw, h:0.55, fontSize:fs, bold:true, color:C.white, align:'center', valign:'middle', margin:0 });
    if (change && change !== '—') {
      const chgColor = dir==='up' ? C.green : dir==='down' ? C.red : C.slate;
      slide.addText(change, { x:cx, y:cy+0.27, w:cw, h:0.24, fontSize:9, color:chgColor, align:'center', margin:0 });
    }
  }
  if (date && date !== '—') {
    slide.addText(date, { x:cx, y:y+h-0.22, w:cw, h:0.18, fontSize:7, color:C.muted, align:'right', margin:0 });
  }
}

function addFundFlowCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const pad=0.1, titleH=0.28;
  slide.addText('加密货币资金流', { x:x+pad, y:y+0.06, w:w*0.65, h:titleH-0.06, fontSize:9, color:C.slate, margin:0 });
  slide.addText(d.date, { x:x+w*0.65, y:y+0.06, w:w*0.35-pad, h:titleH-0.06, fontSize:7, align:'right', color:C.muted, margin:0 });
  const bodyY=y+titleH, bodyH=h-titleH, cw=w/3, ch=bodyH/2;
  slide.addShape(pres.shapes.RECTANGLE, { x,        y:bodyY,      w,       h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+cw,   y:bodyY,      w:0.01,  h:bodyH, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+cw*2, y:bodyY,      w:0.01,  h:bodyH, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x,        y:bodyY+ch,   w,       h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  d.items.forEach((item, i) => {
    const col=i%3, row=Math.floor(i/3), cx2=x+col*cw, cy2=bodyY+row*ch;
    const valColor = item.dir==='up' ? C.green : item.dir==='down' ? C.red : C.slate;
    slide.addText(item.label, { x:cx2+pad, y:cy2+0.05, w:cw-pad*2, h:0.18, fontSize:7,  align:'center', color:C.slate,    margin:0 });
    slide.addText(item.value, { x:cx2+pad, y:cy2+0.21, w:cw-pad*2, h:ch-0.26, fontSize:11, align:'center', valign:'middle', bold:true, color:valColor, margin:0 });
  });
}

function addQuadCard(slide, pres, x, y, w, h, cfg) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const pad=0.1, titleH=0.28, bodyY=y+titleH, bodyH=h-titleH, cw=w/2, ch=bodyH/2;
  slide.addText(cfg.title, { x:x+pad, y:y+0.06, w:w-pad*2, h:titleH-0.06, fontSize:9, color:C.slate, margin:0 });
  slide.addShape(pres.shapes.RECTANGLE, { x,     y:bodyY,     w,      h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+cw,y:bodyY,     w:0.01, h:bodyH, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x,     y:bodyY+ch,  w,      h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  [[cfg.tl,0,0,true],[cfg.tr,1,0,true],[cfg.bl,0,1,false],[cfg.br,1,1,false]]
    .forEach(([cell, col, row, isTop]) => {
      const cx2=x+col*cw, cy2=bodyY+row*ch;
      slide.addText(cell.label, { x:cx2+pad, y:cy2+0.05, w:cw-pad*2, h:0.18, fontSize:8,  color:C.slate, margin:0 });
      slide.addText(cell.value, { x:cx2+pad, y:cy2+0.21, w:cw-pad*2, h:ch-0.26, fontSize:15, bold:true, color:isTop?C.white:C.teal, valign:'middle', margin:0 });
    });
  if (cfg.note) slide.addText(cfg.note, { x:x+pad, y:y+h-0.18, w:w-pad*2, h:0.15, fontSize:7, color:C.muted, align:'right', margin:0 });
}

function addNaaimCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const pad=0.1, midX=x+w/2;
  slide.addText('NAAIM 经理人持仓', { x:x+pad, y:y+0.07, w:w-pad*2, h:0.22, fontSize:9, color:C.slate, margin:0 });
  const div1Y=y+0.36, div2Y=y+h*0.54;
  slide.addShape(pres.shapes.RECTANGLE, { x:x+pad,      y:div1Y, w:w-pad*2,              h:0.012, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+pad,      y:div2Y, w:w-pad*2,              h:0.012, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:midX-0.007, y:div1Y, w:0.012, h:y+h-0.18-div1Y, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  const r1y=div1Y+0.05, r2y=div2Y+0.05, cellW=w/2-pad-0.04, lx1=x+pad+0.04, lx2=midX+0.04;
  slide.addText('当前',    { x:lx1, y:r1y,       w:cellW, h:0.18, fontSize:8,  color:C.slate, margin:0 });
  slide.addText('前值',    { x:lx2, y:r1y,       w:cellW, h:0.18, fontSize:8,  color:C.slate, margin:0 });
  slide.addText(d.current, { x:lx1, y:r1y+0.18,  w:cellW, h:0.32, fontSize:15, bold:true, color:C.white, margin:0 });
  slide.addText(d.prev,    { x:lx2, y:r1y+0.18,  w:cellW, h:0.32, fontSize:15, bold:true, color:C.white, margin:0 });
  slide.addText('4W MA 当前', { x:lx1, y:r2y,       w:cellW, h:0.18, fontSize:8,  color:C.slate, margin:0 });
  slide.addText('4W MA 前值', { x:lx2, y:r2y,       w:cellW, h:0.18, fontSize:8,  color:C.slate, margin:0 });
  slide.addText(d.ma4w,    { x:lx1, y:r2y+0.18,  w:cellW, h:0.32, fontSize:15, bold:true, color:C.teal, margin:0 });
  slide.addText(d.ma4wPrev,{ x:lx2, y:r2y+0.18,  w:cellW, h:0.32, fontSize:15, bold:true, color:C.teal, margin:0 });
  slide.addText('as of '+d.date, { x:x+pad, y:y+h-0.2, w:w-pad*2, h:0.15, fontSize:7, color:C.muted, align:'right', margin:0 });
}

function addSofrCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const pad=0.1, titleH=0.28;
  slide.addText('SOFR', { x:x+pad, y:y+0.06, w:w*0.55, h:titleH-0.06, fontSize:10, color:C.slate, margin:0 });
  slide.addText('as of '+d.date, { x:x+w*0.55, y:y+0.06, w:w*0.45-pad, h:titleH-0.06, fontSize:8, align:'right', color:C.muted, margin:0 });
  const bodyY=y+titleH, bodyH=h-titleH, cw=w/3, ch=bodyH/2;
  slide.addShape(pres.shapes.RECTANGLE, { x,         y:bodyY,     w,       h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+cw,    y:bodyY,     w:0.01,  h:bodyH, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x:x+cw*2,  y:bodyY,     w:0.01,  h:bodyH, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addShape(pres.shapes.RECTANGLE, { x,         y:bodyY+ch,  w,       h:0.01,  fill:{color:C.divider}, line:{color:C.divider, width:0} });
  d.cells.forEach((cell, i) => {
    const col=i%3, row=Math.floor(i/3), cx2=x+col*cw, cy2=bodyY+row*ch;
    slide.addText(cell.label, { x:cx2+pad, y:cy2+0.06, w:cw-pad*2, h:0.2,       fontSize:8,  align:'center', color:C.slate, margin:0 });
    slide.addText(cell.value, { x:cx2+pad, y:cy2+0.24, w:cw-pad*2, h:ch-0.3,    fontSize:18, bold:true, align:'center', valign:'middle', color:cell.label==='Vol ($B)' ? C.white : C.teal, margin:0 });
  });
}

// Trend text block — bottom strip of trend slides
function addTrendBlock(slide, pres, x, y, w, h, text) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  const pad=0.15;
  slide.addText('市场走势', { x:x+pad, y:y+0.08, w:1.5, h:0.22, fontSize:9, bold:true, color:C.slate, margin:0 });
  slide.addShape(pres.shapes.RECTANGLE, { x, y:y+0.34, w, h:0.01, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addText(text, { x:x+pad, y:y+0.38, w:w-pad*2, h:h-0.45, fontSize:10, color:C.white, valign:'top', margin:0, wrap:true });
}

// Analysis slide — left: cause text, right: sources list
function buildAnalysisSlide(pres, title, accent, causeText, sources) {
  const slide = pres.addSlide();
  slide.background = { color:C.bg };
  accentBar(slide, pres, accent);
  slideHeader(slide, pres, title, accent);

  const x=0.55, y=0.75, areaH=4.65, gap=0.15;
  const causeW=5.85, srcW=3.3, srcX=x+causeW+gap;

  // Cause panel
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w:causeW, h:areaH, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  slide.addText('原因分析', { x:x+0.15, y:y+0.1, w:causeW-0.3, h:0.25, fontSize:10, bold:true, color:C.slate, margin:0 });
  slide.addShape(pres.shapes.RECTANGLE, { x, y:y+0.38, w:causeW, h:0.012, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  slide.addText(causeText, { x:x+0.15, y:y+0.43, w:causeW-0.3, h:areaH-0.55, fontSize:11, color:C.white, valign:'top', margin:0, wrap:true });

  // Sources panel
  slide.addShape(pres.shapes.RECTANGLE, { x:srcX, y, w:srcW, h:areaH, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
  slide.addText('消息源', { x:srcX+0.15, y:y+0.1, w:srcW-0.3, h:0.25, fontSize:10, bold:true, color:C.slate, margin:0 });
  slide.addShape(pres.shapes.RECTANGLE, { x:srcX, y:y+0.38, w:srcW, h:0.012, fill:{color:C.divider}, line:{color:C.divider, width:0} });
  sources.forEach((src, i) => {
    const sy = y + 0.52 + i * 0.75;
    slide.addText('• ' + src.name, { x:srcX+0.15, y:sy,       w:srcW-0.3, h:0.25, fontSize:11, bold:true,  color:C.teal,  margin:0 });
    slide.addText(src.url,          { x:srcX+0.15, y:sy+0.27,  w:srcW-0.3, h:0.35, fontSize:8,  color:C.muted, margin:0, wrap:true });
  });
}

// ── Slide 10: 配置建议 table
function buildRecsSlide(pres) {
  const COLS = [
    { x:0.55,  w:1.15, label:'资产',     align:'left'   },
    { x:1.72,  w:1.28, label:'方向',     align:'center' },
    { x:3.02,  w:0.82, label:'调仓幅度', align:'center' },
    { x:3.86,  w:0.78, label:'信心',     align:'center' },
    { x:4.66,  w:5.19, label:'核心理由', align:'left'   },
  ];
  const HDR_H = 0.38, ROW_H = 0.70, Y0 = 0.75;
  const slide = pres.addSlide();
  slide.background = { color:C.bg };
  accentBar(slide, pres, C.teal);
  slideHeader(slide, pres, '配置建议', C.teal);

  // Header row
  slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:Y0, w:9.3, h:HDR_H, fill:{color:C.card}, line:{color:C.divider, width:0} });
  COLS.forEach(col => {
    slide.addText(col.label, { x:col.x+0.1, y:Y0+0.07, w:col.w-0.15, h:HDR_H-0.14, fontSize:9, bold:true, color:C.slate, align:col.align, valign:'middle', margin:0 });
  });

  ANALYSIS.recs.forEach((rec, i) => {
    const y = Y0 + HDR_H + i * ROW_H;
    const rowBg = i % 2 === 0 ? '182334' : '111827';
    slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y, w:9.3, h:ROW_H, fill:{color:rowBg}, line:{color:C.divider, width:0} });
    slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:y+ROW_H-0.012, w:9.3, h:0.012, fill:{color:C.divider}, line:{color:C.divider, width:0} });

    // Asset
    slide.addText(rec.asset, { x:COLS[0].x+0.1, y, w:COLS[0].w-0.12, h:ROW_H, fontSize:10, bold:true, color:C.white, valign:'middle', margin:0 });

    // Direction badge
    const badgeColor = rec.isLong === true ? C.green : rec.isLong === false ? C.amber : C.muted;
    const arrow      = rec.isLong === true ? '▲ ' : rec.isLong === false ? '▼ ' : '— ';
    const badgeX = COLS[1].x + 0.08, badgeY = y + 0.14, badgeW = COLS[1].w - 0.16, badgeH = ROW_H - 0.28;
    slide.addShape(pres.shapes.RECTANGLE, { x:badgeX, y:badgeY, w:badgeW, h:badgeH, fill:{color:badgeColor}, line:{color:badgeColor, width:0} });
    slide.addText(arrow + rec.dir, { x:badgeX, y:badgeY, w:badgeW, h:badgeH, fontSize:9, bold:true, color:'0F172A', align:'center', valign:'middle', margin:0 });

    // 调仓幅度
    const adjColor = rec.adj.startsWith('+') ? C.green : rec.adj.startsWith('−') || rec.adj.startsWith('-') ? C.red : C.slate;
    slide.addText(rec.adj, { x:COLS[2].x, y, w:COLS[2].w, h:ROW_H, fontSize:12, bold:true, color:adjColor, align:'center', valign:'middle', margin:0 });

    // 信心
    const convColor = rec.conviction === '高' ? C.green : rec.conviction === '中' ? C.amber : C.muted;
    slide.addText(rec.conviction, { x:COLS[3].x, y, w:COLS[3].w, h:ROW_H, fontSize:11, bold:true, color:convColor, align:'center', valign:'middle', margin:0 });

    // 理由
    slide.addText(rec.reason, { x:COLS[4].x+0.1, y:y+0.04, w:COLS[4].w-0.18, h:ROW_H-0.08, fontSize:9, color:C.slate, valign:'middle', margin:0, wrap:true });
  });

  slide.addText('* 以上建议仅供参考，不构成投资意见。请结合自身风险承受能力独立判断。', {
    x:0.55, y:5.33, w:9.3, h:0.19, fontSize:7, color:C.muted, italic:true, align:'center', valign:'middle', margin:0,
  });
}

// ── Slide 11: 关键风险 & 观察指标
function buildWatchSlide(pres) {
  const ITEM_H = 0.80, Y0 = 0.76;
  const slide = pres.addSlide();
  slide.background = { color:C.bg };
  accentBar(slide, pres, C.teal);
  slideHeader(slide, pres, '关键风险 & 观察指标', C.teal);

  ANALYSIS.watches.forEach((w, i) => {
    const y = Y0 + i * (ITEM_H + 0.07);
    slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y, w:9.3, h:ITEM_H, fill:{color:C.card}, shadow:mkShadow(), line:{color:C.divider, width:0.5} });
    slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y, w:0.05, h:ITEM_H, fill:{color:C.teal}, line:{color:C.teal, width:0} });
    slide.addText(w.label, { x:0.72, y:y+0.08, w:9.0, h:0.25, fontSize:11, bold:true, color:C.white, margin:0 });
    slide.addText(w.detail, { x:0.72, y:y+0.36, w:9.0, h:ITEM_H-0.42, fontSize:9.5, color:C.slate, valign:'top', margin:0, wrap:true });
  });
}

// ════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.title  = 'Market Change Analysis';

  // Layout constants shared by trend slides
  const SX=0.55, SY=0.75, AW=9.3, GAP=0.15;
  const CARD_AREA_H = 2.95;
  const TREND_Y     = SY + CARD_AREA_H + 0.1;
  const TREND_H     = 5.42 - TREND_Y;

  // ── Slide 0: Cover ──────────────────────────────────────
  const cover = pres.addSlide();
  cover.background = { color:C.bg };
  cover.addShape(pres.shapes.RECTANGLE, { x:0, y:0,    w:0.08, h:5.625, fill:{color:C.teal},   line:{color:C.teal,   width:0} });
  cover.addShape(pres.shapes.RECTANGLE, { x:0, y:5.25, w:10,   h:0.375, fill:{color:'0A1628'}, line:{color:'0A1628', width:0} });
  cover.addShape(pres.shapes.RECTANGLE, { x:0, y:5.247,w:10,   h:0.02,  fill:{color:C.teal},   line:{color:C.teal,   width:0} });
  cover.addText('Market Change Analysis',                 { x:0.65, y:1.5,  w:8.8, h:1.1,  fontSize:38, bold:true,    color:C.white, margin:0 });
  cover.addText(DATE + '  •  ' + DATE_DISPLAY,           { x:0.65, y:2.7,  w:8.8, h:0.5,  fontSize:18,              color:C.slate, margin:0 });
  cover.addText('Trend & Cause Analysis — Live Market Indicators', { x:0.65, y:3.3, w:8.8, h:0.4, fontSize:12, italic:true, color:C.muted, margin:0 });
  cover.addText('CRYPTO  •  STOCK  •  SOFR  •  RATES  •  FOREX', { x:0.65, y:5.265, w:9.2, h:0.33, fontSize:9, align:'right', valign:'middle', color:C.slate, charSpacing:2, margin:0 });

  // ── Slide 1: CRYPTO 走势 ────────────────────────────────
  {
    const sl = pres.addSlide(); sl.background = { color:C.bg };
    accentBar(sl, pres, C.amber);
    slideHeader(sl, pres, 'CRYPTO — 市场走势', C.amber);
    const cw=(AW-GAP)/2, ch=(CARD_AREA_H-GAP)/2;
    addCard(sl, pres, SX,          SY,          cw, ch, { name:'Crypto Fear & Greed', ...MKT.cryptoFG });
    addCard(sl, pres, SX+cw+GAP,   SY,          cw, ch, { name:'BTC Dominance',       ...MKT.btcDom   });
    addFundFlowCard(sl, pres, SX,   SY+ch+GAP,  cw, ch, MKT.fundFlow);
    addCard(sl, pres, SX+cw+GAP,   SY+ch+GAP,  cw, ch, { name:'ETH / BTC',           ...MKT.ethBtc   });
    addTrendBlock(sl, pres, SX, TREND_Y, AW, TREND_H, ANALYSIS.crypto.trend);
  }

  // ── Slide 2: CRYPTO 分析 ────────────────────────────────
  buildAnalysisSlide(pres, 'CRYPTO — 原因分析', C.amber, ANALYSIS.crypto.cause, ANALYSIS.crypto.sources);

  // ── Slide 3: STOCK 走势 ─────────────────────────────────
  {
    const sl = pres.addSlide(); sl.background = { color:C.bg };
    accentBar(sl, pres, C.blue);
    slideHeader(sl, pres, 'STOCK — 市场走势', C.blue);
    const cw=(AW-GAP*2)/3, ch=(CARD_AREA_H-GAP)/2;
    // Row 0
    addCard(sl,     pres, SX,            SY, cw, ch, { name:'CNN Fear & Greed', ...MKT.cnnFG });
    addCard(sl,     pres, SX+cw+GAP,     SY, cw, ch, { name:'CBOE VIX',         ...MKT.vix   });
    addQuadCard(sl, pres, SX+cw*2+GAP*2, SY, cw, ch, {
      title: 'MM Bull/Bear  &  S&P 500',
      tl:{ label:'MM 当前',   value:MKT.mm.mmCurrent    },
      tr:{ label:'MM 前值',   value:MKT.mm.mmPrev       },
      bl:{ label:'S&P 当前',  value:MKT.mm.sp500Current },
      br:{ label:'S&P 前值',  value:MKT.mm.sp500Prev    },
      note:'as of ' + MKT.mm.date,
    });
    // Row 1
    addQuadCard(sl, pres, SX,            SY+ch+GAP, cw, ch, {
      title: 'AAII 情绪调查',
      tl:{ label:'看多 当前', value:MKT.aaii.bullCurrent },
      tr:{ label:'看多 前值', value:MKT.aaii.bullPrev    },
      bl:{ label:'看空 当前', value:MKT.aaii.bearCurrent },
      br:{ label:'看空 前值', value:MKT.aaii.bearPrev    },
      note:'as of ' + MKT.aaii.date,
    });
    addNaaimCard(sl, pres, SX+cw+GAP,    SY+ch+GAP, cw, ch, MKT.naaim);
    // slot [1][2] intentionally empty
    addTrendBlock(sl, pres, SX, TREND_Y, AW, TREND_H, ANALYSIS.stock.trend);
  }

  // ── Slide 4: STOCK 分析 ─────────────────────────────────
  buildAnalysisSlide(pres, 'STOCK — 原因分析', C.blue, ANALYSIS.stock.cause, ANALYSIS.stock.sources);

  // ── Slide 5: SOFR 走势 ──────────────────────────────────
  {
    const sl = pres.addSlide(); sl.background = { color:C.bg };
    accentBar(sl, pres, C.purple);
    slideHeader(sl, pres, 'SOFR — 市场走势', C.purple);
    addSofrCard(sl, pres, SX, SY, AW, CARD_AREA_H, MKT.sofr);
    addTrendBlock(sl, pres, SX, TREND_Y, AW, TREND_H, ANALYSIS.sofr.trend);
  }

  // ── Slide 6: 利率 走势 ──────────────────────────────────
  {
    const sl = pres.addSlide(); sl.background = { color:C.bg };
    accentBar(sl, pres, C.purple);
    slideHeader(sl, pres, '利率 (RATES) — 市场走势', C.purple);
    const cw=(AW-GAP)/2, rh=(CARD_AREA_H-GAP)/2;
    addCard(sl, pres, SX,        SY,        cw, rh, { name:'US 10Y Treasury', ...MKT.us10y   });
    addCard(sl, pres, SX+cw+GAP, SY,        cw, rh, { name:'US 30Y Treasury', ...MKT.us30y   });
    addCard(sl, pres, SX,        SY+rh+GAP, cw, rh, { name:'Canada 5Y GOC',   ...MKT.ca5yGoc });
    addCard(sl, pres, SX+cw+GAP, SY+rh+GAP, cw, rh, { name:'Canada 5Y CMB',   ...MKT.ca5yCmb });
    addTrendBlock(sl, pres, SX, TREND_Y, AW, TREND_H, ANALYSIS.rates.trend);
  }

  // ── Slide 7: 利率 & SOFR 分析 ───────────────────────────
  buildAnalysisSlide(pres, '利率 & SOFR — 原因分析', C.purple, ANALYSIS.rates.cause, ANALYSIS.rates.sources);

  // ── Slide 8: FOREX 走势 ─────────────────────────────────
  {
    const sl = pres.addSlide(); sl.background = { color:C.bg };
    accentBar(sl, pres, C.emerald);
    slideHeader(sl, pres, 'FOREX — 市场走势', C.emerald);
    const cw=(AW-GAP*2)/3;
    addCard(sl, pres, SX,           SY, cw, CARD_AREA_H, { name:'USD / CAD', ...MKT.usdCad });
    addCard(sl, pres, SX+cw+GAP,    SY, cw, CARD_AREA_H, { name:'USD / CNY', ...MKT.usdCny });
    addCard(sl, pres, SX+cw*2+GAP*2,SY, cw, CARD_AREA_H, { name:'CAD / CNY', ...MKT.cadCny });
    addTrendBlock(sl, pres, SX, TREND_Y, AW, TREND_H, ANALYSIS.forex.trend);
  }

  // ── Slide 9: FOREX 分析 ─────────────────────────────────
  buildAnalysisSlide(pres, 'FOREX — 原因分析', C.emerald, ANALYSIS.forex.cause, ANALYSIS.forex.sources);

  // ── Slide 10: 配置建议 ───────────────────────────────────
  buildRecsSlide(pres);

  // ── Slide 11: 关键风险 & 观察指标 ───────────────────────
  buildWatchSlide(pres);

  // ── Write output
  const outFile = `market-change-analysis_${DATE.replace(/-/g, '_')}.pptx`;
  await pres.writeFile({ fileName: outFile });
  console.log('SUCCESS: ' + outFile);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
