# AEROPLAZA — trigesimocuarta vuelta (27/09/2026): que escanee y los dos ojos iguales

Pidió, con una captura de tu espacio con visor (sin piso, paredes ni objetos; la mano fantasma corrida en un ojo):
"no escanea; además en un lente detecta mal: los dos deben ser iguales". Antes: [aeroplaza-34](aeroplaza-34.md)
(la malla) y [aeroplaza-32](aeroplaza-32.md) (la cámara en tamaño real).

## Por qué no escaneaba (lo más probable, sin el celu)

- Desde la vuelta 31, `Ar.java › elegirCamara` prefiere la configuración de 60 fotos por segundo, y ARCore no da la
  profundidad con esa. Sin profundidad, la malla no tiene de dónde salir.
- Los "68 objetos" de su primera captura eran cubitos de la nube de puntos, no de la profundidad.
- (Vuelta 36: esto se reemplazó por `elegirParaProfundidad`, antes de arrancar: [aeroplaza-36](aeroplaza-36.md).)
- **Ahora** (`Ar.java › conProfundidad`, al pedir el escaneo, en el hilo de GL antes de `update`): si con la
  cámara de ahora no hay profundidad, pausa, pone una de 30 de la misma cámara (o de cualquiera), con la foto
  más cerca de 640 × 480, y sigue.
- **Sin profundidad igual hay malla**: cada 2 s, solo con los planos de ARCore (`Espacio.java › fundir` con
  `mm == null`).
- **La tarjeta lo dice** (arriba a la derecha, `espacio.js › textoMalla`):
  - "📡 profundidad: N fotos · ms";
  - "sin profundidad: la malla sale de los planos";
  - "esperando la profundidad…";
  - "⚠ malla: <error>".

  Java lo manda con `__nativo.malla(l, total, hechos, fotos, ms, error)`, también sin bloques nuevos, cada 1 s.

## Los dos ojos iguales (`espacio.js › mono`)

- La cámara del celu es una sola: la foto es la misma para los dos ojos (a 9 m). Lo dibujado con los ojos
  corridos ±3,2 cm (la mano fantasma a 30 cm: 12° entre ojo y ojo, la malla, la tarjeta) caía sobre lo de verdad
  en un ojo y corrido en el otro.
- En tu espacio, los dos ojos miran desde la cámara (la cabeza + 6 cm adelante). Cada uno sigue con su lente.

## Medido

- **`camara.mjs`, 13/13**: los dos ojos, medidos desde el centro de cada lente, difieren 1,3 (con los ojos
  corridos, como antes, 8,8). El punto cae a 0,6 y 0,8 px del centro de cada lente.
- **`malla.mjs`, 16/16**:
  - sin profundidad, con los planos solos, el piso sale 1.862 de 1.862 y la pared 1.127 de 1.127;
  - la tarjeta dice "esperando", "23 fotos · 40 ms" y el error.
- **La tanda de VR y manos**: 12 de 12.

## Trampas

- **`Nativo.alMalla = (l, n, h) => …` perdía el diagnóstico**: pasar todo (`...a`).
- **Falta en el celu**:
  - ver que con la de 30 llegue la profundidad (lo dice la tarjeta);
  - si el celu no la tiene, la malla es solo de planos.
