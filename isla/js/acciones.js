// Lo que hace el jugador con lo que tiene en la mano: talar palmeras, minar
// rocas pedazo a pedazo, cavar con la pala, cortar pasto con la guadaña,
// pescar, pelear, construir y romper bloques, comer, cocinar, plantar cocos y
// tirar cosas. Y la tecla E: juntar, abrir la mesa o un cofre, bajar a la
// mina, descansar en la choza, arreglar el faro, comerciar, subir al barco.
// También las estrellas que caen de noche.
//
// El golpe se decide en el IMPACTO de la animación (a los 0,42 del gesto), no
// al hacer clic: así el sonido y las astillas salen cuando el pico toca.
import * as THREE from '../vendor/three.module.min.js';
import { ITEMS, modeloItem } from './items.js';
import { TIPOS_BLOQUE } from './construir.js';
import { MINA_Y, VETAS_MINA } from './mina.js';
import { RADIO, ALTO } from './jugador.js';
import { t } from './idioma.js';

const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _v = new THREE.Vector3(), _dir = new THREE.Vector3(), _o = new THREE.Vector3();
const azar = Math.random;

const COL = {
  piedra: [0x9aa0ab, 0x7d8290, 0xc9ced8, 0x5d616b],
  madera: [0x8a5a2b, 0xc99a5a, 0x6b4423, 0xa86b33],
  hojas: [0x5fbf3a, 0x79d24a, 0x3f9a2a, 0x9be05a],
  arena: [0xf3e2bb, 0xe8d3a0, 0xd9c089],
  pasto: [0x6fcf3f, 0x4fa82f, 0x8fe05a],
  tierra: [0x8a6a4a, 0x6b4f35, 0x9b7b58],
  estrella: [0xffd040, 0xff8a10, 0xffe27a, 0xffffff],
};

export const PINCELES = [
  { id: 'subir', glifo: '▲', color: '#3b8a3b' },
  { id: 'bajar', glifo: '▼', color: '#3b8a3b' },
  { id: 'aplanar', glifo: '▬', color: '#3b8a3b' },
  { id: 'suavizar', glifo: '≈', color: '#3b8a3b' },
  { id: 'arena', glifo: '', color: '#e9d39a' },
  { id: 'pasto', glifo: '', color: '#5fbf3a' },
];
for (const p of PINCELES) Object.defineProperty(p, 'nombre', { get: () => t('pincel.' + p.id) });
const COLOR_PINCEL = { subir: 0x7dff8f, bajar: 0xff9a5a, aplanar: 0x5ff6ff, suavizar: 0xb6a0ff, arena: 0xffe9b0, pasto: 0x8fff5a };
const RADIO_PALA = 2.2;
const M3_POR_PIEDRA = 0.35;   // la pala sube el piso con piedra y la devuelve al bajarlo

// Un anillo que se pega al terreno: dónde va a actuar la pala.
function crearAnillo(escena) {
  const n = 48;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i < n; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  m.renderOrder = 4;
  m.visible = false;
  m.userData.n = n;
  escena.add(m);
  return m;
}

export class Acciones {
  constructor(J) {
    this.J = J;
    this.sel = 0;
    this.pincel = 0;
    this.romper = null;          // { b, t, total }
    this.tPala = 0;
    this.palaAltura = null;
    this.saldoPiedra = 0;        // m³ que la pala tiene a favor (+) o debe (−)
    this.tEstrella = 45;
    this.cayendo = [];
    this.luzMano = null;
    this.anillo = crearAnillo(J.escena);
    this.ap = null;              // a qué apunta la mira este cuadro
    this.tBarra = 0;
    this.terrenoMina = { altura: (x, z) => (J.mina.abiertoEn(x, z) ? MINA_Y : MINA_Y + 40) };
  }

  seleccionar(i) {
    const n = ((i % 9) + 9) % 9;
    if (n !== this.sel) { this.sel = n; this.J.son.sfx('ui'); }
  }
  ranura() { return this.J.inv.ranuras[this.sel]; }
  item() { const r = this.ranura(); return r ? ITEMS[r.id] : null; }

