/*
 * La computadora del truco. Reconstruida de lo que dejó el original (Truco Blyts, IL2CPP): no
 * está su código, pero sí sus registros de depuración ("CPU has 4,5,6. Reject truco.", "CPU has
 * decent TRUCO cards. Raise Truco 15% of times", "USER is lying a lot of ENVIDOs, CPU forcing
 * QUIERO", "POSSIBLE USER CARDS"...) y la personalidad de cada personaje (players_es.txt:
 * mentiroso en envido y truco, pescador en envido y truco, estilo de muy pasivo a muy agresivo).
 *
 * Mira sólo lo que vería un jugador sentado a la mesa (vista()): sus cartas, las tiradas, los
 * cantos y los puntos dichos. Para lo que no ve, reparte al azar las cartas que faltan entre los
 * demás, respetando lo que se sabe (los puntos que dijeron, la flor), y juega el resto de la mano
 * en cada reparto: así sabe cuánto gana con lo que tiene.
 *
 *   const acc = TrucoIA.decidir(mano, asiento, perfil, memoria, azar)
 */
(function (raiz) {
  'use strict';
  const T = typeof module !== 'undefined' && module.exports ? require('./truco.js') : raiz.Truco;
  const J = T.jerarquia;

  // el estilo del personaje, de -3 (extremadamente pasivo) a +3 (extremadamente agresivo)
  const ESTILO = { EXTREMELY_PASIVE: -3, VERY_PASIVE: -2, PASIVE: -1, NEUTRAL: 0, AGGRESSIVE: 1, VERY_AGGRESSIVE: 2, EXTREMELY_AGGRESSIVE: 3 };
  const perfilBase = { lier_envido: 40, lier_truco: 40, fishing_envido: 35, fishing_truco: 35, luck: 50, style: 'NEUTRAL' };

  // ── lo que ve el asiento s ──
  function vista(m, s) {
    const p = m.p, n = m.n, eq = (x) => x % 2;
    const v = {
      s, n, eq, miEquipo: eq(s), esMano: m.esMano, baza: m.baza,
      mias: m.cartas[s].slice(), mano3: m.iniciales[s].slice(),
      bazas: m.bazas.map((b) => b.slice()), resultado: m.resultado.slice(),
      puntos: p.puntos.slice(), limite: p.cfg.puntos, flor: p.cfg.flor,
      truco: { querido: m.truco.querido, puede: m.truco.puede, pendiente: m.truco.pendiente && Object.assign({}, m.truco.pendiente) },
      envido: { estado: m.envido.estado, cadena: m.envido.cadena.slice(), pendiente: m.envido.pendiente && Object.assign({}, m.envido.pendiente),
        mejor: m.envido.mejor, mejorDe: m.envido.mejorDe, valor: m.envido.valor },
      florPend: m.flor.pendiente && Object.assign({}, m.flor.pendiente), florCadena: m.flor.cadena.slice(),
      dichos: {}, conFlor: new Set(), sinFlor: new Set(),
    };
    for (const e of m.eventos) {
      if (e.tipo === 'envido-dice') v.dichos[e.s] = e.puntos;            // null = "son buenas"
      if (e.tipo === 'canto' && e.que === 'flor') v.conFlor.add(e.s);
    }
    // con flor en juego, quien tiró su carta de primera sin cantarla no la tenía
    if (p.cfg.flor) for (const x of m.bazas[0]) if (!v.conFlor.has(x.s)) v.sinFlor.add(x.s);
    v.tiradas = m.bazas.flat().map((x) => x.carta);
    v.tiroDe = (x) => m.bazas.flat().filter((y) => y.s === x).map((y) => y.carta);
    v.envidoMio = T.envidoDe(v.mano3);
    v.tengoFlor = p.cfg.flor && T.tieneFlor(v.mano3);
    return v;
  }

  // ── repartos posibles de lo que no se ve ──
  function repartir(v, azar, intentos) {
    const vistas = new Set([...v.mano3, ...v.tiradas].map((c) => c.id));
    const resto = T.mazoNuevo().filter((c) => !vistas.has(c.id));
    const otros = [];
    for (let x = 0; x < v.n; x++) if (x !== v.s) otros.push(x);
    for (let k = 0; k < intentos; k++) {
      const mez = T.mezclar(resto, azar);
      const manos = {}; let i = 0, vale = true;
      for (const x of otros) {
        const tiradas = v.tiroDe(x);
        const faltan = 3 - tiradas.length;
        const suyas = mez.slice(i, i + faltan); i += faltan;
        const inicial = tiradas.concat(suyas);
        // lo que se sabe: los puntos que dijo, si tenía flor
        const d = v.dichos[x];
        if (typeof d === 'number' && T.envidoDe(inicial) !== d) { vale = false; break; }
        if (v.conFlor.has(x) && !T.tieneFlor(inicial)) { vale = false; break; }
        if (v.sinFlor.has(x) && T.tieneFlor(inicial)) { vale = false; break; }
        manos[x] = suyas;
      }
      if (vale) return manos;
    }
    return null;
  }

  // el resto de la mano con todas las cartas a la vista: cada uno mata con la más baja que le
  // alcanza, o tira la más baja si su equipo ya gana la baza o no puede matar
  function jugarResto(v, manos, primera) {
    const n = v.n, eq = v.eq;
    const quedan = {}; for (let x = 0; x < n; x++) quedan[x] = (x === v.s ? v.mias : manos[x] || []).slice();
    const bazas = v.bazas.map((b) => b.slice()); const res = v.resultado.slice();
    let b = v.baza, empieza = bazas[b].length ? bazas[b][0].s : null;
    if (empieza === null) empieza = v.turnoDe;
    let turno = bazas[b].length ? (bazas[b][bazas[b].length - 1].s + 1) % n : empieza;
    if (primera) { bazas[b].push({ s: v.s, carta: primera }); quedan[v.s] = quedan[v.s].filter((c) => c.id !== primera.id); turno = (v.s + 1) % n; if (bazas[b].length === 1) empieza = v.s; }
    for (;;) {
      while (bazas[b].length < n) {
        const mias = quedan[turno];
        const jug = bazas[b];
        let c;
        if (!jug.length) c = mias.reduce((a, x) => (J(x) > J(a) ? x : a));                       // abre con la más alta
        else {
          const mejor = jug.reduce((a, x) => (J(x.carta) > J(a.carta) ? x : a));
          if (eq(mejor.s) === eq(turno)) c = mias.reduce((a, x) => (J(x) < J(a) ? x : a));
          else {
            const matan = mias.filter((x) => J(x) > J(mejor.carta));
            c = matan.length ? matan.reduce((a, x) => (J(x) < J(a) ? x : a)) : mias.reduce((a, x) => (J(x) < J(a) ? x : a));
          }
        }
        jug.push({ s: turno, carta: c }); quedan[turno] = mias.filter((x) => x.id !== c.id);
        turno = (turno + 1) % n;
      }
      const alto = Math.max(...bazas[b].map((x) => J(x.carta)));
      const altos = bazas[b].filter((x) => J(x.carta) === alto);
      res[b] = new Set(altos.map((x) => eq(x.s))).size > 1 ? 'parda' : eq(altos[0].s);
      const g = ganador(res, b, eq(v.esMano));
      if (g !== null) return g;
      empieza = res[b] === 'parda' ? empieza : altos[0].s;
      b++; turno = empieza;
    }
  }
  function ganador(r, b, equipoMano) {
    const gana = (e) => r.filter((x) => x === e).length;
    if (b >= 1) {
      for (const e of [0, 1]) if (gana(e) >= 2) return e;
      if (r[0] !== 'parda' && r[1] === 'parda') return r[0];
      if (r[0] === 'parda' && r[1] !== 'parda' && r[1] !== null) return r[1];
    }
    if (b === 2) return r[2] === 'parda' ? (r[0] !== 'parda' ? r[0] : r[1] !== 'parda' ? r[1] : equipoMano) : r[2];
    return null;
  }

  // la probabilidad de ganar la mano (y la mejor carta para tirar, si es su turno)
  function chances(v, azar, muestras) {
    const cartas = v.esMiTurno ? v.mias : [null];
    const gano = new Map(cartas.map((c) => [c ? c.id : '-', 0]));
    let validas = 0;
    for (let k = 0; k < muestras; k++) {
      const manos = repartir(v, azar, 30) || repartir(Object.assign({}, v, { dichos: {}, conFlor: new Set(), sinFlor: new Set() }), azar, 1);
      if (!manos) continue;
      validas++;
      for (const c of cartas) if (jugarResto(v, manos, c) === v.miEquipo) gano.set(c ? c.id : '-', gano.get(c ? c.id : '-') + 1);
    }
    let mejor = null, w = 0;
    for (const c of cartas) { const x = gano.get(c ? c.id : '-') / Math.max(1, validas); if (mejor === null || x > w) { mejor = c; w = x; } }
    return { w, carta: mejor, porCarta: gano, validas };
  }

  // la chance de ganar el envido con e puntos contra lo que tengan los otros
  function chanceEnvido(v, azar, e, muestras) {
    let gano = 0, validas = 0;
    for (let k = 0; k < muestras; k++) {
      const manos = repartir(v, azar, 20);
      if (!manos) continue;
      validas++;
      // el mejor de cada equipo: más puntos; a igual, el más cerca de la mano
      const mejor = [{ pts: -1, dist: 99 }, { pts: -1, dist: 99 }];
      for (let x = 0; x < v.n; x++) {
        const pts = x === v.s ? e : T.envidoDe(v.tiroDe(x).concat(manos[x]));
        const dist = (x - v.esMano + v.n) % v.n;
        const b = mejor[v.eq(x)];
        if (pts > b.pts || (pts === b.pts && dist < b.dist)) { b.pts = pts; b.dist = dist; }
      }
      const yo = mejor[v.miEquipo], ellos = mejor[1 - v.miEquipo];
      if (yo.pts > ellos.pts || (yo.pts === ellos.pts && yo.dist < ellos.dist)) gano++;
    }
    return validas ? gano / validas : 0.5;
  }

  const prob = (azar, x) => azar() < Math.max(0, Math.min(1, x));

  // ── decidir ──
  function decidir(m, s, perfilDado, memoria, azar) {
    azar = azar || Math.random;
    memoria = memoria || {};
    const perfil = Object.assign({}, perfilBase, perfilDado || {});
    const agr = ESTILO[perfil.style] || 0;                  // −3 … +3
    const miente = (x) => x / 100;                          // 0 … 1
    const acciones = m.acciones(s);
    const tiene = (pred) => acciones.find(pred);
    const v = vista(m, s);
    v.esMiTurno = acciones.some((a) => a.tipo === 'jugar');
    v.turnoDe = m.turno;
    const p = m.p;
    const nosotros = v.puntos[v.miEquipo], ellos = v.puntos[1 - v.miEquipo];
    const porGanar = (pts) => nosotros + pts >= v.limite;
    const porPerder = (pts) => ellos + pts >= v.limite;
    // "a punto de ganar/perder": a 3 puntos o menos del final (con la falta, ganarla siempre "gana")
    const cercaDeGanar = v.limite - nosotros <= 3, cercaDePerder = v.limite - ellos <= 3;
    const mentirasEnvido = memoria.mentirasEnvido || 0, mentirasTruco = memoria.mentirasTruco || 0;
    const MUESTRAS = 140;

    // la flor: siempre se canta; a la flor del otro, contraflor con una buena
    if (tiene((a) => a.que === 'flor') && !m.flor.pendiente) return { tipo: 'cantar', que: 'flor' };
    if (m.flor.pendiente) {
      const miFlor = T.florDe(v.mano3);
      const ult = m.flor.pendiente.que;
      if (ult === 'flor') {
        if (miFlor >= 35 && (cercaDeGanar || miFlor >= 37) && tiene((a) => a.que === 'contrafloralresto')) return { tipo: 'cantar', que: 'contrafloralresto' };
        if (miFlor >= 31 || prob(azar, miente(perfil.lier_envido) * 0.4)) return { tipo: 'cantar', que: 'contraflor' };
        return { tipo: 'responder', que: 'noquiero' };
      }
      if (ult === 'contraflor' && miFlor >= 36 && tiene((a) => a.que === 'contrafloralresto')) return { tipo: 'cantar', que: 'contrafloralresto' };
      return { tipo: 'responder', que: miFlor >= (ult === 'contraflor' ? 32 : 35) ? 'quiero' : 'noquiero' };
    }

    // decir los puntos: con lo que gana se dicen; si no, "son buenas"
    if (m.envido.estado === 'diciendo') {
      const d = tiene((a) => a.tipo === 'decir');
      const ganaria = m.envido.mejor === null || d.puntos > m.envido.mejor || (d.puntos === m.envido.mejor && false);
      if (ganaria || !tiene((a) => a.tipo === 'sonbuenas')) return d;
      return { tipo: 'sonbuenas' };
    }

    // responder el envido
    if (m.envido.pendiente) {
      const cad = m.envido.cadena;
      const e = v.envidoMio;
      const siQuiero = cad.includes('faltaenvido') ? p.falta() : cad.reduce((a, q) => a + ({ envido: 2, realenvido: 3 }[q] || 0), 0);
      const siNo = cad.length === 1 ? 1 : cad.slice(0, -1).reduce((a, q) => a + ({ envido: 2, realenvido: 3 }[q] || p.falta()), 0);
      let pw = chanceEnvido(v, azar, e, 120);
      // el que canta suele tener: se le baja la chance, salvo que mienta seguido
      pw *= mentirasEnvido >= 3 ? 1 : mentirasEnvido >= 1 ? 0.92 : 0.85;
      // perder por no querer: hay que querer ("NO QUIERO envido points makes me loose. Force QUIERO.")
      if (porPerder(siNo) && !porPerder(siQuiero)) return { tipo: 'responder', que: 'quiero' };
      if (porPerder(siNo)) return tiene((a) => a.que === 'faltaenvido') && pw > 0.35 ? { tipo: 'cantar', que: 'faltaenvido' } : { tipo: 'responder', que: 'quiero' };
      // con mucho, subir
      if (pw > 0.82 - agr * 0.03) {
        if (cercaDeGanar && e >= 30 && tiene((a) => a.que === 'faltaenvido') && prob(azar, 0.5)) return { tipo: 'cantar', que: 'faltaenvido' };
        if (tiene((a) => a.que === 'realenvido') && prob(azar, 0.45 + agr * 0.08)) return { tipo: 'cantar', que: 'realenvido' };
        if (tiene((a) => a.que === 'envido') && prob(azar, 0.35 + agr * 0.08)) return { tipo: 'cantar', que: 'envido' };
      }
      // mentir subiendo ("CPU lying, raising envido.")
      if (pw < 0.3 && cad.length === 1 && tiene((a) => a.que === 'realenvido') && prob(azar, miente(perfil.lier_envido) * 0.12)) return { tipo: 'cantar', que: 'realenvido' };
      // querer si conviene: ganar siQuiero con chance pw o regalar siNo
      const umbral = (siQuiero - siNo) / (2 * siQuiero) + 0.06 - agr * 0.03;
      return { tipo: 'responder', que: pw > umbral ? 'quiero' : 'noquiero' };
    }

    // la chance de ganar la mano (y la mejor carta)
    const ch = chances(v, azar, MUESTRAS);
    const w = ch.w;

    // responder el truco
    if (m.truco.pendiente) {
      const nivel = m.truco.pendiente.nivel;
      // el envido está primero: con buen envido, se canta antes de contestar
      if (tiene((a) => a.que === 'envido')) {
        const pe = chanceEnvido(v, azar, v.envidoMio, 80);
        if (pe > 0.62 || prob(azar, miente(perfil.lier_envido) * 0.08)) return { tipo: 'cantar', que: pe > 0.85 && prob(azar, 0.4) ? 'realenvido' : 'envido' };
      }
      let wt = w * (mentirasTruco >= 3 ? 1.05 : mentirasTruco >= 1 ? 0.97 : 0.9);
      // perder por no querer: querer o subir ("NO QUIERO truco points makes me lose. Force a Quiero or Raise.")
      if (porPerder(nivel - 1)) {
        const sube = tiene((a) => a.tipo === 'cantar' && ['retruco', 'valecuatro'].includes(a.que));
        return sube && wt > 0.5 ? sube : { tipo: 'responder', que: 'quiero' };
      }
      // "CPU 1 point to win. Force Quiero, it's same as No Quiero."
      if (porGanar(1) && nivel === 2) return { tipo: 'responder', que: 'quiero' };
      const sube = tiene((a) => a.tipo === 'cantar' && ['retruco', 'valecuatro'].includes(a.que));
      if (sube && (wt > 0.86 - agr * 0.03 && prob(azar, 0.5 + agr * 0.1) || (wt < 0.25 && prob(azar, miente(perfil.lier_truco) * 0.07)))) return sube;
      // querer si conviene: ganar nivel con chance wt o regalar nivel−1
      const umbral = 1 / (2 * nivel) + 0.18 - agr * 0.04;
      if (wt > umbral) return { tipo: 'responder', que: 'quiero' };
      return { tipo: 'responder', que: 'noquiero' };
    }

    // su turno: primero, el envido
    if (tiene((a) => a.que === 'envido')) {
      const e = v.envidoMio;
      const pe = chanceEnvido(v, azar, e, 100);
      // "CPU About to Win. CPU ALWAYS say FALTA ENVIDO if Envido >= 24."; a punto de perder, la falta no
      if (cercaDeGanar && !cercaDePerder && e >= 24 && pe > 0.5) return { tipo: 'cantar', que: 'faltaenvido' };
      // pescar: con mucho, a veces callarse para que cante el otro (si todavía tiene que hablar)
      const otroHablaDespues = m.bazas[0].length < v.n - 1;
      if (pe > 0.72 && otroHablaDespues && prob(azar, miente(perfil.fishing_envido) * 0.5)) memoria.pescandoEnvido = true;
      else if (pe > 0.7 - agr * 0.03) {
        if (pe > 0.9 && prob(azar, 0.35 + agr * 0.1)) return { tipo: 'cantar', que: 'realenvido' };
        return { tipo: 'cantar', que: 'envido' };
      } else if (pe > 0.5 && prob(azar, 0.35 + agr * 0.1)) return { tipo: 'cantar', que: 'envido' };
      else if (prob(azar, miente(perfil.lier_envido) * 0.18)) return { tipo: 'cantar', que: 'envido' };        // "CPU is lying an ENVIDO..."
    }

    // el truco (o subirlo, si el quiero es nuestro)
    const canto = tiene((a) => a.tipo === 'cantar' && ['truco', 'retruco', 'valecuatro'].includes(a.que));
    if (canto) {
      const yaHay = m.truco.querido > 1;
      // "Say Truco early" con muy buenas, a veces se espera (pesca); con malas, mentir
      if (w > 0.82 - agr * 0.03) {
        const pesca = !yaHay && prob(azar, miente(perfil.fishing_truco) * 0.45) && m.baza < 2;
        if (!pesca) return canto;
      } else if (w > 0.6 && prob(azar, (yaHay ? 0.2 : 0.35) + agr * 0.08)) return canto;
      else if (w < 0.35 && prob(azar, miente(perfil.lier_truco) * (m.baza === 2 ? 0.25 : 0.12))) return canto;     // "CPU Lie and say Truco."
    }

    // al mazo cuando ya no hay nada que hacer ("CPU cannot kill. FOLD 80% of times")
    if (w < 0.02 && m.truco.querido > 1 && prob(azar, 0.8) && tiene((a) => a.tipo === 'mazo')) return { tipo: 'mazo' };

    // tirar: la que más chances da
    if (v.esMiTurno && ch.carta) return { tipo: 'jugar', carta: ch.carta };
    return acciones.find((a) => a.tipo === 'jugar') || acciones.find((a) => a.tipo === 'responder') || acciones[0];
  }

  // después de cada mano: ¿el otro mintió? (cantó envido o truco con poco)
  function aprender(m, equipoBot, memoria) {
    for (const e of m.eventos) {
      if (e.tipo === 'canto' && m.equipo(e.s) !== equipoBot && ['envido', 'realenvido', 'faltaenvido'].includes(e.que)) {
        if (T.envidoDe(m.iniciales[e.s]) < 26) memoria.mentirasEnvido = (memoria.mentirasEnvido || 0) + 1;
      }
      if (e.tipo === 'canto' && m.equipo(e.s) !== equipoBot && ['truco', 'retruco', 'valecuatro'].includes(e.que)) {
        const fuerza = Math.max(...m.iniciales[e.s].map(J));
        if (fuerza < 9) memoria.mentirasTruco = (memoria.mentirasTruco || 0) + 1;
      }
    }
    return memoria;
  }

  const TrucoIA = { decidir, aprender, vista, ESTILO };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoIA;
  else raiz.TrucoIA = TrucoIA;
})(this);
