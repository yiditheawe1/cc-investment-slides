'use strict';
/**
 * fetch_market_data.js — static market-index.json builder (never edit per-run).
 *
 * HOW IT WORKS:
 *   1. Auto-fetches 10 indicators from free JSON APIs (Promise.allSettled — failures degrade).
 *   2. Loads the 7 manual keys from scraped-indicators.json (written by Sub-agent A) IF its
 *      generatedAt === today; otherwise carries forward the previous market-index.json values
 *      (retaining their old per-key date as a STALE signal), or falls back to an N/A shape.
 *   3. Writes market-index.json = { date: TODAY, ...manual, ...api } and prints a provenance table.
 *
 * This script has NO pptxgenjs dependency and renders nothing. It is a pure data builder.
 * Only exits non-zero if market-index.json itself cannot be written.
 */

const path  = require('path');
const fs    = require('fs');
const https = require('https');

const TODAY = new Date().toISOString().slice(0, 10);

// 7 manual keys (no free JSON API — sourced by Sub-agent A via Playwright/WebFetch)
const MANUAL_KEYS = ['fundFlow', 'cnnFG', 'mm', 'aaii', 'naaim', 'ca5yGoc', 'ca5yCmb'];

// ════════════════════════════════════════════════════════════════
//  API FETCH  (extracted unchanged from the former slides generator)
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
//  MANUAL-KEY MERGE  (scraped → carry-forward → N/A)
// ════════════════════════════════════════════════════════════════

// N/A fallback shapes — one per manual key (rendered as N/A cards downstream)
function naShape(key) {
  switch (key) {
    case 'fundFlow':
      return {
        items: ['15m', '4h', '7D', '30D', '市值($)', '资金信号']
          .map(label => ({ label, value: 'N/A', dir: 'neutral' })),
        date: 'N/A',
      };
    case 'mm':
      return { mmCurrent: 'N/A', mmPrev: 'N/A', sp500Current: 'N/A', sp500Prev: 'N/A', date: 'N/A' };
    case 'aaii':
      return { bullCurrent: 'N/A', bullPrev: 'N/A', bearCurrent: 'N/A', bearPrev: 'N/A', date: 'N/A' };
    case 'naaim':
      return { current: 'N/A', prev: 'N/A', ma4w: 'N/A', ma4wPrev: 'N/A', date: 'N/A' };
    default: // cnnFG, ca5yGoc, ca5yCmb — standard indicator card
      return { value: 'N/A', change: '—', dir: 'neutral', date: 'N/A' };
  }
}

// Load scraped-indicators.json only if it exists AND was generated today.
function loadScraped() {
  const p = path.resolve(__dirname, 'scraped-indicators.json');
  if (!fs.existsSync(p)) {
    console.warn('  ⚠ scraped-indicators.json NOT FOUND — all 7 manual keys will carry forward.');
    return null;
  }
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`  ⚠ scraped-indicators.json is invalid JSON (${e.message}) — carrying forward.`);
    return null;
  }
  if (obj.generatedAt !== TODAY) {
    console.warn(`  ⚠ scraped-indicators.json is STALE (generatedAt=${obj.generatedAt}, today=${TODAY}) — carrying forward.`);
    return null;
  }
  return obj;
}

// Load the previous market-index.json (carry-forward source). Null on first run.
function loadPrevious() {
  const p = path.resolve(__dirname, 'market-index.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.warn(`  ⚠ existing market-index.json unreadable (${e.message}) — no carry-forward source.`); return null; }
}

// ════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log(`Fetching 10 API indicators (${TODAY})…`);
  const api = await fetchAPIData();

  const scraped  = loadScraped();
  const previous = loadPrevious();

  // Merge the 7 manual keys, tracking provenance for the report.
  const manual = {};
  const prov   = [];   // { key, source, detail }
  for (const k of MANUAL_KEYS) {
    if (scraped && scraped[k] != null) {
      manual[k] = scraped[k];
      prov.push({ key: k, source: 'scraped', detail: scraped[k].date || `gen ${scraped.generatedAt}` });
    } else if (previous && previous[k] != null) {
      manual[k] = previous[k];                              // keep its old date as a STALE signal
      prov.push({ key: k, source: 'carried-forward STALE', detail: previous[k].date || '?' });
    } else {
      manual[k] = naShape(k);
      prov.push({ key: k, source: 'N/A (missing)', detail: '—' });
    }
  }

  // API provenance (in canonical order); absent keys = fetch failed.
  const API_KEYS = ['cryptoFG', 'btcDom', 'ethBtc', 'sofr', 'vix', 'us10y', 'us30y', 'usdCad', 'usdCny', 'cadCny'];
  for (const k of API_KEYS) {
    if (api[k] != null) prov.push({ key: k, source: 'api', detail: api[k].date || 'today' });
    else                prov.push({ key: k, source: 'api FAILED', detail: '—' });
  }

  // ── Write market-index.json (date + 7 manual + up-to-10 api)
  const out = { date: TODAY, ...manual, ...api };
  try {
    fs.writeFileSync(path.resolve(__dirname, 'market-index.json'), JSON.stringify(out, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL: could not write market-index.json:', e.message);
    process.exit(1);
  }

  // ── Provenance table
  console.log('\n  PROVENANCE');
  console.log('  ' + '─'.repeat(54));
  for (const { key, source, detail } of prov) {
    console.log(`  ${key.padEnd(10)} ${source.padEnd(24)} ${detail}`);
  }
  console.log('  ' + '─'.repeat(54));
  const apiOk    = API_KEYS.filter(k => api[k] != null).length;
  const scrapedN = prov.filter(p => p.source === 'scraped').length;
  const carried  = prov.filter(p => p.source === 'carried-forward STALE').length;
  const naN      = prov.filter(p => p.source === 'N/A (missing)').length;
  console.log(`  api: ${apiOk}/10  |  manual: ${scrapedN} scraped · ${carried} carried-forward · ${naN} N/A`);
  console.log(`\n  SUCCESS: market-index.json written (date=${TODAY})`);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
