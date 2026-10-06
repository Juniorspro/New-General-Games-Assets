/* Métodos y propiedades nativas de Unreal que tocan el mundo (actores, componentes, jugador, cámara, trazas).
   Cada método: function(obj, vals, refs, F) con this = Mundo. Posiciones y rotaciones en espacio UE. */
import * as THREE from 'three';
import { UObj, Clase, copiar } from '../vm.js';
import { V, vadd, vsub, vmul, vlen, rotAQuat, quatARot, rotEjes, qmul, qrot, slerp, normEje } from './libs.js';
import { pUE, pT, qUE, qT, sT, rotT, rotUE, mundoUE, ponerMundo } from '../conv.js';

const set = (refs, i, v) => { if (refs && refs[i]) refs[i].set(v); };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _b = new THREE.Box3();
const CANAL = { ECC_WorldStatic: 0, ECC_WorldDynamic: 1, ECC_Pawn: 2, ECC_Visibility: 3, ECC_Camera: 4, ECC_PhysicsBody: 5, ECC_Vehicle: 6, ECC_Destructible: 7 };
// Perfiles de colisión del motor → tipo de objeto
const PERFIL = { Vehicle: 'ECC_Vehicle', PhysicsActor: 'ECC_PhysicsBody', Pawn: 'ECC_Pawn', Destructible: 'ECC_Destructible', BlockAll: 'ECC_WorldStatic', OverlapAll: 'ECC_WorldStatic', BlockAllDynamic: 'ECC_WorldDynamic', OverlapAllDynamic: 'ECC_WorldDynamic', Trigger: 'ECC_WorldDynamic', UI: 'ECC_WorldDynamic', CharacterMesh: 'ECC_Pawn' };
const OBJQ = [0, 1, 2, 5, 6, 7]; // ObjectTypeQuery1..6 → canal
const mundoDe = (c) => mundoUE(c.o3);
export function locActor(a) { return a?.raiz ? mundoUE(a.raiz.o3).Translation : V(); }
export function rotActor(a) { return a?.raiz ? quatARot(mundoUE(a.raiz.o3).Rotation) : { Pitch: 0, Yaw: 0, Roll: 0 }; }

/* ---------------- inicialización de componentes del nivel ---------------- */
export function iniciarComponente(M, c) {
  const n = c.nodo || {};
  c.col = n.col || {};
  c.tipoObj = CANAL[c.col.tipo] ?? CANAL[PERFIL[c.col.perfil]] ?? defectoCanal(c.nat);
  c.colHabil = c.col.habil ? c.col.habil !== 'NoCollision' : !/Light|Audio|Camera|Billboard|Arrow|Scene|Decal|PostProcess|Particle|Text/.test(c.nat);
  if (n.perfil === 'NoCollision' || c.col.perfil === 'NoCollision') c.colHabil = false;
  if (c.nat === 'AudioComponent') M.audio?.registrarComp?.(c, n);
  if (/CameraComponent/.test(c.nat)) { c.fov = n.fov ?? 90; c.usarRotControl = !!n.rotControl; }
  if (c.malla?.isSkinnedMesh) M.animar?.prepararComp(c, n);
  if (c.nat === 'TextRenderComponent') M.textoRender?.(c, n.texto);
  if (c.nat === 'PostProcessComponent') { c.ppOn = n.ppOn !== false; c.ppPeso = n.peso ?? 1; c.pp = n.pp || null; }
}
function defectoCanal(nat) {
  if (/Skeletal/.test(nat)) return 5;
  if (/Box|Sphere|Capsule|Shape/.test(nat)) return 1;
  return 0;
}
function visibleArbol(c) { for (let o = c.o3; o; o = o.parent) if (!o.visible) return false; return true; }
/* Aplica bVisible/bHiddenInGame de un componente a lo que dibuja (su malla, su luz, su partícula) */
export function aplicarVisibilidad(M, c) {
  const ver = c.vis && !c.ocultoJuego && !c.actor?.ocultoJuego;
  if (c.malla) c.malla.visible = ver;
  if (c.luz) c.luz.visible = ver;
  if (c.extra3) c.extra3.visible = ver;
  if (c.part) c.part.visible = ver;
}

