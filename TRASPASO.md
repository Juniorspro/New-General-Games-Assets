# TRASPASO — estado completo del proyecto

> Memoria para retomar sin repetir vueltas. Todo lo que dice "andando" está
> medido, no estimado. Rioplatense, como venimos hablando.
> Los dos documentos viejos siguen valiendo: `ARRANQUE.md` (cómo se trabaja) y
> `ESTADO.md` (los dos sitios de Cloudflare). Esto agrega lo nuevo: la GPU de
> Kaggle, el Blender por script, la app PeakCode y el método de edición.

---

## 0. Lo más urgente que sigue trabado

- **Rezona: 447.884 créditos parados.** El conector MCP apunta a otra cuenta
  (ve 0). Para usarlos hace falta crear la API key en https://rezona.ai/api-keys
  y pegarla. Con eso se generan imágenes/3D **y** la app PeakCode podría hablarle
  a los modelos de frontera pagándolos con esos créditos (ver §5).
- **Cloudflare: falta `CLOUDFLARE_ACCOUNT_ID`** y el token no está en la máquina
  (`/root/.cloudflare-iblo` no existe acá). Sin eso no se despliegan los sitios.
- **PeakCode 0.8 tiene un bug de arranque** encontrado con Chromium:
  `Cannot set properties of null (setting 'onclick')` — un `$('#id')` apunta a
  algo que no existe y corta el JS, así que los botones no responden. Pendiente
  de arreglar (§5).

---

## 1. La máquina y las tres "PC" que probamos

Contenedor efímero: 4 núcleos, ~15 GB RAM, **sin GPU**, se recicla por
inactividad. Solo sobrevive lo commiteado. Sale por HTTPS/443, no entra nada.
**27 GB de disco libres** (la nota vieja decía 2,4 GB — desactualizada).

Perseguimos "una PC mejor / interfaz en vivo + cero intervención" por varios
lados. Lo que quedó claro, con pruebas:

| camino | GPU | cero clicks | interfaz en vivo | veredicto |
|---|---|---|---|---|
| **Kaggle por API** | T4 x2 | **sí** | no | **el bueno para render** |
| Colab + buzón (Drive) | T4 | casi (1 play) | no | sirve, con un play |
| Colab + noVNC | T4 | no | sí | probado, pero necesita navegador abierto |
| neko en Docker (acá) | no | — | sí (para mí) | sin GPU; no recibe conexiones |
| Modal | sí | sí | — | **pide tarjeta**, descartado |

- **Docker arranca acá** con `dockerd --iptables=false --bridge=none` (la nota
  vieja lo daba por bloqueado: faltaban esas banderas).
- **neko**: `ghcr.io/m1k1o/neko/chromium`, `--network host`. Se maneja por su
  API REST (`/api/login` → `/api/room/screen/shot.jpg`). El `pkill` suelto, que
  sale con código 144 y corta la línea encadenada.
- **VNC hacia afuera**: en `herramientas/vnc/` quedó el puente TCP↔WebSocket +
  piloto. Con eso **entré y manejé Blender corriendo en un Colab** (1600x900,
  probado). LocalTunnel **no sirve**: da una sola conexión y se cae con 503; va
  cloudflared.

---

## 2. Kaggle: la GPU gratis que se maneja por API (`herramientas/kaggle/`)

**Lo que resolvió todo:** Colab gratis no tiene API, siempre necesita un
navegador de una persona. **Kaggle sí tiene API**, no pide tarjeta, y da **30 h
de GPU por semana** que se reinician los sábados. El trabajo se manda desde la
sesión y corre con todo lo del usuario apagado.

- `kg.py` — manda el kernel, pregunta estado, baja lo que dejó.
- `render.py` — corre los guiones de Blender del repo en la GPU.
- `probar.py` — sirvió para medir que `kernels logs` **no habla en vivo** (solo
  al terminar), por eso no se puede tener interfaz gráfica manejada desde afuera
  en Kaggle.
