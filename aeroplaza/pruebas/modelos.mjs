// Los modelos 3D de Rezona, cada uno girado a 0, 90, 180 y 270° y mirados
// desde +z: el que muestra el frente dice el giro fijo (GIRO en js/modelos.js).
// Saca pruebas/salida/modelo-<nombre>.png y una hoja con todos.
//     node pruebas/modelos.mjs [nombre…]
import path from 'node:path';
import { navegador, abrir, SAL } from './comun.mjs';
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=media&hora=0.42', { ancho: 1000, alto: 280 });
await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
const hay = await pag.evaluate(() => Object.keys(window.__A.Modelos).length && ['casa', 'estacion', 'tienda', 'hotel', 'tren', 'arbol', 'palmera', 'fuente', 'banco', 'farol', 'm-sofa', 'm-sillon', 'm-cama', 'm-tele', 'm-lampara'].filter((n) => window.__A.Modelos.hay(n)));
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : hay;
console.log('cargados:', hay.join(' '));
for (const n of pedidos) {
  await pag.evaluate((n) => {
    const A = window.__A, T = A.THREE, M = A.Modelos;
    const E = new T.Scene(); E.background = new T.Color('#dfeefa'); E.environment = A.motor.escena.environment;
    E.add(new T.HemisphereLight('#ffffff', '#b0c8d8', 1.2)); const d = new T.DirectionalLight('#ffffff', 2); d.position.set(3, 6, 5); E.add(d);
    for (let i = 0; i < 4; i++) {
      const o = M.modelo(n, { alto: 1 }); const t = o.userData.tam, w = Math.max(t.x, t.z);
      o.scale.setScalar(1 / Math.max(1, w)); o.rotation.y = i * Math.PI / 2; o.position.set(-3 + i * 2, 0, 0); E.add(o);
    }
    const cam = new T.PerspectiveCamera(22, 1000 / 280, 0.1, 100); cam.position.set(0, 1.2, 9); cam.lookAt(0, 0.45, 0);
    A.motor.r.setRenderTarget(null); A.motor.r.render(E, cam);
    const gl = A.motor.r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }, n);
  await pag.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
  await pag.screenshot({ path: path.join(SAL, `modelo-${n}.png`), timeout: 120000 });
}
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
