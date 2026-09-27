
/* ====================== combate ======================
   Combatientes (jugador y bots comparten todo), inventario y munición, disparo estilo CS (imprecisión por estado + la
   acumulada por tiro, patrón de retroceso por bala, el golpe de vista que sube la mira a la mitad del patrón), balas que
   atraviesan paredes según grosor y material, daño por zona con blindaje y casco, caída del daño con la distancia, cuchillo,
   granadas con rebote (HE, cegadora, humo que tapa la vista) y la bomba. Los efectos van al final (trazadoras, chispas,
   agujeros, sangre, explosiones, humo), todos con pozo fijo para no crear objetos por cuadro. */
const ACTORES = [];
let SIG_ACTOR = 1;
function actorNuevo(nombre, bando, esJugador){
  const a = {id:SIG_ACTOR++, nombre, bando, esJugador:!!esJugador, bot:null, c:cuerpoNuevo(), yaw:0, pitch:0, vida:100, blindaje:0, casco:false, kit:false, dinero:ECO.inicio,
    inv:{1:null, 2:null, 3:'cuchillo', 4:[], 5:null}, actual:'cuchillo', previo:null, mun:{}, vivo:true, bajas:0, muertes:0, asist:0, mvp:0, puntos:0, danoA:{},
    sp:0, inex:0, cad:0, ultTiro:-9, recarga:0, saca:0, plantando:0, desactivando:0, cegado:0, cegadoMax:0, punch:{x:0, y:0, vx:0, vy:0}, pers:null, mira:0, t:0, nivel:0, racha:0, golpeT:-9};
  ACTORES.push(a); return a;
}
function quitarActor(a){ const i = ACTORES.indexOf(a); if(i >= 0) ACTORES.splice(i, 1); if(a.pers && typeof soltarPersonaje === 'function'){ soltarPersonaje(a.pers); a.pers = null; } else if(a.pers && a.pers.g && a.pers.g.parent) a.pers.g.parent.remove(a.pers.g); }
function ojoDe(a, out){ const ag = a.c.agachado || 0; return (out || V3()).set(a.c.pos.x, a.c.pos.y + lerp(MOV.ojo, MOV.ojoAg, ag), a.c.pos.z); }
function dirDe(yaw, pitch, out){ const cp = Math.cos(pitch); return (out || V3()).set(-Math.sin(yaw)*cp, Math.sin(pitch), -Math.cos(yaw)*cp); }
/* ---------- inventario ---------- */
function darArma(a, id, sinSoltar){
  const W = ARMAS[id]; if(!W) return; const r = W.ranura;
  if(r === 4){ const n = a.inv[4].filter(g=> g === id).length; if(a.inv[4].length >= 4 || (id !== 'flash' && n >= 1) || n >= 2) return false; a.inv[4].push(id); return true; }
  if(r === 5){ a.inv[5] = 'c4'; return true; }
  if(a.inv[r] && !sinSoltar && a.inv[r] !== id) soltarArma(a, r);
  a.inv[r] = id; if(W.carg) a.mun[id] = {carg:W.carg, res:W.res}; return true;
}
function equipar(a, id){
  if(!id || a.actual === id && a.saca <= 0) return; const W = ARMAS[id]; if(!W) return;
  a.previo = a.actual; a.actual = id; a.saca = W.sacar || 0.8; a.recarga = 0; a.sp = 0; a.inex = 0; a.mira = 0; a.plantando = 0; a.prepGranada = 0;
  if(a.esJugador && window.vmSacar){ vmSacar(id); if(window.sonarVM) sonarVM('desenfundar'); }
}
function ranuraArma(a, r){ if(r === 4) return a.inv[4][0] || null; return a.inv[r] || null; }
function mejorArma(a){ return a.inv[1] || a.inv[2] || 'cuchillo'; }
/* armas en el piso: se levantan pasando por arriba (si la ranura está vacía) o con USAR */
const SUELTAS = [];
function soltarArma(a, r, vel){
  const id = r === 4 ? null : a.inv[r]; if(!id || id === 'cuchillo') return; const W = ARMAS[id];
  const o = ojoDe(a), d = dirDe(a.yaw, a.pitch); const s = {id, mun:a.mun[id] ? {...a.mun[id]} : null, pos:o.clone().addScaledVector(d, 0.5), vel:(vel || d.clone().multiplyScalar(3.2)).add(V3(0, 1.2, 0)), t:0, quieto:false, g:null, giro:Math.random()*TAU};
  a.inv[r] = null; delete a.mun[id]; if(a.actual === id) equipar(a, mejorArma(a));
  if(r === 5) s.esBomba = true;
  if((typeof FABRICA !== 'undefined' && FABRICA)){ const f = FABRICA3[id === 'cuchillo' ? 'cuchillo' : id]; if(f){ const A = f(); s.g = A.g; A.g.traverse(m=>{ if(m.isMesh){ m.castShadow = true; } }); escena.add(s.g); } }
  SUELTAS.push(s); return s;
}
function pasarSueltas(dt){
  for(let i=SUELTAS.length-1;i>=0;i--){ const s = SUELTAS[i]; s.t += dt;
    if(!s.quieto){ s.vel.y -= 20*dt; const dx = s.vel.x*dt, dy = s.vel.y*dt, dz = s.vel.z*dt, L = Math.hypot(dx, dy, dz);
      if(L > 1e-6){ const t = rayo(s.pos.x, s.pos.y, s.pos.z, dx/L, dy/L, dz/L, L + 0.04, F_SOLIDA, false, -1);
        if(t >= 0){ s.pos.addScaledVector(V3(dx/L, dy/L, dz/L), Math.max(0, t - 0.04)); const n = V3(RAYO.nx, RAYO.ny, RAYO.nz), vn = s.vel.dot(n); s.vel.addScaledVector(n, -1.4*vn).multiplyScalar(0.45);
          if(RAYO.ny > 0.5 && s.vel.length() < 0.6){ s.quieto = true; s.pos.y += 0.02; } }
        else s.pos.set(s.pos.x + dx, s.pos.y + dy, s.pos.z + dz); }
      if(s.pos.y < -60) { if(s.g) escena.remove(s.g); SUELTAS.splice(i, 1); continue; } }
    if(s.g){ s.g.position.copy(s.pos); s.g.rotation.set(0, s.giro, s.quieto ? Math.PI/2 : s.t*9); }
    if(s.t > 90 && !s.esBomba){ if(s.g) escena.remove(s.g); SUELTAS.splice(i, 1); } }
}
function levantar(a, s){
  const W = ARMAS[s.id]; if(!W) return false;
  if(s.esBomba){ if(a.bando !== 't') return false; a.inv[5] = 'c4'; }
  else { if(W.ranura === 4) return false; if(a.inv[W.ranura] && a.inv[W.ranura] !== s.id) return false; a.inv[W.ranura] = s.id; a.mun[s.id] = s.mun || {carg:W.carg, res:W.res}; }
  if(s.g) escena.remove(s.g); SUELTAS.splice(SUELTAS.indexOf(s), 1); if(window.sonar3D) sonar3D('ui_tomar', a.c.pos, 0.6); return true;
}
/* ---------- precisión ---------- */
function velH(a){ return Math.hypot(a.c.vel.x, a.c.vel.z); }
function inexactitud(a){
  const W = ARMAS[a.actual]; if(!W || !W.impr) return 0; const I = W.impr, v = velH(a), vmax = W.vel || 250*U;
  let base;
  if(!a.c.enSuelo) base = I.aire;
  else { const f = v/vmax, mov = f < 0.34 ? lerp(0, I.caminando, f/0.34) : lerp(I.caminando, I.corriendo, lim((f - 0.34)/0.66, 0, 1));
    base = (a.c.agachado > 0.5 ? I.agachado : I.quieto) + mov; }
  if(W.mira && a.mira){ base = I.mira + (v/vmax)*I.miraMov*1.5 + (!a.c.enSuelo ? I.aire : 0); }
  return (base + a.inex)*GRAD;
}
/* ---------- disparo ---------- */
const _o1 = V3(), _d1 = V3(), _d2 = V3();
function puedeDisparar(a){ const W = ARMAS[a.actual]; return a.vivo && W && W.ciclo && a.cad <= 0 && a.saca <= 0 && a.recarga <= 0 && (!a.prepGranada) && a.plantando <= 0; }
function disparar(a, rnd){
  const W = ARMAS[a.actual]; if(!puedeDisparar(a)) return null; const m = a.mun[a.actual]; const r = rnd || Math.random;
  if(!m || m.carg <= 0){ a.cad = 0.25; if(window.sonar3D) sonar3D('gatillo_seco', a.c.pos, 0.6); if(m && m.res > 0) empezarRecarga(a); return null; }
  m.carg--; a.cad = W.ciclo; a.ultTiro = a.t;
  /* patrón: la bala va con el patrón entero; la vista sube la mitad (el golpe de vista) */
  const pat = W.patron ? W.patron[Math.min(W.patron.length - 1, Math.floor(a.sp))] : [0, 0], pat0 = W.patron && a.sp >= 1 ? W.patron[Math.min(W.patron.length - 1, Math.floor(a.sp) - 1)] : [0, 0];
  const inex = inexactitud(a);
  const yaw = a.yaw - pat[0]*GRAD, pitch = a.pitch + pat[1]*GRAD;
  const ang = r()*TAU, rad = inex*Math.sqrt(r()) + (W.clase === 'francotirador' && !a.mira ? inex*0.2 : 0);
  dirDe(yaw + Math.cos(ang)*rad, pitch + Math.sin(ang)*rad, _d1);
  const kick = (W.patada || 0.5)*(a.esJugador ? 1 : 0.6);
  a.punch.vy += (pat[1] - pat0[1])*GRAD*kick*9; a.punch.vx -= (pat[0] - pat0[0])*GRAD*kick*9;
  if(W.clase === 'francotirador'){ a.punch.vy += 0.03; a.mira = 0; }
  a.sp += 1; a.inex = Math.min(a.inex + (W.impr ? W.impr.tiro : 0.1), 6);
  ojoDe(a, _o1); const res = trazarBala(a, _o1, _d1, W);
  if(window.sonar3D){ const lejos = a.esJugador ? 0 : 1; sonar3D('disparo_' + a.actual, _o1, 1, {arma:a.actual, lejos}); }
  efectoDisparo(a, _o1, _d1, res);
  if(a.esJugador){ if(window.vmClip) vmClip('disparo', {dur:W.clase === 'francotirador' ? 1.46 : Math.min(0.22, W.ciclo*1.8)}); if(window.vmRetroceso) vmRetroceso(W.clase === 'pistola' ? 0.8 : W.clase === 'francotirador' ? 1.8 : 0.6); if(window.vmFogonazo) vmFogonazo(); }
  if(m.carg === 0 && a.esJugador && (typeof VMA !== 'undefined' && VMA) && W.clase === 'pistola') VMA.vacio = true;
  if(window.alDisparar) alDisparar(a, W);
  return res;
}
/* la bala: paredes con grosor × material, cuerpos (sigue y pierde), hasta 4 paredes o que no le quede fuerza */
const MAX_BALA = 180;
function trazarBala(a, o, d, W){
  const paredes = rayoTodas(o.x, o.y, o.z, d.x, d.y, d.z, MAX_BALA, F_BALA), cuerpos = rayoActores(o, d, MAX_BALA, a);
  const ev = []; for(const p of paredes) ev.push({t:p.t0, tipo:'p', p}); for(const c of cuerpos) ev.push({t:c.t, tipo:'c', c}); ev.sort((x, y)=> x.t - y.t);
  let fuerza = 1, dano = W.dmg, pen = W.pen || 1, paredesN = 0, primero = null; const golpes = [], impactos = [];
  let tOcupado = -1;
  for(const e of ev){ if(fuerza <= 0.05) break;
    if(e.tipo === 'p'){ const p = e.p; if(p.t1 <= tOcupado) continue; const t0 = Math.max(p.t0, tOcupado), grosor = Math.max(0.01, p.t1 - t0); tOcupado = Math.max(tOcupado, p.t1);
      const pt = V3(o.x + d.x*t0, o.y + d.y*t0, o.z + d.z*t0), n = normalCaja(p.caja, pt, d);
      impactos.push({pos:pt, n, caja:p.caja, mat:MUNDO.mat[p.caja], t:t0});
      if(!primero) primero = {pos:pt, t:t0, pared:true};
      const resist = MUNDO.pen[p.caja] || 1, costo = grosor*resist/(0.1*pen);
      paredesN++; if(costo >= 1 || paredesN > 4){ fuerza = 0; break; }
      fuerza *= (1 - costo)*0.85; dano *= (1 - costo*0.6)*0.85;
      const salida = V3(o.x + d.x*p.t1, o.y + d.y*p.t1, o.z + d.z*p.t1); impactos.push({pos:salida, n:n.clone().negate(), caja:p.caja, mat:MUNDO.mat[p.caja], t:p.t1, salida:true}); }
    else { const c = e.c; if(!c.actor.vivo) continue; if(!primero) primero = {pos:V3(o.x + d.x*c.t, o.y + d.y*c.t, o.z + d.z*c.t), t:c.t, actor:c.actor};
      const dist = c.t/U, dd = dano*Math.pow(W.rango || 0.9, dist/500);
      golpes.push({actor:c.actor, parte:c.parte, dano:dd, t:c.t, pos:V3(o.x + d.x*c.t, o.y + d.y*c.t, o.z + d.z*c.t)});
      fuerza *= 0.72; dano *= 0.72; } }
  for(const g of golpes){ if(!g.actor.vivo) continue; danar(g.actor, g.dano, g.parte, W, a, d, g.pos); }
  return {golpes, impactos, primero};
}
/* normal de la cara de la caja por donde entró el rayo */
function normalCaja(i, p, d){ const j = i*3, mn = MUNDO.mn, mx = MUNDO.mx; let mejor = 1e9, n = V3(0, 1, 0);
  const cand = [[Math.abs(p.x - mn[j]), -1, 0, 0], [Math.abs(p.x - mx[j]), 1, 0, 0], [Math.abs(p.y - mn[j+1]), 0, -1, 0], [Math.abs(p.y - mx[j+1]), 0, 1, 0], [Math.abs(p.z - mn[j+2]), 0, 0, -1], [Math.abs(p.z - mx[j+2]), 0, 0, 1]];
  for(const c of cand){ if(c[0] < mejor && (c[1]*d.x + c[2]*d.y + c[3]*d.z) < 0){ mejor = c[0]; n.set(c[1], c[2], c[3]); } } return n; }
