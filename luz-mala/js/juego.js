/* ============================================================================
   luz-mala/js/juego.js — el que ata todo.
   Estados: idioma · portada · creditos · intro · jugando · dialogo ·
            hallazgo · mapa · pausa · tienda · final · cargando
   Antes del menú, siempre, se elige idioma (con el último elegido marcado).
   La partida se guarda sola: al sentarse en un hongo, al vencer a un jefe,
   al comprar, al juntar algo que no vuelve.
   ========================================================================== */

const PARTIDA_LM = 'luzmala:partida', OPCS_LM = 'luzmala:opciones', IDIOMA_LM = 'luzmala:idioma';
function partidaNueva() {
  return {
    empezada: false, sala: 'P1', banco: null, habil: {}, estado: {}, jefes: {}, faroles: {}, vistas: {},
    vidaMax: 5, ambar: 0, compras: {}, sombra: null, tiempo: 0, pistas: {}, fin: false,
  };
}
let Prog = Object.assign(partidaNueva(), Guardado.leer(PARTIDA_LM, {}));
const Opc = Object.assign({ musica: 0.7, efectos: 0.9, temblor: true, velocidad: 1, invencible: false }, Guardado.leer(OPCS_LM, {}));
const guardarOpcLM = () => Guardado.escribir(OPCS_LM, Opc);
const MUSICA_ZONA = { pueblo: 'pueblo', raices: 'raices', tela: 'tela', hormiguero: 'hormiguero' };
const NADA = { x: 0, y: 0, salto: false, saltoE: false, golpeE: false, dashE: false, curar: false };

const J = {
  estado: 'idioma', mundo: null, anim: null, prog: Prog, t: 0,
  dialogo: null, hallazgo: null, hallazgos: [], cartelZona: null, cartelJefe: null, aviso: null, muerte: null, intro: null, final: null,
  sentada: false, ambarVisto: 0, ambarMas: 0, cambiando: false, zonaActual: null, barraJefe: null, repeticion: null, toque: false, sinCharlas: false,
  /* los efectos de cine: franjas, rayos, ondas, orbes de luz, bichos que caen */
  cine: null, rayos: null, ondas: [], orbes: [], cadaveres: [], flash: 0, vasija: 0, lento: 0, ambiente: [], orbeFarol: null,
};

function guardarLM() {
  const p = J.mundo && J.mundo.p;
  if (p) { Prog.ambar = p.ambar; Prog.vidaMax = p.vidaMax; }
  Guardado.escribir(PARTIDA_LM, Prog);
}
/* lo comprado y lo juntado vive en Prog; Chispa lo lleva puesto */
function vestirChispa(p) {
  p.vidaMax = Prog.vidaMax; p.ambar = Prog.ambar;
  p.danio = Prog.compras.espina ? 1.5 : 1;
  p.curaRapida = !!Prog.compras.cura;
  p.iman = !!Prog.compras.iman;
}
const nombreSala = (id) => TX().salas[id] || id;

/* ---------------- cargar una sala ---------------- */
function cargarSalaLM(id, llegada) {
  const sala = SALA_POR_ID[id];
  const vieja = J.mundo && J.mundo.p;
  const m = crearMundoLM(sala, { estado: Prog.estado, habil: Prog.habil, jugadora: vieja || undefined });
  m.asist = { invencible: Opc.invencible };
  /* las compuertas de jefe están abiertas fuera de la pelea */
  m.puertasJefe = m.rompibles.filter((r) => r.compuerta && r.def.jefe);
  m.rompibles = m.rompibles.filter((r) => !(r.compuerta && r.def.jefe));
  m.arena = sala.jefe && !Prog.jefes[sala.jefe] ? sala.jefe : null;
  const p = m.p;
  if (!vieja) { vestirChispa(p); p.vida = p.vidaMax; J.ambarVisto = p.ambar; }
  if (llegada && llegada.banco) { p.x = llegada.x; p.y = llegada.y; p.vx = p.vy = 0; }
  else if (llegada) { p.x = llegada.x; p.y = llegada.y; }
  else { p.x = m.spawn.x; p.y = m.spawn.y; p.vx = p.vy = 0; }
  p.rx = p.ry = 0; p.ultimoSuelo = { x: p.x, y: p.y }; p.golpe = null; p.curando = false;
  J.mundo = m;
  if (!J.anim) J.anim = animLM();
  J.anim.estela.length = 0;
  J.ondas.length = 0; J.orbes.length = 0; J.cadaveres.length = 0; J.rayos = null; J.cine = null; J.orbeFarol = null;
  Prog.sala = id; Prog.vistas[id] = true;
  ubicarLM(m, true);
  FX.limpiar();
  Sonido.musica(sala.jefe && !Prog.jefes[sala.jefe] ? 'silencio' : MUSICA_ZONA[sala.zona]);
  Sonido.ambiente(sala.zona);
  if (J.zonaActual !== sala.zona) { J.zonaActual = sala.zona; J.cartelZona = { zona: sala.zona, sala: id, t: 0 }; }
  /* pistas la primera vez */
  if (!Prog.pistas[id]) {
    Prog.pistas[id] = true;
    if (id === 'P1') J.aviso = { txt: 'pistaP1', t: -2.5 };
    if (id === 'R1') J.aviso = { txt: 'pistaR1', t: -3 };
  }
}
function empezarPartida(nueva) {
  if (nueva) { Prog = J.prog = Object.assign(partidaNueva()); Guardado.escribir(PARTIDA_LM, Prog); }
  Prog.empezada = true;
  J.mundo = null; J.anim = null; J.zonaActual = null; J.sentada = false; J.muerte = null; J.dialogo = null; J.hallazgo = null; J.hallazgos.length = 0;
  TransLM.activa = false;
  Menu.cerrar();
  if (nueva) { J.estado = 'intro'; J.intro = { i: 0, n: 0, t: 0 }; Sonido.musica('titulo'); mostrarMandosLM(false); return; }
  const b = Prog.banco;
  J.estado = 'cargando';
  TransLM.iniciar(0.45, () => { cargarSalaLM(b ? b.sala : Prog.sala, b ? { banco: true, x: b.x, y: b.y } : null); J.estado = 'jugando'; mostrarMandosLM(true); }, null, { cx: Pantalla.W / 2, cy: Pantalla.H / 2 });
}

