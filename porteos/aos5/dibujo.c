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
static u8 usado[MAXQ];                   /* de la vuelta anterior: ya es pareja de alguno */
/* cómo se dibuja cada pieza entre las dos vueltas: 0 tal cual, 1 cada pieza a su manera, 2 el grupo
 * entero junto, 3 hueso de un esqueleto (gira en su articulación), 4 pegada a la punta de un hueso */
static u8 modo[MAXQ];
static float desp[MAXQ][2];              /* modo 2: lo que se movió el grupo en la vuelta */
static u8 accesorio[MAXQ];               /* de otro tinte dentro de un muñeco (vincha, arma): no decide */
static int padre[MAXQ];                  /* modo 3: el hueso del que cuelga (-1: la raíz, el torso) */
static u8 punta_p[MAXQ], punta_h[MAXQ];  /* modo 3: por cuál punta del padre y por cuál propia */
static int ancla[MAXQ];                  /* modo 4: el hueso que sigue */
static u8 punta_a[MAXQ];                 /* modo 4: y en cuál de sus puntas */
static int fk[MAXQ], nfk;                /* los huesos, cada padre antes que sus hijos */
static float pa[MAXQ][2][2];             /* modo 3: las puntas en la fracción que se está dibujando */
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

/* El eje largo del cuadrilátero (el de un brazo o una pierna) y el corto. */
static void ejes(const AosVert *v, float *lx, float *ly, float *cx, float *cy) {
  float ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, wx = v[2].x - v[0].x, wy = v[2].y - v[0].y;
  if (ux * ux + uy * uy >= wx * wx + wy * wy) {
    *lx = ux, *ly = uy, *cx = wx, *cy = wy;
  } else {
    *lx = wx, *ly = wy, *cx = ux, *cy = uy;
  }
}
static int cmp_float(const void *a, const void *b) {
  float x = *(const float *)a, y = *(const float *)b;
  return x < y ? -1 : x > y;
}

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

/* La geometría de una pieza: centro, eje largo (de la punta 0 a la 1, en el orden de la textura), eje
 * corto, y sus dos puntas: los centros de las puntas redondeadas, a medio ancho de cada borde (ahí se
 * unen los huesos de un muñeco). */
typedef struct {
  float cx, cy, lx, ly, sx, sy, L, W;
  float e[2][2];
  int larga_u; /* el eje largo es el lado u (vértice 0 → 1) */
} Geo;
static void geo(const AosVert *v, Geo *g) {
  float ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, wx = v[2].x - v[0].x, wy = v[2].y - v[0].y;
  g->larga_u = ux * ux + uy * uy >= wx * wx + wy * wy;
  if (g->larga_u) g->lx = ux, g->ly = uy, g->sx = wx, g->sy = wy;
  else g->lx = wx, g->ly = wy, g->sx = ux, g->sy = uy;
  g->L = sqrtf(g->lx * g->lx + g->ly * g->ly), g->W = sqrtf(g->sx * g->sx + g->sy * g->sy);
  centro(v, &g->cx, &g->cy);
  float k = g->L > g->W ? (g->L - g->W) / (2 * g->L) : 0;
  g->e[0][0] = g->cx - g->lx * k, g->e[0][1] = g->cy - g->ly * k;
  g->e[1][0] = g->cx + g->lx * k, g->e[1][1] = g->cy + g->ly * k;
}
static int larga(const Geo *g) { return g->L >= 1.5f * g->W; }
/* el coseno del giro del eje largo entre las dos vueltas */
static float coseno_giro(const Geo *p, const Geo *c) {
  return p->L < 1e-4f || c->L < 1e-4f ? 1.0f : (p->lx * c->lx + p->ly * c->ly) / (p->L * c->L);
}

/* Dentro de una figura, las piezas iguales (los tramos de brazos y piernas usan la misma imagen) pueden
 * dibujarse en otro orden de una vuelta a otra, y una pierna rápida puede quedar sin pareja. Se reparten
 * de nuevo entre las de la vuelta anterior que estaban en la figura (o libres cerca de ella): gana el
 * reparto que mantiene unidas las mismas puntas que antes (las articulaciones); entre iguales, el que
 * menos cambia respecto del cuerpo (lo que se corrió aparte de la figura y cuánto giró cada una). */
