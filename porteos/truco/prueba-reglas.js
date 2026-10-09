// Las reglas del truco (truco.js) sin pantalla:   node porteos/truco/prueba-reglas.js
'use strict';
const T = require('./truco.js');
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; if (!c || process.env.TODO) console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const k = (s) => { const [num, palo] = s.split(/(?<=\d)(?=[a-z])/); return T.carta({ e: 'espada', b: 'basto', o: 'oro', c: 'copa' }[palo], +num); };
const mano = (...ss) => ss.map(k);

// semilla fija: las mismas manos en cada corrida
function azar(semilla) { let x = semilla >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

console.log('jerarquía y envido');
ch('ancho de espada > ancho de basto > 7 de espada > 7 de oro > 3', T.jerarquia(k('1e')) > T.jerarquia(k('1b')) && T.jerarquia(k('1b')) > T.jerarquia(k('7e')) && T.jerarquia(k('7e')) > T.jerarquia(k('7o')) && T.jerarquia(k('7o')) > T.jerarquia(k('3c')));
ch('3 > 2 > anchos falsos > 12 > 11 > 10 > 7 falsos > 6 > 5 > 4', [k('3b'), k('2c'), k('1o'), k('12e'), k('11b'), k('10c'), k('7c'), k('6e'), k('5o'), k('4b')].every((c, i, a) => i === 0 || T.jerarquia(a[i - 1]) > T.jerarquia(c)));
ch('el 1 de oro y el de copa valen igual', T.jerarquia(k('1o')) === T.jerarquia(k('1c')));
ch('envido 7+6 de espada = 33', T.envidoDe(mano('7e', '6e', '1o')) === 33);
ch('envido 12+11 de oro = 20', T.envidoDe(mano('12o', '11o', '5c')) === 20);
ch('envido sin palo repetido = la más alta', T.envidoDe(mano('4b', '5c', '6o')) === 6);
ch('envido de figuras sueltas = 0', T.envidoDe(mano('10b', '11c', '12o')) === 0);
ch('con tres del mismo palo, el envido usa las dos más altas', T.envidoDe(mano('7b', '1b', '5b')) === 32);
ch('flor de 7, 6 y 5 de copa = 38', T.tieneFlor(mano('7c', '6c', '5c')) && T.florDe(mano('7c', '6c', '5c')) === 38);

console.log('casos');
{ // truco no querido: 1 punto; retruco no querido: 2
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  const m = p.nuevaMano([mano('1e', '7e', '3b'), mano('4b', '5c', '6o')]);
  m.hacer(0, { tipo: 'cantar', que: 'truco' });
  ch('después del truco responde el otro', m.quien() === 1);
  m.hacer(1, { tipo: 'responder', que: 'noquiero' });
  ch('truco no querido: 1 punto para el que cantó', p.puntos[0] === 1 && m.terminada);
  const m2 = p.nuevaMano([mano('4b', '5c', '6o'), mano('1e', '7e', '3b')]);   // ahora es mano el 1
  ch('la mano rota', m2.esMano === 1 && m2.quien() === 1);
  m2.hacer(1, { tipo: 'cantar', que: 'truco' });
  m2.hacer(0, { tipo: 'cantar', que: 'retruco' });
  ch('después del retruco contesta el que cantó truco', m2.quien() === 1);
  m2.hacer(1, { tipo: 'responder', que: 'noquiero' });
  ch('retruco no querido: 2 puntos', p.puntos[0] === 3);
}
{ // envido: querido lo gana el de más puntos; no querido, 1
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  const m = p.nuevaMano([mano('7e', '6e', '1o'), mano('5b', '4b', '12c')]);
  m.hacer(0, { tipo: 'cantar', que: 'envido' });
  m.hacer(1, { tipo: 'responder', que: 'quiero' });
  ch('querido el envido, la mano dice primero', m.quien() === 0);
  m.hacer(0, { tipo: 'decir', puntos: 33 });
  ch('el otro puede decir "son buenas"', m.acciones(1).some((a) => a.tipo === 'sonbuenas'));
  m.hacer(1, { tipo: 'sonbuenas' });
  ch('envido querido: 2 para el de 33', p.puntos[0] === 2 && m.quien() === 0);
  const ev = m.eventos.find((e) => e.tipo === 'envido-fin');
  ch('el evento dice quién ganó y con cuánto', ev && ev.ganador === 0 && ev.mejor === 33);
  ch('después del envido sigue la mano jugando', m.acciones(0).some((a) => a.tipo === 'jugar'));
  ch('y ya no se puede cantar envido', !m.acciones(0).some((a) => a.que === 'envido'));
}
{ // envido envido real envido no querido = 4; falta envido querido = lo que le falta al que va ganando
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  const m = p.nuevaMano([mano('7e', '6e', '1o'), mano('5b', '4b', '12c')]);
  m.hacer(0, { tipo: 'cantar', que: 'envido' });
  m.hacer(1, { tipo: 'cantar', que: 'envido' });
  m.hacer(0, { tipo: 'cantar', que: 'realenvido' });
  ch('después del real envido no se puede cantar envido', !m.acciones(1).some((a) => a.que === 'envido'));
  m.hacer(1, { tipo: 'responder', que: 'noquiero' });
  ch('envido-envido-real no querido: 4', p.puntos[0] === 4);
  p.puntos[1] = 18;
  const m2 = p.nuevaMano([mano('4b', '5c', '6o'), mano('7e', '6e', '1o')]);
  m2.hacer(1, { tipo: 'cantar', que: 'faltaenvido' });
  m2.hacer(0, { tipo: 'responder', que: 'quiero' });
  m2.hacer(1, { tipo: 'decir', puntos: 33 });
  m2.hacer(0, { tipo: 'sonbuenas' });
  ch('falta envido querido: lo que le falta al que va ganando (30 − 18 = 12)', p.puntos[1] === 30 && p.ganador === 1, p.puntos.join('-'));
  ch('y la partida termina ahí', m2.terminada && m2.eventos.some((e) => e.tipo === 'fin-partida'));
}
{ // el envido está primero: contestar el truco con envido, y después el truco sigue esperando
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  const m = p.nuevaMano([mano('1e', '7e', '3b'), mano('7o', '6o', '4c')]);
  m.hacer(0, { tipo: 'cantar', que: 'truco' });
  ch('al truco se puede contestar con envido', m.acciones(1).some((a) => a.que === 'envido'));
  m.hacer(1, { tipo: 'cantar', que: 'envido' });
  m.hacer(0, { tipo: 'responder', que: 'quiero' });
  m.hacer(0, { tipo: 'decir', puntos: 7 });
  m.hacer(1, { tipo: 'decir', puntos: 33 });
  ch('el envido lo gana el de 33', p.puntos[1] === 2);
  ch('y el truco vuelve a esperar respuesta del mismo', m.quien() === 1 && m.acciones(1).some((a) => a.que === 'quiero'));
  m.hacer(1, { tipo: 'responder', que: 'quiero' });
  ch('querido el truco, sigue el juego', m.quien() === 0 && m.truco.querido === 2);
  m.hacer(0, { tipo: 'jugar', carta: k('1e') }); m.hacer(1, { tipo: 'jugar', carta: k('4c') });
  ch('la primera la gana el ancho', m.resultado[0] === 0 && m.quien() === 0);
  ch('el que no quiso... el que quiso puede subir: el retruco es del equipo 1', !m.acciones(0).some((a) => a.que === 'retruco'));
  m.hacer(0, { tipo: 'jugar', carta: k('7e') }); m.hacer(1, { tipo: 'jugar', carta: k('7o') });
  ch('dos bazas ganadas: truco querido vale 2', m.terminada && p.puntos[0] === 2);
}
{ // pardas
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  let m = p.nuevaMano([mano('3e', '4b', '12o'), mano('3c', '5c', '7b')]);
  m.hacer(0, { tipo: 'jugar', carta: k('3e') }); m.hacer(1, { tipo: 'jugar', carta: k('3c') });
  ch('3 contra 3: parda', m.resultado[0] === 'parda' && m.quien() === 0);
  m.hacer(0, { tipo: 'jugar', carta: k('12o') }); m.hacer(1, { tipo: 'jugar', carta: k('5c') });
  ch('primera parda: gana el de segunda', m.terminada && m.ganadorMano === 0);
  m = p.nuevaMano([mano('2e', '4b', '12o'), mano('3c', '4c', '11b')]);         // mano el 1
  m.hacer(1, { tipo: 'jugar', carta: k('3c') }); m.hacer(0, { tipo: 'jugar', carta: k('2e') });
  m.hacer(1, { tipo: 'jugar', carta: k('4c') }); m.hacer(0, { tipo: 'jugar', carta: k('4b') });
  ch('primera ganada y segunda parda: gana el de primera', m.terminada && m.ganadorMano === 1);
  m = p.nuevaMano([mano('3e', '2b', '12o'), mano('3c', '2c', '12b')]);         // mano el 0
  for (const [a, b] of [['3e', '3c'], ['2b', '2c'], ['12o', '12b']]) { m.hacer(m.quien(), { tipo: 'jugar', carta: k(m.quien() === 0 ? a : b) }); m.hacer(m.quien(), { tipo: 'jugar', carta: k(m.quien() === 0 ? a : b) }); }
  ch('las tres pardas: gana la mano', m.terminada && m.ganadorMano === 0);
}
{ // mazo antes del envido en primera: uno más
  const p = T.partida({ jugadores: 2, puntos: 30, mano: 0 });
  const m = p.nuevaMano([mano('4e', '5b', '6o'), mano('1e', '7e', '3b')]);
  m.hacer(0, { tipo: 'mazo' });
  ch('al mazo de entrada: 2 para el otro (mano + envido)', p.puntos[1] === 2);
}
{ // flor
  const p = T.partida({ jugadores: 2, puntos: 30, flor: true, mano: 0 });
  let m = p.nuevaMano([mano('7c', '6c', '5c'), mano('1e', '7e', '3b')]);
  ch('con flor no se canta envido', !m.acciones(0).some((a) => a.que === 'envido') && m.acciones(0).some((a) => a.que === 'flor'));
  m.hacer(0, { tipo: 'cantar', que: 'flor' });
  ch('flor sin flor enfrente: no se contesta', m.quien() === 0);
  m.hacer(0, { tipo: 'jugar', carta: k('7c') }); m.hacer(1, { tipo: 'jugar', carta: k('1e') });
  ch('la flor suma 3 al cerrar la primera', p.puntos[0] === 3);
  m = p.nuevaMano([mano('4o', '5o', '6o'), mano('7c', '6c', '5c')]);          // mano el 1
  m.hacer(1, { tipo: 'cantar', que: 'flor' });
  ch('flor contra flor: contesta el otro', m.quien() === 0 && m.acciones(0).some((a) => a.que === 'contraflor'));
  m.hacer(0, { tipo: 'cantar', que: 'contraflor' });
  m.hacer(1, { tipo: 'responder', que: 'quiero' });
  ch('contraflor querida: 6 a la flor más alta (38 > 35)', p.puntos[1] === 6, p.puntos.join('-'));
}
{ // de a cuatro: equipos y quién contesta
  const p = T.partida({ jugadores: 4, puntos: 30, mano: 1 });
  const m = p.nuevaMano();
  ch('de a cuatro empieza la mano', m.quien() === 1);
  m.hacer(1, { tipo: 'cantar', que: 'truco' });
  ch('si cantan al equipo del jugador, contesta el jugador', m.quien() === 0);
  m.hacer(0, { tipo: 'responder', que: 'quiero' });
  ch('querido, sigue el que cantó', m.quien() === 1);
}

console.log('partidas al azar (jugadores al azar con acciones válidas)');
let manos = 0, partidas = 0, errores = [];
const stats = { porMazo: 0, porTruco: 0, porBazas: 0, conFlor: 0, envidos: 0 };
for (const jugadores of [2, 4, 6]) for (const flor of [false, true]) for (const puntos of [15, 30]) {
  for (let sem = 1; sem <= 120; sem++) {
    const r = azar(sem * 7919 + jugadores * 31 + (flor ? 1 : 0) + puntos);
    const p = T.partida({ jugadores, puntos, flor, azar: r, mano: sem % jugadores });
    try {
      let vueltas = 0;
      while (p.ganador === null && vueltas++ < 400) {
        const m = p.nuevaMano();
        manos++;
        let pasos = 0;
        while (!m.terminada) {
          if (++pasos > 200) throw new Error('mano trabada');
          const s = m.quien();
          const acc = m.acciones(s);
          if (!acc.length) throw new Error(`nadie puede hacer nada (le toca a ${s})`);
          // un poco menos de mazo, para que las manos lleguen al final
          const pesos = acc.map((a) => a.tipo === 'mazo' ? 0.05 : a.tipo === 'jugar' ? 3 : 1);
          let x = r() * pesos.reduce((a, b) => a + b, 0), i = 0;
          while ((x -= pesos[i]) > 0) i++;
          m.hacer(s, acc[Math.min(i, acc.length - 1)]);
        }
        for (const e of m.eventos) {
          if (e.tipo === 'fin-mano') stats[{ mazo: 'porMazo', 'truco-no-querido': 'porTruco', bazas: 'porBazas' }[e.por] || 'porBazas']++;
          if (e.tipo === 'flor-fin') stats.conFlor++;
          if (e.tipo === 'envido-fin') stats.envidos++;
        }
        if (p.puntos.some((x) => x > puntos || x < 0)) throw new Error('puntos fuera de rango ' + p.puntos);
        const jugadas = m.bazas.flat().length;
        if (jugadas > 3 * jugadores) throw new Error('se jugaron de más');
      }
      if (p.ganador === null) throw new Error('la partida no terminó');
      partidas++;
    } catch (e) {
      errores.push(`${jugadores} jug, flor ${flor}, a ${puntos}, semilla ${sem}: ${e.message}`);
    }
  }
}
ch(`${partidas} partidas y ${manos} manos sin un estado inválido`, errores.length === 0, errores.slice(0, 3).join(' | '));
ch('se ven todos los finales (bazas, truco no querido, mazo, flor, envido)', Object.values(stats).every((v) => v > 0), JSON.stringify(stats));

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
