// Reproducer (2026-10-13): admin can't roll a play out to Jan 15 2027 —
// the roll expiration dropdown stops 12 Fridays out (~Jan 1 2027).
//
// Extracts every expiration-list builder from the deployed index.html and
// runs it with "today" pinned to 2026-10-13. PASS = Jan 15 2027 (a standard
// monthly) is selectable in each, and the nearest weekly is still first.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractAll(name) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = html.indexOf('function ' + name + '(', from);
    if (start === -1) break;
    let depth = 0, end = -1;
    for (let j = html.indexOf('{', start); j < html.length; j++) {
      if (html[j] === '{') depth++;
      else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    out.push(html.slice(start, end));
    from = end;
  }
  return out;
}

// Date pinned to Tue 2026-10-13 local time; everything else behaves normally.
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(2026, 9, 13, 10, 0, 0); }
  static now() { return new FixedDate().getTime(); }
}

// Permissive DOM stub: any element, any property, any method.
function stub(store) {
  return new Proxy(function () {}, {
    get(_, k) {
      if (k === 'innerHTML') return store.html || '';
      if (k === 'value') return store.value || '';
      if (k === 'options') return { length: 0 };
      if (k === 'tagName') return 'SELECT';
      return stub(store);
    },
    set(_, k, v) { if (k === 'innerHTML') store.html = v; if (k === 'value') store.value = v; return true; },
    apply() { return stub(store); },
  });
}

const optionValues = s => [...s.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
let failures = 0;
function check(label, values, want, firstWant) {
  const ok = values.includes(want) && values[0] === firstWant;
  console.log((ok ? 'PASS' : 'FAIL') + `: ${label} — ${values.length} options, first ${values[0]}, last ${values[values.length - 1]}, has ${want}: ${values.includes(want)}`);
  if (!ok) failures++;
}

// 1) Admin roll dialog (_handleAdminRoll — defined twice in the file; the later one wins at runtime, test both)
const rolls = extractAll('_handleAdminRoll');
if (!rolls.length) { console.error('FAIL: _handleAdminRoll not found'); process.exit(1); }
rolls.forEach((src, idx) => {
  const store = {};
  const doc = { getElementById: () => stub(store), querySelector: () => stub(store) };
  const fn = new Function('document', 'Date', 'window', src + '; return _handleAdminRoll;')(doc, FixedDate, {});
  try { fn({ ticker: 'HL', strike: 40, id: 'x' }); } catch (_) { /* post-render wiring may hit the stub; only the markup matters */ }
  check(`admin roll copy #${idx + 1}`, optionValues(store.html || ''), '1/15/2027', '10/16/2026');
});

// 2) Position roll dropdown (getExpDateOptions — ISO values)
const ged = extractAll('getExpDateOptions');
if (!ged.length) { console.error('FAIL: getExpDateOptions not found'); process.exit(1); }
ged.forEach((src, idx) => {
  const fn = new Function('Date', src + '; return getExpDateOptions;')(FixedDate);
  check(`position roll getExpDateOptions #${idx + 1}`, optionValues(fn()), '2027-01-15', '2026-10-16');
});

process.exit(failures ? 1 : 0);
