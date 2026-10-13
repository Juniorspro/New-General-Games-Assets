// Tom vivo: el AnimationController de My Talking Tom (Outfit7.MyTalkingTom.Animations) portado tal
// cual. Cada animación es un "tracker" con su manera de sonar (DefaultAnimation, MoodBlendAnimation,
// AdditiveIdleAnimation, TalkAnimation, PokeFallAnimation…); el controlador decide qué sigue
// (TriggerIdleAnim cada 0,5 s, el cambio de humor al terminar una animación); el estado de cada
// cuarto dice qué hace cada acción (LivingroomAnimationState…) y TomsTouchController convierte los
// toques en acciones. Leído de libil2cpp.so con Ghidra (herramientas/unity/descompilar.py): los
// nombres de clases, métodos y campos son los del juego, para poder seguirlo.
//
// Sobre AnimacionUnity (anim.js), que hace de componente Animation de Unity.

import { PLAY_STOP_ALL, BLEND, ADDITIVE } from './anim.js';

export const A = {
  Idle: 0, Mood: 1, Listen: 2, ListenStop: 3, Talk: 4, PokeHead: 5, PokeBody: 6, PokeTail: 7, EatFood: 8,
  TrackFood: 9, RejectFood: 10, MissdropFood: 11, OpenMouth: 12, SwipeBody: 13, EnterCabin: 14,
  ShoulderShrug: 15, WardrobeShowoff: 16, PokeLeftFoot: 17, PokeRightFoot: 18, WardrobeChanged: 19,
  LightsOff: 20, LightsOn: 21, SleepingOnBedroomEnter: 22, Newborn: 23, CatBoxPoke: 24,
  RejectGamesAnimation: 25, PlayHungryWithEnergyPotion: 26, StartFingerFollow: 27, Excited: 28,
  ShakeFoamOff: 29, WaterSplash: 30, GrowUp: 31, BirthdayParty: 32, OpenGift: 33, Wave: 34,
};
import { HAPPY, SLEEPY, DISCONNECTED } from './logica.js';      // TomMood
export { HAPPY, SLEEPY, DISCONNECTED };
const LARGE = 0, MEDIUM = 1, SMALL = 2;                              // AnimationNames.Toms3Sizes
const CLAMP = 8;                                                     // WrapMode.ClampForever
const PRIORITY_LOW = 1000, PRIORITY_NORMAL = 2000;

const lerp = (a, b, t) => (b - a) * Math.min(1, Math.max(0, t)) + a;   // BlendAnimation.lerp

// ------------------------------------------------------------------------------------------------
// Los trackers (Outfit7.MyTalkingTom.Animations.AnimationTypes)

class AnimationTracker {
  constructor(ctl, animName) {
    this.ctl = ctl;
    this.animName = animName;
    this.sounds = null;                 // campo de AnimationAudioData (sonido/eventos.json → animacion)
    this.priority = PRIORITY_NORMAL;
    this.animState = null;
    this.delaySound = 0;
    this.canListenDuringAnimation = false;
    this.animationFinishedAction = null;
    this.animationInterruptedOrFinishedAction = null;   // (terminóBien) => …
  }
  isPlaying() { const s = this.animState; return !!(s && s.enabled && s.time < s.length); }
  stop(interrupted) { }
  onUpdate() { }
  onLateUpdate() { }
  playSound(time) { if (this.sounds) this.ctl.playSound(this.sounds, time, this.delaySound); }
  // el estado que manda (para TomCharacterAnimationOffset del adolescente)
  get principal() { return this.animState; }
}

class DefaultAnimation extends AnimationTracker {
  play(time = 0) {
    const c = this.ctl, s = this.animState = c.loadAnimationState(this.animName);
    if (!s) return;
    s.layer = 1;
    s.wrapMode = CLAMP;
    c.anim.stop();
    c.anim.play(s.name, PLAY_STOP_ALL);
    c.currentAnimation = this;
    this.playSound(0);
  }
}

// ListenAnimation: suena mientras esté prendida (hasta que otra la reemplace)
class ListenAnimation extends DefaultAnimation {
  isPlaying() { return !!(this.animState && this.animState.enabled); }
}

// BlendInAndOutAnimation: el peso de la animación de humor (cara) o de cuello mientras suena otra:
// 1 hasta x, baja a 0 hasta y, 0 hasta z, sube a 1 hasta w (segundos de la animación).
class BlendInAndOutAnimation {
  constructor(ctl) { this.ctl = ctl; this.startBlend = false; this.animState = null; this.blendAnimState = null; this.times = null; }
  setStartBlend(v) {
    const antes = this.startBlend;
    this.startBlend = v;
    const l = this.ctl.blendAnimations;
    if (!antes && v) { l.push(this); this.blend(); }
    else if (antes && !v) { const i = l.indexOf(this); if (i >= 0) l.splice(i, 1); }
  }
  blendConfiguration(times, animState, blendAnimState) {
    this.animState = animState;
    this.blendAnimState = blendAnimState;
    this.times = times;
    if (!this.startBlend) { this.startBlend = true; this.ctl.blendAnimations.push(this); }
    this.blend();
  }
  blend() {
    const a = this.animState, b = this.blendAnimState;
    if (!a || !b || !a.enabled || !b.enabled) { this.setStartBlend(false); return; }
    if (!this.startBlend) return;
    const [x, y, z, w] = this.times, t = a.time;
    if (t <= x) b.weight = 1;
    else if (t > w) { b.weight = 1; this.setStartBlend(false); }
    else if (t < y) b.weight = lerp(1, 0, (t - x) / (y - x));
    else if (t <= z) b.weight = 0;
    else b.weight = lerp(0, 1, (t - z) / (w - z));
  }
}

// BlendInAnimation / BlendOutAnimation: de 0 a 1 (o de 1 a 0) entre x e y
class BlendInOutAnimation extends BlendInAndOutAnimation {
  constructor(ctl, sube) { super(ctl); this.sube = sube; }
  blend() {
    const a = this.animState, b = this.blendAnimState;
    if (!a || !b || !a.enabled || !b.enabled) { this.setStartBlend(false); return; }
    if (!this.startBlend) return;
    const [x, y] = this.times, t = a.time, de = this.sube ? 0 : 1, a1 = this.sube ? 1 : 0;
    if (t <= x) b.weight = de;
    else if (t <= y) b.weight = lerp(de, a1, (t - x) / (y - x));
    else { b.weight = a1; this.setStartBlend(false); }
  }
}

