<script>
// Register service worker for offline support
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    // ── Network-First Service Worker ─────────────────────────────────────────
    // CRITICAL: Navigation requests (HTML pages) MUST use NetworkFirst.
    // A CacheFirst strategy would serve a stale, potentially "logged-out" HTML
    // page from cache on PWA reopen, causing the auth flash bug.
    // Strategy:
    //   - HTML navigation requests → NetworkFirst (try network, fall back to cache)
    //   - Other GET requests (JS/CSS/images) → StaleWhileRevalidate
    const swCode=`
      const CACHE='highenough-v6';
      const HTML_CACHE='highenough-html-v6';

      self.addEventListener('install',e=>{
        e.waitUntil(
          caches.open(HTML_CACHE).then(c=>c.addAll(['/']).catch(()=>{}))
          .then(()=>self.skipWaiting())
        );
      });

      self.addEventListener('activate',e=>{
        // Clean up old caches from previous SW versions
        e.waitUntil(
          caches.keys().then(keys=>Promise.all(
            keys.filter(k=>k!==CACHE&&k!==HTML_CACHE).map(k=>caches.delete(k))
          )).then(()=>self.clients.claim())
        );
      });

      self.addEventListener('fetch',e=>{
        if(e.request.method!=='GET')return;
        const url=new URL(e.request.url);
        const isNavigation=e.request.mode==='navigate'||
                           (e.request.headers.get('accept')||'').includes('text/html');
        const isSameDomain=url.origin===self.location.origin;

        if(isNavigation&&isSameDomain){
          // NetworkFirst for HTML: always try to get the freshest page.
          // Only serve cache if the network is completely unavailable.
          e.respondWith(
            fetch(e.request, {cache:'no-cache'})
              .then(res=>{
                // Clone and cache the fresh response
                const clone=res.clone();
                caches.open(HTML_CACHE).then(c=>c.put(e.request,clone));
                return res;
              })
              .catch(async()=>{
                // Offline fallback: serve cached HTML
                const cached=await caches.match('/');
                return cached||new Response('Offline',{status:503});
              })
          );
          return;
        }

        // StaleWhileRevalidate for all other assets (JS/CSS/fonts/images)
        if(isSameDomain||url.hostname.includes('supabase.co')){
          return; // Don't intercept Supabase API calls
        }

        e.respondWith(
          caches.open(CACHE).then(async cache=>{
            const cached=await cache.match(e.request);
            const fresh=fetch(e.request).then(res=>{
              if(res.ok)cache.put(e.request,res.clone());
              return res;
            }).catch(()=>cached);
            return cached||fresh;
          })
        );
      });
    `;
    const blob=new Blob([swCode],{type:'application/javascript'});
    const url=URL.createObjectURL(blob);
    navigator.serviceWorker.register(url).catch(()=>{});
  });
}

// ── PWA Install Prompt ───────────────────────────────────────────────────────
// Uses the browser's native beforeinstallprompt event which triggers Chrome's
// official "Install app" dialog — installs as a true standalone app in the
// app drawer, NOT a browser shortcut.
//
// Rules:
// - Never show if already running as installed PWA (standalone/minimal-ui)
// - Only show the bottom banner once per session (sessionStorage flag)
// - Header "Install" button always available when prompt is capturable
// - After install or dismiss: clean up immediately

let deferredPrompt=null;

// Don't show anything if already installed as standalone app
const HE_IS_STANDALONE=window.matchMedia('(display-mode: standalone)').matches||
                        window.navigator.standalone===true;

window.hePromptInstall=async()=>{
  if(!deferredPrompt)return false;
  const p=deferredPrompt;
  deferredPrompt=null;
  const result=await p.prompt();
  const accepted=result?.outcome==='accepted'||result===undefined;
  window.dispatchEvent(new Event('he-installed'));
  return accepted;
};

if(!HE_IS_STANDALONE){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    window.dispatchEvent(new Event('he-install-ready'));

    // Show bottom banner once per session, 2s after page load
    // Skipped if user already dismissed it this session
    const dismissed=sessionStorage.getItem('he-install-dismissed');
    if(dismissed)return;

    setTimeout(()=>{
      if(!deferredPrompt)return;
      if(document.getElementById('he-install-banner'))return;

      const banner=document.createElement('div');
      banner.id='he-install-banner';
      banner.innerHTML=`
        <div style="position:fixed;bottom:76px;left:10px;right:10px;z-index:9998;
          background:#12121f;border:1px solid #2a2a40;border-radius:18px;
          padding:14px 16px;display:flex;align-items:center;gap:12px;
          box-shadow:0 8px 40px rgba(0,0,0,.7);animation:slideUp .28s ease;">
          <img src="/icon.png" width="40" height="40"
            style="border-radius:10px;flex-shrink:0;border:1px solid #2a2a40"
            onerror="this.style.display='none'"/>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;color:#eeeeff;
              font-family:'Inter',sans-serif">Install HighEnough</div>
            <div style="font-size:11px;color:#5a5a80;margin-top:2px;
              font-family:'Inter',sans-serif">
              Get the full app experience — works offline, opens instantly
            </div>
          </div>
          <button id="he-install-btn"
            style="padding:9px 16px;background:linear-gradient(135deg,#7b72e9,#5a52c8);
              border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;
              cursor:pointer;flex-shrink:0;font-family:'Inter',sans-serif">
            Install
          </button>
          <button id="he-dismiss-btn"
            style="background:none;border:none;color:#4e5270;font-size:18px;
              cursor:pointer;flex-shrink:0;padding:2px 4px;line-height:1">
            ✕
          </button>
        </div>
      `;
      document.body.appendChild(banner);

      async function doInstall(){
        banner.remove();
        if(deferredPrompt){
          await window.hePromptInstall();
        }
      }
      function doDismiss(){
        banner.remove();
        sessionStorage.setItem('he-install-dismissed','1');
        // Do NOT fire he-installed — user dismissed, not installed
      }

      document.getElementById('he-install-btn').onclick=doInstall;
      document.getElementById('he-dismiss-btn').onclick=doDismiss;

      // Auto-hide after 12s without user action
      setTimeout(()=>{
        const b=document.getElementById('he-install-banner');
        if(b)b.remove();
      },12000);
    },2000);
  });

  // Clean up if user installs via browser's own UI (omnibar button etc.)
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    window.dispatchEvent(new Event('he-installed'));
    const b=document.getElementById('he-install-banner');
    if(b)b.remove();
  });
}
