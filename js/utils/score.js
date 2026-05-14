// ── HE SCORE UTILS ───────────────────────────────────────────────────────────
// Pure numeric helpers used by the scoring system.
// pScore and cAvg remain in app.js because they depend on CATS / BIZ_CAT_MAP
// constants defined there. Only the truly standalone avg helper lives here.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const U = window.HE_UTILS = window.HE_UTILS || {};

  // Simple numeric average of an array.
  // Used by pScore (app.js) and cAvg (app.js) internally.
  U.avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;

})();
