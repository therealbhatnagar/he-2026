// ── HIGHENOUGH MESSENGER ──────────────────────────────────────────────────────
// Clean DM system — Inbox + ChatScreen + EmojiTray + MessageInput
// Registered on window.HE_COMPONENTS
// Depends on: HE_UTILS (format.js), window.HE_AC, window.HE_pScore, window.HE_tierOf
// ─────────────────────────────────────────────────────────────────────────────
(function(){
  const {useState,useEffect,useRef,useCallback,useMemo}=React;

  // ── EMOJI DATA ──────────────────────────────────────────────────────────────
  const EMOJI_DATA={
    recent:{icon:"🕐",label:"Recent"},
    smileys:{icon:"😀",label:"Smileys",list:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🫡","🤭","🫢","🤫","🤔","🫤","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"]},
    people:{icon:"👋",label:"People",list:["👋","🤚","🖐️","✋","🖖","🫱","🫲","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🙏","✍️","💅","💪","🦾","🦵","🦶","👂","🦻","👃","👀","👁️","👅","👄","🫦","💋","👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷"]},
    animals:{icon:"🐶",label:"Animals",list:["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐈‍⬛","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔"]},
    food:{icon:"🍎",label:"Food",list:["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🧄","🧅","🥔","🍠","🥜","🍞","🥐","🥖","🫓","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫔","🌮","🌯","🥙","🧆","🍱","🍘","🍙","🍚","🍛","🍜","🍝","🍢","🍣","🍤","🍥","🥮","🍡","🥟","🦪","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍯","🍼","🥛","☕","🫖","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾"]},
    travel:{icon:"✈️",label:"Travel",list:["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","⛽","🚨","🚥","🚦","🛑","🚧","⚓","⛵","🛶","🚤","🛳️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚀","🛸","🌍","🌎","🌏","🗺️","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏟️","🏛️","🏗️","🏘️","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🕋"]},
    objects:{icon:"💡",label:"Objects",list:["⌚","📱","💻","⌨️","🖥️","🖨️","📺","📷","📸","📹","🎥","📞","☎️","📡","🔋","🔌","💡","🔦","🕯️","🧯","💰","💴","💵","💶","💷","💸","💳","💹","📈","📉","📊","📋","📌","📍","📎","📏","📐","✂️","🗃️","🗄️","🗑️","🔒","🔓","🔑","🗝️","🔨","⚒️","🛠️","⚔️","🛡️","🔧","🔩","⚙️","🗜️","⚖️","🔗","🔬","🔭","💉","💊","🩹","🚪","🛗","🪞","🪟","🛏️","🛋️","🪑","🚽","🚿","🛁","🧴","🧷","🧹","🧺","🧻","🧼","🛒"]},
    symbols:{icon:"❤️",label:"Symbols",list:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","♻️","✅","❎","🆗","🆙","🆒","🆕","🆓","⬆️","➡️","⬇️","⬅️","↕️","↔️","🔃","🔄","🔙","🔚","🔛","🔜","🔝"]},
  };
  const EMOJI_CATS=Object.keys(EMOJI_DATA).filter(k=>k!=="recent");

  function getRecentEmojis(){try{return JSON.parse(localStorage.getItem("he_recent")||"[]");}catch{return[];}}
  function saveRecentEmoji(e){
    try{
      const r=[e,...getRecentEmojis().filter(x=>x!==e)].slice(0,40);
      localStorage.setItem("he_recent",JSON.stringify(r));
    }catch{}
  }

  // ── EMOJI TRAY ──────────────────────────────────────────────────────────────
  function EmojiTray({color,onEmoji,onBackspace,inputRef}){
    const [cat,setCat]=useState("smileys");
    const [recent,setRecent]=useState(getRecentEmojis);

    const emojis=cat==="recent"
      ?(recent.length?recent:EMOJI_DATA.smileys.list)
      :(EMOJI_DATA[cat]?.list||[]);

    function tapEmoji(e){
      onEmoji(e);
      saveRecentEmoji(e);
      setRecent(getRecentEmojis());
    }

    return(
      <div style={{background:"#fff",borderTop:"1px solid #e5e5ea",flexShrink:0}}>
        {/* Category row */}
        <div style={{display:"flex",alignItems:"center",overflowX:"auto",borderBottom:"1px solid #e5e5ea",padding:"2px 4px 0",scrollbarWidth:"none"}}>
          <button onClick={()=>setCat("recent")} style={{fontSize:18,padding:"6px 8px",borderRadius:"8px 8px 0 0",background:cat==="recent"?"#f2f2f7":"transparent",border:"none",borderBottom:cat==="recent"?`2px solid ${color}`:"2px solid transparent",flexShrink:0,opacity:recent.length?1:.4}}>🕐</button>
          {EMOJI_CATS.map(k=>(
            <button key={k} onClick={()=>setCat(k)} style={{fontSize:18,padding:"6px 8px",borderRadius:"8px 8px 0 0",background:cat===k?"#f2f2f7":"transparent",border:"none",borderBottom:cat===k?`2px solid ${color}`:"2px solid transparent",flexShrink:0}}>{EMOJI_DATA[k].icon}</button>
          ))}
          <div style={{flex:1}}/>
          <button
            onClick={onBackspace}
            style={{fontSize:16,padding:"4px 10px",background:"#f2f2f7",border:"1px solid #e5e5ea",borderRadius:8,color:"#666",flexShrink:0,margin:"4px 4px 6px"}}
          >⌫</button>
        </div>
        {/* Emoji grid */}
        <div style={{display:"flex",flexWrap:"wrap",padding:"6px 4px",height:200,overflowY:"auto",alignContent:"flex-start",gap:0}}>
          {emojis.map((e,i)=>(
            <button key={i} onClick={()=>tapEmoji(e)}
              style={{fontSize:26,width:"12.5%",height:44,background:"none",border:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,borderRadius:8}}>
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── MESSAGE INPUT ────────────────────────────────────────────────────────────
  function MessageInput({color,onSend,placeholder}){
    const [txt,setTxt]=useState("");
    const [showEmoji,setShowEmoji]=useState(false);
    const inputRef=useRef(null);
    const selRef=useRef({start:0,end:0}); // track cursor before emoji panel opens

    function handleChange(e){
      setTxt(e.target.value);
    }

    function handleKeyDown(e){
      if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}
    }

    function doSend(){
      if(!txt.trim())return;
      onSend(txt.trim());
      setTxt("");
      setShowEmoji(false);
      setTimeout(()=>inputRef.current?.focus(),50);
    }

    function toggleEmoji(){
      if(!showEmoji){
        // Save cursor position before blur
        const inp=inputRef.current;
        if(inp){selRef.current={start:inp.selectionStart,end:inp.selectionEnd};}
        inp?.blur();
        setShowEmoji(true);
      } else {
        setShowEmoji(false);
        // Restore cursor
        setTimeout(()=>{
          const inp=inputRef.current;
          if(!inp)return;
          inp.focus();
          inp.selectionStart=selRef.current.start;
          inp.selectionEnd=selRef.current.end;
        },50);
      }
    }

    function insertEmoji(e){
      const inp=inputRef.current;
      const start=selRef.current.start;
      const end=selRef.current.end;
      const cur=inp?inp.value:txt;
      const newVal=cur.slice(0,start)+e+cur.slice(end);
      const newPos=start+[...e].length;
      setTxt(newVal);
      selRef.current={start:newPos,end:newPos};
      // Don't focus input (would close keyboard on mobile)
    }

    function doBackspace(){
      const start=selRef.current.start;
      const end=selRef.current.end;
      const cur=txt;
      let newVal,newPos;
      if(start!==end){
        // Delete selection
        newVal=cur.slice(0,start)+cur.slice(end);
        newPos=start;
      } else if(start>0){
        // Delete one grapheme cluster before cursor
        const before=cur.slice(0,start);
        let nb;
        try{
          const segs=[...new Intl.Segmenter().segment(before)].map(s=>s.segment);
          segs.pop();nb=segs.join('');
        }catch{const a=[...before];a.pop();nb=a.join('');}
        newVal=nb+cur.slice(start);
        newPos=nb.length;
      } else {return;}
      setTxt(newVal);
      selRef.current={start:newPos,end:newPos};
    }

    const hasText=txt.trim().length>0;

    return(
      <div style={{flexShrink:0}}>
        {/* Input row */}
        <div style={{
          display:"flex",alignItems:"flex-end",gap:8,
          padding:"8px 12px",
          paddingBottom:showEmoji?"8px":"max(12px,env(safe-area-inset-bottom))",
          borderTop:"1px solid #e5e5ea",
          background:"#fff",
        }}>
          {/* Emoji toggle */}
          <button onClick={toggleEmoji} style={{
            width:36,height:36,borderRadius:"50%",flexShrink:0,marginBottom:1,
            background:showEmoji?`${color}20`:"#f2f2f7",
            border:`1px solid ${showEmoji?color+"50":"#e5e5ea"}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
          }}>😊</button>
          {/* Auto-grow textarea */}
          <textarea
            ref={inputRef}
            value={txt}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={e=>{selRef.current={start:e.target.selectionStart,end:e.target.selectionEnd};}}
            onFocus={()=>{if(showEmoji)setShowEmoji(false);}}
            placeholder={placeholder||"Message…"}
            rows={1}
            style={{
              flex:1,padding:"9px 14px",
              background:"#f2f2f7",border:"none",
              borderRadius:20,color:"#000",fontSize:15,
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
          {/* Send button */}
          <button onClick={doSend} style={{
            width:36,height:36,borderRadius:"50%",flexShrink:0,marginBottom:1,
            background:hasText?`linear-gradient(135deg,${color}dd,${color}99)`:"#f2f2f7",
            border:"none",display:"flex",alignItems:"center",justifyContent:"center",
            color:hasText?"#fff":"#aaa",transition:"background .15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        {/* Emoji tray — below input, hidden with height animation */}
        {showEmoji&&(
          <EmojiTray
            color={color}
            onEmoji={insertEmoji}
            onBackspace={doBackspace}
            inputRef={inputRef}
          />
        )}
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
  function ChatScreen({conv,myProfile,profiles,T,onBack,onSend,onMarkRead,onClearChat,onBlockUser,onReportUser,onViewProfile}){
    const endRef=useRef(null);
    const msgs=conv.messages||[];
    const other=conv.other||{};

    // Mark read when chat opens or new messages arrive
    useEffect(()=>{
      if(conv?.id)onMarkRead(conv.id,other?.id);
      endRef.current?.scrollIntoView({behavior:"instant"});
    },[conv?.id]);

    useEffect(()=>{
      if(conv?.id&&msgs.some(m=>m.sid!==myProfile.id&&m.read===false)){
        onMarkRead(conv.id,other?.id);
      }
      endRef.current?.scrollIntoView({behavior:"smooth"});
    },[msgs.length]);

    // Visibility re-mark
    useEffect(()=>{
      function onVis(){if(document.visibilityState==="visible"&&conv?.id)onMarkRead(conv.id,other?.id);}
      document.addEventListener("visibilitychange",onVis);
      return()=>document.removeEventListener("visibilitychange",onVis);
    },[conv?.id]);

    const col=myProfile.color||"#7864DC";

    return(
      <div style={{position:"fixed",inset:0,zIndex:400,background:"#fff",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{background:"#fff",borderBottom:"1px solid #e5e5ea",padding:"10px 14px",paddingTop:"max(10px,env(safe-area-inset-top))",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:col,fontSize:24,padding:"0 4px",display:"flex",alignItems:"center"}}>‹</button>
          <div onClick={()=>onViewProfile&&onViewProfile(other)} style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer",minWidth:0}}>
            <div style={{width:38,height:38,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:`${other.color||col}18`,border:`2px solid ${other.color||col}40`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {other.photo
                ?<img src={other.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<span style={{fontSize:14,fontWeight:700,color:other.color||col}}>{window.HE_UTILS.ini(other.name)}</span>
              }
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,color:"#000",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{other.name}</div>
              {other.handle&&<div style={{fontSize:11,color:"#8e8e93",fontFamily:"monospace"}}>{other.handle}</div>}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 12px 4px",display:"flex",flexDirection:"column",gap:2}}>
          {msgs.map((m,i)=>{
            const mine=m.sid===myProfile.id;
            const prev=msgs[i-1];
            const mDate=m.ts?new Date(m.ts):null;
            const pDate=prev?.ts?new Date(prev.ts):null;
            const showDate=mDate&&(!pDate||mDate.toDateString()!==pDate.toDateString());
            const showAvatar=!mine&&(!prev||prev.sid!==m.sid||showDate);
            return(
              <React.Fragment key={m.dbId||i}>
                {showDate&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
                    <div style={{flex:1,height:1,background:"#e5e5ea"}}/>
                    <div style={{fontSize:11,color:"#8e8e93",background:"#f2f2f7",borderRadius:8,padding:"2px 10px",fontWeight:600,flexShrink:0}}>
                      {window.HE_UTILS.formatDateLabel(mDate)}
                    </div>
                    <div style={{flex:1,height:1,background:"#e5e5ea"}}/>
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
                  <div style={{maxWidth:"72%"}}>
                    <div style={{
                      background:mine?`linear-gradient(135deg,${col}e8,${col}b0)`:"#f2f2f7",
                      borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      padding:"9px 13px",
                      color:mine?"#fff":"#000",
                      fontSize:15,lineHeight:1.4,wordBreak:"break-word",
                    }}>{m.txt}</div>
                    <div style={{fontSize:10,color:"#8e8e93",marginTop:2,textAlign:mine?"right":"left",paddingLeft:4,paddingRight:4,display:"flex",alignItems:"center",justifyContent:mine?"flex-end":"flex-start",gap:2}}>
                      {window.HE_UTILS.fmtTime(m.ts)}
                      <MsgTick m={m} myId={myProfile.id}/>
                    </div>
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
            <div style={{fontWeight:unread>0?700:500,fontSize:15,color:"#000",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{other.name}</div>
            <div style={{fontSize:11,color:"#8e8e93",flexShrink:0}}>{last?.ts?window.HE_UTILS.ago(last.ts):""}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:2}}>
            <div style={{fontSize:13,color:unread>0?"#000":"#8e8e93",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
              {isMe&&<span style={{color:"#8e8e93"}}>You: </span>}{lastTxt}
            </div>
            {unread>0&&<div style={{minWidth:18,height:18,borderRadius:99,background:col,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",flexShrink:0}}>{unread>9?"9+":unread}</div>}
            <button onClick={e=>{e.stopPropagation();setShowMenu(m=>!m);}} style={{background:"none",border:"none",color:"#8e8e93",fontSize:18,padding:"0 4px",flexShrink:0}}>···</button>
          </div>
        </div>
        {/* Context menu */}
        {showMenu&&(
          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:16,top:40,background:"#fff",borderRadius:12,boxShadow:"0 4px 24px rgba(0,0,0,.15)",zIndex:10,overflow:"hidden",minWidth:140}}>
            <button onClick={()=>{onViewProfile&&onViewProfile(other);setShowMenu(false);}} style={{display:"block",width:"100%",padding:"12px 16px",textAlign:"left",background:"none",border:"none",fontSize:14,color:"#000",borderBottom:"1px solid #f2f2f7"}}>View Profile</button>
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
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:12,color:"#8e8e93"}}>
        <div style={{fontSize:48}}>💬</div>
        <div style={{fontWeight:600,fontSize:16,color:"#000"}}>No messages yet</div>
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
  window.HE_COMPONENTS.MessengerEmojiTray=EmojiTray;
  window.HE_COMPONENTS.MessengerMsgTick=MsgTick;

})();
