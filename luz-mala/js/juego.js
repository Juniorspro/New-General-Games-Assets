/* ============================================================================
   luz-mala/js/juego.js — el que ata todo.
   Estados: portada · intro · jugando · dialogo · hallazgo · mapa · pausa ·
            tienda · final
   La partida se guarda sola: al sentarse en un hongo, al vencer a un jefe,
   al comprar, al juntar algo que no vuelve.
   ========================================================================== */

const PARTIDA_LM = 'luzmala:partida', OPCS_LM = 'luzmala:opciones';
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
  estado: 'portada', mundo: null, anim: null, prog: Prog, t: 0,
  dialogo: null, hallazgo: null, hallazgos: [], cartelZona: null, cartelJefe: null, aviso: null, muerte: null, intro: null, final: null,
  sentada: false, ambarVisto: 0, ambarMas: 0, cambiando: false, zonaActual: null, barraJefe: null, repeticion: null, toque: false, sinCharlas: false,
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
  if (llegada && llegada.banco) {
    p.x = llegada.x; p.y = llegada.y; p.vx = p.vy = 0;
  } else if (llegada) {
    p.x = llegada.x; p.y = llegada.y;
  } else { p.x = m.spawn.x; p.y = m.spawn.y; p.vx = p.vy = 0; }
  p.rx = p.ry = 0; p.ultimoSuelo = { x: p.x, y: p.y }; p.golpe = null; p.curando = false;
  J.mundo = m;
  if (!J.anim) J.anim = animLM();
  J.anim.estela.length = 0;
  Prog.sala = id; Prog.vistas[id] = true;
  ubicarLM(m, true);
  FX.limpiar();
  Sonido.musica(sala.jefe && !Prog.jefes[sala.jefe] ? 'silencio' : MUSICA_ZONA[sala.zona]);
  Sonido.ambiente(sala.zona);
  if (J.zonaActual !== sala.zona) { J.zonaActual = sala.zona; J.cartelZona = { txt: ZONAS[sala.zona].nombre.toUpperCase(), t: 0 }; }
  /* pistas la primera vez */
  if (!Prog.pistas[id]) {
    Prog.pistas[id] = true;
    if (id === 'P1') J.aviso = { txt: 'ARRIBA PARA HABLAR CON LOS DEL PUEBLO', t: -2.5, grad: GRAD.blanco };
    if (id === 'R1') J.aviso = { txt: 'GOLPEAR JUNTA LUZ · MANTENÉ CURAR PARA CURARTE', t: -3, grad: GRAD.blanco };
  }
}
function empezarPartida(nueva) {
  if (nueva) { Prog = J.prog = Object.assign(partidaNueva()); Guardado.escribir(PARTIDA_LM, Prog); }
  Prog.empezada = true;
  J.mundo = null; J.anim = null; J.zonaActual = null; J.sentada = false; J.muerte = null; J.dialogo = null; J.hallazgo = null; J.hallazgos.length = 0;
  Transicion.activa = false;
  UI.ocultar();
  if (nueva) { J.estado = 'intro'; J.intro = { i: 0, n: 0, t: 0 }; Sonido.musica('titulo'); mostrarMandosLM(false); return; }
  const b = Prog.banco;
  cargarSalaLM(b ? b.sala : Prog.sala, b ? { banco: true, x: b.x, y: b.y } : null);
  J.estado = 'jugando';
  mostrarMandosLM(true);
}

