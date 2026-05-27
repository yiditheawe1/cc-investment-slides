'use strict';
/**
 * scrape_live_data.js — Browser scraper for the 5 Playwright-only indicators.
 * Writes live_manual_data.json consumed by generate_investment_index_slides.js.
 *
 * Sources:
 *   cnnFG    → en.macromicro.me (CNN Fear & Greed)
 *   mm       → en.macromicro.me (MM Bull/Bear + S&P 500)
 *   aaii     → sc.macromicro.me (AAII sentiment)
 *   ca5yCmb  → canadaici.com    (Canada 5Y CMB yield)
 *   fundFlow → coinank.com      (BTC fund flow, 6 values)
 *
 * Usage:
 *   npm install playwright
 *   npx playwright install chromium --with-deps
 *   node scrape_live_data.js
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const OUT_FILE = path.join(__dirname, 'live_manual_data.json');
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function todayStr() {
  const d = new Date();
  return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
}

function fmtDateLabel(raw) {
  if (!raw) return todayStr();
  const iso = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return MONTHS[parseInt(iso[2]) - 1] + ' ' + parseInt(iso[3]);
  const us  = String(raw).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (us)  return MONTHS[parseInt(us[1]) - 1] + ' ' + parseInt(us[2]);
  return String(raw).slice(0, 10);
}

function fgLabel(v) {
  const n = parseFloat(v);
  if (n <= 24) return 'Extreme Fear';
  if (n <= 44) return 'Fear';
  if (n <= 54) return 'Neutral';
  if (n <= 74) return 'Greed';
  return 'Extreme Greed';
}

// ── MacroMicro sidebar scraper (shared by CNN F&G, MM Bull/Bear, AAII)
async function scrapeMacroMicroSidebar(page, url, liCount) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.sidebar-sec.chart-stat-lastrows', { timeout: 20000 });

  const items = [];
  for (let i = 0; i < liCount; i++) {
    const sel = `.sidebar-sec.chart-stat-lastrows li:nth-child(${i + 1})`;
    const cur  = await page.$eval(`${sel} .stat-val .val`,  el => el.textContent.trim()).catch(() => 'N/A');
    const prev = await page.$eval(`${sel} .prev-val .val`,  el => el.textContent.trim()).catch(() => null);
    const date = await page.$eval(`${sel} .date-label`,     el => el.textContent.trim()).catch(() => null);
    items.push({ cur, prev, date });
  }
  return items;
}

async function scrapeCnnFG(page) {
  const [li] = await scrapeMacroMicroSidebar(page,
    'https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed', 1);
  const val   = li.cur;
  const prev  = li.prev || '—';
  const label = fgLabel(val);
  const pNum  = parseFloat(prev);
  const dir   = parseFloat(val) >= pNum ? 'up' : 'down';
  return { value: val, change: `prev ${prev} • ${label}`, dir, date: fmtDateLabel(li.date) };
}

async function scrapeMM(page) {
  const [mm, sp] = await scrapeMacroMicroSidebar(page,
    'https://en.macromicro.me/collections/34/us-stock-relative/142681/us-mm-bull-and-bear-indicator', 2);
  return {
    mmCurrent:    mm.cur,
    mmPrev:       mm.prev  || 'N/A',
    sp500Current: sp ? sp.cur          : 'N/A',
    sp500Prev:    sp ? (sp.prev || 'N/A') : 'N/A',
    date:         fmtDateLabel(mm.date),
  };
}

async function scrapeAAII(page) {
  const [bull, bear] = await scrapeMacroMicroSidebar(page,
    'https://sc.macromicro.me/charts/77072/AAII-niu-xiong-yu-biao-pu-500-guan-xi', 2);
  return {
    bullCurrent: bull.cur,
    bullPrev:    bull.prev  || 'N/A',
    bearCurrent: bear ? bear.cur           : 'N/A',
    bearPrev:    bear ? (bear.prev || 'N/A') : 'N/A',
    date:        fmtDateLabel(bull.date),
  };
}

async function scrapeCanadaCMB(page, prevData) {
  await page.goto('https://www.canadaici.com/market-data/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const value = await page.$eval('div.widgetTableCell.field3.col3 a',
    el => el.textContent.trim()).catch(() => null);
  const cls   = await page.$eval('div.widgetTableCell.field3.col3',
    el => el.className).catch(() => '');
  const dir   = cls.includes('down') ? 'down' : cls.includes('up') ? 'up' : 'neutral';

  // Compute bps change using yesterday's stored value
  let change = '';
  if (value) {
    const cur  = parseFloat(value);
    const prev = parseFloat((prevData.ca5yCmb || {}).value || '');
    if (!isNaN(cur) && !isNaN(prev)) {
      const bps = Math.round((cur - prev) * 100);
      change = (bps >= 0 ? '+' : '') + bps + ' bps';
    }
  }

  return { value: value || 'N/A', change, dir, date: todayStr() };
}

async function scrapeFundFlow(page) {
  await page.goto('https://coinank.com/zh/fund/fundSwap', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const cells = await page.evaluate(() => {
    const rows   = [...document.querySelectorAll('tr')];
    const btcRow = rows.find(r => r.cells[0] && r.cells[0].textContent.trim().startsWith('BTC'));
    return btcRow ? [...btcRow.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()) : null;
  });

  if (!cells) return null;

  // Column map (0-based): [2]=15m [5]=4h [9]=7D [10]=30D [11]=市值 [12]=资金信号
  const toDir = v => {
    if (!v) return 'neutral';
    const n = parseFloat(String(v).replace(/[^0-9.\-+]/g, ''));
    return isNaN(n) ? 'neutral' : n >= 0 ? 'up' : 'down';
  };
  const sig    = cells[12] || 'N/A';
  const sigDir = sig.startsWith('-') ? 'down' : sig.startsWith('+') ? 'up' : 'neutral';

  return {
    items: [
      { label: '15m',      value: cells[2]  || 'N/A', dir: toDir(cells[2])  },
      { label: '4h',       value: cells[5]  || 'N/A', dir: toDir(cells[5])  },
      { label: '7D',       value: cells[9]  || 'N/A', dir: toDir(cells[9])  },
      { label: '30D',      value: cells[10] || 'N/A', dir: toDir(cells[10]) },
      { label: '市值($)',  value: cells[11] || 'N/A', dir: 'neutral'        },
      { label: '资金信号', value: sig,                dir: sigDir            },
    ],
    date: todayStr(),
  };
}

// ── Main
async function main() {
  // Load previous output for bps-change computation (ca5yCmb)
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();

  const result = {};
  const report = {};

  async function run(key, fn) {
    try {
      const val   = await fn();
      result[key] = val;
      report[key] = val ? 'OK' : 'null (no data found)';
    } catch (e) {
      console.error(`  [${key}] failed: ${e.message.slice(0, 120)}`);
      result[key] = prev[key] || null;  // fallback to previous run
      report[key] = `FAILED — using prev`;
    }
  }

  console.log('Scraping 5 browser-only indicators…\n');
  await run('cnnFG',    () => scrapeCnnFG(page));
  await run('mm',       () => scrapeMM(page));
  await run('aaii',     () => scrapeAAII(page));
  await run('ca5yCmb',  () => scrapeCanadaCMB(page, prev));
  await run('fundFlow', () => scrapeFundFlow(page));

  await browser.close();

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

  console.log('\nResults:');
  for (const [k, v] of Object.entries(report)) console.log(`  ${k.padEnd(10)} ${v}`);
  console.log(`\nWrote ${OUT_FILE}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
