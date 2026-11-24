# Memoria — recordar sin releer

Un método para que cada sesión de Claude Code sepa lo que ya se sabe sin leer
el repo entero otra vez. No instala nada: es una red de notas cortas en
`memoria/`, enlazadas entre sí, que la misma sesión lee y mantiene.

## Por qué ahorra

Leer cuesta tokens, y lo leído llena el contexto. En este repo, arrancar
leyendo `ARRANQUE.md` y `ESTADO.md` son ~10 mil tokens, y `estado.json` de
Rezona otros ~17 mil. Con la memoria se lee el índice (~1.300) y la nota del
tema (~500 a 1.500): **de 5 a 10 veces menos por tarea.** Son números
aproximados, contados como caracteres ÷ 3,5.

Las notas guardan conclusiones (el dato, el número, el porqué) y un puntero a la
fuente. La fuente sigue siendo el repo: la memoria dice qué abrir y qué parte.

## La forma

```
memoria/
  INDICE.md     lo único que se lee al arrancar: reglas, quién pide, notas, carpetas
  <tema>.md     una nota por tema, enlazada con las otras
  diario.md     una entrada por sesión: qué quedó y qué falta
CLAUDE.md       tres líneas que Claude Code carga solo en cada sesión
```

## Al arrancar

1. Leé `memoria/INDICE.md`. Nada más.
2. Abrí la nota que la tarea pide; si toca dos temas, las dos.
3. Si la nota apunta a una fuente (`archivo § título`), abrí solo esa parte:
   `grep -n "título" archivo` y después `Read` con `offset` y `limit`.
4. Si la memoria no lo tiene, buscá en el repo con `grep -rn` y palabras
   precisas, leé solo las líneas que devuelve, y anotalo al terminar.

## Mientras trabajás: gastar poco

- `grep` antes que `Read`, y `Read` con `offset`/`limit`. Nada entero "para ver".
- Ningún `.md` del repo "por las dudas": la memoria dice cuál y qué sección.
- Salidas cortas: `| head`, `| tail`, `wc -l`, `--stat`, `git log --oneline -10`.
- De un JSON grande se saca la clave con `python3 -c` o `grep -n`; no se abre.
- No releas lo que acabás de escribir o editar.
- Muchas capturas se miran como una hoja de contacto, y una sola vez.
- En el chat no copies lo que ya está en un archivo: nombrá el archivo.

## Al terminar cada tarea (no al final: la sesión se puede cortar)

1. Lo que aprendiste y otra sesión necesitaría va a su nota, en una línea con el
   número, la fecha o la fuente.
2. Lo que resultó falso o viejo se corrige o se borra. No se agrega una
   contradicción al lado.
3. Una entrada en `diario.md`: fecha, rama, qué quedó y qué falta.
4. Si cambió qué hay y dónde, se actualiza `INDICE.md`.
5. Commit junto con el trabajo (o uno aparte, "Memoria: …") y push. Lo que no
   se commitea se pierde con el contenedor.

## Cómo se escribe una nota

- Una afirmación por línea: el dato con su número y su fecha, y el porqué si no
  es obvio.
- La fuente se apunta con `archivo § título` o `archivo › clave`, no con número
  de línea, porque las líneas se corren.
- Las notas se enlazan con `[rezona](rezona.md)`: eso es la red. Cada nota dice
  qué otras mirar, y el índice las junta a todas.
- Lo que no se comprobó se marca "(sin comprobar)".
- Topes: el índice hasta ~100 líneas y cada nota hasta ~120. Si una crece, se
  parte y se suma al índice.
- Si la memoria y el código no coinciden, gana el código y se arregla la memoria.
- **Nunca:** secretos, tokens, contraseñas, mails ni datos personales; tampoco
  logs crudos ni código copiado (se apunta al archivo).

## Qué se guarda

- **Sí:**
  - lo que prefiere quien pide y lo que no quiere;
  - los comandos que andan y las trampas ya pagadas;
  - qué hay y dónde;
  - las decisiones con su motivo;
  - lo que quedó a medias;
  - las caídas de servicios, con fecha.
- **No:**
  - lo que se ve leyendo el código en un minuto;
  - lo que ya dice `git log`;
  - lo que cambia todos los días, salvo que lleve fecha.

## Llevarlo a otro repo

1. Copiá este archivo a la raíz.
2. Creá `memoria/INDICE.md` con lo que ya sepas. No leas el repo entero para
   llenarlo: arrancá con lo que da la primera tarea y crecé de a poco.
3. Creá `CLAUDE.md` en la raíz con esto (Claude Code lo lee solo al empezar
   cada sesión, así que tiene que ser corto):

```markdown
# Para cada sesión nueva
1. Leé `memoria/INDICE.md` y nada más; después, solo la nota que la tarea pida.
2. No leas `.md` enteros del repo: la memoria dice qué sección abrir.
3. Al terminar cada tarea, anotá lo aprendido en `memoria/` (cómo: `MEMORIA.md`).
```

Plantilla de índice:

```markdown
# Memoria — el índice
Última puesta al día: <fecha>.
## Reglas que no se discuten
- …
## Quién pide
- …
## Las notas
| nota | abrila cuando… |
|---|---|
| [tema](tema.md) | … |
## Qué hay en cada carpeta
| carpeta | qué es | detalle en |
|---|---|---|
```

Plantilla de nota:

```markdown
# <Tema>
Fuente: `archivo § título`. Ver también: [otra](otra.md).
## <Subtema>
- <dato con número y fecha> — <por qué, si hace falta>. → `archivo § título`
```
