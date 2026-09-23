/* ============================================================================
   ruta40/js/vista.js — cómo se ve cada tramo. Aparte del dibujo para que la
   lógica del viaje (y las pruebas en Node) la usen sin cargar imágenes.
   ========================================================================== */
/* cómo se ve cada tramo: el borde de la tierra, el pasto, el polvo, el clima y los adornos
   ([nombre, alto en m, peso]) al costado de la ruta y en los cerros de atrás */
export const VISTA = {
  puna: { borde: '#c9a24a', claro: '#ecd27e', oscuro: '#6e4e22', pasto: 'paja', polvo: [196, 160, 110], clima: 'motas', cerca: '#9c7a45',
    adornos: [['vicuna', 1.5, 3], ['llama', 1.8, 2], ['piedras', 1.0, 3], ['coiron', 0.8, 5], ['capilla', 5.2, 0.35], ['santuario', 1.5, 0.4]], aves: 'condor' },
  quebrada: { borde: '#c07642', claro: '#e7a56c', oscuro: '#5b3120', pasto: 'ripio', polvo: [190, 128, 88], clima: 'motas', cerca: '#9a5a3a',
    adornos: [['cardon', 4.4, 5], ['cactus', 0.7, 3], ['llama', 1.8, 1.2], ['piedras', 1.1, 2], ['capilla', 5.2, 0.3], ['santuario', 1.5, 0.5]], aves: 'condor' },
  salinas: { borde: '#f4f6f4', claro: '#ffffff', oscuro: '#b9c2c6', pasto: 'sal', polvo: [240, 244, 246], clima: 'brillo', cerca: '#d9d4dc',
    adornos: [['bloquesSal', 1.0, 4], ['sal', 0.55, 4], ['flamenco', 1.4, 2], ['cartel', 2.0, 1]], aves: 'flamencoVuela' },
  valles: { borde: '#a44b31', claro: '#d07a55', oscuro: '#4a1f16', pasto: 'monte', polvo: [176, 96, 70], clima: 'motas', cerca: '#7f3a28',
    adornos: [['algarrobo', 4.8, 3], ['roca', 6.2, 1.2], ['cardon', 4, 2], ['vid', 1.6, 2], ['barril', 1.0, 1], ['capilla', 5.2, 0.3]], aves: 'condor' },
  cuyo: { borde: '#c8a46a', claro: '#e9cf9a', oscuro: '#5e4a2c', pasto: 'ripio', polvo: [200, 170, 120], clima: 'motas', cerca: '#8a7b4c',
    adornos: [['alamo', 11, 3], ['vid', 1.6, 5], ['barril', 1.0, 1.5], ['algarrobo', 4.6, 1.2], ['tranquera', 1.2, 1], ['santuario', 1.5, 0.6]], aves: 'condor' },
  patagonia: { borde: '#b8ac72', claro: '#ddd39c', oscuro: '#524c33', pasto: 'coiron', polvo: [170, 160, 120], clima: 'viento', cerca: '#7d7a58',
    adornos: [['coiron', 0.9, 6], ['oveja', 1.0, 3], ['guanaco', 1.8, 2], ['tranquera', 1.2, 1.2], ['piedras', 1.0, 1.5], ['surtidor', 2.0, 0.25]], aves: 'condor' },
  glaciar: { borde: '#f1f6fa', claro: '#ffffff', oscuro: '#9fb3c4', pasto: 'nieve', polvo: [236, 242, 248], clima: 'nieve', cerca: '#8a8f99',
    adornos: [['lenga', 6.5, 4], ['hielo', 1.3, 2], ['piedras', 1.1, 2], ['guanaco', 1.8, 0.8]], aves: 'condor' },
};
