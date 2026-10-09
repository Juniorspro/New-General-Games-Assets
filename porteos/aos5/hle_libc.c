/* libc, libm y el runtime de C++ que importa libMyGame.so, sobre la memoria del juego.
 * Cada H_* lee sus argumentos de C.x/C.v como la función original y deja el resultado en x0/v0. */
#include "rec.h"
#include "capa.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define X(i) (C.x[i])
#define W(i) ((u32)C.x[i])
#define SW(i) ((s32)C.x[i])
#define S(i) F32(C.v[i])
#define D(i) F64(C.v[i])
#define RET(v) (C.x[0] = (u64)(v))
#define RETF(f) (C.v[0] = B32((float)(f)))
#define RETD(d) (C.v[0] = B64((double)(d)))
#define P(a) ((char *)G2H(a))

/* ---------------------------------------------------------------- memoria */
void H_malloc(void) { RET(aos_malloc(X(0))); }
void H_free(void) { aos_free(X(0)); }
void H_calloc(void) { RET(aos_calloc(X(0), X(1))); }
void H_realloc(void) { RET(aos_realloc(X(0), X(1))); }
void H_memalign(void) { RET(aos_memalign(X(0), X(1))); }
void H__Znwm(void) { RET(aos_malloc(X(0) ? X(0) : 1)); }
void H__Znam(void) { RET(aos_malloc(X(0) ? X(0) : 1)); }
void H__ZnwmRKSt9nothrow_t(void) { RET(aos_malloc(X(0) ? X(0) : 1)); }
void H__ZnamRKSt9nothrow_t(void) { RET(aos_malloc(X(0) ? X(0) : 1)); }
void H__ZdlPv(void) { aos_free(X(0)); }
void H__ZdaPv(void) { aos_free(X(0)); }
void H__ZdlPvRKSt9nothrow_t(void) { aos_free(X(0)); }
void H__ZdaPvRKSt9nothrow_t(void) { aos_free(X(0)); }