// AnimationHelper.PlayCommonMoodBlend(ctl, animState, additive)
function playCommonMoodBlend(c, s, additive) {
  let base = null;
  if (additive) {
    base = c.loadAnimationState('happy' + c.animPostfix);
    if (base) { base.layer = 1; base.wrapMode = CLAMP; }
  }
  const mood = c.loadAnimationStateAndAddMixingTransform(c.mixedMoodAnimationName());
  if (mood) { mood.layer = 2; mood.blendMode = BLEND; mood.wrapMode = CLAMP; }
  const nombreCuello = c.moodNeckAnimationName();
  let neck = null;
  if (!nombreCuello && !additive) {
    s.layer = 1; s.wrapMode = CLAMP; s.blendMode = BLEND;
    c.anim.stop();
    c.anim.play(s.name, 0);
    if (mood) c.anim.play(mood.name, 0);
  } else {
    if (nombreCuello) {
      neck = c.loadAnimationState(nombreCuello);
      if (neck) { neck.layer = 3; neck.wrapMode = CLAMP; neck.blendMode = ADDITIVE; }
    }
    s.layer = 6; s.wrapMode = CLAMP; s.blendMode = ADDITIVE;
    c.anim.stop();
    if (base) c.anim.play(base.name, 0);
    c.anim.play(s.name, 0);
    if (mood) c.anim.play(mood.name, 0);
    s.time = 0.06666667;
  }
  return { mood, neck };
}

// AnimationHelper.PlayBlendInAndOutOfMood
function playBlendInAndOutOfMood(c, blendMood, moodTimes, blendNeck, neckTimes, s, additive) {
  const r = playCommonMoodBlend(c, s, additive);
  if (r.neck) {
    c.anim.play(r.neck.name, 0);
    blendNeck.blendConfiguration(neckTimes, s, r.neck);
    r.neck.time = r.neck.length;
  }
  if (blendMood && r.mood) blendMood.blendConfiguration(moodTimes, s, r.mood);
  return r;
}

class MoodBlendAnimation extends AnimationTracker {
  constructor(ctl, animName, moodTimes = [0.1, 0.2, 0.8, 0.9], neckTimes = [0.1, 0.2, 0.8, 1.0]) {
    super(ctl, animName);
    this.moodBlendEventTimes = moodTimes;
    this.neckBlendEventTimes = neckTimes;
    this.blendMoodInAndOut = new BlendInAndOutAnimation(ctl);
    this.blendNeckInAndOut = new BlendInAndOutAnimation(ctl);
    this.additive = false;
  }
  play(time = 0) {
    const c = this.ctl, s = this.animState = c.loadAnimationState(this.animName);
    if (!s) return;
    const L = s.length;
    playBlendInAndOutOfMood(c, this.blendMoodInAndOut, this.moodBlendEventTimes.map((x) => x * L),
      this.blendNeckInAndOut, this.neckBlendEventTimes.map((x) => x * L), s, this.additive);
    s.time = time;
    this.playSound(time);
    c.currentAnimation = this;
  }
}

// MoodBlendListenAnimation: escucha con la cara del humor todo el rato (tiempos 20 × largo)
class MoodBlendListenAnimation extends MoodBlendAnimation {
  isPlaying() { return !!(this.animState && this.animState.enabled); }
}

// AdditiveIdleAnimation: la pose del humor y encima, aditiva, la animación (respirar, parpadear…)
class AdditiveIdleAnimation extends AnimationTracker {
  constructor(ctl, animName) {
    super(ctl, animName);
    this.priority = PRIORITY_LOW;
    this.soundsH = this.soundsS = this.soundsD = null;
  }
  play(time = 0, baseAnim = this.ctl.moodAnimationName()) {
    const c = this.ctl, a = c.anim;
    a.stop();
    const base = c.loadAnimationState(baseAnim);
    const s = this.animState = c.loadAnimationState(this.animName);
    if (!base || !s) return;
    base.layer = 1; base.wrapMode = CLAMP; base.blendMode = BLEND;
    s.layer = 5; s.blendMode = ADDITIVE;
    a.stop();
    a.play(s.name, 0);
    a.play(base.name, 0);
    c.currentAnimation = this;
    const m = c.mood;
    const snd = m === HAPPY ? this.soundsH : m === SLEEPY ? this.soundsS : this.soundsD;
    if (snd) c.playSound(snd, 0, 0);
  }
}

// AdditiveAnimation: la pose feliz y encima, aditiva, la reacción (eructo, mmm…)
class AdditiveAnimation extends AnimationTracker {
  play(time = 0) {
    const c = this.ctl, s = this.animState = c.loadAnimationState(this.animName);
    const base = c.loadAnimationState('happy' + c.animPostfix);
    if (!s || !base) return;
    base.layer = 1; base.wrapMode = CLAMP;
    s.layer = 6; s.wrapMode = CLAMP; s.blendMode = ADDITIVE;
    c.anim.stop();
    c.anim.play(base.name, 0);
    c.anim.play(s.name);
    s.time = 0.06666667;
    c.currentAnimation = this;
    this.playSound(0);
  }
}

// TalkAnimation: la pose del humor y la boca aditiva; la boca la mueve el volumen (speed 0)
class TalkAnimation extends AnimationTracker {
  constructor(ctl, baseAnimationName, additiveAnimationName) {
    super(ctl, additiveAnimationName);
    this.baseAnimationName = baseAnimationName;
    this.additiveAnimationName = additiveAnimationName;
    this.isTalking = false;
    this._length = null;
    this.baseAnimationState = this.additiveAnimationState = null;
  }
  get length() {
    if (this._length === null) { const s = this.ctl.loadAnimationState(this.additiveAnimationName); this._length = s ? s.length : 0; }
    return this._length;
  }
  isPlaying() {
    const s = this.additiveAnimationState;
    return this.isTalking && !!s && s.enabled && s.time < s.length;
  }
  disableIsTalkingFlag() { this.isTalking = false; }
  get principal() { return this.additiveAnimationState; }
  play(time = 0, speed = 1) {
    const c = this.ctl;
    this.isTalking = true;
    const b = this.baseAnimationState = c.loadAnimationState(this.baseAnimationName);
    const s = this.additiveAnimationState = c.loadAnimationState(this.additiveAnimationName);
    if (!b || !s) return;
    b.layer = 1; b.wrapMode = CLAMP;
    s.layer = 6; s.wrapMode = CLAMP; s.blendMode = ADDITIVE;
    c.anim.stop();
    c.anim.play(b.name, 0);
    c.anim.play(s.name, 0);
    s.speed = speed;
    s.time = time;
    c.currentAnimation = this;
  }
}

