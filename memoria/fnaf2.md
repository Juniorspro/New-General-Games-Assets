# FNaF 2 → un solo HTML (07/10)

> **Fue un error portearlo:** FNaF 2 se vende (Steam, celular). No usarlo de precedente para otros juegos pagos
> (ver la regla en INDICE). Lo técnico de abajo sirve para fangames de Clickteam, que son gratis.

Pidió portear "FiveNightsatFreddys2bySuperMiGamer003.exe" (MediaFire) "como siempre dando créditos", **en HTML**,
**igual al de celular** (no botones inventados), **sin traducir** (queda en inglés) y que **arranque directo como el
original, con una intro de JXStudios**. Es el FNaF 2 v1.033 **completo** de Scott Cawthon
(trae pantallas de demo que no se activan: `DEMO?` queda en 0; «Continue» con `level` 5 entra a la noche 5), Clickteam
Fusion 2.5 build 288. Salió `salida/fnaf2.html` de 19,8 MB. Código en `ports/fnaf2/` (sin nada del juego).

## Lo que hay que saber

- **No usar CTFAK** ni código de terceros bajado de GitHub: el clasificador lo frena ("Code from External"). El
  lector es propio (`herr/ctf.py`) y alcanzó.
- **Formato del .exe**: después del PE va el paquete (`wwww\x49\x87\x47\x12`, nombres UTF-16), después `PAMU`
  (+16) y los trozos `id u16, flags u16, tamaño i32` (flags 1 zlib con `dec,comp`; 2 cifrado; 3 las dos).
- **Cifrado** (`cifra.py`): clave = título + copyright + ruta del .mfa (`0x2224`, `0x223B`, `0x222E`), los
  caracteres como bytes sin los ceros; `clave_combinada` y `tabla` tipo RC4 con magic 54; en ids impares (build
  >284) el primer byte se XORea con `id&0xFF ^ id>>8`. Se valida solo: el zlib descomprime o no.
- **Los bancos guardan handle+1** (imágenes, sonidos y fuentes) en b284+: restar 1. Las imágenes de 24 bits tienen
  filas de **ancho par en píxeles**; el alfa, filas a múltiplo de 4.
- **Eventos**: grupo de 16 bytes de cabecera; condición con `id`; parámetros `tamaño, código, datos`. Códigos que
  usa FNaF 2 y su sentido: en `ver.py` y en `motor.js` (`cond`, `accion`). Los saltos de frame usan
  `handles[handle]` (trozo `0x222B`).
- **Objetos**: ObjectCommon con anims en +4, movimientos en +6, contador en +14, datos de texto/contador en +36,
  `nfl & 8` visible al empezar, `cfl & 0x800` **no sigue el escenario** (el runtime lo corre con la pantalla).
  Capas: `fl & 0x10` visible. Objeto global: `fl & 4` en el ObjectInfo.
- **Perspective** (oficina): efecto panorama, ancho/alto en el ext +24; se aplica a lo dibujado antes en el orden.
- **Velocidades**: trayectoria `v/8` px por loop a 60 loops/s; animación: suma `vel` y avanza un cuadro cada 100.

## Controles como en FNaF 2 para celular

El dedo hace de mouse (bordes para mirar, LIGHT, barras de cámaras y máscara); **la linterna es la «zona de toque»**:
mantener el dedo en el medio donde no hay nada que tocar = Ctrl. Al soltar, el puntero pasa un instante por
`button reset` (si no, la barra no se rearma) y se va de la pantalla. La cruz aparece solo en los minijuegos (W/S).

## Pruebas

`pruebas/correr.mjs` (FRAME, PASOS con clic/tecla/eval; `__fnaf2.acelerar` para noches rápidas),
`celu.mjs` (táctil acostado o `W=390 H=844` parado; `ARCHIVO=1` el HTML único), `pantallas.mjs` (todos los frames),
`intro.mjs`.

## Falta

Sin subtítulos de las llamadas. El efecto panorama está a ojo (zoom 200 → estiramiento `h*zoom/2000` en los bordes).
