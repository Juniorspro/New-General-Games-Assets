/* ============================================================================
   aeroplaza/js/actualizar.js — LAS ACTUALIZACIONES SIN APK NUEVA (vuelta 45),
   lo que se ve en el juego. Lo demás es de la APK (Actualizador.java): busca el
   aviso al abrir, baja el juego nuevo, lo verifica y lo usa la próxima vez.
   - Al abrir con uno nuevo: "AEROPLAZA se actualizó (versión n)", una vez.
   - Cuando termina de bajar otro: que se usa la próxima vez que se abra.
   - Si hace falta una APK nueva (cambió lo de Java): una ventana para bajarla.
   Los avisos esperan a que haya juego (en el menú no hay dónde mostrarlos).
   ========================================================================== */
import { t, sumar } from './textos.js';
import { Nativo } from './nativo.js';

sumar({
  es: { act_hecha: '✨ AEROPLAZA se actualizó', act_hecha_d: 'Versión {n}', act_lista: '✨ Hay una versión nueva', act_lista_d: 'Ya se bajó: se usa la próxima vez que abras la app', act_apk: 'Hay una app nueva', act_apk_d: 'Esta vez cambió algo que no se puede actualizar solo. Bajala e instalala encima (no se borra lo que tenés).', act_bajar: 'Bajar la app', act_luego: 'Después' },
  en: { act_hecha: '✨ AEROPLAZA was updated', act_hecha_d: 'Version {n}', act_lista: '✨ A new version is here', act_lista_d: 'Already downloaded: it’s used next time you open the app', act_apk: 'There’s a new app', act_apk_d: 'This time something changed that can’t update by itself. Download it and install it on top (your progress stays).', act_bajar: 'Download the app', act_luego: 'Later' },
  pt: { act_hecha: '✨ AEROPLAZA foi atualizado', act_hecha_d: 'Versão {n}', act_lista: '✨ Tem uma versão nova', act_lista_d: 'Já foi baixada: é usada da próxima vez que você abrir o app', act_apk: 'Tem um app novo', act_apk_d: 'Desta vez mudou algo que não atualiza sozinho. Baixe e instale por cima (o que você tem não se perde).', act_bajar: 'Baixar o app', act_luego: 'Depois' },
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
  Nativo.alActualizacion = (tipo, n, notas, url) => {
    if (tipo === 'lista') cuando(() => UI.notificar({ titulo: t('act_lista'), texto: notas ? String(notas).slice(0, 140) + ' · ' + t('act_lista_d') : t('act_lista_d'), icono: '✨', tipo: 'info', dur: 9000 }));
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
