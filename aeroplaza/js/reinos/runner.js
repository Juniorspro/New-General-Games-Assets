/* ============================================================================
   aeroplaza/js/reinos/runner.js — RUNNER · AERO.EXE, el juego de correr de la
   Zona de Juegos (su puerta, al lado de la del parkour). Un solo nivel.
   - Se corre solo, rápido (17 m/s) y con el campo de visión abierto; el palito
     (o A/D) va de costado, saltar salta (dos veces en el aire) y bajar desliza.
   - Plataformas largas y anchas, bien separadas, sobre un mar Frutiger. Hay que
     saltar los huecos, deslizarse por debajo de las compuertas, saltar las
     vallas, esquivar las paredes y los cubos que se corren al ritmo, pasar por
     los aros (empujan) y pisar los trampolines (los huecos más largos).
   - Hay que llegar al portal antes de que termine la canción (el breakcore
     'runner', que suena solo acá): RUNNER.limite segundos.
   - Todo arranca Frutiger normal y se va rompiendo con la canción: al principio
     nada; en el drop (≈19 s) empiezan los glitches y al final no queda nada
     sano (texturas que faltan, vértices que saltan, el cielo que se apaga,
     ventanas de error, lluvia de píxeles, la pantalla que se corta). Al llegar,
     todo vuelve a ser Frutiger de golpe.
   - Los golpes siguen a la canción de verdad: PULSOS y ENERGIA salen del
     análisis del mp3 (cada 50 ms y cada 100 ms, de 0 a 9); sin la canción (la
     versión pública no la trae) se usan igual, con el reloj.
   main.js: seguirRunner() (los eventos, el aviso de fin), la cámara fija atrás
   (camYaw), glitch y velFx para la pasada final, fovExtra.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mundo, azar } from '../mundo.js';
import { brilloso, materialVidrio, materialBurbuja, UNI } from '../naturaleza.js';
import { Burbujas, Chispas } from '../objetos.js';
import { sumar, t } from '../textos.js';

sumar({
  es: { reino_runner: 'Runner · Aero.exe', rn_titulo: 'Aero.exe', rn_desc: 'Corré hasta el portal antes de que termine la canción', rn_fin: '¡Llegaste!', rn_tarde: 'Se terminó la canción', rn_tiempo: 'Tiempo', rn_sobra: 'Te sobró', rn_llegaste: 'Llegaste al', rn_golpes: 'Golpes', rn_caidas: 'Caídas',
    rn_ayuda: '⬅ ➡ de costado · saltar (dos veces) · bajar = deslizarse', rn_error: 'aeroplaza.exe dejó de funcionar', rn_error2: 'Error 0x000F7A: el cielo no responde', rn_error3: 'No se encontró la textura', rn_cerrar: 'Cerrar programa' },
  en: { reino_runner: 'Runner · Aero.exe', rn_titulo: 'Aero.exe', rn_desc: 'Run to the portal before the song ends', rn_fin: 'You made it!', rn_tarde: 'The song is over', rn_tiempo: 'Time', rn_sobra: 'Time left', rn_llegaste: 'You reached', rn_golpes: 'Hits', rn_caidas: 'Falls',
    rn_ayuda: '⬅ ➡ sideways · jump (twice) · down = slide', rn_error: 'aeroplaza.exe has stopped working', rn_error2: 'Error 0x000F7A: the sky is not responding', rn_error3: 'Texture not found', rn_cerrar: 'Close program' },
  pt: { reino_runner: 'Runner · Aero.exe', rn_titulo: 'Aero.exe', rn_desc: 'Corra até o portal antes que a música acabe', rn_fin: 'Você chegou!', rn_tarde: 'A música acabou', rn_tiempo: 'Tempo', rn_sobra: 'Sobrou', rn_llegaste: 'Você chegou a', rn_golpes: 'Batidas', rn_caidas: 'Quedas',
    rn_ayuda: '⬅ ➡ de lado · pular (duas vezes) · abaixar = deslizar', rn_error: 'aeroplaza.exe parou de funcionar', rn_error2: 'Erro 0x000F7A: o céu não responde', rn_error3: 'Textura não encontrada', rn_cerrar: 'Fechar programa' },
});

/* limite: lo que dura la canción hasta que se apaga; estrellas: segundos que sobran para 3 y para 2 */
export const RUNNER = { limite: 63.5, vel: 17, estrellas: [8, 4] };
/* la canción, analizada (herramienta: el análisis de onsets de la sesión 9; ver memoria/aeroplaza.md) */
const PULSOS = '04911911511211242242139322334223623333332212227452223622322852261222223222222933333543283244235333326212322353432349225332232532522242333337325223422322231241162223119211100913249281254432223222621323' +
  '24326213444415862242363224253232422633253343322219233342734742253343524334234733434434262364325224332322922233442498223335321533422293443336439344243434423253394224456243622535355342353226333242521722' +
  '39227313422222322232235335345454444546365454544555555454643434345363535443453655446544545563644535545545544553455444445445464634434544364545545435444434542253345334334554554623233263325525335333632544' +
  '27333534722543353354263334235323523734333492524333333653233434282553323232332552622222332265224257321533322242162124326224642623423252333333234323822424462252443238326333434533374553334436345544433533' +
  '39224343423722352352244234336422623632242342333224015311624612151141116217142511511431163162215115121622601251151344215115311512714151161115215213511311633171161114114131521611151151255415118311531432' +
  '15125112742613451141153416125211411512164161136114315321711521152251223022121521501341262232024116211821301251272224035215821502322182130124116111302511382141142035214212211406170260122116113302311542' +
  '2403511152292224036224922312542372252133225222704522352230255127225222402722251222116216216513222342232233223323343344433443344444333453344299';
