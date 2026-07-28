// Fix topshot's bug report (2026-07-28):
// A wheel position synced down from Firebase (older schema / main-site data)
// had no `ccHistory` array. renderDesktopWheelPositions did
// e.ccHistory.reduce(...) -> uncaught TypeError at boot, inside initApp(),
// which runs at the IIFE tail BEFORE the window.* export block -> viewPos,
// markAssigned and 100+ other inline onclick handlers never got exported ->
// "ReferenceError: viewPos is not defined" on every click.
//
// Three patches, idempotent marker: __wheel_cchistory_fix_v1__
//  1. loadState: normalize ccHistory to [] on every wheel (heals localStorage)
//  2. renderDesktopWheelPositions entry: same normalization in place (heals
//     records arriving via Firebase sync-down after boot; next save() pushes
//     the healed data back up)
//  3. wrap the tail initApp() call in try/catch so an init error can never
//     again abort the IIFE before the window.* handler exports run
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let s = fs.readFileSync(file, 'utf8');

if (s.includes('__wheel_cchistory_fix_v1__')) {
  console.log('already patched, nothing to do');
  process.exit(0);
}

const patches = [
  {
    name: 'loadState normalize',
    bad: '(null==e.pnl||isNaN(e.pnl))&&(e.pnl=0)})}catch(e){}}function save()',
    good: '(null==e.pnl||isNaN(e.pnl))&&(e.pnl=0)}),/* __wheel_cchistory_fix_v1__loadstate */(t.wheelPositions||[]).forEach(e=>{Array.isArray(e.ccHistory)||(e.ccHistory=[])})}catch(e){}}function save()'
  },
  {
    name: 'render entry normalize',
    bad: 'function renderDesktopWheelPositions(){const n=e("desktopWheelList");if(!n)return;const i=t.wheelPositions||[],',
    good: 'function renderDesktopWheelPositions(){const n=e("desktopWheelList");if(!n)return;/* __wheel_cchistory_fix_v1__render */(t.wheelPositions||[]).forEach(w=>{Array.isArray(w.ccHistory)||(w.ccHistory=[])});const i=t.wheelPositions||[],'
  },
  {
    name: 'boot guard around initApp',
    bad: '}(),initApp();',
    good: '}();/* __wheel_cchistory_fix_v1__boot */try{initApp()}catch(_e){console.error("[Init] boot error:",_e)};'
  }
];

for (const p of patches) {
  const count = s.split(p.bad).length - 1;
  if (count !== 1) {
    console.error('expected exactly 1 occurrence for "' + p.name + '", found ' + count + ' — aborting, nothing written');
    process.exit(1);
  }
}
for (const p of patches) {
  // replacer fn so $ sequences in the strings are never treated as
  // String.replace special patterns
  s = s.replace(p.bad, () => p.good);
  console.log('patched: ' + p.name);
}
fs.writeFileSync(file, s);
console.log('done — 3 patches applied');