void H_memcpy(void) { memmove(G2H(X(0)), G2H(X(1)), (size_t)X(2)); }
void H_memmove(void) { memmove(G2H(X(0)), G2H(X(1)), (size_t)X(2)); }
void H_memset(void) { memset(G2H(X(0)), (int)W(1), (size_t)X(2)); }
void H_memcmp(void) { RET((s64)memcmp(G2H(X(0)), G2H(X(1)), (size_t)X(2))); }
void H_memchr(void) {
  void *r = memchr(G2H(X(0)), (int)W(1), (size_t)X(2));
  RET(r ? H2G(r) : 0);
}
void H_memrchr(void) {
  u8 *p = G2H(X(0));
  u64 n = X(2);
  u8 c = (u8)W(1);
  u64 r = 0;
  while (n--)
    if (p[n] == c) {
      r = X(0) + n;
      break;
    }
  RET(r);
}
void H_strlen(void) { RET(strlen(P(X(0)))); }
void H_strcmp(void) { RET((s64)strcmp(P(X(0)), P(X(1)))); }
void H_strncmp(void) { RET((s64)strncmp(P(X(0)), P(X(1)), (size_t)X(2))); }
void H_strcasecmp(void) { RET((s64)strcasecmp(P(X(0)), P(X(1)))); }
void H_strcpy(void) { strcpy(P(X(0)), P(X(1))); }
void H_strncpy(void) { strncpy(P(X(0)), P(X(1)), (size_t)X(2)); }
void H_strcat(void) { strcat(P(X(0)), P(X(1))); }
void H_strchr(void) {
  char *r = strchr(P(X(0)), (int)W(1));
  RET(r ? H2G(r) : 0);
}
void H_strrchr(void) {
  char *r = strrchr(P(X(0)), (int)W(1));
  RET(r ? H2G(r) : 0);
}
void H_strstr(void) {
  char *r = strstr(P(X(0)), P(X(1)));
  RET(r ? H2G(r) : 0);
}
void H_strdup(void) {
  size_t n = strlen(P(X(0))) + 1;
  u64 d = aos_malloc(n);
  memcpy(G2H(d), P(X(0)), n);
  RET(d);
}
void H_strtok_r(void) {
  char *save = (char *)G2H(RD64(X(2)));
  char *s = X(0) ? P(X(0)) : (RD64(X(2)) ? save : NULL);
  if (!s) {
    RET(0);
    return;
  }
  const char *dl = P(X(1));
  s += strspn(s, dl);
  if (!*s) {
    WR64(X(2), H2G(s));
    RET(0);
    return;
  }
  char *e = s + strcspn(s, dl);
  if (*e) {
    *e = 0;
    WR64(X(2), H2G(e + 1));
  } else
    WR64(X(2), H2G(e));
  RET(H2G(s));
}
void H_atoi(void) { RET((s64)atoi(P(X(0)))); }
void H_atol(void) { RET((s64)atol(P(X(0)))); }
void H_atof(void) { RETD(atof(P(X(0)))); }
void H_strtol(void) {
  char *end;
  long v = strtol(P(X(0)), &end, (int)W(2));
  if (X(1)) WR64(X(1), H2G(end));
  RET((s64)v);
}
void H_strtoul(void) {
  char *end;
  unsigned long v = strtoul(P(X(0)), &end, (int)W(2));
  if (X(1)) WR64(X(1), H2G(end));
  RET((u64)v);
}
void H_strtod(void) {
  char *end;
  double v = strtod(P(X(0)), &end);
  if (X(1)) WR64(X(1), H2G(end));
  RETD(v);
}
void H_strtof(void) {
  char *end;
  float v = strtof(P(X(0)), &end);
  if (X(1)) WR64(X(1), H2G(end));
  RETF(v);
}
void H_tolower(void) { RET((u64)(u32)tolower((int)W(0))); }
void H_toupper(void) { RET((u64)(u32)toupper((int)W(0))); }
void H_isalpha(void) { RET(((W(0) | 32) - 'a') < 26u); }
void H_isalnum(void) { RET(((W(0) | 32) - 'a') < 26u || (W(0) - '0') < 10u); }
void H_isspace(void) { RET(W(0) == ' ' || (W(0) - 9u) < 5u); }
void H_isdigit(void) { RET((W(0) - '0') < 10u); }
void H_wctob(void) { RET(W(0) < 128 ? (u64)W(0) : (u64)(s64)-1); }
void H_btowc(void) { RET(W(0) < 128 ? (u64)W(0) : (u64)(u32)-1); }
void H_wctype(void) { RET(1); }

/* ---------------------------------------------------- printf con los argumentos del ARM */
/* Los argumentos variables van como los otros en AAPCS64: enteros en x, flotantes en v, después pila. */
typedef struct {
  int gr, vr;
  u64 pila;
} Va;

static u64 va_int(Va *va) {
  if (va->gr < 8) return C.x[va->gr++];
  u64 v = RD64(va->pila);
  va->pila += 8;
  return v;
}
static double va_dbl(Va *va) {
  if (va->vr < 8) return F64(C.v[va->vr++]);
  double d = F64(RD64(va->pila));
  va->pila += 8;
  return d;
}

