
/* ====================== entrada ======================
   Teclado y mouse (con el puntero trabado) en PC; en el celular, palanca a la izquierda, arrastrar a la derecha para mirar
   y botones. Todo termina en ENT, que el jugador lee en cada paso (los bots escriben en su propia ENT). */
function entradaNueva(){ return {adelante:0, lado:0, saltar:false, agachar:false, caminar:false, disparo:false, secundario:false, recargar:false, usar:false, inspeccionar:false, soltar:false, ranura:0, ultima:false, mira:false, dYaw:0, dPitch:0}; }
const ENT = entradaNueva();
const TECLAS = {};
function teclaPulsada(c){ return !!TECLAS[c]; }
addEventListener('keydown', ev=>{ if(ev.repeat) return; TECLAS[ev.code] = true;
  if(typeof alTeclear === 'function') alTeclear(ev.code, true);
  if(['Space', 'Tab'].includes(ev.code)) ev.preventDefault(); });
addEventListener('keyup', ev=>{ TECLAS[ev.code] = false; if(typeof alTeclear === 'function') alTeclear(ev.code, false); });
addEventListener('blur', ()=>{ for(const k in TECLAS) TECLAS[k] = false; });
let PUNTERO = false;
cv3.addEventListener('mousedown', ev=>{ if(J.modo !== 'juego') return; if(!PUNTERO && cv3.requestPointerLock){ cv3.requestPointerLock(); }
  if(ev.button === 0) ENT.disparo = true; if(ev.button === 2) ENT.secundario = true; });
addEventListener('mouseup', ev=>{ if(ev.button === 0) ENT.disparo = false; if(ev.button === 2) ENT.secundario = false; });
document.addEventListener('pointerlockchange', ()=>{ PUNTERO = document.pointerLockElement === cv3; });
addEventListener('mousemove', ev=>{ if(!PUNTERO) return; const k = 0.0022*sensK(); ENT.dYaw -= ev.movementX*k; ENT.dPitch -= ev.movementY*k; });
addEventListener('contextmenu', ev=> ev.preventDefault());
addEventListener('wheel', ev=>{ if(J.modo === 'juego' && typeof rueda === 'function') rueda(Math.sign(ev.deltaY)); }, {passive:true});
const sensK = ()=> 0.35 + (G.sens || 5)*0.13;
function entradaTeclado(){
  const f = (teclaPulsada('KeyW') || teclaPulsada('ArrowUp') ? 1 : 0) - (teclaPulsada('KeyS') || teclaPulsada('ArrowDown') ? 1 : 0);
  const l = (teclaPulsada('KeyD') || teclaPulsada('ArrowRight') ? 1 : 0) - (teclaPulsada('KeyA') || teclaPulsada('ArrowLeft') ? 1 : 0);
  return [f, l];
}

/* ====================== movimiento estilo Source ======================
   Fricción con velocidad de parada, aceleración en el piso proporcional a la velocidad deseada, aceleración en el aire con
   tope de 30 u/s (así se puede girar en el aire sin ganar velocidad), salto de 302 u/s con gravedad de 800 u/s², escalones
   de 18 u. Agachado mide 54 u y camina al 34 %; con SHIFT se camina al 52 % y los pasos no se oyen. */
