/* ============================================================================
   aeroplaza/js/actualizar.js — LAS ACTUALIZACIONES SIN APK NUEVA (vuelta 45),
   lo que se ve en el juego. Lo demás es de la APK (Actualizador.java): busca el
   aviso al abrir, baja el juego nuevo, lo verifica y lo usa la próxima vez.
   - Al abrir con uno nuevo: "AEROPLAZA se actualizó (versión n)", una vez.
   - Cuando termina de bajar otro: que se usa la próxima vez que se abra.
   - (vuelta 46, con la APK 46) Cuando termina de bajar otro: en el menú se usa ya (la página vuelve a cargar); en el
     juego, el aviso se toca para usarlo ya, y si no, se usa solo al volver a la app después de un rato afuera
     (MainActivity › onResume). En Opciones › Datos, la versión y "Buscar ahora".
   - Si hace falta una APK nueva (cambió lo de Java): una ventana para bajarla.
   Los avisos esperan a que haya juego (en el menú no hay dónde mostrarlos).
   ========================================================================== */
import { t, sumar } from './textos.js';
import { Nativo } from './nativo.js';
import { Guardado } from './guardar.js';

sumar({
  es: { act_hecha: '✨ AEROPLAZA se actualizó', act_hecha_d: 'Versión {n}', act_lista: '✨ Hay una versión nueva', act_lista_d: 'Ya se bajó: se usa la próxima vez que abras la app', act_apk: 'Hay una app nueva', act_apk_d: 'Esta vez cambió algo que no se puede actualizar solo. Bajala e instalala encima (no se borra lo que tenés).', act_bajar: 'Bajar la app', act_luego: 'Después', act_toca: 'Tocá acá para usarla ya (si no, se usa sola cuando vuelvas a la app)', act_version: 'Versión del juego', act_buscar: '🔄 Buscar ahora', act_de_apk: 'la de la app', act_e_nada: 'sin buscar todavía', act_e_buscando: 'buscando…', act_e_al_dia: 'al día', act_e_bajando: 'bajando la nueva…', act_e_lista: 'la nueva ya está bajada', act_e_sin_red: 'sin conexión', act_e_error: 'no se pudo buscar' },
  en: { act_hecha: '✨ AEROPLAZA was updated', act_hecha_d: 'Version {n}', act_lista: '✨ A new version is here', act_lista_d: 'Already downloaded: it’s used next time you open the app', act_apk: 'There’s a new app', act_apk_d: 'This time something changed that can’t update by itself. Download it and install it on top (your progress stays).', act_bajar: 'Download the app', act_luego: 'Later', act_toca: 'Tap here to use it now (otherwise it’s used when you come back to the app)', act_version: 'Game version', act_buscar: '🔄 Check now', act_de_apk: 'the app’s', act_e_nada: 'not checked yet', act_e_buscando: 'checking…', act_e_al_dia: 'up to date', act_e_bajando: 'downloading the new one…', act_e_lista: 'the new one is downloaded', act_e_sin_red: 'offline', act_e_error: 'could not check' },
  pt: { act_hecha: '✨ AEROPLAZA foi atualizado', act_hecha_d: 'Versão {n}', act_lista: '✨ Tem uma versão nova', act_lista_d: 'Já foi baixada: é usada da próxima vez que você abrir o app', act_apk: 'Tem um app novo', act_apk_d: 'Desta vez mudou algo que não atualiza sozinho. Baixe e instale por cima (o que você tem não se perde).', act_bajar: 'Baixar o app', act_luego: 'Depois', act_toca: 'Toque aqui para usar já (senão, é usada quando você voltar ao app)', act_version: 'Versão do jogo', act_buscar: '🔄 Procurar agora', act_de_apk: 'a do app', act_e_nada: 'ainda não procurou', act_e_buscando: 'procurando…', act_e_al_dia: 'em dia', act_e_bajando: 'baixando a nova…', act_e_lista: 'a nova já foi baixada', act_e_sin_red: 'sem conexão', act_e_error: 'não deu para procurar' },
});

