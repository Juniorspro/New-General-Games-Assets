"use strict";
// ════════════════════════════════════════════════════════════════════════
// Pantallas: inicio (mis videos), mi marca, exportar, modo filmable, y el
// arranque de la app.
// ════════════════════════════════════════════════════════════════════════

// ── Inicio ──
function Inicio() {
  const [proyectos, setProyectos] = useState(null), [uso, setUso] = useState(null), [creando, setCreando] = useState(false);
  useMedios();
  const cargar = () => Almacen.proyectos().then(setProyectos);
  useEffect(() => { cargar(); Almacen.uso().then(setUso); }, []);
  const miniDe = (p) => {
    const k = p.pistas.find((x) => x.tipo === "video"), c = k && k.clips[0], m = c && Medios.datos(c.medio);
    return m && m.miniaturas && m.miniaturas[0];
  };
  const ejemplo = async () => { setCreando(true); try { await crearEjemplo(); } catch (e) { Tienda.aviso("No pude armar el ejemplo: " + e.message, "error"); } setCreando(false); };
  return html`<main class="inicio"><div class="inicio-dentro">
    <section class="portada">
      <div><h1>Estudio <span>Papuchón</span></h1>
        <p>Tus videos con la marca de ${Tienda.get().marca.nombre}: mosca, zócalos, titulares, voz de locutor, subtítulos y música. Sale en MP4 listo para TikTok.</p>
        <div class="fila"><${Boton} tipo="primario" grande icono="mas" onClick=${() => Tienda.nuevo("9:16")}>Nuevo video vertical<//>
          <${Boton} grande icono="varita" desactivado=${creando} onClick=${ejemplo}>${creando ? "Armando…" : "Ver un ejemplo"}<//></div></div>
      <img src=${LOGO_B64} alt="Logo de Noticias El Papuchón" />
    </section>
    <section class="pila">
      <div class="titulo-sec"><h2>Empezar en otro formato</h2></div>
      <div class="formatos">${Object.values(EP.FORMATOS).map((f) => {
        const k = 54 / Math.max(f.ancho, f.alto);
        return html`<button key=${f.id} type="button" class="formato" onClick=${() => Tienda.nuevo(f.id)}><div class="caja" style=${{ width: f.ancho * k + "px", height: f.alto * k + "px" }}></div><b>${f.id} ${f.nombre}</b><small>${f.detalle}</small></button>`;
      })}</div>
    </section>
    <section class="accesos">
      <button type="button" class="acceso" onClick=${() => Tienda.set({ pantalla: "filmable", volverA: "inicio" })}><${Icono} n="camara" /><b>Modo filmable</b><small>Filmá con el celu y los gráficos del canal encima</small></button>
      <button type="button" class="acceso" onClick=${() => Tienda.set({ pantalla: "marca", volverA: "inicio" })}><${Icono} n="sol" /><b>Mi marca</b><small>Logo, colores y tu @usuario en todos los gráficos</small></button>
      <button type="button" class="acceso" onClick=${async () => { const r = await importarArchivos(await elegirArchivos("video/*,image/*")); if (r.length) { await Tienda.nuevo("9:16"); for (const m of r) Acciones.agregarMedio(m, "video", Proyecto.duracion(Tienda.get().proyecto) > 1 ? Proyecto.duracion(Tienda.get().proyecto) : 0); } }}><${Icono} n="subir" /><b>Editar un video ya</b><small>Elegí el archivo y entrás directo al editor</small></button>
    </section>
    <section class="pila">
      <div class="titulo-sec"><h2>Mis videos</h2>${uso && html`<span class="nota">Usado en este navegador: ${pesoTxt(uso.usado)}</span>`}</div>
      ${proyectos === null ? html`<div class="nota">Cargando…</div>` : !proyectos.length ? html`<div class="vacio"><${Icono} n="medios" t=${34} /><div>Todavía no hiciste ningún video. Empezá uno nuevo o mirá el ejemplo para ver cómo queda.</div></div>`
        : html`<div class="proyectos">${proyectos.map((p) => { const mini = miniDe(p); return html`<article key=${p.id} class="proy">
          <div class="mini" style=${mini ? { backgroundImage: `url(${mini})` } : null} onClick=${() => Tienda.abrir(p.id)} role="button" tabIndex="0" aria-label=${"Abrir " + p.nombre}>${!mini && html`<${Icono} n="medios" t=${30} />`}</div>
          <div class="datos"><b title=${p.nombre}>${p.nombre}</b><small>${p.formato.id} · ${fmtTiempo(p.duracionTotal || 0)} · ${haceTxt(p.editado)}</small>
            <div class="fila" style=${{ gap: "4px" }}><${Boton} chico tipo="amarillo" onClick=${() => Tienda.abrir(p.id)}>Abrir<//>
              <${Boton} chico icono="copiar" tipo="fantasma" titulo="Duplicar" onClick=${async () => { await Almacen.guardarProyecto({ ...copia(p), id: id("p"), nombre: p.nombre + " (copia)", editado: Date.now() }); cargar(); }} />
              <${BorrarSeguro} titulo="Borrar el video" onClick=${async () => { await Almacen.borrarProyecto(p.id); cargar(); }} /></div></div>
        </article>`; })}</div>`}
    </section>
    <p class="nota">Todo queda guardado en este navegador; nada se sube a ningún lado. Versión ${EP.VERSION}.</p>
  </div></main>`;
}
// Un proyecto de muestra: fondo de estudio dibujado acá, gráficos del canal y música.
async function crearEjemplo() {
  const fondo = await Medios.importarFijo("m_demo_estudio", async () => {
    const W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1b2638"); gr.addColorStop(0.6, "#0e1420"); gr.addColorStop(1, "#05070b"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(80,140,255,${0.05 + (i % 3) * 0.03})`; g.fillRect(i * 130 - 20, 260 + (i % 2) * 60, 90, 900); }
    g.save(); g.globalAlpha = 0.18; Plantillas.sol(g, W / 2, 760, 420, 0.3); g.restore();
    g.fillStyle = "#0a0d14"; g.beginPath(); g.ellipse(W / 2, 1180, 230, 260, 0, 0, 7); g.fill(); g.fillRect(W / 2 - 360, 1340, 720, 700);
    g.fillStyle = "#e01b24"; g.fillRect(0, 1500, W, 26);
    return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
  }, "Fondo de estudio (ejemplo).jpg", { origen: "ejemplo" });
  await Tienda.nuevo("9:16");
  Tienda.cambiar((p) => {
    p = { ...p, nombre: "Ejemplo: último momento" };
    const r = Proyecto.agregarMedio(p, fondo, { pista: "video", en: 0 }); p = Proyecto.cambiarClip(r.p, r.clip.id, { hasta: 12, encuadre: { modo: "cubrir", movimiento: "acercar" } });
    return p;
  }, "ejemplo");
  Acciones.vestir();
  Acciones.agregarGrafico("titular", { texto: "*CORTE TOTAL* EN LA RUTA 12 POR LA FALTA DE AGUA" }, 2.4, 5);
  Acciones.agregarGrafico("sello", { texto: "URGENTE" }, 7.6, 2.5);
  const mus = await Musica.medio("cortina", "urgente");
  const c = Acciones.agregarMedio(mus, "musica", 0);
  if (c) Tienda.cambiar((q) => Proyecto.cambiarClip(q, c.id, { hasta: 12, volumen: 0.6, fundidoSalida: 1.5 }), "música");
  Tienda.set({ seleccion: null, panel: esCel() ? null : "plantillas" }); Motor.ir(3.2);
  Tienda.aviso("Este es un ejemplo. Traé tu video desde Medios y tocá Vestir.", "info", 6000);
}

