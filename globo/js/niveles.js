// Los niveles de Globo Libre: 30 (diez por cielo) y el infinito.
//
// Un nivel es una fila de "formaciones" (una pared de cajas, un péndulo, un
// embudo…) separadas por respiros, del suelo a la meta. Todo sale de una
// semilla: el nivel 7 es siempre el mismo nivel 7. Cada formación es una
// función (azar, dificultad 0 a 1) → piezas en coordenadas locales: x de 0 a
// 360 (el ancho del mundo), y = 0 abajo y negativa hacia arriba (como en el
// mundo, donde subir es ir hacia y negativa).
//
// La regla de oro: nada FIJO pasa por la columna del globo (x 142 a 218: el
// globo mide 44 y se hamaca 12 de cada lado, más unos pocos de aire): lo fijo
// que la invadiera sería una muerte segura. Lo que sí cruza la columna se
// puede empujar.
//
// Tipos de pieza:
//   suelta   quieta en el aire hasta que algo la toca (entonces cae)
//   cae      quieta hasta que la formación entra en pantalla: llueve
//   fijo     pared o repisa que no se mueve nunca
//   aspa     barra que gira sola, a un costado
//   molinete barra clavada por el centro que gira si se la empuja
//   pendulo  bola colgada de un clavo que arranca a hamacarse al llegar
import { azar, clamp } from './util.js';

export const ANCHO = 360;
export const COLUMNA = [142, 218];
export const NIVELES = 30;

