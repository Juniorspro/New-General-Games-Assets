# Pruebas de Frutiger Aero

Cinco baterias que se corren con un navegador de verdad (Chromium por
Playwright) contra el sitio andando en local. **71 comprobaciones.**

| archivo | que mira | cuantas |
|---|---|---|
| `navegacion.mjs` | que de todo lo que se abre se pueda salir: la cruz, el gesto de atras, Escape, y que en el telefono las ventanas no se apilen | 22 |
| `ventanas.mjs` | que las ventanas se arrastren, no se pierdan fuera de pantalla y no se metan debajo de las barras del sistema | 22 |
| `tienda.mjs` | las dos secciones, la huella del archivo, el formulario de proponer | 11 |
| `cuota.mjs` | el panel de la cuota de editor, como jefe y como editor | 10 |
| `cuota-a-mano.mjs` | dar la cuota por `@usuario` y que el mismo comprobante no sume dos veces | 6 |

## Como correrlas

```bash
# 1. preparar la base local, las cuentas y los pases
./pruebas/preparar.sh

# 2. levantar el sitio (dejalo corriendo en otra terminal)
npx wrangler pages dev --port 8788 --local

# 3. correr
cd pruebas
node navegacion.mjs && node ventanas.mjs && node tienda.mjs \
  && node cuota.mjs && node cuota-a-mano.mjs
```

Cada una termina con `---- N bien, M mal` y sale con codigo 1 si algo fallo.

## Lo que hay que saber para no perder una tarde

**Chromium ya esta instalado** en `/opt/pw-browsers/chromium`. NO corras
`npx playwright install`: la version que baja no coincide y falla con
"Executable doesn't exist". Por eso cada prueba abre con
`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.

**No calcules coordenadas a mano para hacer clic.** Esta pagina se sigue
acomodando despues de cargar (imagenes, la mascota, scroll suave), asi que
cualquier rect que midas queda viejo para cuando llega el mouse: termina
apretando el cuerpo de la ventana en vez de la barra de titulo, y la prueba
falla diciendo algo que no tiene nada que ver. Usa `locator.hover()`, que
espera a que el elemento este quieto, o dispara los eventos de puntero
directamente sobre el elemento (`ventanas.mjs` hace lo segundo).

**Que una prueba pase no quiere decir que el boton se pueda tocar.** Un
elemento puede estar en el DOM, medir 44x21 y ser invisible al dedo porque
otra capa lo tapa. Comprobalo con `document.elementFromPoint(x, y)` y fijate
que devuelva TU elemento. Asi aparecio el bug de la cruz tapada por la barra:
la cruz existia y no recibia un solo toque.

**Que la prueba se arme su propio dato.** `tienda.mjs` daba por hecha una app
que habia quedado de una corrida anterior: pasaba o fallaba segun el orden en
que se corrieran. Ahora la siembra por la API y la borra al terminar.

**Las cuentas de prueba viven en la base LOCAL** (`.wrangler/state/`), que es
un archivo en disco de esta maquina y se pierde con ella. Por eso esta
`preparar.sh`.
