/* ============================================================================
   kuntur/js/paisaje.js — lo que pasa por la ventanilla del Tren a las Nubes.
   El tren está quieto en el diorama; lo que se mueve es el paisaje: postes,
   cardones y cerros recortados que corren hacia atrás (más rápido los de
   cerca) y vuelven a entrar por adelante. En el viaducto el piso desaparece
   y abajo queda el mar de nubes; en el túnel todo se pone oscuro.
   ========================================================================== */
import * as THREE from 'three';
import { hojaRecortada, granoPapel, ZF, ZB } from './papel.js';
import { recorte } from './escenario.js';
import { DECOR } from './elenco.js';
import { vigasEn } from './fisica.js';
import { hash, mulberry } from './azar.js';

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function aTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
/* un cerro de papel rasgado, con sus franjas */
function texCerro(cols, sem, nieve) {
  const W = 512, H = 256, [c, g] = lienzo(W, H), r = mulberry(sem);
  const alto = [];
  for (let x = 0; x <= W; x += 8) { const k = x / W; alto.push(H * (0.12 + 0.75 * Math.pow(Math.sin(k * Math.PI), 1.3) * (0.8 + r() * 0.08))); }
  g.beginPath(); g.moveTo(0, H);
  alto.forEach((a, i) => g.lineTo(i * 8, H - a));
  g.lineTo(W, H); g.closePath(); g.save(); g.clip();
  cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, H - (i + 1) * (H / cols.length) * 1.1, W, H); });
  for (let i = 0; i < cols.length; i++) {
    g.fillStyle = cols[(i + 1) % cols.length];
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H - i * (H / cols.length) - 20 - Math.sin(x * 0.02 + i + sem) * 10);
    g.lineTo(W, H); g.fill();
  }
  if (nieve) { g.fillStyle = '#f4f7fb'; g.beginPath(); alto.forEach((a, i) => g.lineTo(i * 8, H - a)); for (let i = alto.length - 1; i >= 0; i--) g.lineTo(i * 8, H - alto[i] + 26 + Math.sin(i) * 6); g.fill(); }
  g.restore();
  /* borde blanco del recorte */
  g.strokeStyle = '#f7f3ea'; g.lineWidth = 5; g.beginPath(); alto.forEach((a, i) => g.lineTo(i * 8, H - a)); g.stroke();
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, W, H);
  return aTex(c);
}
function texNube() {
  const [c, g] = lienzo(256, 128), r = mulberry(4);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(30 + r() * 196, 70 + r() * 20, 22 + r() * 26, 0, Math.PI * 2); g.fill(); }
  g.fillRect(24, 80, 208, 30);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(200,190,220,0.35)'; g.fillRect(0, 100, 256, 28);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.35; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, 256, 128);
  return aTex(c);
}
/* el viaducto: vigas de hierro cruzadas, un recorte largo que se repite */
function texViaducto() {
  const [c, g] = lienzo(256, 512);
  g.strokeStyle = '#3a3a44'; g.lineWidth = 10;
  g.strokeRect(20, 0, 216, 512);
  for (let y = 0; y < 512; y += 64) { g.beginPath(); g.moveTo(20, y); g.lineTo(236, y + 64); g.moveTo(236, y); g.lineTo(20, y + 64); g.stroke(); g.fillStyle = '#3a3a44'; g.fillRect(20, y, 216, 8); }
  g.fillStyle = '#2a2a32'; g.fillRect(0, 0, 256, 18);
  return aTex(c);
}

