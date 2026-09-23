/* ============================================================================
   kuntur/js/escenario.js — lo que está parado en el diorama.
   Cada decorado del mapa (c cardón, a casa, i iglesia...) es un recorte de
   papel con su pixel art. Arrancan acostados y se paran de golpe cuando la
   cámara se les acerca, como las figuras de un libro desplegable.
   También las piezas que juegan: tablones, escaleras, espinas, el agua de
   celofán, el hielo que se rompe, las tranqueras, las piedras, las apachetas
   y las coplas.
   ========================================================================== */
import * as THREE from 'three';
import { B, baldosa, vigasEn } from './fisica.js';
import { hash } from './azar.js';
import { textoRecorte, hojaRecortada, granoPapel, ZF, ZB } from './papel.js';
import { DECOR, ANIMALES } from './elenco.js';
import { TREN_VAGONES } from './mapas.js';

/* cada dibujo se imprime una sola vez */
const cacheTex = new Map();
export function texDe(nombre, fn, arg) {
  const k = nombre + ':' + arg;
  if (!cacheTex.has(k)) { const L = fn(arg); cacheTex.set(k, { tex: textoRecorte(L, { k: 6 }), L }); }
  return cacheTex.get(k);
}
/* un recorte parado: ancho en metros según los píxeles del dibujo */
export function recorte(nombre, fn, arg, mpx) {
  const { tex, L } = texDe(nombre, fn, arg), u = tex.userData;
  const h = hojaRecortada(tex, u.w * mpx, u.h * mpx, { oy: -u.m * mpx });
  h.userData.L = L; h.userData.mpx = mpx;
  return h;
}
const DECORADOS = {
  c: { fn: DECOR.cardon, mpx: 0.09, z: [-1.6, -2.6], varia: 3 },
  a: { fn: DECOR.casa, mpx: 0.07, z: [-2.3, -2.3], varia: 2 },
  i: { fn: DECOR.iglesia, mpx: 0.085, z: [-2.6, -2.6], varia: 1 },
  p: { fn: DECOR.poste, mpx: 0.08, z: [-1.9, -1.9], varia: 1 },
  e: { fn: DECOR.estacion, mpx: 0.08, z: [-2.5, -2.5], varia: 1 },
  s: { fn: DECOR.sal, mpx: 0.06, z: [-1.4, -2.4], varia: 3 },
  w: { fn: DECOR.corral, mpx: 0.06, z: [-1.1, -1.1], varia: 1 },
  n: { fn: DECOR.nido, mpx: 0.06, z: [-0.3, -0.3], varia: 1 },
  f: { fn: DECOR.fogon, mpx: 0.045, z: [-0.8, -0.8], varia: 1, anim: 3 },
  y: { fn: ANIMALES.llama, mpx: 0.05, z: [-1.3, -1.3], varia: 1, anim: 2, lento: 1.2 },
  u: { fn: ANIMALES.vicuna, mpx: 0.05, z: [-1.6, -2.2], varia: 1, anim: 2, lento: 1.6 },
  m: { fn: ANIMALES.flamenco, mpx: 0.045, z: [-0.4, -0.4], varia: 1, anim: 2, lento: 0.8 },
};