/* ---------------- propiedades nativas ---------------- */
export const PROPS = {
  Actor: {
    RootComponent: (o) => o.raiz,
    bHidden: { get: (o) => !!o.ocultoJuego, set(o, v, M) { o.ocultoJuego = !!v; for (const c of o.comps) aplicarVisibilidad(M, c); } },
    Tags: { get: (o) => o.tags || [], set: (o, v) => { o.tags = v; } },
    CustomTimeDilation: { get: (o) => o.dil ?? 1, set: (o, v) => { o.dil = v; } },
  },
  Pawn: { Controller: (o) => o.controlador || null },
  Controller: { Pawn: (o) => o.peon || null, ControlRotation: { get: (o) => ({ ...o.rotControl }), set: (o, v) => { o.rotControl = { ...v }; } } },
  PlayerController: {
    PlayerCameraManager: (o, M) => M.cm,
    bShowMouseCursor: { get: (o) => !!o.cursor, set: (o, v, M) => { o.cursor = !!v; M.ui?.cursor?.(!!v); } },
    bEnableClickEvents: { get: (o) => !!o.clicks, set: (o, v) => { o.clicks = !!v; } },
    InputYawScale: { get: (o) => o.yawEsc, set: (o, v) => { o.yawEsc = v; } },
    InputPitchScale: { get: (o) => o.pitchEsc, set: (o, v) => { o.pitchEsc = v; } },
  },
  PlayerCameraManager: {
    ViewPitchMin: { get: (o) => o.pitchMin, set: (o, v) => { o.pitchMin = v; } }, ViewPitchMax: { get: (o) => o.pitchMax, set: (o, v) => { o.pitchMax = v; } },
    ViewYawMin: { get: (o) => o.yawMin, set: (o, v) => { o.yawMin = v; } }, ViewYawMax: { get: (o) => o.yawMax, set: (o, v) => { o.yawMax = v; } },
  },
  SceneComponent: {
    RelativeLocation: { get: (c) => pUE(c.o3.position), set: (c, v) => { pT(v, c.o3.position); c.o3.updateMatrixWorld(true); } },
    RelativeRotation: { get: (c) => rotUE(c.o3.quaternion), set: (c, v) => { rotT(v, c.o3.quaternion); c.o3.updateMatrixWorld(true); } },
    RelativeScale3D: { get: (c) => ({ X: c.o3.scale.x, Y: c.o3.scale.z, Z: c.o3.scale.y }), set: (c, v) => { sT(v, c.o3.scale); c.o3.updateMatrixWorld(true); } },
    bVisible: { get: (c) => c.vis, set(c, v, M) { c.vis = !!v; aplicarVisibilidad(M, c); } },
    bHiddenInGame: { get: (c) => c.ocultoJuego, set(c, v, M) { c.ocultoJuego = !!v; aplicarVisibilidad(M, c); } },
  },
  CameraComponent: {
    FieldOfView: { get: (c) => c.fov, set: (c, v) => { c.fov = v; } },
    bUsePawnControlRotation: { get: (c) => !!c.usarRotControl, set: (c, v) => { c.usarRotControl = !!v; } },
    PostProcessSettings: { get: (c) => c.pp || (c.pp = {}), set: (c, v) => { c.pp = v; } },
    PostProcessBlendWeight: { get: (c) => c.ppPeso ?? 1, set: (c, v) => { c.ppPeso = v; } },
  },
  LightComponent: {
    Intensity: { get: (c) => c.luz?.int ?? 0, set: (c, v) => { if (c.luz) c.luz.int = v; } },
    LightColor: { get: (c) => { const k = c.luz?.color || [1, 1, 1]; return { R: Math.round(k[0] * 255), G: Math.round(k[1] * 255), B: Math.round(k[2] * 255), A: 255 }; }, set: (c, v) => { if (c.luz) c.luz.color = [v.R / 255, v.G / 255, v.B / 255]; } },
  },
  LocalLightComponent: { AttenuationRadius: { get: (c) => (c.luz?.radio ?? 10) * 100, set: (c, v) => { if (c.luz) c.luz.radio = v / 100; } } },
  AudioComponent: {
    LowPassFilterFrequency: { get: (c) => c.lpf ?? 20000, set(c, v, M) { c.lpf = v; M.audio?.filtro?.(c); } },
    bEnableLowPassFilter: { get: (c) => !!c.lpfOn, set(c, v, M) { c.lpfOn = !!v; M.audio?.filtro?.(c); } },
    VolumeMultiplier: { get: (c) => c.volMult ?? 1, set(c, v, M) { c.volMult = v; M.audio?.volumen?.(c); } },
    PitchMultiplier: { get: (c) => c.tono ?? 1, set(c, v, M) { c.tono = v; M.audio?.tonoComp?.(c); } },
    Sound: { get: (c) => c.sonido || null, set: (c, v) => { c.sonido = v; } },
    bIsUISound: { get: (c) => !!c.ui, set: (c, v) => { c.ui = v; } },
    OnAudioFinished: { get: (c) => c.v.OnAudioFinished || (c.v.OnAudioFinished = []), set: (c, v) => { c.v.OnAudioFinished = v; } },
  },
  PostProcessVolume: {
    Settings: { get: (a) => a.pp || (a.pp = copiar(a.datos?.props?.Settings || {})), set(a, v, M) { a.pp = v; M.post?.cambio?.(a); } },
    bEnabled: { get: (a) => a.ppOn !== false, set(a, v, M) { a.ppOn = !!v; M.post?.cambio?.(a); } },
    BlendWeight: { get: (a) => a.ppPeso ?? 1, set(a, v, M) { a.ppPeso = v; M.post?.cambio?.(a); } },
  },
  CharacterMovementComponent: {
    MaxWalkSpeed: { get: (c) => c.vel ?? 600, set: (c, v) => { c.vel = v; } },
    MaxAcceleration: { get: (c) => c.acel ?? 2048, set: (c, v) => { c.acel = v; } },
    Velocity: { get: (c) => c.velocidad || V(), set: (c, v) => { c.velocidad = v; } },
    GravityScale: { get: (c) => c.grav ?? 1, set: (c, v) => { c.grav = v; } },
  },
  TimelineComponent: {},
  PostProcessComponent: {
    bEnabled: { get: (c) => c.ppOn !== false, set: (c, v) => { c.ppOn = !!v; } },
    BlendWeight: { get: (c) => c.ppPeso ?? 1, set: (c, v) => { c.ppPeso = v; } },
    bUnbound: { get: (c) => c.nodo?.unbound !== false, set: (c, v) => { if (c.nodo) c.nodo.unbound = v; } },
    Settings: { get: (c) => c.pp || (c.pp = {}), set: (c, v) => { c.pp = v; } },
  },
  PrimitiveComponent: {
    OnComponentBeginOverlap: { get: (c) => c.v.OnComponentBeginOverlap || (c.v.OnComponentBeginOverlap = []), set: (c, v) => { c.v.OnComponentBeginOverlap = v; } },
    OnComponentEndOverlap: { get: (c) => c.v.OnComponentEndOverlap || (c.v.OnComponentEndOverlap = []), set: (c, v) => { c.v.OnComponentEndOverlap = v; } },
    OnClicked: { get: (c) => c.v.OnClicked || (c.v.OnClicked = []), set: (c, v) => { c.v.OnClicked = v; } },
  },
};

