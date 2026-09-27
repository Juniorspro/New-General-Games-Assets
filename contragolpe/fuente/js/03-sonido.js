
/* ====================== sonido ======================
   El contexto se abre con el primer toque. Cada id busca su muestra (o sus variantes _1.._4 al azar); lo que no llegó se
   sintetiza por código (ruido filtrado y osciladores) para que nunca haya silencio. En 3D: caída por distancia, paneo según
   hacia dónde mira la cámara y paso bajo si hay una pared en el medio; los disparos lejanos usan la muestra de lejos.
   Música por momentos (menú, ronda, bomba, victoria, derrota) y voces de radio en el idioma elegido. */
let AC = null, AMAS = null, AMUS = null;
const SINT = {};
/* con la página oculta (la app minimizada, otra pestaña, la pantalla apagada) el sonido se calla: el teléfono no lo corta solo */
document.addEventListener('visibilitychange', ()=>{ if(!AC) return;
  if(document.hidden){ if(AC.state === 'running'){ AC.suspend(); AC.__oculto = true; } } else if(AC.__oculto){ AC.__oculto = false; AC.resume(); } });
function iniciarAudio(){
  if(AC){ if(AC.state === 'suspended') AC.resume(); return; }
  try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return; }
  AMAS = AC.createGain(); AMAS.gain.value = G.sonido === false ? 0 : 0.9; AMAS.connect(AC.destination);
  AMUS = AC.createGain(); AMUS.gain.value = 0.32; AMUS.connect(AMAS);
  decAudios(); if(MUS.pedida) musica(MUS.pedida, true);
}
for(const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, iniciarAudio, {passive:true});
function variante(id){ if(SONIDOS[id]) return SONIDOS[id]; const vs = []; for(let i=1;i<=4;i++) if(SONIDOS[id + '_' + i]) vs.push(SONIDOS[id + '_' + i]); return vs.length ? vs[Math.floor(Math.random()*vs.length)] : null; }
/* respaldo sintetizado por familia */
function sintetizar(id){
  if(SINT[id]) return SINT[id]; const sr = AC.sampleRate, fam = id.split('_')[0];
  const dur = {disparo:0.45, impacto:0.12, paso:0.1, ui:0.08, he:1.6, c4:id.includes('explosion') ? 2.2 : 0.09, flash:0.9, humo:1.2, granada:0.15, casquillo:0.15, cuchillo:0.2, desactivar:0.3, desactivada:0.5, dinero:0.18, tiro:0.12, casco:0.15, baja:0.2, ronda:0.8, mira:0.06, golpe:0.07}[fam] || 0.15;
  const n = Math.max(1, Math.floor(sr*dur)), b = AC.createBuffer(1, n, sr), d = b.getChannelData(0); let lp = 0, ph = 0;
  for(let i=0;i<n;i++){ const t = i/sr, u = i/n, r = Math.random()*2 - 1; let v = 0;
    if(fam === 'disparo'){ lp += (r - lp)*0.35; v = (lp*Math.exp(-t*18) + Math.sin(TAU*55*t)*Math.exp(-t*25)*0.8)*1.1; }
    else if(fam === 'he' || id.includes('explosion')){ lp += (r - lp)*0.08; v = lp*Math.exp(-t*2.2)*2 + Math.sin(TAU*38*t)*Math.exp(-t*4); }
    else if(fam === 'flash'){ v = r*Math.exp(-t*5)*0.7 + Math.sin(TAU*3200*t)*Math.exp(-t*1.5)*0.15; }
    else if(fam === 'humo'){ lp += (r - lp)*0.12; v = lp*Math.sin(Math.PI*u)*0.6; }
    else if(fam === 'impacto' || fam === 'casco' || fam === 'golpe'){ v = r*Math.exp(-t*60)*(fam === 'casco' ? 0.5 + Math.sin(TAU*2400*t)*0.5 : 1); }
    else if(fam === 'paso'){ lp += (r - lp)*0.2; v = lp*Math.exp(-t*40)*0.8; }
    else if(fam === 'c4' || fam === 'mira'){ v = Math.sign(Math.sin(TAU*(fam === 'mira' ? 1200 : 1850)*t))*0.3*Math.exp(-t*12); }
    else if(fam === 'dinero'){ v = Math.sin(TAU*(1200 + u*800)*t)*0.3*(1 - u); }
    else if(fam === 'baja' || fam === 'tiro'){ v = Math.sin(TAU*(fam === 'tiro' ? 1600 : 900)*t)*0.35*Math.exp(-t*20); }
    else if(fam === 'ronda'){ ph += TAU*(330 + (u > 0.5 ? 110 : 0))/sr; v = Math.sin(ph)*0.25*Math.sin(Math.PI*u); }
    else if(fam === 'ui'){ v = Math.sin(TAU*(id.includes('no') ? 220 : 760)*t)*0.25*Math.exp(-t*30); }
    else { v = r*Math.exp(-t*30)*0.5; }
    d[i] = v; }
  return SINT[id] = b;
}
function tocar(buf, vol, pan, grave, vel){ if(!AC || !buf) return; const s = AC.createBufferSource(); s.buffer = buf; s.playbackRate.value = vel || (0.94 + Math.random()*0.12);
  const g = AC.createGain(); g.gain.value = vol; let n = s;
  if(grave){ const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = grave; n.connect(f); n = f; }
  if(pan && AC.createStereoPanner){ const p = AC.createStereoPanner(); p.pan.value = lim(pan, -1, 1); n.connect(p); n = p; }
  n.connect(g); g.connect(AMAS); s.start(); }
