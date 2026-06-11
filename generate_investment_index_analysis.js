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

// ── Analysis data (trend/cause/sources/recs/watches) — written each run by Sub-agent B
const ANALYSIS = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'analysis-data.json'), 'utf8'));

// ── Schema validation — fail loud with a single diagnosable line if Sub-agent B wrote bad data
(() => {
  const errs = [];
  for (const cat of ['crypto', 'stock', 'rates', 'forex']) {
    const c = ANALYSIS[cat];
    if (!c) { errs.push(`${cat} missing`); continue; }
    for (const f of ['trend', 'cause', 'sources']) if (c[f] == null) errs.push(`${cat}.${f} missing`);
    if (c.sources && !Array.isArray(c.sources)) errs.push(`${cat}.sources not array`);
  }
  if (!ANALYSIS.sofr || ANALYSIS.sofr.trend == null) errs.push('sofr.trend missing');
  if (!Array.isArray(ANALYSIS.recs)) errs.push('recs not array');
  if (!Array.isArray(ANALYSIS.watches)) errs.push('watches not array');
  if (errs.length) throw new Error('analysis-data.json schema invalid: ' + errs.join('; '));
})();

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
