// Tom's wheel tracker feedback (2026-10-09). DISPLAY ONLY — nothing here
// writes to a wheel, its transactions, save(), Firebase or localStorage.
//  1. Ht: Premium Per Share divides by contracts x 100 (latest sell_csp /
//     sell_to_open by date) while no shares are held; exposes perShareBasis +
//     perShareContracts for the card subline.
//  2. Ht: new cspNet / ccNet (sells minus |BTC| per side, clamped >= 0);
//     renderAnalytics mix bar uses them (0-100, labels sum to 100).
//  3. Ut: "Exp" column after Date.
//  4. renderCalendar: expiration markers (own dot class, popup row, legend).
//
// Idempotent marker: __wheel_feedback_v1__
// Strings are inserted with indexOf + substring (never String.replace).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let s = fs.readFileSync(file, 'utf8');

const MARK = '__wheel_feedback_v1__';
if (s.includes(MARK)) {
  console.log('already patched, nothing to do');
  process.exit(0);
}

const OPTION_TYPES = '["sell_csp","sell_cc","btc_put","btc_call","sell_to_open"]';

const patches = [
  {
    name: 'css: expiration dot',
    bad: '.wt-cal-dot.div{background:var(--mg)}',
    good: '.wt-cal-dot.div{background:var(--mg)}\n/* ' + MARK + 'css */.wt-cal-dot.exp{background:transparent;box-shadow:inset 0 0 0 1.5px var(--pr)}'
  },
  {
    name: 'Ht: per-share basis + side nets',
    bad: 'p=s>0?n/s:n/100,g=Bt(e),v=Math.floor(s/100);return{totalPremium:n,cspPremium:i,ccPremium:a,shares:s,costBasis:o,yieldPct:d,daysActive:c,perShare:p,discipline:g,ccAvailable:v,capital:l,ccContracts:r}}',
    good:
      '/* ' + MARK + 'ht */' +
      'perShareContracts=s>0?0:(()=>{let latestSell=null;t.forEach(tx=>{tx&&("sell_csp"===tx.type||"sell_to_open"===tx.type)&&(!latestSell||String(tx.date||"")>=String(latestSell.date||""))&&(latestSell=tx)});const sellContracts=latestSell?Number(latestSell.contracts)||0:0;return sellContracts>0?sellContracts:0})(),' +
      'perShareBasis=s>0?s:perShareContracts>0?100*perShareContracts:100,' +
      'p=s>0?n/s:n/perShareBasis,' +
      'wheelSideNets=(()=>{let cspSide=0,ccSide=0;t.forEach(tx=>{if(!tx)return;const txValue=tx.totalValue||0;"sell_csp"===tx.type||"sell_to_open"===tx.type?cspSide+=txValue:"sell_cc"===tx.type?ccSide+=txValue:"btc_put"===tx.type?cspSide-=Math.abs(txValue):"btc_call"===tx.type&&(ccSide-=Math.abs(txValue))});return{csp:Math.max(0,cspSide),cc:Math.max(0,ccSide)}})(),' +
      'g=Bt(e),v=Math.floor(s/100);return{totalPremium:n,cspPremium:i,ccPremium:a,shares:s,costBasis:o,yieldPct:d,daysActive:c,perShare:p,discipline:g,ccAvailable:v,capital:l,ccContracts:r,perShareBasis:perShareBasis,perShareContracts:perShareContracts,cspNet:wheelSideNets.csp,ccNet:wheelSideNets.cc}}'
  },
  {
    name: 'renderAnalytics: mix bar split',
    bad: 'function renderAnalytics(e,t){const n=t,i=n.totalPremium>0?n.cspPremium/n.totalPremium*100:50,a=100-i,',
    good: 'function renderAnalytics(e,t){/* ' + MARK + 'mix */const n=t,mixCspNet=Math.max(0,Number(n.cspNet)||0),mixCcNet=Math.max(0,Number(n.ccNet)||0),mixSideTotal=mixCspNet+mixCcNet,i=mixSideTotal>0?Math.min(100,Math.max(0,Math.round(mixCspNet/mixSideTotal*100))):50,a=100-i,'
  },
  {
    name: 'renderAnalytics: per-share subline',
    bad: '<div class="stat-sub" style="margin-top:6px">${n.shares} shares held</div>',
    good: '<div class="stat-sub" style="margin-top:6px">${n.shares>0||!n.perShareBasis?n.shares+" shares held":"per "+n.perShareBasis+" shares"+(n.perShareContracts>0?" ("+n.perShareContracts+" contract"+(1===n.perShareContracts?"":"s")+")":"")}</div>'
  },
  {
    name: 'Ut: Exp header',
    bad: '<th>Date</th><th>Type</th><th>Strike</th><th>Premium</th><th>Contracts</th><th>Credit/Debit</th><th>Notes</th>',
    good: '<th>Date</th><th>Exp</th><th>Type</th><th>Strike</th><th>Premium</th><th>Contracts</th><th>Credit/Debit</th><th>Notes</th>'
  },
  {
    name: 'Ut: Exp cell',
    bad: '${t.map(e=>{const t=e.totalValue>=0;return`<tr>\\n              <td class="m">${e.date}</td>',
    good: '${t.map(e=>{const t=e.totalValue>=0;return`<tr>\\n              <td class="m">${e.date}</td>\\n              <td class="m">${/* ' + MARK + 'exp */' + OPTION_TYPES + '.includes(e.type)&&e.expiration?String(e.expiration):"\\u2014"}</td>'
  },
  {
    name: 'renderCalendar: expiry list',
    bad: 'a.forEach(e=>{const t=e.date;l[t]||(l[t]=[]),l[t].push(e)});const d=e=>',
    good:
      'a.forEach(e=>{const t=e.date;l[t]||(l[t]=[]),l[t].push(e)});' +
      '/* ' + MARK + 'cal */const calExpiryByDay={},calExpirySeen={};a.forEach(tx=>{if(!tx||!tx.expiration||!["sell_csp","sell_cc","sell_to_open"].includes(tx.type))return;const expDay=String(tx.expiration).slice(0,10),expKey=expDay+"|"+(null==tx.strike?"":tx.strike)+"|"+tx.type;if(calExpirySeen[expKey])return;calExpirySeen[expKey]=1;(calExpiryByDay[expDay]||(calExpiryByDay[expDay]=[])).push({label:("sell_csp"===tx.type?"CSP":"sell_cc"===tx.type?"CC":"Option")+" expires",strike:tx.strike,contracts:tx.contracts})});' +
      'const d=e=>'
  },
  {
    name: 'renderCalendar: day expiries',
    bad: 's=l[t]||[];c+=`<div class="wt-cal-day ${a?"today":""}"',
    good: 's=l[t]||[],dayExpiries=calExpiryByDay[t]||[];c+=`<div class="wt-cal-day ${a?"today":""}"'
  },
  {
    name: 'renderCalendar: dots + popup open',
    bad: '${s.map(e=>`<span class="wt-cal-dot ${d(e.type)}"></span>`).join("")}</div>\\n      ${s.length>0?`<div class="wt-cal-popup">',
    good: '${s.map(e=>`<span class="wt-cal-dot ${d(e.type)}"></span>`).join("")}${dayExpiries.map(()=>\'<span class="wt-cal-dot exp"></span>\').join("")}</div>\\n      ${s.length>0||dayExpiries.length>0?`<div class="wt-cal-popup">'
  },
  {
    name: 'renderCalendar: popup expiry rows',
    bad: '<span style="margin-left:auto;font-family:var(--fm);font-size:11px" class="${e.totalValue>=0?"wt-credit":"wt-debit"}">${It(e.totalValue)}</span>\\n        </div>`).join("")}',
    good: '<span style="margin-left:auto;font-family:var(--fm);font-size:11px" class="${e.totalValue>=0?"wt-credit":"wt-debit"}">${It(e.totalValue)}</span>\\n        </div>`).join("")}${dayExpiries.map(x=>`<div class="wt-cal-popup-item"><span class="wt-tx-dot" style="background:var(--pr)"></span><span>${x.label}${null!=x.strike&&""!==x.strike?" \\u00b7 $"+x.strike:""}${x.contracts?" x"+x.contracts:""}</span></div>`).join("")}'
  },
  {
    name: 'renderCalendar: legend',
    bad: '<div class="wt-cal-legend-item"><span class="wt-cal-legend-dot" style="background:var(--mg)"></span>Dividend</div>',
    good: '<div class="wt-cal-legend-item"><span class="wt-cal-legend-dot" style="background:var(--mg)"></span>Dividend</div>\\n      <div class="wt-cal-legend-item"><span class="wt-cal-legend-dot" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--pr)"></span>Expiration</div>'
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
  const at = s.indexOf(p.bad);
  s = s.substring(0, at) + p.good + s.substring(at + p.bad.length);
  console.log('patched: ' + p.name);
}
fs.writeFileSync(file, s);
console.log('done — ' + patches.length + ' patches applied');
