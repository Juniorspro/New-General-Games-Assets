"use strict";
// ════════════════════════════════════════════════════════════════════════
// Pantallas: Crear → Resultados (se llenan solas) → Editor; Mis miniaturas;
// Motores (qué está andando y conectar Rezona). Y el arranque.
// ════════════════════════════════════════════════════════════════════════
const opcionesDe = (o) => Object.entries(o).map(([v, x]) => ({ v, etiqueta: typeof x === "string" ? x : x.nombre }));
const cambiarPedido = (p) => Estado.set((e) => { const pedido = { ...e.pedido, ...p }; guardarLS("pedido", pedido); return { pedido }; });

// ── Lo que hacen los botones ──
const Acciones = {
  async subirFoto() {
    const f = await elegirArchivo("image/*"); if (!f) return;
    Estado.set({ persona: { procesando: true, url: URL.createObjectURL(f) } });
    try {
      let r = null, recuadro = false;
      if (Recorte.puede()) r = await Recorte.recortar(f).catch((e) => { console.warn("recorte", e); return null; });
      if (!r) { r = await Recorte.enRecuadro(f); recuadro = true; aviso(Recorte.puede() ? "No encontré una persona: la pongo entera en un recuadro" : "Acá no se puede recortar: va entera en un recuadro", "info", 4500); }
      const k = await Imagenes.poner(r.blob);
      Estado.set({ persona: { id: k, url: Imagenes.mapa.get(k).src, recuadro, procesando: false } });
      if (!recuadro) aviso("Listo: persona recortada", "ok");
    } catch (e) { Estado.set({ persona: null }); aviso("No pude abrir esa foto: " + e.message, "error", 5000); }
  },
  quitarFoto() { Estado.set({ persona: null }); },
  guardar(c) {
    c.editada = Date.now();
    Estado.set((e) => ({ creaciones: { ...e.creaciones, [c.id]: c } }));
    guardarLuego(c.id);
  },
  async crear(repetir) {
    const e = Estado.get(), p = e.pedido;
    if (!p.es.trim()) { aviso("Escribí de qué es el video", "info"); document.getElementById("idea")?.focus(); return; }
    if (e.persona && e.persona.procesando) { aviso("Esperá que termine de recortar la foto", "info"); return; }
    const semilla = semillaNueva(), pedido = { ...p, semilla }, f = MP.FORMATOS[p.formato] || MP.FORMATOS.youtube;
    const lote = [], creaciones = { ...e.creaciones };
    // Con diseño automático, cada una sale con un diseño distinto (para tener de dónde elegir).
    const variedad = [Diseno.elegirAuto(p), "grito", "noticia", "misterio", "top"].filter((x, i, a) => a.indexOf(x) === i);
    for (let i = 0; i < p.cantidad; i++) {
      const c = Diseno.nueva({ ...pedido, semilla: semilla + i * 7919 }, f.id);
      if (e.persona && e.persona.id) c.persona = { img: e.persona.id, x: 0.77, y: 1, alto: 0.97, espejo: false, borde: 0.012, colorBorde: "#FFFFFF", recuadro: e.persona.recuadro };
      c.tituloAuto = !p.texto.trim();
      Diseno.aplicar(c, p.diseno === "auto" ? variedad[i % variedad.length] : p.diseno, p.texto.trim() || Textos.tituloLocal(p.es, semilla + i));
      creaciones[c.id] = c; lote.push(c.id); Almacen.guardarCreacion(c);
    }
    Estado.set({ creaciones, lote, pantalla: "resultados", tareas: Object.fromEntries(lote.map((k) => [k, { estado: "pensando", texto: "Preparando…" }])) });
    window.scrollTo(0, 0);
    const vistos = {};
    const fab = Motores.crear(pedido, p.cantidad, (tareas) => {
      const nuevas = { ...Estado.get().tareas };
      for (const t of tareas) {
        const cid = lote[t.i]; nuevas[cid] = { estado: t.estado, texto: t.texto, motor: t.motor, provisional: t.provisional, avance: t.avance };
        if (t.blob && vistos[cid] !== t.blob) { vistos[cid] = t.blob; ponerFondo(cid, t.blob, t.motor); }
      }
      Estado.set({ tareas: nuevas });
    });
    fab.titulo.then((titulo) => {
      if (!titulo) return;
      for (const cid of lote) { const c = Estado.get().creaciones[cid]; if (c && c.tituloAuto && !c.tocada && c.textos[0]) { const n = copia(c); n.textos[0].texto = titulo; Acciones.guardar(n); } }
    });
    await fab.promesa;
    const ok = lote.filter((k) => Estado.get().tareas[k] && Estado.get().tareas[k].estado === "listo").length;
    aviso(ok === lote.length ? (ok === 1 ? "¡Tu miniatura está lista!" : `¡Listas las ${ok}!`) : `Salieron ${ok} de ${lote.length}`, ok ? "ok" : "error");
  },
  // Otro fondo para una miniatura ya hecha (mismo pedido, otra semilla).
  async otraVez(cid) {
    const c = Estado.get().creaciones[cid]; if (!c) return;
    Estado.set((e) => ({ tareas: { ...e.tareas, [cid]: { estado: "pensando", texto: "Otra versión…" } } }));
    let visto = null;
    const fab = Motores.crear({ ...c.pedido, formato: c.formato, semilla: semillaNueva() }, 1, (tareas) => {
      const t = tareas[0]; Estado.set((e) => ({ tareas: { ...e.tareas, [cid]: { estado: t.estado, texto: t.texto, motor: t.motor, provisional: t.provisional } } }));
      if (t.blob && t.blob !== visto) { visto = t.blob; ponerFondo(cid, t.blob, t.motor); }
    });
    await fab.promesa;
  },
};
async function ponerFondo(cid, blob, motor) {
  const k = await Imagenes.poner(blob), c = Estado.get().creaciones[cid]; if (!c) return;
  const viejo = c.fondo.img, n = copia(c); n.fondo.img = k; n.fondo.motor = motor; Acciones.guardar(n);
  if (viejo && viejo !== k) Imagenes.borrar(viejo);
}
// Guardado con un poco de demora (y una miniaturita para la galería).
const porGuardar = new Map();
function guardarLuego(cid) {
  clearTimeout(porGuardar.get(cid));
  porGuardar.set(cid, setTimeout(async () => {
    const c = Estado.get().creaciones[cid]; if (!c) return;
    try {
      const f = MP.FORMATOS[c.formato], cv = document.createElement("canvas"); cv.width = 360; cv.height = Math.round((360 * f.alto) / f.ancho);
      await Diseno.listo(); Diseno.dibujar(cv.getContext("2d"), c, cv.width, cv.height, recursos()); c.mini = cv.toDataURL("image/jpeg", 0.7);
    } catch (e) { /* sin miniaturita */ }
    Almacen.guardarCreacion(c);
  }, 500));
}

