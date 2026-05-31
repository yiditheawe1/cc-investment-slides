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
//  ANALYSIS  — synthesized from live news (May 29 2026)
//  Sources: CoinDesk · Alternative.me · CoinMarketCap ·
//           CNBC Markets · NAAIM · Canada ICI
// ════════════════════════════════════════════════════════════
const ANALYSIS = {
  crypto: {
    trend:
      '加密恐惧贪婪指数 23（极度恐惧），较前日 22 微升但仍处极恐区间；较一周前 28 下滑明显。' +
      'BTC 主导率 57.6% 横盘，ETH/BTC 小幅回升至 0.02757（+0.99%），ETH 阶段性跑赢 BTC。' +
      '资金信号全面转正：15m +2.80亿、4h +2.60亿、7D +2,746万、30D +59.64亿，资金信号 +38 净流入，' +
      '为近日首次短中长期资金流向全线翻绿。',
    cause:
      '比特币 ETF 遭遇历史最长 9 日连续净流出，累计撤资约 28 亿美元，机构情绪持续低迷（CoinDesk）。' +
      'BTC 价格未能突破 83,000 美元，在标普 500、纳斯达克双双创历史新高时出现罕见背离（CoinDesk）。' +
      'CryptoQuant 报告长期持有者仓位创历史新高，但"新买家严重不足"，预测市场看空（CoinDesk）。' +
      'CFTC 批准 Kalshi、Coinbase 首批加密永续期货合约，监管利好提振短期情绪（CoinMarketCap）。' +
      '今日资金流向全面转正或为技术性反弹买盘，需观察能否持续。',
    sources: [
      { name: 'CoinDesk',        url: 'coindesk.com' },
      { name: 'Alternative.me',  url: 'alternative.me/crypto/fear-and-greed-index' },
      { name: 'CoinMarketCap',   url: 'coinmarketcap.com/headlines' },
    ],
  },
  stock: {
    trend:
      'CNN 恐惧贪婪指数 59.83（贪婪），微降自前值 60.09，贪婪区间维持。' +
      'VIX 跌至 15.53（-6.39%），波动率大幅压缩至近期低位。' +
      'MM 牛熊指标 68.22（前值 61.69），多头信号持续增强。' +
      'AAII 看多 35.56%（↑自 31.72%），看空 41.85%（↓自 43.61%）。' +
      'NAAIM 经理人仓位急升至 98.39（前值 82.02），4 周均线 88.61，标普 500 升至 7,581 点新高。',
    cause:
      '美伊停火谈判推进令地缘风险溢价快速消退，油价从 2026 年峰值回落逾 20%，' +
      'VIX 随之大幅下行，标普 500 与纳斯达克同步创历史新高（CNBC）。' +
      '美联储理事 Bowman 明确警告不应因通胀短暂回升而加息，鸽派表态为股市提供货币政策支撑（CNBC）。' +
      'NAAIM 仓位一周急升 16 个百分点至 98.39，专业经理人极度看多，与 AAII 散户持续净空头形成两极分化。' +
      '极端多头仓位在历史上常为短期回调预警，市场宽度是否跟上指数创新高需密切监控。',
    sources: [
      { name: 'CNBC Markets',  url: 'cnbc.com/markets' },
      { name: 'NAAIM',         url: 'naaim.org/programs/naaim-exposure-index' },
      { name: 'AAII Survey',   url: 'aaii.com/sentimentsurvey' },
    ],
  },
  sofr: {
    trend:
      'SOFR 利率 3.62%（截至 5 月 28 日），处于 25th 分位（3.60%）与 75th 分位（3.68%）之间，' +
      '日成交量 3,139 亿美元，较上期小幅下降。1st 分位 3.58%，99th 分位 3.72%，分布区间稳定，' +
      '短端资金市场运行平稳，美联储政策维持现状无转向信号。',
  },
  rates: {
    trend:
      '美国 10 年期收益率降至 4.434%（-5.9 bps），30 年期降至 4.974%（-5.2 bps），长端双双回落。' +
      '加拿大 5 年期 GOC 升至 3.23%（+4 bps，前值 3.19%），CMB 升至 3.37%（+5 bps，前值 3.32%）。' +
      'GOC/CMB 利差 14 bps 略有扩大，美债与加拿大债券方向背离，' +
      'SOFR 3.62% 维持稳定，短端锚定效应依旧显著。',
    cause:
      '【美债 / 长端】美伊停火谈判进展带动国债收益率下行，CNBC 报道"国债在美伊停火谈判消息后收益率回落"。' +
      '地缘紧张情绪缓解，投资者短暂减少避险需求，美债价格上涨、收益率走低。' +
      'Fed Bowman 反对加息立场亦减轻长端收益率上行压力。\n\n' +
      '【SOFR / 短端】美联储维持观望，SOFR 3.62% 几乎未动；' +
      'Bowman 措辞鸽派但未暗示近期降息，短端利率僵局延续。\n\n' +
      '【加拿大 GOC/CMB +4-5bps】加拿大债券利率逆美债方向上行，' +
      '反映本国经济数据与住房市场压力，CMB（+5bps）略快于 GOC（+4bps），利差小幅扩大至 14bps，' +
      '加拿大央行宽松路径预期尚不明朗（Bank of Canada）。',
    sources: [
      { name: 'CNBC Markets',   url: 'cnbc.com/markets' },
      { name: 'Canada ICI',     url: 'canadaici.com/market-data' },
      { name: 'NY Fed SOFR',    url: 'newyorkfed.org/markets/reference-rates/sofr' },
      { name: 'Bank of Canada', url: 'bankofcanada.ca/rates' },
    ],
  },
  forex: {
    trend:
      'USD/CAD 降至 1.3779（前值 1.3802），加元升值约 0.17%。' +
      'USD/CNY 降至 6.7657（前值 6.7945），人民币升值约 0.43%。' +
      'CAD/CNY 降至 4.9102（前值 4.9219），加元对人民币小幅走弱约 0.24%。' +
      '美元整体走弱，人民币涨幅最为显著，加元弱于人民币。',
    cause:
      '【美元整体走弱】美伊停火谈判令地缘避险溢价消退，美元整体承压；' +
      'Fed Bowman 明确反对加息，市场减少对美元利差优势的押注，USD 对 CAD 与 CNY 双双下行（CNBC）。\n\n' +
      '【人民币走强】USD/CNY 下行 0.43%，高盛分析认为中国制造业主导地位支撑人民币升值趋势（CNBC）。' +
      '油价下跌进一步缓解中国进口成本，有利于贸易顺差维持，人民币基本面改善。\n\n' +
      '【加元相对偏弱】油价从峰值回落逾 20% 对资源货币加元形成负面影响，' +
      '尽管 USD/CAD 下行（加元走强），但 CAD/CNY 仍小幅走弱，反映加元相对人民币的比较劣势。',
    sources: [
      { name: 'CNBC Markets',  url: 'cnbc.com/markets' },
      { name: 'Canada ICI',    url: 'canadaici.com/market-data' },
    ],
  },

  // ── Slide 10: 配置建议
  recs: [
    { asset: 'BTC',          dir: '谨慎观望', isLong: null,  adj: '持平',  conviction: '低',
      reason: 'F&G=23 极恐但 ETF 连续 9 日净流出（$28亿），新买家严重不足；今日资金流向虽全面转正，但仍需确认放量止跌（日线阳包阴 + F&G 连续 2 日回升至 30+）后方可介入' },
    { asset: '美股（大盘）', dir: '持有观望', isLong: null,  adj: '持平',  conviction: '中',
      reason: 'NAAIM 仓位 98.39 逼近历史极值，一周急升 16 个百分点，极端多头仓位历史上常领先短期调整 1-2 周；建议持仓不追高，通过 VIX 看涨期权对冲集中度风险' },
    { asset: 'AI / 半导体',  dir: '增持',    isLong: true,  adj: '+5%',  conviction: '高',
      reason: '标普与纳斯达克同步创历史新高，VIX 大幅压缩至 15.53，市场做多动能强劲；AI/半导体为本轮主线，停火谈判推进有助于全球供应链预期改善' },
    { asset: '美债 10Y/30Y', dir: '短期持有', isLong: true,  adj: '+3%',  conviction: '中',
      reason: '停火谈判驱动收益率小幅下行（10Y -5.9bps），但趋势可持续性取决于地缘进展；Bowman 反对加息为长端提供支撑，可短期持有，止盈于 4.38% 以下' },
    { asset: '加元（CAD）',  dir: '轻度减仓', isLong: false, adj: '−3%',  conviction: '中',
      reason: '油价从 2026 峰值回落 20%，资源货币加元中期承压；CAD/CNY 已走弱，USD/CAD 短暂下行可能是反弹而非趋势逆转，BoC 降息路径仍不明朗' },
    { asset: '人民币资产',   dir: '关注',    isLong: null,  adj: '跟踪',  conviction: '中',
      reason: '人民币升值 0.43% 由基本面支撑（制造业主导地位 + 油价下行改善贸易条件），高盛确认升值趋势；可逐步建立小额敞口，持续跟踪中美贸易谈判进展' },
  ],

  // ── Slide 11: 关键风险 & 观察指标
  watches: [
    { label: '美伊停火谈判结果',
      detail: '若停火正式落地 → 油价进一步承压，加元走软，VIX 有望降至 14 以下，美债收益率短期反弹；若谈判破裂 → VIX 快速回升至 20+，建议持有 VIX 看涨期权对冲。' },
    { label: 'NAAIM 超买风险',
      detail: '下周披露（6 月 3 日）：若仓位维持 95+ 则超买风险累积，历史上此区间后 2 周内标普平均回调 2-3%；若回落至 85 以下则短期调整信号缓解。' },
    { label: 'BTC ETF 资金流向',
      detail: '连续 9 日净流出（$28亿）是关键压制因素；若出现日度净流入且 F&G 连续 2 日升破 30，则视为反转信号；若继续净流出则确认熊市延续。' },
    { label: '美联储 6 月议息会议',
      detail: 'Bowman 反对加息但未暗示降息。关注：5 月 CPI 数据（6 月 11 日）与联储点阵图。若鸽派信号出现，美债收益率加速下行；若偏鹰则高仓位美股面临重新定价。' },
    { label: '油价与加元联动',
      detail: '油价较峰值下行 20% 对加元持续施压。关注 WTI 是否跌破 $80/桶：突破则 USD/CAD 有望重回 1.39+；若油价企稳则加元跌幅受限，配置建议需相应调整。' },
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
