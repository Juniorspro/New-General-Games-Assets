/* Arranque, reloj, toques y tecla atrás: lo que hacían Android y el Director de cocos2d. */
#include "rec.h"
#include "juego.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

AosRegs C;
u64 aos_escena;                       /* el bzStateGame que corre (Director::runWithScene) */
static u64 prog_obj, prog_fn, prog_aj;
static float prog_int;
static double acum = -1;
static int politica;                  /* ResolutionPolicy: 0 EXACT_FIT (estirado), 2 SHOW_ALL */
static float pant_w = 1600, pant_h = 720;
static int salir_pedido;
static u64 f_toque[4], f_tecla, app_obj;

/* ------------------------------------------------------------------ nombres y errores */
const char *aos_nombre(u64 a) {
  int lo = 0, hi = aos_nnombres - 1, r = -1;
  while (lo <= hi) {
    int m = (lo + hi) / 2;
    if (aos_nombres[m].addr <= (u32)a) {
      r = m;
      lo = m + 1;
    } else
      hi = m - 1;
  }
  return r >= 0 ? aos_nombres[r].name : "?";
}

u64 aos_simbolo(const char *mangled);
static u64 simbolo(const char *mangled) { return aos_simbolo(mangled); }
u64 aos_simbolo(const char *mangled) {
  for (int i = 0; i < aos_nnombres; i++)
    if (!strcmp(aos_nombres[i].mangled, mangled)) return aos_nombres[i].addr;
  aos_log("falta el símbolo %s", mangled);
  return 0;
}

void aos_bad_call(u64 a) {
  if (aos_virtual(a)) return;
  char b[300];
  snprintf(b, sizeof b, "llamada a %#llx (%s) sin reemplazo", (unsigned long long)a, aos_nombre(a));
  aos_trap(a, b);
}

#define NFALTAN 512
static const char *faltan[NFALTAN];
static int nfaltan;
void aos_missing(const char *n) {
  for (int i = 0; i < nfaltan; i++)
    if (faltan[i] == n) {
      C.x[0] = 0;
      return;
    }
  if (nfaltan < NFALTAN) faltan[nfaltan++] = n;
  aos_log("sin reemplazo (devuelve 0): %s", n);
  C.x[0] = 0;
}

#ifdef AOS_DEPURAR
/* la palabra vigilada: avisa entre qué dos puntos del código traducido cambió */
static u64 vig_dir, vig_pc;
static u32 vig_ult;
void aos_vigia(u64 pc) {
  if (vig_dir) {
    u32 v = RD32(vig_dir);
    if (v != vig_ult) {
      aos_log("vigía [%#llx]: %d -> %d entre %#llx (%s) y %#llx (%s)", (unsigned long long)vig_dir, (int)vig_ult,
              (int)v, (unsigned long long)vig_pc, aos_nombre(vig_pc), (unsigned long long)pc, aos_nombre(pc));
      vig_ult = v;
    }
  }
  vig_pc = pc;
}
#endif

/* ------------------------------------------------------------------ llamar código del juego */
static void llamar(u64 fn) {
  C.sp = AOS_STACK_HI - 0x100;
  aos_call(fn);
}

/* ------------------------------------------------------------------ cocos2d → acá */
void H__ZN7cocos2d8Director12runWithSceneEPNS_5SceneE(void) { aos_escena = C.x[1]; }
void H__ZN7cocos2d8Director3endEv(void) { salir_pedido = 1; }
void juego_salir(void) { salir_pedido = 1; }
void juego_programar(u64 obj, u64 fn, u64 aj, float intervalo) {
  prog_obj = obj;
  prog_fn = fn;
  prog_aj = aj;
  prog_int = intervalo;
  acum = -1;
  aos_log("programado %s cada %.3f s", aos_nombre(fn), intervalo);
}
void juego_pantalla(float *w, float *h) {
  *w = pant_w;
  *h = pant_h;
}
void juego_politica(u32 p) { politica = (int)p; }
void juego_compra(int que) { aos_log("compra %d: no hay tienda", que); }

/* ------------------------------------------------------------------ lo que llama el anfitrión */
int juego_politica_actual(void) { return politica; }
int juego_salir_pedido(void) { return salir_pedido; }

void juego_tamano_pantalla(float w, float h) {
  pant_w = w;
  pant_h = h;
}

