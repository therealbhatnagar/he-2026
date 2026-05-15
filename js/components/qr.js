// ── QR MODAL + SHARE CARD ────────────────────────────────────────────────────
// Self-contained: QR rendering, share-card canvas export, save/share actions.
// No React imports needed — React, useState, useEffect, useRef are globals
// loaded by the CDN <script> tags before this file runs.
//
// Exports (via window.HE_COMPONENTS):
//   QRModal({ profile, T, onClose })
//
// Depends on globals from app.js (available at call time, not parse time):
//   pScore, tierOf, ini, shortId, loadScript, getProfileUrl, AC,
//   BIZ_TYPES, Spinner, TierBadge
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const {useState, useEffect, useRef} = React;

  // ── CONSTANTS ───────────────────────────────────────────────────────────────
  // Fixed export dimensions — preview and export use the same logical size.
  // We scale by DPR so the file is crisp on retina without the preview shifting.
  const QR_EXPORT_W   = 500;
  const QR_EXPORT_H   = 700;
  const QR_SIZE       = 500;   // QRious backing size — never changes
  const QR_DRAW_SIZE  = 320;   // How large the QR is drawn on the export card
  const QR_PREVIEW_PX = 240;   // CSS px for the visible QR preview square

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  // Create a DPR-scaled canvas for crisp retina exports.
  // Returns { canvas, ctx, W, H } where W/H are the logical (CSS) dimensions.
  function makeHiDpiCanvas(logicalW, logicalH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2×
    const canvas = document.createElement("canvas");
    canvas.width  = logicalW * dpr;
    canvas.height = logicalH * dpr;
    canvas.style.width  = logicalW + "px";
    canvas.style.height = logicalH + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas, ctx, W: logicalW, H: logicalH, dpr };
  }

  // Safely reset all canvas shadow state.
  // Missing this was the cause of black halos bleeding between draw calls.
  function clearShadow(ctx) {
    ctx.shadowColor   = "transparent";
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Portable roundRect — falls back to plain rect on old browsers.
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    try { ctx.roundRect(x, y, w, h, r); }
    catch { ctx.rect(x, y, w, h); }
  }

  // ── RENDER SAVE CARD ────────────────────────────────────────────────────────
  // Returns a Promise<HTMLCanvasElement> so callers can await it before
  // calling toBlob/toDataURL. This eliminates the race condition where
  // shareQR/saveQR called renderSaveCard synchronously then immediately
  // read the canvas before drawImage had completed.

  function buildShareCard(qrCanvas, profile, col, isBiz, bizInfo) {
    return new Promise(resolve => {
      const { canvas, ctx, W, H } = makeHiDpiCanvas(QR_EXPORT_W, QR_EXPORT_H);
      const cx = W / 2;

      // ── White background ──
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // ── Top color band ──
      const band = ctx.createLinearGradient(0, 0, W, 0);
      band.addColorStop(0, col);
      band.addColorStop(1, col + "90");
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, W, 120);

      // ── White card body (with shadow) ──
      ctx.fillStyle     = "#ffffff";
      ctx.shadowColor   = "rgba(0,0,0,.12)";
      ctx.shadowBlur    = 20;
      ctx.shadowOffsetY = 4;
      roundRect(ctx, 24, 90, W - 48, H - 114, 20);
      ctx.fill();
      clearShadow(ctx); // ← critical: clears shadow before all subsequent draws

      // ── Avatar circle ──
      ctx.beginPath();
      ctx.arc(cx, 100, 50, 0, Math.PI * 2);
      ctx.fillStyle = col + "22"; ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = col;       ctx.lineWidth = 2; ctx.stroke();
      ctx.font          = "bold 36px Inter,Arial,sans-serif";
      ctx.fillStyle     = col;
      ctx.textAlign     = "center";
      ctx.textBaseline  = "middle";
      ctx.fillText(window.HE_UTILS.ini(profile.name), cx, 100);

      // ── Name ──
      ctx.textBaseline = "alphabetic";
      ctx.textAlign    = "center";
      ctx.font         = "700 26px Inter,Arial,sans-serif";
      ctx.fillStyle    = "#0d0c1a";
      let nameText = profile.name;
      while (ctx.measureText(nameText).width > W - 120 && nameText.length > 4)
        nameText = nameText.slice(0, -1);
      if (nameText !== profile.name) nameText += "…";
      ctx.fillText(nameText, cx, 175);

      // ── Biz type or handle ──
      if (isBiz && bizInfo) {
        ctx.font      = "500 14px Inter,Arial,sans-serif";
        ctx.fillStyle = col;
        ctx.fillText(`${bizInfo.emoji} ${bizInfo.label}`, cx, 198);
      } else if (profile.handle) {
        ctx.font      = "500 13px JetBrains Mono,monospace";
        ctx.fillStyle = "#8888a8";
        ctx.fillText(profile.handle, cx, 198);
      }

      // ── QR image ──
      // qrCanvas is the QRious canvas at QR_SIZE×QR_SIZE backing resolution.
      // We draw it at QR_DRAW_SIZE logical pixels — no CSS scaling artifacts.
      const QS = QR_DRAW_SIZE, qx = cx - QS / 2, qy = 215;
      ctx.drawImage(qrCanvas, qx, qy, QS, QS);

      // ── H logo in center of QR ──
      const hx = cx, hy = qy + QS / 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font         = "900 24px Inter,Arial,sans-serif";
      ctx.fillStyle    = col;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", hx, hy + 1);

      // ── Scan prompt ──
      ctx.textBaseline = "alphabetic";
      ctx.textAlign    = "center";
      ctx.font         = "600 13px Inter,Arial,sans-serif";
      ctx.fillStyle    = col;
      ctx.fillText(isBiz ? "Scan to review this business" : "Scan to view profile", cx, 560);

      // ── URL ──
      const displayUrl = window.HE_getProfileUrl(profile).replace("https://", "");
      ctx.font      = "500 11px JetBrains Mono,monospace";
      ctx.fillStyle = "#9090b0";
      ctx.fillText(displayUrl, cx, 580);

      // ── HighEnough brand ──
      ctx.font = "800 18px Inter,Arial,sans-serif";
      ctx.fillStyle = "#0d0c1a";
      const hiW = ctx.measureText("High").width;
      ctx.font = "300 18px Inter,Arial,sans-serif"; // measure Enough with its own font
      const enW = ctx.measureText("Enough").width;
      ctx.font = "800 18px Inter,Arial,sans-serif";
      const lx = cx - (hiW + enW + 3) / 2;
      ctx.textAlign = "left";
      ctx.fillText("High", lx, 618);
      ctx.font      = "300 18px Inter,Arial,sans-serif";
      ctx.fillStyle = col;
      ctx.fillText("Enough", lx + hiW + 3, 618);

      // ── Bottom accent ──
      ctx.fillStyle = col;
      ctx.fillRect(0, H - 5, W, 5);

      resolve(canvas);
    });
  }

  // ── QR MODAL ────────────────────────────────────────────────────────────────
  function QRModal({ profile, T, onClose }) {
    const uid     = profile.short_id || window.HE_UTILS.shortId(profile.id);
    const shareUrl = window.HE_getProfileUrl(profile);
    const displayUrl = shareUrl.replace("https://", "");
    const isBiz   = profile.account_type === "business";
    const sc      = window.HE_pScore(profile);
    const t       = window.HE_tierOf(sc ?? 0, isBiz);
    const col     = profile.color || window.HE_AC;
    const bizInfo = isBiz ? window.HE_BIZ_TYPES.find(b => b.id === (profile.biz_type || "general")) : null;

    const qrRef      = useRef(null);  // QRious renders onto this canvas
    const cachedBlob = useRef(null);  // pre-built share card blob — ready before tap
    const cachedDataUrl = useRef(null); // pre-built data URL for save
    const [copied,  setCopied]  = useState(false);
    const [ready,   setReady]   = useState(false);

    // ── Step 1: Load QRious + render QR ───────────────────────────────────
    // loadScript is a no-op if QRious is already on window (subsequent opens
    // are instant — no network round-trip).
    useEffect(() => {
      window.HE_UTILS.loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js",
        () => {
          if (!qrRef.current) return;
          new window.QRious({
            element:    qrRef.current,
            value:      shareUrl,
            size:       QR_SIZE,
            background: "#ffffff",
            foreground: "#0a0a14",
            level:      "H",
            padding:    20,
          });
          setReady(true);
        }
      );
    }, [shareUrl]);

    // ── Step 2: Pre-build the share card as soon as QR is ready ──────────
    // This runs in the background after the QR preview is already visible.
    // By the time the user taps Share or Save the blob is already cached —
    // the share sheet opens instantly with no canvas work on the tap path.
    useEffect(() => {
      if (!ready || !qrRef.current) return;
      let cancelled = false;
      buildShareCard(qrRef.current, profile, col, isBiz, bizInfo).then(fc => {
        if (cancelled || !fc) return;
        // Cache blob for Share (navigator.share needs a File)
        fc.toBlob(blob => {
          if (!cancelled) cachedBlob.current = blob;
        }, "image/jpeg", .92);
        // Cache data URL for Save (instant download trigger)
        cachedDataUrl.current = fc.toDataURL("image/jpeg", .92);
      });
      return () => { cancelled = true; };
    }, [ready]);

    function copyUrl() {
      try { navigator.clipboard?.writeText(shareUrl); } catch {}
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }

    // ── Share: uses pre-built blob — opens native sheet instantly ─────────
    async function shareQR() {
      const blob = cachedBlob.current;
      const title = profile.name + " on HighEnough";
      const text  = isBiz ? `Review ${profile.name} on HighEnough` : `Check out ${profile.name} on HighEnough`;

      if (blob) {
        const file = new File([blob], `${profile.name.replace(/\s+/g,"_")}_HighEnough.jpg`, { type: "image/jpeg" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ title, text, url: shareUrl, files: [file] });
            return;
          } catch (e) { console.warn("File share failed:", e); }
        }
      }
      // Fallback: share URL only
      if (navigator.share)
        navigator.share({ title, text, url: shareUrl }).catch(() => copyUrl());
      else copyUrl();
    }

    // ── Save: triggers browser download — no false success state ──────────
    // a.click() opens the Android download chooser asynchronously.
    // There is no reliable API to know if the user confirmed or canceled,
    // so we never claim success. The download either completes or it doesn't.
    function saveQR() {
      const dataUrl = cachedDataUrl.current;
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.download = `${profile.name.replace(/\s+/g,"_")}_HighEnough_QR.jpg`;
      a.href = dataUrl;
      a.click();
    }

    return (
      <div
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position:"fixed",inset:0,zIndex:400,
          background:"rgba(4,3,14,.97)",
          backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",padding:"20px 16px",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position:"fixed",top:18,right:18,width:36,height:36,borderRadius:"50%",
            background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",
            color:"rgba(255,255,255,.8)",display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:16,zIndex:10,
          }}
        >✕</button>

        {/* QR Card — preview matches export exactly */}
        <div style={{
          background:"#ffffff",borderRadius:24,width:300,
          position:"relative",paddingTop:50,overflow:"visible",
          boxShadow:`0 0 0 1px ${col}20, 0 40px 120px rgba(0,0,0,.9)`,
          // Fixed width/height prevents layout shift during export
          flexShrink:0,
        }}>
          {/* Avatar */}
          <div style={{
            position:"absolute",top:-44,left:"50%",transform:"translateX(-50%)",
            width:88,height:88,borderRadius:"50%",overflow:"hidden",
            border:"3px solid #ffffff",boxShadow:`0 0 0 2px ${col}`,
            background:col+"22",display:"flex",alignItems:"center",
            justifyContent:"center",zIndex:2,
          }}>
            {profile.photo
              ? <img src={profile.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:700,color:col}}>
                  {window.HE_UTILS.ini(profile.name)}
                </span>
            }
          </div>

          {/* Top accent strip */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:4,
            borderRadius:"24px 24px 0 0",
            background:`linear-gradient(90deg,${col},${col}80)`,
          }}/>

          <div style={{padding:"8px 20px 20px",display:"flex",flexDirection:"column",alignItems:"center"}}>
            {/* Name */}
            <div style={{
              fontWeight:700,fontSize:16,color:"#0d0c1a",textAlign:"center",
              maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",
              whiteSpace:"nowrap",marginBottom:3,
            }}>{profile.name}</div>

            {/* Biz type or handle */}
            {isBiz && bizInfo
              ? <div style={{fontSize:11,color:col,fontWeight:600,background:`${col}12`,borderRadius:6,padding:"2px 9px",marginBottom:8}}>
                  {bizInfo.emoji} {bizInfo.label}
                </div>
              : <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#8888a8",marginBottom:8}}>
                  {profile.handle || ""}
                </div>
            }

            {/* QR canvas
                - canvas element is sized at QR_SIZE (500px backing) via QRious
                - CSS display is QR_PREVIEW_PX (240px) — no blurriness on export
                  because drawImage reads the backing canvas, not CSS dimensions
                - Fixed container with no overflow prevents layout shifts        */}
            <div style={{
              position:"relative",
              width:QR_PREVIEW_PX,height:QR_PREVIEW_PX,
              borderRadius:12,overflow:"hidden",
              background:"#ffffff",border:`1px solid ${col}18`,
              flexShrink:0,
            }}>
              <canvas
                ref={qrRef}
                width={QR_SIZE}
                height={QR_SIZE}
                style={{
                  position:"absolute",top:0,left:0,
                  width:QR_PREVIEW_PX,height:QR_PREVIEW_PX,
                  display:"block",
                  imageRendering:"crisp-edges",
                }}
              />
              {!ready && (
                <div style={{
                  position:"absolute",inset:0,
                  background:"rgba(255,255,255,.98)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <window.HE_Spinner/>
                </div>
              )}
              {/* Corner brackets */}
              {ready && [
                {top:6,   left:6,  borderTop:`2.5px solid ${col}`,borderLeft:`2.5px solid ${col}`,  borderRadius:"3px 0 0 0"},
                {top:6,   right:6, borderTop:`2.5px solid ${col}`,borderRight:`2.5px solid ${col}`, borderRadius:"0 3px 0 0"},
                {bottom:6,left:6,  borderBottom:`2.5px solid ${col}`,borderLeft:`2.5px solid ${col}`, borderRadius:"0 0 0 3px"},
                {bottom:6,right:6, borderBottom:`2.5px solid ${col}`,borderRight:`2.5px solid ${col}`,borderRadius:"0 0 3px 0"},
              ].map((s,i) => <div key={i} style={{position:"absolute",width:20,height:20,...s}}/>)}
              {/* H logo */}
              {ready && (
                <div style={{
                  position:"absolute",top:"50%",left:"50%",
                  transform:"translate(-50%,-50%)",
                  width:40,height:40,borderRadius:9,background:"#fff",
                  border:`2.5px solid ${col}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:"0 0 0 3px #fff",
                }}>
                  <span style={{fontSize:22,fontWeight:900,color:col,fontFamily:"'Inter',sans-serif",lineHeight:1}}>H</span>
                </div>
              )}
            </div>

            {/* Scan prompt */}
            <div style={{fontSize:11,fontWeight:700,color:col,letterSpacing:"0.06em",textTransform:"uppercase",marginTop:10}}>
              {isBiz ? "📱 Scan to Review Us" : "📱 Scan to View Profile"}
            </div>

            {/* URL */}
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#9090b0",marginTop:4,textAlign:"center"}}>
              {displayUrl}
            </div>

            {/* Brand */}
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:10,padding:"6px 14px",background:"#f8f8fc",borderRadius:8}}>
              <span style={{fontWeight:900,fontSize:13,color:"#0d0c1a",fontFamily:"'Inter',sans-serif"}}>High</span>
              <span style={{fontWeight:300,fontSize:13,color:col,fontFamily:"'Inter',sans-serif"}}>Enough</span>
            </div>
          </div>

          {/* Bottom accent */}
          <div style={{height:4,background:`linear-gradient(90deg,${col}60,${col})`,borderRadius:"0 0 24px 24px"}}/>
        </div>

        {/* Tier badge */}
        <div style={{marginTop:12}}>
          <window.HE_TierBadge sc={sc} size="sm" isBiz={isBiz}/>
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",gap:10,marginTop:14,width:300}}>
          <button
            onClick={shareQR}
            style={{
              flex:1,padding:"13px 0",background:col,borderRadius:14,color:"#fff",
              fontWeight:700,fontSize:14,display:"flex",alignItems:"center",
              justifyContent:"center",gap:7,boxShadow:`0 4px 20px ${col}55`,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>

          <button
            onClick={copyUrl}
            style={{
              flex:1,padding:"13px 0",
              background:copied ? `${col}22` : "rgba(255,255,255,.08)",
              border:`1px solid ${copied ? col : "rgba(255,255,255,.16)"}`,
              borderRadius:14,color:copied ? col : "rgba(255,255,255,.8)",
              fontWeight:600,fontSize:13,transition:"all .2s",
            }}
          >
            {copied ? "✓ Copied" : "Copy Link"}
          </button>

          <button
            onClick={saveQR}
            title="Save QR"
            style={{
              width:48,padding:"13px 0",
              background:"rgba(255,255,255,.08)",
              border:"1px solid rgba(255,255,255,.16)",
              borderRadius:14,color:"rgba(255,255,255,.7)",
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>


      </div>
    );
  }

  // Expose via namespace
  window.HE_COMPONENTS = window.HE_COMPONENTS || {};
  window.HE_COMPONENTS.QRModal = QRModal;

})();