// ── Mi marca ──
function MiMarca() {
  const guardada = useTienda((e) => e.marca), volverA = useTienda((e) => e.volverA) || "inicio";
  const [m, setM] = useState(guardada), ref = useRef(null), [logoPropio, setLogoPropio] = useState(null);
  const pon = (k, v) => setM((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (m.logoMedio) Medios.imagen(m.logoMedio).then(setLogoPropio); else setLogoPropio(null); }, [m.logoMedio]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const rec = await Compositor.recursos(m), cv = ref.current; if (!cv || !vivo) return;
      const W = 1080, H = 1920, e = cv.width / W, g = cv.getContext("2d"); g.setTransform(e, 0, 0, e, 0, 0); g.drawImage(fondoDeMuestra(W, H), 0, 0);
      for (const [pl, params] of [["mosca", {}], ["zocalo-ultimo", {}], ["titular", {}]]) Plantillas.dibujarClip(g, { id: pl, plantilla: pl, inicio: 0, duracion: 10, params, caja: {} }, 2.4, W, H, rec);
    })();
    return () => { vivo = false; };
  }, [m, logoPropio]);
  const subirLogo = async () => {
    const [f] = await elegirArchivos("image/png,image/webp,image/jpeg,image/svg+xml", false); if (!f) return;
    try { const md = await Medios.importar(f, "Logo: " + f.name, { origen: "logo" }); pon("logoMedio", md.id); } catch (e) { Tienda.aviso(e.message, "error"); }
  };
  const guardar = async () => { await Tienda.guardarMarca(m); await Motor.refrescarRecursos(); Tienda.aviso("Marca guardada: los gráficos ya la usan", "ok"); Tienda.set({ pantalla: volverA }); };
  const COLS = [["rojo", "Color principal"], ["rojoOscuro", "Color oscuro"], ["amarillo", "Resaltado"], ["naranja", "Acento"]];
  return html`<main class="inicio"><div class="inicio-dentro">
    <div class="fila"><${Boton} icono="atras" tipo="fantasma" onClick=${() => Tienda.set({ pantalla: volverA })}>Volver<//></div>
    <div class="titulo-sec"><h2>Mi marca</h2><span class="nota">Lo que cambies acá se aplica a todos los gráficos de todos tus videos.</span></div>
    <div class="marca-vista">
      <div class="pila">
        <${Campo} etiqueta="Nombre del canal" para="marca-nombre"><input id="marca-nombre" class="entrada" value=${m.nombre} onInput=${(e) => pon("nombre", e.target.value)} /><//>
        <${Campo} etiqueta="Tu usuario (sale en el cierre y la mosca)" para="marca-usuario"><input id="marca-usuario" class="entrada" value=${m.usuario} onInput=${(e) => pon("usuario", e.target.value)} /><//>
        <div class="rotulo">Colores</div>
        <div class="fila">${COLS.map(([k, n]) => html`<label key=${k} class="chequeo" for=${"marca-" + k}><input id=${"marca-" + k} type="color" value=${m[k]} onInput=${(e) => pon(k, e.target.value.toUpperCase())} style=${{ width: "40px", height: "34px", border: 0, background: "none" }} />${n}</label>`)}</div>
        <div class="rotulo">Logo</div>
        <div class="fila"><img src=${logoPropio ? Medios.url(m.logoMedio) : LOGO_B64} alt="Logo actual" style=${{ height: "72px", background: "#000", borderRadius: "8px", padding: "6px" }} />
          <${Boton} icono="subir" onClick=${subirLogo}>Subir mi logo<//>${m.logoMedio && html`<${Boton} tipo="fantasma" onClick=${() => pon("logoMedio", null)}>Usar el del canal<//>`}</div>
        <div class="nota">Mejor un PNG sin fondo, ancho y no muy alto.</div>
        <div class="fila"><${Boton} tipo="primario" grande icono="check" onClick=${guardar}>Guardar mi marca<//><${Boton} tipo="fantasma" onClick=${() => setM({ ...EP.MARCA })}>Volver a los colores del canal<//></div>
      </div>
      <canvas ref=${ref} width="360" height="640" aria-label="Así quedan los gráficos"></canvas>
    </div></div></main>`;
}

// ── Exportar ──
function DialogoExportar() {
  const p = useTienda((e) => e.proyecto), [cal, setCal] = useState(leerLS("calidad", "alta")), [estado, setEstado] = useState("listo");
  const [av, setAv] = useState({ f: 0, txt: "" }), [res, setRes] = useState(null), [error, setError] = useState(""), ref = useRef(null), cancelar = useRef(false), url = useRef(null);
  const D = Proyecto.duracion(p), cerrar = () => { if (estado === "exportando") { cancelar.current = true; return; } Tienda.set({ exportando: false }); };
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const empezar = async () => {
    guardarLS("calidad", cal); cancelar.current = false; setEstado("exportando"); setError("");
    try {
      const r = await Exportador.exportar(p, {
        calidad: cal, cancelado: () => cancelar.current,
        alAvance: (f, cv, txt) => { setAv({ f, txt: txt || "" }); const c = ref.current; if (cv && c) { const g = c.getContext("2d"); g.drawImage(cv, 0, 0, c.width, c.height); } },
      });
      url.current = URL.createObjectURL(r.blob); setRes(r); setEstado("hecho");
    } catch (e) {
      if (e.message === "cancelado") { setEstado("listo"); Tienda.aviso("Exportación cancelada", "info"); }
      else { console.error(e); setError(e.message || String(e)); setEstado("error"); }
    }
    Motor.pedirCuadro();
  };
  const guardar = async () => { try { const como = await Plataforma.guardarArchivo(res.blob, res.nombre); Tienda.aviso(como === "guardado" ? "Video guardado" : "Descargando " + res.nombre, "ok"); } catch (e) { Tienda.aviso(e.message, "error", 6000); } };
  const compartir = async () => { try { await Plataforma.compartir(res.blob, res.nombre, Tienda.get().marca.nombre); } catch (e) { if (e.name !== "AbortError") Tienda.aviso("No se pudo compartir: " + e.message, "error"); } };
  const ar = `${p.formato.ancho} / ${p.formato.alto}`, pw = 240, ph = Math.round((pw * p.formato.alto) / p.formato.ancho);
  return html`<${Dialogo} titulo=${estado === "hecho" ? "¡Video listo!" : "Exportar video"} alCerrar=${cerrar}>
    ${estado === "listo" && html`
      <div class="fila-datos"><span>Duración <b>${fmtTiempo(D, true)}</b></span><span>Formato <b>${p.formato.id}</b></span><span>Cuadros <b>${Math.ceil(D * (p.formato.fps || 30))}</b> a ${p.formato.fps || 30} por segundo</span></div>
      <${Campo} etiqueta="Calidad"><${Opciones} valor=${cal} opciones=${deObjeto(Exportador.CALIDADES)} alCambiar=${setCal} /><//>
      <div class="nota">Se arma cuadro por cuadro: en una compu tarda más o menos lo que dura el video; en el celular puede tardar el doble. No cierres esta pestaña mientras tanto.</div>
      <${Boton} tipo="primario" grande icono="exportar" onClick=${empezar}>Exportar MP4<//>`}
    ${estado === "exportando" && html`
      <canvas ref=${ref} width=${pw} height=${ph} class="prev-export" style=${{ "--ar": ar, width: "auto", height: Math.min(ph, 320) + "px", margin: "0 auto" }}></canvas>
      <${Avance} f=${av.f} /><div class="fila" style=${{ justifyContent: "space-between" }}><span class="nota">${av.txt || "Preparando…"}</span><b>${Math.round(av.f * 100)} %</b></div>
      <${Boton} tipo="fantasma" onClick=${() => { cancelar.current = true; }}>Cancelar<//>`}
    ${estado === "hecho" && res && html`
      <video class="prev-export" style=${{ "--ar": ar }} src=${url.current} controls playsInline></video>
      <div class="fila-datos"><span><b>${res.nombre}</b></span><span>${pesoTxt(res.blob.size)}</span><span>${res.ancho}×${res.alto}</span>${res.segundos && html`<span>hecho en ${Math.round(res.segundos)} s</span>`}</div>
      <div class="fila"><${Boton} tipo="primario" grande icono="exportar" onClick=${guardar}>Guardar el video<//>
        ${Plataforma.puede("compartir") && html`<${Boton} grande icono="compartir" onClick=${compartir}>Compartir<//>`}</div>
      <div class="nota">Para TikTok: subilo como está, ya viene en vertical y con los gráficos fuera de la zona que tapan los botones.</div>
      <${Boton} tipo="fantasma" onClick=${() => setEstado("listo")}>Exportar de nuevo<//>`}
    ${estado === "error" && html`<div class="nota alerta">No se pudo exportar: ${error}</div><div class="nota">Probá con la calidad Liviana, o abrí el editor en Chrome de compu.</div>
      <${Boton} onClick=${() => setEstado("listo")}>Volver a intentar<//>`}
  <//>`;
}

