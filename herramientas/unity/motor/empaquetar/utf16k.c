// porteo: los bytes de un bloque comprimido como texto UTF-16 sin escapes (ver a_utf16 en
// empaquetar.py y deco en arranque.js).
//
// El HTML deja pasar tal cual todos los caracteres UTF-16 menos los surrogates sueltos, NUL, CR y
// '<' (que cerraría el <script>): quedan K = 65536 - 2048 - 3 = 63485. Los bytes van como dígitos
// en base K con rANS de símbolos uniformes de 16 bits (frecuencia 1 de 65536): es una conversión de
// base que corre de a pedazos, sin números enormes. Cada carácter lleva log2(63485) = 15.95 bits:
// 0.29% de más, contra el 3.2% de escapar lo que no pasa.
//
//   estado x en [L, K·L), L = 2^32 (entra en 53 bits: el decodificador en JS usa doubles)
//   codificar s (al revés, del último al primero): mientras x >= (L / 2^16)·K, sale el dígito
//     x % K y x /= K; después x = x·2^16 + s
//   decodificar (en orden): s = x % 2^16; x = x / 2^16; mientras x < L, x = x·K + el dígito que sigue
//
// Compilar: cc -O2 -shared -fPIC -o utf16k.so utf16k.c (empaquetar.py lo hace solo)
#include <stddef.h>
#include <stdint.h>

#define K 63485ull
#define L (1ull << 32)

// el dígito d (0..K-1) → el carácter: los permitidos en orden (1..12, 14..59, 61..0xD7FF, 0xE000..0xFFFF)
static uint16_t caracter(uint32_t d)
{
    if (d < 12) return (uint16_t)(d + 1);
    if (d < 58) return (uint16_t)(d - 12 + 14);
    if (d < 55293) return (uint16_t)(d - 58 + 61);
    return (uint16_t)(d - 55293 + 0xE000);
}

// in: n símbolos de 16 bits. out: lugar para n + n / 64 + 8 caracteres. Devuelve cuántos escribió:
// primero los 4 dígitos del estado final (lo primero que lee el decodificador) y después los
// emitidos durante la codificación, en el orden en que se leen; ya como caracteres
size_t utf16k_codificar(const uint16_t* in, size_t n, uint16_t* out)
{
    const uint64_t xmax = (L >> 16) * K;
    size_t m = 4;
    uint64_t x = L;
    for (size_t i = n; i-- > 0;)
    {
        while (x >= xmax) { out[m++] = (uint16_t)(x % K); x /= K; }
        x = (x << 16) | in[i];
    }
    for (int k = 3; k >= 0; k--) { out[k] = (uint16_t)(x % K); x /= K; }
    // lo emitido salió al revés de como se lee
    for (size_t a = 4, b = m - 1; a < b; a++, b--) { uint16_t t = out[a]; out[a] = out[b]; out[b] = t; }
    for (size_t i = 0; i < m; i++) out[i] = caracter(out[i]);
    return m;
}
