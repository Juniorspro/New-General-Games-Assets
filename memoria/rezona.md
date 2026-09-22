# Rezona Lab
Fuente: `PAPA-DEL-PATRON.md § 9`. Ver también: [imagenes](imagenes.md).

## La llave

- La credencial es un PAT con prefijo `rz_live_`. Vive en
  `~/.rezona/credentials.json` (directorio 0700, archivo 0600) — **fuera del
  repo, siempre**. Override para CI: `REZONA_PAT`, `REZONA_API_BASE`.
- **La PAT no tiene scope: es la cuenta entera.** El único límite es una lista
  blanca de 9 endpoints del lado del servidor. Una PAT filtrada es la cuenta
  filtrada, no "un permiso de lectura".
- `npx rezona@latest login --no-browser` imprime una URL para aprobar desde otro
  lado, sin que la llave pase por el chat. **Es el camino recomendado.**

## La API (22/9/2026)

- Base de producción: `https://lab.rezona.ai/game/pgcserver`. Desarrollo:
  `devlab.rezona.ai`. Auth por header `Authorization: Bearer …`, **nunca por
  query**: la query cae en los logs del proxy.
- Endpoints, parámetros de generación y trampas: `PAPA-DEL-PATRON.md § 9`.
- Crear y listar proyectos es gratis; solo `POST …/generations` cobra.
- **No hay endpoint para borrar proyectos.** Lo que se crea de prueba, queda.
  Colgados de las pruebas del 22/9: `KCoKOXTfvP` y `xVuxCcKGut`.

## El estado, con fecha

- **22/9/2026: el cobro de Rezona no funciona.** 9 intentos en 20 minutos, los 9
  con `CREDIT_RESERVE_FAILED`, con espera creciente hasta 120 s. El saldo no se
  movió, así que ninguna llegó a entrar. Quedan dos explicaciones: el cobrador
  caído, o que esta PAT no tenga habilitado el camino de cobro. **Es pregunta
  para el soporte de Rezona, no algo que se arregle desde acá.**
- Saldo medido el 22/9: **446.987** créditos (446.069 gastables). El número
  447.884 que circulaba quedó viejo.
- Leer saldo y listar proyectos sí andan: HTTP 200 el mismo día.
- **`CREDIT_RESERVE_FAILED` no es falta de saldo**: sin créditos el servidor
  contesta 402. Está en `TRANSIENT_CODES` del paquete, así que se reintenta con
  espera — pero si sigue 20 minutos, ya no es un parpadeo.
- El conector MCP de Rezona **puede no estar** en una sesión. Si no aparece, se
  le pega a la API con `curl`: está todo medido en § 9. No se simula.

## Mientras tanto

Para generar imágenes hay una vía que sí anda: [imagenes](imagenes.md).