/* ---------- cuerpos: cápsulas (las del personaje si está, si no un respaldo con la forma de un cuerpo) ---------- */
function rayoCapsula(ox, oy, oz, dx, dy, dz, a, b, r){
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z, oax = ox - a.x, oay = oy - a.y, oaz = oz - a.z;
  const baba = bax*bax + bay*bay + baz*baz, bard = bax*dx + bay*dy + baz*dz, baoa = bax*oax + bay*oay + baz*oaz, rdoa = dx*oax + dy*oay + dz*oaz, oaoa = oax*oax + oay*oay + oaz*oaz;
  const A = baba - bard*bard, B = baba*rdoa - baoa*bard, C = baba*oaoa - baoa*baoa - r*r*baba, h = B*B - A*C;
  if(h >= 0 && A > 1e-9){ const t = (-B - Math.sqrt(h))/A, y = baoa + t*bard; if(y > 0 && y < baba && t > 0) return t; }
  /* tapas */ let mejor = -1;
  for(const [px, py, pz] of [[a.x, a.y, a.z], [b.x, b.y, b.z]]){ const ocx = ox - px, ocy = oy - py, ocz = oz - pz, bb = ocx*dx + ocy*dy + ocz*dz, cc = ocx*ocx + ocy*ocy + ocz*ocz - r*r, hh = bb*bb - cc;
    if(hh > 0){ const t = -bb - Math.sqrt(hh); if(t > 0 && (mejor < 0 || t < mejor)) mejor = t; } }
  return mejor; }
