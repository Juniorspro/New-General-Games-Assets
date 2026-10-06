/* La lógica de Bus Stop Simulator, sacada de su Assembly-CSharp.dll (Unity 4.5):
   - PlayerFPScontroller: camina a 4 m/s (×1,5 con Shift), salta a 4 m/s, gravedad -9,81;
   - Player_PickupMesh: un rayo del centro de la pantalla; a menos de 2 m, el objeto "se mira";
   - Mesh_PickupMesh: las 10 mallas glitcheadas se ponen rojas y se juntan con E; el colectivo
     (tipo 1, buscado en el padre) pide "sentate y apretá E", arranca y cambia a la cámara del final;
   - CollectedMeshes: con 10 llega el colectivo ("bus animation");
   - KutteFuckerScript: mira al jugador; a 10 m o menos ataca a 10 m/s, deja de temblar y grita;
   - KutteTrigger: si toca al jugador, el jugador muere (vuelve al principio) y el bicho se borra;
   - PlayerDie: debajo de y = -300, vuelve al principio. FlashLight: F. */
import * as THREE from 'three';
import { Animador } from './anim.js';

const G = -9.81;
export class Juego {
  constructor({ S, fisica, sonido, escena, ui, aspecto }) {
    Object.assign(this, { S, fisica, sonido, escena, ui });
    const N = S.N, O = S.O, uno = (n) => S.buscar(n)[0];
    const guion = (i, n) => N[i].guiones?.find((g) => g.n === n);
    this.tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), b: new THREE.Box3(), q: new THREE.Quaternion() };

    /* el jugador */
    const iP = uno('Player');
    this.jugadorObj = O[iP];
    const ctl = guion(iP, 'PlayerFPScontroller');
    this.cfg = { vel: ctl.movementSpeed, salto: ctl.jumpSpeed, sprint: ctl.sprintShift, caida: guion(iP, 'PlayerDie').maxFallHeight };
    this.inicio = this.jugadorObj.position.clone();
    this.yaw0 = new THREE.Euler().setFromQuaternion(this.jugadorObj.quaternion, 'YXZ').y;
    this.camara = new THREE.PerspectiveCamera(60, aspecto, 0.1, 420);
    this.camara.rotation.order = 'YXZ';
    escena.add(this.camara);
    const iL = uno('Spotlight');
    const L = N[iL].luz;
    this.linterna = new THREE.SpotLight(new THREE.Color(...L.color.slice(0, 3)), L.int * 2, L.rango, THREE.MathUtils.degToRad(L.angulo / 2), 0.45, 0);
    this.linterna.position.fromArray(N[iL].t);
    this.linterna.target.position.set(N[iL].t[0], N[iL].t[1], N[iL].t[2] - 1);
    this.camara.add(this.linterna, this.linterna.target);
    this.linternaOn = !!L.on;

    /* la cámara del final */
    const iF = uno('End Camera');
    this.camFinal = new THREE.PerspectiveCamera(N[iF].cam?.fov || 60, aspecto, 0.1, 420);
    this.camFinal.position.copy(O[iF].getWorldPosition(new THREE.Vector3()));
    escena.add(this.camFinal);

    /* las mallas glitcheadas */
    this.mallas = [];
    N.forEach((n, i) => {
      const g = guion(i, 'Mesh_PickupMesh');
      if (!g || g.myKind !== 0 || !S.activo[i]) return;
      const obj = O[i], m = obj.userData.malla;
      if (!m) return;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      const mats = [].concat(m.material);
      this.mallas.push({ obj, m, mats, base: mats.map((x) => x.color.clone()), vivo: true, pos0: obj.position.clone(), fase: Math.random() * 10 });
    });

    /* el colectivo */
    const iB = uno('Bus');
    this.bus = O[iB];
    this.busAnim = new Animador(this.bus, S.E.clips);
    this.busMallas = [];
    this.bus.traverse((o) => { if (o.isMesh) this.busMallas.push(o); });
    this.bus.updateMatrixWorld(true);
    const inv = this.bus.matrixWorld.clone().invert(), caja = new THREE.Box3(), cb = new THREE.Box3();
    for (const m of this.busMallas) { m.geometry.computeBoundingBox(); cb.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); caja.union(cb); }
    fisica.obstaculos.push({ obj: this.bus, min: caja.min, max: caja.max });
    this.busEstado = 'lejos';
    // las luces del colectivo, juntadas de a una por grupo (adelante, atrás, adentro)
    const luces = { f: [], a: [], i: [] };
    N.forEach((n, i) => { if (n.p === iB && n.luz) (n.n.includes('Front') ? luces.f : n.n.includes('Back') ? luces.a : luces.i).push(n); });
    const prom = (l) => l.reduce((v, n) => v.add(new THREE.Vector3(...n.t)), new THREE.Vector3()).divideScalar(l.length);
    this.busLuces = [];
    if (luces.f.length) {
      const n = luces.f[0], s = new THREE.SpotLight(new THREE.Color(...n.luz.color.slice(0, 3)), n.luz.int * 2 * 1.6, n.luz.rango * 1.4, THREE.MathUtils.degToRad(n.luz.angulo / 2), 0.5, 0);
      s.position.copy(prom(luces.f));
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().fromArray(n.r));
      s.target.position.copy(s.position).add(dir); this.bus.add(s, s.target); this.busLuces.push([s, s.intensity]);
    }
    if (luces.a.length) { const n = luces.a[0], p = new THREE.PointLight(new THREE.Color(...n.luz.color.slice(0, 3)), n.luz.int * 2, n.luz.rango * 0.8, 0); p.position.copy(prom(luces.a)); this.bus.add(p); this.busLuces.push([p, p.intensity]); }
    if (luces.i.length) { const n = luces.i[0], p = new THREE.PointLight(new THREE.Color(...n.luz.color.slice(0, 3)), n.luz.int * 2 * 1.5, n.luz.rango * 1.3, 0); p.position.copy(prom(luces.i)); this.bus.add(p); this.busLuces.push([p, p.intensity]); }

    /* los KutteFucker */
    this.bichos = [];
    N.forEach((n, i) => {
      const g = guion(i, 'KutteFuckerScript');
      if (!g || !S.activo[i]) return;
      const raiz = O[i], hijo = O[g.child];
      const anim = new Animador(hijo, S.E.clips);
      const clips = N[g.child].anim;
      if (clips?.auto && clips.def) anim.play(clips.def);
      let trig = null;
      raiz.traverse((o) => { if (o.userData.nodo?.guiones?.some((x) => x.n === 'KutteTrigger')) trig = o.userData.malla; });
      if (trig) trig.geometry.computeBoundingBox();
      this.bichos.push({ raiz, hijo, anim, trig, g, atacando: false, vivo: true, audio: null, n: N[g.child], pos0: raiz.position.clone(), q0: raiz.quaternion.clone(), hp0: hijo.position.clone(), hq0: hijo.quaternion.clone() });
    });
    this.fuentes = [];
    this.reiniciar();
  }

  /* los sonidos, una vez que el audio está cargado */
  sonar() {
    const S = this.S, son = this.sonido;
    for (const f of this.fuentes) f?.parar();
    this.fuentes = [];
    S.N.forEach((n, i) => {
      if (!n.audio || !S.activo[i] || !n.audio.clip || !n.audio.auto) return;
      const bicho = this.bichos.find((b) => b.raiz === S.O[i]);
      if (bicho && !bicho.vivo) return;
      const es2D = n.n === 'Main Camera';
      const f = son.fuente(n.audio.clip, n.audio, es2D ? null : S.O[i]);
      this.fuentes.push(f);
      if (bicho) bicho.audio = f;
      if (bicho && bicho.atacando) f?.silencio(false);
    });
  }

  reiniciar() {
    this.estado = 'jugando';
    this.juntadas = 0;
    this.tiempo = 0; this.muertes = 0;
    this.pos = this.inicio.clone();
    this.yaw = this.yaw0; this.pitch = 0;
    this.est = { vy: 0, suelo: false };
    this.linternaOn = true; this.linterna.visible = true;
    for (const m of this.mallas) { m.vivo = true; m.obj.visible = true; m.obj.position.copy(m.pos0); }
    for (const b of this.bichos) {
      b.vivo = true; b.atacando = false; b.raiz.visible = true; b.raiz.position.copy(b.pos0); b.raiz.quaternion.copy(b.q0);
      b.hijo.position.copy(b.hp0); b.hijo.quaternion.copy(b.hq0);
      const c = b.n.anim; if (c?.auto && c.def) b.anim.play(c.def);
    }
    this.busAnim.stop();
    const nb = this.bus.userData.nodo;
    this.bus.position.fromArray(nb.t); this.bus.quaternion.fromArray(nb.r);
    this.busEstado = 'lejos';
    this.mirando = null; this.final = 0;
    this.camaraActiva = this.camara;
    this.aviso = null;
    this.ubicarCamara();
    if (this.sonido.ctx) this.sonar();
  }

  morir(porque) {
    this.muertes++;
    this.pos.copy(this.inicio); this.est.vy = 0;
    this.sonido.muerte();
    this.ui.muerte?.(porque);
  }

  ubicarCamara() {
    this.camara.position.set(this.pos.x, this.pos.y + 1.8, this.pos.z);
    this.camara.rotation.set(this.pitch, this.yaw, 0);
    this.camara.updateMatrixWorld();
  }

  update(dt, inp, ajustes) {
    const T = this.tmp;
    this.t = (this.t || 0) + dt;
    if (this.estado === 'jugando') {
      this.tiempo += dt;
      /* mirar */
      const k = 0.0042 * ajustes.sens;
      this.yaw -= inp.mx * k;
      this.pitch -= inp.my * k * (ajustes.invertir ? -1 : 1);
      this.pitch = Math.max(-1.396, Math.min(1.396, this.pitch));
      /* caminar (PlayerFPScontroller.Update) */
      const vel = this.cfg.vel * (inp.correr ? this.cfg.sprint : 1);
      const est = this.est;
      est.vy += G * dt;
      if (est.suelo) { est.vy = 1e-18; if (inp.saltar) est.vy = this.cfg.salto; }
      const sx = inp.x * vel, sz = inp.y * vel, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      T.v.set((sx * c - sz * s) * dt, est.vy * dt, (-sx * s - sz * c) * dt);
      this.fisica.mover(this.pos, T.v, est);
      if (this.pos.y < -this.cfg.caida) this.morir('caida');
      if (inp.linterna) { this.linternaOn = !this.linternaOn; this.linterna.visible = this.linternaOn; }
      this.ubicarCamara();
      this.mirar(inp.usar);
      this.bichosUpdate(dt);
    } else if (this.estado === 'final') {
      this.final += dt;
      this.camFinal.lookAt(this.bus.getWorldPosition(T.v));
      this.bichosUpdate(dt);
    }
    /* el texto de las teles, sólo de cerca (se ve a través de todo) */
    const cam = this.camaraActiva.position;
    for (const tv of this.S.teles) tv.plano.visible = tv.plano.getWorldPosition(T.w).distanceTo(cam) < 22;
    /* las mallas tiemblan un poco, como glitcheadas */
    for (const m of this.mallas) {
      if (!m.vivo) continue;
      const f = Math.sin(this.t * 13 + m.fase) * Math.sin(this.t * 7.3 + m.fase * 2) > 0.82;
      m.obj.position.set(m.pos0.x + (f ? (Math.random() - 0.5) * 0.08 : 0), m.pos0.y + (f ? (Math.random() - 0.5) * 0.05 : 0), m.pos0.z);
      for (const x of m.mats) if (x.emissive) x.emissive.setRGB(f ? 0.25 : 0.05 + 0.04 * Math.sin(this.t * 2 + m.fase), 0.02, f ? 0.3 : 0.06);
    }
    /* el colectivo */
    this.busAnim.update(dt);
    if (this.busEstado === 'viniendo' && !this.busAnim.andando) this.busEstado = 'parado';
    const dBus = this.bus.getWorldPosition(T.w).distanceTo(this.camaraActiva.position);
    for (const [l, i] of this.busLuces) l.intensity = dBus < 160 ? i : 0;
  }

  /* Player_PickupMesh + Mesh_PickupMesh.OnLookEnter */
  mirar(usar) {
    const ray = this._ray || (this._ray = new THREE.Raycaster());
    ray.setFromCamera({ x: 0, y: 0 }, this.camara);
    ray.far = 2.6; // (el original pide 2 m; con el dedo, un poco más de margen)
    const objs = this.mallas.filter((m) => m.vivo).map((m) => m.m);
    if (this.bus.position.distanceTo(this.pos) < 30) objs.push(...this.busMallas);
    const hit = ray.intersectObjects(objs, false)[0];
    for (const m of this.mallas) m.mats.forEach((x, k) => x.color.copy(m.base[k]));
    this.mirando = null;
    if (!hit) return;
    const malla = this.mallas.find((m) => m.m === hit.object);
    if (malla) {
      this.mirando = 'malla';
      for (const x of malla.mats) x.color.setRGB(1, 0, 0);
      if (usar) {
        malla.vivo = false; malla.obj.visible = false;
        this.juntadas++;
        this.sonido.juntar();
        this.ui.vibrar?.(40);
        if (this.juntadas >= 10 && this.busEstado === 'lejos') { this.busEstado = 'viniendo'; this.busAnim.play('bus animation'); this.aviso = 'viene'; this.ui.aviso?.('viene'); }
      }
    } else if (this.busMallas.includes(hit.object)) {
      this.mirando = 'bus';
      if (usar) {
        this.busAnim.stop(); this.busAnim.play('bus animation win');
        this.busEstado = 'yendo';
        this.estado = 'final'; this.final = 0;
        this.camaraActiva = this.camFinal;
        this.ui.fin?.();
      }
    }
  }

  /* KutteFuckerScript.Update + KutteTrigger */
  bichosUpdate(dt) {
    const T = this.tmp;
    for (const b of this.bichos) {
      if (!b.vivo) continue;
      b.anim.update(dt);
      const r = b.raiz;
      T.v.set(this.pos.x, r.position.y, this.pos.z);
      const d = r.position.distanceTo(T.v);
      if (b.g.myKind === 0) {
        if (d > 1e-4) r.lookAt(T.v);
        r.rotateY(Math.PI); r.rotateY(Math.PI / 2); // (LookAt de Unity y después Rotate(0,-90,0))
        if (d <= b.g.attackLenght && !b.atacando) {
          b.atacando = true;
          b.anim.stop(); b.anim.play('KuttefuckerReset');
          b.audio?.silencio(false);
          this.ui.vibrar?.(120);
        }
        if (b.atacando) { r.rotateY(Math.PI); r.translateX(-b.g.attackSpeed * dt); }
      }
      if (this.estado !== 'jugando' || !b.trig) continue;
      r.updateMatrixWorld(true);
      T.b.copy(b.trig.geometry.boundingBox).applyMatrix4(b.trig.matrixWorld);
      const p = this.pos;
      if (p.x + 0.5 > T.b.min.x && p.x - 0.5 < T.b.max.x && p.z + 0.5 > T.b.min.z && p.z - 0.5 < T.b.max.z && p.y + 2 > T.b.min.y && p.y < T.b.max.y) {
        b.vivo = false; r.visible = false; b.audio?.parar();
        this.morir('bicho');
      }
    }
  }
}
