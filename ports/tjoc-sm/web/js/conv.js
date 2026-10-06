/* Conversión Unreal (cm, Z arriba, mano izquierda) ↔ three (m, Y arriba, mano derecha): x=X, y=Z, z=Y. */
import * as THREE from 'three';
import { rotAQuat, quatARot } from './nat/libs.js';
export const pUE = (p) => ({ X: p.x * 100, Y: p.z * 100, Z: p.y * 100 });
export const pT = (v, out = new THREE.Vector3()) => out.set((v?.X || 0) * 0.01, (v?.Z || 0) * 0.01, (v?.Y || 0) * 0.01);
export const qUE = (q) => ({ X: -q.x, Y: -q.z, Z: -q.y, W: q.w });
export const qT = (q, out = new THREE.Quaternion()) => out.set(-(q?.X || 0), -(q?.Z || 0), -(q?.Y || 0), q?.W ?? 1);
export const sUE = (s) => ({ X: s.x, Y: s.z, Z: s.y });
export const sT = (s, out = new THREE.Vector3()) => out.set(s?.X ?? 1, s?.Z ?? 1, s?.Y ?? 1);
export const rotT = (r, out = new THREE.Quaternion()) => qT(rotAQuat(r), out);
export const rotUE = (q) => quatARot(qUE(q));
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();
/* Transform UE del mundo de un Object3D */
export function mundoUE(o) {
  o.updateWorldMatrix(true, false);
  o.matrixWorld.decompose(_p, _q, _s);
  return { Translation: pUE(_p), Rotation: qUE(_q), Scale3D: sUE(_s) };
}
/* Pone la transformación de mundo (UE) a un Object3D, recalculando la local según el padre. */
export function ponerMundo(o, pos, quat, esc) {
  o.updateWorldMatrix(true, false);
  o.matrixWorld.decompose(_p, _q, _s);
  if (pos) pT(pos, _p);
  if (quat) qT(quat, _q);
  if (esc) sT(esc, _s);
  _m.compose(_p, _q, _s);
  if (o.parent) { o.parent.updateWorldMatrix(true, false); _mi.copy(o.parent.matrixWorld).invert(); _m.premultiply(_mi); }
  _m.decompose(o.position, o.quaternion, o.scale);
  o.updateMatrixWorld(true);
}