const _ha = V3(), _hb = V3();
function capsulasRespaldo(a){ const p = a.c.pos, ag = a.c.agachado || 0, k = lerp(1, MOV.altoAg/MOV.alto, ag), yaw = a.yaw, fx = -Math.sin(yaw)*0.05, fz = -Math.cos(yaw)*0.05;
  const Y = h=> p.y + h*k; return [
    {parte:'cabeza', a:V3(p.x + fx, Y(1.66), p.z + fz), b:V3(p.x + fx, Y(1.76), p.z + fz), r:0.115},
    {parte:'pecho', a:V3(p.x, Y(1.2), p.z), b:V3(p.x, Y(1.48), p.z), r:0.19},
    {parte:'estomago', a:V3(p.x, Y(0.92), p.z), b:V3(p.x, Y(1.15), p.z), r:0.17},
    {parte:'brazo', a:V3(p.x + Math.cos(yaw)*0.24, Y(1.0), p.z - Math.sin(yaw)*0.24), b:V3(p.x + Math.cos(yaw)*0.24, Y(1.42), p.z - Math.sin(yaw)*0.24), r:0.07},
    {parte:'brazo', a:V3(p.x - Math.cos(yaw)*0.24, Y(1.0), p.z + Math.sin(yaw)*0.24), b:V3(p.x - Math.cos(yaw)*0.24, Y(1.42), p.z + Math.sin(yaw)*0.24), r:0.07},
    {parte:'pierna', a:V3(p.x + Math.cos(yaw)*0.1, Y(0.1), p.z - Math.sin(yaw)*0.1), b:V3(p.x + Math.cos(yaw)*0.1, Y(0.85), p.z - Math.sin(yaw)*0.1), r:0.11},
    {parte:'pierna', a:V3(p.x - Math.cos(yaw)*0.1, Y(0.1), p.z + Math.sin(yaw)*0.1), b:V3(p.x - Math.cos(yaw)*0.1, Y(0.85), p.z + Math.sin(yaw)*0.1), r:0.11}]; }
function capsulasDe(a){ if(a.pers && window.personajeHitboxes) return personajeHitboxes(a.pers); return capsulasRespaldo(a); }
function rayoActores(o, d, tMax, ignorar){ const out = [];
  for(const a of ACTORES){ if(!a.vivo || a === ignorar) continue; const p = a.c.pos, dx = p.x - o.x, dz = p.z - o.z, proy = dx*d.x + dz*d.z;
    if(proy < -1 || proy > tMax + 1) continue; const lat2 = dx*dx + dz*dz - proy*proy; if(lat2 > 1.2) continue;
    let mejor = -1, parte = null; for(const c of capsulasDe(a)){ const t = rayoCapsula(o.x, o.y, o.z, d.x, d.y, d.z, c.a, c.b, c.r); if(t > 0 && t < tMax && (mejor < 0 || t < mejor)){ mejor = t; parte = c.parte; } }
    if(mejor > 0) out.push({t:mejor, actor:a, parte}); }
  return out; }
