'use strict';
/**
 * Investment Index Slides — single-script generator.
 *
 * HOW TO RUN:
 *   1. Edit LIVE_MANUAL below with fresh Playwright/manual data (6 values).
 *   2. node generate_investment_index_slides.js
 *
 * The script auto-fetches 10 indicators from free JSON APIs at runtime.
 * Only the 6 JS-rendered/manual sources in LIVE_MANUAL need updating each run.
 *
 * Everything else (functions, layout, colors) is stable — do NOT rewrite it.
 */

const path        = require('path');
const fs          = require('fs');
const https       = require('https');
const pptxgen     = require(path.resolve(__dirname, '.claude/skills/pptx/node_modules/pptxgenjs'));

// ── Color palette (no # prefix — pptxgenjs rule)
const C = {
  bg:      '0F172A',
  card:    '1E293B',
  white:   'FFFFFF',
  slate:   '94A3B8',
  muted:   '64748B',
  green:   '22C55E',
  red:     'EF4444',
  teal:    '0D9488',
  divider: '2D3F55',
  crypto:  'F59E0B',
  stock:   '3B82F6',
  rates:   '8B5CF6',
  forex:   '10B981',
};

// Always return a fresh object — pptxgenjs mutates shadow in-place
const mkShadow = () => ({ type: 'outer', color: '000000', blur: 5, offset: 2, angle: 135, opacity: 0.18 });

const TODAY = new Date().toISOString().slice(0, 10);
const TIME  = new Date().toUTCString().slice(17, 22) + ' UTC';

// ════════════════════════════════════════════════════════════════
//  LIVE_MANUAL — edit these 6 values each run
//  (requires Playwright MCP — no free JSON API available)
//
//  Auto-fetched (no editing needed):
//    cryptoFG · btcDom · ethBtc · sofr · vix
//    us10y · us30y · usdCad · usdCny · cadCny
// ════════════════════════════════════════════════════════════════
const LIVE_MANUAL = {

  // ── CRYPTO
  fundFlow: {
    items: [
      { label: '15m',      value: '-1,104.27万',  dir: 'down'    },
      { label: '4h',       value: '-1.14亿',      dir: 'down'    },
      { label: '7D',       value: '4,650.61万',   dir: 'up'      },
      { label: '30D',      value: '57.91亿',      dir: 'up'      },
      { label: '市值($)',  value: '14,834.95亿',  dir: 'neutral' },
      { label: '资金信号', value: '+35净流入',     dir: 'up'      },
    ],
    date: 'May 31',
  },

  // ── STOCK
  cnnFG:  { value: '60.17', change: 'prev 60.09 • Greed', dir: 'up', date: 'May 29' },
  mm: {
    mmCurrent:    '68.22',
    mmPrev:       '61.69',
    sp500Current: '7,580.06',
    sp500Prev:    '7,563.63',
    date:         'Apr 2026',
  },
  aaii: {
    bullCurrent: '35.56%',
    bullPrev:    '31.72%',
    bearCurrent: '41.85%',
    bearPrev:    '43.61%',
    date:        'May 28',
  },
  naaim: {
    current:  '98.39',
    prev:     '82.02',
    ma4w:     '88.61',
    ma4wPrev: '87.46',
    date:     '05/27/2026',
  },

  // ── RATES  (canadaici.com — querySelectorAll('div.widgetTableCell.field3.col3 a'))
  ca5yGoc: { value: '3.23%', change: '+4 bps', dir: 'up', date: 'May 31' }, // index [0] GOC 5Y
  ca5yCmb: { value: '3.37%', change: '+5 bps', dir: 'up', date: 'May 31' }, // index [2] CMB 5Y
};