// ── Modo filmable ──
const CAPAS_FILMABLE = [["mosca", "Mosca"], ["zocalo-ultimo", "Zócalo"], ["ticker", "Ticker"], ["ubicacion", "Ubicación"], ["fecha", "Fecha"]];
function Filmable() {
  const volverA = useTienda((e) => e.volverA) || "inicio", ref = useRef(null);
  const [capas, setCapas] = useState(() => leerLS("filmable-capas", ["mosca", "zocalo-ultimo"])), [titulo, setTitulo] = useState("ÚLTIMO MOMENTO"), [bajada, setBajada] = useState("EN VIVO DESDE EL LUGAR DEL HECHO");
  const [pegar, setPegar] = useState(true), [frontal, setFrontal] = useState(true), [grabando, setGrabando] = useState(false), [seg, setSeg] = useState(0), [medio, setMedio] = useState(null), [error, setError] = useState("");
  const [prompter, setPrompter] = useState(false), [guion, setGuion] = useState(() => leerLS("guion", GUION_EJEMPLO));
  useEffect(() => { Camara.abrir(ref.current, { frontal }).catch((e) => setError(e.message)); return () => Camara.cerrar(); }, [frontal]);
  useEffect(() => {
    guardarLS("filmable-capas", capas);
    Camara.ponerGraficos(capas.map((pl) => ({ plantilla: pl, params: pl === "zocalo-ultimo" ? { titulo, texto: bajada } : {} })), pegar);
  }, [capas, titulo, bajada, pegar]);
  useEffect(() => { if (!grabando) return; const i = setInterval(() => setSeg(Camara.segundos), 250); return () => clearInterval(i); }, [grabando]);
  const grabar = async () => {
    if (!grabando) { setMedio(null); Camara.ponerGraficos(capas.map((pl) => ({ plantilla: pl, params: pl === "zocalo-ultimo" ? { titulo, texto: bajada } : {} })), pegar); Camara.grabar(); setGrabando(true); }
    else { setGrabando(false); const m = await Camara.cortar(); if (m) { setMedio(m); Tienda.aviso("Grabado: " + durTxt(m.duracion), "ok"); } }
  };
  const usar = async () => {
    Camara.cerrar();
    if (!(volverA === "editor" && Tienda.get().proyecto)) await Tienda.nuevo("9:16");
    Tienda.set({ pantalla: "editor" });
    Acciones.agregarMedio(medio, "video", Proyecto.duracion(Tienda.get().proyecto) > 1 ? Proyecto.duracion(Tienda.get().proyecto) : 0);
  };
  const alternar = (pl) => setCapas((c) => (c.includes(pl) ? c.filter((x) => x !== pl) : [...c, pl]));
  return html`<div class="filmable">
    <div class="arriba"><${Boton} icono="atras" tipo="fantasma" onClick=${() => { Camara.cerrar(); Tienda.set({ pantalla: volverA }); }}>Salir<//>
      ${CAPAS_FILMABLE.map(([pl, n]) => html`<${Boton} key=${pl} chico tipo=${capas.includes(pl) ? "activo" : ""} onClick=${() => alternar(pl)}>${n}<//>`)}
      <${Boton} chico tipo=${prompter ? "activo" : ""} onClick=${() => setPrompter(!prompter)}>Apuntador<//></div>
    <div class="marco"><canvas ref=${ref} aria-label="Cámara con gráficos"></canvas>
      ${prompter && html`<div class="prompter">${guion}</div>`}
      ${error && html`<div class="velo" style=${{ position: "absolute" }}><div class="dialogo"><div class="cont"><b>No pude abrir la cámara</b><div class="nota">${error}</div><${Boton} onClick=${() => Tienda.set({ pantalla: volverA })}>Volver<//></div></div></div>`}</div>
    <div class="abajo">
      ${capas.includes("zocalo-ultimo") && !grabando && html`<input class="entrada" aria-label="Título del zócalo" style=${{ maxWidth: "200px" }} value=${titulo} onInput=${(e) => setTitulo(e.target.value.toUpperCase())} />
        <input class="entrada" aria-label="Bajada del zócalo" style=${{ maxWidth: "280px" }} value=${bajada} onInput=${(e) => setBajada(e.target.value.toUpperCase())} />`}
      ${prompter && !grabando && html`<input class="entrada" aria-label="Texto del apuntador" style=${{ maxWidth: "280px" }} value=${guion} onInput=${(e) => setGuion(e.target.value)} />`}
      <${Chequeo} id="pegar-graf" etiqueta="Grabar con los gráficos" valor=${pegar} alCambiar=${setPegar} />
      <${Boton} icono="girar" titulo="Cambiar de cámara" desactivado=${grabando} onClick=${() => setFrontal(!frontal)} />
      <button type="button" class=${"grabar" + (grabando ? " si" : "")} aria-label=${grabando ? "Parar" : "Grabar"} onClick=${grabar}></button>
      <span class="reloj">${grabando ? fmtTiempo(seg) : ""}</span>
      ${medio && !grabando && html`<${Boton} tipo="primario" icono="check" onClick=${usar}>Usar en el video<//>`}
    </div></div>`;
}

// ── App ──
function App() {
  const pantalla = useTienda((e) => e.pantalla), [listo, setListo] = useState(false);
  useEffect(() => {
    (async () => {
      await Promise.all([Tienda.cargarMarca(), Medios.cargarTodos()]);
      Almacen.persistente(); Plantillas.cargarRecursos(Tienda.get().marca);
      setListo(true);
    })();
    // Que no se pierda nada al cerrar la pestaña con cambios sin guardar.
    const antes = (e) => { if (!Tienda.get().guardado) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", antes); return () => removeEventListener("beforeunload", antes);
  }, []);
  if (!listo) return html`<div style=${{ display: "grid", placeItems: "center", height: "100%" }}><img src=${LOGO_B64} alt="Cargando" style=${{ width: "160px", opacity: 0.8 }} /></div>`;
  return html`${pantalla === "editor" && Tienda.get().proyecto ? html`<${Editor} />` : pantalla === "marca" ? html`<${MiMarca} />` : pantalla === "filmable" ? html`<${Filmable} />` : html`<${Inicio} />`}<${Avisos} />`;
}
// El botón de atrás del celular (app de Android): cierra lo abierto, después vuelve al inicio.
window.epAtras = () => {
  const e = Tienda.get();
  if (e.exportando) return true;   // mientras exporta no se sale
  if (e.pantalla === "editor") {
    if (e.inspector && e.seleccion) { Tienda.set({ inspector: false }); return true; }
    if (e.panel) { Tienda.set({ panel: null }); return true; }
    if (e.seleccion) { Tienda.set({ seleccion: null }); return true; }
    Motor.parar(); Tienda.cerrar(); return true;
  }
  if (e.pantalla === "filmable") { Camara.cerrar(); Tienda.set({ pantalla: e.volverA || "inicio" }); return true; }
  if (e.pantalla !== "inicio") { Tienda.set({ pantalla: e.volverA || "inicio" }); return true; }
  return false;
};
ReactDOM.createRoot(document.getElementById("app")).render(html`<${App} />`);
