/* __edit_wheel_sync_v1__ installer
   Tester report (amussic, 2026-06-02): editing a copied position didn't update
   the linked wheel-tracker transaction or the cycle premium aggregate.
   Injects a sync step into Ce() (the position-edit save) right after save(),Le():
   - matches the wheel tx by signalId (copied trades) or exact old values (manual),
   - skips on ambiguity (never guesses),
   - updates tx type/strike/exp/premium/contracts/totalValue,
   - adjusts the active cycle premium by the delta + recomputes yieldPct,
   - persists via kt() (localStorage + firebase sync), in-scope inside the IIFE.
   Algorithm is unit-tested in test-edit-wheel-sync.js. Idempotent. */
const fs = require('fs');

const ANCHOR = 'save(),Le(),b()&&n.signalId&&H(n.signalId';
const MARKER = '__edit_wheel_sync_v1__';

const SNIPPET = '(function(){try{/* __edit_wheel_sync_v1__ */if(!("csp"===r.type||"cc"===r.type))return;var _st=wt(),_hit=null,_w=null,_amb=!1;for(var _wi=0;_wi<_st.wheels.length;_wi++){var _wh=_st.wheels[_wi];if(_wh.sym===n.symbol){var _txs=_wh.transactions||[];for(var _ti=0;_ti<_txs.length;_ti++){var _tx=_txs[_ti];if(/^sell_/.test(_tx.type||"")){var _m=n.signalId&&_tx.signalId===n.signalId||!n.signalId&&!_tx.signalId&&_tx.strike===o.strike&&_tx.premium===o.premium&&_tx.contracts===o.contracts;_m&&(_hit?_amb=!0:(_hit=_tx,_w=_wh))}}}}if(!_hit||_amb)return;var _ot=_hit.totalValue||0,_nt=(r.premium||0)*(r.contracts||1)*100;_hit.type="cc"===r.type?"sell_cc":"sell_csp";_hit.strike=r.strike;_hit.expiration=r.expiration;_hit.premium=r.premium;_hit.contracts=r.contracts;_hit.totalValue=_nt;var _cy=(_w.cycles||[]).find(function(c){return"active"===c.status})||(_w.cycles||[])[(_w.cycles||[]).length-1];_cy&&(_cy.premium=Math.max(0,(_cy.premium||0)+(_nt-_ot)),_cy.yieldPct=(_w.capital||25e3)>0?_cy.premium/(_w.capital||25e3)*100:0);kt(_st);console.log("[editWheelSync] wheel tx updated for",_w.sym)}catch(_e){console.warn("[editWheelSync]",_e)}})(),';

// syntax-validate the snippet before touching any file (stub the closure vars)
new Function('wt', 'kt', 'n', 'o', 'r', 'return ' + SNIPPET.slice(0, -1) + ';');

const targets = [
  'index.html',
  'C:/Users/Beau_/Documents/wheel/ui-references/desktop-v7.html',
];

for (const p of targets) {
  if (!fs.existsSync(p)) { console.log('SKIP (missing):', p); continue; }
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(MARKER)) { console.log('ALREADY PATCHED:', p); continue; }
  const count = s.split(ANCHOR).length - 1;
  if (count !== 1) { console.log(`ANCHOR COUNT ${count} (expected 1) — NOT PATCHING:`, p); process.exitCode = 1; continue; }
  s = s.replace(ANCHOR, 'save(),Le(),' + SNIPPET + 'b()&&n.signalId&&H(n.signalId');
  fs.writeFileSync(p, s);
  console.log('PATCHED:', p);
}
