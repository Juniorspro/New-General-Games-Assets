// Decodificador de LZMA "crudo": lo que escribe xz con FORMAT_RAW y FILTER_LZMA1 (sin encabezado;
// el largo de la salida lo sabe quien llama y la marca de fin, si viene, no se lee). Va compilado
// a WebAssembly en los workers que descomprimen el HTML único (ver empaquetar.py): ahí la salida
// entera está en memoria, así que la "ventana" es la salida misma y no hace falta un búfer circular.
//
// Sigue la especificación de LZMA (LzmaSpec.cpp del SDK de Igor Pavlov, de dominio público), no su
// código. No usa la biblioteca de C (ni malloc): el WebAssembly sale sin importaciones, de pocos KB.
#include <stddef.h>
#include <stdint.h>

#define BITS_MODELO 11
#define MITAD (1u << (BITS_MODELO - 1))
#define MOVER 5
#define TOPE (1u << 24)

typedef uint16_t P;

typedef struct {
  P eleccion, eleccion2, bajo[16][8], medio[16][8], alto[256];
} Largos;

typedef struct {
  P esMatch[12][16], esRep[12], esRepG0[12], esRepG1[12], esRepG2[12], esRep0Largo[12][16];
  P ranura[4][64];
  P especial[115];
  P alineado[16];
  Largos largos, repetidos;
  P literales[];  // 0x300 por contexto: 1 << (lc + lp) contextos
} Probabilidades;

// el decodificador de rango, en variables locales del bucle (así el compilador las deja en registros)
#define NORMALIZAR() do { if (rango < TOPE) { rango <<= 8; codigo = (codigo << 8) | (in < fin ? *in++ : 0); } } while (0)
#define BIT(p, b) do { \
    uint32_t v_ = *(p), lim_ = (rango >> BITS_MODELO) * v_; \
    if (codigo < lim_) { rango = lim_; *(p) = (P)(v_ + (((1u << BITS_MODELO) - v_) >> MOVER)); (b) = 0; } \
    else { rango -= lim_; codigo -= lim_; *(p) = (P)(v_ - (v_ >> MOVER)); (b) = 1; } \
    NORMALIZAR(); } while (0)

// cuántos bytes de probabilidades necesita lzma_decodificar con esos lc y lp
size_t lzma_tam_probabilidades(int lc, int lp)
{
  return sizeof(Probabilidades) + ((size_t)0x300 << (lc + lp)) * sizeof(P);
}

