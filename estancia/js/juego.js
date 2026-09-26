// El juego: arranque, bucle, controles, interfaz, días y el final.
"use strict";
(() => {
  const G = (E.juego = {
    corriendo: false, pausa: false, dia: 1, hora: 6, horasJuego: 6, dinero: 1500000,
    hierroCaliente: 0, comio: false, t: 0, fijo: location.hash === "#fijo",
  });
  const $ = (id) => document.getElementById(id);
  const HORAS_POR_SEGUNDO = 1 / 60;           // una hora de juego, un minuto real
  const miles = new Intl.NumberFormat("es-AR");

  // ── opciones ── se guardan en el navegador de cada uno (si se puede).
  const OPCIONES = { brillo: 1, volumen: 0.9, voz: 1, sensib: 1, ojo: true, subtitulos: true, calidad: null, fpsMedido: null };
  E.opciones = { ...OPCIONES };
  try { Object.assign(E.opciones, JSON.parse(localStorage.getItem("estancia-opciones") || "{}")); } catch (e) { /* sin almacenamiento */ }
  const guardarOpciones = () => { try { localStorage.setItem("estancia-opciones", JSON.stringify(E.opciones)); } catch (e) { /* no importa */ } };

  // ── lo que dice el Guacho ── corto, en argentino y sin malas palabras.
  // Sin malas palabras: rioplatense de campo, con "la pucha" y "qué macana".
  const FRASES = {
    errar: ["¡Uh, la pucha!", "¡Pucha, digo!", "Se me fue por un pelo.", "¡Ay, mamita, qué tiro!"],
    enlazada: ["¡Ahí está, ya te tengo!", "¡Tomá, mañera!", "¡Quieta, quieta!", "Tranquila, negra."],
    cortado: ["¡Se cortó el lazo, pucha digo!", "Este tiento estaba podrido."],
    seFue: ["¡Se me fue con lazo y todo!", "¡Ahí va mi lazo, qué macana!"],
    pialada: ["¡Abajo!", "¡Echate, vamos!", "Ahí está. Quieta."],
    errarPial: ["¡Pará, pará…!", "Casi, casi. Otra vez."],
    todaviaNo: ["Está entera todavía. Hay que cansarla.", "Que se canse primero."],
    patada: ["¡Ay! ¡La costilla…!", "¡Uh, qué patada me pegó!"],
    cornada: ["¡Me ensartó, la mañera!", "¡Ay, ay, ay!"],
    embiste: ["¡Uy, viene!", "¡Cuidado que carga!"],
    sed: ["Me muero de sed.", "Tengo la garganta hecha polvo."],
    calor: ["Qué calor bárbaro.", "Cuarenta a la sombra, y sin sombra."],
    curada: ["Listo, negra. Ya está.", "Así, curadita."],
    lesion: ["Se me mancó el zaino. Lo reventé.", "Uh, el caballo viene rengo."],
    sinLazo: ["No tengo lazo. Hay uno colgado en la galería."],
    fumar: ["Un armado y seguimos."],
    manga: ["Vamos, adentro.", "A la manga, vamos."],
    silbar: ["¡Vení, zaino!"],
    apuntar: ["Ahí la tengo…", "Quieta… quieta…", "Ya sos mía."],
    perros: ["¡Vengan, perros!", "¡Vamos, Tigre! ¡Negra, vení!"],
    quietos: ["¡Quietos ahí!", "¡Echate, Chispa!"],
    junten: ["¡Junten, junten la hacienda!", "¡Vaya, vaya! ¡Juntela!"],
    busquen: ["¡Busque, busque!", "¡Traela, Tigre!"],
    mate: ["Un matecito y seguimos.", "Qué rico este mate amargo."],
    comida: ["A ver qué hay pa' comer.", "Un guiso de arroz, como Dios manda."],
    heladera: ["Agüita fresca, qué lindo."],
    banar: ["Vení, zaino, que te baño.", "Ahí está, limpito."],
    forraje: ["Tomá, comé tranquilo."],
    saludar: ["¡Buenas! ¿Cómo andan?", "¡Buen día, paisano!"],
    puesto: ["Por fin en el puesto."],
    caballoSucio: ["Este zaino está hecho un barro."],
  };

  let ultimaFrase = 0;
  G.decir = (clave, v) => {
    const l = FRASES[clave];
    if (!l) return;
    const i = Math.floor(Math.random() * l.length), texto = l[i];
    E.sonido.voz(clave + "-" + i);
    const s = $("subtitulo");
    s.textContent = texto;
    if (E.opciones.subtitulos) s.classList.add("visible");
    clearTimeout(G._sub);
    G._sub = setTimeout(() => s.classList.remove("visible"), 2600);
    ultimaFrase = G.t;
  };
  G.mostrar = (texto, dura = 3200) => {
    const m = $("mensaje");
    m.textContent = texto;
    m.classList.add("visible");
    clearTimeout(G._men);
    G._men = setTimeout(() => m.classList.remove("visible"), dura);
  };
  G.golpe = (v, tipo) => {
    E.jugador.golpe(tipo);
    G.decir(tipo);
    E.sonido.golpeSeco();
    if (E.jugador.costilla > 0 && tipo === "patada") G.mostrar("Costilla quebrada: dos días sin correr y con menos fuerza en el lazo.");
  };
  G.gastar = (monto, que) => { G.dinero -= monto; };
  G.soltarPuntero = () => { if (document.pointerLockElement) document.exitPointerLock(); };
  const MENUS = ["menu", "parte", "fin", "pausa", "como", "opciones", "mapa", "radio"];
  G.enMenu = () => MENUS.some((id) => !$(id).hidden);

  // ── arranque ──
  G.iniciar = async () => {
    const lienzo = $("lienzo");
    let pasoCarga = 0;
    const cargando = (t) => { $("cargaTexto").textContent = t; $("cargaBarra").style.width = (++pasoCarga / 8) * 100 + "%"; };
    const pausa = () => new Promise((r) => setTimeout(r, 0));
    cargando("Encendiendo…"); await pausa();
    E.motor.iniciar(lienzo);
    E.motor.actualizarHora(G.hora, 0);
    cargando("Los animales y el Guacho…"); await pausa();
    try { await E.modelos.cargar(); } catch (e) { console.warn("sin modelos", e); }
    cargando("Tierra colorada…"); await pausa();
    E.terreno.construir();
    cargando("El monte: quebrachos y algarrobos…"); await pausa();
    E.flora.construir();
    cargando("Rancho, corral y manga…"); await pausa();
    E.estancia.construir();
    E.puesto.construir();
    E.comedero.construir();
    E.radioFM.construir();
    cargando("La hacienda…"); await pausa();
    E.animales.construir();
    E.jugador.iniciar();
    E.perros.construir();
    E.rodeo.construir();
    E.lazo.construir();
    E.trabajo.construir();
    E.trabajo.conectarCura();
    E.trabajo.conectarManga();
    E.ojo.conectar();
    E.chat.conectar();
    E.mapa.conectar();
    E.radioFM.conectar();
    E.conectarEntrada(lienzo);
    conectarInterfaz();
    // Compilar todos los shaders en la carga: si no, lo primero que entra en
    // pantalla traba el juego (§ 6.1).
    cargando("Dibujando el mapa del campo…"); await pausa();
    E.mapa.preparar();
    cargando("Preparando la luz…"); await pausa();
    E.motor.acomodar();
    colocar(0.016);
    try { await E.motor.renderer.compileAsync(E.motor.escena, E.motor.camara); } catch (e) { /* los navegadores viejos no lo tienen */ }
    E.motor.dibujar(0, {});
    // La portada, al caer el sol (y el escaneo también se ve con esa luz); la
    // temporada arranca igual al amanecer.
    G.hora = 18.9; E.motor.actualizarHora(G.hora, 0);
    // La calidad: la guardada, o el escaneo de cuadros la primera vez.
    if (G.fijo) E.calidad.aplicar("alta");
    else if (E.opciones.calidad) E.calidad.aplicar(E.opciones.calidad);
    else await escaneo();
    colocar(0.016);
    // La carga se funde y aparece la portada, con la cámara dando vueltas.
    $("carga").style.opacity = 0;
    setTimeout(() => { $("carga").hidden = true; }, 600);
    $("menu").hidden = false;
    requestAnimationFrame(bucle);
  };

  // ── el escaneo de cuadros ── se ve el campo que se dibuja para medir, los
  // cuadros por segundo en grande y el nivel que se está probando.
  async function escaneo() {
    const C = E.calidad, fps = $("escaneoFps"), lis = [...document.querySelectorAll("#escaneoNiveles li")];
    const porDefecto = matchMedia("(pointer: coarse)").matches ? "media" : "alta";
    // En una pestaña de fondo no hay cuadros que medir.
    if (document.hidden) { C.aplicar(porDefecto); return; }
    $("carga").classList.add("midiendo");
    $("escaneo").hidden = false;
    $("cargaBarra").parentNode.hidden = true;
    $("cargaTexto").textContent = "Midiendo tu compu para elegir los gráficos…";
    $("escaneoSaltar").onclick = () => { C.cortar = true; };
    const marcar = (n, clase) => lis.forEach((li) => li.classList.toggle(clase, li.dataset.n === n));
    const mostrarFps = (f) => { fps.textContent = Math.round(f); fps.className = f >= 50 ? "bien" : f >= 35 ? "justo" : "mal"; };
    const r = await C.escanear((n, f) => {
      marcar(n, "probando"); mostrarFps(f);
      $("cargaTexto").textContent = `Probando gráficos ${C.NIVELES[n].nombre.toLowerCase()}…`;
    });
    marcar(null, "probando");
    if (!r) { C.aplicar(porDefecto); return; }       // saltado: no se guarda, la próxima vez mide
    mostrarFps(r.fpsFinal); marcar(r.nivel, "elegido");
    $("escaneoSaltar").hidden = true;
    // Antes del menú se puede elegir otro nivel tocándolo (la ultra baja, para
    // los equipos flojos). Si no se toca nada, sigue solo.
    let elegido = r.nivel, tocado = false;
    const decir = () => { $("cargaTexto").textContent = `Gráficos: ${C.NIVELES[elegido].nombre.toLowerCase()}${tocado ? "" : " (elegidos por el escaneo)"}`; };
    decir();
    $("escaneoAyuda").hidden = false; $("escaneoSeguir").hidden = false;
    await new Promise((listo) => {
      const solo = setTimeout(listo, 6000);
      lis.forEach((li) => { li.onclick = () => { clearTimeout(solo); tocado = true; elegido = li.dataset.n; C.aplicar(elegido); marcar(elegido, "elegido"); decir(); }; });
      $("escaneoSeguir").onclick = () => { clearTimeout(solo); listo(); };
    });
    lis.forEach((li) => { li.onclick = null; });
    E.opciones.calidad = elegido; E.opciones.fpsMedido = Math.round(r.fpsFinal); guardarOpciones();
  }

  function conectarInterfaz() {
    $("menuEmpezar").onclick = () => empezar();
    // Cómo se juega y Opciones se abren desde la portada o la pausa, y "Volver"
    // vuelve a donde se estaba.
    let volverA = "menu";
    const abrir = (id, desde) => {
      volverA = desde; $(desde).hidden = true; $(id).hidden = false;
      // El escaneo corre después de conectar la interfaz: se lee al abrir.
      if (id === "opciones") { $("opCalidad").value = E.calidad.nivel; textoEscaneo(); }
    };
    $("menuComo").onclick = () => abrir("como", "menu");
    $("menuOpciones").onclick = () => abrir("opciones", "menu");
    $("pausaComo").onclick = () => abrir("como", "pausa");
    $("pausaOpciones").onclick = () => abrir("opciones", "pausa");
    for (const b of document.querySelectorAll("[data-volver]")) b.onclick = () => { b.closest(".panel").hidden = true; $(volverA).hidden = false; };
    const deslizador = (id, clave, texto) => {
      const el = $(id), out = $(id + "V");
      el.value = E.opciones[clave]; out.textContent = texto(E.opciones[clave]);
      el.oninput = () => {
        E.opciones[clave] = Number(el.value); out.textContent = texto(E.opciones[clave]); guardarOpciones();
        if (clave === "volumen") E.sonido.volumen(E.opciones.volumen);
      };
    };
    const porciento = (v) => Math.round(v * 100) + "%";
    deslizador("opVolumen", "volumen", porciento);
    deslizador("opVoz", "voz", porciento);
    deslizador("opSensib", "sensib", (v) => v.toFixed(1) + "×");
    deslizador("opBrillo", "brillo", porciento);
    $("opBrillo").addEventListener("input", () => E.motor.actualizarHora(G.hora, G.t));
    // La voz se prueba al soltar el deslizador.
    $("opVoz").onchange = () => { E.sonido.iniciar(); E.sonido.voz("apuntar-0"); };
    // La calidad: se cambia a mano, o se borra la medida y se recarga para medir.
    const textoEscaneo = () => {
      const o = E.opciones;
      $("opEscaneo").textContent = o.fpsMedido ? `Midió ${o.fpsMedido} cuadros por segundo y eligió ${E.calidad.NIVELES[o.calidad].nombre.toLowerCase()}.` : "Todavía no se midió.";
    };
    $("opCalidad").value = E.calidad.nivel; textoEscaneo();
    $("opCalidad").onchange = () => {
      E.calidad.aplicar($("opCalidad").value);
      E.opciones.calidad = E.calidad.nivel; guardarOpciones();
    };
    $("opMedir").onclick = () => { E.opciones.calidad = null; E.opciones.fpsMedido = null; guardarOpciones(); location.reload(); };
    for (const [id, clave] of [["opOjo", "ojo"], ["opSubs", "subtitulos"]]) {
      $(id).checked = E.opciones[clave];
      $(id).onchange = () => { E.opciones[clave] = $(id).checked; guardarOpciones(); };
    }
    $("parteSeguir").onclick = () => { $("parte").hidden = true; retomar(); };
    $("pausaSeguir").onclick = () => { $("pausa").hidden = true; retomar(); };
    $("finOtra").onclick = () => location.reload();
    $("fogonCalentar").onclick = () => { $("fogon").hidden = true; retomar(); calentarHierro(); };
    $("fogonComer").onclick = () => { $("fogon").hidden = true; retomar(); comerAsado(); };
    $("fogonGuiso").onclick = () => { $("fogon").hidden = true; retomar(); E.puesto.cocinar(); };
    $("fogonCerrar").onclick = () => { $("fogon").hidden = true; retomar(); };
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && G.corriendo && !E.entrada.tactil && !G.enMenu() && !E.trabajo.cura.activa && !E.trabajo.manga.activa && $("fogon").hidden && !E.chat.abierto) {
        $("pausa").hidden = false;
      }
    });
  }
  function retomar() {
    if (!E.entrada.tactil && !E.trabajo.manga.activa && !E.trabajo.cura.activa) { try { $("lienzo").requestPointerLock(); } catch (e) { /* no importa */ } }
  }
  function empezar() {
    $("menu").hidden = true;
    document.body.classList.add("jugando");
    G.hora = 6; E.motor.actualizarHora(G.hora, G.t);
    E.sonido.iniciar();
    // En el celular: pantalla completa y acostado, si el navegador deja.
    if (matchMedia("(pointer: coarse)").matches) {
      const d = document.documentElement;
      Promise.resolve(d.requestFullscreen && d.requestFullscreen())
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape"))
        .catch(() => { /* iPhone y otros no dejan: queda el cartel de girar */ });
    }
    G.corriendo = true;
    // El primer día arranca con una vaca agusanada.
    const v = E.animales.vacas[6];
    E.animales.enfermar(v);
    parte(`Día 1 de ${E.trabajo.DIAS}. Amanece en la estancia, 23 °C y se viene pesado.`,
      `El puestero vio la ${v.num} con la bichera, rengueando ${E.trabajo.rumbo(v.destino.x, v.destino.z)}, metida en el monte. Buscá las huellas frescas y la bosta con moscas. El zaino está ensillado al lado del rancho.`);
  }
  function parte(titulo, texto) {
    $("parteTitulo").textContent = titulo;
    $("parteTexto").textContent = texto;
    $("parte").hidden = false;
    G.soltarPuntero();
  }

  // ── pasar el tiempo ── con fundido a negro.
  let fundido = null;
  G.fundir = (horas, alTerminar) => {
    fundido = { t: 0, horas, hecho: false, alTerminar };
  };
  function avanzarFundido(dt) {
    if (!fundido) return 0;
    fundido.t += dt;
    if (fundido.t > 0.6 && !fundido.hecho) {
      fundido.hecho = true;
      G.hora += fundido.horas; G.horasJuego += fundido.horas;
      if (fundido.alTerminar) fundido.alTerminar();
    }
    const n = fundido.t < 0.6 ? fundido.t / 0.6 : Math.max(0, 1 - (fundido.t - 1.0) / 0.6);
    if (fundido.t > 1.6) fundido = null;
    return n;
  }

  // ── la vida de estancia ──
  function tomarAgua() {
    const J = E.jugador, c = E.animales.caballo;
    G.fundir(0.08, () => { J.sed = 100; if (J.montado || Math.hypot(c.x - J.x, c.z - J.z) < 6) { c.aliento = 1; G.mostrar("Tomaste agua, y el zaino también."); } else G.mostrar("Agua del bebedero, tibia pero agua."); });
  }
  function calentarHierro() {
    G.fundir(0.4, () => { G.hierroCaliente = 1.5; G.mostrar("El hierro está al rojo. Tenés una hora y media."); });
  }
  function comerAsado() {
    const J = E.jugador;
    G.fundir(0.7, () => { J.cansancio = Math.min(100, J.cansancio + 45); G.comio = true; G.mostrar("Asado al costillar, con cuero. Grasa y humo."); });
  }
  function dormir(forzado) {
    const J = E.jugador;
    const hasta = 24 - G.hora + 6;
    G.fundir(hasta, () => nuevoDia(forzado));
  }
  function desmayo(motivo) {
    const J = E.jugador;
    if (J.montado) J.desmontar();
    E.lazo.estado === "enganchado" && (E.lazo.vaca.estado = "escapa", E.lazo.vaca = null, E.lazo.estado = "listo");
    G.fundir(24 - G.hora + 6, () => {
      J.x = E.lugares.rancho.x - 1.5; J.z = E.lugares.rancho.z + 2;
      nuevoDia(true, motivo);
      J.salud = 45; J.sed = 60; J.cansancio = 55;
    });
  }
  function nuevoDia(mal, motivo) {
    const J = E.jugador, c = E.animales.caballo;
    const ayer = G.dia;
    G.dia++; G.hora = 6; G.horasJuego = Math.ceil(G.horasJuego / 24) * 24 + 6;
    J.cansancio = mal ? 70 : G.comio ? 100 : 82;
    J.sed = Math.max(J.sed, 80);
    J.salud = Math.min(100, J.salud + 25);
    if (J.costilla > 0) J.costilla--;
    if (c.lesion > 0) c.lesion--;
    c.aliento = 1;
    G.hierroCaliente = 0; G.comio = false;
    const { muertas, nuevas } = E.trabajo.amanecer();
    const b = E.trabajo.balance();
    if (G.dia > E.trabajo.DIAS || b.vivas < 12) { fin(b); return; }
    let texto = motivo ? motivo + " " : "";
    texto += E.puesto.amanecer(ayer);
    texto += E.comedero.amanecer();
    if (muertas.length) texto += `Amaneció muerta ${muertas.map((v) => "la " + v.num).join(" y ")}: la bichera la comió. Los chimangos ya están arriba. `;
    if (nuevas.length) texto += nuevas.map((v) => `El puestero vio la ${v.num} agusanada, ${E.trabajo.rumbo(v.destino.x, v.destino.z)}.`).join(" ") + " ";
    const pend = E.animales.vacas.filter((v) => v.salud.bichera && !v.salud.muerta && !nuevas.includes(v));
    if (pend.length) texto += `Siguen con bichera: ${pend.map((v) => `la ${v.num} (${v.salud.bichera.dias} ${v.salud.bichera.dias === 1 ? "día" : "días"})`).join(", ")}. A los tres días se mueren. `;
    if (!muertas.length && !nuevas.length && !pend.length) texto += "Nadie agusanado hoy. Día para la manga: vacunar, caravanear y marcar. ";
    texto += `Hacienda: ${b.vivas} de ${b.total}, ${b.trabajadas} trabajadas.`;
    parte(`Día ${G.dia} de ${E.trabajo.DIAS}.`, texto);
  }
  function fin(b) {
    G.corriendo = false;
    const fundiste = b.vivas < 12 || b.patrimonio < 1500000 + 18 * 850000 * 0.7;
    $("finTitulo").textContent = fundiste ? "Fundiste la estancia." : "Salvaste la temporada.";
    $("finTexto").innerHTML =
      `<p>Hacienda viva: <b>${b.vivas} de ${b.total}</b>. Vacunadas contra aftosa: <b>${b.vacunadas}</b>. Trabajadas completas: <b>${b.trabajadas}</b>.</p>` +
      `<p>Plata en la caja: <b>$ ${miles.format(Math.round(G.dinero))}</b>. La hacienda vale <b>$ ${miles.format(Math.round(b.hacienda))}</b>.</p>` +
      `<p>${fundiste ? "Con lo que se murió y lo que no se vacunó, no alcanza para seguir. El banco se queda con el campo." : "La estancia sigue viva un año más. Nadie te va a dar las gracias, pero el campo sigue."}</p>`;
    $("fin").hidden = false;
    G.soltarPuntero();
  }

  // ── interacción ── lo mismo arma el cartel y ejecuta la acción.
  function contexto() {
    const J = E.jugador, Z = E.lazo, W = E.trabajo, c = E.animales.caballo;
    if (W.manga.activa) return W.manga.fase === "cepo" ? { texto: W.trabajada(W.manga.vaca) ? "Soltar la vaca" : "Soltarla sin terminar", fn: () => W.salirManga(W.trabajada(W.manga.vaca)) } : null;
    if (Z.estado === "atada" && Z.vaca && Math.hypot(Z.vaca.x - J.x, Z.vaca.z - J.z) < 3) {
      if (J.montado) return { texto: "Bajate para trabajarla", fn: () => J.desmontar() };
      if (Z.vaca.salud.bichera) return { texto: `Curar la bichera de la ${Z.vaca.num}`, fn: () => W.abrirCura(Z.vaca) };
      return { texto: `Soltar la ${Z.vaca.num}`, fn: () => Z.soltar() };
    }
    if (!J.montado && Math.hypot(c.x - J.x, c.z - J.z) < 2.6) return { texto: "Montar el zaino", fn: () => J.montar() };
    for (const p of E.estancia.puntos) {
      if (Math.hypot(p.x - J.x, p.z - J.z) > p.r) continue;
      if (p.id === "tranqueraEntrada") return { texto: p.texto, fn: E.estancia.alternarEntrada };
      if (p.id === "tranqueraEncierre") return { texto: p.texto, fn: E.comedero.alternarTranquera };
      if (J.montado && p.id !== "tanque") return { texto: "Bajate del caballo", fn: () => J.desmontar() };
      if (p.id === "almacen") {
        if (!Z.tieneLazo) return { texto: `Comprar un lazo en el almacén ($ ${miles.format(W.COSTO.lazo)})`, fn: () => { Z.tieneLazo = true; Z.desgaste = 0; G.gastar(W.COSTO.lazo, "Lazo"); G.mostrar("Don Benito te vendió un lazo de ocho tientos. Bien trenzado."); } };
        return { texto: "Almacén: una gaseosa fría, yerba y galletas ($ 12.000)", fn: () => G.fundir(0.3, () => { J.sed = 100; J.cansancio = Math.min(100, J.cansancio + 15); J.salud = Math.min(100, J.salud + 5); G.gastar(12000, "Almacén"); G.mostrar("Una gaseosa fría en la galería del almacén, y Don Benito con las noticias del pueblo."); }) };
      }
      if (p.id === "mate") return { texto: p.texto, fn: E.puesto.cebarMate };
      if (p.id === "heladera") return { texto: p.texto, fn: E.puesto.aguaFria };
      if (p.id === "comederoHacienda") return { texto: E.comedero.nivel > 0.85 ? "El comedero está lleno" : `${p.texto} ($ ${miles.format(E.comedero.COSTO)})`, fn: E.comedero.cargar };
      if (p.id === "tranqueraEncierre") return { texto: p.texto, fn: E.comedero.alternarTranquera };
      if (p.id === "comedero") return { texto: c.comido === G.dia ? "El zaino ya tiene forraje" : p.texto, fn: () => { if (c.comido !== G.dia) E.puesto.forraje(); } };
      if (p.id === "tanque" && E.puesto.puedeBanar()) return { texto: "Bañar al zaino con el balde", fn: E.puesto.banar };
      if (p.id === "tanque") return { texto: p.texto, fn: tomarAgua };
      if (p.id === "radio" || p.id === "radioFM") return { texto: "Radio FM: elegir la emisora", fn: E.radioFM.abrir };
      if (p.id === "catre") return { texto: G.hora >= 17 || J.cansancio < 30 ? "Dormir en el catre" : "Todavía es temprano para dormir", fn: () => { if (G.hora >= 17 || J.cansancio < 30) dormir(false); } };
      if (p.id === "fogon") return { texto: "Fogón: calentar el hierro, cocinar o comer", fn: () => { $("fogonComer").disabled = G.hora < 18; $("fogonGuiso").disabled = G.hora < 11 || G.comio; $("fogon").hidden = false; G.soltarPuntero(); } };
      if (p.id === "manga") return { texto: p.texto, fn: () => W.entrarManga() };
      if (p.id === "tranquera") return { texto: p.texto, fn: () => E.estancia.alternarTranquera() };
    }
    if (!Z.tieneLazo && Math.hypot(E.lugares.rancho.x + 3.5 - J.x, E.lugares.rancho.z + 3 - J.z) < 2.2 && !J.montado) {
      return { texto: `Agarrar el lazo nuevo de la galería ($ ${miles.format(W.COSTO.lazo)})`, fn: () => { Z.tieneLazo = true; Z.desgaste = 0; G.gastar(W.COSTO.lazo, "Lazo"); Z.equipar(); } };
    }
    if (J.montado && c.vReal < 0.6) return { texto: "Desmontar", fn: () => J.desmontar() };
    return null;
  }

  function controles(ctxAccion) {
    const en = E.entrada, J = E.jugador, Z = E.lazo, W = E.trabajo;
    if (G.enMenu() || W.cura.activa || !$("fogon").hidden || fundido) return;
    if (en.pulsado("KeyE") || en.botonPulsado("accion")) { if (ctxAccion) ctxAccion.fn(); }
    if (W.manga.activa) {
      const idx = ["Digit1", "Digit2", "Digit3", "Digit4"].findIndex((k) => en.pulsado(k));
      if (idx >= 0) { W.manga.herr = ["aftosa", "ivermectina", "caravana", "hierro"][idx]; document.querySelector(`#manga [data-herr="${W.manga.herr}"]`).click(); }
      return;
    }
    if (en.pulsado("Digit1") || en.pulsado("KeyL")) Z.equipar();
    const puedeLazo = document.pointerLockElement || en.tactil;
    if ((en.raton.izqRecien && puedeLazo) || en.botonPulsado("lazo")) Z.empezarRevoleo();
    if ((en.raton.izqSuelto || (G._lazoTactil && !en.boton("lazo"))) && Z.estado === "revoleando") Z.tirar();
    G._lazoTactil = en.boton("lazo");
    if (en.pulsado("KeyP") || en.botonPulsado("pialar")) Z.pialar();
    if (en.pulsado("KeyV") || en.botonPulsado("camara")) J.camara = J.camara === "primera" ? "tercera" : "primera";
    // El silbido y después la voz.
    if (en.pulsado("KeyH") || en.botonPulsado("silbar")) { E.animales.caballo.destino = { x: J.x, z: J.z }; E.sonido.silbido(); setTimeout(() => G.decir("silbar"), 1050); }
    if (en.pulsado("KeyF") && !G._fumando) { G._fumando = 6; G.decir("fumar"); }
    // Los perros.
    if (en.pulsado("KeyG")) E.perros.ordenar("seguir");
    if (en.pulsado("KeyX")) E.perros.ordenar("quieto");
    if (en.pulsado("KeyJ")) E.perros.ordenar("juntar");
    if (en.pulsado("KeyB")) E.perros.ordenar("traer");
    if (en.botonPulsado("perros")) E.perros.siguiente();
    if (en.botonPulsado("mapa")) E.mapa.abrir();
    J.bloqueado = W.manga.activa ? "manga" : Z.estado === "revoleando" || Z.estado === "enganchado" ? "lazo" : null;
  }

  // ── el HUD ──
  let proxHud = 0, proxHuellas = 0;
  function hud(ctxAccion) {
    const J = E.jugador, Z = E.lazo, c = E.animales.caballo, W = E.trabajo;
    // Con el menú, el parte, la pausa o el final a la vista, la interfaz del
    // juego se esconde (se veía el reloj y las barras por debajo del menú).
    $("hud").hidden = G.enMenu();
    $("chat").hidden = G.enMenu() || !G.corriendo;
    const hh = Math.floor(G.hora) % 24, mm = Math.floor((G.hora % 1) * 60);
    $("hudDia").textContent = `Día ${G.dia} de ${W.DIAS}`;
    $("hudHora").textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    $("hudTemp").textContent = `${Math.round(E.motor.temp)} °C`;
    $("hudTemp").classList.toggle("calor", E.motor.temp > 36);
    $("barSed").style.width = J.sed + "%"; $("barSed").parentElement.classList.toggle("bajo", J.sed < 25);
    $("barCans").style.width = J.cansancio + "%"; $("barCans").parentElement.classList.toggle("bajo", J.cansancio < 20);
    $("barSalud").style.width = J.salud + "%"; $("barSalud").parentElement.classList.toggle("bajo", J.salud < 30);
    $("hudCaballo").hidden = !J.montado || c.aliento > 0.9;
    $("barCaballo").style.width = c.aliento * 100 + "%";
    // Llenas, las barras se apagan: el HUD estaba muy cargado.
    const alguna = J.sed < 85 || J.cansancio < 85 || J.salud < 90 || (J.montado && c.aliento < 0.9) || c.lesion > 0 || J.costilla > 0;
    document.querySelector(".cuerpo-barras").classList.toggle("tranquilas", !alguna);
    $("hudLesion").hidden = !(c.lesion > 0);
    $("hudCostilla").hidden = !(J.costilla > 0);
    const plata = Math.round(G.dinero);
    if (plata !== ultimaPlata) {
      const el = $("hudPlata");
      el.textContent = `$ ${miles.format(plata)}`;
      if (ultimaPlata !== null) { el.classList.remove("sube", "baja"); void el.offsetWidth; el.classList.add(plata > ultimaPlata ? "sube" : "baja"); }
      ultimaPlata = plata;
    }
    const b = W.balance();
    const agus = E.animales.vacas.filter((v) => v.salud.bichera && !v.salud.muerta);
    // Las tareas: lo urgente primero y tres como mucho (antes eran seis
    // renglones con el lazo y el comedero siempre a la vista).
    const tareas = [];
    for (const v of agus) tareas.push([`La ${v.num} con bichera · ${v.salud.bichera.dias ? v.salud.bichera.dias + (v.salud.bichera.dias === 1 ? " día" : " días") : "de hoy"}`, true]);
    if (!Z.tieneLazo) tareas.push(["Sin lazo: hay en la galería o en el almacén", true]);
    if (E.puesto.pendientes().length) tareas.push([`El zaino: ${E.puesto.pendientes().join(" y ")}`, true]);
    if (E.comedero.nivel < 0.15) tareas.push(["Comedero del encierre vacío", true]);
    if (G.hierroCaliente > 0) tareas.push([`Hierro caliente: ${Math.round(G.hierroCaliente * 60)} min`, false]);
    tareas.push([`Manga: ${b.trabajadas} de ${b.vivas} trabajadas`, false]);
    const html = tareas.slice(0, 3).map(([t, u]) => `<li${u ? ' class="urgente"' : ""}>${t}</li>`).join("");
    if (html !== ultimasTareas) { $("hudObjetivos").innerHTML = html; ultimasTareas = html; }
    $("aviso").textContent = ctxAccion ? `${E.entrada.tactil ? "✋" : "E"} · ${ctxAccion.texto}` : "";
    $("aviso").classList.toggle("visible", !!ctxAccion);
    // El forcejeo: tensión contra lo que aguanta el cuero, y lo que le queda a la vaca.
    const tira = Z.estado === "enganchado";
    $("tension").hidden = !tira;
    if (tira) {
      const resiste = 1.5 - Z.desgaste * 0.35;
      $("tensionBarra").style.width = Math.min(100, (Z.tension / resiste) * 100) + "%";
      $("tensionBarra").className = Z.tension > resiste * 0.85 ? "rojo" : Z.tension > resiste * 0.55 ? "amarillo" : "";
      $("fatigaBarra").style.width = Z.vaca.fatiga * 100 + "%";
      $("tensionTexto").textContent = Z.vaca.fatiga < 0.38 ? "Cansada: pialala (P)" : "Aguantá y cobrá (botón derecho)";
      $("pial").hidden = !Z.pialando;
      if (Z.pialando) { $("pialAguja").style.left = Z.pialando.aguja * 100 + "%"; $("pialVentana").style.left = (Z.pialando.ventana - 0.11) * 100 + "%"; }
    } else $("pial").hidden = true;
    const q = Z.calidadVisible();
    $("revoleo").hidden = Z.estado !== "revoleando";
    $("revoleoArco").style.strokeDashoffset = String(126 * (1 - q));
    $("revoleoArco").classList.toggle("justo", q > 0.82);
  }

  // ── el cuadro ──
  const ctxAnimales = {
    aviso: (v, tipo) => G.decir(tipo === "lesion" ? "lesion" : tipo),
    golpe: (v, tipo) => G.golpe(v, tipo),
    mugir: (v) => E.sonido.mugido(v),
    hora: 6, horasJuego: 6, escalaHoras: HORAS_POR_SEGUNDO, sed: false,
  };
  const ctxJugador = { dh: 0, aviso: (t) => G.decir(t) };
  let ultimaPlata = null, ultimasTareas = "";
  // La cámara de la portada: va y viene despacio por delante del Guacho, que
  // mira a cámara con el rancho atrás (dar la vuelta entera metía la cámara
  // en la pared del rancho).
  function camaraDePortada(dt, t) {
    const J = E.jugador, cam = E.motor.camara, T = E.terreno, R = E.lugares.rancho;
    const a = Math.sin(t * 0.05) * 1.0, r = 7.5 + Math.sin(t * 0.07) * 1.5;
    const x = J.x + Math.sin(a) * r, z = J.z + Math.cos(a) * r, suelo = T.altura(J.x, J.z);
    cam.position.set(x, Math.max(T.altura(x, z) + 1.6, suelo + 2.1 + Math.sin(t * 0.11) * 0.4), z);
    // El Guacho en el tercio derecho: la portada ocupa la izquierda. En una
    // pantalla angosta (la portada abajo) va al centro.
    const corrido = innerWidth > 760 ? 2.2 : 0;
    const fx = J.x - x, fz = J.z - z, l = Math.hypot(fx, fz) || 1;
    cam.lookAt(E.lerp(J.x, R.x, 0.25) + (fz / l) * corrido, suelo + 1.4, E.lerp(J.z, R.z, 0.25) - (fx / l) * corrido);
    J.portada(dt, t);
  }
  let antes = performance.now();
  function colocar(dt) {
    // Poner todo en su lugar sin avanzar el mundo (para la carga y las fotos).
    E.jugador.actualizar(0, G.t, { dh: 0, aviso: () => {} });
    E.flora.actualizar(E.motor.camara, G.t);
    E.flora.actualizarPasto(E.motor.camara.position);
    E.flora.actualizarSol(E.motor.camara);
    E.motor.seguirSombra(new THREE.Vector3(E.jugador.x, E.terreno.altura(E.jugador.x, E.jugador.z), E.jugador.z));
  }
  G.simular = (dt) => {
    const activo = G.corriendo && !G.enMenu() && !E.trabajo.cura.activa && $("fogon").hidden;
    const dh = activo ? dt * HORAS_POR_SEGUNDO : 0;
    G.hora += dh; G.horasJuego += dh;
    G.hierroCaliente = Math.max(0, G.hierroCaliente - dh);
    G.t += dt;
    E.motor.actualizarHora(G.hora, G.t);
    // Una racha de viento que va y viene.
    E.flora.uniformes.uRacha.value = 0.35 + 0.3 * Math.sin(G.t * 0.21) * Math.sin(G.t * 0.13 + 1) + 0.15 * Math.sin(G.t * 0.9);
    const ctxAccion = activo ? contexto() : null;
    if (activo) controles(ctxAccion);
    ctxJugador.dh = dh;
    if (activo || E.trabajo.manga.activa) {
      if (!E.trabajo.manga.activa) E.jugador.actualizar(dt, G.t, ctxJugador);
      E.lazo.actualizar(dt, G.t);
      ctxAnimales.hora = G.hora; ctxAnimales.horasJuego = G.horasJuego; ctxAnimales.sed = E.motor.calor > 0.5;
      E.animales.actualizar(dt, G.t, E.jugador, ctxAnimales);
      E.perros.actualizar(dt, G.t, E.jugador);
      E.rodeo.actualizar(dt, G.t, E.jugador, G.hora);
    }
    E.estancia.actualizar(dt, G.t);
    E.mapa.actualizar(dt, G.t);
    E.radioFM.actualizar();
    if (activo) { E.puesto.actualizar(dt, G.t); E.puesto.revisarLlegada(); E.comedero.actualizar(dt); }
    E.terreno.actualizar(G.t);
    E.trabajo.actualizarCura(dt);
    E.trabajo.actualizarManga(dt, G.t);
    // El hierro brilla si está caliente.
    E.estancia.hierro.punta.material.emissiveIntensity = G.hierroCaliente > 0 ? 2.5 + Math.sin(G.t * 3) * 0.4 : 0;
    if (!$("menu").hidden || (!$("como").hidden || !$("opciones").hidden) && !G.corriendo) camaraDePortada(dt, G.t);
    const cam = E.motor.camara;
    E.flora.actualizar(cam, G.t);
    E.flora.actualizarPasto(cam.position);
    E.flora.actualizarSol(cam);
    E.motor.seguirSombra(new THREE.Vector3(E.jugador.x, E.terreno.altura(E.jugador.x, E.jugador.z), E.jugador.z));
    proxHuellas -= dt;
    if (proxHuellas <= 0) { proxHuellas = 1.5; E.animales.rehacerHuellas(G.horasJuego); }
    E.sonido.actualizar(dt, E.jugador, G.hora);
    if (activo) {
      const J = E.jugador;
      if (J.sed <= 0) desmayo("Te agarró un golpe de calor. Te encontró el puestero tirado y te trajo al rancho.");
      else if (J.salud <= 0) desmayo("Te dejó de cama. Te trajeron al rancho entre dos.");
      else if (G.hora >= 23.5) { G.mostrar("Te agarró la noche. Te dormiste donde estabas."); dormir(true); }
      if (J.sed < 20 && G.t - ultimaFrase > 25) G.decir("sed");
      else if (E.motor.temp > 38 && G.t - ultimaFrase > 60 && Math.random() < dt * 0.05) G.decir("calor");
    }
    if (G._fumando) {
      G._fumando -= dt;
      if (G._fumando <= 0) { G._fumando = 0; E.jugador.cansancio = Math.min(100, E.jugador.cansancio + 3); }
    }
    proxHud -= dt;
    if (proxHud <= 0) { proxHud = 0.1; hud(ctxAccion); }
    E.entrada.finCuadro();
  };
  let congelado = false;
  function bucle(ahora) {
    // El dt nunca negativo: la marca de requestAnimationFrame puede ser anterior
    // al performance.now() que se tomó al armar (§ 6.1).
    const real = (ahora - antes) / 1000;
    antes = ahora;
    // Congelado (solo lo usan las pruebas): no se simula ni se dibuja, así la
    // foto que se sacó con una cámara puesta a mano no la pisa el cuadro que sigue.
    if (congelado) { requestAnimationFrame(bucle); return; }
    const dt = Math.max(0, Math.min(0.05, real));
    E.motor.acomodar();
    E.motor.medir(real, G.fijo);
    // El ojo de águila va con el tiempo de verdad y frena el del mundo.
    E.ojo.actualizar(dt);
    G.simular(dt * E.ojo.escala);
    const negro = avanzarFundido(dt);
    const J = E.jugador;
    E.motor.dibujar(G.t, { sed: E.clamp((30 - J.sed) / 30, 0, 1) * 0.8, dolor: J.dolor, negro, ojo: E.ojo.activo, foco: E.ojo.foco });
    requestAnimationFrame(bucle);
  }

  // ── para las pruebas (Playwright) ──
  window.__juego = {
    G, J: () => E.jugador, A: () => E.animales, Z: () => E.lazo, W: () => E.trabajo,
    empezar: () => { empezar(); $("parte").hidden = true; },
    ir(x, z, yaw = 0, pitch = 0) { const J = E.jugador; J.x = x; J.z = z; J.yaw = yaw; J.pitch = pitch; if (J.montado) { E.animales.caballo.x = x; E.animales.caballo.z = z; } colocar(0); },
    hora(h) { G.hora = h; E.motor.actualizarHora(h, G.t); },
    paso(dt, n = 1) { for (let i = 0; i < n; i++) { E.ojo.actualizar(dt); G.simular(dt * E.ojo.escala); } },
    foto() { E.motor.acomodar(); E.motor.dibujar(G.t, { ojo: E.ojo.activo, foco: E.ojo.foco }); return E.motor.renderer.info.render; },
    congelar(si = true) { congelado = si; },
    // Una foto con la cámara donde se quiera (con el bucle congelado).
    fotoDesde(pos, mira) {
      const cam = E.motor.camara;
      cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(mira[0], mira[1], mira[2]); cam.updateMatrixWorld();
      E.flora.actualizar(cam, G.t); E.flora.actualizarSol(cam);
      E.motor.acomodar(); E.motor.dibujar(G.t, { ojo: E.ojo.activo, foco: E.ojo.foco });
      return E.motor.renderer.info.render.triangles;
    },
    info() { const r = E.motor.renderer.info; return { triangulos: r.render.triangles, llamadas: r.render.calls, geometrias: r.memory.geometries, texturas: r.memory.textures, escala: E.motor.escala }; },
  };

  addEventListener("load", () => G.iniciar().catch((e) => { $("cargaTexto").textContent = "No se pudo arrancar: " + e.message; console.error(e); }));
})();
