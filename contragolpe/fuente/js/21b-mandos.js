
/* ====================== mandos a gusto ======================
   AJUSTES › MANDOS: cada botón (y la palanca) se arrastra adonde le quede cómodo a cada mano y se agranda o se achica; la
   opacidad de todos; la palanca flotante (aparece donde se apoya el dedo) o fija (queda en su lugar); zurdos (todo espejado: la
   palanca a la derecha y el mirar a la izquierda), y si vibra al tocar. Se guarda en G.mandos. Las posiciones van en fracción
   de la pantalla (el centro del botón): sirven igual en un teléfono chico que en una tableta. */
const MANDOS_ED = ['bDisparo', 'bDisparoI', 'bSalto', 'bAgachar', 'bRecargar', 'bMira', 'bUsar', 'bGranada', 'stick'];
const ED = {sel:null, arrastre:null, base:{}};
function mandosConf(){ const c = G.mandos || (G.mandos = {});
  if(!c.bt) c.bt = {}; if(c.alfa === undefined) c.alfa = 1; if(!c.palanca) c.palanca = 'flotante'; if(c.vibrar === undefined) c.vibrar = true; return c; }
function vibrarToque(){ const c = G.mandos; if(c && c.vibrar === false) return;
  try{ if(window.ContragolpeNativo && ContragolpeNativo.vibrar) ContragolpeNativo.vibrar(14); else if(navigator.vibrate) navigator.vibrate(14); }catch(e){} }
function stickEscala(){ const b = mandosConf().bt.stick; return b && b.s ? b.s : 1; }
/* el centro de la palanca en reposo (px de la pantalla del juego) */
function stickCentro(){ const pa = $('pantalla'), W = pa.clientWidth, H = pa.clientHeight, c = mandosConf(), b = c.bt.stick;
  let cx = b && b.cx !== undefined ? b.cx : ED.base.stick ? ED.base.stick.cx : 108/W, cy = b && b.cy !== undefined ? b.cy : ED.base.stick ? ED.base.stick.cy : (H - 104)/H;
  if(c.zurdo && !(b && b.cx !== undefined)) cx = 1 - cx; return {x:cx*W, y:cy*H}; }
/* flotante: la palanca aparece bajo el dedo; fija: el centro es el suyo */
function stickEmpieza(id, p, st){
  if(mandosConf().palanca === 'fija'){ const c = stickCentro(); return {id, x0:c.x, y0:c.y}; }
  st.style.left = p.x + 'px'; st.style.top = p.y + 'px'; return {id, x0:p.x, y0:p.y}; }
function stickSuelta(st){ if(mandosConf().palanca !== 'fija') return; const c = stickCentro(); st.style.left = c.x + 'px'; st.style.top = c.y + 'px'; }

/* dónde queda cada botón sin tocar (lo que dice el CSS), en fracción de la pantalla */
function medirBase(){ const pa = $('pantalla'), r0 = pa.getBoundingClientRect(), u = UI.u || 1, W = pa.clientWidth, H = pa.clientHeight, m = $('mandos'), veia = m.classList.contains('ver'), edit = m.classList.contains('editando');
  m.classList.add('ver', 'editando');
  for(const id of MANDOS_ED){ if(id === 'stick') continue; const el = $(id); for(const k of ['left', 'top', 'right', 'bottom']) el.style[k] = ''; el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); el.style.setProperty('--s', '1'); }
  for(const id of MANDOS_ED){ const el = $(id);
    if(id === 'stick'){ ED.base.stick = {cx:108/W, cy:(H - 104)/H}; continue; }
    const r = el.getBoundingClientRect(); let x = (r.left + r.right)/2, y = (r.top + r.bottom)/2;
    /* (con la pantalla girada por CSS las medidas del navegador van cruzadas) */
    const p = aJuego({clientX:x, clientY:y}); ED.base[id] = {cx:p.x/W, cy:p.y/H}; }
  if(!veia) m.classList.remove('ver'); if(!edit) m.classList.remove('editando'); }
