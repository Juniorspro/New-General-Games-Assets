// El marcador: puntos, combo, multiplicador con su aro, energía y progreso.
// Y los numeritos que saltan de cada corte.
//
// Sólo se toca el DOM cuando un número CAMBIA: escribir textContent sesenta
// veces por segundo aunque sea igual obliga al navegador a medir el texto de
// nuevo, y en un teléfono eso se nota en el cuadro.

export class Hud {
  constructor(raiz) {
    this.raiz = raiz;
    this.$ = (s) => raiz.querySelector(s);
    this.ePuntos = this.$("#h-puntos");
    this.eCombo = this.$("#h-combo");
    this.eMult = this.$("#h-mult");
    this.eAro = this.$("#h-aro");
    this.eEnergia = this.$("#h-energia");
    this.eProgreso = this.$("#h-progreso");
    this.ePorc = this.$("#h-porc");
    this.eRango = this.$("#h-rango");
    this.capa = document.getElementById("flotantes");
    this.previo = {};
    this.pool = [];
    this.visible = true;
    this.largoAro = 2 * Math.PI * 26;
    if (this.eAro) this.eAro.style.strokeDasharray = `${this.largoAro}`;
  }

  _poner(k, el, valor, fn) {
    if (this.previo[k] === valor || !el) return;
    this.previo[k] = valor;
    fn ? fn(el, valor) : (el.textContent = valor);
  }

  reiniciar() { this.previo = {}; }

  actualizar(p, progreso) {
    this._poner("pts", this.ePuntos, p.puntos.toLocaleString("es-AR"));
    this._poner("combo", this.eCombo, String(p.combo));
    this._poner("mult", this.eMult, "x" + p.multiplicador);
    this._poner("aro", this.eAro, Math.round(p.aro * 100), (el, v) => { el.style.strokeDashoffset = String(this.largoAro * (1 - v / 100)); });
    this._poner("en", this.eEnergia, Math.round(p.energia * 200) / 2, (el, v) => {
      el.style.transform = `scaleX(${v / 100})`;
      el.classList.toggle("baja", v < 25);
    });
    this._poner("prog", this.eProgreso, Math.round(progreso * 400) / 4, (el, v) => { el.style.transform = `scaleX(${v / 100})`; });
    const porc = p.maximoHasta ? Math.floor(p.precision * 1000) / 10 : 100;
    this._poner("porc", this.ePorc, porc.toFixed(1).replace(".", ",") + "%");
    this._poner("rango", this.eRango, p.maximoHasta ? p.rango() : "SS");
  }

  mostrar(v) { this.visible = v; this.raiz.hidden = !v; }

  /** Un texto que salta desde donde se cortó y se va. */
  flotante(texto, x, y, clase) {
    if (!this.visible || !this.capa) return;
    let el = this.pool.pop();
    if (!el) { el = document.createElement("div"); el.addEventListener("animationend", () => { el.remove(); this.pool.push(el); }); }
    el.className = "flota " + clase;
    el.textContent = texto;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    this.capa.appendChild(el);
  }

  limpiarFlotantes() { if (this.capa) this.capa.textContent = ""; }
}
