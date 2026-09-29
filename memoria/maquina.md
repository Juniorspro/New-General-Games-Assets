# La máquina (el contenedor)
Fuente: `ARRANQUE.md § 1`, `/root/.ccr/README.md`. Ver también: [juegos](juegos.md).

## Chromium y la red
- Chromium SÍ llega a internet (29/09/2026), contra lo que dice `ARRANQUE.md § 1`: lanzar con `proxy: { server: process.env.HTTPS_PROXY }`.
- Si da `ERR_CERT_AUTHORITY_INVALID`: el CA del proxy rota por sesión y el NSS queda viejo. Arreglo: `apt-get install -y libnss3-tools` y
  `certutil -A -d sql:$HOME/.pki/nssdb -n ccr-$(date +%s) -t "C,," -i /root/.ccr/agent-proxy-ca.crt`. → `nexo-xr/pruebas/web.mjs`
- Con el proxy puesto, `localhost` también pasa por el proxy y da 405: servir la página con `page.route("https://nexo.prueba/**", …)` (además da contexto seguro: cámara y sensores).
- Playwright: `require("../../mundo-ar/node_modules/playwright")`, `executablePath: "/opt/pw-browsers/chromium"`, nunca `playwright install`.
- `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`: cámara de mentira (imagen verde con reloj).
- Swiftshader: una escena three.js a 1280×640 dibuja a ~4 fps; con 400×200, ~25. Los temporizadores de la página se atrasan: en pruebas con tiempo, pasarle las horas a mano.

## Herramientas
- Pillow está (29/09/2026). `certutil` hay que instalarlo.
- jsDelivr sirve los `.cjs` como `application/node` (importScripts no los acepta): traer con fetch y evaluar. → `nexo-xr/web/index.html § TRABAJADOR`
- raw.githack.com cachea la rama unos minutos: para mostrar algo recién subido, link con el hash del commit.
- APK sin Gradle: `mundo-ar/construir.sh`, `nexo-xr/construir.sh` (javac + d8 + aapt2 + apksigner).
