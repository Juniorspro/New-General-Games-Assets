// La casa de Tom: los cuatro cuartos (casa/<cuarto>.glb) con sus muebles en los SLOT, la cámara del
// juego (CAM_Background) y el lugar de Tom (CAM_Tom mira lo mismo desde 500 unidades al costado:
// el cuarto y Tom se dibujaban con dos cámaras; acá Tom va adentro del cuarto, corrido lo mismo).
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { colisionadores, tocarColisionador } from './colisionadores.js';

const gltf = new GLTFLoader();

// categoría del catálogo → SLOT del cuarto (y si el ítem es una textura, a qué malla va)
export const SLOTS = {
  living: { chair: 'SLOT_Chair', gadget: 'SLOT_Gadget', picture: 'SLOT_Livingroom_Picture',
    carpet: 'SLOT_Livingroom_Rug', wall: 'SLOT_Livingroom_Wallpaper', floor: 'SLOT_Livingroom_Floor' },
  kitchen: { fridge: 'SLOT_Fridge', table: 'SLOT_Table', window: 'SLOT_Window', wall: 'SLOT_Kitchen_Wallpaper' },
  bathroom: { toilet: 'SLOT_WC', door: 'SLOT_Doors', carpet: 'SLOT_Toilet_Rug', tiles: 'SLOT_Tiles',
    wall: 'SLOT_Toilet_Wallpaper' },
  bedroom: { bed: 'SLOT_Bedframe', bedding: 'SLOT_Bedspread', lamp: 'SLOT_Lamp', picture: 'SLOT_Bedroom_Picture',
    wall: 'SLOT_Bedroom_Wallpaper' },
};
export const CUARTO_DE = { living: 'living', kitchen: 'cocina', bathroom: 'bano', bedroom: 'dormitorio' };

// Lo que tiene la casa al empezar (los ítems de precio 0 del catálogo).
export const INICIAL = {
  living: ['living-chair-homey-red', 'living-gadget-homey-orange-tv', 'living-picture-homey-red-portrait',
    'living-carpet-homey-green', 'living-wall-homey-diamond', 'living-floor-homey-square'],
  kitchen: ['kitchen-fridge-homey-orange', 'kitchen-table-homey-orange', 'kitchen-window-homey-orange',
    'kitchen-wall-homey-diamond'],
  bathroom: ['bathroom-toilet-homey-green', 'bathroom-door-homey-green', 'bathroom-carpet-homey-violet',
    'bathroom-tiles-homey-green', 'bathroom-wall-homey-stripes'],
  bedroom: ['bedroom-bed-homey-orange', 'bedroom-bedding-homey-orange', 'bedroom-lamp-homey-spotty',
    'bedroom-picture-homey-violet', 'bedroom-wall-homey-diamond'],
};

// Dónde va Tom en cada cuarto: GetTomsPositionInScene de cada estado de animación (tom.localPosition =
// (0, alto, fondo), leído del ARM64: s1 = y de una tabla por tamaño, s2 = z), según su tamaño 0..8
// (bebé 0-2, adolescente 3-5, adulto 6-8). La x es 0, así que el espejado no la toca.
const Y_LIVING = [0, 0.5935, 1.2852, -1.3144, 0, 1.967, -5.4764, -2.7, 0];
export const TAMANO_DE = { s: 1, m: 4, l: 7 };
export function posicionTom(cuarto, tamano) {
  let y = Y_LIVING[tamano] || 0, z = -15.747;
  if (cuarto === 'kitchen') y = [30, 30, 30, 21, 21, 21, 6, 6, 6][tamano];
  else if (cuarto === 'bedroom') y = [39, 39, 39, 24, 24, 24, 5.2, 1.96, 0][tamano];
  else if (cuarto === 'bathroom') z = [-40, -40, -40, -34, -34, -34, -27.76, -27.76, -27.76][tamano];
  return new THREE.Vector3(0, y, z);
}

function mundo(o) {
  o.updateWorldMatrix(true, false);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  o.matrixWorld.decompose(p, q, s);
  return { p, q, s };
}

export class Cuarto {
  constructor(unity, base) {
    this.u = unity;
    this.base = base;           // .../casa/
    this.muebles = null;        // casa/muebles.json
    this.puestos = {};          // SLOT → objeto puesto
  }

