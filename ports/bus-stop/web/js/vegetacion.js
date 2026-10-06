/* Árboles y pasto del terreno de Unity, a la medida de un teléfono:
   - árboles: la malla original cerca (hasta "cerca" metros) y, más lejos, un cartel cruzado con la
     foto del mismo árbol (sacada al cargar); la niebla tapa el resto;
   - pasto: carteles que miran a la cámara y se mecen, donde el terreno tenía pasto pintado, solo
     alrededor del jugador. Se recalcula cuando el jugador se mueve unos metros. */
import * as THREE from 'three';

export function crearVegetacion(S, renderer, escena, Q) {
  const grupo = new THREE.Group(); grupo.name = 'vegetacion';
  escena.add(grupo);

  /* ---- la foto del árbol para los carteles */
  const caja = new THREE.Box3().setFromBufferAttribute(S.gArbol.attributes.position);
  const ancho = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z), alto = caja.max.y - caja.min.y;
  const rt = new THREE.WebGLRenderTarget(256, Math.round(256 * alto / ancho), { depthBuffer: true });
  {
    const sc = new THREE.Scene();
    const mats = S.matsArbol.map((m) => new THREE.MeshBasicMaterial({ map: m.map, alphaTest: m.alphaTest || 0, side: m.side, color: 0xffffff }));
    const m = new THREE.Mesh(S.gArbol, mats);
    sc.add(m);
    const cam = new THREE.OrthographicCamera(-ancho / 2, ancho / 2, alto, 0, -50, 50);
    cam.position.set((caja.min.x + caja.max.x) / 2, caja.min.y, 20); cam.lookAt((caja.min.x + caja.max.x) / 2, caja.min.y, 0);
    const antes = renderer.getClearColor(new THREE.Color()), aA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    renderer.setRenderTarget(null); renderer.setClearColor(antes, aA);
    mats.forEach((x) => x.dispose());
  }
  const gCartel = new THREE.BufferGeometry();
  {
    const w = ancho / 2, P = [], U = [], Nn = [], I = [];
    for (let k = 0; k < 2; k++) {
      const ang = k * Math.PI / 2, cx = Math.cos(ang) * w, cz = Math.sin(ang) * w, b = P.length / 3;
      P.push(-cx, 0, -cz, cx, 0, cz, cx, alto, cz, -cx, alto, -cz);
      U.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let j = 0; j < 4; j++) Nn.push(0, 1, 0);
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    gCartel.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    gCartel.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    gCartel.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    gCartel.setIndex(I);
  }
  const matCartel = S.conLuzMapa(new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide }));
  const MAXC = 160, MAXL = 1400;
  const cerca = new THREE.InstancedMesh(S.gArbol, S.matsArbol, MAXC);
  const lejos = new THREE.InstancedMesh(gCartel, matCartel, MAXL);
  cerca.name = 'arboles'; lejos.name = 'arboles-lejos';
  cerca.count = lejos.count = 0;
  cerca.frustumCulled = lejos.frustumCulled = false;
  grupo.add(cerca, lejos);

  /* ---- el pasto */
  const P = S.pasto, info = P.info;
  const gPasto = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  gPasto.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(12).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const uPasto = { uTiempo: { value: 0 } };
  const matPasto = new THREE.MeshLambertMaterial({ map: P.tex, alphaTest: 0.5, side: THREE.DoubleSide });
  matPasto.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, S.uniformesMundo, uPasto);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vNy; uniform float uTiempo;')
      .replace('#include <project_vertex>', `
        vec3 cen = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        float an = length( instanceMatrix[0].xyz ), al = length( instanceMatrix[1].xyz );
        vec3 der = vec3( viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0] );
        der = normalize( vec3( der.x, 0.0, der.z ) );
        float ola = sin( uTiempo * 1.7 + cen.x * 0.35 + cen.z * 0.27 ) * 0.5 + sin( uTiempo * 2.9 + cen.z * 0.6 ) * 0.25;
        vec3 wp = cen + der * position.x * an + vec3( 0.0, position.y * al, 0.0 ) + vec3( 0.18, 0.0, 0.12 ) * ola * position.y * al;
        vMundo = wp; vNy = 1.0;
        vec4 mvPosition = viewMatrix * vec4( wp, 1.0 );
        gl_Position = projectionMatrix * mvPosition;`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vNy; uniform sampler2D uLuzMapa; uniform vec4 uLuzRect; uniform float uBrillo;')
      .replace('#include <opaque_fragment>', `
        vec2 lmUv = ( vMundo.xz - uLuzRect.xy ) / uLuzRect.zw;
        float dentro = step( 0.0, lmUv.x ) * step( lmUv.x, 1.0 ) * step( 0.0, lmUv.y ) * step( lmUv.y, 1.0 );
        outgoingLight += diffuseColor.rgb * texture2D( uLuzMapa, lmUv ).rgb * 4.0 * dentro;
        outgoingLight *= uBrillo;
        #include <opaque_fragment>`);
  };
  matPasto.customProgramCacheKey = () => 'pasto';
  const MAXP = 9000;
  const pasto = new THREE.InstancedMesh(gPasto, matPasto, MAXP);
  pasto.name = 'pasto'; pasto.count = 0; pasto.frustumCulled = false;
  pasto.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
  grupo.add(pasto);

  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pos = new THREE.Vector3(), esc = new THREE.Vector3(), col = new THREE.Color();
  const sano = new THREE.Color(...info.sano.slice(0, 3)), seco = new THREE.Color(...info.seco.slice(0, 3));
  const hash = (x, z, s) => { let h = (x * 374761393 + z * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const ultimo = new THREE.Vector3(1e9, 0, 1e9);
  const T0x = -1000, T0z = 1000, celda = 2000 / P.res;

  function actualizar(camPos, forzar) {
    if (!forzar && Math.hypot(camPos.x - ultimo.x, camPos.z - ultimo.z) < 4) return;
    ultimo.copy(camPos);
    const q = Q();
    // árboles
    let nc = 0, nl = 0;
    const r1 = q.arbolesCerca, r2 = q.arbolesLejos;
    for (const a of S.arboles) {
      const d = Math.hypot(a.x - camPos.x, a.z - camPos.z);
      if (d > r2) continue;
      pos.set(a.x, a.y, a.z); esc.set(a.w, a.h, a.w);
      m4.compose(pos, qq.identity(), esc);
      if (d < r1 && nc < MAXC) cerca.setMatrixAt(nc++, m4);
      else if (nl < MAXL) lejos.setMatrixAt(nl++, m4);
    }
    cerca.count = nc; lejos.count = nl;
    cerca.instanceMatrix.needsUpdate = lejos.instanceMatrix.needsUpdate = true;
    // pasto
    let np = 0;
    const rp = q.pasto, tope = Math.min(MAXP, q.pastoMax);
    const i0 = Math.max(0, Math.floor((camPos.x - rp - T0x) / celda)), i1 = Math.min(P.res - 1, Math.floor((camPos.x + rp - T0x) / celda));
    const j0 = Math.max(0, Math.floor((T0z - camPos.z - rp) / celda)), j1 = Math.min(P.res - 1, Math.floor((T0z - camPos.z + rp) / celda));
    if (rp > 0) {
      fuera: for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const n = P.den[j * P.res + i];
        if (!n) continue;
        for (let k = 0; k < Math.min(n, 6); k++) {
          const x = T0x + (i + hash(i, j, k)) * celda, z = T0z - (j + hash(j, i, k + 7)) * celda;
          const dd = Math.hypot(x - camPos.x, z - camPos.z);
          if (dd > rp) continue;
          const borde = Math.min(1, (rp - dd) / 6);
          const s = hash(i, j, k + 13);
          const w = (info.ancho[0] + (info.ancho[1] - info.ancho[0]) * s) * borde, h = (info.alto[0] + (info.alto[1] - info.alto[0]) * hash(i, j, k + 29)) * borde;
          pos.set(x, S.alturaEn(x, z) - 0.05, z); esc.set(w, h, 1);
          m4.compose(pos, qq.identity(), esc);
          pasto.setMatrixAt(np, m4);
          col.copy(sano).lerp(seco, Math.max(0, Math.sin(x * info.ruido * 0.7) * Math.cos(z * info.ruido * 0.9)) * 0.8).multiply({ r: 0.7, g: 0.6, b: 0.5 });
          pasto.setColorAt(np, col);
          if (++np >= tope) break fuera;
        }
      }
    }
    pasto.count = np;
    pasto.instanceMatrix.needsUpdate = true; pasto.instanceColor.needsUpdate = true;
  }
  return { actualizar, tick: (t) => (uPasto.uTiempo.value = t), grupo, cuantos: () => ({ cerca: cerca.count, lejos: lejos.count, pasto: pasto.count }) };
}
