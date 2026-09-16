// Genera el visor de la biblioteca a partir de catalogo.json.
//   node construir.mjs           -> index.html (enlaza ./img, alta resolución)
//   node construir.mjs --embebido -> galeria.html (miniaturas incrustadas, un solo archivo)
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const EMBEBIDO = process.argv.includes('--embebido');
const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'catalogo.json'), 'utf8'))
  .filter((r) => r.estado === 'ok' || r.estado === 'ya-estaba')
  .filter((r) => fs.existsSync(path.join(RAIZ, 'img', `${r.id}.webp`)));

const FAMILIAS = {
  '3d-webgl': ['3D y WebGL', 'Geometría en tiempo real, cámaras, materiales'],
  'animacion': ['Animación', 'Scroll, transiciones, cursores, movimiento como argumento'],
  'producto-saas': ['Producto y SaaS', 'La familia más copiada; mira qué la separa del montón'],
  'dev-docs': ['Herramientas y docs', 'Densidad de información bien resuelta'],
  'movil-android': ['Móvil y Android', 'Con captura de escritorio y de teléfono'],
  'marca-editorial': ['Marca y editorial', 'Tipografía como estructura, no como relleno'],
  'galerias': ['Galerías', 'De aquí sale la próxima tanda de referencias'],
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (p) => fs.readFileSync(p).toString('base64');

function fuenteImg(r, movil = false) {
  const dir = movil ? 'movil' : EMBEBIDO ? 'thumb' : 'img';
  const rel = `${dir}/${r.id}.webp`;
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return null;
  return EMBEBIDO ? `data:image/webp;base64,${b64(abs)}` : rel;
}

const porFamilia = {};
for (const r of catalogo) (porFamilia[r.familia] ||= []).push(r);

const tarjetas = (lista) => lista.map((r) => {
  const src = fuenteImg(r);
  if (!src) return '';
  const mv = fuenteImg(r, true);
  const paleta = [r.fondo, ...(r.acentos || [])].filter(Boolean).slice(0, 5)
    .map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('');
  const fuentes = [r.fuenteTitular, r.fuenteCuerpo].filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 2)
    .map((f) => `<span class="fuente">${esc(f)}</span>`).join('');
  return `<article class="ficha" data-fam="${esc(r.familia)}" data-buscar="${esc((r.nombre + ' ' + (r.fuenteTitular || '') + ' ' + (r.fuenteCuerpo || '') + ' ' + (r.descripcion || '')).toLowerCase())}">
  <a class="lienzo" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
    <img src="${src}" alt="Captura de ${esc(r.nombre)}" loading="lazy" width="1440" height="900">
    ${mv ? `<img class="tel" src="${mv}" alt="${esc(r.nombre)} en Android" loading="lazy">` : ''}
  </a>
  <div class="pie">
    <div class="fila"><h3>${esc(r.nombre)}</h3><span class="paleta">${paleta}</span></div>
    <div class="meta">${fuentes || '<span class="fuente vacia">sin datos de tipografía</span>'}</div>
    <a class="url" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url.replace(/^https?:\/\//, ''))} ↗</a>
  </div>
</article>`;
}).join('\n');

const secciones = Object.entries(FAMILIAS)
  .filter(([k]) => porFamilia[k]?.length)
  .map(([k, [titulo, sub]]) => `<section class="familia" id="${k}">
  <header class="cab"><h2>${esc(titulo)}</h2><p>${esc(sub)}</p><span class="cuenta">${porFamilia[k].length}</span></header>
  <div class="rejilla">${tarjetas(porFamilia[k])}</div>
</section>`).join('\n');

const filtros = Object.entries(FAMILIAS).filter(([k]) => porFamilia[k]?.length)
  .map(([k, [t]]) => `<button class="f" data-f="${k}">${esc(t)} <b>${porFamilia[k].length}</b></button>`).join('');

const conMovil = catalogo.filter((r) => fuenteImg(r, true)).length;

