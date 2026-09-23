# Generar imágenes
Ver también: [rezona](rezona.md).

## Qué usar hoy (22/9/2026)

- **Higgsfield por MCP.** Medido: modelo `gpt_image_2_5`, **1 crédito** por
  imagen de 1024x1024, unos 40 s de punta a punta. Saldo el 22/9: 4.454
  créditos, plan team. **Es otra bolsa: no toca los créditos de Rezona.**
- `get_cost: true` cotiza sin generar. Conviene antes de una tanda.
- Medido el 23/9 en el historial: `gpt_image_2_5` cobró **0,25** por imagen
  (sale como "GPT Image 2.5 Flare"), no 1 como decía la cotización del 22/9;
  sacar el fondo (`remove_background`) cuesta 1 y tarda ~1 minuto en cola.
- Escribe bien texto con tildes: "EL PAPUCHÓN" y "ÚLTIMO MOMENTO" salieron
  perfectos en las dos variantes del logo.
- El saldo es de un **plan team**: otros gastan de la misma bolsa. El 22/9 entre
  las 16:38 y las 16:44 (hora argentina) se fueron ~306 créditos en 3D Rigging,
  Tripo Image to 3D y Nano Banana que no fueron de esta sesión. Si el saldo no
  cierra, mirar `transactions` antes de sacar conclusiones.
- Rezona está caído para generar (ver [rezona](rezona.md)). No insistir sin
  antes leer esa nota.

## Pixel art: el render no es pixel art

- Medido: un render de "pixel art" de 1024px trajo **34.387 colores únicos**.
  Es un dibujo que *parece* pixel art. Para un juego no sirve: no se paletiza,
  no escala limpio y pesa casi 1 MB.
- **No hay cuadrícula global.** Los bordes vienen en bandas de 1-2 px por
  antialiasing, y las distancias más repetidas entre bordes caen en 9-13 px,
  que no dividen 1024.
- **Dos formas de "medir la grilla" que NO funcionan**, para no volver a
  probarlas: el error medio por celda **crece siempre** (13, 23, 36, 53 para
  lados de 8, 16, 32 y 64), porque una celda sobre un borde tiene varianza alta
  aunque la grilla sea la correcta; y barrer n de 48 a 96 buscando el mínimo
  **baja monótono**, así que el "mejor" es siempre el último del rango.
- Conclusión: **el tamaño del sprite es una decisión, no una medición.** 64x64
  va bien: divide 1024 exacto y el dibujo ocupa ~80 píxeles de ancho.

## Cómo se convierte bien

- El color de cada celda es el **más frecuente**, no el promedio: promediando,
  el contorno oscuro se mezcla con el relleno y la silueta queda con halo.
- Paleta con `MAXCOVERAGE` de Pillow, no la de fábrica: los ojos y la nariz son
  cuatro píxeles y el método por defecto se los come.
- La vista ampliada va con `Image.NEAREST`. Cualquier otro filtro lo suaviza y
  arruina lo que se acaba de ganar.
- Pillow **no viene** en la máquina: `pip install pillow`.
- (sin comprobar) El conversor quedó escrito en el scratchpad de la sesión del
  22/9 y **no se commiteó**, así que se perdió con el contenedor. Si hace falta
  otra vez, se reescribe con lo de arriba.
