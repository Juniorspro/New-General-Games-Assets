/* Jugador y sistemas generales del mundo: entrada, cámara (vista, mezclas, sacudidas, fundidos), trazas,
   jerarquía de componentes, spawn de actores desde clases, guardado y cambio de nivel. Se cuelga de Mundo.prototype. */
import * as THREE from 'three';
import { Mundo, natHereda, PADRE } from '../mundo.js';
import { UObj, Clase, copiar } from '../vm.js';
import { V, vadd, vsub, vmul, vlen, rotAQuat, quatARot, qmul, qrot, slerp, normEje } from './libs.js';
import { pUE, pT, qUE, qT, sT, rotT, rotUE, mundoUE, ponerMundo } from '../conv.js';
import { iniciarComponente, aplicarVisibilidad } from './motor.js';

const P = Mundo.prototype;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _r = new THREE.Raycaster(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _b = new THREE.Box3();
const FIX_CAM = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // UE mira +X, three mira -Z
const EJES = { Turn: [['MouseX', 1]], LookUp: [['MouseY', -1]], ForwardBackward: [['W', 1], ['S', -1]], RightLeft: [['D', 1], ['A', -1]] };
const ACCIONES = { Use: ['LeftMouseButton'] };

/* ---------------- jerarquía ---------------- */
P.colgar = function (hijo, padre, socket) {
  let destino = padre.o3;
  const m = padre.malla;
  if (socket && socket !== 'None' && m?.isSkinnedMesh) {
    const so = (m.userData.sockets || []).find((s) => s.n === socket);
    const hueso = m.skeleton.bones.find((b) => b.name === (so ? so.h : socket));
    if (hueso) {
      destino = hueso;
      if (so) { let s = hueso.children.find((x) => x.name === 'socket:' + so.n); if (!s) { s = new THREE.Object3D(); s.name = 'socket:' + so.n; s.position.fromArray(so.t); s.quaternion.fromArray(so.r); s.scale.fromArray(so.s); hueso.add(s); } destino = s; }
    }
  }
  destino.add(hijo.o3); hijo.o3.updateMatrixWorld(true);
};
P.hijosComp = function (c, directos) {
  const r = [];
  const rec = (o) => { for (const ch of o.children) { const cc = ch.userData?.comp; if (cc && cc !== c) { r.push(cc); if (!directos) rec(ch); } else if (!cc) rec(ch); } };
  rec(c.o3);
  return r;
};
P.activarComp = function (c, on, reset) {
  c.activo = on;
  if (c.nat === 'AudioComponent') { if (on && (reset || !c.sonando) && this.empezado !== undefined) this.audio?.alActivar?.(c); else if (!on) this.audio?.parar?.(c); }
  if (c.nat === 'ParticleSystemComponent') this.particulas?.activar(c, on);
};
P.desactivarComp = function (c) { if (c.nat === 'AudioComponent') this.audio?.parar?.(c); };

/* ---------------- spawn desde clase ---------------- */
const NATIVOS_COMPS = {
  CameraActor: [['CameraComponent', 'CameraComponent', null]],
  CineCameraActor: [['CameraComponent', 'CineCameraComponent', null]],
  StaticMeshActor: [['StaticMeshComponent0', 'StaticMeshComponent', null]],
  SkeletalMeshActor: [['SkeletalMeshComponent0', 'SkeletalMeshComponent', null]],
  Character: [['CollisionCylinder', 'CapsuleComponent', null], ['CharacterMesh0', 'SkeletalMeshComponent', 'CollisionCylinder'], ['Arrow', 'ArrowComponent', 'CollisionCylinder'], ['CharMoveComp', 'CharacterMovementComponent', '-']],
  DefaultPawn: [['CollisionComponent', 'SphereComponent', null], ['MeshComponent0', 'StaticMeshComponent', 'CollisionComponent'], ['MovementComponent0', 'FloatingPawnMovement', '-']],
  PointLight: [['LightComponent0', 'PointLightComponent', null]], SpotLight: [['LightComponent0', 'SpotLightComponent', null]],
  AmbientSound: [['AudioComponent0', 'AudioComponent', null]], TargetPoint: [['Sprite', 'BillboardComponent', null]],
  Emitter: [['ParticleSystemComponent0', 'ParticleSystemComponent', null]],
};
P.construir = function (a, clase, t) {
  const nat = clase instanceof Clase ? clase.nativa : (clase?.nativa || 'Actor');
  let cadena = [];
  if (clase instanceof Clase) for (let c = clase; c; c = c.superClase) cadena.unshift(c);
  // plantillas: la más derivada gana
  const tpl = {};
  for (const c of cadena) for (const [k, v] of Object.entries(c.j.plantillas || {})) tpl[k] = { ...(tpl[k] || {}), ...v, props: { ...(tpl[k]?.props || {}), ...v.props } };
  const comps = new Map();
  const crear = (nombre, tipo, props) => {
    const c = this.nuevoComp(a, tipo, nombre); c.tplProps = props || {};
    const pr = c.tplProps;
    if (pr.RelativeLocation) pT(pr.RelativeLocation, c.o3.position);
    if (pr.RelativeRotation) rotT(pr.RelativeRotation, c.o3.quaternion);
    if (pr.RelativeScale3D) sT({ X: pr.RelativeScale3D.X ?? 1, Y: pr.RelativeScale3D.Y ?? 1, Z: pr.RelativeScale3D.Z ?? 1 }, c.o3.scale);
    if (pr.bVisible === false) c.vis = false;
    if (pr.bHiddenInGame) c.ocultoJuego = true;
    comps.set(nombre, c);
    return c;
  };
  let natBase = nat; while (natBase && !NATIVOS_COMPS[natBase]) natBase = PADRE[natBase];
  for (const [n, tipo, padre] of NATIVOS_COMPS[natBase] || []) {
    const c = crear(n, tipo, tpl[n]?.props);
    if (padre === '-') { c.noEscena = true; continue; }
    if (padre && comps.get(padre)) comps.get(padre).o3.add(c.o3);
  }
  // SCS: componentes del Blueprint, con jerarquía
  const scs = []; for (const c of cadena) scs.push(...(c.j.scs || []));
  for (const s of scs) {
    const pr = tpl[s.tpl]?.props || {};
    crear(s.n, s.tipo || s.clase, pr);
  }
  for (const s of scs) {
    const c = comps.get(s.n); const p = s.padre && comps.get(s.padre);
    if (p) { this.colgar(c, p, s.socket); }
  }
  // raíz
  const rootRef = (() => { for (let i = cadena.length - 1; i >= 0; i--) { const r = cadena[i].j.cdo?.RootComponent; if (r) return r; } return null; })();
  let raiz = null;
  if (rootRef?.asset) raiz = comps.get(rootRef.asset.split('.').pop());
  if (!raiz) { const sinPadre = [...comps.values()].filter((c) => !c.noEscena && !c.o3.parent); raiz = sinPadre[0] || null; }
  if (!raiz) raiz = crear('DefaultSceneRoot', 'SceneComponent', {});
  a.raiz = raiz;
  for (const c of comps.values()) if (!c.noEscena && !c.o3.parent && c !== raiz) raiz.o3.add(c.o3);
  (this.nivel?.raiz || this.escena).add(raiz.o3);
  if (t) ponerMundo(raiz.o3, t.Translation, t.Rotation, t.Scale3D);
  // contenido visible (mallas, luces, sonido) según tipo
  for (const c of comps.values()) { this.contenidoComp?.(c); iniciarComponente(this, c); aplicarVisibilidad(this, c); }
  a.nacio = this.tiempo;
};

/* ---------------- entrada ---------------- */
P.tecla = function (k, apretada) { (this.colaTeclas || (this.colaTeclas = [])).push([k, apretada]); if (apretada) this.teclasApretadas.add(k); else this.teclasApretadas.delete(k); };
P.receptores = function () {
  const r = this.actores.filter((a) => a.vivo && a.input && a !== this.lsa && a !== this.pc && a !== this.pc?.peon && a.clase).reverse();
  r.push(this.pc); if (this.lsa) r.push(this.lsa); if (this.pc?.peon) r.push(this.pc.peon);
  return r.filter((a) => a && a.vivo && (a.input || a === this.lsa || a === this.pc?.peon));
};
P.enlaces = function (a) {
  if (!a?.clase) return null;
  if (a._enl) return a._enl;
  const e = { teclas: [], acciones: [], ejes: [], ejesTecla: [], comps: [] };
  for (let c = a.clase; c; c = c.superClase) {
    const j = c.j.enlaces || {};
    e.teclas.push(...(j.InputKeyDelegateBindings || [])); e.acciones.push(...(j.InputActionDelegateBindings || []));
    e.ejes.push(...(j.InputAxisDelegateBindings || [])); e.ejesTecla.push(...(j.InputAxisKeyDelegateBindings || [])); e.comps.push(...(j.ComponentDelegateBindings || []));
  }
  return (a._enl = e);
};
P.teclasUsadas = function () {
  const s = new Set();
  for (const a of this.receptores()) { const e = this.enlaces(a); if (!e) continue; for (const b of e.teclas) s.add(b.InputChord?.Key?.KeyName); for (const b of e.acciones) for (const k of ACCIONES[b.InputActionName] || []) s.add(k); }
  return s;
};
P.procesarEntrada = function (dt) {
  this.recien = new Set();
  const cola = this.colaTeclas || []; this.colaTeclas = [];
  const receptores = this.receptores();
  for (const [k, ap] of cola) {
    if (ap) this.recien.add(k);
    this.ui?.alTecla?.(k, ap);
    const tipo = ap ? 'IE_Pressed' : 'IE_Released';
    for (const a of receptores) {
      const e = this.enlaces(a); if (!e) continue;
      let consumida = false;
      for (const b of e.teclas) {
        const bk = b.InputChord?.Key?.KeyName;
        if ((bk === k || bk === 'AnyKey') && (b.InputKeyEvent || 'IE_Pressed') === tipo && (!this.pausado || b.bExecuteWhenPaused)) {
          this.vm.llamar(a, b.FunctionNameToBind, [{ KeyName: k }]); if (b.bConsumeInput !== false) consumida = true;
        }
      }
      for (const b of e.acciones) {
        if ((ACCIONES[b.InputActionName] || []).includes(k) && (b.InputKeyEvent || 'IE_Pressed') === tipo && (!this.pausado || b.bExecuteWhenPaused)) {
          this.vm.llamar(a, b.FunctionNameToBind, [{ KeyName: k }]); if (b.bConsumeInput !== false) consumida = true;
        }
      }
      if (consumida) break;
    }
  }
  // ejes (todos los cuadros)
  const valorEje = (n) => (EJES[n] || []).reduce((s, [k, esc]) => s + (k.startsWith('Mouse') ? (this.ejes[k] || 0) : (this.teclasApretadas.has(k) ? 1 : 0) + (this.ejes[k] || 0)) * esc, 0);
  const usados = new Set();
  for (const a of receptores) {
    const e = this.enlaces(a); if (!e) continue;
    for (const b of e.ejes) {
      if (usados.has(b.InputAxisName) || (this.pausado && !b.bExecuteWhenPaused)) continue;
      this.vm.llamar(a, b.FunctionNameToBind, [valorEje(b.InputAxisName)]);
      if (b.bConsumeInput !== false) usados.add(b.InputAxisName);
    }
    for (const b of e.ejesTecla) {
      const k = b.AxisKey?.KeyName; if (usados.has(k) || (this.pausado && !b.bExecuteWhenPaused)) continue;
      this.vm.llamar(a, b.FunctionNameToBind, [this.ejes[k] || 0]);
      if (b.bConsumeInput !== false) usados.add(k);
    }
  }
  this.ejes.MouseX = 0; this.ejes.MouseY = 0;
  // rotación de control
  const pc = this.pc;
  if (pc) {
    if (!pc.ignorarMirar) {
      pc.rotControl.Yaw += pc.rotPend || 0; pc.rotControl.Pitch += pc.pitchPend || 0;
    }
    pc.rotPend = 0; pc.pitchPend = 0;
    const cm = this.cm;
    let p = normEje(pc.rotControl.Pitch); p = Math.max(cm?.pitchMin ?? -89.9, Math.min(cm?.pitchMax ?? 89.9, p)); pc.rotControl.Pitch = p;
    if (cm && (cm.yawMin !== 0 || cm.yawMax < 359)) { let y = normEje(pc.rotControl.Yaw); y = Math.max(cm.yawMin, Math.min(cm.yawMax, y)); pc.rotControl.Yaw = y; }
    pc.rotControl.Yaw = ((pc.rotControl.Yaw % 360) + 360) % 360;
    const peon = pc.peon;
    if (peon?.raiz) {
      const v = peon.v || {};
      const r = rotUE(peon.raiz.o3.getWorldQuaternion(_q));
      const nr = { Pitch: v.bUseControllerRotationPitch ? pc.rotControl.Pitch : r.Pitch, Yaw: (v.bUseControllerRotationYaw ?? true) ? pc.rotControl.Yaw : r.Yaw, Roll: v.bUseControllerRotationRoll ? pc.rotControl.Roll : r.Roll };
      ponerMundo(peon.raiz.o3, null, rotAQuat(nr));
      if (peon.movPend) { this.mover?.(peon, peon.movPend, this.dtUltimo || 0.016); peon.movPend = null; }
    }
  }
};

/* ---------------- cámara ---------------- */
P.povDe = function (a) {
  if (!a) return null;
  const cam = a.comps?.find((c) => /CameraComponent/.test(c.nat) && c.activo !== false);
  if (cam) {
    const t = mundoUE(cam.o3);
    let rot = t.Rotation;
    if (cam.usarRotControl && a.controlador) rot = rotAQuat(a.controlador.rotControl);
    return { Translation: t.Translation, Rotation: rot, fov: cam.fov ?? 90, comp: cam };
  }
  if (a.raiz) { const t = mundoUE(a.raiz.o3); const rot = a.controlador ? rotAQuat(a.controlador.rotControl) : t.Rotation; return { Translation: vadd(t.Translation, V(0, 0, a.v?.BaseEyeHeight ?? 64)), Rotation: rot, fov: 90 }; }
  return null;
};
P.ponerVista = function (obj, dur = 0, func = 0, exp = 2) {
  const cm = this.cm;
  const desde = cm.ultimo ? { ...cm.ultimo } : null;
  cm.vista = { obj, dur, func, exp, t: 0, desde: dur > 0 ? desde : null };
};
const mezcla = (t, f, e) => { e = e || 2; switch (f) { case 1: return t * t * (3 - 2 * t); case 2: return Math.pow(t, e); case 3: return 1 - Math.pow(1 - t, e); case 4: return t < 0.5 ? 0.5 * Math.pow(2 * t, e) : 1 - 0.5 * Math.pow(2 * (1 - t), e); default: return t; } };
P.sacudir = function (cl, esc = 1) {
  if (!cl) return;
  const d = cl instanceof Clase ? cl.j.cdo || {} : {};
  const osc = (k) => d[k] || {};
  this.cm.sacudidas.push({ clase: cl, esc, t: 0, dur: d.OscillationDuration ?? 1, entra: d.OscillationBlendInTime ?? 0.1, sale: d.OscillationBlendOutTime ?? 0.2,
    rot: osc('RotOscillation'), loc: osc('LocOscillation'), fov: osc('FOVOscillation'), fase: Math.random() * 10 });
};
P.actualizarCamara = function (dtReal) {
  const cm = this.cm; if (!cm || !this.camara) return;
  const vista = cm.vista || {};
  let pov = this.povDe(vista.obj) || cm.ultimo;
  if (!pov) return;
  if (vista.desde && vista.dur > 0) {
    vista.t += dtReal;
    const k = mezcla(Math.min(1, vista.t / vista.dur), vista.func, vista.exp);
    const a = vista.desde;
    pov = { Translation: V(a.Translation.X + (pov.Translation.X - a.Translation.X) * k, a.Translation.Y + (pov.Translation.Y - a.Translation.Y) * k, a.Translation.Z + (pov.Translation.Z - a.Translation.Z) * k),
      Rotation: slerp(a.Rotation, pov.Rotation, k), fov: a.fov + (pov.fov - a.fov) * k };
    if (vista.t >= vista.dur) vista.desde = null;
  }
  cm.ultimo = { Translation: pov.Translation, Rotation: pov.Rotation, fov: pov.fov };
  // sacudidas
  let loc = pov.Translation, rot = quatARot(pov.Rotation), fov = pov.fov;
  for (const s of cm.sacudidas) {
    s.t += dtReal;
    let peso = s.esc;
    if (s.dur > 0) { if (s.t < s.entra) peso *= s.t / s.entra; if (s.t > s.dur - s.sale) peso *= Math.max(0, (s.dur - s.t) / s.sale); }
    const o = (x, tt) => (x && x.Amplitude ? x.Amplitude * Math.sin((tt + s.fase) * (x.Frequency || 1) * Math.PI * 2 * 0.5) : 0);
    rot = { Pitch: rot.Pitch + o(s.rot.Pitch, s.t) * peso, Yaw: rot.Yaw + o(s.rot.Yaw, s.t * 1.13) * peso, Roll: rot.Roll + o(s.rot.Roll, s.t * 0.91) * peso };
    const dl = V(o(s.loc.X, s.t), o(s.loc.Y, s.t * 1.1), o(s.loc.Z, s.t * 0.9));
    loc = vadd(loc, vmul(qrot(pov.Rotation, dl), peso));
    fov += o(s.fov, s.t) * peso;
  }
  cm.sacudidas = cm.sacudidas.filter((s) => s.dur <= 0 || s.t < s.dur);
  cm.ultimoFov = fov;
  pT(loc, this.camara.position);
  qT(rotAQuat(rot), this.camara.quaternion).multiply(FIX_CAM);
  const asp = this.camara.aspect || 16 / 9;
  const vf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(Math.max(5, Math.min(170, fov))) / 2) / asp);
  const vfov = THREE.MathUtils.radToDeg(vf);
  if (Math.abs(this.camara.fov - vfov) > 0.01) { this.camara.fov = vfov; this.camara.updateProjectionMatrix(); }
  this.camara.updateMatrixWorld();
  // fundido de cámara
  const f = cm.fade;
  if (f && f.dur > 0 && f.t < f.dur) { f.t += dtReal; f.alfa = f.desde + (f.hasta - f.desde) * Math.min(1, f.t / f.dur); }
  this.ui?.fundidoCamara?.(f ? f.alfa : 0, f?.color);
};

