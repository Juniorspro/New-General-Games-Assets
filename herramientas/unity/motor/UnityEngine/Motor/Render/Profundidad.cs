using System;
using UnityEngine;

namespace Porteo.Render
{
    // _CameraDepthTexture: la profundidad de lo opaco que dibujó la cámara, para los shaders que la
    // leen (el agua con profundidad, las auras de los slimes, las partículas suaves). Unity la arma
    // antes de lo transparente; acá se copia el buffer de profundidad del destino intermedio después
    // de los opacos, así lo transparente la lee sin dibujar la escena dos veces.
    internal static class Profundidad
    {
        // la textura de GL como Texture del motor, para ponerla en la tabla global
        sealed class TexturaProfundidad : Texture
        {
            internal TexturaProfundidad() { m_Name = "_CameraDepthTexture"; filtro = FilterMode.Point; envolverU = envolverV = TextureWrapMode.Clamp; }
            internal void Poner(uint id, int w, int h) { gl = id; ancho = w; alto = h; mips = 1; parametrosSucios = true; }
            public override int width { get => ancho; set { } }
            public override int height { get => alto; set { } }
            internal override uint IdGl() { AplicarParametros(); return gl; }
        }

        static readonly int ID = Ids.De("_CameraDepthTexture"), ID_TEXEL = Ids.De("_CameraDepthTexture_TexelSize");
        static TexturaProfundidad textura;
        static uint tex, fbo;
        static int ancho, alto;

        static unsafe void Preparar(int w, int h)
        {
            if (tex != 0 && w == ancho && h == alto) return;
            if (tex == 0)
            {
                uint t, f;
                Gl.GenTextures(1, &t); tex = t;
                Gl.GenFramebuffers(1, &f); fbo = f;
            }
            ancho = w; alto = h;
            Gpu.AtarParaSubir(Gl.TEXTURE_2D, tex);
            // el mismo formato que el buffer de profundidad de los destinos: la copia lo exige
            Gl.TexImage2D(Gl.TEXTURE_2D, 0, (int)Gl.DEPTH24_STENCIL8, w, h, 0, Gl.DEPTH_STENCIL, Gl.UNSIGNED_INT_24_8, null);
            Gl.TexParameteri(Gl.TEXTURE_2D, Gl.TEXTURE_COMPARE_MODE, 0);
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, fbo);
            Gl.FramebufferTexture2D(Gl.FRAMEBUFFER, Gl.DEPTH_STENCIL_ATTACHMENT, Gl.TEXTURE_2D, tex, 0);
            textura ??= new TexturaProfundidad();
            textura.Poner(tex, w, h);
            Gpu.Olvidar();
        }

        // copia la profundidad del destino atado ahora (un RenderTexture con profundidad)
        internal static void Copiar(RenderTexture origen)
        {
            if ((object)origen == null || origen.fbo == 0 || origen.rbo == 0) return;
            int w = origen.width, h = origen.height;
            Preparar(w, h);
            Gl.BindFramebuffer(Gl.READ_FRAMEBUFFER, origen.fbo);
            Gl.BindFramebuffer(Gl.DRAW_FRAMEBUFFER, fbo);
            Gl.BlitFramebuffer(0, 0, w, h, 0, 0, w, h, Gl.DEPTH_BUFFER_BIT, Gl.NEAREST);
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, origen.fbo);
            var g = Globales.Tabla;
            g.PonerTextura(ID, textura);
            g.Poner(ID_TEXEL, Valor.Vec(new Vector4(1f / w, 1f / h, w, h)));
        }

        // copia el color de un destino a otro (null = el lienzo), en el rectángulo de la cámara
        internal static void CopiarColor(RenderTexture desde, RenderTexture hacia, int x, int y, int w, int h)
        {
            Gl.BindFramebuffer(Gl.READ_FRAMEBUFFER, (object)desde == null ? 0 : desde.Fbo());
            Gl.BindFramebuffer(Gl.DRAW_FRAMEBUFFER, (object)hacia == null ? 0 : hacia.Fbo());
            Gl.BlitFramebuffer(x, y, x + w, y + h, x, y, x + w, y + h, Gl.COLOR_BUFFER_BIT, Gl.NEAREST);
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, 0);
            Destinos.Actual = null;
        }
    }
}
