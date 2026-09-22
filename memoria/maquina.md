# La máquina y sus frenos
Fuente: `ARRANQUE.md § 1`, `PAPA-DEL-PATRON.md § 1`. Ver también: [neko](neko.md).

## Lo básico

- Contenedor efímero: 4 núcleos, ~15 GB RAM, **sin GPU**. Solo sobrevive lo
  commiteado. Sale por HTTPS/443; **no recibe conexiones de afuera**.
- Disco: **30 GB libres** medidos el 22/9. La nota vieja de `ARRANQUE.md` que
  dice 2,4 GB **está mal** y por eso concluye —también mal— que no se puede
  compilar un APK. Sí se puede.
- `df` miente: "Avail" en 0 con poco "Used" es la cuota agotada, no la máquina
  rota. Borrar libera al instante.
- Pillow no viene (`pip install pillow`). `npx wrangler` se reinstala en cada
  sesión y tarda 1-2 minutos: si parece colgado, es eso.

## Los tres frenos, que no son lo mismo

Cuando algo no sale, primero hay que saber **quién** lo frenó:

1. **El servicio ajeno.** Contesta con su propio código (ej.
   `CREDIT_RESERVE_FAILED` de Rezona). Se reintenta con espera si el código es
   transitorio, y se deja de insistir cuando ya no es un parpadeo.
2. **El clasificador de permisos de la sesión.** Bloquea antes de ejecutar y
   dice el motivo. Vistos el 22/9: *Code from External* (correr un paquete
   bajado de npm, ej. `npx rezona`) y *Real-World Transactions* (gastar
   créditos). **No se esquiva**: se le pide al dueño que lo habilite, o se busca
   un camino que no lo necesite —a la API de Rezona se le pega con `curl`, que
   no ejecuta código ajeno.
3. **El proxy del agente.** Solo hace CONNECT (HTTPS). Por HTTP plano devuelve
   `405`, y ahí `apt-get update` falla con *"repository is not signed"*, que
   despista: parece un problema de firmas y es de transporte. Se arregla pasando
   las fuentes a `https://` y configurando solo el proxy https.

## Docker

- **Arranca acá**, con `dockerd --iptables=false --bridge=none` (sin esas
  banderas parece bloqueado, y esa es la nota vieja que quedó dando vueltas).
- Verificado el 22/9: daemon 29.3.1, driver overlayfs.
- Para una imagen grande, mirar el disco antes: la de Neko pesa ~1,3 GB.
