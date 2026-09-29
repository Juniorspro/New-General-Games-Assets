"use strict";
// ════════════════════════════════════════════════════════════════════════
// Sonido con Web Audio. Grabaciones reales (js/sonidos.js, de sonidos/ con
// licencias CC0 y CC-BY) ubicadas en el espacio: la rama que se quiebra a la
// izquierda, la cascada que crece al acercarse. Lo sintetizado queda de
// respaldo mientras se decodifica o para lo que no tiene grabación.
// ════════════════════════════════════════════════════════════════════════
const Sonido = (() => {
  let ctx = null, maestro, efectos, musicaG, ambienteG, ruido, vol = 0.85, volM = 0.6;
  const buf = {}, grupos = {}; let listos = false;
  // Para cada evento, qué grabaciones sirven (la primera que exista; un grupo elige una al azar).
  const CANDIDATOS = {
    viento: ["viento_montana", "viento_pinos", "viento", "viento_campo"], pinos: ["viento_pinos", "ramas_viento"], bosque: ["bosque_noche", "grillos", "noche"], cascada: ["cascada"], rio: ["rio", "rio_rapidos", "agua"],
    lluvia: ["lluvia"], fogata: ["fogata", "fogon"], goteo: ["mina_goteo", "goteo", "cueva_goteo"], eco: ["mina_eco", "eco_mina", "cueva"], generador: ["generador"], interior: ["interior_cabana", "cabana_crujido", "madera_cruje"],
    latido: ["latido"], latido2: ["latido_rapido", "latido"], respiracion: ["respiracion", "respiracion_agitada"], drone1: ["dron_1", "drone_1"], drone2: ["dron_2", "drone_2"], drone3: ["dron_3", "drone_3"], menu: ["tema_menu", "menu_tema", "musica_menu"],
    stinger: ["stinger", "susto", "golpe_susto"], grito_lejano: ["grito_lejano", "grito"], susurro: ["susurro", "susurros"], grito_montanes: ["montanes_grunido", "montanes_grito"], gruñido_bruto: ["montanes_grunido"],
    dolor_montanes: ["montanes_grunido"], grito_lider: ["montanes_grunido"], risa: ["montanes_risa"], silbido: ["silbido_lejano"],
    rama: ["rama", "rama_quiebra"], arbusto: ["arbusto", "hojas"], buho: ["buho"], lobo: ["lobo_lejano", "lobo"], trueno: ["trueno"],
    paso_tierra: ["pasos_tierra", "pasos_barro", "pasos_pasto"], paso_madera: ["pasos_madera"], paso_piedra: ["pasos_piedra"], paso_nieve: ["pasos_nieve"], paso_agua: ["pasos_agua", "agua_chapoteo"], corriendo: ["corriendo_pinos", "pasos_corriendo"],
    aterrizaje: ["aterrizaje"], mochila: ["mochila", "ropa"], linterna: ["linterna_prender", "linterna_clic"], linterna_off: ["linterna_apagar", "linterna_prender"], linterna_bateria: ["linterna_bateria"], tomar: ["recoger", "tomar"], inventario: ["inventario", "mochila"], papel: ["nota_papel", "papel"], cura: ["curarse", "curar"], comer: ["comer_lata", "comer"],
    disparo_pistola: ["disparo_pistola"], disparo_escopeta: ["disparo_escopeta"], disparo_rifle: ["disparo_rifle", "disparo_franco"], recarga_pistola: ["recarga_pistola", "recarga"], recarga_escopeta: ["recarga_escopeta", "recarga"], recarga_rifle: ["recarga_rifle", "recarga"], vacia: ["arma_vacia", "vacia"],
    swing: ["hacha_aire", "swing", "golpe_aire"], hachazo_carne: ["impacto_carne", "golpe_carne", "golpe_dano"], golpe_carne: ["impacto_carne", "golpe_carne", "golpe_dano"], hachazo_madera: ["impacto_madera", "golpe_madera"], puno: ["golpe_carne", "impacto_carne", "golpe_dano"], dano: ["golpe_recibido", "golpe_dano", "dano"], caida_cuerpo: ["caida_cuerpo", "cuerpo_cae", "muerte"], muerte: ["muerte", "caida_cuerpo"],
    puerta: ["puerta_crujido", "puerta_cruje"], puerta_golpe: ["portazo", "puerta_golpe", "puerta_cierra"], puerta_forzar: ["puerta_golpe", "portazo"], ventana: ["ventana_golpe"], trampa: ["trampa_oso", "trampa"], latas: ["latas", "trampa_latas"], cadena: ["cadenas", "cadena"],
    motor_falla: ["motor_no_arranca", "motor_falla"], motor_arranca: ["motor_arranca", "motor_arranque"], motor: ["motor_marcha", "motor_camion", "motor"], puerta_auto: ["puerta_camioneta", "puerta_auto"], bocina: ["bocina_vieja", "bocina"],
    grua: ["grua_bomba", "grua_motor", "hidraulica"], grua_chirrido: ["grua_chirrido", "chirrido"], vagoneta: ["vagoneta"], jaula: ["jaula_abre", "jaula", "reja"], campana: ["campana_alarma", "campana"],
    clic: ["ui_clic", "clic"], confirmar: ["ui_confirmar", "confirmar"], atras: ["ui_atras", "atras", "ui_clic"], titulo: ["titulo", "ui_titulo"], herramienta: ["herramientas", "herramienta", "impacto_metal"], bidon: ["bidon", "liquido"], choque: ["choque", "impacto_metal"],
  };
  const elegido = {};
  function resolver(ev) {
    if (ev in elegido) return elegido[ev];
    for (const c of CANDIDATOS[ev] || [ev]) { if (buf[c] || grupos[c]) return (elegido[ev] = c); }
    return (elegido[ev] = null);
  }
  function b(ev) { const id = resolver(ev); if (!id) return null; const g = grupos[id]; return g ? g[Math.floor(Math.random() * g.length)] : buf[id]; }
  function iniciar() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    maestro = ctx.createGain(); maestro.gain.value = vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; maestro.connect(comp).connect(ctx.destination);
    efectos = ctx.createGain(); efectos.connect(maestro); musicaG = ctx.createGain(); musicaG.gain.value = volM; musicaG.connect(maestro); ambienteG = ctx.createGain(); ambienteG.gain.value = 1; ambienteG.connect(maestro);
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    decodificar();
  }
  // Las grabaciones vienen en base64 adentro de sonidos.js (el descargable anda desde file://).
  function decodificar() {
    const B = typeof SONIDOS_B64 !== "undefined" ? SONIDOS_B64 : null; if (!B) { listos = true; armarLoops(); return; }
    const pend = Object.entries(B).map(([id, b64]) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Promise((ok) => { let hecho = false; const fin = (x) => { if (!hecho) { hecho = true; ok(x); } }; try { const p = ctx.decodeAudioData(u.buffer, fin, () => fin(null)); if (p && p.then) p.then(fin, () => fin(null)); } catch (e) { fin(null); } })
        .then((x) => { if (!x) return; buf[id] = x; const g = id.replace(/_\d+$/, ""); if (g !== id) (grupos[g] = grupos[g] || []).push(x); });
    });
    Promise.all(pend).then(() => { listos = true; for (const k in elegido) delete elegido[k]; armarLoops(); });
  }
  const t0 = () => ctx.currentTime;
  // ── Oyente: la cámara ──
  const V = THREE.Vector3, fw = new V(), up = new V();
  function oyente(cam) {
    if (!ctx) return; const L = ctx.listener, p = cam.position; cam.getWorldDirection(fw); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z; L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fw.x, fw.y, fw.z, up.x, up.y, up.z); }
    ambiente(p);
  }
  function panner(x, y, z, ref = 4, max = 250) {
    const p = ctx.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    return p;
  }
  function tocar(buffer, { v = 0.8, rate = 1, x, y, z, destino, cuando = 0, desde = 0, dur } = {}) {
    if (!ctx || !buffer) return null;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = v;
    let fin = g; if (x !== undefined) { const p = panner(x, y, z); g.connect(p); fin = p; }
    s.connect(g); fin.connect(destino || efectos); s.start(t0() + cuando, desde); if (dur) s.stop(t0() + cuando + dur);
    return { s, g };
  }
  // ── Respaldo sintetizado ──
  function tono(f, dur, { tipo = "sine", v = 0.15, hasta, cuando = 0, destino } = {}) {
    if (!ctx) return; const t = t0() + cuando, o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t); if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(destino || efectos); o.start(t); o.stop(t + dur + 0.05);
  }
  function soplo(desde, hasta, dur, v = 0.3, tipo = "lowpass", { cuando = 0, destino, x, y, z } = {}) {
    if (!ctx) return; const t = t0() + cuando, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipo; f.frequency.setValueAtTime(desde, t); f.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let fin = g; if (x !== undefined) { const p = panner(x, y, z); g.connect(p); fin = p; }
    s.connect(f).connect(g); fin.connect(destino || efectos); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const RESPALDO = {
    rama: (o) => { soplo(3000, 600, 0.08, 0.5, "bandpass", o); soplo(1800, 300, 0.12, 0.35, "bandpass", { ...o, cuando: 0.07 }); },
    disparo_pistola: (o) => { soplo(5000, 300, 0.25, 0.9, "lowpass", o); tono(140, 0.15, { v: 0.5, hasta: 50 }); },
    disparo_escopeta: (o) => { soplo(3500, 150, 0.5, 1, "lowpass", o); tono(90, 0.3, { v: 0.6, hasta: 35 }); },
    disparo_rifle: (o) => { soplo(7000, 180, 0.8, 1, "lowpass", o); tono(80, 0.4, { v: 0.6, hasta: 30 }); },
    swing: (o) => soplo(900, 3000, 0.22, 0.25, "bandpass", o), golpe_carne: (o) => { soplo(400, 80, 0.18, 0.7, "lowpass", o); }, hachazo_carne: (o) => soplo(500, 90, 0.2, 0.8, "lowpass", o), hachazo_madera: (o) => { soplo(1500, 300, 0.12, 0.7, "bandpass", o); tono(220, 0.12, { v: 0.2 }); }, puno: (o) => soplo(350, 80, 0.12, 0.6, "lowpass", o),
    dano: () => { soplo(600, 90, 0.25, 0.8); tono(180, 0.2, { tipo: "sawtooth", v: 0.08, hasta: 90 }); }, muerte: () => { tono(110, 1.4, { tipo: "sawtooth", v: 0.12, hasta: 40 }); soplo(300, 60, 1.2, 0.6); },
    grito_montanes: (o) => { tono(260, 0.9, { tipo: "sawtooth", v: 0.08, hasta: 170 }); soplo(1400, 700, 0.9, 0.3, "bandpass", o); }, gruñido_bruto: (o) => { tono(70, 1.1, { tipo: "sawtooth", v: 0.14, hasta: 55 }); soplo(500, 200, 1, 0.35, "lowpass", o); },
    dolor_montanes: (o) => tono(300, 0.4, { tipo: "sawtooth", v: 0.07, hasta: 180 }), grito_lider: (o) => { tono(180, 1.6, { tipo: "sawtooth", v: 0.12, hasta: 120 }); soplo(900, 300, 1.5, 0.3, "bandpass", o); },
    grito_lejano: (o) => { tono(620, 1.4, { v: 0.05, hasta: 480 }); }, susurro: (o) => soplo(4000, 2500, 1.4, 0.12, "bandpass", o), caida_cuerpo: (o) => soplo(300, 50, 0.4, 0.8, "lowpass", o),
    campana: (o) => { for (let k = 0; k < 6; k++) { tono(620, 1.2, { tipo: "triangle", v: 0.12, cuando: k * 0.7 }); tono(930, 0.9, { v: 0.05, cuando: k * 0.7 }); } },
    trampa: (o) => { soplo(6000, 1500, 0.1, 0.9, "highpass", o); tono(1200, 0.25, { tipo: "square", v: 0.08, hasta: 600 }); },
    puerta: (o) => { tono(180, 0.9, { tipo: "sawtooth", v: 0.03, hasta: 260 }); soplo(700, 200, 0.3, 0.2, "lowpass", { ...o, cuando: 0.6 }); }, puerta_golpe: (o) => soplo(600, 60, 0.45, 0.9, "lowpass", o), puerta_forzar: (o) => soplo(500, 60, 0.5, 1, "lowpass", o),
    linterna: () => tono(2400, 0.03, { tipo: "square", v: 0.05 }), tomar: () => { soplo(2500, 1000, 0.08, 0.2, "bandpass"); }, inventario: () => soplo(1200, 600, 0.2, 0.2, "bandpass"), atras: () => tono(500, 0.05, { tipo: "triangle", v: 0.05 }), clic: () => tono(900, 0.03, { tipo: "triangle", v: 0.06 }), confirmar: () => { tono(660, 0.08, { v: 0.07 }); tono(990, 0.12, { v: 0.07, cuando: 0.08 }); },
    papel: () => soplo(3000, 1500, 0.3, 0.2, "bandpass"), cura: () => soplo(2000, 800, 0.4, 0.15, "bandpass"), comer: () => soplo(1500, 700, 0.3, 0.2, "bandpass"), vacia: () => tono(1800, 0.03, { tipo: "square", v: 0.06 }),
    recarga_pistola: () => { tono(1300, 0.04, { tipo: "square", v: 0.05 }); tono(900, 0.05, { tipo: "square", v: 0.05, cuando: 0.9 }); }, recarga_escopeta: () => tono(700, 0.06, { tipo: "square", v: 0.06 }), recarga_rifle: () => { tono(900, 0.05, { tipo: "square", v: 0.05, cuando: 0.4 }); tono(700, 0.05, { tipo: "square", v: 0.05, cuando: 1.8 }); },
    cadena: () => { for (let k = 0; k < 5; k++) tono(2000 + Math.random() * 800, 0.08, { tipo: "square", v: 0.03, cuando: k * 0.07 }); }, jaula: () => { tono(160, 0.8, { tipo: "sawtooth", v: 0.04, hasta: 220 }); }, herramienta: () => { for (let k = 0; k < 4; k++) tono(2400, 0.05, { tipo: "square", v: 0.04, cuando: k * 0.25 }); },
    motor_arranca: (o) => { soplo(300, 150, 1.4, 0.5, "lowpass", o); }, bocina: (o) => { tono(360, 0.6, { tipo: "square", v: 0.06 }); tono(440, 0.6, { tipo: "square", v: 0.05 }); }, puerta_auto: () => soplo(700, 90, 0.25, 0.7, "lowpass"), choque: () => soplo(900, 60, 0.6, 1, "lowpass"), bidon: () => soplo(800, 300, 0.8, 0.2, "bandpass"),
    stinger: () => { tono(90, 1.5, { tipo: "sawtooth", v: 0.2, hasta: 60 }); soplo(8000, 500, 1, 0.3, "highpass"); }, arma: () => tono(1100, 0.04, { tipo: "square", v: 0.04 }), cama: () => soplo(400, 200, 0.6, 0.2),
  };
  // La misma grabación sirve para varios: el bruto y el líder gruñen más grave.
  const TONO = { "gruñido_bruto": 0.7, grito_lider: 0.82, dolor_montanes: 1.12, grito_montanes: 0.95 };
  function sonar(ev, o = {}) {
    if (!ctx) return;
    const bb = b(ev);
    if (bb) tocar(bb, { v: o.v ?? 0.8, rate: (o.rate ?? 1) * (TONO[ev] || 1) * (0.95 + Math.random() * 0.1), x: o.x, y: o.y, z: o.z });
    else if (RESPALDO[ev]) RESPALDO[ev](o.x !== undefined ? { x: o.x, y: o.y, z: o.z } : {});
  }
  // ── Loops de ambiente: viento, bosque, río y cascadas según dónde estás ──
  const loops = {};
  function loop(ev, destino) {
    const bb = b(ev); if (!bb) return null;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = bb; s.loop = true; g.gain.value = 0;
    s.connect(g).connect(destino || ambienteG); s.start(0, Math.random() * bb.duration); return { s, g };
  }
  function armarLoops() {
    if (!ctx) return;
    for (const k of ["viento", "pinos", "bosque", "rio", "cascada", "fogata", "goteo", "eco", "interior", "latido", "latido2", "respiracion"]) if (!loops[k]) loops[k] = loop(k, ["latido", "latido2", "respiracion"].includes(k) ? efectos : ambienteG);
    for (const k of ["drone1", "drone2", "drone3", "menu"]) if (!loops[k]) loops[k] = loop(k, musicaG);
    // Sin grabaciones: un viento sintetizado.
    if (!loops.viento) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = ruido; s.loop = true; f.type = "lowpass"; f.frequency.value = 420; g.gain.value = 0; s.connect(f).connect(g).connect(ambienteG); s.start(); loops.viento = { s, g }; }
    musica(estadoMusica);
  }
  let zonaAct = "ext", estadoMusica = null, tens = 0, alerta = 0;
  function objetivo(k, v, tt = 0.8) { const L = loops[k]; if (L) L.g.gain.setTargetAtTime(v, t0(), tt); }
  function ambiente(p) {
    if (!ctx || !listos) return;
    const ext = zonaAct === "ext";
    const dc = Math.min(...MAPA.cascadas.map((c) => Math.hypot(c.x - p.x, c.z + 9 - p.z))), dr = Terreno.distRio(p.x, p.z);
    const dF = Math.hypot(MAPA.lugares.campamento.x - p.x, MAPA.lugares.campamento.z - p.z);
    objetivo("viento", ext ? 0.35 + clamp(p.y / 300, 0, 0.4) : zonaAct === "mina" || zonaAct === "cueva" ? 0.04 : 0.1);
    objetivo("pinos", ext ? 0.25 * clamp(Colision.espesura(p.x, p.z, 14) / 20, 0, 1) : 0);
    objetivo("bosque", ext ? 0.3 : 0.05);
    objetivo("rio", ext ? 0.6 * clamp(1 - dr / 70, 0, 1) : 0);
    objetivo("cascada", ext ? 0.9 * clamp(1 - dc / 260, 0, 1) ** 1.5 : zonaAct === "cueva" ? 0.5 : 0);
    objetivo("fogata", ext ? 0.6 * clamp(1 - dF / 35, 0, 1) : 0);
    objetivo("goteo", zonaAct === "mina" || zonaAct === "cueva" ? 0.5 : 0); objetivo("eco", zonaAct === "mina" || zonaAct === "cueva" ? 0.4 : 0);
    objetivo("interior", zonaAct.startsWith("cab") ? 0.35 : 0);
  }
  function zona(z) { zonaAct = z; }
  // ── Música: drones que suben con la tensión; el combate, latido y respiración ──
  function musica(estado) {
    estadoMusica = estado; if (!ctx) return;
    const m = { menu: [0, 0, 0, 1], tension: [0.55, 0.25, 0, 0], combate: [0.3, 0.8, 0.7, 0], alivio: [0.25, 0, 0, 0], final: [0, 0, 0, 0.9] }[estado] || [0, 0, 0, 0];
    objetivo("drone1", m[0], 2); objetivo("drone2", m[1], 1.2); objetivo("drone3", m[2], 1.2); objetivo("menu", m[3], 1.5);
    if (estado === "combate") sonar("stinger", { v: 0.6 });
  }
  function tension(t, a) {
    tens = t; alerta = a; if (!ctx || !listos) return;
    objetivo("latido", a >= 0.99 ? 0 : clamp((a - 0.3) * 1.2 + (t - 0.7) * 0.8, 0, 0.7), 0.6);
    objetivo("latido2", a >= 0.99 ? 0.75 : 0, 0.5);
    objetivo("respiracion", clamp(a - 0.6, 0, 0.5) + (Juego.est.estamina < 25 ? 0.5 : 0), 0.6);
    if (estadoMusica === "tension") objetivo("drone2", clamp(t - 0.5, 0, 0.5) * 0.8, 3);
  }
  // ── Motor de la camioneta y grúa ──
  let motorL = null, gruaL = null;
  function motor(on) { if (!ctx) return; if (on && !motorL) { motorL = loop("motor", efectos); if (motorL) motorL.g.gain.setTargetAtTime(0.5, t0(), 0.3); sonar("motor_arranca", { v: 0.8 }); } else if (!on && motorL) { motorL.g.gain.setTargetAtTime(0, t0(), 0.3); const L = motorL; setTimeout(() => L.s.stop(), 1500); motorL = null; } }
  function motorVel(v, acelera) { if (motorL) { motorL.s.playbackRate.setTargetAtTime(0.75 + v * 0.8, t0(), 0.2); motorL.g.gain.setTargetAtTime(0.35 + (acelera ? 0.25 : 0), t0(), 0.2); } }
  function grua(on) { if (!ctx) return; if (on && !gruaL) { gruaL = loop("grua", efectos); } else if (!on && gruaL) { gruaL.g.gain.setTargetAtTime(0, t0(), 0.2); const L = gruaL; setTimeout(() => L.s.stop(), 800); gruaL = null; } }
  function gruaMueve(m) { if (gruaL) gruaL.g.gain.setTargetAtTime(m ? 0.5 : 0.08, t0(), 0.15); else if (m && ctx && Math.random() < 0.02) sonar("grua_chirrido", { v: 0.3 }); }
  return {
    iniciar, oyente, zona, musica, tension, motor, motorVel, grua, gruaMueve,
    volumen(v, m) { vol = v; volM = m ?? volM; if (maestro) { maestro.gain.value = v; musicaG.gain.value = volM; } },
    pausa(p) { if (ambienteG) ambienteG.gain.setTargetAtTime(p ? 0.15 : 1, t0(), 0.2); },
    golpe(ev, v = 0.8) { sonar(ev, { v }); },
    en(ev, x, y, z, v = 1) { sonar(ev, { x, y, z, v }); },
    disparo(arma, x, y, z) { sonar("disparo_" + arma, x !== undefined ? { x, y, z, v: 1 } : { v: 1 }); },
    paso(sup, v) { sonar("paso_" + sup, { v: v * 0.55, rate: 0.9 + Math.random() * 0.2 }); },
    pasosCorriendo(x0, y, z0, x1, z1) { for (let k = 0; k < 8; k++) { const f = k / 7; setTimeout(() => sonar("paso_tierra", { x: lerp(x0, x1, f), y, z: lerp(z0, z1, f), v: 0.9 }), k * 230); } },
    clic() { iniciar(); sonar("clic", { v: 0.6 }); }, confirmar() { iniciar(); sonar("confirmar", { v: 0.7 }); },
    estado() { return { contexto: !!ctx, grabaciones: Object.keys(buf).length, listos, loops: Object.keys(loops).filter((k) => loops[k]).length }; },
  };
})();
