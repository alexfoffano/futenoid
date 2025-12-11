/* ========================================================================== 
* Footnoid - Versão Corrigida (Rede no HTML + Fix Start)
* ========================================================================== */
(() => {
  'use strict';
  
  const BAD_WORDS = ['BUNDA', 'MERDA', 'PORRA', 'CARALHO', 'PUTA', 'KCT', 'VSF']; 
  const HISCORE_REMOTE = { url: null, playerId: null };
  
  const GAME_W = 360;
  const GAME_H = 600;
  
  async function fetchHiScore(){ if(!HISCORE_REMOTE.url) return null; try{ const u = new URL(HISCORE_REMOTE.url); if(HISCORE_REMOTE.playerId) u.searchParams.set('player', HISCORE_REMOTE.playerId); const r = await fetch(u.toString(), {cache:'no-store'}); if(!r.ok) throw new Error('http '+r.status); const j = await r.json(); return Number(j.hiscore||0); }catch(e){ return null; } }
  async function submitHiScore(h, playerName){ if(!HISCORE_REMOTE.url) return; try{ await fetch(HISCORE_REMOTE.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hiscore:h, player: (playerName||HISCORE_REMOTE.playerId||null) }) }); }catch(e){} }
  
  function sanitizeName(raw){ if(!raw) return ''; const up = raw.toLocaleUpperCase('pt-BR'); const cleaned = up.replace(/[^\p{L}0-9 ]/gu,''); return cleaned.slice(0,12); }
  function isNameAllowed(name){ const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g,''); for(const w of BAD_WORDS){ if(base.includes(w)) return false; } return true; }
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand =(a,b)=>a+Math.random()*(b-a);
  function roundRect(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); }
  function circleRectCollide(cx,cy,r,rx,ry,rw,rh){ const nx=clamp(cx,rx,rx+rw), ny=clamp(cy,ry,ry+rh); const dx=cx-nx, dy=cy-ny; return (dx*dx+dy*dy)<=r*r; }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wmLogo = new Image(); wmLogo.src = 'logo.png';
  let game = null;

  function resizeCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = GAME_W * dpr;
    canvas.height = GAME_H * dpr;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    if (game) game.onResize();
  }
  window.addEventListener('resize', resizeCanvas);
  
  let audioCtx=null, muted=false; 
  const ensureAC=()=>{ if(!audioCtx){ const AC = window.AudioContext||window.webkitAudioContext; if(AC) audioCtx=new AC(); } };
  function beep(freq=600, dur=60, type='square', vol=0.06){ if(muted) return; try{ ensureAC(); if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=0; o.connect(g); g.connect(audioCtx.destination); const now = audioCtx.currentTime; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.005); g.gain.linearRampToValueAtTime(0, now + dur/1000); o.start(now); o.stop(now + dur/1000 + 0.01);}catch(e){} }

  const keys = { left: false, right: false };
  const pointer = { active: false, x: 0 };

  function pointerPos(evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX = evt.clientX;
    if (evt.touches && evt.touches.length) clientX = evt.touches[0].clientX;
    else if (evt.changedTouches && evt.changedTouches.length) clientX = evt.changedTouches[0].clientX;
    const scaleX = GAME_W / rect.width;
    return { x: (clientX - rect.left) * scaleX };
  }

  function onPointerDown(e) {
    const ov = document.getElementById('overlay');
    if (ov && !ov.hidden && ov.style.display !== 'none') return;
    if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    pointer.active = true; pointer.x = pointerPos(e).x;
    ensureAC(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if(window.game) game.ball.launch();
  }
  function onPointerMove(e) { if (!pointer.active) return; if(e.preventDefault && e.cancelable) e.preventDefault(); pointer.x = pointerPos(e).x; }
  function onPointerUp(e) { pointer.active = false; }

  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove, { passive: false });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);
  
  // CORREÇÃO AQUI: Removido o parêntese extra no 'p'
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'p' || e.key === 'P') togglePause(); 
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === ' ') { e.preventDefault(); hideOverlay(); if (window.game) game.ball.launch(); }
  });
  window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false; });

  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  
  function showOverlay(html){ if(html) overlay.querySelector('.overlay-card').innerHTML=html; overlay.hidden=false; overlay.style.display='flex'; }
  function hideOverlay(){ overlay.hidden=true; overlay.style.display='none'; }
  function togglePause(){ 
    if(!game.running) return; game.paused=!game.paused; 
    if(game.paused){ btnStart.style.display='none'; btnPause.style.display='flex'; showOverlay(null); } else { hideOverlay(); }
    if(!game.paused) last=performance.now(); 
  }
  function toggleMute(){ 
    muted=!muted; const on = document.getElementById('icon-sound-on'); const off = document.getElementById('icon-sound-off');
    if(on && off) { on.style.display = muted ? 'none' : 'block'; off.style.display = muted ? 'block' : 'none'; }
  }

  btnStart.addEventListener('click', () => { if (!window.game) return; if (game.running && !game.paused) { if (confirm('Reiniciar?')) { game.restart(); hideOverlay(); game.ball.launch(); } } else { game.start(); hideOverlay(); game.ball.launch(); } });
  if(btnPause) btnPause.addEventListener('click', ()=>{ game.paused = false; hideOverlay(); last=performance.now(); });
  document.getElementById('btnMute').addEventListener('click', toggleMute);
  document.getElementById('btnReset').addEventListener('click', ()=>{ if(confirm('Resetar recorde?')) { localStorage.removeItem('footnoid_hiscore'); localStorage.removeItem('footnoid_hiscore_name'); if(game){ game.hiscore=0; game.hiscoreName='—'; game.updateHUD(); } } });
  document.getElementById('overlayPlay').addEventListener('click', ()=>{ if(game){ if(game.paused) togglePause(); else if(!game.running) { game.start(); hideOverlay(); game.ball.launch(); } } });

  class Paddle {
    constructor(game){ 
        this.game=game; this.widthRatio=0.22; this.h=14; 
        this.yOffset=10; 
        this.speed=600; this.recenter(); 
    }
    get w(){ return Math.max(70, this.widthRatio * GAME_W); }
    recenter(){ this.x=(GAME_W-this.w)/2; this.y=GAME_H-this.yOffset-this.h; this.vx=0; }
    update(dt){
      if(keys.left) this.vx=-this.speed; else if(keys.right) this.vx=this.speed; else this.vx=0;
      this.x += this.vx * dt;
      if(pointer.active){ const target=pointer.x - this.w/2; this.x += (target - this.x)*Math.min(1, 14*dt); }
      if(this.x < 0) this.x = 0; if(this.x + this.w > GAME_W) this.x = GAME_W - this.w; 
      this.y = GAME_H-this.yOffset-this.h;
    }
    draw(ctx){ ctx.save(); const r=10; const grad=ctx.createLinearGradient(this.x,this.y,this.x,this.y+this.h); grad.addColorStop(0,'#e9f7ff'); grad.addColorStop(1,'#9fd3ff'); ctx.fillStyle=grad; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.25; roundRect(ctx,this.x,this.y,this.w,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore(); }
  }

  class Ball {
    constructor(game){ this.game=game; this.r=8; this.baseSpeed=360; this.maxSpeed=1100; this.resetOnPaddle(); this.trail=[]; }
    resetOnPaddle(){ const p=this.game.paddle; this.x=p.x+p.w/2; this.y=p.y - this.r - 0.5; this.vx=rand(-80,80); this.vy=-280; this.launched=false; this.boosted=false; this.trail=[]; }
    launch(){ if(!this.launched){ const ang = rand(-0.25,0.25)*Math.PI; const sp=this.baseSpeed; this.vx=Math.cos(Math.PI/2 + ang)*sp; this.vy=Math.sin(Math.PI/2 + ang)*sp; this.launched=true; beep(900,60,'triangle'); } }
    speedUp(f){ const s=Math.hypot(this.vx,this.vy)*f; const ang=Math.atan2(this.vy,this.vx); const cm=Math.min(this.maxSpeed, s); this.vx=Math.cos(ang)*cm; this.vy=Math.sin(ang)*cm; }
    setSpeed(s){ const ang=Math.atan2(this.vy,this.vx)||(-Math.PI/2); const cm=Math.min(this.maxSpeed, Math.max(40, s)); this.vx=Math.cos(ang)*cm; this.vy=Math.sin(ang)*cm; }
    reflectX(){ this.vx = -this.vx; }
    reflectY(){ this.vy = -this.vy; }
    update(dt){ const g=this.game; if(!this.launched){ this.x=g.paddle.x+g.paddle.w/2; this.y=g.paddle.y - this.r - 0.5; return; }
      this.x += this.vx*dt; this.y += this.vy*dt;
      if(this.x-this.r < 0){ this.x=this.r; this.reflectX(); beep(250,35); }
      if(this.x+this.r > GAME_W){ this.x = GAME_W - this.r; this.reflectX(); beep(250,35); }
      const goalX = g.goalX, goalW = g.goalW;
      if(this.y-this.r < 0){ if(this.x >= goalX && this.x <= goalX + goalW){ g.scoreGoal(this.boosted); return; } else { this.y = this.r; this.reflectY(); beep(220,40); } }
      if(this.y-this.r > GAME_H){ g.loseLife(); return; }
      const p=g.paddle; if(circleRectCollide(this.x,this.y,this.r,p.x,p.y,p.w,p.h) && this.vy>0){ this.y=p.y - this.r - 0.5; const hit=((this.x - p.x)/p.w)*2 - 1; const speed=Math.hypot(this.vx,this.vy); const ang=clamp(hit*0.9,-1.0,1.0); this.vx=Math.sin(ang)*speed; this.vy=-Math.cos(ang)*speed; this.setSpeed(this.baseSpeed); this.boosted=false; beep(1000,40,'sine'); g.spark(this.x,this.y); }
      const k=g.goalie; if(k && circleRectCollide(this.x,this.y,this.r,k.x,k.y,k.w,k.h) && this.vy<0){ this.y = k.y + k.h + this.r + 0.5; this.reflectY(); const f = 1.25 + 0.05 * (g.level-1); if(!this.boosted){ this.speedUp(f); this.boosted=true; } beep(520,45,'square'); }
      for(const adv of g.opponents){ if(circleRectCollide(this.x,this.y,this.r,adv.x,adv.y,adv.w,adv.h)){
          const left=Math.abs((this.x+this.r)-adv.x), right=Math.abs((adv.x+adv.w)-(this.x-this.r));
          const top=Math.abs((this.y+this.r)-adv.y), bottom=Math.abs((adv.y+adv.h)-(this.y-this.r));
          const minX=Math.min(left,right), minY=Math.min(top,bottom);
          if(minX < minY){ if(left<right) this.x=adv.x-this.r-0.01; else this.x=adv.x+adv.w+this.r+0.01; this.reflectX(); }
          else { if(top<bottom) this.y=adv.y-this.r-0.01; else this.y=adv.y+adv.h+this.r+0.01; this.reflectY(); }
          const f = 1.25 + 0.05*(g.level-1); if(!this.boosted){ this.speedUp(f); this.boosted=true; } beep(650,45,'triangle'); g.spark(this.x,this.y,10); break;
      }}
    }
    draw(ctx){ ctx.save(); const r=this.r;
      if (this.boosted && this.game && this.game.running && !this.game.paused) { this.trail.push({ x: this.x, y: this.y }); if (this.trail.length > 14) this.trail.shift(); } else { this.trail.length = 0; }
      if (this.trail.length) { for (let i=0; i<this.trail.length; i++) { const t=(i+1)/this.trail.length; ctx.globalAlpha=0.35*t; ctx.beginPath(); ctx.arc(this.trail[i].x, this.trail[i].y, r*(0.5+0.5*t), 0, Math.PI*2); ctx.fillStyle='#ffb566'; ctx.fill(); } ctx.globalAlpha=1; }
      const grad = ctx.createRadialGradient(this.x-r/3, this.y-r/3, r/4, this.x, this.y, r); grad.addColorStop(0, this.boosted?'#ffe8cc':'#ffffff'); grad.addColorStop(1, this.boosted?'#ff8a00':'#dfe8ff'); ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  class Opponent { constructor(x,y,w,h,vx){ this.x=x; this.y=y; this.w=w; this.h=h; this.vx=vx; } update(dt){ this.x += this.vx*dt; if(this.x<0){ this.x=0; this.vx=Math.abs(this.vx);} if(this.x+this.w > GAME_W){ this.x=GAME_W - this.w; this.vx=-Math.abs(this.vx);} } draw(ctx){ ctx.save(); const r=8; ctx.fillStyle='#f3d08a'; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.15; roundRect(ctx,this.x+2,this.y+2,this.w-4,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore(); } }
  class Goalie { constructor(game){ this.game=game; this.w=Math.max(60, GAME_W*0.22); this.h=14; this.y=this.game.goalDepth+10; this.vxBase=220; this.vx=this.vxBase; this.recenter(); } recenter(){ this.x=this.game.goalX+(this.game.goalW-this.w)/2; } update(dt){ this.x+=this.vx*dt; if(this.x<this.game.goalX){ this.x=this.game.goalX; this.vx=Math.abs(this.vx); } if(this.x+this.w>this.game.goalX+this.game.goalW){ this.x=this.game.goalX+this.game.goalW-this.w; this.vx=-Math.abs(this.vx); } } draw(ctx){ ctx.save(); const r=10; ctx.fillStyle='#ffd06a'; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.25; roundRect(ctx,this.x,this.y,this.w,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore(); } }
  class Spark{ constructor(x,y){ this.x=x; this.y=y; this.vx=rand(-140,140); this.vy=rand(-200,-80); this.life=rand(.25,.45); } update(dt){ this.life-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=800*dt; } draw(ctx){ if(this.life<=0) return; ctx.globalAlpha=clamp(this.life/.45,0,1); ctx.fillStyle='#fff6a8'; ctx.fillRect(this.x,this.y,2,2); ctx.globalAlpha=1; } }
  class Confetti { constructor(){ this.x=rand(0,GAME_W); this.y=rand(-GAME_H/2, -10); this.w=rand(4,8); this.h=rand(4,8); this.vx=rand(-50,50); this.vy=rand(100,250); this.color=`hsl(${Math.floor(rand(0,360))}, 80%, 60%)`; this.life=3.5; this.swaySpeed=rand(1,3); this.swayAmp=rand(0.5,2); } update(dt){ this.life-=dt; this.y+=this.vy*dt; this.x+=this.vx*dt+Math.sin(this.y*0.01*this.swaySpeed)*this.swayAmp; } draw(ctx){ if(this.life<=0) return; ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,this.w,this.h); } }

  class Game{
    constructor(){ this.resetAll(); }
    async saveHiScoreIfNeeded(){ const key='footnoid_hiscore'; if(this.goals>this.hiscore){ this.hiscore=this.goals; try{ localStorage.setItem(key, String(this.hiscore)); }catch(e){} if(HISCORE_REMOTE && HISCORE_REMOTE.url){ submitHiScore(this.hiscore, this.hiscoreName).catch(()=>{}); } } }
    resetAll(){ this.level=1; this.lives=3; this.goals=0; this.hiscore = Number(localStorage.getItem('footnoid_hiscore')||0); this.hiscoreName = (localStorage.getItem('footnoid_hiscore_name') || '—'); this.particles=[]; this.confetti=[]; this.paddle=new Paddle(this); this.ball=new Ball(this); this.opponents=[]; this.goalDepth=54; this.goalRatio=.36; this.computeGoal(); this.running=false; this.paused=false; this.updateHUD(); this.buildLevel(this.level); this.goalie=new Goalie(this); if(!this.goalieMoving) this.goalie.vx = 0; }
    computeGoal(){ this.goalW = GAME_W*this.goalRatio; this.goalX = (GAME_W - this.goalW)/2; }
    onResize(){ }
    getLevelConfig(n){ const oppTable = [0,1,2,0,1,2,3,4,5,6]; const idx = Math.min(n, 10) - 1; const opps = (idx>=0 && idx<oppTable.length) ? oppTable[idx] : Math.min(6, Math.max(0, n-4)); const goalieMoving = n >= 4; return {opps, goalieMoving}; }
    buildLevel(n){ this.opponents = []; const cfg = this.getLevelConfig(n); this.goalieMoving = cfg.goalieMoving; const count = cfg.opps; if (count <= 0) return; const marginTop = this.goalDepth + 70; const marginBottom = GAME_H * 0.55; for (let i = 0; i < count; i++) { const y = marginTop + i * ((marginBottom - marginTop) / Math.max(1, count - 1)); const w = Math.max(40, GAME_W * 0.18); const x = Math.max(0, Math.min(GAME_W - w, Math.random() * (GAME_W - w))); const speed = 160 + n * 30 + (Math.random()*80 - 20); const dir = Math.random() < .5 ? -1 : 1; this.opponents.push(new Opponent(x, y, w, 16, speed * dir)); } }
    
    updateHUD(){ try{ 
      const gEl = document.getElementById('goals'); if (gEl) gEl.textContent = this.goals; 
      const liEl = document.getElementById('lives'); if (liEl) liEl.textContent = this.lives; 
      const hEl = document.getElementById('hud-hiscore'); if(hEl) hEl.textContent = this.hiscore;
      const hNEl = document.getElementById('hud-hiscore-name'); if(hNEl) hNEl.textContent = this.hiscoreName;
    }catch(e){} }
    start(){ this.running=true; this.paused=false; hideOverlay(); btnStart.style.display='flex'; btnPause.style.display='none'; btnStart.textContent = 'REINICIAR'; }
    restart(){ this.resetAll(); this.start(); }
    loseLife(){ this.lives--; this.updateHUD(); beep(180,140,'sawtooth',.06); if(this.lives<=0){ this.gameOver(); } else { this.ball.resetOnPaddle(); this.running=true; } }
    async scoreGoal(own){ this.goals++; await this.saveHiScoreIfNeeded(); this.updateHUD(); beep(1000,200,'sine',.12); this.spark(this.ball.x, this.ball.y, 24); this.spawnConfetti(); this.nextLevel(own); }
    nextLevel(own){ this.level++; this.paddle.widthRatio = Math.max(0.16, this.paddle.widthRatio*0.97); this.ball.baseSpeed *= 1.06; this.buildLevel(this.level); this.goalie = new Goalie(this); if(!this.goalieMoving) this.goalie.vx = 0; this.ball.resetOnPaddle(); const msg = own ? 'GOL CONTRA! 🐔' : 'GOOOL! ⚽'; this.flash(`${msg}\nNível ${this.level}`); }
    
    async gameOver(){
      this.running=false; this.paused=false; btnStart.textContent = 'JOGAR'; btnStart.style.display = 'flex'; btnPause.style.display = 'none';
      let baseline; try{ baseline = Math.max(this.hiscore||0, Number(localStorage.getItem('footnoid_hiscore')||0)); } catch(e){ baseline = this.hiscore||0; }
      const isNewRecord = this.goals > baseline;
      if(isNewRecord){
        const html = `<h1 class="menu-title">NOVO RECORDE! 🏆</h1><p style="font-size:18px;color:var(--primary)">Gols: <strong>${this.goals}</strong></p><div style="text-align:left; width:100%;"><label style="font-size:12px; margin-left:4px;">Seu nome:</label><input id="ovName" type="text" inputmode="latin" maxlength="12" placeholder="DIGITE AQUI"></div><button id="ovSaveStart" class="btn-primary" style="margin-top:10px;">SALVAR E JOGAR</button>`;
        showOverlay(html); 
        setTimeout(()=>{
          const input = document.getElementById('ovName'); const btn = document.getElementById('ovSaveStart'); if (input) input.focus();
          const trySave = async ()=>{
            let raw = input ? input.value : ''; let name = sanitizeName(raw);
            if(!name){ alert('Nome inválido.'); return; } if(!isNameAllowed(name)){ alert('Nome proibido.'); return; }
            this.hiscore = Math.max(this.hiscore||0, this.goals||0); this.hiscoreName = name; this.updateHUD(); try{ localStorage.setItem('footnoid_hiscore', String(this.hiscore)); localStorage.setItem('footnoid_hiscore_name', name); } catch(e){}
            if(HISCORE_REMOTE && HISCORE_REMOTE.url){ submitHiScore(this.hiscore, this.hiscoreName).catch(()=>{}); } this.updateHUD(); hideOverlay(); this.restart();
          };
          if (btn) btn.onclick = trySave; if (input) input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); if(btn) btn.click(); } });
        }, 0);
      } else {
        showOverlay(`<h1 class="menu-title">FIM DE JOGO</h1><p style="font-size:24px; font-weight:bold;">${this.goals} Gols</p><p style="font-size:12px; opacity:0.6;">Melhor: ${this.hiscore}</p><br><button id="ovRetry" class="btn-primary">TENTAR DE NOVO</button>`);
        setTimeout(()=>{ const btn=document.getElementById('ovRetry'); if(btn) btn.onclick=()=>{ this.restart(); hideOverlay(); game.ball.launch(); }; }, 0);
      }
    }
    
    flash(text){ showOverlay(`<h1 class="flash-text">${text.replace(/\n/g,'<br>')}</h1>`); setTimeout(()=>hideOverlay(), 2500); }
    spark(x,y,n=8){ for(let i=0;i<n;i++) this.particles.push(new Spark(x,y)); }
    spawnConfetti(){ for(let i=0;i<60;i++) this.confetti.push(new Confetti()); }
  }

  // --- LOOP PRINCIPAL ---
  function drawField(){
    const grass1 = '#1a8e32'; const grass2 = '#17802d'; const lineColor = 'rgba(255,255,255,0.7)';
    const stripeH = 40; 
    for(let y=0;y<GAME_H;y+=stripeH){ ctx.fillStyle = (Math.floor(y/stripeH)%2)? grass1 : grass2; ctx.fillRect(0,y,GAME_W,stripeH); }
    ctx.strokeStyle = lineColor; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0, GAME_H*0.5); ctx.lineTo(GAME_W, GAME_H*0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(GAME_W/2, GAME_H*0.5, 45, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = lineColor; ctx.beginPath(); ctx.arc(GAME_W/2, GAME_H*0.5, 3, 0, Math.PI*2); ctx.fill();
    const g=game; const areaW = g.goalW*1.6; const areaX = g.goalX - (areaW - g.goalW)/2; const areaH = 80; 
    ctx.strokeRect(areaX, 0, areaW, areaH); 
    const smallW=g.goalW*1.2; const smallX = g.goalX - (smallW - g.goalW)/2; const smallH=40; 
    ctx.strokeRect(smallX, 0, smallW, smallH); 
    ctx.beginPath(); ctx.arc(GAME_W/2, areaH - 15, 2.5, 0, Math.PI*2); ctx.fill();
  }
  
  resizeCanvas();
  game = new Game(); window.game = game;
  if(HISCORE_REMOTE && HISCORE_REMOTE.url){ fetchHiScore().then(v=>{ if(typeof v==='number' && v>game.hiscore){ game.hiscore=v; game.updateHUD(); } }); }
  
  let last=performance.now();
  function loop(now){ requestAnimationFrame(loop); const dt=Math.min(0.033, (now-last)/1000); last=now; if(!game.running||game.paused){ draw(); return; } update(dt); draw(); }
  function update(dt){ 
    game.paddle.update(dt); game.ball.update(dt); 
    if(game.goalie) game.goalie.update(dt); 
    for(const o of game.opponents) o.update(dt); 
    for(let i=game.particles.length-1;i>=0;i--){ const p=game.particles[i]; p.update(dt); if(p.life<=0) game.particles.splice(i,1);} 
    for(let i=game.confetti.length-1;i>=0;i--){ const c=game.confetti[i]; c.update(dt); if(c.life<=0) game.confetti.splice(i,1); }
  }
  function draw(){ 
    ctx.clearRect(0,0,GAME_W,GAME_H); drawField(); 
    for(const o of game.opponents) o.draw(ctx); 
    if(game.goalie) game.goalie.draw(ctx); 
    game.paddle.draw(ctx); game.ball.draw(ctx); 
    for(const p of game.particles) p.draw(ctx);
    for(const c of game.confetti) c.draw(ctx); 
    ctx.save(); if(wmLogo && wmLogo.complete){  const maxW=GAME_W*0.3; const iw=wmLogo.naturalWidth||1, ih=wmLogo.naturalHeight||1; const ratio=ih/iw; const wLogo=Math.min(maxW, iw); const hLogo=wLogo*ratio; const xLogo=(GAME_W - wLogo)/2; const yCenter=GAME_H*0.70; const yLogo=yCenter - hLogo*0.5; ctx.globalAlpha=.5; ctx.drawImage(wmLogo, xLogo, yLogo, wLogo, hLogo); const f=Math.max(14, Math.round(GAME_W*0.045)); ctx.textAlign='center'; ctx.textBaseline='top'; ctx.font=`700 ${f}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`; ctx.fillStyle='#fff'; ctx.fillText(`Nível ${game.level}`, GAME_W/2, yLogo + hLogo + f*0.4); } ctx.restore(); 
  }
  requestAnimationFrame(loop);
  function setHUD(){ if(window.game) game.updateHUD(); } setHUD();
})();
