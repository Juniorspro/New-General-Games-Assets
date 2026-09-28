/* ============================================================================
   aeroplaza/js/mando-box.js — EL MANDO VR BOX (vuelta 44), y cualquier mando
   Bluetooth, en el VR. Llega por la Gamepad API (el navegador) o por la APK
   (MandoBox.java: la WebView no le pasa los mandos a la página).
   - La palanca (o la cruz, o el volumen del modo música) camina para donde se
     mira: eso lo hace entrada.js.
   - Los botones hacen lo del VR (main.js › botonesVR): usar (lo mismo que un
     toque: aprieta lo que se mira, dispara en el tiro, usa lo que está cerca),
     saltar, girar 45° a cada lado y el menú (la pausa, que se ve en el espejo).
   - Qué botón hace qué depende del firmware de cada VR Box: hay uno de fábrica
     que cubre los modos juego y música, y se cambia en la ventana del mando
     (apretando el botón que se quiere).
   ========================================================================== */
import { t, sumar } from './textos.js';
import { Nativo } from './nativo.js';
import { Guardado } from './guardar.js';

sumar({
  es: {
    box_titulo: '🎮 Mando VR Box', box_boton: '🎮 Mando VR Box', box_ninguno: 'Sin mando a la vista', box_hay: 'Conectado: {n}',
    box_texto: 'Prendelo y emparejalo por Bluetooth. Anda en modo juego (@ + B) y en modo música (@ + A). En el VR la palanca camina para donde mirás; los botones hacen esto (tocá "Cambiar" y apretá el que quieras):',
    box_usar: 'Usar / apretar lo que mirás', box_saltar: 'Saltar', box_izq: 'Girar ⟲ 45°', box_der: 'Girar ⟳ 45°', box_menu: 'Menú (pausa)',
    box_cambiar: 'Cambiar', box_espera: 'Apretá un botón…', box_fabrica: 'Como venía', box_listo: 'Listo',
    box_vivo: 'Palanca {x}, {y} · último botón: {b}', box_nada: '—',
    box_hola: '🎮 Mando listo: la palanca camina, el gatillo usa y aprieta lo que mirás',
  },
  en: {
    box_titulo: '🎮 VR Box controller', box_boton: '🎮 VR Box controller', box_ninguno: 'No controller in sight', box_hay: 'Connected: {n}',
    box_texto: 'Turn it on and pair it over Bluetooth. It works in game mode (@ + B) and music mode (@ + A). In VR the stick walks where you look; the buttons do this (tap "Change" and press the one you want):',
    box_usar: 'Use / press what you look at', box_saltar: 'Jump', box_izq: 'Turn ⟲ 45°', box_der: 'Turn ⟳ 45°', box_menu: 'Menu (pause)',
    box_cambiar: 'Change', box_espera: 'Press a button…', box_fabrica: 'Defaults', box_listo: 'Done',
    box_vivo: 'Stick {x}, {y} · last button: {b}', box_nada: '—',
    box_hola: '🎮 Controller ready: the stick walks, the trigger uses and presses what you look at',
  },
  pt: {
    box_titulo: '🎮 Controle VR Box', box_boton: '🎮 Controle VR Box', box_ninguno: 'Nenhum controle à vista', box_hay: 'Conectado: {n}',
    box_texto: 'Ligue e pareie por Bluetooth. Funciona no modo jogo (@ + B) e no modo música (@ + A). No VR o analógico anda para onde você olha; os botões fazem isto (toque em "Mudar" e aperte o que quiser):',
    box_usar: 'Usar / apertar o que você olha', box_saltar: 'Pular', box_izq: 'Girar ⟲ 45°', box_der: 'Girar ⟳ 45°', box_menu: 'Menu (pausa)',
    box_cambiar: 'Mudar', box_espera: 'Aperte um botão…', box_fabrica: 'Como vinha', box_listo: 'Pronto',
    box_vivo: 'Analógico {x}, {y} · último botão: {b}', box_nada: '—',
    box_hola: '🎮 Controle pronto: o analógico anda, o gatilho usa e aperta o que você olha',
  },
});

/* de fábrica: los números de botón de la Gamepad API, y los de más del VR Box (20-25, MandoBox.java). El gatillo del
   VR Box, según el firmware, llega como A, R1 o R2; en el modo música, como play/pausa */
