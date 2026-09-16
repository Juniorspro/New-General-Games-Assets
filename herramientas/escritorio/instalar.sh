#!/bin/bash
# Deja la maquina con escritorio grafico, programas de edicion/modelado y Wine.
# Se corre una vez por sesion: el contenedor se borra al terminar y no queda nada.
#
# Tarda unos 10 minutos y ocupa ~1,5 GB. Medido: de 7,5 GB usados a 8,8 GB.
set -e
export DEBIAN_FRONTEND=noninteractive
paso() { echo; echo "######## $* ########"; date '+%H:%M:%S'; }

paso "indices"
apt-get update -qq

paso "escritorio virtual"
# Sin --no-install-recommends, xfce4 se trae medio Ubuntu.
apt-get install -y -qq --no-install-recommends \
  xvfb x11vnc dbus-x11 x11-utils x11-xserver-utils xdotool wmctrl \
  xfce4 xfce4-terminal xfce4-goodies \
  imagemagick scrot ffmpeg fonts-dejavu fonts-liberation

paso "temas e iconos"
# Sin esto el XFCE arranca sin un solo icono y llena el log de
# "Failed to look up notification icon".
apt-get install -y -qq --no-install-recommends \
  adwaita-icon-theme tango-icon-theme elementary-xfce-icon-theme \
  greybird-gtk-theme librsvg2-common

paso "wine: primero el arreglo de libgd3, DESPUES los programas"
# LA TRAMPA QUE MAS CUESTA ACA. Esta imagen trae habilitado el PPA de
# ondrej/php, que publica un libgd3 mas nuevo SOLO para amd64. libgd3 es
# Multi-Arch: same, o sea que las dos arquitecturas tienen que estar en la
# MISMA version. Al pedir wine32:i386 (que solo existe en la version de
# Ubuntu), apt no puede conciliar las dos y contesta
#     E: Unable to correct problems, you have held broken packages
# nombrando a libgphoto2, que no tiene nada que ver. Peor: si uno intenta
# forzarlo instalando libgd3:i386 a mano, apt RESUELVE el empate sacando el
# libgd3 de amd64 y con el se lleva puestos blender, gimp, graphviz y el
# propio wine, sin que el comando falle. Por eso el pin va ANTES que todo.
dpkg --add-architecture i386
cat > /etc/apt/preferences.d/99-libgd3-ubuntu <<'PIN'
Package: libgd3
Pin: release o=LP-PPA-ondrej-php
Pin-Priority: 100
PIN
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  wine wine64 wine32:i386 winbind cabextract

paso "modelado, imagen y audio"
apt-get install -y -qq --no-install-recommends \
  blender inkscape gimp krita audacity openscad meshlab graphviz \
  python3-numpy python3-pil

paso "listo"
df -h / | tail -1
for p in blender inkscape gimp krita audacity openscad meshlab wine; do
  printf "  %-10s %s\n" "$p" "$(command -v $p || echo FALTA)"
done
