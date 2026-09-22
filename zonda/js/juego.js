/* ============================================================================
   zonda/js/juego.js — el que ata todo: estados, progreso, menús y sondas.
   Estados: portada · tarjeta (el nombre del capítulo) · jugando · dialogo ·
            pausa · fincap · final
   ========================================================================== */

const PROG = 'zonda:progreso', OPCS = 'zonda:opciones';
const Prog = Object.assign({ cap: 0, sala: 0, abierto: 1, empezado: false, cartas: {}, muertes: {}, tiempos: {}, vistos: {}, completo: false }, Guardado.leer(PROG, {}));
const Opc = Object.assign({ musica: 0.7, efectos: 0.9, temblor: true, velocidad: 1, dashInfinito: false, invencible: false, reloj: false }, Guardado.leer(OPCS, {}));
const guardarProg = () => Guardado.escribir(PROG, Prog);
const guardarOpc = () => Guardado.escribir(OPCS, Opc);
const TOTAL_CARTAS = Object.keys(CARTAS).length;
const cartasDe = (cap) => cap.salas.filter((s) => CARTAS[s.id]).length;

const J = {
  estado: 'portada', capIdx: 0, salaIdx: 0, mundo: null, tema: 'quebrada',
  anim: null, t: 0, tCap: 0, muertesCap: 0, cartasCap: 0,
  banner: null, aviso: null, dialogo: null, tarjeta: null, zonda: null,
  relampago: 0, muriendo: false, cambiando: false, repeticion: null, sinDialogos: false, toque: false,
};

function animNueva() { return { dist: 0, sx: 1, sy: 1, parpadeo: 0, flash: 0, bufanda: null, estela: [] }; }
function asist() { return { dashInfinito: Opc.dashInfinito, invencible: Opc.invencible, aguanteInfinito: false }; }

/* ---------------- entrar a un capítulo y a una sala ---------------- */
function empezarCapitulo(ci, si, sinTarjeta) {
  J.capIdx = ci; J.salaIdx = si || 0; J.tCap = 0; J.muertesCap = 0; J.cartasCap = 0;
  /* lo que haya quedado de otra partida: un diálogo a medias se dibujaba
     encima de la sala nueva */
  J.dialogo = null; J.dialogoPendiente = null; J.zonda = null; J.finalEmpezado = false;
  J.muriendo = false; J.cambiando = false; J.aviso = null;
  /* un fundido pendiente de la sala anterior llamaría a "la sala que sigue" a
     mitad de ésta */
  Transicion.activa = false;
  Prog.empezado = true;
  cargarSala();
  const cap = CAPITULOS[ci];
  Sonido.musica(cap.musica);
  UI.ocultar();
  mostrarMandos(true);
  if (sinTarjeta || J.salaIdx > 0) J.estado = 'jugando';
  else { J.estado = 'tarjeta'; J.tarjeta = { t: 0 }; }
}
function cargarSala() {
  const cap = CAPITULOS[J.capIdx], sala = cap.salas[J.salaIdx];
  J.tema = sala.final ? 'amanecer' : cap.tema;
  J.mundo = crearMundo(sala, { asist: asist(), cartasTomadas: Prog.cartas, dashesMax: cap.dashes });
  J.anim = animNueva();
  J.zonda = null;
  FX.limpiar(); Clima.copos.length = 0; Clima.lineas.length = 0;
  J.banner = { id: sala.id, nombre: sala.nombre.toUpperCase(), t: 0 };
  Prog.cap = J.capIdx; Prog.sala = J.salaIdx; guardarProg();
  Sonido.ambiente(J.tema);
  J.dialogoPendiente = sala.dialogo && !Prog.vistos[sala.dialogo] && !J.sinDialogos ? sala.dialogo : null;
}
function siguienteSala() {
  const cap = CAPITULOS[J.capIdx];
  if (J.salaIdx + 1 < cap.salas.length) { J.salaIdx++; cargarSala(); }
  else finCapitulo();
}
function reaparecer() {
  J.mundo = reiniciarSala(J.mundo);
  J.mundo.asist = asist();
  J.anim = animNueva();
  J.muertesCap++;
  Prog.muertes[J.capIdx] = (Prog.muertes[J.capIdx] || 0) + 1;
  guardarProg();
}
function finCapitulo() {
  const cap = CAPITULOS[J.capIdx];
  J.estado = 'fincap';
  Prog.abierto = Math.max(Prog.abierto, Math.min(CAPITULOS.length, J.capIdx + 2));
  const mejor = Prog.tiempos[J.capIdx];
  if (!mejor || J.tCap < mejor) Prog.tiempos[J.capIdx] = J.tCap;
  const siguiente = J.capIdx + 1 < CAPITULOS.length;
  Prog.cap = siguiente ? J.capIdx + 1 : J.capIdx; Prog.sala = 0;
  guardarProg();
  const tomadas = cap.salas.filter((s) => Prog.cartas[s.id + ':0']).length;
  document.getElementById('finTitulo').textContent = 'CAPÍTULO ' + cap.id + ' COMPLETO';
  document.getElementById('finDatos').innerHTML =
    `<p class="txt">${cap.nombre.toUpperCase()}</p>` +
    `<p class="txt">TIEMPO ${reloj(J.tCap)} · MUERTES ${J.muertesCap}</p>` +
    `<p class="txt">CARTAS ${tomadas} DE ${cartasDe(cap)}</p>`;
  mostrarMandos(false);
  UI.mostrar('capaFin');
}

