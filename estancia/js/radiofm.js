// La radio FM de verdad: emisoras del Chaco y de al lado (Formosa,
// Corrientes), por internet.
//
// Una radio a transistores en la galería del rancho (y la de adentro). Con E se
// abre el dial: se elige la emisora, se prende, se apaga, el volumen. Suena con
// un <audio> común (no pasa por WebAudio: las emisoras no mandan permisos de
// CORS y por WebAudio saldría mudo) y baja con la distancia a la radio: en el
// campo, lejos del rancho, ya no se oye.
//
// La lista base se probó el 24/9/2026 desde el contenedor (las de Presidencia
// Roca y Sáenz Peña salieron de las páginas de cada emisora; la de Presidencia
// Roca es La Radio 104.7, señal LRR 410, con domicilio en Mayor Hermelo 968) (las marcadas
// "comprobada" respondieron audio); las que usan puertos raros no se pudieron
// probar desde acá y quedan como "sin comprobar". Además, al abrir el dial se
// le pide al directorio público Radio Browser (radio-browser.info) lo que haya
// del Chaco, Formosa y Corrientes, por si hay emisoras nuevas.
"use strict";
(() => {
  const RF = (E.radioFM = { prendida: false, actual: null, estado: "apagada" });
  const $ = (id) => document.getElementById(id);
  RF.EMISORAS = [
    // Presidencia Roca y Presidencia Roque Sáenz Peña (pedido aparte).
    { nombre: "La Radio 104.7 (LRR 410)", lugar: "Presidencia Roca, Chaco", url: "https://server.laradio.online/proxy/laradio1047?mp=/stream", comprobada: true },
    { nombre: "Fly FM 99.3", lugar: "Pcia. Roque Sáenz Peña, Chaco", url: "https://server.laradio.online/proxy/siemprefly?mp=/stream", comprobada: true },
    { nombre: "La Red 92.9", lugar: "Pcia. Roque Sáenz Peña, Chaco", url: "https://turadioenvivo.com/proxy/saenzp/stream", comprobada: true },
    { nombre: "Radio Futuro 98.9", lugar: "Pcia. Roque Sáenz Peña, Chaco", url: "https://frontend.radiohdvivo.com/radiofuturo/live", comprobada: true },
    { nombre: "LT16 Radio Roque Sáenz Peña (AM 950 / FM 93.3)", lugar: "Pcia. Roque Sáenz Peña, Chaco", url: "http://centova.conektic.net:8022/stream" },
    { nombre: "Radio Nueva 92.1", lugar: "Pcia. Roque Sáenz Peña, Chaco", url: "https://panel.ispui.lat:1065/stream" },
    { nombre: "LRA 26 Radio Nacional Resistencia", lugar: "Resistencia, Chaco", url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad26", comprobada: true },
    { nombre: "FM Gualamba 93.7", lugar: "Resistencia, Chaco", url: "https://ssl.radiosnethosting.com/index.php?port=9072", comprobada: true },
    { nombre: "Radio Mitre Resistencia 90.7", lugar: "Resistencia, Chaco", url: "https://01.solumedia.com.ar:9068/stream" },
    { nombre: "Radio Del Puerto 92.1", lugar: "Barranqueras, Chaco", url: "https://streaming.escuchanosonline.com:7106/stream" },
    { nombre: "Radio Nordeste FM 102.7", lugar: "Resistencia, Chaco", url: "http://turadioenvivo.com:11027/stream" },
    { nombre: "Radio Universidad UTN 91.1", lugar: "Resistencia, Chaco", url: "http://01.solumedia.com.ar:8336/" },
    { nombre: "Radio Fan Castelli", lugar: "Castelli, Chaco", url: "http://streaming5.locucionar.com:23184/stream" },
    { nombre: "LRA 8 Radio Nacional Formosa", lugar: "Formosa", url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad8", comprobada: true },
    { nombre: "La 100 Formosa 98.9", lugar: "Formosa", url: "https://cdn.instream.audio/:9153/stream", comprobada: true },
    { nombre: "FM Uno Corrientes", lugar: "Corrientes", url: "https://srv10.streamingradio.ar/8062/stream", comprobada: true },
    { nombre: "Digital FM 102.1", lugar: "Corrientes", url: "https://turadioenvivo.com/proxy/fmdigital/stream", comprobada: true },
    { nombre: "Radio Diario El Litoral", lugar: "Corrientes", url: "https://radios.solumedia.com/6446/stream", comprobada: true },
    { nombre: "Sol FM 106.7", lugar: "Bella Vista, Corrientes", url: "https://radiosar.com:8126/stream" },
    { nombre: "LT7 Radio Provincia de Corrientes", lugar: "Corrientes", url: "http://turadioenvivo.com:11045/stream" },
    { nombre: "Radio Sudamericana 100.5", lugar: "Corrientes", url: "http://turadioenvivo.com:8530/stream" },
  ];
  // En una página https el navegador no deja sonar una emisora http (contenido
  // mixto): esas quedan para el archivo descargado.
  const seguraOk = (e) => location.protocol !== "https:" || e.url.startsWith("https:");

  let audio = null, pedidoDirectorio = false;
  function crearAudio() {
    audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("playing", () => { RF.estado = "en el aire"; pintar(); E.sonido.radio = false; });
    audio.addEventListener("waiting", () => { if (RF.prendida) { RF.estado = "sintonizando…"; pintar(); } });
    const caida = () => {
      if (!RF.prendida) return;
      if (RF.actual) RF.actual.caida = true;
      RF.estado = "sin señal: probá otra";
      E.sonido.radio = false;
      pintar();
    };
    audio.addEventListener("error", caida);
    audio.addEventListener("stalled", () => { if (RF.prendida && RF.estado !== "en el aire") setTimeout(() => { if (RF.estado === "sintonizando…") caida(); }, 9000); });
  }

  RF.sintonizar = (e) => {
    if (!audio) crearAudio();
    if (!seguraOk(e)) { RF.estado = "esta emisora solo anda en el archivo descargado"; pintar(); return; }
    RF.actual = e; RF.prendida = true; RF.estado = "sintonizando…";
    // Mientras engancha, la estática de la radio sintetizada (sonido.js).
    E.sonido.iniciar(); E.sonido.radio = true;
    audio.src = e.url;
    audio.volume = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => { RF.estado = "sin señal: probá otra"; E.sonido.radio = false; pintar(); });
    pintar();
  };
  RF.apagar = () => {
    RF.prendida = false; RF.estado = "apagada"; E.sonido.radio = false;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    pintar();
  };
  RF.siguiente = (paso = 1) => {
    const lista = RF.EMISORAS.filter(seguraOk);
    if (!lista.length) return;
    const i = Math.max(0, lista.indexOf(RF.actual));
    RF.sintonizar(lista[(i + paso + lista.length) % lista.length]);
  };

  // Más emisoras del directorio público, si hay internet.
  async function directorio() {
    if (pedidoDirectorio) return;
    pedidoDirectorio = true;
    const busquedas = [["state", "Chaco"], ["name", "Resistencia"], ["name", "Chaco"], ["name", "Formosa"], ["state", "Corrientes"]];
    for (const servidor of ["de1", "fi1", "at1"]) {
      try {
        const vistas = new Set(RF.EMISORAS.map((e) => e.url));
        for (const [campo, valor] of busquedas) {
          const u = `https://${servidor}.api.radio-browser.info/json/stations/search?${campo}=${encodeURIComponent(valor)}&countrycode=AR&hidebroken=true&order=clickcount&reverse=true&limit=15`;
          const r = await fetch(u);
          if (!r.ok) throw new Error(r.status);
          for (const s of await r.json()) {
            const url = s.url_resolved || s.url;
            if (!url || vistas.has(url) || /m3u8/.test(url)) continue;
            vistas.add(url);
            RF.EMISORAS.push({ nombre: s.name.trim().slice(0, 44), lugar: (s.state || "Argentina").trim(), url, directorio: true });
          }
        }
        pintarLista();
        return;
      } catch (e) { /* ese servidor no contestó: el siguiente */ }
    }
  }

  // ── la radio en la galería ──
  RF.construir = () => {
    const T = E.terreno, R = E.lugares.rancho, y0 = T.altura(R.x, R.z), esc = E.motor.escena, C = E.estancia;
    const g = new THREE.Group();
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.11), new THREE.MeshStandardMaterial({ color: 0x6a2f22, roughness: 0.55 }));
    g.add(caja);
    // El frente: la rejilla del parlante y el dial.
    const frente = E.lienzo(128, 76, (c, w, h) => {
      c.fillStyle = "#d9c9a3"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#3a2a1c"; for (let y = 8; y < h - 8; y += 5) for (let x = 8; x < w * 0.55; x += 5) { c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill(); }
      c.fillStyle = "#f3e6c2"; c.fillRect(w * 0.62, 10, w * 0.32, 22); c.strokeStyle = "#3a2a1c"; c.strokeRect(w * 0.62, 10, w * 0.32, 22);
      c.fillStyle = "#3a2a1c"; c.font = "9px sans-serif"; c.fillText("88  98  108", w * 0.63, 25);
      c.beginPath(); c.arc(w * 0.72, 52, 9, 0, 7); c.fill(); c.beginPath(); c.arc(w * 0.88, 52, 9, 0, 7); c.fill();
    });
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.18), new THREE.MeshStandardMaterial({ map: frente, roughness: 0.6 }));
    cara.position.z = 0.056; g.add(cara);
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.42, 5), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, metalness: 0.9, roughness: 0.3 }));
    antena.position.set(0.12, 0.3, 0); antena.rotation.z = -0.35; g.add(antena);
    const manija = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 5, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.5 }));
    manija.position.y = 0.1; g.add(manija);
    // En un estante contra la pared del frente, al lado de la puerta.
    const estante = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.26), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
    estante.position.set(R.x + 2.0, y0 + 1.18, R.z + 2.8); esc.add(estante);
    g.position.set(R.x + 2.0, y0 + 1.3, R.z + 2.8); esc.add(g);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    RF.pos = g.position.clone();
    C.puntos.push({ id: "radioFM", x: R.x + 2.0, z: R.z + 3.8, r: 1.8, texto: "Radio FM: elegir la emisora" });
  };

  // ── cada cuadro: el volumen según lo lejos que esté uno de la radio ──
  RF.actualizar = () => {
    if (!audio || !RF.prendida || !RF.pos) return;
    const J = E.jugador, d = Math.hypot(J.x - RF.pos.x, J.z - RF.pos.z);
    const lejos = E.clamp(1 - (d - 5) / 38, 0, 1);
    audio.volume = E.clamp((E.opciones.volumen ?? 1) * (E.opciones.radio ?? 0.8) * lejos * lejos, 0, 1);
    const chip = $("radioChip");
    if (chip) chip.classList.toggle("lejos", lejos <= 0.02);
  };

  // ── el dial ──
  function pintarLista() {
    const ul = $("radioLista"); if (!ul) return;
    ul.innerHTML = "";
    let grupo = null;
    for (const e of RF.EMISORAS) {
      const prov = e.lugar.includes("Chaco") ? "Chaco" : e.lugar.includes("Formosa") ? "Formosa" : e.lugar.includes("Corrientes") ? "Corrientes" : "Otras";
      if (prov !== grupo) { grupo = prov; const h = document.createElement("li"); h.className = "grupo"; h.textContent = prov; ul.appendChild(h); }
      const li = document.createElement("li");
      const ok = seguraOk(e);
      li.className = (RF.actual === e && RF.prendida ? "sonando " : "") + (ok ? "" : "no ") + (e.caida ? "caida" : "");
      li.innerHTML = `<b>${e.nombre}</b><small>${e.lugar}${e.comprobada ? "" : " · sin comprobar"}${e.caida ? " · sin señal" : ""}${ok ? "" : " · solo en el archivo descargado"}</small>`;
      if (ok) li.onclick = () => RF.sintonizar(e);
      ul.appendChild(li);
    }
  }
  function pintar() {
    const est = $("radioEstado"), chip = $("radioChip");
    if (est) est.textContent = RF.prendida && RF.actual ? `${RF.actual.nombre} — ${RF.estado}` : "Apagada";
    if (chip) { chip.hidden = !RF.prendida; $("radioChipTexto").textContent = RF.actual ? RF.actual.nombre : ""; chip.classList.toggle("sin", RF.estado !== "en el aire"); }
    if ($("radioPrender")) $("radioPrender").textContent = RF.prendida ? "Apagar" : "Prender";
    pintarLista();
  }
  RF.abrir = () => {
    $("radio").hidden = false;
    E.juego.soltarPuntero();
    pintar();
    directorio();
  };
  RF.cerrar = () => {
    $("radio").hidden = true;
    if (!E.entrada.tactil && E.juego.corriendo && !E.juego.enMenu()) { try { $("lienzo").requestPointerLock(); } catch (e) { /* no importa */ } }
  };
  RF.conectar = () => {
    $("radioCerrar").onclick = RF.cerrar;
    $("radioPrender").onclick = () => (RF.prendida ? RF.apagar() : RF.siguiente(0));
    $("radioAnterior").onclick = () => RF.siguiente(-1);
    $("radioSiguiente").onclick = () => RF.siguiente(1);
    const vol = $("radioVolumen");
    vol.value = E.opciones.radio ?? 0.8;
    vol.oninput = () => { E.opciones.radio = Number(vol.value); try { localStorage.setItem("estancia-opciones", JSON.stringify(E.opciones)); } catch (e) { /* no importa */ } };
    $("radioChip").onclick = RF.abrir;
    addEventListener("keydown", (ev) => { if (ev.code === "Escape" && !$("radio").hidden) RF.cerrar(); });
  };
})();
