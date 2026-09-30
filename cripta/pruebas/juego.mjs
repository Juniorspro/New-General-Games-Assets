// Las pruebas en el navegador (Chromium sin placa de video, ver memoria/probar.md).
//   (desde la raíz del repo) python3 -m http.server 8123 --bind 127.0.0.1 &
//   node cripta/pruebas/juego.mjs [--capturas carpeta]
//
// El juego se abre con ?pausa: no avanza solo y la prueba lo hace avanzar de
// a pasos de 1/60 s (tiempo de juego, no de reloj). Las sondas están en
// window.__C (main.js).
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.CRIPTA_URL || 'http://127.0.0.1:8123/cripta/index.html';
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;

const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fallas = 0, total = 0;
const resultados = [];

async function pagina({ w = 412, h = 892, q = '', toque = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: toque, isMobile: toque });
  const pg = await ctx.newPage();
  pg.errores = [];
  pg.on('pageerror', (e) => pg.errores.push(String(e.stack || e).slice(0, 500)));
  pg.on('console', (m) => { if (m.type() === 'error') pg.errores.push(m.text().slice(0, 300)); });
  await pg.goto(`${BASE}?pausa&${q}`);
  await pg.waitForFunction(() => window.listo, null, { timeout: 20000 });
  return pg;
}

async function prueba(nombre, fn) {
  total++;
  const t0 = Date.now();
  try {
    const nota = await fn();
    resultados.push(['ok', nombre, Date.now() - t0, nota]);
    console.log(`  ok   ${nombre}${nota ? ' — ' + nota : ''} (${Date.now() - t0} ms)`);
  } catch (e) {
    fallas++;
    resultados.push(['FALLA', nombre, Date.now() - t0, String(e.message || e)]);
    console.log(`  FALLA ${nombre}: ${String(e.message || e).slice(0, 400)}`);
  }
}
const afirmar = (c, m) => { if (!c) throw new Error(m); };
async function captura(pg, nombre) { if (CAPTURAS) await pg.screenshot({ path: `${CAPTURAS}/${nombre}.png` }); }
async function sinErrores(pg) { afirmar(pg.errores.length === 0, 'errores en la página: ' + pg.errores.join(' | ')); }

// Juega el camino más corto del resolvedor en la partida de verdad. Con
// `seguro`, Lu no muere por los bichos (para probar que el motor y el
// resolvedor coinciden en portales, flechas y paredes frágiles).
const JUGAR = `async (seguro) => {
  const C = window.__C, D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const j = C.app.escena, camino = C.camino(j.indice);
  let k = 0, pasos = 0;
  while (pasos < 30000) {
    const p = C.partida;
    if (seguro) { p.invulnerable = 1e9; if (p.lava) p.lava.espera = 1e9; }
    if (p.estado !== 'jugando') break;
    if (!p.lu.mueve && !p.buffer && k < camino.length) { C.deslizar(...D[camino[k]]); k++; }
    C.pasos(1); pasos++;
  }
  for (let i = 0; i < 120 && !C.app.escena.capa; i++) C.pasos(1);
  return { pasos, movidas: k, largo: camino.length, estado: C.partida.estado, capa: C.app.escena.capa?.constructor.name, estrellas: C.partida.recogido.estrellas.length };
}`;

console.log('cripta: pruebas en el navegador');

await prueba('arranca sin errores en la portada', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es' });
  await pg.evaluate(() => window.__C.pasos(90, true));
  const r = await pg.evaluate(() => ({ escena: window.__C.escena, botones: window.__C.botones() }));
  afirmar(r.escena === 'portada', 'escena ' + r.escena);
  afirmar(['jugar', 'torre', 'tienda', 'ajustes'].every((b) => r.botones.includes(b)), 'faltan botones: ' + r.botones);
  await captura(pg, 'portada');
  await sinErrores(pg);
  await pg.close();
});