  // ── apuntar ───────────────────────────────────────────────────────────────
  // Todo lo que la mira toca, y gana lo más cercano.
  apuntar(o, d) {
    const J = this.J, bajo = J.bajo;
    const c = [];
    const obj = J.objetos.apuntado(o, d, 3.6);
    if (obj) c.push({ tipo: 'objeto', obj, d: _v.copy(obj.g.position).sub(o).dot(d) });
    const rb = J.bloques.rayo(o, d, 5.5, bajo ? this.terrenoMina : J.mundo.terreno, bajo ? null : J.mundo.pisos);
    // dónde se construye: lo decide el rayo de bloques y terreno aunque haya
    // una rama tirada más cerca (si no, cualquier cosa en el piso tapa la celda)
    this.celda = null;
    if (rb && !(bajo && !rb.bloque && !J.mina.abiertoEn(rb.punto.x, rb.punto.z))) this.celda = rb.celdaAntes;
    if (rb) {
      if (rb.bloque) c.push({ tipo: 'bloque', b: rb.bloque, d: rb.d, punto: rb.punto, celda: rb.celdaAntes });
      else {
        const pared = bajo && !J.mina.abiertoEn(rb.punto.x, rb.punto.z);
        c.push({ tipo: pared ? 'pared' : rb.terreno ? 'terreno' : 'piso', d: rb.d, punto: rb.punto, celda: pared ? null : rb.celdaAntes });
      }
    }
    const rr = (bajo ? J.mina.rocas : J.mundo.rocas).rocaEn(o, d, 3.6);
    if (rr) c.push({ tipo: 'roca', roca: rr.roca, d: rr.t, punto: o.clone().addScaledVector(d, rr.t) });
    if (!bajo) {
      const V = J.mundo.veg;
      const p = V.palmeraEn(o, d, 3.2);
      if (p) {
        const h = Math.max(1e-4, d.x * d.x + d.z * d.z);
        const t = ((p.x - o.x) * d.x + (p.z - o.z) * d.z) / h;
        c.push({ tipo: 'palmera', p, d: Math.max(0, t - 0.3), punto: o.clone().addScaledVector(d, t) });
      }
      // arbustos: el rayo pasa cerca del centro de la mata
      let mejor = null, tm = 3.2;
      for (const a of V.arbustos) {
        if (!a.viva || Math.abs(a.x - o.x) > 4 || Math.abs(a.z - o.z) > 4) continue;
        _v.set(a.x - o.x, a.y + 0.45 * a.esc - o.y, a.z - o.z);
        const t = _v.dot(d);
        if (t < 0 || t > tm) continue;
        if (_v.lengthSq() - t * t < (0.55 * a.esc) ** 2) { tm = t; mejor = a; }
      }
      if (mejor) c.push({ tipo: 'arbusto', a: mejor, d: tm, punto: o.clone().addScaledVector(d, tm) });
    }
    c.sort((a, b) => a.d - b.d);
    let ap = c[0] || null;
    // lo que no se apunta con la mira: la boca de la mina, la escalera, el sillón
    const pj = J.jugador.p;
    if (!bajo) {
      const B = J.mundo.mina;
      const dx = B.entrada.x - pj.x, dz = B.entrada.z - pj.z;
      if (Math.hypot(dx, dz) < 2.6 && -(d.x * B.frente.x + d.z * B.frente.z) > 0.2) ap = { tipo: 'mina', d: 1, sub: ap };
      const S = this.sillon();
      if (S && Math.hypot(S.x - pj.x, S.z - pj.z) < 2 && J.noche > 0.5 && (!ap || ap.tipo === 'piso' || ap.tipo === 'terreno')) ap = { tipo: 'sillon', d: 1, sub: ap };
      // el faro, el mercader y el barco: alcanza con estar al lado
      const H = J.historia;
      if (H && H.cercaDelFaro(pj)) ap = { tipo: 'faro', d: 1, sub: ap };
      if (J.mercader && J.mercader.cerca(pj)) ap = { tipo: 'mercader', d: 1, sub: ap };
      if (H && H.cercaDelBarco(pj)) ap = { tipo: 'barco', d: 1, sub: ap };
    } else if (Math.hypot(J.mina.salida.x - pj.x, J.mina.salida.z - pj.z) < 2.2) ap = { tipo: 'escalera', d: 1, sub: ap };
    return ap;
  }

  sillon() {
    const g = this.J.mundo.choza.grupo.position;
    return { x: g.x - 0.9, z: g.z - 1.7 };
  }

  // ── cada cuadro ───────────────────────────────────────────────────────────
  actualizar(dt, e) {
    const J = this.J;
    if (e.num >= 0 && e.num < 9) this.seleccionar(e.num);
    if (e.rueda) this.seleccionar(this.sel + e.rueda);
    if (e.pincel) this.pincel = (this.pincel + 1) % PINCELES.length;
    const r = this.ranura();
    const it = r ? ITEMS[r.id] : null;
    J.mano.poner(r ? r.id : null);
    const herr = it ? it.herr : null;
    if (J.pesca.activa() && herr !== 'cana') J.pesca.recoger();
    if (herr !== 'arco' && J.combate.tensando) J.combate.soltarArco();

    const o = _o.copy(J.ojos), d = J.jugador.direccionMirada(_dir);
    const ap = (this.ap = this.apuntar(o, d));
    const base = ap && ap.sub !== undefined ? ap.sub : ap;

    // el cartelito de la mira
    J.hud.aviso(this.textoAviso(ap, it));

    if (e.e) this.interactuar(ap);
    if (e.comer) this.comer();
    if (e.soltar) this.tirar(e.todo);

    // click derecho: abrir, poner, ponerse, leer, cocinar, plantar o comer
    if (e.poner) {
      if (base && base.tipo === 'bloque' && (base.b.tipo === 'mesa' || base.b.tipo === 'cofre')) this.interactuar(base);
      else if (it && it.tipo === 'bloque') this.colocar(this.celda, it);
      else if (it && it.defensa) this.ponerse();
      else if (it && it.id === 'botella') this.leer();
      else if (it && it.cocina && this.fogataCerca()) this.cocinar();
      else if (it && it.id === 'coco' && this.lugarPlantar(base)) this.plantar(base.punto);
      else if (it && (it.comida || it.cura)) this.comer();
    }

    // holograma de construcción
    if (it && it.tipo === 'bloque' && this.celda) J.bloques.mostrarHolo(this.celda, it.bloque, this.celdaValida(this.celda, it.bloque));
    else J.bloques.mostrarHolo(null);

    // click izquierdo. Un enemigo al alcance gana: con uno encima no se rompen bloques.
    const enemigo = J.enemigos.apuntado(o, d, (it && it.alcance ? it.alcance : 2.4) + 0.3, 0.7);
    if (herr === 'pala') this.usarPala(dt, e, base);
    else if (herr === 'arco') {
      this.anillo.visible = false;
      this.romper = null;
      J.combate.arco(dt, e.usar, it);
    } else {
      this.anillo.visible = false;
      this.palaAltura = null;
      if (base && base.tipo === 'bloque' && e.usar && herr !== 'cana' && !enemigo) this.romperBloque(dt, base.b, it);
      else {
        this.romper = null;
        if (herr === 'cana') { if (e.usarRecien) J.mano.golpear(0.5); }
        else if (e.usar) J.mano.golpear(it && it.ritmo ? it.ritmo : 0.36);
      }
    }

    // el farol en la mano alumbra
    if (herr === 'farol') {
      if (!this.luzMano) this.luzMano = J.luces.agregar(o, it.luz, 1.9);
      this.luzMano.pos.copy(o).addScaledVector(d, 0.4).add(_v.set(0, -0.25, 0));
    } else if (this.luzMano) { J.luces.quitar(this.luzMano); this.luzMano = null; }

    const impacto = J.mano.actualizar(dt, J.camaraOjos, J.jugador);
    if (impacto) this.alImpacto(it);

    this.tBarra -= dt;
    if (this.tBarra <= 0 && !this.romper && !J.combate.tensando) J.hud.progreso(null);
    this.estrellas(dt);
  }

