// La torre: un laberinto que se genera hacia arriba mientras se sube.
//
// Se hace por construcción, no probando al azar hasta que salga algo que se
// pueda jugar: se talla un CAMINO de deslizamientos (arriba, costado, arriba…)
// en la piedra maciza, y la pared donde frena cada tramo queda "reservada":
// nada de lo que se talle después puede abrirla. Un tramo solo depende de sus
// celdas y de esa pared, así que el camino sigue andando aunque después se
// tallen bolsillos y carriles alrededor.
//
// Tres reglas que puso el resolvedor (cada una salió de una trampa real, un
// lugar al que se llega vivo y del que no se sale):
//  - la base es una sola celda: un pasillo de lado a lado deja a Lu rebotando
//    entre las puntas sin volver a frenar en el medio;
//  - los bolsillos salen de donde Lu frena, para el lado contrario al tramo
//    que sigue: desde la punta, deslizarse de vuelta cruza la parada y sigue
//    por el camino;
//  - los carriles (por donde va y viene una polilla o vuela el fuego) solo
//    tocan el camino en los cruces y nada frena al lado de ellos: si no, se
//    entra al carril, se frena adentro y ya no se sale.
//
// Los peligros se ponen cuando la fila ya no puede cambiar, y en el camino
// solo van los que se esquivan con tiempo: pinchos que suben y bajan en medio
// de un tramo, polillas y fuego que lo cruzan de través, erizos al costado.
// Donde Lu frena nunca hay nada que la mate esperando.
//
// También arma niveles con final (finito: true): el mismo camino, con la
// salida arriba de todo.
import { T, O } from './reglas.js';
import { azar, entero } from './util.js';