function sonar3D(id, pos, vol, op){
  if(!AC) return; op = op || {}; let v = vol === undefined ? 1 : vol;
  const dx = pos.x - cam.position.x, dy = pos.y - cam.position.y, dz = pos.z - cam.position.z, d = Math.hypot(dx, dy, dz);
  let buf = null;
  if(id.startsWith('disparo_') && op.lejos && d > 38){ buf = variante('disparo_lejano'); v *= 0.9; }
  if(!buf) buf = variante(id) || (id.startsWith('disparo_') ? variante('disparo_ak') : null) || sintetizar(id);
  const caida = 1/(1 + Math.pow(d/(id.startsWith('disparo') || id.includes('explosion') ? 18 : 7), 1.4)); if(caida < 0.015) return;
  const yaw = cam.rotation.y, der = V3(Math.cos(yaw), 0, -Math.sin(yaw)), pan = d > 0.5 ? (dx*der.x + dz*der.z)/d : 0;
  let grave = null; if(d > 3 && !vistaLibre(cam.position.x, cam.position.y, cam.position.z, pos.x, pos.y + 0.8, pos.z)){ grave = 900; v *= 0.55; }
  tocar(buf, v*caida, pan*0.85, grave);
}
function sonarVM(id, vol){ if(!AC) return; tocar(variante(id) || (id.startsWith('disparo_') ? variante('disparo_ak') : null) || sintetizar(id), vol || 0.8, 0, null); }
function sonarUI(id){ if(!AC) return; tocar(variante(id) || sintetizar(id), 0.55, 0, null, 1); }
function vozRadio(clave){ if(!AC) return; const l = G.idioma || 'es', b = SONIDOS['voz_' + clave + '_' + l] || SONIDOS['voz_' + clave + '_es']; if(b) tocar(b, 0.8, 0, null, 1); }
/* pasos: cada 1,25 m corriendo; caminar con SHIFT o agachado no suena (como en CS) */
function pasosDe(a, dt){ if(!a.vivo || !a.c.enSuelo) return; const v = velH(a); if(v < 3.2 || a.c.agachado > 0.5) return;
  a.pasoD = (a.pasoD || 0) + v*dt; if(a.pasoD < 1.25) return; a.pasoD = 0;
  const t = rayo(a.c.pos.x, a.c.pos.y + 0.1, a.c.pos.z, 0, -1, 0, 0.5, F_SOLIDA, false, -1), mat = t >= 0 ? MUNDO.mat[RAYO.caja] : null, M = MATS[mat] || {};
  sonar3D('paso_' + ({metal:'metal', madera:'madera', tierra:'tierra'}[M.paso] || 'hormigon'), a.c.pos, a.esJugador ? 0.35 : 0.8); }
/* ---------- música ---------- */
const MUS = {actual:null, fuente:null, gan:null, pedida:null, cambio:false};
function musica(id, forzar){ MUS.pedida = id; if(!AC) return; if(MUS.actual === id && !forzar && MUS.fuente) return;
  const b = variante(id) || (id === 'mus_menu' ? variante('mus_menu_a') : id === 'mus_ronda' ? variante('mus_ronda_a') : null);
  if(MUS.fuente){ const g = MUS.gan, f = MUS.fuente; g.gain.setTargetAtTime(0, AC.currentTime, 0.4); setTimeout(()=>{ try{ f.stop(); }catch(e){} }, 1500); MUS.fuente = null; }
  MUS.actual = id; if(!b) return; const s = AC.createBufferSource(); s.buffer = b; s.loop = !['mus_victoria', 'mus_derrota'].includes(id); const g = AC.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, AC.currentTime, 0.5);
  s.connect(g); g.connect(AMUS); s.start(); MUS.fuente = s; MUS.gan = g; }
function volumenGeneral(on){ G.sonido = on; if(AMAS) AMAS.gain.value = on ? 0.9 : 0; }
