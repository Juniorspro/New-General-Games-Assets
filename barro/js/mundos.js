/* ============================================================================
   barro/js/mundos.js — cómo se ve cada sede: el cielo, la luz, la tierra, el
   polvo y qué arte pintado usa (barro/arte/<mundo>-*.webp). Si una sede no
   tiene su arte todavía, usa el del bosque teñido.
   ========================================================================== */
export const MUNDOS_VISTA = {
  bosque: {
    cielo: ['#9fd0e6', '#d9eef4'], niebla: 'rgba(214,232,238,0.35)', tierra: null, polvo: [196, 160, 118], pasto: null,
    luz: 'rgba(255,240,200,0.10)', arboles: 5, frente: 5, sol: [0.78, 0.12, 'rgba(255,248,220,0.55)'],
    sombra: 'rgba(30,18,8,0.42)', borde: '#c99a63', abajo: '#2b1a0e',
  },
  canon: {
    cielo: ['#f0b36e', '#fde5c1'], niebla: 'rgba(250,214,170,0.35)', tierra: 'sepia', polvo: [214, 150, 98], pasto: null,
    luz: 'rgba(255,200,140,0.12)', arboles: 5, frente: 5, sol: [0.2, 0.18, 'rgba(255,230,180,0.6)'],
    sombra: 'rgba(60,20,8,0.45)', borde: '#e0985a', abajo: '#3a170a',
  },
  selva: {
    cielo: ['#8fc4a6', '#dcefd9'], niebla: 'rgba(200,232,210,0.4)', tierra: 'barro', polvo: [110, 82, 52], pasto: null, lluvia: true,
    luz: 'rgba(220,255,220,0.06)', arboles: 5, frente: 5, sol: [0.6, 0.1, 'rgba(240,255,230,0.3)'],
    sombra: 'rgba(16,14,6,0.5)', borde: '#8a6a3c', abajo: '#1c1206',
  },
  noche: {
    cielo: ['#0c1430', '#26355e'], niebla: 'rgba(60,80,140,0.3)', tierra: 'noche', polvo: [150, 140, 150], pasto: null, noche: true,
    luz: 'rgba(120,160,255,0.08)', arboles: 5, frente: 5, sol: [0.85, 0.1, 'rgba(230,240,255,0.4)'],
    sombra: 'rgba(0,0,10,0.55)', borde: '#b8a6a0', abajo: '#0d0a10',
  },
};
