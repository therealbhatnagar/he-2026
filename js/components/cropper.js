// ── PHOTO CROPPER ────────────────────────────────────────────────────────────
// Self-contained: file pick, camera snap, drag+pinch crop, canvas export.
//
// FIXES IN THIS VERSION:
//   1. First-load / square-image stuck on loading:
//      natW/natH were read from imgRef.current.naturalWidth inside getImgStyle()
//      on every render — but during the first render after src is set,
//      naturalWidth is 0 (image not decoded yet), producing Infinity px sizes.
//      Fix: store dimensions in state when onLoad fires; render nothing until known.
//
//   2. Crop session survives tab/app switch:
//      Android kills the PWA WebView when the user opens the native gallery,
//      then restores from scratch on return. cropSrc is now persisted to
//      sessionStorage so the crop session is restored on reload.
//
// Exports (via window.HE_COMPONENTS):
//   PhotoModal({ profile, T, onClose, onSave })
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const {useState, useEffect, useRef} = React;

  const VIEWPORT  = 260;   // CSS px — circular crop viewport diameter
  const OUT_SIZE  = 400;   // output canvas px — square
  const MIN_SCALE = 1.0;   // never smaller than viewport (no gaps)
  const MAX_SCALE = 4.0;
  const SESSION_KEY = "he_crop_src"; // sessionStorage key for crash/reload recovery

  // ── GEOMETRY ────────────────────────────────────────────────────────────────
  // All geometry functions take natW/natH as explicit params — never read
  // from the DOM mid-render, which was the source of the 0-dimension race.

  function fitScale(natW, natH) {
    return Math.max(VIEWPORT / natW, VIEWPORT / natH);
  }

  function clampOffset(offset, natW, natH, scale) {
    const total = fitScale(natW, natH) * scale;
    const maxX  = Math.max(0, (natW * total - VIEWPORT) / 2);
    const maxY  = Math.max(0, (natH * total - VIEWPORT) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }

  // Compute exact source rect for canvas export — same math as the display.
  function computeSrcRect(natW, natH, scale, offset) {
    const total  = fitScale(natW, natH) * scale;
    const imgW   = natW * total;
    const imgH   = natH * total;
    const imgL   = VIEWPORT / 2 - imgW / 2 + offset.x;
    const imgT   = VIEWPORT / 2 - imgH / 2 + offset.y;
    return {
      srcX: -imgL / total,
      srcY: -imgT / total,
      srcW:  VIEWPORT / total,
      srcH:  VIEWPORT / total,
    };
  }

  function applyCropToCanvas(natW, natH, imgEl, scale, offset) {
    const {srcX, srcY, srcW, srcH} = computeSrcRect(natW, natH, scale, offset);
    const out = document.createElement("canvas");
    out.width  = OUT_SIZE;
    out.height = OUT_SIZE;
    const ctx  = out.getContext("2d");
    ctx.beginPath();
    ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, OUT_SIZE, OUT_SIZE);
    return out.toDataURL("image/jpeg", 0.92);
  }

  // ── CROP SCREEN ─────────────────────────────────────────────────────────────
  function CropScreen({ src, color, T, onConfirm, onCancel }) {
    const imgRef   = useRef(null);
    // natSize: null until onLoad fires — guards all geometry calculations
    const [natSize,  setNatSize]  = useState(null);
    const [scale,    setScale]    = useState(1);
    const [offset,   setOffset]   = useState({x: 0, y: 0});
    const dragRef  = useRef(null);
    const pinchRef = useRef(null);

    // Reset when src changes (new image picked)
    useEffect(() => {
      setNatSize(null);
      setScale(1);
      setOffset({x: 0, y: 0});
    }, [src]);

    function onImgLoad() {
      const img = imgRef.current;
      if (!img) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      // Guard against broken images reporting 0×0
      if (!w || !h) return;
      setNatSize({w, h});
    }

    // ── Drag (pointer events — mouse + stylus) ────────────────────────────
    function onPointerDown(e) {
      if (e.pointerType === "touch") return; // touch handled by onTouchStart
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y};
    }
    function onPointerMove(e) {
      if (!dragRef.current || !natSize) return;
      const raw = {
        x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
      };
      setOffset(clampOffset(raw, natSize.w, natSize.h, scale));
    }
    function onPointerUp() { dragRef.current = null; }

    // ── Pinch-to-zoom + drag (touch events) ──────────────────────────────
    function pinchDist(t) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = {dist: pinchDist(e.touches), scale};
        dragRef.current  = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        dragRef.current = {sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y};
      }
    }

    function onTouchMove(e) {
      if (!natSize) return;
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
          pinchRef.current.scale * (pinchDist(e.touches) / pinchRef.current.dist)
        ));
        setScale(newScale);
        setOffset(prev => clampOffset(prev, natSize.w, natSize.h, newScale));
      } else if (e.touches.length === 1 && dragRef.current) {
        const t = e.touches[0];
        setOffset(clampOffset(
          {x: dragRef.current.ox + (t.clientX - dragRef.current.sx),
           y: dragRef.current.oy + (t.clientY - dragRef.current.sy)},
          natSize.w, natSize.h, scale
        ));
      }
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) dragRef.current = null;
    }

    function onSlider(e) {
      const s = parseFloat(e.target.value);
      setScale(s);
      if (natSize) setOffset(prev => clampOffset(prev, natSize.w, natSize.h, s));
    }

    function confirm() {
      const img = imgRef.current;
      if (!img || !natSize) return;
      onConfirm(applyCropToCanvas(natSize.w, natSize.h, img, scale, offset));
    }

    // ── Image display style ────────────────────────────────────────────────
    // Only computed when natSize is known — no 0-dimension race possible.
    function imgStyle() {
      if (!natSize) return {display: "none"};
      const total = fitScale(natSize.w, natSize.h) * scale;
      const iW = natSize.w * total;
      const iH = natSize.h * total;
      return {
        position:      "absolute",
        width:          iW + "px",
        height:         iH + "px",
        left:           (VIEWPORT / 2 - iW / 2 + offset.x) + "px",
        top:            (VIEWPORT / 2 - iH / 2 + offset.y) + "px",
        pointerEvents:  "none",
        userSelect:     "none",
      };
    }

    return (
      <div>
        <div style={{fontWeight:700, fontSize:17, color:T.txt, marginBottom:3}}>
          Adjust Photo
        </div>
        <div style={{fontSize:12, color:T.mu, marginBottom:14}}>
          Drag to reposition · Pinch or slider to zoom
        </div>

        <div style={{display:"flex", justifyContent:"center", marginBottom:16}}>
          <div
            style={{
              width:VIEWPORT, height:VIEWPORT, borderRadius:"50%",
              border:`3px solid ${color}`, overflow:"hidden",
              cursor:"grab", userSelect:"none", touchAction:"none",
              flexShrink:0, position:"relative",
              background:"#111",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Image: hidden via style until natSize known, not via conditional
                so imgRef is always attached and onLoad always fires */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              style={imgStyle()}
            />
            {/* Loading overlay — shown until natSize is populated */}
            {!natSize && (
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#888", fontSize:12,
              }}>
                Loading…
              </div>
            )}
          </div>
        </div>

        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:18, padding:"0 4px"}}>
          <span style={{fontSize:14, color:T.mu}}>–</span>
          <input
            type="range" min={MIN_SCALE} max={MAX_SCALE} step="0.01"
            value={scale}
            onChange={onSlider}
            style={{flex:1, accentColor:color, height:4}}
          />
          <span style={{fontSize:14, color:T.mu}}>+</span>
        </div>

        <div style={{display:"flex", gap:10}}>
          <button
            onClick={confirm}
            disabled={!natSize}
            style={{
              flex:1, padding:"13px 0",
              background: natSize
                ? `linear-gradient(135deg,${color}e0,${color}90)`
                : "#555",
              borderRadius:12, color:"#fff", fontWeight:700, fontSize:14,
              opacity: natSize ? 1 : 0.5,
            }}
          >✓ Use Photo</button>
          <button
            onClick={onCancel}
            style={{
              flex:1, padding:"13px 0",
              background:T.faint, border:`1px solid ${T.b1}`,
              borderRadius:12, color:T.mu, fontWeight:500,
            }}
          >Cancel</button>
        </div>
      </div>
    );
  }

  // ── PHOTO MODAL ─────────────────────────────────────────────────────────────
  function PhotoModal({ profile, T, onClose, onSave }) {
    const [prev,     setPrev]     = useState(profile.photo || null);
    const [cam,      setCam]      = useState(false);
    const [stream,   setStream]   = useState(null);
    const [cropping, setCropping] = useState(false);
    const [cropSrc,  setCropSrc]  = useState(() => {
      // Restore crop session after tab-switch reload (Android PWA behavior)
      try { return sessionStorage.getItem(SESSION_KEY) || null; }
      catch { return null; }
    });
    const vRef = useRef(null);
    const cRef = useRef(null);

    // If we restored a cropSrc from sessionStorage, go straight to crop screen
    useEffect(() => {
      if (cropSrc) setCropping(true);
    }, []); // run once on mount only

    // Persist cropSrc to sessionStorage so tab-switch reloads can recover it
    useEffect(() => {
      try {
        if (cropSrc) sessionStorage.setItem(SESSION_KEY, cropSrc);
        else         sessionStorage.removeItem(SESSION_KEY);
      } catch {}
    }, [cropSrc]);

    // Stop camera stream on unmount
    useEffect(() => () => stream?.getTracks().forEach(t => t.stop()), []);

    function pick() {
      const i = document.createElement("input");
      i.type = "file"; i.accept = "image/*";
      i.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
          setCropSrc(ev.target.result);
          setCropping(true);
        };
        r.readAsDataURL(f);
      };
      i.click();
    }

    async function startCam() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});
        setStream(s); setCam(true);
        setTimeout(() => { if (vRef.current) vRef.current.srcObject = s; }, 100);
      } catch { alert("Camera unavailable"); }
    }

    function stopCam() {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null); setCam(false);
    }

    function snap() {
      const v = vRef.current, c = cRef.current; if (!v || !c) return;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      stopCam();
      setCropSrc(c.toDataURL("image/jpeg", .85));
      setCropping(true);
    }

    function handleCropConfirm(dataUrl) {
      setPrev(dataUrl);
      setCropping(false);
      setCropSrc(null); // also clears sessionStorage via effect
    }

    function handleCropCancel() {
      setCropping(false);
      setCropSrc(null);
    }

    if (cropping && cropSrc) {
      return (
        <Overlay onBg={handleCropCancel} T={T} bottom>
          <CropScreen
            src={cropSrc}
            color={profile.color}
            T={T}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        </Overlay>
      );
    }

    return (
      <Overlay onBg={() => { stopCam(); onClose(); }} T={T} bottom>
        <div style={{fontWeight:700, fontSize:17, color:T.txt, marginBottom:16}}>
          Profile Photo
        </div>

        <div style={{display:"flex", justifyContent:"center", marginBottom:16}}>
          <div style={{
            width:100, height:100, borderRadius:"50%",
            overflow:"hidden", border:`2.5px solid ${profile.color}`,
            background:T.faint, display:"flex", alignItems:"center",
            justifyContent:"center", flexShrink:0,
          }}>
            {cam
              ? <video ref={vRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : prev
                ? <img src={prev} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{fontFamily:"monospace",fontSize:32,fontWeight:700,color:profile.color}}>
                    {window.HE_UTILS.ini(profile.name)}
                  </span>
            }
          </div>
          <canvas ref={cRef} style={{display:"none"}}/>
        </div>

        {cam
          ? <div style={{display:"flex", gap:8}}>
              <button onClick={snap} style={{flex:1,padding:"12px 0",background:`${profile.color}cc`,borderRadius:12,color:"#fff",fontWeight:700}}>
                📸 Capture
              </button>
              <button onClick={stopCam} style={{flex:1,padding:"12px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.mu}}>
                Cancel
              </button>
            </div>
          : <div style={{display:"flex", flexDirection:"column", gap:8}}>
              <button onClick={pick} style={{padding:"13px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.txt,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <window.HE_CamIcon/> Choose from Gallery
              </button>
              <button onClick={startCam} style={{padding:"13px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.txt,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <window.HE_CamIcon/> Take Photo
              </button>
              {prev && (
                <button onClick={() => {setCropSrc(prev); setCropping(true);}} style={{padding:"12px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.txt,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ✂️ Adjust / Crop
                </button>
              )}
              {prev && (
                <button onClick={() => setPrev(null)} style={{padding:"12px 0",background:"transparent",border:"1px solid #c0404040",borderRadius:12,color:"#c06060",fontWeight:500}}>
                  Remove Photo
                </button>
              )}
              <div style={{height:1, background:T.b1}}/>
              <button onClick={() => onSave(prev)} style={{padding:"13px 0",background:`linear-gradient(135deg,${profile.color}e0,${profile.color}90)`,borderRadius:12,color:"#fff",fontWeight:700,fontSize:14}}>
                Save Photo
              </button>
            </div>
        }
      </Overlay>
    );
  }

  window.HE_COMPONENTS = window.HE_COMPONENTS || {};
  window.HE_COMPONENTS.PhotoModal = PhotoModal;

})();
