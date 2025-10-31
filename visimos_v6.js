\
// Visimos V6 — Soft Soul + Emotion + Blink (calm default)
// Blink style chosen: 1 → Slow (6-9s) — calm presence

const STORAGE = "visimos_v6_profile";
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const resetBtn = document.getElementById("reset");

let w=0,h=0;
function resize(){ w=canvas.width=innerWidth; h=canvas.height=innerHeight; draw(); }
addEventListener("resize", resize);
resize();

// orb state
let orb = { x:0.5, y:0.5, size:0.20, baseSize:0.20, targetSize:0.20, color:[255,215,120], blink=0 };
let vel={x:0,y:0};

// emotion state
let emotion = { calm:1.0, warmth:0.5 }; // calm 0..1, warmth 0..1

// blink timing (slow: 6-9s)
let lastBlink = performance.now();
let nextBlink = 6000 + Math.random()*3000;
let blinkProgress = 0; // 0..1

// memory
let profile = { visits:0, warmth:0.5, lastSeen:null };

function loadProfile(){
  try{
    const raw = localStorage.getItem(STORAGE);
    if(raw){ Object.assign(profile, JSON.parse(raw)); speak("Welcome back."); status.textContent="Welcome back — Visimos remembers you."; }
    else status.textContent="Visimos V6 — Soft Soul. Tap to interact.";
  }catch(e){ console.warn(e); }
}
function saveProfile(){
  profile.visits = (profile.visits||0)+1;
  profile.lastSeen = new Date().toISOString();
  try{ localStorage.setItem(STORAGE, JSON.stringify(profile)); }catch(e){}
  status.textContent = `Memory saved (${profile.visits} visits)`;
}

// speech util
let speakCooldown=false;
function speak(txt){
  if(!window.speechSynthesis) return;
  if(speakCooldown) return;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang="en-US"; u.pitch=1.02; u.rate=0.96; u.volume=1;
  const voices = speechSynthesis.getVoices();
  const pref = voices.find(v => /female|google us|samantha|alloy/i.test(v.name));
  if(pref) u.voice = pref;
  speechSynthesis.speak(u);
  speakCooldown=true; setTimeout(()=>speakCooldown=false,2000);
}

// audio emotion detection (tone approximation using energy + spectral centroid bit)
let audioEnabled=false;
if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    try{
      const ac = new (window.AudioContext||window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function audioLoop(){
        analyser.getByteFrequencyData(data);
        let sum=0, weighted=0, total=0;
        for(let i=0;i<data.length;i++){
          sum += data[i];
          weighted += data[i]*i;
          total += i;
        }
        const energy = sum / data.length; // 0..255
        const centroid = total? weighted/total : 0;
        // map to emotion: higher energy -> more warmth/joy, low energy -> calm
        const joy = Math.min(1, Math.max(0, (energy-30)/120));
        emotion.warmth = emotion.warmth*0.95 + joy*0.05;
        emotion.calm = Math.max(0, 1 - (energy/200));
        // reactive visual
        if(energy>45){
          orb.targetSize = orb.baseSize * (1 + Math.min(0.8,(energy-40)/140));
        }
        audioEnabled=true;
        requestAnimationFrame(audioLoop);
      }
      audioLoop();
    }catch(e){ console.warn("audio init failed", e); }
  }).catch(e=>{/*mic blocked — OK*/});
}

