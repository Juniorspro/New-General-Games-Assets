# Motor: el juego de Unity original corriendo en el navegador

El IL del juego (Assembly-CSharp y compañía, tal cual vienen en el APK) corre sobre .NET para
WebAssembly. En vez del UnityEngine de Unity tiene este motor: la misma API, escrita de nuevo
en C#, con el render, el audio y la entrada del lado del navegador.

Nada de esto trae datos ni código del juego: las herramientas los leen del APK de quien las
corre y lo que producen queda fuera del repo.

## Las piezas

| carpeta | qué hace |
|---|---|
| `exportar/` | Los archivos serializados de Unity (escenas, prefabs, assets) → `.paq` (árbol compacto por objeto) y `recursos/` (texturas, mallas, audio, shaders). Ver `exportar/arbol.py`. |
| `generar/` | Lee qué API de Unity usa el juego y escribe `UnityEngine/Generado/`: el esqueleto de todo lo que falta hacer (cada miembro avisa una vez si se usa). Se saltea lo que ya está escrito a mano en `UnityEngine/Motor/`. También arma `Fachadas/`. |
| `UnityEngine/` | El motor: un solo ensamblado `UnityEngine.CoreModule`. `Motor/` es lo escrito a mano; `Generado/`, lo que todavía es esqueleto. |
| `Fachadas/` | Los demás módulos de Unity (`UnityEngine.PhysicsModule`...) reenvían sus tipos al motor, para que el IL del juego enlace sin tocarlo. |
| `reparar/` | Prepara el IL del juego para el .NET de hoy (los métodos de interfaz que el recorte de Unity sacó) y verifica que todas sus referencias a .NET existan. |
| `enlazar/` | Verifica que cada tipo y miembro de Unity que nombra el juego exista en el motor. |
| `Prueba/` | El motor en consola, con el .NET de escritorio: carga las escenas desde los datos exportados y corre cuadros. Para depurar rápido. |
| `Web/` | El anfitrión del navegador (.NET WebAssembly con AOT). Los datos le llegan por una "fuente" (`wwwroot/datos.js`: por la red, desde la carpeta `datos/`). |
| `empaquetar/` | El HTML único: el código y todos los datos adentro de un solo `.html`, con LZMA y sin pérdida (ver `empaquetar.py`). `lzma.c` es el decodificador (WebAssembly de 6 KB, sin importaciones) y `arranque.js` lo que corre en la página. |

## Cómo se arma

```sh
# 1. datos del juego (fuera del repo); el audio (Vorbis dentro de FSB5) pasa a Ogg sin recodificar
python3 -I exportar/exportar.py APK_DATA SALIDA_DATOS --arreglar-swizzles
dotnet run -c Release --project exportar/fsb-ogg -- SALIDA_DATOS/recursos
# 2. esqueleto de la API (después de escribir algo a mano, volver a correrlo)
dotnet run -c Release --project generar -- --juego MANAGED --unity UNITY_MANAGED \
    --propios UnityEngine --salida UnityEngine/Generado --fachadas Fachadas
# 3. IL del juego reparado
dotnet run -c Release --project reparar -- MANAGED Prueba/bin/Release/net10.0 JUEGO_REPARADO
# 4. prueba en consola
dotnet build -c Release Prueba -p:JUEGO=JUEGO_REPARADO
dotnet Prueba/bin/Release/net10.0/PruebaMotor.dll SALIDA_DATOS 0 400
# 5. la versión web (AOT; con -p:RunAOTCompilation=false compila en un minuto pero corre ~4 veces
#    más lento) y el HTML único
dotnet publish -c Release Web -p:JUEGO=JUEGO_REPARADO -p:FISICA=libporteo_fisica.a
empaquetar/compilar-lzma.sh        # sólo si cambió lzma.c (lzma.wasm ya viene)
python3 -I empaquetar/empaquetar.py Web/bin/Release/net10.0/publish/wwwroot SALIDA_DATOS juego.html \
    [--orden orden.json] [--carga carga.json --imagen-carga personaje.webp]
# la versión para subir a un sitio propio (carpeta con index.html, b/, sw.js, manifest y abrir.html)
python3 -I empaquetar/empaquetar.py ... CARPETA --sitio --bloque 8 [--icono icono.png] [--carga ...]
```

- `--carga`: al abrir, la intro de la marca (`herramientas/porteo/intro.js`) y después la pantalla
  de carga (`herramientas/porteo/carga.js`: el personaje girando, la barra, consejos y "Saltar" para
  empezar ya con lo que haya). El JSON tiene el título, el aviso de la intro, los consejos por
  idioma y `mbMenu` (lo que hay que bajar hasta el menú, medido: la barra sigue a los MB y abajo se
  ve cuánto va y a qué velocidad; ver `porteos/slime-rancher/carga.json`); `pantalla.js` la une al
  motor. `--fondo-carga captura.png`: la portada, difuminada, de fondo detrás del personaje.
  Siempre horizontal y en 16:9 (`herramientas/porteo/escenario.js`): con el teléfono en vertical,
  todo gira 90°; en Android el primer toque pide pantalla completa y traba la orientación.
  `--registro __registro`: la página cuenta lo que pasa y los errores (`herramientas/porteo/registro.js`;
  con la puerta de Cloudflare se lee con `cloudflare/registro.py`); si algo grave falla, lo dice en
  pantalla con un botón para recargar en vez de quedar en negro.
