
/* ====================== modelado por código ======================
   Marco de un arma: el caño apunta a −z, arriba es +y, +x a la derecha. Los perfiles se dibujan de costado en (u adelante, v arriba)
   en metros y se extruden a lo ancho con bisel (bordes redondeados). Las piezas del mismo material se funden en una sola malla. */
const MM = 0.001;
function forma(pts){ const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for(let i=1;i<pts.length;i++){ const p = pts[i]; if(p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); } s.closePath(); return s; }
/* perfil lateral → sólido de 'ancho' centrado en x, con bisel 'b' que no agranda el contorno */
function extruir(pts, ancho, b, segs, agujeros){
  const s = forma(pts); if(agujeros) for(const h of agujeros){ const p = new THREE.Path(); p.moveTo(h[0][0], h[0][1]); for(let i=1;i<h.length;i++) p.lineTo(h[i][0], h[i][1]); p.closePath(); s.holes.push(p); }
  b = Math.min(b || 0, ancho*0.45);
  const g = new THREE.ExtrudeGeometry(s, {depth:Math.max(1e-4, ancho - 2*b), bevelEnabled:b > 0, bevelThickness:b, bevelSize:b, bevelOffset:-b, bevelSegments:segs || 2, curveSegments:8});
  const m = new THREE.Matrix4().set(0, 0, 1, -(ancho - 2*b)/2, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1); g.applyMatrix4(m);
  return g.toNonIndexed ? g : g;
}
/* perfil de revolución [[radio, u]...] alrededor del eje del caño (u adelante) */
function torno(pts, lados){ const v = pts.map(([r, u])=> new THREE.Vector2(Math.max(0, r), u)); const g = new THREE.LatheGeometry(v, lados || 16); g.rotateX(-Math.PI/2); return g; }
function cilindro(r, largo, lados, r2){ const g = new THREE.CylinderGeometry(r2 === undefined ? r : r2, r, largo, lados || 14, 1); g.rotateX(-Math.PI/2); g.translate(0, 0, -largo/2); return g; }
/* caja con esquinas redondeadas (el perfil se redondea en las cuatro esquinas y el bisel redondea los cantos) */
function cajaR(w, h, d, r, b){ r = Math.min(r || 0, w/2, h/2); b = b === undefined ? r*0.6 : b;
  const pts = []; const q = (cx, cy, a0)=>{ for(let i=0;i<=3;i++){ const a = a0 + i*Math.PI/6; pts.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r]); } };
  if(r > 0){ q(d/2 - r, h/2 - r, 0); q(-d/2 + r, h/2 - r, Math.PI/2); q(-d/2 + r, -h/2 + r, Math.PI); q(d/2 - r, -h/2 + r, Math.PI*1.5); }
  else pts.push([d/2, h/2], [-d/2, h/2], [-d/2, -h/2], [d/2, -h/2]);
  return extruir(pts, w, b, 2); }
function caja(w, h, d){ return new THREE.BoxGeometry(w, h, d); }
function mover(g, x, y, z){ g.translate(x, y, z); return g; }
function girar(g, rx, ry, rz){ if(rx) g.rotateX(rx); if(ry) g.rotateY(ry); if(rz) g.rotateZ(rz); return g; }
/* funde geometrías (con o sin índice) en una sola sin índice: posición, normal y uv */
function fundir(geos){
  const lista = geos.filter(Boolean).map(g=> g.index ? g.toNonIndexed() : g); let n = 0; for(const g of lista) n += g.attributes.position.count;
  const P = new Float32Array(n*3), N = new Float32Array(n*3), UV = new Float32Array(n*2); let o = 0;
  for(const g of lista){ if(!g.attributes.normal) g.computeVertexNormals(); const c = g.attributes.position.count;
    P.set(g.attributes.position.array.subarray(0, c*3), o*3); N.set(g.attributes.normal.array.subarray(0, c*3), o*3);
    if(g.attributes.uv) UV.set(g.attributes.uv.array.subarray(0, c*2), o*2); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  out.computeBoundingSphere(); return out;
}
/* uv en metros por proyección de caja (para que las texturas de metal y madera tengan escala real) */
function uvCaja(g, metros){ const p = g.attributes.position, nrm = g.attributes.normal, uv = new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){ const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i)); let a, b;
    if(nx >= ny && nx >= nz){ a = p.getZ(i); b = p.getY(i); } else if(ny >= nz){ a = p.getX(i); b = p.getZ(i); } else { a = p.getX(i); b = p.getY(i); }
    uv[i*2] = a/metros; uv[i*2+1] = b/metros; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }

/* ---------- materiales de armas (PBR; el metal lleva entorno para no salir negro) ---------- */
let ENV_VM = null;
function entornoArmas(){
  if(ENV_VM) return ENV_VM;
  /* un cielo de estudio pintado: techo claro, horizonte cálido y piso oscuro, más dos ventanas de luz para los brillos */
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#cfd9e6'); gr.addColorStop(0.45, '#8b95a3'); gr.addColorStop(0.52, '#5a554e'); gr.addColorStop(1, '#1d1c1b'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(W*0.18, H*0.12, W*0.12, H*0.2); g.fillRect(W*0.62, H*0.08, W*0.2, H*0.12);
  g.fillStyle = 'rgba(255,230,190,0.6)'; g.fillRect(W*0.4, H*0.36, W*0.25, H*0.06);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(ren); ENV_VM = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose(); return ENV_VM;
}
const MAT_A = {};
function texMat(id, rep){ const man = manDe('tex', id); if(man && ARCH['tex/' + id + '/albedo']){ const t = texAsset('tex/' + id + '/albedo', {srgb:true, color:man.color_medio}); return t; } return null; }
function matArma(tipo){
  if(MAT_A[tipo]) return MAT_A[tipo];
  const env = entornoArmas(); let m;
  const def = {
    metal:{color:'#2e3034', metalness:0.75, roughness:0.42, tex:'metal_arma'},
    pavon:{color:'#23262b', metalness:0.8, roughness:0.35, tex:'metal_arma'},
    acero:{color:'#b3b6ba', metalness:0.95, roughness:0.28},
    polimero:{color:'#1d1e21', metalness:0.05, roughness:0.72, tex:'polimero'},
    madera:{color:'#7a3a1c', metalness:0.0, roughness:0.45, tex:'madera_ak', tinte:'#8c6450'},
    bronce:{color:'#c49a45', metalness:1.0, roughness:0.3},
    verde:{color:'#3f5a3a', metalness:0.05, roughness:0.62, tex:'polimero'},
    negro:{color:'#141517', metalness:0.2, roughness:0.6},
    goma:{color:'#1a1a1a', metalness:0.0, roughness:0.9},
    lente:{color:'#1a2a3a', metalness:0.9, roughness:0.08},
    naranja:{color:'#b5561c', metalness:0.1, roughness:0.5},
    oliva:{color:'#4a5236', metalness:0.1, roughness:0.7},
    rojo:{color:'#b3241c', metalness:0.2, roughness:0.5},
    blanco:{color:'#d9d9d4', metalness:0.0, roughness:0.6},
    hoja:{color:'#a9adb2', metalness:1.0, roughness:0.22},
    hojaNegra:{color:'#222428', metalness:0.7, roughness:0.35},
    pantalla:{color:'#2a4a1a', metalness:0.0, roughness:0.3, emisivo:'#6dff4a'},
    oro:{color:'#e2b43c', metalness:1.0, roughness:0.25},
  }[tipo] || {color:'#888', metalness:0.3, roughness:0.5};
  m = new THREE.MeshStandardMaterial({color:lin(def.color), metalness:def.metalness, roughness:def.roughness, envMap:env, envMapIntensity:0.8});
  const t = def.tex && texMat(def.tex); if(t){ m.map = t; m.color.copy(def.tinte ? lin(def.tinte) : new THREE.Color(1, 1, 1)); t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if(def.emisivo){ m.emissive = lin(def.emisivo); m.emissiveIntensity = 1.6; }
  return MAT_A[tipo] = m;
}
/* arma = grupo con piezas que se mueven (cuerpo, cargador, corredera…) y enchufes (Object3D) donde van las manos, la boca, la eyección */
function piezaDe(partes, mat){ const g = fundir(partes); uvCaja(g, 0.18); const m = new THREE.Mesh(g, matArma(mat)); m.castShadow = true; return m; }
function enchufe(grupo, nombre, x, y, z, rx, ry, rz){ const o = new THREE.Object3D(); o.name = nombre; o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); grupo.add(o); return o; }
