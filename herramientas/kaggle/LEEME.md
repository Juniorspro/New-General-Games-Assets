# Kaggle: una GPU gratis que se maneja por API

## Por qué Kaggle y no Colab

Colab gratis **no tiene API**: siempre hace falta un navegador de una persona
abriendo la pestaña y apretando play, y si esa pestaña se cierra el runtime se
desconecta. Kaggle **sí tiene API**, así que el trabajo se manda desde la sesión
y corre con todo lo del usuario apagado.

| | Colab gratis | Kaggle gratis |
|---|---|---|
| API para correr sin navegador | **no** | **sí** |
| tarjeta de crédito | no | **no** |
| GPU | T4 | T4 x2 / P100 |
| cuota | por sesión, se corta por inactividad | **30 h de GPU por semana** |
| clicks del usuario | uno por sesión | **cero** |

Medido: `https://www.kaggle.com/api/v1/...` contesta **HTTP 401** desde el
contenedor de la sesión. O sea que se llega; solo falta la llave.

## RESPONDIDO: `logs` no habla en vivo

Medido el 21/9 con `probar.py` (late cada 30 s durante 10 min):

| se pidió el log a las | el kernel ya había impreso | devolvió |
|---|---|---|
| 15:35:46 | `LATIDO 00`-`02` | **vacío** |
| 15:37:29 | `LATIDO 00`-`06` | **vacío** |
| 15:39:11 | `LATIDO 00`-`10` | **vacío** |
| 15:46:12, ya `COMPLETE` | todo | los 24 renglones |

**`kaggle kernels logs` solo devuelve el log cuando el kernel termina.**

Consecuencia: **no se puede tener una interfaz gráfica en Kaggle manejada desde
afuera.** Un kernel puede levantar escritorio + VNC + túnel, pero la dirección
del túnel es aleatoria y no hay forma de leerla mientras el kernel vive; cuando
el log la entrega, el kernel ya murió y el túnel con él. Para interfaz en vivo
hay que seguir usando Colab, que necesita un navegador abierto.

Kaggle queda entonces para lo que sí hace bien: **trabajo por lotes, sin clicks**.

## La casilla que hay que marcar en la cuenta

En la primera corrida real, con `enable_gpu` y `enable_internet` pedidos, el log
dijo:

```
PLACA: NINGUNA (no hay nvidia-smi: el kernel corrio sin GPU)
INTERNET: NO (URLError)
```

**Kaggle ignora los dos en silencio si la cuenta no tiene el teléfono
verificado** (kaggle.com/settings → Phone Verification). Sin internet el kernel
ni siquiera puede bajar Blender, así que hasta marcar eso no sirve para nada.

## Formato del token: cambió

Ya no son `username` + `key`. Ahora es un token único `KGAT_...` que va en
`KAGGLE_API_TOKEN`, o en `~/.kaggle/access_token`. El usuario sigue haciendo
falta para armar el `id` del kernel, y se averigua con `kaggle kernels list --mine`.

## Lo que sí quedó probado

Autenticación, empujar un kernel de tipo `script`, que corra 10 minutos enteros
y bajar el log al final: **todo anduvo**. La plomería está verificada.

## Uso

Las credenciales **van por entorno, nunca en un archivo del repo** — el repo es
público y un `git push` las publicaría.

```sh
export KAGGLE_USERNAME=...
export KAGGLE_KEY=...

python3 kg.py probar                                   # la prueba clave
python3 kg.py log claude-probar-logs                    # ¿hay LATIDOs ya?

python3 kg.py render arbol MUESTRAS=512 ANCHO=1920 ALTO=1440
python3 kg.py log   claude-render-arbol
python3 kg.py bajar claude-render-arbol ./salida
```

## Detalles que muerden

1. **Los kernels no reciben argumentos.** Por eso `kg.py` reescribe la línea
   `PARAMS = {...}   # kg.py` de `render.py` antes de empujarlo. Probado: el
   archivo sustituido sigue parseando.
2. **`enable_internet` no es opcional**: sin eso el kernel no baja Blender ni
   clona el repo. Y para habilitarlo, la cuenta necesita **teléfono verificado**.
3. **`kernel_type: script`** en vez de notebook: un `.py` suelto es mucho más
   simple de generar que un `.ipynb`, y ya nos costó una vez mandar un notebook
   con las celdas mal armadas.
4. **Lo que quede en `/kaggle/working`** es lo que después se puede bajar con
   `kernels output`. Fuera de ahí se pierde.
5. Blender se baja **el oficial de blender.org**, no el de la distro: ese trae
   OpenImageDenoise y numpy, que es justo lo que le faltaba al del contenedor.

---

# La primera corrida real: anduvo

21/9, `kg.py render arbol MUESTRAS=512 ANCHO=1920 ALTO=1440`, mandado desde la
sesión sin que el usuario toque nada. Log del kernel:

```
[stdout   0.81] == placa ==
[stdout   0.85] Tesla T4
[stdout   0.85] Tesla T4
[stdout   0.99] INTERNET: si (HTTP 200)
[stdout  34.52] Blender 4.3.2
[stdout  44.76] == render: arbol ==
[stdout  53.43] Saved: '/kaggle/working/arbol.png'
[stdout  53.43] PLACA: GPU/OPTIX (Tesla T4, Tesla T4)
[stdout  53.43] TARDO 8.7 s   codigo=0
[stdout  53.43]        3252175  arbol.png
```

**Kaggle da dos T4, no una**, y `elegir_placa` prende las dos solo (pone
`use = True` en todos los aparatos del tipo elegido).

| | muestras/s | el mismo render |
|---|---|---|
| CPU, 4 núcleos | 3,56 M | — |
| Colab, 1x T4 | 108,89 M | **13,0 s** |
| **Kaggle, 2x T4** | **162,71 M** | **8,7 s** |

**x1,49 contra Colab. x45,8 contra la CPU.** La segunda placa no duplica porque
el armado del BVH y la carga de la escena no se reparten.

El kernel entero, de arranque a terminado —incluido bajar los 352 MB de Blender
y clonar el repo— tardó **58 s**. Los archivos salen con
`kg.py bajar claude-render-arbol <carpeta>`.

## Los tiempos de cada tramo, para saber dónde se va el rato

| tramo | cuándo |
|---|---|
| placa e internet comprobados | 0,99 s |
| Blender bajado y descomprimido | 34,5 s |
| repo clonado | 44,8 s |
| render terminado | 53,4 s |

O sea que **el render es lo más rápido de todo**: el 84% del tiempo es preparar
la máquina. Para varios renders seguidos conviene **un solo kernel que haga
todos**, no uno por render.
