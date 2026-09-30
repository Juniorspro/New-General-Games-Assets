// El corredor: un "noob" de juguete (cabeza amarilla, remera azul, pantalón
// verde) con codos y rodillas, porque con brazos y piernas de una pieza el
// trote parece de palo. Cada parte es su propia malla con el pivote en la
// articulación de arriba: así el mismo cuerpo sirve para las poses y para el
// muñeco de trapo (ragdoll.js), que ubica cada malla desde sus puntos.
//
// Animación: poses como datos (un objetivo por articulación) y un suavizado
// exponencial por canal; los ciclos (caminar, correr, rebotar) se suman
// encima con senos desfasados. Receta de aeroplaza § 7, adaptada.
import * as THREE from '../vendor/three.module.min.js';
import { cajaRedonda, pieza, malla } from './geo.js';
import { materialesDe } from './material.js';
import { cara, remera } from './texturas.js';
import { acercar } from './util.js';

export const COLORES_NOOB = { piel: 0xf5cd30, remera: 0x0d69ac, pantalon: 0xa4bd47, zapato: 0x2b2b33 };

const ARTIC = ['caderaY', 'caderaX', 'caderaZ', 'torsoX', 'torsoZ', 'torsoY', 'cuelloX', 'cuelloY', 'hombroIX', 'hombroIZ', 'hombroIY', 'hombroDX', 'hombroDZ', 'hombroDY', 'codoI', 'codoD', 'piernaIX', 'piernaIZ', 'piernaDX', 'piernaDZ', 'rodillaI', 'rodillaD', 'escala'];

export class Avatar {
  constructor(colores = COLORES_NOOB) {
    const M = materialesDe('avatar');
    const C = colores;
    this.raiz = new THREE.Group();
    this.cadera = new THREE.Group();
    this.cadera.position.y = 0.84;
    this.raiz.add(this.cadera);

    // torso: pivote en la cadera, sube 0,8
    this.torso = new THREE.Group();
    this.cadera.add(this.torso);
    this.mTorso = malla([
      pieza(cajaRedonda(0.8, 0.8, 0.42, 0.07), C.remera, [0, 0.4, 0]),
      pieza(cajaRedonda(0.82, 0.14, 0.44, 0.05), C.pantalon, [0, 0.06, 0]),   // el cinto del pantalón
    ], M.plastico);
    this.torso.add(this.mTorso);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: remera(), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    logo.position.set(0, 0.46, 0.212);
    this.mTorso.add(logo);

    // cabeza: redondeada como la clásica, con la cara en un plano
    this.cuello = new THREE.Group();
    this.cuello.position.y = 0.8;
    this.torso.add(this.cuello);
    this.mCabeza = malla([
      pieza(cajaRedonda(0.62, 0.6, 0.6, 0.2, 3), C.piel, [0, 0.33, 0]),
      pieza(cajaRedonda(0.3, 0.08, 0.3, 0.03), C.piel, [0, 0.02, 0]),   // cuello
    ], M.plastico);
    this.cuello.add(this.mCabeza);
    this.matCara = new THREE.MeshStandardMaterial({ map: cara('normal'), transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    this.planoCara = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), this.matCara);
    this.planoCara.position.set(0, 0.33, 0.303);
    this.mCabeza.add(this.planoCara);

    // brazos: hombro → codo → mano. La manga es de la remera.
    const brazo = (lado) => {
      const hombro = new THREE.Group();
      hombro.position.set(lado * 0.59, 0.72, 0);
      this.torso.add(hombro);
      const sup = malla([
        pieza(cajaRedonda(0.37, 0.44, 0.38, 0.07), C.piel, [0, -0.2, 0]),
        pieza(cajaRedonda(0.39, 0.22, 0.4, 0.07), C.remera, [0, -0.06, 0]),
      ], M.plastico);
      hombro.add(sup);
      const codo = new THREE.Group();
      codo.position.y = -0.4;
      sup.add(codo);
      const ante = malla([pieza(cajaRedonda(0.35, 0.44, 0.36, 0.08), C.piel, [0, -0.2, 0])], M.plastico);
      codo.add(ante);
      const mano = new THREE.Object3D();
      mano.position.set(0, -0.4, 0.02);
      ante.add(mano);
      return { hombro, sup, codo, ante, mano };
    };
    this.bI = brazo(1); this.bD = brazo(-1);

    // piernas: cadera → rodilla → pie (el calzado se engancha en el pie)
    const pierna = (lado) => {
      const cad = new THREE.Group();
      cad.position.set(lado * 0.2, 0.02, 0);
      this.cadera.add(cad);
      const muslo = malla([pieza(cajaRedonda(0.39, 0.44, 0.4, 0.07), C.pantalon, [0, -0.2, 0])], M.plastico);
      cad.add(muslo);
      const rod = new THREE.Group();
      rod.position.y = -0.41;
      muslo.add(rod);
      const pant = malla([pieza(cajaRedonda(0.37, 0.4, 0.38, 0.07), C.pantalon, [0, -0.18, 0])], M.plastico);
      rod.add(pant);
      const pie = new THREE.Group();
      pie.position.set(0, -0.4, 0.02);
      pant.add(pie);
      // el pie de siempre (se esconde si hay calzado)
      const base = malla([pieza(cajaRedonda(0.38, 0.12, 0.46, 0.05), C.zapato, [0, 0.02, 0.05])], M.plastico);
      pie.add(base);
      return { cad, muslo, rod, pant, pie, base };
    };
    this.pI = pierna(1); this.pD = pierna(-1);

    this.raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.planoCara.castShadow = false; logo.castShadow = false;

    // el objeto en las manos (la bomba) va adelante del pecho
    this.enManos = new THREE.Group();
    this.enManos.position.set(0, 0.42, 0.52);
    this.torso.add(this.enManos);

    this.pose = {};
    for (const k of ARTIC) this.pose[k] = k === 'escala' ? 1 : 0;
    this.estado = 'quieto';
    this.fase = 0;
    this.t = 0;
    this.velocidad = 0;
    this.altura = 0;          // rebote extra (saltos, trampolín)
    this.expresion = 'normal';
    this.tParpadeo = 2;
    this.caras = { normal: 'normalC', corre: 'correC' };
    this.calzado = null;
  }

