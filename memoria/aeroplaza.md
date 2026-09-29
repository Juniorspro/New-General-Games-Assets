# AEROPLAZA (referencia de 3D estilizado, Frutiger Aero / Wii)
Fuente: `guias/GUIA-AEROPLAZA.md` (la receta completa, con números). Ver también: [juegos](juegos.md), [juegos-3d](juegos-3d.md), [probar](probar.md).

## Qué es y dónde está
- Plaza social 3D en un HTML de 10,8 MB (`aeroplaza-con-canciones-21.html`): three.js r186 + 7 MP3 + 15 webp + 1 GLB; todo lo demás, código. → guía § 0
- NO está en el repo: la pasó quien pide en el chat el 29/09/2026 para aprender; es pesada y el repo es público. Si hace falta, pedirla.
- Para estudiarla: partir por líneas, sacar el base64, formatear con esbuild y repartir tramos. → guía § 0
- Para probarla: `?directo&idioma=es&reino=plaza`, `?pausa` + `window.__A.paso(1/60)`, `?calidad=`. Cero errores en los 7 reinos (29/09/2026). → [probar](probar.md)

## El look en una línea cada cosa
- Cielo por shader que alimenta niebla, reflejos (PMREM cada 8-60 s) y agua. → § 1
- NeutralToneMapping, HDR, bloom 256² fuerza 0,38 radio 0,55 **umbral 1,45**; pasada final con saturación 1,12 y viñeta 0,22. → § 1.1, § 2
- Borde fresnel emisivo (potencia 2,5-3, fuerza 0,1-0,45) + clearcoat 1 en todo; vidrio sin `transmission`. → § 3
- Geometría por código: cajas redondeadas, superelipses, biseles; fusión por material; 44 modelos. → § 4
- Pasto toroidal en GPU (16.000), agua en 2 triángulos con textura de profundidad, viento en una sola onda. → § 5
- Un día de 600 s atado a `Date.now()`: todos ven la misma hora sin red. → § 1.2

## Personaje y movimiento
- Avatar de 5 primitivas (1,32 m), 8 materiales con motivo hasta una "línea de flotación". → § 6
- Animación: poses dispersas + espejo + suavizado exponencial por canal (26/14 por s), squash & stretch, contragiro de cabeza. → § 7
- Caminar 3,4, correr 7,2, salto 8,6 m/s, g 24, coyote 0,12, buffer 0,14, gravedad ×2,1 al soltar (medido: 3,34 y 6,89 m/s de promedio en 2 s). → § 8

## Mundo, bucle y sonido
- Terreno como suma de funciones, siembra con semilla, "todo mira a algo", orbes como migas; zonas con música. → § 9
- Bucle: `dt` ≤ 0,05 + `dtReal`; simular → cámara → lo que la mira → dibujar; cámara `1 − exp(−dt·14)`. → § 10
- Viajes: velo 350 ms, `compileAsync` con tope, mínimo 900 ms, velo 450 ms. → § 10.3
- Música: 7 MP3 con `loopStart/loopEnd` (fin a 0,2 s del final) y el primer tiempo fuerte a +0,4 s; el motor generativo está apagado (`soloGrabadas = true`). → § 11

## Diseño, red y técnica
- Minijuegos con riesgo/recompensa, racha ×4, escalón final, estrellas, premio solo por estrellas nuevas; runner sincronizado con la canción analizada como texto. → § 15
- Red: MQTT en broker público, estado ≤ 10 Hz si cambió + latido 1,5 s; amigos con ECDH + AES-GCM y buzones retenidos. → § 12
- Calidad: puntaje de la placa + 60 cuadros medidos; SwiftShader cae en "mínima". → § 17
- Resguardos y puntos flojos que no hay que copiar. → § 19

## Lo que la persona tiene que saber (se le dijo el 29/09/2026)
- En un broker público el id de cada mensaje es autodeclarado: forma validada no es autoría. → § 12.6
- Confirmación de "borrar todo" con el foco en "Sí". → § 19
