// Reproducer for tester bug report -Oux2cP6G-6WTDqGrYdp (2026-06-12):
// "TypeError: t.toFixed is not a function @ :2401:44807" when opening a
// past position (rolled trade) from the positions tab.
//
// Extracts viewTradeDetail from the deployed index.html and runs it in a
// sandbox with the same data shape as the tester's account (rolled CSP in
// history). PASS = modal renders with correct PREMIUM value. FAIL = throws.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// pull the full function body via brace matching
const start = html.indexOf('function viewTradeDetail(');
if (start === -1) { console.error('FAIL: viewTradeDetail not found'); process.exit(1); }
let depth = 0, end = -1;
for (let j = html.indexOf('{', start); j < html.length; j++) {
  if (html[j] === '{') depth++;
  else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
}
const fnSrc = html.slice(start, end);

// sandbox: `t` is the app state object (exactly like the live IIFE),
// `e` is the element-getter, modal/chart helpers are no-ops.
const state = {
  history: [{
    id: 'h1', symbol: 'TEST', type: 'csp', outcome: 'rolled',
    premium: 0.17, contracts: 1, strike: 40,
    pnl: 17, grossPnl: 17, fees: 0.65, rollChainPnl: 30,
    openDate: '2026-05-01', closeDate: '2026-06-05',
    totalPremiumCollected: 34
  }],
  wheelPositions: [],
  positions: []
};
const rendered = { html: '' };
const harness = new Function('t', 'e', 'openModal', 'Me', 'setTimeout', 'window',
  fnSrc + '; return viewTradeDetail;');
const viewTradeDetail = harness(
  state,
  () => ({ set innerHTML(v) { rendered.html = v; }, get innerHTML() { return rendered.html; } }),
  () => {}, () => {}, () => {}, {}
);

try {
  viewTradeDetail('h1');
} catch (err) {
  console.error('FAIL: viewTradeDetail threw: ' + err.message);
  process.exit(1);
}
const m = rendered.html.match(/PREMIUM<\/div><div class="td-metric-val"[^>]*>\$([\d.]+)</);
if (!m) { console.error('FAIL: PREMIUM metric not rendered'); process.exit(1); }
if (m[1] !== '34') { console.error('FAIL: PREMIUM rendered $' + m[1] + ', expected $34 (totalPremiumCollected)'); process.exit(1); }
console.log('PASS: rolled trade detail renders, PREMIUM = $' + m[1]);
