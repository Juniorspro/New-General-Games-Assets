// Bot de búsqueda por haces: prueba soltar o mantener cada 1/60 s, descarta estados repetidos y
// avanza hasta completar el nivel. Si la física o los choques se apartan del original, algún
// tramo se vuelve imposible y el bot lo dice (dónde y contra qué).
//
//   node porteos/gd/pruebas/bot.js 1 2 3 ...         (ANCHO=700 para los difíciles)
//   MAPA=m.json node porteos/gd/pruebas/bot.js 13    (y python3 mapa.py m.json m.png: el tramo
//                                                     donde se trabó, con formas y recorrido)
const { GD, nivel } = require('./cargar.js');
const PASOS_DECISION = 4;
async function resolver(n, ancho = +(process.env.ANCHO || 150), limiteSeg = +(process.env.LIMITE || 900)) {
  const nv = await nivel(n);
  const j = new GD.Juego(nv);
  let frente = [{ s: j.guardar(), sost: false, padre: null, paso: 0 }];
  let mejor = { x: 0, causa: null };
  const t0 = Date.now();
  let decisiones = 0;
  while (true) {
    const sig = [], vistos = new Set();
    let muertes = new Map();
    for (const nodo of frente) {
      for (const sost of [false, true]) {
        j.restaurar(nodo.s);
        if (sost !== nodo.sost) { if (sost) j.jugador.presionar(); else j.jugador.soltar(); }
        let causa = null;
        j.on('muerte', (o) => { causa = o; });
        for (let i = 0; i < PASOS_DECISION && !j.muerto && !j.completo; i++) j.paso();
        const J = j.jugador;
        if (J.x > mejor.x) mejor = { nodo, x: J.x, estado: { modo: J.modo, y: +J.y.toFixed(1), vy: +J.vy.toFixed(2), inv: J.invertido, mini: J.mini, vel: J.velocidad, suelo: j.suelo, techo: j.techo, dual: !!j.dual, espejo: j.espejo } };
        if (j.muerto) { const k = causa ? `${causa.id}@${causa.x},${causa.y}` : "borde"; muertes.set(k, (muertes.get(k) || 0) + 1); continue; }
        const hijo = { sost, padre: nodo, paso: j.pasos, xy: [J.x, J.y, J.modo, J.invertido] };
        if (j.completo) {
          const camino = []; for (let p = hijo; p; p = p.padre) camino.push([p.paso, p.sost]);
          return { ok: true, n, seg: j.tiempo, ms: Date.now() - t0, decisiones, camino: camino.reverse() };
        }
        const clave = `${Math.round(J.y * 2)}|${Math.round(J.vy * 4)}|${J.modo}|${J.invertido}|${J.mini}|${J.enSuelo}|${J.velocidad}|${j.usados.size}|${j.rotos.size}|${sost}|${J.impulsado}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        hijo.s = j.guardar();
        sig.push(hijo);
      }
    }
    decisiones++;
    if (!sig.length) {
      const peor = [...muertes].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const camino = []; for (let p = mejor.nodo; p; p = p.padre) if (p.xy) camino.push(p.xy);
      if (process.env.MAPA) {
        const x0 = mejor.x - +(process.env.ANTES || 1200), x1 = mejor.x + 300;
        const formas = nv.objetos.filter((o) => o.x > x0 - 60 && o.x < x1 + 60 && o.def.hitbox && o.tipo !== 'deco').map((o) => ({ t: o.tipo, s: o.sub, id: o.id, f: GD.formaDe(o, o.def.hitbox) }));
        require('fs').writeFileSync(process.env.MAPA, JSON.stringify({ x0, x1, formas, camino: camino.reverse(), muerte: mejor.x }));
      }
      return { ok: false, n, x: mejor.x, estado: mejor.estado, cerca: nv.objetos.filter((o) => Math.abs(o.x - mejor.x) < 240 && o.tipo !== 'deco').map((o) => `${o.id}:${o.tipo}${o.sub ? '/' + o.sub : ''}@${Math.round(o.x)},${Math.round(o.y)}${o.grupos.length ? ' g' + o.grupos.join('.') : ''}${o.rot ? ' r' + o.rot : ''}`), seg: j.tiempo, muertes: peor, ms: Date.now() - t0, decisiones, progreso: (100 * mejor.x / nv.largo).toFixed(1) };
    }
    frente = sig.length > ancho ? podar(sig, ancho) : sig;
    for (const f of frente) if (f.padre) f.padre.s = null;     // los padres ya no hacen falta (memoria)
    if ((Date.now() - t0) / 1000 > limiteSeg) return { ok: false, n, timeout: true, x: mejor.x, progreso: (100 * mejor.x / nv.largo).toFixed(1) };
  }
}

// Poda con variedad. Los estados se agrupan por lo que cambia el resto del nivel (modo, gravedad,
// tamaño, velocidad, portales usados, bloques rotos) y, adentro de cada grupo, por "celda": altura
// de a 8 unidades, si sube, baja o está quieto, y si está apoyado. Primero entra un estado de cada
// celda (con las celdas en orden intercalado: la más baja, la más alta, la del medio...) y los
// grupos se turnan para llenar el ancho. Así no se pierde un camino raro (el que pasa un portal,
// el que salta desde el piso debajo de una plataforma) por estar mezclado con muchos parecidos.
function intercalado(n) {
  const orden = [], visto = new Set();
  for (let k = 0; orden.length < n; k++) {
    let f = 0, b = 0.5;
    for (let x = k; x; x >>= 1, b /= 2) if (x & 1) f += b;      // van der Corput: 0, ½, ¼, ¾...
    const i = Math.min(n - 1, Math.round(f * (n - 1)));
    if (!visto.has(i)) { visto.add(i); orden.push(i); }
    if (k > 4 * n) { for (let i2 = 0; i2 < n; i2++) if (!visto.has(i2)) orden.push(i2); break; }
  }
  return orden;
}

function podarCeldas(sig, ancho) {
  const grupos = new Map();
  for (const h of sig) {
    const J = h.s.jugador, G = h.s.juego;
    const g = `${J.modo}|${J.invertido}|${J.mini}|${J.velocidad}|${G.usados.size}|${G.rotos.size}`;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(h);
  }
  const colas = [];
  for (const l of grupos.values()) {
    const celdas = new Map();
    for (const h of l) {
      const J = h.s.jugador;
      const c = `${Math.round(J.y / 8)}|${J.vy > 0.5 ? 1 : J.vy < -0.5 ? -1 : 0}|${J.enSuelo}`;
      if (!celdas.has(c)) celdas.set(c, []);
      celdas.get(c).push(h);
    }
    const lista = [...celdas.values()].sort((a, b) => a[0].s.jugador.y - b[0].s.jugador.y);
    const orden = intercalado(lista.length).map((i) => lista[i]);
    const cola = [];
    for (let ronda = 0, hay = true; hay; ronda++) {
      hay = false;
      for (const c of orden) if (ronda < c.length) { cola.push(c[ronda]); hay = true; }
    }
    colas.push(cola);
  }
  const res = [];
  for (let i = 0; res.length < ancho; i++) {
    let algo = false;
    for (const q of colas) if (i < q.length && res.length < ancho) { res.push(q[i]); algo = true; }
    if (!algo) break;
  }
  return res;
}
// La poda anterior: cada grupo con su parte del ancho y, adentro, estados repartidos por altura
// (fina en la velocidad: es la que sirve para la nave).
function podarAltura(sig, ancho) {
  const grupos = new Map();
  for (const h of sig) {
    const J = h.s.jugador, G = h.s.juego;
    const g = `${J.modo}|${J.invertido}|${J.mini}|${J.velocidad}|${G.usados.size}|${G.rotos.size}`;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(h);
  }
  const lista = [...grupos.values()];
  const minimo = Math.min(8, Math.floor(ancho / lista.length));
  const resto = ancho - lista.reduce((a, l) => a + Math.min(l.length, minimo), 0);
  const total = lista.reduce((a, l) => a + Math.max(0, l.length - minimo), 0);
  const res = [];
  for (const l of lista) {
    const extra = total ? Math.floor(resto * Math.max(0, l.length - minimo) / total) : 0;
    const k = Math.min(l.length, Math.min(l.length, minimo) + extra);
    l.sort((a, b) => a.s.jugador.y - b.s.jugador.y);
    if (k >= l.length) { res.push(...l); continue; }
    for (let i = 0; i < k; i++) res.push(l[Math.round(i * (l.length - 1) / Math.max(1, k - 1))]);
  }
  return res;
}

// Las dos juntas: la mitad del ancho para cada una, y lo que sobre se completa con la otra.
function podar(sig, ancho) {
  const res = new Set(podarCeldas(sig, Math.ceil(ancho / 2)));
  for (const h of podarAltura(sig, ancho)) { if (res.size >= ancho) break; res.add(h); }
  for (const h of podarCeldas(sig, ancho)) { if (res.size >= ancho) break; res.add(h); }
  return [...res];
}

module.exports = { resolver, podar };
if (require.main === module) {
  (async () => {
    const niveles = process.argv.slice(2).map(Number);
    for (const n of niveles) {
      const r = await resolver(n);
      if (r.ok) console.log(`nivel ${n}: COMPLETO en ${r.seg.toFixed(1)} s de juego (${(r.ms / 1000).toFixed(1)} s de cálculo, ${r.camino.length} cambios)`);
      else { console.log(`nivel ${n}: trabado en ${r.progreso}% (x=${r.x.toFixed(0)})${r.timeout ? ' — tiempo agotado' : ''} · muertes: ${JSON.stringify(r.muertes)} · ${(r.ms / 1000).toFixed(1)} s`); console.log('   estado:', JSON.stringify(r.estado)); if (r.cerca) console.log('   cerca:', r.cerca.join('  ')); }
    }
  })();
}