/* ---------------- un paso de juego ---------------- */
function pasarJuego() {
  const m = J.mundo, E = Entrada.EDGE, p = m.p;
  if (E.pausa && !Transicion.activa && !J.muerte) { pausarLM(); return; }
  if (E.mapa && !J.muerte) { abrirMapa(); return; }
  Prog.tiempo += DT;
  if (J.cambiando) return;
  let inp = J.repeticion ? (J.repeticion.shift() || NADA) : entradaLM(Entrada);
  if (J.muerte) inp = NADA;
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
    J.aviso = { txt: 'RECUPERASTE ' + s.ambar + ' DE ÁMBAR', t: 0, grad: GRAD.celeste };
    Prog.sombra = null; guardarLM();
  }
  /* salir por un borde: la sala de al lado */
  const lado = salidaDe(m);
  if (lado && !J.cambiando && !p.muerta) pasarDeSala(m, lado);
  /* la muerte: apagarse, y volver al último hongo */
  if (J.muerte) { J.muerte.t += DT; if (J.muerte.t > 2.3 && !J.muerte.listo) { J.muerte.listo = true; revivir(); } }
  if (J.cartelZona) { J.cartelZona.t += DT; if (J.cartelZona.t > 3.6) J.cartelZona = null; }
  if (J.cartelJefe) { J.cartelJefe.t += DT; if (J.cartelJefe.t > 3.2) J.cartelJefe = null; }
  if (J.aviso) { J.aviso.t += DT; if (J.aviso.t > 2.4) J.aviso = null; }
  if (J.ambarVisto !== p.ambar) J.ambarVisto = acercar(J.ambarVisto, p.ambar, Math.max(1, Math.abs(p.ambar - J.ambarVisto) * 0.1));
  else if (J.ambarMas > 0) J.ambarMas = 0;
  /* gotas en las raíces */
  if (m.sala.zona === 'raices' && Math.random() < 0.004) Sonido.sfx('gota');
  if (J.hallazgos.length && !J.hallazgo && J.estado === 'jugando') { J.hallazgo = { q: J.hallazgos.shift(), t: 0 }; J.estado = 'hallazgo'; Sonido.sfx('hallazgo'); }
}

function pasarDeSala(m, lado) {
  const p = m.p, s = m.sala;
  const wx = s.pos[0] * 8 + p.x, wy = s.pos[1] * 8 + p.y;
  const cx = wx + p.w / 2 + (lado === 'izq' ? -4 : lado === 'der' ? 4 : 0), cy = wy + p.h / 2 + (lado === 'arr' ? -4 : lado === 'aba' ? 4 : 0);
  const v = salaEn(cx, cy);
  if (!v) {
    /* por las dudas: un hueco al vacío devuelve adentro */
    p.x = lim(p.x, 0, m.w * 8 - p.w); p.y = lim(p.y, 0, m.h * 8 - p.h); p.vx = p.vy = 0;
    return;
  }
  J.cambiando = true;
  /* la velocidad sigue igual del otro lado: el resolvedor comprobó los pasos
     entre salas con esta misma física, sin empujones */
  const llegada = { x: wx - v.pos[0] * 8, y: wy - v.pos[1] * 8 };
  Transicion.iniciar('trama', 7, () => { cargarSalaLM(v.id, llegada); }, () => { J.cambiando = false; });
}
function revivir() {
  const m = J.mundo, p = m.p;
  /* lo que llevaba queda en la sombra; la sombra anterior se pierde */
  Prog.sombra = p.ambar > 0 ? { sala: m.sala.id, x: Math.round(lim(p.x + 4, 12, m.w * 8 - 12)), y: Math.round(lim(p.ultimoSuelo.y + 2, 12, m.h * 8 - 12)), ambar: p.ambar } : Prog.sombra;
  Prog.ambar = 0;
  const b = Prog.banco;
  Transicion.iniciar('trama', 14, () => {
    /* sin mundo, cargarSalaLM arma una Chispa nueva con lo que hay en Prog */
    J.mundo = null;
    cargarSalaLM(b ? b.sala : 'P1', b ? { banco: true, x: b.x, y: b.y } : null);
    J.muerte = null;
    guardarLM();
  }, null);
}