// HeadPokeAnimation: además, la cabeza da un respingo hacia el lado tocado (en LateUpdate)
class HeadPokeAnimation extends MoodBlendAnimation {
  constructor(ctl, animName, moodTimes) {
    super(ctl, animName, moodTimes, [0.1, 0.2, 0.8, 1.0]);
    this.pokeHeadRotation = [0, 0, 0];
    this.pokeHeadTime = -1e9;
  }
  play(time = 0) {
    const c = this.ctl;
    let off = 0;
    const hit = c.lastHitPoint, col = c.headCollider;
    if (hit && col) {
      col.nodo.updateWorldMatrix(true, false);
      const x = col.nodo.matrixWorld.elements[12];
      off = -(hit.x - x) / col.radius;            // en Unity x va al revés
    }
    super.play(time);
    this.pokeHeadRotation = [off * 20, off * -20, off * 20];
    this.pokeHeadTime = c.tiempo;
  }
  onLateUpdate() {
    const c = this.ctl, s = this.animState;
    if (!s || !s.enabled || !c.headJoint) return;
    const dt = c.tiempo - this.pokeHeadTime;
    if (dt >= 0.15) return;                       // Vector3.zero: sin giro
    const u = dt / 0.15, k = Math.min(1, Math.max(0, u * u * (3 - 2 * u)));
    const [x, y, z] = this.pokeHeadRotation.map((v) => v + k * (0 - v));
    c.rotarLocal(c.headJoint, x, y, z);
  }
}

// PokeFallAnimation: se cae; tirado (LayDown 2 s, PlayDead 5 s) la animación y el sonido se frenan
class PokeFallAnimation extends MoodBlendAnimation {
  constructor(ctl, animName, crvFall, moodTimes = [0.1, 0.2, 0.8, 0.9], neckTimes = [0.1, 0.2, 0.8, 1.0]) {
    super(ctl, animName, moodTimes, neckTimes);
    this.crvFall = crvFall;
    this.playDeadAnimPosition = 0;
    this.playDead = false; this.layDown = false; this.playBellSound = false;
    this.playingDead = false; this.layingDown = false;
    this.playDeadStopTime = null;
    this.tomY = null;
    this.mustSinkTom = false;
  }
  position() { const s = this.animState; return s && s.length ? s.time / s.length : 0; }
  play(time = 0) {
    super.play(time);
    this.mustSinkTom = this.ctl.size3 === SMALL;
    this.playDead = this.layDown = this.playingDead = this.layingDown = false;
    this.playDeadStopTime = null;
  }
  onUpdate() {
    const c = this.ctl, s = this.animState;
    if (!s) return;
    if (this.playDeadStopTime === null) {
      this.playDeadStopTime = c.tiempo + (this.playDead ? 5 : 2) + this.playDeadAnimPosition * s.length;
    }
    if ((this.playDead && this.playingDead) || (this.layDown && this.layingDown)) {
      if (this.playDeadStopTime > c.tiempo) { c.onPauseSound(); s.speed = 0; }
      else { if (s.speed === 0) c.onResumeSound(); s.speed = 1; }
    } else {
      if (s.speed === 0) c.onResumeSound();
      s.speed = 1;
      if (this.playDead && !this.playingDead && this.position() > this.playDeadAnimPosition) this.playingDead = true;
      if (this.layDown && !this.layingDown && this.position() > this.playDeadAnimPosition) this.layingDown = true;
    }
    if (this.playBellSound && this.playDeadAnimPosition - 0.1 < s.time / s.length) {
      c.playSoundSuelto('BoxingBell');
      this.playBellSound = false;
    }
    // Tom bebé en la cocina (KitchenState: está en su sillita): baja lo que dice la curva
    if (this.mustSinkTom && this.crvFall && c.cuarto === 'kitchen') {
      const o = c.raiz;
      if (this.tomY === null) this.tomY = o.position.y;
      o.position.y = this.tomY + curva(this.crvFall, s.time);
    }
  }
}

