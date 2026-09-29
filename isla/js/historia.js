// El propósito: naufragaste. Tu barco quedó roto en la playa y en una botella
// alguien cuenta que el faro de la isla está apagado desde que el guardián de
// la mina se llevó su cristal. Sin luz, ningún barco se acerca.
//
// Cinco capítulos: el naufragio (herramientas), la primera noche (armas,
// fogata, cocinar), el faro (encontrarlo y repararlo), el guardián (bajar a lo
// hondo de la mina y vencerlo) y la luz (poner el cristal, encenderlo con una
// estrella caída y esperar el barco). Después de rescatado se sigue jugando.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { matGema } from './gemas.js';
import { mergeSimple } from './rocas.js';
import { pintar } from './texturas.js';
import { ITEMS } from './items.js';
import { t } from './idioma.js';

const _v = new THREE.Vector3();
const caja = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export const ETAPAS_FARO = [
  { id: 'escalera', pide: { madera: 20, hierro: 4 } },
  { id: 'lente', pide: { cuarzo: 3, oro: 1 } },
  { id: 'cristal', pide: { corazonCristal: 1 } },
  { id: 'luz', pide: { estrella: 1 }, deNoche: true },
];

// ── el faro ─────────────────────────────────────────────────────────────────
function texFranjas() {
  // blanco y rojo, en franjas, con la piedra gastada: 16×32 texels
  return pintar(16, 32, (x, y) => {
    const franja = Math.floor(y / 8) % 2;
    const h = Math.sin(x * 12.9 + y * 78.2) * 43758.5 % 1;
    if (y % 8 === 0) return franja ? '#8f2a22' : '#c9c3b6';
    if (franja) return Math.abs(h) > 0.9 ? '#a8352a' : '#c8402f';
    return Math.abs(h) > 0.9 ? '#d9d3c6' : '#f1ece0';
  });
}

