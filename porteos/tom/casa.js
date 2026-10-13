// La casa de Tom: los cuatro cuartos (casa/<cuarto>.glb) con sus muebles en los SLOT, la cámara del
// juego (CAM_Background) y el lugar de Tom (CAM_Tom mira lo mismo desde 500 unidades al costado:
// el cuarto y Tom se dibujaban con dos cámaras; acá Tom va adentro del cuarto, corrido lo mismo).
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

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

// Dónde va Tom en cada cuarto (GetTomsPositionInScene de cada estado de animación del juego), según su
// tamaño 0..8 (bebé 0-2, adolescente 3-5, adulto 6-8). En el living el cuarto y Tom ya calzan: el resto
// se corre lo que difiere del living (x de Unity espejado).
const X_LIVING = [0, 0.593, 1.285, -1.314, 0, 1.967, -5.476, -2.7, 0];
export const TAMANO_DE = { s: 1, m: 4, l: 7 };
export function posicionTom(cuarto, tamano) {
  const y0 = -15.747, x0 = X_LIVING[tamano] || 0;
  let x = x0, y = y0;
  if (cuarto === 'kitchen') x = tamano < 3 ? 30 : tamano < 6 ? 21 : 6;
  else if (cuarto === 'bedroom') x = [39, 39, 39, 24, 24, 24, 5.2, 1.96, 0][tamano];
  else if (cuarto === 'bathroom') y = [-40, -40, -40, -34, -34, -34, -27.76, -27.76, -27.76][tamano];
  return new THREE.Vector3(-(x - x0), y - y0, 0);
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
    this.juntarEspacios();
    return this;
  }

  // El juego dibuja cada cuarto con varias cámaras corridas 500 unidades entre sí (fondo, Tom, primer
  // plano: la mesa de la cocina, la colcha; las puertas del baño están del lado de Tom). Acá todo va
  // al espacio del fondo: cada malla (y cada SLOT, que después recibe su mueble) se corre lo mismo
  // que la cámara que la ve.
  juntarEspacios() {
    const bg = this.camaras.CAM_Background;
    if (!bg) return;
    const pos = (o) => mundo(o).p;
    const pb = pos(bg);
    const cams = Object.values(this.camaras).filter((c) => !c.userData.camara.orto).map((c) => ({ c, p: pos(c) }));
    const region = (x) => {
      let mejor = null;
      for (const k of cams) if (!mejor || Math.abs(x - k.p.x) < Math.abs(x - mejor.p.x)) mejor = k;
      return mejor && Math.abs(x - mejor.p.x) < 250 ? mejor : null;
    };
    const mover = new Map();
    const caja = new THREE.Box3(), centro = new THREE.Vector3();
    this.raiz.updateMatrixWorld(true);
    this.raiz.traverse((o) => {
      let x;
      if (o.isMesh) { caja.setFromObject(o); caja.getCenter(centro); x = centro.x; }
      else if (/^SLOT_/.test(o.name) && !/anchor$/.test(o.name)) x = pos(o).x;
      else return;
      const r = region(x);
      if (r && r.c !== bg) mover.set(o, pb.clone().sub(r.p));
    });
    const inv = new THREE.Matrix4();
    for (const [o, d] of mover) {
      let a = o.parent, ya = false;
      while (a) { if (mover.has(a)) { ya = true; break; } a = a.parent; }
      if (ya) continue;
      const w = pos(o).add(d);
      inv.copy(o.parent.matrixWorld).invert();
      o.position.copy(w.applyMatrix4(inv));
      o.updateMatrixWorld(true);
    }
  }

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
        if (!o.userData.matPropio) { o.material = o.material.clone(); o.userData.matPropio = true; }
        o.material.uniforms._MainTex.value = this.u.textura(info.tex);
      });
      return;
    }
    if (!info.glb) return;
    const anterior = this.puestos[nombreSlot];
    if (anterior) anterior.parent.remove(anterior);
    const g = await gltf.loadAsync(this.base + info.glb);
    const obj = g.scene;
    this.u.prepararEscena(obj);
    // el prefab trae su lugar en el cuarto: va colgado del SLOT (el _anchor es para la interfaz
    // de editar el cuarto: dónde poner el botón; el _lookat_anchor, hacia dónde mira la cámara)
    slot.add(obj);
    this.puestos[nombreSlot] = obj;
    if (info.tipo === 'PrefabTexture') {
      // la cama: el prefab trae el material de la colcha para las mallas fijas del slot
      let mat = null;
      obj.traverse((o) => { if (!mat && o.isMesh && o.material && o.material.uniforms) mat = o.material; });
      if (mat) slot.traverse((o) => { if (o.isMesh && o !== obj && !obj.getObjectById(o.id)) o.material = mat; });
    }
  }
}
