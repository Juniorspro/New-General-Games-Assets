
/* ====================== assets generados (Rezona), adentro del archivo ======================
   Todo arranca con lo dibujado por código y lo generado lo pisa cuando decodifica: un base64 roto
   cuesta una pieza, no la pantalla. Sin fetch ni blob: URL (el visor de la app los bloquea en
   silencio): imágenes con createImageBitmap sobre un Blob y sonidos con decodeAudioData.
   Los modelos (armas, manos, personajes, mapas) no vienen de afuera: se construyen por código. window.ARCH trae los datos y window.MAN lo medido de cada uno. */
const ARCH = window.ARCH || {}, MAN = window.MAN || {tex:[], cielo:[], arte:[], decal:[], aud:[], luz:[], mocap:[]}, ETC2 = window.ARCH_ETC2 || {};
const ASSET = {pend:0, ok:0, fallas:[], img:{}, aud:{}, t0:performance.now()};
const manDe = (lista, id)=> (MAN[lista]||[]).find(m=> m.id===id) || null;
function b64Bytes(d){ const i = d.indexOf(','), s = atob(d.slice(i + 1)), n = s.length, u = new Uint8Array(n); for(let k=0;k<n;k++) u[k] = s.charCodeAt(k); return u; }
const mimeDe = d => d.slice(5, d.indexOf(';'));
function porImg(d){ return new Promise((ok, mal)=>{ const im = new Image(); im.onload = ()=> ok(im); im.onerror = mal; im.src = d; }); }
/* en un aparato con poca memoria las texturas de materiales (sólo tex/: los mapas de luz se leen por texel y no se tocan) bajan a 512 (una de 1024 son 5 MB de placa con sus mips) */
const TEX_MAX = ((navigator.deviceMemory && navigator.deviceMemory <= 3) || (typeof ren !== 'undefined' && ren.capabilities.maxTextureSize < 4096)) ? 512 : 1024;
function achicar(im){ if(!im || Math.max(im.width, im.height) <= TEX_MAX || !im.close) return im; const f = TEX_MAX/Math.max(im.width, im.height);
  return createImageBitmap(im, {resizeWidth:Math.round(im.width*f), resizeHeight:Math.round(im.height*f), resizeQuality:'high'}).then(r=>{ im.close(); return r; }, ()=> im); }
/* voltear = las texturas que se repiten (convención de three: la fila de arriba en v=1); las de un GLB van sin voltear */
function decImagen(id, voltear){
  if(ASSET.img[id]) return ASSET.img[id];
  const d = ARCH[id]; if(!d) return Promise.resolve(null);
  ASSET.pend++;
  const listo = im=> { ASSET.ok++; im.__volteada = !!voltear && !(im instanceof HTMLImageElement); return im; };
  const falla = ()=> { ASSET.fallas.push(id); return null; };
  let p;
  /* en la APK los assets son archivos (no base64 adentro del HTML): se piden con fetch */
  if(!d.startsWith('data:')) p = fetch(d).then(r=> r.blob()).then(b=> createImageBitmap(b, voltear ? {imageOrientation:'flipY'} : {})).then(im=> id.startsWith('tex/') ? achicar(im) : im).then(listo, ()=> porImg(d).then(listo, falla));
  else if(window.createImageBitmap){
    try{ const b = new Blob([b64Bytes(d)], {type:mimeDe(d)});
      p = createImageBitmap(b, voltear ? {imageOrientation:'flipY'} : {}).then(im=> id.startsWith('tex/') ? achicar(im) : im, ()=> null).then(im=> im ? listo(im) : porImg(d).then(listo, falla)); }
    catch(e){ p = porImg(d).then(listo, falla); }
  } else p = porImg(d).then(listo, falla);
  return ASSET.img[id] = p;
}
/* textura que existe desde ya (del color medio del asset) y se completa cuando decodifica */
const TEXS = {};
function texAsset(id, o){
  o = o || {}; const k = id + (o.srgb ? ':s' : ':l'); if(TEXS[k]) return TEXS[k];
  const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = o.color || (o.srgb ? '#808080' : (o.normal ? '#8080ff' : '#ffffff')); g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c); t.encoding = o.srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  if(o.repetir !== false){ t.wrapS = t.wrapT = o.espejo ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; }
  t.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy()); t.flipY = o.voltear !== false;
  if(o.sinMips){ t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  const voltear = o.voltear !== false;
  if(ETC2[id] && voltear){ etc2Poner(t, id, !o.sinMips); return TEXS[k] = t; }
  decImagen(id, voltear).then(im=>{ if(!im) return; t.image = im; t.flipY = voltear && !im.__volteada; t.needsUpdate = true; t.__asset = id; });
  return TEXS[k] = t;
}
/* audio: se decodifica recién con el contexto (primer toque); hasta entonces suena lo sintetizado */
const SONIDOS = {};
function decAudios(){
  if(!AC || decAudios.hecho) return; decAudios.hecho = true;
  for(const m of (MAN.aud||[])){ const d = ARCH['aud/' + m.id]; if(!d) continue; ASSET.pend++;
    const decodificar = buf=> AC.decodeAudioData(buf, b=>{ SONIDOS[m.id] = b; ASSET.ok++; alLlegarSonido(m.id); }, ()=> ASSET.fallas.push('aud/' + m.id));
    if(!d.startsWith('data:')){ fetch(d).then(r=> r.arrayBuffer()).then(decodificar, ()=> ASSET.fallas.push('aud/' + m.id)); continue; }
    try{ decodificar(b64Bytes(d).buffer); }
    catch(e){ ASSET.fallas.push('aud/' + m.id); } }
}
function alLlegarSonido(id){ if(typeof MUS !== 'undefined' && id.startsWith('mus_')) MUS.cambio = true; }
/* lo que falta para arrancar: las imágenes que se ven primero (portada) y los mapas de luz horneados; el resto se decodifica cuando algo lo usa */
async function precargar(avance, ids){
  const tareas = (ids||[]).filter(k=> ARCH[k]).map(k=> decImagen(k, false));
  let hechas = 0; const n = tareas.length || 1; if(!tareas.length && avance) avance(1);
  await Promise.all(tareas.map(p=> Promise.resolve(p).then(()=>{ hechas++; if(avance) avance(hechas/n); })));
}
/* al cambiar de tema se sueltan las texturas del mundo que no se usan (GPU y memoria del bitmap) */
function soltarTexturas(prefijo, quedan){
  for(const k in TEXS){ const t = TEXS[k], id = k.slice(0, k.lastIndexOf(':')); if(!id.startsWith(prefijo) || quedan.has(id)) continue;
    t.dispose(); if(t.image && t.image.close) t.image.close(); delete TEXS[k]; delete ASSET.img[id]; }
}
