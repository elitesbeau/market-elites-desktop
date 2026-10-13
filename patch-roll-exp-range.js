// Fix (2026-10-13): roll dialogs only offered the next 12 Fridays, so a play
// could not be rolled out to e.g. Jan 15 2027.
//
// New list = the next 12 weekly Fridays (unchanged, same first entry), then the
// standard monthly expiration (3rd Friday) of every later month, out to 24
// months from today. Ascending, no duplicates.
//
// Patches (idempotent marker: __roll_exp_range_v1__):
//  1+2. _handleAdminRoll (defined twice, separate <script> blocks): append the
//       monthlies to `fr` right after the weekly loop. Value M/D/YYYY, label
//       "Mon D, YYYY" - same as the weeklies.
//  3.   getExpDateOptions: rewritten with the same list. Value stays ISO;
//       label gains ", YYYY" when the date is outside the current calendar
//       year; preselect still accepts the ISO value or the legacy bare label.
//
// indexOf + substring only (no String.replace), aborts without writing if an
// anchor is not found the expected number of times.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let s = fs.readFileSync(file, 'utf8');

const MARKER = '__roll_exp_range_v1__';
if (s.includes(MARKER)) {
  console.log('already patched, nothing to do');
  process.exit(0);
}

function count(hay, needle) {
  let n = 0, at = 0;
  for (;;) { const k = hay.indexOf(needle, at); if (k === -1) return n; n++; at = k + needle.length; }
}

// --- 1+2: _handleAdminRoll (insert before the option-markup line, both copies)
const rollAnchor = "var oh=fr.map(function(f){return'<option value=\"'+f.v+'\">'+f.l+'</option>'}).join('');";
const rollInsert =
  "/* " + MARKER + " admin roll: after the 12 weeklies, add each later month's standard expiration (3rd Friday) out to 24 months */" +
  "var lw=new Date(d.getTime());lw.setDate(lw.getDate()-7);" +
  "var em=new Date;em.setMonth(em.getMonth()+24);" +
  "for(var my=lw.getFullYear(),mm=lw.getMonth();;mm++){" +
  "var tf=new Date(my,mm,1);tf.setDate(1+(5-tf.getDay()+7)%7+14);" +
  "if(tf>em)break;" +
  "if(tf>lw)fr.push({l:ms[tf.getMonth()]+' '+tf.getDate()+', '+tf.getFullYear(),v:(tf.getMonth()+1)+'/'+tf.getDate()+'/'+tf.getFullYear()})}";

// --- 3: getExpDateOptions (whole function, minified one-liner)
const gedOld = 'function getExpDateOptions(e){const t=[];let i=new Date;i.setDate(i.getDate()+((5-i.getDay()+7)%7||7));for(let k=0;k<12;k++){const _lab=i.toLocaleDateString("en",{month:"short",day:"numeric"}),_iso=i.getFullYear()+"-"+String(i.getMonth()+1).padStart(2,"0")+"-"+String(i.getDate()).padStart(2,"0"),/* value carries the year so "Dec 20" can never be read as the wrong one; older positions stored the bare label, so accept either when preselecting */_sel=e&&(e===_iso||e===_lab)?" selected":"";t.push(\'<option value="\'+_iso+\'"\'+_sel+">"+_lab+"</option>"),i.setDate(i.getDate()+7)}return t.join("")}';
const gedNew = 'function getExpDateOptions(e){const t=[],_cy=(new Date).getFullYear();let _pk=!1;const _add=function(x){const _bare=x.toLocaleDateString("en",{month:"short",day:"numeric"}),_lab=x.getFullYear()===_cy?_bare:_bare+", "+x.getFullYear(),_iso=x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"),/* value carries the year so "Dec 20" can never be read as the wrong one; older positions stored the bare label, so accept either when preselecting (first match only) */_sel=!_pk&&e&&(e===_iso||e===_bare||e===_lab)?" selected":"";_sel&&(_pk=!0),t.push(\'<option value="\'+_iso+\'"\'+_sel+">"+_lab+"</option>")};let i=new Date;i.setDate(i.getDate()+((5-i.getDay()+7)%7||7));for(let k=0;k<12;k++)_add(i),i.setDate(i.getDate()+7);/* ' + MARKER + ' then each later month\'s standard expiration (3rd Friday) out to 24 months */const _lw=new Date(i.getTime());_lw.setDate(_lw.getDate()-7);const _end=new Date;_end.setMonth(_end.getMonth()+24);for(let _y=_lw.getFullYear(),_m=_lw.getMonth();;_m++){const _tf=new Date(_y,_m,1);if(_tf.setDate(1+(5-_tf.getDay()+7)%7+14),_tf>_end)break;_tf>_lw&&_add(_tf)}return t.join("")}';

const checks = [
  { name: '_handleAdminRoll option line', needle: rollAnchor, want: 2 },
  { name: 'getExpDateOptions', needle: gedOld, want: 1 },
];
for (const c of checks) {
  const n = count(s, c.needle);
  if (n !== c.want) {
    console.error('expected ' + c.want + ' occurrence(s) of "' + c.name + '", found ' + n + ' - aborting, nothing written');
    process.exit(1);
  }
}

// insert before each admin-roll anchor (walk backwards so offsets stay valid)
const rollAt = [];
for (let at = 0;;) { const k = s.indexOf(rollAnchor, at); if (k === -1) break; rollAt.push(k); at = k + rollAnchor.length; }
for (let j = rollAt.length - 1; j >= 0; j--) {
  // match the line ending already used just before the anchor (file has mixed CRLF/LF)
  const eol = s.substring(rollAt[j] - 2, rollAt[j]) === '\r\n' ? '\r\n' : '\n';
  s = s.substring(0, rollAt[j]) + rollInsert + eol + s.substring(rollAt[j]);
  console.log('patched: _handleAdminRoll copy #' + (j + 1));
}

const g = s.indexOf(gedOld);
s = s.substring(0, g) + gedNew + s.substring(g + gedOld.length);
console.log('patched: getExpDateOptions');

fs.writeFileSync(file, s);
console.log('done - 3 patches applied');
