/*
** porteo: math.random y math.randomseed como los de LuaJIT 2.1 (lib_math.c + lj_prng.c), para el
** Lua 5.1 de la versión web de LÖVE. Balatro siembra con fracciones (pseudoseed devuelve un número
** entre 0 y 1): el randomseed de Lua 5.1 las trunca a entero (todo daba srand(0): las mismas cartas
** siempre) y su random es el rand() de la libc. Con el generador de LuaJIT (Tausworthe de período
** 2^223, L'Ecuyer 1991) una semilla da la misma partida que en el teléfono.
**
** Se incluye al final de lmathlib.c (ver parchar.py): reemplaza a math_random y math_randomseed.
*/
#include <stdint.h>
#include <string.h>

typedef union { uint64_t u64; double d; } porteo_u64double;

static uint64_t porteo_azar[4];

/* un paso de los 4 generadores; el xor de los estados, con el patrón de un double en [1, 2) */
#define PORTEO_TW223(i, k, q, s) \
  z = porteo_azar[i]; \
  z = (((z << q) ^ z) >> (k - s)) ^ ((z & ((uint64_t)(int64_t)-1 << (64 - k))) << s); \
  r ^= z; porteo_azar[i] = z;

static uint64_t porteo_paso(void)
{
  uint64_t z, r = 0;
  PORTEO_TW223(0, 63, 31, 18)
  PORTEO_TW223(1, 58, 19, 28)
  PORTEO_TW223(2, 55, 24, 7)
  PORTEO_TW223(3, 47, 21, 8)
  return (r & 0x000fffffffffffffULL) | 0x3ff0000000000000ULL;
}

static void porteo_sembrar(double d)
{
  uint32_t r = 0x11090601;  /* 64-k[i] como cuatro constantes de 8 bits */
  int i;
  for (i = 0; i < 4; i++) {
    porteo_u64double u;
    uint32_t m = 1u << (r & 255);
    r >>= 8;
    u.d = d = d * 3.14159265358979323846 + 2.7182818284590452354;
    if (u.u64 < m) u.u64 += m;  /* que el bit alto de cada estado no sea cero */
    porteo_azar[i] = u.u64;
  }
  for (i = 0; i < 10; i++)
    (void)porteo_paso();
}

static int porteo_sembrado = 0;

static int math_random_luajit (lua_State *L) {
  int n = lua_gettop(L);
  porteo_u64double u;
  double d;
  if (!porteo_sembrado) { porteo_sembrar(0.0); porteo_sembrado = 1; }
  u.u64 = porteo_paso();
  d = u.d - 1.0;
  if (n > 0) {
    double r1 = luaL_checknumber(L, 1);
    if (n == 1) {
      d = floor(d * r1) + 1.0;  /* entero en [1, r1] */
    } else {
      double r2 = luaL_checknumber(L, 2);
      d = floor(d * (r2 - r1 + 1.0)) + r1;  /* entero en [r1, r2] */
    }
  }  /* si no: un double en [0, 1) */
  lua_pushnumber(L, d);
  return 1;
}

static int math_randomseed_luajit (lua_State *L) {
  porteo_sembrar(luaL_checknumber(L, 1));
  porteo_sembrado = 1;
  return 0;
}
