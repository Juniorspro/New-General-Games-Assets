"use strict";
// ════════════════════════════════════════════════════════════════════════
// LOS MONTES — el juego: bucle, cámara al hombro, jugador, linterna, armas,
// puertas y zonas, objetos, pistas, rescate y escape. Enemigos, aliados,
// camionetas, director de miedo y red viven en sus archivos y se enganchan
// acá. La interfaz (ui.js) lee Juego.est y llama a las acciones.
// ════════════════════════════════════════════════════════════════════════
const ARMAS = {
  mano: { cuerpo: true, dmg: 12, alcance: 1.5, cadencia: 0.6, est: 8 },
  hacha: { cuerpo: true, dmg: 45, alcance: 2.1, cadencia: 0.8, est: 14 },
  pistola: { dmg: 30, cargador: 8, cadencia: 0.3, recarga: 1.5, disp: 0.014, perdigones: 1, ruido: 95, retro: 0.035 },
  escopeta: { dmg: 16, cargador: 4, cadencia: 1.0, recarga: 0.6, porCartucho: true, disp: 0.075, perdigones: 8, ruido: 135, retro: 0.09 },
  rifle: { dmg: 95, cargador: 5, cadencia: 1.25, recarga: 2.4, disp: 0.003, perdigones: 1, ruido: 175, retro: 0.07, zoom: true },
};
const ORDEN_ARMAS = ["mano", "hacha", "pistola", "escopeta", "rifle"];
const ROLES = {
  medico: { curaExtra: 1.6, icono: "✚" }, explorador: { marca: true, icono: "◎" }, combatiente: { dano: 1.25, retro: 0.6, icono: "✦" },
  mecanico: { repara: 2, icono: "⚙" }, superviviente: { estamina: 1.4, bateria: 0.65, icono: "▲" },
};