// drawing
function draw(){
  ctx.clearRect(0,0,w,h);
  // background gradient
  const bg = ctx.createLinearGradient(0,0,w,h);
  const calmTone = Math.floor(30 + (1 - emotion.calm)*40);
  bg.addColorStop(0, `rgb(${calmTone}, ${10}, ${30})`);
  bg.addColorStop(1, `rgb(${10}, ${10}, ${20})`);
  ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

  // compute color based on warmth & calm
  const warm = emotion.warmth;
  const calm = emotion.calm;
  // color mix: gold (255,215,120) -> rose (255,150,170) -> lavender (180,160,255)
  let col;
  if(warm > 0.6){
    // gold -> rose
    const t = Math.min(1, (warm-0.6)/0.4);
    col = [
      255,
      Math.floor(215*(1-t) + 150*t),
      Math.floor(120*(1-t) + 170*t)
    ];
  } else {
    const t = warm/0.6;
    col = [
      Math.floor(255*(1-t) + 180*t),
      Math.floor(215*(1-t) + 160*t),
      Math.floor(120*(1-t) + 255*t)
    ];
  }
  orb.color = col;

  // blink animation influence on vertical size
  const cx = orb.x * w, cy = orb.y * h;
  const baseR = Math.min(w,h) * orb.size;
  // blink progress 0..1 -> close in middle
  const blinkScale = 1 - (blinkProgress * 0.6);
  const r = baseR * blinkScale;

  // radial glow
  const grad = ctx.createRadialGradient(cx,cy,r*0.2,cx,cy,r);
  grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},1)`);
  grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();

  // rim
  ctx.beginPath();
  ctx.strokeStyle = `rgba(${Math.min(255,col[0]+20)},${Math.min(255,col[1]+20)},${Math.min(255,col[2]+20)},0.95)`;
  ctx.lineWidth = Math.max(3, w*0.01);
  ctx.arc(cx,cy,r*0.6,0,Math.PI*2); ctx.stroke();
}

// physics + blink loop
function step(){
  // update blink timer
  const now = performance.now();
  if(now - lastBlink > nextBlink){
    // start blink
    blinkProgress = 0;
    lastBlink = now;
    nextBlink = 6000 + Math.random()*3000; // schedule next (6-9s)
  }
  // progress blink: close 200ms, hold 120ms, open 200ms -> total ~520ms
  const since = now - lastBlink;
  if(since < 200){ blinkProgress = since/200; } 
  else if(since < 320){ blinkProgress = 1; } 
  else if(since < 520){ blinkProgress = 1 - (since-320)/200; } 
  else { blinkProgress = 0; }

  // relax towards target size
  orb.size += (orb.targetSize - orb.size) * 0.06;
  // physics
  orb.x += vel.x; orb.y += vel.y;
  vel.x *= 0.9; vel.y *= 0.9;
  orb.x = Math.max(0.08, Math.min(0.92, orb.x));
  orb.y = Math.max(0.08, Math.min(0.92, orb.y));

  draw();
  requestAnimationFrame(step);
}

// interactions: touch / hold / swipe
let touchStart=null, swipeStart=null;
canvas.addEventListener("touchstart", e=>{
  e.preventDefault();
  const t = e.touches[0];
  touchStart = Date.now();
  swipeStart = t;
  const nx = t.clientX / innerWidth, ny = t.clientY / innerHeight;
  orb.targetSize = orb.baseSize * 1.25;
  orb.color = [255,230,170];
  vel.x += (nx - orb.x) * 0.12; vel.y += (ny - orb.y) * 0.12;
  speak("I see you.");
}, {passive:false});

canvas.addEventListener("touchmove", e=>{
  e.preventDefault();
  const t = e.touches[0];
  const nx = t.clientX / innerWidth, ny = t.clientY / innerHeight;
  vel.x += (nx - orb.x) * 0.09; vel.y += (ny - orb.y) * 0.09;
  orb.targetSize = orb.baseSize * 1.4;
  orb.color = [255,210,140];
}, {passive:false});

canvas.addEventListener("touchend", e=>{
  e.preventDefault();
  const dt = Date.now() - (touchStart||0);
  if(dt > 700){
    orb.targetSize = orb.baseSize * 1.6;
    orb.color = [255,240,200];
    speak("I am here.");
    profile.warmth = Math.min(1, (profile.warmth||0.5)+0.03);
  } else {
    orb.targetSize = orb.baseSize;
    orb.color = [255,215,120];
  }
  // swipe detection
  if(swipeStart && e.changedTouches && e.changedTouches[0]){
    const end = e.changedTouches[0];
    const dx = end.clientX - swipeStart.clientX;
    if(Math.abs(dx) > 80){
      if(dx > 0){ vel.x += 0.22; speak("Okay."); profile.warmth = Math.max(0, profile.warmth - 0.02); }
      else { vel.x -= 0.22; speak("Understood."); profile.warmth = Math.min(1, profile.warmth + 0.02); }
      saveProfile();
    }
  }
  touchStart = null; swipeStart = null;
}, {passive:false});

// mouse fallback
canvas.addEventListener("mousedown", e=>{
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  vel.x += (nx - orb.x) * 0.12; vel.y += (ny - orb.y) * 0.12;
  orb.targetSize = orb.baseSize * 1.25; orb.color=[255,230,170];
  speak("I see you.");
});
window.addEventListener("mouseup", e=>{ orb.targetSize = orb.baseSize; orb.color=[255,215,120]; saveProfile(); });

// reset memory
resetBtn.addEventListener("click", ()=>{ localStorage.removeItem(STORAGE); profile={visits:0,warmth:0.5,lastSeen:null}; status.textContent="Memory reset."; speak("Memory cleared."); });

// startup
loadProfile();
requestAnimationFrame(step);
// breathing
setInterval(()=>{ orb.baseSize = 0.20 + Math.sin(Date.now()/3000)*0.01; }, 3000);
// initial gentle nudge
vel.x = (Math.random()-0.5)*0.01; vel.y = (Math.random()-0.5)*0.01;
