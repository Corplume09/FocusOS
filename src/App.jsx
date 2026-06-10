import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ── Config ───────────────────────────────────────────────────────────────
const _env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
const SUPABASE_URL  = _env.VITE_SUPABASE_URL  || "https://hfgqmlpvcixxjqyqhxfh.supabase.co/rest/v1/";
const SUPABASE_KEY  = _env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZ3FtbHB2Y2l4eGpxeXFoeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTIwNjcsImV4cCI6MjA5NjUyODA2N30.oQ8ajczjwEijb4XpRNkcXYkdthfpLyb7xL3E_o_-qJ8";
const DEV_PASSWORD  = _env.VITE_DEV_PASSWORD  || "focusdev2025";
const AUTH_URL      = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") : "";

// ── Supabase Auth API ─────────────────────────────────────────────────────
async function sbAuthFetch(path, body) {
  if (!AUTH_URL || !SUPABASE_KEY) return { error: "Supabase not configured" };
  try {
    const res = await fetch(`${AUTH_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error_description || data.msg || "Auth error" };
    return { data };
  } catch (e) { return { error: e.message }; }
}

// Register: uses email = username@focusos.app (fake domain — Supabase just needs valid format)
async function sbRegister(username, password) {
  return sbAuthFetch("signup", {
    email: `${username.toLowerCase()}@focusos.app`,
    password,
    data: { username },
  });
}

// Login
async function sbLogin(username, password) {
  return sbAuthFetch("token?grant_type=password", {
    email: `${username.toLowerCase()}@focusos.app`,
    password,
  });
}

// Refresh session
async function sbRefresh(refresh_token) {
  return sbAuthFetch("token?grant_type=refresh_token", { refresh_token });
}

// ── Leaderboard REST ──────────────────────────────────────────────────────
async function sbFetch(path, opts = {}, token = null) {
  if (!AUTH_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${AUTH_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token || SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": opts.prefer || "return=representation",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch { return null; }
}

async function lbUpsert(username, score, isdev, token, userId) {
  return sbFetch("leaderboard?on_conflict=username", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: JSON.stringify({
      username,
      score,
      is_dev: !!isdev,
      user_id: userId || null,
      updated_at: new Date().toISOString(),
    }),
  }, token);
}

async function lbFetch(token) {
  return sbFetch(
    "leaderboard?order=score.desc&limit=20&select=username,score,is_dev,updated_at",
    {}, token
  );
}

// ── Session persistence ───────────────────────────────────────────────────
function loadAuth() {
  try { return JSON.parse(localStorage.getItem("focusos_auth") || "null"); } catch { return null; }
}
function saveAuth(v) {
  try { localStorage.setItem("focusos_auth", JSON.stringify(v)); } catch {}
}
function clearAuth() {
  try { localStorage.removeItem("focusos_auth"); } catch {}
}


const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Constants ─────────────────────────────────────────────────────────────
const PRIORITIES = { high:{color:"#e05252"}, medium:{color:"#e09a30"}, low:{color:"#4caf88"} };
const PRIO_PTS   = { high:5, medium:3, low:1 };

const DEFAULT_HABITS = [
  { id:1, name:"Exercise",        emoji:"🏃", tracker:"activity"   },
  { id:2, name:"Meditate",        emoji:"🧘", tracker:"meditation" },
  { id:3, name:"Read",            emoji:"📚", tracker:"reading"    },
  { id:4, name:"No social media", emoji:"📵", tracker:null         },
  { id:5, name:"Drink water",     emoji:"💧", tracker:"water"      },
  { id:6, name:"Sleep 8h",        emoji:"😴", tracker:"sleep"      },
];

const TRACKER_OPTIONS = [
  { id:"",          label:"Checkbox only"  },
  { id:"water",     label:"💧 Water"       },
  { id:"activity",  label:"🏃 Activity"    },
  { id:"reading",   label:"📚 Reading"     },
  { id:"meditation",label:"🧘 Meditation"  },
  { id:"sleep",     label:"😴 Sleep"       },
  { id:"steps",     label:"👟 Steps"       },
  { id:"weight",    label:"⚖️ Weight"      },
  { id:"mood",      label:"😊 Mood"        },
  { id:"counter",   label:"🔢 Counter"     },
];

const EMOJI_OPTIONS = ["🎯","🏃","🧘","📚","📵","💧","😴","🥗","💪","✍️","🚴","🌿","🎵","🧹","💊","🛌","☀️","🥤","🧠","🏋️","🎨","🗣️","💻","🌱","👟","⚖️","😊","🔢","🧪","🎻"];

const DEFAULT_TIMER = { work:25, brk:5 };

const SOUND_OPTIONS = [
  { id:"bell",   label:"Bell",   desc:"Three soft bell tones"  },
  { id:"chime",  label:"Chime",  desc:"Ascending chime melody" },
  { id:"ding",   label:"Ding",   desc:"Single crisp ping"      },
  { id:"beep",   label:"Beep",   desc:"Triple electronic beep" },
  { id:"gong",   label:"Gong",   desc:"Deep resonant gong"     },
  { id:"silent", label:"Silent", desc:"No sound"               },
];

const POMO_TIPS = [
  "During work blocks, close email and social tabs entirely.",
  "A clear desk = a clear mind. Tidy before you start.",
  "Write tomorrow's top 3 tasks tonight.",
  "Your break is sacred — don't check messages.",
  "If you get distracted, write it down and return to focus.",
];

const TIPS_DATA = [
  { title:"🐸 Eat the Frog First",      body:"Start every day with your hardest task. Once it's done, momentum carries you." },
  { title:"⏱ Time Block Your Calendar", body:"Assign tasks to fixed slots. Treat them like meetings you can't cancel." },
  { title:"📵 Single-Tasking Wins",     body:"Close unrelated tabs, phone face-down. One task at a time, done well." },
  { title:"🔋 Protect Your Energy",     body:"Sleep is your #1 productivity tool. Exercise and short breaks replenish mental fuel." },
  { title:"📝 Weekly Review (15 min)",  body:"Every Sunday, review what you accomplished and plan your top 3 priorities." },
  { title:"✂️ Ruthlessly Prioritize",   body:"80% of results come from 20% of tasks. What's your one most important thing today?" },
  { title:"📬 Batch Communication",     body:"Check email at set windows (9am, 1pm, 5pm). Constant pings fracture deep focus." },
  { title:"🚫 Say No Strategically",    body:"Every yes is a no to something else. Guard your deep work time fiercely." },
];

const FOOD_DB = [
  { name:"Chicken Breast (100g)",  cal:165, p:31, c:0,  f:3.6 },
  { name:"Brown Rice (1 cup)",     cal:216, p:5,  c:45, f:1.8 },
  { name:"Egg (1 large)",          cal:78,  p:6,  c:0.6,f:5   },
  { name:"Banana",                 cal:105, p:1.3,c:27, f:0.4 },
  { name:"Greek Yogurt (1 cup)",   cal:130, p:17, c:9,  f:3   },
  { name:"Almonds (1 oz)",         cal:164, p:6,  c:6,  f:14  },
  { name:"Avocado (half)",         cal:120, p:1.5,c:6,  f:11  },
  { name:"Oatmeal (1 cup)",        cal:154, p:6,  c:28, f:3   },
  { name:"Salmon (100g)",          cal:208, p:20, c:0,  f:13  },
  { name:"Apple",                  cal:95,  p:0.5,c:25, f:0.3 },
  { name:"Sweet Potato (med)",     cal:103, p:2.3,c:24, f:0.1 },
  { name:"Broccoli (1 cup)",       cal:55,  p:4,  c:11, f:0.6 },
  { name:"Whole Milk (1 cup)",     cal:149, p:8,  c:12, f:8   },
  { name:"Pasta (1 cup cooked)",   cal:220, p:8,  c:43, f:1.3 },
  { name:"Protein Shake",          cal:150, p:25, c:8,  f:3   },
  { name:"White Rice (1 cup)",     cal:205, p:4.3,c:45, f:0.4 },
  { name:"Tuna (can, drained)",    cal:120, p:26, c:0,  f:1   },
  { name:"Whole Wheat Bread (sl)", cal:79,  p:2.7,c:15, f:1   },
  { name:"Orange",                 cal:62,  p:1.2,c:15, f:0.2 },
  { name:"Mixed Nuts (1 oz)",      cal:173, p:5,  c:6,  f:16  },
  { name:"Cottage Cheese (1 cup)", cal:206, p:28, c:8,  f:9   },
  { name:"Steak (100g)",           cal:271, p:26, c:0,  f:18  },
  { name:"Spinach (1 cup raw)",    cal:7,   p:0.9,c:1.1,f:0.1 },
  { name:"Blueberries (1 cup)",    cal:84,  p:1.1,c:21, f:0.5 },
  { name:"Peanut Butter (2 tbsp)", cal:188, p:8,  c:6,  f:16  },
  { name:"Lentils (1 cup)",        cal:230, p:18, c:40, f:0.8 },
  { name:"Cheddar Cheese (1 oz)",  cal:113, p:7,  c:0.4,f:9   },
  { name:"Coffee (black)",         cal:2,   p:0,  c:0,  f:0   },
  { name:"Orange Juice (1 cup)",   cal:112, p:1.7,c:26, f:0.5 },
  { name:"Dark Chocolate (1 oz)",  cal:170, p:2,  c:13, f:12  },
];

const MOOD_OPTS = [
  { emoji:"😞", label:"Rough"   },
  { emoji:"😐", label:"Okay"    },
  { emoji:"🙂", label:"Good"    },
  { emoji:"😊", label:"Great"   },
  { emoji:"🤩", label:"Amazing" },
];

// ── Storage ───────────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0,10);
function load(k,fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(k,v) { try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} }
function usePersist(key,fallback){
  const [val,setVal] = useState(()=>load(key,fallback));
  const set = useCallback((v)=>{ const next=typeof v==="function"?v(load(key,fallback)):v; save(key,next); setVal(next); },[key]);
  return [val,set];
}

// ── User context — so every sub-component scopes its storage to the current user ──
const UserCtx = createContext("u_guest");
const useUK = () => useContext(UserCtx);

// ── Sound ─────────────────────────────────────────────────────────────────
function playSound(type,vol=70){
  if(type==="silent"||vol===0) return;
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const v=vol/100;
    const mk=(freq,start,dur,t="sine",amp=v)=>{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination); osc.type=t;
      osc.frequency.setValueAtTime(freq,ctx.currentTime+start);
      g.gain.setValueAtTime(amp,ctx.currentTime+start);
      g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+start+dur);
      osc.start(ctx.currentTime+start); osc.stop(ctx.currentTime+start+dur+0.05);
    };
    if(type==="bell")  { [[880,0,1.4],[880,0.5,1.2],[660,1.0,1.0]].forEach(([f,s,d])=>{ mk(f,s,d*0.3,"sine",v*0.5); mk(f*2,s,d*0.15,"sine",v*0.15); }); }
    else if(type==="chime") { [[523,0,1.8],[659,0.18,1.6],[784,0.36,1.4],[1047,0.54,1.8]].forEach(([f,s,d])=>mk(f,s,d,"sine",v*0.28)); }
    else if(type==="ding")  { mk(1320,0,0.05,"sine",v); mk(1320,0,1.0,"sine",v*0.4); }
    else if(type==="beep")  { [0,0.22,0.44].forEach(s=>mk(900,s,0.15,"square",v*0.12)); }
    else if(type==="gong")  { mk(110,0,3.5,"sine",v*0.6); mk(220,0,2.5,"sine",v*0.25); mk(330,0,1.5,"sine",v*0.1); }
    setTimeout(()=>ctx.close(),5000);
  }catch(e){}
}

// ── Smooth SVG path helper ────────────────────────────────────────────────
function smoothPath(pts){
  if(!pts||pts.length<2) return pts&&pts.length===1?`M${pts[0].x},${pts[0].y}`:"";
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i],p1=pts[i+1],mx=(p0.x+p1.x)/2;
    d+=` C${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}
function smoothArea(pts,baseY){
  if(!pts||pts.length<2) return "";
  return `${smoothPath(pts)} L${pts[pts.length-1].x},${baseY} L${pts[0].x},${baseY} Z`;
}


// ── Challenge Data ─────────────────────────────────────────────────────────
const DIFF_CONFIG = {
  easy:   { label:"Easy",   emoji:"🟢", color:"#4caf88", bonusPts:8,  desc:"A manageable challenge" },
  medium: { label:"Medium", emoji:"🟡", color:"#e09a30", bonusPts:15, desc:"Requires real effort" },
  hard:   { label:"Hard",   emoji:"🔴", color:"#e05252", bonusPts:25, desc:"Pushes your limits" },
  elite:  { label:"Elite",  emoji:"💀", color:"#a855f7", bonusPts:40, desc:"Maximum difficulty" },
};

const CHALLENGE_POOL = [
  // Focus & deep work
  { id:"c01", cat:"🧠 Focus",    easy:"Write a full to-do list for the week",           medium:"Complete 2 uninterrupted focus sessions",      hard:"Complete 3 focus sessions with zero phone",        elite:"4 focus sessions, phone in another room" },
  { id:"c02", cat:"🧠 Focus",    easy:"Close all social media tabs for 2 hours",         medium:"No social media for the entire morning",         hard:"Zero social media all day",                        elite:"24-hour digital detox (no social, no news)" },
  { id:"c03", cat:"🧠 Focus",    easy:"Write down your top 3 priorities for today",      medium:"Do your hardest task first, before anything else",hard:"Complete your top 3 priorities before 3 PM",       elite:"Complete your entire task list before 5 PM" },
  // Body
  { id:"c04", cat:"💪 Body",     easy:"Take a 10-minute walk",                           medium:"30-minute workout or run",                       hard:"45-minute intense workout",                        elite:"Full workout + cold shower after" },
  { id:"c05", cat:"💪 Body",     easy:"Drink 4 glasses of water today",                  medium:"Hit your full daily water goal",                  hard:"Water goal + zero sugary drinks",                  elite:"Water goal + meal prep one healthy meal" },
  { id:"c06", cat:"💪 Body",     easy:"Stretch for 5 minutes",                           medium:"20 minutes of yoga or mobility work",             hard:"Morning workout before checking your phone",        elite:"Workout, healthy breakfast, no caffeine before 10am" },
  // Mind
  { id:"c07", cat:"🧘 Mind",     easy:"5 minutes of meditation or deep breathing",       medium:"10-minute guided meditation",                    hard:"20-minute meditation, no distractions",            elite:"Morning meditation + journaling + gratitude list" },
  { id:"c08", cat:"🧘 Mind",     easy:"Write 3 things you are grateful for",             medium:"Write a full journal entry about your goals",    hard:"Journal + identify one habit to cut this week",    elite:"Full reflection: wins, losses, and action plan" },
  // Learning
  { id:"c09", cat:"📚 Learn",    easy:"Read for 15 minutes",                             medium:"Read for 30 minutes uninterrupted",               hard:"Read 1 full chapter of a non-fiction book",        elite:"Read + summarise key takeaways in writing" },
  { id:"c10", cat:"📚 Learn",    easy:"Watch one educational video",                     medium:"Complete one online lesson or tutorial",          hard:"Finish a full course module",                      elite:"Teach something you learned to someone else" },
  // Environment
  { id:"c11", cat:"🏠 Space",    easy:"Tidy your desk before starting work",             medium:"Clean your full workspace",                      hard:"Declutter one room or area of your home",          elite:"Full home reset — every room tidy before bed" },
  { id:"c12", cat:"🏠 Space",    easy:"Make your bed first thing in the morning",        medium:"Make bed + tidy bedroom before leaving it",      hard:"Morning routine complete before touching your phone",elite:"No phone for the first hour of the day" },
  // Social
  { id:"c13", cat:"🤝 Social",   easy:"Message one friend or family member",             medium:"Have a meaningful phone or video call",          hard:"Plan and commit to a social event this week",      elite:"Reach out to 3 people you haven't spoken to in a month" },
  // Finance
  { id:"c14", cat:"💰 Finance",  easy:"Review your spending from yesterday",             medium:"Log all spending for the day",                   hard:"Review budget and identify one expense to cut",    elite:"Full financial audit: income, expenses, savings rate" },
  // Custom placeholder
  { id:"c15", cat:"⚡ Custom",   easy:"",                                                medium:"",                                               hard:"",                                                  elite:"" },
];


// ── Challenges Tab ────────────────────────────────────────────────────────
function ChallengesTab({ onBonusEarned }) {
  const tk = todayKey();
  const uk = useUK();
  const [active, setActive]       = usePersist(`${uk}_challenge_active_${tk}`, null);
  const [completed, setCompleted] = usePersist(`${uk}_challenge_done_${tk}`, []);
  const [bonusTotal, setBonusTotal] = usePersist(`${uk}_challenge_bonus_${tk}`, 0);

  const [pickMode, setPickMode]           = useState(false);
  const [customText, setCustomText]       = useState("");
  const [selectedDiff, setSelectedDiff]   = useState("medium");
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  const startChallenge = (challenge, diff, customTaskText) => {
    const taskText = challenge.id === "c15" ? customTaskText : challenge[diff];
    setActive({ id: challenge.id, diff, task: taskText, cat: challenge.cat, bonusPts: DIFF_CONFIG[diff].bonusPts });
    setPickMode(false);
    setSelectedChallenge(null);
    setCustomText("");
  };

  const completeChallenge = () => {
    if (!active) return;
    setCompleted(d => [...(Array.isArray(d)?d:[]), { ...active, completedAt: Date.now(), earnedPts: active.bonusPts }]);
    setBonusTotal(t => (typeof t==="number"?t:0) + active.bonusPts);
    onBonusEarned(active.bonusPts);
    setActive(null);
  };

  const abandonChallenge = () => setActive(null);

  const pickRandom = () => {
    const pool = CHALLENGE_POOL.filter(ch => ch.id !== "c15" && ch[selectedDiff]);
    setSelectedChallenge(pool[Math.floor(Math.random() * pool.length)]);
  };

  const safeCompleted = Array.isArray(completed) ? completed : [];

  return (
    <div>
      <div className="prow"><div className="ptitle">⚡ Daily Challenge</div></div>

      {/* Bonus banner */}
      {(typeof bonusTotal==="number"&&bonusTotal>0) && (
        <div className="ch-bonus-banner">
          <span>🏆 Bonus earned today</span>
          <span className="ch-bonus-pts">+{bonusTotal} pts</span>
        </div>
      )}

      {/* ── Active challenge ── */}
      {active && (
        <div className={`ch-active-card diff-${active.diff}`}>
          <div className="ch-active-top">
            <div className="ch-active-cat">{active.cat}</div>
            <div className="ch-diff-badge" style={{background:DIFF_CONFIG[active.diff].color}}>
              {DIFF_CONFIG[active.diff].emoji} {DIFF_CONFIG[active.diff].label}
            </div>
          </div>
          <div className="ch-active-task">{active.task}</div>
          <div className="ch-active-reward">
            🎯 Complete this challenge for <strong style={{color:"var(--gold)"}}>+{active.bonusPts} bonus pts</strong>
          </div>
          <div className="ch-active-btns">
            <button className="ch-btn-complete" onClick={completeChallenge}>✓ Mark Complete</button>
            <button className="ch-btn-abandon" onClick={abandonChallenge}>✕ Abandon</button>
          </div>
        </div>
      )}

      {/* ── Start panel ── */}
      {!active && !pickMode && !selectedChallenge && (
        <div className="ch-start-panel">
          <div className="ch-start-icon">⚡</div>
          <div className="ch-start-title">Start a Challenge</div>
          <div className="ch-start-sub">Pick a difficulty, then choose or randomise a challenge. Complete it for bonus points.</div>

          <div className="ch-diff-row">
            {Object.entries(DIFF_CONFIG).map(([k,v])=>(
              <div key={k} className={`ch-diff-opt${selectedDiff===k?" on":""}`}
                onClick={()=>setSelectedDiff(k)} style={{"--dclr":v.color}}>
                <div className="ch-diff-emoji">{v.emoji}</div>
                <div className="ch-diff-name">{v.label}</div>
                <div className="ch-diff-pts">+{v.bonusPts}pts</div>
                <div className="ch-diff-time">{v.desc}</div>
              </div>
            ))}
          </div>

          <div className="ch-action-row">
            <button className="ch-btn-random" onClick={pickRandom}>🎲 Random</button>
            <button className="ch-btn-browse" onClick={()=>setPickMode(true)}>📋 Browse All</button>
          </div>

          <div className="ch-custom-wrap">
            <div className="ch-custom-label">✍️ Custom Challenge</div>
            <input className="ch-custom-inp" placeholder="Describe your own challenge…"
              value={customText} onChange={e=>setCustomText(e.target.value)}/>
            <button className="ch-btn-custom"
              disabled={!customText.trim()}
              onClick={()=>customText.trim()&&startChallenge(CHALLENGE_POOL.find(ch=>ch.id==="c15"), selectedDiff, customText.trim())}>
              Start Custom
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm selected challenge ── */}
      {!active && selectedChallenge && (
        <div className="ch-confirm-card">
          <div className="ch-confirm-cat">{selectedChallenge.cat}</div>
          <div className="ch-confirm-task">{selectedChallenge[selectedDiff]}</div>
          <div className="ch-confirm-meta">
            <span className="ch-diff-badge" style={{background:DIFF_CONFIG[selectedDiff].color}}>
              {DIFF_CONFIG[selectedDiff].emoji} {DIFF_CONFIG[selectedDiff].label}
            </span>
            <span className="ch-confirm-reward">+{DIFF_CONFIG[selectedDiff].bonusPts} pts on completion</span>
          </div>
          <div className="ch-confirm-btns">
            <button className="ch-btn-start" onClick={()=>startChallenge(selectedChallenge, selectedDiff)}>⚡ Start Challenge</button>
            <button className="ch-btn-abandon" onClick={()=>setSelectedChallenge(null)}>Back</button>
          </div>
        </div>
      )}

      {/* ── Browse all ── */}
      {!active && pickMode && (
        <div className="ch-browse-panel">
          <div className="ch-browse-hdr">
            <span>📋 Choose a Challenge</span>
            <button className="ch-browse-close" onClick={()=>setPickMode(false)}>✕</button>
          </div>
          <div className="ch-browse-diff-row">
            {Object.entries(DIFF_CONFIG).map(([k,v])=>(
              <button key={k} className={`ch-browse-diff${selectedDiff===k?" on":""}`}
                style={{"--dclr":v.color}} onClick={()=>setSelectedDiff(k)}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>
          <div className="ch-browse-list">
            {CHALLENGE_POOL.filter(ch=>ch.id!=="c15"&&ch[selectedDiff]).map(ch=>(
              <div key={ch.id} className="ch-browse-item"
                onClick={()=>{setSelectedChallenge(ch);setPickMode(false);}}>
                <div className="ch-browse-cat">{ch.cat}</div>
                <div className="ch-browse-task">{ch[selectedDiff]}</div>
                <div className="ch-browse-arrow">›</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Completed today ── */}
      {safeCompleted.length > 0 && (
        <div className="ch-done-section">
          <div className="ch-done-hdr">✅ Completed Today</div>
          {[...safeCompleted].reverse().map((ch,i)=>(
            <div key={i} className="ch-done-item">
              <div className="ch-done-cat">{ch.cat}</div>
              <div className="ch-done-task">{ch.task}</div>
              <div className="ch-done-pts" style={{color:"var(--gold)"}}>+{ch.earnedPts} pts</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0e0e0f;--sf:#18181b;--sf2:#222227;--bd:#2e2e35;
    --gold:#d4a84b;--gdim:#9a7432;--red:#e05252;--grn:#4caf88;--blue:#5b9bd4;
    --tx:#e8e6df;--mt:#7a7870;
    --fd:'DM Serif Display',serif;--fb:'DM Sans',sans-serif;--fm:'DM Mono',monospace;
  }
  body{background:var(--bg);color:var(--tx);font-family:var(--fb);}
  .app{min-height:100vh;max-width:980px;margin:0 auto;padding:24px 16px 80px;}

  /* Header */
  .hdr{display:flex;align-items:center;gap:14px;margin-bottom:24px;border-bottom:1px solid var(--bd);padding-bottom:18px;}
  .hdr h1{font-family:var(--fd);font-size:2rem;color:var(--gold);letter-spacing:-0.5px;}
  .hdr-date{font-size:0.7rem;color:var(--mt);font-family:var(--fm);text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;}
  .hdr-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
  .score-pill{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:5px 12px;text-align:center;}
  .score-num{font-family:var(--fd);font-size:1.4rem;color:var(--gold);line-height:1;}
  .score-lbl{font-size:0.6rem;color:var(--mt);text-transform:uppercase;letter-spacing:0.1em;margin-top:1px;}
  .reset-day-btn{background:none;border:1px solid var(--bd);border-radius:7px;padding:6px 10px;color:var(--mt);font-family:var(--fb);cursor:pointer;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1;}
  .reset-day-btn:hover{border-color:var(--red);color:var(--red);}
  .rdb-icon{font-size:0.95rem;}
  .rdb-lbl{font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;}

  /* Confirm modal */
  .confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:200;animation:fi 0.15s ease;}
  .confirm-box{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:26px 26px 20px;max-width:360px;width:92%;animation:fi 0.18s ease;}
  .confirm-icon{font-size:1.7rem;margin-bottom:9px;}
  .confirm-title{font-family:var(--fd);font-size:1.2rem;color:var(--tx);margin-bottom:7px;}
  .confirm-desc{font-size:0.8rem;color:var(--mt);line-height:1.6;margin-bottom:7px;}
  .confirm-list{margin:5px 0 16px;padding-left:14px;}
  .confirm-list li{font-size:0.76rem;color:var(--mt);margin-bottom:3px;line-height:1.4;}
  .confirm-btns{display:flex;gap:8px;justify-content:flex-end;}
  .confirm-cancel{background:var(--sf2);border:1px solid var(--bd);border-radius:7px;padding:8px 16px;color:var(--mt);font-family:var(--fb);font-size:0.8rem;cursor:pointer;transition:all 0.15s;}
  .confirm-cancel:hover{color:var(--tx);border-color:var(--gdim);}
  .confirm-ok{background:var(--red);border:none;border-radius:7px;padding:8px 18px;color:#fff;font-family:var(--fb);font-weight:600;font-size:0.8rem;cursor:pointer;transition:opacity 0.15s;}
  .confirm-ok:hover{opacity:0.85;}

  /* Nav */
  .nav{display:flex;gap:4px;margin-bottom:20px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:4px;overflow-x:auto;scrollbar-width:none;}
  .nav::-webkit-scrollbar{display:none;}
  .nb{flex:1;min-width:0;padding:7px 4px 6px;border:none;border-radius:8px;background:transparent;color:var(--mt);font-family:var(--fb);font-size:0.62rem;font-weight:500;cursor:pointer;transition:all 0.18s;white-space:nowrap;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1;}
  .nb-ico{font-size:1.05rem;line-height:1;}
  .nb-lbl{font-size:0.58rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.8;}
  .nb.on{background:var(--sf2);color:var(--gold);border:1px solid var(--bdg,var(--gdim));}
  .nb.on .nb-lbl{opacity:1;}
  .nb:hover:not(.on){color:var(--tx);background:rgba(255,255,255,0.03);}

  /* Panel */
  .prow{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:18px;}
  .ptitle{font-family:var(--fd);font-size:1.25rem;color:var(--tx);font-style:italic;}
  .pact{background:none;border:1px solid var(--bd);border-radius:6px;padding:4px 11px;color:var(--mt);font-family:var(--fb);font-size:0.73rem;cursor:pointer;transition:all 0.15s;}
  .pact:hover,.pact.on{border-color:var(--gdim);color:var(--gold);}

  /* ══ WII PROGRESS GRAPH ══ */
  .wii-wrap{background:linear-gradient(180deg,#3a7bd5 0%,#1d5cb8 45%,#0e3d8a 100%);border-radius:14px;padding:14px 14px 14px;margin-bottom:20px;border:1px solid rgba(120,170,255,0.2);box-shadow:0 6px 32px rgba(0,0,80,0.5),inset 0 1px 0 rgba(255,255,255,0.12);}
  .wii-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
  .wii-title{font-family:'Arial Rounded MT Bold','Trebuchet MS','Arial',sans-serif;font-size:1rem;font-weight:700;color:#fff;letter-spacing:0.02em;text-shadow:0 1px 6px rgba(0,0,0,0.4);}
  .wii-rank{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:2px 11px;font-size:0.68rem;font-family:var(--fm);letter-spacing:0.12em;color:#fde68a;text-transform:uppercase;}
  .wii-rank.pro{color:#fbbf24;border-color:rgba(251,191,36,0.55);background:rgba(251,191,36,0.12);}
  .wii-svg{width:100%;display:block;overflow:visible;}
  .wii-stats{display:flex;gap:0;margin-top:12px;border-top:1px solid rgba(255,255,255,0.15);padding-top:11px;}
  .wii-stat{flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.1);}
  .wii-stat:last-child{border-right:none;}
  .wii-stat .val{font-family:var(--fm);font-size:1rem;color:#fff;line-height:1;font-weight:600;}
  .wii-stat .lbl{font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.6);margin-top:3px;}

  /* Home quick cards */
  .home-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
  .hc{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;text-align:center;}
  .hc .hcv{font-family:var(--fd);font-size:1.5rem;color:var(--gold);line-height:1;}
  .hc .hcl{font-size:0.63rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);margin-top:4px;}
  .home-msg{background:var(--sf);border:1px solid var(--bd);border-left:3px solid var(--gold);border-radius:8px;padding:12px 15px;font-size:0.82rem;color:var(--mt);font-style:italic;line-height:1.5;}

  /* Tasks */
  .ti-row{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;}
  .ti{flex:1;min-width:140px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:10px 14px;color:var(--tx);font-family:var(--fb);font-size:0.9rem;outline:none;transition:border 0.15s;}
  .ti:focus{border-color:var(--gdim);} .ti::placeholder{color:var(--mt);}
  .psel{background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:10px;color:var(--tx);font-family:var(--fb);font-size:0.85rem;cursor:pointer;outline:none;}
  .abtn{background:var(--gold);color:#0e0e0f;border:none;border-radius:8px;padding:10px 16px;font-family:var(--fb);font-weight:600;font-size:0.85rem;cursor:pointer;transition:opacity 0.15s;white-space:nowrap;}
  .abtn:hover{opacity:0.85;}
  .tlist{display:flex;flex-direction:column;gap:7px;}
  .titem{display:flex;align-items:center;gap:11px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:11px 13px;transition:opacity 0.2s;}
  .titem.dn{opacity:0.42;}
  .tcb{width:18px;height:18px;border-radius:5px;border:2px solid var(--bd);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}
  .tcb.chk{background:var(--grn);border-color:var(--grn);}
  .ttx{flex:1;font-size:0.87rem;line-height:1.4;} .ttx.x{text-decoration:line-through;color:var(--mt);}
  .pdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .dbtn{background:none;border:none;color:var(--mt);cursor:pointer;font-size:1.1rem;opacity:0;transition:opacity 0.15s;padding:0 2px;}
  .titem:hover .dbtn{opacity:1;}
  .t-empty{text-align:center;color:var(--mt);font-size:0.84rem;padding:28px 0;font-style:italic;}

  /* Pomodoro */
  .pw{display:flex;flex-direction:column;align-items:center;gap:20px;padding:6px 0;}
  .pring{position:relative;width:190px;height:190px;}
  .psvg{width:100%;height:100%;transform:rotate(-90deg);}
  .ptrk{fill:none;stroke:var(--sf2);stroke-width:8;}
  .pprog{fill:none;stroke:var(--gold);stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset 0.5s linear;}
  .pprog.brk{stroke:var(--grn);}
  .ptime{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .pdigs{font-family:var(--fm);font-size:2.3rem;color:var(--tx);letter-spacing:0.05em;}
  .pmlbl{font-size:0.63rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--mt);margin-top:4px;}
  .pctrls{display:flex;gap:10px;}
  .pbtn{background:var(--sf);border:1px solid var(--bd);border-radius:50px;padding:9px 26px;color:var(--tx);font-family:var(--fb);font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.15s;}
  .pbtn:hover{border-color:var(--gdim);color:var(--gold);}
  .pbtn.pri{background:var(--gold);color:#0e0e0f;border-color:var(--gold);font-weight:600;}
  .pbtn.pri:hover{opacity:0.85;}
  .pstats{display:flex;gap:26px;}
  .pst .num{font-family:var(--fd);font-size:1.5rem;color:var(--gold);text-align:center;}
  .pst .lbl{font-size:0.63rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);text-align:center;}
  .ptip{background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:13px 17px;width:100%;max-width:400px;}
  .ptip-t{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--mt);margin-bottom:5px;}
  .ptip-b{font-size:0.81rem;color:var(--tx);line-height:1.5;font-style:italic;}
  .sett{background:var(--sf);border:1px solid var(--gdim);border-radius:10px;padding:17px 19px;width:100%;max-width:420px;animation:fi 0.18s ease;}
  @keyframes fi{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .sett-title{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.14em;color:var(--mt);margin-bottom:13px;}
  .sett-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
  .sett-label{font-size:0.84rem;color:var(--tx);}
  .sett-sub{font-size:0.68rem;color:var(--mt);margin-top:2px;}
  .stepr{display:flex;align-items:center;gap:7px;}
  .step-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:6px;width:28px;height:28px;color:var(--tx);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;user-select:none;transition:all 0.15s;}
  .step-btn:hover{border-color:var(--gdim);color:var(--gold);}
  .step-val{font-family:var(--fm);font-size:0.93rem;color:var(--gold);min-width:34px;text-align:center;}
  .divdr{height:1px;background:var(--bd);margin:11px 0;}
  .apply-btn{background:var(--gold);color:#0e0e0f;border:none;border-radius:7px;padding:9px 16px;font-family:var(--fb);font-weight:600;font-size:0.81rem;cursor:pointer;width:100%;transition:opacity 0.15s;}
  .apply-btn:hover{opacity:0.85;}
  .sound-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:11px;}
  .snd-opt{background:var(--sf2);border:1px solid var(--bd);border-radius:7px;padding:7px 5px;text-align:center;cursor:pointer;transition:all 0.15s;}
  .snd-opt:hover{border-color:var(--gdim);}
  .snd-opt.on{border-color:var(--gold);background:rgba(212,168,75,0.08);}
  .snd-name{font-size:0.78rem;font-weight:500;color:var(--tx);}
  .snd-desc{font-size:0.63rem;color:var(--mt);margin-top:2px;}
  .vol-row{display:flex;align-items:center;gap:9px;}
  .vol-lbl{font-size:0.78rem;color:var(--mt);white-space:nowrap;}
  .vol-slider{flex:1;accent-color:var(--gold);cursor:pointer;}
  .test-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:5px 11px;color:var(--mt);font-family:var(--fb);font-size:0.73rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
  .test-btn:hover{border-color:var(--gdim);color:var(--gold);}

  /* ══ UNIFIED HABIT CARDS ══ */
  .habit-list{display:flex;flex-direction:column;gap:7px;}
  .ucard{background:var(--sf);border:1px solid var(--bd);border-radius:10px;overflow:hidden;transition:border-color 0.2s,background 0.2s;}
  .ucard.done{border-color:rgba(76,175,136,0.45);background:rgba(76,175,136,0.03);}
  .ucard-hdr{display:flex;align-items:center;gap:11px;padding:12px 15px;user-select:none;}
  .ucard-hdr.simple{cursor:pointer;transition:background 0.15s;}
  .ucard-hdr.simple:hover{background:var(--sf2);}
  .ucard-expand{display:flex;align-items:center;gap:11px;flex:1;cursor:pointer;min-width:0;}
  .ucard-expand:hover .u-chevron{color:var(--gold);}
  .ucb{width:20px;height:20px;flex-shrink:0;border-radius:6px;border:2px solid var(--bd);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
  .ucb.chk{background:var(--grn);border-color:var(--grn);}
  .ucb:hover:not(.chk){border-color:var(--grn);}
  .u-emoji{font-size:1rem;flex-shrink:0;}
  .u-name{font-size:0.87rem;font-weight:500;flex:1;min-width:0;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .u-name.x{text-decoration:line-through;color:var(--mt);}
  .u-summary{font-size:0.72rem;color:var(--gold);font-family:var(--fm);white-space:nowrap;flex-shrink:0;padding:2px 7px;background:rgba(212,168,75,0.08);border-radius:5px;}
  .u-chevron{color:var(--mt);font-size:0.7rem;transition:transform 0.2s,color 0.15s;flex-shrink:0;}
  .u-chevron.open{transform:rotate(180deg);}
  .ucard-body{padding:4px 15px 15px;border-top:1px solid var(--bd);animation:fi 0.15s ease;}

  /* Tracker internals */
  .trk-row{display:flex;align-items:center;gap:9px;margin-top:11px;flex-wrap:wrap;}
  .trk-log{margin-top:9px;display:flex;flex-direction:column;gap:5px;max-height:130px;overflow-y:auto;}
  .trk-entry{display:flex;align-items:center;gap:7px;background:var(--sf2);border-radius:6px;padding:6px 9px;font-size:0.79rem;}
  .trk-entry-text{flex:1;color:var(--tx);}
  .trk-entry-val{font-family:var(--fm);font-size:0.74rem;color:var(--gold);}
  .trk-entry-del{background:none;border:none;color:var(--mt);cursor:pointer;font-size:0.82rem;opacity:0.5;transition:opacity 0.15s;}
  .trk-entry-del:hover{opacity:1;color:var(--red);}
  .trk-total{margin-top:9px;background:var(--sf2);border-radius:8px;padding:9px 13px;display:flex;gap:18px;flex-wrap:wrap;}
  .trk-tot-item .val{font-family:var(--fm);font-size:1.05rem;color:var(--gold);}
  .trk-tot-item .lbl{font-size:0.63rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);}
  .trk-goal-bar{margin-top:9px;}
  .trk-goal-bar .bar{height:5px;background:var(--bd);border-radius:3px;overflow:hidden;margin-top:4px;}
  .trk-goal-bar .fill{height:100%;background:linear-gradient(90deg,var(--gdim),var(--gold));border-radius:3px;transition:width 0.4s;}
  .trk-mini-inp{background:var(--sf2);border:1px solid var(--bd);border-radius:7px;padding:6px 9px;color:var(--tx);font-family:var(--fb);font-size:0.84rem;outline:none;transition:border 0.15s;min-width:0;}
  .trk-mini-inp:focus{border-color:var(--gdim);} .trk-mini-inp::placeholder{color:var(--mt);}
  .trk-mini-inp.w80{width:80px;}
  .unit-tog{display:flex;border:1px solid var(--bd);border-radius:7px;overflow:hidden;}
  .unit-opt{padding:5px 11px;font-size:0.77rem;font-weight:500;cursor:pointer;background:var(--sf2);color:var(--mt);border:none;font-family:var(--fb);transition:all 0.15s;}
  .unit-opt.on{background:var(--gdim);color:#0e0e0f;}
  .qk-btns{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}
  .qk-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:4px 9px;font-size:0.73rem;color:var(--mt);cursor:pointer;font-family:var(--fb);transition:all 0.15s;}
  .qk-btn:hover{border-color:var(--gdim);color:var(--gold);}
  .smol-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:6px 11px;color:var(--mt);font-family:var(--fb);font-size:0.77rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
  .smol-btn:hover{border-color:var(--gdim);color:var(--gold);}
  .smol-btn.gold{background:rgba(212,168,75,0.12);border-color:var(--gdim);color:var(--gold);}

  /* Mood tracker */
  .mood-opts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
  .mood-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;cursor:pointer;transition:all 0.15s;text-align:center;flex:1;min-width:46px;}
  .mood-btn:hover{border-color:var(--gdim);}
  .mood-btn.on{border-color:var(--gold);background:rgba(212,168,75,0.1);}
  .mood-emoji{font-size:1.3rem;line-height:1;}
  .mood-lbl{font-size:0.6rem;color:var(--mt);margin-top:3px;}

  /* Sleep stars */
  .star-row{display:flex;gap:4px;margin-top:4px;}
  .star{font-size:1.2rem;cursor:pointer;filter:grayscale(1);transition:filter 0.15s;}
  .star.on{filter:grayscale(0);}

  /* Progress bar (habits) */
  .hab-prog{margin-top:13px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:13px 17px;}
  .hab-prog-lbl{font-size:0.7rem;color:var(--mt);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:7px;display:flex;justify-content:space-between;}
  .hpbar{height:5px;background:var(--sf2);border-radius:3px;overflow:hidden;}
  .hpfill{height:100%;background:linear-gradient(90deg,var(--gdim),var(--gold));border-radius:3px;transition:width 0.4s cubic-bezier(.4,0,.2,1);}

  /* Manage habits */
  .trk-section{margin-top:18px;}
  .trk-section-hdr{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.16em;color:var(--mt);margin-bottom:11px;display:flex;align-items:center;gap:7px;}
  .trk-section-hdr::before{content:'';flex:1;height:1px;background:var(--bd);}
  .trk-section-hdr::after{content:'';flex:1;height:1px;background:var(--bd);}
  .trk-card{background:var(--sf);border:1px solid var(--bd);border-radius:10px;overflow:hidden;}
  .trk-hdr{display:flex;align-items:center;gap:9px;padding:13px 15px;cursor:pointer;user-select:none;transition:background 0.15s;}
  .trk-hdr:hover{background:var(--sf2);}
  .trk-ico{font-size:1.05rem;}
  .trk-name{font-size:0.87rem;font-weight:600;flex:1;}
  .trk-summary{font-size:0.73rem;color:var(--gold);font-family:var(--fm);}
  .trk-chevron{color:var(--mt);font-size:0.73rem;transition:transform 0.2s;}
  .trk-chevron.open{transform:rotate(180deg);}
  .trk-body{padding:0 15px 15px;border-top:1px solid var(--bd);animation:fi 0.15s ease;}
  .mh-row{display:flex;align-items:center;gap:9px;background:var(--sf2);border-radius:7px;padding:8px 11px;margin-bottom:5px;}
  .mh-emoji{font-size:0.95rem;flex-shrink:0;}
  .mh-name{flex:1;font-size:0.84rem;color:var(--tx);}
  .mh-tag{font-size:0.66rem;color:var(--mt);background:var(--bg);border:1px solid var(--bd);border-radius:5px;padding:2px 5px;white-space:nowrap;}
  .mh-del{background:none;border:none;color:var(--mt);cursor:pointer;font-size:0.88rem;padding:2px 4px;border-radius:4px;opacity:0.5;transition:all 0.15s;}
  .mh-del:hover{opacity:1;color:var(--red);}
  .mh-divider{height:1px;background:var(--bd);margin:13px 0 11px;}
  .mh-add-ttl{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.14em;color:var(--mt);margin-bottom:9px;}
  .mh-add-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
  .esel{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:7px 5px;font-size:1rem;color:var(--tx);cursor:pointer;outline:none;}
  .tsel{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:0.78rem;color:var(--tx);cursor:pointer;outline:none;font-family:var(--fb);}
  .hni{flex:1;min-width:90px;background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:7px 11px;color:var(--tx);font-family:var(--fb);font-size:0.84rem;outline:none;transition:border 0.15s;}
  .hni:focus{border-color:var(--gdim);} .hni::placeholder{color:var(--mt);}

  /* ══ NUTRITION TAB ══ */
  .nutr-macro-bar{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:15px 17px;margin-bottom:12px;}
  .nutr-cal-row{display:flex;align-items:baseline;gap:6px;margin-bottom:11px;}
  .nutr-cal-num{font-family:var(--fd);font-size:2rem;color:var(--gold);line-height:1;}
  .nutr-cal-goal{font-size:0.78rem;color:var(--mt);}
  .nutr-cal-bar{height:8px;background:var(--sf2);border-radius:4px;overflow:hidden;margin-bottom:13px;}
  .nutr-cal-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gdim),var(--gold));transition:width 0.4s;}
  .nutr-cal-fill.over{background:linear-gradient(90deg,#c0392b,var(--red));}
  .nutr-macros{display:flex;gap:10px;}
  .nutr-macro{flex:1;}
  .nutr-macro-lbl{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);margin-bottom:4px;display:flex;justify-content:space-between;}
  .nutr-macro-lbl span:last-child{color:var(--tx);font-family:var(--fm);}
  .nutr-macro-track{height:5px;background:var(--sf2);border-radius:3px;overflow:hidden;}
  .nutr-macro-fill{height:100%;border-radius:3px;transition:width 0.4s;}
  .nutr-search-row{display:flex;gap:7px;margin-bottom:10px;align-items:center;}
  .nutr-search{flex:1;background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:9px 13px;color:var(--tx);font-family:var(--fb);font-size:0.88rem;outline:none;transition:border 0.15s;}
  .nutr-search:focus{border-color:var(--gdim);} .nutr-search::placeholder{color:var(--mt);}
  .nutr-food-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:240px;overflow-y:auto;margin-bottom:12px;}
  .nutr-food-btn{background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:9px 11px;cursor:pointer;transition:all 0.15s;text-align:left;}
  .nutr-food-btn:hover{border-color:var(--gdim);}
  .nutr-food-name{font-size:0.78rem;font-weight:500;color:var(--tx);line-height:1.3;}
  .nutr-food-cals{font-size:0.68rem;font-family:var(--fm);color:var(--gold);margin-top:2px;}
  .nutr-food-macros{font-size:0.63rem;color:var(--mt);margin-top:1px;}
  .nutr-custom-form{background:var(--sf);border:1px solid var(--gdim);border-radius:10px;padding:14px 16px;margin-bottom:12px;animation:fi 0.18s ease;}
  .nutr-cf-title{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--mt);margin-bottom:10px;}
  .nutr-cf-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px;}
  .nutr-cf-inp{background:var(--sf2);border:1px solid var(--bd);border-radius:7px;padding:7px 10px;color:var(--tx);font-family:var(--fb);font-size:0.83rem;outline:none;transition:border 0.15s;min-width:0;}
  .nutr-cf-inp:focus{border-color:var(--gdim);}
  .nutr-cf-inp::placeholder{color:var(--mt);}
  .nutr-log{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;}
  .nutr-log-entry{display:flex;align-items:center;gap:10px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:9px 12px;}
  .nutr-log-name{flex:1;font-size:0.83rem;color:var(--tx);}
  .nutr-log-cals{font-family:var(--fm);font-size:0.78rem;color:var(--gold);white-space:nowrap;}
  .nutr-log-macros{font-size:0.68rem;color:var(--mt);white-space:nowrap;}
  .nutr-log-del{background:none;border:none;color:var(--mt);cursor:pointer;font-size:0.85rem;opacity:0.5;transition:opacity 0.15s;padding:0 2px;}
  .nutr-log-del:hover{opacity:1;color:var(--red);}
  .nutr-empty{text-align:center;color:var(--mt);font-size:0.83rem;padding:24px 0;font-style:italic;}
  .nutr-goals-form{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;animation:fi 0.18s ease;}
  .nutr-goals-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
  .nutr-goal-item label{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);display:block;margin-bottom:5px;}

  /* Tips */
  .tips-list{display:flex;flex-direction:column;gap:11px;}
  .tip-card{background:var(--sf);border:1px solid var(--bd);border-left:3px solid var(--gold);border-radius:8px;padding:13px 15px;}
  .tip-t{font-weight:600;font-size:0.87rem;color:var(--gold);margin-bottom:3px;}
  .tip-b{font-size:0.81rem;color:var(--mt);line-height:1.55;}

  @media(max-width:480px){
    .hdr h1{font-size:1.6rem;}
    .rdb-lbl{display:none;}
    .sound-grid{grid-template-columns:1fr 1fr;}
    .mh-add-row{flex-direction:column;align-items:stretch;}
    .mh-add-row .abtn{width:100%;}
    .nutr-food-grid{grid-template-columns:1fr;}
    .home-cards{grid-template-columns:repeat(3,1fr);}
    .nutr-macros{flex-direction:column;}
  }
  /* ══ CHALLENGES ══ */
  .ch-bonus-banner{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,rgba(212,168,75,0.15),rgba(212,168,75,0.05));border:1px solid rgba(212,168,75,0.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;}
  .ch-bonus-pts{font-family:var(--fm);font-size:1.1rem;color:var(--gold);font-weight:600;}

  .ch-start-panel{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:22px 18px;text-align:center;}
  .ch-start-icon{font-size:2.2rem;margin-bottom:8px;}
  .ch-start-title{font-family:var(--fd);font-size:1.3rem;color:var(--tx);margin-bottom:6px;}
  .ch-start-sub{font-size:0.78rem;color:var(--mt);line-height:1.5;margin-bottom:20px;}

  .ch-diff-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;}
  .ch-diff-opt{background:var(--sf2);border:2px solid var(--bd);border-radius:10px;padding:10px 6px;cursor:pointer;transition:all .15s;text-align:center;}
  .ch-diff-opt.on{border-color:var(--dclr,var(--gold));background:color-mix(in srgb,var(--dclr,var(--gold)) 12%,var(--sf2));}
  .ch-diff-emoji{font-size:1.3rem;margin-bottom:3px;}
  .ch-diff-name{font-size:0.72rem;font-weight:600;color:var(--tx);margin-bottom:2px;}
  .ch-diff-pts{font-size:0.7rem;font-family:var(--fm);color:var(--gold);}
  .ch-diff-time{font-size:0.6rem;color:var(--mt);margin-top:2px;}

  .ch-action-row{display:flex;gap:10px;margin-bottom:18px;}
  .ch-btn-random{flex:1;padding:11px;background:linear-gradient(135deg,#2a4d8a,#1a3060);border:1px solid rgba(91,155,212,0.3);border-radius:10px;color:#7ec8f4;font-size:0.84rem;font-weight:600;cursor:pointer;}
  .ch-btn-browse{flex:1;padding:11px;background:var(--sf2);border:1px solid var(--bd);border-radius:10px;color:var(--tx);font-size:0.84rem;cursor:pointer;}

  .ch-custom-wrap{background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:14px;text-align:left;}
  .ch-custom-label{font-size:0.76rem;color:var(--mt);margin-bottom:8px;font-weight:500;}
  .ch-custom-inp{width:100%;background:var(--bg);border:1px solid var(--bd);border-radius:8px;color:var(--tx);padding:9px 12px;font-size:0.83rem;font-family:var(--fs);margin-bottom:10px;outline:none;}
  .ch-custom-inp:focus{border-color:var(--gold);}
  .ch-btn-custom{width:100%;padding:10px;background:linear-gradient(135deg,rgba(212,168,75,0.2),rgba(212,168,75,0.08));border:1px solid rgba(212,168,75,0.4);border-radius:8px;color:var(--gold);font-size:0.84rem;font-weight:600;cursor:pointer;}
  .ch-btn-custom:disabled{opacity:0.35;cursor:not-allowed;}

  .ch-active-card{background:var(--sf);border-radius:14px;padding:18px;margin-bottom:14px;border:2px solid var(--bd);}
  .ch-active-card.diff-easy{border-color:rgba(76,175,136,0.4);}
  .ch-active-card.diff-medium{border-color:rgba(224,154,48,0.4);}
  .ch-active-card.diff-hard{border-color:rgba(224,82,82,0.4);}
  .ch-active-card.diff-elite{border-color:rgba(168,85,247,0.4);}
  .ch-active-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .ch-active-cat{font-size:0.76rem;color:var(--mt);font-weight:500;}
  .ch-diff-badge{padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;color:#fff;letter-spacing:0.04em;}
  .ch-active-task{font-size:1rem;color:var(--tx);font-weight:500;line-height:1.45;margin-bottom:14px;}

  .ch-active-reward{font-size:0.78rem;color:var(--mt);margin-bottom:14px;padding:8px 12px;background:var(--sf2);border-radius:8px;}
  .ch-active-btns{display:flex;gap:10px;}
  .ch-btn-complete{flex:2;padding:12px;background:linear-gradient(135deg,#1a5c38,#0f3820);border:1px solid rgba(76,175,136,0.4);border-radius:10px;color:#4caf88;font-size:0.88rem;font-weight:700;cursor:pointer;}
  .ch-btn-abandon{flex:1;padding:12px;background:var(--sf2);border:1px solid var(--bd);border-radius:10px;color:var(--mt);font-size:0.84rem;cursor:pointer;}

  .ch-confirm-card{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:20px;margin-bottom:14px;}
  .ch-confirm-cat{font-size:0.74rem;color:var(--mt);margin-bottom:8px;}
  .ch-confirm-task{font-size:1rem;color:var(--tx);font-weight:500;line-height:1.45;margin-bottom:14px;}
  .ch-confirm-meta{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;}
  .ch-confirm-reward{font-size:0.76rem;color:var(--mt);}
  .ch-confirm-btns{display:flex;gap:10px;}
  .ch-btn-start{flex:2;padding:13px;background:linear-gradient(135deg,#1a3d6e,#0e2448);border:1px solid rgba(91,155,212,0.4);border-radius:10px;color:#7ec8f4;font-size:0.9rem;font-weight:700;cursor:pointer;}

  .ch-browse-panel{background:var(--sf);border:1px solid var(--bd);border-radius:14px;overflow:hidden;margin-bottom:14px;}
  .ch-browse-hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--bd);font-weight:600;font-size:0.9rem;color:var(--tx);}
  .ch-browse-close{background:none;border:none;color:var(--mt);font-size:1rem;cursor:pointer;padding:4px;}
  .ch-browse-diff-row{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--bd);overflow-x:auto;}
  .ch-browse-diff{padding:5px 12px;border-radius:20px;border:1px solid var(--bd);background:var(--sf2);color:var(--mt);font-size:0.74rem;cursor:pointer;white-space:nowrap;transition:all .15s;}
  .ch-browse-diff.on{border-color:var(--dclr,var(--gold));color:var(--dclr,var(--gold));background:color-mix(in srgb,var(--dclr,var(--gold)) 12%,var(--sf2));}
  .ch-browse-list{max-height:340px;overflow-y:auto;}
  .ch-browse-item{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .1s;}
  .ch-browse-item:hover{background:var(--sf2);}
  .ch-browse-item:last-child{border-bottom:none;}
  .ch-browse-cat{font-size:0.68rem;color:var(--mt);min-width:72px;flex-shrink:0;}
  .ch-browse-task{flex:1;font-size:0.82rem;color:var(--tx);line-height:1.35;}
  .ch-browse-arrow{font-size:1.2rem;color:var(--mt);}

  .ch-done-section{margin-top:18px;}
  .ch-done-hdr{font-size:0.78rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--mt);margin-bottom:10px;font-family:var(--fm);}
  .ch-done-item{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;}
  .ch-done-cat{font-size:0.68rem;color:var(--mt);min-width:70px;flex-shrink:0;}
  .ch-done-task{flex:1;font-size:0.82rem;color:var(--mt);text-decoration:line-through;line-height:1.35;}
  .ch-done-pts{font-family:var(--fm);font-size:0.82rem;font-weight:600;flex-shrink:0;}

  /* ══ LOGIN ══ */
  @keyframes orb-drift{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(30px,-20px) scale(1.08);}}
  @keyframes card-in{from{opacity:0;transform:translateY(24px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(212,168,75,0.4);}70%{box-shadow:0 0 0 10px rgba(212,168,75,0);}100%{box-shadow:0 0 0 0 rgba(212,168,75,0);}}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden;}
  .login-bg{position:fixed;inset:0;pointer-events:none;z-index:0;}
  .login-orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:0.18;animation:orb-drift 8s ease-in-out infinite;}
  .orb1{width:420px;height:420px;background:radial-gradient(circle,#d4a84b,transparent);top:-80px;left:-100px;animation-delay:0s;}
  .orb2{width:320px;height:320px;background:radial-gradient(circle,#4a7fd4,transparent);bottom:-60px;right:-80px;animation-delay:-3s;}
  .orb3{width:260px;height:260px;background:radial-gradient(circle,#4caf88,transparent);top:40%;left:60%;animation-delay:-6s;}
  .login-card{position:relative;z-index:1;background:rgba(22,22,26,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.08);border-radius:22px;padding:36px 28px 28px;width:100%;max-width:400px;animation:card-in 0.5s cubic-bezier(0.16,1,0.3,1) both;box-shadow:0 32px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04);}
  .login-brand{text-align:center;margin-bottom:22px;}
  .login-icon-wrap{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:linear-gradient(135deg,rgba(212,168,75,0.2),rgba(212,168,75,0.05));border:1px solid rgba(212,168,75,0.3);border-radius:18px;margin-bottom:14px;animation:pulse-ring 2.5s ease-out infinite;}
  .login-icon{font-size:2rem;line-height:1;}
  .login-title{font-family:var(--fd);font-size:2.1rem;color:var(--tx);margin:0 0 6px;font-style:italic;background:linear-gradient(135deg,#fff 30%,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
  .login-sub{font-size:0.8rem;color:var(--mt);margin:0;line-height:1.5;letter-spacing:0.02em;}
  .login-stats{display:flex;align-items:center;justify-content:center;gap:0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 10px;margin-bottom:20px;}
  .login-stat{flex:1;text-align:center;}
  .login-stat-val{font-size:1.2rem;margin-bottom:3px;}
  .login-stat-lbl{font-size:0.62rem;color:var(--mt);text-transform:uppercase;letter-spacing:0.1em;}
  .login-stat-div{width:1px;height:30px;background:rgba(255,255,255,0.07);}
  .login-mode-row{display:flex;gap:5px;margin-bottom:18px;}
  .login-mode-btn{flex:1;padding:9px 4px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;background:rgba(255,255,255,0.03);color:var(--mt);font-family:var(--fb);font-size:0.72rem;font-weight:500;cursor:pointer;transition:all .18s;white-space:nowrap;}
  .login-mode-btn:hover{border-color:rgba(212,168,75,0.3);color:var(--tx);}
  .login-mode-btn.on{background:rgba(212,168,75,0.1);border-color:rgba(212,168,75,0.45);color:var(--gold);}
  .login-form{display:flex;flex-direction:column;gap:10px;}
  .login-field{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:11px;padding:12px 15px;transition:border-color .18s,background .18s;}
  .login-field.focus{border-color:rgba(212,168,75,0.5);background:rgba(212,168,75,0.04);}
  .login-field-icon{font-size:0.9rem;color:var(--mt);min-width:16px;text-align:center;transition:color .18s;}
  .login-field.focus .login-field-icon{color:var(--gold);}
  .login-field-inp{flex:1;background:transparent;border:none;outline:none;color:var(--tx);font-family:var(--fb);font-size:0.92rem;}
  .login-field-inp::placeholder{color:rgba(255,255,255,0.2);}
  .login-hint{font-size:0.74rem;color:var(--mt);margin:0;line-height:1.55;padding:0 2px;}
  .login-error{display:flex;align-items:center;gap:7px;background:rgba(224,82,82,0.1);border:1px solid rgba(224,82,82,0.25);border-radius:9px;padding:10px 13px;color:#e05252;font-size:0.78rem;}
  .login-btn{background:linear-gradient(135deg,#c9922a,var(--gold),#c9922a);background-size:200% auto;border:none;border-radius:11px;padding:14px;color:#0e0e0f;font-family:var(--fb);font-weight:700;font-size:0.92rem;cursor:pointer;transition:background-position .4s,opacity .15s,transform .12s;margin-top:4px;letter-spacing:0.02em;}
  .login-btn:hover:not(:disabled){background-position:right center;transform:translateY(-1px);}
  .login-btn:active:not(:disabled){transform:translateY(0);}
  .login-btn:disabled{opacity:0.35;cursor:not-allowed;}
  .login-pw-toggle{background:none;border:none;cursor:pointer;font-size:0.85rem;padding:0 2px;opacity:0.6;transition:opacity .15s;}
  .login-pw-toggle:hover{opacity:1;}
  .login-warn{margin-top:16px;background:rgba(224,154,48,0.08);border:1px solid rgba(224,154,48,0.2);border-radius:9px;padding:10px 13px;font-size:0.72rem;color:#e09a30;line-height:1.5;text-align:center;}

  /* ══ HEADER USER + LOGOUT ══ */
  .hdr-user{display:flex;align-items:center;gap:5px;cursor:pointer;padding:5px 9px;border:1px solid var(--bd);border-radius:8px;background:var(--sf2);transition:border-color .15s;}
  .hdr-user:hover{border-color:var(--gdim);}
  .hdr-username{font-size:0.75rem;color:var(--tx);font-family:var(--fb);font-weight:500;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .hdr-devbadge{font-size:0.58rem;background:rgba(168,85,247,0.2);color:#a855f7;border:1px solid rgba(168,85,247,0.4);border-radius:4px;padding:1px 5px;font-family:var(--fm);letter-spacing:0.08em;}
  .hdr-logout{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--mt);font-size:0.9rem;transition:all .15s;flex-shrink:0;}
  .hdr-logout:hover{border-color:rgba(224,82,82,0.4);color:#e05252;background:rgba(224,82,82,0.08);}

  /* ══ LEADERBOARD ══ */
  .lb-wrap{background:var(--sf);border:1px solid var(--bd);border-radius:14px;overflow:hidden;}
  .lb-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--bd);}
  .lb-title{font-family:var(--fd);font-size:1.15rem;color:var(--tx);font-style:italic;}
  .lb-refresh{background:var(--sf2);border:1px solid var(--bd);border-radius:7px;padding:5px 12px;color:var(--mt);font-family:var(--fb);font-size:0.76rem;cursor:pointer;transition:all .15s;}
  .lb-refresh:hover{border-color:var(--gdim);color:var(--gold);}
  .lb-myrank{padding:10px 18px;background:rgba(212,168,75,0.07);border-bottom:1px solid var(--bd);font-size:0.8rem;color:var(--mt);}
  .lb-offline,.lb-empty{padding:32px 18px;text-align:center;font-size:0.82rem;color:var(--mt);}
  .lb-list{display:flex;flex-direction:column;}
  .lb-row{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--bd);transition:background .12s;}
  .lb-row:last-child{border-bottom:none;}
  .lb-row:hover{background:var(--sf2);}
  .lb-row.me{background:rgba(212,168,75,0.07);}
  .lb-rank{font-family:var(--fm);font-size:0.9rem;min-width:26px;color:var(--mt);}
  .lb-name{flex:1;font-size:0.88rem;color:var(--tx);font-weight:500;display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;}
  .lb-dev-badge{font-size:0.58rem;background:rgba(168,85,247,0.2);color:#a855f7;border:1px solid rgba(168,85,247,0.4);border-radius:4px;padding:1px 5px;font-family:var(--fm);}
  .lb-you{font-size:0.63rem;background:rgba(212,168,75,0.18);color:var(--gold);border:1px solid rgba(212,168,75,0.3);border-radius:4px;padding:1px 6px;font-family:var(--fm);}
  .lb-score{font-family:var(--fm);font-size:0.95rem;color:var(--gold);font-weight:600;min-width:32px;text-align:right;}
  .lb-date{font-size:0.68rem;color:var(--mt);min-width:40px;text-align:right;}
  .lb-sync{padding:8px 18px;font-size:0.66rem;color:var(--mt);border-top:1px solid var(--bd);text-align:right;}

  /* ══ DEV PANEL ══ */
  .dev-section{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:16px 18px;margin-bottom:14px;}
  .dev-section-title{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.14em;color:var(--mt);margin-bottom:12px;}
  .dev-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;font-size:0.83rem;}
  .dev-lbl{color:var(--mt);}
  .dev-val{color:var(--tx);font-family:var(--fm);font-size:0.82rem;}
  .dev-btn{background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:9px 16px;color:var(--tx);font-family:var(--fb);font-size:0.82rem;cursor:pointer;width:100%;margin-top:6px;transition:all .15s;}
  .dev-btn:hover{border-color:var(--gdim);color:var(--gold);}
  .dev-btn-danger{background:rgba(224,82,82,0.1);border:1px solid rgba(224,82,82,0.3);border-radius:8px;padding:9px 16px;color:#e05252;font-family:var(--fb);font-size:0.82rem;cursor:pointer;width:100%;margin-top:6px;transition:all .15s;}
  .dev-btn-danger:hover{background:rgba(224,82,82,0.18);}

  /* ══ SIGN OUT ══ */
  .signout-btn{width:100%;padding:10px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--mt);font-family:var(--fb);font-size:0.8rem;cursor:pointer;margin-bottom:18px;transition:all .15s;}
  .signout-btn:hover{border-color:rgba(224,82,82,0.4);color:#e05252;}

`;

// ── Compound score engine ─────────────────────────────────────────────────
// Each day: compound += rawScore - penalty, where penalty = max(0, 100 - rawScore)
// So a 100 day = +100. A 90 day = +90 - 10 = net +80. A 0 day = -100 (floored at 0).
function buildCompoundHistory(safeHistory, todayDate, liveScore) {
  const realMap = {};
  safeHistory.forEach(e => { realMap[e.date] = e.score; });
  realMap[todayDate] = liveScore;
  const sorted = Object.keys(realMap).sort();
  let compound = 0;
  const result = [];
  for (const date of sorted) {
    const raw = realMap[date];
    const penalty = Math.max(0, 100 - raw);
    compound = Math.max(0, compound + raw - penalty);
    result.push({ date, raw, compound });
  }
  return result;
}

// ── Wii Progress Graph ────────────────────────────────────────────────────
function WiiProgressGraph({ score }) {
  const uk=useUK();
  const [history, setHistory] = usePersist(`${uk}_score_history_v3`, []);
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const today = todayKey();
    setHistory(h => {
      const arr = Array.isArray(h) ? h : [];
      const copy = [...arr];
      const idx  = copy.findIndex(e => e.date === today);
      const entry = { date: today, score };
      if (idx >= 0) copy[idx] = entry; else copy.push(entry);
      return copy.slice(-60);
    });
  }, [score]);

  useEffect(() => {
    setAnimPct(0);
    let start = null;
    const dur = 900;
    const tick = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setAnimPct(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const safeHistory = Array.isArray(history) ? history : [];
  const today = todayKey();
  const SHOW = 20;

  // Compound history
  const compound = buildCompoundHistory(safeHistory, today, score);
  const todayCompound = compound.length > 0 ? compound[compound.length-1].compound : 0;
  const prevCompound  = compound.length > 1  ? compound[compound.length-2].compound : null;
  const compoundDelta = prevCompound !== null ? Math.round(todayCompound - prevCompound) : null;

  // Map compound values by date for graph
  const compoundMap = {};
  compound.forEach(e => { compoundMap[e.date] = e.compound; });

  // Last SHOW days
  const days = Array.from({length: SHOW}, (_, i) => {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - (SHOW - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const graphPts = days.map(date => ({
    date,
    score: compoundMap[date] !== undefined ? compoundMap[date] : null,
  }));

  // Stats
  const realDays = safeHistory.filter(e => e.score !== undefined);
  const avgScore = realDays.length > 0
    ? Math.round(realDays.reduce((s,e)=>s+e.score,0)/realDays.length) : score;
  const streak = (()=>{
    let s = 0;
    const sorted = [...safeHistory].sort((a,b)=>a.date<b.date?1:-1);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].score >= 40) s++; else break;
    }
    return s;
  })();

  const rank      = todayCompound>=500?"PRO":todayCompound>=200?"ADV":todayCompound>=50?"INT":"BEG";
  const rankColor = todayCompound>=500?"#fbbf24":todayCompound>=200?"#60a5fa":todayCompound>=50?"#4ade80":"#f87171";

  // SVG — y-axis scales to compound total
  const maxY = Math.max(200, todayCompound * 1.25);
  const W=380, H=170, PL=42, PR=14, PT=18, PB=28;
  const gW=W-PL-PR, gH=H-PT-PB;
  const yS = v => PT + gH - (Math.max(0, Math.min(v, maxY)) / maxY) * gH;
  const xS = i => PL + (i / (SHOW - 1)) * gW;

  const allValid = graphPts
    .map((p, i) => p.score !== null ? { ...p, x: xS(i), y: yS(p.score), i } : null)
    .filter(Boolean);

  const visibleCount = Math.max(1, Math.round(allValid.length * animPct));
  const visible = allValid.slice(0, visibleCount);

  const lineStart = { x: PL, y: yS(0) };
  const allForPath = [lineStart, ...visible];
  const linePath = allForPath.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = allForPath.length > 1
    ? `${linePath} L${allForPath[allForPath.length-1].x.toFixed(1)},${(PT+gH).toFixed(1)} L${PL},${(PT+gH).toFixed(1)} Z`
    : null;

  const latest  = visible.length > 0 ? visible[visible.length - 1] : null;
  const bubbleW = 72, bubbleH = 22;
  const bx = latest ? Math.min(Math.max(latest.x - bubbleW/2, PL), W-PR-bubbleW) : PL+10;
  const by = latest ? Math.max(latest.y - bubbleH - 12, PT+2) : PT+2;

  const trendColor = compoundDelta === null ? "#1850c0"
    : compoundDelta > 0 ? "#1a9050"
    : compoundDelta < 0 ? "#c03030"
    : "#1850c0";

  // Y-axis labels (round numbers)
  const yLabels = [0, Math.round(maxY*0.25), Math.round(maxY*0.5), Math.round(maxY*0.75), Math.round(maxY)];

  return (
    <div className="wii-wrap">
      <div className="wii-header">
        <div className="wii-title">Lifetime Score</div>
        <div className="wii-rank" style={{color:rankColor,borderColor:`${rankColor}55`}}>{rank}</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:170,display:"block",
        background:"rgba(234,243,255,0.97)",borderRadius:8,
        boxShadow:"inset 0 1px 4px rgba(0,0,80,0.2),0 2px 12px rgba(0,0,0,0.35)"}}>
        <defs>
          <linearGradient id="wiiAreaG3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={`${trendColor}44`}/>
            <stop offset="100%" stopColor={`${trendColor}08`}/>
          </linearGradient>
          <clipPath id="wiiClip2">
            <rect x={PL} y={PT} width={gW} height={gH}/>
          </clipPath>
        </defs>

        <rect x={PL} y={PT} width={gW} height={gH} fill="rgba(200,220,255,0.22)"/>

        {/* Grid lines + y labels */}
        {yLabels.map(v=>(
          <g key={v}>
            <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)}
              stroke={v===0?"rgba(80,120,190,0.4)":"rgba(140,170,220,0.25)"}
              strokeWidth={v===0?"1":"0.7"}/>
            <text x={PL-3} y={yS(v)+3} fill="rgba(50,80,150,0.5)" fontSize="6"
              textAnchor="end" fontFamily="Arial,sans-serif">{v}</text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#wiiAreaG3)" clipPath="url(#wiiClip2)"/>}

        <path d={linePath} fill="none" stroke={trendColor} strokeWidth="2"
          strokeLinejoin="miter" strokeLinecap="square" clipPath="url(#wiiClip2)"/>

        {visible.map((p,i)=>{
          const isLast = i === visible.length-1;
          return (
            <circle key={p.date} cx={p.x} cy={p.y}
              r={isLast ? 4.5 : 2.5}
              fill={isLast ? trendColor : `${trendColor}bb`}
              stroke={isLast ? "white" : "none"} strokeWidth="1.5"/>
          );
        })}

        {/* Score bubble */}
        {latest && animPct > 0.7 && (
          <g style={{opacity: Math.min(1,(animPct-0.7)/0.3)}}>
            <line x1={latest.x} y1={latest.y-5} x2={bx+bubbleW/2} y2={by+bubbleH}
              stroke="rgba(20,60,190,0.35)" strokeWidth="1"/>
            <rect x={bx+1} y={by+2} width={bubbleW} height={bubbleH} rx={5}
              fill="rgba(0,20,80,0.12)"/>
            <rect x={bx} y={by} width={bubbleW} height={bubbleH} rx={5}
              fill="white" stroke={`${trendColor}88`} strokeWidth="1"/>
            <text x={bx+bubbleW/2} y={by+bubbleH-5} fill="#0a2870"
              fontSize="12" fontWeight="bold" textAnchor="middle"
              fontFamily="Arial,sans-serif">{Math.round(todayCompound)}</text>
            {compoundDelta!==null && compoundDelta!==0 && (
              <text x={bx+bubbleW-4} y={by+bubbleH-5}
                fill={compoundDelta>0?"#0a7030":"#a01818"}
                fontSize="8" fontWeight="bold" textAnchor="end"
                fontFamily="Arial,sans-serif">{compoundDelta>0?"+":""}{compoundDelta}</text>
            )}
          </g>
        )}

        {/* X-axis dates */}
        {graphPts.filter((_,i)=>i===0||i%5===0||i===SHOW-1).map((p)=>{
          const i = graphPts.indexOf(p);
          const d = new Date(p.date+"T12:00:00");
          return (
            <text key={p.date} x={xS(i)} y={H-4}
              fill={p.date===today?"#0a2870":"rgba(50,80,150,0.4)"}
              fontSize="7" textAnchor="middle" fontFamily="Arial,sans-serif"
              fontWeight={p.date===today?"bold":"normal"}>
              {`${d.getMonth()+1}/${d.getDate()}`}
            </text>
          );
        })}
      </svg>

      <div className="wii-stats">
        <div className="wii-stat"><div className="val">{score}</div><div className="lbl">Today</div></div>
        <div className="wii-stat"><div className="val">{Math.round(todayCompound)}</div><div className="lbl">Lifetime</div></div>
        <div className="wii-stat">
          <div className="val" style={{color:compoundDelta===null?undefined:compoundDelta>0?"#4ade80":compoundDelta<0?"#f87171":undefined}}>
            {compoundDelta!==null?(compoundDelta>0?`+${compoundDelta}`:String(compoundDelta)):"-"}
          </div>
          <div className="lbl">Change</div>
        </div>
        <div className="wii-stat"><div className="val">{streak}🔥</div><div className="lbl">Streak</div></div>
      </div>
    </div>
  );
}

// ── Shared Card Headerer ────────────────────────────────────────────────────
function UCardHeader({ habit, done, onToggle, summary, open, onExpand, hasTracker }){
  if(!hasTracker) return (
    <div className="ucard-hdr simple" onClick={onToggle}>
      <div className={`ucb${done?" chk":""}`}>
        {done&&<span style={{color:"#0e0e0f",fontSize:"0.62rem",fontWeight:"bold"}}>✓</span>}
      </div>
      <span className="u-emoji">{habit.emoji}</span>
      <span className={`u-name${done?" x":""}`}>{habit.name}</span>
    </div>
  );
  return (
    <div className="ucard-hdr">
      <div className={`ucb${done?" chk":""}`} onClick={e=>{e.stopPropagation();onToggle();}}>
        {done&&<span style={{color:"#0e0e0f",fontSize:"0.62rem",fontWeight:"bold"}}>✓</span>}
      </div>
      <div className="ucard-expand" onClick={onExpand}>
        <span className="u-emoji">{habit.emoji}</span>
        <span className={`u-name${done?" x":""}`}>{habit.name}</span>
        {summary&&<span className="u-summary">{summary}</span>}
        <span className={`u-chevron${open?" open":""}`}>▼</span>
      </div>
    </div>
  );
}

function SimpleHabitCard({ habit, done, onToggle }){
  return <div className={`ucard${done?" done":""}`}><UCardHeader habit={habit} done={done} onToggle={onToggle} hasTracker={false}/></div>;
}

// ── Water ─────────────────────────────────────────────────────────────────
function WaterHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [unit,setUnit]=usePersist(`${uk}_trk_water_unit`,"oz");
  const [goal,setGoal]=usePersist(`${uk}_trk_water_goal_oz`,64);
  const [entries,setEntries]=usePersist(`${uk}_trk_water_${tk}`,[]);
  const [custom,setCustom]=useState("");
  const OZ_Q=[8,12,16,24,32], ML_Q=[250,350,500,750];
  const safeEntries=Array.isArray(entries)?entries:[];
  const totalOz=safeEntries.reduce((s,e)=>s+e.oz,0);
  const fmt=v=>unit==="oz"?Math.round(v)+" oz":Math.round(v*29.5735)+" ml";
  const pct=Math.min(100,(totalOz/goal)*100);
  const add=oz=>setEntries(e=>[...(Array.isArray(e)?e:[]),{id:Date.now(),oz}]);
  const addCustom=()=>{ const n=parseFloat(custom); if(!n||n<=0)return; add(unit==="oz"?n:n/29.5735); setCustom(""); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={fmt(totalOz)} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Unit:</span>
          <div className="unit-tog">
            <button className={`unit-opt${unit==="oz"?" on":""}`} onClick={()=>setUnit("oz")}>oz</button>
            <button className={`unit-opt${unit==="ml"?" on":""}`} onClick={()=>setUnit("ml")}>ml</button>
          </div>
          <span style={{fontSize:"0.75rem",color:"var(--mt)"}}>Goal:</span>
          <input className="trk-mini-inp w80" type="number" value={unit==="oz"?goal:Math.round(goal*29.5735)}
            onChange={e=>{const v=parseFloat(e.target.value)||0;setGoal(unit==="oz"?v:v/29.5735);}} placeholder="64"/>
          <span style={{fontSize:"0.73rem",color:"var(--mt)"}}>{unit}</span>
        </div>
        <div className="qk-btns">{(unit==="oz"?OZ_Q:ML_Q).map(q=><button key={q} className="qk-btn" onClick={()=>add(unit==="oz"?q:q/29.5735)}>+{q}{unit}</button>)}</div>
        <div className="trk-row">
          <input className="trk-mini-inp w80" type="number" placeholder={`Custom ${unit}`} value={custom}
            onChange={e=>setCustom(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustom()}/>
          <button className="smol-btn" onClick={addCustom}>+ Log</button>
        </div>
        <div className="trk-goal-bar">
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"var(--mt)"}}>
            <span>{fmt(totalOz)}</span><span>/ {unit==="oz"?goal+" oz":Math.round(goal*29.5735)+" ml"}</span>
          </div>
          <div className="bar"><div className="fill" style={{width:`${pct}%`}}/></div>
        </div>
        {safeEntries.length>0&&<div className="trk-log">{[...safeEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">💧 logged</span>
            <span className="trk-entry-val">{fmt(e.oz)}</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
      </div>}
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────
function ActivityHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [unit,setUnit]=usePersist(`${uk}_trk_act_unit`,"mi");
  const [entries,setEntries]=usePersist(`${uk}_trk_act_${tk}`,[]);
  const [actName,setActName]=useState("Running");
  const [dist,setDist]=useState("");
  const ACTS=["Running","Walking","Cycling","Swimming","Hiking","Gym","Yoga","Rowing"];
  const safeActEntries=Array.isArray(entries)?entries:[];
  const totalDist=safeActEntries.reduce((s,e)=>s+(e.unit===unit?e.dist:(unit==="mi"?e.dist*0.621371:e.dist*1.60934)),0);
  const log=()=>{ const d=parseFloat(dist); if(!d||d<=0)return; setEntries(e=>[...e,{id:Date.now(),activity:actName||"Activity",dist:d,unit}]); setDist(""); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={safeActEntries.length>0?`${totalDist.toFixed(1)} ${unit}`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Unit:</span>
          <div className="unit-tog">
            <button className={`unit-opt${unit==="mi"?" on":""}`} onClick={()=>setUnit("mi")}>mi</button>
            <button className={`unit-opt${unit==="km"?" on":""}`} onClick={()=>setUnit("km")}>km</button>
          </div>
        </div>
        <div className="trk-row">
          <select className="trk-mini-inp" style={{flex:1}} value={actName} onChange={e=>setActName(e.target.value)}>
            {ACTS.map(a=><option key={a}>{a}</option>)}
          </select>
          <input className="trk-mini-inp w80" type="number" placeholder={`Dist (${unit})`} value={dist}
            onChange={e=>setDist(e.target.value)} onKeyDown={e=>e.key==="Enter"&&log()}/>
          <button className="smol-btn" onClick={log}>+ Log</button>
        </div>
        {safeActEntries.length>0&&<>
          <div className="trk-log">{[...safeActEntries].reverse().map(e=>(
            <div key={e.id} className="trk-entry">
              <span className="trk-entry-text">{e.activity}</span>
              <span className="trk-entry-val">{e.dist} {e.unit}</span>
              <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
            </div>
          ))}</div>
          <div className="trk-total">
            <div className="trk-tot-item"><div className="val">{totalDist.toFixed(1)}</div><div className="lbl">{unit} today</div></div>
            <div className="trk-tot-item"><div className="val">{entries.length}</div><div className="lbl">sessions</div></div>
          </div>
        </>}
      </div>}
    </div>
  );
}

// ── Reading ───────────────────────────────────────────────────────────────
function ReadingHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [entries,setEntries]=usePersist(`${uk}_trk_read_${tk}`,[]);
  const [finished,setFinished]=usePersist(`${uk}_trk_books_${tk}`,0);
  const [book,setBook]=useState("");
  const [pages,setPages]=useState("");
  const safeReadEntries=Array.isArray(entries)?entries:[];
  const totalPages=safeReadEntries.reduce((s,e)=>s+e.pages,0);
  const log=()=>{ const p=parseInt(pages); if(!p||p<=0)return; setEntries(e=>[...e,{id:Date.now(),book:book||"Reading",pages:p}]); setPages(""); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={totalPages>0?`${totalPages} pages`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <input className="trk-mini-inp" style={{flex:1}} placeholder="Book title (optional)" value={book} onChange={e=>setBook(e.target.value)}/>
        </div>
        <div className="trk-row">
          <input className="trk-mini-inp w80" type="number" placeholder="Pages" value={pages}
            onChange={e=>setPages(e.target.value)} onKeyDown={e=>e.key==="Enter"&&log()}/>
          <button className="smol-btn" onClick={log}>+ Log pages</button>
          <button className="smol-btn gold" onClick={()=>setFinished(f=>f+1)}>✓ Finished book</button>
        </div>
        {safeReadEntries.length>0&&<div className="trk-log">{[...safeReadEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">{e.book}</span>
            <span className="trk-entry-val">{e.pages} pages</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
        <div className="trk-total">
          <div className="trk-tot-item"><div className="val">{totalPages}</div><div className="lbl">pages today</div></div>
          <div className="trk-tot-item"><div className="val">{Array.isArray(finished)?0:finished}</div><div className="lbl">books finished</div></div>
        </div>
      </div>}
    </div>
  );
}

// ── Meditation ────────────────────────────────────────────────────────────
function MeditationHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [entries,setEntries]=usePersist(`${uk}_trk_med_${tk}`,[]);
  const [mins,setMins]=useState(10);
  const QUICK=[5,10,15,20,30];
  const safeMedEntries=Array.isArray(entries)?entries:[];
  const totalMins=safeMedEntries.reduce((s,e)=>s+e.mins,0);
  const log=()=>{ if(mins<=0)return; setEntries(e=>[...(Array.isArray(e)?e:[]),{id:Date.now(),mins}]); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={totalMins>0?`${totalMins} min`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Duration:</span>
          <div className="stepr">
            <div className="step-btn" onClick={()=>setMins(m=>Math.max(1,m-1))}>−</div>
            <div className="step-val">{mins}m</div>
            <div className="step-btn" onClick={()=>setMins(m=>m+1)}>+</div>
          </div>
          <button className="smol-btn" onClick={log}>+ Log session</button>
        </div>
        <div className="qk-btns">{QUICK.map(q=><button key={q} className="qk-btn" onClick={()=>{setMins(q);setEntries(e=>[...(Array.isArray(e)?e:[]),{id:Date.now(),mins:q}]);}}>{q} min</button>)}</div>
        {safeMedEntries.length>0&&<div className="trk-log">{[...safeMedEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">🧘 Session</span>
            <span className="trk-entry-val">{e.mins} min</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
        <div className="trk-total">
          <div className="trk-tot-item"><div className="val">{totalMins}</div><div className="lbl">min today</div></div>
          <div className="trk-tot-item"><div className="val">{safeMedEntries.length}</div><div className="lbl">sessions</div></div>
        </div>
      </div>}
    </div>
  );
}

// ── Sleep ─────────────────────────────────────────────────────────────────
function SleepHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [entries,setEntries]=usePersist(`${uk}_trk_sleep_${tk}`,[]);
  const [hrs,setHrs]=useState(8);
  const [qual,setQual]=useState(4);
  const safeSleepEntries=Array.isArray(entries)?entries:[];
  const totalHrs=safeSleepEntries.reduce((s,e)=>s+e.hrs,0);
  const avgQual=safeSleepEntries.length>0?(safeSleepEntries.reduce((s,e)=>s+e.qual,0)/safeSleepEntries.length).toFixed(1):null;
  const log=()=>{ if(hrs<=0)return; setEntries(e=>[...(Array.isArray(e)?e:[]),{id:Date.now(),hrs,qual}]); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={safeSleepEntries.length>0?`${totalHrs.toFixed(1)}h`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Hours slept:</span>
          <div className="stepr">
            <div className="step-btn" onClick={()=>setHrs(h=>Math.max(0.5,+(h-0.5).toFixed(1)))}>−</div>
            <div className="step-val">{hrs}h</div>
            <div className="step-btn" onClick={()=>setHrs(h=>Math.min(12,+(h+0.5).toFixed(1)))}>+</div>
          </div>
        </div>
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Quality:</span>
          <div className="star-row">
            {[1,2,3,4,5].map(i=>(
              <span key={i} className={`star${qual>=i?" on":""}`} onClick={()=>setQual(i)}>⭐</span>
            ))}
          </div>
        </div>
        <div className="trk-row"><button className="smol-btn" onClick={log}>+ Log sleep</button></div>
        <div className="qk-btns">{[6,7,8,9].map(h=><button key={h} className="qk-btn" onClick={()=>setHrs(h)}>{h}h</button>)}</div>
        {safeSleepEntries.length>0&&<div className="trk-log">{[...safeSleepEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">{"⭐".repeat(e.qual)}</span>
            <span className="trk-entry-val">{e.hrs}h</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
        <div className="trk-total">
          <div className="trk-tot-item"><div className="val">{totalHrs.toFixed(1)}</div><div className="lbl">hrs logged</div></div>
          {avgQual&&<div className="trk-tot-item"><div className="val">{avgQual}⭐</div><div className="lbl">avg quality</div></div>}
        </div>
      </div>}
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────
function StepsHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [entries,setEntries]=usePersist(`${uk}_trk_steps_${tk}`,[]);
  const [goal,setGoal]=usePersist(`${uk}_trk_steps_goal`,10000);
  const [input,setInput]=useState("");
  const safeStepsEntries=Array.isArray(entries)?entries:[];
  const total=safeStepsEntries.reduce((s,e)=>s+e.steps,0);
  const pct=Math.min(100,(total/goal)*100);
  const log=()=>{ const s=parseInt(input); if(!s||s<=0)return; setEntries(e=>[...e,{id:Date.now(),steps:s}]); setInput(""); };
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={total>0?`${total.toLocaleString()} steps`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Goal:</span>
          <input className="trk-mini-inp w80" type="number" value={goal} onChange={e=>setGoal(parseInt(e.target.value)||10000)} placeholder="10000"/>
          <span style={{fontSize:"0.73rem",color:"var(--mt)"}}>steps</span>
        </div>
        <div className="trk-row">
          <input className="trk-mini-inp" style={{flex:1}} type="number" placeholder="Enter step count" value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&log()}/>
          <button className="smol-btn" onClick={log}>+ Log</button>
        </div>
        <div className="qk-btns">{[1000,2000,5000,10000].map(q=><button key={q} className="qk-btn" onClick={()=>{setEntries(e=>[...e,{id:Date.now(),steps:q}]);}}> +{(q/1000).toFixed(0)}k</button>)}</div>
        <div className="trk-goal-bar">
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"var(--mt)"}}>
            <span>{total.toLocaleString()} steps</span><span>/ {goal.toLocaleString()}</span>
          </div>
          <div className="bar"><div className="fill" style={{width:`${pct}%`}}/></div>
        </div>
        {safeStepsEntries.length>0&&<div className="trk-log">{[...safeStepsEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">👟 logged</span>
            <span className="trk-entry-val">{e.steps.toLocaleString()}</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
      </div>}
    </div>
  );
}

// ── Weight ────────────────────────────────────────────────────────────────
function WeightHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [unit,setUnit]=usePersist(`${uk}_trk_wt_unit`,"lbs");
  const [allEntries,setAllEntries]=usePersist(`${uk}_trk_wt_all`,[]);
  const [input,setInput]=useState("");
  const todayEntries=allEntries.filter(e=>e.date===tk);
  const last=allEntries.length>0?allEntries[allEntries.length-1]:null;
  const prev=allEntries.length>1?allEntries[allEntries.length-2]:null;
  const delta=last&&prev?(last.val-prev.val).toFixed(1):null;
  const fmt=v=>unit==="lbs"?v+" lbs":v+" kg";
  const log=()=>{ const w=parseFloat(input); if(!w||w<=0)return; setAllEntries(e=>[...e,{id:Date.now(),val:w,unit,date:tk}].slice(-90)); setInput(""); };
  const del=id=>setAllEntries(e=>e.filter(x=>x.id!==id));
  const display=last?(unit===last.unit?fmt(last.val):fmt(unit==="lbs"?(last.val*2.20462).toFixed(1):(last.val/2.20462).toFixed(1))):null;
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={display} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Unit:</span>
          <div className="unit-tog">
            <button className={`unit-opt${unit==="lbs"?" on":""}`} onClick={()=>setUnit("lbs")}>lbs</button>
            <button className={`unit-opt${unit==="kg"?" on":""}`} onClick={()=>setUnit("kg")}>kg</button>
          </div>
          <input className="trk-mini-inp w80" type="number" placeholder={`Weight (${unit})`} value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&log()} step="0.1"/>
          <button className="smol-btn" onClick={log}>+ Log</button>
        </div>
        {last&&<div className="trk-total">
          <div className="trk-tot-item"><div className="val">{display}</div><div className="lbl">latest</div></div>
          {delta!==null&&<div className="trk-tot-item">
            <div className="val" style={{color:parseFloat(delta)>0?"var(--red)":parseFloat(delta)<0?"var(--grn)":"var(--mt)"}}>
              {parseFloat(delta)>0?"+":""}{delta}
            </div>
            <div className="lbl">vs prev</div>
          </div>}
        </div>}
        {todayEntries.length>0&&<div className="trk-log">{[...todayEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">⚖️ logged</span>
            <span className="trk-entry-val">{e.val} {e.unit}</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
      </div>}
    </div>
  );
}

// ── Mood ──────────────────────────────────────────────────────────────────
function MoodHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [entries,setEntries]=usePersist(`${uk}_trk_mood_${tk}`,[]);
  const [selected,setSelected]=useState(3);
  const safeMoodEntries=Array.isArray(entries)?entries:[];
  const last=safeMoodEntries.length>0?safeMoodEntries[safeMoodEntries.length-1]:null;
  const avg=safeMoodEntries.length>0?(safeMoodEntries.reduce((s,e)=>s+e.val,0)/safeMoodEntries.length).toFixed(1):null;
  const log=()=>setEntries(e=>[...(Array.isArray(e)?e:[]),{id:Date.now(),val:selected,emoji:MOOD_OPTS[selected-1].emoji}]);
  const del=id=>setEntries(e=>(Array.isArray(e)?e:[]).filter(x=>x.id!==id));
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={last?last.emoji:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="mood-opts">
          {MOOD_OPTS.map((m,i)=>(
            <div key={i} className={`mood-btn${selected===i+1?" on":""}`} onClick={()=>setSelected(i+1)}>
              <div className="mood-emoji">{m.emoji}</div>
              <div className="mood-lbl">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="trk-row"><button className="smol-btn" onClick={log}>+ Log mood</button></div>
        {safeMoodEntries.length>0&&<div className="trk-log">{[...safeMoodEntries].reverse().map(e=>(
          <div key={e.id} className="trk-entry">
            <span className="trk-entry-text">{e.emoji} {MOOD_OPTS[e.val-1]?.label??""}</span>
            <button className="trk-entry-del" onClick={()=>del(e.id)}>✕</button>
          </div>
        ))}</div>}
        {avg&&<div className="trk-total">
          <div className="trk-tot-item"><div className="val">{avg}/5</div><div className="lbl">avg mood</div></div>
          <div className="trk-tot-item"><div className="val">{safeMoodEntries.length}</div><div className="lbl">logs</div></div>
        </div>}
      </div>}
    </div>
  );
}

// ── Counter ───────────────────────────────────────────────────────────────
function CounterHabitCard({ habit, done, onToggle, tk }){
  const uk=useUK();
  const [open,setOpen]=useState(false);
  const [count,setCount]=usePersist(`${uk}_trk_ctr_${habit.id}_${tk}`,0);
  const [goal,setGoal]=usePersist(`${uk}_trk_ctr_goal_${habit.id}`,10);
  const pct=Math.min(100,(count/goal)*100);
  return (
    <div className={`ucard${done?" done":""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} summary={count>0?`${count}`:null} open={open} onExpand={()=>setOpen(o=>!o)} hasTracker/>
      {open&&<div className="ucard-body">
        <div className="trk-row">
          <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Goal:</span>
          <input className="trk-mini-inp w80" type="number" value={goal} onChange={e=>setGoal(parseInt(e.target.value)||1)} placeholder="10"/>
        </div>
        <div className="trk-row" style={{justifyContent:"center",gap:20,marginTop:14}}>
          <div className="step-btn" style={{width:40,height:40,fontSize:"1.4rem",borderRadius:"50%"}} onClick={()=>setCount(c=>Math.max(0,c-1))}>−</div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:"2rem",color:"var(--gold)",lineHeight:1}}>{count}</div>
            <div style={{fontSize:"0.65rem",color:"var(--mt)",marginTop:3,textTransform:"uppercase",letterSpacing:"0.1em"}}>{habit.name}</div>
          </div>
          <div className="step-btn" style={{width:40,height:40,fontSize:"1.4rem",borderRadius:"50%",background:"rgba(212,168,75,0.15)",borderColor:"var(--gdim)",color:"var(--gold)"}} onClick={()=>setCount(c=>c+1)}>+</div>
        </div>
        <div className="trk-goal-bar" style={{marginTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"var(--mt)"}}>
            <span>{count} / {goal}</span><span>{pct.toFixed(0)}%</span>
          </div>
          <div className="bar"><div className="fill" style={{width:`${pct}%`}}/></div>
        </div>
      </div>}
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────
function UnifiedHabitCard({ habit, done, onToggle, tk }){
  const p={habit,done,onToggle,tk};
  switch(habit.tracker){
    case "water":      return <WaterHabitCard {...p}/>;
    case "activity":   return <ActivityHabitCard {...p}/>;
    case "reading":    return <ReadingHabitCard {...p}/>;
    case "meditation": return <MeditationHabitCard {...p}/>;
    case "sleep":      return <SleepHabitCard {...p}/>;
    case "steps":      return <StepsHabitCard {...p}/>;
    case "weight":     return <WeightHabitCard {...p}/>;
    case "mood":       return <MoodHabitCard {...p}/>;
    case "counter":    return <CounterHabitCard {...p}/>;
    default:           return <SimpleHabitCard habit={habit} done={done} onToggle={onToggle}/>;
  }
}

// ── Manage Habits ─────────────────────────────────────────────────────────
function ManageHabitsCard({ habitList, setHabitList, setHabitDone }){
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("🎯");
  const [tracker,setTracker]=useState("");
  const del=id=>{ setHabitList(l=>l.filter(h=>h.id!==id)); setHabitDone(d=>{const n={...d};delete n[id];return n;}); };
  const add=()=>{ if(!name.trim())return; setHabitList(l=>[...l,{id:Date.now(),name:name.trim(),emoji,tracker:tracker||null}]); setName(""); setTracker(""); };
  const tLabel=id=>TRACKER_OPTIONS.find(t=>t.id===id)?.label??"No tracker";
  return (
    <div className="trk-card">
      <div className="trk-hdr" onClick={()=>setOpen(o=>!o)}>
        <span className="trk-ico">⚙️</span>
        <span className="trk-name">Manage Habits</span>
        <span className="trk-summary">{habitList.length} habit{habitList.length!==1?"s":""}</span>
        <span className={`trk-chevron${open?" open":""}`}>▼</span>
      </div>
      {open&&<div className="trk-body">
        {habitList.length===0&&<div style={{marginTop:10,fontSize:"0.81rem",color:"var(--mt)",fontStyle:"italic"}}>No habits yet.</div>}
        {habitList.map(h=>(
          <div key={h.id} className="mh-row">
            <span className="mh-emoji">{h.emoji}</span>
            <span className="mh-name">{h.name}</span>
            {h.tracker&&<span className="mh-tag">{tLabel(h.tracker)}</span>}
            <button className="mh-del" onClick={()=>del(h.id)}>✕</button>
          </div>
        ))}
        <div className="mh-divider"/>
        <div className="mh-add-ttl">+ Add New Habit</div>
        <div className="mh-add-row">
          <select className="esel" value={emoji} onChange={e=>setEmoji(e.target.value)}>
            {EMOJI_OPTIONS.map(em=><option key={em} value={em}>{em}</option>)}
          </select>
          <input className="hni" placeholder="Habit name…" value={name}
            onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <select className="tsel" value={tracker} onChange={e=>setTracker(e.target.value)}>
            {TRACKER_OPTIONS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button className="abtn" onClick={add}>Add</button>
        </div>
      </div>}
    </div>
  );
}

// ── Nutrition Tab ─────────────────────────────────────────────────────────
function NutritionTab({ tk }){
  const uk=useUK();
  const [entries,setEntries]=usePersist(`${uk}_nutrition_${tk}`,[]);
  const [goals,setGoals]=usePersist(`${uk}_nutrition_goals`,{cal:2000,p:150,c:250,f:65});
  const [search,setSearch]=useState("");
  const [showCustom,setShowCustom]=useState(false);
  const [showGoals,setShowGoals]=useState(false);
  const [custom,setCustom]=useState({name:"",cal:"",p:"",c:"",f:""});
  const [draftGoals,setDraftGoals]=useState(goals);

  const safeNutrEntries=Array.isArray(entries)?entries:[];
  const totals=safeNutrEntries.reduce((a,e)=>({cal:a.cal+e.cal,p:a.p+(e.p||0),c:a.c+(e.c||0),f:a.f+(e.f||0)}),{cal:0,p:0,c:0,f:0});
  const filtered=search?FOOD_DB.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())):FOOD_DB;
  const addFood=food=>setEntries(e=>[...e,{...food,id:Date.now()}]);
  const addCustomFood=()=>{
    if(!custom.name||!custom.cal)return;
    addFood({name:custom.name,cal:+custom.cal,p:+custom.p||0,c:+custom.c||0,f:+custom.f||0});
    setCustom({name:"",cal:"",p:"",c:"",f:""});
    setShowCustom(false);
  };
  const del=id=>setEntries(e=>e.filter(x=>x.id!==id));
  const calPct=Math.min(100,(totals.cal/goals.cal)*100);
  const over=totals.cal>goals.cal;
  const MACRO_COLORS={p:"#5b9bd4",c:"#e09a30",f:"#e05252"};

  return (
    <div>
      <div className="prow">
        <div className="ptitle">Nutrition</div>
        <div style={{display:"flex",gap:6}}>
          <button className={`pact${showCustom?" on":""}`} onClick={()=>{setShowCustom(s=>!s);setShowGoals(false);}}>+ Custom</button>
          <button className={`pact${showGoals?" on":""}`} onClick={()=>{setShowGoals(s=>!s);setShowCustom(false);setDraftGoals(goals);}}>⚙ Goals</button>
        </div>
      </div>

      {/* Macro overview */}
      <div className="nutr-macro-bar">
        <div className="nutr-cal-row">
          <div className="nutr-cal-num" style={{color:over?"var(--red)":"var(--gold)"}}>{Math.round(totals.cal)}</div>
          <div className="nutr-cal-goal">/ {goals.cal} kcal</div>
          {over&&<span style={{fontSize:"0.72rem",color:"var(--red)",marginLeft:4}}>over goal</span>}
        </div>
        <div className="nutr-cal-bar">
          <div className={`nutr-cal-fill${over?" over":""}`} style={{width:`${calPct}%`}}/>
        </div>
        <div className="nutr-macros">
          {[["Protein","p","g",MACRO_COLORS.p],["Carbs","c","g",MACRO_COLORS.c],["Fat","f","g",MACRO_COLORS.f]].map(([label,key,unit,color])=>(
            <div key={key} className="nutr-macro">
              <div className="nutr-macro-lbl">
                <span>{label}</span>
                <span>{Math.round(totals[key])}/{goals[key]}{unit}</span>
              </div>
              <div className="nutr-macro-track">
                <div className="nutr-macro-fill" style={{width:`${Math.min(100,(totals[key]/goals[key])*100)}%`,background:color}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals editor */}
      {showGoals&&(
        <div className="nutr-goals-form" style={{marginBottom:12,border:"1px solid var(--gdim)",borderRadius:10,padding:"14px 16px",background:"var(--sf)",animation:"fi 0.18s ease"}}>
          <div style={{fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--mt)",marginBottom:10}}>⚙ Daily Goals</div>
          <div className="nutr-goals-grid">
            {[["Calories (kcal)","cal"],["Protein (g)","p"],["Carbs (g)","c"],["Fat (g)","f"]].map(([lbl,k])=>(
              <div key={k} className="nutr-goal-item">
                <label>{lbl}</label>
                <input className="nutr-cf-inp" style={{width:"100%"}} type="number" value={draftGoals[k]}
                  onChange={e=>setDraftGoals(d=>({...d,[k]:+e.target.value||0}))}/>
              </div>
            ))}
          </div>
          <button className="apply-btn" style={{marginTop:12}} onClick={()=>{setGoals(draftGoals);setShowGoals(false);}}>Save Goals</button>
        </div>
      )}

      {/* Custom food form */}
      {showCustom&&(
        <div className="nutr-custom-form">
          <div className="nutr-cf-title">+ Add Custom Food</div>
          <div className="nutr-cf-row">
            <input className="nutr-cf-inp" style={{flex:2,minWidth:120}} placeholder="Food name" value={custom.name} onChange={e=>setCustom(d=>({...d,name:e.target.value}))}/>
            <input className="nutr-cf-inp" style={{width:80}} type="number" placeholder="kcal" value={custom.cal} onChange={e=>setCustom(d=>({...d,cal:e.target.value}))}/>
          </div>
          <div className="nutr-cf-row">
            {[["Protein g","p"],["Carbs g","c"],["Fat g","f"]].map(([pl,k])=>(
              <input key={k} className="nutr-cf-inp" style={{flex:1,minWidth:60}} type="number" placeholder={pl} value={custom[k]} onChange={e=>setCustom(d=>({...d,[k]:e.target.value}))}/>
            ))}
            <button className="abtn" onClick={addCustomFood}>Add</button>
          </div>
        </div>
      )}

      {/* Food search + grid */}
      <div className="nutr-search-row">
        <input className="nutr-search" placeholder="Search foods…" value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button className="smol-btn" onClick={()=>setSearch("")}>✕</button>}
      </div>
      <div className="nutr-food-grid">
        {filtered.map((f,i)=>(
          <button key={i} className="nutr-food-btn" onClick={()=>addFood(f)}>
            <div className="nutr-food-name">{f.name}</div>
            <div className="nutr-food-cals">{f.cal} kcal</div>
            <div className="nutr-food-macros">P {f.p}g · C {f.c}g · F {f.f}g</div>
          </button>
        ))}
      </div>

      {/* Today's log */}
      {safeNutrEntries.length>0&&(
        <>
          <div className="trk-section-hdr" style={{marginTop:6}}>Today's Log</div>
          <div className="nutr-log">
            {[...safeNutrEntries].reverse().map(e=>(
              <div key={e.id} className="nutr-log-entry">
                <div className="nutr-log-name">{e.name}</div>
                <div className="nutr-log-macros" style={{marginRight:6}}>P{Math.round(e.p||0)}·C{Math.round(e.c||0)}·F{Math.round(e.f||0)}</div>
                <div className="nutr-log-cals">{e.cal} kcal</div>
                <button className="nutr-log-del" onClick={()=>del(e.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}
      {safeNutrEntries.length===0&&<div className="nutr-empty">No food logged yet — tap any food above to add it.</div>}
    </div>
  );
}


// ── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode]         = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(null);
  const [showPw,   setShowPw]   = useState(false);

  const handle = async () => {
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!u)        { setError("Username can only contain letters, numbers and underscores."); return; }
    if (!password) { setError("Please enter a password."); return; }

    setLoading(true); setError("");

    // ── Dev login (local, no Supabase) ──
    if (mode === "dev") {
      if (password !== DEV_PASSWORD) { setError("Incorrect dev password."); setLoading(false); return; }
      const auth = { username: u, role: "dev", loginAt: Date.now(), token: null, userId: null };
      saveAuth(auth); setLoading(false); onLogin(auth); return;
    }

    // ── Register ──
    if (mode === "register") {
      if (password.length < 6)    { setError("Password must be at least 6 characters."); setLoading(false); return; }
      if (password !== confirm)   { setError("Passwords do not match."); setLoading(false); return; }
      const { data, error: err } = await sbRegister(u, password);
      if (err) { setError(err); setLoading(false); return; }
      const token  = data?.access_token  || null;
      const userId = data?.user?.id      || null;
      const meta   = data?.user?.user_metadata || {};
      const displayName = meta.username || u;
      if (token) await lbUpsert(displayName, 0, false, token, userId);
      const auth = { username: displayName, role: "user", token, refreshToken: data?.refresh_token, userId, loginAt: Date.now() };
      saveAuth(auth); setLoading(false); onLogin(auth); return;
    }

    // ── Login ──
    const { data, error: err } = await sbLogin(u, password);
    if (err) { setError(err === "Invalid login credentials" ? "Wrong username or password." : err); setLoading(false); return; }
    const token  = data?.access_token  || null;
    const userId = data?.user?.id      || null;
    const meta   = data?.user?.user_metadata || {};
    const displayName = meta.username || u;
    const auth = { username: displayName, role: "user", token, refreshToken: data?.refresh_token, userId, loginAt: Date.now() };
    saveAuth(auth); setLoading(false); onLogin(auth);
  };

  const modeLabels = { login:"Sign In", register:"Register", dev:"Dev Access" };
  const btnLabel   = loading ? "…" : mode==="dev" ? "Enter Dev Mode" : mode==="register" ? "Create Account" : "Sign In →";

  return (
    <div className="login-wrap">
      <div className="login-bg">
        <div className="login-orb orb1"/>
        <div className="login-orb orb2"/>
        <div className="login-orb orb3"/>
      </div>
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon-wrap"><span className="login-icon">🎯</span></div>
          <h1 className="login-title">FocusOS</h1>
          <p className="login-sub">Build habits. Track progress. Compete.</p>
        </div>

        <div className="login-stats">
          <div className="login-stat"><div className="login-stat-val">∞</div><div className="login-stat-lbl">Streaks</div></div>
          <div className="login-stat-div"/>
          <div className="login-stat"><div className="login-stat-val">🏆</div><div className="login-stat-lbl">Leaderboard</div></div>
          <div className="login-stat-div"/>
          <div className="login-stat"><div className="login-stat-val">⚡</div><div className="login-stat-lbl">Challenges</div></div>
        </div>

        <div className="login-mode-row">
          {["login","register","dev"].map(m=>(
            <button key={m} className={`login-mode-btn${mode===m?" on":""}`}
              onClick={()=>{setMode(m);setError("");setConfirm("");}}>
              {m==="dev"?"🔧":m==="register"?"✨":"👤"} {modeLabels[m]}
            </button>
          ))}
        </div>

        <div className="login-form">
          {/* Username */}
          <div className={`login-field${focused==="user"?" focus":""}`}>
            <span className="login-field-icon">@</span>
            <input className="login-field-inp" placeholder="Username"
              value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}
              onFocus={()=>setFocused("user")} onBlur={()=>setFocused(null)}
              onKeyDown={e=>e.key==="Enter"&&handle()} autoFocus autoCapitalize="none"/>
          </div>

          {/* Password */}
          <div className={`login-field${focused==="pw"?" focus":""}`}>
            <span className="login-field-icon">🔑</span>
            <input className="login-field-inp" type={showPw?"text":"password"}
              placeholder={mode==="dev"?"Dev password":"Password (min 6 chars)"}
              value={password} onChange={e=>setPassword(e.target.value)}
              onFocus={()=>setFocused("pw")} onBlur={()=>setFocused(null)}
              onKeyDown={e=>e.key==="Enter"&&handle()}/>
            <button className="login-pw-toggle" onClick={()=>setShowPw(s=>!s)} tabIndex={-1}>
              {showPw?"🙈":"👁"}
            </button>
          </div>

          {/* Confirm password (register only) */}
          {mode==="register"&&(
            <div className={`login-field${focused==="cf"?" focus":""}`}>
              <span className="login-field-icon">✓</span>
              <input className="login-field-inp" type={showPw?"text":"password"}
                placeholder="Confirm password"
                value={confirm} onChange={e=>setConfirm(e.target.value)}
                onFocus={()=>setFocused("cf")} onBlur={()=>setFocused(null)}
                onKeyDown={e=>e.key==="Enter"&&handle()}/>
            </div>
          )}

          {mode==="login"&&!error&&(
            <p className="login-hint">💡 Use your username and password to sign in.</p>
          )}
          {mode==="register"&&!error&&(
            <p className="login-hint">✨ Username: letters, numbers, underscores only.</p>
          )}

          {error&&<div className="login-error"><span>⚠</span> {error}</div>}

          <button className="login-btn" onClick={handle}
            disabled={loading||!username.trim()||!password}>
            {btnLabel}
          </button>
        </div>

        {!SUPABASE_URL&&(
          <div className="login-warn">⚠ Supabase not configured — leaderboard disabled.</div>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard Panel ─────────────────────────────────────────────────────
function LeaderboardPanel({ currentUser, currentScore }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await lbFetch(currentUser?.token);
    if (data) { setRows(data); setLastSync(new Date()); }
    setLoading(false);
  }, [currentUser?.token]);

  // Push current user score on mount + when score changes
  useEffect(() => {
    if (currentUser && SUPABASE_URL) {
      lbUpsert(currentUser.username, currentScore, currentUser.role==="dev", currentUser.token, currentUser.userId)
        .then(() => refresh());
    } else {
      refresh();
    }
  }, [currentScore, refresh]);

  const fmt = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  };

  const myRank = rows.findIndex(r => r.username === currentUser?.username) + 1;

  return (
    <div className="lb-wrap">
      <div className="lb-header">
        <div className="lb-title">🏆 Leaderboard</div>
        <button className="lb-refresh" onClick={refresh} disabled={loading}>
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>

      {myRank > 0 && (
        <div className="lb-myrank">
          You are ranked <strong style={{color:"var(--gold)"}}>#{myRank}</strong> with a score of <strong style={{color:"var(--gold)"}}>{currentScore}</strong>
        </div>
      )}

      {!SUPABASE_URL && (
        <div className="lb-offline">Leaderboard requires Supabase — see setup instructions.</div>
      )}

      {SUPABASE_URL && (
        <div className="lb-list">
          {rows.length === 0 && !loading && (
            <div className="lb-empty">No scores yet — be the first!</div>
          )}
          {rows.map((r, i) => {
            const isMe = r.username === currentUser?.username;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
            return (
              <div key={r.username} className={`lb-row${isMe?" me":""}`}>
                <div className="lb-rank">{medal}</div>
                <div className="lb-name">
                  {r.username}
                  {r.is_dev && <span className="lb-dev-badge">DEV</span>}
                  {isMe && <span className="lb-you">you</span>}
                </div>
                <div className="lb-score">{r.score}</div>
                <div className="lb-date">{fmt(r.updated_at)}</div>
              </div>
            );
          })}
        </div>
      )}

      {lastSync && <div className="lb-sync">Last synced {lastSync.toLocaleTimeString()}</div>}
    </div>
  );
}

// ── Dev Panel Component ───────────────────────────────────────────────────
function DevPanel({ auth, onLogout, score, taskScore, habitScore, safeBonus, setChallengeBonus, uk }) {
  const [pushStatus, setPushStatus] = useState(null); // null | "pushing" | "ok" | "err"
  const [pushMsg,    setPushMsg]    = useState("");
  const [scoreOverride, setScoreOverride] = useState("");
  const [lsFilter, setLsFilter]     = useState(uk);
  const [lsKeys, setLsKeys]         = useState([]);
  const [showLS, setShowLS]         = useState(false);

  const pushScore = async (overrideVal) => {
    const s = overrideVal !== undefined ? overrideVal : score;
    setPushStatus("pushing"); setPushMsg("");
    try {
      // Dev accounts have no JWT — use anon key directly
      const result = await lbUpsert(auth.username, s, true, SUPABASE_KEY, auth.userId);
      if (result) {
        setPushStatus("ok"); setPushMsg(`✅ Pushed score ${s} to leaderboard`);
      } else {
        setPushStatus("err"); setPushMsg("❌ Upsert returned null — check Supabase RLS or table name");
      }
    } catch(e) {
      setPushStatus("err"); setPushMsg(`❌ Error: ${e.message}`);
    }
    setTimeout(() => setPushStatus(null), 4000);
  };

  const applyScoreOverride = () => {
    const n = parseInt(scoreOverride);
    if (isNaN(n) || n < 0) return;
    setChallengeBonus(Math.max(0, n - Math.round(taskScore + habitScore)));
    setScoreOverride("");
  };

  const refreshLS = () => {
    const keys = Object.keys(localStorage)
      .filter(k => lsFilter ? k.includes(lsFilter) : true)
      .sort();
    setLsKeys(keys);
  };

  const clearLsKey = (k) => { localStorage.removeItem(k); refreshLS(); };

  return (
    <div>
      <div className="prow"><div className="ptitle">🔧 Dev Panel</div></div>

      {/* Account */}
      <div className="dev-section">
        <div className="dev-section-title">Account</div>
        <div className="dev-row"><span className="dev-lbl">Logged in as</span><span className="dev-val">{auth?.username} <span className="hdr-devbadge">DEV</span></span></div>
        <div className="dev-row"><span className="dev-lbl">Storage prefix</span><span className="dev-val" style={{fontFamily:"var(--fm)",fontSize:"0.75rem"}}>{uk}</span></div>
        <div className="dev-row"><span className="dev-lbl">Session started</span><span className="dev-val">{auth?.loginAt?new Date(auth.loginAt).toLocaleTimeString():"-"}</span></div>
        <button className="dev-btn-danger" onClick={onLogout}>Sign Out</button>
      </div>

      {/* Scores */}
      <div className="dev-section">
        <div className="dev-section-title">Scores</div>
        <div className="dev-row"><span className="dev-lbl">Task score</span><span className="dev-val">{Math.round(taskScore)}/60</span></div>
        <div className="dev-row"><span className="dev-lbl">Habit score</span><span className="dev-val">{Math.round(habitScore)}/40</span></div>
        <div className="dev-row"><span className="dev-lbl">Challenge bonus</span><span className="dev-val">+{safeBonus}</span></div>
        <div className="dev-row"><span className="dev-lbl">Total score</span><span className="dev-val" style={{color:"var(--gold)",fontWeight:600}}>{score}</span></div>
        <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center"}}>
          <input className="ti" style={{width:80,flex:"none"}} type="number" min="0" placeholder="Override"
            value={scoreOverride} onChange={e=>setScoreOverride(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&applyScoreOverride()}/>
          <button className="dev-btn" onClick={applyScoreOverride}>Set Score</button>
          <span style={{fontSize:"0.7rem",color:"var(--mt)"}}>Sets via bonus delta</span>
        </div>
      </div>

      {/* Supabase / Push */}
      <div className="dev-section">
        <div className="dev-section-title">Supabase</div>
        <div className="dev-row"><span className="dev-lbl">URL</span><span className="dev-val">{SUPABASE_URL?"✅ Set":"❌ Missing"}</span></div>
        <div className="dev-row"><span className="dev-lbl">Anon key</span><span className="dev-val">{SUPABASE_KEY?"✅ Set":"❌ Missing"}</span></div>
        <div className="dev-row"><span className="dev-lbl">User JWT</span><span className="dev-val" style={{color:"var(--mt)"}}>{auth?.token?"✅ Present":"⚠ None (dev — uses anon key)"}</span></div>
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
          <button className="dev-btn" disabled={pushStatus==="pushing"} onClick={()=>pushScore()}>
            {pushStatus==="pushing"?"Pushing…":"Push Score Now"}
          </button>
          <button className="dev-btn" disabled={pushStatus==="pushing"} onClick={()=>pushScore(99)}>
            Push 99 (test)
          </button>
          <button className="dev-btn" disabled={pushStatus==="pushing"} onClick={()=>pushScore(0)}>
            Push 0 (test)
          </button>
        </div>
        {pushMsg&&(
          <div style={{marginTop:8,fontSize:"0.78rem",fontFamily:"var(--fm)",
            color:pushStatus==="ok"?"var(--grn)":"var(--red)",
            background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:6,padding:"6px 10px"}}>
            {pushMsg}
          </div>
        )}
      </div>

      {/* localStorage Inspector */}
      <div className="dev-section">
        <div className="dev-section-title">localStorage Inspector</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input className="ti" style={{flex:1}} placeholder={`Filter keys (default: ${uk})`}
            value={lsFilter} onChange={e=>setLsFilter(e.target.value)}/>
          <button className="dev-btn" onClick={()=>{setShowLS(true);refreshLS();}}>Inspect</button>
          {showLS&&<button className="dev-btn" onClick={()=>setShowLS(false)}>Hide</button>}
        </div>
        {showLS&&(
          <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            {lsKeys.length===0&&<div style={{fontSize:"0.78rem",color:"var(--mt)",fontStyle:"italic"}}>No keys matching filter.</div>}
            {lsKeys.map(k=>{
              let val="";
              try{ const raw=localStorage.getItem(k); val=raw&&raw.length>60?raw.slice(0,60)+"…":raw; }catch{}
              return (
                <div key={k} style={{background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:6,padding:"5px 8px",display:"flex",gap:8,alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.68rem",fontFamily:"var(--fm)",color:"var(--gold)",wordBreak:"break-all"}}>{k}</div>
                    <div style={{fontSize:"0.65rem",color:"var(--mt)",wordBreak:"break-all",marginTop:2}}>{val}</div>
                  </div>
                  <button className="trk-entry-del" style={{flexShrink:0}} onClick={()=>clearLsKey(k)}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
const HOME_MSGS = [
  score => score>=90?"🔥 Absolutely crushing it today. Keep that momentum going!":
           score>=75?"💪 Strong day. Push through the final stretch.":
           score>=55?"📈 Good progress — you're building the habit.":
           score>=35?"🌱 Every action today compounds into tomorrow.":
           "☀️ The best time to start was yesterday. The next best time is now."
];

function AppShell() {
  const [auth, setAuth] = useState(() => loadAuth());
  const logout = () => { clearAuth(); setAuth(null); };
  return (
    <>
      <style>{CSS}</style>
      {!auth
        ? <LoginScreen onLogin={a => setAuth(a)}/>
        : <App auth={auth} onLogout={logout}/>
      }
    </>
  );
}

export default AppShell;

function App({ auth, onLogout }){
  const [tab,setTab]=useState("home");
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const tk=todayKey();
  // Scope all storage keys to the logged-in user so accounts don't bleed into each other
  const uk = auth?.username ? `u_${auth.username}` : "u_guest";

  // Tasks
  const [tasks,setTasks]=usePersist(`${uk}_prod_tasks_v2`,[]);
  const [newTask,setNewTask]=useState("");
  const [newPrio,setNewPrio]=useState("medium");
  const addTask=()=>{ if(!newTask.trim())return; setTasks(t=>[...t,{id:Date.now(),text:newTask.trim(),priority:newPrio,done:false}]); setNewTask(""); };
  const toggleTask=id=>setTasks(t=>t.map(x=>x.id===id?{...x,done:!x.done}:x));
  const delTask=id=>setTasks(t=>t.filter(x=>x.id!==id));
  const tasksDone=tasks.filter(t=>t.done).length;
  const totalWeight=tasks.reduce((s,t)=>s+PRIO_PTS[t.priority],0);
  const doneWeight=tasks.filter(t=>t.done).reduce((s,t)=>s+PRIO_PTS[t.priority],0);

  // Timer
  const [timerCfg,setTimerCfg]=usePersist(`${uk}_prod_timer_cfg_v2`,DEFAULT_TIMER);
  const [showTimerSett,setShowTimerSett]=useState(false);
  const [showSoundSett,setShowSoundSett]=useState(false);
  const [draftWork,setDraftWork]=useState(timerCfg.work);
  const [draftBrk,setDraftBrk]=useState(timerCfg.brk);
  const [soundChoice,setSoundChoice]=usePersist(`${uk}_prod_sound`,"bell");
  const [soundVol,setSoundVol]=usePersist(`${uk}_prod_vol`,70);
  const [pomSecs,setPomSecs]=useState(timerCfg.work*60);
  const [pomRunning,setPomRunning]=useState(false);
  const [pomMode,setPomMode]=useState("work");
  const [pomDone,setPomDone]=usePersist(`${uk}_prod_pomo_count`,0);
  const pomRef=useRef(null);
  const pomModeRef=useRef(pomMode);
  const timerCfgRef=useRef(timerCfg);
  const soundChoiceRef=useRef(soundChoice);
  const soundVolRef=useRef(soundVol);
  useEffect(()=>{ pomModeRef.current=pomMode; },[pomMode]);
  useEffect(()=>{ timerCfgRef.current=timerCfg; },[timerCfg]);
  useEffect(()=>{ soundChoiceRef.current=soundChoice; },[soundChoice]);
  useEffect(()=>{ soundVolRef.current=soundVol; },[soundVol]);

  useEffect(()=>{
    if(pomRunning){
      pomRef.current=setInterval(()=>{
        setPomSecs(s=>{
          if(s<=1){
            clearInterval(pomRef.current);
            setPomRunning(false);
            playSound(soundChoiceRef.current,soundVolRef.current);
            if(pomModeRef.current==="work"){
              setPomDone(c=>c+1);
              setPomMode("break");
              return timerCfgRef.current.brk*60;
            } else {
              setPomMode("work");
              return timerCfgRef.current.work*60;
            }
          }
          return s-1;
        });
      },1000);
    } else {
      clearInterval(pomRef.current);
    }
    return()=>clearInterval(pomRef.current);
  },[pomRunning]);

  const resetPom=(cfg=timerCfg)=>{setPomRunning(false);setPomMode("work");setPomSecs(cfg.work*60);};
  const applyTimer=()=>{ const next={work:Math.max(1,Math.min(90,draftWork)),brk:Math.max(1,Math.min(30,draftBrk))}; setTimerCfg(next);resetPom(next);setShowTimerSett(false); };
  const nudge=(f,d)=>f==="work"?setDraftWork(v=>Math.max(1,Math.min(90,v+d))):setDraftBrk(v=>Math.max(1,Math.min(30,v+d)));
  const total=(pomMode==="work"?timerCfg.work:timerCfg.brk)*60;
  const radius=86,circ=2*Math.PI*radius;
  const offset=circ*(1-pomSecs/total);
  const mm=String(Math.floor(pomSecs/60)).padStart(2,"0");
  const ss=String(pomSecs%60).padStart(2,"0");

  // Habits
  const [habitList,setHabitList]=usePersist(`${uk}_prod_habit_list_v2`,DEFAULT_HABITS);
  const [habitDone,setHabitDone]=usePersist(`${uk}_prod_habits_${tk}`,{});
  const toggleHabit=id=>setHabitDone(p=>({...p,[id]:!p[id]}));
  const habitCount=habitList.filter(h=>habitDone[h.id]).length;

  // Day reset
  const [showResetConfirm,setShowResetConfirm]=useState(false);
  const [resetKey,setResetKey]=useState(0);
  const [challengeBonus,setChallengeBonus]=usePersist(`${uk}_challenge_bonus_${tk}`,0);
  const handleDayReset=()=>{
    setTasks(t=>t.map(x=>({...x,done:false})));
    setHabitDone({});
    setPomDone(0);resetPom();
    setChallengeBonus(0);
    ["trk_water","trk_act","trk_read","trk_med","trk_sleep","trk_steps","trk_mood"].forEach(k=>save(`${uk}_${k}_${tk}`,"[]"));
    save(`${uk}_trk_books_${tk}`,"0");
    setResetKey(k=>k+1);
    setShowResetConfirm(false);
  };

  // Score
  const taskScore=totalWeight>0?(doneWeight/totalWeight)*60:0;
  const habitScore=habitList.length>0?(habitCount/habitList.length)*40:0;
  const safeBonus=typeof challengeBonus==="number"?challengeBonus:0;
  const score=Math.min(100+safeBonus,Math.round(taskScore+habitScore)+safeBonus);

  // Compound (lifetime) score — sum of all daily scores, minus 10 for each day that wasn't 100
  // Computed from history in WiiProgressGraph, passed down as a derived value
  const isdev = auth?.role === "dev";
  const TABS=[
    ["home",       "🏠","Home"],
    ["tasks",      "✅","Tasks"],
    ["timer",      "⏱","Timer"],
    ["habits",     "🎯","Habits"],
    ["challenges", "⚡","Challenges"],
    ["board",      "🏆","Board"],
    ["nutrition",  "🥗","Nutrition"],
    ["tips",       "📖","Tips"],
    ...(isdev?[["devpanel","🔧","Dev"]]:[]),
  ];

  return (
    <UserCtx.Provider value={uk}>
    <>
      <style>{CSS}</style>
      {showResetConfirm&&(
        <div className="confirm-overlay" onClick={()=>setShowResetConfirm(false)}>
          <div className="confirm-box" onClick={e=>e.stopPropagation()}>
            <div className="confirm-icon">🔄</div>
            <div className="confirm-title">Reset Today?</div>
            <div className="confirm-desc">This clears your progress and gives you a fresh start:</div>
            <ul className="confirm-list">
              <li>All tasks unchecked (list kept)</li>
              <li>All habit completions cleared</li>
              <li>Pomodoro count reset to 0</li>
              <li>Challenge bonus reset to 0</li>
              <li>Today's tracker entries cleared</li>
            </ul>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={()=>setShowResetConfirm(false)}>Cancel</button>
              <button className="confirm-ok" onClick={handleDayReset}>Reset Day</button>
            </div>
          </div>
        </div>
      )}

      <div className="app">
        <div className="hdr">
          <div>
            <h1>FocusOS</h1>
            <div className="hdr-date">{today}</div>
          </div>
          <div className="hdr-right">
            <div className="hdr-user" onClick={()=>setTab("board")} title="View leaderboard">
              <span className="hdr-username">{auth?.username}</span>
              {auth?.role==="dev"&&<span className="hdr-devbadge">DEV</span>}
            </div>
            <button className="hdr-logout" onClick={onLogout} title="Sign out">⏏</button>
            <button className="reset-day-btn" onClick={()=>setShowResetConfirm(true)}>
              <span className="rdb-icon">🔄</span>
              <span className="rdb-lbl">Reset</span>
            </button>
            <div className="score-pill" title={`Tasks ${Math.round(taskScore)} · Habits ${Math.round(habitScore)}`}>
              <div className="score-num">{score}<span style={{fontSize:"0.8rem",color:"var(--mt)",fontWeight:300}}>/100</span></div>
              <div className="score-lbl">Score ⓘ</div>
            </div>
          </div>
        </div>

        <div className="nav">
          {TABS.map(([k,ico,lbl])=>(
            <button key={k} className={`nb${tab===k?" on":""}`} onClick={()=>setTab(k)}>
              <span className="nb-ico">{ico}</span>
              <span className="nb-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        {/* ══ HOME ══ */}
        {tab==="home"&&(
          <div>
            <WiiProgressGraph score={score} tasksDone={tasksDone} habitCount={habitCount} habitTotal={habitList.length} pomDone={pomDone}/>
            <div className="home-cards">
              <div className="hc"><div className="hcv">{tasksDone}/{tasks.length||0}</div><div className="hcl">Tasks done</div></div>
              <div className="hc"><div className="hcv">{habitCount}/{habitList.length}</div><div className="hcl">Habits</div></div>
              <div className="hc"><div className="hcv">{pomDone}</div><div className="hcl">Focus sessions</div></div>
            </div>
            <div className="home-msg">{HOME_MSGS[0](score)}</div>
          </div>
        )}

        {/* ══ TASKS ══ */}
        {tab==="tasks"&&(
          <div>
            <div className="prow"><div className="ptitle">Today's Tasks</div></div>
            <div className="ti-row">
              <input className="ti" placeholder="Add a task…" value={newTask}
                onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()}/>
              <select className="psel" value={newPrio} onChange={e=>setNewPrio(e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Mid</option>
                <option value="low">🟢 Low</option>
              </select>
              <button className="abtn" onClick={addTask}>+ Add</button>
            </div>
            <div className="tlist">
              {tasks.length===0&&<div className="t-empty">No tasks yet — add one above.</div>}
              {[...tasks].sort((a,b)=>{
                if(a.done!==b.done)return a.done?1:-1;
                return ({high:0,medium:1,low:2})[a.priority]-({high:0,medium:1,low:2})[b.priority];
              }).map(t=>(
                <div key={t.id} className={`titem${t.done?" dn":""}`}>
                  <div className={`tcb${t.done?" chk":""}`} onClick={()=>toggleTask(t.id)}>
                    {t.done&&<span style={{color:"#0e0e0f",fontSize:"0.7rem",fontWeight:"bold"}}>✓</span>}
                  </div>
                  <div className="pdot" style={{background:PRIORITIES[t.priority].color}}/>
                  <div className={`ttx${t.done?" x":""}`}>{t.text}</div>
                  <span style={{fontSize:"0.68rem",fontFamily:"var(--fm)",color:t.done?"var(--mt)":PRIORITIES[t.priority].color,flexShrink:0}}>
                    {t.done?"✓ ":""}{PRIO_PTS[t.priority]}pt{PRIO_PTS[t.priority]!==1?"s":""}
                  </span>
                  <button className="dbtn" onClick={()=>delTask(t.id)}>×</button>
                </div>
              ))}
            </div>
            {tasks.length>0&&<div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"0.71rem",color:"var(--mt)",fontFamily:"var(--fm)"}}>{tasksDone}/{tasks.length} complete</div>
              <div style={{fontSize:"0.71rem",color:"var(--mt)",fontFamily:"var(--fm)"}}>
                Tasks → <span style={{color:"var(--gold)"}}>{Math.round(taskScore)}</span>/60 score pts
              </div>
            </div>}
          </div>
        )}

        {/* ══ TIMER ══ */}
        {tab==="timer"&&(
          <div>
            <div className="prow">
              <div className="ptitle">Deep Focus Timer</div>
              <div style={{display:"flex",gap:5}}>
                <button className={`pact${showSoundSett?" on":""}`} onClick={()=>{setShowSoundSett(s=>!s);setShowTimerSett(false);}}>🔔 Sound</button>
                <button className={`pact${showTimerSett?" on":""}`} onClick={()=>{setDraftWork(timerCfg.work);setDraftBrk(timerCfg.brk);setShowTimerSett(s=>!s);setShowSoundSett(false);}}>⚙ Timer</button>
              </div>
            </div>
            <div className="pw">
              {showSoundSett&&(
                <div className="sett">
                  <div className="sett-title">🔔 Alert Sound</div>
                  <div className="sound-grid">
                    {SOUND_OPTIONS.map(s=>(
                      <div key={s.id} className={`snd-opt${soundChoice===s.id?" on":""}`} onClick={()=>setSoundChoice(s.id)}>
                        <div className="snd-name">{s.label}</div>
                        <div className="snd-desc">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="divdr"/>
                  <div className="vol-row">
                    <span className="vol-lbl">Volume</span>
                    <input className="vol-slider" type="range" min="0" max="100" value={soundVol} onChange={e=>setSoundVol(Number(e.target.value))}/>
                    <span style={{fontSize:"0.73rem",color:"var(--gold)",fontFamily:"var(--fm)",minWidth:30}}>{soundVol}%</span>
                    <button className="test-btn" onClick={()=>playSound(soundChoice,soundVol)}>▶ Test</button>
                  </div>
                </div>
              )}
              {showTimerSett&&(
                <div className="sett">
                  <div className="sett-title">⚙ Timer Durations</div>
                  <div className="sett-row">
                    <div><div className="sett-label">Focus duration</div><div className="sett-sub">1–90 min</div></div>
                    <div className="stepr">
                      <div className="step-btn" onClick={()=>nudge("work",-1)}>−</div>
                      <div className="step-val">{draftWork}m</div>
                      <div className="step-btn" onClick={()=>nudge("work",+1)}>+</div>
                    </div>
                  </div>
                  <div className="sett-row">
                    <div><div className="sett-label">Break duration</div><div className="sett-sub">1–30 min</div></div>
                    <div className="stepr">
                      <div className="step-btn" onClick={()=>nudge("brk",-1)}>−</div>
                      <div className="step-val">{draftBrk}m</div>
                      <div className="step-btn" onClick={()=>nudge("brk",+1)}>+</div>
                    </div>
                  </div>
                  <div className="divdr"/>
                  <button className="apply-btn" onClick={applyTimer}>Apply & Reset Timer</button>
                </div>
              )}
              <div className="pring">
                <svg className="psvg" viewBox="0 0 200 200">
                  <circle className="ptrk" cx="100" cy="100" r={radius}/>
                  <circle className={`pprog${pomMode==="break"?" brk":""}`}
                    cx="100" cy="100" r={radius} strokeDasharray={circ} strokeDashoffset={circ-offset}/>
                </svg>
                <div className="ptime">
                  <div className="pdigs">{mm}:{ss}</div>
                  <div className="pmlbl">{pomMode==="work"?"Focus":"Break"}</div>
                </div>
              </div>
              <div className="pctrls">
                <button className="pbtn pri" onClick={()=>setPomRunning(r=>!r)}>{pomRunning?"Pause":"Start"}</button>
                <button className="pbtn" onClick={()=>resetPom()}>Reset</button>
              </div>
              <div className="pstats">
                <div className="pst"><div className="num">{pomDone}</div><div className="lbl">Sessions</div></div>
                <div className="pst"><div className="num">{pomDone*timerCfg.work}</div><div className="lbl">Min focused</div></div>
              </div>
              <div className="ptip">
                <div className="ptip-t">💡 Focus Tip</div>
                <div className="ptip-b">{POMO_TIPS[pomDone%POMO_TIPS.length]}</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ HABITS ══ */}
        {tab==="habits"&&(
          <div>
            <div className="prow"><div className="ptitle">Daily Habits</div></div>
            <div className="habit-list" key={resetKey}>
              {habitList.length===0&&<div style={{textAlign:"center",color:"var(--mt)",fontSize:"0.84rem",padding:"28px 0",fontStyle:"italic"}}>No habits yet — add one below.</div>}
              {habitList.map(h=>(
                <UnifiedHabitCard key={h.id} habit={h} done={!!habitDone[h.id]} onToggle={()=>toggleHabit(h.id)} tk={tk}/>
              ))}
            </div>
            <div className="hab-prog">
              <div className="hab-prog-lbl">
                <span>Daily Progress</span>
                <span style={{color:"var(--gold)"}}>{habitCount}/{habitList.length}</span>
              </div>
              <div className="hpbar"><div className="hpfill" style={{width:habitList.length>0?`${(habitCount/habitList.length)*100}%`:"0%"}}/></div>
            </div>
            <div className="trk-section">
              <div className="trk-section-hdr">Customize</div>
              <ManageHabitsCard habitList={habitList} setHabitList={setHabitList} setHabitDone={setHabitDone}/>
            </div>
          </div>
        )}

        {/* ══ CHALLENGES ══ */}
        {tab==="challenges"&&<ChallengesTab onBonusEarned={pts=>{setChallengeBonus(b=>(typeof b==="number"?b:0)+pts); lbUpsert(auth.username, score, auth.role==="dev", auth.token, auth.userId);}}/>}

        {/* ══ LEADERBOARD ══ */}
        {tab==="board"&&<LeaderboardPanel currentUser={auth} currentScore={score}/>}

        {/* ══ DEV PANEL ══ */}
        {tab==="devpanel"&&isdev&&(
          <DevPanel
            auth={auth}
            onLogout={onLogout}
            score={score}
            taskScore={taskScore}
            habitScore={habitScore}
            safeBonus={safeBonus}
            setChallengeBonus={setChallengeBonus}
            uk={uk}
          />
        )}

        {/* ══ NUTRITION ══ */}
        {tab==="nutrition"&&<NutritionTab tk={tk}/>}

        {/* ══ TIPS ══ */}
        {tab==="tips"&&(
          <div>
            <div className="prow"><div className="ptitle">The Productivity Playbook</div></div>
            <div className="tips-list">
              {TIPS_DATA.map((t,i)=>(
                <div key={i} className="tip-card">
                  <div className="tip-t">{t.title}</div>
                  <div className="tip-b">{t.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
    </UserCtx.Provider>
  );
}
