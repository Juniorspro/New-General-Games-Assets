// Cada construcción de js/construcciones.js vista de tres cuartos, al lado de su
// referencia de Rezona (crudo/t3/ref-*.png), para compararlas. Saca
// pruebas/salida/constr-<nombre>.png.
//     node pruebas/construcciones.mjs [nombre…]
import path from 'node:path';
import { navegador, abrir, SAL } from './comun.mjs';
const TODAS = ['casa', 'estacion', 'tienda', 'hotel', 'tren', 'fuente', 'banco', 'farol', 'm-lampara', 'arbol', 'palmera', 'm-sofa', 'm-sillon', 'm-cama', 'm-tele', 'arbolRosa'];
const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : TODAS;
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=alta&hora=0.42', { ancho: 520, alto: 520 });
await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
await pag.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
for (const n of pedidas) {
  const info = await pag.evaluate((n) => {
    const A = window.__A, T = A.THREE;
    const E = new T.Scene(); E.background = new T.Color('#f2f5f8'); E.environment = A.motor.escena.environment;
    E.add(new T.HemisphereLight('#ffffff', '#c8d6e0', 1.1));
    const d = new T.DirectionalLight('#fffaf0', 2.2); d.position.set(-4, 8, 6); E.add(d);
    const o = A.Modelos.modelo(n, { escala: 1 }); E.add(o);
    const t = o.userData.tam, R = Math.max(t.x, t.y, t.z);
    const piso = new T.Mesh(new T.CircleGeometry(R * 2, 48).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: '#e9eef2', roughness: 0.9 })); E.add(piso);
    const cam = new T.PerspectiveCamera(30, 1, 0.05, R * 20);
    /* desde donde está sacada la referencia: casi todas de adelante a la izquierda; la tienda de adelante a la derecha, el tren de costado */
    const lado = { tienda: [1.35, 1.75], tren: [-2.1, 0.8] }[n] || [-1.35, 1.75];
    cam.position.set(R * lado[0], t.y * 0.45 + R * 0.7, R * lado[1]); cam.lookAt(0, t.y * 0.42, 0);
    A.motor.r.setRenderTarget(null); A.motor.r.render(E, cam);
    const gl = A.motor.r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    let tris = 0, llamadas = 0; o.traverse((q) => { if (q.isMesh) { llamadas++; tris += (q.geometry.index ? q.geometry.index.count : q.geometry.attributes.position.count) / 3; } });
    return { tam: [t.x, t.y, t.z].map((v) => v.toFixed(1)).join('×'), tris: Math.round(tris), llamadas };
  }, n);
  await pag.screenshot({ path: path.join(SAL, `constr-${n}.png`), timeout: 120000 });
  console.log(`${n}: ${info.tam} m · ${info.tris} triángulos · ${info.llamadas} llamadas`);
}
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
