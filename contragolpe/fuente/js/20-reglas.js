
/* ====================== reglas de la partida ======================
   bomba: 5 contra 5, rondas con congelado, compra y tiempo; gana la ronda quien elimina al otro equipo, los T si explota la
   bomba y los CT si la desactivan o se acaba el tiempo sin bomba; economía de CS (premio por ganar, bono por derrotas seguidas
   que sube de a 500, premio por baja según el arma, 300 por plantar y 800 para los T si perdieron con la bomba puesta);
   cambio de lado a la mitad. dm: todos contra todos con reaparición, gana quien llega a las bajas o el que más tiene al final.
   armas: carrera de armas, cada baja pasa a la siguiente y la última es con cuchillo. */
const PARTIDA = {modo:'bomba', mapa:null, fase:'nada', t:0, ronda:0, ganadas:{t:0, ct:0}, racha:{t:0, ct:0}, mitad:4, meta:5, jugador:null, tiempo:0, compraT:0, feed:[], avisos:[], mvp:null, ganadorRonda:null, motivo:'', fin:false, dmT:0, sem:1, rnd:Math.random};
const LARGO = {corta:{meta:5, mitad:4}, larga:{meta:9, mitad:8}};
function esAliado(a, b){ return PARTIDA.modo === 'bomba' && a && b && a.bando === b.bando; }
function puedeDanar(atac, v){ if(!atac || atac === v) return true; if(PARTIDA.modo === 'bomba') return atac.bando !== v.bando; return true; }
function enemigos(a){ return ACTORES.filter(o=> o !== a && o.vivo && (PARTIDA.modo !== 'bomba' || o.bando !== a.bando)); }
/* ---------- armar la partida ---------- */
function iniciarPartida(op){
  op = op || {}; PARTIDA.modo = op.modo || G.modo || 'bomba'; PARTIDA.fin = false; PARTIDA.ronda = 0; PARTIDA.ganadas = {t:0, ct:0}; PARTIDA.racha = {t:0, ct:0}; PARTIDA.feed = []; PARTIDA.avisos = [];
  PARTIDA.sem = op.semilla || (Math.random()*1e9 | 0); PARTIDA.rnd = mulberry(PARTIDA.sem); const L = LARGO[G.largo || 'corta'] || LARGO.corta; PARTIDA.meta = L.meta; PARTIDA.mitad = L.mitad;
  for(const a of ACTORES.slice()) quitarActor(a); SUELTAS.splice(0).forEach(s=> s.g && escena.remove(s.g)); GRANADAS.splice(0).forEach(g=> g.malla && escena.remove(g.malla)); HUMOS.length = 0; bombaReset();
  const nombres = NOMBRES_BOT.slice().sort(()=> PARTIDA.rnd() - 0.5); let ni = 0;
  const jugBando = PARTIDA.modo === 'bomba' ? (op.bando || G.bando || 'ct') : 'dm';
  const J1 = actorNuevo(G.nombre || 'JUGADOR', jugBando, true); PARTIDA.jugador = J1; J.jug = J1;
  const n = op.bots !== undefined ? op.bots : PARTIDA.modo === 'bomba' ? 9 : 9;
  for(let i=0;i<n;i++){ const bando = PARTIDA.modo === 'bomba' ? ((i < 4) ? jugBando : (jugBando === 'ct' ? 't' : 'ct')) : 'dm'; const a = actorNuevo(nombres[ni++ % nombres.length], bando, false); if(window.botNuevo) a.bot = botNuevo(a, G.dificultad || 'normal'); }
  if(PARTIDA.modo === 'bomba'){ for(const a of ACTORES){ a.dinero = ECO.inicio; } iniciarRonda(); }
  else { PARTIDA.fase = 'juego'; PARTIDA.tiempo = PARTIDA.modo === 'dm' ? 300 : 480; PARTIDA.t = 0; for(const a of ACTORES){ a.nivel = 0; reaparecer(a, true); } }
  if(window.alIniciarPartida) alIniciarPartida();
}
/* los muñecos que dejan de usarse (el cambio de lado a mitad de partida, una partida nueva) quedan guardados por bando y variante
   para el próximo que los necesite: se armaba uno nuevo (unas cien piezas fundidas) y el viejo quedaba en la placa */
