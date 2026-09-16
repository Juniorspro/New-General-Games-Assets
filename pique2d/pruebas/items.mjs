// TODOS LOS ITEMS, UNO POR UNO.
//
// Se escribio porque se reporto "hay items que no andan" sin decir cuales, y
// adivinar cual es leyendo codigo no es medir. Esto prueba cada tile que hace
// algo y cada bicho que se mueve, en un nivel aplanado a proposito, y dice
// cual anda y cual no. Encontro uno: el resorte no rebotaba —no estaba en la
// lista de solidos, asi que el jugador nunca aterrizaba sobre el— y llevaba
// roto desde que existe.
//
// Dos trampas que esta prueba se comio y por eso estan comentadas:
//   · el reloj del nivel se agota a mitad de la tanda y `perder("tiempo")`
//     corta el cuadro antes de tocar a los bichos: seis bichos sanos salian
//     acusados de rotos;
//   · el jugador arrastra estado de una prueba a la siguiente —el buffer de
//     salto, el impulso de pared— y el item se mide sobre un jugador que
//     venia haciendo otra cosa.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 } });
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
const r = await pg.evaluate(async () => {
  const { V, T, ALTO_TILES, F } = await import("./js/mundo.js");
  const { ESTADO } = await import("./js/juego.js");
  const { nuevoJugador } = await import("./js/fisica.js");
  window.PIQUE.empezar(1, 1);
  await new Promise(r => setTimeout(r, 2200));
  const p = window.PIQUE.partida;
  const out = [];
  const PISO = 18;
  const limpiar = () => {
    p.bichos = []; p.jefeVivo = false; p.hongos = []; p.part = [];
    p.estado = ESTADO.JUGANDO; p.tam = 0; p.gigT = 0; p.invT = 0; p.escalaAct = 1;
    // El reloj y las burbujas TAMBIEN se reponen. Sin esto, a la decima
    // prueba el nivel se quedaba sin tiempo, `perder("tiempo")` cortaba el
    // cuadro antes de tocar a los bichos, y la auditoria acusaba de rotos a
    // seis que andan perfecto. Una prueba que se agota a si misma miente.
    p.reloj = 99 * 60; p.relojCorre = true; p.burbujas = 9;
    for (let ty = 0; ty < ALTO_TILES; ty++)
      for (let tx = 0; tx < p.nv.ancho; tx++)
        p.nv.grilla[ty * p.nv.ancho + tx] = ty >= PISO ? V.SOLIDO : V.NADA;
    p.nv.mastilX = 1e6;
    // El jugador se REEMPLAZA entero, no se le tocan cuatro campos. Quedaban
    // restos de la prueba anterior —el buffer de salto, el impulso de pared,
    // los cuadros de vault— y el item siguiente se medía sobre un jugador que
    // venia haciendo otra cosa.
    Object.assign(p.j, nuevoJugador(60, PISO * T));
  };
  const correr = (n, ent = {}) => { for (let i = 0; i < n; i++)
    p.actualizar({ toque: false, toqueNuevo: false, x: 1, ...ent }); };
  const poner = (dx, dy, v) => {
    p.nv.grilla[(PISO + dy) * p.nv.ancho + (Math.floor(p.j.x / T) + dx)] = v;
  };

  // MONEDA
  limpiar(); poner(3, -1, V.MONEDA);
  let m0 = p.monedas; correr(40);
  out.push({ item: "moneda", anda: p.monedas > m0, detalle: `${m0} → ${p.monedas}` });

  // LADRILLO: cabezazo desde abajo
  limpiar(); poner(1, -3, V.LADRILLO);
  m0 = p.monedas;
  p.j.x = (Math.floor(p.j.x / T) + 1) * T + 8;
  correr(6, { x: 0 }); correr(30, { x: 0, toque: true, toqueNuevo: true });
  out.push({ item: "ladrillo (cabezazo)",
             anda: p.nv.grilla[(PISO - 3) * p.nv.ancho + Math.floor(p.j.x / T)] === V.RAJADO || p.monedas > m0,
             detalle: `monedas ${m0} → ${p.monedas}` });

  // PREGUNTA
  limpiar(); const txp = Math.floor(p.j.x / T) + 1; poner(1, -3, V.PREGUNTA);
  p.nv.premios = { [`${txp},${PISO - 3}`]: "hongo" };
  p.j.x = txp * T + 8; m0 = p.monedas;
  correr(6, { x: 0 }); correr(40, { x: 0, toque: true, toqueNuevo: true });
  out.push({ item: "bloque ? (hongo)", anda: p.tam === 1 || p.hongos.length > 0,
             detalle: `tam=${p.tam} hongos=${p.hongos.length}` });

  // TIEMPO
  limpiar(); const txt = Math.floor(p.j.x / T) + 1; poner(1, -3, V.TIEMPO);
  p.j.x = txt * T + 8; p.reloj = 600;
  correr(6, { x: 0 }); correr(30, { x: 0, toque: true, toqueNuevo: true });
  out.push({ item: "bloque reloj", anda: p.reloj > 600, detalle: `reloj ${p.reloj}` });

  // RESORTE. Tiene que estar EN el piso: el rebote mira el tile que hay debajo
  // de los pies al aterrizar, asi que flotando un tile mas arriba —que es
  // donde lo ponia el generador— no se dispara nunca. Se prueban las dos
  // posiciones para que quede escrito por que va donde va.
  limpiar(); poner(3, 0, V.RESORTE);
  let ym = 1e9;
  for (let i = 0; i < 90; i++) { p.actualizar({ toque: false, toqueNuevo: false, x: 1 }); ym = Math.min(ym, p.j.y); }
  out.push({ item: "resorte", anda: ym < PISO * T - 90, detalle: `subio ${Math.round(PISO*T - ym)} px` });
  limpiar(); poner(3, -1, V.RESORTE);
  let ym2 = 1e9;
  for (let i = 0; i < 90; i++) { p.actualizar({ toque: false, toqueNuevo: false, x: 1 }); ym2 = Math.min(ym2, p.j.y); }
  out.push({ item: "resorte flotando NO rebota", anda: PISO * T - ym2 < 60,
             detalle: `subio ${Math.round(PISO*T - ym2)} px (tiene que ser poco)` });

  // LARGO
  limpiar(); poner(3, 0, V.LARGO);
  let vmax = 0; for (let i = 0; i < 60; i++) { p.actualizar({ toque: false, toqueNuevo: false, x: 1 }); vmax = Math.max(vmax, Math.abs(p.j.vx)); }
  out.push({ item: "bloque salto largo", anda: vmax > F.VEL * 1.5, detalle: `vx max ${vmax.toFixed(1)} (normal ${F.VEL})` });

  // VOLTERETA
  limpiar(); poner(3, 0, V.VOLTERETA);
  ymin = 1e9; for (let i = 0; i < 90; i++) { p.actualizar({ toque: false, toqueNuevo: false, x: 1 }); ymin = Math.min(ymin, p.j.y); }
  out.push({ item: "bloque voltereta", anda: ymin < PISO * T - 70, detalle: `subio ${Math.round(PISO*T - ymin)} px` });

  // PAUSA
  limpiar(); poner(3, 0, V.PAUSA);
  correr(60);
  out.push({ item: "bloque pausa", anda: p.j.frenado === true, detalle: `frenado=${p.j.frenado} reloj corre=${p.relojCorre}` });

  // PINCHE
  limpiar(); poner(3, -1, V.PINCHE);
  const b0 = p.burbujas; correr(60);
  out.push({ item: "pinches", anda: p.estado !== ESTADO.JUGANDO || p.burbujas < b0,
             detalle: `estado=${p.estado} burbujas ${b0}→${p.burbujas}` });

  // LAVA
  limpiar(); poner(3, -1, V.LAVA);
  const b1 = p.burbujas; correr(60);
  out.push({ item: "lava", anda: p.estado !== ESTADO.JUGANDO || p.burbujas < b1,
             detalle: `estado=${p.estado}` });

  // PLATAFORMA (se pisa desde arriba, se atraviesa desde abajo)
  limpiar(); p.j.y = (PISO - 6) * T; p.j.vy = 0;
  for (let d = 0; d < 3; d++) poner(d + 1, -3, V.PLATAFORMA);
  p.j.x = (Math.floor(p.j.x / T) + 2) * T + 8;
  correr(40, { x: 0 });
  out.push({ item: "plataforma", anda: Math.abs(p.j.y - (PISO - 3) * T) < 2,
             detalle: `y=${Math.round(p.j.y)} esperado ${(PISO-3)*T}` });

  // RAMPA
  limpiar(); poner(2, -1, V.RAMPA_SUBE); poner(2, 0, V.SOLIDO);
  const y0 = p.j.y; let ymr = 1e9;
  for (let i = 0; i < 50; i++) { p.actualizar({ toque: false, toqueNuevo: false, x: 1 }); ymr = Math.min(ymr, p.j.y); }
  out.push({ item: "rampa", anda: ymr < y0 - 4, detalle: `subio ${Math.round(y0 - ymr)} px` });

  // TUBO
  limpiar(); poner(3, -1, V.TUBO); poner(3, -2, V.TUBO);
  const x0t = p.j.x; correr(60);
  out.push({ item: "tubo (solido)", anda: p.j.x > x0t, detalle: `avanzo ${Math.round(p.j.x - x0t)} px` });

  // BICHOS: que cada tipo se mueva o haga algo
  const { crear, paso: pasoE } = await import("./js/entidades.js");
  for (const tipo of ["bolo","caracol","aleta","erizo","fauces","osario","vela","perno","brasa","yunque","coloso","vigia","mortero","torrepua","rueda","coraza"]) {
    limpiar();
    const e = crear(tipo, Math.floor(p.j.x / T) + 6, PISO - 1);
    // Mirando para el otro lado: la vela se TAPA y se queda quieta cuando el
    // jugador la mira de frente, que es su mecanica. Mirandola, la prueba la
    // acusaria de rota por hacer exactamente lo que tiene que hacer.
    p.j.dir = -1;
    p.bichos = [e];
    const ex = e.x, ey = e.y;
    for (let i = 0; i < 80; i++) p.actualizar({ toque: false, toqueNuevo: false, x: 0 });
    const movio = Math.abs(e.x - ex) > 1 || Math.abs(e.y - ey) > 1;
    const quietoOk = ["fauces", "mortero", "rueda", "yunque", "coloso"].includes(tipo);
    out.push({ item: "bicho " + tipo, anda: movio || quietoOk,
               detalle: `dx=${(e.x-ex).toFixed(1)} dy=${(e.y-ey).toFixed(1)}` });
  }
  return out;
});
let mal = 0;
for (const x of r) { if (!x.anda) mal++;
  console.log(`  ${x.anda ? "✓" : "✗"} ${x.item.padEnd(26)} ${x.detalle}`); }
if (err.length) { mal++; console.log("  ✗ errores de javascript: " + err.slice(0,3).join(" | ")); }
console.log(`\n${r.length - mal}/${r.length}`);
await nav.close();
process.exit(mal ? 1 : 0);
