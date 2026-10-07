// Exporta un juego de Unity (la carpeta de datos de un APK) como proyecto de Unity, sin interfaz.
//   Ripear DATOS SALIDA [dummy|yaml]
using AssetRipper.Export.Configuration;
using AssetRipper.Export.UnityProjects;
using AssetRipper.Import.Logging;
using AssetRipper.IO.Files;

Logger.Add(new ConsoleLogger(false));
Logger.Add(new FileLogger(Path.Join(args[1] + ".log")));
FullConfiguration ajustes = new();
// Los shaders: el free de AssetRipper no los decompila. En YAML quedan con sus programas GLES
// compilados, que son los mismos que usa WebGL; "dummy" los cambia por uno difuso simple.
ajustes.ExportSettings.ShaderExportMode = args.Length > 2 && args[2] == "dummy" ? ShaderExportMode.Dummy : ShaderExportMode.Yaml;
ajustes.LogConfigurationValues();
ExportHandler exportar = new(ajustes);
var datos = exportar.LoadAndProcess([args[0]], LocalFileSystem.Instance);
if (Directory.Exists(args[1])) Directory.Delete(args[1], true);
exportar.Export(datos, args[1], LocalFileSystem.Instance);
