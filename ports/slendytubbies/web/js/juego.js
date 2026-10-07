/* El motor del port de Slendytubbies V2: carga una escena del build (Application.LoadLevel), imita el
   Input de Unity (GetKey/GetKeyDown/GetKeyUp, también desde los botones táctiles), prende la cámara que
   corresponde (el menú es una serie de cámaras que se prenden y apagan), mueve al jugador
   (CharacterMotor + MouseLook + "crouch and run"), corre los scripts del juego (guiones.js) con sus
   corrutinas e Invoke, avisa los disparadores a los dos lados (el que entra y el que es tocado), resuelve
   los OnMouseDown con un rayo desde la cámara y dibuja el OnGUI (imágenes a pantalla completa y ventanas). */
import * as THREE from 'three';
import { armarEscena } from './escena.js';
import { crearFisica } from './fisica.js';
import { GUIONES } from './guiones.js';
import { Particulas } from './particulas.js';
import { url } from './archivos.js';
import { crearPasto } from './pasto.js';

export const ESCENAS = ['mainmeny', 'Multiplayer1-Day', 'Multiplayer1-Dusk', 'Multiplayer1', 'Multiplayer2-Day', 'Multiplayer2-Dusk', 'Multiplayer2',
  'SingleplayerMorning', 'SingleplayerDusk', 'SingleplayerNight', 'youwonscene'];
const CANCELADA = Symbol('cancelada');
const N_PUNTO = 4, N_FOCO = 1;

export class Juego {
  constructor({ R, renderer, escena, sonido, ui, post }) {
    Object.assign(this, { R, renderer, escena, sonido, ui, post });
    this.camara = new THREE.PerspectiveCamera(60, 1, 0.3, 1000);
    this.ambiente = new THREE.AmbientLight(0x000000, 2);
    this.direccional = new THREE.DirectionalLight(0xffffff, 0);
    this.puntos = Array.from({ length: N_PUNTO }, () => new THREE.PointLight(0xffffff, 0, 1, 0));
    this.focos = Array.from({ length: N_FOCO }, () => { const f = new THREE.SpotLight(0xffffff, 0, 1, 0.5, 0.4, 0); escena.add(f.target); return f; });
    // la linterna del jugador: un foco propio (la máscara del original, flashlightcookie, en three pide sombras:
    // va como borde suave)
    this.linterna = new THREE.SpotLight(0xffffff, 0, 30, 0.5, 0.55, 0);
    escena.add(this.ambiente, this.direccional, this.direccional.target, ...this.puntos, ...this.focos, this.linterna, this.linterna.target);
    this.timers = []; this.t = 0;
    this.cancelada = (e) => { if (e !== CANCELADA) console.error(e); };
    this.tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
    this.teclas = new Set(); this.antes = new Set(); this.abajo = new Set(); this.arriba = new Set();
    this.estaticos = {}; // las variables static de los scripts
    this.cielos = new Map();
    this.niebla = null;
  }