// ── Encabezado y barra de abajo ──
function Encabezado() {
  const conRz = useRezona();
  return html`<header class="encabezado"><img src=${LOGO_B64} alt="" class="logo-mini" />
    <div class="marca"><b>Miniaturas</b><span>Papuchón</span></div>
    <span class=${"pastilla" + (conRz ? " rz" : "")}>${conRz ? "Rezona conectado" : "Gratis · sin límite"}</span></header>`;
}
function useRezona() { useEstado((e) => e.version); const [, f] = useState(0); useEffect(() => Motores.alCambiar(() => f((n) => n + 1)), []); return Plataforma.rezona && Motores.disponible("rezona"); }
function Navegacion() {
  const p = useEstado((e) => e.pantalla);
  const ir = (x) => () => { Estado.set({ pantalla: x }); window.scrollTo(0, 0); };
  const activo = (x) => (p === x || (x === "crear" && p === "resultados") ? "si" : "");
  return html`<nav class="abajo" aria-label="Secciones">
    <button type="button" class=${activo("crear")} onClick=${ir("crear")}><${Icono} n="varita" />Crear</button>
    <button type="button" class=${activo("galeria")} onClick=${ir("galeria")}><${Icono} n="grilla" />Mis miniaturas</button>
    <button type="button" class=${activo("motores")} onClick=${ir("motores")}><${Icono} n="rayo" />Motores</button></nav>`;
}