  async cargar(nombre /* living | cocina | dormitorio | bano */) {
    if (!this.muebles) this.muebles = await (await fetch(this.base + 'muebles.json')).json();
    const g = await gltf.loadAsync(`${this.base}${nombre}.glb`);
    this.raiz = g.scene;
    this.u.prepararEscena(this.raiz);
    this.raiz.updateMatrixWorld(true);
    this.camaras = {};
    this.raiz.traverse((o) => { if (o.userData && o.userData.camara) this.camaras[o.name] = o; });
    this.corrido = new Map();         // nodo → cuánto se corrió (juntarEspacios)
    this.juntarEspacios();
    return this;
  }

  // El juego dibuja cada cuarto con varias cámaras corridas 500 unidades entre sí (fondo, Tom, primer
  // plano: la mesa de la cocina, la colcha, el frente de la cama; las puertas del baño están del lado
  // de Tom). Acá todo va al espacio del fondo: cada malla, SLOT, ancla, emisor de partículas u hoja se
  // corre lo que la cámara que la ve está corrida del fondo; lo de adentro, lo que le falte.
  juntarEspacios(sub = this.raiz) {
    const bg = this.camaras.CAM_Background;
    if (!bg) return;
    if (!this.regiones) {
      const pb = mundo(bg).p;
      this.regiones = Object.values(this.camaras).filter((c) => !c.userData.camara.orto)
        .map((c) => { const p = mundo(c).p; return { x: p.x, d: pb.clone().sub(p) }; });
    }
    const region = (x) => {
      let mejor = null;
      for (const k of this.regiones) if (!mejor || Math.abs(x - k.x) < Math.abs(x - mejor.x)) mejor = k;
      return mejor && Math.abs(x - mejor.x) < 250 ? mejor.d : null;
    };
    sub.updateMatrixWorld(true);
    // 1) lo que quiere cada uno, con las posiciones de antes de mover nada
    const quiere = new Map();
    const caja = new THREE.Box3(), centro = new THREE.Vector3();
    sub.traverse((o) => {
      if (o.userData && o.userData.camara) return;
      let x;
      if (o.isMesh) {
        // la caja de su malla sola (no la de los hijos: el frente de la cama cuelga de la cabecera)
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        caja.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (caja.isEmpty()) return;
        caja.getCenter(centro); x = centro.x;
      } else if (/^SLOT_|anchor$/.test(o.name) || o.userData.particulas || (o !== sub && !o.children.length)) x = mundo(o).p.x;
      else return;
      const d = region(x);
      if (d) quiere.set(o, d);
    });
    // 2) de arriba abajo: cada uno se corre lo que quiere menos lo que ya se corrió el de arriba
    const cero = new THREE.Vector3(), inv = new THREE.Matrix4();
    const yaCorrido = (o) => { for (let a = o; a; a = a.parent) if (this.corrido.has(a)) return this.corrido.get(a); return cero; };
    const visitar = (o, deArriba) => {
      const q = quiere.get(o) || deArriba;
      const delta = q.clone().sub(deArriba);
      if (delta.lengthSq() > 1e-6) {
        const w = mundo(o).p.add(delta);
        inv.copy(o.parent.matrixWorld).invert();
        o.position.copy(w.applyMatrix4(inv));
        o.updateMatrixWorld(true);
      }
      this.corrido.set(o, q);
      for (const h of o.children) visitar(h, q);
    };
    visitar(sub, yaCorrido(sub.parent));
  }

  // Lo que se toca en el cuarto: los colisionadores de lo que está debajo de cada SLOT (y de los
  // nombres que se pidan), como RoomInteractivityTouchController.assignCollidersToSlots. Cada lista la
  // miraba una cámara: la del fondo sólo alcanza lo que está en su espacio; la de adelante, lo que se
  // trajo de los otros (frente = true).
  colisionadoresDe(nombres, frente = false) {
    const out = [];
    for (const n of nombres) {
      const s = this.slot(n);
      if (!s) continue;
      for (const x of colisionadores(THREE, s)) {
        const d = this.corrido.get(x.nodo), delFondo = !d || d.lengthSq() < 1e-6;
        if (delFondo !== frente) out.push({ ...x, slot: n });
      }
    }
    return out;
  }
  tocar(rayo, lista) { return tocarColisionador(THREE, rayo, lista); }

