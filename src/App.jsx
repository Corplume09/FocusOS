import { useState, useEffect, useRef, useCallback } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Constants ─────────────────────────────────────────────────────────────
const PRIORITIES = { high: { color: "#e05252" }, medium: { color: "#e09a30" }, low: { color: "#4caf88" } };
const PRIO_PTS   = { high: 5, medium: 3, low: 1 };

// tracker field links a habit to its built-in tracker; null = simple checkbox only
const DEFAULT_HABITS = [
  { id: 1, name: "Exercise",        emoji: "🏃", tracker: "activity"   },
  { id: 2, name: "Meditate",        emoji: "🧘", tracker: "meditation" },
  { id: 3, name: "Read",            emoji: "📚", tracker: "reading"    },
  { id: 4, name: "No social media", emoji: "📵", tracker: null         },
  { id: 5, name: "Drink water",     emoji: "💧", tracker: "water"      },
  { id: 6, name: "Sleep 8h",        emoji: "😴", tracker: null         },
];
const TRACKER_OPTIONS = [
  { id: "",           label: "No tracker"    },
  { id: "water",      label: "💧 Water"      },
  { id: "activity",   label: "🏃 Activity"   },
  { id: "reading",    label: "📚 Reading"    },
  { id: "meditation", label: "🧘 Meditation" },
];

const DEFAULT_TIMER = { work: 25, brk: 5 };
const EMOJI_OPTIONS = ["🎯","🏃","🧘","📚","📵","💧","😴","🥗","💪","✍️","🚴","🌿","🎵","🧹","💊","🛌","☀️","🥤","🧠","🏋️","🎨","🗣️","💻","🌱"];
const SOUND_OPTIONS = [
  { id: "bell",   label: "Bell",   desc: "Three soft bell tones"  },
  { id: "chime",  label: "Chime",  desc: "Ascending chime melody" },
  { id: "ding",   label: "Ding",   desc: "Single crisp ping"      },
  { id: "beep",   label: "Beep",   desc: "Triple electronic beep" },
  { id: "gong",   label: "Gong",   desc: "Deep resonant gong"     },
  { id: "silent", label: "Silent", desc: "No sound"               },
];
const POMO_TIPS = [
  "During work blocks, close email and social tabs entirely.",
  "A clear desk = a clear mind. Tidy before you start.",
  "Write tomorrow's top 3 tasks tonight.",
  "Your break is sacred — don't check messages.",
  "If you get distracted, write it down and return to focus.",
];
const TIPS_DATA = [
  { title: "🐸 Eat the Frog First",      body: "Start every day with your most important (and hardest) task. Once it's done, everything else feels easy and momentum carries you forward." },
  { title: "⏱ Time Block Your Calendar", body: "Assign tasks to fixed time slots. Treat them like meetings you can't cancel — this kills decision fatigue." },
  { title: "📵 Single-Tasking Wins",     body: "Multitasking reduces quality and speed. Close unrelated tabs, phone face-down. One task at a time, done well." },
  { title: "🔋 Protect Your Energy",     body: "Sleep is your #1 productivity tool. Exercise, hydration, and short breaks replenish mental fuel. Schedule them in." },
  { title: "📝 Weekly Review (15 min)",  body: "Every Sunday, review what you accomplished and plan your top 3 priorities for the week ahead." },
  { title: "✂️ Ruthlessly Prioritize",   body: "80% of results come from 20% of tasks. Ask: if I could only do ONE thing today, what would it be?" },
  { title: "📬 Batch Communication",     body: "Check email at set windows (e.g. 9am, 1pm, 5pm). Constant pings fracture deep focus." },
  { title: "🚫 Say No Strategically",    body: "Every yes is a no to something else. Guard your deep work time. A fast, polite no respects everyone." },
];

// ── Storage ───────────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);
function load(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function usePersist(key, fallback) {
  const [val, setVal] = useState(() => load(key, fallback));
  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(load(key, fallback)) : v;
    save(key, next); setVal(next);
  }, [key]);
  return [val, set];
}