#define R_JUNTA 12.0f
#define H_GIRO -0.866f  /* un hueso puede girar hasta 150° en una vuelta (una patada); más es darse vuelta */
#define H_LARGO 160.0f /* un hueso no pasa de 160 px (los de los muñecos miden 30 a 60) */
#define H_JUNTA 0.85f   /* dos puntas son una articulación si están a menos de 0,85 anchos, en las dos vueltas */
enum { RF_PIEZAS = 48, RF_IGUALES = 5, RF_CAND = 6 };
typedef struct {
  int n, id[RF_IGUALES]; /* piezas de ahora (índices absolutos) */
  int nc, cand[RF_CAND + 1]; /* candidatas de la vuelta anterior */
  Geo gcand[RF_CAND];
} Iguales;
static Geo rf_gc[RF_PIEZAS];
static int rf_a, rf_nj;
static struct { u8 i, u, j, w; float tol; } rf_jun[160];
static Iguales rf_set[RF_PIEZAS];
static int rf_set_de[RF_PIEZAS], rf_elegida[RF_PIEZAS]; /* elegida: candidata, -1 sin pareja, -2 fija */
static Geo rf_fija[RF_PIEZAS];                          /* -2: la pareja que ya tenía */
/* la geometría anterior de la pieza local i según el reparto que se está probando (NULL: sin pareja) */
static const Geo *rf_ant(int i) {
  int c = rf_elegida[i];
  return c == -2 ? (pareja[rf_a + i] >= 0 ? &rf_fija[i] : NULL) : c < 0 ? NULL : &rf_set[rf_set_de[i]].gcand[c];
}
static int rf_juntas(void) {
  int k = 0;
  for (int x = 0; x < rf_nj; x++) {
    const Geo *p = rf_ant(rf_jun[x].i), *q = rf_ant(rf_jun[x].j);
    if (p && q &&
        hypotf(p->e[rf_jun[x].u][0] - q->e[rf_jun[x].w][0], p->e[rf_jun[x].u][1] - q->e[rf_jun[x].w][1]) < rf_jun[x].tol)
      k++;
  }
  return k;
}
static float rf_mejor, rf_mx, rf_my;
static int rf_mejor_elegida[RF_IGUALES], rf_usada[RF_CAND];
static void rf_probar(int s, int d) { /* prueba los repartos del conjunto s desde su pieza d */
  Iguales *g = &rf_set[s];
  if (d == g->n) {
    float v = (float)rf_juntas() * 1e6f;
    for (int k = 0; k < g->n; k++) {
      int c = rf_elegida[g->id[k] - rf_a];
      if (c >= 0) v -= costo(g->id[k], g->cand[c], rf_mx, rf_my);
      else v -= 40000.0f; /* quedar sin pareja cuesta como un salto grande */
    }
    if (v > rf_mejor) {
      rf_mejor = v;
      for (int k = 0; k < g->n; k++) rf_mejor_elegida[k] = rf_elegida[g->id[k] - rf_a];
    }
    return;
  }
  for (int c = 0; c < g->nc; c++)
    if (!rf_usada[c] && coseno_giro(&g->gcand[c], &rf_gc[g->id[d] - rf_a]) >= H_GIRO) { /* dada vuelta, no */
      rf_usada[c] = 1, rf_elegida[g->id[d] - rf_a] = c;
      rf_probar(s, d + 1);
      rf_usada[c] = 0;
    }
  rf_elegida[g->id[d] - rf_a] = -1; /* o sin pareja (algo que aparece) */
  rf_probar(s, d + 1);
}
static void refinar(int a, int b, float mx, float my) {
  int n = b - a;
  if (n > RF_PIEZAS) return;
  rf_a = a, rf_mx = mx, rf_my = my, rf_nj = 0;
  for (int i = 0; i < n; i++) geo(&act[(a + i) * 4], &rf_gc[i]);
  /* las articulaciones de ahora */
  for (int i = 0; i < n; i++)
    for (int j = 0; j < i; j++) {
      if (!larga(&rf_gc[i]) || !larga(&rf_gc[j])) continue;
      float tol = fminf(R_JUNTA, H_JUNTA * fminf(rf_gc[i].W, rf_gc[j].W));
      for (int u = 0; u < 2; u++)
        for (int w = 0; w < 2; w++)
          if (rf_nj < 160 && hypotf(rf_gc[i].e[u][0] - rf_gc[j].e[w][0], rf_gc[i].e[u][1] - rf_gc[j].e[w][1]) < tol)
            rf_jun[rf_nj].i = (u8)i, rf_jun[rf_nj].u = (u8)u, rf_jun[rf_nj].j = (u8)j, rf_jun[rf_nj].w = (u8)w,
            rf_jun[rf_nj++].tol = tol;
    }
  if (!rf_nj) return; /* sin articulaciones no hay con qué decidir mejor */
  /* la caja de la figura en la vuelta anterior, por las parejas que ya tiene */
  float x0 = 1e30f, y0 = 1e30f, x1 = -1e30f, y1 = -1e30f;
  for (int i = a; i < b; i++)
    if (pareja[i] >= 0) {
      float px, py;
      centro(&ant[pareja[i] * 4], &px, &py);
      x0 = fminf(x0, px), y0 = fminf(y0, py), x1 = fmaxf(x1, px), y1 = fmaxf(y1, py);
    }
  if (x0 > x1) return;
  x0 -= 60, y0 -= 60, x1 += 60, y1 += 60;
  /* los conjuntos de piezas iguales, con sus candidatas */
  int ns = 0;
  for (int i = 0; i < n; i++) rf_set_de[i] = -1;
  for (int i = 0; i < n; i++) {
    if (rf_set_de[i] >= 0) continue;
    Iguales *g = &rf_set[ns];
    g->n = 0, g->nc = 0;
    for (int j = i; j < n; j++)
      if (cact[a + j] == cact[a + i]) {
        if (g->n == RF_IGUALES) { g->n = -1; break; }
        rf_set_de[j] = ns, g->id[g->n++] = a + j;
      }
    if (g->n < 0) { /* demasiadas iguales: quedan como están */
      for (int j = i; j < n; j++)
        if (cact[a + j] == cact[a + i]) {
          rf_set_de[j] = ns, rf_elegida[j] = -2;
          if (pareja[a + j] >= 0) geo(&ant[pareja[a + j] * 4], &rf_fija[j]);
        }
      ns++;
      continue;
    }
    for (int k = 0; k < g->n && g->nc <= RF_CAND; k++)
      if (pareja[g->id[k]] >= 0) g->cand[g->nc++] = pareja[g->id[k]];
    for (int q = 0; q < nant && g->nc <= RF_CAND; q++) {
      if (usado[q] || cant[q] != cact[a + i]) continue;
      float px, py;
      centro(&ant[q * 4], &px, &py);
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) g->cand[g->nc++] = q;
    }
    if (g->nc > RF_CAND) { /* demasiadas candidatas: quedan como están */
      for (int k = 0; k < g->n; k++) {
        rf_elegida[g->id[k] - a] = -2;
        if (pareja[g->id[k]] >= 0) geo(&ant[pareja[g->id[k]] * 4], &rf_fija[g->id[k] - a]);
      }
      g->n = -1;
      ns++;
      continue;
    }
    for (int c = 0; c < g->nc; c++) geo(&ant[g->cand[c] * 4], &g->gcand[c]);
    for (int k = 0; k < g->n; k++) {
      rf_elegida[g->id[k] - a] = -1;
      for (int c = 0; c < g->nc; c++)
        if (g->cand[c] == pareja[g->id[k]]) rf_elegida[g->id[k] - a] = c;
    }
    ns++;
  }
  /* por turnos, el mejor reparto de cada conjunto con los demás fijos */
  for (int vuelta = 0; vuelta < 3; vuelta++) {
    int cambio = 0;
    for (int s = 0; s < ns; s++) {
      Iguales *g = &rf_set[s];
      if (g->n <= 0 || (g->n == 1 && g->nc <= 1)) continue;
      int antes[RF_IGUALES];
      for (int k = 0; k < g->n; k++) antes[k] = rf_elegida[g->id[k] - a];
      rf_mejor = -1e30f;
      memset(rf_usada, 0, sizeof rf_usada);
      rf_probar(s, 0);
      for (int k = 0; k < g->n; k++) {
        rf_elegida[g->id[k] - a] = rf_mejor_elegida[k];
        cambio |= rf_mejor_elegida[k] != antes[k];
      }
    }
    if (!cambio) break;
  }
  /* aplicar */
  for (int s = 0; s < ns; s++) {
    Iguales *g = &rf_set[s];
    if (g->n <= 0) continue;
    for (int k = 0; k < g->n; k++)
      if (pareja[g->id[k]] >= 0) usado[pareja[g->id[k]]] = 0;
    for (int k = 0; k < g->n; k++) {
      int c = rf_elegida[g->id[k] - a];
      pareja[g->id[k]] = c >= 0 ? g->cand[c] : -1;
      if (c >= 0) usado[g->cand[c]] = 1;
    }
  }
}