/* ---------------- trazas (rayos) ---------------- */
P.candidatosTraza = function (op) {
  const r = [];
  for (const a of this.actores) {
    if (!a.vivo || a.sinColision || op.ignorar?.includes?.(a)) continue;
    if (a === op.yo && op.ignorarYo !== false && false) continue;
    for (const c of a.comps) {
      if (!c.colHabil || c.vivo === false) continue;
      if (op.tipos) { if (!op.tipos.includes(c.tipoObj ?? 0)) continue; }
      else if (c.resp?.[op.canal ?? 3] === 0) continue;
      if (c.malla) r.push(c.malla);
      else if (c.caja || c.nodo?.caja) r.push(c);
    }
  }
  if (!op.tipos && this.nivel?.estaticos) r.push(...this.nivel.estaticos.children);
  return r;
};
P.trazar = function (a, b, op = {}) {
  const pa = pT(a, new THREE.Vector3()), pb = pT(b, new THREE.Vector3());
  _d.subVectors(pb, pa); const largo = _d.length(); if (largo < 1e-6) return null; _d.divideScalar(largo);
  _r.set(pa, _d); _r.near = 0; _r.far = largo;
  let mejor = null;
  for (const o of this.candidatosTraza(op)) {
    if (o.isObject3D) {
      const hits = _r.intersectObject(o, false);
      for (const h of hits) if (!mejor || h.distance < mejor.distance) { mejor = { distance: h.distance, point: h.point.clone(), normal: h.face?.normal?.clone().transformDirection(o.matrixWorld) || new THREE.Vector3(), obj: o }; }
    } else {
      const ex = o.nodo?.caja || [0.32, 0.32, 0.32];
      o.o3.updateMatrixWorld(true);
      _m.copy(o.o3.matrixWorld).invert();
      const ro = pa.clone().applyMatrix4(_m), rd = pb.clone().applyMatrix4(_m).sub(ro);
      const ray = new THREE.Ray(ro, rd.clone().normalize());
      _b.min.set(-ex[0], -ex[1], -ex[2]); _b.max.set(ex[0], ex[1], ex[2]);
      const pt = ray.intersectBox(_b, new THREE.Vector3());
      if (pt) { const w = pt.applyMatrix4(o.o3.matrixWorld); const dd = w.distanceTo(pa); if (dd <= largo && (!mejor || dd < mejor.distance)) mejor = { distance: dd, point: w, normal: new THREE.Vector3(), comp: o }; }
    }
  }
  if (!mejor) return null;
  let comp = mejor.comp || null;
  if (!comp && mejor.obj) for (let x = mejor.obj; x; x = x.parent) if (x.userData?.comp) { comp = x.userData.comp; break; }
  const loc = pUE(mejor.point);
  const n = mejor.normal; const nu = { X: n.x, Y: n.z, Z: n.y };
  return { __hit: true, bBlockingHit: true, Actor: comp?.actor || null, Component: comp, Location: loc, ImpactPoint: loc, Normal: nu, ImpactNormal: nu, Time: mejor.distance / largo, Distance: mejor.distance * 100, TraceStart: a, TraceEnd: b };
};

