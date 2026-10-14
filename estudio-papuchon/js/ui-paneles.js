"use strict";
// ════════════════════════════════════════════════════════════════════════
// Paneles (medios, gráficos, texto, subtítulos, voz, audio, ajustes) y el
// inspector, que muestra lo que se puede cambiar del clip elegido.
// ════════════════════════════════════════════════════════════════════════
const TITULOS_PANEL = { medios: "Medios", plantillas: "Gráficos del canal", texto: "Texto", subtitulos: "Subtítulos", voz: "Voz del locutor", audio: "Música y efectos", proyecto: "Ajustes" };
function Panel() {
  const panel = useTienda((e) => e.panel);
  const Cuerpo = { medios: PanelMedios, plantillas: PanelPlantillas, texto: PanelTexto, subtitulos: PanelSubtitulos, voz: PanelVoz, audio: PanelAudio, proyecto: PanelProyecto }[panel];
  return html`<aside class="panel" aria-label=${TITULOS_PANEL[panel]}><header><h3>${TITULOS_PANEL[panel]}</h3><${Boton} icono="cerrar" tipo="fantasma" chico titulo="Cerrar panel" onClick=${() => Tienda.set({ panel: null })} /></header>
    <div class="cuerpo">${Cuerpo && html`<${Cuerpo} />`}</div></aside>`;
}