  textoAviso(ap, it) {
    const E = this.J.entrada;
    if (!E.tactil && !E.capturado) return t('a.clic');
    return this.textoMira(ap, it) || this.textoItem(ap, it);
  }

  textoMira(ap, it) {
    if (!ap) return '';
    const N = (id) => ITEMS[id].nombre;
    switch (ap.tipo) {
      case 'objeto': return '<kbd>E</kbd>' + t('a.juntar', { n: N(ap.obj.id) + (ap.obj.n > 1 ? ' ×' + ap.obj.n : '') });
      case 'mina': return '<kbd>E</kbd>' + t('a.mina');
      case 'escalera': return '<kbd>E</kbd>' + t('a.subir');
      case 'sillon': return '<kbd>E</kbd>' + t('a.descansar');
      case 'faro': return '<kbd>E</kbd>' + t('a.faro');
      case 'mercader': return '<kbd>E</kbd>' + t('a.mercader');
      case 'barco': return '<kbd>E</kbd>' + t('a.barco');
      case 'bloque':
        if (ap.b.tipo === 'mesa') return '<kbd>E</kbd>' + t('a.mesa');
        if (ap.b.tipo === 'cofre') return '<kbd>E</kbd>' + t('a.cofre');
        return '';
      case 'roca':
        if (ap.roca.raro && !(it && it.herr === 'pico' && it.poder >= 2)) return t('a.picoHierro');
        return '';
      default: return '';
    }
  }

  // Lo que se puede hacer con lo que tenés en la mano, si la mira no dice nada.
  textoItem(ap, it) {
    if (!it) return '';
    const base = ap && ap.sub !== undefined ? ap.sub : ap;
    if (it.id === 'botella') return t('a.leer');
    if (it.defensa) return t('a.ponerse');
    if (it.cocina && this.fogataCerca()) return t('a.cocinar');
    if (it.id === 'coco' && this.lugarPlantar(base)) return t('a.plantar');
    const M = this.J.mapa;
    if (it.herr === 'pala' && M && M.tesoro && !M.tesoro.encontrado && this.J.inv.contar('mapaTesoro') && Math.hypot(M.tesoro.x - this.J.jugador.p.x, M.tesoro.z - this.J.jugador.p.z) < 4) return t('a.tesoro');
    return '';
  }

  // ── E ─────────────────────────────────────────────────────────────────────
  interactuar(ap) {
    const J = this.J;
    if (!ap) return;
    if (ap.tipo === 'objeto') {
      if (J.inv.cabe(ap.obj.id, 1)) ap.obj.juntando = 0.001;
      else J.hud.noti(t('n.llena'), null, 'lleno');
    } else if (ap.tipo === 'bloque' && ap.b.tipo === 'mesa') { J.son.sfx('uiSi'); J.hud.abrir('mesa'); }
    else if (ap.tipo === 'bloque' && ap.b.tipo === 'cofre') {
      const k = `${ap.b.x},${ap.b.y},${ap.b.z}`;
      J.son.sfx('cofre');
      J.hud.abrir('cofre', J.bloques.cofres.get(k));
    } else if (ap.tipo === 'bloque' && ap.b.tipo === 'fogata') { if (this.item() && this.item().cocina) this.cocinar(); }
    else if (ap.tipo === 'mina') this.bajarMina();
    else if (ap.tipo === 'escalera') this.subirMina();
    else if (ap.tipo === 'sillon') this.descansar();
    else if (ap.tipo === 'faro') { J.son.sfx('uiSi'); J.hud.abrir('faro'); }
    else if (ap.tipo === 'mercader') { J.son.sfx('moneda'); J.hud.abrir('tienda'); }
    else if (ap.tipo === 'barco') J.final();
  }

  bajarMina() {
    const J = this.J;
    J.son.sfx('mina');
    J.stats.mina = (J.stats.mina || 0) + 1;
    J.fundido(() => {
      J.ponerBajo(true);
      J.jugador.ponerEn(_v.set(J.mina.salida.x, MINA_Y, J.mina.salida.z - 1.6), 0);
      J.jugador.pitch = 0;
      J.hud.noti(t('n.mina'), null, 'mina');
      if (!J.inv.contar('farol')) J.hud.noti(t('n.farol'), 'farol', 'farolAviso');
    });
  }

  subirMina() {
    const J = this.J;
    J.son.sfx('mina');
    J.fundido(() => {
      J.ponerBajo(false);
      const B = J.mundo.mina;
      J.jugador.ponerEn(_v.copy(B.entrada).addScaledVector(B.frente, 1.4), Math.atan2(-B.frente.x, -B.frente.z));
    });
  }

