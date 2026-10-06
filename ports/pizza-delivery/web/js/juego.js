/* El motor del port: carga un nivel, mueve al jugador (CharacterMotor + MouseLook), corre los scripts
   (historia.js) con sus corrutinas, avisa los disparadores, elige las luces más cercanas, maneja los
   sonidos, los textos 3D, las partículas y los efectos de cámara. */
import * as THREE from 'three';
import { armarEscena } from './escena.js';
import { crearFisica } from './fisica.js';
import { GUIONES, G } from './historia.js';
import { Particulas } from './particulas.js';

export const NIVELES = { Menu: 0, Loading: 1, Scene2: 2, end: 3, NewScene1: 4, DollHouse: 5 };
const CANCELADA = Symbol('cancelada');
const N_PUNTO = 4, N_FOCO = 2;

export class Juego {
  constructor({ R, renderer, escena, sonido, ui, post, letras }) {
    Object.assign(this, { R, renderer, escena, sonido, ui, post, letras });
    this.camara = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.ambiente = new THREE.AmbientLight(0x000000, 2);
    this.direccional = new THREE.DirectionalLight(0xffffff, 0);
    this.puntos = Array.from({ length: N_PUNTO }, () => new THREE.PointLight(0xffffff, 0, 1, 0));
    this.focos = Array.from({ length: N_FOCO }, () => { const f = new THREE.SpotLight(0xffffff, 0, 1, 0.5, 0.4, 0); escena.add(f.target); return f; });
    escena.add(this.ambiente, this.direccional, this.direccional.target, ...this.puntos, ...this.focos);
    this.timers = []; this.t = 0; this.subtitulo = '';
    this.cancelada = (e) => { if (e !== CANCELADA) console.error(e); };
    this.tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), e: new THREE.Euler(0, 0, 0, 'YXZ') };
  }

  /* ---------------- niveles */
  async cargarNivel(nombre) {
    if (this.cargando) return;
    this.cargando = true;
    this.pendiente = null;
    await new Promise((r) => setTimeout(r, 0)); // (que termine el cuadro que pidió el cambio)
    for (const t of this.timers) t.rej(CANCELADA);
    this.timers = [];
    this.sonido.pararTodo();
    this.ui.cargando?.(true, nombre);
    this.sub('');
    if (this.S) { this.escena.remove(this.S.raiz); this.liberar(this.S); }
    this.S = null;
    const S = await armarEscena(this.R, NIVELES[nombre], { flotante: (o, attr, clase, v) => this.flotante(o, attr, clase, v), buscados: ['MainDoor', 'Bip001 Head'] });
    this.S = S; this.nivel = nombre;
    this.escena.add(S.raiz);
    const R0 = S.render;
    this.ambienteBase = new THREE.Color(...(R0.ambiente || [0, 0, 0]).slice(0, 3));
    this.ambiente.color.copy(this.ambienteBase);
    this.escena.fog = R0.niebla ? new THREE.FogExp2(new THREE.Color(...R0.niebla_color.slice(0, 3)), R0.niebla_dens) : null;
    // la cámara: la que está prendida (MainCamera)
    const iCam = S.N.findIndex((n) => n.cam && n.cam.on && n.tag === 'MainCamera') >= 0 ? S.N.findIndex((n) => n.cam && n.cam.on && n.tag === 'MainCamera') : S.N.findIndex((n) => n.cam && n.cam.on);
    this.iCam = iCam;
    const cd = S.N[iCam]?.cam;
    if (cd) { this.camara.fov = cd.fov; this.camara.near = Math.max(0.05, cd.cerca); this.camara.far = Math.min(400, cd.lejos); this.camara.updateProjectionMatrix(); this.escena.background = new THREE.Color(...cd.fondo.slice(0, 3)); }
    // el jugador
    this.iJug = S.N.findIndex((n) => n.tag === 'Player' && n.cc);
    this.jug = null;
    this.fisica = crearFisica(S, this.R);
    if (this.iJug >= 0) {
      const n = S.N[this.iJug], cc = n.cc;
      const motor = n.guiones.find((g) => g.n === 'CharacterMotor');
      const mlJ = n.guiones.find((g) => g.n === 'MouseLook');
      const mlC = S.N[iCam]?.guiones?.find((g) => g.n === 'MouseLook');
      this.fisica.configurar({ radio: cc.radio, alto: cc.alto, centro: cc.centro, paso: cc.paso });
      const mov = motor?.movement && typeof motor.movement === 'object' && motor.movement.maxForwardSpeed ? motor.movement : { maxForwardSpeed: nombre === 'NewScene1' ? 3 : 5, maxGroundAcceleration: 20, gravity: 20 };
      this.jug = {
        o: S.O[this.iJug], vel: new THREE.Vector3(), est: { vy: 0, suelo: false },
        velMax: mov.maxForwardSpeed, acel: mov.maxGroundAcceleration || 20, grav: mov.gravity || 20, puede: motor ? motor.canControl !== false : true,
        sensX: mlJ?.sensitivityX ?? 2, sensY: mlC?.sensitivityY ?? 2, minY: mlC?.minimumY ?? -60, maxY: mlC?.maximumY ?? 60,
        yaw: new THREE.Euler().setFromQuaternion(S.O[this.iJug].quaternion, 'YXZ').y, pitch: 0, camNodo: S.O[iCam],
      };
      this.jug.o.rotation.set(0, this.jug.yaw, 0, 'YXZ');
    }
    this.control = !!this.jug && this.jug.puede; this.mirarOn = !!this.jug;
    this.objetivoMirar = null;
    this.efectos = { blur: false, sepia: false, vortex: 0 };
    this.post?.reiniciar();
    // los disparadores: estado "adentro" de cada uno
    this.dentro = new Map(); this.dentroObj = new Map();
    // textos, partículas, video
    this.armarTextos();
    this.particulas?.liberar(); this.particulas = new Particulas(S, this.R, this.escena);
    // sonidos de la escena
    const clips = [...new Set([...S.fuentes.values()].map((f) => f.def.clip).filter(Boolean))];
    await this.sonido.cargar(this.R.base, clips);
    // los scripts y los Animation de lo que está prendido
    this.instancias = []; this.iniciados = new Set();
    for (let i = 0; i < S.N.length; i++) if (S.activo[i]) this.iniciarNodo(i);
    this.cargando = false;
    this.ui.cargando?.(false, nombre);
    this.ui.alNivel?.(nombre);
  }

  liberar(S) {
    S.raiz.traverse((o) => {
      if (o.isMesh || o.isPoints) {
        if (o.geometry && !o.geometry.userData.id) o.geometry.dispose();
        for (const m of [].concat(o.material)) if (m && (m.userData?.propio || o.name === 'texto')) { m.map?.dispose(); m.dispose(); }
      }
    });
    if (this.videoEl) { this.videoEl.pause(); this.videoEl.src = ''; this.videoEl = null; }
  }

  /* lo que hace Unity al prender un objeto por primera vez: Awake/Start de sus scripts, PlayOnAwake, playAutomatically */
  iniciarNodo(i) {
    const S = this.S, n = S.N[i];
    for (const [, f] of S.fuentes) if (f.i === i && f.def.auto && f.def.on !== false && !f.h?.tocando) this.reproducir(f);
    const a = S.animadores.get(i);
    if (a && a.auto && a.def && !a.andando) a.play(a.def);
    if (this.iniciados.has(i)) return;
    this.iniciados.add(i);
    for (const g of n.guiones || []) {
      const f = GUIONES[g.n];
      if (!f) continue;
      const inst = f(this, i, g) || {};
      inst.i = i; inst.on = g.on !== 0 && g.on !== false; inst.nombre = g.n;
      this.instancias.push(inst);
    }
  }

  /* ---------------- la API que usan los scripts */
  idx(ref) { if (ref == null) return null; if (typeof ref === 'number') return ref; if (ref.nodo !== undefined) return ref.nodo; if (ref.prefab) return null; return null; }
  O(ref) { const i = this.idx(ref); return i == null ? null : this.S.O[i]; }
  buscar(nombre) { const i = this.S.buscar(nombre); return i >= 0 ? i : null; }
  buscarEn(i, nombre) { const S = this.S; const pila = [i]; while (pila.length) { const k = pila.pop(); if (S.N[k].n === nombre) return k; pila.push(...S.hijos[k]); } return null; }
  conTag(tag) { const l = this.S.conTag(tag).filter((i) => this.S.activo[i]); return l.length ? l[0] : (this.S.conTag(tag)[0] ?? null); }
  posTag(tag) { const i = this.conTag(tag); return i == null ? null : this.S.O[i].getWorldPosition(new THREE.Vector3()); }
  jugadorPos() { return this.jug ? this.jug.o.getWorldPosition(this.tmp.w) : this.tmp.w.set(0, 0, 0); }
  vivo(i) { return !!this.S && this.S.activo[i] && !this.S.destruido[i]; }
  guionOn(inst) { return inst.on && this.vivo(inst.i); }
  esperar(s) { return new Promise((res, rej) => this.timers.push({ t: this.t + s, res, rej })); }
  sub(texto) { if (typeof texto === 'number') texto = this.R.textos?.[texto] ?? ''; this.subtitulo = texto; this.ui.subtitulo?.(texto); }
  activoRec(ref, v, rec = true) {
    const i = this.idx(ref);
    if (i == null || this.S.destruido[i]) return;
    const S = this.S;
    const poner = (k) => {
      if (S.destruido[k]) return;
      const antes = S.activo[k];
      S.activo[k] = v;
      for (const m of S.mallasNodo[k]) m.visible = v && !S.N[k].rend_off && !m.userData.apagado;
      if (!v && antes) for (const [, f] of S.fuentes) if (f.i === k && f.h) { f.h.parar(); f.h = null; }
      if (v && !antes) this.iniciarNodo(k);
      if (rec) S.hijos[k].forEach(poner);
    };
    poner(i);
  }
  destruir(ref) { const i = this.idx(ref); if (i == null) return; this.activoRec(i, false); const marcar = (k) => { this.S.destruido[k] = true; this.S.hijos[k].forEach(marcar); }; marcar(i); }
  renderOn(ref, on) { const i = this.idx(ref); for (const m of this.S.mallasNodo[i] || []) { m.userData.apagado = !on; m.visible = on && this.S.activo[i]; } }
  fuente(ref) { if (!ref || ref.pid === undefined) return null; return this.S.fuentes.get(String(ref.pid)) || null; }
  reproducir(f) {
    if (f.h) f.h.parar();
    f.h = this.sonido.reproducir(f.def.clip, f.def, this.S.O[f.i], this.esDe2D(f.i));
  }
  esDe2D(i) { let k = i; while (k >= 0) { if (k === this.iJug || k === this.iCam) return true; k = this.S.N[k].p; } return false; }
  sonar(ref) { const f = this.fuente(ref); if (f) this.reproducir(f); }
  sonarSiNo(ref) { const f = this.fuente(ref); if (f && !f.h?.tocando) this.reproducir(f); }
  parar(ref) { const f = this.fuente(ref); if (f?.h) { f.h.parar(); f.h = null; } }
  pararNodo(ref) { const i = this.idx(ref); for (const [, f] of this.S.fuentes) if (f.i === i && f.h) { f.h.parar(); f.h = null; } }
  loop(ref, v) { const f = this.fuente(ref); if (f) { f.def.loop = v; if (f.h) f.h.loop(v); } }
  animar(ref, clip) { const i = this.idx(ref); const a = this.S.animadores.get(i); if (a) a.play(clip); }
  crossFade(ref, clip, t) { const i = this.idx(ref); const a = this.S.animadores.get(i); if (a) a.crossFade(clip, t); }
  controles(on) { this.control = on && !!this.jug; this.mirarOn = on && !!this.jug; if (!on && this.jug) this.jug.vel.set(0, 0, 0); }
  mirarA(ref) { this.objetivoMirar = ref == null ? null : this.idx(ref); if (this.objetivoMirar == null) this.mirarOn = this.control; }
  efecto(cual, on) { this.efectos[cual] = on; }
  noTeMuevas(on) { const inst = this.instancias.find((x) => x.nombre === 'dontMoveKill'); if (inst) inst.on = on; }
  ambienteAzul(b) { this.ambienteBase.b = b; this.ambiente.color.copy(this.ambienteBase); }
  luz(ref, on) { const i = this.idx(ref); const l = this.S.luces.find((x) => x.i === i); if (l) l.on = on; }
  video(ref, on) {
    const i = this.idx(ref);
    const m = this.S.mallasNodo[i]?.[0];
    const vid = Object.values(this.R.C.texs).find((t) => t.video);
    if (!m || !vid || !on) return;
    const el = document.createElement('video');
    el.src = this.R.base + 'datos/' + vid.video; el.loop = true; el.muted = true; el.playsInline = true; el.play().catch(() => {});
    const tex = new THREE.VideoTexture(el);
    const mats = [].concat(m.material).map((x) => { const c = new THREE.MeshBasicMaterial({ map: tex }); c.userData.propio = true; return c; });
    m.material = Array.isArray(m.material) ? mats : mats[0];
    this.videoEl = el;
  }
  sangre() { const i = this.conTag('Blood'); if (i != null) this.particulas.emitir(i, true); }
  toca(i) {
    if (!this.jug) return false;
    const p = this.S.O[i].getWorldPosition(this.tmp.v), j = this.jugadorPos();
    const dx = p.x - j.x, dz = p.z - j.z;
    return Math.hypot(dx, dz) < this.fisica.cap.radio + 0.45 && Math.abs(p.y - j.y) < 2.5;
  }
  instanciar(ref, pos, quat) {
    const pid = ref?.prefab;
    if (!pid) return null;
    const base = this.S.agregar(pid, pos, quat);
    for (let i = base; i < this.S.N.length; i++) if (this.S.activo[i]) this.iniciarNodo(i);
    this.particulas.agregar(base);
    return base;
  }
  spawn() { // MainScript.SpawnGhost: 1 de 5, si no hay otro, uno de los fantasmas, atrás del jugador
    if (G.ghostPresent || !this.fantasmas?.length) return;
    if (1 + Math.floor(Math.random() * 5) !== 2) return;
    const i = this.conTag('EnemySpawn');
    if (i == null) return;
    G.ghostPresent = true;
    const o = this.S.O[i];
    this.instanciar(this.fantasmas[Math.floor(Math.random() * this.fantasmas.length)], o.getWorldPosition(new THREE.Vector3()), o.getWorldQuaternion(new THREE.Quaternion()));
  }
  /* las curvas de un valor de las animaciones */
  flotante(o, attr, clase, v) {
    const i = o.userData.i;
    if (attr === 'm_Enabled' && clase === 23) { for (const m of this.S.mallasNodo[i] || []) { m.userData.apagado = v < 0.5; m.visible = v >= 0.5 && this.S.activo[i]; } return; }
    if (attr === 'm_Enabled' && clase === 65) { for (const c of this.S.colisiones) if (c.i === i) c.on = v >= 0.5; return; }
    if (attr.startsWith('_Color.')) {
      const ch = attr[7];
      for (const m of this.S.mallasNodo[i] || []) for (const mt of [].concat(m.material)) {
        if (ch === 'a') { mt.opacity = Math.max(0, Math.min(1, v)); mt.transparent = true; }
        else if (mt.color) mt.color[ch] = v;
      }
    }
  }

  /* ---------------- textos 3D */
  armarTextos() {
    const S = this.S;
    for (const tx of S.textos) {
      const lineas = this.traducirTexto(tx.original).replace(/\r/g, '').split('\n');
      const F = 64, cv = document.createElement('canvas'), cx = cv.getContext('2d');
      const fam = this.letras[tx.def.letra] || 'serif';
      const fuente = `${tx.def.estilo & 1 ? 'bold ' : ''}${F}px ${fam}`;
      cx.font = fuente;
      const altoL = F * 1.2 * (tx.def.linea || 1);
      const ancho = Math.max(4, Math.ceil(Math.max(...lineas.map((l) => cx.measureText(l).width)))) + 8;
      cv.width = ancho; cv.height = Math.ceil(altoL * lineas.length) + 8;
      cx.font = fuente; cx.textBaseline = 'top';
      const [r, g, b] = tx.color;
      cx.fillStyle = `rgb(${r * 255},${g * 255},${b * 255})`;
      cx.textAlign = ['left', 'center', 'right'][tx.def.alin] || 'left';
      const xx = cx.textAlign === 'left' ? 4 : cx.textAlign === 'center' ? cv.width / 2 : cv.width - 4;
      lineas.forEach((l, k) => cx.fillText(l, xx, 4 + k * altoL));
      const m = tx.plano.material;
      m.map?.dispose(); m.map = new THREE.CanvasTexture(cv); m.map.anisotropy = 4; m.opacity = tx.color[3] ?? 1; m.needsUpdate = true;
      // tamaño: el de Unity (fontSize·characterSize·0,1 por "em"); fontSize 0 = el de la letra (16)
      const em = (tx.def.fuente || 16) * tx.def.tam * 0.1, esc = em / F;
      const w = cv.width * esc, h = cv.height * esc;
      tx.plano.scale.set(w, h, 1);
      const ax = tx.def.ancla % 3, ay = Math.floor(tx.def.ancla / 3);
      tx.plano.position.set(ax === 0 ? w / 2 : ax === 1 ? 0 : -w / 2, ay === 0 ? -h / 2 : ay === 1 ? 0 : h / 2, 0.001);
    }
  }
  traducirTexto(t) { return this.ui.traducir ? this.ui.traducir(t) : t; }

  /* ---------------- cada cuadro */
  update(dt, inp, ajustes) {
    const S = this.S;
    if (!S || this.cargando) return;
    this.t += dt;
    // corrutinas
    if (this.timers.length) {
      const listos = this.timers.filter((x) => x.t <= this.t);
      if (listos.length) { this.timers = this.timers.filter((x) => x.t > this.t); for (const x of listos) x.res(); }
    }
    const J = this.jug, T = this.tmp;
    if (J) {
      if (this.mirarOn && this.objetivoMirar == null) {
        const k = 0.0035 * ajustes.sens;
        J.yaw -= inp.mx * k * (J.sensX / 2);
        J.pitch -= inp.my * k * (ajustes.invertir ? -1 : 1);
        J.pitch = Math.max(THREE.MathUtils.degToRad(J.minY || -60), Math.min(THREE.MathUtils.degToRad(J.maxY || 60), J.pitch));
        if (!J.maxY && !J.minY) J.pitch = Math.max(-1.0, Math.min(1.0, J.pitch));
      } else if (this.objetivoMirar != null) {
        const p = S.O[this.objetivoMirar].getWorldPosition(T.v), c = J.camNodo.getWorldPosition(T.w);
        const d = p.sub(c);
        const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
        let dy = yaw - J.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        J.yaw += dy * Math.min(1, 3 * dt); J.pitch += (pitch - J.pitch) * Math.min(1, 3 * dt);
      }
      J.o.rotation.set(0, J.yaw, 0, 'YXZ');
      if (J.camNodo) J.camNodo.rotation.set(J.pitch, 0, 0);
      // CharacterMotor: acelera hacia la velocidad pedida, con gravedad
      const quiero = T.v.set(0, 0, 0);
      if (this.control && J.puede) {
        const c = Math.cos(J.yaw), s = Math.sin(J.yaw), l = Math.min(1, Math.hypot(inp.x, inp.y));
        const ix = l > 0 ? inp.x / Math.max(1, Math.hypot(inp.x, inp.y)) : 0, iy = l > 0 ? inp.y / Math.max(1, Math.hypot(inp.x, inp.y)) : 0;
        quiero.set((ix * c - iy * s) * J.velMax, 0, (-ix * s - iy * c) * J.velMax);
      }
      const dv = T.w.subVectors(quiero, J.vel); dv.y = 0;
      const max = J.acel * dt;
      if (dv.length() > max) dv.setLength(max);
      J.vel.add(dv);
      J.est.vy = J.est.suelo ? -1 : Math.max(-20, J.est.vy - J.grav * dt);
      this.fisica.mover(J.o.position, T.v.set(J.vel.x * dt, J.est.vy * dt, J.vel.z * dt), J.est);
    }
    const entrada = this.control || !J ? inp : { ...inp, x: 0, y: 0 };
    // los scripts
    for (const inst of this.instancias) if (inst.update) try { inst.update.call(inst, dt, inp); } catch (e) { console.error(inst.nombre, e); }
    if (this.cargando) return;
    // animaciones
    for (const [i, a] of S.animadores) if (S.activo[i] || i === this.iCam) a.update(dt);
    S.raiz.updateMatrixWorld();
    // disparadores
    if (J) {
      const p = J.o.getWorldPosition(T.v);
      for (const d of S.disparadores) {
        if (!this.vivo(d.i) || d.on === false) { this.dentro.delete(d); continue; }
        const ahora = this.fisica.adentro(d, p, this.fisica.cap.radio);
        const antes = this.dentro.get(d);
        this.dentro.set(d, ahora);
        if (ahora && !antes) for (const inst of this.instancias) if (inst.i === d.i && inst.onTrigger && this.guionOn(inst)) { try { inst.onTrigger('Player')?.catch?.(this.cancelada); } catch (e) { console.error(inst.nombre, e); } }
        if (this.cargando) return;
      }
      // el visor: los que tienen tag de fantasma o de demonio y entran al disparador de la cámara
      const visor = this.instancias.find((x) => x.nombre === 'sawGhost');
      if (visor && this.vivo(visor.i)) {
        const dv2 = S.disparadores.find((d) => d.i === visor.i);
        if (dv2) for (const tag of ['Ghost', 'FinalDemon']) for (const k of S.conTag(tag)) {
          if (!this.vivo(k)) continue;
          const ahora = this.fisica.adentro(dv2, S.O[k].getWorldPosition(T.w), 0.4);
          const antes = this.dentroObj.get(k);
          this.dentroObj.set(k, ahora);
          if (ahora && !antes) visor.onTriggerObj({ i: k, tag })?.catch?.(this.cancelada);
          this.efectos.vortex = ahora ? 220 : this.efectos.vortex;
        }
      }
    }
    if (this.cargando) return;
    this.particulas.update(dt);
    this.luces();
    // la cámara de three = el nodo MainCamera
    if (this.iCam >= 0) {
      S.O[this.iCam].matrixWorld.decompose(this.camara.position, this.camara.quaternion, T.w);
    }
    this.sonido.actualizar(this.camara);
    this.post?.actualizar(this.efectos, dt);
  }

  /* las luces prendidas más cercanas pasan al grupo fijo de luces de three */
  luces() {
    const S = this.S, cam = this.camara.position, T = this.tmp;
    const cand = [];
    let dir = null;
    for (const l of S.luces) {
      if (!l.on || !this.vivo(l.i)) continue;
      if (l.def.tipo === 1) { if (!dir) dir = l; continue; }
      const p = S.O[l.i].getWorldPosition(new THREE.Vector3());
      cand.push({ l, p, d: p.distanceTo(cam) - l.def.rango });
    }
    cand.sort((a, b) => a.d - b.d);
    const ptos = cand.filter((c) => c.l.def.tipo === 2).slice(0, N_PUNTO), focos = cand.filter((c) => c.l.def.tipo === 0).slice(0, N_FOCO);
    this.puntos.forEach((pl, k) => {
      const c = ptos[k];
      if (!c) { pl.intensity = 0; return; }
      pl.position.copy(c.p); pl.color.setRGB(...c.l.def.color.slice(0, 3)); pl.intensity = c.l.def.int * 2; pl.distance = c.l.def.rango;
    });
    this.focos.forEach((f, k) => {
      const c = focos[k];
      if (!c) { f.intensity = 0; return; }
      f.position.copy(c.p); f.color.setRGB(...c.l.def.color.slice(0, 3)); f.intensity = c.l.def.int * 2; f.distance = c.l.def.rango;
      f.angle = THREE.MathUtils.degToRad(Math.min(170, c.l.def.angulo) / 2); f.penumbra = 0.4;
      S.O[c.l.i].getWorldQuaternion(T.q); f.target.position.copy(c.p).add(T.v.set(0, 0, -1).applyQuaternion(T.q));
    });
    if (dir) {
      const o = S.O[dir.i]; o.getWorldQuaternion(T.q);
      this.direccional.intensity = dir.def.int * 2; this.direccional.color.setRGB(...dir.def.color.slice(0, 3));
      this.direccional.position.copy(cam).add(T.v.set(0, 0, 1).applyQuaternion(T.q).multiplyScalar(50));
      this.direccional.target.position.copy(cam);
    } else this.direccional.intensity = 0;
  }
}
