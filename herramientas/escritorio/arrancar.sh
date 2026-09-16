#!/bin/bash
# Levanta el escritorio en :99 y lo deja andando en segundo plano.
#
#     source herramientas/escritorio/arrancar.sh     # deja DISPLAY puesto
#
# No hay pantalla fisica: todo pasa en un framebuffer en memoria. Para VER algo
# hay que sacar una captura (ver capturar.sh), no hay otra forma.
LOG="${LOG:-/tmp/escritorio}"
mkdir -p "$LOG"

if ! xdpyinfo -display :99 >/dev/null 2>&1; then
  # +extension GLX y llvmpipe: sin esto Blender y Krita no abren, se quejan de
  # que no hay contexto OpenGL.
  nohup Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset \
    > "$LOG/xvfb.log" 2>&1 &
  sleep 3
fi
export DISPLAY=:99
export LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe

if ! pgrep -x xfwm4 >/dev/null 2>&1; then
  nohup dbus-launch --exit-with-session xfce4-session > "$LOG/xfce.log" 2>&1 &
  sleep 10
fi

echo "escritorio en :99  ->  $(xdpyinfo | grep dimensions | awk '{print $2}')"
echo 'DISPLAY=:99 ya exportado. Los avisos de AT-SPI y pm-is-supported del log son normales.'
