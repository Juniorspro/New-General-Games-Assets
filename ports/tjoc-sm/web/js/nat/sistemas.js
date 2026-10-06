/* Sistemas varios del mundo: materiales (instancias dinámicas y parámetros), mallas de componentes creados en
   juego, texto 3D, partículas simples y el tick de componentes (animación, timelines, matinee, sonido 3D). */
import * as THREE from 'three';
import { Mundo } from '../mundo.js';
import { METODOS } from './motor.js';
import { crearMaterial } from '../ue.js';

/* ---------------- materiales ---------------- */
export class Materiales {
  constructor(M) { this.M = M; this.cache = new Map(); }
  info(ruta) { return this.M.R.mats?.[ruta] || null; }
  three(ruta, opciones = {}) {
    const k = ruta + '|' + (opciones.skin ? 's' : '');
    if (!this.cache.has(k)) this.cache.set(k, crearMaterial(this.M.R, this.info(ruta), null, { lm: 1 }));
    return this.cache.get(k);
  }
  nuevoDinamico(base) {
    const ruta = base?.asset || base?.base || null;
    return { __ref: true, nat: 'MaterialInstanceDynamic', id: 'mid' + Math.random().toString(36).slice(2), base: ruta, params: {}, usos: new Set(), nombre: 'MID' };
  }
  materialDe(c, i) { const m = c.malla?.material; return Array.isArray(m) ? m[i] : i === 0 ? m : null; }
  ponerMaterial(c, i, m) {
    if (!c.malla || !m) return;
    let t;
    if (m.nat === 'MaterialInstanceDynamic') { t = this.three(m.base).clone(); m.usos.add(t); this.aplicarParams(m, t); }
    else t = this.three(m.asset);
    if (Array.isArray(c.malla.material)) { c.malla.material = c.malla.material.slice(); if (i < c.malla.material.length) c.malla.material[i] = t; }
    else if (i === 0) c.malla.material = t;
    (c.matsUE || (c.matsUE = []))[i] = m;
  }
  material(c, i) { return c.matsUE?.[i] || (c.nodo?.mats?.[i] ? this.M.asset(c.nodo.mats[i], 'MaterialInterface') : null) || this.M.asset(c.malla?.userData?.mats?.[i] || 'mat?', 'MaterialInterface'); }
  dinamico(c, i, src) {
    const base = src || this.material(c, i);
    const mid = this.nuevoDinamico(base);
    this.ponerMaterial(c, i, mid);
    return mid;
  }
  aplicarParams(mid, t) {
    for (const [n, v] of Object.entries(mid.params)) this.aplicarParam(t, n, v);
  }
  aplicarParam(t, n, v) {
    const k = n.toLowerCase();
    if (typeof v === 'number') {
      if (/opac|alpha|fade|transp/.test(k)) { t.transparent = true; t.opacity = Math.max(0, Math.min(1, v)); t.depthWrite = v > 0.99; t.needsUpdate = true; }
      else if (/emis|glow|bright|intens|power|light/.test(k)) { if (t.emissive) { if (t.emissive.getHex() === 0 && v > 0) t.emissive.setRGB(1, 1, 1); t.emissiveIntensity = v; } }
    } else if (v && typeof v === 'object' && 'R' in v) {
      if (/emis|glow/.test(k)) { if (t.emissive) t.emissive.setRGB(v.R, v.G, v.B, THREE.LinearSRGBColorSpace); }
      else if (/color|tint|albedo|base|diffuse/.test(k)) t.color?.setRGB(v.R, v.G, v.B, THREE.LinearSRGBColorSpace);
    } else if (v && v.asset) {
      if (/tex|diff|base|alb|color/.test(k) || !t.map) { const info = this.M.R.texturaDe?.(v.asset); if (info) { t.map = this.M.R.textura(info); t.needsUpdate = true; } }
    }
  }
  escalarEnComp(c, n, v) { const ms = c.malla ? (Array.isArray(c.malla.material) ? c.malla.material : [c.malla.material]) : []; c.malla && (c.malla.material = Array.isArray(c.malla.material) ? ms.map((m) => { const x = m.clone(); this.aplicarParam(x, n, v); return x; }) : (() => { const x = ms[0].clone(); this.aplicarParam(x, n, v); return x; })()); }
  vectorEnComp(c, n, v) { this.escalarEnComp(c, n, v); }
  paramAsset(ruta, n, v) { for (const [k, t] of this.cache) if (k.startsWith(ruta + '|')) this.aplicarParam(t, n, Array.isArray(v) ? { R: v[0], G: v[1], B: v[2], A: v[3] ?? 1 } : v); }
  coleccion() {}
  texturaUI(m) { const i = this.info(m?.asset || m?.base); return i?.baseRuta || null; }
}
Object.assign(METODOS.MaterialInstanceDynamic = METODOS.MaterialInstanceDynamic || {}, {
  SetScalarParameterValue(m, [n, v]) { m.params[n] = v; for (const t of m.usos) this.materiales.aplicarParam(t, n, v); },
  SetVectorParameterValue(m, [n, v]) { m.params[n] = v; for (const t of m.usos) this.materiales.aplicarParam(t, n, v); },
  SetTextureParameterValue(m, [n, v]) { m.params[n] = v; for (const t of m.usos) this.materiales.aplicarParam(t, n, v); },
  K2_GetScalarParameterValue(m, [n]) { return m.params[n] ?? 0; },
  K2_GetVectorParameterValue(m, [n]) { return m.params[n] ?? { R: 0, G: 0, B: 0, A: 0 }; },
  K2_CopyMaterialInstanceParameters(m, [src]) { if (src?.params) Object.assign(m.params, src.params); },
});