/* ---------------- un paso de juego ---------------- */
function pasarJuego() {
  const m = J.mundo, E = Entrada.EDGE;
  if ((E.pausa || E.volver) && !Transicion.activa) { pausar(); return; }
  const inp = J.repeticion ? (J.repeticion.shift() || { x: 0, y: 0 }) : entradaDe(Entrada);
  pasarJugadora(m, inp);
  J.t += DT; J.tCap += DT;
  procesarEventos(m);
  if (m.congelar) { Bucle.congelar(m.congelar); m.congelar = 0; }
  if (J.banner) J.banner.t += DT;
  if (J.aviso) J.aviso.t += DT;
  if (m.p.muerta && !J.muriendo && m.p.tMuerta > 0.3) {
    J.muriendo = true;
    Transicion.iniciar('circulo', 34, reaparecer, () => { J.muriendo = false; }, { cx: Vista.ox + m.p.x + 4, cy: Vista.oy + m.p.y + 5 });
  }
  if (m.salio && !J.cambiando) {
    J.cambiando = true;
    Sonido.sfx('salida');
    Transicion.iniciar('trama', 22, siguienteSala, () => { J.cambiando = false; });
  }
  if (m.cumbre && !J.finalEmpezado) { J.finalEmpezado = true; iniciarDialogo('final', empezarFinal); }
  /* truenos en la cumbre */
  if (J.tema === 'cumbre') { if (J.relampago > 0) J.relampago--; else if (Math.random() < 0.002) { J.relampago = 26; Sonido.sfx('derrumbe'); } }
  if (m.avisoViento && !J.avisado) { J.avisado = true; Sonido.sfx('rafaga'); } else if (!m.avisoViento) J.avisado = false;
}

