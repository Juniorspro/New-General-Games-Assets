// El juego armado: la casa (los cuatro cuartos, uno a la vez), Tom con su controlador, la lógica de
// los medidores, el sonido, el micrófono y la interfaz. La página sólo crea un Juego.
//
//   const j = await new Juego(lienzo, contenedorUI, { datos: 'datos/', tam: 'l' }).cargar();
//   j.irA('kitchen');

import * as THREE from './vendor/three.module.min.js';
import { Unity } from './unity3.js';
import { Cuarto, INICIAL, CUARTO_DE, posicionTom, TAMANO_DE } from './casa.js';
import { Animaciones, Reproductor, AnimacionUnity } from './anim.js';
import { ControladorTom, ToquesTom } from './vivo.js';
import { LogicaJuego } from './logica.js';
import { Escucha } from './escucha.js';
import { cargarTom, vestir, Retarget, Zonas } from './tom.js';
import { Sonido } from './sonido.js';
import { UI, cargarFuentes } from './ui.js';
import { Animadores } from './animui.js';
import { Hud, registrarMateriales } from './hud.js';
import { InterfazPrincipal, Monedas } from './interfaz.js';

const BOTON_DE = { living: 'btn_livingroom', kitchen: 'btn_kitchen', bathroom: 'btn_toilet', bedroom: 'btn_bedroom' };

export class Juego {
  // op: datos (carpeta), tam ('s'|'m'|'l'), cuarto, mic (bool), ui (bool), clip (un clip suelto),
  // t (tiempo fijo para el clip), medidores ([diversión, comida, inodoro, sueño]), fur, cloth
  constructor(lienzo, contenedorUI, op = {}) {
    this.lienzo = lienzo;
    this.contenedorUI = contenedorUI;
    this.op = op;
    this.D = op.datos || 'datos/';
    this.tam = op.tam || 's';
    this.cuartos = new Map();          // living | kitchen | bathroom | bedroom → Cuarto
    this.actual = null;
    this.t = 0;
  }

