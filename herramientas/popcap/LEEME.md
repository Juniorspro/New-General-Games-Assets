# PopCap (SexyAppFramework)

Plantas vs. Zombies, Zuma, Peggle, Bejeweled, Bookworm, Chuzzle, Insaniquarium…
Todos guardan sus datos en un `main.pak` con el mismo formato.

```bash
python3 -I pak.py listar  main.pak            # tamaño y nombre de cada archivo
python3 -I pak.py sacar   main.pak CARPETA    # todo afuera, con sus carpetas
python3 -I pak.py achicar main.pak nuevo.pak  # PNG/JPG recomprimidos, sin perder un píxel
```

## El formato

- Todo el archivo va con XOR `0xF7` (no es cifrado: un byte fijo).
- Adentro: magia `C0 4A C0 BA`, 4 bytes de versión, y la lista de entradas
  (bandera `0x00`, largo del nombre, nombre con `\`, tamaño de 4 bytes, fecha de
  8 bytes) que termina en la bandera `0x80`. Después, los datos en el mismo orden.
- `compiled/reanim/*.compiled` y `compiled/particles/*.compiled`: animaciones y
  partículas ya procesadas. Cabecera `D4 FE AD DE` + tamaño, y zlib. Adentro, un
  hash del esquema y el volcado de las estructuras **de 32 bits** (punteros de 4
  bytes). Por eso se pueden leer tal cual en WebAssembly y no en 64 bits.
- Las imágenes con transparencia suelen ser un JPG con su máscara aparte
  (`nombre_.png` o `_nombre.png`).

## `achicar`, y por qué rinde poco

PopCap ya comprimía bien: en PvZ, 23,76 → 22,92 MB (−3,5 %). Cada archivo nuevo
se decodifica y se compara con el original **píxel por píxel, alfa incluido**; si
difiere en algo o no pesa menos, queda el original. Los colores bajo alfa 0 no se
tocan (con filtrado bilineal aparecen en los bordes). El resto del pak es audio
(OGG, MO3) que no se recomprime sin perder calidad.

Necesita `pyoxipng` y `Pillow` (pip) y `jpegtran` (`libjpeg-turbo-progs`). Si falta
algo, el archivo se deja como vino.
