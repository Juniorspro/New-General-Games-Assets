
/* ====================== HUD, mandos táctiles, compra y marcador ======================
   El HUD se dibuja en su propio lienzo 2D (encima del 3D, sin tocar el post): estilo historieta, trazo negro, amarillo de acento.
   Arriba al medio el marcador de rondas con el reloj; arriba a la izquierda el radar; arriba a la derecha las bajas; abajo a la
   izquierda vida y blindaje, abajo a la derecha la munición; al medio la mira (se abre con la imprecisión real del arma),
   las marcas de impacto y de dónde vino el daño. */
const gH = hg;   /* el lienzo del HUD lo mide c2.js */
const HUD = {w:0, h:0, dpr:1, golpes:[], danos:[], marcaT:0, marcaCab:false, muerteTxt:'', radar:null, radarEsc:2.2, avisoT:0, tDibujo:0, compraAbierta:false, marcador:false};
function hudMedir(){ HUD.w = cvH.clientWidth || innerWidth; HUD.h = cvH.clientHeight || innerHeight; HUD.dpr = cvH.width/Math.max(1, HUD.w); }
const COL = {tinta:'#0b0b0e', amarillo:'#ffd23f', ct:'#6f9bff', t:'#ffb13b', rojo:'#ff3b30', verde:'#7dff6a', blanco:'#ffffff'};
function txt(s, x, y, tam, color, alin, borde){ gH.font = 'italic 900 ' + tam + 'px "Arial Black", Roboto, sans-serif'; gH.textAlign = alin || 'left'; gH.textBaseline = 'middle';
  gH.lineWidth = borde === undefined ? Math.max(2, tam*0.18) : borde; gH.strokeStyle = COL.tinta; gH.lineJoin = 'round'; gH.strokeText(s, x, y); gH.fillStyle = color || COL.blanco; gH.fillText(s, x, y); }
