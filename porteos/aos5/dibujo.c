/* El dibujo: recorre la escena como Node::visit de cocos2d (hijos por z y orden de llegada) y arma
 * una lista de cuadriláteros con textura, color y mezcla, en coordenadas del diseño (960×640, y para
 * arriba). El anfitrión la pasa a WebGL en un solo buffer, en lotes por página de atlas y mezcla.
 *
 * El juego cambia lo que se ve una vez por vuelta (cada 0,06 s). Para dibujar a 60 cuadros, cada
 * cuadrilátero de la vuelta se empareja con el mismo de la vuelta anterior (misma página, recorte,
 * color y mezcla: la misma pieza del esqueleto de un muñeco, el mismo bloque del piso) y en cada
 * cuadro se dibuja el punto intermedio: centro, giro, largo y color. Lo que no tiene pareja (algo
 * nuevo, un cambio de imagen, un salto) se dibuja tal cual. Se ve con una vuelta de atraso. */
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
AosVert aos_verts[MAXQ * 4];            /* lo que se dibuja: la vuelta actual, interpolada */
AosLote aos_lotes[MAXQ];
int aos_nquads, aos_nlotes;
static AosVert buf_a[MAXQ * 4], buf_b[MAXQ * 4];
static AosVert *act = buf_a, *ant = buf_b; /* la vuelta actual y la anterior */
static u64 clave_a[MAXQ], clave_b[MAXQ];
static u64 *cact = clave_a, *cant = clave_b;
static u32 tinte_q[MAXQ];                /* el tinte de cada cuadrilátero actual */
static int nant;
static int pareja[MAXQ];                 /* para cada cuadrilátero actual: el de la vuelta anterior, o -1 */
static u8 modo[MAXQ];                    /* 0 tal cual, 1 cada pieza a su manera, 2 el grupo entero junto */
static float desp[MAXQ][2];              /* modo 2: lo que se movió el grupo en la vuelta */
static int movimiento;                   /* alguno se mueve entre las dos vueltas */

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

/* qué pieza es: página, recorte (con su espejado), tinte del nodo (sin la opacidad: lo que se
 * desvanece sigue siendo lo mismo) y mezcla */
static u32 tinte_actual;
static u64 clave(u32 pagina, int mezcla, float u0, float v0, float u1, float v1, u32 tinte) {
  u32 w[7] = {pagina, (u32)mezcla, 0, 0, 0, 0, tinte};
  memcpy(&w[2], &u0, 4);
  memcpy(&w[3], &v0, 4);
  memcpy(&w[4], &u1, 4);
  memcpy(&w[5], &v1, 4);
  u64 h = 1469598103934665603ULL;
  const u8 *b = (const u8 *)w;
  for (size_t i = 0; i < sizeof w; i++) h = (h ^ b[i]) * 1099511628211ULL;
  return h;
}

/* Un cuadrilátero: rect local (x0,y0)-(x1,y1) con uv (u0,v0)-(u1,v1) (v crece hacia abajo en la
 * imagen: v0 es el borde de arriba, que en el diseño es y1). */
void dibujo_quad(Af m, float x0, float y0, float x1, float y1, float u0, float v0, float u1, float v1,
                 u32 rgba, u32 pagina, int mezcla) {
  if (aos_nquads >= MAXQ) return;
  int l = lote_actual(pagina, mezcla);
  cact[aos_nquads] = clave(pagina, mezcla, u0, v0, u1, v1, tinte_actual);
  tinte_q[aos_nquads] = tinte_actual;
  AosVert *v = &act[aos_nquads * 4];
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
  if (o && (o->tipo == T_SPRITE || o->tipo == T_LABEL))
    tinte_actual = RD8(n + 0x20a) | (u32)RD8(n + 0x20b) << 8 | (u32)RD8(n + 0x20c) << 16;
  if (o && o->tipo == T_SPRITE) dibujar_sprite(n, o, m);
  else if (o && o->tipo == T_LABEL) texto_dibujar(n, o, m, color_nodo(n, 1));
  for (; i < nh; i++) visitar(hs[i].n, m, prof + 1);
  free(hs);
}