/* Arma el texto de `fmt` (memoria del juego) en `out`; los argumentos empiezan en x[gr]. */
size_t aos_formatear(char *out, size_t cap, u64 fmt, int gr) {
  Va va = {gr, 0, C.sp};
  const char *f = P(fmt);
  size_t n = 0;
  char spec[32], tmp[512];
#define PONER(s, l)                                       \
  do {                                                    \
    size_t _l = (l);                                      \
    if (n + _l >= cap) _l = n < cap - 1 ? cap - 1 - n : 0; \
    memcpy(out + n, (s), _l);                             \
    n += _l;                                              \
  } while (0)
  while (*f) {
    if (*f != '%') {
      PONER(f, 1);
      f++;
      continue;
    }
    if (f[1] == '%') {
      PONER("%", 1);
      f += 2;
      continue;
    }
    const char *ini = f++;
    int k = 0;
    spec[k++] = '%';
    while (*f && strchr("-+ #0", *f)) spec[k++] = *f++;
    if (*f == '*') {
      k += snprintf(spec + k, sizeof spec - k, "%d", (int)va_int(&va));
      f++;
    } else
      while (*f >= '0' && *f <= '9') spec[k++] = *f++;
    if (*f == '.') {
      spec[k++] = *f++;
      if (*f == '*') {
        k += snprintf(spec + k, sizeof spec - k, "%d", (int)va_int(&va));
        f++;
      } else
        while (*f >= '0' && *f <= '9') spec[k++] = *f++;
    }
    int largo = 0; /* 0 int, 1 long, 2 long long, -1 short, -2 char */
    while (*f && strchr("hlLqjzt", *f)) {
      if (*f == 'l' || *f == 'q' || *f == 'j' || *f == 'z' || *f == 't') largo++;
      if (*f == 'h') largo--;
      f++;
    }
    char c = *f ? *f++ : 0;
    int l = 0;
    switch (c) {
      case 'd':
      case 'i': {
        u64 v = va_int(&va);
        long long sv = largo >= 1 ? (long long)(s64)v : largo == -1 ? (short)v : largo <= -2 ? (signed char)v : (int)(s32)v;
        spec[k++] = 'l';
        spec[k++] = 'l';
        spec[k++] = c;
        spec[k] = 0;
        l = snprintf(tmp, sizeof tmp, spec, sv);
        break;
      }
      case 'u':
      case 'x':
      case 'X':
      case 'o': {
        u64 v = va_int(&va);
        unsigned long long uv = largo >= 1 ? v : largo == -1 ? (unsigned short)v : largo <= -2 ? (unsigned char)v : (u32)v;
        spec[k++] = 'l';
        spec[k++] = 'l';
        spec[k++] = c;
        spec[k] = 0;
        l = snprintf(tmp, sizeof tmp, spec, uv);
        break;
      }
      case 'c': {
        spec[k++] = 'c';
        spec[k] = 0;
        l = snprintf(tmp, sizeof tmp, spec, (int)va_int(&va));
        break;
      }
      case 's': {
        u64 p = va_int(&va);
        spec[k++] = 's';
        spec[k] = 0;
        l = snprintf(tmp, sizeof tmp, spec, p ? P(p) : "(null)");
        break;
      }
      case 'p': {
        l = snprintf(tmp, sizeof tmp, "0x%llx", (unsigned long long)va_int(&va));
        break;
      }
      case 'f':
      case 'F':
      case 'e':
      case 'E':
      case 'g':
      case 'G':
      case 'a':
      case 'A': {
        spec[k++] = c;
        spec[k] = 0;
        l = snprintf(tmp, sizeof tmp, spec, va_dbl(&va));
        break;
      }
      case 'n':
        va_int(&va);
        break;
      default:
        PONER(ini, (size_t)(f - ini));
        continue;
    }
    if (l < 0) l = 0;
    if (l > (int)sizeof tmp - 1) l = (int)sizeof tmp - 1;
    PONER(tmp, (size_t)l);
  }
  if (cap) out[n < cap ? n : cap - 1] = 0;
  return n;
#undef PONER
}

static char fbuf[16384];
void H_sprintf(void) {
  size_t n = aos_formatear(fbuf, sizeof fbuf, X(1), 2);
  memcpy(P(X(0)), fbuf, n + 1);
  RET(n);
}
void H_snprintf(void) {
  size_t n = aos_formatear(fbuf, sizeof fbuf, X(2), 3);
  u64 cap = X(1);
  if (cap) {
    size_t m = n < cap - 1 ? n : (size_t)cap - 1;
    memcpy(P(X(0)), fbuf, m);
    P(X(0))[m] = 0;
  }
  RET(n);
}
void H___android_log_print(void) {
  aos_formatear(fbuf, sizeof fbuf, X(2), 3);
  aos_log("[%s] %s", P(X(1)), fbuf);
  RET(0);
}
void H__ZN7cocos2d3logEPKcz(void) {
  aos_formatear(fbuf, sizeof fbuf, X(0), 1);
  aos_log("%s", fbuf);
}