function procesarEventos(m) {
  const T = TEMAS[J.tema], A = J.anim, p = m.p;
  for (const e of m.eventos) {
    Sonido.sfx(e.t, e);
    switch (e.t) {
      case 'salto': case 'super': case 'hiper':
        A.sx = 0.72; A.sy = 1.28;
        FX.emitir(p.x + 4, p.y + 11, 5, { cols: T.polvo, vy: -10, disp: 30, vida: 16, arrastre: 0.9 });
        break;
      case 'saltoPared': case 'rebote':
        A.sx = 0.75; A.sy = 1.25;
        FX.emitir(p.x + (e.d > 0 ? 0 : 8), p.y + 8, 5, { cols: T.polvo, vx: e.d * 20, disp: 25, vida: 14 });
        break;
      case 'aterriza':
        if ((e.fuerza || 0) > 90) { A.sx = 1.3; A.sy = 0.74; }
        FX.emitir(p.x + 4, p.y + 11, 3 + Math.round((e.fuerza || 0) / 40), { cols: T.polvo, vy: -8, disp: 35, vida: 14, arrastre: 0.88 });
        break;
      case 'dash':
        FX.temblar(1.5);
        FX.emitir(p.x + 4, p.y + 6, 8, { cols: BUFANDA[p.dashes >= 1 ? 1 : 0], vx: -e.dx * 60, vy: -e.dy * 60, disp: 40, vida: 18 });
        break;
      case 'recarga': A.flash = 5; break;
      case 'muerte':
        FX.temblar(5);
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2;
          FX.emitir(p.x + 4, p.y + 6, 1, { col: i % 2 ? BUFANDA[1][0] : '#ffffff', vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, disp: 4, vida: 26, tam: 3, arrastre: 0.9 });
        }
        break;
      case 'aparece': FX.emitir(p.x + 4, p.y + 6, 8, { cols: ['#ffffff', '#fff0c8'], disp: 50, vida: 14 }); break;
      case 'resorte': FX.emitir(e.x, e.y, 6, { cols: ['#ffb0a0', '#ffffff'], vy: -40, disp: 30, vida: 14 }); break;
      case 'cristal': FX.emitir(e.x, e.y, 14, { cols: ['#7ee8d2', '#e8fff9', '#3fb6a8'], disp: 80, vida: 22 }); A.flash = 6; break;
      case 'cristalVuelve': FX.emitir(e.x, e.y, 4, { cols: ['#7ee8d2'], disp: 20, vida: 12 }); break;
      case 'cartaSigue': FX.emitir(e.x, e.y, 6, { cols: ['#fff6dc', '#ffd24a'], disp: 40, vida: 18 }); break;
      case 'carta': {
        FX.emitir(e.x, e.y, 18, { cols: ['#fff6dc', '#ffd24a', '#ffffff'], disp: 90, vida: 28 });
        J.cartasCap++;
        const n = Object.keys(Prog.cartas).length;
        J.aviso = { txt: 'CARTA ' + n + '/' + TOTAL_CARTAS, t: 0 };
        guardarProg();
        break;
      }
      case 'cruje': FX.emitir(e.x, e.y, 3, { cols: T.polvo, vy: 10, disp: 12, vida: 12 }); break;
      case 'derrumbe': FX.emitir(e.x, e.y, 10, { cols: ['#9a6a44', '#6a4424', '#c08a58'], g: 300, disp: 40, rx: (e.bw || 8) / 2, vida: 30 }); break;
      case 'romper': FX.temblar(3); FX.emitir(e.x, e.y, 16, { cols: ['#8e6238', '#6e4a2a', '#3e2814'], g: 400, disp: 110, rx: (e.bw || 8) / 2, ry: (e.bh || 8) / 2, vida: 34, tam: 2 }); break;
      case 'vagoneta': FX.emitir(e.x, e.y, 8, { cols: ['#ffd070', '#ffffff'], disp: 60, vida: 12 }); break;
      case 'vagonetaFrena': FX.temblar(2.5); FX.emitir(e.x, e.y, 10, { cols: ['#ffd070', '#ff9050'], disp: 80, vida: 16 }); break;
      case 'crujeHielo': FX.emitir(e.x, e.y, 3, { cols: ['#ffffff', '#9fd8f4'], vy: 10, disp: 10, vida: 10 }); break;
      case 'rompeHielo': FX.emitir(e.x, e.y, 10, { cols: ['#ffffff', '#9fd8f4', '#4a90c8'], g: 300, disp: 70, vida: 22 }); break;
      case 'apacheta': FX.emitir(e.x, e.y, 10, { cols: ['#ffe0a0', '#ffffff'], vy: -30, disp: 30, vida: 30 }); break;
    }
  }
  m.eventos.length = 0;
  /* el diálogo de la sala arranca cuando Ayelén termina de aparecer */
  if (J.dialogoPendiente && p.estado === 'normal') { const d = J.dialogoPendiente; J.dialogoPendiente = null; iniciarDialogo(d); }
}

