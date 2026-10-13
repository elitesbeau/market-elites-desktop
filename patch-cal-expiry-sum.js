// Calendar expiry marks: when several sells share an expiry + strike + type,
// show their combined contracts (2 + 2 => x4) instead of only the first's.
// Only touches the display-only entry objects built in renderCalendar.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');
let s = fs.readFileSync(file, 'utf8');

if (s.indexOf('__cal_expiry_sum_v1__') !== -1) { console.log('already patched, nothing to do'); process.exit(0); }

function swap(oldStr, newStr) {
  const first = s.indexOf(oldStr);
  if (first === -1 || s.indexOf(oldStr, first + 1) !== -1) { console.error('anchor not found exactly once: ' + oldStr.slice(0, 60)); process.exit(1); }
  s = s.slice(0, first) + newStr + s.slice(first + oldStr.length);
}

swap('if(calExpirySeen[expKey])return;calExpirySeen[expKey]=1;(calExpiryByDay[expDay]||(calExpiryByDay[expDay]=[])).push({label:("sell_csp"===tx.type?"CSP":"sell_cc"===tx.type?"CC":"Option")+" expires",strike:tx.strike,contracts:tx.contracts})',
  '/* __cal_expiry_sum_v1__ */if(calExpirySeen[expKey]){calExpirySeen[expKey].contracts=(calExpirySeen[expKey].contracts||0)+(tx.contracts||0);return}const calExpEntry={label:("sell_csp"===tx.type?"CSP":"sell_cc"===tx.type?"CC":"Option")+" expires",strike:tx.strike,contracts:tx.contracts};calExpirySeen[expKey]=calExpEntry;(calExpiryByDay[expDay]||(calExpiryByDay[expDay]=[])).push(calExpEntry)');

fs.writeFileSync(file, s);
console.log('patched');
