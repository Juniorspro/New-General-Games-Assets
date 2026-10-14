# Estudio Papuchón

Editor de video en el navegador para **Noticias El Papuchón**. Metés tus videos,
les ponés encima los gráficos del canal y sacás un MP4 listo para TikTok.

Abrilo acá: https://raw.githack.com/juniorspro/new-general-games-assets/claude/papa-del-patron-3cpe64/estudio-papuchon/index.html

## Qué hace

- **Tus videos, fotos y audios**: se importan (o se sueltan encima) y quedan
  guardados en el navegador. No se sube nada a ningún lado.
- **Línea de tiempo**: cortar (S), recortar desde los bordes, mover, duplicar,
  deshacer. Pistas de video, encima (recuadros), gráficos, subtítulos, voz,
  música y efectos.
- **Gráficos del canal** (20, dibujados por código, se animan solos): mosca con
  el logo y EN VIVO, marca de agua, intro, cierre "seguinos", zócalos (último
  momento, noche, persona), ticker, placa de último momento, sellos (EXCLUSIVO,
  FALSO, URGENTE…), titular con palabra resaltada, cita, ubicación, fecha,
  fuente, barra de progreso, cortina, círculo y flecha, texto libre.
- **Vestir con el canal**: un botón pone intro, mosca, zócalo, ticker, barra de
  progreso y cierre ajustados a lo que dura el video.
- **Voz de locutor (hombre)** generada en el navegador a partir de un guion,
  con tres tonos y velocidad. Crea los subtítulos palabra por palabra. La
  primera vez baja el modelo (63 MB); después anda sin internet.
- **Subtítulos** estilo TikTok (karaoke amarillo, caja, contorno, banda roja),
  de la voz, de un texto pegado o de un archivo SRT.
- **Música y efectos** hechos acá mismo (sin derechos de nadie): cuatro
  cortinas y nueve efectos. La música baja sola cuando habla la voz.
- **Mi marca**: nombre, @usuario, colores y logo propio; cambia todos los gráficos.
- **Modo filmable**: filmás con el celular con la mosca, el zócalo y el ticker
  encima, con apuntador. Lo grabado entra al editor.
- **Exportar**: MP4 1080×1920 (o 720p), cuadro por cuadro, igual a la vista
  previa. También foto de portada.

## Dónde anda qué

| | githack / archivo descargado | vista de claude.ai |
|---|---|---|
| Editar, gráficos, música, exportar | sí | sí (guardar pasa por el botón de descarga) |
| Voz generada | sí | no (no deja bajar el modelo) |
| Cámara y micrófono | sí (githack) | no |

## Por dentro

Ver `ARQUITECTURA.md`. Scripts clásicos en `js/`, React 18 + htm sin compilar.
Para armar el archivo de un solo HTML:
`python3 herramientas/descargable/empaquetar.py estudio-papuchon/index.html salida.html`
(desde la raíz del repo).
