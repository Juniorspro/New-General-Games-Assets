# AEROPLAZA — trigesimoséptima vuelta (27/09/2026): manos más estables (web y APK) y el link del HTML

Pidió: "quiero que logres aún más estabilidad en las manos; en HTML también; necesito el link para testear el HTML
3DoF". Antes: [aeroplaza-28](aeroplaza-28.md) (el atraso, cómo se barre) y [aeroplaza-37](aeroplaza-37.md).

## El link del HTML (3DoF, con cámara y giroscopio)

- **`https://raw.githack.com/juniorspro/New-General-Games-Assets/claude/fijate-iszyer/aeroplaza/aeroplaza.html`**:
  sirve `aeroplaza.html` de la rama como `text/html`, por https (la cámara y el giroscopio lo piden). Sigue a la
  rama (unos minutos de caché).
  - Comprobado: el sha256 que baja es el del último commit.
  - Recién pusheado, el de la rama tarda (seguía el anterior a los ~5 min). Con el commit en vez de la rama
    (`…/New-General-Games-Assets/<commit>/aeroplaza/aeroplaza.html`) sale al toque: dar los dos.
- **jsDelivr no sirve**: da el HTML como `text/plain`.
- **El artefacto no sirve para las manos**: no tiene cámara ni micrófono.
- **Chromium del contenedor no abre el link** (`ERR_CERT_AUTHORITY_INVALID`: no confía en el proxy). Se comprueba
  con curl, nunca apagando TLS.

## Qué temblaba (medido con sus tres videos, `herramientas/manos-video.mjs`)

- **Métricas nuevas**: `vib` (lo que lo dibujado se aparta de su propio promedio de ±54 ms: el temblor que se ve
  aunque la mano se mueva).
  - Del centro de costado (`vib`) y en profundidad (`vibZ`).
  - De las puntas contra la palma (`vibDedos`), en los ejes de la palma sin el giro (`vibDoblan`).
  - Del giro de la palma (`vibGiro`, grados).
  - Todo también con la mano quieta (`…Q`), más `tiemblaZ` y `tiemblaDedos`.
- **Con la mano quieta**:
  - lo que más se movía era el giro, 3,1-6,7° (crudo 5-14), y los dedos doblándose, 6,4-8,3 mm;
  - el centro de costado, 0,7-1,4 mm: ya estaba bien.
- **El giro temblaba por el One Euro**: con el ruido de MediaPipe, la velocidad del giro (2,9 Hz) es casi toda ruido
  y abre el filtro (`beta` 4,62 por rad/s) justo con la mano quieta.
  - Bajar el corte quieta no cambiaba nada.
  - Un piso de ruido (`piso`, lo que la velocidad no abre) ayuda poco.
  - Sacar `beta` (corte fijo de 3-3,5 Hz) lo baja a la mitad.
- **Los dedos**: su adelanto (0,5) y su `beta` (2,5) agrandan el ruido.

## Lo que quedó (`js/manos.js › SUAVIDAD › pose`)

- **Medio (de entrada)**: giro `beta` 0, corte 3,5 Hz, `giroAd` 1,2; dedos `beta` 1,2, adelanto 0,35.
- **Suaves**: giro corte 2,5; dedos adelanto 0,25.
- **Rápidas**: como antes (`P_GIRO`, `P_DEDOS`, `GIRO_AD`).
- `Mano.ponerPose` aplica la pose del nivel desde `Manos.mover` (solo con la cámara: web y APK igual).
- Los filtros tienen `piso` (en 0).

| medio: sus 3 videos (30 / 60 / 60) | antes | ahora |
|---|---|---|
| bamboleo del giro quieta (°) | 4,97 / 6,65 / 3,08 | 2,47 / 3,64 / 2,01 |
| bamboleo de los dedos quieta (mm) | 6,36 / 8,33 / 6,61 | 4,23 / 6,65 / 5,08 |
| patadas por minuto | 117 / 181 / 35 | 102 / 161 / 29 |
| centro de costado quieta (mm) | 1,14 / 1,40 / 0,71 | 1,11 / 1,35 / 0,74 |
| ver (% de la palma) | 56,5 / 56,6 / 34,0 | 57,9 / 57,8 / 34,3 |

- **`manos-lento`**: giro 17,6 → 19,3° atrás (p95 32,7 → 35,2); el dedo que se dobla 232 → 258 ms; de costado,
  el fino y el paso, igual.
- **Con otras semillas, el doble de ruido, dedos que fallan y MP=1**: dobla 4,5 → 4,3 y tiembla 0,165 → 0,154
  (6-10); dobla con RUIDO=2 8,1 → 7,6. El giro, siempre ~2° más atrás; el dedo, 25-45 ms.
- **Suaves**: giro 2,07 / 3,05 / 1,72°, dedos 3,95 / 6,27 / 4,48 mm; el paso 452 ms.

## Cómo se barre ahora (en el repo)

- `herramientas/barrer-manos.mjs`: `printf '%s\n' '{} base' '{"media.giro.corte":3} x' | node
  herramientas/barrer-manos.mjs`, de a 4, ~3 min por tanda de 8.
  - Las claves: `C_PISO`, `P_GIRO.beta`, `media.rl` y `media.giro.beta`.
- **Trampa**: medio y suaves tienen su `pose`, que manda sobre `P_GIRO`/`P_DEDOS`. Tocar esos solo cambia rápidas.
  Con la pose vieja puesta en medio, da la base exacta.
