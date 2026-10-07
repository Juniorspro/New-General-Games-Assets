# Unity

`analizar-apk.py` dice qué hay adentro de un APK de Unity sin ejecutar nada de él:
paquete, permisos, firma y ABIs; si el código es Mono (el C# se puede decompilar) o
IL2CPP (compilado a nativo); qué bibliotecas y direcciones de red trae; y los datos:
versión de Unity, escenas, objetos, texturas por formato, mallas y audio.

```bash
python3 -m venv ~/.porteo/unity && ~/.porteo/unity/bin/pip install dnfile UnityPy pyaxmlparser
~/.porteo/unity/bin/python -I herramientas/unity/analizar-apk.py JUEGO.apk [CARPETA_DE_TRABAJO]
```

Los datos (`assets/bin/Data`) se sacan a la carpeta de trabajo y pueden pasar de 1 GB.

## Lo que hay que mirar para llevarlo a la web

- **Mono o IL2CPP.** Con Mono, AssetRipper reconstruye el proyecto con los scripts
  en C# y se puede recompilar para WebGL. Con IL2CPP, del C# quedan sólo los nombres
  (Il2CppDumper) y la lógica hay que reescribirla.
- **Versión de Unity.** Se compila para WebGL con la misma. ETC2/ASTC para WebGL
  recién está desde 2021.2; antes, en el teléfono las texturas DXT se descomprimen
  a RGBA y ocupan de 4 a 8 veces más.
- **El audio decodificado.** WebAudio decodifica los clips enteros a float32. Una
  hora de música estéreo son 1,2 GB. Lo que el APK reproduce en streaming hay que
  pasarlo a `<audio>`.
- **El tamaño de las escenas.** Unity WebGL carga el archivo de datos entero en
  memoria. Una escena gigante no entra en una pestaña de teléfono (~1–2 GB).

Ejemplo: [`porteos/slime-rancher/ANALISIS.md`](../../porteos/slime-rancher/ANALISIS.md).
