# Escritorio virtual liviano (sin Docker)

Cuando no se puede levantar el Neko de `herramientas/neko/` —que es lo bueno,
pero necesita `dockerd`— esto alcanza para **abrir una pagina en un navegador de
verdad y mandar la captura**. Son dos archivos y ninguna imagen de 1,3 GB.

```sh
SP=/tmp/.../scratchpad
python3 -m venv $SP/venv && $SP/venv/bin/pip install mss pillow
SPDIR=$SP xvfb-run -n 99 -s "-screen 0 1600x900x24" \
  node herramientas/pc-virtual/abrir.js file://$PWD/pique3d/index.html
```

Deja `pantalla01.png`, `pantalla02.png`… en `$SPDIR`.

## Lo que se midio (19/09)

| Cosa | Estado |
|---|---|
| `Xvfb :99` a 1600x900x24 | **Anda** |
| Chromium 141 headful sobre ese display | **Anda** |
| Captura de la pantalla entera con `mss` | **Anda**, ~50 KB el PNG |
| Renderizar `file://` (nuestras paginas y juegos) | **Anda** |
| Cualquier `https://` desde ese Chromium | **Falla**: `ERR_CERT_AUTHORITY_INVALID` |
| `curl` a esos mismos sitios | **Anda** (200 en capcut.com y rezona.ai) |

## La trampa: el navegador no confia en la CA del proxy

La salida a internet pasa por el proxy del agente, que **corta y vuelve a firmar
el TLS con su propia CA** (`/root/.ccr/ca-bundle.crt`). `curl`, Python y Node la
tienen configurada; **Chromium no**. Por eso `curl` da 200 y el navegador da
pantalla roja en el mismo sitio — despista mucho, porque parece un problema de
red y es de confianza de certificados.

Chromium no lee `SSL_CERT_FILE`. Los tres caminos reales son:

1. `certutil -A -d sql:$HOME/.pki/nssdb` — **no esta instalado** `libnss3-tools`.
2. Politica gestionada en `/etc/chromium/policies/managed/*.json` con la clave
   `CACertificates` (Chrome 131+). Es el camino soportado y limpio.
3. Adentro de un contenedor: `update-ca-certificates` con el bundle copiado,
   que es exactamente lo que ya hace `herramientas/neko/LEEME.md` para el apt.

Ninguna de las dos primeras se pudo aplicar en esta sesion: el clasificador de
permisos las bloquea. Hay que habilitarlas a mano antes de usar esto para
paginas externas. Para `file://` —que es el 90 % de lo que probamos acá— no
hace falta nada.

## Para que NO sirve

- **Nadie de afuera puede mirar esta pantalla.** No hay puerto publicado; lo
  unico que sale son las capturas que mando yo. Para un escritorio que vos
  manejes hace falta el Neko, y ni asi: escucha en `127.0.0.1`.
- **Sin GPU.** Todo el render es por software.
- **Se muere con la sesion**, como todo lo del scratchpad.