const ENERGIA = '01224212332423214242332523322143321333322222433223324322232432222242333323222234621520343353454444445443333533333343343336334333443444443233444334435433343443333354344334444354532423344333443335445565' +
  '44377544545577545765555565467677775556587755676656665556667676466664565575454663457776665544456653366544575455654654554555543555534545545545766553443663556445454654545474454555554355645545544565565554' +
  '56456565476544536444455853238333293343338233393433855327533376334427533332898575334823339325334823339333384432843337543443744333333366222573224822322583234822329222293322843223293332229987522267322582' +
  '23226732357222482222932228432222933322323285211111000000000000000002224';
export const pulsoEn = (s) => { const c = PULSOS.charCodeAt(Math.floor(s * 20)); return c >= 48 && c <= 57 ? (c - 48) / 9 : 0.2; };
export const energiaEn = (s) => { const c = ENERGIA.charCodeAt(Math.floor(s * 10)); return c >= 48 && c <= 57 ? (c - 48) / 9 : 0.4; };
/* cuánto está roto todo, según el segundo de la canción (0 sano, 1 nada sano) */
export function corrupcionEn(s) {
  if (s < 16) return 0;
  if (s < 19) return 0.04 * (s - 16) / 3;
  if (s < 21) return 0.04 + 0.26 * (s - 19) / 2;       // el drop
  if (s < 43) return 0.3 + 0.32 * (s - 21) / 22;
  if (s < 58) return 0.62 + 0.33 * (s - 43) / 15;
  return Math.min(1, 0.95 + (s - 58) * 0.02);
}

