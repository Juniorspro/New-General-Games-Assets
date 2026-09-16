# IA local: qué DeepSeek entra en esta máquina y cuál conviene

Todo lo de acá está **medido el 2026-09-16** en esta máquina: 4 núcleos, 15 GB
de RAM, **sin GPU**. Misma pregunta para todos, `n_ctx=2048`, `n_threads=4`,
cuantización Q4_K_M.

| modelo | tamaño | tok/s | ¿termina la respuesta? |
|---|---:|---:|---|
| **DeepSeek-Coder-V2-Lite** 16B MoE (2,4B activos) | 10,4 GB | **8,38** | sí, en 231 tokens |
| Qwen2.5 3B Instruct | 2,1 GB | 6,20 | sí |
| DeepSeek-R1-Distill-Qwen **7B** | 4,7 GB | 5,30 | **no** — gastó los 300 tokens pensando |
| DeepSeek-R1-Distill-Qwen **14B** | 9,0 GB | 2,28 | **no** — 200 tokens, todos de `<think>` |

## Lo que hay que sacar de esa tabla

**El modelo más grande es el más rápido.** DeepSeek-Coder-V2-Lite tiene 16B
parámetros pero es *mixture of experts*: activa sólo 2,4B por token. Le gana al
Qwen de 3B en velocidad Y en tamaño. En CPU, lo que manda no son los parámetros
totales sino los **activos**. Es el único que conviene acá.

**Los destilados de R1 son una trampa en CPU.** No es que anden lento: es que
son modelos de razonamiento y escriben un bloque `<think>` largo antes de
contestar. A 5,3 tok/s el 7B se comió los 300 tokens del presupuesto razonando
y **nunca llegó a escribir la función**. El 14B, a 2,28 tok/s, lo mismo con 200.
Para que contesten de verdad hay que darles 800-1500 tokens de salida, o sea
**2 a 10 minutos por respuesta**. Andan, pero no se pueden usar para trabajar.

## DeepSeek V3 y R1 de verdad (los de 671B) NO entran

No es cuestión de paciencia, es aritmética:

| | hace falta | hay |
|---|---:|---:|
| disco (R1 671B en Q4_K_M) | ~404 GB | ~38 GB de cuota |
| RAM | ~400 GB | 15 GB |

Ni con la cuantización más agresiva se acerca. Para usar V3 o R1 de verdad hay
que ir por la API de DeepSeek, que es otra cosa: sale por internet y se paga.
Lo que corre acá son **destilados** — Qwen y Llama entrenados con salidas de
R1 — y conviene no confundirlos: se llaman "DeepSeek-R1-Distill-…" justamente
porque no son R1.

## Cómo usarlos

```bash
herramientas/ia-local/instalar.sh coder     # el recomendado (10,4 GB)
herramientas/ia-local/instalar.sh r1-7b     # el destilado de razonamiento
herramientas/ia-local/instalar.sh qwen3b    # el chico, para algo liviano

/opt/ia/bin/python herramientas/ia-local/probar.py <ruta-del-gguf> "tu pregunta"
```

**Mirá el disco antes de bajar.** La cuota es de ~38 GB y el escritorio con
todos los programas ya se lleva unos 14 GB. Bajar el 14B dejó el disco en
**1009 MB libres (98%)**; a partir de ahí cualquier escritura falla, aunque
`df` muestre 252 GB de tamaño. Borrar un modelo libera al instante.

## Por qué no Ollama

Se baja de GitHub Releases, y esta sesión tiene GitHub limitado a un solo
repositorio: cualquier otra URL de `github.com` contesta **403**
(*"GitHub access to this repository is not enabled for this session"*). No es el
proxy ni la red: es la política de la sesión y no se rodea. PyPI y HuggingFace
sí responden, así que el motor se compila desde PyPI y los modelos salen de
HuggingFace.