// devuelve 0 si salió bien, otro número si los datos están mal. "memoria" tiene que tener
// lzma_tam_probabilidades(lc, lp) bytes (alineados a 2)
int lzma_decodificar(const uint8_t* entrada, size_t largoEntrada, uint8_t* salida, size_t largoSalida, int lc, int lp, int pb, void* memoria)
{
  if (lc > 8 || lp > 4 || pb > 4) return 1;
  size_t nLit = (size_t)0x300 << (lc + lp);
  Probabilidades* pr = (Probabilidades*)memoria;
  P* todas = (P*)pr;
  size_t n = sizeof(Probabilidades) / sizeof(P) + nLit;
  for (size_t i = 0; i < n; i++) todas[i] = MITAD;

  const uint8_t* in = entrada;
  const uint8_t* fin = entrada + largoEntrada;
  if (largoEntrada < 5 || in[0] != 0) return 3;
  uint32_t rango = 0xFFFFFFFFu, codigo = 0;
  in++;
  for (int i = 0; i < 4; i++) codigo = (codigo << 8) | *in++;

  uint8_t* o = salida;
  uint8_t* const oFin = salida + largoSalida;
  uint32_t rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0;
  unsigned estado = 0;
  const uint32_t mascaraPos = (1u << pb) - 1, mascaraLit = (1u << lp) - 1;
  int error = 0;

  while (o < oFin) {
    size_t pos = (size_t)(o - salida);
    unsigned ps = (unsigned)pos & mascaraPos;
    unsigned b;
    BIT(&pr->esMatch[estado][ps], b);
    if (!b) {
      // un literal: el contexto es la posición y los bits altos del byte anterior
      unsigned previo = pos ? o[-1] : 0;
      P* lp_ = pr->literales + 0x300 * ((((unsigned)pos & mascaraLit) << lc) + (previo >> (8 - lc)));
      unsigned s = 1;
      if (estado >= 7) {
        // después de un match, el byte que había en la distancia rep0 guía los bits hasta que difiere
        unsigned m = o[-(ptrdiff_t)rep0 - 1];
        do {
          unsigned bm = (m >> 7) & 1, x;
          m <<= 1;
          BIT(&lp_[((1 + bm) << 8) + s], x);
          s = (s << 1) | x;
          if (bm != x) break;
        } while (s < 0x100);
      }
      while (s < 0x100) { unsigned x; BIT(&lp_[s], x); s = (s << 1) | x; }
      *o++ = (uint8_t)s;
      estado = estado < 4 ? 0 : estado < 10 ? estado - 3 : estado - 6;
      continue;
    }

    unsigned largo;
    Largos* tablaLargo;
    BIT(&pr->esRep[estado], b);
    if (b) {
      if (pos == 0) { error = 4; break; }
      BIT(&pr->esRepG0[estado], b);
      if (!b) {
        BIT(&pr->esRep0Largo[estado][ps], b);
        if (!b) {
          // "short rep": un solo byte desde rep0
          estado = estado < 7 ? 9 : 11;
          *o = o[-(ptrdiff_t)rep0 - 1];
          o++;
          continue;
        }
      } else {
        uint32_t d;
        BIT(&pr->esRepG1[estado], b);
        if (!b) d = rep1;
        else {
          BIT(&pr->esRepG2[estado], b);
          if (!b) d = rep2;
          else { d = rep3; rep3 = rep2; }
          rep2 = rep1;
        }
        rep1 = rep0;
        rep0 = d;
      }
      tablaLargo = &pr->repetidos;
      estado = estado < 7 ? 8 : 11;
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0;
      tablaLargo = &pr->largos;
      estado = estado < 7 ? 7 : 10;
    }

    // el largo (2..273)
    {
      Largos* L = tablaLargo;
      P* arbol;
      unsigned bits, base;
      BIT(&L->eleccion, b);
      if (!b) { arbol = L->bajo[ps]; bits = 3; base = 0; }
      else {
        BIT(&L->eleccion2, b);
        if (!b) { arbol = L->medio[ps]; bits = 3; base = 8; }
        else { arbol = L->alto; bits = 8; base = 16; }
      }
      unsigned m = 1;
      for (unsigned i = 0; i < bits; i++) { unsigned x; BIT(&arbol[m], x); m = (m << 1) | x; }
      largo = base + m - (1u << bits);
    }

    if (tablaLargo == &pr->largos) {
      // la distancia de un match nuevo
      unsigned estadoLargo = largo < 3 ? largo : 3;
      P* r = pr->ranura[estadoLargo];
      unsigned m = 1;
      for (int i = 0; i < 6; i++) { unsigned x; BIT(&r[m], x); m = (m << 1) | x; }
      unsigned ranura = m - 64;
      uint32_t d;
      if (ranura < 4) d = ranura;
      else {
        unsigned directos = (ranura >> 1) - 1;
        d = (2u | (ranura & 1)) << directos;
        if (ranura < 14) {
          P* e = pr->especial + d - ranura;
          unsigned mm = 1;
          for (unsigned i = 0; i < directos; i++) { unsigned x; BIT(&e[mm], x); mm = (mm << 1) | x; d += x << i; }
        } else {
          uint32_t r2 = 0;
          for (unsigned i = 0; i < directos - 4; i++) {
            rango >>= 1;
            codigo -= rango;
            uint32_t t = 0u - (codigo >> 31);
            codigo += rango & t;
            r2 = (r2 << 1) + (t + 1);
            NORMALIZAR();
          }
          d += r2 << 4;
          unsigned mm = 1;
          for (unsigned i = 0; i < 4; i++) { unsigned x; BIT(&pr->alineado[mm], x); mm = (mm << 1) | x; d += x << i; }
        }
      }
      if (d == 0xFFFFFFFFu) break;  // la marca de fin
      rep0 = d;
      if (rep0 >= pos) { error = 5; break; }
    }

    largo += 2;
    size_t queda = (size_t)(oFin - o);
    if (largo > queda) { largo = (unsigned)queda; error = 6; }
    const uint8_t* desde = o - rep0 - 1;
    // si el match se pisa a sí mismo (distancia menor que el largo) va de a un byte: repite lo
    // recién copiado; si no, de una (memory.copy en WebAssembly)
    if (rep0 + 1 >= largo && largo > 8) __builtin_memcpy(o, desde, largo);
    else for (unsigned i = 0; i < largo; i++) o[i] = desde[i];
    o += largo;
    if (error) break;
  }
  if (!error && o != oFin) error = 7;
  return error;
}
