/* ============================================================================
   kuntur/js/historia.js — qué pasa en cada capítulo: las charlas de cada
   disparo, lo que dicen los vecinos cuando les hablás, las ayudas, y las
   escenas del principio y del final. Son funciones async que usan al
   director (j): j.charla, j.grito, j.ayuda, j.esperar, j.cuando, j.evento...
   ========================================================================== */
import { T } from './textos.js';

export const HISTORIA = {
  /* ---------------- Prólogo: la granizada ---------------- */
  prologo: {
    musica: 'prologo', ambiente: 'granizo',
    async empezar(j) {
      const c = j.cap;
      if (c.m.hechos.has('pichon')) { c.apu.poner('bulto'); return; }
      c.apu.poner('suelo', 57.4, 7);
      if (j.reanudado) return;
      await j.esperar(0.6);
      await j.charla('inicio');
      j.ayuda('mover');
    },
    zonas: {
      afuera(j) { j.grito('afuera'); j.ayuda('saltar'); },
      corral(j) { j.grito('corral'); },
      async pichon(j) {
        await j.enSuelo();
        const c = j.cap;
        c.encuadre = { x: 56.5, y: 8.4, ancho: 12 };
        await j.caminarA(56.6);
        await j.charla('pichon', { hasta: 1 });
        c.apu.poner('bulto'); c.apu.aletear(); j.sfx('pio');
        await j.charla('pichon', { desde: 1 });
        c.encuadre = null;
      },
    },
    ayudas: [[37, 'borde'], [44, 'agachar']],
    hablar: { abuela: ['inicio'] },
    async terminar(j) {
      /* adentro de la casa, al lado del fogón */
      await j.telon(true);
      const c = j.cap, p = c.m.p;
      p.x = 9.2; p.y = 4; p.vx = 0; p.dir = -1;
      c.apu.poner('suelo', 7.3, 4);
      c.encuadre = { x: 7, y: 5.8, ancho: 11 };
      c.quieta = true; c.pasarCamara(1, true);
      c.clima.fuerza = 0.25;
      j.ambiente('fuego');
      await j.telon(false);
      await j.charla('casa', { alTerminar: true });
      await j.esperar(0.4);
    },
  },

  /* ---------------- 1. Los Siete Colores ---------------- */
  colores: {
    musica: 'colores', ambiente: null,
    hablar: { rosa: ['rosa', 'rosa2'] },
    zonas: {
      piedra(j) { j.grito('piedra'); j.ayuda('empujar'); },
      async mirador(j) {
        await j.enSuelo();
        const c = j.cap;
        c.encuadre = { x: c.m.p.x + 6, y: c.m.p.y + 4.5, ancho: 34, libre: true };
        await j.esperar(1.2);
        await j.charla('mirador');
        c.encuadre = null;
      },
      cuesta(j) { j.grito('cuesta'); },
    },
    ayudas: [[45, 'borde'], [88, 'escalera']],
  },

  /* ---------------- 2. Las Salinas Grandes ---------------- */
  salinas: {
    musica: 'salinas', ambiente: 'viento',
    hablar: { ceferino: ['ceferino', 'ceferino2'] },
    zonas: {
      async aleteo(j) {
        await j.enSuelo();
        await j.charla('aleteo', { hasta: 2 });
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
    zonas: {
      arranca(j) { j.grito('arranca'); },
      viaducto(j) { j.grito('viaducto'); },
      tunel(j) { j.grito('tunel'); j.ayuda('tunel'); },
      async tomas(j) {
        await j.enSuelo();
        j.cap.encuadre = { x: j.cap.m.p.x + 1.5, y: j.cap.m.p.y + 1.6, ancho: 13 };
        await j.charla('tomas');
        j.dar('farol');
        j.cap.encuadre = null;
      },
    },
  },

  /* ---------------- 4. La Puna ---------------- */
  puna: {
    musica: 'puna', ambiente: 'noche',
    hablar: { coquena: ['coquena2'] },
    empezar(j) { if (j.cap.vecinos.coquena) j.cap.vecinos.coquena.mostrar(false); },
    zonas: {
      async planeo(j) {
        await j.enSuelo();
        await j.charla('planeo', { hasta: 2 });
        j.sfx('kiia');
        j.ayuda('planeo');
        await j.evento('planeo');
        j.grito('planeo', 2);
      },
      async llamar(j) {
        await j.enSuelo();
        await j.charla('llamar', { hasta: 1 });
        j.ayuda('llamar');
        await j.evento('apuVa');
        j.grito('llamar', 1);
      },
      puma(j) { j.grito('puma'); j.sfx('rugido'); j.musica('persecucion'); },
      async coquena(j) {
        const c = j.cap, v = c.vecinos.coquena;
        if (v) v.mostrar(true);
        j.musica('puna');
        await j.enSuelo();
        c.encuadre = { x: (c.m.p.x + (v ? v.x : c.m.p.x)) / 2, y: c.m.p.y + 1.8, ancho: 13 };
        await j.charla('coquena');
        c.encuadre = null;
      },
    },
  },

  /* ---------------- 5. El Nevado ---------------- */
  nevado: {
    musica: 'tormenta', ambiente: 'viento', finPorGuion: true,
    zonas: {
      tormenta(j) { j.grito('tormenta'); j.sfx('trueno'); },
      async cumbre(j) {
        const c = j.cap;
        await j.enSuelo();
        c.encuadre = { x: 145, y: 47, ancho: 14 };
        await j.caminarA(144.4);
        c.quieta = true;
        j.musica('cumbre'); j.ambiente(null);
        c.apu.poner('sigue', c.apu.pos.x, c.apu.pos.y);
        await j.esperar(0.8);
        await j.charla('cumbre', { hasta: 4 });
        j.sfx('kiia');
        await j.charla('cumbre', { desde: 4 });
        c.apu.soltar(); j.sfx('aleteo', { grande: true });
        c.encuadre = { x: 147, y: 50, ancho: 24, libre: true, alzada: -3 };
        await j.esperar(3.5);
        j.sfx('kiia');
        await j.esperar(3.5);
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
    zonas: {
      async casa(j) {
        const c = j.cap;
        await j.enSuelo();
        c.encuadre = { x: c.m.p.x + 3, y: c.m.p.y + 1.7, ancho: 12 };
        await j.caminarA(c.m.p.x + 2.2);
        c.quieta = true;
        await j.charla('epilogo', { hasta: 3 });
        /* mirar para arriba: pasa un cóndor enorme */
        c.encuadre = { x: c.m.p.x + 1, y: c.m.p.y + 7, ancho: 24, libre: true, alzada: -5 };
        c.apu.ponerEdad(1);
        c.apu.cruzar(c.m.p.x - 20, c.m.p.x + 22, c.m.p.y + 11.5, 9);
        await j.esperar(2.2);
        j.sfx('kiia');
        await j.esperar(2.8);
        await j.charla('epilogo', { desde: 3 });
        await j.esperar(1);
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
