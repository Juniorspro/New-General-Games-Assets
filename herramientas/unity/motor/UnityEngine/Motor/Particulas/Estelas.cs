using System;
using System.Collections.Generic;
using UnityEngine;

namespace Porteo.Particulas
{
    // Las estelas de las partículas (TrailModule): cada una guarda por dónde pasó su partícula (un
    // punto cada distancia mínima) y cuándo; cada punto vive lo que diga el módulo (una fracción
    // de la vida de la partícula). Si la partícula muere y la estela no muere con ella, queda
    // huérfana hasta que se le vencen todos los puntos.
    internal sealed class EstelasVivas
    {
        internal sealed class Estela
        {
            public Vector3[] P = new Vector3[8];
            public float[] T = new float[8];
            public int Cuenta;
            public bool Usada, Huerfana;
            public float Vida;
            public Vector3 Cabeza;
            public Color Col = Color.white;
            public float Ancho = 1;
        }

        internal readonly List<Estela> lista = new List<Estela>();
        readonly Stack<int> libres = new Stack<int>();
        public float Reloj;

        public bool Vacias
        {
            get
            {
                foreach (var e in lista) if (e.Usada && (e.Cuenta > 0 || !e.Huerfana)) return false;
                return true;
            }
        }

        public int Nueva(Vector3 pos, float vida)
        {
            int i;
            if (libres.Count > 0) i = libres.Pop();
            else { i = lista.Count; lista.Add(new Estela()); }
            var e = lista[i];
            e.Usada = true; e.Huerfana = false; e.Cuenta = 0; e.Vida = Math.Max(vida, 1e-3f);
            e.Cabeza = pos;
            Agregar(e, pos);
            return i;
        }

        static void Agregar(Estela e, Vector3 pos, float t)
        {
            if (e.Cuenta == e.P.Length)
            {
                Array.Resize(ref e.P, e.P.Length * 2);
                Array.Resize(ref e.T, e.T.Length * 2);
            }
            e.P[e.Cuenta] = pos;
            e.T[e.Cuenta] = t;
            e.Cuenta++;
        }

        void Agregar(Estela e, Vector3 pos) => Agregar(e, pos, Reloj);

        public void Mover(int i, Vector3 pos, float distMin)
        {
            var e = lista[i];
            e.Cabeza = pos;
            if (e.Cuenta == 0 || (pos - e.P[e.Cuenta - 1]).sqrMagnitude >= distMin * distMin) Agregar(e, pos);
        }

        public void Soltar(int i, bool borrar)
        {
            if (i < 0 || i >= lista.Count) return;
            var e = lista[i];
            if (borrar || e.Cuenta == 0) Liberar(i);
            else e.Huerfana = true;
        }

        void Liberar(int i)
        {
            var e = lista[i];
            if (!e.Usada) return;
            e.Usada = false; e.Cuenta = 0;
            libres.Push(i);
        }

        // los puntos que ya vivieron lo suyo se van (los más viejos están al principio)
        public void Vencer()
        {
            for (int i = 0; i < lista.Count; i++)
            {
                var e = lista[i];
                if (!e.Usada) continue;
                int k = 0;
                while (k < e.Cuenta && Reloj - e.T[k] > e.Vida) k++;
                // el último punto de una estela viva se queda: es de donde sale el tramo a la cabeza
                if (!e.Huerfana && k >= e.Cuenta) k = e.Cuenta - 1;
                if (k > 0)
                {
                    Array.Copy(e.P, k, e.P, 0, e.Cuenta - k);
                    Array.Copy(e.T, k, e.T, 0, e.Cuenta - k);
                    e.Cuenta -= k;
                }
                if (e.Huerfana && e.Cuenta == 0) Liberar(i);
            }
        }

        public void Limpiar()
        {
            for (int i = 0; i < lista.Count; i++) Liberar(i);
        }
    }
}