function empezarPelea(m) {
  const tipo = m.arena;
  m.jefe = crearJefe(tipo, m);
  for (const r of m.puertasJefe) { r.abre = 0; m.rompibles.push(r); }
  J.cartelJefe = { tipo, t: 0 }; J.barraJefe = 1;
  Sonido.sfx('puerta'); FX.temblar(4);
  Sonido.musica(tipo === 'reina' ? 'reina' : 'jefe');
}
function terminarPelea(m, tipo) {
  const zona = m.sala.zona;
  Prog.jefes[tipo] = true; Prog.faroles[zona] = true;
  const da = JEFES[tipo].da;
  if (da) Prog.habil[da] = true;
  Prog.estado[tipo] = true;
  m.arena = null;
  for (const r of m.rompibles) if (r.compuerta && (r.def.jefe === tipo || r.def.abre === tipo)) r.abriendo = true;
  Sonido.sfx('farol'); Sonido.sfx('abre');
  const f = m.cosas.find((c) => c.tipo === 'farol');
  if (f) FX.emitir(f.x + 4, f.y + 8, 40, { cols: ['#fff0a0', '#ffd060', '#ffffff'], disp: 120, vida: 40, arrastre: 0.94 });
  J.hallazgos.push('farol_' + zona);
  if (da) J.hallazgos.push(da);
  Sonido.musica(MUSICA_ZONA[zona]);
  if (tipo === 'reina') J.finalPendiente = true;
  guardarLM();
}

