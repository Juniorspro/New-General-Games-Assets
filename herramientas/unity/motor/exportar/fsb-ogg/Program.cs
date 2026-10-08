// fsb-ogg DIRECTORIO_DE_RECURSOS: cada recurso que empieza con "FSB5" se reemplaza por el Ogg
// equivalente. El audio del APK es Vorbis dentro de FSB5; FMOD no guarda los encabezados de
// Vorbis (sólo un CRC del de configuración), así que Fmod5Sharp los repone de su tabla y arma
// las páginas Ogg con los mismos paquetes: no se pierde nada de calidad.
using Fmod5Sharp;
using Fmod5Sharp.FmodTypes;

if (args.Length < 1) { Console.Error.WriteLine("uso: fsb-ogg DIRECTORIO_DE_RECURSOS"); return 2; }
int hechos = 0, fallas = 0;
long antes = 0, despues = 0;
foreach (var ruta in Directory.EnumerateFiles(args[0]))
{
    var cab = new byte[4];
    using (var f = File.OpenRead(ruta)) if (f.Read(cab, 0, 4) < 4) continue;
    if (cab[0] != 'F' || cab[1] != 'S' || cab[2] != 'B' || cab[3] != '5') continue;
    var datos = File.ReadAllBytes(ruta);
    if (FsbLoader.TryLoadFsbFromByteArray(datos, out FmodSoundBank banco) && banco.Samples.Count == 1 &&
        banco.Samples[0].RebuildAsStandardFileFormat(out var salida, out var ext) && salida != null && ext == "ogg")
    {
        File.WriteAllBytes(ruta, salida);
        hechos++; antes += datos.Length; despues += salida.Length;
    }
    else
    {
        fallas++;
        Console.Error.WriteLine($"fsb-ogg: no se pudo pasar {Path.GetFileName(ruta)} ({banco?.Header.AudioType})");
    }
}
Console.WriteLine($"fsb-ogg: {hechos} clips a Ogg ({antes / 1e6:F1} MB → {despues / 1e6:F1} MB), {fallas} fallas");
return fallas > 0 ? 1 : 0;
