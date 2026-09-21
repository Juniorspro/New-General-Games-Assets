---
title: PeakCode Motor
emoji: 🚀
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# El motor de PeakCode — OmniRoute en un Space

Esto corre OmniRoute en un servidor gratis de Hugging Face, así la app apunta
ahí y **el usuario no instala nada en el teléfono**. Es la opción A.

## Armarlo (una vez, ~10 min, sin tarjeta)

1. Cuenta en **huggingface.co** (gratis).
2. **New → Space** → SDK **Docker** → **Blank**. Ponele un nombre, por ejemplo
   `peakcode-motor`.
3. Subí **estos dos archivos** (`Dockerfile` y `README.md`) al Space — por la
   web, botón *Files → Add file*, o por git.
4. **Settings → Variables and secrets → New secret**, dos veces:
   - `STORAGE_ENCRYPTION_KEY` → una cadena larga al azar (letras y números).
   - `OMNIROUTE_ADMIN_PASSWORD` → la contraseña del panel. **Esta es la que le
     vas a dar a la app.**
5. El Space compila solo (tarda, baja 1,2 GB). Cuando quede *Running*, tu motor
   vive en `https://TU-USUARIO-peakcode-motor.hf.space`.

## Conectarlo en la app

En PeakCode, ⚙ → *Rehacer la configuración* → *Poner la dirección a mano* →
`https://TU-USUARIO-peakcode-motor.hf.space/v1` → seguir. La app hace el login
con la contraseña del paso 4 y saca la llave sola.

## Conectar un proveedor gratis (una vez)

Abrí `https://…hf.space/dashboard` en el navegador, entrá con la contraseña, y
en *Providers* agregá uno **noauth** (AI Horde anda con la key anónima
`0000000000`). Sin al menos un proveedor, el chat no tiene con qué contestar.

## Las tres cosas honestas

1. **El free tier NO guarda los datos entre rebuilds.** Si el Space se
   reconstruye, se borra `storage.sqlite`: se pierden las keys emitidas y hay
   que rehacer login (la contraseña sobrevive porque es un secret). Para que
   persista de verdad hace falta almacenamiento persistente, que es de pago.
2. **Los Spaces gratis se duermen** por inactividad y tardan en despertar. El
   primer mensaje después de un rato puede demorar.
3. **Un solo motor para todos** significa una sola bolsa de límites gratis
   compartida. Sirve para vos y para probar; para muchos usuarios, cada uno
   necesita el suyo, o se paga.

Corre igual en Render, Railway o Fly.io: mismo Dockerfile, cambia dónde poner
los secrets y el puerto (casi todos inyectan `$PORT`, que este archivo ya
respeta).
