// ── HE TIER UTILS ────────────────────────────────────────────────────────────
// Tier and level computation. Pure functions — no React, no DOM, no constants.
//
// DESIGN: Functions receive the tier array directly so this file has zero
// dependency on app.js data. app.js wraps each one with a thin local function
// that supplies TIERS or BIZ_TIERS, preserving the original call signatures
// throughout the rest of the codebase unchanged.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const U = window.HE_UTILS = window.HE_UTILS || {};

  // Non-linear level breakpoints within a tier (L1–L9).
  // L1 = first 2% of range, L9 = last ~20% of range.
  U.LEVEL_BREAKPOINTS = [0, .02, .05, .10, .18, .30, .46, .65, .80, 1.00];

  // Which tier does score `sc` fall into?
  // tiers: the full TIERS or BIZ_TIERS array.
  U.tierOf = (sc, tiers) => {
    if(sc==null || sc===0) return tiers[0];
    for(let i=tiers.length-1; i>=0; i--){
      if(sc >= tiers[i].min) return tiers[i];
    }
    return tiers[0];
  };

  // Fractional progress through the current tier (0–1).
  U.tierPct = (sc, tiers) => {
    if(!sc) return 0;
    const t = U.tierOf(sc, tiers);
    if(t.max === Infinity) return 1;
    return Math.min((sc - t.min) / (t.max - t.min + 1), 1);
  };

  // Level (1–9) and intra-level progress for a score within its tier.
  U.tierLevel = (sc, tiers) => {
    if(!sc || sc<=0) return {level:0, pct:0};
    const t = U.tierOf(sc, tiers);
    if(t.max === Infinity){
      const over = sc - t.min;
      const chunk = 2000; // every 2000pts = 1 level in top tier
      const level = Math.min(9, Math.floor(over/chunk)+1);
      return {level, pct:(over % chunk)/chunk};
    }
    const range = t.max - t.min + 1;
    const pos = (sc - t.min) / range;
    let level = 1;
    for(let i=1; i<U.LEVEL_BREAKPOINTS.length-1; i++){
      if(pos >= U.LEVEL_BREAKPOINTS[i]) level = i+1;
    }
    level = Math.min(9, level);
    const lo = U.LEVEL_BREAKPOINTS[level-1], hi = U.LEVEL_BREAKPOINTS[level];
    const pct = hi > lo ? (pos - lo) / (hi - lo) : 0;
    return {level, pct: Math.min(1, Math.max(0, pct))};
  };

  // Human-readable tier+level string "Nova L3", or null for 0-score / Ghost / New.
  U.tierLevelLabel = (sc, tiers) => {
    if(!sc || sc<=0) return null;
    const t = U.tierOf(sc, tiers);
    if(t.label==="Ghost" || t.label==="New") return null;
    const {level} = U.tierLevel(sc, tiers);
    return `${t.label} L${level}`;
  };

})();
