/* Unit test for the __edit_wheel_sync_v1__ injected algorithm.
   Reproduces amussic's report (2026-06-02): editing a copied position does not
   update the linked wheel-tracker transaction or the cycle premium aggregate.
   Runs the EXACT logic that gets injected into Ce(), against fixtures. */

// --- the algorithm under test (kept in sync with patch-edit-wheel-sync.js SNIPPET) ---
function editWheelSync(st, n, o, r, ktSpy) {
  try {
    if (!(n && ("csp" === r.type || "cc" === r.type))) return "skipped";
    var hit = null, whit = null, amb = false;
    for (var wi = 0; wi < st.wheels.length; wi++) {
      var w = st.wheels[wi];
      if (w.sym !== n.symbol) continue;
      var txs = w.transactions || [];
      for (var ti = 0; ti < txs.length; ti++) {
        var tx = txs[ti];
        if (!/^sell_/.test(tx.type || "")) continue;
        var m = (n.signalId && tx.signalId === n.signalId) ||
                (!n.signalId && !tx.signalId && tx.strike === o.strike && tx.premium === o.premium && tx.contracts === o.contracts);
        if (m) { if (hit) { amb = true; } else { hit = tx; whit = w; } }
      }
    }
    if (!hit || amb) return amb ? "ambiguous-skip" : "no-match";
    var oldTotal = hit.totalValue || 0, newTotal = (r.premium || 0) * (r.contracts || 1) * 100;
    hit.type = "cc" === r.type ? "sell_cc" : "sell_csp";
    hit.strike = r.strike; hit.expiration = r.expiration; hit.premium = r.premium; hit.contracts = r.contracts; hit.totalValue = newTotal;
    var cyc = (whit.cycles || []).find(function (c) { return "active" === c.status; }) || (whit.cycles || [])[(whit.cycles || []).length - 1];
    if (cyc) {
      cyc.premium = Math.max(0, (cyc.premium || 0) + (newTotal - oldTotal));
      cyc.yieldPct = (whit.capital || 25e3) > 0 ? cyc.premium / (whit.capital || 25e3) * 100 : 0;
    }
    ktSpy(st);
    return "updated";
  } catch (e) { return "error:" + e.message; }
}

// --- fixtures: a copied trade exactly like amussic's (premium edited 1.50 -> 1.20) ---
function fixtures() {
  const n = { id: "p1", symbol: "AAPL", type: "csp", strike: 170, expiration: "2026-06-12", premium: 1.2, contracts: 2, signalId: "sig123" };
  const o = { type: "csp", strike: 170, premium: 1.5, contracts: 2, expiration: "2026-06-12", fees: 1.3, notes: "" };
  const r = { type: "csp", strike: 170, premium: 1.2, contracts: 2, expiration: "2026-06-12", fees: 1.3, notes: "" };
  const st = { wheels: [{
    id: "w1", sym: "AAPL", status: "active", capital: 34000,
    transactions: [
      { id: "t0", type: "buy_shares", totalValue: 0 },
      { id: "t1", type: "sell_csp", signalId: "sig123", strike: 170, expiration: "2026-06-12", premium: 1.5, contracts: 2, totalValue: 300, notes: "Copied from signal" },
    ],
    cycles: [{ id: "c1", status: "active", premium: 300, yieldPct: 300 / 34000 * 100 }],
  }]};
  return { n, o, r, st };
}

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log("PASS:", name); } else { fail++; console.log("FAIL:", name); } }

// T1: signalId-matched tx updates premium/totalValue + cycle delta
{
  const { n, o, r, st } = fixtures();
  let saved = false;
  const res = editWheelSync(st, n, o, r, () => { saved = true; });
  const tx = st.wheels[0].transactions[1];
  assert("T1 result=updated", res === "updated");
  assert("T1 tx.premium 1.2", tx.premium === 1.2);
  assert("T1 tx.totalValue 240", tx.totalValue === 240);
  assert("T1 cycle premium 300->240", st.wheels[0].cycles[0].premium === 240);
  assert("T1 yieldPct recomputed", Math.abs(st.wheels[0].cycles[0].yieldPct - 240 / 34000 * 100) < 1e-9);
  assert("T1 kt called", saved);
}
// T2: type flip csp->cc flips tx type
{
  const { n, o, r, st } = fixtures();
  n.type = "cc"; r.type = "cc";
  editWheelSync(st, n, o, r, () => {});
  assert("T2 tx type sell_cc", st.wheels[0].transactions[1].type === "sell_cc");
}
// T3: shares type -> skip untouched
{
  const { n, o, r, st } = fixtures();
  r.type = "shares";
  const res = editWheelSync(st, n, o, r, () => {});
  assert("T3 skipped", res === "skipped" && st.wheels[0].transactions[1].premium === 1.5);
}
// T4: non-signal position falls back to old-value match
{
  const { n, o, r, st } = fixtures();
  n.signalId = null; st.wheels[0].transactions[1].signalId = null;
  const res = editWheelSync(st, n, o, r, () => {});
  assert("T4 fallback matched", res === "updated" && st.wheels[0].transactions[1].premium === 1.2);
}
// T5: ambiguous fallback (two identical sell txs) -> skip, nothing mutated
{
  const { n, o, r, st } = fixtures();
  n.signalId = null;
  st.wheels[0].transactions[1].signalId = null;
  st.wheels[0].transactions.push({ ...st.wheels[0].transactions[1], id: "t2" });
  const res = editWheelSync(st, n, o, r, () => {});
  assert("T5 ambiguous skip", res === "ambiguous-skip" && st.wheels[0].transactions[1].premium === 1.5);
}
// T6: no wheel for symbol -> no-match, no crash
{
  const { n, o, r, st } = fixtures();
  n.symbol = "TSLA";
  assert("T6 no-match", editWheelSync(st, n, o, r, () => {}) === "no-match");
}
// T7 (REPRODUCES THE BUG): current production behavior = nothing syncs.
// This documents the gap: before the patch, the deployed Ce() contains no wheel sync at all.
{
  const fs = require("fs");
  const s = fs.readFileSync("index.html", "utf8");
  assert("T7 patch present in Ce()", s.includes("__edit_wheel_sync_v1__"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