// ── Medios ──
function PanelMedios() {
  const medios = useMedios(), [encima, setEncima] = useState(false);
  const importar = async (accept) => { const r = await importarArchivos(await elegirArchivos(accept)); if (r.length === 1) Acciones.agregarMedio(r[0], r[0].tipo === "audio" ? "musica" : "video"); };
  const visibles = medios.filter((m) => !m.origen || m.origen === "camara" || m.origen === "microfono");
  return html`
    <div class=${"soltar" + (encima ? " encima" : "")} onDragOver=${(e) => { e.preventDefault(); setEncima(true); }} onDragLeave=${() => setEncima(false)} onDrop=${() => setEncima(false)}>
      <${Icono} n="subir" t=${30} />
      <div>Traé tus videos, fotos o audios. <span class="solo-pc">También podés soltarlos acá.</span></div>
      <div class="fila" style=${{ justifyContent: "center" }}>
        <${Boton} tipo="primario" icono="medios" onClick=${() => importar("video/*,image/*,audio/*")}>Importar<//>
        ${Plataforma.puede("camara") && html`<${Boton} icono="camara" onClick=${() => Tienda.set({ pantalla: "filmable", volverA: "editor" })}>Filmar<//>`}
      </div>
    </div>
    ${visibles.length ? html`<div class="nota">Tocá un medio para ponerlo donde está la raya. <b>Encima</b> lo pone en un recuadro sobre el video.</div>
      <div class="grilla-medios">${visibles.map((m) => html`<${TarjetaMedio} key=${m.id} m=${m} />`)}</div>`
    : html`<div class="nota">Todavía no importaste nada. Los archivos quedan guardados en este navegador.</div>`}`;
}
function TarjetaMedio({ m }) {
  const mini = m.miniaturas && m.miniaturas[Math.floor(m.miniaturas.length / 3)];
  const principal = m.tipo === "audio" ? "musica" : "video";
  return html`<div class="medio">
    <div class="mini" style=${mini ? { backgroundImage: `url(${mini})` } : null} onClick=${() => Acciones.agregarMedio(m, principal)} role="button" tabIndex="0" aria-label=${"Agregar " + m.nombre}>
      ${!mini && html`<${Icono} n=${m.tipo === "audio" ? "musica" : m.tipo === "imagen" ? "imagen" : "medios"} t=${28} />`}
      ${m.tipo !== "imagen" && html`<small>${durTxt(m.duracion || 0)}</small>`}<span class="usar">+ Agregar</span></div>
    <div class="pie"><span title=${m.nombre}>${m.nombre}</span>
      ${m.tipo !== "audio" ? html`<${Boton} chico tipo="fantasma" titulo="Poner encima del video" onClick=${() => Acciones.agregarMedio(m, "superpuesta")}>Encima<//>`
        : html`<${Boton} chico tipo="fantasma" titulo="Usar como voz" onClick=${() => Acciones.agregarMedio(m, "voz")}>Voz<//>`}
      <${BorrarSeguro} titulo="Borrar de la biblioteca" onClick=${async () => {
        const usado = Proyecto.medios(Tienda.get().proyecto).includes(m.id);
        if (usado) { Tienda.aviso("Está en uso en este video: sacalo primero de la línea de tiempo", "error"); return; }
        await Medios.borrar(m.id); Tienda.set({ versionMedios: (Tienda.get().versionMedios || 0) + 1 });
      }} />
    </div></div>`;
}

// ── Gráficos (plantillas) ──
let fondoMuestra = null;
function fondoDeMuestra(W, H) {
  if (fondoMuestra && fondoMuestra.width === W) return fondoMuestra;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#3d4a5c"); gr.addColorStop(0.5, "#27303d"); gr.addColorStop(1, "#151a22"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.06)"; for (let i = 0; i < 7; i++) g.fillRect(W * 0.1 + i * W * 0.13, H * 0.42, W * 0.08, H * 0.3);
  g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(W * 0.5, H * 0.58, W * 0.2, 0, 7); g.fill(); g.fillRect(W * 0.22, H * 0.68, W * 0.56, H * 0.4);
  return (fondoMuestra = c);
}
function MuestraPlantilla({ pl, formato, t }) {
  const ref = useRef(null), marca = useTienda((e) => e.marca);
  useEffect(() => {
    let vivo = true;
    Compositor.recursos(marca).then((rec) => {
      const cv = ref.current; if (!cv || !vivo) return;
      const W = formato.ancho, H = formato.alto, e = 200 / W; cv.width = 200; cv.height = Math.round(H * e);
      const g = cv.getContext("2d"); g.setTransform(e, 0, 0, e, 0, 0); g.drawImage(fondoDeMuestra(W, H), 0, 0);
      const clip = { id: "muestra", plantilla: pl.id, inicio: 0, duracion: Math.max(pl.duracion, 3), params: {}, caja: {} };
      const tt = t != null ? t : Math.min(pl.duracion * 0.55, 1.9);
      Plantillas.dibujarClip(g, clip, tt, W, H, rec);
    });
    return () => { vivo = false; };
  }, [pl.id, formato.id, marca]);
  return html`<canvas ref=${ref} style=${{ aspectRatio: `${formato.ancho} / ${formato.alto}` }}></canvas>`;
}
function PanelPlantillas() {
  const p = useTienda((e) => e.proyecto), grupos = Plantillas.GRUPOS;
  return html`
    <div class="destacado"><b>Vestir el video en un toque</b><div class="nota">Pone intro, mosca con el logo, zócalo, ticker, barra de progreso y cierre, ajustados a lo que dura tu video.</div>
      <div><${Boton} tipo="primario" icono="varita" onClick=${Acciones.vestir}>Vestir con el canal<//></div></div>
    ${Object.entries(grupos).map(([g, nombre]) => {
      const lista = Plantillas.lista.filter((x) => x.grupo === g); if (!lista.length) return null;
      return html`<div key=${g} class="pila"><div class="rotulo">${nombre}</div><div class="galeria">${lista.map((pl) => html`
        <button key=${pl.id} type="button" class="plantilla" title=${pl.descripcion} onClick=${() => Acciones.agregarGrafico(pl.id)}>
          <${MuestraPlantilla} pl=${pl} formato=${p.formato} /><span>${pl.nombre}</span></button>`)}</div></div>`;
    })}`;
}

// ── Texto rápido ──
function PanelTexto() {
  const [txt, setTxt] = useState("MIRÁ LO QUE PASÓ"), [estilo, setEstilo] = useState("caja"), [anim, setAnim] = useState("pop");
  const pl = Plantillas.porId("texto"), opc = (k) => pl.params.find((x) => x.clave === k).opciones;
  return html`
    <${Campo} etiqueta="Qué dice" para="texto-rapido"><textarea id="texto-rapido" class="entrada" value=${txt} onInput=${(e) => setTxt(e.target.value)}></textarea><//>
    <${Campo} etiqueta="Estilo"><${Opciones} valor=${estilo} opciones=${opc("estilo")} alCambiar=${setEstilo} /><//>
    <${Campo} etiqueta="Cómo entra"><${Opciones} valor=${anim} opciones=${opc("animacion")} alCambiar=${setAnim} /><//>
    <${Boton} tipo="primario" icono="mas" onClick=${() => Acciones.agregarGrafico("texto", { texto: txt, estilo, animacion: anim })}>Agregar en la raya<//>
    <div class="separa"></div>
    <div class="rotulo">Atajos</div>
    <div class="fila">
      <${Boton} chico onClick=${() => Acciones.agregarGrafico("titular", { texto: txt.includes("*") ? txt : "*" + txt + "*" })}>Como titular<//>
      <${Boton} chico onClick=${() => Acciones.agregarGrafico("cita", { texto: txt })}>Como cita<//>
      <${Boton} chico onClick=${() => Acciones.agregarGrafico("zocalo-ultimo", { titulo: "ÚLTIMO MOMENTO", texto: txt })}>En un zócalo<//>
    </div>
    <div class="nota">En el titular, lo que pongas entre asteriscos sale resaltado: <b>*ESCÁNDALO*</b> en el concejo.</div>`;
}

// ── Subtítulos ──
function PanelSubtitulos() {
  const p = useTienda((e) => e.proyecto), sel = useTienda((e) => e.seleccion), t = useTiempo();
  const pista = Proyecto.pista(p, "subtitulos"), est = pista.estilo || {};
  const [guion, setGuion] = useState(""), [dur, setDur] = useState(10);
  const voces = p.pistas.filter((k) => k.tipo === "audio").flatMap((k) => k.clips.map((c) => ({ c, m: Medios.datos(c.medio) }))).filter((x) => x.m && x.m.palabras);
  const elegido = sel && Proyecto.buscarClip(p, sel);
  const deVoces = () => {
    let n = 0;
    Tienda.cambiar((q) => { for (const v of voces) { const l = Subtitulos.desdeVoz(v.c, v.m); n += l.length; q = Proyecto.agregarSubtitulos(q, l); } return q; }, "subtítulos de la voz");
    Tienda.aviso(n ? `Listo: ${n} subtítulos` : "No encontré voces generadas", n ? "ok" : "info");
  };
  const repartir = () => {
    if (!guion.trim()) return;
    let ini = t, d = dur;
    if (elegido && elegido.clip.medio) { ini = elegido.clip.inicio; d = Proyecto.dur(elegido.clip); }
    Tienda.cambiar((q) => Proyecto.agregarSubtitulos(q, Subtitulos.estimar(guion, ini, d)), "subtítulos");
    Tienda.aviso("Subtítulos repartidos. Si alguno no cae justo, tocalo en la línea de tiempo y movelo.", "ok", 4500);
  };
  const srt = async () => {
    const [f] = await elegirArchivos(".srt,text/plain", false); if (!f) return;
    const l = Subtitulos.leerSRT(await f.text()); if (!l.length) { Tienda.aviso("Ese archivo no tiene subtítulos que pueda leer", "error"); return; }
    Tienda.cambiar((q) => Proyecto.agregarSubtitulos(q, l), "importar SRT"); Tienda.aviso(`Importados ${l.length} subtítulos`, "ok");
  };
  const bajarSRT = () => Plataforma.guardarArchivo(new Blob([Subtitulos.escribirSRT(pista)], { type: "text/plain" }), Exportador.nombreArchivo(p, "srt")).catch((e) => Tienda.aviso(e.message, "error"));
  const cambiarEstilo = (c) => Tienda.cambiar((q) => Proyecto.cambiarPista(q, pista.id, { estilo: c }), "estilo de subtítulos");
  return html`
    <${Campo} etiqueta="Estilo"><${Opciones} valor=${est.plantilla || "subs-karaoke"} opciones=${deObjeto(Plantillas.ESTILOS_SUBS)} alCambiar=${(v) => cambiarEstilo({ plantilla: v })} /><//>
    <${Deslizador} id="subs-tamano" etiqueta="Tamaño" valor=${est.tamano || 1} min=${0.6} max=${1.6} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => cambiarEstilo({ tamano: v })} />
    <${Deslizador} id="subs-altura" etiqueta="Altura" valor=${est.y != null ? est.y : p.formato.id === "9:16" ? 1490 : p.formato.alto - 150} min=${200} max=${p.formato.alto - 60} paso=${10} formato=${(v) => Math.round((v / p.formato.alto) * 100) + " %"} alCambiar=${(v) => cambiarEstilo({ y: v })} />
    <div class="separa"></div>
    <div class="destacado"><b>De la voz del locutor</b>
      <div class="nota">${voces.length ? `Hay ${voces.length} ${voces.length === 1 ? "voz generada" : "voces generadas"}: los subtítulos salen palabra por palabra.` : "Generá una voz en el panel Voz y los subtítulos salen solos."}</div>
      <div><${Boton} tipo="primario" icono="subs" desactivado=${!voces.length} onClick=${deVoces}>Crear de las voces<//></div></div>
    <${Campo} etiqueta="O escribí lo que se dice" para="subs-guion"><textarea id="subs-guion" class="entrada" placeholder="Pegá acá lo que dice el video y lo reparto en el tiempo." value=${guion} onInput=${(e) => setGuion(e.target.value)}></textarea><//>
    ${elegido && elegido.clip.medio ? html`<div class="nota">Se reparte a lo largo del clip elegido (${durTxt(Proyecto.dur(elegido.clip))}).</div>`
      : html`<${Deslizador} id="subs-dur" etiqueta="Durante" valor=${dur} min=${2} max=${120} paso=${1} formato=${(v) => v + " s desde la raya"} alCambiar=${setDur} />`}
    <${Boton} icono="subs" desactivado=${!guion.trim()} onClick=${repartir}>Repartir subtítulos<//>
    <div class="fila"><${Boton} chico icono="subir" onClick=${srt}>Importar SRT<//><${Boton} chico icono="exportar" desactivado=${!pista.clips.length} onClick=${bajarSRT}>Bajar SRT<//>
      ${pista.clips.length > 0 && html`<${BorrarSeguro} titulo="Borrar todos los subtítulos" onClick=${() => Tienda.cambiar((q) => Proyecto.cambiarPista(q, pista.id, { clips: [] }), "borrar subtítulos")} />`}</div>
    ${pista.clips.length > 0 && html`<div class="lista">${pista.clips.map((c) => html`<div key=${c.id} class="item" role="button" tabIndex="0" onClick=${() => { Motor.ir(c.inicio + 0.01); Acciones.elegir(c.id); }}>
      <span class="t">${fmtTiempo(c.inicio, true)}</span><div>${c.texto}</div></div>`)}</div>`}`;
}

// ── Voz ──
const GUION_EJEMPLO = "Último momento. Vecinos del barrio cortaron la ruta doce y reclaman por la falta de agua desde hace tres días. Seguí la información en Noticias El Papuchón.";
function PanelVoz() {
  const [texto, setTexto] = useState(() => leerLS("guion", GUION_EJEMPLO)), [estilo, setEstilo] = useState("locutor"), [vel, setVel] = useState(1), [grave, setGrave] = useState(true), [conSubs, setConSubs] = useState(true);
  const [est, setEst] = useState(Voces.estado), [ocupado, setOcupado] = useState(false), [ultima, setUltima] = useState(null), [grabando, setGrabando] = useState(false), [seg, setSeg] = useState(0);
  useEffect(() => Voces.alCambiar(setEst), []);
  useEffect(() => { guardarLS("guion", texto); }, [texto]);
  useEffect(() => { if (!grabando) return; const t0 = Date.now(), i = setInterval(() => setSeg((Date.now() - t0) / 1000), 200); return () => clearInterval(i); }, [grabando]);
  const generar = async () => {
    if (!texto.trim() || ocupado) return; setOcupado(true);
    try {
      const m = await Voces.generarMedio(texto, { estilo, velocidad: vel, grave });
      const c = Acciones.agregarMedio(m, "voz");
      if (conSubs && c) Tienda.cambiar((q) => Proyecto.agregarSubtitulos(q, Subtitulos.desdeVoz(c, m)), "subtítulos de la voz");
      setUltima(m); Tienda.aviso(`Voz lista (${durTxt(m.duracion)})${conSubs ? " con subtítulos" : ""}`, "ok");
    } catch (e) { Tienda.aviso("No se pudo generar la voz: " + e.message, "error", 7000); }
    setOcupado(false);
  };
  const microfono = async () => {
    try {
      if (!grabando) { Motor.parar(); await Voces.grabar(); setSeg(0); setGrabando(true); }
      else { setGrabando(false); const m = await Voces.cortar(); if (m) Acciones.agregarMedio(m, "voz"); }
    } catch (e) { setGrabando(false); Tienda.aviso(e.message, "error", 6000); }
  };
  const puede = Plataforma.puede("vozNeural"), cargando = ocupado && est.fase !== "lista" && est.fase !== "Hablando";
  return html`
    ${!puede && html`<div class="nota alerta">La voz generada necesita bajar el modelo del locutor, y desde esta vista no se puede. Abrí el editor desde el link de githack o desde el archivo descargado.</div>`}
    <${Campo} etiqueta="Guion" para="guion-voz"><textarea id="guion-voz" class="entrada" rows="6" value=${texto} onInput=${(e) => setTexto(e.target.value)}></textarea><//>
    <${Campo} etiqueta="Tono"><${Opciones} valor=${estilo} opciones=${deObjeto(Voces.ESTILOS)} alCambiar=${setEstilo} /><//>
    <${Deslizador} id="voz-vel" etiqueta="Velocidad" valor=${vel} min=${0.8} max=${1.35} paso=${0.05} formato=${(v) => (v === 1 ? "normal" : Math.round(v * 100) + " %")} alCambiar=${setVel} />
    <${Chequeo} id="voz-grave" etiqueta="Voz más grave" valor=${grave} alCambiar=${setGrave} />
    <${Chequeo} id="voz-subs" etiqueta="Crear los subtítulos también" valor=${conSubs} alCambiar=${setConSubs} />
    <${Boton} tipo="primario" grande icono="micro" desactivado=${!puede || ocupado || !texto.trim()} onClick=${generar}>${ocupado ? "Generando…" : "Generar voz de locutor"}<//>
    ${ocupado && cargando && html`<div class="pila" style=${{ gap: "6px" }}><div class="nota">${est.fase}${est.fase === "Bajando la voz" ? ` · ${Math.round(est.avance * 100)} % de 63 MB (solo la primera vez)` : "…"}</div><${Avance} f=${est.avance || 0} /></div>`}
    ${ultima && html`<${Boton} icono="parlante" onClick=${() => Motor.escuchar(ultima.id)}>Escuchar la última<//>`}
    <div class="nota">Locutor hombre, voz sintética (no imita a nadie). La primera vez baja el modelo; después funciona sin internet.</div>
    <div class="separa"></div>
    <div class="rotulo">Tu propia voz</div>
    ${Plataforma.puede("microfono") ? html`<div class="fila"><${Boton} tipo=${grabando ? "primario" : ""} icono="micro" onClick=${microfono}>${grabando ? `Parar (${fmtTiempo(seg)})` : "Grabar con el micrófono"}<//></div>
      <div class="nota">Se agrega en la pista de voz, donde está la raya.</div>`
      : html`<div class="nota">Para grabar tu voz acá, abrí el editor desde githack. También podés importar un audio desde Medios.</div>`}`;
}

// ── Música y efectos ──
function PanelAudio() {
  const p = useTienda((e) => e.proyecto), [haciendo, setHaciendo] = useState(null), [sonando, setSonando] = useState(null);
  const conseguir = async (tipo, k) => { setHaciendo(k); try { return await Musica.medio(tipo, k); } catch (e) { Tienda.aviso(e.message, "error"); return null; } finally { setHaciendo(null); } };
  const escuchar = async (tipo, k) => { if (sonando === k) { Motor.callar(); setSonando(null); return; } const m = await conseguir(tipo, k); if (!m) return; setSonando(k); await Motor.escuchar(m.id); setSonando((s) => (s === k ? null : s)); };
  const poner = async (tipo, k) => {
    const m = await conseguir(tipo, k); if (!m) return; Motor.callar(); setSonando(null);
    if (tipo === "cortina") {
      const D = Proyecto.duracion(p), c = Acciones.agregarMedio(m, "musica", 0);
      if (c) Tienda.cambiar((q) => Proyecto.cambiarClip(q, c.id, { hasta: Math.min(m.duracion, Math.max(3, D)), volumen: 0.55, fundidoSalida: 1.5 }), "ajustar música");
    } else Acciones.agregarMedio(m, "efectos");
  };
  const fila = (tipo, k, d) => html`<div key=${k} class="item"><div><b>${d.nombre}</b>${d.detalle && html`<small>${d.detalle}</small>`}</div>
    <${Boton} chico icono=${sonando === k ? "pausa" : "play"} titulo="Escuchar" desactivado=${haciendo === k} onClick=${() => escuchar(tipo, k)} />
    <${Boton} chico icono="mas" tipo="amarillo" titulo="Agregar" desactivado=${haciendo === k} onClick=${() => poner(tipo, k)}>${haciendo === k ? "…" : ""}<//></div>`;
  const au = p.audio || {};
  return html`
    <div class="rotulo">Música del canal</div>
    <div class="lista">${Object.entries(Musica.CORTINAS).map(([k, d]) => fila("cortina", k, d))}</div>
    <div class="nota">Hecha acá mismo: no tiene derechos de nadie, TikTok no la silencia.</div>
    <div class="rotulo">Efectos</div>
    <div class="lista">${Object.entries(Musica.EFECTOS).map(([k, d]) => fila("efecto", k, d))}</div>
    <${Boton} icono="subir" onClick=${async () => { const r = await importarArchivos(await elegirArchivos("audio/*")); for (const m of r) Acciones.agregarMedio(m, "musica"); }}>Importar tu música<//>
    <div class="separa"></div>
    <${Chequeo} id="ducking" etiqueta="Bajar la música cuando habla la voz" valor=${au.ducking !== false} alCambiar=${(v) => Tienda.cambiar((q) => ({ ...q, audio: { ...q.audio, ducking: v } }), "ducking")} />
    ${au.ducking !== false && html`<${Deslizador} id="ducking-nivel" etiqueta="Música mientras habla" valor=${au.nivelDucking || 0.3} min=${0.05} max=${0.8} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"}
      alCambiar=${(v) => Tienda.cambiar((q) => ({ ...q, audio: { ...q.audio, nivelDucking: v } }), "ducking")} />`}`;
}