  /* ---------------- niveles (Application.LoadLevel) */
  cargarNivel(num) { this.pendiente = num; }
  async _cargar(num) {
    this.cargando = true;
    for (const t of this.timers) t.rej?.(CANCELADA);
    this.timers = [];
    for (const inst of this.instancias || []) try { inst.fin?.(); } catch (e) { console.error(e); }
    this.sonido.pararTodo();
    this.ui.cargando?.(true, num);
    if (this.S) { this.escena.remove(this.S.raiz); this.liberar(this.S); }
    this.S = null; this.jug = null; this.iJug = -1; this.iLinterna = null; this.soyTinky = false; this.sinNiebla = false;
    this.remotos = new Set(); this.tinkyAjeno = new Set(); // (muñecos de otros jugadores y Tinkys que mueve otro)
    const S = await armarEscena(this.R, num, { flotante: (o, attr, clase, v) => this.flotante(o, attr, clase, v) });
    this.S = S; this.nivel = num; this.nombre = ESCENAS[num];
    this.escena.add(S.raiz);
    const R0 = S.render;
    this.ambiente.color.setRGB(...(R0.ambiente || [0, 0, 0]).slice(0, 3));
    this.niebla = R0.niebla ? (R0.niebla_modo === 1 ? new THREE.Fog(new THREE.Color(...R0.niebla_color.slice(0, 3)), R0.niebla_ini, R0.niebla_fin)
      : new THREE.FogExp2(new THREE.Color(...R0.niebla_color.slice(0, 3)), R0.niebla_modo === 2 ? R0.niebla_dens * 0.7 : R0.niebla_dens)) : null;
    this.escena.fog = this.niebla;
    this.cielo = R0.cielo ? await this.armarCielo(R0.cielo) : null;
    // las cámaras: Unity dibuja la de mayor profundidad entre las prendidas
    this.camOn = new Map();
    S.N.forEach((n, i) => { if (n.cam) this.camOn.set(i, !!n.cam.on && S.activo[i]); });
    this.fisica = crearFisica(S, this.R);
    this.pasto?.liberar();
    this.pasto = await crearPasto(this.R, S, this.escena, () => this.cfgPasto || { radio: 25, max: 3000 });
    this.dentro = new Map();
    this.particulas?.liberar(); this.particulas = new Particulas(S, this.R, this.escena);
    this.gui = [];
    this.instancias = []; this.iniciados = new Set();
    for (let i = 0; i < S.N.length; i++) if (S.activo[i]) this.iniciarNodo(i);
    this.cargando = false;
    this.ui.cargando?.(false, num);
    this.ui.alNivel?.(num);
  }

