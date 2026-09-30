// Las reglas del laberinto, sin dibujo ni reloj. Las usan la partida, el
// resolvedor y la torre: así lo que el resolvedor da por resuelto es lo mismo
// que se juega, y un cambio de regla no deja niveles imposibles sin avisar.

// Qué hay en cada celda (el piso o lo que lo tapa).
export const T = {
  VACIO: 0, PARED: 1, FRAGIL: 2, CABEZA: 3,
  PINCHOS: 4, PINCHOS_A: 5, PINCHOS_B: 6,
  FLECHA_DER: 7, FLECHA_IZQ: 8, FLECHA_ARR: 9, FLECHA_ABA: 10,
  PORTAL: 11, SALIDA: 12, LAVA: 13, ERIZO: 14,
};
// Lo que se junta.
export const O = { NADA: 0, CHISPA: 1, MONEDA: 2, ESTRELLA: 3, ESCUDO: 4, HIELO: 5, IMAN: 6, DOBLE: 7 };

export const DIR_FLECHA = { [T.FLECHA_DER]: [1, 0], [T.FLECHA_IZQ]: [-1, 0], [T.FLECHA_ARR]: [0, -1], [T.FLECHA_ABA]: [0, 1] };
const CABEZA_DIR = { '<': [-1, 0], '>': [1, 0], '^': [0, -1], v: [0, 1] };
const FLECHA_DE = { R: T.FLECHA_DER, L: T.FLECHA_IZQ, U: T.FLECHA_ARR, D: T.FLECHA_ABA };
const PODER_DE = { o: O.ESCUDO, i: O.HIELO, g: O.IMAN, 2: O.DOBLE };

// El mapa de un nivel, fila por fila de arriba a abajo:
//   #  pared            .  chispa           (espacio) piso vacío
//   S  inicio           E  salida           *  estrella       c  moneda
//   x  pinchos fijos    t / T  pinchos que suben y bajan (T va a contratiempo)
//   m / M  polilla que va y viene de costado / de arriba a abajo
//   < > ^ v  cabeza de piedra (es pared) que escupe fuego hacia ahí
//   u  erizo            f  pared frágil (un golpe y se cae)
//   A-a  B-b  portales gemelos      R L U D  flechas que obligan a doblar
//   o  escudo   i  hielo   g  imán   2  monedas dobles     ~  lava quieta
export function leer(def) {
  const filas = def.mapa;
  const alto = filas.length, ancho = Math.max(...filas.map((f) => f.length));
  const n = ancho * alto;
  const nv = {
    id: def.id, mundo: def.mundo || 0, ancho, alto,
    tipo: new Uint8Array(n), obj: new Uint8Array(n),
    pareja: new Map(), bitFragil: new Map(), fragiles: [],
    polillas: [], erizos: [], cabezas: [], pinchosMoviles: [],
    inicio: null, salida: null, chispas: 0, monedas: 0, estrellas: 0,
    lava: def.lava || null, aviso: def.aviso || null,
  };
  const portales = {};
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const ch = filas[y][x] ?? '#', i = y * ancho + x;
    let t = T.VACIO, o = O.NADA;
    switch (ch) {
      case '#': t = T.PARED; break;
      case '.': o = O.CHISPA; break;
      case ' ': break;
      case 'S': nv.inicio = { x, y }; break;
      case 'E': t = T.SALIDA; nv.salida = { x, y }; break;
      case '*': o = O.ESTRELLA; break;
      case 'c': o = O.MONEDA; break;
      case 'x': t = T.PINCHOS; break;
      case 't': t = T.PINCHOS_A; nv.pinchosMoviles.push(i); break;
      case 'T': t = T.PINCHOS_B; nv.pinchosMoviles.push(i); break;
      // la polilla arranca en su carril, donde Lu no frena: sin chispa (no se juntaría nunca)
      case 'm': case 'M': nv.polillas.push({ x, y, eje: ch === 'm' ? 'h' : 'v' }); break;
      case 'u': t = T.ERIZO; nv.erizos.push({ x, y }); break;
      case 'f': t = T.FRAGIL; nv.bitFragil.set(i, nv.fragiles.length); nv.fragiles.push(i); break;
      case '~': t = T.LAVA; break;
      case '<': case '>': case '^': case 'v': t = T.CABEZA; nv.cabezas.push({ x, y, dx: CABEZA_DIR[ch][0], dy: CABEZA_DIR[ch][1] }); break;
      case 'A': case 'a': case 'B': case 'b': t = T.PORTAL; (portales[ch.toUpperCase()] ||= []).push(i); break;
      default:
        if (FLECHA_DE[ch] !== undefined) t = FLECHA_DE[ch];
        else if (PODER_DE[ch] !== undefined) o = PODER_DE[ch];
        else throw new Error(`nivel ${def.id}: letra desconocida '${ch}' en (${x}, ${y})`);
    }
    nv.tipo[i] = t; nv.obj[i] = o;
    if (o === O.CHISPA) nv.chispas++;
    else if (o === O.MONEDA) nv.monedas++;
    else if (o === O.ESTRELLA) nv.estrellas++;
  }
  for (const [letra, par] of Object.entries(portales)) {
    if (par.length !== 2) throw new Error(`nivel ${def.id}: el portal ${letra} tiene ${par.length} bocas (van de a dos)`);
    nv.pareja.set(par[0], par[1]); nv.pareja.set(par[1], par[0]);
  }
  if (!nv.inicio) throw new Error(`nivel ${def.id}: no tiene inicio (S)`);
  return nv;
}

