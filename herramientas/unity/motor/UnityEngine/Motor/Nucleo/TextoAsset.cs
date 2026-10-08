using System;
using System.Text;
using Porteo.Datos;

namespace UnityEngine
{
    // Un archivo de texto o binario del proyecto: los bytes tal cual; .text los lee como UTF-8.
    public partial class TextAsset : Object
    {
        byte[] contenido = Array.Empty<byte>();
        int recurso = -1;
        string texto;

        public TextAsset() : this("") { }

        public TextAsset(string text)
        {
            texto = text ?? "";
            contenido = Encoding.UTF8.GetBytes(texto);
        }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            texto = null;
            switch (m["m_Script"])
            {
                case byte[] b: contenido = b; break;
                case Recurso rec: recurso = rec.Id; break;
                case string s: contenido = Encoding.UTF8.GetBytes(s); break;
            }
        }

        byte[] Datos()
        {
            if (recurso >= 0)
            {
                contenido = Cargador.Recurso(recurso);
                recurso = -1;
            }
            return contenido;
        }

        public string text => texto ??= Encoding.UTF8.GetString(Datos());
        public byte[] bytes => (byte[])Datos().Clone();
        public override string ToString() => text;
    }
}