function aplicarMandos(){
  const m = $('mandos'); if(!m) return; const c = mandosConf(), pa = $('pantalla'), W = pa.clientWidth, H = pa.clientHeight;
  medirBase();
  m.style.setProperty('--alfa', c.alfa); m.classList.toggle('zurdo', !!c.zurdo);
  for(const id of MANDOS_ED){ const el = $(id), b = c.bt[id] || {}, base = ED.base[id]; let cx = b.cx !== undefined ? b.cx : base.cx, cy = b.cy !== undefined ? b.cy : base.cy;
    /* zurdo: lo que quedó donde lo dejó el juego se espeja; lo que movió el jugador queda donde lo puso */
    if(c.zurdo && b.cx === undefined) cx = 1 - cx;
    el.style.setProperty('--s', b.s || 1);
    if(id === 'stick'){ if(!TACTIL.stick){ el.style.left = cx*W + 'px'; el.style.top = cy*H + 'px'; } continue; }
    el.style.left = (cx*100).toFixed(3) + '%'; el.style.top = (cy*100).toFixed(3) + '%'; el.style.right = el.style.bottom = 'auto';
    el.style.setProperty('--tx', '-50%'); el.style.setProperty('--ty', '-50%'); }
}

/* ---------- el editor ---------- */
function edTextos(){ const c = mandosConf(), s = (id, t)=>{ const e = $(id).querySelector('span'); if(e) e.textContent = t; }, b = ED.sel && c.bt[ED.sel];
  $('edTit').textContent = tr('MANDOS'); $('edTam').textContent = ED.sel ? Math.round(((b && b.s) || 1)*100) + '%' : '—';
  s('edAlfa', tr('OPACIDAD') + ': ' + Math.round(c.alfa*100) + '%'); s('edZurdo', tr('ZURDO') + ': ' + tr(c.zurdo ? 'SÍ' : 'NO'));
  s('edPalanca', tr('PALANCA') + ': ' + tr(c.palanca === 'fija' ? 'FIJA' : 'FLOTANTE')); s('edVibrar', tr('VIBRAR') + ': ' + tr(c.vibrar ? 'SÍ' : 'NO'));
  s('edRestablecer', tr('RESTABLECER')); s('edListo', tr('LISTO')); $('edAyuda').textContent = tr('ARRASTRÁ CADA BOTÓN ADONDE TE QUEDE CÓMODO · TOCALO PARA CAMBIARLE EL TAMAÑO'); }
function edElegir(id){ ED.sel = id; for(const k of MANDOS_ED) $(k).classList.toggle('sel', k === id); edTextos(); }
function abrirEditorMandos(){
  mostrar(null); const m = $('mandos'); m.classList.add('ver', 'editando'); $('editorMandos').classList.add('ver');
  if(!TACTIL.listo) mandosIniciar(); aplicarMandos(); edElegir(null); MENU.editando = true;
}
function cerrarEditorMandos(){ const m = $('mandos'); m.classList.remove('editando'); for(const k of MANDOS_ED) $(k).classList.remove('sel');
  $('editorMandos').classList.remove('ver'); MENU.editando = false; guardar(); aplicarMandos(); armarAjustes(); mostrar('capaAjustes'); }
/* el botón bajo el dedo (el más cercano cuyo círculo lo contiene, con un poco de margen) */
function edBuscar(p){ const pa = $('pantalla'), W = pa.clientWidth, H = pa.clientHeight, c = mandosConf(); let mejor = null, dm = 1e9;
  for(const id of MANDOS_ED){ const el = $(id), b = c.bt[id] || {}, base = ED.base[id]; let cx = b.cx !== undefined ? b.cx : base.cx; if(c.zurdo && b.cx === undefined) cx = 1 - cx; const cy = b.cy !== undefined ? b.cy : base.cy;
    const r = (id === 'stick' ? 64 : el.offsetWidth/2)*(b.s || 1) + 14, d = Math.hypot(p.x - cx*W, p.y - cy*H); if(d < r && d < dm){ dm = d; mejor = {id, dx:p.x - cx*W, dy:p.y - cy*H}; } }
  return mejor; }