- `--sitio`: cada bloque es un archivo `b/<hash>.bin` que se baja cuando hace falta (lo que el motor
  espera primero, lo demás de a poco), queda en Cache Storage y el service worker guarda la página:
  la segunda vez arranca enseguida y sin red, y se instala como app. Anda en cualquier hosting
  estático (todo viene comprimido con LZMA, no depende de cómo comprime el servidor); `_headers`
  le dice a Netlify o Cloudflare Pages que guarden los bloques para siempre. `abrir.html` es el
  lanzador: pide la dirección una vez y después abre directo. Para que quede privada (es lo que
  corresponde con un juego que no es nuestro): `herramientas/porteo/cloudflare/subir.py` la sube a
  Cloudflare Pages con una puerta con clave delante de todo.

Cuando los datos llegan de a poco por la red (el sitio, o `datos/` al lado de la página), el motor
no espera todo lo que una escena alcanza (`Alcance.Diferible`, `Programa.Diferir`): el sonido
suena cuando llega, y hasta el menú tampoco espera las texturas (se dibujan con la de por defecto
hasta que llegan; la pantalla de carga se queda hasta que llegó lo que el menú muestra). En Slime
Rancher el menú alcanza 523 MB sin comprimir (el director de objetos apunta a todos los prefabs) y
de eso hacen falta antes 32 MB. Lo de fondo se baja en orden de uso con el audio al final, y sólo
cuando no hay nada urgente en camino. Las texturas se leen sin trabar el cuadro
(`Anfitrion.RecursoSinTrabar`: si su bloque no está descomprimido, lo descomprime un trabajador).
Medido con 20 Mbps y 60 ms (Chromium sin GPU): el menú pasó de 73 s a 31 s; sin límite de red, de
16 s a 10 s. Además (`main.js`):

- la primera escena (el logo de la empresa, con tiempos fijos) corre sin dibujar, un segundo de
  juego por cuadro, mientras la pantalla de carga la tapa (`Programa.Acelerar`; `?sinacelerar`);
- .NET arranca mientras llegan los `.paq`;
- el sistema de velocidad: si el teléfono no da 24 cuadros por segundo, la resolución baja de a
  pasos hasta la mitad, y vuelve a subir si sobra; si bajar no ayudó (manda la CPU), vuelve a como
  estaba y no insiste por un minuto (`?turbo=0` lo apaga, `?escala=X` la deja fija).

El orden (`--orden`) es la lista de recursos en el orden en que el motor los usó la primera vez:
`globalThis.porteoOrden` en la consola del navegador, después de jugar un rato con la versión que
lee de `datos/`. Con él, lo primero que se usa va primero en el archivo y el juego arranca
mientras el navegador sigue leyendo el resto.

## El HTML único

Todo va adentro y comprimido sin pérdida: los gráficos, el audio y el código son los mismos bytes
que salen de `exportar/`. Medido sobre Slime Rancher (913 MB exportados):

| qué | sin comprimir | con LZMA a medida | cómo |
|---|---|---|---|
| texturas ETC2 (bloques de 16 bytes) | 340 MB | ~11% | lp=pb=4 |
| texturas ETC1 (bloques de 8 bytes) | 117 MB | ~21% | lp=pb=3 |
| vértices | 178 MB | ~25% | por canal (todas las posiciones, todas las normales...); los proxies de región, como diferencia con su predicción (abajo) |
| índices | 18 MB | ~2% | cada uno como diferencia con el anterior |
| audio Ogg | 68 MB | ~97% | ya viene comprimido |
| paquetes y shaders | 136 MB | ~10% | |

Los proxies de región (lo que se ve de una zona lejana: 150 de los 178 MB de vértices) son las
mallas de la raíz de cada región, transformadas y juntadas por material. `proxies.py` encuentra de
qué malla y con qué matriz sale cada tramo (el 46% de los vértices; el resto sale de mallas que
Unity comprimió, que ya no son las originales) y guarda la diferencia con la predicción, casi
siempre 0 o ±1 en los bits de cada float. `arranque.js` la deshace con las mismas cuentas en el
mismo orden: sale igual bit a bit (probado con los 111 proxies). Ahorra 9 MB.

Comparado con gzip, zstd -22 --long y brotli 11, LZMA gana en todas las clases. Los bloques son
de 32 MB: más grandes comprimen un poco más (64 MB: −2,6%) pero cada uno se descomprime entero
cuando se necesita algo de adentro.

En la página (`arranque.js`), mientras el navegador lee el archivo, unos trabajadores pasan cada
bloque a bytes (sigue comprimido en memoria) y lo descomprimen cuando el motor avisa que va a
usar algo de él; si lo necesita en ese mismo cuadro, se descomprime en el hilo principal. Lo
descomprimido se guarda hasta un tope (256 MB, 128 en teléfonos de poca memoria) y lo más viejo se
suelta.

## Cómo se comporta (lo que imita de Unity)

- **Ciclo de vida** (`Motor/Mundo/Activacion.cs`): Awake al activarse por primera vez (aunque
  el script esté deshabilitado), OnEnable/OnDisable, Start antes del primer Update. Al activar un
  grupo (escena, SetActive, Instantiate) van primero los nativos y después los scripts según el
  orden de ejecución de su MonoScript.
- **Cuadro** (`Motor/Mundo/Mundo.cs`): el orden del PlayerLoop de Unity 2018.4, con el paso fijo
  de física del proyecto y los Destroy diferidos antes de dibujar.
- **Corrutinas** (`Motor/Mundo/Corrutinas.cs`): null, WaitForSeconds, WaitForFixedUpdate,
  WaitForEndOfFrame, corrutinas anidadas, CustomYieldInstruction y AsyncOperation.
- **Datos** (`Motor/Datos/`): los objetos de un archivo se crean cuando alguien los pide; los
  campos de los scripts se leen con las reglas de serialización de Unity (`Serial.cs`), que
  también usa Instantiate para copiar.
