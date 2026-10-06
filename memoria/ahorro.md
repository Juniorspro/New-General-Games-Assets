# Ahorro de tokens (06/10)

Mandó el TikTok de @dannie_bei "Same AI. Same answers. 10x cheaper": seis
preguntas sobre los mismos 100K tokens de documentos, con precios reales.
Pidió un md y que se aplique **sin bajar la calidad**.

## Lo que dice el video

| Nivel | Qué hace | Costo |
|---|---|---|
| JUNIOR | manda los 100K de documentos en cada pregunta | $1,24 |
| MIDDLE | recorta a los 40K que importan | $0,52 |
| SENIOR | caché de prompt: se paga una vez y se relee al 10 % | $0,18 |
| GOAT | caché + Batch API (−50 %) para lo que puede esperar | $0,12 |

La mayor parte de la cuenta es lo mismo mandado otra vez. Caché y lote se suman.

## Cómo aplica a estas sesiones

En cada turno se reenvía **toda** la conversación. Lo que se mete en el contexto
se vuelve a pagar en cada turno siguiente (en caché sale al 10 %, pero igual se
paga). Ahorrar es meter menos cosas y hacer menos turnos, no hacer menos trabajo.

1. **MIDDLE — meter solo lo que importa.**
   - Leer secciones con `grep -n` y `sed -n a,bp`, nunca archivos enteros "por las dudas".
   - Toda salida con filtro: `tail -n 3`, `grep -c`, `| head`. Logs de render o de
     grabación: solo la última línea o los errores.
   - **Imágenes:** cuestan mucho y se quedan en el contexto. Una hoja de contactos
     por revisión, chica (celdas de 240 px), y solo de lo que cambió. Nada de mirar
     cuadro por cuadro lo que ya se vio.
   - No volver a leer un archivo recién editado; no imprimir archivos que se escribieron.
2. **SENIOR — no romper la caché.**
   - `CLAUDE.md` e `INDICE.md` cortos y quietos: son el comienzo de cada sesión.
   - Trabajar de corrido: una pausa larga hace releer todo sin caché.
3. **GOAT — juntar y no sondear.**
   - Varias llamadas independientes, en el mismo turno.
   - Un script que haga cinco pasos antes que cinco llamadas.
   - Lo largo (render, grabar), en segundo plano y con **un** aviso al terminar
     (`until ! pgrep …; do sleep 15; done` con `run_in_background`). Nada de
     preguntar cada minuto ni de monitores que tiran una línea por cuadro: cada
     aviso es un turno que relee todo.
   - Revisar con lo que ya existe: `revisar-duo.mjs`, `fotos.mjs`, las pruebas
     `.mjs` de cada juego. Primero el número; la imagen, solo si hace falta.
4. **Calidad igual o mejor.** Se prueba lo que cambió, una vez y bien. Lo que se
   ahorra es lo repetido: relecturas, sondeos, imágenes de más y rondas de
   "por las dudas".

## Lo que puede hacer quien pide

- **Una sesión nueva por tarea grande.** La memoria hace que arrancar cueste
  poco; una sesión de días arrastra un resumen enorme en cada turno.
- Para lo simple (zips, renombrar, un arreglo chico) alcanza un modelo o un
  esfuerzo más bajo: `/model` o `/effort` en Claude Code.
- `/compact` al cambiar de tema dentro de la misma sesión.

## El bot de WhatsApp (`bot-whatsapp/src/ia.js`)

Hoy cada pregunta va sola con un sistema de tres líneas: no hay nada repetido
que cachear (la caché pide un largo mínimo). Si algún día manda un catálogo o
documentos en cada pregunta, se marca ese bloque con `cache_control`. Si hay que
describir muchas fotos de productos que pueden esperar, va por la Batch API (−50 %).