/* Figuras: piezas seguidas en el orden de dibujo, del mismo tinte y pegadas (un muñeco, una fila de
 * bloques, un texto), con lo que tienen encima de otro tinte si es chico (hasta 3 piezas: la vincha, un
 * arma, un destello): el muñeco y su vincha se mueven juntos. Dos tandas largas de distinto tinte son dos
 * figuras (el jugador y un enemigo que se cruzan). */
#define G_PEGADO 80.0f
#define G_DESVIO 40.0f
#define G_ACCESORIO 3
#define G_GIRO_LINEAL 0.7071f /* modo 1 interpola las puntas en línea recta: hasta 45° casi no se achica */
static int cerca(int i, int j) {
  float x0, y0, x1, y1;
  centro(&act[i * 4], &x0, &y0);
  centro(&act[j * 4], &x1, &y1);
  return (x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) <= G_PEGADO * G_PEGADO;
}
/* el contorno de una figura: una pieza es parte si está pegada a la anterior o cae cerca del contorno
 * (en una patada el pie queda lejos de la cabeza, que se dibuja después) */
typedef struct {
  float x0, y0, x1, y1;
} Caja;
static void caja_sumar(Caja *c, int i) {
  for (int k = 0; k < 4; k++) {
    const AosVert *v = &act[i * 4 + k];
    c->x0 = fminf(c->x0, v->x), c->y0 = fminf(c->y0, v->y), c->x1 = fmaxf(c->x1, v->x), c->y1 = fmaxf(c->y1, v->y);
  }
}
#define G_MUNECO 320.0f /* el contorno sólo cuenta en figuras del tamaño de un muñeco (no el cielo) */
static int junto(const Caja *c, int i) {
  float x, y, m = G_PEGADO * 0.5f;
  centro(&act[i * 4], &x, &y);
  return cerca(i - 1, i) || (c->x1 - c->x0 <= G_MUNECO && c->y1 - c->y0 <= G_MUNECO && x >= c->x0 - m &&
                             x <= c->x1 + m && y >= c->y0 - m && y <= c->y1 + m);
}
static int fin_de_tanda(int i, int n, Caja *c) { /* [i, fin): seguidas, del mismo tinte y pegadas */
  int b = i + 1;
  caja_sumar(c, i);
  while (b < n && tinte_q[b] == tinte_q[i] && junto(c, b)) caja_sumar(c, b++);
  return b;
}

