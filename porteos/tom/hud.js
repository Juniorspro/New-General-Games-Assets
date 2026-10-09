// La interfaz principal de My Talking Tom (MainUI): lo que hacen los scripts del juego con los
// objetos de la pantalla, leído de libil2cpp (Outfit7.MyTalkingTom.UI.MainUI.*).

// ---------------------------------------------------------------- medidores de los botones
// MainButtonProgressController: el botón de cada cuarto con su medidor (RawImage con el shader
// Outfit7/UI/MainButtonProgress). Constantes del .ctor y del código.
const BLANCO = [0.949, 0.949, 0.949, 1];            // WhiteColor
const ROJO = [0.882, 0.118, 0.118, 1];              // RedColor
const MARCO_INACTIVO = [-0.4, -3.1];                // InactiveFramePosition
const MARCO_ACTIVO = [0, 0];                        // ActiveFramePosition (Vector2.zero)
const UMBRAL_BAJO = 30;                             // LowerThreshold
const ABAJO = 0.12, ALTO = 0.76;                    // BottomLimit, TopMinusBottomLimit

const igual = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2 < 1e-10;

// El shader del medidor en un canvas 2D (la textura es chica, 128×128):
//   a = alfa de _MainTex; abajo de _Progress−_LineWidth → _ColorLower, arriba de _Progress+_LineWidth →
//   _ColorUpper, en el medio _ColorLine (+ _ColorUpper·(1−_ColorLine.a)); salida = a·(a·color),
//   mezclada con SrcAlpha/OneMinusSrcAlpha.
export class DibujoMedidor {
  constructor(ui, n, c, capa, mat) {
    this.mat = mat;                      // {_ColorLower, _ColorLine, _ColorUpper, _LineWidth, _Progress}
    this.lienzo = document.createElement('canvas');
    this.lienzo.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    capa.appendChild(this.lienzo);
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      this.lienzo.width = w; this.lienzo.height = h;
      const x = this.lienzo.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, w, h).data;
      this.a = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) this.a[i] = d[i * 4 + 3] / 255;
      this.ctx = x;
      this.datos = x.createImageData(w, h);
      this.dibujar();
    };
    img.src = ui.urlTextura(c.m_Texture.textura);
  }

  poner(prop, valor) { this.mat[prop] = valor; this.dibujar(); }

  dibujar() {
    if (!this.a) return;
    const { _ColorLower: lo, _ColorLine: li, _ColorUpper: up, _LineWidth: lw, _Progress: p } = this.mat;
    const w = this.lienzo.width, h = this.lienzo.height, out = this.datos.data, a = this.a;
    const k = 1 - li[3];
    const medio = [li[0] + up[0] * k, li[1] + up[1] * k, li[2] + up[2] * k, li[3] + up[3] * k];
    for (let y = 0; y < h; y++) {
      const v = 1 - (y + 0.5) / h;          // las UV de Unity van de abajo hacia arriba
      const c = v < p - lw ? lo : v > p + lw ? up : medio;
      for (let x = 0, i = y * w; x < w; x++, i++) {
        const a2 = a[i] * a[i], al = a2 * c[3];
        // lo que queda en pantalla: a⁴·color + (1 − a²)·fondo → en canvas (alfa directo) color·a² con alfa a²
        const o = i * 4;
        out[o] = c[0] * a2 * 255; out[o + 1] = c[1] * a2 * 255; out[o + 2] = c[2] * a2 * 255; out[o + 3] = al * 255;
      }
    }
    this.ctx.putImageData(this.datos, 0, 0);
  }
}

export class MedidorBoton {
  // n: el nodo del botón (btn_kitchen…); c: su MainButtonProgressController; p: la pantalla armada
  constructor(ui, p, n, c) {
    this.ui = ui; this.n = n; this.c = c;
    const go = (r) => (r && r.go !== undefined ? p.porId.get(r.go) : null);
    this.imagen = go(c.ProgressImage);
    this.marco = go(c.FrameImage);
    this.sombra = go(c.ShadowOverlay);
    this.reflejos = go(c.Reflections);
    this.grupoTexto = go(c.ProgressCanvasGroup);
    this.texto = go(c.ProgressText);
    this.progreso = c.Progress || 0;          // Progress (0..1)
    this.actual = this.progreso;              // CurrentProgress
    this.colorActual = [1, 1, 1, 1];          // CurrentColor (el .ctor lo deja en blanco puro)
    this.colorDestino = [1, 1, 1, 1];
    this.tiempoColor = 0; this.animandoColor = false;
    this.diferencia = 0.01;
    this.porcentajeTexto = -1;
    this.tiempoTexto = 0; this.esperaTexto = 0; this.mostrandoTexto = true;
    this.animando = false; this.animandoTexto = false;
    // Awake: el material es una copia del MainButtonProgress_MAT; el texto empieza invisible
    if (this.grupoTexto) ui.alfaGrupo(this.grupoTexto, 0);
  }

  get dibujo() { return this.imagen && this.imagen.dibujo; }

  colorParaProgreso() {
    const pct = Math.min(Math.ceil(this.actual * 100), 100);
    return pct > UMBRAL_BAJO ? BLANCO : ROJO;
  }

  // Activate(bool): el botón del cuarto donde está Tom brilla y no se mueve
  activar(si) {
    if (this.marco) {
      this.ui.cambiarSprite(this.marco, si ? 'Btn_MeterBase_Glow_UI_TEX' : 'Btn_MeterBase_UI_TEX', { nativo: true });
      const pos = si ? MARCO_ACTIVO : MARCO_INACTIVO;
      this.ui.mover(this.marco, pos[0], pos[1]);
    }
    this.n.animadorApagado = si;     // Animator.enabled = !activate
  }

