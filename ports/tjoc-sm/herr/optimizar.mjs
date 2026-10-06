// Optimiza las mallas de web/datos: simplifica las pesadas (meshoptimizer, sólo reescribe índices: UV y piel intactos)
// y cuantiza posiciones a Int16 (meta.q = [escala x3, origen x3]). Idempotente: salta mallas ya optimizadas.
import fs from 'node:fs';
import path from 'node:path';
const { MeshoptSimplifier: S } = await import('/home/user/New-General-Games-Assets/bosque/node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js');
await S.ready;
const DATOS = process.argv[2];
const idx = JSON.parse(fs.readFileSync(path.join(DATOS, 'mallas.json'), 'utf8'));
let antes = 0, despues = 0, n = 0;
const objetivo = (tris, skel) => (tris > 100000 ? 0.25 : tris > 30000 ? 0.3 : tris > 15000 ? 0.4 : tris > 6000 ? 0.55 : tris > 2500 ? 0.75 : 1) * (skel ? 1.15 : 1);
function procesar(meta, archivo) {
  const buf = fs.readFileSync(archivo); antes += buf.length;
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const o = meta.off, nv = meta.nv;
  const pos = new Float32Array(ab, o.pos, nv * 3);
  const nor = new Int8Array(ab, o.nor, nv * 4);
  const uv = new Uint16Array(ab, o.uv, nv * 2);
  const uv2 = o.uv2 !== undefined ? new Uint16Array(ab, o.uv2, nv * 2) : null;
  const hi = o.hi !== undefined ? (meta.hi16 ? new Uint16Array(ab, o.hi, nv * 4) : new Uint8Array(ab, o.hi, nv * 4)) : null;
  const pw = o.pw !== undefined ? new Uint8Array(ab, o.pw, nv * 4) : null;
  const ind = meta.i32 ? new Uint32Array(ab, o.idx, meta.ni) : new Uint16Array(ab, o.idx, meta.ni);
  // atributos para el simplificador: UV y normal (respeta costuras sin bloquearlas)
  const h2f = (h) => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * 5.96e-8 * f : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024); };
  const AT = new Float32Array(nv * 5);
  for (let v = 0; v < nv; v++) { AT[v * 5] = h2f(uv[v * 2]); AT[v * 5 + 1] = h2f(uv[v * 2 + 1]); AT[v * 5 + 2] = nor[v * 4] / 127; AT[v * 5 + 3] = nor[v * 4 + 1] / 127; AT[v * 5 + 4] = nor[v * 4 + 2] / 127; }
  // simplificar por sección
  const tris = meta.ni / 3, k = objetivo(tris, meta.tipo === 'skel');
  const nuevos = []; const secs = [];
  for (const [ini, cant, mi] of meta.secs) {
    let sub = new Uint32Array(ind.subarray(ini, ini + cant));
    if (k < 1 && cant > 300) {
      const meta_ = Math.max(36, Math.floor((cant * k) / 3) * 3);
      const [r] = S.simplifyWithAttributes(sub, pos, 3, AT, 5, [0.6, 0.6, 0.25, 0.25, 0.25], null, meta_, tris > 100000 ? 0.06 : 0.025, []);
      if (r.length >= 3) sub = r;
    }
    secs.push([nuevos.length, sub.length, mi]); for (let q = 0; q < sub.length; q++) nuevos.push(sub[q]);
  }
  // compactar vértices usados
  const mapa = new Int32Array(nv).fill(-1); let nn = 0;
  const I = new Uint32Array(nuevos.length);
  for (let i = 0; i < nuevos.length; i++) { const v = nuevos[i]; if (mapa[v] < 0) mapa[v] = nn++; I[i] = mapa[v]; }
  const vieja = new Int32Array(nn); for (let v = 0; v < nv; v++) if (mapa[v] >= 0) vieja[mapa[v]] = v;
  // cuantizar posiciones
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let j = 0; j < nn; j++) for (let c = 0; c < 3; c++) { const x = pos[vieja[j] * 3 + c]; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; }
  const esc = [0, 1, 2].map((c) => Math.max(1e-6, (mx[c] - mn[c]) / 65534)), org = [0, 1, 2].map((c) => (mx[c] + mn[c]) / 2);
  const partes = []; const off = {}; let tam = 0;
  const agregar = (k2, arr) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (tam % 4)) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; } off[k2] = tam; partes.push(Buffer.from(b)); tam += b.length; };
  const P = new Int16Array(nn * 4);
  for (let j = 0; j < nn; j++) for (let c = 0; c < 3; c++) P[j * 4 + c] = Math.round((pos[vieja[j] * 3 + c] - org[c]) / esc[c]);
  agregar('posq', P);
  const N = new Int8Array(nn * 4); for (let j = 0; j < nn; j++) for (let c = 0; c < 4; c++) N[j * 4 + c] = nor[vieja[j] * 4 + c]; agregar('nor', N);
  const U = new Uint16Array(nn * 2); for (let j = 0; j < nn; j++) { U[j * 2] = uv[vieja[j] * 2]; U[j * 2 + 1] = uv[vieja[j] * 2 + 1]; } agregar('uv', U);
  if (uv2) { const U2 = new Uint16Array(nn * 2); for (let j = 0; j < nn; j++) { U2[j * 2] = uv2[vieja[j] * 2]; U2[j * 2 + 1] = uv2[vieja[j] * 2 + 1]; } agregar('uv2', U2); }
  if (hi) { const H = meta.hi16 ? new Uint16Array(nn * 4) : new Uint8Array(nn * 4); const W = new Uint8Array(nn * 4); for (let j = 0; j < nn; j++) for (let c = 0; c < 4; c++) { H[j * 4 + c] = hi[vieja[j] * 4 + c]; W[j * 4 + c] = pw[vieja[j] * 4 + c]; } agregar('hi', H); agregar('pw', W); }
  const i32 = nn > 65535; agregar('idx', i32 ? I : Uint16Array.from(I));
  const out = Buffer.concat(partes); fs.writeFileSync(archivo, out); despues += out.length;
  Object.assign(meta, { nv: nn, ni: I.length, off, i32, secs, q: [...esc, ...org], opt: 1 });
  n++;
}
for (const [r, m] of Object.entries(idx)) {
  if (m.opt) continue;
  const f = path.join(DATOS, m.archivo); if (!fs.existsSync(f)) continue;
  procesar(m, f);
}
fs.writeFileSync(path.join(DATOS, 'mallas.json'), JSON.stringify(idx));
// mallas BSP de los niveles
for (const f of fs.readdirSync(path.join(DATOS, 'n'))) {
  if (!f.endsWith('.json')) continue;
  const N = JSON.parse(fs.readFileSync(path.join(DATOS, 'n', f), 'utf8')); let cambio = false;
  for (const b of N.bsp || []) if (!b.malla.opt) { const ft = path.join(DATOS, b.malla.archivo); if (fs.existsSync(ft)) { const kk = objetivo; void kk; procesar(b.malla, ft); cambio = true; } }
  if (cambio) fs.writeFileSync(path.join(DATOS, 'n', f), JSON.stringify(N));
}
console.log(`mallas optimizadas: ${n}, ${(antes / 1e6).toFixed(1)} MB → ${(despues / 1e6).toFixed(1)} MB`);