class Faro {
  constructor(J, pos, mira) {
    this.J = J;
    this.pos = pos.clone();
    this.etapa = 0;
    const M = J.mundo.M;
    const g = (this.grupo = new THREE.Group());
    g.position.copy(pos);
    g.rotation.y = mira;
    const piedra = matPixel('mundo', { mapa: J.tex.roca, tam: [32, 32], color: 0xc4c0b8, clave: 'faroPiedra' });
    const franjas = matPixel('uv', { mapa: texFranjas(), tam: [16, 32], clave: 'faroFranjas' });
    const rojo = matPixel('liso', { color: 0xb8352a, clave: 'faroTecho' });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.9, 1.2, 12).translate(0, 0.6, 0), piedra);
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.15, 11.5, 12, 1, true).translate(0, 7.0, 0), franjas);
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 12).translate(0, 12.8, 0), piedra);
    const puerta = new THREE.Mesh(caja(1.0, 1.9, 0.3, 0, 2.1, 2.05), M.maderaOscura);
    this.tablas = new THREE.Mesh(mergeSimple([caja(1.2, 0.18, 0.1, 0, 1.8, 2.25).rotateZ(0.25), caja(1.2, 0.18, 0.1, 0, 2.5, 2.25).rotateZ(-0.2)]), M.madera);
    // lo que falta en la ruina: se muestra de a etapas
    const ruina = [];
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; ruina.push(caja(0.6, 0.3 + (k % 3) * 0.25, 0.5, Math.cos(a) * 1.45, 13.1, Math.sin(a) * 1.45)); }
    this.ruina = new THREE.Mesh(mergeSimple(ruina), piedra);
    // etapa 1: galería, baranda y andamio
    const galeria = [new THREE.CylinderGeometry(2.4, 2.4, 0.22, 14).translate(0, 13.05, 0)];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; galeria.push(caja(0.07, 0.8, 0.07, Math.cos(a) * 2.3, 13.55, Math.sin(a) * 2.3)); }
    galeria.push(new THREE.TorusGeometry(2.3, 0.04, 4, 20).rotateX(Math.PI / 2).translate(0, 13.95, 0));
    this.galeria = new THREE.Mesh(mergeSimple(galeria), M.maderaOscura);
    const andamio = [];
    for (let k = 0; k < 10; k++) { const a = k * 0.72; const y = 1.5 + k * 1.15; andamio.push(caja(1.1, 0.12, 0.5, 0, y, 0).translate(0, 0, 2.35).rotateY(a)); }
    this.andamio = new THREE.Mesh(mergeSimple(andamio), M.madera);
    // etapa 2: el cuarto de la lente y el techo
    this.vidrio = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.7, 10).translate(0, 14.0, 0), matPixel('liso', { color: 0xcfefff, brillo: 1.5, clave: 'faroVidrio' }));
    this.techo = new THREE.Mesh(mergeSimple([new THREE.ConeGeometry(1.6, 1.5, 10).translate(0, 15.6, 0), new THREE.SphereGeometry(0.22, 6, 4).translate(0, 16.45, 0)]), rojo);
    // etapa 3: el cristal adentro
    this.cristal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55).scale(1, 1.4, 1).translate(0, 14.0, 0), matGema(0x5ff6ff, 'cristal', { emision: 0.7 }));
    // etapa 4: la luz y el haz que gira
    this.foco = new THREE.Mesh(new THREE.CylinderGeometry(1.21, 1.21, 1.72, 10).translate(0, 14.0, 0), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    const haz = new THREE.ConeGeometry(9, 120, 16, 1, true).translate(0, -60, 0).rotateZ(Math.PI / 2);
    const matHaz = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.haz = new THREE.Group();
    this.haz.add(new THREE.Mesh(haz, matHaz), new THREE.Mesh(haz.clone().rotateY(Math.PI), matHaz));
    this.haz.position.set(0, 14.0, 0);
    for (const m of [base, torre, tapa, puerta, this.tablas, this.ruina, this.galeria, this.andamio, this.vidrio, this.techo]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(base, torre, tapa, puerta, this.tablas, this.ruina, this.galeria, this.andamio, this.vidrio, this.techo, this.cristal, this.foco, this.haz);
    g.traverse((o) => o.layers.enable(1));
    J.escena.add(g);
    // la puerta, del lado que mira a la isla
    this.puerta = new THREE.Vector3(0, 0, 2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), mira).add(pos);
    this.luz = null;
    this.ponerEtapa(0);
  }

  ponerEtapa(n) {
    this.etapa = n;
    this.ruina.visible = n < 1;
    this.tablas.visible = n < 1;
    this.galeria.visible = n >= 1;
    this.andamio.visible = n === 1;
    this.vidrio.visible = this.techo.visible = n >= 2;
    this.cristal.visible = n >= 3;
    this.foco.visible = this.haz.visible = n >= 4;
    if (n >= 4 && !this.luz) this.luz = this.J.luces.agregar(new THREE.Vector3(this.pos.x, this.pos.y + 14, this.pos.z), [1.0, 0.9, 0.6, 30], 3);
  }

  actualizar(dt) {
    if (this.etapa >= 4) this.haz.rotation.y += dt * 0.6;
    if (this.etapa === 3) this.cristal.rotation.y += dt * 0.8;
  }
}

