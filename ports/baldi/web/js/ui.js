/* La interfaz de Unity (uGUI y TextMeshPro) dibujada en un canvas 2D encima del juego: Canvas con su
   CanvasScaler, RectTransform (anclas, pivote, tamaño), Image (simple, cortada en 9, rellena), RawImage,
   Text, TextMeshProUGUI (la letra de mapa de bits de Baldi, glifo por glifo), máscaras, CanvasGroup;
   Button, Toggle (con grupo), Slider, TMP_InputField; y los controles táctiles de Rewired (joystick,
   pad para girar y botones) que mandan al control "TouchControl". Las coordenadas de Unity tienen la y
   para arriba; la pantalla, para abajo. */
import * as THREE from 'three';
import { Componente, MonoBehaviour, v3, Time } from './motor.js';
import { FABRICAS, registrar } from './mundo.js';
import { url } from './archivos.js';
import { traducir } from './textos.js';

const col = (c, d = [1, 1, 1, 1]) => (c ? [c.r, c.g, c.b, c.a] : d);
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${Math.max(0, Math.min(1, c[3] * a))})`;

/* ---------- eventos de Unity (UnityEvent con llamadas guardadas) */
export class UnityEvent {
  constructor(datos, mundo) { this.calls = datos?.calls || []; this.oyentes = []; this.mundo = mundo; }
  AddListener(f) { this.oyentes.push(f); }
  RemoveAllListeners() { this.oyentes = []; }
  Invoke(arg) {
    for (const c of this.calls) {
      if (c.estado === 0 || !c.target) continue; // apagada
      const a = c.args || {};
      const v = c.modo === 0 ? arg : c.modo === 1 ? undefined : c.modo === 2 ? a.m_ObjectArgument : c.modo === 3 ? a.m_IntArgument : c.modo === 4 ? a.m_FloatArgument : c.modo === 5 ? a.m_StringArgument : c.modo === 6 ? !!a.m_BoolArgument : arg;
      let t = c.target, m = c.metodo;
      if (m.startsWith('set_')) { t[m.slice(4)] = v; continue; }
      if (typeof t[m] !== 'function') { const comp = t.comps?.find((x) => typeof x[m] === 'function'); if (comp) t = comp; }
      if (typeof t[m] === 'function') { try { t[m](v); } catch (e) { console.error('evento', m, e); } }
      else console.warn('evento sin método', m);
    }
    for (const f of this.oyentes) f(arg);
  }
}
export const evento = (d, mundo) => new UnityEvent(d, mundo);

/* ---------- Canvas, CanvasGroup, CanvasScaler */
export class Canvas extends Componente {
  static get tipos() { return ['Canvas']; }
  constructor(n, d) { super(n, d); this.sortingOrder = d.orden || 0; this.modo = d.modo; this.pixelPerfect = d.pixel; }
}
export class CanvasGroup extends Componente {
  static get tipos() { return ['CanvasGroup']; }
  constructor(n, d) { super(n, d); this.alpha = d.alfa ?? 1; this.interactable = d.inter !== false; this.blocksRaycasts = d.bloquea !== false; }
}
class CanvasScaler extends Componente {
  static get tipos() { return ['UnityEngine.UI.CanvasScaler', 'CanvasScaler']; }
  alArmar() { this.referenceResolution = { x: this.m_ReferenceResolution.x, y: this.m_ReferenceResolution.y }; }
  escala(W, H) {
    if (!this._en) return 1;
    if (this.m_UiScaleMode === 0) return this.m_ScaleFactor || 1;
    if (this.m_UiScaleMode !== 1) return H / 600;
    const rw = this.referenceResolution.x, rh = this.referenceResolution.y;
    if (this.m_ScreenMatchMode === 1) return Math.min(W / rw, H / rh);
    if (this.m_ScreenMatchMode === 2) return Math.max(W / rw, H / rh);
    const m = this.m_MatchWidthOrHeight;
    return Math.pow(2, Math.log2(W / rw) * (1 - m) + Math.log2(H / rh) * m);
  }
}
class Marca extends Componente { static get tipos() { return ['UnityEngine.UI.GraphicRaycaster', 'UnityEngine.EventSystems.EventSystem', 'UnityEngine.EventSystems.StandaloneInputModule', 'Rewired.Integration.UnityUI.RewiredStandaloneInputModule', 'MaterialKit.DpCanvasScaler', 'UnityEngine.UI.VerticalLayoutGroup', 'UnityEngine.UI.HorizontalLayoutGroup', 'UnityEngine.UI.GridLayoutGroup', 'UnityEngine.UI.LayoutElement', 'UnityEngine.UI.ContentSizeFitter', 'Rewired.ComponentControls.TouchController', 'Rewired.ComponentControls.TouchRegion']; } }

/* ---------- gráficos */
class Graphic extends Componente {
  static get tipos() { return ['Graphic']; }
  alArmar() { this.color = col(this.m_Color); this.raycastTarget = !!this.m_RaycastTarget; this._tinte = [1, 1, 1, 1]; }
  get canvasRenderer() { return { SetAlpha: (a) => { this._alfaCR = a; }, GetAlpha: () => this._alfaCR ?? 1 }; }
}
export class Image extends Graphic {
  static get tipos() { return ['UnityEngine.UI.Image', 'Image', 'Graphic', 'MaskableGraphic']; }
  alArmar() {
    super.alArmar();
    this.sprite = this.m_Sprite || null; this.type = this.m_Type || 0; this.preserveAspect = !!this.m_PreserveAspect; this.fillCenter = this.m_FillCenter !== 0;
    this.fillMethod = this.m_FillMethod ?? 4; this.fillAmount = this.m_FillAmount ?? 1; this.fillClockwise = this.m_FillClockwise !== 0; this.fillOrigin = this.m_FillOrigin || 0;
  }
  get overrideSprite() { return this._swap || this.sprite; }
}
export class RawImage extends Graphic {
  static get tipos() { return ['UnityEngine.UI.RawImage', 'RawImage', 'Graphic', 'MaskableGraphic']; }
  alArmar() { super.alArmar(); this.texture = this.m_Texture || null; const u = this.m_UVRect || { x: 0, y: 0, width: 1, height: 1 }; this.uvRect = { x: u.x, y: u.y, width: u.width, height: u.height }; }
}
export class Text extends Graphic {
  static get tipos() { return ['UnityEngine.UI.Text', 'Text', 'Graphic', 'MaskableGraphic']; }
  alArmar() {
    super.alArmar();
    const f = this.m_FontData || {};
    this.text = this.m_Text ?? ''; this.fontSize = f.m_FontSize ?? 14; this.fontStyle = f.m_FontStyle || 0; this.alignment = f.m_Alignment || 0;
    this.lineSpacing = f.m_LineSpacing ?? 1; this.horizontalOverflow = f.m_HorizontalOverflow || 0; this.verticalOverflow = f.m_VerticalOverflow || 0;
    this.resizeTextForBestFit = !!f.m_BestFit; this.resizeTextMinSize = f.m_MinSize ?? 10; this.resizeTextMaxSize = f.m_MaxSize ?? 40;
    this.font = f.m_Font?.fuente || null;
  }
}
export class TextMeshProUGUI extends Graphic {
  static get tipos() { return ['TMPro.TextMeshProUGUI', 'TextMeshProUGUI', 'TMP_Text', 'Graphic', 'MaskableGraphic']; }
  alArmar() {
    super.alArmar();
    this.text = this.m_text ?? ''; this.fontSize = this.m_fontSize ?? 36; this.fontStyle = this.m_fontStyle || 0; this.alignment = this.m_textAlignment ?? 257;
    this.color = this.m_fontColor ? col(this.m_fontColor) : this.color;
    this.characterSpacing = this.m_characterSpacing || 0; this.lineSpacing = this.m_lineSpacing || 0; this.wordSpacing = this.m_wordSpacing || 0;
    this.enableWordWrapping = this.m_enableWordWrapping !== 0; this.enableAutoSizing = !!this.m_enableAutoSizing;
    this.fontSizeMin = this.m_fontSizeMin ?? 18; this.fontSizeMax = this.m_fontSizeMax ?? 72;
    const m = this.m_margin || { x: 0, y: 0, z: 0, w: 0 }; this.margin = [m.x, m.y, m.z, m.w];
    this.fuenteTMP = this.m_fontAsset?.tmpf || null;
  }
}
class Mask extends Componente { static get tipos() { return ['UnityEngine.UI.Mask', 'Mask', 'UnityEngine.UI.RectMask2D', 'RectMask2D']; } }

/* ---------- seleccionables */
class Selectable extends Componente {
  static get tipos() { return ['Selectable']; }
  alArmar() {
    this.interactable = this.m_Interactable !== 0; this.transition = this.m_Transition ?? 1;
    this.colors = this.m_Colors; this.spriteState = this.m_SpriteState || {}; this.animationTriggers = this.m_AnimationTriggers || {};
    this.targetGraphic = this.m_TargetGraphic || null; this.estado = 'normal';
  }
  Select() { } OnSelect() { }
  ponerEstado(e) {
    if (!this.interactable) e = 'deshabilitado';
    if (e === this.estado && this._aplicado) return;
    this.estado = e; this._aplicado = true;
    const g = this.targetGraphic;
    if (this.transition === 1 && g && this.colors) {
      const c = col(e === 'resaltado' ? this.colors.m_HighlightedColor : e === 'presionado' ? this.colors.m_PressedColor : e === 'deshabilitado' ? this.colors.m_DisabledColor : this.colors.m_NormalColor);
      const k = this.colors.m_ColorMultiplier || 1; g._tinte = [c[0] * k, c[1] * k, c[2] * k, c[3] * k];
    } else if (this.transition === 2 && g instanceof Image) {
      const s = this.spriteState;
      g._swap = e === 'resaltado' ? s.m_HighlightedSprite : e === 'presionado' ? s.m_PressedSprite : e === 'deshabilitado' ? s.m_DisabledSprite : null;
    } else if (this.transition === 3) {
      const a = this.nodo.GetComponent('Animator'), t = this.animationTriggers;
      if (a) { for (const k of ['m_NormalTrigger', 'm_HighlightedTrigger', 'm_PressedTrigger', 'm_DisabledTrigger']) a.ResetTrigger(t[k]); a.SetTrigger(e === 'resaltado' ? t.m_HighlightedTrigger : e === 'presionado' ? t.m_PressedTrigger : e === 'deshabilitado' ? t.m_DisabledTrigger : t.m_NormalTrigger); }
    }
  }
  _prender() { this._aplicado = false; this.ponerEstado('normal'); }
  alEntrar() { this.ponerEstado('resaltado'); }
  alSalir() { this.ponerEstado('normal'); }
  alPresionar() { this.ponerEstado('presionado'); return true; }
  alSoltar(dentro) { this.ponerEstado(dentro && !this.nodo.mundo.ui?.tactil ? 'resaltado' : 'normal'); }
}
export class Button extends Selectable {
  static get tipos() { return ['UnityEngine.UI.Button', 'Button', 'Selectable']; }
  alArmar() { super.alArmar(); this.onClick = evento(this.m_OnClick, this.nodo.mundo); }
  alClic() { if (this.interactable) this.onClick.Invoke(); }
}
export class Toggle extends Selectable {
  static get tipos() { return ['UnityEngine.UI.Toggle', 'Toggle', 'Selectable']; }
  alArmar() { super.alArmar(); this._on = !!this.m_IsOn; this.group = this.m_Group || null; this.onValueChanged = evento(this.onValueChanged, this.nodo.mundo); this.mostrar(); }
  get isOn() { return this._on; }
  set isOn(v) {
    v = !!v; if (v === this._on) return;
    if (!v && this.group && !this.group.m_AllowSwitchOff && this.group.activos(this).length === 0) return;
    this._on = v;
    if (v && this.group) for (const t of this.group.activos(this)) t.isOn = false;
    this.mostrar(); this.onValueChanged.Invoke(v);
  }
  mostrar() { if (this.graphic) this.graphic._alfaCR = this._on ? 1 : 0; }
  alClic() { if (this.interactable) this.isOn = !this.isOn; }
}
class ToggleGroup extends Componente {
  static get tipos() { return ['UnityEngine.UI.ToggleGroup', 'ToggleGroup']; }
  activos(salvo) { return this.nodo.mundo.comps.filter((c) => c instanceof Toggle && c.group === this && c !== salvo && c._on && c.isActiveAndEnabled); }
}
export class Slider extends Selectable {
  static get tipos() { return ['UnityEngine.UI.Slider', 'Slider', 'Selectable']; }
  alArmar() {
    super.alArmar();
    this.minValue = this.m_MinValue; this.maxValue = this.m_MaxValue; this.wholeNumbers = !!this.m_WholeNumbers; this.direction = this.m_Direction || 0;
    this.fillRect = this.m_FillRect; this.handleRect = this.m_HandleRect; this._v = this.m_Value; this.onValueChanged = evento(this.m_OnValueChanged, this.nodo.mundo);
  }
  get value() { return this._v; }
  set value(v) { v = Math.max(this.minValue, Math.min(this.maxValue, v)); if (this.wholeNumbers) v = Math.round(v); if (v === this._v) return; this._v = v; this.onValueChanged.Invoke(v); }
  get normalizedValue() { return this.maxValue > this.minValue ? (this._v - this.minValue) / (this.maxValue - this.minValue) : 0; }
  set normalizedValue(t) { this.value = this.minValue + t * (this.maxValue - this.minValue); }
  maquetar() {
    const t = this.normalizedValue, inv = this.direction === 1 || this.direction === 3, vert = this.direction >= 2;
    const k = vert ? 1 : 0;
    if (this.fillRect?.ui) { const u = this.fillRect.ui; if (inv) { u.amin[k] = 1 - t; u.amax[k] = 1; } else { u.amin[k] = 0; u.amax[k] = t; } }
    if (this.handleRect?.ui) { const u = this.handleRect.ui; const p = inv ? 1 - t : t; u.amin[k] = p; u.amax[k] = p; }
  }
  alPresionar(p) { super.alPresionar(); this.alArrastrar(p); return true; }
  alArrastrar(p) {
    if (!this.interactable) return;
    const zona = (this.handleRect?.parent || this.fillRect?.parent || this.nodo), L = this.nodo.mundo.ui.local(zona, p.x, p.y), r = zona.ui?._rect;
    if (!r) return;
    const vert = this.direction >= 2, inv = this.direction === 1 || this.direction === 3;
    let t = vert ? (L.y - r.y) / r.h : (L.x - r.x) / r.w; t = Math.max(0, Math.min(1, t)); if (inv) t = 1 - t;
    this.normalizedValue = t;
  }
}
export class TMP_InputField extends Selectable {
  static get tipos() { return ['TMPro.TMP_InputField', 'TMP_InputField', 'Selectable']; }
  alArmar() {
    super.alArmar(); this.textComponent = this.m_TextComponent; this.placeholder = this.m_Placeholder; this._t = this.m_Text || '';
    this.contentType = this.m_ContentType || 0; this.characterLimit = this.m_CharacterLimit || 0;
    this.onEndEdit = evento(this.m_OnEndEdit, this.nodo.mundo); this.onValueChanged = evento(this.m_OnValueChanged, this.nodo.mundo);
    this.mostrar();
  }
  get text() { return this._t; }
  set text(v) { v = String(v ?? ''); if (v === this._t) return; this._t = v; this.mostrar(); this.onValueChanged.Invoke(v); }
  mostrar() { if (this.textComponent) this.textComponent.text = this._t; if (this.placeholder) this.placeholder.enabled = this._t.length === 0; }
  ActivateInputField() { this.nodo.mundo.ui.foco = this; }
  DeactivateInputField() { if (this.nodo.mundo.ui.foco === this) this.nodo.mundo.ui.foco = null; }
  get isFocused() { return this.nodo.mundo.ui.foco === this; }
  alClic() { this.ActivateInputField(); }
  tecla(e) {
    if (e.key === 'Backspace') { this.text = this._t.slice(0, -1); return true; }
    if (e.key.length === 1) {
      const ok = this.contentType === 2 ? /[0-9-]/.test(e.key) : this.contentType === 3 ? /[0-9.-]/.test(e.key) : true;
      if (ok && (!this.characterLimit || this._t.length < this.characterLimit)) this.text = this._t + e.key;
      return true;
    }
    return false;
  }
}

/* ---------- controles táctiles de Rewired */
class ControlTactil extends Componente {
  static get tipos() { return ['ControlTactil']; }
  alArmar() { this.interactable = this._interactable !== 0; this.visible = this._visible !== 0; this.targetGraphic = this._targetGraphic; this.colores = this._transitionColorTint; this.estado = 'normal'; this.tinte('normal'); }
  tinte(e) {
    this.estado = e;
    const g = this.targetGraphic, c = this.colores;
    if (g && this._transitionType === 1 && c) { const k = col(e === 'presionado' ? c.m_PressedColor : c.m_NormalColor); g._tinte = k; }
    if (!this.visible && g) g._oculto = true;
    for (const t of this.nodo.GetComponentsInChildren('Rewired.ComponentControls.Effects.TouchInteractableTransitioner')) t.copiar(e);
  }
  elem(e) { return e?._target?._element?._elementId ?? -1; }
}
class TouchButton extends ControlTactil {
  static get tipos() { return ['Rewired.ComponentControls.TouchButton', 'ControlTactil']; }
  alPresionar() { if (!this.interactable) return false; const id = this.elem(this._targetCustomControllerElement); if (id >= 0) this.nodo.mundo.entrada.tactil.botones.add(id); this.tinte('presionado'); return true; }
  alSoltar() { const id = this.elem(this._targetCustomControllerElement); this.nodo.mundo.entrada.tactil.botones.delete(id); this.tinte('normal'); }
  _apagar() { this.alSoltar(); }
}
class TouchJoystick extends ControlTactil {
  static get tipos() { return ['Rewired.ComponentControls.TouchJoystick', 'ControlTactil']; }
  alPresionar(p) { if (!this.interactable) return false; this.tinte('presionado'); this.alArrastrar(p); return true; }
  alArrastrar(p) {
    const U = this.nodo.mundo.ui, L = U.local(this.nodo, p.x, p.y), r = this.nodo.ui._rect;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rango = this._stickRange || 60;
    let dx = L.x - cx, dy = L.y - cy; const d = Math.hypot(dx, dy); if (d > rango) { dx *= rango / d; dy *= rango / d; }
    const T = this.nodo.mundo.entrada.tactil;
    T.ejes[this.elem(this._horizontalAxisCustomControllerElement)] = dx / rango;
    T.ejes[this.elem(this._verticalAxisCustomControllerElement)] = dy / rango;
    if (this._stickTransform?.ui) this._stickTransform.ui.pos = [dx, dy];
  }
  alSoltar() {
    const T = this.nodo.mundo.entrada.tactil;
    T.ejes[this.elem(this._horizontalAxisCustomControllerElement)] = 0; T.ejes[this.elem(this._verticalAxisCustomControllerElement)] = 0;
    if (this._stickTransform?.ui) this._stickTransform.ui.pos = [0, 0];
    this.tinte('normal');
  }
  _apagar() { this.alSoltar(); }
}
class TouchPad extends ControlTactil {
  static get tipos() { return ['Rewired.ComponentControls.TouchPad', 'ControlTactil']; }
  alPresionar(p) { if (!this.interactable) return false; this._ult = p; return true; }
  alArrastrar(p) {
    if (!this._ult) return;
    const U = this.nodo.mundo.ui, dx = p.x - this._ult.x; this._ult = p;
    const sens = this._axis2D?._xAxis?._calibration?._sensitivity ?? 1;
    // (en Baldi el giro es por cuadro: un barrido de toda la pantalla ≈ media vuelta con la sensibilidad 2)
    const id = this.elem(this._horizontalAxisCustomControllerElement);
    if (id >= 0) this.nodo.mundo.entrada.tactil.ejes[id] += (dx / Math.max(1, U.W)) * 180 * sens * (U.giroTactil || 1);
  }
  alSoltar() { this._ult = null; }
}
class Transitioner extends Componente {
  static get tipos() { return ['Rewired.ComponentControls.Effects.TouchInteractableTransitioner']; }
  alArmar() { this.copiar('normal'); }
  copiar(e) { const g = this._targetGraphic, c = this._transitionColorTint; if (!g) return; if (this._visible === 0) g._oculto = true; if (this._transitionType === 1 && c) g._tinte = col(e === 'presionado' ? c.m_PressedColor : c.m_NormalColor); }
}

/* ---------- letras de TextMeshPro (mapa de bits) y de Text (TTF) */
function partirTexto(t) { return String(t ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/​/g, ''); }

export class UI {
  constructor(lienzo, mundo) {
    this.l = lienzo; this.ctx = lienzo.getContext('2d'); this.mundo = mundo; this.W = 640; this.H = 480;
    this.punteros = new Map(); this.foco = null; this.tactil = false; this.hover = null; this.atlas = {}; this.tintes = new Map();
    this.fuentesCargadas = new Set(); this.idioma = 'en';
    const ev = (e) => ({ x: e.clientX * this.dpr, y: (this.l.clientHeight - e.clientY) * this.dpr, id: e.pointerId, tipo: e.pointerType });
    this.dpr = 1;
    lienzo.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') this.tactil = true; else this.tactil = false;
      const p = this.puntoPantalla(e);
      const h = this.tocar(p);
      if (h) { this.punteros.set(e.pointerId, { h, p }); try { lienzo.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault(); }
      this.mundo.entrada._toqueRecien = true;
    });
    lienzo.addEventListener('pointermove', (e) => {
      const p = this.puntoPantalla(e), x = this.punteros.get(e.pointerId);
      if (x) { x.p = p; x.h.alArrastrar?.(p); }
      if (e.pointerType === 'mouse' && !this.mundo.entrada.bloqueado) this.pasar(p);
    });
    const fin = (e) => {
      const x = this.punteros.get(e.pointerId); if (!x) return;
      this.punteros.delete(e.pointerId);
      const p = this.puntoPantalla(e), encima = this.tocar(p, true);
      x.h.alSoltar?.(encima === x.h);
      if (encima === x.h && e.type === 'pointerup') x.h.alClic?.();
    };
    lienzo.addEventListener('pointerup', fin); lienzo.addEventListener('pointercancel', fin);
    void ev;
  }
  puntoPantalla(e) { const r = this.l.getBoundingClientRect(), g = this.giro?.(e.clientX, e.clientY) || { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; return { x: g.x / g.w * this.W, y: (1 - g.y / g.h) * this.H }; }
  encima(cx, cy) { const r = this.l.getBoundingClientRect(); return !!this.tocar({ x: (cx - r.left) / r.width * this.W, y: (1 - (cy - r.top) / r.height) * this.H }, true); }
  tecla(e) { if (this.foco && this.foco.isActiveAndEnabled) return this.foco.tecla(e); return false; }
  nuevoComp() { }
  async cargarFuentes(C, base) {
    for (const [id, f] of Object.entries(C.fuentes)) {
      if (!f.arch || this.fuentesCargadas.has(id)) continue;
      this.fuentesCargadas.add(id);
      try { const ff = new FontFace('u' + id, `url(${url(base + 'datos/' + f.arch)})`); await ff.load(); document.fonts.add(ff); } catch (e) { console.warn('fuente', id, e?.message); }
    }
    for (const [id, f] of Object.entries(C.tmp || {})) {
      if (!f.atlas || this.atlas[id]) continue;
      const t = C.texs[f.atlas]; if (!t) continue;
      const img = new window.Image(); img.src = url(base + 'datos/' + t.arch);
      await img.decode().catch(() => {});
      const g = {}; for (const x of f.glifos) g[x[0]] = x;
      this.atlas[id] = { img, f, g };
    }
  }
  familia(fid) { const f = this.mundo.C.fuentes[fid]; if (!f) return 'Arial, "Liberation Sans", sans-serif'; return f.arch ? `"u${fid}", sans-serif` : `${f.familias.map((x) => `"${x}"`).join(',')}, "Liberation Sans", Arial, sans-serif`; }

  /* --- maquetado: RectTransform de Unity */
  raices() {
    const out = [];
    for (const c of this.mundo.comps) if (c instanceof Canvas && !c.nodo.destruido) { let p = c.nodo.parent, anidado = false; while (p) { if (p.GetComponent('Canvas')) { anidado = true; break; } p = p.parent; } if (!anidado) out.push(c); }
    return out;
  }
  maquetar(n, pr) {
    const u = n.ui;
    if (u && pr) {
      const ax0 = pr.x + u.amin[0] * pr.w, ay0 = pr.y + u.amin[1] * pr.h, ax1 = pr.x + u.amax[0] * pr.w, ay1 = pr.y + u.amax[1] * pr.h;
      const w = ax1 - ax0 + u.tam[0], h = ay1 - ay0 + u.tam[1];
      const rx = ax0 + (ax1 - ax0) * u.piv[0], ry = ay0 + (ay1 - ay0) * u.piv[1];
      u._ref = [rx, ry];
      const lx = rx + u.pos[0], ly = ry + u.pos[1];
      if (n.lp.x !== lx || n.lp.y !== ly) { n.lp.x = lx; n.lp.y = ly; n._ensuciar(); }
      u._rect = { x: -w * u.piv[0], y: -h * u.piv[1], w, h };
    }
    for (const c of n.comps) if (c instanceof Slider) c.maquetar();
    const r = u?._rect || pr;
    for (const h of n.children) if (h._activoH) this.maquetar(h, r);
  }
  // punto de pantalla → coordenadas locales de un nodo
  local(n, x, y) { const p = v3(x, y, 0).applyMatrix4(new THREE.Matrix4().copy(n.matrizMundo).invert()); return { x: p.x, y: p.y }; }
  /* --- un cuadro */
  dibujar(W, H) {
    this.W = W; this.H = H;
    if (this.l.width !== W || this.l.height !== H) { this.l.width = W; this.l.height = H; }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const lista = this.raices().filter((c) => c.isActiveAndEnabled).sort((a, b) => a.sortingOrder - b.sortingOrder);
    this.orden = [];
    for (const cv of lista) {
      const n = cv.nodo, sc = n.GetComponent('CanvasScaler'), k = sc ? sc.escala(W, H) : 1;
      if (n.ui) { n.ui._rect = { x: -W / k / 2, y: -H / k / 2, w: W / k, h: H / k }; }
      n.lp.set(W / 2, H / 2, 0); n.ls.set(k, k, k); n.lr.identity(); n._ensuciar();
      for (const h of n.children) if (h._activoH) this.maquetar(h, n.ui._rect);
      this.pintar(n, 1, cv);
    }
  }
  pintar(n, alfa, cv) {
    if (!n._activoH) return;
    const g = n.GetComponent('CanvasGroup'); if (g?.isActiveAndEnabled) alfa *= g.alpha;
    const sub = n.GetComponent('Canvas'); if (sub && sub !== cv && !sub.isActiveAndEnabled) return;
    const ctx = this.ctx, r = n.ui?._rect;
    const mascara = r && n.comps.find((c) => c instanceof Mask && c.isActiveAndEnabled);
    if (r) {
      const M = n.matrizMundo.elements;
      // de local (y arriba) a la pantalla (y abajo)
      ctx.setTransform(M[0], -M[1], -M[4], M[5], M[12], this.H - M[13]);
      for (const c of n.comps) if (c instanceof Graphic && c.isActiveAndEnabled) { this.orden.push({ c, n, alfa, cv }); this.grafico(c, r, alfa); }
    }
    if (mascara) {
      ctx.save();
      const M = n.matrizMundo.elements; ctx.setTransform(M[0], -M[1], -M[4], M[5], M[12], this.H - M[13]);
      ctx.beginPath(); ctx.rect(r.x, -r.y - r.h, r.w, r.h); ctx.clip();
      for (const h of n.children) this.pintar(h, alfa, cv);
      ctx.restore();
    } else for (const h of n.children) this.pintar(h, alfa, cv);
  }
  colorDe(c, alfa) { const t = c._tinte || [1, 1, 1, 1]; return [c.color[0] * t[0], c.color[1] * t[1], c.color[2] * t[2], c.color[3] * t[3] * alfa * (c._alfaCR ?? 1)]; }
  imagen(tex) { const i = tex?.image; return i && (i.complete === undefined || i.complete) && i.width ? i : null; }
  // imagen teñida (cacheada) cuando el color no es blanco
  // (mascara: la imagen solo aporta el alfa, como el atlas de las letras de TextMeshPro)
  tenida(img, sx, sy, sw, sh, c, mascara = false) {
    if (!mascara && c[0] > 0.99 && c[1] > 0.99 && c[2] > 0.99) return { img, sx, sy, sw, sh };
    const k = `${img.src}|${sx},${sy},${sw},${sh}|${c.slice(0, 3).map((x) => Math.round(x * 50)).join(',')}|${mascara}`;
    let cv = this.tintes.get(k);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw)); cv.height = Math.max(1, Math.round(sh));
      const x = cv.getContext('2d'); x.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      if (mascara) { x.globalCompositeOperation = 'source-in'; x.fillStyle = css([c[0], c[1], c[2], 1]); x.fillRect(0, 0, cv.width, cv.height); }
      else { x.globalCompositeOperation = 'multiply'; x.fillStyle = css([c[0], c[1], c[2], 1]); x.fillRect(0, 0, cv.width, cv.height); }
      x.globalCompositeOperation = 'destination-in'; x.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      if (this.tintes.size > 300) this.tintes.clear();
      this.tintes.set(k, cv);
    }
    return { img: cv, sx: 0, sy: 0, sw: cv.width, sh: cv.height };
  }
  grafico(c, r, alfa) {
    if (c._oculto) return;
    const ctx = this.ctx, k = this.colorDe(c, alfa);
    if (k[3] <= 0.003) return;
    // rectángulo en coordenadas de dibujo (y abajo): x, -y-h
    const X = r.x, Y = -r.y - r.h, Wd = r.w, Hd = r.h;
    if (c instanceof Image) {
      const s = c.overrideSprite;
      ctx.globalAlpha = Math.min(1, k[3]);
      if (!s) { ctx.fillStyle = css([k[0], k[1], k[2], 1]); ctx.fillRect(X, Y, Wd, Hd); ctx.globalAlpha = 1; return; }
      const img = this.imagen(s.texture); if (!img) { ctx.globalAlpha = 1; return; }
      const fx = img.width / s.texture.userData.w, fy = img.height / s.texture.userData.h;
      let [sx, sy, sw, sh] = s.rect; sy = s.texture.userData.h - sy - sh; sx *= fx; sy *= fy; sw *= fx; sh *= fy;
      const t = this.tenida(img, sx, sy, sw, sh, k);
      if (c.type === 1 && s.border && s.border.some((b) => b > 0)) this.nueve(t, s, X, Y, Wd, Hd, fx, fy);
      else if (c.type === 3) this.relleno(c, t, X, Y, Wd, Hd);
      else if (c.preserveAspect) { const a = sw / sh, ra = Wd / Hd; let w = Wd, h = Hd; if (a > ra) h = Wd / a; else w = Hd * a; ctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh, X + (Wd - w) / 2, Y + (Hd - h) / 2, w, h); }
      else ctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh, X, Y, Wd, Hd);
      ctx.globalAlpha = 1;
    } else if (c instanceof RawImage) {
      if (!c.texture) { ctx.fillStyle = css(k); ctx.fillRect(X, Y, Wd, Hd); return; } // sin textura: blanco teñido
      const img = this.imagen(c.texture); if (!img) return;
      const u = c.uvRect, iw = img.width, ih = img.height;
      const t = this.tenida(img, u.x * iw, (1 - u.y - u.height) * ih, u.width * iw, u.height * ih, k);
      ctx.globalAlpha = Math.min(1, k[3]); ctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh, X, Y, Wd, Hd); ctx.globalAlpha = 1;
    } else if (c instanceof TextMeshProUGUI) this.textoTMP(c, r, k);
    else if (c instanceof Text) this.textoUI(c, r, k);
  }
  nueve(t, s, X, Y, W, H, fx, fy) {
    const ctx = this.ctx, [bl, bb, br, bt] = s.border, ppu = s.ppu / 100;
    const L = bl / ppu, R = br / ppu, T = bt / ppu, B = bb / ppu;
    const sL = bl * fx, sR = br * fx, sT = bt * fy, sB = bb * fy;
    const xs = [X, X + L, X + W - R, X + W], ys = [Y, Y + T, Y + H - B, Y + H];
    const sxs = [t.sx, t.sx + sL, t.sx + t.sw - sR, t.sx + t.sw], sys = [t.sy, t.sy + sT, t.sy + t.sh - sB, t.sy + t.sh];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const w = xs[i + 1] - xs[i], h = ys[j + 1] - ys[j], sw = sxs[i + 1] - sxs[i], sh = sys[j + 1] - sys[j];
      if (w > 0 && h > 0 && sw > 0 && sh > 0) ctx.drawImage(t.img, sxs[i], sys[j], sw, sh, xs[i], ys[j], w, h);
    }
  }
  relleno(c, t, X, Y, W, H) {
    const ctx = this.ctx, a = Math.max(0, Math.min(1, c.fillAmount));
    if (a <= 0) return;
    if (c.fillMethod === 0) { const w = W * a, o = c.fillOrigin === 1 ? W - w : 0; ctx.drawImage(t.img, t.sx + t.sw * o / W, t.sy, t.sw * a, t.sh, X + o, Y, w, H); return; }
    if (c.fillMethod === 1) { const h = H * a, o = c.fillOrigin === 1 ? 0 : H - h; ctx.drawImage(t.img, t.sx, t.sy + t.sh * o / H, t.sw, t.sh * a, X, Y + o, W, h); return; }
    ctx.save(); ctx.beginPath();
    const cx = X + W / 2, cy = Y + H / 2, R = Math.hypot(W, H);
    const ini = -Math.PI / 2 + [0, Math.PI / 2, Math.PI, -Math.PI / 2][c.fillOrigin % 4] * 1, fin = ini + (c.fillClockwise ? 1 : -1) * a * 2 * Math.PI;
    ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, ini, fin, !c.fillClockwise); ctx.closePath(); ctx.clip();
    ctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh, X, Y, W, H); ctx.restore();
  }
  /* --- Text de uGUI */
  textoUI(c, r, k) {
    const ctx = this.ctx, txt = partirTexto(traducir(c.text, this.idioma));
    if (!txt) return;
    let tam = c.fontSize;
    const estilo = (t) => `${c.fontStyle === 2 || c.fontStyle === 3 ? 'italic ' : ''}${c.fontStyle === 1 || c.fontStyle === 3 ? 'bold ' : ''}${t}px ${this.familia(c.font)}`;
    const lineas = (t) => {
      ctx.font = estilo(t);
      const out = [];
      for (const par of txt.split('\n')) {
        if (c.horizontalOverflow === 1) { out.push(par); continue; }
        let linea = '';
        for (const pal of par.split(' ')) { const prueba = linea ? linea + ' ' + pal : pal; if (ctx.measureText(prueba).width > r.w && linea) { out.push(linea); linea = pal; } else linea = prueba; }
        out.push(linea);
      }
      return out;
    };
    let ls = lineas(tam);
    if (c.resizeTextForBestFit) {
      tam = c.resizeTextMaxSize;
      while (tam > c.resizeTextMinSize) { ls = lineas(tam); const alto = ls.length * tam * 1.15 * c.lineSpacing; if (alto <= r.h && ls.every((l) => ctx.measureText(l).width <= r.w + 0.5)) break; tam--; }
      ls = lineas(tam);
    }
    ctx.font = estilo(tam); ctx.fillStyle = css(k); ctx.textBaseline = 'alphabetic';
    const al = c.alignment, h = al % 3, v = Math.floor(al / 3), lh = tam * 1.15 * c.lineSpacing, total = ls.length * lh;
    const Y0 = -r.y - r.h, y0 = v === 0 ? Y0 : v === 1 ? Y0 + (r.h - total) / 2 : Y0 + r.h - total;
    ctx.textAlign = h === 0 ? 'left' : h === 1 ? 'center' : 'right';
    const x = h === 0 ? r.x : h === 1 ? r.x + r.w / 2 : r.x + r.w;
    ls.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh + tam * 0.9));
  }
  /* --- TextMeshPro con el atlas de la letra (Comic de Baldi) */
  textoTMP(c, r, k) {
    const txt = partirTexto(traducir(c.text, this.idioma));
    if (!txt) return;
    const A = this.atlas[c.fuenteTMP];
    if (!A) { this.textoTMPsimple(c, r, k, txt); return; }
    const f = A.f, ctx = this.ctx;
    const X0 = r.x + c.margin[0], Xw = r.w - c.margin[0] - c.margin[2], Y0 = -r.y - r.h + c.margin[1], Yh = r.h - c.margin[1] - c.margin[3];
    const medir = (tam) => {
      const e = tam / f.pt, esp = c.characterSpacing * e, lineas = [];
      for (const par of txt.split('\n')) {
        let linea = [], ancho = 0, ultEsp = -1;
        for (const ch of par) {
          const gl = this.glifo(A, ch), av = (gl ? gl.adv : f.pt * 0.5) * e + esp;
          if (c.enableWordWrapping && ancho + av > Xw + 0.5 && linea.length && ch !== ' ') {
            if (ultEsp >= 0) { const resto = linea.slice(ultEsp + 1); lineas.push(linea.slice(0, ultEsp)); linea = resto; ancho = resto.reduce((a, x) => a + x.av, 0); }
            else { lineas.push(linea); linea = []; ancho = 0; }
            ultEsp = -1;
          }
          if (ch === ' ') ultEsp = linea.length;
          linea.push({ ch, gl, av }); ancho += av;
        }
        lineas.push(linea);
      }
      return { e, lineas, alto: lineas.length * (f.linea * e + c.lineSpacing * e) };
    };
    let tam = c.fontSize, m = medir(tam);
    if (c.enableAutoSizing) { tam = c.fontSizeMax; m = medir(tam); while (tam > c.fontSizeMin && (m.alto > Yh || m.lineas.some((l) => l.reduce((a, x) => a + x.av, 0) > Xw + 0.5))) { tam -= 1; m = medir(tam); } }
    const { e, lineas } = m, lh = f.linea * e + c.lineSpacing * e;
    const ha = c.alignment & 0xff, va = c.alignment & 0xff00;
    const total = lineas.length * lh;
    let y = va === 256 ? Y0 : va === 1024 ? Y0 + Yh - total : Y0 + (Yh - total) / 2;
    const t = this.tenida(A.img, 0, 0, A.img.width, A.img.height, k, true);
    const fx = t.sw / f.aw, fy = t.sh / f.ah;
    ctx.globalAlpha = Math.min(1, k[3]);
    for (const l of lineas) {
      while (l.length && l[l.length - 1].ch === ' ') l.pop();
      const ancho = l.reduce((a, x) => a + x.av, 0);
      let x = ha === 2 ? X0 + (Xw - ancho) / 2 : ha === 4 ? X0 + Xw - ancho : X0;
      const base = y + f.asc * e;
      for (const g of l) {
        if (g.gl && g.ch !== ' ') this.dibujarGlifo(t, g.gl, x, base, e, fx, fy);
        x += g.av;
      }
      if (c.fontStyle & 4) { ctx.fillStyle = css([k[0], k[1], k[2], 1]); ctx.fillRect(X0 + (ha === 2 ? (Xw - ancho) / 2 : ha === 4 ? Xw - ancho : 0), base - f.subrayado * e, ancho, Math.max(1, f.subgrosor * e)); }
      y += lh;
    }
    ctx.globalAlpha = 1;
  }
  // glifo; los que la letra no tiene (acentos, ñ, ¿, ¡) se arman con piezas que sí tiene
  glifo(A, ch) {
    const g = A.g[ch.codePointAt(0)];
    if (g) return { partes: [{ g, dx: 0, dy: 0, esc: 1 }], adv: g[7] };
    const base = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N', ã: 'a', õ: 'o', Ã: 'A', Õ: 'O', â: 'a', ê: 'e', ô: 'o', Â: 'A', Ê: 'E', Ô: 'O', ç: 'c', Ç: 'C', à: 'a', À: 'A', ü: 'u', Ü: 'U' }[ch];
    if (base) {
      const b = A.g[base.codePointAt(0)]; if (!b) return null;
      const marca = /[áéíóúÁÉÍÓÚ]/.test(ch) ? "'" : /[ñÑãõÃÕ]/.test(ch) ? '~' : /[âêôÂÊÔ]/.test(ch) ? '^' : /[àÀ]/.test(ch) ? '`' : /[üÜ]/.test(ch) ? '"' : ',';
      const m = A.g[marca.codePointAt(0)];
      const mayus = ch !== ch.toLowerCase();
      const partes = [{ g: b, dx: 0, dy: 0, esc: 1 }];
      if (m) partes.push(marca === ',' ? { g: m, dx: (b[7] - m[7]) / 2, dy: 2, esc: 1 } : { g: m, dx: (b[7] - m[7] * 0.8) / 2, dy: -(mayus ? b[6] - m[6] + 6 : b[6] - m[6] + 4), esc: 0.8 });
      return { partes, adv: b[7] };
    }
    if (ch === '¿' || ch === '¡') { const b = A.g[(ch === '¿' ? '?' : '!').codePointAt(0)]; return b ? { partes: [{ g: b, dx: 0, dy: 0, esc: 1, vuelta: true }], adv: b[7] } : null; }
    return null;
  }
  dibujarGlifo(t, gl, x, base, e, fx, fy) {
    const ctx = this.ctx;
    for (const p of gl.partes) {
      const [, gx, gy, gw, gh, xo, yo] = p.g;
      const w = gw * e * p.esc, h = gh * e * p.esc, X = x + (xo + p.dx) * e, Y = base - (yo - p.dy) * e;
      if (p.vuelta) { ctx.save(); ctx.translate(X + w / 2, Y + h / 2 + (gh * 0.15) * e); ctx.scale(-1, -1); ctx.drawImage(t.img, t.sx + gx * fx, t.sy + gy * fy, gw * fx, gh * fy, -w / 2, -h / 2, w, h); ctx.restore(); }
      else ctx.drawImage(t.img, t.sx + gx * fx, t.sy + gy * fy, gw * fx, gh * fy, X, Y, w, h);
    }
  }
  textoTMPsimple(c, r, k, txt) { // letra SDF: una parecida del sistema
    const ctx = this.ctx, tam = c.fontSize;
    ctx.font = `${c.fontStyle & 1 ? 'bold ' : ''}${tam}px "Liberation Sans", Arial, sans-serif`; ctx.fillStyle = css(k);
    const ls = txt.split('\n'), lh = tam * 1.15, ha = c.alignment & 0xff, va = c.alignment & 0xff00, total = ls.length * lh;
    const Y0 = -r.y - r.h, y0 = va === 256 ? Y0 : va === 1024 ? Y0 + r.h - total : Y0 + (r.h - total) / 2;
    ctx.textAlign = ha === 2 ? 'center' : ha === 4 ? 'right' : 'left';
    const x = ha === 2 ? r.x + r.w / 2 : ha === 4 ? r.x + r.w : r.x;
    ls.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh + tam * 0.85));
  }

  /* --- entrada: el gráfico de más arriba que recibe rayos, y quién atiende en sus padres */
  tocar(p, soloMirar = false) {
    const lista = this.orden || [];
    for (let i = lista.length - 1; i >= 0; i--) {
      const { c, n } = lista[i];
      if (!c.raycastTarget || !c.isActiveAndEnabled || n.destruido) continue;
      if (!n.GetComponentInParent('UnityEngine.UI.GraphicRaycaster')) continue;
      let bloquea = true, x = n; while (x) { const g = x.GetComponent('CanvasGroup'); if (g?.isActiveAndEnabled && !g.blocksRaycasts) { bloquea = false; break; } x = x.parent; }
      if (!bloquea) continue;
      const L = this.local(n, p.x, p.y), r = n.ui._rect;
      if (L.x < r.x || L.x > r.x + r.w || L.y < r.y || L.y > r.y + r.h) continue;
      // si una máscara de un padre la corta, no cuenta
      let fuera = false; x = n.parent; while (x && !fuera) { if (x.ui?._rect && x.comps.some((m) => m instanceof Mask && m.isActiveAndEnabled)) { const q = this.local(x, p.x, p.y), rr = x.ui._rect; if (q.x < rr.x || q.x > rr.x + rr.w || q.y < rr.y || q.y > rr.y + rr.h) fuera = true; } x = x.parent; }
      if (fuera) continue;
      x = n;
      while (x) {
        const h = x.comps.find((m) => m.isActiveAndEnabled && (m.alPresionar || m.alClic) && !(m instanceof Selectable && !this.interactuable(m)));
        if (h) { if (soloMirar) return h; return h.alPresionar ? (h.alPresionar(p) !== false ? h : null) : h; }
        x = x.parent;
      }
      return null; // lo tapó un gráfico sin nadie que atienda
    }
    return null;
  }
  interactuable(s) { if (!s.interactable) return false; let x = s.nodo; while (x) { const g = x.GetComponent('CanvasGroup'); if (g?.isActiveAndEnabled && !g.interactable) return false; x = x.parent; } return true; }
  pasar(p) {
    const h = this.tocar(p, true);
    if (h !== this.hover) {
      if (this.hover) { this.hover.alSalir?.(); this.avisarGuiones(this.hover.nodo, 'OnPointerExit'); }
      this.hover = h;
      if (h) { h.alEntrar?.(); this.avisarGuiones(h.nodo, 'OnPointerEnter'); }
    }
  }
  avisarGuiones(n, m) { for (const c of n.comps) if (c instanceof MonoBehaviour && c.isActiveAndEnabled && typeof c[m] === 'function') this.mundo.llamar(c, m, {}); }
  finCuadro() { if (this.hover && (!this.hover.isActiveAndEnabled || this.hover.nodo.destruido)) this.hover = null; void Time; }
}

registrar(CanvasScaler, Marca, Image, RawImage, Text, TextMeshProUGUI, Mask, Button, Toggle, ToggleGroup, Slider, TMP_InputField, TouchButton, TouchJoystick, TouchPad, Transitioner);
FABRICAS.lienzo = (n, d) => [new Canvas(n, d)];
FABRICAS.grupo = (n, d) => [new CanvasGroup(n, d)];
