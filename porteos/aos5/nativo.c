/* Prueba sin navegador: corre el juego traducido en la máquina (x86-64), con la memoria del juego en
 * su dirección real, y cuenta lo que dibuja. Sirve para encontrar rápido lo que falta en la capa.
 *
 *   nativo <imagen.bin> <carpeta assets del APK> [vueltas] [guion]
 *
 * El guion son toques: "t:x,y@vuelta" (tocar y soltar en coordenadas del juego 960×640, y para abajo),
 * "a@vuelta" (atrás), "d@vuelta" (volcar lo dibujado). */
#define _GNU_SOURCE
#include "rec.h"
#include "juego.h"
#include <dirent.h>
#include <execinfo.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <time.h>

int juego_iniciar(u32 semilla);
int juego_paso(double dt);
void juego_toque(int fase, int n, const float *xy);
void juego_atras(void);
const char *aos_nombre(u64 a);
extern int aos_nquads, aos_nlotes;

static const char *assets;
static u64 reloj_ms = 1760000000000ull; /* reloj falso: avanza con el juego */

void aos_log(const char *fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  fprintf(stderr, "· ");
  vfprintf(stderr, fmt, ap);
  fprintf(stderr, "\n");
  va_end(ap);
}

void aos_trap(u64 addr, const char *msg) {
  fprintf(stderr, "TRAMPA en %#llx (%s): %s\n", (unsigned long long)addr, aos_nombre(addr), msg);
  void *bt[64];
  int n = backtrace(bt, 64);
  backtrace_symbols_fd(bt, n, 2);
  exit(3);
}

u64 aos_ahora_ms(void) { return reloj_ms; }
void aos_hora_local(s64 t, int tm[9]) {
  time_t tt = (time_t)t;
  struct tm r;
  gmtime_r(&tt, &r);
  int v[9] = {r.tm_sec, r.tm_min, r.tm_hour, r.tm_mday, r.tm_mon, r.tm_year, r.tm_wday, r.tm_yday, 0};
  memcpy(tm, v, sizeof v);
}

/* imágenes y medidas de letras: las tablas de armar-datos.py (tablas.c); las letras no se dibujan */
const char *aos_imagen_ruta(int i);
static void quitar_prefijos(const char **r) {
  while (**r == '/') (*r)++;
  if (!strncmp(*r, "assets/", 7)) *r += 7;
}
int aos_glifo(int f, u32 cp, float tam, u32 *pagina, float uv[4], float caja[4]) {
  (void)f;
  (void)cp;
  (void)tam;
  *pagina = 0xffff;
  uv[0] = uv[1] = uv[2] = uv[3] = 0;
  caja[0] = caja[1] = 0;
  caja[2] = caja[3] = 1;
  return 1;
}

/* ------------------------------------------------------------------ sonido y archivos */
int aos_sonido_tocar(const char *ruta, int bucle, float vol) {
  static int id;
  if (getenv("AOS_SONIDO")) aos_log("sonido %s%s %.2f", ruta, bucle ? " (bucle)" : "", vol);
  return ++id;
}
void aos_sonido_parar(int id) { (void)id; }
void aos_sonido_todo(int q) { (void)q; }
void aos_sonido_cargar(const char *ruta) { (void)ruta; }
void aos_vibrar(int ms) { (void)ms; }

int aos_archivo_leer(const char *nombre, u8 **datos, u32 *largo) {
  char p[1024];
  const char *r = nombre;
  quitar_prefijos(&r);
  if (!strncmp(r, "guardado/", 9)) snprintf(p, sizeof p, "/tmp/aos5-guardado/%s", r + 9);
  else snprintf(p, sizeof p, "%s/%s", assets, r);
  FILE *f = fopen(p, "rb");
  if (!f) return 0;
  fseek(f, 0, SEEK_END);
  long n = ftell(f);
  fseek(f, 0, SEEK_SET);
  *datos = malloc((size_t)n + 1);
  *largo = (u32)fread(*datos, 1, (size_t)n, f);
  fclose(f);
  return 1;
}
void aos_archivo_escribir(const char *nombre, const u8 *datos, u32 largo) {
  char p[1024];
  const char *r = nombre;
  quitar_prefijos(&r);
  if (!strncmp(r, "guardado/", 9)) r += 9;
  mkdir("/tmp/aos5-guardado", 0755);
  snprintf(p, sizeof p, "/tmp/aos5-guardado/%s", r);
  FILE *f = fopen(p, "wb");
  if (!f) return;
  fwrite(datos, 1, largo, f);
  fclose(f);
}
static struct {
  char k[64];
  char v[256];
} datos[512];
static int ndatos;
const char *aos_dato_texto(const char *k) {
  for (int i = 0; i < ndatos; i++)
    if (!strcmp(datos[i].k, k)) return datos[i].v;
  return NULL;
}
void aos_dato_poner_texto(const char *k, const char *v) {
  int i;
  for (i = 0; i < ndatos; i++)
    if (!strcmp(datos[i].k, k)) break;
  if (i == ndatos) {
    if (ndatos == 512) return;
    snprintf(datos[ndatos++].k, 64, "%s", k);
  }
  snprintf(datos[i].v, 256, "%s", v);
}

