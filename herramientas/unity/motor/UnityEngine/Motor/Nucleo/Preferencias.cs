using System;
using System.Collections.Generic;
using System.IO;
using Porteo;

namespace UnityEngine
{
    // PlayerPrefs: un archivo en el disco persistente del juego (en el navegador ese disco lo guarda
    // IndexedDB, como las partidas). Unity guarda los tipos: pedir un int de una clave float da el
    // valor por defecto. Lo que cambia se escribe al final del cuadro (o con Save).
    public class PlayerPrefs
    {
        enum Tipo : byte { Entero, Real, Cadena }

        static Dictionary<string, (Tipo t, int i, float f, string s)> valores;
        static bool sucio, enganchado;

        static string Archivo => Path.Combine(Plataforma.RutaPersistente, "porteo-playerprefs.bin");

        static Dictionary<string, (Tipo t, int i, float f, string s)> Valores()
        {
            if (valores != null) return valores;
            valores = new Dictionary<string, (Tipo, int, float, string)>();
            try
            {
                if (!File.Exists(Archivo)) return valores;
                using var r = new BinaryReader(File.OpenRead(Archivo));
                if (r.ReadInt32() != 0x31525050) return valores;   // "PPR1"
                int n = r.ReadInt32();
                for (int k = 0; k < n; k++)
                {
                    var t = (Tipo)r.ReadByte();
                    var clave = r.ReadString();
                    switch (t)
                    {
                        case Tipo.Entero: valores[clave] = (t, r.ReadInt32(), 0, null); break;
                        case Tipo.Real: valores[clave] = (t, 0, r.ReadSingle(), null); break;
                        default: valores[clave] = (t, 0, 0, r.ReadString()); break;
                    }
                }
            }
            catch (Exception e) { Debug.LogWarning("porteo: PlayerPrefs ilegibles: " + e.Message); }
            return valores;
        }

        static void Cambio()
        {
            sucio = true;
            if (enganchado) return;
            enganchado = true;
            Mundo.AlTerminarCuadro += () => { if (sucio) Save(); };
        }

        public static void SetInt(string key, int value) { Valores()[key] = (Tipo.Entero, value, 0, null); Cambio(); }
        public static void SetFloat(string key, float value) { Valores()[key] = (Tipo.Real, 0, value, null); Cambio(); }
        public static void SetString(string key, string value) { Valores()[key] = (Tipo.Cadena, 0, 0, value ?? ""); Cambio(); }

        public static int GetInt(string key, int defaultValue) => Valores().TryGetValue(key, out var v) && v.t == Tipo.Entero ? v.i : defaultValue;
        public static int GetInt(string key) => GetInt(key, 0);
        public static float GetFloat(string key, float defaultValue) => Valores().TryGetValue(key, out var v) && v.t == Tipo.Real ? v.f : defaultValue;
        public static float GetFloat(string key) => GetFloat(key, 0f);
        public static string GetString(string key, string defaultValue) => Valores().TryGetValue(key, out var v) && v.t == Tipo.Cadena ? v.s : defaultValue;
        public static string GetString(string key) => GetString(key, "");

        public static bool HasKey(string key) => Valores().ContainsKey(key);
        public static void DeleteKey(string key) { if (Valores().Remove(key)) Cambio(); }
        public static void DeleteAll() { Valores().Clear(); Cambio(); }

        public static void Save()
        {
            sucio = false;
            try
            {
                Directory.CreateDirectory(Plataforma.RutaPersistente);
                var tmp = Archivo + ".nuevo";
                using (var w = new BinaryWriter(File.Create(tmp)))
                {
                    var d = Valores();
                    w.Write(0x31525050);
                    w.Write(d.Count);
                    foreach (var kv in d)
                    {
                        w.Write((byte)kv.Value.t);
                        w.Write(kv.Key);
                        switch (kv.Value.t)
                        {
                            case Tipo.Entero: w.Write(kv.Value.i); break;
                            case Tipo.Real: w.Write(kv.Value.f); break;
                            default: w.Write(kv.Value.s ?? ""); break;
                        }
                    }
                }
                File.Move(tmp, Archivo, true);
            }
            catch (Exception e) { Debug.LogWarning("porteo: no pude guardar PlayerPrefs: " + e.Message); }
        }
    }
}
