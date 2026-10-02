// Las tomas de LA ISLA. Un "director" maneja al náufrago por los dedos de la pantalla (la palanca,
// usar, poner, saltar: entrada.joy / tUsar / botonesRecien, y la perilla se mueve de verdad), la
// mirada (yaw y pitch del jugador, suavizados como un pulgar) y lo que el guion del video pide que
// pase: la hora del cielo, la carta de la botella, una fogata, cangrejos, esqueletos que salen de
// la arena y el gólem en la sala más honda de la mina (J.enemigos.crear, J.ponerBajo).
// Calidad media: el juego dibuja a 432×768 sin agrandar el píxel (la captura lo pasa a ×2,5).
export default {
  archivo: 'isla/isla.html',
  listo: () => !!(window.__isla && window.__isla.listo),
  comun: () => {
    const J = window.__isla.J;
    J.ajustes.calidad = 1; J.aplicarAjustes(false);
    // con ?directo el juego arranca con el vuelo de la cámara hasta los ojos (~1,5 s): lo que el
    // director hace durante el vuelo se pierde (la mochila no abre, la vista no cambia)
    if (location.search.includes('directo')) for (let i = 0; i < 240 && (J.estado !== 'jugando' || J.menu.vuelo); i++) window.__reloj.cuadro(1000 / 30);
    return true;
  },
  bot: () => {
    const I = window.__isla, J = I.J, THREE = I.THREE, E = J.entrada;
    const perilla = document.getElementById('joyP');
    const dA = (a, b) => { let d = (b - a + Math.PI) % (2 * Math.PI); if (d < 0) d += 2 * Math.PI; return d - Math.PI; };
    const boton = (id, on) => { const b = document.getElementById(id); if (b) b.classList.toggle('on', on); };
    const v = new THREE.Vector3();
    window.__d = {
      J, THREE,
      joy(x, y) {
        if (x === null) { E.joy.id = null; E.joy.x = E.joy.y = 0; perilla.style.transform = ''; return; }
        E.joy.id = 77; E.joy.x = x; E.joy.y = y; perilla.style.transform = `translate(${x * 46}px, ${y * 46}px)`;
      },
      usar(on) { if (on && !E.tUsar) E.tUsarRecien = true; E.tUsar = on; boton('tUsar', on); },
      poner() { E.botonesRecien.der = true; boton('tPoner', true); setTimeout(() => boton('tPoner', false), 160); },
      salto(on) { if (on && !E.tSalto) E.tSaltoRecien = true; E.tSalto = on; boton('tSalto', on); },
      /* girar la mirada hacia un punto, de a poco (k por cuadro) */
      mirar(x, y, z, k = 0.12) {
        const o = J.jugador.ojos(v.set(0, 0, 0));
        const yaw = Math.atan2(-(x - o.x), -(z - o.z)), pitch = Math.atan2(y - o.y, Math.hypot(x - o.x, z - o.z));
        J.jugador.yaw += dA(J.jugador.yaw, yaw) * k;
        J.jugador.pitch += (pitch - J.jugador.pitch) * k;
      },
      /* pararse en (x, z) mirando a (mx, mz) */
      ir(x, z, mx, mz) {
        const yaw = mx === undefined ? J.jugador.yaw : Math.atan2(-(mx - x), -(mz - z));
        J.jugador.ponerEn(v.set(x, J.jugador.p.y + 3, z), yaw);
      },
      dar(lista) { for (const [id, n] of lista) J.inv.agregar(id, n); },
      tener(id) { const i = J.inv.ranuras.findIndex((r) => r && r.id === id); if (i >= 0 && i < 9) J.acciones.seleccionar(i); return i; },
      /* un punto a d metros de (x, z), del lado de (hacia x2, z2) */
      cerca(x, z, x2, z2, d) { const a = Math.atan2(z2 - z, x2 - x); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; },
      altura(x, z) { return J.mundo.terreno.altura(x, z); },
      vista3() { if (!J.terceraPersona) J.alternarVista(); },
      vista1() { if (J.terceraPersona) J.alternarVista(); },
      info() { const p = J.jugador.p; return { p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], estado: J.estado, vida: J.jugador.vida, bajo: !!J.bajo, enemigos: J.enemigos.lista.map((e) => e.tipo + ':' + e.estado), pesca: J.pesca.estado }; },
    };
    return true;
  },
  tomas: {
    /* el menú y el vuelo de la cámara a los ojos del náufrago al tocar JUGAR */
    menu: { q: '?idioma=es&sinintro', n: 240,
      cuadro: (k) => { if (k === 100) { const b = [...document.querySelectorAll('#opciones button')].find((x) => /jugar/i.test(x.textContent)); b && b.click(); } return null; } },
    /* la playa del naufragio: el barco roto y la carta de la botella */
    naufragio: { q: '?idioma=es&directo', n: 225,
      preparar: () => { const d = window.__d, H = d.J.historia, P = H.posNaufragio || H.naufragio; const b = H.barco && H.barco.position ? H.barco.position : P; window.__barco = [b.x, b.z]; const [x, z] = d.cerca(b.x, b.z, d.J.jugador.p.x, d.J.jugador.p.z, 14); d.ir(x, z, b.x, b.z); d.J.jugador.pitch = 0.02; return true; },
      cuadro: (k) => { const d = window.__d, [bx, bz] = window.__barco; if (k > 20 && k < 62) { d.joy(0, -0.5); } else d.joy(null); d.mirar(bx, 1.2, bz, 0.06); if (k === 95) d.J.historia.leerCarta(); return d.info(); } },
    /* talar una palmera con el hacha (en tercera persona: se ve el hachazo) */
    talar: { q: '?idioma=es&directo', n: 210,
      preparar: () => { const d = window.__d, W = d.J.mundo, p = d.J.jugador.p; const T = W.terreno, enArena = W.veg.palmeras.filter((q) => q.viva && T.pasto(q.x, q.z) < 0.25 && T.altura(q.x, q.z) > 0.3); const pal = (enArena.length ? enArena : W.veg.palmeras.filter((q) => q.viva)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; window.__obj = [pal.x, pal.z]; d.dar([['hachaPiedra', 1]]); d.tener('hachaPiedra'); const [x, z] = d.cerca(pal.x, pal.z, p.x, p.z, 1.7); d.ir(x, z, pal.x, pal.z); d.vista1(); return true; },
      cuadro: (k) => { const d = window.__d, [x, z] = window.__obj; d.mirar(x, d.altura(x, z) + (k < 120 ? 1.1 : 2.4), z, k < 120 ? 0.3 : 0.05); d.usar(k > 15 && k < 180); return d.info(); } },
    /* picar una roca con el pico */
    picar: { q: '?idioma=es&directo', n: 195,
      preparar: () => { const d = window.__d, W = d.J.mundo, p = d.J.jugador.p; const r = W.rocas.minables.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; window.__obj = [r.x, r.z]; d.dar([['picoPiedra', 1]]); d.tener('picoPiedra'); const [x, z] = d.cerca(r.x, r.z, p.x, p.z, 2.5); d.ir(x, z, r.x, r.z); d.vista1(); return true; },
      cuadro: (k) => { const d = window.__d, [x, z] = window.__obj; d.mirar(x, d.altura(x, z) + 0.2, z, 0.3); if (k > 12 && k < 40) d.joy(0, -0.35); else d.joy(null); d.usar(k > 12 && k < 175); return d.info(); } },
    /* pescar desde la punta del muelle */
    pescar: { q: '?idioma=es&directo', n: 255,
      preparar: () => { const d = window.__d, W = d.J.mundo, C = W.choza.grupo.position, pu = W.muelle.punta;
        // a la mitad del muelle y mirando al mar de costado (en la punta está el cartel de los créditos del menú)
        const dx = pu.x - C.x, dz = pu.z - C.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, x = C.x + dx * 0.62, z = C.z + dz * 0.62;
        window.__mar = [x - uz * 14, z + ux * 14]; d.dar([['cana', 1]]); d.tener('cana'); d.ir(x, z, window.__mar[0], window.__mar[1]); d.J.jugador.pitch = -0.2; d.J.cielo.hora = 0.74; return true; },
      cuadro: (k) => { const d = window.__d, P = d.J.pesca, [mx, mz] = window.__mar; d.mirar(mx, -1.5, mz, 0.2);
        // la caña tira en el impacto del golpe: el botón se mantiene medio segundo
        if (!window.__recogio) d.usar(k >= 20 && k < 36);
        if (P.estado === 'esperando' && P.espera > 1.4) P.espera = 1.4;
        // lo que sale es al azar sobre una tabla (el atún primero): para el video, que pique un atún
        if (P.estado === 'pica' && !window.__recogio) { window.__recogio = k; window.__azar = Math.random; Math.random = () => 0.02; }
        if (window.__recogio) d.usar(k - window.__recogio < 15);
        if (window.__azar && k - window.__recogio > 25) { Math.random = window.__azar; window.__azar = null; }
        return d.info(); } },
    /* cocinar el pescado en una fogata, al atardecer */
    cocinar: { q: '?idioma=es&directo', n: 165,
      preparar: () => { const d = window.__d, p = d.J.jugador.p, yaw = d.J.jugador.yaw; const fx = Math.floor(p.x - Math.sin(yaw) * 2.2), fz = Math.floor(p.z - Math.cos(yaw) * 2.2); const fy = Math.floor(d.altura(fx + 0.5, fz + 0.5) + 0.05); d.J.bloques.poner('fogata', fx, fy, fz); window.__obj = [fx + 0.5, fy + 0.3, fz + 0.5]; d.dar([['atun', 3]]); d.tener('atun'); d.J.cielo.hora = 0.79; d.vista1(); return true; },
      cuadro: (k) => { const d = window.__d, [x, y, z] = window.__obj; d.mirar(x, y, z, 0.15); if (k === 60 || k === 105) d.poner(); return d.info(); } },
    /* armar el hacha y el pico en la mochila */
    fabricar: { q: '?idioma=es&directo', n: 165,
      preparar: () => { const d = window.__d; d.dar([['rama', 8], ['piedra', 6], ['madera', 6], ['fibra', 4]]); return true; },
      cuadro: (k) => { const d = window.__d; if (k === 20) d.J.entrada.recien.add('Tab');
        const hacer = (n) => { const r = [...document.querySelectorAll('.receta')].filter((x) => !x.querySelector('button')?.disabled)[n]; r && r.querySelector('button').click(); };
        if (k === 70) hacer(0); if (k === 110) hacer(0); return d.info(); } },
    /* de día, los cangrejos en la playa (se hacen los tontos) */
    cangrejos: { q: '?idioma=es&directo', n: 195,
      preparar: () => { const d = window.__d, p = d.J.jugador.p, yaw = d.J.jugador.yaw, E = d.J.enemigos; d.J.cielo.hora = 0.42;
        // tres cangrejos cerca, adelante, en la arena; se mira un poco para abajo
        for (const [a, r] of [[-0.42, 3.2], [0.08, 4.4], [0.5, 2.8]]) { const x = p.x - Math.sin(yaw + a) * r, z = p.z - Math.cos(yaw + a) * r; E.crear('cangrejo', x, d.altura(x, z), z); }
        d.J.jugador.pitch = -0.32; d.vista3(); return true; },
      cuadro: (k) => { const d = window.__d, J = d.J, p = J.jugador.p; const c = J.enemigos.lista.filter((e) => e.tipo === 'cangrejo').sort((a, b) => a.p.distanceTo(p) - b.p.distanceTo(p))[0]; if (c) d.mirar(c.p.x, c.p.y + 0.2, c.p.z, 0.04); if (k > 60 && k < 120) d.joy(0, -0.3); else d.joy(null); return d.info(); } },
    /* de noche, salen los esqueletos piratas de la arena */
    noche: { q: '?idioma=es&directo', n: 255,
      preparar: () => { const d = window.__d, J = d.J; J.cielo.hora = 0.93; d.dar([['espadaPiedra', 1]]); d.tener('espadaPiedra'); d.vista3(); window.__salen = [[45, -0.35, 7], [75, 0.3, 8], [105, 0.0, 9.5]]; return true; },
      cuadro: (k) => { const d = window.__d, J = d.J, p = J.jugador.p, yaw = J.jugador.yaw;
        for (const [kk, a, r] of window.__salen) if (k === kk) { const x = p.x - Math.sin(yaw + a) * r, z = p.z - Math.cos(yaw + a) * r, h = d.altura(x, z); const e = J.enemigos.crear('esqueleto', x, h, z); e.saliendo = 1; J.part.rafaga(new d.THREE.Vector3(x, h + 0.2, z), 12, [0xe8d3a0, 0xf1ead8, 0xc9b07a], { vel: 1.5, arriba: 3, tam: 0.06 }); }
        const e = J.enemigos.lista.filter((q) => q.tipo === 'esqueleto').sort((a, b) => a.p.distanceTo(p) - b.p.distanceTo(p))[0];
        if (e) d.mirar(e.p.x, e.p.y + 1.1, e.p.z, 0.1);
        d.usar(!!e && e.p.distanceTo(p) < 2.4 && k % 14 < 7);
        J.jugador.vida = Math.max(J.jugador.vida, 60);
        return d.info(); } },
    /* en lo más hondo de la mina: el gólem de piedra con el cristal del faro */
    golem: { q: '?idioma=es&directo', n: 255,
      preparar: () => { const d = window.__d, J = d.J, S = J.mina.salaJefe, Y = J.mina.salida.y; J.ponerBajo(true); d.dar([['farol', 1], ['espadaPiedra', 1]]); d.tener('espadaPiedra'); J.jugador.ponerEn(new d.THREE.Vector3(S.x, Y, S.z + 9), 0); if (!J.enemigos.jefe) J.enemigos.crear('golem', S.x, Y, S.z); window.__sala = [S.x, Y, S.z]; d.vista3(); return true; },
      cuadro: (k) => { const d = window.__d, J = d.J, g = J.enemigos.jefe; if (g) d.mirar(g.p.x, g.p.y + 2.2, g.p.z, 0.08); d.joy(null); if (k > 40 && k < 70) d.joy(0, -0.4); J.jugador.vida = Math.max(J.jugador.vida, 60); return d.info(); } },
  },
};
