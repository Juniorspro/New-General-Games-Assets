# Five Nights at Freddy's 2 → un solo HTML (port no oficial)

Port para uso personal de **Five Nights at Freddy's 2** (Scott Cawthon, 2014), versión subida por
**SuperMiGamer003** (es el FNaF 2 v1.033 con su demo extendida). El juego, sus personajes, imágenes y sonidos son
de su autor: **nada de eso está en este repo**; sale del `.exe` original con las herramientas de acá.

- **`herr/`** (Python, propio): lee el `.exe` de Clickteam Fusion 2.5 (build 288): `ctf.py` (trozos, objetos, eventos,
  bancos de imágenes y sonidos), `cifra.py` (el cifrado de los trozos: tabla tipo RC4 con título + copyright +
  ruta del proyecto), `exportar.py` (todo a `web/datos/`: `juego.json`, imágenes `.webp` al 75 % y sonidos Opus),
  `ver.py` (los eventos de un frame en texto).
- **`web/`**: el motor de Clickteam en JS (`motor.js`: corre los eventos originales), sonido por canales, la intro
  de JXStudios, el lienzo 4:3 (girado 90° con el celu parado) y los controles como en FNaF 2 para celular.
- **`armar.mjs`**: `dist/` para probar, y con `UNICO=1` `salida/fnaf2.html` (un archivo, doble clic, ~20 MB).

```
python3 -I herr/exportar.py descarga/juego.exe web/datos
UNICO=1 node armar.mjs
```