/* sscanf: sólo enteros, flotantes y cadenas, que es lo que usa el juego */
void H_sscanf(void) {
  const char *s = P(X(0)), *f = P(X(1));
  Va va = {2, 0, C.sp};
  int asignados = 0;
  while (*f) {
    if (*f == ' ') {
      while (*s == ' ' || *s == '\t' || *s == '\n') s++;
      f++;
      continue;
    }
    if (*f != '%') {
      if (*s != *f) break;
      s++;
      f++;
      continue;
    }
    f++;
    int largo = 0;
    while (*f == 'l' || *f == 'h') {
      if (*f == 'l') largo++;
      f++;
    }
    char c = *f++;
    while (*s == ' ' || *s == '\t' || *s == '\n') s++;
    char *e;
    if (c == 'd' || c == 'i' || c == 'u' || c == 'x') {
      long long v = strtoll(s, &e, c == 'x' ? 16 : 10);
      if (e == s) break;
      u64 dst = va_int(&va);
      if (largo >= 1) WR64(dst, (u64)v);
      else WR32(dst, (u32)v);
      s = e;
      asignados++;
    } else if (c == 'f' || c == 'g' || c == 'e') {
      double v = strtod(s, &e);
      if (e == s) break;
      u64 dst = va_int(&va);
      if (largo >= 1) WR64(dst, B64(v));
      else WRF(dst, (float)v);
      s = e;
      asignados++;
    } else if (c == 's') {
      u64 dst = va_int(&va);
      char *d = P(dst);
      while (*s && *s != ' ' && *s != '\t' && *s != '\n') *d++ = *s++;
      *d = 0;
      asignados++;
    } else
      break;
  }
  RET(asignados);
}

/* ------------------------------------------------------------------ matemática */
void H_sinf(void) { RETF(sinf(S(0))); }
void H_cosf(void) { RETF(cosf(S(0))); }
void H_tanf(void) { RETF(tanf(S(0))); }
void H_atanf(void) { RETF(atanf(S(0))); }
void H_atan2f(void) { RETF(atan2f(S(0), S(1))); }
void H_asinf(void) { RETF(asinf(S(0))); }
void H_acosf(void) { RETF(acosf(S(0))); }
void H_sqrtf(void) { RETF(sqrtf(S(0))); }
void H_powf(void) { RETF(powf(S(0), S(1))); }
void H_expf(void) { RETF(expf(S(0))); }
void H_fmodf(void) { RETF(fmodf(S(0), S(1))); }
void H_sin(void) { RETD(sin(D(0))); }
void H_cos(void) { RETD(cos(D(0))); }
void H_tan(void) { RETD(tan(D(0))); }
void H_acos(void) { RETD(acos(D(0))); }
void H_atan2(void) { RETD(atan2(D(0), D(1))); }
void H_sqrt(void) { RETD(sqrt(D(0))); }
void H_pow(void) { RETD(pow(D(0), D(1))); }
void H_exp(void) { RETD(exp(D(0))); }
void H_log(void) { RETD(log(D(0))); }
void H_log10(void) { RETD(log10(D(0))); }

/* rand de bionic: RAND_MAX = 0x7fffffff */
static u64 semilla = 1;
void H_srand(void) { semilla = W(0); }
void H_rand(void) {
  semilla = semilla * 6364136223846793005ull + 1442695040888963407ull;
  RET((u32)(semilla >> 33) & 0x7fffffffu);
}

/* ------------------------------------------------------------------ tiempo */
void H_time(void) {
  s64 t = (s64)aos_ahora_ms() / 1000;
  if (X(0)) WR64(X(0), (u64)t);
  RET(t);
}
void H_gettimeofday(void) {
  u64 ms = aos_ahora_ms();
  if (X(0)) {
    WR64(X(0), ms / 1000);
    WR64(X(0) + 8, (ms % 1000) * 1000);
  }
  RET(0);
}
void H_clock_gettime(void) {
  u64 ms = aos_ahora_ms();
  WR64(X(1), ms / 1000);
  WR64(X(1) + 8, (ms % 1000) * 1000000);
  RET(0);
}
/* struct tm de bionic (arm64): 9 int, long tm_gmtoff, const char *tm_zone */
static u64 tm_guest;
void H_localtime(void) {
  if (!tm_guest) tm_guest = aos_malloc(64);
  s64 t = (s64)RD64(X(0));
  int r[9];
  aos_hora_local(t, r);
  for (int i = 0; i < 9; i++) WR32(tm_guest + 4 * i, (u32)r[i]);
  WR64(tm_guest + 40, 0);
  WR64(tm_guest + 48, 0);
  RET(tm_guest);
}
void H_localtime_r(void) {
  s64 t = (s64)RD64(X(0));
  int r[9];
  aos_hora_local(t, r);
  for (int i = 0; i < 9; i++) WR32(X(1) + 4 * i, (u32)r[i]);
  RET(X(1));
}