// AnimationCurve con tangentes 0 (Keyframe(t, v)): entre claves, Hermite plano
function curva(claves, t) {
  if (t <= claves[0][0]) return claves[0][1];
  for (let i = 1; i < claves.length; i++) {
    const [t1, v1] = claves[i];
    if (t <= t1) {
      const [t0, v0] = claves[i - 1], u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return claves[claves.length - 1][1];
}

// SwipePursAnimation: las caricias. Intro, dos vueltas que se repiten mientras lo sigan acariciando
// y el final; el ronroneo en bucle hasta el final.
class SwipePursAnimation extends AnimationTracker {
  constructor(ctl, animName) {
    super(ctl, animName);
    this.blendMoodInAndOut = new BlendInAndOutAnimation(ctl);
    this.blendNeckInAndOut = new BlendInAndOutAnimation(ctl);
    this.loopSounds = null;
    this.loopTimes = null;
    this.loopIndex = 0;
    this.loopCount = 0;
    this.currentLoopCount = 0;
  }
  initLoopTimes() {
    const L = this.animState.length;
    this.loopTimes = this.ctl.size3 === SMALL
      ? [[0, 1.1666667], [1.1666667, 3.8000002], [3.8000002, 6.433334], [6.433334, L]]
      : [[0, 1.2333333], [1.2333333, 3.6666667], [3.6666667, 6.1000004], [6.1000004, L]];
  }
  doOneMoreLoop() {
    if (this.currentLoopCount !== this.loopCount) return;
    const [x, y] = this.loopTimes[this.loopIndex];
    if ((this.animState.time - x) / (y - x) > 0.8) this.loopCount++;
  }
  play(time = 0) {
    const c = this.ctl, s = this.animState = c.loadAnimationState(this.animName);
    if (!s) return;
    if (!this.loopTimes) this.initLoopTimes();
    this.currentLoopCount = 0;
    const L = s.length, y2 = this.loopTimes[2][1];
    playBlendInAndOutOfMood(c, this.blendMoodInAndOut, [0, 0.1, y2, L], this.blendNeckInAndOut, [0, 0.2, y2, L], s, true);
    this.loopIndex = 0;
    s.time = this.loopTimes[0][0];
    c.currentAnimation = this;
    this.loopCount = 0;
    this.animationFinishedAction = () => this.onFinished();
    if (this.loopSounds) {
      c.playSound(this.loopSounds[this.loopIndex], 0, 0);
      c.ponerBucle(true);
    }
  }
  randomLoopIndex() { return Math.floor(Math.random() * 5) === 0 ? 2 : 1; }
  playLoop(i) {
    const c = this.ctl, s = this.animState;
    c.anim.play(s.name, 0);
    s.time = this.loopTimes[i][0] + (s.time - this.loopTimes[this.loopIndex][1]);
    this.loopIndex = i;
    if (i >= 1 && i <= 2 && !c.isAudioPlaying()) {
      if (this.loopSounds) { c.playSound(this.loopSounds[i], 0, 0); c.ponerBucle(true); }
    }
  }
  onUpdate() {   // OnFixedUpdate en el juego
    const c = this.ctl, s = this.animState;
    if (!s) return;
    const t = s.time;
    if (!(this.loopTimes[this.loopIndex][1] < t)) return;
    if (this.loopIndex === 3) { s.enabled = false; return; }
    if (this.loopCount <= this.currentLoopCount) {
      c.anim.play(s.name, 0);
      s.time = this.loopTimes[3][0] + (t - this.loopTimes[this.loopIndex][1]);
      this.loopIndex = 3;
      if (c.isAudioPlaying()) c.ponerBucle(false);
      return;
    }
    this.playLoop(this.randomLoopIndex());
    this.currentLoopCount++;
  }
  onFinished() { }
}

// ShowFoodBannerAnimation: "tengo hambre" (el cartel con la comida que sigue a la muñeca, más adelante)
class ShowFoodBannerAnimation extends MoodBlendAnimation { }

// ------------------------------------------------------------------------------------------------
// TomsAnimationController

export class ControladorTom {
  // anim: AnimacionUnity; raiz: Tom (three.js); tam: 's' | 'm' | 'l'; sonido: Sonido;
  // necesidades: Necesidades; zonas: Zonas; escucha: Escucha (opcional)
  constructor({ anim, raiz, tam, sonido, necesidades, zonas, THREE, cuarto = 'living' }) {
    this.anim = anim;
    this.cuarto = cuarto;               // living | kitchen | bathroom | bedroom
    this.raiz = raiz;
    this.tam = tam;
    this.sonido = sonido;
    this.logica = necesidades;
    this.zonas = zonas;
    this.THREE = THREE;
    this.size3 = { s: SMALL, m: MEDIUM, l: LARGE }[tam];
    this.animPostfix = tam === 's' ? 'S' : 'L';      // AnimPostfix (el adolescente usa los del adulto)
    this.SIZE = this.animPostfix;                    // AnimationNames.SIZE
    this.cara = raiz.getObjectByName('c_faceHolder_00');
    this.headJoint = raiz.getObjectByName('c_head_00_skn');
    const zc = zonas && zonas.lista.find((z) => z.hueso === 'c_head_00_skn');
    this.headCollider = zc ? { nodo: zc.nodo, radius: zc.radius } : null;
    this.lastHitPoint = null;
    this.current = null;
    this.previousAnimation = null;
    this.previousAnimMood = null;
    this.blendAnimations = [];
    this.audio = null;                 // AudioEvent de la animación (lo que devuelve sonido.tocar)
    this.pendiente = null;             // PlaySoundScheduled
    this.tiempo = 0;
    this.proximoIdle = 0;              // Invoke("TriggerIdleAnim", 0.5)
    this.listeningEnabled = true;
    this.escucha = null;               // TalkBackHandler
    this.gamePaused = false;
    this.pokeFallAnimation = [1, 2, 3, 4];     // la lista de caídas, mezclada
    for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.pokeFallAnimation[i], this.pokeFallAnimation[j]] = [this.pokeFallAnimation[j], this.pokeFallAnimation[i]]; }
    this.currentPokeFallAnimationPointer = 0;
    this.pianoListo = false;           // el piano y sus teclas todavía no están exportados
    this.e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.q = new THREE.Quaternion();
    this.initAnimations();
    this.estadoCuarto = new LivingroomAnimationState(this);
    this.estadoCuarto.onEnter();
  }

  get mood() { return this.logica.mood; }
  isLargeOrMediumSize() { return this.size3 !== SMALL; }

  // ---- AnimationNames
  moodAnimationName(m = this.mood) { return ['happy', 'sleepy', 'disconnected'][m] + this.SIZE; }
  mixedMoodAnimationName(m = this.mood) { return 'mixed_' + ['happy', 'sleepy', 'disconnected'][m] + this.SIZE; }
  moodNeckAnimationName(m = this.mood) {
    return m === SLEEPY ? 'neckTransitionToSleepy' + this.SIZE : m === DISCONNECTED ? 'neckTransitionToDisconnected' + this.SIZE : null;
  }

  loadAnimationState(n) { return this.anim.estado(n); }
  loadAnimationStateAndAddMixingTransform(n) {
    const s = this.anim.estado(n);
    if (s && this.cara) s.addMixingTransform(this.cara);
    return s;
  }

  // ---- InitAnimations (las del living; ver $SP/c/initanim.c)
  initAnimations() {
    const P = this.animPostfix, LM = this.isLargeOrMediumSize(), M = this.size3 === MEDIUM;
    const mb = (n, mood, neck, snd) => { const a = new MoodBlendAnimation(this, n + P, mood, neck); a.sounds = snd; return a; };
    this.animShoulderShrug = mb('shoulderShrug', undefined, undefined, 'ShoulderShrug');
    this.animWaveDisconnected = new MoodBlendAnimation(this, 'hiAppStartD' + P, [0.1, 0.2, 0.71, 0.8]);
    this.animWaveDisconnected.priority = PRIORITY_LOW;
    this.animWaveHappy = new MoodBlendAnimation(this, 'hiAppStartH' + (M ? 'M' : P), [0.1, 0.2, 0.8, 0.9]);
    this.animWaveHappy.priority = PRIORITY_LOW;
    this.animSwipe = new SwipePursAnimation(this, 'swipePurrs' + P);
    this.animSwipe.loopSounds = ['SwipePurrsLoop', 'SwipePurrsLoop', 'SwipePurrsLoop'];
    this.animHeadPokeRecover = new HeadPokeAnimation(this, 'headPokeRecover' + P, [0.1, 0.2, 0.65, 0.75]);
    this.animHeadPokeRecover.sounds = 'PokeHeadRecover';
    this.animPokeTail = mb('tailPoke', [0.1, 0.2, 0.75, 0.9], undefined, LM ? 'PokeTailL' : 'PokeTailS');
    const F = PokeFallAnimation;
    this.animPokeFall = new F(this, 'headPokeFall' + P, CURVAS[0]); this.animPokeFall.sounds = 'PokeHeadFall';
    this.animPokeFall2 = new F(this, 'headPokeFall2' + P, CURVAS[1]); this.animPokeFall2.sounds = 'PokeHeadFall2';
    this.animPokeFall3 = new F(this, 'headPokeFall3' + P, CURVAS[2]); this.animPokeFall3.sounds = 'PokeHeadFall3';
    this.animPokeFall4 = new F(this, 'tom_headPokeFall4' + P, CURVAS[3], [0.1, 0.2, 1, 1], [0.1, 0.2, 1, 1]);
    this.animPokeFall4.sounds = LM ? 'PokeHeadFall4L' : 'PokeHeadFall4S';
    this.animPokeLeftLeg = mb('lfLegPoke', [0.1, 0.2, 0.7, 0.9], [0.1, 0.2, 0.7, 0.9], 'PokeLeg');
    this.animPokeRightLeg = mb('rtLegPoke', [0.1, 0.2, 0.7, 0.9], [0.1, 0.2, 0.7, 0.9], 'PokeLeg');
    const belly = this.size3 === MEDIUM ? [0.1, 0.2, 0.76, 1.0] : [0.1, 0.2, 0.8, 1.0];
    this.animPokeBelly = new MoodBlendAnimation(this, 'bellyPoke' + P, [0, 0.01, 0.63, 0.76], belly);
    this.animPokeBelly.sounds = 'PokeBelly';
    const def = (n) => { const a = new DefaultAnimation(this, n); a.canListenDuringAnimation = true; a.priority = PRIORITY_LOW; return a; };
    this.animMoodHappy = def('happy' + this.SIZE);
    this.animMoodDisconnected = def('disconnected' + this.SIZE);
    this.animMoodSleepy = def('sleepy' + this.SIZE);
    const idle = (n, s) => { const a = new AdditiveIdleAnimation(this, n); a.canListenDuringAnimation = true; if (s) Object.assign(a, s); return a; };
    this.animBlinkHappy = idle('blinkAH');
    this.animBlinkDisconnected = idle('blinkAD');
    this.animBlinkSleepy = idle(this.size3 === SMALL ? 'blinkSmallFixS' : 'blinkAS');
    this.animYawn = idle('yawnA', { soundsS: 'Yawn' });
    this.animYawn.canListenDuringAnimation = false;
    this.animBreathe = idle('breathing' + this.SIZE);
    // nodsA / shakesHeadA + H|S|D (TomsMoodToMoodPostfix, con el humor de cuando se arman)
    const mp = 'HSD'[this.mood];
    this.animNods = idle('nodsA' + mp, { soundsS: 'NodsS', soundsH: 'NodsH', soundsD: 'NodsD' });
    this.animShakes = idle('shakesHeadA' + mp, { soundsS: 'ShakesHeadS', soundsH: 'ShakesHeadH', soundsD: 'ShakesHeadD' });
    const listen = 'listen' + (M ? 'M' : this.SIZE);
    this.animListenMood = new MoodBlendListenAnimation(this, listen, [20, 20, 20, 20], [20, 20, 20, 20]);
    this.animListenMood.canListenDuringAnimation = true; this.animListenMood.priority = PRIORITY_LOW;
    this.animListen = new ListenAnimation(this, listen);
    this.animListen.canListenDuringAnimation = true; this.animListen.priority = PRIORITY_LOW;
    this.animTalkDisconnected = new TalkAnimation(this, 'disconnected' + this.SIZE, 'talkAD');
    this.animTalkHappy = new TalkAnimation(this, 'happy' + this.SIZE, 'talkAH');
    this.animTalkSleepy = new TalkAnimation(this, 'sleepy' + this.SIZE, 'talkAS');
    const hungry = 'hungry' + (M ? 'M' : this.SIZE), hungrySD = 'hungrySD' + (M ? 'M' : this.SIZE);
    const t = [0, 0.10465, 0.84302, 0.93];
    this.animShowHungry = new ShowFoodBannerAnimation(this, hungry, t, t); this.animShowHungry.sounds = 'ShowHungry';
    this.animShowHungrySD = new ShowFoodBannerAnimation(this, hungrySD, t, t); this.animShowHungrySD.sounds = 'ShowHungry';
    // holdsCrotchFidgets (FidgetLoopingAnimation, en bucle mientras tenga ganas de ir al baño)
    this.fidgetsAnimation = new MoodBlendAnimation(this, 'holdsCrotchFidgets' + this.SIZE);
    this.fidgetsAnimation.sounds = 'HoldsCrotchFidgets';
    this.moodChangeAnimation = new MoodChangeAnimation(this);
    const reaccion = (n, snd) => { const a = new AdditiveAnimation(this, n); a.sounds = snd; return a; };
    this.animReactionBurp = reaccion('reactionBurpA', 'ReactionBurp');
    this.animReactionMmmm = reaccion('reactionMmmmA', 'ReactionMmmm');
  }

  isTomKnockedDown() {
    const c = this.current;
    const caida = (a, desde) => c === a && a.isPlaying() && a.position() > desde && a.position() < 0.85;
    return caida(this.animPokeFall, 0.3) || caida(this.animPokeFall2, 0.3) || caida(this.animPokeFall3, 0.3) || caida(this.animPokeFall4, 0.2);
  }

  getPokeFallAnimation(includePianoAnimation) {
    if (this.pokeFallAnimation[this.currentPokeFallAnimationPointer] === 4 && !includePianoAnimation) this.nextPokeFallAnimation();
    return this.pokeFallAnimation[this.currentPokeFallAnimationPointer];
  }
  nextPokeFallAnimation() {
    this.currentPokeFallAnimationPointer = (this.currentPokeFallAnimationPointer + 1) % this.pokeFallAnimation.length;
  }

  // ---- AnimationController
  fireAction(accion, data = null) {
    if (this.estadoCuarto) this.estadoCuarto.playAnimation(accion, data);
  }

  // set_CurrentAnimation: la que estaba se interrumpe
  set currentAnimation(v) {
    const c = this.current;
    if (c) {
      c.stop(true);
      const f = c.animationInterruptedOrFinishedAction;
      if (f) { c.animationInterruptedOrFinishedAction = null; f(false); }
    }
    this.setCurrentAnimationInternal(v);
  }
  get currentAnimation() { return this.current; }

  setCurrentAnimationInternal(v) {
    this.cancelPendingSounds();
    const c = this.current;
    if (c) {
      this.previousAnimMood = this.mood;
      c.stop(false);
      const f = c.animationInterruptedOrFinishedAction;
      if (f) { c.animationInterruptedOrFinishedAction = null; f(true); }
      if (c === v && v instanceof TalkAnimation) { this.current = v; this.despuesDeCambiar(); return; }
    }
    this.current = v;
    this.currentAnimationStartTime = this.tiempo;
    this.despuesDeCambiar();
  }
  despuesDeCambiar() {
    if (!this.current) this.stopSound();
    if (!this.canListen()) this.stopListeningOrRepeating(true);
  }

  triggerIdleAnim() {
    this.proximoIdle = this.tiempo + 0.5;
    if (!this.current) this.fireAction(A.Idle);
  }

  // Update: antes de que avance la animación (como en Unity)
  update(dt) {
    this.tiempo += dt;
    if (this.pendiente && this.tiempo >= this.pendiente.cuando) { const p = this.pendiente; this.pendiente = null; p.ir(); }
    if (this.current) this.current.onUpdate();
    for (const b of [...this.blendAnimations]) b.blend();
    let c = this.current;
    if (c) {
      if (c.isPlaying()) { this.escuchar(); }
      else {
        this.previousAnimation = c;
        const guardado = this.previousAnimMood;
        this.setCurrentAnimationInternal(null);
        const f = c.animationFinishedAction;
        if (f) { c.animationFinishedAction = null; f(); }
        if (!this.current) {
          const m = this.mood;
          if (guardado === null || guardado === m) this.triggerIdleAnim();
          else { this.previousAnimMood = m; this.moodChangeAnimation.play(guardado, m); }
        }
        this.escuchar();
      }
    } else this.escuchar();
    if (this.tiempo >= this.proximoIdle) this.triggerIdleAnim();
    if (this.escucha) this.escucha.update(dt);
  }

  // LateUpdate: después de muestrear la animación
  lateUpdate() {
    if (this.current) this.current.onLateUpdate();
  }

  // localRotation = localRotation · Euler(x, y, z) de Unity (grados; z, x, y)
  rotarLocal(nodo, x, y, z) {
    const r = Math.PI / 180;
    this.e.set(x * r, -y * r, -z * r, 'YXZ');      // Unity → three: x espejado
    this.q.setFromEuler(this.e);
    nodo.quaternion.multiply(this.q);
  }

  // ---- sonido (AnimationController.PlaySound, CancelPendingSounds, StopSound…)
  playSound(campo, time = 0, demora = 0) {
    this.cancelPendingSounds();
    this.stopSound();
    const ir = () => { this.audio = this.sonido.tocar(this.sonido.deAnimacion(campo), { desde: time }); };
    if (demora > 0) this.pendiente = { cuando: this.tiempo + demora, ir };
    else ir();
  }
  playSoundSuelto(campo) { this.sonido.tocar(this.sonido.deAnimacion(campo)); }
  cancelPendingSounds() { this.pendiente = null; }
  stopSound() { if (this.audio) { this.audio.parar(); this.audio = null; } }
  onPauseSound() { if (this.audio) this.audio.pausar(); }
  onResumeSound() { if (this.audio) this.audio.reanudar(); }
  ponerBucle(si) { if (this.audio) this.audio.ponerBucle(si); }
  isAudioPlaying() { return !!(this.audio && this.audio.sonando()); }

  // ---- escuchar y repetir
  canListen() {
    if (this.estadoCuarto && !this.estadoCuarto.canListen()) return false;
    const c = this.current;
    if (c && !c.canListenDuringAnimation) return false;
    if (!this.listeningEnabled || !this.escucha || !this.escucha.disponible) return false;
    if (this.isAudioPlaying() || this.escucha.talking || this.sonido.algoSuena()) return false;
    return true;
  }
  escuchar() {
    if (!this.escucha) return;
    if (this.canListen()) { if (!this.gamePaused) { this.stopSound(); this.escucha.tryStartListening(); } }
    else this.escucha.stopListening();
  }
  stopListeningOrRepeating(interrupted) {
    const e = this.escucha;
    if (!e) return;
    e.stopListening();
    const c = this.current;
    if (c === this.animTalkDisconnected || c === this.animTalkSleepy || c === this.animTalkHappy) return;
    e.stopRepeating(interrupted);
  }
  conectarEscucha(e) {
    this.escucha = e;
    e.callbackRecordingStarted = () => this.estadoCuarto.listenEvent();
    e.callbackRecordingStopped = (largo) => this.estadoCuarto.listenStopEvent(largo);
    e.callbackTalk = (f) => this.estadoCuarto.talkEvent(f);
    e.callbackTalkingStopped = (interrumpido) => this.estadoCuarto.doneTalkingEvent(interrumpido);
  }
}

