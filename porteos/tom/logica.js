// La lógica del juego: MainGameLogic de My Talking Tom (Outfit7.MyTalkingTom.GameLogic) portada con
// sus mismos números. Cuatro medidores de 0 a 100 (diversión y comida llegan a 200):
//   diversión −1 cada 400 s; acariciándolo +3,33 por segundo (lo que pasa de 100 da XP decreciente)
//   comida −1 cada 257 s; inodoro −1 cada 180 s (pis) o 360 s (caca)
//   sueño −1 cada 24 s despierto (18 en minijuegos, 300 con la app cerrada), +1 cada 54 s dormido
// La XP sale de lo que suben los medidores; el nivel, de la tabla XpAtLevel (después 30 500 por nivel).
// Se guarda como UserPrefs (localStorage, "tom.GameState.*").

const XP_AT_LEVEL = [0, 50, 150, 300, 500, 700, 1000, 1400, 1900, 2500, 3000, 3700, 4400, 5200, 6200, 7300, 8500,
  9800, 11100, 12500, 14000, 15600, 17200, 18900, 20700, 22600, 24500, 26500, 28600, 31000, 33000, 35500, 37500, 40000,
  43000, 46500, 50000, 53500, 57000, 61000, 65000, 69500, 74000, 79000, 84000, 89000, 94000, 99000, 104000, 110000,
  118000, 127000, 137000, 148000, 159500, 170000, 181000, 192500, 203500, 215000, 227000, 239500, 252500, 266500,
  281000, 296000, 311500, 327500, 344000, 361000, 379000, 397500, 416000, 435000, 454000, 473000, 493000, 512500,
  533000, 553000, 573600, 594500, 615600, 637000, 658600, 680500, 702600, 725000, 747600, 770500, 793600, 817000,
  840600, 864500, 888600, 913000, 937600, 962500, 987700, 1013100, 1038800, 1064700, 1090900, 1117300, 1144000,
  1170900, 1198100, 1225500, 1253200, 1281100, 1309300, 1337700, 1366400, 1395300, 1424500, 1453900, 1483600,
  1513600, 1543800, 1574300];
const XP_PER_LEVEL = 30500, MAX_LEVEL = 999;
export const HAPPY = 0, SLEEPY = 1, DISCONNECTED = 2;
export const NADA = 0, CARICIAS = 1, MINIJUEGO = 2;          // MakingFunStateEnum

// UserPrefs sobre localStorage (si no hay, en memoria)
export class Prefs {
  constructor(prefijo = 'tom.') {
    this.p = prefijo;
    this.mem = new Map();
    try { this.ls = window.localStorage; this.ls.getItem('x'); } catch (e) { this.ls = null; }
  }
  leer(k) {
    if (this.ls) { try { return this.ls.getItem(this.p + k); } catch (e) { /* lleno o bloqueado */ } }
    return this.mem.has(k) ? this.mem.get(k) : null;
  }
  escribir(k, v) {
    this.mem.set(k, String(v));
    if (this.ls) { try { this.ls.setItem(this.p + k, String(v)); } catch (e) { /* lleno o bloqueado */ } }
  }
  int(k, def) { const v = this.leer(k); return v === null ? def : parseInt(v, 10); }
  num(k, def) { const v = this.leer(k); return v === null ? def : parseFloat(v); }
  bool(k, def) { const v = this.leer(k); return v === null ? def : v === 'true'; }
}

export function levelForXp(xp) {
  const n = XP_AT_LEVEL.length;
  if (xp <= XP_AT_LEVEL[n - 1]) {
    for (let i = 1; i < n; i++) if (xp < XP_AT_LEVEL[i]) return i;
    return n;
  }
  return Math.trunc((xp - XP_AT_LEVEL[n - 1]) / XP_PER_LEVEL) + n;
}
export function startXpForLevel(level) {
  const n = XP_AT_LEVEL.length;
  return level > n ? XP_AT_LEVEL[n - 1] + (level - n) * XP_PER_LEVEL : XP_AT_LEVEL[level - 1];
}

