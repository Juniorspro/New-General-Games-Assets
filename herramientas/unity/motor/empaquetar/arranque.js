// porteo: el arranque del HTML único (lo arma empaquetar.py con este archivo). Todo el juego viene
// en bloques <script type="porteo/b"> comprimidos con LZMA: el código (.NET y JS), los paquetes y los
// recursos. Este arranque:
//   - a medida que el navegador lee cada bloque, un trabajador pasa su texto (dígitos en base 63485,
//     ver utf16k.c) a bytes (siguen comprimidos: así ocupan entre la mitad y la décima parte);
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
  P.web = !!T.web;   // los bloques llegan por la red, de a poco (main.js: el motor no espera lo diferible)
  // la base de las URLs del runtime de .NET (ver empaquetar.py: import.meta.url sería un blob:)
  globalThis.porteoBaseDotnet = new URL('_framework/dotnet.js', location.href).href;
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

  // el texto de un bloque → sus bytes. Cada carácter es un dígito en base 63485 (los caracteres
  // UTF-16 que el HTML deja pasar tal cual: todos menos NUL, CR, '<' y los surrogates) y los bytes
  // salen con rANS de símbolos uniformes de 16 bits (ver utf16k.c): sin escapes, 15.95 bits por
  // carácter. Al terminar, el estado vuelve justo al inicial y se leyó todo el texto: si no, el
  // bloque llegó cortado o de otro largo (un carácter cambiado no se nota acá: no hay redundancia)
  function deco(s, n) {
    const K = 63485, L = 4294967296;
    let D = deco.digitos;
    if (!D) {
      D = deco.digitos = new Uint16Array(65536);
      for (let c = 0, d = 0; c < 65536; c++) if (c !== 0 && c !== 13 && c !== 60 && (c < 0xD800 || c > 0xDFFF)) D[c] = d++;
    }
    const u = new Uint16Array((n + 1) >> 1);
    let i = 0, x = 0;
    for (let k = 0; k < 4; k++) x = x * K + D[s.charCodeAt(i++)];
    for (let j = 0, U = u.length; j < U; j++) {
      const v = x % 65536;
      u[j] = v;
      x = (x - v) / 65536;
      while (x < L) x = x * K + D[s.charCodeAt(i++)];
    }
    if (x !== L || i !== s.length) throw new Error('bloque cortado o de otro largo (' + i + ' de ' + s.length + ')');
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
      let t = e[3];
      if (t && t[0] === 'P') t = t[2];   // proxy: acá sólo su transformación de vértices (ver obtener)
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

  // ── proxies (empaquetar/proxies.py): el proxy viene como diferencia con lo que se predice desde
  // otras mallas (con su matriz); acá se vuelve a armar, con las mismas cuentas en el mismo orden
  // (doble precisión y Math.fround al final, como numpy .astype(float32)): sale igual bit a bit ──
  const TAM_FMT = [4, 2, 1, 1, 2, 2, 1, 1, 2, 2, 4, 4];
  function mitad(h) {   // float16 → número, exacto
    const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
    if (e === 0) return s * f * Math.pow(2, -24);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * (1 + f / 1024) * Math.pow(2, e - 15);
  }
  function predecirProxy(desc, fuente) {
    const n = desc.n, canales = desc.canales;
    let largo = 0;
    for (const c in canales) { const [ini, paso, fmt, dim] = canales[c]; largo = Math.max(largo, ini + (n - 1) * paso + dim * TAM_FMT[fmt]); }
    const pred = new Uint8Array(largo), dv = new DataView(pred.buffer);
    for (const [i, vc, clave, fv, M, N] of desc.segmentos) {
      const [nf, cf] = desc.fuentes[clave];
      const fb = fuente(clave);
      const fdv = new DataView(fb.buffer, fb.byteOffset, fb.byteLength);
      for (const cs in canales) {
        const c = +cs, [ini, paso, fmt, dim] = canales[cs];
        const src = cf[cs];
        if (!src) {
          if (c === 3 && fmt === 2) for (let k = 0; k < vc; k++) pred.fill(255, ini + (i + k) * paso, ini + (i + k) * paso + dim);
          continue;
        }
        const [fIni, fPaso, fFmt, fDim] = src;
        if (fmt === 2 && fFmt === 2 && c === 3) {
          for (let k = 0; k < vc; k++) for (let b = 0; b < dim; b++) pred[ini + (i + k) * paso + b] = fb[fIni + (fv + k) * fPaso + b];
          continue;
        }
        if (fmt !== 0 || (fFmt !== 0 && fFmt !== 1) || fDim < Math.min(dim, c <= 2 ? 3 : dim)) continue;
        const leer = (k, j) => { const o = fIni + (fv + k) * fPaso; return fFmt === 0 ? fdv.getFloat32(o + j * 4, true) : mitad(fdv.getUint16(o + j * 2, true)); };
        const out = new Array(4);
        for (let k = 0; k < vc; k++) {
          if (c === 0) {
            const x = leer(k, 0), y = leer(k, 1), z = leer(k, 2);
            for (let f = 0; f < 3; f++) out[f] = Math.fround(((x * M[f * 4] + y * M[f * 4 + 1]) + z * M[f * 4 + 2]) + M[f * 4 + 3]);
          } else if (c === 1 || c === 2) {
            const x = leer(k, 0), y = leer(k, 1), z = leer(k, 2);
            const T = c === 1 ? N : [M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]];
            const a = (x * T[0] + y * T[1]) + z * T[2], b = (x * T[3] + y * T[4]) + z * T[5], cc = (x * T[6] + y * T[7]) + z * T[8];
            let l = Math.sqrt((a * a + b * b) + cc * cc);
            if (l === 0) l = 1;
            out[0] = Math.fround(a / l); out[1] = Math.fround(b / l); out[2] = Math.fround(cc / l);
            if (c === 2) out[3] = Math.fround(fDim > 3 ? leer(k, 3) : 1);
          } else {
            for (let j = 0; j < fDim && j < 4; j++) out[j] = Math.fround(leer(k, j));
          }
          const o = ini + (i + k) * paso;
          for (let j = 0; j < dim; j++) dv.setFloat32(o + j * 4, Number.isFinite(out[j]) ? out[j] : 0, true);
        }
      }
    }
    return pred;
  }
  function reconstruirProxy(residuo, desc, fuente) {
    const pred = predecirProxy(desc, fuente);
    const out = residuo.slice(), n = desc.n;
    const dvO = new DataView(out.buffer), dvP = new DataView(pred.buffer);
    for (const cs in desc.canales) {
      const [ini, paso, fmt, dim] = desc.canales[cs];
      const tam = TAM_FMT[fmt];
      for (let i = 0; i < n; i++) {
        const o = ini + i * paso;
        if (fmt === 0) for (let j = 0; j < dim; j++) dvO.setUint32(o + j * 4, (dvO.getUint32(o + j * 4, true) + dvP.getUint32(o + j * 4, true)) >>> 0, true);
        else for (let b = 0; b < dim * tam; b++) out[o + b] = (out[o + b] + pred[o + b]) & 0xFF;
      }
    }
    return out;
  }

  function trabajador() {
    let x = null;
    onmessage = (ev) => {
      const m = ev.data;
      try {
        if (m.wasm) { x = new WebAssembly.Instance(new WebAssembly.Module(m.wasm), {}).exports; return; }
        if (m.texto !== undefined) {
          const b = deco(m.texto, m.n);
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

  // el bloque i ya se leyó: se lo busca por su número (no "el elemento anterior": la intro y la
  // pantalla de carga se agregan al final de la página mientras el navegador todavía la está leyendo)
  P.b = function (i) {
    const el = document.querySelector('script[type="porteo/b"][data-i="' + i + '"]');
    if (!el) { console.error('porteo: no encuentro el bloque ' + i); return; }
    const texto = el.textContent;
    el.remove();   // que el texto no quede ocupando memoria en la página
    const w = elegir();
    w.tareas++;
    w.postMessage({ i, texto, n: +el.dataset.n });
  };

  function recibir(w, m) {
    w.tareas--;
    if (m.error) { console.error('porteo: bloque ' + m.i + ': ' + m.error); enVuelo.delete(m.i); despachar(); return; }
    if (m.comp) { llego(m.i, m.comp); return; }
    enVuelo.delete(m.i);
    enTrabajadores++;
    if (!desc[m.i]) guardar(m.i, m.datos);
    despachar();
  }

  // un bloque comprimido ya está acá (del texto de la página o bajado)
  function llego(i, b) {
    comp[i] = b;
    llegados++;
    // a la pantalla de carga (pantalla.js): en el HTML único, cuánto del archivo se leyó; en el
    // sitio, cuánto llegó de lo que el motor está esperando
    if (globalThis.porteoCarga) porteoCarga.datos(T.web ? fraccionUrgente() : llegados / nB);
    const e = estado();
    if (e && !P.arrancado) e.textContent = 'cargando… ' + Math.round(llegados * 100 / nB) + '%';
    const l = esperanLlegada.get(i);
    if (l) { esperanLlegada.delete(i); for (const f of l) f(); }
    if (enCola[i]) despachar();
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
  function pedirBloque(i, urgente = true) {
    if (T.web && !comp[i]) {
      // sin apuro: que no ocupe lugar en la cola mientras no llegó (ver cuandoListo)
      if (!urgente) return;
      traer(i, true);
    }
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

  // los proxies ya armados (pocos: el motor los copia apenas los pide)
  const armados = new Map();
  let descProxies = null;
  // las fuentes de todos los proxies (3,5 MB en Slime Rancher), copiadas una sola vez: casi todas
  // son mallas chicas dentro de los .paq, y leerlas de a una descomprimía y soltaba una y otra vez
  // los bloques de 32 MB donde están
  let fuentesProxy = null;
  function copiarFuentes() {
    fuentesProxy = new Map();
    const porBloque = new Map();
    for (const id in descProxies) {
      for (const clave in descProxies[id].fuentes) {
        if (fuentesProxy.has(clave)) continue;
        fuentesProxy.set(clave, null);
        const k = clave[0] === 'r' ? clave : 'p' + /^p(.*)@\d+@\d+$/.exec(clave)[1];
        const ij = donde.get(k);
        if (!ij) continue;
        if (!porBloque.has(ij[0])) porBloque.set(ij[0], []);
        porBloque.get(ij[0]).push(clave);
      }
    }
    // bloque por bloque: cada uno se descomprime (si hace falta) una vez
    for (const lista of porBloque.values()) {
      for (const clave of lista) {
        let d;
        if (clave[0] === 'r') d = obtener(clave);
        else {
          const [, paq, desde, largo] = /^p(.*)@(\d+)@(\d+)$/.exec(clave);
          const b = obtener('p' + paq);
          d = b && b.subarray(+desde, +desde + +largo);
        }
        fuentesProxy.set(clave, d ? d.slice() : null);
      }
    }
  }
  function fuenteProxy(clave) {
    if (!fuentesProxy) copiarFuentes();
    return fuentesProxy.get(clave);
  }

  function obtener(clave) {
    const ij = donde.get(clave);
    if (!ij) return null;
    const e = T.bloques[ij[0]].e[ij[1]];
    if (e[3] && e[3][0] === 'P') {
      let a = armados.get(clave);
      if (a) return a;
      const d = bloqueYa(ij[0]);
      if (!d) return null;
      if (!descProxies) descProxies = JSON.parse(new TextDecoder().decode(obtener('dproxies')));
      a = reconstruirProxy(d.subarray(e[1], e[1] + e[2]), descProxies[e[3][1]], fuenteProxy);
      if (armados.size >= 4) armados.delete(armados.keys().next().value);
      armados.set(clave, a);
      return a;
    }
    const d = bloqueYa(ij[0]);
    if (!d) return null;
    return d.subarray(e[1], e[1] + e[2]);
  }

  function llegada(clave) {
    const ij = donde.get(clave);
    if (!ij || comp[ij[0]]) return Promise.resolve();
    if (T.web) traer(ij[0], true);
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

  // el bloque ya descomprimido en un trabajador, para lo que se lee apenas llega (el audio): así
  // no se traba la página descomprimiéndolo acá. urgente: lo que va a sonar ya pasa adelante en la
  // bajada; si no, llega cuando le toca
  function cuandoListo(i, urgente) {
    if (desc[i]) return Promise.resolve();
    if (comp[i]) return descomprimido(i);
    return new Promise((ok) => {
      if (!esperanLlegada.has(i)) esperanLlegada.set(i, []);
      esperanLlegada.get(i).push(ok);
      if (T.web) traer(i, urgente);
    }).then(() => descomprimido(i));
  }

  function usar(clave) {
    if (usadas.has(clave)) return;
    usadas.add(clave);
    const ij = donde.get(clave);
    if (ij) sinUsar[ij[0]]--;
  }

  // ── la versión para un sitio (empaquetar.py --sitio): cada bloque es un archivo b/<hash>.bin ──
  // Se bajan en el orden del archivo (el de uso: primero el código y lo del menú), pocos a la vez;
  // lo que el motor espera pasa adelante. Lo bajado queda en Cache Storage (el nombre lleva el
  // hash del contenido: nunca hay que bajarlo de nuevo) y el service worker guarda la página: la
  // segunda vez el juego arranca enseguida y sin red.
  const EN_VUELO = 6;
  const bajando = new Set(), urgentes = [];
  const urgente = new Uint8Array(nB);    // lo pidió el motor: va primero y con prioridad alta
  let siguiente = 0, cacheBloques = null, bajados = 0, fallo = false;
  // lo de fondo va en el orden del archivo (el de uso), pero el audio al final: las escenas esperan
  // sus texturas y no sus sonidos (Alcance.Diferible en el motor), y el sonido que falta suena
  // apenas llega
  const fondo = [];
  for (let i = 0; i < nB; i++) if (T.bloques[i].k !== 'audio') fondo.push(i);
  for (let i = 0; i < nB; i++) if (T.bloques[i].k === 'audio') fondo.push(i);

  async function abrirCache() {
    try { if (self.caches && isSecureContext) cacheBloques = await caches.open('porteo-bloques'); } catch (e) { cacheBloques = null; }
    if (!cacheBloques) return;
    // los de versiones anteriores (que ya no están en la tabla) se borran
    try {
      const sirven = new Set(T.bloques.map((b) => b.f));
      for (const r of await cacheBloques.keys()) if (!sirven.has(r.url.slice(r.url.lastIndexOf('/') + 1))) cacheBloques.delete(r);
    } catch (e) { /* no importa */ }
  }

  function traer(i, esUrgente) {
    if (comp[i]) return;
    if (esUrgente && !urgente[i]) { urgente[i] = 1; urgentes.push(i); avisar(); }
    if (!bajando.has(i)) bombear();
  }

  function bombear() {
    while (bajando.size < EN_VUELO && !fallo) {
      let i = -1;
      while (urgentes.length && i < 0) { const u = urgentes.shift(); if (!comp[u] && !bajando.has(u)) i = u; }
      // lo que nadie pidió todavía, de a pocos y sólo cuando no se está bajando nada que el motor
      // espera: con una conexión lenta, todo el ancho es para eso
      if (i < 0) {
        if (bajando.size >= 3) return;
        for (const j of bajando) if (urgente[j]) return;
        while (siguiente < fondo.length && (comp[fondo[siguiente]] || bajando.has(fondo[siguiente]))) siguiente++;
        if (siguiente >= fondo.length) return;
        i = fondo[siguiente++];
      }
      bajar(i);
    }
  }

  // lo que el motor pidió para dibujar y todavía no llegó, en bytes: la pantalla de carga se queda
  // hasta que llega lo que el menú muestra (pantalla.js). El sonido no: la música entra cuando llega
  P.faltaUrgente = function () {
    let f = 0;
    for (let i = 0; i < nB; i++) if (urgente[i] && !comp[i] && T.bloques[i].k !== 'audio') f += T.bloques[i].c;
    // y lo que ya llegó pero un trabajador todavía lo está descomprimiendo para dibujarlo (ver
    // recursoListo: a los 1,5 s se descomprime acá igual, así que lo más viejo ya no cuenta)
    const ahora = performance.now();
    for (const [i, t] of pedidoListo) if (!desc[i] && ahora - t < 2000) f += T.bloques[i].c;
    return f;
  };

  // de lo que pidió el motor, qué parte ya llegó (para la barra de la pantalla de carga)
  function fraccionUrgente() {
    let pedido = 0, llego_ = 0;
    for (let i = 0; i < nB; i++) if (urgente[i]) { pedido += T.bloques[i].c; if (comp[i]) llego_ += T.bloques[i].c; }
    return pedido ? llego_ / pedido : 0;
  }

  // mientras el motor espera algo que se está bajando: cuánto falta (con una conexión lenta es lo
  // que dice que el juego no se colgó)
  function avisar() {
    const el = estado();
    if (!el || fallo) return;
    let falta = 0;
    // el sonido no: el juego no lo espera (suena cuando llega)
    for (let i = 0; i < nB; i++) if (urgente[i] && !comp[i] && T.bloques[i].k !== 'audio') falta += T.bloques[i].c;
    if (falta > 0) el.textContent = 'bajando… ' + (falta / 1048576).toFixed(1) + ' MB';
    else if (el.textContent.startsWith('bajando')) el.textContent = '';
  }

  async function bajar(i) {
    bajando.add(i);
    const b = T.bloques[i], url = 'b/' + b.f;
    for (let intento = 0; ; intento++) {
      try {
        let r = cacheBloques && await cacheBloques.match(url);
        if (!r) {
          r = await fetch(url, { priority: urgente[i] ? 'high' : 'low' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (cacheBloques) await cacheBloques.put(url, r.clone()).catch(() => {});
        }
        const c = new Uint8Array(await r.arrayBuffer());
        if (c.length !== b.c) { if (cacheBloques) cacheBloques.delete(url); throw new Error('llegó con otro tamaño'); }
        bajando.delete(i);
        bajados += c.length;
        llego(i, c);
        if (urgente[i]) avisar();
        bombear();
        return;
      } catch (e) {
        if (intento >= 5) {
          fallo = true;
          bajando.delete(i);
          console.error('porteo: no pude bajar ' + url + ': ' + e);
          const el = estado();
          if (el) el.textContent = 'No se pudo bajar una parte del juego. Revisá la conexión y recargá la página.';
          return;
        }
        await new Promise((ok) => setTimeout(ok, 1000 * 2 ** intento));
      }
    }
  }

  // ── la fuente de datos del motor (la misma forma que datos.js) ──
  const pedidoListo = new Map();   // bloque → cuándo se lo pidió recursoListo
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
    // sin trabar: sólo si su bloque ya está descomprimido; si no, se lo pasa a un trabajador y da
    // null (las texturas vuelven a probar en el cuadro siguiente). Si los trabajadores no llegan
    // en un rato (la cola llena de lo que espera otro), se descomprime acá igual
    recursoListo(id) {
      const ij = donde.get('r' + id);
      if (!ij) return null;
      const i = ij[0];
      if (!desc[i] && comp[i]) {
        const t = pedidoListo.get(i);
        if (t === undefined) { pedidoListo.set(i, performance.now()); pedirBloque(i); return null; }
        if (performance.now() - t < 1500) return null;
      }
      pedidoListo.delete(i);
      return obtener('r' + id);
    },
    pedir: (id) => { const ij = donde.get('r' + id); if (ij) pedirBloque(ij[0]); },
    usado: (id) => usar('r' + id),
    alLlegar: (id, f) => { llegada('r' + id).then(f); },
    // f() cuando se puede leer sin descomprimir acá (el audio); urgente: lo que va a sonar ya
    cuandoListo: (id, f, urgente) => { const ij = donde.get('r' + id); if (!ij) f(); else cuandoListo(ij[0], urgente).then(f); },
    resumen: () => `${desc.filter(Boolean).length} bloques en memoria (${(enMemoria / 1048576).toFixed(0)} MB), ` +
      `${enTrabajadores} descomprimidos en trabajadores y ${sincronicos} en el momento, ${llegados}/${nB} llegados` +
      (T.web ? ` (${(bajados / 1048576).toFixed(1)} MB bajados o de la caché)` : ''),
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

  if (T.web) {
    // la página guardada para arrancar sin red, y que el navegador no borre lo bajado si le falta lugar
    if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('porteo: sin service worker', e));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    abrirCache().then(() => { bombear(); P.arrancar(); });
  }
})();