/* ------------------------------------------------------------------ hilos (hay uno solo) */
void H_pthread_mutex_lock(void) { RET(0); }
void H_pthread_mutex_unlock(void) { RET(0); }
void H_pthread_mutex_init(void) { RET(0); }
void H_pthread_mutex_destroy(void) { RET(0); }
void H_pthread_once(void) {
  if (RD32(X(0)) == 0) {
    WR32(X(0), 1);
    u64 fn = X(1);
    aos_call(fn);
  }
  RET(0);
}
static u64 claves[64];
static int nclaves = 1;
void H_pthread_key_create(void) {
  WR32(X(0), (u32)nclaves++);
  RET(0);
}
void H_pthread_getspecific(void) { RET(W(0) < 64 ? claves[W(0)] : 0); }
void H_pthread_setspecific(void) {
  if (W(0) < 64) claves[W(0)] = X(1);
  RET(0);
}
static u64 errno_guest;
void H___errno(void) {
  if (!errno_guest) errno_guest = aos_malloc(8);
  RET(errno_guest);
}

/* ------------------------------------------------------------------ runtime de C++ */
void H___cxa_guard_acquire(void) { RET(RD8(X(0)) == 0); }
void H___cxa_guard_release(void) { WR8(X(0), 1); }
void H___cxa_guard_abort(void) {}
void H___cxa_atexit(void) { RET(0); }
void H___cxa_allocate_exception(void) { RET(aos_malloc(X(0) + 128) + 128); }
void H___cxa_throw(void) { aos_trap(X(1), "excepción de C++ (__cxa_throw)"); }
void H___cxa_rethrow(void) { aos_trap(0, "excepción de C++ (__cxa_rethrow)"); }
void H___cxa_begin_catch(void) { RET(X(0)); }
void H___cxa_end_catch(void) {}
void H___cxa_bad_cast(void) { aos_trap(0, "__cxa_bad_cast"); }
void H___cxa_call_unexpected(void) { aos_trap(0, "__cxa_call_unexpected"); }
void H___cxa_get_globals(void) {
  static u64 g;
  if (!g) g = aos_calloc(1, 32);
  RET(g);
}
void H__Unwind_Resume(void) { aos_trap(0, "_Unwind_Resume"); }
void H__ZSt9terminatev(void) { aos_trap(0, "std::terminate"); }
void H__ZNSt9exceptionD2Ev(void) {}
void H__ZNSt9exceptionD1Ev(void) {}
void H_abort(void) { aos_trap(0, "abort"); }
void H___stack_chk_fail(void) { aos_trap(0, "__stack_chk_fail (la pila se pisó)"); }
void H_dl_iterate_phdr(void) { RET(0); }
void H_syscall(void) { RET(0); }
void H___google_potentially_blocking_region_begin(void) {}
void H___google_potentially_blocking_region_end(void) {}

/* ------------------------------------------------------------------ archivos (FILE* en memoria) */
/* El juego guarda con fopen/fwrite/fclose en la carpeta de FileUtils::getWritablePath ("/guardado/").
 * Cada FILE* es un bloque chico de memoria del juego; los datos viven acá hasta fclose. */
typedef struct {
  u64 g;           /* el FILE* que ve el juego */
  char ruta[256];
  int escribir;
  u8 *datos;
  u32 largo, cap, pos;
} Archivo;
static Archivo archivos[16];

static Archivo *archivo_de(u64 g) {
  for (int i = 0; i < 16; i++)
    if (archivos[i].g == g && g) return &archivos[i];
  return NULL;
}

