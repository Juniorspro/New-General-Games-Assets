// Construir: bloques en una grilla de 1 m, con un holograma cian que muestra
// dónde va a caer (rojo si no entra). Los bloques chocan, se pisan y se rompen.
// Mesa de trabajo, cofre y farol de pie son bloques con modelo propio.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';
import { Inventario } from './inventario.js';

const TIPOS = {
  madera: { alto: 1, item: 'bloqueMadera' },
  piedra: { alto: 1, item: 'bloquePiedra' },
  tablon: { alto: 0.25, item: 'tablon' },
  mesa: { alto: 0.95, item: 'mesa', modelo: true },
  cofre: { alto: 0.75, item: 'cofre', modelo: true },
  farolPie: { alto: 1.9, item: 'farolPie', modelo: true, flaco: true },
};
const clave = (x, y, z) => `${x},${y},${z}`;
const _m = new THREE.Matrix4();

const FRAG_HOLO = /* glsl */ `
uniform float uT;
uniform vec3 uColor;
varying vec3 vPos;
varying vec3 vN;
void main() {
  vec3 q = fract(vPos * 4.0);
  vec3 b = min(q, 1.0 - q);
  vec3 an = abs(vN);
  float l = an.x > 0.5 ? min(b.y, b.z) : an.y > 0.5 ? min(b.x, b.z) : min(b.x, b.y);
  float linea = 1.0 - step(0.06, l);
  float pulso = 0.75 + 0.25 * sin(uT * 5.0);
  float a = (0.18 + linea * 0.55) * pulso;
  gl_FragColor = vec4(uColor * (0.8 + linea * 0.8), a);
}`;
const VERT_HOLO = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() { vPos = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class Bloques {
  constructor(escena, tex, luces, uT) {
    this.escena = escena;
    this.luces = luces;
    this.mapa = new Map();         // clave → {tipo, x, y, z, rot, malla?, luz?}
    this.cofres = new Map();       // clave → Inventario
    this.columnas = new Map();     // 'x,z' → bloques de esa columna: el choque pregunta por columna
    this.mats = {
      madera: matPixel('mundo', { mapa: tex.madera, tam: [32, 32], clave: 'bloqueMadera' }),
      piedra: matPixel('mundo', { mapa: tex.roca, tam: [32, 32], color: 0xc9ced8, clave: 'bloquePiedra' }),
      tablon: matPixel('mundo', { mapa: tex.madera, tam: [32, 32], color: 0xf0d8b8, clave: 'bloqueTablon' }),
      oscuro: matPixel('liso', { color: 0x3a3d45, clave: 'metalOscuro' }),
      luz: matPixel('liso', { color: 0xffd36a, emisivo: 0xffb040, clave: 'luzFarol' }),
      tela: matPixel('mundo', { mapa: tex.madera, tam: [32, 32], color: 0x9b6a36, clave: 'cofreMadera' }),
    };
    this.geo = { madera: new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5), tablon: new THREE.BoxGeometry(1, 0.25, 1).translate(0.5, 0.125, 0.5) };
    this.geo.piedra = this.geo.madera;
    this.instancias = {};
    for (const t of ['madera', 'piedra', 'tablon']) this.nuevaInstancia(t, 64);
    this.holo = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({ uniforms: { uT, uColor: { value: new THREE.Color(0x5ff6ff) } }, vertexShader: VERT_HOLO, fragmentShader: FRAG_HOLO, transparent: true, depthWrite: false }));
    this.holo.visible = false;
    this.holo.renderOrder = 6;
    escena.add(this.holo);
  }

  nuevaInstancia(tipo, cap) {
    const viejo = this.instancias[tipo];
    const im = new THREE.InstancedMesh(this.geo[tipo], this.mats[tipo], cap);
    im.count = 0;
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    if (viejo) { this.escena.remove(viejo); viejo.dispose(); }
    this.instancias[tipo] = im;
    this.escena.add(im);
    return im;
  }

  rehacerInstancias() {
    const porTipo = { madera: [], piedra: [], tablon: [] };
    for (const b of this.mapa.values()) if (porTipo[b.tipo]) porTipo[b.tipo].push(b);
    for (const [t, lista] of Object.entries(porTipo)) {
      let im = this.instancias[t];
      if (lista.length > im.instanceMatrix.count) im = this.nuevaInstancia(t, Math.max(64, lista.length * 2));
      lista.forEach((b, i) => { _m.makeTranslation(b.x, b.y, b.z); im.setMatrixAt(i, _m); });
      im.count = lista.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }

  modelo(b) {
    const g = new THREE.Group();
    const M = this.mats;
    const caja = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    if (b.tipo === 'mesa') {
      g.add(new THREE.Mesh(mergeSimple([caja(1, 0.14, 1, 0.5, 0.88, 0.5), ...[[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].map(([x, z]) => caja(0.14, 0.82, 0.14, x, 0.41, z))]), M.madera));
      g.add(new THREE.Mesh(mergeSimple([caja(0.3, 0.05, 0.08, 0.3, 0.98, 0.35), caja(0.06, 0.06, 0.36, 0.72, 0.99, 0.6)]), M.oscuro));
    } else if (b.tipo === 'cofre') {
      g.add(new THREE.Mesh(caja(0.86, 0.72, 0.64, 0.5, 0.36, 0.5), M.tela));
      g.add(new THREE.Mesh(mergeSimple([caja(0.88, 0.06, 0.66, 0.5, 0.46, 0.5), caja(0.12, 0.18, 0.04, 0.5, 0.4, 0.83)]), M.oscuro));
    } else if (b.tipo === 'farolPie') {
      g.add(new THREE.Mesh(mergeSimple([caja(0.12, 1.5, 0.12, 0.5, 0.75, 0.5), caja(0.5, 0.08, 0.5, 0.5, 0.04, 0.5)]), M.madera));
      g.add(new THREE.Mesh(mergeSimple([caja(0.36, 0.05, 0.36, 0.5, 1.5, 0.5), caja(0.36, 0.05, 0.36, 0.5, 1.86, 0.5)]), M.oscuro));
      g.add(new THREE.Mesh(caja(0.28, 0.32, 0.28, 0.5, 1.68, 0.5), M.luz));
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(b.x, b.y, b.z);
    if (b.rot) { g.children.forEach((h) => { h.geometry = h.geometry.clone().translate(-0.5, 0, -0.5).rotateY(b.rot * Math.PI / 2).translate(0.5, 0, 0.5); }); }
    return g;
  }

  hay(x, y, z) { return this.mapa.get(clave(x, y, z)); }

  colAgregar(b) {
    const k = `${b.x},${b.z}`;
    if (!this.columnas.has(k)) this.columnas.set(k, []);
    this.columnas.get(k).push(b);
  }
  colQuitar(b) {
    const k = `${b.x},${b.z}`, c = this.columnas.get(k);
    if (!c) return;
    const i = c.indexOf(b);
    if (i >= 0) c.splice(i, 1);
    if (!c.length) this.columnas.delete(k);
  }

  poner(tipo, x, y, z, rot = 0) {
    const k = clave(x, y, z);
    if (this.mapa.has(k)) return false;
    const b = { tipo, x, y, z, rot };
    if (TIPOS[tipo].modelo) { b.malla = this.modelo(b); this.escena.add(b.malla); }
    if (tipo === 'farolPie') b.luz = this.luces.agregar(new THREE.Vector3(x + 0.5, y + 1.7, z + 0.5), [1.0, 0.78, 0.45, 11]);
    if (tipo === 'cofre' && !this.cofres.has(k)) this.cofres.set(k, new Inventario(27));
    this.mapa.set(k, b);
    this.colAgregar(b);
    if (!TIPOS[tipo].modelo) this.rehacerInstancias();
    return true;
  }

  sacar(x, y, z) {
    const k = clave(x, y, z);
    const b = this.mapa.get(k);
    if (!b) return null;
    this.mapa.delete(k);
    this.colQuitar(b);
    if (b.malla) this.escena.remove(b.malla);
    if (b.luz) this.luces.quitar(b.luz);
    let contenido = null;
    if (b.tipo === 'cofre') { contenido = this.cofres.get(k); this.cofres.delete(k); }
    if (!TIPOS[b.tipo].modelo) this.rehacerInstancias();
    return { ...b, item: TIPOS[b.tipo].item, contenido };
  }

  // ── choque ────────────────────────────────────────────────────────────────
  cajaDe(b) {
    const t = TIPOS[b.tipo];
    if (t.flaco) return { x0: b.x + 0.35, x1: b.x + 0.65, z0: b.z + 0.35, z1: b.z + 0.65, y0: b.y, y1: b.y + t.alto };
    if (b.tipo === 'cofre') return { x0: b.x + 0.07, x1: b.x + 0.93, z0: b.z + 0.18, z1: b.z + 0.82, y0: b.y, y1: b.y + t.alto };
    return { x0: b.x, x1: b.x + 1, z0: b.z, z1: b.z + 1, y0: b.y, y1: b.y + t.alto };
  }

  cerca(x, z, rad = 1) {
    const res = [];
    if (!this.columnas.size) return res;
    const x0 = Math.floor(x - rad), x1 = Math.floor(x + rad), z0 = Math.floor(z - rad), z1 = Math.floor(z + rad);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const c = this.columnas.get(`${i},${j}`);
      if (c) res.push(...c);
    }
    return res;
  }

  suelo(x, z, yPies, escalon) {
    let s = -Infinity;
    for (const b of this.cerca(x, z, 0.5)) {
      const c = this.cajaDe(b);
      if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y1 <= yPies + escalon && c.y1 > s) s = c.y1;
    }
    return s;
  }

  techo(x, z, yCabeza) {
    let t = Infinity;
    for (const b of this.cerca(x, z, 0.5)) {
      const c = this.cajaDe(b);
      if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y0 >= yCabeza - 0.6 && c.y0 < t) t = c.y0;
    }
    return t;
  }

  empujar(p, radio, alto, escalon) {
    for (const b of this.cerca(p.x, p.z, 1.5)) {
      const c = this.cajaDe(b);
      if (c.y1 <= p.y + escalon || c.y0 >= p.y + alto) continue;   // lo que se pisa no es pared
      const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < radio) {
        if (d > 1e-5) { p.x = cx + (dx / d) * radio; p.z = cz + (dz / d) * radio; }
        else {
          // adentro: salir por el lado más corto
          const opciones = [[c.x0 - radio - p.x, 0], [c.x1 + radio - p.x, 0], [0, c.z0 - radio - p.z], [0, c.z1 + radio - p.z]];
          opciones.sort((a, b2) => Math.abs(a[0] + a[1]) - Math.abs(b2[0] + b2[1]));
          p.x += opciones[0][0]; p.z += opciones[0][1];
        }
      }
    }
  }

  // ── apuntar ───────────────────────────────────────────────────────────────
  // Camina el rayo de a 4 cm: el primer bloque que toca, o el terreno.
  rayo(origen, dir, alcance, terreno, pisos) {
    const p = origen.clone();
    let anterior = null;
    for (let d = 0; d < alcance; d += 0.04) {
      p.copy(origen).addScaledVector(dir, d);
      const cx = Math.floor(p.x), cy = Math.floor(p.y), cz = Math.floor(p.z);
      const b = this.hay(cx, cy, cz);
      if (b) {
        const c = this.cajaDe(b);
        if (p.x >= c.x0 && p.x <= c.x1 && p.y >= c.y0 && p.y <= c.y1 && p.z >= c.z0 && p.z <= c.z1) return { bloque: b, celdaAntes: anterior, punto: p.clone(), d };
      }
      const h = terreno.altura(p.x, p.z);
      if (p.y <= h) return { terreno: true, punto: p.clone(), d, celdaAntes: [cx, Math.floor(h + 0.35), cz] };
      if (pisos) for (const pi of pisos) if (p.x > pi.x0 && p.x < pi.x1 && p.z > pi.z0 && p.z < pi.z1 && p.y <= pi.y && p.y > pi.y - 0.25) return { piso: pi, punto: p.clone(), d, celdaAntes: [cx, Math.round(pi.y), cz] };
      anterior = [cx, cy, cz];
    }
    return null;
  }

  mostrarHolo(celda, tipo, valido) {
    if (!celda) { this.holo.visible = false; return; }
    const t = TIPOS[tipo];
    const alto = t ? t.alto : 1;
    this.holo.visible = true;
    this.holo.scale.set(1.02, alto + 0.02, 1.02);
    this.holo.position.set(celda[0] + 0.5, celda[1] + alto / 2, celda[2] + 0.5);
    this.holo.material.uniforms.uColor.value.set(valido ? 0x5ff6ff : 0xff5a5a);
  }

  serializar() {
    const bloques = [...this.mapa.values()].map((b) => [b.tipo, b.x, b.y, b.z, b.rot || 0]);
    const cofres = {};
    for (const [k, inv] of this.cofres) cofres[k] = inv.serializar();
    return { bloques, cofres };
  }

  cargar(d) {
    for (const b of [...this.mapa.values()]) this.sacar(b.x, b.y, b.z);
    if (!d || !Array.isArray(d.bloques)) return;
    for (const b of d.bloques.slice(0, 5000)) {
      if (!Array.isArray(b) || !TIPOS[b[0]] || !b.slice(1, 4).every(Number.isInteger)) continue;
      const tipo = b[0];
      const k = clave(b[1], b[2], b[3]);
      if (this.mapa.has(k)) continue;
      const obj = { tipo, x: b[1], y: b[2], z: b[3], rot: b[4] | 0 };
      if (TIPOS[tipo].modelo) { obj.malla = this.modelo(obj); this.escena.add(obj.malla); }
      if (tipo === 'farolPie') obj.luz = this.luces.agregar(new THREE.Vector3(obj.x + 0.5, obj.y + 1.7, obj.z + 0.5), [1.0, 0.78, 0.45, 11]);
      this.mapa.set(k, obj);
      this.colAgregar(obj);
      if (tipo === 'cofre') { const inv = new Inventario(27); inv.cargar(d.cofres && d.cofres[k]); this.cofres.set(k, inv); }
    }
    this.rehacerInstancias();
  }
}

export { TIPOS as TIPOS_BLOQUE, clave as claveBloque };
