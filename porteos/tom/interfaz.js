// La interfaz principal (can_main de My Talking Tom): lo que los controladores del juego hacen sobre
// los nodos (MainUiController, LevelButtonController, CurrencyBalanceUiController, AtlasInt).
// Lo que en la web no existe (publicidad, galería de videos, noticias, viajes, desafío diario en
// línea, depuración) no se muestra.

// nodos que no van
const OCULTOS = ['can_debug', 'pnl_trail_clickerGame', 'pnl_clickerGame', 'pnl_rightSideButtonContainer',
  'btn_xpBooster', 'btn_skip', 'pnl_energyPotion', 'pnl_levelShine', 'img_levelBackground'];

// AtlasInt: un número con un sprite por dígito (los img_graphic de adentro)
function atlasInt(ui, p, n, valor) {
  const c = n.c.find((x) => x.c === 'AtlasInt');
  if (!c) return;
  const cifras = String(Math.max(0, valor | 0)).split('').map(Number);
  const imgs = c.AtlasImages.map((r) => p.porId.get(r.go)).filter(Boolean);
  imgs.forEach((im, i) => {
    if (i < cifras.length) {
      ui.activo(im, true);
      ui.cambiarSprite(im, c.CharacterSprites[cifras[i]].sprite);
    } else ui.activo(im, false);
  });
  ui.relayout(n);
}

// 123456 → "123.456" (como el juego en castellano)
const miles = (v) => String(Math.trunc(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export class Monedas {
  // VCA (Outfit7.MyTalkingTom.User.Vca): saldo de cada moneda, con el inicial de MttCurrency
  constructor(prefs, iniciales) {
    this.prefs = prefs;
    this.iniciales = iniciales;
    this.alCambiar = [];
  }
  saldo(id) { return this.prefs.int('Vca.' + id, this.iniciales[id] || 0); }
  sumar(id, cant) {
    const v = Math.max(0, this.saldo(id) + cant);
    this.prefs.escribir('Vca.' + id, v);
    for (const f of this.alCambiar) f(id, v);
    return v;
  }
  gastar(id, cant) {
    if (this.saldo(id) < cant) return false;
    this.sumar(id, -cant);
    return true;
  }
}

export class InterfazPrincipal {
  constructor(ui, p, { logica, monedas }) {
    this.ui = ui; this.p = p; this.logica = logica; this.monedas = monedas;
    for (const n of OCULTOS) p.mostrar(n, false);
    // los avisos (!, 888) son de cosas en línea
    for (const n of p.porId.values()) if (n.n === 'img_notificationBadge') ui.activo(n, false);
    // nivel
    const b = this.botonNivel = p.nodo('btn_level');
    this.cNivel = b && b.c.find((x) => x.c === 'LevelButtonController');
    this.progreso = 0;
    this.objetivo = 0;
    this.ponerNivel(false);
    logica.alCambiarXp.push(() => this.ponerNivel(true));
    // saldos
    const bal = p.nodo('pnl_balance');
    const cb = bal && bal.c.find((x) => x.c === 'CurrencyBalanceUiController');
    if (cb) {
      const textoDe = (ref) => {
        const n = p.porId.get(ref.go);
        if (!n) return null;
        return n.n === 'txt_balance' ? n : (n.h || []).find((h) => h.n === 'txt_balance') || (n.padre && (n.padre.h || []).find((h) => h.n === 'txt_balance'));
      };
      this.txtMonedas = textoDe(cb.CoinsBalance);
      this.txtDiamantes = textoDe(cb.DiamondsBalance);
    }
    this.ponerSaldos();
    monedas.alCambiar.push(() => this.ponerSaldos());
  }

  ponerSaldos() {
    if (this.txtMonedas) this.ui.ponerTexto(this.txtMonedas, miles(this.monedas.saldo('coins')));
    if (this.txtDiamantes) this.ui.ponerTexto(this.txtDiamantes, miles(this.monedas.saldo('diamond')));
  }

  // LevelButtonController: el número (AtlasInt) y la barra circular (fillAmount, la rayita gira con él)
  ponerNivel(animar) {
    const c = this.cNivel;
    if (!c) return;
    const p = this.p, l = this.logica;
    const num = p.porId.get(c.LevelInt.go);
    if (num) atlasInt(this.ui, p, num, l.level);
    this.objetivo = Math.min(1, l.levelPercentage / 100);
    if (!animar) this.ponerProgreso(this.objetivo);
  }
  ponerProgreso(v) {
    const c = this.cNivel, p = this.p;
    this.progreso = v;
    const img = p.porId.get(c.ProgressBarImage.go), linea = p.porId.get(c.ProgressBarLineRectTransform.go);
    if (img) this.ui.ponerPropiedad(img, 'Image', 'm_FillAmount', v);
    if (linea) this.ui.ponerPropiedad(linea, 'Transform', 'm_LocalEulerAngles.z', v * -360);
  }

  cuadro(dt) {
    // la barra corre hasta el valor nuevo en un segundo (AnimationSpeed = diferencia por segundo)
    if (this.cNivel && this.progreso !== this.objetivo) {
      const d = this.objetivo - this.progreso, paso = Math.max(Math.abs(d), 0.05) * dt;
      this.ponerProgreso(Math.abs(d) <= paso ? this.objetivo : this.progreso + Math.sign(d) * paso);
    }
  }
}
