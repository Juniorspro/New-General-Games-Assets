// porteo: el arranque del HTML único (lo arma empaquetar.py con este archivo). Todo el juego viene
// en bloques <script type="porteo/b"> comprimidos con LZMA: el código (.NET y JS), los paquetes y los
// recursos. Este arranque:
//   - a medida que el navegador lee cada bloque, un trabajador pasa su texto UTF-16 a bytes (sigue
//     comprimido: así ocupa entre la mitad y la décima parte);
//   - descomprime un bloque cuando hace falta algo de adentro: antes, en los trabajadores (lo que
//     el motor avisa que va a usar), o, si lo necesita ya, acá mismo;
//   - guarda lo descomprimido hasta un tope de memoria; lo usado hace mucho se suelta (si se vuelve
//     a pedir, se descomprime de nuevo);
//   - le da al motor una fuente con la forma de la de datos.js, pero sin red, y a .NET su runtime.
(function () {
  'use strict';
  const T = /*TABLA*/null;
  // T.bloques[i] = { t: bytes descomprimido, p: [lc, lp, pb], e: [[clave, desde, largo, trans], ...] }
  //   clave: "f" + ruta (código), "p" + nombre (.paq), "r" + id (recurso)
  //   trans: null, ["d", bits] (índices en diferencias) o ["v", n, [[inicio, paso, offset, tam], ...]]
  //   (vértices por canal: ver empaquetar.py)
  const P = (globalThis.porteoUnArchivo = {});
  const estado = () => document.getElementById('estado');
  const nB = T.bloques.length;
  const comp = new Array(nB).fill(null);   // el bloque comprimido, cuando llegó
  const desc = new Array(nB).fill(null);   // el bloque descomprimido, mientras se guarda
  const ultimoUso = new Float64Array(nB);
  const sinUsar = new Int32Array(nB);      // entradas que el motor todavía no se copió
  const usadas = new Set();
  const donde = new Map();                 // clave → [bloque, entrada]
  T.bloques.forEach((b, i) => { sinUsar[i] = b.e.length; b.e.forEach((e, j) => donde.set(e[0], [i, j])); });
  let llegados = 0, enMemoria = 0, sincronicos = 0, enTrabajadores = 0;
  // el tope de lo descomprimido guardado: en teléfonos de poca memoria, menos
  const TOPE = (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 128 : 256) << 20;

  // ── lo que corre también en los trabajadores (va como texto: Function.toString) ──

  // el texto UTF-16 de un bloque → sus bytes. Cada carácter son dos bytes del archivo tal cual;
  // los que el HTML no deja pasar van como ESC + código (ver a_utf16 en empaquetar.py)
  function deco(s, E, n) {
    const u = new Uint16Array((n + 1) >> 1);
    let j = 0;
    for (let i = 0, L = s.length; i < L; i++) {
      let c = s.charCodeAt(i);
      if (c === E) { c = s.charCodeAt(++i); c = c < 0x900 ? c + 0xD700 : c === 0x900 ? 0 : c === 0x901 ? 13 : c === 0x902 ? 60 : E; }
      u[j++] = c;
    }
    if (j !== u.length) throw new Error('bloque dañado (' + j + ' de ' + u.length + ')');
    const b = new Uint8Array(u.buffer);
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {   // procesador big-endian: al revés
      for (let k = 0; k < b.length; k += 2) { const t = b[k]; b[k] = b[k + 1]; b[k + 1] = t; }
    }
    return b.subarray(0, n);
  }

  // LZMA crudo con el decodificador en WebAssembly (lzma.c): probabilidades, entrada y salida en su
  // memoria, que crece hasta el bloque más grande
  function lzma(x, c, tam, lc, lp, pb) {
    const tp = Number(x.lzma_tam_probabilidades(lc, lp));
    const base = (Number(x.__heap_base.value) + 15) & ~15;
    const pIn = base + ((tp + 15) & ~15), pOut = pIn + ((c.length + 15) & ~15), fin = pOut + tam;
    const mem = x.memory;
    if (fin > mem.buffer.byteLength) mem.grow(Math.ceil((fin - mem.buffer.byteLength) / 65536));
    new Uint8Array(mem.buffer, pIn, c.length).set(c);
    const e = x.lzma_decodificar(pIn, c.length, pOut, tam, lc, lp, pb, base);
    if (e) throw new Error('LZMA: bloque dañado (' + e + ')');
    return new Uint8Array(mem.buffer, pOut, tam).slice();
  }

  // lo que empaquetar.py transformó para que comprima mejor, de vuelta como era
  function deshacer(d, entradas) {
    for (const e of entradas) {
      const t = e[3];
      if (!t) continue;
      const desde = e[1], largo = e[2];
      if (t[0] === 'd') {
        // índices: cada uno era la diferencia con el anterior
        const a = t[1] === 16 ? new Uint16Array(d.buffer, d.byteOffset + desde, largo >> 1) : new Uint32Array(d.buffer, d.byteOffset + desde, largo >> 2);
        for (let i = 1; i < a.length; i++) a[i] += a[i - 1];
      } else if (t[0] === 'v') {
        // vértices: venían canal por canal (todas las posiciones, todas las normales...) y al final
        // los bytes que no son de ningún canal
        const n = t[1], src = d.slice(desde, desde + largo), dst = d.subarray(desde, desde + largo);
        const usado = new Uint8Array(largo);
        let p = 0;
        for (const [ini, paso, off, tam] of t[2]) {
          for (let i = 0, o = ini + off; i < n; i++, o += paso) {
            for (let k = 0; k < tam; k++) { dst[o + k] = src[p++]; usado[o + k] = 1; }
          }
        }
        for (let o = 0; o < largo; o++) if (!usado[o]) dst[o] = src[p++];
      }
    }
  }

  function trabajador() {
    let x = null;
    onmessage = (ev) => {
      const m = ev.data;
      try {
        if (m.wasm) { x = new WebAssembly.Instance(new WebAssembly.Module(m.wasm), {}).exports; return; }
        if (m.texto !== undefined) {
          const b = deco(m.texto, m.esc, m.n);
          postMessage({ i: m.i, comp: b }, [b.buffer]);
        } else {
          const d = lzma(x, m.comp, m.t, m.p[0], m.p[1], m.p[2]);
          deshacer(d, m.e);
          postMessage({ i: m.i, datos: d }, [d.buffer]);
        }
      } catch (e) {
        postMessage({ i: m.i, error: String(e && e.stack || e) });
      }
    };
  }

  // ── los trabajadores ──
  const wasm = Uint8Array.from(atob(T.wasm), (c) => c.charCodeAt(0));
  // la instancia del hilo principal (para lo que hace falta ya): Chrome no deja crear una de más
  // de 4 KB en forma sincrónica acá, así que se prepara antes y se cambia por una nueva cuando su
  // memoria creció (la vieja, con un bloque entero adentro, se la lleva el recolector)
  let xSync = null, renovando = false;
  let moduloWasm = null;
  function renovar() {
    if (renovando) return;
    renovando = true;
    WebAssembly.instantiate(moduloWasm, {}).then((i) => { xSync = i.exports; renovando = false; });
  }
  const compilado = WebAssembly.compile(wasm).then((m) => {
    moduloWasm = m;
    return WebAssembly.instantiate(m, {}).then((i) => { xSync = i.exports; });
  });
  const fuenteTrabajador = [deco, lzma, deshacer].map(String).join('\n') + '\n(' + trabajador + ')();';
  const urlTrabajador = URL.createObjectURL(new Blob([fuenteTrabajador], { type: 'text/javascript' }));
  const nucleos = navigator.hardwareConcurrency || 2;
  const N = Math.max(1, Math.min(navigator.deviceMemory && navigator.deviceMemory <= 4 ? 2 : 4, nucleos - 1));
  const trab = [];
  for (let k = 0; k < N; k++) {
    const w = new Worker(urlTrabajador);
    w.tareas = 0;
    w.postMessage({ wasm });
    w.onmessage = (ev) => recibir(w, ev.data);
    trab.push(w);
  }
  function elegir() { let m = trab[0]; for (const w of trab) if (w.tareas < m.tareas) m = w; return m; }

  // ── llegadas: el navegador leyó un bloque ──
  const esperanLlegada = new Map();      // bloque → [resolver]
  const esperanDesc = new Map();         // bloque → [resolver]
  const cola = [];                       // bloques a descomprimir en los trabajadores, en orden
  const enCola = new Uint8Array(nB);
  const enVuelo = new Set();

  P.b = function () {
    const el = document.currentScript.previousElementSibling;
    const i = +el.dataset.i;
    const texto = el.textContent;
    el.remove();   // que el texto no quede ocupando memoria en la página
    const w = elegir();
    w.tareas++;
    w.postMessage({ i, texto, esc: +el.dataset.e, n: +el.dataset.n });
  };

  function recibir(w, m) {
    w.tareas--;
    if (m.error) { console.error('porteo: bloque ' + m.i + ': ' + m.error); enVuelo.delete(m.i); despachar(); return; }
    if (m.comp) {
      comp[m.i] = m.comp;
      llegados++;
      const e = estado();
      if (e && !P.arrancado) e.textContent = 'cargando… ' + Math.round(llegados * 100 / nB) + '%';
      const l = esperanLlegada.get(m.i);
      if (l) { esperanLlegada.delete(m.i); for (const f of l) f(); }
      if (enCola[m.i]) despachar();
      return;
    }
    enVuelo.delete(m.i);
    enTrabajadores++;
    if (!desc[m.i]) guardar(m.i, m.datos);
    despachar();
  }

  function guardar(i, d) {
    desc[i] = d;
    enMemoria += d.length;
    ultimoUso[i] = performance.now();
    const l = esperanDesc.get(i);
    if (l) { esperanDesc.delete(i); for (const f of l) f(); }
  }

  // lugar para "falta" bytes más: primero se sueltan los bloques ya usados enteros, después los
  // que hace más que no se tocan
  function liberar(falta, menos) {
    while (enMemoria + falta > TOPE) {
      let mejor = -1;
      for (let i = 0; i < nB; i++) {
        if (!desc[i] || i === menos) continue;
        if (mejor < 0 || (sinUsar[i] === 0) > (sinUsar[mejor] === 0) ||
            ((sinUsar[i] === 0) === (sinUsar[mejor] === 0) && ultimoUso[i] < ultimoUso[mejor])) mejor = i;
      }
      if (mejor < 0) return false;
      enMemoria -= desc[mejor].length;
      desc[mejor] = null;
    }
    return true;
  }

  // la cola va en el orden del archivo, que es el orden en que se usan las cosas (empaquetar.py
  // --orden): el motor pide miles de recursos de una al cargar una escena, en cualquier orden
  function pedirBloque(i) {
    if (desc[i] || enCola[i] || enVuelo.has(i)) return;
    enCola[i] = 1;
    let k = cola.length;
    while (k > 0 && cola[k - 1] > i) k--;
    cola.splice(k, 0, i);
    despachar();
  }

  // a los trabajadores, en el orden pedido, mientras haya lugar (contando lo que está en vuelo)
  function despachar() {
    let reservado = enMemoria;
    for (const i of enVuelo) reservado += T.bloques[i].t;
    for (let k = 0; k < cola.length && enVuelo.size < trab.length * 2;) {
      const i = cola[k];
      if (desc[i]) { cola.splice(k, 1); enCola[i] = 0; continue; }
      if (!comp[i]) { k++; continue; }   // todavía no llegó: espera su turno
      const b = T.bloques[i];
      if (reservado + b.t > TOPE) {
        // sólo se hace lugar soltando lo ya usado entero: lo pedido y sin usar se respeta
        let hay = false;
        for (let j = 0; j < nB; j++) if (desc[j] && sinUsar[j] === 0) { enMemoria -= desc[j].length; reservado -= desc[j].length; desc[j] = null; hay = true; if (reservado + b.t <= TOPE) break; }
        if (!hay || reservado + b.t > TOPE) break;
      }
      cola.splice(k, 1);
      enCola[i] = 0;
      enVuelo.add(i);
      reservado += b.t;
      const c = comp[i].slice();
      const w = elegir();
      w.tareas++;
      w.postMessage({ i, comp: c, t: b.t, p: b.p, e: b.e }, [c.buffer]);
    }
  }

  // ya: descomprimido acá mismo si no está (el motor lo necesita en este cuadro)
  function bloqueYa(i) {
    let d = desc[i];
    if (d) { ultimoUso[i] = performance.now(); return d; }
    if (!comp[i] || !xSync) return null;
    const b = T.bloques[i];
    liberar(b.t, i);
    d = lzma(xSync, comp[i], b.t, b.p[0], b.p[1], b.p[2]);
    deshacer(d, b.e);
    sincronicos++;
    guardar(i, d);
    if (xSync.memory.buffer.byteLength > (16 << 20)) renovar();
    return d;
  }

  function obtener(clave) {
    const ij = donde.get(clave);
    if (!ij) return null;
    const d = bloqueYa(ij[0]);
    if (!d) return null;
    const e = T.bloques[ij[0]].e[ij[1]];
    return d.subarray(e[1], e[1] + e[2]);
  }

  function llegada(clave) {
    const ij = donde.get(clave);
    if (!ij || comp[ij[0]]) return Promise.resolve();
    return new Promise((ok) => {
      if (!esperanLlegada.has(ij[0])) esperanLlegada.set(ij[0], []);
      esperanLlegada.get(ij[0]).push(ok);
    });
  }

  function descomprimido(i) {
    if (desc[i]) return Promise.resolve();
    pedirBloque(i);
    return new Promise((ok) => {
      if (!esperanDesc.has(i)) esperanDesc.set(i, []);
      esperanDesc.get(i).push(ok);
    });
  }

  function usar(clave) {
    if (usadas.has(clave)) return;
    usadas.add(clave);
    const ij = donde.get(clave);
    if (ij) sinUsar[ij[0]]--;
  }

  // ── la fuente de datos del motor (la misma forma que datos.js) ──
  P.fuente = {
    async indice() {
      await llegada('findice.json');
      return JSON.parse(new TextDecoder().decode(obtener('findice.json')));
    },
    async prepararPaquetes(nombres) {
      await Promise.all(nombres.map((n) => llegada('p' + n)));
      // que los trabajadores los vayan descomprimiendo: el motor abre los de cada escena al cargarla
      for (const n of nombres) { const ij = donde.get('p' + n); if (ij) pedirBloque(ij[0]); }
    },
    // el motor lo copia apenas lo pide: ya cuenta como usado
    paquete: (n) => { const d = obtener('p' + n); if (d) usar('p' + n); return d; },
    hay: (id) => { const ij = donde.get('r' + id); return !!ij && !!comp[ij[0]]; },
    recurso: (id) => obtener('r' + id),
    pedir: (id) => { const ij = donde.get('r' + id); if (ij) pedirBloque(ij[0]); },
    usado: (id) => usar('r' + id),
    alLlegar: (id, f) => { llegada('r' + id).then(f); },
    resumen: () => `${desc.filter(Boolean).length} bloques en memoria (${(enMemoria / 1048576).toFixed(0)} MB), ` +
      `${enTrabajadores} descomprimidos en trabajadores y ${sincronicos} en el momento, ${llegados}/${nB} llegados`,
  };

  // ── el código: módulos JS como blob: y el runtime de .NET desde adentro ──
  const TIPOS = { js: 'text/javascript', mjs: 'text/javascript', wasm: 'application/wasm', json: 'application/json', dat: 'application/octet-stream' };
  const tipo = (ruta) => TIPOS[ruta.slice(ruta.lastIndexOf('.') + 1)] || 'application/octet-stream';
  const urls = new Map();
  P.url = function (ruta) {
    let u = urls.get(ruta);
    if (!u) {
      const d = obtener('f' + ruta);
      if (!d) throw new Error('porteo: no está ' + ruta);
      u = URL.createObjectURL(new Blob([d], { type: tipo(ruta) }));
      urls.set(ruta, u);
    }
    return u;
  };
  // withResourceLoader de dotnet.js: los módulos JS como URL; lo demás (el wasm, los ensamblados,
  // ICU) como Response, con el tipo que pide WebAssembly.instantiateStreaming
  P.cargadorDotnet = function (tipoRecurso, nombre) {
    const ruta = '_framework/' + nombre;
    if (!donde.has('f' + ruta)) return null;
    if (/\.m?js$/.test(nombre)) return P.url(ruta);
    const d = obtener('f' + ruta);
    return Promise.resolve(new Response(d, { headers: { 'Content-Type': tipo(ruta) } }));
  };

  // cuando llegó el bloque del código: descomprimirlo y arrancar main.js (los datos siguen llegando)
  P.arrancar = async function () {
    if (P.arrancado) return;
    P.arrancado = true;
    const e = estado();
    if (e) e.textContent = 'preparando…';
    await compilado;
    const ij = donde.get('fmain.js');
    await llegada('fmain.js');
    await descomprimido(ij[0]);
    await import(P.url('main.js'));
  };
})();
