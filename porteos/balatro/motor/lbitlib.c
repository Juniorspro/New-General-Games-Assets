/*
** porteo: el módulo "bit" de LuaJIT (las mismas reglas que LuaBitOp) para el Lua 5.1 de la versión
** web de LÖVE. Balatro hace require "bit" y usa bit.bxor/lshift/rshift; LuaJIT lo trae de fábrica y
** el LÖVE de love.js no. Los números pasan a 32 bits como en LuaJIT: se suma 2^52+2^51 al double y
** se toman los 32 bits bajos (redondeo al par, módulo 2^32), y el resultado vuelve con signo.
*/
#define lbitlib_c
#define LUA_LIB

#include <stdint.h>

#include "lua.h"
#include "lauxlib.h"

typedef int32_t SBits;
typedef uint32_t UBits;
typedef union { lua_Number n; uint64_t b; } BitNum;

static UBits barg(lua_State *L, int idx)
{
  BitNum bn;
  if (!lua_isnumber(L, idx)) luaL_typerror(L, idx, "number");
  bn.n = lua_tonumber(L, idx) + 6755399441055744.0;  /* 2^52+2^51 */
  return (UBits)bn.b;
}

#define BRET(b)  lua_pushnumber(L, (lua_Number)(SBits)(b)); return 1;

static int bit_tobit(lua_State *L) { BRET(barg(L, 1)) }
static int bit_bnot(lua_State *L) { BRET(~barg(L, 1)) }

#define BIT_OP(func, opr) \
  static int func(lua_State *L) { int i; UBits b = barg(L, 1); \
    for (i = lua_gettop(L); i > 1; i--) b opr barg(L, i); BRET(b) }
BIT_OP(bit_band, &=)
BIT_OP(bit_bor, |=)
BIT_OP(bit_bxor, ^=)

#define bshl(b, n)  ((b) << (n))
#define bshr(b, n)  ((b) >> (n))
#define bsar(b, n)  ((UBits)((SBits)(b) >> (n)))
#define brol(b, n)  ((n) ? (((b) << (n)) | ((b) >> (32 - (n)))) : (b))
#define bror(b, n)  ((n) ? (((b) << (32 - (n))) | ((b) >> (n))) : (b))
#define BIT_SH(func, fn) \
  static int func(lua_State *L) { \
    UBits b = barg(L, 1); UBits n = barg(L, 2) & 31; BRET(fn(b, n)) }
BIT_SH(bit_lshift, bshl)
BIT_SH(bit_rshift, bshr)
BIT_SH(bit_arshift, bsar)
BIT_SH(bit_rol, brol)
BIT_SH(bit_ror, bror)

static int bit_bswap(lua_State *L)
{
  UBits b = barg(L, 1);
  b = (b >> 24) | ((b >> 8) & 0xff00) | ((b & 0xff00) << 8) | (b << 24);
  BRET(b)
}

static int bit_tohex(lua_State *L)
{
  UBits b = barg(L, 1);
  SBits n = lua_isnone(L, 2) ? 8 : (SBits)barg(L, 2);
  const char *hexdigits = "0123456789abcdef";
  char buf[8];
  int i;
  if (n < 0) { n = -n; hexdigits = "0123456789ABCDEF"; }
  if (n > 8) n = 8;
  for (i = (int)n; --i >= 0; ) { buf[i] = hexdigits[b & 15]; b >>= 4; }
  lua_pushlstring(L, buf, (size_t)n);
  return 1;
}

static const struct luaL_Reg bit_funcs[] = {
  { "tobit", bit_tobit },
  { "bnot", bit_bnot },
  { "band", bit_band },
  { "bor", bit_bor },
  { "bxor", bit_bxor },
  { "lshift", bit_lshift },
  { "rshift", bit_rshift },
  { "arshift", bit_arshift },
  { "rol", bit_rol },
  { "ror", bit_ror },
  { "bswap", bit_bswap },
  { "tohex", bit_tohex },
  { NULL, NULL }
};

/* como en LuaJIT: global "bit" y también require "bit" */
LUALIB_API int luaopen_bit(lua_State *L)
{
  luaL_register(L, "bit", bit_funcs);
  return 1;
}
