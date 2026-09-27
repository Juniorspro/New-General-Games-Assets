
/* ====================== montaje del mapa y bucle ====================== */
const J = {modo:'carga', t:0, tt:0, jug:null, mapa:null};
const GRUPO_MAPA = new THREE.Group(); escena.add(GRUPO_MAPA);
function limpiarGrupo(g){ while(g.children.length){ const o = g.children.pop(); o.traverse(x=>{ if(x.geometry) x.geometry.dispose(); }); } }
async function montarMapa(id, construir, op, avance){
  if(typeof POST !== 'undefined') POST.adaptYa = true;
  U_AMB.value = (MAPAS[id] && MAPAS[id].ambiente) || 0.02;
  op = op || {};
  nuevaObra(id); construir(OBRA);
  mundoDesde(OBRA.cajas); orientarSpawns(); armarCaras(); empaquetarAtlas();
  limpiarGrupo(GRUPO_MAPA);
  for(const m of mallasDeCaras()){ const me = new THREE.Mesh(m.geo, matMundo(m.mat)); me.receiveShadow = true; me.castShadow = false; me.matrixAutoUpdate = false; GRUPO_MAPA.add(me); }
  const huella = huellaMapa(), hecho = manDe('luz', id);
  if(!op.rehornear && hecho && hecho.huella === huella && ARCH['luz/' + id] && ARCH['luz/' + id + '_sol'] && await luzDeImagenes('luz/' + id, 'luz/' + id + '_sol')) J.luzHorneada = true;
  else { const res = await hornearLuz(op.calidadLuz || {cielo:10, sol:1, rebote:true, reboteRayos:6}, avance); texDeLuz(res); J.luzHorneada = false; J.ultimoHorneado = res; }
  J.huella = huella;
  /* utilería y calcomanías: después de la luz, porque la toman del mapa de luz */
  for(const m of mallasDeProps()) GRUPO_MAPA.add(m); for(const m of mallasDeCalcos()) GRUPO_MAPA.add(m);
  return OBRA;
}
/* un punto de aparición que mira a una pared o a una pila de cajones (se empuja el stick y no se avanza) se gira hacia donde hay
   más lugar, con preferencia por el centro del mapa; si ya tiene 8 m libres adelante queda como lo puso el mapa */
function libreEn(x, y, z, yaw){ const dx = -Math.sin(yaw), dz = -Math.cos(yaw); let m = 30;
  for(const h of [0.35, 0.9, 1.5]){ const t = rayo(x, y + h, z, dx, 0, dz, 30, F_SOLIDA, false, -1); if(t >= 0) m = Math.min(m, t); } return m; }
/* ¿el cuerpo parado en (x, y, z) se mete en algo sólido? (lo que queda debajo de un escalón no cuenta: se sube solo) */
function chocaEn(x, y, z){ const r = 0.42, M = MUNDO; for(let i=0;i<M.n;i++){ if(!(M.flags[i] & F_SOLIDA)) continue; const o = i*3;
    if(M.mx[o+1] <= y + 0.46 || M.mn[o+1] >= y + 1.75) continue; if(M.mn[o] < x + r && M.mx[o] > x - r && M.mn[o+2] < z + r && M.mx[o+2] > z - r) return true; } return false; }
/* un punto de aparición metido en algo (un cajón puesto encima) se corre al lugar libre más cercano del mismo piso */
function liberarSpawn(s){ if(!chocaEn(s.x, s.y, s.z)) return;
  for(let r=0.25;r<=3.01;r+=0.25) for(let i=0;i<16;i++){ const a = i/16*TAU, x = s.x + Math.cos(a)*r, z = s.z + Math.sin(a)*r; if(chocaEn(x, s.y, z)) continue;
    const t = rayo(x, s.y + 0.5, z, 0, -1, 0, 1.2, F_SOLIDA, false, -1); if(t < 0 || Math.abs(s.y + 0.5 - t - s.y) > 0.5) continue; s.x = x; s.z = z; s.y = s.y + 0.5 - t; return; } }
