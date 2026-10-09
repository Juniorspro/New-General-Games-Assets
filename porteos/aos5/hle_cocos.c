/* Las piezas de cocos2d-x 3.17 que usa el código traducido, sobre objetos en la memoria del juego.
 *
 * Los objetos tienen el tamaño y los campos del original en los lugares que lee el código ARM
 * (tag, visible, tamaño, rect de la textura…) y su vtable verdadera: las llamadas virtuales van a
 * las direcciones originales de cocos2d y aos_call las manda a las H_* de acá (registro al final).
 * Lo que sólo usa la capa propia (textura, mezcla, texto) vive en la tabla de objetos. */
#include "rec.h"
#include "capa.h"
#include "juego.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define X(i) (C.x[i])
#define W(i) ((u32)C.x[i])
#define SW(i) ((s32)C.x[i])
#define S(i) F32(C.v[i])
#define RET(v) (C.x[0] = (u64)(v))
#define RETF(i, f) (C.v[i] = B32((float)(f)))
#define P(a) ((char *)G2H(a))

/* ------------------------------------------------------------------ campos de cocos2d (arm64) */
#define REF_COUNT 0x08
#define N_ROTX 0x2c
#define N_ROTY 0x30
#define N_SCALEX 0x44
#define N_SCALEY 0x48
#define N_SCALEZ 0x4c
#define N_POS 0x50
#define N_ANCHOR 0x78
#define N_SIZE 0x80
#define N_ZORDER 0x170
#define N_CHILDREN 0x178
#define N_PARENT 0x190
#define N_TAG 0x1a0
#define N_VISIBLE 0x1e9
#define N_DOPACITY 0x208
#define N_OPACITY 0x209
#define N_DCOLOR 0x20a
#define N_COLOR 0x20d
#define S_BLEND 0x304
#define S_TEXTURE 0x310
#define S_RECT 0x3b0
#define S_FLIPX 0x4a1
#define S_FLIPY 0x4a2
#define L_NLINES 0x2b0
#define L_DIRTY 0x2b4
#define L_TEXT 0x2c0
#define L_TTF 0x2d8
#define L_WIDTH 0x3a0
#define L_HEIGHT 0x3a4
#define L_HALIGN 0x3a8
#define L_VALIGN 0x3ac

/* vtables verdaderas (símbolos del .so) */
static u64 VT_SPRITE, VT_LABEL, VT_SCENE, VT_TEX, VT_FRAME, VT_FILEUTILS, VT_GLVIEW, VT_DIRECTOR;

/* ------------------------------------------------------------------ tabla de objetos */
#define TABLA (1 << 16)
static Obj *tabla[TABLA];
static u32 llegadas;

static u32 hsh(u32 a) { return (a * 2654435761u) >> 16; }

Obj *obj_de(u64 a) {
  u32 k = hsh((u32)a);
  for (u32 i = 0; i < TABLA; i++) {
    Obj *o = tabla[(k + i) & (TABLA - 1)];
    if (!o) return NULL;
    if (o->addr == (u32)a) return o;
  }
  return NULL;
}

static Obj *obj_nuevo(u64 a, int tipo) {
  Obj *o = obj_de(a);
  if (o) {
    memset(o, 0, sizeof *o);
  } else {
    o = calloc(1, sizeof *o);
    u32 k = hsh((u32)a);
    for (u32 i = 0;; i++) {
      Obj **s = &tabla[(k + i) & (TABLA - 1)];
      if (!*s) {
        *s = o;
        break;
      }
      if (i == TABLA - 1) aos_trap(a, "tabla de objetos llena");
    }
  }
  o->addr = (u32)a;
  o->tipo = tipo;
  o->img = -1;
  o->bsrc = 1;      /* GL_ONE */
  o->bdst = 0x303;  /* GL_ONE_MINUS_SRC_ALPHA */
  return o;
}

/* ------------------------------------------------------------------ std::string (COW de gnustl) */
static u64 empty_rep(void) { return RD64(0xc0bff0); } /* GOT: std::string::_Rep::_S_empty_rep_storage */

void aos_string_en(u64 dst, const char *s) {
  size_t n = strlen(s);
  if (!n) {
    WR64(dst, empty_rep() + 24);
    return;
  }
  u64 rep = aos_malloc(24 + n + 1);
  WR64(rep, n);
  WR64(rep + 8, n);
  WR32(rep + 16, 0);
  WR32(rep + 20, 0);
  memcpy(G2H(rep + 24), s, n + 1);
  WR64(dst, rep + 24);
}
u64 aos_string_nueva(const char *s) {
  u64 o = aos_malloc(8);
  aos_string_en(o, s);
  return o;
}
const char *aos_string_c(u64 strobj) { return P(RD64(strobj)); }
void aos_string_liberar(u64 strobj) {
  u64 rep = RD64(strobj) - 24;
  if (rep == empty_rep()) return;
  s32 c = (s32)RD32(rep + 16);
  WR32(rep + 16, (u32)(c - 1));
  if (c <= 0) aos_free(rep);
}

/* ------------------------------------------------------------------ nodos */
static void nodo_init(u64 n, u64 vt, int tipo) {
  WR64(n, vt);
  WR32(n + REF_COUNT, 1);
  WRF(n + N_SCALEX, 1);
  WRF(n + N_SCALEY, 1);
  WRF(n + N_SCALEZ, 1);
  WR32(n + N_TAG, (u32)-1);
  WR8(n + N_VISIBLE, 1);
  WR8(n + N_DOPACITY, 255);
  WR8(n + N_OPACITY, 255);
  for (int i = 0; i < 3; i++) {
    WR8(n + N_DCOLOR + i, 255);
    WR8(n + N_COLOR + i, 255);
  }
  obj_nuevo(n, tipo);
}

static void hijos_agregar(u64 padre, u64 hijo) {
  u64 v = padre + N_CHILDREN;
  u64 b = RD64(v), e = RD64(v + 8), cap = RD64(v + 16);
  if (e == cap) {
    u64 n = (e - b) / 8, ncap = n ? n * 2 : 8;
    u64 nb = aos_malloc(ncap * 8);
    if (n) memcpy(G2H(nb), G2H(b), n * 8);
    if (b) aos_free(b);
    b = nb;
    e = nb + n * 8;
    cap = nb + ncap * 8;
    WR64(v, b);
    WR64(v + 16, cap);
  }
  WR64(e, hijo);
  WR64(v + 8, e + 8);
}