/* Lo que se movió la figura [a, b): la mediana de sus piezas propias con pareja (en mx, my). Devuelve
 * cuántas son; en *todas, si todas las propias tienen pareja. */
static int mediana(int a, int b, float *mx, float *my, int *todas) {
  static float dx[MAXQ], dy[MAXQ], t[MAXQ];
  int m = 0;
  *todas = 1;
  for (int i = a; i < b; i++) {
    if (accesorio[i]) continue;
    if (pareja[i] < 0) {
      *todas = 0;
      continue;
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
  }
  return m;
}

/* Un muñeco es un esqueleto: sus huesos (las piezas largas) se unen por las puntas. Si las uniones son
 * las mismas en las dos vueltas, entre vuelta y vuelta cada hueso gira en su articulación sin cambiar
 * de largo (las rodillas no se separan y una pierna que patea no se achica), y la cabeza, la vincha y
 * los puños siguen a la punta del hueso más cercana. */
int dibujo_por_que[8]; /* para las pruebas: por qué una figura de 6 huesos o más no fue esqueleto */
static int esqueleto(int a, int b) {
  enum { MAXH = 40 };
  int id[MAXH], k = 0;
  Geo gc[MAXH], gp[MAXH];
  for (int i = a; i < b; i++) {
    if (accesorio[i]) continue;
    Geo c, p;
    geo(&act[i * 4], &c);
    if (!larga(&c)) continue;
    if (c.L > H_LARGO) return 0; /* no es un muñeco: un fondo, una fila de bloques */
    /* un hueso que aparece en esta vuelta (el juego cambió la imagen de una pierna) ya está en la pose
     * nueva: mezclado con los de la vieja quedaría un muñeco armado con dos poses */
    if (pareja[i] < 0) return 0;
    geo(&ant[pareja[i] * 4], &p);
    if (k == MAXH) return 0;
    if (coseno_giro(&p, &c) < H_GIRO) {
      dibujo_por_que[1]++;
      return 0;
    }
    id[k] = i, gc[k] = c, gp[k] = p, k++;
  }
  if (k < 2) return 0;
  static u8 junta[MAXH][MAXH];
  int grado[MAXH] = {0};
  memset(junta, 0, sizeof junta);
  for (int x = 0; x < k; x++)
    for (int y = 0; y < x; y++) {
      float tol = H_JUNTA * fminf(gc[x].W, gc[y].W);
      for (int u = 0; u < 2; u++)
        for (int w = 0; w < 2; w++)
          if (hypotf(gc[x].e[u][0] - gc[y].e[w][0], gc[x].e[u][1] - gc[y].e[w][1]) < tol &&
              hypotf(gp[x].e[u][0] - gp[y].e[w][0], gp[x].e[u][1] - gp[y].e[w][1]) < tol && !junta[x][y]) {
            junta[x][y] = (u8)(1 + u * 2 + w), junta[y][x] = (u8)(1 + w * 2 + u);
            grado[x]++, grado[y]++;
          }
    }
  int r = 0; /* la raíz: el hueso con más uniones (el torso) */
  for (int x = 1; x < k; x++)
    if (grado[x] > grado[r] || (grado[x] == grado[r] && gc[x].L > gc[r].L)) r = x;
  if (!grado[r]) {
    if (k >= 6) dibujo_por_que[2]++;
    return 0;
  }
  int cola[MAXH], nc = 0;
  u8 visto[MAXH] = {0};
  cola[nc++] = r, visto[r] = 1, padre[id[r]] = -1;
  for (int h = 0; h < nc; h++) {
    int x = cola[h];
    for (int y = 0; y < k; y++)
      if (!visto[y] && junta[x][y]) {
        visto[y] = 1, cola[nc++] = y;
        padre[id[y]] = id[x], punta_p[id[y]] = (u8)((junta[x][y] - 1) >> 1), punta_h[id[y]] = (u8)((junta[x][y] - 1) & 1);
      }
  }
  if (nc * 4 < k * 3) { /* con menos de 3/4 de los huesos unidos no es un muñeco confiable */
    if (k >= 6) dibujo_por_que[3]++;
    return 0;
  }
  if (k >= 6) dibujo_por_que[4]++;
  for (int h = 0; h < nc; h++) modo[id[cola[h]]] = 3, fk[nfk++] = id[cola[h]];
  for (int i = a; i < b; i++) {
    if (modo[i] == 3) continue;
    float cx, cy, mejor = 1e30f;
    centro(&act[i * 4], &cx, &cy);
    for (int h = 0; h < nc; h++)
      for (int u = 0; u < 2; u++) {
        float d = hypotf(cx - gc[cola[h]].e[u][0], cy - gc[cola[h]].e[u][1]);
        if (d < mejor) mejor = d, ancla[i] = id[cola[h]], punta_a[i] = (u8)u;
      }
    modo[i] = 4;
  }
  return 1;
}

/* Cómo se dibuja la figura [a, b) entre las dos vueltas: como esqueleto si lo es; si no, si todas sus
 * piezas tienen pareja, giraron poco y se movieron parecido, cada una a su manera; si no (cambió la
 * pose, entró un bloque nuevo), como está ahora y deslizada entera lo que se movió la mayoría: nunca
 * queda medio muñeco en una pose y medio en otra. */
static void decidir(int a, int b) {
  for (int i = a; i < b; i++) modo[i] = 0;
  float mx, my;
  int todas, m = mediana(a, b, &mx, &my, &todas);
  if (m) {
    refinar(a, b, mx, my); /* el mejor reparto de las piezas iguales */
    m = mediana(a, b, &mx, &my, &todas);
  }
  int cual = 0;
  if (!todas && b - a >= 8) dibujo_por_que[0]++;
  if (m && esqueleto(a, b)) cual = 3;
  else if (todas && m) {
    cual = 1;
    for (int i = a; i < b && cual; i++) {
      if (accesorio[i] || pareja[i] < 0) continue;
      Geo c, p;
      geo(&act[i * 4], &c);
      geo(&ant[pareja[i] * 4], &p);
      if (fabsf(c.cx - p.cx - mx) > G_DESVIO || fabsf(c.cy - p.cy - my) > G_DESVIO ||
          coseno_giro(&p, &c) < (larga(&c) ? G_GIRO_LINEAL : -0.5f))
        cual = 0;
    }
  }
  for (int i = a; i < b; i++) {
    if (cual == 3) {
      if (modo[i] == 4 && pareja[i] < 0) movimiento = 1;
      else if (memcmp(&act[i * 4], &ant[pareja[i] * 4], sizeof(AosVert) * 4)) movimiento = 1;
    } else if (cual == 1 && pareja[i] >= 0) {
      modo[i] = 1;
      if (memcmp(&act[i * 4], &ant[pareja[i] * 4], sizeof(AosVert) * 4)) movimiento = 1;
    } else if (m && (mx != 0 || my != 0)) {
      modo[i] = 2, desp[i][0] = mx, desp[i][1] = my;
      movimiento = 1;
    }
  }
}

static void agrupar(void) {
  int n = aos_nquads;
  movimiento = 0;
  nfk = 0;
  for (int a = 0; a < n;) {
    Caja caja = {1e30f, 1e30f, -1e30f, -1e30f};
    int b = fin_de_tanda(a, n, &caja);
    u32 tinte = tinte_q[a];
    int largo = b - a;
    while (b < n && junto(&caja, b)) {
      Caja con = caja;
      int e = fin_de_tanda(b, n, &con);
      if (tinte_q[b] == tinte) largo += e - b; /* sigue el muñeco después de su vincha */
      else if (largo <= G_ACCESORIO) tinte = tinte_q[b], largo = e - b; /* lo de antes era el accesorio */
      else if (e - b > G_ACCESORIO) break;   /* otra figura */
      b = e, caja = con;
    }
    for (int i = a; i < b; i++) accesorio[i] = tinte_q[i] != tinte;
    decidir(a, b);
    a = b;
  }
}

/* Primero, la k-ésima pieza igual en el orden de dibujo: el juego dibuja cada esqueleto siempre en el
 * mismo orden, así que el brazo sigue siendo el brazo aunque cruce al otro. Si eso da un salto que no
 * puede ser (apareció o se fue algo antes en la lista), la más cercana que quede libre. */
static void emparejar(void) {
  static int oa[MAXQ], oc[MAXQ], vez[MAXQ];
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
/* para las pruebas: la pareja del cuadrilátero i (-1 si no tiene), sus vértices y cómo se interpola */
int dibujo_pareja_de(int i) { return i >= 0 && i < aos_nquads ? pareja[i] : -1; }
int dibujo_nant(void) { return nant; }
int dibujo_modo(int i) { return modo[i]; }
const void *dibujo_vertices(int i, int anterior) { return &(anterior ? ant : act)[i * 4]; }
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

/* Arma los vértices de una pieza con centro (cx, cy), eje largo (lx, ly) y ancho W, del mismo lado que
 * `c` (la pieza en esta vuelta). */
static void armar_pieza(AosVert *o, const AosVert *c, float cx, float cy, float lx, float ly, float W) {
  Geo g;
  geo(c, &g);
  memcpy(o, c, sizeof(AosVert) * 4); /* textura y color de ahora */
  float ll = sqrtf(lx * lx + ly * ly), sx = 0, sy = 0;
  if (ll > 1e-6f) {
    float lado = g.lx * g.sy - g.ly * g.sx >= 0 ? 1.0f : -1.0f;
    sx = -ly / ll * W * lado, sy = lx / ll * W * lado;
  }
  float eux, euy, evx, evy;
  if (g.larga_u) eux = lx, euy = ly, evx = sx, evy = sy;
  else evx = lx, evy = ly, eux = sx, euy = sy;
  float x0 = cx - (eux + evx) * 0.5f, y0 = cy - (euy + evy) * 0.5f;
  o[0].x = x0, o[0].y = y0;
  o[1].x = x0 + eux, o[1].y = y0 + euy;
  o[2].x = x0 + evx, o[2].y = y0 + evy;
  o[3].x = x0 + eux + evx, o[3].y = y0 + euy + evy;
}
static void color_entre(AosVert *o, const AosVert *p, const AosVert *c, float a) {
  if (p[0].rgba == c[0].rgba) return;
  u32 col = mezclar_color(p[0].rgba, c[0].rgba, a);
  for (int k = 0; k < 4; k++) o[k].rgba = col;
}
static float angulo_entre(float a0, float a1, float a) {
  float d = a1 - a0;
  while (d > 3.14159265f) d -= 6.2831853f;
  while (d < -3.14159265f) d += 6.2831853f;
  return a0 + d * a;
}
/* Una pieza sola en la fracción a: el centro en línea recta; una pieza larga interpola sus dos puntas
 * (o, con `entera`, gira sin achicarse, como una cuadrada: cabeza, bloque, letra). */
static void pieza_entre(int i, float a, int entera, AosVert *o) {
  const AosVert *c = &act[i * 4], *p = &ant[pareja[i] * 4];
  Geo gp, gc;
  geo(p, &gp);
  geo(c, &gc);
  float lx = gp.lx + (gc.lx - gp.lx) * a, ly = gp.ly + (gc.ly - gp.ly) * a;
  if ((entera || !larga(&gc)) && gp.L > 1e-4f && gc.L > 1e-4f) {
    float ll = sqrtf(lx * lx + ly * ly), l = gp.L + (gc.L - gp.L) * a;
    if (ll > 1e-6f) lx = lx / ll * l, ly = ly / ll * l;
  }
  armar_pieza(o, c, gp.cx + (gc.cx - gp.cx) * a, gp.cy + (gc.cy - gp.cy) * a, lx, ly, gp.W + (gc.W - gp.W) * a);
  color_entre(o, p, c, a);
}
/* Un hueso en la fracción a: la raíz gira en su centro; los demás cuelgan de la punta de su padre (con
 * la misma distancia que tenían, en línea recta entre las dos vueltas) y giran ahí. El largo no cambia. */
static void hueso_entre(int i, float a, AosVert *o) {
  const AosVert *c = &act[i * 4], *p = &ant[pareja[i] * 4];
  Geo gp, gc;
  geo(p, &gp);
  geo(c, &gc);
  float W = gp.W + (gc.W - gp.W) * a, B0 = gp.L - gp.W, B1 = gc.L - gc.W, B = B0 + (B1 - B0) * a;
  if (padre[i] < 0) {
    float ang = angulo_entre(atan2f(gp.ly, gp.lx), atan2f(gc.ly, gc.lx), a);
    float cx = gp.cx + (gc.cx - gp.cx) * a, cy = gp.cy + (gc.cy - gp.cy) * a, hx = cosf(ang) * B * 0.5f, hy = sinf(ang) * B * 0.5f;
    pa[i][0][0] = cx - hx, pa[i][0][1] = cy - hy, pa[i][1][0] = cx + hx, pa[i][1][1] = cy + hy;
  } else {
    int q = padre[i], j = punta_p[i], h = punta_h[i];
    Geo qp, qc;
    geo(&ant[pareja[q] * 4], &qp);
    geo(&act[q * 4], &qc);
    float ox = (gp.e[h][0] - qp.e[j][0]) + ((gc.e[h][0] - qc.e[j][0]) - (gp.e[h][0] - qp.e[j][0])) * a;
    float oy = (gp.e[h][1] - qp.e[j][1]) + ((gc.e[h][1] - qc.e[j][1]) - (gp.e[h][1] - qp.e[j][1])) * a;
    float sx = pa[q][j][0] + ox, sy = pa[q][j][1] + oy;
    float ang = angulo_entre(atan2f(gp.e[1 - h][1] - gp.e[h][1], gp.e[1 - h][0] - gp.e[h][0]),
                             atan2f(gc.e[1 - h][1] - gc.e[h][1], gc.e[1 - h][0] - gc.e[h][0]), a);
    pa[i][h][0] = sx, pa[i][h][1] = sy;
    pa[i][1 - h][0] = sx + cosf(ang) * B, pa[i][1 - h][1] = sy + sinf(ang) * B;
  }
  float dx = pa[i][1][0] - pa[i][0][0], dy = pa[i][1][1] - pa[i][0][1], d = sqrtf(dx * dx + dy * dy), L = B + W;
  float lx = d > 1e-4f ? dx / d * L : gc.lx, ly = d > 1e-4f ? dy / d * L : gc.ly;
  armar_pieza(o, c, (pa[i][0][0] + pa[i][1][0]) * 0.5f, (pa[i][0][1] + pa[i][1][1]) * 0.5f, lx, ly, W);
  color_entre(o, p, c, a);
}

/* Los vértices a dibujar en una fracción `a` (0..1) del camino entre la vuelta anterior y la actual. */
int dibujo_interpolar(float a) {
  int n = aos_nquads;
  if (a >= 1.0f || a < 0.0f) {
    memcpy(aos_verts, act, sizeof(AosVert) * 4 * (size_t)n);
    return n;
  }
  float b = 1.0f - a;
  for (int k = 0; k < nfk; k++) hueso_entre(fk[k], a, &aos_verts[fk[k] * 4]); /* los padres primero */
  for (int i = 0; i < n; i++) {
    AosVert *c = &act[i * 4], *o = &aos_verts[i * 4];
    switch (modo[i]) {
      case 1: pieza_entre(i, a, 0, o); break;
      case 2:
        memcpy(o, c, sizeof(AosVert) * 4);
        for (int k = 0; k < 4; k++) o[k].x -= desp[i][0] * b, o[k].y -= desp[i][1] * b;
        break;
      case 3: break;
      case 4: {
        /* sigue a la punta de su hueso: lo que esa punta se corre de la línea recta (o, si la pieza es
         * nueva, de donde está ahora) */
        int q = ancla[i], j = punta_a[i];
        Geo qp, qc;
        geo(&ant[pareja[q] * 4], &qp);
        geo(&act[q * 4], &qc);
        float lx = qc.e[j][0], ly = qc.e[j][1];
        if (pareja[i] >= 0) {
          pieza_entre(i, a, 1, o);
          lx = qp.e[j][0] + (qc.e[j][0] - qp.e[j][0]) * a, ly = qp.e[j][1] + (qc.e[j][1] - qp.e[j][1]) * a;
        } else
          memcpy(o, c, sizeof(AosVert) * 4);
        for (int k = 0; k < 4; k++) o[k].x += pa[q][j][0] - lx, o[k].y += pa[q][j][1] - ly;
        break;
      }
      default: memcpy(o, c, sizeof(AosVert) * 4);
    }
  }
  return n;
}
