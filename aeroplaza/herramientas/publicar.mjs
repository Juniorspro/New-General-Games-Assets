// node herramientas/publicar.mjs [--notas "qué cambió"]
// (vuelta 45) PUBLICA UNA ACTUALIZACIÓN para la APK (Actualizador.java), sin mandar una APK nueva. Escribe
// aeroplaza/actualizacion.json, el aviso que la APK busca al abrirse:
//   { n, fecha, notas, apkMin, apk: { codigo }, html: { url, sha256, bytes }, fuentes }
// - html.url va fijado al COMMIT donde está este aeroplaza.html (raw.githubusercontent.com/…/<commit>/…): lo que se
//   siga subiendo a la rama no cambia lo publicado, y la APK verifica el sha256 y los bytes;
// - n sube de a uno; apk.codigo es el versionCode de android/app/build.gradle (si es más que el de la APK instalada,
//   el juego ofrece bajar la app nueva: eso hace falta solo cuando cambió lo de Java).
// Antes: aeroplaza.html armado (herramientas/armar.mjs) y commiteado, sin cambios sin commitear.
// Después: commitear actualizacion.json y subirlo a la rama que lee la APK (Actualizador.java › FUENTES).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);
const REPO = 'Juniorspro/New-General-Games-Assets';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' }).trim();
const args = process.argv.slice(2), i = args.indexOf('--notas'), notas = i >= 0 ? String(args[i + 1] || '').slice(0, 300) : '';

const HTML = path.join(RAIZ, 'aeroplaza.html'), AVISO = path.join(RAIZ, 'actualizacion.json');
if (git('status', '--porcelain', '--', 'aeroplaza.html')) { console.log('✗ aeroplaza.html tiene cambios sin commitear: commitealo primero'); process.exit(1); }
const commit = git('log', '-1', '--format=%H', '--', 'aeroplaza.html');
/* (lo que se publica es lo que está en ese commit: se compara con el archivo) */
const enCommit = execFileSync('git', ['show', `${commit}:aeroplaza/aeroplaza.html`], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 });
const b = fs.readFileSync(HTML);
if (!enCommit.equals(b)) { console.log('✗ aeroplaza.html no es el del commit ' + commit.slice(0, 8)); process.exit(1); }
const antes = fs.existsSync(AVISO) ? JSON.parse(fs.readFileSync(AVISO, 'utf8')) : { n: 0 };
const sha = createHash('sha256').update(b).digest('hex');
if (antes.html?.sha256 === sha) { console.log(`= ya está publicado (n ${antes.n}, ${sha.slice(0, 12)})`); process.exit(0); }
const gradle = fs.readFileSync(path.join(RAIZ, 'android/app/build.gradle'), 'utf8');
const codigo = +(gradle.match(/versionCode\s+(\d+)/) || [])[1] || 1;
const aviso = {
  n: (antes.n || 0) + 1,
  fecha: new Date().toISOString().slice(0, 10),
  notas,
  /* (la APK más vieja que puede usar este juego: el juego pregunta antes de usar lo nuevo de Java, así que 1) */
  apkMin: 1,
  apk: { codigo },
  html: { url: `https://raw.githubusercontent.com/${REPO}/${commit}/aeroplaza/aeroplaza.html`, sha256: sha, bytes: b.length },
  /* dónde buscar la próxima vez (para mudar el canal sin APK nueva) */
  fuentes: antes.fuentes || [`https://raw.githubusercontent.com/${REPO}/refs/heads/claude/fijate-iszyer/aeroplaza/actualizacion.json`],
};
fs.writeFileSync(AVISO, JSON.stringify(aviso, null, 1) + '\n');
console.log(`✓ actualizacion.json: n ${aviso.n} · ${(b.length / 1048576).toFixed(2)} MB · ${sha.slice(0, 12)} · commit ${commit.slice(0, 8)} · APK ${codigo}`);
console.log('  ahora: commitealo y subilo a la rama (la APK lo lee de ahí al abrirse)');