/* ------------------------------------------------------------------ volcado */
extern struct AosVert {
  float x, y, u, v;
  u32 rgba;
} aos_verts[];
extern struct AosLote {
  u32 pagina, mezcla, desde, n;
} aos_lotes[];

/* qué imagen del atlas cae en ese punto de la página (para saber qué se dibujó) */
typedef struct {
  const char *ruta;
  u16 w, h;
  u8 alfa, pagina;
  u16 x, y;
  u32 tam;
} AosImg;
extern const AosImg aos_imgs[];
extern const int aos_nimgs;
extern const u16 aos_paginas[][2];
static const char *imagen_en(u32 pagina, float u, float v) {
  if (pagina >= 1000) return "(letra)";
  float px = u * aos_paginas[pagina][0], py = v * aos_paginas[pagina][1];
  for (int i = 0; i < aos_nimgs; i++) {
    const AosImg *m = &aos_imgs[i];
    if (m->pagina == pagina && px >= m->x - 0.5f && px <= m->x + m->w + 0.5f && py >= m->y - 0.5f &&
        py <= m->y + m->h + 0.5f)
      return m->ruta;
  }
  return "(atlas)";
}

static void volcar(int vuelta) {
  printf("== vuelta %d: %d cuadriláteros en %d lotes\n", vuelta, aos_nquads, aos_nlotes);
  for (int l = 0; l < aos_nlotes; l++) {
    struct AosLote *L = &aos_lotes[l];
    for (u32 q = 0; q < L->n; q++) {
      struct AosVert *v = &aos_verts[L->desde + q * 4];
      const char *n = imagen_en(L->pagina, (v[0].u + v[1].u + v[2].u + v[3].u) / 4,
                                (v[0].v + v[1].v + v[2].v + v[3].v) / 4);
      printf("  %-34s m%u (%.0f,%.0f)-(%.0f,%.0f) %08x\n", n, L->mezcla, v[2].x, 640 - v[2].y, v[1].x,
             640 - v[1].y, v[0].rgba);
    }
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "uso: nativo imagen.bin assets [vueltas] [guion]\n");
    return 2;
  }
  assets = argv[2];
  if (getenv("AOS_RELOJ")) reloj_ms = strtoull(getenv("AOS_RELOJ"), NULL, 10); /* ms desde 1970 */
  int vueltas = argc > 3 ? atoi(argv[3]) : 100;
  const char *guion = argc > 4 ? argv[4] : "";
  /* memoria del juego en su lugar */
  void *m = mmap((void *)0x900000, 0x4000000 - 0x900000, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED_NOREPLACE, -1, 0);
  if (m != (void *)0x900000) {
    perror("mmap");
    return 1;
  }
  FILE *f = fopen(argv[1], "rb");
  if (!f) {
    perror(argv[1]);
    return 1;
  }
  u32 hdr[6];
  if (fread(hdr, 4, 6, f) != 6 || memcmp(hdr, "AOSi", 4)) {
    fprintf(stderr, "imagen.bin rara\n");
    return 1;
  }
  if (fread(G2H(hdr[2]), 1, hdr[3], f) != hdr[3] || fread(G2H(hdr[4]), 1, hdr[5], f) != hdr[5]) {
    fprintf(stderr, "imagen.bin corta\n");
    return 1;
  }
  fclose(f);
  if (getenv("AOS_VIGILAR")) aos_dato_poner_texto("vigilar", getenv("AOS_VIGILAR"));
  if (!juego_iniciar(12345)) {
    fprintf(stderr, "no arrancó la escena\n");
    return 1;
  }
  for (int v = 1; v <= vueltas; v++) {
    reloj_ms += 60;
    /* guion */
    char tok[64];
    const char *g = guion;
    int n;
    while (sscanf(g, "%63s%n", tok, &n) == 1) {
      g += n;
      int at;
      float x, y;
      if (sscanf(tok, "t:%f,%f@%d", &x, &y, &at) == 3 && at == v) {
        float xy[2] = {x, 640 - y};
        juego_toque(0, 1, xy);
        juego_toque(2, 1, xy);
        printf("-- toque (%.0f,%.0f) en la vuelta %d\n", x, y, v);
      } else if (sscanf(tok, "a@%d", &at) == 1 && at == v) {
        juego_atras();
        printf("-- atrás en la vuelta %d\n", v);
      } else if (sscanf(tok, "d@%d", &at) == 1 && at == v) {
        dibujo_armar();
        volcar(v);
      }
    }
    juego_paso(0.06);
    int q = dibujo_armar();
    if (v % 10 == 0 || v < 5) {
      u64 u, p, t;
      aos_heap_stats(&u, &p, &t);
      printf("vuelta %d: %d cuadriláteros, %d lotes, heap %llu KB\n", v, q, aos_nlotes, (unsigned long long)u / 1024);
    }
  }
  dibujo_armar();
  volcar(vueltas);
  return 0;
}