export class Escenario {
  constructor(escena, m, bio) {
    this.escena = escena; this.m = m; this.bio = bio;
    this.g = new THREE.Group(); this.g.name = 'escenario';
    escena.add(this.g);
    this.cosas = [];        // recortes que se paran (y se animan)
    this.cajas = []; this.rompe = new Map(); this.puertas = []; this.palancas = []; this.apachetas = []; this.coplas = [];
    this.aguas = [];
    const filas = m.nivel.mapa, H = m.h;
    for (let r = 0; r < H; r++) for (let c = 0; c < filas[r].length; c++) {
      const ch = filas[r][c], y = H - 1 - r, D = DECORADOS[ch];
      if (!D) continue;
      const v = Math.floor(hash(c, y, 3) * D.varia);
      const h = recorte(ch, D.fn, v, D.mpx);
      const z = D.z[0] + (D.z[1] - D.z[0]) * hash(c, y, 4);
      h.position.set(c + 0.5, y, z);
      if (hash(c, y, 5) < 0.5 && ch !== 'i' && ch !== 'a' && ch !== 'e') h.rotation.y = Math.PI;   /* mirando para el otro lado */
      this.parar(h, D, ch);
      /* el fogón alumbra */
      if (ch === 'f') { const l = new THREE.PointLight('#ff9a48', 7, 9, 1.4); l.position.set(c + 0.5, y + 0.7, 0.4); this.g.add(l); (this.fuegos = this.fuegos || []).push(l); }
    }
    this.cardonesDeFondo();
    this.piezas();
    this.t = 0;
  }
  parar(h, D, ch) {
    h.userData.pop = { t: -1, listo: false, giro: h.rotation.y };
    h.rotation.x = -Math.PI / 2;
    h.visible = false;
    if (D && D.anim) h.userData.anim = { nombre: ch, fn: D.fn, n: D.anim, lento: D.lento || 0.3, fase: hash(Math.round(h.position.x), 1, 2) * 5 };
    this.g.add(h);
    this.cosas.push(h);
    return h;
  }
  /* más cardones parados atrás, en la loma (solo donde hay cerro) */
  cardonesDeFondo() {
    if (!(this.bio.frente === 'estratos' && (this.m.nivel.id === 'colores' || this.m.nivel.id === 'prologo' || this.m.nivel.id === 'epilogo'))) return;
    const perfil = [];
    for (let x = 0; x < this.m.w; x++) { let y = this.m.h - 1; while (y >= 0 && baldosa(this.m, x, y) !== B.SOLIDO) y--; perfil.push(y + 1); }
    for (let x = 3; x < this.m.w - 3; x += 2) {
      if (hash(x, 9, 7) > 0.22) continue;
      const h = recorte('c', DECOR.cardon, Math.floor(hash(x, 8, 7) * 3), 0.08 + hash(x, 7, 7) * 0.03);
      h.position.set(x + hash(x, 6, 7), perfil[x], ZB + 0.25);
      this.parar(h, null, 'c');
    }
  }
  /* ---------------- las piezas que juegan ---------------- */
  piezas() {
    const m = this.m, W = m.w, H = m.h, bio = this.bio;
    const madera = texPapelColor('#9a6a3a', '#7a5028');
    /* tablones: tramos seguidos */
    for (let y = 0; y < H; y++) {
      let a = -1;
      for (let x = 0; x <= W; x++) {
        const t = x < W && baldosa(m, x, y) === B.PLAT;
        if (t && a < 0) a = x;
        if (!t && a >= 0) {
          const w = x - a, geo = new THREE.BoxGeometry(w, 0.18, 2.2);
          const mm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: madera, roughness: 0.9 }));
          mm.position.set(a + w / 2, y + 0.91, -0.5); mm.castShadow = mm.receiveShadow = true;
          this.g.add(mm); a = -1;
        }
      }
    }
    /* escaleras: una por columna seguida */
    for (let x = 0; x < W; x++) {
      let a = -1;
      for (let y = 0; y <= H; y++) {
        const t = y < H && baldosa(m, x, y) === B.ESCALERA;
        if (t && a < 0) a = y;
        if (!t && a >= 0) { this.escalera(x, a, y); a = -1; }
      }
    }
    /* espinas y agua */
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = baldosa(m, x, y);
      if (b === B.PINCHO) {
        const hielo = bio.frente === 'nieve';
        const h = recorte(hielo ? 'hp' : 'es', hielo ? DECOR.hieloPincho : DECOR.espinas, 0, 0.042);
        h.position.set(x + 0.5, y, 0.25);
        this.parar(h, null, '^');
      }
    }
    for (let y = 0; y < H; y++) {
      let a = -1;
      for (let x = 0; x <= W; x++) {
        const t = x < W && baldosa(m, x, y) === B.AGUA;
        if (t && a < 0) a = x;
        if (!t && a >= 0) { this.agua(a, x, y); a = -1; }
      }
    }
    /* hielo que se rompe: un bloquecito por baldosa */
    const tHielo = texPapelColor('#bfe4f4', '#e8f6fc');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (baldosa(m, x, y) === B.ROMPE) {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, ZF - ZB), new THREE.MeshStandardMaterial({ map: tHielo, roughness: 0.4 }));
      mm.position.set(x + 0.5, y + 0.5, (ZF + ZB) / 2); mm.castShadow = mm.receiveShadow = true;
      this.g.add(mm);
      this.rompe.set(y * W + x, { mm, x, y, temb: 0, cae: 0, vuelve: 0 });
    }
    /* tranqueras */
    for (const p of m.puertas) {
      const xs = p.baldosas.map((b) => b[0]), ys = p.baldosas.map((b) => b[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), alto = Math.max(...ys) - y0 + 1;
      const h = recorte('tq', DECOR.tranquera, 0, alto / 62);
      const piv = new THREE.Group(); piv.position.set(x0 + 0.05, y0, 0.3);
      h.position.set(0.5, 0, 0); piv.add(h);
      this.g.add(piv);
      this.puertas.push({ p, piv, abre: 0 });
    }
    /* palancas y trabas (adonde vuela Apu) */
    for (const l of m.palancas) {
      const h = l.tipo === 'palanca' ? recorte('pl', DECOR.palanca, 0, 0.045) : recorte('tr', DECOR.traba, 0, 0.05);
      h.position.set(l.x, l.tipo === 'palanca' ? l.y : l.y - 0.4, 0.15);
      this.g.add(h);
      this.palancas.push({ l, h });
    }
    /* piedras de empujar: cajas de cartón pintadas de piedra */
    const tPiedra = texDe('pd', DECOR.piedra, 0).tex;
    for (const c of m.cajas) {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.4), new THREE.MeshStandardMaterial({ map: tPiedra, alphaTest: 0.3, roughness: 0.9 }));
      mm.castShadow = mm.receiveShadow = true;
      this.g.add(mm); this.cajas.push({ c, mm });
    }
    /* apachetas */
    for (const a of m.apachetas) {
      const h = recorte('ap', DECOR.apacheta, 0, 0.04);
      h.position.set(a.x, a.y, -0.7);
      this.parar(h, null, 'A');
      this.apachetas.push({ a, h, prendida: false, t: 0 });
    }
    /* coplas: cintitas tejidas que flotan */
    for (const c of m.coplas) {
      const h = recorte('cp', DECOR.copla, 0, 0.035);
      h.position.set(c.x, c.y - 0.4, 0.05);
      h.castShadow = true;
      this.g.add(h);
      this.coplas.push({ c, h, t: 0, y0: c.y - 0.4, ido: c.tomada });
      if (c.tomada) h.visible = false;
    }
    /* térmicas: tiras de papel que suben */
    this.termicas = m.termicas.map((q) => {
      const tiras = [];
      for (let i = 0; i < 10; i++) {
        const mm = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), new THREE.MeshStandardMaterial({ color: ['#f2d23c', '#f28c28', '#ffffff'][i % 3], side: THREE.DoubleSide, emissive: '#553311', emissiveIntensity: 0.4 }));
        mm.userData = { f: hash(i, q.x0 | 0, 3), x: q.x0 + 0.2 + hash(i, 1, 3) * (q.x1 - q.x0 - 0.4) };
        this.g.add(mm); tiras.push(mm);
      }
      return { q, tiras };
    });
    if (bio.frente === 'tren' || m.nivel.tren) this.tren();
  }
  escalera(x, y0, y1) {
    const alto = y1 - y0, k = 48, [c, g] = lienzoP(k, alto * k);
    g.fillStyle = '#7a5a36'; g.fillRect(4, 0, 7, alto * k); g.fillRect(k - 11, 0, 7, alto * k);
    for (let i = 0; i < alto * 3; i++) { g.fillStyle = i % 2 ? '#9a7442' : '#8a6a3a'; g.fillRect(4, i * k / 3 + 6, k - 8, 5); }
    const tex = new THREE.CanvasTexture(recortarBlanco(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const h = hojaRecortada(tex, 1.1, alto + 0.25, {});
    h.position.set(x + 0.5, y0, -0.35);
    this.g.add(h);
  }
  agua(x0, x1, y) {
    const salmuera = this.bio.frente === 'sal', noche = this.m.nivel.id === 'puna';
    const mat = new THREE.MeshStandardMaterial({ color: salmuera ? '#7fd8d0' : noche ? '#2a3a6a' : '#6ab0e0', transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.35, emissive: salmuera ? '#1a4a48' : '#0a1428', emissiveIntensity: 0.4 });
    const mm = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.35, ZF - ZB), mat);
    mm.position.set((x0 + x1) / 2, y + 0.55, (ZF + ZB) / 2);
    mm.receiveShadow = true;
    this.g.add(mm);
    this.aguas.push(mm);
  }
  /* ---------------- el tren: ruedas que giran y vías que corren ---------------- */
  tren() {
    const tex = texRueda();
    this.ruedas = [];
    for (const [a, b] of TREN_VAGONES) for (const x of [a + 1.6, a + 3.2, b - 2.2, b - 0.6]) {
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }));
      r.position.set(x, 0.62, ZF + 0.05); r.castShadow = true;
      this.g.add(r); this.ruedas.push(r);
    }
    const [c, g] = lienzoP(512, 64);
    g.fillStyle = '#6a5a4a'; g.fillRect(0, 0, 512, 64);
    for (let x = 0; x < 512; x += 32) { g.fillStyle = '#4a3a2a'; g.fillRect(x, 8, 18, 56); }
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 18, 512, 6); g.fillRect(0, 44, 512, 6);
    const tv = new THREE.CanvasTexture(c); tv.wrapS = THREE.RepeatWrapping; tv.repeat.set(this.m.w / 8, 1); tv.colorSpace = THREE.SRGBColorSpace;
    this.via = new THREE.Mesh(new THREE.PlaneGeometry(this.m.w + 120, ZF - ZB + 2), new THREE.MeshStandardMaterial({ map: tv, roughness: 1 }));
    this.via.rotation.x = -Math.PI / 2; this.via.position.set(this.m.w / 2, 0.02, (ZF + ZB) / 2);
    this.via.receiveShadow = true;
    this.g.add(this.via);
    /* las vigas y el túnel: recortes que pasan */
    const tv2 = texPapelColor('#6a4a3a', '#5a3a2a');
    this.vigas = this.m.nivel.tren.vigas.map((v) => {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(v.tunel ? 1.05 : 0.5, v.tunel ? 3 : 0.4, ZF - ZB + 1.5), new THREE.MeshStandardMaterial({ map: tv2, roughness: 1 }));
      mm.castShadow = true; this.g.add(mm);
      return { v, mm };
    });
  }

  /* ---------------- cada cuadro ---------------- */
  pasar(dt, t, camX, ancho, m) {
    this.t = t;
    for (const h of this.cosas) {
      const P = h.userData.pop;
      const cerca = Math.abs(h.position.x - camX) < ancho / 2 + 3;
      if (!P.listo && cerca && P.t < 0) P.t = 0.0001 + Math.max(0, (Math.abs(h.position.x - camX) - ancho * 0.25) * 0.01);
      if (P.t > 0 && !P.listo) {
        P.t += dt;
        const k = Math.min(1, P.t / 0.45);
        /* se para con un rebote: pasa un poco de largo y vuelve */
        const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 7) : 1;
        h.rotation.x = -Math.PI / 2 * (1 - e);
        h.visible = true;
        if (k >= 1) { P.listo = true; h.rotation.x = 0; }
      }
      const A = h.userData.anim;
      if (A && P.listo) {
        const f = Math.floor((t + A.fase) / A.lento) % A.n;
        if (f !== A.f) { A.f = f; const { tex } = texDe(A.nombre, A.fn, f); h.material.map = tex; h.material.needsUpdate = true; h.customDepthMaterial.map = tex; h.customDepthMaterial.needsUpdate = true; }
      }
      if (P.listo && h.userData.hamaca) h.rotation.z = Math.sin(t * 2 + h.position.x) * 0.03;
    }
    for (const { c, mm } of this.cajas) mm.position.set(c.x + 0.5, c.y + 0.5, -0.1);
    for (const [k, r] of this.rompe) {
      const est = m.rompe.get(k);
      if (!est) { r.mm.visible = true; r.mm.position.set(r.x + 0.5, r.y + 0.5, (ZF + ZB) / 2); r.mm.rotation.set(0, 0, 0); r.cae = 0; continue; }
      if (!est.cayo) { r.mm.position.x = r.x + 0.5 + Math.sin(t * 60) * 0.04; }
      else { r.cae += dt; r.mm.position.y = r.y + 0.5 - r.cae * r.cae * 12; r.mm.rotation.z = r.cae * 2; r.mm.visible = r.cae < 1.2; }
    }
    for (const q of this.puertas) {
      q.abre += ((q.p.abierta ? 1 : 0) - q.abre) * Math.min(1, dt * 4);
      q.piv.rotation.y = -q.abre * Math.PI * 0.46;
    }
    for (const q of this.palancas) if (q.l.tipo === 'palanca' && q.l.tirada && !q.hecho) {
      q.hecho = true; const { tex } = texDe('pl', DECOR.palanca, 1); q.h.material.map = tex; q.h.material.needsUpdate = true;
    }
    for (const q of this.apachetas) {
      if (q.a.puesta && !q.prendida) {
        q.prendida = true; q.t = 0;
        const { tex } = texDe('ap', DECOR.apacheta, 1); q.h.material.map = tex; q.h.material.needsUpdate = true; q.h.customDepthMaterial.map = tex;
      }
      if (q.prendida && q.t < 0.5) { q.t += dt; q.h.scale.setScalar(1 + Math.sin(q.t / 0.5 * Math.PI) * 0.25); }
    }
    for (const q of this.coplas) {
      if (q.ido) { if (q.h.visible) { q.t += dt; q.h.position.y += dt * 4; q.h.rotation.y += dt * 12; q.h.scale.setScalar(Math.max(0, 1 - q.t)); if (q.t > 1) q.h.visible = false; } continue; }
      if (q.c.tomada) { q.ido = true; q.t = 0; continue; }
      q.h.position.y = q.y0 + Math.sin(t * 2 + q.c.x) * 0.12;
      q.h.rotation.y = Math.sin(t * 1.3 + q.c.x) * 0.6;
      const f = Math.floor(t * 6) % 3;
      if (f !== q.f) { q.f = f; const { tex } = texDe('cp', DECOR.copla, f); q.h.material.map = tex; q.h.material.needsUpdate = true; }
    }
    for (const { q, tiras } of this.termicas) for (const s of tiras) {
      const u = s.userData, k = ((t * 0.5 + u.f) % 1);
      s.position.set(u.x + Math.sin(t * 3 + u.f * 9) * 0.15, q.y0 + k * Math.min(12, q.y1 - q.y0), 0);
      s.rotation.z = Math.sin(t * 4 + u.f * 7) * 0.5; s.rotation.y = t * 2 + u.f * 6;
      s.scale.setScalar(Math.sin(k * Math.PI));
    }
    if (this.ruedas) {
      for (const r of this.ruedas) r.rotation.z -= dt * 8 / 0.55;
      this.via.material.map.offset.x = (t * 8 / 8) % 1;
      for (const { v, mm } of this.vigas) mm.visible = false;
      const vs = vigasEn(m);
      vs.forEach((v, i) => { const q = this.vigas[i]; q.mm.visible = v.xa > camX - ancho && v.xa < camX + ancho; q.mm.position.set(v.xa, v.tunel ? v.y + 1.5 : v.y + 0.2, (ZF + ZB) / 2); });
    }
    for (const a of this.aguas) a.material.opacity = 0.7 + Math.sin(t * 1.5) * 0.04;
    if (this.fuegos) for (const l of this.fuegos) l.intensity = 6.5 + Math.sin(t * 17) * 0.8 + Math.sin(t * 7.3) * 0.6;
  }
}

/* ---------------- papelitos ---------------- */
function lienzoP(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texPapelColor(a, b) {
  const [c, g] = lienzoP(128, 128);
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) { g.fillStyle = b; g.fillRect(0, i * 3.2, 128, 1); }
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function recortarBlanco(c) {
  /* borde blanco alrededor de lo dibujado */
  const [o, g] = lienzoP(c.width, c.height);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.drawImage(c, Math.cos(a) * 4, Math.sin(a) * 4); }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over'; g.drawImage(c, 0, 0);
  return o;
}
function texRueda() {
  const [c, g] = lienzoP(128, 128);
  g.fillStyle = '#f7f3ea'; g.beginPath(); g.arc(64, 64, 63, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(64, 64, 57, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2a30'; g.lineWidth = 7;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.stroke(); }
  g.fillStyle = '#c0282e'; g.beginPath(); g.arc(64, 64, 10, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