static void hijos_quitar(u64 padre, u64 hijo) {
  u64 v = padre + N_CHILDREN;
  u64 b = RD64(v), e = RD64(v + 8);
  for (u64 p = b; p < e; p += 8)
    if (RD64(p) == hijo) {
      memmove(G2H(p), G2H(p + 8), (size_t)(e - p - 8));
      WR64(v + 8, e - 8);
      return;
    }
}

/* ------------------------------------------------------------------ texturas */
#define MAXIMG 8192
static u64 tex_de_img[MAXIMG];

static u64 textura(int img) {
  if (img < 0 || img >= MAXIMG) return 0;
  if (!tex_de_img[img]) {
    u64 t = aos_calloc(1, 0x78);
    WR64(t, VT_TEX);
    WR32(t + REF_COUNT, 1);
    Obj *o = obj_nuevo(t, T_TEXTURA);
    o->img = img;
    tex_de_img[img] = t;
  }
  return tex_de_img[img];
}

static int img_de_tex(u64 t) {
  Obj *o = obj_de(t);
  return o && o->tipo == T_TEXTURA ? o->img : -1;
}

/* Pone textura, rect y tamaño como Sprite::initWithTexture(tex, rect). */
static void sprite_con(u64 s, int img, float rx, float ry, float rw, float rh) {
  Obj *o = obj_de(s);
  if (!o) o = obj_nuevo(s, T_SPRITE);
  o->img = img;
  WR64(s + S_TEXTURE, textura(img));
  WRF(s + S_RECT, rx);
  WRF(s + S_RECT + 4, ry);
  WRF(s + S_RECT + 8, rw);
  WRF(s + S_RECT + 12, rh);
  WRF(s + N_SIZE, rw);
  WRF(s + N_SIZE + 4, rh);
  WRF(s + N_ANCHOR, 0.5f);
  WRF(s + N_ANCHOR + 4, 0.5f);
  int alfa = aos_imagen_alfa(img);
  o->bsrc = alfa ? 1 : 0x302;
  o->bdst = 0x303;
  WR32(s + S_BLEND, o->bsrc);
  WR32(s + S_BLEND + 4, o->bdst);
}

static int sprite_archivo(u64 s, const char *ruta) {
  int w, h;
  int img = aos_imagen(ruta, &w, &h);
  if (img < 0) {
    aos_log("imagen que no está: %s", ruta);
    return 0;
  }
  aos_imagen_pedida(img);
  sprite_con(s, img, 0, 0, (float)w, (float)h);
  return 1;
}

/* ================================================================== Node */
void H__ZN7cocos2d4Node10setVisibleEb(void) { WR8(X(0) + N_VISIBLE, W(1) & 1); }
void H__ZN7cocos2d6Sprite10setVisibleEb(void) { WR8(X(0) + N_VISIBLE, W(1) & 1); }
void H__ZNK7cocos2d4Node9isVisibleEv(void) { RET(RD8(X(0) + N_VISIBLE)); }
void H__ZNK7cocos2d4Node6getTagEv(void) { RET((u64)(u32)RD32(X(0) + N_TAG)); }
void H__ZN7cocos2d4Node6setTagEi(void) { WR32(X(0) + N_TAG, W(1)); }
void H__ZN7cocos2d4Node9getParentEv(void) { RET(RD64(X(0) + N_PARENT)); }
void H__ZN7cocos2d4Node11getChildrenEv(void) { RET(X(0) + N_CHILDREN); }
void H__ZNK7cocos2d4Node16getChildrenCountEv(void) { RET((RD64(X(0) + N_CHILDREN + 8) - RD64(X(0) + N_CHILDREN)) / 8); }
void H__ZNK7cocos2d4Node14getContentSizeEv(void) { RET(X(0) + N_SIZE); }
void H__ZNK7cocos2d4Node11getPositionEv(void) { RET(X(0) + N_POS); }
void H__ZNK7cocos2d4Node14getAnchorPointEv(void) { RET(X(0) + N_ANCHOR); }
void H__ZNK7cocos2d4Node14getLocalZOrderEv(void) { RET((u64)RD32(X(0) + N_ZORDER)); }
void H__ZN7cocos2d4Node10setOpacityEh(void) {
  WR8(X(0) + N_OPACITY, W(1));
  WR8(X(0) + N_DOPACITY, W(1));
}
void H__ZNK7cocos2d4Node10getOpacityEv(void) { RET(RD8(X(0) + N_OPACITY)); }
void H__ZN7cocos2d4Node8setColorERKNS_7Color3BE(void) {
  for (int i = 0; i < 3; i++) {
    WR8(X(0) + N_COLOR + i, RD8(X(1) + i));
    WR8(X(0) + N_DCOLOR + i, RD8(X(1) + i));
  }
}
void H__ZNK7cocos2d4Node8getColorEv(void) { RET(X(0) + N_COLOR); }
static void anchor(u64 n, u64 v) {
  WRF(n + N_ANCHOR, RDF(v));
  WRF(n + N_ANCHOR + 4, RDF(v + 4));
}
void H__ZN7cocos2d6Sprite14setAnchorPointERKNS_4Vec2E(void) { anchor(X(0), X(1)); }
void H__ZN7cocos2d4Node14setAnchorPointERKNS_4Vec2E(void) { anchor(X(0), X(1)); }
static void escala(u64 n, float x, float y) {
  WRF(n + N_SCALEX, x);
  WRF(n + N_SCALEY, y);
}
void H__ZN7cocos2d6Sprite8setScaleEff(void) { escala(X(0), S(0), S(1)); }
void H__ZN7cocos2d4Node8setScaleEff(void) { escala(X(0), S(0), S(1)); }
void H__ZN7cocos2d6Sprite8setScaleEf(void) { escala(X(0), S(0), S(0)); }
void H__ZN7cocos2d4Node8setScaleEf(void) { escala(X(0), S(0), S(0)); }
void H__ZN7cocos2d6Sprite9setScaleXEf(void) { WRF(X(0) + N_SCALEX, S(0)); }
void H__ZN7cocos2d6Sprite9setScaleYEf(void) { WRF(X(0) + N_SCALEY, S(0)); }
void H__ZNK7cocos2d4Node9getScaleXEv(void) { RETF(0, RDF(X(0) + N_SCALEX)); }
void H__ZNK7cocos2d4Node9getScaleYEv(void) { RETF(0, RDF(X(0) + N_SCALEY)); }
static void rotar(u64 n, float r) {
  WRF(n + N_ROTX, r);
  WRF(n + N_ROTY, r);
}
void H__ZN7cocos2d6Sprite11setRotationEf(void) { rotar(X(0), S(0)); }
void H__ZN7cocos2d4Node11setRotationEf(void) { rotar(X(0), S(0)); }
void H__ZNK7cocos2d4Node11getRotationEv(void) { RETF(0, RDF(X(0) + N_ROTX)); }
static void posicion(u64 n, float x, float y) {
  WRF(n + N_POS, x);
  WRF(n + N_POS + 4, y);
}
void H__ZN7cocos2d6Sprite11setPositionERKNS_4Vec2E(void) { posicion(X(0), RDF(X(1)), RDF(X(1) + 4)); }
void H__ZN7cocos2d4Node11setPositionERKNS_4Vec2E(void) { posicion(X(0), RDF(X(1)), RDF(X(1) + 4)); }
void H__ZN7cocos2d6Sprite11setPositionEff(void) { posicion(X(0), S(0), S(1)); }
void H__ZN7cocos2d4Node11setPositionEff(void) { posicion(X(0), S(0), S(1)); }

