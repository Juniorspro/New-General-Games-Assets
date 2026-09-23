/* ============================================================================
   kuntur/js/historia.js — qué pasa en cada capítulo: las charlas de cada
   disparo, lo que dicen los vecinos cuando les hablás, las ayudas, y las
   escenas (cinemáticas con franjas: la cámara se mueve sola y cada uno hace
   sus gestos). Son funciones async que usan al director (j): j.charla,
   j.grito, j.cine, j.gesto, j.caminarA, j.caminarVecino, j.lanzar, j.viajar...
   `gestos`: por charla y por número de línea, quién hace qué mientras se dice.
   ========================================================================== */
import { T } from './textos.js';

export const HISTORIA = {
  /* ---------------- Prólogo: la granizada ---------------- */
  prologo: {
    /* si salta por encima del pichón y llega a la salida, el final espera a que termine la escena */
    musica: 'prologo', ambiente: 'granizo', finEspera: 'pichon',
    gestos: {
      inicio: { 0: [['abuela', 'senala', 1.8]], 1: [['killa', 'asiente', 0.8]] },
      casa: { 0: [['abuela', 'asiente', 1]], 2: [['abuela', 'senala', 2.4]], 3: [['abuela', 'habla', 2]], 4: [['killa', 'asiente', 0.8]], 6: [['abuela', 'abraza', 2.6]] },
    },
    async empezar(j) {
      const c = j.cap, p = c.m.p;
      if (c.m.hechos.has('pichon')) { c.apu.poner('bulto'); return; }
      c.apu.poner('suelo', 57.4, 7);
      if (j.reanudado) return;
      /* adentro de la casa: la abuela teje al lado del fogón, afuera graniza */
      j.cine(true);
      p.dir = -1;
      c.encuadre = { x: 6, y: 5.6, ancho: 10 };
      await j.esperar(1.6);
      c.rayo = 1; j.sfx('trueno');
      await j.esperar(0.9);
      j.mirar('abuela', 1);
      await j.charla('inicio');
      j.mirar('abuela', null);
      p.dir = 1;
      c.encuadre = null;
      j.cine(false);
      j.ayuda('mover');
    },
    zonas: {
      afuera(j) { j.grito('afuera'); j.ayuda('saltar'); },
      corral(j) { j.grito('corral'); },
      async pichon(j) {
        if (!await j.enSuelo()) return;
        const c = j.cap;
        j.cine(true);
        c.encuadre = { x: 56.9, y: 8.3, ancho: 8.5 };
        await j.caminarA(56.7);
        j.mirar('killa', 1);
        /* se arrodilla al lado del pichón, que tiembla y pía */
        c.killa.hacer('arrodilla', Infinity);
        await j.esperar(0.8);
        c.apu.aletear(); j.sfx('pio');
        await j.charla('pichon', { hasta: 1 });
        /* lo levanta y lo abraza contra el pecho */
        c.apu.poner('brazos'); c.apu.brazosY = 0.28; c.apu.brazosX = 0.36;
        await j.esperar(0.5);
        c.killa.hacer('abraza', Infinity); c.apu.brazosY = 0.52; c.apu.brazosX = 0.3;
        await j.esperar(0.9);
        await j.charla('pichon', { desde: 1 });
        /* y lo guarda en el atado */
        c.killa.hacer(null);
        c.apu.poner('bulto'); c.apu.aletear(); j.sfx('pio');
        await j.esperar(0.5);
        c.encuadre = null;
        j.cine(false);
      },
    },
    ayudas: [[37, 'borde'], [44, 'agachar']],
    hablar: { abuela: ['inicio'] },
    async terminar(j) {
      /* adentro de la casa, al lado del fogón */
      await j.telon(true);
      const c = j.cap, p = c.m.p, ab = c.vecinos.abuela;
      p.x = 9.6; p.y = 4; p.vx = 0; p.dir = -1;
      c.apu.poner('brazos'); c.apu.brazosY = 0.52; c.apu.brazosX = 0.3;
      c.killa.hacer('abraza', Infinity);
      if (ab) { ab.x = 5; ab.mirar(1); }
      c.encuadre = { x: 7.3, y: 5.7, ancho: 9.5 };
      c.quieta = true; c.pasarCamara(1, true);
      c.clima.fuerza = 0.25;
      j.ambiente('fuego');
      j.cine(true);
      await j.telon(false);
      await j.esperar(0.8);
      /* la abuela deja el tejido y se acerca a mirar */
      await j.caminarVecino('abuela', 8.1, 0.8);
      await j.charla('casa', { hasta: 7, alTerminar: true });
      /* "Se va a llamar Apu": lo levanta bien alto */
      c.killa.hacer('levanta', Infinity); c.apu.brazosY = 1.02; c.apu.brazosX = 0.1; c.apu.aletear(); j.sfx('pio');
      await j.charla('casa', { desde: 7, alTerminar: true });
      await j.esperar(1.4);
      c.killa.hacer(null);
    },
  },

  /* ---------------- 1. Los Siete Colores ---------------- */
  colores: {
    musica: 'colores', ambiente: null,
    hablar: { rosa: ['rosa', 'rosa2'] },
    gestos: {
      rosa: { 0: [['rosa', 'saluda', 1.4]], 1: [['killa', 'senala', 1.6]], 2: [['rosa', 'senala', 2.2]], 3: [['rosa', 'asiente', 1]] },
      rosa2: { 0: [['rosa', 'saluda', 1.6], ['killa', 'saluda', 1.4]] },
      mirador: { 0: [['killa', 'senala', 3]], 1: [['apu', 'pio']] },
    },
    zonas: {
      piedra(j) { j.grito('piedra'); j.ayuda('empujar'); },
      async mirador(j) {
        if (!await j.enSuelo()) return;
        const c = j.cap, p = c.m.p;
        j.cine(true);
        /* la cámara se aleja y recorre los cerros pintados */
        await j.viajar({ x: p.x + 4, y: p.y + 3.5, ancho: 26, libre: true }, 1.6);
        await j.viajar({ x: p.x + 14, y: p.y + 5, ancho: 36, libre: true, alzada: 3 }, 2.6);
        await j.charla('mirador');
        await j.viajar({ x: p.x + 2, y: p.y + 1.5, ancho: 21 }, 1.4);
        c.encuadre = null;
        j.cine(false);
      },
      cuesta(j) { j.grito('cuesta'); },
    },
    ayudas: [[45, 'borde'], [88, 'escalera']],
  },

  /* ---------------- 2. Las Salinas Grandes ---------------- */
  salinas: {
    musica: 'salinas', ambiente: 'viento',
    hablar: { ceferino: ['ceferino', 'ceferino2'] },
    gestos: {
      ceferino: { 0: [['ceferino', 'saluda', 1.4]], 1: [['killa', 'asiente', 0.8]], 2: [['ceferino', 'asiente', 1]], 3: [['ceferino', 'seca', 1.2]], 4: [['ceferino', 'senala', 2.2]] },
      ceferino2: { 0: [['ceferino', 'asiente', 1]] },
      aleteo: { 1: [['apu', 'pio']] },
    },
    zonas: {
      async aleteo(j) {
        if (!await j.enSuelo()) return;
        j.cine(true);
        await j.charla('aleteo', { hasta: 2 });
        j.cine(false);
        j.ayuda('aleteo');
        await j.evento('aleteo');
        j.grito('aleteo', 2);
      },
      estacion(j) { j.grito('estacion'); },
    },
    ayudas: [[24, 'viento'], [30, 'agua']],
  },

  /* ---------------- 3. El Tren a las Nubes ---------------- */
  tren: {
    musica: 'tren', ambiente: 'viento',
    hablar: { tomas: ['tomas2'] },
    gestos: {
      tomas: { 0: [['tomas', 'saluda', 1.4]], 1: [['killa', 'senala', 1.4]], 2: [['tomas', 'senala', 1.8]], 3: [['killa', 'asiente', 0.8]], 4: [['tomas', 'asiente', 1.2]], 6: [['tomas', 'senala', 2.2]] },
      tomas2: { 0: [['tomas', 'saluda', 1.6], ['killa', 'saluda', 1.4]] },
    },
    zonas: {
      arranca(j) { j.grito('arranca'); },
      viaducto(j) { j.grito('viaducto'); },
      tunel(j) { j.grito('tunel'); j.ayuda('tunel'); },
      async tomas(j) {
        if (!await j.enSuelo()) return;
        const c = j.cap, p = c.m.p, t = c.vecinos.tomas;
        j.cine(true);
        if (t && Math.abs(p.x - t.x) < 1.3) await j.caminarA(t.x - 1.7);
        j.mirar('killa', t && t.x < p.x ? -1 : 1);
        c.encuadre = { x: p.x + 1.4, y: p.y + 1.6, ancho: 11 };
        await j.charla('tomas', { hasta: 5 });
        /* le da el farol: pasa volando de una mano a la otra */
        if (t) {
          t.hacer('da', 2.2);
          await j.charla('tomas', { desde: 5, hasta: 6 });
          const d = p.x < t.x ? -1 : 1;
          t.hacer('quieto', 0.4);
          await j.lanzar('farol', { x: t.x + d * 0.45, y: t.y + 0.55 }, { x: p.x + p.dir * 0.3, y: p.y + 0.55 }, 0.8, 0.9);
          c.volador('farol').esconder();
          c.darFarol();
          c.killa.hacer('levanta', 1.4);
          await j.esperar(1.2);
        } else await j.charla('tomas', { desde: 5, hasta: 6 });
        await j.charla('tomas', { desde: 6 });
        j.dar('farol');
        c.encuadre = null;
        j.cine(false);
      },
    },
  },

  /* ---------------- 4. La Puna ---------------- */
  puna: {
    musica: 'puna', ambiente: 'noche',
    hablar: { coquena: ['coquena2'] },
    gestos: {
      planeo: { 1: [['apu', 'pio']] },
      coquena: { 0: [['coquena', 'baston', 1.6]], 1: [['killa', 'senala', 1.2]], 3: [['coquena', 'baston', 1.4]], 4: [['killa', 'asiente', 0.8]], 5: [['coquena', 'baston', 1.8]] },
      coquena2: { 0: [['coquena', 'baston', 1.4]] },
    },
    /* Coquena aparece en su escena; si se retoma después, ya está */
    empezar(j) { if (j.cap.vecinos.coquena && !j.cap.m.hechos.has('coquena')) j.cap.vecinos.coquena.mostrar(false); },
    zonas: {
      async planeo(j) {
        if (!await j.enSuelo()) return;
        j.cine(true);
        await j.charla('planeo', { hasta: 2 });
        j.cine(false);
        j.sfx('kiia');
        j.ayuda('planeo');
        await j.evento('planeo');
        j.grito('planeo', 2);
      },
      async llamar(j) {
        if (!await j.enSuelo()) return;
        j.cap.killa.hacer('senala', 1.6);
        await j.charla('llamar', { hasta: 1 });
        j.ayuda('llamar');
        await j.evento('apuVa');
        j.grito('llamar', 1);
      },
      puma(j) { j.grito('puma'); j.sfx('rugido'); j.musica('persecucion'); },
      async coquena(j) {
        const c = j.cap, v = c.vecinos.coquena, p = c.m.p;
        j.musica('puna');
        if (!await j.enSuelo()) return;
        j.cine(true);
        if (v && Math.abs(p.x - v.x) < 1.4) await j.caminarA(v.x - 2.2);
        c.encuadre = { x: v ? (p.x + v.x) / 2 : p.x, y: p.y + 1.8, ancho: 12 };
        await j.esperar(0.4);
        /* aparece entre chispas; las vicuñas vienen a ella */
        if (v) {
          c.pap.soltar('chispa', 70, { x: v.x, y: v.y + 1, abre: 2.6, sube: 2, col: ['#fff6a0', '#ffe060', '#ffffff'] });
          v.mostrar(true);
          j.sfx('copla');
          for (const a of c.animales) if (a.tipo === 'vicuna' && Math.abs(a.x - v.x) < 22) { a.x0 = v.x + 2.2 + Math.random() * 3; a.estado = 'quieto'; a.t = 0.3; }
          await j.esperar(0.9);
          await v.hacer('baston', 1.4);
        }
        j.mirar('killa', v && v.x < p.x ? -1 : 1);
        await j.charla('coquena');
        c.encuadre = null;
        j.cine(false);
      },
    },
  },

  /* ---------------- 5. El Nevado ---------------- */
  nevado: {
    musica: 'tormenta', ambiente: 'viento', finPorGuion: true,
    /* retomado en una apacheta pasada la tormenta: ya no hay tormenta */
    empezar(j) { if (j.reanudado && j.cap.m.p.x > 99) { j.musica('cumbre'); j.ambiente(null); } },
    gestos: {
      cumbre: { 0: [['killa', 'arrodilla', Infinity]], 2: [['killa', 'asiente', 1]], 3: [['killa', 'arrodilla', Infinity]] },
    },
    zonas: {
      tormenta(j) { j.grito('tormenta'); j.sfx('trueno'); },
      async cumbre(j) {
        const c = j.cap, p = c.m.p;
        if (!await j.enSuelo()) return;
        j.cine(true);
        c.encuadre = { x: 145.4, y: 45.5, ancho: 10.5 };
        await j.caminarA(144.6);
        c.quieta = true;
        j.musica('cumbre'); j.ambiente(null);
        /* Apu baja al nido y se queda mirándola */
        c.apu.aterrizar(146.5, 44.25, 1.3);
        await j.esperar(1.6);
        j.mirar('killa', 1);
        await j.charla('cumbre', { hasta: 1 });
        await j.charla('cumbre', { desde: 1, hasta: 2 });
        /* la cinta de mamá: se la ata al cuello */
        await j.lanzar('cinta', { x: p.x + 0.3, y: p.y + 0.5 }, { x: 146.6, y: 44.9 }, 0.9, 0.6);
        c.volador('cinta').sigue = c.apu;
        c.apu.aletear(); j.sfx('pio', { grande: true });
        await j.charla('cumbre', { desde: 2, hasta: 4 });
        /* "¡Volá, Apu!": se para, levanta los brazos, y él se va */
        c.killa.hacer('levanta', Infinity);
        await j.charla('cumbre', { desde: 4 });
        c.apu.aletear(); await j.esperar(0.5);
        c.apu.soltar(); j.sfx('aleteo', { grande: true });
        c.pap.soltar('pluma', 8, { x: 146.5, y: 45.5, abre: 1.6, col: ['#1c1a1c', '#f2eee8'] });
        await j.esperar(0.6);
        c.killa.hacer('saluda', Infinity);
        await j.viajar({ x: 147, y: 50, ancho: 24, libre: true, alzada: -3 }, 2.4);
        await j.esperar(1.6);
        j.sfx('kiia');
        await j.esperar(3.2);
        c.killa.hacer(null);
        j.terminarCapitulo();
      },
    },
    eventos: {
      escapa(j) { j.grito('escapa'); j.musica('cumbre'); j.ambiente(null); },
    },
    ayudas: [[104, 'termica']],
  },

  /* ---------------- Epílogo ---------------- */
  epilogo: {
    musica: 'epilogo', ambiente: null,
    gestos: {
      epilogo: { 1: [['killa', 'asiente', 1]], 2: [['abuela', 'senala', 2.4]] },
    },
    zonas: {
      async casa(j) {
        const c = j.cap, p = c.m.p, ab = c.vecinos.abuela;
        if (!await j.enSuelo()) return;
        j.cine(true);
        c.encuadre = { x: p.x + 3, y: p.y + 1.7, ancho: 11 };
        await j.caminarA(ab ? ab.x - 2.6 : p.x + 2.2);
        c.quieta = true;
        /* la abuela deja el tejido, la saluda y se le acerca */
        if (ab) { j.mirar('abuela', -1); await ab.hacer('saluda', 1.3); await j.caminarVecino('abuela', p.x + 1.15, 0.9); }
        await j.charla('epilogo', { hasta: 2 });
        /* el abrazo */
        if (ab) ab.hacer('abraza', 2.4);
        c.killa.hacer('abraza', 2.4);
        await j.esperar(2.4);
        await j.charla('epilogo', { desde: 2, hasta: 3 });
        /* mirar para arriba: pasa un cóndor enorme */
        await j.viajar({ x: p.x + 1, y: p.y + 7, ancho: 24, libre: true, alzada: -5 }, 1.8);
        c.apu.ponerEdad(1);
        c.apu.cruzar(p.x - 20, p.x + 22, p.y + 11.5, 9);
        c.killa.hacer('senala', 2.2);
        await j.esperar(2.2);
        j.sfx('kiia');
        c.killa.hacer('saluda', Infinity);
        await j.esperar(2.6);
        await j.charla('epilogo', { desde: 3 });
        await j.esperar(1);
        c.killa.hacer(null);
        j.terminarCapitulo();
      },
    },
    hablar: { abuela: ['epilogo'] },
  },
};

/* el orden de los capítulos */
export const ORDEN = ['prologo', 'colores', 'salinas', 'tren', 'puna', 'nevado', 'epilogo'];
export function siguiente(id) { const i = ORDEN.indexOf(id); return i >= 0 && i < ORDEN.length - 1 ? ORDEN[i + 1] : null; }
export function numeroDe(id) { return ORDEN.indexOf(id); }
export const lineasDe = (k) => T().charlas[k] || [];
