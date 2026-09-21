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

## La pregunta que falta responder

`kaggle kernels logs` existe como comando aparte de `output`. **Falta saber si
devuelve el log de un kernel que todavía está corriendo.** De eso depende algo
grande:

- **Si habla en vivo**: un kernel puede levantar escritorio + VNC + túnel,
  imprimir la dirección, y esta sesión leerla mientras sigue abierto. Eso da
  **interfaz gráfica sin que el usuario toque nada**.
- **Si solo habla al terminar**: no hay forma de enterarse de esa dirección sin
  que una persona mire la pantalla, y Kaggle queda para trabajo por lotes.

`probar.py` está hecho para contestar exactamente eso: late cada 30 s durante 10
minutos. Si desde afuera se ven los `LATIDO` antes del `TERMINE`, habla en vivo.

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