export class LogicaJuego {
  // ahora(): milisegundos (Date.now); iniciales: medidores para una partida nueva (si no, 30 como el juego)
  constructor({ prefs = new Prefs(), ahora = () => Date.now(), iniciales = null } = {}) {
    this.prefs = prefs;
    this.ahora = ahora;
    this.alCambiar = [];              // (medidor, valor) => …  (OnFunMeterChange…)
    this.alCambiarXp = [];            // (xp, nivel, porcentaje) => …
    this.makingFunState = NADA;
    this.isToileting = false;
    this.toiletingGainFactor = 0;
    this.makingFunXpLeftOver = 0;
    this.sleepyMeterMiniGameDropSecs = 18;
    this.wasPaused = true;
    this.ultimoCalculoUpdate = 0;
    this.init(iniciales);
  }

  // MainGameLogic.Init
  init(iniciales) {
    const p = this.prefs, ini = iniciales || {};
    this.timeBoost = p.int('GameState.TimeBoost', 1);
    this.lastTimeCalculation = p.num('GameState.PreviousCalculationDateTime', this.ahora());
    this.foodMeter = p.int('GameState.FoodMeter', ini.food ?? 30);
    this.toiletMeter = p.int('GameState.ToiletMeter', ini.toilet ?? 30);
    this.sleepyMeter = p.int('GameState.SleepyMeter', ini.sleepy ?? 30);
    this.funMeter = p.int('GameState.FunMeter', ini.fun ?? 30);
    this.funMeterDelta = p.num('GameState.FunDelta', 0);
    this.foodMeterDelta = p.num('GameState.FoodDelta', 0);
    this.toiletMeterDelta = p.num('GameState.ToiletDelta', 0);
    this.sleepyMeterDelta = p.num('GameState.SleepyDelta', 0);
    this.isSleeping = p.bool('GameState.Sleeping', false);
    this.isDay = p.bool('GameState.BedroomLightOn', true);
    this.toiletType = p.int('GameState.ToiletType', 0);
    this.xp = p.int('GameState.Xp', 0);
    this.recalculateMeters(true);
  }

  // ---- lo que se deduce de los medidores
  get mustEat() { return this.foodMeter < 31; }
  get shouldEat() { return this.foodMeter < 61; }
  get mustGoToToilet() { return this.toiletMeter < 31; }
  get shouldGoToToilet() { return this.toiletMeter < 61; }
  get canGoToToilet() { return this.toiletMeter < 61; }
  get mustSleep() { return this.toiletMeter >= 31 && this.sleepyMeter < 31; }
  get shouldSleep() { return this.toiletMeter >= 31 && this.sleepyMeter < 61; }
  get canSleep() { return this.toiletMeter >= 31 && this.sleepyMeter < 91; }
  get isSleepy() { return this.sleepyMeter < 31; }
  get mustWakeUp() { return this.sleepyMeter === 100 || this.toiletMeter < 31; }
  get canMakeFun() { return this.funMeter < 100; }
  get shouldMakeFun() { return this.funMeter < 61; }
  get mustMakeFun() { return this.funMeter < 31; }
  get isMakingFun() { return this.makingFunState !== NADA; }
  get mustEatAnimationProbability() { return this.foodMeter < 31 ? ((30 - this.foodMeter) / 30) * 0.45 + 0.3 : 0; }
  get mustSleepAnimationProbability() {
    return this.toiletMeter > 30 && this.sleepyMeter < 31 ? ((30 - this.sleepyMeter) / 30) * 0.35 + 0.1 : 0;
  }
  // TomState.Mood (DISCONNECTED_LIMIT = 60)
  get mood() {
    let r = DISCONNECTED;
    if (this.toiletMeter > 30) {
      if (this.sleepyMeter < 31) return SLEEPY;
      r = HAPPY;
    }
    return this.funMeter > 59 ? r : DISCONNECTED;
  }
  get level() { return levelForXp(this.xp); }
  get levelPercentage() {
    const l = this.level, a = startXpForLevel(l), b = l === MAX_LEVEL ? 0x7fffffff : startXpForLevel(l + 1);
    return b - a ? Math.trunc(((this.xp - a) * 100) / (b - a)) : 0;
  }

  // ---- Update: cada 1 s acariciando o en el baño, cada 3 s si no
  update() {
    const t = this.ahora();
    const cada = this.makingFunState === CARICIAS || this.isToileting ? 1 : 3;
    if (t - this.lastTimeCalculation >= cada * 1000) this.recalculateMeters(false);
  }