/* ---------------- guardado (SaveGame en localStorage) ---------------- */
P.nuevoGuardado = function (cl) {
  const o = new UObj(cl instanceof Clase ? cl : null, 'SaveGame'); o.nat = 'SaveGame';
  if (cl instanceof Clase) this.vm.iniciarVars(o, cl, (v) => this.resolverValor(v));
  return o;
};
const CLAVE = (s) => 'tjoc.slot.' + s;
P.guardarSlot = function (o, slot) {
  if (!o) return false;
  const ser = (v) => (v && typeof v === 'object' ? (v.__ref ? (v.asset ? { asset: v.asset } : null) : Array.isArray(v) ? v.map(ser) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)]))) : v);
  try { localStorage.setItem(CLAVE(slot), JSON.stringify({ clase: o.clase?.n || null, v: ser(o.v) })); return true; } catch { return false; }
};
P.cargarSlot = function (slot) {
  let j; try { j = JSON.parse(localStorage.getItem(CLAVE(slot)) || 'null'); } catch { j = null; }
  if (!j) return null;
  const o = this.nuevoGuardado(j.clase ? this.vm.claseSync(j.clase) : null);
  for (const [k, v] of Object.entries(j.v || {})) o.v[k] = v && v.asset ? this.asset(v.asset) : v;
  return o;
};
P.existeSlot = function (slot) { try { return localStorage.getItem(CLAVE(slot)) !== null; } catch { return false; } };
P.borrarSlot = function (slot) { try { localStorage.removeItem(CLAVE(slot)); return true; } catch { return false; } };

