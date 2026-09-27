# AEROPLAZA — trigesimoctava vuelta (27/09/2026): la cabeza en 6 ejes, suave

Pidió, con un TikTok de metanexusxr (no se pudo ver: los links de TikTok no se bajan; solo el autor, por oEmbed):
"hay que lograr un 6DoF súper suave y goty, porque es muy impreciso aún". Antes: [aeroplaza-27](aeroplaza-27.md)
(ARCore en la APK) y [aeroplaza-31](aeroplaza-31.md) (la altura quieta).

## Por qué era impreciso

- **El giro de la vista era el de ARCore** (`nativo.js › poseEn`): una pose por foto (30-60 por segundo), que
  llega 30-60 ms tarde y pasa por el puente de la WebView (`evaluateJavascript`).
  - Se adelantaba con el giro de las dos últimas poses: ruidoso, y en un giro rápido erraba hasta 17,7°.
  - El giroscopio de la web solo se usaba para seguir si ARCore se perdía.
- **El lugar** se adelantaba 40 ms (el 80 % de hasta 50) de los ~70 que tarda.

## Lo que quedó (como un visor)

- **`Fusion.java`** (Java puro, se prueba en la compu) y **`Cabeza.java`** (los sensores).
  - El giro, del `TYPE_GAME_ROTATION_VECTOR` (giróscopo + acelerómetro, sin brújula), con `SENSOR_DELAY_FASTEST`.
  - Se adelanta hasta cuando se ve con la velocidad del `TYPE_GYROSCOPE`: `q · exp(ω·dt)`, hasta 80 ms.
  - Guarda 512 muestras para saber el giro en la hora de cada foto.
- **ARCore corrige el rumbo de a poco**: `qA = W · qi · C`, y `W` va hacia `qA · C⁻¹ · qi⁻¹`, 0,12 por foto (menos
  girando: `/(1 + ω/3)`).
  - Se compara el giroscopio EN LA HORA DE LA FOTO: el atraso de ARCore no entra.
  - Si la hora de la cámara no cae en el reloj del giroscopio, se usa ahora − 30 ms.
- **Los ejes (`C`)**: el celu y la cámara "orientada a la pantalla" difieren en 0/90/180/270° alrededor de z. Se
  elige solo:
  - lo que giró ARCore entre dos fotos contra lo que giró el giroscopio, con cada uno;
  - el error relativo, suavizado;
  - gana si es < 0,35 y la mitad del segundo, después de 8 fotos que giraron más de 0,7°.
- **El lugar**: los ojos (6 cm detrás del celu) de la última foto, con su velocidad suavizada (0,3 por foto),
  adelantados todo (hasta 80 ms), y un resorte de 15 ms (`TAU_LUGAR`) para que cada foto no sea un escalón.
- **`AeroplazaNativo.cabeza(adelantoMs)`**: el juego la lee al dibujar, sin esperar mensajes. Da
  `"qx,qy,qz,qw,x,y,z"` o `""` si todavía no hay ejes.
  - `nativo.js › poseEn` la usa primero: el VR y tu espacio mejoran los dos, sin tocar `vr.js` ni `espacio.js`.
  - Sin ella (una APK vieja, la web, o antes de elegir los ejes), lo de antes. `Nativo.conCabeza` dice cuál.
- **En `Ar`**: `cabeza.f.foto(...)` en cada foto que sigue. Se prende con `iniciar`/`reanudar` y se apaga con
  `pausar`/`cerrar`.

## Medido (`pruebas/cabeza.mjs`, 16/16)

- **La parte de Java** (`pruebas/cabeza/PruebaFusion.java`):
  - la cabeza de mentira gira suave con giros de 70° en 0,35 s, y se corre ±10 cm;
  - el giroscopio va a 200 por segundo, con ruido de 0,03° y un rumbo que se corre 0,5°/s (mucho más que uno de
    verdad);
  - ARCore va a 30 por segundo, con ruido de 0,15° y 1,5 mm, y llega 45 ms tarde;
  - se pide la cabeza para 25 ms después.

| a 25 ms | antes (ARCore solo) | ahora |
|---|---|---|
| giro, medio / p95 (°) | 2,08 / 6,21 | 0,36 / 1,22 |
| giros rápidos, lo peor (°) | 17,7 | 2,4 |
| temblor del giro (°, 2.ª diferencia) | 3,57 | 0,42 |
| lugar de los ojos, medio (mm) | 13,1 | 10,5 |
| temblor del lugar | 9,45 | 5,26 |

- **Con las cuatro pantallas**, elige bien los ejes (p95 1,24-1,36°).
- **Con ARCore a 60**: 0,29° contra 1,56°. **Con otro reloj**: 0,96° contra 2,09°. Leer: 0,1 µs.
- **Sin ruido ni deriva queda 0,23°**: es el adelanto de 30 ms con la cabeza acelerando. Pasa con cualquier
  adelanto de velocidad constante.
- **El juego, con un Android de mentira**:
  - el VR gira 30° y se corre 20 cm con la cabeza nativa aunque ARCore no se mueva;
  - la pide 25 ms adelantada;
  - sin ella, sigue con ARCore;
  - tu espacio usa su giro y sus ojos.
- **Barrido** (`PruebaFusion 0.03 0.15 0.5 GANA=…,GANA_W=…,TAU=…,AL=…,TL=…`):
  - `GANA` 0,06 → 0,12 bajó el medio de 0,74 a 0,46;
  - `GANA_W` 3, a 0,36;
  - adelantar todo el lugar: 14,8 → 10,5 mm;
  - `TAU` 10 ms temblaba más (6,95) y 20 ms atrasaba (12,5 mm).

## Trampas

- **Falta en el celu**:
  - si la hora de la cámara de ARCore es la del giroscopio (casi siempre, `elapsedRealtimeNanos`);
  - cuántas muestras por segundo da el `GAME_ROTATION_VECTOR` en su celu.
- **Si el celu no tiene giróscopo** (sin `GAME_ROTATION_VECTOR`), la cabeza nativa nunca arranca y queda lo de
  antes.