  ponerCara(nombre) {
    if (nombre === this.expresion) return;
    this.expresion = nombre;
    this.matCara.map = cara(nombre);
  }

  // Calzado: un modelo por pie (equipo.js lo arma); null vuelve al pie liso.
  ponerCalzado(fabrica) {
    for (const p of [this.pI, this.pD]) {
      if (p.calzado) { p.pie.remove(p.calzado); p.calzado = null; }
      p.base.visible = !fabrica;
      if (fabrica) { p.calzado = fabrica(); p.pie.add(p.calzado); }
    }
  }

  // ── la animación ─────────────────────────────────────────────────────────
  // estado: quieto · caminar · correr · bomba · sorpresa · saltoAire · trampolin · pesas · festejo · sentado
  actualizar(dt, estado = this.estado, velocidad = 0) {
    this.estado = estado;
    this.t += dt;
    this.velocidad = velocidad;
    const P = this.objetivo(dt);
    const k = estado === 'sorpresa' ? 22 : 13;
    for (const a of ARTIC) this.pose[a] = acercar(this.pose[a], P[a] ?? (a === 'escala' ? 1 : 0), k, dt);
    this.aplicar();
    // parpadeo: los ojos cerrados un instante cada tanto (si la cara tiene
    // su versión cerrada)
    this.tParpadeo -= dt;
    if (this.tParpadeo <= 0) {
      const cerrada = this.caras[this.expresion];
      if (cerrada && this.tParpadeo > -0.12) this.matCara.map = cara(cerrada);
      else { this.tParpadeo = 2 + Math.random() * 3; this.matCara.map = cara(this.expresion); }
    }
  }

