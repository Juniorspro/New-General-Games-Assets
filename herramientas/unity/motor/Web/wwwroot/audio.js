// porteo: el sonido con Web Audio. El motor decide qué suena, desde qué segundo, con qué volumen,
// tono, paneo y filtro (con las reglas de Unity); acá se decodifican los Ogg y se tocan las voces.
//   - lo corto se decodifica entero (decodeAudioData) y se toca con AudioBufferSourceNode
//   - la música (Streaming en Unity) va por un <audio> con el Ogg en un Blob: no se decodifica
//     entera (un tema de 4 minutos son 80 MB en PCM)
//   - los bytes de cada clip vienen de la fuente de datos (datos.js o el HTML único)
export function crearAudio(datos) {
  let ctx = null, maestro = null;
  // ?audio=depurar: cada voz que arranca y el nivel de la salida en la consola
  const depurar = new URLSearchParams(location.search).get('audio') === 'depurar';
  let contadas = 0;
  const clips = new Map();   // recurso → { estado, buffer, url, esperando: [] }
  const voces = new Map();   // voz → { ... }
  // lo decodificado (PCM en float: un efecto de 3 s en estéreo son 1,1 MB) tiene tope: en una
  // partida suenan cientos de efectos (los del juego decodificados son casi 500 MB) y un teléfono
  // se queda sin memoria. Pasado el tope se sueltan los que hace más que no suenan; si vuelven a
  // sonar, se decodifican de nuevo (unos milisegundos)
  const TOPE_PCM = (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 48 : 128) << 20;
  let pcm = 0;

  function contexto() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    maestro = ctx.createGain();
    maestro.connect(ctx.destination);
    if (depurar) {
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      maestro.connect(an);
      const m = new Float32Array(an.fftSize);
      setInterval(() => {
        an.getFloatTimeDomainData(m);
        let s = 0; for (const x of m) s += x * x;
        console.log(`porteo audio: estado=${ctx.state} voces=${voces.size} clips=${clips.size} nivel=${Math.sqrt(s / m.length).toFixed(4)}`);
      }, 2000);
    }
    // los navegadores no dejan sonar hasta que la persona toca la pantalla o una tecla. Las músicas
    // en streaming (un <audio>) que quisieron arrancar antes quedaron rechazadas: se reintentan acá,
    // dentro del toque (si no, no sonaban nunca)
    const despertar = () => {
      if (ctx.state !== 'running') ctx.resume().then(alDespertar, () => {});
      for (const v of voces.values())
        if (v.elemento && v.elemento.paused && !v.pausada && !v.parada && v.bloqueada) { v.bloqueada = false; v.elemento.play().catch(() => { v.bloqueada = true; }); }
    };
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'mousedown']) addEventListener(ev, despertar, { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else despertar(); });
    return ctx;
  }

  // lo que se pidió mientras no se podía sonar: la música sigue desde donde iría; los efectos
  // cortos que ya pasaron no se tocan tarde
  function alDespertar() {
    const ahora = performance.now() / 1000;
    for (const [id, v] of voces) {
      if (v.bucle || v.streaming) continue;
      if (ahora - v.pedida > 0.4) parar(id);
    }
  }

  function clip(id) {
    let c = clips.get(id);
    if (!c) { c = { estado: 0, buffer: null, url: null, esperando: [], urgente: false }; clips.set(id, c); }
    return c;
  }

  // urgente: va a sonar ya. Si no (el motor lo precarga al cargar la escena, como Unity con
  // preloadAudioData), los bytes llegan cuando les toca: cuando los datos bajan de a poco por la
  // red, el sonido va al final (arranque.js) y no le saca ancho a lo que se ve
  function cargar(id, streaming, urgente = false) {
    const c = clip(id);
    if (c.estado !== 0) {
      if (urgente && c.estado === 1 && !c.urgente) {
        c.urgente = true;
        if (datos.cuandoListo) datos.cuandoListo(id, () => {}, true); else datos.pedir(id);
      }
      return;
    }
    c.estado = 1;
    c.urgente = urgente;
    const listo = () => {
      const bytes = datos.recurso(id);
      if (!bytes) { c.estado = 3; avisar(c); return; }
      if (streaming) {
        c.url = URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg' }));
        soltar(id);
        c.estado = 2;
        avisar(c);
        return;
      }
      const a = contexto();
      if (!a) { c.estado = 3; avisar(c); return; }
      // decodeAudioData se queda con el ArrayBuffer: va una copia
      a.decodeAudioData(bytes.slice().buffer).then((b) => {
        c.buffer = b; c.estado = 2; soltar(id); avisar(c);
        c.bytes = b.length * b.numberOfChannels * 4;
        c.usado = performance.now();
        pcm += c.bytes;
        recortar(id);
      }, (e) => {
        console.warn('porteo: no se pudo decodificar el audio ' + id, e);
        c.estado = 3; avisar(c);
      });
    };
    // ya descomprimido en un trabajador (el HTML único y el sitio): no se traba la página
    if (datos.cuandoListo) datos.cuandoListo(id, listo, urgente);
    else if (datos.hay(id)) listo();
    else { datos.alLlegar(id, listo); datos.pedir(id); }
  }

  // pasado el tope, los decodificados que hace más que no suenan (y no están sonando)
  function recortar(nuevo) {
    if (pcm <= TOPE_PCM) return;
    const enUso = new Set();
    for (const v of voces.values()) enUso.add(v.clip);
    const viejos = [...clips.entries()].filter(([id, c]) => c.buffer && id !== nuevo && !enUso.has(id))
      .sort((x, y) => x[1].usado - y[1].usado);
    for (const [, c] of viejos) {
      if (pcm <= TOPE_PCM * 0.8) break;
      pcm -= c.bytes;
      c.buffer = null; c.bytes = 0; c.estado = 0;
    }
  }

  // el clip ya está decodificado (o en un Blob): los bytes no hacen falta más
  function soltar(id) {
    datos.usado(id);
    if (datos.soltar) datos.soltar(id);
  }

  function avisar(c) {
    const l = c.esperando; c.esperando = [];
    for (const f of l) f();
  }

  function estado(id) { const c = clips.get(id); return c ? c.estado : 0; }

  // la cadena de una voz: fuente → [pasa bajos] → volumen → paneo → maestro
  function cadena(v, vol, pan, corte) {
    const a = contexto();
    v.ganancia = a.createGain();
    v.ganancia.gain.value = vol;
    v.paneo = a.createStereoPanner ? a.createStereoPanner() : null;
    if (v.paneo) { v.paneo.pan.value = pan; v.ganancia.connect(v.paneo); v.paneo.connect(maestro); }
    else v.ganancia.connect(maestro);
    v.filtro = null;
    if (corte > 0) ponerFiltro(v, corte);
  }

  function ponerFiltro(v, corte) {
    if (!v.filtro) {
      v.filtro = ctx.createBiquadFilter();
      v.filtro.type = 'lowpass';
      v.filtro.connect(v.ganancia);
      if (v.nodo) { try { v.nodo.disconnect(); } catch {} v.nodo.connect(v.filtro); }
    }
    v.filtro.frequency.value = Math.min(corte, ctx.sampleRate / 2);
  }

  function entrada(v) { return v.filtro || v.ganancia; }

  // arranca la fuente de una voz en el segundo que corresponde ahora
  function arrancar(id, v) {
    const c = clips.get(v.clip);
    if (!c || c.estado !== 2 || v.parada) return;
    c.usado = performance.now();
    if (depurar && contadas++ < 40) console.log(`porteo audio: voz ${id} clip ${v.clip}${v.streaming ? ' (streaming)' : ''} desde ${v.desde.toFixed(2)} bucle=${v.bucle} tono=${v.tono}`);
    const a = contexto();
    if (!a) return;
    let desde = v.desde + (performance.now() / 1000 - v.pedida) * v.tono;
    if (v.streaming) {
      const el = new Audio(c.url);
      el.loop = v.bucle;
      el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false;
      el.playbackRate = v.tono;
      v.elemento = el;
      v.nodo = a.createMediaElementSource(el);
      v.nodo.connect(entrada(v));
      const empezar = () => {
        if (v.parada) return;
        const d = el.duration;
        if (isFinite(d) && d > 0) { if (v.bucle) desde %= d; else if (desde >= d) { parar(id); return; } }
        try { el.currentTime = Math.max(0, desde); } catch {}
        // sin un toque antes el navegador lo rechaza: queda marcada y la arranca el primer toque
        if (!v.pausada) el.play().catch(() => { v.bloqueada = true; });
      };
      if (el.readyState >= 1) empezar(); else el.addEventListener('loadedmetadata', empezar, { once: true });
      el.addEventListener('ended', () => { if (!v.bucle) parar(id); });
      return;
    }
    const d = c.buffer.duration;
    if (v.bucle) desde %= d;
    else if (desde >= d) { parar(id); return; }
    const s = a.createBufferSource();
    s.buffer = c.buffer;
    s.loop = v.bucle;
    s.playbackRate.value = v.tono;
    s.connect(entrada(v));
    s.onended = () => { if (v.nodo === s && !v.bucle && !v.pausada) parar(id); };
    v.nodo = s;
    s.start(0, Math.max(0, desde));
  }

  function tocar(id, recurso, streaming, desde, bucle, vol, tono, pan, corte) {
    if (!contexto()) return;
    const v = { clip: recurso, streaming, desde, bucle, tono, pedida: performance.now() / 1000, parada: false, pausada: false, nodo: null, elemento: null };
    cadena(v, vol, pan, corte);
    voces.set(id, v);
    const c = clip(recurso);
    if (c.estado === 2) arrancar(id, v);
    else {
      c.esperando.push(() => arrancar(id, v));
      cargar(recurso, streaming, true);
    }
  }

  function ajustar(id, vol, tono, pan, corte) {
    const v = voces.get(id);
    if (!v) return;
    const t = ctx.currentTime;
    v.ganancia.gain.setTargetAtTime(vol, t, 0.015);
    if (v.paneo) v.paneo.pan.setTargetAtTime(pan, t, 0.015);
    if (tono !== v.tono) {
      // la posición sigue donde estaba con el tono nuevo
      v.desde += (performance.now() / 1000 - v.pedida) * v.tono;
      v.pedida = performance.now() / 1000;
      v.tono = tono;
      if (v.elemento) v.elemento.playbackRate = tono;
      else if (v.nodo) v.nodo.playbackRate.value = tono;
    }
    if (corte > 0) ponerFiltro(v, corte);
    else if (v.filtro) v.filtro.frequency.value = ctx.sampleRate / 2;
  }

  // (otro nombre que soltar(id): con el mismo, esta tapaba a aquella y los bytes de los clips
  // decodificados nunca se marcaban usados)
  function soltarVoz(v) {
    if (v.elemento) { try { v.elemento.pause(); } catch {} v.elemento.removeAttribute('src'); }
    else if (v.nodo) { try { v.nodo.onended = null; v.nodo.stop(); } catch {} }
    for (const n of [v.nodo, v.filtro, v.ganancia, v.paneo]) if (n) try { n.disconnect(); } catch {}
  }

  function parar(id) {
    const v = voces.get(id);
    if (!v) return;
    v.parada = true;
    soltarVoz(v);
    voces.delete(id);
  }

  // en pausa la fuente se suelta; al seguir se arranca otra en el segundo donde quedó
  function pausar(id, pausa, desde) {
    const v = voces.get(id);
    if (!v || v.pausada === pausa) return;
    v.pausada = pausa;
    if (v.elemento) { if (pausa) v.elemento.pause(); else v.elemento.play().catch(() => { v.bloqueada = true; }); return; }
    if (pausa) { if (v.nodo) { try { v.nodo.onended = null; v.nodo.stop(); v.nodo.disconnect(); } catch {} v.nodo = null; } }
    else { v.desde = desde; v.pedida = performance.now() / 1000; arrancar(id, v); }
  }

  function frecuencia() { const a = contexto(); return a ? a.sampleRate : 48000; }

  return {
    audioCargar: cargar, audioEstado: estado, audioTocar: tocar, audioAjustar: ajustar,
    audioParar: parar, audioPausar: pausar, audioFrecuencia: frecuencia,
  };
}