// Lo sólido para Lu: las paredes, la cabeza de piedra y la frágil que sigue
// en pie. Afuera del mapa también es pared. `rotas` es una máscara de bits
// (el resolvedor prueba caminos sin tocar el nivel); la partida rompe de
// verdad (cambia el tipo a VACIO) y pasa 0.
export function esSolida(nv, x, y, rotas = 0) {
  if (x < 0 || x >= nv.ancho || y < 0 || y >= nv.alto) return true;
  const i = y * nv.ancho + x, t = nv.tipo[i];
  if (t === T.FRAGIL) return !(rotas & (1 << nv.bitFragil.get(i)));
  return t === T.PARED || t === T.CABEZA;
}

// Lo que mata siempre, esté como esté el reloj: pinchos fijos, lava y erizo.
export const mataSiempre = (t) => t === T.PINCHOS || t === T.LAVA || t === T.ERIZO;

// Si en (x, y) hay una frágil en pie, la rompe (devuelve la máscara nueva).
export function romper(nv, x, y, rotas) {
  if (x < 0 || x >= nv.ancho || y < 0 || y >= nv.alto) return rotas;
  const i = y * nv.ancho + x;
  if (nv.tipo[i] !== T.FRAGIL) return rotas;
  return rotas | (1 << nv.bitFragil.get(i));
}

// Lu llegó a (x, y) andando hacia (dx, dy) y ya juntó lo que había. Los
// portales la mandan a la otra boca (sigue para el mismo lado) y las flechas
// le cambian el rumbo. Si lo que sigue es sólido, se para ahí.
export function seguir(nv, x, y, dx, dy, rotas = 0) {
  const i = y * nv.ancho + x, t = nv.tipo[i];
  let portal = false, flecha = false;
  if (t === T.PORTAL) {
    const j = nv.pareja.get(i);
    x = j % nv.ancho; y = (j / nv.ancho) | 0; portal = true;
  } else if (DIR_FLECHA[t]) {
    [dx, dy] = DIR_FLECHA[t]; flecha = true;
  }
  return { x, y, dx, dy, portal, flecha, parar: esSolida(nv, x + dx, y + dy, rotas) };
}

// Un deslizamiento entero, de una: el que usa el resolvedor (la partida
// hace lo mismo celda por celda, con el reloj andando). Devuelve dónde queda,
// por dónde pasó y si murió, ganó o quedó dando vueltas para siempre.
const INDICE_DIR = (dx, dy) => (dx > 0 ? 0 : dx < 0 ? 1 : dy < 0 ? 2 : 3);
export function deslizar(nv, x, y, dx, dy, rotas = 0) {
  const r = { x, y, dx, dy, rotas, movio: false, pasadas: [], muere: false, gana: false, bucle: false };
  if (esSolida(nv, x + dx, y + dy, rotas)) { r.rotas = romper(nv, x + dx, y + dy, rotas); return r; }
  const vistas = new Set();
  r.movio = true;
  for (;;) {
    x += dx; y += dy;
    const i = y * nv.ancho + x;
    r.pasadas.push(i);
    const t = nv.tipo[i];
    if (mataSiempre(t)) { r.muere = true; r.x = x; r.y = y; return r; }
    if (t === T.SALIDA) { r.gana = true; r.x = x; r.y = y; return r; }
    const clave = i * 4 + INDICE_DIR(dx, dy);
    if (vistas.has(clave)) { r.bucle = true; return r; }
    vistas.add(clave);
    const s = seguir(nv, x, y, dx, dy, rotas);
    x = s.x; y = s.y; dx = s.dx; dy = s.dy;
    if (s.parar) {
      Object.assign(r, { x, y, dx, dy, rotas: romper(nv, x + dx, y + dy, rotas) });
      return r;
    }
  }
}
