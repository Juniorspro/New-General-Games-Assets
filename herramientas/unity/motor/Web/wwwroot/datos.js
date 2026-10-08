// porteo: los datos del juego por la red (la carpeta datos/ al lado de la página). El HTML único
// (empaquetar/empaquetar.py) trae su propia fuente con la misma forma y todo adentro:
//   indice()                    → Promise del índice (archivos, escenas, recursos)
//   prepararPaquetes(nombres)   → Promise: los .paq a mano (el motor los lee sin esperar)
//   paquete(nombre)             → Uint8Array o null
//   hay(id)                     → si recurso(id) lo da ya, sin esperar
//   recurso(id)                 → Uint8Array o null
//   pedir(id)                   → que lo vaya trayendo (sin esperar)
//   usado(id)                   → el motor ya se lo copió
//   alLlegar(id, f)             → f() cuando hay(id) (el audio)
export function crearFuenteRed(base, estado) {
  const paquetes = new Map();
  const recursos = new Map();
  const pedidos = new Set();
  const cola = [];
  const esperas = new Map();   // recurso → funciones a llamar cuando llegue
  // en qué orden usó el motor cada recurso por primera vez: con eso empaquetar.py pone primero en
  // el HTML único lo que se usa primero (lo lee una prueba desde la consola)
  const orden = [];
  const vistos = new Set();
  globalThis.porteoOrden = orden;
  let enVuelo = 0;
  const SIMULTANEOS = 8;

  function llego(id) {
    const l = esperas.get(id);
    if (!l) return;
    esperas.delete(id);
    for (const f of l) f();
  }

  // de a varios a la vez: al cargar una escena se piden cientos de una
  function seguir() {
    while (enVuelo < SIMULTANEOS && cola.length) {
      const id = cola.shift();
      enVuelo++;
      fetch(base + 'recursos/' + id + '.bin')
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => { recursos.set(id, new Uint8Array(b)); })
        .catch((e) => console.warn('porteo: recurso ' + id, e))
        .finally(() => { pedidos.delete(id); enVuelo--; llego(id); seguir(); });
    }
  }

  return {
    async indice() { return (await fetch(base + 'indice.json')).json(); },
    async prepararPaquetes(nombres) {
      let listos = 0;
      await Promise.all(nombres.map(async (n) => {
        const r = await fetch(base + 'paquetes/' + encodeURIComponent(n) + '.paq');
        if (r.ok) paquetes.set(n, new Uint8Array(await r.arrayBuffer()));
        estado.textContent = `datos ${++listos}/${nombres.length}`;
      }));
    },
    paquete: (n) => paquetes.get(n) || null,
    hay: (id) => recursos.has(id),
    recurso(id) {
      const r = recursos.get(id) || null;
      if (r && !vistos.has(id)) { vistos.add(id); orden.push(id); }
      return r;
    },
    pedir(id) {
      if (recursos.has(id) || pedidos.has(id)) return;
      pedidos.add(id);
      cola.push(id);
      seguir();
    },
    // por la red queda guardado: lo vuelven a leer las texturas legibles y el audio
    usado() {},
    soltar: (id) => recursos.delete(id),
    alLlegar(id, f) {
      if (recursos.has(id)) { f(); return; }
      if (!esperas.has(id)) esperas.set(id, []);
      esperas.get(id).push(f);
    },
  };
}
