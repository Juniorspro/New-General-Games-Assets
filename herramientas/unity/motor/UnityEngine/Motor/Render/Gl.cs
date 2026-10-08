using System.Runtime.InteropServices;

namespace Porteo.Render
{
    // WebGL 2 desde C#: en el navegador, "porteo" es la biblioteca nativa del anfitrión y los
    // símbolos glXxx los pone la capa GL de emscripten (cada llamada va directo a WebGL). Fuera
    // del navegador (la consola de pruebas) no se llama nunca: el render no se inicia.
    public static unsafe class Gl
    {
        const string L = "porteo";

        [DllImport(L)] public static extern int porteo_contexto(byte* selector, int antialias, int alfa);
        [DllImport(L)] public static extern int porteo_extension(byte* nombre);
        [DllImport(L)] public static extern void porteo_tamano(int* ancho, int* alto);

        [DllImport(L, EntryPoint = "glActiveTexture")] public static extern void ActiveTexture(uint t);
        [DllImport(L, EntryPoint = "glAttachShader")] public static extern void AttachShader(uint p, uint s);
        [DllImport(L, EntryPoint = "glBindBuffer")] public static extern void BindBuffer(uint objetivo, uint b);
        [DllImport(L, EntryPoint = "glBindBufferBase")] public static extern void BindBufferBase(uint objetivo, uint indice, uint b);
        [DllImport(L, EntryPoint = "glBindFramebuffer")] public static extern void BindFramebuffer(uint objetivo, uint f);
        [DllImport(L, EntryPoint = "glBindRenderbuffer")] public static extern void BindRenderbuffer(uint objetivo, uint r);
        [DllImport(L, EntryPoint = "glBindTexture")] public static extern void BindTexture(uint objetivo, uint t);
        [DllImport(L, EntryPoint = "glBindVertexArray")] public static extern void BindVertexArray(uint v);
        [DllImport(L, EntryPoint = "glBlendEquationSeparate")] public static extern void BlendEquationSeparate(uint c, uint a);
        [DllImport(L, EntryPoint = "glBlendFuncSeparate")] public static extern void BlendFuncSeparate(uint sc, uint dc, uint sa, uint da);
        [DllImport(L, EntryPoint = "glBlitFramebuffer")] public static extern void BlitFramebuffer(int x0, int y0, int x1, int y1, int dx0, int dy0, int dx1, int dy1, uint mascara, uint filtro);
        [DllImport(L, EntryPoint = "glBufferData")] public static extern void BufferData(uint objetivo, nint tam, void* datos, uint uso);
        [DllImport(L, EntryPoint = "glBufferSubData")] public static extern void BufferSubData(uint objetivo, nint desde, nint tam, void* datos);
        [DllImport(L, EntryPoint = "glCheckFramebufferStatus")] public static extern uint CheckFramebufferStatus(uint objetivo);
        [DllImport(L, EntryPoint = "glClear")] public static extern void Clear(uint mascara);
        [DllImport(L, EntryPoint = "glClearColor")] public static extern void ClearColor(float r, float g, float b, float a);
        [DllImport(L, EntryPoint = "glClearDepthf")] public static extern void ClearDepthf(float d);
        [DllImport(L, EntryPoint = "glClearStencil")] public static extern void ClearStencil(int s);
        [DllImport(L, EntryPoint = "glColorMask")] public static extern void ColorMask(byte r, byte g, byte b, byte a);
        [DllImport(L, EntryPoint = "glCompileShader")] public static extern void CompileShader(uint s);
        [DllImport(L, EntryPoint = "glCompressedTexImage2D")] public static extern void CompressedTexImage2D(uint objetivo, int nivel, uint formato, int ancho, int alto, int borde, int tam, void* datos);
        [DllImport(L, EntryPoint = "glCopyTexSubImage2D")] public static extern void CopyTexSubImage2D(uint objetivo, int nivel, int dx, int dy, int x, int y, int ancho, int alto);
        [DllImport(L, EntryPoint = "glCreateProgram")] public static extern uint CreateProgram();
        [DllImport(L, EntryPoint = "glCreateShader")] public static extern uint CreateShader(uint tipo);
        [DllImport(L, EntryPoint = "glCullFace")] public static extern void CullFace(uint modo);
        [DllImport(L, EntryPoint = "glDeleteBuffers")] public static extern void DeleteBuffers(int n, uint* b);
        [DllImport(L, EntryPoint = "glDeleteFramebuffers")] public static extern void DeleteFramebuffers(int n, uint* f);
        [DllImport(L, EntryPoint = "glDeleteProgram")] public static extern void DeleteProgram(uint p);
        [DllImport(L, EntryPoint = "glDeleteRenderbuffers")] public static extern void DeleteRenderbuffers(int n, uint* r);
        [DllImport(L, EntryPoint = "glDeleteShader")] public static extern void DeleteShader(uint s);
        [DllImport(L, EntryPoint = "glDeleteTextures")] public static extern void DeleteTextures(int n, uint* t);
        [DllImport(L, EntryPoint = "glDeleteVertexArrays")] public static extern void DeleteVertexArrays(int n, uint* v);
        [DllImport(L, EntryPoint = "glDepthFunc")] public static extern void DepthFunc(uint f);
        [DllImport(L, EntryPoint = "glDepthMask")] public static extern void DepthMask(byte m);
        [DllImport(L, EntryPoint = "glDisable")] public static extern void Disable(uint c);
        [DllImport(L, EntryPoint = "glDisableVertexAttribArray")] public static extern void DisableVertexAttribArray(uint i);
        [DllImport(L, EntryPoint = "glDrawArrays")] public static extern void DrawArrays(uint modo, int primero, int n);
        [DllImport(L, EntryPoint = "glDrawArraysInstanced")] public static extern void DrawArraysInstanced(uint modo, int primero, int n, int instancias);
        [DllImport(L, EntryPoint = "glDrawBuffers")] public static extern void DrawBuffers(int n, uint* b);
        [DllImport(L, EntryPoint = "glDrawElements")] public static extern void DrawElements(uint modo, int n, uint tipo, nint desde);
        [DllImport(L, EntryPoint = "glDrawElementsInstanced")] public static extern void DrawElementsInstanced(uint modo, int n, uint tipo, nint desde, int instancias);
        [DllImport(L, EntryPoint = "glEnable")] public static extern void Enable(uint c);
        [DllImport(L, EntryPoint = "glEnableVertexAttribArray")] public static extern void EnableVertexAttribArray(uint i);
        [DllImport(L, EntryPoint = "glFramebufferRenderbuffer")] public static extern void FramebufferRenderbuffer(uint objetivo, uint adjunto, uint rbObjetivo, uint r);
        [DllImport(L, EntryPoint = "glFramebufferTexture2D")] public static extern void FramebufferTexture2D(uint objetivo, uint adjunto, uint texObjetivo, uint t, int nivel);
        [DllImport(L, EntryPoint = "glFrontFace")] public static extern void FrontFace(uint modo);
        [DllImport(L, EntryPoint = "glGenBuffers")] public static extern void GenBuffers(int n, uint* b);
        [DllImport(L, EntryPoint = "glGenFramebuffers")] public static extern void GenFramebuffers(int n, uint* f);
        [DllImport(L, EntryPoint = "glGenRenderbuffers")] public static extern void GenRenderbuffers(int n, uint* r);
        [DllImport(L, EntryPoint = "glGenTextures")] public static extern void GenTextures(int n, uint* t);
        [DllImport(L, EntryPoint = "glGenVertexArrays")] public static extern void GenVertexArrays(int n, uint* v);
        [DllImport(L, EntryPoint = "glGenerateMipmap")] public static extern void GenerateMipmap(uint objetivo);
        [DllImport(L, EntryPoint = "glGetActiveAttrib")] public static extern void GetActiveAttrib(uint p, uint i, int tamBuf, int* largo, int* tam, uint* tipo, byte* nombre);
        [DllImport(L, EntryPoint = "glGetActiveUniform")] public static extern void GetActiveUniform(uint p, uint i, int tamBuf, int* largo, int* tam, uint* tipo, byte* nombre);
        [DllImport(L, EntryPoint = "glGetAttribLocation")] public static extern int GetAttribLocation(uint p, byte* nombre);
        [DllImport(L, EntryPoint = "glGetError")] public static extern uint GetError();
        [DllImport(L, EntryPoint = "glGetIntegerv")] public static extern void GetIntegerv(uint p, int* v);
        [DllImport(L, EntryPoint = "glGetProgramInfoLog")] public static extern void GetProgramInfoLog(uint p, int tamBuf, int* largo, byte* log);
        [DllImport(L, EntryPoint = "glGetProgramiv")] public static extern void GetProgramiv(uint p, uint q, int* v);
        [DllImport(L, EntryPoint = "glGetShaderInfoLog")] public static extern void GetShaderInfoLog(uint s, int tamBuf, int* largo, byte* log);
        [DllImport(L, EntryPoint = "glGetShaderiv")] public static extern void GetShaderiv(uint s, uint q, int* v);
        [DllImport(L, EntryPoint = "glGetString")] public static extern byte* GetString(uint n);
        [DllImport(L, EntryPoint = "glGetUniformLocation")] public static extern int GetUniformLocation(uint p, byte* nombre);
        [DllImport(L, EntryPoint = "glInvalidateFramebuffer")] public static extern void InvalidateFramebuffer(uint objetivo, int n, uint* adjuntos);
        [DllImport(L, EntryPoint = "glLinkProgram")] public static extern void LinkProgram(uint p);
        [DllImport(L, EntryPoint = "glPixelStorei")] public static extern void PixelStorei(uint p, int v);
        [DllImport(L, EntryPoint = "glPolygonOffset")] public static extern void PolygonOffset(float factor, float unidades);
        [DllImport(L, EntryPoint = "glReadPixels")] public static extern void ReadPixels(int x, int y, int ancho, int alto, uint formato, uint tipo, void* datos);
        [DllImport(L, EntryPoint = "glRenderbufferStorage")] public static extern void RenderbufferStorage(uint objetivo, uint formato, int ancho, int alto);
        [DllImport(L, EntryPoint = "glRenderbufferStorageMultisample")] public static extern void RenderbufferStorageMultisample(uint objetivo, int muestras, uint formato, int ancho, int alto);
        [DllImport(L, EntryPoint = "glFinish")] public static extern void Finish();
        [DllImport(L, EntryPoint = "glScissor")] public static extern void Scissor(int x, int y, int ancho, int alto);
        [DllImport(L, EntryPoint = "glShaderSource")] public static extern void ShaderSource(uint s, int n, byte** fuentes, int* largos);
        [DllImport(L, EntryPoint = "glStencilFuncSeparate")] public static extern void StencilFuncSeparate(uint cara, uint f, int r, uint mascara);
        [DllImport(L, EntryPoint = "glStencilMask")] public static extern void StencilMask(uint m);
        [DllImport(L, EntryPoint = "glStencilOpSeparate")] public static extern void StencilOpSeparate(uint cara, uint falla, uint fallaZ, uint pasa);
        [DllImport(L, EntryPoint = "glTexImage2D")] public static extern void TexImage2D(uint objetivo, int nivel, int formatoInterno, int ancho, int alto, int borde, uint formato, uint tipo, void* datos);
        [DllImport(L, EntryPoint = "glTexImage3D")] public static extern void TexImage3D(uint objetivo, int nivel, int formatoInterno, int ancho, int alto, int prof, int borde, uint formato, uint tipo, void* datos);
        [DllImport(L, EntryPoint = "glTexParameterf")] public static extern void TexParameterf(uint objetivo, uint p, float v);
        [DllImport(L, EntryPoint = "glTexParameteri")] public static extern void TexParameteri(uint objetivo, uint p, int v);
        [DllImport(L, EntryPoint = "glTexSubImage2D")] public static extern void TexSubImage2D(uint objetivo, int nivel, int x, int y, int ancho, int alto, uint formato, uint tipo, void* datos);
        [DllImport(L, EntryPoint = "glUniform1f")] public static extern void Uniform1f(int loc, float v);
        [DllImport(L, EntryPoint = "glUniform1fv")] public static extern void Uniform1fv(int loc, int n, float* v);
        [DllImport(L, EntryPoint = "glUniform1i")] public static extern void Uniform1i(int loc, int v);
        [DllImport(L, EntryPoint = "glUniform2fv")] public static extern void Uniform2fv(int loc, int n, float* v);
        [DllImport(L, EntryPoint = "glUniform3fv")] public static extern void Uniform3fv(int loc, int n, float* v);
        [DllImport(L, EntryPoint = "glUniform4fv")] public static extern void Uniform4fv(int loc, int n, float* v);
        // los enteros de a uno: los glUniformNiv de este emscripten (con más de 2 GB de memoria no
        // usa las variantes de WebGL 2 que leen del heap) copian a miniTempWebGLIntBuffers, que no
        // enlaza: "miniTempWebGLIntBuffers is not defined" y se corta el cuadro
        [DllImport(L, EntryPoint = "glUniform4i")] public static extern void Uniform4i(int loc, int x, int y, int z, int w);
        [DllImport(L, EntryPoint = "glUniformMatrix4fv")] public static extern void UniformMatrix4fv(int loc, int n, byte trans, float* v);
        [DllImport(L, EntryPoint = "glUseProgram")] public static extern void UseProgram(uint p);
        [DllImport(L, EntryPoint = "glVertexAttrib4f")] public static extern void VertexAttrib4f(uint i, float x, float y, float z, float w);
        [DllImport(L, EntryPoint = "glVertexAttribDivisor")] public static extern void VertexAttribDivisor(uint i, uint d);
        [DllImport(L, EntryPoint = "glVertexAttribIPointer")] public static extern void VertexAttribIPointer(uint i, int comps, uint tipo, int paso, nint desde);
        [DllImport(L, EntryPoint = "glVertexAttribPointer")] public static extern void VertexAttribPointer(uint i, int comps, uint tipo, byte norm, int paso, nint desde);
        [DllImport(L, EntryPoint = "glViewport")] public static extern void Viewport(int x, int y, int ancho, int alto);

