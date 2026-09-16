#!/bin/bash
# Saca una captura del escritorio entero.  ./capturar.sh salida.png
DEST="${1:-captura.png}"
DISPLAY=:99 import -window root "$DEST"
echo "$DEST  ($(stat -c%s "$DEST") bytes)"
DISPLAY=:99 wmctrl -l | grep -viE "xfce4-panel|Desktop" || echo "(sin ventanas abiertas)"