- **Credenciales por entorno, nunca en el repo** (`KAGGLE_API_TOKEN`,
  `KAGGLE_USERNAME`). El token de hoy hay que **rotarlo**: quedó en el chat.
- **Necesita teléfono verificado** en la cuenta, si no ignora `enable_gpu` y
  `enable_internet` en silencio.

**Medido (21/9):** el árbol a 1920x1440 y 512 muestras → **8,7 s en dos T4**
(x1,49 contra una T4 de Colab, x45,8 contra la CPU). El kernel entero tardó 58 s
porque el 84% es preparar la máquina; por eso conviene un kernel que haga varios
renders, o `preparar.py` que deja Blender listo para reusar entre kernels.

---

## 3. Colab: el buzón del Drive (`herramientas/colab/`)

El Colab monta el Drive, y la sesión lee/escribe el mismo Drive → se encuentran
ahí, sin túneles.

- `obrero.py` / `obrero2.py` — miran `Colab Notebooks/buzon`, atienden
  `pedido-NNN.json`, dejan `salida-NNN.txt` y los PNG. **Lista cerrada de verbos**
  a propósito (placa, listar, render, y en el v2: escritorio, abrir, captura,
  descargar, descomprimir, instalar-rar): esa máquina tiene el Drive del usuario
  montado entero, así que no ejecuta nada arbitrario.
- Notebooks: `ARRANCAR v2 — obrero completo` es la de un botón. La bajada de
  Blender la hace Google, **no gasta datos del teléfono** (medido: 352 MB de
  Blender + 236 MB del repo, todo del lado de Google).

---

## 4. Blender por script (`herramientas/blender/`)

Todo se arma con datos de malla y semilla fija: sale igual cada vez y se
versiona. **Animar sin interfaz es lo normal**, no una limitación.

| escena | caras | render CPU |
|---|---|---|
| `casita.py` | 332 | 1 min 39 s (160 muestras, 1100x750) |
| `pelota.py` | pelota+conos | 6,5 s/cuadro; 60 cuadros ~6,5 min; arma el MP4 con el secuenciador (no hay ffmpeg) |
| `arbol.py` | 628 | 27 s (128 muestras, 1000x750) |

Trampas anotadas en su `LEEME.md`: sin OpenImageDenoise en el Blender de Debian
(se compensa con muestras; el oficial sí lo trae); `numpy` aparte para exportar
glTF; el encuadre se mide, no se calcula; las ramas cortas del árbol quedaban
"brócoli con palito". El aparato sale de `DISPOSITIVO=GPU` (por defecto CPU, para
no mover los tiempos medidos); `elegir_placa` prende OptiX/CUDA a mano porque
`cycles.device="GPU"` solo se cae a CPU en silencio.

---

## 5. PeakCode — la app Android (`peakcode/`)

App de chat con IA que **anda al abrirla, sin instalar ni configurar nada**.

### Arquitectura
- APK que se **compila acá** (JDK 21 + Gradle 8.14.3 + SDK de Android de 458 MB;
  la nota vieja decía que no se podía — desactualizada). `ai.peakcode`, minSdk 24.
- La interfaz es una página web adentro del APK (WebView), reusando lo que el
  repo ya sabe de webs.
- **La red pasa por un puente nativo en Java** (`Puente.stream`), no por el
  `fetch()` del navegador: así no hay CORS y se le puede pegar a cualquier
  endpoint gratis. Lee el SSE del lado nativo y empuja los trozos al JS.

### Los dos motores
| motor | setup | qué da |
|---|---|---|
| **Gratis** (por defecto) | ninguno | Pollinations (`POST text.pollinations.ai/openai`, GPT-OSS 20B, sin key). Probado: contesta y hace streaming. Tiene límites |
| **OmniRoute** (avanzado) | un servidor + contraseña | 352 proveedores, 90+ capas gratis, 492 modelos con alias `auto/…` |