/* ---------------- un paso de juego ---------------- */
function pasarJuego() {
  const m = J.mundo, E = Entrada.EDGE, p = m.p;
  if (E.pausa && !TransLM.activa && !J.muerte) { pausarLM(); return; }
  if (E.mapa && !J.muerte) { abrirMapa(); return; }
  Prog.tiempo += DT;
  if (J.cambiando) return;
  let inp = J.repeticion ? (J.repeticion.shift() || NADA) : entradaLM(Entrada);
  if (J.muerte) inp = NADA;
  /* mientras el jefe se presenta, la cámara lo mira a él y Chispa espera */
  if (J.cine && J.cine.t < 1.3) inp = NADA;
  if (J.sentada) {
    if (inp.x || inp.saltoE || inp.golpeE || inp.dashE || inp.y > 0) J.sentada = false;
    else inp = NADA;
  }
  pasarChispa(m, inp);
  pasarBichos(m); pasarBalas(m); pasarJefe(m); pasarAmbar(m);
  procesarEventosLM(m);
  if (m.congelar) { Bucle.congelar(m.congelar); m.congelar = 0; }
  /* las compuertas se animan */
  for (const r of m.rompibles) if (r.compuerta && r.abre != null && r.abre < 1 && !r.abriendo) r.abre = Math.min(1, r.abre + DT * 5);
  for (let i = m.rompibles.length - 1; i >= 0; i--) { const r = m.rompibles[i]; if (r.abriendo) { r.abre = (r.abre == null ? 1 : r.abre) - DT * 1.5; if (r.abre <= 0) m.rompibles.splice(i, 1); } }
  /* la pelea empieza cuando Chispa entra de verdad a la arena */
  if (m.arena && !m.jefe && p.x > 6 * 8 && !p.muerta) empezarPelea(m);
  /* la sombra: tocarla devuelve el ámbar */
  const s = Prog.sombra;
  if (s && s.sala === m.sala.id && !p.muerta && Math.hypot(p.x + 4 - s.x, p.y + 6 - s.y) < 12) {
    p.ambar += s.ambar; J.ambarMas += s.ambar;
    FX.emitir(s.x, s.y, 20, { cols: ['#9fb8ff', '#ffffff', '#c8d8ff'], disp: 70, vida: 26 });
    Sonido.sfx('sombra');
    J.aviso = { txt: tr('recuperaste', s.ambar), crudo: true, t: 0, col: '#c8d8ff' };
    Prog.sombra = null; guardarLM();
  }
  /* salir por un borde: la sala de al lado */
  const lado = salidaDe(m);
  if (lado && !J.cambiando && !p.muerta) pasarDeSala(m, lado);
  /* la muerte: apagarse, y volver al último hongo */
  if (J.muerte) { J.muerte.t += DT; if (J.muerte.t > 2.6 && !J.muerte.listo) { J.muerte.listo = true; revivir(); } }
  if (J.cartelZona) { J.cartelZona.t += DT; if (J.cartelZona.t > 4) J.cartelZona = null; }
  if (J.cartelJefe) { J.cartelJefe.t += DT; if (J.cartelJefe.t > 3.4) J.cartelJefe = null; }
  if (J.cine) { J.cine.t += DT; if (J.cine.t > 2.4) J.cine = null; }
  if (J.aviso) { J.aviso.t += DT; if (J.aviso.t > 2.6) J.aviso = null; }
  if (J.ambarVisto !== p.ambar) J.ambarVisto = acercar(J.ambarVisto, p.ambar, Math.max(1, Math.abs(p.ambar - J.ambarVisto) * 0.1));
  else if (J.ambarMas > 0) J.ambarMas = 0;
  pasarEfectos(m);
  /* gotas en las raíces */
  if (m.sala.zona === 'raices' && Math.random() < 0.004) Sonido.sfx('gota');
  if (J.hallazgos.length && !J.hallazgo && J.estado === 'jugando' && !J.orbeFarol) { J.hallazgo = { q: J.hallazgos.shift(), t: 0 }; J.estado = 'hallazgo'; Sonido.sfx('hallazgo'); }
}

/* los efectos que no son física: se mueven solos */
function pasarEfectos(m) {
  if (J.flash > 0) J.flash = Math.max(0, J.flash - DT * 2.2);
  if (J.vasija > 0) J.vasija = Math.max(0, J.vasija - DT * 3);
  if (J.lento > 0) { J.lento -= DT / Math.max(0.1, Bucle.velocidad); if (J.lento <= 0) Bucle.velocidad = Opc.velocidad; }
  for (let i = J.ondas.length - 1; i >= 0; i--) { J.ondas[i].t += DT; if (J.ondas[i].t > J.ondas[i].dur) J.ondas.splice(i, 1); }
  for (let i = J.cadaveres.length - 1; i >= 0; i--) {
    const c = J.cadaveres[i];
    c.t += DT; c.vy += 500 * DT; c.y += c.vy * DT; c.x += c.vx * DT;
    if (c.t > 0.7) J.cadaveres.splice(i, 1);
  }
  if (J.rayos) { J.rayos.t += DT; if (J.rayos.t > 2.6) J.rayos = null; }
  /* los orbes vuelan a la vasija de luz (en coordenadas de pantalla) */
  for (let i = J.orbes.length - 1; i >= 0; i--) {
    const o = J.orbes[i];
    o.t += DT;
    const k = Math.min(1, o.t / o.dur), e = k * k * (3 - 2 * k);
    o.x = mezclar(o.x0, o.x1, e) + Math.sin(k * Math.PI) * o.curva;
    o.y = mezclar(o.y0, o.y1, e) - Math.sin(k * Math.PI) * 18;
    if (k >= 1) { J.orbes.splice(i, 1); J.vasija = 1; }
  }
  /* el orbe que lleva la luz del jefe al farol */
  const f = J.orbeFarol;
  if (f) {
    f.t += DT;
    const k = Math.min(1, f.t / 1.4), e = 1 - Math.pow(1 - k, 3);
    f.x = mezclar(f.x0, f.x1, e); f.y = mezclar(f.y0, f.y1, e) - Math.sin(k * Math.PI) * 40;
    if (Math.random() < 0.6) FX.emitir(f.x, f.y, 1, { cols: ['#fff0a0', '#ffd060'], disp: 12, vida: 20 });
    if (k >= 1) {
      J.orbeFarol = null; J.flash = 0.7;
      Sonido.sfx('farol'); FX.temblar(4);
      J.ondas.push({ x: f.x1, y: f.y1, t: 0, dur: 1.2, r: 140, col: '255,220,140' });
      FX.emitir(f.x1, f.y1, 40, { cols: ['#fff0a0', '#ffd060', '#ffffff'], disp: 120, vida: 40, arrastre: 0.94 });
      f.alLlegar();
    }
  }
}