  // RecalculateMeters (+ CalculateDeltaTime: lo que pasó de la medianoche con la app cerrada cuenta un tercio)
  recalculateMeters(afterPause = false) {
    const t = this.ahora();
    let dt = (t - this.lastTimeCalculation) / 1000;
    const a = new Date(this.lastTimeCalculation), b = new Date(t);
    if (this.wasPaused && a.toDateString() !== b.toDateString()) {
      const medianoche = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1).getTime();
      const hasta = (medianoche - this.lastTimeCalculation) / 1000;
      dt = hasta + (dt - hasta) / 3;
    }
    this.wasPaused = false;
    if (Math.abs(dt) < 0.1) return false;
    this.lastTimeCalculation = t;
    this.prefs.escribir('GameState.PreviousCalculationDateTime', t);
    if (dt < 0) return false;
    this.recalculateFunMeter(dt);
    this.recalculateFoodMeter(dt);
    this.recalculateToiletMeter(dt);
    this.recalculateSleepyMeter(dt, afterPause);
    return true;
  }

  recalculateFunMeter(dt) {
    const d = this.funMeterDelta + this.timeBoost * dt;
    if (this.makingFunState === NADA) {
      const n = Math.trunc(d / 400);
      this.setDelta('funMeterDelta', 'FunDelta', d - n * 400);
      if (n > 0) {
        if (this.funMeter > 100) this.funMeter = 100;
        this.setMeter('funMeter', 'FunMeter', this.funMeter - Math.min(n, 100));
      }
      return;
    }
    const f = 3.33;                                     // FunMeterNormalGainFactor
    let n = Math.trunc(d * f);
    this.setDelta('funMeterDelta', 'FunDelta', d - n / f);
    if (n <= 0 || this.funMeter === 200) return;
    n = Math.min(n, 200);
    let antes = this.funMeter, nuevo = Math.min(antes + n, 200), xp = n;
    if (antes + n > 100) {
      // lo que pasa de 100 da cada vez menos XP
      let sobra = this.makingFunXpLeftOver;
      xp = antes > 99 ? 0 : 100 - antes;
      for (let i = antes + xp + 1; i <= nuevo; i++) sobra += Math.pow((i - 1 - 99) / 100 + 1, -4);
      const entero = Math.trunc(sobra);
      xp += entero;
      this.makingFunXpLeftOver = sobra - entero;
    }
    this.setMeter('funMeter', 'FunMeter', nuevo);
    this.applyXpChange(xp);
  }

  recalculateFoodMeter(dt) {
    const d = this.foodMeterDelta + this.timeBoost * dt, n = Math.trunc(d / 257);
    this.setDelta('foodMeterDelta', 'FoodDelta', d - n * 257);
    if (n > 0) {
      if (this.foodMeter > 100) this.foodMeter = 100;
      this.setMeter('foodMeter', 'FoodMeter', this.foodMeter - Math.min(n, 100));
    }
  }

  recalculateToiletMeter(dt) {
    if (!this.isToileting) {
      const cada = this.toiletType ? 360 : 180;
      const d = this.toiletMeterDelta + this.timeBoost * dt, n = Math.trunc(d / cada);
      this.setDelta('toiletMeterDelta', 'ToiletDelta', d - n * cada);
      if (n > 0) this.setMeter('toiletMeter', 'ToiletMeter', this.toiletMeter - Math.min(n, 100));
      return;
    }
    const f = this.toiletingGainFactor, d = this.toiletMeterDelta + dt;
    let n = Math.trunc(d * f);
    this.setDelta('toiletMeterDelta', 'ToiletDelta', d - n / f);
    if (n <= 0 || this.toiletMeter === 100) return;
    n = Math.min(n, 100);
    const total = this.toiletMeter + n, sobra = total > 100 ? total - 100 : 0;
    this.setMeter('toiletMeter', 'ToiletMeter', Math.min(total, 100));
    this.applyXpChange(n - sobra);
  }

  recalculateSleepyMeter(dt, afterPause) {
    const d = this.sleepyMeterDelta + this.timeBoost * dt;
    const cada = this.isSleeping ? 54 : afterPause ? 300 : this.makingFunState === MINIJUEGO ? this.sleepyMeterMiniGameDropSecs : 24;
    let n = Math.trunc(d / cada);
    this.setDelta('sleepyMeterDelta', 'SleepyDelta', d - n * cada);
    if (n > 0) {
      n = Math.min(n, 100);
      if (!this.isSleeping) this.setMeter('sleepyMeter', 'SleepyMeter', this.sleepyMeter - n);
      else if (this.sleepyMeter !== 100) {
        const total = this.sleepyMeter + n;
        this.setMeter('sleepyMeter', 'SleepyMeter', Math.min(total, 100));
        this.applyXpChange(n - (total > 100 ? total - 100 : 0));
      }
    }
    if (this.sleepyMeter === 100 || this.toiletMeter < 31) this.setSleeping(false);
  }

  // ---- XP (ChargeXpBoost: sin agregados comprados, 1)
  applyXpChange(cambio) {
    const dx = Math.round(cambio);
    if (dx <= 0) return false;
    const tope = startXpForLevel(MAX_LEVEL);
    if (this.xp >= tope) return false;
    const nuevo = Math.min(this.xp + dx, tope);
    if (nuevo === this.xp) return false;
    this.xp = nuevo;
    this.prefs.escribir('GameState.Xp', nuevo);
    for (const f of this.alCambiarXp) f(this.xp, this.level, this.levelPercentage);
    return true;
  }

  setMeter(campo, clave, v) {
    v = Math.max(0, v | 0);
    if (v === this[campo]) return false;
    this[campo] = v;
    this.prefs.escribir('GameState.' + clave, v);
    for (const f of this.alCambiar) f(campo, v);
    return true;
  }
  setDelta(campo, clave, v) {
    if (this[campo] === v) return;
    this[campo] = v;
    this.prefs.escribir('GameState.' + clave, v);
  }

  // ---- lo que hace Tom
  onPettingStart() {
    if (this.makingFunState !== CARICIAS) {
      this.recalculateMeters(false);
      this.makingFunState = CARICIAS;
      this.setDelta('funMeterDelta', 'FunDelta', 0);
    }
  }
  onPettingEnd() {
    if (this.makingFunState !== NADA) {
      this.recalculateMeters(false);
      this.makingFunState = NADA;
      this.setDelta('funMeterDelta', 'FunDelta', 0);
    }
  }
  onMiniGameStart() {
    if (this.makingFunState !== MINIJUEGO) {
      this.recalculateMeters(false);
      this.makingFunState = MINIJUEGO;
      this.setDelta('funMeterDelta', 'FunDelta', 0);
    }
  }
  onMiniGameStop() { this.onPettingEnd(); }

  // OnNormalFoodEat: la comida suma su MeterGain (hasta 200; lo que pasa de 100 no da XP)
  onNormalFoodEat(meterGain) {
    if (meterGain < 0) return;
    const antes = this.foodMeter, total = antes + meterGain;
    let xp = total > 100 ? 100 - antes : meterGain;
    if (antes > 99) xp = 0;
    this.applyXpChange(xp);
    this.setMeter('foodMeter', 'FoodMeter', Math.min(total, 200));
    this.setDelta('foodMeterDelta', 'FoodDelta', 0);
  }

  startToileting(accomplishTime) {
    this.toiletingGainFactor = (100 - this.toiletMeter) / accomplishTime;
    if (!this.isToileting && this.toiletMeter !== 100) {
      this.isToileting = true;
      this.setDelta('toiletMeterDelta', 'ToiletDelta', 0);
    }
  }
  interruptToileting() { this.isToileting = false; }
  onToiletingAccomplish() {
    if (this.toiletMeter < 100) { this.applyXpChange(100 - this.toiletMeter); this.setMeter('toiletMeter', 'ToiletMeter', 100); }
    this.isToileting = false;
  }

  setSleeping(si) {
    if (this.isSleeping === si || (si && this.sleepyMeter === 100)) return false;
    this.isSleeping = si;
    this.prefs.escribir('GameState.Sleeping', si);
    this.setDelta('sleepyMeterDelta', 'SleepyDelta', 0);
    return true;
  }
  enableSleeping(si) {
    if (si && (this.isDay || this.toiletMeter < 31 || this.sleepyMeter > 90)) return false;
    this.setSleeping(si);
    return this.isSleeping;
  }
  // TurnBedroomLight → SetBedroomLight: prender la luz lo despierta
  turnBedroomLight(prendida) {
    if (this.isDay === prendida) return false;
    this.isDay = prendida;
    this.prefs.escribir('GameState.BedroomLightOn', prendida);
    if (prendida) this.setSleeping(false);
    return true;
  }

  // OnAppPause / OnAppResume
  onAppPause() { this.makingFunState = NADA; this.isToileting = false; this.recalculateMeters(false); }
  onAppResume() { this.wasPaused = true; this.recalculateMeters(true); }
}
