
/* ====================== bots ======================
   Ven con un campo visual de 130° (más ancho si escucharon algo), con línea de vista a la cabeza o al pecho, sin humo ni flash;
   oyen tiros a 45 m y pasos corriendo a 18 m. Apuntan con reacción, un error que se va asentando con el tiempo de mira, adelanto
   por la velocidad del blanco y control del retroceso (todo según la dificultad); frenan para tirar quietos (contraparada),
   tiran ráfagas cortas a media distancia y tiros sueltos de lejos. Se mueven por la navegación con el mismo cuerpo que el
   jugador (moverCuerpoSource) y saltan agachados donde la ruta sube. */
const RUIDOS = [];
window.alDisparar = function(a, W){ RUIDOS.push({pos:a.c.pos.clone(), t:a.t, actor:a, r:W && W.silenciada ? 14 : 45, vence:J.tt + 0.9}); if(RUIDOS.length > 40) RUIDOS.shift(); };
function botNuevo(a, dif){ return {dif:DIFICULTAD[dif] || DIFICULTAD.normal, ent:{adelante:0, lado:0, saltar:false, agachar:false, caminar:false}, ruta:null, ri:0, meta:null, repath:0, blanco:null, visto:{}, reaccion:0, tMira:0,
  err:{x:0, y:0}, cabeza:false, rol:'', guardia:null, espera:0, atasco:0, ultPos:V3(), ultPosT:0, lado:1, ladoT:0, rafaga:0, pausa:0, oido:null, oidoT:0, granadaT:8 + Math.random()*10, yawObj:0, pitchObj:0, fase:'ir', mira:false, t:0, turno:(a.id*7) % 3}; }
