/*
 * Truco: la mesa (GP1v1, GP2v2 y GP3v3 del original). Las reglas las lleva truco.js y la
 * computadora es truco-ia.js; esto es lo que se ve: el reparto, las cartas que van a la mesa, los
 * globos con lo que dice cada uno (las frases del original) y su voz, el tanteador de palitos, las
 * barras de cantos y las ventanas del envido, la flor y el fin del partido.
 *
 * Asientos del motor: 0 es el jugador; los equipos se alternan y el orden es el de las agujas del
 * reloj al revés (el 1 a la derecha del jugador).
 */
(function () {
  'use strict';
  const App = window.TrucoApp;
  const { fondo: fondoDe, el, pos, T, frases, elegir, espera, entre, img, tocar, vibrar, cartaUrl, avatarUrl, guardar, leer, miVoz, miNombre, miAvatar, aviso } = App.util;
  const Sonido = App.Sonido;
  const D = 'datos/';
  const AJ = App.AJ;

  // dónde se sienta cada uno: centro de la cara (debajo del recorte de arriba), tamaño, para qué
  // lado van el nombre, las cartas chicas y el globo, y dónde caen sus cartas en la mesa (las
  // medidas de las escenas GP1v1, GP2v2 y GP3v3; la mesa empieza en y=350)
  const LUGARES = {
    2: [null, { x: 1065, y: 280, k: 1, lado: 'der', mesa: { x: 240, y: 680, k: 0.5 } }],
    4: [null,
      { x: 1065, y: 967, k: 1, lado: 'der', mesa: { x: 880, y: 820, k: 0.45 } },
      { x: 1065, y: 280, k: 1, lado: 'der', mesa: { x: 640, y: 560, k: 0.42 } },
      { x: 135, y: 349, k: 1, lado: 'izq', mesa: { x: 280, y: 700, k: 0.45 } }],
    6: [null,
      { x: 1110, y: 756, k: 0.7, lado: 'der', mesa: { x: 900, y: 850, k: 0.38 } },
      { x: 1110, y: 381, k: 0.7, lado: 'der', mesa: { x: 870, y: 590, k: 0.36 } },
      { x: 556, y: 245, k: 0.7, lado: 'izq', mesa: { x: 560, y: 480, k: 0.34 } },
      { x: 90, y: 330, k: 0.7, lado: 'izq', mesa: { x: 290, y: 590, k: 0.36 } },
      { x: 90, y: 692, k: 0.7, lado: 'izq', mesa: { x: 300, y: 850, k: 0.38 } }],
  };
  const MIA = { x: 560, y: 940, k: 0.6 };
  const TEXTO_CANTO = { truco: 'TRUCO', retruco: 'QUIERO RETRUCO', valecuatro: 'QUIERO VALE CUATRO', envido: 'ENVIDO', realenvido: 'REAL ENVIDO',
    faltaenvido: 'FALTA ENVIDO', flor: 'FLOR', contraflor: 'CONTRAFLOR', contrafloralresto: 'CONTRAFLOR AL RESTO', quiero: 'QUIERO', noquiero: 'NO QUIERO', mazo: 'Me voy al mazo' };
  const FRASE_CANTO = { truco: 'truco', retruco: 'retruco', valecuatro: 'valecuatro', envido: 'envido', realenvido: 'realenvido', faltaenvido: 'faltaenvido',
    flor: 'flor', contraflor: 'contra_flor', contrafloralresto: 'contra_flor_al_resto', quiero: 'quiero', noquiero: 'noquiero', mazo: 'mazo' };
  const MATADORA = (c) => (c.num === 1 && (c.palo === 'espada' || c.palo === 'basto')) || (c.num === 7 && (c.palo === 'espada' || c.palo === 'oro'));
  const SONIDO_PALO = { espada: 'cardswords', basto: 'cardclubs', oro: 'cardgolds', copa: 'cardcups' };
  const tf = (x, y, k, r) => `translate(${(x - 225).toFixed(1)}px,${(y - 360).toFixed(1)}px) rotate(${(r || 0).toFixed(2)}deg) scale(${k.toFixed(3)})`;
  class Salida extends Error {}

  const Mesa = App.Mesa = {};
  let M = null;      // la partida que se está mostrando

  Mesa.pendiente = () => { const g = leer('truco.partida', {}); return g.cfg ? g : null; };
  Mesa.ofrecerReanudar = async (g) => {
    const quien = g.cfg.personajes.map((p) => p.name).join(', ');
    const r = await App.ventana({ titulo: T('restart_match'), msg: `Estabas jugando contra ${quien}.\n${g.puntos[0]} a ${g.puntos[1]}.`,
      botones: [{ texto: T('restart_match'), valor: 'si' }, { texto: T('abandon'), valor: 'no' }], afuera: false, atras: false }).promesa;
    if (r !== 'si') { guardar('truco.partida', {}); return; }
    await Mesa.jugar(g.cfg, g);
    if (g.cfg.tipo === 'gira') App.region(g.cfg.region); else App.menu('jugar');
  };

  // ── una partida: cfg = { tipo: 'rapida'|'gira', jugadores, puntos, flor, personajes[], region } ──
  Mesa.jugar = function (cfg, guardada) {
    return new Promise((terminar) => {
      const n = cfg.jugadores;
      const L = LUGARES[n];
      const mazo = AJ.mazo;
      const p = Truco.partida({ jugadores: n, puntos: cfg.puntos, flor: !!cfg.flor, mano: Math.floor(Math.random() * n), capitan: 0 });
      if (guardada) { p.puntos = guardada.puntos.slice(); p.mano = guardada.mano; }
      const est = (guardada && guardada.est) || { engEnvido: 0, engTruco: 0, manos: 0, comentarios: {} };
      const memorias = [{}, {}];
      const pj = [null].concat(cfg.personajes);   // pj[s]: el personaje del asiento s
      const vozDe = (s) => (s === 0 ? miVoz() : pj[s].voz);
      const nombreDe = (s) => (s === 0 ? miNombre() : pj[s].name.split(' ')[0]);
      let vivo = true;
      const listo = () => { if (!vivo) throw new Salida(); };
      const rapido = () => AJ.rapido;
      const pausa = async (lento, veloz) => { await espera(rapido() ? (veloz == null ? lento * 0.35 : veloz) : lento); listo(); };

      // ── la pantalla ──
      const P = el('div', 'pantalla mesa');
      const fondo = el('div', 'fondo', P);
      const region = App.regionDe(cfg.region) ? cfg.region : 'buenos-aires';
      fondoDe(fondo, `fondos/${region}.webp`);
      const capa = el('div', 'capa', P);
      const tablero = el('div', 'tablero', capa);
      el('div', 'sombra', tablero);
      const bebida = el('div', 'bebida', tablero);
      const ancho = region === 'buenos-aires' ? 368 : 300;
      pos(bebida, 443 - ancho / 2, 42 - 126 + 50, ancho, 253);
      fondoDe(bebida, `bebidas/${region}.webp`);
      const pila = el('div', 'pila', capa);
      pila.style.opacity = 0;
      const enMesa = el('div', 'abs', capa);     // las cartas jugadas (arriba de la mesa, abajo de las caras)
      enMesa.style.cssText = 'left:0;top:0;width:1200px;height:100%;pointer-events:none';
      const caras = el('div', 'abs', capa);
      caras.style.cssText = 'left:0;top:0;width:1200px;height:100%;pointer-events:none';
      const manoYo = el('div', 'mano-yo', capa);
      const globos = el('div', 'abs', capa);
      globos.style.cssText = 'left:0;top:0;width:1200px;height:100%;pointer-events:none;z-index:20';
      const hembra = AJ.sexo === 'mujer';
      const detras = el('div', 'detras', manoYo);
      detras.style.backgroundImage = `var(--u-hand_${hembra ? 'female' : 'male'}_b)`;
      const cartasMano = el('div', 'abs', manoYo);
      cartasMano.style.cssText = 'left:0;top:0;width:1200px;height:100%';
      const delante = el('div', 'delante', manoYo);
      delante.style.backgroundImage = `var(--u-hand_${hembra ? 'female' : 'male'}_f)`;

      // cabecera: atrás, los palitos, a cuánto se juega, con o sin flor, y el panel de ajustes
      const cab = el('div', 'cabecera', P);
      tocar(el('div', 'atras', cab), () => salir()).dataset.prueba = 'salir';
      const tant = el('div', 'tanteador', cab);
      const lados = [0, 1].map((eq) => {
        const lado = el('div', 'lado', tant);
        el('b', null, lado, eq === 0 ? (n === 2 ? 'Yo:' : T('we')) : (n === 2 ? 'Él:' : T('they')));
        const palitos = el('div', 'palitos', lado);
        const cajas = [0, 1, 2].map(() => el('i', null, palitos));
        const numero = el('div', 'numero', lado, '0');
        return { cajas, numero };
      });
      el('div', 'limite', cab, cfg.puntos);
      el('div', 'conflor', cab).style.backgroundImage = `var(--u-${cfg.flor ? 'Flor' : 'NoFlor'})`;
      tocar(el('div', 'charla', cab), () => App.abrirCostado()).dataset.prueba = 'ajustes';

      // las barras de abajo (BaseBar, EnvidoBar, FlorBar y ReplyBar)
      const barras = el('div', 'barras', P);
      const crearBarra = (botones) => {
        const b = el('div', 'barra fuera', barras);
        const bts = {};
        for (const [id, txt] of botones) {
          const x = el('div', 'bt texto-contorno', b);
          x.innerHTML = txt;
          x.dataset.prueba = id;
          tocar(x, () => apretar(id));
          bts[id] = x;
        }
        return { el: b, bts };
      };
      const base = crearBarra([['truco', 'Truco'], ['envido', 'Envido'], ['flor', 'Flor'], ['mazo', 'Mazo']]);
      const barEnvido = crearBarra([['b-envido', 'Envido'], ['b-realenvido', 'Real<br>Envido'], ['b-faltaenvido', 'Falta<br>Envido'], ['b-flor', 'Flor'], ['volver', 'Volver']]);
      const barFlor = crearBarra([['b-contraflor', 'Contra Flor'], ['b-contrafloralresto', 'Contra Flor<br>Al Resto']]);
      const resp = el('div', 'respuesta fuera', P);
      const btQuiero = el('div', 'bt texto-contorno', resp, 'Quiero');
      const btNoQuiero = el('div', 'bt texto-contorno', resp, 'No Quiero');
      btQuiero.dataset.prueba = 'quiero'; btNoQuiero.dataset.prueba = 'noquiero';
      tocar(btQuiero, () => apretar('quiero'));
      tocar(btNoQuiero, () => apretar('noquiero'));

      // las caras
      const av = [];
      function crearAvatar(s) {
        const yo = s === 0;
        const Lg = yo ? null : L[s];
        const a = el('div', 'avatar' + (s % 2 === 0 && !yo ? ' equipo' : ''), caras);
        const k = yo ? 1 : Lg.k;
        const foto = el('div', 'foto', a);
        img(avatarUrl(yo ? miAvatar() : pj[s].avatar), null, foto);
        el('div', 'aro', a);
        const r = { el: a, k, chicas: null, nombre: null, mano: el('div', 'es-mano oculto', a) };
        a.style.pointerEvents = 'auto';
        if (!yo) {
          const nom = el('div', 'nombre', a, nombreDe(s));
          r.nombre = nom;
          const ch = el('div', 'chicas', a);
          r.chicas = [0, 1, 2].map(() => el('i', null, ch));
          r.chicas.forEach((i) => { fondoDe(i, `cartas/${mazo}/dorso-chico.webp`); i.style.visibility = 'hidden'; });
          if (Lg.lado === 'der') {
            nom.style.right = '90px'; nom.style.top = '-12px'; nom.style.paddingRight = '120px'; nom.style.textAlign = 'right';
            ch.style.right = '225px'; ch.style.top = '105px'; ch.style.flexDirection = 'row';
            r.mano.style.left = '150px'; r.mano.style.top = '125px';
          } else {
            nom.style.left = '90px'; nom.style.top = '-12px'; nom.style.paddingLeft = '120px';
            ch.style.left = '225px'; ch.style.top = '105px';
            r.mano.style.left = '-45px'; r.mano.style.top = '125px';
          }
          nom.style.zIndex = -1;
          tocar(a, () => perfil(s));
        } else {
          r.mano.style.left = '-55px'; r.mano.style.top = '-45px';
        }
        a.style.transform = `scale(${k})`;
        av[s] = r;
      }
      for (let s = 0; s < n; s++) crearAvatar(s);

      // ── medidas que dependen del alto de la pantalla ──
      let alto = 0, kMano = 1, C = 0;
      function acomodar() {
        const m = App.medidas();
        alto = m.alto - m.sa.arriba;
        // la mano: en un teléfono largo (2600) como en el original; en uno más corto se achica
        kMano = Math.max(0.62, Math.min(1, (alto - 1250) / 1350));
        C = alto - 212 - m.sa.abajo - 590 * kMano;
        for (let s = 1; s < n; s++) pos(av[s].el, L[s].x - 100, L[s].y - 100);
        pos(av[0].el, 140 - 100, alto - m.sa.abajo - 212 - 150 - 100);
        av[0].el.style.zIndex = 6;
        pos(detras, 600 - 337 * kMano, C + 64 * kMano, 675 * kMano, 1246 * kMano);
        detras.style.marginLeft = '0';
        const fw = (hembra ? 415 : 522) * kMano, fh = (hembra ? 935 : 920) * kMano;
        pos(delante, 603 - fw / 2, C + 31 * kMano, fw, fh);
        delante.style.marginLeft = '0';
        manoYo.style.top = '0';
        manoYo.style.height = alto + 'px';
        for (const c of mano) if (c.el.parentNode === cartasMano) c.el.style.transform = transformMano(c.slot);
      }
      const transformMano = (slot) => tf(600 + (slot - 1) * 226 * kMano, C - (slot === 1 ? 40 : 0) * kMano, kMano, (slot - 1) * 8);

      // ── estado de la mano en pantalla ──
      let m = null;                 // la mano del motor
      let mano = [];                // mis cartas: { c, el, slot }
      const enLaMesa = [];          // cartas jugadas
      let resolverHumano = null;    // cuando le toca al jugador

      function nuevaCarta(c, tapada) {
        const e = el('div', 'carta' + (tapada ? ' tapada' : ''));
        if (c) { img(cartaUrl(c, mazo), 'cara', e); e.dataset.carta = c.id; }
        img(`${D}cartas/dorso.webp`, 'dorso', e);
        return e;
      }
      async function mover(e, a, b, ms, curva) {
        const an = e.animate([{ transform: a }, { transform: b }], { duration: ms, easing: curva || 'cubic-bezier(.2,.75,.3,1)' });
        e.style.transform = b;
        try { await an.finished; } catch (_) { /* cancelada */ }
      }

      // ── el tanteador ──
      function pintarPuntos(conNumero, eqCambio) {
        for (const eq of [0, 1]) {
          const pts = p.puntos[eq];
          const buenas = cfg.puntos === 30 && pts > 15;
          const base = buenas ? pts - 15 : pts;
          lados[eq].cajas.forEach((i, k) => {
            const c = Math.max(0, Math.min(5, base - 5 * k));
            i.style.backgroundImage = `var(--u-pts_${c === 0 ? 0 : buenas ? 5 + c : c})`;
          });
          lados[eq].numero.textContent = pts;
          if (conNumero && eq === eqCambio) {
            lados[eq].numero.classList.add('ver');
            setTimeout(() => lados[eq].numero.classList.remove('ver'), 1600);
          }
        }
        App.test.puntos = p.puntos.slice();
      }

      // ── los globos ──
      const globoDe = {};
      function globo(s, texto, grande, ms) {
        if (globoDe[s]) globoDe[s].remove();
        const yo = s === 0;
        const Lg = yo ? { x: 140, y: alto - App.medidas().sa.abajo - 212 - 150, k: 1, lado: 'izq' } : L[s];
        const g = el('div', 'globo' + (Lg.lado === 'izq' ? ' izq' : ''), globos);
        if (grande) el('span', 'grande', g, texto); else g.textContent = texto;
        if (yo) { g.style.left = '210px'; g.style.top = (Lg.y - 220) + 'px'; }
        else if (Lg.lado === 'der') { g.style.right = (1200 - (Lg.x - 380 * Lg.k)) + 'px'; g.style.top = (Lg.y - 95 * Lg.k - 40) + 'px'; }
        else { g.style.left = (Lg.x + 380 * Lg.k) + 'px'; g.style.top = (Lg.y - 95 * Lg.k - 40) + 'px'; }
        if (n === 6 && !yo) g.style.maxWidth = '520px';
        globoDe[s] = g;
        App.test.globos = (App.test.globos || []).concat([{ s, texto }]).slice(-30);
        const dura = ms || (rapido() ? 900 : Math.min(3800, 1300 + texto.length * 35));
        setTimeout(() => { g.classList.add('salir'); setTimeout(() => g.remove(), 300); if (globoDe[s] === g) delete globoDe[s]; }, dura);
        return g;
      }
      // lo que dice un personaje al cantar: en modo lento, alguna de sus frases (las primeras son el canto pelado)
      function fraseCanto(s, que, extra) {
        const base = FRASE_CANTO[que];
        let lista = frases(que === 'noquiero' && extra === 'flor' ? 'noquiero_flor' : base);
        if (!lista.length) return TEXTO_CANTO[que];
        if (s === 0 || rapido() || Math.random() < 0.45) return TEXTO_CANTO[que];
        return elegir(lista).replace('{0}', nombreDe(0));
      }
      function comentar(s, clave, prob, ...args) {
        if (rapido() || s === 0 || !pj[s]) return false;
        if (prob != null && Math.random() > prob) return false;
        const l = frases(clave);
        if (!l.length) return false;
        globo(s, elegir(l).replace(/\{(\d)(?::K)?\}/g, (x, i) => (args[+i] != null ? args[+i] : '')));
        return true;
      }

      // ── las cartas ──
      function lugarDeMesa(s, baza) {
        if (s === 0) return { x: MIA.x + baza * 80, y: MIA.y, k: MIA.k };
        const q = L[s].mesa;
        return { x: q.x + baza * (n === 6 ? 52 : 70), y: q.y, k: q.k };
      }
      function pintarChicas(s) {
        if (s === 0 || !m) return;
        av[s].chicas.forEach((i, k) => { i.style.visibility = k < m.cartas[s].length ? 'visible' : 'hidden'; });
      }
      function marcarTurno() {
        const q = m && !m.terminada ? m.quien() : null;
        av.forEach((a, s) => a.el.classList.toggle('turno', s === q));
      }

      async function repartir() {
        mano.forEach((c) => c.el.remove());
        mano = [];
        const dealer = (m.esMano - 1 + n) % n;
        // la pila del que reparte: el jugador abajo a la derecha; los demás, de su lado
        const deYo = dealer === 0;
        const px = deYo ? 980 : Math.max(120, Math.min(1080, L[dealer].x + (L[dealer].lado === 'der' ? -260 : 260)));
        const py = deYo ? 1100 : Math.max(420, L[dealer].y + 120);
        fondoDe(pila, `cartas/${mazo}/${deYo ? 'mazo-abajo' : 'mazo-arriba'}.webp`);
        pos(pila, px - 118, py - 120, 237, deYo ? 340 : 239);
        pila.style.opacity = 1;
        av.forEach((a, s) => a.mano.classList.toggle('oculto', s !== m.esMano));
        for (let s = 1; s < n; s++) av[s].chicas.forEach((i) => { i.style.visibility = 'hidden'; });
        Sonido.efecto('scroll', 0.5);
        const ms = rapido() ? 70 : n === 6 ? 90 : 130;
        for (let ronda = 0; ronda < 3; ronda++) {
          for (let k = 0; k < n; k++) {
            const s = (m.esMano + k) % n;
            const e = nuevaCarta(null, true);
            e.classList.add('volando');
            capa.appendChild(e);
            let hasta;
            if (s === 0) hasta = transformMano(ronda);
            else {
              const ch = av[s].chicas[ronda].getBoundingClientRect(), cr = capa.getBoundingClientRect();
              const e2 = App.medidas().escala;
              hasta = tf((ch.left + ch.width / 2 - cr.left) / e2, (ch.top + ch.height / 2 - cr.top) / e2, 0.14 * L[s].k * 1.0, 0);
            }
            const an = mover(e, tf(px, py, 0.32, 0), hasta, ms * 2.2);
            Sonido.efecto('whooshshort', 0.35);
            if (s === 0) {
              const c = m.iniciales[0][ronda];
              an.then(() => {
                e.remove();
                const carta = nuevaCarta(c, false);
                carta.style.transform = transformMano(ronda);
                carta.dataset.prueba = 'mano-' + ronda;
                cartasMano.appendChild(carta);
                const reg = { c, el: carta, slot: ronda };
                mano.push(reg);
                prepararCarta(reg);
              });
            } else {
              an.then(() => { e.remove(); av[s].chicas[ronda].style.visibility = 'visible'; });
            }
            await espera(ms); listo();
          }
        }
        await espera(ms * 2.4); listo();
        pila.style.opacity = 0;
        mano.sort((a, b) => a.slot - b.slot).forEach((c) => cartasMano.appendChild(c.el));
      }

      // tocar una carta (o arrastrarla para arriba) la tira, si es el turno de jugar
      function prepararCarta(reg) {
        const e = reg.el;
        let ini = null;
        e.addEventListener('pointerdown', (ev) => {
          if (!puedeJugar(reg)) return;
          ini = { x: ev.clientX, y: ev.clientY, t: performance.now() };
          try { e.setPointerCapture(ev.pointerId); } catch (_) {}
        });
        e.addEventListener('pointermove', (ev) => {
          if (!ini) return;
          const k = App.medidas().escala;
          const dx = (ev.clientX - ini.x) / k, dy = (ev.clientY - ini.y) / k;
          e.style.transform = transformMano(reg.slot) + ` translate(${dx / kMano}px,${dy / kMano}px)`;
        });
        const soltar = (ev) => {
          if (!ini) return;
          const k = App.medidas().escala;
          const dy = (ev.clientY - ini.y) / k, dx = (ev.clientX - ini.x) / k;
          ini = null;
          if (dy < -120 || Math.hypot(dx, dy) < 25) { jugarMia(reg); }
          else e.style.transform = transformMano(reg.slot);
        };
        e.addEventListener('pointerup', soltar);
        e.addEventListener('pointercancel', () => { ini = null; e.style.transform = transformMano(reg.slot); });
      }
      const puedeJugar = (reg) => resolverHumano && m && m.acciones(0).some((a) => a.tipo === 'jugar' && a.carta.id === reg.c.id);
      function jugarMia(reg) {
        if (!puedeJugar(reg)) return;
        vibrar(15);
        responder({ tipo: 'jugar', carta: reg.c });
      }

      async function cartaALaMesa(s, c, baza) {
        const q = lugarDeMesa(s, baza);
        const r = entre(-7, 7);
        let e;
        if (s === 0) {
          const reg = mano.find((x) => x.c.id === c.id);
          mano = mano.filter((x) => x !== reg);
          e = reg ? reg.el : nuevaCarta(c, false);
          e.dataset.prueba = 'mesa-' + c.id;
          const desde = e.style.transform || transformMano(1);
          enMesa.appendChild(e);
          e.classList.add('jugada');
          await mover(e, desde, tf(q.x, q.y, q.k, r), rapido() ? 170 : 260);
        } else {
          e = nuevaCarta(c, true);
          e.dataset.prueba = 'mesa-' + c.id;
          e.classList.add('jugada');
          enMesa.appendChild(e);
          const desde = tf(L[s].x, L[s].y, 0.16 * L[s].k, 0);
          const hasta = tf(q.x, q.y, q.k, r);
          const ms = rapido() ? 220 : 340;
          setTimeout(() => e.classList.remove('tapada'), ms * 0.45);
          await mover(e, desde, hasta, ms);
          pintarChicas(s);
        }
        enLaMesa.push({ s, c, el: e, baza });
        Sonido.efecto(MATADORA(c) ? 'cardspecial' : SONIDO_PALO[c.palo], 0.8);
      }

      // ── el turno del jugador ──
      function responder(acc) {
        if (!resolverHumano) return;
        const r = resolverHumano;
        resolverHumano = null;
        App.test.esperando = 'mostrando';
        esconderBarras();
        mano.forEach((c) => c.el.classList.remove('elegible'));
        r(acc);
      }
      // la barra de cantos queda siempre a la vista (como en el original), apagada cuando no le toca al jugador
      function esconderBarras() {
        [barEnvido, barFlor].forEach((b) => b.el.classList.add('fuera'));
        base.el.classList.remove('fuera');
        Object.values(base.bts).forEach((b) => b.classList.add('no'));
        resp.classList.add('fuera');
      }
      let accionesHumano = [];
      function apretar(id) {
        const acc = accionesHumano;
        const busca = (tipo, que) => acc.find((a) => a.tipo === tipo && a.que === que);
        if (id === 'envido') { mostrarBarra(barEnvido); return; }
        if (id === 'volver') { mostrarBarra(base); return; }
        if (id === 'flor') { const a = busca('cantar', 'flor'); if (a) responder(a); return; }
        if (id === 'truco') { const a = acc.find((x) => x.tipo === 'cantar' && ['truco', 'retruco', 'valecuatro'].includes(x.que)); if (a) responder(a); return; }
        if (id === 'mazo') { const a = acc.find((x) => x.tipo === 'mazo'); if (a) responder(a); return; }
        if (id.startsWith('b-')) { const a = busca('cantar', id.slice(2)); if (a) responder(a); return; }
        if (id === 'quiero' || id === 'noquiero') {
          if (resolverHumano && resolverHumano.charla) { const r = resolverHumano; resolverHumano = null; esconderBarras(); r(id === 'quiero'); return; }
          const a = busca('responder', id);
          if (a) responder(a);
        }
      }
      function mostrarBarra(b) {
        [base, barEnvido, barFlor].forEach((x) => x.el.classList.toggle('fuera', x !== b));
      }
      function pintarBarras(acc) {
        const hay = (tipo, que) => acc.some((a) => a.tipo === tipo && a.que === que);
        const truco = acc.find((x) => x.tipo === 'cantar' && ['truco', 'retruco', 'valecuatro'].includes(x.que));
        const t = truco ? truco.que : (m.truco.querido >= 3 ? 'valecuatro' : m.truco.querido === 2 ? 'retruco' : 'truco');
        base.bts.truco.innerHTML = { truco: 'Truco', retruco: 'Retruco', valecuatro: 'Vale<br>cuatro' }[t];
        base.bts.truco.classList.toggle('no', !truco);
        const envidos = ['envido', 'realenvido', 'faltaenvido'].filter((q) => hay('cantar', q));
        base.bts.envido.classList.toggle('no', !envidos.length);
        base.bts.flor.classList.toggle('no', !hay('cantar', 'flor'));
        base.bts.mazo.classList.toggle('no', !acc.some((a) => a.tipo === 'mazo'));
        for (const q of ['envido', 'realenvido', 'faltaenvido', 'flor']) barEnvido.bts['b-' + q].classList.toggle('no', !hay('cantar', q));
        barEnvido.bts.volver.classList.toggle('oculto', !!m.envido.pendiente);
        for (const q of ['contraflor', 'contrafloralresto']) barFlor.bts['b-' + q].classList.toggle('no', !hay('cantar', q));
        const quiero = hay('responder', 'quiero'), noquiero = hay('responder', 'noquiero');
        btQuiero.textContent = 'Quiero'; btNoQuiero.textContent = 'No Quiero';
        btQuiero.style.visibility = quiero ? 'visible' : 'hidden';
        resp.classList.toggle('fuera', !(quiero || noquiero));
        if (m.flor.pendiente) mostrarBarra(barFlor);
        else if (m.envido.pendiente) mostrarBarra(barEnvido);
        else mostrarBarra(base);
      }
      function turnoHumano() {
        return new Promise((resolver) => {
          resolverHumano = resolver;
          const acc = accionesHumano = m.acciones(0);
          App.test.acciones = acc.map((a) => a.tipo + ':' + (a.que || (a.carta && a.carta.id) || ''));
          App.test.esperando = 'jugador';
          // los puntos del envido se dicen solos: los que ganan, y si no, "son buenas"
          if (m.envido.estado === 'diciendo') {
            const d = acc.find((a) => a.tipo === 'decir');
            const sb = acc.find((a) => a.tipo === 'sonbuenas');
            const gana = m.envido.mejor === null || d.puntos > m.envido.mejor;
            setTimeout(() => responder(gana || !sb ? d : sb), rapido() ? 250 : 700);
            return;
          }
          mano.forEach((c) => c.el.classList.toggle('elegible', acc.some((a) => a.tipo === 'jugar' && a.carta.id === c.c.id)));
          pintarBarras(acc);
        });
      }
      // el compañero pregunta antes de cantar (2 vs 2 y 3 vs 3): "Cantá" o "Callado"
      function preguntarAlJugador(s, clave) {
        return new Promise((resolver) => {
          comentar(s, clave, 1) || globo(s, clave === 'ask_envido' ? '¿Canto el envido?' : '¿Canto el truco?');
          btQuiero.textContent = 'Cantá'; btNoQuiero.textContent = 'Callado';
          btQuiero.style.visibility = 'visible';
          resp.classList.remove('fuera');
          const r = (x) => resolver(x);
          r.charla = true;
          resolverHumano = r;
          App.test.esperando = 'charla';
        });
      }

      // ── la computadora ──
      async function turnoBot(s) {
        App.test.esperando = 'bot';
        marcarTurno();
        const perfilPj = pj[s];
        const t0 = performance.now();
        let acc = TrucoIA.decidir(m, s, perfilPj, memorias[s % 2], Math.random);
        // el compañero consulta antes de cantar por su cuenta (en primera, y no siempre)
        if (n > 2 && s % 2 === 0 && acc.tipo === 'cantar' && !m.truco.pendiente && !m.envido.pendiente && !m.flor.pendiente &&
            ['envido', 'realenvido', 'truco'].includes(acc.que) && !rapido() && Math.random() < 0.6) {
          await pausa(500);
          const si = await preguntarAlJugador(s, acc.que === 'truco' ? 'ask_truco' : 'ask_envido');
          listo();
          globo(0, si ? 'Cantá' : 'Callado', true, 900);
          await pausa(500);
          if (!si) {
            const orig = m.acciones;
            m.acciones = (x) => orig(x).filter((a) => !(a.tipo === 'cantar' && ['envido', 'realenvido', 'faltaenvido', 'truco'].includes(a.que)));
            try { acc = TrucoIA.decidir(m, s, perfilPj, memorias[s % 2], Math.random); } finally { m.acciones = orig; }
          }
        }
        const pensando = acc.tipo === 'jugar' ? entre(650, 1300) : entre(900, 1700);
        if (m.truco.pendiente && acc.tipo === 'responder' && Math.random() < 0.12) comentar(s, 'think', 1);
        const falta = (rapido() ? entre(220, 420) : pensando) - (performance.now() - t0);
        if (falta > 0) await espera(falta);
        listo();
        return acc;
      }

      // ── mostrar lo que pasó ──
      const dichos = [];      // los puntos dichos en el envido de esta mano, para la ventana
      async function presentar(evs, ctx) {
        for (const e of evs) {
          listo();
          App.test.log = (App.test.log || []).concat([{ tipo: e.tipo, s: e.s, que: e.que }]).slice(-80);
          switch (e.tipo) {
            case 'canto': {
              const txt = fraseCanto(e.s, e.que);
              globo(e.s, txt, txt === TEXTO_CANTO[e.que]);
              Sonido.voz(vozDe(e.s), e.que);
              if (e.s !== 0 && e.que === 'flor' && m.flor.cantaron.length === 1) Sonido.efecto('magicspell', 0.5);
              if (e.que === 'flor' && e.s === 0) comentar(1, 'luck', 0.5);
              await pausa(1250, 600);
              break;
            }
            case 'respuesta': {
              const txt = fraseCanto(e.s, e.que, ctx.flor ? 'flor' : null);
              globo(e.s, txt, txt === TEXTO_CANTO[e.que]);
              Sonido.voz(vozDe(e.s), e.que);
              await pausa(1000, 500);
              break;
            }
            case 'juega':
              await cartaALaMesa(e.s, e.carta, e.baza);
              if (e.s !== 0 && e.carta.num === 1 && e.carta.palo === 'espada') comentar(e.s, 'one_of_swords_win', 0.35);
              await pausa(260, 120);
              break;
            case 'baza': {
              if (e.ganador === 'parda') { aviso('Parda', 1100); Sonido.efecto('knock', 0.6); }
              else {
                const g = enLaMesa.find((x) => x.baza === e.baza && x.s === e.s);
                if (g) { g.el.classList.add('marcada'); setTimeout(() => g.el.classList.remove('marcada'), 900); }
              }
              await pausa(650, 260);
              break;
            }
            case 'envido-dice':
              dichos.push(e);
              globo(e.s, e.puntos === null ? 'Son buenas' : String(e.puntos), true);
              await pausa(1050, 500);
              break;
            case 'envido-fin':
            case 'flor-fin':
              await ventanaTanto(e);
              break;
            case 'puntos':
              pintarPuntos(true, e.equipo);
              Sonido.efecto('coin', 0.5);
              guardarPartida();      // si se cierra a mitad de la mano, los puntos ya ganados quedan
              break;
            case 'mazo': {
              const txt = fraseCanto(e.s, 'mazo');
              globo(e.s, txt, txt === TEXTO_CANTO.mazo);
              Sonido.voz(vozDe(e.s), 'mazo');
              if (e.s === 0) { mano.forEach((c) => { c.el.style.transition = 'opacity .3s'; c.el.style.opacity = 0; }); }
              else { av[e.s].chicas.forEach((i) => { i.style.visibility = 'hidden'; }); }
              await pausa(900, 400);
              break;
            }
            case 'fin-mano':
            case 'fin-partida':
              break;
            default:
          }
        }
      }

      // la ventana del envido y de la flor (ModalEnvido / ModalFlor)
      async function ventanaTanto(e) {
        const esFlor = e.tipo === 'flor-fin';
        const gane = e.ganador === 0;
        if (!e.querido) {
          // sin querer: un aviso corto con los puntos
          aviso(`${esFlor ? 'Flor' : 'Envido'}: ${e.puntos} ${e.puntos === 1 ? 'punto' : 'puntos'} para ${gane ? (n === 2 ? 'vos' : 'nosotros') : (n === 2 ? nombreDe(1) : 'ellos')}`, 1500);
          await pausa(900, 400);
          return;
        }
        let lineas = [];
        if (esFlor) {
          for (let s = 0; s < n; s++) if (m.conFlor(s)) lineas.push(`${s === 0 ? T('your_points') : nombreDe(s)}: ${Truco.florDe(m.iniciales[s])}`);
        } else {
          for (const d of dichos) lineas.push(`${d.s === 0 ? T('your_points') : nombreDe(d.s)}: ${d.puntos === null ? 'son buenas' : d.puntos}`);
        }
        Sonido.efecto(gane ? 'correctanswer' : 'wronganswer', 0.5);
        const v = App.ventana({ titulo: esFlor ? 'Flor' : 'Envido', sub: gane ? (n === 2 ? T('you_won') : T('you_won_22')) : (n === 2 ? T('you_lost') : T('you_lost_22')),
          msg: lineas.join('\n'), caja: esFlor ? 'caja' : 'modal', flor: esFlor, ancho: 857, botones: [{ texto: 'ACEPTAR', valor: 1 }], dura: rapido() ? 1800 : 3200 });
        await v.promesa; listo();
      }

      // al terminar la mano: las cartas que quedaron, a la vista un rato; los comentarios
      async function finDeMano() {
        App.test.esperando = 'fin-mano';
        marcarTurno();
        const fm = m.eventos.find((e) => e.tipo === 'fin-mano');
        // el que ganó el envido muestra sus cartas ("27 en mesa")
        const env = m.eventos.find((e) => e.tipo === 'envido-fin' && e.querido);
        if (env && env.de != null && env.de !== 0) comentar(env.de, 'show_cards_envido', 0.7, env.mejor);
        // los engaños del jugador (para los puntos de la Gira)
        for (const e of m.eventos) {
          if (e.tipo === 'envido-fin' && !e.querido && e.ganador === 0) {
            const quien = m.eventos.find((x) => x.tipo === 'canto' && ['envido', 'realenvido', 'faltaenvido'].includes(x.que));
            const mio = Truco.envidoDe(m.iniciales[0]);
            if (quien && quien.s % 2 === 0 && mio < 27) { est.engEnvido += Math.ceil((28 - mio) / 3); if (!rapido()) aviso(elegir(frases('lie')), 1600); }
          }
        }
        const trucoNo = m.eventos.find((e) => e.tipo === 'fin-mano' && e.por === 'truco-no-querido');
        if (trucoNo && trucoNo.ganador === 0) {
          const fuerza = Math.max(...m.iniciales[0].map(Truco.jerarquia));
          if (fuerza < 9) est.engTruco += 2 * Math.max(1, trucoNo.puntos);
        }
        // mostrar lo que les quedaba a los demás
        const mostradas = [];
        if (AJ.mostrar) {
          for (let s = 1; s < n; s++) {
            m.cartas[s].forEach((c, k) => {
              const e = nuevaCarta(c, false);
              e.classList.add('jugada');
              enMesa.appendChild(e);
              const ox = (L[s].lado === 'der' ? -1 : 1) * (260 + k * 70) * L[s].k;
              e.style.transform = tf(L[s].x + ox, L[s].y + 150 * L[s].k, 0.22 * L[s].k, 0);
              mostradas.push(e);
            });
            av[s].chicas.forEach((i) => { i.style.visibility = 'hidden'; });
          }
        }
        for (const e of [0, 1]) memorias[e] = TrucoIA.aprender(m, e, memorias[e]);
        await pausa(mostradas.length ? 1900 : 1200, mostradas.length ? 900 : 500);
        // levantar las cartas
        const todas = enLaMesa.map((x) => x.el).concat(mostradas).concat(mano.map((x) => x.el));
        todas.forEach((e) => { e.style.transition = 'opacity .35s'; e.style.opacity = 0; });
        Sonido.efecto('whoosh2', 0.4);
        await espera(380);
        todas.forEach((e) => e.remove());
        enLaMesa.length = 0;
        mano = [];
        dichos.length = 0;
        // comentarios de fin de mano
        if (p.ganador === null && n === 2) {
          const yo = p.puntos[0], el2 = p.puntos[1], lim = cfg.puntos;
          if (lim - el2 <= 3 && !est.comentarios.ganar) { est.comentarios.ganar = 1; comentar(1, 'about_to_win', 0.8); }
          else if (lim - yo <= 3 && !est.comentarios.perder) { est.comentarios.perder = 1; comentar(1, 'about_to_lose', 0.8); }
          else if (el2 - yo >= 8 && Math.random() < 0.25) comentar(1, pj[1].voz === 'malebritanico' ? 'gozar_british' : 'gozar', 1);
        }
        return fm;
      }

      // ── el partido ──
      async function correr() {
        acomodar();
        pintarPuntos();
        esconderBarras();
        Sonido.tema(elegir(['gameplaytheme', 'gameplaytheme2', 'gameplaytheme3']));
        for (let s = 1; s < n; s++) Sonido.precargarVoz(pj[s].voz);
        Sonido.precargarVoz(miVoz());
        await pausa(500, 200);
        while (p.ganador === null) {
          guardarPartida();
          m = p.nuevaMano();
          App.test.mano = m;
          est.manos++;
          await repartir();
          if (m.conFlor(0) && cfg.flor) aviso('¡Tenés flor!', 1400);
          while (!m.terminada) {
            listo();
            marcarTurno();
            const s = m.quien();
            const acc = s === 0 ? await turnoHumano() : await turnoBot(s);
            listo();
            const desde = m.eventos.length;
            const ctx = { flor: !!m.flor.pendiente };
            m.hacer(s, acc);
            await presentar(m.eventos.slice(desde), ctx);
          }
          await finDeMano();
        }
        guardar('truco.partida', {});
        return p.ganador;
      }
      function guardarPartida() {
        if (p.ganador !== null) return;
        guardar('truco.partida', { cfg, puntos: p.puntos.slice(), mano: p.mano, est });
      }

      // ── el fin ──
      function puntosGira(gane, abandono) {
        if (cfg.tipo !== 'gira') return null;
        const lim = cfg.puntos, mios = p.puntos[0], suyos = p.puntos[1];
        if (abandono) return { total: -Math.floor(lim / 2), detalle: [['Abandono', -Math.floor(lim / 2)]] };
        const d = [];
        d.push([T('point_type_current_points'), mios]);
        if (gane) d.push([T('point_type_won'), lim]);
        d.push([T('point_type_completed_game'), Math.floor(lim / 2)]);
        if (est.engEnvido) d.push([T('point_type_envido_lies'), est.engEnvido]);
        if (est.engTruco) d.push([T('point_type_truco_lies'), est.engTruco]);
        if (gane && suyos === 0) d.push([T('point_type_zapatero'), lim * 2]);
        if (gane && cfg.rankingRival && cfg.rankingYo && cfg.rankingRival < cfg.rankingYo) d.push([T('point_type_better_ranking'), Math.min(60, (cfg.rankingYo - cfg.rankingRival) * 10)]);
        if (gane && lim === 30 && suyos < 15) d.push([T('point_type_duerme_afuera'), 15]);
        return { total: d.reduce((a, x) => a + x[1], 0), detalle: d };
      }
      async function finDelPartido(ganador) {
        const gane = ganador === 0;
        App.test.esperando = 'fin-partida';
        Sonido.efecto(gane ? 'matchwin' : 'matchlose');
        if (gane) [0, 500, 1100].forEach((t, i) => setTimeout(() => Sonido.efecto('firework' + (i + 1), 0.6), t + 600));
        if (!gane) comentar(1, pj[1] && pj[1].voz === 'malebritanico' ? 'gozar_british' : 'gozar', 0.6);
        const pg = puntosGira(gane);
        let msg = cfg.tipo === 'gira' ? (gane ? T('matchend_msg_won_points') : T('matchend_msg_lose_points')) : (gane ? T('matchend_msg_won_nopoints') : T('matchend_msg_lose_nopoints'));
        if (pg) msg = pg.detalle.map(([t, v]) => `${t}: ${v > 0 ? '+' : ''}${v}`).join('\n') + `\nTotal: ${pg.total > 0 ? '+' : ''}${pg.total}`;
        const botones = cfg.tipo === 'gira' ? [{ texto: T('rematch').toUpperCase(), valor: 'revancha' }, { texto: T('continue').toUpperCase(), valor: 'salir' }]
          : [{ texto: T('rematch').toUpperCase(), valor: 'revancha' }, { texto: T('exit').toUpperCase(), valor: 'salir' }];
        const v = App.ventana({ titulo: T('matchend_title'), sub: gane ? T('matchend_subtitle_won') : T('matchend_subtitle_lose'), msg, ancho: 1015,
          flor: true, botones, afuera: false, atras: false });
        v.v.querySelector('.msg').style.fontSize = pg ? '54px' : '70px';
        const r = await v.promesa;
        return { gane, revancha: r === 'revancha', puntosGira: pg ? pg.total : 0, detalle: pg && pg.detalle, puntos: p.puntos.slice() };
      }

      async function salir() {
        const r = await App.ventana({ titulo: T('modal_abandon_match_title'), msg: T(p.puntos[0] + p.puntos[1] === 0 ? 'modal_abandon_match_body_3' : 'modal_abandon_match_body_1'),
          botones: [{ texto: T('abandon').toUpperCase(), valor: 'si' }, { texto: T('cancel').toUpperCase(), valor: 'no' }] }).promesa;
        if (r !== 'si' || !vivo) return;
        vivo = false;
        if (resolverHumano) { const x = resolverHumano; resolverHumano = null; x(null); }
        guardar('truco.partida', {});
        const pg = (p.puntos[0] + p.puntos[1]) > 0 ? puntosGira(false, true) : null;
        const res = { gane: false, abandono: true, puntosGira: pg ? pg.total : 0 };
        if (cfg.tipo === 'gira') App.acreditarGira(cfg, res);
        cerrar(res);
      }
      function perfil(s) {
        const x = pj[s];
        App.ventana({ titulo: x.name, msg: x.description, x: true, ancho: 1000, caja: 'modal', firu: false, relleno: '70px 50px 50px' })
          .v.querySelector('.msg').style.cssText += ';font:46px/1.3 Tit3,sans-serif;max-height:1200px;overflow-y:auto;text-align:left';
      }
      let cerrado = false;
      function cerrar(res) {
        if (cerrado) return;
        cerrado = true;
        vivo = false;
        App.alEncajar = null;
        M = null;
        App.test.esperando = null;
        terminar(res);
      }

      const pant = App.mostrar(P, 'mesa');
      pant.atras = () => salir();
      pant.salir = () => { vivo = false; };
      App.alEncajar = acomodar;
      M = { cfg, p };
      App.test.partida = p;
      (async () => {
        try {
          const g = await correr();
          const res = await finDelPartido(g);
          if (cfg.tipo === 'gira') App.acreditarGira(cfg, res);
          if (res.revancha) {
            cerrado = true;
            vivo = false;
            terminar(await Mesa.jugar(cfg));
            return;
          }
          cerrar(res);
        } catch (e) {
          if (!(e instanceof Salida)) { console.error(e); cerrar({ error: String(e) }); }
        }
      })();
    });
  };
})();