function pasarDeSala(m, lado) {
  const p = m.p, s = m.sala;
  const wx = s.pos[0] * 8 + p.x, wy = s.pos[1] * 8 + p.y;
  const cx = wx + p.w / 2 + (lado === 'izq' ? -4 : lado === 'der' ? 4 : 0), cy = wy + p.h / 2 + (lado === 'arr' ? -4 : lado === 'aba' ? 4 : 0);
  const v = salaEn(cx, cy);
  if (!v) { p.x = lim(p.x, 0, m.w * 8 - p.w); p.y = lim(p.y, 0, m.h * 8 - p.h); p.vx = p.vy = 0; return; }
  J.cambiando = true;
  /* la velocidad sigue igual del otro lado: el resolvedor comprobó los pasos
     entre salas con esta misma física, sin empujones */
  const llegada = { x: wx - v.pos[0] * 8, y: wy - v.pos[1] * 8 };
  const ox = -Math.round(VistaLM.x), oy = -Math.round(VistaLM.y);
  TransLM.iniciar(0.13, () => { cargarSalaLM(v.id, llegada); TransLM.cx = -Math.round(VistaLM.x) + J.mundo.p.x + 4; TransLM.cy = -Math.round(VistaLM.y) + J.mundo.p.y + 6; }, () => { J.cambiando = false; },
    { cx: ox + p.x + 4, cy: oy + p.y + 6 });
}
function revivir() {
  const m = J.mundo, p = m.p;
  /* lo que llevaba queda en la sombra; la sombra anterior se pierde */
  Prog.sombra = p.ambar > 0 ? { sala: m.sala.id, x: Math.round(lim(p.x + 4, 12, m.w * 8 - 12)), y: Math.round(lim(p.ultimoSuelo.y + 2, 12, m.h * 8 - 12)), ambar: p.ambar } : Prog.sombra;
  Prog.ambar = 0;
  const b = Prog.banco;
  TransLM.iniciar(0.3, () => {
    /* sin mundo, cargarSalaLM arma una Chispa nueva con lo que hay en Prog */
    J.mundo = null;
    cargarSalaLM(b ? b.sala : 'P1', b ? { banco: true, x: b.x, y: b.y } : null);
    J.muerte = null;
    TransLM.cx = -Math.round(VistaLM.x) + J.mundo.p.x + 4; TransLM.cy = -Math.round(VistaLM.y) + J.mundo.p.y + 6;
    /* se vuelve a prender en el hongo */
    FX.emitir(J.mundo.p.x + 4, J.mundo.p.y + 6, 24, { cols: ['#f6ffa8', '#ffffff', '#b4e858'], disp: 70, vida: 30 });
    guardarLM();
  }, null, { cx: Pantalla.W / 2, cy: VistaLM.usable / 2 });
}

function empezarPelea(m) {
  const tipo = m.arena;
  m.jefe = crearJefe(tipo, m);
  for (const r of m.puertasJefe) { r.abre = 0; m.rompibles.push(r); }
  J.cartelJefe = { tipo, t: 0 }; J.barraJefe = 1;
  J.cine = { t: 0, tipo };
  Sonido.sfx('puerta'); FX.temblar(4);
  Sonido.musica(tipo === 'reina' ? 'reina' : 'jefe');
}
function terminarPelea(m, tipo) {
  const zona = m.sala.zona, j = m.jefe;
  Prog.jefes[tipo] = true;
  const da = JEFES[tipo].da;
  if (da) Prog.habil[da] = true;
  Prog.estado[tipo] = true;
  m.arena = null;
  for (const r of m.rompibles) if (r.compuerta && (r.def.jefe === tipo || r.def.abre === tipo)) r.abriendo = true;
  Sonido.sfx('abre');
  /* la luz del jefe viaja hasta el farol, y recién ahí se prende */
  const f = m.cosas.find((c) => c.tipo === 'farol');
  const alLlegar = () => {
    Prog.faroles[zona] = true;
    J.hallazgos.push('farol_' + zona);
    if (da) J.hallazgos.push(da);
    Sonido.musica(MUSICA_ZONA[zona]);
    if (tipo === 'reina') J.finalPendiente = true;
    guardarLM();
  };
  if (f) J.orbeFarol = { t: 0, x0: j.x + j.w / 2, y0: j.y + j.h / 2, x1: f.x + 4, y1: f.y + 10, x: j.x + j.w / 2, y: j.y, alLlegar };
  else alLlegar();
  guardarLM();
}

/* un orbe de luz que va del golpe a la vasija */
function orbeLuz(x, y, n) {
  const ox = -Math.round(VistaLM.x), oy = -Math.round(VistaLM.y);
  for (let i = 0; i < n; i++) J.orbes.push({ x0: ox + x, y0: oy + y, x1: 14, y1: 14, x: ox + x, y: oy + y, t: -i * 0.06, dur: 0.55 + Math.random() * 0.2, curva: (Math.random() - 0.5) * 50 });
}