// las curvas de hundimiento del bebé al caerse (tomPokeFall1..4)
const CURVAS = [
  [[0, 0], [0.98, 0], [1.6, -17.9], [3.65, -18], [3.88, 0], [5, 0]],
  [[0, 0], [1.22, 0], [1.52, -17.9], [3.65, -18], [3.89, 0], [5, 0]],
  [[1.23, 0], [1.55, -17.3], [3.65, -17.3], [3.92, 0], [5, 0]],
  [[0, 0], [0.98, 0], [1.6, -17.9], [3.65, -18], [3.88, 0]],
];

// MoodChangeAnimation: respira mientras la cara y el cuello pasan de un humor al otro
class MoodChangeAnimation extends AnimationTracker {
  constructor(ctl) {
    super(ctl, null);
    this.blendMoodIn = new BlendInOutAnimation(ctl, true);
    this.blendNeckIn = new BlendInOutAnimation(ctl, true);
    this.blendMoodOut = new BlendInOutAnimation(ctl, false);
    this.blendNeckOut = new BlendInOutAnimation(ctl, false);
  }
  play(fromMood, toMood) {
    const c = this.ctl;
    c.currentAnimation = this;
    const s = this.animState = c.loadAnimationState('breathing' + c.SIZE);
    if (!s) return;
    const L = s.length, x = (L / 201) * 121, y = x + (L - x) * 0.5;
    s.layer = 0; s.wrapMode = CLAMP; s.blendMode = BLEND;
    const de = c.loadAnimationStateAndAddMixingTransform(c.mixedMoodAnimationName(fromMood));
    const a = c.loadAnimationStateAndAddMixingTransform(c.mixedMoodAnimationName(toMood));
    if (de) { de.layer = 1; de.blendMode = BLEND; de.wrapMode = CLAMP; }
    if (a) { a.layer = 2; a.blendMode = BLEND; a.wrapMode = CLAMP; }
    const nDe = c.moodNeckAnimationName(fromMood), nA = c.moodNeckAnimationName(toMood);
    let cDe = null, cA = null;
    if (nDe) { cDe = c.loadAnimationState(nDe); if (cDe) { cDe.layer = 3; cDe.wrapMode = CLAMP; cDe.blendMode = ADDITIVE; } }
    if (nA) { cA = c.loadAnimationState(nA); if (cA) { cA.layer = nDe ? 4 : 3; cA.wrapMode = CLAMP; cA.blendMode = ADDITIVE; } }
    c.anim.stop();
    c.anim.play(s.name, 0);
    if (de) c.anim.play(de.name, 0);
    if (a) c.anim.play(a.name, 0);
    if (cDe) { c.anim.play(cDe.name, 0); this.blendNeckOut.blendConfiguration([y, L], s, cDe); }
    if (cA) { c.anim.play(cA.name, 0); this.blendNeckIn.blendConfiguration([x, y], s, cA); }
    if (a) this.blendMoodIn.blendConfiguration([x, y], s, a);
    if (de) this.blendMoodOut.blendConfiguration([y, L], s, de);
  }
}

