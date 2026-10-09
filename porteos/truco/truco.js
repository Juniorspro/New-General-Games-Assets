/*
 * Truco argentino: las reglas. Sin pantalla ni azar propio (el mazo se mezcla con la función que
 * se le pase), así se prueba solo en Node y la página lo usa igual.
 *
 *   const p = Truco.partida({ jugadores: 2, puntos: 30, flor: true });
 *   const m = p.nuevaMano();            // reparte; m.quien() dice quién tiene que decidir
 *   m.acciones(i)                       // lo que puede hacer el asiento i ahora
 *   m.hacer(i, { tipo: 'cantar', que: 'truco' })   // y los eventos de m.eventos para la pantalla
 *
 * Asientos: 0 es el jugador; los equipos se alternan (0, 2, 4 contra 1, 3, 5). El orden de juego
 * es el de los asientos. La mano rota de a uno por cada mano jugada.
 */
(function (raiz) {
  'use strict';

  const PALOS = ['espada', 'basto', 'oro', 'copa'];
  const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

  const carta = (palo, num) => ({ palo, num, id: palo + '-' + num });
  const mazoNuevo = () => PALOS.flatMap((p) => NUMEROS.map((n) => carta(p, n)));

  // jerarquía del truco: 14 el ancho de espada … 1 los cuatros
  function jerarquia(c) {
    if (c.num === 1 && c.palo === 'espada') return 14;
    if (c.num === 1 && c.palo === 'basto') return 13;
    if (c.num === 7 && c.palo === 'espada') return 12;
    if (c.num === 7 && c.palo === 'oro') return 11;
    return { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 }[c.num];
  }
  const valorEnvido = (c) => (c.num <= 7 ? c.num : 0);

  // el envido de una mano (de hasta 3 cartas): dos del mismo palo suman 20 más sus valores; si no, la más alta
  function envidoDe(cartas) {
    let mejor = 0;
    for (const c of cartas) mejor = Math.max(mejor, valorEnvido(c));
    for (let i = 0; i < cartas.length; i++) {
      for (let j = i + 1; j < cartas.length; j++) {
        if (cartas[i].palo === cartas[j].palo) mejor = Math.max(mejor, 20 + valorEnvido(cartas[i]) + valorEnvido(cartas[j]));
      }
    }
    return mejor;
  }
  const tieneFlor = (cartas) => cartas.length === 3 && cartas.every((c) => c.palo === cartas[0].palo);
  const florDe = (cartas) => 20 + cartas.reduce((a, c) => a + valorEnvido(c), 0);

  // lo que vale cada canto del envido, y lo que se lleva el que cantó si no le quieren
  const VALOR_ENVIDO = { envido: 2, realenvido: 3 };

  function mezclar(cartas, azar) {
    const a = cartas.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── la partida ────────────────────────────────────────────────────────────────────────
  function partida(cfg) {
    const c = Object.assign({ jugadores: 2, puntos: 30, flor: false, azar: Math.random, mano: 0, mazoExtra: true, capitan: 0 }, cfg || {});
    const p = {
      cfg: c,
      puntos: [0, 0],
      mano: c.mano % c.jugadores,       // quién es mano en la mano que viene
      manos: 0,
      ganador: null,                    // equipo que ganó la partida
      actual: null,
      // los puntos que vale la falta: lo que le falta al que va ganando para llegar
      falta() { return c.puntos - Math.max(p.puntos[0], p.puntos[1]); },
      sumar(equipo, cuantos, por, eventos) {
        if (p.ganador !== null || cuantos <= 0) return;
        p.puntos[equipo] = Math.min(c.puntos, p.puntos[equipo] + cuantos);
        eventos.push({ tipo: 'puntos', equipo, cuantos, por, total: p.puntos.slice() });
        if (p.puntos[equipo] >= c.puntos) {
          p.ganador = equipo;
          eventos.push({ tipo: 'fin-partida', ganador: equipo, total: p.puntos.slice() });
        }
      },
      nuevaMano(repartidas) {
        if (p.ganador !== null) throw new Error('la partida terminó');
        const m = mano(p, repartidas);
        p.actual = m;
        p.manos++;
        p.mano = (p.mano + 1) % c.jugadores;
        return m;
      },
    };
    return p;
  }

  // ── una mano ──────────────────────────────────────────────────────────────────────────
  function mano(p, repartidas) {
    const c = p.cfg, n = c.jugadores;
    const equipo = (s) => s % 2;
    const sig = (s) => (s + 1) % n;
    const esMano = p.mano;
    let cartas = repartidas;
    if (!cartas) {
      const m = mezclar(mazoNuevo(), c.azar);
      cartas = Array.from({ length: n }, (_, s) => [0, 1, 2].map((k) => m[k * n + ((s - esMano + n) % n)]));
    }
    const m = {
      p, n, equipo,
      esMano,
      cartas: cartas.map((cs) => cs.slice()),          // las que le quedan en la mano a cada uno
      iniciales: cartas.map((cs) => cs.slice()),
      bazas: [[], [], []],                              // [{s, carta}] por baza
      resultado: [null, null, null],                    // equipo que ganó cada baza, o 'parda'
      baza: 0,
      empieza: esMano,                                  // quién abre la baza actual
      turno: esMano,
      truco: { querido: 1, cantado: 1, puede: null, pendiente: null },
      envido: { estado: 'libre', cadena: [], quien: null, pendiente: null, puntos: {}, ganador: null },
      flor: { estado: c.flor ? 'libre' : 'no', cantaron: [], pendiente: null, cadena: [], ganador: null },
      cantoPrimero: null,                               // un canto que espera mientras se resuelve el envido o la flor
      terminada: false,
      ganadorMano: null,
      eventos: [],
      // quién tiene que decidir ahora
      quien() {
        if (m.terminada) return null;
        const pend = m.flor.pendiente || m.envido.pendiente || m.truco.pendiente;
        if (pend) return pend.responde;
        if (m.envido.estado === 'diciendo') return m.envido.dice;
        return m.turno;
      },
    };

    // ── consultas ──
    const jugoEnBaza = (s, b) => m.bazas[b].some((x) => x.s === s);
    const rivalesDe = (s) => Array.from({ length: n }, (_, i) => i).filter((i) => equipo(i) !== equipo(s));
    // el que responde por el otro equipo: el jugador (capitán) si es de ese equipo; si no, el
    // primero de ellos que viene después del que cantó
    function respondeA(s) {
      if (equipo(c.capitan) !== equipo(s)) return c.capitan;
      let r = sig(s);
      while (equipo(r) === equipo(s)) r = sig(r);
      return r;
    }
    const envidoAbierto = () => m.baza === 0 && m.envido.estado === 'libre' && m.flor.estado !== 'cantada' && m.flor.estado !== 'cerrada';
    // se puede cantar envido hasta tirar la carta de primera (el último de la baza, antes de tirarla),
    // y no después de querer el truco
    const puedeEnvido = (s) => envidoAbierto() && !jugoEnBaza(s, 0) && !m.truco.pendiente && m.truco.querido === 1;
    const conFlor = (s) => c.flor && tieneFlor(m.iniciales[s]);
    const puedeFlor = (s) => c.flor && m.baza === 0 && conFlor(s) && !jugoEnBaza(s, 0) && !m.flor.cantaron.includes(s) &&
      (m.flor.estado === 'libre' || m.flor.estado === 'cantada');

    function acciones(s) {
      const out = [];
      if (m.terminada || m.quien() !== s) return out;
      // responder un canto de flor
      if (m.flor.pendiente) {
        const f = m.flor.pendiente;
        const ult = f.que;
        if (ult === 'flor') {
          out.push({ tipo: 'cantar', que: 'contraflor' }, { tipo: 'cantar', que: 'contrafloralresto' }, { tipo: 'responder', que: 'noquiero' });
        } else {
          out.push({ tipo: 'responder', que: 'quiero' }, { tipo: 'responder', que: 'noquiero' });
          if (ult === 'contraflor') out.push({ tipo: 'cantar', que: 'contrafloralresto' });
        }
        return out;
      }
      // responder el envido
      if (m.envido.pendiente) {
        out.push({ tipo: 'responder', que: 'quiero' }, { tipo: 'responder', que: 'noquiero' });
        const cad = m.envido.cadena;
        if (cad.filter((x) => x === 'envido').length < 2 && !cad.includes('realenvido') && !cad.includes('faltaenvido')) out.push({ tipo: 'cantar', que: 'envido' });
        if (!cad.includes('realenvido') && !cad.includes('faltaenvido')) out.push({ tipo: 'cantar', que: 'realenvido' });
        if (!cad.includes('faltaenvido')) out.push({ tipo: 'cantar', que: 'faltaenvido' });
        if (puedeFlor(s)) out.push({ tipo: 'cantar', que: 'flor' });
        return out;
      }
      // decir los puntos del envido
      if (m.envido.estado === 'diciendo') {
        out.push({ tipo: 'decir', puntos: envidoDe(m.iniciales[s]) });
        if (m.envido.mejor !== null && equipo(m.envido.mejorDe) !== equipo(s)) out.push({ tipo: 'sonbuenas' });
        return out;
      }
      // responder el truco
      if (m.truco.pendiente) {
        const t = m.truco.pendiente;
        out.push({ tipo: 'responder', que: 'quiero' }, { tipo: 'responder', que: 'noquiero' });
        if (t.nivel < 4) out.push({ tipo: 'cantar', que: ['', '', 'truco', 'retruco', 'valecuatro'][t.nivel + 1] });
        // "el envido está primero": en primera, antes de tirar, se puede contestar el truco con el envido o la flor
        if (t.nivel === 2 && m.truco.querido === 1 && envidoAbierto() && !jugoEnBaza(s, 0) && !(c.flor && conFlor(s))) {
          for (const q of ['envido', 'realenvido', 'faltaenvido']) out.push({ tipo: 'cantar', que: q });
        }
        if (puedeFlor(s)) out.push({ tipo: 'cantar', que: 'flor' });
        out.push({ tipo: 'mazo' });
        return out;
      }
      // su turno de jugar
      for (const k of m.cartas[s]) out.push({ tipo: 'jugar', carta: k });
      if (puedeFlor(s)) out.push({ tipo: 'cantar', que: 'flor' });
      // con flor en la mesa no hay envido
      if (puedeEnvido(s) && m.flor.estado !== 'cantada' && !(c.flor && m.flor.estado !== 'no' && conFlor(s))) {
        for (const q of ['envido', 'realenvido', 'faltaenvido']) out.push({ tipo: 'cantar', que: q });
      }
      const t = m.truco;
      if (t.querido < 4 && (t.puede === null || t.puede === equipo(s))) out.push({ tipo: 'cantar', que: ['', 'truco', 'retruco', 'valecuatro'][t.querido] });
      out.push({ tipo: 'mazo' });
      return out;
    }

    const igual = (a, b) => a.tipo === b.tipo && a.que === b.que && (!a.carta || !b.carta || a.carta.id === b.carta.id);
    function hacer(s, acc) {
      if (m.terminada) throw new Error('la mano terminó');
      const legales = acciones(s);
      if (!legales.some((a) => igual(a, acc))) throw new Error(`acción no válida para ${s}: ${JSON.stringify(acc)} (válidas: ${legales.map((a) => a.que || (a.carta && a.carta.id) || a.tipo).join(', ')})`);
      const ev = m.eventos;
      if (acc.tipo === 'jugar') return jugar(s, acc.carta);
      if (acc.tipo === 'mazo') {
        ev.push({ tipo: 'mazo', s });
        // el truco no querido o la mano: se lleva lo que valía; antes del envido en primera, uno más
        let pts = m.truco.querido;
        const extra = c.mazoExtra && m.baza === 0 && m.envido.estado === 'libre' && m.flor.estado !== 'cantada' && m.flor.estado !== 'cerrada' && !jugoEnBaza(s, 0);
        if (m.truco.pendiente && equipo(m.truco.pendiente.canta) !== equipo(s)) pts = m.truco.pendiente.nivel - 1;
        terminar(1 - equipo(s), pts + (extra ? 1 : 0), 'mazo');
        return;
      }
      if (acc.tipo === 'cantar') return cantar(s, acc.que);
      if (acc.tipo === 'responder') return responder(s, acc.que);
      if (acc.tipo === 'decir' || acc.tipo === 'sonbuenas') return decir(s, acc.tipo === 'decir');
    }

    function cantar(s, que) {
      const ev = m.eventos;
      ev.push({ tipo: 'canto', s, que });
      if (que === 'flor' || que === 'contraflor' || que === 'contrafloralresto') return cantarFlor(s, que);
      if (que === 'envido' || que === 'realenvido' || que === 'faltaenvido') {
        // el envido canta encima de un truco pendiente: el truco espera
        if (m.truco.pendiente && !m.cantoPrimero) { m.cantoPrimero = m.truco.pendiente; m.truco.pendiente = null; }
        m.envido.cadena.push(que);
        m.envido.estado = 'cantando';
        if (m.envido.quien === null) m.envido.quien = s;
        m.envido.pendiente = { canta: s, responde: respondeA(s), que };
        return;
      }
      // truco, retruco, vale cuatro (también como respuesta que sube)
      const nivel = { truco: 2, retruco: 3, valecuatro: 4 }[que];
      if (m.truco.pendiente) m.truco.querido = m.truco.pendiente.nivel;      // subir es querer lo anterior
      m.truco.cantado = nivel;
      m.truco.pendiente = { canta: s, responde: respondeA(s), nivel };
    }

    function responder(s, que) {
      const ev = m.eventos;
      ev.push({ tipo: 'respuesta', s, que });
      if (m.flor.pendiente) return responderFlor(s, que);
      if (m.envido.pendiente) {
        const e = m.envido, cad = e.cadena, canta = e.pendiente.canta;
        e.pendiente = null;
        if (que === 'noquiero') {
          // se lleva lo querido hasta el canto anterior (o 1 si fue el primero)
          const pts = cad.length === 1 ? 1 : cad.slice(0, -1).reduce((a, q) => a + (q === 'faltaenvido' ? p.falta() : VALOR_ENVIDO[q]), 0);
          e.estado = 'cerrado';
          ev.push({ tipo: 'envido-fin', ganador: equipo(canta), puntos: pts, querido: false });
          p.sumar(equipo(canta), pts, 'envido', ev);
          return seguirDespuesDelEnvido();
        }
        // querido: se dicen los puntos, empezando por la mano
        e.valor = cad.includes('faltaenvido') ? p.falta() : cad.reduce((a, q) => a + VALOR_ENVIDO[q], 0);
        e.estado = 'diciendo';
        e.dice = esMano;
        e.mejor = null; e.mejorDe = null; e.dijeron = [];
        return;
      }
      if (m.truco.pendiente) {
        const t = m.truco.pendiente;
        m.truco.pendiente = null;
        if (que === 'noquiero') return terminar(equipo(t.canta), t.nivel - 1, 'truco-no-querido');
        m.truco.querido = t.nivel;
        m.truco.puede = equipo(s);          // el que quiso es el que puede subir
        return;
      }
    }

    // los puntos del envido, en orden desde la mano; los de cada equipo dicen sólo si le ganan al otro
    function decir(s, conPuntos) {
      const e = m.envido, ev = m.eventos;
      const pts = envidoDe(m.iniciales[s]);
      e.dijeron.push(s);
      if (conPuntos) {
        ev.push({ tipo: 'envido-dice', s, puntos: pts });
        // a igual puntos gana el más cerca de la mano (el que lo dijo antes)
        if (e.mejor === null || pts > e.mejor) { e.mejor = pts; e.mejorDe = s; }
      } else {
        ev.push({ tipo: 'envido-dice', s, puntos: null });
      }
      // el que sigue: el próximo en orden que todavía no habló y cuyo equipo va perdiendo
      let x = s;
      for (let k = 0; k < n; k++) {
        x = sig(x);
        if (e.dijeron.includes(x)) continue;
        if (e.mejor !== null && equipo(x) === equipo(e.mejorDe)) continue;
        e.dice = x;
        return;
      }
      // todos hablaron
      const g = equipo(e.mejorDe);
      e.ganador = g; e.estado = 'cerrado';
      ev.push({ tipo: 'envido-fin', ganador: g, puntos: e.valor, querido: true, mejor: e.mejor, de: e.mejorDe });
      p.sumar(g, e.valor, 'envido', ev);
      seguirDespuesDelEnvido();
    }

    function seguirDespuesDelEnvido() {
      if (p.ganador !== null) { m.terminada = true; m.ganadorMano = p.ganador; m.eventos.push({ tipo: 'fin-mano', ganador: p.ganador, por: 'partida' }); return; }
      if (m.cantoPrimero) { m.truco.pendiente = m.cantoPrimero; m.cantoPrimero = null; }
    }

    // ── la flor ──
    function cantarFlor(s, que) {
      const f = m.flor, ev = m.eventos;
      if (que === 'flor') {
        f.cantaron.push(s);
        // la flor anula el envido que se estaba cantando, y deja el truco esperando
        if (m.envido.pendiente || m.envido.estado === 'cantando') { m.envido.pendiente = null; m.envido.estado = 'cerrado'; m.envido.anulado = true; }
        if (m.envido.estado === 'libre') m.envido.estado = 'cerrado';
        if (m.truco.pendiente && !m.cantoPrimero) { m.cantoPrimero = m.truco.pendiente; m.truco.pendiente = null; }
        f.estado = 'cantada';
        // si el otro equipo tiene flor, contesta; si no, se suma al final de la primera
        const rivalConFlor = rivalesDe(s).filter((r) => conFlor(r) && !f.cantaron.includes(r));
        if (rivalConFlor.length && !f.cadena.length) {
          f.cadena.push('flor');
          f.pendiente = { canta: s, responde: rivalConFlor.includes(c.capitan) ? c.capitan : rivalConFlor[0], que: 'flor' };
        }
        return seguirDespuesDeLaFlor();
      }
      // contraflor / contraflor al resto
      f.cadena.push(que);
      f.pendiente = { canta: s, responde: respondeAFlor(s), que };
    }
    function respondeAFlor(s) {
      // contesta uno del otro equipo con flor (el jugador, si la tiene)
      const conF = rivalesDe(s).filter((r) => conFlor(r));
      if (conF.includes(c.capitan)) return c.capitan;
      return conF.length ? conF[0] : respondeA(s);
    }
    function responderFlor(s, que) {
      const f = m.flor, ev = m.eventos, ult = f.pendiente.que, canta = f.pendiente.canta;
      f.pendiente = null;
      if (que === 'noquiero') {
        // "con flor me achico": a la flor, 4 para el que la cantó; a la contraflor, 4 + ...; al resto, 6
        const pts = ult === 'flor' ? 4 : ult === 'contraflor' ? 5 : (f.cadena.includes('contraflor') ? 6 : 4);
        f.estado = 'cerrada'; f.ganador = equipo(canta);
        ev.push({ tipo: 'flor-fin', ganador: equipo(canta), puntos: pts, querido: false });
        p.sumar(equipo(canta), pts, 'flor', ev);
        return seguirDespuesDeLaFlor(true);
      }
      // querida: gana la flor más alta (a igual, la más cerca de la mano)
      let mejor = -1, de = null;
      for (let k = 0; k < n; k++) {
        const x = (esMano + k) % n;
        if (conFlor(x) && florDe(m.iniciales[x]) > mejor) { mejor = florDe(m.iniciales[x]); de = x; }
      }
      const pts = f.cadena.includes('contrafloralresto') ? p.falta() : 6;
      f.estado = 'cerrada'; f.ganador = equipo(de);
      ev.push({ tipo: 'flor-fin', ganador: equipo(de), puntos: pts, querido: true, mejor, de });
      p.sumar(equipo(de), pts, 'flor', ev);
      seguirDespuesDeLaFlor(true);
    }
    // sin contraflor, cada flor cantada vale 3 para su equipo (se suman al cerrar la primera)
    function seguirDespuesDeLaFlor(resuelta) {
      if (p.ganador !== null) { m.terminada = true; m.ganadorMano = p.ganador; m.eventos.push({ tipo: 'fin-mano', ganador: p.ganador, por: 'partida' }); return; }
      if (!m.flor.pendiente && m.cantoPrimero) { m.truco.pendiente = m.cantoPrimero; m.cantoPrimero = null; }
    }
    function cerrarFlores() {
      const f = m.flor;
      if (f.estado !== 'cantada') return;
      // las flores cantadas que nadie contestó
      const porEquipo = [0, 0];
      for (const s of f.cantaron) porEquipo[equipo(s)] += 3;
      f.estado = 'cerrada';
      for (const e of [0, 1]) if (porEquipo[e]) {
        m.eventos.push({ tipo: 'flor-fin', ganador: e, puntos: porEquipo[e], querido: null });
        p.sumar(e, porEquipo[e], 'flor', m.eventos);
      }
    }

    // ── tirar una carta ──
    function jugar(s, k) {
      const ev = m.eventos;
      m.cartas[s] = m.cartas[s].filter((x) => x.id !== k.id);
      m.bazas[m.baza].push({ s, carta: k });
      ev.push({ tipo: 'juega', s, carta: k, baza: m.baza });
      // el que tira sin cantar su flor la pierde
      if (m.baza === 0 && m.bazas[0].length === n) {
        cerrarFlores();
        if (m.envido.estado === 'libre') m.envido.estado = 'cerrado';
        if (p.ganador !== null) return seguirDespuesDeLaFlor();
      }
      if (m.bazas[m.baza].length < n) { m.turno = sig(s); return; }
      // terminó la baza
      const jug = m.bazas[m.baza];
      const alto = Math.max(...jug.map((x) => jerarquia(x.carta)));
      const altos = jug.filter((x) => jerarquia(x.carta) === alto);
      const equipos = new Set(altos.map((x) => equipo(x.s)));
      const r = equipos.size > 1 ? 'parda' : equipo(altos[0].s);
      m.resultado[m.baza] = r;
      ev.push({ tipo: 'baza', baza: m.baza, ganador: r, s: r === 'parda' ? null : altos[0].s });
      const g = ganadorDeBazas();
      if (g !== null) return terminar(g, m.truco.querido, 'bazas');
      // la siguiente la abre el que ganó (con parda, el mismo que abrió esta)
      m.empieza = r === 'parda' ? m.empieza : altos[0].s;
      m.baza++;
      m.turno = m.empieza;
    }

    function ganadorDeBazas() {
      const r = m.resultado, b = m.baza;
      const gana = (e) => r.filter((x) => x === e).length;
      if (b >= 1) {
        for (const e of [0, 1]) if (gana(e) >= 2) return e;
        // primera ganada y segunda parda: gana el de primera; primera parda: gana el de segunda
        if (r[0] !== 'parda' && r[1] === 'parda') return r[0];
        if (r[0] === 'parda' && r[1] !== 'parda' && r[1] !== null) return r[1];
      }
      if (b === 2) {
        if (r[2] === 'parda') return r[0] !== 'parda' ? r[0] : r[1] !== 'parda' ? r[1] : equipo(esMano);
        return r[2];
      }
      return null;
    }

    function terminar(g, pts, por) {
      cerrarFlores();
      if (p.ganador !== null) { m.terminada = true; m.ganadorMano = p.ganador; m.eventos.push({ tipo: 'fin-mano', ganador: p.ganador, por: 'partida' }); return; }
      m.terminada = true;
      m.ganadorMano = g;
      m.eventos.push({ tipo: 'fin-mano', ganador: g, puntos: pts, por });
      p.sumar(g, pts, 'truco', m.eventos);
    }

    Object.assign(m, { acciones, hacer, rivalesDe, respondeA, puedeEnvido, puedeFlor, conFlor, jugoEnBaza });
    return m;
  }

  const Truco = { PALOS, NUMEROS, carta, mazoNuevo, jerarquia, valorEnvido, envidoDe, tieneFlor, florDe, mezclar, partida };
  if (typeof module !== 'undefined' && module.exports) module.exports = Truco;
  else raiz.Truco = Truco;
})(this);