// ── las formaciones ────────────────────────────────────────────────────────
const F = {
  // una caja grande justo en el camino: la primera lección (empujala a un lado)
  caja(r, d) {
    const l = 60 + d * 40, x = 180 + r.entre(-20, 20);
    return { alto: l, piezas: [{ forma: 'caja', x, y: -l / 2, w: l, h: l, densidad: 1.2 }], monedas: arco(180, -l - 50, 3, 40) };
  },

  // una o varias filas de ladrillos de lado a lado (desde el nivel 8, más o
  // menos, al tocar una se viene abajo la fila entera)
  fila(r, d) {
    const filas = 1 + (d > 0.35 ? 1 : 0) + (d > 0.75 ? 1 : 0), w = r.uno([40, 45, 51.4]), h = 22;
    const piezas = [];
    for (let f = 0; f < filas; f++) {
      const corre = f % 2 ? w / 2 : 0;
      for (let x = w / 2 - corre; x < ANCHO + w / 2; x += w) {
        const xx = clamp(x, w / 2 - 6, ANCHO - w / 2 + 6);
        piezas.push({ forma: 'caja', x: xx, y: -h / 2 - f * (h + 1), w: w - 2, h, grupo: d > 0.3 ? 1 : 0 });
      }
    }
    const alto = filas * (h + 1);
    return { alto, piezas, monedas: r() < 0.5 ? arco(180, -alto - 45, 3, 36) : [] };
  },

  // un racimo de bolas apretadas (panal) arriba del camino; en los niveles
  // difíciles se desarma entero al tocarlo
  bolas(r, d, cae = false) {
    // el racimo que cae es más chico: treinta bolas lloviendo de a una no se atajan
    const rb = r.uno([11, 13, 15]), R = cae ? 32 + d * 18 : 48 + d * 42, cx = 180 + r.entre(-30, 30), piezas = [];
    const dx = 2 * rb + 0.6, dy = dx * 0.866;
    for (let j = 0, y = -R; y <= R; j++, y += dy) for (let x = -R + (j % 2 ? dx / 2 : 0); x <= R; x += dx) {
      if (x * x + y * y <= R * R) piezas.push({ forma: 'bola', x: cx + x, y: y - R - rb, r: rb, grupo: d > 0.3 ? 1 : 0 });
    }
    return { alto: 2 * R + 2 * rb, piezas, monedas: [[cx, -R - rb]] };
  },

  // palos largos cruzados
  palos(r, d) {
    const n = 2 + Math.round(d * 2), piezas = [];
    for (let k = 0; k < n; k++) {
      const l = r.entre(130, 190);
      piezas.push({ forma: 'caja', x: 180 + r.entre(-50, 50), y: -30 - k * 55, w: l, h: 12, a: r.entre(-0.6, 0.6) });
    }
    return { alto: 30 + n * 55, piezas, monedas: arco(180 + r.uno([-110, 110]), -n * 30, 3, 34, true) };
  },

  // una escalera de cajas que cruza el camino en diagonal
  escalera(r, d) {
    const n = 5 + Math.round(d * 3), l = 34, lado = r() < 0.5 ? 1 : -1, piezas = [];
    for (let k = 0; k < n; k++) piezas.push({ forma: 'caja', x: 180 + lado * (k - (n - 1) / 2) * 38, y: -l / 2 - k * 26, w: l, h: l, grupo: 1 });
    return { alto: l + (n - 1) * 26, piezas, monedas: arco(180 - lado * 100, -n * 14, 3, 30, true) };
  },

  // una pirámide que flota: al tocarla se despierta entera y se viene abajo
  piramide(r, d) {
    const base = 3 + Math.round(d * 2), l = 30, cx = 180 + r.entre(-25, 25), piezas = [];
    for (let f = 0; f < base; f++) for (let k = 0; k < base - f; k++) {
      piezas.push({ forma: 'caja', x: cx + (k - (base - f - 1) / 2) * (l + 1), y: -l / 2 - f * (l + 0.5), w: l, h: l, grupo: 1 });
    }
    return { alto: base * (l + 0.5), piezas, monedas: [[cx, -base * l - 30]] };
  },

  // una torre sobre una repisa al costado: si se toca, se desploma hacia el medio
  torre(r, d) {
    const lado = r() < 0.5 ? -1 : 1, piso = 16, l = 32, pisos = 3 + Math.round(d * 3);
    const xr = lado < 0 ? 60 : 300, piezas = [{ forma: 'caja', tipo: 'fijo', x: xr, y: -piso / 2, w: 120, h: piso }];
    for (let k = 0; k < pisos; k++) piezas.push({ forma: 'caja', x: xr + lado * 20 + r.entre(-2, 2), y: -piso - l / 2 - k * l + 0.3, w: l, h: l, grupo: 1 });
    // y una caja suelta en el camino, para que haya que meterse cerca
    piezas.push({ forma: 'caja', x: 180 - lado * 12, y: -piso - pisos * l * 0.6, w: 40, h: 40 });
    return { alto: piso + pisos * l, piezas, monedas: arco(xr, -piso - pisos * l - 30, 3, 30) };
  },

  // cosas que llueven apenas la formación entra en pantalla
  lluvia(r, d) {
    const n = 4 + Math.round(d * 6), piezas = [];
    for (let k = 0; k < n; k++) {
      const bola = r() < 0.6, x = 180 + r.entre(-95, 95), y = -20 - k * 38;
      piezas.push(bola ? { forma: 'bola', tipo: 'cae', x, y, r: r.entre(10, 17) } : { forma: 'caja', tipo: 'cae', x, y, w: r.entre(22, 34), h: r.entre(22, 34), a: r.entre(0, 1.5) });
    }
    return { alto: 20 + n * 38, piezas, monedas: [] };
  },

  // un péndulo: un clavo al costado del camino y una bola pesada que se hamaca
  pendulo(r, d) {
    // la bola espera alzada del lado de afuera y se suelta cuando el globo se
    // acerca (partida.js calcula cuándo): baja, pasa por abajo del clavo y
    // cruza la columna justo cuando llega el globo. Si nadie la ataja, pega.
    const lado = r() < 0.5 ? -1 : 1, sep = r.entre(58, 84), x0 = 180 + lado * sep, largo = r.entre(125, 165), rb = 18 + d * 4;
    const alzada = 1.05 + d * 0.3, ay = -30 - largo;
    const piezas = [{ forma: 'bola', tipo: 'pendulo', ax: x0, ay, largo, alzada, x: x0 + lado * Math.sin(alzada) * largo, y: ay + Math.cos(alzada) * largo, r: rb, densidad: 2.5 }];
    // la altura a la que la bola cruza el medio de la columna
    return { alto: largo + 60, piezas, monedas: arco(180, -largo - 70, 3, 34), cruce: ay + Math.sqrt(largo * largo - sep * sep) };
  },

  // una barra clavada al costado del camino, que tapa el paso hasta que se la gira
  molinete(r, d) {
    // abre como una tranquera: la punta que tapa el paso sube hasta quedar
    // parada y ahí frena (tiene tope). Sin tope daba la vuelta entera y la
    // otra punta bajaba sobre el globo.
    const n = d > 0.6 ? 2 : 1, piezas = [];
    for (let k = 0; k < n; k++) {
      const lado = (k % 2 ? -1 : 1) * (r() < 0.5 ? -1 : 1), a = r.entre(-0.2, 0.2);
      // clavada a 88 de la columna: la punta que tapa se empuja con palanca larga (gira despacio)
      // (lado 1: el clavo a la derecha y la punta que tapa a la izquierda; sube si el ángulo crece)
      piezas.push({ forma: 'caja', tipo: 'molinete', x: 180 + lado * 88, y: -60 - k * 150, w: 196 + d * 30, h: 14, a, tope: lado > 0 ? [a - 0.25, Math.PI / 2] : [-Math.PI / 2, a + 0.25] });
    }
    return { alto: 120 + (n - 1) * 150, piezas, monedas: arco(180, -60, 2, 40) };
  },

  // aspas que giran solas a los costados y revolean lo que se les acerca
  aspas(r, d) {
    const piezas = [], vel = 1.6 + d * 1.4;
    for (const lado of [-1, 1]) piezas.push({ forma: 'caja', tipo: 'aspa', x: 180 + lado * 150, y: -80, w: 150, h: 14, giro: lado * vel });
    for (let k = 0; k < 3 + Math.round(d * 3); k++) piezas.push({ forma: 'bola', x: 180 + r.entre(-70, 70), y: -40 - k * 28, r: r.entre(11, 15) });
    return { alto: 160, piezas, monedas: arco(180, -150, 3, 36) };
  },

  // una pared fija de lado a lado con un hueco en el medio, tapado con cajas
  muro(r, d) {
    const h = 24, hueco = 104, piezas = [
      { forma: 'caja', tipo: 'fijo', x: (ANCHO / 2 - hueco / 2) / 2, y: -h / 2, w: ANCHO / 2 - hueco / 2, h },
      { forma: 'caja', tipo: 'fijo', x: ANCHO - (ANCHO / 2 - hueco / 2) / 2, y: -h / 2, w: ANCHO / 2 - hueco / 2, h },
    ];
    const l = 24, filas = 1 + Math.round(d * 2);
    for (let f = 0; f < filas; f++) for (let k = 0; k < 4; k++) piezas.push({ forma: 'caja', x: 180 + (k - 1.5) * (l + 1.5), y: -l / 2 - f * (l + 1) + 4, w: l, h: l });
    return { alto: Math.max(h, filas * l), piezas, monedas: [[40, -h - 26], [ANCHO - 40, -h - 26]] };
  },

  // un techo fijo a dos aguas con un hueco en la punta (por ahí pasa el
  // globo) y bolas quietas sobre las tejas: empujadas hacia afuera ruedan
  // lejos; las que se caen por el hueco, caen sobre el globo
  embudo(r, d) {
    const piezas = [], abajo = -20, arriba = -110, adentro = 60, afuera = 176;
    const ang = Math.atan2(abajo - arriba, afuera - adentro), l = Math.hypot(afuera - adentro, abajo - arriba);
    for (const lado of [-1, 1]) {
      piezas.push({ forma: 'caja', tipo: 'fijo', x: 180 + lado * (adentro + afuera) / 2, y: (abajo + arriba) / 2, w: l, h: 14, a: lado * ang });
      // las bolas, apoyadas (casi) sobre la cara de arriba de cada teja
      const n = 2 + Math.round(d * 2);
      for (let k = 0; k < n; k++) {
        const u = 0.12 + k * 0.2 + r.entre(-0.03, 0.03), rb = 12, px = adentro + (afuera - adentro) * u, py = arriba + (abajo - arriba) * u;
        piezas.push({ forma: 'bola', x: 180 + lado * (px + Math.sin(ang) * (7 + rb + 0.5)), y: py - Math.cos(ang) * (7 + rb + 0.5), r: rb });
      }
    }
    // una bola justo arriba del hueco: la primera que hay que sacar
    piezas.push({ forma: 'bola', x: 180 + r.entre(-10, 10), y: arriba - 30, r: 14 });
    return { alto: 150, piezas, monedas: arco(180, -165, 3, 40) };
  },

  // una jaula: dos columnas y una tapa; se despierta entera si se la toca
  jaula(r, d) {
    const l = 30, alto = 3 + Math.round(d), piezas = [];
    // las columnas a 74 del medio: el globo (que se hamaca) entra con aire de los dos lados
    for (const x of [180 - 74, 180 + 74]) for (let k = 0; k < alto; k++) piezas.push({ forma: 'caja', x, y: -l / 2 - k * (l + 0.5), w: l, h: l, grupo: 1 });
    piezas.push({ forma: 'caja', x: 180, y: -alto * (l + 0.5) - 10, w: 190, h: 20, grupo: 1 });
    return { alto: alto * l + 20, piezas, monedas: [[180, -alto * l / 2]] };
  },
};