export class PaisajeTren {
  constructor(padre, m, bio) {
    this.m = m; this.bio = bio; this.vel = m.nivel.tren.vel;
    this.g = new THREE.Group(); padre.add(this.g);
    const disp = Object.fromEntries(m.disparos.map((d) => [d.id, d.x]));
    this.xViaducto = disp.viaducto || 74; this.xTunel = disp.tunel || 101;
    this.piezas = [];
    const R = 70; this.R = R;
    /* cerros en tres filas */
    const filas = [
      { z: -16, f: 0.72, n: 5, ancho: [26, 40], alto: [7, 12], cols: ['#b06a44', '#c98a54', '#9a5a44', '#d8a868'] },
      { z: -38, f: 0.42, n: 5, ancho: [50, 80], alto: [14, 24], cols: ['#8a6a7e', '#a07a88', '#7a5a70'] },
      { z: -90, f: 0.16, n: 4, ancho: [110, 160], alto: [30, 46], cols: ['#a8a0c8', '#bab4d8'], nieve: true },
    ];
    filas.forEach((F, fi) => {
      for (let i = 0; i < F.n; i++) {
        const w = F.ancho[0] + hash(i, fi, 3) * (F.ancho[1] - F.ancho[0]), h = F.alto[0] + hash(i, fi, 4) * (F.alto[1] - F.alto[0]);
        const mm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texCerro(F.cols, i + fi * 7, F.nieve), transparent: true, alphaTest: 0.1, roughness: 1 }));
        mm.geometry.translate(0, h / 2, 0);
        mm.position.set(-R * (1 + F.f) + (i / F.n) * R * 2 * (1 + F.f), -4 - fi * 2, F.z - i * (0.4 + fi * 0.6));
        this.g.add(mm);
        this.piezas.push({ mm, f: F.f, largo: R * 2 * (1 + F.f), campo: true });
      }
    });
    /* postes y cardones al lado de la vía */
    for (let i = 0; i < 10; i++) {
      const h = recorte('p', DECOR.poste, 0, 0.09);
      h.position.set(-R + i * 14, -0.4, -4.6);
      this.g.add(h); this.piezas.push({ mm: h, f: 1, largo: 140, campo: true });
    }
    for (let i = 0; i < 8; i++) {
      const h = recorte('c', DECOR.cardon, i % 3, 0.07 + hash(i, 2, 2) * 0.03);
      h.position.set(-R + i * 17.5 + hash(i, 3, 3) * 6, -0.6, -6.5 - hash(i, 4, 4) * 4);
      this.g.add(h); this.piezas.push({ mm: h, f: 1, largo: 140, campo: true });
    }
    /* el piso al lado de la vía: una tira de papel pasto */
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(400, 40), new THREE.MeshStandardMaterial({ color: '#a8905e', roughness: 1 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(m.w / 2, -0.6, -22);
    piso.receiveShadow = true;
    this.g.add(piso); this.piso = piso;
    /* el mar de nubes (se ve en el viaducto) */
    const tn = texNube();
    this.nubes = [];
    for (let i = 0; i < 18; i++) {
      const w = 10 + hash(i, 5, 5) * 14;
      const mm = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshStandardMaterial({ map: tn, transparent: true, alphaTest: 0.2, roughness: 1, emissive: '#ffe0d0', emissiveIntensity: 0.25 }));
      mm.position.set(-R + hash(i, 6, 6) * R * 2, -9 + hash(i, 7, 7) * 5, -4 - hash(i, 8, 8) * 40);
      this.g.add(mm); this.nubes.push(mm);
      this.piezas.push({ mm, f: 0.5 + hash(i, 9, 9) * 0.4, largo: R * 2, nube: true });
    }
    /* el viaducto: pilares de hierro abajo del tren */
    const tv = texViaducto();
    this.pilares = [];
    for (let i = 0; i < 8; i++) {
      const mm = new THREE.Mesh(new THREE.PlaneGeometry(4, 24), new THREE.MeshStandardMaterial({ map: tv, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 }));
      mm.geometry.translate(0, -12, 0);
      mm.position.set(-R + i * 20, 0.2, -1.5);
      mm.castShadow = true;
      this.g.add(mm); this.pilares.push(mm);
      this.piezas.push({ mm, f: 1, largo: 160, viaducto: true });
    }
    /* el túnel: pared del fondo oscura y los portales de piedra */
    this.tunel = new THREE.Group();
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(1, 12), new THREE.MeshStandardMaterial({ color: '#2a2220', roughness: 1 }));
    fondo.position.set(0, 4, ZB - 0.8); this.tunel.add(fondo); this.tunelFondo = fondo;
    const portal = () => { const mm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, ZF - ZB + 3), new THREE.MeshStandardMaterial({ color: '#6a5a4e', roughness: 1 })); mm.position.y = 13; mm.castShadow = true; this.tunel.add(mm); return mm; };
    this.portalA = portal(); this.portalB = portal();
    this.g.add(this.tunel); this.tunel.visible = false;
    this.via = 0; this.oscuro = 0; this.tramo = 'campo'; this.kViaducto = 0;
  }
  pasar(dt, t, camX, ancho, colg) {
    const m = this.m, p = m.p, R = this.R;
    const dx = this.vel * dt;
    /* en qué parte del viaje va Killa */
    const enViaducto = p.x >= this.xViaducto && p.x < this.xTunel;
    this.kViaducto += ((enViaducto ? 1 : 0) - this.kViaducto) * (1 - Math.pow(0.1, dt));
    for (const q of this.piezas) {
      q.mm.position.x -= dx * q.f;
      const rel = q.mm.position.x - camX;
      if (rel < -q.largo / 2) q.mm.position.x += q.largo;
      if (rel > q.largo / 2) q.mm.position.x -= q.largo;
      if (q.campo) { if (q.y0 == null) q.y0 = q.mm.position.y; q.mm.position.y = q.y0 - this.kViaducto * (q.f === 1 ? 16 : 10 * q.f + 4); }
      if (q.viaducto) q.mm.visible = this.kViaducto > 0.3;
      if (q.nube) q.mm.position.y += Math.sin(t * 0.5 + q.mm.position.z) * dt * 0.1;
    }
    this.piso.visible = this.kViaducto < 0.7;
    this.piso.position.y = -0.6 - this.kViaducto * 16;
    /* las nubes colgadas del cielo también corren, despacito */
    if (colg) for (const pv of colg.children) if (pv !== colg.userData.sol) {
      pv.position.x -= dx * 0.06;
      if (pv.position.x < camX - 90) pv.position.x += 180;
    }
    /* el túnel */
    const tv = vigasEn(m).filter((v) => v.tunel);
    if (tv.length) {
      const a = Math.min(...tv.map((v) => v.xa)) - 0.5, b = Math.max(...tv.map((v) => v.xa)) + 0.5;
      const ve = b > camX - ancho && a < camX + ancho;
      this.tunel.visible = ve;
      if (ve) {
        this.tunelFondo.scale.x = b - a; this.tunelFondo.position.x = (a + b) / 2;
        this.portalA.position.x = a - 0.7; this.portalB.position.x = b + 0.7;
      }
      const adentro = p.x > a && p.x < b;
      this.oscuro += ((adentro ? 1 : 0) - this.oscuro) * (1 - Math.pow(0.02, dt));
    }
  }
}
