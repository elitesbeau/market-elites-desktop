// patch-rebrand-to-theta.js
// Replaces all user-facing "Market Elites" mentions with "Theta".
// Preserves backend identifiers (Firebase projectId, Cloudflare worker URL,
// Discord invite, beau@marketelites.io contact, noreply@marketelites.com).
//
// Run from the deployed-clone folder:  node patch-rebrand-to-theta.js
//
// Idempotent — safe to re-run.
const fs = require('fs');
const path = require('path');

const folder = __dirname;

// Order matters: longer/more specific patterns first.
const replacements = [
  // Discord bot username (both quote styles, both occurrences)
  { from: "username:'Market Elites Bot'", to: "username:'Theta'" },
  { from: "username: 'Market Elites Bot'", to: "username: 'Theta'" },

  // EmailJS from_name
  { from: 'from_name:"Market Elites"', to: 'from_name:"Theta"' },
  { from: "from_name:'Market Elites'", to: "from_name:'Theta'" },
  { from: 'from_name: "Market Elites"', to: 'from_name: "Theta"' },
  { from: "from_name: 'Market Elites'", to: "from_name: 'Theta'" },

  // Bug reporter discord embed footer
  { from: "Market Elites Desktop · Bug Reporter", to: "Theta · Bug Reporter" },

  // Welcome announcement (sample data)
  { from: "Welcome to Market Elites", to: "Welcome to Theta" },

  // Gate copy
  { from: "Market Elites Discord", to: "Theta Discord" },
  { from: "Market Elites server", to: "Theta server" },

  // Page <title>
  { from: "<title>MARKET ELITES</title>", to: "<title>THETA</title>" },
  { from: "<title>Market Elites — Access Audit</title>", to: "<title>Theta — Access Audit</title>" },
  { from: "<title>Market Elites — Access</title>", to: "<title>Theta — Access</title>" },

  // Big logo block (hero) — pattern is >MARKET ELITES<
  { from: ">MARKET ELITES<", to: ">THETA<" },

  // Logo titles
  { from: '"g-title">Market Elites<', to: '"g-title">Theta<' },
  { from: '"logo-title">Market Elites<', to: '"logo-title">Theta<' },

  // Disclaimer
  { from: "Market Elites is for educational", to: "Theta is for educational" },

  // Copyright
  { from: "© Market Elites 2026", to: "© Theta 2026" },
  { from: "&copy; Market Elites 2026", to: "&copy; Theta 2026" },

  // README
  { from: "# Market Elites Desktop", to: "# Theta" },
  { from: "Market Elites Desktop", to: "Theta" },
];

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function countOccurrences(str, sub) {
  if (!sub) return 0;
  const re = new RegExp(escapeForRegex(sub), 'g');
  return (str.match(re) || []).length;
}

function patchFile(filename) {
  const fp = path.join(folder, filename);
  if (!fs.existsSync(fp)) {
    console.log(`  [SKIP] ${filename} not found`);
    return 0;
  }
  let txt = fs.readFileSync(fp, 'utf8');
  let total = 0;
  for (const r of replacements) {
    const n = countOccurrences(txt, r.from);
    if (n > 0) {
      // Use split/join — never .replace() with $ unsafe strings
      txt = txt.split(r.from).join(r.to);
      console.log(`  [${filename}] "${r.from.substring(0, 50)}${r.from.length > 50 ? '...' : ''}" → ${n}`);
      total += n;
    }
  }
  fs.writeFileSync(fp, txt);
  return total;
}

const files = ['index.html', 'gate-audit.html', 'gate-test.html', 'README.md'];
let grandTotal = 0;
for (const f of files) {
  console.log(`\nPatching ${f}:`);
  const n = patchFile(f);
  console.log(`  Subtotal: ${n}`);
  grandTotal += n;
}
console.log(`\n=== TOTAL REPLACEMENTS: ${grandTotal} ===`);

// Surface remaining "Market Elites" / "marketelites" mentions for review
console.log('\n=== REMAINING REFERENCES (intentionally preserved or to-review) ===');
for (const f of files) {
  const fp = path.join(folder, f);
  if (!fs.existsSync(fp)) continue;
  const txt = fs.readFileSync(fp, 'utf8');
  const lines = txt.split('\n');
  lines.forEach((line, i) => {
    if (/market.elites|marketelites/i.test(line)) {
      const trimmed = line.trim();
      console.log(`  [${f}:${i + 1}] ${trimmed.substring(0, 120)}${trimmed.length > 120 ? '…' : ''}`);
    }
  });
}
