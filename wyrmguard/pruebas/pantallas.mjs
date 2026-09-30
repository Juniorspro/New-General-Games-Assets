// Fotos de todas las pantallas con un estado armado a mano (tienda llena, objeto, pausa, fin, ganar…).
import { abrir, salida } from "./comun.mjs";
const q = process.argv[2] || "";
const { nav, pag, errores } = await abrir({ ancho: q === "parado" ? 360 : 800, alto: q === "parado" ? 800 : 360, dpr: 2, tactil: true });
const foto = async (n, fn) => { await pag.evaluate(fn); await pag.waitForTimeout(120); await pag.screenshot({ path: salida(`p-${n}${q ? "-" + q : ""}.png`) }); };
if (q === "es") await pag.evaluate(() => { IDIOMA = "es"; });
await pag.evaluate(() => { __WG.nueva(0, 21); G.vistoGuia = false; });
await foto("guia", () => { irA("tienda"); });
await foto("tienda", () => {
  TI.guia = false; G.vistoGuia = true;
  J.oro = 23; J.nivel = 6; J.plantel = [["archer", 3], ["wizard", 2], ["scout", 1], ["cleric", 2], ["sentry", 1], ["pyromancer", 1], ["jester", 2]].map(([id, lvl]) => ({ id, lvl, res: [1, 0] }));
  J.objetos = [{ k: "ballista", lvl: 2, xp: 1 }, { k: "centipede", lvl: 1, xp: 0 }, { k: "critical_strike", lvl: 3, xp: 0 }];
  J.cartas = ["cannoneer", "blightbow", "archer"]; TI.sel = { tipo: "carta", i: 0 };
});
await foto("tienda-heroe", () => { TI.sel = { tipo: "heroe", i: 0 }; });
await foto("tienda-objeto", () => { TI.sel = { tipo: "objeto", i: 0 }; });
await foto("tienda-clase", () => { TI.sel = { tipo: "clase", k: "ranger" }; });
await foto("objeto", () => { __WG.armar(J.plantel.map((p) => [p.id, p.lvl]), 6); M.fase = "limpio"; irA("objeto"); OB.sel = 1; });
await foto("arena", () => { __WG.armar(J.plantel.map((p) => [p.id, p.lvl]), 9); __WG.paso(60 * 12, 1); });
await foto("pausa", () => { M.pausa = true; });
await foto("opciones", () => { irA("opciones"); });
await foto("jefe", () => { M.pausa = false; __WG.armar(J.plantel.map((p) => [p.id, p.lvl]), 12); __WG.paso(60 * 6, -1); });
await foto("limpio", () => { M.pausa = false; M.fase = "pelea"; for (const e of M.ene) e.muerto = true; M.jefe && (M.jefe.muerto = true); M.ene = []; M.generando = 0; __WG.paso(90, 0); });
await foto("fin", () => { __WG.armar([["archer", 1]], 20); M.fase = "pelea"; for (const u of M.vib) u.hp = 0.1; __WG.paso(1); for (const u of M.vib) matarHeroe(u); __WG.paso(200); });
await foto("ganaste", () => { J.nivel = 25; irA("ganaste"); });
await foto("creditos", () => { irA("creditos"); });
await foto("titulo", () => { irA("titulo"); });
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 15).join("\n") : "sin errores");
await nav.close();