function procesarEventosLM(m) {
  const p = m.p, A = J.anim, Z = ZONA_ARTE[m.sala.zona];
  for (const e of m.eventos) {
    Sonido.sfx(e.t, e);
    switch (e.t) {
      case 'salto': A.sx = 0.8; A.sy = 1.2; FX.emitir(p.x + 4, p.y + 12, 4, { cols: Z.polvo, vy: -10, disp: 26, vida: 14, arrastre: 0.9 }); break;
      case 'saltoPared': A.sx = 0.8; A.sy = 1.2; FX.emitir(p.x + (e.d > 0 ? 0 : 8), p.y + 8, 7, { cols: ['#ffb040', '#ffe08a', ...Z.polvo], vx: e.d * 40, disp: 26, vida: 16 }); break;
      case 'aterriza': if ((e.fuerza || 0) > 220) { A.sx = 1.3; A.sy = 0.74; } FX.emitir(p.x + 4, p.y + 12, 2 + Math.round((e.fuerza || 0) / 110), { cols: Z.polvo, vy: -8, disp: 34, vida: 14, arrastre: 0.88 }); break;
      case 'dash': FX.temblar(1); FX.emitir(p.x + 4, p.y + 6, 10, { cols: ['#f6ffa8', '#c8e8ff', '#ffffff'], vx: -e.d * 90, disp: 26, vida: 14, forma: 'linea' }); break;
      case 'pega':
        FX.temblar(1.5); Bucle.congelar(2);
        FX.emitir(e.x, e.y, 8, { cols: ['#ffffff', '#fff0c8', '#f6ffa8'], disp: 100, vida: 10, forma: 'linea' });
        J.ondas.push({ x: e.x, y: e.y, t: 0, dur: 0.18, r: 10, col: '255,255,255' });
        if (e.tipo) orbeLuz(e.x, e.y, 2);
        break;
      case 'pegaJefe':
        FX.temblar(2); Bucle.congelar(3);
        FX.emitir(e.x, e.y, 10, { cols: ['#ffffff', '#ffd0a0', '#ff8a5a'], disp: 120, vida: 12, forma: 'linea' });
        J.ondas.push({ x: e.x, y: e.y, t: 0, dur: 0.2, r: 14, col: '255,230,200' });
        orbeLuz(e.x, e.y, 2);
        break;
      case 'bichoMuere': {
        FX.emitir(e.x, e.y, 14, { cols: ['#ffffff', '#f6ffa8', '#8a82b0', '#5a4a6a'], disp: 80, g: 200, vida: 24, tam: 2 });
        const b = m.bichos.find((q) => q.muerto && !q.caido && Math.abs(q.x + q.w / 2 - e.x) < 2);
        if (b) { b.caido = true; J.cadaveres.push({ tipo: b.tipo, x: b.x + b.w / 2, y: b.y + b.h, dir: b.dir, vx: sig(b.x + b.w / 2 - p.x - 4) * 40, vy: -120, t: 0 }); }
        orbeLuz(e.x, e.y, 3);
        break;
      }
      case 'bloqueo': FX.emitir(e.x, e.y, 8, { cols: ['#ffffff', '#d8d8ff'], disp: 100, vida: 8, forma: 'linea' }); J.ondas.push({ x: e.x, y: e.y, t: 0, dur: 0.15, r: 8, col: '200,210,255' }); break;
      case 'terron': FX.emitir(e.x, e.y, e.fin ? 16 : 5, { cols: ['#ffe08a', '#f0a03a', '#c86a1e'], disp: e.fin ? 90 : 50, g: 300, vida: 22 }); J.ambarMas += e.fin ? 6 : 1; break;
      case 'rompe': FX.temblar(3); FX.emitir(e.x, e.y, 18, { cols: [Z.madera, Z.maderaClara, Z.maderaOsc], g: 420, disp: 110, rx: (e.bw || 8) / 2, ry: (e.bh || 8) / 2, vida: 34, tam: 2 }); guardarLM(); break;
      case 'pogo': case 'pogoEspina': FX.emitir(p.x + 4, p.y + 14, 6, { cols: ['#ffffff', '#f6ffa8'], vy: 40, disp: 50, vida: 10 }); J.ondas.push({ x: p.x + 4, y: p.y + 14, t: 0, dur: 0.2, r: 12, col: '246,255,168' }); break;
      case 'dano':
        FX.temblar(4); Bucle.congelar(5); A.flash = 3; J.flash = Math.max(J.flash, 0.35); J.golpeRojo = 0.5;
        FX.emitir(p.x + 4, p.y + 6, 12, { cols: ['#ffffff', '#1a1426', '#f6ffa8'], disp: 120, vida: 16, forma: 'linea' });
        break;
      case 'muere':
        J.muerte = { t: 0 };
        FX.temblar(6);
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; FX.emitir(p.x + 4, p.y + 6, 1, { col: i % 2 ? '#f6ffa8' : '#ffffff', vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30, disp: 6, vida: 40, tam: 2, arrastre: 0.93 }); }
        break;
      case 'vuelve': FX.emitir(p.x + 4, p.y + 6, 8, { cols: ['#f6ffa8', '#ffffff'], disp: 40, vida: 14 }); break;
      case 'curaEmpieza': J.curaAnillo = 0; break;
      case 'cura': FX.emitir(p.x + 4, p.y + 8, 14, { cols: ['#f6ffa8', '#ffffff', '#b4e858'], vy: -50, disp: 30, vida: 24 }); A.flash = 2; J.ondas.push({ x: p.x + 4, y: p.y + 6, t: 0, dur: 0.5, r: 30, col: '246,255,168' }); break;
      case 'banco': if (!J.sentada && Entrada.EDGE.arr) sentarse(m, e); break;
      case 'habla': if (Entrada.EDGE.arr && J.estado === 'jugando') hablar(e.quien); break;
      case 'chispaExtra':
        Prog.vidaMax = p.vidaMax; guardarLM();
        FX.emitir(e.x, e.y, 24, { cols: ['#f6ffa8', '#ffffff'], disp: 100, vida: 30 });
        J.hallazgos.push('chispaExtra');
        break;
      case 'ambar': J.ambarMas += 1; break;
      case 'rugido':
        FX.temblar(5);
        if (m.jefe) { const jx = m.jefe.x + m.jefe.w / 2, jy = m.jefe.y + m.jefe.h / 2; J.ondas.push({ x: jx, y: jy, t: 0, dur: 0.9, r: 120, col: '255,200,170' }); J.ondas.push({ x: jx, y: jy, t: -0.15, dur: 0.9, r: 90, col: '255,255,255' }); }
        break;
      case 'aviso': FX.emitir(e.x, e.y - 4, 5, { cols: ['#ffffff', '#ff8a5a'], vy: -40, disp: 20, vida: 10 }); break;
      case 'choca': FX.temblar(6); FX.emitir(e.x, e.y, 16, { cols: [Z.madera, Z.maderaClara, '#b09070'], g: 380, disp: 120, vida: 30, tam: 2 }); J.ondas.push({ x: e.x, y: e.y, t: 0, dur: 0.35, r: 30, col: '255,230,200' }); break;
      case 'tierra': FX.temblar(4); FX.emitir(e.x, e.y, 12, { cols: Z.polvo, vy: -30, disp: 90, vida: 20 }); break;
      case 'carga': FX.emitir(m.jefe ? m.jefe.x + m.jefe.w / 2 : p.x, m.jefe ? m.jefe.y + m.jefe.h : p.y, 6, { cols: Z.polvo, disp: 40, vida: 16 }); break;
      case 'rocaCae': FX.emitir(e.x, e.y, 8, { cols: ['#7a5a3a', '#b09070'], g: 300, disp: 60, vida: 18 }); break;
      case 'jefeFase': FX.temblar(6); A.flash = 3; J.flash = 0.4; if (m.jefe) J.ondas.push({ x: m.jefe.x + m.jefe.w / 2, y: m.jefe.y + m.jefe.h / 2, t: 0, dur: 0.7, r: 90, col: '255,120,90' }); break;
      case 'jefeMuere':
        FX.temblar(10); J.flash = 1;
        J.rayos = { x: e.x, y: e.y, t: 0 };
        /* cámara lenta: el golpe final se siente */
        Bucle.velocidad = Opc.velocidad * 0.35; J.lento = 1.2;
        for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2; FX.emitir(e.x, e.y, 1, { col: i % 3 ? '#ffffff' : '#fff0a0', vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, disp: 20, vida: 44, tam: 2, arrastre: 0.93 }); }
        break;
      case 'jefeFin': terminarPelea(m, e.tipo); break;
    }
  }
  m.eventos.length = 0;
}

