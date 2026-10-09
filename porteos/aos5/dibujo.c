/* El dibujo: recorre la escena como Node::visit de cocos2d (hijos por z y orden de llegada) y arma
 * una lista de cuadriláteros con textura, color y mezcla, en coordenadas del diseño (960×640, y para
 * arriba). El anfitrión la pasa a WebGL en un solo buffer, en lotes por página de atlas y mezcla. */
#include "rec.h"
#include "juego.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

extern u64 aos_escena;

typedef struct {
  float x, y, u, v;
  u32 rgba;
} AosVert;
typedef struct {
  u32 pagina, mezcla, desde, n; /* n cuadriláteros desde el vértice `desde` */
} AosLote;

#define MAXQ 16384
AosVert aos_verts[MAXQ * 4];
AosLote aos_lotes[MAXQ];
int aos_nquads, aos_nlotes;

/* Las mezclas que aparecen (src, dst de GL); el anfitrión tiene la misma tabla */
static const u32 MEZCLAS[][2] = {
    {1, 0x303},      /* 0 ONE, ONE_MINUS_SRC_ALPHA (premultiplicada, la de siempre) */
    {0x302, 0x303},  /* 1 SRC_ALPHA, ONE_MINUS_SRC_ALPHA */
    {0x304, 1},      /* 2 DST_ALPHA, ONE (kSprite modo 2: suma) */
    {0x304, 0x303},  /* 3 DST_ALPHA, ONE_MINUS_SRC_ALPHA (modo 1) */
    {1, 1},          /* 4 ONE, ONE */
    {0x302, 1},      /* 5 SRC_ALPHA, ONE */
};
#define NMEZCLAS (int)(sizeof MEZCLAS / sizeof MEZCLAS[0])
int aos_mezcla(int i, int cual) { return (int)MEZCLAS[i][cual]; }
int aos_nmezclas(void) { return NMEZCLAS; }
static int mezcla_id(u32 s, u32 d) {
  for (int i = 0; i < NMEZCLAS; i++)
    if (MEZCLAS[i][0] == s && MEZCLAS[i][1] == d) return i;
  static int avisado;
  if (!avisado++) aos_log("mezcla %#x %#x no prevista", s, d);
  return 0;
}


static Af af_mul(Af p, Af q) {
  Af r;
  r.a = p.a * q.a + p.c * q.b;
  r.b = p.b * q.a + p.d * q.b;
  r.c = p.a * q.c + p.c * q.d;
  r.d = p.b * q.c + p.d * q.d;
  r.tx = p.a * q.tx + p.c * q.ty + p.tx;
  r.ty = p.b * q.tx + p.d * q.ty + p.ty;
  return r;
}

/* Node::getNodeToParentTransform: T(pos) · R(-rot) · S(escala) · T(-ancla en puntos) */
static Af transformacion(u64 n) {
  float px = RDF(n + 0x50), py = RDF(n + 0x54);
  float rot = RDF(n + 0x2c);
  float sx = RDF(n + 0x44), sy = RDF(n + 0x48);
  float ax = RDF(n + 0x78) * RDF(n + 0x80), ay = RDF(n + 0x7c) * RDF(n + 0x84);
  float th = -rot * 3.14159265358979323846f / 180.0f;
  float co = cosf(th), si = sinf(th);
  Af m;
  m.a = co * sx;
  m.b = si * sx;
  m.c = -si * sy;
  m.d = co * sy;
  m.tx = px - (m.a * ax + m.c * ay);
  m.ty = py - (m.b * ax + m.d * ay);
  return m;
}

static int lote_actual(u32 pagina, int mezcla) {
  if (aos_nlotes && aos_lotes[aos_nlotes - 1].pagina == pagina && aos_lotes[aos_nlotes - 1].mezcla == (u32)mezcla)
    return aos_nlotes - 1;
  AosLote *l = &aos_lotes[aos_nlotes];
  l->pagina = pagina;
  l->mezcla = (u32)mezcla;
  l->desde = (u32)aos_nquads * 4;
  l->n = 0;
  return aos_nlotes++;
}

/* Un cuadrilátero: rect local (x0,y0)-(x1,y1) con uv (u0,v0)-(u1,v1) (v crece hacia abajo en la
 * imagen: v0 es el borde de arriba, que en el diseño es y1). */
