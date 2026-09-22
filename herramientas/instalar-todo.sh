#!/usr/bin/env bash
# Deja la sesión lista: Docker + Neko (escritorio), ffmpeg, Blender, video y juegos.
#   bash herramientas/instalar-todo.sh
# Tarda ~3-4 min. Nada de credenciales acá: la clave de Neko queda en /root/.neko-clave.
set -u
rm -f /var/run/docker.pid
pgrep dockerd >/dev/null || (setsid nohup dockerd --iptables=false --bridge=none > /tmp/dockerd.log 2>&1 &)
( apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg blender imagemagick ) > /tmp/apt.log 2>&1 &
pip install -q pillow numpy scipy librosa opencv-python-headless websockets requests "yt-dlp[default,curl-cffi]" > /tmp/pip.log 2>&1 &
( mkdir -p /opt/gamekit && cd /opt/gamekit && [ -f package.json ] || npm init -y >/dev/null
  cd /opt/gamekit && npm i -s three phaser pixi.js howler cannon-es @dimforge/rapier3d-compat postprocessing gsap playwright-core ) > /tmp/npm.log 2>&1 &
for i in $(seq 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
if ! docker ps -a --format '{{.Names}}' | grep -qx neko; then
  [ -f /root/.neko-clave ] || { openssl rand -hex 8 > /root/.neko-clave; chmod 600 /root/.neko-clave; }
  CLAVE=$(cat /root/.neko-clave)
  docker run -d --name neko --network host --shm-size=2g --cap-add SYS_ADMIN \
    -e NEKO_DESKTOP_SCREEN=1920x1080@30 -e NEKO_MEMBER_PROVIDER=multiuser \
    -e NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD="$CLAVE" -e NEKO_MEMBER_MULTIUSER_USER_PASSWORD="$CLAVE" \
    -e NEKO_WEBRTC_EPR=52000-52010 -e NEKO_WEBRTC_NAT1TO1=127.0.0.1 -e NEKO_SERVER_BIND=127.0.0.1:8080 \
    ghcr.io/m1k1o/neko/xfce:latest >/dev/null
  sleep 10
  docker cp /root/.ccr/ca-bundle.crt neko:/usr/local/share/ca-certificates/agente-proxy.crt
  docker exec neko bash -lc "update-ca-certificates >/dev/null
    sed -i 's|URIs: http://|URIs: https://|' /etc/apt/sources.list.d/debian.sources
    printf 'Acquire::https::Proxy \"%s\";\n' '$HTTPS_PROXY' > /etc/apt/apt.conf.d/01proxy
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends firefox-esr mesa-utils libgl1-mesa-dri fonts-noto-color-emoji libnss3-tools" > /tmp/neko-apt.log 2>&1
  # Firefox usa su propio almacén (NSS): sin esto todo HTTPS da SEC_ERROR_UNKNOWN_ISSUER por el proxy.
  docker cp /root/.ccr/agent-proxy-ca.crt neko:/usr/local/share/ca-certificates/agent-proxy-ca.crt
  docker exec -u neko neko firefox-esr --headless -CreateProfile default >/dev/null 2>&1
  docker exec neko bash -c 'for d in /home/neko/.mozilla/firefox/*/; do su neko -c "certutil -N --empty-password -d sql:$d 2>/dev/null; certutil -A -n agent-proxy -t C,, -i /usr/local/share/ca-certificates/agent-proxy-ca.crt -d sql:$d"; done'
  P=${HTTPS_PROXY#http://}; P=${P%/}
  docker exec neko bash -c "mkdir -p /usr/lib/firefox-esr/distribution && printf '%s' '{\"policies\":{\"Proxy\":{\"Mode\":\"manual\",\"HTTPProxy\":\"$P\",\"SSLProxy\":\"$P\"},\"DisableTelemetry\":true}}' > /usr/lib/firefox-esr/distribution/policies.json"
  docker exec -d -u neko -e DISPLAY=:99.0 neko firefox-esr https://www.tiktok.com
else docker start neko >/dev/null; fi
wait
echo "listo. Neko: NEKO_URL=http://127.0.0.1:8080 NEKO_USER=admin NEKO_PASS=\$(cat /root/.neko-clave) no_proxy=127.0.0.1,localhost python3 herramientas/neko/neko.py estado"