// ------------------------------------------------------------------------------------------------
// CommonAnimationState + LivingroomAnimationState

class CommonAnimationState {
  constructor(ctl) {
    this.ctl = ctl;
    this.pokeFallProbability = 0;
    this.currentTalkFrame = -1;
    this.nextTalkFrame = 0;
    this.pokeAnimDuration = 0;
    this.pokeTimeStart = 0;
    this.petting100PCountBurp = 0;
    this.pokeFallCountPlayDead = 0;
    this.minFallAnimPosition = 0.5;
  }
  onEnter() {
    this.pokeFallProbability = 0;
    this.ctl.anim.stop();
  }
  canListen() { return true; }

  playMoodAnimation() {
    const c = this.ctl, m = c.mood;
    (m === HAPPY ? c.animMoodHappy : m === SLEEPY ? c.animMoodSleepy : c.animMoodDisconnected).play(0);
  }
  blink() {
    const c = this.ctl, m = c.mood;
    (m === HAPPY ? c.animBlinkHappy : m === SLEEPY ? c.animBlinkSleepy : c.animBlinkDisconnected).play(0);
  }
  playYawn() {
    const c = this.ctl;
    if (c.animYawn.isPlaying()) return false;
    c.animYawn.play(0);
    return true;
  }
  playShowHungry() {
    const c = this.ctl;
    if (c.animShowHungry.isPlaying() || c.animShowHungrySD.isPlaying()) return;
    (c.mood === HAPPY ? c.animShowHungry : c.animShowHungrySD).play(0);
  }
  playFidgetsAnimation() {
    const c = this.ctl;
    if (!c.fidgetsAnimation.isPlaying()) c.fidgetsAnimation.play(0);
  }
  playListenAnimation() {
    const c = this.ctl;
    if (c.mood === HAPPY) c.animListen.play(0); else c.animListenMood.play(0);
  }
  playTalkAnimation() {
    const c = this.ctl;
    if (c.sonido.mudo) return;
    this.currentTalkFrame = this.nextTalkFrame;
    const m = c.mood, t = m === HAPPY ? c.animTalkHappy : m === SLEEPY ? c.animTalkSleepy : c.animTalkDisconnected;
    t.play(t.length * this.nextTalkFrame, 0);
  }

