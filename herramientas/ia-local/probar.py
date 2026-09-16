#!/opt/ia/bin/python
"""Prueba que la IA local responde, y mide a que velocidad.

    /opt/ia/bin/python herramientas/ia-local/probar.py "tu pregunta"

Medido el 2026-09-16 en esta maquina: 6,2 tok/s con 4 nucleos y sin GPU.
No es rapido, pero no gasta creditos y no sale a internet.
"""
import sys, time
from llama_cpp import Llama

MODELO = "/opt/ia/modelos/qwen2.5-3b-instruct-q4_k_m.gguf"
pregunta = " ".join(sys.argv[1:]) or "Decime en dos frases que es un sprite en un videojuego."

# n_threads=4 son los nucleos reales; ponerle mas no acelera, compite consigo mismo.
llm = Llama(model_path=MODELO, n_ctx=2048, n_threads=4, verbose=False)

t0 = time.time()
r = llm.create_chat_completion(
    messages=[{"role": "user", "content": pregunta}],
    max_tokens=400, temperature=0.4,
)
dt = time.time() - t0
n = r["usage"]["completion_tokens"]
print(r["choices"][0]["message"]["content"].strip())
print(f"\n--- {n} tokens en {dt:.1f}s = {n/dt:.1f} tok/s ---")