// ── Crear ──
function PantallaCrear() {
  const p = useEstado((e) => e.pedido), persona = useEstado((e) => e.persona), [mas, setMas] = useState(false);
  const ideas = useMemo(() => [...Textos.IDEAS].sort(() => Math.random() - 0.5).slice(0, 3), []);
  const formatos = Object.values(MP.FORMATOS).map((f) => ({ v: f.id, etiqueta: f.nombre, muestra: html`<i class="forma" style=${{ aspectRatio: `${f.ancho} / ${f.alto}` }}></i>` }));
  const estilos = Object.entries(Textos.ESTILOS).map(([v, x]) => ({ v, etiqueta: x.nombre, muestra: v === "auto" ? null : html`<i class="punto" style=${{ background: `linear-gradient(135deg, ${(Diseno.PALETAS[v] || Diseno.PALETAS.auto).join(",")})` }}></i>` }));
  return html`<main class="pagina crear">
    <section class="tarjeta principal">
      <label for="idea" class="titulo-campo">¿De qué es el video?</label>
      <textarea id="idea" class="entrada grande" rows="3" placeholder="Ej.: Un hombre asustado mirando un auto en llamas en la ruta" value=${p.es} onInput=${(e) => cambiarPedido({ es: e.target.value })}></textarea>
      <div class="ideas">${ideas.map((t) => html`<button key=${t} type="button" class="idea" onClick=${() => cambiarPedido({ es: t })}>${t}</button>`)}</div>
    </section>
    <section class="tarjeta">
      <label for="titulo" class="titulo-campo">Texto grande <small>(opcional)</small></label>
      <input id="titulo" class="entrada" placeholder="Si lo dejás vacío, lo invento yo" value=${p.texto} onInput=${(e) => cambiarPedido({ texto: e.target.value.toUpperCase() })} />
      <div class="nota">Poné entre asteriscos la palabra que querés en amarillo: <b>¡SE PRENDIÓ *FUEGO*!</b></div>
    </section>
    <section class="tarjeta">
      <div class="titulo-campo">Foto de la persona <small>(opcional)</small></div>
      ${persona ? html`<div class="foto-persona"><div class="ajedrez"><img src=${persona.url} alt="Persona" /></div>
          <div class="pila">${persona.procesando ? html`<span class="nota"><span class="girando"></span> Recortando a la persona…</span>` : html`<span class="nota">${persona.recuadro ? "Va entera en un recuadro." : "Recortada: va encima, con borde blanco."}</span>`}
          <div class="fila"><${Boton} chico icono="foto" onClick=${Acciones.subirFoto}>Cambiar<//><${Boton} chico tipo="fantasma" icono="cerrar" onClick=${Acciones.quitarFoto}>Quitar<//></div></div></div>`
        : html`<button type="button" class="subir" onClick=${Acciones.subirFoto}><${Icono} n="persona" t=${28} /><span><b>Subir una foto</b><small>Tu cara o la del invitado: la recorto y la pongo grande, como los youtubers.</small></span></button>`}
    </section>
    <section class="tarjeta">
      <div class="titulo-campo">¿Para dónde?</div>
      <${Chips} etiqueta="Formato" valor=${p.formato} opciones=${formatos} alCambiar=${(v) => cambiarPedido({ formato: v })} />
      <div class="titulo-campo" style=${{ marginTop: "14px" }}>¿Cuántas?</div>
      <${Chips} etiqueta="Cantidad" valor=${p.cantidad} opciones=${[1, 2, 3, 4].map((n) => ({ v: n, etiqueta: String(n) }))} alCambiar=${(v) => cambiarPedido({ cantidad: v })} />
    </section>
    <button type="button" class="mas-opciones" aria-expanded=${mas} onClick=${() => setMas(!mas)}><${Icono} n="ajustes" /> ${mas ? "Menos opciones" : "Más opciones: estilo, diseño y logo"}</button>
    ${mas && html`<section class="tarjeta">
      <div class="titulo-campo">Estilo</div>
      <${Chips} etiqueta="Estilo" valor=${p.estilo} opciones=${estilos} alCambiar=${(v) => cambiarPedido({ estilo: v })} />
      <div class="titulo-campo" style=${{ marginTop: "14px" }}>Diseño</div>
      <${Chips} etiqueta="Diseño" valor=${p.diseno} opciones=${opcionesDe(Diseno.DISENOS)} alCambiar=${(v) => cambiarPedido({ diseno: v })} />
      <label class="chequeo" for="logo"><input id="logo" type="checkbox" checked=${p.logo} onChange=${(e) => cambiarPedido({ logo: e.target.checked })} />Poner el logo de ${MP.MARCA.nombre}</label>
    </section>`}
    <div class="crear-pie"><button type="button" class="crear-boton" onClick=${() => Acciones.crear()}><${Icono} n="varita" t=${24} />Crear ${p.cantidad === 1 ? "miniatura" : p.cantidad + " miniaturas"}</button></div>
  </main>`;
}

// ── Resultados (se van llenando solos) ──
function TarjetaResultado({ cid }) {
  const c = useEstado((e) => e.creaciones[cid]), t = useEstado((e) => e.tareas[cid]) || {};
  if (!c) return null;
  const listo = t.estado === "listo", motor = c.fondo.motor && Motores.INFO[c.fondo.motor];
  return html`<article class="resultado">
    <div class="marco-lienzo"><${Lienzo} c=${c} />
      ${!listo && t.estado !== "error" && html`<div class="estado-gen"><span class="girando"></span><span>${t.texto || "Creando…"}</span>${t.provisional && html`<em>versión rápida; ya viene la mejor</em>`}</div>`}
      ${t.estado === "error" && html`<div class="estado-gen error">No salió el fondo. Tocá “Otra” para probar de nuevo.</div>`}
      </div>
    ${motor && html`<div class=${"hecha m-" + c.fondo.motor}>Fondo: ${motor.nombre}${t.provisional ? " (rápida)" : ""}</div>`}
    <div class="acciones">
      <${Boton} tipo="rojo" icono="bajar" onClick=${() => guardarComo(c)}>Guardar<//>
      <${Boton} icono="lapiz" onClick=${() => { Estado.set({ editando: cid, seleccion: null, pantalla: "editor" }); window.scrollTo(0, 0); }}>Editar<//>
      <${Boton} icono="otra" desactivado=${!listo && t.estado !== "error"} onClick=${() => Acciones.otraVez(cid)}>Otra<//>
      ${Plataforma.puedeCompartir() && html`<${Boton} icono="compartir" titulo="Compartir" onClick=${() => compartirComo(c)} />`}
    </div></article>`;
}
function PantallaResultados() {
  const lote = useEstado((e) => e.lote), p = useEstado((e) => e.pedido), vert = MP.FORMATOS[p.formato] && MP.FORMATOS[p.formato].alto > MP.FORMATOS[p.formato].ancho;
  return html`<main class="pagina">
    <div class="titulo-pagina"><${Boton} icono="atras" tipo="fantasma" titulo="Volver" onClick=${() => Estado.set({ pantalla: "crear" })} /><h1>Tus miniaturas</h1></div>
    <p class="nota resumen">“${p.es}”</p>
    <div class=${"resultados" + (vert ? " verticales" : "")}>${lote.map((k) => html`<${TarjetaResultado} key=${k} cid=${k} />`)}</div>
    <div class="fila centro"><${Boton} grande tipo="rojo" icono="varita" onClick=${() => Acciones.crear()}>Crear otras<//><${Boton} grande icono="lapiz" onClick=${() => Estado.set({ pantalla: "crear" })}>Cambiar la idea<//></div>
  </main>`;
}

// ── Editor ──
function PantallaEditor() {
  const cid = useEstado((e) => e.editando), c = useEstado((e) => e.creaciones[e.editando]), sel = useEstado((e) => e.seleccion);
  const [tab, setTab] = useState("texto"), cajas = useRef(null), arr = useRef(null);
  useEffect(() => { if (!c && cid) Almacen.creacion(cid).then((x) => x && Estado.set((e) => ({ creaciones: { ...e.creaciones, [x.id]: x } }))); }, [cid]);
  if (!c) return html`<main class="pagina"><p class="nota">Cargando…</p></main>`;
  const cambiar = (fn) => { const n = copia(c); n.tocada = true; fn(n); Acciones.guardar(n); };
  const tx = sel && sel.tipo === "texto" ? c.textos.find((x) => x.id === sel.id) : c.textos[0];
  const el = sel && sel.tipo === "elemento" ? c.elementos.find((x) => x.id === sel.id) : null;
  function alTocar(ev, fase) {
    const cv = ev.currentTarget, r = cv.getBoundingClientRect(), k = cv.width / r.width, px = (ev.clientX - r.left) * k, py = (ev.clientY - r.top) * k;
    if (fase === "abajo") {
      const lista = (cajas.current && cajas.current.cajas) || [];
      const hit = [...lista].reverse().find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      if (!hit) { Estado.set({ seleccion: null }); return; }
      cv.setPointerCapture(ev.pointerId);
      Estado.set({ seleccion: { tipo: hit.tipo, id: hit.id } }); setTab(hit.tipo === "texto" ? "texto" : hit.tipo === "persona" ? "persona" : "agregar");
      const obj = hit.tipo === "persona" ? c.persona : hit.tipo === "texto" ? c.textos.find((x) => x.id === hit.id) : c.elementos.find((x) => x.id === hit.id);
      arr.current = { hit, x0: px, y0: py, ox: obj.x, oy: obj.y, W: cv.width, H: cv.height };
    } else if (fase === "mover" && arr.current) {
      const a = arr.current, dx = (px - a.x0) / a.W, dy = (py - a.y0) / a.H;
      cambiar((n) => { const o = a.hit.tipo === "persona" ? n.persona : a.hit.tipo === "texto" ? n.textos.find((x) => x.id === a.hit.id) : n.elementos.find((x) => x.id === a.hit.id); if (o) { o.x = clamp(a.ox + dx, -0.2, 1.2); o.y = clamp(a.oy + dy, -0.2, 1.3); } });
    } else if (fase === "arriba") arr.current = null;
  }
  const TABS = [["texto", "texto", "Texto"], ["persona", "persona", "Persona"], ["fondo", "imagen", "Fondo"], ["agregar", "estrella", "Agregar"], ["diseno", "capas", "Diseño"]];
  return html`<main class="pagina editor">
    <div class="titulo-pagina"><${Boton} icono="atras" tipo="fantasma" titulo="Volver" onClick=${() => Estado.set({ pantalla: Estado.get().lote.includes(cid) ? "resultados" : "galeria", seleccion: null })} /><h1>Editar</h1>
      <span class="espacio"></span><${Boton} tipo="rojo" icono="bajar" onClick=${() => guardarComo(c)}>Guardar<//></div>
    <div class="marco-lienzo editable"><${Lienzo} c=${c} marcar=${sel && sel.id} alTocar=${alTocar} refCajas=${cajas} /></div>
    <p class="nota centro">Tocá y arrastrá el texto, la persona o los adornos para moverlos.</p>
    <div class="pestanas" role="tablist">${TABS.map(([k, ic, et]) => html`<button key=${k} type="button" role="tab" aria-selected=${tab === k} class=${tab === k ? "si" : ""} onClick=${() => setTab(k)}><${Icono} n=${ic} />${et}</button>`)}</div>
    <section class="tarjeta panel">
      ${tab === "texto" && html`<${PanelTexto} c=${c} tx=${tx} cambiar=${cambiar} />`}
      ${tab === "persona" && html`<${PanelPersona} c=${c} cambiar=${cambiar} />`}
      ${tab === "fondo" && html`<${PanelFondo} c=${c} cambiar=${cambiar} />`}
      ${tab === "agregar" && html`<${PanelAgregar} c=${c} el=${el} cambiar=${cambiar} />`}
      ${tab === "diseno" && html`<${PanelDiseno} c=${c} cambiar=${cambiar} />`}
    </section>
  </main>`;
}
function PanelTexto({ c, tx, cambiar }) {
  const setT = (p) => cambiar((n) => { const t = n.textos.find((x) => x.id === tx.id); if (t) Object.assign(t, p); });
  const agregar = () => cambiar((n) => { const t = Diseno.texto({ texto: "TEXTO *NUEVO*", x: 0.5, y: 0.5, ancho: 0.6, tam: 0.12, alinear: "center", rot: 0 }); n.textos.push(t); Estado.set({ seleccion: { tipo: "texto", id: t.id } }); });
  if (!tx) return html`<div class="pila"><p class="nota">Esta miniatura no tiene texto.</p><${Boton} icono="mas" onClick=${agregar}>Agregar un texto<//></div>`;
  return html`<div class="pila">
    <textarea id="texto-edit" class="entrada" rows="2" value=${tx.texto} onInput=${(e) => setT({ texto: e.target.value.toUpperCase() })}></textarea>
    <div class="nota">Entre asteriscos va en el color de resalte: *PALABRA*.</div>
    <div class="titulo-campo">Letra</div>
    <${Chips} etiqueta="Letra" valor=${tx.fuente} opciones=${Object.keys(Diseno.FUENTES).map((f) => ({ v: f, etiqueta: html`<span style=${{ fontFamily: Diseno.FUENTES[f] }}>${f}</span>` }))} alCambiar=${(v) => setT({ fuente: v })} />
    <div class="titulo-campo">Color</div><${Colores} valor=${tx.color} alCambiar=${(v) => setT({ color: v })} />
    <div class="titulo-campo">Resalte</div><${Colores} valor=${tx.resalte} alCambiar=${(v) => setT({ resalte: v })} />
    <div class="titulo-campo">Fondo del texto</div><${Colores} conNada valor=${tx.caja} alCambiar=${(v) => setT({ caja: v, grosor: v ? 0 : 0.13 })} />
    <${Deslizador} id="t-tam" etiqueta="Tamaño" valor=${tx.tam} min=${0.04} max=${0.35} paso=${0.005} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => setT({ tam: v })} />
    <${Deslizador} id="t-ancho" etiqueta="Ancho" valor=${tx.ancho} min=${0.2} max=${1} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setT({ ancho: v })} />
    <${Deslizador} id="t-borde" etiqueta="Borde negro" valor=${tx.grosor} min=${0} max=${0.25} paso=${0.01} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => setT({ grosor: v })} />
    <${Deslizador} id="t-rot" etiqueta="Inclinación" valor=${tx.rot} min=${-15} max=${15} paso=${0.5} formato=${(v) => v + "°"} alCambiar=${(v) => setT({ rot: v })} />
    <${Chips} etiqueta="Alineación" valor=${tx.alinear} opciones=${[{ v: "left", etiqueta: "Izquierda" }, { v: "center", etiqueta: "Centro" }, { v: "right", etiqueta: "Derecha" }]} alCambiar=${(v) => setT({ alinear: v })} />
    <div class="fila"><${Boton} chico icono="mas" onClick=${agregar}>Otro texto<//>
      ${c.textos.length > 0 && html`<${BorrarSeguro} titulo="Borrar este texto" onClick=${() => cambiar((n) => { n.textos = n.textos.filter((x) => x.id !== tx.id); })} />`}</div>
  </div>`;
}
function PanelPersona({ c, cambiar }) {
  const p = c.persona, persona = useEstado((e) => e.persona);
  const usarFoto = async () => {
    await Acciones.subirFoto(); const ps = Estado.get().persona; if (!ps || !ps.id) return;
    cambiar((n) => { n.persona = { ...(n.persona || { x: 0.77, y: 1, alto: 0.97, borde: 0.012, colorBorde: "#FFFFFF" }), img: ps.id, recuadro: ps.recuadro }; });
  };
  if (!p) return html`<div class="pila"><p class="nota">Subí una foto y la recorto para ponerla encima, grande y con borde.</p><${Boton} icono="foto" onClick=${usarFoto}>Subir foto<//>
    ${persona && persona.id && html`<${Boton} icono="persona" onClick=${() => cambiar((n) => { n.persona = { img: persona.id, recuadro: persona.recuadro, x: 0.77, y: 1, alto: 0.97, borde: 0.012, colorBorde: "#FFFFFF" }; })}>Usar la última foto<//>`}</div>`;
  const setP = (o) => cambiar((n) => Object.assign(n.persona, o));
  return html`<div class="pila">
    <${Deslizador} id="p-alto" etiqueta="Tamaño" valor=${p.alto} min=${0.25} max=${1.5} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setP({ alto: v })} />
    ${!p.recuadro && html`<${Deslizador} id="p-borde" etiqueta="Borde" valor=${p.borde ?? 0.012} min=${0} max=${0.03} paso=${0.001} formato=${(v) => Math.round(v * 1000)} alCambiar=${(v) => setP({ borde: v })} />`}
    <div class="titulo-campo">Color del borde</div><${Colores} valor=${p.colorBorde} alCambiar=${(v) => setP({ colorBorde: v })} />
    <div class="fila"><${Boton} chico icono="espejo" onClick=${() => setP({ espejo: !p.espejo })}>Dar vuelta<//><${Boton} chico icono="foto" onClick=${usarFoto}>Otra foto<//>
      <${BorrarSeguro} titulo="Sacar la persona" onClick=${() => cambiar((n) => { n.persona = null; })} /></div>
  </div>`;
}
function PanelFondo({ c, cambiar }) {
  const t = useEstado((e) => e.tareas[c.id]) || {}, f = c.fondo, setF = (o) => cambiar((n) => Object.assign(n.fondo, o));
  const subir = async () => { const a = await elegirArchivo("image/*"); if (!a) return; const k = await Imagenes.poner(a); setF({ img: k, motor: "propia", zoom: 1, x: 0.5, y: 0.5 }); };
  const ocupado = t.estado === "generando" || t.estado === "pensando";
  return html`<div class="pila">
    <div class="fila"><${Boton} icono="otra" desactivado=${ocupado} onClick=${() => Acciones.otraVez(c.id)}>${ocupado ? t.texto : "Otro fondo con IA"}<//><${Boton} icono="imagen" onClick=${subir}>Usar una foto mía<//></div>
    <${Deslizador} id="f-zoom" etiqueta="Acercar" valor=${f.zoom || 1} min=${1} max=${2.5} paso=${0.01} formato=${(v) => v.toFixed(2) + "×"} alCambiar=${(v) => setF({ zoom: v })} />
    <${Deslizador} id="f-x" etiqueta="Mover a los lados" valor=${f.x ?? 0.5} min=${0} max=${1} paso=${0.01} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => setF({ x: v })} />
    <${Deslizador} id="f-y" etiqueta="Mover arriba/abajo" valor=${f.y ?? 0.5} min=${0} max=${1} paso=${0.01} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => setF({ y: v })} />
    <${Deslizador} id="f-sat" etiqueta="Color" valor=${f.saturacion} min=${0.5} max=${2} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setF({ saturacion: v })} />
    <${Deslizador} id="f-con" etiqueta="Contraste" valor=${f.contraste} min=${0.7} max=${1.6} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setF({ contraste: v })} />
    <${Deslizador} id="f-bri" etiqueta="Brillo" valor=${f.brillo} min=${0.6} max=${1.5} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setF({ brillo: v })} />
    <${Deslizador} id="f-osc" etiqueta="Oscurecer los bordes" valor=${f.oscurecer} min=${0} max=${0.6} paso=${0.01} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setF({ oscurecer: v })} />
  </div>`;
}
const EMOJIS = ["😱", "🔥", "⚠️", "❗", "💥", "😡", "😂", "💰", "🚨", "👀", "❌", "✅"];
function PanelAgregar({ c, el, cambiar }) {
  const agregar = (tipo) => cambiar((n) => {
    const base = { flecha: { x: 0.45, y: 0.45, rot: 20 }, circulo: { x: 0.62, y: 0.5 }, sello: { x: 0.7, y: 0.25, rot: -12, texto: "EXCLUSIVO" }, etiqueta: { x: 0.05, y: 0.1, texto: "EN VIVO" }, numero: { x: 0.15, y: 0.5, texto: "#1", color: MP.MARCA.amarillo }, emoji: { x: 0.85, y: 0.2, texto: "😱" }, rayos: { x: 0.25, y: 0.3, color: MP.MARCA.amarillo, texto: "¡WOW!" }, logo: { x: 0.12, y: 0.13, escala: 0.75 } }[tipo];
    const e = Diseno.elem(tipo, base); n.elementos.push(e); Estado.set({ seleccion: { tipo: "elemento", id: e.id } });
  });
  const setE = (o) => cambiar((n) => { const e = n.elementos.find((x) => x.id === el.id); if (e) Object.assign(e, o); });
  return html`<div class="pila">
    <div class="agregables">${Object.entries(Diseno.ELEMENTOS).map(([k, n]) => html`<button key=${k} type="button" class="agregable" onClick=${() => agregar(k)}>${n}</button>`)}</div>
    ${el ? html`<div class="pila elegido"><div class="titulo-campo">${Diseno.ELEMENTOS[el.tipo] || "Elemento"} elegido</div>
      ${el.tipo === "emoji" ? html`<div class="emojis">${EMOJIS.map((x) => html`<button key=${x} type="button" class=${el.texto === x ? "si" : ""} onClick=${() => setE({ texto: x })}>${x}</button>`)}</div>`
        : ["sello", "etiqueta", "numero", "rayos"].includes(el.tipo) && html`<input class="entrada" aria-label="Texto del elemento" value=${el.texto} onInput=${(e) => setE({ texto: e.target.value.toUpperCase() })} />`}
      ${!["emoji", "logo"].includes(el.tipo) && html`<${Colores} valor=${el.color} alCambiar=${(v) => setE({ color: v })} />`}
      <${Deslizador} id="e-esc" etiqueta="Tamaño" valor=${el.escala} min=${0.3} max=${3} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => setE({ escala: v })} />
      <${Deslizador} id="e-rot" etiqueta="Girar" valor=${el.rot} min=${-180} max=${180} paso=${1} formato=${(v) => v + "°"} alCambiar=${(v) => setE({ rot: v })} />
      <${BorrarSeguro} titulo="Borrar" onClick=${() => { cambiar((n) => { n.elementos = n.elementos.filter((x) => x.id !== el.id); }); Estado.set({ seleccion: null }); }} /></div>`
      : html`<p class="nota">Tocá uno para agregarlo, después arrastralo en la miniatura.</p>`}
  </div>`;
}
function PanelDiseno({ c, cambiar }) {
  const formatos = Object.values(MP.FORMATOS).map((f) => ({ v: f.id, etiqueta: f.nombre }));
  return html`<div class="pila">
    <div class="titulo-campo">Diseño</div>
    <${Chips} etiqueta="Diseño" valor=${c.diseno} opciones=${opcionesDe(Diseno.DISENOS).filter((o) => o.v !== "auto")} alCambiar=${(v) => cambiar((n) => Diseno.aplicar(n, v, n.textos[0] ? n.textos[0].texto : ""))} />
    <div class="nota">Cambiar el diseño reacomoda el texto y los adornos (el fondo y la persona quedan).</div>
    <div class="titulo-campo">Formato</div>
    <${Chips} etiqueta="Formato" valor=${c.formato} opciones=${formatos} alCambiar=${(v) => cambiar((n) => { n.formato = v; Diseno.aplicar(n, n.diseno, n.textos[0] ? n.textos[0].texto : ""); })} />
    <label class="chequeo" for="logo-ed"><input id="logo-ed" type="checkbox" checked=${!!(c.marca && c.marca.logo)} onChange=${(e) => cambiar((n) => { n.marca = { logo: e.target.checked }; Diseno.aplicar(n, n.diseno, n.textos[0] ? n.textos[0].texto : ""); })} />Logo del canal</label>
  </div>`;
}

