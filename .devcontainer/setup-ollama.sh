#!/usr/bin/env bash
# Prepara un Codespace como "PC de IA local" que se abre desde el teléfono.
#
# Corre solo una vez, al CREAR el Codespace (postCreateCommand). Instala Ollama
# y deja el comando `ia`. NO baja el modelo aca a proposito: bajarlo demora el
# arranque, asi que la primera corrida de `ia` lo baja (una sola vez por
# Codespace; despues queda cacheado).
#
# Lo que se aprendio montando esto y quedo resuelto aca:
#  - El instalador de Ollama EXIGE zstd para descomprimir; sin el aborta.
#  - En un Codespace no corre systemd, asi que el servidor se levanta a mano
#    (`ollama serve` en segundo plano), no con `systemctl`.
#  - Sin GPU, Ollama avisa y cae a CPU: anda igual, mas lento.
set -e

echo ">>> Instalando zstd (lo exige el instalador de Ollama)..."
sudo apt-get update -qq && sudo apt-get install -y -qq zstd

echo ">>> Instalando Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# El comando `ia`: levanta el servidor si hace falta, baja el modelo la primera
# vez, y abre el chat. Un modelo chico (qwen2.5:3b) para que ande en la CPU del
# Codespace gratis.
MODELO="${OLLAMA_MODELO:-qwen2.5:3b}"
sudo tee /usr/local/bin/ia >/dev/null <<IA
#!/usr/bin/env bash
# Asistente de IA local. Uso:  ia          (chat interactivo)
#                              ia "texto"  (una sola pregunta)
export OLLAMA_HOST=127.0.0.1:11434
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "levantando el servidor de Ollama..."
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  for i in \$(seq 1 30); do
    curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
fi
if ! ollama list 2>/dev/null | grep -q "${MODELO%%:*}"; then
  echo "bajando el modelo ${MODELO} (solo la primera vez, ~2 GB)..."
  ollama pull ${MODELO}
fi
if [ \$# -gt 0 ]; then
  ollama run ${MODELO} "\$*"
else
  ollama run ${MODELO}
fi
IA
sudo chmod +x /usr/local/bin/ia

echo ""
echo ">>> Listo. Escribi 'ia' en la terminal para hablar con el modelo local."
echo ">>> La primera vez baja el modelo (~2 GB); despues arranca al toque."
