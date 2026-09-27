
/* ====================== texturas ETC2 (la APK) ======================
   En la APK las texturas de materiales y el cielo vienen ya comprimidas en ETC2 (herramientas/etc2.py): la placa las lee así, sin
   descomprimir. Una de 1024 con sus mips ocupa 0,67 MB en vez de 5,3 (ocho veces menos memoria y ocho veces menos que leer por
   píxel), no hay que decodificar el webp ni armar los mips al cargar, y un teléfono con poca memoria no las achica a 512.
   Archivo .etc2: 'ETC2', ancho y alto (u16), cuántos niveles (u8), y los niveles seguidos (bloques de 4×4 en 8 bytes, del más
   grande al de 1×1). Si la placa no sabe ETC2 (algún teléfono muy viejo, WebGL 1), se descomprime acá a RGBA. */
const ETC2_T = [3, 6, 11, 16, 23, 32, 41, 64], ETC1_T = [[2, 8, -2, -8], [5, 17, -5, -17], [9, 29, -9, -29], [13, 42, -13, -42], [18, 60, -18, -60], [24, 80, -24, -80], [33, 106, -33, -106], [47, 183, -47, -183]];
function etc2Leer(buf){ const u = new Uint8Array(buf), dv = new DataView(buf);
  if(u[0] !== 69 || u[1] !== 84 || u[2] !== 67 || u[3] !== 50) return null;
  const w = dv.getUint16(4, true), h = dv.getUint16(6, true), n = u[8], mips = []; let o = 16;
  for(let l=0;l<n;l++){ const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l), b = Math.ceil(lw/4)*Math.ceil(lh/4)*8; mips.push({data:new Uint8Array(buf, o, b), width:lw, height:lh}); o += b; }
  return {w, h, mips}; }
/* un bloque (8 bytes desde 'o') a los 16 píxeles RGBA de 'px' (ancho W), en (bx, by) */
function etc2Bloque(d, o, px, W, H, bx, by){
  const lo = (d[o] << 24 | d[o+1] << 16 | d[o+2] << 8 | d[o+3]) >>> 0, hi = (d[o+4] << 24 | d[o+5] << 16 | d[o+6] << 8 | d[o+7]) >>> 0;
  const c8 = v=> v < 0 ? 0 : v > 255 ? 255 : v, pon = (x, y, r, g, b)=>{ const X = bx + x, Y = by + y; if(X >= W || Y >= H) return; const k = (Y*W + X)*4; px[k] = c8(r); px[k+1] = c8(g); px[k+2] = c8(b); px[k+3] = 255; };
  const idx2 = (x, y)=> (((hi >>> (y + x*4 + 16)) & 1) << 1) | ((hi >>> (y + x*4)) & 1);
  let br0, br1, bg0, bg1, bb0, bb1;
  if(lo & 2){
    const r0 = (lo >>> 27) & 31, g0 = (lo >>> 19) & 31, b0 = (lo >>> 11) & 31, r1 = r0 + ((lo << 5) >> 29), g1 = g0 + ((lo << 13) >> 29), b1 = b0 + ((lo << 21) >> 29);
    if(r1 < 0 || r1 > 31){   /* T */
      const r = (lo >>> 24) & 0x1B, rr = ((r >> 3) & 3) << 2 | (r & 3), C0 = [rr*17, ((lo >>> 20) & 15)*17, ((lo >>> 16) & 15)*17], C1 = [((lo >>> 12) & 15)*17, ((lo >>> 8) & 15)*17, ((lo >>> 4) & 15)*17];
      const dd = ETC2_T[(((lo >>> 2) & 3) << 1) | (lo & 1)], P = [C0, C1.map(v=> c8(v + dd)), C1, C1.map(v=> c8(v - dd))];
      for(let x=0;x<4;x++) for(let y=0;y<4;y++){ const c = P[idx2(x, y)]; pon(x, y, c[0], c[1], c[2]); } return; }
    if(g1 < 0 || g1 > 31){   /* H */
      const R0 = (lo >>> 27) & 15, G0 = ((lo >>> 20) & 1) | (((lo >>> 24) & 7) << 1), B0 = ((lo >>> 15) & 7) | (((lo >>> 19) & 1) << 3), R1 = (lo >>> 11) & 15, G1 = (lo >>> 7) & 15, B1 = (lo >>> 3) & 15;
      const cw = (((lo & 1) << 1) | (lo & 4)) | (((R0 << 8) | (G0 << 4) | B0) >= ((lo >>> 3) & 0xFFF) ? 1 : 0), dd = ETC2_T[cw];
      const C0 = [R0*17, G0*17, B0*17], C1 = [R1*17, G1*17, B1*17], P = [C0.map(v=> v + dd), C0.map(v=> v - dd), C1.map(v=> v + dd), C1.map(v=> v - dd)];
      for(let x=0;x<4;x++) for(let y=0;y<4;y++){ const c = P[idx2(x, y)]; pon(x, y, c[0], c[1], c[2]); } return; }
    if(b1 < 0 || b1 > 31){   /* plano */
      const e6 = v=> (v << 2) | (v >> 4), e7 = v=> (v << 1) | (v >> 6);
      const bv = e6(hi & 63), gv = e7((hi >>> 6) & 127), rv = e6((hi >>> 13) & 63), bh = e6((hi >>> 19) & 63), gh = e7((hi >>> 25) & 127);
      const rh = e6((lo & 1) | (((lo >>> 2) & 31) << 1)), bo = e6(((lo >>> 7) & 7) | (((lo >>> 11) & 3) << 3) | (((lo >>> 16) & 1) << 5)), go = e7(((lo >>> 17) & 63) | (((lo >>> 24) & 1) << 6)), ro = e6((lo >>> 25) & 63);
      for(let y=0;y<4;y++) for(let x=0;x<4;x++) pon(x, y, (x*(rh - ro) + y*(rv - ro) + 4*ro + 2) >> 2, (x*(gh - go) + y*(gv - go) + 4*go + 2) >> 2, (x*(bh - bo) + y*(bv - bo) + 4*bo + 2) >> 2);
      return; }
    br0 = (r0 << 3) | (r0 >> 2); br1 = (r1 << 3) | (r1 >> 2); bg0 = (g0 << 3) | (g0 >> 2); bg1 = (g1 << 3) | (g1 >> 2); bb0 = (b0 << 3) | (b0 >> 2); bb1 = (b1 << 3) | (b1 >> 2);
  } else { br0 = ((lo >>> 28) & 15)*17; br1 = ((lo >>> 24) & 15)*17; bg0 = ((lo >>> 20) & 15)*17; bg1 = ((lo >>> 16) & 15)*17; bb0 = ((lo >>> 12) & 15)*17; bb1 = ((lo >>> 8) & 15)*17; }
  const tc = [(lo >>> 5) & 7, (lo >>> 2) & 7], voltea = lo & 1;
  for(let x=0;x<4;x++) for(let y=0;y<4;y++){ const s = voltea ? y >> 1 : x >> 1, m = ETC1_T[tc[s]][idx2(x, y)];
    pon(x, y, (s ? br1 : br0) + m, (s ? bg1 : bg0) + m, (s ? bb1 : bb0) + m); }
}
function etc2ARGBA(d, w, h){ const px = new Uint8Array(w*h*4), bw = Math.ceil(w/4), bh = Math.ceil(h/4);
  for(let j=0;j<bh;j++) for(let i=0;i<bw;i++) etc2Bloque(d, (j*bw + i)*8, px, w, h, i*4, j*4); return px; }