// ── Ajustes del proyecto ──
function PanelProyecto() {
  const p = useTienda((e) => e.proyecto), zona = useTienda((e) => e.zonaSegura), [foto, setFoto] = useState(false);
  const portada = async () => { setFoto(true); try { const r = await Exportador.foto(p, Motor.tiempo()); await Plataforma.guardarArchivo(r.blob, r.nombre); Tienda.aviso("Portada guardada", "ok"); } catch (e) { Tienda.aviso(e.message, "error"); } setFoto(false); };
  return html`
    <${Campo} etiqueta="Formato"><${Opciones} valor=${p.formato.id} opciones=${Object.values(EP.FORMATOS).map((f) => ({ v: f.id, etiqueta: `${f.id} ${f.nombre}` }))} alCambiar=${(v) => Tienda.cambiar((q) => Proyecto.cambiarFormato(q, v), "formato")} /><//>
    <div class="nota">${EP.FORMATOS[p.formato.id].detalle}. Los gráficos se reacomodan solos.</div>
    <${Campo} etiqueta="Fondo (donde no hay video)"><${Color} valor=${p.fondo} alCambiar=${(v) => Tienda.cambiar((q) => ({ ...q, fondo: color(v, Tienda.get().marca) }), "fondo")} /><//>
    ${p.formato.id === "9:16" && html`<${Chequeo} id="zona-tiktok" etiqueta="Mostrar lo que tapan los botones de TikTok" valor=${zona} alCambiar=${(v) => Tienda.set({ zonaSegura: v })} />`}
    <div class="separa"></div>
    <${Boton} icono="foto" desactivado=${foto} onClick=${portada}>Guardar foto de portada (cuadro actual)<//>
    <${Boton} icono="sol" onClick=${() => Tienda.set({ pantalla: "marca", volverA: "editor" })}>Mi marca: logo, colores y @usuario<//>
    <div class="separa"></div>
    <div class="rotulo">Atajos de teclado</div>
    <div class="nota">Espacio reproduce · S corta · Supr borra · Ctrl+D duplica · Ctrl+Z deshace · flechas: cuadro a cuadro (con Shift, de a un segundo)</div>`;
}