const PERS_LIBRES = {};
function soltarPersonaje(P){ if(!P || !P.g) return; if(P.g.parent) P.g.parent.remove(P.g); const k = P.bando + '|' + P.variante; (PERS_LIBRES[k] || (PERS_LIBRES[k] = [])).push(P); }
function personajeDe(a){ if(!window.personajeNuevo) return; const bando = a.bando === 'dm' ? (a.id % 2 ? 'ct' : 't') : a.bando;
  if(a.pers && a.pers.bando === bando){ if(window.personajeRevivir) personajeRevivir(a.pers); return; }
  soltarPersonaje(a.pers); const v = a.id % 3, libre = PERS_LIBRES[bando + '|' + v] && PERS_LIBRES[bando + '|' + v].pop();
  a.pers = libre || personajeNuevo(bando, v); a.pers.bando = bando; a.pers.variante = v; if(libre && window.personajeRevivir) personajeRevivir(a.pers);
  a.pers.g.visible = !a.esJugador; escena.add(a.pers.g); }
function ubicar(a, s){ a.c.pos.set(s.x, s.y + 0.02, s.z); a.c.vel.set(0, 0, 0); a.yaw = s.yaw || 0; a.pitch = 0; a.c.enSuelo = true; a.c.agachado = 0; }
function spawnsDe(bando){ const S = OBRA.spawns[bando] || []; return S.length ? S : (OBRA.spawns.ct.length ? OBRA.spawns.ct : OBRA.spawns.t); }
/* ---------- rondas ---------- */
function iniciarRonda(){
  PARTIDA.ronda++; PARTIDA.fase = 'congelado'; PARTIDA.t = RONDA.congelado*0.6; PARTIDA.tiempo = RONDA.tiempo; PARTIDA.compraT = RONDA.compra; PARTIDA.ganadorRonda = null; PARTIDA.mvp = null;
  bombaReset(); GRANADAS.splice(0).forEach(g=> g.malla && escena.remove(g.malla)); HUMOS.length = 0; FXW.humos && FXW.humos.forEach(f=> f.fin = true);
  for(const s of SUELTAS.slice()) if(!s.esBomba){ if(s.g) escena.remove(s.g); SUELTAS.splice(SUELTAS.indexOf(s), 1); } else { if(s.g) escena.remove(s.g); SUELTAS.splice(SUELTAS.indexOf(s), 1); }
  const idx = {t:0, ct:0};
  /* (con el cambio de lado, primero se sueltan todos los que cambian: así cada uno toma el muñeco que dejó otro) */
  for(const a of ACTORES){ const b = a.bando === 'dm' ? (a.id % 2 ? 'ct' : 't') : a.bando; if(a.pers && a.pers.bando !== b){ soltarPersonaje(a.pers); a.pers = null; } }
  for(const a of ACTORES){ const S = spawnsDe(a.bando), s = S[idx[a.bando]++ % S.length];
    if(!a.vivo){ a.inv = {1:null, 2:null, 3:'cuchillo', 4:[], 5:null}; a.mun = {}; a.blindaje = 0; a.casco = false; a.kit = false; darArma(a, a.bando === 't' ? 'glock' : 'usps', true); }
    else if(!a.inv[2] && !a.inv[1]) darArma(a, a.bando === 't' ? 'glock' : 'usps', true);
    for(const k in a.mun){ const W = ARMAS[k]; if(W && W.carg){ a.mun[k].carg = W.carg; a.mun[k].res = W.res; } }
    a.vivo = true; a.vida = 100; a.cegado = 0; a.plantando = 0; a.desactivando = 0; a.recarga = 0; a.danoA = {}; a.dineroRonda = 0; a.bajasRonda = 0; ubicar(a, s); personajeDe(a); equipar(a, mejorArma(a)); }
  /* la bomba a un T al azar */
  const ts = ACTORES.filter(a=> a.bando === 't'); if(ts.length){ const p = ts[Math.floor(PARTIDA.rnd()*ts.length)]; p.inv[5] = 'c4'; BOMBA.portador = p; }
  if(window.alIniciarRonda) alIniciarRonda(); if(window.musica && PARTIDA.ronda > 1) musica('mus_ronda');
}
function vivosDe(bando){ return ACTORES.filter(a=> a.vivo && a.bando === bando).length; }
function finRonda(ganador, motivo){
  if(PARTIDA.fase === 'fin' || PARTIDA.fase === 'terminada') return; PARTIDA.fase = 'fin'; PARTIDA.t = RONDA.finRonda; PARTIDA.ganadorRonda = ganador; PARTIDA.motivo = motivo;
  PARTIDA.ganadas[ganador]++; const perdedor = ganador === 't' ? 'ct' : 't';
  PARTIDA.racha[ganador] = 0; PARTIDA.racha[perdedor] = Math.min(4, PARTIDA.racha[perdedor] + 1);
  const premio = motivo === 'bomba' ? ECO.ganaBomba : motivo === 'desactivada' ? ECO.ganaDesact : motivo === 'tiempo' ? ECO.ganaTiempo : ECO.ganaElim;
  const bono = ECO.perdida[Math.max(0, PARTIDA.racha[perdedor] - 1)];
  for(const a of ACTORES){ if(a.bando === ganador) pagar(a, premio); else { let b = bono; if(perdedor === 't' && motivo === 'tiempo' && a.vivo) b = 0; /* los T que sobreviven al tiempo no cobran */ if(perdedor === 't' && BOMBA.estado === 'desactivada') b += ECO.plantaPerdida; pagar(a, b); } }
  /* el mejor de la ronda: más bajas y daño */
  let mejor = null; for(const a of ACTORES) if(a.bando === ganador && (!mejor || (a.bajasRonda || 0) > (mejor.bajasRonda || 0))) mejor = a; if(mejor && (mejor.bajasRonda || 0) > 0){ mejor.mvp++; PARTIDA.mvp = mejor; }
  if(window.alFinRonda) alFinRonda(ganador, motivo);
}
function pagar(a, n){ a.dinero = Math.min(ECO.tope, a.dinero + n); a.dineroRonda = (a.dineroRonda || 0) + n; }
function pasarPartida(dt){
  if(PARTIDA.fase === 'nada' || PARTIDA.fase === 'terminada') return;
  const M = PARTIDA.modo;
  if(M === 'bomba'){
    if(PARTIDA.compraT > 0) PARTIDA.compraT -= dt;
    if(PARTIDA.fase === 'congelado'){ PARTIDA.t -= dt; for(const a of ACTORES){ a.c.vel.x = a.c.vel.z = 0; } if(PARTIDA.t <= 0){ PARTIDA.fase = 'juego'; if(window.alArrancaRonda) alArrancaRonda(); } }
    else if(PARTIDA.fase === 'juego'){ if(BOMBA.estado !== 'plantada'){ PARTIDA.tiempo -= dt; if(PARTIDA.tiempo <= 0){ finRonda('ct', 'tiempo'); return; } }
      pasarBomba(dt);
      if(BOMBA.estado === 'explotada'){ finRonda('t', 'bomba'); return; } if(BOMBA.estado === 'desactivada'){ finRonda('ct', 'desactivada'); return; }
      if(vivosDe('ct') === 0){ finRonda('t', 'eliminacion'); return; } if(vivosDe('t') === 0 && BOMBA.estado !== 'plantada'){ finRonda('ct', 'eliminacion'); return; } }
    else if(PARTIDA.fase === 'fin'){ pasarBomba(dt); PARTIDA.t -= dt; if(PARTIDA.t <= 0){
      if(PARTIDA.ganadas.t >= PARTIDA.meta || PARTIDA.ganadas.ct >= PARTIDA.meta || PARTIDA.ronda >= PARTIDA.mitad*2){ terminarPartida(); return; }
      if(PARTIDA.ronda === PARTIDA.mitad){ cambiarLados(); } iniciarRonda(); } }
  } else {
    if(PARTIDA.fase === 'juego'){ PARTIDA.tiempo -= dt; for(const a of ACTORES){ if(!a.vivo){ a.reaparece = (a.reaparece || 0) - dt; if(a.reaparece <= 0) reaparecer(a); } }
      if(PARTIDA.tiempo <= 0) terminarPartida(); }
  }
}
function cambiarLados(){
  for(const a of ACTORES){ a.bando = a.bando === 't' ? 'ct' : 't'; a.dinero = ECO.inicio; a.inv = {1:null, 2:null, 3:'cuchillo', 4:[], 5:null}; a.mun = {}; a.blindaje = 0; a.casco = false; a.kit = false; a.vivo = false; }
  const g = PARTIDA.ganadas; PARTIDA.ganadas = {t:g.ct, ct:g.t}; PARTIDA.racha = {t:0, ct:0}; avisar('CAMBIO DE LADO', 3);
}
function terminarPartida(){ PARTIDA.fase = 'terminada'; PARTIDA.fin = true; if(window.alTerminarPartida) alTerminarPartida(); }
/* ---------- deathmatch y carrera de armas ---------- */
function reaparecer(a, primera){
  if(a.esJugador && typeof POST !== 'undefined') POST.adaptYa = true;
  const S = OBRA.spawns.dm.length ? OBRA.spawns.dm : spawnsDe(a.bando === 't' ? 't' : 'ct'); let mejor = S[0], md = -1;
  for(let i=0;i<8;i++){ const s = S[Math.floor(PARTIDA.rnd()*S.length)]; let dmin = 1e9; for(const o of ACTORES) if(o.vivo && o !== a) dmin = Math.min(dmin, Math.hypot(o.c.pos.x - s.x, o.c.pos.z - s.z)); if(dmin > md){ md = dmin; mejor = s; } }
  a.vivo = true; a.vida = 100; a.blindaje = 100; a.casco = true; a.cegado = 0; a.recarga = 0; a.inv = {1:null, 2:null, 3:'cuchillo', 4:[], 5:null}; a.mun = {}; ubicar(a, mejor); personajeDe(a);
  if(PARTIDA.modo === 'armas'){ const id = ESCALERA_ARMAS[Math.min(ESCALERA_ARMAS.length - 1, a.nivel)]; if(id !== 'cuchillo') darArma(a, id, true); equipar(a, id); }
  else { const pri = a.esJugador ? (G.armaDM || 'ak47') : ['ak47', 'm4s', 'ak47', 'awp', 'mp9', 'mac10', 'm4s', 'deagle'][Math.floor(PARTIDA.rnd()*8)]; darArma(a, pri, true); darArma(a, a.id % 2 ? 'usps' : 'glock', true); equipar(a, ARMAS[pri].ranura === 1 ? pri : mejorArma(a)); }
  a.proteccion = primera ? 0 : 1.2;
}
/* ---------- avisos y registro de bajas ---------- */
function avisar(txt, dur, clase){ PARTIDA.avisos.push({txt, t:dur || 2.5, clase:clase || ''}); if(window.hudAviso) hudAviso(txt, dur, clase); }
window.alMatar = function(v, atac, W, cabeza){
  PARTIDA.feed.unshift({atac:atac ? atac.nombre : '', atacB:atac ? atac.bando : '', v:v.nombre, vB:v.bando, arma:W ? (W.id || '') : '', cabeza, t:6, jug:atac === PARTIDA.jugador || v === PARTIDA.jugador}); PARTIDA.feed.length = Math.min(PARTIDA.feed.length, 6);
  if(atac && atac !== v){ atac.bajasRonda = (atac.bajasRonda || 0) + 1;
    if(PARTIDA.modo === 'bomba' && !esAliado(atac, v)){ const pago = W && W.recompensa !== undefined ? W.recompensa : 300; pagar(atac, pago); if(atac.esJugador) avisar('+$' + pago, 1.2, 'dinero'); }
    if(PARTIDA.modo === 'armas' && atac.vivo){ atac.nivel++; if(atac.nivel >= ESCALERA_ARMAS.length){ PARTIDA.ganadorArmas = atac; terminarPartida(); } else { const id = ESCALERA_ARMAS[atac.nivel]; atac.inv[1] = null; atac.inv[2] = null; atac.mun = {}; if(id !== 'cuchillo') darArma(atac, id, true); equipar(atac, id); if(atac.esJugador) avisar(ARMAS[id].nom, 1.6); } }
    if(PARTIDA.modo === 'dm' && atac.bajas >= 25) terminarPartida(); }
  if(PARTIDA.modo !== 'bomba') v.reaparece = 2.2;
  if(window.alMatarHUD) alMatarHUD(v, atac, W, cabeza);
};
window.alPlantar = function(a, s){ pagar(a, ECO.plantar); if(window.musica) musica('mus_bomba'); avisar('BOMBA PLANTADA EN ' + s, 3, 'bomba'); if(window.vozRadio) vozRadio('bomba_plantada'); };
window.alDesactivar = function(a){ avisar('BOMBA DESACTIVADA', 3, 'ct'); };
window.alExplotar = function(){};
/* ---------- compra ---------- */
function enZonaCompra(a){ if(PARTIDA.modo !== 'bomba') return true; for(const z of OBRA.zonas){ if(z.nombre !== 'compra_' + a.bando) continue; if(a.c.pos.x >= z.x0 && a.c.pos.x <= z.x1 && a.c.pos.z >= z.z0 && a.c.pos.z <= z.z1 && a.c.pos.y >= z.y0 && a.c.pos.y <= z.y1) return true; }
  if(!OBRA.zonas.some(z=> z.nombre === 'compra_' + a.bando)){ const S = spawnsDe(a.bando); return S.some(s=> Math.hypot(s.x - a.c.pos.x, s.z - a.c.pos.z) < 9); } return false; }