/* setLocalZOrder: si cambia, el nodo pasa al final entre los de igual z (orden de llegada) */
static void zorden(u64 n, s32 z) {
  if ((s32)RD32(n + N_ZORDER) == z) return;
  WR32(n + N_ZORDER, (u32)z);
  Obj *o = obj_de(n);
  if (o) o->llegada = ++llegadas;
}
void H__ZN7cocos2d4Node14setLocalZOrderEi(void) { zorden(X(0), SW(1)); }
void H__ZN7cocos2d4Node9setZOrderEi(void) { zorden(X(0), SW(1)); }

static void agregar(u64 padre, u64 hijo, s32 z, s32 tag) {
  if (RD64(hijo + N_PARENT)) aos_trap(hijo, "addChild de un nodo que ya tiene padre");
  hijos_agregar(padre, hijo);
  WR64(hijo + N_PARENT, padre);
  WR32(hijo + N_TAG, (u32)tag);
  WR32(hijo + N_ZORDER, (u32)z);
  WR32(hijo + REF_COUNT, RD32(hijo + REF_COUNT) + 1);
  Obj *o = obj_de(hijo);
  if (o) o->llegada = ++llegadas;
}
void H__ZN7cocos2d4Node8addChildEPS0_ii(void) { agregar(X(0), X(1), SW(2), SW(3)); }
void H__ZN7cocos2d6Sprite8addChildEPNS_4NodeEii(void) { agregar(X(0), X(1), SW(2), SW(3)); }
void H__ZN7cocos2d4Node8addChildEPS0_i(void) { agregar(X(0), X(1), SW(2), RD32(X(1) + N_TAG)); }
void H__ZN7cocos2d4Node8addChildEPS0_(void) { agregar(X(0), X(1), RD32(X(1) + N_ZORDER), RD32(X(1) + N_TAG)); }

void H__ZNK7cocos2d4Node13getChildByTagEi(void) {
  u64 v = X(0) + N_CHILDREN;
  for (u64 p = RD64(v); p < RD64(v + 8); p += 8)
    if ((s32)RD32(RD64(p) + N_TAG) == SW(1)) {
      RET(RD64(p));
      return;
    }
  RET(0);
}

static void quitar(u64 padre, u64 hijo) {
  hijos_quitar(padre, hijo);
  WR64(hijo + N_PARENT, 0);
  /* el original lo libera si nadie más lo tiene; acá queda (nadie lo vuelve a usar) */
}
void H__ZN7cocos2d4Node11removeChildEPS0_b(void) { quitar(X(0), X(1)); }
void H__ZN7cocos2d6Sprite11removeChildEPNS_4NodeEb(void) { quitar(X(0), X(1)); }
void H__ZN7cocos2d4Node17removeAllChildrenEv(void) {
  u64 v = X(0) + N_CHILDREN;
  for (u64 p = RD64(v); p < RD64(v + 8); p += 8) WR64(RD64(p) + N_PARENT, 0);
  WR64(v + 8, RD64(v));
}
void H__ZN7cocos2d6Sprite28removeAllChildrenWithCleanupEb(void) { H__ZN7cocos2d4Node17removeAllChildrenEv(); }
void H__ZN7cocos2d4Node16removeFromParentEv(void) {
  u64 p = RD64(X(0) + N_PARENT);
  if (p) quitar(p, X(0));
}

void H__ZN7cocos2d3Ref11autoreleaseEv(void) { RET(X(0)); }
void H__ZN7cocos2d3Ref6retainEv(void) { WR32(X(0) + REF_COUNT, RD32(X(0) + REF_COUNT) + 1); }
void H__ZN7cocos2d3Ref7releaseEv(void) { WR32(X(0) + REF_COUNT, RD32(X(0) + REF_COUNT) - 1); }
void H__ZN7cocos2d4Node6updateEf(void) {}
void H__ZN7cocos2d4Node4initEv(void) { RET(1); }

/* destructores: la memoria la libera el que llama (operator delete) */
void H__ZN7cocos2d6SpriteD2Ev(void) {}
void H__ZN7cocos2d6SpriteD1Ev(void) {}
void H__ZN7cocos2d6SpriteD0Ev(void) { aos_free(X(0)); }
void H__ZN7cocos2d5LabelD2Ev(void) {}
void H__ZN7cocos2d5LabelD1Ev(void) {}
void H__ZN7cocos2d5LabelD0Ev(void) { aos_free(X(0)); }
void H__ZN7cocos2d5SceneD2Ev(void) {}
void H__ZN7cocos2d5SceneD1Ev(void) {}

/* Node::schedule(SEL_SCHEDULE, float): lo que kScene::init pide (updateScene cada 0,06 s) */
void H__ZN7cocos2d4Node8scheduleEMNS_3RefEFvfEf(void) {
  /* puntero a método: x1 = función (o 1 + desplazamiento en la vtable), x2 = ajuste de this */
  juego_programar(X(0), X(1), X(2), S(0));
}