function cajaHUD(x, y, w, h, fondo, borde){ gH.fillStyle = fondo || 'rgba(12,13,18,.72)'; gH.fillRect(x, y, w, h); gH.lineWidth = 2.5; gH.strokeStyle = borde || COL.tinta; gH.strokeRect(x, y, w, h); }
function reloj(s){ s = Math.max(0, Math.ceil(s)); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); }
/* ---------- radar: el piso del mapa visto de arriba, horneado una vez ---------- */
function armarRadar(){
  if(!NAV.listo) return; const esc = HUD.radarEsc, W = Math.ceil(NAV.nx*NAV.cel*esc), H = Math.ceil(NAV.nz*NAV.cel*esc), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, W, H);
  let yMin = 1e9, yMax = -1e9; for(let k=0;k<NAV.n;k++){ yMin = Math.min(yMin, NAV.py[k]); yMax = Math.max(yMax, NAV.py[k]); }
  for(let k=0;k<NAV.n;k++){ const x = (NAV.px[k] - NAV.x0)*esc, z = (NAV.pz[k] - NAV.z0)*esc, h = (NAV.py[k] - yMin)/Math.max(1, yMax - yMin), v = Math.round(92 + h*90);
    g.fillStyle = 'rgb(' + v + ',' + (v + 4) + ',' + (v + 10) + ')'; g.fillRect(x - esc*NAV.cel*0.5, z - esc*NAV.cel*0.5, esc*NAV.cel + 0.6, esc*NAV.cel + 0.6); }
  /* bordes: donde el piso termina */
  const img = g.getImageData(0, 0, W, H), d = img.data, borde = new Uint8ClampedArray(d.length);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ const i = (y*W + x)*4; if(d[i+3] === 0) continue; if(d[i+3-4] === 0 || d[i+3+4] === 0 || d[i+3-W*4] === 0 || d[i+3+W*4] === 0){ borde[i] = 11; borde[i+1] = 11; borde[i+2] = 14; borde[i+3] = 255; } }
  for(let i=0;i<d.length;i+=4) if(borde[i+3]){ d[i] = borde[i]; d[i+1] = borde[i+1]; d[i+2] = borde[i+2]; d[i+3] = 255; }
  g.putImageData(img, 0, 0);
  for(const k in OBRA.sitios || {}){ const s = OBRA.sitios[k]; const x = (s.cx - NAV.x0)*esc, z = (s.cz - NAV.z0)*esc; g.font = 'italic 900 ' + Math.round(10*esc) + 'px Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#0b0b0e'; g.strokeText(k, x, z); g.fillStyle = '#ffd23f'; g.fillText(k, x, z); }
  HUD.radar = c;
}
function dibujarRadar(a, x, y, R){
  if(!HUD.radar) armarRadar(); if(!HUD.radar) return; const esc = HUD.radarEsc, zoom = 1.1;
  gH.save(); gH.beginPath(); gH.arc(x, y, R, 0, TAU); gH.fillStyle = 'rgba(10,12,16,.62)'; gH.fill(); gH.clip();
  gH.translate(x, y); gH.rotate(a.yaw); gH.scale(zoom, zoom);   /* adelante del jugador queda arriba */
  gH.drawImage(HUD.radar, -(a.c.pos.x - NAV.x0)*esc, -(a.c.pos.z - NAV.z0)*esc);
  /* puntos */
  const pun = (px, pz, color, r, forma)=>{ const X = (px - a.c.pos.x)*esc, Z = (pz - a.c.pos.z)*esc; gH.beginPath(); if(forma === 'x'){ gH.moveTo(X - r, Z - r); gH.lineTo(X + r, Z + r); gH.moveTo(X + r, Z - r); gH.lineTo(X - r, Z + r); gH.lineWidth = 2.5; gH.strokeStyle = color; gH.stroke(); return; }
    gH.arc(X, Z, r, 0, TAU); gH.fillStyle = color; gH.fill(); gH.lineWidth = 1.5; gH.strokeStyle = COL.tinta; gH.stroke(); };
  const vistos = new Set(); for(const o of ACTORES) if(o.bot && o.vivo && (PARTIDA.modo !== 'bomba' || o.bando === a.bando)) for(const k in o.bot.visto) if(o.t - o.bot.visto[k].t < 1.5) vistos.add(+k);
  for(const o of ACTORES){ if(o === a) continue; const aliado = PARTIDA.modo === 'bomba' && o.bando === a.bando;
    if(!o.vivo){ if(aliado) pun(o.c.pos.x, o.c.pos.z, 'rgba(255,255,255,.5)', 3.5, 'x'); continue; }
    if(aliado) pun(o.c.pos.x, o.c.pos.z, o.bando === 'ct' ? COL.ct : COL.t, 4);
    else if(vistos.has(o.id) || (o.t - o.ultTiro < 0.6 && !ARMAS[o.actual].silenciada)) pun(o.c.pos.x, o.c.pos.z, COL.rojo, 4); }
  if(BOMBA.estado === 'plantada') pun(BOMBA.pos.x, BOMBA.pos.z, (J.t % 30) < 15 ? COL.rojo : '#fff', 4.5);
  else { const s = SUELTAS.find(s=> s.esBomba); if(s && (a.bando === 't')) pun(s.pos.x, s.pos.z, COL.amarillo, 4); }
  gH.restore();
  /* el jugador: flecha fija arriba */
  gH.beginPath(); gH.moveTo(x, y - 7); gH.lineTo(x + 5, y + 5); gH.lineTo(x, y + 2); gH.lineTo(x - 5, y + 5); gH.closePath(); gH.fillStyle = '#fff'; gH.fill(); gH.lineWidth = 1.5; gH.strokeStyle = COL.tinta; gH.stroke();
  gH.beginPath(); gH.arc(x, y, R, 0, TAU); gH.lineWidth = 3; gH.strokeStyle = COL.tinta; gH.stroke();
}
/* ---------- mira de CS: cuatro trazos con hueco según la imprecisión ---------- */
function dibujarMira(a, cx, cy){
  const W = ARMAS[a.actual]; if(!W || W.clase === 'granada' || W.clase === 'c4') { return; }
  if(W.mira && a.mira) return;
  const col = {verde:'#7dff6a', amarillo:'#ffd23f', blanco:'#ffffff', cian:'#56f0ff', rosa:'#ff5ad8'}[G.mira || 'verde'] || '#7dff6a';
  const inex = W.clase === 'cuchillo' ? 0 : inexactitud(a), fov = cam.fov*GRAD, px = HUD.h/2/Math.tan(fov/2), hueco = 3 + Math.tan(inex)*px*0.9, L = 6.5, g2 = Math.min(60, hueco);
  gH.lineCap = 'butt';
  for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ gH.beginPath(); gH.moveTo(cx + dx*g2, cy + dy*g2); gH.lineTo(cx + dx*(g2 + L), cy + dy*(g2 + L)); gH.lineWidth = 4.2; gH.strokeStyle = COL.tinta; gH.stroke(); gH.lineWidth = 2; gH.strokeStyle = col; gH.stroke(); }
  if(W.clase === 'cuchillo' || W.clase === 'francotirador'){ gH.fillStyle = COL.tinta; gH.fillRect(cx - 2, cy - 2, 4, 4); gH.fillStyle = col; gH.fillRect(cx - 1, cy - 1, 2, 2); }
  /* marca de impacto */
  if(HUD.marcaT > 0){ const k = HUD.marcaT/0.3, r0 = 8, r1 = 15, c = HUD.marcaCab ? COL.rojo : '#fff'; gH.globalAlpha = Math.min(1, k*1.6);
    for(const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){ gH.beginPath(); gH.moveTo(cx + sx*r0, cy + sy*r0); gH.lineTo(cx + sx*r1, cy + sy*r1); gH.lineWidth = 4; gH.strokeStyle = COL.tinta; gH.stroke(); gH.lineWidth = 2; gH.strokeStyle = c; gH.stroke(); }
    gH.globalAlpha = 1; }
}
/* ---------- la mira del AWP ---------- */
function dibujarMiraAWP(cx, cy){ const R = Math.min(HUD.w, HUD.h)*0.46;
  gH.fillStyle = '#000'; gH.beginPath(); gH.rect(0, 0, HUD.w, HUD.h); gH.arc(cx, cy, R, 0, TAU, true); gH.fill();
  gH.strokeStyle = '#000'; gH.lineWidth = 1.4; gH.beginPath(); gH.moveTo(cx - R, cy); gH.lineTo(cx + R, cy); gH.moveTo(cx, cy - R); gH.lineTo(cx, cy + R); gH.stroke();
  gH.lineWidth = 3.5; gH.beginPath(); gH.moveTo(cx - R, cy); gH.lineTo(cx - R*0.18, cy); gH.moveTo(cx + R*0.18, cy); gH.lineTo(cx + R, cy); gH.moveTo(cx, cy + R*0.18); gH.lineTo(cx, cy + R); gH.stroke();
  const gr = gH.createRadialGradient(cx, cy, R*0.75, cx, cy, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)'); gH.fillStyle = gr; gH.beginPath(); gH.arc(cx, cy, R, 0, TAU); gH.fill(); }
/* ---------- el cuadro ---------- */
function pasarHUD(dt){
  const a = PARTIDA.jugador; if(!a) return; hudMedir();
  HUD.marcaT = Math.max(0, HUD.marcaT - dt); for(const d of HUD.danos) d.t -= dt; HUD.danos = HUD.danos.filter(d=> d.t > 0);
  for(const f of PARTIDA.feed) f.t -= dt; PARTIDA.feed = PARTIDA.feed.filter(f=> f.t > 0);
  /* post: flash, daño y muerte */
  POST.cegado = a.cegado > 0 ? Math.min(1, a.cegado/Math.max(0.5, Math.min(a.cegadoMax, 2.2))) : 0; POST.danio = Math.max(0, POST.danio - dt*1.8); POST.muerto = lerp(POST.muerto, a.vivo ? 0 : 0.7, 1 - Math.exp(-dt*3));
  HUD.tDibujo += dt; if(HUD.tDibujo < 1/30) return; HUD.tDibujo = 0; dibujarHUD(a);
  controlesVisibles(a);
}
function dibujarHUD(a){
  const d = HUD.dpr, W = HUD.w, H = HUD.h; gH.setTransform(d, 0, 0, d, 0, 0); gH.clearRect(0, 0, W, H);
  const cx = W/2, cy = H/2, Wp = ARMAS[a.actual], esBomba = PARTIDA.modo === 'bomba';
  if(a.vivo && Wp && Wp.mira && a.mira) dibujarMiraAWP(cx, cy);
  /* marcador de arriba */
  const top = 6;
  if(esBomba){ const bw = 150, x0 = cx - bw/2; cajaHUD(x0, top, bw, 30);
    txt(String(PARTIDA.ganadas.ct), x0 + 18, top + 15, 17, COL.ct, 'center'); txt(String(PARTIDA.ganadas.t), x0 + bw - 18, top + 15, 17, COL.t, 'center');
    const tr = BOMBA.estado === 'plantada' ? '💣' : PARTIDA.fase === 'congelado' ? reloj(PARTIDA.t) : reloj(PARTIDA.tiempo);
    txt(tr, cx, top + 15, 16, BOMBA.estado === 'plantada' ? COL.rojo : (PARTIDA.tiempo < 10 ? COL.rojo : '#fff'), 'center');
    /* vivos por bando */
    const vc = vivosDe('ct'), vt = vivosDe('t'); for(let i=0;i<5;i++){ gH.fillStyle = i < vc ? COL.ct : 'rgba(255,255,255,.18)'; gH.fillRect(x0 - 8 - i*9, top + 9, 6, 12); gH.fillStyle = i < vt ? COL.t : 'rgba(255,255,255,.18)'; gH.fillRect(x0 + bw + 2 + i*9, top + 9, 6, 12); } }
  else { const bw = 170, x0 = cx - bw/2; cajaHUD(x0, top, bw, 30); txt(reloj(PARTIDA.tiempo), cx, top + 15, 16, '#fff', 'center');
    const orden = ACTORES.slice().sort((x, y)=> PARTIDA.modo === 'armas' ? y.nivel - x.nivel || y.bajas - x.bajas : y.bajas - x.bajas), lider = orden[0];
    if(lider) txt((PARTIDA.modo === 'armas' ? 'NIVEL ' + (lider.nivel + 1) + ' · ' : lider.bajas + ' · ') + lider.nombre, cx, top + 44, 11, lider === a ? COL.amarillo : '#fff', 'center');
    if(PARTIDA.modo === 'armas'){ const n = ESCALERA_ARMAS.length; txt('ARMA ' + Math.min(n, a.nivel + 1) + '/' + n, x0 + 10, top + 15, 11, COL.amarillo); } else txt(a.bajas + ' BAJAS', x0 + 8, top + 15, 10, COL.amarillo); }
  /* radar */
  dibujarRadar(a, 60, 62, 52);
  if(esBomba){ txt('$' + a.dinero, 12, 128, 17, COL.verde); if(PARTIDA.compraT > 0 && enZonaCompra(a) && a.vivo) txt('COMPRA ' + reloj(PARTIDA.compraT), 12, 148, 10, COL.amarillo); }
  /* bajas */
  let fy = top + 8; for(const f of PARTIDA.feed.slice(0, 5)){ gH.font = 'italic 900 11px "Arial Black", Roboto'; const s1 = f.atac, s2 = f.v, arma = ARMAS[f.arma] ? ARMAS[f.arma].nom : f.arma.toUpperCase(), s = s1 + '  ' + arma + (f.cabeza ? ' ◉' : '') + '  ' + s2;
    const w = gH.measureText(s).width + 16, x = W - 58 - w; cajaHUD(x, fy, w, 20, f.jug ? 'rgba(80,20,10,.8)' : 'rgba(12,13,18,.72)', f.jug ? COL.rojo : COL.tinta);
    const colB = b=> b === 'ct' ? COL.ct : b === 't' ? COL.t : '#fff'; let xx = x + 8; txt(s1, xx, fy + 10, 11, colB(f.atacB)); gH.font = 'italic 900 11px "Arial Black", Roboto'; xx += gH.measureText(s1 + '  ').width;
    txt(arma + (f.cabeza ? ' ◉' : ''), xx, fy + 10, 10, COL.amarillo); xx += gH.measureText(arma + (f.cabeza ? ' ◉' : '') + '  ').width; txt(s2, xx, fy + 10, 11, colB(f.vB)); fy += 23; }
  if(a.vivo){
    /* vida y blindaje */
    const vy = H - 26; cajaHUD(10, vy - 17, 150, 34); const vida = Math.ceil(a.vida); gH.fillStyle = vida > 40 ? '#ffffff' : COL.rojo; gH.fillRect(14, vy + 9, 60*vida/100, 4);
    txt('✚ ' + vida, 16, vy - 3, 18, vida > 40 ? '#fff' : COL.rojo); txt((a.casco ? '⛑ ' : '⛊ ') + Math.ceil(a.blindaje), 92, vy - 3, 15, a.blindaje > 0 ? COL.ct : 'rgba(255,255,255,.35)');
    /* munición */
    const m = a.mun[a.actual]; if(m && Wp && Wp.carg){ const ax = W - 160; cajaHUD(ax - 110, vy - 17, 104, 34); txt(String(m.carg), ax - 60, vy, 22, m.carg <= Wp.carg*0.2 ? COL.rojo : '#fff', 'right'); txt('/ ' + m.res, ax - 54, vy + 2, 12, 'rgba(255,255,255,.8)'); }
    if(Wp) txt(Wp.nom, W - 170, vy - 26, 10, COL.amarillo, 'right');
    if(a.recarga > 0){ const k = 1 - a.recarga/Wp.recarga; cajaHUD(cx - 50, cy + 36, 100, 8, 'rgba(0,0,0,.5)'); gH.fillStyle = COL.amarillo; gH.fillRect(cx - 49, cy + 37, 98*k, 6); }
    /* mira y daño */
    dibujarMira(a, cx, cy);
    for(const dn of HUD.danos){ const rel = angDif(a.yaw, dn.yaw), k = Math.min(1, dn.t/0.6); gH.save(); gH.translate(cx, cy); gH.rotate(-rel); gH.globalAlpha = k;
      gH.beginPath(); gH.arc(0, 0, 70, -Math.PI/2 - 0.35, -Math.PI/2 + 0.35); gH.lineWidth = 9; gH.strokeStyle = COL.tinta; gH.stroke(); gH.lineWidth = 5; gH.strokeStyle = COL.rojo; gH.stroke(); gH.restore(); }
    /* plantar / desactivar */
    const prog = a.plantando > 0 ? a.plantando/RONDA.plantar : a.desactivando > 0 ? a.desactivando/(a.kit ? RONDA.desactKit : RONDA.desact) : 0;
    if(prog > 0){ cajaHUD(cx - 90, cy + 56, 180, 22); gH.fillStyle = a.plantando > 0 ? COL.t : COL.ct; gH.fillRect(cx - 87, cy + 59, 174*prog, 16); txt(a.plantando > 0 ? 'PLANTANDO' : 'DESACTIVANDO', cx, cy + 67, 11, '#fff', 'center'); }
    if(a.inv[5] === 'c4' && sitioEn(a.c.pos) && a.plantando <= 0) txt('ESTÁS EN EL SITIO ' + sitioEn(a.c.pos) + ': SACÁ LA BOMBA (5) Y MANTENÉ FUEGO', cx, cy + 90, 10, COL.amarillo, 'center');
    if(BOMBA.estado === 'plantada' && a.bando === 'ct' && a.c.pos.distanceTo(BOMBA.pos) < 1.6 && a.desactivando <= 0) txt('MANTENÉ USAR PARA DESACTIVAR', cx, cy + 90, 11, COL.ct, 'center');
    if(BOMBA.estado === 'plantada'){ txt('💣 ' + Math.max(0, BOMBA.t).toFixed(1), cx, top + 46, 14, COL.rojo, 'center'); }
  } else {
    txt('ESTÁS MUERTO', cx, cy - 20, 26, COL.rojo, 'center'); if(HUD.muerteTxt) txt(HUD.muerteTxt, cx, cy + 14, 12, '#fff', 'center');
    if(PARTIDA.modo !== 'bomba') txt('REAPARECÉS EN ' + Math.max(0, a.reaparece || 0).toFixed(1), cx, cy + 36, 11, COL.amarillo, 'center');
  }
  if(PARTIDA.fase === 'congelado') txt('PREPARATE · ' + Math.ceil(PARTIDA.t), cx, cy - 60, 20, COL.amarillo, 'center');
}
/* ---------- avisos (la capa #aviso) ---------- */
let _avisoT = null;
function hudAviso(t, dur, clase){ const el = $('aviso'); if(!el) return; el.innerHTML = '<b class="' + (clase || '') + '">' + (window.tr ? tr(t) : t) + '</b>'; el.style.opacity = 1; clearTimeout(_avisoT); _avisoT = setTimeout(()=> el.style.opacity = 0, (dur || 2)*1000); }
window.alDanar = function(v, real, parte, W, atac, dir, pto){
  const j = PARTIDA.jugador; if(atac === j && v !== j){ HUD.marcaT = 0.3; HUD.marcaCab = parte === 'cabeza'; if(window.sonarUI) sonarUI(parte === 'cabeza' ? 'tiro_cabeza' : 'golpe'); }
  if(v === j){ POST.danio = Math.min(1, POST.danio + real/45); if(atac && atac !== j){ const dx = atac.c.pos.x - j.c.pos.x, dz = atac.c.pos.z - j.c.pos.z; HUD.danos.push({yaw:Math.atan2(-dx, -dz), t:1.2}); } }
};
window.alMatarHUD = function(v, atac, W, cabeza){ const j = PARTIDA.jugador;
  if(v === j) HUD.muerteTxt = atac && atac !== j ? 'TE MATÓ ' + atac.nombre + ' CON ' + (W && W.nom ? W.nom : (ARMAS[W && W.id] ? ARMAS[W.id].nom : '')) : '';
  if(atac === j && v !== j){ hudAviso(cabeza ? '¡A LA CABEZA!' : 'BAJA', 0.9, cabeza ? 'rojo' : ''); if(window.sonarUI) sonarUI(cabeza ? 'baja_cabeza' : 'baja'); } };
window.alFinRonda = function(ganador, motivo){ const j = PARTIDA.jugador, m = {bomba:'EXPLOTÓ LA BOMBA', desactivada:'BOMBA DESACTIVADA', tiempo:'SE ACABÓ EL TIEMPO', eliminacion:'EQUIPO ELIMINADO'}[motivo] || '';
  hudAviso((ganador === 'ct' ? 'GANAN LOS CT' : 'GANAN LOS T') + '<br><small>' + m + (PARTIDA.mvp ? ' · MVP ' + PARTIDA.mvp.nombre : '') + '</small>', 4, ganador); if(window.sonarUI) sonarUI(j && j.bando === ganador ? 'ronda_ganada' : 'ronda_perdida'); };
/* ---------- mandos táctiles ---------- */
const TACTIL = {stick:null, mira:null, fuego:null, fuegoI:null, activo:false, sens:1};
function giroPantalla(){ return matchMedia('(orientation: portrait)').matches ? 90 : 0; }
/* un dedo en coordenadas del juego (la pantalla puede estar girada por CSS) */
function aJuego(t){ const r = $('pantalla').getBoundingClientRect(), u = UI.u; if(giroPantalla() === 90) return {x:(t.clientY - r.top)/u, y:(r.right - t.clientX)/u}; return {x:(t.clientX - r.left)/u, y:(t.clientY - r.top)/u}; }
function mandosIniciar(){
  if(TACTIL.listo) return; TACTIL.listo = true; const zm = $('zonaMover'), zv = $('zonaMirar'), st = $('stick'), bola = st.querySelector('i');
  const mover = (id, p)=>{ const s = TACTIL.stick; if(!s || s.id !== id) return; let dx = p.x - s.x0, dy = p.y - s.y0; const L = Math.hypot(dx, dy), R = 52*stickEscala(); if(L > R){ dx *= R/L; dy *= R/L; }
    bola.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; ENT.adelante = -dy/R; ENT.lado = dx/R; ENT.caminar = L < R*0.45 && L > 6; st.classList.toggle('caminar', ENT.caminar); };
  const soltarStick = ()=>{ TACTIL.stick = null; ENT.adelante = ENT.lado = 0; ENT.caminar = false; st.classList.remove('activo'); bola.style.transform = ''; stickSuelta(st); };
  zm.addEventListener('touchstart', ev=>{ ev.preventDefault(); ENT.tactil = true; for(const t of ev.changedTouches){ if(TACTIL.stick) break; const p = aJuego(t); TACTIL.stick = stickEmpieza(t.identifier, p, st); st.classList.add('activo'); vibrarToque(); } }, {passive:false});
  const mirar = (id, p)=>{ const m = TACTIL.mira && TACTIL.mira.id === id ? TACTIL.mira : TACTIL.fuego && TACTIL.fuego.id === id ? TACTIL.fuego : TACTIL.fuegoI && TACTIL.fuegoI.id === id ? TACTIL.fuegoI : null; if(!m) return;
    const k = 0.0052*sensK()*(cam.fov/74); ENT.dYaw -= (p.x - m.x)*k; ENT.dPitch -= (p.y - m.y)*k; m.x = p.x; m.y = p.y; };
  zv.addEventListener('touchstart', ev=>{ ev.preventDefault(); ENT.tactil = true; for(const t of ev.changedTouches){ if(TACTIL.mira) break; const p = aJuego(t); TACTIL.mira = {id:t.identifier, x:p.x, y:p.y, t0:performance.now()}; } }, {passive:false});
  addEventListener('touchmove', ev=>{ for(const t of ev.changedTouches){ const p = aJuego(t); mover(t.identifier, p); mirar(t.identifier, p); } }, {passive:false});
  const fin = ev=>{ for(const t of ev.changedTouches){ if(TACTIL.stick && TACTIL.stick.id === t.identifier) soltarStick(); if(TACTIL.mira && TACTIL.mira.id === t.identifier) TACTIL.mira = null;
      if(TACTIL.fuego && TACTIL.fuego.id === t.identifier){ TACTIL.fuego = null; if(!TACTIL.fuegoI) ENT.disparo = false; $('bDisparo').classList.remove('apretado'); }
      if(TACTIL.fuegoI && TACTIL.fuegoI.id === t.identifier){ TACTIL.fuegoI = null; if(!TACTIL.fuego) ENT.disparo = false; $('bDisparoI').classList.remove('apretado'); } } };
  addEventListener('touchend', fin); addEventListener('touchcancel', fin);
  /* fuego: mantener dispara y arrastrar sobre el botón también mira */
  for(const [id, k] of [['bDisparo', 'fuego'], ['bDisparoI', 'fuegoI']]){ $(id).addEventListener('touchstart', ev=>{ ev.preventDefault(); ev.stopPropagation(); ENT.tactil = true; const t = ev.changedTouches[0], p = aJuego(t); TACTIL[k] = {id:t.identifier, x:p.x, y:p.y}; ENT.disparo = true; $(id).classList.add('apretado'); vibrarToque(); }, {passive:false}); }
  const pulso = (id, fn, mantener)=>{ const el = $(id); el.addEventListener('touchstart', ev=>{ ev.preventDefault(); ev.stopPropagation(); ENT.tactil = true; el.classList.add('apretado'); fn(true); vibrarToque(); if(window.sonarUI) sonarUI('ui_toque'); }, {passive:false});
    el.addEventListener('touchend', ev=>{ ev.preventDefault(); el.classList.remove('apretado'); if(mantener) fn(false); }, {passive:false}); el.addEventListener('click', ()=>{ fn(true); if(mantener) setTimeout(()=> fn(false), 120); }); };
  pulso('bSalto', v=>{ ENT.saltar = v; }, true);
  pulso('bAgachar', v=>{ if(v){ TACTIL.agachado = !TACTIL.agachado; ENT.agachar = TACTIL.agachado; $('bAgachar').classList.toggle('fijo', TACTIL.agachado); } });
  pulso('bRecargar', v=>{ if(v) ENT.recargar = true; });
  pulso('bMira', v=>{ if(v) ENT.mira = true; });
  pulso('bUsar', v=>{ ENT.usar = v; }, true);
  pulso('bGranada', v=>{ if(v){ const a = PARTIDA.jugador; if(!a) return; const gs = a.inv[4]; if(!gs.length) return; const i = gs.indexOf(a.actual); equipar(a, gs[(i + 1) % gs.length]); } });
  pulso('bCompra', v=>{ if(v) abrirCompra(); });
  pulso('bMarcador', v=>{ if(v) alternarMarcador(); });
  pulso('bPausa', v=>{ if(v && window.pausar) pausar(); });
  aplicarMandos(); addEventListener('resize', ()=> setTimeout(aplicarMandos, 80));
}
/* botones que aparecen según lo que pasa */
function controlesVisibles(a){
  const m = $('mandos'); if(!m) return; const Wp = ARMAS[a.actual];
  $('bMira').classList.toggle('oculto', !(a.vivo && Wp && Wp.mira));
  const cercaBomba = BOMBA.estado === 'plantada' && a.bando === 'ct' && a.c.pos.distanceTo(BOMBA.pos) < 1.6, cercaArma = SUELTAS.some(s=> s.pos.distanceTo(a.c.pos) < 1.6);
  $('bUsar').classList.toggle('oculto', !(a.vivo && (cercaBomba || cercaArma))); $('usarTxt').textContent = cercaBomba ? 'DESACTIVAR' : 'LEVANTAR';
  $('bCompra').classList.toggle('oculto', !(a.vivo && PARTIDA.modo === 'bomba' && PARTIDA.compraT > 0 && enZonaCompra(a)));
  $('bGranada').classList.toggle('oculto', !(a.vivo && a.inv[4].length));
  /* ranuras de armas */
  const R = $('ranuras'), ids = [a.inv[1], a.inv[2], 'cuchillo', a.inv[5]].filter(Boolean), clave = ids.join(',') + '|' + a.actual;
  if(R.dataset.k !== clave){ R.dataset.k = clave; R.innerHTML = ''; for(const id of ids){ const el = document.createElement('div'); el.className = 'rn' + (id === a.actual ? ' ya' : ''); el.textContent = ARMAS[id].nom.split(' ')[0]; el.style.cssText = 'font:italic 900 10px Arial Black,Roboto;color:#fff;letter-spacing:1px';
    const toque = ev=>{ ev.preventDefault(); ev.stopPropagation(); equipar(a, id); }; el.addEventListener('touchstart', toque, {passive:false}); el.addEventListener('click', toque); R.appendChild(el); } }
}
/* ---------- compra ---------- */
const MENU_COMPRA = [
  {cat:'PISTOLAS', items:['glock', 'usps', 'deagle']}, {cat:'SUBFUSILES', items:['mac10', 'mp9']}, {cat:'RIFLES', items:['ak47', 'm4s', 'awp']},
  {cat:'EQUIPO', items:['kevlar', 'casco', 'kit']}, {cat:'GRANADAS', items:['he', 'flash', 'humo']}];
function abrirCompra(){ const a = PARTIDA.jugador; if(!a || !puedeComprar(a)){ hudAviso('NO PODÉS COMPRAR ACÁ', 1.2); return; }
  const cp = $('capaCompra'); if(!cp) return; HUD.compraAbierta = true; cp.classList.add('ver'); cp.style.display = 'flex'; armarCompra(); if(document.exitPointerLock) document.exitPointerLock(); }
function cerrarCompra(){ const cp = $('capaCompra'); if(cp){ cp.classList.remove('ver'); cp.style.display = ''; } HUD.compraAbierta = false; }
function armarCompra(){
  const a = PARTIDA.jugador, gr = $('compraGrid'); gr.innerHTML = ''; $('compraDinero').textContent = '$' + a.dinero; $('compraTiempo').textContent = PARTIDA.modo === 'bomba' ? reloj(PARTIDA.compraT) : '';
  for(const c of MENU_COMPRA){ const col = document.createElement('div'); col.className = 'cat'; col.innerHTML = '<h3>' + (window.tr ? tr(c.cat) : c.cat) + '</h3>';
    for(const id of c.items){ const W = ARMAS[id], E = EQUIPO[id], nom = W ? W.nom : E.nom, precio = precioDe(a, id), bando = W && W.equipo && W.equipo !== 'ambos' ? W.equipo : id === 'kit' ? 'ct' : null;
      if(bando && PARTIDA.modo === 'bomba' && bando !== a.bando) continue;
      const tengo = W ? (W.ranura === 4 ? a.inv[4].includes(id) : a.inv[W.ranura] === id) : (id === 'kevlar' ? a.blindaje >= 100 : id === 'casco' ? a.casco : a.kit);
      const el = document.createElement('div'); el.className = 'item' + (a.dinero < precio && PARTIDA.modo === 'bomba' ? ' no' : '') + (tengo ? ' tengo' : '');
      el.innerHTML = '<b style="font:italic 900 11px Arial Black,Roboto;color:#fff">' + nom + '</b><span>$' + precio + '</span>';
      const toque = ev=>{ ev.preventDefault(); const r = comprar(a, id); if(r === 'ok'){ if(window.sonarUI) sonarUI('dinero'); armarCompra(); } else { if(window.sonarUI) sonarUI('ui_no'); hudAviso({plata:'NO TE ALCANZA', tiene:'YA LO TENÉS', lleno:'NO ENTRA MÁS', fuera:'FUERA DE LA ZONA DE COMPRA', bando:'NO ES DE TU EQUIPO'}[r] || 'NO', 1); } };
      el.addEventListener('click', toque); col.appendChild(el); }
    gr.appendChild(col); }
}
/* ---------- marcador ---------- */
function alternarMarcador(v){ HUD.marcador = v === undefined ? !HUD.marcador : v; const m = $('marcador'); if(!m) return; m.classList.toggle('ver', HUD.marcador); if(HUD.marcador) armarMarcador(); }
function armarMarcador(){ const m = $('marcador'), j = PARTIDA.jugador; let h = '<table><tr><th></th><th>JUGADOR</th><th>B</th><th>M</th><th>A</th><th>MVP</th>' + (PARTIDA.modo === 'bomba' ? '<th>$</th>' : '') + '</tr>';
  const filas = (lista, color)=>{ for(const a of lista.sort((x, y)=> y.bajas - x.bajas)){ h += '<tr style="color:' + color + ';' + (a === j ? 'background:rgba(255,210,63,.18)' : '') + (a.vivo ? '' : ';opacity:.55') + '"><td>' + (a.vivo ? '●' : '✕') + '</td><td>' + a.nombre + '</td><td>' + a.bajas + '</td><td>' + a.muertes + '</td><td>' + a.asist + '</td><td>' + (a.mvp ? '★' + a.mvp : '') + '</td>' + (PARTIDA.modo === 'bomba' ? '<td>' + (a.bando === j.bando ? '$' + a.dinero : '') + '</td>' : '') + '</tr>'; } };
  if(PARTIDA.modo === 'bomba'){ filas(ACTORES.filter(a=> a.bando === 'ct'), COL.ct); filas(ACTORES.filter(a=> a.bando === 't'), COL.t); } else filas(ACTORES.slice(), '#fff');
  m.innerHTML = '<div class="panel">' + h + '</table></div>'; }
