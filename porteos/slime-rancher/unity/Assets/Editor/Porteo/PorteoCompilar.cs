// porteo: compila Slime Rancher para WebGL con la configuración que necesita el navegador.
//
//   Unity -batchmode -quit -projectPath PROYECTO -buildTarget WebGL \
//         -executeMethod PorteoCompilar.WebGL -porteoSalida CARPETA
//
// También anda desde el editor: menú Porteo → Compilar WebGL.
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine.Rendering;

public static class PorteoCompilar
{
	[MenuItem("Porteo/Compilar WebGL")]
	public static void WebGL()
	{
		string salida = Argumento("-porteoSalida") ?? "Compilado/WebGL";
		// El mundo es una sola escena de 357 mil objetos: el máximo que deja Unity 2018.4.
		PlayerSettings.WebGL.memorySize = 2032;
		// El código decompilado viene de Mono, que convierte los null en excepciones que Unity
		// anota y sigue. Sin esto, en WebGL un null se lee como basura en vez de cortar.
		PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.FullWithoutStacktrace;
		PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
		PlayerSettings.WebGL.dataCaching = true;  // los datos quedan en IndexedDB: la 2.ª vez no se bajan
		PlayerSettings.WebGL.linkerTarget = WebGLLinkerTarget.Wasm;
		PlayerSettings.WebGL.template = "PROJECT:Porteo";
		// Los shaders del APK traen programas GLES2 y GLES3: WebGL 1 y 2 usan esos mismos.
		PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
		PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3, GraphicsDeviceType.OpenGLES2 });
		PlayerSettings.SetManagedStrippingLevel(BuildTargetGroup.WebGL, ManagedStrippingLevel.Low);
		PlayerSettings.stripEngineCode = false;

		string[] escenas = EditorBuildSettings.scenes.Where(e => e.enabled).Select(e => e.path).ToArray();
		BuildReport informe = BuildPipeline.BuildPlayer(escenas, salida, BuildTarget.WebGL, BuildOptions.None);
		Console.WriteLine($"porteo: {informe.summary.result}, {informe.summary.totalSize / 1048576} MB, {informe.summary.totalErrors} errores");
		if (UnityEditorInternal.InternalEditorUtility.inBatchMode && informe.summary.result != BuildResult.Succeeded)
			EditorApplication.Exit(1);
	}

	private static string Argumento(string nombre)
	{
		string[] a = Environment.GetCommandLineArgs();
		int i = Array.IndexOf(a, nombre);
		return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
	}
}
