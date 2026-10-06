# TJOC: Story Mode → APK (06/10)

Tercer port pedido por link (gamejolt.com/games/tjocsm/139218), el primero de **Unreal Engine 4.16** (los
otros, [bus-stop](bus-stop.md) y [pizza-delivery](pizza-delivery.md), eran Unity). Juego de Nikson; FNaF es
de Scott Cawthon (créditos en el aviso legal). Se entrega **por capítulos**: el 1 (aviso, menú, prólogo,
narración, controles, dormitorio y consejos de muerte) salió en una APK de 18 MB. En `ports/tjoc-sm/` va solo
el código; el trabajo vivo está en el scratchpad (`tjoc/`), que se pierde con el contenedor.

## La idea: no rearmar, ejecutar

El Blueprint del juego corre tal cual en una VM de Kismet en JS (`web/js/vm.js`) y lo nativo de UE se escribe
a mano en `web/js/nat/*`, función por función, guiado por `M.vm.faltan` (lo que el juego llamó y no existe).
Con eso salieron solos el menú 3D, las cinemáticas, la IA de los animatrónicos y la muerte → consejos.

## Lo que costó (y cómo quedó)

- **CUE4Parse** (no umodel: es de 32 bits). Versión por tipo: JSON de mapas/BP con 4.17, mallas 4.17 (4.18 si
  falla, con 4.16 `RenderData` sale nulo), animaciones 4.16. Requiere .NET 10. La ruta del pak tiene espacios:
  enlace `paks`.
- **Propiedades por diferencia**: instancia → cadena de `Template` → valores nativos (tabla NATIVOS en
  `ue4.py`). Lo que falta en el JSON no es "nulo", es el defecto.
- **VM**: `EX_Context` usa el objeto del contexto para la llamada pero los argumentos salen del marco original;
  las latentes se identifican por `CallbackTarget.id:UUID` (Delay ignora repetidas, RetriggerableDelay
  reinicia); structs y arrays se copian por valor.
- **Colisión por tipo de objeto** (06/10): el dormitorio sabe a dónde mirás con una traza contra cubos ocultos
  de tipo `ECC_Vehicle`. `nivel.py` ahora exporta `col {tipo, perfil, habil}` de todo `BodyInstance`; sin eso
  "Pararse" no hacía nada. ObjectTypeQuery N → canal: `[0,1,2,5,6,7]`.
- **Exposición**: UE 4.16 expone para el 80–98,3 % más claro del histograma, no el promedio. Con el promedio
  todo salía lavado (narración, dormitorio).
- **Imágenes con texto en inglés** (consejos y controles, 1920×1080): `traduccion/tips.py` borra el texto
  (relleno por difusión con scipy) y lo reescribe con **Oswald 500, +4 px de espaciado, angostada a 0,543**,
  que queda casi igual a la letra original. La letra del juego (Sufficit) **no tiene tildes**. Se anotan en
  `ui.json` como `l: {es, pt, en}` y `UMG.url()` elige por `umg.idioma`. **Correr después de `paquete.py`**
  (que reescribe `ui.json`). La de controles también va en inglés: dice los botones táctiles.
- **Botones táctiles**: los de las teclas que escuchan los receptores, menos las de prueba del autor
  (`SOLO` por nivel en `controles.js`; dormitorio: Pausa, Usar, Pararse). Nombres por nivel en `textos.js`.
- **Pruebas**: SwiftShader corre a ~0,4×; `__tjoc.J.acelerar = 7` hace 8 ticks por cuadro (una noche en 75 s).
  `correr.mjs` con `I=es` pone el idioma de las imágenes.

## Falta (capítulos siguientes)

LivingRoom, Office, Basement, Attic, sus cinemáticas, diarios, final y extras. SM_Outside pesa (SM_house2,
193k triángulos que no se simplifican: vértices sin compartir); por ahora se reemplaza por SMMenu. AnimBP de
Freddy/Chica/Foxy, partículas (no se dibujan). El juego entero no entra en 30 MiB: APK por capítulo.