/* la textura 't' (la que ya usan los materiales, con el color medio mientras tanto) pasa a ser la ETC2 cuando llega. Sin ETC2 en la
   placa se descomprime el nivel que entra en TEX_MAX. Subida la textura, los bloques se sueltan: son de 0,2 a 0,7 MB cada una y la
   placa ya los tiene (si se pierde el contexto, el juego se recarga: ver 04-render) */
let _etc2Placa = null;
function etc2Placa(){ if(_etc2Placa === null) _etc2Placa = typeof ren !== 'undefined' && !!ren.extensions.get('WEBGL_compressed_texture_etc'); return _etc2Placa; }
function etc2Poner(t, id, conMips){
  ASSET.pend++;
  fetch(ETC2[id]).then(r=> r.arrayBuffer()).then(etc2Leer).then(E=>{
    if(!E) throw new Error('etc2');
    ASSET.ok++; t.flipY = false; t.__asset = id;
    if(etc2Placa()){
      t.isCompressedTexture = true; t.format = THREE.RGB_ETC2_Format; t.generateMipmaps = false; t.image = {width:E.w, height:E.h};
      t.mipmaps = conMips ? E.mips : [E.mips[0]]; if(!conMips) t.minFilter = THREE.LinearFilter;
      t.onUpdate = ()=>{ t.mipmaps = []; t.onUpdate = null; };
    } else {
      let l = 0; while(l < E.mips.length - 1 && Math.max(E.mips[l].width, E.mips[l].height) > TEX_MAX) l++;
      const m = E.mips[l]; t.image = new ImageData(new Uint8ClampedArray(etc2ARGBA(m.data, m.width, m.height).buffer), m.width, m.height);
    }
    t.needsUpdate = true;
  }).catch(()=>{ ASSET.fallas.push(id);
    if(ARCH[id]) decImagen(id, true).then(im=>{ if(!im) return; t.image = im; t.flipY = !im.__volteada; t.needsUpdate = true; t.__asset = id; }); });
}
