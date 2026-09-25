// Constantes que comparten el compositor (que corre en Node, sin three.js)
// y el dibujo. Si vivieran en luces.js, probar la música pediría cargar el
// motor 3D entero.

export const G = {
  FONDO: 0,      // el resplandor detrás del dragón y el borde de las siluetas
  VERTICAL: 1,   // los haces que bajan del cielo
  ABANICO: 2,    // los rayos que salen de atrás de la cabeza
  ALA_IZQ: 3,
  ALA_DER: 4,
  PISTA: 5,      // los travesaños y el borde de la pista
  CUERNOS: 6,    // las franjas de los cuernos y los ojos
  ROCAS: 7,      // las rayas de las rocas
};
export const N_GRUPOS = 8;

export const MODO = { APAGAR: 0, PRENDER: 1, DESTELLO: 2, DESVANECER: 3 };

// Paletas de escenario: [principal, secundario, blanco]. El índice 3 en un
// evento quiere decir "el color que ya tenía".
export const PALETAS = {
  dragon: ["#7b3dff", "#2f6bff", "#ece8ff"],
  fuego: ["#ff3d6e", "#ff9a2f", "#fff1e0"],
  hielo: ["#22d3ff", "#3d5bff", "#f0fbff"],
};
