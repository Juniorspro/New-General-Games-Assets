/* ============================================================================
   aeroplaza/js/obra.js — (vuelta 49) CONSTRUIR LA CASA COMO EN SIMS MOBILE:
   "arreglá la construcción, hacela bien, como Sims Mobile, que sea cómoda".
   - Se toca algo para elegirlo (queda con su huella celeste) y se lo arrastra:
     la huella va verde donde entra y roja donde no; si se suelta en rojo,
     vuelve al último lugar donde entraba. Arriba de lo elegido, una barrita:
     girar, color, copiar, quitar y listo.
   - Un dedo en el piso mueve la vista (el piso queda pegado al dedo); dos
     acercan, giran y mueven. Con el mouse: arrastrar mueve, el botón derecho
     gira, la rueda acerca; WASD, Q/E, R, Supr y Ctrl+Z también andan.
   - El catálogo, abajo, por lugar de la casa (casa-piezas.js › TABS), con
     miniaturas 3D de cada pieza. Tocar una la pone en el medio de la vista (en
     el lugar libre más cerca) y ya queda elegida; también se la puede arrastrar
     desde el catálogo hasta donde va.
   - Herramientas de dibujo: la pared, la media pared y la baranda se tiran de
     corrido arrastrando; el cuarto se marca de esquina a esquina (paredes y
     piso); los pisos y el techo cubren un rectángulo; demoler saca lo marcado.
     Una puerta o una ventana soltada sobre una pared la reemplaza.
   - Las paredes de adelante se bajan solas (como el "paredes cortadas" de los
     Sims), o todas, o ninguna (con los techos).
   - Todo se deshace y se rehace (fotos del plano); cada cambio se guarda y se
     publica. Las miniaturas se dibujan con las mismas luces de la escena (en una
     capa aparte), así no se compila ningún shader nuevo.
   ========================================================================== */
import * as THREE from 'three';
import { sumar, t } from './textos.js';
import { Pantalla } from './pantalla.js';
import { FABRICA, PAREDES, MAX_COSAS, BASE, RADIO_OBRA, medidas, cajaLocal, alturaEn } from './reinos/casa.js';
import { PIEZAS, TABS, EMOJI_VIEJAS } from './reinos/casa-piezas.js';

sumar({
  es: { obt_paredes: 'Paredes', obt_pisos: 'Pisos', obt_living: 'Living', obt_dormi: 'Dormitorio y baño', obt_cocina: 'Cocina', obt_juegos: 'Juegos', obt_plantas: 'Plantas', obt_deco: 'Deco', ob_cuarto: 'Cuarto', ob_demoler: 'Demoler', ob_girar: 'Girar', ob_color: 'Color', ob_copiar: 'Copiar', ob_quitar: 'Quitar', ob_color_orig: 'Su color', ob_deshacer: 'Deshacer', ob_rehacer: 'Rehacer', ob_vista_cortadas: 'Paredes cortadas', ob_vista_bajas: 'Paredes bajas', ob_vista_enteras: 'Paredes enteras', ob_cam_izq: 'Girar la vista a la izquierda', ob_cam_der: 'Girar la vista a la derecha', ob_catalogo: 'Catálogo', ob_terminar: 'Terminar', ob_dibuja: 'dibujar', ob_h_nada_dedo: 'Tocá algo para elegirlo · arrastrá para mirar · dos dedos acercan y giran', ob_h_nada_mouse: 'Clic para elegir · arrastrá para mover la vista · clic derecho gira · rueda acerca', ob_h_sel: 'Arrastralo para moverlo · tocá el piso para soltarlo', ob_h_linea: 'Arrastrá por el piso para levantar la pared', ob_h_cuarto: 'Arrastrá de una esquina a la otra para hacer el cuarto', ob_h_area: 'Arrastrá para cubrir el piso', ob_h_techo: 'Arrastrá para poner el techo', ob_h_demoler: 'Arrastrá sobre lo que querés sacar', ob_h_dos: 'dos dedos mueven la vista', ob_h_dos_mouse: 'clic derecho gira', ob_t_linea: '{n} tramos · {m} m', ob_t_cuarto: 'Cuarto de {a} × {b} m', ob_t_area: '{n} baldosas', ob_t_demoler: 'Saca {n} cosas', ob_lleno: 'Llegaste a {n} cosas: sacá alguna para poner más', ob_fuera: 'Solo se construye adentro del patio', ob_no_entra: 'Ahí no entra', ob_volvio: 'Ahí no entra: quedó donde sí entraba', ob_sin_lugar: 'No hay lugar libre cerca: mové la vista', ob_colgar: 'Los cuadros y los relojes van en una pared', ob_sin_vr: 'Para construir, salí del VR', ob_hola: '¡A construir! Elegí algo del catálogo', ob_guardada: 'Tu casa quedó guardada ({n} cosas)' },
  en: { obt_paredes: 'Walls', obt_pisos: 'Floors', obt_living: 'Living room', obt_dormi: 'Bedroom & bath', obt_cocina: 'Kitchen', obt_juegos: 'Games', obt_plantas: 'Plants', obt_deco: 'Decor', ob_cuarto: 'Room', ob_demoler: 'Demolish', ob_girar: 'Rotate', ob_color: 'Color', ob_copiar: 'Copy', ob_quitar: 'Remove', ob_color_orig: 'Its color', ob_deshacer: 'Undo', ob_rehacer: 'Redo', ob_vista_cortadas: 'Walls cut away', ob_vista_bajas: 'Walls down', ob_vista_enteras: 'Walls up', ob_cam_izq: 'Turn the view left', ob_cam_der: 'Turn the view right', ob_catalogo: 'Catalog', ob_terminar: 'Done', ob_dibuja: 'draw', ob_h_nada_dedo: 'Tap something to pick it · drag to look around · two fingers zoom and turn', ob_h_nada_mouse: 'Click to pick · drag to move the view · right click turns · wheel zooms', ob_h_sel: 'Drag it to move it · tap the floor to let go', ob_h_linea: 'Drag along the floor to raise the wall', ob_h_cuarto: 'Drag from one corner to the other to make the room', ob_h_area: 'Drag to cover the floor', ob_h_techo: 'Drag to put the roof on', ob_h_demoler: 'Drag over what you want to remove', ob_h_dos: 'two fingers move the view', ob_h_dos_mouse: 'right click turns', ob_t_linea: '{n} pieces · {m} m', ob_t_cuarto: '{a} × {b} m room', ob_t_area: '{n} tiles', ob_t_demoler: 'Removes {n} things', ob_lleno: 'You reached {n} things: remove some to place more', ob_fuera: 'You can only build inside the patio', ob_no_entra: "It doesn't fit there", ob_volvio: "It doesn't fit there: it stayed where it did", ob_sin_lugar: 'No free spot nearby: move the view', ob_colgar: 'Paintings and clocks go on a wall', ob_sin_vr: 'To build, leave VR', ob_hola: "Let's build! Pick something from the catalog", ob_guardada: 'Your home was saved ({n} things)' },
  pt: { obt_paredes: 'Paredes', obt_pisos: 'Pisos', obt_living: 'Sala', obt_dormi: 'Quarto e banheiro', obt_cocina: 'Cozinha', obt_juegos: 'Jogos', obt_plantas: 'Plantas', obt_deco: 'Decoração', ob_cuarto: 'Cômodo', ob_demoler: 'Demolir', ob_girar: 'Girar', ob_color: 'Cor', ob_copiar: 'Copiar', ob_quitar: 'Tirar', ob_color_orig: 'A cor dele', ob_deshacer: 'Desfazer', ob_rehacer: 'Refazer', ob_vista_cortadas: 'Paredes cortadas', ob_vista_bajas: 'Paredes baixas', ob_vista_enteras: 'Paredes inteiras', ob_cam_izq: 'Girar a vista para a esquerda', ob_cam_der: 'Girar a vista para a direita', ob_catalogo: 'Catálogo', ob_terminar: 'Terminar', ob_dibuja: 'desenhar', ob_h_nada_dedo: 'Toque algo para escolher · arraste para olhar · dois dedos aproximam e giram', ob_h_nada_mouse: 'Clique para escolher · arraste para mover a vista · botão direito gira · roda aproxima', ob_h_sel: 'Arraste para mover · toque o chão para soltar', ob_h_linea: 'Arraste pelo chão para levantar a parede', ob_h_cuarto: 'Arraste de um canto ao outro para fazer o cômodo', ob_h_area: 'Arraste para cobrir o chão', ob_h_techo: 'Arraste para pôr o teto', ob_h_demoler: 'Arraste sobre o que quer tirar', ob_h_dos: 'dois dedos movem a vista', ob_h_dos_mouse: 'botão direito gira', ob_t_linea: '{n} trechos · {m} m', ob_t_cuarto: 'Cômodo de {a} × {b} m', ob_t_area: '{n} pisos', ob_t_demoler: 'Tira {n} coisas', ob_lleno: 'Você chegou a {n} coisas: tire alguma para colocar mais', ob_fuera: 'Só dá para construir dentro do pátio', ob_no_entra: 'Aí não cabe', ob_volvio: 'Aí não cabe: ficou onde cabia', ob_sin_lugar: 'Não há lugar livre perto: mova a vista', ob_colgar: 'Quadros e relógios vão numa parede', ob_sin_vr: 'Para construir, saia do VR', ob_hola: 'Vamos construir! Escolha algo do catálogo', ob_guardada: 'Sua casa foi salva ({n} coisas)' },
});