// monedas en arco (o en línea vertical)
function arco(cx, cy, n, sep, vertical = false) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = k - (n - 1) / 2;
    out.push(vertical ? [cx, cy + u * sep] : [cx + u * sep, cy - Math.cos((u / Math.max(1, n - 1)) * Math.PI) * 10]);
  }
  return out;
}

export const FORMACIONES = Object.keys(F);

// Qué formaciones aparecen desde qué nivel (se van sumando de a poco).
const DESDE = { caja: 0, fila: 0, bolas: 0, lluvia: 1, palos: 1, escalera: 3, piramide: 4, torre: 5, molinete: 7, pendulo: 9, muro: 11, jaula: 13, embudo: 15, aspas: 17 };
// Las que pueden venir cayendo en vez de esperar quietas: con el escudo
// quieto arriba del globo, lo quieto se aparta solo (el escudo es redondo y
// lo desvía), pero lo que cae de a muchos no.
const CAEN = ['caja', 'bolas', 'palos', 'piramide', 'escalera'];
// en el nivel 1 solo cae una caja (la tercera formación): lo demás espera quieto

export function formacion(tipo, r, d, { cae = false } = {}) {
  const f = F[tipo](r, clamp(d, 0, 1), cae && CAEN.includes(tipo));
  f.tipo = tipo;
  if (cae && CAEN.includes(tipo)) {
    // cada pieza cae sola (sin grupo: si no, la primera que asoma larga a todas)
    for (const p of f.piezas) if (!p.tipo) { p.tipo = 'cae'; delete p.grupo; }
    f.cae = true;
  }
  return f;
}

