// El delfín de Tripo, de costado, girado de a 90°: para elegir el giro fijo
// que lo deja mirando para adelante (+z). Saca pruebas/salida/delfin.png.
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&reino=aqua&calidad=baja&hora=0.45', { ancho: 900, alto: 300 });
await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
await pag.evaluate(() => {
  const A = window.__A, T = A.THREE, g = A.reino.grupo;
  const base = A.reino.delfines[0].o.children[0];
  for (let i = 0; i < 4; i++) { const c = base.clone(true); c.rotation.y += i * Math.PI / 2; c.position.set(-6 + i * 4, 6, 60); g.add(c); const f = new T.Mesh(new T.ConeGeometry(0.2, 0.8, 8), new T.MeshBasicMaterial({ color: '#ff0000' })); f.rotation.x = Math.PI / 2; f.position.set(-6 + i * 4, 7.6, 60.6); g.add(f); }
  A.yo.p.set(0, 1.3, 44); window.__camFija = true;
});
await avanzar(pag, 3);
await pag.evaluate(() => { const A = window.__A; document.getElementById('ui').style.display = 'none'; A.motor.camara.position.set(0, 6.3, 67); A.motor.camara.lookAt(0, 6, 60); A.motor.dibujar(0); });
await pag.screenshot({ path: path.join(SAL, 'delfin.png') });
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
