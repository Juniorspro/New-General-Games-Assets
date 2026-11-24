// El giro del teléfono parado, los tres idiomas y el menú nuevo, en tres
// pantallas: PC (1200×680), teléfono acostado (844×390) y teléfono parado
// (390×844, el juego se ve girado 90°). Sin red: todo desde file://.
//
//   PW=$(npm root -g)/playwright node giro-idioma-prueba.mjs [pc|acostado|parado]
//
// Qué mira, además de sacar fotos (tiras/gi-*.png):
// - la pantalla de idioma antes del menú, con la elección anterior marcada;
// - que no quede ninguna clave sin traducir a la vista ("menu.jugar"…);
// - con el teléfono parado: la caja girada, el lienzo con el tamaño del juego
//   (844×390) y no el de la pantalla, la palanca empujada "para adelante" y
//   "para la derecha" (el Guacho tiene que ir hacia donde mira la cámara y a su
//   derecha), mirar arrastrando, tocar un lugar del mapa y agarrar un gusano en
//   la cura. Los toques van por CDP (Input.dispatchTouchEvent), que es lo más
//   parecido a un dedo: el navegador arma los pointer events de tipo "touch".
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);

const VISTAS = {
  pc: { viewport: { width: 1200, height: 680 }, tactil: false },
  acostado: { viewport: { width: 844, height: 390 }, tactil: true },
  parado: { viewport: { width: 390, height: 844 }, tactil: true },
};
const elegidas = process.argv[2] ? [process.argv[2]] : Object.keys(VISTAS);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const errores = [], resultados = {};
const CLAVE_SUELTA = /\b(menu|hud|cmd|tarea|accion|punto|msj|parte|lugar|libreta|como|cred|op|radio|mapa|manga|cura|fogon|carga|escaneo|calidad|chat|perro|frase|idioma|consejo|boton|pausa|fin|tactil)\.[A-Za-z]/;