// ── el barco roto de la playa y el que viene a buscarte ─────────────────────
// El casco en rebanadas: angosto y alto en la proa, chato en la popa, con la
// franja pintada arriba. El roto está tumbado en la arena, con un agujero en
// el costado, tablas de menos en la cubierta y el palo partido en el piso.
function modeloBarco(M, roto) {
  const g = new THREE.Group();
  const casco = [], cubierta = [], franja = [];
  const L = 10, N = 16, paso = L / N + 0.02;
  for (let i = 0; i < N; i++) {
    const u = ((i + 0.5) / N) * 2 - 1;                 // −1 popa · 1 proa
    const z = (u * L) / 2;
    const ancho = 3.4 * Math.sqrt(Math.max(0.06, 1 - Math.max(0, u) ** 2 * 0.95 - (Math.min(0, u) * 0.6) ** 2));
    const alto = 1.5 + Math.max(0, u - 0.3) * 0.9 + Math.max(0, -u - 0.7) * 1.4;
    casco.push(caja(ancho * 0.5, 0.3, paso, 0, 0.15, z));                          // la quilla
    for (const lado of [-1, 1]) {
      casco.push(caja(ancho * 0.3, 0.26, paso, lado * ancho * 0.36, 0.34, z));     // la panza
      if (roto && lado === 1 && i > 5 && i < 10) continue;                          // el agujero
      casco.push(caja(0.18, alto, paso, (lado * ancho) / 2, alto / 2 + 0.1, z));
      franja.push(caja(0.22, 0.2, paso, (lado * ancho) / 2, alto - 0.12, z));
    }
    if (!roto || i % 4 !== 2) cubierta.push(caja(ancho - 0.25, 0.1, paso, 0, 1.2, z));
  }
  // el bauprés, adelante
  casco.push(caja(0.18, 0.18, 2.6, 0, 1.9, L / 2 + 0.9).rotateX(-0.35));
  const pintura = matPixel('liso', { color: roto ? 0xd9cfb4 : 0xf4efe4, clave: roto ? 'franjaVieja' : 'franja' });
  g.add(new THREE.Mesh(mergeSimple(casco), M.maderaOscura), new THREE.Mesh(mergeSimple(cubierta), M.madera), new THREE.Mesh(mergeSimple(franja), pintura));
  const vela = matPixel('liso', { color: roto ? 0xe0d6c0 : 0xf4efe4, lados: THREE.DoubleSide, clave: roto ? 'velaVieja' : 'vela' });
  if (roto) {
    // el palo partido, la mitad caída al costado con la vela rota
    g.add(new THREE.Mesh(caja(0.3, 1.6, 0.3, 0, 2.0, 0.6), M.madera));
    const caido = new THREE.Group();
    caido.add(new THREE.Mesh(mergeSimple([caja(0.26, 5.5, 0.26, 0, 2.75, 0), caja(3.2, 0.14, 0.14, 0, 4.4, 0)]), M.madera));
    caido.add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2).translate(0, 3.2, 0.16), vela));
    caido.position.set(2.2, 1.2, 0.6);
    caido.rotation.set(0.15, 0.4, -1.35);
    g.add(caido);
    g.rotation.z = 0.32;
  } else {
    // la toldilla de popa con su ventana, dos palos con vergas y velas, y la bandera
    g.add(new THREE.Mesh(caja(2.4, 1.3, 2.2, 0, 1.9, -3.7), M.maderaOscura));
    g.add(new THREE.Mesh(caja(0.6, 0.4, 0.05, 0, 2.0, -2.58), matPixel('liso', { color: 0xffe9a0, emisivo: 0x7a5a20, clave: 'ventanaBarco' })));
    for (const [z, h] of [[-0.8, 8.5], [2.6, 6.8]]) {
      g.add(new THREE.Mesh(mergeSimple([caja(0.3, h, 0.3, 0, 1.2 + h / 2, z), caja(4.2, 0.16, 0.16, 0, 1.2 + h * 0.86, z), caja(3.4, 0.14, 0.14, 0, 1.2 + h * 0.42, z)]), M.madera));
      const v = new THREE.PlaneGeometry(3.8, h * 0.42, 4, 1);
      // la vela inflada: el medio más adelante que los bordes
      const pv = v.attributes.position;
      for (let k = 0; k < pv.count; k++) pv.setZ(k, 0.35 * (1 - (pv.getX(k) / 1.9) ** 2));
      v.computeVertexNormals();
      g.add(new THREE.Mesh(v.translate(0, 1.2 + h * 0.64, z + 0.12), vela));
    }
    g.add(new THREE.Mesh(caja(0.9, 0.5, 0.05, 0.45, 10.3, -0.8), matPixel('liso', { color: 0xc8252e, lados: THREE.DoubleSide, clave: 'bandera' })));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.layers.enable(1); } });
  return g;
}

