// Capturas de las pantallas de la partida: elegir mejora, tienda, módulo, veta, el jefe, pausa y el final.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
const ev = (f, a) => pag.evaluate(f, a);
await ev(() => { window.__AB.nueva(3); J.gemasPartida = 2000; window.__AB.paso(30); terminarNivel(); window.__AB.dibujar(); });
await foto("p-mejora");
for (const tipo of ["tienda", "modulo", "veta"]) {
  await ev((tipo) => { window.__AB.nueva(3); J.gemasPartida = 700; const p = J.N.puertas[0]; p.tipo = tipo; entrarSala(p); window.__AB.paso(40); window.__AB.dibujar(); }, tipo);
  await foto("p-sala-" + tipo);
}
// comprar en la tienda caminando hasta la primera cosa
console.log(await ev(() => { window.__AB.nueva(3); J.gemasPartida = 2000; const p = J.N.puertas[0]; p.tipo = "tienda"; entrarSala(p); const c = J.sala.cosas[0], antes = J.gemasPartida; let pasoPorAbajo = 0;
  for (let i = 0; i < 400 && !c.vendido; i++) { const lejos = Math.abs(J.jug.x - c.x) > 2; window.__AB.paso(1, lejos ? (J.jug.x < c.x ? { der: true } : { izq: true }) : { salto: true, press: J.jug.suelo }); }
  const otras = J.sala.cosas.filter((o) => o !== c && o.vendido).length;
  return `tienda: ${c.k} vendido=${c.vendido} otras compradas sin querer=${otras} gemas ${antes}→${J.gemasPartida}`; }));
console.log(await ev(() => { window.__AB.nueva(3); const p = J.N.puertas[0]; p.tipo = "modulo"; entrarSala(p); const c = J.sala.cosas[0]; for (let i = 0; i < 300 && !c.vendido; i++) window.__AB.paso(1, J.jug.x < c.x - 2 ? { der: true } : J.jug.x > c.x + 2 ? { izq: true } : { salto: i % 30 < 15, press: i % 30 === 0 }); return `módulo: ${c.k} tomado=${c.vendido} arma=${J.arma} carga=${J.jug.cargaMax}`; }));
// salir de la sala
console.log(await ev(() => { const lado = J.N.salidaX === 0 ? { izq: true } : { der: true }; for (let i = 0; i < 300 && J.sala; i++) window.__AB.paso(1, lado); return "salió de la sala: " + !J.sala; }));
// el jefe
await ev(() => { window.__AB.nueva(5); window.__AB.nivel(4, 0); for (let i = 0; i < 400; i++) window.__AB.paso(1, { der: i % 120 < 60, izq: i % 120 >= 60, salto: i % 20 < 10, press: i % 20 === 0 }); J.jug.inv = 0; window.__AB.dibujar(); });
await foto("p-jefe");
console.log(await ev(() => { const B = J.jefe; for (let i = 0; i < 4000 && !J.ganado && !J.jug.muerto; i++) { J.jug.inv = 1; if (B.abierto) { J.balas.push({ x: B.x, y: B.y - 45, vx: 0, vy: 300, vida: 0.2, dano: 1, w: 3, h: 7 }); } window.__AB.paso(1); } for (let i = 0; i < 200; i++) window.__AB.paso(1); return `jefe: vida=${Math.round(B.vida)} ganado=${J.ganado} fase=${J.fase}`; }));
await ev(() => window.__AB.dibujar()); await foto("p-fin-ganado");
await ev(() => { window.__AB.nueva(3); J.pausa = true; window.__AB.dibujar(); }); await foto("p-pausa");
await ev(() => { J.pausa = false; J.jug.vida = 1; J.jug.inv = 0; herir(); for (let i = 0; i < 200; i++) window.__AB.paso(1); window.__AB.dibujar(); }); await foto("p-fin-muerto");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();
