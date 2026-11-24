"use strict";
// ════════════════════════════════════════════════════════════════════════
// Plantillas del canal: mosca, zócalos, placas, ticker, titulares, intro,
// cierre, sellos, subtítulos… Todas dibujadas por código en canvas, así se
// animan, se editan y salen idénticas en la vista y en el MP4. `dibujar`
// es pura: el mismo t da el mismo cuadro (salvo la hora en vivo).
// ════════════════════════════════════════════════════════════════════════
const Plantillas = (() => {
  const TIT = '"Anton", Impact, "Arial Narrow", sans-serif';
  const TXT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  const f = (peso, px, fam) => `${peso} ${Math.round(px)}px ${fam}`;
  const ent = (t, d = 0.5, r = 0) => facil((t - r) / d);
  const sal = (t, dur, d = 0.4) => 1 - suave(dur - d, dur, t);
  function zona(W, H) {
    const vert = H / W > 1.3;
    return {
      vert, m: vert ? 48 : 64, arriba: vert ? 200 : 56,
      zocalo: vert ? 1316 : H - 92, ticker: vert ? 1336 : H - 64,
      ancho: vert ? 892 : W - 128,   // en vertical, a la derecha está la columna de botones de TikTok
    };
  }
  // ── Dibujo común ──
  function caja(ctx, x, y, w, h, r = 0) { ctx.beginPath(); if (ctx.roundRect && r) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function medir(ctx, txt, fuente) { ctx.font = fuente; return ctx.measureText(txt).width; }
  // Tamaño de letra que hace entrar el texto en un renglón de `ancho` (entre min y max).
  function ajustar(ctx, txt, peso, fam, max, ancho, min = 18) {
    let px = max; ctx.font = f(peso, px, fam); const w = ctx.measureText(txt).width;
    if (w > ancho) px = Math.max(min, Math.floor(px * ancho / w));
    return px;
  }
  function renglones(ctx, txt, ancho) {
    const pal = String(txt || "").split(/\s+/).filter(Boolean), out = []; let r = "";
    for (const w of pal) { const n = r ? r + " " + w : w; if (r && ctx.measureText(n).width > ancho) { out.push(r); r = w; } else r = n; }
    if (r) out.push(r); return out;
  }
  // Texto en un bloque de hasta `maxR` renglones, achicando la letra hasta que entre.
  function bloque(ctx, txt, peso, fam, max, ancho, maxR, min = 20) {
    let px = max, rs;
    for (; px >= min; px -= 2) { ctx.font = f(peso, px, fam); rs = renglones(ctx, txt, ancho); if (rs.length <= maxR && rs.every((r) => ctx.measureText(r).width <= ancho)) break; }
    ctx.font = f(peso, Math.max(px, min), fam); return { px: Math.max(px, min), rs: rs || [] };
  }
  // El sol de la marca: rayos amarillo-naranja, en un canvas aparte (se dibuja una vez).
  let solCache = null;
  function solSprite() {
    if (solCache) return solCache;
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"), m = 256;
    g.translate(m, m);
    for (let i = 0; i < 18; i++) {
      g.save(); g.rotate((i / 18) * Math.PI * 2); const largo = i % 2 ? 200 : 250;
      const gr = g.createLinearGradient(0, -largo, 0, -110); gr.addColorStop(0, "#FFE066"); gr.addColorStop(1, "#FF8A00");
      g.fillStyle = gr; g.beginPath(); g.moveTo(-26, -110); g.lineTo(0, -largo); g.lineTo(26, -110); g.closePath(); g.fill(); g.restore();
    }
    const n = g.createRadialGradient(-30, -36, 10, 0, 0, 128); n.addColorStop(0, "#FFF4A8"); n.addColorStop(0.45, "#FFC21A"); n.addColorStop(1, "#FF7A00");
    g.fillStyle = n; g.beginPath(); g.arc(0, 0, 125, 0, 7); g.fill();
    g.lineWidth = 6; g.strokeStyle = "rgba(160,60,0,0.35)"; g.stroke();
    return (solCache = c);
  }
  function sol(ctx, x, y, r, giro = 0, alfa = 1) {
    ctx.save(); ctx.globalAlpha *= alfa; ctx.translate(x, y); ctx.rotate(giro); ctx.drawImage(solSprite(), -r, -r, r * 2, r * 2); ctx.restore();
  }
  // Rayos de fondo para placas e intro (abanico que gira).
  function abanico(ctx, cx, cy, r, giro, c1, c2) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(giro);
    for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, (i / 24) * 6.2832, ((i + 1) / 24) * 6.2832); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // Destello que cruza una banda (como los zócalos de la tele).
  function destello(ctx, x, y, w, h, prog) {
    if (prog <= 0 || prog >= 1) return;
    ctx.save(); caja(ctx, x, y, w, h); ctx.clip();
    const px = x - 160 + prog * (w + 320), g = ctx.createLinearGradient(px - 90, 0, px + 90, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.transform(1, 0, -0.35, 1, 0.35 * (y + h / 2), 0); ctx.fillRect(px - 90, y, 180, h); ctx.restore();
  }
  function logo(ctx, rec, x, y, ancho, alfa = 1) {
    const L = rec && rec.logo; if (!L) return 0;
    const alto = ancho * (L.height / L.width); ctx.save(); ctx.globalAlpha *= alfa; ctx.drawImage(L, x, y, ancho, alto); ctx.restore(); return alto;
  }
  function textoContorno(ctx, txt, x, y, relleno, borde, ancho) { ctx.lineJoin = "round"; ctx.lineWidth = ancho; ctx.strokeStyle = borde; ctx.strokeText(txt, x, y); ctx.fillStyle = relleno; ctx.fillText(txt, x, y); }
  // "*palabra*" resaltada: devuelve [{t, hl}] por renglón.
  function partes(s) { const out = []; String(s || "").split(/(\*[^*]+\*)/).forEach((x) => { if (!x) return; const hl = /^\*.*\*$/.test(x); out.push({ t: hl ? x.slice(1, -1) : x, hl }); }); return out; }
  const limpio = (s) => String(s || "").replace(/\*/g, "");
  function horaTexto(p) { if (typeof p.hora === "string" && p.hora) return p.hora; const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"], MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  function fechaTexto(p) { if (p.fecha) return p.fecha; const d = new Date(); return `${DIAS[d.getDay()]} ${d.getDate()} DE ${MESES[d.getMonth()]}`; }
  const mayus = (s) => String(s || "").toUpperCase();

  const lista = [];
  const def = (pl) => { lista.push(pl); return pl; };

  // ════ MARCA ════
  def({
    id: "mosca", nombre: "Mosca con logo", grupo: "marca", descripcion: "Tu logo en la esquina, con EN VIVO y la hora", duracion: 10,
    params: [
      { clave: "envivo", tipo: "bool", etiqueta: "EN VIVO", defecto: true },
      { clave: "hora", tipo: "bool", etiqueta: "Hora", defecto: true },
      { clave: "lado", tipo: "opcion", etiqueta: "Esquina", defecto: "izq", opciones: [{ v: "izq", etiqueta: "Izquierda" }, { v: "der", etiqueta: "Derecha" }] },
      { clave: "tamano", tipo: "numero", etiqueta: "Tamaño", defecto: 1, min: 0.5, max: 1.8, paso: 0.05 },
    ],
    caja(W, H, p) { const z = zona(W, H), a = 250 * (p.tamano || 1); return { x: p.lado === "der" ? (z.vert ? 940 : W - z.m) - a : z.m, y: z.arriba, ancho: a, alto: a * 0.7 + 64 }; },
    dibujar(ctx, e) {
      const { t, dur, p } = e, b = this.caja(e.W, e.H, p), k = ent(t, 0.45) * sal(t, dur), s = 0.6 + 0.4 * rebote(Math.min(1, t / 0.5));
      ctx.save(); ctx.globalAlpha = k; ctx.translate(b.x + b.ancho / 2, b.y); ctx.scale(s, s); ctx.translate(-b.ancho / 2, 0);
      const al = logo(ctx, e.rec, 0, 0, b.ancho);
      let x = 6; const y = al + 10, hp = 44 * (p.tamano || 1);
      if (p.envivo) {
        ctx.font = f(800, hp * 0.62, TXT); const w = ctx.measureText("EN VIVO").width + hp * 1.15;
        ctx.fillStyle = e.marca.rojo; caja(ctx, x, y, w, hp, 8); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.globalAlpha = k * (0.35 + 0.65 * (Math.sin(t * 6.3) > -0.2 ? 1 : 0)); ctx.beginPath(); ctx.arc(x + hp * 0.42, y + hp / 2, hp * 0.16, 0, 7); ctx.fill(); ctx.globalAlpha = k;
        ctx.textBaseline = "middle"; ctx.fillText("EN VIVO", x + hp * 0.72, y + hp / 2 + 1); x += w + 8;
      }
      if (p.hora) { const h = horaTexto(p); ctx.font = f(700, hp * 0.62, TXT); const w = ctx.measureText(h).width + hp * 0.7; ctx.fillStyle = "rgba(0,0,0,0.72)"; caja(ctx, x, y, w, hp, 8); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(h, x + hp * 0.35, y + hp / 2 + 1); }
      ctx.restore();
    },
  });
  def({
    id: "marca-agua", nombre: "Marca de agua", grupo: "marca", descripcion: "El logo chico y transparente todo el video", duracion: 30,
    params: [{ clave: "opacidad", tipo: "numero", etiqueta: "Opacidad", defecto: 0.55, min: 0.15, max: 1, paso: 0.05 }, { clave: "tamano", tipo: "numero", etiqueta: "Tamaño", defecto: 1, min: 0.5, max: 2, paso: 0.05 }],
    caja(W, H, p) { const z = zona(W, H), a = 170 * (p.tamano || 1); return { x: (z.vert ? 940 : W - z.m) - a, y: z.vert ? 1150 : H - z.m - a * 0.7, ancho: a, alto: a * 0.7 }; },
    dibujar(ctx, e) { const b = this.caja(e.W, e.H, e.p); logo(ctx, e.rec, b.x, b.y, b.ancho, (e.p.opacidad ?? 0.55) * ent(e.t, 0.6) * sal(e.t, e.dur, 0.6)); },
  });
  def({
    id: "intro", nombre: "Intro del canal", grupo: "marca", descripcion: "Logo con el sol girando y destello (2,5 s)", duracion: 2.6,
    params: [{ clave: "texto", tipo: "texto", etiqueta: "Bajada", defecto: "LA INFORMACIÓN COMO ES", mayus: true }, { clave: "fondo", tipo: "color", etiqueta: "Fondo", defecto: "marca.rojoOscuro" }],
    caja(W, H) { return { x: 0, y: 0, ancho: W, alto: H }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, k = sal(t, dur, 0.35), cx = W / 2, cy = H * 0.46;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = color(p.fondo, marca); ctx.fillRect(0, 0, W, H);
      abanico(ctx, cx, cy, Math.hypot(W, H), t * 0.35, "rgba(255,194,26,0.10)", "rgba(0,0,0,0.12)");
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7); g.addColorStop(0, "rgba(255,170,40,0.35)"); g.addColorStop(1, "rgba(0,0,0,0.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const a = Math.min(W * 0.82, 900) * (0.3 + 0.7 * rebote(Math.min(1, t / 0.7)));
      const L = e.rec && e.rec.logo; const al = L ? a * L.height / L.width : 0;
      logo(ctx, e.rec, cx - a / 2, cy - al / 2, a);
      if (p.texto) { const q = ent(t, 0.4, 0.8); ctx.globalAlpha = k * q; ctx.font = f(800, 54, TXT); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#fff"; ctx.fillText(mayus(p.texto), cx, cy + al / 2 + 40 + (1 - q) * 30); }
      const fl = 1 - suave(0.25, 0.7, t); if (t > 0.18 && fl > 0) { ctx.globalAlpha = fl * 0.85; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    },
  });
  def({
    id: "cierre", nombre: "Cierre: seguinos", grupo: "marca", descripcion: "Logo, tu @usuario y pedido de like", duracion: 4,
    params: [{ clave: "usuario", tipo: "texto", etiqueta: "Usuario", defecto: "" }, { clave: "texto", tipo: "texto", etiqueta: "Llamado", defecto: "DALE LIKE Y COMPARTÍ", mayus: true }],
    caja(W, H) { return { x: 0, y: 0, ancho: W, alto: H }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, k = ent(t, 0.4) * sal(t, dur, 0.3), cx = W / 2, cy = H * (zona(W, H).vert ? 0.40 : 0.38);
      ctx.save(); ctx.globalAlpha = k;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, marca.rojo); g.addColorStop(1, marca.rojoOscuro); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      abanico(ctx, cx, cy, Math.hypot(W, H), -t * 0.25, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.06)");
      const a = Math.min(W * 0.7, 760) * (0.85 + 0.15 * rebote(Math.min(1, t / 0.6)));
      const L = e.rec && e.rec.logo, al = L ? a * L.height / L.width : 0; logo(ctx, e.rec, cx - a / 2, cy - al / 2, a);
      ctx.textAlign = "center"; ctx.textBaseline = "top"; let y = cy + al / 2 + 40;
      const q1 = ent(t, 0.4, 0.4); ctx.globalAlpha = k * q1; ctx.font = f(400, 88, TIT); ctx.fillStyle = marca.amarillo; ctx.fillText("SEGUINOS", cx, y + (1 - q1) * 40); y += 112;
      const u = p.usuario || marca.usuario; const px = ajustar(ctx, u, 800, TXT, 76, W * 0.86); ctx.font = f(800, px, TXT); ctx.fillStyle = "#fff"; ctx.fillText(u, cx, y); y += px + 34;
      const q2 = ent(t, 0.4, 0.9); ctx.globalAlpha = k * q2; const lt = mayus(p.texto), px2 = ajustar(ctx, lt, 800, TXT, 50, W * 0.8); ctx.font = f(800, px2, TXT);
      const w = ctx.measureText(lt).width + 60; ctx.fillStyle = "#fff"; caja(ctx, cx - w / 2, y, w, px2 + 26, (px2 + 26) / 2); ctx.fill(); ctx.fillStyle = marca.rojo; ctx.fillText(lt, cx, y + 13);
      // Corazón que late.
      const lat = 1 + 0.12 * Math.max(0, Math.sin(t * 7)), hy = y + px2 + 90; ctx.globalAlpha = k * q2; ctx.save(); ctx.translate(cx, hy); ctx.scale(lat * 1.6, lat * 1.6);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-26, -8, -14, -28, 0, -14); ctx.bezierCurveTo(14, -28, 26, -8, 0, 10); ctx.fill(); ctx.restore();
      ctx.restore();
    },
  });

  // ════ ZÓCALOS ════
  function zocaloDosBandas(ctx, e, estilo) {
    const { t, dur, p, W, H, marca } = e, b = this_caja(W, H);
    const etq = mayus(p.etiqueta), tit = mayus(p.titulo), baj = mayus(p.bajada);
    const a = ent(t, 0.45), s = 1 - suave(dur - 0.4, dur, t);
    const hT = 104, hB = 58, y0 = b.y, x0 = b.x;
    ctx.save();
    // Etiqueta con el sol (arriba a la izquierda de la banda).
    ctx.font = f(400, 40, TIT); const wE = etq ? ctx.measureText(etq).width + 96 : 0;
    const ancho = b.ancho * Math.min(a, s < 1 ? s : 1);
    if (etq) {
      const ea = ent(t, 0.35, 0.05) * s; ctx.globalAlpha = 1;
      ctx.fillStyle = estilo === "noche" ? marca.rojo : marca.amarillo; caja(ctx, x0, y0 - 54, wE * ea, 54); ctx.fill();
      if (ea > 0.6) { sol(ctx, x0 + 30, y0 - 27, 21, t * 1.2); ctx.fillStyle = estilo === "noche" ? "#fff" : "#1a0a00"; ctx.textBaseline = "middle"; ctx.fillText(etq, x0 + 62, y0 - 25); }
    }
    // Banda del título.
    ctx.fillStyle = estilo === "noche" ? "#0d0d10" : color(p.color || "marca.rojo", marca); caja(ctx, x0, y0, ancho, hT); ctx.fill();
    if (estilo === "noche") { ctx.fillStyle = marca.rojo; ctx.fillRect(x0, y0, 12, hT); }
    // Banda de la bajada.
    if (baj) { ctx.fillStyle = estilo === "noche" ? "#26262c" : color(p.colorBajada || "#FFFFFF", marca); caja(ctx, x0, y0 + hT, ancho * Math.min(1, ent(t, 0.4, 0.12) * 1.02), hB); ctx.fill(); }
    // Textos (aparecen subiendo, recortados a la banda).
    const q = ent(t, 0.35, 0.22) * s;
    ctx.save(); caja(ctx, x0, y0, ancho, hT + (baj ? hB : 0)); ctx.clip();
    const pad = estilo === "noche" ? 34 : 24, px = ajustar(ctx, tit, 400, TIT, 72, b.ancho - pad * 2, 30);
    ctx.font = f(400, px, TIT); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.globalAlpha = q;
    ctx.fillText(tit, x0 + pad, y0 + hT / 2 + 4 + (1 - q) * 40);
    if (baj) {
      const pb = ajustar(ctx, baj, 700, TXT, 40, b.ancho - pad * 2, 20); ctx.font = f(700, pb, TXT);
      const fondoB = estilo === "noche" ? "#26262c" : color(p.colorBajada || "#FFFFFF", marca);
      ctx.fillStyle = estilo === "noche" ? "#e8e8ec" : (oscuro(fondoB) ? "#fff" : "#111");
      ctx.fillText(baj, x0 + pad, y0 + hT + hB / 2 + 2 + (1 - q) * 30);
    }
    ctx.restore();
    if (p.brillo !== false) destello(ctx, x0, y0, ancho, hT, (t - 0.9) / 0.7);
    ctx.restore();
  }
  let this_caja = null;
  function oscuro(hex) { const h = String(hex).replace("#", ""); if (h.length < 6) return false; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return r * 0.299 + g * 0.587 + b * 0.114 < 140; }
  const cajaZocalo = (W, H) => { const z = zona(W, H); return { x: z.m, y: z.zocalo - 104 - 58, ancho: z.ancho - (z.vert ? 0 : 0), alto: 162 }; };
  def({
    id: "zocalo-ultimo", nombre: "Zócalo Último momento", grupo: "zocalos", descripcion: "Dos bandas: título rojo y bajada, con la etiqueta del sol", duracion: 6,
    params: [
      { clave: "etiqueta", tipo: "texto", etiqueta: "Etiqueta", defecto: "ÚLTIMO MOMENTO", mayus: true, max: 30 },
      { clave: "titulo", tipo: "texto", etiqueta: "Título", defecto: "CORTE TOTAL EN LA RUTA 12", mayus: true, max: 70 },
      { clave: "bajada", tipo: "texto", etiqueta: "Bajada", defecto: "VECINOS RECLAMAN DESDE LAS 6 DE LA MAÑANA", mayus: true, max: 90 },
      { clave: "color", tipo: "color", etiqueta: "Color del título", defecto: "marca.rojo" },
      { clave: "colorBajada", tipo: "color", etiqueta: "Color de la bajada", defecto: "#FFFFFF" },
      { clave: "brillo", tipo: "bool", etiqueta: "Destello", defecto: true },
    ],
    caja: cajaZocalo,
    dibujar(ctx, e) { this_caja = cajaZocalo; zocaloDosBandas(ctx, e, "sol"); },
  });
  def({
    id: "zocalo-noche", nombre: "Zócalo Noche", grupo: "zocalos", descripcion: "Negro con filo rojo, sobrio", duracion: 6,
    params: [
      { clave: "etiqueta", tipo: "texto", etiqueta: "Etiqueta", defecto: "EN VIVO", mayus: true, max: 30 },
      { clave: "titulo", tipo: "texto", etiqueta: "Título", defecto: "SESIÓN CALIENTE EN EL CONCEJO", mayus: true, max: 70 },
      { clave: "bajada", tipo: "texto", etiqueta: "Bajada", defecto: "SE VOTA EL AUMENTO DEL BOLETO", mayus: true, max: 90 },
      { clave: "brillo", tipo: "bool", etiqueta: "Destello", defecto: true },
    ],
    caja: cajaZocalo,
    dibujar(ctx, e) { this_caja = cajaZocalo; zocaloDosBandas(ctx, e, "noche"); },
  });
  def({
    id: "zocalo-persona", nombre: "Zócalo de persona", grupo: "zocalos", descripcion: "Nombre y cargo de quien habla", duracion: 5,
    params: [{ clave: "nombre", tipo: "texto", etiqueta: "Nombre", defecto: "MARÍA ELENA ROMERO", mayus: true }, { clave: "cargo", tipo: "texto", etiqueta: "Cargo", defecto: "Diputada provincial" }, { clave: "color", tipo: "color", etiqueta: "Acento", defecto: "marca.rojo" }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.zocalo - 150, ancho: Math.min(z.ancho, 720), alto: 150 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), a = ent(t, 0.45) * sal(t, dur), nom = mayus(p.nombre);
      ctx.save(); const pxN = ajustar(ctx, nom, 400, TIT, 64, b.ancho - 60, 28); ctx.font = f(400, pxN, TIT); const wN = Math.min(b.ancho, ctx.measureText(nom).width + 60);
      const pxC = ajustar(ctx, p.cargo, 600, TXT, 40, b.ancho - 60, 20); ctx.font = f(600, pxC, TXT); const wC = Math.min(b.ancho, ctx.measureText(p.cargo).width + 60);
      const y = b.y + 10;
      ctx.fillStyle = color(p.color, marca); ctx.fillRect(b.x, y, 14, 130 * a);
      ctx.fillStyle = "rgba(10,10,12,0.88)"; ctx.fillRect(b.x + 14, y, (wN) * a, 80);
      ctx.fillStyle = "#fff"; ctx.fillRect(b.x + 14, y + 80, wC * ent(t, 0.4, 0.15) * sal(t, dur), 52);
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + 14, y, Math.max(wN, wC) * a, 132); ctx.clip();
      ctx.textBaseline = "middle"; ctx.globalAlpha = ent(t, 0.3, 0.2) * sal(t, dur); ctx.font = f(400, pxN, TIT); ctx.fillStyle = "#fff"; ctx.fillText(nom, b.x + 40, y + 42);
      ctx.font = f(600, pxC, TXT); ctx.fillStyle = "#15151a"; ctx.fillText(p.cargo, b.x + 40, y + 107); ctx.restore(); ctx.restore();
    },
  });
  def({
    id: "ticker", nombre: "Ticker corredizo", grupo: "zocalos", descripcion: "Banda de noticias que corre, con etiqueta", duracion: 12,
    params: [
      { clave: "etiqueta", tipo: "texto", etiqueta: "Etiqueta", defecto: "ÚLTIMO MOMENTO", mayus: true },
      { clave: "texto", tipo: "textoLargo", etiqueta: "Texto que corre", defecto: "DÓLAR BLUE $1.520 • RIESGO PAÍS 1.245 PUNTOS • CORTE EN LA RUTA 12 • SE VIENE EL DEBATE EN EL CONCEJO", mayus: true },
      { clave: "velocidad", tipo: "numero", etiqueta: "Velocidad", defecto: 180, min: 60, max: 420, paso: 10 },
      { clave: "color", tipo: "color", etiqueta: "Etiqueta", defecto: "marca.amarillo" },
    ],
    caja(W, H) { const z = zona(W, H); return { x: 0, y: z.ticker, ancho: z.vert ? 940 : W, alto: 64 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), a = ent(t, 0.4) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 40);
      ctx.fillStyle = "rgba(8,8,10,0.92)"; ctx.fillRect(b.x, b.y, b.ancho, b.alto);
      ctx.font = f(400, 34, TIT); const etq = mayus(p.etiqueta), wE = etq ? ctx.measureText(etq).width + 44 : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + wE, b.y, b.ancho - wE, b.alto); ctx.clip();
      const txt = mayus(p.texto) + "   •   "; ctx.font = f(700, 36, TXT); const w = ctx.measureText(txt).width || 1;
      let x = b.x + b.ancho - ((t * (p.velocidad || 180)) % w) - w; ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
      while (x < b.x + b.ancho) { ctx.fillText(txt, x, b.y + b.alto / 2 + 2); x += w; }
      ctx.restore();
      if (etq) { ctx.fillStyle = color(p.color, marca); ctx.fillRect(b.x, b.y, wE, b.alto); ctx.fillStyle = oscuro(color(p.color, marca)) ? "#fff" : "#111"; ctx.font = f(400, 34, TIT); ctx.textBaseline = "middle"; ctx.fillText(etq, b.x + 22, b.y + b.alto / 2 + 2); }
      ctx.restore();
    },
  });

  // ════ PLACAS ════
  def({
    id: "placa-ultimo", nombre: "Placa de último momento", grupo: "placas", descripcion: "Pantalla completa, con rayos y sacudón", duracion: 3.2,
    params: [{ clave: "titulo", tipo: "texto", etiqueta: "Título", defecto: "ÚLTIMO MOMENTO", mayus: true }, { clave: "texto", tipo: "textoLargo", etiqueta: "Texto", defecto: "SE CONFIRMÓ EL PARO DE COLECTIVOS PARA MAÑANA", mayus: true }, { clave: "fondo", tipo: "color", etiqueta: "Fondo", defecto: "marca.rojo" }],
    caja(W, H) { return { x: 0, y: 0, ancho: W, alto: H }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, k = ent(t, 0.25) * sal(t, dur, 0.3), cx = W / 2, cy = H / 2;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = color(p.fondo, marca); ctx.fillRect(0, 0, W, H);
      abanico(ctx, cx, cy, Math.hypot(W, H), t * 0.5, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.10)");
      const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(W, H) * 0.7); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.6)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const temb = t < 0.6 ? Math.sin(t * 80) * 12 * (1 - t / 0.6) : 0; ctx.translate(temb, 0);
      sol(ctx, cx, cy - (zona(W, H).vert ? 330 : 250), 120, t * 0.8, ent(t, 0.4, 0.1));
      const tit = mayus(p.titulo), px = ajustar(ctx, tit, 400, TIT, 170, W * 0.9, 60), s = 0.6 + 0.4 * rebote(Math.min(1, t / 0.45));
      ctx.save(); ctx.translate(cx, cy - 20); ctx.scale(s, s); ctx.font = f(400, px, TIT); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      textoContorno(ctx, tit, 0, 0, "#fff", "rgba(0,0,0,0.55)", 14); ctx.restore();
      const b = bloque(ctx, mayus(p.texto), 800, TXT, 64, W * 0.82, 3, 28); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.globalAlpha = k * ent(t, 0.4, 0.35);
      b.rs.forEach((r, i) => { const y = cy + px * 0.55 + i * b.px * 1.1; const w = ctx.measureText(r).width + 40; ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(cx - w / 2, y - 4, w, b.px * 1.1); ctx.fillStyle = marca.amarillo; ctx.fillText(r, cx, y); });
      const fl = 1 - suave(0, 0.25, t); if (fl > 0) { ctx.globalAlpha = fl * 0.9; ctx.fillStyle = "#fff"; ctx.fillRect(-50, 0, W + 100, H); }
      ctx.restore();
    },
  });
  def({
    id: "sello", nombre: "Sello", grupo: "placas", descripcion: "EXCLUSIVO, CONFIRMADO, FALSO o URGENTE, de un golpe", duracion: 3,
    params: [{ clave: "texto", tipo: "opcion", etiqueta: "Sello", defecto: "EXCLUSIVO", opciones: ["EXCLUSIVO", "CONFIRMADO", "FALSO", "URGENTE", "INSÓLITO", "VIRAL"].map((v) => ({ v, etiqueta: v })) }],
    caja(W, H) { const w = Math.min(W * 0.72, 760); return { x: (W - w) / 2, y: H * 0.36, ancho: w, alto: 220 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), col = { CONFIRMADO: "#1FA34A", FALSO: "#E01B24", VIRAL: "#7B2FF7", INSÓLITO: marca.naranja }[p.texto] || marca.rojo;
      const s = t < 0.25 ? lerp(2.6, 0.92, facil(t / 0.25)) : t < 0.4 ? lerp(0.92, 1, (t - 0.25) / 0.15) : 1, k = Math.min(1, t / 0.12) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(b.x + b.ancho / 2, b.y + b.alto / 2); ctx.rotate(-0.14); ctx.scale(s, s);
      const txt = mayus(p.texto), px = ajustar(ctx, txt, 400, TIT, 150, b.ancho - 80, 50); ctx.font = f(400, px, TIT); const w = ctx.measureText(txt).width + 80, h = px * 1.25;
      ctx.lineWidth = 14; ctx.strokeStyle = col; caja(ctx, -w / 2, -h / 2, w, h, 18); ctx.stroke(); ctx.lineWidth = 4; caja(ctx, -w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 10); ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, 0, 6);
      ctx.restore();
    },
  });

  // ════ TITULARES ════
  def({
    id: "titular", nombre: "Titular arriba", grupo: "titulares", descripcion: "Título grande en cajas; *palabra* sale en amarillo", duracion: 6,
    params: [{ clave: "texto", tipo: "textoLargo", etiqueta: "Titular", defecto: "*ESCÁNDALO* EN EL CONCEJO: SE PELEARON EN PLENA SESIÓN", mayus: true }, { clave: "fondo", tipo: "color", etiqueta: "Cajas", defecto: "#0B0B0D" }, { clave: "resalte", tipo: "color", etiqueta: "Resaltado", defecto: "marca.amarillo" }, { clave: "tamano", tipo: "numero", etiqueta: "Tamaño", defecto: 1, min: 0.6, max: 1.5, paso: 0.05 }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.vert ? 400 : z.arriba + 10, ancho: z.vert ? W - z.m * 2 : W * 0.7, alto: z.vert ? 360 : 300 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), sz = p.tamano || 1;
      const plano = mayus(limpio(p.texto)), { px, rs } = bloque(ctx, plano, 400, TIT, 92 * sz, b.ancho - 40, 3, 34);
      // Las palabras resaltadas, por texto (sin asteriscos).
      const resaltadas = new Set(partes(mayus(p.texto)).filter((x) => x.hl).flatMap((x) => x.t.split(/\s+/)));
      ctx.save(); ctx.textBaseline = "middle";
      rs.forEach((r, i) => {
        const q = ent(t, 0.35, i * 0.12) * sal(t, dur), y = b.y + i * (px * 1.22);
        ctx.font = f(400, px, TIT); const w = ctx.measureText(r).width + 36;
        ctx.globalAlpha = q; ctx.fillStyle = color(p.fondo, marca); caja(ctx, b.x, y, w * Math.min(1, q * 1.1), px * 1.14); ctx.fill();
        let x = b.x + 18; ctx.save(); ctx.beginPath(); ctx.rect(b.x, y, w * q, px * 1.14); ctx.clip();
        for (const pal of r.split(" ")) { ctx.fillStyle = resaltadas.has(pal) ? color(p.resalte, marca) : "#fff"; ctx.fillText(pal, x, y + px * 0.6); x += ctx.measureText(pal + " ").width; }
        ctx.restore();
      });
      ctx.restore();
    },
  });
  def({
    id: "cita", nombre: "Cita textual", grupo: "titulares", descripcion: "Lo que dijo alguien, entre comillas grandes", duracion: 6,
    params: [{ clave: "texto", tipo: "textoLargo", etiqueta: "Cita", defecto: "Esto no lo vamos a permitir, vamos a ir hasta el final" }, { clave: "autor", tipo: "texto", etiqueta: "Quién lo dijo", defecto: "Concejal opositor" }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.vert ? 560 : H * 0.22, ancho: z.vert ? 892 : W * 0.6, alto: 420 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), k = ent(t, 0.4) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * -40, 0);
      const { px, rs } = bloque(ctx, "“" + p.texto + "”", 700, TXT, 66, b.ancho - 80, 5, 28), h = rs.length * px * 1.18 + 120;
      ctx.fillStyle = "rgba(255,255,255,0.95)"; caja(ctx, b.x, b.y, b.ancho, h, 22); ctx.fill();
      ctx.fillStyle = marca.rojo; ctx.fillRect(b.x, b.y, 16, h);
      ctx.font = f(400, 170, TIT); ctx.fillStyle = marca.rojo; ctx.globalAlpha = k * 0.25; ctx.textBaseline = "top"; ctx.fillText("“", b.x + b.ancho - 110, b.y - 10); ctx.globalAlpha = k;
      ctx.font = f(700, px, TXT); ctx.fillStyle = "#121216"; rs.forEach((r, i) => ctx.fillText(r, b.x + 44, b.y + 36 + i * px * 1.18));
      ctx.font = f(800, 36, TXT); ctx.fillStyle = marca.rojo; ctx.fillText("— " + mayus(p.autor), b.x + 44, b.y + 36 + rs.length * px * 1.18 + 14);
      ctx.restore();
    },
  });

  // ════ INFO ════
  function pastilla(ctx, x, y, txt, fondo, letra, px = 40, icono) {
    ctx.font = f(800, px, TXT); const w = ctx.measureText(txt).width + px * (icono ? 1.9 : 1.1), h = px * 1.55;
    ctx.fillStyle = fondo; caja(ctx, x, y, w, h, h / 2); ctx.fill();
    if (icono) icono(x + px * 0.85, y + h / 2, px * 0.42);
    ctx.fillStyle = letra; ctx.textBaseline = "middle"; ctx.fillText(txt, x + px * (icono ? 1.45 : 0.55), y + h / 2 + 2); return { w, h };
  }
  def({
    id: "ubicacion", nombre: "Ubicación", grupo: "info", descripcion: "Dónde pasa, con el pin", duracion: 5,
    params: [{ clave: "lugar", tipo: "texto", etiqueta: "Lugar", defecto: "PARANÁ, ENTRE RÍOS", mayus: true }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.vert ? 1080 : z.arriba + 10, ancho: 560, alto: 64 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), k = ent(t, 0.4) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * -60, 0);
      pastilla(ctx, b.x, b.y, mayus(p.lugar), "rgba(10,10,12,0.85)", "#fff", 40, (x, y, r) => { ctx.fillStyle = marca.rojo; ctx.beginPath(); ctx.arc(x, y - r * 0.3, r, Math.PI, 0); ctx.lineTo(x, y + r * 1.3); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y - r * 0.3, r * 0.38, 0, 7); ctx.fill(); });
      ctx.restore();
    },
  });
  def({
    id: "fecha", nombre: "Fecha y hora", grupo: "info", descripcion: "El día y la hora, en una pastilla", duracion: 5,
    params: [{ clave: "fecha", tipo: "texto", etiqueta: "Fecha (vacío = hoy)", defecto: "" }, { clave: "hora", tipo: "texto", etiqueta: "Hora (vacío = ahora)", defecto: "" }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.vert ? 1000 : z.arriba + 90, ancho: 620, alto: 64 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), k = ent(t, 0.4) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = k; const r = pastilla(ctx, b.x, b.y, fechaTexto(p), "#fff", "#111", 36);
      pastilla(ctx, b.x + r.w + 10, b.y, horaTexto(p), marca.rojo, "#fff", 36); ctx.restore();
    },
  });
  def({
    id: "fuente", nombre: "Fuente / crédito", grupo: "info", descripcion: "De dónde salen las imágenes", duracion: 6,
    params: [{ clave: "texto", tipo: "texto", etiqueta: "Fuente", defecto: "FUENTE: LEGISLATURA DE ENTRE RÍOS", mayus: true }],
    caja(W, H) { const z = zona(W, H); return { x: z.m, y: z.vert ? 1240 : z.zocalo - 230, ancho: 700, alto: 44 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H } = e, b = this.caja(W, H), k = ent(t, 0.5) * sal(t, dur);
      ctx.save(); ctx.globalAlpha = k * 0.95; ctx.font = f(700, 30, TXT); const txt = mayus(p.texto), w = ctx.measureText(txt).width + 28;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; caja(ctx, b.x, b.y, w, 44, 6); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(txt, b.x + 14, b.y + 23); ctx.restore();
    },
  });

  // ════ REDES ════
  def({
    id: "progreso", nombre: "Barra de progreso", grupo: "redes", descripcion: "Cuánto falta (estirala a todo el video)", duracion: 30,
    params: [{ clave: "lado", tipo: "opcion", etiqueta: "Lugar", defecto: "arriba", opciones: [{ v: "arriba", etiqueta: "Arriba" }, { v: "abajo", etiqueta: "Abajo" }] }, { clave: "color", tipo: "color", etiqueta: "Color", defecto: "marca.amarillo" }],
    caja(W, H, p) { return { x: 0, y: p.lado === "abajo" ? H - 14 : 0, ancho: W, alto: 14 }; },
    dibujar(ctx, e) { const b = this.caja(e.W, e.H, e.p); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(b.x, b.y, b.ancho, b.alto); ctx.fillStyle = color(e.p.color, e.marca); ctx.fillRect(b.x, b.y, b.ancho * clamp(e.t / e.dur, 0, 1), b.alto); },
  });
  def({
    id: "cortina", nombre: "Cortina de marca", grupo: "redes", descripcion: "Barrido rojo con el sol para pasar de un tema a otro", duracion: 1,
    params: [],
    caja(W, H) { return { x: 0, y: 0, ancho: W, alto: H }; },
    dibujar(ctx, e) {
      const { t, dur, W, H, marca } = e, u = t / dur, a = u < 0.5 ? facil(u * 2) : 1, z = u < 0.5 ? 0 : facil((u - 0.5) * 2), d = W * 0.5;
      ctx.save(); ctx.fillStyle = marca.rojo; ctx.beginPath(); const x1 = lerp(-W - d, 0, a) + lerp(0, W + d, z);
      ctx.moveTo(x1, 0); ctx.lineTo(x1 + W + d, 0); ctx.lineTo(x1 + W, H); ctx.lineTo(x1 - d, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = marca.amarillo; ctx.fillRect(x1 + W + d - 30, 0, 30, H * 0.0001); sol(ctx, x1 + W / 2, H / 2, Math.min(W, H) * 0.16, u * 4, 1); ctx.restore();
    },
  });

  // ════ RESALTAR ════
  def({
    id: "resaltar", nombre: "Círculo y flecha", grupo: "resaltar", descripcion: "Marcá algo del video (movelo encima)", duracion: 3,
    params: [{ clave: "forma", tipo: "opcion", etiqueta: "Forma", defecto: "ambos", opciones: [{ v: "circulo", etiqueta: "Círculo" }, { v: "flecha", etiqueta: "Flecha" }, { v: "ambos", etiqueta: "Los dos" }] }, { clave: "color", tipo: "color", etiqueta: "Color", defecto: "marca.amarillo" }],
    caja(W, H) { return { x: W / 2 - 160, y: H * 0.42 - 120, ancho: 320, alto: 240 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), col = color(p.color, marca), k = sal(t, dur), cx = b.x + b.ancho / 2, cy = b.y + b.alto / 2;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineWidth = 14;
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
      if (p.forma !== "flecha") { const u = facil(t / 0.6); ctx.beginPath(); ctx.ellipse(cx, cy, b.ancho / 2, b.alto / 2, -0.08, -1.7, -1.7 + u * 6.6); ctx.stroke(); }
      if (p.forma !== "circulo") {
        const u = facil((t - (p.forma === "ambos" ? 0.45 : 0)) / 0.35); if (u > 0) {
          const ex = b.x - 30, ey = b.y + b.alto * 0.15, sx = ex - 200, sy = ey - 200, x = lerp(sx, ex, u), y = lerp(sy, ey, u);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke();
          if (u > 0.9) { ctx.beginPath(); ctx.moveTo(ex - 60, ey - 10); ctx.lineTo(ex, ey); ctx.lineTo(ex - 10, ey - 60); ctx.stroke(); }
        }
      }
      ctx.restore();
    },
  });
  // ════ TEXTO ════
  const ESTILOS_TEXTO = { caja: "Caja", contorno: "Contorno", sombra: "Sombra", neon: "Neón", amarillo: "Fondo amarillo" };
  def({
    id: "texto", nombre: "Texto libre", grupo: "texto", descripcion: "Cualquier texto, con estilos", duracion: 4,
    params: [
      { clave: "texto", tipo: "textoLargo", etiqueta: "Texto", defecto: "MIRÁ LO QUE PASÓ" },
      { clave: "estilo", tipo: "opcion", etiqueta: "Estilo", defecto: "caja", opciones: Object.entries(ESTILOS_TEXTO).map(([v, etiqueta]) => ({ v, etiqueta })) },
      { clave: "fuente", tipo: "opcion", etiqueta: "Letra", defecto: "titular", opciones: [{ v: "titular", etiqueta: "Titular" }, { v: "texto", etiqueta: "Normal" }] },
      { clave: "color", tipo: "color", etiqueta: "Color", defecto: "#FFFFFF" },
      { clave: "tamano", tipo: "numero", etiqueta: "Tamaño", defecto: 80, min: 30, max: 180, paso: 2 },
      { clave: "animacion", tipo: "opcion", etiqueta: "Entrada", defecto: "pop", opciones: [{ v: "pop", etiqueta: "Pop" }, { v: "subir", etiqueta: "Subir" }, { v: "maquina", etiqueta: "Máquina de escribir" }, { v: "nada", etiqueta: "Ninguna" }] },
    ],
    caja(W, H) { return { x: W * 0.08, y: H * 0.42, ancho: W * 0.84, alto: 300 }; },
    dibujar(ctx, e) {
      const { t, dur, p, W, H, marca } = e, b = this.caja(W, H), fam = p.fuente === "texto" ? TXT : TIT, peso = p.fuente === "texto" ? 800 : 400;
      let txt = String(p.texto || ""); if (p.animacion === "maquina") txt = txt.slice(0, Math.floor(clamp(t / Math.max(0.6, dur * 0.4), 0, 1) * txt.length));
      const { px, rs } = bloque(ctx, txt, peso, fam, p.tamano || 80, b.ancho, 6, 24), k = (p.animacion === "nada" ? 1 : ent(t, 0.35)) * sal(t, dur), col = color(p.color, marca);
      ctx.save(); ctx.globalAlpha = k; const cx = b.x + b.ancho / 2; ctx.translate(cx, b.y + (p.animacion === "subir" ? (1 - k) * 60 : 0));
      if (p.animacion === "pop") { const s = 0.5 + 0.5 * rebote(Math.min(1, t / 0.4)); ctx.scale(s, s); }
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = f(peso, px, fam);
      rs.forEach((r, i) => {
        const y = i * px * 1.18, w = ctx.measureText(r).width;
        if (p.estilo === "caja" || p.estilo === "amarillo") { ctx.fillStyle = p.estilo === "amarillo" ? marca.amarillo : "rgba(0,0,0,0.78)"; caja(ctx, -w / 2 - 18, y - px * 0.08, w + 36, px * 1.14, 10); ctx.fill(); ctx.fillStyle = p.estilo === "amarillo" ? "#111" : col; ctx.fillText(r, 0, y); }
        else if (p.estilo === "contorno") textoContorno(ctx, r, 0, y, col, "#000", px * 0.16);
        else if (p.estilo === "neon") { ctx.shadowColor = col; ctx.shadowBlur = px * 0.4; ctx.fillStyle = "#fff"; ctx.fillText(r, 0, y); ctx.fillText(r, 0, y); ctx.shadowBlur = 0; }
        else { ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.05; ctx.fillStyle = col; ctx.fillText(r, 0, y); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
      });
      ctx.restore();
    },
  });

  // ════ SUBTÍTULOS (estilos de la pista) ════
  const ESTILOS_SUBS = { "subs-karaoke": "Karaoke amarillo", "subs-caja": "Caja negra", "subs-contorno": "Contorno blanco", "subs-marca": "Banda roja" };
  function dibujarSubtitulos(ctx, pista, t, W, H, marca = EP.MARCA) {
    const c = pista.clips.find((x) => t >= x.inicio && t < x.inicio + x.duracion); if (!c) return;
    const est = pista.estilo || {}, z = zona(W, H), sz = est.tamano || 1, estilo = est.plantilla || "subs-karaoke";
    const cy = est.y != null ? est.y : z.vert ? 1490 : H - 150, ancho = z.vert ? 840 : W * 0.8, cx = z.vert ? 490 : W / 2;
    const pal = c.palabras && c.palabras.length ? c.palabras.map((w) => ({ p: w.p, t0: c.inicio + w.t0, t1: c.inicio + w.t1 })) : String(c.texto || "").split(/\s+/).filter(Boolean).map((p, i, a) => ({ p, t0: c.inicio + (i / a.length) * c.duracion, t1: c.inicio + ((i + 1) / a.length) * c.duracion }));
    const txt = pal.map((x) => x.p).join(" ").toUpperCase(), px = ajustar(ctx, txt, 800, estilo === "subs-caja" ? TXT : TIT, 78 * sz, ancho, 30);
    const fam = estilo === "subs-caja" ? TXT : TIT, peso = estilo === "subs-caja" ? 800 : 400;
    ctx.save(); ctx.font = f(peso, px, fam); ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    const esp = ctx.measureText(" ").width, anchos = pal.map((x) => ctx.measureText(x.p.toUpperCase()).width), total = anchos.reduce((a, b) => a + b, 0) + esp * (pal.length - 1);
    const ap = suave(c.inicio, c.inicio + 0.12, t), s = 0.9 + 0.1 * ap; ctx.globalAlpha = ap;
    ctx.translate(cx, cy); ctx.scale(s, s);
    if (estilo === "subs-caja") { ctx.fillStyle = "rgba(0,0,0,0.78)"; caja(ctx, -total / 2 - 22, -px * 0.72, total + 44, px * 1.44, 12); ctx.fill(); }
    if (estilo === "subs-marca") { ctx.fillStyle = marca.rojo; caja(ctx, -total / 2 - 22, -px * 0.72, total + 44, px * 1.44, 6); ctx.fill(); }
    let x = -total / 2;
    pal.forEach((w, i) => {
      const activa = t >= w.t0 && t < w.t1 + 0.05, txtW = w.p.toUpperCase();
      ctx.save(); ctx.translate(x + anchos[i] / 2, 0);
      if (estilo === "subs-karaoke" && activa) ctx.scale(1.08, 1.08);
      ctx.textAlign = "center";
      if (estilo === "subs-karaoke" || estilo === "subs-contorno") { ctx.lineWidth = px * 0.2; ctx.strokeStyle = "#000"; ctx.strokeText(txtW, 0, 0); }
      ctx.fillStyle = estilo === "subs-karaoke" ? (activa ? marca.amarillo : "#fff") : estilo === "subs-marca" ? "#fff" : "#fff";
      ctx.fillText(txtW, 0, 0); ctx.restore(); x += anchos[i] + esp;
    });
    ctx.restore();
  }

  // ════ API ════
  const porIdMapa = Object.fromEntries(lista.map((p) => [p.id, p]));
  function resolver(pl, params, marca) {
    const p = {};
    for (const d of pl.params) { let v = params && params[d.clave] !== undefined && params[d.clave] !== "" ? params[d.clave] : d.defecto; if (d.clave === "usuario" && !v) v = marca.usuario; p[d.clave] = v; }
    return p;
  }
  function cajaClip(clip, W, H, marca = EP.MARCA) {
    const pl = porIdMapa[clip.plantilla]; if (!pl) return { x: 0, y: 0, ancho: 10, alto: 10 };
    const b = pl.caja(W, H, resolver(pl, clip.params, marca)), c = clip.caja || {}, s = c.escala || 1;
    const cx = b.x + b.ancho / 2 + (c.x || 0), cy = b.y + b.alto / 2 + (c.y || 0);
    return { x: cx - (b.ancho * s) / 2, y: cy - (b.alto * s) / 2, ancho: b.ancho * s, alto: b.alto * s };
  }
  function dibujarClip(ctx, clip, t, W, H, rec = {}) {
    const pl = porIdMapa[clip.plantilla]; if (!pl) return;
    const marca = rec.marca || EP.MARCA, p = resolver(pl, clip.params, marca), b = pl.caja(W, H, p), c = clip.caja || {}, s = c.escala || 1;
    ctx.save();
    if (c.x || c.y || s !== 1 || c.rot) { const cx = b.x + b.ancho / 2, cy = b.y + b.alto / 2; ctx.translate(cx + (c.x || 0), cy + (c.y || 0)); if (c.rot) ctx.rotate(c.rot); ctx.scale(s, s); ctx.translate(-cx, -cy); }
    try { pl.dibujar(ctx, { t: t - clip.inicio, dur: clip.duracion, p, W, H, marca, rec }); } catch (e) { console.warn("plantilla", clip.plantilla, e); }
    ctx.restore();
  }
  let recursos = null;
  function cargarRecursos(marca) {
    if (recursos) return recursos;
    recursos = (async () => {
      try { await Promise.all([document.fonts.load('400 60px "Anton"'), document.fonts.load('700 40px "Barlow Condensed"'), document.fonts.load('800 40px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow Condensed"')]); } catch (e) { /* sin internet: letras de respaldo */ }
      let img = null; try { img = new Image(); img.src = LOGO_B64; await img.decode(); } catch (e) { img = null; }
      return { logo: img, logos: { "logo-papuchon": img } };
    })();
    return recursos;
  }
  return {
    lista, porId: (i) => porIdMapa[i], dibujarClip, cajaClip, cargarRecursos, dibujarSubtitulos, resolver, ESTILOS_SUBS,
    GRUPOS: { marca: "Marca", zocalos: "Zócalos", placas: "Placas", titulares: "Titulares", info: "Datos", redes: "Redes", resaltar: "Resaltar", texto: "Texto" },
    sol, zona,
  };
})();
