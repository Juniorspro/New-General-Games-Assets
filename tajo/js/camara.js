// El encuadre. La cámara no es la de los ojos de alguien parado en la pista
// (como en el juego con casco): está un poco más atrás y más arriba, porque en
// un teléfono el dedo tiene que llegar a los cuatro carriles sin tapar lo que
// viene.
//
// POR QUÉ EL CAMPO SE FIJA EN HORIZONTAL. Con el vertical fijo, en un teléfono
// parado los carriles de los costados quedan afuera de la pantalla. Lo que
// importa es que el ancho de la grilla entre siempre: el alto sale solo.

import * as THREE from "../vendor/three.module.min.js";

export const CAM = {
  pos: new THREE.Vector3(0, 1.8, 3.1),
  mira: new THREE.Vector3(0, 1.3, -8),
  anchoNecesario: 2.9,     // metros que tienen que entrar a lo ancho en el plano de corte
  zCorte: -0.9,            // dónde está cada bloque en el instante exacto de su golpe
};

export function encuadrar(camara, aspecto) {
  const dist = CAM.pos.z - CAM.zCorte;
  const tanH = (CAM.anchoNecesario / 2) / dist;
  let vfov = 2 * Math.atan(tanH / aspecto);
  // Acostado (o en una compu) el ancho sobra: se pone un vertical razonable.
  vfov = THREE.MathUtils.clamp(vfov, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(84));
  camara.fov = THREE.MathUtils.radToDeg(vfov);
  camara.aspect = aspecto;
  camara.position.copy(CAM.pos);
  camara.lookAt(CAM.mira);
  camara.updateProjectionMatrix();
  camara.updateMatrixWorld();
}