export function avisosDeActualizacion(UI) {
  if (!Nativo.hay) return;
  const pendientes = [];
  /* (6 s después de que haya juego: un aviso nuevo saca al anterior, y al empezar está el regalo del día) */
  const mostrar = () => { if (!UI.hud) return false; for (const f of pendientes.splice(0)) setTimeout(f, 6000); return true; };
  const cuando = (f) => { pendientes.push(f); if (mostrar()) return; const tt = setInterval(() => { if (mostrar() || performance.now() > 20 * 60000) clearInterval(tt); }, 2000); };
  /* al abrir con uno bajado: una vez por versión */
  const J = Nativo.juego();
  let vista = null; try { vista = localStorage.getItem('aero-version-vista'); } catch { /* sin almacenamiento */ }
  if (J && J.bajada && String(J.n) !== vista) {
    try { localStorage.setItem('aero-version-vista', String(J.n)); } catch { /* nada */ }
    cuando(() => UI.notificar({ titulo: t('act_hecha'), texto: t('act_hecha_d', { n: J.n }), icono: '✨', tipo: 'bien', dur: 7000 }));
  }
  /* lo guardado, antes de que la página vuelva a cargar (y al esconderse: la APK la puede recargar al volver) */
  const usarYa = () => { try { Guardado.ya(); } catch { /* nada */ } return Nativo.aplicarActualizacion(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) try { Guardado.ya(); } catch { /* nada */ } });
  Nativo.alActualizacion = (tipo, n, notas, url) => {
    /* (con la APK 46: en el menú, ya; en el juego, el aviso se toca) */
    if (tipo === 'lista' && Nativo.puedeAplicar) {
      if (!UI.J?.enJuego && !UI.J?.enVR) { usarYa(); return; }
      cuando(() => {
        const d = UI.notificar({ titulo: t('act_lista'), texto: (notas ? String(notas).slice(0, 120) + ' · ' : '') + t('act_toca'), icono: '✨', tipo: 'info', dur: 14000 });
        if (d) { d.style.cursor = 'pointer'; d.addEventListener('click', (e) => { if (!e.target.closest('.noti-x')) usarYa(); }); }
      });
    } else if (tipo === 'lista') cuando(() => UI.notificar({ titulo: t('act_lista'), texto: notas ? String(notas).slice(0, 140) + ' · ' + t('act_lista_d') : t('act_lista_d'), icono: '✨', tipo: 'info', dur: 9000 }));
    else if (tipo === 'apk') cuando(() => {
      if (UI.ventanaAbierta) return;
      const c = document.createElement('div');
      c.innerHTML = '<p style="margin:0 0 12px;font-weight:700"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="boton chico" data-a="luego"></button><button class="boton chico primario" data-a="bajar"></button></div>';
      c.querySelector('p').textContent = (notas ? String(notas).slice(0, 200) + '\n' : '') + t('act_apk_d');
      c.querySelector('[data-a=luego]').textContent = t('act_luego');
      const b = c.querySelector('[data-a=bajar]'); b.textContent = t('act_bajar'); b.hidden = !url;
      const v = UI.ventana('📦 ' + t('act_apk'), c, { ancho: 460 });
      c.querySelector('[data-a=luego]').onclick = () => v.cerrar();
      b.onclick = () => { Nativo.abrirEnlace(url); v.cerrar(); };
    });
  };
}

/* (vuelta 46) la versión que corre y cómo va la búsqueda, para Opciones › Datos (null sin la APK) */
const ESTADOS = ['nada', 'buscando', 'al_dia', 'bajando', 'lista', 'sin_red', 'error'];
export function filaVersion() {
  const V = Nativo.juego(); if (!V || V.n == null) return null;
  const d = document.createElement('div'); d.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end';
  const x = document.createElement('small'); x.style.cssText = 'font-weight:800;color:var(--tinta2)';
  /* (el estado de Actualizador.java: al-dia, sin-red, "error: no coincide"… → act_e_al_dia, act_e_sin_red, act_e_error) */
  const pintar = (W) => { if (!W) return; const e = String(W.estado || 'nada').replace(/-/g, '_').split(/[ :]/)[0]; x.textContent = `${W.n || t('act_de_apk')} · APK ${W.apk || '?'} · ${t('act_e_' + (ESTADOS.includes(e) ? e : 'error'))}`; };
  pintar(V); d.appendChild(x);
  if (Nativo.puedeAplicar) {
    const b = document.createElement('button'); b.className = 'boton chico'; b.textContent = t('act_buscar');
    b.onclick = () => { Nativo.buscarActualizacion(); x.textContent = t('act_e_buscando'); setTimeout(() => pintar(Nativo.juego()), 6000); };
    d.appendChild(b);
  }
  return d;
}
