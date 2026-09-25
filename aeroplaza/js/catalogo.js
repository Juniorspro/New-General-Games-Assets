/* ============================================================================
   aeroplaza/js/catalogo.js — qué se puede poner el muñeco, cuánto cuesta y
   qué se gana con misiones. La clave de cada cosa es "ranura:valor"
   (p. ej. 'sombrero:corona'), la misma que viaja en la apariencia.
   Los colores son todos gratis: son lo primero que cada quien quiere tocar.
   ========================================================================== */
import { MATERIALES, MOTIVOS, SOMBREROS, ANTEOJOS, ESPALDAS, PEINADOS, PARTICULAS, OJOS } from './meeple.js';
import { sumar } from './textos.js';

export const RANURAS = [
  { r: 'material', lista: MATERIALES, pre: 'mat' },
  { r: 'motivo', lista: MOTIVOS, pre: 'mot' },
  { r: 'motivoCabeza', lista: ['igual', ...MOTIVOS], pre: 'mot', como: 'motivo' },
  { r: 'ojos', lista: OJOS, pre: 'ojo' },
  { r: 'sombrero', lista: SOMBREROS, pre: 'som' },
  { r: 'peinado', lista: PEINADOS, pre: 'pei' },
  { r: 'anteojos', lista: ANTEOJOS, pre: 'ant' },
  { r: 'espalda', lista: ESPALDAS, pre: 'esp' },
  { r: 'particulas', lista: PARTICULAS, pre: 'par' },
];
const GRATIS = new Set(['material:gelatina', 'material:mate', 'motivo:ninguno', 'motivo:agua', 'motivo:nubes', 'sombrero:ninguno', 'sombrero:conico', 'sombrero:gorro',
  'peinado:ninguno', 'peinado:mechon', 'peinado:rodete', 'anteojos:ninguno', 'espalda:ninguno', 'particulas:ninguna']);
export const PRECIO = {
  'material:vidrio': 20, 'material:perla': 35, 'material:cromo': 45, 'material:neon': 60,
  'motivo:tierra': 15, 'motivo:hojas': 15, 'motivo:flores': 20,
  'sombrero:galera': 25, 'sombrero:corona': 90, 'sombrero:auriculares': 30, 'sombrero:casco': 45, 'sombrero:brote': 12, 'sombrero:gorra': 15,
  'peinado:pinches': 12, 'peinado:melena': 15, 'peinado:colitas': 15, 'peinado:cresta': 18, 'peinado:nube': 30,
  'anteojos:sol': 15, 'anteojos:redondos': 12, 'anteojos:visor': 35,
  'espalda:alas': 70, 'espalda:mochila': 30,
  'particulas:burbujas': 25, 'particulas:estrellas': 40, 'particulas:hojas': 25,
};
/* lo que se paga con joyas (💎): 10 de regalo por día, anuncios con premio o paquetes. Todo
   cuesta 100 o más: se junta de a poco o se compra */
export const PRECIO_JOYAS = {
  'material:holo': 120, 'material:diamante': 300, 'motivo:arcoiris': 100,
  'sombrero:tiara': 150, 'sombrero:arcoiris': 180, 'anteojos:estrella': 100,
  'espalda:mariposa': 200, 'espalda:capa': 120, 'particulas:destellos': 150,
};
/* lo que solo se gana con una misión: la clave → el NPC que la da */
export const DE_MISION = {
  'sombrero:flor': 'nimbo', 'peinado:rulos': 'lima', 'motivo:burbujas': 'burbu', 'espalda:aleta': 'coral',
  'sombrero:aureola': 'estela', 'motivo:galaxia': 'estela', 'motivo:aurora': 'loto', 'particulas:notas': 'guia',
  'sombrero:explorador': 'brujula', 'espalda:molinete': 'brisa', 'sombrero:hongo': 'musgo', 'sombrero:capitan': 'marea',
};
export function loTengo(G, clave) {
  /* los ojos son gratis; el motivo de la cabeza se tiene si se tiene ese motivo */
  if (clave.startsWith('ojos:') || clave === 'motivoCabeza:igual') return true;
  if (clave.startsWith('motivoCabeza:')) clave = 'motivo:' + clave.slice(13);
  return GRATIS.has(clave) || G.tengo.includes(clave);
}
export function precio(clave) { if (clave.startsWith('motivoCabeza:')) clave = 'motivo:' + clave.slice(13); return PRECIO[clave] ?? null; }
export function precioJoyas(clave) { if (clave.startsWith('motivoCabeza:')) clave = 'motivo:' + clave.slice(13); return PRECIO_JOYAS[clave] ?? null; }

sumar({
  es: { mat_holo: 'Holográfico', mat_diamante: 'Diamante', mot_arcoiris: 'Arcoíris', som_tiara: 'Tiara de joyas', som_arcoiris: 'Arcoíris', ant_estrella: 'Estrella', esp_mariposa: 'Alas de mariposa', esp_capa: 'Capa de estrellas', par_destellos: 'Destellos' },
  en: { mat_holo: 'Holographic', mat_diamante: 'Diamond', mot_arcoiris: 'Rainbow', som_tiara: 'Jewel tiara', som_arcoiris: 'Rainbow', ant_estrella: 'Star', esp_mariposa: 'Butterfly wings', esp_capa: 'Star cape', par_destellos: 'Sparkles' },
  pt: { mat_holo: 'Holográfico', mat_diamante: 'Diamante', mot_arcoiris: 'Arco-íris', som_tiara: 'Tiara de joias', som_arcoiris: 'Arco-íris', ant_estrella: 'Estrela', esp_mariposa: 'Asas de borboleta', esp_capa: 'Capa de estrelas', par_destellos: 'Brilhos' },
});

export const PALETA = ['#2f9bff', '#39d6ff', '#3fffd0', '#56e05a', '#b6f03a', '#ffe14a', '#ffb13d', '#ff7a3d', '#ff4f6e', '#ff6fb0', '#e46fff', '#9b7bff',
  '#6a7dff', '#1d4fbf', '#0f8f7a', '#2f7a2f', '#8a5a2b', '#ffffff', '#d9e6f2', '#9aa9b8', '#56606b', '#22262b', '#ffd6e8', '#d9fff5'];
export const PALETA_PELO = ['#ffd23f', '#ff9a3d', '#c8743a', '#6b3f1f', '#22262b', '#ffffff', '#ff6fb0', '#9b7bff', '#39d6ff', '#56e05a'];

/* los muebles de la casa: [clave, emoji para el menú] (se dibujan en reinos/casa.js) */
export const MUEBLES = [['sofa', '🛋️'], ['sillon', '💺'], ['mesa', '🟫'], ['silla', '🪑'], ['cama', '🛏️'], ['lampara', '💡'], ['planta', '🪴'], ['pecera', '🐠'],
  ['tele', '📺'], ['alfombra', '⭕'], ['estante', '📚'], ['radio', '📻'], ['puff', '🫘'], ['arbolito', '🌳'], ['fuente', '⛲'], ['globo', '🫧']];
