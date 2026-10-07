#!/usr/bin/env python3
"""Arregla el proyecto de Unity que exporta AssetRipper del APK de Slime Rancher para que
compile y ande en WebGL.

    python3 -I arreglar.py PROYECTO      (la carpeta ExportedProject)

Va como recetas y no como parche porque el código decompilado es de Monomi Park y no entra
al repo (§11 de PORTEO.md): cada arreglo busca una firma o un nombre y agrega o cambia lo
mínimo. Es idempotente: correrlo dos veces no cambia nada la segunda.
"""
import re
import shutil
import sys
from pathlib import Path

P = Path(sys.argv[1]).resolve()
S = P / "Assets" / "Scripts"
hechos = []


def leer(rel):
    return (S / rel).read_text("utf-8-sig")


def escribir(rel, texto, que):
    f = S / rel
    if f.read_text("utf-8-sig") != texto:
        f.write_text(texto, "utf-8")
        hechos.append(f"{rel}: {que}")


def agregar_antes(rel, ancla, codigo, que):
    """Agrega `codigo` antes de la línea que contiene `ancla`, con su sangría (si no estaba)."""
    t = leer(rel)
    firma = next(l.strip() for l in codigo.strip().splitlines() if not l.strip().startswith("//"))
    if firma in t:
        return
    i = t.index(ancla)
    ini = t.rfind("\n", 0, i) + 1
    sangria = re.match(r"[ \t]*", t[ini:]).group()
    bloque = "".join(sangria + l + "\n" if l else "\n" for l in codigo.strip("\n").splitlines()) + "\n"
    escribir(rel, t[:ini] + bloque + t[ini:], que)


def reemplazar(rel, viejo, nuevo, que):
    """Cambia `viejo` por `nuevo` (una sola vez; si ya está `nuevo`, no hace nada)."""
    t = leer(rel)
    if nuevo in t:
        return
    if t.count(viejo) != 1:
        raise SystemExit(f"{rel}: se esperaba una vez «{viejo[:60]}» y está {t.count(viejo)} (¿otra versión del juego?)")
    escribir(rel, t.replace(viejo, nuevo), que)


# ── 1. Operadores sin su par ────────────────────────────────────────────────────────────
# El recorte de código del build (managed stripping) sacó la mitad que el juego no usaba, y
# C# exige que vayan de a pares. Se agrega la otra mitad como la negación de la que quedó.
PARES = [
    ("Assembly-CSharp/InControl/InputControlState.cs", "public static bool operator !=(InputControlState a, InputControlState b)",
     "public static bool operator ==(InputControlState a, InputControlState b)\n{\n\treturn !(a != b);\n}"),
    ("Assembly-CSharp/InControl/KeyCombo.cs", "public static bool operator ==(KeyCombo a, KeyCombo b)",
     "public static bool operator !=(KeyCombo a, KeyCombo b)\n{\n\treturn !(a == b);\n}"),
    ("Assembly-CSharp/InControl/UnknownDeviceControl.cs", "public static bool operator ==(UnknownDeviceControl a, UnknownDeviceControl b)",
     "public static bool operator !=(UnknownDeviceControl a, UnknownDeviceControl b)\n{\n\treturn !(a == b);\n}"),
    ("Assembly-CSharp/InControl/VersionInfo.cs", "public static bool operator ==(VersionInfo a, VersionInfo b)",
     "public static bool operator !=(VersionInfo a, VersionInfo b)\n{\n\treturn !(a == b);\n}"),
    ("Assembly-CSharp/InControl/VersionInfo.cs", "public static bool operator <(VersionInfo a, VersionInfo b)",
     "public static bool operator >(VersionInfo a, VersionInfo b)\n{\n\treturn a.CompareTo(b) > 0;\n}"),
    ("Assembly-CSharp/SECTR_Member.cs", "public static bool operator ==(Child x, Child y)",
     "public static bool operator !=(Child x, Child y)\n{\n\treturn !(x == y);\n}"),
    ("Assembly-CSharp/ScorePlort.cs", "public static bool operator true(Deposit_Response response)",
     "public static bool operator false(Deposit_Response response)\n{\n\treturn response.deposits <= 0;\n}"),
]
for rel, ancla, codigo in PARES:
    agregar_antes(rel, ancla, "// porteo: el par que sacó el recorte del build\n" + codigo, "operador que faltaba")

# ── 2. Un solo AssemblyInfo ──────────────────────────────────────────────────────────────
# Sin .asmdef, Unity compila todo Assets/ en Assembly-CSharp: dos [assembly: AssemblyVersion]
# chocan. El de Assembly-UnityScript (un solo script, la cámara de los créditos) sobra.
f = S / "Assembly-UnityScript/Properties/AssemblyInfo.cs"
if f.exists():
    f.unlink()
    (f.parent / "AssemblyInfo.cs.meta").unlink(missing_ok=True)
    hechos.append("Assembly-UnityScript/Properties/AssemblyInfo.cs: borrado (duplicaba el de Assembly-CSharp)")