// ── mensajes en botellas: pistas de la historia ─────────────────────────────
const CARTAS = ['c.1', 'c.2', 'c.3', 'c.4', 'c.5'];

export class Historia {
  constructor(J) {
    this.J = J;
    const W = J.mundo, T = W.terreno;
    // el faro: en la punta de costa más lejos de la choza
    const C = W.choza.grupo.position;
    let mejor = null;
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      for (let d = 40; d < 115; d += 1) {
        const x = Math.cos(a) * d, z = Math.sin(a) * d, h = T.altura(x, z);
        if (h < 1.2 && d > 60) {
          const x2 = Math.cos(a) * (d - 7), z2 = Math.sin(a) * (d - 7), h2 = T.altura(x2, z2);
          if (h2 > 1.6 && h2 < 7) {
            const lejos = Math.hypot(x2 - C.x, z2 - C.z);
            if (!mejor || lejos > mejor.lejos) mejor = { x: x2, z: z2, h: h2, a, lejos };
          }
          break;
        }
      }
    }
    if (!mejor) mejor = { x: -C.x * 0.8, z: -C.z * 0.8, h: T.altura(-C.x * 0.8, -C.z * 0.8), a: 0 };
    for (let i = 0; i < 6; i++) T.pincel(mejor.x, mejor.z, 6, 0.6, 'aplanar', mejor.h);
    // alrededor, arena pisada en vez de pasto
    T.pintarMat(mejor.x, mejor.z, 5.5, 0, 0);
    T.pintarMat(mejor.x, mejor.z, 5.5, 1, 0);
    T.actualizar();
    // es parte de la isla generada: lo guardado se mide desde acá
    T.base.set(T.alturas);
    T.matBase.set(T.mat);
    // mira hacia el centro de la isla (la puerta de ese lado)
    this.faro = new Faro(J, new THREE.Vector3(mejor.x, mejor.h, mejor.z), Math.atan2(-mejor.x, -mejor.z));
    W.obstFijos.push({ x: mejor.x, z: mejor.z, r: 2.6, y0: mejor.h - 1, y1: mejor.h + 16 });
    W.quitarVegetacionEn(mejor.x, mejor.z, 7);

    // el naufragio: en la arena, entre la choza y el agua, a un costado
    const D =new THREE.Vector3(W.muelle.punta.x - C.x, 0, W.muelle.punta.z - C.z).normalize();
    const Pp = new THREE.Vector3(-D.z, 0, D.x);
    let pw = C.clone().addScaledVector(Pp, -16).addScaledVector(D, 3);
    for (let i = 0; i < 20 && T.altura(pw.x, pw.z) > 0.8; i++) pw.addScaledVector(D, 1);
    pw.y = T.altura(pw.x, pw.z);
    this.naufragio = modeloBarco(W.M, true);
    this.naufragio.position.set(pw.x, pw.y - 0.5, pw.z);
    this.naufragio.rotation.y = Math.atan2(D.x, D.z) + 0.7;
    J.escena.add(this.naufragio);
    const ry = this.naufragio.rotation.y;
    for (const k of [-3.4, 0, 3.4]) W.obstFijos.push({ x: pw.x + Math.sin(ry) * k, z: pw.z + Math.cos(ry) * k, r: 1.7, y0: pw.y - 1, y1: pw.y + 3 });
    this.posNaufragio = pw.clone();
    W.quitarVegetacionEn(pw.x, pw.z, 6);