  async armarCielo(id) {
    if (this.cielos.has(id)) return this.cielos.get(id);
    const m = this.R.C.mats[id];
    const caras = ['_LeftTex', '_RightTex', '_UpTex', '_DownTex', '_BackTex', '_FrontTex']; // +x −x +y −y +z −z de three (z dado vuelta)
    const ims = await Promise.all(caras.map((c) => {
      const t = m?.tex[c] && this.R.C.texs[m.tex[c].t];
      if (!t?.arch) return null;
      return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url(this.R.base + 'datos/' + t.arch); });
    }));
    if (ims.some((x) => !x)) { this.cielos.set(id, null); return null; }
    // (todas las caras del mismo tamaño; la de abajo viene más chica)
    const L = Math.max(...ims.map((x) => x.width));
    const cv = ims.map((im, k) => {
      const c = document.createElement('canvas'); c.width = c.height = L;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0, L, L);
      const d = x.getImageData(0, 0, L, L); for (let k = 3; k < d.data.length; k += 4) d.data[k] = 255; x.putImageData(d, 0, 0);
      return c;
    });
    const tex = new THREE.CubeTexture(cv); tex.needsUpdate = true;
    const tinte = m.c?._Tint || [0.5, 0.5, 0.5, 1];
    const r = { tex, tinte };
    this.cielos.set(id, r);
    return r;
  }

  liberar(S) {
    S.raiz.traverse((o) => {
      if (o.isMesh || o.isPoints) {
        if (o.geometry && !o.geometry.userData.id) o.geometry.dispose();
        for (const m of [].concat(o.material)) if (m && m.userData?.propio) { m.dispose(); }
      }
    });
  }

  /* Awake/Start de los scripts, PlayOnAwake y playAutomatically, al prenderse un objeto */
  iniciarNodo(i) {
    const S = this.S, n = S.N[i];
    for (const [, f] of S.fuentes) if (f.i === i && f.def.auto && f.def.on !== false && f.def.clip && !f.h?.tocando) this.reproducir(f);
    const a = S.animadores.get(i);
    if (a && a.auto && a.def && !a.andando) a.play(a.def);
    if (this.iniciados.has(i)) return;
    this.iniciados.add(i);
    for (const g of n.guiones || []) {
      const f = GUIONES[g.n];
      if (!f) continue;
      let inst;
      try { inst = f(this, i, g) || {}; } catch (e) { console.error(g.n, e); continue; }
      inst.i = i; inst.on = g.on !== 0 && g.on !== false; inst.nombre = g.n;
      this.instancias.push(inst);
      if (inst.start) this.alSiguiente(() => { if (this.vivo(i)) try { inst.start(); } catch (e) { console.error(g.n, e); } });
    }
  }
  alSiguiente(fn) { this.timers.push({ t: this.t, res: fn }); }

  /* ---------------- el Input de Unity */
  leerTeclas(fuera) {
    this.antes = this.teclas; this.teclas = new Set(fuera);
    this.abajo = new Set([...this.teclas].filter((k) => !this.antes.has(k)));
    this.arriba = new Set([...this.antes].filter((k) => !this.teclas.has(k)));
  }
  tecla(k) { return this.teclas.has(k); }
  teclaAbajo(k) { return this.abajo.has(k); }
  teclaArriba(k) { return this.arriba.has(k); }

  /* ---------------- la API que usan los scripts */
  idx(ref) { if (ref == null) return null; if (typeof ref === 'number') return ref; if (ref.nodo !== undefined) return ref.nodo; return null; }
  O(ref) { const i = this.idx(ref); return i == null ? null : this.S.O[i]; }
  vivo(i) { return !!this.S && i != null && this.S.activo[i] && !this.S.destruido[i]; }
  conTag(tag) { return this.S.conTag(tag).filter((i) => this.vivo(i)); }
  esperar(s) { return new Promise((res, rej) => this.timers.push({ t: this.t + s, res, rej })); }
  invocar(fn, s) { this.timers.push({ t: this.t + s, res: fn }); }
  posicion(i) { return this.S.O[i].getWorldPosition(new THREE.Vector3()); }
  instanciar(ref, pos, quat, op = {}) {
    const pid = ref?.prefab;
    if (!pid || !this.S) return null;
    const base = this.S.agregar(pid, pos, quat);
    if (base < 0) return null;
    if (op.remoto) this.remotos.add(base); // (el muñeco de otro jugador: sus scripts lo saben desde el Start)
    if (op.ajeno) this.tinkyAjeno.add(base);
    for (let i = base; i < this.S.N.length; i++) if (this.S.N[i].cam) this.camOn.set(i, !!this.S.N[i].cam.on && this.S.activo[i]);
    for (let i = base; i < this.S.N.length; i++) if (this.S.activo[i]) this.iniciarNodo(i);
    this.particulas.agregar(base);
    return base;
  }
  destruir(ref, demora = 0) {
    const i = this.idx(ref);
    if (i == null || !this.S || this.S.destruido[i]) return;
    if (demora > 0) { this.invocar(() => this.destruir(i), demora); return; }
    const S = this.S, borrar = [];
    const marcar = (k) => { borrar.push(k); S.hijos[k].forEach(marcar); };
    marcar(i);
    for (const k of borrar) {
      S.activo[k] = false; S.destruido[k] = true;
      for (const m of S.mallasNodo[k]) m.visible = false;
      for (const [, f] of S.fuentes) if (f.i === k && f.h) { f.h.parar(); f.h = null; }
      for (const inst of this.instancias) if (inst.i === k && !inst.muerta) { inst.muerta = true; try { inst.fin?.(); } catch (e) { console.error(inst.nombre, e); } }
      if (k === this.iJug) { this.jug = null; this.iJug = -1; }
    }
    S.O[i].parent?.remove(S.O[i]);
    this.instancias = this.instancias.filter((x) => !x.muerta);
  }
  fuente(i, k = 0) { const l = [...this.S.fuentes.values()].filter((f) => f.i === i); return l[k] || null; }
  reproducir(f, clip) {
    if (clip !== undefined) f.def = { ...f.def, clip };
    if (f.h) f.h.parar();
    f.h = this.sonido.reproducir(f.def.clip, f.def, this.S.O[f.i], this.es2D(f));
  }
  unaVez(i, clip, vol = 1) { // audio.PlayOneShot: no corta lo que suena
    const f = this.fuente(i);
    const def = f ? { ...f.def, clip, loop: false, vol: (f.def.vol ?? 1) * vol } : { clip, vol, loop: false, min: 1, max: 500 };
    return this.sonido.reproducir(clip, def, this.S.O[i], f ? this.es2D(f) : true);
  }
  es2D(f) { const a = this.R.C.audios[f.def.clip]; return a ? a.d3 === false : false; }
  sonando(i) { const f = this.fuente(i); return !!f?.h?.tocando; }
  parar(i) { const f = this.fuente(i); if (f?.h) { f.h.parar(); f.h = null; } }
  animar(i, clip) { const a = this.S.animadores.get(i); if (a) a.play(clip); }
  camaraOn(ref, on) { const i = this.idx(ref); if (i != null && this.S.N[i]?.cam) this.camOn.set(i, on); }
  camaraActiva() {
    let mejor = -1, prof = -Infinity;
    for (const [i, on] of this.camOn) if (on && this.vivo(i) && this.S.N[i].cam.prof >= prof) { mejor = i; prof = this.S.N[i].cam.prof; }
    return mejor;
  }
  /* GUI.DrawTexture a pantalla completa mientras viva el objeto */
  imagen(i, texId) {
    const t = texId && this.R.C.texs[texId];
    if (!t?.arch) return null;
    const g = { i, src: url(this.R.base + 'datos/' + t.arch), tex: texId };
    this.gui.push(g);
    return g;
  }
  sacarImagen(g) { this.gui = this.gui.filter((x) => x !== g); }

  /* el jugador (CreatePlayer del menú de red: el prefab en el punto de aparición, con su cámara) */
  ponerJugador(base) {
    const S = this.S, n = S.N[base], cc = n.cc;
    const motor = n.guiones.find((g) => g.n === 'CharacterMotor');
    const ml = n.guiones.find((g) => g.n === 'MouseLook');
    const iCam = S.hijos[base].find((k) => S.N[k].n === 'Camera');
    const mlC = S.N[iCam]?.guiones?.find((g) => g.n === 'MouseLook');
    this.fisica.configurar({ radio: cc.radio, alto: cc.alto, centro: cc.centro, paso: cc.paso });
    const mov = motor?.movement || { maxForwardSpeed: 6, maxSidewaysSpeed: 6, maxBackwardsSpeed: 6, maxGroundAcceleration: 20, maxAirAcceleration: 20, gravity: 15, maxFallSpeed: 20 };
    const salto = motor?.jumping || { enabled: true, baseHeight: 1, extraHeight: 1 };
    const o = S.O[base];
    // Instantiate pone la raíz del prefab en el contenedor: el jugador se mueve con el contenedor
    const cont = o.parent;
    cont.position.add(o.position); o.position.set(0, 0, 0);
    this.iJug = base;
    this.jug = {
      o: cont, raiz: o, vel: new THREE.Vector3(), est: { vy: 0, suelo: false }, mov, salto, cc,
      velAdelante: mov.maxForwardSpeed, sensX: ml?.sensitivityX ?? 15, minY: mlC?.minimumY ?? -60, maxY: mlC?.maximumY ?? 60,
      yaw: new THREE.Euler().setFromQuaternion(cont.quaternion, 'YXZ').y, pitch: 0, iCam, camNodo: S.O[iCam], escY: 1, saltando: false,
    };
    cont.rotation.set(0, this.jug.yaw, 0, 'YXZ');
    // el cuerpo propio no se ve desde adentro (la cámara está en la cabeza)
    for (let k = base; k < S.N.length; k++) if (S.N[k].tag === 'Player' && S.N[k].piel) for (const m of S.mallasNodo[k]) m.visible = false;
    return this.jug;
  }
  /* ChangeTextures: el color de cada parte del muñeco (el original bajaba texturas de tinypic, que ya no existe) */
  colores(base, elegido) {
    const PARTES = [['default'], ['headmesh'], ['Cylinder002'], ['rightarmmesh', 'leftarmmesh'], ['rightlegmesh', 'leftlegmesh']];
    const COL = [[0.85, 0.18, 0.2], [0.55, 0.3, 0.8], [0.3, 0.7, 0.28], [0.95, 0.85, 0.25], [1, 1, 1]];
    const S = this.S;
    PARTES.forEach((nombres, k) => {
      if (elegido[k] == null) return;
      for (let i = base; i < S.N.length; i++) if (nombres.includes(S.N[i].n) && this.dentroDe(i, base)) for (const m of S.mallasNodo[i]) {
        m.material = [].concat(m.material).map((x) => { const c = x.userData.propio ? x : x.clone(); c.userData = { ...x.userData, propio: true }; c.color.setRGB(...COL[elegido[k]]); return c; });
        if (m.material.length === 1) m.material = m.material[0];
      }
    });
  }
  /* ¿el nodo es de acá? (no es parte del muñeco de otro jugador) */
  esMio(i) { for (const b of this.remotos) if (this.dentroDe(i, b)) return false; return true; }
  dentroDe(i, base) { let k = i; while (k >= 0) { if (k === base) return true; k = this.S.N[k].p; } return false; }
  jugadorPos() { return this.jug ? this.jug.o.getWorldPosition(new THREE.Vector3()) : null; }
  alturaTerreno(x, z) { return this.S?.terreno?.alturaEn(x, z) ?? -Infinity; }

  flotante(o, attr, clase, v) {
    const i = o.userData.i;
    if (attr === 'm_Enabled' && clase === 23) { for (const m of this.S.mallasNodo[i] || []) { m.userData.apagado = v < 0.5; m.visible = v >= 0.5 && this.S.activo[i]; } }
  }

  /* OnMouseDown: el objeto con collider más cercano bajo el puntero, en la cámara que se ve */
  clic(nx, ny) {
    if (!this.S || this.cargando) return false;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), this.camara);
    let mejor = null;
    const conClic = new Set(this.instancias.filter((x) => x.onMouseDown && this.vivo(x.i)).map((x) => x.i));
    for (const i of conClic) {
      const n = this.S.N[i];
      for (const c of n.col || []) {
        let g = null;
        if (c.tipo === 'mesh') g = this.R.geometria(c.malla);
        else if (c.tipo === 'box') { g = new THREE.BoxGeometry(...c.tam); g.translate(...c.c_); }
        if (!g) continue;
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        m.matrixWorld.copy(this.S.O[i].matrixWorld);
        const h = ray.intersectObject(m, false)[0];
        if (h && (!mejor || h.distance < mejor.d)) mejor = { i, d: h.distance };
      }
    }
    if (!mejor) return false;
    for (const inst of this.instancias.filter((x) => x.i === mejor.i && x.onMouseDown)) try { inst.onMouseDown(); } catch (e) { console.error(inst.nombre, e); }
    return true;
  }

  /* ---------------- cada cuadro */
  update(dt, inp, ajustes) {
    if (this.pendiente != null && !this.cargando) { const n = this.pendiente; this.pendiente = null; this._cargar(n).catch((e) => console.error(e)); return; }
    const S = this.S;
    if (!S || this.cargando) return;
    this.t += dt; this.dt = dt;
    this.leerTeclas(inp.teclas);
    if (this.timers.length) {
      const listos = this.timers.filter((x) => x.t <= this.t);
      if (listos.length) { this.timers = this.timers.filter((x) => x.t > this.t); for (const x of listos) try { x.res(); } catch (e) { console.error(e); } }
    }
    const J = this.jug, T = this.tmp;
    if (J && this.vivo(this.iJug)) this.moverJugador(J, dt, inp, ajustes);
    this.red?.update(dt);
    for (const inst of [...this.instancias]) if (inst.update && !inst.muerta && inst.on && this.vivo(inst.i)) try { inst.update(dt); } catch (e) { console.error(inst.nombre, e); inst.update = null; }
    if (this.pendiente != null) return;
    for (const [i, a] of S.animadores) if (this.vivo(i)) a.update(dt);
    S.raiz.updateMatrixWorld();
    this.disparadores();
    this.particulas.update(dt);
    this.escena.fog = this.sinNiebla ? null : this.niebla;
    // la cámara de three = la cámara de Unity prendida
    const ic = this.camaraActiva();
    if (ic >= 0) {
      S.O[ic].matrixWorld.decompose(this.camara.position, this.camara.quaternion, T.w);
      const cd = S.N[ic].cam;
      // lo que está detrás de la niebla no se dibuja (exp²: a 2,6/densidad ya no se ve nada)
      const f = this.escena.fog, lejos = Math.min(cd.lejos, this.lejos || 1000);
      this.recortar(f?.isFogExp2 ? 2.6 / f.density : f?.isFog ? f.far : lejos);
      if (this.camara.fov !== cd.fov || this.camara.near !== cd.cerca || this.camara.far !== lejos) { this.camara.fov = cd.fov; this.camara.near = Math.max(0.05, cd.cerca); this.camara.far = lejos; this.camara.updateProjectionMatrix(); }
      this.escena.background = cd.limpiar === 1 && this.cielo ? this.cielo.tex : new THREE.Color(...cd.fondo.slice(0, 3));
      this.iCam = ic;
    }
    if (this.pasto) { this.pasto.actualizar(this.camara.position); this.pasto.tick(this.t); }
    this.luces();
    this.sonido.actualizar(this.camara);
    this.ui.gui?.(this.gui.filter((g) => this.vivo(g.i)));
  }

  moverJugador(J, dt, inp, ajustes) {
    const T = this.tmp;
    // MouseLook: el cuerpo gira en y; la cámara (hija) en x, entre −60 y 60
    if (!this.cursorLibre) {
      const k = 0.0035 * (ajustes.sens || 1) * (J.sensX / 15) * 7.5;
      J.yaw -= inp.mx * k;
      J.pitch -= inp.my * k * (ajustes.invertir ? -1 : 1);
      J.pitch = Math.max(THREE.MathUtils.degToRad(J.minY), Math.min(THREE.MathUtils.degToRad(J.maxY), J.pitch));
    }
    J.o.rotation.set(0, J.yaw, 0, 'YXZ');
    if (J.camNodo) J.camNodo.rotation.set(J.pitch, 0, 0);
    // "crouch and run": la escala en y baja a 0,5 agachado (y la cámara con ella)
    const cr = J.agachar ?? 1;
    J.escY += (cr - J.escY) * Math.min(1, 5 * dt);
    J.raiz.scale.y = J.escY;
    this.fisica.configurar({ alto: J.cc.alto * J.escY, centro: [J.cc.centro[0], J.cc.centro[1] * J.escY, J.cc.centro[2]] });
    // CharacterMotor: la velocidad pedida (elipse adelante/costado/atrás), aceleración y gravedad
    const quiero = T.v.set(0, 0, 0);
    const l = Math.hypot(inp.x, inp.y);
    if (l > 0.01) {
      const ix = inp.x / Math.max(1, l), iy = inp.y / Math.max(1, l);
      const vAd = iy >= 0 ? J.velAdelante : J.mov.maxBackwardsSpeed, vCo = J.mov.maxSidewaysSpeed;
      const lx = ix * vCo, lz = iy * vAd;
      const c = Math.cos(J.yaw), s = Math.sin(J.yaw);
      quiero.set(lx * c - lz * s, 0, -lx * s - lz * c);
    }
    const dv = T.w.subVectors(quiero, J.vel); dv.y = 0;
    const max = (J.est.suelo ? J.mov.maxGroundAcceleration : J.mov.maxAirAcceleration) * dt;
    if (dv.length() > max) dv.setLength(max);
    J.vel.add(dv);
    if (J.est.suelo && this.tecla('Space') && J.salto.enabled && !J.saltando) { J.est.vy = Math.sqrt(2 * J.salto.baseHeight * J.mov.gravity); J.saltando = true; J.tSalto = this.t; }
    else if (J.est.suelo && J.est.vy <= 0) { J.est.vy = -1; J.saltando = false; }
    else {
      let g = J.mov.gravity;
      if (J.saltando && this.tecla('Space') && this.t - J.tSalto < J.salto.extraHeight / Math.max(0.1, Math.sqrt(2 * J.salto.baseHeight * J.mov.gravity))) g = 0;
      J.est.vy = Math.max(-J.mov.maxFallSpeed, J.est.vy - g * dt);
    }
    this.fisica.mover(J.o.position, T.v.set(J.vel.x * dt, J.est.vy * dt, J.vel.z * dt), J.est);
    J.moviendo = l > 0.1;
  }

  /* detrás de la niebla no se ve nada: árboles y lo fijo se esconden; el terreno lejano va con menos detalle */
  recortar(hasta) {
    const S = this.S, c = this.camara.position;
    for (const x of S.lejanos) x.m.visible = x.c.distanceTo(c) - x.r < hasta;
    for (const x of S.terreno?.trozos || []) { const d = x.c.distanceTo(c) - x.r; x.m.visible = x.cerca ? d < hasta : d >= hasta; }
  }

  /* los disparadores: OnTriggerEnter/Exit del que tiene el collider y del jugador que entra */
  disparadores() {
    const S = this.S, J = this.jug;
    const p = J && this.vivo(this.iJug) ? J.o.getWorldPosition(this.tmp.v).clone().add(new THREE.Vector3(0, J.cc.centro[1] * J.escY, 0)) : null;
    const radio = J ? J.cc.radio : 0, mitad = J ? Math.max(0, J.cc.alto * J.escY / 2 - J.cc.radio) : 0;
    for (const d of S.disparadores) {
      if (!this.vivo(d.i) || d.on === false) { if (this.dentro.get(d)) this.dentro.delete(d); continue; }
      let ahora = false;
      if (p) for (const dy of [-mitad, 0, mitad]) if (this.fisica.adentro(d, this.tmp.w.set(p.x, p.y + dy, p.z), radio)) { ahora = true; break; }
      const antes = !!this.dentro.get(d);
      if (ahora === antes) continue;
      this.dentro.set(d, ahora);
      const evento = ahora ? 'onTriggerEnter' : 'onTriggerExit';
      for (const inst of this.instancias.filter((x) => x.i === d.i && x[evento] && x.on)) try { inst[evento](this.iJug)?.catch?.(this.cancelada); } catch (e) { console.error(inst.nombre, e); }
      if (ahora) for (const inst of this.instancias.filter((x) => x.i === this.iJug && x.onTriggerEnter && x.on)) try { inst.onTriggerEnter(d.i); } catch (e) { console.error(inst.nombre, e); }
      if (this.pendiente != null) return;
    }
  }

  /* las luces prendidas más cercanas pasan al grupo fijo de luces de three; la linterna va aparte */
  luces() {
    const S = this.S, cam = this.camara.position, T = this.tmp;
    const cand = [];
    let dir = null, lint = null;
    for (const l of S.luces) {
      if (!l.on || !this.vivo(l.i)) continue;
      if (l.def.tipo === 1) { if (!dir) dir = l; continue; }
      if (l.i === this.iLinterna) { lint = l; continue; }
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
    const L = this.linterna;
    if (lint) {
      const o = S.O[lint.i]; o.getWorldPosition(L.position); o.getWorldQuaternion(T.q);
      L.target.position.copy(L.position).add(T.v.set(0, 0, -1).applyQuaternion(T.q)); L.target.updateMatrixWorld();
      L.color.setRGB(...lint.def.color.slice(0, 3)); L.intensity = lint.def.int * 2; L.distance = lint.def.rango;
      L.angle = THREE.MathUtils.degToRad(Math.min(170, lint.def.angulo) / 2);
    } else L.intensity = 0;
    if (dir) {
      const o = S.O[dir.i]; o.getWorldQuaternion(T.q);
      this.direccional.intensity = dir.def.int * 2; this.direccional.color.setRGB(...dir.def.color.slice(0, 3));
      this.direccional.position.copy(cam).add(T.v.set(0, 0, 1).applyQuaternion(T.q).multiplyScalar(50));
      this.direccional.target.position.copy(cam);
    } else this.direccional.intensity = 0;
  }
}
