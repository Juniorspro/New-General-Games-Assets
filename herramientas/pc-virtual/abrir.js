// Abre paginas en un Chromium DE VERDAD sobre un escritorio X virtual y saca
// una captura de la pantalla entera despues de cada una.
//
//   SPDIR=/ruta/al/scratchpad xvfb-run -n 99 -s "-screen 0 1600x900x24" \
//     node abrir.js file:///.../pagina.html
//
// Headful y no headless a proposito: asi la captura muestra la ventana con su
// barra, que es lo que sirve para mandar como prueba de que algo abrio.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');

const SP = process.env.SPDIR;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const urls = process.argv.slice(2);

if (!SP || urls.length === 0) {
  console.error('falta SPDIR o las urls');
  process.exit(1);
}

(async () => {
  const navegador = await chromium.launch({
    headless: false,
    executablePath: CHROME,
    args: ['--window-position=0,0', '--window-size=1600,900'],
  });
  // El viewport va mas chico que la ventana: lo que sobra es el marco del navegador.
  const pagina = await navegador.newPage({ viewport: { width: 1584, height: 750 } });

  for (const [i, url] of urls.entries()) {
    try {
      const r = await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      console.log(url, '->', r && r.status(), '|', await pagina.title());
    } catch (e) {
      console.log(url, '-> FALLO', e.message.split('\n')[0].slice(0, 130));
    }
    await pagina.waitForTimeout(5000);
    const salida = `${SP}/pantalla${String(i + 1).padStart(2, '0')}.png`;
    execFileSync(`${SP}/venv/bin/python`, [`${__dirname}/captura.py`, salida]);
  }

  await navegador.close();
})();