/* ---------- daño ---------- */
function danar(v, dmg, parte, W, atac, dir, pto){
  if(!v.vivo) return 0; if(window.puedeDanar && !puedeDanar(atac, v)) return 0;
  let d = dmg*(MULT_ZONA[parte] || 1); const ap = W && W.ap !== undefined ? W.ap : 1;
  const conBl = v.blindaje > 0 && (parte !== 'cabeza' || v.casco) && parte !== 'pierna';
  if(conBl){ let dv = d*ap, db = (d - dv)*0.5; if(db > v.blindaje){ dv += (db - v.blindaje)*2; db = v.blindaje; } v.blindaje = Math.max(0, v.blindaje - db); d = dv; }
  d = Math.max(1, Math.round(d)); const antes = v.vida; v.vida = Math.max(0, v.vida - d); const real = antes - v.vida; v.golpeT = v.t; v.ultimoAtac = atac;
  if(atac && atac !== v){ atac.danoA[v.id] = (atac.danoA[v.id] || 0) + real; }
  if(v.c && dir && W && W.clase !== 'granada'){ /* lo frena (tagging) */ v.c.vel.x *= 0.45; v.c.vel.z *= 0.45; }
  if(window.alDanar) alDanar(v, real, parte, W, atac, dir, pto);
  efectoSangre(pto || ojoDe(v), dir, parte === 'cabeza');
  if(parte === 'cabeza' && window.sonar3D) sonar3D(v.casco && v.blindaje > 0 ? 'casco_tiro' : 'tiro_cabeza', pto || v.c.pos, 1);
  if(v.vida <= 0) matar(v, atac, W, parte === 'cabeza', dir, pto);
  return real;
}
function matar(v, atac, W, cabeza, dir, pto){
  if(!v.vivo) return; v.vivo = false; v.muertes++; v.vida = 0; v.plantando = 0; v.desactivando = 0;
  if(atac && atac !== v){ if(!window.esAliado || !esAliado(atac, v)) atac.bajas++; else atac.bajas--; }
  /* asistencias: más de 40 de daño */
  for(const o of ACTORES) if(o !== atac && o !== v && (o.danoA[v.id] || 0) >= 40) o.asist++;
  for(const o of ACTORES) delete o.danoA[v.id];
  if(v.inv[5]) soltarArma(v, 5, V3(0, 1, 0));
  if(v.inv[1]) soltarArma(v, 1); else if(v.inv[2]) soltarArma(v, 2);
  if(v.pers && window.personajeMorir) personajeMorir(v.pers, (dir || V3(0, 0, 0)).clone().multiplyScalar(W && W.clase === 'francotirador' ? 6 : 3.5), pto || ojoDe(v));
  if(window.alMatar) alMatar(v, atac, W, cabeza);
}
/* ---------- recarga ---------- */
function empezarRecarga(a){ const W = ARMAS[a.actual], m = a.mun[a.actual]; if(!W || !m || !W.carg || m.carg >= W.carg || m.res <= 0 || a.recarga > 0 || a.saca > 0) return false;
  a.recarga = W.recarga; a.mira = 0; a.sp = 0; if(a.esJugador && window.vmClip) vmClip(m.carg === 0 ? 'recargaVacia' : 'recarga', {dur:W.recarga}); return true; }