(function(){
  const ed = $('editorMandos'); if(!ed) return;
  const empieza = (p)=>{ const b = edBuscar(p); if(!b){ edElegir(null); return; } edElegir(b.id); ED.arrastre = b; vibrarToque(); };
  const mueve = (p)=>{ const a = ED.arrastre; if(!a) return; const pa = $('pantalla'), W = pa.clientWidth, H = pa.clientHeight, c = mandosConf(), b = c.bt[a.id] || (c.bt[a.id] = {});
    b.cx = lim((p.x - a.dx)/W, 0.03, 0.97); b.cy = lim((p.y - a.dy)/H, 0.05, 0.97); aplicarMandos();
    /* el panel se corre al otro lado si el botón se lleva arriba */
    ed.classList.toggle('abajo', b.cy < 0.3); };
  const termina = ()=>{ if(ED.arrastre){ ED.arrastre = null; guardar(); } };
  ed.addEventListener('touchstart', ev=>{ if(ev.target.closest('.edPanel')) return; ev.preventDefault(); empieza(aJuego(ev.changedTouches[0])); }, {passive:false});
  ed.addEventListener('touchmove', ev=>{ if(!ED.arrastre) return; ev.preventDefault(); mueve(aJuego(ev.changedTouches[0])); }, {passive:false});
  ed.addEventListener('touchend', termina); ed.addEventListener('touchcancel', termina);
  ed.addEventListener('mousedown', ev=>{ if(ev.target.closest('.edPanel')) return; empieza(aJuego(ev)); });
  addEventListener('mousemove', ev=>{ if(ED.arrastre) mueve(aJuego(ev)); }); addEventListener('mouseup', termina);
  const clic = (id, fn)=> $(id).addEventListener('click', ev=>{ ev.stopPropagation(); if(window.sonarUI) sonarUI('ui_toque'); fn(); edTextos(); aplicarMandos(); guardar(); });
  const tam = d=>{ if(!ED.sel) return; const c = mandosConf(), b = c.bt[ED.sel] || (c.bt[ED.sel] = {}); b.s = +lim((b.s || 1) + d, 0.6, 1.8).toFixed(2); };
  clic('edMenos', ()=> tam(-0.1)); clic('edMas', ()=> tam(0.1));
  clic('edAlfa', ()=>{ const c = mandosConf(), o = [1, 0.85, 0.7, 0.55, 0.4, 0.25], i = o.findIndex(v=> Math.abs(v - c.alfa) < 0.01); c.alfa = o[(i + 1) % o.length]; });
  clic('edZurdo', ()=>{ const c = mandosConf(); c.zurdo = !c.zurdo;
    /* lo que ya se movió a mano también cambia de lado */
    for(const id in c.bt) if(c.bt[id].cx !== undefined) c.bt[id].cx = 1 - c.bt[id].cx; });
  clic('edPalanca', ()=>{ const c = mandosConf(); c.palanca = c.palanca === 'fija' ? 'flotante' : 'fija'; });
  clic('edVibrar', ()=>{ const c = mandosConf(); c.vibrar = !c.vibrar; if(c.vibrar) vibrarToque(); });
  clic('edRestablecer', ()=>{ const c = mandosConf(); c.bt = {}; c.alfa = 1; c.zurdo = false; c.palanca = 'flotante'; c.vibrar = true; edElegir(null); });
  $('edListo').addEventListener('click', ev=>{ ev.stopPropagation(); if(window.sonarUI) sonarUI('ui_toque'); cerrarEditorMandos(); });
})();