  descansar() {
    const J = this.J;
    J.fundido(() => {
      // si todavía no era medianoche, el día lo suma el reloj al dar la vuelta
      const salta = J.cielo.hora > 0.27;
      J.cielo.hora = 0.27;
      J.jugador.vida = Math.min(100, J.jugador.vida + 30);
      J.hud.noti(t('n.dia', { n: J.dia + (salta ? 1 : 0) }), null, 'dia');
    }, 1.2);
  }

  // ── comer y tirar ────────────────────────────────────────────────────────
  comer() {
    const J = this.J, r = this.ranura();
    if (!r) return;
    const it = ITEMS[r.id];
    if (!it.comida && !it.cura) return;
    const cura = it.cura || 0;
    // lo que cura se toma aunque no haya hambre, si falta vida
    if (J.jugador.hambre >= 99.5 && !(cura && J.jugador.vida < 99.5)) { J.hud.noti(t('n.sinHambre'), null, 'lleno'); return; }
    J.jugador.hambre = Math.min(100, J.jugador.hambre + (it.comida || 0));
    J.jugador.vida = Math.min(100, J.jugador.vida + (it.comida || 0) * 0.3 + cura);
    J.inv.quitarDe(this.sel, 1);
    J.son.sfx('comer');
    const boca = _v.copy(J.ojos).addScaledVector(J.jugador.direccionMirada(_dir), 0.45).add({ x: 0, y: -0.2, z: 0 });
    J.part.rafaga(boca, 8, [it.color || 0xf0e0c0, 0xffffff], { vel: 1.2, arriba: 1.5, tam: 0.04, vida: 0.5 });
    J.stats.comidas = (J.stats.comidas || 0) + 1;
  }

  // ── la fogata: cocinar ───────────────────────────────────────────────────
  fogataCerca(r = 3.5) {
    const p = this.J.jugador.p;
    return this.J.bloques.fogatas.find((f) => Math.hypot(f.x + 0.5 - p.x, f.z + 0.5 - p.z) < r && Math.abs(f.y - p.y) < 2) || null;
  }

  cocinar() {
    const J = this.J, r = this.ranura(), it = r && ITEMS[r.id];
    const f = this.fogataCerca();
    if (!it || !it.cocina || !f) return;
    J.inv.quitarDe(this.sel, 1);
    const resto = J.inv.agregar(it.cocina, 1);
    const fuego = _v.set(f.x + 0.5, f.y + 0.5, f.z + 0.5);
    if (resto) J.objetos.soltar(it.cocina, resto, fuego.clone().add({ x: 0, y: 0.4, z: 0 }));
    J.son.sfx('fuego');
    J.part.rafaga(fuego, 16, [0xff8a10, 0xffe27a, 0xfff1b0, 0x4a4a4a], { vel: 1.4, arriba: 3.5, g: -1, vida: 0.9, tam: 0.06 });
    J.mano.golpear(0.3);
    J.stats.cocinados = (J.stats.cocinados || 0) + 1;
    if (!J.descubrir(it.cocina)) J.hud.noti(t('n.cocinado', { nombre: ITEMS[it.cocina].nombre }), it.cocina, 'cocina');
  }

  // ── el peto: clic derecho para ponértelo (el de antes vuelve a la mochila) ──
  ponerse() {
    const J = this.J, r = this.ranura();
    if (!r || !ITEMS[r.id].defensa) return;
    const id = r.id, antes = J.armadura;
    J.inv.quitarDe(this.sel, 1);
    J.armadura = id;
    if (antes) { const resto = J.inv.agregar(antes, 1); if (resto) this.lanzar(antes, resto); }
    J.son.sfx('metal');
    J.hud.noti(t('n.ponerse', { nombre: ITEMS[id].nombre }), id, 'peto');
  }

  // ── la botella: el mensaje se lee y la botella vacía se tira ─────────────
  leer() {
    const J = this.J, r = this.ranura();
    if (!r || r.id !== 'botella') return;
    J.inv.quitarDe(this.sel, 1);
    J.historia.leerCarta();
  }

  // ── plantar un coco: en arena o pasto, lejos de otras palmeras ──────────
  lugarPlantar(base) {
    const J = this.J;
    if (J.bajo || !base || base.tipo !== 'terreno' || base.d > 4.5) return false;
    const x = base.punto.x, z = base.punto.z, h = J.mundo.terreno.altura(x, z);
    if (h < 0.35 || J.mundo.dentroDePiso(x, z, 1) || J.bloques.cerca(x, z, 1.5).length) return false;
    for (const p of J.mundo.veg.palmeras) if (p.viva && Math.abs(p.x - x) < 2.2 && Math.abs(p.z - z) < 2.2) return false;
    return J.mundo.veg.hayLugar();
  }

  plantar(punto) {
    const J = this.J, T = J.mundo.terreno;
    const x = punto.x, z = punto.z;
    if (!J.mundo.veg.plantar(x, T.altura(x, z), z)) return;
    J.inv.quitarDe(this.sel, 1);
    J.son.sfx('pala');
    J.part.rafaga(_v.set(x, T.altura(x, z) + 0.1, z), 10, T.pasto(x, z) > 0.5 ? COL.pasto : COL.arena, { vel: 1.4, arriba: 2, tam: 0.05, vida: 0.6 });
    J.mundo.pasto.tocar(x, z, 1.5);
    J.mano.golpear(0.3);
    J.stats.plantadas = (J.stats.plantadas || 0) + 1;
    J.hud.noti(t('n.plantado'), 'coco', 'plantar');
  }

  tirar(todo = false) {
    const J = this.J, r = this.ranura();
    if (!r) return;
    const q = J.inv.quitarDe(this.sel, todo ? r.n : 1);
    this.lanzar(q.id, q.n);
  }