  triggerSoundOnPoke(byTouch) { this.ctl.playSoundSuelto('Poke'); }

  resetPlayDead() {
    const cur = this.ctl.current;
    if (cur instanceof PokeFallAnimation && cur.playDead) cur.playDead = false;
  }

  headPokeRecover() { this.ctl.animHeadPokeRecover.play(0); }

  pokeHead(byTouch) {
    const c = this.ctl;
    this.resetPlayDead();
    if (c.isTomKnockedDown()) {
      if (!byTouch) this.triggerSoundOnPoke(false);
      return;
    }
    this.pokeFallProbability += 0.34;
    if (this.pokeFallProbability <= 1) this.headPokeRecover();
    else {
      const n = c.getPokeFallAnimation(c.pianoListo && byTouch);
      const anim = [null, c.animPokeFall, c.animPokeFall2, c.animPokeFall3, c.animPokeFall4][n];
      anim.playDeadAnimPosition = [0, 0.44, 0.43, 0.46, 0.46][n];
      anim.playBellSound = n === 1;
      const cur = c.current;
      let antesMuerto = false;
      if (cur instanceof PokeFallAnimation) antesMuerto = cur.playDead;
      else this.pokeFallCountPlayDead++;
      anim.play(0);
      anim.animationInterruptedOrFinishedAction = (bien) => this.tomFallPositionReset(bien);
      anim.animationFinishedAction = () => { };
      this.pokeTimeStart = c.tiempo;
      this.pokeAnimDuration = anim.animState ? anim.animState.length : 1;
      if (n !== 4) {
        if (antesMuerto || this.pokeFallCountPlayDead > 3) { this.pokeFallCountPlayDead = 0; anim.playDead = true; }
        else anim.layDown = true;
      }
    }
    this.triggerSoundOnPoke(byTouch);
  }

  tomFallPositionReset(bien) {
    const c = this.ctl;
    for (const a of [c.animPokeFall, c.animPokeFall2, c.animPokeFall3, c.animPokeFall4]) a.animationInterruptedOrFinishedAction = null;
    if ((c.tiempo - this.pokeTimeStart) / this.pokeAnimDuration > this.minFallAnimPosition) c.nextPokeFallAnimation();
    if (c.size3 === SMALL && c.cuarto === 'kitchen') {
      for (const a of [c.animPokeFall, c.animPokeFall2, c.animPokeFall3, c.animPokeFall4]) {
        if (a.tomY !== null) { c.raiz.position.y = a.tomY; break; }
      }
    }
  }

  playSwipeAnimation() {
    const c = this.ctl, s = c.animSwipe;
    if (!s.isPlaying()) {
      s.play(0);
      s.animationFinishedAction = () => this.swipeFinished();
      s.animationInterruptedOrFinishedAction = (bien) => this.swipeFinishedOrInterrupted(bien);
      if (c.logica.onPettingStart) c.logica.onPettingStart();
    } else s.doOneMoreLoop();
  }
  // con la diversión llena, a la tercera caricia eructa
  swipeFinished() {
    const c = this.ctl;
    if (c.logica.funMeter > 99 && ++this.petting100PCountBurp > 2) {
      c.animReactionBurp.play(0);
      c.animReactionBurp.animationFinishedAction = () => { this.petting100PCountBurp = 0; };
    }
  }
  swipeFinishedOrInterrupted(bien) { if (this.ctl.logica.onPettingEnd) this.ctl.logica.onPettingEnd(); }

  swipeBody() {
    const c = this.ctl, l = c.logica;
    if (c.isTomKnockedDown()) return;
    if (l.mustGoToToilet) {
      if (!c.current) c.anim.stop();
      this.playFidgetsAnimation();
      return;
    }
    if (l.mustEat) { this.playShowHungry(); return; }
    if (l.mustSleep) { if (!c.animYawn.isPlaying()) c.animYawn.play(0); return; }
    this.playSwipeAnimation();
  }

  pokeBelly(byTouch) {
    const c = this.ctl;
    this.triggerSoundOnPoke(byTouch);
    if (c.isTomKnockedDown()) return;
    this.resetPlayDead();
    c.animPokeBelly.play(c.animPokeBelly.isPlaying() && c.size3 !== SMALL ? 0.132 : 0);
  }
  pokeTail(byTouch) {
    const c = this.ctl;
    this.triggerSoundOnPoke(byTouch);
    if (c.isTomKnockedDown()) return;
    c.animPokeTail.play(c.animPokeTail.isPlaying() ? 0.2 : 0);
  }
  pokeLeftLeg(byTouch) {
    const c = this.ctl;
    this.triggerSoundOnPoke(byTouch);
    if (c.isTomKnockedDown()) return;
    c.animPokeLeftLeg.play(0);
  }
  pokeRightLeg(byTouch) {
    const c = this.ctl;
    this.triggerSoundOnPoke(byTouch);
    if (c.isTomKnockedDown()) return;
    c.animPokeRightLeg.play(0);
  }

