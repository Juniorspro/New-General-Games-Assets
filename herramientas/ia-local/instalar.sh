#!/bin/bash
# IA local que corre en esta maquina, sin API y sin internet una vez bajada.
#
# POR QUE NO OLLAMA: se baja de GitHub Releases, y esta sesion tiene GitHub
# limitado a un solo repositorio. Cualquier otra URL de github.com contesta 403
# con el mensaje "GitHub access to this repository is not enabled for this
# session". No es el proxy ni un problema de red: es la politica de la sesion, y
# no se puede rodear. PyPI y HuggingFace SI responden, asi que se compila
# llama.cpp desde el sdist de PyPI y el modelo sale de HuggingFace.
set -e
MODELO_DIR=/opt/ia/modelos
MODELO="$MODELO_DIR/qwen2.5-3b-instruct-q4_k_m.gguf"

echo "### compilando llama-cpp-python (tarda ~4 min en 4 nucleos) ###"
python3 -m venv /opt/ia
/opt/ia/bin/pip install -q --upgrade pip wheel setuptools
# Ubuntu 24.04 tiene PEP 668, por eso el venv y no un pip install a secas.
/opt/ia/bin/pip install -q llama-cpp-python
/opt/ia/bin/python -c "import llama_cpp; print('llama_cpp', llama_cpp.__version__)"

echo "### bajando el modelo (2,1 GB) ###"
mkdir -p "$MODELO_DIR"
curl -fsSL -o "$MODELO" \
  "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf?download=true"
ls -la "$MODELO"
echo "listo. probar con: /opt/ia/bin/python herramientas/ia-local/probar.py"
