// ─────────────────────────────────────────────────────────────────────────────
// EL PISO: el mapa de salas, generado como en el original. Una grilla de 9×8; desde la sala
// de inicio (4,3) se expande a lo ancho: cada vecino se agrega salvo que ya esté lleno, que ya
// tenga 2 vecinos llenos (así no se forman bloques y quedan pasillos y puntas), que se haya
// llegado a la cuota, o que salga cara en una moneda (50 %). Salas = azar(0..1) + 5 + piso × 2,6.
// El jefe va en la punta más lejana; el tesoro y la tienda en otras puntas; la secreta en un
// hueco rodeado por 3 salas o más (que se abre con una bomba). Si no alcanzan las puntas, se
// vuelve a tirar.
// ─────────────────────────────────────────────────────────────────────────────

const MAPA_W = 9, MAPA_H = 8, MAPA_INICIO = [4, 3];
const PISOS = [
  null,
  { cap: "sotano", nombre: "SÓTANO HÚMEDO I", musica: "sotano" },
  { cap: "sotano", nombre: "SÓTANO HÚMEDO II", musica: "sotano" },
  { cap: "raices", nombre: "LAS RAÍCES I", musica: "raices" },
  { cap: "raices", nombre: "LAS RAÍCES II", musica: "raices" },
];
const ULTIMO_PISO = 4;

function generarPiso(n) {
  for (let i = 0; i < 400; i++) { const p = intentarPiso(n); if (p) return p; }
  throw new Error("no se pudo generar el piso " + n);
}

function intentarPiso(n) {
  const meta = Math.min(19, A.ent(0, 1) + 5 + Math.floor(n * 2.6));
  const K = (c, f) => c + f * MAPA_W, dentro = (c, f) => c >= 0 && f >= 0 && c < MAPA_W && f < MAPA_H;
  const lleno = new Uint8Array(MAPA_W * MAPA_H);
  const vecinos = (c, f) => { let s = 0; for (const [dx, dy] of DIRS) if (dentro(c + dx, f + dy) && lleno[K(c + dx, f + dy)]) s++; return s; };
  const [c0, f0] = MAPA_INICIO;
  lleno[K(c0, f0)] = 1;
  let cuenta = 1;
  const cola = [[c0, f0]], orden = [[c0, f0]];
  while (cola.length) {
    const [c, f] = cola.shift();
    for (const [dx, dy] of DIRS) {
      const C = c + dx, F = f + dy;
      if (!dentro(C, F) || lleno[K(C, F)] || vecinos(C, F) > 1 || cuenta >= meta || A.si(0.5)) continue;
      lleno[K(C, F)] = 1; cuenta++; cola.push([C, F]); orden.push([C, F]);
    }
  }
  if (cuenta < meta) return null;

  // distancias desde el inicio (en salas)
  const dist = new Int16Array(MAPA_W * MAPA_H).fill(-1), q = [[c0, f0]];
  dist[K(c0, f0)] = 0;
  while (q.length) { const [c, f] = q.shift(); for (const [dx, dy] of DIRS) { const C = c + dx, F = f + dy; if (dentro(C, F) && lleno[K(C, F)] && dist[K(C, F)] < 0) { dist[K(C, F)] = dist[K(c, f)] + 1; q.push([C, F]); } } }

  const puntas = orden.filter(([c, f]) => !(c === c0 && f === f0) && vecinos(c, f) === 1);
  if (puntas.length < 3) return null;
  puntas.sort((a, b) => dist[K(b[0], b[1])] - dist[K(a[0], a[1])]);
  const jefe = puntas[0];
  if (dist[K(jefe[0], jefe[1])] < 3) return null;
  const resto = A.mezclar(puntas.slice(1));
  const tesoro = resto[0], tienda = resto[1];

  // la secreta: el hueco con más salas alrededor (3 o más; si no hay, 2), lejos del jefe
  let secreta = null, mejor = 0;
  for (let f = 0; f < MAPA_H; f++) for (let c = 0; c < MAPA_W; c++) {
    if (lleno[K(c, f)]) continue;
    const v = vecinos(c, f);
    if (v < 2) continue;
    if (Math.abs(c - jefe[0]) + Math.abs(f - jefe[1]) === 1) continue;
    const nota = v * 10 + A.f();
    if (nota > mejor) { mejor = nota; secreta = [c, f]; }
  }

  const piso = { n, cap: PISOS[n].cap, nombre: PISOS[n].nombre, salas: new Map(), inicio: null, jefe: null };
  const nueva = (c, f, tipo) => {
    const sala = { c, f, tipo, clave: K(c, f), semilla: A.ent(1, 2e9), espejo: A.ent(0, 3), visitada: false, vista: false,
      limpia: tipo !== "normal" && tipo !== "jefe", cosas: [], decal: null, celdas: null, huecos: [], puertas: [null, null, null, null] };
    let d = DISENO_INICIO;
    if (tipo === "normal") d = A.uno(DISENOS_OK);
    else if (tipo === "jefe") d = n === ULTIMO_PISO ? DISENO_JEFE_FINAL : DISENO_JEFE;
    else if (tipo === "tesoro") d = DISENO_TESORO;
    else if (tipo === "tienda") d = DISENO_TIENDA;
    else if (tipo === "secreta") d = DISENO_SECRETA;
    else if (tipo === "pacto") d = DISENO_PACTO;
    if (tipo !== "normal") sala.espejo = 0;
    sala.huecos = armarGrilla(sala, d);
    piso.salas.set(sala.clave, sala);
    return sala;
  };
  for (const [c, f] of orden) {
    let tipo = "normal";
    if (c === c0 && f === f0) tipo = "inicio";
    else if (c === jefe[0] && f === jefe[1]) tipo = "jefe";
    else if (c === tesoro[0] && f === tesoro[1]) tipo = "tesoro";
    else if (c === tienda[0] && f === tienda[1]) tipo = "tienda";
    nueva(c, f, tipo);
  }
  if (secreta) nueva(secreta[0], secreta[1], "secreta");
  piso.inicio = piso.salas.get(K(c0, f0));
  piso.jefe = piso.salas.get(K(jefe[0], jefe[1]));

  // las puertas (de los dos lados)
  for (const s of piso.salas.values()) for (let d = 0; d < 4; d++) {
    const C = s.c + DIRS[d][0], F = s.f + DIRS[d][1];
    if (!dentro(C, F)) continue;
    const o = piso.salas.get(K(C, F));
    if (!o) continue;
    const esp = (x) => x.tipo === "secreta";
    s.puertas[d] = {
      destino: o,
      tipo: tipoPuerta(s, o),
      llave: n >= 2 && (o.tipo === "tesoro" || o.tipo === "tienda" || s.tipo === "tesoro" || s.tipo === "tienda") && !esp(s) && !esp(o),
      secreta: esp(s) || esp(o),
      revelada: false,
    };
  }
  // la puerta con llave es UNA (se abre de un lado y queda abierta de los dos)
  for (const s of piso.salas.values()) for (let d = 0; d < 4; d++) { const p = s.puertas[d]; if (p && !p.par) { const o = p.destino.puertas[opuesta(d)]; p.par = o; o.par = p; } }
  llenarSalasEspeciales(piso);
  return piso;
}