/* ---------------- métodos nativos por clase ---------------- */
export const METODOS = {
  Object: {
    GetWorld() { return this.mundoObj || (this.mundoObj = { __ref: true, nat: 'World', id: 'w' }); },
  },
  Actor: {
    K2_GetActorLocation(a) { return locActor(a); },
    K2_GetActorRotation(a) { return rotActor(a); },
    GetActorForwardVector(a) { return rotEjes(rotActor(a)).x; },
    GetActorRightVector(a) { return rotEjes(rotActor(a)).y; },
    GetActorUpVector(a) { return rotEjes(rotActor(a)).z; },
    GetTransform(a) { return a.raiz ? mundoUE(a.raiz.o3) : { Translation: V(), Rotation: { X: 0, Y: 0, Z: 0, W: 1 }, Scale3D: V(1, 1, 1) }; },
    GetActorScale3D(a) { return a.raiz ? mundoUE(a.raiz.o3).Scale3D : V(1, 1, 1); },
    K2_SetActorLocation(a, [loc], refs) { if (a.raiz) ponerMundo(a.raiz.o3, loc); set(refs, 2, {}); return true; },
    K2_SetActorRotation(a, [rot]) { if (a.raiz) ponerMundo(a.raiz.o3, null, rotAQuat(rot)); return true; },
    K2_SetActorLocationAndRotation(a, [loc, rot], refs) { if (a.raiz) ponerMundo(a.raiz.o3, loc, rotAQuat(rot)); set(refs, 3, {}); return true; },
    K2_SetActorTransform(a, [t], refs) { if (a.raiz) ponerMundo(a.raiz.o3, t.Translation, t.Rotation, t.Scale3D); set(refs, 2, {}); return true; },
    K2_TeleportTo(a, [loc, rot]) { if (a.raiz) ponerMundo(a.raiz.o3, loc, rotAQuat(rot)); return true; },
    K2_AddActorWorldOffset(a, [d], refs) { if (a.raiz) ponerMundo(a.raiz.o3, vadd(locActor(a), d)); set(refs, 2, {}); },
    K2_AddActorWorldRotation(a, [r]) { if (a.raiz) { const q = mundoUE(a.raiz.o3).Rotation; ponerMundo(a.raiz.o3, null, qmul(rotAQuat(r), q)); } },
    K2_AddActorLocalRotation(a, [r]) { if (a.raiz) { const q = mundoUE(a.raiz.o3).Rotation; ponerMundo(a.raiz.o3, null, qmul(q, rotAQuat(r))); } },
    K2_AddActorLocalOffset(a, [d]) { if (a.raiz) { const t = mundoUE(a.raiz.o3); ponerMundo(a.raiz.o3, vadd(t.Translation, qrot(t.Rotation, d))); } },
    SetActorScale3D(a, [s]) { if (a.raiz) ponerMundo(a.raiz.o3, null, null, s); },
    SetActorRelativeScale3D(a, [s]) { if (a.raiz) { sT(s, a.raiz.o3.scale); a.raiz.o3.updateMatrixWorld(true); } },
    K2_DestroyActor(a) { this.destruir(a); },
    SetActorHiddenInGame(a, [b]) { a.ocultoJuego = !!b; for (const c of a.comps) aplicarVisibilidad(this, c); },
    SetActorEnableCollision(a, [b]) { a.sinColision = !b; },
    GetActorEnableCollision(a) { return !a.sinColision; },
    SetActorTickEnabled(a, [b]) { a.tickActivo = !!b; },
    IsActorTickEnabled(a) { return a.tickActivo !== false; },
    GetDistanceTo(a, [b]) { return b ? vlen(vsub(locActor(a), locActor(b))) : 0; },
    GetHorizontalDistanceTo(a, [b]) { if (!b) return 0; const d = vsub(locActor(a), locActor(b)); return Math.hypot(d.X, d.Y); },
    GetActorBounds(a, [solo], refs) {
      _b.makeEmpty(); for (const c of a.comps) if (c.malla) _b.expandByObject(c.malla);
      if (_b.isEmpty()) { set(refs, 1, locActor(a)); set(refs, 2, V()); return; }
      const ce = _b.getCenter(new THREE.Vector3()), ex = _b.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      set(refs, 1, pUE(ce)); set(refs, 2, { X: ex.x * 100, Y: ex.z * 100, Z: ex.y * 100 });
    },
    IsOverlappingActor(a, [b]) { return this.solapan?.(a, b) ?? false; },
    GetOverlappingActors(a, [clase], refs) { set(refs, 0, this.solapados?.(a, clase) ?? []); },
    GetComponentsByClass(a, [cl]) { const n = cl?.nativa || cl?.n; return a.comps.filter((c) => !n || this.naturalHereda(c.nat, n)); },
    GetComponentByClass(a, [cl]) { const n = cl?.nativa || cl?.n; return a.comps.find((c) => !n || this.naturalHereda(c.nat, n)) || null; },
    K2_AttachToActor(a, [p, sock]) { if (!p?.raiz || !a.raiz) return; const t = mundoUE(a.raiz.o3); this.colgar(a.raiz, p.raiz, sock); ponerMundo(a.raiz.o3, t.Translation, t.Rotation, t.Scale3D); },
    K2_AttachToComponent(a, [p, sock]) { if (!p || !a.raiz) return; const t = mundoUE(a.raiz.o3); this.colgar(a.raiz, p, sock); ponerMundo(a.raiz.o3, t.Translation, t.Rotation, t.Scale3D); },
    K2_DetachFromActor(a) { if (!a.raiz) return; const t = mundoUE(a.raiz.o3); this.escena.add(a.raiz.o3); ponerMundo(a.raiz.o3, t.Translation, t.Rotation, t.Scale3D); },
    GetVelocity(a) { return a.velocidad || V(); },
    EnableInput(a) { a.input = true; },
    DisableInput(a) { a.input = false; },
    GetOwner(a) { return a.dueno || null; },
    SetOwner(a, [o]) { a.dueno = o; },
    ActorHasTag(a, [t]) { return (a.tags || []).some((x) => String(x).toLowerCase() === String(t).toLowerCase()); },
    GetGameTimeSinceCreation(a) { return this.tiempo - (a.nacio || 0); },
    K2_GetRootComponent(a) { return a.raiz; },
    SetLifeSpan(a, [t]) { if (t > 0) setTimeout(() => this.destruir(a), t * 1000); },
    // AmbientSound
    Play(a, vals) { const c = a.comps.find((x) => x.nat === 'AudioComponent'); if (c) return METODOS.AudioComponent.Play.call(this, c, vals); const m = a.matinee; if (m) m.play(); },
    Stop(a) { const c = a.comps.find((x) => x.nat === 'AudioComponent'); if (c) return METODOS.AudioComponent.Stop.call(this, c); if (a.matinee) a.matinee.stop(); },
    FadeIn(a, vals) { const c = a.comps.find((x) => x.nat === 'AudioComponent'); if (c) METODOS.AudioComponent.FadeIn.call(this, c, vals); },
    FadeOut(a, vals) { const c = a.comps.find((x) => x.nat === 'AudioComponent'); if (c) METODOS.AudioComponent.FadeOut.call(this, c, vals); },
    // Emitter
    Activate(a) { for (const c of a.comps) if (c.nat === 'ParticleSystemComponent') this.particulas?.activar(c, true); },
    Deactivate(a) { for (const c of a.comps) if (c.nat === 'ParticleSystemComponent') this.particulas?.activar(c, false); },
    ToggleActive(a) { for (const c of a.comps) if (c.nat === 'ParticleSystemComponent') this.particulas?.activar(c, !c.partActivo); },
    SetActorTickInterval() {},
  },
  Pawn: {
    GetController(a) { return a.controlador || null; },
    GetControlRotation(a) { return a.controlador ? { ...a.controlador.rotControl } : rotActor(a); },
    AddControllerYawInput(a, [v]) { if (a.controlador) a.controlador.rotPend = (a.controlador.rotPend || 0) + v * a.controlador.yawEsc; },
    AddControllerPitchInput(a, [v]) { if (a.controlador) a.controlador.pitchPend = (a.controlador.pitchPend || 0) + v * a.controlador.pitchEsc; },
    AddControllerRollInput() {},
    AddMovementInput(a, [d, k = 1, force]) { a.movPend = vadd(a.movPend || V(), vmul(d, k)); },
    GetMovementComponent(a) { return a.comps.find((c) => /Movement/.test(c.nat)) || null; },
    IsPlayerControlled(a) { return a.controlador === this.pc; },
    DetachFromControllerPendingDestroy(a) { if (a.controlador) { a.controlador.peon = null; a.controlador = null; } },
    SpawnDefaultController() {},
  },
  Character: {
    Jump() {}, StopJumping() {}, LaunchCharacter() {},
  },
  Controller: {
    Possess(pc, [p]) { if (p) this.poseer(pc, p); },
    UnPossess(pc) { if (pc.peon) { pc.peon.controlador = null; pc.peon = null; } },
    K2_GetPawn(pc) { return pc.peon || null; },
    GetControlRotation(pc) { return { ...pc.rotControl }; },
    SetControlRotation(pc, [r]) { pc.rotControl = { Pitch: r.Pitch, Yaw: r.Yaw, Roll: r.Roll }; },
    IsLocalPlayerController() { return true; },
    IsLocalController() { return true; },
    SetIgnoreLookInput(pc, [b]) { pc.ignorarMirar = !!b; },
    SetIgnoreMoveInput(pc, [b]) { pc.ignorarMover = !!b; },
    ResetIgnoreLookInput(pc) { pc.ignorarMirar = false; },
    ResetIgnoreMoveInput(pc) { pc.ignorarMover = false; },
    StopMovement() {},
  },
  PlayerController: {
    SetViewTargetWithBlend(pc, [t, dur = 0, f = 0, exp = 0, lock]) { this.ponerVista(t, dur, f, exp); },
    GetViewTarget(pc) { return this.cm.vista?.obj || null; },
    ClientPlayCameraShake(pc, [cl, esc = 1]) { this.sacudir?.(cl, esc); },
    ClientStopCameraShake(pc, [cl]) { this.cm.sacudidas = this.cm.sacudidas.filter((s) => s.clase !== cl); },
    ClientStopAllCameraShakes() { this.cm.sacudidas = []; },
    PlayDynamicForceFeedback() {}, ClientPlayForceFeedback() {},
    DeprojectScreenPositionToWorld(pc, [x, y], refs) { const r = this.deproyectar?.(x, y); if (!r) return false; set(refs, 2, r[0]); set(refs, 3, r[1]); return true; },
    ProjectWorldLocationToScreen(pc, [p], refs) { const r = this.proyectar?.(p); if (!r) return false; set(refs, 1, r); return r.ok; },
    GetMousePosition(pc, vals, refs) { set(refs, 0, this.mouse?.x || 0); set(refs, 1, this.mouse?.y || 0); return true; },
    GetInputMouseDelta(pc, vals, refs) { set(refs, 0, this.ejes.MouseX || 0); set(refs, 1, this.ejes.MouseY || 0); },
    WasInputKeyJustPressed(pc, [k]) { return !!this.recien?.has(k?.KeyName); },
    IsInputKeyDown(pc, [k]) { return this.teclasApretadas.has(k?.KeyName); },
    SetMouseLocation() {}, SetCinematicMode() {}, ConsoleCommand(pc, [c]) { this.consola?.(c); },
    GetHUD() { return null; },
  },
  PlayerCameraManager: {
    GetCameraLocation(cm) { return cm.ultimo?.Translation || V(); },
    GetCameraRotation(cm) { return cm.ultimo ? quatARot(cm.ultimo.Rotation) : { Pitch: 0, Yaw: 0, Roll: 0 }; },
    GetFOVAngle(cm) { return cm.ultimoFov || 90; },
    StartCameraFade(cm, [desde, hasta, dur, color, audio, mantener]) { cm.fade = { color: color || { R: 0, G: 0, B: 0, A: 1 }, alfa: desde, desde, hasta, t: 0, dur, mantener: !!mantener }; },
    StopCameraFade(cm) { cm.fade.alfa = 0; cm.fade.dur = 0; cm.fade.hasta = 0; },
    SetManualCameraFade(cm, [a, color]) { cm.fade = { color: color || { R: 0, G: 0, B: 0, A: 1 }, alfa: a, desde: a, hasta: a, t: 0, dur: 0, mantener: true }; },
    StopAllCameraShakes(cm) { cm.sacudidas = []; },
    PlayCameraShake(cm, [cl, esc = 1]) { this.sacudir?.(cl, esc); },
  },
  GameModeBase: { },
  SceneComponent: {
    SetVisibility(c, [v, prop]) { const f = (x) => { x.vis = !!v; aplicarVisibilidad(this, x); }; f(c); if (prop) this.hijosComp(c).forEach(f); },
    ToggleVisibility(c, [prop]) { METODOS.SceneComponent.SetVisibility.call(this, c, [!c.vis, prop]); },
    SetHiddenInGame(c, [b, prop]) { const f = (x) => { x.ocultoJuego = !!b; aplicarVisibilidad(this, x); }; f(c); if (prop) this.hijosComp(c).forEach(f); },
    IsVisible(c) { return c.vis && !c.ocultoJuego; },
    K2_GetComponentLocation(c) { return mundoDe(c).Translation; },
    K2_GetComponentRotation(c) { return quatARot(mundoDe(c).Rotation); },
    K2_GetComponentScale(c) { return mundoDe(c).Scale3D; },
    K2_GetComponentToWorld(c) { return mundoDe(c); },
    GetForwardVector(c) { return qrot(mundoDe(c).Rotation, V(1, 0, 0)); },
    GetRightVector(c) { return qrot(mundoDe(c).Rotation, V(0, 1, 0)); },
    GetUpVector(c) { return qrot(mundoDe(c).Rotation, V(0, 0, 1)); },
    K2_SetRelativeLocation(c, [l], refs) { pT(l, c.o3.position); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_SetRelativeRotation(c, [r], refs) { rotT(r, c.o3.quaternion); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_SetRelativeLocationAndRotation(c, [l, r], refs) { pT(l, c.o3.position); rotT(r, c.o3.quaternion); c.o3.updateMatrixWorld(true); set(refs, 3, {}); },
    K2_SetRelativeTransform(c, [t]) { pT(t.Translation, c.o3.position); qT(t.Rotation, c.o3.quaternion); sT(t.Scale3D, c.o3.scale); c.o3.updateMatrixWorld(true); },
    K2_SetWorldLocation(c, [l], refs) { ponerMundo(c.o3, l); set(refs, 2, {}); },
    K2_SetWorldRotation(c, [r], refs) { ponerMundo(c.o3, null, rotAQuat(r)); set(refs, 2, {}); },
    K2_SetWorldLocationAndRotation(c, [l, r], refs) { ponerMundo(c.o3, l, rotAQuat(r)); set(refs, 3, {}); },
    K2_SetWorldTransform(c, [t]) { ponerMundo(c.o3, t.Translation, t.Rotation, t.Scale3D); },
    K2_AddLocalOffset(c, [d], refs) { _v.copy(pT(d)).applyQuaternion(c.o3.quaternion); c.o3.position.add(_v); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_AddLocalRotation(c, [r], refs) { c.o3.quaternion.multiply(rotT(r, _q)); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_AddRelativeRotation(c, [r], refs) { c.o3.quaternion.premultiply(rotT(r, _q)); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_AddRelativeLocation(c, [d], refs) { c.o3.position.add(pT(d, _v)); c.o3.updateMatrixWorld(true); set(refs, 2, {}); },
    K2_AddWorldOffset(c, [d]) { ponerMundo(c.o3, vadd(mundoDe(c).Translation, d)); },
    K2_AddWorldRotation(c, [r]) { ponerMundo(c.o3, null, qmul(rotAQuat(r), mundoDe(c).Rotation)); },
    SetWorldScale3D(c, [s]) { ponerMundo(c.o3, null, null, s); },
    SetRelativeScale3D(c, [s]) { sT(s, c.o3.scale); c.o3.updateMatrixWorld(true); },
    GetChildrenComponents(c, [todos], refs) { const r = todos ? this.hijosComp(c) : this.hijosComp(c, true); set(refs, 1, r); },
    GetChildComponent(c, [i]) { return this.hijosComp(c, true)[i] || null; },
    GetNumChildrenComponents(c) { return this.hijosComp(c, true).length; },
    GetAttachParent(c) { return c.o3.parent?.userData?.comp || null; },
    GetOwner(c) { return c.actor; },
    K2_AttachToComponent(c, [p, sock]) { if (p) { const t = mundoDe(c); this.colgar(c, p, sock); ponerMundo(c.o3, t.Translation, t.Rotation, t.Scale3D); } return true; },
    K2_DetachFromComponent(c) { const t = mundoDe(c); this.escena.add(c.o3); ponerMundo(c.o3, t.Translation, t.Rotation, t.Scale3D); },
    SetMobility() {},
    K2_DestroyComponent(c) { c.vivo = false; c.o3.removeFromParent(); },
    Activate(c, [reset]) { this.activarComp?.(c, true, reset); },
    Deactivate(c) { this.activarComp?.(c, false); },
    SetActive(c, [b, reset]) { this.activarComp?.(c, !!b, reset); },
    IsActive(c) { return c.activo !== false; },
    ToggleActive(c) { this.activarComp?.(c, !c.activo); },
  },
  ActorComponent: {
    GetOwner(c) { return c.actor; },
    K2_DestroyComponent(c) { c.vivo = false; c.o3?.removeFromParent(); },
    Activate(c, [reset]) { this.activarComp?.(c, true, reset); },
    Deactivate(c) { this.activarComp?.(c, false); },
    SetActive(c, [b, reset]) { this.activarComp?.(c, !!b, reset); },
    IsActive(c) { return c.activo !== false; },
    SetComponentTickEnabled(c, [b]) { c.tickActivo = !!b; },
  },
  PrimitiveComponent: {
    SetCollisionEnabled(c, [m]) { c.colHabil = m !== 0; },
    SetCollisionObjectType(c, [t]) { c.tipoObj = t; },
    GetCollisionObjectType(c) { return c.tipoObj ?? 0; },
    SetCollisionResponseToChannel(c, [ch, r]) { (c.resp || (c.resp = {}))[ch] = r; },
    SetCollisionResponseToAllChannels(c, [r]) { c.respTodos = r; c.resp = {}; },
    SetCollisionProfileName(c, [n]) { c.col.perfil = n; c.colHabil = n !== 'NoCollision'; },
    GetCollisionProfileName(c) { return c.col?.perfil || 'BlockAll'; },
    IsOverlappingActor(c, [a]) { return this.solapanComp?.(c, a) ?? false; },
    GetOverlappingActors(c, [cl], refs) { set(refs, 0, this.solapadosComp?.(c, cl) ?? []); },
    SetRenderCustomDepth() {}, SetCustomDepthStencilValue() {}, SetCastShadow() {}, SetSimulatePhysics() {}, AddImpulse() {}, AddForce() {}, SetEnableGravity() {},
    SetPhysicsLinearVelocity() {}, SetAllPhysicsLinearVelocity() {},
    GetPhysicsLinearVelocity() { return V(); }, GetPhysicsAngularVelocity() { return V(); }, GetComponentVelocity() { return V(); },
    SetGenerateOverlapEvents(c, [b]) { c.sinOverlap = !b; },
    SetMaterial(c, [i, m]) { this.materiales?.ponerMaterial(c, i, m); },
    GetMaterial(c, [i]) { return this.materiales?.material(c, i) ?? null; },
    CreateDynamicMaterialInstance(c, [i, src]) { return this.materiales?.dinamico(c, i, src) ?? null; },
    CreateAndSetMaterialInstanceDynamic(c, [i]) { return this.materiales?.dinamico(c, i) ?? null; },
    GetNumMaterials(c) { return c.malla ? (Array.isArray(c.malla.material) ? c.malla.material.length : 1) : 0; },
  },
  MeshComponent: {
    SetScalarParameterValueOnMaterials(c, [n, v]) { this.materiales?.escalarEnComp(c, n, v); },
    SetVectorParameterValueOnMaterials(c, [n, v]) { this.materiales?.vectorEnComp(c, n, v); },
  },
  StaticMeshComponent: {
    SetStaticMesh(c, [m]) { this.cambiarMalla?.(c, m); return true; },
  },
  ShapeComponent: {},
  BoxComponent: { SetBoxExtent(c, [e]) { c.caja = e; } },
  SphereComponent: { SetSphereRadius(c, [r]) { c.radio = r; } },
  CapsuleComponent: { SetCapsuleRadius(c, [r]) { c.capsula = [r, c.capsula?.[1] ?? 44]; }, SetCapsuleSize(c, [r, h]) { c.capsula = [r, h]; }, GetScaledCapsuleHalfHeight(c) { return c.capsula?.[1] ?? 44; } },
  CameraComponent: {
    SetFieldOfView(c, [f]) { c.fov = f; },
    SetConstraintAspectRatio() {}, SetAspectRatio() {}, SetPostProcessBlendWeight(c, [w]) { c.ppPeso = w; },
    SetProjectionMode() {},
  },
  LightComponent: {
    SetIntensity(c, [v]) { if (c.luz) c.luz.int = v; },
    SetLightColor(c, [col]) { if (c.luz) c.luz.color = [col.R, col.G, col.B]; },
    SetLightFunctionMaterial() {}, SetAffectDynamicIndirectLighting() {}, SetCastShadows() {}, SetIndirectLightingIntensity() {},
  },
  LightComponentBase: { GetLightColor(c) { const k = c.luz?.color || [1, 1, 1]; return { R: k[0], G: k[1], B: k[2], A: 1 }; } },
  LocalLightComponent: { SetAttenuationRadius(c, [r]) { if (c.luz) c.luz.radio = r / 100; } },
  SpotLightComponent: { SetInnerConeAngle(c, [a]) { if (c.luz) c.luz.in = a; }, SetOuterConeAngle(c, [a]) { if (c.luz) c.luz.out = a; } },
  TextRenderComponent: { K2_SetText(c, [t]) { this.textoRender?.(c, t); }, SetText(c, [t]) { this.textoRender?.(c, t); }, SetTextRenderColor(c, [col]) { this.colorTextoRender?.(c, col); } },
  CharacterMovementComponent: { StopMovementImmediately(c) { c.velocidad = V(); }, SetMovementMode(c, [m]) { c.modo = m; }, DisableMovement(c) { c.modo = 0; } },
  MovementComponent: { StopMovementImmediately(c) { c.velocidad = V(); } },
  PostProcessComponent: {
    AddOrUpdateBlendable(c, [obj, peso = 1]) { const l = c.blendables || (c.blendables = []); const i = l.findIndex((x) => x.obj === obj); if (i >= 0) l[i].peso = peso; else l.push({ obj, peso }); this.post?.cambio?.(c); },
  },
  SaveGame: {},
};

/* ---------------- funciones estáticas que necesitan el mundo ---------------- */
const M = (vm) => vm.mundo;
export const NATIVOS = {
  'GameplayStatics:GetPlayerController': (T, a, r, F, vm) => M(vm).pc,
  'GameplayStatics:GetPlayerCharacter': (T, a, r, F, vm) => M(vm).pc?.peon || null,
  'GameplayStatics:GetPlayerPawn': (T, a, r, F, vm) => M(vm).pc?.peon || null,
  'GameplayStatics:GetPlayerCameraManager': (T, a, r, F, vm) => M(vm).cm,
  'GameplayStatics:GetGameMode': (T, a, r, F, vm) => M(vm).gameMode,
  'GameplayStatics:GetGameState': (T, a, r, F, vm) => M(vm).gameState || (M(vm).gameState = { __ref: true, nat: 'GameStateBase', v: {}, id: 'gs' }),
  'GameplayStatics:GetGameInstance': (T, a, r, F, vm) => M(vm).instanciaJuego,
  'GameplayStatics:GetWorldDeltaSeconds': (T, a, r, F, vm) => M(vm).dtUltimo || 0.016,
  'GameplayStatics:GetRealTimeSeconds': (T, a, r, F, vm) => performance.now() / 1000,
  'GameplayStatics:GetTimeSeconds': (T, a, r, F, vm) => M(vm).tiempo,
  'GameplayStatics:GetCurrentLevelName': (T, a, r, F, vm) => M(vm).nombreNivel,
  'GameplayStatics:OpenLevel': (T, [ctx, n], r, F, vm) => { M(vm).abrirNivel(String(n)); },
  'GameplayStatics:SetGamePaused': (T, [ctx, b], r, F, vm) => { M(vm).pausado = !!b; M(vm).audio?.pausar?.(!!b); return true; },
  'GameplayStatics:IsGamePaused': (T, a, r, F, vm) => M(vm).pausado,
  'GameplayStatics:SetGlobalPitchModulation': (T, [ctx, p, t], r, F, vm) => { M(vm).audio?.tonoGlobal?.(p, t); },
  'GameplayStatics:SetGlobalTimeDilation': (T, [ctx, d], r, F, vm) => { M(vm).dilatacion = d; },
  'GameplayStatics:GetGlobalTimeDilation': (T, a, r, F, vm) => M(vm).dilatacion,
  'GameplayStatics:SetSoundMixClassOverride': () => {}, 'GameplayStatics:PushSoundMixModifier': () => {}, 'GameplayStatics:PopSoundMixModifier': () => {},
  'GameplayStatics:ClearSoundMixModifiers': () => {}, 'GameplayStatics:ActivateReverbEffect': () => {}, 'GameplayStatics:DeactivateReverbEffect': () => {},
  'GameplayStatics:PlaySound2D': (T, [ctx, s, vol = 1, tono = 1, ini = 0], r, F, vm) => { M(vm).audio?.reproducir2D(s, vol, tono, ini); },
  'GameplayStatics:SpawnSound2D': (T, [ctx, s, vol = 1, tono = 1, ini = 0], r, F, vm) => M(vm).audio?.crearComp2D(s, vol, tono, ini, true) ?? null,
  'GameplayStatics:CreateSound2D': (T, [ctx, s, vol = 1, tono = 1, ini = 0], r, F, vm) => M(vm).audio?.crearComp2D(s, vol, tono, ini, false) ?? null,
  'GameplayStatics:PlaySoundAtLocation': (T, [ctx, s, loc, rot, vol = 1, tono = 1, ini = 0], r, F, vm) => { M(vm).audio?.reproducirEn(s, loc, vol, tono, ini); },
  'GameplayStatics:SpawnSoundAtLocation': (T, [ctx, s, loc, rot, vol = 1, tono = 1, ini = 0], r, F, vm) => M(vm).audio?.crearCompEn(s, loc, vol, tono, ini) ?? null,
  'GameplayStatics:SpawnSoundAttached': (T, [s, comp, sock, loc, rot, regla, parar, vol = 1, tono = 1, ini = 0], r, F, vm) => M(vm).audio?.crearCompPegado(s, comp, vol, tono, ini) ?? null,
  'GameplayStatics:GetAllActorsOfClass': (T, [ctx, cl], refs, F, vm) => { const n = cl?.n || cl?.nativa; const l = M(vm).actores.filter((a) => a.vivo && !a.esSistema && vm.esA(a, n)); set(refs, 2, l); },
  'GameplayStatics:GetAllActorsWithTag': (T, [ctx, t], refs, F, vm) => { set(refs, 2, M(vm).actores.filter((a) => a.vivo && (a.tags || []).some((x) => String(x) === String(t)))); },
  'GameplayStatics:BeginDeferredActorSpawnFromClass': (T, [ctx, cl, t], r, F, vm) => (cl ? M(vm).spawnActor(cl, t, { diferido: true }) : null),
  'GameplayStatics:FinishSpawningActor': (T, [a, t], r, F, vm) => { if (a && t && a.raiz) ponerMundo(a.raiz.o3, t.Translation, t.Rotation, t.Scale3D); if (a) M(vm).beginPlay(a); return a; },
  'GameplayStatics:BreakHitResult': (T, [h], refs) => {
    h = h || {};
    const v = [h.bBlockingHit ?? !!h.Actor, h.bStartPenetrating ?? false, h.Time ?? 0, h.Location || V(), h.ImpactPoint || V(), h.Normal || V(), h.ImpactNormal || V(), null, h.Actor || null, h.Component || null, h.BoneName || 'None', h.Item ?? -1, h.FaceIndex ?? -1, h.TraceStart || V(), h.TraceEnd || V()];
    if (refs.length > 16) v.splice(3, 0, h.Distance ?? 0);
    v.forEach((x, i) => set(refs, i + 1, x));
  },
  'GameplayStatics:CreateSaveGameObject': (T, [cl], r, F, vm) => M(vm).nuevoGuardado(cl),
  'GameplayStatics:SaveGameToSlot': (T, [o, slot, u], r, F, vm) => M(vm).guardarSlot(o, slot),
  'GameplayStatics:LoadGameFromSlot': (T, [slot, u], r, F, vm) => M(vm).cargarSlot(slot),
  'GameplayStatics:DoesSaveGameExist': (T, [slot, u], r, F, vm) => M(vm).existeSlot(slot),
  'GameplayStatics:DeleteGameInSlot': (T, [slot, u], r, F, vm) => M(vm).borrarSlot(slot),
  'GameplayStatics:SpawnEmitterAtLocation': (T, [ctx, ps, loc, rot, esc, auto], r, F, vm) => M(vm).particulas?.emitirEn(ps, loc, rot, esc) ?? null,
  'GameplayStatics:SpawnEmitterAttached': (T, [ps, comp], r, F, vm) => M(vm).particulas?.emitirPegado(ps, comp) ?? null,
  'GameplayStatics:SpawnDecalAtLocation': () => null,
  'GameplayStatics:GetPlatformName': () => 'Android',
  'KismetSystemLibrary:LineTraceSingle': (T, [ctx, a, b, canal, complejo, ignorar, dbg], refs, F, vm) => { const h = M(vm).trazar(a, b, { canal, ignorar, yo: F.self }); set(refs, 7, h || {}); return !!h; },
  'KismetSystemLibrary:LineTraceSingleForObjects': (T, [ctx, a, b, tipos, complejo, ignorar, dbg], refs, F, vm) => { const h = M(vm).trazar(a, b, { tipos: (tipos || []).map((t) => OBJQ[t] ?? t), ignorar, yo: F.self }); set(refs, 7, h || {}); return !!h; },
  'KismetSystemLibrary:SphereTraceSingle': (T, [ctx, a, b, rad, canal, complejo, ignorar], refs, F, vm) => { const h = M(vm).trazar(a, b, { canal, ignorar, radio: rad, yo: F.self }); set(refs, 8, h || {}); return !!h; },
  'KismetSystemLibrary:SphereTraceSingleForObjects': (T, [ctx, a, b, rad, tipos, complejo, ignorar], refs, F, vm) => { const h = M(vm).trazar(a, b, { tipos: (tipos || []).map((t) => OBJQ[t] ?? t), ignorar, radio: rad, yo: F.self }); set(refs, 8, h || {}); return !!h; },
  'KismetSystemLibrary:GetComponentBounds': (T, [c], refs) => { _b.makeEmpty(); if (c?.malla) _b.setFromObject(c.malla); else if (c?.o3) _b.setFromObject(c.o3); const ce = _b.isEmpty() ? new THREE.Vector3() : _b.getCenter(new THREE.Vector3()); const ex = _b.isEmpty() ? new THREE.Vector3() : _b.getSize(new THREE.Vector3()).multiplyScalar(0.5); set(refs, 1, pUE(ce)); set(refs, 2, { X: ex.x * 100, Y: ex.z * 100, Z: ex.y * 100 }); set(refs, 3, ex.length() * 100); },
  'KismetMaterialLibrary:CreateDynamicMaterialInstance': (T, [ctx, m], r, F, vm) => M(vm).materiales?.nuevoDinamico(m) ?? null,
  'KismetMaterialLibrary:SetScalarParameterValue': (T, [ctx, col, n, v], r, F, vm) => { M(vm).materiales?.coleccion(n, v); },
  'AIBlueprintHelperLibrary:GetAIController': () => null,
  'AIBlueprintHelperLibrary:SpawnAIFromClass': (T, [ctx, cl, bt, loc, rot], r, F, vm) => M(vm).spawnActor(cl, { Translation: loc, Rotation: rotAQuat(rot || {}), Scale3D: V(1, 1, 1) }),
  'NavigationSystem:SimpleMoveToActor': (T, [pc, dst], r, F, vm) => { M(vm).moverHacia?.(pc, dst); },
  'NavigationSystem:SimpleMoveToLocation': (T, [pc, loc], r, F, vm) => { M(vm).moverHacia?.(pc, null, loc); },
};
