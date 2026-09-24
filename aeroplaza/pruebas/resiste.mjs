// Que un error en un cuadro no congele el juego: se rompe a propósito una vez
// y el bucle tiene que seguir andando, con el cartel de error a la vista.
import { navegador, abrir } from './comun.mjs';
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&calidad=baja', { ancho: 640, alto: 360 });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await pag.waitForTimeout(1500);
await pag.evaluate(() => { const R = window.__A.reino, f = R.actualizar; let una = true; R.actualizar = function (...a) { if (una) { una = false; throw new Error('error de prueba'); } return f.apply(this, a); }; });
const t0 = await pag.evaluate(() => window.__A.motor.t);
await pag.waitForTimeout(4000);
const t1 = await pag.evaluate(() => window.__A.motor.t);
const cartel = await pag.locator('.cartel-error').isVisible().catch(() => false);
console.log(t1 > t0 ? `✓ el juego sigue después del error (${(t1 - t0).toFixed(2)} s de juego en 4 s)` : '✗ el juego se congeló');
console.log(cartel ? '✓ se ve el cartel de error' : '✗ no se ve el cartel');
console.log(errores.filter((e) => !e.includes('ERR_FAILED') && !e.includes('error de prueba')).join('\n') || 'sin otros errores');
await nav.close();
