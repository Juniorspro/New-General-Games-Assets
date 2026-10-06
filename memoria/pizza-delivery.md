# Pizza Delivery v0.2 → APK (06/10)

Segundo port pedido por link (después de [bus-stop](bus-stop.md), que tiene la base: UnityPy, el IL, la luz de
Unity en three, lo que no entra al repo). Juego de Shahabaz Khan, Unity 3.5, 6 escenas, scripts en UnityScript.
En `ports/pizza-delivery/` va solo el código; la APK (21 MB) se mandó.

## Lo nuevo frente a Bus Stop

- **RAR5:** no hay unrar; `libarchive-c` (pip) con la libarchive del sistema, archivo por archivo (con
  `extract_file` falla en las carpetas).
- **Los campos de los scripts sin escribirlos a mano** (`herramientas/campos.py`): los tipos salen de las DLL con
  dnfile (públicos, no estáticos, no [NonSerialized], primero la clase base). Ojo: una clase de UnityScript hereda
  de `System.Object`, no de `UnityEngine.Object` (si no, se lee como PPtr y sale basura).
- **Varios AudioSource en un objeto:** el PPtr apunta al componente; se exportan con su `pid`.
- **Static batching:** las mallas fijas de la casa vienen fusionadas ("Combined Mesh (root: scene)", ya en
  coordenadas del mundo) y cada renderer elige sus submallas (`m_SubsetIndices`).
- **Unity 3.5: cada objeto se prende y apaga solo** (el padre apagado no apaga a los hijos); SetActiveRecursively
  sí baja por el árbol. Lo apagado que ningún script nombra no se usa nunca.
- Lo que tocan los scripts (o se anima con clips, o tiene un tag que se usa) queda aparte; el resto se junta por
  material y celda: la casa pasa de 761 a 337 llamadas. Una casa con un Animation **sin clips** marcaba todo.
- **Personajes:** SkinnedMesh en coordenadas del mundo (bindMode detached, bindMatrix identidad), huesos = nodos,
  bindposes con el signo de z dado vuelta (`S·B·S`).
- **Las corrutinas** (`yield WaitForSeconds`) son `await J.esperar(n)`; `cargarNivel` espera un tick (si no, el
  cuadro que lo pidió sigue con la escena borrada). Los diálogos van por número (`J.sub(7)` → `datos/textos.json`).
- **Física:** los colliders que se mueven (puertas, placard) se prueban en su espacio y **con una caja previa**
  (sin la caja: 56 ms por paso; con: 0,05). Un triángulo sin área daba NaN.
- El mapa de mezcla del terreno vino vacío (todo 0): se usa la primera capa.
- Mallas más chicas: normales en 4 bytes, UV en medio flotante, pesos en bytes, las de colisión solo posiciones
  (29,5 → 21 MB).
- **Pruebas:** paso a paso con `await` entre cuadros (las corrutinas avanzan en microtareas: un bucle de una sola
  vez no las deja correr); `__pizza.congelar = 'todo'` para no dibujar en SwiftShader y `__pizza.dibujar()` para
  las fotos; `pgrep -f`/`pkill -f` con el nombre del script mataban la propia shell.

## Falta

- Probarla en un teléfono (FPS con 4 luces puntuales + 2 focos, el sonido, el tacto).
- No están: el pasto del terreno (no tenía), el Bloom y el ContrastEnhance de la cámara.
