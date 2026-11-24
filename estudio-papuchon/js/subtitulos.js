"use strict";
// ════════════════════════════════════════════════════════════════════════
// Subtítulos: se arman de a 3-4 palabras (como en TikTok) con el tiempo de
// cada palabra (relativo al bloque) para el efecto karaoke. Salen de la voz generada (que trae
// los tiempos), de un texto repartido en un tramo, o de un archivo SRT.
// ════════════════════════════════════════════════════════════════════════
const Subtitulos = (() => {
  function bloques(palabras, { maxPal = 4, maxCar = 20 } = {}) {
    const out = []; let b = [];
    const cerrar = () => { if (!b.length) return; const t0 = b[0].t0, t1 = b[b.length - 1].t1; out.push({ inicio: t0, duracion: Math.max(0.2, t1 - t0), texto: b.map((x) => x.p).join(" "), palabras: b.map((x) => ({ p: x.p, t0: x.t0 - t0, t1: x.t1 - t0 })) }); b = []; };
    for (const w of palabras) {
      const largo = b.reduce((s, x) => s + x.p.length + 1, 0) + w.p.length;
      if (b.length && (b.length >= maxPal || largo > maxCar || w.t0 - b[b.length - 1].t1 > 0.45)) cerrar();
      b.push(w);
      if (/[.!?…;:]$/.test(w.p) || (/,$/.test(w.p) && b.length >= 2)) cerrar();
    }
    cerrar();
    // Que no se pisen y que no queden huecos chiquitos (parpadeo).
    for (let i = 0; i < out.length - 1; i++) { const a = out[i], n = out[i + 1], hueco = n.inicio - (a.inicio + a.duracion); if (hueco < 0.25) a.duracion = Math.max(0.2, n.inicio - a.inicio); }
    return out;
  }
  // Los subtítulos de un clip de voz generada: sus palabras pasadas al tiempo del proyecto.
  function desdeVoz(clip, medio) {
    if (!medio || !medio.palabras) return [];
    const v = clip.velocidad || 1, fin = Proyecto.fin(clip), r = [];
    for (const w of medio.palabras) {
      if (w.t1 < clip.desde || w.t0 > clip.hasta) continue;
      const t0 = clip.inicio + (w.t0 - clip.desde) / v, t1 = clip.inicio + (w.t1 - clip.desde) / v;
      if (t0 >= fin) continue;
      r.push({ p: w.p, t0, t1: Math.min(t1, fin) });
    }
    return bloques(r);
  }
  // Un texto repartido en un tramo (cuando hablás vos y sabés lo que dijiste).
  const silabas = (p) => Math.max(1, (p.toLowerCase().match(/[aeiouáéíóúü]+/g) || []).length);
  function estimar(texto, inicio, duracion) {
    const pals = String(texto || "").split(/\s+/).filter(Boolean); if (!pals.length) return [];
    const pesos = pals.map((p) => silabas(p) + (/[.!?…]$/.test(p) ? 1.5 : /[,;:]$/.test(p) ? 0.7 : 0.15));
    const tot = pesos.reduce((a, b) => a + b, 0); let acc = 0;
    const r = pals.map((p, i) => { const t0 = inicio + (acc / tot) * duracion; acc += pesos[i]; return { p, t0, t1: inicio + (acc / tot) * duracion - (pesos[i] > 1.4 ? 0.2 : 0) }; });
    return bloques(r);
  }
  // ── SRT ──
  const aSeg = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  const aSRT = (t) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  function leerSRT(txt) {
    const out = [];
    for (const b of txt.replace(/\r/g, "").split(/\n\s*\n/)) {
      const l = b.trim().split("\n"); const i = l.findIndex((x) => x.includes("-->")); if (i < 0) continue;
      const [a, z] = l[i].split("-->"), texto = l.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim(); if (!texto) continue;
      const t0 = aSeg(a), t1 = aSeg(z); out.push({ inicio: t0, duracion: Math.max(0.2, t1 - t0), texto, palabras: null });
    }
    return out;
  }
  function escribirSRT(pista) { return pista.clips.map((c, i) => `${i + 1}\n${aSRT(c.inicio)} --> ${aSRT(c.inicio + c.duracion)}\n${c.texto}\n`).join("\n"); }
  return { bloques, desdeVoz, estimar, leerSRT, escribirSRT };
})();
