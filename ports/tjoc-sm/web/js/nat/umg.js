/* UMG de Unreal 4.16 como DOM: UserWidget (árbol exportado), CanvasPanelSlot (anclas/márgenes/alineación),
   Border, Image, TextBlock, Button, VerticalBox, UniformGridPanel, Spacer, BackgroundBlur y widgets anidados.
   Escala de diseño: lado corto / 1080 (regla por defecto de UE). Animaciones de widget vía MovieScene. */
import { Mundo } from '../mundo.js';
import { METODOS, PROPS } from './motor.js';
import { UObj, Clase } from '../vm.js';
import { evalRich } from './timeline.js';

const VIS = ['visible', 'collapsed', 'hidden', 'hitinv', 'selfhitinv'];
const visDe = (v) => { if (typeof v === 'number') return VIS[v] || 'visible'; const s = String(v || 'Visible').split('::').pop(); return { Visible: 'visible', Collapsed: 'collapsed', Hidden: 'hidden', HitTestInvisible: 'hitinv', SelfHitTestInvisible: 'selfhitinv' }[s] || 'visible'; };
const s2c = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)));
export const css = (c, a = 1) => (c ? `rgba(${s2c(c.R ?? 1)},${s2c(c.G ?? 1)},${s2c(c.B ?? 1)},${(c.A ?? 1) * a})` : 'transparent');
const colorSlate = (c) => (c && c.SpecifiedColor ? c.SpecifiedColor : c);

