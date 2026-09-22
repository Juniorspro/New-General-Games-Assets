// Las cinco cintas: el objetivo, y la razón para caminar hacia algún lado.
//
// SE ENCUENTRAN CON EL OÍDO Y CON LA IMAGEN, NO CON UNA FLECHA. Cerca de una
// cinta sin recoger la imagen empieza a fallar como una cinta con el tracking
// corrido, y la estática sube. Más fuerte = más cerca. No hay brújula ni mapa:
// el filtro VHS, que al principio es adorno, resulta ser el radar.
import * as THREE from "three";
import { CINTAS } from "./config.js";
import { vestirNiebla } from "./cielo.js";
import { aFlotante } from "./props.js";

export const TEXTOS = [
  {
    titulo: "CINTA 1 — 14 SEP 1996",
    texto: "Llegamos al sendero a las cinco. Marta dice que el lago está a media hora. Dejé el auto abierto, total acá no hay nadie.",
  },
  {
    titulo: "CINTA 2 — 15 SEP 1996",
    texto: "La cabaña estaba abierta. Adentro, la mesa puesta para dos y el mate todavía tibio. Esperamos una hora. No vino nadie.",
  },
  {
    titulo: "CINTA 3 — 16 SEP 1996",
    texto: "Prendimos el fuego para esperar que baje el sol. Las brasas no se apagan. Ya van tres días y no se apagan.",
  },
  {
    titulo: "CINTA 4 — 16 SEP 1996",
    texto: "Desde la piedra se ve todo el lago. El sol no se movió. Está exactamente donde estaba ayer, y anteayer.",
  },
  {
    titulo: "CINTA 5 — ?? SEP 1996",
    texto: "Si alguien encuentra esto: no esperes que se haga de noche. Acá no se hace de noche. Volvé por el sendero y no mires el reloj.",
  },
];

export class Cintas {
  constructor(glb, objetos) {
    this.grupo = new THREE.Group();
    this.grupo.name = "cintas";
    let malla = null;
    glb.scene.updateMatrixWorld(true);
    glb.scene.traverse((o) => { if (o.isMesh && !malla) malla = o; });
    const g = aFlotante(malla.geometry.clone()).applyMatrix4(malla.matrixWorld);
    g.computeBoundingBox();
    const t = new THREE.Vector3(); g.boundingBox.getSize(t);
    const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
    // la cinta del modelo viene parada en tres cuartos: se acuesta sobre su
    // cara más grande y se lleva a 19 cm, que es lo que mide un VHS
    g.translate(-c.x, -c.y, -c.z);
    const menor = t.x < t.y && t.x < t.z ? "x" : t.y < t.z ? "y" : "z";
    if (menor === "x") g.rotateZ(Math.PI / 2);
    if (menor === "z") g.rotateX(Math.PI / 2);
    g.computeBoundingBox(); g.boundingBox.getSize(t);
    const esc = 0.19 / Math.max(t.x, t.z);
    g.scale(esc, esc, esc);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    const mat = malla.material;
    mat.metalness = 0; mat.roughness = 0.55;
    vestirNiebla(mat);

    // el brillo: un destello chico que titila, visible de cerca. Es lo único
    // que la delata a la vista cuando ya estás encima
    const matBrillo = new THREE.SpriteMaterial({ color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: estrella() });

    this.lista = CINTAS.map((d, i) => {
      const y = objetos.superficie(d.x, d.z);
      const m = new THREE.Mesh(g, mat);
      m.position.set(d.x, y + 0.005, d.z);
      m.rotation.y = i * 1.7 + 0.4;
      m.castShadow = true; m.receiveShadow = true;
      const s = new THREE.Sprite(matBrillo.clone());
      s.position.set(d.x, y + 0.12, d.z);
      s.scale.setScalar(0.35);
      this.grupo.add(m, s);
      return { ...d, y, malla: m, brillo: s, tomada: false, i };
    });
    this.tomadas = 0;
    this.t = 0;
  }

  /** La más cercana sin recoger y a qué distancia. */
  cercana(p) {
    let mejor = null, d = 1e9;
    for (const c of this.lista) {
      if (c.tomada) continue;
      const dd = Math.hypot(c.x - p.x, c.z - p.z);
      if (dd < d) { d = dd; mejor = c; }
    }
    return { cinta: mejor, d };
  }

  /** Cuánto interfiere la cinta más cercana: 0 lejos, 1 encima. */
  interferencia(p) {
    const { d } = this.cercana(p);
    return Math.max(0, 1 - d / 28) ** 1.6;
  }

  paso(dt) {
    this.t += dt;
    for (const c of this.lista) {
      if (c.tomada) continue;
      const tit = 0.5 + 0.5 * Math.sin(this.t * 3.1 + c.i * 2) * Math.sin(this.t * 1.7 + c.i);
      c.brillo.material.opacity = 0.25 + tit * 0.75;
      c.brillo.material.rotation = this.t * 0.4;
    }
  }

  tomar(c) {
    c.tomada = true;
    c.malla.visible = false;
    c.brillo.visible = false;
    this.tomadas++;
    return TEXTOS[c.i];
  }
}

function estrella() {
  const L = 64, lz = document.createElement("canvas");
  lz.width = lz.height = L;
  const x = lz.getContext("2d");
  const g = x.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.15, "rgba(255,240,200,0.6)"); g.addColorStop(1, "rgba(255,220,160,0)");
  x.fillStyle = g; x.fillRect(0, 0, L, L);
  x.strokeStyle = "rgba(255,250,235,0.9)"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(L / 2, 4); x.lineTo(L / 2, L - 4); x.moveTo(4, L / 2); x.lineTo(L - 4, L / 2); x.stroke();
  const t = new THREE.CanvasTexture(lz);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