  async cargar() {
    const D = this.D, op = this.op;
    const ren = this.ren = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true });
    ren.outputColorSpace = THREE.LinearSRGBColorSpace;
    ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.escena = new THREE.Scene();
    const [shaders, indice, bin, pieles, retarget, ropero, eventos] = await Promise.all([
      fetch(D + 'casa/shaders.json').then((r) => r.json()),
      fetch(D + 'tom/anim.json').then((r) => r.json()),
      fetch(D + 'tom/anim.bin').then((r) => r.arrayBuffer()),
      fetch(D + 'tom/pieles.json').then((r) => r.json()),
      fetch(D + 'tom/retarget.json').then((r) => r.json()),
      fetch('ropero.json').then((r) => r.json()),
      fetch(D + 'sonido/eventos.json').then((r) => r.json()),
    ]);
    this.u = new Unity(THREE, shaders, D + 'casa/tex/');
    // Tom
    const tam = this.tam;
    const tom = this.tom = await cargarTom(D + 'tom/', tam);
    vestir(tom, D + 'tom/pieles/', pieles, ropero, { fur: op.fur || 'tom-fur-default', cloth: op.cloth });
    tom.raiz.traverse((o) => { if (o.isMesh) o.renderOrder = 2500; });   // después del cuarto, como CAM_Tom
    this.escena.add(tom.raiz);
    this.anims = new Animaciones(indice, bin);
    this.rt = new Retarget(tom.raiz, retarget[tam]);
    this.zonas = new Zonas(tom.raiz, retarget[tam].zonas);
    this.sonido = new Sonido(D + 'sonido/', eventos);
    // la lógica (living = diversión, cocina = comida, baño = inodoro, cuarto = sueño)
    const n = this.necesidades = new LogicaJuego();
    if (op.medidores) {
      ['funMeter', 'foodMeter', 'toiletMeter', 'sleepyMeter'].forEach((c, i) =>
        n.setMeter(c, ['FunMeter', 'FoodMeter', 'ToiletMeter', 'SleepyMeter'][i], op.medidores[i]));
    }
    // el primer cuarto
    await this.irA(op.cuarto || 'living', true);
    if (op.clip) {
      this.rep = new Reproductor(this.anims, tom.raiz);
      this.rep.despues = (c, tn, dt) => this.rt.aplicar(c, tn, dt);
      this.rep.play(op.clip, { bucle: true });
      if (op.t !== undefined) this.rep.update(op.t);
    } else {
      this.anim = new AnimacionUnity(this.anims, tom.raiz);
      this.ctl = new ControladorTom({ anim: this.anim, raiz: tom.raiz, tam, sonido: this.sonido, necesidades: n,
        zonas: this.zonas, THREE, cuarto: this.actual });
      const rayc = new THREE.Raycaster(), v2 = new THREE.Vector2();
      const rayo = (x, y) => {
        const r = this.lienzo.getBoundingClientRect();
        v2.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        rayc.setFromCamera(v2, this.cam);
        return rayc.ray;
      };
      this.toques = new ToquesTom(this.ctl, this.zonas, rayo, () => innerWidth, () => innerHeight);
      if (op.mic !== false) {
        this.escucha = new Escucha(this.sonido, { cansado: () => n.mustSleep });
        this.ctl.conectarEscucha(this.escucha);
      }
    }
    this.entrada();
    addEventListener('resize', () => this.medir());
    this.medir();
    this.reloj = new THREE.Clock();
    const cuadro = () => { this.cuadro(); requestAnimationFrame(cuadro); };
    cuadro();
    if (op.ui !== false) await this.armarInterfaz();
    return this;
  }

  // ---- los cuartos
  async cuarto(nombre) {
    let c = this.cuartos.get(nombre);
    if (!c) {
      c = await new Cuarto(this.u, this.D + 'casa/').cargar(CUARTO_DE[nombre]);
      for (const item of INICIAL[nombre]) await c.poner(item);
      c.cam = c.camara(innerWidth / innerHeight);
      this.cuartos.set(nombre, c);
    }
    return c;
  }

  // Cambiar de cuarto (MttGameStateManager: Livingroom/Kitchen/Toilet/Bedroom)
  async irA(nombre, primero = false) {
    if (this.actual === nombre && !primero) return;
    const c = await this.cuarto(nombre);
    if (this.cuartoActual) this.escena.remove(this.cuartoActual.raiz);
    this.escena.add(c.raiz);
    this.cuartoActual = c;
    this.actual = nombre;
    this.cam = c.cam;
    this.medir();
    this.tom.raiz.position.copy(c.corrimientoTom).add(posicionTom(nombre, TAMANO_DE[this.tam]));
    if (this.ctl) {
      this.ctl.cuarto = nombre;
      this.ctl.currentAnimation = null;
      this.ctl.estadoCuarto.onEnter();
    }
    if (this.hud) this.hud.cuarto(nombre);
  }

  medir() {
    const w = innerWidth, h = innerHeight;
    this.ren.setSize(w, h, false);
    if (this.cam) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    if (this.ui) this.ui.layout();
  }

  entrada() {
    const l = this.lienzo;
    l.addEventListener('pointerdown', (e) => {
      this.sonido.desbloquear();
      if (this.escucha && !this.escucha.disponible) this.escucha.pedirMicrofono();
      if (this.toques) { l.setPointerCapture(e.pointerId); this.toques.bajar(e.pointerId, e.clientX, e.clientY); }
      const d = this.toques && this.toques.dedos.get(e.pointerId);
      window.ultimoToque = d ? d.nombre : null;
    });
    l.addEventListener('pointermove', (e) => { if (this.toques) this.toques.mover(e.pointerId, e.clientX, e.clientY); });
    l.addEventListener('pointerup', (e) => { if (this.toques) this.toques.soltar(e.pointerId); });
    l.addEventListener('pointercancel', (e) => { if (this.toques) this.toques.dedos.delete(e.pointerId); });
    // la app se va o vuelve (MainGameLogic.OnAppPause / OnAppResume)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.necesidades.onAppPause(); else this.necesidades.onAppResume();
    });
  }

  cuadro() {
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    this.t += dt;
    if (this.ctl) {
      this.necesidades.update();         // MainGameLogic.Update (los medidores con el tiempo)
      this.ctl.update(dt);               // Update del juego (decide qué animación suena)
      this.anim.update(dt);              // el componente Animation: avanza, mezcla y mueve los huesos
      const p = this.ctl.current && this.ctl.current.principal;
      this.rt.aplicar(p ? p.name : null, p && p.length ? p.time / p.length : 0, dt, (n, b) => this.anim.escribio(n, b));
      this.ctl.lateUpdate();             // LateUpdate (el respingo de la cabeza)
    } else if (this.rep && this.op.t === undefined) this.rep.update(dt);
    if (this.hud) this.hud.cuadro(dt);
    if (this.interfaz) this.interfaz.cuadro(dt);
    if (this.ui) this.ui.cuadro(dt);
    this.u.actualizar(this.t, dt, this.lienzo.width, this.lienzo.height, this.cam);
    this.ren.render(this.escena, this.cam);
  }

  // ---- la interfaz principal (can_main)
  async armarInterfaz() {
    const D = this.D;
    const [sprites, fuentes, textos, principal, controladores, clips, monedas] = await Promise.all([
      fetch(D + 'ui/sprites.json').then((r) => r.json()),
      fetch(D + 'ui/fuentes.json').then((r) => r.json()),
      fetch(D + 'datos/textos.json').then((r) => r.json()),
      fetch(D + 'ui/escenas/principal.json').then((r) => r.json()),
      fetch(D + 'ui/controladores.json').then((r) => r.json()),
      fetch(D + 'ui/clips.json').then((r) => r.json()),
      fetch(D + 'datos/monedas.json').then((r) => r.json()),
    ]);
    await cargarFuentes(D + 'ui/', fuentes);
    this.monedas = new Monedas(this.necesidades.prefs, monedas);
    const ui = this.ui = new UI(this.contenedorUI, D + 'ui/', sprites, textos, 'es');
    registrarMateriales(ui);
    ui.animadores = new Animadores(ui, controladores, clips);
    const p = this.pant = ui.armar(principal);
    const hud = this.hud = new Hud(ui, p);
    hud.cuarto(this.actual);
    const n = this.necesidades;
    const valores = () => [n.funMeter, n.foodMeter, n.toiletMeter, n.sleepyMeter];
    const poner = (animar) => ['living', 'kitchen', 'bathroom', 'bedroom'].forEach((k, i) =>
      hud.medidores[k] && hud.medidores[k].ponerProgreso(Math.min(100, valores()[i]), animar));
    poner(false);
    n.alCambiar.push(() => poner(true));
    this.interfaz = new InterfazPrincipal(ui, p, { logica: n, monedas: this.monedas });
    // los botones de los cuartos
    for (const [k, b] of Object.entries(BOTON_DE)) {
      const nodo = p.nodo(b);
      if (nodo) nodo.alClic = () => this.irA(k);
    }
    ui.layout();
  }
}
