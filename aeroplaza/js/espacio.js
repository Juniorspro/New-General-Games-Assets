/* ============================================================================
   aeroplaza/js/espacio.js — TU ESPACIO: el cuarto de verdad en el VR, como el
   "Space Setup" de un Meta Quest, con ARCore (la APK).
   1. ESCANEO: se ve la cámara (passthrough) y encima lo que ARCore va
      entendiendo: el piso con su grilla, las paredes, las mesas, el techo, y
      los muebles y objetos en cubitos de 5 cm (Espacio.java). Una tarjeta
      dice qué falta (piso, paredes, mesa, mirar alrededor).
   2. LAS MANOS SOBRE LA MESA: apoyadas, abiertas y quietas. La mesa está a
      una distancia que ARCore MIDE; MediaPipe adivina la distancia de la mano
      por su tamaño (el de una mano promedio). La diferencia es cuánto más
      grande o chica es la mano de quien juega: queda guardada
      (manos.escalaMano) y desde ahí la mano va a la distancia de verdad.
   3. LA PANTALLA: arriba de la mesa, para tocar: jugar, abrir ventanas de
      prueba (ventanas.js) que se quedan en su lugar mientras caminás (6DoF),
      volver a escanear, medir las manos, salir.
   Todo en las coordenadas de ARCore (metros, y para arriba): lo que manda
   Android ya viene ahí, y la cabeza es la pose de ARCore tal cual.
   Se dibuja por ojo (con visor, la pantalla partida), sin el mundo del juego.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar, idioma } from './textos.js';
import { Nativo, poseEn } from './nativo.js';
import { Ventanas, Tablero } from './ventanas.js';
import { PanelLentes, accionLentes } from './lentes.js';

sumar({
  es: { es_buscando: 'Buscando dónde estás…', es_buscando_d: 'Mové el celu despacio, con luz', es_titulo: 'Escaneá tu espacio', es_texto: 'Mirá alrededor despacio: el piso, las paredes y los muebles',
    es_piso: 'Piso', es_paredes: 'Paredes', es_mesa: 'Mesa', es_objetos: 'Objetos', es_alrededor: 'Mirá alrededor', es_listo: 'Listo', es_saltear: 'Saltear', es_salir: 'Salir', es_falta_piso: 'Falta el piso: apuntá para abajo',
    es_m2: '{n} m²', es_cubitos: '{n} cubitos', es_listo_pct: '{n} % listo', es_prof_fotos: '📡 profundidad: {n} fotos · {ms} ms', es_prof_no: '📡 sin profundidad: la malla sale de los planos', es_prof_nada: '📡 esperando la profundidad…', es_prof_prende: '📡 prendiendo el escaneo…', es_prof_err: '⚠ escaneo: {e}', es_prof_sigue: '📡 ARCore no te sigue: mirá cosas con luz y movete despacio', es_planos_n: '{n} planos', es_d_planos: 'planos {a}/{b}', es_d_prof: 'prof {a} (esperando {b})', es_d_suave: 'suavizada', es_d_cfg: 'sesión: planos {a} · prof {b}', es_d_sigue: 'no sigue: {e}', es_d_reconf: 'reconfigurada {n}×', es_d_foto: 'foto {f}', es_d_mitad: 'a la mitad', es_prof_apagada: '⚠ la sesión apagó el escaneo: lo prendo de nuevo', es_sin_prof: 'Tu celu no mide profundidad: los objetos salen de a pocos puntos',
    es_manos_t: 'Apoyá las manos en la mesa', es_manos_d: 'Abiertas, palma para abajo y quietas un segundo', es_sin_mesa: 'No encontré una mesa: apoyalas en cualquier superficie o salteá',
    es_izq: 'Izquierda', es_der: 'Derecha', es_esperando: 'esperando…', es_quieta: 'quieta…', es_medida: 'mide {n} cm', es_seguir: 'Seguir', es_medidas: '✋ Tus manos quedaron medidas (×{k})',
    es_ayuda: 'Tocá la pantalla para seguir · con las manos: tocá o pellizcá', es_piso_ok: 'Piso encontrado', es_pared_ok: 'Pared encontrada', es_mesa_ok: 'Mesa encontrada',
    es_ancha: '📷 Cámara 0,5x', es_cam_ancha: '📷 Cámara 0,5x ({g}°) · girá la cabeza; para caminar, volvé a 1x', es_cam_ancha_off: '🎥 Cámara {g}° (ARCore) · la 0,5x ({m}°) con el botón',
    es_ancha_lista: '📷 0,5x: mirá alrededor girando la cabeza; para caminar, volvé a 1x', es_ancha_espera: '📷 Mové un poco la cabeza para alinear la 0,5x', es_ancha_1x: '🎥 1x con ARCore: podés caminar',
    es_llenar: '🔍 Cámara con aumento', es_linterna: '🔦 Linterna', es_cam_05: '🎥 Cámara 0,5x ({g}°)', es_cam_1: '🎥 Cámara {g}° · el 0,5x ({m}°) ARCore no lo deja usar', es_cam: '🎥 Cámara {g}°',
    es_pantalla_sub: 'Tocá con el dedo o pellizcá', es_escaneo_ok: 'Escaneo guardado', es_perdido: 'ARCore perdió dónde estás: mové el celu despacio',
    vr_ar_texto: '¿Querés usar ARCore? Con ARCore el celu sabe dónde está (6 ejes), como un Quest.', vr_ar_espacio: '📡 Sí: tu espacio', vr_ar_espacio_d: 'Escaneás el cuarto (piso, paredes, muebles), apoyás las manos en la mesa y se abre una pantalla para tocar y ventanas que quedan en su lugar',
    vr_ar_juego: '🎮 Sí, directo al juego', vr_ar_juego_d: 'AEROPLAZA en 6 ejes, sin escanear', vr_ar_no: '🧭 No, sin ARCore', vr_ar_no_d: 'Solo el giroscopio. Las ventanas de prueba se abren en el mundo del juego (menú de la palma)', vr_ar_atras: 'Volver' },
  en: { es_buscando: 'Finding where you are…', es_buscando_d: 'Move your phone slowly, with light', es_titulo: 'Scan your space', es_texto: 'Look around slowly: the floor, the walls and the furniture',
    es_piso: 'Floor', es_paredes: 'Walls', es_mesa: 'Table', es_objetos: 'Objects', es_alrededor: 'Look around', es_listo: 'Done', es_saltear: 'Skip', es_salir: 'Exit', es_falta_piso: 'Floor missing: point down',
    es_m2: '{n} m²', es_cubitos: '{n} voxels', es_listo_pct: '{n} % done', es_prof_fotos: '📡 depth: {n} frames · {ms} ms', es_prof_no: '📡 no depth: the mesh comes from the planes', es_prof_nada: '📡 waiting for depth…', es_prof_prende: '📡 starting the scan…', es_prof_err: '⚠ scan: {e}', es_prof_sigue: '📡 ARCore isn’t tracking you: look at lit things and move slowly', es_planos_n: '{n} planes', es_d_planos: 'planes {a}/{b}', es_d_prof: 'depth {a} (waiting {b})', es_d_suave: 'smoothed', es_d_cfg: 'session: planes {a} · depth {b}', es_d_sigue: 'not tracking: {e}', es_d_reconf: 'reconfigured {n}×', es_d_foto: 'photo {f}', es_d_mitad: 'at half size', es_prof_apagada: '⚠ the session turned the scan off: turning it back on', es_sin_prof: 'Your phone can’t measure depth: objects come from a few points',
    es_manos_t: 'Rest your hands on the table', es_manos_d: 'Open, palms down and still for a second', es_sin_mesa: 'No table found: rest them on any surface or skip',
    es_izq: 'Left', es_der: 'Right', es_esperando: 'waiting…', es_quieta: 'hold still…', es_medida: 'is {n} cm', es_seguir: 'Continue', es_medidas: '✋ Your hands are measured (×{k})',
    es_ayuda: 'Tap the screen to continue · with your hands: touch or pinch', es_piso_ok: 'Floor found', es_pared_ok: 'Wall found', es_mesa_ok: 'Table found',
    es_ancha: '📷 0.5x camera', es_cam_ancha: '📷 0.5x camera ({g}°) · turn your head; to walk, go back to 1x', es_cam_ancha_off: '🎥 Camera {g}° (ARCore) · the 0.5x ({m}°) with the button',
    es_ancha_lista: '📷 0.5x: look around by turning your head; to walk, go back to 1x', es_ancha_espera: '📷 Move your head a little to align the 0.5x', es_ancha_1x: '🎥 1x with ARCore: you can walk',
    es_llenar: '🔍 Zoomed camera', es_linterna: '🔦 Flashlight', es_cam_05: '🎥 0.5x camera ({g}°)', es_cam_1: '🎥 Camera {g}° · ARCore won’t use the 0.5x ({m}°)', es_cam: '🎥 Camera {g}°',
    es_pantalla_sub: 'Touch with your finger or pinch', es_escaneo_ok: 'Scan saved', es_perdido: 'ARCore lost track: move your phone slowly',
    vr_ar_texto: 'Do you want to use ARCore? With ARCore the phone knows where it is (6DoF), like a Quest.', vr_ar_espacio: '📡 Yes: your space', vr_ar_espacio_d: 'Scan the room (floor, walls, furniture), rest your hands on the table, and a touch screen opens with windows that stay in place',
    vr_ar_juego: '🎮 Yes, straight to the game', vr_ar_juego_d: 'AEROPLAZA in 6DoF, no scan', vr_ar_no: '🧭 No, without ARCore', vr_ar_no_d: 'Gyroscope only. Test windows open in the game world (palm menu)', vr_ar_atras: 'Back' },
  pt: { es_buscando: 'Procurando onde você está…', es_buscando_d: 'Mexa o celular devagar, com luz', es_titulo: 'Escaneie seu espaço', es_texto: 'Olhe em volta devagar: o chão, as paredes e os móveis',
    es_piso: 'Chão', es_paredes: 'Paredes', es_mesa: 'Mesa', es_objetos: 'Objetos', es_alrededor: 'Olhe em volta', es_listo: 'Pronto', es_saltear: 'Pular', es_salir: 'Sair', es_falta_piso: 'Falta o chão: aponte para baixo',
    es_m2: '{n} m²', es_cubitos: '{n} cubinhos', es_listo_pct: '{n} % pronto', es_prof_fotos: '📡 profundidade: {n} fotos · {ms} ms', es_prof_no: '📡 sem profundidade: a malha sai dos planos', es_prof_nada: '📡 esperando a profundidade…', es_prof_prende: '📡 ligando o escaneamento…', es_prof_err: '⚠ escaneamento: {e}', es_prof_sigue: '📡 o ARCore não te segue: olhe coisas com luz e mova-se devagar', es_planos_n: '{n} planos', es_d_planos: 'planos {a}/{b}', es_d_prof: 'prof. {a} (esperando {b})', es_d_suave: 'suavizada', es_d_cfg: 'sessão: planos {a} · prof. {b}', es_d_sigue: 'não segue: {e}', es_d_reconf: 'reconfigurada {n}×', es_d_foto: 'foto {f}', es_d_mitad: 'pela metade', es_prof_apagada: '⚠ a sessão desligou o escaneamento: ligando de novo', es_sin_prof: 'Seu celular não mede profundidade: os objetos saem de poucos pontos',
    es_manos_t: 'Apoie as mãos na mesa', es_manos_d: 'Abertas, palma para baixo e paradas um segundo', es_sin_mesa: 'Não achei uma mesa: apoie em qualquer superfície ou pule',
    es_izq: 'Esquerda', es_der: 'Direita', es_esperando: 'esperando…', es_quieta: 'parada…', es_medida: 'mede {n} cm', es_seguir: 'Seguir', es_medidas: '✋ Suas mãos foram medidas (×{k})',
    es_ayuda: 'Toque a tela para seguir · com as mãos: toque ou faça a pinça', es_piso_ok: 'Chão encontrado', es_pared_ok: 'Parede encontrada', es_mesa_ok: 'Mesa encontrada',
    es_ancha: '📷 Câmera 0,5x', es_cam_ancha: '📷 Câmera 0,5x ({g}°) · gire a cabeça; para andar, volte ao 1x', es_cam_ancha_off: '🎥 Câmera {g}° (ARCore) · a 0,5x ({m}°) com o botão',
    es_ancha_lista: '📷 0,5x: olhe em volta girando a cabeça; para andar, volte ao 1x', es_ancha_espera: '📷 Mexa um pouco a cabeça para alinhar a 0,5x', es_ancha_1x: '🎥 1x com o ARCore: dá para andar',
    es_llenar: '🔍 Câmera com zoom', es_linterna: '🔦 Lanterna', es_cam_05: '🎥 Câmera 0,5x ({g}°)', es_cam_1: '🎥 Câmera {g}° · o ARCore não deixa usar a 0,5x ({m}°)', es_cam: '🎥 Câmera {g}°',
    es_pantalla_sub: 'Toque com o dedo ou faça a pinça', es_escaneo_ok: 'Escaneamento salvo', es_perdido: 'O ARCore perdeu onde você está: mexa o celular devagar',
    vr_ar_texto: 'Quer usar o ARCore? Com o ARCore o celular sabe onde está (6 eixos), como um Quest.', vr_ar_espacio: '📡 Sim: seu espaço', vr_ar_espacio_d: 'Você escaneia o quarto (chão, paredes, móveis), apoia as mãos na mesa e abre uma tela para tocar e janelas que ficam no lugar',
    vr_ar_juego: '🎮 Sim, direto ao jogo', vr_ar_juego_d: 'AEROPLAZA em 6 eixos, sem escanear', vr_ar_no: '🧭 Não, sem ARCore', vr_ar_no_d: 'Só o giroscópio. As janelas de teste abrem no mundo do jogo (menu da palma)', vr_ar_atras: 'Voltar' },
});

const OJOS = 0.06;           // los ojos, detrás del celu (como vr.js)
/* (vuelta 33: la clave nueva, para que el aumento no quede prendido de antes; de entrada, tamaño real) */
const CLAVE_LLENAR = 'aeroplaza.camaraAumento';
const IPD = 0.064;
const LEJOS_FOTO = 9;        // a cuánto se pone la foto de la cámara (m: lejos, casi sin paralaje entre los ojos)
const EXT_FOTO = 7;          // el plano de la foto, tantas veces lo que ve la cámara: afuera sigue su borde, borroso
const SECTORES = 12;         // mirar alrededor: la vuelta en 12 porciones
const TOPE_VOX = 90000;
const MESA = [0.35, 1.3];    // alto de una mesa sobre el piso (m)
const MEDIR = { t: 1.2, n: 14, abierta: 1.5, horizontal: 0.7, cerca: 0.22, quieta: 0.012, palma: 0.02 };
/* (vuelta 42, "las pantallas deben aparecer alejadas", como en un Quest) a cuánto va cada cosa (m) y cuánto más
   grande (que se vea más o menos igual que antes, cerca). Lejos se enfoca mejor con el visor (las lentes enfocan
   lejos: de cerca los dos ojos no juntan bien) y el temblor de la cabeza mueve menos lo que se ve. Se toca con el
   rayo y el pellizco; si hay una pared antes, quedan 15 cm delante */