int juego_iniciar(u32 semilla) {
#ifdef AOS_DEPURAR
  {
    const char *v = aos_dato_texto("vigilar");
    if (v) vig_dir = strtoull(v, NULL, 0);
  }
#endif
  aos_heap_init();
  WR64(AOS_TLS + 0x28, 0x2b992ddfa23249d6ULL);
  C.sp = AOS_STACK_HI - 0x100;
  aos_cocos_init();
  if (semilla) aos_cocos_semilla(semilla);
  for (int i = 0; i < aos_ninits; i++) llamar(aos_inits[i]);
  u64 app = app_obj = aos_calloc(1, 0x40);
  C.x[0] = app;
  llamar(simbolo("_ZN11AppDelegate29applicationDidFinishLaunchingEv"));
  f_toque[0] = simbolo("_ZN6kScene10onTouchesBERKSt6vectorIPN7cocos2d5TouchESaIS3_EEPNS1_5EventE");
  f_toque[1] = simbolo("_ZN6kScene10onTouchesMERKSt6vectorIPN7cocos2d5TouchESaIS3_EEPNS1_5EventE");
  f_toque[2] = simbolo("_ZN6kScene10onTouchesEERKSt6vectorIPN7cocos2d5TouchESaIS3_EEPNS1_5EventE");
  f_toque[3] = simbolo("_ZN6kScene10onTouchesCERKSt6vectorIPN7cocos2d5TouchESaIS3_EEPNS1_5EventE");
  f_tecla = simbolo("_ZN6kScene12onKeyPressedEN7cocos2d13EventKeyboard7KeyCodeEPNS0_5EventE");
  aos_log("escena %#llx, actualización %s", (unsigned long long)aos_escena, aos_nombre(prog_fn));
  return aos_escena != 0;
}

/* Llamadas que el anfitrión (Java en el original) hace al juego, como los avisos de los videos:
 * van antes de la vuelta siguiente, como en el hilo de GL de cocos2d. */
static struct {
  u64 fn, arg;
} cola[32];
static int ncola;
void juego_encolar(u64 fn, u64 arg) {
  if (ncola < 32) {
    cola[ncola].fn = fn;
    cola[ncola].arg = arg;
    ncola++;
  }
}
static void vaciar_cola(void) {
  for (int i = 0; i < ncola; i++) {
    C.x[0] = cola[i].arg;
    llamar(cola[i].fn);
  }
  ncola = 0;
}

/* Una vuelta del programador de cocos2d (Timer::update de 3.17): devuelve cuántas veces corrió el
 * juego. `dt` es el tiempo real desde la vuelta anterior. */
int juego_paso(double dt) {
  if (!prog_fn) return 0;
  vaciar_cola();
  if (acum < 0) {
    acum = 0;
    return 0;
  }
  acum += dt;
  int n = 0;
  while (acum >= prog_int) {
    u64 fn = prog_fn, obj = prog_obj + (prog_aj >> 1);
    if (prog_aj & 1) fn = RD64(RD64(obj) + fn); /* puntero a método virtual (ABI de ARM) */
    C.x[0] = obj;
    C.v[0] = B32(prog_int);
    llamar(fn);
    acum -= prog_int;
    if (++n == 5) { /* no recuperar más de 0,3 s de una vez */
      acum = 0;
      break;
    }
  }
  return n;
}

/* Qué fracción de la vuelta siguiente ya pasó (0..1): dónde dibujar entre la anterior y la actual. */
float juego_fraccion(void) { return prog_int > 0 && acum > 0 ? (float)(acum / prog_int) : 0.0f; }

/* Toques: `xy` en coordenadas GL del diseño (960×640, y para arriba), como Touch::getLocation. */
void juego_toque(int fase, int n, const float *xy) {
  static u64 vec, arr, t[16];
  if (!vec) {
    vec = aos_calloc(1, 24);
    arr = aos_calloc(16, 8);
    for (int i = 0; i < 16; i++) t[i] = aos_calloc(1, 0x80);
  }
  if (n > 16) n = 16;
  for (int i = 0; i < n; i++) {
    WRF(t[i] + 0x34, xy[2 * i]);
    WRF(t[i] + 0x38, xy[2 * i + 1]);
    WR64(arr + 8 * i, t[i]);
  }
  WR64(vec, arr);
  WR64(vec + 8, arr + 8 * n);
  WR64(vec + 16, arr + 8 * n);
  C.x[0] = aos_escena;
  C.x[1] = vec;
  C.x[2] = 0;
  llamar(f_toque[fase & 3]);
}

/* La página se oculta o vuelve: lo que en Android eran onPause/onResume → AppDelegate. Al irse, el
 * juego guarda (bzStateGame::adMassage(2): tiempos, ítems y etapas) y pausa el sonido. */
void juego_fondo(int oculta) {
  static u64 f[2];
  if (!f[0]) {
    f[0] = simbolo("_ZN11AppDelegate30applicationWillEnterForegroundEv");
    f[1] = simbolo("_ZN11AppDelegate29applicationDidEnterBackgroundEv");
  }
  if (!app_obj || !f[oculta != 0]) return;
  C.x[0] = app_obj;
  llamar(f[oculta != 0]);
}

void juego_atras(void) {
  C.x[0] = aos_escena;
  C.x[1] = 6; /* EventKeyboard::KeyCode::KEY_BACK */
  C.x[2] = 0;
  llamar(f_tecla);
}
