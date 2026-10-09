/* Lo que necesita el código traducido de libMyGame.so (recompilar.py) y la capa propia (hle.c).
 *
 * La memoria es plana: una dirección del ARM es la misma dirección acá (en WebAssembly y en la
 * prueba nativa, que pone la memoria del juego en su dirección real con mmap). */
#pragma once
#include <stdint.h>
#include <stddef.h>

typedef uint8_t u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;
typedef int8_t s8;
typedef int16_t s16;
typedef int32_t s32;
typedef int64_t s64;

/* Registros que viajan entre funciones: argumentos x0..x7, x8 (dónde va el resultado grande),
 * v0..v7 (parte baja) y la pila. */
typedef struct {
  u64 x[9];
  u64 v[8];
  u64 sp;
} AosRegs;
extern AosRegs C;

#define G2H(a) ((u8 *)(uintptr_t)(u32)(a))
#define H2G(p) ((u64)(u32)(uintptr_t)(p))

typedef u8 __attribute__((may_alias)) u8a;
typedef u16 __attribute__((aligned(1), may_alias)) u16a;
typedef u32 __attribute__((aligned(1), may_alias)) u32a;
typedef u64 __attribute__((aligned(1), may_alias)) u64a;
typedef float __attribute__((aligned(1), may_alias)) f32a;

#define RD8(a) (*(u8a *)G2H(a))
#define RD16(a) (*(u16a *)G2H(a))
#define RD32(a) (*(u32a *)G2H(a))
#define RD64(a) (*(u64a *)G2H(a))
#define WR8(a, v) (*(u8a *)G2H(a) = (u8)(v))
#define WR16(a, v) (*(u16a *)G2H(a) = (u16)(v))
#define WR32(a, v) (*(u32a *)G2H(a) = (u32)(v))
#define WR64(a, v) (*(u64a *)G2H(a) = (u64)(v))
#define RDF(a) (*(f32a *)G2H(a))
#define WRF(a, v) (*(f32a *)G2H(a) = (float)(v))

/* Mapa de la memoria del juego. */
#define AOS_TLS 0xC60000ULL        /* TPIDR_EL0: el canario de la pila está en +0x28 */
#define AOS_STACK_LO 0xD00000u
#define AOS_STACK_HI 0xF00000u
#define AOS_HEAP_LO 0x1000000u
#define AOS_HEAP_HI 0x3F00000u
#define AOS_FAKE 0xF8000000u      /* objetos de cocos2d de mentira: sus vtables apuntan acá */

static inline float F32(u64 v) {
  u32 u = (u32)v;
  float f;
  __builtin_memcpy(&f, &u, 4);
  return f;
}
static inline u64 B32(float f) {
  u32 u;
  __builtin_memcpy(&u, &f, 4);
  return u;
}
static inline double F64(u64 v) {
  double d;
  __builtin_memcpy(&d, &v, 8);
  return d;
}
static inline u64 B64(double d) {
  u64 u;
  __builtin_memcpy(&u, &d, 8);
  return u;
}

/* fcvtzs/fcvtzu: hacia cero, saturando, NaN → 0 (igual que ARM y que trunc_sat de wasm). */
static inline s32 CVT_S32(double d) {
#ifdef __wasm__
  return __builtin_wasm_trunc_saturate_s_i32_f64(d);
#else
  if (d != d) return 0;
  if (d >= 2147483648.0) return INT32_MAX;
  if (d <= -2147483649.0) return INT32_MIN;
  return (s32)d;
#endif
}
static inline s64 CVT_S64(double d) {
#ifdef __wasm__
  return __builtin_wasm_trunc_saturate_s_i64_f64(d);
#else
  if (d != d) return 0;
  if (d >= 9223372036854775808.0) return INT64_MAX;
  if (d < -9223372036854775808.0) return INT64_MIN;
  return (s64)d;
#endif
}
static inline u32 CVT_U32(double d) {
#ifdef __wasm__
  return __builtin_wasm_trunc_saturate_u_i32_f64(d);
#else
  if (d != d || d <= -1.0) return 0;
  if (d >= 4294967296.0) return UINT32_MAX;
  return (u32)d;
#endif
}
static inline u64 CVT_U64(double d) {
#ifdef __wasm__
  return __builtin_wasm_trunc_saturate_u_i64_f64(d);
#else
  if (d != d || d <= -1.0) return 0;
  if (d >= 18446744073709551616.0) return UINT64_MAX;
  return (u64)d;
#endif
}

/* División de ARM: entre cero da cero; INT_MIN / -1 da INT_MIN. */
static inline u32 SDIV32(u64 a, u64 b) {
  s32 x = (s32)a, y = (s32)b;
  if (y == 0) return 0;
  if (x == INT32_MIN && y == -1) return (u32)x;
  return (u32)(x / y);
}
static inline u64 SDIV64(u64 a, u64 b) {
  s64 x = (s64)a, y = (s64)b;
  if (y == 0) return 0;
  if (x == INT64_MIN && y == -1) return (u64)x;
  return (u64)(x / y);
}
static inline u32 UDIV32(u64 a, u64 b) { return (u32)b ? (u32)a / (u32)b : 0; }
static inline u64 UDIV64(u64 a, u64 b) { return b ? a / b : 0; }
static inline u32 ROR32(u64 a, unsigned s) {
  u32 x = (u32)a;
  s &= 31;
  return s ? (x >> s) | (x << (32 - s)) : x;
}
static inline u64 ROR64(u64 x, unsigned s) {
  s &= 63;
  return s ? (x >> s) | (x << (64 - s)) : x;
}

void aos_call(u64 addr);
void aos_bad_call(u64 addr);
void aos_trap(u64 addr, const char *msg);
void aos_missing(const char *name);

/* Depuración: con -DAOS_DEPURAR cada bloque y cada llamada del código traducido avisa su dirección ARM,
 * y juego.c dice entre qué dos puntos cambió la palabra vigilada (dato "vigilar"). Sin eso no cuesta nada. */
#ifdef AOS_DEPURAR
void aos_vigia(u64 pc);
#define AOS_VIGIA(pc) aos_vigia(pc)
#else
#define AOS_VIGIA(pc) ((void)0)
#endif

typedef struct {
  u32 addr;
  const char *mangled;
  const char *name;
} AosNombre;
extern const AosNombre aos_nombres[];
extern const int aos_nnombres;
extern const u32 aos_inits[];
extern const int aos_ninits;
const char *aos_nombre(u64 addr);
