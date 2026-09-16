# Sabueso de Ofertas

Página estática, un solo archivo, sin dependencias ni build.

- **En vivo:** https://juniorspro.github.io/General-Assets-Games/
- **Fuente:** [`docs/index.html`](index.html)

También vive aquí la [**Biblioteca de Estilos**](biblioteca/) — 122 sitios de
referencia capturados en vivo con Playwright, con su paleta y tipografías
extraídas del CSS de cada página.

## Qué hace

Convierte una frase en lenguaje natural ("PS5 Slim usada con dos controles, máximo 7000")
en **seis ángulos de búsqueda** distintos, cada uno con enlaces ya filtrados a MercadoLibre,
Marketplace de Facebook, OLX/Wallapop, eBay, Google Shopping y Amazon. Añade rango de precio
de referencia (chollo / justo / caro), oferta calculada (anclaje, objetivo, abandono),
checklist de inspección física, trampas del producto y mensajes listos para el vendedor.

Los seis ángulos son la parte que de verdad encuentra gangas: directo, errores de escritura
del vendedor, venta urgente, lote o combo, mal categorizado y entrega en mano.

## Dos modos, un solo archivo

| Dónde | Interpretación de la orden |
| --- | --- |
| Publicada como artifact de Claude | IA real vía `claude.use("sample")` |
| GitHub Pages o cualquier host estático | Lectura literal con reglas locales — mismos enlaces |

El archivo detecta `window.claude` al arrancar; sin él pasa a modo manual sin romperse.

## Por qué no trae los listados dentro

La API pública de MercadoLibre responde `403 forbidden` sin token de aplicación
(comprobado). Los headers CORS sí están presentes, así que con un token válido un
navegador podría llamarla — pero un token no puede vivir en una página estática pública.
Para listados en vivo hace falta un proxy mínimo (una función serverless que guarde el
token y firme la petición).

## Despliegue

Pages sirve esta carpeta directamente desde la rama, sin build ni Actions:

**Settings → Pages → Build and deployment → Source: `Deploy from a branch` →
Branch: `main`, carpeta `/docs` → Save.**

A partir de ahí cada push a `main` que toque `docs/` se publica solo en un par
de minutos. Activar el sitio la primera vez requiere permisos de administrador
del repositorio: el `GITHUB_TOKEN` de Actions no puede crearlo
(`Resource not accessible by integration`), por eso no hay workflow.