function puedeComprar(a){ return a.vivo && (PARTIDA.modo !== 'bomba' || (PARTIDA.compraT > 0 && enZonaCompra(a))); }
function precioDe(a, id){ if(id === 'casco') return a.blindaje >= 100 ? 350 : 1000; if(EQUIPO[id]) return EQUIPO[id].precio; return ARMAS[id] ? ARMAS[id].precio : 0; }
function comprar(a, id){
  if(!puedeComprar(a)) return 'fuera'; const W = ARMAS[id], E = EQUIPO[id];
  if(W && W.equipo && W.equipo !== 'ambos' && a.bando !== 'dm' && W.equipo !== a.bando) return 'bando';
  if(id === 'kit' && a.bando !== 'ct') return 'bando';
  const precio = PARTIDA.modo === 'bomba' ? precioDe(a, id) : 0; if(a.dinero < precio) return 'plata';
  if(id === 'kevlar'){ if(a.blindaje >= 100) return 'tiene'; a.blindaje = 100; }
  else if(id === 'casco'){ if(a.blindaje >= 100 && a.casco) return 'tiene'; a.blindaje = 100; a.casco = true; }
  else if(id === 'kit'){ if(a.kit) return 'tiene'; a.kit = true; }
  else if(W){ if(W.ranura === 4){ if(!darArma(a, id)) return 'lleno'; } else { if(a.inv[W.ranura] === id) return 'tiene'; darArma(a, id); equipar(a, id); } }
  else return 'no';
  if(PARTIDA.modo === 'bomba') a.dinero -= precio; if(window.sonar3D && a.esJugador) sonar3D('dinero', a.c.pos, 0.6); return 'ok';
}
/* ---------- el jugador ---------- */
const CAM = {fov:70, fovObj:70, sacudida:0, sacT:0};
function sacudir(p, fuerza){ const j = PARTIDA.jugador; if(!j) return; const d = j.c.pos.distanceTo(p); CAM.sacudida = Math.max(CAM.sacudida, fuerza*Math.max(0, 1 - d/25)*0.035); }
function pasarJugador(a, dt){
  if(!a) return; const W = ARMAS[a.actual];
  if(!a.vivo){ ENT.disparo = false; return; }
  const congelado = PARTIDA.fase === 'congelado';
  /* mirar: mouse/dedo ya sumó en ENT.dYaw/dPitch; el AWP con mira baja la sensibilidad */
  const kMira = a.mira ? (a.mira === 1 ? 0.45 : 0.18) : 1;
  a.yaw += ENT.dYaw*kMira; a.pitch = lim(a.pitch + ENT.dPitch*kMira, -1.53, 1.53); ENT.dYaw = ENT.dPitch = 0;
  /* moverse */
  const vmax = (W && W.vel ? (a.mira && W.velMira ? W.velMira : W.vel) : 250*U)*(congelado ? 0 : 1);
  moverCuerpoSource(a.c, congelado ? {adelante:0, lado:0, saltar:false, agachar:ENT.agachar, caminar:false} : ENT, a.yaw, vmax, dt, null);
  /* armas */
  for(let r=1;r<=5;r++) if(ENT.ranura === r){ const id = ranuraArma(a, r); if(id) equipar(a, id); }
  if(ENT.ultima){ if(a.previo && (a.previo === ranuraArma(a, ARMAS[a.previo].ranura) || a.inv[4].includes(a.previo))) equipar(a, a.previo); ENT.ultima = false; }
  ENT.ranura = 0;
  if(ENT.recargar){ empezarRecarga(a); ENT.recargar = false; }
  if(ENT.inspeccionar){ if(window.vmClip && !VMA.id && a.saca <= 0 && a.recarga <= 0) vmClip('inspeccionar'); ENT.inspeccionar = false; }
  if(ENT.mira && W && W.mira){ a.mira = (a.mira + 1) % 3; ENT.mira = false; if(window.sonar3D) sonar3D('mira_zoom', a.c.pos, 0.4); }
  else if(ENT.mira) ENT.mira = false;
  if(ENT.soltar){ const r = W ? W.ranura : 0; if(r === 1 || r === 2 || r === 5) soltarArma(a, r); ENT.soltar = false; }
  if(!congelado && W){
    if(W.clase === 'cuchillo'){ if(ENT.disparo) cuchillazo(a, false); else if(ENT.secundario) cuchillazo(a, true); }
    else if(W.clase === 'granada'){ /* apretar prepara (saca la anilla), soltar tira */
      if(ENT.disparo || ENT.secundario){ if(!a.prepGranada && a.saca <= 0){ a.prepGranada = ENT.disparo ? 1 : 2; if(window.vmClip) vmClip('preparar'); } }
      else if(a.prepGranada && (!(typeof VMA !== 'undefined' && VMA) || VMA.id !== 'preparar' || VMA.t > 0.5)){ const tipo = a.actual, bajo = a.prepGranada === 2; a.prepGranada = 0; if(window.vmClip) vmClip('lanzar', {alFin:()=>{}}); lanzarGranada(a, tipo, bajo); const sig = a.inv[4].includes(tipo) ? tipo : (a.inv[4][0] || mejorArma(a)); a.saca = 0.45; a.cambioPend = {t:0.38, id:sig}; } }
    else if(W.clase === 'c4'){ if(ENT.disparo) plantarPaso(a, dt); else if(a.plantando > 0){ a.plantando = 0; if(window.vmClip) vmClip('sacar', {dur:0.3}); } }
    else if(ENT.disparo){ const r = disparar(a); if(W.semi && (r || a.cad > 0)) ENT.disparo = false; if(!r && a.mun[a.actual] && a.mun[a.actual].carg === 0 && a.mun[a.actual].res > 0) empezarRecarga(a); }
  }
  /* usar: desactivar, levantar */
  if(ENT.usar && !congelado){ if(!desactivarPaso(a, dt)){ let s0 = null, dm = 1.6; for(const s of SUELTAS){ const d = s.pos.distanceTo(a.c.pos); if(d < dm){ dm = d; s0 = s; } } if(s0){ const W2 = ARMAS[s0.id]; if(W2 && W2.ranura !== 4 && a.inv[W2.ranura] && !s0.esBomba) soltarArma(a, W2.ranura); levantar(a, s0); ENT.usar = false; } } }
  else if(a.desactivando > 0){ a.desactivando = 0; }
  /* pasar por arriba levanta si la ranura está libre */
  for(const s of SUELTAS){ if(!s.quieto) continue; const W2 = ARMAS[s.id]; if(!W2 || W2.ranura === 4) continue; if(s.esBomba ? a.bando === 't' : !a.inv[W2.ranura]) if(s.pos.distanceTo(a.c.pos) < 0.9){ levantar(a, s); break; } }
  pasarActor(a, dt);
}
/* cámara del jugador: ojo, golpe de vista, sacudida, zoom del AWP */
function camaraJugador(a, dt){
  if(!a) return; const ojo = ojoDe(a);
  CAM.sacudida *= Math.exp(-dt*6); CAM.sacT += dt; const s = CAM.sacudida, sx = (Math.sin(CAM.sacT*47) + Math.sin(CAM.sacT*31))*s, sy = (Math.sin(CAM.sacT*53) + Math.cos(CAM.sacT*29))*s;
  cam.position.copy(ojo); cam.rotation.set(a.pitch + a.punch.y + sy, a.yaw + a.punch.x + sx, 0, 'YXZ');
  const W = ARMAS[a.actual]; CAM.fovObj = W && W.mira && a.mira ? W.mira[a.mira - 1] : (G.fov || 74);
  CAM.fov = lerp(CAM.fov, CAM.fovObj, 1 - Math.exp(-dt*(a.mira ? 30 : 14))); if(Math.abs(cam.fov - CAM.fov) > 0.01){ cam.fov = CAM.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  if((typeof VM !== 'undefined' && VM) && VM.raiz) VM.raiz.visible = !(W && W.mira && a.mira) && a.vivo;
}