### OmniRoute, lo que se midió
Corrido acá (npm, MIT, v3.8.50, pide Node ≥22.22.2 que la sesión tiene justo).
Panel en `:20128`, API compatible con OpenAI en `/v1`. Emite sus propias keys.
Cadena probada de punta a punta: `POST /api/auth/login` (contraseña) → cookie →
`POST /api/keys` → `sk-…` → `GET /v1/models` → 492 modelos. **Ojo: la ruta de
crear es `/api/keys`, no `/api/api-keys`.** Arranca abierto: en un servidor va
`REQUIRE_API_KEY=true` (probado: sin key da 401).

Servidor listo en `peakcode/servidor/`: Dockerfile sobre la imagen oficial
`diegosouzapw/omniroute:latest`, con README para un Space de Hugging Face
(gratis, sin tarjeta). Limitaciones dichas: el free tier no persiste el storage
entre rebuilds, los Spaces se duermen, y un solo motor es una bolsa de límites
compartida.

### Lo que la app sabe hacer (versiones 0.1 → 0.8)
- chat con streaming, historial en el teléfono
- selector de modelos estilo hoja inferior (como Rezona)
- adjuntar un archivo y leerlo (techo 200k caracteres)
- **generar y bajar TXT, MD, HTML, CSV, PDF y Word (.docx)** — PDF y docx
  generados en JS puro, offline; probados en Node (PDF válido, pagina 300 líneas
  en 7 hojas; docx abre como zip con su XML)
- **artifacts**: los bloques de código salen en un cuadrito con **vista previa
  en vivo** (iframe con sandbox, sin llegar al puente) y **descarga arriba**
  según el tipo
- un solo permiso: `INTERNET`

### La verdad para el negocio
Los modelos de frontera (Opus, GPT-6, Grok) **no son gratis**: Rezona los paga
con créditos (por eso el contador de la esquina). La jugada fuerte: conectar
PeakCode a **Rezona** con la API key y usar los **447.884 créditos parados** →
la app tendría esos modelos de verdad, pagados con algo que ya es tuyo. Falta
la key de Rezona para probar si su API es compatible.

### Pendiente inmediato
El bug de §0 (botones que no responden por un `$('#id')` nulo que corta el
arranque). Se caza abriendo `peakcode/app/src/main/assets/index.html` en
Chromium y mirando el `pageerror`.

---

## 6. Edición de video TikTok (método, del traspaso viejo)

Fan/character edits son género normal de TikTok; se hacen. El pipeline: material
**crudo** (no re-subir edits ajenos, que Content-ID baja la cuenta) + música de
la biblioteca de TikTok. Herramientas que ya existían: `calidad.mjs` (descarga
bitrate real sin marca de agua), análisis de audio con numpy (RMS→onsets→grilla
de beats), 555 filtros ffmpeg, `xfade` con 58 transiciones, LUT propio + denoise
(dio +39,9% de nitidez, clipping 16%→0,01%). Referencia medida: Patrick Jane
1,22 cortes/s, saturación 0,19, mediana luma 0,125.

---

## 7. Seguridad (reglas vigentes)

- El repo es **público**: NUNCA escribir tokens en archivos del repo. Van por
  entorno o por secrets del host.
- Rotar lo que pasó por el chat: token de Kaggle, token de Cloudflare viejo, y
  la key de Rezona si se pega.
- Antes de `DELETE`/`UPDATE` sin WHERE en `--remote`: correr el SELECT primero.

## 8. No hacer (ya decidido)

- No perseguir más "PCs" ni interfaz-en-vivo-sin-intervención: se probaron seis
  caminos, ninguno da las dos cosas gratis (tabla §1).
- No montar runners de Actions como PC remota (TOS + riesgo + sin GPU).
- No usar Colab/Kaggle de mula de descargas: sus términos lo prohíben.