/* ------------------------------------------------------------------ parejas entre vueltas */
#define R_ORDEN 96.0f   /* la misma en el orden de dibujo: hasta acá es la misma pieza que se movió */
#define R_VARIOS 72.0f  /* si no, la más cercana entre las iguales (bloques del piso, partes de un muñeco) */
#define R_UNICO 240.0f  /* una sola pieza así en las dos vueltas: puede ir más lejos */
static int cmp_clave(const void *a, const void *b, const u64 *c) {
  u64 x = c[*(const int *)a], y = c[*(const int *)b];
  return x < y ? -1 : x > y ? 1 : *(const int *)a - *(const int *)b;
}
static int cmp_ant(const void *a, const void *b) { return cmp_clave(a, b, cant); }
static int cmp_act(const void *a, const void *b) { return cmp_clave(a, b, cact); }
/* primer índice de `orden` (ordenado por clave) con clave >= k */
static int desde_clave(const int *orden, int n, const u64 *c, u64 k) {
  int lo = 0, hi = n;
  while (lo < hi) {
    int m = (lo + hi) / 2;
    if (c[orden[m]] < k) lo = m + 1;
    else hi = m;
  }
  return lo;
}
static void centro(const AosVert *v, float *x, float *y) {
  *x = (v[0].x + v[3].x) * 0.5f;
  *y = (v[0].y + v[3].y) * 0.5f;
}

/* El eje largo del cuadrilátero (el de un brazo o una pierna) y si el giro entre las dos vueltas es un
 * giro de verdad (hasta 120°) y no un cambio de lado. */
static void ejes(const AosVert *v, float *lx, float *ly, float *cx, float *cy) {
  float ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, wx = v[2].x - v[0].x, wy = v[2].y - v[0].y;
  if (ux * ux + uy * uy >= wx * wx + wy * wy) {
    *lx = ux, *ly = uy, *cx = wx, *cy = wy;
  } else {
    *lx = wx, *ly = wy, *cx = ux, *cy = uy;
  }
}
static int giro_posible(const AosVert *p, const AosVert *c) {
  float plx, ply, pcx, pcy, clx, cly, ccx, ccy;
  ejes(p, &plx, &ply, &pcx, &pcy);
  ejes(c, &clx, &cly, &ccx, &ccy);
  float pl = sqrtf(plx * plx + ply * ply), cl = sqrtf(clx * clx + cly * cly);
  if (pl < 1e-4f || cl < 1e-4f) return 1;
  return (plx * clx + ply * cly) / (pl * cl) >= -0.5f;
}
static int cmp_float(const void *a, const void *b) {
  float x = *(const float *)a, y = *(const float *)b;
  return x < y ? -1 : x > y;
}

/* Dentro de un muñeco, las piezas iguales (dos muslos, dos canillas) pueden cambiar de orden de una
 * vuelta a otra (cuando las piernas se cruzan, se dibuja primero la otra): entre las parejas que ya
 * tienen, se elige el reparto que menos cambia respecto del cuerpo (lo que se corrió aparte del grupo y
 * cuánto giró cada una). */
static float costo(int i, int q, float mx, float my) {
  float cx, cy, px, py;
  centro(&act[i * 4], &cx, &cy);
  centro(&ant[q * 4], &px, &py);
  float ex = cx - px - mx, ey = cy - py - my;
  float clx, cly, ccx, ccy, plx, ply, pcx, pcy;
  ejes(&act[i * 4], &clx, &cly, &ccx, &ccy);
  ejes(&ant[q * 4], &plx, &ply, &pcx, &pcy);
  float g = atan2f(clx * ply - cly * plx, clx * plx + cly * ply); /* ángulo entre los ejes largos */
  return ex * ex + ey * ey + 1600.0f * g * g;                       /* 1 radián pesa como 40 px */
}
static void permutar(const int *ii, int *qq, int k, int d, float acum, float *mejor, int *elegido, float mx, float my) {
  if (acum >= *mejor) return;
  if (d == k) {
    *mejor = acum;
    memcpy(elegido, qq, sizeof(int) * (size_t)k);
    return;
  }
  for (int j = d; j < k; j++) {
    int t = qq[d];
    qq[d] = qq[j];
    qq[j] = t;
    permutar(ii, qq, k, d + 1, acum + costo(ii[d], qq[d], mx, my), mejor, elegido, mx, my);
    t = qq[d];
    qq[d] = qq[j];
    qq[j] = t;
  }
}
static void refinar(int a, int b, float mx, float my) {
  static int ii[MAXQ];
  int n = b - a;
  for (int i = 0; i < n; i++) ii[i] = a + i;
  qsort(ii, (size_t)n, sizeof(int), cmp_act);
  for (int x = 0; x < n;) {
    int y = x + 1;
    while (y < n && cact[ii[y]] == cact[ii[x]]) y++;
    int k = y - x, todas = 1;
    for (int j = x; j < y; j++) todas &= pareja[ii[j]] >= 0;
    if (k >= 2 && k <= 7 && todas) {
      int qq[8], elegido[8];
      float mejor = 0;
      for (int j = 0; j < k; j++) {
        qq[j] = pareja[ii[x + j]];
        mejor += costo(ii[x + j], qq[j], mx, my);
      }
      memcpy(elegido, qq, sizeof(int) * (size_t)k);
      permutar(&ii[x], qq, k, 0, 0, &mejor, elegido, mx, my);
      for (int j = 0; j < k; j++) pareja[ii[x + j]] = elegido[j];
    }
    x = y;
  }
}

