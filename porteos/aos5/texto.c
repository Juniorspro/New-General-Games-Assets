/* Texto de cocos2d::Label (TTF): medidas de las letras y armado de líneas, y los cuadriláteros de
 * cada letra (la imagen de la letra la hace el anfitrión con la misma fuente). */
#include "rec.h"
#include "juego.h"
#include <math.h>
#include <string.h>


/* Medidas de la fuente: tabla generada desde la .ttf del APK (fuentes.c) */
float aos_fuente_avance(int fuente, u32 cp, float tam);   /* avance de una letra, en pixeles */
float aos_fuente_kern(int fuente, u32 a, u32 b, float tam);
float aos_fuente_alto_linea(int fuente, float tam);
float aos_fuente_ascenso(int fuente, float tam);
int aos_fuente_de_ruta(const char *ruta);
/* La letra en el atlas de letras del anfitrión: página, uv, tamaño y desplazamiento */
int aos_glifo(int fuente, u32 cp, float tam, u32 *pagina, float uv[4], float caja[4]);

int aos_fuente(const char *ruta) { return aos_fuente_de_ruta(ruta); }

static u32 utf8(const char **p) {
  const u8 *s = (const u8 *)*p;
  u32 c = *s++;
  if (c >= 0xf0 && s[0] && s[1] && s[2]) {
    c = ((c & 7) << 18) | ((s[0] & 63u) << 12) | ((s[1] & 63u) << 6) | (s[2] & 63u);
    s += 3;
  } else if (c >= 0xe0 && s[0] && s[1]) {
    c = ((c & 15) << 12) | ((s[0] & 63u) << 6) | (s[1] & 63u);
    s += 2;
  } else if (c >= 0xc0 && s[0]) {
    c = ((c & 31) << 6) | (s[0] & 63u);
    s += 1;
  }
  *p = (const char *)s;
  return c;
}

/* Corta en líneas como Label::multilineTextWrapByWord: por palabras si hay ancho; las palabras que
 * no entran solas se cortan por letra. Llama a `f` con cada línea (inicio, fin, ancho). */
typedef void (*LineaFn)(void *ctx, const char *a, const char *b, float w, int i);

static int cortar(int fuente, float tam, const char *s, float ancho_max, LineaFn f, void *ctx) {
  int n = 0;
  const char *ini = s;
  float w = 0;
  const char *ult_esp = NULL;
  float w_esp = 0;
  const char *p = s;
  u32 prev = 0;
  while (1) {
    const char *q = p;
    u32 c = *p ? utf8(&p) : 0;
    if (c == 0 || c == '\n') {
      if (f) f(ctx, ini, q, w, n);
      n++;
      if (!c) break;
      ini = p;
      w = 0;
      ult_esp = NULL;
      prev = 0;
      continue;
    }
    float av = aos_fuente_avance(fuente, c, tam) + (prev ? aos_fuente_kern(fuente, prev, c, tam) : 0);
    prev = c;
    if (ancho_max > 0 && w + av > ancho_max && q > ini) {
      if (ult_esp && ult_esp > ini) {
        if (f) f(ctx, ini, ult_esp, w_esp, n);
        n++;
        ini = ult_esp + 1;
        /* volver a medir lo que quedó */
        w = 0;
        u32 pr = 0;
        for (const char *r = ini; r < q;) {
          u32 cc = utf8(&r);
          w += aos_fuente_avance(fuente, cc, tam) + (pr ? aos_fuente_kern(fuente, pr, cc, tam) : 0);
          pr = cc;
        }
      } else {
        if (f) f(ctx, ini, q, w, n);
        n++;
        ini = q;
        w = 0;
      }
      ult_esp = NULL;
    }
    if (c == ' ') {
      ult_esp = q;
      w_esp = w;
    }
    w += av;
  }
  return n;
}

typedef struct {
  float ancho;
} CtxMedir;
static void medir(void *ctx, const char *a, const char *b, float w, int i) {
  CtxMedir *m = ctx;
  (void)a;
  (void)b;
  (void)i;
  if (w > m->ancho) m->ancho = w;
}

void texto_disenar(int fuente, float tam, const char *s, float ancho_max, int halign, Diseno *d) {
  (void)halign;
  CtxMedir m = {0};
  d->nlineas = cortar(fuente, tam, s, ancho_max, medir, &m);
  d->ancho = ceilf(m.ancho);
  d->altolinea = aos_fuente_alto_linea(fuente, tam);
}

typedef struct {
  Af m;
  u32 rgba;
  int fuente;
  float tam, ancho_caja, alto_caja, alto_linea, asc;
  int halign, nlineas;
} CtxDib;

static void linea(void *ctx, const char *a, const char *b, float w, int i) {
  CtxDib *c = ctx;
  float x = 0;
  if (c->halign == 1) x = floorf((c->ancho_caja - w) / 2);
  else if (c->halign == 2) x = c->ancho_caja - w;
  /* y desde arriba de la caja: la línea i tiene su base en alto - (i * alto_linea + ascenso) */
  float base = c->alto_caja - (float)i * c->alto_linea - c->asc;
  u32 prev = 0;
  for (const char *p = a; p < b;) {
    u32 cp = utf8(&p);
    if (prev) x += aos_fuente_kern(c->fuente, prev, cp, c->tam);
    prev = cp;
    float av = aos_fuente_avance(c->fuente, cp, c->tam);
    u32 pagina;
    float uv[4], caja[4];
    if (cp != ' ' && aos_glifo(c->fuente, cp, c->tam, &pagina, uv, caja))
      dibujo_quad(c->m, x + caja[0], base + caja[1], x + caja[2], base + caja[3], uv[0], uv[1], uv[2], uv[3],
                  c->rgba, pagina, 0);
    x += av;
  }
}

void texto_dibujar(u64 n, Obj *o, Af m, u32 rgba) {
  if (!o->texto || !o->texto[0]) return;
  CtxDib c;
  c.m = m;
  c.rgba = rgba;
  c.fuente = o->fuente;
  c.tam = o->tam;
  c.ancho_caja = RDF(n + 0x80);
  c.alto_caja = RDF(n + 0x84);
  c.alto_linea = aos_fuente_alto_linea(o->fuente, o->tam);
  c.asc = aos_fuente_ascenso(o->fuente, o->tam);
  c.halign = (int)RD32(n + 0x3a8);
  c.nlineas = o->nlineas;
  float ancho = RDF(n + 0x3a0);
  cortar(o->fuente, o->tam, o->texto, ancho, linea, &c);
}