/* ---------------- diálogos ---------------- */
function iniciarDialogo(clave, alTerminar) {
  const lineas = DIALOGOS[clave];
  if (!lineas) { if (alTerminar) alTerminar(); return; }
  J.dialogo = { lineas, i: 0, n: 0, alTerminar };
  J.estado = 'dialogo';
  Prog.vistos[clave] = true; guardarProg();
  const p = J.mundo.p;
  if (lineas.some((l) => l.q === 'zonda')) J.zonda = { x: lim(p.x + 34 * (p.x > 100 ? -1 : 1), 12, 188), y: p.y - 8, a: 0 };
}
function pasarDialogo() {
  const d = J.dialogo, E = Entrada.EDGE, l = d.lineas[d.i];
  if (J.zonda) J.zonda.a = Math.min(1, J.zonda.a + 0.05);
  if (d.n < l.t.length) {
    const antes = Math.floor(d.n);
    d.n = Math.min(l.t.length, d.n + 0.75);
    if (Math.floor(d.n) !== antes && antes % 2 === 0 && l.t[antes] !== ' ') Sonido.sfx('texto', { f: l.q === 'zonda' ? 260 : l.q === 'rosa' ? 520 : 720 });
  }
  if (E.salto || E.aceptar || E.dash || J.toque) {
    J.toque = false;
    if (d.n < l.t.length) d.n = l.t.length;
    else {
      d.i++; d.n = 0;
      if (d.i >= d.lineas.length) {
        J.dialogo = null; J.estado = 'jugando';
        if (J.zonda) J.zonda.sale = true;
        if (d.alTerminar) d.alTerminar();
      }
    }
  }
  J.toque = false;
  pasarAnim(J.anim, J.mundo); FX.pasar(); pasarClima(J.tema, Pantalla.W, Pantalla.H, 0);
}

/* ---------------- el final ---------------- */
function empezarFinal() {
  J.estado = 'final';
  Prog.completo = true; guardarProg();
  Final.t = 0; Final.cartas.length = 0; Final.creditos = true;
  Sonido.musica('final'); Sonido.ambiente('amanecer');
  mostrarMandos(false);
  Transicion.iniciar('trama', 50, null, null, { col: '#fff0e0' });
}

