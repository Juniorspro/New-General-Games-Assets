// El rótulo del piso con maldición, cuadro por cuadro, para compararlo con el video. node pruebas/rotulos.mjs
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ tactil: false });
await pag.waitForTimeout(500);
await pag.evaluate(() => { __SH.nueva(7); });
await pag.waitForTimeout(300);
await pag.evaluate(() => { const J = __SH.juego(); J.fundido = 0; J.congelado = 1e9; __SH.maldecir("ciego"); });
for (const t of [2, 4, 6, 8, 11, 14, 60, 124, 128, 130, 133, 137]) {
  await pag.evaluate((t) => { const J = __SH.juego(); J.rotulos.forEach((r) => (r.t = t - 1)); }, t);
  await pag.evaluate(() => { const J = __SH.juego(); const e = J.estado; J.estado = "pausaPrueba"; });
  await pag.evaluate(() => { dibujar(); });
  await pag.screenshot({ path: salida(`r-${String(t).padStart(3, "0")}.png`) });
  await pag.evaluate(() => { __SH.juego().estado = "juego"; });
}
console.log(errores.filter((e) => !e.includes("willRead")));
await nav.close();
