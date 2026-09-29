// Humo: título → partida → recorrer salas especiales → capturas. node pruebas/jugar.mjs
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ tactil: false });
const esperar = (ms) => pag.waitForTimeout(ms);
const foto = async (n) => { await pag.screenshot({ path: salida(n) }); console.log("·", n); };
await esperar(600); await foto("1-titulo.png");
await pag.keyboard.press("Enter"); await esperar(1500);
console.log("estado", await pag.evaluate(() => { const J = __SH.juego(); return J && { estado: J.estado, piso: J.piso.n, salas: J.piso.salas.size, tipos: [...J.piso.salas.values()].map((s) => s.tipo).join(",") }; }));
await foto("2-inicio.png");
await pag.keyboard.down("KeyD"); await pag.keyboard.down("ArrowUp"); await esperar(700); await pag.keyboard.up("KeyD"); await pag.keyboard.up("ArrowUp");
await foto("3-llorando.png");
for (const t of ["normal", "tesoro", "tienda", "jefe"]) {
  await pag.evaluate((t) => __SH.irA(t), t); await esperar(1200); await foto(`4-${t}.png`);
}
await pag.evaluate(() => __SH.matarTodo()); await esperar(1500); await foto("5-jefe-muerto.png");
console.log("perf", await pag.evaluate(() => __SH.perf()));
console.log(errores.length ? errores.slice(0, 10) : "sin errores");
await nav.close();
