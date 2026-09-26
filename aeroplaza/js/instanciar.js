/* ============================================================================
   aeroplaza/js/instanciar.js — las copias de un mismo modelo, en una sola
   llamada de dibujo por material (27/09, para el VR a 120: cada llamada le
   cuesta al celu, y la plaza tenía casas, puestos y faroles repetidos).
   - Las construcciones ya se funden por material (construcciones.js), pero
     cada COPIA era una llamada por material: 8 casas de 10 materiales, 80
     llamadas. Instanciadas son 10.
   - Solo lo quieto: al entrar al lugar se anotan las candidatas y a los dos
     segundos se instancian las que no se movieron (el delfín nada, los
     vagones andan: quedan afuera). Piezas adentro de algo (no las de primer
     nivel, que detalle.js corta por distancia), opacas (el vidrio se ordena
     por objeto y con instancias se desordenaría), con la misma geometría, el
     mismo material y la misma forma de dar y recibir sombra.
   - Las piezas de verdad siguen ahí (escondidas): los choques, los rayos y
     lo que el juego les haga no cambia. Cada segundo se mira si alguna se
     movió o si el juego la mostró o la escondió; si pasa, ese grupo vuelve a
     ser piezas sueltas.
   - Las referencias entre pieza e instancia van sin enumerar: el clone() de
     three copia el userData con JSON y se colgaba con el círculo.
   ========================================================================== */
import * as THREE from 'three';

const MINIMO = 3;
const _m = new THREE.Matrix4();
const oculto = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, configurable: true, writable: true });

/* ¿se ve (ella y todo lo de arriba, hasta el grupo)? */
function seVe(o, raiz) { for (let q = o; q && q !== raiz.parent; q = q.parent) if (!q.visible) return false; return true; }
function sirve(o, grupo) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.parent === grupo || o.userData.sinInstanciar || o.userData.copiaDe) return false;
  const m = o.material; if (!m || Array.isArray(m) || m.transparent || !seVe(o, grupo)) return false;
  return o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && !o.morphTargetInfluences;
}

/* al entrar: las candidatas y dónde estaban */
export function candidatasCopias(grupo) {
  if (!grupo) return null;
  grupo.updateMatrixWorld(true);
  const lista = [];
  grupo.traverse((o) => { if (sirve(o, grupo)) lista.push({ o, mw: o.matrixWorld.clone() }); });
  return { grupo, lista };
}

/* a los dos segundos: las que no se movieron, instanciadas */
export function instanciarCopias(cand) {
  if (!cand) return [];
  const grupo = cand.grupo; grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grupo.matrixWorld).invert();
  const tandas = new Map();
  for (const { o, mw } of cand.lista) {
    if (!o.parent || !sirve(o, grupo) || !o.matrixWorld.equals(mw)) continue;
    /* (lo que se atraviesa a propósito lleva `pasa` en ella o en algo de arriba, como un portal: la
       instancia cuelga del grupo y tiene que heredarlo) */
    let pasa = false; for (let x = o; x && x !== grupo; x = x.parent) if (x.userData.pasa) pasa = true;
    const k = `${o.geometry.uuid}|${o.material.uuid}|${+o.castShadow}${+o.receiveShadow}|${o.renderOrder}|${pasa}|${o.frustumCulled}`;
    let t = tandas.get(k); if (!t) tandas.set(k, (t = Object.assign([], { pasa })));
    t.push(o);
  }
  const hechas = [];
  for (const piezas of tandas.values()) {
    if (piezas.length < MINIMO) continue;
    const a = piezas[0], im = new THREE.InstancedMesh(a.geometry, a.material, piezas.length);
    im.castShadow = a.castShadow; im.receiveShadow = a.receiveShadow; im.renderOrder = a.renderOrder;
    im.userData.pasa = piezas.pasa; im.userData.sinInstanciar = true; oculto(im.userData, 'copias', piezas);
    piezas.forEach((o, i) => {
      im.setMatrixAt(i, _m.multiplyMatrices(inv, o.matrixWorld));
      /* la pieza de verdad queda, escondida; su "visible" pasa a ser lo que quiere el juego */
      oculto(o.userData, 'copiaDe', im); oculto(o.userData, '_mw', o.matrixWorld.clone()); oculto(o.userData, '_quiere', true);
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