await prueba('la intro de JXSTUDIOS arranca sola (sin tocar), dura dos segundos y deja en la portada; un toque la saltea', async () => {
  const pg = await pagina({ q: 'intro&limpio&idioma=es' });
  // espera en negro hasta 0,3 s a que arranque el audio (acá, sin toque, no arranca)
  const antes = await pg.evaluate(() => window.__C.escena);
  await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => {
    const C = window.__C;
    C.pasos(1);
    const intro = C.escena, musica = !!C.app.escena.musica;
    C.pasos(150, true);
    return { intro, musica, despues: C.escena };
  });
  afirmar(antes === 'espera' && r.intro === 'intro' && !r.musica && r.despues === 'portada', JSON.stringify({ antes, ...r }));
  await pg.goto(`${BASE}?pausa&intro&limpio`);
  await pg.waitForFunction(() => window.listo);
  await pg.waitForTimeout(400);
  const s = await pg.evaluate(() => {
    const C = window.__C, toque = () => C.app.entrada.cola.push({ tipo: 'bajar', x: 10, y: 10 });
    C.pasos(5); toque(); C.pasos(30); toque(); C.pasos(45);
    return C.escena;
  });
  afirmar(s === 'portada', 'saltear la intro: ' + s);
  await sinErrores(pg);
  await pg.close();
});

await prueba('de la portada al mapa y al primer nivel, tocando', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es' });
  await pg.evaluate(() => { window.__C.pasos(60); window.__C.boton('jugar'); window.__C.pasos(80, true); });
  let e = await pg.evaluate(() => window.__C.escena);
  afirmar(e === 'mapa', 'después de JUGAR: ' + e);
  await captura(pg, 'mapa');
  // tocar el nodo del 1-1 donde lo dibuja el mapa
  await pg.evaluate(() => { const m = window.__C.app.escena, [x, y] = m.posNodo(0); window.__C.tocar(x, y - m.scroll); window.__C.pasos(80, true); });
  e = await pg.evaluate(() => ({ escena: window.__C.escena, id: window.__C.app.escena.def?.id }));
  afirmar(e.escena === 'nivel' && e.id === '1-1', 'después de tocar el nodo: ' + JSON.stringify(e));
  await sinErrores(pg);
  await pg.close();
});

await prueba('1-1 jugado de verdad: resultado, estrellas, monedas y guardado', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es&directo=nivel:0' });
  const r = await pg.evaluate(`(${JUGAR})(false)`);
  afirmar(r.capa === 'Resultado', 'no salió el resultado: ' + JSON.stringify(r));
  await pg.evaluate(() => window.__C.pasos(150, true));
  await captura(pg, 'resultado');
  const d = await pg.evaluate(() => JSON.parse(localStorage.getItem('cripta-neon-1')));
  afirmar(d && d.hechos['1-1'] === true, 'no se guardó el nivel hecho');
  afirmar(d.estrellas['1-1'] === 3, 'estrellas guardadas: ' + d.estrellas['1-1']);
  afirmar(d.monedas >= 20, 'monedas guardadas: ' + d.monedas);
  // al recargar, el 1-2 está abierto y las monedas siguen
  await pg.goto(`${BASE}?pausa&directo=mapa`);
  await pg.waitForFunction(() => window.listo);
  const m = await pg.evaluate(() => ({ monedas: window.__C.datos.monedas, sel: window.__C.app.escena.sel }));
  afirmar(m.monedas === d.monedas && m.sel === 1, 'después de recargar: ' + JSON.stringify(m));
  await sinErrores(pg);
  await pg.close();
  return `${r.movidas} deslizamientos, ${d.monedas} monedas`;
});

await prueba('los 30 niveles se ganan en el motor (camino del resolvedor)', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es' });
  const malos = [];
  for (let i = 0; i < 30; i++) {
    await pg.goto(`${BASE}?pausa&limpio&directo=nivel:${i}`);
    await pg.waitForFunction(() => window.listo);
    const r = await pg.evaluate(`(${JUGAR})(true)`);
    if (r.capa !== 'Resultado') malos.push(`${i}: ${JSON.stringify(r)}`);
  }
  afirmar(!malos.length, malos.join(' | '));
  await sinErrores(pg);
  await pg.close();
});

await prueba('los peligros matan y el nivel vuelve a empezar', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:4' });
  const r = await pg.evaluate(() => {
    const C = window.__C, p = C.partida, m = p.nv.polillas[0];
    C.pasos(5);
    // Lu justo donde está la polilla
    const [mx, my] = p.posPolilla(m);
    Object.assign(p.lu, { x: Math.round(mx), y: Math.round(my), mueve: false, dx: 0, dy: 0, avance: 0 });
    C.pasos(2);
    const murio = p.estado === 'muriendo' && p.fin.causa === 'polilla';
    C.pasos(200);
    return { murio, reinicio: C.partida !== p, estado: C.partida.estado, muertes: C.app.escena.muertes };
  });
  afirmar(r.murio, 'la polilla no la mató');
  afirmar(r.reinicio && r.estado === 'jugando' && r.muertes === 1, 'no volvió a empezar: ' + JSON.stringify(r));
  await sinErrores(pg);
  await pg.close();
});

