/* ============================================================================
   aeroplaza/js/reinos/tiro.js — TIRO DE BURBUJAS, el minijuego en primera
   persona de la Zona de Juegos.
   Se juega parado en un balcón redondo de vidrio, arriba de una laguna, con
   los brazos en la cámara (primera.js): el burbujero (F, ◎) tira burbujas
   hacia donde se mira y hay que reventar los blancos que flotan:
   - burbuja azul: 1 punto, lenta y grande;
   - rosa: 2 puntos, más chica y rápida;
   - estrella dorada: 5 puntos, chiquita, rápida y rara (más al final).
   Cada acierto seguido sube la racha: ×2 a los 4, ×3 a los 8, ×4 a los 12; una
   burbuja que no pega en nada la corta. 60 segundos; estrellas por puntos.
   main.js le pregunta a golpe(p) por cada burbuja que vuela y le avisa de
   las que se pierden (fallo()).
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar } from '../mundo.js';
import { brilloso, materialVidrio, materialBurbuja, UNI } from '../naturaleza.js';
import { Chispas } from '../objetos.js';
import { sumar } from '../textos.js';

sumar({
  es: { reino_tiro: 'Tiro de Burbujas', tiro_titulo: 'Tiro de Burbujas', tiro_desc: 'Primera persona · 60 s · reventá los blancos con el burbujero (F o ◎)', tiro_puntos: 'puntos', tiro_racha: 'racha', tiro_fin: '¡Se terminó el tiempo!', tiro_mejor: 'Récord {n}', tiro_aciertos: 'Aciertos', tiro_punteria: 'Puntería', pk_fp: '👁 Primera persona', pk_fp_si: 'Sí', pk_fp_no: 'No' },
  en: { reino_tiro: 'Bubble Shooting', tiro_titulo: 'Bubble Shooting', tiro_desc: 'First person · 60 s · pop the targets with the bubbler (F or ◎)', tiro_puntos: 'points', tiro_racha: 'streak', tiro_fin: "Time's up!", tiro_mejor: 'Best {n}', tiro_aciertos: 'Hits', tiro_punteria: 'Accuracy', pk_fp: '👁 First person', pk_fp_si: 'On', pk_fp_no: 'Off' },
  pt: { reino_tiro: 'Tiro de Bolhas', tiro_titulo: 'Tiro de Bolhas', tiro_desc: 'Primeira pessoa · 60 s · estoure os alvos com o bolhador (F ou ◎)', tiro_puntos: 'pontos', tiro_racha: 'sequência', tiro_fin: 'Acabou o tempo!', tiro_mejor: 'Recorde {n}', tiro_aciertos: 'Acertos', tiro_punteria: 'Pontaria', pk_fp: '👁 Primeira pessoa', pk_fp_si: 'Sim', pk_fp_no: 'Não' },
});

export const TIRO = { dur: 60, estrellas: [30, 60, 95] };
const TIPOS = {
  azul: { pts: 1, r: 0.78, vel: 0.5, color: '#39b8f0', anillo: '#ffffff' },
  rosa: { pts: 2, r: 0.6, vel: 0.95, color: '#ff6fb0', anillo: '#fff2fa' },
  oro: { pts: 5, r: 0.46, vel: 1.5, color: '#ffd23f', anillo: '#fff6c2' },
};

/* la miniatura del menú: el cielo, la laguna, blancos y la mira */
export function miniaturaTiro(W = 320, H = 200) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cielo = g.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, '#39b8f0'); cielo.addColorStop(0.6, '#bff0ff'); cielo.addColorStop(0.61, '#56d8e8'); cielo.addColorStop(1, '#1f9fd8');
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  for (const [x, y, rr, col] of [[0.22, 0.34, 0.12, '#39b8f0'], [0.7, 0.28, 0.09, '#ff6fb0'], [0.52, 0.5, 0.06, '#ffd23f'], [0.86, 0.52, 0.1, '#39b8f0']]) {
    const X = x * W, Y = y * H, R = rr * W;
    const gr = g.createRadialGradient(X - R * 0.3, Y - R * 0.3, R * 0.1, X, Y, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(255,255,255,0.6)');
    g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, 7); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (const k of [0.65, 0.35]) { g.beginPath(); g.arc(X, Y, R * k, 0, 7); g.stroke(); }
  }
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4; g.beginPath(); g.arc(W * 0.5, H * 0.5, 16, 0, 7); g.moveTo(W * 0.5 - 26, H * 0.5); g.lineTo(W * 0.5 - 8, H * 0.5); g.moveTo(W * 0.5 + 8, H * 0.5); g.lineTo(W * 0.5 + 26, H * 0.5); g.stroke();
  /* la mano con el burbujero, abajo a la derecha */
  const gm = g.createRadialGradient(W * 0.8, H * 0.86, 4, W * 0.82, H * 0.9, 50); gm.addColorStop(0, '#dff8ff'); gm.addColorStop(0.5, '#39c6ff'); gm.addColorStop(1, '#1576c8');
  g.fillStyle = gm; g.beginPath(); g.ellipse(W * 0.84, H * 0.95, 34, 46, -0.6, 0, 7); g.fill();
  return c;
}

