// Lo construido de antes: la choza de paja, el muelle y la boca de la mina.
// Alineado a los ejes del mundo a propósito: la madera usa textura en el plano
// del mundo, y así las vetas quedan siempre derechas sin armar UV a mano.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';

export function materiales(tex) {
  return {
    madera: matPixel('mundo', { mapa: tex.madera, tam: [32, 32], clave: 'madera' }),
    maderaOscura: matPixel('mundo', { mapa: tex.madera, tam: [32, 32], color: 0x8a7a70, clave: 'maderaOscura' }),
    paja: matPixel('mundo', { mapa: tex.paja, tam: [32, 32], lados: THREE.DoubleSide, clave: 'paja' }),
    poste: matPixel('mundo', { mapa: tex.corteza, tam: [16, 32], clave: 'poste' }),
    tela: matPixel('liso', { color: 0xeef3f7, clave: 'tela' }),
    negro: new THREE.MeshBasicMaterial({ color: 0x050403 }),
  };
}

function caja(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
function cilindro(r, h, x, y, z) {
  const g = new THREE.CylinderGeometry(r * 0.9, r, h, 7);
  g.translate(x, y + h / 2, z);
  return g;
}

// La choza: piso de tablones, cuatro postes y techo de paja a cuatro aguas.
export function choza(M, x, y, z) {
  const grupo = new THREE.Group();
  const piso = 0.55, lado = 5.2, alto = 2.6;
  const maderas = [caja(lado, 0.22, lado, 0, piso - 0.11, 0)];
  const postes = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    postes.push(cilindro(0.16, alto + 0.6, sx * (lado / 2 - 0.25), -0.3, sz * (lado / 2 - 0.25)));
    maderas.push(caja(0.3, 0.6, 0.3, sx * (lado / 2 - 0.25), 0, sz * (lado / 2 - 0.25)));
  }
  // vigas
  for (const s of [-1, 1]) {
    maderas.push(caja(lado, 0.16, 0.16, 0, alto + 0.25, s * (lado / 2 - 0.25)));
    maderas.push(caja(0.16, 0.16, lado, s * (lado / 2 - 0.25), alto + 0.25, 0));
  }
  const mMadera = new THREE.Mesh(mergeSimple(maderas), M.madera);
  const mPostes = new THREE.Mesh(mergeSimple(postes), M.poste);
  const techo = new THREE.ConeGeometry(lado * 0.95, 2.1, 4, 1, true);
  techo.rotateY(Math.PI / 4);
  techo.translate(0, alto + 0.35 + 1.05, 0);
  const mTecho = new THREE.Mesh(techo, M.paja);
  // un sillón blanco y una mesa redonda, como la choza de los videos
  const sillon = mergeSimple([caja(1.8, 0.35, 0.7, 0, piso + 0.18, 0), caja(1.8, 0.45, 0.2, 0, piso + 0.55, -0.28), caja(0.2, 0.3, 0.7, -0.85, piso + 0.45, 0), caja(0.2, 0.3, 0.7, 0.85, piso + 0.45, 0)]);
  sillon.translate(-0.9, 0, -1.7);
  const mSillon = new THREE.Mesh(sillon, M.tela);
  const mesa = mergeSimple([new THREE.CylinderGeometry(0.62, 0.62, 0.08, 10).translate(0, piso + 0.62, 0), new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6).translate(0, piso + 0.3, 0)]);
  mesa.translate(0.9, 0, 0.6);
  const mMesa = new THREE.Mesh(mesa, M.madera);
  for (const m of [mMadera, mPostes, mTecho, mSillon, mMesa]) { m.castShadow = true; m.receiveShadow = true; grupo.add(m); }
  grupo.position.set(x, y, z);
  const pisos = [{ x0: x - lado / 2, x1: x + lado / 2, z0: z - lado / 2, z1: z + lado / 2, y: y + piso }];
  const obst = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) obst.push({ x: x + sx * (lado / 2 - 0.25), z: z + sz * (lado / 2 - 0.25), r: 0.22, y0: y - 1, y1: y + alto + 1 });
  obst.push({ x: x - 0.9, z: z - 1.7, r: 0.75, y0: y, y1: y + piso + 0.8 });
  return { grupo, pisos, obst, mesa: new THREE.Vector3(x + 0.9, y + piso + 0.66, z + 0.6) };
}

// El muelle: tablones sobre postes, hacia el agua. dir: 'x+' | 'x-' | 'z+' | 'z-'.
export function muelle(M, x, y, z, largo, dir) {
  const grupo = new THREE.Group();
  const ancho = 2.2, piso = y;
  const ejeX = dir[0] === 'x', s = dir[1] === '+' ? 1 : -1;
  const partes = [], postes = [];
  const w = ejeX ? largo : ancho, d = ejeX ? ancho : largo;
  const cx = ejeX ? s * largo / 2 : 0, cz = ejeX ? 0 : s * largo / 2;
  partes.push(caja(w, 0.18, d, cx, piso - 0.09, cz));
  for (let i = 0; i <= Math.floor(largo / 2.5); i++) {
    const t = s * i * 2.5;
    for (const lado of [-1, 1]) {
      const px = ejeX ? t : lado * (ancho / 2 - 0.12), pz = ejeX ? lado * (ancho / 2 - 0.12) : t;
      postes.push(cilindro(0.13, 2.8, px, piso - 2.6, pz));
    }
  }
  const mTab = new THREE.Mesh(mergeSimple(partes), M.madera);
  const mPost = new THREE.Mesh(mergeSimple(postes), M.poste);
  for (const m of [mTab, mPost]) { m.castShadow = true; m.receiveShadow = true; grupo.add(m); }
  grupo.position.set(x, 0, z);
  const pisos = [{ x0: x + cx - w / 2, x1: x + cx + w / 2, z0: z + cz - d / 2, z1: z + cz + d / 2, y: piso }];
  // la punta del muelle: buen lugar para pescar y para la cámara del menú
  const punta = new THREE.Vector3(x + (ejeX ? s * (largo - 1) : 0), piso, z + (ejeX ? 0 : s * (largo - 1)));
  return { grupo, pisos, obst: [], punta };
}

// La boca de la mina: un marco de madera metido en la ladera del cerro.
export function bocaMina(M, x, y, z, ang) {
  const grupo = new THREE.Group();
  const partes = [caja(0.3, 3.0, 0.3, -1.3, 1.5, 0), caja(0.3, 3.0, 0.3, 1.3, 1.5, 0), caja(3.2, 0.34, 0.4, 0, 3.05, 0)];
  const marco = new THREE.Mesh(mergeSimple(partes), M.madera);
  const hueco = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.9, 3.5).translate(0, 1.45, -1.72), M.negro);
  const cartel = new THREE.Mesh(caja(1.2, 0.5, 0.08, 0, 3.55, 0.12), M.madera);
  for (const m of [marco, cartel]) { m.castShadow = true; m.receiveShadow = true; grupo.add(m); }
  grupo.add(hueco);
  grupo.position.set(x, y, z);
  grupo.rotation.y = ang;
  const frente = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
  return { grupo, pisos: [], obst: [], entrada: new THREE.Vector3(x, y, z).addScaledVector(frente, 1.2), frente };
}
