// porteo: lo nativo del anfitrión del navegador. El motor llama a WebGL 2 directamente
// (DllImport "porteo" con los nombres de GLES3: los resuelve la biblioteca GL de emscripten);
// acá sólo está lo que no es una llamada de GL: crear el contexto y habilitar extensiones.
#include <emscripten/html5.h>

static EMSCRIPTEN_WEBGL_CONTEXT_HANDLE contexto;

int porteo_contexto(const char* selector, int antialias, int alfa)
{
    EmscriptenWebGLContextAttributes a;
    emscripten_webgl_init_context_attributes(&a);
    a.majorVersion = 2;
    a.minorVersion = 0;
    a.alpha = alfa;
    a.depth = 1;
    a.stencil = 1;
    a.antialias = antialias;
    a.premultipliedAlpha = 0;
    a.preserveDrawingBuffer = 0;
    a.powerPreference = EM_WEBGL_POWER_PREFERENCE_HIGH_PERFORMANCE;
    a.enableExtensionsByDefault = 1;
    contexto = emscripten_webgl_create_context(selector, &a);
    if (contexto <= 0) return (int)contexto;
    emscripten_webgl_make_context_current(contexto);
    return 1;
}

int porteo_extension(const char* nombre)
{
    return emscripten_webgl_enable_extension(contexto, nombre);
}

// el tamaño del lienzo en píxeles del dispositivo (lo fija el JS según la pantalla)
void porteo_tamano(int* ancho, int* alto)
{
    emscripten_webgl_get_drawing_buffer_size(contexto, ancho, alto);
}
