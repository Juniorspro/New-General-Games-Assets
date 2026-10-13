// La noche y el dormitorio: NightController (el color de la noche en todos los shaders), LampHideGlow
// (lo que se apaga en la lámpara), SleepingZZZFX (las zzz mientras duerme), BedroomGuiController (el
// cofre al pie de la cama en pantallas largas, la sombra de Tom en la almohada) y BedroomState
// (tocar la lámpara: BedroomLightSwitch; salir con la luz apagada la prende).
import { ParticulasUnity } from './particulas.js';
import { A } from './vivo.js';

const OSCURO = [0.32, 0.34, 0.45, 1];      // NightController.DarknessColor
const ATENUADO = [0.64, 0.68, 0.9, 1];     // DimmedColor (con el add-on de luz de noche)
export const LUZ = { NINGUNA: 0, NOCHE: 1, DIA: 2, ATENUADA: 3 };   // NightController.LightModes

export class Noche {
  // color: el uniform global _NightColor (THREE.Vector4); sonido(campo de AnimationAudioData)
  constructor(color, logica, sonido) {
    this.color = color;
    this.logica = logica;
    this.sonido = sonido;
    this.lightMode = LUZ.NINGUNA;          // Init
    this.atenuada = false;                 // el add-on de luz de noche (no está en la web)
  }

  // SetNight: la primera vez (LightMode 0) no suena
  setNight(on) {
    const m = this.lightMode;
    if (on && m !== LUZ.NOCHE) {
      if (m !== LUZ.NINGUNA) this.sonido('SwitchOff');
      this.logica.turnBedroomLight(false);
      this.lightMode = LUZ.NOCHE;
    } else if (!on && (m === LUZ.NINGUNA || m === LUZ.NOCHE)) {
      if (m !== LUZ.NINGUNA) this.sonido('SwitchOn');
      this.logica.turnBedroomLight(true);
      this.lightMode = LUZ.DIA;
    }
    this.setLightColor(this.lightMode === LUZ.NOCHE || this.lightMode === LUZ.ATENUADA, this.atenuada);
  }

  setLightColor(noche, atenuada) {
    let c = [1, 1, 1, 1];
    if (noche) {
      if (atenuada) { c = ATENUADO; this.lightMode = LUZ.ATENUADA; } else { c = OSCURO; this.lightMode = LUZ.NOCHE; }
    } else this.lightMode = LUZ.DIA;
    this.color.set(c[0], c[1], c[2], c[3]);
  }
}

// SleepingZZZFX: las zzz empiezan 5 s después de dormirse; al tocarle la cabeza se cortan por 3 s
export class Zzz {
  constructor(THREE, unity, nodo) {
    this.p = new ParticulasUnity(THREE, unity, nodo, nodo.userData.particulas);
    this.render = false;
    this.delayTime = 5;
    this.timer = 0;
  }
  get malla() { return this.p.malla; }
  start(durmiendo) { this.render = false; this.timer = durmiendo ? 5 : 0; }
  update(dt, durmiendo, cam, alto) {
    if (!this.render) {
      if (durmiendo) {
        this.timer += dt;
        if (this.timer > this.delayTime) { this.timer = 0; this.render = true; this.p.play(); }
      }
    } else if (!durmiendo) { this.p.stop(); this.render = false; }
    this.p.update(dt, cam, alto);
  }
  onHeadPoke() { this.render = false; this.timer = 2; this.p.stop(true); }
  stopNow() { this.render = false; this.timer = 0; this.p.stop(); this.p.clear(); }
  setRendererActive(si) { this.p.visible = si; }
}

// El dormitorio armado sobre su Cuarto: la lámpara, las zzz, el cofre y la almohada
export class Dormitorio {
  constructor(THREE, unity, cuarto) {
    this.cuarto = cuarto;
    const pe = cuarto.raiz.getObjectByName('SleepingPE');
    this.zzz = pe && pe.userData.particulas ? new Zzz(THREE, unity, pe) : null;
    if (this.zzz) cuarto.raiz.add(this.zzz.malla);
    let gui = null;
    cuarto.raiz.traverse((o) => { if (o.userData.dormitorio) gui = o.userData.dormitorio; });
    this.cofre = gui && gui.cofre ? cuarto.raiz.getObjectByName(gui.cofre) : null;
  }

  // BedroomGuiController.Awake: el cofre de la cama sólo en pantallas más largas que 16:9
  medir(ancho, alto) {
    if (!this.cofre) return;
    const si = alto / ancho > 1.7777778;
    this.cofre.visible = si;
    this.cofre.userData.activo = si;
  }

  // LampHideGlow: con la luz apagada se esconde lo que brilla (si la lámpara tiene algo que esconder)
  lampara(luzPrendida) {
    this.cuarto.raiz.traverse((o) => {
      const l = o.userData.lampara;
      if (!l || !l.ocultar) return;
      const x = o.getObjectByName(l.ocultar);
      if (x) x.visible = luzPrendida;
    });
  }

  // OnTomActivated
  tomActivo(si) {
    this.cuarto.ponerSombraAlmohada(si);
    if (this.zzz) this.zzz.setRendererActive(si);
  }
}

// BedroomState (estado del juego en el dormitorio): la lámpara y lo que pasa al entrar y salir
export class EstadoDormitorio {
  constructor({ logica, noche, ctl, dormitorio }) {
    this.logica = logica; this.noche = noche; this.ctl = ctl; this.dormitorio = dormitorio;
  }
  // OnAction(BedroomLightSwitch)
  luz() {
    const l = this.logica, eraDia = l.isDay;
    l.turnBedroomLight(!eraDia);                       // ToggleLightSwitch(!IsDay)
    this.ctl.fireAction(eraDia ? A.LightsOff : A.LightsOn);
    this.noche.setNight(eraDia);
  }
  // CommonRoomState.OnEnter: la noche sólo en el dormitorio con la luz apagada; HandleStateEntry
  entrar() {
    this.noche.setNight(!this.logica.isDay);
    if (this.dormitorio.zzz) this.dormitorio.zzz.start(this.logica.isSleeping);
    this.dormitorio.tomActivo(true);
    this.dormitorio.lampara(this.logica.isDay);
  }
  // OnExit: con la luz apagada, se prende al salir
  salir() {
    if (!this.logica.isDay) {
      this.logica.turnBedroomLight(true);
      this.noche.setNight(false);
    }
  }
}
