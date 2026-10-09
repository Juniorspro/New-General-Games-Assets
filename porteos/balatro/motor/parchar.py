#!/usr/bin/env python3
"""Aplica los cambios del porteo a una copia de megasource (Davidobot/megasource, rama emscripten,
con Davidobot/love rama emscripten en libs/love) para compilar LÖVE para la web con un Emscripten
actual. Se corre una vez, sobre una copia limpia:

    python3 parchar.py RUTA/A/megasource

Qué cambia y por qué:
- Lua 5.1: math.random/randomseed como los de LuaJIT (azar_luajit.c) y el módulo "bit" (lbitlib.c),
  que Balatro necesita y LuaJIT trae de fábrica.
- LÖVE: excepciones nativas de WebAssembly (-fwasm-exceptions: con las emuladas en JS cada llamada
  a la API de LÖVE, que es un try/catch, pasaba por JS), sin hilos (el juego corre adentro de otras
  páginas: sin SharedArrayBuffer), las banderas que pide un Emscripten de 2026 (GetProcAddress para
  glad, OpenAL, las funciones de FS para el cargador propio) y la persistencia de las partidas
  (persistencia.js).
"""
import re
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def cambiar(archivo, viejo, nuevo, veces=1):
    t = archivo.read_text(encoding="utf-8")
    n = t.count(viejo)
    if n != veces:
        sys.exit(f"parchar: en {archivo} se esperaba {veces} vez/veces {viejo[:60]!r} y hay {n}")
    archivo.write_text(t.replace(viejo, nuevo), encoding="utf-8")


def lua(mega):
    src = mega / "libs/lua-5.1.5/src"
    shutil.copyfile(AQUI / "azar_luajit.c", src / "azar_luajit.c")
    shutil.copyfile(AQUI / "lbitlib.c", src / "lbitlib.c")
    m = src / "lmathlib.c"
    cambiar(m, "static const luaL_Reg mathlib[] = {", '#include "azar_luajit.c"\n\nstatic const luaL_Reg mathlib[] = {')
    cambiar(m, '{"random",     math_random},', '{"random",     math_random_luajit},')
    cambiar(m, '{"randomseed", math_randomseed},', '{"randomseed", math_randomseed_luajit},')
    i = src / "linit.c"
    cambiar(i, "static const luaL_Reg lualibs[] = {",
            "LUALIB_API int luaopen_bit (lua_State *L);\n\nstatic const luaL_Reg lualibs[] = {")
    cambiar(i, "  {LUA_DBLIBNAME, luaopen_debug},", '  {LUA_DBLIBNAME, luaopen_debug},\n  {"bit", luaopen_bit},')
    cmake = mega / "libs/lua-5.1.5/CMakeLists.txt"
    cambiar(cmake, "\tsrc/lzio.c\n", "\tsrc/lzio.c\n\tsrc/lbitlib.c\n")
    # estática: un Emscripten actual arma las SHARED como módulos laterales (y pide -fPIC en todo)
    cambiar(cmake, "\tadd_library(lua51 SHARED ${LUA_SRC})", "\tadd_library(lua51 STATIC ${LUA_SRC})")


ENLACE = [
    "-sUSE_SDL=2",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=Love",
    "-sENVIRONMENT=web",
    # WebGL 2 (LÖVE pide GLES 3.0 primero): Balatro pide mipmaps en texturas que no son potencia de
    # dos, y WebGL 1 no los hace ("Cannot create image")
    "-sMAX_WEBGL_VERSION=2",
    "-sMIN_WEBGL_VERSION=1",
    "-sFULL_ES3=1",
    "-sGL_ENABLE_GET_PROC_ADDRESS=1",
    "-sINVOKE_RUN=0",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sINITIAL_MEMORY=128MB",
    "-sSTACK_SIZE=4MB",
    "-sFORCE_FILESYSTEM=1",
    "-sEXPORTED_RUNTIME_METHODS=FS,callMain,addRunDependency,removeRunDependency,FS_createPath,FS_createDataFile",
    # lo que la página le pasa al motor (sin la lista, este Emscripten no lee ni print ni wasmBinary)
    "-sINCOMING_MODULE_JS_API=canvas,print,printErr,wasmBinary,locateFile,onAbort,preRun,postRun,"
    "onRuntimeInitialized,noInitialRun,arguments,setStatus,monitorRunDependencies,instantiateWasm",
    "-fwasm-exceptions",
    "-sSUPPORT_LONGJMP=wasm",
    "-lidbfs.js",
    "-lopenal",
    "--post-js ${CMAKE_CURRENT_SOURCE_DIR}/src/scripts/EmscriptenPersistence.js",
]


