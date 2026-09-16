// Los actores: el jugador y los bichos, con su modelo 3D.
//
// La logica de cada enemigo vive en entidades.js y NO sabe que existe el 3D —
// es la misma que corre el validador. Esto es solo la piel: toma el estado
// (x, y, direccion, si esta en caparazon) y lo convierte en un objeto de la
// escena. Separarlo asi es lo que permite que el juego ande sin canvas, que es
// como lo prueban las pruebas.

import * as THREE from "../vendor/three.module.min.js";
import { cargarModelo, normalizar, U } from "./escena.js";
import { ruta } from "./assets.js";
import { T } from "./mundo.js";

const RUTA = (n) => ruta(`assets/glb/m3d_${n}-g1.glb`);

// Alto en tiles de cada uno. Se elige por como se LEE en pantalla, no por el
// tamano de la caja de colision: un erizo de exactamente un tile se ve chico
// al lado del jugador aunque mida lo mismo.
export const ALTOS = {
  heroe: 1.15, bolo: 0.95, caracol: 1.05, aleta: 1.0, erizo: 0.95,
  fauces: 1.3, osario: 1.1, perno: 0.8, conducto: 1.0, moneda: 0.7,
  resorte: 0.8, yunque: 2.4, coloso: 2.8,
};

export async function precargar(nombres) {
  const r = {};
  await Promise.all(nombres.map(async (n) => {
    try { r[n] = await cargarModelo(RUTA(n)); }
    catch (e) { r[n] = null; }      // sin modelo se cae al respaldo geometrico
  }));
  return r;
}

// Respaldo si un modelo no carga: una caja del color del tema. Preferible mil
// veces a una pantalla sin nada — un bicho invisible que mata es lo peor que
// le puede pasar a un jugador.
function respaldo(alto, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(alto * 0.8, alto, alto * 0.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  m.position.y = alto / 2; m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return g;
}

export function crearActor(tipo, modelos, colorRespaldo = "#c8552f") {
  const alto = ALTOS[tipo] ?? 1;
  const g = modelos[tipo];
  const o = g ? normalizar(g, alto) : respaldo(alto, colorRespaldo);
  o.userData.tipo = tipo;
  o.userData.alto = alto;
  return o;
}

// --- billboard luminoso --------------------------------------------------
// La vela y la brasa son luz, no materia. Una malla con textura las apaga; un
// plano que siempre mira a la camara, con mezcla aditiva, las prende. Y de
// paso cuesta dos triangulos.
export function crearLuminaria(color, tam = 1.1) {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 128;
  const c = lienzo.getContext("2d");
  const grad = c.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(tam);
  const g = new THREE.Group();
  sp.position.y = tam / 2;
  g.add(sp);
  g.userData.alto = tam;
  return g;
}

// --- el jugador ----------------------------------------------------------
export class ActorJugador {
  constructor(modelos) {
    this.obj = crearActor("heroe", modelos, "#e08a3a");
    this.paso = 0;
    // El cuerpo se inclina y rebota por codigo y no por animacion: son tres
    // lineas, cero bytes, y reaccionan al estado real. Una animacion grabada
    // de "correr" siempre va a destiempo con la velocidad de verdad.
    this.cuerpo = this.obj.children[0];
  }
  actualizar(j, dt, t) {
    const o = this.obj;
    o.position.set(U(j.x), -U(j.y), 0);
    // Mira hacia donde corre.
    const objetivo = j.dir > 0 ? 0.35 : -0.35;
    o.rotation.y += (objetivo - o.rotation.y) * Math.min(1, dt * 12);
    const c = this.cuerpo;
    if (j.suelo && !j.frenado) {
      this.paso += dt * 15;
      c.position.y = Math.abs(Math.sin(this.paso)) * 0.09;      // trote
      c.rotation.z = Math.sin(this.paso * 2) * 0.05;
      c.rotation.x = 0.12;                                       // inclinado al correr
    } else if (j.frenado) {
      c.position.y = 0; c.rotation.z = 0; c.rotation.x = 0;
    } else {
      // En el aire: se estira al subir y se achata al caer. Es el squash de
      // toda la vida y sin el, un salto con los numeros bien igual se ve duro.
      const est = Math.max(0.82, Math.min(1.18, 1 - j.vy * 0.03));
      c.scale.set(1 / est, est, 1 / est);
      c.rotation.x = -j.vy * 0.03;
      c.rotation.z = j.giro > 0 ? (t * 14) % (Math.PI * 2) : 0;
      c.position.y = 0;
      return;
    }
    c.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 10));
  }
}

// --- un bicho ------------------------------------------------------------
export class ActorBicho {
  constructor(e, modelos, tm) {
    const lum = { vela: "#bfe8ff", brasa: "#ffb03a", rueda: "#ff8a2a" }[e.tipo];
    if (lum) this.obj = crearLuminaria(lum, e.tipo === "rueda" ? 0.8 : 1.15);
    else if (e.tipo === "torrepua") {
      // Pila de segmentos: se arma con el mismo modelo del erizo repetido.
      this.obj = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = crearActor("erizo", modelos, tm.tierra);
        s.position.y = i * 0.9; s.scale.setScalar(0.85);
        this.obj.add(s);
      }
    } else if (e.tipo === "mortero") {
      this.obj = crearActor("conducto", modelos, tm.costado);
    } else {
      const map = { coraza: "bolo", vigia: "aleta" };
      this.obj = crearActor(map[e.tipo] ?? e.tipo, modelos, tm.tierra);
    }
    this.t = Math.random() * 10;
    this.tipo = e.tipo;
  }
  actualizar(e, dt) {
    this.t += dt;
    const o = this.obj;
    o.visible = e.vivo && (e.tipo !== "fauces" || (e.salida ?? 0) > 0.05)
                && (e.tipo !== "brasa" || e.activa);
    if (!o.visible) return;
    o.position.set(U(e.x), -U(e.y), 0);
    o.rotation.y = e.dir > 0 ? -0.5 : 0.5;
    if (this.tipo === "caracol" && e.caparazon) {
      o.rotation.z = e.empujado ? this.t * 12 * -Math.sign(e.dir || 1) : 0;
      o.scale.y = 0.6;
    } else if (this.tipo === "osario" && e.roto > 0) {
      o.scale.set(1, 0.25, 1);
    } else if (this.tipo === "torrepua") {
      for (let i = 0; i < o.children.length; i++)
        o.children[i].visible = i < (e.segmentos ?? 3);
    } else if (this.tipo === "vela") {
      o.children[0].material.opacity = e.tapado ? 0.35 : 1;
    } else {
      o.scale.set(1, 1, 1);
      // Un bicho totalmente quieto se lee como decorado. Un balanceo minimo
      // alcanza para que parezca vivo.
      o.position.y += Math.sin(this.t * 3) * 0.04;
    }
  }
}