function procesarEventosLM(m) {
  const p = m.p, A = J.anim, Z = ZONA_ARTE[m.sala.zona];
  for (const e of m.eventos) {
    Sonido.sfx(e.t, e);
    switch (e.t) {
      case 'salto': A.sx = 0.8; A.sy = 1.2; FX.emitir(p.x + 4, p.y + 12, 4, { cols: Z.polvo, vy: -10, disp: 26, vida: 14, arrastre: 0.9 }); break;
      case 'saltoPared': A.sx = 0.8; A.sy = 1.2; FX.emitir(p.x + (e.d > 0 ? 0 : 8), p.y + 8, 5, { cols: Z.polvo, vx: e.d * 30, disp: 24, vida: 14 }); break;
      case 'aterriza': if ((e.fuerza || 0) > 220) { A.sx = 1.25; A.sy = 0.78; } FX.emitir(p.x + 4, p.y + 12, 2 + Math.round((e.fuerza || 0) / 120), { cols: Z.polvo, vy: -8, disp: 30, vida: 12, arrastre: 0.88 }); break;
      case 'dash': FX.temblar(1); FX.emitir(p.x + 4, p.y + 6, 8, { cols: ['#f6ffa8', '#c8e8ff', '#ffffff'], vx: -e.d * 80, disp: 30, vida: 14 }); break;
      case 'pega': FX.temblar(1.5); FX.emitir(e.x, e.y, 7, { cols: ['#ffffff', '#fff0c8', '#f6ffa8'], disp: 90, vida: 10, forma: 'linea' }); break;
      case 'pegaJefe': FX.temblar(2); FX.emitir(e.x, e.y, 9, { cols: ['#ffffff', '#ffd0a0', '#ff8a5a'], disp: 110, vida: 12, forma: 'linea' }); break;
      case 'bichoMuere': FX.emitir(e.x, e.y, 14, { cols: ['#ffffff', '#f6ffa8', '#8a82b0', '#5a4a6a'], disp: 80, g: 200, vida: 24, tam: 2 }); break;
      case 'bloqueo': FX.emitir(e.x, e.y, 8, { cols: ['#ffffff', '#d8d8ff'], disp: 100, vida: 8, forma: 'linea' }); break;
      case 'terron': FX.emitir(e.x, e.y, e.fin ? 16 : 5, { cols: ['#ffe08a', '#f0a03a', '#c86a1e'], disp: e.fin ? 90 : 50, g: 300, vida: 22 }); J.ambarMas += e.fin ? 6 : 1; break;
      case 'rompe': FX.temblar(3); FX.emitir(e.x, e.y, 18, { cols: [Z.madera, Z.maderaClara, Z.maderaOsc], g: 420, disp: 110, rx: (e.bw || 8) / 2, ry: (e.bh || 8) / 2, vida: 34, tam: 2 }); guardarLM(); break;
      case 'pogo': case 'pogoEspina': FX.emitir(p.x + 4, p.y + 14, 6, { cols: ['#ffffff', '#f6ffa8'], vy: 40, disp: 50, vida: 10 }); break;
      case 'dano':
        FX.temblar(4); A.flash = 3;
        FX.emitir(p.x + 4, p.y + 6, 12, { cols: ['#ffffff', '#1a1426', '#f6ffa8'], disp: 120, vida: 16, forma: 'linea' });
        break;
      case 'muere':
        J.muerte = { t: 0 };
        FX.temblar(6);
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; FX.emitir(p.x + 4, p.y + 6, 1, { col: i % 2 ? '#f6ffa8' : '#ffffff', vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, disp: 6, vida: 34, tam: 2, arrastre: 0.92 }); }
        break;
      case 'vuelve': FX.emitir(p.x + 4, p.y + 6, 8, { cols: ['#f6ffa8', '#ffffff'], disp: 40, vida: 14 }); break;
      case 'cura': FX.emitir(p.x + 4, p.y + 8, 12, { cols: ['#f6ffa8', '#ffffff', '#b4e858'], vy: -50, disp: 30, vida: 24 }); A.flash = 2; break;
      case 'banco':
        if (!J.sentada && Entrada.EDGE.arr) sentarse(m, e);
        break;
      case 'habla': if (Entrada.EDGE.arr && J.estado === 'jugando') hablar(e.quien); break;
      case 'chispaExtra':
        Prog.vidaMax = p.vidaMax; guardarLM();
        FX.emitir(e.x, e.y, 24, { cols: ['#f6ffa8', '#ffffff'], disp: 100, vida: 30 });
        J.hallazgos.push('chispaExtra');
        break;
      case 'ambar': J.ambarMas += 1; break;
      case 'rugido': FX.temblar(3); break;
      case 'aviso': FX.emitir(e.x, e.y - 4, 5, { cols: ['#ffffff', '#ff8a5a'], vy: -40, disp: 20, vida: 10 }); break;
      case 'choca': FX.temblar(6); FX.emitir(e.x, e.y, 16, { cols: [Z.madera, Z.maderaClara, '#b09070'], g: 380, disp: 120, vida: 30, tam: 2 }); break;
      case 'tierra': FX.temblar(4); FX.emitir(e.x, e.y, 12, { cols: Z.polvo, vy: -30, disp: 90, vida: 20 }); break;
      case 'carga': FX.emitir(m.jefe ? m.jefe.x + m.jefe.w / 2 : p.x, m.jefe ? m.jefe.y + m.jefe.h : p.y, 6, { cols: Z.polvo, disp: 40, vida: 16 }); break;
      case 'rocaCae': FX.emitir(e.x, e.y, 8, { cols: ['#7a5a3a', '#b09070'], g: 300, disp: 60, vida: 18 }); break;
      case 'jefeFase': FX.temblar(5); A.flash = 3; break;
      case 'jefeMuere':
        FX.temblar(9);
        for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; FX.emitir(e.x, e.y, 1, { col: i % 3 ? '#ffffff' : '#fff0a0', vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, disp: 20, vida: 40, tam: 2, arrastre: 0.93 }); }
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
  FX.emitir(e.x, e.y + 2, 14, { cols: ['#c8fff6', '#4ad8c8', '#ffffff'], vy: -30, disp: 40, vida: 28 });
  J.aviso = { txt: 'DESCANSASTE · LA PARTIDA SE GUARDÓ', t: 0, grad: GRAD.celeste };
  guardarLM();
}