export class UMG {
  constructor(M, raiz, base) {
    this.M = M; this.raiz = raiz; this.base = base; this.activos = new Set(); this.anims = new Set(); this.fuentes = new Map();
    this.escala = 1; this.texturas = {};
    if (raiz) addEventListener('resize', () => this.relayout());
  }
  async cargarIndice() { try { this.texturas = await (await fetch(this.base + 'ui.json')).json(); } catch { this.texturas = {}; } }
  url(ruta) { const t = this.texturas.tex?.[ruta]; return t ? this.base + (t.l?.[this.idioma] || t.f) : null; } // l: versión traducida de una imagen con texto
  tamTex(ruta) { const t = this.texturas.tex?.[ruta]; return t ? [t.w, t.h] : [32, 32]; }
  fuente(ruta) {
    if (!ruta) return 'sans-serif';
    if (this.fuentes.has(ruta)) return this.fuentes.get(ruta);
    const f = this.texturas.fuentes?.[ruta]; const nombre = 'F' + this.fuentes.size;
    if (f && typeof FontFace !== 'undefined') { const ff = new FontFace(nombre, `url(${this.base + f})`); ff.load().then((x) => document.fonts.add(x)).catch(() => {}); }
    this.fuentes.set(ruta, f ? `${nombre}, sans-serif` : 'sans-serif');
    return this.fuentes.get(ruta);
  }
  calcEscala() { const w = this.raiz?.clientWidth || innerWidth, h = this.raiz?.clientHeight || innerHeight; this.escala = Math.min(w, h) / 1080; return this.escala; }
  /* ---- creación ---- */
  crear(clase, dueno) {
    const M = this.M;
    const w = new UObj(clase instanceof Clase ? clase : null, 'UserWidget'); w.nat = 'UserWidget';
    w.widgets = new Map(); w.dueno = dueno || M.pc; w.esWidget = true;
    if (clase instanceof Clase) M.vm.iniciarVars(w, clase, (v) => M.resolverValor(v));
    let arbol = null; for (let c = clase; c && !arbol; c = c.superClase) arbol = c.j.widgets;
    w.dom = document.createElement('div'); w.dom.className = 'umg-raiz';
    w.dom.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    if (arbol) { const r = this.construir(arbol, w, null); if (r) w.dom.appendChild(r.dom); w.raizW = r; }
    for (const [n, x] of w.widgets) if (n in w.v || true) w.v[n] = x;
    let anims = {}; for (let c = clase; c; c = c.superClase) anims = { ...(c.j.anims || {}), ...anims };
    for (const [n, a] of Object.entries(anims)) w.v[n] = { __ref: true, nat: 'WidgetAnimation', id: 'wa' + w.id + n, nombre: n, datos: a, dueno: w };
    // enlaces de componentes (eventos de botones)
    for (let c = clase; c; c = c.superClase) for (const b of c.j.enlaces?.ComponentDelegateBindings || []) {
      const x = w.widgets.get(b.ComponentPropertyName);
      if (x) { const l = x.v[b.DelegatePropertyName] || (x.v[b.DelegatePropertyName] = []); l.push({ __ref: true, obj: w, fn: b.FunctionNameToBind }); }
    }
    if (clase instanceof Clase && M.vm.tiene(w, 'OnInitialized')) M.vm.llamar(w, 'OnInitialized', []);
    return w;
  }
  construir(d, uw, padre) {
    const M = this.M;
    const x = new UObj(null, d.tipo); x.nombre = d.n; x.d = d; x.props = { ...(d.props || {}) }; x.slot = d.slot ? { tipo: d.slot.tipo, p: d.slot.props || {} } : null; x.uw = uw; x.padreW = padre; x.esWidget = true;
    x.dom = document.createElement('div'); x.dom.dataset.w = d.n;
    x.dom.style.position = 'absolute'; x.dom.style.boxSizing = 'border-box';
    uw.widgets.set(d.n, x);
    let hijo = null;
    if (d.tipo.endsWith('_C')) { // widget de usuario anidado
      const c = M.vm.claseSync(d.tipo);
      hijo = this.crear(c, uw.dueno); x.sub = hijo; x.dom.appendChild(hijo.dom); hijo.dom.style.position = 'absolute';
      hijo.padreW = x; x.nat = 'UserWidget';
    }
    x.hijos = (d.hijos || []).map((h) => this.construir(h, uw, x));
    for (const h of x.hijos) x.dom.appendChild(h.dom);
    this.estilo(x);
    return x;
  }
  /* ---- estilo ---- */
  estilo(x) {
    const p = x.props, el = x.dom, s = this.escala, t = x.d.tipo;
    el.style.display = ''; el.style.visibility = '';
    const vis = visDe(p.Visibility);
    if (vis === 'collapsed') el.style.display = 'none';
    else if (vis === 'hidden') el.style.visibility = 'hidden';
    el.style.pointerEvents = vis === 'visible' && (t === 'Button' || t === 'Slider' || t === 'CheckBox') ? 'auto' : vis === 'visible' ? 'auto' : 'none';
    if (t === 'CanvasPanel' || t === 'Overlay' || t.endsWith('_C')) el.style.pointerEvents = 'none';
    el.style.opacity = p.RenderOpacity ?? 1;
    const rt = p.RenderTransform || {};
    const tr = rt.Translation || {}, sc = rt.Scale || {}, sh = rt.Shear || {};
    const piv = p.RenderTransformPivot || { X: 0.5, Y: 0.5 };
    el.style.transformOrigin = `${(piv.X ?? 0.5) * 100}% ${(piv.Y ?? 0.5) * 100}%`;
    x.tfBase = `translate(${(tr.X || 0) * s}px,${(tr.Y || 0) * s}px) rotate(${rt.Angle || 0}deg) scale(${sc.X ?? 1},${sc.Y ?? 1}) skew(${sh.X || 0}deg,${sh.Y || 0}deg)`;
    if (t === 'Image') {
      const b = p.Brush || {}; const ruta = b.ResourceObject?.asset;
      const col = p.ColorAndOpacity || { R: 1, G: 1, B: 1, A: 1 }; const tint = colorSlate(b.TintColor) || { R: 1, G: 1, B: 1, A: 1 };
      const url = ruta ? this.url(ruta) : null;
      const blanco = (col.R ?? 1) > 0.98 && (col.G ?? 1) > 0.98 && (col.B ?? 1) > 0.98 && (tint.R ?? 1) > 0.98 && (tint.G ?? 1) > 0.98 && (tint.B ?? 1) > 0.98;
      el.style.backgroundImage = ''; el.style.backgroundColor = ''; el.style.webkitMaskImage = ''; el.style.maskImage = '';
      if (b.DrawAs === 'ESlateBrushDrawType::NoDrawType') { /* nada */ }
      else if (url && blanco) { el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = '100% 100%'; el.style.opacity = (p.RenderOpacity ?? 1) * (col.A ?? 1) * (tint.A ?? 1); }
      else if (url) { el.style.backgroundColor = css({ R: (col.R ?? 1) * (tint.R ?? 1), G: (col.G ?? 1) * (tint.G ?? 1), B: (col.B ?? 1) * (tint.B ?? 1) }); el.style.webkitMaskImage = el.style.maskImage = `url(${url})`; el.style.webkitMaskSize = el.style.maskSize = '100% 100%'; el.style.opacity = (p.RenderOpacity ?? 1) * (col.A ?? 1) * (tint.A ?? 1); }
      else if (!ruta && b.DrawAs !== 'ESlateBrushDrawType::NoDrawType') { el.style.backgroundColor = css({ R: (col.R ?? 1) * (tint.R ?? 1), G: (col.G ?? 1) * (tint.G ?? 1), B: (col.B ?? 1) * (tint.B ?? 1), A: (col.A ?? 1) * (tint.A ?? 1) }); }
      const tam = b.ImageSize || (ruta ? { X: this.tamTex(ruta)[0], Y: this.tamTex(ruta)[1] } : { X: 32, Y: 32 });
      x.deseado = [tam.X ?? 32, tam.Y ?? 32];
    } else if (t === 'Border') {
      const c = colorSlate(p.BrushColor) || { R: 1, G: 1, B: 1, A: 1 }; const ruta = p.Background?.ResourceObject?.asset;
      el.style.backgroundColor = ruta ? '' : css(c);
      if (ruta && this.url(ruta)) { el.style.backgroundImage = `url(${this.url(ruta)})`; el.style.backgroundSize = '100% 100%'; }
      const pad = p.Padding || { Left: 4, Top: 2, Right: 4, Bottom: 2 };
      el.style.padding = `${(pad.Top ?? 2) * s}px ${(pad.Right ?? 4) * s}px ${(pad.Bottom ?? 2) * s}px ${(pad.Left ?? 4) * s}px`;
    } else if (t === 'TextBlock') {
      const f = p.Font || {}; const tam = (f.Size ?? 24) * s * 96 / 72;
      el.style.fontFamily = this.fuente(f.FontObject?.asset); el.style.fontSize = tam + 'px'; el.style.lineHeight = '1.2'; el.style.whiteSpace = p.AutoWrapText ? 'normal' : 'pre';
      const c = colorSlate(p.ColorAndOpacity) || { R: 1, G: 1, B: 1, A: 1 }; el.style.color = css(c);
      const j = String(p.Justification || 'Left').split('::').pop(); el.style.textAlign = j === 'Center' ? 'center' : j === 'Right' ? 'right' : 'left';
      if (p.ShadowOffset && (p.ShadowColorAndOpacity?.A ?? 0) > 0) el.style.textShadow = `${(p.ShadowOffset.X ?? 1) * s}px ${(p.ShadowOffset.Y ?? 1) * s}px 0 ${css(p.ShadowColorAndOpacity)}`;
      el.textContent = this.textoDe(p.Text);
      x.deseado = null;
    } else if (t === 'Button') {
      const st = p.WidgetStyle || {}; const normal = st.Normal || {};
      const bg = p.BackgroundColor || { R: 1, G: 1, B: 1, A: 1 }; const tint = colorSlate(normal.TintColor) || { R: 1, G: 1, B: 1, A: 1 };
      const ruta = normal.ResourceObject?.asset;
      el.style.backgroundColor = ruta ? '' : css({ R: (bg.R ?? 1) * (tint.R ?? 1) * 0.2, G: (bg.G ?? 1) * (tint.G ?? 1) * 0.2, B: (bg.B ?? 1) * (tint.B ?? 1) * 0.2, A: (bg.A ?? 1) * (tint.A ?? 1) * 0.6 });
      if (ruta && this.url(ruta)) { el.style.backgroundImage = `url(${this.url(ruta)})`; el.style.backgroundSize = '100% 100%'; el.style.opacity = (bg.A ?? 1) * (tint.A ?? 1); }
      el.style.cursor = 'pointer'; el.style.pointerEvents = vis === 'visible' ? 'auto' : 'none';
      el.style.display = vis === 'collapsed' ? 'none' : 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
      if (!x.eventos) { x.eventos = true; this.eventosBoton(x); }
    } else if (t === 'VerticalBox' || t === 'HorizontalBox') {
      el.style.display = vis === 'collapsed' ? 'none' : 'flex'; el.style.flexDirection = t === 'VerticalBox' ? 'column' : 'row';
    } else if (t === 'UniformGridPanel') {
      el.style.display = vis === 'collapsed' ? 'none' : 'grid';
    } else if (t === 'BackgroundBlur') {
      el.style.backdropFilter = el.style.webkitBackdropFilter = `blur(${(p.BlurStrength ?? 0) * s * 0.5}px)`;
    } else if (t === 'ProgressBar') {
      const pc = p.Percent ?? 0; const fc = p.FillColorAndOpacity || { R: 1, G: 1, B: 1, A: 1 };
      el.style.background = `linear-gradient(90deg, ${css(fc)} ${pc * 100}%, rgba(0,0,0,.4) ${pc * 100}%)`;
    }
    this.layoutSlot(x);
    el.style.transform = (x.tfSlot || '') + ' ' + (x.tfBase || '') + ' ' + (x.tfAnim || '');
  }
  layoutSlot(x) {
    const sl = x.slot, el = x.dom, s = this.escala;
    x.tfSlot = '';
    if (!sl) { el.style.position = 'absolute'; el.style.inset = '0'; return; }
    const p = sl.p;
    if (sl.tipo === 'CanvasPanelSlot') {
      const ld = p.LayoutData || {}; const an = ld.Anchors || {}; const mn = an.Minimum || { X: 0, Y: 0 }, mx = an.Maximum || { X: mn.X ?? 0, Y: mn.Y ?? 0 };
      const of = { Left: 0, Top: 0, Right: 100, Bottom: 30, ...(ld.Offsets || {}) }; const al = ld.Alignment || { X: 0, Y: 0 };
      const auto = !!p.bAutoSize;
      el.style.position = 'absolute'; el.style.zIndex = p.ZOrder ?? 0;
      const ejes = [['X', 'left', 'right', 'width', 'Left', 'Right'], ['Y', 'top', 'bottom', 'height', 'Top', 'Bottom']];
      let tx = 0, ty = 0;
      for (const [k, a, b, dim, o0, o1] of ejes) {
        const a0 = mn[k] ?? 0, a1 = mx[k] ?? a0;
        el.style[b] = 'auto';
        if (Math.abs(a1 - a0) < 1e-6) {
          el.style[a] = `calc(${a0 * 100}% + ${(of[o0] || 0) * s}px)`;
          if (auto && x.deseado) el.style[dim] = (k === 'X' ? x.deseado[0] : x.deseado[1]) * s + 'px';
          else if (auto) el.style[dim] = 'auto';
          else el.style[dim] = (of[o1] ?? 0) * s + 'px';
          if (k === 'X') tx = -(al.X ?? 0) * 100; else ty = -(al.Y ?? 0) * 100;
        } else {
          el.style[a] = `calc(${a0 * 100}% + ${(of[o0] || 0) * s}px)`;
          el.style[b] = `calc(${(1 - a1) * 100}% + ${(of[o1] || 0) * s}px)`;
          el.style[dim] = 'auto';
        }
      }
      if (tx || ty) x.tfSlot = `translate(${tx}%,${ty}%)`;
    } else if (sl.tipo === 'VerticalBoxSlot' || sl.tipo === 'HorizontalBoxSlot') {
      el.style.position = 'relative'; el.style.inset = '';
      const pad = p.Padding || {}; el.style.margin = `${(pad.Top || 0) * s}px ${(pad.Right || 0) * s}px ${(pad.Bottom || 0) * s}px ${(pad.Left || 0) * s}px`;
      const tam = p.Size || {}; el.style.flex = tam.SizeRule === 'ESlateSizeRule::Fill' ? `${tam.Value ?? 1} 1 0` : '0 0 auto';
      const ha = String(p.HorizontalAlignment || 'HAlign_Fill'); el.style.alignSelf = /Center/.test(ha) ? 'center' : /Right/.test(ha) ? 'flex-end' : /Left/.test(ha) ? 'flex-start' : 'stretch';
      if (x.deseado) { el.style.width = x.deseado[0] * s + 'px'; el.style.height = x.deseado[1] * s + 'px'; }
    } else if (sl.tipo === 'ButtonSlot' || sl.tipo === 'BorderSlot' || sl.tipo === 'OverlaySlot') {
      el.style.position = 'relative'; el.style.inset = '';
      const pad = p.Padding || {}; el.style.margin = `${(pad.Top || 0) * s}px ${(pad.Right || 0) * s}px ${(pad.Bottom || 0) * s}px ${(pad.Left || 0) * s}px`;
      if (x.deseado) { el.style.width = x.deseado[0] * s + 'px'; el.style.height = x.deseado[1] * s + 'px'; }
    } else if (sl.tipo === 'UniformGridSlot') {
      el.style.position = 'relative'; el.style.inset = ''; el.style.gridRow = (p.Row || 0) + 1; el.style.gridColumn = (p.Column || 0) + 1;
    }
  }
  textoDe(t) { if (t == null) return ''; if (typeof t === 'string') return this.M.texto(t); return this.M.texto(t.SourceString ?? t.LocalizedString ?? '', t.Key); }
  eventosBoton(x) {
    const el = x.dom; const M = this.M;
    const disparar = (n) => { if (x.props.bIsEnabled === false || x.deshab) return; for (const d of (x.v[n] || []).slice()) M.vm.llamar(d.obj, d.fn, []); };
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); x.apretado = true; el.style.filter = 'brightness(1.4)'; M.audio?.iniciar?.(); disparar('OnPressed'); });
    el.addEventListener('pointerup', (e) => { e.stopPropagation(); el.style.filter = ''; if (x.apretado) { x.apretado = false; disparar('OnReleased'); disparar('OnClicked'); } });
    el.addEventListener('pointerenter', () => { x.hover = true; disparar('OnHovered'); });
    el.addEventListener('pointerleave', () => { x.hover = false; x.apretado = false; el.style.filter = ''; disparar('OnUnhovered'); });
  }
  relayout() { this.calcEscala(); for (const w of this.activos) this.reestilar(w); }
  reestilar(w) { for (const x of w.widgets.values()) this.estilo(x); }
  /* ---- viewport ---- */
  agregar(w, z = 0) {
    if (!this.raiz || this.activos.has(w)) return;
    this.calcEscala(); this.reestilar(w);
    w.dom.style.zIndex = 10 + z; this.raiz.appendChild(w.dom); this.activos.add(w); w.enPantalla = true;
    if (this.M.vm.tiene(w, 'PreConstruct')) this.M.vm.llamar(w, 'PreConstruct', [false]);
    if (this.M.vm.tiene(w, 'Construct')) this.M.vm.llamar(w, 'Construct', []);
  }
  quitar(w) {
    if (!w) return;
    if (w.padreW) { w.padreW.dom.remove(); return; }
    if (!this.activos.has(w)) return;
    w.dom.remove(); this.activos.delete(w); w.enPantalla = false;
    if (this.M.vm.tiene(w, 'Destruct')) this.M.vm.llamar(w, 'Destruct', []);
    for (const a of [...this.anims]) if (a.w === w) this.anims.delete(a);
  }
  limpiar() { for (const w of [...this.activos]) this.quitar(w); this.anims.clear(); }
  tick(dt) {
    for (const w of [...this.activos]) if (w.clase && this.M.vm.tiene(w, 'Tick')) this.M.vm.llamar(w, 'Tick', [{}, dt]);
    for (const a of [...this.anims]) {
      a.t += dt * a.vel * (a.reversa ? -1 : 1);
      let fin = false;
      if (!a.reversa && a.t >= a.fin) { if (--a.vueltas > 0 || a.vueltas < -100) a.t = a.ini; else { a.t = a.fin; fin = true; } }
      if (a.reversa && a.t <= a.ini) { if (--a.vueltas > 0 || a.vueltas < -100) a.t = a.fin; else { a.t = a.ini; fin = true; } }
      this.aplicarAnim(a);
      if (fin) { this.anims.delete(a); a.anim.tocando = false; }
    }
  }
  aplicarAnim(a) {
    const ms = a.anim.datos.ms, s = this.escala;
    for (const b of ms.bindings) {
      const bind = a.anim.datos.binds.find((x) => x.guid === b.guid);
      const x = a.w.widgets.get(bind?.w || b.n); if (!x) continue;
      for (const p of b.pistas) for (const sec of p.secs) {
        const c = sec.can; const v = (k, d) => { const x = c[k]; if (!x) return d; if (x.k?.length) return evalRich(x.k, a.t); return x.d ?? d; };
        if (p.t === '2DTransform') { x.tfAnim = `translate(${v('Translation', 0) * s}px,${v('Translation[1]', 0) * s}px) rotate(${v('Rotation', 0)}deg) scale(${v('Scale', 1)},${v('Scale[1]', 1)}) skew(${v('Shear', 0)}deg,${v('Shear[1]', 0)}deg)`; x.dom.style.transform = (x.tfSlot || '') + ' ' + (x.tfBase || '') + ' ' + x.tfAnim; }
        else if (p.t === 'Float' && /Opacity/.test(p.prop || '')) { x.dom.style.opacity = v(Object.keys(c)[0], 1); x.props.RenderOpacity = v(Object.keys(c)[0], 1); }
        else if (p.t === 'Color' || p.t === 'SlateColor' || p.t === 'Vector') {
          const col = { R: v('RedCurve', 1), G: v('GreenCurve', 1), B: v('BlueCurve', 1), A: v('AlphaCurve', 1) };
          if (/ColorAndOpacity/.test(p.prop)) { x.props.ColorAndOpacity = x.d.tipo === 'TextBlock' ? { SpecifiedColor: col } : col; this.estilo(x); }
          if (/BrushColor/.test(p.prop)) { x.props.BrushColor = col; this.estilo(x); }
        }
      }
    }
  }
}