  // La cámara del juego para este cuarto (la del fondo, que ve el cuarto; Tom se corre hasta ahí).
  camara(aspecto) {
    const cb = this.camaras.CAM_Background, ct = this.camaras.CAM_Tom;
    const c = cb.userData.camara;
    const cam = new THREE.PerspectiveCamera(c.fov, aspecto, c.cerca, c.lejos);
    const m = mundo(cb);
    cam.position.copy(m.p);
    // Unity mira hacia +z local; three hacia −z: media vuelta en y
    cam.quaternion.copy(m.q).multiply(new THREE.Quaternion(0, 1, 0, 0));
    this.corrimientoTom = ct ? m.p.clone().sub(mundo(ct).p) : new THREE.Vector3();
    this.datosCamara = c;
    return cam;
  }

  slot(nombre) {
    let s = null;
    this.raiz.traverse((o) => { if (!s && o.name === nombre) s = o; });
    return s;
  }

  // Pone un ítem del catálogo en su SLOT: un prefab en el ancla, o una textura en la malla del slot.
  async poner(item) {
    const info = this.muebles[item];
    if (!info) { console.warn('no hay mueble', item); return; }
    const [cat, tipo] = item.split('-');
    const nombreSlot = SLOTS[cat] && SLOTS[cat][tipo];
    const slot = nombreSlot && this.slot(nombreSlot);
    if (!slot) { console.warn('no hay slot', nombreSlot, item); return; }
    if (info.tex) {
      // la textura del ítem es el _MainTex de las mallas del slot (pared, piso, azulejos, mantel)
      slot.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.uniforms || !o.material.uniforms._MainTex) return;
        if (!o.userData.matPropio) { o.material = this.u.clonar(o.material); o.userData.matPropio = true; }
        o.material.uniforms._MainTex.value = this.u.textura(info.tex);
      });
      return;
    }
    if (!info.glb) return;
    const g = await gltf.loadAsync(this.base + info.glb);
    const obj = g.scene.children.length === 1 ? g.scene.children[0] : g.scene;
    this.u.prepararEscena(obj);
    if (info.tipo === 'PrefabTexture') {
      // PrefabTexturedSlotItem: el prefab sólo presta sus materiales y se tira. La ropa de cama:
      // el suyo a la colcha (Bedspread) y el de su almohada a la Pillow del cuarto; si no, el del
      // prefab a la malla del slot.
      const mat = (o) => o && o.isMesh ? o.material : null;
      if (nombreSlot === 'SLOT_Bedspread') {
        const colcha = slot.getObjectByName('Bedspread'), almohada = slot.getObjectByName('Pillow');
        if (colcha && mat(obj)) colcha.material = mat(obj);
        const a = obj.getObjectByName('Pillow');
        if (almohada && mat(a)) almohada.material = this.conSombra(almohada, mat(a));
      } else if (slot.isMesh && mat(obj)) slot.material = mat(obj);
      return;
    }
    // PrefabSlotItem: el prefab va justo donde está el SLOT (sin rotar ni escalar) y colgado de él
    // (el _anchor es para la interfaz de editar el cuarto; el _lookat_anchor, hacia dónde mira)
    const anterior = this.puestos[nombreSlot];
    if (anterior) anterior.parent.remove(anterior);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.set(1, 1, 1);
    slot.add(obj);
    this.juntarEspacios(obj);
    this.puestos[nombreSlot] = obj;
  }

  // PillowShadowController.setShadow: la almohada lleva la sombra de la cabeza de Tom (_ShadowTex)
  conSombra(almohada, mat) {
    const info = almohada.userData.almohada;
    if (!info || !mat || !mat.uniforms || !mat.uniforms._ShadowTex) return mat;
    const m = this.u.clonar(mat);
    m.uniforms._ShadowTex.value = this.u.textura(this.sombra === false ? info.sinSombra : info.conSombra);
    return m;
  }
  ponerSombraAlmohada(si) {
    this.sombra = si;
    this.raiz.traverse((o) => { if (o.userData.almohada && o.isMesh) o.material = this.conSombra(o, o.material); });
  }
}
