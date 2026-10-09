/* El anfitrión en la web: lo que la capa le pide al sistema (registro, reloj, archivos, sonido, letras)
 * va a funciones de JavaScript (host.js), y JavaScript maneja el juego con las aos_* exportadas. */
#include "rec.h"
#include "juego.h"
#include <emscripten.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int juego_iniciar(u32 semilla);
int juego_paso(double dt);
void juego_toque(int fase, int n, const float *xy);
void juego_atras(void);
void juego_fondo(int oculta);
void juego_tamano_pantalla(float w, float h);
int juego_politica_actual(void);
float juego_fraccion(void);
int juego_salir_pedido(void);
int aos_mezcla(int i, int cual);
int aos_nmezclas(void);
extern int aos_nquads, aos_nlotes;
extern char aos_verts[], aos_lotes[];

/* host.js */
extern void host_log(const char *s);
extern void host_trap(const char *s);
extern double host_ahora(void);
extern void host_hora_local(double t, int *tm);
extern int host_sonido_tocar(const char *ruta, int bucle, float vol);
extern void host_sonido_parar(int id);
extern void host_sonido_todo(int q);
extern void host_sonido_cargar(const char *ruta);
extern int host_guardado_leer(const char *nombre, u8 **datos);
extern void host_guardado_escribir(const char *nombre, const u8 *d, u32 n);
extern char *host_dato(const char *clave);
extern void host_dato_poner(const char *clave, const char *v);
extern void host_vibrar(int ms);
extern int host_glifo(int fuente, u32 cp, float tam, float *out);
extern void host_imagen_subir(int img, int pagina, int x, int y, u32 off, u32 len);
extern void host_atlas_vaciar(void);
extern void host_abrir_url(const char *url);

void aos_log(const char *fmt, ...) {
  char b[1024];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(b, sizeof b, fmt, ap);
  va_end(ap);
  host_log(b);
}

void aos_trap(u64 addr, const char *msg) {
  char b[700];
  snprintf(b, sizeof b, "%s (en %#llx, %s)", msg, (unsigned long long)addr, aos_nombre(addr));
  host_trap(b);
  abort();
}

u64 aos_ahora_ms(void) { return (u64)host_ahora(); }
void aos_hora_local(s64 t, int tm[9]) { host_hora_local((double)t, tm); }
int aos_sonido_tocar(const char *ruta, int bucle, float vol) { return host_sonido_tocar(ruta, bucle, vol); }
void aos_sonido_parar(int id) { host_sonido_parar(id); }
void aos_sonido_todo(int q) { host_sonido_todo(q); }
void aos_sonido_cargar(const char *ruta) { host_sonido_cargar(ruta); }
void aos_vibrar(int ms) { host_vibrar(ms); }
void aos_imagen_subir(int img, int pagina, int x, int y, u32 off, u32 len) { host_imagen_subir(img, pagina, x, y, off, len); }
void aos_atlas_vaciar(void) { host_atlas_vaciar(); }
void aos_abrir_url(const char *url) { host_abrir_url(url); }

/* ---- datos.bin: los archivos de assets/data del APK */
static u8 *paquete;
static u32 npaquete; /* tamaño (para revisar que el índice no se pase) */

EMSCRIPTEN_KEEPALIVE void *aos_reservar(u32 n) { return malloc(n); }
EMSCRIPTEN_KEEPALIVE void aos_paquete(u8 *p, u32 n) {
  paquete = p;
  npaquete = n;
}

static int del_paquete(const char *ruta, u8 **d, u32 *n) {
  if (!paquete || npaquete < 4) return 0;
  u32 cnt;
  memcpy(&cnt, paquete, 4);
  u8 *p = paquete + 4;
  u32 off = 0;
  /* el índice y después los datos, en el mismo orden */
  u8 *q = p;
  for (u32 i = 0; i < cnt; i++) {
    u16 ln;
    memcpy(&ln, q, 2);
    q += 2 + ln + 4;
  }
  u8 *cuerpo = q;
  for (u32 i = 0; i < cnt; i++) {
    u16 ln;
    u32 sz;
    memcpy(&ln, p, 2);
    memcpy(&sz, p + 2 + ln, 4);
    if (strlen(ruta) == ln && !memcmp(p + 2, ruta, ln)) {
      *d = malloc(sz + 1);
      memcpy(*d, cuerpo + off, sz);
      *n = sz;
      return 1;
    }
    off += sz;
    p += 2 + ln + 4;
  }
  return 0;
}