/* la miniatura: la mitad Frutiger y la otra mitad rota */
export function miniaturaRunner(W = 320, H = 200) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cielo = g.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, '#39b8f0'); cielo.addColorStop(0.55, '#dff8ff'); cielo.addColorStop(0.56, '#6fe0f0'); cielo.addColorStop(1, '#1f9fd8');
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  /* la pista en perspectiva */
  const pista = (x0, x1, y0, y1, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(W / 2 - x0, y0); g.lineTo(W / 2 + x0, y0); g.lineTo(W / 2 + x1, y1); g.lineTo(W / 2 - x1, y1); g.fill(); };
  pista(W * 0.08, W * 0.42, H * 0.5, H, '#ffffff'); pista(W * 0.08, W * 0.42, H * 0.5, H * 0.53, '#7fe6ff');
  g.fillStyle = '#bff0ff'; for (let i = 0; i < 5; i++) { const y = H * (0.6 + i * 0.09), w = W * (0.04 + i * 0.03); g.beginPath(); g.moveTo(W / 2 - w, y + 8 + i * 2); g.lineTo(W / 2, y); g.lineTo(W / 2 + w, y + 8 + i * 2); g.lineTo(W / 2 + w, y + 14 + i * 3); g.lineTo(W / 2, y + 6 + i); g.lineTo(W / 2 - w, y + 14 + i * 3); g.fill(); }
  for (const [x, y, r] of [[0.15, 0.25, 14], [0.3, 0.12, 8], [0.12, 0.6, 10]]) { const gr = g.createRadialGradient(x * W - r * 0.3, y * H - r * 0.3, 1, x * W, y * H, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(160,230,255,0.5)'); g.fillStyle = gr; g.beginPath(); g.arc(x * W, y * H, r, 0, 7); g.fill(); }
  /* la mitad derecha, rota: tablero rosa y negro, franjas corridas y separación de colores */
  g.save(); g.beginPath(); g.moveTo(W * 0.55, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.42, H); g.closePath(); g.clip();
  g.fillStyle = '#0a0014'; g.fillRect(0, 0, W, H);
  const T = 12; for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) if ((x / T + y / T) % 2 < 1 && Math.sin(x * 0.07 + y * 0.13) > -0.2) { g.fillStyle = '#ff00dc'; g.fillRect(x, y, T, T); }
  for (let i = 0; i < 9; i++) { const y = (i * 37) % H, h = 4 + (i * 7) % 12; g.drawImage(c, 0, y, W, h, (i % 2 ? 14 : -18), y, W, h); }
  g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(0,255,255,0.25)'; g.fillRect(W * 0.6, H * 0.2, W * 0.3, 6); g.fillStyle = 'rgba(255,0,80,0.3)'; g.fillRect(W * 0.5, H * 0.7, W * 0.5, 5);
  g.restore();
  g.font = `900 ${Math.round(H * 0.16)}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#1a3a6a'; g.strokeText('AERO.EXE', W / 2, H * 0.2); g.fillStyle = '#ffffff'; g.fillText('AERO.EXE', W / 2, H * 0.2);
  g.fillStyle = 'rgba(255,0,220,0.6)'; g.fillText('AERO.EXE', W / 2 + 3, H * 0.2 + 1);
  return c;
}

/* ---------------------------------------------------------------- lo roto */
/* los uniformes de lo roto (los comparten todos los materiales del runner) */
const GL = { uC: { value: 0 }, uPulso: { value: 0 } };
const GLSL_AZAR = 'float gAzar(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }';
/* a un material de three le agrega lo roto: vértices que saltan en bloques, la
   textura que falta (tablero rosa y negro), menos colores y franjas */
function corromper(m) {
  const prev = m.onBeforeCompile, clave = m.customProgramCacheKey();
  m.customProgramCacheKey = () => clave + '|roto';
  m.onBeforeCompile = (s, r) => {
    if (prev) prev(s, r);
    s.uniforms.uC = GL.uC; s.uniforms.uPulso = GL.uPulso; s.uniforms.uT = UNI.uT;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uC, uPulso, uT; varying vec3 vGq; ${GLSL_AZAR}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 gW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGq = gW;
        if (uC > 0.001) {
          float gq = floor(uT * 9.0), gh = gAzar(floor(gW.xz / 3.0) + gq * 0.37);
          if (gh < uC * 0.16 + uPulso * uC * 0.22) transformed += normal * (gh * 4.0 - 0.3) * 0.45 * uC;
          transformed.x += sin(gW.y * 18.0 + uT * 50.0) * 0.05 * uPulso * uC;
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uC, uPulso, uT; varying vec3 vGq; ${GLSL_AZAR}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uC > 0.001) {
          float gt = floor(uT * 7.0), g1 = gAzar(floor(vGq.xz / 2.5) + floor(vGq.y / 2.5) * 7.1 + gt * 1.7);
          if (g1 < uC * 0.34) { float ch = mod(floor(vGq.x * 2.0) + floor(vGq.z * 2.0) + floor(vGq.y * 2.0), 2.0); gl_FragColor.rgb = mix(gl_FragColor.rgb, ch > 0.5 ? vec3(1.0, 0.0, 0.86) : vec3(0.03, 0.0, 0.06), 0.9); }
          float nv = mix(40.0, 3.0, uC * uC); gl_FragColor.rgb = floor(gl_FragColor.rgb * nv + 0.5) / nv;
          float fr = step(0.82, fract(vGq.y * 1.3 - uT * 2.6)) * uC;
          gl_FragColor.rgb += vec3(0.25, 0.0, 0.5) * fr * 0.4;
          if (uPulso * uC > 0.55 && g1 > 0.82) gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;
        }`);
  };
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* las ventanas de error (estilo Aero de 2007, claro) */
function texError(titulo, texto, boton) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const vid = g.createLinearGradient(0, 0, 0, 256); vid.addColorStop(0, 'rgba(190,230,255,0.95)'); vid.addColorStop(0.2, 'rgba(120,190,240,0.9)'); vid.addColorStop(0.21, 'rgba(90,160,220,0.9)'); vid.addColorStop(1, 'rgba(150,210,250,0.9)');
  rr(4, 4, 504, 248, 18); g.fillStyle = vid; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.fillStyle = '#ffffff'; g.font = '700 26px sans-serif'; g.fillText(titulo, 22, 38);
  const x = g.createLinearGradient(0, 12, 0, 40); x.addColorStop(0, '#ff9a8a'); x.addColorStop(1, '#d42a1a'); rr(440, 12, 56, 28, 6); g.fillStyle = x; g.fill(); g.fillStyle = '#fff'; g.font = '900 22px sans-serif'; g.fillText('✕', 457, 35);
  rr(16, 56, 480, 184, 8); g.fillStyle = '#f4f8fc'; g.fill();
  g.fillStyle = '#e8322a'; g.beginPath(); g.arc(64, 118, 28, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 36px sans-serif'; g.fillText('✕', 50, 131);
  g.fillStyle = '#1a2a4a'; g.font = '600 21px sans-serif';
  const pal = texto.split(' '); let lin = '', y = 104;
  for (const p of pal) { if (g.measureText(lin + p).width > 380) { g.fillText(lin, 108, y); lin = ''; y += 28; } lin += p + ' '; } g.fillText(lin, 108, y);
  const b = g.createLinearGradient(0, 190, 0, 224); b.addColorStop(0, '#ffffff'); b.addColorStop(1, '#d8e8f4'); rr(300, 188, 180, 38, 6); g.fillStyle = b; g.fill(); g.strokeStyle = '#7a9ab8'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#1a2a4a'; g.font = '600 18px sans-serif'; g.textAlign = 'center'; g.fillText(boton, 390, 213);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
/* la textura de la pista: blanca con flechas celestes (se repite) */
function texPista() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const f = g.createLinearGradient(0, 0, 256, 0); f.addColorStop(0, '#eaf8ff'); f.addColorStop(0.5, '#ffffff'); f.addColorStop(1, '#eaf8ff'); g.fillStyle = f; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(111,214,255,0.55)'; g.beginPath(); g.moveTo(40, 170); g.lineTo(128, 90); g.lineTo(216, 170); g.lineTo(216, 206); g.lineTo(128, 126); g.lineTo(40, 206); g.fill();
  g.fillStyle = 'rgba(67,216,205,0.8)'; g.fillRect(0, 0, 10, 256); g.fillRect(246, 0, 10, 256);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; return tx;
}

/* ---------------------------------------------------------------- el nivel */
/* cada tramo: [largo, { hueco antes, dy, dx, ancho, estilo, cosas }]. Las cosas van a
   z (metros desde el principio del tramo): valla (saltar), puerta (deslizarse),
   muro (esquivar: lado -1 izquierda, 1 derecha, 0 el medio), cubos (se corren),
   aro (empuja), trampolin (al final: para el hueco largo que sigue) */