def love(mega):
    l = mega / "libs/love"
    c = l / "CMakeLists.txt"
    t = c.read_text(encoding="utf-8")
    # las banderas del ejecutable: las de love.js eran para Emscripten 2.0
    ini = t.index("set(EMSCRIPTEN_ARGS\t")
    fin = t.index("target_link_libraries(${LOVE_EXE_NAME} ${LOVE_LIB_NAME} ${EMSCRIPTEN_ARGS})")
    nuevo = "set(EMSCRIPTEN_ARGS\n" + "".join(f'\t\t"{a}"\n' for a in ENLACE) + "\t)\n\n\t"
    t = t[:ini] + nuevo + t[fin:]
    # al compilar, sólo lo que va en cada objeto (el resto era para el enlace)
    t = re.sub(r'add_definitions\("-s USE_SDL=2 -s FULL_ES2=1 -s INVOKE_RUN=0 --post-js [^"]*"\)',
               'add_definitions("-sUSE_SDL=2 -DLOVEJS_COMPAT=1")', t, count=1)
    c.write_text(t, encoding="utf-8")
    cambiar(c, "add_library(${LOVE_LIB_NAME} SHARED ${LOVE_LIB_SRC} ${LOVE_RC})",
            "add_library(${LOVE_LIB_NAME} STATIC ${LOVE_LIB_SRC} ${LOVE_RC})")
    shutil.copyfile(AQUI / "persistencia.js", l / "src/scripts/EmscriptenPersistence.js")
    # sin hilos, el del audio no arranca: lo actualiza love.event.pump (Event_compat.cpp)
    a = l / "src/modules/audio/openal/Audio.cpp"
    cambiar(a, "\tpoolThread = new PoolThread(pool);\n\tpoolThread->start();",
            "#ifndef LOVEJS_COMPAT\n\tpoolThread = new PoolThread(pool);\n\tpoolThread->start();\n#endif")
    cambiar(a, "\tpoolThread->setFinish();\n\tpoolThread->wait();",
            "\tif (poolThread)\n\t{\n\t\tpoolThread->setFinish();\n\t\tpoolThread->wait();\n\t}")
    # texturas en WebGL 2: sin glTexStorage, como en Android (LÖVE lo apaga ahí), y las de las fuentes
    # (LA8) como LUMINANCE_ALPHA: con GLES 3 LÖVE las arma en RG8 con swizzle, y WebGL no tiene
    # TEXTURE_SWIZZLE (love.graphics.newFont daba "Cannot create image")
    g = l / "src/modules/graphics/opengl/OpenGL.cpp"
    cambiar(g, "#ifndef LOVE_ANDROID\n\tif (GLAD_ES_VERSION_3_0)\n\t\tsupportsTexStorage = true;\n#endif",
            "#if !defined(LOVE_ANDROID) && !defined(LOVE_EMSCRIPTEN)\n\tif (GLAD_ES_VERSION_3_0)\n\t\tsupportsTexStorage = true;\n#endif")
    cambiar(g, "\tcase PIXELFORMAT_LA8:\n\t\tif (gl.isCoreProfile() || GLAD_ES_VERSION_3_0)",
            "\tcase PIXELFORMAT_LA8:\n\t\tif ((gl.isCoreProfile() || GLAD_ES_VERSION_3_0) && !LOVE_WEBGL)")
    cambiar(g, "if (GLAD_ES_VERSION_2_0 && !(GLAD_ES_VERSION_3_0 && pixelformat == PIXELFORMAT_LA8)",
            "if (GLAD_ES_VERSION_2_0 && !(GLAD_ES_VERSION_3_0 && pixelformat == PIXELFORMAT_LA8 && !LOVE_WEBGL)")
    cambiar(g, "namespace love\n{\nnamespace graphics\n{\nnamespace opengl\n{\n",
            "#ifdef LOVE_EMSCRIPTEN\n#define LOVE_WEBGL 1\n#else\n#define LOVE_WEBGL 0\n#endif\n\n"
            "namespace love\n{\nnamespace graphics\n{\nnamespace opengl\n{\n")


def main():
    mega = Path(sys.argv[1])
    if not (mega / "libs/love/CMakeLists.txt").is_file():
        sys.exit("uso: parchar.py RUTA/A/megasource (con libs/love)")
    lua(mega)
    love(mega)
    print("parchar: listo")


if __name__ == "__main__":
    main()