function terminarRecarga(a){ const W = ARMAS[a.actual], m = a.mun[a.actual]; if(!W || !m) return; const falta = W.carg - m.carg, pone = Math.min(falta, m.res); m.carg += pone; m.res -= pone; if(a.esJugador && (typeof VMA !== 'undefined' && VMA)) VMA.vacio = false; }
/* ---------- un cuadro de un combatiente (tiempos) ---------- */
function pasarActor(a, dt){
  a.t += dt; if(a.cad > 0) a.cad -= dt; if(a.saca > 0) a.saca -= dt;
  if(a.golpePend){ a.golpePend.t -= dt; if(a.golpePend.t <= 0){ const f = a.golpePend.fn; a.golpePend = null; f(); } }
  if(a.cambioPend){ a.cambioPend.t -= dt; if(a.cambioPend.t <= 0){ const id = a.cambioPend.id; a.cambioPend = null; if(a.vivo) equipar(a, id); } }
  if(a.recarga > 0){ a.recarga -= dt; if(a.recarga <= 0) terminarRecarga(a); }
  const W = ARMAS[a.actual];
  if(W && W.impr && a.t - a.ultTiro > (W.ciclo || 0.1)*1.1){ a.inex = Math.max(0, a.inex - dt*(W.impr.tiro*2 + 1.2)/Math.max(0.1, W.impr.recup)*0.6); a.sp = Math.max(0, a.sp - dt*(W.patron ? W.patron.length : 10)/0.55); }
  /* golpe de vista: resorte hacia cero */
  const P = a.punch; P.vx += (-P.x*60 - P.vx*12)*dt; P.vy += (-P.y*60 - P.vy*12)*dt; P.x += P.vx*dt; P.y += P.vy*dt;
  if(a.cegado > 0) a.cegado = Math.max(0, a.cegado - dt);
}
/* ---------- cuchillo ---------- */
function cuchillazo(a, fuerte){
  if(a.cad > 0 || a.saca > 0) return; a.cad = fuerte ? 1.0 : (a.t - (a.ultCuchi || -9) < 0.8 ? 0.5 : 0.4); a.ultCuchi = a.t;
  if(a.esJugador && window.vmClip) vmClip(fuerte ? 'ataque2' : 'ataque1');
  const o = ojoDe(a), alcance = fuerte ? 1.25 : 1.6; let mejor = null;
  for(const dy of [0, -0.12, 0.12]) for(const dyaw of [0, -0.18, 0.18]){ const d = dirDe(a.yaw + dyaw, a.pitch + dy); const cs = rayoActores(o, d, alcance, a); for(const c of cs){ const t = rayo(o.x, o.y, o.z, d.x, d.y, d.z, c.t, F_BALA, true, -1); if(t >= 0) continue; if(!mejor || c.t < mejor.t) mejor = {...c, d}; } }
  a.golpePend = {t:fuerte ? 0.36 : 0.14, fn:()=>{ if(!a.vivo) return;
    if(mejor && mejor.actor.vivo){ const v = mejor.actor, deEspaldas = Math.cos(v.yaw - a.yaw) > 0.5, dmg = fuerte ? (deEspaldas ? 180 : 65) : (deEspaldas ? 90 : (a.t - (a.ultCuchi2 || -9) < 1 ? 25 : 40)); a.ultCuchi2 = a.t;
      danar(v, dmg, 'pecho', {ap:0.85, clase:'cuchillo'}, a, mejor.d, V3().copy(o).addScaledVector(mejor.d, mejor.t)); if(window.sonar3D) sonar3D('cuchillo_carne', v.c.pos, 1); }
    else { const d = dirDe(a.yaw, a.pitch), t = rayo(o.x, o.y, o.z, d.x, d.y, d.z, alcance, F_BALA, false, -1); if(t >= 0){ const p = V3().copy(o).addScaledVector(d, t); efectoImpacto(p, V3(RAYO.nx, RAYO.ny, RAYO.nz), MUNDO.mat[RAYO.caja], true); if(window.sonar3D) sonar3D('cuchillo_pared', p, 0.8); } } }};
}
/* ---------- granadas ---------- */
const GRANADAS = [];
function lanzarGranada(a, tipo, bajo){
  const i = a.inv[4].indexOf(tipo); if(i < 0) return null; a.inv[4].splice(i, 1);
  const o = ojoDe(a), d = dirDe(a.yaw, a.pitch + (bajo ? -0.15 : 0.12)), v0 = bajo ? 7.5 : 19.5;
  const g = {tipo, dueno:a, pos:o.clone().addScaledVector(d, 0.3).add(V3(0, -0.12, 0)), vel:d.multiplyScalar(v0).add(V3(a.c.vel.x*1.1, a.c.vel.y*0.5, a.c.vel.z*1.1)), t:0, quieta:0, malla:null, rebotes:0};
  if((typeof FABRICA !== 'undefined' && FABRICA)){ const A = FABRICA3[tipo](); g.malla = A.g; A.g.traverse(m=>{ if(m.isMesh) m.castShadow = true; }); escena.add(g.malla); }
  GRANADAS.push(g); if(window.sonar3D) sonar3D('granada_lanzar', o, 0.7);
  if(window.alGranada) alGranada(a, tipo, g);
  return g;
}
function pasarGranadas(dt){
  for(let i=GRANADAS.length-1;i>=0;i--){ const g = GRANADAS[i]; g.t += dt;
    const pasos = 3, h = dt/pasos;
    for(let s=0;s<pasos && !g.fin;s++){ g.vel.y -= 20*h; const dx = g.vel.x*h, dy = g.vel.y*h, dz = g.vel.z*h, L = Math.hypot(dx, dy, dz); if(L < 1e-7) continue;
      const t = rayo(g.pos.x, g.pos.y, g.pos.z, dx/L, dy/L, dz/L, L + 0.05, F_SOLIDA | F_BALA, false, -1);
      if(t >= 0){ g.pos.x += dx/L*Math.max(0, t - 0.05); g.pos.y += dy/L*Math.max(0, t - 0.05); g.pos.z += dz/L*Math.max(0, t - 0.05);
        const n = V3(RAYO.nx, RAYO.ny, RAYO.nz), vn = g.vel.dot(n); g.vel.addScaledVector(n, -1.45*vn); g.vel.multiplyScalar(RAYO.ny > 0.5 ? 0.55 : 0.62);
        if(Math.abs(vn) > 1.5 && window.sonar3D) sonar3D('granada_rebote', g.pos, lim(Math.abs(vn)/10, 0.15, 0.8)); g.rebotes++;
        if(RAYO.ny > 0.5 && g.vel.length() < 0.5){ g.vel.set(0, 0, 0); g.quieta += h; } }
      else { g.pos.x += dx; g.pos.y += dy; g.pos.z += dz; } }
    if(g.malla){ g.malla.position.copy(g.pos); if(g.vel.lengthSq() > 0.01) g.malla.rotation.set(g.t*11, g.t*7, 0); }
    const detona = g.tipo === 'humo' ? (g.quieta > 0.35 || g.t > 3.5) : g.t >= 1.62;
    if(detona){ if(g.tipo === 'he') explotarHE(g); else if(g.tipo === 'flash') explotarFlash(g); else soltarHumo(g); if(g.malla && g.tipo !== 'humo') escena.remove(g.malla); if(g.tipo === 'humo'){ g.fin = true; g.malla && escena.remove(g.malla); } GRANADAS.splice(i, 1); } }
}
function explotarHE(g){
  const R = 350*U, p = g.pos; if(window.sonar3D) sonar3D('he_explosion', p, 1.2);
  for(const a of ACTORES){ if(!a.vivo) continue; const c = V3(a.c.pos.x, a.c.pos.y + 0.9, a.c.pos.z), d = c.distanceTo(p); if(d > R) continue;
    if(!vistaLibre(p.x, p.y + 0.15, p.z, c.x, c.y, c.z) && !vistaLibre(p.x, p.y + 0.15, p.z, c.x, c.y + 0.6, c.z)) continue;
    const dmg = 98*Math.pow(1 - d/R, 1.35); if(dmg >= 1) danar(a, dmg, 'pecho', {ap:0.575, clase:'granada', id:'he'}, g.dueno, c.clone().sub(p).normalize(), c); }
  efectoExplosion(p, 1); if(window.sacudir) sacudir(p, 1);
}
function explotarFlash(g){
  const p = g.pos; if(window.sonar3D) sonar3D('flash_estallido', p, 1);
  for(const a of ACTORES){ if(!a.vivo) continue; const o = ojoDe(a), d = o.distanceTo(p); if(d > 40) continue;
    if(!vistaLibre(p.x, p.y + 0.1, p.z, o.x, o.y, o.z)) continue; if(humoBloquea(p, o)) continue;
    const mira = dirDe(a.yaw, a.pitch), hacia = p.clone().sub(o).normalize(), ang = mira.dot(hacia);
    const fAng = ang > 0.5 ? 1 : ang > 0 ? 0.55 + ang*0.9 : ang > -0.5 ? 0.35 + ang*0.4 : 0.12, fDist = d < 8 ? 1 : Math.max(0.1, 1 - (d - 8)/32);
    const dur = 4.9*fAng*fDist; if(dur > a.cegado){ a.cegado = dur; a.cegadoMax = dur; }
    if(window.alCegar) alCegar(a, dur, g.dueno); }
  efectoExplosion(p, 0.35, true);
}
const HUMOS = [];
function soltarHumo(g){ const h = {pos:g.pos.clone(), t:0, dur:18, r:0, rMax:3.6}; HUMOS.push(h); if(window.sonar3D) sonar3D('humo_salida', h.pos, 0.9); efectoHumo(h); }
function pasarHumos(dt){ for(let i=HUMOS.length-1;i>=0;i--){ const h = HUMOS[i]; h.t += dt; h.r = h.rMax*Math.min(1, h.t/1.2)*(h.t > h.dur - 1.5 ? Math.max(0.3, (h.dur - h.t)/1.5) : 1); if(h.t > h.dur){ HUMOS.splice(i, 1); if(h.fx) h.fx.fin = true; } } }
/* ¿el humo tapa la línea de a a b? (cuerda dentro de la esfera de más de 0,7 m) */
function humoBloquea(a, b){ if(!HUMOS.length) return false; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1e-6, ux = dx/L, uy = dy/L, uz = dz/L;
  for(const h of HUMOS){ if(h.r < 0.5) continue; const ox = a.x - h.pos.x, oy = a.y - (h.pos.y + h.r*0.45), oz = a.z - h.pos.z, bb = ox*ux + oy*uy + oz*uz, cc = ox*ox + oy*oy + oz*oz - h.r*h.r, dd = bb*bb - cc;
    if(dd <= 0) continue; const s = Math.sqrt(dd), t0 = Math.max(0, -bb - s), t1 = Math.min(L, -bb + s); if(t1 - t0 > 0.7) return true; }
  return false; }