/* ---------------- menús ---------------- */
function pausar() {
  J.estado = 'pausa';
  mostrarMandos(false);
  document.getElementById('txtPausa').textContent =
    `${CAPITULOS[J.capIdx].nombre.toUpperCase()} · SALA ${J.salaIdx + 1}/${CAPITULOS[J.capIdx].salas.length} · MUERTES ${J.muertesCap} · ${reloj(J.tCap)}`;
  UI.mostrar('capaPausa');
}
function seguir() { UI.ocultar(); J.estado = J.dialogo ? 'dialogo' : 'jugando'; mostrarMandos(true); }
function irPortada() {
  J.estado = 'portada'; J.finalEmpezado = false;
  mostrarMandos(false);
  Sonido.musica('menu'); Sonido.ambiente('quebrada');
  armarPortada();
  UI.mostrar('capaTitulo');
}
function armarPortada() {
  const b = document.getElementById('bJugar');
  b.textContent = Prog.empezado ? 'SEGUIR' : 'JUGAR';
  delete b.dataset.pxk;
}
function armarCapitulos() {
  const lista = document.getElementById('listaCap');
  lista.innerHTML = '';
  CAPITULOS.forEach((cap, i) => {
    const abierto = i < Prog.abierto;
    const b = document.createElement('button');
    b.className = 'boton' + (abierto ? '' : ' gris');
    b.id = 'bCap' + i;
    b.textContent = abierto ? `${cap.id} · ${cap.nombre.toUpperCase()}` : `${cap.id} · ???`;
    if (!abierto) b.dataset.no = '1';
    b.addEventListener('click', () => { if (abierto) { UI.sonar('elegir'); empezarCapitulo(i, 0); } });
    lista.appendChild(b);
    const p = document.createElement('p');
    p.className = 'txt';
    const tomadas = cap.salas.filter((s) => Prog.cartas[s.id + ':0']).length;
    p.textContent = abierto ? `CARTAS ${tomadas}/${cartasDe(cap)} · MUERTES ${Prog.muertes[i] || 0}${Prog.tiempos[i] ? ' · MEJOR ' + reloj(Prog.tiempos[i]) : ''}` : 'TODAVÍA NO';
    lista.appendChild(p);
  });
}
function armarCartas() {
  const lista = document.getElementById('listaCartas');
  lista.innerHTML = '';
  const n = Object.keys(Prog.cartas).length;
  const cab = document.createElement('p'); cab.className = 'txt'; cab.textContent = `ENCONTRASTE ${n} DE ${TOTAL_CARTAS}`;
  lista.appendChild(cab);
  for (const cap of CAPITULOS) for (const s of cap.salas) {
    const c = CARTAS[s.id];
    if (!c) continue;
    const panel = document.createElement('div');
    panel.className = 'panel';
    const tiene = Prog.cartas[s.id + ':0'];
    panel.innerHTML = tiene
      ? `<p class="txt izq"><b>DE ${c.de.toUpperCase()} PARA ${c.a.toUpperCase()}</b></p><p class="txt izq">${c.t}</p>`
      : `<p class="txt izq">${s.id} · ${s.nombre.toUpperCase()}</p><p class="txt izq">???</p>`;
    lista.appendChild(panel);
  }
}
function armarOpciones() {
  const cont = document.getElementById('listaOpc');
  if (cont.dataset.listo) return;
  cont.dataset.listo = '1';
  const velocidades = [1, 0.9, 0.8, 0.7, 0.6];
  const ops = [
    ['MÚSICA', () => 'MÚSICA ' + barrita(Opc.musica), () => { Opc.musica = lim(Math.round((Opc.musica - 0.1) * 10) / 10, 0, 1); }, () => { Opc.musica = lim(Math.round((Opc.musica + 0.1) * 10) / 10, 0, 1); }, () => { Opc.musica = Opc.musica >= 1 ? 0 : lim(Math.round((Opc.musica + 0.1) * 10) / 10, 0, 1); }],
    ['EFECTOS', () => 'EFECTOS ' + barrita(Opc.efectos), () => { Opc.efectos = lim(Math.round((Opc.efectos - 0.1) * 10) / 10, 0, 1); }, () => { Opc.efectos = lim(Math.round((Opc.efectos + 0.1) * 10) / 10, 0, 1); }, () => { Opc.efectos = Opc.efectos >= 1 ? 0 : lim(Math.round((Opc.efectos + 0.1) * 10) / 10, 0, 1); }],
    ['TEMBLOR', () => 'TEMBLOR: ' + (Opc.temblor ? 'SÍ' : 'NO'), () => { Opc.temblor = !Opc.temblor; }, () => { Opc.temblor = !Opc.temblor; }],
    ['VELOCIDAD', () => 'VELOCIDAD: ' + Math.round(Opc.velocidad * 100) + '%', () => { const i = velocidades.indexOf(Opc.velocidad); Opc.velocidad = velocidades[Math.max(0, i - 1)]; }, () => { const i = velocidades.indexOf(Opc.velocidad); Opc.velocidad = velocidades[(i + 1) % velocidades.length]; }],
    ['DASH', () => 'DASH INFINITO: ' + (Opc.dashInfinito ? 'SÍ' : 'NO'), () => { Opc.dashInfinito = !Opc.dashInfinito; }, () => { Opc.dashInfinito = !Opc.dashInfinito; }],
    ['INVENCIBLE', () => 'INVENCIBLE: ' + (Opc.invencible ? 'SÍ' : 'NO'), () => { Opc.invencible = !Opc.invencible; }, () => { Opc.invencible = !Opc.invencible; }],
    ['RELOJ', () => 'RELOJ: ' + (Opc.reloj ? 'SÍ' : 'NO'), () => { Opc.reloj = !Opc.reloj; }, () => { Opc.reloj = !Opc.reloj; }],
  ];
  for (const [id, texto, izq, der, tocar] of ops) {
    const b = document.createElement('button');
    b.className = 'boton gris'; b.id = 'bOpc' + id;
    cont.appendChild(b);
    const aplicarY = (f) => () => { f(); aplicarOpciones(); };
    UI.opcion(b, { texto, izq: aplicarY(izq), der: aplicarY(der), tocar: aplicarY(tocar || der) });
  }
}
function aplicarOpciones() {
  Sonido.volumenes(Opc.musica, Opc.efectos);
  FX.temblorActivo = Opc.temblor;
  Bucle.velocidad = Opc.velocidad;
  if (J.mundo) J.mundo.asist = asist();
  guardarOpc();
}

