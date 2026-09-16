# El MCP de Mint (mint.gg)

Genera modelos 3D, mundos, packs de assets, materiales, imágenes, audio y
video, y los devuelve al agente que lo llama.

## No hay nada que bajar

Esto es lo primero que hay que entender, porque cambia todo el procedimiento:
**el MCP de Mint no es un paquete**. No hay `npx`, no hay binario, no hay
repositorio para clonar. Es un servidor remoto:

    https://mcp.mint.gg/mcp        Streamable HTTP, con OAuth obligatorio

Sin bearer contesta `401 missing_bearer` a todo, incluso a `initialize`. Así
que "instalarlo" es registrar un cliente y autorizarlo. El servidor soporta
**registro dinámico** (RFC 7591), que es lo que evita tener que pedirle a nadie
un client id a mano:

    POST https://mcp.mint.gg/oauth/register

y de ahí sale un `client_id` público (sin secreto, `token_endpoint_auth_method:
none`), con PKCE S256 obligatorio. Los alcances son cuatro:

| alcance | para qué |
| --- | --- |
| `mint:read` | identidad, créditos, proyectos, assets, estados |
| `mint:projects:write` | crear, renombrar, archivar proyectos |
| `mint:generate:start` | arrancar generaciones y revisiones |
| `mint:generate:approve` | aprobar previews y bajar los archivos |

## Las dos formas de usarlo

**1. Declarado, que es la buena.** El `.mcp.json` de la raíz ya lo trae:

```json
{ "mcpServers": { "mint": { "type": "http", "url": "https://mcp.mint.gg/mcp" } } }
```

Claude Code lo ve al arrancar, y con `/mcp` se hace el OAuth solo, en el
navegador de tu máquina. Es lo que conviene si trabajás local.

**2. A mano, con `mint.py`.** Porque los servidores MCP se cargan al arrancar
la sesión: si se declaran después, esa sesión no los ve. Y porque en una sesión
remota el navegador donde autorizás **no puede llegar al `localhost` del
contenedor**, así que el callback no vuelve solo y el código lo traés vos.

```sh
python3 herramientas/mint/mint.py entrar        # registra y escupe la URL
# abrís la URL, autorizás, caés en una página que no carga (es normal)
python3 herramientas/mint/mint.py canjear 'http://127.0.0.1:7391/callback?code=...'
python3 herramientas/mint/mint.py tools
python3 herramientas/mint/mint.py call generate_image '{"prompt":"..."}'
python3 herramientas/mint/mint.py estado
```

`mint.py` maneja el PKCE, el `state`, el refresco del token y la sesión
(`Mcp-Session-Id`), y sabe leer las respuestas tanto en JSON como en SSE: las
herramientas lentas contestan por flujo y quedarse con el primer `data:` es
perder el resultado.

## Dónde vive el token

En `~/.mint/credenciales.json`, con permisos 600, **fuera del repositorio**.
Igual que la credencial de Rezona. Nada de esto se commitea.

## Cómo trabaja Mint

La generación va en modo automático por defecto; se le puede pedir modo
revisión para aprobar o corregir un Preview antes de que quede firme. El video
es la excepción: arranca directo, sin preview. Después se consulta con
`get_asset` o `wait_for_status` y se bajan los archivos por el manifiesto de
artefactos.