// ── Mis miniaturas ──
function PantallaGaleria() {
  const [lista, setLista] = useState(null), version = useEstado((e) => e.creaciones);
  useEffect(() => { Almacen.creaciones().then(setLista); }, [version]);
  return html`<main class="pagina">
    <div class="titulo-pagina"><h1>Mis miniaturas</h1></div>
    ${lista === null ? html`<p class="nota">Cargando…</p>` : !lista.length ? html`<div class="vacio"><${Icono} n="grilla" t=${34} /><p>Todavía no hiciste ninguna. Las que crees quedan guardadas acá, en este teléfono.</p><${Boton} tipo="rojo" icono="varita" onClick=${() => Estado.set({ pantalla: "crear" })}>Crear la primera<//></div>`
      : html`<div class="galeria">${lista.map((c) => html`<article key=${c.id} class="pieza">
          <button type="button" class="pieza-img" style=${{ aspectRatio: `${MP.FORMATOS[c.formato].ancho} / ${MP.FORMATOS[c.formato].alto}` }} onClick=${() => { Estado.set((e) => ({ creaciones: { ...e.creaciones, [c.id]: c }, editando: c.id, seleccion: null, pantalla: "editor" })); window.scrollTo(0, 0); }} aria-label="Abrir">${c.mini ? html`<img src=${c.mini} alt="" />` : html`<${Icono} n="imagen" />`}</button>
          <div class="fila pieza-pie"><${Boton} chico icono="bajar" titulo="Guardar" onClick=${() => guardarComo(c)} /><span class="nota">${MP.FORMATOS[c.formato].nombre}</span>
            <${BorrarSeguro} onClick=${async () => { await Almacen.borrarCreacion(c.id); if (c.fondo.img) Imagenes.borrar(c.fondo.img); setLista(lista.filter((x) => x.id !== c.id)); }} /></div></article>`)}</div>`}
  </main>`;
}

// ── Motores ──
function PantallaMotores() {
  const [, f] = useState(0), [saldo, setSaldo] = useState(null), [con, setCon] = useState(null);
  useEffect(() => Motores.alCambiar(() => f((n) => n + 1)), []);
  useEffect(() => { if (Plataforma.rezona) Motores.saldoRezona().then(setSaldo).catch(() => {}); }, [con && con.estado]);
  useEffect(() => { const t = setInterval(() => f((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  window.__rzConexion = (est) => { setCon(est); if (est.estado === "listo") { aviso("¡Rezona conectado!", "ok", 5000); Estado.set((e) => ({ version: e.version + 1 })); } };
  const conectar = () => { setCon({ estado: "pidiendo" }); window.AndroidPapuchon.rezonaConectar(); };   // Java avisa por __rzConexion
  const tope = Plataforma.rezona ? Motores.rezonaTope() : null, lista = Motores.estado();
  return html`<main class="pagina">
    <div class="titulo-pagina"><h1>Motores</h1></div>
    <p class="nota">La app elige sola el mejor que esté andando y, si uno se traba o se queda sin cupo, pasa al siguiente. No hace falta tocar nada.</p>
    <div class="motores">${lista.map((m) => {
      const enfr = m.enfriarHasta > Date.now(), minutos = Math.ceil((m.enfriarHasta - Date.now()) / 60000);
      const est = m.id === "rezona" && !Plataforma.rezona ? (Plataforma.conRezona ? "Sin conectar" : "Solo en la app de Android") : m.apagado ? "Apagado" : enfr ? `Descansando ${minutos} min (${m.motivo})` : m.ocupados ? "Trabajando" : "Listo";
      const color = m.apagado || (m.id === "rezona" && !Plataforma.rezona) ? "gris" : enfr ? "amarillo" : "verde";
      return html`<article key=${m.id} class="motor">
        <div class="motor-cab"><i class=${"luz " + color}></i><b>${m.nombre}</b><span class="calidad" title="Calidad">${"★".repeat(m.calidad)}</span></div>
        <p class="nota">${m.detalle}</p>
        <div class="fila"><span class="estado-motor">${est}</span>${m.hechas ? html`<span class="nota">${m.hechas} hechas</span>` : null}
          <span class="espacio"></span>${enfr && !m.apagado && html`<${Boton} chico onClick=${() => Motores.reactivar(m.id)}>Probar ya<//>`}
          ${m.id !== "local" && html`<label class="interruptor"><input type="checkbox" checked=${!m.apagado} onChange=${(e) => Motores.apagar(m.id, !e.target.checked)} /><span>Usar</span></label>`}</div>
        ${m.id === "rezona" && Plataforma.rezona && html`<div class="fila nota">${saldo ? html`<span>Saldo: <b>${saldo.gastable.toLocaleString("es-AR")}</b> créditos</span>` : null}${tope && tope.tope ? html`<span>Hoy: ${tope.usados} de ${tope.tope} imágenes</span>` : null}</div>`}
        ${m.id === "rezona" && Plataforma.conRezona && !Plataforma.rezona && html`<div class="pila conectar">
          ${!con || con.estado === "error" ? html`<${Boton} tipo="rojo" icono="rayo" onClick=${conectar}>Conectar con Rezona<//>${con && html`<p class="nota error">${con.texto}</p>`}`
            : con.estado === "pidiendo" ? html`<p class="nota"><span class="girando"></span> Pidiendo el link a Rezona…</p>`
            : con.estado === "esperando" ? html`<p class="nota">Abrí este link con la cuenta de Rezona y tocá <b>Aprobar</b> (dura 10 minutos). Si la cuenta es de otra persona, mandáselo:</p>
              <code class="link-rz">${con.url}</code>
              <div class="fila"><${Boton} icono="compartir" onClick=${() => window.AndroidPapuchon.compartirTexto("Aprobá Miniaturas Papuchón en Rezona: " + con.url)}>Mandar el link<//><${Boton} onClick=${() => window.AndroidPapuchon.abrirLink(con.url)}>Abrirlo acá<//></div>
              <p class="nota"><span class="girando"></span> Esperando la aprobación…</p>` : null}
        </div>`}
      </article>`;
    })}</div>
    <p class="nota pie">Versión ${MP.VERSION}. Todo lo que hacés queda guardado en este teléfono.</p>
  </main>`;
}

// ── App ──
function App() {
  const pantalla = useEstado((e) => e.pantalla);
  useEffect(() => { Diseno.listo().then(() => Estado.set((e) => ({ version: e.version + 1 }))); }, []);
  const P = { crear: PantallaCrear, resultados: PantallaResultados, editor: PantallaEditor, galeria: PantallaGaleria, motores: PantallaMotores }[pantalla] || PantallaCrear;
  return html`<${Encabezado} /><${P} /><${Navegacion} /><${Avisos} />`;
}
// Botón de atrás del celular (app de Android).
window.epAtras = () => {
  const e = Estado.get();
  if (e.pantalla === "editor") { Estado.set({ pantalla: e.lote.includes(e.editando) ? "resultados" : "galeria", seleccion: null }); return true; }
  if (e.pantalla !== "crear") { Estado.set({ pantalla: "crear" }); return true; }
  return false;
};
ReactDOM.createRoot(document.getElementById("app")).render(html`<${App} />`);