for (const nom of elegidas) {
  const V = VISTAS[nom], r = (resultados[nom] = {});
  const ctx = await b.newContext({ viewport: V.viewport, hasTouch: V.tactil, isMobile: V.tactil, locale: "es-AR" });
  // Calidad ultra baja guardada: sin el escaneo (20 s en SwiftShader) y con más cuadros.
  // En la PC no hay idioma guardado (primera vez: nada marcado); en los
  // teléfonos queda "pt" de una vez anterior, para ver la marca.
  await ctx.addInitScript((tel) => {
    try {
      if (!sessionStorage.getItem("ya")) {
        sessionStorage.setItem("ya", "1");
        localStorage.setItem("estancia-opciones", JSON.stringify({ calidad: "ultrabaja", fpsMedido: 2 }));
        if (tel) localStorage.setItem("estancia-idioma", "pt"); else localStorage.removeItem("estancia-idioma");
      }
    } catch (e) { /* nada */ }
  }, V.tactil);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(nom + ": " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errores.push(nom + " (consola): " + m.text()); });
  await p.route("**/*", (q) => q.request().url().startsWith("file://") ? q.continue() : q.abort());
  const cdp = await ctx.newCDPSession(p);
  let n = 0;
  // SwiftShader da uno o dos cuadros por segundo: la foto espera un cuadro nuevo.
  const foto = async (que) => {
    const t1 = Date.now();
    await p.screenshot({ path: `tiras/gi-${nom}-${String(n++).padStart(2, "0")}-${que}.png`, timeout: 180000 });
    if (process.env.LENTO) console.log(`  foto ${que}: ${Date.now() - t1} ms`);
  };
  const sueltas = async () => p.evaluate((re) => { const m = document.body.innerText.match(new RegExp(re)); return m ? m[0] : null; }, CLAVE_SUELTA.source);
  // Un dedo: apoyar, mover de a pasos y (si se pide) levantar.
  const dedo = {
    async apoyar(x, y) { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] }); },
    async mover(x, y) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] }); },
    async levantar() { await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); },
    async tocar(x, y) { await this.apoyar(x, y); await p.waitForTimeout(60); await this.levantar(); },
  };
  // De coordenadas del juego a la pantalla (sin usar GIRO, para no probarlo
  // contra sí mismo): girado 90° a la derecha, el eje x del juego es el y de la
  // pantalla y el eje y del juego es −x desde el borde derecho.
  const aPantalla = (lx, ly) => (nom === "parado" ? [V.viewport.width - ly, lx] : [lx, ly]);

  const t0 = Date.now();
  await p.goto("file://" + process.cwd() + "/" + (process.env.HTML || "estancia.html"));
  await p.waitForSelector("#idioma:not([hidden])", { timeout: 400000 });
  r.cargaSeg = Math.round((Date.now() - t0) / 1000);
  await p.waitForTimeout(1500);
  r.giro = await p.evaluate(() => ({ activo: GIRO.activo, ancho: GIRO.ancho, alto: GIRO.alto, clase: document.documentElement.classList.contains("girado"), transform: document.getElementById("raiz").style.transform }));
  r.marcadoAlAbrir = await p.evaluate(() => [...document.querySelectorAll(".idioma-boton.elegido")].map((x) => x.dataset.idioma));
  await foto("idioma");

  // Los tres idiomas, uno detrás de otro: menú, y en cada uno una pestaña distinta.
  const orden = nom === "parado" ? ["pt", "es", "en"] : nom === "acostado" ? ["en", "pt", "es"] : ["es", "en", "pt"];
  r.idiomas = {};
  for (const [i, cod] of orden.entries()) {
    if (i > 0) {
      if (V.tactil) await p.tap("#menuIdioma"); else await p.click("#menuIdioma");
      await p.waitForSelector("#idioma:not([hidden])");
      await p.waitForTimeout(900);
      r.idiomas["marcado-antes-de-" + cod] = await p.evaluate(() => [...document.querySelectorAll(".idioma-boton.elegido")].map((x) => x.dataset.idioma).join(","));
      if (i === 1) await foto("idioma-marcado");
    }
    if (V.tactil) await p.tap(`[data-idioma="${cod}"]`); else await p.click(`[data-idioma="${cod}"]`);
    await p.waitForSelector("#menu:not([hidden])");
    await p.waitForTimeout(2600);
    await foto(`menu-${cod}`);
    const pestana = ["libreta", "como", "creditos"][i];
    if (V.tactil) await p.tap(`.pestana-boton[data-pestana="${pestana}"]`); else await p.click(`.pestana-boton[data-pestana="${pestana}"]`);
    // 5 s: con la máquina cargada SwiftShader da un cuadro cada 2-3 s y la
    // animación de entrada de la pestaña recién arranca en el cuadro siguiente
    // (a los 1,5 s la opacidad seguía en 0: la foto salía vacía).
    await p.waitForTimeout(5000);
    await foto(`${pestana}-${cod}`);
    r.idiomas[cod] = await p.evaluate(() => ({ lang: document.documentElement.lang, titulo: document.title, empezar: document.getElementById("menuEmpezar").textContent, pestana: document.querySelector(".pestana-boton.activa span").textContent }));
    r.idiomas[cod].claveSuelta = await sueltas();
    if (V.tactil) await p.tap('.pestana-boton[data-pestana="jugar"]'); else await p.click('.pestana-boton[data-pestana="jugar"]');
  }

  // Opciones desde el menú: cambiar el idioma con el desplegable.
  if (V.tactil) await p.tap("#menuOpciones"); else await p.click("#menuOpciones");
  await p.waitForTimeout(900);
  await foto("opciones");
  const otro = orden[0];
  await p.selectOption("#opIdioma", otro);
  await p.waitForTimeout(400);
  r.opcionesCambia = await p.evaluate(() => ({ lang: document.documentElement.lang, h2: document.querySelector("#opciones h2").textContent }));
  await foto("opciones-cambiado");
  if (V.tactil) await p.tap("#opciones [data-volver]"); else await p.click("#opciones [data-volver]");
  await p.waitForTimeout(2500);

  // A jugar: el parte del primer día y el HUD.
  if (V.tactil) await p.tap("#menuEmpezar"); else await p.click("#menuEmpezar");
  await p.waitForSelector("#parte:not([hidden])");
  await p.waitForTimeout(1500);
  await foto("parte");
  if (V.tactil) await p.tap("#parteSeguir"); else await p.click("#parteSeguir");
  await p.waitForTimeout(800);
  // En la PC "Salir al campo" toma el puntero; al soltarlo para la foto sale la
  // pausa (como debe): se la esconde y la cámara vuelve a mirar al frente.
  await p.evaluate(() => { E.juego.soltarPuntero(); __juego.hora(10); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("pausa").hidden = true; __juego.J().pitch = 0; });
  await p.waitForTimeout(2500);
  await foto("hud");
  r.hud = await p.evaluate(() => ({ dia: document.getElementById("hudDia").textContent, tareas: document.getElementById("hudObjetivos").innerText, lienzo: [E.motor.renderer.domElement.clientWidth, E.motor.renderer.domElement.clientHeight], aspecto: +E.motor.camara.aspect.toFixed(3), claveSuelta: null }));
  r.hud.claveSuelta = await sueltas();
  // Los sonidos grabados (js/sonidos.js): cuántos buffers se decodificaron, qué
  // loops quedaron armados, y cada suelto disparado una vez (sin errores).
  r.sonido = await p.evaluate(async () => {
    const S = E.sonido;
    S.iniciar();
    for (let i = 0; i < 120 && S.contarMuestras() < Object.keys(SONIDOS_B64).length; i++) await new Promise((ok) => setTimeout(ok, 250));
    const J = __juego.J();
    S.ladrido(J.x + 3, J.z, 1, 2); S.paso(false); S.paso(true, true); S.tranquera(J.x, J.z + 4); S.agua(); S.zumbido(0.8);
    const sueltas = ["perro_ladrido", "pasos_pasto", "agua_chapoteo", "tranquera"].map((g) => [g, S.muestra(g, { vol: 0.01 })]);
    return { ...S.estado(), esperados: Object.keys(SONIDOS_B64).length, sueltas: Object.fromEntries(sueltas), creditosCCBY: SONIDOS_CREDITOS.map((c) => c.id), enCreditos: document.querySelectorAll("#creditosSonidos li").length };
  });

  if (V.tactil) {
    // Con el bucle congelado y la simulación a mano, cada prueba avanza igual
    // aunque SwiftShader dé un cuadro por segundo.
    await p.evaluate(() => { __juego.congelar(true); __juego.paso(0.05, 2); });
    const estado = () => p.evaluate(() => { const J = __juego.J(), f = new THREE.Vector3(); E.motor.camara.getWorldDirection(f); f.y = 0; f.normalize(); return { x: J.x, z: J.z, yaw: J.yaw, fx: f.x, fz: f.z }; });
    const palanca = async (dlx, dly, que) => {
      const a = await estado();
      const [x0, y0] = aPantalla(200, 300);                // abajo a la izquierda del juego
      await dedo.apoyar(x0, y0); await p.waitForTimeout(80);
      for (let k = 1; k <= 4; k++) { const [x, y] = aPantalla(200 + (dlx * k) / 4, 300 + (dly * k) / 4); await dedo.mover(x, y); await p.waitForTimeout(40); }
      const leida = await p.evaluate(() => ({ ...E.entrada.palanca }));
      await p.evaluate(() => __juego.paso(0.05, 30));
      await p.evaluate(() => __juego.foto());
      await foto(que);
      await dedo.levantar(); await p.waitForTimeout(80);
      await p.evaluate(() => __juego.paso(0.05, 2));
      const d = await estado(), mx = d.x - a.x, mz = d.z - a.z, l = Math.hypot(mx, mz) || 1;
      // Adelante = hacia donde mira la cámara; derecha = (−fz, fx).
      return { palanca: { x: +leida.x.toFixed(2), y: +leida.y.toFixed(2), activa: leida.activa }, metros: +l.toFixed(2), conAdelante: +((mx * a.fx + mz * a.fz) / l).toFixed(2), conDerecha: +((mx * -a.fz + mz * a.fx) / l).toFixed(2) };
    };
    r.palancaAdelante = await palanca(0, -50, "palanca-adelante");
    r.palancaDerecha = await palanca(50, 0, "palanca-derecha");
    // Mirar: arrastrar hacia la derecha en la mitad derecha del juego gira la vista a la derecha (el yaw baja).
    {
      const a = await estado();
      const [x0, y0] = aPantalla(520, 230);
      await dedo.apoyar(x0, y0); await p.waitForTimeout(60);
      for (let k = 1; k <= 4; k++) { const [x, y] = aPantalla(520 + 15 * k, 230); await dedo.mover(x, y); await p.waitForTimeout(40); }
      await p.evaluate(() => __juego.paso(0.05, 1));
      await dedo.levantar();
      const d = await estado();
      r.mirar = { dyaw: +(d.yaw - a.yaw).toFixed(3), esperado: "negativo (60 px a la derecha ≈ −0,21 rad)" };
    }
    // Un botón de la pantalla táctil (el mapa), tocado por coordenadas: el navegador ubica la caja girada.
    {
      const c = await p.evaluate(() => { const q = document.querySelector('[data-boton="mapa"]').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
      await dedo.apoyar(c[0], c[1]); await p.waitForTimeout(60);
      await p.evaluate(() => __juego.paso(0.05, 1));
      await dedo.levantar();
      await p.waitForTimeout(400);
      r.botonMapaAbre = await p.evaluate(() => !document.getElementById("mapa").hidden);
    }
    // Tocar el casco en el mapa.
    {
      await p.evaluate(() => { __juego.congelar(false); if (!E.mapa.abierto) E.mapa.abrir(); });
      await p.waitForTimeout(1500);
      const pt = await p.evaluate(() => {
        const c = document.getElementById("mapaLienzo"), W = c.clientWidth, H = c.clientHeight, esc = Math.min(W / 840, H / 920);
        // El pueblo y no el casco: uno arranca al lado del casco, y al marcarlo
        // "llegaba" en el cuadro siguiente y el destino se borraba solo.
        const lug = E.mapa.lugares().find((l) => l.id === "pueblo");
        const lx = W / 2 + lug.x * esc, ly = H / 2 + (lug.z - 40) * esc, q = c.getBoundingClientRect();
        return GIRO.activo ? [q.right - ly, q.top + lx] : [q.left + lx, q.top + ly];
      });
      await dedo.tocar(pt[0], pt[1]);
      await p.waitForTimeout(1500);
      r.mapaToque = await p.evaluate(() => (E.mapa.destino ? E.mapa.destino.id : null));
      await foto("mapa");
      await p.evaluate(() => { E.mapa.ir(null); E.mapa.cerrar(); });
      await p.waitForTimeout(500);
    }
    // La cura: agarrar el primer gusano con el dedo.
    {
      const pt = await p.evaluate(() => {
        const v = E.animales.vacas.find((x) => x.salud.bichera && !x.salud.muerta);
        E.trabajo.abrirCura(v);
        const lz = document.getElementById("curaLienzo"), w = E.trabajo.cura.gusanos[0];
        const lx = (w.x / 640) * lz.clientWidth, ly = (w.y / 480) * lz.clientHeight, q = lz.getBoundingClientRect();
        return GIRO.activo ? [q.right - ly, q.top + lx] : [q.left + lx, q.top + ly];
      });
      await p.waitForTimeout(1200);
      await dedo.apoyar(pt[0], pt[1]); await p.waitForTimeout(150);
      r.curaAgarro = await p.evaluate(() => E.trabajo.cura.agarrado === E.trabajo.cura.gusanos[0]);
      await foto("cura");
      await dedo.levantar();
      await p.evaluate(() => E.trabajo.cerrarCura(false));
    }
    await p.waitForTimeout(600);
  } else {
    // PC: el mapa con el ratón (sin giro, la cuenta tiene que dar igual).
    await p.evaluate(() => E.mapa.abrir());
    await p.waitForTimeout(1200);
    const pt = await p.evaluate(() => {
      const c = document.getElementById("mapaLienzo"), W = c.clientWidth, H = c.clientHeight, esc = Math.min(W / 840, H / 920);
      const lug = E.mapa.lugares().find((l) => l.id === "pueblo"), q = c.getBoundingClientRect();
      return [q.left + W / 2 + lug.x * esc, q.top + H / 2 + (lug.z - 40) * esc];
    });
    await p.mouse.click(pt[0], pt[1]);
    await p.waitForTimeout(800);
    r.mapaToque = await p.evaluate(() => (E.mapa.destino ? E.mapa.destino.id : null));
    await foto("mapa");
    await p.evaluate(() => { E.mapa.ir(null); E.mapa.cerrar(); E.juego.soltarPuntero(); });
    await p.waitForTimeout(600);
    await p.evaluate(() => { document.getElementById("pausa").hidden = true; });
    // El chat en el idioma elegido.
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    await p.keyboard.type("/", { delay: 40 }); await p.waitForTimeout(500);
    await foto("chat");
    await p.keyboard.type(await p.evaluate(() => t("cmd.hora")), { delay: 30 }); await p.keyboard.press("Enter");
    await p.waitForTimeout(400);
    r.chat = await p.evaluate(() => [...document.querySelectorAll(".chat-linea")].map((d) => d.textContent).slice(-2));
  }
  r.libreta = await p.evaluate(() => ({ ...E.libreta.datos }));
  console.log(nom, JSON.stringify(r, null, 1));
  await ctx.close();
}
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await b.close();