function cuerpoNuevo(){ return {pos:V3(0,0,0), vel:V3(0,0,0), ancho:MOV.ancho, alto:MOV.alto, enSuelo:false, agachado:0, agachadoFijo:false, techo:false, saltoSoltado:true, ultSuelo:0, caida:0, tag:1}; }
function acelerar(v, wx, wz, velDeseada, acel, dt, tope){
  const actual = v.x*wx + v.z*wz, deseo = tope !== undefined ? Math.min(velDeseada, tope) : velDeseada, add = deseo - actual;
  if(add <= 0) return; const a = Math.min(acel*dt*velDeseada, add); v.x += a*wx; v.z += a*wz;
}
function friccion(v, dt, k){ const s = Math.hypot(v.x, v.z); if(s < 0.001){ v.x = v.z = 0; return; } const control = Math.max(s, MOV.parada), caida = control*MOV.friccion*(k || 1)*dt, ns = Math.max(0, s - caida)/s; v.x *= ns; v.z *= ns; }
/* e: entrada {adelante, lado, saltar, agachar, caminar}; yaw: hacia dónde mira; velMax: la del arma en la mano */
function moverCuerpoSource(c, e, yaw, velMax, dt, extras){
  /* agacharse: la caja se achica ya; pararse sólo si hay lugar arriba */
  const quiereAg = e.agachar;
  if(quiereAg && c.agachado < 1){ c.agachado = Math.min(1, c.agachado + dt/MOV.tiempoAg); }
  else if(!quiereAg && c.agachado > 0){ const r = c.ancho/2; if(libre(c.pos.x - r, c.pos.y + MOV.altoAg, c.pos.z - r, c.pos.x + r, c.pos.y + MOV.alto, c.pos.z + r, extras)) c.agachado = Math.max(0, c.agachado - dt/MOV.tiempoAg); }
  const altoAntes = c.alto; c.alto = c.agachado > 0.5 ? MOV.altoAg : MOV.alto;
  if(!c.enSuelo && altoAntes > c.alto){ c.pos.y += altoAntes - c.alto; }          /* agacharse en el aire levanta los pies (crouch jump) */
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  let fx = -sn, fz = -cs, rx = cs, rz = -sn;                                       /* adelante = −z girado por yaw; derecha = +x */
  let wx = fx*e.adelante + rx*e.lado, wz = fz*e.adelante + rz*e.lado; const wl = Math.hypot(wx, wz);
  let vd = 0; if(wl > 0.01){ wx /= wl; wz /= wl; vd = velMax*Math.min(1, wl); }
  if(e.caminar) vd *= MOV.caminar; if(c.agachado > 0.5) vd *= MOV.agachado; vd *= c.tag;
  const v = c.vel;
  if(c.enSuelo){
    if(e.saltar && c.saltoSoltado && c.agachado < 1.01){ v.y = MOV.salto; c.enSuelo = false; c.saltoSoltado = false; c.salto = true; }
    else { friccion(v, dt); if(vd > 0) acelerar(v, wx, wz, vd, MOV.acel, dt); v.y = 0; }
  } else if(vd > 0) acelerar(v, wx, wz, vd, MOV.acelAire, dt, MOV.tapaAire);
  if(!e.saltar) c.saltoSoltado = true;
  /* tope de velocidad horizontal (el del arma, un poco de margen para el salto) */
  const sh = Math.hypot(v.x, v.z), tope = Math.max(velMax*1.12, 0.5); if(sh > tope){ v.x *= tope/sh; v.z *= tope/sh; }
  const estabaEnSuelo = c.enSuelo;
  if(!c.enSuelo) v.y -= MOV.grav*dt*0.5;
  moverCuerpo(c, v.x*dt, v.y*dt, v.z*dt, extras);
  if(!c.enSuelo) v.y -= MOV.grav*dt*0.5;
  if(c.chocoX) v.x = 0; if(c.chocoZ) v.z = 0;
  if(c.techo && v.y > 0) v.y = 0;
  /* bajar escalones pegado al piso (si no, se «vuela» al bajar una escalera) */
  if(estabaEnSuelo && !c.enSuelo && v.y <= 0 && !c.salto){ const r = c.ancho/2 - 1e-3, n = solapadas(c.pos.x - r, c.pos.y - MOV.escalon - 0.02, c.pos.z - r, c.pos.x + r, c.pos.y, c.pos.z + r, F_SOLIDA);
    let tope2 = -1e9; for(let k=0;k<n;k++){ const j = SOLAP[k]*3; if(MUNDO.mx[j+1] <= c.pos.y + 1e-3) tope2 = Math.max(tope2, MUNDO.mx[j+1]); }
    if(tope2 > -1e8){ c.pos.y = tope2 + 1e-4; c.enSuelo = true; v.y = 0; } }
  if(c.enSuelo){ if(!estabaEnSuelo){ c.caida = c.velCaida || 0; } c.salto = false; c.ultSuelo = 0; } else { c.ultSuelo += dt; c.velCaida = -v.y; }
  c.tag = Math.min(1, c.tag + dt*1.6);
}
