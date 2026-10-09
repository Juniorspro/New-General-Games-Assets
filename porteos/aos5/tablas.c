/* Búsquedas sobre las tablas que arma armar-datos.py desde el APK: imágenes (imagenes.c) y medidas de
 * la fuente (fuentes.c); y el atlas de las imágenes, que se arma a medida que el juego las pide. Las medidas siguen a FreeType como lo usaba cocos2d-x 3.17: avance de cada
 * letra en pixeles enteros (la tabla hdmx de la fuente si tiene ese tamaño), interletrado de 'kern'
 * redondeado al pixel, alto de línea = ascenso + descenso + espacio, redondeado. */
#include "aos.h"
#include "juego.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  const char *ruta;
  u16 w, h;
  u8 alfa;
  u32 off, len; /* el WebP (con borde) dentro de datos/imagenes.bin */
  u32 tam;      /* bytes del archivo original */
} AosImg;
extern const AosImg aos_imgs[];
extern const int aos_nimgs;
extern const int aos_img_margen;
typedef struct {
  const char *ruta;
  u32 tam;
} AosOtro;
extern const AosOtro aos_otros[];
extern const int aos_notros;

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
const char *aos_imagen_ruta(int i) { return i >= 0 && i < aos_nimgs ? aos_imgs[i].ruta : "?"; }

/* ------------------------------------------------------------------ el atlas que se arma al jugar */
/* Como el original, que cargaba cada PNG la primera vez que lo usaba: cada imagen se acomoda (con su
 * borde) en una página de PAG×PAG cuando el juego la pide, y el anfitrión la decodifica y la sube ahí.
 * Así en la memoria de video está sólo lo que se usó. Si hacen falta más de PAG_MAX páginas se vacía
 * todo y se vuelve a cargar lo que se siga usando (como TextureCache::removeUnusedTextures). Cada página
 * se llena de abajo hacia arriba con un "skyline": la lista de segmentos del borde de lo ocupado. */
#define PAG 1024
#define PAG_MAX 16
#define NSEG 256
typedef struct {
  u16 x, y, w;
} Seg;
static struct {
  Seg s[NSEG];
  int n;
} sky[PAG_MAX];
static int npag;
static u16 *lugar_p, *lugar_x, *lugar_y; /* página+1 (0: todavía no), esquina del borde */

static int sky_meter(int p, int w, int h, int *ox, int *oy) {
  Seg *s = sky[p].s;
  int n = sky[p].n, mejor = -1, bx = 0, by = 0, bfin = 1 << 30;
  for (int i = 0; i < n; i++) {
    int x = s[i].x, y = 0, cubre = 0;
    if (x + w > PAG) break;
    for (int j = i; j < n && cubre < w; j++) {
      if (s[j].y > y) y = s[j].y;
      cubre = s[j].x + s[j].w - x;
    }
    if (y + h <= PAG && (y + h < bfin || (y + h == bfin && x < bx))) {
      bfin = y + h;
      mejor = i;
      bx = x;
      by = y;
    }
  }
  if (mejor < 0 || n + 1 > NSEG) return 0;
  /* el segmento nuevo tapa [bx, bx+w): se recortan o sacan los de abajo */
  memmove(&s[mejor + 1], &s[mejor], sizeof(Seg) * (size_t)(n - mejor));
  s[mejor] = (Seg){(u16)bx, (u16)(by + h), (u16)w};
  n++;
  for (int j = mejor + 1; j < n;) {
    int fin = bx + w, finj = s[j].x + s[j].w;
    if (s[j].x >= fin) break;
    if (finj <= fin) {
      memmove(&s[j], &s[j + 1], sizeof(Seg) * (size_t)(n - j - 1));
      n--;
      continue;
    }
    s[j].w = (u16)(finj - fin);
    s[j].x = (u16)fin;
    break;
  }
  for (int j = 0; j + 1 < n;) {
    if (s[j].y == s[j + 1].y) {
      s[j].w += s[j + 1].w;
      memmove(&s[j + 1], &s[j + 2], sizeof(Seg) * (size_t)(n - j - 2));
      n--;
    } else
      j++;
  }
  sky[p].n = n;
  *ox = bx;
  *oy = by;
  return 1;
}

static void pagina_nueva(int p) {
  sky[p].s[0] = (Seg){0, 0, PAG};
  sky[p].n = 1;
}

static void colocar(int img) {
  int w = aos_imgs[img].w + 2 * aos_img_margen, h = aos_imgs[img].h + 2 * aos_img_margen, x, y, p;
  for (int vuelta = 0; vuelta < 2; vuelta++) {
    for (p = 0; p < npag; p++)
      if (sky_meter(p, w, h, &x, &y)) goto listo;
    if (npag < PAG_MAX) {
      pagina_nueva(p = npag++);
      if (sky_meter(p, w, h, &x, &y)) goto listo;
    }
    aos_log("atlas lleno (%d páginas): se vacía", npag);
    memset(lugar_p, 0, sizeof(u16) * (size_t)aos_nimgs);
    npag = 0;
    aos_atlas_vaciar();
  }
  aos_log("la imagen %s no entra en una página", aos_imgs[img].ruta);
  return;
listo:
  lugar_p[img] = (u16)(p + 1);
  lugar_x[img] = (u16)x;
  lugar_y[img] = (u16)y;
  aos_imagen_subir(img, p, x, y, aos_imgs[img].off, aos_imgs[img].len);
}

void aos_imagen_pedida(int img) {
  if (img < 0 || img >= aos_nimgs) return;
  if (!lugar_p) {
    lugar_p = calloc((size_t)aos_nimgs, sizeof(u16));
    lugar_x = calloc((size_t)aos_nimgs, sizeof(u16));
    lugar_y = calloc((size_t)aos_nimgs, sizeof(u16));
  }
  if (!lugar_p[img]) colocar(img);
}

/* página y uv de la imagen (sin el borde); si todavía no estaba, se pide */
int aos_imagen_atlas(int i, u32 *pagina, float *pu, float *pv, float *su, float *sv) {
  if (i < 0 || i >= aos_nimgs) return 0;
  aos_imagen_pedida(i);
  if (!lugar_p[i]) return 0;
  *pagina = lugar_p[i] - 1u;
  *pu = (float)(lugar_x[i] + aos_img_margen) / PAG;
  *pv = (float)(lugar_y[i] + aos_img_margen) / PAG;
  *su = *sv = 1.0f / PAG;
  return 1;
}

/* se perdieron las páginas (el contexto de WebGL): todo se vuelve a pedir al dibujar */
void aos_atlas_reiniciar(void) {
  if (lugar_p) memset(lugar_p, 0, sizeof(u16) * (size_t)aos_nimgs);
  npag = 0;
}

/* para las pruebas: dónde quedó (esquina sin el borde) */
int aos_imagen_lugar(int i, int *pagina, int *x, int *y) {
  if (i < 0 || i >= aos_nimgs || !lugar_p || !lugar_p[i]) return 0;
  *pagina = lugar_p[i] - 1;
  *x = lugar_x[i] + aos_img_margen;
  *y = lugar_y[i] + aos_img_margen;
  return 1;
}
int aos_atlas_lado(void) { return PAG; }

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