/* ---------- la bomba ---------- */
const BOMBA = {estado:'nada', pos:V3(), t:0, portador:null, sitio:null, desactivador:null, prog:0, g:null, bip:0};
function bombaReset(){ BOMBA.estado = 'nada'; BOMBA.t = 0; BOMBA.portador = null; BOMBA.sitio = null; BOMBA.desactivador = null; BOMBA.prog = 0; if(BOMBA.g){ escena.remove(BOMBA.g); BOMBA.g = null; } }
function sitioEn(pos){ if(!OBRA || !OBRA.sitios) return null; for(const k in OBRA.sitios){ const s = OBRA.sitios[k]; if(pos.x >= s.x0 && pos.x <= s.x1 && pos.z >= s.z0 && pos.z <= s.z1 && Math.abs(pos.y - s.y) < 4) return k; } return null; }
function plantarPaso(a, dt){
  if(!a.vivo || a.inv[5] !== 'c4' || !a.c.enSuelo) { a.plantando = 0; return false; } const s = sitioEn(a.c.pos); if(!s){ a.plantando = 0; return false; }
  if(a.plantando === 0){ if(a.actual !== 'c4') equipar(a, 'c4'); if(a.esJugador && window.vmClip) vmClip('plantar', {dur:RONDA.plantar}); if(window.sonar3D) sonar3D('c4_tecla', a.c.pos, 0.5); }
  a.plantando += dt; a.c.vel.x *= 0.5; a.c.vel.z *= 0.5;
  if(a.plantando >= RONDA.plantar){ a.plantando = 0; a.inv[5] = null; BOMBA.estado = 'plantada'; BOMBA.t = RONDA.bomba; BOMBA.sitio = s; BOMBA.pos.set(a.c.pos.x - Math.sin(a.yaw)*0.4, pisoBajo(a.c.pos.x, a.c.pos.y + 0.5, a.c.pos.z, 3) + 0.01, a.c.pos.z - Math.cos(a.yaw)*0.4); BOMBA.plantador = a; BOMBA.bip = 0;
    if((typeof FABRICA !== 'undefined' && FABRICA)){ const A = FABRICA3.c4(); BOMBA.g = A.g; A.g.position.copy(BOMBA.pos).add(V3(0, 0.03, 0)); A.g.rotation.y = a.yaw; escena.add(A.g); }
    equipar(a, mejorArma(a)); if(window.alPlantar) alPlantar(a, s); return true; }
  return false;
}
function desactivarPaso(a, dt){
  if(BOMBA.estado !== 'plantada' || !a.vivo || a.bando !== 'ct'){ a.desactivando = 0; return false; }
  if(a.c.pos.distanceTo(BOMBA.pos) > 1.6){ a.desactivando = 0; if(BOMBA.desactivador === a) BOMBA.desactivador = null; return false; }
  if(BOMBA.desactivador && BOMBA.desactivador !== a && BOMBA.desactivador.desactivando > 0) return false;
  if(a.desactivando === 0 && window.sonar3D) sonar3D('desactivar', BOMBA.pos, 0.8);
  BOMBA.desactivador = a; a.desactivando += dt; a.c.vel.x = a.c.vel.z = 0;
  if(a.desactivando >= (a.kit ? RONDA.desactKit : RONDA.desact)){ BOMBA.estado = 'desactivada'; a.desactivando = 0; if(window.sonar3D) sonar3D('desactivada', BOMBA.pos, 1); if(window.alDesactivar) alDesactivar(a); return true; }
  return false;
}
function pasarBomba(dt){
  if(BOMBA.estado !== 'plantada') return; BOMBA.t -= dt;
  const T = BOMBA.t, per = T > 20 ? 1 : T > 10 ? 0.5 : T > 5 ? 0.25 : T > 2 ? 0.14 : 0.08; BOMBA.bip -= dt;
  if(BOMBA.bip <= 0){ BOMBA.bip = per; if(window.sonar3D) sonar3D('c4_pitido', BOMBA.pos, 0.8); efectoLuzBomba(); }
  if(T <= 0){ BOMBA.estado = 'explotada'; const R = 1750*U; if(window.sonar3D) sonar3D('c4_explosion', BOMBA.pos, 1.5);
    for(const a of ACTORES){ if(!a.vivo) continue; const d = a.c.pos.distanceTo(BOMBA.pos); if(d > R) continue; const dmg = 500*Math.exp(-Math.pow(d/(R/3), 2)*0.5); if(dmg >= 1) danar(a, dmg, 'pecho', {ap:1, clase:'granada', id:'c4'}, BOMBA.plantador, a.c.pos.clone().sub(BOMBA.pos).normalize(), null); }
    efectoExplosion(BOMBA.pos, 3.2); if(window.sacudir) sacudir(BOMBA.pos, 3); if(BOMBA.g){ escena.remove(BOMBA.g); BOMBA.g = null; } if(window.alExplotar) alExplotar(); }
}