const TRAMOS = [
  [56, { ancho: 16, cosas: [['valla', 34]] }],
  [44, { hueco: 8, cosas: [['puerta', 22]] }],
  [38, { hueco: 9, dy: 1, cosas: [['muro', 12, -1], ['muro', 27, 1]] }],
  [34, { hueco: 11, dy: -2, cosas: [['valla', 10], ['puerta', 25]] }],
  [30, { hueco: 9, ancho: 11, estilo: 'vidrio', cosas: [['aro', 13], ['trampolin']] }],
  [44, { hueco: 21, dy: -3, ancho: 16, cosas: [['muro', 15, 0], ['cubos', 32]] }],
  /* el drop: acá se empieza a romper todo */
  [30, { hueco: 7, dy: 1.5, ancho: 12, estilo: 'vidrio', cosas: [['puerta', 16]] }],
  [38, { hueco: 12, dy: -1, cosas: [['cubos', 13], ['cubos', 27]] }],
  [22, { hueco: 8, ancho: 9, estilo: 'vidrio' }],
  [42, { hueco: 15, dy: -2, cosas: [['muro', 12, -1], ['muro', 26, 1], ['puerta', 38]] }],
  [30, { hueco: 9, dy: 1, cosas: [['aro', 7], ['valla', 14], ['trampolin']] }],
  [34, { hueco: 22, dy: -2, ancho: 15, cosas: [['cubos', 16]] }],
  [20, { hueco: 11, ancho: 8, estilo: 'vidrio' }],
  [20, { hueco: 11, ancho: 8, dx: 3, estilo: 'vidrio' }],
  [20, { hueco: 11, ancho: 8, dx: -5, estilo: 'vidrio' }],
  [44, { hueco: 9, dx: 2, ancho: 16, cosas: [['puerta', 12], ['muro', 26, 0], ['puerta', 38]] }],
  /* lo último: casi nada sano */
  [30, { hueco: 13, dy: -1, cosas: [['cubos', 10], ['puerta', 22]] }],
  [26, { hueco: 10, estilo: 'vidrio', cosas: [['aro', 10], ['trampolin']] }],
  [40, { hueco: 20, dy: -1, cosas: [['muro', 11, -1], ['muro', 25, 1]] }],
  [50, { hueco: 12, dy: 1, ancho: 16, cosas: [['cubos', 13], ['meta', 40]] }],
];

