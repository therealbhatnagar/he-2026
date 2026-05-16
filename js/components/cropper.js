// ── PHOTO CROPPER ────────────────────────────────────────────────────────────
// Stable image pipeline: decode-first architecture.
//
// KEY DESIGN: src is never passed to CropScreen until the image is fully
// decoded. PhotoModal calls decodeImage() which resolves only after
// img.decode() completes, returning {src, natW, natH}. CropScreen receives
// these as props — natSize is never derived from DOM reads mid-render.
// This eliminates the entire class of first-attempt / warm-cache failures.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const {useState, useEffect, useRef} = React;

  const VIEWPORT    = 260;
  const OUT_SIZE    = 400;
  const MIN_SCALE   = 1.0;
  const MAX_SCALE   = 4.0;
  const SESSION_KEY = "he_crop_src";

  // ── IMAGE DECODE ─────────────────────────────────────────────────────────────
  // Returns Promise<{src, natW, natH}>.
  // Uses img.decode() — the proper API for "image is ready to draw".
  // Falls back to onload for browsers that don't support decode().
  function decodeImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error("zero-size image")); return; }
        if (typeof img.decode === "function") {
          img.decode()
            .then(() => resolve({src, natW: w, natH: h}))
            .catch(() => resolve({src, natW: w, natH: h})); // decode() failed but onload OK
        } else {
          resolve({src, natW: w, natH: h});
        }
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  }

  // ── GEOMETRY ─────────────────────────────────────────────────────────────────
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

  function computeSrcRect(natW, natH, scale, offset) {
    const total = fitScale(natW, natH) * scale;
    const imgW  = natW * total, imgH = natH * total;
    const imgL  = VIEWPORT / 2 - imgW / 2 + offset.x;
    const imgT  = VIEWPORT / 2 - imgH / 2 + offset.y;
    return {srcX: -imgL/total, srcY: -imgT/total, srcW: VIEWPORT/total, srcH: VIEWPORT/total};
  }

  function applyCropToCanvas(natW, natH, imgEl, scale, offset) {
    const {srcX, srcY, srcW, srcH} = computeSrcRect(natW, natH, scale, offset);
    const out = document.createElement("canvas");
    out.width = OUT_SIZE; out.height = OUT_SIZE;
    const ctx = out.getContext("2d");
    ctx.beginPath();
    ctx.arc(OUT_SIZE/2, OUT_SIZE/2, OUT_SIZE/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, OUT_SIZE, OUT_SIZE);
    return out.toDataURL("image/jpeg", 0.92);
  }

  // ── CROP SCREEN ──────────────────────────────────────────────────────────────
  // natW / natH are PROPS — guaranteed known before this component mounts.
  // No onLoad, no DOM reads for dimensions, no race conditions.
  function CropScreen({ src, natW, natH, color, T, onConfirm, onCancel }) {
    const imgRef   = useRef(null);
    const [scale,  setScale]  = useState(1);
    const [offset, setOffset] = useState({x:0, y:0});
    const dragRef  = useRef(null);
    const pinchRef = useRef(null);

    // ── Pointer drag (mouse / stylus) ─────────────────────────────────────
    function onPointerDown(e) {
      if (e.pointerType === "touch") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {sx:e.clientX, sy:e.clientY, ox:offset.x, oy:offset.y};
    }
    function onPointerMove(e) {
      if (!dragRef.current) return;
      setOffset(clampOffset(
        {x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
         y: dragRef.current.oy + (e.clientY - dragRef.current.sy)},
        natW, natH, scale
      ));
    }
    function onPointerUp() { dragRef.current = null; }

    // ── Pinch + drag (touch) ──────────────────────────────────────────────
    function pinchDist(t) {
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    }
    function onTouchStart(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = {dist: pinchDist(e.touches), scale};
        dragRef.current  = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        dragRef.current = {sx:t.clientX, sy:t.clientY, ox:offset.x, oy:offset.y};
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
          pinchRef.current.scale * (pinchDist(e.touches) / pinchRef.current.dist)
        ));
        setScale(ns);
        setOffset(prev => clampOffset(prev, natW, natH, ns));
      } else if (e.touches.length === 1 && dragRef.current) {
        const t = e.touches[0];
        setOffset(clampOffset(
          {x: dragRef.current.ox + (t.clientX - dragRef.current.sx),
           y: dragRef.current.oy + (t.clientY - dragRef.current.sy)},
          natW, natH, scale
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
      setOffset(prev => clampOffset(prev, natW, natH, s));
    }

    function confirm() {
      if (!imgRef.current) return;
      onConfirm(applyCropToCanvas(natW, natH, imgRef.current, scale, offset));
    }

    // Explicit pixel positions — natW/natH always valid (passed as props)
    const total = fitScale(natW, natH) * scale;
    const iW = natW * total, iH = natH * total;
    const imgStyle = {
      position:"absolute",
      width: iW + "px", height: iH + "px",
      left: (VIEWPORT/2 - iW/2 + offset.x) + "px",
      top:  (VIEWPORT/2 - iH/2 + offset.y) + "px",
      pointerEvents:"none", userSelect:"none",
    };

    return (
      <div>
        <div style={{fontWeight:700,fontSize:17,color:T.txt,marginBottom:3}}>Adjust Photo</div>
        <div style={{fontSize:12,color:T.mu,marginBottom:14}}>Drag · Pinch or use slider to zoom</div>

        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <div
            style={{width:VIEWPORT,height:VIEWPORT,borderRadius:"50%",border:`3px solid ${color}`,overflow:"hidden",cursor:"grab",userSelect:"none",touchAction:"none",flexShrink:0,position:"relative",background:"#111"}}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          >
            <img ref={imgRef} src={src} alt="" draggable={false} style={imgStyle}/>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,padding:"0 4px"}}>
          <span style={{fontSize:14,color:T.mu}}>–</span>
          <input type="range" min={MIN_SCALE} max={MAX_SCALE} step="0.01" value={scale} onChange={onSlider} style={{flex:1,accentColor:color,height:4}}/>
          <span style={{fontSize:14,color:T.mu}}>+</span>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={confirm} style={{flex:1,padding:"13px 0",background:`linear-gradient(135deg,${color}e0,${color}90)`,borderRadius:12,color:"#fff",fontWeight:700,fontSize:14}}>
            ✓ Use Photo
          </button>
          <button onClick={onCancel} style={{flex:1,padding:"13px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.mu,fontWeight:500}}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── PHOTO MODAL ──────────────────────────────────────────────────────────────
  function PhotoModal({ profile, T, onClose, onSave }) {
    const [prev,      setPrev]     = useState(profile.photo || null);
    const [cam,       setCam]      = useState(false);
    const [stream,    setStream]   = useState(null);
    const [facing,    setFacing]   = useState("user");   // "user" | "environment"
    const [decoding,  setDecoding] = useState(false);   // true while decodeImage runs
    // decoded: {src, natW, natH} — set only after full decode, or null
    const [decoded,   setDecoded]  = useState(() => {
      // Restore crop session after tab-switch reload
      try {
        const s = sessionStorage.getItem(SESSION_KEY);
        if (s) {
          const d = JSON.parse(s);
          if (d && d.src && d.natW && d.natH) return d;
        }
      } catch {}
      return null;
    });
    const vRef = useRef(null);
    const cRef = useRef(null);

    // Persist decoded session for reload recovery
    useEffect(() => {
      try {
        if (decoded) sessionStorage.setItem(SESSION_KEY, JSON.stringify(decoded));
        else         sessionStorage.removeItem(SESSION_KEY);
      } catch {}
    }, [decoded]);

    useEffect(() => () => stream?.getTracks().forEach(t => t.stop()), []);

    // ── Decode helper — used by both gallery and camera paths ─────────────
    async function loadAndDecode(src) {
      setDecoding(true);
      try {
        const result = await decodeImage(src);
        setDecoded(result);
      } catch (err) {
        console.error("Image decode failed:", err);
        alert("Could not load image. Please try another photo.");
      } finally {
        setDecoding(false);
      }
    }

    // ── Gallery pick ──────────────────────────────────────────────────────
    function pick() {
      const i = document.createElement("input");
      i.type = "file"; i.accept = "image/*";
      i.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => loadAndDecode(ev.target.result);
        r.readAsDataURL(f);
      };
      i.click();
    }

    // ── Camera ────────────────────────────────────────────────────────────
    async function startCam(face) {
      const f = face || facing;
      // Stop existing stream before requesting new one
      stream?.getTracks().forEach(t => t.stop());
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: f, width: {ideal:1280}, height: {ideal:720} }
        });
        setStream(s); setCam(true); setFacing(f);
        // Attach stream to video element after React renders it
        requestAnimationFrame(() => {
          if (vRef.current) vRef.current.srcObject = s;
        });
      } catch {
        alert("Camera unavailable");
      }
    }

    function stopCam() {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null); setCam(false);
    }

    function flipCam() {
      startCam(facing === "user" ? "environment" : "user");
    }

    async function snap() {
      const v = vRef.current, c = cRef.current; if (!v || !c) return;
      if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        alert("Camera not ready yet. Please try again.");
        return;
      }
      // Capture frame BEFORE stopping stream or touching state.
      // stopCam() calls setState which triggers a React re-render mid-async —
      // on Android this can unmount the component, dropping the decode promise.
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      const src = c.toDataURL("image/jpeg", .92);

      // Stop tracks directly — don't call stopCam() (avoids setState mid-decode)
      stream?.getTracks().forEach(t => t.stop());

      // Decode first, then clear cam state atomically in one update
      setDecoding(true);
      try {
        const result = await decodeImage(src);
        // Single setState batch: clears camera UI and shows cropper together
        setStream(null);
        setCam(false);
        setDecoded(result);
      } catch {
        setStream(null);
        setCam(false);
        alert("Could not process image. Please try again.");
      } finally {
        setDecoding(false);
      }
    }

    function handleCropConfirm(dataUrl) {
      setPrev(dataUrl);
      setDecoded(null); // clears sessionStorage via effect
    }

    function handleCropCancel() {
      setDecoded(null);
    }

    // ── Crop screen — only shown when decoded is fully ready ──────────────
    if (decoded) {
      return (
        <Overlay onBg={handleCropCancel} T={T} bottom>
          <CropScreen
            src={decoded.src}
            natW={decoded.natW}
            natH={decoded.natH}
            color={profile.color}
            T={T}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        </Overlay>
      );
    }

    // ── Photo selection screen ────────────────────────────────────────────
    return (
      <Overlay onBg={() => { stopCam(); onClose(); }} T={T} bottom>
        <div style={{fontWeight:700,fontSize:17,color:T.txt,marginBottom:16}}>Profile Photo</div>

        {/* Preview */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:16,position:"relative"}}>
          <div style={{width:100,height:100,borderRadius:"50%",overflow:"hidden",border:`2.5px solid ${profile.color}`,background:T.faint,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {cam
              ? <video ref={vRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : prev
                ? <img src={prev} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{fontFamily:"monospace",fontSize:32,fontWeight:700,color:profile.color}}>{window.HE_UTILS.ini(profile.name)}</span>
            }
          </div>
          {/* Flip camera button — only shown in camera mode */}
          {cam && (
            <button onClick={flipCam} title="Flip camera" style={{position:"absolute",right:"calc(50% - 68px)",top:0,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.55)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
              🔄
            </button>
          )}
          <canvas ref={cRef} style={{display:"none"}}/>
        </div>

        {/* Decoding spinner */}
        {decoding && (
          <div style={{textAlign:"center",padding:"12px 0",color:T.mu,fontSize:13}}>
            Loading image…
          </div>
        )}

        {cam
          ? <div style={{display:"flex",gap:8}}>
              <button onClick={snap} style={{flex:1,padding:"12px 0",background:`${profile.color}cc`,borderRadius:12,color:"#fff",fontWeight:700}}>📸 Capture</button>
              <button onClick={stopCam} style={{flex:1,padding:"12px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.mu}}>Cancel</button>
            </div>
          : !decoding && <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={pick} style={{padding:"13px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.txt,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <window.HE_CamIcon/> Choose from Gallery
              </button>
              <button onClick={() => startCam()} style={{padding:"13px 0",background:T.faint,border:`1px solid ${T.b1}`,borderRadius:12,color:T.txt,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <window.HE_CamIcon/> Take Photo
              </button>
              {prev && <button onClick={() => setPrev(null)} style={{padding:"12px 0",background:"transparent",border:"1px solid #c0404040",borderRadius:12,color:"#c06060",fontWeight:500}}>Remove Photo</button>}
              <div style={{height:1,background:T.b1}}/>
              <button onClick={() => onSave(prev)} style={{padding:"13px 0",background:`linear-gradient(135deg,${profile.color}e0,${profile.color}90)`,borderRadius:12,color:"#fff",fontWeight:700,fontSize:14}}>Save Photo</button>
            </div>
        }
      </Overlay>
    );
  }

  window.HE_COMPONENTS = window.HE_COMPONENTS || {};
  window.HE_COMPONENTS.PhotoModal = PhotoModal;

})();