const H = 1, V = 2, PARADA = 4;
const VECINAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Torre {
  constructor({ semilla = 1, ancho = 15, alto = 3000, mundo = 3, finito = false, dificultad = null } = {}) {
    this.r = azar(semilla);
    this.finito = finito;
    const n = ancho * alto;
    this.nv = {
      id: 'torre', mundo, ancho, alto, tipo: new Uint8Array(n).fill(T.PARED), obj: new Uint8Array(n),
      pareja: new Map(), bitFragil: new Map(), fragiles: [], polillas: [], erizos: [], cabezas: [], pinchosMoviles: [],
      inicio: null, salida: null, chispas: 0, monedas: 0, estrellas: 0, lava: null, aviso: null,
    };
    this.reservadas = new Set();      // paredes que no se pueden tallar
    this.ruta = new Map();            // celda → H | V | PARADA
    this.carriles = new Map();        // celda → 'h' | 'v'
    this.pendientes = [];             // lo que se pone cuando su fila queda fija
    this.monedasEn = new Set();
    this.premios = new Set();         // puntas de bolsillo con premio
    this.puntas = new Set();          // puntas de bolsillo sin premio (pueden llevar púas)
    this.segmentos = [];
    this.fallos = [];                 // cuántas veces se volvió a cada profundidad
    this.dificultad = dificultad || dificultadTorre;
    const y0 = alto - 2, cx = ancho >> 1;
    this.tallar(cx, y0);
    this.nv.inicio = { x: cx, y: y0 };
    this.cursor = { x: cx, y: y0 };
    this.ruta.set(y0 * ancho + cx, PARADA);
    this.ultima = [1, 0];             // como si viniera de costado: lo primero es subir
    this.minY = y0;
    this.hasta = alto;                // de esta fila para abajo, todo está fijo y adornado
    this.terminado = false;
  }

  idx(x, y) { return y * this.nv.ancho + x; }
  adentro(x, y) { return x >= 1 && x < this.nv.ancho - 1 && y >= 2 && y < this.nv.alto - 1; }
  tallada(x, y) { return this.nv.tipo[this.idx(x, y)] !== T.PARED; }
  tocaCarril(x, y) { return VECINAS.some(([i, j]) => this.carriles.has(this.idx(x + i, y + j))); }

  // ¿Se puede tallar un tramo desde (x, y) hacia (dx, dy), `largo` celdas?
  valido(x, y, dx, dy, largo) {
    const eje = dx ? 'h' : 'v';
    let nuevas = 0;
    for (let k = 1; k <= largo; k++) {
      const cx = x + dx * k, cy = y + dy * k, i = this.idx(cx, cy);
      if (!this.adentro(cx, cy) || this.reservadas.has(i)) return false;
      const car = this.carriles.get(i);
      if (car === eje) return false;                               // no se anda a lo largo de un carril
      // al lado de un carril solo se pasa cruzándolo
      if (!car && (this.carriles.has(this.idx(cx + dy, cy + dx)) || this.carriles.has(this.idx(cx - dy, cy - dx)))) return false;
      if (!this.tallada(cx, cy)) nuevas++;
    }
    const fx = x + dx * largo, fy = y + dy * largo;
    if (this.carriles.has(this.idx(fx, fy)) || this.tocaCarril(fx, fy)) return false;   // no se frena en un carril ni al lado
    const sx = fx + dx, sy = fy + dy;
    // donde frena tiene que ser pared (o el borde) y seguir siéndolo
    if (sx >= 0 && sx < this.nv.ancho && sy >= 0 && sy < this.nv.alto && this.tallada(sx, sy)) return false;
    return nuevas * 2 >= largo;                                     // que avance por lugar nuevo
  }

  // Un tramo más del camino. Se alterna: después de subir, de costado.
  tramo() {
    const r = this.r, { x, y } = this.cursor, A = this.nv.ancho;
    const opciones = [];
    if (this.ultima[0] !== 0) {
      for (let largo = 2; largo <= 9; largo++) opciones.push([0, -1, largo, largo <= 6 ? 3 : 1.5]);
      if (y < this.minY + 2) for (let largo = 1; largo <= 3; largo++) opciones.push([0, 1, largo, 0.4]);
    } else {
      for (const dx of [-1, 1]) for (let largo = 1; largo <= A - 3; largo++) opciones.push([dx, 0, largo, largo >= 3 ? 2 : 1]);
    }
    const validas = opciones.filter(([dx, dy, l]) => this.valido(x, y, dx, dy, l));
    if (!validas.length) return false;
    let tiro = r() * validas.reduce((s, o) => s + o[3], 0), elegida = validas[0];
    for (const o of validas) { if ((tiro -= o[3]) <= 0) { elegida = o; break; } }
    const [dx, dy, largo] = elegida;
    const seg = { x, y, dx, dy, largo, ultimaAntes: this.ultima, minYAntes: this.minY, nuevas: [], reservadas: [], carriles: [], monedas: [], rutaAntes: new Map(), pendientes: [], premios: [], puntas: [] };
    const marcar = (i, bit) => { if (!seg.rutaAntes.has(i)) seg.rutaAntes.set(i, this.ruta.get(i)); this.ruta.set(i, (this.ruta.get(i) || 0) | bit); };
    for (let k = 1; k <= largo; k++) {
      const i = this.idx(x + dx * k, y + dy * k);
      if (this.tallarEn(i)) seg.nuevas.push(i);
      marcar(i, dx ? H : V);
    }
    const fx = x + dx * largo, fy = y + dy * largo;
    marcar(this.idx(fx, fy), PARADA);
    this.reservar(this.idx(fx + dx, fy + dy), seg);
    this.segmentos.push(seg);
    // el bolsillo: desde donde arranca este tramo, para el otro lado
    this.bolsillo(x, y, -dx, -dy, seg);
    this.cursor = { x: fx, y: fy };
    this.ultima = [dx, dy];
    if (fy < this.minY) this.minY = fy;
    this.extras(seg);
    const filas = [y, fy, ...seg.nuevas.map((i) => (i / this.nv.ancho) | 0), ...seg.reservadas.map((i) => (i / this.nv.ancho) | 0)];
    seg.maxFila = Math.max(...filas);
    return true;
  }

  tallarEn(i) { if (this.nv.tipo[i] === T.PARED) { this.nv.tipo[i] = T.VACIO; return true; } return false; }
  tallar(x, y) { return this.tallarEn(this.idx(x, y)); }
  reservar(i, seg) { if (!this.reservadas.has(i)) { this.reservadas.add(i); seg.reservadas.push(i); } }

  // Un callejón corto que sale de una parada (con premio o con púas en la punta).
  bolsillo(x, y, dx, dy, seg) {
    const r = this.r, d = this.dificultad(this.nv.alto - y, this);
    if (r() > d.bolsillos) return;
    const hondo = entero(r, 1, 3);
    for (let j = 1; j <= hondo; j++) {
      const cx = x + dx * j, cy = y + dy * j, c = this.idx(cx, cy);
      if (!this.adentro(cx, cy) || this.tallada(cx, cy) || this.reservadas.has(c) || this.carriles.has(c) || this.tocaCarril(cx, cy)) return;
      // que no abra de costado a otro pasillo (sería otra salida, otra parada posible)
      if (this.tallada(cx + dy, cy + dx) || this.tallada(cx - dy, cy - dx)) return;
    }
    const sx = x + dx * (hondo + 1), sy = y + dy * (hondo + 1);
    if (sx >= 0 && sx < this.nv.ancho && sy >= 0 && sy < this.nv.alto && this.tallada(sx, sy)) return;
    for (let j = 1; j <= hondo; j++) { const c = this.idx(x + dx * j, y + dy * j); this.tallarEn(c); seg.nuevas.push(c); }
    this.reservar(this.idx(sx, sy), seg);
    const punta = this.idx(x + dx * hondo, y + dy * hondo);
    if (r() < d.premio) { this.premios.add(punta); seg.premios.push(punta); } else { this.puntas.add(punta); seg.puntas.push(punta); }
  }

  // Lo que se agrega alrededor de un tramo: monedas en fila y carriles.
  extras(seg) {
    const r = this.r, d = this.dificultad(this.nv.alto - seg.y, this);
    const { x, y, dx, dy, largo } = seg;
    if (largo >= 3 && r() < d.monedas) {
      const desde = entero(r, 1, Math.max(1, largo - 2)), cuantas = entero(r, 2, 4);
      for (let k = desde; k < Math.min(largo, desde + cuantas); k++) { const i = this.idx(x + dx * k, y + dy * k); this.monedasEn.add(i); seg.monedas.push(i); }
    }
    if (largo >= 4 && r() < d.carriles) this.carril(seg, d);
  }

  // Un carril que cruza el tramo de través, tallado en piedra maciza: ahí va
  // y viene una polilla, o escupe una cabeza desde la pared del borde.
  carril(seg, d) {
    const r = this.r, { x, y, dx, dy, largo } = seg, A = this.nv.ancho;
    // el cruce, a dos celdas por lo menos de cada parada (al lado de una, se
    // entraría al carril desde la parada y se frenaría adentro)
    const k = entero(r, 2, largo - 2), cx = x + dx * k, cy = y + dy * k, cruce = this.idx(cx, cy);
    if (this.carriles.has(cruce)) return;
    const [ex, ey] = dx ? [0, 1] : [1, 0];
    const eje = ex ? 'h' : 'v';
    const a = entero(r, 1, 4), b = entero(r, 1, 4);
    const celdas = [];
    for (let j = -a; j <= b; j++) celdas.push([cx + ex * j, cy + ey * j]);
    const propias = new Set(celdas.map(([qx, qy]) => this.idx(qx, qy)));
    for (const [qx, qy] of celdas) {
      const c = this.idx(qx, qy);
      if (!this.adentro(qx, qy) || this.reservadas.has(c) || this.carriles.has(c)) return;
      if (c === cruce) continue;
      if (this.tallada(qx, qy) || this.ruta.has(c)) return;
      // piedra maciza alrededor: lo único tallado al lado es el mismo carril y el cruce
      for (const [i, j] of VECINAS) {
        const v = this.idx(qx + i, qy + j);
        if (!propias.has(v) && this.tallada(qx + i, qy + j)) return;
      }
    }
    if (celdas.length < 4) return;
    const p0 = [cx - ex * (a + 1), cy - ey * (a + 1)], p1 = [cx + ex * (b + 1), cy + ey * (b + 1)];
    for (const [px, py] of [p0, p1]) if (px >= 0 && px < A && py >= 0 && py < this.nv.alto && this.tallada(px, py)) return;
    for (const [qx, qy] of celdas) {
      const c = this.idx(qx, qy);
      if (this.tallarEn(c)) seg.nuevas.push(c);
      this.carriles.set(c, eje); seg.carriles.push(c);
    }
    for (const [px, py] of [p0, p1]) if (px >= 0 && px < A) this.reservar(this.idx(px, py), seg);
    const conBorde = eje === 'h' && (p0[0] === 0 || p1[0] === A - 1);
    const usarCabeza = conBorde && r() < d.cabezas;
    const fila = Math.max(...celdas.map((c) => c[1]));
    const lejos = celdas.filter(([qx, qy]) => qx !== cx || qy !== cy);
    const [mx, my] = lejos[entero(r, 0, lejos.length - 1)];
    const p = {
      y: fila, poner: () => {
        if (usarCabeza) {
          const [px, py] = p0[0] === 0 ? p0 : p1;
          this.nv.tipo[this.idx(px, py)] = T.CABEZA;
          this.nv.cabezas.push({ x: px, y: py, dx: px === 0 ? 1 : -1, dy: 0 });
        } else this.nv.polillas.push({ x: mx, y: my, eje, vel: d.velPolilla });
      },
    };
    this.pendientes.push(p); seg.pendientes.push(p);
  }

  // Adornar una fila que ya no cambia: chispas, monedas y peligros.
  adornar(y) {
    const nv = this.nv, A = nv.ancho, r = this.r, d = this.dificultad(nv.alto - y, this);
    for (const p of this.pendientes.filter((p) => p.y === y)) p.poner();
    this.pendientes = this.pendientes.filter((p) => p.y !== y);
    for (let x = 1; x < A - 1; x++) {
      const i = y * A + x;
      if (nv.tipo[i] === T.PARED) { this.muesca(x, y, d); continue; }
      if (nv.tipo[i] !== T.VACIO || nv.obj[i]) continue;
      const ruta = this.ruta.get(i) || 0, carril = this.carriles.has(i);
      if (this.premios.has(i)) {
        nv.obj[i] = r() < d.poder ? [O.ESCUDO, O.HIELO, O.IMAN, O.DOBLE][entero(r, 0, 3)] : O.MONEDA;
        if (nv.obj[i] === O.MONEDA) nv.monedas++;
        continue;
      }
      // púas en la punta de un bolsillo, salvo que después un tramo haya pasado por ahí
      if (this.puntas.has(i) && !ruta && r() < d.pinchos) { nv.tipo[i] = T.PINCHOS; continue; }
      if (ruta && !(ruta & PARADA) && !carril && r() < d.movedizos && this.movedizoSirve(x, y, ruta)) {
        nv.tipo[i] = (ruta & V ? (x & 1) : (y & 1)) ? T.PINCHOS_A : T.PINCHOS_B;
        nv.pinchosMoviles.push(i);
        continue;
      }
      // en un carril no se frena nunca: sus chispas no se podrían juntar y el
      // "todo limpio" sería imposible (solo lleva la del cruce, que es camino)
      if (carril && !ruta) continue;
      if (this.monedasEn.has(i)) { nv.obj[i] = O.MONEDA; nv.monedas++; continue; }
      if ((ruta & PARADA) && r() < d.poderParada) { nv.obj[i] = [O.ESCUDO, O.HIELO, O.IMAN, O.DOBLE][entero(r, 0, 3)]; continue; }
      nv.obj[i] = O.CHISPA; nv.chispas++;
    }
  }

  // Una muesca en la pared, al lado de la mitad de un tramo: ahí puede vivir
  // un erizo (inflado tapa el tramo: hay que pasar cuando se desinfla) o un
  // nido de púas que se ve feo pero no se toca (a la mitad de un tramo no se
  // frena).
  muesca(x, y, d) {
    const nv = this.nv, r = this.r, i = this.idx(x, y);
    if (x < 1 || x >= nv.ancho - 1 || this.reservadas.has(i) || this.tocaCarril(x, y)) return;
    let camino = null, otras = 0;
    for (const [a, b] of VECINAS) {
      const c = this.idx(x + a, y + b);
      if (nv.tipo[c] === T.PARED || nv.tipo[c] === T.CABEZA) continue;
      const ru = this.ruta.get(c) || 0;
      if (ru && !(ru & PARADA) && !camino) camino = c; else otras++;
    }
    if (!camino || otras) return;
    const quiere = r();
    if (quiere < d.erizos && this.erizoSirve(x, y)) { nv.tipo[i] = T.ERIZO; nv.erizos.push({ x, y }); }
    else if (quiere > 1 - d.muescas) nv.tipo[i] = T.PINCHOS;
  }

  // Inflado tapa las ocho de alrededor: ninguna puede ser una parada ni tener otro peligro.
  erizoSirve(x, y) {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const c = this.idx(x + i, y + j);
      if ((this.ruta.get(c) || 0) & PARADA) return false;
      if (this.carriles.has(c)) return false;
      const t = this.nv.tipo[c];
      if (t === T.ERIZO || t === T.PINCHOS_A || t === T.PINCHOS_B) return false;
    }
    return true;
  }

  // Pinchos que suben y bajan en medio de un tramo: nunca dos seguidos ni en un cruce.
  movedizoSirve(x, y, ruta) {
    if ((ruta & H) && (ruta & V)) return false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const t = this.nv.tipo[this.idx(x + i, y + j)];
      if (t === T.PINCHOS_A || t === T.PINCHOS_B || t === T.ERIZO) return false;
    }
    return true;
  }

  // Generar hasta que la fila `filaMin` (y todo lo de abajo) esté fija.
  asegurar(filaMin) {
    let vueltas = 0;
    while (this.hasta > filaMin && !this.terminado && vueltas++ < 2000) {
      if (!this.tramo()) this.destrabar();
      else if (this.segmentos.length > (this.maxProf || 0)) { this.maxProf = this.segmentos.length; this.fallos = []; }
      if (this.finito && this.cursor.y <= 3) { this.cerrar(); break; }
      this.fijar(this.minY + 20);
    }
  }

  // Si no hay tramo posible, se deshace el último (con todo lo que trajo) y
  // se prueba otra cosa desde antes. Si una profundidad falla mucho, se
  // vuelve más atrás todavía. Nunca por debajo de lo que ya quedó fijo.
  destrabar() {
    const prof = this.segmentos.length;
    // los fallos por profundidad no se olvidan hasta que se llega más lejos
    // que nunca: si no, deshacer uno y rehacerlo igual da vueltas para siempre
    const f = (this.fallos[prof] = (this.fallos[prof] || 0) + 1);
    let sacar = f > 20 ? 4 : f > 6 ? 2 : 1;
    while (sacar-- > 0) {
      const seg = this.segmentos[this.segmentos.length - 1];
      if (!seg) { this.terminado = true; return; }
      // lo que toca filas ya fijas no se deshace: se fuerza un tramo
      if (seg.maxFila >= this.hasta) { this.forzar(); return; }
      this.segmentos.pop();
      for (const i of seg.nuevas) this.nv.tipo[i] = T.PARED;
      for (const i of seg.reservadas) this.reservadas.delete(i);
      for (const i of seg.carriles) this.carriles.delete(i);
      for (const i of seg.monedas) this.monedasEn.delete(i);
      for (const i of seg.premios) this.premios.delete(i);
      for (const i of seg.puntas) this.puntas.delete(i);
      for (const [i, v] of seg.rutaAntes) { if (v === undefined) this.ruta.delete(i); else this.ruta.set(i, v); }
      this.pendientes = this.pendientes.filter((p) => !seg.pendientes.includes(p));
      this.cursor = { x: seg.x, y: seg.y };
      this.ultima = seg.ultimaAntes;
      this.minY = seg.minYAntes;
    }
  }

  // Último recurso (no debería pasar: lo cuenta `atascos`): un tramo que
  // ignora las reglas de los carriles y de avanzar por lugar nuevo, pero no
  // la de la pared reservada.
  forzar() {
    this.atascos = (this.atascos || 0) + 1;
    const { x, y } = this.cursor;
    const intentos = this.ultima[0] !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
    for (const [dx, dy] of intentos) for (let largo = 1; largo <= 9; largo++) {
      let ok = true;
      for (let k = 1; k <= largo && ok; k++) { const cx = x + dx * k, cy = y + dy * k; ok = this.adentro(cx, cy) && !this.reservadas.has(this.idx(cx, cy)); }
      const sx = x + dx * (largo + 1), sy = y + dy * (largo + 1);
      if (!ok || this.tallada(sx, sy) && this.adentro(sx, sy)) continue;
      const seg = { x, y, dx, dy, largo, ultimaAntes: this.ultima, minYAntes: this.minY, nuevas: [], reservadas: [], carriles: [], monedas: [], rutaAntes: new Map(), pendientes: [], premios: [], puntas: [], maxFila: Infinity };
      for (let k = 1; k <= largo; k++) { const i = this.idx(x + dx * k, y + dy * k); this.tallarEn(i); this.ruta.set(i, (this.ruta.get(i) || 0) | (dx ? H : V)); }
      const fx = x + dx * largo, fy = y + dy * largo;
      this.ruta.set(this.idx(fx, fy), (this.ruta.get(this.idx(fx, fy)) || 0) | PARADA);
      this.reservar(this.idx(fx + dx, fy + dy), seg);
      this.segmentos.push(seg);
      this.cursor = { x: fx, y: fy }; this.ultima = [dx, dy];
      if (fy < this.minY) this.minY = fy;
      return;
    }
    this.terminado = true;
  }

  fijar(frontera) {
    frontera = Math.min(frontera, this.nv.alto);
    for (let y = this.hasta - 1; y >= frontera; y--) this.adornar(y);
    if (frontera < this.hasta) this.hasta = frontera;
  }

  // Nivel con final: la salida donde terminó el camino y todo fijo.
  cerrar() {
    const { x, y } = this.cursor, nv = this.nv;
    nv.tipo[this.idx(x, y)] = T.SALIDA;
    nv.salida = { x, y };
    this.terminado = true;
    this.fijar(0);
  }

  // Pasar a texto (para mirar y para armar niveles a partir de la torre).
  texto(desde = 0, hasta = this.nv.alto) {
    const nv = this.nv, filas = [];
    const L = { [T.PARED]: '#', [T.FRAGIL]: 'f', [T.PINCHOS]: 'x', [T.PINCHOS_A]: 't', [T.PINCHOS_B]: 'T', [T.LAVA]: '~', [T.ERIZO]: 'u', [T.SALIDA]: 'E' };
    const OB = { [O.CHISPA]: '.', [O.MONEDA]: 'c', [O.ESTRELLA]: '*', [O.ESCUDO]: 'o', [O.HIELO]: 'i', [O.IMAN]: 'g', [O.DOBLE]: '2' };
    const pol = new Map(nv.polillas.map((m) => [this.idx(m.x, m.y), m.eje === 'h' ? 'm' : 'M']));
    const cab = new Map(nv.cabezas.map((c) => [this.idx(c.x, c.y), c.dx > 0 ? '>' : c.dx < 0 ? '<' : c.dy > 0 ? 'v' : '^']));
    for (let y = desde; y < hasta; y++) {
      let f = '';
      for (let x = 0; x < nv.ancho; x++) {
        const i = this.idx(x, y);
        if (nv.inicio.x === x && nv.inicio.y === y) f += 'S';
        else if (cab.has(i)) f += cab.get(i);
        else if (pol.has(i)) f += pol.get(i);
        else if (L[nv.tipo[i]]) f += L[nv.tipo[i]];
        else f += OB[nv.obj[i]] || ' ';
      }
      filas.push(f);
    }
    return filas;
  }
}

// Cómo se pone más difícil a medida que se sube (altura en filas).
export function dificultadTorre(alto) {
  const d = Math.min(1, alto / 400);
  return {
    monedas: 0.35,
    bolsillos: 0.5,
    premio: 0.55,
    poder: 0.3,
    poderParada: alto < 25 ? 0 : 0.03,
    carriles: alto < 30 ? 0 : 0.3 + 0.35 * d,
    cabezas: alto < 80 ? 0 : 0.5,
    velPolilla: 1 + 0.4 * d,
    pinchos: alto < 15 ? 0 : 0.4 + 0.4 * d,
    muescas: alto < 10 ? 0 : 0.1,
    erizos: alto < 60 ? 0 : 0.05 + 0.1 * d,
    movedizos: alto < 45 ? 0 : 0.04 + 0.06 * d,
  };
}