/* ================================================================== Sprite */
void H__ZN7cocos2d6SpriteC2Ev(void) {
  nodo_init(X(0), VT_SPRITE, T_SPRITE);
  WR32(X(0) + S_BLEND, 1);
  WR32(X(0) + S_BLEND + 4, 0x303);
}
void H__ZN7cocos2d6SpriteC1Ev(void) { H__ZN7cocos2d6SpriteC2Ev(); }
void H__ZN7cocos2d6Sprite12initWithFileERKSs(void) { RET(sprite_archivo(X(0), aos_string_c(X(1)))); }
void H__ZN7cocos2d6Sprite15initWithTextureEPNS_9Texture2DE(void) {
  int img = img_de_tex(X(1));
  if (img < 0) {
    RET(0);
    return;
  }
  int w, h;
  aos_imagen_tam(img, &w, &h);
  sprite_con(X(0), img, 0, 0, (float)w, (float)h);
  RET(1);
}
void H__ZN7cocos2d6Sprite19initWithSpriteFrameEPNS_11SpriteFrameE(void) {
  Obj *f = obj_de(X(1));
  if (!f || f->tipo != T_FRAME) {
    RET(0);
    return;
  }
  sprite_con(X(0), f->img, f->fr[0], f->fr[1], f->fr[2], f->fr[3]);
  RET(1);
}
void H__ZNK7cocos2d6Sprite14getSpriteFrameEv(void) {
  Obj *s = obj_de(X(0));
  u64 fr = aos_calloc(1, 0x100);
  WR64(fr, VT_FRAME);
  WR32(fr + REF_COUNT, 1);
  Obj *f = obj_nuevo(fr, T_FRAME);
  f->img = s ? s->img : -1;
  for (int i = 0; i < 4; i++) f->fr[i] = RDF(X(0) + S_RECT + 4 * i);
  RET(fr);
}
void H__ZNK7cocos2d6Sprite10getTextureEv(void) { RET(RD64(X(0) + S_TEXTURE)); }
static void rect_textura(u64 s, u64 r) {
  for (int i = 0; i < 4; i++) WRF(s + S_RECT + 4 * i, RDF(r + 4 * i));
  WRF(s + N_SIZE, RDF(r + 8));
  WRF(s + N_SIZE + 4, RDF(r + 12));
}
void H__ZN7cocos2d6Sprite14setTextureRectERKNS_4RectE(void) { rect_textura(X(0), X(1)); }
void H__ZN7cocos2d6Sprite14setTextureRectERKNS_4RectEbRKNS_4SizeE(void) {
  for (int i = 0; i < 4; i++) WRF(X(0) + S_RECT + 4 * i, RDF(X(1) + 4 * i));
  WRF(X(0) + N_SIZE, RDF(X(3)));
  WRF(X(0) + N_SIZE + 4, RDF(X(3) + 4));
}
void H__ZN7cocos2d6Sprite10setTextureERKSs(void) {
  /* 3.17: setTexture(archivo) cambia la textura y vuelve el rect a la imagen entera (el ancla queda) */
  u64 s = X(0);
  float ax = RDF(s + N_ANCHOR), ay = RDF(s + N_ANCHOR + 4);
  if (sprite_archivo(s, aos_string_c(X(1)))) {
    WRF(s + N_ANCHOR, ax);
    WRF(s + N_ANCHOR + 4, ay);
  }
}
void H__ZN7cocos2d6Sprite10setTextureEPNS_9Texture2DE(void) {
  Obj *o = obj_de(X(0));
  int img = img_de_tex(X(1));
  if (o) o->img = img;
  WR64(X(0) + S_TEXTURE, X(1));
}
void H__ZN7cocos2d6Sprite12setBlendFuncERKNS_9BlendFuncE(void) {
  Obj *o = obj_de(X(0));
  u32 s = RD32(X(1)), d = RD32(X(1) + 4);
  WR32(X(0) + S_BLEND, s);
  WR32(X(0) + S_BLEND + 4, d);
  if (o) {
    o->bsrc = s;
    o->bdst = d;
  }
}
void H__ZN7cocos2d6Sprite11setFlippedXEb(void) { WR8(X(0) + S_FLIPX, W(1) & 1); }
void H__ZN7cocos2d6Sprite11setFlippedYEb(void) { WR8(X(0) + S_FLIPY, W(1) & 1); }
void H__ZN7cocos2d6Sprite4initEv(void) { RET(1); }
void H__ZN7cocos2d6Sprite6createERKSs(void) {
  u64 s = aos_calloc(1, 0x4d0);
  nodo_init(s, VT_SPRITE, T_SPRITE);
  WR32(s + S_BLEND, 1);
  WR32(s + S_BLEND + 4, 0x303);
  if (!sprite_archivo(s, aos_string_c(X(0)))) {
    RET(0);
    return;
  }
  RET(s);
}

/* SpriteFrameCache: el juego no usa hojas de sprites */
void H__ZN7cocos2d16SpriteFrameCache11getInstanceEv(void) { RET(0xF8000100u); }
void H__ZN7cocos2d16SpriteFrameCache20getSpriteFrameByNameERKSs(void) { RET(0); }

/* Texture2D / Image (kScene::makeSprite con carga directa) */
void H__ZN7cocos2d5ImageC1Ev(void) { obj_nuevo(X(0), T_IMAGEN); }
void H__ZN7cocos2d5ImageC2Ev(void) { obj_nuevo(X(0), T_IMAGEN); }
void H__ZN7cocos2d5Image17initWithImageFileERKSs(void) {
  Obj *o = obj_de(X(0));
  int w, h;
  int img = aos_imagen(aos_string_c(X(1)), &w, &h);
  if (o) o->img = img;
  if (img >= 0) aos_imagen_pedida(img);
  RET(img >= 0);
}
void H__ZN7cocos2d5ImageD0Ev(void) {}
void H__ZN7cocos2d9Texture2DC1Ev(void) { WR64(X(0), VT_TEX); obj_nuevo(X(0), T_TEXTURA); }
void H__ZN7cocos2d9Texture2DC2Ev(void) { H__ZN7cocos2d9Texture2DC1Ev(); }
void H__ZN7cocos2d9Texture2D13initWithImageEPNS_5ImageE(void) {
  Obj *i = obj_de(X(1)), *t = obj_de(X(0));
  if (t && i) t->img = i->img;
  RET(i && i->img >= 0);
}

/* ================================================================== Label (kFont) */
static void label_rehacer(u64 l);