/* (vuelta 42) la ultra ancha: se prende sola al llegar a la pantalla si el celu la tiene (se guarda si se apaga) */
const CLAVE_ANCHA = 'aeroplaza.ancha';
const LEJOS_Q = { pantalla: 1.9, escalaPantalla: 1.45, ventanas: 1.45, escala: 1.7, tarjeta: [1.3, 2.2], escalaTarjeta: 2, lentes: 1.1, escalaLentes: 1.8 };
const COLOR = { piso: new THREE.Color('#39d7ff'), pared: new THREE.Color('#b9f1ff'), mesa: new THREE.Color('#ffd23f'), techo: new THREE.Color('#c9b8ff'), otro: new THREE.Color('#7dfcc0') };
const num = (x, d = 1) => x.toLocaleString(idioma() === 'en' ? 'en' : idioma() === 'pt' ? 'pt-BR' : 'es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _v2 = new THREE.Vector2(), _up = new THREE.Vector3(0, 1, 0);

/* LA FOTO DE LA CÁMARA (vuelta 33), en tamaño real: la cámara ve ~67° y el visor más de 100°. Antes se
   estiraba a toda la lente ("llenar", ×3,4 en el centro): se veía como ojo de pescado, borrosa, y el
   cuarto se movía más rápido que la cabeza. Ahora cada grado de la foto es un grado de la vista; afuera de
   la foto sigue su borde, cada vez más borroso y oscuro (la vista no termina en un marco). Adentro, un poco
   más nítida (la foto es JPEG, chica) y, con poca luz, más clara (uGan, de lo que mide Java: nativo.js › luz) */
const VERT_FOTO = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG_FOTO = /* glsl */`
  uniform sampler2D tFoto; uniform vec2 uTexel; uniform float uExt, uGan, uNitidez;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * uExt;
    float d = max(abs(p.x), abs(p.y)) * 2.0;
    vec2 uv = 0.5 + p / max(d, 1.0);
    vec3 c = texture2D(tFoto, uv).rgb;
    vec3 v = texture2D(tFoto, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(tFoto, uv - vec2(uTexel.x, 0.0)).rgb + texture2D(tFoto, uv + vec2(0.0, uTexel.y)).rgb + texture2D(tFoto, uv - vec2(0.0, uTexel.y)).rgb;
    vec3 fino = max(c + uNitidez * (c - v * 0.25), 0.0);
    vec3 borroso = texture2D(tFoto, uv, clamp((d - 1.0) * 9.0, 0.0, 7.0)).rgb * (1.0 - 0.65 * smoothstep(1.0, 2.2, d));
    c = (d <= 1.0 ? fino : borroso) * uGan;
    gl_FragColor = vec4(c / (1.0 + c * 0.12) * 1.12, 1.0);
    #include <colorspace_fragment>
  }`;

/* la grilla de los planos: líneas cada 25 cm, la ola del escaneo que sale de la cabeza y el fundido al aparecer */
const VERT_PLANO = /* glsl */`
  varying vec2 vL; varying vec3 vW;
  void main() { vL = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG_PLANO = /* glsl */`
  uniform vec3 uColor, uCabeza; uniform float uT, uNace, uAlfa, uVer;
  varying vec2 vL; varying vec3 vW;
  void main() {
    vec2 q = vL / 0.25, g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-4);
    float linea = 1.0 - min(min(g.x, g.y), 1.0);
    float d = distance(vW, uCabeza), ola = exp(-pow((d - mod(uT * 1.4, 6.0)) * 4.0, 2.0));
    float a = uAlfa * uVer * smoothstep(0.0, 0.7, uT - uNace) * (0.14 + 0.6 * linea + 0.3 * ola);
    gl_FragColor = vec4(uColor * (0.9 + ola * 0.5), a);
    #include <colorspace_fragment>
  }`;
/* los cubitos: puntos redondos que aparecen creciendo, con color por altura y la ola */
const VERT_VOX = /* glsl */`
  attribute float aNace; uniform float uT, uPx, uPiso; uniform vec3 uCabeza; varying vec3 vC; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    float pop = smoothstep(0.0, 0.4, uT - aNace), d = distance(position, uCabeza), ola = exp(-pow((d - mod(uT * 1.4, 6.0)) * 4.0, 2.0));
    gl_PointSize = uPx * 0.05 / max(0.05, -mv.z) * (0.4 + 0.6 * pop) * (1.0 + 0.5 * ola);
    float h = clamp((position.y - uPiso) / 2.2, 0.0, 1.0);
    vC = mix(vec3(0.25, 0.75, 1.0), vec3(0.85, 1.0, 0.95), h) + ola * 0.4; vA = pop * (0.5 + 0.5 * ola);
  }`;
const FRAG_VOX = /* glsl */`
  uniform float uVer; varying vec3 vC; varying float vA;
  void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; gl_FragColor = vec4(vC, vA * uVer * (1.0 - r * 0.7));
    #include <colorspace_fragment>
  }`;

/* LA MALLA DEL CUARTO (vuelta 35, android/…/Malla.java): cuadrados sobre las superficies, con el borde que brilla
   (como el escaneo de Asalto MR o el de un Quest), del color de lo que es (piso, pared, mesa, techo), la ola que
   sale de la cabeza, lo hecho (que ya no se escanea) más quieto y verdoso, y lo que llenan los planos, más tenue.
   Cada vértice: el lugar, la normal y las banderas (aNor.w: 1 relleno, 2 hecho, la esquina del cuadrado × 4) */
const RAIZ = 'https://appassets.androidplatform.net/';
const TROZO = 3;             // bloques por lado de cada trozo (una malla de three por trozo: menos dibujos)
const VERT_MALLA = /* glsl */`
  attribute vec4 aNor; varying vec3 vW, vN; varying vec2 vQ; varying float vRel, vHecho;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = aNor.xyz;
    float f = floor(aNor.w * 127.0 + 0.5), c = floor(f / 4.0);
    vRel = mod(f, 2.0); vHecho = mod(floor(f / 2.0), 2.0);
    vQ = c < 0.5 ? vec2(0.0) : c < 1.5 ? vec2(1.0, 0.0) : c < 2.5 ? vec2(1.0) : vec2(0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG_MALLA = /* glsl */`
  uniform vec3 uCabeza, uPisoC, uParedC, uMesaC, uTechoC, uListoC; uniform float uT, uVer, uPiso;
  varying vec3 vW, vN; varying vec2 vQ; varying float vRel, vHecho;
  void main() {
    vec3 n = normalize(vN), an = abs(n); float h = vW.y - uPiso;
    vec3 col = an.y > 0.72 ? (n.y > 0.0 ? (h > 0.3 ? uMesaC : uPisoC) : uTechoC) : uParedC;
    /* (la grilla cada 12 cm sobre la superficie, del eje que más mira: con los cuadrados de 3 cm quedaba tupida) */
    vec2 q = (an.y > an.x && an.y > an.z ? vW.xz : an.x > an.z ? vW.zy : vW.xy) / 0.12;
    vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-4);
    float linea = 1.0 - min(min(g.x, g.y), 1.0);
    float luz = 0.62 + 0.38 * max(dot(n, normalize(vec3(0.3, 1.0, 0.2))), 0.0);
    float d = distance(vW, uCabeza), ola = exp(-pow((d - mod(uT * 1.4, 6.0)) * 4.0, 2.0)), lejos = 1.0 - smoothstep(4.0, 8.0, d);
    /* (lo hecho, más verde y los bordes un poco más quietos; lo que llenan los planos, más tenue) */
    if (vHecho > 0.5) col = mix(col, uListoC, 0.35);
    vec3 c = mix(col * luz, vec3(1.0), 0.35 * linea);
    float a = 0.12 + (vHecho > 0.5 ? 0.45 : 0.6) * linea + 0.35 * ola;
    if (vRel > 0.5) a *= 0.45;
    gl_FragColor = vec4(c * (0.9 + ola * 0.5), a * uVer * lejos);
    #include <colorspace_fragment>
  }`;

/* la tarjeta que va con la cabeza: qué falta y los botones */
class Tarjeta extends Tablero {
  constructor() { super(0.56, 0.36, 896); this.fase = 'buscando'; this.datos = {}; }
  poner(fase, datos) { this.fase = fase; this.datos = datos; this.sucio = true; }
  pintar() {
    const g = this.g, W = this.W, H = this.H, D = this.datos; g.clearRect(0, 0, W, H);
    const c = g.createLinearGradient(0, 0, 0, H); c.addColorStop(0, 'rgba(10,40,70,0.82)'); c.addColorStop(1, 'rgba(8,60,100,0.78)');
    g.fillStyle = c; g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 34); g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(160,230,255,0.9)'; g.stroke();
    const b = g.createLinearGradient(0, 6, 0, H * 0.4); b.addColorStop(0, 'rgba(255,255,255,0.22)'); b.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = b; g.beginPath(); g.roundRect(12, 12, W - 24, H * 0.36, 28); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#ffffff';
    /* (un renglón de lo que falta: el círculo con su tilde, el nombre y lo que va, antes de la vuelta) */
    const renglon = (y, ok, nombre, valor, hasta = W - 230) => {
      g.fillStyle = ok ? '#7dfcc0' : 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(56, y - 12, 18, 0, 7); g.fill();
      if (ok) { g.strokeStyle = '#0d3b5e'; g.lineWidth = 6; g.beginPath(); g.moveTo(46, y - 12); g.lineTo(54, y - 3); g.lineTo(67, y - 21); g.stroke(); }
      g.fillStyle = '#ffffff'; g.font = '700 36px system-ui, sans-serif'; g.fillText(nombre, 88, y);
      g.fillStyle = ok ? '#bff4ff' : 'rgba(255,255,255,0.6)'; g.textAlign = 'right'; g.fillText(valor, hasta, y); g.textAlign = 'left';
    };
    /* (el texto de abajo del título, en dos renglones si no entra) */
    const parrafo = (txt, y, col) => {
      g.font = '600 28px system-ui, sans-serif'; g.fillStyle = col; const pal = txt.split(' '); let l = '', n = 0;
      for (const p of pal) { const x = l ? l + ' ' + p : p; if (g.measureText(x).width > W - 70 && l) { g.fillText(l, 34, y + n * 34); n++; l = p; } else l = x; }
      g.fillText(l, 34, y + n * 34);
    };
    /* (vuelta 36-37: cómo va el escaneo, arriba a la derecha, sin pisar el título: si no llega, se sabe) */
    const diag = (desde) => {
      if (D.diag) { g.textAlign = 'right'; g.fillStyle = /⚠/.test(D.diag) ? '#ffd23f' : 'rgba(191,244,255,0.85)'; g.font = '700 20px system-ui, sans-serif'; g.fillText(D.diag, W - 30, 40, W - 30 - desde); g.textAlign = 'left'; }
      /* (y los números de Java, chicos, abajo de todo: con una captura se sabe qué falta) */
      if (D.diag2) { g.textAlign = 'center'; g.fillStyle = 'rgba(191,244,255,0.75)'; g.font = '600 15px system-ui, sans-serif'; g.fillText(D.diag2, W / 2, H - 20, W - 60); g.textAlign = 'left'; }
    };
    if (this.fase === 'buscando') {
      diag(34);
      g.font = '800 46px system-ui, sans-serif'; g.fillText('📡 ' + t('es_buscando'), 34, 90);
      parrafo(t('es_buscando_d'), 142, '#bff4ff');
      const a = performance.now() / 300; g.strokeStyle = '#7dfcc0'; g.lineWidth = 10; g.beginPath(); g.arc(W / 2, 300, 56, a, a + 4.2); g.stroke();
    } else if (this.fase === 'escaneo') {
      g.font = '800 46px system-ui, sans-serif'; g.fillText('🧭 ' + t('es_titulo'), 30, 66); const anchoT = g.measureText('🧭 ' + t('es_titulo')).width;
      parrafo(t('es_texto'), 108, '#bff4ff');
      renglon(214, D.piso > 0.3, t('es_piso'), D.piso > 0 ? t('es_m2', { n: num(D.piso) }) : '—');
      renglon(262, D.paredes > 0, t('es_paredes'), String(D.paredes));
      renglon(310, D.mesa, t('es_mesa'), D.mesa ? '✓' : '—');
      renglon(358, D.vox > 400, t('es_objetos'), String(D.vox) + (D.listo != null ? ' · ' + t('es_listo_pct', { n: D.listo }) : ''));
      diag(30 + anchoT + 24);
      /* (mirar alrededor: la vuelta en porciones que se van llenando) */
      const cx = W - 116, cy = 282, r = 62;
      for (let i = 0; i < SECTORES; i++) { const a0 = -Math.PI / 2 + i / SECTORES * Math.PI * 2; g.strokeStyle = D.sectores?.[i] ? '#7dfcc0' : 'rgba(255,255,255,0.25)'; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, r, a0 + 0.06, a0 + Math.PI * 2 / SECTORES - 0.06); g.stroke(); }
      g.fillStyle = '#fff'; g.font = '800 30px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`${D.vistos}/${SECTORES}`, cx, cy + 11);
      g.font = '700 20px system-ui, sans-serif'; g.fillStyle = '#bff4ff'; g.fillText(t('es_alrededor'), cx, cy + r + 34); g.textAlign = 'left';
      if (!D.piso) { g.fillStyle = '#ffd23f'; g.font = '700 26px system-ui, sans-serif'; g.fillText('⚠ ' + t('es_falta_piso'), 34, 404); }
      else if (D.sinProf) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(t('es_sin_prof'), 34, 404); }
      else if (D.camara) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(D.camara, 34, 404); }
    } else if (this.fase === 'manos') {
      g.font = '800 46px system-ui, sans-serif'; g.fillText('✋ ' + t('es_manos_t'), 30, 66);
      parrafo(D.sinMesa ? t('es_sin_mesa') : t('es_manos_d'), 108, D.sinMesa ? '#ffd23f' : '#bff4ff');
      for (const [i, lado] of [['izq', 'es_izq'], ['der', 'es_der']].entries()) {
        const M = D[lado[0]] || {}, y = 240 + i * 76;
        renglon(y, !!M.hecha, t(lado[1]), M.hecha ? t('es_medida', { n: M.cm }) : M.carga > 0 ? t('es_quieta') : t('es_esperando'), W - 40);
        if (M.carga > 0 && !M.hecha) { g.fillStyle = '#7dfcc0'; g.fillRect(88, y + 14, (W - 128) * M.carga, 8); }
      }
    }
    this.dibujarBotones();
  }
}

