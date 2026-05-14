// ── HE FORMAT UTILS ──────────────────────────────────────────────────────────
// Pure formatting and display helpers.
// No React, no DOM manipulation, no side effects.
// Loaded before app.js via <script src="./js/utils/format.js">
// All functions attached to window.HE_UTILS namespace.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const U = window.HE_UTILS = window.HE_UTILS || {};

  // Initials from a name string: "John Doe" → "JD"
  U.ini = n => (n||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

  // Format a timestamp as "3:45 PM"
  U.fmtTime = ts => {
    if(!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", hour12:true});
  };

  // Format a Date object as "Today", "Yesterday", weekday name, or "12 Jan"
  U.formatDateLabel = d => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if(msgDay.getTime() === today.getTime()) return "Today";
    if(msgDay.getTime() === yesterday.getTime()) return "Yesterday";
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const diff = (today - msgDay) / 86400000;
    if(diff < 7) return days[d.getDay()];
    return d.toLocaleDateString([], {
      day:"numeric", month:"short",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    });
  };

  // Relative time: timestamp (ms) → "3m", "2h", "1d", "now"
  U.ago = ts => {
    const d=Date.now()-ts, s=Math.floor(d/1000), m=Math.floor(d/60000),
          h=Math.floor(d/3600000), dy=Math.floor(d/86400000);
    return dy>0 ? `${dy}d` : h>0 ? `${h}h` : m>0 ? `${m}m` : s>0 ? `${s}s` : "now";
  };

  // Shorten a UUID to a 6-char display ID: "AB12CD"
  U.shortId = id => id ? id.toString().replace(/-/g,"").toUpperCase().slice(0,6) : "------";

  // Format a score number: 1234 → "1.23K", 12345 → "12.3K"
  U.fmtScore = s => {
    if(s==null) return "—";
    if(s>=10000) return `${(s/1000).toFixed(1)}K`;
    if(s>=1000)  return `${(s/1000).toFixed(2)}K`;
    return String(s);
  };

  // Format a count number: 1234 → "1.2K", 1234567 → "1.2M"
  U.fmtCount = n => {
    if(!n) return "0";
    if(n>=1000000) return `${(n/1000000).toFixed(1)}M`;
    if(n>=1000)    return `${(n/1000).toFixed(1)}K`;
    return String(n);
  };

})();
