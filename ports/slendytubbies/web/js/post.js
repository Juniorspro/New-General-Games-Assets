/* Los efectos de cámara del original, en una sola pasada: MotionBlur (se mezcla con el cuadro anterior,
   blurAmount 0,9), SepiaToneEffect (al morir), VortexEffect (cuando un enemigo entra en el visor) y la
   corrección de color "gamma" del menú (las curvas de ColorCorrectionCurves: más claro). */
import * as THREE from 'three';

export function crearPost(renderer) {
  const tam = new THREE.Vector2();
  const opc = { type: THREE.UnsignedByteType, depthBuffer: true };
  let escena0 = new THREE.WebGLRenderTarget(4, 4, opc), acum = [new THREE.WebGLRenderTarget(4, 4, opc), new THREE.WebGLRenderTarget(4, 4, opc)];
  let idx = 0, primero = true;
  const U = {
    tEscena: { value: null }, tPrevio: { value: null }, blur: { value: 0 }, sepia: { value: 0 }, vortex: { value: 0 }, gamma: { value: 0 }, brillo: { value: 1 }, aspecto: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tEscena, tPrevio; uniform float blur, sepia, vortex, gamma, brillo, aspecto; varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        if (vortex > 0.0) { // VortexEffect: gira el centro de la pantalla
          vec2 d = (uv - 0.5) * vec2(aspecto, 1.0); float r = length(d) / 0.5;
          float a = radians(vortex) * pow(max(0.0, 1.0 - r), 2.0); float s = sin(a), c = cos(a);
          d = vec2(d.x * c - d.y * s, d.x * s + d.y * c); uv = d / vec2(aspecto, 1.0) + 0.5;
        }
        vec3 col = texture2D(tEscena, uv).rgb;
        if (gamma > 0.5) col = 1.0 - pow(1.0 - col, vec3(2.0)); // la curva de las tres canales: arranca con pendiente 2
        col *= brillo;
        if (sepia > 0.5) { float y = dot(col, vec3(0.299, 0.587, 0.114)); col = vec3(y) * vec3(1.2, 1.0, 0.8); }
        if (blur > 0.0) col = mix(col, texture2D(tPrevio, vUv).rgb, blur);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const cuadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  cuadro.frustumCulled = false;
  const escenaPost = new THREE.Scene(); escenaPost.add(cuadro);
  const camPost = new THREE.Camera();
  const copia = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: null, depthTest: false }));
  const escenaCopia = new THREE.Scene(); escenaCopia.add(copia);
  const P = {
    activo: false, efectos: { blur: false, sepia: false, vortex: 0 },
    reiniciar() { primero = true; P.efectos = { blur: false, sepia: false, vortex: 0 }; },
    actualizar(ef, dt) { P.efectos = ef; ef.vortex = Math.max(0, (ef.vortex || 0) - dt * 300); },
    render(escena, camara, ajustes) {
      const e = P.efectos;
      const hace = e.blur || e.sepia || e.vortex > 0 || ajustes.gamma;
      if (!hace) { U.brillo.value = 1; renderer.setRenderTarget(null); renderer.render(escena, camara); primero = true; return; }
      renderer.getDrawingBufferSize(tam);
      const w = Math.max(4, tam.x), h = Math.max(4, tam.y);
      if (escena0.width !== w || escena0.height !== h) { escena0.setSize(w, h); acum.forEach((a) => a.setSize(w, h)); primero = true; }
      renderer.setRenderTarget(escena0); renderer.render(escena, camara);
      U.tEscena.value = escena0.texture; U.tPrevio.value = acum[idx].texture;
      U.blur.value = e.blur && !primero ? 0.9 : 0; U.sepia.value = e.sepia ? 1 : 0; U.vortex.value = e.vortex || 0; U.gamma.value = ajustes.gamma ? 1 : 0;
      U.aspecto.value = w / h; U.brillo.value = 1;
      const destino = acum[1 - idx];
      renderer.setRenderTarget(destino); renderer.render(escenaPost, camPost);
      copia.material.map = destino.texture;
      renderer.setRenderTarget(null); renderer.render(escenaCopia, camPost);
      idx = 1 - idx; primero = false;
    },
  };
  return P;
}
