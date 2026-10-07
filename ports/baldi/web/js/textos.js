import { FIJOS, PATRONES } from './traduccion.js';

/* Textos del port en español, inglés y portugués. Los textos del juego (Text y TextMeshPro) pasan por
   traducir() al dibujarse: los fijos por diccionario y los que arman los guiones por patrones; la lógica
   sigue comparando el inglés original. Las imágenes con letras quedan como en el original. Las
   traducciones de los textos del juego van en traduccion.js, que no está en el repo (son del juego). */

export const T = {
  es: { idioma: 'Elige tu idioma', presenta: 'presenta', creditos: "Baldi's Basics Classic de Micah McGonigal (Basically Games) · port personal", cargando: 'Cargando…', tocar: 'Toca para empezar', girar: 'Gira el celular' },
  en: { idioma: 'Choose your language', presenta: 'presents', creditos: "Baldi's Basics Classic by Micah McGonigal (Basically Games) · personal port", cargando: 'Loading…', tocar: 'Tap to start', girar: 'Rotate your phone' },
  pt: { idioma: 'Escolha seu idioma', presenta: 'apresenta', creditos: "Baldi's Basics Classic de Micah McGonigal (Basically Games) · port pessoal", cargando: 'Carregando…', tocar: 'Toque para começar', girar: 'Gire o celular' },
};

const CACHE = new Map();
export function traducir(t, idioma) {
  if (!t || idioma === 'en') return t;
  const k = idioma + '|' + t;
  if (CACHE.has(k)) return CACHE.get(k);
  const i = idioma === 'pt' ? 1 : 0;
  let r = FIJOS[t]?.[i];
  if (r === undefined) {
    r = t;
    // los fijos que vienen al principio de un texto más largo (la ayuda del modo sin fin con el récord)
    for (const [en, tr] of Object.entries(FIJOS)) if (en.length > 12 && r.startsWith(en)) { r = tr[i] + r.slice(en.length); break; }
    for (const [re, tr] of PATRONES) r = r.replace(re, tr[i]);
  }
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(k, r);
  return r;
}