await prueba('el escudo aguanta un golpe', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:4' });
  const r = await pg.evaluate(() => {
    const C = window.__C, p = C.partida, m = p.nv.polillas[0];
    C.pasos(5);
    p.poder.escudo = 5;
    const [mx, my] = p.posPolilla(m);
    Object.assign(p.lu, { x: Math.round(mx), y: Math.round(my), mueve: false });
    C.pasos(3);
    return { estado: p.estado, escudo: p.poder.escudo, inv: p.invulnerable > 0 };
  });
  afirmar(r.estado === 'jugando' && r.escudo === 0 && r.inv, JSON.stringify(r));
  await pg.close();
});

await prueba('pinchos fijos, pinchos que suben, erizo y fuego matan', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:29' });
  const r = await pg.evaluate(() => {
    const C = window.__C, T = { PINCHOS: 4, PINCHOS_A: 5 };
    const probar = (poner) => {
      const p = C.partida;
      Object.assign(p.lu, { mueve: false, dx: 0, dy: 0, avance: 0 });
      poner(p);
      C.pasos(2);
      const causa = p.fin?.causa;
      C.pasos(90);
      return causa;
    };
    const res = {};
    res.pinchos = probar((p) => { const i = p.nv.tipo.findIndex((t) => t === T.PINCHOS); p.lu.x = i % p.nv.ancho; p.lu.y = (i / p.nv.ancho) | 0; });
    res.movil = probar((p) => { const i = p.nv.pinchosMoviles[0]; p.tp = p.nv.tipo[i] === T.PINCHOS_A ? 1.5 : 0.3; p.lu.x = i % p.nv.ancho; p.lu.y = (i / p.nv.ancho) | 0; });
    res.erizo = probar((p) => { const e = p.nv.erizos[0]; p.lu.x = e.x; p.lu.y = e.y; });
    res.fuego = probar((p) => { const c = p.nv.cabezas[0]; p.bolas.push({ x: c.x + c.dx * 2, y: c.y, dx: c.dx, dy: 0, cx: c.x + c.dx * 2, cy: c.y, avance: 0 }); p.lu.x = c.x + c.dx * 2; p.lu.y = c.y; });
    return res;
  });
  afirmar(r.pinchos === 'pinchos' && r.movil === 'pinchos' && r.erizo === 'erizo' && r.fuego === 'fuego', JSON.stringify(r));
  await sinErrores(pg);
  await pg.close();
});

await prueba('la pared frágil se rompe de un golpe (1-7)', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:6' });
  const r = await pg.evaluate(() => {
    const C = window.__C, p = C.partida;
    const antes = p.nv.tipo.filter((t) => t === 2).length;
    C.deslizar(0, -1); C.pasos(60);
    return { antes, despues: p.nv.tipo.filter((t) => t === 2).length, y: p.lu.y };
  });
  afirmar(r.antes === 3 && r.despues === 2 && r.y === 27, JSON.stringify(r));
  await pg.close();
});

await prueba('portales y flechas llevan a donde dicen (2-3, 2-4)', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:12' });
  let r = await pg.evaluate(() => {
    const C = window.__C, p = C.partida;
    C.deslizar(0, -1); C.pasos(40);          // al tope del primer pozo
    C.deslizar(-1, 0); C.pasos(40);          // a la izquierda
    C.deslizar(0, -1); C.pasos(60);          // sube, entra al portal A, sale por a y sigue
    return { x: p.lu.x, y: p.lu.y };
  });
  afirmar(r.x === 9 && r.y === 15, 'después del portal: ' + JSON.stringify(r));
  await pg.goto(`${BASE}?pausa&limpio&directo=nivel:13`);
  await pg.waitForFunction(() => window.listo);
  r = await pg.evaluate(() => { const C = window.__C, p = C.partida; C.deslizar(0, -1); C.pasos(60); return { x: p.lu.x, y: p.lu.y }; });
  afirmar(r.x === 9 && r.y === 27, 'después de la flecha: ' + JSON.stringify(r));
  await pg.close();
});

