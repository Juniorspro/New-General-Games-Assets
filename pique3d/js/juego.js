// Una partida en 3D.
//
// La LOGICA es la misma que valido el generador: fisica.js sin tocar, los
// mismos enemigos, el mismo reloj, las mismas burbujas. Lo unico que cambio es
// que ahora hay objetos en una escena en vez de trazos en un canvas. Mantenerlo
// asi no es pereza: es lo que hace que el validador siga valiendo. Si la
// version 3D tuviera su propia fisica, "nivel comprobado" volveria a ser una
// opinion.

import * as THREE from "../vendor/three.module.min.js";
import { T, V, F, TEMAS, ALTO_TILES } from "./mundo.js";
import { nuevoJugador, paso, tileXY, sumarCombo } from "./fisica.js";
import * as E from "./entidades.js";
import { U, crearEscena, construirTerreno, construirDecorado, Camara, cargarTextura } from "./escena.js";
import { ActorJugador, ActorBicho, crearActor, crearLuminaria } from "./actores.js";
import { efe, musica, pararMusica } from "./audio.js";

export const ESTADO = { JUGANDO: "jugando", BURBUJA: "burbuja", MASTIL: "mastil",
                        GANADO: "ganado", PERDIDO: "perdido" };

const OCULTO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Partida {
  constructor(nv, tier, modelos, movil) {
    this.nv = nv; this.tier = tier; this.movil = movil;
    const tm = TEMAS[nv.tema];
    this.tm = tm;

    const { esc, sol, hemi } = crearEscena(nv.tema, movil);
    this.esc = esc; this.sol = sol;
    this.cam = new Camara();

    this.terreno = construirTerreno(nv, tm,
      cargarTextura(`assets/tex/${nv.tema}.webp`, 1),
      cargarTextura(`assets/tex/${nv.tema}_lado.webp`, 1));
    esc.add(this.terreno);
    const dec = construirDecorado(nv, tm, modelos);
    this.dec = dec;
    esc.add(dec.grupo);

    // --- jugador y bichos ------------------------------------------------
    this.j = nuevoJugador(nv.inicio.x, nv.inicio.y);
    this.actorJ = new ActorJugador(modelos);
    esc.add(this.actorJ.obj);

    this.bichos = nv.enemigos.map((e) => E.crear(e.tipo, e.tx, e.ty));
    this.actores = this.bichos.map((b) => {
      const a = new ActorBicho(b, modelos, tm);
      esc.add(a.obj);
      return a;
    });

    // --- monedas de color -------------------------------------------------
    this.color = nv.monedasColor.map((m) => ({ ...m, tomada: false }));
    this.actoresColor = this.color.map((m) => {
      const o = crearActor("moneda", modelos, "#ff7ac0");
      const col = { rosa: "#ff7ac0", violeta: "#b07aff", negra: "#3a3a46" }[tier];
      o.traverse((x) => {
        if (x.isMesh) {
          x.material = x.material.clone();
          x.material.color = new THREE.Color(col);
          x.material.emissive = new THREE.Color(col);
          x.material.emissiveIntensity = 0.7;
        }
      });
      o.position.set(m.tx + 0.5, -m.ty - 0.5, 0);
      // Una luz propia por moneda: son cinco, y son lo que el jugador esta
      // buscando. Que se vean desde lejos es media mecanica.
      const luz = new THREE.PointLight(new THREE.Color(col), 2.2, 6);
      luz.position.y = 0.5; o.add(luz);
      esc.add(o);
      return o;
    });

    // --- particulas -------------------------------------------------------
    this.part = [];
    this.geoPart = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.mallaPart = new THREE.InstancedMesh(this.geoPart,
      new THREE.MeshBasicMaterial({ vertexColors: true }), 180);
    this.mallaPart.count = 0;
    this.mallaPart.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(180 * 3), 3);
    this.mallaPart.frustumCulled = false;
    esc.add(this.mallaPart);

    // --- burbuja ----------------------------------------------------------
    this.burbujaObj = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 18, 14),
      new THREE.MeshPhysicalMaterial({ color: "#bfe8ff", transparent: true, opacity: 0.32,
        roughness: 0.05, metalness: 0, transmission: 0.85, thickness: 0.4 }));
    this.burbujaObj.visible = false;
    esc.add(this.burbujaObj);

    // --- estado -----------------------------------------------------------
    this.t = 0; this.monedas = 0; this.burbujas = 2;
    this.estado = ESTADO.JUGANDO;
    this.segundos = nv.segundos; this.reloj = nv.segundos * 60;
    this.relojCorre = true; this.mastilAltura = 0; this.sacudida = 0;
    this.jefe = null; this.jefeVivo = false;
    if (nv.cfg.jefe) this.crearJefe(nv.cfg.jefe, modelos);
    this.cam.seguir(this.j.x, this.j.y, 1, true);
    musica(nv.tema, nv.mastilX * 7919);
  }

  crearJefe(tipo, modelos) {
    this.jefe = { tipo, x: (this.nv.mastilX - 12) * T, y: this.nv.pisoMastil * T,
                  vx: -0.9, vy: 0, w: 30, h: 30,
                  vida: tipo === "coloso" ? 4 : 3, invuln: 0, t: 0, suelo: false };
    this.actorJefe = crearActor(tipo, modelos, "#8a3a3a");
    this.esc.add(this.actorJefe);
    this.jefeVivo = true;
    this.dec.bandera.material.color.set("#7a7a86");
  }

  // ---------------------------------------------------------------------
  actualizar(ent, dt = 1 / 60) {
    this.t++;
    if (this.sacudida > 0) this.sacudida--;
    this.pasoParticulas(dt);
    if (this.dec.matLava) this.dec.matLava.uniforms.t.value = this.t / 60;

    if (this.estado === ESTADO.BURBUJA) { this.pasoBurbuja(ent); this.pintar(dt); return; }
    if (this.estado === ESTADO.MASTIL) { this.pasoMastil(); this.pintar(dt); return; }
    if (this.estado !== ESTADO.JUGANDO) { this.pintar(dt); return; }

    this.relojCorre = !this.j.frenado;
    if (this.relojCorre && --this.reloj <= 0) { this.perder("tiempo"); return; }
    if (this.reloj < 600 && this.reloj % 60 === 0) efe.apuro();

    const ev = {};
    paso(this.j, this.nv, ent, ev);
    this.sonarEventos(ev);
    if (ev.cabezazo) this.golpearBloque(ev.cabezazo.tx, ev.cabezazo.ty);
    if (!this.j.vivo) { this.morir(ev.muerte); return; }

    this.recolectar();
    this.bichosPaso(ev);
    if (this.jefeVivo) this.jefePaso();

    if (Math.floor(this.j.x / T) >= this.nv.mastilX && !this.jefeVivo) {
      const suelo = this.nv.pisoMastil * T;
      this.mastilAltura = Math.min(1, Math.max(0, suelo - this.j.y) / (10 * T));
      this.estado = ESTADO.MASTIL; this.mastilY = this.j.y;
      pararMusica(); efe.mastil();
    }
    this.pintar(dt);
  }

  // --- presentacion ------------------------------------------------------
  pintar(dt) {
    this.actorJ.obj.visible = this.estado !== ESTADO.BURBUJA;
    this.actorJ.actualizar(this.j, dt, this.t / 60);
    for (let i = 0; i < this.bichos.length; i++)
      this.actores[i].actualizar(this.bichos[i], dt);
    if (this.jefeVivo && this.actorJefe) {
      const b = this.jefe;
      this.actorJefe.position.set(U(b.x), -U(b.y), 0);
      this.actorJefe.rotation.y = b.vx > 0 ? -0.5 : 0.5;
      this.actorJefe.visible = b.invuln === 0 || (b.invuln >> 2) % 2 === 0;
    }
    for (let i = 0; i < this.color.length; i++) {
      const o = this.actoresColor[i];
      o.visible = !this.color[i].tomada;
      if (o.visible) { o.rotation.y += dt * 2.2; o.position.y = -this.color[i].ty - 0.5 + Math.sin(this.t / 24) * 0.12; }
    }
    // La camara sigue al jugador, y la luz del sol sigue a la camara: la caja
    // de sombra es chica a proposito y si no la mueve, la sombra se corta a
    // media pantalla.
    const objetivo = this.estado === ESTADO.BURBUJA ? { x: this.burbX, y: this.burbY } : this.j;
    this.cam.seguir(objetivo.x, objetivo.y, dt);
    const tm = this.tm;
    // El sol va bien de costado y no de frente. De frente, cada sombra cae
    // justo detras del objeto que la tira y no se ve ninguna: el nivel entero
    // parece plano aunque el motor este calculandolas.
    this.sol.position.set(this.cam.x - 13, this.cam.y + 10 + 10 * tm.solAlt, 9);
    this.sol.target.position.set(this.cam.x, this.cam.y, 0);
    this.sol.target.updateMatrixWorld();
    if (this.sacudida) {
      this.cam.cam.position.x += (Math.random() - .5) * this.sacudida * 0.014;
      this.cam.cam.position.y += (Math.random() - .5) * this.sacudida * 0.014;
    }
  }

  // --- recolectar --------------------------------------------------------
  recolectar() {
    const j = this.j;
    const tx0 = Math.floor((j.x - F.ANCHO / 2) / T), tx1 = Math.floor((j.x + F.ANCHO / 2) / T);
    const ty0 = Math.floor((j.y - F.ALTO) / T), ty1 = Math.floor((j.y - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (tileXY(this.nv, tx, ty) === V.MONEDA) {
          this.nv.grilla[ty * this.nv.ancho + tx] = V.NADA;
          this.monedas++; efe.moneda();
          this.apagarMoneda(tx, ty);
          this.chispas(tx + .5, -ty - .5, 0xffd447, 5);
        }
    for (let i = 0; i < this.color.length; i++) {
      const m = this.color[i];
      if (m.tomada) continue;
      if (Math.abs(j.x - (m.tx * T + 8)) < 14 && Math.abs((j.y - 8) - (m.ty * T + 8)) < 16) {
        m.tomada = true; this.monedas += 10; efe.monedaColor();
        this.chispas(m.tx + .5, -m.ty - .5, 0xff7ac0, 16);
      }
    }
  }

  // Apagar una moneda instanciada = ponerle una matriz de escala cero. Borrar
  // la instancia obligaria a reescribir todas las de atras.
  apagarMoneda(tx, ty) {
    const m = this.dec.monedas.find((c) => c.tx === tx && c.ty === ty);
    if (!m) return;
    this.dec.mallaMon.setMatrixAt(m.i, OCULTO);
    this.dec.mallaMon.instanceMatrix.needsUpdate = true;
  }

  golpearBloque(tx, ty) {
    const v = tileXY(this.nv, tx, ty);
    const i = ty * this.nv.ancho + tx;
    if (v === V.LADRILLO) {
      this.nv.grilla[i] = V.NADA; efe.ladrillo();
      this.chispas(tx + .5, -ty - .5, new THREE.Color(this.tm.tierra).getHex(), 10);
      this.sacudida = 5; this.reconstruirTerreno = true;
    } else if (v === V.PREGUNTA) {
      this.nv.grilla[i] = V.USADO; efe.bloque();
      if (this.burbujas < 4 && ((tx * 7 + ty * 13) % 5 === 0)) { this.burbujas++; efe.burbuja(); }
      else { this.monedas += 3; efe.moneda(); }
      this.chispas(tx + .5, -ty - .5, 0xffd447, 8);
    } else if (v === V.TIEMPO) {
      this.nv.grilla[i] = V.USADO; efe.reloj();
      this.reloj = Math.min(99 * 60, this.reloj + 10 * 60);
      this.chispas(tx + .5, -ty - .5, 0x5ed88a, 8);
    }
  }

  // --- enemigos ----------------------------------------------------------
  bichosPaso(ev) {
    const nuevos = [];
    for (let i = 0; i < this.bichos.length; i++) {
      const e = this.bichos[i];
      if (!e.vivo) continue;
      if (Math.abs(e.x - this.j.x) > 620) continue;
      E.actualizar(e, this.nv, this.j, ev, nuevos);
      if (e.tipo === "caracol" && e.caparazon && e.empujado) {
        const n = E.barrer(e, this.bichos);
        for (let k = 0; k < n; k++) { const p = sumarCombo(this.j); this.monedas += p; efe.combo(this.j.combo); }
      }
      const res = E.chocar(this.j, e);
      if (res === "pisar") {
        const pago = sumarCombo(this.j);
        this.monedas += pago * E.pisado(e, this.j, nuevos);
        this.j.vy = F.PISADA_REBOTE; this.j.giroUsado = false;
        efe.pisada(); if (this.j.combo > 1) efe.combo(this.j.combo);
        this.chispas(U(e.x), -U(e.y) + 0.4, 0xffffff, 7);
        this.sacudida = 4;
      } else if (res === "morir") { this.morir(e.tipo); return; }
    }
    for (const n of nuevos) {
      this.bichos.push(n);
      const a = new ActorBicho(n, this.modelosRef ?? {}, this.tm);
      this.actores.push(a); this.esc.add(a.obj);
    }
  }

  jefePaso() {
    const b = this.jefe, j = this.j;
    b.t++; if (b.invuln > 0) b.invuln--;
    const izq = (this.nv.mastilX - 18) * T, der = (this.nv.mastilX - 4) * T;
    b.x += b.vx;
    if (b.x < izq) { b.x = izq; b.vx = Math.abs(b.vx); }
    if (b.x > der) { b.x = der; b.vx = -Math.abs(b.vx); }
    b.vy += 0.5;
    b.y = Math.min(b.y + b.vy, this.nv.pisoMastil * T);
    if (b.y >= this.nv.pisoMastil * T) { b.y = this.nv.pisoMastil * T; b.vy = 0; b.suelo = true; }
    if (b.suelo && b.t % (b.tipo === "coloso" ? 90 : 120) === 0) { b.vy = -7.5; b.suelo = false; efe.jefe(); }

    if (Math.abs(j.x - b.x) < (F.ANCHO + b.w) / 2 &&
        Math.abs((j.y - 8) - (b.y - b.h / 2)) < (F.ALTO + b.h) / 2) {
      const cayendo = j.vy > 0.5 && (j.y - b.h * 0.3) < b.y - b.h / 2;
      if (cayendo && b.invuln === 0) {
        b.vida--; b.invuln = 50; j.vy = F.PISADA_REBOTE * 1.2;
        this.sacudida = 14; efe.jefe();
        this.chispas(U(b.x), -U(b.y) + 1, 0xff8a2a, 20);
        if (b.vida <= 0) {
          this.jefeVivo = false; this.monedas += 25;
          if (this.actorJefe) this.esc.remove(this.actorJefe);
          this.dec.bandera.material.color.set("#e2495f");
          this.chispas(U(b.x), -U(b.y) + 1, 0xffd447, 40);
        }
      } else if (b.invuln === 0) this.morir("jefe");
    }
  }

  // --- burbuja -----------------------------------------------------------
  morir(causa) {
    this.causa = causa; efe.pinchar();
    this.chispas(U(this.j.x), -U(this.j.y) + 0.5, 0xff6a6a, 18);
    this.sacudida = 16;
    if (this.burbujas <= 0) return this.perder(causa);
    this.burbujas--;
    this.monedas = Math.max(0, this.monedas - 5);
    this.estado = ESTADO.BURBUJA; this.burbujaT = 0;
    this.burbX = this.j.x; this.burbY = Math.min(this.j.y - 20, (ALTO_TILES - 4) * T);
    this.j.combo = 0;
    this.burbujaObj.visible = true;
  }

  pasoBurbuja(ent) {
    this.burbujaT++;
    this.burbX -= 1.5;
    this.burbY += Math.sin(this.burbujaT / 18) * 0.5;
    while (this.burbY > 2 * T && !this.libre(this.burbX, this.burbY)) this.burbY -= T;
    this.burbujaObj.position.set(U(this.burbX), -U(this.burbY) + 0.5, 0);
    this.burbujaObj.rotation.y += 0.02;
    const seguro = this.libre(this.burbX, this.burbY);
    if ((ent.toqueNuevo && seguro && this.burbujaT > 20) || this.burbujaT > 190) {
      if (!seguro) return;
      efe.burbuja();
      this.j = nuevoJugador(this.burbX, this.burbY);
      this.estado = ESTADO.JUGANDO;
      this.burbujaObj.visible = false;
    }
  }

  libre(x, y) {
    for (let dy = 0; dy < 2; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const v = tileXY(this.nv, Math.floor(x / T) + dx, Math.floor(y / T) - dy);
        if (v !== V.NADA && v !== V.MONEDA && v !== V.MASTIL) return false;
      }
    return true;
  }

  pasoMastil() {
    this.mastilY += 2.4;
    const suelo = this.nv.pisoMastil * T;
    this.dec.bandera.position.y = -U(Math.min(this.mastilY, suelo)) + 0.6;
    if (this.mastilY >= suelo && !this.premioDado) {
      this.premioDado = true;
      this.premio = Math.round(this.mastilAltura * 10);
      this.monedas += this.premio;
      this.estado = ESTADO.GANADO;
      efe.ganar();
    }
  }

  perder(causa) { this.causa = causa; this.estado = ESTADO.PERDIDO; pararMusica(); efe.perder(); }

  // --- particulas --------------------------------------------------------
  chispas(x, y, hex, n) {
    const c = new THREE.Color(hex);
    for (let i = 0; i < n && this.part.length < 170; i++)
      this.part.push({ x, y, z: (Math.random() - .5) * .6,
        vx: (Math.random() - .5) * 5, vy: Math.random() * 5 + 1, vz: (Math.random() - .5) * 2,
        vida: 0.5 + Math.random() * 0.4, total: 0.9, c });
  }

  pasoParticulas(dt) {
    const m = this.mallaPart; m.count = 0;
    for (let i = this.part.length - 1; i >= 0; i--) {
      const p = this.part[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 11 * dt;
      p.vida -= dt;
      if (p.vida <= 0) { this.part.splice(i, 1); continue; }
      const k = Math.max(0.05, p.vida / p.total);
      _mp.compose(_pp.set(p.x, p.y, p.z), _qp, _sp.setScalar(k));
      m.setMatrixAt(m.count, _mp);
      m.instanceColor.setXYZ(m.count, p.c.r * k, p.c.g * k, p.c.b * k);
      m.count++;
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  }

  sonarEventos(ev) {
    if (ev.salto) efe.salto();
    if (ev.vaultSalto) { efe.saltoAlto(); this.chispas(U(this.j.x), -U(this.j.y) + .3, 0xffe08a, 6); }
    if (ev.vault || ev.vaultHueco) efe.vault();
    if (ev.saltoPared) { efe.paredazo(); this.chispas(U(this.j.x), -U(this.j.y) + .5, 0xffffff, 7); }
    if (ev.resorte || ev.saltoLargo) efe.resorte();
    if (ev.voltereta) efe.saltoAlto();
    if (ev.pausa || ev.despausa) efe.pausa();
  }

  destruir() {
    pararMusica();
    this.esc.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}

const _mp = new THREE.Matrix4(), _pp = new THREE.Vector3(),
      _qp = new THREE.Quaternion(), _sp = new THREE.Vector3();
