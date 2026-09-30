// El idioma: en inglés no puede quedar ningún texto del juego en español, y todo tiene que entrar
// en su hoja o en su franja. Saca capturas de cada pantalla en inglés.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, tactil: false });
const esperar = (ms) => pag.waitForTimeout(ms);
// 1) cobertura: todos los textos de las tablas del juego tienen su traducción
const faltan = await pag.evaluate(() => {
  IDIOMA = "en";
  const s = new Set(), mismos = new Set(["MICELIA", "SHUMIO", "PISCIS"]);
  for (const o of Object.values(OBJETOS)) { s.add(o.nombre); s.add(o.lema); }
  for (const o of Object.values(BARATIJAS)) { s.add(o.nombre); s.add(o.lema); }
  for (const o of Object.values(TRANSFORMACIONES)) { s.add(o.nombre); s.add(o.lema); }
  for (const o of EFECTOS_CAPSULA) s.add(o.n);
  for (const o of Object.values(MALDICIONES)) s.add(o.texto);
  for (const p of PISOS) if (p) s.add(p.nombre);
  for (const e of Object.values(ENEMIGOS)) s.add(e.nombre);
  for (const n of Object.values(NOMBRE_JEFE)) s.add(n);
  return [...s].filter((t) => tr(t) === t && !mismos.has(t) && EN[t] == null);
});
console.log(faltan.length ? "SIN TRADUCIR: " + faltan.join(" | ") : "todos los textos del juego tienen su traducción");
// 2) las pantallas en inglés
const foto = async (n) => { await esperar(250); await pag.screenshot({ path: salida(n) }); };
await pag.evaluate(() => { IDIOMA = "en"; });
await pag.keyboard.press("Enter"); await esperar(400); await foto("en-1-principal.png");
await pag.evaluate(() => abrirMenu("ayuda")); await foto("en-2-ayuda.png");
await pag.evaluate(() => { window.__SH.nueva(3); }); await esperar(300);
await pag.evaluate(() => { const J = window.__SH.juego(); J.fundido = 0; J.congelado = 1e9; J.rotulos = []; rotulo(OBJETOS.cuchillo.nombre, OBJETOS.cuchillo.lema); for (const r of J.rotulos) r.t = 40; }); await foto("en-3-objeto.png");
await pag.evaluate(() => { const J = window.__SH.juego(); J.rotulos = []; rotulo(J.piso.nombre, "", MALDICIONES.oscuridad.texto); for (const r of J.rotulos) r.t = 40; }); await foto("en-4-piso.png");
await pag.evaluate(() => { const J = window.__SH.juego(); J.rotulos = []; abrirMenu("pausa"); }); await foto("en-5-pausa.png");
await pag.evaluate(() => { MENU.activo = null; const J = window.__SH.juego(); J.jug.objetos.push("rayo", "tercerOjo"); J.causa = "EL REY MOSQUÍN"; J.causaSpr = null; J.estado = "muerte"; abrirMenu("muerte"); MENU.activo.t = 60; }); await foto("en-6-muerte.png");
await pag.evaluate(() => { MENU.activo = null; window.__SH.nueva(3); window.__SH.irA("jefe"); const J = window.__SH.juego(); J.vsPendiente = true; empezarVs(); J.vs.t = 40; }); await foto("en-7-vs.png");
await pag.evaluate(() => { window.__SH.nueva(3); const J = window.__SH.juego(); J.fundido = 0; J.rotulos = []; J.congelado = 1e9; }); await foto("en-8-tutorial.png");
await pag.evaluate(() => { abrirMenu("victoria"); MENU.activo.t = 60; }); await foto("en-9-victoria.png");
for (const l of ["en", "es"]) { await pag.evaluate((l) => { IDIOMA = l; J = null; abrirMenu("principal"); MENU.activo.t = 60; }, l); await foto(`${l}-principal.png`); }
await pag.evaluate(() => { IDIOMA = "en"; window.__SH.nueva(3); const J = window.__SH.juego(); J.jug.objetos.push("rayo", "tercerOjo"); J.causa = "EL REY MOSQUÍN"; J.causaSpr = null; J.estado = "muerte"; abrirMenu("muerte"); MENU.activo.t = 60; }); await foto("en-6-muerte.png");
// 3) y el cambio desde el menú, de ida y vuelta
const vuelta = await pag.evaluate(() => { IDIOMA = "en"; abrirMenu("principal"); const it = MENU.activo.items.find((i) => i.texto().startsWith("LANGUAGE")); it.hacer(); const a = IDIOMA; it.hacer(); return [a, IDIOMA, localStorage.getItem("shumio-idioma")]; });
console.log("el menú cambia el idioma:", vuelta.join(" → "));
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await nav.close();