export const PALETA = ['#ffffff', '#f4f8ff', '#dff4ff', '#7fd6ff', '#39d6ff', '#2f9bff', '#9b7bff', '#e46fff', '#ff6fb0', '#ff4f6e', '#ff9a3d', '#ffe14a', '#b6f03a', '#56e05a', '#1fae78', '#c79a6a', '#56606b', '#22262b'];
const TAU = Math.PI * 2, R_PATIO = 10.3, FONDO = '#eaf6ff';
const COLGAR_EN = new Set(['pared', 'ventana', 'media']);   // donde se cuelga un cuadro o un reloj (arriba de una puerta, no)
const ICONO = (k) => PIEZAS[k]?.ico || EMOJI_VIEJAS[k] || '▫️';
const norm = (r) => +(((r % TAU) + TAU) % TAU).toFixed(4);
const mismoEje = (a, b) => Math.abs(Math.cos((a || 0) - (b || 0))) > 0.7;
const HERR = { linea: '✏️', area: '▦', cuarto: '🏠', demoler: '🧹' };

/* ------------------------------------------------ los choques: dos rectángulos girados que se pisan (ejes separados) */
const radio = (o, ux, uz) => { const c = Math.cos(o.r), s = Math.sin(o.r); return o.w / 2 * Math.abs(c * ux - s * uz) + o.d / 2 * Math.abs(s * ux + c * uz); };
export function sePisan(a, b) {
  if (a.w <= 0 || a.d <= 0 || b.w <= 0 || b.d <= 0) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const e of [a.r, a.r + Math.PI / 2, b.r, b.r + Math.PI / 2]) {
    const ux = Math.cos(e), uz = -Math.sin(e);
    if (Math.abs(dx * ux + dz * uz) >= radio(a, ux, uz) + radio(b, ux, uz)) return false;
  }
  return true;
}

/* ------------------------------------------------ las miniaturas del catálogo (una vez por pieza, en la sesión) */
const MINI = new Map();
function armarMini(k) {
  if (k === '@cuarto') {   // un cuarto de 2 × 2: cuatro paredes y el piso
    const g = new THREE.Group();
    for (const [x, z, r] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) { const [o] = FABRICA.pared(); o.position.set(x, 0, z); o.rotation.y = r; g.add(o); }
    const [p] = FABRICA.piso(); g.add(p); return g;
  }
  const [o] = FABRICA[k](); return o;
}

