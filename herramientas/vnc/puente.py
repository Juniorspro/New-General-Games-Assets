# Puente: escucha VNC por TCP en esta maquina y lo reenvia a un WebSocket remoto.
#
# Por que hace falta: vncdotool habla VNC crudo por TCP. El Colab publica su VNC
# por WebSocket (websockify) detras de un tunel HTTPS. Este puente traduce los
# bytes en las dos direcciones, asi vncdotool cree que el servidor es local.
#
#   uso: puente.py wss://xxx.loca.lt/websockify [puerto_local]
import asyncio, sys, websockets

URL    = sys.argv[1]
PUERTO = int(sys.argv[2]) if len(sys.argv) > 2 else 5901

# LocalTunnel mete una pantalla intermedia antes de dejar pasar; esta cabecera
# la saltea. Con cloudflared no hace falta, y no molesta.
CABECERAS = {"bypass-tunnel-reminder": "true", "User-Agent": "vnc-bridge/1"}


async def atender(lector, escritor):
    print("[puente] vncdotool se conecto, abriendo el WebSocket...", flush=True)
    ws = None
    # websockify histericamente pide el subprotocolo "binary"; las versiones
    # nuevas no lo mandan. Se prueban los dos antes de darse por vencido.
    # LocalTunnel no libera la conexion anterior al instante: el segundo
    # intento falla con "did not receive a valid HTTP response" y al tercero
    # ya entra. Por eso reintenta en vez de darse por vencido.
    intentos = [(["binary"], 0), (["binary"], 3), (["binary"], 6), (None, 3)]
    for sub, demora in intentos:
        if demora:
            await asyncio.sleep(demora)
        try:
            ws = await websockets.connect(URL, additional_headers=CABECERAS,
                                          subprotocols=sub, max_size=None,
                                          ping_interval=None, open_timeout=30)
            print(f"[puente] WebSocket abierto (subprotocolo={sub})", flush=True)
            break
        except Exception as e:
            print(f"[puente] intento fallido (sub={sub}): {type(e).__name__}", flush=True)
    if ws is None:
        escritor.close()
        return

    async def tcp_a_ws():
        while True:
            d = await lector.read(65536)
            if not d:
                return
            await ws.send(d)

    async def ws_a_tcp():
        async for m in ws:
            if isinstance(m, str):
                m = m.encode()
            escritor.write(m)
            await escritor.drain()

    try:
        await asyncio.gather(tcp_a_ws(), ws_a_tcp())
    except Exception as e:
        print(f"[puente] se corto: {type(e).__name__}: {e}", flush=True)
    finally:
        await ws.close()
        escritor.close()


async def main():
    s = await asyncio.start_server(atender, "127.0.0.1", PUERTO)
    print(f"[puente] escuchando VNC en 127.0.0.1:{PUERTO} -> {URL}", flush=True)
    async with s:
        await s.serve_forever()

asyncio.run(main())