/* ---------------- los hongos: descansar y guardar ---------------- */
function sentarse(m, e) {
  const p = m.p;
  J.sentada = true;
  p.vx = 0; p.vida = p.vidaMax; p.x = Math.round(e.x - 4);
  Prog.banco = { sala: m.sala.id, x: p.x, y: p.y };
  FX.emitir(e.x, e.y + 2, 16, { cols: ['#c8fff6', '#4ad8c8', '#ffffff'], vy: -30, disp: 40, vida: 30 });
  J.ondas.push({ x: e.x, y: e.y + 4, t: 0, dur: 0.8, r: 40, col: '120,240,220' });
  J.aviso = { txt: 'descansaste', t: 0, col: '#c8fff6' };
  guardarLM();
}

/* ---------------- charlas y tienda ---------------- */
function avanceHistoria() { return (Prog.jefes.torito ? 1 : 0) + (Prog.jefes.viuda ? 1 : 0); }
function hablar(quien) {
  const textos = TX().charlas[quien];
  if (!textos || J.sinCharlas) return;
  const i = Math.min(avanceHistoria(), textos.length - 1);
  const lineas = textos[i].map((t, k) => ({ q: QUIEN_HABLA[quien][i][k], t }));
  const npc = J.mundo.cosas.find((c) => c.tipo === 'npc' && c.quien === quien);
  iniciarDialogoLM(lineas, npc, quien === 'canasto' ? abrirTienda : null);
  Sonido.sfx('habla');
}
function iniciarDialogoLM(lineas, npc, alTerminar) {
  J.dialogo = { lineas, i: 0, n: 0, t: 0, npc, alTerminar };
  J.estado = 'dialogo';
  J.sentada = false;
}
function pasarDialogoLM() {
  const d = J.dialogo, E = Entrada.EDGE, l = d.lineas[d.i];
  d.t += DT;
  const largo = Array.from(l.t).length;
  if (d.n < largo) {
    const antes = Math.floor(d.n);
    d.n = Math.min(largo, d.n + 0.8);
    if (Math.floor(d.n) !== antes && antes % 2 === 0 && l.t[antes] !== ' ') Sonido.sfx('texto', { f: { chispa: 880, mamboreta: 320, vaquita: 1040, canasto: 420, bolita: 560 }[l.q] || 600 });
  }
  if (E.salto || E.aceptar || E.golpe || J.toque) {
    if (d.n < largo) d.n = largo;
    else {
      d.i++; d.n = 0; d.t = 0;
      if (d.i >= d.lineas.length) { J.dialogo = null; J.estado = 'jugando'; if (d.alTerminar) d.alTerminar(); }
    }
  }
  J.toque = false;
  pasarAnimLM(J.anim, J.mundo); FX.pasar(); ubicarLM(J.mundo);
}

function abrirTienda() {
  J.estado = 'tienda';
  mostrarMandosLM(false);
  Menu.abrir(menuTienda());
}
function comprar(id) {
  const p = J.mundo.p, precio = PRECIOS[id];
  if (Prog.compras[id]) { Sonido.sfx('nada'); return; }
  if (p.ambar < precio) { Sonido.sfx('nada'); Menu.actual.aviso = { txt: tr('noAlcanza'), t: 0 }; return; }
  p.ambar -= precio; Prog.ambar = p.ambar; J.ambarVisto = p.ambar;
  Prog.compras[id] = true;
  if (id === 'corazon') Prog.vidaMax = p.vidaMax + 1;
  vestirChispa(p);
  if (id === 'corazon') p.vida = p.vidaMax;
  Sonido.sfx('compra');
  Menu.actual.compra = { id, t: 0 };
  guardarLM();
}
function menuTienda() {
  const items = ORDEN_TIENDA.map((id) => ({ id, texto: () => TX().tienda[id][0], valor: () => Prog.compras[id] ? tr('yaEsTuyo') : String(PRECIOS[id]), accion: () => comprar(id) }));
  items.push({ id: 'chau', texto: () => tr('chau'), accion: cerrarTienda });
  return { id: 'tienda', items, alVolver: cerrarTienda, dibujar: dibujarTienda, pausaVuelve: true };
}
function cerrarTienda() { Menu.cerrar(); J.estado = 'jugando'; mostrarMandosLM(true); }