/* ---------------- partículas (simple: sólo estado) ---------------- */
export class Particulas {
  constructor(M) { this.M = M; }
  activar(c, on) { c.partActivo = on; if (c.part) c.part.visible = on; }
  emitirEn() { return null; }
  emitirPegado() { return null; }
}

/* ---------------- contenido de componentes creados al spawnear ---------------- */
Mundo.prototype.contenidoComp = function (c) {
  const p = c.tplProps || {};
  if (/StaticMeshComponent/.test(c.nat) && p.StaticMesh?.asset) this.cambiarMalla(c, this.asset(p.StaticMesh.asset, 'StaticMesh'), p.OverrideMaterials);
  if (/SkeletalMeshComponent/.test(c.nat) && p.SkeletalMesh?.asset) {
    this.cambiarMalla(c, this.asset(p.SkeletalMesh.asset, 'SkeletalMesh'), p.OverrideMaterials);
    const ad = p.AnimationData || {};
    c.nodoAnim = { modo: (p.AnimationMode || '').split('::').pop() || 'AnimationBlueprint', anim: ad.AnimToPlay?.asset, loop: ad.bSavedLooping ?? true, tocando: ad.bSavedPlaying ?? true };
  }
  if (/LightComponent/.test(c.nat)) {
    const tipo = c.nat.replace('LightComponent', '');
    if (tipo === 'Point' || tipo === 'Spot') {
      const col = p.LightColor || { R: 255, G: 255, B: 255 };
      c.luz = { obj: c.o3, tipo, int: p.Intensity ?? 5000, color: [col.R / 255, col.G / 255, col.B / 255], radio: (p.AttenuationRadius ?? 1000) / 100, in: p.InnerConeAngle ?? 0, out: p.OuterConeAngle ?? 44, comp: c, visible: true };
      (this.lucesExtra || (this.lucesExtra = [])).push(c.luz); this.luces.extra = this.lucesExtra;
    }
  }
  if (c.nat === 'AudioComponent') this.audio?.registrarComp(c, { sonido: p.Sound?.asset, vol: p.VolumeMultiplier, tono: p.PitchMultiplier, auto: p.bAutoActivate ?? true });
  if (/CameraComponent/.test(c.nat)) { c.fov = p.FieldOfView ?? 90; c.usarRotControl = !!p.bUsePawnControlRotation; }
};
Mundo.prototype.cambiarMalla = function (c, m, override) {
  if (!m) { if (c.malla) { c.malla.removeFromParent(); c.malla = null; } return; }
  const meta = this.R.mallas?.[m.asset]; if (!meta) { this.vm.falta('malla ' + m.asset); return; }
  this.R.geometria(meta).then((g) => {
    if (c.malla) c.malla.removeFromParent();
    const mats = meta.secs.map(([, , mi]) => this.materiales.three((override && override[mi]?.asset) || meta.mats[mi] || '?'));
    let malla;
    if (meta.tipo === 'skel') malla = this.R.esqueletica(g, mats, meta);
    else malla = new THREE.Mesh(g, mats);
    malla.userData.mats = meta.mats;
    c.o3.add(malla); c.malla = malla;
    malla.visible = c.vis && !c.ocultoJuego;
    if (malla.isSkinnedMesh) {
      this.animar?.prepararComp(c, c.nodoAnim || {});
      if (c.nodoAnim?.anim && /SingleNode/.test(c.nodoAnim.modo)) this.animar?.poner(c, c.nodoAnim.anim, c.nodoAnim.loop, c.nodoAnim.tocando);
    }
  });
};
Mundo.prototype.textoRender = function (c, t) {
  const s = typeof t === 'string' ? t : (t?.SourceString ?? '');
  c.texto = s;
  const n = c.nodo || {};
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 512, 128);
  const col = n.color || [1, 1, 1]; g.fillStyle = `rgb(${col.map((x) => Math.round(x * 255)).join(',')})`; g.font = '72px sans-serif'; g.textBaseline = 'middle';
  g.fillText(this.texto(s), 8, 64);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  if (!c.extra3) {
    const alto = (n.tam || 0.26), ancho = alto * 4;
    c.extra3 = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    c.extra3.rotation.y = -Math.PI / 2; c.o3.add(c.extra3);
  } else { c.extra3.material.map?.dispose(); c.extra3.material.map = tex; }
};
Mundo.prototype.colorTextoRender = function (c, col) { if (c.nodo) c.nodo.color = [col.R / 255, col.G / 255, col.B / 255]; this.textoRender(c, c.texto || ''); };
Mundo.prototype.tickComponentes = function (dt) {
  for (const m of this.matinees || []) m.tick(dt);
  this.tickTimelines?.(dt);
  this.secuencias?.tick(dt);
  this.animar?.tick(dt);
  for (const a of this.actores) if (a.v?.RotationSpeed !== undefined && a.clase?.n === 'BP_RotatingFanBlades_C') void 0;
};
Mundo.prototype.iniciarSistemas = function () { this.materiales = new Materiales(this); this.particulas = new Particulas(this); };