export function crearTiro(ctx) {
  const mundo = new Mundo(() => -60); mundo.agua = null; mundo.limite = 60; mundo.sinRejilla = true;
  const g = new THREE.Group(), r = azar(71);
  const Y = 22, R = 5.2;
  /* el balcón: piso de vidrio con la baranda (sólida e invisible hasta arriba: nadie se cae) */
  const piso = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, 0.5, 48), materialVidrio('#dff8ff', 0.45)); piso.position.y = Y - 0.25; piso.renderOrder = 3; g.add(piso);
  const borde = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 10, 64).rotateX(Math.PI / 2), brilloso('#ffffff', { roughness: 0.15 })); borde.position.y = Y + 0.02; g.add(borde);
  const baranda = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.07, 8, 64).rotateX(Math.PI / 2), brilloso('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.6 })); baranda.position.y = Y + 1.05; g.add(baranda);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 8), brilloso('#ffffff')); p.position.set(Math.sin(a) * (R - 0.1), Y + 0.52, Math.cos(a) * (R - 0.1)); g.add(p); }
  const vidrioB = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 1, 48, 1, true), materialVidrio('#e6fbff', 0.12)); vidrioB.position.y = Y + 0.5; vidrioB.renderOrder = 3; g.add(vidrioB);
  mundo.cilindro(0, 0, R, Y - 1, Y);
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; mundo.cilindro(Math.sin(a) * (R + 0.2), Math.cos(a) * (R + 0.2), 0.45, Y - 1, Y + 6); }
  /* la columna de abajo y la laguna con islitas */
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, Y + 2, 20), brilloso('#ffffff', { roughness: 0.25 })); col.position.y = (Y - 2) / 2 - 1; g.add(col);
  const laguna = new THREE.Mesh(new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: { uT: UNI.uT }, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uT; varying vec3 vP; void main(){ vec2 q = vP.xz * 0.08; float c = pow(abs(sin(q.x + sin(q.y + uT * 0.6) * 1.5) * sin(q.y * 1.2 + sin(q.x * 0.7 - uT * 0.5))), 6.0); float d = clamp(length(vP.xz) / 400.0, 0.0, 1.0); vec3 col = mix(vec3(0.15, 0.7, 0.95), vec3(0.75, 0.97, 1.0), c * 0.7); col = mix(col, vec3(0.75, 0.92, 1.0), d * d); gl_FragColor = vec4(col, 1.0); }' }));
  laguna.position.y = -1; g.add(laguna);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 40 + r() * 120, x = Math.sin(a) * d, z = Math.cos(a) * d, s = 4 + r() * 8;
    const isla = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brilloso('#56e05a', { roughness: 0.5 })); isla.scale.y = 0.35; isla.position.set(x, -1, z); g.add(isla);
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.12, s * 1.2, 0.6, 24), brilloso('#fff1c8', { roughness: 0.6 })); arena.position.set(x, -1.1, z); g.add(arena);
    for (let k = 0; k < 2; k++) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, s * 0.8, 8), brilloso('#c8905a')); tr.position.set(x + (r() - 0.5) * s * 0.6, -1 + s * 0.5, z + (r() - 0.5) * s * 0.6); g.add(tr); const cp = new THREE.Mesh(new THREE.SphereGeometry(s * 0.28, 12, 8), brilloso('#3fb536', { roughness: 0.4 })); cp.position.set(tr.position.x, tr.position.y + s * 0.45, tr.position.z); g.add(cp); }
  }
  /* burbujas de adorno que suben lejos */
  const deco = []; for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + r() * 1.6, 20, 14), materialBurbuja(0.8)); b.renderOrder = 3; b.userData = { a: r() * 6.28, d: 30 + r() * 50, y: r() * 60, v: 0.6 + r() * 1.2 }; g.add(b); deco.push(b); }
  const chispas = new Chispas(g, '#ffffff', 200);

  /* los blancos: una burbuja con aros de tiro al blanco que miran al balcón */
  const blancos = [];
  const hacer = (tipo) => {
    const T = TIPOS[tipo], G0 = new THREE.Group(); G0.visible = false; g.add(G0);
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(T.r, 24, 16), materialBurbuja(1)); esfera.renderOrder = 4; G0.add(esfera);
    const cara = new THREE.Group(); G0.add(cara);
    const m = (c, e = 0.5) => brilloso(c, { emissive: c, emissiveIntensity: e, roughness: 0.2 });
    const disco = new THREE.Mesh(new THREE.CircleGeometry(T.r * 0.72, 32), m(T.color, 0.6)); cara.add(disco);
    for (const [k, c] of [[0.55, T.anillo], [0.34, T.color], [0.16, T.anillo]]) { const a = new THREE.Mesh(new THREE.RingGeometry(T.r * (k - 0.09), T.r * k, 32), m(c, 0.7)); a.position.z = 0.005 + (1 - k) * 0.01; cara.add(a); }
    if (tipo === 'oro') { const est = new THREE.Shape(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? T.r * 0.22 : T.r * 0.5, a = i / 10 * Math.PI * 2 - Math.PI / 2; i ? est.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : est.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } const s = new THREE.Mesh(new THREE.ShapeGeometry(est), m('#fff6c2', 1.2)); s.position.z = 0.03; cara.add(s); }
    const B = { tipo, T, G0, cara, vivo: false, t: 0, vida: 0, c: new THREE.Vector3(), f: [0, 0, 0], esc: 0 };
    blancos.push(B); return B;
  };
  for (let i = 0; i < 6; i++) hacer('azul'); for (let i = 0; i < 4; i++) hacer('rosa'); for (let i = 0; i < 2; i++) hacer('oro');
  /* aparece uno: en un arco adelante (el balcón mira a -z), entre 9 y 24 m */
  const aparecer = (B) => {
    const a = (r() - 0.5) * 2.4, d = 9 + r() * 15;
    B.c.set(Math.sin(a) * d, Y + 1.2 + r() * 6, -Math.cos(a) * d);
    B.f = [r() * 6.28, r() * 6.28, 1.4 + r() * 2.6]; B.t = 0; B.vida = 5.5 + r() * 3.5; B.vivo = true; B.G0.visible = true; B.esc = 0;
  };

  const E = { fase: 'cuenta', cuenta: 3.4, tiempo: TIRO.dur, puntos: 0, racha: 0, mult: 1, aciertos: 0, tiros: 0, eventos: [] };
  const inicio = new THREE.Vector3(0, Y + 0.02, 1.6);
  let tt = 0, tNuevo = 0;
  const vivos = () => blancos.filter((B) => B.vivo).length;
  return {
    id: 'tiro', mundo, grupo: g, inicio, rumboInicio: Math.PI, musica: 'titulo', cielo: { hora: 0.33, arcoiris: 1, aurora: 0 },
    primeraPersona: true, tiro: E, orbes: null, discos: [], npcs: [], sinZonas: true, blancos,
    /* ¿esta burbuja (p) le pegó a algún blanco? */
    golpe(p) {
      if (E.fase !== 'juega') return null;
      for (const B of blancos) {
        if (!B.vivo || B.esc < 0.5) continue;
        if (B.G0.position.distanceTo(p) < B.T.r + 0.34) {
          B.vivo = false; B.G0.visible = false;
          E.racha++; E.mult = Math.min(4, 1 + Math.floor(E.racha / 4)); E.aciertos++;
          const pts = B.T.pts * E.mult; E.puntos += pts;
          chispas.soltar(B.G0.position, B.tipo === 'oro' ? 40 : 24, B.tipo === 'oro' ? 6 : 4);
          E.eventos.push({ tipo: 'pop', p: B.G0.position.clone(), pts, mult: E.mult, oro: B.tipo === 'oro', subeRacha: E.racha % 4 === 0 && E.mult > 1 });
          return B;
        }
      }
      return null;
    },
    /* una burbuja que se perdió sin pegar: se corta la racha */
    fallo() { if (E.fase === 'juega' && E.racha) { E.racha = 0; E.mult = 1; E.eventos.push({ tipo: 'corta' }); } },
    contarTiro() { if (E.fase === 'juega') E.tiros++; },
    reiniciar(yo) {
      Object.assign(E, { fase: 'cuenta', cuenta: 3.4, tiempo: TIRO.dur, puntos: 0, racha: 0, mult: 1, aciertos: 0, tiros: 0 });
      for (const B of blancos) { B.vivo = false; B.G0.visible = false; }
      if (yo) yo.ponerEn(inicio, Math.PI);
    },
    actualizar(dt, jp, cielo) {
      tt += dt;
      if (E.fase === 'cuenta') { E.cuenta -= dt; if (E.cuenta <= 0.4) { E.fase = 'juega'; E.eventos.push({ tipo: 'ya' }); } }
      else if (E.fase === 'juega') {
        E.tiempo = Math.max(0, E.tiempo - dt);
        if (E.tiempo <= 0) { E.fase = 'fin'; E.eventos.push({ tipo: 'fin', puntos: E.puntos, aciertos: E.aciertos, tiros: E.tiros }); for (const B of blancos) if (B.vivo) { B.vivo = false; B.G0.visible = false; } }
        /* que siempre haya: más seguido y más dorados al final */
        tNuevo -= dt;
        const quiere = E.tiempo < 20 ? 8 : 6;
        if (tNuevo <= 0 && vivos() < quiere) {
          tNuevo = E.tiempo < 20 ? 0.35 : 0.6;
          const sorteo = r(), tipo = sorteo < (E.tiempo < 20 ? 0.22 : 0.1) ? 'oro' : sorteo < 0.45 ? 'rosa' : 'azul';
          const B = blancos.find((q) => !q.vivo && q.tipo === tipo) || blancos.find((q) => !q.vivo);
          if (B) aparecer(B);
        }
      }
      /* los blancos: una curva de Lissajous alrededor de su centro; crecen al salir y suben al irse */
      for (const B of blancos) {
        if (!B.vivo) continue;
        B.t += dt; const v = B.T.vel, [f1, f2, A] = B.f;
        B.esc = Math.min(1, B.esc + dt * 4);
        const sale = B.t > B.vida ? (B.t - B.vida) : 0;
        B.G0.position.set(B.c.x + Math.sin(B.t * v + f1) * A, B.c.y + Math.sin(B.t * v * 1.3 + f2) * A * 0.5 + sale * 4, B.c.z + Math.cos(B.t * v * 0.7 + f1) * A * 0.4);
        B.G0.scale.setScalar(B.esc * (1 - Math.min(1, sale)) + 0.001);
        if (sale > 1) { B.vivo = false; B.G0.visible = false; }
        /* la cara mira al balcón */
        B.cara.lookAt(jp.x, jp.y + 1.4, jp.z);
      }
      for (const b of deco) { const u = b.userData; u.y = (u.y + dt * u.v) % 70; u.a += dt * 0.02; b.position.set(Math.sin(u.a) * u.d, u.y - 5, Math.cos(u.a) * u.d); }
      chispas.actualizar(dt);
    },
  };
}
