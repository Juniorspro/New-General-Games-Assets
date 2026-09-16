#!/opt/ia/bin/python
"""Corre una IA local y mide a que velocidad contesta.

    /opt/ia/bin/python herramientas/ia-local/probar.py <ruta.gguf> "pregunta" [max_tokens]

Los numeros medidos de cada modelo estan en LEEME.md.

OJO CON LOS DESTILADOS DE R1: son modelos de razonamiento y escriben un bloque
<think> largo ANTES de contestar. Con max_tokens chico se gastan el presupuesto
pensando y la respuesta nunca aparece; no es que fallen, es que no llegaron.
Para esos hay que pasar 800-1500.
"""
import sys, time
from llama_cpp import Llama

if len(sys.argv) < 2:
    print(__doc__); sys.exit(1)
ruta = sys.argv[1]
pregunta = sys.argv[2] if len(sys.argv) > 2 else "Decime en dos frases que es un sprite."
maxtok = int(sys.argv[3]) if len(sys.argv) > 3 else 400

t0 = time.time()
# n_threads=4 son los nucleos reales; ponerle mas no acelera, compite consigo mismo.
llm = Llama(model_path=ruta, n_ctx=2048, n_threads=4, verbose=False)
carga = time.time() - t0

t1 = time.time()
r = llm.create_chat_completion(
    messages=[{"role": "user", "content": pregunta}],
    max_tokens=maxtok, temperature=0.4,
)
dt = time.time() - t1
u = r["usage"]
print(r["choices"][0]["message"]["content"].strip())
print(f"\n--- carga {carga:.1f}s | {u['completion_tokens']} tokens en {dt:.1f}s "
      f"= {u['completion_tokens']/dt:.2f} tok/s ---")