        // ── constantes de GLES3 ──
        public const uint DEPTH_BUFFER_BIT = 0x0100, STENCIL_BUFFER_BIT = 0x0400, COLOR_BUFFER_BIT = 0x4000;
        public const uint POINTS = 0, LINES = 1, LINE_STRIP = 3, TRIANGLES = 4, TRIANGLE_STRIP = 5;
        public const uint ZERO = 0, ONE = 1, SRC_COLOR = 0x0300, ONE_MINUS_SRC_COLOR = 0x0301, SRC_ALPHA = 0x0302, ONE_MINUS_SRC_ALPHA = 0x0303,
            DST_ALPHA = 0x0304, ONE_MINUS_DST_ALPHA = 0x0305, DST_COLOR = 0x0306, ONE_MINUS_DST_COLOR = 0x0307, SRC_ALPHA_SATURATE = 0x0308;
        public const uint FUNC_ADD = 0x8006, FUNC_SUBTRACT = 0x800A, FUNC_REVERSE_SUBTRACT = 0x800B, MIN = 0x8007, MAX = 0x8008;
        public const uint ARRAY_BUFFER = 0x8892, ELEMENT_ARRAY_BUFFER = 0x8893, UNIFORM_BUFFER = 0x8A11;
        public const uint STATIC_DRAW = 0x88E4, DYNAMIC_DRAW = 0x88E8, STREAM_DRAW = 0x88E0;
        public const uint FRONT = 0x0404, BACK = 0x0405, FRONT_AND_BACK = 0x0408;
        public const uint TEXTURE_2D = 0x0DE1, CULL_FACE = 0x0B44, BLEND = 0x0BE2, STENCIL_TEST = 0x0B90, DEPTH_TEST = 0x0B71, SCISSOR_TEST = 0x0C11,
            POLYGON_OFFSET_FILL = 0x8037, SAMPLE_ALPHA_TO_COVERAGE = 0x809E;
        public const uint CW = 0x0900, CCW = 0x0901;
        public const uint BYTE = 0x1400, UNSIGNED_BYTE = 0x1401, SHORT = 0x1402, UNSIGNED_SHORT = 0x1403, INT = 0x1404, UNSIGNED_INT = 0x1405,
            FLOAT = 0x1406, HALF_FLOAT = 0x140B, UNSIGNED_INT_24_8 = 0x84FA, UNSIGNED_SHORT_5_6_5 = 0x8363, UNSIGNED_SHORT_4_4_4_4 = 0x8033,
            UNSIGNED_SHORT_5_5_5_1 = 0x8034;
        public const uint DEPTH_COMPONENT = 0x1902, ALPHA = 0x1906, RGB = 0x1907, RGBA = 0x1908, LUMINANCE = 0x1909, LUMINANCE_ALPHA = 0x190A,
            RED = 0x1903, RG = 0x8227, RED_INTEGER = 0x8D94, DEPTH_STENCIL = 0x84F9;
        public const int R8 = 0x8229, RG8 = 0x822B, RGB8 = 0x8051, RGBA8 = 0x8058, SRGB8_ALPHA8 = 0x8C43, R16F = 0x822D, RG16F = 0x822F, RGBA16F = 0x881A,
            RGBA32F = 0x8814, R32F = 0x822E, RGB565 = 0x8D62, RGBA4 = 0x8056, RGB5_A1 = 0x8057, DEPTH_COMPONENT16 = 0x81A5, DEPTH_COMPONENT24 = 0x81A6,
            DEPTH24_STENCIL8 = 0x88F0, R11F_G11F_B10F = 0x8C3A;
        public const uint VERTEX_SHADER = 0x8B31, FRAGMENT_SHADER = 0x8B30, COMPILE_STATUS = 0x8B81, LINK_STATUS = 0x8B82, INFO_LOG_LENGTH = 0x8B84,
            ACTIVE_UNIFORMS = 0x8B86, ACTIVE_ATTRIBUTES = 0x8B89;
        public const uint FLOAT_VEC2 = 0x8B50, FLOAT_VEC3 = 0x8B51, FLOAT_VEC4 = 0x8B52, INT_VEC2 = 0x8B53, INT_VEC3 = 0x8B54, INT_VEC4 = 0x8B55,
            BOOL = 0x8B56, FLOAT_MAT2 = 0x8B5A, FLOAT_MAT3 = 0x8B5B, FLOAT_MAT4 = 0x8B5C, SAMPLER_2D = 0x8B5E, SAMPLER_3D = 0x8B5F,
            SAMPLER_CUBE = 0x8B60, SAMPLER_2D_SHADOW = 0x8B62, SAMPLER_2D_ARRAY = 0x8DC1;
        public const uint TEXTURE0 = 0x84C0, TEXTURE_CUBE_MAP = 0x8513, TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515, TEXTURE_3D = 0x806F;
        public const uint TEXTURE_MAG_FILTER = 0x2800, TEXTURE_MIN_FILTER = 0x2801, TEXTURE_WRAP_S = 0x2802, TEXTURE_WRAP_T = 0x2803, TEXTURE_WRAP_R = 0x8072,
            TEXTURE_MAX_LEVEL = 0x813D, TEXTURE_BASE_LEVEL = 0x813C, TEXTURE_COMPARE_MODE = 0x884C, TEXTURE_COMPARE_FUNC = 0x884D,
            TEXTURE_MAX_ANISOTROPY = 0x84FE, COMPARE_REF_TO_TEXTURE = 0x884E;
        public const int NEAREST = 0x2600, LINEAR = 0x2601, NEAREST_MIPMAP_NEAREST = 0x2700, LINEAR_MIPMAP_NEAREST = 0x2701,
            NEAREST_MIPMAP_LINEAR = 0x2702, LINEAR_MIPMAP_LINEAR = 0x2703, REPEAT = 0x2901, CLAMP_TO_EDGE = 0x812F, MIRRORED_REPEAT = 0x8370;
        public const uint NEVER = 0x0200, LESS = 0x0201, EQUAL = 0x0202, LEQUAL = 0x0203, GREATER = 0x0204, NOTEQUAL = 0x0205, GEQUAL = 0x0206, ALWAYS = 0x0207;
        public const uint KEEP = 0x1E00, REPLACE = 0x1E01, INCR = 0x1E02, DECR = 0x1E03, INVERT = 0x150A, INCR_WRAP = 0x8507, DECR_WRAP = 0x8508;
        public const uint FRAMEBUFFER = 0x8D40, READ_FRAMEBUFFER = 0x8CA8, DRAW_FRAMEBUFFER = 0x8CA9, RENDERBUFFER = 0x8D41, COLOR_ATTACHMENT0 = 0x8CE0,
            DEPTH_ATTACHMENT = 0x8D00, STENCIL_ATTACHMENT = 0x8D20, DEPTH_STENCIL_ATTACHMENT = 0x821A, FRAMEBUFFER_COMPLETE = 0x8CD5;
        public const uint UNPACK_ALIGNMENT = 0x0CF5, PACK_ALIGNMENT = 0x0D05, UNPACK_FLIP_Y_WEBGL = 0x9240, UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
        public const uint MAX_TEXTURE_SIZE = 0x0D33, MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0x8B4D, MAX_SAMPLES = 0x8D57, VERSION = 0x1F02, RENDERER = 0x1F01;
        // texturas comprimidas
        public const uint COMPRESSED_RGB8_ETC2 = 0x9274, COMPRESSED_SRGB8_ETC2 = 0x9275, COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276,
            COMPRESSED_RGBA8_ETC2_EAC = 0x9278, COMPRESSED_R11_EAC = 0x9270, COMPRESSED_RG11_EAC = 0x9272;
        public const uint COMPRESSED_RGB_S3TC_DXT1 = 0x83F0, COMPRESSED_RGBA_S3TC_DXT1 = 0x83F1, COMPRESSED_RGBA_S3TC_DXT3 = 0x83F2, COMPRESSED_RGBA_S3TC_DXT5 = 0x83F3;
        public const uint COMPRESSED_RGBA_ASTC_4x4 = 0x93B0;
    }
}
