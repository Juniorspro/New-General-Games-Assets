// Lo que cuesta cada reino: llamadas de dibujo, triángulos y milisegundos de
// CPU por cuadro (el juego sin dibujar, y el envío de comandos del dibujo).
// En SwiftShader el tiempo de la placa no se parece al de un teléfono, así que
// se mide lo que no depende de ella.
//     node pruebas/rendimiento.mjs [calidad]
import { navegador, abrir, avanzar } from './comun.mjs';
const cal = process.argv[2] || 'alta';
const nav = await navegador();
for (const r of ['plaza', 'aqua', 'aurora', 'jardin', 'tienda', 'casa']) {
  const { pag, ctx } = await abrir(nav, `directo&pausa&reino=${r}&calidad=${cal}&hora=0.45`, { ancho: 390, alto: 844, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 20);
  const m = await pag.evaluate(() => {
    const A = window.__A, info = A.motor.r.info;
    info.autoReset = false; info.reset(); A.motor.dibujar(1 / 60);
    const llamadas = info.render.calls, tris = info.render.triangles; info.autoReset = true;
    let t0 = performance.now(); for (let i = 0; i < 120; i++) A.paso(1 / 60, false); const juego = (performance.now() - t0) / 120;
    t0 = performance.now(); for (let i = 0; i < 10; i++) A.motor.dibujar(1 / 60); const envio = (performance.now() - t0) / 10;
    return { llamadas, tris, juego, envio };
  });
  console.log(`${r.padEnd(7)} ${cal}: ${String(m.llamadas).padStart(4)} llamadas · ${(m.tris / 1000).toFixed(0).padStart(5)} mil triángulos · juego ${m.juego.toFixed(2)} ms · dibujo (CPU+SwiftShader) ${m.envio.toFixed(0)} ms`);
  await ctx.close();
}
await nav.close();