void H_fopen(void) {
  const char *ruta = P(X(0)), *modo = P(X(1));
  Archivo *a = NULL;
  for (int i = 0; i < 16; i++)
    if (!archivos[i].g) {
      a = &archivos[i];
      break;
    }
  if (!a) {
    RET(0);
    return;
  }
  memset(a, 0, sizeof *a);
  snprintf(a->ruta, sizeof a->ruta, "%s", ruta);
  a->escribir = strchr(modo, 'w') || strchr(modo, 'a');
  if (!a->escribir || strchr(modo, 'a')) {
    u8 *d;
    u32 n;
    if (aos_archivo_leer(ruta, &d, &n)) {
      a->datos = d;
      a->largo = a->cap = n;
    } else if (!a->escribir) {
      RET(0);
      return;
    }
    if (strchr(modo, 'a')) a->pos = a->largo;
  }
  a->g = aos_calloc(1, 32);
  RET(a->g);
}
void H_fclose(void) {
  Archivo *a = archivo_de(X(0));
  if (!a) {
    RET((u64)-1);
    return;
  }
  if (a->escribir) aos_archivo_escribir(a->ruta, a->datos ? a->datos : (const u8 *)"", a->largo);
  free(a->datos);
  aos_free(a->g);
  memset(a, 0, sizeof *a);
  RET(0);
}
static void archivo_poner(Archivo *a, const void *src, u32 n) {
  if (a->pos + n > a->cap) {
    a->cap = (a->pos + n) * 2 + 64;
    a->datos = realloc(a->datos, a->cap);
  }
  memcpy(a->datos + a->pos, src, n);
  a->pos += n;
  if (a->pos > a->largo) a->largo = a->pos;
}
void H_fwrite(void) {
  Archivo *a = archivo_de(X(3));
  if (!a) {
    RET(0);
    return;
  }
  u64 n = X(1) * X(2);
  archivo_poner(a, G2H(X(0)), (u32)n);
  RET(X(2));
}
void H_fputc(void) {
  Archivo *a = archivo_de(X(1));
  u8 c = (u8)W(0);
  if (a) archivo_poner(a, &c, 1);
  RET(W(0));
}
void H_fputs(void) {
  Archivo *a = archivo_de(X(1));
  if (a) archivo_poner(a, P(X(0)), (u32)strlen(P(X(0))));
  RET(0);
}
void H_fread(void) {
  Archivo *a = archivo_de(X(3));
  if (!a || !X(1)) {
    RET(0);
    return;
  }
  u64 quiere = X(1) * X(2), hay = a->pos < a->largo ? a->largo - a->pos : 0;
  if (quiere > hay) quiere = hay - hay % X(1);
  memcpy(G2H(X(0)), a->datos + a->pos, (size_t)quiere);
  a->pos += (u32)quiere;
  RET(quiere / X(1));
}
void H_fgets(void) {
  Archivo *a = archivo_de(X(2));
  int n = (int)W(1);
  if (!a || a->pos >= a->largo || n <= 0) {
    RET(0);
    return;
  }
  char *d = P(X(0));
  int i = 0;
  while (i < n - 1 && a->pos < a->largo) {
    char c = (char)a->datos[a->pos++];
    d[i++] = c;
    if (c == '\n') break;
  }
  d[i] = 0;
  RET(X(0));
}
void H_fflush(void) { RET(0); }
void H_fseek(void) {
  Archivo *a = archivo_de(X(0));
  if (!a) {
    RET((u64)-1);
    return;
  }
  s64 off = (s64)X(1);
  int de = (int)W(2);
  s64 p = de == 0 ? off : de == 1 ? (s64)a->pos + off : (s64)a->largo + off;
  if (p < 0) p = 0;
  a->pos = (u32)p;
  RET(0);
}
void H_ftell(void) {
  Archivo *a = archivo_de(X(0));
  RET(a ? a->pos : (u64)-1);
}
void H_feof(void) {
  Archivo *a = archivo_de(X(0));
  RET(!a || a->pos >= a->largo);
}
void H_remove(void) { RET(0); }
void H_mkdir(void) { RET(0); }
void H_access(void) {
  u8 *d;
  u32 n;
  int ok = aos_archivo_leer(P(X(0)), &d, &n);
  if (ok) free(d);
  RET(ok ? 0 : (u64)-1);
}
/* std::ios_base::Init::Init(): cout/cin no se usan */
void H_std_ios_base_Init_Init(void) {}
