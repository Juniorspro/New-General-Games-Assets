/* ============================================================================
   brillo/js/historia.js — lo que pasa en cada mundo: la escena del comienzo,
   lo que se dice al pasar por cada zona y lo que pasa al tomar el orbe.
   Cada guion recibe j (el director visto desde la historia) y espera con
   await. Si el jugador se va a mitad de camino, las esperas de ese mundo no
   vuelven nunca y el guion se queda quieto ahí, sin hacer nada.
   ========================================================================== */

export const HISTORIA = {
  /* ============================== 1. La Colina Serena ============================== */
  colina: {
    musica: 'colina',
    async inicio(j, retomado) {
      const mora = j.npc('mora');
      if (retomado) { mora.visible = false; return j.empezar(); }
      j.guion(true);
      await j.esperar(0.5);
      await j.narrar('colina');
      mora.anim = 'saluda';
      await j.charla('inicio');
      mora.anim = 'quieto';
      /* la Actualización: baja un cuadrado gris y se pone todo apagado */
      j.musica(null);
      j.sfx('plano');
      const P = j.plano(mora.x + 44, -20);
      await j.mover(P, mora.x + 34, mora.y - 40, 1.8);
      mora.mira = 1;
      await j.charla('actualizacion', {
        alLinea(i) {
          if (i === 1) { j.gris(0.8, 1.4); j.sfx('plano'); }
          if (i === 2) { mora.id = 'moraPlana'; j.chispas(mora.x, mora.y - 16, '#c9ced4'); j.sfx('rompe'); }
          if (i === 4) j.gestoNick('triste');
        },
      });
      /* se la lleva para arriba */
      j.sfx('ola');
      j.mover(mora, mora.x + 26, -70, 2.4);
      await j.mover(P, P.x + 26, -110, 2.4);
      mora.visible = false; P.visible = false;
      j.gris(0, 2.5);
      await j.esperar(0.8);
      await j.charla('solo');
      j.gestoNick(null);
      j.guion(false);
      await j.empezar(['mover', 'saltar']);
    },
    zonas: {
      estanque: (j) => j.ayuda('nadar'),
      hongo: (j) => j.ayuda('hongo'),
      async tito(j) {
        const t = j.npc('tito');
        t.anim = 'saluda';
        await j.hablar('tito', () => { t.anim = 'quieto'; });
        j.aprendio('hZumbido', 'tito');
        await j.esperar(1.4);
        j.ayuda('zumbido');
      },
      async planito(j) { await j.hablar('planito'); j.ayuda('planito'); },
    },
    async fin(j) {
      await j.orbe();
      await j.mensaje('mora1');
      await j.terminar();
    },
  },

  /* ============================== 2. El Arrecife de Cristal ============================== */
  arrecife: {
    musica: 'arrecife',
    async inicio(j, retomado) {
      if (!retomado) { j.guion(true); await j.esperar(0.4); await j.narrar('arrecife'); j.guion(false); }
      await j.empezar(retomado ? [] : ['nadar']);
    },
    zonas: {
      async dorado(j) {
        const d = j.npc('dorado');
        d.mira = -1;
        await j.hablar('dorado');
        j.aprendio('hBurbuja', 'dorado');
        await j.esperar(1.2);
        j.ayuda('burbuja');
      },
      async pozo(j) { await j.hablar('dorado2', null, 'dorado'); j.ayuda('burbujota'); },
    },
    async fin(j) { await j.orbe(); await j.mensaje('mora2'); await j.terminar(); },
  },

  /* ============================== 3. Ciudad Vidrio ============================== */
  ciudad: {
    musica: 'ciudad',
    async inicio(j, retomado) {
      if (!retomado) { j.guion(true); await j.esperar(0.4); await j.narrar('ciudad'); j.guion(false); }
      await j.empezar();
    },
    zonas: {
      async lila(j) { const l = j.npc('lila'); l.anim = 'saluda'; await j.hablar('lila', () => { l.anim = 'quieto'; }); },
      async lila2(j) { await j.hablar('lila2', null, 'lila'); },
    },
    async fin(j) { await j.orbe(); await j.mensaje('mora3'); await j.terminar(); },
  },

  /* ============================== 4. El Cielo Burbuja ============================== */
  cielo: {
    musica: 'cielo',
    async inicio(j, retomado) {
      if (!retomado) { j.guion(true); await j.esperar(0.4); await j.narrar('cielo'); j.guion(false); }
      await j.empezar();
    },
    zonas: {
      async sol(j) { const q = j.npc('sol'); q.anim = 'saluda'; await j.hablar('sol', () => { q.anim = 'quieto'; }); j.ayuda('corriente'); },
      burbujota: (j) => j.ayuda('burbujota'),
      async sol2(j) { await j.hablar('sol2', null, 'sol'); },
    },
    async fin(j) { await j.orbe(); await j.mensaje('mora4'); await j.terminar(); },
  },

  /* ============================== 5. La Noche Aurora ============================== */
  aurora: {
    musica: 'aurora',
    async inicio(j, retomado) {
      if (!retomado) { j.guion(true); await j.esperar(0.4); await j.narrar('aurora'); j.guion(false); }
      await j.empezar();
    },
    zonas: {
      async vio(j) { await j.hablar('vio'); },
      aurora: (j) => j.ayuda('aurora'),
      async vio2(j) { await j.hablar('vio2', null, 'vio'); },
    },
    async fin(j) { await j.orbe(); await j.mensaje('mora5'); await j.terminar(); },
  },

  /* ============================== 6. El Plano ============================== */
  /* todo empieza gris y callado; cada sesión devuelve una capa de color y de música */
  plano: {
    musica: 'plano',
    async inicio(j, retomado) {
      const k = j.sesionesPasadas();
      j.capas(k, 0.01);
      j.N.orbeTomado = true;
      const mora = j.npc('moraPlana');
      j.plano(mora.x + 22, mora.y - 30);
      if (!retomado) { j.guion(true); await j.esperar(0.4); await j.narrar('plano'); j.guion(false); }
      await j.empezar();
    },
    sesion(j) { j.capas(j.sesionesPasadas(), 2.2); },
    zonas: {
      async mora5(j) { await j.mensaje('mora5'); },
    },
    async fin(j) {
      j.guion(true);
      await j.hastaQue(() => j.N.m.p.enSuelo);
      j.quieto(true);
      const mora = j.npc('moraPlana'), P = j.actor('plano');
      j.camara((j.N.m.p.x + P.x) / 2, P.y - 40);
      await j.charla('plano', {
        alLinea(i) {
          if (i === 4) { j.zumbidoFinal(P.x, P.y - 18); }
        },
      });
      /* el color vuelve de golpe, y la música entera */
      j.capas(5, 3);
      j.musica('final');
      P.tibio = true;
      j.chispas(P.x, P.y - 18, '#ffd6ec');
      await j.esperar(1.2);
      mora.id = 'mora'; mora.anim = 'feliz';
      j.chispas(mora.x, mora.y - 16, '#a6ee6a'); j.sfx('restaura');
      j.gestoNick('feliz');
      await j.esperar(0.8);
      await j.charla('final');
      mora.anim = 'abraza'; j.gestoNick('abraza');
      await j.esperar(1.2);
      await j.narrarFin();
      await j.terminar();
    },
  },
};
