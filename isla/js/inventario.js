// El inventario: 9 ranuras de barra + 27 de mochila, pilas y recetas.
// Los cofres usan la misma clase con 27 ranuras.
import { ITEMS, RECETAS } from './items.js';

export class Inventario {
  constructor(n = 36) { this.ranuras = new Array(n).fill(null); this.version = 0; }

  // Cualquier cambio sube la versión: el HUD redibuja solo cuando cambia.
  tocado() { this.version++; }

  pila(id) { return (ITEMS[id] && ITEMS[id].pila) || 64; }

  // Devuelve cuántos NO entraron. Primero completa pilas, después ocupa
  // huecos: la barra antes que la mochila, como en Minecraft.
  agregar(id, n = 1) {
    if (!ITEMS[id] || n <= 0) return n;
    const max = this.pila(id);
    for (let i = 0; i < this.ranuras.length && n > 0; i++) {
      const r = this.ranuras[i];
      if (r && r.id === id && r.n < max) { const k = Math.min(n, max - r.n); r.n += k; n -= k; }
    }
    for (let i = 0; i < this.ranuras.length && n > 0; i++) {
      if (!this.ranuras[i]) { const k = Math.min(n, max); this.ranuras[i] = { id, n: k }; n -= k; }
    }
    this.tocado();
    return n;
  }

  cabe(id, n = 1) {
    const max = this.pila(id);
    let lugar = 0;
    for (const r of this.ranuras) { if (!r) lugar += max; else if (r.id === id) lugar += max - r.n; if (lugar >= n) return true; }
    return lugar >= n;
  }

  contar(id) { let c = 0; for (const r of this.ranuras) if (r && r.id === id) c += r.n; return c; }

  quitar(id, n = 1) {
    if (this.contar(id) < n) return false;
    for (let i = this.ranuras.length - 1; i >= 0 && n > 0; i--) {
      const r = this.ranuras[i];
      if (r && r.id === id) { const k = Math.min(n, r.n); r.n -= k; n -= k; if (r.n <= 0) this.ranuras[i] = null; }
    }
    this.tocado();
    return true;
  }

  quitarDe(i, n = 1) {
    const r = this.ranuras[i];
    if (!r) return null;
    const k = Math.min(n, r.n);
    r.n -= k;
    if (r.n <= 0) this.ranuras[i] = null;
    this.tocado();
    return { id: r.id, n: k };
  }

  puedeHacer(rec) { return Object.entries(rec.pide).every(([id, n]) => this.contar(id) >= n); }

  hacer(rec) {
    if (!this.puedeHacer(rec) || !this.cabe(rec.id, rec.da)) return false;
    for (const [id, n] of Object.entries(rec.pide)) this.quitar(id, n);
    this.agregar(rec.id, rec.da);
    return true;
  }

  valor() { let v = 0; for (const r of this.ranuras) if (r) v += (ITEMS[r.id]?.valor || 0) * r.n; return v; }

  serializar() { return this.ranuras.map((r) => (r ? [r.id, r.n] : 0)); }
  cargar(datos) {
    this.ranuras.fill(null);
    this.tocado();
    if (!Array.isArray(datos)) return;
    datos.slice(0, this.ranuras.length).forEach((d, i) => {
      if (Array.isArray(d) && ITEMS[d[0]] && Number.isInteger(d[1]) && d[1] > 0) this.ranuras[i] = { id: d[0], n: Math.min(d[1], this.pila(d[0])) };
    });
  }
}

// Mover entre dos ranuras (de un inventario o entre inventario y cofre):
// junta si es el mismo ítem, si no intercambia. Con `mitad`, lleva la mitad.
export function moverRanura(invA, i, invB, j, mitad = false) {
  const a = invA.ranuras[i];
  if (!a) return false;
  invA.tocado(); invB.tocado();
  const b = invB.ranuras[j];
  const max = invB.pila(a.id);
  const cuantos = mitad ? Math.ceil(a.n / 2) : a.n;
  if (!b) {
    invB.ranuras[j] = { id: a.id, n: cuantos };
    a.n -= cuantos;
    if (a.n <= 0) invA.ranuras[i] = null;
    return true;
  }
  if (b.id === a.id) {
    const k = Math.min(cuantos, max - b.n);
    if (k <= 0) return false;
    b.n += k; a.n -= k;
    if (a.n <= 0) invA.ranuras[i] = null;
    return true;
  }
  if (mitad) return false;
  invA.ranuras[i] = b; invB.ranuras[j] = a;
  return true;
}

export { RECETAS };
