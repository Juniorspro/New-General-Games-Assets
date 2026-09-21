# Manejar por VNC una máquina que no recibe conexiones

Sirve para ver y manejar la interfaz gráfica de un Colab —o de cualquier
máquina— desde esta sesión, que **no puede recibir conexiones**. La vuelta es
que la otra punta abra un túnel HTTPS de salida y nosotros le peguemos a esa
dirección, que sí alcanzamos.

```
esta sesión  →  https://<túnel>  →  websockify  →  x11vnc  →  Xvfb  →  Blender
```

## Lo que se midió (21/9, contra un Colab con T4)

| cosa | estado |
|---|---|
| Chromium de este contenedor → hosts externos | **no llega** (ya estaba en `ARRANQUE.md`) |
| `curl` al túnel, con `bypass-tunnel-reminder` | **anda**, HTTP 200, devuelve la página de noVNC |
| `wss://` al túnel por el proxy del agente | **anda** |
| ver la pantalla, clic, tipear | **verificado**: 1600x900, Blender 4.3.2 manejado de verdad |
| **LocalTunnel: una segunda conexión** | **NO** — la primera entra, la segunda da `InvalidMessage: did not receive a valid HTTP response`, y los reintentos no la salvan |
| LocalTunnel a la media hora | se cayó solo: **HTTP 503** |

**Conclusión: LocalTunnel no sirve para esto.** Usar `cloudflared` (túnel rápido,
`trycloudflare.com`): está hecho para WebSockets, no tiene pantalla intermedia y
no tiene ese límite de una conexión.

## Las piezas

| archivo | qué hace |
|---|---|
| `puente.py` | escucha VNC por TCP local y lo reenvía al WebSocket remoto. Hace falta porque `vncdotool` habla TCP crudo y la otra punta publica WebSocket |
| `piloto.py` | mantiene **una** conexión abierta y ejecuta órdenes que aparecen en `cola/orden-NNN.json`. Reconectar es lo que falla, así que no se reconecta |
| `vnc.py` | una secuencia suelta, en una conexión. Simple, pero paga una conexión nueva por corrida |

```sh
python3 puente.py wss://xxx.trycloudflare.com/websockify 5901 &
python3 piloto.py <CLAVE> &
echo '[{"clic":[1105,34]},{"esperar":2},{"ver":"pantalla.png"}]' > cola/orden-001.json
```

## Trampas encontradas

1. **`pkill -f patrón` se suicida.** Si el comando que lo llama contiene el
   patrón en su propia línea de comandos —por ejemplo porque más arriba dice
   `$SP/puente.py`— pkill mata al bash que lo está corriendo: sale **144** y se
   lleva el resto de la línea. Ya estaba anotado en `ARRANQUE.md` que pkill sale
   144; lo que faltaba es el **por qué**. Se resuelve filtrando por proceso:
   `ps -eo pid=,comm=,args= | awk '$2 ~ /^python/ && /puente/ {print $1}'`.
2. **La clave de VNC se trunca en 8 caracteres.** El protocolo autentica con un
   DES de 8 bytes. Una clave de 20 te deja creyendo que tenés fuerza que no
   tenés. 8 al azar de un alfabeto de 57 son ~47 bits.
3. **`websockify` quiere el subprotocolo `binary`** en las versiones viejas y no
   lo manda en las nuevas: el puente prueba con y sin.
4. **Un click no alcanza si la ventana no tiene foco.** El primer click se lo
   come dándole foco; el segundo es el que actúa.
5. **El visor 3D del Colab va por software.** No hay driver de X para la placa,
   así que el viewport es llvmpipe. Los renders con F12 **sí** usan la T4 por
   OptiX; girar la escena, no.
