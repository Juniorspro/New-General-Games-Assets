# Slime Rancher → navegador (WebGL)

La versión **fiel**: el mismo juego (su C#, su física, su mundo) recompilado con Unity para
WebGL, desde el APK del dueño. Análisis previo: [`ANALISIS.md`](ANALISIS.md).

**Estado:**
- **Hecho:** el proyecto de Unity sale del APK arreglado y verificado: compila sin errores
  como WebGL y como editor.
- **Falta:** compilarlo con Unity 2018.4.36f1, que pide una licencia activada. La Personal es
  gratis, pero se activa con la cuenta del dueño.

| archivo | qué es |
|---|---|
| `portear.sh` | del APK al proyecto arreglado y, si hay licencia, al juego compilado |
| `arreglar.py` | los arreglos al código decompilado, como recetas: buscan una firma y cambian lo mínimo (el código del juego no entra al repo) |
| `unity/` | lo nuestro que se copia al proyecto: `Assets/Porteo` (partidas, música, teclado y mouse), `Plugins/WebGL/Porteo.jslib`, la página con la intro de JXStudios (`WebGLTemplates/Porteo`), la compilación (`Editor/Porteo`) y `link.xml` |
| `../../herramientas/unity/ripear` | AssetRipper sin interfaz (exporta el proyecto con los shaders en YAML) |
| `../../herramientas/unity/verificar` | compila los scripts contra las DLL completas de Unity 2018.4.36f1, sin abrir Unity |

```bash
porteos/slime-rancher/portear.sh "Slime Rancher v1.2 - espacioapk.com.apk" entrega-slime
```

## Compilarlo

**En una PC, con Unity Hub:**

1. Instalar **Unity 2018.4.36f1** con el módulo **WebGL Build Support**. Es esa versión exacta:
   el proyecto y los shaders del APK son de ella. Si Unity Hub no la lista, se abre con
   `unityhub://2018.4.36f1/6cd387d23174`.
2. Abrir `entrega-slime/proyecto/ExportedProject`. La primera vez importa 1,5 GB y tarda.
3. Menú **Porteo → Compilar WebGL**. Queda en `Compilado/WebGL`.
4. Servir esa carpeta por http (por ejemplo `python -m http.server`) y abrirla en Chrome,
   Edge o Firefox. No anda con doble clic.

**En la nube (este entorno):** la licencia va como secreto del entorno, en la variable
`UNITY_LICENSE`, con el contenido del `Unity_lic.ulf` que deja Unity Hub al activar la
Personal (en Windows, `C:\ProgramData\Unity\Unity_lic.ulf`). Con eso `portear.sh` también
compila y deja el juego en `entrega-slime/web/`.

## Qué se cambió y por qué

1. **Errores del decompilador.** Contra las DLL completas de Unity quedaban 2 errores en
   1.430 archivos, más 7 operadores sin su par. El build de Android había recortado el código
   que no se usaba (*managed stripping*): sacó la mitad de algunos pares de operadores (C#
   exige los dos) y un constructor. También sobraba un `AssemblyInfo` duplicado. Compilar
   contra las DLL del APK da 22 errores falsos porque también vienen recortadas.
2. **Hilos.** WebGL no tiene. SECTR, el sistema de sectores y oclusión del mundo, hacía el
   culling en hilos; con 0 hilos lo hace en el principal (ese camino ya estaba). El reporte
   de errores encolaba un delegado vacío en el `ThreadPool`.
3. **Teclado y mouse.** El port de Android **cambió** la entrada de PC por los controles de
   pantalla (TouchControlsKit): moverse, mirar, aspirar, disparar, saltar, interactuar, el
   mapa y la pausa leían sólo eso. La entrada original (`SRInput`, con InControl) seguía con
   todas sus teclas. Ahora `TCKInput.GetAction`/`GetAxis` consultan las dos:

   | acción | teclas |
   |---|---|
   | moverse | WASD o flechas |
   | mirar | mouse |
   | disparar / aspirar | clic izquierdo / derecho |
   | saltar | espacio |
   | correr | Shift |
   | interactuar | E |
   | ráfaga | clic del medio o Q |
   | ranuras | rueda y 1–5 |
   | mapa | M |
   | gadgets | T |
   | linterna | F |
   | pausa | Esc |
   | mando | el de siempre |

   El cursor vuelve a trabarse con un clic, como en PC. Los controles de pantalla sólo
   aparecen en pantallas táctiles.
4. **Partidas.** Se escriben en un disco en memoria. `FileStorageProvider.Flush`, que el juego
   llama después de guardar o borrar, las pasa a IndexedDB. Además se guarda cada vez que se
   oculta la pestaña, porque el navegador no avisa al cerrar.
5. **Música.** WebGL decodifica cada clip entero (WebAudio, float32) y Unity no lo suelta: la
   música serían 3 GB. Cada 5 s se sueltan los clips de 45 s o más que no suena ninguna
   fuente; SECTR los vuelve a cargar antes de tocarlos.
6. **Créditos.** Venían en un AssetBundle de StreamingAssets que se abre como archivo; en
   WebGL eso es una URL. El prefab pasa a `Resources`.
7. **Android.** La captura del mouse del port llama a Java; en WebGL no se usa.
8. **El build** (`PorteoCompilar.WebGL`):
   - 2032 MB de memoria;
   - excepciones como en Mono: un null corta con un error en vez de leer basura;
   - gzip, y los datos quedan guardados en el navegador (la segunda vez no se bajan);
   - WebGL 2 con WebGL 1 de respaldo;
   - `link.xml` que conserva el código del juego, que usa reflexión.
9. **Shaders.** AssetRipper gratis no los decompila. En YAML conservan sus programas
   compilados: los 159 traen GLES2 y GLES3, que es lo que usa WebGL. Sólo usan
   `EXT_shader_texture_lod` y `EXT_draw_buffers`, que WebGL tiene.

## Lo que se sabe recién al compilar

- **Los shaders en YAML.** Si en el build se ven rosas, se exportan de nuevo con
  `Ripear … dummy`: son difusos simples, sin el brillo de los slimes.
- **La memoria.** Si el mundo entra en 2 GB.
- **La velocidad.** WebGL es de un solo hilo y el culling queda en el principal.
- **Los avisos de la consola.** Por ejemplo, el mensaje del día, que pide datos a un servidor
  de Monomi Park.

## ¿Y en el teléfono?

En un navegador de teléfono no entra (ver `ANALISIS.md`). El teléfono ya tiene el APK, que es
de 32 bits. Con este mismo proyecto y el módulo de Android se puede compilar uno de **64
bits**, que instale en los teléfonos nuevos.