void H__ZN7cocos2d5LabelC2ENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  u64 l = X(0);
  nodo_init(l, VT_LABEL, T_LABEL);
  WR32(l + L_HALIGN, W(1));
  WR32(l + L_VALIGN, W(2));
  WRF(l + N_ANCHOR, 0.5f);
  WRF(l + N_ANCHOR + 4, 0.5f);
  aos_string_en(l + L_TEXT, "");
  aos_string_en(l + L_TTF, "");
  WR32(l + L_WIDTH, 0);
  WR32(l + L_HEIGHT, 0);
  Obj *o = obj_de(l);
  o->texto = strdup("");
}
void H__ZN7cocos2d5LabelC1ENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  H__ZN7cocos2d5LabelC2ENS_14TextHAlignmentENS_14TextVAlignmentE();
}
void H__ZN7cocos2d5Label11initWithTTFERKSsS2_fRKNS_4SizeENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  u64 l = X(0);
  Obj *o = obj_de(l);
  const char *ruta = aos_string_c(X(2));
  o->fuente = aos_fuente(ruta);
  o->tam = S(0);
  aos_string_liberar(l + L_TTF);
  aos_string_en(l + L_TTF, ruta);
  WRF(l + L_TTF + 8, S(0));
  WRF(l + L_WIDTH, RDF(X(3)));
  WRF(l + L_HEIGHT, RDF(X(3) + 4));
  WR32(l + L_HALIGN, W(4));
  WR32(l + L_VALIGN, W(5));
  free(o->texto);
  o->texto = strdup(aos_string_c(X(1)));
  aos_string_liberar(l + L_TEXT);
  aos_string_en(l + L_TEXT, o->texto);
  label_rehacer(l);
  RET(1);
}
void H__ZN7cocos2d5Label13createWithTTFERKSsS2_fRKNS_4SizeENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  u64 l = aos_calloc(1, 0x5f0);
  u64 a1 = X(0), a2 = X(1), a3 = X(2), a4 = W(3), a5 = W(4);
  float t = S(0);
  C.x[0] = l;
  C.x[1] = a4;
  C.x[2] = a5;
  H__ZN7cocos2d5LabelC2ENS_14TextHAlignmentENS_14TextVAlignmentE();
  C.x[0] = l;
  C.x[1] = a1;
  C.x[2] = a2;
  C.x[3] = a3;
  C.x[4] = a4;
  C.x[5] = a5;
  C.v[0] = B32(t);
  H__ZN7cocos2d5Label11initWithTTFERKSsS2_fRKNS_4SizeENS_14TextHAlignmentENS_14TextVAlignmentE();
  RET(l);
}
void H__ZN7cocos2d5Label20createWithSystemFontERKSsS2_fRKNS_4SizeENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  H__ZN7cocos2d5Label13createWithTTFERKSsS2_fRKNS_4SizeENS_14TextHAlignmentENS_14TextVAlignmentE();
}
void H__ZN7cocos2d5Label9setStringERKSs(void) {
  u64 l = X(0);
  Obj *o = obj_de(l);
  const char *t = aos_string_c(X(1));
  if (o->texto && !strcmp(o->texto, t)) return;
  free(o->texto);
  o->texto = strdup(t);
  aos_string_liberar(l + L_TEXT);
  aos_string_en(l + L_TEXT, t);
  label_rehacer(l);
  if (getenv("AOS_TEXTOS")) aos_log("texto [%g, fuente %d]: %s", o->tam, o->fuente, t);
}
void H__ZNK7cocos2d5Label9getStringEv(void) { RET(X(0) + L_TEXT); }
void H__ZN7cocos2d5Label12setAlignmentENS_14TextHAlignmentENS_14TextVAlignmentE(void) {
  u64 l = X(0);
  if (RD32(l + L_HALIGN) == W(1) && RD32(l + L_VALIGN) == W(2)) return;
  WR32(l + L_HALIGN, W(1));
  WR32(l + L_VALIGN, W(2));
  label_rehacer(l);
}
void H__ZN7cocos2d5Label13setDimensionsEff(void) {
  u64 l = X(0);
  if (RDF(l + L_WIDTH) == S(0) && RDF(l + L_HEIGHT) == S(1)) return;
  WRF(l + L_WIDTH, S(0));
  WRF(l + L_HEIGHT, S(1));
  label_rehacer(l);
}
void H__ZN7cocos2d5Label17getStringNumLinesEv(void) { RET(RD32(X(0) + L_NLINES)); }
void H__ZNK7cocos2d5Label12getTTFConfigEv(void) { RET(X(0) + L_TTF); }
void H__ZN7cocos2d5Label17setSystemFontNameERKSs(void) {
  Obj *o = obj_de(X(0));
  o->fuente = aos_fuente(aos_string_c(X(1)));
  label_rehacer(X(0));
}
void H__ZN7cocos2d5Label17setSystemFontSizeEf(void) {
  Obj *o = obj_de(X(0));
  o->tam = S(0);
  WRF(X(0) + L_TTF + 8, S(0));
  label_rehacer(X(0));
}
void H__ZN7cocos2d5Label12setTextColorERKNS_7Color4BE(void) {
  Obj *o = obj_de(X(0));
  o->color_texto = RD32(X(1));
}
void H__ZN7cocos2d5Label12setBlendFuncERKNS_9BlendFuncE(void) {
  Obj *o = obj_de(X(0));
  o->bsrc = RD32(X(1));
  o->bdst = RD32(X(1) + 4);
}

/* Arma las líneas como Label::alignText (TTF, con dimensiones = corte por palabras) */
static void label_rehacer(u64 l) {
  Obj *o = obj_de(l);
  if (!o) return;
  float ancho = RDF(l + L_WIDTH), alto = RDF(l + L_HEIGHT);
  Diseno d;
  texto_disenar(o->fuente, o->tam, o->texto ? o->texto : "", ancho, (int)RD32(l + L_HALIGN), &d);
  o->nlineas = d.nlineas;
  o->anchotxt = d.ancho;
  o->altolinea = d.altolinea;
  WR32(l + L_NLINES, (u32)d.nlineas);
  WR8(l + L_DIRTY, 0);
  WRF(l + N_SIZE, ancho > 0 ? ancho : d.ancho);
  WRF(l + N_SIZE + 4, alto > 0 ? alto : d.altolinea * d.nlineas);
}

/* ================================================================== escena, director, ventana */
void H__ZN7cocos2d5SceneC2Ev(void) {
  u64 s = X(0);
  nodo_init(s, VT_SCENE, T_ESCENA);
  WRF(s + N_SIZE, 960);
  WRF(s + N_SIZE + 4, 640);
}
void H__ZN7cocos2d5SceneC1Ev(void) { H__ZN7cocos2d5SceneC2Ev(); }
void H__ZN7cocos2d5Scene4initEv(void) { RET(1); }