// Un nivel (n de 0 a 29): la velocidad del globo, el largo y las formaciones
// con su y en el mundo (el globo arranca en y = 0 y la meta está en -largo).
export function armarNivel(n) {
  const r = azar(0x9e3779b1 ^ ((n + 1) * 2654435761));
  const pool = FORMACIONES.filter((t) => DESDE[t] <= n);
  const cuantas = 7 + Math.floor(n * 0.5);
  const lista = [], veces = {}, tope = n < 10 ? 2 : 3;
  let y = -520;
  for (let k = 0; k < cuantas; k++) {
    // ni repetida con las dos de antes ni más de `tope` veces en el nivel (tres
    // torres al costado dejaban ganar sin tocar nada)
    const recientes = lista.slice(-2).map((f) => f.tipo);
    const libres = pool.filter((t) => !recientes.includes(t) && (veces[t] || 0) < tope);
    let tipo = r.uno(libres.length ? libres : pool);
    // el nivel 1 enseña: primero una caja sola, después una fila, después una caja que cae
    if (n === 0 && k < 3) tipo = ['caja', 'fila', 'caja'][k];
    // lo nuevo del nivel aparece seguro una vez
    const nueva = pool.find((t) => DESDE[t] === n);
    if (nueva && k === 2) tipo = nueva;
    veces[tipo] = (veces[tipo] || 0) + 1;
    const d = clamp(0.08 + (n / (NIVELES - 1)) * 0.8 + r.entre(-0.12, 0.12) + (k / cuantas) * 0.1, 0, 1);
    // en el nivel 1, la tercera (otra caja) ya viene cayendo: hay que atajarla y correrla
    const cae = n === 0 ? k === 2 : r() < Math.min(0.6, 0.2 + n * 0.03);
    const f = formacion(tipo, r, d, { cae });
    f.y0 = y; f.d = d;
    lista.push(f);
    y -= f.alto + r.entre(230, 330) - n * 2.5;
  }
  return { n, semilla: n, vel: 92 + n * 1.6, largo: -y + 120, formaciones: lista, tema: Math.min(2, Math.floor(n / 10)) };
}