function tipoPuerta(a, b) {
  for (const t of ["secreta", "jefe", "pacto", "tesoro", "tienda"]) if (a.tipo === t || b.tipo === t) return t === "secreta" ? "secreta" : t;
  return "normal";
}

/** Lo que hay en el tesoro, la tienda y la secreta (lo demás aparece al limpiar). */
function llenarSalasEspeciales(piso) {
  for (const s of piso.salas.values()) {
    if (s.tipo === "tesoro") s.cosas.push(pedestal(cx(6), cy(3), sacarObjeto("tesoro")));
    if (s.tipo === "tienda") {
      const ofertas = [
        { t: "objeto", id: sacarObjeto("tienda"), precio: 15 },
        { t: "corazon", sub: "rojo", precio: 3 },
        A.si(0.5) ? { t: "bomba", precio: 5 } : { t: "capsula", sub: A.ent(0, COLORES_CAPSULA.length - 1), precio: 4 },
        { t: "llave", precio: 5 },
        A.si(0.45) ? { t: "corazon", sub: "espora", precio: 5 } : { t: "objeto", id: sacarObjeto("tienda"), precio: 15 },
      ];
      ofertas.forEach((o, i) => {
        const x = cx(2 + i * 2), y = cy(3);
        if (o.t === "objeto") s.cosas.push(Object.assign(pedestal(x, y, o.id), { precio: o.precio }));
        else s.cosas.push(Object.assign(recogible(o.t, x, y, o.sub), { precio: o.precio, quieto: true }));
      });
      s.tendero = true;
    }
    if (s.tipo === "secreta") {
      if (A.si(0.3)) s.cosas.push(pedestal(cx(6), cy(3), sacarObjeto("secreta")));
      else {
        const n = A.ent(3, 5);
        for (let i = 0; i < n; i++) s.cosas.push(recogible(A.pesos([["moneda", 5], ["bomba", 2], ["llave", 1], ["corazon", 2]]), cx(4 + (i % 5)), cy(2 + ((i / 5) | 0) * 2 + (i % 2)), "espora"));
      }
    }
  }
}

/** La sala del pacto (no está en el mapa: se abre desde la del jefe si hubo suerte). */
function crearSalaPacto(piso, desde, dir) {
  const s = { c: -1, f: -1, tipo: "pacto", clave: -1, semilla: A.ent(1, 2e9), espejo: 0, visitada: false, vista: false, limpia: true, cosas: [], decal: null, celdas: null, huecos: [], puertas: [null, null, null, null] };
  s.huecos = armarGrilla(s, DISENO_PACTO);
  const ofertas = A.si(0.5) ? 2 : 1;
  for (let i = 0; i < ofertas; i++) {
    const id = sacarObjeto("pacto");
    s.cosas.push(Object.assign(pedestal(ofertas === 1 ? cx(6) : cx(4 + i * 4), cy(3), id), { pacto: OBJETOS[id] && OBJETOS[id].calidad >= 3 ? 2 : 1 }));
  }
  const p = { destino: desde, tipo: "pacto", llave: false, secreta: false, revelada: true };
  s.puertas[opuesta(dir)] = p;
  const q = { destino: s, tipo: "pacto", llave: false, secreta: false, revelada: true, par: p };
  p.par = q;
  desde.puertas[dir] = q;
  return s;
}

/** ¿La puerta se ve? (las secretas, sólo después de volarlas) */
function puertaVisible(p) { return p && (!p.secreta || p.revelada); }