static u64 director, glview, dispatcher, fileutils, aplicacion, userdefault, motor_azar;
void H__ZN7cocos2d8Director11getInstanceEv(void) { RET(director); }
void H__ZN7cocos2d8Director20setAnimationIntervalEf(void) {}
void H__ZN7cocos2d8Director13setOpenGLViewEPNS_6GLViewE(void) {}
void H__ZN7cocos2d8Director14startAnimationEv(void) {}
void H__ZN7cocos2d8Director13stopAnimationEv(void) {}
void H__ZN7cocos2d10GLViewImpl6createERKSs(void) { RET(glview); }
void H__ZN7cocos2d6GLView17setGLContextAttrsER14GLContextAttrs(void) {}
/* GLView::getFrameSize: el tamaño de la pantalla en pixeles (el juego lo usa para calcular escalas) */
void H__ZNK7cocos2d6GLView12getFrameSizeEv(void) { /* devuelve Size por valor (x8) */
  float w, h;
  juego_pantalla(&w, &h);
  WRF(X(8), w);
  WRF(X(8) + 4, h);
}
void H__ZN7cocos2d6GLView23setDesignResolutionSizeEff16ResolutionPolicy(void) { juego_politica(W(1)); }
void H__ZNK7cocos2d6GLView23getDesignResolutionSizeEv(void) { RET(glview + 0x18); }
void H__ZNK7cocos2d6Device6getDPIEv(void) { RET(320); }
void H__ZN7cocos2d6Device6getDPIEv(void) { RET(320); }

void H__ZN7cocos2d15EventDispatcher38addEventListenerWithSceneGraphPriorityEPNS_13EventListenerEPNS_4NodeE(void) {}
void H__ZN7cocos2d21EventListenerKeyboard6createEv(void) { RET(aos_calloc(1, 0x200)); }
void H__ZN7cocos2d27EventListenerTouchAllAtOnce6createEv(void) { RET(aos_calloc(1, 0x200)); }

/* Touch::getLocation: los toques los arma juego.c con la posición ya en coordenadas GL */
void H__ZNK7cocos2d5Touch11getLocationEv(void) {
  WRF(X(8), RDF(X(0) + 0x34));
  WRF(X(8) + 4, RDF(X(0) + 0x38));
}

/* ================================================================== colores, rects */
void H__ZN7cocos2d7Color4FC1Effff(void) {
  for (int i = 0; i < 4; i++) WRF(X(0) + 4 * i, F32(C.v[i]));
}
void H__ZN7cocos2d7Color4FC2Effff(void) { H__ZN7cocos2d7Color4FC1Effff(); }
void H__ZN7cocos2d7Color4FC1Ev(void) {
  for (int i = 0; i < 4; i++) WRF(X(0) + 4 * i, 0);
}
void H__ZN7cocos2d7Color4FC2Ev(void) { H__ZN7cocos2d7Color4FC1Ev(); }
void H__ZNK7cocos2d7Color4FeqERKS0_(void) { RET(memcmp(G2H(X(0)), G2H(X(1)), 16) == 0); }
static u8 a_byte(float f) { return (u8)CVT_U32((double)(f * 255.0f)); }
void H__ZN7cocos2d7Color3BC1ERKNS_7Color4FE(void) {
  for (int i = 0; i < 3; i++) WR8(X(0) + i, a_byte(RDF(X(1) + 4 * i)));
}
void H__ZN7cocos2d7Color3BC2ERKNS_7Color4FE(void) { H__ZN7cocos2d7Color3BC1ERKNS_7Color4FE(); }
void H__ZN7cocos2d7Color4BC1Ehhhh(void) {
  for (int i = 0; i < 4; i++) WR8(X(0) + i, W(1 + i));
}
void H__ZN7cocos2d7Color4BC2Ehhhh(void) { H__ZN7cocos2d7Color4BC1Ehhhh(); }
void H__ZN7cocos2d4RectC1Ev(void) { memset(G2H(X(0)), 0, 16); }
void H__ZN7cocos2d4RectC2Ev(void) { memset(G2H(X(0)), 0, 16); }
void H__ZN7cocos2d4RectC1Effff(void) {
  for (int i = 0; i < 4; i++) WRF(X(0) + 4 * i, F32(C.v[i]));
}
void H__ZN7cocos2d4RectC2Effff(void) { H__ZN7cocos2d4RectC1Effff(); }
void H__ZN7cocos2d4RectC1ERKS0_(void) { memmove(G2H(X(0)), G2H(X(1)), 16); }
void H__ZN7cocos2d4RectC2ERKS0_(void) { memmove(G2H(X(0)), G2H(X(1)), 16); }
void H__ZN7cocos2d4RectaSERKS0_(void) {
  memmove(G2H(X(0)), G2H(X(1)), 16);
  RET(X(0));
}
void H__ZNK7cocos2d4Rect6equalsERKS0_(void) { RET(memcmp(G2H(X(0)), G2H(X(1)), 16) == 0); }
void H__ZN7cocos2d4SizeaSERKS0_(void) {
  memmove(G2H(X(0)), G2H(X(1)), 8);
  RET(X(0));
}
void H__ZN7cocos2d4SizeC1Eff(void) {
  WRF(X(0), S(0));
  WRF(X(0) + 4, S(1));
}
void H__ZN7cocos2d4SizeC2Eff(void) { H__ZN7cocos2d4SizeC1Eff(); }

/* ================================================================== cadenas */
void H__ZN7cocos2d11StringUtils8toStringIiEESsT_(void) {
  char b[32];
  snprintf(b, sizeof b, "%d", SW(0));
  aos_string_en(X(8), b);
}
static char fbuf[16384];
void H__ZN7cocos2d11StringUtils6formatEPKcz(void) {
  aos_formatear(fbuf, sizeof fbuf, X(0), 1);
  aos_string_en(X(8), fbuf);
}