export const MAPA_BOX = { usar: [0, 5, 7, 24, 25], saltar: [1, 4, 6], izq: [2, 22], der: [3, 23], menu: [8, 9] };
export const ACCIONES_BOX = ['usar', 'saltar', 'izq', 'der', 'menu'];
/* el que se usa: el de fábrica con lo que se cambió (G.opciones.vrBox: { accion: [botón] }) */
export function mapaBox(G) {
  const m = { ...MAPA_BOX }, g = G.opciones.vrBox;
  /* (una lista vacía vale: es una acción sin botón, porque su botón se lo llevó otra) */
  if (g && typeof g === 'object') for (const a of ACCIONES_BOX) if (Array.isArray(g[a]) && g[a].every((i) => Number.isInteger(i) && i >= 0 && i < 32)) m[a] = g[a].slice(0, 5);
  return m;
}
/* qué acciones pide esta lista de botones recién apretados */
export function accionesBox(G, nuevos) {
  const m = mapaBox(G), out = new Set();
  for (const a of ACCIONES_BOX) if (nuevos.some((i) => m[a].includes(i))) out.add(a);
  return out;
}
const NOMBRES = { 0: 'A', 1: 'B', 2: 'X/C', 3: 'Y/D', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: '▲', 13: '▼', 14: '◀', 15: '▶', 16: 'Mode', 20: 'Vol +', 21: 'Vol −', 22: '⏮', 23: '⏭', 24: '⏯', 25: 'OK' };
export const nombreBoton = (i) => NOMBRES[i] ?? '#' + i;
/* los mandos que se ven: los de la APK (por nombre) y los del navegador */
export function mandosVistos() {
  let web = [];
  try { web = [...(navigator.getGamepads?.() || [])].filter((p) => p && p.connected).map((p) => String(p.id).replace(/\s*\(.*$/, '').slice(0, 40)); } catch { /* sin Gamepad API */ }
  return [...new Set([...Nativo.mandos(), ...web])];
}

/* la ventana del mando: qué hace cada botón, cambiarlo apretando el que se quiere, y lo que llega en vivo */
export function ventanaMando(UI, J, alVolver) {
  const G = J.G, ent = J.ent;
  const c = document.createElement('div'); c.className = 'mando-box';
  c.innerHTML = `<p class="mb-texto"></p><div class="mb-estado"><b class="mb-quien"></b><span class="mb-vivo"></span></div>
    <div class="mb-lista"></div><div class="mb-abajo"><button class="boton chico mb-fabrica"></button><button class="boton chico primario mb-listo"></button></div>`;
  c.querySelector('.mb-texto').textContent = t('box_texto');
  c.querySelector('.mb-fabrica').textContent = t('box_fabrica');
  c.querySelector('.mb-listo').textContent = t('box_listo');
  const lista = c.querySelector('.mb-lista');
  let esperando = null;
  const pintar = () => {
    const m = mapaBox(G); lista.textContent = '';
    for (const a of ACCIONES_BOX) {
      const f = document.createElement('div'); f.className = 'mb-fila' + (esperando === a ? ' espera' : ''); f.dataset.accion = a;
      f.innerHTML = '<span class="mb-que"></span><span class="mb-cual"></span><button class="boton chico mb-cambiar"></button>';
      f.querySelector('.mb-que').textContent = t('box_' + a);
      f.querySelector('.mb-cual').textContent = m[a].map(nombreBoton).join(' · ') || t('box_nada');
      const b = f.querySelector('.mb-cambiar'); b.textContent = t(esperando === a ? 'box_espera' : 'box_cambiar');
      b.onclick = () => {
        J.sfx('elegir'); esperando = a; pintar();
        /* (el próximo botón del mando va a esta acción: entrada.js › alBoton) */
        ent.alBoton = (i) => {
          /* (el botón pasa a esta acción y deja las otras: si no, Y saltaría y giraría a la vez) */
          const m2 = mapaBox(G), nuevo = {};
          for (const x of ACCIONES_BOX) nuevo[x] = x === a ? [i] : m2[x].filter((j) => j !== i);
          G.opciones.vrBox = nuevo; Guardado.guardar();
          esperando = null; J.sfx('restaura'); pintar();
        };
      };
      lista.appendChild(f);
    }
  };
  c.querySelector('.mb-fabrica').onclick = () => { delete G.opciones.vrBox; Guardado.guardar(); esperando = null; ent.alBoton = null; J.sfx('elegir'); pintar(); };
  const vivo = () => {
    const n = mandosVistos(), I = ent.padInfo;
    c.querySelector('.mb-quien').textContent = n.length ? t('box_hay', { n: n.join(', ') }) : t('box_ninguno');
    c.querySelector('.mb-vivo').textContent = t('box_vivo', { x: I.x.toFixed(2), y: I.y.toFixed(2), b: I.ultimo >= 0 ? nombreBoton(I.ultimo) : t('box_nada') });
  };
  pintar(); vivo();
  const tVivo = setInterval(vivo, 250);
  const v = UI.ventana(t('box_titulo'), c, { ancho: 560, alCerrar: () => { clearInterval(tVivo); ent.alBoton = null; alVolver && alVolver(); } });
  c.querySelector('.mb-listo').onclick = () => { J.sfx('elegir'); v.cerrar(); };
  return v;
}
