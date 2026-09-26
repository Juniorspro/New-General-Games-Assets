/* ============================================================================
   aeroplaza/js/instanciar.js — las copias de un mismo modelo, en una sola
   llamada de dibujo por material (27/09, para el VR a 120: cada llamada le
   cuesta al celu, y la plaza tenía casas, puestos y faroles repetidos).
   - Las construcciones ya se funden por material (construcciones.js), pero
     cada COPIA era una llamada por material: 8 casas de 10 materiales, 80
     llamadas. Instanciadas son 10.
   - Solo lo quieto: piezas adentro de algo (no las de primer nivel, que
     detalle.js corta por distancia), opacas (el vidrio se ordena por objeto
     y con instancias se desordenaría), con la misma geometría, el mismo
     material y la misma forma de dar y recibir sombra.
   - Las piezas de verdad siguen ahí (escondidas): los choques, los rayos y
     lo que el juego les haga no cambia. Cada segundo se mira si alguna se
     movió o si el juego la mostró o la escondió; si pasa, ese grupo vuelve a
     ser piezas sueltas.
   ========================================================================== */
import * as THREE from 'three';

const MINIMO = 3;
const _m = new THREE.Matrix4();

/* ¿se ve (ella y todo lo de arriba, hasta el grupo)? */
function seVe(o, raiz) { for (let q = o; q && q !== raiz.parent; q = q.parent) if (!q.visible) return false; return true; }

export function instanciarCopias(grupo) {
  if (!grupo) return [];
  grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grupo.matrixWorld).invert();
  const tandas = new Map();
  grupo.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.parent === grupo || o.userData.sinInstanciar || o.userData.copiaDe) return;
    const m = o.material; if (!m || Array.isArray(m) || m.transparent || !seVe(o, grupo)) return;
    if (o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || o.morphTargetInfluences) return;
    const k = `${o.geometry.uuid}|${m.uuid}|${+o.castShadow}${+o.receiveShadow}|${o.renderOrder}|${!!o.userData.pasa}|${o.frustumCulled}`;
    let t = tandas.get(k); if (!t) tandas.set(k, (t = []));
    t.push(o);
  });
  const hechas = [];
  for (const piezas of tandas.values()) {
    if (piezas.length < MINIMO) continue;
    const a = piezas[0], im = new THREE.InstancedMesh(a.geometry, a.material, piezas.length);
    im.castShadow = a.castShadow; im.receiveShadow = a.receiveShadow; im.renderOrder = a.renderOrder;
    im.userData.pasa = a.userData.pasa; im.userData.copias = piezas; im.userData.sinInstanciar = true;
    piezas.forEach((o, i) => {
      im.setMatrixAt(i, _m.multiplyMatrices(inv, o.matrixWorld));
      /* la pieza de verdad queda, escondida; su "visible" pasa a ser lo que quiere el juego */
      o.userData.copiaDe = im; o.userData._mw = o.matrixWorld.clone(); o.userData._quiere = true;
      Object.defineProperty(o, 'visible', { configurable: true, get() { return false; }, set(v) { o.userData._quiere = v; } });
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    grupo.add(im);
    hechas.push(im);
  }
  return hechas;
}

/* si una pieza se movió o el juego la cambió de visible, su grupo vuelve a ser piezas sueltas */
export function revisarCopias(hechas) {
  let deshechas = 0;
  for (let i = hechas.length - 1; i >= 0; i--) {
    const im = hechas[i], piezas = im.userData.copias;
    const cambio = piezas.some((o) => !o.userData._quiere || !o.parent || !o.matrixWorld.equals(o.userData._mw));
    if (!cambio) continue;
    for (const o of piezas) { const quiere = o.userData._quiere; delete o.visible; o.visible = quiere; delete o.userData.copiaDe; }
    im.removeFromParent(); im.dispose(); hechas.splice(i, 1); deshechas++;
  }
  return deshechas;
}
