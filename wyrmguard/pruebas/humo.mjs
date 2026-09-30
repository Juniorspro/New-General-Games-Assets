// Humo: abre, saca fotos de la portada, la tienda y la arena, y junta los errores.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
await pag.waitForTimeout(700); await foto("h-titulo");
await pag.evaluate(() => { window.__WG.nueva(0, 3); G.vistoGuia = true; TI.guia = false; });
await pag.waitForTimeout(300); await foto("h-tienda");
await pag.evaluate(() => { window.__WG.comprar(0); window.__WG.comprar(1); window.__WG.comprar(2); });
await pag.waitForTimeout(200); await foto("h-tienda2");
const r = await pag.evaluate(() => { __WG.armar([["archer", 1], ["swordsman", 2], ["wizard", 1], ["cleric", 1], ["bomber", 1]], 1); __WG.paso(60 * 8, 0); return { fase: M.fase, ene: M.ene.length, vivos: heroesVivos().length, oleada: M.oleada }; });
console.log(JSON.stringify(r));
await foto("h-arena");
const r2 = await pag.evaluate(() => { __WG.paso(60 * 20, 1); return { fase: M && M.fase, pant: PANT, ene: M && M.ene.length, vivos: M && heroesVivos().length, oleada: M && M.oleada, danio: M && Math.round(M.danoHecho) }; });
console.log(JSON.stringify(r2));
await foto("h-arena2");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 15).join("\n") : "sin errores");
await nav.close();