  objetivo(dt) {
    const P = {}, t = this.t, e = this.estado, v = this.velocidad;
    // la fase avanza con lo recorrido: el paso sigue al piso, no al reloj
    // (medio ciclo por paso; con las zapatillas sónicas se topea en 8 pasos
    // por segundo: más, y las piernas se vuelven una rueda de dibujito)
    const zancada = e === 'caminar' ? 0.75 : 1.15;
    this.fase += dt * Math.min(8, v / zancada) * Math.PI;
    const f = this.fase;
    const respira = Math.sin(t * 2.2) * 0.025;
    switch (e) {
      case 'caminar':
      case 'correr':
      case 'bomba': {
        const corre = e !== 'caminar';
        const A = corre ? 0.95 : 0.6;
        const s = Math.sin(f), c = Math.cos(f);
        P.piernaIX = s * A; P.piernaDX = -s * A;
        // la rodilla se dobla cuando la pierna viene hacia adelante
        P.rodillaI = Math.max(0, -Math.cos(f - 0.6)) * (corre ? 1.55 : 0.9) + 0.1;
        P.rodillaD = Math.max(0, Math.cos(f - 0.6)) * (corre ? 1.55 : 0.9) + 0.1;
        P.caderaY = Math.abs(c) * (corre ? 0.1 : 0.05);
        P.torsoX = corre ? 0.24 : 0.08;
        P.torsoY = s * 0.12;
        P.cuelloX = -P.torsoX * 0.7;
        if (e === 'bomba') {
          // brazos adelante abrazando la bomba; un saltito cada paso
          P.hombroIX = -1.2 + Math.sin(f * 2) * 0.05; P.hombroDX = -1.2 - Math.sin(f * 2) * 0.05;
          P.hombroIZ = -0.32; P.hombroDZ = 0.32;
          P.codoI = -0.55; P.codoD = -0.55;
          P.torsoX = 0.16;
        } else {
          P.hombroIX = -s * (corre ? 1.0 : 0.55); P.hombroDX = s * (corre ? 1.0 : 0.55);
          P.hombroIZ = 0.08; P.hombroDZ = -0.08;
          P.codoI = corre ? -1.3 : -0.35; P.codoD = corre ? -1.3 : -0.35;
        }
        break;
      }
      case 'sorpresa':
        // los brazos para arriba, las piernas abiertas y la cabeza hacia atrás
        P.hombroIX = -2.7; P.hombroDX = -2.7; P.hombroIZ = 0.55; P.hombroDZ = -0.55;
        P.codoI = -0.25; P.codoD = -0.25;
        P.piernaIZ = 0.28; P.piernaDZ = -0.28; P.rodillaI = 0.25; P.rodillaD = 0.25;
        P.torsoX = -0.18; P.cuelloX = -0.3;
        P.caderaY = 0.18;
        break;
      case 'saltoAire':
        P.piernaIX = -0.6; P.rodillaI = 1.2; P.piernaDX = 0.2; P.rodillaD = 0.4;
        P.hombroIX = -2.2; P.hombroDX = -0.6; P.hombroIZ = 0.3; P.hombroDZ = -0.3;
        P.codoI = -0.3; P.codoD = -0.6;
        break;
      case 'trampolin': {
        // saltos de estrella: arriba abre brazos y piernas, abajo se junta
        const u = Math.abs(Math.sin(t * Math.PI * 1.25));
        this.altura = u * 1.25;
        P.hombroIX = -2.6 * u; P.hombroDX = -2.6 * u; P.hombroIZ = 0.35 + u * 0.4; P.hombroDZ = -0.35 - u * 0.4;
        P.piernaIZ = u * 0.45; P.piernaDZ = -u * 0.45;
        P.rodillaI = (1 - u) * 0.6; P.rodillaD = (1 - u) * 0.6;
        P.escala = 1 + (u < 0.12 ? (0.12 - u) * -0.9 : 0);
        break;
      }
      case 'pesas': {
        // sentadilla y press: la barra con dos bombas sube y baja
        const u = 0.5 - 0.5 * Math.cos(t * 2.4);
        P.hombroIX = -2.9 + u * 0.4; P.hombroDX = -2.9 + u * 0.4; P.hombroIZ = 0.6; P.hombroDZ = -0.6;
        P.codoI = -1.7 * u - 0.1; P.codoD = -1.7 * u - 0.1;
        P.piernaIX = -0.9 * u; P.piernaDX = -0.9 * u; P.rodillaI = 1.6 * u; P.rodillaD = 1.6 * u;
        P.piernaIZ = 0.18; P.piernaDZ = -0.18;
        P.caderaY = -0.36 * u;
        P.torsoX = 0.25 * u;
        break;
      }
      case 'festejo': {
        const u = Math.abs(Math.sin(t * 5));
        this.altura = u * 0.35;
        P.hombroIX = -2.8 + Math.sin(t * 10) * 0.3; P.hombroDX = -2.8 - Math.sin(t * 10) * 0.3;
        P.hombroIZ = 0.4; P.hombroDZ = -0.4; P.codoI = -0.4; P.codoD = -0.4;
        P.rodillaI = (1 - u) * 0.5; P.rodillaD = (1 - u) * 0.5;
        break;
      }
      case 'sentado':
        P.piernaIX = -1.5; P.piernaDX = -1.5; P.rodillaI = 1.5; P.rodillaD = 1.5; P.caderaY = -0.45;
        P.hombroIX = -0.3; P.hombroDX = -0.3; P.codoI = -0.8; P.codoD = -0.8;
        break;
      default:
        // quieto: respira, se balancea apenas y mira alrededor
        P.torsoX = respira * 0.5;
        P.hombroIZ = 0.06 + respira; P.hombroDZ = -0.06 - respira;
        P.codoI = -0.12; P.codoD = -0.12;
        P.cuelloY = Math.sin(t * 0.45) * 0.25;
        P.cuelloX = Math.sin(t * 0.7) * 0.05;
        P.escala = 1 + respira * 0.3;
    }
    if (e !== 'trampolin' && e !== 'festejo') this.altura = acercar(this.altura, 0, 8, dt);
    return P;
  }

