/* ========================================================================== 
* Footnoid - Código comentado e identado para manutenção e escala
*
* Guia rápido:
* - Este arquivo mantém a lógica original, apenas organiza e adiciona comentários.
* - Comentários em estilo JSDoc foram inseridos em classes e métodos-chave.
* - Marcadores de seção ajudam a navegar pelo código.
*
* Convenções:
* - Evitamos alterar comportamento. Se precisar de mudanças funcionais, faça em PRs separados.
* - Utilize as funções utilitárias existentes (beep, clamp, etc.).
* ========================================================================== */
(() => {
  'use strict';
  
  // ======================================================================
  // Configurações e Anti-ofensa (BAD_WORDS)
  // ======================================================================
  /** Lista de palavras proibidas (comparação case-insensitive, sem acento). */
  const BAD_WORDS = ['BUNDA'
  // Edite esta lista: todas serão avaliadas no NOME (case-insensitive, sem acento)
  // Ex.: 'PALAVRA', 'OFENSA', 'XXXX'
];

// ======================================================================
// Integração de HiScore remoto
// ======================================================================
/** Endpoint opcional para sincronizar recorde global do jogador. */
const HISCORE_REMOTE = { url: null, playerId: null };
/** Busca o hiscore remoto (se configurado). Retorna número ou null em erro. */
async function fetchHiScore(){ if(!HISCORE_REMOTE.url) return null; try{ const u = new URL(HISCORE_REMOTE.url); if(HISCORE_REMOTE.playerId) u.searchParams.set('player', HISCORE_REMOTE.playerId); const r = await fetch(u.toString(), {cache:'no-store'}); if(!r.ok) throw new Error('http '+r.status); const j = await r.json(); return Number(j.hiscore||0); }catch(e){ return null; } }

// ======================================================================
// Sanitização e Validação de Nome do Jogador
// ======================================================================
/** Remove acentos/diacríticos (NFD). */
function stripDiacritics(str){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function sanitizeName(raw){ if(!raw) return ''; const up = raw.toLocaleUpperCase('pt-BR'); const cleaned = up.replace(/[^\p{L}0-9]/gu,''); return cleaned.slice(0,12); }
function isNameAllowed(name){ const base = stripDiacritics(name); for(const w of BAD_WORDS){ const wb = stripDiacritics(String(w||'').toUpperCase()); if(!wb) continue; if(base.includes(wb)) return false; } return true; }
async function promptPlayerName(){
  for(;;){
    let input = window.prompt('Novo Recorde! Digite seu nome (máx 12, letras/números):', '');
    if(input===null) return null; // usuário cancelou
    const name = sanitizeName(input);
    if(!name){ alert('Nome vazio ou inválido. Use apenas letras e números.'); continue; }
    if(!isNameAllowed(name)){ alert('Nome contém palavra proibida. Escolha outro.'); continue; }
    return name;
  }
}

/** Envia o hiscore (POST) para o backend remoto, se existir. */
async function submitHiScore(h, playerName){ if(!HISCORE_REMOTE.url) return; try{ await fetch(HISCORE_REMOTE.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hiscore:h, player: (playerName||HISCORE_REMOTE.playerId||null)
      }) }); }catch(e){} }
      
      
      // ======================================================================
      // Canvas, Contexto e Layout Responsivo
      // ======================================================================
      /** Elementos de UI principais e cálculo de DPR/resize. */
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const wmLogo = new Image(); wmLogo.src = 'logo.png';

      const stage = document.getElementById('stage');
      
      let game = null;
      let W=0, H=0, DPR=Math.max(1, window.devicePixelRatio||1);
      function resizeCanvas(){
        const r = stage.getBoundingClientRect();
        const w = r.width, h = r.height; DPR = Math.max(1, window.devicePixelRatio||1);
        canvas.width = Math.floor(w*DPR); canvas.height = Math.floor(h*DPR);
        canvas.style.width = w+'px'; canvas.style.height = h+'px';
        ctx.setTransform(1,0,0,1,0,0); ctx.scale(DPR, DPR); W=w; H=h;
        if (game) game.onResize();
      }
      window.addEventListener('resize', resizeCanvas);
      
      
      // ======================================================================
      // Áudio (WebAudio) e utilidade de beep
      // ======================================================================
      /** Inicializa AudioContext sob demanda e gera tons com envelope para evitar clicks. */
      let audioCtx=null, muted=false; const ensureAC=()=>{ if(!audioCtx){ const AC = window.AudioContext||window.webkitAudioContext; if(AC) audioCtx=new AC(); } };
      function beep(freq=600, dur=60, type='square', vol=0.06){ if(muted) return; try{ ensureAC(); if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=0; o.connect(g); g.connect(audioCtx.destination); const now = audioCtx.currentTime; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.005); g.gain.linearRampToValueAtTime(0, now + dur/1000); o.start(now); o.stop(now + dur/1000 + 0.01);}catch(e){} }
      
      
      // ======================================================================
      // Helpers geométricos e matemáticos
      // ======================================================================
      const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
      const rand =(a,b)=>a+Math.random()*(b-a);
      function roundRect(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); }
      function circleRectCollide(cx,cy,r,rx,ry,rw,rh){ const nx=clamp(cx,rx,rx+rw), ny=clamp(cy,ry,ry+rh); const dx=cx-nx, dy=cy-ny; return (dx*dx+dy*dy)<=r*r; }
      
      
    // ======================================================================
	// Entrada do usuário (Teclado, Mouse, Touch Global)
	// ======================================================================
	const keys = { left: false, right: false };

	window.addEventListener('keydown', e => {
		if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
		if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
		if (e.key === 'p' || e.key === 'P') { if (window.game) togglePause(); }
		if (e.key === 'm' || e.key === 'M') { if (window.game) toggleMute(); }
		if (e.key === 'r' || e.key === 'R') { if (window.game) game.restart(); }
		if (e.key === ' ' || e.code === 'Space') {
			e.preventDefault();
			
			// 1. Força o menu/aviso a sumir imediatamente
			hideOverlay(); 
			
			// 2. Lança a bola
			if (window.game) game.ball.launch();
		}
	});

	window.addEventListener('keyup', e => {
		if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
		if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
	});

	const pointer = { active: false, x: 0 };

	// Calcula a posição X relativa ao canvas, mesmo que o toque ocorra fora dele
	function pointerPos(evt) {
		const rect = canvas.getBoundingClientRect();
		const root = document.documentElement;
		
		// Pega a coordenada X do toque ou do mouse
		let clientX = evt.clientX;
		if (evt.touches && evt.touches.length) {
			clientX = evt.touches[0].clientX;
		} else if (evt.changedTouches && evt.changedTouches.length) {
			// Fallback para touchend
			clientX = evt.changedTouches[0].clientX;
		}
		
		// A mágica: calcula onde esse X estaria "dentro" do jogo
		// Subtrai a margem esquerda do canvas
		return { x: clientX - rect.left };
	}

	function onPointerDown(e) {
		// Verifica se o alvo não é um botão da UI (para não disparar o jogo ao clicar em Pausar)
		if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

		pointer.active = true;
		pointer.x = pointerPos(e).x;
		
		ensureAC();
		if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
		hideOverlay();
		if(window.game) game.ball.launch();
	}

	function onPointerMove(e) {
		if (!pointer.active) return;
		// Previne rolagem se o usuário arrastar torto (importante pro mobile)
		if(e.preventDefault && e.cancelable) e.preventDefault(); 
		pointer.x = pointerPos(e).x;
	}

	function onPointerUp(e) {
		pointer.active = false;
	}

	// ATENÇÃO: Adicionamos os ouvintes na WINDOW (janela) e não apenas no canvas.
	// Isso permite controlar a raquete arrastando o dedo no rodapé ou cabeçalho.
	window.addEventListener('mousedown', onPointerDown);
	window.addEventListener('mousemove', onPointerMove, { passive: false });
	window.addEventListener('mouseup', onPointerUp);

	// Eventos de toque com passive: false para permitir o e.preventDefault()
	window.addEventListener('touchstart', onPointerDown, { passive: false });
	window.addEventListener('touchmove', onPointerMove, { passive: false });
	window.addEventListener('touchend', onPointerUp);
      
      
      // ======================================================================
      // Overlay / HUD Controls (Start, Pause, Mute, Reset)
      // ======================================================================
      const overlay = document.getElementById('overlay');
      const btnStart = document.getElementById('btnStart');
      const btnPause = document.getElementById('btnPause');
      const btnMute  = document.getElementById('btnMute');
      const btnReset = document.getElementById('btnReset');
      const overlayPlay = document.getElementById('overlayPlay');
      function showOverlay(html){ if(html) overlay.querySelector('.overlay-card').innerHTML=html; overlay.hidden=false; overlay.style.display='grid'; overlay.setAttribute('aria-hidden','false'); }
      function hideOverlay(){ overlay.hidden=true; overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); }
      
      function togglePause(){ if(!game.running) return; game.paused=!game.paused; btnPause.textContent = game.paused? 'Retomar':'Pausar'; if(!game.paused) last=performance.now(); }
      function toggleMute(){ muted=!muted; btnMute.textContent = muted? 'Som: Desligado':'Som: Ligado'; }
      btnStart.addEventListener('click', ()=>{ if(!window.game || !game.running) { if(window.game) game.start(); } hideOverlay(); if(window.game) game.ball.launch(); });
      btnPause.addEventListener('click', togglePause); btnMute.addEventListener('click', toggleMute);
      if(btnReset){ btnReset.addEventListener('click', ()=>{
          if(!confirm('Resetar recorde LOCAL? (não afeta remoto)')) return;
          try{ localStorage.removeItem('footnoid_hiscore'); localStorage.removeItem('footnoid_hiscore_name'); if(window.game){ game.hiscore=0; game.hiscoreName='—'; game.updateHUD(); }
          }catch(e){}
          alert('Recorde local resetado.');
        }); }
        overlayPlay.addEventListener('click', ()=>{ if(window.game) game.start(); hideOverlay(); if(window.game) game.ball.launch(); });
        overlay.addEventListener('click', ()=>{ if(overlay.dataset.locked==='1') return; if(window.game) game.start(); hideOverlay(); if(window.game) game.ball.launch(); });
        
        
        // ======================================================================
        // Entidades do Jogo (Classes)
        // ======================================================================
        /**
        * Paddle (jogador): barra controlada pelo usuário.
        * - widthRatio define largura relativa ao W (com mínimo).
        * - update() integra teclado e toque com suavização.
        */
        class Paddle {
          constructor(game){ this.game=game; this.widthRatio=0.22; this.h=14; this.yOffset=18; this.speed=900; this.recenter(); }
          get w(){ return Math.max(70, this.widthRatio * W); }
          recenter(){ this.x=(W-this.w)/2; this.y=H-this.yOffset-this.h; this.vx=0; }
          update(dt){
            if(keys.left && !keys.right) this.vx=-this.speed; else if(keys.right && !keys.left) this.vx=this.speed; else this.vx=0;
            this.x += this.vx * dt;
            if(pointer.active){ const target=pointer.x - this.w/2; this.x += (target - this.x)*Math.min(1, 14*dt); }
            if(this.x<0) this.x=0; if(this.x+this.w>W) this.x=W-this.w; this.y = H-this.yOffset-this.h;
          }
          draw(ctx){ ctx.save(); const r=10; const grad=ctx.createLinearGradient(this.x,this.y,this.x,this.y+this.h); grad.addColorStop(0,'#e9f7ff'); grad.addColorStop(1,'#9fd3ff'); ctx.fillStyle=grad; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.25; roundRect(ctx,this.x,this.y,this.w,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore(); }
        }
        
        /**
        * Ball: bola com física simples e reflexões.
        * - baseSpeed aumenta por nível; maxSpeed limita aceleração.
        * - boosted indica se ganhou aceleração após colisão com goleiro/oponentes.
        */
        class Ball {
          constructor(game){ this.game=game; this.r=8; this.baseSpeed=360; this.maxSpeed=1100; this.resetOnPaddle(); this.launched=false; this.boosted=false; this.trail=[]; this.trailMax=14; }
          resetOnPaddle(){ const p=this.game.paddle; this.x=p.x+p.w/2; this.y=p.y - this.r - 0.5; this.vx=rand(-80,80); this.vy=-280; this.launched=false; this.boosted=false; this.trail = []; }
          launch(){ if(!this.launched){ const ang = rand(-0.25,0.25)*Math.PI; const sp=this.baseSpeed; this.vx=Math.cos(Math.PI/2 + ang)*sp; this.vy=Math.sin(Math.PI/2 + ang)*sp; this.launched=true; beep(900,60,'triangle'); } }
          speedUp(f){ const s=Math.hypot(this.vx,this.vy) * f; const ang=Math.atan2(this.vy,this.vx); const clamped=Math.min(this.maxSpeed, s); this.vx=Math.cos(ang)*clamped; this.vy=Math.sin(ang)*clamped; }
          setSpeed(s){ const ang=Math.atan2(this.vy,this.vx)||(-Math.PI/2); const clamped=Math.min(this.maxSpeed, Math.max(40, s)); this.vx=Math.cos(ang)*clamped; this.vy=Math.sin(ang)*clamped; }
          reflectX(){ this.vx = -this.vx; }
          reflectY(){ this.vy = -this.vy; }
          update(dt){ const g=this.game; if(!this.launched){ this.x=g.paddle.x+g.paddle.w/2; this.y=g.paddle.y - this.r - 0.5; return; }
            this.x += this.vx*dt; this.y += this.vy*dt;
            if(this.x - this.r < 0){ this.x=this.r; this.reflectX(); beep(250,35); }
            if(this.x + this.r > W){ this.x=W-this.r; this.reflectX(); beep(250,35); }
            const goalX = g.goalX, goalW = g.goalW;
            if(this.y - this.r < 0){
              if(this.x >= goalX && this.x <= goalX + goalW){
                g.scoreGoal(this.boosted); return;
              } else {
              this.y = this.r; this.reflectY(); beep(220,40);
            }
          }
          if(this.y - this.r > H){ g.loseLife(); return; }
          const p=g.paddle; if(circleRectCollide(this.x,this.y,this.r,p.x,p.y,p.w,p.h) && this.vy>0){ this.y=p.y - this.r - 0.5; const hit=((this.x - p.x)/p.w)*2 - 1; const speed=Math.hypot(this.vx,this.vy); const ang=clamp(hit*0.9,-1.0,1.0); this.vx=Math.sin(ang)*speed; this.vy=-Math.cos(ang)*speed; this.setSpeed(this.baseSpeed); this.boosted=false; beep(1000,40,'sine'); g.spark(this.x,this.y); }
          const k=g.goalie; if(k && circleRectCollide(this.x,this.y,this.r,k.x,k.y,k.w,k.h) && this.vy<0){ this.y = k.y + k.h + this.r + 0.5; this.reflectY(); const f = 1.25 + 0.05 * (g.level-1); if(!this.boosted){ this.speedUp(f); this.boosted=true; } beep(520,45,'square'); }
          for(const adv of g.opponents){ if(circleRectCollide(this.x,this.y,this.r,adv.x,adv.y,adv.w,adv.h)){
              const leftOverlap = Math.abs((this.x + this.r) - adv.x);
              const rightOverlap = Math.abs((adv.x + adv.w) - (this.x - this.r));
              const topOverlap = Math.abs((this.y + this.r) - adv.y);
              const bottomOverlap = Math.abs((adv.y + adv.h) - (this.y - this.r));
              const overlapX = Math.min(leftOverlap, rightOverlap);
              const overlapY = Math.min(topOverlap, bottomOverlap);
              if(overlapX < overlapY){
                // horizontal collision: push ball to the side it came from
                if(leftOverlap < rightOverlap) this.x = adv.x - this.r - 0.01; else this.x = adv.x + adv.w + this.r + 0.01;
                this.reflectX();
              } else {
              // vertical collision
              if(topOverlap < bottomOverlap) this.y = adv.y - this.r - 0.01; else this.y = adv.y + adv.h + this.r + 0.01;
              this.reflectY();
            }
            const f = 1.25 + 0.05 * (g.level-1);
            if(!this.boosted){ this.speedUp(f); this.boosted=true; }
            beep(650,45,'triangle'); g.spark(this.x,this.y,10); break;
          }
        }
      }
      draw(ctx){
  ctx.save();
  const r = this.r;

  // If boosted, record trail positions (only during active play)
  if (this.boosted && this.game && this.game.running && !this.game.paused) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailMax) this.trail.shift();
  } else {
    // clear trail when not boosted
    this.trail.length = 0;
  }

  // Draw trail (older samples are more transparent/smaller)
  if (this.trail && this.trail.length) {
    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;             // 0..1 (older..newer)
      const alpha = 0.35 * t;            // newer is brighter
      const rr = r * (0.5 + 0.5 * t);    // size grows towards the ball
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, rr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb566';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Ball body (orange when boosted, otherwise white/blue)
  if (this.boosted) {
    const grad = ctx.createRadialGradient(this.x - r/3, this.y - r/3, r/4, this.x, this.y, r);
    grad.addColorStop(0, '#ffe8cc');
    grad.addColorStop(1, '#ff8a00');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(this.x - r/3, this.y - r/3, r/4, this.x, this.y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#dfe8ff');
    ctx.fillStyle = grad;
  }
  ctx.beginPath();
  ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Panel lines on the ball
  ctx.globalAlpha = .3;
  ctx.strokeStyle = '#3b3b3b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(this.x, this.y - r); ctx.lineTo(this.x, this.y + r);
  ctx.moveTo(this.x - r, this.y); ctx.lineTo(this.x + r, this.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}
      }
      
      /**
      * Opponent: retângulos móveis que bloqueiam a bola na faixa superior.
      */
      class Opponent {
        constructor(x,y,w,h,vx){ this.x=x; this.y=y; this.w=w; this.h=h; this.vx=vx; }
        update(dt){ this.x += this.vx*dt; if(this.x<0){ this.x=0; this.vx=Math.abs(this.vx);} if(this.x+this.w>W){ this.x=W-this.w; this.vx=-Math.abs(this.vx);} }
        draw(ctx){ ctx.save(); const r=8; ctx.fillStyle='#f3d08a'; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.15; roundRect(ctx,this.x+2,this.y+2,this.w-4,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.globalAlpha=1;
          ctx.beginPath(); ctx.arc(this.x+this.w/2, this.y-6, 6, 0, Math.PI*2); ctx.fillStyle='#ffe2b5'; ctx.fill(); ctx.restore(); }
        }
        
        /**
        * Goalie: goleiro que se move dentro da largura do gol (pode ser parado em níveis iniciais).
        */
        class Goalie {
          constructor(game){ this.game=game; this.w=Math.max(60, W*0.22); this.h=14; this.y = this.game.goalDepth + 10; this.vxBase = 220; this.vx = this.vxBase; this.recenter(); }
          recenter(){ this.x = this.game.goalX + (this.game.goalW - this.w)/2; }
          update(dt){ this.x += this.vx*dt;
            if(this.x < this.game.goalX){ this.x=this.game.goalX; this.vx = Math.abs(this.vx); }
            if(this.x + this.w > this.game.goalX + this.game.goalW){ this.x = this.game.goalX + this.game.goalW - this.w; this.vx = -Math.abs(this.vx); }
          }
          draw(ctx){ ctx.save(); const r=10; ctx.fillStyle='#ffd06a'; roundRect(ctx,this.x,this.y,this.w,this.h,r); ctx.fill(); ctx.globalAlpha=.25; roundRect(ctx,this.x,this.y,this.w,3,r); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore(); }
        }
        
        /**
        * Spark: partícula simples para feedback visual (efeito de faísca).
        */
        class Spark{ constructor(x,y){ this.x=x; this.y=y; this.vx=rand(-140,140); this.vy=rand(-200,-80); this.life=rand(.25,.45); } update(dt){ this.life-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=800*dt; } draw(ctx){ if(this.life<=0) return; ctx.globalAlpha=clamp(this.life/.45,0,1); ctx.fillStyle='#fff6a8'; ctx.fillRect(this.x,this.y,2,2); ctx.globalAlpha=1; } }
        
        /**
        * Game: estado e regras principais do jogo.
        * Responsável por: níveis, HUD, hiscore, colisões de alto nível e ciclo de vida (start/restart/gameOver).
        */
        class Game{
          /** Atualiza hiscore local/remoto se gols atuais superarem o recorde. */
          async saveHiScoreIfNeeded(){ const key='footnoid_hiscore'; if(this.goals>this.hiscore){ this.hiscore=this.goals; try{ localStorage.setItem(key, String(this.hiscore)); }catch(e){} if(HISCORE_REMOTE && HISCORE_REMOTE.url){ submitHiScore(this.hiscore, this.hiscoreName).catch(()=>{}); } } }
          
          constructor(){ this.resetAll(); }
          /** Zera estado de uma nova corrida e constrói o nível inicial. */
          resetAll(){ this.level=1; this.lives=3; this.goals=0; this.hiscore = Number(localStorage.getItem('footnoid_hiscore')||0);
            this.hiscoreName = (localStorage.getItem('footnoid_hiscore_name') || '—');
            this.newRecordThisRun = false;
            try{ this.startBest = Math.max(this.hiscore, Number(localStorage.getItem('footnoid_hiscore')||0)); }catch(e){ this.startBest = this.hiscore; } this.particles=[]; this.paddle=new Paddle(this); this.ball=new Ball(this); this.opponents=[]; this.goalDepth=54; this.goalRatio=.36; this.computeGoal(); this.running=false; this.paused=false; this.updateHUD(); this.buildLevel(this.level); this.goalie=new Goalie(this); if(!this.goalieMoving) this.goalie.vx = 0; }
            /** Recalcula dimensões do gol baseada na largura da tela. */
            computeGoal(){ this.goalW = W*this.goalRatio; this.goalX = (W - this.goalW)/2; }
            /** Reposiciona paddle/bola, recalcula gol e reconstroi goleiro e oponentes após resize. */
            onResize(){ const maskOpp = this.opponents.map(o=>({relX:o.x/W, y:o.y, w:o.w, h:o.h, dir:o.vx>=0?1:-1})); this.paddle.recenter(); this.ball.resetOnPaddle(); this.computeGoal(); this.goalie = new Goalie(this);
              this.opponents = maskOpp.map(m=>{ const w=Math.max(40, W*0.18); const x=clamp(m.relX*W,0,W-w); const vx=(140 + 20*this.level) * m.dir; return new Opponent(x, m.y, w, 16, vx); });
            }
            /** Tabela de progressão: quantos oponentes e se o goleiro se move em cada nível. */
            getLevelConfig(n){
              const oppTable = [0,1,2,0,1,2,3,4,5,6];
              const idx = Math.min(n, 10) - 1;
              const opps = (idx>=0 && idx<oppTable.length) ? oppTable[idx] : Math.min(6, Math.max(0, n-4));
              const goalieMoving = n >= 4;
              return {opps, goalieMoving};
            }
            /** Popula array de oponentes para o nível atual com velocidades e posições aleatórias. */
            buildLevel(n){
              this.opponents = [];
              const cfg = this.getLevelConfig(n);
              this.goalieMoving = cfg.goalieMoving;
              const count = cfg.opps;
              if (count <= 0) { return; }
              const marginTop = this.goalDepth + 70;
              const marginBottom = H * 0.55;
              for (let i = 0; i < count; i++) {
                const y = marginTop + i * ((marginBottom - marginTop) / Math.max(1, count - 1));
                const w = Math.max(40, W * 0.18); const x = Math.max(0, Math.min(W - w, Math.random() * (W - w)));
                const speed = 160 + n * 30 + (Math.random()*80 - 20);
                const dir = Math.random() < .5 ? -1 : 1;
                this.opponents.push(new Opponent(x, y, w, 16, speed * dir));
              }
            }
            /** Atualiza elementos do HUD e sincroniza com localStorage (com fallbacks). */
            updateHUD(){
              try{
                const gEl = document.getElementById('goals'); if (gEl) gEl.textContent = this.goals;
                const lEl = document.getElementById('level'); if (lEl) lEl.textContent = this.level;
                const liEl = document.getElementById('lives'); if (liEl) liEl.textContent = this.lives;
                
                try{
                  const stored = Number(localStorage.getItem('footnoid_hiscore') || 0);
                  if (stored > this.hiscore) this.hiscore = stored;
                }catch(e){}
                
                const hsEl = document.getElementById('hiscore'); if (hsEl) hsEl.textContent = String(this.hiscore);
                const holder = document.getElementById('hiscoreHolder');
                if (holder) holder.textContent = (this.hiscoreName || localStorage.getItem('footnoid_hiscore_name') || '—');
              }catch(e){
              const hsEl = document.getElementById('hiscore'); if (hsEl) hsEl.textContent = String(this.hiscore);
              const holderEl = document.getElementById('hiscoreHolder'); if (holderEl) holderEl.textContent = this.hiscoreName || '—';
            }
          }
          start(){
            
            this.running=true; this.paused=false; hideOverlay(); 
          }
          restart(){
            this.resetAll(); this.start(); 
          }
          loseLife(){
            this.lives--; this.updateHUD(); beep(180,140,'sawtooth',.06); if(this.lives<=0){ this.gameOver(); } else { this.ball.resetOnPaddle(); this.running=true; }
          }
          async scoreGoal(own){
            this.goals++; await this.saveHiScoreIfNeeded(); this.updateHUD(); beep(1000,200,'sine',.12); this.spark(this.ball.x, this.ball.y, 24); this.nextLevel(own); 
          }
          nextLevel(own){
            this.level++; this.paddle.widthRatio = Math.max(0.16, this.paddle.widthRatio*0.97); this.ball.baseSpeed *= 1.06; this.buildLevel(this.level); this.goalie = new Goalie(this); if(!this.goalieMoving) this.goalie.vx = 0; this.ball.resetOnPaddle(); const msg = own ? 'GOL CONTRA! 🐔' : 'GOOOL! ⚽'; this.flash(`${msg}
            Nível ${this.level}`); }
            
            async gameOver(){ this.running=false; this.paused=false;
              
              // Decisão robusta: comparar com o melhor do INÍCIO da partida
              let baseline;
              try{
                if (typeof this.startBest === 'number') {
                  baseline = this.startBest;
                } else {
                const hud = parseInt((document.getElementById('hiscore')?.textContent||'0'),10)||0;
                const localBest = Number(localStorage.getItem('footnoid_hiscore')||0);
                baseline = Math.max(this.hiscore||0, localBest||0, hud||0);
              }
            }
            catch(e){ baseline = this.hiscore||0; }
            
            const isNewRecord = this.goals > (baseline||0);
            this.newRecordThisRun = isNewRecord;
            
            if(isNewRecord){
              const html = `<h1>NOVO RECORDE! 🏆</h1>
              <p>Gols: <strong>${this.goals}</strong></p>
              <label style="display:block;margin:8px 0 6px;">Seu nome (máx 12, letras/números):</label>
              <input id="ovName" type="text" inputmode="latin" maxlength="12" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:white;">
              <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
              <button id="ovSaveStart">Salvar e Recomeçar</button>
              </div>`;
              
              showOverlay(html); overlay.dataset.locked='1';
              setTimeout(()=>{
                const input = document.getElementById('ovName');
                const btn = document.getElementById('ovSaveStart');
                if (input) { input.focus(); }
                const trySave = async ()=>{
                  let raw = input ? input.value : '';
                  let name = sanitizeName(raw);
                  if(!name){ alert('Nome vazio ou inválido. Use apenas letras e números.'); return; }
                  if(!isNameAllowed(name)){ alert('Nome contém palavra proibida. Escolha outro.'); return; }
                  // persistir e enviar
                  this.hiscore = Math.max(this.hiscore||0, this.goals||0);
                  this.hiscoreName = name;
                  this.updateHUD(); try{
                    localStorage.setItem('footnoid_hiscore', String(this.hiscore));
                    localStorage.setItem('footnoid_hiscore_name', name);
                  }
                  catch(e){}
                  if(HISCORE_REMOTE && HISCORE_REMOTE.url){ submitHiScore(this.hiscore, this.hiscoreName).catch(()=>{}); }
                  this.updateHUD(); this.newRecordThisRun=false; overlay.dataset.locked='0'; hideOverlay(); this.restart();
                  
                };
                if (btn) { btn.onclick = trySave; }
                if (input) {
                  input.addEventListener('keydown', (ev)=>{
                    if(ev.key==='Enter'){ ev.preventDefault(); if(btn) btn.click(); } 
                  });
                }
              }, 0);
            } else {
            showOverlay(`<h1>Fim de jogo</h1><p>Gols: <strong>${this.goals}</strong></p><p><kbd>R</kbd> para recomeçar ou clique em <em>Começar</em>.</p><button id="ovRetry">Recomeçar</button>`);
            setTimeout(()=>{ const btn=document.getElementById('ovRetry'); if(btn) btn.onclick=()=>{ this.restart(); hideOverlay(); }; }, 0);
          }
        }
        /** Mostra uma mensagem temporária no overlay (auto esconde). */
        flash(text) {
    // REMOVIDO: <div class=overlay-card>...</div>
    // Mantemos apenas o conteúdo interno
    showOverlay(`<h1>${text.replace(/\n/g,'<br>')}</h1><p>Toque ou pressione qualquer tecla…</p>`);
    setTimeout(() => hideOverlay(), 2500);
}
        spark(x,y,n=8){ for(let i=0;i<n;i++) this.particles.push(new Spark(x,y)); }
      }
      
      
      // ======================================================================
      // Renderização do campo e do gol
      // ======================================================================
      function drawField(){
        const stripeH = 36;
		for(let y=0;y<H;y+=stripeH){ ctx.fillStyle = (Math.floor(y/stripeH)%2)? getCSS('--grass1') : getCSS('--grass2'); ctx.fillRect(0,y,W,stripeH); }
        ctx.strokeStyle=getCSS('--line');
		ctx.lineWidth=2;
		ctx.globalAlpha=.25;
        ctx.beginPath(); ctx.moveTo(0, H*0.5); ctx.lineTo(W, H*0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(W/2, H*0.5, 36, 0, Math.PI*2); ctx.stroke();
        const g=game;
		const areaW = g.goalW*1.6;
		const areaX = g.goalX - (areaW - g.goalW)/2;
		const areaH = 80; ctx.strokeRect(areaX, 2, areaW, areaH);
        const smallW=g.goalW*1.2;
		const smallX = g.goalX - (smallW - g.goalW)/2;
		const smallH=44; ctx.strokeRect(smallX, 2, smallW, smallH);
        ctx.beginPath(); ctx.arc(W/2, g.goalDepth + 34, 2.5, 0, Math.PI*2); ctx.fillStyle=getCSS('--line'); ctx.fill();
        ctx.globalAlpha=1;
        drawGoal();
      }
      function drawGoal(){
		// Desenha a trave estilo “bracket” com cantos arredondados, sem rede.
		const g = game;
		const x = g.goalX;
		const w = g.goalW;
		
		// Posição/estilo do bracket (apenas topo + “perninhas” curtas)
		const topY = 8;      // distância do topo da tela
		const leg  = 12;      // altura das perninhas verticais nas extremidades
		const r    = 8;      // raio do arredondamento dos cantos
		ctx.save();
		ctx.globalAlpha = 0.9;
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth   = 4;
		//ctx.lineCap     = 'round';
		ctx.lineJoin    = 'round';
		ctx.beginPath();
		// Começa no fim da perninha esquerda
		ctx.moveTo(x, topY + leg);
		// Sobe até o canto arredondado
		ctx.lineTo(x, topY + r);
		ctx.arcTo(x, topY, x + r, topY, r);
		// Barra superior
		ctx.lineTo(x + w - r, topY);
		// Canto direito arredondado e perninha direita
		ctx.arcTo(x + w, topY, x + w, topY + r, r);
		ctx.lineTo(x + w, topY + leg);
		ctx.stroke();
		ctx.restore();
		}
      
      // ======================================================================
      // Bootstrapping: init, game loop, render e HUD
      // ======================================================================
      function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
      
      resizeCanvas();
      game = new Game(); window.game = game; if(HISCORE_REMOTE && HISCORE_REMOTE.url){ fetchHiScore().then(v=>{ if(typeof v==='number' && v>game.hiscore){ game.hiscore=v; game.updateHUD(); } }); }
      let last=performance.now();
      function loop(now){ requestAnimationFrame(loop); const dt=Math.min(0.033, (now-last)/1000); last=now; if(!game.running||game.paused){ draw(); return; } update(dt); draw(); }
      function update(dt){ game.paddle.update(dt); game.ball.update(dt); if(game.goalie) game.goalie.update(dt); for(const o of game.opponents) o.update(dt); for(let i=game.particles.length-1;i>=0;i--){ const p=game.particles[i]; p.update(dt); if(p.life<=0) game.particles.splice(i,1);} }
      function draw(){ ctx.clearRect(0,0,W,H); drawField(); for(const o of game.opponents) o.draw(ctx); if(game.goalie) game.goalie.draw(ctx); game.paddle.draw(ctx); game.ball.draw(ctx); for(const p of game.particles) p.draw(ctx); ctx.save(); if(wmLogo && wmLogo.complete){  const maxW=W*0.5;  const iw=wmLogo.naturalWidth||1, ih=wmLogo.naturalHeight||1;  const ratio=ih/iw;  const wLogo=Math.min(maxW, iw);  const hLogo=wLogo*ratio;  const xLogo=(W - wLogo)/2;  const yCenter=H*0.70;  const yLogo=yCenter - hLogo*0.5;  ctx.globalAlpha=.08;  ctx.drawImage(wmLogo, xLogo, yLogo, wLogo, hLogo);  const f=Math.max(14, Math.round(W*0.045));  ctx.textAlign='center'; ctx.textBaseline='top';  ctx.font=`700 ${f}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;  ctx.fillStyle='#fff';  ctx.fillText(`Nível ${game.level}`, W/2, yLogo + hLogo + f*0.4); } ctx.restore();; }
      requestAnimationFrame(loop);
      
      function setHUD(){ if(window.game) game.updateHUD(); }
      setHUD();
    })();