#!/bin/sh
# Aplasta los GLB que devuelve Rezona hasta que entren en un juego web.
#
# Llegan con ~990.000 triangulos y 28 MB cada uno. El propio kit dice que el
# techo en movil son 50.000 por modelo heroe: vienen veinte veces por encima.
# Servir eso es pedirle al telefono que baje 300 MB y despues los dibuje.
#
# simplify baja la malla, texture-size la recorta a 512, webp la recomprime y
# quantize achica cada vertice de float32 a enteros. Sin draco ni meshopt a
# proposito: los dos necesitan un decodificador aparte en el navegador, y el
# juego tiene que entrar en UN archivo.
set -e
cd "$(dirname "$0")"
for f in assets/m3d_*.glb; do
  n=$(basename "$f" .glb)
  npx --yes @gltf-transform/cli@latest optimize "$f" "assets/glb/$n.glb" \
    --simplify-error 0.004 --texture-size 512 \
    --compress quantize --texture-compress webp 2>&1 | grep -E "^info:" || true
done
