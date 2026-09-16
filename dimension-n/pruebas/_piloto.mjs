// Un piloto automatico, que es lo que hace que el nivel se pueda AFIRMAR
// terminable en vez de suponerlo.
//
// No es una inteligencia: mira 150 px para abajo, busca la franja libre mas
// cercana, empuja para ese lado y se hace bolita cuando tiene algo solido
// debajo. Justo por ser tan tonto sirve de prueba: si un bicho que solo sabe
// "apuntar al agujero" llega abajo, un jugador tambien. Lo que NO prueba es
// que sea divertido; eso no lo prueba ningun programa.
import { paredEn } from "../js/nivel.js";
import { centro } from "../js/cuerpo.js";

export function piloto(p) {
  const c = centro(p.rilo);
  const nv = p.nv;
  // El portal manda: es la unica salida del capitulo.
  const po = nv.portales.find((q) => !q.usado && q.y > c.y - 80);
  let obj = po && po.y - c.y < 300 ? po.x : null;
  let apurado = false;
  if (obj === null) {
    const w = paredEn(nv.perfil, c.y + 150);
    const libres = [];
    for (let x = w.izq + 12; x < w.der - 12; x += 6) {
      let ok = true;
      for (const o of nv.obst) {
        if (o.t === "gel") continue;
        if (o.t === "aspa") {
          if (Math.abs(o.y - (c.y + 150)) < o.largo + 14 && Math.abs(o.x - x) < o.largo + 14) ok = false;
          continue;
        }
        if (o.y < c.y - 30 || o.y > c.y + 320) continue;
        if (x > o.x - 10 && x < o.x + o.an + 10) ok = false;
      }
      if (ok) libres.push(x);
    }
    if (libres.length) obj = libres.reduce((a, b) => Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a);
    else { obj = (w.izq + w.der) / 2; apurado = true; }
  }
  let cerca = false;
  for (const o of nv.obst) {
    if (o.t === "gel" || o.t === "aspa") continue;
    if (o.y - c.y > 0 && o.y - c.y < 46 && c.x > o.x - 14 && c.x < o.x + o.an + 14) cerca = true;
  }
  const d = obj - p.rilo.p.pecho.x;
  return { mover: Math.max(-1, Math.min(1, d / 45)), bolita: cerca || apurado };
}

/** Jugar el nivel entero con el piloto. Devuelve lo que paso. */
export function correr(p, tope = 20000) {
  let muertes = 0, prev = "jugando", cuadros = 0;
  const capitulos = new Set();
  for (let i = 0; i < tope; i++) {
    p.paso(piloto(p));
    cuadros = i + 1;
    capitulos.add(p.capitulo.i);
    if (p.estado === "roto" && prev !== "roto") muertes++;
    prev = p.estado;
    if (p.estado === "gano") break;
  }
  return { gano: p.estado === "gano", muertes, cuadros, capitulos,
           metros: p.metros, chatarra: p.juntada, integridad: p.integridad };
}
