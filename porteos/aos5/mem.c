/* Memoria dinámica del juego (el malloc/free que ve el código ARM), dentro de AOS_HEAP_LO..HI.
 *
 * Bloques con cabecera de 16 bytes (tamaño | libre) y pie con el tamaño para juntar vecinos libres.
 * Los tamaños chicos van a listas por clase; los grandes a una lista ordenada. Todo es memoria del
 * juego, así que las direcciones son las mismas en WebAssembly y en la prueba nativa. */
#include "aos.h"
#include <string.h>

#define HDR 16u
#define NCLASES 64 /* 16..1024 de a 16 */

static u32 tope;              /* primer byte sin usar */
static u32 libres[NCLASES];   /* listas por clase (tamaño total del bloque) */
static u32 grandes;           /* lista de bloques grandes libres */
static u64 usados, picos;

#define TAM(b) (RD32(b) & ~15u)
#define LIBRE(b) (RD32(b) & 1u)
#define SIG(b) RD32((b) + 4)  /* en bloques libres: siguiente de la lista */

static void poner(u32 b, u32 tam, int libre) {
  WR32(b, tam | (libre ? 1u : 0u));
  WR32(b + tam - 4, tam);
}

static int clase(u32 tam) { return tam <= NCLASES * 16 ? (int)(tam / 16) - 1 : -1; }

static void meter(u32 b) {
  u32 tam = TAM(b);
  int c = clase(tam);
  if (c >= 0) {
    WR32(b + 4, libres[c]);
    libres[c] = b;
  } else {
    WR32(b + 4, grandes);
    grandes = b;
  }
}

static void sacar(u32 b) {
  u32 tam = TAM(b);
  int c = clase(tam);
  u32 *cab = c >= 0 ? &libres[c] : &grandes;
  if (*cab == b) {
    *cab = RD32(b + 4);
    return;
  }
  for (u32 x = *cab; x; x = RD32(x + 4))
    if (RD32(x + 4) == b) {
      WR32(x + 4, RD32(b + 4));
      return;
    }
  aos_trap(b, "heap: bloque libre que no está en su lista");
}

void aos_heap_init(void) {
  tope = AOS_HEAP_LO;
  memset(libres, 0, sizeof libres);
  grandes = 0;
  usados = picos = 0;
}

u64 aos_malloc(u64 n) {
  u32 tam = (u32)((n + HDR + 4 + 15) & ~15ull);
  if (tam < 32) tam = 32;
  int c = clase(tam);
  u32 b = 0;
  if (c >= 0 && libres[c]) {
    b = libres[c];
    libres[c] = RD32(b + 4);
  } else {
    /* primer bloque grande que alcance */
    u32 ant = 0;
    for (u32 x = grandes; x; ant = x, x = RD32(x + 4))
      if (TAM(x) >= tam) {
        if (ant) WR32(ant + 4, RD32(x + 4));
        else grandes = RD32(x + 4);
        b = x;
        break;
      }
    if (b) {
      u32 sobra = TAM(b) - tam;
      if (sobra >= 64) {
        poner(b + tam, sobra, 1);
        meter(b + tam);
      } else
        tam = TAM(b);
    } else {
      if (tope + tam > AOS_HEAP_HI) aos_trap(n, "heap: sin memoria");
      b = tope;
      tope += tam;
    }
  }
  poner(b, tam, 0);
  usados += tam;
  if (usados > picos) picos = usados;
  return b + HDR;
}

void aos_free(u64 p) {
  if (!p) return;
  u32 b = (u32)p - HDR;
  if (b < AOS_HEAP_LO || b >= tope || LIBRE(b)) aos_trap(p, "free de algo que no es del heap");
  u32 tam = TAM(b);
  usados -= tam;
  /* juntar con el siguiente */
  u32 s = b + tam;
  if (s < tope && LIBRE(s)) {
    sacar(s);
    tam += TAM(s);
  }
  /* y con el anterior */
  if (b > AOS_HEAP_LO) {
    u32 pt = RD32(b - 4);
    u32 a = b - pt;
    if (pt && a >= AOS_HEAP_LO && LIBRE(a) && TAM(a) == pt) {
      sacar(a);
      tam += pt;
      b = a;
    }
  }
  if (b + tam == tope) { /* devolver al final */
    tope = b;
    return;
  }
  poner(b, tam, 1);
  meter(b);
}

u64 aos_malloc_size(u64 p) { return p ? TAM((u32)p - HDR) - HDR - 4 : 0; }

u64 aos_realloc(u64 p, u64 n) {
  if (!p) return aos_malloc(n);
  if (!n) {
    aos_free(p);
    return 0;
  }
  u64 viejo = aos_malloc_size(p);
  if (n <= viejo) return p;
  u64 q = aos_malloc(n);
  memmove(G2H(q), G2H(p), (size_t)viejo);
  aos_free(p);
  return q;
}

u64 aos_calloc(u64 a, u64 b) {
  u64 n = a * b;
  u64 p = aos_malloc(n);
  memset(G2H(p), 0, (size_t)n);
  return p;
}

u64 aos_memalign(u64 al, u64 n) {
  if (al <= 16) return aos_malloc(n);
  /* poco común: se pide de más y no se devuelve el resto */
  u64 p = aos_malloc(n + al);
  return (p + al - 1) & ~(al - 1);
}

void aos_heap_stats(u64 *u, u64 *pico, u64 *top) {
  *u = usados;
  *pico = picos;
  *top = tope;
}