/* Grupos: piezas seguidas en el orden de dibujo, del mismo tinte y pegadas (un muñeco, una fila de
 * bloques, un texto). Si todas tienen pareja y se movieron parecido, cada una se interpola sola (el
 * esqueleto se mueve suave); si no (cambió la pose, entró un bloque nuevo), el grupo se dibuja como
 * está ahora y se desliza entero lo que se movió la mayoría: nunca queda medio muñeco en una pose y
 * medio en otra. */
#define G_PEGADO 80.0f
#define G_DESVIO 40.0f
/* Lo que se movió el grupo [a, b): la mediana de sus piezas con pareja (en mx, my). Devuelve cuántas
 * tienen pareja; en *juntas, si todas la tienen, giraron de verdad y se movieron parecido. */
static int mediana(int a, int b, float *mx, float *my, int *juntas) {
  static float dx[MAXQ], dy[MAXQ], t[MAXQ];
  int m = 0, todas = 1;
  for (int i = a; i < b; i++) {
    if (pareja[i] < 0 || !giro_posible(&ant[pareja[i] * 4], &act[i * 4])) {
      todas = 0;
      if (pareja[i] < 0) continue;
    }
    float cx, cy, px, py;
    centro(&act[i * 4], &cx, &cy);
    centro(&ant[pareja[i] * 4], &px, &py);
    dx[m] = cx - px;
    dy[m] = cy - py;
    m++;
  }
  *mx = *my = 0;
  if (m) {
    memcpy(t, dx, sizeof(float) * (size_t)m);
    qsort(t, (size_t)m, sizeof(float), cmp_float);
    *mx = t[m / 2];
    memcpy(t, dy, sizeof(float) * (size_t)m);
    qsort(t, (size_t)m, sizeof(float), cmp_float);
    *my = t[m / 2];
    for (int k = 0; k < m && todas; k++)
      if (fabsf(dx[k] - *mx) > G_DESVIO || fabsf(dy[k] - *my) > G_DESVIO) todas = 0;
  }
  *juntas = todas;
  return m;
}
static void agrupar(void) {
  int n = aos_nquads;
  movimiento = 0;
  for (int a = 0; a < n;) {
    int b = a + 1;
    float x0, y0;
    centro(&act[a * 4], &x0, &y0);
    while (b < n && tinte_q[b] == tinte_q[a]) {
      float x1, y1;
      centro(&act[b * 4], &x1, &y1);
      if ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) > G_PEGADO * G_PEGADO) break;
      x0 = x1, y0 = y1, b++;
    }
    /* [a, b): un grupo. Con lo que se movió, el mejor reparto de las piezas iguales; con ese reparto,
     * cómo se dibuja */
    float mx, my;
    int todas, m = mediana(a, b, &mx, &my, &todas);
    if (m) {
      refinar(a, b, mx, my);
      m = mediana(a, b, &mx, &my, &todas);
    }
    for (int i = a; i < b; i++) {
      if (todas) {
        modo[i] = 1;
        if (memcmp(&act[i * 4], &ant[pareja[i] * 4], sizeof(AosVert) * 4)) movimiento = 1;
      } else if (m && (mx != 0 || my != 0)) {
        modo[i] = 2;
        desp[i][0] = mx;
        desp[i][1] = my;
        movimiento = 1;
      } else
        modo[i] = 0;
    }
    a = b;
  }
}