  lanzar(id, n) {
    const J = this.J;
    const d = J.jugador.direccionMirada(_dir);
    const desde = _v.copy(J.ojos).addScaledVector(d, 0.6).add({ x: 0, y: -0.25, z: 0 });
    const o = J.objetos.soltar(id, n, desde, d.clone().multiplyScalar(5).add(new THREE.Vector3(0, 2, 0)));
    if (o) o.t = -0.6;
    J.son.sfx('lanzar');
  }

  // ── construir ─────────────────────────────────────────────────────────────
  celdaValida(c, tipo) {
    const J = this.J;
    if (!c || !TIPOS_BLOQUE[tipo]) return false;
    const [x, y, z] = c;
    if (J.bloques.hay(x, y, z)) return false;
    const alto = TIPOS_BLOQUE[tipo].alto;
    if (J.bajo) {
      if (!J.mina.abiertoEn(x + 0.5, z + 0.5) || y < MINA_Y || y + alto > J.mina.techo() + 0.01) return false;
    } else if (y < -9 || y > 40 || Math.abs(x) > 124 || Math.abs(z) > 124) return false;
    // que no te encierre adentro
    const p = J.jugador.p;
    if (p.x + RADIO > x && p.x - RADIO < x + 1 && p.z + RADIO > z && p.z - RADIO < z + 1 && p.y + ALTO > y && p.y < y + alto) return false;
    return true;
  }

