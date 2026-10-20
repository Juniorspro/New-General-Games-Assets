"use strict";
// ════════════════════════════════════════════════════════════════════════
// Motores de imagen y la fábrica que los reparte, todo solo:
//   Rezona (la mejor, gasta créditos; solo desde la app de Android)
//   → AI Horde (gratis y sin límite; voluntarios, a veces con cola)
//   → Hugging Face (gratis con cuota diaria por conexión)
//   → Pollinations (gratis, 1 cada 45 s por conexión; rápido, menos detalle)
//   → Diseño sin IA (siempre anda, aun sin internet).
// Si uno falla, se queda sin créditos o hay mucha cola, la imagen pasa al
// siguiente sin que nadie toque nada. Si Horde tiene cola larga, mientras
// tanto se muestra una de Pollinations y después se cambia por la mejor.
// ════════════════════════════════════════════════════════════════════════
const Motores = (() => {
  const INFO = {
    rezona: { nombre: "Rezona", detalle: "La mejor calidad. Gasta créditos de Rezona, con tope por día.", calidad: 5, max: 3 },
    horde: { nombre: "AI Horde", detalle: "Gratis y sin límite (computadoras de voluntarios). A veces hay cola.", calidad: 4, max: 2 },
    hf: { nombre: "Hugging Face", detalle: "Gratis con una cuota diaria por conexión. Rápido cuando hay cuota.", calidad: 4, max: 1 },
    pollinations: { nombre: "Pollinations", detalle: "Gratis, una imagen cada 45 s por conexión. Rápido, menos detalle.", calidad: 2, max: 1 },
    local: { nombre: "Diseño sin IA", detalle: "Siempre anda, aun sin internet: fondos con los colores del estilo.", calidad: 1, max: 9 },
  };
  const estado = Object.fromEntries(Object.keys(INFO).map((k) => [k, { ocupados: 0, enfriarHasta: leerLS("enfriar-" + k, 0), motivo: "", hechas: leerLS("hechas-" + k, 0) }]));
  const oyentes = new Set(); const avisar = () => { for (const f of oyentes) f(); };
  function enfriar(k, seg, motivo) { estado[k].enfriarHasta = Date.now() + seg * 1000; estado[k].motivo = motivo; guardarLS("enfriar-" + k, estado[k].enfriarHasta); avisar(); }
  function contar(k) { estado[k].hechas++; guardarLS("hechas-" + k, estado[k].hechas); }
  const apagados = () => leerLS("apagados", []);
  function disponible(k) {
    if (apagados().includes(k)) return false;
    if (k === "rezona") return Plataforma.rezona && !rezonaTopeAlcanzado();
    if (k !== "local" && !navigator.onLine) return false;
    return Date.now() >= estado[k].enfriarHasta;
  }
  class Falla extends Error { constructor(msg, extra = {}) { super(msg); Object.assign(this, extra); } }
  const proporcion = (p) => p.ancho / p.alto;
  // Tamaño a pedir a cada motor según la proporción final (múltiplos de 64 para los de difusión).
  function medida(p, tabla) { const r = proporcion(p); return tabla.reduce((a, b) => (Math.abs(b[0] / b[1] - r) < Math.abs(a[0] / a[1] - r) ? b : a)); }

  // ═══ Rezona (por el puente de Java: la llave nunca pasa por la página) ═══
  const pendientesRz = new Map(); let nRz = 0;
  window.__rz = (id, codigo, texto) => { const f = pendientesRz.get(id); if (!f) return; pendientesRz.delete(id); let j = null; try { j = JSON.parse(texto); } catch (e) { /* no JSON */ } f({ codigo, json: j || {}, texto }); };
  function rz(metodo, ruta, cuerpo) {
    return new Promise((ok) => { const k = "r" + ++nRz; pendientesRz.set(k, ok); window.AndroidPapuchon.rezonaPedir(k, metodo, ruta, cuerpo ? JSON.stringify(cuerpo) : ""); });
  }
  function rezonaTope() { try { return JSON.parse(window.AndroidPapuchon.rezonaTope()); } catch (e) { return { usados: 0, tope: 0 }; } }
  function rezonaTopeAlcanzado() { const t = rezonaTope(); return t.tope > 0 && t.usados >= t.tope; }
  const TRANSITORIOS = ["CREDIT_RESERVE_FAILED", "GENERATION_RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "GENERATION_TOO_MANY_IN_FLIGHT"];
  async function proyectoRz() {
    let pr = leerLS("rz-proyecto", null); if (pr && pr.id && pr.ref) return pr;
    const c = await rz("POST", "/api/projects", { name: "miniaturas-papuchon-papa" });
    const d = (c.json && c.json.data) || {}; if (!d.id) throw new Falla("Rezona no creó el proyecto (" + c.codigo + ")");
    const g = await rz("GET", "/api/projects/" + d.id); const ref = ((g.json && g.json.data) || {}).public_id || d.public_id;
    pr = { id: d.id, ref }; guardarLS("rz-proyecto", pr); return pr;
  }
  async function saldoRezona() {
    if (!Plataforma.rezona) return null;
    const r = await rz("GET", "/api/credits/pat-balance"); const d = r.json && r.json.data;
    return d ? { saldo: d.balance, gastable: d.spendable } : null;
  }
  async function genRezona(p, ctl) {
    const pr = await proyectoRz();
    const [w, h] = medida(p, [[1280, 720], [720, 1280], [1024, 1024], [1024, 1280]]);
    const cuerpo = { type: "image", output_path: "assets/m-" + Date.now().toString(36) + p.semilla % 1000 + ".png", image: { prompt: p.promptRico, size: w + "x" + h, n: 1 } };
    let env = null;
    for (const espera of [0, 8, 20, 45]) {
      if (espera) { ctl.estado(`Rezona ocupado, reintento en ${espera} s`); await esperar(espera * 1000, ctl.senal); }
      const r = await rz("POST", `/api/projects/${pr.id}/generations`, cuerpo);
      if (r.codigo === 402) { enfriar("rezona", 6 * 3600, "sin créditos"); throw new Falla("Rezona sin créditos", { siguiente: true }); }
      if (r.json && r.json.code === "TOPE_DIARIO") { enfriar("rezona", 3600, "tope del día"); throw new Falla("Tope del día de Rezona", { siguiente: true }); }
      if (r.json && r.json.success) { env = r.json.data; break; }
      if (!(r.json && TRANSITORIOS.includes(r.json.code))) throw new Falla("Rezona: " + ((r.json && (r.json.code || r.json.message)) || r.codigo));
    }
    if (!env) throw new Falla("Rezona no tomó el pedido");
    const t0 = Date.now(), salida = env.output_path || cuerpo.output_path;
    while (Date.now() - t0 < 5 * 60000) {
      await esperar(4000, ctl.senal);
      const s = await rz("POST", "/api/generations/status", { task_ids: [env.task_id] });
      const it = (((s.json && s.json.data) || {}).items || [])[0] || {};
      ctl.estado(`Rezona ${it.status === "generating" ? "dibujando" : "en cola"} · ${Math.round((Date.now() - t0) / 1000)} s`, { avance: it.progress });
      if (["ready", "succeeded", "success", "completed", "done"].includes(it.status)) {
        const res = await fetch("/rz-pv/" + pr.ref + "/" + (it.asset_path || salida));   // la app lo trae de Rezona (mismo origen: se puede exportar)
        if (!res.ok) throw new Falla("No se pudo bajar la imagen de Rezona");
        return { blob: await res.blob() };
      }
      if (it.status && !["pending", "queued", "running", "processing", "generating"].includes(it.status)) throw new Falla("Rezona: " + it.status + " " + (it.error || ""));
    }
    throw new Falla("Rezona tardó demasiado");
  }

  // ═══ AI Horde (anónimo: apikey de ceros) ═══
  const HORDE = "https://aihorde.net/api/v2", CABE = { apikey: "0000000000", "Client-Agent": "miniaturas-papuchon:1.0:noticias-el-papuchon", "Content-Type": "application/json" };
  // Modelos comunes (SD 1.5): sin cuenta, Horde los atiende mucho antes que a los XL (más baratos en "kudos").
  const MODELOS = {
    foto: ["Deliberate", "AbsoluteReality", "Realistic Vision", "ICBINP - I Can't Believe It's Not Photography", "Photon", "Dreamshaper", "stable_diffusion"],
    anime: ["Anything Diffusion", "Counterfeit", "Rev Animated", "Dreamshaper"],
    dibujo: ["Rev Animated", "Dreamshaper", "ToonYou", "Deliberate"],
  };
  const PROHIBIDO = /nsfw|pony|hentai|furry|porn|lewd/i;
  let modelosCache = null, modelosHora = 0;
  async function elegirModelo(estilo) {
    if (!modelosCache || Date.now() - modelosHora > 90000) {
      const r = await fetch(HORDE + "/status/models?type=image"); modelosCache = await r.json(); modelosHora = Date.now();
    }
    const lista = MODELOS[estilo === "anime" ? "anime" : ["dibujo", "3d", "gamer"].includes(estilo) ? "dibujo" : "foto"];
    const vivos = modelosCache.filter((m) => lista.includes(m.name) && m.count > 0 && !PROHIBIDO.test(m.name));
    if (!vivos.length) throw new Falla("Horde sin máquinas para este estilo", { siguiente: true });
    vivos.sort((a, b) => (a.eta || 0) - (b.eta || 0) || b.count - a.count);   // el que menos espera
    return vivos[0].name;
  }
  async function genHorde(p, ctl) {
    const modelo = await elegirModelo(p.estilo);
    // Sin cuenta el límite cambia con la demanda (760×760, 642×642…): se arranca seguro y,
    // si igual lo rechaza, se lee el límite del mensaje y se achica.
    let [w, h] = medida(p, [[768, 448], [448, 768], [576, 576], [512, 640]]);
    const cuerpo = {
      prompt: p.promptEn + " ### " + Textos.NEGATIVO,
      params: { sampler_name: "k_euler_a", cfg_scale: 6.5, steps: 20, width: w, height: h, n: 1, karras: true, seed: String(p.semilla) },
      nsfw: false, censor_nsfw: true, models: [modelo], r2: true, shared: false, slow_workers: true, trusted_workers: false,
    };
    let r, j;
    for (let intento = 0; intento < 3; intento++) {
      r = await fetch(HORDE + "/generate/async", { method: "POST", headers: CABE, body: JSON.stringify(cuerpo) });
      j = await r.json().catch(() => ({}));
      const lim = /over (\d+)x(\d+)/.exec(j.message || "");
      if (!j.id && /kudos/i.test(j.message || "")) {
        const maxPx = lim ? +lim[1] * +lim[2] : cuerpo.params.width * cuerpo.params.height * 0.7, k = Math.sqrt(maxPx / (cuerpo.params.width * cuerpo.params.height)) * 0.97;
        cuerpo.params.width = Math.max(256, Math.floor((cuerpo.params.width * Math.min(k, 0.9)) / 64) * 64);
        cuerpo.params.height = Math.max(256, Math.floor((cuerpo.params.height * Math.min(k, 0.9)) / 64) * 64);
        cuerpo.params.steps = Math.max(14, cuerpo.params.steps - 3); continue;
      }
      break;
    }
    if (r.status === 429) { enfriar("horde", 120, "muchos pedidos"); throw new Falla("Horde: demasiados pedidos", { siguiente: true }); }
    if (!j.id) throw new Falla("Horde: " + (j.message || r.status), { siguiente: true });
    const cancelar = () => fetch(HORDE + "/generate/status/" + j.id, { method: "DELETE", headers: CABE }).catch(() => {});
    const t0 = Date.now(); let lento = false, hecho = false;
    try {
      while (Date.now() - t0 < 7 * 60000) {
        await esperar(4000, ctl.senal);
        const c = await (await fetch(HORDE + "/generate/check/" + j.id)).json();
        if (c.faulted) throw new Falla("Horde no pudo", { siguiente: true });
        if (c.done) { hecho = true; break; }
        ctl.estado(c.processing ? `Horde dibujando (${modelo})` : `Horde: en cola, puesto ${c.queue_position}, faltan ~${c.wait_time} s`, { espera: c.wait_time });
        // Cola larguísima: se suelta y prueba otro motor gratis (si hay alguno libre).
        if (!c.processing && c.wait_time > 300 && Date.now() - t0 > 20000 && ctl.hayOtro()) { lento = true; await cancelar(); throw new Falla("Horde con mucha cola", { siguiente: true }); }
      }
      if (!hecho) { lento = true; await cancelar(); throw new Falla("Horde tardó demasiado", { siguiente: true }); }
      const s = await (await fetch(HORDE + "/generate/status/" + j.id)).json();
      const g = (s.generations || [])[0];
      if (!g || !g.img) throw new Falla("Horde no devolvió imagen", { siguiente: true });
      if (g.censored) throw new Falla("Horde la censuró", { siguiente: true });
      const b = await (await fetch(g.img)).blob();
      return { blob: b, detalle: modelo };
    } catch (e) { if (!lento && e.name === "AbortError") cancelar(); throw e; }
  }

  // ═══ Hugging Face (Spaces de Gradio, cuota gratis por conexión) ═══
  const ESPACIOS = [
    { url: "https://black-forest-labs-flux-1-schnell.hf.space", nombre: "FLUX schnell", datos: (p, w, h) => [p.promptEn, p.semilla % 2147483647, false, w, h, 4] },
    { url: "https://stabilityai-stable-diffusion-3-5-large-turbo.hf.space", nombre: "SD 3.5 turbo", datos: (p, w, h) => [p.promptEn, Textos.NEGATIVO, p.semilla % 2147483647, false, w, h, 0, 4] },
  ];
  async function genHF(p, ctl) {
    const [w, h] = medida(p, [[1024, 576], [576, 1024], [1024, 1024], [896, 1120]]);
    let ultimoError = null;
    for (const e of ESPACIOS) {
      if (Date.now() < leerLS("hf-" + e.nombre, 0)) continue;
      try {
        ctl.estado("Hugging Face (" + e.nombre + ")");
        const r = await fetch(e.url + "/gradio_api/call/infer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: e.datos(p, w, h) }) });
        const { event_id } = await r.json(); if (!event_id) throw new Error("sin turno");
        const tx = await (await fetch(e.url + "/gradio_api/call/infer/" + event_id, { signal: ctl.senal })).text();
        const err = tx.match(/event: error\s*\ndata: (.*)/);
        if (err) { const m = err[1] || ""; guardarLS("hf-" + e.nombre, Date.now() + (/quota/i.test(m) ? 3600e3 : 600e3)); throw new Error(/quota/i.test(m) ? "sin cuota por hoy" : "error"); }
        const ok = tx.match(/event: complete\s*\ndata: (.*)/); if (!ok) throw new Error("sin resultado");
        const d = JSON.parse(ok[1]), f = Array.isArray(d) ? d[0] : null, u = f && (f.url || (f.path && e.url + "/gradio_api/file=" + f.path));
        if (!u) throw new Error("sin imagen");
        return { blob: await (await fetch(u)).blob(), detalle: e.nombre };
      } catch (er) { if (er.name === "AbortError") throw er; ultimoError = er; }
    }
    enfriar("hf", 1800, ultimoError ? ultimoError.message : "sin cuota");
    throw new Falla("Hugging Face: " + (ultimoError ? ultimoError.message : "sin cuota"), { siguiente: true });
  }

  // ═══ Pollinations (gratis, 1 imagen cada 45 s por conexión) ═══
  let polCola = Promise.resolve();
  function genPollinations(p, ctl) {
    const tarea = polCola.then(async () => {
      const [w, h] = medida(p, [[1280, 720], [720, 1280], [1024, 1024], [1024, 1280]]);
      for (let intento = 0; intento < 3; intento++) {
        const falta = leerLS("pol-ultimo", 0) + 46000 - Date.now();
        if (falta > 0) { ctl.estado(`Pollinations: turno gratis en ${Math.ceil(falta / 1000)} s`); await esperar(falta, ctl.senal); }
        guardarLS("pol-ultimo", Date.now()); ctl.estado("Pollinations dibujando");
        const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(p.promptEn)}?width=${w}&height=${h}&seed=${p.semilla}&nologo=true&model=flux`, { signal: ctl.senal });
        const tipo = r.headers.get("content-type") || "";
        if (r.ok && tipo.startsWith("image/")) return { blob: await r.blob() };
        const j = await r.json().catch(() => ({})), m = String((j.error && j.error.message) || "").match(/(\d+)\s*s/);
        if (r.status === 402 && m) { guardarLS("pol-ultimo", Date.now() - 46000 + (+m[1] + 1) * 1000); continue; }
        throw new Falla("Pollinations: " + r.status, { siguiente: true });
      }
      throw new Falla("Pollinations sin turno", { siguiente: true });
    });
    polCola = tarea.catch(() => {});
    return tarea;
  }

  // ═══ Diseño sin IA ═══
  async function genLocal(p) {
    const cv = Diseno.fondoLocal(p.ancho, p.alto, p.estilo, p.semilla);
    return { blob: await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.92)) };
  }

  const GEN = { rezona: genRezona, horde: genHorde, hf: genHF, pollinations: genPollinations, local: genLocal };
  async function correr(k, p, ctl) {
    estado[k].ocupados++; avisar();
    try { const r = await GEN[k](p, ctl); contar(k); return { ...r, motor: k }; }
    finally { estado[k].ocupados--; avisar(); }
  }

  // ═══ La fábrica ═══
  // pedido: { es, texto, estilo, formato, diseno, semilla }. alCambiar(tareas) se llama con cada novedad.
  function crear(pedido, n, alCambiar) {
    const f = MP.FORMATOS[pedido.formato] || MP.FORMATOS.youtube, senal = new AbortController();
    const tareas = Array.from({ length: n }, (_, i) => ({ id: id("t"), i, estado: "pensando", texto: "Pensando…", motor: null, blob: null, semilla: (pedido.semilla || semillaNueva()) + i * 7919, provisional: false, avance: null }));
    const cambio = () => alCambiar && alCambiar(tareas.map((t) => ({ ...t })));
    const prep = Textos.preparar(pedido.es, { conTitulo: !pedido.texto, semilla: tareas[0].semilla });
    // Orden de los gratis, rotado para que varias imágenes salgan de motores distintos a la vez.
    const GRATIS = ["horde", "hf", "pollinations"], rot = [["horde", "hf", "pollinations"], ["pollinations", "horde", "hf"], ["hf", "horde", "pollinations"], ["horde", "pollinations", "hf"]];
    async function hacer(t) {
      const cadena = [...(disponible("rezona") ? ["rezona"] : []), ...rot[t.i % rot.length], "local"];
      let textos = null;
      for (let j = 0; j < cadena.length; j++) {
        const k = cadena[j]; if (!disponible(k) && k !== "local") continue;
        if (k !== "rezona" && !textos) { t.texto = "Traduciendo la idea…"; cambio(); textos = await prep; }
        const base = textos || { en: Textos.traducirLocal(pedido.es) };
        const p = {
          ancho: f.ancho, alto: f.alto, estilo: pedido.estilo, semilla: t.semilla,
          promptEn: Textos.promptImagen(base.en, pedido.estilo, f.id, pedido.diseno),
          promptRico: Textos.promptImagen(pedido.es, pedido.estilo, f.id, pedido.diseno),   // Rezona entiende castellano: no espera la traducción
        };
        t.estado = "generando"; t.motor = k; t.texto = INFO[k].nombre + "…"; cambio();
        const ctl = {
          senal: senal.signal,
          estado: (tx, extra = {}) => { t.texto = tx; t.avance = extra.avance ?? null; cambio();
            // Horde con cola: mientras tanto, una rápida de Pollinations (se cambia sola por la mejor).
            if (k === "horde" && extra.espera > 60 && !t.blob && !t.buscandoProvisional && disponible("pollinations") && estado.pollinations.ocupados === 0) {
              t.buscandoProvisional = true;
              correr("pollinations", p, { senal: senal.signal, estado: () => {}, hayOtro: () => false }).then((r) => { if (!t.blob || t.provisional) { Object.assign(t, { blob: r.blob, motor: "pollinations", provisional: true }); cambio(); } }).catch(() => {});
            }
          },
          hayOtro: () => cadena.slice(j + 1).some((x) => x !== "local" && disponible(x) && estado[x].ocupados < INFO[x].max) || (t.blob && t.provisional),
        };
        try {
          const r = await correr(k, p, ctl);
          Object.assign(t, { blob: r.blob, motor: k, detalle: r.detalle, provisional: false, estado: "listo", texto: "Lista" }); cambio(); break;
        } catch (e) {
          if (e.name === "AbortError") { t.estado = "cancelada"; t.texto = "Cancelada"; cambio(); return; }
          console.warn("motor", k, e.message);
          if (t.blob && t.provisional) { Object.assign(t, { provisional: false, estado: "listo", texto: "Lista" }); cambio(); break; }   // nos quedamos con la rápida
          if (!e.siguiente && k !== "rezona") enfriar(k, 300, e.message);
        }
      }
      if (!t.blob) { t.estado = "error"; t.texto = "No se pudo"; cambio(); }
    }
    const promesa = (async () => { await Promise.all(tareas.map(hacer)); return tareas; })();
    return { tareas, promesa, titulo: prep.then((x) => x.titulo), cancelar: () => senal.abort() };
  }
  return {
    INFO, crear, disponible, saldoRezona, rezonaTope, estado: () => Object.entries(INFO).map(([k, v]) => ({ id: k, ...v, ...estado[k], disponible: disponible(k), apagado: apagados().includes(k) })),
    apagar: (k, si) => { const a = apagados().filter((x) => x !== k); if (si) a.push(k); guardarLS("apagados", a); avisar(); },
    reactivar: (k) => { estado[k].enfriarHasta = 0; guardarLS("enfriar-" + k, 0); avisar(); },
    alCambiar: (f) => (oyentes.add(f), () => oyentes.delete(f)),
  };
})();
