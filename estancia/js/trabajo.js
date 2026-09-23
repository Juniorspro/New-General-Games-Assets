// El trabajo y la temporada: la cura de la bichera, la manga, la vida de
// estancia (mate, asado, catre, agua) y los días que pasan.
"use strict";
(() => {
  const W = (E.trabajo = {});
  const V = THREE.Vector3;
  const $ = (id) => document.getElementById(id);

  // ── la plata ── pesos. Lo que cuesta cada cosa en la temporada.
  const COSTO = { curabichera: 6000, aftosa: 2500, ivermectina: 3000, caravana: 1500, lazo: 45000 };
  const VALOR_VACA = 850000;
  W.COSTO = COSTO;

  // ════════════════════════════════════════════════════════════════════════
  // La cura: primer plano de la herida, en un lienzo 2D. Pinza para sacar los
  // gusanos (arrastrándolos para afuera de la herida) y curabichera hasta
  // cubrir todo. El curabichera hace salir a los gusanos: es como se hace.
  // ════════════════════════════════════════════════════════════════════════
  const cura = { activa: false };
  W.cura = cura;
  W.abrirCura = (v) => {
    const lz = $("curaLienzo"), g = lz.getContext("2d");
    const W2 = lz.width, H2 = lz.height;
    const az = E.azar(v.num * 31 + Math.floor(E.juego.dia));
    // El cuero de fondo, dibujado una vez: pelo en trazos del color del pelaje.
    const fondo = document.createElement("canvas"); fondo.width = W2; fondo.height = H2;
    const f = fondo.getContext("2d");
    const base = v.tipo === "angus" ? [22, 19, 18] : v.tipo === "braford" ? [123, 58, 28] : [106, 42, 20];
    f.fillStyle = `rgb(${base})`; f.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 9000; i++) {
      const x = az() * W2, y = az() * H2, k = 0.75 + az() * 0.5;
      f.strokeStyle = `rgba(${base[0] * k},${base[1] * k},${base[2] * k},0.6)`;
      f.lineWidth = 1 + az();
      f.beginPath(); f.moveTo(x, y); f.lineTo(x + 6 + az() * 8, y + 3 + az() * 5); f.stroke();
    }
    // La herida: hinchazón oscura, carne viva, humedad.
    const cx = W2 / 2, cy = H2 / 2 - 10, R = 96;
    const forma = [];
    for (let i = 0; i < 24; i++) forma.push(R * (0.8 + az() * 0.35));
    const contorno = (ctx, esc) => {
      ctx.beginPath();
      forma.forEach((r, i) => { const a = (i / forma.length) * Math.PI * 2; const x = cx + Math.cos(a) * r * esc * 1.2, y = cy + Math.sin(a) * r * esc * 0.85; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath();
    };
    f.save(); contorno(f, 1.35); f.fillStyle = "rgba(60,12,8,0.55)"; f.filter = "blur(10px)"; f.fill(); f.restore();
    f.save(); contorno(f, 1); f.clip();
    const gr = f.createRadialGradient(cx, cy, 10, cx, cy, R * 1.2);
    gr.addColorStop(0, "#3a0806"); gr.addColorStop(0.5, "#6b120d"); gr.addColorStop(1, "#8a2a1a");
    f.fillStyle = gr; f.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 260; i++) { f.fillStyle = `rgba(${150 + az() * 60},${20 + az() * 30},${15 + az() * 20},${0.2 + az() * 0.4})`; f.beginPath(); f.arc(cx + (az() - 0.5) * R * 2.2, cy + (az() - 0.5) * R * 1.6, 2 + az() * 6, 0, Math.PI * 2); f.fill(); }
    for (let i = 0; i < 70; i++) { f.fillStyle = `rgba(255,235,220,${0.25 + az() * 0.4})`; f.fillRect(cx + (az() - 0.5) * R * 2, cy + (az() - 0.5) * R * 1.4, 1 + az() * 2, 1); }
    f.restore();
    cura.fondo = fondo; cura.cx = cx; cura.cy = cy; cura.R = R; cura.contorno = contorno;
    cura.cubierto = new Float32Array(20 * 20);
    cura.celdas = 0;
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) { if (enHerida(i, j)) cura.celdas++; }
    cura.gusanos = [];
    for (let i = 0; i < v.salud.bichera.gusanos; i++) {
      const a = az() * Math.PI * 2, r = az() * R * 0.75;
      cura.gusanos.push({ x: cx + Math.cos(a) * r * 1.1, y: cy + Math.sin(a) * r * 0.75, ang: az() * 6.28, fase: az() * 6.28, fuera: 0.3 + az() * 0.3, afuera: false });
    }
    cura.vaca = v; cura.activa = true; cura.herr = "pinza"; cura.agarrado = null; cura.rociando = false;
    cura.paciencia = 1; cura.t = 0; cura.cobrado = false;
    $("cura").hidden = false;
    E.juego.soltarPuntero();
    marcarHerr();
    E.sonido && E.sonido.moscas(1);
  };
  function enHerida(i, j) {
    const x = (i + 0.5) / 20 * 640, y = (j + 0.5) / 20 * 480;
    return Math.hypot((x - 320) / 1.2, (y - 230) / 0.85) < 100;
  }
  function marcarHerr() {
    $("curaPinza").classList.toggle("elegido", cura.herr === "pinza");
    $("curaSpray").classList.toggle("elegido", cura.herr === "spray");
  }
  function puntoLienzo(ev) {
    const lz = $("curaLienzo"), r = lz.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * lz.width, y: ((ev.clientY - r.top) / r.height) * lz.height };
  }
  W.conectarCura = () => {
    const lz = $("curaLienzo");
    $("curaPinza").onclick = () => { cura.herr = "pinza"; marcarHerr(); };
    $("curaSpray").onclick = () => { cura.herr = "spray"; marcarHerr(); };
    $("curaSalir").onclick = () => W.cerrarCura(false);
    $("curaListo").onclick = () => W.cerrarCura(true);
    lz.addEventListener("pointerdown", (ev) => {
      if (!cura.activa) return;
      const p = puntoLienzo(ev);
      cura.puntero = p;
      if (cura.herr === "pinza") {
        let mejor = null, md = 26;
        for (const w of cura.gusanos) { if (w.afuera) continue; const d = Math.hypot(w.x - p.x, w.y - p.y); if (d < md) { md = d; mejor = w; } }
        cura.agarrado = mejor;
        if (mejor) E.sonido && E.sonido.pinza();
      } else cura.rociando = true;
      try { lz.setPointerCapture(ev.pointerId); } catch (e) { /* ya se fue */ }
    });
    lz.addEventListener("pointermove", (ev) => {
      if (!cura.activa) return;
      const p = puntoLienzo(ev), prev = cura.puntero || p;
      cura.puntero = p;
      if (cura.agarrado) {
        // Tirar de golpe pone nerviosa a la vaca.
        const brusco = Math.hypot(p.x - prev.x, p.y - prev.y);
        cura.paciencia -= brusco * 0.0009;
        cura.agarrado.x = p.x; cura.agarrado.y = p.y;
      }
    });
    const soltar = () => {
      if (!cura.activa) return;
      const w = cura.agarrado;
      if (w) {
        const fuera = Math.hypot((w.x - cura.cx) / 1.2, (w.y - cura.cy) / 0.85) > cura.R + 28;
        if (fuera) { w.afuera = true; E.sonido && E.sonido.pinza(); }
        else { const a = Math.random() * 6.28; w.x = cura.cx + Math.cos(a) * cura.R * 0.4; w.y = cura.cy + Math.sin(a) * cura.R * 0.3; }
      }
      cura.agarrado = null; cura.rociando = false;
    };
    lz.addEventListener("pointerup", soltar);
    lz.addEventListener("pointercancel", soltar);
  };
  W.cerrarCura = (terminada) => {
    if (!cura.activa) return;
    const v = cura.vaca;
    if (terminada) {
      if (!puedeTerminar()) return;
      v.salud.bichera = null;
      v.salud.curada = E.juego.dia;
      v.arisca = Math.max(0.25, v.arisca - 0.35);
      v.estado = "tumbada";
      v.destino = null;
      E.juego.gastar(COSTO.curabichera, "Curabichera");
      E.juego.decir("curada");
    }
    cura.activa = false;
    $("cura").hidden = true;
    E.sonido && E.sonido.moscas(0);
    E.sonido && E.sonido.rociar(false);
  };
  function puedeTerminar() {
    const quedan = cura.gusanos.filter((w) => !w.afuera).length;
    return quedan === 0 && cobertura() > 0.85;
  }
  function cobertura() {
    let n = 0;
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) if (enHerida(i, j) && cura.cubierto[j * 20 + i] > 0.8) n++;
    return n / cura.celdas;
  }
  W.actualizarCura = (dt) => {
    if (!cura.activa) return;
    cura.t += dt;
    const lz = $("curaLienzo"), g = lz.getContext("2d");
    g.drawImage(cura.fondo, 0, 0);
    // El curabichera: espuma violeta que va tapando la herida.
    if (cura.rociando && cura.puntero) {
      const i0 = Math.floor((cura.puntero.x / 640) * 20), j0 = Math.floor((cura.puntero.y / 480) * 20);
      for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
        if (i < 0 || j < 0 || i >= 20 || j >= 20) continue;
        const d = Math.hypot(i - i0, j - j0);
        if (d <= 2.2) cura.cubierto[j * 20 + i] = Math.min(1, cura.cubierto[j * 20 + i] + dt * (2.4 - d));
      }
      E.sonido && E.sonido.rociar(true);
    } else E.sonido && E.sonido.rociar(false);
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const c = cura.cubierto[j * 20 + i];
      if (c <= 0.02) continue;
      g.fillStyle = `rgba(${96 + c * 20},${48 + c * 10},${150 + c * 30},${Math.min(0.85, c * 0.9)})`;
      g.beginPath(); g.arc((i + 0.5) * 32, (j + 0.5) * 24, 13 + c * 5, 0, Math.PI * 2); g.fill();
    }
    // Los gusanos: blancos, anillados, retorciéndose. Con remedio encima salen.
    for (const w of cura.gusanos) {
      if (w.afuera) continue;
      const i = E.clamp(Math.floor((w.x / 640) * 20), 0, 19), j = E.clamp(Math.floor((w.y / 480) * 20), 0, 19);
      const remedio = cura.cubierto[j * 20 + i];
      w.fuera = Math.min(1, w.fuera + remedio * dt * 0.5);
      w.fase += dt * (4 + remedio * 8);
      const largo = 16 + 10 * w.fuera;
      g.save(); g.translate(w.x, w.y); g.rotate(w.ang + Math.sin(w.fase) * 0.4);
      for (let k = 0; k < 6; k++) {
        const u = k / 5, x = (u - 0.5) * largo, y = Math.sin(w.fase + u * 3) * 2.2;
        g.fillStyle = k === 5 ? "#e7dcc0" : `rgba(236,228,205,${0.55 + w.fuera * 0.45})`;
        g.beginPath(); g.ellipse(x, y, 3.4, 3.1 - Math.abs(u - 0.5) * 1.5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(160,140,110,0.5)"; g.lineWidth = 0.7; g.stroke();
      }
      g.restore();
    }
    // Moscas que vuelan encima.
    g.fillStyle = "#0b0b0b";
    for (let k = 0; k < 14; k++) {
      const a = cura.t * (2 + k * 0.3) + k * 1.9, r = 60 + (k % 5) * 30;
      g.beginPath(); g.arc(cura.cx + Math.cos(a) * r * 1.4, cura.cy + Math.sin(a * 1.3) * r * 0.8, 2.2, 0, Math.PI * 2); g.fill();
    }
    // La pinza, donde está el puntero.
    if (cura.puntero && cura.herr === "pinza") {
      g.strokeStyle = "#c9c9c9"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cura.puntero.x - 4, cura.puntero.y); g.lineTo(cura.puntero.x - 40, cura.puntero.y + 70); g.moveTo(cura.puntero.x + 4, cura.puntero.y); g.lineTo(cura.puntero.x - 30, cura.puntero.y + 74); g.stroke();
    }
    // La paciencia de la vaca: si se acaba, patea.
    cura.paciencia = Math.min(1, cura.paciencia - dt * 0.012 + (cura.agarrado ? 0 : dt * 0.004));
    if (cura.paciencia <= 0) {
      E.juego.golpe(cura.vaca, "patada");
      cura.paciencia = 0.55;
    }
    const quedan = cura.gusanos.filter((w) => !w.afuera).length;
    const cob = cobertura();
    $("curaPaciencia").style.width = cura.paciencia * 100 + "%";
    $("curaTexto").textContent = `Gusanos: ${quedan} · Curabichera: ${Math.round(cob * 100)} %`;
    $("curaListo").disabled = !puedeTerminar();
  };

  // ════════════════════════════════════════════════════════════════════════
  // La manga: la vaca entra, queda en el cepo, y se trabaja de costado.
  // ════════════════════════════════════════════════════════════════════════
  const manga = (W.manga = { activa: false, vaca: null, herr: "aftosa", accion: null });
  const HERRAMIENTAS = ["aftosa", "ivermectina", "caravana", "hierro"];
  W.trabajada = (v) => v.salud.vacunada && v.salud.desparasitada && v.salud.caravana && v.salud.marcada;
  W.entrarManga = () => {
    const v = E.animales.vacas.find((x) => !x.salud.muerta && x.estado === "corral" && !W.trabajada(x));
    if (!v) { E.juego.mostrar("No hay ninguna vaca sin trabajar adentro del corral."); return; }
    manga.vaca = v; manga.activa = true; manga.fase = "entrando"; manga.t = 0; manga.herr = "aftosa"; manga.accion = null;
    v.estado = "manga";
    E.jugador.bloqueado = "manga";
    E.juego.soltarPuntero();
    $("manga").hidden = false;
    marcarHerramienta();
    E.juego.decir("manga");
  };
  function marcarHerramienta() {
    document.querySelectorAll("#manga [data-herr]").forEach((b) => b.classList.toggle("elegido", b.dataset.herr === manga.herr));
    const v = manga.vaca;
    if (!v) return;
    const s = v.salud;
    $("mangaEstado").innerHTML = [["Aftosa", s.vacunada], ["Ivermectina", s.desparasitada], ["Caravana", s.caravana], ["Marca", s.marcada]]
      .map(([n, ok]) => `<span class="${ok ? "hecho" : ""}">${ok ? "✓" : "·"} ${n}</span>`).join("");
    const caliente = E.juego.hierroCaliente > 0;
    $("mangaHierro").textContent = caliente ? "Hierro (caliente)" : "Hierro (frío)";
  }
  W.conectarManga = () => {
    document.querySelectorAll("#manga [data-herr]").forEach((b) => { b.onclick = () => { manga.herr = b.dataset.herr; marcarHerramienta(); }; });
    $("mangaSoltar").onclick = () => W.salirManga(true);
    $("lienzo").addEventListener("pointerdown", (ev) => {
      if (!manga.activa || manga.fase !== "cepo" || manga.accion) return;
      aplicar(ev.clientX, ev.clientY);
    });
  };
  W.salirManga = (largar) => {
    const v = manga.vaca;
    if (v) {
      v.estado = largar ? "saliendo" : "corral";
      v.x = E.lugares.manga.x0 - 3; v.z = E.lugares.manga.z;
      v.yaw = -Math.PI / 2;
    }
    manga.activa = false; manga.vaca = null;
    if (manga.herramienta) manga.herramienta.visible = false;
    E.jugador.bloqueado = null;
    $("manga").hidden = true;
  };
  // La herramienta en 3D: jeringa, aplicador de caravana o hierro.
  function crearHerramientas() {
    const acero = new THREE.MeshStandardMaterial({ color: 0xbfc3c6, metalness: 0.8, roughness: 0.3 });
    const plastico = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.4, transparent: true, opacity: 0.85 });
    const g = new THREE.Group();
    const jeringa = new THREE.Group();
    jeringa.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10).rotateX(Math.PI / 2), plastico));
    jeringa.add(new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4).rotateX(Math.PI / 2).translate(0, 0, 0.095), acero));
    const aplicador = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xd8b21f, roughness: 0.5 }));
    const hierro = new THREE.Group();
    hierro.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6).rotateX(Math.PI / 2).translate(0, 0, -0.4), acero));
    const letra = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 16), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff5010, emissiveIntensity: 0 }));
    hierro.add(letra);
    g.add(jeringa, aplicador, hierro);
    E.motor.escena.add(g);
    g.visible = false;
    manga.herramienta = g; manga.piezas = { aftosa: jeringa, ivermectina: jeringa, caravana: aplicador, hierro };
    manga.letra = letra;
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function aplicar(cx, cy) {
    const v = manga.vaca, cam = E.motor.camara, lz = E.motor.renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - lz.left) / lz.width) * 2 - 1, -((cy - lz.top) / lz.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    // Con el modelo de Rezona se apunta a lo que se ve, no al esqueleto lógico.
    const hit = (v.piel ? ray.intersectObjects(v.piel.mallas, false) : ray.intersectObject(v.malla, false))[0];
    if (!hit) return;
    // ¿Qué parte tocó? En coordenadas del hueso del cuerpo y de la cabeza.
    const enCuerpo = v.huesos.cuerpo.worldToLocal(hit.point.clone());
    const enCabeza = v.piel && v.piel.roles.cabeza
      ? v.piel.raiz.worldToLocal(hit.point.clone()).sub(v.piel.raiz.worldToLocal(v.piel.roles.cabeza.getWorldPosition(new V())))
      : v.huesos.cabeza.worldToLocal(hit.point.clone());
    let parte = "cuerpo";
    if (enCabeza.length() < 0.32 && Math.abs(enCabeza.x) > 0.1) parte = "oreja";
    else if (enCuerpo.z > 0.55) parte = "cuello";
    else if (enCuerpo.z < -0.25 && enCuerpo.y > -0.15) parte = "anca";
    const h = manga.herr, s = v.salud;
    const quiere = { aftosa: "cuello", ivermectina: "cuello", caravana: "oreja", hierro: "anca" }[h];
    if (parte !== quiere) { E.juego.mostrar({ cuello: "La vacuna va en la tabla del cuello.", oreja: "La caravana va en la oreja.", anca: "La marca va en el anca." }[quiere]); return; }
    if ((h === "aftosa" && s.vacunada) || (h === "ivermectina" && s.desparasitada) || (h === "caravana" && s.caravana) || (h === "hierro" && s.marcada)) { E.juego.mostrar("Eso ya está hecho."); return; }
    if (h === "hierro" && E.juego.hierroCaliente <= 0) { E.juego.mostrar("El hierro está frío. Calentalo en el fogón."); return; }
    manga.accion = { herr: h, punto: hit.point.clone(), normal: hit.face ? hit.face.normal.clone() : new V(0, 0, 1), t: 0, dura: h === "hierro" ? 2.2 : h === "caravana" ? 0.8 : 1.3, parte };
    const pieza = manga.piezas[h];
    for (const p of Object.values(manga.piezas)) p.visible = false;
    pieza.visible = true;
    manga.herramienta.visible = true;
    manga.letra.material.emissiveIntensity = h === "hierro" ? 3 : 0;
  }
  function terminarAccion(a) {
    const v = manga.vaca, s = v.salud;
    if (a.herr === "aftosa") { s.vacunada = true; E.juego.gastar(COSTO.aftosa, "Vacuna aftosa"); }
    if (a.herr === "ivermectina") { s.desparasitada = true; E.juego.gastar(COSTO.ivermectina, "Ivermectina"); }
    if (a.herr === "caravana") {
      s.caravana = true; E.juego.gastar(COSTO.caravana, "Caravana");
      // Caravana amarilla con el número, en la oreja izquierda.
      const mat = new THREE.MeshStandardMaterial({ color: 0xe8c21a, roughness: 0.5 });
      if (v.piel) {
        const tag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.012), mat);
        E.modelos.pegar(v.piel, tag, a.punto, afuera(v, a.punto)); v.caravanaMalla = tag;
      } else {
        const tag = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.06), mat);
        tag.position.set(0.24, 0.0, 0.03);
        v.huesos.cabeza.add(tag); v.caravanaMalla = tag;
      }
    }
    if (a.herr === "hierro") {
      s.marcada = true;
      // La marca quemada: una calcomanía oscura en el anca, del lado trabajado.
      const tex = E.lienzo(128, 128, (g, w, h) => {
        g.strokeStyle = "rgba(25,12,6,0.9)"; g.lineWidth = 12; g.lineCap = "round";
        g.beginPath(); g.arc(w / 2, h / 2, 34, 0.3, Math.PI * 2 - 0.3); g.stroke();
        g.beginPath(); g.moveTo(w / 2 - 20, h / 2 + 10); g.lineTo(w / 2, h / 2 - 22); g.lineTo(w / 2 + 20, h / 2 + 10); g.stroke();
      });
      const marca = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }));
      if (v.piel) E.modelos.pegar(v.piel, marca, a.punto, afuera(v, a.punto));
      else { marca.position.set(0.31, 0.08, -0.55); marca.rotation.y = Math.PI / 2; v.huesos.cuerpo.add(marca); }
      v.marcaMalla = marca;
      humo(a.punto);
    }
    E.sonido && E.sonido.mugido(v, 1.2);
    marcarHerramienta();
    if (W.trabajada(v)) E.juego.mostrar("Lista. Soltala con el botón o con E.");
  }
  // Hacia afuera del costado donde cayó el punto (para pegar caravana y marca).
  function afuera(v, punto) {
    const lado = Math.sign(v.piel.raiz.worldToLocal(punto.clone()).x) || 1;
    return new V(lado, 0, 0).transformDirection(v.piel.raiz.matrixWorld);
  }
  function humo(p) {
    const tex = E.lienzo(32, 32, (g, w, h) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x4a4540, transparent: true, depthWrite: false, opacity: 0.5 }));
      s.position.copy(p);
      s.userData = { v: new V((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3), vida: 1.6 + Math.random() };
      E.motor.escena.add(s);
      W.humos.push(s);
    }
    E.sonido && E.sonido.chirrido();
  }
  W.humos = [];
  W.construir = () => crearHerramientas();

  W.actualizarManga = (dt, t) => {
    // Los humos de la marca, vivan donde vivan.
    for (let i = W.humos.length - 1; i >= 0; i--) {
      const s = W.humos[i], u = s.userData;
      u.vida -= dt; s.position.addScaledVector(u.v, dt); s.scale.setScalar(0.15 + (2 - u.vida) * 0.35);
      s.material.opacity = Math.max(0, u.vida * 0.3);
      if (u.vida <= 0) { E.motor.escena.remove(s); W.humos.splice(i, 1); }
    }
    if (!manga.activa) return;
    const v = manga.vaca, L = E.lugares, cam = E.motor.camara;
    manga.t += dt;
    if (manga.fase === "entrando") {
      // Camina por la manga hasta el cepo.
      const destino = L.manga.x1 - 0.9;
      if (v.x < L.manga.x0 - 1) { const dx = L.manga.x0 - v.x, dz = L.manga.z - v.z, d = Math.hypot(dx, dz) || 1; v.yaw = Math.atan2(dx, dz); v.x += (dx / d) * 1.4 * dt; v.z += (dz / d) * 1.4 * dt; v.vReal = 1.4; }
      else { v.yaw = Math.PI / 2; v.z = L.manga.z; v.x = Math.min(destino, v.x + 1.3 * dt); v.vReal = 1.3; }
      if (v.x >= destino - 0.01) { manga.fase = "cepo"; v.estado = "cepo"; v.vReal = 0; E.sonido && E.sonido.golpeSeco(); }
    } else {
      v.vReal = 0;
    }
    // La cámara al costado de la manga, del lado izquierdo de la vaca.
    const foco = new V(v.x - 0.25, E.terreno.altura(v.x, v.z) + 1.0, v.z);
    const pos = new V(v.x - 0.2, E.terreno.altura(v.x, v.z) + 1.55, v.z - 2.1);
    cam.position.lerp(pos, Math.min(1, dt * 4));
    cam.lookAt(foco);
    E.jugador.manos.visible = false;
    E.jugador.cuerpo.visible = false;
    const a = manga.accion;
    if (a) {
      a.t += dt;
      const pieza = manga.herramienta;
      const desde = cam.position.clone().add(new V(0.3, -0.3, 0).applyQuaternion(cam.quaternion));
      const cerca = a.punto.clone().addScaledVector(new V().subVectors(cam.position, a.punto).normalize(), 0.08);
      const u = Math.min(1, a.t / 0.35);
      pieza.position.lerpVectors(desde, cerca, u * u * (3 - 2 * u));
      pieza.lookAt(a.punto);
      if (a.herr === "hierro" && Math.random() < dt * 20) humo(a.punto);
      if (a.t >= a.dura) { terminarAccion(a); manga.accion = null; pieza.visible = false; }
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // La temporada.
  // ════════════════════════════════════════════════════════════════════════
  W.DIAS = 20;
  // Al amanecer: las agusanadas empeoran, las que llevan tres días se mueren,
  // y aparece la bichera en otra.
  W.amanecer = () => {
    const J = E.juego, A = E.animales;
    const muertas = [];
    for (const v of A.vacas) {
      if (v.salud.muerta || !v.salud.bichera) continue;
      v.salud.bichera.dias++;
      v.salud.bichera.gusanos += 4;
      if (v.salud.bichera.dias >= 3) { v.salud.muerta = true; v.estado = "muerta"; muertas.push(v); }
    }
    const sanas = A.vacas.filter((v) => !v.salud.muerta && !v.salud.bichera && (!v.salud.curada || J.dia - v.salud.curada > 3));
    const nuevas = [];
    const cuantas = Math.random() < 0.25 ? 2 : Math.random() < 0.8 ? 1 : 0;
    for (let i = 0; i < cuantas && sanas.length; i++) {
      const v = sanas.splice(Math.floor(Math.random() * sanas.length), 1)[0];
      A.enfermar(v);
      nuevas.push(v);
    }
    return { muertas, nuevas };
  };
  // Hacia dónde queda algo, dicho como lo diría el puestero.
  W.rumbo = (x, z) => {
    const L = E.lugares.rancho, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
    const a = Math.atan2(dx, -dz) * 180 / Math.PI;          // 0 = norte, 90 = este
    const nombres = ["el norte", "el noreste", "el este", "el sureste", "el sur", "el suroeste", "el oeste", "el noroeste"];
    const n = nombres[((Math.round(a / 45) % 8) + 8) % 8];
    const lejos = d > 220 ? "lejos, " : d > 110 ? "" : "cerquita, ";
    return `${lejos}para ${n}`;
  };
  W.balance = () => {
    const A = E.animales, vivas = A.vacas.filter((v) => !v.salud.muerta);
    const trabajadas = vivas.filter(W.trabajada).length;
    const hacienda = vivas.reduce((s, v) => s + VALOR_VACA * (W.trabajada(v) ? 1.1 : v.salud.vacunada ? 1.03 : 1), 0);
    return { vivas: vivas.length, total: A.vacas.length, trabajadas, vacunadas: vivas.filter((v) => v.salud.vacunada).length, hacienda, patrimonio: hacienda + E.juego.dinero };
  };
})();