/* Primero, la k-ésima pieza igual en el orden de dibujo: el juego dibuja cada esqueleto siempre en el
 * mismo orden, así que el brazo sigue siendo el brazo aunque cruce al otro. Si eso da un salto que no
 * puede ser (apareció o se fue algo antes en la lista), la más cercana que quede libre. */
static void emparejar(void) {
  static int oa[MAXQ], oc[MAXQ], vez[MAXQ];
  static u8 usado[MAXQ];
  int n = aos_nquads;
  for (int i = 0; i < nant; i++) oa[i] = i;
  for (int i = 0; i < n; i++) oc[i] = i;
  qsort(oa, (size_t)nant, sizeof(int), cmp_ant);
  qsort(oc, (size_t)n, sizeof(int), cmp_act);
  for (int j = 0, d = 0; j < n; j++) {   /* vez[i]: cuántas iguales se dibujaron antes en esta vuelta */
    if (j && cact[oc[j]] != cact[oc[j - 1]]) d = j;
    vez[oc[j]] = j - d;
  }
  memset(usado, 0, (size_t)nant);
  for (int i = 0; i < n; i++) {
    pareja[i] = -1;
    u64 k = cact[i];
    int lo = desde_clave(oa, nant, cant, k), hi = lo;
    while (hi < nant && cant[oa[hi]] == k) hi++;
    if (vez[i] < hi - lo) {
      int q = oa[lo + vez[i]];
      float cx, cy, px, py;
      centro(&act[i * 4], &cx, &cy);
      centro(&ant[q * 4], &px, &py);
      if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= R_ORDEN * R_ORDEN) {
        pareja[i] = q;
        usado[q] = 1;
      }
    }
  }
  for (int i = 0; i < n; i++) {
    if (pareja[i] >= 0) continue;
    u64 k = cact[i];
    int lo = desde_clave(oa, nant, cant, k), hi = lo;
    while (hi < nant && cant[oa[hi]] == k) hi++;
    if (lo == hi) continue;
    int lc = desde_clave(oc, n, cact, k), hc = lc;
    while (hc < n && cact[oc[hc]] == k) hc++;
    float r = (hi - lo == 1 && hc - lc == 1) ? R_UNICO : R_VARIOS, mejor = r * r;
    float cx, cy;
    centro(&act[i * 4], &cx, &cy);
    for (int j = lo; j < hi; j++) {
      int q = oa[j];
      if (usado[q]) continue;
      float px, py;
      centro(&ant[q * 4], &px, &py);
      float d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d <= mejor) {
        mejor = d;
        pareja[i] = q;
      }
    }
    if (pareja[i] >= 0) usado[pareja[i]] = 1;
  }
  agrupar();
}

/* Arma la lista de la escena actual (una vez por vuelta) y la empareja con la de la vuelta anterior.
 * Devuelve la cantidad de cuadriláteros; los vértices salen con dibujo_interpolar. */
int dibujo_armar(void) {
  AosVert *tv = ant;
  ant = act;
  act = tv;
  u64 *tc = cant;
  cant = cact;
  cact = tc;
  nant = aos_nquads;
  aos_nquads = aos_nlotes = 0;
  if (!aos_escena) return 0;
  Af id = {1, 0, 0, 1, 0, 0};
  visitar(aos_escena, id, 0);
  emparejar();
  return aos_nquads;
}

/* ¿Cambia algo entre las dos vueltas? (si no, alcanza con dibujar una vez por vuelta) */
int dibujo_movimiento(void) { return movimiento; }
/* para las pruebas: cuánto se movió y giró (grados) el cuadrilátero i desde su pareja; 0 si no tiene */
int dibujo_pareja(int i, float *dx, float *dy, float *giro) {
  if (i < 0 || i >= aos_nquads || pareja[i] < 0) return 0;
  const AosVert *c = &act[i * 4], *p = &ant[pareja[i] * 4];
  float cx, cy, px, py;
  centro(c, &cx, &cy);
  centro(p, &px, &py);
  *dx = cx - px;
  *dy = cy - py;
  float g = atan2f(c[1].y - c[0].y, c[1].x - c[0].x) - atan2f(p[1].y - p[0].y, p[1].x - p[0].x);
  while (g > 3.14159265f) g -= 6.2831853f;
  while (g < -3.14159265f) g += 6.2831853f;
  *giro = g * 57.29578f;
  return 1;
}
/* cuántos cuadriláteros de esta vuelta tienen pareja en la anterior (para las pruebas) */
int dibujo_emparejados(void) {
  int k = 0;
  for (int i = 0; i < aos_nquads; i++) k += pareja[i] >= 0;
  return k;
}

