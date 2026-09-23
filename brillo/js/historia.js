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
};