/* ---------- compra ---------- */
function botComprar(a){
  const B = a.bot; if(!B || PARTIDA.modo !== 'bomba') return; const r = PARTIDA.rnd, rifle = a.bando === 't' ? 'ak47' : 'm4s', smg = a.bando === 't' ? 'mac10' : 'mp9';
  const c = id=> comprar(a, id) === 'ok';
  if(!a.inv[1]){ if(a.dinero >= 4750 + 1000 && r() < 0.14) c('awp'); else if(a.dinero >= ARMAS[rifle].precio + 650) c(rifle); else if(a.dinero >= ARMAS[smg].precio + 650 && PARTIDA.ronda > 1 && r() < 0.6) c(smg); }
  if(a.dinero >= 1000 && !(a.blindaje >= 100 && a.casco)) c('casco'); else if(a.dinero >= 650 && a.blindaje < 100) c('kevlar');
  if(!a.inv[1] && a.dinero >= 700 && r() < 0.35) c('deagle');
  if(a.bando === 'ct' && a.dinero >= 400 && r() < 0.5) c('kit');
  if(a.dinero >= 300 && r() < 0.5) c('he'); if(a.dinero >= 200 && r() < 0.5) c('flash'); if(a.dinero >= 300 && r() < 0.3) c('humo');
  equipar(a, mejorArma(a));
}
/* ---------- plan del equipo (al arrancar la ronda) ---------- */
function botPlanRonda(){
  const r = PARTIDA.rnd, sitios = Object.keys(OBRA.sitios || {}); PARTIDA.plan = {sitio:sitios.length ? sitios[Math.floor(r()*sitios.length)] : null, rapido:r() < 0.45};
  const cts = ACTORES.filter(a=> a.bot && a.bando === 'ct'), gs = (OBRA.guardias || []).filter(g=> g.bando === 'ct' || !g.bando);
  cts.forEach((a, i)=>{ const s = sitios.length ? sitios[i % sitios.length] : null, cand = gs.filter(g=> g.sitio === s), g = cand.length ? cand[Math.floor(r()*cand.length)] : null;
    a.bot.rol = 'defender'; a.bot.sitioRol = s; a.bot.guardia = g; a.bot.meta = g ? V3(g.x, g.y, g.z) : (s ? centroSitio(s) : null); a.bot.ruta = null; a.bot.fase = 'ir'; a.bot.espera = r()*3; });
  for(const a of ACTORES) if(a.bot && a.bando === 't'){ a.bot.rol = 'atacar'; a.bot.meta = PARTIDA.plan.sitio ? centroSitio(PARTIDA.plan.sitio, 3) : null; a.bot.ruta = null; a.bot.fase = 'ir'; a.bot.espera = PARTIDA.plan.rapido ? r()*1.5 : 4 + r()*10; }
}
function centroSitio(s, disp){ const S = OBRA.sitios[s]; if(!S) return null; const d = disp || 0; return V3(S.cx + (PARTIDA.rnd() - 0.5)*d, S.y, S.cz + (PARTIDA.rnd() - 0.5)*d); }
window.alIniciarRonda = function(){ for(const a of ACTORES) if(a.bot){ a.bot.blanco = null; a.bot.visto = {}; a.bot.ruta = null; a.bot.oido = null; botComprar(a); } };
window.alArrancaRonda = function(){ botPlanRonda(); };
/* ---------- percepción ---------- */
const _ojoB = V3(), _cab = V3(), _pch = V3();
function botVer(a){
  const B = a.bot, o = ojoDe(a, _ojoB), mira = dirDe(a.yaw, a.pitch), ciego = a.cegado > 0.4; let mejor = null, md = 1e9;
  for(const e of ACTORES){ if(e === a || !e.vivo || (PARTIDA.modo === 'bomba' && e.bando === a.bando)) continue;
    const dx = e.c.pos.x - o.x, dz = e.c.pos.z - o.z, d = Math.hypot(dx, dz); if(d > 75) continue;
    ojoDe(e, _cab); _cab.y -= 0.07; _pch.set(e.c.pos.x, e.c.pos.y + (e.c.agachado > 0.5 ? 0.85 : 1.25), e.c.pos.z);
    const hx = _pch.x - o.x, hy = _pch.y - o.y, hz = _pch.z - o.z, L = Math.hypot(hx, hy, hz) || 1, cosA = (hx*mira.x + hy*mira.y + hz*mira.z)/L;
    const campo = B.oidoT > 0 || B.blanco === e ? -0.2 : 0.42; if(cosA < campo || ciego) continue;
    const vCab = vistaLibre(o.x, o.y, o.z, _cab.x, _cab.y, _cab.z) && !humoBloquea(o, _cab), vPch = vistaLibre(o.x, o.y, o.z, _pch.x, _pch.y, _pch.z) && !humoBloquea(o, _pch);
    if(!vCab && !vPch) continue; const vis = {cab:vCab, pch:vPch};
    const prev = B.visto[e.id]; B.visto[e.id] = {t:a.t, pos:e.c.pos.clone(), vis, previo:prev ? prev.t : -9};
    const pref = d*(B.blanco === e ? 0.6 : 1); if(pref < md){ md = pref; mejor = e; } }
  /* la reacción es por blanco: al cambiar a uno nuevo (si lo venía viendo hace poco, reacciona más rápido) */
  if(mejor && mejor !== B.blanco){ const v = B.visto[mejor.id], reciente = v && a.t - v.previo < 1.5, d = mejor.c.pos.distanceTo(a.c.pos);
    B.blanco = mejor; B.tMira = 0; B.cabeza = Math.random() < B.dif.cabeza; B.err.x = (Math.random() - 0.5)*2; B.err.y = (Math.random() - 0.5)*2; B.rafaga = 0;
    B.reaccion = reciente ? 0.08 : lerp(B.dif.reaccion[0], B.dif.reaccion[1], Math.random())*(d < 6 ? 0.8 : 1); }
  else if(!mejor && B.blanco){ const v = B.visto[B.blanco.id]; if(!v || a.t - v.t > 1.2 || !B.blanco.vivo){ B.ultimoVisto = v ? v.pos : null; B.blanco = null; } }
  /* oídos */
  for(const r of RUIDOS){ if(r.actor === a || (PARTIDA.modo === 'bomba' && r.actor.bando === a.bando) || J.tt > r.vence) continue; const d = r.pos.distanceTo(a.c.pos); if(d < r.r && (!B.oido || B.oidoT < 0.5)){ B.oido = r.pos.clone(); B.oidoT = 2.5; } }
  for(const e of ACTORES){ if(e === a || !e.vivo || (PARTIDA.modo === 'bomba' && e.bando === a.bando)) continue; if(velH(e) > 3.6 && e.c.enSuelo && e.c.pos.distanceTo(a.c.pos) < 18 && B.oidoT < 0.5){ B.oido = e.c.pos.clone(); B.oidoT = 1.6; } }
}
/* ---------- un cuadro del bot ---------- */
function pasarBot(a, dt){
  const B = a.bot; if(!B || !a.vivo) return; B.t += dt; if(B.oidoT > 0) B.oidoT -= dt; if(B.espera > 0) B.espera -= dt; if(B.reaccion > 0) B.reaccion -= dt; if(B.granadaT > 0) B.granadaT -= dt;
  if(PARTIDA.fase === 'congelado'){ B.ent.adelante = B.ent.lado = 0; moverCuerpoSource(a.c, B.ent, a.yaw, 0, dt, null); pasarActor(a, dt); return; }
  if(((J.t + B.turno) % 3) === 0) botVer(a);
  const W = ARMAS[a.actual], e = B.blanco && B.blanco.vivo ? B.blanco : null, E = B.ent; E.adelante = 0; E.lado = 0; E.saltar = false; E.agachar = false; E.caminar = false;
  /* arma: recargar tranquilo, cambiar si se vació */
  const m = a.mun[a.actual];
  if(W && W.carg && m){ if(m.carg === 0 && m.res === 0){ const otra = a.actual === a.inv[1] ? a.inv[2] : null; equipar(a, otra || 'cuchillo'); } else if(!e && m.carg < W.carg*0.4 && m.res > 0) empezarRecarga(a); else if(m.carg === 0) empezarRecarga(a); }
  if(PARTIDA.modo === 'armas' && a.actual === 'cuchillo' && !e) { /* con cuchillo va a buscar */ }
  let mirarA = null, apunta = false;
  if(e){
    /* apuntar: cabeza o pecho, con error que se asienta y adelanto */
    B.tMira += dt; const d = e.c.pos.distanceTo(a.c.pos), o = ojoDe(a), cab = ojoDe(e).add(V3(0, -0.06, 0)), pch = V3(e.c.pos.x, e.c.pos.y + (e.c.agachado > 0.5 ? 0.8 : 1.2), e.c.pos.z);
    const vis = B.visto[e.id] ? B.visto[e.id].vis : {cab:true, pch:true}, obj = B.cabeza && vis.cab ? cab : (vis.pch ? pch : cab);
    const lead = 0.06 + (1 - B.dif.punteria)*0.1; obj.x += e.c.vel.x*lead; obj.z += e.c.vel.z*lead;
    const asiento = 1/(1 + B.tMira*(2 + B.dif.punteria*5)), escala = (1 - B.dif.punteria)*0.09 + 0.012, errR = escala*asiento*(1 + velH(e)/6)*(a.cegado > 0 ? 3 : 1);
    const dx = obj.x - o.x, dy = obj.y - o.y, dz = obj.z - o.z, hd = Math.hypot(dx, dz);
    B.yawObj = Math.atan2(-dx, -dz) + B.err.x*errR; B.pitchObj = Math.atan2(dy, hd) + B.err.y*errR*0.6;
    /* control del retroceso: baja la mira lo que el patrón la sube */
    if(W && W.patron && a.sp >= 1){ const p = W.patron[Math.min(W.patron.length - 1, Math.floor(a.sp))]; B.pitchObj -= p[1]*GRAD*B.dif.control; B.yawObj += p[0]*GRAD*B.dif.control; }
    mirarA = true; apunta = true;
    /* moverse peleando: de costado; frena para tirar si le conviene */
    B.ladoT -= dt; if(B.ladoT <= 0){ B.lado = Math.random() < 0.5 ? -1 : 1; B.ladoT = 0.35 + Math.random()*0.7; }
    const quieto = W && W.impr && (W.clase === 'rifle' || W.clase === 'francotirador' || d > 10) && Math.random() < B.dif.frena*1.2;
    if(!quieto || B.reaccion > 0){ E.lado = B.lado; if(d > 22 && W && W.clase !== 'francotirador') E.adelante = 0.6; if(d < 3 && W && W.clase !== 'cuchillo') E.adelante = -1; }
    if(W && W.clase === 'cuchillo'){ E.adelante = 1; E.lado = B.lado*0.5; }
    if(W && W.clase === 'francotirador'){ a.mira = d > 6 ? 1 : 0; }
    /* granada al que se escondió no; eso va abajo */
  } else {
    a.mira = 0; B.tMira = 0;
    /* metas */
    botObjetivo(a);
    const sig = botSeguir(a, dt);
    if(sig){ const dx = sig.x - a.c.pos.x, dz = sig.z - a.c.pos.z; B.yawObj = Math.atan2(-dx, -dz); B.pitchObj = lerp(B.pitchObj, -0.04, 0.1); E.adelante = 1; if(sig.salto && Math.hypot(dx, dz) < 1.1){ E.saltar = true; E.agachar = true; } }
    else if(B.guardia && B.guardia.mx !== undefined){ const g = B.guardia; B.yawObj = Math.atan2(-(g.mx - a.c.pos.x), -(g.mz - a.c.pos.z)); B.pitchObj = 0; }
    if(B.oido && B.oidoT > 0){ const dx = B.oido.x - a.c.pos.x, dz = B.oido.z - a.c.pos.z; B.yawObj = Math.atan2(-dx, -dz); }
    /* granadas a donde se vio al enemigo */
    if(B.ultimoVisto && B.granadaT <= 0 && a.inv[4].length && a.saca <= 0){ const dd = B.ultimoVisto.distanceTo(a.c.pos); if(dd > 7 && dd < 26){ const tipo = a.inv[4].includes('he') ? 'he' : a.inv[4].includes('flash') ? 'flash' : null;
      if(tipo){ const dx = B.ultimoVisto.x - a.c.pos.x, dz = B.ultimoVisto.z - a.c.pos.z; a.yaw = Math.atan2(-dx, -dz); a.pitch = lim(0.18 + dd*0.012, 0.15, 0.6); lanzarGranada(a, tipo, false); B.granadaT = 14 + Math.random()*12; B.ultimoVisto = null; } } }
  }
  /* girar la vista hacia el objetivo con tope de velocidad */
  const giro = B.dif.giro*(apunta ? 1 : 0.55)*dt, dyaw = angDif(a.yaw, B.yawObj), dp = B.pitchObj - a.pitch;
  a.yaw += lim(dyaw*(apunta ? 0.35 : 0.2), -giro, giro); a.pitch += lim(dp*0.35, -giro, giro); a.pitch = lim(a.pitch, -1.4, 1.4);
  /* disparar */
  if(e && W && B.reaccion <= 0 && a.saca <= 0 && a.recarga <= 0){
    const d = e.c.pos.distanceTo(a.c.pos), tam = Math.atan2(0.22, d) + 0.004, errAng = Math.abs(angDif(B.yawObj - B.err.x*0, a.yaw)) + Math.abs(B.pitchObj - a.pitch);
    if(W.clase === 'cuchillo'){ if(d < 1.7) cuchillazo(a, d < 1.2 && Math.random() < 0.3); }
    else if(W.ciclo && errAng < tam*2.5){
      const rafagaMax = d > 26 ? 1 : d > 12 ? 4 : 30;
      if(B.pausa > 0) B.pausa -= dt;
      else { const r = disparar(a); if(r){ B.rafaga++; if(B.rafaga >= rafagaMax || W.semi){ B.rafaga = 0; B.pausa = W.semi ? (W.clase === 'francotirador' ? 0.1 : 0.12 + (1 - B.dif.punteria)*0.25) : 0.25 + Math.random()*0.25; } } }
    } else if(B.pausa > 0) B.pausa -= dt;
  } else B.rafaga = 0;
  /* plantar / desactivar */
  if(PARTIDA.modo === 'bomba'){
    if(a.inv[5] === 'c4' && sitioEn(a.c.pos) && !e && PARTIDA.fase === 'juego'){ E.adelante = 0; E.lado = 0; plantarPaso(a, dt); }
    else if(a.plantando > 0 && e) a.plantando = 0;
    if(a.bando === 'ct' && BOMBA.estado === 'plantada' && a.c.pos.distanceTo(BOMBA.pos) < 1.4 && (!e || BOMBA.t < (a.kit ? 6 : 11))){ E.adelante = 0; E.lado = 0; E.agachar = true; desactivarPaso(a, dt); }
    else if(a.desactivando > 0) a.desactivando = 0;
  }
  const vmax = W && W.vel ? (a.mira && W.velMira ? W.velMira : W.vel) : 250*U;
  moverCuerpoSource(a.c, E, a.yaw, vmax, dt, null);
  pasarActor(a, dt);
  /* atascado: repensar o saltar */
  B.ultPosT += dt; if(B.ultPosT > 1.2){ const mov = a.c.pos.distanceTo(B.ultPos); if(E.adelante && mov < 0.35 && !e){ B.atasco++; B.ruta = null; if(B.atasco % 2) { E.saltar = true; } } else B.atasco = 0; B.ultPos.copy(a.c.pos); B.ultPosT = 0; }
}
/* ---------- a dónde va ---------- */
function botObjetivo(a){
  const B = a.bot, M = PARTIDA.modo;
  if(B.espera > 0 && !B.oido){ B.meta = B.meta; return; }
  if(M === 'bomba'){
    if(a.bando === 't'){
      const bombaSuelo = SUELTAS.find(s=> s.esBomba);
      if(bombaSuelo){ const masCerca = ACTORES.filter(o=> o.vivo && o.bando === 't').sort((x, y)=> x.c.pos.distanceTo(bombaSuelo.pos) - y.c.pos.distanceTo(bombaSuelo.pos))[0]; if(masCerca === a){ botIr(a, bombaSuelo.pos); if(a.c.pos.distanceTo(bombaSuelo.pos) < 1.2) levantar(a, bombaSuelo); return; } }
      if(BOMBA.estado === 'plantada'){ if(!B.post || B.post.sitio !== BOMBA.sitio){ const g = (OBRA.guardias || []).filter(g=> (g.bando === 't' || !g.bando) && g.sitio === BOMBA.sitio); const pg = g.length ? g[Math.floor(Math.random()*g.length)] : null; B.post = {sitio:BOMBA.sitio, pos:pg ? V3(pg.x, pg.y, pg.z) : BOMBA.pos.clone().add(V3((Math.random() - 0.5)*8, 0, (Math.random() - 0.5)*8)), g:pg}; B.guardia = pg; } botIr(a, B.post.pos); return; }
      if(B.oido && B.oidoT > 0 && a.inv[5] !== 'c4'){ botIr(a, B.oido); return; }
      if(PARTIDA.plan && PARTIDA.plan.sitio){ if(!B.meta) B.meta = centroSitio(PARTIDA.plan.sitio, a.inv[5] ? 2 : 8); botIr(a, B.meta); }
    } else {
      if(BOMBA.estado === 'plantada'){ botIr(a, BOMBA.pos); return; }
      if(B.oido && B.oidoT > 0 && B.oido.distanceTo(a.c.pos) < 25){ botIr(a, B.oido); return; }
      if(B.meta) botIr(a, B.meta);
    }
  } else {
    /* dm y carrera: al enemigo conocido más cercano, si no a recorrer */
    let mejor = null, md = 1e9; for(const k in B.visto){ const v = B.visto[k]; if(a.t - v.t > 8) continue; const d = v.pos.distanceTo(a.c.pos); if(d < md){ md = d; mejor = v.pos; } }
    if(!mejor && B.oido) mejor = B.oido;
    if(!mejor){ if(!B.meta || a.c.pos.distanceTo(B.meta) < 2.5 || !B.ruta){ const S = OBRA.spawns.dm.length ? OBRA.spawns.dm : OBRA.spawns.ct.concat(OBRA.spawns.t); const s = S[Math.floor(Math.random()*S.length)]; B.meta = V3(s.x, s.y, s.z); B.ruta = null; } mejor = B.meta; }
    botIr(a, mejor);
  }
}
function botIr(a, p){ const B = a.bot; if(!p) return; if(!B.destino || B.destino.distanceTo(p) > 2.5){ B.destino = p.clone(); B.ruta = null; } }
/* sigue la ruta: devuelve el próximo punto o null si llegó */
let RUTAS_CUADRO = 0;
function botSeguir(a, dt){
  const B = a.bot; if(!B.destino) return null; if(a.c.pos.distanceTo(B.destino) < 0.9){ B.ruta = null; return null; }
  B.repath -= dt;
  if(!B.ruta && RUTAS_CUADRO < 1){ RUTAS_CUADRO++; B.ruta = navRuta(a.c.pos.x, a.c.pos.y, a.c.pos.z, B.destino.x, B.destino.y, B.destino.z); B.ri = 1; B.repath = 4 + Math.random()*2; if(!B.ruta){ B.destino = null; return null; } }
  if(!B.ruta) return null;
  while(B.ri < B.ruta.length - 1){ const p = B.ruta[B.ri]; if(Math.hypot(p.x - a.c.pos.x, p.z - a.c.pos.z) < 0.55 && Math.abs(p.y - a.c.pos.y) < 1.2) B.ri++; else break; }
  const p = B.ruta[Math.min(B.ri, B.ruta.length - 1)]; if(B.repath <= 0 && RUTAS_CUADRO < 2){ B.ruta = null; }
  return p;
}
/* los cuerpos se empujan entre sí (como en CS): nadie queda encimado */
function separarCuerpos(){ const n = ACTORES.length;
  for(let i=0;i<n;i++){ const a = ACTORES[i]; if(!a.vivo) continue; for(let j=i+1;j<n;j++){ const b = ACTORES[j]; if(!b.vivo) continue;
    const dx = b.c.pos.x - a.c.pos.x, dz = b.c.pos.z - a.c.pos.z, dy = b.c.pos.y - a.c.pos.y; if(Math.abs(dy) > 1.6) continue; const d = Math.hypot(dx, dz), min = 0.72; if(d >= min) continue;
    const ux = d > 1e-4 ? dx/d : Math.cos(i*2.4), uz = d > 1e-4 ? dz/d : Math.sin(i*2.4), emp = (min - d)*0.5;
    for(const [c, s] of [[a.c, -1], [b.c, 1]]){ const mx = ux*emp*s, mz = uz*emp*s, r = c.ancho/2; if(libre(c.pos.x + mx - r, c.pos.y + 0.05, c.pos.z + mz - r, c.pos.x + mx + r, c.pos.y + c.alto, c.pos.z + mz + r)){ c.pos.x += mx; c.pos.z += mz; } } } } }
function pasarBots(dt){ RUTAS_CUADRO = 0; separarCuerpos(); for(const a of ACTORES) if(a.bot){ if(a.vivo) pasarBot(a, dt); else pasarActor(a, dt); } for(let i=RUIDOS.length-1;i>=0;i--) if(J.tt > RUIDOS[i].vence) RUIDOS.splice(i, 1); }