  colocar(celda, it) {
    const J = this.J;
    if (!celda || !this.celdaValida(celda, it.bloque)) return;
    const [x, y, z] = celda;
    // el frente del modelo (+z) mira al jugador: rotar +z en yaw da (sen, cos)
    const rot = ((Math.round(J.jugador.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    if (!J.bloques.poner(it.bloque, x, y, z, rot)) return;
    J.inv.quitarDe(this.sel, 1);
    J.son.sfx('poner');
    J.part.rafaga(_v.set(x + 0.5, y + 0.05, z + 0.5), 8, it.bloque === 'piedra' ? COL.piedra : COL.madera, { vel: 1.4, arriba: 1.2, tam: 0.05, esparcir: 0.9 });
    J.mano.golpear(0.3);
    if (!J.bajo) J.mundo.pasto.tocar(x + 0.5, z + 0.5, 1.5);
    J.stats.bloques = (J.stats.bloques || 0) + 1;
  }

  tiempoRomper(b, it) {
    const herr = it ? it.herr : null, poder = it && it.poder ? it.poder : 1;
    switch (b.tipo) {
      case 'madera': return herr === 'hacha' ? 0.6 / Math.sqrt(poder) : 1.2;
      case 'piedra': return herr === 'pico' ? 0.5 / Math.sqrt(poder) : 2.5;
      case 'tablon': return 0.3;
      case 'farolPie': return 0.5;
      default: return 0.8;
    }
  }

  romperBloque(dt, b, it) {
    const J = this.J;
    if (!this.romper || this.romper.b !== b) this.romper = { b, t: 0, total: this.tiempoRomper(b, it), tSon: 0 };
    const R = this.romper;
    R.t += dt; R.tSon -= dt;
    J.mano.golpear(it && it.ritmo ? Math.min(it.ritmo, 0.4) : 0.3);
    const piedra = b.tipo === 'piedra';
    if (R.tSon <= 0) {
      R.tSon = 0.22;
      J.son.sfx(piedra ? 'golpePiedra' : 'golpeMadera', { anti: 60 });
      if (this.ap && this.ap.punto) J.part.rafaga(this.ap.punto, 3, piedra ? COL.piedra : COL.madera, { vel: 1.5, arriba: 1.5, tam: 0.035, vida: 0.5 });
    }
    J.hud.progreso(R.t / R.total);
    if (R.t < R.total) return;
    const s = J.bloques.sacar(b.x, b.y, b.z);
    this.romper = null;
    J.hud.progreso(null);
    if (!s) return;
    const c = _v.set(b.x + 0.5, b.y + TIPOS_BLOQUE[b.tipo].alto / 2, b.z + 0.5);
    J.son.sfx(piedra ? 'romperPiedra' : 'romperMadera');
    J.part.rafaga(c, 18, piedra ? COL.piedra : COL.madera, { vel: 2.5, arriba: 3, tam: 0.07, esparcir: 0.8 });
    J.objetos.soltar(s.item, 1, c.clone());
    if (s.contenido) for (const r of s.contenido.ranuras) if (r) J.objetos.soltar(r.id, r.n, c.clone());
    if (!J.bajo) J.mundo.pasto.tocar(b.x + 0.5, b.z + 0.5, 1.5);
  }

  // ── el golpe ──────────────────────────────────────────────────────────────
  alImpacto(it) {
    const J = this.J;
    const herr = it ? it.herr : null;
    const o = _o.copy(J.ojos), d = J.jugador.direccionMirada(_dir);
    if (herr === 'cana') {
      const res = J.pesca.tocar(o, d, J.bajo ? -1e9 : J.nivelAgua);
      if (res) this.pescado(res);
      return;
    }
    if (herr === 'arco') return;
    if (herr === 'guadana') { this.guadanazo(); }
    // pegarle a un enemigo gana a todo lo demás
    if (J.combate.golpe(it)) return;
    const ap = this.apuntar(o, d);
    const t = ap && ap.sub !== undefined ? ap.sub : ap;
    if (!t) return;
    if (t.tipo === 'palmera') this.golpearPalmera(t.p, it, t.punto);
    else if (t.tipo === 'roca') this.golpearRoca(t.roca, it, t.punto);
    else if (t.tipo === 'arbusto' && herr !== 'guadana') this.cortarArbusto(t.a);
    else if ((t.tipo === 'terreno' || t.tipo === 'pared') && t.d < 3.2) {
      J.son.sfx(J.bajo ? 'golpePiedra' : 'paso', { sup: 'arena', anti: 60 });
      J.part.rafaga(t.punto, 4, J.bajo ? COL.piedra : J.mundo.terreno.pasto(t.punto.x, t.punto.z) > 0.5 ? COL.pasto : COL.arena, { vel: 1, arriba: 1.5, tam: 0.035, vida: 0.4 });
    }
  }

  golpearPalmera(p, it, punto) {
    const J = this.J, V = J.mundo.veg;
    const poder = it && it.herr === 'hacha' ? it.poder : 0;
    p.vida -= poder ? 5 / Math.ceil(5 / poder) : 5 / 12;
    J.son.sfx('golpeMadera');
    J.part.rafaga(punto, 7, COL.madera, { vel: 2.2, arriba: 2, tam: 0.05, vida: 0.7 });
    J.part.rafaga(_v.copy(p.copa), 5, COL.hojas, { vel: 1.5, arriba: 0.5, g: 3, vida: 1.8, tam: 0.07, esparcir: 2.5 });
    if (p.cocosQuedan === undefined) p.cocosQuedan = p.cocos;
    if (p.cocosQuedan > 0 && azar() < 0.3) this.caerCoco(p);
    else if (azar() < 0.12) J.objetos.soltar('rama', 1, _v.copy(p.copa).add({ x: 0, y: -0.4, z: 0 }), new THREE.Vector3(azar() - 0.5, 0, azar() - 0.5));
    this.tBarra = 1.4;
    J.hud.progreso(1 - Math.max(0, p.vida) / 5);
    if (p.vida <= 0.001) this.talar(p);
  }

  caerCoco(p) {
    const V = this.J.mundo.veg;
    p.cocosQuedan--;
    V.cocos.setMatrixAt(p.c0 + p.cocosQuedan, CERO);
    V.cocos.instanceMatrix.needsUpdate = true;
    this.J.objetos.soltar('coco', 1, _v.set(p.copa.x, p.copa.y - 0.3, p.copa.z), new THREE.Vector3((azar() - 0.5) * 1.5, 0, (azar() - 0.5) * 1.5));
  }

  talar(p) {
    const J = this.J, V = J.mundo.veg;
    if (p.cocosQuedan === undefined) p.cocosQuedan = p.cocos;
    while (p.cocosQuedan > 0) this.caerCoco(p);
    V.quitarPalmera(p);
    // un brote da poca madera
    const n = p.reserva && p.crece < 1 ? 1 + Math.floor(p.crece * 3) : 3 + Math.floor(p.segs / 4);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const q = new THREE.Vector3(p.x, p.y + 0.4, p.z).lerp(p.copa, u * 0.8);
      J.objetos.soltar('madera', 1, q, new THREE.Vector3((azar() - 0.5) * 3, 1 + azar() * 2, (azar() - 0.5) * 3));
      J.part.rafaga(q, 6, COL.madera, { vel: 2, arriba: 2, tam: 0.07 });
    }
    J.objetos.soltar('rama', 1 + (azar() < 0.5 ? 1 : 0), _v.copy(p.copa));
    if (azar() < 0.5) J.objetos.soltar('fibra', 1, _v.copy(p.copa));
    J.part.rafaga(p.copa, 36, COL.hojas, { vel: 3, arriba: 1.5, g: 4, vida: 2.2, tam: 0.09, esparcir: 3 });
    J.son.sfx('romperMadera');
    J.hud.progreso(null);
    J.stats.palmeras = (J.stats.palmeras || 0) + 1;
  }

  cortarArbusto(a) {
    const J = this.J;
    J.mundo.veg.quitarArbusto(a);
    J.son.sfx('cortar');
    J.part.rafaga(_v.set(a.x, a.y + 0.5, a.z), 18, COL.hojas, { vel: 2, arriba: 2, g: 6, vida: 1.2, tam: 0.06, esparcir: 1 });
    J.objetos.soltar('fibra', 1 + (azar() < 0.4 ? 1 : 0), _v.set(a.x, a.y + 0.4, a.z));
    if (azar() < 0.3) J.objetos.soltar('rama', 1, _v.set(a.x, a.y + 0.4, a.z));
  }

  golpearRoca(m, it, punto) {
    const J = this.J;
    const rocas = J.bajo ? J.mina.rocas : J.mundo.rocas;
    const poder = it && it.herr === 'pico' ? it.poder : 0;
    if (m.raro && poder < 2) {
      J.son.sfx('metal');
      J.part.rafaga(punto, 6, [0xffffff, 0xffe27a], { vel: 3, arriba: 2, tam: 0.03, vida: 0.3 });
      J.hud.noti(t('n.veta'), 'picoHierro', 'raro');
      return;
    }
    m.golpes = (m.golpes || 0) + 1;
    const porPedazo = poder >= 2 ? 1 : poder === 1 ? 2 : 5;
    const colVeta = m.veta ? [m.colorVeta || 0xb46cff, 0xffffff] : null;
    J.son.sfx(m.veta ? 'cristal' : 'golpePiedra');
    J.part.rafaga(punto, 6, COL.piedra, { vel: 2.4, arriba: 2, tam: 0.045, vida: 0.6 });
    if (colVeta) J.part.rafaga(punto, 3, colVeta, { vel: 2, arriba: 2, tam: 0.035, vida: 0.7 });
    const total = m.trozos.length;
    const quedan = m.trozos.filter((t) => t.vivo).length;
    this.tBarra = 1.4;
    J.hud.progreso((total - quedan + (m.golpes % porPedazo) / porPedazo) / total);
    if (m.golpes % porPedazo !== 0) return;
    const r = rocas.sacarPedazo(m, punto);
    if (!r) return;
    J.son.sfx('romperPiedra');
    J.part.rafaga(r.pos, 14, COL.piedra, { vel: 2.6, arriba: 3, tam: 0.08, esparcir: r.escala });
    if (colVeta) J.part.rafaga(r.pos, 8, colVeta, { vel: 2, arriba: 3, tam: 0.05 });
    for (const [id, n] of this.botinRoca(m, J.bajo)) J.objetos.soltar(id, n, r.pos.clone().add({ x: 0, y: 0.2, z: 0 }));
    if (r.fin) {
      J.part.rafaga(_v.set(m.x, m.y + 0.3, m.z), 20, COL.piedra, { vel: 3, arriba: 3, tam: 0.07, esparcir: m.r });
      J.stats.rocas = (J.stats.rocas || 0) + 1;
      J.hud.progreso(null);
    }
  }

  // Lo que sale de cada pedazo. Arriba: piedra y a veces carbón, hierro y algo
  // de cuarzo; abajo, más metal y gemas; en las vetas, su gema; en las raras,
  // lo raro.
  botinRoca(m, enMina) {
    const res = [];
    if (!enMina) {
      res.push(['piedra', 1 + (azar() < 0.5 ? 1 : 0)]);
      if (azar() < 0.12) res.push(['carbon', 1]);
      if (azar() < 0.07) res.push(['hierro', 1]);
      if (azar() < 0.06) res.push(['pirita', 1]);
      if (azar() < 0.03) res.push(['cuarzo', 1]);
      if (azar() < 0.01) res.push(['oro', 1]);
      if (m.veta && ITEMS[m.veta] && azar() < 0.45) res.push([m.veta, 1]);
    } else {
      res.push(['piedra', 1]);
      if (azar() < 0.18) res.push(['carbon', 1 + (azar() < 0.3 ? 1 : 0)]);
      if (azar() < 0.14) res.push(['hierro', 1]);
      if (azar() < 0.03) res.push(['oro', 1]);
      if (azar() < 0.08) res.push(['pirita', 1]);
      if (azar() < 0.06) res.push([VETAS_MINA[Math.floor(azar() * VETAS_MINA.length)][0], 1]);
      if (m.veta && ITEMS[m.veta] && azar() < 0.55) res.push([m.veta, 1]);
      if (m.raro && azar() < 0.2) { const R = this.J.mina.RAROS; res.push([R[Math.floor(azar() * R.length)], 1]); }
    }
    return res;
  }

  guadanazo() {
    const J = this.J;
    if (J.bajo) return;
    const T = J.mundo.terreno, p = J.jugador.p, yaw = J.jugador.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let cortado = 0;
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.38, ca = Math.cos(a), sa = Math.sin(a);
      const dx = fx * ca - fz * sa, dz = fx * sa + fz * ca;
      for (const dist of [1.1, 2.0]) {
        const x = p.x + dx * dist, z = p.z + dz * dist;
        if (J.mundo.dentroDePiso(x, z)) continue;
        const m2 = T.cortarPasto(x, z, 0.75);
        if (m2 > 0) { cortado += m2; J.part.rafaga(_v.set(x, T.altura(x, z) + 0.2, z), 3, COL.pasto, { vel: 1.8, arriba: 2, g: 8, vida: 0.8, tam: 0.05 }); }
      }
    }
    // las matas que caen en el arco
    for (const a of J.mundo.veg.arbustos) {
      if (!a.viva) continue;
      const dx = a.x - p.x, dz = a.z - p.z, dd = Math.hypot(dx, dz);
      if (dd < 2.6 && (dx * fx + dz * fz) / Math.max(1e-4, dd) > 0.55) this.cortarArbusto(a);
    }
    J.son.sfx('cortar');
    if (cortado > 0) {
      J.mundo.pasto.tocar(p.x + fx * 1.5, p.z + fz * 1.5, 3);
      if (azar() < 0.35) J.objetos.soltar('fibra', 1, _v.set(p.x + fx * 1.4, T.altura(p.x + fx * 1.4, p.z + fz * 1.4) + 0.3, p.z + fz * 1.4));
      J.stats.pasto = (J.stats.pasto || 0) + cortado;
    }
  }

  pescado(res) {
    const J = this.J;
    const destino = _v.set(J.jugador.p.x, J.jugador.p.y + 1.2, J.jugador.p.z);
    const T = 0.9;
    const vel = new THREE.Vector3((destino.x - res.desde.x) / T, (destino.y - res.desde.y + 0.5 * 18 * T * T) / T, (destino.z - res.desde.z) / T);
    J.objetos.soltar(res.id, 1, res.desde, vel);
    J.stats.peces = (J.stats.peces || 0) + 1;
  }

  // ── la pala ───────────────────────────────────────────────────────────────
  usarPala(dt, e, ap) {
    const J = this.J;
    const tipo = PINCELES[this.pincel].id;
    const punto = !J.bajo && ap && ap.tipo === 'terreno' ? ap.punto : null;
    this.mostrarAnillo(punto, tipo);
    if (!e.usar || !punto) { this.palaAltura = null; return; }
    const T = J.mundo.terreno;
    if (this.palaAltura === null) this.palaAltura = T.altura(punto.x, punto.z);
    // debajo del piso de la choza o del muelle no: el piso quedaría enterrado
    if (J.mundo.dentroDePiso(punto.x, punto.z, 0.8)) { J.hud.aviso(t('a.aca')); return; }
    J.mano.golpear(0.32);
    const fuerza = 1.5 * dt;
    let vol = 0;
    if (tipo === 'arena' || tipo === 'pasto') {
      const c = T.pintarMat(punto.x, punto.z, RADIO_PALA * 0.8, 0, tipo === 'pasto' ? 1 : 0) + T.pintarMat(punto.x, punto.z, RADIO_PALA * 0.8, 1, 0);
      if (c > 0) this.tPala -= dt * 3;
    } else {
      const disponible = Math.max(0, this.saldoPiedra) + J.inv.contar('piedra') * M3_POR_PIEDRA;
      vol = T.pincel(punto.x, punto.z, RADIO_PALA, tipo === 'suavizar' ? fuerza * 1.2 : fuerza, tipo, this.palaAltura, disponible);
      this.saldoPiedra -= vol;
      while (this.saldoPiedra < 0 && J.inv.quitar('piedra', 1)) this.saldoPiedra += M3_POR_PIEDRA;
      while (this.saldoPiedra >= M3_POR_PIEDRA) {
        this.saldoPiedra -= M3_POR_PIEDRA;
        const resto = J.inv.agregar('piedra', 1);
        if (resto) J.objetos.soltar('piedra', resto, J.jugador.p.clone().add({ x: 0, y: 1, z: 0 }));
      }
      if (tipo === 'subir' && vol < 1e-4 && disponible < 1e-3) J.hud.aviso(t('a.piedra'));
    }
    this.tPala -= dt;
    if (this.tPala <= 0) {
      this.tPala = 0.28;
      J.son.sfx('pala');
      const pw = T.pasto(punto.x, punto.z), tw = T.tierra(punto.x, punto.z);
      J.part.rafaga(_v.set(punto.x, T.altura(punto.x, punto.z) + 0.1, punto.z), 6, tw > 0.5 ? COL.tierra : pw > 0.5 ? COL.pasto : COL.arena, { vel: 1.6, arriba: 2.5, tam: 0.05, vida: 0.7, esparcir: 1.2 });
      J.mundo.pasto.tocar(punto.x, punto.z, RADIO_PALA + 1);
      J.stats.pala = (J.stats.pala || 0) + Math.abs(vol);
      if (tipo === 'bajar' && J.mapa) J.mapa.cavado(punto.x, punto.z);
    }
  }

  mostrarAnillo(punto, tipo) {
    const m = this.anillo;
    if (!punto) { m.visible = false; return; }
    m.visible = true;
    m.material.color.setHex(COLOR_PINCEL[tipo]);
    const T = this.J.mundo.terreno, n = m.userData.n, pos = m.geometry.attributes.position.array;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const r = RADIO_PALA * (k ? 0.92 : 1.0);
        const x = punto.x + c * r, z = punto.z + s * r;
        const j = (i * 2 + k) * 3;
        pos[j] = x; pos[j + 1] = T.altura(x, z) + 0.06; pos[j + 2] = z;
      }
    }
    m.geometry.attributes.position.needsUpdate = true;
  }

  // ── estrellas que caen ───────────────────────────────────────────────────
  estrellas(dt) {
    const J = this.J;
    if (!J.bajo && J.noche > 0.7) {
      this.tEstrella -= dt;
      if (this.tEstrella <= 0) { this.tEstrella = 70 + azar() * 45; this.lanzarEstrella(); }
    }
    for (let i = this.cayendo.length - 1; i >= 0; i--) {
      const s = this.cayendo[i];
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const k = u * u * (1.6 - 0.6 * u);
      s.m.position.lerpVectors(s.a, s.b, k);
      s.m.rotation.z += dt * 8; s.m.rotation.y += dt * 5;
      s.luz.pos.copy(s.m.position);
      J.part.rafaga(s.m.position, 2, COL.estrella, { vel: 0.4, arriba: 0, g: 0, vida: 1.1, tam: 0.3, esparcir: 0.5 });
      J.part.destello(s.m.position, { color: 0xffe27a, tam: 3.5, vida: 0.4, sube: 0 });
      if (u >= 1) {
        J.escena.remove(s.m);
        J.luces.quitar(s.luz);
        this.cayendo.splice(i, 1);
        J.objetos.soltar(s.id, 1, s.b.clone().add({ x: 0, y: 0.3, z: 0 }));
        J.part.rafaga(s.b, 40, COL.estrella, { vel: 5, arriba: 5, tam: 0.1, vida: 1.4, esparcir: 0.6 });
        for (let k2 = 0; k2 < 12; k2++) J.part.destello(_v.copy(s.b).add({ x: (azar() - 0.5) * 3, y: azar() * 2, z: (azar() - 0.5) * 3 }), { color: 0xffe27a, tam: 0.4 });
        J.son.sfx('estrella');
        J.hud.noti(t('n.estrella'), 'estrella', 'estrella');
      }
    }
  }

  lanzarEstrella() {
    const J = this.J, T = J.mundo.terreno, p = J.jugador.p;
    for (let i = 0; i < 40; i++) {
      const a = azar() * Math.PI * 2, d = 22 + azar() * 45;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const h = T.altura(x, z);
      if (h < 0.6 || J.mundo.dentroDePiso(x, z, 1)) continue;
      const b = new THREE.Vector3(x, h, z);
      const va = azar() * Math.PI * 2;
      const a0 = b.clone().add(new THREE.Vector3(Math.cos(va) * 70, 110, Math.sin(va) * 70));
      const m = modeloItem('estrella');
      m.scale.setScalar(2.2);
      J.escena.add(m);
      const luz = J.luces.agregar(a0, [1.0, 0.7, 0.3, 16], 2.4);
      this.cayendo.push({ m, luz, a: a0, b, t: 0, dur: 2.8, id: azar() < 0.1 ? 'cielo' : 'estrella' });
      return true;
    }
    return false;
  }
}
