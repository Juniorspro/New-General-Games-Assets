// El caminante: el modelo de Higgsfield con su esqueleto y cuatro animaciones.
//
// LAS ANIMACIONES VIENEN "EN EL LUGAR" (medido: la cadera se corre 3 mm en
// toda la caminata), así que el avance lo pone el código y la animación tiene
// que ir a la velocidad justa: si camina más rápido de lo que pisa, los pies
// patinan sobre el suelo como sobre hielo. La velocidad de reproducción sale
// de la zancada de cada animación, que está en config.js.
//
// CAMINAR Y CORRER VAN SINCRONIZADOS. Al pasar de uno al otro se mezclan, y si
// cada uno está en su propia fase la pierna izquierda de uno se promedia con
// la derecha del otro: por medio segundo el caminante flota con las piernas
// juntas. Acá la de correr se pone siempre en la misma fase que la de caminar.
import * as THREE from "three";
import { CAMINANTE as C, MUNDO } from "./config.js";
import { altura, normal } from "./terreno.js";
import { vestirNiebla } from "./cielo.js";
import { suave, limitar } from "./azar.js";

// primer cruce del muslo izquierdo hacia adelante en cada clip (medido)
const FASE0 = { camina: 0.467, corre: 0.133 };

export class Caminante {
  constructor(gltf) {
    this.raiz = new THREE.Group();
    this.raiz.name = "caminante";
    this.modelo = gltf.scene;
    this.raiz.add(this.modelo);
    this.modelo.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        // el esqueleto mueve la malla lejos de su caja de reposo: con el
        // recorte por caja, en algunos cuadros el caminante desaparece
        o.frustumCulled = false;
        const m = o.material;
        m.roughness = 0.82; m.metalness = 0; m.envMapIntensity = 0.7;
        vestirNiebla(m);
      }
    });
    // medir el alto de verdad: de los pies a la punta de la cabeza
    this.modelo.updateMatrixWorld(true);
    const cabeza = this.modelo.getObjectByName("head_end");
    const pie = this.modelo.getObjectByName("LeftToeBase");
    const alto = cabeza && pie ? cabeza.getWorldPosition(new THREE.Vector3()).y - pie.getWorldPosition(new THREE.Vector3()).y + 0.08 : C.ALTO;
    this.escala = Math.abs(alto - C.ALTO) > 0.15 ? C.ALTO / alto : 1;
    this.modelo.scale.multiplyScalar(this.escala);
    this.altoMedido = alto;

    this.mixer = new THREE.AnimationMixer(this.modelo);
    this.acc = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      a.play(); a.setEffectiveWeight(0);
      this.acc[clip.name] = a;
    }
    if (this.acc.quieto) this.acc.quieto.setEffectiveWeight(1);
    if (this.acc.mirar) { this.acc.mirar.setLoop(THREE.LoopOnce, 1); this.acc.mirar.clampWhenFinished = false; this.acc.mirar.stop(); }

    this.pos = new THREE.Vector3();
    this.vel = 0;                 // m/s, en el plano
    this.rumbo = 0;               // hacia dónde mira: 0 = +z
    this.quieto = 0;              // segundos parado
    this.mirando = 0;
    this.faseAnt = 0;
    this.hondo = 0;               // cuánta agua tiene encima de los pies
    this.alPisar = null;          // lo llena el audio
  }

  colocar(x, z, rumbo) {
    this.pos.set(x, altura(x, z), z);
    this.rumbo = rumbo;
    this.raiz.position.copy(this.pos);
    this.raiz.rotation.y = rumbo;
  }

  /** @param e entrada {x, y, fuerza, correr} del joystick o el teclado
   *  @param camF dirección de la cámara en el plano {x, z} normalizada */
  paso(dt, e, camF, colisiones, bosque) {
    // ── hacia dónde quiere ir, en el mundo ──
    const der = { x: -camF.z, z: camF.x };
    let mx = camF.x * -e.y + der.x * e.x, mz = camF.z * -e.y + der.z * e.x;
    const m = Math.hypot(mx, mz);
    if (m > 1e-3) { mx /= m; mz /= m; }
    const f = Math.min(1, e.fuerza);
    let objetivo = 0;
    if (f > 0.05) objetivo = e.correr || f >= C.UMBRAL_CORRE ? C.VEL_CORRE : C.VEL_CAMINA * Math.min(1, f / C.UMBRAL_CORRE * 1.25);

    // la loma frena al subir y el agua frena siempre
    const n = normal(this.pos.x, this.pos.z, _n);
    const subida = -(n.x * mx + n.z * mz);
    objetivo *= 1 - limitar(subida * 1.4, 0, 0.35);
    if (this.hondo > 0.25) objetivo *= 0.55;

    // acelerar y frenar con curva, no de golpe: el cuerpo tiene masa
    const k = 1 - Math.exp(-(objetivo > this.vel ? C.ACEL : C.ACEL * 1.6) * dt);
    this.vel += (objetivo - this.vel) * k;
    if (objetivo === 0 && this.vel < 0.03) this.vel = 0;

    if (m > 1e-3 && f > 0.05) {
      const deseado = Math.atan2(mx, mz);
      let d = deseado - this.rumbo;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.rumbo += d * Math.min(1, C.GIRO * dt);
    }

    // ── moverse, chocar, no meterse al agua honda ──
    const ant = this.pos.clone();
    const dx = Math.sin(this.rumbo) * this.vel * dt, dz = Math.cos(this.rumbo) * this.vel * dt;
    this.pos.x += dx; this.pos.z += dz;
    colisiones.resolver(this.pos, C.RADIO, (p, r, empujar) => {
      bosque.cerca(p.x, p.z, 2.5, (a) => empujar({ t: 0, x: a.x, z: a.z, r: a.tronco }));
    });
    const hondo = MUNDO.AGUA - altura(this.pos.x, this.pos.z);
    if (hondo > C.AGUA_MAX) {
      // al agua honda no se entra: se vuelve y se intenta deslizar por la
      // orilla probando cada eje por separado
      const px = this.pos.x, pz = this.pos.z;
      this.pos.x = px; this.pos.z = ant.z;
      if (MUNDO.AGUA - altura(this.pos.x, this.pos.z) > C.AGUA_MAX) { this.pos.x = ant.x; this.pos.z = pz; }
      if (MUNDO.AGUA - altura(this.pos.x, this.pos.z) > C.AGUA_MAX) { this.pos.x = ant.x; this.pos.z = ant.z; }
    }
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > MUNDO.RADIO_JUGABLE) { this.pos.x *= MUNDO.RADIO_JUGABLE / r; this.pos.z *= MUNDO.RADIO_JUGABLE / r; }
    // la velocidad que cuenta es la que de verdad se recorrió: contra un
    // tronco el joystick pide 4 m/s y el caminante no avanza, y las piernas
    // tienen que quedarse quietas, no correr en el lugar
    const real = Math.hypot(this.pos.x - ant.x, this.pos.z - ant.z) / Math.max(dt, 1e-4);
    const velAnim = Math.min(this.vel, real * 1.05 + 0.05);

    const suelo = altura(this.pos.x, this.pos.z);
    this.hondo = Math.max(0, MUNDO.AGUA - suelo);
    // la altura se suaviza un poco: la rejilla es de 2 m y en una arista de
    // loma el cambio de pendiente se sentiría como un escalón
    this.pos.y += (suelo - this.pos.y) * Math.min(1, dt * 18);

    this.raiz.position.copy(this.pos);
    this.raiz.rotation.y = this.rumbo;
    this.animar(dt, velAnim);
  }

  animar(dt, v) {
    const A = this.acc;
    const vNatCam = C.ZANCADA_CAMINA / C.CICLO_CAMINA, vNatCor = C.ZANCADA_CORRE / C.CICLO_CORRE;
    const wQuieto = 1 - suave(0.05, C.VEL_CAMINA * 0.55, v);
    const wCorre = suave(C.VEL_CAMINA * 1.1, C.VEL_CORRE * 0.85, v);
    const wCamina = Math.max(0, 1 - wQuieto - wCorre);

    // la fase de la caminata manda; correr la copia
    const escCam = limitar(v / vNatCam, 0.55, 2.2);
    const escCor = limitar(v / vNatCor, 0.7, 1.6);
    // cuando las dos se mezclan, avanzan a la misma cadencia de ciclo
    const cad = mezcla2(1 / C.CICLO_CAMINA * escCam, 1 / C.CICLO_CORRE * escCor, wCorre / Math.max(1e-3, wCorre + wCamina));
    A.camina.timeScale = cad * C.CICLO_CAMINA;
    A.corre.timeScale = cad * C.CICLO_CORRE;
    const faseCam = (((A.camina.time - FASE0.camina) / C.CICLO_CAMINA) % 1 + 1) % 1;
    A.corre.time = (FASE0.corre + faseCam * C.CICLO_CORRE) % A.corre.getClip().duration;

    // quieto mucho rato: mira alrededor, una vez
    if (v < 0.05) this.quieto += dt; else { this.quieto = 0; }
    let wMirar = 0;
    if (A.mirar) {
      if (this.quieto > 9 && !A.mirar.isRunning()) { A.mirar.reset().play(); this.quieto = -A.mirar.getClip().duration; }
      if (A.mirar.isRunning()) {
        const t = A.mirar.time, dur = A.mirar.getClip().duration;
        wMirar = suave(0, 0.6, t) * (1 - suave(dur - 0.8, dur, t)) * wQuieto;
        if (v > 0.2) A.mirar.stop();
      }
      A.mirar.setEffectiveWeight(wMirar);
    }
    A.quieto.setEffectiveWeight(wQuieto * (1 - wMirar));
    A.camina.setEffectiveWeight(wCamina);
    A.corre.setEffectiveWeight(wCorre);
    this.mixer.update(dt);

    // pasos: dos por ciclo, cuando cada pie llega al piso
    const p0 = this.faseAnt, p1 = faseCam;
    if (v > 0.25 && this.alPisar) {
      for (const marca of [0.25, 0.75]) {
        const cruzo = p1 >= p0 ? (p0 < marca && p1 >= marca) : (marca > p0 || marca <= p1);
        if (cruzo) this.alPisar(v / C.VEL_CORRE, this.hondo);
      }
    }
    this.faseAnt = p1;
  }
}
const mezcla2 = (a, b, t) => a + (b - a) * t;
const _n = new THREE.Vector3();
