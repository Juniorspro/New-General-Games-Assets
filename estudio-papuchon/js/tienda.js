"use strict";
// ════════════════════════════════════════════════════════════════════════
// Tienda: el estado de la app. Los cambios al proyecto pasan por
// `cambiar` (entran al deshacer y se guardan solos); lo demás (qué panel,
// qué está elegido, el tiempo) es estado de pantalla y no ensucia el historial.
// ════════════════════════════════════════════════════════════════════════
const Tienda = (() => {
  let estado = {
    pantalla: "inicio", proyecto: null, seleccion: null, tiempo: 0, reproduciendo: false,
    zoom: 60, panel: null, exportando: null, marca: { ...EP.MARCA }, avisos: [], guardado: true,
  };
  const subs = new Set();
  let atras = [], adelante = [];
  const avisar = () => { for (const f of subs) f(); };
  const get = () => estado;
  function set(parcial) { estado = { ...estado, ...parcial }; avisar(); }
  const guardarYa = demorar(async () => {
    const p = estado.proyecto; if (!p) return;
    try { await Almacen.guardarProyecto({ ...p, duracionTotal: Proyecto.duracion(p) }); set({ guardado: true }); }
    catch (e) { aviso("No se pudo guardar el proyecto: " + e.message, "error"); }
  }, 600);
  function cambiar(fn, etiqueta = "") {
    if (antesDeArrastrar) soltar();
    const viejo = estado.proyecto; if (!viejo) return;
    const nuevo = fn(viejo); if (!nuevo || nuevo === viejo) return;
    atras.push({ p: viejo, etiqueta }); if (atras.length > 80) atras.shift(); adelante = [];
    // Si lo elegido ya no existe (se borró o se dividió), se suelta.
    const sel = estado.seleccion && Proyecto.buscarClip(nuevo, estado.seleccion) ? estado.seleccion : null;
    set({ proyecto: nuevo, seleccion: sel, guardado: false }); guardarYa();
  }
  // Arrastres (mover un gráfico en la vista): se ve en vivo y entra al deshacer una sola vez, al soltar.
  let antesDeArrastrar = null;
  function cambiarEnVivo(fn) {
    const viejo = estado.proyecto; if (!viejo) return;
    if (!antesDeArrastrar) antesDeArrastrar = viejo;
    const nuevo = fn(viejo); if (nuevo && nuevo !== viejo) set({ proyecto: nuevo, guardado: false });
  }
  function soltar(etiqueta = "") {
    if (!antesDeArrastrar) return;
    if (antesDeArrastrar !== estado.proyecto) { atras.push({ p: antesDeArrastrar, etiqueta }); if (atras.length > 80) atras.shift(); adelante = []; guardarYa(); }
    antesDeArrastrar = null;
  }
  function deshacer() { if (antesDeArrastrar) soltar(); const a = atras.pop(); if (!a) return; adelante.push({ p: estado.proyecto, etiqueta: a.etiqueta }); set({ proyecto: a.p, guardado: false }); guardarYa(); aviso("Deshecho" + (a.etiqueta ? ": " + a.etiqueta : ""), "info", 1500); }
  function rehacer() { const a = adelante.pop(); if (!a) return; atras.push({ p: estado.proyecto, etiqueta: a.etiqueta }); set({ proyecto: a.p, guardado: false }); guardarYa(); }
  let nAviso = 0;
  function aviso(texto, tipo = "info", ms = 3200) {
    const a = { id: ++nAviso, texto, tipo }; set({ avisos: [...estado.avisos.slice(-3), a] });
    setTimeout(() => set({ avisos: estado.avisos.filter((x) => x.id !== a.id) }), ms);
  }
  async function abrir(pid) {
    const p = await Almacen.proyecto(pid); if (!p) { aviso("No encontré ese proyecto", "error"); return; }
    atras = []; adelante = []; await Medios.cargarDe(Proyecto.medios(p));
    set({ proyecto: Proyecto.normalizar(p), pantalla: "editor", seleccion: null, tiempo: 0, panel: null });
  }
  async function nuevo(formatoId) {
    const p = Proyecto.crear(formatoId); atras = []; adelante = [];
    set({ proyecto: p, pantalla: "editor", seleccion: null, tiempo: 0, panel: "medios" });
    await Almacen.guardarProyecto(p);
  }
  function cerrar() { guardarYa(); set({ pantalla: "inicio", proyecto: null, seleccion: null, panel: null }); }
  async function cargarMarca() { const m = await Almacen.config("marca", null); if (m) set({ marca: { ...EP.MARCA, ...m } }); }
  async function guardarMarca(cambios) { const m = { ...estado.marca, ...cambios }; set({ marca: m }); await Almacen.guardarConfig("marca", m); }
  return {
    get, set, suscribir: (f) => (subs.add(f), () => subs.delete(f)), cambiar, cambiarEnVivo, soltar, deshacer, rehacer, aviso, abrir, nuevo, cerrar, cargarMarca, guardarMarca,
    get puedeDeshacer() { return atras.length > 0; }, get puedeRehacer() { return adelante.length > 0; },
  };
})();
// Hook de React: se re-renderiza solo si cambia lo que el selector devuelve.
function useTienda(sel = (e) => e) { return React.useSyncExternalStore(Tienda.suscribir, () => sel(Tienda.get())); }