/* ---------------- cambio de nivel ---------------- */
P.abrirNivel = function (n) {
  if (this.cambiando) return;
  this.cambiando = n;
  setTimeout(async () => { try { await (this.alAbrirNivel ? this.alAbrirNivel(n) : this.cargarNivel(n)); } finally { this.cambiando = null; } }, 0);
};
P.consola = function (cmd) { this.depurar('consola', cmd); };
P.salir = function () { this.alSalir?.(); };

/* Clic/toque en pantalla (coordenadas normalizadas -1..1): OnClicked del actor y del componente tocado. */
P.clicEnPantalla = function (nx, ny, boton = 'LeftMouseButton') {
  if (!this.camara) return null;
  const r = new THREE.Raycaster(); r.setFromCamera({ x: nx, y: ny }, this.camara); r.far = 100;
  const cand = [];
  for (const a of this.actores) { if (!a.vivo || a.sinColision) continue; for (const c of a.comps) if (c.malla && c.colHabil !== false) cand.push(c.malla); }
  const hits = r.intersectObjects(cand, false);
  if (!hits.length) return null;
  let comp = null; for (let x = hits[0].object; x; x = x.parent) if (x.userData?.comp) { comp = x.userData.comp; break; }
  if (!comp) return null;
  const a = comp.actor, k = { KeyName: boton };
  for (const d of (comp.v.OnClicked || []).slice()) this.vm.llamar(d.obj, d.fn, [comp, k]);
  for (const d of (a.v?.OnClicked || []).slice()) this.vm.llamar(d.obj, d.fn, [a, k]);
  if (a.clase && this.vm.tiene(a, 'ReceiveActorOnClicked')) this.vm.llamar(a, 'ReceiveActorOnClicked', [k]);
  return a;
};