int aos_archivo_leer(const char *nombre, u8 **d, u32 *n) {
  const char *r = nombre;
  while (*r == '/') r++;
  if (!strncmp(r, "guardado/", 9)) {
    int k = host_guardado_leer(r + 9, d);
    if (k < 0) return 0;
    *n = (u32)k;
    return 1;
  }
  if (!strncmp(r, "assets/", 7)) r += 7;
  if (del_paquete(r, d, n)) return 1;
  /* Las imágenes van en el atlas y los sonidos en ogg: si el juego abre uno de ésos recibe un archivo en
   * blanco del tamaño original. Sólo los mide: bzStateGame::imgLoad compara el tamaño de MenuUi[136],
   * [163] y [181] con el del APK y, si no coincide (APK modificado), borra el progreso de las etapas. */
  u32 t = aos_tam_original(r);
  if (!t) return 0;
  *d = calloc(t + 1, 1);
  *n = t;
  return 1;
}

void aos_archivo_escribir(const char *nombre, const u8 *d, u32 n) {
  const char *r = nombre;
  while (*r == '/') r++;
  if (!strncmp(r, "guardado/", 9)) r += 9;
  host_guardado_escribir(r, d, n);
}

/* UserDefault: lo guarda JavaScript; acá queda una copia para devolver punteros estables */
const char *aos_dato_texto(const char *clave) {
  static char *ult[8];
  static int i;
  char *v = host_dato(clave);
  if (!v) return NULL;
  free(ult[i]);
  ult[i] = v;
  i = (i + 1) & 7;
  return v;
}
void aos_dato_poner_texto(const char *clave, const char *v) { host_dato_poner(clave, v); }

int aos_glifo(int fuente, u32 cp, float tam, u32 *pagina, float uv[4], float caja[4]) {
  float out[9];
  if (!host_glifo(fuente, cp, tam, out)) return 0;
  *pagina = (u32)out[0];
  for (int i = 0; i < 4; i++) {
    uv[i] = out[1 + i];
    caja[i] = out[5 + i];
  }
  return 1;
}

/* ---- lo que llama JavaScript */
EMSCRIPTEN_KEEPALIVE int aos_iniciar(u32 semilla, float w, float h) {
  juego_tamano_pantalla(w, h);
  return juego_iniciar(semilla);
}
EMSCRIPTEN_KEEPALIVE int aos_paso(double dt) { return juego_paso(dt); }
EMSCRIPTEN_KEEPALIVE int aos_armar(void) { return dibujo_armar(); }
EMSCRIPTEN_KEEPALIVE int aos_interpolar(float a) { return dibujo_interpolar(a); }
EMSCRIPTEN_KEEPALIVE float aos_fraccion(void) { return juego_fraccion(); }
EMSCRIPTEN_KEEPALIVE int aos_movimiento(void) { return dibujo_movimiento(); }
EMSCRIPTEN_KEEPALIVE int aos_emparejados(void) { return dibujo_emparejados(); }
/* para las pruebas: cómo se interpola la pieza i (0 tal cual, 1 sola, 2 con su figura, 3 hueso, 4 pegada) */
EMSCRIPTEN_KEEPALIVE int aos_modo(int i) { return dibujo_modo(i); }
EMSCRIPTEN_KEEPALIVE void *aos_verts_ptr(void) { return aos_verts; }
EMSCRIPTEN_KEEPALIVE void *aos_lotes_ptr(void) { return aos_lotes; }
EMSCRIPTEN_KEEPALIVE int aos_lotes_n(void) { return aos_nlotes; }
EMSCRIPTEN_KEEPALIVE void aos_toque(int fase, int n, float *xy) { juego_toque(fase, n, xy); }
EMSCRIPTEN_KEEPALIVE void aos_atras(void) { juego_atras(); }
EMSCRIPTEN_KEEPALIVE void aos_fondo(int oculta) { juego_fondo(oculta); }
EMSCRIPTEN_KEEPALIVE int aos_politica(void) { return juego_politica_actual(); }
EMSCRIPTEN_KEEPALIVE int aos_salir(void) { return juego_salir_pedido(); }
EMSCRIPTEN_KEEPALIVE int aos_blend(int i, int cual) { return aos_mezcla(i, cual); }
EMSCRIPTEN_KEEPALIVE int aos_nblend(void) { return aos_nmezclas(); }
EMSCRIPTEN_KEEPALIVE void aos_pantalla(float w, float h) { juego_tamano_pantalla(w, h); }
EMSCRIPTEN_KEEPALIVE int aos_atlas(void) { return aos_atlas_lado(); }
extern u64 aos_escena;
EMSCRIPTEN_KEEPALIVE u32 aos_escena_dir(void) { return (u32)aos_escena; } /* para las pruebas */
EMSCRIPTEN_KEEPALIVE void aos_reiniciar_atlas(void) { aos_atlas_reiniciar(); }
EMSCRIPTEN_KEEPALIVE void aos_heap(u32 *out) {
  u64 u, p, t;
  aos_heap_stats(&u, &p, &t);
  out[0] = (u32)u;
  out[1] = (u32)p;
  out[2] = (u32)t;
}
