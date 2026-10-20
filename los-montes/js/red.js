"use strict";
// ════════════════════════════════════════════════════════════════════════
// Cooperativo en red. Dos caminos, la misma interfaz:
// - En la página publicada en claude.ai: la capacidad "room" (todos los que
//   tienen la página abierta; cada partida es un room con nombre).
// - En el mismo navegador: BroadcastChannel entre pestañas (sirve para jugar
//   de a dos en una compu y para probar).
// Cada jugador manda su estado en "presence" (posición, arma, linterna). El
// anfitrión además manda a los montañeses; los demás los dibujan sin
// pensarlos. Lo raro (daño, objetos, jaulas) viaja como evento.
// ════════════════════════════════════════════════════════════════════════
const Red = (() => {
  let tr = null, activo = false, host = false, sala = "", nombre = "", yoId = Math.random().toString(36).slice(2, 10);
  const remotos = new Map(); let tEnvio = 0, hostPeer = null, estadoRed = { modo: null, jugadores: 1, host: false, sala: "" };
  const TOPICOS = ["herir", "tomar", "liberar", "disparo", "zona"];
  // ── Transporte por pestañas ──
  function transporteLocal(nombreSala) {
    const bc = new BroadcastChannel("losmontes-" + nombreSala), pares = new Map(), oyentesPares = [], oyentes = {};
    let mio = {};
    bc.onmessage = (ev) => {
      const m = ev.data; if (!m || m.de === yoId) return;
      if (m.t === "p") { pares.set(m.de, { peer: m.de, presence: m.p, updatedAt: Date.now() }); for (const f of oyentesPares) f([...pares.values()]); }
      else if (m.t === "e") (oyentes[m.topic] || []).forEach((f) => f({ topic: m.topic, data: m.data, peer: m.de, isMe: false }));
      else if (m.t === "chau") { pares.delete(m.de); for (const f of oyentesPares) f([...pares.values()]); }
    };
    setInterval(() => { for (const [k, p] of pares) if (Date.now() - p.updatedAt > 5000) { pares.delete(k); for (const f of oyentesPares) f([...pares.values()]); } }, 1500);
    addEventListener("beforeunload", () => bc.postMessage({ t: "chau", de: yoId }));
    return {
      presence(patch) { mio = { ...mio, ...patch }; bc.postMessage({ t: "p", de: yoId, p: mio }); return Promise.resolve(); },
      onPeers(f) { oyentesPares.push(f); },
      emit(topic, data) { bc.postMessage({ t: "e", de: yoId, topic, data }); return Promise.resolve(); },
      on(topic, f) { (oyentes[topic] = oyentes[topic] || []).push(f); },
      leave() { bc.postMessage({ t: "chau", de: yoId }); bc.close(); },
    };
  }
  // ── Transporte de claude.ai ──
  async function transporteRoom(nombreSala) {
    if (!window.claude || !window.claude.use) return null;
    const room = await window.claude.use("room"); if (!room) return null;
    const r = room.join ? room.join("montes-" + nombreSala) : room;
    return {
      presence: (p) => r.presence(p).catch(() => {}),
      onPeers: (f) => r.onPeers((pares) => f(pares.filter((p) => !p.isMe || !p.sameTab))),
      emit: (topic, data) => r.emit(topic, data).catch(() => {}),
      on: (topic, f) => r.on(topic, (m) => { if (!m.sameTab) f(m); }),
      leave: () => r.leave && r.leave(),
    };
  }
  async function conectar(modo, nombreSala, miNombre, esHost) {
    salir();
    sala = (nombreSala || "valle").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "valle"; nombre = (miNombre || "").slice(0, 16); host = !!esHost;
    tr = modo === "room" ? await transporteRoom(sala) : transporteLocal(sala);
    if (!tr) { estadoRed = { modo: null, error: "sinRoom" }; return estadoRed; }
    activo = true;
    tr.onPeers((pares) => {
      remotos.forEach((r, k) => { if (!pares.some((p) => p.peer === k)) { quitarRemoto(k); } });
      hostPeer = null;
      for (const p of pares) { const pr = p.presence || {}; if (!pr.j) continue; actualizarRemoto(p.peer, pr); if (pr.h && !host) hostPeer = p.peer; }
      estadoRed.jugadores = 1 + [...remotos.keys()].length; estadoRed.hayHost = host || !!hostPeer;
      Juego.est.red = { ...estadoRed }; Juego.est.jugadoresRed = [...remotos.values()].map((r) => ({ n: r.n, r: r.r }));
    });
    tr.on("herir", (m) => { if (host && m.data) { const e = Enemigos.porId(m.data.id); if (e && !e.muerto) Enemigos.herir(e, Math.min(200, Number(m.data.d) || 0), { x: e.x, z: e.z, remoto: true }); } });
    tr.on("tomar", (m) => { const o = Lugares.objetos[m.data && m.data.i]; if (o && !o.tomado) { o.tomado = true; o.g.visible = false; } });
    tr.on("liberar", (m) => { const s = Aliados.sobrev()[m.data && m.data.i]; if (s && (s.estado === "preso" || s.estado === "atado")) Aliados.liberar(s); });
    tr.on("disparo", (m) => { const r = remotos.get(m.peer); if (r) Sonido.disparo(m.data && m.data.arma || "pistola", r.x, r.y + 1.4, r.z); });
    estadoRed = { modo, sala, host, jugadores: 1 };
    Juego.est.red = { ...estadoRed };
    return estadoRed;
  }
  function salir() { if (tr && tr.leave) tr.leave(); tr = null; activo = false; for (const k of [...remotos.keys()]) quitarRemoto(k); Enemigos.remoto(false); Juego.est.red = null; }
  // ── Jugadores remotos ──
  function actualizarRemoto(id, pr) {
    let r = remotos.get(id);
    if (!r) { const pj = Personajes.crear(pr.r === "medico" ? "medica" : pr.r === "mecanico" ? "mecanico" : "explorador"); Juego.escena.add(pj.grupo); r = { pj, x: 0, z: 0, y: 0, tx: 0, tz: 0, rumbo: 0, n: pr.n || "?", r: pr.r }; remotos.set(id, r); Juego.aviso(T("red.entro", { n: pr.n || "?" }), "info"); }
    const p = pr.p || [0, 0, 0, 0, 0]; r.tx = p[0]; r.tz = p[1]; r.ty = p[2]; r.trumbo = p[3]; r.vel = p[4]; r.zona = pr.z; r.arma = pr.a; r.ag = pr.ag; r.ap = pr.ap; r.lin = pr.l;
    // Si es el anfitrión, trae a los montañeses.
    if (pr.h && !host && pr.e) Enemigos.aplicar(pr.e);
  }
  function quitarRemoto(id) { const r = remotos.get(id); if (!r) return; r.pj.grupo.parent && r.pj.grupo.parent.remove(r.pj.grupo); remotos.delete(id); Juego.aviso(T("red.salio", { n: r.n }), "info"); }
  function actualizar(dt, yo) {
    if (!activo) return;
    // Los montañeses del invitado los piensa el anfitrión.
    Enemigos.remoto(!host && !!hostPeer);
    tEnvio -= dt;
    if (tEnvio <= 0) {
      tEnvio = 0.1;
      const J = Juego.est, pr = { j: 1, n: nombre, r: Juego.opc.rol, p: [+yo.x.toFixed(2), +yo.z.toFixed(2), +yo.y.toFixed(2), +yo.rumbo.toFixed(2), +yo.vel.toFixed(2)], z: yo.zona, a: J.arma, l: J.linterna ? 1 : 0, ag: yo.agacha ? 1 : 0, ap: yo.apunta ? 1 : 0, h: host ? 1 : 0 };
      if (host) pr.e = Enemigos.foto();
      tr.presence(pr);
    }
    for (const r of remotos.values()) {
      r.x = lerp(r.x || r.tx, r.tx, Math.min(1, dt * 10)); r.z = lerp(r.z || r.tz, r.tz, Math.min(1, dt * 10)); r.y = r.ty; r.rumbo = r.rumbo + ang((r.trumbo || 0) - r.rumbo) * Math.min(1, dt * 10);
      r.pj.grupo.visible = r.zona === yo.zona; r.pj.grupo.position.set(r.x, r.y, r.z); r.pj.grupo.rotation.y = r.rumbo;
      Personajes.animar(r.pj, dt, { vel: r.vel || 0, agacha: !!r.ag, apunta: !!r.ap, arma: r.arma });
    }
  }
  function enviar(topic, data) {
    if (!activo || !TOPICOS.includes(topic)) return;
    // El daño de un invitado lo aplica el anfitrión (y el invitado lo ve en la próxima foto).
    tr.emit(topic, data);
  }
  return { conectar, salir, actualizar, enviar, get activo() { return activo; }, get host() { return host; }, remotos: () => remotos, TOPICOS };
})();
