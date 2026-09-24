# Pruebas de Estancia (Playwright)

Se corren desde la carpeta donde está el HTML empaquetado (`estancia.html`):

```sh
python3 ../../../herramientas/descargable/empaquetar.py ../../index.html estancia.html   # o donde convenga
PW=$(npm root -g)/playwright node tira.mjs escenas-marcha.mjs [filtro]   # tiras cuadro a cuadro
python3 grilla.py m-vaca-galope 4                                       # la hoja de una tira
PW=$(npm root -g)/playwright node manga-prueba.mjs                      # la manga, con clics de verdad
PW=$(npm root -g)/playwright node mundo.mjs                             # fotos del mundo
PW=$(npm root -g)/playwright node estancia-prueba.mjs                   # carga, errores, triángulos
```

`tira.mjs` congela el bucle del juego (`__juego.congelar`), avanza la
simulación a mano y saca cada cuadro con `__juego.fotoDesde(pos, mira)`: sin
congelar, el cuadro siguiente pisa la cámara puesta a mano. Los animales y el
Guacho tienen un modo prueba (`vaca.prueba = { v, cabeza, echada, estado }`,
`caballo.prueba`, `jugador.prueba = { az, ax, corre }`) para filmar cada aire
siempre igual. Las fotos quedan en `tiras/`.

Del ojo de águila, los menús y el sonido:

```sh
PW=$(npm root -g)/playwright node ojo-prueba.mjs tercera|primera|montado   # la mira, el tiro guiado y la toma de costado
PW=$(npm root -g)/playwright node menus-prueba.mjs                         # portada, opciones, cómo se juega, parte, pausa (PC y celular)
PW=$(npm root -g)/playwright node portada-prueba.mjs                       # la cámara de la portada en seis momentos
PW=$(npm root -g)/playwright node audio-prueba.mjs                         # decodifica las 41 voces y hace sonar el silbido
PW=$(npm root -g)/playwright node escaneo-prueba.mjs                       # el escaneo de cuadros: mide, elige, guarda y no vuelve a medir
```

Sin `#fijo` en la dirección, el juego hace el escaneo de cuadros antes de la
portada; en SwiftShader da ~1 fps y elige "baja" (unos 20 s). Con `#fijo` no
mide y usa "alta", así las fotos salen siempre iguales.
