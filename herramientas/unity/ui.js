// Pantallas de Unity UI en HTML: el árbol de ui.py (RectTransform y componentes) con el mismo
// layout que Unity (anclas, pivote, CanvasScaler, layout groups) y lo que se ve de Image, RawImage,
// Text, Outline/Shadow, CanvasGroup y máscaras. Lo que hace cada script del juego lo pone la página:
// cada nodo trae sus componentes (clase y campos) y se lo busca por nombre o por id.
//
//   const ui = new UI(contenedor, base, sprites, textos, 'es');
//   const p = ui.armar(arbol);          // {el, nodo(nombre), porId(id), ...}
//   ui.layout();                        // también en cada resize

const ALINEA_H = ['left', 'center', 'right'];
const ALINEA_V = ['flex-start', 'center', 'flex-end'];

function comp(n, c) { return n.c ? n.c.find((x) => x.c === c) : undefined; }

export class UI {
  constructor(contenedor, base, sprites, textos, idioma = 'es') {
    this.cont = contenedor;
    this.base = base;              // .../ui/
    this.sprites = sprites;        // sprites.json
    this.textos = textos;          // textos.json: clave → {es, en}
    this.idioma = idioma;
    this.pantallas = [];
    this.tintes = new Map();
    // RawImage/Image con un material propio del juego: nombre del material → (n, c, capa, ui) => dibujo.
    // La página registra acá lo que hacía el shader (p. ej. un canvas 2D con la misma cuenta).
    this.materiales = {};
    this.medidor = document.createElement('span');
    this.medidor.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0';
    document.body.appendChild(this.medidor);
  }

  texto(clave) {
    const t = this.textos && this.textos[clave];
    return t ? (t[this.idioma] ?? t.en ?? clave) : null;
  }

  url(sprite) { return `${this.base}sprites/${encodeURIComponent(sprite)}.webp`; }