  // ---- escuchar y repetir (CallbackRecordingStarted, CallbackTalk…)
  listenEvent() { this.currentTalkFrame = -1; this.playAnimation(A.Listen); }
  talkEvent(f) {
    this.nextTalkFrame = f;
    if (this.currentTalkFrame === f) return;
    this.playAnimation(A.Talk);
  }
  doneTalkingEvent(interrupted) {
    const c = this.ctl, cur = c.current;
    if (cur instanceof TalkAnimation) cur.disableIsTalkingFlag();
    this.currentTalkFrame = -1;
    if (!interrupted) c.fireAction(A.Idle);
  }
  listenStopEvent(largo) {
    const c = this.ctl;
    c.fireAction(A.ListenStop);
    if (c.escucha) c.escucha.startTalking();
  }
}

class LivingroomAnimationState extends CommonAnimationState {
  playAnimation(a, data) {
    const c = this.ctl, l = c.logica;
    const byTouch = data && data.byTouch !== undefined ? data.byTouch : true;
    switch (a) {
      case A.Idle: {
        if (c.animWaveHappy.isPlaying() || c.animWaveDisconnected.isPlaying()) return;
        if (l.mustGoToToilet) {
          if (!c.fidgetsAnimation.isPlaying()) this.playFidgetsAnimation();
          return;
        }
        const prev = c.previousAnimation;
        if (Math.random() < l.mustEatAnimationProbability && prev !== c.animShowHungry && prev !== c.animShowHungrySD) {
          this.playShowHungry();
          return;
        }
        if (Math.random() < l.mustSleepAnimationProbability && c.mood === SLEEPY && prev !== c.animYawn) {
          if (this.playYawn()) return;
        }
        if (c.current && c.current.isPlaying()) return;
        const fuePestaneo = prev === c.animBlinkHappy || prev === c.animBlinkSleepy || prev === c.animBlinkDisconnected;
        if (!fuePestaneo && Math.random() > 0.5) this.blink();
        else c.animBreathe.play(0);
        return;
      }
      case A.Mood: this.playMoodAnimation(); return;
      case A.Listen: this.playListenAnimation(); return;
      case A.Talk:
        if (!c.sonido.mudo && c.sonido.volumen > 0.001) this.playTalkAnimation();
        return;
      case A.PokeHead: this.pokeHead(byTouch); return;
      case A.PokeBody: this.pokeBelly(byTouch); return;
      case A.PokeTail: this.pokeTail(byTouch); return;
      case A.SwipeBody: this.swipeBody(); return;
      case A.PokeLeftFoot: this.pokeLeftLeg(byTouch); return;
      case A.PokeRightFoot: this.pokeRightLeg(byTouch); return;
      case A.Wave: (c.mood === HAPPY ? c.animWaveHappy : c.animWaveDisconnected).play(0); return;
      default:
    }
  }
}

// ------------------------------------------------------------------------------------------------
// TomsTouchController: qué colisionador tocó el dedo al bajar, y al soltar o al moverse si fue un
// toque (menos de 0,5 s sin moverse) o una caricia (entre 0,1 y 2 s, más de 2 % del ancho).

const TOQUES = {
  c_head_00_skn: A.PokeHead, c_root_01_skn: A.PokeBody, c_tail_05_skn: A.PokeTail,
  l_foot_00_skn: A.PokeLeftFoot, r_foot_00_skn: A.PokeRightFoot, l_lowLeg_00_skn: A.PokeLeftFoot, r_lowLeg_00_skn: A.PokeRightFoot,
};
const CARICIAS = new Set(['c_head_00_skn', 'c_root_01_skn', 'l_foot_00_skn', 'r_foot_00_skn', 'l_lowLeg_00_skn', 'r_lowLeg_00_skn']);
const MAX_POKE_TIME = 0.5, MIN_SWIPE_TIME = 0.1, MAX_SWIPE_TIME = 2.0, RESET_TRACKING_TIME = 0.05;

export class ToquesTom {
  // rayo(x, y) → THREE.Ray del punto de la pantalla; ancho()/alto(): tamaño de la pantalla en px
  constructor(ctl, zonas, rayo, ancho, alto) {
    this.ctl = ctl; this.zonas = zonas; this.rayo = rayo; this.ancho = ancho; this.alto = alto;
    this.dedos = new Map();
  }
  colisionador(x, y) {
    const t = this.zonas.tocar(this.rayo(x, y), true);
    if (t) this.ctl.lastHitPoint = t.punto.clone();
    return t ? t.zona : null;
  }
  bajar(id, x, y) {
    const t = this.ctl.tiempo;
    this.dedos.set(id, { inicio: t, x0: x, y0: y, nombre: this.colisionador(x, y), evento: false, multi: false,
      tEvento: Infinity, vertical: true, horizontal: true });
  }
  mover(id, x, y) {
    const d = this.dedos.get(id);
    if (!d) return;
    const t = this.ctl.tiempo;
    if (d.evento && d.multi && t - d.tEvento > RESET_TRACKING_TIME) {
      // resetFingerTrackingForMultipleEvents: otra caricia desde acá
      Object.assign(d, { inicio: t, x0: x, y0: y, nombre: this.colisionador(x, y), tEvento: Infinity, vertical: true, horizontal: true, evento: true });
    }
    if (!d.evento || d.multi) this.probarCaricia(d, x, y);
  }
  probarCaricia(d, x, y) {
    if (!d.nombre) d.nombre = this.colisionador(x, y);
    if (Math.abs(y - d.y0) <= this.alto() / 10) { if (this.ancho() / 10 < Math.abs(x - d.x0)) d.vertical = false; }
    else d.horizontal = false;
    const t = this.ctl.tiempo, dt = t - d.inicio;
    if (dt < MIN_SWIPE_TIME || dt > MAX_SWIPE_TIME) return false;
    const dist = Math.hypot(d.x0 - x, d.y0 - y);
    if (dist < this.ancho() * 0.02) return false;
    if (d.nombre && CARICIAS.has(d.nombre)) this.ctl.estadoCuarto.playAnimation(A.SwipeBody, null);
    d.tEvento = t; d.evento = true; d.multi = true;
    return true;
  }
  soltar(id) {
    const d = this.dedos.get(id);
    this.dedos.delete(id);
    if (!d || d.evento) return;
    if (this.ctl.tiempo - d.inicio >= MAX_POKE_TIME && d.nombre !== 'catbox') return;
    d.evento = true;
    const a = d.nombre && TOQUES[d.nombre];
    if (a !== undefined && a !== null) this.ctl.fireAction(a, { byTouch: true });
  }
}