const Juego = (() => {
  const V = THREE.Vector3;
  const est = {
    modo: "carga", pausado: false, panel: null, vida: 100, estamina: 100, bateria: 100, linterna: true, arma: "mano", cargador: 0, reserva: 0,
    inv: {}, armas: ["mano"], accion: null, progreso: 0, avisos: [], nota: null, objetivo: "", rescatados: 0, aSalvo: 0, total: 6, alerta: 0, marcas: [],
    zona: "ext", manejando: false, grua: false, subtitulo: null, intro: 0, resumen: null, herido: 0, aliados: [], red: null, dano: 0, apuntando: false,
  };
  const subs = new Set(); let ultimoAviso = 0, idAviso = 0;
  function avisar(ya) { const ahora = performance.now(); if (!ya && ahora - ultimoAviso < 110) return; ultimoAviso = ahora; for (const f of subs) f(); }
  function aviso(texto, tipo = "info", seg = 4) { est.avisos = est.avisos.concat({ id: ++idAviso, texto, tipo, hasta: tiempo + seg }).slice(-5); avisar(true); }
  function subtitulo(texto, seg = 4, quien = "") { est.subtitulo = { texto, quien, hasta: tiempo + seg, id: ++idAviso }; avisar(true); }

  let R, escena, cam, lienzo, opc = { ...OPCIONES_BASE }, calidad = "alta", congelado = false, raf = 0, antes = 0, tiempo = 0;
  let linterna, fogonazo, farosPool = [];
  let prota = null, mundoListo = false, datos = null;
  const yo = { x: 0, z: 0, y: 0, vy: 0, rumbo: 0, yaw: 0, pitch: -0.08, zona: "ext", radio: 0.38, vel: 0, velV: new V(), paso: 0, agacha: false, corre: false, apunta: false, golpe: -1, tGolpe: 0, cadencia: 0, recargando: 0, ruido: 0, vivo: true, cargadores: {}, invul: 0, trampa: 0 };
  const entrada = { teclas: {}, mover: [0, 0], mirar: [0, 0], disparar: false, apuntar: false, bloqueado: false };
  let accionLarga = null;

  // ════ Montaje ════
  function montar(canvas, opciones) {
    lienzo = canvas; opc = { ...OPCIONES_BASE, ...opciones }; calidad = opc.calidad;
    R = new THREE.WebGLRenderer({ canvas, antialias: calidad === "alta", powerPreference: "high-performance" });
    R.setPixelRatio(Math.min(devicePixelRatio, { alta: 1.5, media: 1, baja: 0.75 }[calidad]));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.3 * opc.brillo;
    R.shadowMap.enabled = calidad !== "baja"; R.shadowMap.type = THREE.PCFSoftShadowMap;
    escena = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(62, 1, 0.1, 5000);
    const info = Mundo.montar(escena, calidad, R);
    datos = Lugares.montar(escena, calidad);
    // Linterna del protagonista, fogonazo y dos faros de camioneta: siempre existen (la cantidad de luces no cambia).
    linterna = new THREE.SpotLight("#fff4dc", 0, 50, 0.45, 0.45, 1.3); linterna.castShadow = calidad === "alta"; linterna.shadow.mapSize.set(512, 512); linterna.shadow.bias = -0.0008;
    escena.add(linterna, linterna.target);
    fogonazo = new THREE.PointLight("#ffc27a", 0, 14, 2); escena.add(fogonazo);
    for (let i = 0; i < 2; i++) { const L = new THREE.SpotLight("#fff1c8", 0, 50, 0.5, 0.5, 1.4); escena.add(L, L.target); farosPool.push(L); }
    prota = Personajes.crear("prota"); escena.add(prota.grupo);
    Enemigos.montar(escena, datos); Aliados.montar(escena, datos); Vehiculos.montar(escena, datos); Director.montar(escena);
    ajustar(); addEventListener("resize", ajustar);
    configurarEntrada();
    mundoListo = true;
    est.modo = "menu"; avisar(true);
    antes = performance.now(); raf = requestAnimationFrame(bucle);
    return info;
  }
  function ajustar() {
    const w = GIRO.ancho(), h = GIRO.alto();
    R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }

  // ════ Partida ════
  let pistasLeidas = new Set();
  function empezar(opciones) {
    Object.assign(opc, opciones || {});
    const L = MAPA.lugares;
    Object.assign(yo, { x: -48, z: 262, y: 0, yaw: 0, pitch: -0.05, zona: "ext", vivo: true, agacha: false, corre: false, apunta: false, golpe: -1, recargando: 0, invul: 0, trampa: 0 });
    yo.cargadores = { pistola: 0, escopeta: 0, rifle: 0 };
    Object.assign(est, { vida: 100, estamina: 100, bateria: 100, linterna: true, arma: "mano", armas: ["mano"], inv: { municion_pistola: 0, municion_escopeta: 0, municion_rifle: 0, botiquin: 0, venda: 1, bateria: 1, bidon: 0, lata: 1, herramientas: 0, repuesto: 0, rueda: 0 },
      rescatados: 0, aSalvo: 0, avisos: [], nota: null, panel: null, pausado: false, resumen: null, manejando: false, grua: false, zona: "ext", herido: 0, dano: 0, marcas: [] });
    pistasLeidas = new Set();
    for (const o of Lugares.objetos) { o.tomado = false; o.g.visible = true; }
    for (const p of Lugares.pistas) { p.leida = false; p.g.visible = true; }
    est.total = Aliados.reiniciar(opc);
    Enemigos.reiniciar(opc); Vehiculos.reiniciar(); Director.reiniciar(opc);
    const Z = Lugares.zonas.salida; Z.abierta = false; Z.col.activo = true; Z.tq.rotation.y = 0;
    for (const zn in Lugares.zonas) if (Lugares.zonas[zn].grupo) Lugares.zonas[zn].grupo.visible = false;
    for (const c of Lugares.cabanas) { c.int.g.visible = false; c.ext.visible = true; }
    tiempo = 0; est.modo = opc.saltarIntro ? "jugando" : "intro"; est.intro = 0;
    objetivo();
    if (est.modo === "jugando") alEmpezarJuego();
    avisar(true);
  }
  function alEmpezarJuego() {
    Sonido.musica("tension"); pedirPuntero();
    subtitulo(T("dice.llegada"), 6, T("quien.yo"));
  }
  function objetivo() {
    const k = Vehiculos.estadoGrua();
    let o;
    if (est.aSalvo + est.rescatados === 0) o = T("obj.buscar");
    else if (!k.reparada) o = T("obj.reparar", { f: k.faltan.map((x) => T("item." + x)).join(", ") });
    else if (Lugares.obstaculos.some((b) => b.id.startsWith("troncoSalida") && !b.suelto)) o = T("obj.troncos");
    else if (!Lugares.zonas.salida.abierta) o = T("obj.tranquera");
    else o = T("obj.escapar", { n: est.aSalvo + est.rescatados });
    est.objetivo = o;
  }

  // ════ Entrada ════
  function pedirPuntero() { if (!TOCABLE && lienzo && document.pointerLockElement !== lienzo && est.modo === "jugando" && !est.pausado && !est.panel) try { const p = lienzo.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sin captura: se mira arrastrando */ } }
  function configurarEntrada() {
    addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      entrada.teclas[e.code] = true;
      if (est.modo !== "jugando") return;
      const k = e.code;
      if (k === "Escape" || k === "KeyP") { if (est.panel) cerrarPanel(); else pausar(!est.pausado); return; }
      if (est.pausado) return;
      if (k === "Tab" || k === "KeyI") { e.preventDefault(); abrirPanel(est.panel === "inventario" ? null : "inventario"); return; }
      if (k === "KeyM") { abrirPanel(est.panel === "mapa" ? null : "mapa"); return; }
      if (est.panel) return;
      if (est.manejando) {
        // En la camioneta: X baja, G la grúa, F los faros; E es la acción del lugar (en la grúa, enganchar).
        if (k === "KeyX") Vehiculos.bajar(); else if (k === "KeyG") Vehiculos.alternarGrua();
        else if (k === "KeyF" && Vehiculos.manejada) { Vehiculos.manejada.farosPrendidos = !Vehiculos.manejada.farosPrendidos; Sonido.golpe("linterna"); }
        else if (k === "KeyE" && !est.grua) accion(true);
        return;
      }
      if (k === "KeyF") alternarLinterna();
      else if (k === "KeyE") accion(true);
      else if (k === "KeyR") recargar();
      else if (k === "KeyC" || k === "ControlLeft") yo.agacha = !yo.agacha;
      else if (k === "KeyQ") curarse();
      else if (k === "KeyV") golpear();
      else if (k.startsWith("Digit")) { const i = Number(k.slice(5)) - 1; const a = ORDEN_ARMAS[i]; if (a && est.armas.includes(a)) cambiarArma(a); }
      if (["Space", "ArrowUp", "ArrowDown"].includes(k)) e.preventDefault();
    });
    addEventListener("keyup", (e) => { entrada.teclas[e.code] = false; if (e.code === "KeyE") accion(false); });
    lienzo.addEventListener("mousedown", (e) => {
      if (est.modo !== "jugando" || est.pausado || est.panel) return;
      if (!TOCABLE && document.pointerLockElement !== lienzo) { pedirPuntero(); return; }
      if (e.button === 0) { entrada.disparar = true; disparar(); }
      if (e.button === 2) entrada.apuntar = true;
    });
    addEventListener("mouseup", (e) => { if (e.button === 0) entrada.disparar = false; if (e.button === 2) entrada.apuntar = false; });
    lienzo.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("mousemove", (e) => {
      if (est.modo !== "jugando" || est.pausado || est.panel) return;
      if (document.pointerLockElement === lienzo) mirar(e.movementX, e.movementY, 0.0022);
    });
    document.addEventListener("pointerlockchange", () => { if (!document.pointerLockElement && est.modo === "jugando" && !est.panel && !est.pausado && !TOCABLE) pausar(true); });
    addEventListener("wheel", (e) => { if (est.modo !== "jugando" || est.panel) return; const i = est.armas.indexOf(est.arma), n = est.armas.length; cambiarArma(est.armas[(i + (e.deltaY > 0 ? 1 : -1) + n) % n]); });
  }
  function mirar(dx, dy, k) {
    const s = k * opc.sens * (yo.apunta ? 0.55 : 1);
    yo.yaw -= dx * s; yo.pitch = clamp(yo.pitch - dy * s * (opc.invertirY ? -1 : 1), -1.2, 1.0);
  }

  // ════ Acciones del jugador ════
  function alternarLinterna() { if (est.bateria <= 0 && !est.linterna) { aviso(T("av.sinBateria"), "mal"); return; } est.linterna = !est.linterna; Sonido.golpe(est.linterna ? "linterna" : "linterna_off"); avisar(true); }
  function cambiarArma(a) { if (a === est.arma || yo.recargando > 0) return; est.arma = a; Sonido.golpe("arma"); ponerArmaVisible(); avisar(true); }
  function ponerArmaVisible() { const m = est.arma === "mano" ? null : (Modelos.clonar(est.arma) || null); Personajes.ponerArma(prota, m, est.arma); }
  function recargar() {
    const a = ARMAS[est.arma]; if (!a || a.cuerpo || yo.recargando > 0) return;
    const clave = "municion_" + est.arma; if (!est.inv[clave] || yo.cargadores[est.arma] >= a.cargador) { if (!est.inv[clave]) aviso(T("av.sinMunicion"), "mal"); return; }
    yo.recargando = a.recarga * (a.porCartucho ? 1 : 1); Sonido.golpe("recarga_" + est.arma);
  }
  function terminarRecarga() {
    const a = ARMAS[est.arma], clave = "municion_" + est.arma;
    if (a.porCartucho) { if (est.inv[clave] > 0 && yo.cargadores[est.arma] < a.cargador) { est.inv[clave]--; yo.cargadores[est.arma]++; if (est.inv[clave] > 0 && yo.cargadores[est.arma] < a.cargador) { yo.recargando = a.recarga; Sonido.golpe("recarga_escopeta"); } } }
    else { const falta = a.cargador - yo.cargadores[est.arma], pone = Math.min(falta, est.inv[clave]); est.inv[clave] -= pone; yo.cargadores[est.arma] += pone; }
    avisar(true);
  }
  function curarse() {
    if (est.vida >= 100) return;
    const k = est.inv.botiquin > 0 ? "botiquin" : est.inv.venda > 0 ? "venda" : null;
    if (!k) { aviso(T("av.sinCura"), "mal"); return; }
    est.inv[k]--; const extra = opc.rol === "medico" ? ROLES.medico.curaExtra : 1;
    est.vida = Math.min(100, est.vida + (k === "botiquin" ? 60 : 25) * extra); Sonido.golpe("cura"); aviso(T("av.curado"), "bien", 2.5); avisar(true);
  }
  function comer() { if (!est.inv.lata) return; est.inv.lata--; est.estamina = 100; est.vida = Math.min(100, est.vida + 10); Sonido.golpe("comer"); aviso(T("av.comiste"), "bien", 2.5); avisar(true); }
  function usarBateria() { if (!est.inv.bateria) return; est.inv.bateria--; est.bateria = 100; Sonido.golpe("linterna_bateria"); aviso(T("av.bateria"), "bien", 2.5); avisar(true); }

  // Disparo: rayo desde la cámara por el centro de la mira.
  const ray = new THREE.Raycaster(), dir = new V(), org = new V();
  function disparar() {
    if (!yo.vivo || est.manejando || est.grua) return;
    const a = ARMAS[est.arma];
    if (a.cuerpo) { golpear(); return; }
    if (yo.cadencia > 0 || yo.recargando > 0) return;
    if (yo.cargadores[est.arma] <= 0) { Sonido.golpe("vacia"); yo.cadencia = 0.3; if (est.inv["municion_" + est.arma]) recargar(); return; }
    yo.cargadores[est.arma]--; yo.cadencia = a.cadencia;
    const rol = opc.rol === "combatiente" ? ROLES.combatiente : {};
    cam.getWorldDirection(dir); org.copy(cam.position);
    for (let i = 0; i < a.perdigones; i++) {
      const d = dir.clone(), disp = a.disp * (yo.apunta ? 0.6 : 1.4) * (yo.vel > 2 ? 1.8 : 1);
      d.x += (Math.random() - 0.5) * disp * 2; d.y += (Math.random() - 0.5) * disp * 2; d.z += (Math.random() - 0.5) * disp * 2; d.normalize();
      const hit = Enemigos.impacto(org, d, yo.zona, 120);
      const pared = distanciaMundo(org, d, hit ? hit.dist : 120);
      if (hit && hit.dist < pared) Enemigos.herir(hit.e, a.dmg * (hit.cabeza ? 2.6 : 1) * (rol.dano || 1), { x: yo.x, z: yo.z, cabeza: hit.cabeza, arma: est.arma });
      else if (pared < 120) Director.marcaDisparo(org.clone().addScaledVector(d, pared));
    }
    yo.pitch += a.retro * (rol.retro || 1); yo.yaw += (Math.random() - 0.5) * a.retro * 0.5 * (rol.retro || 1);
    fogonazo.intensity = 40; fogonazo.position.copy(prota.grupo.position).add(new V(0, 1.45, 0)).addScaledVector(dir, 0.9);
    Sonido.disparo(est.arma); ruido(yo.x, yo.z, a.ruido, yo.zona, "disparo");
    Red.enviar("disparo", { arma: est.arma });
    avisar(true);
  }
  // ¿A qué distancia el rayo pega contra el suelo o una pared?
  function distanciaMundo(o, d, max) {
    for (let t = 1; t < max; t += 1.2) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (yo.zona === "ext" && y < Terreno.altura(x, z)) return t;
      if (Colision.tapa(o.x, o.z, x, z, yo.zona, ["cabana", "roca", "pared", "camioneta", "arbol"]) && t > 1.5) return t;
    }
    return max;
  }
  function golpear() {
    if (yo.golpe >= 0 || !yo.vivo || est.manejando) return;
    const a = est.arma === "hacha" ? ARMAS.hacha : ARMAS.mano;
    if (est.estamina < a.est) { aviso(T("av.cansado"), "mal", 1.5); return; }
    est.estamina -= a.est; yo.golpe = 0; yo.tGolpe = a.cadencia; yo.golpeHecho = false; Sonido.golpe("swing");
  }
  function resolverGolpe() {
    const a = est.arma === "hacha" ? ARMAS.hacha : ARMAS.mano, rol = opc.rol === "combatiente" ? 1.25 : 1;
    const hit = Enemigos.enArco(yo.x, yo.z, yo.yaw + Math.PI, a.alcance, 0.9, yo.zona);
    for (const e of hit) {
      // Por la espalda y sin que te vea: se termina en un golpe (sigilo).
      const sigilo = est.arma === "hacha" && e.alerta < 0.6 && Math.abs(ang(e.rumbo - (yo.yaw + Math.PI))) < 1.1;
      Enemigos.herir(e, sigilo ? 999 : a.dmg * rol, { x: yo.x, z: yo.z, cuerpo: true, sigilo });
      Sonido.golpe(est.arma === "hacha" ? "hachazo_carne" : "puno");
    }
    if (!hit.length) {
      // Contra un tronco o una puerta.
      if (Colision.tapa(yo.x, yo.z, yo.x - Math.sin(yo.yaw) * 1.6, yo.z - Math.cos(yo.yaw) * 1.6, yo.zona)) Sonido.golpe("hachazo_madera");
    }
    ruido(yo.x, yo.z, 12, yo.zona, "golpe");
  }
  // Ruido: los montañeses oyen y van a ver.
  function ruido(x, z, radio, zona, tipo) { Enemigos.oir(x, z, radio, zona, tipo); yo.ruido = Math.max(yo.ruido, radio); }

  // ════ Interacciones ════
  // Lo más cercano que se puede usar, adelante del jugador.
  function interactuable() {
    if (est.manejando) return Vehiculos.interaccionManejando();
    const cands = [];
    const fx = -Math.sin(yo.yaw), fz = -Math.cos(yo.yaw);
    const cerca = (x, z, r = 2.2) => { const dx = x - yo.x, dz = z - yo.z, d = Math.hypot(dx, dz); if (d > r) return null; const frente = d < 0.8 ? 1 : (dx * fx + dz * fz) / d; return frente > -0.2 ? d - frente * 0.4 : null; };
    for (const p of Lugares.puertas) {
      const enDentro = yo.zona === p.zonaDentro, desde = enDentro ? p.dentro : p;
      if (yo.zona !== (enDentro ? p.zonaDentro : p.zonaFuera)) continue;
      const d = cerca(desde.x, desde.z, enDentro ? 1.8 : 2.4); if (d !== null) cands.push([d, { tipo: "puerta", p, dentro: enDentro, texto: T(enDentro ? "acc.salir" : p.bajo ? "acc.entrarBajo" : p.trabada ? "acc.forzar" : "acc.entrar"), largo: !enDentro && p.trabada ? 2.5 : 0 }]);
    }
    for (const o of Lugares.objetos) { if (o.tomado || o.zona !== yo.zona) continue; const d = cerca(o.x, o.z, 2.0); if (d !== null) cands.push([d, { tipo: "objeto", o, texto: T("acc.tomar", { o: T("item." + (o.tipo === "municion" ? "municion_" + o.arma : o.tipo)) }) }]); }
    for (const p of Lugares.pistas) { if (p.leida || p.zona !== yo.zona) continue; const d = cerca(p.x, p.z, 2.0); if (d !== null) cands.push([d, { tipo: "pista", p, texto: T("acc.leer") }]); }
    for (const c of Aliados.interacciones(yo)) { const d = cerca(c.x, c.z, c.r || 2.3); if (d !== null) cands.push([d, c]); }
    for (const c of Vehiculos.interacciones(yo)) { const d = cerca(c.x, c.z, c.r || 3); if (d !== null) cands.push([d, c]); }
    // La cama del refugio: descansar y guardar.
    const ref = Aliados.refugio(); if (ref && yo.zona === ref.int.zona) { const [bx, bz] = [ref.x + 2.8 * Math.cos(ref.rumbo) - 1.5 * Math.sin(ref.rumbo), ref.z - 2.8 * Math.sin(ref.rumbo) - 1.5 * Math.cos(ref.rumbo)]; const d = cerca(bx, bz, 2.0); if (d !== null) cands.push([d, { tipo: "cama", texto: T("acc.descansar") }]); }
    // La tranquera de salida.
    const S = Lugares.zonas.salida; if (!S.abierta && yo.zona === "ext") { const d = cerca(S.x, S.z, 3.5); if (d !== null) cands.push([d, { tipo: "tranquera", texto: est.inv.herramientas ? T("acc.cadena") : T("acc.cadenaNo"), largo: est.inv.herramientas ? 3 : 0 }]); }
    cands.sort((a, b) => a[0] - b[0]);
    return cands.length ? cands[0][1] : null;
  }
  let actual = null;
  function accion(apretada) {
    if (est.modo !== "jugando" || est.pausado) return;
    if (!apretada) { if (accionLarga) { accionLarga = null; est.progreso = 0; avisar(true); } return; }
    const a = actual || interactuable(); if (!a) return;
    if (a.largo) { accionLarga = { a, t: 0, dur: a.largo / (opc.rol === "mecanico" && a.mecanica ? ROLES.mecanico.repara : 1) }; return; }
    hacer(a);
  }
  function hacer(a) {
    switch (a.tipo) {
      case "puerta": cruzarPuerta(a.p, a.dentro); break;
      case "objeto": tomar(a.o); break;
      case "pista": leerPista(a.p); break;
      case "cama": descansar(); break;
      case "tranquera": if (est.inv.herramientas) abrirTranquera(); else aviso(T("av.faltaHerramienta"), "mal"); break;
      default: if (a.hacer) a.hacer(); break;
    }
    objetivo(); avisar(true);
  }
  function cruzarPuerta(p, dentro) {
    if (!dentro && p.trabada) { p.trabada = false; Sonido.golpe("puerta_forzar"); ruido(p.x, p.z, 30, "ext", "puerta"); }
    Sonido.golpe(p.bajo ? "paso_piedra" : "puerta");
    est.fundido = 1; avisar(true);
    const destino = dentro ? p.fuera : p.dentro, zona = dentro ? p.zonaFuera : p.zonaDentro;
    setZona(zona, p);
    yo.x = destino.x; yo.z = destino.z;
    // La cámara mira hacia (−sen yaw, −cos yaw): cada puerta sabe para dónde queda uno al pasar.
    yo.yaw = dentro ? p.yawFuera : p.yawDentro;
    Aliados.cruzaron(p, dentro);
  }
  function setZona(z, p) {
    yo.zona = z; est.zona = z;
    const Z = Lugares.zonas;
    for (const k in Z) if (Z[k].grupo) Z[k].grupo.visible = k === z;
    for (const c of Lugares.cabanas) { const adentro = c.int.zona === z; c.int.g.visible = adentro; c.ext.visible = !adentro; }
    Sonido.zona(z); Red.enviar("zona", { z });
  }
  function tomar(o) {
    o.tomado = true; o.g.visible = false; Sonido.golpe("tomar");
    let nombre;
    if (ARMAS[o.tipo]) {
      if (!est.armas.includes(o.tipo)) { est.armas = ORDEN_ARMAS.filter((a) => a === o.tipo || est.armas.includes(a)); cambiarArma(o.tipo); }
      if (!ARMAS[o.tipo].cuerpo) { yo.cargadores[o.tipo] += Math.min(o.cant, ARMAS[o.tipo].cargador); est.inv["municion_" + o.tipo] += Math.max(0, o.cant - ARMAS[o.tipo].cargador); }
      nombre = T("item." + o.tipo);
    } else if (o.tipo === "municion") { est.inv["municion_" + o.arma] += o.cant; nombre = T("item.municion_" + o.arma) + " ×" + o.cant; }
    else { est.inv[o.tipo] = (est.inv[o.tipo] || 0) + o.cant; nombre = T("item." + o.tipo); }
    aviso(T("av.tomaste", { o: nombre }), "bien", 2.8);
    Red.enviar("tomar", { i: Lugares.objetos.indexOf(o) });
  }
  function leerPista(p) {
    p.leida = true; p.g.visible = false; pistasLeidas.add(p.id); Sonido.golpe("papel");
    const D = leer("diario", DIARIO_BASE); if (!D.pistas.includes(p.id)) { D.pistas.push(p.id); guardar("diario", D); }
    est.nota = p.id; abrirPanel("nota");
  }
  function descansar() {
    if (Enemigos.cerca(yo.x, yo.z, 40, yo.zona, 0.7)) { aviso(T("av.noDescansar"), "mal"); return; }
    est.vida = Math.min(100, est.vida + 25); est.estamina = 100;
    guardarPartida(); aviso(T("av.guardado"), "bien", 3); Sonido.golpe("cama");
  }
  function abrirTranquera() {
    const S = Lugares.zonas.salida; S.abierta = true; S.col.activo = false; S.tq.rotation.y = -1.4; Sonido.golpe("cadena"); aviso(T("av.tranquera"), "bien");
  }

  // ════ Guardado (en el refugio) ════
  function guardarPartida() {
    const g = { yo: { x: yo.x, z: yo.z, yaw: yo.yaw, zona: yo.zona }, est: { vida: est.vida, bateria: est.bateria, inv: est.inv, armas: est.armas, arma: est.arma }, cargadores: yo.cargadores,
      objetos: Lugares.objetos.map((o) => o.tomado), pistas: [...pistasLeidas], aliados: Aliados.guardar(), vehiculos: Vehiculos.guardar(), enemigos: Enemigos.guardar(), salida: Lugares.zonas.salida.abierta };
    guardar("partida", g);
  }
  function hayGuardada() { const g = leer("partida", {}); return !!g.yo; }
  function continuar(opciones) {
    const g = leer("partida", {}); if (!g.yo) return empezar(opciones);
    empezar({ ...opciones, saltarIntro: true });
    Object.assign(est, g.est); yo.cargadores = g.cargadores; Object.assign(yo, g.yo); setZona(g.yo.zona);
    g.objetos.forEach((t, i) => { const o = Lugares.objetos[i]; if (o && t) { o.tomado = true; o.g.visible = false; } });
    for (const id of g.pistas) { pistasLeidas.add(id); const p = Lugares.pistas.find((q) => q.id === id); if (p) { p.leida = true; p.g.visible = false; } }
    Aliados.cargar(g.aliados); Vehiculos.cargar(g.vehiculos); Enemigos.cargar(g.enemigos);
    if (g.salida) abrirTranquera();
    ponerArmaVisible(); objetivo(); avisar(true);
  }

  // ════ Daño al jugador ════
  function danarJugador(d, desde, tipo) {
    if (!yo.vivo || yo.invul > 0) return;
    const dif = { facil: 0.6, normal: 1, dificil: 1.45 }[opc.dificultad] || 1;
    est.vida -= d * dif; est.dano = 1; yo.invul = 0.35; Sonido.golpe("dano"); Director.susto(0.3);
    if (desde) { yo.x += (yo.x - desde.x) * 0.15; yo.z += (yo.z - desde.z) * 0.15; }
    if (est.vida <= 0) morir(tipo);
    avisar(true);
  }
  function morir(tipo) {
    est.vida = 0; yo.vivo = false; Sonido.golpe("muerte"); Sonido.musica(null);
    const S = leer("stats", STATS_BASE); S.muertes++; guardar("stats", S);
    setTimeout(() => { est.modo = "fin"; est.resumen = resumen(false, tipo); avisar(true); if (document.pointerLockElement) document.exitPointerLock(); }, 2600);
  }
  function resumen(gano, tipo) {
    const S = leer("stats", STATS_BASE), rescatados = gano ? est.aSalvo + Aliados.aBordo() : 0;
    S.partidas++; S.minutos += Math.round(tiempo / 60); S.bajas += Enemigos.bajas(); if (gano) { S.finales++; S.rescatados += rescatados; S.mejorRescate = Math.max(S.mejorRescate, rescatados); }
    guardar("stats", S);
    const D = leer("diario", DIARIO_BASE), todas = D.pistas.length >= 12;
    const final = !gano ? "muerte" : todas && Enemigos.liderMuerto() ? "verdad" : rescatados >= est.total ? "todos" : rescatados > 0 ? "algunos" : "solo";
    return { gano, final, rescatados, total: est.total, bajas: Enemigos.bajas(), pistas: pistasLeidas.size, minutos: Math.round(tiempo / 60), tipo };
  }
  function escapar() {
    est.modo = "fin"; est.resumen = resumen(true); Sonido.musica("final"); if (document.pointerLockElement) document.exitPointerLock(); avisar(true);
  }

  // ════ Paneles y pausa ════
  function abrirPanel(p) { est.panel = p; if (p && document.pointerLockElement) document.exitPointerLock(); if (!p) pedirPuntero(); Sonido.golpe(p ? "inventario" : "atras"); avisar(true); }
  function cerrarPanel() { abrirPanel(null); }
  function pausar(v) { if (est.modo !== "jugando") return; est.pausado = v; if (v && document.pointerLockElement) document.exitPointerLock(); if (!v) pedirPuntero(); Sonido.pausa(v); avisar(true); }
  function aplicarOpciones(o) { Object.assign(opc, o); if (R) R.toneMappingExposure = 1.3 * opc.brillo; Sonido.volumen(opc.volumen, opc.musica); }

  // ════ Bucle ════
  function bucle(ahora) {
    raf = requestAnimationFrame(bucle);
    if (congelado) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
    paso(dt);
  }
  const foco = new V(), camObj = new V(), camMira = new V();
  function paso(dt, dibujar = true) {
    if (!mundoListo) return;
    if (est.modo === "jugando" && !est.pausado && !est.panel) { tiempo += dt; actualizarJugador(dt); Enemigos.actualizar(dt, yo, tiempo); Aliados.actualizar(dt, yo, tiempo); Vehiculos.actualizar(dt, yo, entrada); Director.actualizar(dt, yo, tiempo); Red.actualizar(dt, yo); }
    else if (est.modo === "jugando") { Enemigos.animarQuietos(dt); }
    if (est.modo === "intro") intro(dt); else if (est.modo === "menu" || est.modo === "fin") camaraMenu(dt); else camaraJuego(dt);
    // Mundo, luces y HUD.
    foco.set(yo.x, yo.y, yo.z); if (est.modo !== "jugando") foco.copy(cam.position).add(new V(0, 0, -30).applyQuaternion(cam.quaternion));
    Mundo.actualizar(dt, cam, foco); Sonido.oyente(cam);
    Lugares.actualizar(dt, tiempo + performance.now() / 1000 * 0, cam.position, est.modo === "jugando" ? yo.zona : "ext");
    fogonazo.intensity = Math.max(0, fogonazo.intensity - dt * 400);
    luzLinterna(dt);
    Vehiculos.faros(farosPool);
    const oscuro = yo.zona !== "ext";
    escena.fog.density = oscuro ? 0.035 : { alta: 0.0085, media: 0.0098, baja: 0.0125 }[calidad];
    Mundo.hemi.intensity = oscuro ? 0.08 : Mundo.LUZ.hemi; Mundo.luna.intensity = oscuro ? 0 : Mundo.LUZ.luna;
    if (dibujar) R.render(escena, cam);
    if (est.dano > 0) est.dano = Math.max(0, est.dano - dt * 1.6);
    if (est.fundido > 0) est.fundido = Math.max(0, est.fundido - dt * 2.2);
    est.avisos = est.avisos.filter((a) => a.hasta > tiempo);
    if (est.subtitulo && est.subtitulo.hasta < tiempo) est.subtitulo = null;
    avisar();
  }
  // ── Jugador ──
  const pz = new V();
  function actualizarJugador(dt) {
    if (!yo.vivo) { prota.grupo.position.set(yo.x, yo.y, yo.z); Personajes.animar(prota, dt, { vel: 0, muerto: true }); return; }
    if (est.manejando || est.grua) { prota.grupo.visible = false; actualizarHUD(dt); return; }
    prota.grupo.visible = true;
    const t = entrada.teclas;
    let ax = (t.KeyD || t.ArrowRight ? 1 : 0) - (t.KeyA || t.ArrowLeft ? 1 : 0), az = (t.KeyW || t.ArrowUp ? 1 : 0) - (t.KeyS || t.ArrowDown ? 1 : 0);
    if (entrada.mover[0] || entrada.mover[1]) { ax = entrada.mover[0]; az = -entrada.mover[1]; }
    const n = Math.min(1, Math.hypot(ax, az));
    yo.apunta = (entrada.apuntar || entrada.apuntarTactil) && !ARMAS[est.arma].cuerpo;
    est.apuntando = yo.apunta;
    const rolEst = opc.rol === "superviviente" ? ROLES.superviviente.estamina : 1;
    yo.corre = (t.ShiftLeft || t.ShiftRight || entrada.correr) && n > 0.5 && est.estamina > 3 && !yo.agacha && !yo.apunta;
    if (yo.corre) { est.estamina = Math.max(0, est.estamina - dt * 11 / rolEst); if (yo.agacha) yo.agacha = false; }
    else est.estamina = Math.min(100, est.estamina + dt * (yo.vel < 0.2 ? 20 : 12) * rolEst);
    const herido = est.vida < 35 ? 0.8 : 1, agua = yo.zona === "ext" ? Terreno.enAgua(yo.x, yo.z) : null;
    let vmax = (yo.corre ? 5.2 : yo.agacha ? 1.35 : yo.apunta ? 1.6 : 2.4) * herido * (agua === "rio" ? 0.45 : agua === "vado" ? 0.7 : 1);
    if (yo.trampa > 0) { vmax = 0; yo.trampa -= dt; }
    const s = Math.sin(yo.yaw), c = Math.cos(yo.yaw);
    const mx = -s * az + c * ax, mz = -c * az - s * ax, m = Math.hypot(mx, mz) || 1;
    const objetivoV = n > 0.05 ? vmax * n : 0;
    yo.vel = lerp(yo.vel, objetivoV, Math.min(1, dt * 9));
    if (n > 0.05) { yo.dx = mx / m; yo.dz = mz / m; }
    const px = yo.x, pzz = yo.z;
    if (yo.vel > 0.01 && yo.dx !== undefined) { yo.x += yo.dx * yo.vel * dt; yo.z += yo.dz * yo.vel * dt; }
    // Paredones: por arriba de 45° no se sube (las montañas cierran el valle, y en los
    // peñascos la malla ya no es Terreno.altura). Se resbala por la curva de nivel.
    if (yo.zona === "ext") {
      const gx = (Terreno.altura(yo.x + 1, yo.z) - Terreno.altura(yo.x - 1, yo.z)) / 2, gz = (Terreno.altura(yo.x, yo.z + 1) - Terreno.altura(yo.x, yo.z - 1)) / 2, g = Math.hypot(gx, gz);
      if (g > 1) { const ux = gx / g, uz = gz / g, sube = (yo.x - px) * ux + (yo.z - pzz) * uz; if (sube > 0) { yo.x -= ux * sube; yo.z -= uz * sube; } }
    }
    // Choques y límites.
    pz.set(yo.x, 0, yo.z);
    Colision.resolver(pz, yo.radio, yo.zona, 0); Lugares.restringir(yo.zona, pz, yo.radio);
    Aliados.empujar(pz, yo.radio, yo.zona); Enemigos.empujar(pz, yo.radio, yo.zona);
    yo.x = clamp(pz.x, -760, 760); yo.z = clamp(pz.z, -600, 830);
    // Altura: suelo del valle, piso del puente, o el piso de la zona.
    yo.y = alturaPies(yo.x, yo.z, yo.zona);
    // Rumbo del cuerpo: al apuntar, adonde mira la cámara; si no, adonde camina.
    const quiere = yo.apunta || yo.golpe >= 0 ? yo.yaw + Math.PI : (yo.vel > 0.2 ? Math.atan2(yo.dx, yo.dz) : yo.rumbo);
    yo.rumbo = yo.rumbo + ang(quiere - yo.rumbo) * Math.min(1, dt * (yo.apunta ? 18 : 10));
    // Pasos y ruido.
    const recorrido = Math.hypot(yo.x - px, yo.z - pzz); yo.paso += recorrido;
    const largoPaso = yo.corre ? 1.25 : 0.8;
    if (yo.paso > largoPaso) { yo.paso = 0; Sonido.paso(superficie(), yo.corre ? 1 : yo.agacha ? 0.35 : 0.65); ruido(yo.x, yo.z, yo.corre ? 22 : yo.agacha ? 2.5 : 8, yo.zona, "paso"); }
    yo.ruido = Math.max(0, yo.ruido - dt * 40);
    // Golpe cuerpo a cuerpo.
    if (yo.golpe >= 0) { yo.golpe += dt / yo.tGolpe; if (yo.golpe > 0.42 && !yo.golpeHecho) { yo.golpeHecho = true; resolverGolpe(); } if (yo.golpe >= 1) yo.golpe = -1; }
    if (yo.cadencia > 0) yo.cadencia -= dt;
    if (yo.recargando > 0) { yo.recargando -= dt; if (yo.recargando <= 0) { yo.recargando = 0; terminarRecarga(); } }
    if (entrada.disparar && est.arma === "pistola" && yo.cadencia <= 0 && false) disparar();
    if (yo.invul > 0) yo.invul -= dt;
    // Acción larga (abrir jaulas, reparar, cortar la cadena).
    actual = interactuable(); est.accion = actual ? { texto: actual.texto, largo: !!actual.largo } : null;
    if (accionLarga) {
      if (!actual || actual.tipo !== accionLarga.a.tipo) { accionLarga = null; est.progreso = 0; }
      else { accionLarga.t += dt; est.progreso = accionLarga.t / accionLarga.dur; if (accionLarga.t >= accionLarga.dur) { const a = accionLarga.a; accionLarga = null; est.progreso = 0; hacer(a); } }
    }
    // Personaje.
    prota.grupo.position.set(yo.x, yo.y, yo.z); prota.grupo.rotation.y = yo.rumbo;
    Personajes.animar(prota, dt, { vel: yo.vel, agacha: yo.agacha, apunta: yo.apunta, arma: est.arma, golpe: yo.golpe, herido: est.vida < 35 ? 1 : 0, mira: yo.pitch });
    actualizarHUD(dt);
  }
  function actualizarHUD(dt) {
    // Batería de la linterna.
    if (est.linterna) { est.bateria = Math.max(0, est.bateria - dt * 0.3 * (opc.rol === "superviviente" ? ROLES.superviviente.bateria : 1)); if (est.bateria <= 0) { est.linterna = false; aviso(T("av.sinBateria"), "mal"); } }
    est.cargador = ARMAS[est.arma].cuerpo ? null : yo.cargadores[est.arma]; est.reserva = ARMAS[est.arma].cuerpo ? null : est.inv["municion_" + est.arma];
    est.recargando = yo.recargando > 0; est.alerta = Enemigos.alertaMax(); est.herido = est.vida < 35 ? 1 : 0;
  }
  function alturaPies(x, z, zona) {
    if (zona === "ext") {
      const P = Lugares.zonas.puente; if (P && Math.abs(z - P.z) < P.ancho && Math.abs(x - P.x) < P.medio) return P.y;
      return Math.max(Terreno.altura(x, z), Terreno.enAgua(x, z) ? -0.9 : -99);
    }
    const Z = Lugares.zonas[zona]; return Z.suelo ?? Z.c.y + 0.1;
  }
  function superficie() {
    if (yo.zona === "mina" || yo.zona === "cueva") return "piedra";
    if (yo.zona !== "ext") return "madera";
    const P = Lugares.zonas.puente; if (Math.abs(yo.z - P.z) < P.ancho && Math.abs(yo.x - P.x) < P.medio) return "madera";
    if (Terreno.enAgua(yo.x, yo.z)) return "agua";
    if (yo.y > 200) return "nieve";
    return Terreno.normal(yo.x, yo.z).y < 0.8 ? "piedra" : "tierra";
  }
  // ── Linterna: sale del pecho y apunta adonde mira la cámara ──
  function luzLinterna(dt) {
    const on = est.linterna && est.modo === "jugando" && yo.vivo;
    const titila = est.bateria < 15 ? (Math.random() < 0.08 ? 0.2 : 1) : 1;
    linterna.intensity = on ? 150 * titila * (0.55 + 0.45 * Math.min(1, est.bateria / 30)) : 0;
    if (est.manejando) { linterna.intensity = 0; return; }
    cam.getWorldDirection(dir);
    // Sale 0,8 m adelante del pecho: desde adentro del cuerpo, la sombra del propio
    // protagonista tapaba todo el haz (la luz proyecta sombras).
    const fx = -Math.sin(yo.yaw), fz = -Math.cos(yo.yaw);
    linterna.position.set(yo.x + fx * 0.8, yo.y + 1.35 - (prota.agachado || 0) * 0.4, yo.z + fz * 0.8);
    linterna.target.position.copy(linterna.position).addScaledVector(dir, 12);
  }
  // ── Cámara al hombro ──
  function camaraJuego(dt) {
    if (est.manejando || est.grua) { Vehiculos.camara(cam, dt, yo); return; }
    const ag = (prota.agachado || 0);
    const lejos = yo.apunta ? (est.arma === "rifle" ? 0.9 : 1.45) : 3.5, lado = yo.apunta ? 0.55 : 0.72, alto = (yo.apunta ? 1.58 : 1.8) - ag * 0.45;
    const s = Math.sin(yo.yaw), c = Math.cos(yo.yaw), cp = Math.cos(yo.pitch), sp = Math.sin(yo.pitch);
    // Detrás del hombro derecho.
    let dist = lejos;
    const base = new V(yo.x + c * lado, yo.y + alto, yo.z - s * lado);
    const atras = new V(s * cp, -sp, c * cp);
    // No atravesar paredes ni el suelo: se acerca.
    for (let k = 0; k < 6; k++) {
      const p = base.clone().addScaledVector(atras, dist);
      const suelo = yo.zona === "ext" ? Terreno.altura(p.x, p.z) + 0.3 : (Lugares.zonas[yo.zona].suelo ?? Lugares.zonas[yo.zona].c.y) + 0.3;
      const tapa = Colision.tapa(base.x, base.z, p.x, p.z, yo.zona, ["cabana", "pared", "mueble", "roca", "camioneta"]);
      let fuera = false;
      if (yo.zona !== "ext") { const q = new V(p.x, 0, p.z), q0 = q.clone(); Lugares.restringir(yo.zona, q, 0.25); if (q.distanceTo(q0) > 0.01) fuera = true; if (Lugares.zonas[yo.zona].tipo === "cabana") { const Z = Lugares.zonas[yo.zona], cc = Z.c, dx = p.x - cc.x, dz = p.z - cc.z, lx = dx * Math.cos(cc.rumbo) - dz * Math.sin(cc.rumbo), lz = dx * Math.sin(cc.rumbo) + dz * Math.cos(cc.rumbo); if (Math.abs(lx) > Z.ancho / 2 - 0.3 || Math.abs(lz) > Z.fondo / 2 - 0.3) fuera = true; } }
      if (p.y < suelo || tapa || fuera) dist *= 0.7; else break;
    }
    camObj.copy(base).addScaledVector(atras, dist);
    if (yo.zona !== "ext") { const Z = Lugares.zonas[yo.zona], techo = Z.techo ?? ((Z.suelo ?? 0) + (Z.tipo === "mina" ? 3.0 : 5)); camObj.y = Math.min(camObj.y, techo - 0.25); }
    cam.position.lerp(camObj, 1 - Math.exp(-dt * 24));
    camMira.copy(base).addScaledVector(atras, -8);
    cam.lookAt(camMira);
    const fov = yo.apunta ? (est.arma === "rifle" ? 30 : 48) : 62; if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 10)); cam.updateProjectionMatrix(); }
    // Cabeceo al correr.
    if (yo.corre) cam.position.y += Math.sin(tiempo * 11) * 0.03;
  }
  // ── Cámara del menú: gira despacio sobre el claro, como la referencia ──
  let tMenu = 0;
  function camaraMenu(dt) {
    tMenu += dt;
    const L = MAPA.lugares.claro, a = -0.35 + Math.sin(tMenu * 0.03) * 0.22;
    cam.position.set(L.x + 70 + Math.sin(a) * 40, 20 + Math.sin(tMenu * 0.05) * 2, L.z + 55 + Math.cos(a) * 20);
    cam.lookAt(L.x - 10, 22, -260);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  }
  // ── Intro: sobrevuelo lento de las montañas, baja al claro y termina a espaldas del protagonista ──
  const INTRO = [[40, 330, 780, 60, 220, -700], [60, 230, 500, 0, 150, -500], [20, 150, 150, -80, 60, -300], [-90, 70, -40, -60, 20, 150], [30, 26, 170, -40, 6, 150], [-40, 8, 250, -48, 2, 150], [-48, 2.4, 265.5, -48, 1.8, 250]];
  const INTRO_DUR = 40, INTRO_SUB = [[1, "intro.1"], [8, "intro.2"], [16, "intro.3"], [24, "intro.4"], [31, "intro.5"]];
  function intro(dt) {
    est.intro += dt;
    const t = clamp(est.intro / INTRO_DUR, 0, 1), k = t * (INTRO.length - 1), i = Math.min(INTRO.length - 2, Math.floor(k)), f = k - i, e = f * f * (3 - 2 * f);
    const a = INTRO[i], b = INTRO[i + 1];
    cam.position.set(lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e));
    cam.lookAt(lerp(a[3], b[3], e), lerp(a[4], b[4], e), lerp(a[5], b[5], e));
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    for (const [ts, k2] of INTRO_SUB) if (est.intro - dt < ts && est.intro >= ts) subtitulo(T(k2), 7);
    prota.grupo.position.set(yo.x, Terreno.altura(yo.x, yo.z), yo.z); prota.grupo.rotation.y = Math.PI; Personajes.animar(prota, dt, { vel: t > 0.85 ? 1.2 : 0 });
    if (t > 0.85) yo.z -= dt * 1.2;
    tiempo += dt;
    if (t >= 1) saltarIntro();
  }
  function saltarIntro() { if (est.modo !== "intro") return; est.modo = "jugando"; est.subtitulo = null; yo.yaw = 0; alEmpezarJuego(); avisar(true); }

  // ════ API ════
  return {
    est, yo, montar, empezar, continuar, hayGuardada, saltarIntro, pausar, aplicarOpciones, abrirPanel, cerrarPanel, suscribir(f) { subs.add(f); return () => subs.delete(f); },
    accion, disparar, golpear, recargar, curarse, comer, usarBateria, cambiarArma, alternarLinterna, mirar, entrada, agachar() { yo.agacha = !yo.agacha; avisar(true); },
    danarJugador, ruido, aviso, subtitulo, objetivo, escapar, setZona, alturaPies, get opc() { return opc; }, get tiempo() { return tiempo; }, get cam() { return cam; }, get escena() { return escena; }, get R() { return R; },
    pistasLeidas: () => pistasLeidas, datos: () => datos, prota: () => prota,
    // Para las pruebas: congelar el bucle y avanzar a mano.
    congelar(v) { congelado = v; antes = performance.now(); }, simular(seg, paso1 = 1 / 30) { for (let t = 0; t < seg; t += paso1) paso(paso1, false); R.render(escena, cam); },
  };
})();
const T = (k, v) => t(k, v);