await prueba('la torre: sube, la lava alcanza, revivir y de nuevo', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es&directo=torre' });
  const r = await pg.evaluate(() => {
    const C = window.__C, j = C.app.escena;
    // el bot de la demo: seguir los tramos que hizo la torre
    let pasos = 0;
    while (pasos < 1500 && C.partida.estado === 'jugando') {
      const p = C.partida;
      p.invulnerable = 1e9;
      if (!p.lu.mueve && !p.buffer) {
        const seg = [...p.torre.segmentos].reverse().find((s) => s.x === p.lu.x && s.y === p.lu.y);
        if (seg) C.deslizar(seg.dx, seg.dy);
      }
      C.pasos(1); pasos++;
    }
    // que termine de deslizarse (en una parada no hay bicho que la toque)
    while (C.partida.lu.mueve) C.pasos(1);
    const subio = C.partida.altoMax;
    // quieta: la lava la alcanza
    C.partida.invulnerable = 0;
    let espera = 0;
    while (C.partida.estado === 'jugando' && espera < 6000) { C.pasos(1); espera++; }
    for (let i = 0; i < 120; i++) C.pasos(1);
    const fin = j.capa?.constructor.name, causa = C.partida.fin?.causa, record = C.datos.torre.record;
    C.datos.monedas += 100;
    const ok = j.revivir();
    C.pasos(30);
    const revivida = C.partida.estado === 'jugando' && !j.capa;
    return { subio, fin, causa, record, ok, revivida, monedas: C.datos.monedas };
  });
  afirmar(r.subio > 20, 'subió poco: ' + r.subio);
  afirmar(r.fin === 'FinTorre' && r.causa === 'lava', 'sin cartel de fin: ' + JSON.stringify(r));
  afirmar(r.record === r.subio, 'récord: ' + JSON.stringify(r));
  afirmar(r.ok && r.revivida, 'no revivió: ' + JSON.stringify(r));
  await pg.evaluate(() => window.__C.pasos(10, true));
  await captura(pg, 'torre');
  await sinErrores(pg);
  await pg.close();
  return `subió ${r.subio} m`;
});

await prueba('tienda: comprar y ponerse una piel, subir una mejora', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es&directo=tienda' });
  const r = await pg.evaluate(() => {
    const C = window.__C;
    C.datos.monedas = 500;
    C.pasos(60);
    C.boton('piel_ambar'); C.pasos(10);
    const piel = C.datos.piel, monedas1 = C.datos.monedas;
    C.boton('tab_mejoras'); C.pasos(40);
    C.boton('mejora_iman'); C.pasos(10);
    C.boton('piel_lu');
    return { piel, monedas1, iman: C.datos.mejoras.iman, monedas2: C.datos.monedas, pieles: C.datos.pieles };
  });
  afirmar(r.piel === 'ambar' && r.monedas1 === 400 && r.iman === 1 && r.monedas2 === 320, JSON.stringify(r));
  await pg.evaluate(() => { window.__C.boton('tab_pieles'); window.__C.pasos(60, true); });
  await captura(pg, 'tienda');
  await sinErrores(pg);
  await pg.close();
});

await prueba('ajustes: el idioma cambia los textos y se guarda', async () => {
  const pg = await pagina({ q: 'limpio&idioma=es&directo=ajustes' });
  const r = await pg.evaluate(() => {
    const C = window.__C;
    C.pasos(40);
    C.boton('idioma_en'); C.pasos(5);
    const en = C.app.tr('jugar');
    C.boton('idioma_pt'); C.pasos(5);
    const pt = C.app.tr('jugar');
    C.boton('aj_musica'); C.pasos(5);
    return { en, pt, musica: C.datos.ajustes.musica, guardado: JSON.parse(localStorage.getItem('cripta-neon-1')).ajustes };
  });
  afirmar(r.en === 'PLAY' && r.pt === 'JOGAR' && r.musica === false && r.guardado.idioma === 'pt' && r.guardado.musica === false, JSON.stringify(r));
  await captura(pg, 'ajustes');
  await pg.close();
});

await prueba('pausa y seguir', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:2' });
  const r = await pg.evaluate(() => {
    const C = window.__C;
    C.pasos(20); C.boton('pausa'); C.pasos(5);
    const t1 = C.partida.t; C.pasos(60); const quieto = C.partida.t === t1;
    const hay = C.app.escena.capa?.constructor.name;
    C.tecla('atras'); C.pasos(5);
    return { hay, quieto, sigue: !C.app.escena.capa };
  });
  afirmar(r.hay === 'Pausa' && r.quieto && r.sigue, JSON.stringify(r));
  await pg.close();
});