/* ---------------- charlas y tienda ---------------- */
function avanceHistoria() { return (Prog.jefes.torito ? 1 : 0) + (Prog.jefes.viuda ? 1 : 0); }
function hablar(quien) {
  const charla = CHARLAS[quien];
  if (!charla || J.sinCharlas) return;
  const lineas = charla[Math.min(avanceHistoria(), charla.length - 1)];
  iniciarDialogoLM(lineas, quien === 'canasto' ? abrirTienda : null);
  Sonido.sfx('habla');
}
function iniciarDialogoLM(lineas, alTerminar) {
  J.dialogo = { lineas, i: 0, n: 0, alTerminar };
  J.estado = 'dialogo';
  J.sentada = false;
}
function pasarDialogoLM() {
  const d = J.dialogo, E = Entrada.EDGE, l = d.lineas[d.i];
  if (d.n < l.t.length) {
    const antes = Math.floor(d.n);
    d.n = Math.min(l.t.length, d.n + 0.8);
    if (Math.floor(d.n) !== antes && antes % 2 === 0 && l.t[antes] !== ' ') Sonido.sfx('texto', { f: { chispa: 880, mamboreta: 320, vaquita: 1040, canasto: 420, bolita: 560 }[l.q] || 600 });
  }
  if (E.salto || E.aceptar || E.golpe || J.toque) {
    if (d.n < l.t.length) d.n = l.t.length;
    else {
      d.i++; d.n = 0;
      if (d.i >= d.lineas.length) { J.dialogo = null; J.estado = 'jugando'; if (d.alTerminar) d.alTerminar(); }
    }
  }
  J.toque = false;
  pasarAnimLM(J.anim, J.mundo); FX.pasar();
}
function abrirTienda() {
  J.estado = 'tienda';
  mostrarMandosLM(false);
  armarTienda();
  UI.mostrar('capaTienda');
}
function armarTienda() {
  const p = J.mundo.p, lista = document.getElementById('listaTienda');
  document.getElementById('txtAmbar').textContent = 'TENÉS ' + p.ambar + ' DE ÁMBAR';
  delete document.getElementById('txtAmbar').dataset.pxk;
  lista.innerHTML = '';
  for (const it of TIENDA) {
    const b = document.createElement('button'), ya = Prog.compras[it.id];
    b.className = 'boton' + (ya || p.ambar < it.precio ? ' gris' : '');
    b.id = 'bT_' + it.id;
    b.textContent = ya ? it.nombre + ' · YA ES TUYO' : it.nombre + ' · ' + it.precio;
    b.addEventListener('click', () => comprar(it));
    lista.appendChild(b);
    const t = document.createElement('p'); t.className = 'txt'; t.textContent = it.txt; lista.appendChild(t);
  }
  UI.alPixelar(document.getElementById('capaTienda'));
}
function comprar(it) {
  const p = J.mundo.p;
  if (Prog.compras[it.id] || p.ambar < it.precio) { Sonido.sfx('nada'); return; }
  p.ambar -= it.precio; Prog.ambar = p.ambar; J.ambarVisto = p.ambar;
  Prog.compras[it.id] = true;
  if (it.id === 'corazon') Prog.vidaMax = p.vidaMax + 1;
  vestirChispa(p);
  if (it.id === 'corazon') p.vida = p.vidaMax;
  Sonido.sfx('compra');
  guardarLM();
  const sel = UI.sel;
  armarTienda();
  UI.sel = sel; UI.marcar();
}

