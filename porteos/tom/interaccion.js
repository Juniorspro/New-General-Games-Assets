// RoomInteractivityTouchController: tocar las cosas del cuarto. Al bajar el dedo se busca el
// colisionador más cercano en los SLOT del cuarto (primero los de adelante), suena su AudioList (el
// sonido del material puesto o el de siempre) y, si ese SLOT tiene una función (la lámpara del
// dormitorio…), se la llama: si devuelve true, el toque termina ahí. Si el colisionador cuelga de un
// RoomItemAction (la heladera abre la tienda de comida), esa acción del juego sale al soltar, si el
// dedo no se fue de encima.

export class InteraccionCuarto {
  // cuarto: Cuarto (casa.js); rayo(x, y) → THREE.Ray; tocarSonido(spec); accion(gameAction)
  constructor(cuarto, { slots, frente = [], funciones = {}, tocarSonido, accion, sinSonido = null }) {
    this.cuarto = cuarto;
    this.slots = slots;
    this.frente = frente;
    this.funciones = funciones;       // nombre de SLOT → (colisionador) => bool
    this.tocarSonido = tocarSonido;
    this.accion = accion;
    this.sinSonido = sinSonido;       // () => bool: no suena (en el baño, el inodoro mientras lo usa)
    this.actualizar();
    this.dedos = new Map();
  }

  // los colisionadores cambian cuando se pone otro mueble
  actualizar() {
    const c = this.cuarto;
    this.lista = c.colisionadoresDe(this.slots, false);
    this.listaFrente = c.colisionadoresDe(this.frente, true);
  }

  masCercano(rayo) {
    return (this.listaFrente.length && this.cuarto.tocar(rayo, this.listaFrente)) || this.cuarto.tocar(rayo, this.lista);
  }

  // HandleTouch, fase Began: true si el toque fue para una función del cuarto
  bajar(id, rayo) {
    const t = this.masCercano(rayo);
    const d = { t, accion: null };
    this.dedos.set(id, d);
    if (!t) return false;
    // RoomItemAction del padre del colisionador
    const padre = t.nodo.parent;
    if (padre && padre.userData.accion !== undefined) d.accion = padre.userData.accion;
    else if (t.nodo.userData.accion !== undefined) d.accion = t.nodo.userData.accion;
    // AudioList del colisionador o de su padre
    if (!(this.sinSonido && this.sinSonido(t))) {
      const al = t.nodo.userData.sonidoToque || (padre && padre.userData.sonidoToque);
      if (al) {
        const nombreMat = t.nodo.userData.materialUnity || (padre && padre.userData.materialUnity);
        const s = (al.materiales && nombreMat && al.materiales[nombreMat]) || al.base;
        if (s) this.tocarSonido(s);
      }
    }
    const f = this.funciones[t.slot];
    if (f) return f(t) === true;
    return false;
  }

  // Moved: si el dedo ya no está sobre lo que tocó, no hay acción
  mover(id, rayo) {
    const d = this.dedos.get(id);
    if (!d || !d.t) return;
    const t = this.masCercano(rayo);
    if (!t || t.nodo !== d.t.nodo) d.accion = null;
  }

  soltar(id) {
    const d = this.dedos.get(id);
    this.dedos.delete(id);
    if (d && d.accion !== null && this.accion) this.accion(d.accion);
  }
}