/* ====================== efectos ====================== */
const FXW = {luz:null, luzT:0, trazos:[], chispas:null, agujeros:[], agujeroI:0, explos:[], humos:[], sangre:null, listo:false};
function texRedonda(dura, color){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color || 'rgba(255,255,255,1)'); gr.addColorStop(dura || 0.35, color || 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
function texHumo(){ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for(let i=0;i<14;i++){ const x = 64 + (Math.random() - 0.5)*50, y = 64 + (Math.random() - 0.5)*50, r = 18 + Math.random()*26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
function fxIniciar(){
  if(FXW.listo) return; FXW.listo = true;
  /* una sola luz puntual para fogonazos y explosiones: siempre en la escena (si aparece y desaparece, recompila todos los materiales) */
  FXW.luz = new THREE.PointLight(0xffb060, 0, 9, 1.6); FXW.luz.position.set(0, -500, 0); escena.add(FXW.luz);
  /* chispas y sangre: puntos con tamaño en pantalla */
  const pozo = (n, color, tam)=>{ const g = new THREE.BufferGeometry(), P = new Float32Array(n*3).fill(-1000); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const m = new THREE.PointsMaterial({color, size:tam, sizeAttenuation:true, transparent:true, depthWrite:false, map:texRedonda(0.3), blending:THREE.AdditiveBlending}); const pts = new THREE.Points(g, m); pts.frustumCulled = false; escena.add(pts);
    return {pts, n, i:0, vel:new Float32Array(n*3), vida:new Float32Array(n)}; };
  FXW.chispas = pozo(160, new THREE.Color(3, 2.2, 1.2), 0.05); FXW.polvo = pozo(160, new THREE.Color(0.6, 0.58, 0.55), 0.09); FXW.polvo.pts.material.blending = THREE.NormalBlending;
  FXW.sangre = pozo(120, new THREE.Color(0.35, 0.02, 0.02), 0.07); FXW.sangre.pts.material.blending = THREE.NormalBlending;
  FXW.matTrazo = new THREE.MeshBasicMaterial({color:new THREE.Color(4, 3.2, 1.8), transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false});
  FXW.geoTrazo = new THREE.BoxGeometry(0.012, 0.012, 1); FXW.geoTrazo.translate(0, 0, 0.5);   /* lookAt apunta el +z al blanco */
  FXW.matExplo = new THREE.SpriteMaterial({map:texRedonda(0.25, 'rgba(255,190,90,1)'), color:new THREE.Color(5, 3, 1.4), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending});
  FXW.matHumo = new THREE.SpriteMaterial({map:texHumo(), color:0x9a9a98, transparent:true, depthWrite:false, opacity:0.95});
  FXW.geoAgujero = new THREE.PlaneGeometry(1, 1);
}
function particulas(P, pos, n, vel, disp, vida){ const a = P.pts.geometry.attributes.position; for(let k=0;k<n;k++){ const i = P.i; P.i = (P.i + 1) % P.n;
    a.array[i*3] = pos.x; a.array[i*3+1] = pos.y; a.array[i*3+2] = pos.z; P.vel[i*3] = vel.x + (Math.random() - 0.5)*disp; P.vel[i*3+1] = vel.y + (Math.random() - 0.3)*disp; P.vel[i*3+2] = vel.z + (Math.random() - 0.5)*disp; P.vida[i] = vida*(0.6 + Math.random()*0.6); }
  a.needsUpdate = true; }
function pasarParticulas(P, dt, grav, arrastre){ const a = P.pts.geometry.attributes.position, A = a.array; let viva = false;
  for(let i=0;i<P.n;i++){ if(P.vida[i] <= 0) continue; viva = true; P.vida[i] -= dt; if(P.vida[i] <= 0){ A[i*3+1] = -1000; continue; }
    P.vel[i*3+1] -= grav*dt; const k = Math.exp(-arrastre*dt); P.vel[i*3] *= k; P.vel[i*3+1] *= k; P.vel[i*3+2] *= k; A[i*3] += P.vel[i*3]*dt; A[i*3+1] += P.vel[i*3+1]*dt; A[i*3+2] += P.vel[i*3+2]*dt; }
  if(viva) a.needsUpdate = true; }
const MAT_IMPACTO = {chapa:'metal', metal:'metal', acero_naranja:'metal', madera:'madera', caja_madera:'madera', tablas:'madera'};
function efectoImpacto(p, n, mat, sinAgujero){
  fxIniciar(); const M = MATS[mat] || {}, tipo = MAT_IMPACTO[M.bala] || MAT_IMPACTO[mat] || (M.bala === 'chapa' || M.bala === 'metal' ? 'metal' : 'hormigon');
  if(tipo === 'metal') particulas(FXW.chispas, p, 6, n.clone().multiplyScalar(3), 5, 0.25);
  particulas(FXW.polvo, p, tipo === 'metal' ? 2 : 5, n.clone().multiplyScalar(1.4), 1.6, 0.6);
  if(!sinAgujero){ const id = tipo === 'metal' ? 'agujero_metal' : tipo === 'madera' ? 'agujero_madera' : 'agujero_hormigon';
    if(ARCH['decal/' + id]){ let ag = FXW.agujeros[FXW.agujeroI]; if(!ag){ ag = new THREE.Mesh(FXW.geoAgujero, new THREE.MeshBasicMaterial({transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3})); ag.renderOrder = 3; escena.add(ag); FXW.agujeros[FXW.agujeroI] = ag; }
      FXW.agujeroI = (FXW.agujeroI + 1) % 72; const L = {r:0.5, g:0.5, b:0.5, sol:0}; luzEn(p.x + n.x*0.2, p.y + 0.2, p.z + n.z*0.2, L);
      ag.material.map = texAsset('decal/' + id, {srgb:true, repetir:false}); ag.material.color.setRGB(Math.min(1.4, L.r + L.sol*0.8), Math.min(1.4, L.g + L.sol*0.8), Math.min(1.4, L.b + L.sol*0.8)); ag.material.needsUpdate = true;
      ag.position.copy(p).addScaledVector(n, 0.006); ag.lookAt(p.clone().add(n)); ag.rotateZ(Math.random()*TAU); const s = 0.07 + Math.random()*0.03; ag.scale.set(s, s, s); ag.visible = true; } }
  if(window.sonar3D) sonar3D('impacto_' + tipo, p, 0.55);
}
function efectoSangre(p, d, cabeza){ fxIniciar(); particulas(FXW.sangre, p, cabeza ? 14 : 7, (d || V3()).clone().multiplyScalar(2.2), 2.2, 0.5); }
function efectoDisparo(a, o, d, res){
  fxIniciar(); const W = ARMAS[a.actual];
  for(const im of res.impactos) if(im.t < 120) efectoImpacto(im.pos, im.n, im.mat, false);
  /* trazadora: desde la boca aproximada (al costado y abajo del ojo) hasta el primer impacto */
  const fin = res.primero ? res.primero.pos : o.clone().addScaledVector(d, 80), der = V3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
  const ini = o.clone().addScaledVector(d, a.esJugador ? 0.6 : 0.5).addScaledVector(der, a.esJugador ? 0.1 : 0.12).add(V3(0, a.esJugador ? -0.08 : -0.1, 0));
  if(!W.silenciada || Math.random() < 0.4){ if(a.sp % 2 < 1 || W.semi){ let tr = FXW.trazos.find(t=> t.vida <= 0); if(!tr){ tr = {m:new THREE.Mesh(FXW.geoTrazo, FXW.matTrazo), vida:0}; tr.m.frustumCulled = false; escena.add(tr.m); FXW.trazos.push(tr); }
    const L = ini.distanceTo(fin); tr.m.position.copy(ini); tr.m.lookAt(fin); tr.m.scale.set(1, 1, Math.max(0.1, L)); tr.vida = 0.05; tr.m.visible = true; tr.ini = ini; tr.fin = fin; tr.L = L; } }
  /* destello en el mundo */
  if(!W.silenciada){ FXW.luz.position.copy(ini); FXW.luz.intensity = a.esJugador ? 2.4 : 1.6; FXW.luzT = 0.05; }
}
function efectoExplosion(p, s, blanco){ fxIniciar();
  for(let i=0;i<(blanco ? 1 : 6);i++){ const sp = new THREE.Sprite(FXW.matExplo.clone()); sp.position.copy(p).add(V3((Math.random() - 0.5)*s*0.8, 0.2 + Math.random()*s*0.6, (Math.random() - 0.5)*s*0.8)); sp.scale.setScalar(0.2); escena.add(sp);
    if(blanco){ sp.material.color.setRGB(9, 9, 9); } FXW.explos.push({sp, t:0, dur:blanco ? 0.12 : 0.35 + Math.random()*0.25, tam:(blanco ? 3 : 2.2 + Math.random())*s}); }
  if(!blanco){ efectoHumo({pos:p.clone(), t:0, dur:4, r:1.6*s, rMax:1.6*s, oscuro:true}); particulas(FXW.chispas, p.clone().add(V3(0, 0.3, 0)), 40, V3(0, 3, 0), 12, 0.6); }
  FXW.luz.position.copy(p).add(V3(0, 0.6, 0)); FXW.luz.intensity = blanco ? 30 : 24*s; FXW.luz.distance = 16*s; FXW.luzT = blanco ? 0.12 : 0.3; }
function efectoLuzBomba(){ fxIniciar(); if(FXW.luzT > 0) return; FXW.luz.position.copy(BOMBA.pos).add(V3(0, 0.15, 0)); FXW.luz.color.setRGB(1, 0.1, 0.05); FXW.luz.intensity = 3; FXW.luz.distance = 3; FXW.luzT = 0.06; FXW.luzBomba = true; }
function efectoHumo(h){ fxIniciar(); const n = h.oscuro ? 10 : 34, fx = {h, sp:[], fin:false}; h.fx = fx;
  for(let i=0;i<n;i++){ const m = FXW.matHumo.clone(); if(h.oscuro) m.color.setRGB(0.12, 0.11, 0.1); const sp = new THREE.Sprite(m); const a = Math.random()*TAU, r = Math.sqrt(Math.random()), y = Math.random();
    sp.userData = {dx:Math.cos(a)*r, dy:y, dz:Math.sin(a)*r, giro:(Math.random() - 0.5)*0.3, tam:1.4 + Math.random()*1.4}; sp.material.rotation = Math.random()*TAU; escena.add(sp); fx.sp.push(sp); }
  FXW.humos.push(fx); }
function pasarFX(dt){
  if(!FXW.listo) return;
  if(FXW.luzT > 0){ FXW.luzT -= dt; if(FXW.luzT <= 0){ FXW.luz.intensity = 0; FXW.luz.position.set(0, -500, 0); FXW.luz.distance = 9; FXW.luz.color.setRGB(1, 0.69, 0.38); } }
  for(const t of FXW.trazos){ if(t.vida <= 0) continue; t.vida -= dt; if(t.vida <= 0) t.m.visible = false; }
  pasarParticulas(FXW.chispas, dt, 9.8, 1.5); pasarParticulas(FXW.polvo, dt, 1.2, 3); pasarParticulas(FXW.sangre, dt, 9.8, 2);
  for(let i=FXW.explos.length-1;i>=0;i--){ const e = FXW.explos[i]; e.t += dt; const u = e.t/e.dur; if(u >= 1){ escena.remove(e.sp); e.sp.material.dispose(); FXW.explos.splice(i, 1); continue; }
    e.sp.scale.setScalar(e.tam*(0.3 + 0.7*Math.sqrt(u))); e.sp.material.opacity = 1 - u*u; }
  for(let i=FXW.humos.length-1;i>=0;i--){ const f = FXW.humos[i], h = f.h; if(!f.fin && h.oscuro){ h.t += dt; if(h.t > h.dur) f.fin = true; }
    const vivo = !f.fin, alfa = h.oscuro ? Math.max(0, 1 - h.t/h.dur)*0.85 : (h.t > h.dur - 1.5 ? Math.max(0, (h.dur - h.t)/1.5) : Math.min(1, h.t/0.5));
    for(const sp of f.sp){ const u = sp.userData, r = Math.max(0.3, h.r || h.rMax); sp.position.set(h.pos.x + u.dx*r*0.85, h.pos.y + 0.3 + u.dy*r*0.9 + (h.oscuro ? h.t*0.5 : 0), h.pos.z + u.dz*r*0.85);
      sp.scale.setScalar(u.tam*r/2.2*(h.oscuro ? 1 + h.t*0.3 : 1)); sp.material.opacity = alfa; sp.material.rotation += u.giro*dt; }
    if(!vivo || alfa <= 0.001){ if(f.fin){ for(const sp of f.sp){ escena.remove(sp); sp.material.dispose(); } FXW.humos.splice(i, 1); } } }
}
