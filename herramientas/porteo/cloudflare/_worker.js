// porteo: la puerta de una versión web privada en Cloudflare Pages (la sube subir.py). Es el "modo
// avanzado" de Pages: este worker atiende TODOS los pedidos antes que los archivos, así que sin la
// cookie firmada no sale nada del juego (ni la página ni los bloques): sólo la página para poner la
// clave. Se hace acá y no con Cloudflare Access porque Access hay que activarlo a mano en el panel
// de la cuenta; si está, conviene Access.
//
// La clave es un secreto del proyecto (CLAVE, lo pone subir.py) y nunca va en el repo. La cookie es
// el vencimiento firmado con HMAC usando la clave: no se guarda nada en el servidor, y cambiar la
// clave cierra todas las sesiones de una.
//
// Pasan sin clave sólo el service worker, el manifest y los íconos: para instalar la app el
// navegador los puede pedir sin cookies, y no tienen nada del juego.
const COOKIE = 'porteo';
const DURA = 365 * 24 * 3600;   // un año: instalada, la app arranca sin red y no vuelve a pedir la clave
const ENTRAR = '/__entrar';
// lo que cuenta la página (qué teléfono, si hay WebGL 2, hasta dónde llegó, los errores): va a los
// registros del worker ("wrangler pages deployment tail", que con muchos pedidos juntos se saltea
// algunos) y, si el proyecto tiene un KV atado como REGISTRO, también ahí (14 días; lo lee
// registro.py). Sólo con sesión
const REGISTRO = '/__registro';
const DURA_REGISTRO = 14 * 24 * 3600;
const LIBRES = new Set(['/sw.js', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png']);

const utf8 = new TextEncoder();
async function firmar(clave, que) {
  const k = await crypto.subtle.importKey('raw', utf8.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = new Uint8Array(await crypto.subtle.sign('HMAC', k, utf8.encode(que)));
  let s = '';
  for (const b of f) s += b.toString(16).padStart(2, '0');
  return s;
}

// compara sin cortar en la primera diferencia: el tiempo no dice cuánto coincide
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// la clave se escribe como sea: con guiones, espacios o mayúsculas
const normal = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

async function sesionValida(req, clave) {
  const m = /(?:^|;\s*)porteo=(\d{1,12})\.([0-9a-f]{64})(?:;|$)/.exec(req.headers.get('Cookie') || '');
  if (!m || Number(m[1]) * 1000 < Date.now()) return false;
  return iguales(m[2], await firmar(clave, 'sesion|' + m[1]));
}

const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Privado</title>
<style>
  :root { --fondo: #f6f7f9; --texto: #1d2129; --suave: #5b6472; --acento: #d6336c; --borde: #d7dbe2; --campo: #fff; --error: #c92a2a; }
  @media (prefers-color-scheme: dark) { :root { --fondo: #15181d; --texto: #e8eaed; --suave: #a0a8b4; --acento: #f06595; --borde: #2c323b; --campo: #1f242b; --error: #ff8787; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box;
         background: var(--fondo); color: var(--texto); font: 16px/1.5 system-ui, sans-serif; }
  main { width: 100%; max-width: 360px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p { margin: 0 0 18px; color: var(--suave); }
  input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid var(--borde); border-radius: 10px;
          background: var(--campo); color: var(--texto); font: inherit; letter-spacing: .04em; }
  button { width: 100%; margin-top: 12px; padding: 12px; border: 0; border-radius: 10px; background: var(--acento);
           color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  .error { color: var(--error); margin: 10px 0 0; }
</style>
</head>
<body>
<main>
  <h1>Página privada</h1>
  <p>Poné la clave para entrar. Queda guardada en este navegador.</p>
  <form method="post" action="${ENTRAR}">
    <input name="clave" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" aria-label="Clave" required autofocus>
    <button type="submit">Entrar</button>
    <!--ERROR-->
  </form>
</main>
<script>
  // el enlace con la clave después del # (no viaja al servidor ni queda en sus registros): entra solo
  var m = /[#&]clave=([^&]+)/.exec(location.hash);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    var f = document.querySelector('form');
    f.clave.value = decodeURIComponent(m[1]);
    f.submit();
  }
</script>
</body>
</html>
`;

const CERRADO = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

function pagina(error) {
  const html = error ? PAGINA.replace('<!--ERROR-->', '<p class="error" role="alert">Esa no es la clave.</p>') : PAGINA;
  return new Response(html, { status: 401, headers: CERRADO });
}

export default {
  async fetch(req, env, ctx) {
    const clave = normal(env.CLAVE);
    // sin clave configurada no se abre nada (mejor cerrado que abierto por un descuido)
    if (clave.length < 12) {
      return new Response('Falta configurar la clave (CLAVE) del proyecto.', { status: 503, headers: CERRADO });
    }
    const url = new URL(req.url);

    if (url.pathname === ENTRAR) {
      if (req.method !== 'POST') return new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store' } });
      let intento = '';
      try { intento = (await req.formData()).get('clave'); } catch (e) { /* sin formulario: clave vacía */ }
      // se comparan las firmas y no las claves: mismo largo siempre
      if (iguales(await firmar(clave, 'clave|' + normal(intento)), await firmar(clave, 'clave|' + clave))) {
        const vence = Math.floor(Date.now() / 1000) + DURA;
        const cookie = `${COOKIE}=${vence}.${await firmar(clave, 'sesion|' + vence)}; Path=/; Max-Age=${DURA}; HttpOnly; Secure; SameSite=Lax`;
        return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
      }
      // probar claves de a montones, no
      await new Promise((ok) => setTimeout(ok, 700));
      return pagina(true);
    }

    const libre = LIBRES.has(url.pathname);
    if (!libre && !(await sesionValida(req, clave))) return pagina(false);

    if (url.pathname === REGISTRO) {
      if (req.method === 'POST') {
        const texto = (await req.text()).slice(0, 16384);
        console.log('porteo-registro ' + texto);
        // la clave ordena por fecha; el teléfono va aparte para saber de quién es cada línea
        if (env.REGISTRO) {
          const clave = Date.now().toString(36).padStart(9, '0') + '-' + Math.random().toString(36).slice(2, 6);
          const meta = { ua: (req.headers.get('User-Agent') || '').slice(0, 200) };
          ctx.waitUntil(env.REGISTRO.put(clave, texto, { expirationTtl: DURA_REGISTRO, metadata: meta }).catch(() => {}));
        }
      }
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    const r = await env.ASSETS.fetch(req);
    const h = new Headers(r.headers);
    h.set('X-Robots-Tag', 'noindex, nofollow');
    // los bloques llevan el hash en el nombre: no cambian nunca. "private": que no los guarde
    // ningún caché compartido, sólo el navegador de quien tiene la clave
    if (url.pathname.startsWith('/b/') && r.status === 200) h.set('Cache-Control', 'private, max-age=31536000, immutable');
    else h.set('Cache-Control', libre ? 'no-cache' : 'private, no-cache');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  },
};