# ── 3. Lo que el recorte dejó a medias ────────────────────────────────────────────────────
# El cliente SOAP del reporte de errores (generado por wsdl) perdió su constructor: sin él, C#
# usa el de AsyncCompletedEventArgs, que está marcado obsoleto (error en Unity).
agregar_antes("Assembly-CSharp/mc_issue_addCompletedEventArgs.cs", "private object[] results;",
              "// porteo: el constructor que sacó el recorte del build\n"
              "internal mc_issue_addCompletedEventArgs(object[] results, System.Exception exception, bool cancelled, object userState)\n"
              "\t: base(exception, cancelled, userState)\n{\n\tthis.results = results;\n}",
              "constructor que faltaba")

# ── 4. Hilos: WebGL no tiene ──────────────────────────────────────────────────────────────
# SECTR (los sectores y la oclusión del mundo) reparte el culling en hilos. Con 0 hilos hace
# todo en el hilo principal: ese camino ya está en el código (count3 == 0).
reemplazar("Assembly-CSharp/SECTR_CullingCamera.cs",
           "int num = Mathf.Min(NumWorkerThreads, SystemInfo.processorCount);\n",
           "int num = Mathf.Min(NumWorkerThreads, SystemInfo.processorCount);\n"
           "#if UNITY_WEBGL && !UNITY_EDITOR\n"
           "\t\tnum = 0;  // porteo: WebGL no tiene hilos; el culling va en el hilo principal\n"
           "#endif\n",
           "sin hilos de culling en WebGL")
# Con las DLL completas de Unity, ThreadPriority es ambiguo (también hay UnityEngine.ThreadPriority).
reemplazar("Assembly-CSharp/SECTR_CullingCamera.cs", "thread.Priority = ThreadPriority.Highest;",
           "thread.Priority = System.Threading.ThreadPriority.Highest;", "ThreadPriority con su espacio de nombres")
# El reporte de errores encola un delegado vacío en el ThreadPool, que en WebGL no existe.
reemplazar("Assembly-CSharp/BugReport.cs", "\t\tThreadPool.QueueUserWorkItem(delegate\n\t\t{\n\t\t});\n",
           "#if !UNITY_WEBGL || UNITY_EDITOR\n\t\tThreadPool.QueueUserWorkItem(delegate\n\t\t{\n\t\t});\n#endif\n",
           "sin ThreadPool en WebGL")

# ── 5. WebGL: partidas, créditos, Android ─────────────────────────────────────────────────
# Las partidas: el juego llama a Flush después de guardar o borrar; en WebGL eso pasa el
# disco en memoria a IndexedDB (Assets/Porteo/Porteo.cs).
reemplazar("Assembly-CSharp/FileStorageProvider.cs", "\tpublic void Flush()\n\t{\n\t}\n",
           "\tpublic void Flush()\n\t{\n\t\tPorteo.GuardarDisco();  // porteo: en WebGL, a IndexedDB\n\t}\n",
           "Flush guarda en IndexedDB")
# Los créditos vienen en un AssetBundle de StreamingAssets que se abre como archivo: en WebGL
# StreamingAssets es una URL. El prefab (AssetRipper lo saca del bundle) va a Resources.
CREDITOS = P / "Assets/ui/textures/credits/credit_screen.prefab"
DESTINO = P / "Assets/Resources/porteo/credit_screen.prefab"
if CREDITOS.exists():
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    CREDITOS.rename(DESTINO)
    CREDITOS.with_suffix(".prefab.meta").rename(DESTINO.with_suffix(".prefab.meta"))
    hechos.append("credit_screen.prefab: a Resources/porteo (mismo GUID)")
reemplazar("Assembly-CSharp/CreditsUI.cs",
           "\tprivate GameObject CreateCreditsScrollPrefab()\n\t{\n",
           "\tprivate GameObject CreateCreditsScrollPrefab()\n\t{\n"
           "#if UNITY_WEBGL && !UNITY_EDITOR\n"
           "\t\t// porteo: en WebGL los créditos están en Resources (arreglar.py), no en un AssetBundle\n"
           "\t\tGameObject porteoCreditos = Resources.Load<GameObject>(\"porteo/credit_screen\");\n"
           "\t\treturn porteoCreditos != null ? Object.Instantiate(porteoCreditos) : null;\n"
           "#endif\n",
           "créditos desde Resources en WebGL")
# La captura del mouse que agregó el port de Android llama a Java: en WebGL no hay.
reemplazar("Assembly-CSharp/InputCapture.cs", "\tpublic InputCapture()\n\t{\n",
           "\tpublic InputCapture()\n\t{\n"
           "#if UNITY_WEBGL && !UNITY_EDITOR\n"
           "\t\treturn;  // porteo: es de Android (Java); en el navegador el mouse lo maneja Unity\n"
           "#endif\n",
           "sin captura de mouse de Android en WebGL")

