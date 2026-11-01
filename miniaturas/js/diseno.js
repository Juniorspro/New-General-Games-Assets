"use strict";
// ════════════════════════════════════════════════════════════════════════
// Diseño: arma la miniatura en un canvas. Capas, de abajo hacia arriba:
// fondo (lo que dibujó la IA, con más color y contraste) → persona recortada
// con borde → elementos (flechas, círculos, sellos…) → textos grandes.
// El texto lo pone el diseño y no la IA: así sale siempre legible, con tildes
// y en la tipografía elegida. Las posiciones van de 0 a 1 (sirven para
// cualquier formato) y los tamaños, en proporción al alto.
// ════════════════════════════════════════════════════════════════════════
const Diseno = (() => {
  const FUENTES = {
    Anton: '"Anton", Impact, "Arial Narrow", sans-serif',
    "Bebas Neue": '"Bebas Neue", Impact, sans-serif',
    Bangers: '"Bangers", Impact, cursive',
    "Luckiest Guy": '"Luckiest Guy", Impact, cursive',
    "Archivo Black": '"Archivo Black", "Arial Black", sans-serif',
  };
  const DISENOS = {
    auto: { nombre: "Automático" }, grito: { nombre: "Texto y persona" }, noticia: { nombre: "Noticia" },
    misterio: { nombre: "Misterio" }, top: { nombre: "Ranking" }, cine: { nombre: "Cine" }, limpio: { nombre: "Sin texto" },
  };
  const ELEMENTOS = {
    flecha: "Flecha", circulo: "Círculo", sello: "Sello", etiqueta: "Etiqueta", numero: "Número", emoji: "Emoji", rayos: "Explosión", logo: "Logo del canal",
  };
  const PALETAS = {
    auto: ["#0b1d3a", "#1f4e8c", "#ff8a00"], realista: ["#0b1d3a", "#1f4e8c", "#ff8a00"], cine: ["#05131a", "#0f5d6e", "#ff9b42"],
    noticiero: ["#1a0003", "#b3001b", "#ffc21a"], vibrante: ["#ff004c", "#ff8a00", "#ffe600"], anime: ["#2b0a5e", "#ff4fa3", "#3de0ff"],
    dibujo: ["#0090e0", "#ffd500", "#ff3d3d"], "3d": ["#3a1c71", "#d76d77", "#ffaf7b"], terror: ["#000000", "#3b0000", "#c40000"], gamer: ["#0a0026", "#6a00ff", "#00ffd0"],
  };
  const filtroOK = (() => { try { const c = document.createElement("canvas").getContext("2d"); c.filter = "blur(1px)"; return c.filter === "blur(1px)"; } catch (e) { return false; } })();

  // ── Fondo sin IA: degradé, rayos, luces y grano, con los colores del estilo ──
  function fondoLocal(W, H, estilo, semilla) {
    const [a, b, c] = PALETAS[estilo] || PALETAS.auto, r = azar(semilla || 7);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, H, W, 0); gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, a); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const fx = W * (0.55 + r() * 0.25), fy = H * (0.35 + r() * 0.2), R = Math.hypot(W, H);
    g.save(); g.translate(fx, fy); g.globalAlpha = 0.16; g.fillStyle = c;
    const n = 18 + Math.floor(r() * 10);
    for (let i = 0; i < n; i += 2) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fill(); }
    g.restore();
    const luz = g.createRadialGradient(fx, fy, 0, fx, fy, Math.min(W, H) * 0.7); luz.addColorStop(0, c + "cc"); luz.addColorStop(1, c + "00"); g.fillStyle = luz; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rr = (0.01 + r() * 0.05) * Math.min(W, H); g.globalAlpha = 0.08 + r() * 0.18; g.fillStyle = r() > 0.5 ? c : "#ffffff"; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // Grano: un mosaico de ruido chico estirado (barato y le saca lo "plástico").
    const ru = document.createElement("canvas"); ru.width = ru.height = 128; const rg = ru.getContext("2d"), d = rg.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 18; }
    rg.putImageData(d, 0, 0); g.fillStyle = g.createPattern(ru, "repeat"); g.fillRect(0, 0, W, H);
    return cv;
  }

  // ── Diseños: dónde va cada cosa según el formato ──
  function elegirAuto(p) {
    const t = (p.es || "") + " " + (p.estilo || "");
    if (p.estilo === "noticiero" || /últim|ultim|urgente|noticia|corte|vecinos|concejo|ruta|polic|choque|accidente/i.test(t)) return "noticia";
    if (p.estilo === "terror" || /misterio|fantasma|extraño|extrano|ovni|miedo|qué es|que es|secreto/i.test(t)) return "misterio";
    if (/\btop\b|ranking|mejores|peores|\b\d+\s+(cosas|lugares|formas|trucos)/i.test(t)) return "top";
    if (p.estilo === "cine") return "cine";
    return "grito";
  }
  const texto = (o) => ({ id: id("x"), texto: "", fuente: "Anton", color: "#FFFFFF", resalte: MP.MARCA.amarillo, contorno: "#000000", grosor: 0.13, caja: "", x: 0.05, y: 0.5, ancho: 0.6, tam: 0.2, rot: -2, alinear: "left", ...o });
  const elem = (tipo, o) => ({ id: id("e"), tipo, x: 0.5, y: 0.5, escala: 1, rot: 0, color: MP.MARCA.rojo, texto: "", ...o });
  // Arma (o rearma) la miniatura según el diseño. No toca el fondo ni la foto elegida.
  function aplicar(c, disenoPedido, titulo) {
    const f = MP.FORMATOS[c.formato] || MP.FORMATOS.youtube, vert = f.alto / f.ancho > 1.2, cuad = !vert && f.ancho / f.alto < 1.3;
    const dis = disenoPedido === "auto" ? elegirAuto(c.pedido) : disenoPedido, hayP = !!(c.persona && c.persona.img);
    const T = titulo != null ? titulo : (c.textos[0] && c.textos[0].texto) || "";
    c.diseno = dis; c.textos = []; c.elementos = [];
    // Dónde va el logo para que no se corte con el borde (su ancho depende del formato).
    const medioLogo = (esc) => (0.25 * esc * 1.5 * Math.min(f.ancho, f.alto)) / (2 * f.ancho);
    const logoIzq = (esc) => 0.03 + medioLogo(esc), logoDer = (esc) => 0.97 - medioLogo(esc);
    c.fondo = { ...c.fondo, oscurecer: 0.18, saturacion: 1.25, contraste: 1.12, brillo: 1.04 };
    if (hayP) Object.assign(c.persona, vert ? { x: 0.5, y: 1, alto: 0.6 } : cuad ? { x: 0.7, y: 1, alto: 0.8 } : { x: 0.77, y: 1, alto: 0.97 });
    const ancho = vert ? 0.9 : hayP ? (cuad ? 0.56 : 0.58) : 0.9;
    if (dis === "grito") {
      c.textos.push(texto(vert ? { texto: T, x: 0.5, y: 0.22, ancho: 0.9, tam: 0.09, alinear: "center", rot: -2 } : { texto: T, x: hayP ? 0.04 : 0.5, y: 0.5, ancho, tam: cuad ? 0.17 : 0.22, alinear: hayP ? "left" : "center", rot: -3 }));
      if (!hayP && !vert) c.elementos.push(elem("emoji", { x: 0.1, y: 0.2, escala: 0.75, texto: "😱", rot: -10 }));
    } else if (dis === "noticia") {
      c.elementos.push(elem("logo", vert ? { x: logoIzq(0.9), y: 0.08, escala: 0.9 } : { x: logoIzq(0.75), y: cuad ? 0.1 : 0.13, escala: 0.75 }));
      c.elementos.push(elem("etiqueta", vert ? { x: 0.08, y: 0.6, escala: 0.9, texto: "ÚLTIMO MOMENTO", color: MP.MARCA.amarillo } : { x: 0.04, y: 0.62, escala: 0.8, texto: "ÚLTIMO MOMENTO", color: MP.MARCA.amarillo }));
      c.textos.push(texto(vert ? { texto: T, x: 0.06, y: 0.7, ancho: 0.88, tam: 0.065, caja: MP.MARCA.rojo, grosor: 0, rot: 0 } : { texto: T, x: 0.04, y: 0.8, ancho: hayP ? 0.62 : 0.9, tam: 0.12, caja: MP.MARCA.rojo, grosor: 0, rot: 0 }));
    } else if (dis === "misterio") {
      c.fondo.oscurecer = 0.45;
      c.textos.push(texto({ texto: T, x: 0.5, y: vert ? 0.16 : 0.15, ancho: 0.92, tam: vert ? 0.075 : 0.15, alinear: "center", rot: 0, color: MP.MARCA.amarillo, resalte: "#FFFFFF" }));
      c.elementos.push(elem("circulo", vert ? { x: 0.62, y: 0.45, escala: 1.1 } : { x: hayP ? 0.42 : 0.66, y: 0.56, escala: 1 }));
      c.elementos.push(elem("flecha", vert ? { x: 0.3, y: 0.32, escala: 1, rot: 40 } : { x: hayP ? 0.2 : 0.42, y: 0.42, escala: 1, rot: 20 }));
      if (hayP) Object.assign(c.persona, vert ? { x: 0.5, y: 1, alto: 0.55 } : { x: 0.82, y: 1, alto: 0.9 });
    } else if (dis === "top") {
      const num = (T.match(/\d+/) || [])[0];
      c.elementos.push(elem("numero", vert ? { x: 0.5, y: 0.16, escala: 1.2, texto: num ? "TOP " + num : "TOP" } : { x: 0.16, y: 0.5, escala: 1.25, texto: num ? "#" + num : "TOP", color: MP.MARCA.amarillo }));
      c.textos.push(texto(vert ? { texto: T, x: 0.5, y: 0.34, ancho: 0.9, tam: 0.075, alinear: "center", rot: 0 } : { texto: T, x: 0.32, y: 0.5, ancho: hayP ? 0.4 : 0.64, tam: 0.18, rot: -2 }));
    } else if (dis === "cine") {
      c.elementos.push(elem("franjas", { x: 0.5, y: 0.5 }));
      c.textos.push(texto({ texto: T, fuente: "Bebas Neue", x: 0.5, y: vert ? 0.78 : 0.79, ancho: 0.86, tam: vert ? 0.075 : 0.15, alinear: "center", rot: 0, grosor: 0.02, contorno: "#000000" }));
      c.fondo.oscurecer = 0.25; c.fondo.saturacion = 1.1;
    }
    if (c.marca && c.marca.logo && dis !== "noticia") c.elementos.push(elem("logo", vert ? { x: logoDer(0.6), y: 0.07, escala: 0.6 } : { x: logoDer(0.55), y: cuad ? 0.08 : 0.1, escala: 0.55 }));
    return c;
  }
  function nueva(pedido, formato) {
    return {
      id: id("m"), creada: Date.now(), editada: Date.now(), formato, pedido: { ...pedido }, diseno: pedido.diseno,
      fondo: { img: null, motor: null, zoom: 1, x: 0.5, y: 0.5, brillo: 1.04, contraste: 1.12, saturacion: 1.25, oscurecer: 0.18 },
      persona: null, textos: [], elementos: [], marca: { logo: !!pedido.logo },
    };
  }

  // ── Dibujo ──
  // "¡SE PRENDIÓ *FUEGO*!" → palabras con su color; el "!" pegado a FUEGO va sin espacio.
  function partes(t) {
    const r = []; let pegar = false;
    String(t || "").split(/(\*[^*]+\*)/).forEach((s) => {
      if (!s) return; const hl = s.length > 2 && s.startsWith("*") && s.endsWith("*"), cuerpo = hl ? s.slice(1, -1) : s;
      const empiezaPegado = !/^\s/.test(cuerpo);
      cuerpo.split(/\s+/).filter(Boolean).forEach((p, i) => { r.push({ p, hl, pegado: i === 0 && empiezaPegado && pegar && r.length > 0 }); });
      pegar = !/\s$/.test(cuerpo);
    });
    return r;
  }
  function renglones(ctx, palabras, ancho) {
    const out = []; let r = [], w = 0; const esp = ctx.measureText(" ").width;
    for (const x of palabras) {
      const pw = ctx.measureText(x.p).width, sep = x.pegado ? 0 : esp;
      if (r.length && !x.pegado && w + sep + pw > ancho) { out.push(r); r = []; w = 0; }
      w += (r.length ? sep : 0) + pw; r.push({ ...x, w: pw });
    }
    if (r.length) out.push(r); return out;
  }
  function dibujarTexto(ctx, tx, W, H, cajas) {
    const pal = partes(tx.texto); if (!pal.length) return;
    const fam = FUENTES[tx.fuente] || FUENTES.Anton, maxW = tx.ancho * W;
    let px = tx.tam * H, lineas;
    for (let i = 0; i < 40; i++) { ctx.font = `400 ${px}px ${fam}`; lineas = renglones(ctx, pal, maxW); if (lineas.length <= 3 && lineas.every((l) => l.reduce((s, x) => s + x.w, 0) <= maxW * 1.001)) break; px *= 0.93; }
    const esp = ctx.measureText(" ").width, lh = px * (tx.fuente === "Bangers" || tx.fuente === "Luckiest Guy" ? 1.08 : 1.0), totalH = lineas.length * lh;
    const ox = tx.x * W, oy = tx.y * H, anchos = lineas.map((l) => l.reduce((s, x, i) => s + x.w + (i && !x.pegado ? esp : 0), 0)), mx = Math.max(...anchos);
    const izq = (w) => (tx.alinear === "center" ? -w / 2 : tx.alinear === "right" ? -w : 0);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(((tx.rot || 0) * Math.PI) / 180);
    ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
    const y0 = -totalH / 2 + lh / 2;
    // Caja detrás de cada renglón (estilo zócalo).
    if (tx.caja) lineas.forEach((l, i) => { const w = anchos[i], x = izq(w), p = px * 0.16; ctx.fillStyle = tx.caja; ctx.fillRect(x - p, y0 + i * lh - lh / 2 - p * 0.25, w + p * 2, lh + p * 0.3); });
    const pasada = (fn) => lineas.forEach((l, i) => { let x = izq(anchos[i]); l.forEach((w, j) => { if (j && !w.pegado) x += esp; fn(w, x, y0 + i * lh); x += w.w; }); });
    if (tx.grosor > 0) {
      ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = px * 0.1; ctx.shadowOffsetY = px * 0.06;
      ctx.lineWidth = px * tx.grosor * 2; ctx.strokeStyle = tx.contorno || "#000"; pasada((w, x, y) => ctx.strokeText(w.p, x, y));
      ctx.shadowColor = "transparent";
    } else if (!tx.caja) { ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = px * 0.12; ctx.shadowOffsetY = px * 0.04; }
    pasada((w, x, y) => { ctx.fillStyle = w.hl ? tx.resalte || MP.MARCA.amarillo : tx.color; ctx.fillText(w.p, x, y); });
    ctx.restore();
    cajas.push({ tipo: "texto", id: tx.id, x: ox + izq(mx) - px * 0.2, y: oy - totalH / 2 - px * 0.15, w: mx + px * 0.4, h: totalH + px * 0.3 });
  }
  // Silueta de color (para el borde de la persona), guardada por imagen y color.
  const siluetas = new WeakMap();
  function silueta(img, colorB) {
    let m = siluetas.get(img); if (!m) { m = {}; siluetas.set(img, m); }
    if (m[colorB]) return m[colorB];
    const c = document.createElement("canvas"); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = colorB; g.fillRect(0, 0, c.width, c.height);
    return (m[colorB] = c);
  }
  function dibujarPersona(ctx, p, img, W, H, cajas) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, h = p.alto * H, w = (h * iw) / ih;
    const x = p.x * W - w / 2, y = p.y * H - h;
    ctx.save();
    if (p.espejo) { ctx.translate(p.x * W, 0); ctx.scale(-1, 1); ctx.translate(-p.x * W, 0); }
    if (p.recuadro) {   // foto sin recortar: en un recuadro con borde
      const b = H * 0.012; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = H * 0.03; ctx.fillStyle = p.colorBorde || "#fff"; ctx.fillRect(x - b, y - b, w + 2 * b, h + 2 * b); ctx.shadowColor = "transparent"; ctx.drawImage(img, x, y, w, h);
    } else {
      const b = (p.borde ?? 0.012) * H, sil = silueta(img, p.colorBorde || "#FFFFFF");
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = H * 0.035; ctx.shadowOffsetY = H * 0.01;
      if (b > 0) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.drawImage(sil, x + Math.cos(a) * b, y + Math.sin(a) * b, w, h); }
      ctx.shadowColor = "transparent";
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
    cajas.push({ tipo: "persona", id: "persona", x, y, w, h });
  }
  function dibujarElemento(ctx, e, W, H, rec, cajas) {
    const M = Math.min(W, H), s = M * 0.25 * (e.escala || 1), x = e.x * W, y = e.y * H;
    ctx.save(); ctx.translate(x, y); ctx.rotate(((e.rot || 0) * Math.PI) / 180);
    let cw = s, ch = s;
    if (e.tipo === "flecha") {
      const L = s * 1.6, t = s * 0.2;   // flecha gruesa curva, con borde blanco
      const cam = () => { ctx.beginPath(); ctx.moveTo(-L / 2, t * 0.4); ctx.quadraticCurveTo(-L * 0.05, -L * 0.18, L * 0.22, -t * 0.2); ctx.lineTo(L * 0.22, -t * 1.6); ctx.lineTo(L / 2, t * 0.35); ctx.lineTo(L * 0.22, t * 2.0); ctx.lineTo(L * 0.22, t * 1.0); ctx.quadraticCurveTo(-L * 0.08, t * 0.2, -L / 2, t * 1.6); ctx.closePath(); };
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = s * 0.12; cam(); ctx.lineJoin = "round"; ctx.lineWidth = s * 0.07; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.shadowColor = "transparent"; ctx.fillStyle = e.color; ctx.fill();
      cw = L; ch = s * 0.8;
    } else if (e.tipo === "circulo") {
      const r = s * 0.85; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = s * 0.1;
      ctx.lineWidth = s * 0.17; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.shadowColor = "transparent";
      ctx.lineWidth = s * 0.1; ctx.strokeStyle = e.color; ctx.stroke(); cw = ch = r * 2.2;
    } else if (e.tipo === "sello") {
      const tx = (e.texto || "EXCLUSIVO").toUpperCase(); ctx.font = `400 ${s * 0.42}px ${FUENTES.Anton}`; const w = ctx.measureText(tx).width + s * 0.5, h = s * 0.66;
      ctx.lineWidth = s * 0.06; ctx.strokeStyle = e.color; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.lineWidth = s * 0.025; ctx.strokeRect(-w / 2 + s * 0.07, -h / 2 + s * 0.07, w - s * 0.14, h - s * 0.14);
      ctx.fillStyle = e.color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tx, 0, s * 0.02); cw = w; ch = h;
    } else if (e.tipo === "etiqueta") {
      const tx = (e.texto || "EN VIVO").toUpperCase(); ctx.font = `400 ${s * 0.3}px ${FUENTES.Anton}`; const w = ctx.measureText(tx).width + s * 0.36, h = s * 0.46;
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, -h / 2, w, h, h * 0.2) : ctx.rect(0, -h / 2, w, h); ctx.fill();
      ctx.fillStyle = esClaro(e.color) ? "#111" : "#fff"; ctx.textBaseline = "middle"; ctx.fillText(tx, s * 0.18, s * 0.02);
      ctx.restore(); cajas.push({ tipo: "elemento", id: e.id, x, y: y - h / 2, w, h }); return;
    } else if (e.tipo === "numero") {
      const r = s * 0.62, tx = e.texto || "#1"; ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = s * 0.12;
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowColor = "transparent"; ctx.lineWidth = s * 0.06; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.font = `400 ${(r * 1.1) / Math.max(1, tx.length * 0.38)}px ${FUENTES.Anton}`; ctx.fillStyle = esClaro(e.color) ? "#111" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tx, 0, r * 0.04);
      cw = ch = r * 2;
    } else if (e.tipo === "emoji") {
      ctx.font = `${s * 0.9}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = s * 0.1; ctx.fillText(e.texto || "😱", 0, 0);
    } else if (e.tipo === "rayos") {
      const n = 14, R = s * 0.9, r0 = s * 0.55; ctx.beginPath();
      for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r0 : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = e.color; ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = s * 0.1; ctx.fill(); ctx.lineWidth = s * 0.04; ctx.strokeStyle = "#000"; ctx.stroke();
      if (e.texto) { ctx.shadowColor = "transparent"; ctx.font = `400 ${s * 0.32}px ${FUENTES.Anton}`; ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e.texto.toUpperCase(), 0, 0); }
      cw = ch = R * 2;
    } else if (e.tipo === "logo" && rec.logo) {
      const w = s * 1.5, h = (w * rec.logo.height) / rec.logo.width; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = s * 0.08; ctx.drawImage(rec.logo, -w / 2, -h / 2, w, h); cw = w; ch = h;
    } else if (e.tipo === "franjas") {
      ctx.restore(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H * 0.11); ctx.fillRect(0, H * 0.89, W, H * 0.11); return;
    }
    ctx.restore();
    cajas.push({ tipo: "elemento", id: e.id, x: x - cw / 2, y: y - ch / 2, w: cw, h: ch });
  }
  function esClaro(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; }
  function dibujarFondo(ctx, f, img, W, H) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(W / iw, H / ih) * (f.zoom || 1), w = iw * k, h = ih * k;
    // (f.x, f.y) es el punto de la imagen que queda en el centro; sin dejar bordes vacíos.
    const x = clamp(W / 2 - (f.x ?? 0.5) * w, W - w, 0), y = clamp(H / 2 - (f.y ?? 0.5) * h, H - h, 0);
    ctx.save();
    if (filtroOK) ctx.filter = `brightness(${f.brillo || 1}) contrast(${f.contraste || 1}) saturate(${f.saturacion || 1})`;
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, x, y, w, h); ctx.restore();
    if (f.oscurecer > 0) { const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, f.oscurecer * 2)})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
  }
  // rec: { imgs: Map(id → imagen), logo }. Devuelve las cajas de lo que se puede tocar.
  function dibujar(ctx, c, W, H, rec, op = {}) {
    const cajas = [];
    ctx.save(); ctx.clearRect(0, 0, W, H);
    const fimg = c.fondo.img && rec.imgs.get(c.fondo.img);
    if (fimg) dibujarFondo(ctx, c.fondo, fimg, W, H);
    else { ctx.drawImage(fondoLocal(Math.max(2, Math.round(W / 4)), Math.max(2, Math.round(H / 4)), c.pedido.estilo, (c.pedido.semilla || 1) + 3), 0, 0, W, H); }
    const franjas = c.elementos.filter((e) => e.tipo === "franjas"), atras = c.elementos.filter((e) => e.tipo === "rayos"), resto = c.elementos.filter((e) => e.tipo !== "rayos" && e.tipo !== "franjas");
    for (const e of atras) dibujarElemento(ctx, e, W, H, rec, cajas);
    const pimg = c.persona && c.persona.img && rec.imgs.get(c.persona.img);
    if (pimg) dibujarPersona(ctx, c.persona, pimg, W, H, cajas);
    for (const e of franjas) dibujarElemento(ctx, e, W, H, rec, cajas);
    for (const e of resto) dibujarElemento(ctx, e, W, H, rec, cajas);
    for (const t of c.textos) dibujarTexto(ctx, t, W, H, cajas);
    if (op.marcar) { const k = cajas.find((x) => x.id === op.marcar); if (k) { ctx.strokeStyle = MP.MARCA.amarillo; ctx.lineWidth = Math.max(2, W / 400); ctx.setLineDash([W / 80, W / 120]); ctx.strokeRect(k.x, k.y, k.w, k.h); } }
    ctx.restore();
    return cajas;
  }
  let letras = null;
  function listo() {
    if (!letras) letras = Promise.all(Object.keys(FUENTES).map((f) => document.fonts.load(`400 40px "${f}"`).catch(() => null))).then(() => true);
    return letras;
  }
  return { FUENTES, DISENOS, ELEMENTOS, PALETAS, fondoLocal, aplicar, nueva, dibujar, listo, elegirAuto, elem, texto };
})();