/* ---------------- menús ---------------- */
function pausarLM() {
  J.estado = 'pausa';
  mostrarMandosLM(false);
  const p = J.mundo.p;
  document.getElementById('txtPausa').textContent = `${ZONAS[J.mundo.sala.zona].nombre.toUpperCase()} · ÁMBAR ${p.ambar} · ${reloj(Prog.tiempo)}`;
  UI.mostrar('capaPausa');
}
function seguirLM() { UI.ocultar(); J.estado = 'jugando'; mostrarMandosLM(true); }
function abrirMapa() { J.estado = 'mapa'; J.tMapa = 0; UI.ocultar(); mostrarMandosLM(false); }
function irPortadaLM() {
  J.estado = 'portada';
  mostrarMandosLM(false);
  Sonido.musica('titulo'); Sonido.ambiente('pueblo');
  const bc = document.getElementById('bContinuar');
  bc.classList.toggle('oculto', !Prog.empezada);
  const bn = document.getElementById('bNueva');
  bn.textContent = 'NUEVA PARTIDA'; delete bn.dataset.pxk; bn.dataset.seguro = '';
  UI.mostrar('capaTitulo');
}
function armarOpcionesLM() {
  const cont = document.getElementById('listaOpc');
  if (cont.dataset.listo) return;
  cont.dataset.listo = '1';
  const vels = [1, 0.9, 0.8, 0.7];
  const sube = (k) => () => { Opc[k] = lim(Math.round((Opc[k] + 0.1) * 10) / 10, 0, 1); };
  const baja = (k) => () => { Opc[k] = lim(Math.round((Opc[k] - 0.1) * 10) / 10, 0, 1); };
  const ops = [
    ['MUSICA', () => 'MÚSICA ' + barrita(Opc.musica), baja('musica'), sube('musica'), () => { Opc.musica = Opc.musica >= 1 ? 0 : lim(Math.round((Opc.musica + 0.1) * 10) / 10, 0, 1); }],
    ['EFECTOS', () => 'EFECTOS ' + barrita(Opc.efectos), baja('efectos'), sube('efectos'), () => { Opc.efectos = Opc.efectos >= 1 ? 0 : lim(Math.round((Opc.efectos + 0.1) * 10) / 10, 0, 1); }],
    ['TEMBLOR', () => 'TEMBLOR: ' + (Opc.temblor ? 'SÍ' : 'NO'), () => { Opc.temblor = !Opc.temblor; }, () => { Opc.temblor = !Opc.temblor; }],
    ['VELOCIDAD', () => 'VELOCIDAD: ' + Math.round(Opc.velocidad * 100) + '%', () => { Opc.velocidad = vels[Math.max(0, vels.indexOf(Opc.velocidad) - 1)]; }, () => { Opc.velocidad = vels[(vels.indexOf(Opc.velocidad) + 1) % vels.length]; }],
    ['INVENCIBLE', () => 'INVENCIBLE: ' + (Opc.invencible ? 'SÍ' : 'NO'), () => { Opc.invencible = !Opc.invencible; }, () => { Opc.invencible = !Opc.invencible; }],
  ];
  for (const [id, texto, izq, der, tocar] of ops) {
    const b = document.createElement('button');
    b.className = 'boton gris'; b.id = 'bOpc' + id;
    cont.appendChild(b);
    const y = (f) => () => { f(); aplicarOpcionesLM(); };
    UI.opcion(b, { texto, izq: y(izq), der: y(der), tocar: y(tocar || der) });
  }
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
  Transicion.iniciar('trama', 40, null, null, { col: '#fff8e0' });
}

/* motas que flotan en el aire: esporas en las raíces, pelusa de tela, polvo */
function motas(m) {
  if (Math.random() > 0.22) return;
  const Z = ZONA_ARTE[m.sala.zona], sube = m.sala.zona === 'raices' || m.sala.zona === 'hormiguero';
  FX.emitir(VistaLM.x + Math.random() * Pantalla.W, VistaLM.y + Math.random() * VistaLM.usable, 1,
    { cols: Z.polvo, vx: (Math.random() - 0.5) * 6, vy: sube ? -5 : 4, disp: 3, vida: 170, arrastre: 1, fondo: Math.random() < 0.6 });
}