// ── Sound Engine ─────────────────────────────────────────────────────────
function playSound(type, vol = 70) {
  if (type === "silent" || vol === 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const v = vol / 100;
    const mk = (freq, start, dur, t = "sine", amp = v) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination); osc.type = t;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime(amp, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    if      (type === "bell")  { [[880,0,1.4],[880,0.5,1.2],[660,1.0,1.0]].forEach(([f,s,d]) => { mk(f,s,d*0.3,"sine",v*0.5); mk(f*2,s,d*0.15,"sine",v*0.15); }); }
    else if (type === "chime") { [[523,0,1.8],[659,0.18,1.6],[784,0.36,1.4],[1047,0.54,1.8]].forEach(([f,s,d]) => mk(f,s,d,"sine",v*0.28)); }
    else if (type === "ding")  { mk(1320,0,0.05,"sine",v); mk(1320,0,1.0,"sine",v*0.4); }
    else if (type === "beep")  { [0,0.22,0.44].forEach(s => mk(900,s,0.15,"square",v*0.12)); }
    else if (type === "gong")  { mk(110,0,3.5,"sine",v*0.6); mk(220,0,2.5,"sine",v*0.25); mk(330,0,1.5,"sine",v*0.1); }
    setTimeout(() => ctx.close(), 5000);
  } catch (e) {}
}

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --bg:#0e0e0f; --sf:#18181b; --sf2:#222227; --bd:#2e2e35;
    --gold:#d4a84b; --gdim:#9a7432; --red:#e05252; --grn:#4caf88;
    --tx:#e8e6df; --mt:#7a7870;
    --fd:'DM Serif Display',serif; --fb:'DM Sans',sans-serif; --fm:'DM Mono',monospace;
  }
  body { background:var(--bg); color:var(--tx); font-family:var(--fb); }
  .app { min-height:100vh; max-width:980px; margin:0 auto; padding:32px 20px 80px; }

  /* Header */
  .hdr { display:flex; align-items:center; gap:16px; margin-bottom:36px; border-bottom:1px solid var(--bd); padding-bottom:20px; }
  .hdr h1 { font-family:var(--fd); font-size:2.2rem; color:var(--gold); letter-spacing:-0.5px; }
  .hdr-date { font-size:0.72rem; color:var(--mt); font-family:var(--fm); text-transform:uppercase; letter-spacing:0.08em; margin-top:4px; }
  .hdr-right { margin-left:auto; display:flex; align-items:center; gap:10px; }
  .score-pill { background:var(--sf2); border:1px solid var(--bd); border-radius:8px; padding:6px 14px; text-align:center; }
  .score-num  { font-family:var(--fd); font-size:1.5rem; color:var(--gold); line-height:1; }
  .score-lbl  { font-size:0.62rem; color:var(--mt); text-transform:uppercase; letter-spacing:0.1em; margin-top:1px; }
  .reset-day-btn { background:none; border:1px solid var(--bd); border-radius:7px; padding:7px 11px; color:var(--mt); font-family:var(--fb); cursor:pointer; transition:all 0.15s; display:flex; flex-direction:column; align-items:center; gap:2px; line-height:1; }
  .reset-day-btn:hover { border-color:var(--red); color:var(--red); }
  .rdb-icon { font-size:1rem; }
  .rdb-lbl  { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; }

  /* Confirm modal */
  .confirm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; z-index:200; animation:fi 0.15s ease; }
  .confirm-box { background:var(--sf); border:1px solid var(--bd); border-radius:14px; padding:28px 28px 22px; max-width:380px; width:92%; animation:fi 0.18s ease; }
  .confirm-icon  { font-size:1.8rem; margin-bottom:10px; }
  .confirm-title { font-family:var(--fd); font-size:1.25rem; color:var(--tx); margin-bottom:8px; }
  .confirm-desc  { font-size:0.82rem; color:var(--mt); line-height:1.6; margin-bottom:8px; }
  .confirm-list  { margin:6px 0 18px; padding-left:14px; }
  .confirm-list li { font-size:0.78rem; color:var(--mt); margin-bottom:4px; line-height:1.4; }
  .confirm-btns  { display:flex; gap:10px; justify-content:flex-end; }
  .confirm-cancel { background:var(--sf2); border:1px solid var(--bd); border-radius:7px; padding:9px 18px; color:var(--mt); font-family:var(--fb); font-size:0.82rem; cursor:pointer; transition:all 0.15s; }
  .confirm-cancel:hover { color:var(--tx); border-color:var(--gdim); }
  .confirm-ok { background:var(--red); border:none; border-radius:7px; padding:9px 20px; color:#fff; font-family:var(--fb); font-weight:600; font-size:0.82rem; cursor:pointer; transition:opacity 0.15s; }
  .confirm-ok:hover { opacity:0.85; }

  /* Nav */
  .nav { display:flex; gap:4px; margin-bottom:28px; background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:4px; }
  .nb  { flex:1; padding:8px 4px; border:none; border-radius:7px; background:transparent; color:var(--mt); font-family:var(--fb); font-size:0.8rem; font-weight:500; cursor:pointer; transition:all 0.18s; }
  .nb.on { background:var(--sf2); color:var(--tx); border:1px solid var(--bd); }
  .nb:hover:not(.on) { color:var(--tx); }

  /* Panel */
  .prow { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:20px; }
  .ptitle { font-family:var(--fd); font-size:1.3rem; color:var(--tx); font-style:italic; }
  .pact { background:none; border:1px solid var(--bd); border-radius:6px; padding:5px 12px; color:var(--mt); font-family:var(--fb); font-size:0.75rem; cursor:pointer; transition:all 0.15s; }
  .pact:hover,.pact.on { border-color:var(--gdim); color:var(--gold); }

  /* Tasks */
  .ti-row { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
  .ti { flex:1; min-width:140px; background:var(--sf); border:1px solid var(--bd); border-radius:8px; padding:10px 14px; color:var(--tx); font-family:var(--fb); font-size:0.9rem; outline:none; transition:border 0.15s; }
  .ti:focus { border-color:var(--gdim); } .ti::placeholder { color:var(--mt); }
  .psel { background:var(--sf); border:1px solid var(--bd); border-radius:8px; padding:10px; color:var(--tx); font-family:var(--fb); font-size:0.85rem; cursor:pointer; outline:none; }
  .abtn { background:var(--gold); color:#0e0e0f; border:none; border-radius:8px; padding:10px 18px; font-family:var(--fb); font-weight:600; font-size:0.85rem; cursor:pointer; transition:opacity 0.15s; white-space:nowrap; }
  .abtn:hover { opacity:0.85; }
  .tlist { display:flex; flex-direction:column; gap:8px; }
  .titem { display:flex; align-items:center; gap:12px; background:var(--sf); border:1px solid var(--bd); border-radius:8px; padding:12px 14px; transition:opacity 0.2s; }
  .titem.dn { opacity:0.42; }
  .tcb { width:18px; height:18px; border-radius:5px; border:2px solid var(--bd); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.15s; }
  .tcb.chk { background:var(--grn); border-color:var(--grn); }
  .ttx { flex:1; font-size:0.88rem; line-height:1.4; }
  .ttx.x { text-decoration:line-through; color:var(--mt); }
  .pdot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .dbtn { background:none; border:none; color:var(--mt); cursor:pointer; font-size:1.1rem; opacity:0; transition:opacity 0.15s; padding:0 2px; }
  .titem:hover .dbtn { opacity:1; }
  .t-empty { text-align:center; color:var(--mt); font-size:0.85rem; padding:32px 0; font-style:italic; }

  /* Pomodoro */
  .pw { display:flex; flex-direction:column; align-items:center; gap:22px; padding:8px 0; }
  .pring { position:relative; width:200px; height:200px; }
  .psvg  { width:100%; height:100%; transform:rotate(-90deg); }
  .ptrk  { fill:none; stroke:var(--sf2); stroke-width:8; }
  .pprog { fill:none; stroke:var(--gold); stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 0.5s linear; }
  .pprog.brk { stroke:var(--grn); }
  .ptime { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .pdigs { font-family:var(--fm); font-size:2.4rem; color:var(--tx); letter-spacing:0.05em; }
  .pmlbl { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.15em; color:var(--mt); margin-top:4px; }
  .pctrls { display:flex; gap:12px; }
  .pbtn { background:var(--sf); border:1px solid var(--bd); border-radius:50px; padding:10px 28px; color:var(--tx); font-family:var(--fb); font-weight:500; font-size:0.85rem; cursor:pointer; transition:all 0.15s; }
  .pbtn:hover { border-color:var(--gdim); color:var(--gold); }
  .pbtn.pri { background:var(--gold); color:#0e0e0f; border-color:var(--gold); font-weight:600; }
  .pbtn.pri:hover { opacity:0.85; }
  .pstats { display:flex; gap:28px; }
  .pst .num { font-family:var(--fd); font-size:1.6rem; color:var(--gold); text-align:center; }
  .pst .lbl { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--mt); text-align:center; }
  .ptip { background:var(--sf); border:1px solid var(--bd); border-radius:8px; padding:14px 18px; width:100%; max-width:400px; }
  .ptip-t { font-size:0.7rem; text-transform:uppercase; letter-spacing:0.12em; color:var(--mt); margin-bottom:6px; }
  .ptip-b { font-size:0.82rem; color:var(--tx); line-height:1.5; font-style:italic; }

  /* Settings panels */
  .sett { background:var(--sf); border:1px solid var(--gdim); border-radius:10px; padding:18px 20px; width:100%; max-width:420px; animation:fi 0.18s ease; }
  @keyframes fi { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .sett-title { font-size:0.7rem; text-transform:uppercase; letter-spacing:0.14em; color:var(--mt); margin-bottom:14px; }
  .sett-row  { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .sett-label { font-size:0.85rem; color:var(--tx); }
  .sett-sub   { font-size:0.7rem; color:var(--mt); margin-top:2px; }
  .stepr { display:flex; align-items:center; gap:8px; }
  .step-btn { background:var(--sf2); border:1px solid var(--bd); border-radius:6px; width:28px; height:28px; color:var(--tx); font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; user-select:none; transition:all 0.15s; }
  .step-btn:hover { border-color:var(--gdim); color:var(--gold); }
  .step-val { font-family:var(--fm); font-size:0.95rem; color:var(--gold); min-width:36px; text-align:center; }
  .divdr { height:1px; background:var(--bd); margin:12px 0; }
  .apply-btn { background:var(--gold); color:#0e0e0f; border:none; border-radius:7px; padding:9px 16px; font-family:var(--fb); font-weight:600; font-size:0.82rem; cursor:pointer; width:100%; transition:opacity 0.15s; }
  .apply-btn:hover { opacity:0.85; }
  .sound-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px; }
  .snd-opt { background:var(--sf2); border:1px solid var(--bd); border-radius:7px; padding:8px 6px; text-align:center; cursor:pointer; transition:all 0.15s; }
  .snd-opt:hover { border-color:var(--gdim); }
  .snd-opt.on { border-color:var(--gold); background:rgba(212,168,75,0.08); }
  .snd-name { font-size:0.8rem; font-weight:500; color:var(--tx); }
  .snd-desc { font-size:0.65rem; color:var(--mt); margin-top:2px; }
  .vol-row  { display:flex; align-items:center; gap:10px; }
  .vol-lbl  { font-size:0.8rem; color:var(--mt); white-space:nowrap; }
  .vol-slider { flex:1; accent-color:var(--gold); cursor:pointer; }
  .test-btn { background:var(--sf2); border:1px solid var(--bd); border-radius:6px; padding:6px 12px; color:var(--mt); font-family:var(--fb); font-size:0.75rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .test-btn:hover { border-color:var(--gdim); color:var(--gold); }

  /* ════ UNIFIED HABIT CARDS ════ */
  .habit-list { display:flex; flex-direction:column; gap:8px; }

  .ucard { background:var(--sf); border:1px solid var(--bd); border-radius:10px; overflow:hidden; transition:border-color 0.2s, background 0.2s; }
  .ucard.done { border-color:rgba(76,175,136,0.45); background:rgba(76,175,136,0.03); }

  /* header row */
  .ucard-hdr { display:flex; align-items:center; gap:12px; padding:13px 16px; user-select:none; }
  .ucard-hdr.simple { cursor:pointer; transition:background 0.15s; }
  .ucard-hdr.simple:hover { background:var(--sf2); }

  /* the expand-clickable zone for tracked habits */
  .ucard-expand { display:flex; align-items:center; gap:12px; flex:1; cursor:pointer; min-width:0; }
  .ucard-expand:hover .u-chevron { color:var(--gold); }

  /* checkbox */
  .ucb { width:20px; height:20px; flex-shrink:0; border-radius:6px; border:2px solid var(--bd); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
  .ucb.chk { background:var(--grn); border-color:var(--grn); }
  .ucb:hover:not(.chk) { border-color:var(--grn); }

  .u-emoji   { font-size:1.05rem; flex-shrink:0; }
  .u-name    { font-size:0.88rem; font-weight:500; flex:1; min-width:0; color:var(--tx); transition:color 0.15s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .u-name.x  { text-decoration:line-through; color:var(--mt); }
  .u-summary { font-size:0.74rem; color:var(--gold); font-family:var(--fm); white-space:nowrap; flex-shrink:0; padding:2px 7px; background:rgba(212,168,75,0.08); border-radius:5px; }
  .u-chevron { color:var(--mt); font-size:0.72rem; transition:transform 0.2s, color 0.15s; flex-shrink:0; }
  .u-chevron.open { transform:rotate(180deg); }

  /* expanded tracker body */
  .ucard-body { padding:4px 16px 16px; border-top:1px solid var(--bd); animation:fi 0.15s ease; }

  /* tracker internals (shared) */
  .trk-row  { display:flex; align-items:center; gap:10px; margin-top:12px; flex-wrap:wrap; }
  .trk-log  { margin-top:10px; display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto; }
  .trk-entry { display:flex; align-items:center; gap:8px; background:var(--sf2); border-radius:6px; padding:7px 10px; font-size:0.8rem; }
  .trk-entry-text { flex:1; color:var(--tx); }
  .trk-entry-val  { font-family:var(--fm); font-size:0.75rem; color:var(--gold); }
  .trk-entry-del  { background:none; border:none; color:var(--mt); cursor:pointer; font-size:0.85rem; opacity:0.5; transition:opacity 0.15s; }
  .trk-entry-del:hover { opacity:1; color:var(--red); }
  .trk-total { margin-top:10px; background:var(--sf2); border-radius:8px; padding:10px 14px; display:flex; gap:20px; }
  .trk-tot-item .val { font-family:var(--fm); font-size:1.1rem; color:var(--gold); }
  .trk-tot-item .lbl { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--mt); }
  .trk-goal-bar { margin-top:10px; }
  .trk-goal-bar .bar  { height:5px; background:var(--bd); border-radius:3px; overflow:hidden; margin-top:5px; }
  .trk-goal-bar .fill { height:100%; background:linear-gradient(90deg,var(--gdim),var(--gold)); border-radius:3px; transition:width 0.4s; }
  .trk-mini-inp { background:var(--sf2); border:1px solid var(--bd); border-radius:7px; padding:7px 10px; color:var(--tx); font-family:var(--fb); font-size:0.85rem; outline:none; transition:border 0.15s; min-width:0; }
  .trk-mini-inp:focus { border-color:var(--gdim); } .trk-mini-inp::placeholder { color:var(--mt); }
  .trk-mini-inp.w80 { width:80px; }
  .unit-tog  { display:flex; border:1px solid var(--bd); border-radius:7px; overflow:hidden; }
  .unit-opt  { padding:6px 12px; font-size:0.78rem; font-weight:500; cursor:pointer; background:var(--sf2); color:var(--mt); border:none; font-family:var(--fb); transition:all 0.15s; }
  .unit-opt.on { background:var(--gdim); color:#0e0e0f; }
  .qk-btns { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .qk-btn  { background:var(--sf2); border:1px solid var(--bd); border-radius:6px; padding:5px 10px; font-size:0.75rem; color:var(--mt); cursor:pointer; font-family:var(--fb); transition:all 0.15s; }
  .qk-btn:hover { border-color:var(--gdim); color:var(--gold); }
  .smol-btn { background:var(--sf2); border:1px solid var(--bd); border-radius:6px; padding:7px 12px; color:var(--mt); font-family:var(--fb); font-size:0.78rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .smol-btn:hover { border-color:var(--gdim); color:var(--gold); }
  .smol-btn.gold { background:rgba(212,168,75,0.12); border-color:var(--gdim); color:var(--gold); }

  /* Progress bar (below habit list) */
  .hab-prog { margin-top:14px; background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:13px 18px; }
  .hab-prog-lbl { font-size:0.72rem; color:var(--mt); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; display:flex; justify-content:space-between; }
  .hpbar  { height:5px; background:var(--sf2); border-radius:3px; overflow:hidden; }
  .hpfill { height:100%; background:linear-gradient(90deg,var(--gdim),var(--gold)); border-radius:3px; transition:width 0.4s cubic-bezier(.4,0,.2,1); }

  /* Manage habits collapsible */
  .trk-section     { margin-top:20px; }
  .trk-section-hdr { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.16em; color:var(--mt); margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .trk-section-hdr::before { content:''; flex:1; height:1px; background:var(--bd); }
  .trk-section-hdr::after  { content:''; flex:1; height:1px; background:var(--bd); }
  .trk-card { background:var(--sf); border:1px solid var(--bd); border-radius:10px; overflow:hidden; }
  .trk-hdr  { display:flex; align-items:center; gap:10px; padding:13px 16px; cursor:pointer; user-select:none; transition:background 0.15s; }
  .trk-hdr:hover { background:var(--sf2); }
  .trk-ico      { font-size:1.1rem; }
  .trk-name     { font-size:0.88rem; font-weight:600; flex:1; }
  .trk-summary  { font-size:0.75rem; color:var(--gold); font-family:var(--fm); }
  .trk-chevron  { color:var(--mt); font-size:0.75rem; transition:transform 0.2s; }
  .trk-chevron.open { transform:rotate(180deg); }
  .trk-body { padding:0 16px 16px; border-top:1px solid var(--bd); animation:fi 0.15s ease; }

  .mh-row     { display:flex; align-items:center; gap:10px; background:var(--sf2); border-radius:7px; padding:9px 12px; margin-bottom:6px; }
  .mh-emoji   { font-size:1rem; flex-shrink:0; }
  .mh-name    { flex:1; font-size:0.85rem; color:var(--tx); }
  .mh-tag     { font-size:0.68rem; color:var(--mt); background:var(--bg); border:1px solid var(--bd); border-radius:5px; padding:2px 6px; white-space:nowrap; }
  .mh-del     { background:none; border:none; color:var(--mt); cursor:pointer; font-size:0.9rem; padding:2px 4px; border-radius:4px; opacity:0.5; transition:all 0.15s; }
  .mh-del:hover { opacity:1; color:var(--red); background:rgba(224,82,82,0.08); }
  .mh-divider { height:1px; background:var(--bd); margin:14px 0 12px; }
  .mh-add-ttl { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.14em; color:var(--mt); margin-bottom:10px; }
  .mh-add-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .esel { background:var(--sf2); border:1px solid var(--bd); border-radius:8px; padding:8px 6px; font-size:1rem; color:var(--tx); cursor:pointer; outline:none; }
  .tsel { background:var(--sf2); border:1px solid var(--bd); border-radius:8px; padding:8px 10px; font-size:0.8rem; color:var(--tx); cursor:pointer; outline:none; font-family:var(--fb); }
  .hni  { flex:1; min-width:90px; background:var(--sf2); border:1px solid var(--bd); border-radius:8px; padding:8px 12px; color:var(--tx); font-family:var(--fb); font-size:0.85rem; outline:none; transition:border 0.15s; }
  .hni:focus { border-color:var(--gdim); } .hni::placeholder { color:var(--mt); }

  /* Tips */
  .tips-list { display:flex; flex-direction:column; gap:12px; }
  .tip-card  { background:var(--sf); border:1px solid var(--bd); border-left:3px solid var(--gold); border-radius:8px; padding:14px 16px; }
  .tip-t { font-weight:600; font-size:0.88rem; color:var(--gold); margin-bottom:4px; }
  .tip-b { font-size:0.82rem; color:var(--mt); line-height:1.55; }

  @media(max-width:520px) {
    .hdr h1 { font-size:1.6rem; }
    .rdb-lbl { display:none; }
    .sound-grid { grid-template-columns:1fr 1fr; }
    .mh-add-row { flex-direction:column; align-items:stretch; }
    .mh-add-row .abtn { width:100%; }
  }
`;

// ── Shared card header ────────────────────────────────────────────────────
function UCardHeader({ habit, done, onToggle, summary, open, onExpand, hasTracker }) {
  if (!hasTracker) {
    return (
      <div className="ucard-hdr simple" onClick={onToggle}>
        <div className={`ucb${done ? " chk" : ""}`}>
          {done && <span style={{color:"#0e0e0f",fontSize:"0.65rem",fontWeight:"bold"}}>✓</span>}
        </div>
        <span className="u-emoji">{habit.emoji}</span>
        <span className={`u-name${done ? " x" : ""}`}>{habit.name}</span>
      </div>
    );
  }
  return (
    <div className="ucard-hdr">
      <div className={`ucb${done ? " chk" : ""}`}
        onClick={e => { e.stopPropagation(); onToggle(); }}>
        {done && <span style={{color:"#0e0e0f",fontSize:"0.65rem",fontWeight:"bold"}}>✓</span>}
      </div>
      <div className="ucard-expand" onClick={onExpand}>
        <span className="u-emoji">{habit.emoji}</span>
        <span className={`u-name${done ? " x" : ""}`}>{habit.name}</span>
        {summary && <span className="u-summary">{summary}</span>}
        <span className={`u-chevron${open ? " open" : ""}`}>▼</span>
      </div>
    </div>
  );
}

// ── Simple habit card (no tracker) ───────────────────────────────────────
function SimpleHabitCard({ habit, done, onToggle }) {
  return (
    <div className={`ucard${done ? " done" : ""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle} hasTracker={false} />
    </div>
  );
}

// ── Water habit card ──────────────────────────────────────────────────────
function WaterHabitCard({ habit, done, onToggle, tk }) {
  const [open,    setOpen]    = useState(false);
  const [unit,    setUnit]    = usePersist("trk_water_unit",    "oz");
  const [goal,    setGoal]    = usePersist("trk_water_goal_oz", 64);
  const [entries, setEntries] = usePersist(`trk_water_${tk}`,   []);
  const [custom,  setCustom]  = useState("");

  const OZ_Q = [8, 12, 16, 24, 32], ML_Q = [250, 350, 500, 750];
  const totalOz  = entries.reduce((s,e) => s + e.oz, 0);
  const fmt      = v => unit === "oz" ? Math.round(v) + " oz" : Math.round(v * 29.5735) + " ml";
  const goalDisp = unit === "oz" ? goal + " oz" : Math.round(goal * 29.5735) + " ml";
  const pct      = Math.min(100, (totalOz / goal) * 100);

  const add = oz => setEntries(e => [...e, { id: Date.now(), oz }]);
  const addCustom = () => { const n = parseFloat(custom); if (!n || n <= 0) return; add(unit==="oz" ? n : n/29.5735); setCustom(""); };
  const del = id => setEntries(e => e.filter(x => x.id !== id));

  return (
    <div className={`ucard${done ? " done" : ""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle}
        summary={fmt(totalOz)} open={open} onExpand={() => setOpen(o => !o)} hasTracker />
      {open && (
        <div className="ucard-body">
          <div className="trk-row">
            <span style={{fontSize:"0.8rem",color:"var(--mt)"}}>Unit:</span>
            <div className="unit-tog">
              <button className={`unit-opt${unit==="oz"?" on":""}`} onClick={() => setUnit("oz")}>oz</button>
              <button className={`unit-opt${unit==="ml"?" on":""}`} onClick={() => setUnit("ml")}>ml</button>
            </div>
            <span style={{fontSize:"0.78rem",color:"var(--mt)"}}>Goal:</span>
            <input className="trk-mini-inp w80" type="number"
              value={unit==="oz" ? goal : Math.round(goal*29.5735)}
              onChange={e => { const v=parseFloat(e.target.value)||0; setGoal(unit==="oz"?v:v/29.5735); }}
              placeholder="64" />
            <span style={{fontSize:"0.75rem",color:"var(--mt)"}}>{unit}</span>
          </div>
          <div className="qk-btns">
            {(unit==="oz" ? OZ_Q : ML_Q).map(q => (
              <button key={q} className="qk-btn" onClick={() => add(unit==="oz" ? q : q/29.5735)}>+{q}{unit}</button>
            ))}
          </div>
          <div className="trk-row">
            <input className="trk-mini-inp w80" type="number" placeholder={`Custom ${unit}`} value={custom}
              onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key==="Enter" && addCustom()} />
            <button className="smol-btn" onClick={addCustom}>+ Log</button>
          </div>
          <div className="trk-goal-bar">
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:"var(--mt)"}}>
              <span>{fmt(totalOz)}</span><span>/ {goalDisp}</span>
            </div>
            <div className="bar"><div className="fill" style={{width:`${pct}%`}} /></div>
          </div>
          {entries.length > 0 && (
            <div className="trk-log">
              {[...entries].reverse().map(e => (
                <div key={e.id} className="trk-entry">
                  <span className="trk-entry-text">💧 logged</span>
                  <span className="trk-entry-val">{fmt(e.oz)}</span>
                  <button className="trk-entry-del" onClick={() => del(e.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activity habit card ───────────────────────────────────────────────────
function ActivityHabitCard({ habit, done, onToggle, tk }) {
  const [open,    setOpen]    = useState(false);
  const [unit,    setUnit]    = usePersist("trk_act_unit",  "mi");
  const [entries, setEntries] = usePersist(`trk_act_${tk}`, []);
  const [actName, setActName] = useState("Running");
  const [dist,    setDist]    = useState("");

  const ACTS      = ["Running","Walking","Cycling","Swimming","Hiking","Gym","Yoga","Rowing"];
  const totalDist = entries.reduce((s,e) => s + (e.unit===unit ? e.dist : (unit==="mi" ? e.dist*0.621371 : e.dist*1.60934)), 0);
  const summary   = entries.length > 0 ? `${totalDist.toFixed(1)} ${unit}` : null;

  const log = () => { const d=parseFloat(dist); if (!d||d<=0) return; setEntries(e=>[...e,{id:Date.now(),activity:actName||"Activity",dist:d,unit}]); setDist(""); };
  const del = id => setEntries(e => e.filter(x => x.id !== id));

  return (
    <div className={`ucard${done ? " done" : ""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle}
        summary={summary} open={open} onExpand={() => setOpen(o => !o)} hasTracker />
      {open && (
        <div className="ucard-body">
          <div className="trk-row">
            <span style={{fontSize:"0.8rem",color:"var(--mt)"}}>Unit:</span>
            <div className="unit-tog">
              <button className={`unit-opt${unit==="mi"?" on":""}`} onClick={() => setUnit("mi")}>mi</button>
              <button className={`unit-opt${unit==="km"?" on":""}`} onClick={() => setUnit("km")}>km</button>
            </div>
          </div>
          <div className="trk-row">
            <select className="trk-mini-inp" style={{flex:1}} value={actName} onChange={e => setActName(e.target.value)}>
              {ACTS.map(a => <option key={a}>{a}</option>)}
            </select>
            <input className="trk-mini-inp w80" type="number" placeholder={`Dist (${unit})`} value={dist}
              onChange={e => setDist(e.target.value)} onKeyDown={e => e.key==="Enter" && log()} />
            <button className="smol-btn" onClick={log}>+ Log</button>
          </div>
          {entries.length > 0 && (
            <>
              <div className="trk-log">
                {[...entries].reverse().map(e => (
                  <div key={e.id} className="trk-entry">
                    <span className="trk-entry-text">{e.activity}</span>
                    <span className="trk-entry-val">{e.dist} {e.unit}</span>
                    <button className="trk-entry-del" onClick={() => del(e.id)}>✕</button>
                  </div>
                ))}
              </div>
              <div className="trk-total">
                <div className="trk-tot-item"><div className="val">{totalDist.toFixed(1)}</div><div className="lbl">{unit} today</div></div>
                <div className="trk-tot-item"><div className="val">{entries.length}</div><div className="lbl">sessions</div></div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reading habit card ────────────────────────────────────────────────────
function ReadingHabitCard({ habit, done, onToggle, tk }) {
  const [open,     setOpen]     = useState(false);
  const [entries,  setEntries]  = usePersist(`trk_read_${tk}`,  []);
  const [finished, setFinished] = usePersist(`trk_books_${tk}`, 0);
  const [book,     setBook]     = useState("");
  const [pages,    setPages]    = useState("");

  const totalPages = entries.reduce((s,e) => s + e.pages, 0);
  const summary    = totalPages > 0 ? `${totalPages} pages` : null;

  const log = () => { const p=parseInt(pages); if (!p||p<=0) return; setEntries(e=>[...e,{id:Date.now(),book:book||"Reading",pages:p}]); setPages(""); };
  const del = id => setEntries(e => e.filter(x => x.id !== id));

  return (
    <div className={`ucard${done ? " done" : ""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle}
        summary={summary} open={open} onExpand={() => setOpen(o => !o)} hasTracker />
      {open && (
        <div className="ucard-body">
          <div className="trk-row">
            <input className="trk-mini-inp" style={{flex:1}} placeholder="Book title (optional)"
              value={book} onChange={e => setBook(e.target.value)} />
          </div>
          <div className="trk-row">
            <input className="trk-mini-inp w80" type="number" placeholder="Pages" value={pages}
              onChange={e => setPages(e.target.value)} onKeyDown={e => e.key==="Enter" && log()} />
            <button className="smol-btn" onClick={log}>+ Log pages</button>
            <button className="smol-btn gold" onClick={() => setFinished(f => f+1)}>✓ Finished book</button>
          </div>
          {entries.length > 0 && (
            <div className="trk-log">
              {[...entries].reverse().map(e => (
                <div key={e.id} className="trk-entry">
                  <span className="trk-entry-text">{e.book}</span>
                  <span className="trk-entry-val">{e.pages} pages</span>
                  <button className="trk-entry-del" onClick={() => del(e.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="trk-total">
            <div className="trk-tot-item"><div className="val">{totalPages}</div><div className="lbl">pages today</div></div>
            <div className="trk-tot-item"><div className="val">{finished}</div><div className="lbl">books finished</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Meditation habit card ─────────────────────────────────────────────────
function MeditationHabitCard({ habit, done, onToggle, tk }) {
  const [open,    setOpen]    = useState(false);
  const [entries, setEntries] = usePersist(`trk_med_${tk}`, []);
  const [mins,    setMins]    = useState(10);

  const QUICK     = [5, 10, 15, 20, 30];
  const totalMins = entries.reduce((s,e) => s + e.mins, 0);
  const summary   = totalMins > 0 ? `${totalMins} min` : null;

  const log = () => { if (mins<=0) return; setEntries(e=>[...e,{id:Date.now(),mins}]); };
  const del = id => setEntries(e => e.filter(x => x.id !== id));

  return (
    <div className={`ucard${done ? " done" : ""}`}>
      <UCardHeader habit={habit} done={done} onToggle={onToggle}
        summary={summary} open={open} onExpand={() => setOpen(o => !o)} hasTracker />
      {open && (
        <div className="ucard-body">
          <div className="trk-row">
            <span style={{fontSize:"0.8rem",color:"var(--mt)"}}>Duration:</span>
            <div className="stepr">
              <div className="step-btn" onClick={() => setMins(m => Math.max(1,m-1))}>−</div>
              <div className="step-val">{mins}m</div>
              <div className="step-btn" onClick={() => setMins(m => m+1)}>+</div>
            </div>
            <button className="smol-btn" onClick={log}>+ Log session</button>
          </div>
          <div className="qk-btns">
            {QUICK.map(q => (
              <button key={q} className="qk-btn"
                onClick={() => { setMins(q); setEntries(e=>[...e,{id:Date.now(),mins:q}]); }}>
                {q} min
              </button>
            ))}
          </div>
          {entries.length > 0 && (
            <div className="trk-log">
              {[...entries].reverse().map(e => (
                <div key={e.id} className="trk-entry">
                  <span className="trk-entry-text">🧘 Session</span>
                  <span className="trk-entry-val">{e.mins} min</span>
                  <button className="trk-entry-del" onClick={() => del(e.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="trk-total">
            <div className="trk-tot-item"><div className="val">{totalMins}</div><div className="lbl">min today</div></div>
            <div className="trk-tot-item"><div className="val">{entries.length}</div><div className="lbl">sessions</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────
function UnifiedHabitCard({ habit, done, onToggle, tk }) {
  const p = { habit, done, onToggle, tk };
  switch (habit.tracker) {
    case "water":      return <WaterHabitCard      {...p} />;
    case "activity":   return <ActivityHabitCard   {...p} />;
    case "reading":    return <ReadingHabitCard     {...p} />;
    case "meditation": return <MeditationHabitCard  {...p} />;
    default:           return <SimpleHabitCard habit={habit} done={done} onToggle={onToggle} />;
  }
}

// ── Manage Habits collapsible card ────────────────────────────────────────
function ManageHabitsCard({ habitList, setHabitList, setHabitDone }) {
  const [open,     setOpen]     = useState(false);
  const [name,     setName]     = useState("");
  const [emoji,    setEmoji]    = useState("🎯");
  const [tracker,  setTracker]  = useState("");

  const del = id => {
    setHabitList(l => l.filter(h => h.id !== id));
    setHabitDone(d => { const n={...d}; delete n[id]; return n; });
  };
  const add = () => {
    if (!name.trim()) return;
    setHabitList(l => [...l, { id: Date.now(), name: name.trim(), emoji, tracker: tracker || null }]);
    setName(""); setTracker("");
  };
  const tLabel = id => TRACKER_OPTIONS.find(t => t.id === id)?.label ?? "No tracker";

  return (
    <div className="trk-card">
      <div className="trk-hdr" onClick={() => setOpen(o => !o)}>
        <span className="trk-ico">⚙️</span>
        <span className="trk-name">Manage Habits</span>
        <span className="trk-summary">{habitList.length} habit{habitList.length!==1?"s":""}</span>
        <span className={`trk-chevron${open?" open":""}`}>▼</span>
      </div>
      {open && (
        <div className="trk-body">
          {habitList.length === 0 && (
            <div style={{marginTop:10,fontSize:"0.82rem",color:"var(--mt)",fontStyle:"italic"}}>No habits yet.</div>
          )}
          {habitList.map(h => (
            <div key={h.id} className="mh-row">
              <span className="mh-emoji">{h.emoji}</span>
              <span className="mh-name">{h.name}</span>
              {h.tracker && <span className="mh-tag">{tLabel(h.tracker)}</span>}
              <button className="mh-del" onClick={() => del(h.id)}>✕</button>
            </div>
          ))}
          <div className="mh-divider" />
          <div className="mh-add-ttl">+ Add New Habit</div>
          <div className="mh-add-row">
            <select className="esel" value={emoji} onChange={e => setEmoji(e.target.value)}>
              {EMOJI_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input className="hni" placeholder="Habit name…" value={name}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter" && add()} />
            <select className="tsel" value={tracker} onChange={e => setTracker(e.target.value)}>
              {TRACKER_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button className="abtn" onClick={add}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab,  setTab]  = useState("tasks");
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const tk    = todayKey();

  // Tasks
  const [tasks,   setTasks]   = usePersist("prod_tasks_v2", []);
  const [newTask, setNewTask] = useState("");
  const [newPrio, setNewPrio] = useState("medium");
  const addTask    = () => { if (!newTask.trim()) return; setTasks(t=>[...t,{id:Date.now(),text:newTask.trim(),priority:newPrio,done:false}]); setNewTask(""); };
  const toggleTask = id => setTasks(t => t.map(x => x.id===id ? {...x,done:!x.done} : x));
  const delTask    = id => setTasks(t => t.filter(x => x.id!==id));
  const tasksDone   = tasks.filter(t=>t.done).length;
  const totalWeight = tasks.reduce((s,t)=>s+PRIO_PTS[t.priority],0);
  const doneWeight  = tasks.filter(t=>t.done).reduce((s,t)=>s+PRIO_PTS[t.priority],0);

  // Timer
  const [timerCfg,      setTimerCfg]      = usePersist("prod_timer_cfg_v2", DEFAULT_TIMER);
  const [showTimerSett, setShowTimerSett] = useState(false);
  const [showSoundSett, setShowSoundSett] = useState(false);
  const [draftWork,     setDraftWork]     = useState(timerCfg.work);
  const [draftBrk,      setDraftBrk]      = useState(timerCfg.brk);
  const [soundChoice,   setSoundChoice]   = usePersist("prod_sound","bell");
  const [soundVol,      setSoundVol]      = usePersist("prod_vol",  70);

  // Pomodoro
  const [pomSecs,    setPomSecs]    = useState(timerCfg.work * 60);
  const [pomRunning, setPomRunning] = useState(false);
  const [pomMode,    setPomMode]    = useState("work");
  const [pomDone,    setPomDone]    = usePersist("prod_pomo_count", 0);
  const pomRef = useRef(null);

  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomSecs(s => {
          if (s <= 1) {
            clearInterval(pomRef.current); setPomRunning(false); playSound(soundChoice, soundVol);
            if (pomMode==="work") { setPomDone(c=>c+1); setPomMode("break"); return timerCfg.brk*60; }
            else                  { setPomMode("work"); return timerCfg.work*60; }
          }
          return s - 1;
        });
      }, 1000);
    } else { clearInterval(pomRef.current); }
    return () => clearInterval(pomRef.current);
  }, [pomRunning, pomMode, timerCfg, soundChoice, soundVol]);

  const resetPom  = (cfg=timerCfg) => { setPomRunning(false); setPomMode("work"); setPomSecs(cfg.work*60); };
  const applyTimer = () => {
    const next = { work:Math.max(1,Math.min(90,draftWork)), brk:Math.max(1,Math.min(30,draftBrk)) };
    setTimerCfg(next); resetPom(next); setShowTimerSett(false);
  };
  const nudge = (f,d) => f==="work" ? setDraftWork(v=>Math.max(1,Math.min(90,v+d))) : setDraftBrk(v=>Math.max(1,Math.min(30,v+d)));

  const total  = (pomMode==="work" ? timerCfg.work : timerCfg.brk) * 60;
  const radius = 86, circ = 2*Math.PI*radius;
  const offset = circ*(1 - pomSecs/total);
  const mm = String(Math.floor(pomSecs/60)).padStart(2,"0");
  const ss = String(pomSecs%60).padStart(2,"0");

  // Habits
  const [habitList, setHabitList] = usePersist("prod_habit_list_v2", DEFAULT_HABITS);
  const [habitDone, setHabitDone] = usePersist(`prod_habits_${tk}`, {});
  const toggleHabit = id => setHabitDone(p => ({...p,[id]:!p[id]}));
  const habitCount  = habitList.filter(h => habitDone[h.id]).length;

  // Day Reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetKey,         setResetKey]         = useState(0);
  const handleDayReset = () => {
    setTasks(t => t.map(x => ({...x,done:false})));
    setHabitDone({});
    setPomDone(0); resetPom();
    save(`trk_water_${tk}`,[]); save(`trk_act_${tk}`,[]);
    save(`trk_read_${tk}`,[]);  save(`trk_med_${tk}`,[]);
    save(`trk_books_${tk}`,0);
    setResetKey(k => k+1);
    setShowResetConfirm(false);
  };

  // Score
  const taskScore  = totalWeight>0 ? (doneWeight/totalWeight)*55 : 0;
  const habitScore = habitList.length>0 ? (habitCount/habitList.length)*35 : 0;
  const pomoScore  = Math.min(pomDone,4)/4*10;
  const score      = Math.min(100, Math.round(taskScore+habitScore+pomoScore));

  return (
    <>
      <style>{CSS}</style>

      {showResetConfirm && (
        <div className="confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">🔄</div>
            <div className="confirm-title">Reset Today?</div>
            <div className="confirm-desc">This clears your progress and gives you a fresh start:</div>
            <ul className="confirm-list">
              <li>All tasks unchecked (list kept)</li>
              <li>All habit completions cleared</li>
              <li>Pomodoro count reset to 0</li>
              <li>Today's tracker entries cleared</li>
            </ul>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="confirm-ok" onClick={handleDayReset}>Reset Day</button>
            </div>
          </div>
        </div>
      )}

      <div className="app">

        {/* Header */}
        <div className="hdr">
          <div>
            <h1>FocusOS</h1>
            <div className="hdr-date">{today}</div>
          </div>
          <div className="hdr-right">
            <button className="reset-day-btn" onClick={() => setShowResetConfirm(true)} title="Reset today's progress">
              <span className="rdb-icon">🔄</span>
              <span className="rdb-lbl">Reset Day</span>
            </button>
            <div className="score-pill" title={`Tasks ${Math.round(taskScore)}/55 · Habits ${Math.round(habitScore)}/35 · Focus ${Math.round(pomoScore)}/10`}>
              <div className="score-num">{score}<span style={{fontSize:"0.85rem",color:"var(--mt)",fontWeight:300}}>/100</span></div>
              <div className="score-lbl">Day Score ⓘ</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="nav">
          {[["tasks","Tasks"],["pomodoro","Focus Timer"],["habits","Habits"],["tips","Playbook"]].map(([k,l]) => (
            <button key={k} className={`nb${tab===k?" on":""}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ══ TASKS ══ */}
        {tab==="tasks" && (
          <div>
            <div className="prow"><div className="ptitle">Today's Tasks</div></div>
            <div className="ti-row">
              <input className="ti" placeholder="Add a task…" value={newTask}
                onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} />
              <select className="psel" value={newPrio} onChange={e=>setNewPrio(e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Mid</option>
                <option value="low">🟢 Low</option>
              </select>
              <button className="abtn" onClick={addTask}>+ Add</button>
            </div>
            <div className="tlist">
              {tasks.length===0 && <div className="t-empty">No tasks yet — add one above.</div>}
              {[...tasks].sort((a,b)=>{
                if(a.done!==b.done) return a.done?1:-1;
                return ({high:0,medium:1,low:2})[a.priority]-({high:0,medium:1,low:2})[b.priority];
              }).map(t=>(
                <div key={t.id} className={`titem${t.done?" dn":""}`}>
                  <div className={`tcb${t.done?" chk":""}`} onClick={()=>toggleTask(t.id)}>
                    {t.done&&<span style={{color:"#0e0e0f",fontSize:"0.7rem",fontWeight:"bold"}}>✓</span>}
                  </div>
                  <div className="pdot" style={{background:PRIORITIES[t.priority].color}} />
                  <div className={`ttx${t.done?" x":""}`}>{t.text}</div>
                  <span style={{fontSize:"0.7rem",fontFamily:"var(--fm)",color:t.done?"var(--mt)":PRIORITIES[t.priority].color,flexShrink:0}}>
                    +{PRIO_PTS[t.priority]}pts
                  </span>
                  <button className="dbtn" onClick={()=>delTask(t.id)}>×</button>
                </div>
              ))}
            </div>
            {tasks.length>0&&(
              <div style={{marginTop:14,fontSize:"0.73rem",color:"var(--mt)",textAlign:"right",fontFamily:"var(--fm)"}}>
                {tasksDone}/{tasks.length} complete
              </div>
            )}
          </div>
        )}

        {/* ══ POMODORO ══ */}
        {tab==="pomodoro"&&(
          <div>
            <div className="prow">
              <div className="ptitle">Deep Focus Timer</div>
              <div style={{display:"flex",gap:6}}>
                <button className={`pact${showSoundSett?" on":""}`}
                  onClick={()=>{setShowSoundSett(s=>!s);setShowTimerSett(false);}}>🔔 Sound</button>
                <button className={`pact${showTimerSett?" on":""}`}
                  onClick={()=>{setDraftWork(timerCfg.work);setDraftBrk(timerCfg.brk);setShowTimerSett(s=>!s);setShowSoundSett(false);}}>⚙ Timer</button>
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
                    <input className="vol-slider" type="range" min="0" max="100" value={soundVol}
                      onChange={e=>setSoundVol(Number(e.target.value))}/>
                    <span style={{fontSize:"0.75rem",color:"var(--gold)",fontFamily:"var(--fm)",minWidth:32}}>{soundVol}%</span>
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
                      <div className="step-btn" onClick={()=>nudge("work",-5)}>−</div>
                      <div className="step-val">{draftWork}m</div>
                      <div className="step-btn" onClick={()=>nudge("work",+5)}>+</div>
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

            {/* Unified habit + tracker cards */}
            <div className="habit-list" key={resetKey}>
              {habitList.length===0&&(
                <div style={{textAlign:"center",color:"var(--mt)",fontSize:"0.85rem",padding:"32px 0",fontStyle:"italic"}}>
                  No habits yet — add one in Manage Habits below.
                </div>
              )}
              {habitList.map(h=>(
                <UnifiedHabitCard key={h.id} habit={h} done={!!habitDone[h.id]}
                  onToggle={()=>toggleHabit(h.id)} tk={tk}/>
              ))}
            </div>

            {/* Progress bar */}
            <div className="hab-prog">
              <div className="hab-prog-lbl">
                <span>Daily Progress</span>
                <span style={{color:"var(--gold)"}}>{habitCount}/{habitList.length}</span>
              </div>
              <div className="hpbar">
                <div className="hpfill" style={{width:habitList.length>0?`${(habitCount/habitList.length)*100}%`:"0%"}}/>
              </div>
            </div>

            {/* Manage Habits */}
            <div className="trk-section">
              <div className="trk-section-hdr">Customize</div>
              <ManageHabitsCard
                habitList={habitList}
                setHabitList={setHabitList}
                setHabitDone={setHabitDone}
              />
            </div>
          </div>
        )}

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
  );
}