// El infinito: formaciones a pedido, cada vez más difíciles (y el cielo va
// cambiando cada 4000 de altura).
export function crearInfinito(semilla = 1) {
  const r = azar(semilla * 7919 + 13);
  let y = -520, antes = null;
  return {
    infinito: true, vel: 100, largo: Infinity,
    tema: (alt) => Math.floor(alt / 4000) % 3,
    velEn: (alt) => Math.min(150, 100 + alt / 400),
    siguiente() {
      const alt = -y, d = clamp(0.15 + alt / 18000 + r.entre(-0.1, 0.1), 0, 1);
      const pool = FORMACIONES.filter((t) => DESDE[t] <= 4 + alt / 700 && t !== antes);
      const f = formacion(r.uno(pool), r, d, { cae: r() < Math.min(0.6, 0.25 + alt / 30000) });
      f.y0 = y; f.d = d;
      y -= f.alto + r.entre(220, 320) - Math.min(90, alt / 200);
      antes = f.tipo;
      return f;
    },
  };
}

// ¿Alguna pieza fija se mete en la columna del globo? (la prueba lo mira en
// todos los niveles: si pasara, el nivel sería imposible)
export function fijoEnColumna(f) {
  for (const p of f.piezas) {
    // el clavo del péndulo también es fijo
    if (p.tipo === 'pendulo' && p.ax > COLUMNA[0] - 8 && p.ax < COLUMNA[1] + 8) return p;
    if (p.tipo !== 'fijo' && p.tipo !== 'aspa') continue;
    // la caja girada: el punto más cercano a la columna, muestreando el borde
    const c = Math.cos(p.a || 0), s = Math.sin(p.a || 0), hx = p.tipo === 'aspa' ? p.w / 2 : p.w / 2, hy = p.tipo === 'aspa' ? p.w / 2 : p.h / 2;
    for (let k = 0; k <= 40; k++) {
      const u = (k / 40) * 2 - 1;
      for (const [lx, ly] of [[u * hx, -hy], [u * hx, hy], [-hx, u * hy], [hx, u * hy]]) {
        const x = p.x + c * lx - s * ly;
        if (x > COLUMNA[0] - 1 && x < COLUMNA[1] + 1) return p;
      }
    }
  }
  return null;
}