/* ---------------- menús ---------------- */
function mostrarIdiomas() {
  J.estado = 'idioma';
  mostrarMandosLM(false);
  Menu.abrir(menuIdiomas((l) => { Idioma.poner(l); document.documentElement.lang = l; irPortadaLM(true); }));
}
function menuTitulo() {
  const items = [];
  if (Prog.empezada) items.push({ id: 'continuar', texto: () => tr('continuar'), accion: () => empezarPartida(false) });
  items.push({
    id: 'nueva', texto: () => Menu.actual && Menu.actual.seguro ? tr('nuevaSeguro') : tr('nueva'),
    accion() { const m = Menu.actual; if (Prog.empezada && !m.seguro) { m.seguro = true; return; } empezarPartida(true); },
  });
  items.push({ id: 'opciones', texto: () => tr('opciones'), accion: () => Menu.abrir(menuOpciones(), { apilar: true }) });
  items.push({ id: 'creditos', texto: () => tr('creditos'), accion: () => { J.estado = 'creditos'; J.tCred = 0; Menu.cerrar(); } });
  return { id: 'titulo', items, y0: () => Pantalla.H > Pantalla.W && Portada.agua ? Math.round(Portada.agua + (Pantalla.H - Portada.agua) * 0.2) : Math.round(Pantalla.H * 0.62), paso: 16, alVolver: mostrarIdiomas };
}
function menuOpciones() {
  const vels = [1, 0.9, 0.8, 0.7];
  const vol = (k, d) => () => { Opc[k] = lim(Math.round((Opc[k] + d) * 10) / 10, 0, 1); aplicarOpcionesLM(); };
  const alternar = (k) => () => { Opc[k] = !Opc[k]; aplicarOpcionesLM(); };
  const siNo = (v) => tr(v ? 'si' : 'no');
  const idioma = (d) => () => { const i = IDIOMAS.findIndex(([l]) => l === Idioma.actual); Idioma.poner(IDIOMAS[(i + d + IDIOMAS.length) % IDIOMAS.length][0]); document.documentElement.lang = Idioma.actual; };
  return {
    id: 'opciones', titulo: tr('opciones').toUpperCase(), pie: tr('ayudas'), paso: 15,
    items: [
      { id: 'idioma', texto: () => tr('idioma'), valor: () => IDIOMAS.find(([l]) => l === Idioma.actual)[1], izq: idioma(-1), der: idioma(1) },
      { id: 'musica', texto: () => tr('musica'), valor: () => '', luces: () => Opc.musica, izq: vol('musica', -0.1), der: vol('musica', 0.1) },
      { id: 'efectos', texto: () => tr('efectos'), valor: () => '', luces: () => Opc.efectos, izq: vol('efectos', -0.1), der: vol('efectos', 0.1) },
      { id: 'temblor', texto: () => tr('temblor'), valor: () => siNo(Opc.temblor), izq: alternar('temblor'), der: alternar('temblor') },
      { id: 'velocidad', texto: () => tr('velocidad'), valor: () => Math.round(Opc.velocidad * 100) + '%',
        izq: () => { Opc.velocidad = vels[Math.max(0, vels.indexOf(Opc.velocidad) - 1)]; aplicarOpcionesLM(); },
        der: () => { Opc.velocidad = vels[(vels.indexOf(Opc.velocidad) + 1) % vels.length]; aplicarOpcionesLM(); } },
      { id: 'invencible', texto: () => tr('invencible'), valor: () => siNo(Opc.invencible), izq: alternar('invencible'), der: alternar('invencible') },
      { id: 'volver', texto: () => tr('volver'), accion: () => Menu.volver() },
    ],
    alVolver: () => { if (J.estado === 'pausa') Menu.abrir(menuPausa()); else irPortadaLM(); },
  };
}
function menuPausa() {
  return {
    id: 'pausa', titulo: tr('pausa'), pausaVuelve: true, paso: 16,
    items: [
      { id: 'seguir', texto: () => tr('seguir'), accion: seguirLM },
      { id: 'mapa', texto: () => tr('mapa'), accion: abrirMapa },
      { id: 'opciones', texto: () => tr('opciones'), accion: () => Menu.abrir(menuOpciones(), { apilar: true }) },
      { id: 'salir', texto: () => tr('salirTitulo'), accion: () => { guardarLM(); irPortadaLM(); } },
    ],
    alVolver: seguirLM, dibujar: dibujarPausa,
  };
}
function pausarLM() { J.estado = 'pausa'; mostrarMandosLM(false); Menu.abrir(menuPausa()); }
function seguirLM() { Menu.cerrar(); J.estado = 'jugando'; mostrarMandosLM(true); }
function abrirMapa() { J.estado = 'mapa'; J.tMapa = 0; Menu.cerrar(); mostrarMandosLM(false); }
function irPortadaLM(conLuz) {
  J.estado = 'portada';
  mostrarMandosLM(false);
  Sonido.musica('titulo'); Sonido.ambiente('pueblo');
  Bucle.velocidad = Opc.velocidad;
  Menu.abrir(menuTitulo());
  if (conLuz) TransLM.abrir(0.6, Pantalla.W / 2, Pantalla.H * 0.4);
}
function aplicarOpcionesLM() {
  Sonido.volumenes(Opc.musica, Opc.efectos);
  FX.temblorActivo = Opc.temblor;
  Bucle.velocidad = Opc.velocidad;
  if (J.mundo) J.mundo.asist = { invencible: Opc.invencible };
  guardarOpcLM();
}
function mostrarMandosLM(ver) {
  document.getElementById('mandos').classList.toggle('ver', ver && document.body.classList.contains('tactil'));
  document.getElementById('btPausa').classList.toggle('ver', ver);
}

/* ---------------- el final ---------------- */
function empezarFinalLM() {
  J.estado = 'final'; J.final = { t: 0 };
  Prog.fin = true; guardarLM();
  mostrarMandosLM(false);
  Sonido.musica('final'); Sonido.ambiente('pueblo');
  TransLM.abrir(1.2, Pantalla.W / 2, Pantalla.H * 0.5);
}

/* motas que flotan en el aire: esporas, pelusa de tela, polvo; y en el pueblo, luciérnagas */
function motas(m) {
  const Z = ZONA_ARTE[m.sala.zona], zona = m.sala.zona;
  if (Math.random() < 0.22) {
    const sube = zona === 'raices' || zona === 'hormiguero';
    FX.emitir(VistaLM.x + Math.random() * Pantalla.W, VistaLM.y + Math.random() * VistaLM.usable, 1,
      { cols: Z.polvo, vx: (Math.random() - 0.5) * 6, vy: sube ? -5 : 4, disp: 3, vida: 170, arrastre: 1, fondo: Math.random() < 0.6 });
  }
  /* bichitos de luz que titilan (se dibujan encima de la oscuridad) */
  const A = J.ambiente, cuantos = zona === 'pueblo' ? 10 : zona === 'raices' ? 6 : zona === 'hormiguero' ? 7 : 4;
  while (A.length < cuantos) A.push({ x: VistaLM.x + Math.random() * Pantalla.W, y: VistaLM.y + Math.random() * VistaLM.usable, f: Math.random() * 7, v: 0.3 + Math.random() * 0.5, vida: 4 + Math.random() * 5 });
  for (let i = A.length - 1; i >= 0; i--) {
    const a = A[i];
    a.vida -= DT; a.f += DT;
    a.x += Math.sin(a.f * a.v * 2) * 0.25; a.y += Math.cos(a.f * a.v * 1.3) * 0.18 - (zona === 'hormiguero' ? 0.12 : 0);
    if (a.vida <= 0 || a.x < VistaLM.x - 20 || a.x > VistaLM.x + Pantalla.W + 20) A.splice(i, 1);
  }
}

