/* __cc_example_math_fix_v1__
   Fix tester-reported math error (Nepkire, Discord 2026-06-02):
   Covered Calls Fundamentals > Example Trade claimed "$3,150 total gain".
   Correct: ($180 strike - $170 basis) x 100 = $1,000 + $150 premium = $1,150.
   Also rewrites the line so the arithmetic shown actually adds up.
   Idempotent: safe to run again. */
const fs = require('fs');

const OLD = 'If Called Away: Sell at $180 + keep $150 = $3,150 total gain';
const NEW = 'If Called Away: $1,000 gain on shares ($170 → $180) + $150 premium = $1,150 total gain';

const targets = [
  'index.html',
  'C:/Users/Beau_/Documents/wheel/ui-references/desktop-v7.html',
];

for (const p of targets) {
  if (!fs.existsSync(p)) { console.log('SKIP (missing):', p); continue; }
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(NEW)) { console.log('ALREADY PATCHED:', p); continue; }
  if (!s.includes(OLD)) { console.log('MARKER NOT FOUND (manual review needed):', p); process.exitCode = 1; continue; }
  s = s.split(OLD).join(NEW);
  fs.writeFileSync(p, s);
  console.log('PATCHED:', p);
}
