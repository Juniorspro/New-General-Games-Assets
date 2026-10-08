// porteo: los videos del juego (VideoPlayer) en un <video> escondido. Los bytes del clip salen de
// los datos (un recurso) y van como blob; cada cuadro el motor sube la imagen actual a la textura de
// destino (porteo_video_subir en nativo/porteo.c). Los navegadores no dejan sonar un video sin un
// toque del usuario: si no arranca con sonido, arranca mudo y el sonido vuelve con el primer toque.
export function crearVideos(datos) {
  const videos = new Map();   // id → { el, url, estado, quiere, bucle, vel, vol }

  function tipo(b) {
    if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
    if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
    return 'video/mp4';
  }

  let tocado = false;
  const alTocar = () => {
    tocado = true;
    for (const v of videos.values()) if (v.el && v.vol > 0) { v.el.muted = false; if (v.quiere && v.el.paused) v.el.play().catch(() => {}); }
  };
  addEventListener('pointerdown', alTocar, { capture: true });
  addEventListener('keydown', alTocar, { capture: true });

  function preparar(v, bytes) {
    const el = document.createElement('video');
    el.playsInline = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    el.muted = !tocado || v.vol <= 0;
    el.loop = v.bucle; el.playbackRate = v.vel || 1; el.volume = Math.min(1, Math.max(0, v.vol));
    el.style.cssText = 'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none';
    v.url = URL.createObjectURL(new Blob([bytes], { type: tipo(bytes) }));
    el.src = v.url;
    el.addEventListener('canplay', () => { if (v.estado === 0) v.estado = 1; });
    el.addEventListener('ended', () => { if (!v.bucle) v.estado = 2; });
    el.addEventListener('error', () => { v.estado = -1; console.warn('porteo: el navegador no pudo abrir el video', el.error && el.error.message); });
    document.body.appendChild(el);
    v.el = el;
    if (v.buscar != null) { try { el.currentTime = v.buscar; } catch {} v.buscar = null; }
    if (v.quiere) reproducir(v);
  }

  function reproducir(v) {
    const el = v.el;
    if (!el) return;
    el.play().catch(() => {
      // sin un toque del usuario no deja con sonido: mudo
      el.muted = true;
      el.play().catch(() => {});
    });
  }

  return {
    videoCrear: (id, recurso) => {
      const v = { el: null, url: null, estado: 0, quiere: false, bucle: false, vel: 1, vol: 1, buscar: null };
      videos.set(id, v);
      const traer = () => {
        const b = datos.recurso(recurso);
        if (b) { preparar(v, b); datos.usado && datos.usado(recurso); return; }
        datos.pedir(recurso);
        setTimeout(traer, 200);
      };
      traer();
    },
    videoReproducir: (id, si) => {
      const v = videos.get(id);
      if (!v) return;
      v.quiere = si;
      if (!v.el) return;
      if (si) { if (v.estado === 2) v.estado = 1; reproducir(v); } else v.el.pause();
    },
    videoBuscar: (id, s) => {
      const v = videos.get(id);
      if (!v) return;
      if (!v.el) { v.buscar = s; return; }
      try { v.el.currentTime = s; } catch {}
      if (v.estado === 2) v.estado = 1;
    },
    videoAjustar: (id, bucle, vel, vol) => {
      const v = videos.get(id);
      if (!v) return;
      v.bucle = bucle; v.vel = vel; v.vol = vol;
      if (!v.el) return;
      v.el.loop = bucle;
      v.el.playbackRate = vel > 0 ? vel : 1;
      v.el.volume = Math.min(1, Math.max(0, vol));
      if (vol <= 0) v.el.muted = true; else if (tocado) v.el.muted = false;
    },
    videoTiempo: (id) => { const v = videos.get(id); return v && v.el ? v.el.currentTime : 0; },
    videoEstado: (id) => { const v = videos.get(id); return v ? v.estado : -1; },
    videoSoltar: (id) => {
      const v = videos.get(id);
      if (!v) return;
      videos.delete(id);
      if (v.el) { v.el.pause(); v.el.removeAttribute('src'); v.el.load(); v.el.remove(); }
      if (v.url) URL.revokeObjectURL(v.url);
    },
    // para porteo_video_subir (porteo.c): el elemento con un cuadro listo, o null
    elemento: (id) => { const v = videos.get(id); return v && v.el && v.el.readyState >= 2 && v.el.videoWidth > 0 ? v.el : null; },
  };
}
