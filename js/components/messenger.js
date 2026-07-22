// ── HIGHENOUGH MESSENGER ──────────────────────────────────────────────────────
// Clean DM system — Inbox + ChatScreen + MessageInput
// Registered on window.HE_COMPONENTS
// Depends on: HE_UTILS (format.js), window.HE_AC, window.HE_pScore, window.HE_tierOf
// ─────────────────────────────────────────────────────────────────────────────
(function(){
  const {useState,useEffect,useRef,useCallback,useMemo}=React;

  // ── MESSAGE TIMESTAMP FORMAT ──────────────────────────────────────────────
  // Today → time only · Yesterday → "Yesterday, time" · Same week → weekday + time · Older → date + time
  function formatMsgTime(ts){
    if(!ts)return"";
    const d=new Date(ts);
    const now=new Date();
    const time=d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    const startOfDay=x=>{const c=new Date(x);c.setHours(0,0,0,0);return c;};
    const diffDays=Math.round((startOfDay(now)-startOfDay(d))/86400000);
    if(diffDays<=0)return time;
    if(diffDays===1)return`Yesterday, ${time}`;
    if(diffDays<7)return`${d.toLocaleDateString([],{weekday:"long"})}, ${time}`;
    return`${d.toLocaleDateString([],{day:"numeric",month:"short"})}, ${time}`;
  }

  // ── "DELETE FOR ME" — local-only, per device, never touches the server ────
  function getHiddenMsgs(convId){
    try{return new Set(JSON.parse(localStorage.getItem("he_hidden_"+convId)||"[]"));}catch{return new Set();}
  }
  function hideMsgLocally(convId,msgId){
    try{
      const cur=getHiddenMsgs(convId);
      cur.add(msgId);
      localStorage.setItem("he_hidden_"+convId,JSON.stringify([...cur]));
    }catch{}
  }

  // ── MESSAGE INPUT ────────────────────────────────────────────────────────────
  function MessageInput({color,onSend,placeholder,T}){
    const [txt,setTxt]=useState("");
    const inputRef=useRef(null);

    function handleChange(e){
      setTxt(e.target.value);
    }

    function doSend(){
      if(!txt.trim())return;
      onSend(txt.trim());
      setTxt("");
      if(inputRef.current)inputRef.current.style.height="auto";
      // No refocus hack needed — the send button prevents default on
      // pointerdown below, so the textarea never loses focus in the first
      // place, and the keyboard never closes/reopens around a send.
    }

    const hasText=txt.trim().length>0;

    return(
      <div style={{flexShrink:0}}>
        <div style={{
          display:"flex",alignItems:"flex-end",gap:8,
          padding:"8px 12px",
          paddingBottom:"max(12px,env(safe-area-inset-bottom))",
          borderTop:`1px solid ${T.b1}`,
          background:T.bg,
        }}>
          {/* Auto-grow textarea — device keyboard's own emoji key is used
              for emoji; no in-app picker. */}
          <textarea
            ref={inputRef}
            value={txt}
            onChange={handleChange}
            placeholder={placeholder||"Message…"}
            rows={1}
            style={{
              flex:1,padding:"9px 14px",
              background:T.inp,border:"none",
              borderRadius:20,color:T.txt,fontSize:15,
              outline:"none",resize:"none",
              lineHeight:1.4,
              maxHeight:120,overflowY:"auto",
              fontFamily:"inherit",
            }}
            onInput={e=>{
              // Auto-grow
              e.target.style.height="auto";
              e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
            }}
          />
          {/* Send button — preventDefault on pointerdown stops it from ever
              stealing focus from the textarea, so the keyboard stays open. */}
          <button
            onPointerDown={e=>e.preventDefault()}
            onClick={doSend}
            style={{
              width:36,height:36,borderRadius:"50%",flexShrink:0,marginBottom:1,
              background:hasText?`linear-gradient(135deg,${color}dd,${color}99)`:T.faint,
              border:"none",display:"flex",alignItems:"center",justifyContent:"center",
              color:hasText?"#fff":T.mu,transition:"background .15s",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── MESSAGE STATUS TICKS ─────────────────────────────────────────────────────
  function MsgTick({m,myId}){
    if(!m||m.sid!==myId)return null;
    const isPending=!m.dbId||String(m.dbId).startsWith("temp_");
    if(isPending)return<span title="Sending" style={{fontSize:10,color:"#8e8e93",marginLeft:3,opacity:.6}}>⏱</span>;
    const st=m.status||"sent";
    if(st==="seen")
      return<span title="Seen" style={{fontSize:11,color:"#7864DC",marginLeft:3,letterSpacing:"-2px",fontWeight:700}}>✓✓</span>;
    if(st==="delivered")
      return<span title="Delivered" style={{fontSize:11,color:"#8e8e93",marginLeft:3,letterSpacing:"-2px"}}>✓✓</span>;
    return<span title="Sent" style={{fontSize:11,color:"#8e8e93",marginLeft:3}}>✓</span>;
  }

  // ── CHAT SCREEN ──────────────────────────────────────────────────────────────
  const STATUS_RANK={sent:1,delivered:2,seen:3};
  function ChatScreen({conv,myProfile,profiles,T,onBack,onSend,onMarkRead,onClearChat,onBlockUser,onReportUser,onViewProfile}){
    const endRef=useRef(null);
    const scrollRef=useRef(null);
    const prevLenRef=useRef(0);
    const pressTimer=useRef(null);
    const msgs=conv.messages||[];
    const other=conv.other||{};
    const [hidden,setHidden]=useState(()=>getHiddenMsgs(conv.id));
    const [menuFor,setMenuFor]=useState(null);
    const [copiedId,setCopiedId]=useState(null);
    const statusRankRef=useRef(new Map());

    // Status must only move forward (sent → delivered → seen), regardless
    // of out-of-order optimistic/realtime updates arriving from app.js.
    function effectiveStatus(m){
      if(!m.dbId||String(m.dbId).startsWith("temp_"))return m.status; // pending — MsgTick handles this separately
      const incoming=m.status||"sent";
      const incomingRank=STATUS_RANK[incoming]||1;
      const seenRank=statusRankRef.current.get(m.dbId)||0;
      if(incomingRank>=seenRank){
        statusRankRef.current.set(m.dbId,incomingRank);
        return incoming;
      }
      // A lower-rank update arrived after a higher one — keep the higher status on screen.
      return Object.keys(STATUS_RANK).find(k=>STATUS_RANK[k]===seenRank)||incoming;
    }

    useEffect(()=>{setHidden(getHiddenMsgs(conv.id));},[conv.id]);

    function startPress(id){
      pressTimer.current=setTimeout(()=>setMenuFor(id),450);
    }
    function cancelPress(){
      clearTimeout(pressTimer.current);
    }
    function doCopy(text,id){
      navigator.clipboard?.writeText(text).catch(()=>{});
      setCopiedId(id);
      setTimeout(()=>setCopiedId(null),1100);
      setMenuFor(null);
    }
    function doDeleteForMe(id){
      hideMsgLocally(conv.id,id);
      setHidden(h=>new Set([...h,id]));
      setMenuFor(null);
    }

    // Mark read when chat opens or new messages arrive
    useEffect(()=>{
      if(conv?.id)onMarkRead(conv.id,other?.id);
      endRef.current?.scrollIntoView({behavior:"instant"});
      prevLenRef.current=msgs.length;
    },[conv?.id]);

    // Keep the latest message visible when the on-screen keyboard opens.
    // Without this, a shrinking viewport can leave the last message
    // scrolled out of view behind the keyboard ("message hiding").
    useEffect(()=>{
      const vv=window.visualViewport;
      if(!vv)return;
      let lastH=vv.height;
      function onResize(){
        if(vv.height<lastH-60){ // shrank meaningfully — keyboard likely opened
          endRef.current?.scrollIntoView({behavior:"instant"});
        }
        lastH=vv.height;
      }
      vv.addEventListener("resize",onResize);
      return()=>vv.removeEventListener("resize",onResize);
    },[]);

    useEffect(()=>{
      if(conv?.id&&msgs.some(m=>m.sid!==myProfile.id&&m.read===false)){
        onMarkRead(conv.id,other?.id);
      }
      const grew=msgs.length>prevLenRef.current;
      prevLenRef.current=msgs.length;
      if(!grew)return;
      // Always follow your own outgoing message. For incoming messages,
      // only auto-scroll if you're already near the bottom — otherwise
      // this would yank you away from history you scrolled up to read.
      const justSent=msgs[msgs.length-1]?.sid===myProfile.id;
      const el=scrollRef.current;
      const nearBottom=el?(el.scrollHeight-el.scrollTop-el.clientHeight<120):true;
      if(justSent||nearBottom){
        endRef.current?.scrollIntoView({behavior:"smooth"});
      }
    },[msgs.length]);

    // Visibility re-mark
    useEffect(()=>{
      function onVis(){if(document.visibilityState==="visible"&&conv?.id)onMarkRead(conv.id,other?.id);}
      document.addEventListener("visibilitychange",onVis);
      return()=>document.removeEventListener("visibilitychange",onVis);
    },[conv?.id]);

    const col=myProfile.color||"#7864DC";
    const visibleMsgs=msgs.filter(m=>!hidden.has(m.dbId));

    return(
      <div style={{position:"fixed",inset:0,zIndex:400,background:T.bg,display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{background:T.bg,borderBottom:`1px solid ${T.b1}`,padding:"10px 14px",paddingTop:"max(10px,env(safe-area-inset-top))",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:col,fontSize:24,padding:"0 4px",display:"flex",alignItems:"center"}}>‹</button>
          <div onClick={()=>onViewProfile&&onViewProfile(other)} style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer",minWidth:0}}>
            <div style={{width:38,height:38,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:`${other.color||col}18`,border:`2px solid ${other.color||col}40`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {other.photo
                ?<img src={other.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<span style={{fontSize:14,fontWeight:700,color:other.color||col}}>{window.HE_UTILS.ini(other.name)}</span>
              }
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{other.name}</div>
              {other.handle&&<div style={{fontSize:11,color:T.mu,fontFamily:"monospace"}}>{other.handle}</div>}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"12px 12px 4px",display:"flex",flexDirection:"column",gap:2}}>
          {visibleMsgs.map((m,i)=>{
            const mine=m.sid===myProfile.id;
            const prev=visibleMsgs[i-1];
            const mDate=m.ts?new Date(m.ts):null;
            const pDate=prev?.ts?new Date(prev.ts):null;
            const showDate=mDate&&(!pDate||mDate.toDateString()!==pDate.toDateString());
            const showAvatar=!mine&&(!prev||prev.sid!==m.sid||showDate);
            const canAct=m.dbId&&!String(m.dbId).startsWith("temp_"); // only fully-sent messages can be copied/deleted-for-me
            const menuOpen=canAct&&menuFor===m.dbId;
            return(
              <React.Fragment key={m.dbId||i}>
                {showDate&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
                    <div style={{flex:1,height:1,background:T.b1}}/>
                    <div style={{fontSize:11,color:T.mu,background:T.faint,borderRadius:8,padding:"2px 10px",fontWeight:600,flexShrink:0}}>
                      {window.HE_UTILS.formatDateLabel(mDate)}
                    </div>
                    <div style={{flex:1,height:1,background:T.b1}}/>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:mine?"row-reverse":"row",gap:6,alignItems:"flex-end",marginTop:showAvatar?6:1}}>
                  {/* Other's avatar */}
                  {!mine&&(
                    <div style={{width:28,flexShrink:0}}>
                      {showAvatar?(
                        <div onClick={()=>onViewProfile&&onViewProfile(other)}
                          style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",cursor:"pointer",background:`${other.color||col}18`,border:`1.5px solid ${other.color||col}40`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {other.photo
                            ?<img src={other.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            :<span style={{fontSize:10,fontWeight:700,color:other.color||col}}>{window.HE_UTILS.ini(other.name)}</span>
                          }
                        </div>
                      ):null}
                    </div>
                  )}
                  {/* Bubble */}
                  <div style={{maxWidth:"72%",position:"relative"}}>
                    <div
                      onPointerDown={()=>canAct&&startPress(m.dbId)}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      style={{
                        background:mine?`linear-gradient(135deg,${col}e8,${col}b0)`:T.faint,
                        borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                        padding:"9px 13px",
                        color:mine?"#fff":T.txt,
                        fontSize:15,lineHeight:1.4,wordBreak:"break-word",
                        userSelect:"none",WebkitUserSelect:"none",
                      }}>{m.txt}</div>
                    <div style={{fontSize:10,color:T.mu,marginTop:2,textAlign:mine?"right":"left",paddingLeft:4,paddingRight:4,display:"flex",alignItems:"center",justifyContent:mine?"flex-end":"flex-start",gap:2}}>
                      {copiedId===m.dbId?"Copied":window.HE_UTILS.fmtTime(m.ts)}
                      <MsgTick m={{...m,status:effectiveStatus(m)}} myId={myProfile.id}/>
                    </div>
                    {menuOpen&&(
                      <>
                        <div onClick={()=>setMenuFor(null)} style={{position:"fixed",inset:0,zIndex:9}}/>
                        <div onClick={e=>e.stopPropagation()} style={{
                          position:"absolute",top:-8,zIndex:10,
                          [mine?"right":"left"]:0,transform:"translateY(-100%)",
                          background:T.card,borderRadius:12,boxShadow:"0 4px 24px rgba(0,0,0,.18)",overflow:"hidden",minWidth:150,
                        }}>
                          <button onClick={()=>doCopy(m.txt,m.dbId)} style={{display:"block",width:"100%",padding:"11px 16px",textAlign:"left",background:"none",border:"none",fontSize:14,color:T.txt,borderBottom:`1px solid ${T.b1}`}}>Copy</button>
                          <button onClick={()=>doDeleteForMe(m.dbId)} style={{display:"block",width:"100%",padding:"11px 16px",textAlign:"left",background:"none",border:"none",fontSize:14,color:"#ff3b30"}}>Delete for me</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={endRef} style={{height:1}}/>
        </div>

        {/* Input */}
        <MessageInput
          color={col}
          onSend={txt=>onSend(conv.id,txt)}
          placeholder={`Message ${other.name||""}…`}
          T={T}
        />
      </div>
    );
  }

  // ── INBOX ROW ────────────────────────────────────────────────────────────────
  function ConvRow({conv,myProfile,T,onClick,onViewProfile,onDelete}){
    const other=conv.other||{};
    const msgs=conv.messages||[];
    const last=msgs[msgs.length-1];
    const unread=msgs.filter(m=>m.sid!==myProfile.id&&m.read!==true&&!String(m.dbId||"").startsWith("temp_")).length;
    const lastTxt=last?.txt||"";
    const isMe=last?.sid===myProfile.id;
    const col=other.color||"#7864DC";
    const [showMenu,setShowMenu]=useState(false);

    return(
      <div style={{display:"flex",alignItems:"center",padding:"10px 16px",gap:12,cursor:"pointer",position:"relative",background:unread>0?"rgba(120,100,220,.04)":"transparent"}}
        onClick={onClick}>
        {/* Avatar */}
        <div style={{width:52,height:52,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:`${col}18`,border:`2px solid ${col}28`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
          {other.photo
            ?<img src={other.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<span style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:col}}>{window.HE_UTILS.ini(other.name)}</span>
          }
        </div>
        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
            <div style={{fontWeight:unread>0?700:500,fontSize:15,color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{other.name}</div>
            <div style={{fontSize:11,color:T.mu,flexShrink:0}}>{last?.ts?formatMsgTime(last.ts):""}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:2}}>
            <div style={{fontSize:13,color:unread>0?T.txt:T.mu,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
              {isMe&&<span style={{color:T.mu}}>You: </span>}{lastTxt}
            </div>
            {unread>0&&<div style={{minWidth:18,height:18,borderRadius:99,background:col,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",flexShrink:0}}>{unread>9?"9+":unread}</div>}
            <button onClick={e=>{e.stopPropagation();setShowMenu(m=>!m);}} style={{background:"none",border:"none",color:T.mu,fontSize:18,padding:"0 4px",flexShrink:0}}>···</button>
          </div>
        </div>
        {/* Context menu */}
        {showMenu&&(
          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:16,top:40,background:T.card,borderRadius:12,boxShadow:"0 4px 24px rgba(0,0,0,.15)",zIndex:10,overflow:"hidden",minWidth:140}}>
            <button onClick={()=>{onViewProfile&&onViewProfile(other);setShowMenu(false);}} style={{display:"block",width:"100%",padding:"12px 16px",textAlign:"left",background:"none",border:"none",fontSize:14,color:T.txt,borderBottom:`1px solid ${T.b1}`}}>View Profile</button>
            <button onClick={()=>{onDelete&&onDelete(conv.id);setShowMenu(false);}} style={{display:"block",width:"100%",padding:"12px 16px",textAlign:"left",background:"none",border:"none",fontSize:14,color:"#ff3b30"}}>Delete Chat</button>
          </div>
        )}
      </div>
    );
  }

  // ── INBOX ────────────────────────────────────────────────────────────────────
  function Inbox({convs,myProfile,T,onOpen,onDelete,onViewProfile}){
    const sorted=[...convs].sort((a,b)=>{
      const la=a.messages?.[a.messages.length-1]?.ts||0;
      const lb=b.messages?.[b.messages.length-1]?.ts||0;
      return lb-la;
    });

    if(!sorted.length)return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:12,color:T.mu}}>
        <div style={{fontSize:48}}>💬</div>
        <div style={{fontWeight:600,fontSize:16,color:T.txt}}>No messages yet</div>
        <div style={{fontSize:13,textAlign:"center",maxWidth:200}}>Tap the send icon on a profile to start chatting</div>
      </div>
    );

    return(
      <div>
        {sorted.map(conv=>(
          <ConvRow
            key={conv.id}
            conv={conv}
            myProfile={myProfile}
            T={T}
            onClick={()=>onOpen(conv)}
            onViewProfile={onViewProfile}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  // Register
  window.HE_COMPONENTS=window.HE_COMPONENTS||{};
  window.HE_COMPONENTS.MessengerInbox=Inbox;
  window.HE_COMPONENTS.MessengerChatScreen=ChatScreen;
  window.HE_COMPONENTS.MessengerMessageInput=MessageInput;
  window.HE_COMPONENTS.MessengerMsgTick=MsgTick;

})();