// ════ Inspector ════
function Inspector() {
  const p = useTienda((e) => e.proyecto), sel = useTienda((e) => e.seleccion), sec = useTienda((e) => e.inspector), chico = useAncho() < 900;
  const b = sel && Proyecto.buscarClip(p, sel); if (!b) return null;
  const { pista, clip: c } = b;
  // En el celular se ve solo la parte que pidió la herramienta (Velocidad, Volumen…), como en CapCut.
  const filtro = chico && typeof sec === "string" ? sec : null, ver = (k) => !filtro || filtro === k;
  const Cuerpo = c.plantilla ? InspGrafico : pista.tipo === "subtitulos" ? InspSubtitulo : pista.tipo === "audio" ? InspAudio : InspMedio;
  const herr = filtro && herramientasClip(p, b).find((h) => h.sec === filtro);
  const titulo = herr ? herr.et : c.plantilla ? (Plantillas.porId(c.plantilla) || {}).nombre || "Gráfico" : pista.tipo === "subtitulos" ? "Subtítulo" : pista.tipo === "audio" ? "Audio" : pista.tipo === "superpuesta" ? "Video encima" : "Clip";
  return html`<aside class="inspector" aria-label="Propiedades del clip"><header><h3>${titulo}</h3>
      ${chico ? html`<${Boton} chico tipo="amarillo" icono="check" onClick=${() => Tienda.set({ inspector: false })}>Listo<//>`
        : html`<div class="fila" style=${{ gap: "2px" }}><${Boton} chico icono="tijera" tipo="fantasma" titulo="Cortar en la raya" onClick=${Acciones.dividir} />
      <${Boton} chico icono="copiar" tipo="fantasma" titulo="Duplicar" onClick=${Acciones.duplicar} /><${Boton} chico icono="basura" tipo="fantasma peligro" titulo="Borrar" onClick=${Acciones.borrar} />
      <${Boton} chico icono="cerrar" tipo="fantasma" titulo="Cerrar" onClick=${() => Tienda.set({ seleccion: null })} /></div>`}</header>
    <div class="cuerpo"><${Cuerpo} key=${c.id} p=${p} pista=${pista} c=${c} ver=${ver} todo=${!filtro} /></div></aside>`;
}
const seg = (v) => v.toFixed(1) + " s";
function Fundidos({ c }) {
  const d = Proyecto.dur(c);
  return html`<${Deslizador} id="fundido-ent" etiqueta="Aparece de a poco" valor=${c.fundidoEntrada || 0} min=${0} max=${Math.min(3, d / 2)} paso=${0.1} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { fundidoEntrada: v }, "fundido")} />
    <${Deslizador} id="fundido-sal" etiqueta="Se va de a poco" valor=${c.fundidoSalida || 0} min=${0} max=${Math.min(3, d / 2)} paso=${0.1} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { fundidoSalida: v }, "fundido")} />`;
}
function InspMedio({ p, pista, c, ver, todo }) {
  const m = Medios.datos(c.medio) || {}, enc = c.encuadre || {}, principal = pista.tipo === "video", idx = pista.clips.findIndex((x) => x.id === c.id);
  const cj = c.caja || {}, W = p.formato.ancho, H = p.formato.alto, sep = todo ? html`<div class="separa"></div>` : null;
  const posicion = (donde) => {
    const an = donde === "partida" ? W : cj.ancho, al = donde === "partida" ? Math.round(H * 0.42) : cj.alto, mg = Math.round(W * 0.05);
    const pos = { arribaIzq: [mg, H * 0.14], arribaDer: [W - an - mg, H * 0.14], centro: [(W - an) / 2, (H - al) / 2], abajoIzq: [mg, H * 0.52], partida: [0, 0] }[donde];
    Acciones.cambiar(c.id, { caja: { x: Math.round(pos[0]), y: Math.round(pos[1]), ancho: an, alto: al, ...(donde === "partida" ? { radio: 0, marco: "ninguno" } : {}) } }, "posición");
  };
  return html`
    ${todo && html`<div class="nota">${m.nombre || "Medio"} · ${durTxt(Proyecto.dur(c))}${m.ancho ? ` · ${m.ancho}×${m.alto}` : ""}</div>`}
    ${ver("velocidad") && m.tipo !== "imagen" && html`<${Deslizador} id="velocidad" etiqueta="Velocidad" valor=${c.velocidad || 1} min=${0.25} max=${4} paso=${0.05} formato=${(v) => v.toFixed(2) + "×"} alCambiar=${(v) => Acciones.cambiar(c.id, { velocidad: v }, "velocidad")} />
      <div class="segmentos">${[0.5, 1, 1.5, 2, 3].map((v) => html`<button key=${v} type="button" class=${(c.velocidad || 1) === v ? "si" : ""} onClick=${() => Acciones.cambiar(c.id, { velocidad: v }, "velocidad")}>${v}×</button>`)}</div>`}
    ${ver("velocidad") && m.tipo === "imagen" && html`<${Deslizador} id="dur-foto" etiqueta="Duración" valor=${Proyecto.dur(c)} min=${0.5} max=${30} paso=${0.1} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { hasta: c.desde + v }, "duración")} />`}
    ${ver("volumen") && m.tipo === "video" && m.tieneAudio !== false && html`<${Deslizador} id="volumen" etiqueta="Volumen del video" valor=${c.volumen ?? 1} min=${0} max=${2} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => Acciones.cambiar(c.id, { volumen: v }, "volumen")} />
      <div class="fila"><${Boton} chico icono=${(c.volumen ?? 1) > 0 ? "mudo" : "parlante"} onClick=${() => Acciones.cambiar(c.id, { volumen: (c.volumen ?? 1) > 0 ? 0 : 1 }, "silenciar")}>${(c.volumen ?? 1) > 0 ? "Silenciar el clip" : "Activar sonido"}<//></div>`}
    ${ver("volumen") && html`<${Fundidos} c=${c} />`}
    ${sep}
    ${ver("encuadre") && principal && html`<${Campo} etiqueta="Encuadre"><${Opciones} valor=${enc.modo || "relleno"} opciones=${deObjeto(Compositor.ENCUADRES)} alCambiar=${(v) => Acciones.cambiar(c.id, { encuadre: { modo: v } }, "encuadre")} /><//>`}
    ${(ver("encuadre") || ver("lugar")) && html`<${Deslizador} id="zoom" etiqueta="Zoom" valor=${enc.zoom || 1} min=${1} max=${3} paso=${0.05} formato=${(v) => v.toFixed(2) + "×"} alCambiar=${(v) => Acciones.cambiar(c.id, { encuadre: { zoom: v } }, "zoom")} />`}
    ${ver("encuadre") && ((enc.zoom || 1) > 1.01 || enc.modo === "cubrir") ? html`<${Deslizador} id="pos-x" etiqueta="Correr a los costados" valor=${enc.x || 0} min=${-0.5} max=${0.5} paso=${0.01} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => Acciones.cambiar(c.id, { encuadre: { x: v } }, "encuadre")} />
      <${Deslizador} id="pos-y" etiqueta="Correr arriba/abajo" valor=${enc.y || 0} min=${-0.5} max=${0.5} paso=${0.01} formato=${(v) => Math.round(v * 100)} alCambiar=${(v) => Acciones.cambiar(c.id, { encuadre: { y: v } }, "encuadre")} />` : null}
    ${ver("encuadre") && html`<${Campo} etiqueta="Movimiento"><${Opciones} valor=${enc.movimiento || "ninguno"} opciones=${deObjeto(Compositor.MOVIMIENTOS)} alCambiar=${(v) => Acciones.cambiar(c.id, { encuadre: { movimiento: v } }, "movimiento")} /><//>`}
    ${ver("filtro") && html`<${Campo} etiqueta="Filtro"><${Opciones} valor=${(c.filtro && c.filtro.tipo) || "ninguno"} opciones=${deObjeto(Compositor.FILTROS)} alCambiar=${(v) => Acciones.cambiar(c.id, { filtro: { tipo: v } }, "filtro")} /><//>`}
    ${ver("transicion") && principal && idx > 0 && html`${sep}
      <${Campo} etiqueta="Transición al entrar"><${Opciones} valor=${(c.transicion && c.transicion.tipo) || "ninguna"} opciones=${deObjeto(Compositor.TRANSICIONES)} alCambiar=${(v) => Acciones.cambiar(c.id, { transicion: { tipo: v, dur: (c.transicion && c.transicion.dur) || 0.5 } }, "transición")} /><//>
      ${c.transicion && c.transicion.tipo !== "ninguna" && html`<${Deslizador} id="trans-dur" etiqueta="Duración de la transición" valor=${c.transicion.dur || 0.5} min=${0.2} max=${1.5} paso=${0.05} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { transicion: { dur: v } }, "transición")} />`}`}
    ${todo && principal && pista.clips.length > 1 && html`<div class="fila"><${Boton} chico icono="izq" desactivado=${idx === 0} onClick=${() => Tienda.cambiar((q) => Proyecto.mover(q, c.id, { indice: idx - 1 }), "mover")}>Antes<//>
      <${Boton} chico icono="der" desactivado=${idx === pista.clips.length - 1} onClick=${() => Tienda.cambiar((q) => Proyecto.mover(q, c.id, { indice: idx + 1 }), "mover")}>Después<//></div>`}
    ${ver("lugar") && !principal && html`${sep}
      <${Campo} etiqueta="Lugar"><div class="segmentos">${[["arribaIzq", "Arriba izq."], ["arribaDer", "Arriba der."], ["centro", "Centro"], ["abajoIzq", "Abajo"], ["partida", "Pantalla partida"]].map(([v, e]) => html`<button key=${v} type="button" onClick=${() => posicion(v)}>${e}</button>`)}</div><//>
      <div class="nota">También lo podés arrastrar en la vista y agrandarlo con la manija amarilla.</div>
      <${Campo} etiqueta="Marco"><${Opciones} valor=${cj.marco || "ninguno"} opciones=${deObjeto(Compositor.MARCOS)} alCambiar=${(v) => Acciones.cambiar(c.id, { caja: { marco: v } }, "marco")} /><//>
      <${Deslizador} id="radio" etiqueta="Esquinas redondeadas" valor=${cj.radio || 0} min=${0} max=${80} paso=${1} formato=${(v) => v + " px"} alCambiar=${(v) => Acciones.cambiar(c.id, { caja: { radio: v } }, "esquinas")} />
      <${Campo} etiqueta="Etiqueta arriba (opcional)" para="etiqueta"><input id="etiqueta" class="entrada" placeholder="EN VIVO, ARCHIVO, CÁMARA 2…" value=${cj.etiqueta || ""} onInput=${(e) => Acciones.cambiar(c.id, { caja: { etiqueta: e.target.value } }, "etiqueta")} /><//>`}`;
}
function CampoParam({ d, valor, alCambiar }) {
  const v = valor !== undefined ? valor : d.defecto, idc = "param-" + d.clave;
  if (d.tipo === "texto") return html`<${Campo} etiqueta=${d.etiqueta} para=${idc}><input id=${idc} class="entrada" value=${v} onInput=${(e) => alCambiar(d.mayus ? e.target.value.toUpperCase() : e.target.value)} /><//>`;
  if (d.tipo === "textoLargo") return html`<${Campo} etiqueta=${d.etiqueta} para=${idc}><textarea id=${idc} class="entrada" value=${v} onInput=${(e) => alCambiar(d.mayus ? e.target.value.toUpperCase() : e.target.value)}></textarea><//>`;
  if (d.tipo === "color") return html`<${Campo} etiqueta=${d.etiqueta}><${Color} valor=${v} alCambiar=${alCambiar} /><//>`;
  if (d.tipo === "opcion") return html`<${Campo} etiqueta=${d.etiqueta}><${Opciones} valor=${v} opciones=${d.opciones} alCambiar=${alCambiar} /><//>`;
  if (d.tipo === "bool") return html`<${Chequeo} id=${idc} etiqueta=${d.etiqueta} valor=${v} alCambiar=${alCambiar} />`;
  if (d.tipo === "numero") return html`<${Deslizador} id=${idc} etiqueta=${d.etiqueta} valor=${v} min=${d.min} max=${d.max} paso=${d.paso} formato=${(x) => (d.max <= 3 ? Math.round(x * 100) + " %" : Math.round(x))} alCambiar=${alCambiar} />`;
  return null;
}
function InspGrafico({ p, c, ver, todo }) {
  const pl = Plantillas.porId(c.plantilla); if (!pl) return html`<div class="nota">Este gráfico ya no existe.</div>`;
  const cj = c.caja || {}, D = Proyecto.duracion(p);
  return html`
    ${todo && html`<div class="nota">${pl.descripcion}</div>`}
    ${ver("editar") && pl.params.map((d) => html`<${CampoParam} key=${d.clave} d=${d} valor=${(c.params || {})[d.clave]} alCambiar=${(v) => Acciones.cambiar(c.id, { params: { [d.clave]: v } }, d.etiqueta)} />`)}
    ${ver("editar") && !pl.params.length && html`<div class="nota">Este gráfico no tiene textos para cambiar.</div>`}
    ${todo && html`<div class="separa"></div>`}
    ${ver("ajustes") && html`<${Deslizador} id="graf-dur" etiqueta="Duración" valor=${c.duracion} min=${0.5} max=${Math.max(60, Math.ceil(D))} paso=${0.1} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { duracion: v }, "duración")} />
    <div class="fila"><${Boton} chico onClick=${() => Acciones.cambiar(c.id, { inicio: 0, duracion: D }, "todo el video")}>Todo el video<//>
      <${Boton} chico onClick=${() => Acciones.cambiar(c.id, { inicio: Motor.tiempo() }, "mover a la raya")}>Empezar en la raya<//></div>
    <${Deslizador} id="graf-escala" etiqueta="Tamaño" valor=${cj.escala || 1} min=${0.3} max=${2.5} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => Acciones.cambiar(c.id, { caja: { escala: v } }, "tamaño")} />
    <${Deslizador} id="graf-rot" etiqueta="Girar" valor=${Math.round(((cj.rot || 0) * 180) / Math.PI)} min=${-45} max=${45} paso=${1} formato=${(v) => v + "°"} alCambiar=${(v) => Acciones.cambiar(c.id, { caja: { rot: (v * Math.PI) / 180 } }, "girar")} />
    ${(cj.x || cj.y || (cj.escala && cj.escala !== 1) || cj.rot) ? html`<${Boton} chico icono="centro" onClick=${() => Acciones.cambiar(c.id, { caja: { x: 0, y: 0, escala: 1, rot: 0 } }, "volver al lugar")}>Volver a su lugar<//>` : null}
    <div class="nota">Arrastralo en la vista para moverlo; la manija amarilla lo agranda.</div>`}`;
}
function InspSubtitulo({ c }) {
  return html`<${Campo} etiqueta="Texto" para="sub-texto"><textarea id="sub-texto" class="entrada" value=${c.texto} onInput=${(e) => Acciones.cambiar(c.id, { texto: e.target.value, palabras: null }, "texto")}></textarea><//>
    <${Deslizador} id="sub-dur" etiqueta="Duración" valor=${c.duracion} min=${0.2} max=${8} paso=${0.05} formato=${seg} alCambiar=${(v) => Acciones.cambiar(c.id, { duracion: v, palabras: null }, "duración")} />
    <div class="nota">El estilo de todos los subtítulos se cambia en el panel Subtítulos.</div>`;
}
function InspAudio({ c, ver, todo }) {
  const m = Medios.datos(c.medio) || {};
  return html`${todo && html`<div class="nota">${m.nombre || "Audio"} · ${durTxt(Proyecto.dur(c))}</div>`}
    ${ver("volumen") && html`<${Deslizador} id="aud-vol" etiqueta="Volumen" valor=${c.volumen ?? 1} min=${0} max=${2} paso=${0.05} formato=${(v) => Math.round(v * 100) + " %"} alCambiar=${(v) => Acciones.cambiar(c.id, { volumen: v }, "volumen")} />
    <${Fundidos} c=${c} />`}
    ${ver("velocidad") && html`<${Deslizador} id="aud-vel" etiqueta="Velocidad" valor=${c.velocidad || 1} min=${0.5} max=${2} paso=${0.05} formato=${(v) => v.toFixed(2) + "×"} alCambiar=${(v) => Acciones.cambiar(c.id, { velocidad: v }, "velocidad")} />`}
    ${todo && m.palabras && html`<${Boton} icono="subs" onClick=${() => { Tienda.cambiar((q) => Proyecto.agregarSubtitulos(q, Subtitulos.desdeVoz(c, m)), "subtítulos"); Tienda.aviso("Subtítulos creados", "ok"); }}>Crear subtítulos de esta voz<//>`}
    ${todo && m.texto && html`<div class="nota">“${m.texto}”</div>`}`;
}