const html = `<title>Biblioteca de Estilos</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --fondo:#101011; --panel:#181819; --panel2:#202022; --linea:#2c2c2e;
  --tinta:#EDEDEA; --tinta2:#9C9C99; --tinta3:#6B6B69;
  --acento:#C6FF4F;
  --display:"Archivo","Helvetica Neue",Arial,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
:root[data-theme="light"]{
  --fondo:#EFEFEC; --panel:#FFFFFF; --panel2:#E4E4E0; --linea:#D3D3CE;
  --tinta:#131313; --tinta2:#5B5B58; --tinta3:#87877F;
  --acento:#4B6B00;
}
@media (prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --fondo:#EFEFEC; --panel:#FFFFFF; --panel2:#E4E4E0; --linea:#D3D3CE;
    --tinta:#131313; --tinta2:#5B5B58; --tinta3:#87877F;
    --acento:#4B6B00;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--tinta);font-family:var(--mono);font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--acento);outline-offset:2px}
.marco{max-width:1680px;margin:0 auto;padding:0 clamp(14px,2.4vw,30px)}

header.top{position:sticky;top:0;z-index:20;background:var(--fondo);border-bottom:1px solid var(--linea)}
header.top .marco{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding-top:14px;padding-bottom:14px}
.logo{font-family:var(--display);font-weight:900;font-stretch:118%;text-transform:uppercase;font-size:17px;letter-spacing:.02em;display:flex;align-items:center;gap:9px}
.logo i{width:9px;height:9px;background:var(--acento);display:block}
.dato{color:var(--tinta3);font-size:11px;letter-spacing:.09em;text-transform:uppercase}
.sp{flex:1}
input[type=search]{
  font-family:var(--mono);font-size:12.5px;padding:8px 11px;min-width:210px;
  background:var(--panel);color:var(--tinta);border:1px solid var(--linea);border-radius:2px;
}
input[type=search]::placeholder{color:var(--tinta3)}
.tema{background:var(--panel);border:1px solid var(--linea);color:var(--tinta2);border-radius:2px;padding:8px 11px;font:inherit;cursor:pointer}
.tema:hover{color:var(--acento);border-color:var(--acento)}

.filtros{display:flex;gap:7px;flex-wrap:wrap;padding:14px 0 4px}
.f{
  font-family:var(--mono);font-size:11.5px;padding:7px 11px;cursor:pointer;
  background:transparent;color:var(--tinta2);border:1px solid var(--linea);border-radius:2px;
}
.f b{color:var(--tinta3);font-weight:500;margin-left:3px}
.f:hover{color:var(--tinta);border-color:var(--tinta3)}
.f[aria-pressed="true"]{background:var(--acento);color:#101011;border-color:var(--acento)}
.f[aria-pressed="true"] b{color:#101011;opacity:.65}

.familia{padding:34px 0 0}
.cab{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--linea);padding-bottom:9px;margin-bottom:16px}
.cab h2{font-family:var(--display);font-weight:800;font-stretch:106%;font-size:15px;text-transform:uppercase;letter-spacing:.05em;margin:0}
.cab p{margin:0;color:var(--tinta3);font-size:12px}
.cab .cuenta{margin-left:auto;color:var(--acento);font-size:12px}

.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
.ficha{background:var(--panel);border:1px solid var(--linea);display:flex;flex-direction:column;overflow:hidden;transition:border-color .14s}
.ficha:hover{border-color:var(--acento)}
.lienzo{position:relative;display:block;aspect-ratio:16/10;background:var(--panel2);overflow:hidden;text-decoration:none}
.lienzo img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;transition:transform .5s cubic-bezier(.2,.7,.3,1)}
.ficha:hover .lienzo img:first-child{transform:scale(1.035)}
img.tel{
  position:absolute;right:11px;bottom:11px;width:19%;height:auto;aspect-ratio:9/19.5;
  object-fit:cover;object-position:top center;border:1.5px solid rgba(0,0,0,.5);
  border-radius:5px;box-shadow:0 6px 18px rgba(0,0,0,.5);background:var(--panel);
}
.pie{padding:11px 13px 13px;display:flex;flex-direction:column;gap:6px}
.fila{display:flex;align-items:center;gap:10px}
.pie h3{font-family:var(--display);font-weight:700;font-size:14.5px;margin:0;letter-spacing:-.01em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.paleta{display:flex;gap:3px;flex:none}
.paleta i{width:13px;height:13px;display:block;border:1px solid rgba(128,128,128,.35)}
.meta{display:flex;gap:5px;flex-wrap:wrap}
.fuente{font-size:10.5px;color:var(--tinta2);background:var(--panel2);padding:2px 6px;border-radius:2px}
.fuente.vacia{color:var(--tinta3);background:transparent;padding-left:0}
.url{font-size:11px;color:var(--tinta3);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ficha:hover .url{color:var(--acento)}
.oculto{display:none !important}
.nada{color:var(--tinta3);padding:40px 0;text-align:center}

footer{border-top:1px solid var(--linea);margin-top:46px;padding:20px 0 60px;color:var(--tinta3);font-size:11.5px;line-height:1.7}
footer b{color:var(--tinta2);font-weight:500}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<header class="top"><div class="marco">
  <div class="logo"><i></i>Biblioteca de Estilos</div>
  <div class="dato">${catalogo.length} sitios · ${conMovil} con vista Android</div>
  <div class="sp"></div>
  <input type="search" id="q" placeholder="Buscar sitio o tipografía…" aria-label="Buscar">
  <button class="tema" id="tema" type="button">◐ Tema</button>
</div></header>

<main class="marco">
  <div class="filtros"><button class="f" data-f="*" aria-pressed="true">Todos <b>${catalogo.length}</b></button>${filtros}</div>
  ${secciones}
  <p class="nada oculto" id="nada">Nada coincide con esa búsqueda.</p>
  <footer>
    <b>Cómo usarla.</b> Cada ficha es una captura real del sitio en vivo, tomada con Playwright, más la
    paleta y las tipografías leídas del CSS de la propia página. Elige una familia, roba el vocabulario
    —no el diseño— y pásalo como <i>Estética</i> y <i>Referencia</i> en el prompt de cuatro partes.<br>
    <b>Vista Android.</b> Las fichas de la familia móvil llevan la captura de teléfono superpuesta,
    tomada con un Pixel 7 emulado.<br>
    Capturado el ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}.
    Los sitios cambian: vuelve a correr <code>capturar.mjs</code> para refrescar.
  </footer>
</main>

<script>
(function(){
  const fichas = [...document.querySelectorAll('.ficha')];
  const familias = [...document.querySelectorAll('.familia')];
  const botones = [...document.querySelectorAll('.f')];
  const q = document.getElementById('q');
  const nada = document.getElementById('nada');
  let fam = '*';

  function pintar(){
    const t = q.value.trim().toLowerCase();
    let visibles = 0;
    for (const f of fichas){
      const ok = (fam === '*' || f.dataset.fam === fam) && (!t || f.dataset.buscar.includes(t));
      f.classList.toggle('oculto', !ok);
      if (ok) visibles++;
    }
    for (const s of familias){
      s.classList.toggle('oculto', !s.querySelectorAll('.ficha:not(.oculto)').length);
    }
    nada.classList.toggle('oculto', visibles > 0);
  }

  for (const b of botones){
    b.addEventListener('click', () => {
      fam = b.dataset.f;
      botones.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      pintar();
    });
  }
  q.addEventListener('input', pintar);

  const raiz = document.documentElement;
  document.getElementById('tema').addEventListener('click', () => {
    const oscuro = getComputedStyle(raiz).getPropertyValue('--fondo').trim().startsWith('#1');
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
  });
})();
</script>`;

const destino = path.join(RAIZ, EMBEBIDO ? 'galeria.html' : 'index.html');
fs.writeFileSync(destino, html);
const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(2);
console.log(`${path.basename(destino)} · ${catalogo.length} fichas · ${conMovil} con Android · ${mb} MB`);
