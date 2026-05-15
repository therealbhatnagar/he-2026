// ── PHOTO CROPPER ────────────────────────────────────────────────────────────
// Self-contained: file pick, camera snap, drag+pinch crop, canvas export.
//
// WHY THIS FILE EXISTS — previous crop bugs:
//   1. The <img> used `objectFit:cover` which lets the browser clip the image
//      internally. applyCrop then tried to reverse-engineer the visible rect
//      from naturalWidth + CSS percentage scale, but the browser's cover-clip
//      made that math wrong. Result: exported pixels ≠ visible crop area.
//   2. No pinch-to-zoom — only a slider. Felt nothing like WhatsApp/Instagram.
//   3. No fill guarantee — background showed through on small images.
//
// FIX: remove objectFit entirely. Render image at explicit pixel dimensions
// computed from naturalWidth/naturalHeight, the viewport size, and scale.
// The displayed geometry IS the canvas geometry times one ratio. applyCrop
// becomes trivial and pixel-perfect.
//
// Exports (via window.HE_COMPONENTS):
//   PhotoModal({ profile, T, onClose, onSave })
//
// Depends on globals from app.js (available at call time):
//   ini (HE_UTILS), Overlay, CamIcon
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const {useState, useEffect, useRef, useCallback} = React;

  // ── CONSTANTS ───────────────────────────────────────────────────────────────
  const VIEWPORT   = 260;   // CSS px — the circular crop viewport diameter
  const OUT_SIZE   = 400;   // output canvas px — square, matches handleSavePhoto max
  const MIN_SCALE  = 1.0;   // never allow image smaller than viewport (no grey gaps)
  const MAX_SCALE  = 4.0;

  // ── CROP ENGINE ─────────────────────────────────────────────────────────────
  // Given image natural dimensions, viewport size, and current scale+offset,
  // compute the exact source rectangle to draw onto the output canvas.
  // No objectFit, no browser-side clipping — pure math.
  //
  // Model:
  //   - Image is displayed at (imgW × imgH) px, centered in the viewport.
  //   - offset.x/y are user drags in CSS px, applied after centering.
  //   - The visible viewport circle maps 1:1 to OUT_SIZE×OUT_SIZE canvas.
  //
  function computeCrop(natW, natH, scale, offset, viewport, outSize) {
    // Fit image to viewport at scale=1 (cover: fill the smaller axis)
    const fitScale = Math.max(viewport / natW, viewport / natH);
    const totalScale = fitScale * scale;

    // Image size on screen
    const imgW = natW * totalScale;
    const imgH = natH * totalScale;

    // Center of viewport in screen px
    const vpCx = viewport / 2;
    const vpCy = viewport / 2;

    // Top-left corner of image on screen (with drag offset)
    const imgLeft = vpCx - imgW / 2 + offset.x;
    const imgTop  = vpCy - imgH / 2 + offset.y;

    // The viewport circle's top-left in screen space
    const vpLeft = 0;
    const vpTop  = 0;

    // Source coordinates in image-pixels (not screen-pixels)
    const srcX = (vpLeft - imgLeft) / totalScale;
    const srcY = (vpTop  - imgTop)  / totalScale;
    const srcW = viewport / totalScale;
    const srcH = viewport / totalScale;

    return { srcX, srcY, srcW, srcH };
  }

  // ── CROP CANVAS RENDERER ────────────────────────────────────────────────────
  function applyCropToCanvas(imgEl, scale, offset) {
    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;

    const { srcX, srcY, srcW, srcH } = computeCrop(
      natW, natH, scale, offset, VIEWPORT, OUT_SIZE
    );

    const out = document.createElement("canvas");
    out.width  = OUT_SIZE;
    out.height = OUT_SIZE;
    const ctx  = out.getContext("2d");

    // Circular clip — matches the preview viewport shape exactly
    ctx.beginPath();
    ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw only the visible source region, scaled to fill output canvas
    ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, OUT_SIZE, OUT_SIZE);

    return out.toDataURL("image/jpeg", 0.92);
  }

  // ── CLAMP OFFSET ────────────────────────────────────────────────────────────
  // Prevent dragging the image off-screen so the circle always stays filled.
  function clampOffset(offset, natW, natH, scale, viewport) {
    const fitScale   = Math.max(viewport / natW, viewport / natH);
    const totalScale = fitScale * scale;
    const imgW       = natW * totalScale;
    const imgH       = natH * totalScale;

    // Maximum drag distance before image edge enters the viewport
    const maxX = Math.max(0, (imgW - viewport) / 2);
    const maxY = Math.max(0, (imgH - viewport) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }

  // ── CROP SCREEN ─────────────────────────────────────────────────────────────
  function CropScreen({ src, color, T, onConfirm, onCancel }) {
    const imgRef    = useRef(null);
    const [scale,   setScale]   = useState(1);
    const [offset,  setOffset]  = useState({x: 0, y: 0});
    const [loaded,  setLoaded]  = useState(false);
    const dragRef   = useRef(null);
    const pinchRef  = useRef(null);  // {dist, scale} at pinch start

    // Reset state when a new image is passed in
    useEffect(() => {
      setScale(1);
      setOffset({x: 0, y: 0});
      setLoaded(false);
    }, [src]);

    function getNatSize() {
      const img = imgRef.current;
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    }

    // ── Drag ──────────────────────────────────────────────────────────────
    function onPointerDown(e) {
      // Ignore second pointer — pinch is handled by onTouchStart
      if (e.pointerType === "touch") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    }
    function onPointerMove(e) {
      if (!dragRef.current) return;
      const ns = getNatSize(); if (!ns) return;
      const raw = {
        x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
      };
      setOffset(clampOffset(raw, ns.w, ns.h, scale, VIEWPORT));
    }
    function onPointerUp() { dragRef.current = null; }

    // ── Pinch-to-zoom (touch only) ─────────────────────────────────────────
    function pinchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        // Two fingers — start pinch
        e.preventDefault();
        pinchRef.current = { dist: pinchDist(e.touches), scale };
        dragRef.current  = null; // cancel any ongoing drag
      } else if (e.touches.length === 1) {
        // One finger — start drag
        const t = e.touches[0];
        dragRef.current = { sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y };
      }
    }

    function onTouchMove(e) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const newDist  = pinchDist(e.touches);
        const ratio    = newDist / pinchRef.current.dist;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.scale * ratio));
        const ns = getNatSize(); if (!ns) return;
        setScale(newScale);
        setOffset(prev => clampOffset(prev, ns.w, ns.h, newScale, VIEWPORT));
      } else if (e.touches.length === 1 && dragRef.current) {
        const t  = e.touches[0];
        const ns = getNatSize(); if (!ns) return;
        const raw = {
          x: dragRef.current.ox + (t.clientX - dragRef.current.sx),
          y: dragRef.current.oy + (t.clientY - dragRef.current.sy),
        };
        setOffset(clampOffset(raw, ns.w, ns.h, scale, VIEWPORT));
      }
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) dragRef.current = null;
    }

    function handleSlider(e) {
      const newScale = parseFloat(e.target.value);
      const ns = getNatSize();
      if (!ns) { setScale(newScale); return; }
      setScale(newScale);
      setOffset(prev => clampOffset(prev, ns.w, ns.h, newScale, VIEWPORT));
    }

    function confirm() {
      const img = imgRef.current;
      if (!img || !loaded) return;
      onConfirm(applyCropToCanvas(img, scale, offset));
    }

    // ── Image display style ────────────────────────────────────────────────
    // NO objectFit. Explicit pixel size = fitScale × userScale × natural size.
    // This makes the displayed geometry 100% predictable for applyCropToCanvas.
    function getImgStyle() {
      if (!imgRef.current || !loaded) return { display: "none" };
      const { w, h } = { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight };
      const fitScale   = Math.max(VIEWPORT / w, VIEWPORT / h);
      const totalScale = fitScale * scale;
      const imgW = w * totalScale;
      const imgH = h * totalScale;
      return {
        position:    "absolute",
        width:        imgW + "px",
        height:       imgH + "px",
        left:         (VIEWPORT / 2 - imgW / 2 + offset.x) + "px",
        top:          (VIEWPORT / 2 - imgH / 2 + offset.y) + "px",
        pointerEvents: "none",
        userSelect:   "none",
        draggable:    false,
      };
    }

    return (
      <div>
        <div style={{fontWeight: 700, fontSize: 17, color: T.txt, marginBottom: 3}}>
          Adjust Photo
        </div>
        <div style={{fontSize: 12, color: T.mu, marginBottom: 14}}>
          Drag · Pinch to zoom · Use slider for fine control
        </div>

        {/* ── Crop viewport ── */}
        {/* Outer ring: shows the circle with a colored border */}
        {/* Inner div: the clipping area, exactly VIEWPORT×VIEWPORT px */}
        <div style={{display: "flex", justifyContent: "center", marginBottom: 16}}>
          <div style={{
            width:        VIEWPORT,
            height:       VIEWPORT,
            borderRadius: "50%",
            border:       `3px solid ${color}`,
            overflow:     "hidden",
            cursor:       "grab",
            userSelect:   "none",
            touchAction:  "none",
            flexShrink:   0,
            position:     "relative",
            background:   "#111",  // dark fill — visible only if image fails to cover
          }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={() => setLoaded(true)}
              style={getImgStyle()}
            />
            {!loaded && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#666", fontSize: 12,
              }}>Loading…</div>
            )}
          </div>
        </div>

        {/* ── Zoom slider ── */}
        <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "0 4px"}}>
          <span style={{fontSize: 14}}>–</span>
          <input
            type="range" min={MIN_SCALE} max={MAX_SCALE} step="0.01"
            value={scale}
            onChange={handleSlider}
            style={{flex: 1, accentColor: color, height: 4}}
          />
          <span style={{fontSize: 14}}>+</span>
        </div>

        <div style={{display: "flex", gap: 10}}>
          <button
            onClick={confirm}
            style={{
              flex: 1, padding: "13px 0",
              background: `linear-gradient(135deg,${color}e0,${color}90)`,
              borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14,
            }}
          >✓ Use Photo</button>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "13px 0",
              background: T.faint, border: `1px solid ${T.b1}`,
              borderRadius: 12, color: T.mu, fontWeight: 500,
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
    const [cropSrc,  setCropSrc]  = useState(null);
    const vRef = useRef(null);
    const cRef = useRef(null);

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
        const s = await navigator.mediaDevices.getUserMedia({video: {facingMode: "user"}});
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
      setCropSrc(null);
    }

    function handleCropCancel() {
      setCropping(false);
      setCropSrc(null);
    }

    // ── Cropping screen ────────────────────────────────────────────────────
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

    // ── Photo selection screen ─────────────────────────────────────────────
    return (
      <Overlay onBg={() => { stopCam(); onClose(); }} T={T} bottom>
        <div style={{fontWeight: 700, fontSize: 17, color: T.txt, marginBottom: 16}}>
          Profile Photo
        </div>

        {/* Preview */}
        <div style={{display: "flex", justifyContent: "center", marginBottom: 16}}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            overflow: "hidden", border: `2.5px solid ${profile.color}`,
            background: T.faint, display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}>
            {cam
              ? <video ref={vRef} autoPlay playsInline style={{width: "100%", height: "100%", objectFit: "cover"}}/>
              : prev
                ? <img src={prev} alt="" style={{width: "100%", height: "100%", objectFit: "cover"}}/>
                : <span style={{fontFamily: "monospace", fontSize: 32, fontWeight: 700, color: profile.color}}>
                    {window.HE_UTILS.ini(profile.name)}
                  </span>
            }
          </div>
          <canvas ref={cRef} style={{display: "none"}}/>
        </div>

        {cam
          ? <div style={{display: "flex", gap: 8}}>
              <button onClick={snap} style={{flex: 1, padding: "12px 0", background: `${profile.color}cc`, borderRadius: 12, color: "#fff", fontWeight: 700}}>
                📸 Capture
              </button>
              <button onClick={stopCam} style={{flex: 1, padding: "12px 0", background: T.faint, border: `1px solid ${T.b1}`, borderRadius: 12, color: T.mu}}>
                Cancel
              </button>
            </div>
          : <div style={{display: "flex", flexDirection: "column", gap: 8}}>
              <button onClick={pick} style={{padding: "13px 0", background: T.faint, border: `1px solid ${T.b1}`, borderRadius: 12, color: T.txt, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}>
                <window.HE_CamIcon/> Choose from Gallery
              </button>
              <button onClick={startCam} style={{padding: "13px 0", background: T.faint, border: `1px solid ${T.b1}`, borderRadius: 12, color: T.txt, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}>
                <window.HE_CamIcon/> Take Photo
              </button>
              {prev && (
                <button onClick={() => { setCropSrc(prev); setCropping(true); }} style={{padding: "12px 0", background: T.faint, border: `1px solid ${T.b1}`, borderRadius: 12, color: T.txt, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}>
                  ✂️ Adjust / Crop
                </button>
              )}
              {prev && (
                <button onClick={() => setPrev(null)} style={{padding: "12px 0", background: "transparent", border: "1px solid #c0404040", borderRadius: 12, color: "#c06060", fontWeight: 500}}>
                  Remove Photo
                </button>
              )}
              <div style={{height: 1, background: T.b1}}/>
              <button onClick={() => onSave(prev)} style={{padding: "13px 0", background: `linear-gradient(135deg,${profile.color}e0,${profile.color}90)`, borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14}}>
                Save Photo
              </button>
            </div>
        }
      </Overlay>
    );
  }

  // Expose
  window.HE_COMPONENTS = window.HE_COMPONENTS || {};
  window.HE_COMPONENTS.PhotoModal = PhotoModal;

})();
