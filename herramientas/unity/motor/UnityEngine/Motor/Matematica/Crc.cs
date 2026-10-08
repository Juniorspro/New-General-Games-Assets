using System.Text;

namespace Porteo
{
    // El CRC-32 que usa Unity para los nombres (Animator.StringToHash, los hash de los huesos y de
    // las rutas de las animaciones): el de siempre, IEEE 802.3.
    public static class Crc
    {
        static readonly uint[] tabla = Tabla();

        static uint[] Tabla()
        {
            var t = new uint[256];
            for (uint i = 0; i < 256; i++)
            {
                uint c = i;
                for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
                t[i] = c;
            }
            return t;
        }

        public static uint De(string s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            var b = Encoding.UTF8.GetBytes(s);
            uint c = 0xFFFFFFFFu;
            foreach (var x in b) c = tabla[(c ^ x) & 0xFF] ^ (c >> 8);
            return c ^ 0xFFFFFFFFu;
        }
    }
}

namespace UnityEngine
{
    public partial class Animator : Behaviour
    {
        public static int StringToHash(string name) => unchecked((int)Porteo.Crc.De(name));
    }
}
