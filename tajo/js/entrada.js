// La entrada: cada dedo es un trazo, y cada trazo maneja un sable.
//
// El sable lo decide DÓNDE EMPIEZA el trazo: mitad izquierda, dorado; mitad
// derecha, violeta. Después el dedo puede cruzar la pantalla y sigue siendo
// el mismo sable, como la mano en el juego con casco: si cruzás el brazo,
// sigue siendo tu mano izquierda.
//
// Se leen TODOS los puntos del dedo (getCoalescedEvents): un teléfono de 120
// Hz manda dos o tres por cuadro, y un corte rápido de 40 px entre cuadros
// puede pasar por encima de un bloque sin tocar ninguno de los dos puntos del
// cuadro. Con los intermedios, el trazo es la curva que dibujó el dedo.

export class Entrada {
  constructor(el) {
    this.el = el;
    this.trazos = new Map();
    this.activa = true;
    this.alTocar = null;          // (x, y) → para despertar el audio, etc.
    const op = { passive: false };
    el.addEventListener("pointerdown", e => this._abajo(e), op);
    el.addEventListener("pointermove", e => this._mueve(e), op);
    el.addEventListener("pointerup", e => this._arriba(e), op);
    el.addEventListener("pointercancel", e => this._arriba(e), op);
    // Sin esto, en algunos navegadores un arrastre largo termina en "volver
    // atrás" o en seleccionar la página.
    el.addEventListener("touchstart", e => e.preventDefault(), op);
    el.addEventListener("contextmenu", e => e.preventDefault());
    this.rect = el.getBoundingClientRect();
    window.addEventListener("resize", () => { this.rect = el.getBoundingClientRect(); });
  }

  _xy(e) {
    const r = this.rect;
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp / 1000 };
  }

  _abajo(e) {
    e.preventDefault();
    this.rect = this.el.getBoundingClientRect();
    const p = this._xy(e);
    if (this.alTocar) this.alTocar(p.x, p.y);
    if (!this.activa) return;
    const sable = p.x < this.rect.width / 2 ? 0 : 1;
    // Un sable, un dedo: si ese sable ya tenía un trazo, el nuevo lo reemplaza.
    for (const t of this.trazos.values()) if (t.sable === sable && t.vivo) { t.vivo = false; t.fin = p.t; }
    const trazo = { id: e.pointerId, sable, puntos: [p], vivo: true, leido: 0, nuevo: true, fin: 0 };
    this.trazos.set(e.pointerId, trazo);
    // DESPUÉS de anotar el trazo: setPointerCapture tira si el puntero ya no
    // está, y antes se llevaba puesto el toque entero.
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* no importa */ }
  }

  _mueve(e) {
    const t = this.trazos.get(e.pointerId);
    if (!t || !t.vivo) return;
    e.preventDefault();
    const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (lista && lista.length) for (const c of lista) t.puntos.push(this._xy(c));
    else t.puntos.push(this._xy(e));
  }

  _arriba(e) {
    const t = this.trazos.get(e.pointerId);
    if (!t) return;
    if (t.vivo) { t.puntos.push(this._xy(e)); t.vivo = false; t.fin = e.timeStamp / 1000; }
  }

  /** Los trazos con puntos sin leer. Borra los terminados y ya leídos. */
  pendientes() {
    const out = [];
    for (const [id, t] of this.trazos) {
      if (t.leido < t.puntos.length) out.push(t);
      else if (!t.vivo) this.trazos.delete(id);
      // Un trazo largo no guarda toda su historia: sólo lo que hace falta
      // para medir el impulso (unos 400 ms).
      if (t.puntos.length > 400) {
        const sobra = t.puntos.length - 300;
        t.puntos.splice(0, sobra); t.leido = Math.max(0, t.leido - sobra);
      }
    }
    return out;
  }

  soltarTodo() {
    for (const t of this.trazos.values()) { t.vivo = false; }
  }

  /** Para el bot de pruebas: un trazo sintético. */
  simular(sable, puntos) {
    const id = "sim" + Math.random();
    const trazo = { id, sable, puntos: [...puntos], vivo: false, leido: 0, nuevo: true, fin: puntos[puntos.length - 1].t };
    this.trazos.set(id, trazo);
  }
}
