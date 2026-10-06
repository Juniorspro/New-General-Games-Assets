/* Las partículas viejas de Unity (EllipsoidParticleEmitter + ParticleAnimator + ParticleRenderer):
   nacen dentro de un elipsoide con velocidades local, del mundo y al azar; las anima una fuerza, el
   frenado, el crecimiento y cinco colores a lo largo de la vida. Se dibujan como puntos con la textura
   del material (sumando luz o mezclando). */
import * as THREE from 'three';

const MAX = 300;
export class Particulas {
  constructor(S, R, escena) { Object.assign(this, { S, R, escena }); this.sist = []; this.agregar(0); }
  agregar(desde) {
    for (const p of this.S.particulas) {
      if (p.i < desde || p.sis) continue;
      const mat0 = p.rend.mats[0] ? this.R.C.mats[p.rend.mats[0]] : null;
      const tex = mat0?.tex?._MainTex ? this.R.textura(mat0.tex._MainTex.t) : null;
      const suma = mat0?.shader === 'Particle Add';
      const tinte = mat0?.c?._TintColor || [0.5, 0.5, 0.5, 0.5];
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), tam = new Float32Array(MAX);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { mapa: { value: tex }, escala: { value: 400 }, tinte: { value: new THREE.Vector4(...tinte).multiplyScalar(2) }, conMapa: { value: tex ? 1 : 0 } },
        vertexShader: `attribute float tam; attribute vec4 color; varying vec4 vC; uniform float escala;
          void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = tam * escala / max(0.1, -mv.z); }`,
        fragmentShader: `uniform sampler2D mapa; uniform vec4 tinte; uniform float conMapa; varying vec4 vC;
          void main() { vec4 t = conMapa > 0.5 ? texture2D(mapa, gl_PointCoord * vec2(1.0, -1.0) + vec2(0.0, 1.0)) : vec4(1.0, 1.0, 1.0, 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5)));
            gl_FragColor = t * vC * tinte; if (gl_FragColor.a < 0.01) discard; }`,
        transparent: true, depthWrite: false, blending: suma ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 4;
      this.escena.add(pts);
      const e = p.emisor;
      p.sis = { pts, g, pos, col, tam, vivas: [], acum: 0, emitir: e.m_Emit !== false && e.m_Emit !== 0, mundo: !!e['Simulate in Worldspace?'] };
      this.sist.push(p);
    }
  }
  emitir(i, on) { const p = this.S.particulas.find((x) => x.i === i); if (p?.sis) p.sis.emitir = on; }
  liberar() { for (const p of this.sist) { this.escena.remove(p.sis.pts); p.sis.g.dispose(); p.sis.pts.material.dispose(); } this.sist = []; }
  update(dt) {
    const S = this.S, v = new THREE.Vector3(), q = new THREE.Quaternion(), w = new THREE.Vector3();
    const esc = window.innerHeight * 0.5 / Math.tan(THREE.MathUtils.degToRad(30));
    for (const p of this.sist) {
      const s = p.sis, e = p.emisor, a = p.anim, vivo = S.activo[p.i] && !S.destruido[p.i];
      s.pts.material.uniforms.escala.value = esc;
      const o = S.O[p.i];
      o.getWorldPosition(w); o.getWorldQuaternion(q);
      if (vivo && s.emitir && p.rend.on !== false) {
        s.acum += dt * (e.minEmission + Math.random() * (e.maxEmission - e.minEmission));
        while (s.acum >= 1 && s.vivas.length < MAX) {
          s.acum -= 1;
          const el = e.m_Ellipsoid || { x: 0, y: 0, z: 0 };
          const r = () => Math.random() * 2 - 1;
          let ex, ey, ez; do { ex = r(); ey = r(); ez = r(); } while (ex * ex + ey * ey + ez * ez > 1);
          const lp = new THREE.Vector3(ex * el.x / 2, ey * el.y / 2, -ez * el.z / 2).applyQuaternion(q).add(w);
          const lv = new THREE.Vector3(...(e.localVelocity || [0, 0, 0])).applyQuaternion(q).add(new THREE.Vector3(...(e.worldVelocity || [0, 0, 0])));
          const rv = e.rndVelocity || [0, 0, 0];
          lv.x += r() * rv[0]; lv.y += r() * rv[1]; lv.z += r() * rv[2];
          const vida = e.minEnergy + Math.random() * (e.maxEnergy - e.minEnergy);
          s.vivas.push({ p: lp, v: lv, t: 0, vida, tam: e.minSize + Math.random() * (e.maxSize - e.minSize) });
        }
        if (e.m_OneShot) s.emitir = false;
      }
      const f = new THREE.Vector3(...(a.force ? [a.force.x ?? a.force[0], a.force.y ?? a.force[1], -(a.force.z ?? a.force[2])] : [0, 0, 0]));
      const amort = a.damping ?? 1, crece = a.sizeGrow ?? 0, cols = [0, 1, 2, 3, 4].map((k) => a[`colorAnimation[${k}]`] || [1, 1, 1, 1]);
      s.vivas = s.vivas.filter((x) => (x.t += dt) < x.vida);
      let k = 0;
      for (const x of s.vivas) {
        x.v.addScaledVector(f, dt); x.v.multiplyScalar(Math.pow(amort, dt)); x.p.addScaledVector(x.v, dt);
        const u = x.t / x.vida * 4, i0 = Math.min(3, Math.floor(u)), fr = u - i0, c0 = cols[i0], c1 = cols[i0 + 1];
        s.pos[k * 3] = x.p.x; s.pos[k * 3 + 1] = x.p.y; s.pos[k * 3 + 2] = x.p.z;
        for (let c = 0; c < 4; c++) s.col[k * 4 + c] = c0[c] + (c1[c] - c0[c]) * fr;
        s.tam[k] = x.tam * (1 + crece * x.t);
        k++;
      }
      s.g.setDrawRange(0, k);
      s.g.attributes.position.needsUpdate = s.g.attributes.color.needsUpdate = s.g.attributes.tam.needsUpdate = true;
      void v;
    }
  }
}