static u32 mezclar_color(u32 p, u32 c, float a) {
  u32 r = 0;
  for (int s = 0; s < 32; s += 8) {
    float x = (float)((p >> s) & 255), y = (float)((c >> s) & 255);
    r |= (u32)(x + (y - x) * a + 0.5f) << s;
  }
  return r;
}

/* Los vértices a dibujar en una fracción `a` (0..1) del camino entre la vuelta anterior y la actual.
 * Una pieza larga (brazo, pierna) interpola sus dos puntas: las articulaciones quedan unidas aunque gire
 * rápido. Una pieza más bien cuadrada (cabeza, bloque, letra) interpola su giro sin achicarse. */
int dibujo_interpolar(float a) {
  int n = aos_nquads;
  if (a >= 1.0f || a < 0.0f) {
    memcpy(aos_verts, act, sizeof(AosVert) * 4 * (size_t)n);
    return n;
  }
  float b = 1.0f - a;
  for (int i = 0; i < n; i++) {
    AosVert *c = &act[i * 4], *o = &aos_verts[i * 4];
    memcpy(o, c, sizeof(AosVert) * 4);
    if (modo[i] == 2) {
      for (int k = 0; k < 4; k++) {
        o[k].x -= desp[i][0] * b;
        o[k].y -= desp[i][1] * b;
      }
      continue;
    }
    if (modo[i] != 1) continue;
    const AosVert *p = &ant[pareja[i] * 4];
    float plx, ply, pcx, pcy, clx, cly, ccx, ccy;
    ejes(p, &plx, &ply, &pcx, &pcy);
    ejes(c, &clx, &cly, &ccx, &ccy);
    float pl = sqrtf(plx * plx + ply * ply), cl = sqrtf(clx * clx + cly * cly);
    float pc = sqrtf(pcx * pcx + pcy * pcy), cc = sqrtf(ccx * ccx + ccy * ccy);
    /* el eje largo: las puntas en línea recta (pieza larga) o el giro sin achicarse (cuadrada) */
    float lx = plx + (clx - plx) * a, ly = ply + (cly - ply) * a;
    if (cl < 1.5f * cc && pl > 1e-4f && cl > 1e-4f) {
      float ll = sqrtf(lx * lx + ly * ly), l = pl + (cl - pl) * a;
      if (ll > 1e-6f) lx = lx / ll * l, ly = ly / ll * l;
    }
    /* el eje corto, perpendicular al largo y del mismo lado que ahora */
    float ll = sqrtf(lx * lx + ly * ly), corto = pc + (cc - pc) * a;
    float sx = 0, sy = 0;
    if (ll > 1e-6f) {
      float lado = clx * ccy - cly * ccx >= 0 ? 1.0f : -1.0f;
      sx = -ly / ll * corto * lado;
      sy = lx / ll * corto * lado;
    }
    /* volver a los lados u, v del cuadrilátero */
    float eux, euy, evx, evy;
    float ux = c[1].x - c[0].x, uy = c[1].y - c[0].y, wx = c[2].x - c[0].x, wy = c[2].y - c[0].y;
    if (ux * ux + uy * uy >= wx * wx + wy * wy) eux = lx, euy = ly, evx = sx, evy = sy;
    else evx = lx, evy = ly, eux = sx, euy = sy;
    float pcx2, pcy2, ccx2, ccy2;
    centro(p, &pcx2, &pcy2);
    centro(c, &ccx2, &ccy2);
    float mx = pcx2 + (ccx2 - pcx2) * a, my = pcy2 + (ccy2 - pcy2) * a;
    float x0 = mx - (eux + evx) * 0.5f, y0 = my - (euy + evy) * 0.5f;
    o[0].x = x0;
    o[0].y = y0;
    o[1].x = x0 + eux;
    o[1].y = y0 + euy;
    o[2].x = x0 + evx;
    o[2].y = y0 + evy;
    o[3].x = x0 + eux + evx;
    o[3].y = y0 + euy + evy;
    if (p[0].rgba != c[0].rgba) {
      u32 col = mezclar_color(p[0].rgba, c[0].rgba, a);
      for (int k = 0; k < 4; k++) o[k].rgba = col;
    }
  }
  return n;
}