function orientarSpawns(){
  for(const b of ['ct', 't', 'dm']) for(const s of OBRA.spawns[b]) liberarSpawn(s);
  let cx = 0, cz = 0, n = 0; for(const b of ['ct', 't', 'dm']) for(const s of OBRA.spawns[b]){ cx += s.x; cz += s.z; n++; } if(!n) return; cx /= n; cz /= n;
  for(const b of ['ct', 't', 'dm']) for(const s of OBRA.spawns[b]){
    if(libreEn(s.x, s.y, s.z, s.yaw || 0) >= 8) continue;
    const alCentro = Math.atan2(-(cx - s.x), -(cz - s.z)); let mejor = s.yaw || 0, pm = -1e9;
    for(let i=0;i<32;i++){ const yaw = i/32*TAU, p = Math.min(libreEn(s.x, s.y, s.z, yaw), 20) + 3*Math.cos(yaw - alCentro); if(p > pm){ pm = p; mejor = yaw; } }
    s.yaw = mejor; }
}
function mapaPrueba(){
  piso(-20, -20, 20, 20, 0, 'piso_ext', {texel:0.4});
  muro('x', -20, -20, 20, 0, 4, 0.4, 'chapa_blanca');
  muro('z', 20, -20, 20, 0, 4, 0.4, 'chapa_azul');
  muro('z', -20, -20, 20, 0, 4, 0.4, 'hormigon_pared'); muro('x', 20, -20, 20, 0, 4, 0.4, 'hormigon_pared');
  /* galpón con techo y una puerta */
  muro('x', 2, -12, 4, 0, 5, 0.3, 'pared_verde', [{d0:-6, d1:-3, y0:0, y1:3.2}]);
  muro('x', 12, -12, 4, 0, 5, 0.3, 'pared_verde');
  muro('z', -12, 2, 12, 0, 5, 0.3, 'pared_verde');
  muro('z', 4, 2, 12, 0, 5, 0.3, 'pared_verde', [{d0:5, d1:8, y0:0, y1:3.2}]);
  techo(-12.2, 1.8, 4.2, 12.2, 5, 'techo'); piso(-12, 2, 4, 12, 0.02, 'piso_int', {grosor:0.02});
  lampara(-4, 4.6, 7, '#f4f7ff', 30, 12); lampara(-8, 4.6, 5, '#f4f7ff', 26, 11);
  for(const [x, z, s] of [[-8, 9, 1.2], [-6.8, 9, 1.2], [-8, 9, 1.2]]) bloque(x - s/2, 0, z - s/2, x + s/2, s, z + s/2, 'caja_roja');
  bloque(-8.6, 1.2, 8.4, -7.4, 2.4, 9.6, 'caja_roja');
  for(const [x, z] of [[8, -6], [9.3, -6], [8, -7.3]]) bloque(x - 0.6, 0, z - 0.6, x + 0.6, 1.2, z + 0.6, 'caja_madera');
  bloque(7.4, 1.2, -6.6, 8.6, 2.4, -5.4, 'caja_madera');
  rampa(10, 6, 18, 10, 0, 2.2, 'x+', 'semilla'); bloque(18, 0, 6, 20, 2.2, 14, 'hormigon_pared'); bloque(10, 0, 5.8, 18, 2.2, 6, 'acero_naranja');
  escalera(-18, -8, -14, -6, 0, 2, 'x+', 'hormigon_pared'); bloque(-14, 0, -10, -8, 2, -4, 'hormigon_pared');
  spawn('ct', 0, 0, -14, 0); for(const [x, z] of [[-3, -14], [3, -14]]) spawn('ct', x, 0, z, 0);
  for(const [x, z] of [[0, 14], [-3, 14], [3, 14]]) spawn('t', x, 0, z, Math.PI);
  for(const [x, z, y] of [[-16, -16, 0], [16, -16, 0], [-16, 16, 0], [16, 16, 0], [0, -16, 0], [0, 16, 0], [-16, 0, 0], [16, -2, 0], [-6, 6, 0], [6, 10, 0], [8, -12, 0], [-10, -12, 0]]) spawn('dm', x, y, z, Math.atan2(x, z));
  sitio('A', -12, 2, 4, 12, 0); sitio('B', 8, -10, 16, -2, 0); zona('compra_ct', -6, -18, 6, -10); zona('compra_t', -6, 10, 6, 18);
  /* prueba de utilería y calcomanías */
  calco(0, 0.01, -8, 0, 1, 0, 1.4, 1.4, 'mancha_1'); calco(-12 + 0.16, 1.6, 7, 1, 0, 0, 1.2, 1.2, 'simbolo_radiacion'); calco(0, 1.2, -19.8, 0, 0, 1, 1.6, 1.0, 'grafiti_1');
}
/* PRECALENTAR, mientras está la pantalla de carga: todas las armas armadas (las de los bots y las de primera persona) y sus
   programas de la placa compilados. Si no, el primer cambio a cada arma la construía y compilaba en plena partida: en un teléfono
   flojo, un tirón de decenas de ms la primera vez que un bot saca la AWP o tira una granada */
