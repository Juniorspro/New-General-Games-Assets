# Modo GOAT: bajo consumo, máxima calidad (06/10)

Del TikTok de @dannie_bei: el mismo trabajo y las mismas respuestas, 10 veces más
barato. GOAT = **solo lo que importa + caché + en lote**. Esta es la forma de
trabajar de todas las sesiones. Ahorrar es no repetir, no hacer menos ni peor.

## 1. Solo lo que importa

En cada turno se reenvía toda la conversación: lo que entra al contexto se paga
otra vez en cada turno siguiente.

- Leer secciones (`grep -n`, `sed -n a,bp`), nunca archivos enteros "por las dudas".
- Toda salida filtrada: `tail -n 3`, `grep -c`, `| head`. De un log, la última
  línea o los errores.
- Imágenes chicas y pocas: una hoja de contactos por revisión, con celdas de
  240 px y solo de lo que cambió.
- No releer lo que se acaba de editar ni imprimir lo que se escribió.

## 2. Caché

Se paga una vez y se relee al 10 %.

- `CLAUDE.md` e `INDICE.md` cortos y quietos: son el comienzo de cada sesión.
- Trabajar de corrido; una pausa larga obliga a releer todo sin caché.
- Una sesión nueva por tarea grande: la memoria la arranca barata, y no se
  arrastra un historial enorme.

## 3. En lote

- Las llamadas independientes, juntas en un mismo turno.
- Un script que haga cinco pasos antes que cinco llamadas.
- Lo largo (renders, grabaciones) en segundo plano con **un solo** aviso al
  terminar (`until ! pgrep …; do sleep 15; done` con `run_in_background`).
  Nunca sondear ni dejar un monitor que tire una línea por cuadro: cada aviso es
  un turno que relee todo.

## 4. Máxima calidad

- Se prueba todo lo que cambió, una vez y bien, con las herramientas que ya
  existen (`revisar-duo.mjs`, `fotos.mjs`, las pruebas `.mjs` de cada juego).
  Primero el número; la imagen, solo si hace falta verla.
- Lo que se recorta es lo repetido: relecturas, sondeos, imágenes de más y
  rondas de "por las dudas". Nunca las pruebas de lo nuevo.
- Para lo simple (zips, renombrar, un arreglo chico) alcanza con menos esfuerzo
  (`/effort`, `/model`). Para lo difícil, el máximo.

## En código que llama a la API (el bot de WhatsApp, `bot-whatsapp/src/ia.js`)

- Lo que se repite en cada pedido (un catálogo, documentos, un sistema largo)
  va marcado con `cache_control`.
- Lo que puede esperar (muchas fotos de productos para describir) va por la
  Batch API (−50 %, y se suma con la caché).
- Hoy cada pregunta del bot va sola con un sistema de tres líneas: todavía no
  hay nada para cachear.