export class Espacio {
  /* motor: para dibujar; manos: las manos (manos.js); vr: el modo VR (la capa de toques y el giroscopio);
     sonar(nombre); alJugar(): de acá al juego (con ARCore y las manos); alSalir(); avisar(texto) */
  constructor({ motor, manos, vr, sonar = () => {}, alJugar = () => {}, alSalir = () => {} }) {
    this.motor = motor; this.manos = manos; this.vr = vr; this.sonar = sonar; this.alJugar = alJugar; this.alSalir = alSalir;
    this.activo = false; this.fase = 'buscando'; this.sbs = false; this.t = 0;
    this.escena = new THREE.Scene();
    this.ojo = new THREE.PerspectiveCamera(70, 1, 0.03, 60);
    this.cabezaP = new THREE.Vector3(0, 1.5, 0); this.cabezaQ = new THREE.Quaternion();
    this.pisoY = null; this.planos = new Map(); this.sectores = new Float32Array(SECTORES);
    /* EL ESCANEO SE VA (vuelta 34, como en un Quest): se ve mientras se escanea y después se desvanece en 0,8 s
       (uVer, en los planos y los cubitos). "Ver el escaneo", en la pantalla, lo vuelve a mostrar */
    this.verEscaneo = false; this.uVer = { value: 1 };
    /* la foto de la cámara, donde se sacó */
    /* (con mipmaps: lo borroso de afuera de la foto sale de ahí) */
    const tex = this.texFoto = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.uFoto = { tFoto: { value: tex }, uTexel: { value: new THREE.Vector2(1 / 640, 1 / 480) }, uExt: { value: EXT_FOTO }, uGan: { value: 1 }, uNitidez: { value: 0.35 } };
    this.foto = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.uFoto, vertexShader: VERT_FOTO, fragmentShader: FRAG_FOTO, depthTest: false, depthWrite: false }));
    this.foto.frustumCulled = false;
    this.foto.renderOrder = -10; this.foto.visible = false; this.escena.add(this.foto);
    this.fotoEn = { cargando: false, pendiente: null, n: 0, bm: null, llegadas: 0 };
    /* los planos y los cubitos */
    this.grupoPlanos = new THREE.Group(); this.escena.add(this.grupoPlanos);
    const G = this.geoVox = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TOPE_VOX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    G.setAttribute('aNace', new THREE.BufferAttribute(new Float32Array(TOPE_VOX), 1).setUsage(THREE.DynamicDrawUsage));
    G.setDrawRange(0, 0); G.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.nVox = 0;
    this.uVox = { uT: { value: 0 }, uPx: { value: 600 }, uPiso: { value: 0 }, uCabeza: { value: this.cabezaP }, uVer: this.uVer };
    this.vox = new THREE.Points(G, new THREE.ShaderMaterial({ uniforms: this.uVox, vertexShader: VERT_VOX, fragmentShader: FRAG_VOX, transparent: true, depthWrite: false }));
    this.vox.frustumCulled = false; this.vox.renderOrder = 1; this.escena.add(this.vox);
    /* la malla del cuarto: los bloques que llegan de Java (sus bytes), juntados en trozos de TROZO³ */
    this.malla = { bloques: new Map(), trozos: new Map(), pend: new Map(), cargando: 0, total: 0, hechos: 0, cuadros: 0, llegadas: 0 };
    const C = (x) => ({ value: new THREE.Color(x) });
    this.uMalla = { uT: this.uVox.uT, uCabeza: { value: this.cabezaP }, uPiso: { value: 0 }, uVer: this.uVer, uPisoC: C('#39d7ff'), uParedC: C('#b39cff'), uMesaC: C('#ffd23f'), uTechoC: C('#c9b8ff'), uListoC: C('#7dfcc0') };
    this.matMalla = new THREE.ShaderMaterial({ uniforms: this.uMalla, vertexShader: VERT_MALLA, fragmentShader: FRAG_MALLA, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.grupoMalla = new THREE.Group(); this.grupoMalla.renderOrder = 1; this.escena.add(this.grupoMalla);
    /* la mesa para las manos: el contorno de dos manos apoyadas */
    this.fantasma = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.dibujarFantasma(), transparent: true, depthWrite: false, toneMapped: false }));
    this.fantasma.visible = false; this.fantasma.renderOrder = 3; this.escena.add(this.fantasma);
    /* la tarjeta y el punto de la mirada */
    this.tarjeta = new Tarjeta(); this.escena.add(this.tarjeta.malla); this.tarjeta.malla.renderOrder = 9;
    this.tarjeta.escala = LEJOS_Q.escalaTarjeta; this.tarjeta.malla.scale.setScalar(LEJOS_Q.escalaTarjeta);
    this.punto = new THREE.Mesh(new THREE.RingGeometry(0.006, 0.011, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9, toneMapped: false }));
    this.punto.renderOrder = 20; this.escena.add(this.punto);
    /* la pantalla y las ventanas (6DoF: en el cuarto) */
    /* (vuelta 42: quedarse mirando no aprieta nada; se aprieta con las manos, como en un Quest) */
    this.ventanas = new Ventanas({ conSeis: true, quieta: 0, lejos: LEJOS_Q.ventanas, escala: LEJOS_Q.escala, paredes: () => this.paredes(), piso: () => this.pisoY, alSonar: (n) => this.sonar(n), alAccion: (id) => this.accion(id) });
    this.escena.add(this.ventanas.grupo);
    this.medida = { izq: null, der: null };
    /* LA CÁMARA CON AUMENTO (vuelta 31, apagada de entrada desde la 33): con visor, cada ojo con el campo de la
       cámara y la lente lo abre a toda su vista (llena, pero ×3,4 en el centro: ojo de pescado). Sin aumento,
       el tamaño de verdad, y afuera de la foto su borde borroso (FRAG_FOTO) */
    this.llenar = false; try { this.llenar = localStorage.getItem(CLAVE_LLENAR) === '1'; } catch { /* sin guardar */ }
    /* LOS DOS OJOS IGUALES (vuelta 36): la cámara del celu es una sola, así que la foto es la misma para los dos
       ojos. Lo dibujado con los ojos corridos (la mano fantasma, la malla) caía sobre lo de verdad en un ojo y
       corrido en el otro ("en un lente detecta mal"). En tu espacio los dos ojos miran desde la cámara */
    this.mono = true; this.camP = new THREE.Vector3();
  }

  /* ------------------------------------------ entrar y salir */
  entrar(sbs) {
    this.activo = true; this.sbs = sbs; this.t = 0; this.fase = 'buscando'; this.tFase = 0;
    Nativo.alPlanos = (l) => this.recibirPlanos(l);
    Nativo.alVoxeles = (v, vox) => this.recibirVoxeles(v, vox);
    Nativo.alFoto = (d) => this.recibirFoto(d);
    Nativo.alOlvidado = () => this.olvidar(false);
    Nativo.alMalla = (...a) => this.recibirMalla(...a);
    Nativo.arEscanear(true); Nativo.arPasante(true);
    this.medida = { izq: null, der: null }; this.visto = { piso: false, pared: false, mesa: false };
    this.ponerFase('buscando');
    this.vr.decir?.(t('es_ayuda'), 6); this.vr.el?.classList.add('en-espacio');
    /* (las manos casi solo el borde: la de verdad se ve en la cámara, como en un Quest) */
    this.manos.ponerFantasma?.(true);
  }
  /* sale del espacio (al juego o afuera); el escaneo queda (volver no escanea de nuevo) */
  cerrar() {
    if (!this.activo) return;
    this.activo = false;
    /* (la ultra ancha se apaga antes: ARCore vuelve a tener la cámara) */
    if (this.quiereAncha || Nativo.ancho === 'corre' || Nativo.ancho === 'espera') Nativo.espacioAncho(false);
    this.quiereAncha = false;
    Nativo.arEscanear(false); Nativo.arPasante(false);
    Nativo.alPlanos = Nativo.alVoxeles = Nativo.alFoto = Nativo.alOlvidado = Nativo.alMalla = null; this.vr.el?.classList.remove('en-espacio');
    this.manos.ponerFantasma?.(false);
    this.ventanas.agarres.clear();
  }
  olvidar(pedir = true) {
    for (const P of this.planos.values()) this.soltarPlano(P);
    this.planos.clear(); this.nVox = 0; this.geoVox.setDrawRange(0, 0); this.pisoY = null; this.sectores.fill(0);
    const Ma = this.malla; for (const T of Ma.trozos.values()) if (T.mesh) { T.mesh.geometry.dispose(); T.mesh.removeFromParent(); }
    Ma.bloques.clear(); Ma.trozos.clear(); Ma.pend.clear(); Ma.total = Ma.hechos = Ma.cuadros = 0;
    this.visto = { piso: false, pared: false, mesa: false };
    if (pedir) Nativo.arOlvidar();
  }
  ponerFase(f) {
    this.fase = f; this.tFase = 0;
    /* (vuelta 42) escanear y medir las manos necesitan ARCore (1x); en la pantalla, la 0,5x si se puede y se quiere */
    if (f !== 'pantalla' && (this.quiereAncha || Nativo.ancho === 'corre')) { this.quiereAncha = false; Nativo.espacioAncho(false); }
    if (f === 'pantalla') { this.lente = Nativo.camaraAncha(); this.quiereAncha = !!this.lente?.hay && this.prefAncha(); this.tAncha = 0; this._avisoAncha = false; }
    this.tarjeta.malla.visible = f !== 'pantalla';
    this.fantasma.visible = f === 'manos';
    const B = (id, texto, x, o = {}) => ({ id, texto, x, y: 440, w: 390, h: 104, ...o });
    if (f === 'escaneo') this.tarjeta.botones = [B('listo', t('es_listo'), 38, { principal: true }), B('salir', t('es_salir'), 468, { peligro: true })];
    else if (f === 'manos') this.tarjeta.botones = [B('seguir', t('es_seguir'), 38, { principal: true }), B('saltear', t('es_saltear'), 468)];
    else this.tarjeta.botones = [B('salir', t('es_salir'), 253, { peligro: true })];
    if (f === 'manos') this.ponerFantasma();
    if (f === 'pantalla') this.abrirPantalla();
    this.tarjeta.sucio = true;
  }
  abrirPantalla() {
    /* (vuelta 42) adelante, a 1,9 m y un poco abajo de los ojos (antes, arriba del borde de la mesa: a menos de un
       metro); más cerca si hay una pared antes */
    /* (la dirección en un vector propio: contar las paredes usa los de trabajo, _a y los demás) */
    const pos = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cabezaQ); d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, -1); d.normalize();
    pos.copy(this.cabezaP).addScaledVector(d, this.ventanas.hasta(this.cabezaP, d, LEJOS_Q.pantalla)); pos.y -= 0.18;
    this.ventanas.abrirPantalla('🏠 ' + t('vt_pantalla'), [
      { id: 'jugar', texto: '▶ ' + t('vt_jugar'), principal: true }, { id: 'lugar', texto: '🧭 ' + t('vt_lugar') }, { id: 'reloj', texto: '🕒 ' + t('vt_reloj') },
      { id: 'pizarra', texto: '✍ ' + t('vt_pizarra') }, { id: 'burbujas', texto: '🫧 ' + t('vt_burbujas') }, { id: 'escaneo', texto: '🧱 ' + t('vt_escaneo') },
      { id: 'reescanear', texto: '🔁 ' + t('vt_reescanear') }, { id: 'medir', texto: '✋ ' + t('vt_medir') }, { id: 'lentes', texto: t('le_menu') }, { id: 'llenar', texto: t('es_llenar') }, { id: 'linterna', texto: t('es_linterna') },
      ...(this.lente?.hay ? [{ id: 'ancha', texto: t('es_ancha') }] : []), { id: 'salir', texto: '✕ ' + t('vt_salir'), peligro: true },
    ], pos, this.cabezaP, t('es_pantalla_sub') + (this.textoCamara() ? ' · ' + this.textoCamara() : ''), LEJOS_Q.escalaPantalla);
    this.ventanas.pantalla.marcar('escaneo', this.verEscaneo); this.ventanas.pantalla.marcar('llenar', this.llenar); this.ventanas.pantalla.marcar('linterna', !!this.vr.flash);
    if (this.lente?.hay) this.ventanas.pantalla.marcar('ancha', !!this.quiereAncha);
  }
  /* los botones de la pantalla y de la tarjeta */
  accion(id) {
    /* (el panel de las lentes; "listo" vuelve a la pantalla) */
    if (accionLentes(this.vr.lentes, id, this.ventanas.pantalla)) { if (id === 'lente:listo') this.abrirPantalla(); return; }
    if (id === 'lentes') { this.abrirLentes(); return; }
    /* (vuelta 42) la 0,5x: se prende o se vuelve a 1x (ARCore, para caminar), y se guarda */
    if (id === 'ancha') {
      this.quiereAncha = !this.quiereAncha; this.tAncha = 0; this._avisoAncha = false;
      try { localStorage.setItem(CLAVE_ANCHA, this.quiereAncha ? '1' : '0'); } catch { /* sin guardar */ }
      if (!this.quiereAncha) { Nativo.espacioAncho(false); this.vr.decir?.(t('es_ancha_1x'), 3); }
      this.ventanas.pantalla?.marcar('ancha', this.quiereAncha); return;
    }
    if (id === 'llenar') { this.llenar = !this.llenar; try { localStorage.setItem(CLAVE_LLENAR, this.llenar ? '1' : '0'); } catch { /* sin guardar */ } this.ventanas.pantalla?.marcar('llenar', this.llenar); return; }
    /* (la linterna a mano: después no se prende sola, main.js › mirarLuz) */
    if (id === 'linterna') { this.vr.linternaAMano = true; this.vr.cambiarLinterna?.(!this.vr.flash).then(() => this.ventanas.pantalla?.marcar('linterna', !!this.vr.flash)); return; }
    if (id === 'jugar') { this.cerrar(); this.alJugar(); }
    else if (id === 'salir') { this.cerrar(); this.alSalir(); }
    else if (id === 'listo') { if (this.pisoY == null) { this.sonar('no'); return; } this.sonar('ola'); this.ponerFase('manos'); }
    else if (id === 'seguir' || id === 'saltear') { this.ponerFase('pantalla'); }
    else if (id === 'escaneo') { this.verEscaneo = !this.verEscaneo; this.ventanas.pantalla?.marcar('escaneo', this.verEscaneo); }
    else if (id === 'reescanear') { this.ventanas.limpiar(); this.olvidar(); this.ponerFase('escaneo'); }
    else if (id === 'medir') { this.medida = { izq: null, der: null }; this.ventanas.cerrarPantalla(); this.ponerFase('manos'); }
    else if (['lugar', 'reloj', 'pizarra', 'burbujas'].includes(id)) this.ventanas.abrir(id, this.cabezaP, this.cabezaQ);
  }

  /* qué cámara quedó: el 0.5x si ARCore lo deja; si el celu tiene uno más abierto y no, se dice */
  textoCamara() {
    const L = this.lente || Nativo.lenteAncha;
    if (Nativo.ancho === 'corre' && L?.campo) return t('es_cam_ancha', { g: Math.round(L.campo) });
    const C = Nativo.camara;
    if (L?.hay && C?.campo) return t('es_cam_ancha_off', { g: C.campo, m: Math.round(L.campo) });
    if (!C || !C.campo) return '';
    if (C.celu > C.campo + 15) return t('es_cam_1', { g: C.campo, m: C.celu });
    return C.campo >= 95 ? t('es_cam_05', { g: C.campo }) : t('es_cam', { g: C.campo });
  }
  /* el panel de las lentes delante de la cara (con visor) */
  abrirLentes() {
    if (!this.sbs) { this.vr.decir?.(t('le_solo_sbs'), 3); return; }
    _a.set(0, 0, -1).applyQuaternion(this.cabezaQ); _a.y = 0; _a.normalize();
    const d = _a.clone(), k = this.ventanas.hasta(this.cabezaP, d, LEJOS_Q.lentes);
    this.ventanas.abrirTablero(new PanelLentes(this.vr.lentes), this.cabezaP.clone().addScaledVector(d, k).setY(this.cabezaP.y - 0.08), this.cabezaP, LEJOS_Q.escalaLentes);
  }
  /* ------------------------------------------ lo que manda Android */
  recibirPlanos(lista) {
    const vistos = new Set();
    for (const d of lista || []) {
      vistos.add(d.i);
      let P = this.planos.get(d.i);
      if (!P) { P = this.crearPlano(d); this.planos.set(d.i, P); }
      else this.actualizarPlano(P, d);
      P.falta = 0;
    }
    /* (el que no vino dos veces seguidas lo absorbió otro) */
    for (const [i, P] of this.planos) if (!vistos.has(i) && ++P.falta > 1) { this.soltarPlano(P); this.planos.delete(i); }
    this.clasificar();
  }
  crearPlano(d) {
    const u = { uColor: { value: COLOR.otro.clone() }, uCabeza: { value: this.cabezaP }, uT: this.uVox.uT, uNace: { value: this.t }, uAlfa: { value: 0.9 }, uVer: this.uVer };
    const malla = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_PLANO, fragmentShader: FRAG_PLANO, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    malla.renderOrder = 0;
    const borde = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, toneMapped: false }));
    malla.add(borde); this.grupoPlanos.add(malla);
    const P = { i: d.i, tipo: d.t, malla, borde, u, centro: new THREE.Vector3(), n: new THREE.Vector3(), area: 0, clase: 'otro', firma: '', falta: 0 };
    this.actualizarPlano(P, d);
    return P;
  }
  actualizarPlano(P, d) {
    const [x, y, z, qx, qy, qz, qw] = d.p;
    P.malla.position.set(x, y, z); P.malla.quaternion.set(qx, qy, qz, qw); P.malla.updateMatrixWorld();
    P.centro.set(x, y, z); P.n.set(0, 1, 0).applyQuaternion(P.malla.quaternion); P.tipo = d.t; P.ext = [d.x, d.z];
    const firma = d.v.length + ':' + d.v.slice(0, 4).join(',');
    if (firma === P.firma) return;
    P.firma = firma;
    /* el contorno (x, z en el plano) a una figura: en el plano de three la figura es xy, y va acostada */
    const v = d.v, S = new THREE.Shape(), L = [];
    let area = 0;
    for (let i = 0; i < v.length; i += 2) { const a = v[i], b = v[i + 1]; if (i === 0) S.moveTo(a, -b); else S.lineTo(a, -b); L.push(a, 0.002, b); const j = (i + 2) % v.length; area += a * v[j + 1] - v[j] * b; }
    P.area = Math.abs(area) / 2;
    if (v.length >= 6) {
      const g = new THREE.ShapeGeometry(S).rotateX(-Math.PI / 2);
      P.malla.geometry.dispose(); P.malla.geometry = g;
      P.borde.geometry.dispose(); P.borde.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(L, 3));
    }
  }
  soltarPlano(P) { P.malla.geometry.dispose(); P.malla.material.dispose(); P.borde.geometry.dispose(); P.borde.material.dispose(); P.malla.removeFromParent(); }
  /* qué es cada plano: el piso (el más bajo, bien abajo de la cabeza), mesas, paredes, techo */
  clasificar() {
    for (const P of this.planos.values()) if (P.tipo === 0 && P.area > 0.25 && this.cabezaP.y - P.centro.y > 0.85 && (this.pisoY == null || P.centro.y < this.pisoY)) this.pisoY = P.centro.y;
    for (const P of this.planos.values()) {
      const c = P.tipo === 2 ? 'pared' : P.tipo === 1 ? 'techo'
        : this.pisoY != null && Math.abs(P.centro.y - this.pisoY) < 0.12 ? 'piso'
        : (this.pisoY != null ? P.centro.y - this.pisoY >= MESA[0] && P.centro.y - this.pisoY <= MESA[1] : this.cabezaP.y - P.centro.y > 0.25 && this.cabezaP.y - P.centro.y < 1.0) && P.area > 0.06 ? 'mesa' : 'otro';
      if (c !== P.clase) { P.clase = c; P.u.uColor.value.copy(COLOR[c]); P.u.uAlfa.value = c === 'pared' ? 0.38 : c === 'techo' ? 0.3 : 0.9; }
      if (!this.visto[c] && (c === 'piso' || c === 'pared' || c === 'mesa')) { this.visto[c] = true; this.vr.decir?.('✓ ' + t('es_' + c + '_ok'), 2.5); this.sonar(c === 'mesa' ? 'orbe' : 'gota'); }
    }
    this.uVox.uPiso.value = this.pisoY ?? this.cabezaP.y - 1.5;
  }
  mesa() { let m = null; for (const P of this.planos.values()) if (P.clase === 'mesa' && (!m || P.area > m.area)) m = P; return m; }
  /* el punto del borde de la mesa más cerca de la cabeza, metido "adentro" m hacia el centro */
  bordeMesa(M, adentro = 0.12) {
    _a.copy(this.cabezaP).sub(M.centro); _a.y = 0; const d = _a.length(); if (d < 1e-3) _a.set(0, 0, 1); else _a.divideScalar(d);
    const r = Math.max(0.1, Math.min(Math.max(M.ext[0], M.ext[1]) / 2, d) - adentro);
    return new THREE.Vector3().copy(M.centro).addScaledVector(_a, r);
  }
  paredes() {
    const L = [];
    for (const P of this.planos.values()) if (P.clase === 'pared') { const n = P.n.clone(); n.y = 0; if (n.lengthSq() < 1e-3) continue; n.normalize(); if (_a.copy(this.cabezaP).sub(P.centro).dot(n) < 0) n.negate(); L.push({ p: P.centro, n }); }
    return L;
  }
  /* ------------------------------------------ la malla del cuarto */
  /* l: [[clave, bx, by, bz, versión, bytes, hecho], …] (bytes 0: el bloque quedó sin malla) */
  recibirMalla(l, total = 0, hechos = 0, fotos = 0, ms = 0, error = '') {
    const Ma = this.malla; Ma.total = total; Ma.hechos = hechos; Ma.diag = { fotos, ms, error };
    for (const [k, bx, by, bz, v, n, h] of l) {
      if (!n) { if (Ma.bloques.delete(k)) this.trozoSucio(bx, by, bz); Ma.pend.delete(k); continue; }
      Ma.pend.set(k, { k, bx, by, bz, v, h: !!h });
    }
  }
  trozoSucio(bx, by, bz) {
    const tk = `${Math.floor(bx / TROZO)}_${Math.floor(by / TROZO)}_${Math.floor(bz / TROZO)}`, Ma = this.malla;
    let T = Ma.trozos.get(tk); if (!T) Ma.trozos.set(tk, (T = { mesh: null, sucio: true, claves: new Set() }));
    T.sucio = true; return T;
  }
  /* los bytes de los bloques pendientes, de a 4 a la vez (por https: MainActivity › /malla/) */
  bombearMalla() {
    const Ma = this.malla;
    for (const [k, e] of Ma.pend) {
      if (Ma.cargando >= 4) break;
      Ma.pend.delete(k); Ma.cargando++;
      fetch(`${RAIZ}malla/${k}.bin?v=${e.v}`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => {
        if (!buf || !this.activo) return;
        const antes = Ma.bloques.get(k); if (antes && antes.v > e.v) return;
        Ma.bloques.set(k, { ...e, buf }); Ma.llegadas++;
        this.trozoSucio(e.bx, e.by, e.bz).claves.add(k);
      }).catch(() => {}).finally(() => { Ma.cargando--; });
    }
  }
  /* los trozos cambiados, de a max por cuadro: todos sus bloques en una malla (el lugar y la normal con banderas) */
  rehacerTrozos(max = 2) {
    const Ma = this.malla; let hechos = 0, cuadros = 0;
    for (const T of Ma.trozos.values()) {
      if (T.sucio && hechos < max) {
        T.sucio = false; hechos++;
        let n = 0; for (const k of T.claves) { const B = Ma.bloques.get(k); if (B) n += B.buf.byteLength / 16; else T.claves.delete(k); }
        if (T.mesh) { T.mesh.geometry.dispose(); if (!n) { T.mesh.removeFromParent(); T.mesh = null; } }
        if (n) {
          const pos = new Float32Array(n * 3), nor = new Int8Array(n * 4); let j = 0;
          for (const k of T.claves) {
            const f = new Float32Array(Ma.bloques.get(k).buf), b = new Int8Array(Ma.bloques.get(k).buf), m = f.length / 4;
            for (let v = 0; v < m; v++, j++) { pos[j * 3] = f[v * 4]; pos[j * 3 + 1] = f[v * 4 + 1]; pos[j * 3 + 2] = f[v * 4 + 2]; nor[j * 4] = b[v * 16 + 12]; nor[j * 4 + 1] = b[v * 16 + 13]; nor[j * 4 + 2] = b[v * 16 + 14]; nor[j * 4 + 3] = b[v * 16 + 15]; }
          }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aNor', new THREE.BufferAttribute(nor, 4, true)); g.computeBoundingSphere();
          if (!T.mesh) { T.mesh = new THREE.Mesh(g, this.matMalla); T.mesh.renderOrder = 1; this.grupoMalla.add(T.mesh); } else T.mesh.geometry = g;
          T.n = n;
        } else T.n = 0;
      }
      cuadros += (T.n || 0) / 6;
    }
    Ma.cuadros = Math.round(cuadros);
  }
  /* cómo va la malla, para la tarjeta */
  /* (vuelta 37) en qué paso está, para saber por qué no escanea: ARCore con error, la cámara, que no te sigue,
     el escaneo que todavía no prendió, sin profundidad, o las fotos de profundidad que entraron (y los planos) */
  textoMalla() {
    const d = this.malla.diag, e = Nativo.espacio, c = Nativo.camaraEspacio, a = Nativo.estado, D = this.diagVivo();
    const planos = this.planos.size ? ' · ' + t('es_planos_n', { n: this.planos.size }) : '';
    const fotos = Math.max(d?.fotos || 0, D?.fotos || 0);
    if (d?.error) return '⚠ malla: ' + d.error;
    if (/^error/.test(a) || a === 'sin-permiso' || a === 'no') return t('es_prof_err', { e: 'ARCore ' + a });
    if (/^error/.test(e)) return t('es_prof_err', { e: e });
    if (/^error/.test(c)) return t('es_prof_err', { e: 'cámara ' + c.slice(7) });
    if (!Nativo.arVivo && Nativo.ancho !== 'corre') return t('es_prof_sigue') + planos;
    if (!e || e === 'apagado') return t('es_prof_prende');
    if (D && (!D.cfgPl || (e === 'profundidad' && !D.cfgProf))) return t('es_prof_apagada');
    if (e === 'puntos') return t('es_prof_no') + planos;
    if (!fotos) return (D?.err && !D.ok ? t('es_prof_err', { e: 'prof ' + D.err }) : t('es_prof_nada')) + planos;
    return t('es_prof_fotos', { n: fotos, ms: Math.round((d?.ms || 0) / 10) * 10 }) + planos;
  }
  /* (vuelta 38) lo último que mandó Espacio.java › diag, si es de hace poco */
  diagVivo() { const D = Nativo.diagEspacio; return D && performance.now() - D.t < 4000 ? D : null; }
  /* el renglón chico de abajo, solo si algo falta (sin planos, sin fotos de profundidad o la foto de la cámara a la
     mitad): los números de Java, para saber qué pasa con una captura */
  textoDiag() {
    const D = this.diagVivo(); if (!D || (D.pl > 0 && D.fotos > 0 && !D.mitad)) return '';
    const si = (x) => (x ? '✓' : '✗'), l = [t('es_d_planos', { a: D.pl, b: D.plT }), t('es_d_prof', { a: D.ok, b: D.espera }) + (D.suave ? ' ' + t('es_d_suave') : '')];
    if (D.err) l.push('⚠ ' + D.err);
    l.push(t('es_d_cfg', { a: si(D.cfgPl), b: si(D.cfgProf) }), 'cam ' + D.cam);
    if (D.sigue && D.sigue !== 'ok') l.push(t('es_d_sigue', { e: D.sigue }));
    if (D.reconf) l.push(t('es_d_reconf', { n: D.reconf }));
    if (D.foto) l.push(t('es_d_foto', { f: D.foto }) + (D.mitad ? ' ' + t('es_d_mitad') : ''));
    return l.join(' · ');
  }
  /* lo que se muestra como "objetos": los cuadrados de la malla (o, sin profundidad, los cubitos) */
  get nObjetos() { return this.malla.cuadros || this.nVox; }
  get pctListo() { const Ma = this.malla; return Ma.total ? Math.round(100 * Ma.hechos / Ma.total) : null; }

  recibirVoxeles(v, vox = 0.05) {
    const pos = this.geoVox.attributes.position, nace = this.geoVox.attributes.aNace, n0 = this.nVox;
    for (let i = 0; i + 2 < v.length && this.nVox < TOPE_VOX; i += 3) {
      const k = this.nVox++;
      pos.array[k * 3] = (v[i] + 0.5) * vox; pos.array[k * 3 + 1] = (v[i + 1] + 0.5) * vox; pos.array[k * 3 + 2] = (v[i + 2] + 0.5) * vox;
      nace.array[k] = this.t + Math.random() * 0.25;
    }
    if (this.nVox === n0) return;
    pos.clearUpdateRanges(); pos.addUpdateRange(n0 * 3, (this.nVox - n0) * 3); pos.needsUpdate = true;
    nace.clearUpdateRanges(); nace.addUpdateRange(n0, this.nVox - n0); nace.needsUpdate = true;
    this.geoVox.setDrawRange(0, this.nVox);
  }
  /* la foto: se baja por https (MainActivity › /camara/) y se pone en el mundo con SU pose. Si llega otra
     mientras baja la anterior, se queda la última */
  recibirFoto(d) {
    const F = this.fotoEn;
    if (F.cargando) { F.pendiente = d; return; }
    F.cargando = true;
    fetch(d.url).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => createImageBitmap(b, { imageOrientation: 'flipY' }))
      .then((bm) => {
        if (!this.activo) { bm.close?.(); return; }
        F.bm?.close?.(); F.bm = bm; F.n = d.n; F.llegadas++; F.ultima = { tx: d.tx, ty: d.ty };
        const T = this.texFoto;
        if (T.image && (T.image.width !== bm.width || T.image.height !== bm.height)) T.dispose();
        T.image = bm; T.needsUpdate = true; this.uFoto.uTexel.value.set(1 / bm.width, 1 / bm.height);
        const [x, y, z, qx, qy, qz, qw] = d.p, M = this.foto;
        M.quaternion.set(qx, qy, qz, qw);
        M.position.set(0, 0, -LEJOS_FOTO).applyQuaternion(M.quaternion).add(_a.set(x, y, z));
        M.scale.set(2 * LEJOS_FOTO * d.tx * EXT_FOTO, 2 * LEJOS_FOTO * d.ty * EXT_FOTO, 1); M.visible = true;
      })
      .catch(() => {})
      .finally(() => { F.cargando = false; if (F.pendiente) { const p = F.pendiente; F.pendiente = null; this.recibirFoto(p); } });
  }

  /* ------------------------------------------ las manos sobre la mesa */
  dibujarFantasma() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 532; const g = c.getContext('2d');
    const mano = (cx, espejo) => {
      g.save(); g.translate(cx, 300); if (espejo) g.scale(-1, 1);
      g.strokeStyle = 'rgba(160,240,255,0.95)'; g.lineWidth = 9; g.setLineDash([22, 14]); g.lineJoin = g.lineCap = 'round';
      g.shadowColor = '#39d7ff'; g.shadowBlur = 18;
      g.beginPath(); g.ellipse(0, 70, 120, 110, 0, 0, Math.PI * 2); g.stroke();
      const dedos = [[-128, -10, -0.9, 110], [-66, -60, -0.25, 170], [0, -70, 0, 190], [62, -62, 0.18, 170], [112, -30, 0.45, 130]];
      for (const [x, y, a, l] of dedos) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.roundRect(-24, -l, 48, l, 24); g.stroke(); g.restore(); }
      g.restore();
    };
    mano(270, true); mano(754, false);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }
  ponerFantasma() {
    const M = this.mesa();
    if (!M) { this.fantasma.visible = false; return; }
    const p = this.bordeMesa(M, 0.16); this.fantasma.position.set(p.x, M.centro.y + 0.004, p.z);
    /* (mirando a la cabeza: los dedos para el lado de afuera de la mesa) */
    this.fantasma.rotation.set(0, Math.atan2(this.cabezaP.x - p.x, this.cabezaP.z - p.z), 0);
    this.fantasma.visible = true;
  }
  /* cada mano apoyada: abierta, horizontal, cerca de la mesa y quieta MEDIR.t s. Lo que se mide: a cuánto
     está la mano por su rayo desde la cámara (lo que dijo MediaPipe) y a cuánto tendría que estar para
     caer sobre la mesa (lo que dice ARCore). Cada punto va por el rayo de su lugar en la imagen, así que
     agrandar todo desde la cámara no mueve nada en la imagen: solo la distancia */
  medirManos(dt) {
    const mesa = this.mesa(), yM = mesa ? mesa.centro.y : this.pisoY != null ? this.pisoY + 0.72 : null;
    if (yM == null) return;
    const O = _c.set(0, 0, -OJOS).applyQuaternion(this.cabezaQ).add(this.cabezaP);
    for (const [k, M] of this.manos.manos.entries()) {
      const lado = k === 0 ? 'izq' : 'der', E = this.medida[lado] ||= { k: [], carga: 0, hecha: false, antes: null };
      if (E.hecha) continue;
      const vale = () => {
        if (!M.visible || M.alfa < 0.6) return null;
        const w = M.punto(0, new THREE.Vector3()), m9 = M.punto(9, new THREE.Vector3()), palma = w.distanceTo(m9);
        let puntas = 0; for (const i of [8, 12, 16, 20]) puntas += M.punto(i, _a).distanceTo(w) / 4;
        if (!(palma > 0.03) || puntas < MEDIR.abierta * palma) return null;
        if (Math.abs(M.palmaN.y) < MEDIR.horizontal) return null;
        const c = M.palmaC, d = _b.copy(c).sub(O), se = d.length(); d.divideScalar(se);
        if (d.y > -0.15 || Math.abs(c.y - (yM + MEDIR.palma)) > MEDIR.cerca) return null;
        const s = (yM + MEDIR.palma - O.y) / d.y, f = s / se;
        return f > 0.6 && f < 1.6 ? { f, c: c.clone(), largo: w.distanceTo(M.punto(12, _a)) } : null;
      };
      const v = vale();
      if (!v || (E.antes && v.c.distanceTo(E.antes) > MEDIR.quieta)) { E.k.length = 0; E.carga = 0; E.antes = v?.c || null; continue; }
      E.antes = v.c; E.k.push(v.f); E.largo = v.largo; E.carga = Math.min(1, E.carga + dt / MEDIR.t);
      if (E.carga >= 1 && E.k.length >= MEDIR.n) {
        const o = E.k.slice().sort((a, b) => a - b), med = o[Math.floor(o.length / 2)], ancho = (o[Math.floor(o.length * 0.9)] - o[Math.floor(o.length * 0.1)]) / med;
        if (ancho > 0.12) { E.k.length = 0; E.carga = 0; continue; }
        E.hecha = true; E.cm = num(E.largo * med * 100);
        this.sonar('orbe');
        this.aplicarMedida(med);
        /* (lo que la otra mano venía juntando era con la escala de antes) */
        for (const O2 of Object.values(this.medida)) if (O2 && !O2.hecha) { O2.k.length = 0; O2.carga = 0; }
      }
    }
  }
  /* la escala de las manos: lo medido sobre la que ya había. Con la segunda mano se afina (ya va con
     la escala de la primera: lo que mide es lo que falta) */
  aplicarMedida(f) {
    const M = this.manos, nueva = THREE.MathUtils.clamp((M.escalaMano || 1) * f, 0.6, 1.6);
    M.ponerEscala(nueva);
    this.vr.decir?.(t('es_medidas', { k: nueva.toFixed(2) }), 3);
  }

  /* ------------------------------------------ cada cuadro */
  cuadro(dt, dibujar = true) {
    if (!this.activo) return;
    this.t += dt; this.tFase += dt; this.uVox.uT.value = this.t;
    const V = this.vr, tVer = this.tVer = performance.now() + 20;
    /* la cabeza: la pose de ARCore tal cual (con el giroscopio si todavía no hay) */
    /* (vuelta 42: con la 0,5x, ARCore está en pausa y la cabeza la da el giroscopio alineado: cuenta como viva) */
    const vivo = Nativo.arVivo || Nativo.ancho === 'corre';
    if (vivo) { poseEn(tVer, this.cabezaQ, this.cabezaP, OJOS); this.tPerdido = 0; }
    else { this.cabezaQ.copy(V.orientacion(tVer)); this.tPerdido = (this.tPerdido || 0) + dt; if (this.fase !== 'buscando' && this.tPerdido > 2 && !this._avisoPerdido) { this._avisoPerdido = true; V.decir?.(t('es_perdido'), 3); } }
    if (vivo) this._avisoPerdido = false;
    this.cuidarAncha(dt);
    if (this.fase === 'buscando' && vivo && this.tFase > 0.5) this.ponerFase('escaneo');
    /* mirar alrededor */
    _a.set(0, 0, -1).applyQuaternion(this.cabezaQ);
    if (vivo && Math.abs(_a.y) < 0.8) { const s = Math.floor(((Math.atan2(-_a.x, -_a.z) / (Math.PI * 2)) + 1) % 1 * SECTORES); this.sectores[s] = Math.min(1, this.sectores[s] + dt / 0.35); }
    /* la tarjeta va con la cabeza, sin pegarse (se acomoda despacio), un poco abajo */
    const T = this.tarjeta;
    if (T.malla.visible) {
      _b.set(_a.x, 0, _a.z); if (_b.lengthSq() < 1e-4) _b.set(0, 0, -1); _b.normalize();
      /* (a la distancia en que ocupa algo más de la mitad de la vista: sin visor, con el campo angosto de la
         cámara, más lejos; con visor, más cerca) */
      const dist = THREE.MathUtils.clamp(T.alto * T.escala / ((this.sbs ? 0.4 : 0.55) * 2 * Math.tan(THREE.MathUtils.degToRad(this.campo()) / 2)), LEJOS_Q.tarjeta[0], LEJOS_Q.tarjeta[1]);
      const obj = _c.copy(this.cabezaP).addScaledVector(_b, dist); obj.y = this.cabezaP.y - dist * 0.26;
      if (this.tFase < 0.05) T.malla.position.copy(obj); else T.malla.position.lerp(obj, Math.min(1, dt * 1.8));
      T.malla.lookAt(this.cabezaP); T.malla.updateMatrixWorld();
      const vistos = Array.from(this.sectores).filter((x) => x >= 1).length;
      let pisoArea = 0, paredes = 0; for (const P of this.planos.values()) { if (P.clase === 'piso') pisoArea += P.area; if (P.clase === 'pared') paredes++; }
      const datos = this.fase === 'manos' ? { sinMesa: !this.mesa(), izq: this.medida.izq, der: this.medida.der } : { piso: pisoArea, paredes, mesa: !!this.mesa(), vox: this.nObjetos, listo: this.pctListo, sectores: Array.from(this.sectores, (x) => x >= 1), vistos, sinProf: Nativo.espacio === 'puntos', camara: this.textoCamara(), diag: this.textoMalla(), diag2: this.textoDiag() };
      const firma = JSON.stringify(datos, (k, v) => (k === 'k' || k === 'antes' ? undefined : typeof v === 'number' ? Math.round(v * 20) / 20 : v));
      if (firma !== this._firma || this.fase === 'buscando') { this._firma = firma; T.poner(this.fase, datos); }
      for (const b of T.botones) if (b.id === 'listo') { const a = this.pisoY == null; if (a !== !!b.apagado) { b.apagado = a; T.sucio = true; } }
      for (const b of T.botones) if (b.id === 'seguir') { const a = !this.medida.izq?.hecha && !this.medida.der?.hecha; if (a !== !!b.apagado) { b.apagado = a; T.sucio = true; } }
    }
    /* las manos: la cabeza de este cuadro y lo que hicieron */
    const Ms = this.manos, punteros = [];
    if (Ms.activa) {
      Ms.registrarCabeza(tVer, this.cabezaQ, this.cabezaP, 0);
      const ev = Ms.actualizar(dt, tVer, { cabezaP: this.cabezaP, cabezaQ: this.cabezaQ, interactivos: [], altura: () => -1e4, sePuede: () => false, sinArco: true, apuntar: (M, k) => this.ventanas.apunta[k] || this.apuntaTarjeta?.[k] || null });
      for (const e of ev) { if (e.tipo === 'sonido') this.sonar(e.s); else if (e.tipo === 'mando') V.decir?.(t('mn_mando_visto'), 4); else if (e.tipo === 'menu' && e.accion === 'mando') this.alMando?.(e.mando); else if (e.tipo === 'menu' && e.accion === 'lentes') this.abrirLentes(); else if (e.tipo === 'menu' && e.accion === 'salir') { this.cerrar(); this.alSalir(); return; } }
      for (const [k, M] of Ms.manos.entries()) if (M.visible && M.alfa > 0.5) punteros.push({ id: k, o: M.rayoO, d: M.rayoD, yema: M.viaja || M.mando?.activo ? null : M.punto(8, new THREE.Vector3()), pinza: M.viaja || M.mando?.activo ? null : M.punto(4, new THREE.Vector3()).add(M.punto(8, _c)).multiplyScalar(0.5), pellizca: M.pellizca && !M.anulado, empezo: M.empezo && !M.anulado, solto: M.solto });
    }
    /* la mirada (el punto del centro) y el toque en la pantalla. (vuelta 42, como un Quest) con una mano a la vista
       la mirada no cuenta ni se ve: apunta y aprieta la mano. Sin manos, el punto queda para el toque (el botón
       del visor), nunca por quedarse mirando */
    const conMano = punteros.length > 0;
    const mirada = { id: 'mirada', o: this.cabezaP.clone(), d: _a.clone(), clic: false };
    if (V.toque) { V.toque = false; mirada.clic = true; }
    V.salta = false;
    if (!conMano || mirada.clic) punteros.push(mirada);
    this.conMano = conMano;
    if (this.fase === 'manos') this.medirManos(dt);
    /* la tarjeta también se toca (con sus botones): es un tablero más para los punteros */
    this.tocarTarjeta(dt, punteros);
    this.ventanas.actualizar(dt, this.cabezaP, this.cabezaQ, punteros.filter((p) => !p.usado));
    /* el punto de la mirada: donde toca algo, o a 1,2 m */
    const pm = conMano ? null : this.ventanas.apunta[2] || this.apuntaTarjeta?.mirada;
    this.punto.position.copy(pm || _b.copy(this.cabezaP).addScaledVector(_a, 1.2)); this.punto.lookAt(this.cabezaP);
    const dm = this.punto.position.distanceTo(this.cabezaP); this.punto.scale.setScalar(dm);
    /* (con manos se apaga en 0,25 s; sin manos vuelve) */
    const pmat = this.punto.material; pmat.opacity = conMano ? Math.max(0, pmat.opacity - dt / 0.25) : Math.min(0.9, pmat.opacity + dt / 0.25); this.punto.visible = pmat.opacity > 0.01;
    /* lo que se ve del escaneo */
    const verE = this.verEscaneo || this.fase === 'escaneo' || this.fase === 'buscando', U = this.uVer;
    U.value = verE ? Math.min(1, U.value + dt / 0.3) : Math.max(0, U.value - dt / 0.8);
    /* (con la malla, los planos no se dibujan: la malla ya los tiene, y encima se veían dos grillas) */
    this.vox.visible = this.grupoMalla.visible = U.value > 0.005; this.grupoPlanos.visible = U.value > 0.005 && !this.malla.cuadros;
    this.bombearMalla(); this.rehacerTrozos(2); this.uMalla.uPiso.value = this.pisoY ?? 0;
    this.uVox.uCabeza.value = this.cabezaP;
    if (this.fase === 'manos') { if (!this.fantasma.visible && this.mesa()) this.ponerFantasma(); this.fantasma.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 4); }
    if (dibujar) this.dibujar();
  }
  /* los punteros sobre la tarjeta: la mirada, las yemas y el rayo; tocar la pantalla sin mirar nada
     aprieta el botón principal (con visor no se ve dónde está el dedo) */
  tocarTarjeta(dt, punteros) {
    const T = this.tarjeta; this.apuntaTarjeta = {};
    if (!T.malla.visible) return;
    let sobre = null;
    for (const p of punteros) {
      if (p.yema) {
        const L = T.local(p.yema), antes = T._prof?.[p.id];
        if (L.dentro && Math.abs(L.prof) < 0.035) {
          const b = T.boton(L.u, L.v); sobre = b || sobre; this.apuntaTarjeta[p.id] = p.yema.clone();
          if (b && antes > 0.006 && L.prof <= 0.006) { T.apretar(b); this.sonar('elegir'); this.accion(b.id); p.usado = true; }
          (T._prof ||= {})[p.id] = L.prof; continue;
        }
        if (T._prof) delete T._prof[p.id];
      }
      const r = T.rayo(p.o, p.d);
      if (!r) continue;
      const b = T.boton(r.u, r.v); sobre = b || sobre; this.apuntaTarjeta[p.id] = r.p;
      if (b && (p.empezo || p.clic)) { T.apretar(b); this.sonar('elegir'); this.accion(b.id); p.usado = true; }
    }
    /* (un toque sin mirar nada: el botón principal, si se puede) */
    const m = punteros.find((p) => p.id === 'mirada');
    if (m?.clic && !m.usado && !this.ventanas.alRayo(m.o, m.d)) { const b = T.botones.find((x) => x.principal && !x.apagado); if (b) { T.apretar(b); this.sonar('elegir'); this.accion(b.id); m.usado = true; } }
    T.ponerSobre(sobre); T.refrescar();
  }
  /* (vuelta 42) la 0,5x: pedirla cada segundo hasta que la cabeza esté alineada ('espera'), avisar cuando queda,
     y marcarla en la pantalla */
  prefAncha() { try { return localStorage.getItem(CLAVE_ANCHA) !== '0'; } catch { return true; } }
  cuidarAncha(dt) {
    if (!this.quiereAncha || this.fase !== 'pantalla') return;
    if (Nativo.ancho === 'corre') { if (!this._avisoAncha) { this._avisoAncha = true; this.vr.decir?.(t('es_ancha_lista'), 4); } return; }
    if (Nativo.ancho === 'no-ar') return;
    this.tAncha = (this.tAncha || 0) - dt;
    if (this.tAncha <= 0) { this.tAncha = 1; Nativo.espacioAncho(true); this.nAncha = (this.nAncha || 0) + 1; if (this.nAncha === 6) this.vr.decir?.(t('es_ancha_espera'), 3); }
  }
  /* el campo de la vista (vertical, en grados). Sin visor, el celu en la mano: el de la cámara, que llene la
     pantalla como una app de realidad aumentada, y lo dibujado cae justo encima de lo que se ve. Con visor,
     el del visor */
  campo() {
    const S = this.motor.r.getSize(_v2), L = this.vr.lentes, conL = this.sbs && L?.activa && L.lado, F = this.fotoEn.ultima;
    /* (el ojo con lentes es un lienzo cuadrado; sin lentes, su mitad de la pantalla) */
    const asp = conL ? 1 : this.sbs ? S.x / 2 / S.y : S.x / S.y;
    if (F && (!this.sbs || this.llenar)) return THREE.MathUtils.radToDeg(2 * Math.atan(Math.min(F.ty, F.tx / asp)));
    return conL ? L.fovOjo : this.vr.fov;
  }
  /* por ojo: la escena del espacio y encima las manos (con el paralaje de cada ojo) */
  dibujar() {
    const r = this.motor.r, S = r.getSize(_v2), W = S.x, H = S.y, ojos = this.sbs ? [-1, 1] : [0];
    /* (con visor y lentes: cada ojo a su lienzo, y la lente lo lleva a la pantalla) */
    const Le = this.sbs && this.vr.lentes?.activa ? this.vr.lentes : null;
    if (Le) Le.medir(W / 2, H, r.getPixelRatio(), true);
    const fov = this.campo(), C = this.ojo;
    /* (vuelta 39: con la cabeza nativa, el giro a último momento, para el mismo instante: vr.js › cabezaTarde) */
    if (Nativo.conCabeza && this.tVer) poseEn(this.tVer, this.cabezaQ, _c, OJOS);
    /* (la foto más clara con poca luz: lo que mide Java, la luz media de la foto, 0-1) */
    const L = Nativo.luz, gan = L && L.y > 0 ? THREE.MathUtils.clamp(Math.pow(0.4 / Math.max(L.y, 0.02), 2.2), 1, 3) : 1;
    this.uFoto.uGan.value += (gan - this.uFoto.uGan.value) * 0.1;
    /* (con aumento, los ojos más juntos en la misma medida: si no, lo dibujado cerca se veía doble) */
    const vista = Le ? Le.T : Math.tan(THREE.MathUtils.degToRad(this.vr.fov) / 2), aum = this.sbs ? Math.max(1, vista / Math.tan(THREE.MathUtils.degToRad(fov) / 2)) : 1;
    const auto = r.autoClear; r.autoClear = false; r.setRenderTarget(null); r.setScissorTest(true);
    r.setClearColor('#081422', 1);
    this.uVox.uPx.value = (Le ? Le.lado / 2 : H / 2 * r.getPixelRatio()) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    ojos.forEach((o, i) => {
      const x = this.sbs ? i * W / 2 : 0, w = this.sbs ? W / 2 : W;
      if (Le) { r.setRenderTarget(Le.rt[i]); r.clear(); }
      else { r.setViewport(x, 0, w, H); r.setScissor(x, 0, w, H); r.clear(); }
      C.fov = fov; C.aspect = Le ? 1 : w / H; C.updateProjectionMatrix();
      C.quaternion.copy(this.cabezaQ);
      if (this.mono) C.position.copy(this.camP.set(0, 0, -OJOS).applyQuaternion(this.cabezaQ).add(this.cabezaP));
      else C.position.set(o * IPD / 2 / aum, 0, 0).applyQuaternion(this.cabezaQ).add(this.cabezaP);
      C.updateMatrixWorld();
      r.render(this.escena, C);
      if (this.manos.activa && this.manos.algo) { r.clearDepth(); this.manos.dibujarOjo(r, C); }
    });
    if (Le) Le.componer(r, W, H);
    r.setScissorTest(false); r.setViewport(0, 0, W, H); r.autoClear = auto;
  }
  /* para las pruebas y el cartel de ⏱ */
  get datos() { return { fase: this.fase, planos: this.planos.size, piso: this.pisoY, mesa: !!this.mesa(), vox: this.nVox, malla: { bloques: this.malla.bloques.size, trozos: this.malla.trozos.size, cuadros: this.malla.cuadros, listo: this.pctListo }, fotos: this.fotoEn.llegadas, ventanas: this.ventanas.lista.length, pantalla: !!this.ventanas.pantalla }; }
}