/* ================================================================== datos guardados */
void H__ZN7cocos2d11UserDefault11getInstanceEv(void) { RET(userdefault); }
static int ud_int(const char *k, int d) {
  const char *v = aos_dato_texto(k);
  return v ? atoi(v) : d;
}
static void ud_poner_int(const char *k, int v) {
  char b[24];
  snprintf(b, sizeof b, "%d", v);
  aos_dato_poner_texto(k, b);
}
void H__ZN7cocos2d11UserDefault16getIntegerForKeyEPKc(void) { RET((u64)(u32)ud_int(P(X(1)), 0)); }
void H__ZN7cocos2d11UserDefault16getIntegerForKeyEPKci(void) { RET((u64)(u32)ud_int(P(X(1)), SW(2))); }
void H__ZN7cocos2d11UserDefault16setIntegerForKeyEPKci(void) { ud_poner_int(P(X(1)), SW(2)); }
void H__ZN7cocos2d11UserDefault13getBoolForKeyEPKc(void) { RET(ud_int(P(X(1)), 0) != 0); }
void H__ZN7cocos2d11UserDefault13getBoolForKeyEPKcb(void) { RET(ud_int(P(X(1)), W(2) & 1) != 0); }
void H__ZN7cocos2d11UserDefault13setBoolForKeyEPKcb(void) { ud_poner_int(P(X(1)), W(2) & 1); }
void H__ZN7cocos2d11UserDefault14getFloatForKeyEPKcf(void) {
  const char *v = aos_dato_texto(P(X(1)));
  RETF(0, v ? (float)atof(v) : S(0));
}
void H__ZN7cocos2d11UserDefault14setFloatForKeyEPKcf(void) {
  char b[48];
  snprintf(b, sizeof b, "%.9g", S(0));
  aos_dato_poner_texto(P(X(1)), b);
}
void H__ZN7cocos2d11UserDefault15getStringForKeyEPKc(void) {
  const char *v = aos_dato_texto(P(X(1)));
  aos_string_en(X(8), v ? v : "");
}
void H__ZN7cocos2d11UserDefault15getStringForKeyEPKcRKSs(void) {
  const char *v = aos_dato_texto(P(X(1)));
  aos_string_en(X(8), v ? v : aos_string_c(X(2)));
}
void H__ZN7cocos2d11UserDefault15setStringForKeyEPKcRKSs(void) { aos_dato_poner_texto(P(X(1)), aos_string_c(X(2))); }
void H__ZN7cocos2d11UserDefault5flushEv(void) {}

void H__ZN7cocos2d9FileUtils11getInstanceEv(void) { RET(fileutils); }
/* Data: { u8 *bytes; ssize_t size; } */
void H__ZN7cocos2d4DataC1Ev(void) { memset(G2H(X(0)), 0, 16); }
void H__ZN7cocos2d4DataC2Ev(void) { memset(G2H(X(0)), 0, 16); }
void H__ZN7cocos2d4DataD1Ev(void) {
  aos_free(RD64(X(0)));
  memset(G2H(X(0)), 0, 16);
}
void H__ZN7cocos2d4DataD2Ev(void) { H__ZN7cocos2d4DataD1Ev(); }
void H__ZN7cocos2d4Data5clearEv(void) { H__ZN7cocos2d4DataD1Ev(); }
void H__ZNK7cocos2d4Data8getBytesEv(void) { RET(RD64(X(0))); }
void H__ZNK7cocos2d4Data7getSizeEv(void) { RET(RD64(X(0) + 8)); }
void H__ZNK7cocos2d4Data6isNullEv(void) { RET(RD64(X(0)) == 0 || RD64(X(0) + 8) == 0); }
void H__ZN7cocos2d4DataaSEOS0_(void) {
  if (X(0) != X(1)) {
    aos_free(RD64(X(0)));
    memmove(G2H(X(0)), G2H(X(1)), 16);
    memset(G2H(X(1)), 0, 16);
  }
  RET(X(0));
}

/* ================================================================== sonido */
void H__ZN7cocos2d12experimental11AudioEngine6play2dERKSsbfPKNS0_12AudioProfileE(void) {
  RET((u64)(u32)aos_sonido_tocar(aos_string_c(X(0)), W(1) & 1, S(0)));
}
void H__ZN7cocos2d12experimental11AudioEngine7preloadERKSsSt8functionIFvbEE(void) { aos_sonido_cargar(aos_string_c(X(0))); }
void H__ZN7cocos2d12experimental11AudioEngine4stopEi(void) { aos_sonido_parar(SW(0)); }
void H__ZN7cocos2d12experimental11AudioEngine7stopAllEv(void) { aos_sonido_todo(0); }
void H__ZN7cocos2d12experimental11AudioEngine8pauseAllEv(void) { aos_sonido_todo(1); }
void H__ZN7cocos2d12experimental11AudioEngine9resumeAllEv(void) { aos_sonido_todo(2); }
void H__ZN7cocos2d12experimental11AudioEngine3endEv(void) { aos_sonido_todo(0); }

/* ================================================================== azar */
/* std::mt19937 de libstdc++ (unsigned long de 64 bits): 624 palabras de 8 bytes y el índice */
void H__ZN7cocos2d12RandomHelper9getEngineEv(void) { RET(motor_azar); }
static void azar_sembrar(u32 s) {
  u64 x = s;
  WR64(motor_azar, x);
  for (int i = 1; i < 624; i++) {
    x = (1812433253u * (u32)(x ^ (x >> 30)) + (u32)i) & 0xffffffffu;
    WR64(motor_azar + 8 * i, x);
  }
  WR64(motor_azar + 8 * 624, 624);
}

/* ================================================================== aplicación (sin red, sin compras) */
void H__ZN7cocos2d11Application11getInstanceEv(void) { RET(aplicacion); }
void H__ZN7cocos2d11ApplicationC2Ev(void) {}
void H__ZN7cocos2d11ApplicationD2Ev(void) {}
void H__ZN7cocos2d11Application12getNetStatusEv(void) {
  if (getenv("AOS_RED")) aos_log("getNetStatus");
  RET(0);
}
void H__ZN7cocos2d11Application8purchaseEi(void) { juego_compra(SW(1)); }
void H__ZN7cocos2d11Application10setRestoreEv(void) {}
void H__ZN7cocos2d11Application15getPurchaseListEv(void) {} /* pide a Java las compras hechas; no hay */
/* El juego muestra "cargando" y pide un anuncio de pantalla completa (Java elegía la red de avisos);
 * sin publicidad, se le contesta lo que contestaba Android cuando no había anuncio: InterstitialFail,
 * que saca el "cargando" (bzStateGame +0xba8) y deja seguir. */
