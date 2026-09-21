# Tu "PC de IA" gratis, abierta desde el teléfono

Esto convierte un **Codespace de GitHub** (una máquina Linux gratis en la nube)
en un asistente de IA local que abrís desde el navegador del celular. No hace
falta tener PC.

## Por qué un Codespace y no esta sesión

La sesión de Claude corre en un contenedor **sin entrada de red y que se borra
al terminar**: sirve para trabajar, no para dejar algo prendido que vos
alcances. Un Codespace, en cambio, te da una URL pública y lo controlás vos con
tu cuenta de GitHub. Por eso el "entrar desde afuera" se hace acá, no desde la
sesión.

## Cómo entrar, desde el teléfono (una vez)

1. Abrí **github.com** en el navegador del celu e iniciá sesión.
2. Entrá a este repo: **`Juniorspro/New-General-Games-Assets`**.
3. Botón verde **`Code`** → pestaña **`Codespaces`** → **`Create codespace`**.
4. Esperá a que termine de armarse (un par de minutos). Al terminar ya tenés
   una terminal Linux en el navegador, con Ollama instalado.
5. En esa terminal escribí:

   ```bash
   ia
   ```

   La primera vez baja el modelo (~2 GB, una sola vez). Después le hablás y te
   responde, todo local y gratis.

   O una pregunta suelta, sin entrar al chat:

   ```bash
   ia "escribime un hola.html con la palabra hola en blanco"
   ```

## Cuánto cuesta

Nada, dentro del plan gratis de GitHub: **120 horas-núcleo y 15 GB por mes**
para cuentas personales. Un Codespace de 2 núcleos = ~60 horas gratis al mes.
Acordate de **frenarlo** cuando no lo uses (en github.com/codespaces) para no
gastar las horas.

## Qué modelo usa

`qwen2.5:3b` por defecto — chico, para que ande en la CPU del Codespace gratis
(no tiene GPU). Para cambiarlo, definí la variable antes de crear el Codespace,
o editá `OLLAMA_MODELO` en `setup-ollama.sh`. Modelos más grandes piensan mejor
pero más lento.

## Nota

Un Codespace también se borra si lo eliminás, pero **sobrevive entre sesiones**
mientras exista (a diferencia de la sesión de Claude). Lo que generes ahí,
igual: si vale la pena, commiteálo al repo.
