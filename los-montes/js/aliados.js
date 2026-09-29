"use strict";
// ════════════════════════════════════════════════════════════════════════
// Los que no son montañeses: los secuestrados (presos, te siguen, esperan en
// el refugio, suben a la camioneta) y los compañeros del modo cooperativo
// con la computadora: médica, explorador, mecánico, combatiente,
// superviviente. Cada rol ayuda a su manera.
// ════════════════════════════════════════════════════════════════════════
const Aliados = (() => {
  const V = THREE.Vector3;
  let escena, datos, opc = {}, sobrev = [], comp = [], refugioC = null, tMarca = 0, tCura = 30, tBusca = 60;
  const NOMBRES = ["Lucía", "Tomás", "Sofía", "Martín", "Don Ernesto", "Carla"];
  const MODELO_ROL = { medico: "medica", explorador: "explorador", mecanico: "mecanico", combatiente: "explorador", superviviente: "sobreviviente2" };
  function montar(esc, d) { escena = esc; datos = d; refugioC = d.cabanas[0]; }
  function limpiar() { for (const s of sobrev) s.pj.grupo.parent && s.pj.grupo.parent.remove(s.pj.grupo); for (const c of comp) c.pj.grupo.parent && c.pj.grupo.parent.remove(c.pj.grupo); sobrev = []; comp = []; }
  function padreDe(zona) { return (zona !== "ext" && Lugares.zonas[zona] && Lugares.zonas[zona].grupo) || escena; }
  function reiniciar(o) {
    opc = o || {}; limpiar();
    const J = datos.jaulas;
    J.forEach((j, i) => {
      j.abierta = false; if (j.col) j.col.activo = true; j.colgada = i === 3; j.g.position.y = j.y + (j.colgada ? 5 : 0);
      const pj = Personajes.crear(i % 2 ? "sobreviviente2" : "sobreviviente1"); padreDe(j.zona).add(pj.grupo);
      sobrev.push({ i, nombre: NOMBRES[i], pj, x: j.x, z: j.z, zona: j.zona, estado: "preso", jaula: j, y: 0, vel: 0, rumbo: Math.random() * 6, dicho: false });
    });
    const at = datos.atado, pj = Personajes.crear("sobreviviente1"); escena.add(pj.grupo);
    sobrev.push({ i: 5, nombre: NOMBRES[5], pj, x: at.x, z: at.z, zona: at.zona, estado: "atado", y: at.y, vel: 0, rumbo: 0, dicho: false });
    // Compañeros: los roles que no eligió el jugador.
    const roles = ["medico", "explorador", "mecanico", "combatiente", "superviviente"].filter((r) => r !== opc.rol);
    for (let k = 0; k < (opc.companeros || 0); k++) {
      const rol = roles[k], p = Personajes.crear(MODELO_ROL[rol]); escena.add(p.grupo);
      const c = { rol, pj: p, x: -48 + (k + 1) * 1.6, z: 265 + k, zona: "ext", y: 0, vel: 0, rumbo: Math.PI, cd: 0, municion: rol === "combatiente" ? 40 : 18, lado: k % 2 ? -1 : 1, nombre: T("rol." + rol) };
      if (rol !== "medico" && rol !== "superviviente") Personajes.ponerArma(p, Modelos.clonar("pistola"));
      comp.push(c);
    }
    Juego.est.aliados = comp.map((c) => ({ rol: c.rol, nombre: c.nombre }));
    tMarca = 0; tCura = 30; tBusca = 60;
    return sobrev.length;
  }
  function refugio() { return refugioC; }
  // Lo que se puede hacer con ellos.
  function interacciones(yo) {
    const out = [], J = Juego.est;
    for (const s of sobrev) {
      if (s.zona !== yo.zona) continue;
      if (s.estado === "preso") {
        const j = s.jaula;
        if (j.colgada) out.push({ x: j.x, z: j.z, r: 3.2, tipo: "jaula", texto: T("acc.jaulaColgada"), hacer() { Juego.aviso(T("av.jaulaColgada"), "mal"); } });
        else if (j.candado && !J.inv.herramientas) out.push({ x: j.x, z: j.z, r: 2.6, tipo: "jaula", texto: T("acc.jaulaCandado"), hacer() { Juego.aviso(T("av.faltaHerramienta"), "mal"); } });
        else out.push({ x: j.x, z: j.z, r: 2.6, tipo: "jaula", mecanica: true, texto: T("acc.abrirJaula"), largo: j.candado ? 2.6 : 1.2, hacer() { liberar(s); } });
      } else if (s.estado === "atado") out.push({ x: s.x, z: s.z, r: 2.2, tipo: "atado", mecanica: true, texto: T("acc.desatar"), largo: 2.0, hacer() { liberar(s); } });
      else if (s.estado === "sigue") out.push({ x: s.x, z: s.z, r: 1.8, tipo: "espera", texto: T("acc.esperar", { n: s.nombre }), hacer() { s.estado = "espera"; Juego.aviso(T("av.espera", { n: s.nombre }), "info"); } });
      else if (s.estado === "espera") out.push({ x: s.x, z: s.z, r: 1.8, tipo: "seguir", texto: T("acc.seguime", { n: s.nombre }), hacer() { s.estado = "sigue"; } });
    }
    return out;
  }
  function liberar(s) {
    const j = s.jaula; if (j) { j.abierta = true; if (j.col) j.col.activo = false; j.g.rotation.y = 0.4; Sonido.golpe("jaula"); }
    s.estado = "sigue"; Juego.est.rescatados = sobrev.filter((x) => x.estado === "sigue" || x.estado === "espera").length;
    Juego.subtitulo(T("dice.liberado" + (s.i % 3)), 5, s.nombre); Juego.ruido(s.x, s.z, 14, s.zona, "jaula");
    Juego.objetivo(); Red.enviar("liberar", { i: s.i });
  }
  function cruzaron(p, dentro) {
    // Los que te siguen (y los compañeros cerca) pasan la puerta con vos.
    const zona = dentro ? p.zonaFuera : p.zonaDentro, dest = dentro ? p.fuera : p.dentro;
    const y = Juego.yo;
    for (const a of [...sobrev.filter((s) => s.estado === "sigue"), ...comp]) {
      if (Math.hypot(a.x - y.x, a.z - y.z) > 20 && a.zona === y.zona) continue;
      a.zona = zona; a.x = dest.x + (Math.random() - 0.5) * 1.2; a.z = dest.z + (Math.random() - 0.5) * 1.2;
      const padre = padreDe(zona); if (a.pj.grupo.parent !== padre) { a.pj.grupo.parent && a.pj.grupo.parent.remove(a.pj.grupo); padre.add(a.pj.grupo); }
    }
    // Llegar al refugio con gente: quedan a salvo.
    if (!dentro && p.cab === refugioC) {
      let n = 0; for (const s of sobrev) if (s.estado === "sigue") { s.estado = "salvo"; n++; }
      if (n) { Juego.est.aSalvo = sobrev.filter((s) => s.estado === "salvo").length; Juego.est.rescatados = sobrev.filter((s) => s.estado === "sigue" || s.estado === "espera").length; Juego.aviso(T("av.aSalvo", { n }), "bien", 5); Sonido.musica("alivio"); Juego.objetivo(); }
    }
  }
  const pp = new V();
  function seguir(a, tx, tz, velMax, dt, sep = 2.2) {
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    const v = d > sep ? Math.min(velMax, (d - sep) * 2 + 0.6) : 0;
    a.vel = lerp(a.vel, v, Math.min(1, dt * 6));
    if (a.vel > 0.05) { a.rumbo = a.rumbo + ang(Math.atan2(dx, dz) - a.rumbo) * Math.min(1, dt * 8); a.x += Math.sin(a.rumbo) * a.vel * dt; a.z += Math.cos(a.rumbo) * a.vel * dt; }
    pp.set(a.x, 0, a.z); Colision.resolver(pp, 0.35, a.zona); if (a.zona !== "ext") Lugares.restringir(a.zona, pp, 0.35); a.x = pp.x; a.z = pp.z;
    // Muy lejos (se trabó): aparece detrás tuyo.
    if (d > 45) { const y = Juego.yo; a.x = y.x + Math.sin(y.yaw) * 3; a.z = y.z + Math.cos(y.yaw) * 3; }
  }
  function actualizar(dt, yo, t) {
    const J = Juego.est;
    // ── Secuestrados ──
    for (const s of sobrev) {
      if (s.estado === "aBordo") { s.pj.grupo.visible = false; continue; }
      s.pj.grupo.visible = s.zona === yo.zona && Math.hypot(s.x - yo.x, s.z - yo.z) < 150;
      let agacha = false, vel = 0;
      if (s.estado === "preso" || s.estado === "atado") {
        const j = s.jaula; if (j) { s.x = j.x; s.z = j.z; }
        agacha = true;
        if (!s.dicho && s.zona === yo.zona && Math.hypot(s.x - yo.x, s.z - yo.z) < 14) { s.dicho = true; Juego.subtitulo(T("dice.ayuda" + (s.i % 3)), 4, s.nombre); Sonido.en("susurro", s.x, s.y + 1, s.z, 0.6); }
      } else if (s.estado === "sigue") {
        const i = sobrev.filter((x) => x.estado === "sigue").indexOf(s);
        const bx = yo.x + Math.sin(yo.yaw) * (1.8 + i * 1.1), bz = yo.z + Math.cos(yo.yaw) * (1.8 + i * 1.1);
        if (s.zona !== yo.zona) { s.zona = yo.zona; s.x = yo.x; s.z = yo.z; const padre = padreDe(s.zona); padre.add(s.pj.grupo); }
        seguir(s, bx, bz, yo.corre ? 4.8 : 2.6, dt, 0.4); vel = s.vel; agacha = yo.agacha;
        // Si te alejás mucho y un montañés lo agarra, se lo llevan de vuelta.
        for (const e of Enemigos.vivos()) if (e.zona === s.zona && e.estado === "cazar" && Math.hypot(e.x - s.x, e.z - s.z) < 1.8 && Math.hypot(yo.x - s.x, yo.z - s.z) > 14 && s.jaula) {
          s.estado = "preso"; s.jaula.abierta = false; if (s.jaula.col) s.jaula.col.activo = true; s.zona = s.jaula.zona; padreDe(s.zona).add(s.pj.grupo); s.dicho = false;
          Juego.aviso(T("av.seLoLlevaron", { n: s.nombre }), "mal", 6); Sonido.en("grito_lejano", e.x, e.y + 1.5, e.z, 1); J.rescatados = sobrev.filter((x) => x.estado === "sigue" || x.estado === "espera").length; Juego.objetivo(); break;
        }
      } else if (s.estado === "salvo") {
        // En el refugio: se quedan adentro, sentados.
        s.zona = refugioC.int.zona; const k = sobrev.indexOf(s); s.x = refugioC.x + Math.cos(k) * 1.5; s.z = refugioC.z + Math.sin(k) * 1.2; agacha = true;
        if (s.pj.grupo.parent !== escena) { s.pj.grupo.parent && s.pj.grupo.parent.remove(s.pj.grupo); escena.add(s.pj.grupo); }
      }
      s.y = Juego.alturaPies(s.x, s.z, s.zona);
      s.pj.grupo.position.set(s.x, s.y, s.z); s.pj.grupo.rotation.y = s.rumbo;
      if (s.pj.grupo.visible) Personajes.animar(s.pj, dt, { vel, agacha });
    }
    // ── Compañeros ──
    tMarca -= dt; tCura -= dt; tBusca -= dt;
    for (const c of comp) {
      if (c.zona !== yo.zona) { c.zona = yo.zona; c.x = yo.x + 1.5; c.z = yo.z + 1.5; padreDe(c.zona).add(c.pj.grupo); }
      const bx = yo.x + Math.sin(yo.yaw) * 2.6 + Math.cos(yo.yaw) * 1.8 * c.lado, bz = yo.z + Math.cos(yo.yaw) * 2.6 - Math.sin(yo.yaw) * 1.8 * c.lado;
      c.cd -= dt;
      // ¿Hay alguien cazándote cerca? Los que tienen arma tiran.
      let blanco = null, db = 1e9;
      for (const e of Enemigos.vivos()) { if (e.zona !== c.zona || e.estado !== "cazar" && e.estado !== "atacar") continue; const d = Math.hypot(e.x - c.x, e.z - c.z); if (d < 26 && d < db && !Colision.tapa(c.x, c.z, e.x, e.z, c.zona, ["cabana", "roca", "pared"])) { db = d; blanco = e; } }
      let apunta = false;
      if (blanco && (c.rol === "combatiente" || c.rol === "explorador" || c.rol === "mecanico") && c.municion > 0) {
        apunta = true; c.rumbo = c.rumbo + ang(Math.atan2(blanco.x - c.x, blanco.z - c.z) - c.rumbo) * Math.min(1, dt * 10); c.vel = lerp(c.vel, 0, dt * 6);
        if (c.cd <= 0) { c.cd = c.rol === "combatiente" ? 0.8 : 1.4; c.municion--; Sonido.disparo("pistola", c.x, c.y + 1.4, c.z); Juego.ruido(c.x, c.z, 80, c.zona, "disparo");
          if (Math.random() < (c.rol === "combatiente" ? 0.62 : 0.42)) Enemigos.herir(blanco, 22, { x: c.x, z: c.z }); }
      } else if (blanco && db < 2.2 && c.cd <= 0) { c.cd = 1.1; Enemigos.herir(blanco, 14, { x: c.x, z: c.z, cuerpo: true }); Sonido.en("puno", c.x, c.y + 1, c.z, 0.8); }
      else seguir(c, bx, bz, yo.corre ? 5 : 2.8, dt, 0.6);
      // Habilidades de cada rol.
      if (c.rol === "medico" && tCura <= 0 && J.vida < 45 && Math.hypot(c.x - yo.x, c.z - yo.z) < 6) { tCura = 45; J.vida = Math.min(100, J.vida + 35); Juego.subtitulo(T("dice.medica"), 3, c.nombre); Sonido.golpe("cura"); }
      if (c.rol === "explorador" && tMarca <= 0) { tMarca = 18; marcar(yo, 75); }
      if (c.rol === "superviviente" && tBusca <= 0) { tBusca = 110; const k = ["lata", "bateria", "venda"][Math.floor(Math.random() * 3)]; J.inv[k] = (J.inv[k] || 0) + 1; Juego.aviso(T("av.encontro", { n: c.nombre, o: T("item." + k) }), "bien", 3); }
      c.y = Juego.alturaPies(c.x, c.z, c.zona);
      c.pj.grupo.position.set(c.x, c.y, c.z); c.pj.grupo.rotation.y = c.rumbo; c.pj.grupo.visible = !J.manejando || c.zona !== "ext";
      Personajes.animar(c.pj, dt, { vel: c.vel, agacha: yo.agacha && !apunta, apunta, arma: apunta ? "pistola" : null });
    }
    // El jugador explorador marca solo, cada tanto.
    if (opc.rol === "explorador" && tMarca <= 0) { tMarca = 25; marcar(yo, 60); }
    J.marcas = J.marcas.filter((m) => m.hasta > Juego.tiempo);
  }
  function marcar(yo, r) {
    const J = Juego.est, lista = Enemigos.vivos().filter((e) => e.zona === yo.zona && Math.hypot(e.x - yo.x, e.z - yo.z) < r);
    if (!lista.length) return;
    J.marcas = lista.map((e) => ({ e, hasta: Juego.tiempo + 8 }));
    Juego.aviso(T("av.marcados", { n: lista.length }), "info", 3);
  }
  function empujar(p, radio, zona) { for (const a of [...sobrev, ...comp]) { if (a.zona !== zona || a.estado === "aBordo" || a.estado === "salvo") continue; const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), m = radio + 0.3; if (d < m && d > 1e-4) { p.x = a.x + dx / d * m; p.z = a.z + dz / d * m; } } }
  // Subir a la camioneta a los que están a salvo o te siguen.
  function subir() { let n = 0; for (const s of sobrev) if (s.estado === "salvo" || s.estado === "sigue" || s.estado === "espera") { s.estado = "aBordo"; n++; } Juego.est.aSalvo = 0; Juego.est.rescatados = 0; return n; }
  function aBordo() { return sobrev.filter((s) => s.estado === "aBordo").length; }
  function paraSubir() { return sobrev.filter((s) => s.estado === "salvo" || s.estado === "sigue" || s.estado === "espera").length; }
  function bajarJaula(j) { j.colgada = false; j.g.position.y = j.y; Sonido.golpe("cadena"); }
  function guardar() { return sobrev.map((s) => ({ estado: s.estado, x: s.x, z: s.z, zona: s.zona })); }
  function cargar(g) {
    (g || []).forEach((q, i) => { const s = sobrev[i]; if (!s) return; s.estado = q.estado; s.x = q.x; s.z = q.z; s.zona = q.zona; if (s.jaula && q.estado !== "preso") { s.jaula.abierta = true; if (s.jaula.col) s.jaula.col.activo = false; } padreDe(s.zona).add(s.pj.grupo); });
    const J = Juego.est; J.aSalvo = sobrev.filter((s) => s.estado === "salvo").length; J.rescatados = sobrev.filter((s) => s.estado === "sigue" || s.estado === "espera").length;
  }
  return { montar, reiniciar, interacciones, liberar, cruzaron, actualizar, empujar, refugio, subir, aBordo, paraSubir, bajarJaula, guardar, cargar, sobrev: () => sobrev, comp: () => comp };
})();