function mostrarMandos(ver) {
  document.getElementById('mandos').classList.toggle('ver', ver && document.body.classList.contains('tactil'));
  document.getElementById('btPausa').classList.toggle('ver', ver);
}

/* ---------------- el bucle ---------------- */
function pasar() {
  Transicion.pasar();
  Vista.t += DT;
  switch (J.estado) {
    case 'portada': case 'pausa': case 'fincap':
      UI.navegar();
      if (J.estado === 'portada') { pasarClima('quebrada', Pantalla.W, Pantalla.H, 0); FX.pasar(); }
      break;
    case 'tarjeta':
      J.tarjeta.t += DT;
      pasarJugadora(J.mundo, { x: 0, y: 0 }); J.mundo.eventos.length = 0;
      pasarAnim(J.anim, J.mundo); pasarClima(J.tema, Pantalla.W, Pantalla.H, 0);
      if (J.tarjeta.t > 3.1 || (J.tarjeta.t > 0.6 && (Entrada.EDGE.salto || Entrada.EDGE.aceptar || J.toque))) { J.estado = 'jugando'; J.tarjeta = null; }
      J.toque = false;
      break;
    case 'jugando':
      pasarJuego();
      if (J.estado === 'jugando' || J.estado === 'dialogo') { pasarAnim(J.anim, J.mundo); FX.pasar(); pasarClima(J.tema, Pantalla.W, Pantalla.H, J.mundo.vientoX || 0); }
      if (J.zonda && J.zonda.sale) { J.zonda.a -= 0.03; J.zonda.x += 1.5; if (J.zonda.a <= 0) J.zonda = null; }
      break;
    case 'dialogo':
      pasarDialogo();
      break;
    case 'final':
      Final.t += DT;
      pasarClima('amanecer', Pantalla.W, Pantalla.H, 20);
      if (Final.t > 4 && (Entrada.EDGE.salto || Entrada.EDGE.aceptar || J.toque) && Final.t > 12) irPortada();
      J.toque = false;
      break;
  }
}
function dibujar() {
  const g = Pantalla.g;
  g.fillStyle = '#07060c'; g.fillRect(0, 0, Pantalla.W, Pantalla.H);
  if (J.estado === 'portada' || (!J.mundo && J.estado !== 'final')) { dibujarPortada(g, Vista.t); FX.dibujar(g, 0, 0, false); }
  else if (J.estado === 'final') dibujarFinal(g, J);
  else {
    dibujarSalaCompleta(g, J, Vista.t);
    dibujarCartel(g, J); dibujarAviso(g, J); dibujarReloj(g, J);
    if (J.estado === 'tarjeta') dibujarTarjeta(g, J);
    dibujarDialogo(g, J);
    if (J.estado === 'pausa' || J.estado === 'fincap') Trama.cubrir(g, 8, '#07060c');
  }
  Transicion.dibujar(g);
}

