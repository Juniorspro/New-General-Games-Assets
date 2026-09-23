/* ============================================================================
   ruta40/js/vehiculos.js — las fichas de los vehículos. Metros, con y para
   arriba y x para adelante, medidos desde el centro del chasis.
   ruedas[0] es la de atrás. casco: los puntos del chasis que chocan con el
   piso. cabeza: si toca el piso, se terminó.
   ========================================================================== */
export const VEHICULOS = {
  /* la chata: la camioneta vieja de campo, la de todos los días */
  chata: {
    masa: 1, inercia: 0.85,
    ruedas: [
      { x: -1.18, y: -0.18, r: 0.44, reposo: 0.42, masa: 0.13 },
      { x: 1.2, y: -0.18, r: 0.44, reposo: 0.42, masa: 0.13 },
    ],
    susp: { k: 34, c: 2.6 },
    motor: { torque: 3.3, giro: 17, freno: 5 },
    agarre: 1.15, reaccion: 0.55, aireGiro: 4.2,
    tanque: 55, consumo: 1,
    casco: [[-1.65, -0.12], [1.72, -0.12], [1.78, 0.3], [-1.7, 0.42], [-0.75, 1.05], [0.55, 1.05]],
    cabeza: { x: -0.12, y: 1.28, r: 0.3 },
  },
};
