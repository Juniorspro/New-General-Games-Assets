// ─────────────────────────────────────────────────────────────────────────────
// LOS OBJETOS Y LO QUE SE RECOGE: 33 pasivos y 6 activos (cada uno con su efecto real sobre
// las cuentas o las lágrimas), repartidos en las tandas del original (tesoro, jefe, tienda,
// pacto, secreta) sin repetirse en la partida. Los recogibles: corazones rojos y de espora,
// monedas de 1 y de 5, bombas, llaves, cápsulas (el efecto de cada color se sortea por partida
// y se descubre al tomarla), cofres, y los pedestales. La tienda cobra; el pacto cobra vida.
// ─────────────────────────────────────────────────────────────────────────────

const OBJETOS = {
  sombreroRojo: { nombre: "SOMBRERO ROJO", lema: "DAÑO ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], aplicar: (j) => { j.danoUps += 1; } },
  setaPicante: { nombre: "SETA PICANTE", lema: "DAÑO ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], aplicar: (j) => { j.danoUps += 0.5; j.danoPlano += 0.5; } },
  cafeRaiz: { nombre: "CAFÉ DE RAÍZ", lema: "LÁGRIMAS ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], aplicar: (j) => { j.lagUps += 0.7; } },
  zapatillas: { nombre: "ZAPATILLAS", lema: "VELOCIDAD ARRIBA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], aplicar: (j) => { j.vel += 0.3; } },
  lupa: { nombre: "LUPA", lema: "LÁGRIMAS GRANDES", calidad: 1, pools: ["tesoro", "jefe"], aplicar: (j) => { j.tamLag *= 1.3; j.danoPlano += 0.6; } },
  trebol: { nombre: "TRÉBOL", lema: "SUERTE ARRIBA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], aplicar: (j) => { j.suerte += 2; } },
  corazonPiedra: { nombre: "CORAZÓN DE PIEDRA", lema: "VIDA ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], aplicar: (j) => { sumarContenedor(j, 1); curar(j, 2); } },
  ojoVidrio: { nombre: "OJO DE VIDRIO", lema: "ALCANCE ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], aplicar: (j) => { j.alcance += 1.5; j.velLag += 0.2; } },
  tercerOjo: { nombre: "TERCER OJO", lema: "TRES LÁGRIMAS", calidad: 3, pools: ["tesoro", "pacto"], aplicar: (j) => { j.triple = true; } },
  iman: { nombre: "IMÁN", lema: "TODO VIENE A VOS", calidad: 1, pools: ["tesoro", "tienda"], aplicar: (j) => { j.iman = true; } },
  esporasToxicas: { nombre: "ESPORAS TÓXICAS", lema: "LÁGRIMAS VENENOSAS", calidad: 2, pools: ["tesoro"], aplicar: (j) => { j.veneno = true; } },
  escarcha: { nombre: "ESCARCHA", lema: "LÁGRIMAS HELADAS", calidad: 2, pools: ["tesoro"], aplicar: (j) => { j.hielo = true; } },
  gomaElastica: { nombre: "GOMA ELÁSTICA", lema: "LÁGRIMAS QUE REBOTAN", calidad: 2, pools: ["tesoro"], aplicar: (j) => { j.rebote = true; j.alcance += 0.5; } },
  velo: { nombre: "VELO", lema: "LÁGRIMAS FANTASMA", calidad: 2, pools: ["tesoro", "secreta"], aplicar: (j) => { j.espectral = true; j.colorLag = "tinta"; } },
  aguja: { nombre: "AGUJA", lema: "ATRAVIESA TODO", calidad: 3, pools: ["tesoro", "secreta"], aplicar: (j) => { j.atraviesa = true; } },
  brujula: { nombre: "BRÚJULA", lema: "EL MAPA SE REVELA", calidad: 1, pools: ["tesoro", "tienda"], aplicar: (j) => { j.mapa = true; revelarMapa(); } },
  ojoCazador: { nombre: "OJO CAZADOR", lema: "LÁGRIMAS QUE BUSCAN", calidad: 3, pools: ["tesoro", "pacto"], aplicar: (j) => { j.buscadora = true; j.colorLag = "violeta"; } },
  cuerno: { nombre: "CUERNO", lema: "DAÑO MUCHO ARRIBA", calidad: 3, pools: ["pacto"], aplicar: (j) => { j.danoUps += 2; } },
  moscaAmiga: { nombre: "MOSCA AMIGA", lema: "TE CUIDA LAS ESPALDAS", calidad: 2, pools: ["tesoro", "tienda"], aplicar: () => {} },
  hermanito: { nombre: "HERMANITO", lema: "UN AMIGUITO QUE LLORA", calidad: 2, pools: ["tesoro"], aplicar: () => {} },
  casco: { nombre: "CASCO DE ESPORAS", lema: "DOS CORAZONES DE ESPORA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], aplicar: (j) => { darEsporas(j, 4); } },
  bombaGorda: { nombre: "BOMBA GORDA", lema: "CINCO BOMBAS GRANDES", calidad: 2, pools: ["tesoro", "tienda"], aplicar: (j) => { j.bombas = Math.min(99, j.bombas + 5); j.bombaGorda = true; } },
  bolsaMonedas: { nombre: "BOLSA DE MONEDAS", lema: "VEINTICINCO MONEDAS", calidad: 1, pools: ["tesoro", "secreta"], aplicar: (j) => { j.monedas = Math.min(99, j.monedas + 25); } },
  llavero: { nombre: "LLAVERO", lema: "CUATRO LLAVES", calidad: 1, pools: ["tesoro", "tienda"], aplicar: (j) => { j.llaves = Math.min(99, j.llaves + 4); } },
  plomo: { nombre: "LÁGRIMA DE PLOMO", lema: "PESADA Y DOLOROSA", calidad: 2, pools: ["tesoro", "jefe"], aplicar: (j) => { j.danoPlano += 1.6; j.lagUps -= 0.35; j.velLag -= 0.15; j.tamLag *= 1.15; } },
  lenteSangre: { nombre: "LENTE DE SANGRE", lema: "DAÑO Y ALCANCE", calidad: 2, pools: ["tesoro", "jefe", "pacto"], aplicar: (j) => { j.danoUps += 1; j.alcance += 1; j.colorLag = "sangre"; } },
  chispa: { nombre: "CHISPA", lema: "LÁGRIMAS QUE QUEMAN", calidad: 2, pools: ["tesoro"], aplicar: (j) => { j.fuego = true; j.danoUps += 0.3; } },
  alasPolilla: { nombre: "ALAS DE POLILLA", lema: "¡A VOLAR!", calidad: 3, pools: ["tesoro", "pacto"], aplicar: (j) => { j.vuela = true; j.vel += 0.1; } },
  caparazon: { nombre: "CAPARAZÓN", lema: "TODO UN POCO ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], aplicar: (j) => { j.danoUps += 0.3; j.lagUps += 0.2; j.vel += 0.1; j.alcance += 0.5; j.suerte += 1; j.velLag += 0.1; } },
  hongoGigante: { nombre: "HONGO GIGANTE", lema: "¡TODO ARRIBA!", calidad: 4, pools: ["pacto", "secreta"], aplicar: (j) => { sumarContenedor(j, 1); j.vida = j.cont; j.danoUps += 0.3; j.danoMult *= 1.5; j.vel += 0.3; j.alcance += 1.5; j.tamLag *= 1.2; } },
  mediaLuna: { nombre: "MEDIA LUNA", lema: "LÁGRIMAS Y SUERTE", calidad: 2, pools: ["tesoro", "jefe"], aplicar: (j) => { j.lagUps += 0.5; j.suerte += 1; } },
  raizVieja: { nombre: "RAÍZ VIEJA", lema: "VIDA ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], aplicar: (j) => { sumarContenedor(j, 1); j.vida = j.cont; } },
  pactoSangre: { nombre: "PACTO DE SANGRE", lema: "DAÑO POR UNO Y MEDIO", calidad: 4, pools: ["pacto"], aplicar: (j) => { j.danoMult *= 1.5; j.colorLag = "sangre"; } },
  // los activos: se cargan limpiando salas
  libroSetas: { nombre: "LIBRO DE SETAS", lema: "PODER PARA LA SALA", calidad: 2, pools: ["tesoro", "pacto"], activo: 3, usar: (j) => { j.danoSala += 2; SFX.pacto(); J.destello = 4; } },
  dadoViejo: { nombre: "DADO VIEJO", lema: "REHACE EL DESTINO", calidad: 3, pools: ["tesoro", "tienda"], activo: 6, usar: () => rehacerPedestales() },
  frascoMosquines: { nombre: "FRASCO DE MOSQUINES", lema: "MOSCAS DE TU LADO", calidad: 2, pools: ["tesoro", "tienda"], activo: 3, usar: (j) => { for (let i = 0; i < 4; i++) J.familiares.push({ tipo: "moscaAzul", x: j.x + V.ent(-6, 6), y: j.y + V.ent(-6, 6), t: 900, a: V.f() * TAU }); SFX.zumbido(); } },
  linterna: { nombre: "LINTERNA", lema: "UNA LUZ QUE QUEMA", calidad: 2, pools: ["tesoro", "tienda"], activo: 4, usar: () => { J.destello = 8; temblar(6); for (const e of J.enemigos.slice()) danarEnemigo(e, 40); } },
  mechaEterna: { nombre: "MECHA ETERNA", lema: "UNA BOMBA GRATIS", calidad: 1, pools: ["tesoro", "tienda"], activo: 1, usar: (j) => { J.bombas.push({ x: j.x, y: j.y + 2, t: 90, gorda: j.bombaGorda, vx: 0, vy: 0, r: 5 }); SFX.mecha(); } },
  gotaRocio: { nombre: "GOTA DE ROCÍO", lema: "CURA UN CORAZÓN", calidad: 1, pools: ["tesoro", "tienda"], activo: 4, usar: (j) => { curar(j, 2); SFX.corazon(); } },
};

function armarTandas() {
  J.tandas = {};
  for (const [id, o] of Object.entries(OBJETOS)) for (const p of o.pools) (J.tandas[p] ||= []).push(id);
  J.tandas.secreta = Object.keys(OBJETOS).filter((id) => !OBJETOS[id].pools.includes("pacto") || id === "hongoGigante");
  J.tomados = new Set();
}
function sacarObjeto(pool) {
  const lista = (J.tandas[pool] || []).filter((id) => !J.tomados.has(id) && !J.enPedestal.has(id));
  let id = lista.length ? A.uno(lista) : null;
  if (!id) { const resto = Object.keys(OBJETOS).filter((x) => !J.tomados.has(x) && !J.enPedestal.has(x)); id = resto.length ? A.uno(resto) : "caparazon"; }
  J.enPedestal.add(id);
  return id;
}
function revelarMapa() { if (!J.piso) return; for (const s of J.piso.salas.values()) if (s.tipo !== "secreta") s.vista = true; }

// ── los recogibles ──
function recogible(t, x, y, sub) {
  if (t === "corazon" && !sub) sub = A.pesos([["rojo", 6], ["medio", 3], ["espora", 1]]);
  if (t === "moneda" && !sub) sub = A.si(0.1) ? 5 : 1;
  if (t === "capsula" && sub == null) sub = A.ent(0, COLORES_CAPSULA.length - 1);
  if (t === "cofre" && !sub) sub = A.si(J.piso && J.piso.n >= 2 ? 0.3 : 0.18) ? "dorado" : "normal";
  return { t, sub, x, y, vx: 0, vy: 0, z: 0, vz: 0, r: 5, k: V.ent(0, 40) };
}
function pedestal(x, y, id) { return { t: "objeto", id, x, y, vx: 0, vy: 0, z: 0, vz: 0, r: 8, quieto: true, k: V.ent(0, 90) }; }

/** Tira algo al piso con un saltito. tipo: null (al azar), "espora" (corazón de espora), o un tipo. */
function soltarPremio(x, y, tipo) {
  let sub;
  if (tipo === "espora") { tipo = "corazon"; sub = "espora"; }
  if (!tipo) tipo = A.pesos([["moneda", 45], ["corazon", 25], ["bomba", 12], ["llave", 12], ["capsula", 6]]);
  const c = recogible(tipo, x, y, sub);
  const a = V.f() * TAU; c.vx = Math.cos(a) * 1.4; c.vy = Math.sin(a) * 1.1; c.vz = 2.4; c.z = 2;
  J.sala.cosas.push(c);
  return c;
}

/** El premio de limpiar una sala (como en el original: la suerte ayuda). */
function premioSala() {
  const j = J.jug, n = A.f() + j.suerte * 0.03;
  if (n < 0.36) return;
  const tipo = A.pesos([["moneda", 30], ["corazon", 18], ["llave", 14], ["bomba", 14], ["cofre", 8], ["capsula", 8]]);
  const [x, y] = lugarLibreCerca(cx(6), cy(3));
  const c = recogible(tipo, x, y);
  c.vz = 2; J.sala.cosas.push(c);
  if (tipo === "moneda" && A.si(0.25)) soltarPremio(x, y, "moneda");
}

function actualizarCosas() {
  const j = J.jug, C = J.sala.cosas;
  for (let i = C.length - 1; i >= 0; i--) {
    const c = C[i];
    c.k++;
    if (!c.quieto) {
      c.z += c.vz; c.vz -= 0.25;
      if (c.z <= 0) { c.z = 0; c.vz = Math.abs(c.vz) > 0.8 ? -c.vz * 0.35 : 0; }
      if (j.iman && !c.precio && ["moneda", "corazon", "bomba", "llave"].includes(c.t)) { const d = dist(j.x, j.y, c.x, c.y) || 1; if (d < 90) { c.vx += (j.x - c.x) / d * 0.18; c.vy += (j.y - c.y) / d * 0.18; } }
      c.vx *= 0.9; c.vy *= 0.9;
      moverEnSala(J.sala, c, c.vx, c.vy, false);
    }
    if (c.t === "trampilla") { if (!c.abierta && dist(j.x, j.y, c.x, c.y) > 20) c.abierta = true; if (c.abierta && dist(j.x, j.y, c.x, c.y) < 8 && !j.muerto && J.estado === "juego") bajarPiso(); continue; }
    if (j.muerto || c.z > 6) continue;
    const alcance = RADIO_SOLIDO[c.t] ? RADIO_SOLIDO[c.t] + j.r + 1.5 : 9;
    if (c.espera > 0) { c.espera--; continue; }       // lo que recién saltó de un cofre no se agarra al toque
    if (dist(j.x, j.y, c.x, c.y) > alcance) { c.tocando = false; c.avisado = false; continue; }
    if (tomar(c)) C.splice(i, 1);
  }
}

/** Shumio toca algo: ¿se lo lleva? (devuelve true si desaparece del piso) */
function tomar(c) {
  const j = J.jug;
  if (c.precio && c.t !== "objeto") {
    if (j.monedas < c.precio || !puedeUsar(c)) return false;
    j.monedas -= c.precio; SFX.moneda();
  }
  switch (c.t) {
    case "corazon": {
      if (c.sub === "espora" || c.sub === "esporaMedio") { if (!darEsporas(j, c.sub === "espora" ? 2 : 1)) return false; }
      else if (!curar(j, c.sub === "rojo" ? 2 : 1)) return false;
      SFX.corazon(); return true;
    }
    case "moneda": j.monedas = Math.min(99, j.monedas + (c.sub | 0)); SFX.moneda(); return true;
    case "bomba": j.bombas = Math.min(99, j.bombas + 1); SFX.recoger(); return true;
    case "llave": j.llaves = Math.min(99, j.llaves + 1); SFX.llave(); return true;
    case "capsula": {
      if (j.capsula != null) { const v = recogible("capsula", j.x, j.y + 10, j.capsula); v.vz = 2; v.vy = 1; J.sala.cosas.push(v); }
      j.capsula = c.sub; SFX.recoger(); return true;   // el nombre queda abajo a la derecha, como la píldora del original
    }
    case "cofre": {
      if (c.abierto) return false;
      if (c.sub === "dorado" && j.llaves <= 0) {       // trabado: suena el candado y tiembla (una vez por toque)
        if (!c.avisado) { SFX.clic(); c.sacudida = 10; c.avisado = true; }
        return false;
      }
      if (c.sub === "dorado") j.llaves--;
      c.abierto = true; c.quieto = true; SFX.llave(); SFX.recoger();
      // lo de adentro salta hacia afuera, lejos de Shumio, y tarda un momento en poder agarrarse
      const ang0 = Math.atan2(c.y - j.y, c.x - j.x);
      if (c.sub === "dorado" && A.si(0.14)) { J.sala.cosas.push(pedestal(c.x, c.y - 18, sacarObjeto("tesoro"))); }
      else {
        const n = A.ent(2, c.sub === "dorado" ? 4 : 3);
        for (let i = 0; i < n; i++) {
          const p = soltarPremio(c.x, c.y - 4), a = ang0 + (i - (n - 1) / 2) * 0.55 + (A.f() - 0.5) * 0.3, v = 1.6 + A.f() * 0.8;
          p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v * 0.8; p.vz = 3 + A.f(); p.espera = 26;
        }
      }
      return false;
    }
    case "cofreFinal": if (!c.abierto) { c.abierto = true; ganar(); } return false;
    case "objeto": return tomarObjeto(c);
  }
  return false;
}
function puedeUsar(c) {
  const j = J.jug;
  if (c.t === "corazon") return c.sub.startsWith("espora") ? j.esporas < 24 - j.cont : j.vida < j.cont;
  return true;
}

function tomarObjeto(c) {
  const j = J.jug;
  if (!c.id || c.tocando) return false;
  c.tocando = true;
  const def = OBJETOS[c.id];
  if (c.pacto) {
    const costo = c.pacto * 2;
    if (j.cont >= costo && vidaTotal(j) - costo > 0) sumarContenedor(j, -c.pacto);
    else if (j.cont === 0 && j.esporas > 6) j.esporas -= 6;
    else return false;
    SFX.pacto();
  } else if (c.precio) {
    if (j.monedas < c.precio) return false;
    j.monedas -= c.precio; SFX.moneda();
  }
  const id = c.id;
  J.tomados.add(id);
  if (def.activo) {
    if (j.activo) { c.id = j.activo.id; c.tocando = true; c.precio = 0; c.pacto = 0; } else c.id = null;
    j.activo = { id, carga: def.activo, max: def.activo };
  } else {
    c.id = null;
    const antes = fotoCuentas(j);
    def.aplicar(j);
    anotarCambios(antes);
    j.objetos.push(id);
    if (id === "moscaAmiga" || id === "hermanito") armarFamiliares();
  }
  rotulo(def.nombre, def.lema);
  SFX.objeto();
  j.sostiene = iconoSpr(id); j.tSostiene = 50;
  // en la tienda y en el pacto, lo comprado se va con pedestal y todo
  return (c.precio || c.pacto) && !c.id ? true : false;
}

function rehacerPedestales() {
  let alguno = false;
  for (const c of J.sala.cosas) if (c.t === "objeto" && c.id) {
    J.enPedestal.delete(c.id);
    c.id = sacarObjeto(J.sala.tipo === "tienda" ? "tienda" : J.sala.tipo === "pacto" ? "pacto" : J.sala.tipo === "jefe" ? "jefe" : "tesoro");
    humo(c.x, c.y - 16); alguno = true;
  }
  SFX[alguno ? "secreto" : "malo"]();
}

// ── las cápsulas: el color de cada efecto se sortea por partida ──
const EFECTOS_CAPSULA = [
  { n: "¡LÁGRIMAS ARRIBA!", f: (j) => { j.lagUps += 0.35; }, bueno: true }, { n: "LÁGRIMAS ABAJO", f: (j) => { j.lagUps -= 0.28; } },
  { n: "¡VELOCIDAD ARRIBA!", f: (j) => { j.vel += 0.15; }, bueno: true }, { n: "VELOCIDAD ABAJO", f: (j) => { j.vel -= 0.1; } },
  { n: "¡ALCANCE ARRIBA!", f: (j) => { j.alcance += 0.75; }, bueno: true }, { n: "ALCANCE ABAJO", f: (j) => { j.alcance -= 0.5; } },
  { n: "¡SALUD TOTAL!", f: (j) => { j.vida = j.cont; }, bueno: true },
  { n: "MAL VIAJE", f: (j) => { if (vidaTotal(j) <= 2) { j.vida = j.cont; J.capsulaBien = true; } else { j.inv = 0; herirJugador(j, 1, "UNA CÁPSULA"); } } },
  { n: "¡SUERTE ARRIBA!", f: (j) => { j.suerte += 1; }, bueno: true }, { n: "SUERTE ABAJO", f: (j) => { j.suerte -= 1; } },
  { n: "BOMBAS POR LLAVES", f: (j) => { [j.bombas, j.llaves] = [j.llaves, j.bombas]; }, bueno: true },
  { n: "¡ESPORAS DE VIDA!", f: (j) => { darEsporas(j, 2); }, bueno: true },
  { n: "¡DAÑO ARRIBA!", f: (j) => { j.danoPlano += 0.4; }, bueno: true },
];
function sortearCapsulas() { J.capsulas = A.mezclar(EFECTOS_CAPSULA.slice()).slice(0, COLORES_CAPSULA.length); J.capsulasVistas = new Set(); }
function nombreCapsula(i) { return J.capsulasVistas.has(i) ? J.capsulas[i].n : "UNA CÁPSULA"; }
function tomarCapsula(j) {
  if (j.capsula == null) return;
  const i = j.capsula, e = J.capsulas[i];
  j.capsula = null; J.capsulasVistas.add(i); J.capsulaBien = false;
  const antes = fotoCuentas(j);
  e.f(j);
  anotarCambios(antes);
  rotulo(J.capsulaBien ? "¡SALUD TOTAL!" : e.n, "");
  SFX[e.bueno || J.capsulaBien ? "capsula" : "malo"]();
}

// lo que cambió en las cuentas (el HUD lo muestra en verde o rojo al lado, como el original)
function fotoCuentas(j) { return { vel: velDe(j), lag: lagrimasPorSeg(j), dano: danoDe(j), alc: j.alcance, tiro: j.velLag, suerte: j.suerte }; }
function anotarCambios(antes) {
  const d = fotoCuentas(J.jug);
  J.cambios ||= {};
  for (const k in d) if (Math.abs(d[k] - antes[k]) > 0.005) J.cambios[k] = { d: d[k] - antes[k], t: 200 };
}

function usarActivo(j) {
  const a = j.activo;
  if (!a || j.muerto) return;
  if (a.carga < a.max) { SFX.clic(); return; }
  a.carga = 0;
  OBJETOS[a.id].usar(j);
  SFX.activo();
}
function cargarActivo(n = 1) {
  const a = J.jug.activo;
  if (!a || a.carga >= a.max) return;
  a.carga = Math.min(a.max, a.carga + n);
  if (a.carga >= a.max) SFX.cargado();
}

// ── los familiares ──
function armarFamiliares() {
  const j = J.jug, viejos = J.familiares.filter((f) => f.tipo === "moscaAzul");
  J.familiares = viejos;
  if (j.objetos.includes("moscaAmiga")) J.familiares.push({ tipo: "mosca", x: j.x, y: j.y, a: 0, bloquea: true, t: 0 });
  if (j.objetos.includes("hermanito")) J.familiares.push({ tipo: "hermanito", x: j.x, y: j.y + 10, enfriar: 0, mirar: ABAJO, t: 0 });
}
function actualizarFamiliares() {
  const j = J.jug;
  for (let i = J.familiares.length - 1; i >= 0; i--) {
    const f = J.familiares[i];
    f.t++;
    if (f.tipo === "mosca") {
      f.a += 0.055; f.x = j.x + Math.cos(f.a) * 20; f.y = j.y - 4 + Math.sin(f.a) * 15;
      if (f.t % 8 === 0) for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y, f.x, f.y) < e.r + 5) danarEnemigo(e, 2.5);
    } else if (f.tipo === "hermanito") {
      const tx = j.x - DIRS[j.mirar][0] * 18, ty = j.y - DIRS[j.mirar][1] * 16 + 2;
      f.x += (tx - f.x) * 0.08; f.y += (ty - f.y) * 0.08;
      if (f.enfriar > 0) f.enfriar--;
      if ((IN.dx || IN.dy) && f.enfriar <= 0 && J.congelado <= 0) {
        f.mirar = j.mirar; f.enfriar = 34;
        J.lagrimas.push({ x: f.x, y: f.y, z: 12, vx: IN.dx * 3.1, vy: IN.dy * 3.1, vida: 48, vidaMax: 48, r: 3, dano: 3.5, color: "violeta", tocados: null });
      } else if (!(IN.dx || IN.dy)) f.mirar = ABAJO;
    } else if (f.tipo === "moscaAzul") {
      let obj = null, md = 1e9;
      for (const e of J.enemigos) { if (!blanco_(e)) continue; const d = dist(e.x, e.y, f.x, f.y); if (d < md) { md = d; obj = e; } }
      const tx = obj ? obj.x : j.x + Math.cos(f.t * 0.05 + i) * 16, ty = obj ? obj.y - 4 : j.y - 6 + Math.sin(f.t * 0.05 + i) * 12;
      const d = dist(tx, ty, f.x, f.y) || 1, v = obj ? 1.8 : 1.2;
      f.x += (tx - f.x) / d * Math.min(v, d); f.y += (ty - f.y) / d * Math.min(v, d);
      if (obj && md < obj.r + 4) { danarEnemigo(obj, 8); sangrar(f.x, f.y, 3, PAL.azul); J.familiares.splice(i, 1); continue; }
      if (--f.t <= 0 && !obj) J.familiares.splice(i, 1);
    }
  }
}
function dibujarFamiliar(g, f) {
  if (f.tipo === "mosca" || f.tipo === "moscaAzul") {
    const s = tinte(mosquinSpr((f.t >> 1) & 1), "rgba(110,170,255,0.55)");
    g.drawImage(sombra(3, 1), Math.round(f.x - 3), Math.round(f.y + 6));
    g.drawImage(s, Math.round(f.x - s.width / 2), Math.round(f.y - s.height / 2 - 4));
  } else if (f.tipo === "hermanito") {
    const s = spritesShumio(PAL.piel, PAL.violeta, PAL.azul, "hermanito");
    const cab = s.cab[VISTA_CAB[f.mirar]][f.enfriar > 28 ? 1 : 0];
    g.drawImage(sombra(5, 2), Math.round(f.x - 5), Math.round(f.y + 2));
    g.drawImage(cab, Math.round(f.x - 11), Math.round(f.y - 18 + Math.sin(f.t * 0.1)));
  }
}

// ── dibujar lo que está en el piso ──
function dibujarCosa(g, c) {
  const X = Math.round(c.x), Y = Math.round(c.y), z = Math.round(c.z);
  let s = null;
  switch (c.t) {
    case "corazon": s = corazonSpr(c.sub); break;
    case "moneda": s = monedaSpr(Math.floor(c.k / 6) % 4, c.sub); break;
    case "bomba": s = bombaSpr(0.8); break;
    case "llave": s = llaveSpr(); break;
    case "capsula": s = capsulaSpr(c.sub); break;
    case "cofre": s = cofreSpr(c.sub === "dorado", !!c.abierto); if (c.sacudida > 0) { c.sacudida--; g.save(); g.translate(Math.round(Math.sin(c.sacudida * 2.2) * 1.5), 0); g.drawImage(sombra(8, 2), X - 8, Y); g.drawImage(s, X - Math.floor(s.width / 2), Y + 2 - s.height); g.restore(); return; } break;
    case "cofreFinal": { s = cofreSpr(true, !!c.abierto); const w = s.width * 2, h = s.height * 2; g.drawImage(sombra(16, 4), X - 16, Y - 2); g.drawImage(s, X - w / 2, Y + 2 - h, w, h); return; }
    case "trampilla": s = trampillaSpr(!!c.abierta); g.drawImage(s, X - 14, Y - 14); return;
    case "objeto": {
      g.drawImage(pedestalSpr(), X - 11, Y - 8);
      if (c.id) {
        const bob = Math.round(Math.sin(c.k * 0.07) * 2), ic = J.maldicion === "ciego" ? preguntaSpr() : iconoSpr(c.id);
        g.drawImage(sombra(5, 2), X - 5, Y - 12);
        g.drawImage(ic, X - 9, Y - 30 + bob);
      }
      dibujarPrecio(g, c, X, Y + 12);
      return;
    }
  }
  if (!s) return;
  g.drawImage(sombra(Math.max(3, (s.width >> 1) - 1), 2), X - Math.max(3, (s.width >> 1) - 1), Y);
  g.drawImage(s, X - Math.floor(s.width / 2), Y + 2 - s.height - z);
  if (c.precio) dibujarPrecio(g, c, X, Y + 6);
}
function dibujarPrecio(g, c, x, y) {
  if (c.precio && c.id !== null) {
    const n = cifrasSpr(c.precio), m = monedaChica();
    const w = n.width + m.width;
    g.drawImage(n, Math.round(x - w / 2), y); g.drawImage(m, Math.round(x - w / 2 + n.width), y);
  }
  if (c.pacto && c.id) {
    const h = corazonSpr("rojo", true), w = h.width * c.pacto;
    for (let i = 0; i < c.pacto; i++) g.drawImage(h, Math.round(x - w / 2 + i * h.width), y);
  }
}

/** El signo de pregunta rojo que tapa los objetos con la maldición del ciego (como en el video). */
function preguntaSpr() {
  return hornear("preguntaRoja", () => {
    const p = new Pix(18, 18), R = ["#5a0408", "#a8101a", "#e02632", "#ff6a70"];
    p.sello(4, 1, [".######.", "########", "###..###", "###..###", "....####", "...####.", "..####..", "..###...", "..###...", "........", "..###...", "..###..."].map((f) => f), { "#": R[2] });
    // el volumen: luz arriba a la izquierda, sombra abajo
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const c = p.g(x, y); if (!c) continue; if (!p.g(x - 1, y) || !p.g(x, y - 1)) p.p(x, y, R[3]); else if (!p.g(x + 1, y) || !p.g(x, y + 1)) p.p(x, y, R[1]); }
    p.contorno(PAL.tinta, true);
    return p.canvas();
  });
}
