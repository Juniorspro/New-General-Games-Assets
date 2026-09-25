#!/bin/sh
# Corre el XRSLAM wasm sobre una secuencia exportada en varias condiciones
# "de navegador" y da el ATE de cada una. Hasta 4 a la vez.
#   matriz.sh <carpeta exportada> <groundtruth data.csv> <salida> [slam.yaml] [sensor.yaml]
cd "$(dirname "$0")/.."
E=$1; G=$2; O=$3; XR=${XRSLAM_SRC:-$HOME/.cache/mundo-ar/xrslam-src}
SLAM=${4:-$XR/configs/euroc_slam.yaml}; SENSOR=${5:-$XR/configs/euroc_sensor.yaml}
mkdir -p "$O"
correr() { # nombre, variables
  n=$1; shift
  env "$@" node herramientas/correr-wasm.mjs web/dist/xrslam.mjs "$SLAM" "$SENSOR" "$E" "$O/$n.tum" > "$O/$n.log" 2>&1
  printf "%-34s %s | %s\n" "$n" "$(grep '^cuadros' "$O/$n.log" | sed 's/ · total.*//')" "$(python3 herramientas/ate.py "$O/$n.tum" "$G" 2>&1 | tail -1)"
}
correr base                 X=0 &
correr imu60                IMU_HZ=60 &
correr imu60-sin-filtro     IMU_HZ=60 SIN_FILTRO=1 &
correr imu60-tiembla4       IMU_HZ=60 TIEMBLA_MS=4 &
wait
correr imu60-t4-enderezado  IMU_HZ=60 TIEMBLA_MS=4 ENDEREZAR=1 &
correr retraso30            RETRASO_MS=30 &
correr escala064-imu60      ESCALA=0.64 IMU_HZ=60 &
correr escala064-navegador  ESCALA=0.64 IMU_HZ=60 TIEMBLA_MS=4 ENDEREZAR=1 &
wait