void dibujo_quad(Af m, float x0, float y0, float x1, float y1, float u0, float v0, float u1, float v1,
                 u32 rgba, u32 pagina, int mezcla) {
  if (aos_nquads >= MAXQ) return;
  int l = lote_actual(pagina, mezcla);
  AosVert *v = &aos_verts[aos_nquads * 4];
  float xs[4] = {x0, x1, x0, x1}, ys[4] = {y1, y1, y0, y0};
  float us[4] = {u0, u1, u0, u1}, vs[4] = {v0, v0, v1, v1};
  for (int i = 0; i < 4; i++) {
    v[i].x = m.a * xs[i] + m.c * ys[i] + m.tx;
    v[i].y = m.b * xs[i] + m.d * ys[i] + m.ty;
    v[i].u = us[i];
    v[i].v = vs[i];
    v[i].rgba = rgba;
  }
  aos_lotes[l].n++;
  aos_nquads++;
}

/* color de vértice como Sprite::updateColor: con alfa premultiplicada, el color se multiplica por la
 * opacidad */
static u32 color_nodo(u64 n, int premult) {
  u32 op = RD8(n + 0x208);
  u32 r = RD8(n + 0x20a), g = RD8(n + 0x20b), b = RD8(n + 0x20c);
  if (premult) {
    r = r * op / 255;
    g = g * op / 255;
    b = b * op / 255;
  }
  return r | (g << 8) | (b << 16) | (op << 24);
}

static void dibujar_sprite(u64 n, Obj *o, Af m) {
  int img = o->img;
  if (img < 0) return;
  u32 pagina;
  float pu, pv, su, sv; /* esquina de la imagen en el atlas y escala de pixel a uv */
  if (!aos_imagen_atlas(img, &pagina, &pu, &pv, &su, &sv)) return;
  float rx = RDF(n + 0x3b0), ry = RDF(n + 0x3b4), rw = RDF(n + 0x3b8), rh = RDF(n + 0x3bc);
  float w = RDF(n + 0x80), h = RDF(n + 0x84);
  float u0 = pu + rx * su, u1 = pu + (rx + rw) * su;
  float v0 = pv + ry * sv, v1 = pv + (ry + rh) * sv;
  if (RD8(n + 0x4a1)) {
    float t = u0;
    u0 = u1;
    u1 = t;
  }
  if (RD8(n + 0x4a2)) {
    float t = v0;
    v0 = v1;
    v1 = t;
  }
  int premult = aos_imagen_alfa(img);
  u32 bs = RD32(n + 0x304), bd = RD32(n + 0x308);
  dibujo_quad(m, 0, 0, w, h, u0, v0, u1, v1, color_nodo(n, premult), pagina, mezcla_id(bs, bd));
}

void texto_dibujar(u64 n, Obj *o, Af m, u32 rgba);

typedef struct {
  u64 n;
  s32 z;
  u32 llegada;
} Hijo;

static int cmp_hijo(const void *a, const void *b) {
  const Hijo *x = a, *y = b;
  if (x->z != y->z) return x->z < y->z ? -1 : 1;
  return x->llegada < y->llegada ? -1 : x->llegada > y->llegada;
}

static void visitar(u64 n, Af padre, int prof) {
  if (!RD8(n + 0x1e9) || prof > 32) return;
  Obj *o = obj_de(n);
  Af m = o && o->tipo == T_ESCENA ? padre : af_mul(padre, transformacion(n));
  u64 b = RD64(n + 0x178), e = RD64(n + 0x180);
  int nh = (int)((e - b) / 8);
  Hijo *hs = NULL;
  if (nh > 0) {
    hs = malloc(sizeof(Hijo) * (size_t)nh);
    for (int i = 0; i < nh; i++) {
      u64 h = RD64(b + 8 * (u64)i);
      Obj *oh = obj_de(h);
      hs[i] = (Hijo){h, (s32)RD32(h + 0x170), oh ? oh->llegada : 0};
    }
    qsort(hs, (size_t)nh, sizeof(Hijo), cmp_hijo);
  }
  int i = 0;
  for (; i < nh && hs[i].z < 0; i++) visitar(hs[i].n, m, prof + 1);
  if (o && o->tipo == T_SPRITE) dibujar_sprite(n, o, m);
  else if (o && o->tipo == T_LABEL) texto_dibujar(n, o, m, color_nodo(n, 1));
  for (; i < nh; i++) visitar(hs[i].n, m, prof + 1);
  free(hs);
}

/* Arma la lista de la escena actual. Devuelve la cantidad de cuadriláteros. */
int dibujo_armar(void) {
  aos_nquads = aos_nlotes = 0;
  if (!aos_escena) return 0;
  Af id = {1, 0, 0, 1, 0, 0};
  visitar(aos_escena, id, 0);
  return aos_nquads;
}
