// El segundo modo: ragdoll con portales, en pantalla fija.
//
// LA DIFERENCIA CON LA CAIDA NO ES EL DECORADO, ES LA PREGUNTA. En el pozo la
// pregunta es "¿llego?" y se contesta con los reflejos. Acá es "¿por donde?" y
// se contesta parado, mirando: el nivel entra entero en la pantalla, no hay
// reloj, y hasta que no se te ocurre no pasa nada. Por eso los niveles son de
// grilla y estan escritos a mano uno por uno — un nivel de puzzle generado por
// codigo es un laberinto, no un puzzle.
//
// LOS DOS CUERPOS SE TELETRANSPORTAN JUNTOS, y esa es la decision de diseno que
// hace que esto funcione. Un ragdoll son once puntos: si cada uno cruzara el
// portal por su cuenta, el muneco quedaria con medio cuerpo de cada lado y los
// huesos —que no se estiran— lo harian pedazos o lo escupirian de vuelta. Se
// mira UN punto, el pecho de Rilo, y cuando ese cruza el plano del portal se
// mueve todo el conjunto de una: los once puntos de Rilo, los once de Tito y
// la soga. Se pierde el efecto de "medio cuerpo asomando", y se gana que el
// muneco salga entero del otro lado, que es lo unico que el jugador pide.

import { punto, palo, integrar, resolver, contraCaja, empujar, rapidez,
         G, TOPE_PORTALES } from "./verlet.js";
import { crearCuerpo, ovillar, centro, altoDe, RILO, TITO } from "./cuerpo.js";
import { NIVELES_P } from "./mapas.js";

export const T = 16;              // el lado de un tile, en pixeles
export const COLS = 22, FILAS = 34;
export const ANCHO_P = COLS * T;  // 352
export const ALTO_P = FILAS * T;  // 544

// Que es solido. 'D' (puerta) lo es hasta que se aprieta el boton.
const SOLIDOS = new Set(["#", "X", "D", "="]);
const PORTALABLE = new Set(["#"]);

// Los cuatro lados de un tile: normal hacia afuera, y el eje sobre el que se
// extiende el portal.
export const LADOS = [
  { nx: 0, ny: -1, ex: 1, ey: 0 },   // 0: cara de arriba
  { nx: 0, ny: 1, ex: 1, ey: 0 },    // 1: cara de abajo
  { nx: -1, ny: 0, ex: 0, ey: 1 },   // 2: cara izquierda
  { nx: 1, ny: 0, ex: 0, ey: 1 },    // 3: cara derecha
];