function precalentar(){
  if(precalentar.hecho) return; precalentar.hecho = true; const t0 = performance.now();
  const g3 = new THREE.Group(), gv = new THREE.Group();
  for(const k in FABRICA){ g3.add(armaTercera(k).g); gv.add(armaVM(k).g); }
  escena.add(g3); escVM.add(gv); gv.position.set(0, -0.2, -0.5);
  /* (compilar no sube las mallas: se dibuja una vez en un búfer de 4×4, sin recortar por la vista, y quedan en la placa) */
  const rt = new THREE.WebGLRenderTarget(4, 4), fc = [];
  for(const g of [g3, gv]) g.traverse(o=>{ if(o.isMesh){ fc.push([o, o.frustumCulled]); o.frustumCulled = false; } });
  try{ ren.compile(escena, cam); ren.compile(escVM, camVM); ren.setRenderTarget(rt); ren.render(escena, cam); ren.render(escVM, camVM); }catch(e){}
  ren.setRenderTarget(null); rt.dispose(); for(const [o, f] of fc) o.frustumCulled = f;
  escena.remove(g3); escVM.remove(gv); for(const o of gv.children.slice()) gv.remove(o);
  window.__C.msPrecalentar = Math.round(performance.now() - t0);
}
let ultimo = 0, acum = 0;
/* luz del arma en primera persona: la del lugar donde está el jugador (sonda del mapa de luz) y el sol en el marco de la cámara */
const _luzJ = {r:0.6, g:0.6, b:0.6, sol:1}, _qCam = new THREE.Quaternion();
function luzVM(dt){
  if(J.t % 6 === 0) luzEn(cam.position.x, cam.position.y - 0.4, cam.position.z, _luzJ);
  const k = 1 - Math.exp(-dt*6), lum = (_luzJ.r + _luzJ.g + _luzJ.b)/3;
  hemiVM.intensity = lerp(hemiVM.intensity, 0.35 + 1.5*Math.min(1.2, lum), k); solVM.intensity = lerp(solVM.intensity, 0.25 + 2.4*_luzJ.sol, k);
  _qCam.copy(cam.quaternion).invert(); solVM.position.copy(SOLDIR).applyQuaternion(_qCam).multiplyScalar(5); solVM.target.position.set(0, 0, 0);
}
/* prueba del arma: tiro, recarga, inspección y cambio (el juego de verdad va en c5d) */
function armaPrueba(p){
  const a = ARMAS[VM.id]; if(!a) return; J.cad = Math.max(0, (J.cad || 0) - DT);
  if(ENT.disparo && a.ciclo && J.cad <= 0 && (!VMA.id || VMA.id === 'disparo' || VMA.id === 'inspeccionar')){ J.cad = a.ciclo;
    vmClip('disparo', {dur:a.clase === 'francotirador' ? 1.46 : Math.min(0.22, a.ciclo*1.8)}); vmRetroceso(a.clase === 'pistola' ? 0.8 : a.clase === 'francotirador' ? 1.8 : 0.6); vmFogonazo(); if(a.semi) ENT.disparo = false; }
  if(teclaPulsada('KeyR') && !VMA.id && a.carg) vmClip('recarga', {dur:a.recarga});
  if(teclaPulsada('KeyF') && !VMA.id) vmClip('inspeccionar');
  for(const [k, id] of [['Digit1', 'ak47'], ['Digit2', 'glock'], ['Digit3', 'cuchillo'], ['Digit4', 'he'], ['Digit5', 'c4'], ['Digit6', 'm4s'], ['Digit7', 'awp'], ['Digit8', 'deagle'], ['Digit9', 'mp9'], ['Digit0', 'mac10']])
    if(teclaPulsada(k) && VM.id !== id) vmSacar(id);
}
/* teclas que son pulsos (no se mantienen) */
window.alTeclear = function(code, abajo){ if(!abajo) return;
  const m = {KeyR:'recargar', KeyF:'inspeccionar', KeyE:'usar', KeyG:'soltar', KeyQ:'ultima'}; if(m[code]) ENT[m[code]] = true;
  const d = {Digit1:1, Digit2:2, Digit3:3, Digit4:4, Digit5:5}; if(d[code]) ENT.ranura = d[code];
  if(code === 'KeyB' && window.abrirCompra) abrirCompra(); if(code === 'Tab' && window.alternarMarcador) alternarMarcador(); };