/* ---------------- el bucle ---------------- */
function pasar() {
  TransLM.pasar();
  VistaLM.t += DT;
  const E = Entrada.EDGE;
  switch (J.estado) {
    case 'idioma': case 'portada': case 'pausa': case 'tienda':
      Menu.pasar();
      if (J.estado === 'pausa' && J.mundo) { pasarAnimLM(J.anim, J.mundo); }
      break;
    case 'creditos':
      J.tCred += DT;
      if (J.tCred > 0.5 && (E.salto || E.aceptar || E.golpe || E.volver || E.dash || E.pausa || J.toque)) irPortadaLM();
      break;
    case 'intro': {
      const I = J.intro, textos = TX().intro;
      I.t += DT;
      const largo = Array.from(textos[I.i]).length;
      if (I.n < largo) { const a = Math.floor(I.n); I.n = Math.min(largo, I.n + 0.55); if (Math.floor(I.n) !== a && a % 3 === 0) Sonido.sfx('texto', { f: 700 }); }
      if (E.salto || E.aceptar || E.golpe || J.toque) {
        /* el primer toque completa la frase y el dibujo; el segundo pasa */
        if (I.n < largo || !(DibIntro.i === I.i && DibIntro.listo)) { I.n = largo; I.salto = true; }
        else if (++I.i >= textos.length) {
          J.intro = null; J.estado = 'cargando';
          TransLM.iniciar(0.5, () => { cargarSalaLM('P1'); J.estado = 'jugando'; mostrarMandosLM(true); }, null, { cx: Pantalla.W / 2, cy: Pantalla.H * 0.7 });
        } else { I.n = 0; I.t = 0; I.salto = false; }
      }
      break;
    }
    case 'jugando':
      pasarJuego();
      if (J.mundo) { pasarAnimLM(J.anim, J.mundo); motas(J.mundo); FX.pasar(); ubicarLM(J.mundo); }
      if (J.finalPendiente && J.estado === 'jugando' && !J.hallazgos.length) { J.finalPendiente = false; J.estado = 'cargando'; TransLM.iniciar(1.4, empezarFinalLM, null, { cx: Pantalla.W / 2, cy: Pantalla.H / 2, col: '255,248,224' }); }
      break;
    case 'dialogo': pasarDialogoLM(); break;
    case 'hallazgo':
      J.hallazgo.t += DT;
      if (J.hallazgo.t > 0.9 && (E.salto || E.aceptar || E.golpe || J.toque)) { J.hallazgo = null; J.estado = 'jugando'; }
      FX.pasar(); pasarEfectos(J.mundo);
      break;
    case 'mapa':
      J.tMapa += DT;
      if (J.tMapa > 0.2 && (E.mapa || E.pausa || E.salto || E.aceptar || E.volver || E.golpe || E.dash || J.toque)) { J.estado = 'jugando'; mostrarMandosLM(true); }
      break;
    case 'final':
      J.final.t += DT;
      if (J.final.t > TX().final.length * 4.5 + 2 && (E.salto || E.aceptar || J.toque)) irPortadaLM(true);
      break;
  }
  J.toque = false; Menu.toque = null;
}
function dibujar() {
  const g = Pantalla.g, t = VistaLM.t;
  marcarDibujo(t);
  g.fillStyle = '#050308'; g.fillRect(0, 0, Pantalla.W, Pantalla.H);
  switch (J.estado) {
    case 'idioma': dibujarPortadaLM(g, t, false); Menu.dibujar(g, t); break;
    case 'portada': dibujarPortadaLM(g, t, !(Menu.actual && Menu.actual.id === 'opciones')); if (Menu.actual && Menu.actual.id === 'opciones') velo(g, 0.55); Menu.dibujar(g, t); break;
    case 'creditos': dibujarCreditosLM(g, J, t); break;
    case 'intro': dibujarIntro(g, J, t); break;
    case 'final': dibujarFinalLM(g, J, t); break;
    case 'mapa': dibujarMapa(g, J, t); break;
    default:
      if (!J.mundo) break;
      dibujarSalaLM(g, J, t);
      dibujarHUD(g, J, t);
      dibujarCine(g, J, t);
      dibujarZonaNombre(g, J); dibujarCartelJefe(g, J); dibujarAvisoLM(g, J);
      dibujarGlobo(g, J, t);
      dibujarHallazgo(g, J, t);
      dibujarMuerte(g, J, t);
      if (J.estado === 'pausa' || J.estado === 'tienda') { velo(g, 0.62); Menu.dibujar(g, t); }
  }
  TransLM.dibujar(g);
}

