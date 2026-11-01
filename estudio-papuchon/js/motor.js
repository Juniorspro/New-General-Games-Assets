"use strict";
// ════════════════════════════════════════════════════════════════════════
// Motor: la vista previa. El reloj es el del audio (no se desfasa); los
// videos se reproducen mudos y se corrigen si se adelantan o atrasan.
// En pausa, cada cambio pide un cuadro y los videos se ubican exacto.
// El tiempo durante la reproducción no pasa por la Tienda (sería 60 renders
// por segundo): el cabezal se suscribe con Motor.alTiempo.
// ════════════════════════════════════════════════════════════════════════
const Motor = (() => {
  let canvas = null, ctx = null, esc = 0.5, rec = { marca: EP.MARCA }, actx = null;
  let reproduciendo = false, t0 = 0, base = 0, mezcla = null, raf = 0, pedido = false, tPausa = 0, nUbicar = 0;
  const oyentes = new Set();
  const audio = () => (actx = actx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" }));
  const proyecto = () => Tienda.get().proyecto;
  function tiempo() { return reproduciendo && actx ? t0 + Math.max(0, actx.currentTime - base) : tPausa; }
  function avisar(t) { for (const f of oyentes) f(t); }

  function conectar(cv, escala) {
    canvas = cv; ctx = cv ? cv.getContext("2d") : null; esc = escala || esc; pedirCuadro();
  }
  async function refrescarRecursos() { rec = await Compositor.recursos(Tienda.get().marca); pedirCuadro(); }
  function pedirCuadro() {
    if (pedido || reproduciendo) return; pedido = true;
    requestAnimationFrame(async () => {
      pedido = false; const p = proyecto(); if (!p || !ctx) return;
      const t = tPausa, n = ++nUbicar;
      dibujar(p, t);                                        // primero lo que haya
      await Compositor.ubicar(p, t).catch(() => {});
      if (n === nUbicar && !reproduciendo) dibujar(p, t);  // y después el cuadro exacto
    });
  }
  function dibujar(p, t) { if (ctx) Compositor.dibujar(ctx, p, t, { ...rec, esc }); }

  // Mantiene los videos andando junto al reloj.
  const activos = new Set();
  function sincronizarVideos(p, t) {
    const ahora = new Set();
    for (const f of Compositor.fuentesEn(p, t)) {
      const d = Medios.datos(f.c.medio); if (!d || d.tipo !== "video") continue;
      const v = Medios.video(f.c.medio, f.k); if (!v) continue;
      ahora.add(v);
      const vel = f.c.velocidad || 1;
      if (v.playbackRate !== vel) v.playbackRate = vel;
      const fuera = Math.abs(v.currentTime - f.ts);
      if (v.paused) { if (fuera > 0.08) v.currentTime = f.ts; v.play().catch(() => {}); }
      else if (fuera > 0.3 && !v.seeking) v.currentTime = f.ts + 0.05;
    }
    for (const v of activos) if (!ahora.has(v)) v.pause();
    activos.clear(); for (const v of ahora) activos.add(v);
  }
  function bucle() {
    if (!reproduciendo) return;
    const p = proyecto(); if (!p) return parar();
    const t = tiempo(), D = Proyecto.duracion(p);
    if (t >= D) { parar(); ir(0); return; }
    sincronizarVideos(p, t); dibujar(p, t); avisar(t);
    raf = requestAnimationFrame(bucle);
  }
  async function reproducir() {
    const p = proyecto(); if (!p || reproduciendo) return;
    const a = audio(); if (a.state === "suspended") await a.resume().catch(() => {});
    let desde = tPausa; if (desde >= Proyecto.duracion(p) - 0.05) desde = 0;
    await Compositor.ubicar(p, desde).catch(() => {});
    await Mezcla.precargar(p);   // decodificar antes de fijar el reloj, si no arranca atrasado
    base = a.currentTime + 0.08; t0 = desde;
    mezcla = await Mezcla.armar(a, p, t0, base).catch((e) => { console.warn("mezcla", e); return null; });
    reproduciendo = true; Tienda.set({ reproduciendo: true });
    raf = requestAnimationFrame(bucle);
  }
  function parar() {
    if (!reproduciendo) return;
    tPausa = tiempo(); reproduciendo = false; cancelAnimationFrame(raf);
    if (mezcla) mezcla.parar(); mezcla = null;
    for (const v of activos) v.pause(); activos.clear();
    Tienda.set({ reproduciendo: false, tiempo: tPausa }); avisar(tPausa); pedirCuadro();
  }
  function alternar() { reproduciendo ? parar() : reproducir(); }
  function ir(t) {
    const p = proyecto(); t = clamp(t, 0, p ? Proyecto.duracion(p) : 0);
    const seguía = reproduciendo; if (seguía) parar();
    tPausa = t; Tienda.set({ tiempo: t }); avisar(t); pedirCuadro();
    if (seguía) reproducir();
  }
  // Si cambia el proyecto andando, se rearma el audio (cambió un volumen, se movió un clip...).
  let ultimo = null;
  Tienda.suscribir(() => {
    const p = proyecto(); if (p === ultimo) return; ultimo = p;
    if (!p) { parar(); return; }
    if (reproduciendo) { const t = tiempo(); parar(); tPausa = t; reproducir(); } else pedirCuadro();
  });
  // Lo mismo cuando termina de cargarse un medio (llegan sus miniaturas o su audio).
  Medios.alCambiar(() => pedirCuadro());
  // Escuchar una cosa suelta (vista previa de música, voz recién hecha).
  let suelto = null;
  async function escuchar(blobOMid) {
    callar();
    const a = audio(); if (a.state === "suspended") await a.resume().catch(() => {});
    const ab = typeof blobOMid === "string" ? await Medios.audioBuffer(blobOMid) : await a.decodeAudioData(await blobOMid.arrayBuffer());
    if (!ab) return; const s = a.createBufferSource(); s.buffer = ab; s.connect(a.destination); s.start(); suelto = s;
    return new Promise((ok) => { s.onended = ok; });
  }
  function callar() { if (suelto) try { suelto.stop(); } catch (e) { /* */ } suelto = null; }
  return {
    conectar, pedirCuadro, reproducir, parar, alternar, ir, tiempo, refrescarRecursos, escuchar, callar, audio,
    get reproduciendo() { return reproduciendo; }, set escala(e) { esc = e; pedirCuadro(); },
    alTiempo: (f) => (oyentes.add(f), () => oyentes.delete(f)),
  };
})();
// Hook: el tiempo del cabezal, al ritmo de la pantalla mientras reproduce.
function useTiempo() {
  const [t, setT] = React.useState(Motor.tiempo());
  React.useEffect(() => Motor.alTiempo(setT), []);
  return t;
}
