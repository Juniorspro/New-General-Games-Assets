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