/* ---------------- arranque ---------------- */
function arrancar() {
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('tactil');
  Pantalla.iniciar(document.getElementById('lienzo'), 200);
  prepararArte();
  Bucle.fijo = /[?&]fijo/.test(location.search);
  Entrada.iniciarTeclado({
    ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arr', KeyW: 'arr', ArrowDown: 'aba', KeyS: 'aba',
    KeyC: 'salto', Space: 'salto', KeyK: 'salto', KeyX: 'dash', KeyJ: 'dash', KeyZ: 'agarre', KeyL: 'agarre', ShiftLeft: 'agarre', ShiftRight: 'agarre',
    Enter: 'aceptar', Escape: 'pausa', KeyP: 'pausa', Backspace: 'volver',
  });
  Entrada.alUsar = (f) => { if (f === 'toque') { document.body.classList.add('tactil'); if (J.estado === 'jugando') mostrarMandos(true); } UI.marcar(); };
  Entrada.palanca(document.getElementById('zonaPalanca'), document.querySelector('#zonaPalanca .base'), document.querySelector('#zonaPalanca .perilla'));
  Entrada.boton(document.getElementById('btSalto'), 'salto');
  Entrada.boton(document.getElementById('btDash'), 'dash');
  Entrada.boton(document.getElementById('btAgarre'), 'agarre');
  document.getElementById('btPausa').addEventListener('click', () => { if (J.estado === 'jugando' || J.estado === 'dialogo') pausar(); });
  document.getElementById('btSalto').appendChild(iconoPx('flecha', '#fff4c2', 4));
  document.getElementById('btDash').appendChild(iconoPx('viento', '#ffd0b0', 4));
  document.getElementById('btAgarre').appendChild(iconoPx('mano', '#d0f0ff', 3));
  document.getElementById('btPausa').appendChild(iconoPx('pausa', '#ffffff', 3));
  /* tocar la pantalla adelanta los diálogos */
  document.getElementById('lienzo').addEventListener('pointerdown', () => { J.toque = true; });
  const despertar = () => { Sonido.arrancar(); aplicarOpciones(); };
  addEventListener('pointerdown', despertar, { once: true });
  addEventListener('keydown', despertar, { once: true });
  UI.alSonar = (q) => Sonido.sfx(q);
  UI.alPixelar = (capa) => {
    capa.querySelectorAll('.boton').forEach((b) => pixelar(b, 3, { grad: b.classList.contains('gris') ? GRAD.gris : GRAD.blanco }));
    capa.querySelectorAll('h2').forEach((h) => pixelar(h, 3, { grad: GRAD[h.dataset.grad || 'ocre'] }));
  };
  UI.conectar({
    bJugar: () => { const ci = lim(Prog.cap, 0, CAPITULOS.length - 1); empezarCapitulo(ci, Prog.empezado ? Prog.sala : 0, Prog.empezado && Prog.sala > 0); },
    bCapitulos: () => { armarCapitulos(); UI.mostrar('capaCapitulos', { apilar: true }); },
    bCartas: () => { armarCartas(); UI.mostrar('capaCartas', { apilar: true }); },
    bOpciones: () => { armarOpciones(); UI.mostrar('capaOpciones', { apilar: true }); },
    bCreditos: () => { UI.mostrar('capaCreditos', { apilar: true }); },
    bCapVolver: () => { UI.volver(); }, bCarVolver: () => { UI.volver(); }, bCredVolver: () => { UI.volver(); },
    bOpcVolver: () => { if (!UI.volver()) irPortada(); },
    bSeguir: seguir,
    bReintentar: () => { seguir(); if (!J.mundo.p.muerta) { J.mundo.p.muerta = true; J.mundo.p.estado = 'muerta'; J.mundo.p.tMuerta = 0.3; } },
    bPausaOpc: () => { armarOpciones(); UI.mostrar('capaOpciones', { apilar: true }); },
    bSalir: () => { irPortada(); },
    bFinSeguir: () => {
      if (J.capIdx + 1 < CAPITULOS.length) empezarCapitulo(J.capIdx + 1, 0);
      else irPortada();
    },
  });
  document.getElementById('creditosTxt').innerHTML = CREDITOS.slice(1).map((c) => `<p class="txt">${c}</p>`).join('');
  aplicarOpciones();
  irPortada();
  Bucle.iniciar(pasar, dibujar, () => Entrada.leerMando());
  /* sondas para las pruebas: nada de esto lo usa el juego */
  window.__Z = {
    J, Prog, Opc, SALAS, CAPITULOS,
    listo: true,
    empezar(ci, si, o) { o = o || {}; J.sinDialogos = !!o.sinDialogos; empezarCapitulo(ci, si || 0, true); },
    anda(n) { Bucle.adelantar(n); },
    entrada(a, v) { if (v) Entrada.pulsar(a, 'prueba'); else Entrada.soltar(a, 'prueba'); },
    repetir(cuadros) { J.repeticion = cuadros.slice(); },
    sala() { const m = J.mundo; return m && { id: m.sala.id, salio: m.salio, muerta: m.p.muerta, estado: m.p.estado, x: m.p.x, y: m.p.y, dashes: m.p.dashes, cumbre: !!m.cumbre }; },
    estado() { return J.estado; },
    medidas() { return { msDibujo: Bucle.msDibujo, W: Pantalla.W, H: Pantalla.H, PX: Pantalla.PX, particulas: FX.part.length }; },
  };
}
arrancar();