  // Un sprite teñido (Unity multiplica el color de la imagen por el del componente).
  tenido(sprite, col) {
    const clave = sprite + '|' + col.join(',');
    let p = this.tintes.get(clave);
    if (!p) {
      p = new Promise((ok) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
          for (let i = 0; i < a.length; i += 4) {
            a[i] *= col[0]; a[i + 1] *= col[1]; a[i + 2] *= col[2];
          }
          x.putImageData(d, 0, 0);
          ok(c.toDataURL());
        };
        img.src = this.url(sprite);
      });
      this.tintes.set(clave, p);
    }
    return p;
  }

  // ---------------------------------------------------------------- armar
  armar(arbol, { capa = 0 } = {}) {
    const raices = Array.isArray(arbol) ? arbol : [arbol];
    const p = { raices: [], porId: new Map(), porNombre: new Map(), ui: this };
    for (const r of raices) {
      const el = this.nodo(r, p, null);
      el.style.zIndex = String(capa);
      this.cont.appendChild(el);
      p.raices.push(r);
    }
    p.nodo = (nombre) => p.porNombre.get(nombre);
    p.mostrar = (nombre, si) => { const n = p.porNombre.get(nombre); if (n) this.activo(n, si); };
    this.pantallas.push(p);
    this.layout();
    // los Animator de la pantalla (después del layout: leen los valores que tienen los nodos)
    for (const n of p.porId.values()) {
      n.pantalla = p;
      const c = this.animadores && n.c && n.c.find((x) => x.c === 'Animator');
      if (c && c.ctl) {
        n.animador = this.animadores.crear(n, c.ctl);
        if (n.animador && c.off) n.animador.enabled = false;
      }
      if (n.boton) this.tocable(n);
    }
    for (const r of p.raices) this.receptores(r);
    for (const n of p.porId.values()) {
      if (!n.zonaTactil || n.zonaTactil.off) continue;
      let b = n.padre;
      while (b && !b.boton) b = b.padre;
      if (b) n.el.style.pointerEvents = 'auto';    // fuera de un botón, el toque pasa a la escena 3D
    }
    return p;
  }

  // GameObject.SetActive
  activo(n, si) {
    n.off = si ? 0 : 1;
    n.el.style.display = si ? '' : 'none';
    if (si && n.pw !== undefined) this.relayout(n);
  }

  // Cada cuadro: los Animator y lo que quedó por acomodar.
  cuadro(dt) {
    if (this.animadores) this.animadores.cuadro(dt);
    this.acomodar();
  }

  nodo(n, p, padre) {
    const el = document.createElement('div');
    el.className = 'u';
    el.dataset.n = n.n;
    n.el = el;
    n.padre = padre;
    p.porId.set(n.id, n);
    if (!p.porNombre.has(n.n)) p.porNombre.set(n.n, n);
    if (n.off) el.style.display = 'none';
    for (const c of n.c || []) this.componente(n, c, el);
    for (const h of n.h || []) el.appendChild(this.nodo(h, p, n));
    return el;
  }

  componente(n, c, el) {
    switch (c.c) {
      case 'Image': case 'AtlasImage': case 'RichImage': case 'O7Image': this.imagen(n, c, el); break;
      case 'RawImage': this.raw(n, c, el); break;
      case 'Text': case 'RichText': case 'TextWrapper': this.textoUI(n, c, el); break;
      case 'Localizer': n.loc = c; break;
      case 'Outline': case 'Shadow': (n.efectos ||= []).push(c); break;
      case 'CanvasGroup': n.grupo = c; this.alfaGrupo(n, c.alfa); break;
      case 'Mask': case 'RectMask2D': el.style.overflow = 'hidden'; break;
      case 'Canvas': n.canvas = c; if (c.propio) el.style.zIndex = String(c.orden); break;
      case 'CanvasScaler': n.escalador = c; break;
      case 'HorizontalLayoutGroup': case 'VerticalLayoutGroup': case 'GridLayoutGroup': n.grupoLayout = c; break;
      case 'ContentSizeFitter': n.ajuste = c; break;
      case 'LayoutElement': n.elemLayout = c; break;
      case 'AspectRatioFitter': case 'O7AspectRatioFitter': n.aspecto = c; break;
      case 'TouchRectTransform': n.zonaTactil = c; break;
      default:
        // un Selectable (Button, GameActionButton, Toggle…): transición al tocar y clic
        if (c.m_Transition !== undefined && c.m_AnimationTriggers && !n.boton) n.boton = c;
        break;
    }
  }

  // Lo que hace un Selectable de Unity al tocarlo: la transición (1 tinte, 2 sprite, 3 Animator) y el
  // clic (n.alClic, o this.alClic(n) para todos).
  tocable(n) {
    const b = n.boton, el = n.el;
    el.style.touchAction = 'manipulation';
    let abajo = false;
    const estado = (cual) => {
      if (b.off || b.m_Interactable === 0) return;
      const tr = b.m_Transition | 0;
      if (tr === 3 && n.animador) {
        const t = b.m_AnimationTriggers;
        n.animador.disparar(cual === 'pressed' ? t.m_PressedTrigger : t.m_NormalTrigger);
      } else if (tr === 1) {
        const objetivo = b.m_TargetGraphic && b.m_TargetGraphic.go !== undefined ? n.pantalla.porId.get(b.m_TargetGraphic.go) : n;
        const g = objetivo && (objetivo.g || objetivo.span);
        const c = cual === 'pressed' ? b.m_Colors.m_PressedColor : b.m_Colors.m_NormalColor;
        if (g) {
          g.style.transition = `filter ${b.m_Colors.m_FadeDuration || 0.1}s`;
          g.style.filter = c.r < 0.999 ? `brightness(${c.r * (b.m_Colors.m_ColorMultiplier || 1)})` : '';
        }
      }
    };
    el.addEventListener('pointerdown', (e) => { abajo = true; estado('pressed'); e.stopPropagation(); });
    const soltar = (e, clic) => {
      if (!abajo) return;
      abajo = false;
      estado('normal');
      if (clic && !(b.off || b.m_Interactable === 0)) {
        if (n.alClic) n.alClic(n, e);
        if (this.alClic) this.alClic(n, e);
      }
    };
    el.addEventListener('pointerup', (e) => soltar(e, true));
    el.addEventListener('pointercancel', (e) => soltar(e, false));
    el.addEventListener('pointerleave', (e) => soltar(e, false));
  }

  // Lo que dibuja el componente gráfico del nodo va en una capa propia debajo de los hijos (como en
  // Unity, el padre se dibuja antes): así el alfa del color no apaga a los hijos.
  capa(n) {
    if (!n.g) {
      n.g = document.createElement('div');
      n.g.className = 'ug';
      n.el.insertBefore(n.g, n.el.firstChild);
    }
    n.g.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
    return n.g;
  }

  imagen(n, c) {
    n.img = c;
    if (c.off) return;
    this.pintarImagen(n);
  }

  pintarImagen(n) {
    const c = n.img, g = this.capa(n);
    const token = (n.tokenImg = (n.tokenImg || 0) + 1);
    const s = c.m_Sprite && c.m_Sprite.sprite;
    const col = c.m_Color ? [c.m_Color.r, c.m_Color.g, c.m_Color.b, c.m_Color.a] : [1, 1, 1, 1];
    this.ponerReceptor(n, g, c);
    const mat = this.nombreMaterial(c);
    if (mat && this.materiales[mat]) { n.dibujo = this.materiales[mat](n, c, g, this); return; }
    if (!s) {
      // sin sprite: un rectángulo del color (Unity dibuja blanco teñido)
      if (col[3] > 0 && c.c !== 'AtlasImage') g.style.background = `rgba(${col[0] * 255},${col[1] * 255},${col[2] * 255},${col[3]})`;
      return;
    }
    const info = this.sprites[s] || { b: [0, 0, 0, 0], ppu: 100 };
    const blanco = col[0] > 0.99 && col[1] > 0.99 && col[2] > 0.99;
    const poner = (url) => {
      if (n.tokenImg !== token) return;      // ya le pusieron otro sprite o color
      const tipo = c.m_Type | 0;
      const b = info.b;
      if (tipo === 1 && (b[0] || b[1] || b[2] || b[3])) {
        // 9-slice: el borde en unidades de la pantalla (ppu de referencia 100 / ppu del sprite)
        const k = (100 / (info.ppu || 100)) / (c.m_PixelsPerUnitMultiplier || 1);
        g.style.borderStyle = 'solid';
        g.style.borderImageSource = `url("${url}")`;
        g.style.borderImageSlice = `${b[3]} ${b[2]} ${b[1]} ${b[0]}${c.m_FillCenter === 0 ? '' : ' fill'}`;
        g.style.borderImageWidth = `${b[3] * k}px ${b[2] * k}px ${b[1] * k}px ${b[0] * k}px`;
        g.style.borderWidth = '0';
        g.style.boxSizing = 'border-box';
      } else {
        g.style.backgroundImage = `url("${url}")`;
        g.style.backgroundRepeat = tipo === 2 ? 'repeat' : 'no-repeat';
        g.style.backgroundSize = tipo === 2 ? `${info.w * 100 / (info.ppu || 100)}px auto` : c.m_PreserveAspect ? 'contain' : '100% 100%';
        g.style.backgroundPosition = 'center';
      }
      if (tipo === 3) this.relleno(n, c.m_FillAmount);
    };
    if (blanco) poner(this.url(s));
    else this.tenido(s, col).then(poner);
    if (col[3] < 1) g.style.opacity = String(col[3]);
  }

  // ¿Este gráfico recibe toques? (Graphic con raycastTarget, encendido, sin un CanvasGroup que bloquee)
  receptor(n, c) {
    if (!c || c.off || c.m_RaycastTarget === 0) return false;
    for (let p = n; p; p = p.padre) {
      if (p.grupo && !p.grupo.bloquea) return false;
      if (p.grupo && p.grupo.ignora) break;
    }
    return true;
  }

  // Los toques: cada gráfico que recibe deja pasar el evento hacia arriba (al botón que lo contiene).
  ponerReceptor(n, el, c) { el.style.pointerEvents = this.receptor(n, c) ? 'auto' : 'none'; }

  nombreMaterial(c) {
    const m = c.m_Material && c.m_Material.mat;
    return m ? m.replace(/\s*\((Clone|Instance)\)/g, '') : null;
  }

  // Lo que hacen los scripts del juego con un Image: cambiar el sprite (AtlasImage.SpriteName), el
  // color (Graphic.color) o ajustar el tamaño al del sprite (SetNativeSize).
  cambiarSprite(n, sprite, { nativo = false } = {}) {
    if (!n.img) return;
    n.img.m_Sprite = sprite ? { sprite } : null;
    this.pintarImagen(n);
    if (nativo) this.tamanoNativo(n);
  }

  ponerColor(n, col) {
    if (n.img) {
      n.img.m_Color = { r: col[0], g: col[1], b: col[2], a: col[3] };
      this.pintarImagen(n);
    } else if (n.span) {
      n.txt.m_Color = { r: col[0], g: col[1], b: col[2], a: col[3] };
      n.span.style.color = `rgba(${col[0] * 255},${col[1] * 255},${col[2] * 255},${col[3]})`;
    }
  }

  tamanoNativo(n) {
    const s = n.img && n.img.m_Sprite && n.img.m_Sprite.sprite, i = s && this.sprites[s];
    if (!i || !n.rt) return;
    n.rt[6] = i.w * 100 / (i.ppu || 100);
    n.rt[7] = i.h * 100 / (i.ppu || 100);
    this.relayout(n);
  }

  // Posición anclada (RectTransform.anchoredPosition) y tamaño (sizeDelta).
  mover(n, x, y) { if (n.rt) { n.rt[4] = x; n.rt[5] = y; this.relayout(n); } }
  tamano(n, w, h) { if (n.rt) { n.rt[6] = w; n.rt[7] = h; this.relayout(n); } }

  // CanvasGroup.alpha
  alfaGrupo(n, a) {
    if (n.grupo) n.grupo.alfa = a;
    n.el.style.opacity = String(a);
  }

  // ---------------------------------------------------------------- lo que tocan los Animator
  // Valor actual de una propiedad animable (tipo de componente + atributo del binding de Unity).
  leerPropiedad(n, tipo, a) {
    const [prop, eje] = a.split(/\.(?=[^.]+$)/);
    const i = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 }[eje];
    switch (prop) {
      case 'm_AnchoredPosition': return n.rt ? n.rt[4 + i] : 0;
      case 'm_SizeDelta': return n.rt ? n.rt[6 + i] : 0;
      case 'm_AnchorMin': return n.rt ? n.rt[i] : 0;
      case 'm_AnchorMax': return n.rt ? n.rt[2 + i] : 0;
      case 'm_Pivot': return n.rt ? n.rt[8 + i] : 0.5;
      case 'm_LocalScale': return (n.s || [1, 1, 1])[i];
      case 'm_LocalRotation': return (n.q || [0, 0, 0, 1])[i];
      case 'm_LocalEulerAngles': return (n.euler || this.euler(n.q || [0, 0, 0, 1]))[i];
      case 'm_LocalPosition': {
        if (i === 2) return n.z || 0;
        if (!n.rt) return n.p ? n.p[i] : 0;
        return n.rt[4 + i] + this.refAncla(n, i);
      }
      case 'm_Color': {
        const c = (n.img || n.raw || n.txt || {}).m_Color;
        return c ? [c.r, c.g, c.b, c.a][i] : 1;
      }
      default: break;
    }
    if (a === 'm_IsActive') return n.off ? 0 : 1;
    if (a === 'm_Alpha') return n.grupo ? n.grupo.alfa : 1;
    if (a === 'm_BlocksRaycasts') return n.grupo ? n.grupo.bloquea : 1;
    if (a === 'm_Interactable') return n.grupo ? n.grupo.interact : 1;
    if (a === 'm_FillAmount') return n.img ? n.img.m_FillAmount : 1;
    if (a === 'm_Enabled') { const c = this.compDe(n, tipo); return c ? (c.off ? 0 : 1) : 1; }
    if (a === 'm_Sprite') return n.img && n.img.m_Sprite ? n.img.m_Sprite.sprite : null;
    const c = this.compDe(n, tipo);
    return c && typeof c[a] === 'number' ? c[a] : 0;
  }

  ponerPropiedad(n, tipo, a, v) {
    const [prop, eje] = a.split(/\.(?=[^.]+$)/);
    const i = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 }[eje];
    const lay = () => this.sucio(n, 'layout');
    switch (prop) {
      case 'm_AnchoredPosition': if (n.rt && n.rt[4 + i] !== v) { n.rt[4 + i] = v; lay(); } return;
      case 'm_SizeDelta': if (n.rt && n.rt[6 + i] !== v) { n.rt[6 + i] = v; lay(); } return;
      case 'm_AnchorMin': if (n.rt && n.rt[i] !== v) { n.rt[i] = v; lay(); } return;
      case 'm_AnchorMax': if (n.rt && n.rt[2 + i] !== v) { n.rt[2 + i] = v; lay(); } return;
      case 'm_Pivot': if (n.rt && n.rt[8 + i] !== v) { n.rt[8 + i] = v; lay(); } return;
      case 'm_LocalScale': {
        const s = n.s || (n.s = [1, 1, 1]);
        if (s[i] !== v) { s[i] = v; this.sucio(n, 'transform'); }
        return;
      }
      case 'm_LocalRotation': {
        const q = n.q || (n.q = [0, 0, 0, 1]);
        if (q[i] !== v) { q[i] = v; n.euler = null; this.sucio(n, 'transform'); }
        return;
      }
      case 'm_LocalEulerAngles': {
        const e = n.euler || (n.euler = this.euler(n.q || [0, 0, 0, 1]));
        if (e[i] !== v) { e[i] = v; n.q = this.cuaternion(e); this.sucio(n, 'transform'); }
        return;
      }
      case 'm_LocalPosition': {
        if (i === 2) { n.z = v; return; }
        if (!n.rt) { const p = n.p || (n.p = [0, 0, 0]); if (p[i] !== v) { p[i] = v; lay(); } return; }
        const ap = v - this.refAncla(n, i);
        if (n.rt[4 + i] !== ap) { n.rt[4 + i] = ap; lay(); }
        return;
      }
      case 'm_Color': {
        const g = n.img || n.raw || n.txt;
        if (!g) return;
        const c = g.m_Color || (g.m_Color = { r: 1, g: 1, b: 1, a: 1 });
        const k = ['r', 'g', 'b', 'a'][i];
        if (c[k] === v) return;
        c[k] = v;
        if (i === 3) this.alfaGrafico(n, v);
        else this.sucio(n, 'color');
        return;
      }
      default: break;
    }
    if (a === 'm_IsActive') { const si = v >= 0.5; if (!n.off !== si) this.activo(n, si); return; }
    if (a === 'm_Alpha') { if (!n.grupo || n.grupo.alfa !== v) this.alfaGrupo(n, v); return; }
    if (a === 'm_BlocksRaycasts') {
      const si = v >= 0.5 ? 1 : 0;
      if (n.grupo && n.grupo.bloquea !== si) { n.grupo.bloquea = si; this.receptores(n); }
      return;
    }
    if (a === 'm_Interactable') { if (n.grupo) n.grupo.interact = v >= 0.5 ? 1 : 0; return; }
    if (a === 'm_FillAmount') { if (n.img && n.img.m_FillAmount !== v) this.relleno(n, v); return; }
    if (a === 'm_Sprite') { if (n.img && (!n.img.m_Sprite || n.img.m_Sprite.sprite !== v)) this.cambiarSprite(n, v); return; }
    const c = this.compDe(n, tipo);
    if (a === 'm_Enabled') {
      if (!c) return;
      const off = v < 0.5 ? 1 : 0;
      if ((c.off | 0) === off) return;
      c.off = off;
      if (c === n.img || c === n.raw) {
        if (n.g) { n.g.style.display = off ? 'none' : ''; this.ponerReceptor(n, n.g, c); } else if (!off) this.pintarImagen(n);
      }
      else if (c === n.txt && n.span) n.span.style.display = off ? 'none' : '';
      return;
    }
    if (c) { c[a] = v; if (this.alAnimar) this.alAnimar(n, tipo, a, v); }
  }

  receptores(n) {
    const g = n.img || n.raw;
    if (g && n.g) this.ponerReceptor(n, n.g, g);
    if (n.span && n.txt) this.ponerReceptor(n, n.span, n.txt);
    for (const h of n.h || []) this.receptores(h);
  }

  compDe(n, tipo) {
    if (!n.c) return null;
    const graf = ['Image', 'AtlasImage', 'RawImage', 'Text', 'RichImage', 'O7Image', 'RichText', 'TextWrapper'];
    return n.c.find((x) => x.c === tipo) || (graf.includes(tipo) ? (n.img || n.raw || n.txt) : null);
  }

  // Alfa de un gráfico (el de Image/RawImage va en su capa; el de Text, en el color del texto)
  alfaGrafico(n, a) {
    if (n.g && (n.img || n.raw)) n.g.style.opacity = String(a);
    else if (n.span && n.txt) {
      const c = n.txt.m_Color;
      n.span.style.color = `rgba(${c.r * 255},${c.g * 255},${c.b * 255},${a})`;
    }
  }

  // anchoredPosition ↔ localPosition: la posición del punto de referencia de las anclas respecto del
  // pivote del padre
  refAncla(n, i) {
    const pd = n.padre, pv = pd && pd.rt ? pd.rt[8 + i] : 0.5;
    const tam = i === 0 ? n.pw : n.ph;
    if (tam === undefined) return 0;
    const ref = n.rt[i] + (n.rt[2 + i] - n.rt[i]) * n.rt[8 + i];
    return tam * (ref - pv);
  }

  euler(q) {
    // Unity: rotación = Y·X·Z (grados)
    const [x, y, z, w] = q;
    const sx = 2 * (w * x - y * z);
    const ex = Math.asin(Math.max(-1, Math.min(1, sx)));
    const ey = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
    const ez = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
    const g = 180 / Math.PI;
    return [ex * g, ey * g, ez * g];
  }

  cuaternion(e) {
    const r = Math.PI / 360;
    const cx = Math.cos(e[0] * r), sx = Math.sin(e[0] * r), cy = Math.cos(e[1] * r), sy = Math.sin(e[1] * r);
    const cz = Math.cos(e[2] * r), sz = Math.sin(e[2] * r);
    // qY · qX · qZ
    return [cy * sx * cz + sy * cx * sz, sy * cx * cz - cy * sx * sz, cy * cx * sz - sy * sx * cz, cy * cx * cz + sy * sx * sz];
  }

  sucio(n, que) {
    if (!this.sucios) this.sucios = new Map();
    const x = this.sucios.get(n) || {};
    x[que] = true;
    this.sucios.set(n, x);
  }

  despuesDeAnimar() { /* se acomoda todo junto en cuadro() */ }

  // Lo que cambió desde el último cuadro: layout de los nodos movidos, transform, color y textos.
  acomodar() {
    if (!this.sucios || !this.sucios.size) return;
    const lista = this.sucios;
    this.sucios = new Map();
    for (const [n, x] of lista) {
      if (x.color) this.pintarImagen(n);
      if (x.layout || x.texto) this.relayout(this.raizLayout(n, x.texto));
      else if (x.transform) this.transformar(n);
    }
  }

  // Si el texto o el tamaño de un nodo cambian, se rehace desde el ancestro que depende de su tamaño
  // (ContentSizeFitter o layout group).
  raizLayout(n, porTexto) {
    if (!porTexto) return n;
    let r = n;
    for (let p = n.padre; p; p = p.padre) {
      if (p.ajuste || (p.grupoLayout && !p.grupoLayout.off)) r = p;
      else break;
    }
    r.hijosSucios = true;
    return r;
  }

  // Rehace el layout de un nodo con lo que tenía (si lo acomoda un layout group, el del padre).
  relayout(n) {
    const p = n.padre;
    if (p && p.grupoLayout && !p.grupoLayout.off) return this.relayout(p);
    if (n.pw === undefined) return this.layout();
    this.layoutNodo(n, n.pw, n.ph, n.forzado);
  }

  // Image Filled: cuánto se ve (0..1) según el método (horizontal, vertical, radial 90/180/360).
  relleno(n, cant) {
    const c = n.img; if (!c) return;
    c.m_FillAmount = cant;
    const el = n.g || this.capa(n), m = c.m_FillMethod | 0, o = c.m_FillOrigin | 0;
    const f = Math.max(0, Math.min(1, cant)) * 100;
    if (m === 0) el.style.clipPath = o === 0 ? `inset(0 ${100 - f}% 0 0)` : `inset(0 0 0 ${100 - f}%)`;
    else if (m === 1) el.style.clipPath = o === 0 ? `inset(${100 - f}% 0 0 0)` : `inset(0 0 ${100 - f}% 0)`;
    else {
      // radial: un polígono que barre desde el origen (aprox. con 32 lados)
      const total = m === 2 ? 90 : m === 3 ? 180 : 360;
      const ang = (f / 100) * total, horario = c.m_FillClockwise !== 0;
      const ini = m === 4 ? [90, 0, 270, 180][o] ?? 90 : 90;
      const pts = ['50% 50%'];
      for (let i = 0; i <= 32; i++) {
        const a = (ini + (horario ? -1 : 1) * ang * i / 32) * Math.PI / 180;
        pts.push(`${50 + Math.cos(a) * 75}% ${50 - Math.sin(a) * 75}%`);
      }
      el.style.clipPath = `polygon(${pts.join(',')})`;
    }
  }

  raw(n, c) {
    n.raw = c;
    if (c.off) return;
    const g = this.capa(n);
    this.ponerReceptor(n, g, c);
    const mat = this.nombreMaterial(c);
    if (mat && this.materiales[mat]) { n.dibujo = this.materiales[mat](n, c, g, this); return; }
    const t = c.m_Texture && c.m_Texture.textura;
    if (!t) return;
    g.style.backgroundImage = `url("${this.urlTextura(t)}")`;
    g.style.backgroundSize = '100% 100%';
  }

  urlTextura(t) { return `${this.base}sprites/${encodeURIComponent(t)}.webp`; }

  textoUI(n, c, el) {
    n.txt = c;
    const fd = c.m_FontData || {};
    const span = document.createElement('div');
    span.className = 'ut';
    const fuente = fd.m_Font && fd.m_Font.fuente;
    span.style.fontFamily = `"${fuente || 'CheekySansRounded-SemiboldCondensed'}", "CheekySansRounded-SemiboldCondensed", sans-serif`;
    span.style.fontSize = `${fd.m_FontSize || 14}px`;
    span.style.fontWeight = fd.m_FontStyle & 1 ? 'bold' : 'normal';
    span.style.fontStyle = fd.m_FontStyle & 2 ? 'italic' : 'normal';
    const a = fd.m_Alignment | 0;
    span.style.textAlign = ALINEA_H[a % 3];
    span.style.justifyContent = ALINEA_V[2 - Math.floor(a / 3)] === 'flex-end' ? 'flex-start' : ALINEA_V[Math.floor(a / 3)];
    span.style.alignItems = ['flex-start', 'center', 'flex-end'][a % 3];
    span.style.lineHeight = String(fd.m_LineSpacing || 1);
    const col = c.m_Color || { r: 1, g: 1, b: 1, a: 1 };
    span.style.color = `rgba(${col.r * 255},${col.g * 255},${col.b * 255},${col.a})`;
    el.appendChild(span);
    n.span = span;
    this.ponerReceptor(n, span, c);
    this.ponerTexto(n, c.m_Text || '');
  }

  // El texto de un nodo (con Localizer, la clave en el idioma elegido).
  ponerTexto(n, t) {
    if (!n.span) return;
    n.textoCrudo = t;
    let s = t;
    if (n.loc && n.loc._key && !n.loc._dynamic) s = this.texto(n.loc._key) ?? t;
    else if (n.loc && n.loc._key) s = this.texto(n.loc._key) ?? t;
    if (n.loc && n.loc._allCaps) s = s.toUpperCase();
    const rico = n.txt && n.txt.m_FontData && n.txt.m_FontData.m_RichText;
    if (rico && /<\/?(b|i|color|size)/.test(s)) n.span.innerHTML = this.rico(s);
    else n.span.textContent = s;
    n.medido = false;
    if (n.pw !== undefined) this.sucio(n, 'texto');
  }

  rico(s) {
    const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/&lt;(\/?)i&gt;/g, '<$1i>')
      .replace(/&lt;color=(#?[0-9a-zA-Z]+)&gt;/g, '<span style="color:$1">').replace(/&lt;\/color&gt;/g, '</span>')
      .replace(/&lt;size=(\d+)&gt;/g, '<span style="font-size:$1px">').replace(/&lt;\/size&gt;/g, '</span>')
      .replace(/\n/g, '<br>');
  }

  // ---------------------------------------------------------------- layout
  // Como Unity: el canvas raíz mide la pantalla dividida por el factor del CanvasScaler; cada
  // RectTransform se ubica en el rectángulo de su padre con sus anclas, tamaño y pivote.
  layout() {
    const W = this.cont.clientWidth || innerWidth, H = this.cont.clientHeight || innerHeight;
    this.W = W; this.H = H;
    for (const p of this.pantallas) for (const r of p.raices) {
      if (r.rt && !r.canvas) this.layoutNodo(r, W, H, null, true);
      else if (r.canvas) this.layoutRaiz(r, W, H, true);
      else {
        // un objeto suelto con canvases adentro: ocupa la pantalla
        r.el.style.position = 'absolute'; r.el.style.left = '0px'; r.el.style.top = '0px';
        r.el.style.width = `${W}px`; r.el.style.height = `${H}px`;
        r.rect = { x: 0, y: 0, w: W, h: H };
        for (const x of r.h || []) this.layoutNodo(x, W, H, null, true);
      }
    }
  }

  // Un Canvas de pantalla (Overlay o Camera): mide la pantalla dividida por su CanvasScaler.
  layoutRaiz(r, W, H, todo = true) {
    let esc = 1;
    const cs = r.escalador;
    if (cs && (cs.m_UiScaleMode | 0) === 1) {
      const rw = cs.m_ReferenceResolution.x, rh = cs.m_ReferenceResolution.y;
      const m = cs.m_ScreenMatchMode | 0;
      if (m === 0) {
        const lw = Math.log2(W / rw), lh = Math.log2(H / rh), t = cs.m_MatchWidthOrHeight;
        esc = Math.pow(2, lw + (lh - lw) * t);
      } else if (m === 1) esc = Math.min(W / rw, H / rh);
      else esc = Math.max(W / rw, H / rh);
    } else if (cs && (cs.m_UiScaleMode | 0) === 0) esc = cs.m_ScaleFactor || 1;
    const w = W / esc, h = H / esc;
    const el = r.el;
    el.style.position = 'absolute';
    el.style.left = '0px'; el.style.top = '0px';
    el.style.width = `${w}px`; el.style.height = `${h}px`;
    el.style.transformOrigin = '0 0';
    el.style.transform = `scale(${esc})`;
    r.rect = { w, h };
    for (const x of r.h || []) this.layoutNodo(x, w, h, null, todo);
  }

  layoutNodo(n, pw, ph, forzado, todo) {
    const el = n.el;
    n.pw = pw; n.ph = ph; n.forzado = forzado || null;
    if (n.canvas && n.canvas.modo !== 2 && !this.dentroDeCanvas(n)) return this.layoutRaiz(n, this.W, this.H, todo);
    if (n.ajuste && !forzado) this.ajustarTamano(n);
    let x0, y0, w, h;
    if (forzado) {
      ({ x: x0, y: y0, w, h } = forzado);
    } else if (n.rt) {
      const [ax0, ay0, ax1, ay1, px, py, sx, sy, pvx, pvy] = n.rt;
      const izq = pw * ax0 + px - sx * pvx, der = pw * ax1 + px + sx * (1 - pvx);
      const aba = ph * ay0 + py - sy * pvy, arr = ph * ay1 + py + sy * (1 - pvy);
      x0 = izq; w = der - izq; h = arr - aba; y0 = ph - arr;
    } else {
      x0 = 0; y0 = 0; w = pw; h = ph;
    }
    if (n.aspecto) ({ x0, y0, w, h } = this.aspecto(n, x0, y0, w, h, pw, ph));
    if (!n.rt && n.p) { x0 += n.p[0]; y0 -= n.p[1]; }      // un Transform suelto: su posición local
    el.style.position = 'absolute';
    el.style.left = `${x0}px`; el.style.top = `${y0}px`;
    const mismo = n.rect && Math.abs(n.rect.w - w) < 0.01 && Math.abs(n.rect.h - h) < 0.01;
    if (!mismo) { el.style.width = `${Math.max(0, w)}px`; el.style.height = `${Math.max(0, h)}px`; }
    n.rect = { x: x0, y: y0, w, h };
    this.transformar(n);
    if (n.span && (!mismo || !n.medido)) { this.ajustarTexto(n, w, h); n.medido = true; }
    if (mismo && !todo && !n.hijosSucios) return;      // los hijos sólo dependen del tamaño
    n.hijosSucios = false;
    if (n.grupoLayout && !n.grupoLayout.off) this.layoutGrupo(n, w, h, todo);
    else for (const x of n.h || []) this.layoutNodo(x, w, h, null, todo);
  }

  // Escala y rotación (localScale, localRotation) alrededor del pivote.
  transformar(n) {
    const r = n.rect; if (!r) return;
    const pv = n.rt ? [n.rt[8], n.rt[9]] : [0.5, 0.5];
    let tr = '';
    if (n.s) tr += ` scale(${n.s[0]},${n.s[1]})`;
    if (n.q) {
      const [qx, qy, qz, qw] = n.q;
      const z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
      if (Math.abs(z) > 1e-6) tr = ` rotate(${-z}rad)` + tr;
    }
    if (n.mover) tr = ` translate(${n.mover[0]}px,${-n.mover[1]}px)` + tr;
    n.el.style.transformOrigin = `${pv[0] * r.w}px ${(1 - pv[1]) * r.h}px`;
    n.el.style.transform = tr;
  }

  dentroDeCanvas(n) {
    for (let p = n.padre; p; p = p.padre) if (p.canvas) return true;
    return false;
  }

  // ContentSizeFitter: el tamaño preferido en los ejes que ajusta (1 mínimo, 2 preferido).
  ajustarTamano(n) {
    const a = n.ajuste, rt = n.rt;
    if (!rt) return;
    const pref = n.grupoLayout ? this.preferidoGrupo(n) : this.preferido(n);
    if ((a.m_HorizontalFit | 0) > 0) rt[6] = pref.w;
    if ((a.m_VerticalFit | 0) > 0) rt[7] = pref.h;
  }

  preferidoGrupo(n) {
    const g = n.grupoLayout, vert = g.c === 'VerticalLayoutGroup';
    const pad = g.m_Padding || { m_Left: 0, m_Right: 0, m_Top: 0, m_Bottom: 0 };
    const hijos = (n.h || []).filter((x) => !x.off && !(x.elemLayout && x.elemLayout.m_IgnoreLayout));
    const sp = g.m_Spacing || 0;
    let prin = 0, sec = 0;
    for (const x of hijos) {
      if (x.ajuste) this.ajustarTamano(x);
      const p = (vert ? g.m_ChildControlHeight : g.m_ChildControlWidth) || x.grupoLayout || x.span ? this.preferido(x)
        : { w: x.rt ? x.rt[6] : 0, h: x.rt ? x.rt[7] : 0 };
      prin += vert ? p.h : p.w;
      sec = Math.max(sec, vert ? p.w : p.h);
    }
    prin += sp * Math.max(0, hijos.length - 1);
    return vert ? { w: sec + pad.m_Left + pad.m_Right, h: prin + pad.m_Top + pad.m_Bottom }
      : { w: prin + pad.m_Left + pad.m_Right, h: sec + pad.m_Top + pad.m_Bottom };
  }

  aspecto(n, x0, y0, w, h, pw, ph) {
    const a = n.aspecto, r = a.m_AspectRatio || 1, modo = a.m_AspectMode | 0;
    let nw = w, nh = h;
    if (modo === 1) nh = w / r;                    // WidthControlsHeight
    else if (modo === 2) nw = h * r;               // HeightControlsWidth
    else if (modo === 3) { nw = Math.min(pw, ph * r); nh = nw / r; }   // FitInParent
    else if (modo === 4) { nw = Math.max(pw, ph * r); nh = nw / r; }   // EnvelopeParent
    if (modo >= 3) { x0 = (pw - nw) / 2; y0 = (ph - nh) / 2; }
    else { x0 += (w - nw) * (n.rt ? n.rt[8] : 0.5); y0 += (h - nh) * (1 - (n.rt ? n.rt[9] : 0.5)); }
    return { x0, y0, w: nw, h: nh };
  }

  // Horizontal/Vertical Layout Group (lo común: padding, spacing, alineación, controlar tamaño).
  layoutGrupo(n, w, h, todo) {
    const g = n.grupoLayout;
    const vert = g.c === 'VerticalLayoutGroup';
    const pad = g.m_Padding || { m_Left: 0, m_Right: 0, m_Top: 0, m_Bottom: 0 };
    const hijos = (n.h || []).filter((x) => !x.off && !(x.elemLayout && x.elemLayout.m_IgnoreLayout));
    const sp = g.m_Spacing || 0;
    const ctlW = g.m_ChildControlWidth, ctlH = g.m_ChildControlHeight;
    const expW = g.m_ChildForceExpandWidth, expH = g.m_ChildForceExpandHeight;
    const tam = hijos.map((x) => {
      const pref = this.preferido(x);
      return { w: ctlW ? pref.w : (x.rt ? x.rt[6] : pref.w), h: ctlH ? pref.h : (x.rt ? x.rt[7] : pref.h) };
    });
    const iw = w - pad.m_Left - pad.m_Right, ih = h - pad.m_Top - pad.m_Bottom;
    const ali = g.m_ChildAlignment | 0;
    const totalPrin = tam.reduce((s, t) => s + (vert ? t.h : t.w), 0) + sp * Math.max(0, hijos.length - 1);
    const libre = (vert ? ih : iw) - totalPrin;
    const exp = vert ? expH : expW;
    let extra = 0;
    if (exp && hijos.length && libre > 0 && (vert ? ctlH : ctlW)) extra = libre / hijos.length;
    let pos = (vert ? pad.m_Top : pad.m_Left);
    if (!(exp && extra)) pos += Math.max(0, libre) * (vert ? [0, 0.5, 1][Math.floor(ali / 3)] : [0, 0.5, 1][ali % 3]);
    hijos.forEach((x, i) => {
      let { w: cw, h: ch } = tam[i];
      if (vert) {
        ch += extra;
        if (ctlW && expW) cw = iw;
        const cx = pad.m_Left + (iw - cw) * [0, 0.5, 1][ali % 3];
        this.layoutNodo(x, w, h, { x: cx, y: pos, w: cw, h: ch }, todo);
        pos += ch + sp;
      } else {
        cw += extra;
        if (ctlH && expH) ch = ih;
        const cy = pad.m_Top + (ih - ch) * [0, 0.5, 1][Math.floor(ali / 3)];
        this.layoutNodo(x, w, h, { x: pos, y: cy, w: cw, h: ch }, todo);
        pos += cw + sp;
      }
    });
    for (const x of (n.h || []).filter((x) => !hijos.includes(x))) this.layoutNodo(x, w, h, null, todo);
    if (n.ajuste) n.contenido = { w: totalPrin + pad.m_Left + pad.m_Right, h: totalPrin + pad.m_Top + pad.m_Bottom };
  }

  preferido(n) {
    if (n.grupoLayout) return this.preferidoGrupo(n);
    const le = n.elemLayout;
    if (le && le.m_PreferredWidth > 0 && le.m_PreferredHeight > 0) return { w: le.m_PreferredWidth, h: le.m_PreferredHeight };
    if (n.span) {
      const m = this.medir(n);
      return { w: le && le.m_PreferredWidth > 0 ? le.m_PreferredWidth : m.w, h: le && le.m_PreferredHeight > 0 ? le.m_PreferredHeight : m.h };
    }
    if (n.img && n.img.m_Sprite && n.img.m_Sprite.sprite) {
      const i = this.sprites[n.img.m_Sprite.sprite];
      if (i) return { w: le && le.m_PreferredWidth > 0 ? le.m_PreferredWidth : i.w * 100 / (i.ppu || 100), h: le && le.m_PreferredHeight > 0 ? le.m_PreferredHeight : i.h * 100 / (i.ppu || 100) };
    }
    return { w: n.rt ? n.rt[6] : 0, h: n.rt ? n.rt[7] : 0 };
  }

  medir(n) {
    const m = this.medidor, s = n.span;
    m.style.font = getComputedStyle(s).font;
    m.textContent = s.textContent;
    return { w: m.offsetWidth + 2, h: m.offsetHeight };
  }

  // Best Fit: achica la letra hasta que entre (como Text.resizeTextForBestFit).
  ajustarTexto(n, w, h) {
    const s = n.span, fd = n.txt.m_FontData || {};
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.display = 'flex';
    s.style.flexDirection = 'column';
    s.style.whiteSpace = fd.m_HorizontalOverflow ? 'pre' : 'pre-wrap';
    s.style.overflowWrap = 'break-word';
    const sombras = [];
    for (const e of n.efectos || []) {
      const c = e.m_EffectColor || { r: 0, g: 0, b: 0, a: 0.5 };
      const col = `rgba(${c.r * 255},${c.g * 255},${c.b * 255},${c.a})`;
      const d = e.m_EffectDistance || { x: 1, y: -1 };
      if (e.c === 'Outline') for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) sombras.push(`${dx * d.x}px ${-dy * d.y}px 0 ${col}`);
      else sombras.push(`${d.x}px ${-d.y}px 0 ${col}`);
    }
    s.style.textShadow = sombras.join(',');
    if (!fd.m_BestFit) return;
    let lo = fd.m_MinSize || 1, hi = fd.m_MaxSize || fd.m_FontSize || 40;
    s.style.fontSize = `${hi}px`;
    if (s.scrollWidth <= w + 1 && s.scrollHeight <= h + 1) return;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      s.style.fontSize = `${mid}px`;
      if (s.scrollWidth <= w + 1 && s.scrollHeight <= h + 1) lo = mid; else hi = mid;
    }
    s.style.fontSize = `${lo}px`;
  }
}

// Las fuentes del juego como @font-face (una vez).
export async function cargarFuentes(base, archivos) {
  for (const a of archivos) {
    const n = a.replace(/\.(otf|ttf)$/i, '');
    try {
      const f = new FontFace(n, `url("${base}fuentes/${encodeURIComponent(a)}")`);
      await f.load();
      document.fonts.add(f);
    } catch (e) { console.warn('fuente', a, e); }
  }
}
