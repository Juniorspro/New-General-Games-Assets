/* ============================================================================
   aeroplaza/js/reinos/jardin.js — el Jardín de géiseres: un estanque grande
   con islitas de pasto, nenúfares para pisar, lotos, géiseres que soplan cada
   tanto y tiran para arriba, flores gigantes que rebotan y burbujas.
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, agua, pasto, flores, arboles, brilloso, UNI } from '../naturaleza.js';
import { Orbes, Mariposas, Burbujas, discoMalla, Chispas, puntoSuave } from '../objetos.js';

const R1 = ruido2(71), R2 = ruido2(33);
const ISLAS = [[0, 0, 16], [-34, 18, 10], [30, 26, 11], [26, -30, 9], [-26, -32, 12], [0, 44, 8], [52, -2, 8]];
export function alturaJardin(x, z) {
  let h = -3.2 + R1(x * 0.04, z * 0.04) * 0.8;
  for (const [ix, iz, ir] of ISLAS) { const d = Math.hypot(x - ix, z - iz) + R2(x * 0.1, z * 0.1) * 2; h = Math.max(h, 1.3 - Math.pow(Math.max(0, d - ir * 0.55) / (ir * 0.45), 2) * 4.5); }
  return h;
}
function colorJardin(x, z, h) {
  if (h > 0.7) { const v = 0.9 + R2(x * 0.2, z * 0.2) * 0.1; const b = suaveEntre(0.7, 1.2, h); return [0.97 - b * (0.97 - 0.35 * v), 0.9 - b * (0.9 - 0.78 * v), 0.72 - b * (0.72 - 0.25 * v), 1 - b]; }
  return [0.6, 0.72, 0.55, 0.3];
}

export function crearJardin(ctx) {
  const A = alturaJardin;
  const mundo = new Mundo(A); mundo.agua = 0; mundo.limite = 95;
  const g = new THREE.Group();
  g.add(terreno(A, { tam: 220, seg: 170, color: colorJardin }));
  const estanque = agua(0, A, { rect: [-110, -110, 220], colorPlaya: '#6ff0c8', colorHondo: '#138a8a' }); g.add(estanque);
  const hayPasto = (x, z) => A(x, z) > 1.0;
  g.add(pasto(A, hayPasto, { n: Math.round(12000 * ctx.calidad.pasto), area: [-110, -110, 220] }));
  g.add(flores(A, hayPasto, { n: 900, area: [-70, -70, 140], colores: ['#ffd1ec', '#ffffff', '#ff9ad8', '#fff27a'] }));
  const r = azar(5);
  const arb = [];
  for (const [ix, iz, ir] of ISLAS) for (let k = 0; k < Math.floor(ir / 4); k++) { const a = r() * 6.28, d = r() * ir * 0.4, x = ix + Math.cos(a) * d, z = iz + Math.sin(a) * d; if (Math.hypot(x, z) < 6) continue; arb.push([x, z, 0.7 + r() * 0.5]); }
  g.add(arboles(A, arb, { colores: ['#7de04a', '#ff9ad8', '#b6f03a', '#ffc2e2'] }));
  for (const [x, z, e] of arb) mundo.cilindro(x, z, 0.35 * e, A(x, z) - 1, A(x, z) + 2.4 * e);

  /* nenúfares: discos verdes sobre el agua que se pisan; algunos con loto */
  const matHoja = brilloso('#4fd13a', { roughness: 0.3, side: THREE.DoubleSide }), lotos = [];
  const hojas = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const a = r() * 6.28, d = 8 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (A(x, z) > -0.6) continue;
    const rad = 0.9 + r() * 1.3;
    const hoja = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.08, 24, 1, false, 0.3, Math.PI * 2 - 0.3), matHoja); hoja.position.set(x, 0.04, z); hoja.rotation.y = r() * 6.28; hoja.receiveShadow = true;
    hojas.add(hoja);
    mundo.cilindro(x, z, rad * 0.95, -3, 0.08, { tipo: 'hoja', hoja });
    if (i % 4 === 0) {
      const loto = new THREE.Group(); loto.position.set(x + 0.2, 0.08, z);
      for (let k = 0; k < 10; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), brilloso(k % 2 ? '#ff9ad8' : '#ffc2e2', { roughness: 0.25 })); p.scale.set(0.5, 1.2, 0.25); const b = k / 10 * 6.28; p.position.set(Math.cos(b) * 0.22, 0.3, Math.sin(b) * 0.22); p.rotation.set(Math.sin(b) * 0.6, -b, Math.cos(b) * 0.6); loto.add(p); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), brilloso('#ffe14a', { emissive: '#ffb000', emissiveIntensity: 0.4 })); c.position.y = 0.3; loto.add(c);
      g.add(loto); lotos.push(loto);
    }
  }
  g.add(hojas);

  /* géiseres: un pozo de piedra que sopla un chorro blanco cada tanto */
  const geiseres = [];
  const matChorro = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: UNI.uT, uFuerza: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uFuerza; varying vec2 vUv;
      void main(){ float s = fract(vUv.y * 4.0 - uT * 3.0 + sin(vUv.x * 30.0) * 0.1); float a = (0.45 + 0.4 * smoothstep(0.3, 0.0, abs(s - 0.5))) * (1.0 - vUv.y * 0.6) * uFuerza;
        gl_FragColor = vec4(vec3(0.9, 1.0, 1.0) * 1.3, a); }`,
  });
  const lugaresG = [[8, 6], [-12, -6], [-34, 18], [30, 26], [26, -30], [-26, -32], [0, 44], [52, -2], [10, -12]];
  lugaresG.forEach(([x, z], i) => {
    const y = A(x, z);
    const pozo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.35, 10, 24), brilloso('#c7d8e8', { roughness: 0.4 })); pozo.rotation.x = Math.PI / 2; pozo.position.set(x, y + 0.2, z); g.add(pozo);
    const aguaP = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#8ff4ff', emissive: '#3fd0ff', emissiveIntensity: 0.4, roughness: 0.05 })); aguaP.position.set(x, y + 0.25, z); g.add(aguaP);
    const alto = 9 + (i % 3) * 3;
    const chorro = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, alto, 16, 1, true), matChorro.clone()); chorro.material.uniforms.uT = UNI.uT; chorro.position.set(x, y + alto / 2, z); g.add(chorro);
    const s = mundo.cilindro(x, z, 1.0, y - 1, y + 0.25, { empuje: 17 + (i % 3) * 3, empujeAlto: alto * 0.6, activo: false, clave: 'g' + i });
    geiseres.push({ s, chorro, alto, fase: i * 1.7, y, x, z });
  });
  /* flores gigantes que rebotan */
  const floresG = [];
  const cols = ['#ff6fb0', '#ffe14a', '#e46fff', '#3fd0ff', '#ff7a3d'];
  [[-5, -8], [14, -3], [-36, 12], [24, 30], [-22, -28], [4, 48], [30, -26], [-8, 10]].forEach(([x, z], i) => {
    const y = A(x, z), alto = 2 + (i % 3) * 1.2, c = cols[i % cols.length];
    const f = new THREE.Group(); f.position.set(x, y, z);
    const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, alto, 10), brilloso('#3fbf3a')); tallo.position.y = alto / 2; f.add(tallo);
    const cabeza = new THREE.Group(); cabeza.position.y = alto;
    for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 8), brilloso(c, { roughness: 0.2, borde: 0.4 })); p.scale.set(1, 0.18, 0.55); const b = k / 8 * 6.28; p.position.set(Math.cos(b) * 1.05, 0, Math.sin(b) * 1.05); p.rotation.y = -b; cabeza.add(p); }
    const centro = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 12), brilloso('#fff6c2', { emissive: '#ffd23f', emissiveIntensity: 0.25 })); centro.scale.y = 0.45; cabeza.add(centro);
    f.add(cabeza); f.traverse((q) => { if (q.isMesh) q.castShadow = true; }); g.add(f);
    const s = mundo.cilindro(x, z, 1.7, y + alto - 0.4, y + alto + 0.15, { rebote: 15 + (i % 2) * 4, sinTecho: true });
    mundo.cilindro(x, z, 0.3, y - 1, y + alto - 0.4);
    s.alRebotar = () => { cabeza.userData.aplasta = 1; };
    floresG.push(cabeza);
  });

  const burbujas = new Burbujas(g, [[0, 0, 0, 30], [-26, 0, -32, 12], [30, 0, 26, 12]], { n: 60, alto: 18, tam: [0.2, 0.9] });
  const mariposas = new Mariposas(g, [[0, A(0, 0), 0, 8], [-34, A(-34, 18), 18, 5], [30, A(30, 26), 26, 5]], 16, ['#ffd6f5', '#ffffff', '#fff6c2']);
  const orbLug = [];
  for (const [ix, iz, ir] of ISLAS) for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + ix; const x = ix + Math.cos(a) * ir * 0.35, z = iz + Math.sin(a) * ir * 0.35; orbLug.push([x, A(x, z) + 0.9, z]); }
  /* orbes altos, que solo se agarran volando con un géiser */
  for (const G2 of geiseres) orbLug.push([G2.x, G2.y + G2.alto * 0.75, G2.z]);
  const orbes = new Orbes(g, orbLug, { color: '#9bffcf' });
  const discos = [{ id: 'disco-jardin', p: new THREE.Vector3(8, A(8, 6) + 13, 6), cancion: 'cielo' }, { id: 'disco-flor', p: new THREE.Vector3(24, A(24, 30) + 7.5, 30), cancion: 'titulo' }].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });
  const npcs = [{ id: 'loto', pos: [4, -4], rot: -0.8, y: A(4, -4) }];
  const anden = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 0.5, 6), brilloso('#eef7ff')); anden.position.set(-6, A(-6, 8) + 0.25, 8); g.add(anden);
  mundo.cilindro(-6, 8, 4, A(-6, 8) - 1, A(-6, 8) + 0.5);
  mundo.interactivo({ id: 'tren', pos: new THREE.Vector3(-6, A(-6, 8) + 0.5, 8), radio: 3.6, accion: 'viajar', icono: '🚆' });
  const chispas = new Chispas(g, '#ffffff', 120);
  let t = 0;
  return {
    id: 'jardin', mundo, grupo: g, mar: estanque, inicio: new THREE.Vector3(-6, A(-6, 8) + 0.6, 4), rumboInicio: 0.6, musica: 'cielo', cielo: { aurora: 0 },
    orbes, discos, npcs, burbujas, mariposas, geiseres,
    actualizar(dt, jp, cielo) {
      t += dt;
      for (const G2 of geiseres) {
        /* ciclo de 7 s: 2,5 soplando */
        const c = ((t + G2.fase) % 7) / 7, activo = c > 0.64;
        const f = activo ? Math.min(1, (c - 0.64) * 20) * Math.min(1, (1 - c) * 20) : 0;
        G2.s.activo = activo;
        G2.chorro.scale.y = 0.05 + f * 0.95; G2.chorro.position.y = G2.y + G2.alto * G2.chorro.scale.y / 2;
        G2.chorro.material.uniforms.uFuerza.value = f; G2.chorro.visible = f > 0.01;
        if (activo && Math.random() < dt * 20) chispas.soltar(new THREE.Vector3(G2.x, G2.y + G2.alto * f, G2.z), 2, 4);
      }
      for (const c of floresG) { const a = c.userData.aplasta || 0; c.scale.set(1 + a * 0.25, 1 - a * 0.4, 1 + a * 0.25); c.userData.aplasta = Math.max(0, a - dt * 4); c.rotation.y += dt * 0.2; }
      for (const l of lotos) l.rotation.y += dt * 0.1;
      for (const d of discos) { d.malla.rotation.y = t * 1.6; d.malla.position.y = d.p.y + Math.sin(t * 2) * 0.12; }
      chispas.actualizar(dt);
    },
  };
}