  // SetProgress(int progress, bool animate)
  ponerProgreso(pct, animar) {
    this.progreso = pct * 0.01;
    const dif = Math.abs(this.actual - this.progreso);
    this.diferencia = dif > 0.5 ? 0.5 : dif < 0.01 ? 0.01 : dif;
    this.animando = !!animar;
    if (!animar) {
      this.actual = this.progreso;
      this.colorDestino = this.colorParaProgreso();
      this.colorActual = this.colorDestino.slice();
      this.ponerMaterial();
      this.actualizarTexto();
    }
    this.ponerBisel(igual(this.colorActual, ROJO));
  }

  ponerBisel(rojo) {
    if (this.sombra) this.ui.cambiarSprite(this.sombra, rojo ? 'Btn_BevelRed_UI_TEX' : 'Btn_BevelGreen_UI_TEX');
    if (this.reflejos) this.ui.ponerColor(this.reflejos, [1, 1, 1, rojo ? 0.7058824 : 1]);
  }

  ponerMaterial() {
    const d = this.dibujo;
    if (!d) return;
    d.mat._Progress = this.actual * ALTO + ABAJO;
    d.mat._ColorUpper = this.colorActual.slice();
    d.dibujar();
  }

  // ShowProgressText: el porcentaje aparece (1 s), queda 2 s y se va (1 s)
  mostrarTexto() {
    this.animandoTexto = true;
    this.mostrandoTexto = true;
    this.esperaTexto = -this.tiempoTexto;
  }

  actualizarTexto() {
    const pct = Math.ceil(this.actual * 100);
    if (pct === this.porcentajeTexto) return;
    this.porcentajeTexto = pct;
    if (this.texto) this.ui.ponerTexto(this.texto, `${Math.min(pct, 100)}%`);
  }

  // Lo que el juego engancha a Canvas.willRenderCanvases mientras hace falta
  cuadro(dt) {
    if (this.animando) this.animarBoton(dt);
    if (this.animandoColor) this.animarColor(dt);
    if (this.animandoTexto) this.animarTexto(dt);
  }

  animarBoton(dt) {
    const paso = dt * this.diferencia;
    const falta = this.progreso - this.actual;
    this.actual = Math.abs(falta) > paso ? this.actual + (falta < 0 ? -paso : paso) : this.progreso;
    this.colorDestino = this.colorParaProgreso();
    if (!igual(this.colorDestino, this.colorActual) && !this.animandoColor) {
      this.animandoColor = true;
      this.tiempoColor = 0;
      this.ponerBisel(igual(this.colorActual, BLANCO));   // de blanco a rojo: bisel rojo
    }
    if (Math.abs(this.actual - this.progreso) <= 1e-4) {
      this.actual = this.progreso;
      this.animando = false;
    }
    this.ponerMaterial();
  }

  animarColor(dt) {
    this.tiempoColor += dt;
    if (this.tiempoColor >= 1) { this.tiempoColor = 1; this.animandoColor = false; }
    const t = Math.max(0, Math.min(1, this.tiempoColor));
    for (let i = 0; i < 4; i++) this.colorActual[i] += (this.colorDestino[i] - this.colorActual[i]) * t;
    this.ponerMaterial();
  }

  animarTexto(dt) {
    if (!this.grupoTexto || this.n.el.style.display === 'none') return;
    this.actualizarTexto();
    if (this.mostrandoTexto) {
      if (this.tiempoTexto < 1) {
        this.tiempoTexto = Math.min(this.tiempoTexto + dt, 1);
        this.ui.alfaGrupo(this.grupoTexto, Math.max(this.tiempoTexto, 0));
      } else {
        this.esperaTexto += dt;
        if (this.esperaTexto >= 2) this.mostrandoTexto = false;
      }
    } else if (this.tiempoTexto > 0) {
      this.tiempoTexto = Math.max(this.tiempoTexto - dt, 0);
      this.ui.alfaGrupo(this.grupoTexto, Math.min(this.tiempoTexto, 1));
      if (this.tiempoTexto <= 0) {
        this.mostrandoTexto = true;
        this.esperaTexto = 0;
        this.animandoTexto = false;
      }
    } else {
      this.animandoTexto = false;
    }
  }
}

// El material del medidor (MainButtonProgress_MAT, sharedassets2) para el dibujo.
export const MATERIAL_MEDIDOR = {
  _ColorLower: [0.7843137, 0.9764706, 0.1921569, 1],
  _ColorLine: [0.5147885, 0.6838235, 0, 1],
  _ColorUpper: [1, 1, 1, 1],
  _LineWidth: 0.01,
  _Progress: 0.689,
};

// ---------------------------------------------------------------- la pantalla
const BOTONES_CUARTO = { living: 'btn_livingroom', kitchen: 'btn_kitchen', bathroom: 'btn_toilet', bedroom: 'btn_bedroom' };

export function registrarMateriales(ui) {
  ui.materiales.MainButtonProgress_MAT = (n, c, capa) => new DibujoMedidor(ui, n, c, capa, structuredClone(MATERIAL_MEDIDOR));
}

export class Hud {
  constructor(ui, p) {
    this.ui = ui; this.p = p;
    this.medidores = {};
    for (const [cuarto, nombre] of Object.entries(BOTONES_CUARTO)) {
      const n = p.nodo(nombre);
      const c = n && n.c && n.c.find((x) => x.c === 'MainButtonProgressController');
      if (c) this.medidores[cuarto] = new MedidorBoton(ui, p, n, c);
    }
  }

  cuarto(actual) {
    for (const [k, m] of Object.entries(this.medidores)) m.activar(k === actual);
  }

  cuadro(dt) {
    for (const m of Object.values(this.medidores)) m.cuadro(dt);
  }
}
