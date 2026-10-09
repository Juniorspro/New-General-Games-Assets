/* Búsquedas sobre las tablas que arma armar-datos.py desde el APK: imágenes (imagenes.c) y medidas de
 * la fuente (fuentes.c). Las medidas siguen a FreeType como lo usaba cocos2d-x 3.17: avance de cada
 * letra en pixeles enteros (la tabla hdmx de la fuente si tiene ese tamaño), interletrado de 'kern'
 * redondeado al pixel, alto de línea = ascenso + descenso + espacio, redondeado. */
#include "aos.h"
#include "juego.h"
#include <math.h>
#include <string.h>

typedef struct {
  const char *ruta;
  u16 w, h;
  u8 alfa, pagina;
  u16 x, y;
  u32 tam; /* bytes del archivo original */
} AosImg;
extern const AosImg aos_imgs[];
extern const int aos_nimgs;
typedef struct {
  const char *ruta;
  u32 tam;
} AosOtro;
extern const AosOtro aos_otros[];
extern const int aos_notros;
extern const u16 aos_paginas[][2];
extern const int aos_npaginas;

static const char *limpiar(const char *r) {
  while (*r == '/') r++;
  if (!strncmp(r, "assets/", 7)) r += 7;
  while (r[0] == '.' && r[1] == '/') r += 2;
  return r;
}

int aos_imagen(const char *ruta, int *w, int *h) {
  ruta = limpiar(ruta);
  int lo = 0, hi = aos_nimgs - 1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    int c = strcmp(aos_imgs[m].ruta, ruta);
    if (!c) {
      *w = aos_imgs[m].w;
      *h = aos_imgs[m].h;
      return m;
    }
    if (c < 0) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}
int aos_imagen_alfa(int i) { return i >= 0 && i < aos_nimgs ? aos_imgs[i].alfa : 1; }
void aos_imagen_tam(int i, int *w, int *h) {
  *w = i >= 0 && i < aos_nimgs ? aos_imgs[i].w : 0;
  *h = i >= 0 && i < aos_nimgs ? aos_imgs[i].h : 0;
}
int aos_imagen_atlas(int i, u32 *pagina, float *pu, float *pv, float *su, float *sv) {
  if (i < 0 || i >= aos_nimgs) return 0;
  const AosImg *m = &aos_imgs[i];
  float pw = aos_paginas[m->pagina][0], ph = aos_paginas[m->pagina][1];
  *pagina = m->pagina;
  *pu = m->x / pw;
  *pv = m->y / ph;
  *su = 1.0f / pw;
  *sv = 1.0f / ph;
  return 1;
}
const char *aos_imagen_ruta(int i) { return i >= 0 && i < aos_nimgs ? aos_imgs[i].ruta : "?"; }

/* Tamaño del archivo original de assets/ que no se publica como archivo (imágenes en el atlas, sonidos
 * en ogg, fuentes): 0 si no es uno de ésos. */
u32 aos_tam_original(const char *ruta) {
  int w, h, i = aos_imagen(ruta, &w, &h);
  if (i >= 0) return aos_imgs[i].tam;
  ruta = limpiar(ruta);
  int lo = 0, hi = aos_notros - 1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    int c = strcmp(aos_otros[m].ruta, ruta);
    if (!c) return aos_otros[m].tam;
    if (c < 0) lo = m + 1;
    else hi = m - 1;
  }
  return 0;
}

/* ------------------------------------------------------------------ fuente */
extern const int aos_f_upem, aos_f_asc, aos_f_desc, aos_f_gap, aos_f_ncp, aos_f_nhdmx, aos_f_nkern;
extern const u16 aos_f_cp[], aos_f_av[];
extern const u8 aos_f_hdmx_ppem[], aos_f_hdmx[];
extern const u16 aos_f_kern[][2];
extern const s16 aos_f_kernv[];

int aos_fuente_de_ruta(const char *ruta) {
  (void)ruta; /* el juego sólo usa arial.ttf */
  return 0;
}

static int indice_cp(u32 cp) {
  int lo = 0, hi = aos_f_ncp - 1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    if (aos_f_cp[m] == cp) return m;
    if (aos_f_cp[m] < cp) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}

float aos_fuente_avance(int f, u32 cp, float tam) {
  (void)f;
  int i = indice_cp(cp);
  if (i < 0) i = indice_cp('?');
  if (i < 0) return roundf(tam * 0.5f);
  int ppem = (int)lroundf(tam);
  for (int k = 0; k < aos_f_nhdmx; k++)
    if (aos_f_hdmx_ppem[k] == ppem) return aos_f_hdmx[k * aos_f_ncp + i];
  return roundf(aos_f_av[i] * tam / aos_f_upem);
}

float aos_fuente_kern(int f, u32 a, u32 b, float tam) {
  (void)f;
  int lo = 0, hi = aos_f_nkern - 1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    u32 ka = aos_f_kern[m][0], kb = aos_f_kern[m][1];
    if (ka == a && kb == b) return floorf(roundf(aos_f_kernv[m] * tam / aos_f_upem * 64.0f) / 64.0f);
    if (ka < a || (ka == a && kb < b)) lo = m + 1;
    else hi = m - 1;
  }
  return 0;
}

float aos_fuente_alto_linea(int f, float tam) {
  (void)f;
  return roundf((aos_f_asc - aos_f_desc + aos_f_gap) * tam / aos_f_upem);
}
float aos_fuente_ascenso(int f, float tam) {
  (void)f;
  return ceilf(aos_f_asc * tam / aos_f_upem);
}
