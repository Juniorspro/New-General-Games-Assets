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
| `Web/` | El anfitrión del navegador (.NET WebAssembly con AOT). |

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
```

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
