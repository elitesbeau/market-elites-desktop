// Fix tester bug report -Oux2cP6G-6WTDqGrYdp (2026-06-12):
// viewTradeDetail's PREMIUM metric referenced `t` (the app state object)
// instead of `S` (totalPrem = totalPremiumCollected ?? premium*contracts*100),
// so opening ANY past position from the positions tab threw
// "TypeError: t.toFixed is not a function" and the modal never opened.
// Unminified source (desktop-v7.html:8748) uses totalPrem.toFixed(0); `S` is
// its minified name in this scope. Idempotent marker: __td_premium_fix_v1__
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let s = fs.readFileSync(file, 'utf8');

if (s.includes('/* __td_premium_fix_v1__ */')) {
  console.log('already patched, nothing to do');
  process.exit(0);
}

const bad = `>$'+t.toFixed(0)+`;
const good = `>$'+/* __td_premium_fix_v1__ */Number(S||0).toFixed(0)+`;

const count = s.split(bad).length - 1;
if (count !== 1) {
  console.error('expected exactly 1 occurrence of bad string, found ' + count + ' — aborting');
  process.exit(1);
}
// replacer fn: the literal $' in these strings must not be treated as a
// String.replace special pattern
s = s.replace(bad, () => good);
fs.writeFileSync(file, s);
console.log('patched: PREMIUM metric now uses Number(S||0).toFixed(0)');