await prueba('el dedo de verdad (toques por CDP) y el teclado mueven a Lu', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:0', toque: true });
  const cdp = await pg.context().newCDPSession(pg);
  const punto = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(206, 700) });
  for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(206, 700 - k * 8) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const r1 = await pg.evaluate(() => { window.__C.pasos(40); const p = window.__C.partida; return { y: p.lu.y, mov: p.movimientos }; });
  afirmar(r1.mov === 1 && r1.y === 15, 'con el dedo: ' + JSON.stringify(r1));
  await pg.keyboard.press('ArrowRight');
  const r2 = await pg.evaluate(() => { window.__C.pasos(40); const p = window.__C.partida; return { x: p.lu.x, mov: p.movimientos }; });
  afirmar(r2.mov === 2 && r2.x === 9, 'con la flecha del teclado: ' + JSON.stringify(r2));
  await sinErrores(pg);
  await pg.close();
});

await prueba('el sonido arranca con el primer toque y ningún efecto ni canción falla', async () => {
  const pg = await pagina({ q: 'limpio' });
  await pg.mouse.click(200, 300);                 // un clic de verdad: el audio solo arranca así
  await pg.waitForTimeout(200);
  const r = await pg.evaluate(async () => {
    const s = window.__C.app.sonido;
    const activo = s.activo();
    for (const n of ['chispa', 'moneda', 'estrella', 'arranque', 'toc', 'tope', 'romper', 'muerte', 'salida', 'portal', 'flecha', 'poder', 'poderFin', 'escudoRoto', 'escupe', 'boton', 'atras', 'comprar', 'error', 'ganada', 'contar', 'record', 'victoria', 'pasos', 'abrir']) s.tocar(n, { n: 2, semitono: 7, fuerte: true });
    for (const m of ['portada', 'mundo0', 'mundo1', 'mundo2', 'torre', 'tienda']) { s.musica(m); await new Promise((f) => setTimeout(f, 250)); }
    s.lava(0.8);
    await new Promise((f) => setTimeout(f, 200));
    return { activo, errores: s.errores };
  });
  afirmar(r.activo, 'el audio no arrancó con el clic');
  afirmar(r.errores.length === 0, 'errores de sonido: ' + r.errores.join(' | '));
  await sinErrores(pg);
  await pg.close();
});

await prueba('entra en cuatro pantallas y la escala es entera', async () => {
  const notas = [];
  for (const [w, h] of [[412, 892], [892, 412], [360, 640], [1280, 720]]) {
    const pg = await pagina({ w, h, q: 'limpio&idioma=es&directo=nivel:9' });
    const r = await pg.evaluate(() => { const P = window.__C.app.pantalla; window.__C.pasos(30, true); return { W: P.W, H: P.H, s: P.s, entra: P.W >= 128 }; });
    afirmar(Number.isInteger(r.s) && r.s >= 2 && r.entra, `${w}×${h}: ${JSON.stringify(r)}`);
    notas.push(`${w}×${h} → ${r.W}×${r.H} ×${r.s}`);
    await captura(pg, `pantalla-${w}x${h}`);
    await sinErrores(pg);
    await pg.close();
  }
  return notas.join(', ');
});

await prueba('lo que tarda un cuadro (SwiftShader: no dice nada del teléfono)', async () => {
  const pg = await pagina({ q: 'limpio&directo=nivel:29' });
  const r = await pg.evaluate(() => {
    const C = window.__C, p = C.partida;
    // viva y con la lava quieta: se mide el juego andando, no una muerte
    p.invulnerable = 1e9; p.lava.espera = 1e9;
    for (let k = 0; k < 200; k++) { C.pasos(1); C.dibujar(); }
    const t0 = performance.now();
    for (let k = 0; k < 300; k++) C.pasos(1);
    const t1 = performance.now();
    for (let k = 0; k < 300; k++) C.dibujar();
    const t2 = performance.now();
    return { paso: (t1 - t0) / 300, dibujo: (t2 - t1) / 300 };
  });
  await pg.close();
  return `paso ${r.paso.toFixed(3)} ms, dibujo ${r.dibujo.toFixed(2)} ms`;
});

await nav.close();
console.log(fallas ? `\n${fallas} de ${total} pruebas fallaron` : `\n${total} pruebas, todas bien`);
process.exit(fallas ? 1 : 0);
