#!/bin/bash
# IA local que corre en esta maquina, sin API y sin internet una vez bajada.
#
#     herramientas/ia-local/instalar.sh [coder|r1-7b|r1-14b|qwen3b]
#
# Los numeros medidos de cada uno estan en LEEME.md. Resumen: 'coder' es el
# unico que conviene, y los destilados de R1 no se pueden usar para trabajar
# porque se gastan el presupuesto de tokens razonando antes de contestar.
#
# POR QUE NO OLLAMA: se baja de GitHub Releases, y esta sesion tiene GitHub
# limitado a un solo repositorio. Cualquier otra URL de github.com contesta 403
# con "GitHub access to this repository is not enabled for this session". No es
# el proxy ni la red: es la politica de la sesion, y no se puede rodear. PyPI y
# HuggingFace SI responden, asi que se compila llama.cpp desde el sdist de PyPI
# y el modelo sale de HuggingFace.
set -e
CUAL="${1:-coder}"
DIR=/opt/ia/modelos

case "$CUAL" in
  coder)  REPO=bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF
          ARCH=DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf ;;       # 10,4 GB
  r1-7b)  REPO=bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF
          ARCH=DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf ;;           #  4,7 GB
  r1-14b) REPO=bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF
          ARCH=DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf ;;          #  9,0 GB
  qwen3b) REPO=Qwen/Qwen2.5-3B-Instruct-GGUF
          ARCH=qwen2.5-3b-instruct-q4_k_m.gguf ;;                   #  2,1 GB
  *) echo "no conozco '$CUAL'. Ver LEEME.md"; exit 1 ;;
esac

if [ ! -x /opt/ia/bin/python ]; then
  echo "### compilando llama-cpp-python (~4 min en 4 nucleos) ###"
  # Ubuntu 24.04 tiene PEP 668: sin el venv, pip se niega a instalar nada.
  python3 -m venv /opt/ia
  /opt/ia/bin/pip install -q --upgrade pip wheel setuptools
  /opt/ia/bin/pip install -q llama-cpp-python
fi
/opt/ia/bin/python -c "import llama_cpp; print('llama_cpp', llama_cpp.__version__)"

# La cuota de disco es de ~38 GB y el escritorio ya se lleva unos 14. Bajar un
# modelo grande sin mirar deja el disco en cero y a partir de ahi TODA escritura
# falla, aunque df muestre 252 GB de tamano. Borrar un .gguf libera al instante.
echo "### disco antes de bajar ###"; df -h / | tail -1
mkdir -p "$DIR"
echo "### bajando $ARCH ###"
curl -fL --progress-bar -o "$DIR/$ARCH" \
  "https://huggingface.co/$REPO/resolve/main/$ARCH?download=true"
ls -la "$DIR/$ARCH" | awk '{printf "%s  %.2f GB\n", $9, $5/1e9}'
df -h / | tail -1
echo
echo "probalo:  /opt/ia/bin/python herramientas/ia-local/probar.py $DIR/$ARCH 'tu pregunta'"
