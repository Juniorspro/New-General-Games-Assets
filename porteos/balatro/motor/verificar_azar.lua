-- porteo: comparar el azar y "bit" del Lua 5.1 parchado con LuaJIT 2.1 (ver LEEME): las dos
-- salidas tienen que ser idénticas, byte por byte.
-- lo mismo en LuaJIT y en el Lua 5.1 parchado: tienen que dar idéntico
local s = {}
local function p(x) s[#s+1] = string.format('%.17g', x) end
for _, semilla in ipairs({0, 0.5, 0.123456789, 0.987654321, 1.234e-5, 12345, 3.14159, -0.75}) do
  math.randomseed(semilla)
  for i = 1, 5 do p(math.random()) end
  p(math.random(52)); p(math.random(3, 17)); p(math.random(1, 1000000))
end
local bit = require('bit')
for _, v in ipairs({0, 1, -1, 2^31, 2^32 + 5, -2^31 - 1, 123456789.75, 0.5, 1.5, 2.5, -3.5, 4294967295}) do
  p(bit.tobit(v)); p(bit.bxor(v, 0x5a5a5a5a)); p(bit.lshift(v, 7)); p(bit.rshift(v, 3)); p(bit.arshift(v, 5))
  p(bit.band(v, 0xff00ff)); p(bit.bor(v, 3)); p(bit.bnot(v)); p(bit.rol(v, 9)); p(bit.ror(v, 9)); p(bit.bswap(v))
  s[#s+1] = bit.tohex(v); s[#s+1] = bit.tohex(v, -4)
end
-- el hash de Balatro (misc_functions.lua: pseudohash y pseudoseed usan aritmética pura)
local h = 0
for i = 1, 100 do h = bit.bxor(h, bit.lshift(h, 7) + bit.rshift(h, 3) + (i * 37 % 256)) end
p(h)
print(table.concat(s, '\n'))
