/* ============================================================================
   nevada/js/director.js — la cinemática: doce planos cortados al ritmo del
   phonk (120 BPM: un tiempo cada 0,5 s), como en el video de referencia.
     0–3 s     el desglose en arcilla (tres planos), y a los 3 s el "drop":
               destello y aparece el render;
     3–4,5     frente bajo: el tigre camina hacia la cámara, el auto atrás;
     4,5–5,25  empujón al frente del auto con desenfoque de zoom;
     5,25–7    tres cuartos bajo, el tigre echado al lado de la rueda;
     7–7,5     barrido rápido;
     7,5–9     la cola del auto, bajo, con las luces rojas;
     9–10,5    primerísimo plano del tigre, que ruge a los 9,5 s;
     10,5–11   zoom de salida;
     11–13     órbita rápida alrededor del auto;
     13–16,5   el auto se va por el camino;
     16,5–18,5 el título.
   Todo depende SOLO del tiempo: irA(t) deja la escena exactamente como se ve
   en ese instante (así se puede sacar una foto de cada plano en las pruebas);
   por eso los tigres se ponen con pose(t) y no con paso(dt).
   ========================================================================== */
import * as THREE from 'three';
import { caminoX, alturaSuelo } from './ruido.js';
import { materialArcilla } from './modelos.js';

export const DURACION = 18.5;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const suave = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const sale = (x) => 1 - Math.pow(1 - clamp(x), 3);
const entra = (x) => Math.pow(clamp(x), 3);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vl = (a, b, t) => a.clone().lerp(b, t);

/* ruido suave para la cámara en mano */
const hs = (n) => { const s = Math.sin(n * 91.345) * 47453.5453; return s - Math.floor(s); };
const ruido1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hs(i), hs(i + 1), u) * 2 - 1; };