/* ---------------- arranque ---------------- */
function arrancar() {
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('tactil');
  Pantalla.iniciar(document.getElementById('lienzo'), 180);
  prepararArte();
  Bucle.fijo = /[?&]fijo/.test(location.search);
  Idioma.iniciar(IDIOMA_LM, { es: TX_LM.es.ui, en: TX_LM.en.ui, pt: TX_LM.pt.ui });
  Entrada.mando = { 0: 'salto', 1: 'dash', 2: 'golpe', 3: 'curar', 4: 'dash', 5: 'dash', 6: 'curar', 7: 'golpe', 8: 'mapa', 9: 'pausa', 12: 'arr', 13: 'aba', 14: 'izq', 15: 'der' };
  Entrada.iniciarTeclado({
    ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arr', KeyW: 'arr', ArrowDown: 'aba', KeyS: 'aba',
    KeyZ: 'salto', Space: 'salto', KeyK: 'salto', KeyX: 'golpe', KeyJ: 'golpe', KeyC: 'dash', KeyL: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyV: 'curar', KeyI: 'curar', KeyQ: 'curar', KeyM: 'mapa', Tab: 'mapa', Enter: 'aceptar', Escape: 'pausa', KeyP: 'pausa', Backspace: 'volver',
  });
  Entrada.alUsar = (f) => { if (f === 'toque') { document.body.classList.add('tactil'); if (J.estado === 'jugando') mostrarMandosLM(true); } };
  Entrada.palanca(document.getElementById('zonaPalanca'), document.querySelector('#zonaPalanca .base'), document.querySelector('#zonaPalanca .perilla'), { radio: 36, muerto: 10 });
  for (const [id, a, ic, col, S] of [['btSalto', 'salto', 'salto', '#fbffd8', 3], ['btGolpe', 'golpe', 'golpe', '#ffffff', 3], ['btDash', 'dash', 'dash', '#d8f0ff', 2], ['btCurar', 'curar', 'curar', '#f6ffa8', 2]]) {
    const b = document.getElementById(id);
    Entrada.boton(b, a);
    b.appendChild(iconoLM(ic, col, S));
  }
  document.getElementById('btPausa').appendChild(iconoLM('pausa', '#efe6d2', 2));
  document.getElementById('btPausa').addEventListener('click', () => { if (J.estado === 'jugando' || J.estado === 'dialogo') pausarLM(); });
  /* tocar el lienzo: adelanta los diálogos y elige en los menús */
  document.getElementById('lienzo').addEventListener('pointerdown', (e) => { J.toque = true; Menu.toque = Pantalla.aMundo(e.clientX, e.clientY); });
  const despertar = () => { Sonido.arrancar(); aplicarOpcionesLM(); };
  addEventListener('pointerdown', despertar, { once: true });
  addEventListener('keydown', despertar, { once: true });
  aplicarOpcionesLM();
  document.documentElement.lang = Idioma.actual;
  Sonido.musica('titulo'); Sonido.ambiente('pueblo');
  mostrarIdiomas();
  Bucle.iniciar(pasar, dibujar, () => Entrada.leerMando());
  /* sondas para las pruebas: nada de esto lo usa el juego */
  window.__L = {
    J, Opc, SALAS_LM, listo: true,
    prog: () => Prog,
    /* cargar una sala con ciertas habilidades, sin pasar por la intro */
    empezar(id, o) {
      o = o || {};
      Prog = J.prog = Object.assign(partidaNueva(), { empezada: true, habil: o.habil || {}, jefes: o.jefes || {}, faroles: o.faroles || {}, estado: o.estado || {}, ambar: o.ambar || 0, pistas: { P1: 1, R1: 1 } });
      J.mundo = null; J.anim = null; J.zonaActual = id.startsWith('P') ? 'pueblo' : null; J.muerte = null; J.dialogo = null; J.hallazgo = null; J.hallazgos.length = 0; J.sentada = false;
      J.sinCharlas = !!o.sinCharlas; TransLM.activa = false; J.cambiando = false; J.orbeFarol = null; J.finalPendiente = false;
      Menu.cerrar();
      cargarSalaLM(id, o.en ? { x: o.en[0], y: o.en[1] } : null);
      J.estado = 'jugando'; mostrarMandosLM(true);
    },
    anda(n) { Bucle.adelantar(n); },
    entrada(a, v) { if (v) Entrada.pulsar(a, 'prueba'); else Entrada.soltar(a, 'prueba'); },
    repetir(cuadros) { J.repeticion = cuadros.slice(); },
    sala() { const m = J.mundo; if (!m) return null; const p = m.p; return { id: m.sala.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, vida: p.vida, vidaMax: p.vidaMax, luz: p.luz, ambar: p.ambar, muerta: p.muerta, enSuelo: p.enSuelo, jefe: m.jefe ? { tipo: m.jefe.tipo, vida: m.jefe.vida, est: m.jefe.est, fase: m.jefe.fase, muerto: m.jefe.muerto } : null, bichos: m.bichos.filter((b) => !b.muerto).length }; },
    estado() { return J.estado; },
    medidas() { return { msDibujo: Bucle.msDibujo, W: Pantalla.W, H: Pantalla.H, PX: Pantalla.PX, particulas: FX.part.length }; },
    danarJefe(n) { const m = J.mundo; if (m && m.jefe) for (let i = 0; i < n; i++) { m.jefe.est = m.jefe.est === 'presenta' ? 'espera' : m.jefe.est; danarJefe(m, m.jefe, 1); } },
    poner(x, y) { const p = J.mundo.p; p.x = x; p.y = y; p.vx = p.vy = 0; },
    /* los menús son del lienzo: estas sondas dicen qué hay y dónde tocar */
    menu() { const m = Menu.actual; return m && { id: m.id, sel: m.sel, items: m.items.map((i) => i.id), textos: m.items.map((i) => i.texto()) }; },
    /* dónde está una palabra del menú, en píxeles de la ventana (para tocarla de verdad) */
    donde(id) {
      const r = Menu.rects.find((q) => q.it.id === id);
      if (!r) return null;
      const c = document.getElementById('lienzo').getBoundingClientRect(), k = Pantalla.PX;
      return { x: c.left + ((r.x0 + r.x1) / 2) * k, y: c.top + ((r.y0 + r.y1) / 2) * k };
    },
    /* una hoja con cuadros de sprites, agrandados (para mirar las animaciones) */
    hoja(nombres, k) {
      k = k || 6;
      const cuadros = [];
      for (const n of nombres) { const v = SPR.chispa[n]; (Array.isArray(v) ? v : [v]).forEach((s, i) => cuadros.push([n + (Array.isArray(v) ? i : ''), s])); }
      const c = document.createElement('canvas'), celda = 18 * k;
      c.width = Math.min(8, cuadros.length) * celda; c.height = Math.ceil(cuadros.length / 8) * (celda + 10);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#2a2436'; g.fillRect(0, 0, c.width, c.height);
      cuadros.forEach(([n, s], i) => { const x = (i % 8) * celda, y = Math.floor(i / 8) * (celda + 10); g.drawImage(s.der, x + (celda - s.w * k) / 2, y + (celda - s.h * k) / 2, s.w * k, s.h * k); g.fillStyle = '#fff'; g.font = '10px monospace'; g.fillText(n, x + 2, y + celda + 8); });
      return c.toDataURL();
    },
    idioma: () => Idioma.actual,
    ponerIdioma(l) { Idioma.poner(l); document.documentElement.lang = l; },
    textos: () => TX_LM,
    dialogo: () => J.dialogo && { i: J.dialogo.i, lineas: J.dialogo.lineas.map((l) => l.t) },
    texto: (k) => tr(k),
    /* letras de los tres idiomas que la letra fina no tiene */
    letrasQueFaltan() {
      const falta = new Set();
      const mirar = (x) => { if (x == null) return; if (typeof x === 'object') { Object.values(x).forEach(mirar); return; } for (const ch of String(x).replace(/\{\d\}/g, '')) if (ch !== ' ' && ch !== '?' && glifoFino(ch).falta) falta.add(ch); };
      mirar(TX_LM); IDIOMAS.forEach(([, n]) => mirar(n)); mirar(TX_IDIOMA);
      return [...falta];
    },
  };
}
arrancar();
