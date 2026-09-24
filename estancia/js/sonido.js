// El sonido, sintetizado entero.
//
// GUIA-JUEGOS.md § 7: la música no se compone en código (el agente no la oye).
// Acá no hay música: hay monte. Viento con rachas, chicharras a la siesta,
// teros y chimangos lejos (con reverberación, si no el mundo suena a una
// habitación), las vacas, el lazo, las moscas y la radio AM de fondo.
"use strict";
(() => {
  const S = (E.sonido = { listo: false });
  let ctx, master, rever, ruido, filtroLento, salida;

  S.iniciar = () => {
    if (S.listo) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    // Todo pasa por un pasabajos que en cámara lenta cierra el sonido, como
    // bajo el agua; normalmente está abierto del todo.
    filtroLento = ctx.createBiquadFilter(); filtroLento.type = "lowpass"; filtroLento.frequency.value = 20000; filtroLento.Q.value = 0.5;
    // La salida: el volumen general de Opciones. Todo termina acá.
    // Y al final un limitador: en el celular, la voz encima de un mugido y el
    // lazo pasaba de 0 dB y rompía (el parlante chico recorta feo).
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -9; limitador.knee.value = 6; limitador.ratio.value = 12;
    limitador.attack.value = 0.003; limitador.release.value = 0.2;
    salida = ctx.createGain(); salida.gain.value = E.opciones ? E.opciones.volumen : 1;
    salida.connect(limitador).connect(ctx.destination);
    filtroLento.connect(salida);
    S._salida = salida;                                   // para las pruebas: grabar lo que sale
    // El mundo iba 22 dB por debajo de la voz (medido: -42 contra -20 dB RMS):
    // no se oía el campo y la voz reventaba. Ahora el mundo sube y la voz baja.
    master = ctx.createGain(); master.gain.value = 1.6; master.connect(filtroLento);
    // Reverberación de campo abierto: ruido que se apaga en ~1,8 s y se va
    // oscureciendo (un pasabajos que se cierra con el tiempo). Con ruido blanco
    // parejo la cola era un siseo de "shhh" detrás de cada sonido.
    rever = ctx.createConvolver();
    const largo = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, largo, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let y = 0;
      for (let i = 0; i < largo; i++) {
        const u = i / largo, k = 0.5 * (1 - u) ** 2 + 0.02;          // cuánto deja pasar: abre al principio, oscuro al final
        y += k * ((Math.random() * 2 - 1) - y);
        d[i] = y * (1 - u) ** 2.5 * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
    }
    rever.buffer = ir;
    const gRev = ctx.createGain(); gRev.gain.value = 0.3;
    rever.connect(gRev).connect(master);
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    S.listo = true;
    armarAmbiente();
    decodificarTodas();
  };
  const fuenteRuido = () => { const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true; s.start(0, Math.random() * 2); return s; };
  // Una fuente en el espacio: paneo por dirección y volumen por distancia.
  function espacio(x, y, z) {
    const p = ctx.createPanner();
    p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = 4; p.rolloffFactor = 1.1; p.maxDistance = 600;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    return p;
  }

  let viento, chicharras, lazoG, lazoF, moscasG, radioG, radioVoz, fuegoG, sprayG, pasos = 0;
  function armarAmbiente() {
    // Viento: ruido grave filtrado, la racha lo mueve.
    const v = fuenteRuido(), fv = ctx.createBiquadFilter(); fv.type = "lowpass"; fv.frequency.value = 420;
    viento = ctx.createGain(); viento.gain.value = 0.1;
    v.connect(fv).connect(viento).connect(master);
    // Chicharras: ruido agudo angosto, modulado a 38 Hz, que crece y se apaga.
    const c = fuenteRuido(), fc = ctx.createBiquadFilter(); fc.type = "bandpass"; fc.frequency.value = 5200; fc.Q.value = 8;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain); lfo.start();
    chicharras = ctx.createGain(); chicharras.gain.value = 0;
    c.connect(fc).connect(am).connect(chicharras).connect(master);
    // El zumbido del lazo al revolear: una banda de ruido que sube con la
    // velocidad y late con cada vuelta.
    const l = fuenteRuido(); lazoF = ctx.createBiquadFilter(); lazoF.type = "bandpass"; lazoF.Q.value = 3;
    lazoG = ctx.createGain(); lazoG.gain.value = 0;
    l.connect(lazoF).connect(lazoG).connect(master);
    // Moscas: un zumbido que tiembla.
    const m = ctx.createOscillator(); m.type = "sawtooth"; m.frequency.value = 205;
    const vib = ctx.createOscillator(); vib.frequency.value = 7; const vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg).connect(m.frequency); vib.start();
    const fm = ctx.createBiquadFilter(); fm.type = "bandpass"; fm.frequency.value = 600; fm.Q.value = 2;
    moscasG = ctx.createGain(); moscasG.gain.value = 0;
    m.connect(fm).connect(moscasG).connect(master); m.start();
    // La radio AM: estática en banda de teléfono y una voz de locutor que no
    // se entiende (una diente de sierra con formantes que cambian).
    const r = fuenteRuido(), fr = ctx.createBiquadFilter(); fr.type = "bandpass"; fr.frequency.value = 1800; fr.Q.value = 0.8;
    const rs = ctx.createGain(); rs.gain.value = 0.05;
    // El locutor: antes una diente de sierra pura (zumbaba como un mosquito
    // eléctrico). Ahora una senoidal grave con un poco de ruido, que por los
    // formantes suena a voz lejana que no se entiende.
    radioVoz = ctx.createOscillator(); radioVoz.type = "triangle"; radioVoz.frequency.value = 130;
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 700; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1300; f2.Q.value = 5;
    radioVoz.f1 = f1; radioVoz.f2 = f2;
    const rv = ctx.createGain(); rv.gain.value = 0.25; radioVoz.g = rv;
    const aire = fuenteRuido(), fa = ctx.createBiquadFilter(); fa.type = "bandpass"; fa.frequency.value = 900; fa.Q.value = 1.5;
    const ga = ctx.createGain(); ga.gain.value = 0.3; aire.connect(fa).connect(ga).connect(f1);
    // La radio chica: sin graves ni agudos, como un parlante de lata.
    const lata = ctx.createBiquadFilter(); lata.type = "highpass"; lata.frequency.value = 350;
    const lata2 = ctx.createBiquadFilter(); lata2.type = "lowpass"; lata2.frequency.value = 3200;
    radioG = ctx.createGain(); radioG.gain.value = 0;
    const panR = espacio(E.estancia.radio.x, E.estancia.radio.y, E.estancia.radio.z);
    r.connect(fr).connect(rs).connect(radioG);
    radioVoz.connect(f1).connect(rv); radioVoz.connect(f2).connect(rv); rv.connect(radioG);
    radioG.connect(lata).connect(lata2).connect(panR).connect(master);
    radioVoz.start();
    // Fuego: chasquidos del fogón.
    fuegoG = ctx.createGain(); fuegoG.gain.value = 1;
    const Fg = E.lugares.fogon;
    fuegoG.connect(espacio(Fg.x, 0.5, Fg.z)).connect(master);
    // El aerosol del curabichera.
    const sp = fuenteRuido(), fs = ctx.createBiquadFilter(); fs.type = "highpass"; fs.frequency.value = 3500;
    sprayG = ctx.createGain(); sprayG.gain.value = 0;
    sp.connect(fs).connect(sprayG).connect(master);
  }

  // ── sueltos ──
  function envolvente(g, t0, subida, alto, bajada) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(alto, t0 + subida);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + subida + bajada);
  }
  // Un mugido: dos dientes de sierra apenas desafinadas (la garganta no es
  // una sola cuerda), un pasabajos que se abre de "mmm" a "uuu" y se cierra, y
  // un poco de aire. Con una sola sierra y dos filtros sonaba a bocina.
  S.mugido = (v, fuerza = 1) => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, dur = (v.salud && v.salud.bichera ? 2.2 : 1.5) + Math.random() * 0.5;
    const grave = v.toro ? 0.72 : v.ternero ? 1.9 : 1;
    const f0 = (v.tipo === "angus" ? 95 : 110) * grave * (v.salud && v.salud.bichera ? 0.85 : 1) * (0.92 + Math.random() * 0.16);
    const g = ctx.createGain(), boca = ctx.createBiquadFilter();
    boca.type = "lowpass"; boca.Q.value = 4;
    boca.frequency.setValueAtTime(250, t0); boca.frequency.linearRampToValueAtTime(900 * Math.sqrt(grave), t0 + dur * 0.3); boca.frequency.linearRampToValueAtTime(320, t0 + dur);
    const formante = ctx.createBiquadFilter(); formante.type = "peaking"; formante.frequency.value = 520 * Math.sqrt(grave); formante.Q.value = 2; formante.gain.value = 8;
    for (const des of [0.996, 1.004]) {
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(f0 * 0.85 * des, t0); o.frequency.linearRampToValueAtTime(f0 * 1.2 * des, t0 + dur * 0.35); o.frequency.linearRampToValueAtTime(f0 * 0.78 * des, t0 + dur);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.5; vg.gain.value = f0 * 0.015; vib.connect(vg).connect(o.frequency);
      o.connect(boca); o.start(t0); o.stop(t0 + dur + 0.3); vib.start(t0); vib.stop(t0 + dur + 0.3);
    }
    const aire = fuenteRuido(), fa = ctx.createBiquadFilter(), ga = ctx.createGain();
    fa.type = "bandpass"; fa.frequency.value = 700; fa.Q.value = 1; ga.gain.value = 0.12;
    aire.connect(fa).connect(ga).connect(boca); aire.stop(t0 + dur + 0.3);
    boca.connect(formante).connect(g);
    envolvente(g, t0, 0.2, 0.13 * fuerza, dur);
    const p = espacio(v.x, 1.2, v.z);
    g.connect(p); p.connect(master);
    const r = ctx.createGain(); r.gain.value = 0.5; p.connect(r).connect(rever);
  };
  // El ladrido: un golpe de voz que baja ("guau"), con la boca que se abre y
  // se cierra (un pasabajos que sube y baja) y aire. tono: 1 Tigre, más agudo
  // los chicos. veces: 1 o 2 ladridos seguidos.
  S.ladrido = (x, z, tono = 1, veces = 1) => {
    if (!S.listo) return;
    const p = espacio(x, 0.6, z);
    p.connect(master);
    const r = ctx.createGain(); r.gain.value = 0.6; p.connect(r).connect(rever);
    for (let k = 0; k < veces; k++) {
      const t0 = ctx.currentTime + k * (0.19 + Math.random() * 0.06), dur = 0.13 + Math.random() * 0.04;
      const o = ctx.createOscillator(); o.type = "sawtooth";
      const f0 = (330 + Math.random() * 60) * tono;
      o.frequency.setValueAtTime(f0 * 1.35, t0); o.frequency.exponentialRampToValueAtTime(f0, t0 + 0.03); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t0 + dur);
      const boca = ctx.createBiquadFilter(); boca.type = "lowpass"; boca.Q.value = 5;
      boca.frequency.setValueAtTime(500, t0); boca.frequency.linearRampToValueAtTime(1700 * tono, t0 + 0.035); boca.frequency.linearRampToValueAtTime(600, t0 + dur);
      const aire = fuenteRuido(), fa = ctx.createBiquadFilter(), ga = ctx.createGain();
      fa.type = "bandpass"; fa.frequency.value = 1400 * tono; fa.Q.value = 1.2; ga.gain.value = 0.35;
      const g = ctx.createGain(); envolvente(g, t0, 0.008, 0.2, dur);
      o.connect(boca); aire.connect(fa).connect(ga).connect(boca); boca.connect(g).connect(p);
      o.start(t0); o.stop(t0 + dur + 0.05); aire.stop(t0 + dur + 0.05);
    }
  };
  // El agua del balde: ruido que cae, grave, en tres baldazos.
  S.agua = () => {
    if (!S.listo) return;
    for (let k = 0; k < 3; k++) {
      const t0 = ctx.currentTime + 0.2 + k * 0.9, s = fuenteRuido(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.frequency.setValueAtTime(2500, t0); f.frequency.exponentialRampToValueAtTime(500, t0 + 0.6);
      envolvente(g, t0, 0.02, 0.25, 0.6);
      s.connect(f).connect(g).connect(master); s.stop(t0 + 0.8);
    }
  };
  // Tero: "teru-teru", notas chillonas que caen, de un lado cualquiera.
  function tero(jx, jz) {
    const t0 = ctx.currentTime, a = Math.random() * 6.28, d = 60 + Math.random() * 140;
    const p = espacio(jx + Math.cos(a) * d, 8, jz + Math.sin(a) * d);
    p.connect(master); p.connect(rever);
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = "square";
      const ti = t0 + i * 0.16;
      o.frequency.setValueAtTime(3100, ti); o.frequency.exponentialRampToValueAtTime(2200, ti + 0.1);
      const g = ctx.createGain(); envolvente(g, ti, 0.01, 0.06, 0.1);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 2;
      o.connect(f).connect(g).connect(p); o.start(ti); o.stop(ti + 0.14);
    }
  }
  // Chimango: un chillido largo que baja, desde arriba.
  function chimango(jx, jz) {
    const t0 = ctx.currentTime, a = Math.random() * 6.28;
    const p = espacio(jx + Math.cos(a) * 80, 30, jz + Math.sin(a) * 80);
    p.connect(master); p.connect(rever);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = "triangle";
      const ti = t0 + i * 0.5;
      o.frequency.setValueAtTime(2400, ti); o.frequency.exponentialRampToValueAtTime(1400, ti + 0.4);
      const g = ctx.createGain(); envolvente(g, ti, 0.02, 0.07, 0.4);
      o.connect(g).connect(p); o.start(ti); o.stop(ti + 0.45);
    }
  }
  S.chasquido = () => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, s = fuenteRuido(), f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500;
    const g = ctx.createGain(); envolvente(g, t0, 0.003, 0.5, 0.15);
    s.connect(f).connect(g).connect(master); s.stop(t0 + 0.3);
  };
  S.golpeSeco = () => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.25);
    const g = ctx.createGain(); envolvente(g, t0, 0.005, 0.5, 0.35);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.4);
  };
  S.pinza = () => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 2400;
    const g = ctx.createGain(); envolvente(g, t0, 0.002, 0.05, 0.03);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.05);
  };
  S.chirrido = () => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, s = fuenteRuido(), f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 4000;
    const g = ctx.createGain(); envolvente(g, t0, 0.02, 0.35, 1.8);
    const trem = ctx.createOscillator(); trem.frequency.value = 23; const tg = ctx.createGain(); tg.gain.value = 0.15; trem.connect(tg).connect(g.gain); trem.start(t0); trem.stop(t0 + 2);
    s.connect(f).connect(g).connect(master); s.stop(t0 + 2);
  };
  S.paso = (fuerte) => {
    if (!S.listo) return;
    const t0 = ctx.currentTime, s = fuenteRuido(), f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = (fuerte ? 260 : 650) * (0.85 + Math.random() * 0.3); f.Q.value = 1.4;
    const g = ctx.createGain(); envolvente(g, t0, 0.004, (fuerte ? 0.22 : 0.08) * (0.8 + Math.random() * 0.4), fuerte ? 0.12 : 0.07);
    s.connect(f).connect(g).connect(master); s.stop(t0 + 0.2);
  };

  // ── continuos ──
  S.zumbido = (x) => {
    if (!S.listo) return;
    const t = ctx.currentTime;
    lazoF.frequency.setTargetAtTime(300 + x * 900, t, 0.05);
    // Late con cada vuelta: sube cuando la armada pasa por delante.
    const vuelta = E.lazo.angulo % (Math.PI * 2);
    const pulso = 0.35 + 0.65 * Math.max(0, Math.cos(vuelta));
    lazoG.gain.setTargetAtTime(x * 0.35 * pulso, t, 0.02);
  };
  S.moscas = (x) => { if (S.listo) moscasG.gain.setTargetAtTime(x * 0.06, ctx.currentTime, 0.3); };
  S.rociar = (si) => { if (S.listo) sprayG.gain.setTargetAtTime(si ? 0.25 : 0, ctx.currentTime, 0.04); };
  // La voz del Guacho: frases grabadas con Higgsfield (qwen_audio_tts, acento rioplatense), en
  // datos.js como voz-<clave>-<n>.mp3. Se decodifican la primera vez que se
  // usan. Si no están, queda el subtítulo solo.
  const voces = {};
  let hablando = null, hablandoG = null;
  // Se decodifican todas al arrancar, de a una: la primera vez que se decía
  // una frase salía tarde (medio segundo de decodificar) y descolgada.
  function decodificar(nombre) {
    const dato = window.ARCHIVOS && ARCHIVOS["voz-" + nombre + ".mp3"];
    if (!dato) return Promise.resolve(null);
    if (voces[nombre]) return Promise.resolve(voces[nombre]);
    const b64 = atob(dato.slice(dato.indexOf(",") + 1)), u = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) u[i] = b64.charCodeAt(i);
    return ctx.decodeAudioData(u.buffer).then((buf) => (voces[nombre] = buf)).catch(() => null);
  }
  async function decodificarTodas() {
    for (const k of Object.keys(window.ARCHIVOS || {})) if (k.startsWith("voz-")) await decodificar(k.slice(4, -4));
  }
  S.voz = (nombre) => {
    if (!S.listo) return;
    const sonar = (buf) => {
      if (!buf) return;
      const t = ctx.currentTime;
      // La frase anterior se apaga en 60 ms: cortada en seco hacía un clic.
      if (hablando) { try { hablandoG.gain.setTargetAtTime(0, t, 0.02); hablando.stop(t + 0.08); } catch (e) { /* ya terminó */ } }
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = 0.36 * (E.opciones ? E.opciones.voz : 1);
      // Un poco de cuerpo y sin el "ssss" del TTS: la voz generada trae los
      // agudos de 6 a 9 kHz muy arriba, y en el parlante del celular chilla.
      const deEs = ctx.createBiquadFilter(); deEs.type = "peaking"; deEs.frequency.value = 7000; deEs.Q.value = 1.2; deEs.gain.value = -5;
      const cuerpo = ctx.createBiquadFilter(); cuerpo.type = "lowshelf"; cuerpo.frequency.value = 220; cuerpo.gain.value = 2;
      src.connect(deEs).connect(cuerpo).connect(g); g.connect(salida);        // la voz no pasa por el filtro de cámara lenta
      const r = ctx.createGain(); r.gain.value = 0.06; g.connect(r).connect(rever);   // apenas de campo abierto
      src.start(); hablando = src; hablandoG = g;
    };
    if (voces[nombre]) sonar(voces[nombre]); else decodificar(nombre).then(sonar);
  };
  // El ojo de águila: el mundo apagado, el corazón que late y el clic de la
  // mira que se fija.
  S.volumen = (v) => { if (S.listo) salida.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  S.lento = (k) => { if (S.listo) filtroLento.frequency.setTargetAtTime(20000 - 19000 * Math.min(1, k) ** 0.5, ctx.currentTime, 0.08); };
  S.latido = () => {
    if (!S.listo) return;
    const t = ctx.currentTime;
    for (const [d, a] of [[0, 1], [0.18, 0.7]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(62, t + d); o.frequency.exponentialRampToValueAtTime(38, t + d + 0.14);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.55 * a, t + d + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
      o.connect(g).connect(salida); o.start(t + d); o.stop(t + d + 0.22);
    }
  };
  S.clic = () => {
    if (!S.listo) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(salida); o.start(t); o.stop(t + 0.14);
  };
  // El silbido para llamar al caballo: "fiu… fiuuu", dos notas que suben,
  // con vibrato de labio y el soplido. Sintetizado: un silbido es casi una
  // senoidal pura, y así suena de verdad (no una voz diciendo "fiu").
  S.silbido = () => {
    if (!S.listo) return;
    const t0 = ctx.currentTime + 0.02;
    const nota = (ini, dura, curva) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(curva[0], ini);
      curva.slice(1).forEach((f, i) => o.frequency.linearRampToValueAtTime(f, ini + dura * (i + 1) / (curva.length - 1)));
      const vib = ctx.createOscillator(), vg = ctx.createGain();
      vib.frequency.value = 5.5 + Math.random(); vg.gain.value = 28;
      vib.connect(vg).connect(o.frequency);
      g.gain.setValueAtTime(0, ini);
      // Medido: a 0,22 el silbido quedaba 10 dB arriba de la voz, y a 2,5 kHz
      // es lo que más lastima el oído. Un silbido de campo se oye lejos, no fuerte.
      g.gain.linearRampToValueAtTime(0.075, ini + 0.03);
      g.gain.setValueAtTime(0.068, ini + dura - 0.07);
      g.gain.linearRampToValueAtTime(0, ini + dura);
      o.connect(g); g.connect(master);
      const r = ctx.createGain(); r.gain.value = 0.35; g.connect(r).connect(rever);   // el campo abierto
      // El soplido: ruido angosto que sigue a la nota, muy bajito.
      const n = fuenteRuido(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = 12; bp.frequency.setValueAtTime(curva[0], ini);
      curva.slice(1).forEach((f, i) => bp.frequency.linearRampToValueAtTime(f, ini + dura * (i + 1) / (curva.length - 1)));
      ng.gain.setValueAtTime(0, ini); ng.gain.linearRampToValueAtTime(0.02, ini + 0.03); ng.gain.linearRampToValueAtTime(0, ini + dura);
      n.connect(bp).connect(ng).connect(master);
      o.start(ini); vib.start(ini); o.stop(ini + dura + 0.05); vib.stop(ini + dura + 0.05); n.stop(ini + dura + 0.05);
    };
    nota(t0, 0.2, [1750, 2500]);
    nota(t0 + 0.3, 0.62, [2050, 2850, 2900, 2450]);
  };
  S.radio = false;

  let proxTero = 6, proxChimango = 40, proxFuego = 0, proxVoz = 0;
  S.actualizar = (dt, jug, hora) => {
    if (!S.listo) return;
    const t = ctx.currentTime, cam = E.motor.camara;
    const l = ctx.listener;
    const f = new THREE.Vector3(); cam.getWorldDirection(f);
    if (l.positionX) {
      l.positionX.value = cam.position.x; l.positionY.value = cam.position.y; l.positionZ.value = cam.position.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(cam.position.x, cam.position.y, cam.position.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    const racha = E.flora.uniformes.uRacha.value;
    viento.gain.setTargetAtTime(0.05 + racha * 0.12 + (jug.montado ? jug.vel * 0.006 : 0), t, 0.5);
    const dia = hora > 7 && hora < 19;
    chicharras.gain.setTargetAtTime(dia ? E.motor.calor * 0.07 * (0.6 + 0.4 * Math.sin(t * 0.8)) : 0, t, 0.6);
    if (E.lazo.estado !== "revoleando") lazoG.gain.setTargetAtTime(0, t, 0.05);
    // Moscas cerca de la herida o la bosta.
    let cerca = 99;
    for (const v of E.animales.vacas) if (v.salud.bichera && !v.salud.muerta) cerca = Math.min(cerca, Math.hypot(v.x - jug.x, v.z - jug.z));
    if (!E.trabajo.cura.activa) moscasG.gain.setTargetAtTime(Math.max(0, 1 - cerca / 7) * 0.05, t, 0.3);
    // La radio: voz que cambia de vocal cada tanto, como un locutor lejano.
    radioG.gain.setTargetAtTime(S.radio ? 0.16 : 0, t, 0.2);
    proxVoz -= dt;
    if (S.radio && proxVoz <= 0) {
      proxVoz = 0.09 + Math.random() * 0.14;
      const vocal = [[700, 1200], [400, 2000], [300, 800], [600, 1000], [350, 1800]][Math.floor(Math.random() * 5)];
      radioVoz.f1.frequency.setTargetAtTime(vocal[0], t, 0.03); radioVoz.f2.frequency.setTargetAtTime(vocal[1], t, 0.03);
      radioVoz.frequency.setTargetAtTime(115 + Math.random() * 40, t, 0.05);
      radioVoz.g.gain.setTargetAtTime(Math.random() < 0.18 ? 0 : 0.22, t, 0.02);
    }
    proxTero -= dt;
    if (proxTero <= 0 && hora > 5 && hora < 21) { proxTero = 12 + Math.random() * 35; tero(jug.x, jug.z); }
    proxChimango -= dt;
    if (proxChimango <= 0 && dia) { proxChimango = 50 + Math.random() * 90; chimango(jug.x, jug.z); }
    proxFuego -= dt;
    if (proxFuego <= 0) {
      proxFuego = 0.05 + Math.random() * 0.3;
      const s = fuenteRuido(), fc = ctx.createBiquadFilter(); fc.type = "highpass"; fc.frequency.value = 2000;
      const g = ctx.createGain(); envolvente(g, t, 0.002, 0.2 * Math.random(), 0.04);
      s.connect(fc).connect(g).connect(fuegoG); s.stop(t + 0.1);
    }
    // Pasos: a pie en cada paso de la cámara; a caballo, el golpe de los cascos.
    pasos += jug.vel * dt / (jug.montado ? 0.9 : 0.75);
    if (pasos > 1 && jug.vel > 0.3) { pasos = 0; S.paso(jug.montado); }
  };
})();