/* estado que lee el personaje de cada combatiente */
function estadoPers(a){ return {pos:a.c.pos, yaw:a.yaw, vel:a.c.vel, suelo:a.c.enSuelo, agachado:a.c.agachado || 0, apunteYaw:a.yaw, apuntePitch:a.pitch, arma:a.actual, disparo:a.t - a.ultTiro < 0.02,
  recargando:a.recarga > 0, plantando:a.plantando > 0 || a.desactivando > 0, lanzando:!!a.prepGranada, muerto:!a.vivo}; }
/* un paso de la partida */
function pasarJuego(dt){
  const a = PARTIDA.jugador, [f, l] = entradaTeclado();
  if(!ENT.tactil){ ENT.adelante = f; ENT.lado = l; ENT.saltar = teclaPulsada('Space'); ENT.agachar = teclaPulsada('ControlLeft') || teclaPulsada('KeyC'); ENT.caminar = teclaPulsada('ShiftLeft'); if(teclaPulsada('KeyE')) ENT.usar = true; }
  if(J.autopiloto && a && a.vivo){ if(!a.bot) a.bot = botNuevo(a, 'dificil'); } else if(a && a.bot && !J.autopiloto){ a.bot = null; }
  if(a && !a.bot) pasarJugador(a, dt); else if(a && a.bot){ /* el jugador lo maneja un bot (banco) */ }
  pasarBots(dt); pasarPartida(dt);
  pasarGranadas(dt); pasarHumos(dt); pasarSueltas(dt); pasarFX(dt); for(const o of ACTORES) pasosDe(o, dt);
  if(window.personajePose) for(const o of ACTORES) if(o.pers) personajePose(o.pers, estadoPers(o), dt);
  camaraJugador(a, dt);
  if(a){ const giroY = angDif(a.yawV === undefined ? a.yaw : a.yawV, a.yaw)/dt, giroX = (a.pitch - (a.pitchV === undefined ? a.pitch : a.pitchV))/dt; a.yawV = a.yaw; a.pitchV = a.pitch;
    if(a.c.enSuelo && !a.sueloV && a.c.caida > 2) vmAterrizar(a.c.caida); a.sueloV = a.c.enSuelo;
    if(a.vivo) vmCuadro({dt, giroX, giroY, vel:velH(a), suelo:a.c.enSuelo, agachado:a.c.agachado > 0.5}); }
  luzVM(dt); if(window.pasarHUD) pasarHUD(dt);
}
function pasar(){
  J.t++; J.tt += DT;
  if(J.partida){ if(!J.pausa) pasarJuego(DT); return; }
  if(J.modo === 'menu'){ pasarMenu(DT); return; }
  if(J.modo === 'juego' && J.jug){ const p = J.jug, [f, l] = entradaTeclado();
    ENT.adelante = f; ENT.lado = l; ENT.saltar = teclaPulsada('Space'); ENT.agachar = teclaPulsada('ControlLeft') || teclaPulsada('KeyC'); ENT.caminar = teclaPulsada('ShiftLeft');
    p.yaw += ENT.dYaw; p.pitch = lim(p.pitch + ENT.dPitch, -1.53, 1.53); ENT.dYaw = ENT.dPitch = 0;
    moverCuerpoSource(p.c, ENT, p.yaw, 250*U, DT, null);
    const ojo = lerp(MOV.ojo, MOV.ojoAg, p.c.agachado);
    cam.position.set(p.c.pos.x, p.c.pos.y + ojo, p.c.pos.z); cam.rotation.set(p.pitch, p.yaw, 0, 'YXZ'); cam.updateMatrixWorld();
    const giroY = (p.yaw - (p.yawV || p.yaw))/DT, giroX = (p.pitch - (p.pitchV || p.pitch))/DT; p.yawV = p.yaw; p.pitchV = p.pitch;
    if(p.c.enSuelo && !p.sueloV && p.velCaida) vmAterrizar(p.velCaida); p.sueloV = p.c.enSuelo; p.velCaida = -p.c.vel.y;
    armaPrueba(p); vmCuadro({dt:DT, giroX, giroY, vel:Math.hypot(p.c.vel.x, p.c.vel.z), suelo:p.c.enSuelo, agachado:p.c.agachado > 0.5}); luzVM(DT); }
}
function dibujar(){
  cam.updateMatrixWorld();
  cieloMalla.position.copy(cam.position);
  sol.position.copy(cam.position).addScaledVector(SOLDIR, 60); sol.target.position.copy(cam.position); sol.target.updateMatrixWorld();
  revelar(!!VM.arma && VM.raiz.visible);
}
function bucle(ts){
  requestAnimationFrame(bucle);
  if(!ultimo) ultimo = ts; const dt = Math.min(100, ts - ultimo); ultimo = ts;
  acum += dt; let pasos = 0; while(acum >= 1000/60 && pasos < 4){ acum -= 1000/60; pasos++; pasar(); }
  if(!pasos || J.congelarDibujo) return;
  dibujar(); medirCosto(ts);
}
window.__C = {J, MUNDO, CARAS, OBRA:()=> OBRA, LUZ, MATS, cam, escena, ren,
  anda(n){ for(let i=0;i<n;i++) pasar(); return this.est(); }, dibujarYa(){ dibujar(); },
  est(){ const p = J.jug; return p ? {x:+p.c.pos.x.toFixed(2), y:+p.c.pos.y.toFixed(2), z:+p.c.pos.z.toFixed(2), suelo:p.c.enSuelo, vel:+Math.hypot(p.c.vel.x, p.c.vel.z).toFixed(2)} : {}; },
  camara(x, y, z, yaw, pitch){ J.modo = 'libre'; cam.position.set(x, y, z); cam.rotation.set(pitch||0, yaw||0, 0, 'YXZ'); },
  verArma(id, vista, dist){ if(window.__vitrina){ escena.remove(window.__vitrina.g); } const A = FABRICA[id](); window.__vitrina = A; escena.add(A.g);
    if(!window.__luzVitrina){ window.__luzVitrina = new THREE.HemisphereLight(0xdde8ff, 0x55504a, 1.2); escena.add(window.__luzVitrina); }
    cam.fov = 30; cam.updateProjectionMatrix();
    A.g.position.set(0, 1.4, 0); const L = A.d.largo || 0.3, d = (dist || 1.0)*Math.max(0.2, L)/(2*Math.tan(15*GRAD))*1.15;
    const [yaw, pitch, dx, dy, dz] = vista === 'tres' ? [0.62, -0.12, 0.62, 0.14, 0.46] : vista === 'arriba' ? [Math.PI/2, -0.9, 0.35, 0.8, 0] : [Math.PI/2, 0, 1, 0, 0];
    J.modo = 'libre'; cam.position.set(dx*d, 1.4 + dy*d, dz*d - L*0.1); cam.lookAt(0, 1.4, -L*0.1); return {piezas:Object.keys(A.p), enchufes:Object.keys(A.e)}; },
  verVM(id, estilo, vista, poses, ajustes){ J.congelarDibujo = true; vmEstilo(estilo || 'ct');
    if(ajustes){ for(const k in ajustes.mano||{}){ Object.assign(MANO_EN[k], ajustes.mano[k]); delete MANO_EN[k].q; if(ajustes.mano[k].pc) delete MANO_EN[k].p; } for(const k in ajustes.reposo||{}) VM_REPOSO[k] = ajustes.reposo[k]; if(ajustes.hombro) for(const k in ajustes.hombro) HOMBRO[k].fromArray(ajustes.hombro[k]); if(ajustes.pose) for(const k in ajustes.pose) POSE_MANO[k] = ajustes.pose[k]; }
    vmArma(id); camVM.position.set(0, 0, 0); camVM.rotation.set(0, 0, 0); camVM.updateMatrixWorld(true);
    const po = poses || {}; vmPoner(vmReposo(), {def:po.defD}, VM.apoyo ? {def:po.defI} : null, POSE_MANO[po.dedosD || MANO_EN[VM.agarre].pose], VM.apoyo ? POSE_MANO[po.dedosI || MANO_EN[VM.apoyo].pose] : null);
    solVM.position.set(2, 3, 1.5); solVM.target.position.set(0, 0, 0); solVM.intensity = 2.2; hemiVM.intensity = 0.9;
    if(!window.__camDbg) window.__camDbg = new THREE.PerspectiveCamera(40, cam.aspect, 0.01, 20);
    const cd = window.__camDbg; cd.aspect = cam.aspect; cd.updateProjectionMatrix();
    const cen = ajustes && ajustes.cen ? V3().fromArray(ajustes.cen) : V3(0.06, -0.14, -0.28);
    const diag = {movD:+(VM.movD*1000).toFixed(1), movI:+((VM.movI||0)*1000).toFixed(1), curlD:VM.manoD.curl, curlI:VM.apoyo ? VM.manoI.curl : null};
    if(vista === 'fps'){ ren.setRenderTarget(null); ren.setClearColor(0xa9b3be); ren.render(escVM, camVM); return diag; }
    const z = ajustes && ajustes.zoom || 1, vs = {lado:[0.5, 0.02, 0], frente:[0.08, 0.05, -0.55], abajo:[0.12, -0.45, -0.12], izq:[-0.5, 0.05, -0.08], atras:[0.15, 0.2, 0.4], arriba:[0.05, 0.5, 0.05]}[vista] || [0.5, 0, 0];
    cd.position.copy(cen).add(V3(vs[0]*z, vs[1]*z, vs[2]*z)); cd.lookAt(cen); ren.setRenderTarget(null); ren.setClearColor(0xa9b3be); ren.render(escVM, cd); return diag; },
  /* horneado sin conexión: devuelve las dos imágenes del mapa de luz y la huella (banco/hornear.js las guarda en luz/) */
  async hornear(calidad){ const res = await hornearLuz(calidad || {cielo:48, sol:6, rebote:true, reboteRayos:24}, null); texDeLuz(res);
    const png = (d)=>{ const c = document.createElement('canvas'); c.width = res.w; c.height = res.h; const g = c.getContext('2d'), im = g.createImageData(res.w, res.h); im.data.set(d); g.putImageData(im, 0, 0); return c.toDataURL('image/png'); };
    return {w:res.w, h:res.h, huella:J.huella, luz:png(res.px), sol:png(res.ps)}; },
  /* el arma en el juego en el momento t de un clip (pasos fijos de 1/60) */
  vmEn(id, clip, t, estilo){ J.congelarDibujo = true; vmEstilo(estilo || 'ct'); if(VM.id !== id || !VMA.clips) vmSacar(id); VMA.clip = null; VMA.id = ''; VMA.fundido = 0;
    for(let i=0;i<40;i++) vmCuadro({dt:DT}); if(clip){ vmClip(clip, {sinFundido:true}); const n = Math.round(t/DT); for(let i=0;i<n;i++) vmCuadro({dt:DT}); } else vmCuadro({dt:DT});
    luzVM(1); dibujar(); return {clip:VMA.id, t:+VMA.t.toFixed(2), movD:+(VM.movD*1000).toFixed(1), movI:+((VM.movI||0)*1000).toFixed(1)}; },
  /* partida: estado resumido para el banco */
  partida(){ return {modo:PARTIDA.modo, fase:PARTIDA.fase, ronda:PARTIDA.ronda, ganadas:{...PARTIDA.ganadas}, tiempo:+PARTIDA.tiempo.toFixed(1), bomba:BOMBA.estado,
    actores:ACTORES.map(a=> ({n:a.nombre, b:a.bando, vivo:a.vivo, vida:a.vida, k:a.bajas, d:a.muertes, $:a.dinero, arma:a.actual, x:+a.c.pos.x.toFixed(1), z:+a.c.pos.z.toFixed(1), jug:a.esJugador}))}; },
  autopiloto(v){ J.autopiloto = v; },
  listo:false};