export function crearDirector({ camara, post, mundo, auto, tigres, musica }) {
  const P0 = V(caminoX(0), 0, 0);                     // donde está parado el auto
  const rumbo = Math.atan2(caminoX(0.5) - caminoX(-0.5), 1);
  if (auto) { auto.grupo.position.copy(P0); auto.grupo.rotation.y = rumbo; }

  /* un punto en el sistema del auto: x al costado (la izquierda es negativa), z hacia la trompa */
  const A = (x, y, z) => V(P0.x + x * Math.cos(rumbo) + z * Math.sin(rumbo), y, P0.z - x * Math.sin(rumbo) + z * Math.cos(rumbo));

  /* el tigre echado, al costado izquierdo del auto a la altura de la rueda de
     adelante: la cabeza hacia la trompa y la cara hacia afuera */
  const T = tigres || {};
  const posEchado = A(-1.95, 0, 1.15);
  if (T.echado) { T.echado.grupo.position.copy(posEchado); T.echado.grupo.rotation.y = rumbo + Math.PI - 0.12; }
  /* la cabeza del que ruge, donde está la cabeza del echado */
  const cabezaEchado = new THREE.Vector3();
  if (T.echado) { T.echado.grupo.updateMatrixWorld(true); cabezaEchado.copy(T.echado.cabeza).applyMatrix4(T.echado.grupo.matrixWorld); }
  if (T.ruge) { T.ruge.grupo.position.set(cabezaEchado.x - 0.1, 0, cabezaEchado.z - 0.25); T.ruge.grupo.rotation.y = 0.25; }
  const mundoRef = mundo;

  /* ---------------- el modo arcilla ---------------- */
  const arcilla = { activo: false, piso: null, guardado: new Map() };
  const conArcilla = [];
  if (auto) { conArcilla.push([auto.malla, 3]); auto.ruedas.forEach((r, i) => conArcilla.push([r, 11 + i])); }
  if (T.parado) conArcilla.push([T.parado.rig.piel, 5]);
  if (T.echado) conArcilla.push([T.echado.rig.piel, 7]);
  if (T.ruge) conArcilla.push([T.ruge.malla, 9]);
  const matsArcilla = new Map(conArcilla.map(([m, s]) => {
    m.geometry.computeBoundingBox();
    return [m, materialArcilla(s, m.geometry.boundingBox.getSize(new THREE.Vector3()))];
  }));
  const pisoArcilla = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#9aa266', roughness: 1 }));
  pisoArcilla.rotation.x = -Math.PI / 2; pisoArcilla.position.y = 0.005; pisoArcilla.receiveShadow = true; pisoArcilla.visible = false;
  mundo.escena.add(pisoArcilla);
  const ocultables = [mundo.suelo, mundo.arboles, mundo.copos.grupo, ...mundo.escena.children.filter((o) => o.isMesh && (o.geometry.type === 'CylinderGeometry' || o.geometry.type === 'SphereGeometry' || o.isInstancedMesh))];
  const fondoRender = mundo.escena.background.clone(), fondoArcilla = new THREE.Color('#8e975f');
  function ponerArcilla(si) {
    if (si === arcilla.activo) return;
    arcilla.activo = si;
    for (const [m] of conArcilla) {
      if (si) { arcilla.guardado.set(m, m.material); m.material = matsArcilla.get(m); } else if (arcilla.guardado.has(m)) m.material = arcilla.guardado.get(m);
    }
    ocultables.forEach((o) => { if (o) o.visible = !si; });
    pisoArcilla.visible = si;
    mundo.escena.background = si ? fondoArcilla : fondoRender;
    mundo.escena.fog.color.set(si ? '#8e975f' : '#d3d8dd');
    mundo.escena.fog.density = si ? 0.012 : 0.022;
    mundo.escena.environmentIntensity = si ? 0.35 : 0.9;
    post.u.uArcilla.value = si ? 1 : 0;
  }

  /* ---------------- los planos ---------------- */
  /* cada plano devuelve la cámara (pos, mira, fov, roll) para u ∈ [0,1] y el
     estado de la escena; "mano" es cuánto tiembla la cámara en mano */
  const planos = [
    /* el desglose: de lejos (auto y tigre enteros), la trompa, y la cabeza del tigre */
    { t0: 0, t1: 1, arcilla: true, mano: 0.35, tigre: 'echado',
      cam: (u) => ({ pos: vl(A(-7.6, 3.7, 9.2), A(-6.9, 3.35, 8.3), u), mira: A(-0.7, 0.35, 0.5), fov: 44 }) },
    { t0: 1, t1: 2, arcilla: true, mano: 0.4, tigre: 'echado',
      cam: (u) => ({ pos: vl(A(-1.9, 0.5, 6.9), A(-1.6, 0.45, 6.3), u), mira: A(-0.4, 0.45, 1.6), fov: 36 }) },
    { t0: 2, t1: 3, arcilla: true, mano: 0.6, tigre: 'echado',
      cam: (u) => ({ pos: vl(A(-4.2, 0.95, 3.4), A(-3.2, 0.85, 2.7), entra(u) * 0.8 + u * 0.2), mira: V(cabezaEchado.x, cabezaEchado.y - 0.05, cabezaEchado.z), fov: lerp(34, 26, entra(u)) }) },
    /* el render: el tigre camina hacia la cámara con el auto atrás */
    { t0: 3, t1: 4.5, mano: 1, tigre: 'camina', faros: 1,
      cam: (u) => ({ pos: vl(A(0.25, 0.52, 10.2), A(0.2, 0.5, 11.3), u), mira: A(-0.15, 0.85, 2.0), fov: 38 }) },
    { t0: 4.5, t1: 5.25, mano: 1.4, tigre: 'nada', faros: 1,
      cam: (u) => ({ pos: vl(A(0.1, 0.95, 8.0), A(0.05, 0.75, 3.9), entra(u)), mira: A(0, 0.6, 1.5), fov: lerp(40, 30, u) }) },
    /* tres cuartos bajo: el tigre echado al lado de la rueda */
    { t0: 5.25, t1: 7, mano: 1, tigre: 'echado', faros: 1,
      cam: (u) => ({ pos: vl(A(-4.4, 0.55, 6.4), A(-3.9, 0.48, 5.7), u), mira: A(-1.3, 0.5, 1.2), fov: 36 }) },
    { t0: 7, t1: 7.5, mano: 0.6, tigre: 'echado', faros: 1, traseras: 0.8,
      cam: (u) => { const a = lerp(-0.95, -2.5, entra(u) * 0.7 + u * 0.3); return { pos: A(Math.sin(a) * 5.2, 0.55, Math.cos(a) * 5.2), mira: A(0, 0.6, 0), fov: 38 }; } },
    /* la cola, bajo, con las luces rojas */
    { t0: 7.5, t1: 9, mano: 1, tigre: 'echado', faros: 1, traseras: 0.9,
      cam: (u) => ({ pos: vl(A(-2.7, 0.3, -5.4), A(-2.25, 0.75, -4.7), sale(u)), mira: A(-0.1, 0.6, -1.2), fov: 36 }) },
    /* el rugido */
    { t0: 9, t1: 10.5, mano: 0.8, tigre: 'ruge', faros: 1, traseras: 0.9,
      cam: (u) => { const c = cabezaEchado; return { pos: V(c.x + 0.25, lerp(0.95, 0.9, u), c.z + lerp(2.0, 1.55, sale(u))), mira: V(c.x - 0.05, 0.78, c.z - 0.2), fov: lerp(34, 30, u) }; } },
    { t0: 10.5, t1: 11, mano: 1.2, tigre: 'ruge', faros: 1, traseras: 0.9,
      cam: (u) => { const c = cabezaEchado; return { pos: vl(V(c.x + 0.25, 0.9, c.z + 1.5), V(c.x + 0.2, 0.85, c.z + 0.9), entra(u)), mira: V(c.x - 0.05, 0.78, c.z - 0.2), fov: lerp(30, 22, entra(u)) }; } },
    /* la vuelta alrededor del auto y la salida por el camino */
    { t0: 11, t1: 13, mano: 1, tigre: 'nada', faros: 1, traseras: 1,
      cam: (u) => { const a = lerp(-1.2, -3.05, sale(u)); const r = lerp(5.0, 6.2, u); return { pos: A(Math.sin(a) * r, lerp(0.75, 0.6, u), Math.cos(a) * r), mira: A(0, 0.55, 0), fov: 38 }; } },
    { t0: 13, t1: 16.5, mano: 0.9, tigre: 'nada', faros: 1, traseras: 1, anda: true,
      cam: (u, t) => { const z = posAuto(t).z; return { pos: V(P0.x + 0.15, 0.55, -6.2 + Math.min(z, 3.2) * 0.7), mira: V(caminoX(z), 0.6, z + 2), fov: 36 }; } },
    { t0: 16.5, t1: DURACION, mano: 0.4, tigre: 'nada', faros: 1, traseras: 1, anda: true, titulo: true,
      cam: (u, t) => { const z = posAuto(t).z; return { pos: V(P0.x + 0.15, 0.55 + u * 0.4, -6.2 + 3.2 * 0.7), mira: V(caminoX(z), 0.6 + u * 0.5, z + 2), fov: 36 }; } },
  ];


  /* el auto arranca a los 13 s y acelera por el camino */
  function posAuto(t) {
    const s = Math.max(0, t - 13.1);
    const z = 0.5 * 3.2 * s * s + 0.6 * s * s * s * 0.1;   // aceleración creciente
    return V(caminoX(z), 0, z);
  }

  /* ---------------- las transiciones y efectos, en función del tiempo ---------------- */
  function efectos(t) {
    const pulso = (c, ancho) => Math.max(0, 1 - Math.abs(t - c) / ancho);
    const u = post.u;
    // zoom: sube antes del corte y cae después
    let zoom = 0;
    zoom += suave((t - 2.55) / 0.45) * (t < 3 ? 1 : 0) * 1.1;                    // la entrada al render
    zoom += (t >= 3 ? 1 : 0) * Math.max(0, 1 - (t - 3) / 0.35) * 0.9;
    zoom += suave((t - 4.75) / 0.5) * (t < 5.25 ? 1 : 0) * 1.3 + (t >= 5.25 ? Math.max(0, 1 - (t - 5.25) / 0.25) : 0) * 0.8;
    zoom += pulso(9.52, 0.12) * 0.9;                                                // el rugido
    zoom += suave((t - 10.6) / 0.4) * (t < 11 ? 1 : 0) * 1.5 + (t >= 11 ? Math.max(0, 1 - (t - 11) / 0.3) : 0) * 1.0;
    u.uZoom.value = zoom;
    // barrido horizontal en el paneo rápido y en la órbita
    let bx = 0;
    bx += pulso(7.25, 0.3) * 0.09;
    bx += (t > 11 && t < 13 ? Math.max(0, 1 - (t - 11) / 1.6) * 0.035 : 0);
    u.uBarrido.value.set(bx, 0);
    // destellos en los cortes fuertes
    u.uDestello.value = Math.max(pulso(3.0, 0.16) * 0.95, pulso(9.52, 0.08) * 0.35, pulso(11.0, 0.1) * 0.5);
    // el final: la imagen baja un poco cuando entra el título (si no, las letras
    // blancas se pierden en la niebla) y después se va a negro
    u.uNegro.value = suave((t - 16.6) / 0.8) * 0.4 + suave((t - 17.7) / 0.8) * 0.6;
    u.uExposicion.value = 1 + suave((t - 16.2) / 0.6) * 0.08;
  }

  /* ---------------- aplicar el instante t ---------------- */
  const tmp = new THREE.Vector3();
  function irA(t) {
    const p = planos.find((q) => t >= q.t0 && t < q.t1) || planos[planos.length - 1];
    const u = clamp((t - p.t0) / (p.t1 - p.t0));
    ponerArcilla(!!p.arcilla);

    /* el auto */
    if (auto) {
      const pa = p.anda ? posAuto(t) : V(P0.x, 0, 0);
      auto.grupo.position.set(pa.x, alturaSuelo(pa.x, pa.z) * 0.0, pa.z);
      const ad = posAuto(t + 0.05);
      auto.grupo.rotation.y = p.anda ? Math.atan2(ad.x - pa.x, Math.max(1e-4, ad.z - pa.z)) : rumbo;
      auto.rodar(pa.z);
      // la carrocería se hamaca un poco al arrancar (se agacha de atrás)
      const arr = p.anda ? Math.max(0, 1 - Math.abs(t - 13.4) / 0.6) : 0;
      auto.carroceria.rotation.x = -arr * 0.018;
      auto.luces(p.faros ?? 1, p.traseras ?? 0.25);
    }

    /* los tigres: uno por vez */
    const quien = p.tigre;
    if (T.parado) T.parado.grupo.visible = quien === 'camina';
    if (T.echado) T.echado.grupo.visible = quien === 'echado';
    if (T.ruge) T.ruge.grupo.visible = quien === 'ruge';
    if (T.parado && quien === 'camina') {
      // camina desde el auto hacia la cámara: arranca en el primer plano del render
      const s = t - 3, vel = 1.05;
      T.parado.grupo.position.copy(A(-0.35 + Math.sin(s * 0.8) * 0.05, 0, 3.0 + s * vel));
      T.parado.grupo.rotation.y = rumbo + 0.05;
      T.parado.rig.pose(s, s * vel, vel);
    }
    if (T.echado && quien === 'echado') T.echado.rig.pose(t, { mira: t > 5.25 ? -0.25 : 0 });
    if (T.ruge && quien === 'ruge') {
      const r = Math.max(0, 1 - Math.abs(t - 9.6) / 0.5);
      T.ruge.grupo.scale.setScalar(1 + r * 0.03);
      T.ruge.grupo.rotation.x = -r * 0.08;
    }

    /* la cámara */
    const c = p.cam(u, t);
    camara.position.copy(c.pos);
    // cámara en mano: dos ruidos (uno lento que respira y uno rápido que tiembla)
    const k = p.mano * (1 + Math.max(0, 1 - Math.abs(t - 9.55) / 0.35) * 5);   // el rugido sacude
    const nx = ruido1(t * 0.9) * 0.035 + ruido1(t * 6.1 + 30) * 0.008;
    const ny = ruido1(t * 0.8 + 11) * 0.025 + ruido1(t * 5.7 + 50) * 0.007;
    camara.position.x += nx * k; camara.position.y += ny * k;
    camara.position.y = Math.max(camara.position.y, alturaSuelo(camara.position.x, camara.position.z) + 0.18);
    tmp.copy(c.mira);
    tmp.x += ruido1(t * 0.7 + 3) * 0.05 * k; tmp.y += ruido1(t * 0.6 + 7) * 0.04 * k;
    camara.lookAt(tmp);
    camara.rotateZ((ruido1(t * 0.5 + 99) * 0.006 + (c.roll || 0)) * k);
    if (camara.fov !== c.fov) { camara.fov = c.fov; camara.updateProjectionMatrix(); }

    efectos(t);
    mundo.seguirSombra(auto ? auto.grupo.position : P0);
    mundo.copos.paso(t, camara, 1);
    musica?.hasta?.(t);
    return p;
  }

  return { irA, planos, ponerArcilla, P0, posAuto, get arcilla() { return arcilla.activo; }, cabezaEchado };
}