export function crearRunner(ctx) {
  const Y0 = 40;
  const mundo = new Mundo(() => -500); mundo.agua = null; mundo.limite = 3000; mundo.gravedad = 21; mundo.corre = RUNNER.vel; mundo.acelAire = 26;
  const g = new THREE.Group(), r = azar(909);
  const fijo = [];
  /* los materiales (todos con lo roto) */
  const tp = texPista();
  const matPista = corromper(brilloso('#ffffff', { map: tp, roughness: 0.18, borde: 0.35 }));
  const matVidrio = corromper(materialVidrio('#c8f4ff', 0.55));
  const matBajo = corromper(materialVidrio('#9fe0ff', 0.4));
  const matAqua = corromper(brilloso('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.55, roughness: 0.15 }));
  const matRosa = corromper(brilloso('#ff6fb0', { emissive: '#ff2f8a', emissiveIntensity: 0.4, roughness: 0.15 }));
  const matBlanco = corromper(brilloso('#ffffff', { roughness: 0.15 }));
  const matVerde = corromper(brilloso('#56d05a', { roughness: 0.3, borde: 0.4 }));
  const matArena = corromper(brilloso('#fff1c8', { roughness: 0.6 }));
  const matPanel = corromper(materialVidrio('#bff0ff', 0.35)); matPanel.side = THREE.DoubleSide;
  const matAviso = corromper(brilloso('#ffd23f', { emissive: '#ff9d00', emissiveIntensity: 0.35 }));

  /* ------------------------------------------ la pista */
  const tramos = [], obst = [], aros = [], cubos = [], bordes = [];
  let z = 0, y = Y0, x = 0, meta = null;
  for (const [largo, o] of TRAMOS) {
    z += o.hueco || 0; y += o.dy || 0; x += o.dx || 0;
    const w = o.ancho || 13, alto = 1.3, z0 = z, z1 = z + largo, zc = (z0 + z1) / 2;
    const geo = new RoundedBoxGeometry(w, alto, largo, 3, 0.35);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 6.5, uv.getY(i) * largo / 6.5);
    const q = new THREE.Mesh(geo, o.estilo === 'vidrio' ? matVidrio : matPista); q.position.set(x, y - alto / 2, zc); q.receiveShadow = true; q.castShadow = true;
    if (o.estilo === 'vidrio') q.renderOrder = 3;
    g.add(q);
    /* el borde celeste que brilla y la panza de vidrio */
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, largo - 0.6), matAqua); b.position.set(x + s * (w / 2 - 0.1), y + 0.02, zc); g.add(b); }
    const panza = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.12, 3.2, 6, 1).scale(1, 1, largo / w * 0.9), matBajo); panza.position.set(x, y - alto - 1.6, zc); panza.renderOrder = 3; g.add(panza);
    mundo.caja(x, zc, w / 2, largo / 2, y - alto, y, 0, { tipo: 'piedra' });
    const T = { x, y, z0, z1, w, cosas: [] };
    tramos.push(T);
    bordes.push(geo.clone().translate(x, y - alto / 2, zc));
    for (const [tipo, dz, lado] of o.cosas || []) {
      const zz = z0 + (dz ?? largo - 2.5);
      if (tipo === 'valla') {
        /* la valla: baja, de lado a lado (se salta) */
        const v = new THREE.Mesh(new RoundedBoxGeometry(w - 0.6, 0.85, 0.5, 2, 0.12), matRosa); v.position.set(x, y + 0.425, zz); v.castShadow = true; g.add(v);
        for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.52), matBlanco); f.position.set(x - w / 2 + 1.5 + k * (w - 3) / 4, y + 0.55, zz); g.add(f); }
        obst.push({ tipo, x0: x - w / 2, x1: x + w / 2, z: zz, dz: 0.3, y0: y, y1: y + 0.85, malla: v, tGhost: 0 });
      } else if (tipo === 'puerta') {
        /* la compuerta: un vidrio de lado a lado que deja un hueco abajo (se pasa deslizándose) */
        const p = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 2.8, 0.25), matPanel); p.position.set(x, y + 1.0 + 1.4, zz); p.renderOrder = 3; g.add(p);
        const franja = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.22, 0.3), matAviso); franja.position.set(x, y + 1.08, zz); g.add(franja);
        for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.2, 12), matBlanco); c.position.set(x + s * (w / 2 - 0.2), y + 2.1, zz); g.add(c); }
        for (let k = 0; k < 3; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 3), matAviso); fl.rotation.x = Math.PI; fl.position.set(x + (k - 1) * 2.2, y + 1.75, zz - 0.2); g.add(fl); }
        obst.push({ tipo, x0: x - w / 2, x1: x + w / 2, z: zz, dz: 0.25, y0: y + 1.0, y1: y + 3.8, malla: p, tGhost: 0 });
      } else if (tipo === 'muro') {
        /* la pared: tapa un tercio (o la mitad) de la pista, con una ventana Aero */
        const ancho = lado === 0 ? w * 0.4 : w * 0.5, cx = lado === 0 ? x : x + lado * (w / 2 - ancho / 2);
        const m = new THREE.Mesh(new RoundedBoxGeometry(ancho, 3.6, 0.9, 2, 0.2), matPanel); m.position.set(cx, y + 1.8, zz); m.renderOrder = 3; g.add(m);
        const marco = new THREE.Mesh(new RoundedBoxGeometry(ancho + 0.1, 0.3, 1.0, 2, 0.1), matAqua); marco.position.set(cx, y + 3.55, zz); g.add(marco);
        obst.push({ tipo, x0: cx - ancho / 2, x1: cx + ancho / 2, z: zz, dz: 0.45, y0: y, y1: y + 3.6, malla: m, tGhost: 0 });
      } else if (tipo === 'cubos') {
        /* dos cubos que se cambian de carril al ritmo (cada cuatro golpes, un compás): queda un carril libre */
        for (let k = 0; k < 2; k++) {
          const m = new THREE.Mesh(new RoundedBoxGeometry(2.3, 2.3, 2.3, 2, 0.25), k ? matRosa : matAqua); m.position.set(x, y + 1.15, zz); m.castShadow = true; g.add(m);
          const C = { tipo: 'cubo', x0: 0, x1: 0, z: zz, dz: 1.15, y0: y, y1: y + 2.3, malla: m, tGhost: 0, cx: x, w, k, carril: k ? 1 : -1, xAct: x, y };
          obst.push(C); cubos.push(C);
        }
      } else if (tipo === 'aro') {
        const a = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 12, 40), matAviso); a.position.set(x, y + 2.1, zz); g.add(a);
        const brillo = new THREE.Mesh(new THREE.CircleGeometry(1.95, 32), new THREE.MeshBasicMaterial({ color: '#fff6c2', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })); brillo.position.copy(a.position); g.add(brillo);
        aros.push({ x, y, z: zz, malla: a, brillo, usado: false });
      } else if (tipo === 'trampolin') {
        /* un trampolín de lado a lado al final del tramo */
        const tr = new THREE.Mesh(new RoundedBoxGeometry(w - 1, 0.24, 3.2, 2, 0.1), matRosa); tr.position.set(x, y + 0.08, zz); g.add(tr);
        for (let k = 0; k < 3; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 3), matAviso); fl.rotation.x = -Math.PI / 2; fl.position.set(x + (k - 1) * 2.4, y + 0.3, zz); g.add(fl); }
        mundo.caja(x, zz, (w - 1) / 2, 1.6, y - 0.4, y + 0.18, 0, { rebote: 15.5, sinTecho: true });
      } else if (tipo === 'meta') {
        const G0 = new THREE.Group(); G0.position.set(x, y, zz); g.add(G0);
        const aro = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.4, 16, 64), matAqua); aro.position.y = 4.4; G0.add(aro);
        const portal = new THREE.Mesh(new THREE.CircleGeometry(3.9, 48), new THREE.MeshBasicMaterial({ color: '#bff8ff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); portal.position.y = 4.4; G0.add(portal);
        const aro2 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.08, 8, 64), matBlanco); aro2.position.y = 4.4; G0.add(aro2);
        meta = { p: V(x, y, zz), G0, aro, portal, aro2 };
      }
    }
    z = z1;
  }
  const largoTotal = meta ? meta.p.z : z;
  const inicio = V(tramos[0].x, Y0 + 0.05, 7);

  /* ------------------------------------------ lo Frutiger de alrededor */
  /* el mar: celeste, con brillos que se mueven (y que se rompe también) */
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uT: UNI.uT, uC: GL.uC, uPulso: GL.uPulso },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
    fragmentShader: `uniform float uT, uC, uPulso; varying vec3 vP; ${GLSL_AZAR}
      void main(){ vec2 q = vP.xz * 0.05; float c = pow(abs(sin(q.x + sin(q.y + uT * 0.6) * 1.5) * sin(q.y * 1.2 + sin(q.x * 0.7 - uT * 0.5))), 6.0);
        float d = clamp(length(vP.xz - vec2(0.0, 450.0)) / 1400.0, 0.0, 1.0);
        vec3 col = mix(vec3(0.12, 0.66, 0.95), vec3(0.8, 0.98, 1.0), c * 0.75); col = mix(col, vec3(0.78, 0.94, 1.0), d * d);
        if (uC > 0.001) {
          vec2 cel = floor(vP.xz / 12.0); float h = gAzar(cel + floor(uT * 6.0));
          vec2 gr = abs(fract(vP.xz / 12.0) - 0.5); float linea = step(0.47, max(gr.x, gr.y));
          vec3 roto = mix(vec3(0.02, 0.0, 0.05), vec3(1.0, 0.0, 0.8), linea * (0.5 + 0.5 * uPulso));
          if (h < uC * 0.4) roto = mod(cel.x + cel.y, 2.0) > 0.5 ? vec3(1.0, 0.0, 0.86) : vec3(0.0);
          col = mix(col, roto, smoothstep(0.1, 0.9, uC));
        }
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  mar.position.y = 0; g.add(mar);
  /* islas con palmeras y cerros de vidrio a los costados */
  for (let i = 0; i < 18; i++) {
    const lado = i % 2 ? 1 : -1, zz = (i / 18) * (largoTotal + 200) - 60 + r() * 30, xx = lado * (70 + r() * 150), s = 10 + r() * 16;
    const isla = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), matVerde); isla.scale.y = 0.42; isla.position.set(xx, 0, zz); g.add(isla);
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.12, s * 1.2, 0.8, 28), matArena); arena.position.set(xx, -0.2, zz); g.add(arena);
    for (let k = 0; k < 3; k++) {
      const tx = xx + (r() - 0.5) * s * 0.9, tz = zz + (r() - 0.5) * s * 0.9, h = s * (0.55 + r() * 0.3);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h, 8), corromper(brilloso('#d8a070'))); tr.position.set(tx, s * 0.3 + h / 2, tz); tr.rotation.z = (r() - 0.5) * 0.3; g.add(tr);
      for (let j = 0; j < 5; j++) { const hoja = new THREE.Mesh(new THREE.SphereGeometry(s * 0.2, 10, 6), matVerde); hoja.scale.set(1.6, 0.3, 0.6); const a = j / 5 * 6.28; hoja.position.set(tx + Math.cos(a) * s * 0.22, s * 0.3 + h, tz + Math.sin(a) * s * 0.22); hoja.rotation.y = -a; hoja.rotation.z = -0.35; g.add(hoja); }
    }
  }
  for (let i = 0; i < 10; i++) {
    const lado = i % 2 ? -1 : 1, zz = i / 10 * largoTotal + r() * 40, xx = lado * (45 + r() * 50);
    const cerro = new THREE.Mesh(new THREE.SphereGeometry(18 + r() * 14, 28, 16), matVidrio); cerro.scale.y = 1.5; cerro.position.set(xx, -4, zz); cerro.renderOrder = 3; g.add(cerro);
  }
  /* burbujas grandes que flotan cerca de la pista */
  const orbes = [];
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.8 + r() * 2.2, 22, 14), materialBurbuja(0.9)); b.renderOrder = 4;
    const lado = r() < 0.5 ? -1 : 1; b.userData = { x: lado * (11 + r() * 22), y: Y0 - 6 + r() * 22, z: r() * largoTotal, f: r() * 6.28 };
    g.add(b); orbes.push(b);
  }
  const burbujas = new Burbujas(g, tramos.filter((_, i) => i % 2 === 0).map((T) => [T.x, 2, (T.z0 + T.z1) / 2, 18]), { n: 90, alto: Y0 + 10, tam: [0.3, 1.1] });
  const chispas = new Chispas(g, '#ffffff', 160);

  /* ------------------------------------------ lo roto que aparece encima */
  /* el cielo apagado: una esfera oscura con una cuadrícula que se enciende con lo roto */
  const vacio = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uT: UNI.uT, uC: GL.uC, uPulso: GL.uPulso }, side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uC, uPulso; varying vec3 vD; ${GLSL_AZAR}
      void main(){ vec2 q = vec2(atan(vD.x, vD.z) * 12.0, vD.y * 24.0); vec2 gr = abs(fract(q) - 0.5);
        float linea = step(0.46, max(gr.x, gr.y)); float h = gAzar(floor(q * 0.5) + floor(uT * 5.0));
        vec3 col = vec3(0.03, 0.0, 0.07) + vec3(0.9, 0.0, 0.8) * linea * (0.35 + uPulso * 0.5);
        if (h > 0.985 - uC * 0.03) col = vec3(0.0, 1.0, 0.9);
        float banda = step(0.93, fract(vD.y * 8.0 - uT * 0.7));
        col += vec3(0.3, 0.0, 0.4) * banda;
        float a = smoothstep(0.0, 1.0, uC * 1.25 - 0.1) * (0.94 - 0.2 * step(0.5, fract(uT * 13.0)) * uPulso);
        gl_FragColor = vec4(col, a); }`,
  }));
  vacio.renderOrder = -1; g.add(vacio);
  /* el eco de alambre de las plataformas (salta de lugar en bloques) */
  const aristas = new THREE.EdgesGeometry(mergeGeometries(bordes.map((b) => { const q = b.clone(); q.deleteAttribute('uv'); q.deleteAttribute('normal'); return q; })), 30);
  const eco = new THREE.LineSegments(aristas, new THREE.ShaderMaterial({
    uniforms: { uT: UNI.uT, uC: GL.uC, uPulso: GL.uPulso }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uT, uC, uPulso; varying float vK; ${GLSL_AZAR}
      void main(){ vec3 p = position; float b = floor(p.z / 9.0), q = floor(uT * 8.0); vK = gAzar(vec2(b, q));
        p += (vec3(gAzar(vec2(b, q + 1.0)), gAzar(vec2(b, q + 2.0)), 0.0) - 0.5) * vec3(3.0, 2.0, 0.0) * uC * (0.6 + uPulso);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform float uC; varying float vK; void main(){ gl_FragColor = vec4(vK > 0.5 ? vec3(1.0, 0.0, 0.85) : vec3(0.0, 1.0, 0.95), smoothstep(0.25, 0.6, uC) * step(0.35, vK)); }',
  }));
  g.add(eco);
  /* las ventanas de error: cada una aparece cuando lo roto pasa su umbral */
  const errores = [];
  const texs = [texError('Aero.exe', t('rn_error'), t('rn_cerrar')), texError('Aero.exe', t('rn_error2'), 'OK'), texError('explorer', t('rn_error3'), t('rn_cerrar'))];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: texs[i % 3], transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const zz = largoTotal * (0.3 + 0.7 * (i / 22)) + r() * 20, lado = i % 2 ? 1 : -1;
    m.position.set(lado * (10 + r() * 9), Y0 + 3 + r() * 9, zz); m.rotation.y = Math.PI + lado * (0.35 + r() * 0.3); m.renderOrder = 5; m.visible = false; g.add(m);
    errores.push({ m, umbral: 0.3 + (i / 22) * 0.6, base: m.position.clone(), f: r() * 9 });
  }
  /* la lluvia de píxeles (alrededor del jugador) */
  const NP = 140, pix = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), NP);
  pix.frustumCulled = false; g.add(pix);
  const pxs = []; const colsPix = ['#ff00dc', '#00ffe6', '#ffffff', '#39ff14', '#000000'].map((c) => new THREE.Color(c));
  for (let i = 0; i < NP; i++) { pxs.push({ x: (r() - 0.5) * 60, y: r() * 30, z: r() * 90, v: 6 + r() * 14, s: 0.4 + r() * 1.2 }); pix.setColorAt(i, colsPix[i % colsPix.length]); }
  const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();

  /* ------------------------------------------ el estado */
  const E = { fase: 'cuenta', cuenta: 3.4, tiempo: 0, caidas: 0, golpes: 0, control: inicio.clone(), prog: 0, aturdido: 0, boost: 0, eventos: [], limite: RUNNER.limite, fin: null, largo: largoTotal - inicio.z, restaura: 0 };
  let tt = 0, pulso = 0, golpeGl = 0, fov = 12, yo = null;
  const tramoEn = (p) => tramos.find((T) => p.z >= T.z0 - 0.5 && p.z <= T.z1 + 0.5 && Math.abs(p.x - T.x) < T.w / 2 + 0.6);
  const R = {
    get reloj() { return tt; },
    id: 'runner', runner: E, mundo, grupo: g, inicio, rumboInicio: 0, musica: 'runner', cielo: { hora: 0.42, arcoiris: 1, aurora: 0, nubes: 1 },
    orbes: null, discos: [], npcs: [], sinZonas: true, camYaw: Math.PI, fovExtra: 12, glitch: 0, velFx: 0, tramos, obst, aros, largoTotal, meta,
    antesDelJugador(dt, y0, Em) {
      yo = y0; tt += dt;
      if (E.fase === 'cuenta') {
        E.cuenta -= dt; yo.p.copy(inicio); yo.v.set(0, 0, 0); yo.rumbo = 0;
        Em.x = 0; Em.z = 0; Em.salta = false; Em.baja = false;
        if (E.cuenta <= 0) { E.fase = 'corre'; E.eventos.push({ tipo: 'ya' }); }
        return;
      }
      if (E.fase === 'corre') {
        E.tiempo += dt;
        if (E.tiempo > E.limite) { E.fase = 'fin'; E.fin = { ok: false, prog: E.prog }; E.eventos.push({ tipo: 'tarde', prog: E.prog, caidas: E.caidas, golpes: E.golpes }); }
      }
      /* se corre solo: el palito (o A/D) solo va de costado; el que corre para adelante es el juego */
      if (E.fase === 'corre' && E.aturdido <= 0) {
        const lat = Math.max(-1, Math.min(1, Em.x)) * 0.62;
        Em.x = lat; Em.z = 1; Em.corre = true;
        mundo.corre = (RUNNER.vel + (E.boost > 0 ? 7 : 0)) * Math.hypot(lat, 1);
      } else if (E.fase === 'corre') { E.aturdido -= dt; Em.x = 0; Em.z = 0; Em.corre = false; }
      else { Em.x *= 0.3; Em.z = 0.25; Em.corre = false; }
      E.boost = Math.max(0, E.boost - dt);
    },
    actualizar(dt, jp) {
      const tm = E.fase === 'cuenta' ? 0 : E.tiempo;
      /* ---- lo roto, con la canción */
      const p0 = pulsoEn(tm + 0.02), en = energiaEn(tm);
      pulso = Math.max(p0 > 0.6 ? p0 : 0, pulso - dt * 7);
      let c = E.fase === 'cuenta' ? 0 : corrupcionEn(tm) * (0.88 + 0.28 * en);
      if (E.fin?.ok) { E.restaura = Math.min(1, E.restaura + dt * 0.9); c *= Math.max(0, 1 - E.restaura * 3); }
      golpeGl = Math.max(0, golpeGl - dt * 2.5);
      GL.uC.value = Math.min(1, c + golpeGl * 0.35); GL.uPulso.value = pulso;
      this.glitch = Math.min(0.85, c * 0.22 + pulso * c * 0.5 + golpeGl * 0.7);
      const fovObj = E.fase === 'corre' ? 12 + (E.boost > 0 ? 12 : 0) + pulso * c * 3 : 4;
      fov += (fovObj - fov) * Math.min(1, dt * 4); this.fovExtra = fov;
      this.velFx = E.fase === 'corre' ? Math.min(1, 0.22 + (E.boost > 0 ? 0.75 : 0) + c * 0.15) : 0;
      /* ---- el avance, los controles y las caídas */
      if (yo && E.fase === 'corre') {
        E.prog = Math.max(E.prog, Math.min(1, (jp.z - inicio.z) / E.largo));
        const T = yo.enPiso ? tramoEn(jp) : null;
        if (T && T.z0 > E.control.z - 1) E.control.set(T.x, T.y + 0.05, T.z0 + 2.5);
        if (jp.y < E.control.y - 11) E.eventos.push({ tipo: 'caida' });
        /* los obstáculos: tocarlos te frena y te tira para atrás (y se vuelven fantasma un ratito) */
        const bajo = yo.mov && (yo.mov.tipo === 'desliza' || yo.mov.tipo === 'rueda'), alto = bajo ? 0.72 : 1.35, RR = 0.34;
        for (const O of obst) {
          if (O.tGhost > 0) continue;
          if (Math.abs(jp.z - O.z) > O.dz + RR || jp.x < O.x0 - RR || jp.x > O.x1 + RR) continue;
          if (jp.y + alto <= O.y0 + 0.02 || jp.y >= O.y1 - 0.02) continue;
          O.tGhost = 1.3; E.golpes++; E.aturdido = 0.42; golpeGl = 1;
          yo.v.set(0, 5.5, -7.5); yo.mov = null; yo.enPiso = false;
          E.eventos.push({ tipo: 'golpe', p: jp.clone().setY(jp.y + 1) });
          break;
        }
        for (const A of aros) if (!A.usado && Math.abs(jp.z - A.z) < 0.8 && Math.hypot(jp.x - A.x, jp.y + 0.8 - A.y - 2.1) < 2.4) { A.usado = true; E.boost = 1.7; chispas.soltar(A.malla.position, 36, 6); E.eventos.push({ tipo: 'aro' }); }
        if (meta && Math.abs(jp.z - meta.p.z) < 1.2 && Math.abs(jp.x - meta.p.x) < 4.5 && jp.y < meta.p.y + 7) {
          E.fase = 'fin'; E.fin = { ok: true }; E.prog = 1; golpeGl = 0;
          chispas.soltar(meta.p.clone().setY(meta.p.y + 4), 90, 9);
          E.eventos.push({ tipo: 'meta', tiempo: E.tiempo, caidas: E.caidas, golpes: E.golpes });
        }
      }
      /* ---- lo que se mueve */
      const beat = 60 / 175;
      for (const C of cubos) {
        /* cada compás (cuatro golpes) cambian de carril, con un salto rápido; antes de moverse titilan */
        const u = tt / (beat * 4), paso = Math.floor(u), obj = ((paso + C.k) % 3) - 1, xObj = C.cx + obj * (C.w / 2 - 1.6);
        C.malla.scale.setScalar(u - paso > 0.85 ? 1 + Math.sin((u - paso) * 60) * 0.06 : 1);
        C.xAct += (xObj - C.xAct) * Math.min(1, dt * 14);
        C.x0 = C.xAct - 1.15; C.x1 = C.xAct + 1.15;
        C.malla.position.set(C.xAct, C.y + 1.15 + Math.abs(Math.sin(tt * 8)) * 0.1, C.z);
        C.malla.rotation.y = tt * 1.5 + C.k;
      }
      for (const O of obst) {
        if (O.tGhost > 0) { O.tGhost -= dt; O.malla.visible = Math.floor(O.tGhost * 18) % 2 === 0; if (O.tGhost <= 0) O.malla.visible = true; }
      }
      for (const A of aros) { A.malla.rotation.z = tt * 2; A.brillo.material.opacity = A.usado ? 0.05 : 0.2 + Math.sin(tt * 5) * 0.08; }
      if (meta) { meta.aro.rotation.z = tt * 0.6; meta.aro2.rotation.z = -tt * 1.1; meta.portal.material.opacity = 0.45 + Math.sin(tt * 3) * 0.12; }
      for (const b of orbes) { const u = b.userData; b.position.set(u.x + Math.sin(tt * 0.4 + u.f) * 2, u.y + Math.sin(tt * 0.7 + u.f) * 1.5, u.z); }
      burbujas.actualizar(dt, jp);
      chispas.actualizar(dt);
      /* ---- lo roto de encima */
      const C = GL.uC.value;
      vacio.position.set(jp.x, 0, jp.z); vacio.visible = C > 0.02;
      eco.visible = C > 0.2;
      for (const W of errores) {
        const ve = C > W.umbral && W.base.z > jp.z - 30 && W.base.z < jp.z + 160;
        W.m.visible = ve && !(pulso > 0.7 && Math.sin(W.f + tt * 30) > 0.3);
        if (ve) { const k = Math.floor(tt * 10 + W.f); W.m.position.set(W.base.x + (k % 3 === 0 ? (Math.sin(k) * 0.8) : 0), W.base.y + Math.sin(tt + W.f) * 0.3, W.base.z); }
      }
      pix.visible = C > 0.45;
      if (pix.visible) {
        const n = Math.floor(NP * Math.min(1, (C - 0.45) * 2.2));
        for (let i = 0; i < NP; i++) {
          const q = pxs[i]; q.y -= q.v * dt; if (q.y < -6) { q.y = 26 + Math.random() * 8; q.x = (Math.random() - 0.5) * 60; q.z = Math.random() * 90; }
          const s = i < n ? q.s * (0.7 + pulso * 0.6) : 0.0001;
          M4.compose(P3.set(jp.x + q.x, jp.y + q.y, jp.z + q.z - 10), Q0, S3.set(s, s, s)); pix.setMatrixAt(i, M4);
        }
        pix.instanceMatrix.needsUpdate = true;
      }
    },
    /* main.js: volver al último control después de caerse */
    reaparecer(y0) { E.caidas++; y0.ponerEn(E.control.clone(), 0); golpeGl = 0.8; chispas.soltar(y0.p.clone().setY(y0.p.y + 1), 24, 3); },
    reiniciar(y0) {
      Object.assign(E, { fase: 'cuenta', cuenta: 3.4, tiempo: 0, caidas: 0, golpes: 0, prog: 0, aturdido: 0, boost: 0, fin: null, restaura: 0 });
      E.control.copy(inicio); for (const A of aros) A.usado = false; for (const O of obst) { O.tGhost = 0; O.malla.visible = true; }
      golpeGl = 0; if (y0) y0.ponerEn(inicio, 0);
    },
  };
  return R;
}
