"use strict";
// ════════════════════════════════════════════════════════════════════════
// Almacén: IndexedDB. Los videos pesan cientos de MB y localStorage no da;
// IndexedDB guarda Blobs y anda también abriendo el HTML desde el disco.
// Si el navegador no lo deja (modo privado viejo), todo queda en memoria.
// ════════════════════════════════════════════════════════════════════════
const Almacen = (() => {
  const STORES = ["blobs", "medios", "proyectos", "config", "cache"];
  const memoria = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  let db = null;
  const abierto = new Promise((ok) => {
    try {
      const r = indexedDB.open("estudio-papuchon", 1);
      r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
      r.onsuccess = () => { db = r.result; ok(); };
      r.onerror = r.onblocked = () => ok();
    } catch (e) { ok(); }
  });
  async function op(store, modo, fn) {
    await abierto;
    if (!db) return fn(null, memoria[store]);
    return new Promise((ok, mal) => {
      const tx = db.transaction(store, modo), s = tx.objectStore(store);
      let res; const r = fn(s); if (r) r.onsuccess = () => { res = r.result; };
      tx.oncomplete = () => ok(res); tx.onerror = tx.onabort = () => mal(tx.error || new Error("No se pudo guardar"));
    });
  }
  const leer = (st, k) => op(st, "readonly", (s, m) => (s ? s.get(k) : m.get(k)));
  const poner = (st, k, v) => op(st, "readwrite", (s, m) => (s ? s.put(v, k) : m.set(k, v)));
  const sacar = (st, k) => op(st, "readwrite", (s, m) => (s ? s.delete(k) : m.delete(k)));
  const todos = (st) => op(st, "readonly", (s, m) => (s ? s.getAll() : [...m.values()]));
  return {
    guardarMedio: async (datos, blob) => { if (blob) await poner("blobs", datos.id, blob); await poner("medios", datos.id, datos); },
    medio: (id) => leer("medios", id), blob: (id) => leer("blobs", id), medios: () => todos("medios"),
    borrarMedio: async (id) => { await sacar("blobs", id); await sacar("medios", id); },
    guardarProyecto: (p) => poner("proyectos", p.id, p), proyecto: (id) => leer("proyectos", id),
    proyectos: async () => (await todos("proyectos")).sort((a, b) => b.editado - a.editado),
    borrarProyecto: (id) => sacar("proyectos", id),
    config: async (k, d) => { const v = await leer("config", k); return v === undefined ? d : v; },
    guardarConfig: (k, v) => poner("config", k, v),
    cache: (k) => leer("cache", k), guardarCache: (k, v) => poner("cache", k, v),
    uso: async () => { try { const e = await navigator.storage.estimate(); return { usado: e.usage, cuota: e.quota }; } catch (e) { return null; } },
    persistente: () => navigator.storage && navigator.storage.persist ? navigator.storage.persist().catch(() => false) : Promise.resolve(false),
  };
})();