  aplicar() {
    const p = this.pose;
    this.cadera.position.y = 0.84 + p.caderaY + this.altura;
    this.cadera.rotation.set(p.caderaX, 0, p.caderaZ);
    this.cadera.scale.set(1 / Math.sqrt(p.escala), p.escala, 1 / Math.sqrt(p.escala));
    this.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
    this.cuello.rotation.set(p.cuelloX, p.cuelloY, 0);
    this.bI.hombro.rotation.set(p.hombroIX, p.hombroIY, p.hombroIZ);
    this.bD.hombro.rotation.set(p.hombroDX, p.hombroDY, p.hombroDZ);
    this.bI.codo.rotation.x = p.codoI; this.bD.codo.rotation.x = p.codoD;
    this.pI.cad.rotation.set(p.piernaIX, 0, p.piernaIZ);
    this.pD.cad.rotation.set(p.piernaDX, 0, p.piernaDZ);
    this.pI.rod.rotation.x = p.rodillaI; this.pD.rod.rotation.x = p.rodillaD;
  }

  // Las 10 mallas que el muñeco de trapo mueve sueltas, con el eje en su
  // articulación de arriba. El torso y la cabeza crecen hacia +Y; los brazos
  // y piernas cuelgan hacia −Y.
  partes() {
    return {
      torso: this.mTorso, cabeza: this.mCabeza,
      supI: this.bI.sup, supD: this.bD.sup, anteI: this.bI.ante, anteD: this.bD.ante,
      musloI: this.pI.muslo, musloD: this.pD.muslo, pantI: this.pI.pant, pantD: this.pD.pant,
    };
  }
}