export class Escenario {
  constructor(n) {
    this.n = n;
    const def = NIVELES_P[n];
    this.def = def;
    this.nombre = def.nombre;
    this.pista = def.pista;
    this.rejilla = def.mapa.map((f) => f.padEnd(COLS, " ").slice(0, COLS).split(""));
    this.chatarra = [];
    this.botones = [];
    this.salida = null;
    let spawn = { x: ANCHO_P / 2, y: 60 };
    for (let y = 0; y < FILAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.rejilla[y]?.[x] || " ";
        const px = x * T + T / 2, py = y * T + T / 2;
        if (c === "S") { spawn = { x: px, y: py }; this.rejilla[y][x] = " "; }
        else if (c === "E") { this.salida = { x: px, y: py }; this.rejilla[y][x] = " "; }
        else if (c === "o") { this.chatarra.push({ x: px, y: py, tomada: false }); this.rejilla[y][x] = " "; }
        else if (c === "B") { this.botones.push({ x: px, y: py + T / 4, apretado: false, tx: x, ty: y }); }
      }
    }
    this.spawn = spawn;
    this.reiniciar();
  }

  reiniciar() {
    const { x, y } = this.spawn;
    // LA 'S' MARCA DONDE SE PARA, NO DONDE VA LA CABEZA. crearCuerpo pone la
    // cabeza en el punto que se le da y el cuerpo cuelga para abajo, así que
    // poniendo la S en el piso el muñeco nacía metido adentro del piso: el
    // pecho quedaba un tile más abajo y los disparos salían desde adentro de
    // la pared.
    const alto = altoDe("rilo");
    this.rilo = crearCuerpo(x - 8, y - alto * 0.92, RILO);
    this.tito = crearCuerpo(x + 14, y - alto * 0.92 - 4, TITO);
    this.soga = palo(this.rilo.p.pecho, this.tito.p.pecho,
                     { largo: 56, tipo: "cuerda", rigidez: 1 });
    this.mano = palo(this.rilo.p.manoIzq, this.tito.p.manoDer,
                     { largo: 26, tipo: "cuerda", rigidez: 0.28 });
    this.puntos = [...this.rilo.puntos, ...this.tito.puntos];
    this.palos = [...this.rilo.palos, ...this.tito.palos, this.mano, this.soga];
    this.portales = [null, null];     // 0 = azul, 1 = naranja
    this.proximo = 0;
    this.estado = "jugando";          // jugando | gano | roto
    this.integridad = 100;
    this.espera = 0;
    this.cuenta = 0;
    this.t = 0;
    this.sacude = 0;
    this.chispas = [];
    this.tiros = 0;
    this.enfriar = 0;
    for (const c of this.chatarra) c.tomada = false;
    for (const b of this.botones) b.apretado = false;
    this.puertas(false);
  }

  tile(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= FILAS) return "X";
    return this.rejilla[y][x];
  }

  /** ¿Ese tile frena? Un tile tapado por un portal deja pasar: es un agujero. */
  solido(x, y) {
    const c = this.tile(x, y);
    if (!SOLIDOS.has(c)) return false;
    for (const p of this.portales) {
      if (!p) continue;
      for (const [cx, cy] of p.celdas) if (cx === x && cy === y) return false;
    }
    return true;
  }

  puertas(abrir) {
    for (let y = 0; y < FILAS; y++)
      for (let x = 0; x < COLS; x++) {
        if (this.def.mapa[y]?.[x] === "D") this.rejilla[y][x] = abrir ? "d" : "D";
      }
  }

  // --- disparar un portal ------------------------------------------------
  /**
   * Tirar desde el pecho de Rilo hacia (mx, my) y poner ahí un portal.
   *
   * El rayo avanza de a poco y no tile por tile: con pasos de un tile, un
   * disparo casi horizontal se saltea esquinas y el portal aparece del otro
   * lado de la pared. Con pasos de un tercio de tile eso no pasa y sigue
   * costando nada — son doscientas iteraciones en el peor caso.
   */
  disparar(mx, my) {
    if (this.estado !== "jugando" || this.enfriar > 0) return false;
    const o = centro(this.rilo);
    let dx = mx - o.x, dy = my - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return false;
    dx /= d; dy /= d;
    const paso = T / 3;
    let px = o.x, py = o.y, antX = Math.floor(o.x / T), antY = Math.floor(o.y / T);
    for (let i = 0; i < 400; i++) {
      px += dx * paso; py += dy * paso;
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx === antX && ty === antY) continue;
      if (this.solido(tx, ty) || this.tile(tx, ty) === "X") {
        // Por qué cara entró: la que cambió respecto del tile anterior.
        let lado = -1;
        if (ty > antY) lado = 0; else if (ty < antY) lado = 1;
        else if (tx > antX) lado = 2; else if (tx < antX) lado = 3;
        if (lado < 0) return false;
        if (!PORTALABLE.has(this.tile(tx, ty))) { this.fallo(px, py); return false; }
        return this.poner(tx, ty, lado);
      }
      if (tx < -1 || ty < -1 || tx > COLS || ty > FILAS) return false;
      antX = tx; antY = ty;
    }
    return false;
  }

  fallo(x, y) {
    this.chispa(x, y, "#ff9b6b", 7);
    this.enfriar = 8;
  }

  /**
   * Poner el portal sobre esa cara, ocupando DOS tiles.
   *
   * Dos y no uno porque el muñeco mide casi cinco tiles: por un agujero de
   * dieciséis píxeles no entra ni hecho bolita, y un portal por el que no se
   * puede pasar es un chiste de mal gusto en un juego de portales.
   */
  poner(tx, ty, lado) {
    const L = LADOS[lado];
    const vecinos = [[tx + L.ex, ty + L.ey], [tx - L.ex, ty - L.ey]];
    let par = null;
    for (const [vx, vy] of vecinos) {
      if (!PORTALABLE.has(this.tile(vx, vy))) continue;
      // El vecino también tiene que tener aire del lado de la normal: si no,
      // el portal quedaría medio tapado por la pared de al lado.
      if (SOLIDOS.has(this.tile(vx + L.nx, vy + L.ny))) continue;
      par = [vx, vy]; break;
    }
    if (!par) return false;
    const celdas = [[tx, ty], par];
    const otro = this.portales[1 - this.proximo];
    if (otro && celdas.some(([a, b]) => otro.celdas.some(([c, d]) => a === c && b === d)))
      return false;                 // no se pisan entre ellos
    const cx = (celdas[0][0] + celdas[1][0]) / 2 * T + T / 2 + L.nx * (T / 2);
    const cy = (celdas[0][1] + celdas[1][1]) / 2 * T + T / 2 + L.ny * (T / 2);
    this.portales[this.proximo] = {
      celdas, lado, nx: L.nx, ny: L.ny, ex: L.ex, ey: L.ey,
      x: cx, y: cy, ang: Math.atan2(L.ny, L.nx), color: this.proximo,
    };
    this.proximo = 1 - this.proximo;
    this.tiros++;
    this.enfriar = 6;
    this.chispa(cx, cy, this.portales[1 - this.proximo].color ? "#ff9b3a" : "#5ad2ff", 10);
    return true;
  }

  // --- el cruce ----------------------------------------------------------
  /**
   * ¿El pecho cruzó un portal en este cuadro?
   *
   * Se mira el SEGMENTO entre la posición anterior y la de ahora, no la
   * posición sola: a siete píxeles por cuadro, un portal de un píxel de grosor
   * se atraviesa entre dos cuadros sin que ninguno de los dos lo vea.
   */
  cruce() {
    const [a, b] = this.portales;
    if (!a || !b) return;
    const p = this.rilo.p.pecho;
    for (const [entra, sale] of [[a, b], [b, a]]) {
      // Distancia con signo al plano del portal, antes y ahora.
      const d0 = (p.px - entra.x) * entra.nx + (p.py - entra.y) * entra.ny;
      const d1 = (p.x - entra.x) * entra.nx + (p.y - entra.y) * entra.ny;
      if (!(d0 > 0 && d1 <= 0)) continue;
      // Y que haya cruzado por el agujero, no por al lado.
      const t = d0 / (d0 - d1 || 1);
      const ix = p.px + (p.x - p.px) * t, iy = p.py + (p.y - p.py) * t;
      const lat = (ix - entra.x) * entra.ex + (iy - entra.y) * entra.ey;
      if (Math.abs(lat) > T) continue;
      this.teletransportar(entra, sale);
      return;
    }
  }

  teletransportar(entra, sale) {
    // El giro: lo que hay que rotar para que lo que entraba por la cara de A
    // salga por la de B. El +PI es porque se entra CONTRA la normal de A y se
    // sale A FAVOR de la de B.
    const giro = sale.ang - entra.ang + Math.PI;
    const cos = Math.cos(giro), sin = Math.sin(giro);
    const mover = (q) => {
      const rx = q.x - entra.x, ry = q.y - entra.y;
      const vx = q.x - q.px, vy = q.y - q.py;
      q.x = sale.x + (rx * cos - ry * sin) + sale.nx * 2;
      q.y = sale.y + (rx * sin + ry * cos) + sale.ny * 2;
      q.px = q.x - (vx * cos - vy * sin);
      q.py = q.y - (vx * sin + vy * cos);
    };
    for (const q of this.puntos) mover(q);
    this.chispa(sale.x, sale.y, "#c8ff8a", 12);
    this.sacude = 4;
    this.paso_portal = true;
  }

  // --- un cuadro ---------------------------------------------------------
  paso(ent) {
    this.t++;
    this.ev = { golpe: 0, pincho: false, chatarra: 0, portal: false, boton: false,
                gano: false, roto: false };
    if (this.enfriar > 0) this.enfriar--;
    if (this.sacude > 0) this.sacude *= 0.88;
    if (this.estado !== "jugando") {
      this.cuenta++;
      this.fisica(ent, true);
      if (this.estado === "roto" && this.cuenta > 70) this.reiniciar();
      return;
    }
    this.paso_portal = false;
    this.fisica(ent, false);
    this.cruce();
    if (this.paso_portal) this.ev.portal = true;
    this.juntar();
    this.revisarBotones();
    this.revisarSalida();
    if (this.integridad <= 0) {
      this.integridad = 0; this.estado = "roto"; this.cuenta = 0;
      this.sacude = 12; this.ev.roto = true;
    }
    for (const c of this.chispas) { c.x += c.vx; c.y += c.vy; c.vy += 0.18; c.vida--; }
    this.chispas = this.chispas.filter((c) => c.vida > 0);
  }

  fisica(ent, suelto) {
    const r = this.rilo;
    if (!suelto && ent.mover) {
      const a = ent.mover * 0.30;
      for (const pt of r.puntos) empujar(pt, a * pt.masa, 0);
      empujar(r.p.pecho, ent.mover * 0.45, 0);
      r.mirada = ent.mover;
    } else r.mirada += (0 - r.mirada) * 0.08;
    const bol = suelto ? 0 : (ent.bolita ? 1 : 0);
    ovillar(r, bol);
    ovillar(this.tito, bol * 0.85);

    this.peor = null;
    if (this.espera > 0) this.espera--;
    integrar(this.puntos, G, 22, TOPE_PORTALES);
    for (let k = 0; k < 3; k++) {
      resolver(this.palos, 2);
      for (const p of this.puntos) this.chocarPunto(p);
    }
    resolver(this.palos, 7);
    this.cobrar();
  }

  // SE PROBÓ ENDEREZARLOS Y NO ENTRÓ. Un muñeco tirado boca abajo tapa menos
  // de lo que parece, pero igual se intentó pararlos mientras tocan el piso,
  // con un par de empujones —la cabeza hacia arriba del eje, la cadera al
  // revés—. Medido: con fuerza suave no se levanta nada (88° de inclinación,
  // o sea tirado), y con fuerza suficiente para vencer a la gravedad quedan en
  // 61° y el cuerpo se vuelve elástico: rebota, se estira y deja de parecer un
  // cuerpo. Levantar un ragdoll de Verlet pide un controlador de equilibrio
  // por articulación, no dos empujones, y eso es otro proyecto. Se quedan
  // tirados, que además es lo que hace un ragdoll.

  chocarPunto(p) {
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        const c = this.tile(x, y);
        if (c === "^") {
          if (p.x > x * T - 2 && p.x < x * T + T + 2 && p.y > y * T && p.y < y * T + T + 2)
            this.pegar(p, 0, 16);
          continue;
        }
        if (c === "~") {
          if (p.x > x * T && p.x < x * T + T && p.y > y * T && p.y < y * T + T) {
            p.px = p.x - (p.x - p.px) * 0.82;
            p.py = p.y - (p.y - p.py) * 0.76;
          }
          continue;
        }
        if (!this.solido(x, y)) continue;
        const opc = c === "=" ? { rebote: 1.35, roce: 0.96 } : { roce: 0.90 };
        const v = contraCaja(p, x * T, y * T, T, T, opc);
        if (v > 0 && c !== "=") this.pegar(p, v);
      }
    }
    // Los bordes del escenario, por si un portal escupe para afuera.
    if (p.x < 2) { p.x = 2; p.px = p.x; }
    if (p.x > ANCHO_P - 2) { p.x = ANCHO_P - 2; p.px = p.x; }
    if (p.y > ALTO_P + 60) this.pegar(p, 0, 40);
  }

  pegar(p, v, extra = 0) {
    if (this.estado !== "jugando") return;
    // EL UMBRAL ES MÁS ALTO QUE EN EL POZO, y tiene que serlo: acá se cae a
    // diecisiete píxeles por cuadro en vez de siete y medio, así que con el
    // mismo número una caída normal —la que el puzzle te PIDE hacer— costaría
    // media barra. Acá el daño es para los errores, no para el método.
    if (v < 13 && !extra) return;
    const parte = p.nombre === "cabeza" ? 1.6 : p.nombre.startsWith("pie") ? 0.5 : 1;
    const d = (Math.max(0, v - 13) * 2.0 + extra) * parte;
    if (!this.peor || d > this.peor.d) this.peor = { d, v, p, extra };
  }

  cobrar() {
    const g = this.peor;
    if (!g || this.espera > 0) return;
    const bol = Math.max(0, this.rilo.bolita);
    const d = g.d * (1 - bol * 0.66);
    if (d < 0.6) return;
    this.espera = 12;
    this.integridad -= d;
    this.ev.golpe = Math.max(this.ev.golpe, g.v);
    if (g.extra >= 16) this.ev.pincho = true;
    this.sacude = Math.min(10, this.sacude + d * 0.4);
    this.chispa(g.p.x, g.p.y, g.extra ? "#ff6b6b" : "#ffd447", Math.min(8, 2 + d * 0.35));
  }

  chispa(x, y, color, n = 3) {
    for (let i = 0; i < n; i++)
      this.chispas.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.8) * 2.4,
                          color, vida: 16 + Math.random() * 14 });
  }

  juntar() {
    for (const p of this.puntos)
      for (const c of this.chatarra) {
        if (c.tomada || Math.abs(c.x - p.x) > 12 || Math.abs(c.y - p.y) > 12) continue;
        c.tomada = true; this.ev.chatarra++; this.chispa(c.x, c.y, "#7dffb0", 6);
      }
  }

  /**
   * Los botones se aprietan con PESO, y por eso Tito sirve para algo.
   *
   * Es el único lugar del juego donde el nieto colgando de la soga deja de ser
   * un estorbo y pasa a ser la herramienta: hay puertas que no se abren si no
   * lo dejás parado encima de la placa mientras vos vas a otro lado.
   */
  revisarBotones() {
    let algo = false;
    for (const b of this.botones) {
      const antes = b.apretado;
      b.apretado = this.puntos.some((p) =>
        Math.abs(p.x - b.x) < T * 0.9 && p.y > b.y - T * 0.7 && p.y < b.y + T * 0.7);
      if (b.apretado !== antes) algo = true;
    }
    if (!algo) return;
    const abierto = this.botones.length > 0 && this.botones.every((b) => b.apretado);
    this.puertas(abierto);
    this.ev.boton = true;
  }

  /**
   * ¿Llegó a la salida?
   *
   * VALE CUALQUIER PARTE DEL CUERPO, no el centro. Mirando sólo el centro —que
   * es el punto medio entre el pecho y la cadera— hay que meter el torso
   * adentro del tile de la salida, y con la salida apoyada en el piso eso pide
   * enterrar medio muñeco en el suelo: el robot se quedaba a quince píxeles de
   * una zona de dieciséis, tocándola con los pies. Si tocaste la puerta,
   * llegaste.
   */
  revisarSalida() {
    if (!this.salida) return;
    const c = centro(this.rilo);
    const toca = Math.hypot(c.x - this.salida.x, c.y - this.salida.y) < 26 ||
                 this.rilo.puntos.some((p) =>
                   Math.hypot(p.x - this.salida.x, p.y - this.salida.y) < 17);
    if (!toca) return;
    this.estado = "gano"; this.cuenta = 0; this.ev.gano = true;
    this.chispa(this.salida.x, this.salida.y, "#c8ff8a", 18);
  }

  get juntada() { return this.chatarra.filter((c) => c.tomada).length; }
}
