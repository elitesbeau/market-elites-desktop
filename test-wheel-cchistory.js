// Reproducer for topshot's bug report (2026-07-28):
//   "Uncaught TypeError: Cannot read properties of undefined (reading 'reduce') @ 2401:30754"
//   followed by "ReferenceError: viewPos is not defined @ 5145:33" on every click.
//
// Chain: a wheel position synced down from Firebase is missing `ccHistory`
// -> renderDesktopWheelPositions does e.ccHistory.reduce(...) and throws
// -> the throw happens inside initApp(), which runs at the IIFE tail BEFORE
//    the window.* export block, so viewPos/markAssigned/etc. never get
//    exported and every inline onclick in the app breaks.
//
// Extracts renderDesktopWheelPositions from the deployed index.html and runs
// it in a sandbox with a wheel position shaped like topshot's (no ccHistory).
// PASS = renders without throwing AND heals ccHistory to []. FAIL = throws.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name) {
  const start = html.indexOf('function ' + name);
  if (start === -1) { console.error('FAIL: ' + name + ' not found'); process.exit(1); }
  let depth = 0, end = -1;
  for (let j = html.indexOf('{', start); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return html.slice(start, end);
}

const fnSrc = extractFn('renderDesktopWheelPositions');

// Wheel position shaped like topshot's bad Firebase record: holding a wheel
// but with NO ccHistory key at all.
const state = {
  wheelPositions: [{
    id: 'w1', symbol: 'CIFR', status: 'holding', shares: 1400, contracts: 14,
    assignPrice: 19, currentPrice: 19, costBasis: 19, originalCostBasis: 19,
    assignedAt: Date.now() - 5 * 864e5, totalPremiumCollected: 238
    // ccHistory intentionally absent
  }],
  positions: []
};

// Proxy sandbox: `t` = app state, `e` = element getter; every other
// outer-scope helper the minified fn touches gets a permissive stub.
const el = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {}, style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } };
const stub = () => '';
const base = {
  t: state,
  e: () => el,
  Date, Math, JSON, Array, Object, String, Number, isNaN, parseFloat, parseInt,
  console
};
const sandbox = new Proxy(base, {
  has: () => true,
  get: (o, k) => {
    if (k in o) return o[k];
    if (k === Symbol.unscopables) return undefined;
    return stub;
  }
});
const ctx = vm.createContext({});
const runner = vm.compileFunction('with(sb){' + fnSrc + '; renderDesktopWheelPositions()}', ['sb'], { parsingContext: ctx });

let threw = null;
try { runner(sandbox); } catch (err) { threw = err; }

let failed = false;
if (threw) {
  console.error('FAIL: renderDesktopWheelPositions threw -> ' + threw.message);
  failed = true;
} else {
  console.log('ok: render did not throw');
  if (!Array.isArray(state.wheelPositions[0].ccHistory)) {
    console.error('FAIL: wheel record not healed (ccHistory still missing after render)');
    failed = true;
  } else {
    console.log('ok: ccHistory healed to [] in place');
  }
}

// Static checks for the other two patch points.
if (!html.includes('__wheel_cchistory_fix_v1__loadstate')) {
  console.error('FAIL: loadState normalization marker missing');
  failed = true;
} else console.log('ok: loadState normalizes ccHistory');

if (!html.includes('__wheel_cchistory_fix_v1__boot')) {
  console.error('FAIL: initApp boot guard marker missing (an init throw still kills the window.* exports)');
  failed = true;
} else console.log('ok: initApp wrapped in try/catch before export block');

if (failed) process.exit(1);
console.log('PASS');