/* ---------------- el bucle ---------------- */
function pasar() {
  Transicion.pasar();
  VistaLM.t += DT;
  const E = Entrada.EDGE;
  /* en los menús, el botón B del mando (que en el juego es el aleteo) vuelve */
  if (UI.actual && E.dash) E.volver = true;
  switch (J.estado) {
    case 'portada': case 'pausa': case 'tienda':
      UI.navegar();
      if (J.estado === 'tienda' && (E.pausa)) { UI.ocultar(); J.estado = 'jugando'; mostrarMandosLM(true); }
      break;
    case 'intro': {
      const I = J.intro;
      I.t += DT;
      const txt = INTRO[I.i];
      if (I.n < txt.length) { const a = Math.floor(I.n); I.n = Math.min(txt.length, I.n + 0.55); if (Math.floor(I.n) !== a && a % 3 === 0) Sonido.sfx('texto', { f: 700 }); }
      if (E.salto || E.aceptar || E.golpe || J.toque) {
        if (I.n < txt.length) I.n = txt.length;
        else if (++I.i >= INTRO.length) {
          J.intro = null;
          Transicion.iniciar('trama', 20, () => { cargarSalaLM('P1'); J.estado = 'jugando'; mostrarMandosLM(true); }, null);
          J.estado = 'cargando';
        } else I.n = 0;
      }
      J.toque = false;
      break;
    }
    case 'jugando':
      pasarJuego();
      if (J.mundo) { pasarAnimLM(J.anim, J.mundo); motas(J.mundo); FX.pasar(); ubicarLM(J.mundo); }
      if (J.finalPendiente && J.estado === 'jugando' && !J.hallazgos.length) { J.finalPendiente = false; Transicion.iniciar('trama', 50, empezarFinalLM, null, { col: '#fff8e0' }); J.estado = 'cargando'; }
      break;
    case 'dialogo': pasarDialogoLM(); break;
    case 'hallazgo':
      J.hallazgo.t += DT;
      if (J.hallazgo.t > 0.8 && (E.salto || E.aceptar || E.golpe || J.toque)) { J.hallazgo = null; J.estado = 'jugando'; }
      J.toque = false;
      FX.pasar();
      break;
    case 'mapa':
      J.tMapa += DT;
      if (J.tMapa > 0.2 && (E.mapa || E.pausa || E.salto || E.aceptar || E.volver || E.golpe || E.dash || J.toque)) { J.estado = 'jugando'; mostrarMandosLM(true); }
      J.toque = false;
      break;
    case 'final':
      J.final.t += DT;
      if (J.final.t > FINAL_LM.length * 4.5 + 2 && (E.salto || E.aceptar || J.toque)) irPortadaLM();
      J.toque = false;
      break;
  }
}
function dibujar() {
  const g = Pantalla.g;
  g.fillStyle = '#050308'; g.fillRect(0, 0, Pantalla.W, Pantalla.H);
  if (!J.mundo && J.estado === 'cargando') { /* negro mientras carga */ }
  else if (J.estado === 'portada' || (!J.mundo && J.estado !== 'intro' && J.estado !== 'final')) dibujarPortadaLM(g, VistaLM.t, !UI.actual || UI.actual === 'capaTitulo');
  else if (J.estado === 'intro') dibujarIntro(g, J, VistaLM.t);
  else if (J.estado === 'final') dibujarFinalLM(g, J, VistaLM.t);
  else if (J.estado === 'mapa') dibujarMapa(g, J, VistaLM.t);
  else {
    dibujarSalaLM(g, J, VistaLM.t);
    dibujarHUD(g, J, VistaLM.t);
    dibujarZonaNombre(g, J); dibujarCartelJefe(g, J); dibujarAvisoLM(g, J);
    dibujarDialogoLM(g, J, VistaLM.t);
    dibujarHallazgo(g, J, VistaLM.t);
    dibujarMuerte(g, J);
    if (J.estado === 'pausa' || J.estado === 'tienda') Trama.cubrir(g, 9, '#050308');
  }
  if (UI.actual && UI.actual !== 'capaTitulo' && J.estado === 'portada') Trama.cubrir(g, 10, '#050308');
  Transicion.dibujar(g);
}

