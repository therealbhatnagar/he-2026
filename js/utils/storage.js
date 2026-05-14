// ── HE STORAGE UTILS ─────────────────────────────────────────────────────────
// localStorage helpers. No React, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const U = window.HE_UTILS = window.HE_UTILS || {};

  // Read the user preferences object from localStorage.
  // Returns {} on parse failure or missing key.
  U.getPref = () => {
    try{ return JSON.parse(localStorage.getItem("he_pref")) || {}; }
    catch{ return {}; }
  };

  // Write the user preferences object to localStorage.
  U.setPref = v => {
    try{ localStorage.setItem("he_pref", JSON.stringify(v)); }
    catch{}
  };

  // Group chat helpers (groups stored per-user in localStorage)
  U.GRP_KEY  = uid => `he_groups_${uid}`;

  U.loadGroups = uid => {
    try{ return JSON.parse(localStorage.getItem(U.GRP_KEY(uid)) || "[]"); }
    catch{ return []; }
  };

  U.saveGroups = (uid, groups) => {
    try{ localStorage.setItem(U.GRP_KEY(uid), JSON.stringify(groups)); }
    catch{}
  };

  // Generate a random group ID: "grp_x7k2m9ab"
  U.newGroupId = () => "grp_" + Math.random().toString(36).slice(2,10);

  // Load a generic script tag by URL (used for jsQR / QRious lazy loading).
  // Skips if the library is already on window.
  U.loadScript = (src, cb) => {
    if(src.includes("jsQR")   && window.jsQR)    return cb();
    if(src.includes("qrious") && window.QRious)  return cb();
    const s = document.createElement("script");
    s.src = src;
    s.onload = cb;
    document.head.appendChild(s);
  };

})();
