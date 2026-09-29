"use strict";
// ════════════════════════════════════════════════════════════════════════
// Los montañeses. No todos atacan de entrada: miran desde lejos, siguen
// entre los pinos, apagan luces, ponen trampas. La alerta sube si te ven
// (más con la linterna prendida, menos agachado) o si oyen algo; al llegar
// a 1 te cazan. Los vigías tocan la campana y juntan a los demás.
// ════════════════════════════════════════════════════════════════════════
const Enemigos = (() => {
  const V = THREE.Vector3;
  // vista (m), velocidades (caminar, correr), daño, alcance del golpe, vida.
  const TIPOS = {
    cazador: { modelo: "mont_cazador", vida: 95, vista: 34, vc: 1.3, vr: 4.3, dmg: 22, alcance: 1.9, preparo: 0.5, arma: "machete" },
    rapido: { modelo: "mont_rapido", vida: 48, vista: 40, vc: 1.8, vr: 6.4, dmg: 14, alcance: 1.6, preparo: 0.3, huye: true },
    vigia: { modelo: "mont_vigia", vida: 70, vista: 44, vc: 1.1, vr: 3.4, dmg: 16, alcance: 1.8, preparo: 0.6, campana: true, farol: true },
    bruto: { modelo: "mont_bruto", vida: 340, vista: 26, vc: 1.0, vr: 2.6, carga: 5.8, dmg: 45, alcance: 2.4, preparo: 0.8, pesado: true },
    trampero: { modelo: "mont_trampero", vida: 60, vista: 36, vc: 1.4, vr: 4.6, dmg: 12, alcance: 1.7, preparo: 0.5, trampas: 3 },
    lider: { modelo: "mont_lider", vida: 520, vista: 40, vc: 1.1, vr: 3.6, dmg: 34, alcance: 2.3, preparo: 0.6, jefe: true },
  };
  let escena, datos, lista = [], trampas = [], bajas = 0, liderMuerto = false, opc = {}, esRemoto = false, sigId = 0, sigFantasma = 10000;
  const L = () => MAPA.lugares;
  // Dónde vive cada uno. estado inicial: "quieto" (en su lugar), "patrulla" (ronda) o "vaga" (por el bosque).
  function plan() {
    const l = L(), M = Lugares.MINA, C = Lugares.CUEVA;
    return [
      ["vigia", l.cabanaEste.x + 3, l.cabanaEste.z + 5, "quieto", "ext"],
      ["cazador", l.lagoCabana.x + 12, l.lagoCabana.z + 10, "patrulla", "ext", [[l.lagoCabana.x + 30, l.lagoCabana.z + 20], [l.lagoCabana.x - 25, l.lagoCabana.z + 25], [l.lagoCabana.x, l.lagoCabana.z - 20]]],
      ["trampero", l.mina.x + 25, l.mina.z + 10, "patrulla", "ext", [[l.mina.x + 40, l.mina.z + 30], [l.mina.x + 10, l.mina.z - 25]]],
      ["bruto", M.x + 95, M.z + 45, "quieto", "mina"],
      ["rapido", M.x + 40, M.z - 38, "quieto", "mina"],
      ["rapido", M.x + 60, M.z + 20, "patrulla", "mina", [[M.x + 60, M.z + 5], [M.x + 60, M.z + 40]]],
      ["bruto", l.aserradero.x - 4, l.aserradero.z + 2, "quieto", "ext"],
      ["cazador", l.aserradero.x + 15, l.aserradero.z - 10, "patrulla", "ext", [[l.aserradero.x + 25, l.aserradero.z + 25], [l.aserradero.x - 30, l.aserradero.z + 15]]],
      ["vigia", l.aserradero.x + 10, l.aserradero.z + 16, "quieto", "ext"],
      ["cazador", l.cementerio.x + 4, l.cementerio.z + 2, "quieto", "ext"],
      ["trampero", l.cementerio.x - 20, l.cementerio.z - 20, "vaga", "ext"],
      ["lider", l.campamento.x - 2, l.campamento.z + 3, "quieto", "ext"],
      ["cazador", l.campamento.x + 10, l.campamento.z + 8, "quieto", "ext"],
      ["cazador", l.campamento.x - 12, l.campamento.z - 6, "patrulla", "ext", [[l.campamento.x - 30, l.campamento.z - 30], [l.campamento.x + 30, l.campamento.z - 10]]],
      ["vigia", l.campamento.x + 18, l.campamento.z - 18, "quieto", "ext"],
      ["rapido", l.campamento.x - 20, l.campamento.z + 20, "vaga", "ext"],
      ["rapido", C.x - 4, C.z - 2, "quieto", "cueva"],
      ["cazador", 250, -70, "patrulla", "ext", [[260, -110], [210, -60], [280, -40]]],
      ["rapido", -150, 300, "vaga", "ext"],
      ["cazador", 180, 380, "vaga", "ext"],
      ["rapido", -300, 200, "vaga", "ext"],
    ];
  }
  function montar(esc, d) { escena = esc; datos = d; }
  function limpiar() { for (const e of lista) escena.remove(e.pj.grupo); lista = []; for (const t of trampas) escena.remove(t.g); trampas = []; }
  function crear(tipo, x, z, estado, zona, ruta, extra = {}) {
    const D = TIPOS[tipo], pj = Personajes.crear(D.modelo); escena.add(pj.grupo);
    const dif = { facil: 0.75, normal: 1, dificil: 1.3 }[opc.dificultad] || 1;
    const e = { tipo, D, pj, x, z, y: 0, zona, rumbo: Math.random() * 6.28, vida: D.vida * dif, vidaMax: D.vida * dif, estado, inicial: estado, casa: { x, z }, ruta: ruta || null, iRuta: 0,
      alerta: 0, visto: null, tVisto: 99, obj: { x, z }, tEstado: 0, preparo: -1, cd: 0, vel: 0, muerto: false, tPercibe: Math.random() * 0.2, atascado: 0, px: x, pz: z, trampasPuestas: 0, aparicion: !!extra.aparicion, carga: 0, grito: 0, id: extra.id ?? (extra.aparicion ? sigFantasma++ : sigId++), visible: true };
    e.y = Juego.alturaPies(x, z, zona);
    const zg = zona !== "ext" && Lugares.zonas[zona] && Lugares.zonas[zona].grupo; if (zg) { escena.remove(pj.grupo); zg.add(pj.grupo); }
    if (D.farol) Lugares.farol(0.35, 1.0, 0.25, pj.grupo, 3, zona);
    lista.push(e); return e;
  }
  function reiniciar(o) {
    opc = o || {}; limpiar(); bajas = 0; liderMuerto = false; sigId = 0; sigFantasma = 10000;
    const P = plan(), n = { facil: 0.7, normal: 1, dificil: 1 }[opc.dificultad] || 1;
    P.forEach((p, i) => { if (n < 1 && i % 3 === 2 && p[0] !== "lider" && p[0] !== "bruto") return; crear(p[0], p[1], p[2], p[3], p[4], p[5]); });
  }

  // ════ Percepción ════
  const qv = new V();
  function percibir(e, yo, dt) {
    if (e.zona !== yo.zona || !yo.vivo) { e.ve = false; return; }
    const dx = yo.x - e.x, dz = yo.z - e.z, d = Math.hypot(dx, dz);
    const J = Juego.est;
    let rango = e.D.vista * (J.linterna ? 1.55 : 0.75) * (yo.agacha ? 0.55 : 1) * (yo.corre ? 1.15 : 1);
    if (yo.zona !== "ext") rango *= 0.7;
    if (J.manejando) rango *= 1.8;
    e.ve = false;
    if (d > rango) return;
    const frente = Math.cos(ang(Math.atan2(dx, dz) - e.rumbo));
    if (d > 3.5 && frente < 0.35) return; // fuera del campo visual (~135°)
    if (Colision.tapa(e.x, e.z, yo.x, yo.z, e.zona, ["cabana", "roca", "pared", "camioneta", "mueble"])) return;
    // Entre los pinos se pierde de vista: cuantos más troncos en el medio, menos se ve.
    if (e.zona === "ext" && d > 12) { const tr = Colision.espesura((e.x + yo.x) / 2, (e.z + yo.z) / 2, Math.min(10, d / 2)); if (tr > 10 + (J.linterna ? 8 : 0)) return; }
    e.ve = true;
    const k = (1 - d / rango) * 1.6 + 0.25;
    e.alerta = Math.min(1.2, e.alerta + dt * k * (e.estado === "cazar" ? 3 : 1.2));
    e.visto = { x: yo.x, z: yo.z }; e.tVisto = 0;
  }
  // ════ Movimiento ════
  const pp = new V();
  function mover(e, tx, tz, vel, dt) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { e.vel = lerp(e.vel, 0, dt * 6); return d; }
    let rumbo = Math.atan2(dx, dz);
    // Esquivar: probar el rumbo directo y desvíos, quedarse con el primero libre.
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const r = rumbo + off + (e.desvio || 0); pp.set(e.x + Math.sin(r) * 1.4, 0, e.z + Math.cos(r) * 1.4);
      const ox = pp.x, oz = pp.z; Colision.resolver(pp, 0.4, e.zona); if (e.zona !== "ext") Lugares.restringir(e.zona, pp, 0.4);
      if (Math.hypot(pp.x - ox, pp.z - oz) < 0.15) { rumbo = r; break; }
    }
    e.vel = lerp(e.vel, vel, Math.min(1, dt * 5));
    e.rumbo = e.rumbo + ang(rumbo - e.rumbo) * Math.min(1, dt * 7);
    e.x += Math.sin(e.rumbo) * e.vel * dt; e.z += Math.cos(e.rumbo) * e.vel * dt;
    pp.set(e.x, 0, e.z); Colision.resolver(pp, 0.4, e.zona); if (e.zona !== "ext") Lugares.restringir(e.zona, pp, 0.4);
    for (const o of lista) if (o !== e && !o.muerto && o.zona === e.zona) { const ex = pp.x - o.x, ez = pp.z - o.z, dd = Math.hypot(ex, ez); if (dd < 0.8 && dd > 1e-4) { pp.x = o.x + ex / dd * 0.8; pp.z = o.z + ez / dd * 0.8; } }
    e.x = pp.x; e.z = pp.z;
    return d;
  }
  // Si el jugador se metió en otra zona (cabaña, mina), ir a la puerta.
  function puertaHacia(e, zonaObj) {
    for (const p of Lugares.puertas) {
      if (e.zona === p.zonaFuera && zonaObj === p.zonaDentro) return { x: p.x, z: p.z, p, entra: true };
      if (e.zona === p.zonaDentro && zonaObj !== p.zonaDentro) return { x: p.dentro.x, z: p.dentro.z, p, entra: false };
    }
    return null;
  }
  function cambiarZona(e, zona, x, z) {
    e.zona = zona; e.x = x; e.z = z;
    // Las cabañas no tienen grupo propio (sus enemigos van en el mundo); la mina y la cueva sí.
    const padre = (zona !== "ext" && Lugares.zonas[zona] && Lugares.zonas[zona].grupo) || escena;
    if (e.pj.grupo.parent !== padre) { e.pj.grupo.parent && e.pj.grupo.parent.remove(e.pj.grupo); padre.add(e.pj.grupo); }
  }

  // ════ Decisiones ════
  function decidir(e, yo, dt, t) {
    const D = e.D, J = Juego.est;
    e.tEstado += dt; e.tVisto += dt; if (e.cd > 0) e.cd -= dt;
    if (!e.ve) e.alerta = Math.max(0, e.alerta - dt * (e.estado === "cazar" ? 0.05 : 0.09));
    const dx = yo.x - e.x, dz = yo.z - e.z, d = Math.hypot(dx, dz);
    // Apariciones: se quedan mirando; si la linterna las toca o te acercás, se van entre los árboles.
    if (e.aparicion) {
      e.rumbo = Math.atan2(dx, dz); e.vel = 0;
      const vista = Juego.cam ? Juego.cam.getWorldDirection(qv) : null;
      const alumbra = J.linterna && vista && d < 45 && (vista.x * dx + vista.z * dz) / d < -0.965 + 0 && false;
      const mirando = vista && d < 60 && (-(vista.x * dx + vista.z * dz) / d) > 0.97;
      if (mirando) e.miradas = (e.miradas || 0) + dt;
      if (d < 22 || (e.miradas || 0) > (J.linterna ? 0.7 : 1.8) || e.tEstado > 20 || alumbra) { e.estado = "irse"; e.aparicion = false; e.tEstado = 0; e.obj = { x: e.x - dx / d * 40, z: e.z - dz / d * 40 }; Sonido.en("rama", e.x, e.y + 1, e.z, 0.8); }
      return;
    }
    if (e.estado === "irse") { mover(e, e.obj.x, e.obj.z, D.vr, dt); if (e.tEstado > 5) quitar(e); return; }
    // La alerta cambia el estado.
    if (e.alerta >= 1 && e.estado !== "cazar" && e.estado !== "atacar") {
      e.estado = "cazar"; e.tEstado = 0; e.grito = 1; Sonido.en(D.pesado ? "gruñido_bruto" : "grito_montanes", e.x, e.y + 1.6, e.z, 1);
      Director.combate(1);
      if (D.campana && !e.tocoCampana) tocarCampana(e);
    } else if (e.alerta > 0.35 && ["quieto", "patrulla", "vaga", "acechar"].includes(e.estado)) { e.estado = "investigar"; e.obj = e.visto || e.obj; e.tEstado = 0; }
    switch (e.estado) {
      case "quieto": { e.vel = lerp(e.vel, 0, dt * 4); if (Math.random() < dt * 0.1) e.rumbo += (Math.random() - 0.5) * 1.5; if (Math.hypot(e.x - e.casa.x, e.z - e.casa.z) > 1) mover(e, e.casa.x, e.casa.z, D.vc, dt); break; }
      case "patrulla": { const p = e.ruta[e.iRuta]; if (mover(e, p[0], p[1], D.vc, dt) < 1) { e.iRuta = (e.iRuta + 1) % e.ruta.length; e.cd = 3; } if (e.cd > 0) e.vel = 0; break; }
      case "vaga": { if (!e.obj || Math.hypot(e.obj.x - e.x, e.obj.z - e.z) < 2 || e.tEstado > 30) { const a = Math.random() * 6.28, r = 20 + Math.random() * 60; e.obj = { x: clamp(e.casa.x + Math.cos(a) * r, -600, 600), z: clamp(e.casa.z + Math.sin(a) * r, -380, 700) }; e.tEstado = 0; } mover(e, e.obj.x, e.obj.z, D.vc, dt); break; }
      case "investigar": {
        const hasta = mover(e, e.obj.x, e.obj.z, D.vc * 1.4, dt);
        if (hasta < 2 || e.tEstado > 20) { e.estado = "buscar"; e.tEstado = 0; }
        break;
      }
      case "acechar": {
        // Seguir a 25–40 m, entre los árboles, sin dejarse ver mucho. Quebrar ramas.
        const r = 30, lx = yo.x - dx / d * r + Math.sin(t * 0.3 + e.id) * 10, lz = yo.z - dz / d * r + Math.cos(t * 0.3 + e.id) * 10;
        mover(e, lx, lz, d > 45 ? D.vr * 0.7 : D.vc * 1.2, dt);
        if (Math.random() < dt * 0.08) Sonido.en("rama", e.x, e.y + 0.3, e.z, 0.9);
        if (D.trampas && e.trampasPuestas < D.trampas && Math.random() < dt * 0.05 && yo.vel > 0.5) ponerTrampa(e, yo);
        if (e.tEstado > 90 || d > 110) { e.estado = e.inicial === "quieto" ? "volver" : e.inicial; e.tEstado = 0; }
        break;
      }
      case "cazar": {
        let tx = e.visto ? e.visto.x : yo.x, tz = e.visto ? e.visto.z : yo.z;
        if (yo.zona !== e.zona && e.tVisto < 6) { const p = puertaHacia(e, yo.zona); if (p) { tx = p.x; tz = p.z; if (Math.hypot(e.x - p.x, e.z - p.z) < 1.5) { if (p.entra) cambiarZona(e, p.p.zonaDentro, p.p.dentro.x, p.p.dentro.z); else cambiarZona(e, p.p.zonaFuera, p.p.fuera.x, p.p.fuera.z); Sonido.en("puerta", e.x, e.y + 1, e.z, 1); } } }
        // El rápido rodea; el bruto carga en línea recta.
        if (D.huye && d > 6) { const lado = Math.sin(t * 1.3 + e.id) * 6; tx += -dz / d * lado; tz += dx / d * lado; }
        let vel = D.vr * (yo.zona !== "ext" ? 0.8 : 1);
        if (D.carga) { if (e.carga > 0) { e.carga -= dt; vel = D.carga; } else if (e.cd <= 0 && d < 16 && d > 5 && e.ve) { e.carga = 1.8; e.cd = 5; Sonido.en("gruñido_bruto", e.x, e.y + 2, e.z, 1); } }
        const hasta = mover(e, tx, tz, vel, dt);
        if (d < D.alcance && e.zona === yo.zona && e.cd <= 0.01 && !D.carga) { e.estado = "atacar"; e.preparo = 0; e.tEstado = 0; }
        if (D.carga && d < D.alcance && e.zona === yo.zona) { e.estado = "atacar"; e.preparo = 0; e.tEstado = 0; e.carga = 0; }
        if (e.tVisto > 10 && hasta < 2) { e.estado = "buscar"; e.tEstado = 0; e.alerta = 0.7; }
        if (D.jefe && e.vida < e.vidaMax * 0.5 && !e.llamo) { e.llamo = true; for (let k = 0; k < 2; k++) { const a = Math.random() * 6.28; const n = crear("cazador", e.x + Math.cos(a) * 45, e.z + Math.sin(a) * 45, "cazar", e.zona); n.alerta = 1.1; n.visto = { x: yo.x, z: yo.z }; } Sonido.en("grito_lider", e.x, e.y + 2, e.z, 1); Juego.subtitulo(T("dice.lider"), 4, T("quien.lider")); }
        break;
      }
      case "atacar": {
        e.vel = lerp(e.vel, 0, dt * 8); e.rumbo = e.rumbo + ang(Math.atan2(dx, dz) - e.rumbo) * Math.min(1, dt * 8);
        e.preparo += dt / D.preparo;
        if (e.preparo >= 1 && !e.pego) { e.pego = true; if (d < D.alcance + 0.4 && e.zona === yo.zona) { Juego.danarJugador(D.dmg, { x: e.x, z: e.z }, e.tipo); Sonido.en("golpe_carne", yo.x, yo.y + 1.2, yo.z, 1); } else Sonido.en("swing", e.x, e.y + 1.3, e.z, 0.8); }
        if (e.preparo >= 1.6) { e.preparo = -1; e.pego = false; e.cd = D.huye ? 2.5 : 0.9 + Math.random() * 0.6; e.estado = "cazar"; if (D.huye) { e.desvio = (Math.random() < 0.5 ? 1 : -1) * 1.2; setTimeout(() => (e.desvio = 0), 1800); } }
        break;
      }
      case "buscar": {
        if (!e.obj || Math.hypot(e.obj.x - e.x, e.obj.z - e.z) < 2) { const a = Math.random() * 6.28, base = e.visto || e.casa; e.obj = { x: base.x + Math.cos(a) * 14, z: base.z + Math.sin(a) * 14 }; }
        mover(e, e.obj.x, e.obj.z, D.vc * 1.3, dt);
        if (e.tEstado > 25) { e.estado = "volver"; e.tEstado = 0; e.alerta = 0; Director.combate(0); }
        break;
      }
      case "volver": {
        if (mover(e, e.casa.x, e.casa.z, D.vc, dt) < 1.5 || e.tEstado > 60) { e.estado = e.inicial; e.tEstado = 0; }
        break;
      }
    }
  }
  function tocarCampana(e) {
    e.tocoCampana = true; Sonido.en("campana", e.x, e.y + 2, e.z, 1.2); Juego.aviso(T("av.campana"), "mal", 4);
    for (const o of lista) if (!o.muerto && o !== e && o.zona === e.zona && Math.hypot(o.x - e.x, o.z - e.z) < 160) { o.alerta = Math.max(o.alerta, 0.8); o.estado = "investigar"; o.obj = e.visto ? { ...e.visto } : { x: e.x, z: e.z }; o.tEstado = 0; }
    // Apaga las luces de la cabaña más cercana: que no se vea nada.
    let mejor = null, dm = 1e9; for (const c of Lugares.cabanas) { const d = Math.hypot(c.x - e.x, c.z - e.z); if (d < dm && !c.apagada) { dm = d; mejor = c; } }
    if (mejor && dm < 60) setTimeout(() => Lugares.apagarCabana(mejor), 2500);
  }
  function ponerTrampa(e, yo) {
    // Adelante del jugador, en el camino que trae.
    const x = yo.x + (yo.dx || 0) * 14, z = yo.z + (yo.dz || 0) * 14; if (Terreno.enAgua(x, z)) return;
    const m = Modelos.clonar("trampa_oso") || (() => { const g = new THREE.Group(); for (const s of [-1, 1]) { const q = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 4, 10, Math.PI), Lugares.M.alambre); q.rotation.x = -Math.PI / 2; q.rotation.z = s > 0 ? 0 : Math.PI; q.position.y = 0.04; g.add(q); } return g; })();
    m.position.set(x, Terreno.altura(x, z) + 0.02, z); escena.add(m);
    trampas.push({ x, z, g: m, activa: true }); e.trampasPuestas++;
  }
  function trampasJugador(yo) {
    for (const t of trampas) {
      if (!t.activa || yo.zona !== "ext") continue;
      if (Math.hypot(t.x - yo.x, t.z - yo.z) < 0.55) { t.activa = false; t.g.scale.y = 1.8; yo.trampa = 2.4; Juego.danarJugador(18, null, "trampa"); Sonido.en("trampa", t.x, 0.3 + Terreno.altura(t.x, t.z), t.z, 1.2); Juego.ruido(t.x, t.z, 45, "ext", "trampa"); Juego.aviso(T("av.trampa"), "mal"); }
    }
  }

  // ════ Por cuadro ════
  function actualizar(dt, yo, t) {
    trampasJugador(yo);
    for (const e of lista) {
      if (e.muerto) { e.tMuerto = (e.tMuerto || 0) + dt; Personajes.animar(e.pj, dt, { vel: 0, muerto: true }); continue; }
      const d = Math.hypot(yo.x - e.x, yo.z - e.z), lejos = d > 150 || e.zona !== yo.zona && d > 60;
      if (esRemoto && !e.aparicion) {
        if (e.tx !== undefined) { e.x = lerp(e.x, e.tx, Math.min(1, dt * 8)); e.z = lerp(e.z, e.tz, Math.min(1, dt * 8)); e.rumbo = e.rumbo + ang(e.trumbo - e.rumbo) * Math.min(1, dt * 8); }
      } else {
        e.tPercibe -= dt;
        if (e.tPercibe <= 0) { e.tPercibe = lejos ? 0.6 : 0.15; percibir(e, yo, lejos ? 0.6 : 0.15); }
        decidir(e, yo, dt, t);
      }
      e.y = Juego.alturaPies(e.x, e.z, e.zona);
      const visible = !lejos && e.zona === yo.zona;
      e.pj.grupo.visible = visible;
      if (visible) {
        e.pj.grupo.position.set(e.x, e.y, e.z); // los grupos de la mina y la cueva están en el origen
        e.pj.grupo.rotation.y = e.rumbo;
        const golpe = e.estado === "atacar" ? clamp(e.preparo, 0, 1) * 0.42 + (e.preparo > 1 ? 0.42 + (e.preparo - 1) * 0.9 : 0) : -1;
        Personajes.animar(e.pj, dt, { vel: e.vel, golpe: golpe > 1 ? -1 : golpe, herido: e.vida < e.vidaMax * 0.3 ? 1 : 0, agacha: e.tipo === "rapido" && e.estado !== "cazar" && e.vel < 1 });
      }
    }
  }
  function animarQuietos(dt) { /* en pausa no se mueve nada */ }
  // ════ Daño ════
  // Rayo contra cuerpo (cápsula) y cabeza (esfera).
  const A = new V(), B = new V(), C = new V();
  function rayoCapsula(o, d, a, b, r) {
    // Distancia mínima entre el rayo o + d·t y el segmento a–b.
    const u = d, v = B.copy(b).sub(a), w = C.copy(o).sub(a);
    const aa = u.dot(u), bb = u.dot(v), cc = v.dot(v), dd = u.dot(w), ee = v.dot(w), D = aa * cc - bb * bb;
    let sc, tc; if (D < 1e-6) { sc = 0; tc = bb > cc ? dd / bb : ee / cc; } else { sc = (bb * ee - cc * dd) / D; tc = (aa * ee - bb * dd) / D; }
    tc = clamp(tc, 0, 1); sc = Math.max(0, (tc * bb - dd) / aa);
    const p1 = o.clone().addScaledVector(u, sc), p2 = a.clone().addScaledVector(v, tc);
    return p1.distanceTo(p2) < r ? sc : null;
  }
  function impacto(o, d, zona, max) {
    let mejor = null;
    for (const e of lista) {
      if (e.muerto || e.zona !== zona) continue;
      const h = e.pj.alto, ag = e.pj.agachado ? 1 - e.pj.agachado * 0.25 : 1;
      A.set(e.x, e.y + 0.3, e.z); const top = new V(e.x, e.y + h * ag - 0.3, e.z);
      const t1 = rayoCapsula(o, d, A, top, 0.32 * (e.D.pesado ? 1.4 : 1));
      const cab = new V(e.x, e.y + h * ag - 0.14, e.z), tc = o.clone().sub(cab), bq = tc.dot(d), cq = tc.lengthSq() - 0.17 * 0.17, disc = bq * bq - cq;
      const t2 = disc > 0 ? -bq - Math.sqrt(disc) : null;
      const tt = t2 !== null && t2 > 0 ? t2 : t1;
      if (tt !== null && tt < max && (!mejor || tt < mejor.dist)) mejor = { e, dist: tt, cabeza: t2 !== null && t2 > 0 && (t1 === null || t2 <= t1 + 0.2) };
    }
    return mejor;
  }
  function enArco(x, z, rumbo, alcance, ancho, zona) {
    const out = [];
    for (const e of lista) { if (e.muerto || e.zona !== zona) continue; const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d > alcance + 0.4) continue; if (Math.abs(ang(Math.atan2(dx, dz) - rumbo)) < ancho || d < 0.9) out.push(e); }
    return out;
  }
  function herir(e, dmg, info = {}) {
    if (e.muerto) return;
    if (esRemoto && !e.aparicion && !info.remoto) { Red.enviar("herir", { id: e.id, d: dmg }); Director.sangre(e.x, e.y + 1.2, e.z, e.zona); Sonido.en("dolor_montanes", e.x, e.y + 1.5, e.z, 0.9); return; }
    e.vida -= dmg; e.alerta = 1.2; e.visto = { x: info.x ?? e.x, z: info.z ?? e.z }; e.tVisto = 0;
    if (e.aparicion) { e.aparicion = false; }
    if (e.estado !== "atacar") { e.estado = "cazar"; e.tEstado = 0; }
    Sonido.en(e.D.pesado ? "gruñido_bruto" : "dolor_montanes", e.x, e.y + 1.5, e.z, 0.9);
    Director.sangre(e.x, e.y + (info.cabeza ? e.pj.alto - 0.15 : 1.2), e.z, e.zona);
    if (info.cabeza) Juego.aviso(T("av.cabeza"), "bien", 1.2);
    // El rápido, herido, se va y vuelve.
    if (e.D.huye && e.vida > 0 && Math.random() < 0.6) { e.desvio = 2.4; setTimeout(() => (e.desvio = 0), 2200); }
    if (e.vida <= 0) morir(e, info);
  }
  function morir(e, info) {
    e.muerto = true; e.vel = 0; bajas++; Sonido.en("caida_cuerpo", e.x, e.y + 0.5, e.z, 1);
    if (e.D.jefe) { liderMuerto = true; Juego.aviso(T("av.lider"), "bien", 6); Director.combate(0); }
    if (info.sigilo) Juego.aviso(T("av.sigilo"), "bien", 2);
    // A veces deja algo.
    const r = Math.random();
    const tipo = r < 0.25 ? "venda" : r < 0.45 ? "municion" : r < 0.55 ? "bateria" : null;
    if (tipo && Lugares.objeto) Lugares.objeto(tipo, e.x + 0.6, e.z + 0.3, e.zona, { arma: ["pistola", "escopeta", "rifle"][Math.floor(Math.random() * 3)], cant: 4 });
    if (!lista.some((o) => !o.muerto && o.estado === "cazar")) Director.combate(0);
  }
  function quitar(e) { e.muerto = true; e.pj.grupo.visible = false; e.quitado = true; }
  function oir(x, z, radio, zona, tipo) {
    for (const e of lista) {
      if (e.muerto || e.zona !== zona || e.aparicion) continue;
      const d = Math.hypot(e.x - x, e.z - z); if (d > radio) continue;
      const k = 1 - d / radio;
      e.alerta = Math.min(1.2, e.alerta + (tipo === "disparo" ? 0.6 + k : tipo === "trampa" ? 0.6 : k * 0.35));
      if (e.estado !== "cazar" && e.estado !== "atacar") { e.estado = "investigar"; e.obj = { x, z }; e.tEstado = 0; }
      if (tipo === "disparo" && k > 0.5) { e.visto = { x, z }; e.tVisto = 0; }
    }
  }
  function empujar(p, radio, zona) { for (const e of lista) { if (e.muerto || e.zona !== zona || e.aparicion) continue; const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), m = radio + 0.4; if (d < m && d > 1e-4) { p.x = e.x + dx / d * m; p.z = e.z + dz / d * m; } } }
  function cerca(x, z, r, zona, alertaMin = 0) { return lista.some((e) => !e.muerto && e.zona === zona && Math.hypot(e.x - x, e.z - z) < r && e.alerta >= alertaMin); }
  function alertaMax() { let m = 0; for (const e of lista) if (!e.muerto && !e.aparicion) m = Math.max(m, Math.min(1, e.alerta)); return m; }
  // Para el director: una figura que mira entre los pinos, y alguien que te sigue.
  function aparicion(x, z) { const tipo = Math.random() < 0.5 ? "cazador" : "rapido"; const e = crear(tipo, x, z, "quieto", "ext", null, { aparicion: true }); e.tEstado = 0; return e; }
  function acechador(yo) {
    let mejor = null, dm = 1e9;
    for (const e of lista) { if (e.muerto || e.aparicion || e.zona !== "ext" || e.estado === "cazar" || e.D.jefe || e.D.pesado) continue; const d = Math.hypot(e.x - yo.x, e.z - yo.z); if (d < dm && d > 50) { dm = d; mejor = e; } }
    if (mejor && dm < 260) { mejor.estado = "acechar"; mejor.tEstado = 0; return mejor; }
    return null;
  }
  // ── Red: el anfitrión manda la foto; el invitado la aplica ──
  const ESTADOS = ["quieto", "patrulla", "vaga", "investigar", "acechar", "cazar", "atacar", "buscar", "volver", "irse"];
  function foto() { return lista.filter((e) => !e.aparicion && !e.quitado).map((e) => [e.id, TIPOS_I.indexOf(e.tipo), +e.x.toFixed(2), +e.z.toFixed(2), +e.rumbo.toFixed(2), +e.vel.toFixed(1), ESTADOS.indexOf(e.estado), Math.round(e.vida), e.muerto ? 1 : 0, e.zona, +(e.preparo || 0).toFixed(2)]); }
  const TIPOS_I = Object.keys(TIPOS);
  function aplicar(arr) {
    for (const f of arr || []) {
      const [id, ti, x, z, r, v, es, vida, muerto, zona, prep] = f;
      let e = lista.find((q) => q.id === id);
      if (!e) { const tipo = TIPOS_I[ti]; if (!tipo) continue; e = crear(tipo, x, z, "quieto", zona, null, { id }); }
      if (e.zona !== zona) { e.zona = zona; const padre = (zona !== "ext" && Lugares.zonas[zona] && Lugares.zonas[zona].grupo) || escena; if (e.pj.grupo.parent !== padre) { e.pj.grupo.parent && e.pj.grupo.parent.remove(e.pj.grupo); padre.add(e.pj.grupo); } }
      e.tx = x; e.tz = z; e.trumbo = r; e.vel = v; e.estado = ESTADOS[es] || "quieto"; e.vida = vida; e.preparo = prep;
      if (muerto && !e.muerto) { e.muerto = true; bajas++; Sonido.en("caida_cuerpo", e.x, e.y + 0.5, e.z, 1); if (e.D.jefe) liderMuerto = true; }
    }
  }
  function remoto(v) { esRemoto = v; }
  function porId(id) { return lista.find((e) => e.id === id); }
  function vivos() { return lista.filter((e) => !e.muerto && !e.aparicion); }
  function guardar() { return lista.filter((e) => !e.aparicion).map((e) => ({ tipo: e.tipo, x: e.x, z: e.z, zona: e.zona, vida: e.vida, muerto: e.muerto, estado: e.inicial })); }
  function cargar(g) { limpiar(); for (const s of g || []) { const e = crear(s.tipo, s.x, s.z, s.estado, s.zona); e.vida = s.vida; if (s.muerto) { e.muerto = true; e.pj.caida = 1; } } }
  return { montar, reiniciar, actualizar, foto, aplicar, remoto, porId, animarQuietos, impacto, herir, enArco, oir, empujar, cerca, alertaMax, aparicion, acechador, vivos, guardar, cargar, bajas: () => bajas, liderMuerto: () => liderMuerto, lista: () => lista, trampas: () => trampas, TIPOS };
})();
