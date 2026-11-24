"use strict";
// ════════════════════════════════════════════════════════════════════════
// Proyecto: el modelo de datos y sus operaciones. Todas son puras: reciben
// un proyecto y devuelven otro (el viejo queda intacto). Así deshacer es
// guardar el anterior, y la vista y la exportación leen lo mismo.
// ════════════════════════════════════════════════════════════════════════
const Proyecto = (() => {
  const MIN = 0.1;
  const dur = (c) => (c.duracion != null ? c.duracion : (c.hasta - c.desde) / (c.velocidad || 1));
  const fin = (c) => c.inicio + dur(c);
  function pistaNueva(tipo, nombre, sub = null) {
    const p = { id: id("k"), tipo, sub, nombre, oculta: false, silenciada: false, bloqueada: false, volumen: 1, clips: [] };
    if (tipo === "subtitulos") p.estilo = { plantilla: "subs-karaoke", y: null, tamano: 1 };
    return p;
  }
  function crear(formatoId = "9:16") {
    const f = EP.FORMATOS[formatoId] || EP.FORMATOS["9:16"];
    return {
      v: 1, id: id("p"), nombre: "Sin título", creado: Date.now(), editado: Date.now(),
      formato: { id: f.id, ancho: f.ancho, alto: f.alto, fps: EP.FPS }, fondo: "#000000",
      audio: { ducking: true, nivelDucking: 0.3 },
      pistas: [
        pistaNueva("video", "Video"), pistaNueva("superpuesta", "Encima"),
        pistaNueva("grafico", "Gráficos"), pistaNueva("grafico", "Gráficos 2"),
        pistaNueva("subtitulos", "Subtítulos"),
        pistaNueva("audio", "Voz", "voz"), pistaNueva("audio", "Música", "musica"), pistaNueva("audio", "Efectos", "efectos"),
      ],
    };
  }
  const clon = (p) => ({ ...p, editado: Date.now(), pistas: p.pistas.map((k) => ({ ...k, clips: k.clips.slice() })) });
  function normalizar(p) {
    for (const k of p.pistas) {
      if (k.tipo === "video") { let t = 0; k.clips = k.clips.map((c) => { const n = c.inicio === t ? c : { ...c, inicio: t }; t += dur(c); return n; }); }
      else k.clips.sort((a, b) => a.inicio - b.inicio);
    }
    return p;
  }
  function duracion(p) { let d = 0; for (const k of p.pistas) for (const c of k.clips) d = Math.max(d, fin(c)); return Math.max(d, 1); }
  function pista(p, q) { return p.pistas.find((k) => k.id === q || k.tipo === q || k.sub === q); }
  function buscarClip(p, cid) {
    for (const k of p.pistas) { const i = k.clips.findIndex((c) => c.id === cid); if (i >= 0) return { pista: k, clip: k.clips[i], indice: i }; }
    return null;
  }
  function clipsEn(p, t) {
    const r = [];
    for (const k of p.pistas) { if (k.oculta) continue; for (const c of k.clips) if (t >= c.inicio && t < fin(c)) r.push({ pista: k, clip: c }); }
    return r;
  }
  // Pista libre del tipo pedido entre t0 y t1; si no hay, se crea otra igual arriba de la última.
  function pistaLibre(p, tipo, sub, t0, t1) {
    const igual = p.pistas.filter((k) => k.tipo === tipo && (sub == null || k.sub === sub));
    for (const k of igual) if (!k.clips.some((c) => c.inicio < t1 - 1e-3 && fin(c) > t0 + 1e-3)) return k;
    const ult = igual[igual.length - 1], n = pistaNueva(tipo, (ult ? ult.nombre.replace(/ \d+$/, "") : tipo) + " " + (igual.length + 1), sub);
    p.pistas.splice(p.pistas.indexOf(ult) + 1, 0, n); return n;
  }
  function agregarMedio(p, medio, { pista: dest = "video", en = 0 } = {}) {
    p = clon(p);
    const largo = medio.tipo === "imagen" ? 4 : medio.duracion || 4;
    const c = { id: id("c"), medio: medio.id, inicio: Math.max(0, en), desde: 0, hasta: largo, largo: medio.tipo === "imagen" ? 3600 : largo, velocidad: 1, volumen: 1, fundidoEntrada: 0, fundidoSalida: 0 };
    let k;
    if (dest === "video") {
      k = pista(p, "video"); c.encuadre = { modo: "relleno", zoom: 1, x: 0, y: 0 }; c.transicion = { tipo: "ninguna", dur: 0.4 };
      // Se inserta en el lugar del cabezal: después del clip que está sonando ahí.
      let i = k.clips.findIndex((x) => en < fin(x) - 1e-3 && en >= x.inicio);
      i = i < 0 ? k.clips.length : (en - k.clips[i].inicio < dur(k.clips[i]) / 2 ? i : i + 1);
      k.clips.splice(i, 0, c);
    } else if (dest === "superpuesta") {
      const W = p.formato.ancho, H = p.formato.alto, an = Math.round(W * 0.46), al = Math.round(an * ((medio.alto || 9) / (medio.ancho || 16)));
      c.caja = { x: Math.round(W - an - W * 0.06), y: Math.round(H * 0.22), ancho: an, alto: al, rot: 0, marco: "blanco", radio: 18, etiqueta: "" };
      c.encuadre = { modo: "cubrir", zoom: 1, x: 0, y: 0 }; c.volumen = 0;
      k = pistaLibre(p, "superpuesta", null, c.inicio, c.inicio + dur(c)); k.clips.push(c);
    } else {
      k = pistaLibre(p, "audio", dest, c.inicio, c.inicio + dur(c)); k.clips.push(c);
    }
    return { p: normalizar(p), clip: c };
  }
  function agregarGrafico(p, plantillaId, en = 0, params = {}) {
    p = clon(p);
    const pl = typeof Plantillas !== "undefined" ? Plantillas.porId(plantillaId) : null;
    const c = { id: id("g"), plantilla: plantillaId, inicio: Math.max(0, en), duracion: pl ? pl.duracion : 5, params: { ...params }, caja: { x: 0, y: 0, escala: 1, rot: 0 } };
    pistaLibre(p, "grafico", null, c.inicio, c.inicio + c.duracion).clips.push(c);
    return { p: normalizar(p), clip: c };
  }
  function agregarSubtitulos(p, lista) {
    p = clon(p); const k = pista(p, "subtitulos"); if (!lista.length) return p;
    const t0 = lista[0].inicio, t1 = lista[lista.length - 1].inicio + lista[lista.length - 1].duracion;
    k.clips = k.clips.filter((c) => fin(c) <= t0 + 1e-3 || c.inicio >= t1 - 1e-3).concat(lista.map((s) => ({ id: id("s"), ...s })));
    return normalizar(p);
  }
  const PROFUNDOS = ["params", "caja", "encuadre", "transicion", "filtro", "estilo"];
  function cambiarClip(p, cid, cambios) {
    p = clon(p); const b = buscarClip(p, cid); if (!b) return p;
    const n = { ...b.clip };
    for (const [k, v] of Object.entries(cambios)) n[k] = PROFUNDOS.includes(k) && v && typeof v === "object" ? { ...(b.clip[k] || {}), ...v } : v;
    if (n.duracion != null) n.duracion = Math.max(MIN, n.duracion);
    if (n.inicio != null) n.inicio = Math.max(0, n.inicio);
    b.pista.clips[b.indice] = n; return normalizar(p);
  }
  function cambiarPista(p, kid, cambios) { p = clon(p); const i = p.pistas.findIndex((k) => k.id === kid); if (i >= 0) p.pistas[i] = { ...p.pistas[i], ...cambios, estilo: cambios.estilo ? { ...(p.pistas[i].estilo || {}), ...cambios.estilo } : p.pistas[i].estilo }; return p; }
  function dividir(p, cid, t) {
    p = clon(p); const b = buscarClip(p, cid); if (!b) return p;
    const c = b.clip, d = t - c.inicio; if (d < MIN || dur(c) - d < MIN) return p;
    let a, z;
    if (c.duracion != null) { a = { ...c, duracion: d }; z = { ...c, id: id(c.id[0]), inicio: t, duracion: c.duracion - d }; }
    else { const corte = c.desde + d * (c.velocidad || 1); a = { ...c, hasta: corte, fundidoSalida: 0, transicion: c.transicion ? { ...c.transicion, tipo: "ninguna" } : c.transicion }; z = { ...c, id: id("c"), inicio: t, desde: corte, fundidoEntrada: 0 }; }
    b.pista.clips.splice(b.indice, 1, a, z); return normalizar(p);
  }
  function recortar(p, cid, lado, t) {
    p = clon(p); const b = buscarClip(p, cid); if (!b) return p;
    const c = { ...b.clip }, v = c.velocidad || 1;
    if (c.duracion != null) {
      if (lado === "inicio") { const f = fin(c); c.inicio = clamp(t, 0, f - MIN); c.duracion = f - c.inicio; } else c.duracion = Math.max(MIN, t - c.inicio);
    } else if (lado === "inicio") {
      // En la pista principal el clip no se mueve: cambia desde dónde arranca el archivo.
      const nd = clamp(c.desde + (t - c.inicio) * v, 0, c.hasta - MIN * v);
      if (b.pista.tipo !== "video") c.inicio = Math.max(0, c.inicio + (nd - c.desde) / v);
      c.desde = nd;
    } else c.hasta = clamp(c.desde + (t - c.inicio) * v, c.desde + MIN * v, c.largo || 1e9);
    b.pista.clips[b.indice] = c; return normalizar(p);
  }
  function mover(p, cid, { inicio, pistaId, indice } = {}) {
    p = clon(p); const b = buscarClip(p, cid); if (!b) return p;
    if (b.pista.tipo === "video" && indice != null) { const [c] = b.pista.clips.splice(b.indice, 1); b.pista.clips.splice(clamp(indice, 0, b.pista.clips.length), 0, c); return normalizar(p); }
    const c = { ...b.clip, inicio: Math.max(0, inicio != null ? inicio : b.clip.inicio) };
    const dest = pistaId ? p.pistas.find((k) => k.id === pistaId) : b.pista;
    if (dest && dest !== b.pista && dest.tipo === b.pista.tipo) { b.pista.clips.splice(b.indice, 1); dest.clips.push(c); } else b.pista.clips[b.indice] = c;
    return normalizar(p);
  }
  function duplicar(p, cid) {
    p = clon(p); const b = buscarClip(p, cid); if (!b) return p;
    const c = { ...copia(b.clip), id: id(b.clip.id[0]) };
    if (b.pista.tipo === "video") b.pista.clips.splice(b.indice + 1, 0, c);
    else { c.inicio = fin(b.clip); pistaLibre(p, b.pista.tipo, b.pista.sub, c.inicio, c.inicio + dur(c)).clips.push(c); }
    return normalizar(p);
  }
  function borrar(p, cid) { p = clon(p); const b = buscarClip(p, cid); if (b) b.pista.clips.splice(b.indice, 1); return normalizar(p); }
  function cambiarFormato(p, fid) {
    const f = EP.FORMATOS[fid]; if (!f) return p;
    p = clon(p); const sx = f.ancho / p.formato.ancho, sy = f.alto / p.formato.alto;
    p.formato = { ...p.formato, id: f.id, ancho: f.ancho, alto: f.alto };
    for (const k of p.pistas) k.clips = k.clips.map((c) => {
      const n = { ...c };
      if (c.plantilla && c.caja) n.caja = { ...c.caja, x: c.caja.x * sx, y: c.caja.y * sy };
      if (k.tipo === "superpuesta" && c.caja) n.caja = { ...c.caja, x: c.caja.x * sx, y: c.caja.y * sy, ancho: c.caja.ancho * sx, alto: c.caja.ancho * sx * (c.caja.alto / c.caja.ancho) };
      return n;
    });
    return p;
  }
  function medios(p) { const s = new Set(); for (const k of p.pistas) for (const c of k.clips) if (c.medio) s.add(c.medio); for (const k of p.pistas) for (const c of k.clips) if (c.params) for (const v of Object.values(c.params)) if (typeof v === "string" && v.startsWith("m_")) s.add(v); return [...s]; }
  return { crear, normalizar, duracion, pista, buscarClip, clipsEn, agregarMedio, agregarGrafico, agregarSubtitulos, cambiarClip, cambiarPista, dividir, recortar, mover, duplicar, borrar, cambiarFormato, medios, dur, fin, pistaNueva };
})();
