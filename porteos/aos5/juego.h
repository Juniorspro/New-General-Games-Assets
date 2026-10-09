/* Lo que comparten la capa de cocos2d (hle_cocos.c), el juego (juego.c) y el dibujo. */
#pragma once
#include "capa.h"

enum { T_NADA, T_NODO, T_SPRITE, T_LABEL, T_ESCENA, T_TEXTURA, T_FRAME, T_IMAGEN };

typedef struct Obj {
  u32 addr;
  u8 tipo;
  int img;          /* sprite/textura/frame: imagen */
  float fr[4];      /* frame: rect */
  u32 bsrc, bdst;   /* mezcla */
  u32 llegada;      /* orden de llegada (para igual z) */
  /* etiqueta */
  char *texto;
  int fuente;
  float tam;
  int nlineas;
  float anchotxt, altolinea;
  u32 color_texto;
} Obj;

Obj *obj_de(u64 addr);
int aos_virtual(u64 addr);
void aos_cocos_semilla(u32 s);

/* imágenes (tabla generada desde el APK) */
int aos_imagen_alfa(int img);
void aos_imagen_tam(int img, int *w, int *h);
/* bytes del archivo original de assets/ que no se publica como archivo (0 si no es uno de ésos) */
u32 aos_tam_original(const char *ruta);
/* página del atlas, esquina de la imagen en uv y uv por pixel (si todavía no estaba, la pide) */
int aos_imagen_atlas(int img, u32 *pagina, float *pu, float *pv, float *su, float *sv);
int aos_imagen_lugar(int img, int *pagina, int *x, int *y); /* para las pruebas */
int aos_atlas_lado(void);
void aos_atlas_reiniciar(void);

/* dibujo.c */
typedef struct {
  float a, b, c, d, tx, ty; /* x' = a x + c y + tx ; y' = b x + d y + ty */
} Af;
void dibujo_quad(Af m, float x0, float y0, float x1, float y1, float u0, float v0, float u1, float v1,
                 u32 rgba, u32 pagina, int mezcla);
int dibujo_armar(void);

/* texto (texto.c) */
typedef struct {
  int nlineas;
  float ancho, altolinea;
} Diseno;
int aos_fuente(const char *ruta);
void texto_disenar(int fuente, float tam, const char *s, float ancho_max, int halign, Diseno *d);

/* juego.c */
void juego_programar(u64 obj, u64 fn, u64 ajuste, float intervalo);
void juego_encolar(u64 fn, u64 arg);        /* una llamada del "lado Java", antes de la vuelta siguiente */
u64 aos_simbolo(const char *mangled);        /* dirección de una función del juego por su nombre */
void juego_salir(void);
void juego_pantalla(float *w, float *h);
void juego_politica(u32 p);
void juego_compra(int que);
