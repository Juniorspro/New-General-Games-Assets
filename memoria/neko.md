# Neko — escritorio Linux por REST
Fuente: `herramientas/neko/LEEME.md`. Ver también: [maquina](maquina.md).

## Levantarlo

- Receta completa (imagen, variables, puerto): `herramientas/neko/LEEME.md §
  Levantar un Neko de prueba en este mismo contenedor`. Antes, Docker: ver
  [maquina](maquina.md).
- Verificado el 22/9: `ghcr.io/m1k1o/neko/xfce:latest`, `--network host`,
  escritorio XFCE a 1280x720, `/health` 200, contenedor healthy en ~12 s.
- `export no_proxy=127.0.0.1,localhost` o el proxy se mete en el medio.

## Manejarlo

- `python3 herramientas/neko/neko.py estado | tomar | ver <archivo> | hacer
  '<json>'`. El teclado y el portapapeles van por REST; **el mouse solo por
  WebSocket** (`/api/ws`), no existe por REST.
- `tomar` antes de cualquier cosa con mouse o portapapeles, o da
  `403 session is not host`.
- Las trampas (mayúsculas con Shift a mano, el rebote de `KeyDown`, `paste` que
  manda Ctrl+V y la terminal lo ignora) están en el `LEEME.md § Trampas`.

## El límite que importa

- **La pantalla la ve la sesión, no el usuario.** Neko queda atado a
  `127.0.0.1:8080` y el contenedor no recibe conexiones. El usuario solo ve las
  capturas que se le mandan.
- Para que la viera de verdad harían falta **dos** cosas, no una: un túnel de
  cloudflared (LocalTunnel no sirve: una sola conexión y 503) **y** poner Neko
  en TCP-mux (`NEKO_WEBRTC_TCPMUX`), porque el video va por WebRTC sobre UDP y
  **eso no cruza un túnel HTTP**. Sin el segundo paso se ve el login y después
  negro. (sin comprobar: la parte del túnel; el límite de UDP sí está claro).