(async ()=>{
  aplicarGraficos(); ponerCielo('cielo_nuclear', {az:40, elev:55});
  const t0 = performance.now();
  /* ?mapa=<id> monta uno de MAPAS (c3m.js); ?vitrina=<nombre> llama a window['vitrina_' + nombre]; ?partida=<modo> arranca con bots;
     sin nada: portada con el mapa de fondo */
  const qs = new URLSearchParams(location.search), idMapa = qs.get('mapa'), M = idMapa && window.MAPAS && MAPAS[idMapa], vit = qs.get('vitrina'), prueba = !!(idMapa || vit || qs.get('partida'));
  const barra = f=>{ const b = document.querySelector('#carga .barra2 i'); if(b) b.style.width = Math.round(f*100) + '%'; };
  if(prueba){
    if(M) ponerCielo(M.cielo || 'cielo_nuclear', M.sol || {az:40, elev:55});
    await montarMapa(M ? idMapa : 'prueba', M ? M.construir : mapaPrueba, {rehornear:qs.has('rehornear'), calidadLuz:qs.has('rapido') ? {cielo:4, sol:1, rebote:false} : null}, barra);
    precalentar(); window.__C.msMapa = Math.round(performance.now() - t0); MENU.mapaMontado = M ? idMapa : 'prueba';
    const s = (OBRA.spawns.ct && OBRA.spawns.ct[0]) || (OBRA.spawns.t && OBRA.spawns.t[0]) || {x:0, y:0, z:0, yaw:0}; J.jug = {c:cuerpoNuevo(), yaw:s.yaw, pitch:0}; J.jug.c.pos.set(s.x, s.y + 0.01, s.z); J.modo = 'juego';
    vmEstilo('ct'); vmSacar('glock'); $('carga').style.display = 'none';
    if(vit && window['vitrina_' + vit]) await window['vitrina_' + vit]();
    if(qs.get('partida')){ armarNav(); G.modo = qs.get('partida'); J.partida = true; iniciarPartida({modo:G.modo, bando:qs.get('bando') || 'ct', semilla:+(qs.get('sem') || 7), bots:qs.has('bots') ? +qs.get('bots') : undefined}); if(qs.has('mandos')){ mandosIniciar(); $('mandos').classList.add('ver'); } }
  } else {
    const M0 = MAPAS[G.mapa] || MAPAS.nuclear; ponerCielo(M0.cielo, M0.sol); await montarMapa(M0.id, M0.construir, {}, barra); precalentar(); MENU.mapaMontado = M0.id; window.__C.msMapa = Math.round(performance.now() - t0);
    J.jug = {c:cuerpoNuevo(), yaw:0, pitch:0}; J.modo = 'menu'; $('carga').style.display = 'none'; menusIniciar(); mostrar('capaTitulo'); if(window.musica) musica('mus_menu');
  }
  requestAnimationFrame(bucle); window.__C.listo = true;
})();
