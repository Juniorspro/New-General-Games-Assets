// El resolvedor: recorre a lo ancho todos los estados a los que Lu puede
// llegar (celda + qué frágiles rompió) y dice si el nivel se puede ganar, en
// cuántos deslizamientos como mínimo, qué estrellas y monedas se alcanzan y si
// hay trampas: lugares a los que se llega vivo pero de donde ya no se sale.
//
// Lo que se mueve con el reloj (polillas, fuego, erizos inflados, pinchos que
// suben) no lo mira: se pasa esperando el momento. Por eso los niveles se
// diseñan con eso en la cabeza y la prueba en el navegador lo completa.
import { deslizar, O } from './reglas.js';

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function resolver(nv, desde = nv.inicio) {
  const clave = (x, y, r) => `${x},${y},${r}`;
  const inicio = clave(desde.x, desde.y, 0);
  const estados = new Map([[inicio, { x: desde.x, y: desde.y, rotas: 0, previo: null, dir: -1, dist: 0 }]]);
  const cola = [inicio];
  const aristas = new Map();          // estado → estados a los que lleva (para ver trampas)
  const pasadas = new Set();          // celdas que alguna vez se cruzan
  const ganadores = new Set();        // estados desde los que un deslizamiento gana
  let bucles = 0, mejor = null;

  for (let k = 0; k < cola.length; k++) {
    const c = cola[k], e = estados.get(c);
    const hijos = [];
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS4[d];
      const r = deslizar(nv, e.x, e.y, dx, dy, e.rotas);
      if (r.bucle) { bucles++; continue; }
      for (const i of r.pasadas) pasadas.add(i);
      if (r.muere) continue;
      if (r.gana) {
        ganadores.add(c);
        if (!mejor || e.dist + 1 < mejor.dist) mejor = { dist: e.dist + 1, desde: c, dir: d };
        continue;
      }
      if (!r.movio && r.rotas === e.rotas) continue;
      const h = clave(r.x, r.y, r.rotas);
      hijos.push(h);
      if (!estados.has(h)) {
        estados.set(h, { x: r.x, y: r.y, rotas: r.rotas, previo: c, dir: d, dist: e.dist + 1 });
        cola.push(h);
      }
    }
    aristas.set(c, hijos);
  }

  // De atrás para adelante: qué estados todavía pueden ganar.
  const inversas = new Map();
  for (const [a, hs] of aristas) for (const h of hs) (inversas.get(h) || inversas.set(h, []).get(h)).push(a);
  const salvables = new Set(ganadores), pila = [...ganadores];
  while (pila.length) for (const a of inversas.get(pila.pop()) || []) if (!salvables.has(a)) { salvables.add(a); pila.push(a); }
  const trampas = [...estados.keys()].filter((c) => !salvables.has(c));

  // El camino más corto, como lista de direcciones (lo usa el bot de prueba).
  let camino = null;
  if (mejor) {
    camino = [mejor.dir];
    for (let c = mejor.desde; estados.get(c).previo; c = estados.get(c).previo) camino.unshift(estados.get(c).dir);
  }

  // Qué se alcanza: lo que está en una celda por la que se pasa.
  const cuenta = (o) => { let hay = 0, llega = 0; nv.obj.forEach((v, i) => { if (v === o) { hay++; if (pasadas.has(i)) llega++; } }); return [llega, hay]; };
  const [estrellas, estrellasHay] = cuenta(O.ESTRELLA), [monedas, monedasHay] = cuenta(O.MONEDA), [chispas, chispasHay] = cuenta(O.CHISPA);

  return {
    gana: !!mejor, minimo: mejor ? mejor.dist : Infinity, camino,
    estados: estados.size, trampas, bucles,
    estrellas, estrellasHay, monedas, monedasHay, chispas, chispasHay, pasadas,
    DIRS: DIRS4,
  };
}
