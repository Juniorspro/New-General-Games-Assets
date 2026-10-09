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
    return this;
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