/* ---------------- arranque ---------------- */
function arrancar() {
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('tactil');
  Pantalla.iniciar(document.getElementById('lienzo'), 180);
  prepararArte();
  Bucle.fijo = /[?&]fijo/.test(location.search);
  Entrada.mando = { 0: 'salto', 1: 'dash', 2: 'golpe', 3: 'curar', 4: 'dash', 5: 'dash', 6: 'curar', 7: 'golpe', 8: 'mapa', 9: 'pausa', 12: 'arr', 13: 'aba', 14: 'izq', 15: 'der' };
  Entrada.iniciarTeclado({
    ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arr', KeyW: 'arr', ArrowDown: 'aba', KeyS: 'aba',
    KeyZ: 'salto', Space: 'salto', KeyK: 'salto', KeyX: 'golpe', KeyJ: 'golpe', KeyC: 'dash', KeyL: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyV: 'curar', KeyI: 'curar', KeyQ: 'curar', KeyM: 'mapa', Tab: 'mapa', Enter: 'aceptar', Escape: 'pausa', KeyP: 'pausa', Backspace: 'volver',
  });
  Entrada.alUsar = (f) => { if (f === 'toque') { document.body.classList.add('tactil'); if (J.estado === 'jugando') mostrarMandosLM(true); } UI.marcar(); };
  Entrada.palanca(document.getElementById('zonaPalanca'), document.querySelector('#zonaPalanca .base'), document.querySelector('#zonaPalanca .perilla'));
  for (const [id, a, ic, col, S] of [['btSalto', 'salto', 'flecha', '#fff4c2', 4], ['btGolpe', 'golpe', 'espina', '#ffffff', 4], ['btDash', 'dash', 'viento', '#c8e8ff', 3], ['btCurar', 'curar', 'luz', '#f6ffa8', 3]]) {
    const b = document.getElementById(id);
    Entrada.boton(b, a);
    b.appendChild(iconoPx(ic, col, S));
  }
  document.getElementById('btPausa').appendChild(iconoPx('pausa', '#ffffff', 3));
  document.getElementById('btPausa').addEventListener('click', () => { if (J.estado === 'jugando' || J.estado === 'dialogo') pausarLM(); });
  document.getElementById('lienzo').addEventListener('pointerdown', () => { J.toque = true; });
  const despertar = () => { Sonido.arrancar(); aplicarOpcionesLM(); };
  addEventListener('pointerdown', despertar, { once: true });
  addEventListener('keydown', despertar, { once: true });
  UI.alSonar = (q) => Sonido.sfx(q);
  UI.alPixelar = (capa) => {
    capa.querySelectorAll('.boton').forEach((b) => pixelar(b, 3, { grad: b.classList.contains('gris') ? GRAD.gris : GRAD.blanco }));
    capa.querySelectorAll('h2').forEach((h) => pixelar(h, 3, { grad: GRAD[h.dataset.grad || 'verde'] }));
  };
  UI.conectar({
    bContinuar: () => empezarPartida(false),
    bNueva: () => {
      const b = document.getElementById('bNueva');
      if (Prog.empezada && !b.dataset.seguro) { b.dataset.seguro = '1'; b.textContent = '¿SEGURO? SE BORRA LA OTRA'; delete b.dataset.pxk; UI.alPixelar(document.getElementById('capaTitulo')); return; }
      empezarPartida(true);
    },
    bOpciones: () => { armarOpcionesLM(); UI.mostrar('capaOpciones', { apilar: true }); },
    bCreditos: () => UI.mostrar('capaCreditos', { apilar: true }),
    bOpcVolver: () => { if (!UI.volver()) irPortadaLM(); },
    bCredVolver: () => UI.volver(),
    bSeguir: seguirLM,
    bMapa: () => abrirMapa(),
    bPausaOpc: () => { armarOpcionesLM(); UI.mostrar('capaOpciones', { apilar: true }); },
    bSalir: () => { guardarLM(); irPortadaLM(); },
    bTiendaVolver: () => { UI.ocultar(); J.estado = 'jugando'; mostrarMandosLM(true); },
  });
  document.getElementById('creditosTxt').innerHTML = CREDITOS_LM.slice(1).map((c) => `<p class="txt">${c}</p>`).join('');
  aplicarOpcionesLM();
  irPortadaLM();
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
      J.sinCharlas = !!o.sinCharlas; Transicion.activa = false; J.cambiando = false;
      UI.ocultar();
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
  };
}
arrancar();
