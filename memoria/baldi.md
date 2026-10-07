# Baldi's Basics Classic → un solo HTML (07/10)

Pidió "https://basically-games.itch.io/baldis-basics Mejor este, es más liviano" (el Classic 1.4.3, gratis, de
Micah McGonigal). Unity 2018.2.21. Salió `salida/baldi.html` de 13,5 MB. Código en `ports/baldi/` (sin nada del juego).

## Lo que hay que saber

- **Bajar de itch gratis**: csrf_token de la página y POST a `/file/<id>?source=view_game&as_props=1&after_download_lightbox=true` → `url`.
- **UnityPy 2018**: los MonoBehaviour se leen con `TypeTreeGeneratorAPI` sobre `Managed/`; el generador no
  alinea `m_Enabled` (hay que ponerle el flag 0x4000, `tipos.py`). FMOD de UnityPy sin placa: salida NOSOUND_NRT.
- **Clips no legacy**: las curvas están en `m_MuscleClip` (streamed, dense, constant, en ese orden de índice) y
  las ataduras en `m_ClipBindingConstant`; las de sprites son PPtr (índice a `pptrCurveMapping`). Ver `curvas_musculo`.
- **Sprites sin empaquetar**: se dibuja `m_Rect` entero; `textureRect` es un recorte sin bordes (salía revuelto).
- **Navmesh de Detour v16**: cabecera de 72 bytes, vértices, polígonos de 32 bytes (`navegacion`).
- **TextMeshPro**: la fuente es un MonoBehaviour con `m_glyphInfoList`; el atlas es solo alfa (dibujar con
  máscara). Letras que faltan (á, ñ, ¿) se arman con piezas (`ui.js › glifo`).
- **RawImage sin textura** = rectángulo blanco teñido (la pantalla del examen).
- **Mismo nombre ≠ mismo objeto**: la escuela tiene un MathGame apagado de plantilla, y dos "Touch Joystick".
- **Esbuild con `keepNames`**: los guiones se registran por nombre de clase.
- **Rendimiento**: las paredes/pisos son Plane de 10×10 (200 triángulos): a dos triángulos (450 mil → 27 mil),
  también en colisión. Lotes estáticos por celda de 150; lo repetido en InstancedMesh.
- **Controles de celu**: los de la versión móvil están en la escena (MobileControls, Rewired TouchJoystick/TouchPad/
  TouchButton); la build de PC los apagaba en `MobileController.Start`: acá se prenden al tocar. Giro del pad:
  barrido de toda la pantalla ≈ 180° con sensibilidad 2.
- El navegador de pruebas (swiftshader) atrasa mucho los toques de CDP: probar los controles con el puntero
  (`raton`) y `usandoTactil = true`.

## Pruebas

`correr.mjs` (PASOS con eval/foto/tecla/clic/raton/escena; `pruebas/cuaderno.js` pone al jugador frente a un cuaderno).
Probado: aviso → menú → modos → escuela; cuaderno → examen (en español) → error → Baldi se activa, persigue y
atrapa → GameOver; pausa; joystick y giro.

## Falta

Sin probar a fondo: objetos (BSODA, llaves, tijeras…), Playtime/cuerda, el final (salidas) y la escena secreta.
