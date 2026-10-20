"use strict";
// ════════════════════════════════════════════════════════════════════════
// Compositor: dibuja un cuadro del proyecto en un canvas. Lo usan la vista
// previa y la exportación, así lo que ves es lo que sale.
// Orden: pista de video (con su transición) → encima → gráficos → subtítulos.
// Las coordenadas son las del proyecto (1080×1920 en vertical); la vista
// previa achica con setTransform.
// ════════════════════════════════════════════════════════════════════════
const Compositor = (() => {
  const TRANSICIONES = {
    ninguna: "Corte", fundido: "Fundido", negro: "Por negro", flash: "Flash blanco",
    deslizar: "Deslizar", zoom: "Zoom", papuchon: "Cortina del canal",
  };
  const FILTROS = {
    ninguno: { nombre: "Normal", css: "" },
    vivo: { nombre: "Vivo", css: "saturate(1.35) contrast(1.08)" },
    noticiero: { nombre: "Noticiero", css: "contrast(1.12) saturate(1.1) brightness(1.03)" },
    calido: { nombre: "Cálido", css: "sepia(0.25) saturate(1.2)" },
    frio: { nombre: "Frío", css: "hue-rotate(-12deg) saturate(0.9) brightness(1.04)" },
    bn: { nombre: "Blanco y negro", css: "grayscale(1) contrast(1.15)" },
    archivo: { nombre: "Archivo viejo", css: "sepia(0.6) contrast(0.95) brightness(0.95)" },
  };
  const ENCUADRES = { relleno: "Entero con fondo", cubrir: "Llenar pantalla", contener: "Entero con barras" };
  const MOVIMIENTOS = { ninguno: "Quieto", acercar: "Acercar lento", alejar: "Alejar lento" };
  const MARCOS = { ninguno: "Sin marco", blanco: "Blanco", rojo: "Rojo", amarillo: "Amarillo" };
  const filtroOK = (() => { try { const c = document.createElement("canvas").getContext("2d"); c.filter = "blur(1px)"; return c.filter === "blur(1px)"; } catch (e) { return false; } })();

  // Lienzo chico para el fondo borroso: se dibuja el cuadro a 36 px y se estira.
  const chico = document.createElement("canvas"); chico.width = 36; chico.height = 64;
  const gChico = chico.getContext("2d");

  const ancho = (fu) => fu.videoWidth || fu.width || 16, alto = (fu) => fu.videoHeight || fu.height || 9;
  // Qué fuente (video o imagen) corresponde a un clip y en qué segundo del archivo.
  function clave(pista, indice) { return pista.tipo === "video" ? "v" + (indice % 2) : pista.id; }
  function tiempoFuente(c, t) {
    const v = c.velocidad || 1;
    return clamp(c.desde + (t - c.inicio) * v, 0, Math.max(0, (c.largo || c.hasta) - 0.04));
  }
  function fuente(c, k) {
    const d = Medios.datos(c.medio); if (!d) return null;
    if (d.tipo === "imagen") return Medios.imagenYa(c.medio);
    if (d.tipo !== "video") return null;
    // Mientras busca (readyState 1) se sigue mostrando el último cuadro, así no parpadea en negro.
    const v = Medios.video(c.medio, k); if (!v) return null;
    if (v.readyState >= 2) { v._tuvo = true; return v; }
    return v._tuvo ? v : null;
  }
  // Lo visible de la pista principal en t: el clip y, si hay transición, el vecino.
  function capasPrincipal(pista, t) {
    const cs = pista.clips, out = [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], a = c.inicio, b = Proyecto.fin(c);
      if (t >= a && t < b) {
        out.push({ c, i, k: clave(pista, i), mezcla: 1, rol: "actual" });
        // Transición de entrada de este clip: la mitad cae antes del corte, la mitad después.
        const tr = c.transicion, prev = cs[i - 1];
        if (prev && tr && tr.tipo !== "ninguna" && t < a + tr.dur / 2) out.unshift({ c: prev, i: i - 1, k: clave(pista, i - 1), rol: "previo", tr, x: (t - (a - tr.dur / 2)) / tr.dur });
        const sig = cs[i + 1], ts = sig && sig.transicion;
        if (ts && ts.tipo !== "ninguna" && t >= b - ts.dur / 2) out.push({ c: sig, i: i + 1, k: clave(pista, i + 1), rol: "siguiente", tr: ts, x: (t - (b - ts.dur / 2)) / ts.dur });
        break;
      }
    }
    return out;
  }
  // Todo lo que tiene que estar cargado y en su lugar para dibujar t (lo usa el motor y la exportación).
  function fuentesEn(p, t) {
    const r = [];
    for (const k of p.pistas) {
      if (k.oculta) continue;
      if (k.tipo === "video") for (const x of capasPrincipal(k, t)) r.push({ c: x.c, k: x.k, ts: tiempoFuente(x.c, t), pista: k });
      else if (k.tipo === "superpuesta") for (const c of k.clips) if (t >= c.inicio && t < Proyecto.fin(c)) r.push({ c, k: k.id, ts: tiempoFuente(c, t), pista: k });
    }
    return r;
  }

  function dibujarFuente(ctx, fu, W, H, enc, c, t, conFondo) {
    const fw = ancho(fu), fh = alto(fu), modo = (enc && enc.modo) || "relleno";
    let z = (enc && enc.zoom) || 1;
    const mov = enc && enc.movimiento, d = Proyecto.dur(c), q = clamp((t - c.inicio) / d, 0, 1);
    if (mov === "acercar") z *= 1 + 0.12 * q; else if (mov === "alejar") z *= 1.12 - 0.12 * q;
    const cubre = Math.max(W / fw, H / fh), entra = Math.min(W / fw, H / fh);
    const e = (modo === "cubrir" ? cubre : entra) * z, w = fw * e, h = fh * e;
    const x = (W - w) / 2 + ((enc && enc.x) || 0) * W, y = (H - h) / 2 + ((enc && enc.y) || 0) * H;
    if (modo === "relleno" && conFondo && (w < W - 1 || h < H - 1)) {
      // Fondo: el mismo cuadro, borroso y oscurecido, llenando la pantalla.
      const ec = Math.max(chico.width / fw, chico.height / fh);
      gChico.clearRect(0, 0, chico.width, chico.height);
      gChico.drawImage(fu, (chico.width - fw * ec) / 2, (chico.height - fh * ec) / 2, fw * ec, fh * ec);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(chico, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    ctx.drawImage(fu, x, y, w, h);
  }
  function conFiltro(ctx, c, fn) {
    const fl = c.filtro && FILTROS[c.filtro.tipo];
    if (filtroOK && fl && fl.css) { ctx.save(); ctx.filter = fl.css; fn(); ctx.restore(); } else fn();
  }
  function opacidadFundido(c, t) {
    let a = 1; const d = Proyecto.dur(c), r = t - c.inicio;
    if (c.fundidoEntrada > 0) a *= clamp(r / c.fundidoEntrada, 0, 1);
    if (c.fundidoSalida > 0) a *= clamp((d - r) / c.fundidoSalida, 0, 1);
    return a;
  }

  function principal(ctx, p, k, t, W, H, rec) {
    const capas = capasPrincipal(k, t); if (!capas.length) return;
    const pinta = (x, extra) => {
      const fu = fuente(x.c, x.k); if (!fu) return false;
      ctx.save(); if (extra) extra();
      conFiltro(ctx, x.c, () => dibujarFuente(ctx, fu, W, H, x.c.encuadre, x.c, t, true));
      ctx.restore(); return true;
    };
    const act = capas.find((x) => x.rol === "actual"), otra = capas.find((x) => x.rol !== "actual");
    if (!otra) {
      ctx.save(); ctx.globalAlpha = opacidadFundido(act.c, t); pinta(act); ctx.restore();
      return;
    }
    // Transición entre `de` y `a` con avance x (0→1).
    const de = otra.rol === "previo" ? otra : act, a = otra.rol === "previo" ? act : otra, x = clamp(otra.x, 0, 1), tipo = otra.tr.tipo;
    if (tipo === "fundido") { pinta(de); pinta(a, () => { ctx.globalAlpha = x; }); }
    else if (tipo === "negro" || tipo === "flash") {
      pinta(x < 0.5 ? de : a);
      ctx.fillStyle = tipo === "negro" ? "#000" : "#fff"; ctx.globalAlpha = 1 - Math.abs(x - 0.5) * 2; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    } else if (tipo === "deslizar") {
      const e = facil(x);
      pinta(de, () => ctx.translate(-W * e, 0)); pinta(a, () => ctx.translate(W * (1 - e), 0));
    } else if (tipo === "zoom") {
      const e = x < 0.5 ? x * 2 : (x - 0.5) * 2;
      if (x < 0.5) pinta(de, () => { ctx.translate(W / 2, H / 2); ctx.scale(1 + e * 0.6, 1 + e * 0.6); ctx.translate(-W / 2, -H / 2); });
      else pinta(a, () => { ctx.translate(W / 2, H / 2); ctx.scale(1.6 - e * 0.6, 1.6 - e * 0.6); ctx.translate(-W / 2, -H / 2); });
      ctx.fillStyle = "#fff"; ctx.globalAlpha = (1 - Math.abs(x - 0.5) * 2) * 0.5; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    } else if (tipo === "papuchon") {
      // Cortina con los colores del canal: barra roja y amarilla cruzando en diagonal y el sol en el medio.
      pinta(x < 0.5 ? de : a);
      const m = rec.marca || EP.MARCA, e = suave(0, 1, x), dx = lerp(-W * 1.6, W * 1.6, e);
      ctx.save(); ctx.translate(W / 2 + dx, H / 2); ctx.rotate(-0.25);
      ctx.fillStyle = m.amarillo; ctx.fillRect(-W * 0.95, -H, W * 1.9, H * 2);
      ctx.fillStyle = m.rojo; ctx.fillRect(-W * 0.8, -H, W * 1.6, H * 2);
      ctx.restore();
      Plantillas.sol(ctx, W / 2 + dx * 0.15, H / 2, Math.min(W, H) * 0.22, e * 3, 1 - Math.abs(x - 0.5) * 1.6);
      if (rec.logo) {
        const al = 1 - Math.abs(x - 0.5) * 2.2; if (al > 0) { const lw = Math.min(W, H) * 0.62, lh = lw * rec.logo.height / rec.logo.width; ctx.globalAlpha = al; ctx.drawImage(rec.logo, (W - lw) / 2 + dx * 0.15, (H - lh) / 2, lw, lh); ctx.globalAlpha = 1; }
      }
    } else pinta(act);
  }

  function superpuesta(ctx, c, t, W, H, k) {
    const fu = fuente(c, k), cj = c.caja; if (!fu || !cj) return;
    const r = t - c.inicio, ap = rebote(clamp(r / 0.3, 0, 1)), al = opacidadFundido(c, t) * clamp(r / 0.15, 0, 1);
    const m = cj.marco && cj.marco !== "ninguno" ? 10 : 0, col = { blanco: "#fff", rojo: EP.MARCA.rojo, amarillo: EP.MARCA.amarillo }[cj.marco] || "#fff";
    ctx.save(); ctx.globalAlpha = al;
    ctx.translate(cj.x + cj.ancho / 2, cj.y + cj.alto / 2); if (cj.rot) ctx.rotate(cj.rot); ctx.scale(0.6 + 0.4 * ap, 0.6 + 0.4 * ap);
    const x = -cj.ancho / 2, y = -cj.alto / 2, rad = cj.radio || 0;
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    if (m) { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - m, y - m, cj.ancho + m * 2, cj.alto + m * 2, rad + m) : ctx.rect(x - m, y - m, cj.ancho + m * 2, cj.alto + m * 2); ctx.fill(); }
    else { ctx.fillStyle = "#000"; ctx.fillRect(x, y, cj.ancho, cj.alto); }
    ctx.shadowColor = "transparent";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, cj.ancho, cj.alto, rad) : ctx.rect(x, y, cj.ancho, cj.alto); ctx.clip();
    ctx.translate(x, y);
    conFiltro(ctx, c, () => dibujarFuente(ctx, fu, cj.ancho, cj.alto, c.encuadre || { modo: "cubrir" }, c, t, false));
    ctx.restore();
    if (cj.etiqueta) {
      ctx.save(); ctx.globalAlpha = al; ctx.font = '400 38px "Anton", Impact, sans-serif'; const tw = ctx.measureText(cj.etiqueta.toUpperCase()).width;
      const ex = cj.x - m, ey = cj.y - m - 50;
      ctx.fillStyle = EP.MARCA.rojo; ctx.fillRect(ex, ey, tw + 32, 52); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(cj.etiqueta.toUpperCase(), ex + 16, ey + 28); ctx.restore();
    }
  }

  // rec: { marca, logo, logos, esc (escala de la vista), sinSubs }
  function dibujar(ctx, p, t, rec = {}) {
    const W = p.formato.ancho, H = p.formato.alto, esc = rec.esc || 1;
    ctx.save(); ctx.setTransform(esc, 0, 0, esc, 0, 0);
    ctx.fillStyle = p.fondo || "#000"; ctx.fillRect(0, 0, W, H);
    for (const k of p.pistas) {
      if (k.oculta) continue;
      if (k.tipo === "video") principal(ctx, p, k, t, W, H, rec);
      else if (k.tipo === "superpuesta") { for (const c of k.clips) if (t >= c.inicio && t < Proyecto.fin(c)) superpuesta(ctx, c, t, W, H, k.id); }
      else if (k.tipo === "grafico") { for (const c of k.clips) if (t >= c.inicio && t < Proyecto.fin(c)) Plantillas.dibujarClip(ctx, c, t, W, H, rec); }
      else if (k.tipo === "subtitulos" && !rec.sinSubs) Plantillas.dibujarSubtitulos(ctx, k, t, W, H, rec.marca);
    }
    ctx.restore();
  }

  // Deja cada video exactamente en su cuadro (para exportar o con la vista en pausa).
  function esperarSeek(v, ms = 4000) {
    return new Promise((ok) => {
      const fin = () => { clearTimeout(tm); v.removeEventListener("seeked", fin); ok(); };
      const tm = setTimeout(fin, ms); v.addEventListener("seeked", fin);
    });
  }
  // Para buscar alcanza con los metadatos. Ojo: mientras busca, readyState baja a 1 y
  // "loadeddata" no vuelve a llegar nunca; esperarlo colgaba la vista 8 s al deslizar.
  async function esperarListo(v, ms = 8000) {
    if (v.readyState >= 1) return;
    await new Promise((ok) => { const fin = () => { clearTimeout(tm); ok(); }; const tm = setTimeout(fin, ms); v.addEventListener("loadedmetadata", fin, { once: true }); });
  }
  // Exportando, buscar (seek) cada cuadro es lento: si el video tiene que avanzar poquito,
  // se lo deja reproducir hasta que muestra el cuadro pedido y se lo vuelve a pausar.
  function avanzarJugando(v, ts, fps, vel) {
    return new Promise((ok) => {
      let listo = false;
      const fin = (r) => { if (listo) return; listo = true; clearTimeout(tm); v.pause(); ok(r); };
      const tm = setTimeout(() => fin(false), 2500);
      const cb = (ahora, md) => { if (listo) return; v._mt = md.mediaTime; if (md.mediaTime >= ts - 0.5 / fps) fin(true); else v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
      if (v.playbackRate !== vel) v.playbackRate = vel;
      v.play().catch(() => fin(false));
    });
  }
  async function ubicar(p, t, tolerancia = 0.5 / 30, jugar = false) {
    const espera = [];
    for (const f of fuentesEn(p, t)) {
      const d = Medios.datos(f.c.medio); if (!d) continue;
      if (d.tipo === "imagen") { if (!Medios.imagenYa(f.c.medio)) espera.push(Medios.imagen(f.c.medio)); continue; }
      if (d.tipo !== "video") continue;
      let v = Medios.video(f.c.medio, f.k);
      if (!v) { await Medios.preparar(f.c.medio); v = Medios.video(f.c.medio, f.k); if (!v) continue; }
      espera.push((async () => {
        await esperarListo(v);
        const fps = p.formato.fps || 30;
        if (jugar && "requestVideoFrameCallback" in v && v.paused && !v.seeking && v._mt != null && Math.abs(v.currentTime - v._mt) < 0.12 && v._mt <= f.ts + 0.5 / fps && f.ts - v._mt < 1.5) {
          if (v._mt >= f.ts - 0.5 / fps) return;                                  // el cuadro que se ve ya es el pedido
          if (await avanzarJugando(v, f.ts, fps, f.c.velocidad || 1)) return;
        }
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - f.ts) > tolerancia || v.seeking) { const s = esperarSeek(v); v.currentTime = f.ts; await s; }
        v._mt = v.currentTime;
      })());
    }
    await Promise.all(espera);
  }
  // Recursos de dibujo para la marca vigente (letras, logo propio o el del canal).
  async function recursos(marca) {
    const r = await Plantillas.cargarRecursos(marca);
    let logo = r.logo;
    if (marca.logoMedio) { const im = await Medios.imagen(marca.logoMedio).catch(() => null); if (im) logo = im; }
    return { ...r, logo, marca };
  }
  return { dibujar, ubicar, fuentesEn, capasPrincipal, tiempoFuente, recursos, TRANSICIONES, FILTROS, ENCUADRES, MOVIMIENTOS, MARCOS };
})();