export function crearObra(ctx) {
  const { motor, cam, ent, reino, G, J, UI, red, Guardado } = ctx;
  const C = {
    sel: null, arr: null, herr: null, trazo: null, vista: 'cortadas', hist: [], redo: [], tab: 'paredes', cerrado: false,
    colores: false, pisoK: 'piso', inclina: 0, yawObj: cam.yaw, t: 0, dedos: new Map(), gesto: null, mensaje: null,
  };
  const vibrar = (ms) => ent.vibrar?.(ms), sfx = (n) => J.sfx(n);

  /* ------------------------------------------------ la pantalla y el piso */
  const _rc = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _v = new THREE.Vector3();
  const rayo = (px, py) => { _ndc.set(px / Pantalla.w * 2 - 1, -(py / Pantalla.h) * 2 + 1); _rc.setFromCamera(_ndc, motor.camara); return _rc; };
  const corte = (r, y) => { if (r.direction.y > -1e-3) return null; const tt = (y - r.origin.y) / r.direction.y; return { x: r.origin.x + r.direction.x * tt, z: r.origin.z + r.direction.z * tt }; };
  /* el punto del patio bajo (px, py); arriba de una tarima se corta a su altura (si no, el toque cae corrido) */
  function pisoBajo(px, py) {
    const r = rayo(px, py).ray, p = corte(r, BASE); if (!p) return null;
    const y = alturaEn(G.casa, p.x, p.z);
    return y > 0.1 ? corte(r, BASE + y) || p : p;
  }
  const pisoPlano = (px, py) => corte(rayo(px, py).ray, BASE);
  const elegirEn = (px, py) => reino.elegir(rayo(px, py));
  const aPantalla = (x, y, z) => { _v.set(x, y, z).project(motor.camara); return { x: (_v.x + 1) / 2 * Pantalla.w, y: (1 - _v.y) / 2 * Pantalla.h, detras: _v.z > 1 }; };

  /* ------------------------------------------------ dónde cae una pieza */
  function adentro(l) {
    const B = cajaLocal(l.k), c = Math.cos(l.r || 0), s = Math.sin(l.r || 0);
    for (const [bx, bz] of [[B.min.x, B.min.z], [B.max.x, B.min.z], [B.min.x, B.max.z], [B.max.x, B.max.z]]) if (Math.hypot(l.x + bx * c + bz * s, l.z - bx * s + bz * c) > R_PATIO) return false;
    return Math.hypot(l.x, l.z) < RADIO_OBRA;
  }
  /* lo que pisa l (sin contar yo ni lo que reemplaza): los muebles contra los muebles y las paredes, los pisos finos
     contra los pisos finos al mismo nivel. Lo colgado, las alfombras, los techos y lo que flota van donde sea */
  function choca(l, yo = null) {
    const P = PIEZAS[l.k]; if (P?.pared || P?.techo) return null;
    const [w, d, h] = medidas(l.k); if (!(w > 0.05 && d > 0.05)) return null;
    const fino = !!P?.piso && !(h > 0.06), a = { x: l.x, z: l.z, r: l.r || 0, w: w - 0.16, d: d - 0.16 };
    for (const m of G.casa) {
      if (m === yo || m === l.reemplaza) continue;
      const Q = PIEZAS[m.k]; if (Q?.pared || Q?.techo) continue;
      const [mw, md, mh] = medidas(m.k); if (!(mw > 0.05 && md > 0.05)) continue;
      if (fino !== (!!Q?.piso && !(mh > 0.06))) continue;
      if ((l.k === 'columna' && PAREDES.has(m.k)) || (m.k === 'columna' && PAREDES.has(l.k))) continue;   // (las columnas van en las esquinas)
      if (fino) { if (Math.abs((l.y || 0) - (m.y || 0)) > 0.05) continue; }
      else { const y0 = l.y || 0, y1 = y0 + Math.max(0.05, h), z0 = m.y || 0, z1 = z0 + Math.max(0.05, mh); if (y1 <= z0 + 0.05 || z1 <= y0 + 0.05) continue; }
      if (sePisan(a, { x: m.x, z: m.z, r: m.r || 0, w: mw - 0.16, d: md - 0.16 })) return m;
    }
    return null;
  }
  const esObra = (k) => PIEZAS[k]?.cat === 'obra';
  /* (las paredes y las columnas no se suben a un piso fino: quedan todas a la misma altura) */
  const alturaPara = (k, x, z, yo) => { const y = alturaEn(G.casa, x, z, yo); return (PAREDES.has(k) || k === 'columna' || PIEZAS[k]?.techo) && y < 0.1 ? 0 : y; };
  /* dónde caería k cerca de (x, z) con el giro r. La obra va en la grilla de 1 m y lo demás en la de medio metro; una
     puerta, una ventana o una media pared se pega a la pared que tenga cerca (y la reemplaza: dos iguales no, así mover
     una pared no se come a la de al lado); un cuadro o un reloj se cuelgan de la más cerca */
  function lugar(k, x, z, r, yo = null) {
    const P = PIEZAS[k];
    if (P?.pared) {
      let w = null, md = 1.4;
      for (const m of G.casa) if (m !== yo && COLGAR_EN.has(m.k)) { const d = Math.hypot(m.x - x, m.z - z); if (d < md) { md = d; w = m; } }
      if (!w) return { k, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, r, y: 0, ok: false, porque: 'colgar' };
      const wr = w.r || 0, lado = (x - w.x) * Math.sin(wr) + (z - w.z) * Math.cos(wr) >= 0 ? 0 : Math.PI;
      return { k, x: w.x, z: w.z, r: norm(wr + lado), y: w.y || 0, ok: true, pared: w };
    }
    const paso = esObra(k) ? 1 : 0.5;
    let px = Math.round(x / paso) * paso, pz = Math.round(z / paso) * paso, pr = norm(r), reemplaza = null;
    if (PAREDES.has(k)) {
      let md = 0.8;
      for (const m of G.casa) if (m !== yo && PAREDES.has(m.k) && m.k !== k) { const d = Math.hypot(m.x - x, m.z - z); if (d < md) { md = d; reemplaza = m; } }
      if (reemplaza) { px = reemplaza.x; pz = reemplaza.z; if (!mismoEje(pr, reemplaza.r)) pr = norm(reemplaza.r || 0); }
    }
    const l = { k, x: px, z: pz, r: pr, y: alturaPara(k, px, pz, yo), reemplaza };
    if (!adentro(l)) { l.ok = false; l.porque = 'fuera'; return l; }
    const cm = choca(l, yo); l.ok = !cm; if (cm) l.porque = 'choca';
    return l;
  }
  /* el lugar libre más cerca de (x, z), en espiral (hasta 7 m) */
  function libreCerca(k, x, z, r, yo = null, saltarCero = false) {
    const paso = esObra(k) ? 1 : 0.5, n = Math.ceil(7 / paso), cand = [];
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const d = Math.hypot(i, j) * paso; if (d <= 7 && !(saltarCero && d < 0.01)) cand.push([d, i * paso, j * paso]); }
    cand.sort((a, b) => a[0] - b[0]);
    const x0 = Math.round(x / paso) * paso, z0 = Math.round(z / paso) * paso;
    for (const [, dx, dz] of cand) { const l = lugar(k, x0 + dx, z0 + dz, r, yo); if (l.ok && !l.reemplaza) return l; }
    return null;
  }

  /* ------------------------------------------------ guardar, deshacer, rehacer */
  const foto = () => JSON.stringify(G.casa);
  const anotar = (f) => { C.hist.push(f); if (C.hist.length > 80) C.hist.shift(); C.redo.length = 0; };
  let tPublicar = 0;
  function guardar() {
    reino.rehacer(G.casa, true); G.visto.construyo = true; Guardado.guardar();
    clearTimeout(tPublicar); tPublicar = setTimeout(() => red.publicarCasa(G.casa), 400);
    pintar();
  }
  function volverA(pila, otra) {
    const f = pila.pop(); if (f == null) { sfx('no'); return; }
    otra.push(foto()); soltarTodo(); deseleccionar(true);
    G.casa = JSON.parse(f); guardar(); sfx('pop'); vibrar(10);
  }
  const deshacer = () => volverA(C.hist, C.redo), rehacer = () => volverA(C.redo, C.hist);
  const limpio = (l) => { const m = { k: l.k, x: +l.x.toFixed(2), z: +l.z.toFixed(2), r: norm(l.r || 0) }; if (l.c) m.c = l.c; if (l.y > 0) m.y = +l.y.toFixed(2); return m; };
  const lleno = () => { if (G.casa.length < MAX_COSAS) return false; decir(t('ob_lleno', { n: MAX_COSAS }), 'mal'); sfx('no'); return true; };

  /* lo colgado de una pared (los cuadros y los relojes): se mueve y gira con ella, y se va con ella */
  const colgadosDe = (w) => PAREDES.has(w.k) ? G.casa.filter((m) => PIEZAS[m.k]?.pared && m.x === w.x && m.z === w.z && (m.y || 0) === (w.y || 0)) : [];
  const sacar = (lista) => { const S = new Set(lista.flatMap((m) => [m, ...colgadosDe(m)])); G.casa = G.casa.filter((m) => !S.has(m)); };

  /* ------------------------------------------------ elegir */
  function seleccionar(m, callado = false) {
    if (C.sel !== m) C.colores = false;
    C.sel = m; C.herr = null; reino.guias([]);
    if (!callado) { sfx('elegir'); vibrar(10); }
    pintar();
  }
  function deseleccionar(callado = false) { if (!C.sel) return; C.sel = null; C.colores = false; reino.huella(null); if (!callado) sfx('mover'); pintar(); }
  const mostrar = (m, si) => { const o = reino.grupoDe(m); if (o) { o.userData.oculto = !si; o.visible = si; } };

  /* ------------------------------------------------ poner desde el catálogo */
  const giroInicial = (k) => PIEZAS[k]?.pared ? 0 : norm(Math.round(cam.yaw / (Math.PI / 2)) * (Math.PI / 2));
  /* un cuadro o un reloj: en la pared más cerca del medio de la vista, del lado que mira a la cámara */
  function colgarCerca(k, x, z) {
    let w = null, md = 9;
    for (const m of G.casa) if (COLGAR_EN.has(m.k)) { const d = Math.hypot(m.x - x, m.z - z); if (d < md) { md = d; w = m; } }
    return w ? lugar(k, w.x + Math.sin(cam.yaw) * 0.5, w.z + Math.cos(cam.yaw) * 0.5, 0) : null;
  }
  function poner(k) {
    if (lleno()) return null;
    const c = cam.plano.centro, l = PIEZAS[k]?.pared ? colgarCerca(k, c.x, c.z) : libreCerca(k, c.x, c.z, giroInicial(k));
    if (!l || !l.ok) { decir(t(PIEZAS[k]?.pared ? 'ob_colgar' : 'ob_sin_lugar'), 'mal'); sfx('no'); return null; }
    const f = foto(), m = limpio(l); G.casa.push(m); anotar(f); guardar(); seleccionar(m, true); sfx('pop'); vibrar(14);
    return m;
  }

  /* ------------------------------------------------ arrastrar lo elegido */
  function empezarArrastre(m, q, { f = foto(), nuevo = false } = {}) {
    const p = pisoBajo(q.x, q.y) || { x: m.x, z: m.z };
    C.arr = { m, off: nuevo ? { x: 0, z: 0 } : { x: m.x - p.x, z: m.z - p.z }, antes: { x: m.x, z: m.z, r: m.r || 0, y: m.y || 0 }, f, nuevo, ultimo: nuevo ? null : { ...m, ok: true }, l: null, q, oculta: null,
      colgados: colgadosDe(m).map((c) => ({ c, dr: (c.r || 0) - (m.r || 0) })) };
    seleccionar(m, true); C.colores = false; vibrar(12); moverArrastre(q); pintar();
  }
  function moverArrastre(q) {
    const A = C.arr; A.q = q; const p = pisoBajo(q.x, q.y); if (!p) return;
    const l = lugar(A.m.k, p.x + A.off.x, p.z + A.off.z, A.m.r || 0, A.m);
    if (A.oculta !== (l.reemplaza || null)) { if (A.oculta) mostrar(A.oculta, true); A.oculta = l.reemplaza || null; if (A.oculta) mostrar(A.oculta, false); }
    if (l.ok) { if (A.l && (A.l.x !== l.x || A.l.z !== l.z)) vibrar(4); A.ultimo = l; }
    A.l = l;
    for (const q of [{ c: A.m, dr: 0 }, ...A.colgados]) { const o = reino.grupoDe(q.c); if (o) { o.position.set(l.x, BASE + (l.y || 0) + 0.12, l.z); o.rotation.y = l.r + q.dr; } }
    reino.huella(l, l.ok ? 'ok' : 'mal');
  }
  function soltar() {
    const A = C.arr; if (!A) return; C.arr = null;
    if (A.oculta) mostrar(A.oculta, true);
    const l = A.l?.ok ? A.l : A.ultimo, m = A.m;
    if (!l) {   // (una nueva que nunca entró: no queda)
      G.casa = G.casa.filter((q) => q !== m); reino.rehacer(G.casa, true); deseleccionar(true);
      decir(t(A.l?.porque === 'fuera' ? 'ob_fuera' : A.l?.porque === 'colgar' ? 'ob_colgar' : 'ob_sin_lugar'), 'mal'); sfx('no'); pintar(); return;
    }
    if (!A.l?.ok) { decir(t(A.l?.porque === 'fuera' ? 'ob_fuera' : A.l?.porque === 'colgar' ? 'ob_colgar' : 'ob_volvio'), 'mal'); sfx('no'); }
    const cambio = A.nuevo || l.x !== A.antes.x || l.z !== A.antes.z || norm(l.r) !== norm(A.antes.r) || (l.y || 0) !== A.antes.y || !!l.reemplaza;
    m.x = +l.x.toFixed(2); m.z = +l.z.toFixed(2); m.r = norm(l.r); if (l.y > 0) m.y = +l.y.toFixed(2); else delete m.y;
    for (const { c, dr } of A.colgados) { c.x = m.x; c.z = m.z; c.r = norm(m.r + dr); if (m.y) c.y = m.y; else delete c.y; }
    if (l.reemplaza) sacar([l.reemplaza]);
    if (cambio) { anotar(A.f); guardar(); if (A.l?.ok) sfx('pop'); vibrar(14); }
    else { const o = reino.grupoDe(m); if (o) o.position.y = BASE + (m.y || 0); }
    seleccionar(m, true);
  }
  /* (el dedo que arrastra se fue sin soltar, o llegó otro: queda donde estaba bien) */
  function soltarTodo() { if (C.arr) soltar(); if (C.trazo) { C.trazo = null; reino.guias([]); } }

  /* ------------------------------------------------ la barrita de lo elegido */
  function girarSel() {
    const m = C.sel; if (!m) return;
    const P = PIEZAS[m.k], f = foto();
    if (P?.pared) { m.r = norm((m.r || 0) + Math.PI); anotar(f); guardar(); sfx('mover'); return; }
    const paso = esObra(m.k) || P?.paso ? Math.PI / 2 : Math.PI / 4;
    for (let i = 1; i * paso < TAU - 1e-3; i++) {
      const l = lugar(m.k, m.x, m.z, (m.r || 0) + paso * i, m);
      if (l.ok && Math.abs(l.x - m.x) < 0.01 && Math.abs(l.z - m.z) < 0.01) {
        for (const c of colgadosDe(m)) c.r = norm((c.r || 0) + (l.r - (m.r || 0)));
        m.r = norm(l.r); if (l.y > 0) m.y = +l.y.toFixed(2); anotar(f); guardar(); sfx('mover'); vibrar(8); return;
      }
    }
    decir(t('ob_no_entra'), 'mal'); sfx('no');
  }
  function copiarSel() {
    const m = C.sel; if (!m || lleno()) return;
    const [w] = medidas(m.k), c = Math.cos(m.r || 0), s = Math.sin(m.r || 0), d = Math.max(0.5, w) + 0.25;
    const l = PIEZAS[m.k]?.pared ? null : libreCerca(m.k, m.x + c * d, m.z - s * d, m.r || 0, null, false);
    if (!l) { decir(t(PIEZAS[m.k]?.pared ? 'ob_colgar' : 'ob_sin_lugar'), 'mal'); sfx('no'); return; }
    const f = foto(), n = limpio({ ...l, c: m.c }); G.casa.push(n); anotar(f); guardar(); seleccionar(n, true); sfx('pop'); vibrar(12);
  }
  function quitarSel() {
    const m = C.sel; if (!m) return;
    const f = foto(); sacar([m]); anotar(f); deseleccionar(true); guardar(); sfx('pop'); vibrar(20);
  }
  function pintarSel(c) {
    const m = C.sel; if (!m || (m.c || null) === (c || null)) return;
    const f = foto(); if (c) m.c = c; else delete m.c; anotar(f); guardar(); sfx('elegir');
  }

  /* ------------------------------------------------ las herramientas de dibujo */
  function elegirHerr(tipo, k) {
    soltarTodo(); deseleccionar(true);
    C.herr = C.herr && C.herr.tipo === tipo && C.herr.k === k ? null : { tipo, k };
    if (C.herr?.tipo === 'area' && k !== 'techo') C.pisoK = k;
    sfx('elegir'); pintar();
  }
  const rect = (a, b, tap) => {
    const dx = b.x - a.x, dz = b.z - a.z, W = tap ? 4 : Math.max(2, 2 * Math.round(Math.abs(dx) / 2)), D = tap ? 4 : Math.max(2, 2 * Math.round(Math.abs(dz) / 2));
    return { x0: dx >= 0 || tap ? a.x : a.x - W, z0: dz >= 0 || tap ? a.z : a.z - D, W, D };
  };
  /* una pieza de obra que se agrega: ya (igual a una que está), ok (reemplaza a otra si hace falta) o mal */
  function nueva(k, x, z, r, quitar, repinta = false) {
    const esPared = PAREDES.has(k), fino = !!PIEZAS[k]?.piso && !(medidas(k)[2] > 0.06), techo = !!PIEZAS[k]?.techo;
    const igual = G.casa.find((m) => Math.abs(m.x - x) < 0.05 && Math.abs(m.z - z) < 0.05 && (esPared ? PAREDES.has(m.k) && mismoEje(m.r, r) : fino ? !!PIEZAS[m.k]?.piso && !(medidas(m.k)[2] > 0.06) && !(m.y > 0.1) : techo ? m.k === k : false));
    const l = { k, x, z, r: norm(r), y: alturaPara(k, x, z) };
    if (igual && (igual.k === k || !repinta)) return { ...l, e: 'ya' };
    if (igual) l.reemplaza = igual;
    l.e = adentro(l) && !choca(l) ? 'ok' : 'mal';
    if (l.e === 'ok' && igual) quitar.push(igual);
    return l;
  }
  function piezasTrazo() {
    const T = C.trazo, H = C.herr, lista = [], quitar = []; let texto = '';
    if (!T || !H) return { lista, quitar, texto };
    const a = T.a, b = T.b;
    if (H.tipo === 'linea') {
      const dx = b.x - a.x, dz = b.z - a.z, ejeX = T.tap ? Math.abs(Math.cos(cam.yaw)) >= Math.abs(Math.sin(cam.yaw)) : Math.abs(dx) >= Math.abs(dz);
      const L = ejeX ? Math.abs(dx) : Math.abs(dz), s = Math.sign(ejeX ? dx : dz) || 1, n = T.tap ? 1 : Math.max(1, Math.round(L / 2));
      for (let i = 0; i < n; i++) lista.push(nueva(H.k, ejeX ? a.x + s * (1 + 2 * i) : a.x, ejeX ? a.z : a.z + s * (1 + 2 * i), ejeX ? 0 : Math.PI / 2, quitar));
      texto = t('ob_t_linea', { n, m: n * 2 });
    } else if (H.tipo === 'cuarto' || H.tipo === 'area') {
      const { x0, z0, W, D } = rect(a, b, T.tap);
      if (H.tipo === 'cuarto') {
        for (let i = 0; i < W / 2; i++) for (const z of [z0, z0 + D]) lista.push(nueva('pared', x0 + 1 + 2 * i, z, 0, quitar));
        for (let j = 0; j < D / 2; j++) for (const x of [x0, x0 + W]) lista.push(nueva('pared', x, z0 + 1 + 2 * j, Math.PI / 2, quitar));
      }
      const k = H.tipo === 'cuarto' ? C.pisoK : H.k;
      for (let i = 0; i < W / 2; i++) for (let j = 0; j < D / 2; j++) lista.push(nueva(k, x0 + 1 + 2 * i, z0 + 1 + 2 * j, 0, quitar, H.tipo === 'area'));
      texto = H.tipo === 'cuarto' ? t('ob_t_cuarto', { a: W, b: D }) : t('ob_t_area', { n: (W / 2) * (D / 2) });
    } else if (H.tipo === 'demoler') {
      const x0 = Math.min(a.x, b.x) - 0.3, x1 = Math.max(a.x, b.x) + 0.3, z0 = Math.min(a.z, b.z) - 0.3, z1 = Math.max(a.z, b.z) + 0.3;
      for (const m of G.casa) if (m.x >= x0 && m.x <= x1 && m.z >= z0 && m.z <= z1) { quitar.push(m); lista.push({ ...m, e: 'quita' }); }
      texto = t('ob_t_demoler', { n: quitar.length });
    }
    return { lista, quitar, texto };
  }
  function moverTrazo(q, tap = false) {
    const T = C.trazo, p = pisoPlano(q.x, q.y); if (!p) return;
    T.q = q; T.b = C.herr.tipo === 'demoler' ? p : { x: Math.round(p.x), z: Math.round(p.z) }; T.tap = tap;
    const L = piezasTrazo(); reino.guias(L.lista); C.textoTrazo = L.texto; pintarPista();
  }
  function terminarTrazo(tap) {
    const T = C.trazo; if (!T) return;
    if (tap) moverTrazo(T.q, true);
    const L = piezasTrazo(); C.trazo = null; C.textoTrazo = ''; reino.guias([]);
    const nuevas = L.lista.filter((e) => e.e === 'ok'), quitar = [...new Set(L.quitar)];
    if (!nuevas.length && !quitar.length) { if (L.lista.some((e) => e.e === 'mal')) { decir(t('ob_no_entra'), 'mal'); sfx('no'); } pintar(); return; }
    const f = foto(), libre = MAX_COSAS - (G.casa.length - quitar.length);
    if (nuevas.length > libre) { nuevas.length = Math.max(0, libre); decir(t('ob_lleno', { n: MAX_COSAS }), 'mal'); }
    sacar(quitar);
    for (const e of nuevas) G.casa.push(limpio(e));
    anotar(f); guardar(); sfx(C.herr?.tipo === 'demoler' ? 'pop' : 'elegir'); vibrar(16);
  }

  /* ------------------------------------------------ los dedos y el mouse (sobre el lienzo o la capa de los dedos) */
  const enJuego = (e) => e.target === motor.lienzo || e.target === ent.capa || !!e.target.closest?.('#dedos');
  const aJ = (e) => Pantalla.aJuego(e.clientX, e.clientY);
  const dosDedos = () => { const [a, b] = [...C.dedos.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }; };
  function abajo(e) {
    if (!enJuego(e) || C.dedos.size >= 2) return;
    e.preventDefault(); e.stopPropagation();
    const q = aJ(e); C.dedos.set(e.pointerId, { x: q.x, y: q.y, x0: q.x, y0: q.y, t0: performance.now() });
    if (C.dedos.size === 2) {   // dos dedos: se suelta lo que había y la vista es de los dos
      clearTimeout(C.largo); soltarTodo(); C.gesto = { tipo: 'dos', ...dosDedos() }; pintar(); return;
    }
    const der = e.pointerType === 'mouse' && e.button === 2;
    if (der) { C.gesto = { tipo: 'girar', pid: e.pointerId }; return; }
    if (C.herr) { C.gesto = { tipo: 'trazo', pid: e.pointerId }; const p = pisoPlano(q.x, q.y); if (p) { C.trazo = { a: C.herr.tipo === 'demoler' ? p : { x: Math.round(p.x), z: Math.round(p.z) }, b: p, q }; moverTrazo(q); } return; }
    const toca = elegirEn(q.x, q.y);
    if (toca && toca === C.sel) { C.gesto = { tipo: 'arrastre?', pid: e.pointerId, m: toca }; return; }
    C.gesto = { tipo: 'pan?', pid: e.pointerId, toca };
    /* (apretar un rato sobre algo lo agarra: se elige y se arrastra de una) */
    clearTimeout(C.largo);
    if (toca) C.largo = setTimeout(() => { const D = C.dedos.get(e.pointerId); if (C.gesto?.tipo === 'pan?' && D && Math.hypot(D.x - D.x0, D.y - D.y0) < 10) { C.gesto = { tipo: 'arrastre', pid: e.pointerId }; empezarArrastre(toca, D); } }, 420);
  }
  function mueve(e) {
    const D = C.dedos.get(e.pointerId); if (!D) return;
    const q = aJ(e), px = D.x, py = D.y; D.x = q.x; D.y = q.y;
    const G0 = C.gesto; if (!G0) return;
    const lejos = Math.hypot(q.x - D.x0, q.y - D.y0);
    if (G0.tipo === 'dos' && C.dedos.size === 2) {
      const n = dosDedos(), P = cam.plano;
      const a = pisoPlano(G0.mx, G0.my), b = pisoPlano(n.mx, n.my);
      if (a && b) { P.centro.x += a.x - b.x; P.centro.z += a.z - b.z; }
      if (G0.d > 20 && n.d > 20) P.dist = THREE.MathUtils.clamp(P.dist * G0.d / n.d, 5, 30);
      let da = n.ang - G0.ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      cam.yaw += da; C.yawObj = cam.yaw;   // (la vista gira con los dedos)
      Object.assign(G0, n); return;
    }
    if (G0.pid !== e.pointerId) return;
    if (G0.tipo === 'girar') { cam.yaw -= (q.x - px) * 0.008; C.yawObj = cam.yaw; C.inclina = THREE.MathUtils.clamp(C.inclina + (q.y - py) * 0.004, -0.35, 0.35); return; }
    if (G0.tipo === 'trazo') { if (C.trazo) moverTrazo(q); return; }
    if (G0.tipo === 'arrastre?' && lejos > 7) { G0.tipo = 'arrastre'; empezarArrastre(G0.m, { x: D.x0, y: D.y0 }); }
    if (G0.tipo === 'arrastre') { if (C.arr) moverArrastre(q); return; }
    if (G0.tipo === 'pan?' && lejos > 7) { G0.tipo = 'pan'; clearTimeout(C.largo); }
    if (G0.tipo === 'pan') { const a = pisoPlano(px, py), b = pisoPlano(q.x, q.y); if (a && b) { cam.plano.centro.x += a.x - b.x; cam.plano.centro.z += a.z - b.z; } }
  }
  function arriba(e) {
    const D = C.dedos.get(e.pointerId); if (!D) return;
    C.dedos.delete(e.pointerId); clearTimeout(C.largo);
    const G0 = C.gesto;
    if (G0?.tipo === 'dos') { if (!C.dedos.size) C.gesto = null; else C.gesto = { tipo: 'nada' }; return; }
    if (!C.dedos.size) C.gesto = null;
    if (!G0 || G0.pid !== e.pointerId) return;
    const tap = Math.hypot(D.x - D.x0, D.y - D.y0) < 8 && performance.now() - D.t0 < 450 && e.type !== 'pointercancel';
    if (G0.tipo === 'trazo') { if (e.type === 'pointercancel') { C.trazo = null; reino.guias([]); pintar(); } else terminarTrazo(tap); return; }
    if (G0.tipo === 'arrastre') { soltar(); return; }
    if (tap && (G0.tipo === 'pan?' || G0.tipo === 'arrastre?')) {
      const m = G0.toca ?? G0.m ?? elegirEn(D.x0, D.y0);
      if (m) seleccionar(m, m === C.sel); else deseleccionar();
    }
  }
  const pd = (e) => abajo(e), pm = (e) => mueve(e), pu = (e) => arriba(e);
  addEventListener('pointerdown', pd, true); addEventListener('pointermove', pm, true);
  addEventListener('pointerup', pu, true); addEventListener('pointercancel', pu, true);
  const menuContexto = (e) => { if (enJuego(e)) e.preventDefault(); };
  const rueda = (e) => { if (!enJuego(e)) return; e.preventDefault(); e.stopPropagation(); cam.plano.dist = THREE.MathUtils.clamp(cam.plano.dist * Math.pow(1.12, Math.sign(e.deltaY)), 5, 30); };
  addEventListener('wheel', rueda, { capture: true, passive: false });
  addEventListener('contextmenu', menuContexto, true);
  /* las teclas: R gira, Supr quita, Ctrl+Z deshace, Ctrl+Y rehace, Q y E giran la vista, C copia */
  const teclas = (e) => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
    else if (ctrl && e.code === 'KeyY') { e.preventDefault(); rehacer(); }
    else if (e.code === 'KeyR') girarSel();
    else if (e.code === 'KeyC' && !ctrl) copiarSel();
    else if (e.code === 'Delete' || e.code === 'Backspace') quitarSel();
    else if (e.code === 'KeyQ') girarVista(1);
    else if (e.code === 'KeyE') girarVista(-1);
  };
  addEventListener('keydown', teclas);
  const girarVista = (s) => { C.yawObj += s * Math.PI / 4; sfx('mover'); };

  /* ------------------------------------------------ la interfaz */
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const raiz = UI.poner(el(`<div class="ob">
    <div class="ob-arriba"><button class="ob-b" data-a="deshacer">↶</button><button class="ob-b" data-a="rehacer">↷</button><b class="ob-cuenta"></b>
      <span class="ob-hueco"></span><button class="ob-b" data-a="camIzq">⟲</button><button class="ob-b" data-a="camDer">⟳</button><button class="ob-b ob-vista" data-a="vista"><i></i><span></span></button>
      <button class="boton chico primario ob-listo" data-a="listo"></button></div>
    <div class="ob-pista"><span></span><button class="ob-x" data-a="sinHerr">✕</button></div>
    <div class="ob-barra"><button data-a="girar">↻</button><button data-a="color">🎨</button><button data-a="copiar">⧉</button><button data-a="quitar">🗑</button><button data-a="ok">✓</button></div>
    <div class="ob-colores"></div>
    <div class="ob-cajon"><div class="ob-tabs"></div><div class="ob-items"></div></div>
  </div>`));
  const $ = (s) => raiz.querySelector(s);
  const B = { barra: $('.ob-barra'), colores: $('.ob-colores'), pista: $('.ob-pista'), items: $('.ob-items'), tabs: $('.ob-tabs'), cajon: $('.ob-cajon') };
  $('.ob-listo').textContent = '✓ ' + t('casa_listo');
  for (const [a, k] of [['deshacer', 'ob_deshacer'], ['rehacer', 'ob_rehacer'], ['camIzq', 'ob_cam_izq'], ['camDer', 'ob_cam_der'], ['sinHerr', 'ob_terminar']]) raiz.querySelector(`[data-a=${a}]`).setAttribute('aria-label', t(k));
  for (const [a, k] of [['girar', 'ob_girar'], ['color', 'ob_color'], ['copiar', 'ob_copiar'], ['quitar', 'ob_quitar'], ['ok', 'casa_listo']]) { const b = B.barra.querySelector(`[data-a=${a}]`); b.setAttribute('aria-label', t(k)); b.title = t(k); }
  const ACC = {
    deshacer, rehacer, camIzq: () => girarVista(1), camDer: () => girarVista(-1), listo: () => ctx.alListo(),
    vista: () => { C.vista = { cortadas: 'bajas', bajas: 'enteras', enteras: 'cortadas' }[C.vista]; sfx('elegir'); pintar(); },
    sinHerr: () => { C.herr = null; C.trazo = null; reino.guias([]); sfx('mover'); pintar(); },
    girar: girarSel, copiar: copiarSel, quitar: quitarSel, ok: () => deseleccionar(),
    color: () => { C.colores = !C.colores; sfx('elegir'); pintar(); },
  };
  /* los botones responden al levantar el dedo, sin esperar el clic: el navegador se come el clic de un toque que llega
     justo después de un arrastre (lo toma como el freno de una inercia) y parece que el botón no anda. El clic queda
     para el teclado y los lectores de pantalla (y no hace nada dos veces) */
  let toque = null;
  raiz.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); toque = b && !(e.pointerType === 'mouse' && e.button !== 0) ? { b, id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  raiz.addEventListener('pointerup', (e) => {
    const T = toque; toque = null; if (!T || T.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - T.x, e.clientY - T.y) > 12 || performance.now() - T.t > 900) return;
    if (e.pointerType === 'mouse' && e.target.closest('button') !== T.b) return;
    T.b._tocado = performance.now(); activar(T.b);
  });
  raiz.addEventListener('pointercancel', () => { toque = null; });
  raiz.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !(performance.now() - (b._tocado || 0) < 900)) activar(b); });
  function activar(b) {
    if (b.disabled || !b.isConnected) return;
    if (b.dataset.a && ACC[b.dataset.a]) ACC[b.dataset.a]();
    else if (b.dataset.c != null && b.classList.contains('ob-color')) { pintarSel(b.dataset.c || null); pintar(); }
    else if (b.dataset.tab === '-') { C.cerrado = !C.cerrado; sfx('mover'); pintar(); }
    else if (b.dataset.tab) { C.tab = b.dataset.tab; C.cerrado = false; sfx('elegir'); pintarCatalogo(); pintar(); }
    else if (b.classList.contains('ob-carta')) b._activar?.();
  }
  /* los colores de lo elegido */
  { const b0 = el('<button class="ob-color orig" data-c="">✦</button>'); b0.setAttribute('aria-label', t('ob_color_orig')); B.colores.appendChild(b0); for (const c of PALETA) { const b = el(`<button class="ob-color" data-c="${c}" style="background:${c}"></button>`); b.setAttribute('aria-label', c); B.colores.appendChild(b); } }

  /* las pestañas y el catálogo */
  for (const [id, ico] of TABS) { const b = el(`<button class="ob-tab" data-tab="${id}"><i>${ico}</i><span></span></button>`); b.lastChild.textContent = t('obt_' + id); b.setAttribute('aria-label', t('obt_' + id)); B.tabs.appendChild(b); }
  { const b = el('<button class="ob-tab ob-cerrar" data-tab="-"><i>▾</i></button>'); b.setAttribute('aria-label', t('ob_catalogo')); B.tabs.appendChild(b); }
  const cola = [];
  function pintarCatalogo() {
    B.items.innerHTML = ''; B.items.scrollLeft = 0;
    for (const q of TABS.find((x) => x[0] === C.tab)[2]) {
      const [tipo, k0] = q[0] === '@' ? q.slice(1).split(':') : ['pieza', q], k = k0 || (tipo === 'cuarto' ? '@cuarto' : null);
      const nombre = tipo === 'cuarto' ? t('ob_cuarto') : tipo === 'demoler' ? t('ob_demoler') : t('pz_' + k);
      const b = el(`<button class="ob-carta" data-q="${q}"><span class="ob-mini"></span><small></small></button>`);
      b.lastChild.textContent = nombre; b.setAttribute('aria-label', nombre + (tipo !== 'pieza' ? ' (' + t('ob_dibuja') + ')' : ''));
      const mini = b.firstChild;
      if (k && MINI.has(k)) mini.style.backgroundImage = `url(${MINI.get(k)})`;
      else { mini.textContent = tipo === 'demoler' ? '🧹' : tipo === 'cuarto' ? '🏠' : ICONO(k); if (k) cola.push(k); }
      if (tipo !== 'pieza') b.appendChild(el(`<i class="ob-herr">${HERR[tipo]}</i>`));
      b.dataset.k = k || ''; b.dataset.tipo = tipo;
      cartaArrastrable(b, tipo, k);
      B.items.appendChild(b);
    }
  }
  /* una carta: tocarla pone la pieza (o elige la herramienta); arrastrarla para arriba la lleva hasta donde va */
  function cartaArrastrable(b, tipo, k) {
    let D = null;
    b.addEventListener('pointerdown', (e) => { if (tipo !== 'pieza' || (e.pointerType === 'mouse' && e.button !== 0)) return; const q = aJ(e); D = { pid: e.pointerId, x0: q.x, y0: q.y, sale: false }; try { b.setPointerCapture(e.pointerId); } catch { /* ya se fue */ } });
    b.addEventListener('pointermove', (e) => {
      if (!D || D.pid !== e.pointerId) return;
      const q = aJ(e);
      if (!D.sale) {
        if ((D.y0 - q.y > 16 && D.y0 - q.y > Math.abs(q.x - D.x0)) || q.y < Pantalla.caja(B.cajon).top - 6) {
          if (lleno()) { D = null; return; }
          const p = pisoBajo(q.x, q.y); if (!p) return;
          D.sale = true; soltarTodo();
          const f = foto(), m = { k, x: p.x, z: p.z, r: giroInicial(k) };
          G.casa.push(m); reino.rehacer(G.casa, true); C.gesto = null; empezarArrastre(m, q, { f, nuevo: true });
        }
        return;
      }
      if (C.arr) moverArrastre(q);
    });
    const fin = (e) => { if (!D || D.pid !== e.pointerId) return; const sale = D.sale; D = null; if (sale) soltar(); };
    b.addEventListener('pointerup', fin); b.addEventListener('pointercancel', fin);
    b._activar = () => { if (tipo === 'pieza') { soltarTodo(); poner(k); } else elegirHerr(tipo, k); };
  }

  function pintarPista() {
    const H = C.herr, tactil = ent.tactil;
    let txt;
    if (C.mensaje && performance.now() < C.mensaje.hasta) txt = C.mensaje.txt;
    else if (C.trazo && C.textoTrazo) txt = C.textoTrazo;
    else if (H) txt = t(H.tipo === 'area' ? (H.k === 'techo' ? 'ob_h_techo' : 'ob_h_area') : 'ob_h_' + H.tipo) + ' · ' + t(tactil ? 'ob_h_dos' : 'ob_h_dos_mouse');
    else if (C.sel) txt = t('ob_h_sel');
    else txt = t(tactil ? 'ob_h_nada_dedo' : 'ob_h_nada_mouse');
    const s = B.pista.firstChild; if (s.textContent !== txt) s.textContent = txt;
    B.pista.className = 'ob-pista' + (C.mensaje && performance.now() < C.mensaje.hasta ? ' ' + C.mensaje.tipo : '') + (H ? ' con-herr' : '');
  }
  function decir(txt, tipo = 'info') { C.mensaje = { txt, tipo, hasta: performance.now() + 2600 }; pintarPista(); }
  const ICONO_VISTA = { cortadas: '◩', bajas: '▁', enteras: '▉' };
  function pintar() {
    $('.ob-cuenta').textContent = `${G.casa.length}/${MAX_COSAS}`;
    $('[data-a=deshacer]').disabled = !C.hist.length; $('[data-a=rehacer]').disabled = !C.redo.length;
    const v = $('.ob-vista'); v.firstChild.textContent = ICONO_VISTA[C.vista]; v.lastChild.textContent = t('ob_vista_' + C.vista); v.setAttribute('aria-label', t('ob_vista_' + C.vista)); v.dataset.vista = C.vista;
    B.tabs.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('si', b.dataset.tab === C.tab));
    B.tabs.querySelector('.ob-cerrar i').textContent = C.cerrado ? '▴' : '▾';
    B.cajon.classList.toggle('cerrado', C.cerrado);
    B.items.querySelectorAll('.ob-carta').forEach((b) => b.classList.toggle('si', !!C.herr && b.dataset.tipo === C.herr.tipo && (b.dataset.k || null) === (C.herr.k || (C.herr.tipo === 'cuarto' ? '@cuarto' : null))));
    B.colores.classList.toggle('abierto', !!C.sel && C.colores && !C.arr);
    B.colores.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('si', (b.dataset.c || null) === (C.sel?.c || null)));
    raiz.classList.toggle('arrastrando', !!C.arr || !!C.trazo);
    pintarPista();
  }

  /* ------------------------------------------------ las miniaturas: con las luces de la escena, en la capa 7 */
  const camMini = new THREE.PerspectiveCamera(28, 1, 0.1, 100); camMini.layers.set(7);
  const SOL_MINI = new THREE.Vector3(4, 9, 6), DIR = new THREE.Vector3(0.5, 0.52, 0.72).normalize(), _cc = new THREE.Color(), _vp = new THREE.Vector4(), _sc = new THREE.Vector4();
  const lienzoMini = document.createElement('canvas'), gMini = lienzoMini.getContext('2d');
  let rtMini = null;
  function hacerMini(k) {
    const r = motor.r, esc = motor.escena, cv = r.domElement, S = Math.max(32, Math.min(112, cv.width, cv.height) | 0);
    const o = armarMini(k); o.position.set(0, -300, 0); o.traverse((q) => q.layers.set(7)); esc.add(o); o.updateMatrixWorld(true);
    const esf = new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()), dist = esf.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02;
    camMini.position.copy(esf.center).addScaledVector(DIR, dist); camMini.lookAt(esf.center); camMini.near = Math.max(0.05, dist - esf.radius * 2); camMini.far = dist + esf.radius * 2; camMini.updateProjectionMatrix();
    /* (las mismas luces, pero de día: de noche el catálogo salía oscuro. Cambiar la intensidad no recompila nada) */
    const luces = [], antes = []; esc.traverse((q) => { if (q.isLight) { if (!q.layers.isEnabled(7)) { q.layers.enable(7); luces.push(q); } antes.push([q, q.intensity, q.color.clone(), q.groundColor?.clone(), q.position.clone()]); } });
    for (const [q] of antes) {
      if (q.isDirectionalLight) { q.intensity = 2.2; q.color.set('#fff4e6'); q.position.copy(q.target.position).add(SOL_MINI); q.updateMatrixWorld(); q.target.updateMatrixWorld(); }
      else if (q.isHemisphereLight) { q.intensity = 0.6; q.color.set('#dff2ff'); q.groundColor.set('#a9c9a2'); }
      else if (q.isAmbientLight) q.intensity = Math.min(q.intensity, 0.4);
      else q.intensity = 0;
    }
    const fondo = esc.background, au = r.shadowMap.autoUpdate, nu = r.shadowMap.needsUpdate, ca = r.getClearAlpha(); r.getClearColor(_cc);
    esc.background = null; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = false;
    lienzoMini.width = lienzoMini.height = S;
    try {
      if (motor.usaCadena) {   // (con la cadena de efectos la escena se dibuja en un lienzo aparte: igual acá)
        if (!rtMini || rtMini.width !== S) { rtMini?.dispose(); rtMini = new THREE.WebGLRenderTarget(S, S); }
        r.setRenderTarget(rtMini); r.setClearColor(FONDO, 1); r.clear(); r.render(esc, camMini);
        const px = new Uint8Array(S * S * 4); r.readRenderTargetPixels(rtMini, 0, 0, S, S, px); r.setRenderTarget(null);
        const img = gMini.createImageData(S, S), aS = (v) => { v /= 255; return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = ((S - 1 - y) * S + x) * 4, j = (y * S + x) * 4; img.data[j] = aS(px[i]); img.data[j + 1] = aS(px[i + 1]); img.data[j + 2] = aS(px[i + 2]); img.data[j + 3] = 255; }
        gMini.putImageData(img, 0, 0);
      } else {
        const pr = r.getPixelRatio(); r.getViewport(_vp); r.getScissor(_sc); const st = r.getScissorTest();
        r.setRenderTarget(null); r.setViewport(0, 0, S / pr, S / pr); r.setScissor(0, 0, S / pr, S / pr); r.setScissorTest(true);
        r.setClearColor(FONDO, 1); r.clear(); r.render(esc, camMini);
        gMini.drawImage(cv, 0, cv.height - S, S, S, 0, 0, S, S);
        r.setViewport(_vp); r.setScissor(_sc); r.setScissorTest(st);
      }
      MINI.set(k, lienzoMini.toDataURL('image/png'));
    } catch (e) { MINI.set(k, ''); console.warn('miniatura', k, e?.message); }
    finally {
      esc.remove(o); for (const q of luces) q.layers.disable(7);
      for (const [q, i, c, gc, p] of antes) { q.intensity = i; q.color.copy(c); if (gc) q.groundColor.copy(gc); if (!q.position.equals(p)) { q.position.copy(p); q.updateMatrixWorld(); } }
      esc.background = fondo; r.shadowMap.autoUpdate = au; r.shadowMap.needsUpdate = nu; r.setClearColor(_cc, ca);
    }
    const url = MINI.get(k);
    if (url) for (const b of B.items.querySelectorAll(`.ob-carta[data-k="${k}"] .ob-mini`)) { b.textContent = ''; b.style.backgroundImage = `url(${url})`; }
  }

  /* ------------------------------------------------ entrar */
  reino.rehacer(G.casa, true);   // (sin fundir: cada cosa suelta, para tocarla)
  const centro = (() => { const L = G.casa.filter((m) => !PIEZAS[m.k]?.techo); if (!L.length) return new THREE.Vector3(0, BASE, 0); let x = 0, z = 0; for (const m of L) { x += m.x; z += m.z; } x /= L.length; z /= L.length; const d = Math.hypot(x, z); if (d > 7) { x *= 7 / d; z *= 7 / d; } return new THREE.Vector3(x, BASE, z); })();
  cam.plano = { centro, dist: 11, firme: false };
  UI.hud?.classList.add('construyendo'); ent.modoObra = true; ent.capa.classList.add('en-obra');
  pintarCatalogo(); pintar(); decir(t('ob_hola'));

  /* ------------------------------------------------ cada cuadro */
  function actualizar(dt, E) {
    const P = cam.plano; C.t += dt;
    if (C.t > 0.7) P.firme = true;
    /* la palanca, las flechas o WASD mueven la vista; la rueda acerca */
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), v = P.dist * 0.8 * dt;
    let mx = E.x * v, mz = -E.z * v;
    if (E.zoom !== 1) P.dist = THREE.MathUtils.clamp(P.dist * E.zoom, 5, 30);
    /* arrastrando cerca del borde, la vista se corre sola */
    const q = C.arr?.q || C.trazo?.q;
    if (q && C.dedos.size === 1) {
      const top = Pantalla.caja(B.cajon).top, bx = q.x < 40 ? -1 : q.x > Pantalla.w - 40 ? 1 : 0, by = q.y < 70 ? 1 : q.y > top - 14 && q.y < top + 30 ? -1 : 0;
      if (bx || by) { mx += bx * P.dist * 0.5 * dt; mz += by * P.dist * 0.5 * dt; }
    }
    if (mx || mz) { P.centro.x += cy * mx - sy * mz; P.centro.z += -sy * mx - cy * mz; if (q) { if (C.arr) moverArrastre(q); else if (C.trazo) moverTrazo(q); } }
    const L = Math.hypot(P.centro.x, P.centro.z); if (L > 10) { P.centro.x *= 10 / L; P.centro.z *= 10 / L; }
    /* girar la vista de a 45° (suave); la inclinación va con la distancia, como en los Sims: de cerca se ve de costado */
    const dy = C.yawObj - cam.yaw; if (Math.abs(dy) > 1e-4) cam.yaw += dy * (1 - Math.exp(-dt * 10));
    cam.pitch = THREE.MathUtils.clamp(0.62 + (P.dist - 5) / 25 * 0.66 + C.inclina, 0.4, 1.45);
    E.x = 0; E.z = 0; E.salta = false; E.sostiene = false; E.accion = false; E.dispara = false; E.corre = false; E.baja = false; E.chat = false; E.hot = 0; E.camX = 0; E.camY = 0; E.zoom = 1; E.celu = false; E.foto = false;
    reino.cortar(C.vista, P.centro, cam.yaw);
    /* la huella y la barrita de lo elegido */
    const m = C.sel;
    if (m && !G.casa.includes(m)) deseleccionar(true);
    if (C.sel && !C.arr) reino.huella(C.sel, 'sel');
    const verBarra = !!C.sel && !C.arr && !C.trazo && C.dedos.size < 2;
    B.barra.classList.toggle('abierta', verBarra);
    if (verBarra) {
      const k = C.sel.k, h = Math.min(2.7, cajaLocal(k).max.y), p = aPantalla(C.sel.x, BASE + (C.sel.y || 0) + h + 0.2, C.sel.z);
      const w = B.barra.offsetWidth || 230, bh = B.barra.offsetHeight || 46, top = Pantalla.caja(B.cajon).top;
      let x = p.x - w / 2, y = p.y - bh - 12;
      if (p.detras) { x = (Pantalla.w - w) / 2; y = top - bh - 60; }
      x = Math.max(8, Math.min(Pantalla.w - w - 8, x)); y = Math.max(52, Math.min(top - bh - 8, y));
      B.barra.style.transform = `translate(${x | 0}px, ${y | 0}px)`;
      /* los colores, arriba de la barrita si entran (así no tapan lo que se pinta); si no, abajo */
      if (C.colores) { const cw = B.colores.offsetWidth, ch = B.colores.offsetHeight, cy = y - ch - 6 >= 52 ? y - ch - 6 : Math.min(top - ch - 6, y + bh + 6); B.colores.style.transform = `translate(${Math.max(8, Math.min(Pantalla.w - cw - 8, x + w / 2 - cw / 2)) | 0}px, ${cy | 0}px)`; }
    }
    if (C.mensaje && performance.now() > C.mensaje.hasta) { C.mensaje = null; pintarPista(); }
    /* Escape: primero suelta lo elegido o la herramienta; después termina */
    if (E.pausa) { E.pausa = false; if (C.arr || C.trazo) soltarTodo(); else if (C.sel) deseleccionar(); else if (C.herr) ACC.sinHerr(); else ctx.alListo(); }
  }
  /* antes de dibujar el cuadro: hasta dos miniaturas (las de la pestaña que se ve) */
  function antesDeDibujar() {
    for (let i = 0, n = motor.usaCadena ? 1 : 2; i < n && cola.length; i++) { const k = cola.shift(); if (MINI.has(k)) i--; else hacerMini(k); }
  }
  function cerrar() {
    soltarTodo(); clearTimeout(C.largo); clearTimeout(tPublicar);
    removeEventListener('pointerdown', pd, true); removeEventListener('pointermove', pm, true);
    removeEventListener('pointerup', pu, true); removeEventListener('pointercancel', pu, true);
    removeEventListener('contextmenu', menuContexto, true); removeEventListener('keydown', teclas); removeEventListener('wheel', rueda, true);
    raiz.remove();
    ent.modoObra = false; ent.capa.classList.remove('en-obra'); UI.hud?.classList.remove('construyendo');
    reino.huella(null); reino.guias([]); reino.verTechos(true); reino.rehacer(G.casa);
    cam.plano = null; red.publicarCasa(G.casa); Guardado.ya();
  }

  return {
    actualizar, antesDeDibujar, cerrar, raiz,
    /* (para las pruebas) */
    estado: () => ({ vacias: [...MINI].filter(([, u]) => !u).map(([k]) => k), n: G.casa.length, sel: C.sel, herr: C.herr, vista: C.vista, hist: C.hist.length, redo: C.redo.length, tab: C.tab, arrastrando: !!C.arr, trazo: !!C.trazo, colores: C.colores, cerrado: C.cerrado, minis: MINI.size, cola: cola.length }),
    lugar, choca, libreCerca, pisoBajo, aPantalla, elegirEn, poner, seleccionar, deseleccionar, elegirHerr, girarSel, copiarSel, quitarSel, pintarSel, deshacer, rehacer, girarVista,
    get C() { return C; },
  };
}
