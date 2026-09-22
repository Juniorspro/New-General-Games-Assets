# La máquina
Fuente: `herramientas/instalar-todo.sh`, `herramientas/neko/LEEME.md`. Ver también: [video](video.md).

## Qué hay
- 4 núcleos, 15 GB RAM, sin GPU, ~30 GB de disco libre (22/09/2026).
- `bash herramientas/instalar-todo.sh` deja todo: Docker, Neko, ffmpeg 6.1, Blender 4.0.2, yt-dlp, librosa, OpenCV, libs de juegos en `/opt/gamekit`.

## Docker y Neko
- `dockerd --iptables=false --bridge=none`; Neko `ghcr.io/m1k1o/neko/xfce`, `--network host`, 1920x1080, en `127.0.0.1:8080`.
- Clave de Neko en `/root/.neko-clave` (fuera del repo). Usuario `admin`. `no_proxy=127.0.0.1,localhost`.
- Firefox de Neko: sin la CA del proxy en su almacén NSS da `SEC_ERROR_UNKNOWN_ISSUER`. La que sirve es `/root/.ccr/agent-proxy-ca.crt` (no el bundle), cargada con `certutil -A` en el perfil. La política `Certificates.Install` sola no alcanzó (22/09).
- `pkill -f X` dentro de `docker exec bash -c "...X..."` se mata a sí mismo (sale 143). Y en el host `pkill` sale 144: correrlo solo.