# ── 6. La entrada de PC (ver Assets/Porteo/PorteoEntrada.cs) ──────────────────────────────
reemplazar("Assembly-CSharp/TouchControlsKit/TCKInput.cs",
           "\t\tpublic static bool GetAction(string buttonName, EActionEvent m_Event)\n",
           "\t\t// porteo: el botón de pantalla o su tecla de PC (SRInput)\n"
           "\t\tpublic static bool GetAction(string buttonName, EActionEvent m_Event)\n\t\t{\n"
           "\t\t\treturn PorteoBotonTactil(buttonName, m_Event) || PorteoEntrada.Accion(buttonName, m_Event);\n\t\t}\n\n"
           "\t\tpublic static bool PorteoBotonTactil(string buttonName, EActionEvent m_Event)\n",
           "botones táctiles + teclas de PC")
reemplazar("Assembly-CSharp/TouchControlsKit/TCKInput.cs",
           "\t\tpublic static Vector2 GetAxis(string controllerName)\n",
           "\t\t// porteo: la palanca de pantalla más WASD o el stick del mando\n"
           "\t\tpublic static Vector2 GetAxis(string controllerName)\n\t\t{\n"
           "\t\t\treturn PorteoEntrada.Eje(controllerName, PorteoEjeTactil(controllerName));\n\t\t}\n\n"
           "\t\tpublic static Vector2 PorteoEjeTactil(string controllerName)\n",
           "palanca táctil + WASD")
# Los controles de pantalla, sólo si la pantalla es táctil.
reemplazar("Assembly-CSharp/TouchControlsKit/TCKInput.cs",
           "\t\t\tm_Instance = this;\n\t\t\tSetActive(true);\n",
           "\t\t\tm_Instance = this;\n\t\t\tSetActive(PorteoEntrada.MostrarTactil());  // porteo\n",
           "controles de pantalla sólo en pantallas táctiles")
# Correr: el port corre con la palanca a fondo; en PC, con Shift (W a fondo no es correr).
reemplazar("Assembly-CSharp/vp_FPInput.cs",
           "if ((double)TCKInput.GetAxis(\"Joystick\").y >= 0.9)",
           "if ((double)TCKInput.PorteoEjeTactil(\"Joystick\").y >= 0.9 || SRInput.Actions.run.IsPressed)",
           "correr con Shift")
# Mirar: el código todavía calcula el mouse/mando (vector2) y el port lo pisaba con el táctil.
reemplazar("Assembly-CSharp/vp_FPInput.cs",
           "\t\tVector2 axis = TCKInput.GetAxis(\"Touchpad\");\n\t\tm_MouseLookSmoothMove.x",
           "\t\tVector2 axis = TCKInput.GetAxis(\"Touchpad\") + vector2;  // porteo: + mouse o mando\n\t\tm_MouseLookSmoothMove.x",
           "mirar con el mouse")
# El cursor: el port lo dejó siempre suelto (en Android mira con el dedo). Con mouse hay que
# trabarlo para poder girar sin tope; con los controles de pantalla, como en Android.
reemplazar("Assembly-CSharp/vp_Utility.cs",
           "\t\t\treturn Cursor.lockState == CursorLockMode.None;\n",
           "#if UNITY_WEBGL && !UNITY_EDITOR\n"
           "\t\t\tif (!TouchControlsKit.TCKInput.isActive)\n"
           "\t\t\t\treturn Cursor.lockState == CursorLockMode.Locked;  // porteo: con mouse, trabado\n"
           "#endif\n"
           "\t\t\treturn Cursor.lockState == CursorLockMode.None;\n",
           "cursor trabado con mouse (lectura)")
reemplazar("Assembly-CSharp/vp_Utility.cs",
           "\t\t\tCursor.lockState = CursorLockMode.None;\n\t\t}\n",
           "\t\t\tCursor.lockState = CursorLockMode.None;\n"
           "#if UNITY_WEBGL && !UNITY_EDITOR\n"
           "\t\t\tif (value && !TouchControlsKit.TCKInput.isActive)\n"
           "\t\t\t\tCursor.lockState = CursorLockMode.Locked;  // porteo: el navegador lo traba al próximo clic\n"
           "#endif\n\t\t}\n",
           "cursor trabado con mouse (escritura)")

# ── 7. Lo nuestro: Assets/Porteo, el puente JS, la página y la compilación ────────────────
NUESTRO = Path(__file__).resolve().parent / "unity"
INTRO = Path(__file__).resolve().parents[2] / "herramientas/porteo/intro.js"
for f in sorted(NUESTRO.rglob("*")):
    if f.is_file():
        d = P / f.relative_to(NUESTRO)
        if not d.exists() or d.read_bytes() != f.read_bytes():
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(f, d)
            hechos.append(f"{f.relative_to(NUESTRO)}: copiado")
d = P / "Assets/WebGLTemplates/Porteo/TemplateData/porteo-intro.js"
if INTRO.exists() and (not d.exists() or d.read_bytes() != INTRO.read_bytes()):
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(INTRO, d)
    hechos.append("la intro de JXStudios: copiada a la plantilla WebGL")

print("\n".join(hechos) or "nada para cambiar")
