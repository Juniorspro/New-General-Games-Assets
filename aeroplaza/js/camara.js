/* ============================================================================
   aeroplaza/js/camara.js — la cámara en tercera persona: da vueltas alrededor
   del muñeco (arrastrando, con la rueda o el palito derecho), no se mete
   adentro del piso, y tiene el modo cine de las charlas con NPC (se acerca y
   encuadra a los dos de costado, como en BRILLO pero en 3D).
   Adentro de los edificios va en primera persona (fp): en los ojos, con el
   paso que hamaca un poco la cabeza, y al charlar mira sola a quien habla.
   ========================================================================== */
import * as THREE from 'three';

export class Camara {
  constructor(cam) {
    this.cam = cam;
    this.yaw = Math.PI; this.pitch = 0.3; this.dist = 5.4; this.distObj = 5.4;
    this.obj = new THREE.Vector3(); this.pos = new THREE.Vector3(); this.mira = new THREE.Vector3();
    this.cine = null; this.kCine = 0;
    this.sacudida = 0; this.kSprint = 0; this.fasePaso = 0; this.ladeo = 0;
    this.inicial = true;
    this.fp = false; this.sentado = false; this.bajaFP = 0; this.fase = 0;
  }
  girar(dx, dy) { this.yaw -= dx; this.pitch = THREE.MathUtils.clamp(this.pitch + dy, this.fp ? -0.95 : -0.45, this.fp ? 1.55 : 1.25); }
  acercar(f) { if (this.fp) return; this.distObj = THREE.MathUtils.clamp(this.distObj * f, 2.4, 14); }
  /* modo cine: a (el jugador) y b (quien habla) */
  ponerCine(a, b) { this.cine = a ? { a: a.clone(), b: b.clone() } : null; }
  detras(rumbo) { this.yaw = rumbo + Math.PI; }
  actualizar(dt, jugador, mundo) {
    if (this.fp) { this.actualizarFP(dt, jugador); return; }
    const k = jugador.escala;
    const alto = 1.25 * k + (jugador.modo === 'burbuja' ? 0.3 : 0);
    this.obj.set(jugador.p.x, jugador.p.y + alto, jugador.p.z);
    this.kCine += ((this.cine ? 1 : 0) - this.kCine) * Math.min(1, dt * 3);
    this.dist += (this.distObj * (0.75 + 0.25 * k) * (jugador.modo === 'montado' ? jugador.montura?.camDist ?? 1.35 : 1) - this.dist) * Math.min(1, dt * 6);
    const cp = Math.cos(this.pitch);
    const desde = new THREE.Vector3(
      this.obj.x + Math.sin(this.yaw) * cp * this.dist,
      this.obj.y + Math.sin(this.pitch) * this.dist,
      this.obj.z + Math.cos(this.yaw) * cp * this.dist);
    const mira = this.obj.clone();
    if (this.kCine > 0.001 && this.cine) {
      /* de costado, a la altura de las caras, cerca: el plano de dos */
      const { a, b } = this.cine;
      const medio = a.clone().add(b).multiplyScalar(0.5); medio.y += 1.05;
      const ab = b.clone().sub(a); ab.y = 0; const L = Math.max(1.2, ab.length()); ab.normalize();
      const lado = new THREE.Vector3(-ab.z, 0, ab.x);
      /* del lado donde ya estaba la cámara (no cruza el eje) */
      if (lado.dot(desde.clone().sub(medio)) < 0) lado.negate();
      const cine = medio.clone().addScaledVector(lado, 1.6 + L * 0.9).addScaledVector(ab, -0.35); cine.y += 0.3;
      desde.lerp(cine, this.kCine); mira.lerp(medio, this.kCine);
    }
    /* que no se meta en el piso, atrás de una loma ni adentro de una casa: se
       busca el primer tramo libre. Se acerca rápido y se aleja despacio (si no,
       al pasar junto a un árbol la cámara salta para adelante y para atrás) */
    if (mundo) {
      const dir = desde.clone().sub(mira), L = dir.length(); dir.divideScalar(L);
      let libre = L;
      const montado = jugador.modo === 'montado';
      for (let i = 1; i <= 16; i++) {
        const t = i / 16 * L, x = mira.x + dir.x * t, y = mira.y + dir.y * t, z = mira.z + dir.z * t;
        if (y < mundo.altura(x, z) + 0.35 || (!montado && t > 0.6 && mundo.tapa(x, y, z))) { libre = Math.max(1.2, t - 0.45); break; }
      }
      this.libre = this.libre == null || libre < this.libre ? libre : this.libre + (libre - this.libre) * Math.min(1, dt * 2.5);
      desde.copy(mira).addScaledVector(dir, Math.min(libre + 0.8, this.libre));
      const piso = mundo.altura(desde.x, desde.z) + 0.4;
      if (desde.y < piso) desde.y = piso;
      /* el agua: la cámara no queda justo en la superficie (se ve feo el corte) */
      if (mundo.agua != null && Math.abs(desde.y - mundo.agua) < 0.25 && !jugador.bajoAgua) desde.y = mundo.agua + 0.25;
    }
    if (this.inicial) { this.pos.copy(desde); this.mira.copy(mira); this.inicial = false; }
    const s = 1 - Math.exp(-dt * 14);
    this.pos.lerp(desde, s); this.mira.lerp(mira, 1 - Math.exp(-dt * 18));
    this.cam.position.copy(this.pos);
    if (this.sacudida > 0) { this.sacudida -= dt; const q = this.sacudida * 0.15; this.cam.position.x += (Math.random() - 0.5) * q; this.cam.position.y += (Math.random() - 0.5) * q; }
    /* el sprint (el video de movimiento): corriendo rápido la cámara tiembla con cada
       paso y se ladea en las curvas; main.js además abre el campo con kSprint */
    const vel = Math.hypot(jugador.v.x, jugador.v.z), sprint = jugador.modo === 'pie' && jugador.enPiso && vel > 5.5 ? Math.min(1, (vel - 5.5) / 1.8) : 0;
    this.kSprint += (sprint - this.kSprint) * Math.min(1, dt * 4);
    this.fasePaso += dt * vel * 1.9;
    if (this.kSprint > 0.01) { this.cam.position.y += Math.abs(Math.sin(this.fasePaso)) * 0.07 * this.kSprint; this.cam.position.x += Math.sin(this.fasePaso * 0.5) * 0.035 * this.kSprint; }
    let dr = jugador.rumbo - (this._rumbo ?? jugador.rumbo); while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; this._rumbo = jugador.rumbo;
    const ladeo = Math.max(-0.14, Math.min(0.14, -(dt > 0 ? dr / dt : 0) * 0.035 * this.kSprint));
    this.ladeo += (ladeo - this.ladeo) * Math.min(1, dt * 5);
    this.cam.lookAt(this.mira);
    if (Math.abs(this.ladeo) > 0.001) this.cam.rotateZ(this.ladeo);
    if (this.rollExtra) this.cam.rotateZ(this.rollExtra);
  }
  /* primera persona: pitch 0,3 es mirar derecho (igual que la de atrás en reposo) */
  actualizarFP(dt, j) {
    const k = j.escala, vel = Math.hypot(j.v.x, j.v.z);
    this.fase += dt * vel * 2.4;
    /* la cabeza acompaña los pasos (26/09: "correr, caminar y deslizarse deben verse en primera
       persona"): baja en cada pisada, se mece de un lado al otro y se ladea un poco; corriendo, más */
    const corre = vel > 5.2, amp = j.enPiso && !j.mov ? Math.min(1, vel / 3.4) : 0;
    const hamaca = -Math.abs(Math.sin(this.fase)) * (corre ? 0.07 : 0.04) * amp;
    const meceX = Math.sin(this.fase) * (corre ? 0.035 : 0.02) * amp;
    let ladeoFP = Math.sin(this.fase) * (corre ? 0.022 : 0.012) * amp;
    /* al caer, la cabeza se hunde y vuelve (como un resorte) */
    if (j.enPiso && !this._pisoFP && (this._vyFP || 0) < -4) this.golpeFP = Math.min(0.22, -(this._vyFP) * 0.014);
    this._pisoFP = j.enPiso; this._vyFP = j.v.y;
    this.golpeFP = Math.max(0, (this.golpeFP || 0) - dt * 0.9);
    const hundo = Math.sin(Math.min(1, this.golpeFP / 0.22) * Math.PI) * this.golpeFP;
    /* deslizándose se ladea; corriendo por la pared, para el otro lado de la pared */
    const tipo = j.mov?.tipo;
    let ladeoObj = tipo === 'desliza' ? 0.09 : tipo === 'corrPared' ? -0.22 * (j.m.ladoPared || 1) : 0;
    this.ladeoFP += (ladeoObj - (this.ladeoFP || 0)) * Math.min(1, dt * 8);
    ladeoFP += this.ladeoFP;
    /* rodando: la vuelta entera para adelante */
    this.vueltaFP = tipo === 'rueda' ? Math.min(1, j.mov.t / j.mov.dur) * Math.PI * 2 : 0;
    /* sentado, deslizándose o rodando, los ojos van más abajo */
    const bajito = j.mov && (j.mov.tipo === 'desliza' || j.mov.tipo === 'rueda');
    this.bajaFP += ((this.sentado ? -0.6 : bajito ? -0.72 : 0) - this.bajaFP) * Math.min(1, dt * (bajito ? 12 : 6));
    /* los ojos van un poco adelante del cuerpo: mirando abajo se ven la panza y las piernas */
    const adelante = (0.16 + Math.max(0, this.pitch - 0.9) * 0.16) * k;   // (mirando abajo, más adelante: se ven las piernas y no solo la panza)
    this.pos.set(j.p.x - Math.sin(this.yaw) * adelante + Math.cos(this.yaw) * meceX, j.p.y + 1.5 * k + hamaca + this.bajaFP - hundo, j.p.z - Math.cos(this.yaw) * adelante - Math.sin(this.yaw) * meceX);
    /* en una charla, la vista va sola hacia la cara de quien habla */
    if (this.cine) {
      const b = this.cine.b, dx = b.x - this.pos.x, dz = b.z - this.pos.z, dy = b.y + 1.1 - this.pos.y;
      let d = Math.atan2(-dx, -dz) - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 5);
      this.pitch += (0.3 - Math.atan2(dy, Math.hypot(dx, dz)) - this.pitch) * Math.min(1, dt * 5);
    }
    const p = this.pitch - 0.3, cp = Math.cos(p);
    this.mira.set(this.pos.x - Math.sin(this.yaw) * cp, this.pos.y - Math.sin(p), this.pos.z - Math.cos(this.yaw) * cp);
    this.cam.position.copy(this.pos);
    if (this.sacudida > 0) { this.sacudida -= dt; const q = this.sacudida * 0.08; this.cam.position.x += (Math.random() - 0.5) * q; this.cam.position.y += (Math.random() - 0.5) * q; }
    this.cam.lookAt(this.mira);
    if (Math.abs(ladeoFP) > 0.0005) this.cam.rotateZ(ladeoFP);
    if (this.vueltaFP > 0) this.cam.rotateX(-this.vueltaFP);
    else if (tipo === 'desliza') this.cam.rotateX(-0.06);   // (un poco para abajo: se ven las piernas adelante)
    this.inicial = true;
  }
  /* para mover al muñeco: los ejes de la cámara sobre el piso */
  ejes() { return { adelante: new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)), derecha: new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw)) }; }
}