/* ---------------- nativos UMG ---------------- */
const U = (M) => M.ui?.umg;
const widgetM = {
  SetVisibility(x, [v]) { x.props && (x.props.Visibility = v); if (x.dom) { if (x.esWidget && x.props) U(this)?.estilo(x); else if (x.dom) x.dom.style.display = visDe(v) === 'collapsed' ? 'none' : ''; } },
  GetVisibility(x) { return VIS.indexOf(visDe(x.props?.Visibility)); },
  IsVisible(x) { const v = visDe(x.props?.Visibility); return v !== 'collapsed' && v !== 'hidden' && (!x.dom || x.dom.isConnected); },
  SetRenderOpacity(x, [o]) { if (x.props) { x.props.RenderOpacity = o; U(this)?.estilo(x); } else if (x.dom) x.dom.style.opacity = o; },
  GetRenderOpacity(x) { return x.props?.RenderOpacity ?? 1; },
  SetRenderTranslation(x, [t]) { x.props.RenderTransform = { ...(x.props.RenderTransform || {}), Translation: t }; U(this)?.estilo(x); },
  SetRenderScale(x, [t]) { x.props.RenderTransform = { ...(x.props.RenderTransform || {}), Scale: t }; U(this)?.estilo(x); },
  SetRenderAngle(x, [a]) { x.props.RenderTransform = { ...(x.props.RenderTransform || {}), Angle: a }; U(this)?.estilo(x); },
  SetRenderTransform(x, [t]) { x.props.RenderTransform = t; U(this)?.estilo(x); },
  SetIsEnabled(x, [b]) { if (x.props) x.props.bIsEnabled = !!b; x.deshab = !b; if (x.dom) x.dom.style.filter = b ? '' : 'grayscale(1) brightness(.6)'; },
  GetIsEnabled(x) { return x.props?.bIsEnabled !== false; },
  RemoveFromParent(x) { U(this)?.quitar(x); },
  SetToolTipText() {}, SetCursor() {}, SetKeyboardFocus() {}, SetUserFocus() {}, ForceLayoutPrepass() {}, InvalidateLayoutAndVolatility() {},
  HasKeyboardFocus() { return false; }, IsHovered(x) { return !!x.hover; },
};
Object.assign(METODOS.Widget = METODOS.Widget || {}, widgetM);
Object.assign(METODOS.UserWidget = METODOS.UserWidget || {}, {
  AddToViewport(w, [z = 0]) { U(this)?.agregar(w, z); },
  AddToPlayerScreen(w, [z = 0]) { U(this)?.agregar(w, z); return true; },
  RemoveFromViewport(w) { U(this)?.quitar(w); },
  IsInViewport(w) { return !!w.enPantalla; },
  GetOwningPlayer(w) { return w.dueno || this.pc; },
  GetOwningPlayerPawn() { return this.pc?.peon || null; },
  PlayAnimation(w, [anim, ini = 0, vueltas = 1, modo = 0, vel = 1]) {
    if (!anim?.datos) return; const u = U(this); if (!u) return;
    const r = anim.datos.ms.rango || [0, 0]; for (const a of [...u.anims]) if (a.anim === anim) u.anims.delete(a);
    const a = { w, anim, ini: r[0], fin: r[1], t: modo === 1 ? r[1] - ini : r[0] + ini, vel, vueltas: vueltas === 0 ? -1000 : vueltas, reversa: modo === 1 };
    anim.tocando = true; u.anims.add(a); u.aplicarAnim(a);
  },
  PlayAnimationForward(w, [anim]) { METODOS.UserWidget.PlayAnimation.call(this, w, [anim, 0, 1, 0, 1]); },
  PlayAnimationReverse(w, [anim]) { METODOS.UserWidget.PlayAnimation.call(this, w, [anim, 0, 1, 1, 1]); },
  StopAnimation(w, [anim]) { const u = U(this); if (u) for (const a of [...u.anims]) if (a.anim === anim) { u.anims.delete(a); anim.tocando = false; } },
  IsAnimationPlaying(w, [anim]) { return !!anim?.tocando; },
  SetColorAndOpacity(w, [c]) { if (w.dom) w.dom.style.opacity = c?.A ?? 1; },
  SetPositionInViewport(w, [p]) { if (w.dom) { w.dom.style.inset = 'auto'; w.dom.style.left = p.X + 'px'; w.dom.style.top = p.Y + 'px'; } },
  SetDesiredSizeInViewport() {}, SetAlignmentInViewport() {}, SetAnchorsInViewport() {},
  StopAllAnimations(w) { const u = U(this); if (u) for (const a of [...u.anims]) if (a.w === w) u.anims.delete(a); },
});
Object.assign(METODOS.TextBlock = METODOS.TextBlock || {}, {
  SetText(x, [t]) { x.props.Text = typeof t === 'string' ? t : t; if (x.dom) x.dom.textContent = U(this)?.textoDe(t) ?? String(t); },
  GetText(x) { const t = x.props.Text; return typeof t === 'string' ? t : (t?.SourceString ?? ''); },
  SetColorAndOpacity(x, [c]) { x.props.ColorAndOpacity = c; U(this)?.estilo(x); },
  SetJustification(x, [j]) { x.props.Justification = ['Left', 'Center', 'Right'][j] || 'Left'; U(this)?.estilo(x); },
  SetFont(x, [f]) { x.props.Font = f; U(this)?.estilo(x); },
  SetShadowColorAndOpacity(x, [c]) { x.props.ShadowColorAndOpacity = c; U(this)?.estilo(x); },
});
Object.assign(METODOS.Image = METODOS.Image || {}, {
  SetBrushFromTexture(x, [tex, ajustar]) { x.props.Brush = { ...(x.props.Brush || {}), ResourceObject: tex ? { asset: tex.asset } : null }; U(this)?.estilo(x); },
  SetBrushFromMaterial(x, [m]) { const base = this.materiales?.texturaUI?.(m); x.props.Brush = { ...(x.props.Brush || {}), ResourceObject: base ? { asset: base } : null }; U(this)?.estilo(x); },
  SetBrush(x, [b]) { x.props.Brush = b; U(this)?.estilo(x); },
  SetColorAndOpacity(x, [c]) { x.props.ColorAndOpacity = c; U(this)?.estilo(x); },
  SetOpacity(x, [o]) { x.props.ColorAndOpacity = { ...(x.props.ColorAndOpacity || { R: 1, G: 1, B: 1, A: 1 }), A: o }; U(this)?.estilo(x); },
  GetDynamicMaterial() { return null; },
});
Object.assign(METODOS.Border = METODOS.Border || {}, {
  SetBrushColor(x, [c]) { x.props.BrushColor = c; U(this)?.estilo(x); },
  SetContentColorAndOpacity(x, [c]) { if (x.dom) x.dom.style.color = css(c); },
  SetPadding(x, [p]) { x.props.Padding = p; U(this)?.estilo(x); },
});
Object.assign(METODOS.Button = METODOS.Button || {}, {
  SetBackgroundColor(x, [c]) { x.props.BackgroundColor = c; U(this)?.estilo(x); },
  SetColorAndOpacity(x, [c]) { x.props.ColorAndOpacity = c; },
  IsPressed(x) { return !!x.apretado; },
});
Object.assign(METODOS.ProgressBar = METODOS.ProgressBar || {}, {
  SetPercent(x, [p]) { x.props.Percent = p; U(this)?.estilo(x); },
  SetFillColorAndOpacity(x, [c]) { x.props.FillColorAndOpacity = c; U(this)?.estilo(x); },
});
Object.assign(PROPS.Widget = PROPS.Widget || {}, {
  Visibility: { get: (x) => VIS.indexOf(visDe(x.props?.Visibility)), set(x, v, M) { x.props.Visibility = v; U(M)?.estilo(x); } },
  RenderOpacity: { get: (x) => x.props?.RenderOpacity ?? 1, set(x, v, M) { x.props.RenderOpacity = v; U(M)?.estilo(x); } },
  Slot: (x) => x.slotObj || (x.slotObj = { __ref: true, nat: 'PanelSlot', w: x, id: 's' + x.id }),
});
Object.assign(PROPS.TextBlock = PROPS.TextBlock || {}, {
  Text: { get: (x) => x.props.Text, set(x, v, M) { x.props.Text = v; if (x.dom) x.dom.textContent = U(M)?.textoDe(v); } },
  ColorAndOpacity: { get: (x) => x.props.ColorAndOpacity, set(x, v, M) { x.props.ColorAndOpacity = v; U(M)?.estilo(x); } },
});
Object.assign(PROPS.Image = PROPS.Image || {}, {
  Brush: { get: (x) => x.props.Brush || {}, set(x, v, M) { x.props.Brush = v; U(M)?.estilo(x); } },
  ColorAndOpacity: { get: (x) => x.props.ColorAndOpacity || { R: 1, G: 1, B: 1, A: 1 }, set(x, v, M) { x.props.ColorAndOpacity = v; U(M)?.estilo(x); } },
});
Object.assign(METODOS.PanelSlot = METODOS.PanelSlot || {}, {
  SetPosition(s, [p]) { const x = s.w; const ld = x.slot.p.LayoutData || (x.slot.p.LayoutData = {}); ld.Offsets = { ...(ld.Offsets || {}), Left: p.X, Top: p.Y }; U(this)?.estilo(x); },
  SetSize(s, [p]) { const x = s.w; const ld = x.slot.p.LayoutData || (x.slot.p.LayoutData = {}); ld.Offsets = { ...(ld.Offsets || {}), Right: p.X, Bottom: p.Y }; U(this)?.estilo(x); },
  SetZOrder(s, [z]) { s.w.dom.style.zIndex = z; },
});
/* estáticas */
import { NATIVOS } from './motor.js';
Object.assign(NATIVOS, {
  'WidgetBlueprintLibrary:Create': (T, [ctx, cl, dueno], r, F, vm) => (cl ? U(vm.mundo)?.crear(cl, dueno) ?? null : null),
  'WidgetBlueprintLibrary:SetInputMode_GameOnly': (T, a, r, F, vm) => { vm.mundo.modoEntrada = 'juego'; },
  'WidgetBlueprintLibrary:SetInputMode_UIOnly': (T, a, r, F, vm) => { vm.mundo.modoEntrada = 'ui'; },
  'WidgetBlueprintLibrary:SetInputMode_UIOnlyEx': (T, a, r, F, vm) => { vm.mundo.modoEntrada = 'ui'; },
  'WidgetBlueprintLibrary:SetInputMode_GameAndUI': (T, a, r, F, vm) => { vm.mundo.modoEntrada = 'ambos'; },
  'WidgetBlueprintLibrary:SetInputMode_GameAndUIEx': (T, a, r, F, vm) => { vm.mundo.modoEntrada = 'ambos'; },
  'WidgetBlueprintLibrary:SetBrushResourceToTexture': (T, [b, tex], refs) => { if (b) b.ResourceObject = tex ? { asset: tex.asset } : null; },
  'WidgetBlueprintLibrary:MakeBrushFromTexture': (T, [tex, w, h]) => ({ ResourceObject: tex ? { asset: tex.asset } : null, ImageSize: { X: w || 32, Y: h || 32 } }),
  'WidgetLayoutLibrary:RemoveAllWidgets': (T, a, r, F, vm) => { U(vm.mundo)?.limpiar(); },
  'WidgetLayoutLibrary:GetViewportSize': (T, a, r, F, vm) => ({ X: innerWidth, Y: innerHeight }),
  'WidgetLayoutLibrary:GetViewportScale': (T, a, r, F, vm) => U(vm.mundo)?.escala ?? 1,
  'WidgetLayoutLibrary:GetMousePositionOnViewport': (T, a, r, F, vm) => ({ X: vm.mundo.mouse?.x || 0, Y: vm.mundo.mouse?.y || 0 }),
});
Object.assign(METODOS.WidgetComponent = METODOS.WidgetComponent || {}, { GetUserWidgetObject(c) { return c.widgetInst || null; }, SetWidget(c, [w]) { c.widgetInst = w; } });
Mundo.prototype.tickWidgets = function (dt) { this.ui?.umg?.tick(dt); };
