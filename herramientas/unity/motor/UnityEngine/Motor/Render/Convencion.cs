using System;
using UnityEngine;

namespace Porteo.Render
{
    // Los shaders de un juego de PC vienen de Direct3D 11 (los traduce HLSLcc) y traen pegadas las
    // convenciones de D3D: la profundidad al revés (cerca = 1, lejos = 0, como hace Unity en D3D),
    // las coordenadas de textura que empiezan arriba y la imagen de la pantalla con la fila 0
    // arriba. El exportador les agrega al final del vertex shader el paso a las de GL (y negada y
    // z de [0,1] a [-1,1]), así la memoria queda igual que en D3D; acá se hace el resto de lo que
    // hace Unity en D3D: las proyecciones "de GPU" (z al revés y, al dibujar en una textura, y
    // invertida), la comparación de profundidad y el borrado al revés, la cara de adelante según
    // adónde se dibuja y el rectángulo de dibujo dado vuelta en la pantalla (que el navegador
    // muestra espejada con CSS). Los juegos de teléfono (GLES3) no pasan por nada de esto.
    public static class Convencion
    {
        public static bool D3D;

        static bool Lienzo => (object)Destinos.Actual == null;

        // lo que vale "lejos" en el buffer de profundidad
        public static float Lejos => D3D ? 0f : 1f;

        // la proyección que reciben los shaders (GL.GetGPUProjectionMatrix de Unity en D3D11)
        public static Matrix4x4 Gpu(Matrix4x4 p, bool aTextura)
        {
            if (!D3D) return p;
            // z: de [-w, w] (GL, cerca = -w) a [w, 0] (D3D al revés): z' = (w - z) / 2
            p.m20 = 0.5f * (p.m30 - p.m20);
            p.m21 = 0.5f * (p.m31 - p.m21);
            p.m22 = 0.5f * (p.m32 - p.m22);
            p.m23 = 0.5f * (p.m33 - p.m23);
            if (aTextura) { p.m10 = -p.m10; p.m11 = -p.m11; p.m12 = -p.m12; p.m13 = -p.m13; }
            return p;
        }

        // la proyección para lo que se dibuja ahora (según el destino atado)
        public static Matrix4x4 GpuActual(Matrix4x4 p) => Gpu(p, !Lienzo);

        // _ProjectionParams.x: -1 si la proyección quedó invertida (dibujando en una textura)
        public static float SignoProyeccion(bool aTextura) => D3D && aTextura ? -1f : 1f;

        // _ZBufferParams (con la profundidad al revés, como la arma Unity)
        public static Vector4 ParametrosZ(float n, float f)
        {
            if (!D3D) return new Vector4(1 - f / n, f / n, (1 - f / n) / f, (f / n) / f);
            float x = -1 + f / n;
            return new Vector4(x, 1, x / f, 1 / f);
        }

        // CompareFunction de Unity → la de GL, al revés para la profundidad en D3D
        public static int Comparacion(int f)
        {
            if (!D3D) return f;
            switch (f)
            {
                case 2: return 5;   // Less → Greater
                case 4: return 7;   // LessEqual → GreaterEqual
                case 5: return 2;
                case 7: return 4;
                default: return f;
            }
        }

        public static float Desplazamiento(float v) => D3D ? -v : v;

        // al cambiar de destino: la cara de adelante. Unity dibuja con el frente horario; en la
        // pantalla de D3D la imagen queda espejada en vertical (y lo horario pasa a antihorario)
        static uint frente;
        public static void AlAtar()
        {
            if (!D3D) return;
            uint f = Lienzo ? Gl.CCW : Gl.CW;
            if (f == frente) return;
            Gl.FrontFace(f);
            frente = f;
        }

        public static void Olvidar() => frente = 0;

        // el rectángulo de dibujo (y desde abajo, como Unity); en la pantalla de D3D va dado vuelta
        public static void Viewport(int x, int y, int w, int h)
        {
            if (D3D && Lienzo) y = Destinos.Alto - (y + h);
            Gl.Viewport(x, y, w, h);
        }

        public static void Scissor(int x, int y, int w, int h)
        {
            if (D3D && Lienzo) y = Destinos.Alto - (y + h);
            Gl.Scissor(x, y, w, h);
        }

        // las filas de la memoria de un rectángulo del destino (y desde abajo) y si van al revés
        public static int FilaMemoria(bool lienzo, int altoDestino, int y, int h) => D3D && lienzo ? altoDestino - (y + h) : y;
    }
}