    this.barco = null;          // el de rescate
    this.estadoBarco = null;    // null · 'espera' · 'viene' · 'llego' · 'se fue'
    this.carta = 0;
    this.rescatado = false;
    this.capitulo = 1;
    this.cartelT = 0;
  }

  // ── E: el faro y el barco ──────────────────────────────────────────────
  cercaDelFaro(p) { return Math.hypot(p.x - this.faro.puerta.x, p.z - this.faro.puerta.z) < 3 && Math.abs(p.y - this.faro.pos.y) < 3; }
  cercaDelBarco(p) {
    if (this.estadoBarco !== 'llego') return false;
    return this.barco.position.distanceTo(_v.set(p.x, this.barco.position.y, p.z)) < 7.5;
  }

  puedeHacer(etapa) {
    const J = this.J, E = ETAPAS_FARO[etapa];
    if (!E) return false;
    if (E.deNoche && J.noche < 0.6) return false;
    return Object.entries(E.pide).every(([id, n]) => J.inv.contar(id) >= n);
  }

  reparar() {
    const J = this.J, n = this.faro.etapa, E = ETAPAS_FARO[n];
    if (!E || !this.puedeHacer(n)) return false;
    for (const [id, k] of Object.entries(E.pide)) J.inv.quitar(id, k);
    this.faro.ponerEtapa(n + 1);
    J.son.sfx(n + 1 >= 4 ? 'faro' : 'craftear');
    J.part.rafaga(_v.copy(this.faro.pos).add({ x: 0, y: 12, z: 0 }), 40, [0xffffff, 0xffe27a, 0x5ff6ff], { vel: 4, arriba: 3, tam: 0.1, esparcir: 3 });
    J.hud.noti(t('f.hecho.' + E.id), null, 'faro' + n);
    if (n + 1 >= 4) { this.estadoBarco = 'espera'; J.hud.noti(t('n.faroLuz'), 'estrella', 'faroLuz', 0, true); }
    return true;
  }

  // ── cartas en botellas ─────────────────────────────────────────────────
  leerCarta() {
    const J = this.J;
    const clave = CARTAS[this.carta % CARTAS.length];
    this.carta++;
    J.hud.carta(t(clave));
    J.son.sfx('noti');
  }

  // ── cada cuadro ────────────────────────────────────────────────────────
  actualizar(dt) {
    const J = this.J;
    this.faro.actualizar(dt);
    // el barco: al amanecer después de prender el faro, aparece en el horizonte
    if (this.estadoBarco === 'espera' && J.cielo.hora > 0.26 && J.cielo.hora < 0.45 && !J.bajo) this.llamarBarco();
    if (this.estadoBarco === 'viene') {
      const b = this.barco, dest = this.destinoBarco;
      const d = _v.copy(dest).sub(b.position).setY(0);
      const dist = d.length();
      const vel = Math.min(9, 1 + dist * 0.12);
      if (dist < 0.8) { this.estadoBarco = 'llego'; J.son.sfx('barco'); J.hud.noti(t('n.barcoLlego'), null, 'barco', 0, true); }
      else b.position.addScaledVector(d.normalize(), vel * dt);
    }
    if (this.barco) {
      this.barco.position.y = -0.55 + Math.sin(J.tiempo * 0.9) * 0.08;
      this.barco.rotation.z = Math.sin(J.tiempo * 0.7) * 0.03;
    }
  }

  llamarBarco() {
    const J = this.J, W = J.mundo;
    const C = W.choza.grupo.position, pu = W.muelle.punta;
    const D = new THREE.Vector3(pu.x - C.x, 0, pu.z - C.z).normalize();
    const P = new THREE.Vector3(-D.z, 0, D.x);
    this.destinoBarco = pu.clone().addScaledVector(D, 5.5).addScaledVector(P, -2.2);
    this.barco = modeloBarco(W.M, false);
    this.barco.position.copy(this.destinoBarco).addScaledVector(D, 280);
    this.barco.rotation.y = Math.atan2(-D.x, -D.z);
    J.escena.add(this.barco);
    this.estadoBarco = 'viene';
    J.son.sfx('barco');
    J.hud.noti(t('n.barcoViene'), null, 'barcoViene', 0, true);
  }

  // ── capítulos y objetivos ──────────────────────────────────────────────
  // Cada objetivo: [clave de texto, condición]. Se cumplen en orden.
  objetivos() {
    const J = this.J, inv = J.inv, s = J.stats;
    const tiene = (id) => inv.contar(id) > 0 || J.descubiertos.has(id);
    const hayBloque = (tipo) => [...J.bloques.mapa.values()].some((b) => b.tipo === tipo);
    return [
      [1, 'o.1', () => (inv.contar('rama') >= 2 && inv.contar('piedra') >= 1) || tiene('hachaPiedra')],
      [1, 'o.2', () => tiene('hachaPiedra')],
      [1, 'o.3', () => (s.palmeras || 0) >= 1],
      [1, 'o.4', () => hayBloque('mesa')],
      [1, 'o.botella', () => this.carta > 0],
      [2, 'o.espada', () => tiene('espadaPiedra') || tiene('espadaMadera') || tiene('lanza') || tiene('espadaHierro')],
      [2, 'o.fogata', () => hayBloque('fogata')],
      [2, 'o.noche', () => (s.enemigos || 0) >= 3],
      [2, 'o.cocinar', () => (s.cocinados || 0) >= 1],
      // el hierro de la escalera sale mejor abajo: primero la mina
      [3, 'o.faro', () => this.visitoFaro],
      [3, 'o.pico', () => tiene('picoPiedra') || tiene('picoHierro')],
      [3, 'o.farol', () => tiene('farol')],
      [3, 'o.mina', () => (s.mina || 0) >= 1],
      [3, 'o.escalera', () => this.faro.etapa >= 1],
      [3, 'o.lente', () => this.faro.etapa >= 2],
      [4, 'o.picoHierro', () => tiene('picoHierro')],
      [4, 'o.jefe', () => J.enemigos.jefeVencido],
      [5, 'o.cristal', () => this.faro.etapa >= 3],
      [5, 'o.encender', () => this.faro.etapa >= 4],
      [5, 'o.barco', () => this.rescatado],
      [6, 'o.coleccion', () => false],
    ];
  }

  revisar() {
    const J = this.J, L = this.objetivos();
    if (!this.visitoFaro && Math.hypot(J.jugador.p.x - this.faro.pos.x, J.jugador.p.z - this.faro.pos.z) < 16) this.visitoFaro = true;
    let i = J.objetivoI || 0;
    while (i < L.length - 1 && L[i][2]()) {
      J.hud.noti('✓ ' + t(L[i][1]), null, 'obj' + i);
      i++;
      if (L[i][0] !== L[i - 1][0]) this.anunciarCapitulo(L[i][0]);
    }
    J.objetivoI = i;
    this.capitulo = L[i][0];
    J.hud.objetivo(t(L[i][1]), t('cap.titulo', { n: this.capitulo, nombre: t('cap.' + this.capitulo) }));
  }

  anunciarCapitulo(n) {
    const J = this.J;
    J.hud.cartel(t('cap.titulo', { n, nombre: t('cap.' + n) }), t('cap.bajada.' + n));
    J.son.sfx('victoria');
  }

  serializar() {
    return { etapa: this.faro.etapa, carta: this.carta, faro: !!this.visitoFaro, barco: this.estadoBarco === 'viene' || this.estadoBarco === 'llego' ? 'espera' : this.estadoBarco, rescatado: this.rescatado };
  }
  cargar(d) {
    if (!d) return;
    this.faro.ponerEtapa(Math.max(0, Math.min(4, d.etapa | 0)));
    this.carta = d.carta | 0;
    this.visitoFaro = !!d.faro;
    this.rescatado = !!d.rescatado;
    this.estadoBarco = ['espera', 'se fue'].includes(d.barco) ? d.barco : (this.faro.etapa >= 4 && !this.rescatado ? 'espera' : null);
  }
}

export { modeloBarco };
