// Reproducing check for Nepkire's bug report (2026-06-02):
// Covered Calls Fundamentals "Example Trade" claims $3,150 total gain.
// Correct: ($180 strike - $170 basis) x 100 + $150 premium = $1,150.
// FAILS while the bug exists; PASSES after the patch.
const fs = require('fs');

const targets = [
  'index.html',                                              // deployed (canonical)
  'C:/Users/Beau_/Documents/wheel/ui-references/desktop-v7.html', // source mirror
];

let failed = false;
for (const p of targets) {
  if (!fs.existsSync(p)) { console.log('SKIP (missing):', p); continue; }
  const s = fs.readFileSync(p, 'utf8');
  const lines = s.match(/If Called Away:[^<]*/g) || [];
  lines.forEach(l => console.log(`[${p}] ${l.slice(0, 110)}`));
  const hasBad = s.includes('$3,150 total gain');
  const hasGood = s.includes('$1,150 total gain');
  if (hasBad || !hasGood) {
    console.log(`FAIL: ${p} -> bad($3,150)=${hasBad} good($1,150)=${hasGood}`);
    failed = true;
  } else {
    console.log(`PASS: ${p}`);
  }
}
// sanity: list every "total gain" claim so no sibling example is silently wrong
const all = fs.readFileSync('index.html', 'utf8').match(/= \$[\d,]+ total gain/g) || [];
console.log('All total-gain claims in deployed file:', all);
process.exit(failed ? 1 : 0);
