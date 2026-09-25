// LOS CHOQUES: que no se pueda meter el muñeco adentro de lo que se ve.
// 1. Por cada cosa dibujada de cada reino (cada malla y cada instancia), 16 rayos horizontales
//    hacia ella, a la altura de las rodillas y del pecho. Por el mismo rayo camina un muñeco de
//    prueba (radio 0,32): dónde lo frenan los sólidos contra dónde toca lo dibujado. Si se mete
//    más de 0,45 m, ese rayo es una fuga. Lo que se atraviesa a propósito (orbes, burbujas,
//    portales, aros, peces, la pelota, los chorros) lleva userData.pasa.
// 2. El túnel: a 12 m/s y 10 cuadros por segundo (un celu flojo deslizándose) contra una
//    pared de 16 cm, no la tiene que cruzar.
//     node pruebas/choques.mjs [reinos separados por coma]
import { navegador, abrir, avanzar } from './comun.mjs';
const REINOS = (process.argv[2] || 'plaza,juegos,jardin,aqua,aurora,casa,tienda,interior:hotel,interior:cafe,interior:casa').split(',');
const TOPE = 6;   // rayos con fuga que se aceptan por pieza (las puertas de vidrio del ascensor, por ejemplo)
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=alta', { ancho: 640, alto: 360 });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });

/* ------------------------------------------------ 2. el túnel (primero: se juega en la plaza) */
{
  await avanzar(pag, 3);
  const r = await pag.evaluate(() => {
    const A = window.__A, W = A.reino.mundo, yo = A.yo, x = yo.p.x, z0 = yo.p.z;
    const y = W.altura(x, z0 + 1.2), pared = W.caja(x, z0 + 1.2, 1.5, 0.08, y - 1, y + 3);
    let cruzo = false;
    for (let i = 0; i < 12; i++) { yo.v.z = 12; yo.v.x = 0; A.paso(0.1, false); if (yo.p.z > z0 + 1.2) cruzo = true; }
    W.quitar(pared);
    return { cruzo, z: +(yo.p.z - z0).toFixed(2) };
  });
  prueba('a 12 m/s y 10 cuadros por segundo no cruza una pared de 16 cm', !r.cruzo, `quedó a ${r.z} m (la pared, a 1,2)`);
}

/* ------------------------------------------------ 1. las fugas */
for (const id of REINOS) {
  const [rid, tipo] = id.split(':');
  if (id !== 'plaza') {
    /* (se espera a que cambie el reino, no solo el id: de un interior a otro el id es el mismo) */
    await pag.evaluate(([rid, tipo]) => { window.__viejo = window.__A.reino; window.__A.viajar(rid, tipo ? { tipo, i: 0 } : {}); }, [rid, tipo]);
    await pag.waitForFunction((rid) => window.__A.reino && window.__A.reino !== window.__viejo && window.__A.reino.id === rid, rid, { timeout: 120000, polling: 250 });
  }
  await avanzar(pag, 3);
  const r = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, R = A.reino, W = R.mundo, RADIO = 0.32, ALTO = 1.35;
    const ray = new THREE.Raycaster(), bb = new THREE.Box3(), m4 = new THREE.Matrix4(), q = new THREE.Mesh(), dbl = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const saltear = (o) => {
      const m = o.material; if (!m || Array.isArray(m)) return false;
      if (m.blending === THREE.AdditiveBlending || m.colorWrite === false || (m.transparent && m.opacity < 0.15)) return true;
      for (let x = o; x; x = x.parent) if (x.userData.pasa) return true;
      return false;
    };
    const bloqueado = (x, z) => {
      const gy = W.suelo(x, z, W.altura(x, z) + 0.3).y;
      for (const s of W.cerca(x, z)) { if (s.fantasma || s.y1 <= gy + 0.46 || s.y0 >= gy + ALTO) continue; if (W.dentro(s, x, z, RADIO - 0.02)) return true; }
      return false;
    };
    const piezas = [];
    R.grupo.updateMatrixWorld(true);
    R.grupo.children.forEach((raiz, ir) => raiz.traverse((o) => {
      if (!o.isMesh || saltear(o)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const pon = (mw) => {
        bb.copy(o.geometry.boundingBox).applyMatrix4(mw);
        const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z; if (Math.max(sx, sz) < 0.6 || Math.max(sx, sz) > 90) return;
        const g = W.altura((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2); if (bb.max.y < g + 0.6 || bb.min.y > g + 1.2) return;
        piezas.push({ o, mw: mw.clone(), caja: bb.clone(), ir });
      };
      if (o.isInstancedMesh) { if (o.count > 800) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); pon(m4); } }
      else pon(o.matrixWorld);
    }));
    const G = new Map();
    for (const P of piezas) {
      const c = P.caja.getCenter(new THREE.Vector3()), rad = Math.hypot(P.caja.max.x - P.caja.min.x, P.caja.max.z - P.caja.min.z) / 2 + 1.5;
      q.geometry = P.o.geometry; q.material = dbl; q.matrixWorld.copy(P.mw); q.matrixAutoUpdate = false;
      let malos = 0, peor = 0, ej = null;
      for (let a = 0; a < 16; a++) {
        const ang = a / 16 * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang), sx = c.x + dx * rad, sz = c.z + dz * rad;
        if (bloqueado(sx, sz)) continue;
        for (const h of [0.55, 1.05]) {
          const gy = W.altura(sx, sz);
          ray.set(new THREE.Vector3(sx, gy + h, sz), new THREE.Vector3(-dx, 0, -dz)); ray.far = rad * 2;
          const hits = []; q.raycast(ray, hits); if (!hits.length) continue;
          const dv = Math.min(...hits.map((u) => u.distance)), hx = sx - dx * dv, hz = sz - dz * dv, gh = W.suelo(hx, hz, W.altura(hx, hz) + 0.3).y;
          if (gy + h < gh + 0.47 || gy + h > gh + ALTO) continue;   // lo dibujado ahí queda abajo del pie o arriba de la cabeza
          let ds = null;
          for (let t = 0; t < dv + 1.2; t += 0.04) if (bloqueado(sx - dx * t, sz - dz * t)) { ds = t; break; }
          const pen = ds == null ? 1.2 + RADIO : ds - (dv - RADIO);
          if (pen > 0.45) { malos++; if (pen > peor) { peor = pen; ej = [+hx.toFixed(1), +hz.toFixed(1)]; } }
          break;
        }
      }
      if (!malos) continue;
      const k = P.ir + '|' + P.o.geometry.type + '|' + (P.o.material.color ? '#' + P.o.material.color.getHexString() : '?');
      const e = G.get(k) || { k, veces: 0, suma: 0, peor: 0, ej }; e.veces++; e.suma += malos; e.peor = Math.max(e.peor, peor); G.set(k, e);
    }
    return { id: R.id, piezas: piezas.length, grupos: [...G.values()].sort((u, v) => v.suma - u.suma) };
  });
  const malas = r.grupos.filter((g) => g.suma >= TOPE);
  prueba(`${id}: nada se atraviesa (${r.piezas} piezas)`, malas.length === 0, malas.slice(0, 4).map((g) => `${g.k} ×${g.veces}: ${g.suma} rayos, hasta ${g.peor.toFixed(1)} m, en ${g.ej}`).join(' | ') || (r.grupos.length ? `menores: ${r.grupos.length}` : ''));
}
prueba('sin errores en la consola', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