void H__ZN7cocos2d11Application14OnInterstitialEi(void) {
  static u64 fallo;
  if (!fallo) fallo = aos_simbolo("_Z16InterstitialFailPc");
  if (fallo) juego_encolar(fallo, 0);
}
void H__ZN7cocos2d11Application30RequestLoadRewardAd_DailyBonusEv(void) {}
void H__ZN7cocos2d11Application18SkipGameClearBonusEv(void) {}
void H__ZN7cocos2d11Application20ClearNotificationAllEv(void) {}
void H__ZN7cocos2d11Application20Click_AppsFlyerEventEiSsSs(void) {}
void H__ZN7cocos2d11Application10getSysInfoEi(void) { aos_string_en(X(8), ""); }
/* JNI: nada */
void H__ZN7cocos2d9JniHelper14jstring2stringEP8_jstring(void) { aos_string_en(X(8), ""); }

/* ================================================================== capa k* que no se traduce */
void H__ZN6kScene8httpPostEPKcS1_R11CurlResData(void) {
  if (getenv("AOS_RED")) aos_log("httpPost %s [%.120s]", X(1) ? P(X(1)) : "", X(2) ? P(X(2)) : "");
  RET(0);
}
void H__ZN6kScene12clearResDataEP11CurlResData(void) {}
void H__ZN6kScene10getSysInfoEiPc(void) { WR8(X(2), 0); }
void H__ZN6kScene11setParticleEffi(void) {}

/* ================================================================== FileUtils (virtuales) */
void H__ZNK7cocos2d16FileUtilsAndroid15getWritablePathEv(void) { aos_string_en(X(8), "/guardado/"); }
void H__ZNK7cocos2d9FileUtils19fullPathForFilenameERKSs(void) { aos_string_en(X(8), aos_string_c(X(1))); }
void H__ZN7cocos2d9FileUtils15getDataFromFileERKSs(void) {
  u8 *d;
  u32 n;
  if (aos_archivo_leer(aos_string_c(X(1)), &d, &n)) {
    u64 g = aos_malloc(n + 1);
    memcpy(G2H(g), d, n);
    WR8(g + n, 0);
    free(d);
    WR64(X(8), g);
    WR64(X(8) + 8, n);
  } else {
    WR64(X(8), 0);
    WR64(X(8) + 8, 0);
  }
}
void H__ZN7cocos2d9FileUtils17getStringFromFileERKSs(void) {
  u8 *d;
  u32 n;
  if (aos_archivo_leer(aos_string_c(X(1)), &d, &n)) {
    char *s = malloc(n + 1);
    memcpy(s, d, n);
    s[n] = 0;
    aos_string_en(X(8), s);
    free(s);
    free(d);
  } else
    aos_string_en(X(8), "");
}
void H__ZNK7cocos2d9FileUtils11isFileExistERKSs(void) {
  u8 *d;
  u32 n;
  int ok = aos_archivo_leer(aos_string_c(X(1)), &d, &n);
  if (ok) free(d);
  RET(ok);
}
void H__ZNK7cocos2d16FileUtilsAndroid14isAbsolutePathERKSs(void) { RET(aos_string_c(X(1))[0] == '/'); }


typedef struct {
  u32 addr;
  void (*f)(void);
} Virt;
static Virt *virt;
static int nvirt;

static int cmpv(const void *a, const void *b) {
  u32 x = ((const Virt *)a)->addr, y = ((const Virt *)b)->addr;
  return x < y ? -1 : x > y;
}

int aos_virtual(u64 addr) {
  int lo = 0, hi = nvirt - 1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    if (virt[m].addr == (u32)addr) {
      virt[m].f();
      return 1;
    }
    if (virt[m].addr < (u32)addr) lo = m + 1;
    else hi = m - 1;
  }
  return 0;
}

static u64 simbolo(const char *mangled) {
  for (int i = 0; i < aos_nnombres; i++)
    if (!strcmp(aos_nombres[i].mangled, mangled)) return aos_nombres[i].addr;
  return 0;
}

static u64 objeto_falso(const char *vtable, u64 tam) {
  u64 o = aos_calloc(1, tam);
  u64 vt = simbolo(vtable);
  WR64(o, vt ? vt + 16 : 0);
  WR32(o + REF_COUNT, 1);
  return o;
}

typedef struct {
  const char *n;
  void (*f)(void);
} Reg;
extern const Reg aos_registro[];
extern const int aos_nregistro;

void aos_cocos_init(void) {
  virt = calloc((size_t)aos_nregistro, sizeof *virt);
  nvirt = 0;
  for (int i = 0; i < aos_nregistro; i++) {
    u64 a = simbolo(aos_registro[i].n);
    if (a) virt[nvirt++] = (Virt){(u32)a, aos_registro[i].f};
  }
  qsort(virt, (size_t)nvirt, sizeof *virt, cmpv);
  VT_SPRITE = simbolo("_ZTVN7cocos2d6SpriteE") + 16;
  VT_LABEL = simbolo("_ZTVN7cocos2d5LabelE") + 16;
  VT_SCENE = simbolo("_ZTVN7cocos2d5SceneE") + 16;
  VT_TEX = simbolo("_ZTVN7cocos2d9Texture2DE") + 16;
  VT_FRAME = simbolo("_ZTVN7cocos2d11SpriteFrameE") + 16;
  VT_FILEUTILS = simbolo("_ZTVN7cocos2d16FileUtilsAndroidE") + 16;
  VT_GLVIEW = simbolo("_ZTVN7cocos2d10GLViewImplE") + 16;
  VT_DIRECTOR = simbolo("_ZTVN7cocos2d8DirectorE") + 16;
  glview = objeto_falso("_ZTVN7cocos2d10GLViewImplE", 0x400);
  WRF(glview + 0x18, 960);
  WRF(glview + 0x1c, 640);
  dispatcher = objeto_falso("_ZTVN7cocos2d15EventDispatcherE", 0x200);
  director = objeto_falso("_ZTVN7cocos2d8DirectorE", 0x400);
  WR64(director + 0xf0, dispatcher);
  WR64(director + 0x148, glview);
  fileutils = objeto_falso("_ZTVN7cocos2d16FileUtilsAndroidE", 0x200);
  aplicacion = objeto_falso("_ZTVN7cocos2d11ApplicationE", 0x100);
  userdefault = objeto_falso("_ZTVN7cocos2d11UserDefaultE", 0x100);
  motor_azar = aos_calloc(1, 5008);
  azar_sembrar((u32)aos_ahora_ms());
  aos_log("capa: %d virtuales registradas", nvirt);
}

void aos_cocos_semilla(u32 s) { azar_sembrar(s); }

