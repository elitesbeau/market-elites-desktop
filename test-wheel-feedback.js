// Reproducer for community feedback (Tom, 2026-10-09) on the wheel tracker:
//  1. Premium Per Share shows $5.96 for $596 on 4 contracts — should be $1.49
//     (divide by contracts x 100 while no shares are held).
//  2. CSP vs CC mix bar shows "CSP 102%" / "CC -2%" when a BTC Put debit exists.
//  3. Transactions table has no expiration column.
//  4. Calendar only marks the trade date, never the expiration.
// Also asserts the wheel object is byte-identical after every render (display-only).
//
// Extracts the real functions from the deployed index.html and runs them on
// Tom's exact transactions.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start === -1) throw new Error(name + ' not found');
  let depth = 0;
  for (let j = html.indexOf('{', start); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error(name + ' unterminated');
}

const fns = ['Ht', 'Dt', 'renderAnalytics', 'Ut', 'renderCalendar'].map(extract).join(';\n');
// It = money formatter, Lt = pct formatter, Bt = discipline score, At = selected wheel id
const lib = new Function('Bt', 'It', 'Lt', 'At', 'wt',
  fns + '; return {Ht, renderAnalytics, Ut, renderCalendar};')(
  () => ({ overall: 50 }),
  v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2),
  v => v.toFixed(1) + '%',
  'w1',
  () => ({ wheels: [] })
);

const tx = (id, type, date, expiration, strike, premium, contracts, totalValue) =>
  ({ id, type, date, expiration, strike, premium, contracts, totalValue, notes: '' });
const wheel = {
  id: 'w1', sym: 'HL', status: 'active', capital: 6400, createdAt: '2026-09-25',
  transactions: [
    tx('a', 'sell_csp', '2026-09-25', '2026-09-26', 16, 0.23, 4, 92),
    tx('b', 'btc_put', '2026-09-25', '2026-09-26', 16, 0.03, 4, -12),
    tx('c', 'sell_csp', '2026-09-25', '2026-10-02', 16, 0.38, 4, 152),
    tx('d', 'sell_csp', '2026-10-02', '2026-10-09', 16, 0.40, 4, 160),
    tx('e', 'sell_csp', '2026-10-09', '2026-10-16', 16, 0.51, 4, 204),
  ],
  cycles: [],
};
const before = JSON.stringify(wheel);

let failures = 0;
function t(label, fn) {
  try { fn(); console.log('PASS: ' + label); }
  catch (err) { failures++; console.log('FAIL: ' + label + ' — ' + err.message); }
}

const stats = lib.Ht(wheel);
t('total premium is still $596 (net of the BTC)', () => assert.ok(Math.abs(stats.totalPremium - 596) < 1e-9, 'got ' + stats.totalPremium));
t('premium per share = 596 / (4 x 100) = $1.49', () => assert.ok(Math.abs(stats.perShare - 1.49) < 1e-9, 'got ' + stats.perShare));

const ana = lib.renderAnalytics(wheel, stats);
const widths = [...ana.matchAll(/wt-ana-bar-seg (csp|cc)" style="width:([-\d.e]+)%">\s*(CSP|CC) ([-\d]+)%/g)]
  .map(m => ({ side: m[1], width: +m[2], label: +m[4] }));
t('mix bar has a CSP and a CC segment', () => assert.strictEqual(widths.length, 2, 'parsed ' + JSON.stringify(widths)));
t('mix bar never goes negative or past 100%', () => widths.forEach(w => {
  assert.ok(w.width >= 0 && w.width <= 100, w.side + ' width ' + w.width);
  assert.ok(w.label >= 0 && w.label <= 100, w.side + ' label ' + w.label);
}));
t('all-CSP wheel reads CSP 100% / CC 0%', () => {
  const csp = widths.find(w => w.side === 'csp'), cc = widths.find(w => w.side === 'cc');
  assert.strictEqual(csp && csp.label, 100); assert.strictEqual(cc && cc.label, 0);
});

const table = lib.Ut(wheel);
t('transactions table has an expiration column', () => assert.match(table, /<th>Exp(iration|iry)?<\/th>/i));
t('each option row shows its expiration', () => {
  for (const d of ['2026-09-26', '2026-10-02', '2026-10-09', '2026-10-16']) {
    const [y, m, day] = d.split('-').map(Number);
    const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] + ' ' + day;
    assert.ok(table.includes(d) || table.includes(short), 'missing ' + d);
  }
});

const el = { dataset: {}, innerHTML: '' };
lib.renderCalendar(el, wheel.transactions, 2026, 9);
const dayCell = d => {
  const i = el.innerHTML.indexOf('data-date="' + d + '"');
  if (i === -1) return '';
  const next = el.innerHTML.indexOf('class="wt-cal-day', i + 1);
  return el.innerHTML.slice(i, next === -1 ? undefined : next);
};
t('calendar marks Oct 16 (an expiration with no trade that day)', () => {
  const c = dayCell('2026-10-16');
  assert.ok(/class="wt-cal-dot [a-z]/.test(c), 'no dot on Oct 16');
  assert.ok(/expir/i.test(c), 'Oct 16 popup does not say it is an expiration');
});
t('calendar still marks trade dates (Oct 9 sale)', () => assert.ok(/sell csp/i.test(dayCell('2026-10-09'))));

t('calendar sums contracts for sells sharing an expiry + strike', () => {
  const dup = [tx('x1', 'sell_csp', '2026-10-20', '2026-10-30', 16, 0.5, 2, 100), tx('x2', 'sell_csp', '2026-10-21', '2026-10-30', 16, 0.5, 2, 100)];
  const snap = JSON.stringify(dup);
  const el2 = { dataset: {}, innerHTML: '' };
  lib.renderCalendar(el2, dup, 2026, 9);
  assert.ok(/x4/.test(el2.innerHTML), 'expected x4');
  assert.strictEqual(JSON.stringify(dup), snap, 'transactions mutated');
});
t('wheel data is unchanged after rendering', () => assert.strictEqual(JSON.stringify(wheel), before));

process.exit(failures ? 1 : 0);
