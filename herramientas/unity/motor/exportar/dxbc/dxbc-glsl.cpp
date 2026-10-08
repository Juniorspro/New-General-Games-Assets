// dxbc-glsl: los shaders de DirectX 11 de un juego de Unity (bytecode DXBC) a GLSL ES 3.00, con
// HLSLcc, el mismo traductor que usa Unity para sus versiones de OpenGL. Así sale lo mismo que en
// un APK (in_POSITION0, vs_TEXCOORD0, hlslcc_mtx4x4..., SV_Target0) y el motor lo usa igual.
//
//   dxbc-glsl TRABAJOS SALIDA
//
// TRABAJOS: "PDXB", u32 cantidad y por cada uno u32 largo + el contenedor DXBC (con su RDEF:
// Unity lo saca de los builds y exportar/dxbc.py lo arma de nuevo con los datos del shader).
// SALIDA: por cada uno u32 ok, u32 largo + GLSL, u32 largo + diagnósticos. Se escribe y se vacía
// de a uno: si HLSLcc se cae con algún programa raro, se sabe cuál fue y se sigue desde el próximo
// (dxbc.py vuelve a llamar con --desde).
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include "hlslcc.h"

struct Diagnosticos : HLSLccReflection
{
    std::string texto;
    void OnDiagnostics(const std::string &error, int line, bool isError) override
    {
        texto += (isError ? "error " : "aviso ") + std::to_string(line) + ": " + error + "\n";
    }
};

static bool leer(FILE *f, void *p, size_t n) { return fread(p, 1, n, f) == n; }

static void escribir(FILE *f, uint32_t ok, const std::string &glsl, const std::string &diag)
{
    uint32_t n = (uint32_t)glsl.size(), m = (uint32_t)diag.size();
    fwrite(&ok, 4, 1, f);
    fwrite(&n, 4, 1, f);
    fwrite(glsl.data(), 1, n, f);
    fwrite(&m, 4, 1, f);
    fwrite(diag.data(), 1, m, f);
    fflush(f);
}

int main(int argc, char **argv)
{
    if (argc < 3) { fprintf(stderr, "uso: dxbc-glsl TRABAJOS SALIDA [--desde N]\n"); return 2; }
    uint32_t desde = 0;
    for (int i = 3; i + 1 < argc; i++) if (!strcmp(argv[i], "--desde")) desde = (uint32_t)atoi(argv[i + 1]);
    FILE *ent = fopen(argv[1], "rb");
    if (!ent) { perror(argv[1]); return 1; }
    char magia[4];
    uint32_t cantidad;
    if (!leer(ent, magia, 4) || memcmp(magia, "PDXB", 4) || !leer(ent, &cantidad, 4)) { fprintf(stderr, "no es un archivo de trabajos\n"); return 1; }
    FILE *sal = fopen(argv[2], desde ? "ab" : "wb");
    if (!sal) { perror(argv[2]); return 1; }
    // los planos de la matriz como vec4[] (hlslcc_mtx4x4...), uniforms sueltos (sin bloques) y sin
    // ubicaciones explícitas: como el GLSL de GLES3 de los APK, que es lo que el motor entiende
    const unsigned flags = HLSLCC_FLAG_TRANSLATE_MATRICES | HLSLCC_FLAG_DISABLE_EXPLICIT_LOCATIONS |
                           HLSLCC_FLAG_DISABLE_GLOBALS_STRUCT | HLSLCC_FLAG_REMOVE_UNUSED_GLOBALS;
    std::vector<char> dxbc;
    for (uint32_t i = 0; i < cantidad; i++)
    {
        uint32_t n;
        if (!leer(ent, &n, 4)) { fprintf(stderr, "trabajo %u cortado\n", i); return 1; }
        dxbc.resize(n + 16);
        if (!leer(ent, dxbc.data(), n)) { fprintf(stderr, "trabajo %u cortado\n", i); return 1; }
        if (i < desde) continue;
        GlExtensions ext = {};
        GLSLCrossDependencyData dep;
        HLSLccSamplerPrecisionInfo precision;
        Diagnosticos diag;
        GLSLShader res;
        int ok = TranslateHLSLFromMem(dxbc.data(), flags, LANG_ES_300, &ext, &dep, precision, diag, &res);
        escribir(sal, ok ? 1u : 0u, ok ? res.sourceCode : std::string(), diag.texto);
    }
    fclose(sal);
    return 0;
}