// ════════════════════════════════════════════════════════════════
//  API FETCH  (runs automatically — no editing needed)
//
//  Sources: alternative.me · CoinGecko · Binance · NY Fed (SOFR)
//           Yahoo Finance (VIX · 10Y · 30Y · USDCAD · USDCNY · CADCNY)
// ════════════════════════════════════════════════════════════════

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept':     'application/json, */*',
      },
    }, res => {
      if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
        res.resume();
        return getJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${u.hostname}${u.pathname}`));
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${body.slice(0, 80)}`)); }
      });
    }).on('error', reject);
  });
}

const _f   = (n, d = 2) => Number(n).toFixed(d);
const _sgn = n => n >= 0 ? '+' : '';
const _dt  = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function _yParse(data) {
  const m = data.chart.result[0].meta;
  return {
    cur:  m.regularMarketPrice,
    prev: m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice,
  };
}

async function fetchAPIData() {
  const today = _dt();
  const sources = {
    fg:     'https://api.alternative.me/fng/?limit=2',
    gecko:  'https://api.coingecko.com/api/v3/global',
    ethbtc: 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHBTC',
    sofr:   'https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json',
    vix:    'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d',
    tnx:    'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d',
    tyx:    'https://query1.finance.yahoo.com/v8/finance/chart/%5ETYX?interval=1d&range=5d',
    usdcad: 'https://query1.finance.yahoo.com/v8/finance/chart/USDCAD=X?interval=1d&range=5d',
    usdcny: 'https://query1.finance.yahoo.com/v8/finance/chart/USDCNY=X?interval=1d&range=5d',
    cadcny: 'https://query1.finance.yahoo.com/v8/finance/chart/CADCNY=X?interval=1d&range=5d',
  };
  const keys    = Object.keys(sources);
  const settled = await Promise.allSettled(keys.map(k => getJSON(sources[k])));
  const raw = {};
  keys.forEach((k, i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') raw[k] = r.value;
    else { console.warn(`  ⚠ API ${k}: ${r.reason.message}`); raw[k] = null; }
  });

  const api = {};

  if (raw.fg) {
    const cur = raw.fg.data[0], prev = raw.fg.data[1];
    const curDate = new Date(Number(cur.timestamp) * 1000)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    api.cryptoFG = {
      value:  cur.value,
      change: `prev ${prev.value} • ${prev.value_classification}`,
      dir:    Number(cur.value) >= Number(prev.value) ? 'up' : 'down',
      date:   curDate,
    };
  }

  if (raw.gecko) {
    api.btcDom = {
      value:  _f(raw.gecko.data.market_cap_percentage.btc, 1) + '%',
      change: '—',
      dir:    'neutral',
      date:   today,
    };
  }

  if (raw.ethbtc) {
    const chg = Number(raw.ethbtc.priceChange);
    const pct  = Number(raw.ethbtc.priceChangePercent);
    api.ethBtc = {
      value:  _f(Number(raw.ethbtc.lastPrice), 5),
      change: `${_sgn(chg)}${_f(pct, 2)}%`,
      dir:    chg >= 0 ? 'up' : 'down',
      date:   today,
    };
  }

  if (raw.sofr) {
    const s = raw.sofr.refRates[0];
    api.sofr = {
      date:  s.effectiveDate.slice(5).replace('-', '/'),
      cells: [
        { label: 'RATE (%)',   value: s.percentRate         + '%' },
        { label: '1st %ile',  value: s.percentPercentile1  + '%' },
        { label: '25th %ile', value: s.percentPercentile25 + '%' },
        { label: '75th %ile', value: s.percentPercentile75 + '%' },
        { label: '99th %ile', value: s.percentPercentile99 + '%' },
        { label: 'Vol ($B)',  value: Number(s.volumeInBillions).toLocaleString('en-US') },
      ],
    };
  }

  if (raw.vix) {
    const { cur, prev } = _yParse(raw.vix);
    const chg = cur - prev, pct = (chg / prev) * 100;
    api.vix = {
      value:  _f(cur, 2),
      change: `${_sgn(chg)}${_f(chg, 2)} (${_sgn(pct)}${_f(pct, 2)}%)`,
      dir:    chg < 0 ? 'down' : 'up',
      date:   today,
    };
  }

  if (raw.tnx) {
    const { cur, prev } = _yParse(raw.tnx);
    const chg = cur - prev;
    api.us10y = {
      value:  _f(cur, 3) + '%',
      change: `${_sgn(chg)}${_f(chg, 3)}%`,
      dir:    chg < 0 ? 'down' : 'up',
      date:   today,
    };
  }

  if (raw.tyx) {
    const { cur, prev } = _yParse(raw.tyx);
    const chg = cur - prev;
    api.us30y = {
      value:  _f(cur, 3) + '%',
      change: `${_sgn(chg)}${_f(chg, 3)}%`,
      dir:    chg < 0 ? 'down' : 'up',
      date:   today,
    };
  }

  for (const [liveKey, rawKey] of [['usdCad','usdcad'], ['usdCny','usdcny'], ['cadCny','cadcny']]) {
    if (raw[rawKey]) {
      const { cur, prev } = _yParse(raw[rawKey]);
      const chg = cur - prev;
      api[liveKey] = {
        value:  _f(cur, 4),
        change: `prev ${_f(prev, 4)}`,
        dir:    Math.abs(chg) < 0.0002 ? 'neutral' : chg > 0 ? 'up' : 'down',
        date:   today,
      };
    }
  }

  return api;
}

// ════════════════════════════════════════════════════════════════
//  SLIDE HELPERS  (stable — do not edit)
// ════════════════════════════════════════════════════════════════

function chgColor(dir) {
  return dir === 'up' ? C.green : dir === 'down' ? C.red : C.slate;
}

function accentBar(slide, pres, color) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 5.625, fill: { color }, line: { color, width: 0 } });
}

function slideHeader(slide, pres, title, accent) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 0.24, w: 0.07, h: 0.07, fill: { color: accent }, line: { color: accent, width: 0 } });
  slide.addText(title, { x: 0.67, y: 0.1, w: 7.3, h: 0.44, fontSize: 22, bold: true, color: C.white, valign: 'middle', margin: 0 });
  slide.addText(TODAY + '  •  ' + TIME, { x: 7.9, y: 0.1, w: 1.95, h: 0.44, fontSize: 9, color: C.slate, align: 'right', valign: 'middle', margin: 0 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 0.63, w: 9.3, h: 0.018, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
}

// Simple indicator card
function addCard(slide, pres, x, y, w, h, { name, value, change, dir, date, label }) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, shadow: mkShadow(), line: { color: C.divider, width: 0.5 } });
  const isNA = !value || value === 'N/A';
  const pad = 0.15, cx = x + pad, cw = w - pad * 2, cy = y + h / 2;
  slide.addText(name, { x: cx, y: y + 0.14, w: cw, h: 0.26, fontSize: 10, color: C.slate, margin: 0 });
  if (isNA) {
    slide.addText('N/A', { x: cx, y: cy - 0.18, w: cw, h: 0.36, fontSize: 20, bold: true, color: C.muted, align: 'center', margin: 0 });
  } else {
    slide.addText(value, { x: cx, y: cy - 0.3, w: cw, h: 0.55, fontSize: 26, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    if (change && change !== '—') {
      slide.addText(change, { x: cx, y: cy + 0.28, w: cw, h: 0.28, fontSize: 10, color: chgColor(dir), align: 'center', margin: 0 });
    }
    if (label) {
      slide.addText(label, { x: cx, y: cy + 0.54, w: cw, h: 0.25, fontSize: 10, color: C.teal, italic: true, align: 'center', margin: 0 });
    }
  }
  if (date && date !== '—') {
    slide.addText(date, { x: cx, y: y + h - 0.27, w: cw, h: 0.2, fontSize: 8, color: C.muted, align: 'right', margin: 0 });
  }
}

// Fund Flow — 3×2 grid, 6 values same font+size
function addFundFlowCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, shadow: mkShadow(), line: { color: C.divider, width: 0.5 } });
  const pad = 0.1, titleH = 0.3;
  slide.addText('加密货币资金流', { x: x + pad, y: y + 0.06, w: w * 0.65, h: titleH - 0.06, fontSize: 10, color: C.slate, margin: 0 });
  slide.addText(d.date, { x: x + w * 0.65, y: y + 0.06, w: w * 0.35 - pad, h: titleH - 0.06, fontSize: 8, align: 'right', color: C.muted, margin: 0 });
  const bodyY = y + titleH, bodyH = h - titleH, cw = w / 3, ch = bodyH / 2;
  slide.addShape(pres.shapes.RECTANGLE, { x,         y: bodyY,      w,        h: 0.01,  fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x + cw, y: bodyY,      w: 0.01,  h: bodyH, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x+cw*2, y: bodyY,      w: 0.01,  h: bodyH, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x,         y: bodyY + ch, w,        h: 0.01,  fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  d.items.forEach((item, i) => {
    const col = i % 3, row = Math.floor(i / 3), cx = x + col * cw, cy = bodyY + row * ch;
    const valColor = item.dir === 'up' ? C.green : item.dir === 'down' ? C.red : C.slate;
    slide.addText(item.label, { x: cx + pad, y: cy + 0.05, w: cw - pad * 2, h: 0.2,       fontSize: 8,  align: 'center', color: C.slate,    margin: 0 });
    slide.addText(item.value, { x: cx + pad, y: cy + 0.23, w: cw - pad * 2, h: ch - 0.28, fontSize: 13, align: 'center', valign: 'middle', bold: true, color: valColor, margin: 0 });
  });
}

// NAAIM — dedicated 2×2 card
function addNaaimCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, shadow: mkShadow(), line: { color: C.divider, width: 0.5 } });
  const pad = 0.12, midX = x + w / 2;
  slide.addText('NAAIM 经理人持仓', { x: x + pad, y: y + 0.1, w: w - pad * 2, h: 0.25, fontSize: 10, color: C.slate, margin: 0 });
  const div1Y = y + 0.42, div2Y = y + h * 0.52;
  slide.addShape(pres.shapes.RECTANGLE, { x: x + pad,       y: div1Y, w: w - pad * 2,         h: 0.015, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x + pad,       y: div2Y, w: w - pad * 2,         h: 0.015, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: midX - 0.008,  y: div1Y, w: 0.015, h: y + h - 0.22 - div1Y, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  const r1y = div1Y + 0.06, r2y = div2Y + 0.06, cellW = w / 2 - pad - 0.04, lx1 = x + pad + 0.04, lx2 = midX + 0.04;
  slide.addText('当前',       { x: lx1, y: r1y,        w: cellW, h: 0.22, fontSize: 9,  color: C.slate, margin: 0 });
  slide.addText('前值',       { x: lx2, y: r1y,        w: cellW, h: 0.22, fontSize: 9,  color: C.slate, margin: 0 });
  slide.addText(d.current,   { x: lx1, y: r1y + 0.22, w: cellW, h: 0.36, fontSize: 17, bold: true, color: C.white, margin: 0 });
  slide.addText(d.prev,      { x: lx2, y: r1y + 0.22, w: cellW, h: 0.36, fontSize: 17, bold: true, color: C.white, margin: 0 });
  slide.addText('4W MA 当前', { x: lx1, y: r2y,        w: cellW, h: 0.22, fontSize: 9,  color: C.slate, margin: 0 });
  slide.addText('4W MA 前值', { x: lx2, y: r2y,        w: cellW, h: 0.22, fontSize: 9,  color: C.slate, margin: 0 });
  slide.addText(d.ma4w,      { x: lx1, y: r2y + 0.22, w: cellW, h: 0.36, fontSize: 17, bold: true, color: C.teal,  margin: 0 });
  slide.addText(d.ma4wPrev,  { x: lx2, y: r2y + 0.22, w: cellW, h: 0.36, fontSize: 17, bold: true, color: C.teal,  margin: 0 });
  slide.addText('as of ' + d.date, { x: x + pad, y: y + h - 0.25, w: w - pad * 2, h: 0.2, fontSize: 8, color: C.muted, align: 'right', margin: 0 });
}

// Generic quad card — 2×2 sub-grid (MM Bull/Bear, AAII)
function addQuadCard(slide, pres, x, y, w, h, cfg) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, shadow: mkShadow(), line: { color: C.divider, width: 0.5 } });
  const pad = 0.1, titleH = 0.3, bodyY = y + titleH, bodyH = h - titleH, cw = w / 2, ch = bodyH / 2;
  slide.addText(cfg.title, { x: x + pad, y: y + 0.06, w: w - pad * 2, h: titleH - 0.06, fontSize: 10, color: C.slate, margin: 0 });
  slide.addShape(pres.shapes.RECTANGLE, { x,       y: bodyY,      w,       h: 0.01, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x+cw, y: bodyY,      w: 0.01, h: bodyH, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x,       y: bodyY + ch, w,       h: 0.01, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  [[cfg.tl, 0, 0, true], [cfg.tr, 1, 0, true], [cfg.bl, 0, 1, false], [cfg.br, 1, 1, false]]
    .forEach(([cell, col, row, isTop]) => {
      const cx = x + col * cw, cy = bodyY + row * ch;
      slide.addText(cell.label, { x: cx + pad, y: cy + 0.05, w: cw - pad * 2, h: 0.2,        fontSize: 9,  color: C.slate,                  margin: 0 });
      slide.addText(cell.value, { x: cx + pad, y: cy + 0.23, w: cw - pad * 2, h: ch - 0.27,  fontSize: 20, bold: true, color: isTop ? C.white : C.teal, valign: 'middle', margin: 0 });
    });
  if (cfg.note) {
    slide.addText(cfg.note, { x: x + pad, y: y + h - 0.2, w: w - pad * 2, h: 0.17, fontSize: 8, color: C.muted, align: 'right', margin: 0 });
  }
}

// SOFR card — 3×2 hex sub-grid
function addSofrCard(slide, pres, x, y, w, h, d) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, shadow: mkShadow(), line: { color: C.divider, width: 0.5 } });
  const pad = 0.1, titleH = 0.3;
  slide.addText('SOFR',          { x: x + pad,      y: y + 0.06, w: w * 0.55,     h: titleH - 0.06, fontSize: 10, color: C.slate, margin: 0 });
  slide.addText('as of ' + d.date, { x: x + w * 0.55, y: y + 0.06, w: w * 0.45 - pad, h: titleH - 0.06, fontSize: 8, align: 'right', color: C.muted, margin: 0 });
  if (!d.cells || d.cells.length === 0) {
    slide.addText('N/A', { x: x + pad, y: y + h / 2 - 0.18, w: w - pad * 2, h: 0.36, fontSize: 20, bold: true, align: 'center', color: C.muted, margin: 0 });
    return;
  }
  const bodyY = y + titleH, bodyH = h - titleH, cw = w / 3, ch = bodyH / 2;
  slide.addShape(pres.shapes.RECTANGLE, { x,          y: bodyY,      w,        h: 0.01,  fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x + cw,  y: bodyY,      w: 0.01,  h: bodyH, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: x+cw*2,  y: bodyY,      w: 0.01,  h: bodyH, fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  slide.addShape(pres.shapes.RECTANGLE, { x,          y: bodyY + ch, w,        h: 0.01,  fill: { color: C.divider }, line: { color: C.divider, width: 0 } });
  d.cells.forEach((cell, i) => {
    const col = i % 3, row = Math.floor(i / 3), cx = x + col * cw, cy = bodyY + row * ch;
    slide.addText(cell.label, { x: cx + pad, y: cy + 0.04, w: cw - pad * 2, h: 0.2,       fontSize: 8,  align: 'center', color: C.slate, margin: 0 });
    slide.addText(cell.value, { x: cx + pad, y: cy + 0.22, w: cw - pad * 2, h: ch - 0.28, fontSize: 15, bold: true, align: 'center', valign: 'middle', color: cell.label === 'Vol ($B)' ? C.white : C.teal, margin: 0 });
  });
}

// Category slide builder
function categorySlide(pres, title, accent, cards, cols, rows, specials) {
  const slide = pres.addSlide();
  slide.background = { color: C.bg };
  accentBar(slide, pres, accent);
  slideHeader(slide, pres, title, accent);
  const startX = 0.55, startY = 0.75, areaW = 9.3, areaH = 4.625, gap = 0.15;
  const cW = (areaW - (cols - 1) * gap) / cols;
  const cH = (areaH - (rows - 1) * gap) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c, cx = startX + c * (cW + gap), cy = startY + r * (cH + gap);
      if (specials && specials[idx]) specials[idx](slide, pres, cx, cy, cW, cH);
      else if (cards[idx])           addCard(slide, pres, cx, cy, cW, cH, cards[idx]);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log(`Fetching 10 API indicators (${TODAY})…`);
  const apiData = await fetchAPIData();

  // Merge: API data fills in the 10 auto-fetched keys; LIVE_MANUAL provides the 6 manual keys
  const LIVE = { ...LIVE_MANUAL, ...apiData };

  // Summary log
  const apiKeys = ['cryptoFG','btcDom','ethBtc','sofr','vix','us10y','us30y','usdCad','usdCny','cadCny'];
  const fetched = apiKeys.filter(k => LIVE[k]).length;
  console.log(`API: ${fetched}/10 fetched  |  manual: fundFlow · cnnFG · mm · aaii · naaim · ca5yGoc · ca5yCmb\n`);

  // ── Write market-index.json (all 16 indicators)
  fs.writeFileSync(
    path.resolve(__dirname, 'market-index.json'),
    JSON.stringify({ date: TODAY, ...LIVE }, null, 2),
    'utf8'
  );

  // ── Build presentation
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.title  = 'Market Index Dashboard';

  // Cover
  const cover = pres.addSlide();
  cover.background = { color: C.bg };
  cover.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 0.08, h: 5.625, fill: { color: C.teal },  line: { color: C.teal,  width: 0 } });
  cover.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.25,  w: 10,   h: 0.375, fill: { color: '0A1628' }, line: { color: '0A1628', width: 0 } });
  cover.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.247, w: 10,   h: 0.02,  fill: { color: C.teal },  line: { color: C.teal,  width: 0 } });
  cover.addText('Market Index Dashboard',                      { x: 0.65, y: 1.55, w: 8.8, h: 1.2,  fontSize: 40, bold: true, color: C.white, margin: 0 });
  cover.addText(TODAY + '  •  ' + TIME,                        { x: 0.65, y: 2.85, w: 8.8, h: 0.5,  fontSize: 18,             color: C.slate, margin: 0 });
  cover.addText('Live Market Indicators Report',               { x: 0.65, y: 3.45, w: 8.8, h: 0.4,  fontSize: 12, italic: true, color: C.muted, margin: 0 });
  cover.addText('CRYPTO  •  STOCK  •  RATES  •  FOREX',        { x: 0.65, y: 5.265, w: 9.2, h: 0.33, fontSize: 9,  align: 'right', valign: 'middle', color: C.slate, charSpacing: 2, margin: 0 });

  // CRYPTO (2×2) — slot 3 = fund flow special card
  categorySlide(pres, 'CRYPTO', C.crypto, [
    { name: 'Crypto Fear & Greed', ...LIVE.cryptoFG },
    { name: 'BTC Dominance',       ...LIVE.btcDom   },
    { name: 'ETH / BTC',           ...LIVE.ethBtc   },
    null,
  ], 2, 2, {
    3: (sl, pr, x, y, w, h) => addFundFlowCard(sl, pr, x, y, w, h, LIVE.fundFlow),
  });

  // STOCK (3×2) — slots 2–5 are special cards
  categorySlide(pres, 'STOCK', C.stock, [
    { name: 'CNN Fear & Greed', ...LIVE.cnnFG },
    { name: 'CBOE VIX',         ...LIVE.vix   },
    null, null, null, null,
  ], 3, 2, {
    2: (sl, pr, x, y, w, h) => addQuadCard(sl, pr, x, y, w, h, {
      title: 'MM Bull/Bear  &  S&P 500',
      tl: { label: 'MM Bull/Bear 当前', value: LIVE.mm.mmCurrent    },
      tr: { label: 'MM Bull/Bear 前值', value: LIVE.mm.mmPrev       },
      bl: { label: 'S&P 500 当前',      value: LIVE.mm.sp500Current },
      br: { label: 'S&P 500 前值',      value: LIVE.mm.sp500Prev    },
      note: 'as of ' + LIVE.mm.date,
    }),
    3: (sl, pr, x, y, w, h) => addSofrCard(sl, pr, x, y, w, h, LIVE.sofr),
    4: (sl, pr, x, y, w, h) => addQuadCard(sl, pr, x, y, w, h, {
      title: 'AAII 情绪调查',
      tl: { label: '看多 当前', value: LIVE.aaii.bullCurrent },
      tr: { label: '看多 前值', value: LIVE.aaii.bullPrev    },
      bl: { label: '看空 当前', value: LIVE.aaii.bearCurrent },
      br: { label: '看空 前值', value: LIVE.aaii.bearPrev    },
      note: 'as of ' + LIVE.aaii.date,
    }),
    5: (sl, pr, x, y, w, h) => addNaaimCard(sl, pr, x, y, w, h, LIVE.naaim),
  });

  // RATES (2×2)
  categorySlide(pres, '利率  (RATES)', C.rates, [
    { name: 'US 10Y Treasury', ...LIVE.us10y   },
    { name: 'US 30Y Treasury', ...LIVE.us30y   },
    { name: 'Canada 5Y GOC',   ...LIVE.ca5yGoc },
    { name: 'Canada 5Y CMB',   ...LIVE.ca5yCmb },
  ], 2, 2, null);

  // FOREX (3×1)
  categorySlide(pres, 'FOREX', C.forex, [
    { name: 'USD / CAD', ...LIVE.usdCad },
    { name: 'USD / CNY', ...LIVE.usdCny },
    { name: 'CAD / CNY', ...LIVE.cadCny },
  ], 3, 1, null);

  // ── Write
  const outFile = 'investment-index-slides_' + TODAY.replace(/-/g, '_') + '.pptx';
  await pres.writeFile({ fileName: outFile });
  console.log('SUCCESS: ' + outFile);

}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
