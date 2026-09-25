// Puente de XRSLAM a JavaScript (WebAssembly). Funciones planas en C: sin
// embind, así el módulo queda chico y se llama igual desde un worker, la
// página o Node.
//
//   xr_crear(slamYaml, sensorYaml)    las dos configuraciones, como TEXTO
//   xr_imu(t, wx, wy, wz, ax, ay, az) una muestra de IMU (s, rad/s, m/s²)
//   xr_imagen(t, gris)                un cuadro gris del tamaño configurado
//   xr_estado()                       0 iniciando · 1 siguiendo · 2 perdido
//   xr_pose(salida, cual)             8 doubles: t, x, y, z, qx, qy, qz, qw
//                                     (cual: 0 cuerpo/IMU, 1 cámara)
//   xr_puntos(salida, max)            hasta max puntos 3D del mapa (x, y, z)
//   xr_destruir()
//
// El orden importa: XRSLAM procesa una imagen recién cuando le llega IMU
// posterior a ella. La pose de un cuadro aparece después del xr_imu que la
// cubre, no en el mismo xr_imagen.
#include <XRSLAM.h>
#include <emscripten/emscripten.h>

#include <cstdio>
#include <cstring>

namespace {
void *g_config = nullptr;
bool g_vivo = false;

bool escribir(const char *ruta, const char *texto) {
    FILE *f = std::fopen(ruta, "wb");
    if (!f) return false;
    std::fwrite(texto, 1, std::strlen(texto), f);
    std::fclose(f);
    return true;
}
} // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE int xr_crear(const char *slam_yaml, const char *sensor_yaml) {
    if (g_vivo) { XRSLAMDestroy(); g_vivo = false; }
    // XRSLAM lee las configuraciones de archivos: van al sistema de archivos
    // en memoria de Emscripten.
    if (!escribir("/slam.yaml", slam_yaml) || !escribir("/sensor.yaml", sensor_yaml)) return 0;
    g_vivo = XRSLAMCreate("/slam.yaml", "/sensor.yaml", "", "mundo-ar", &g_config) != 0;
    return g_vivo ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE void xr_imu(double t, double wx, double wy, double wz, double ax, double ay, double az) {
    if (!g_vivo) return;
    XRSLAMGyroscope g{{wx, wy, wz}, t};
    XRSLAMAcceleration a{{ax, ay, az}, t};
    XRSLAMPushSensorData(XRSLAM_SENSOR_GYROSCOPE, &g);
    XRSLAMPushSensorData(XRSLAM_SENSOR_ACCELERATION, &a);
}

EMSCRIPTEN_KEEPALIVE void xr_imagen(double t, unsigned char *gris, int ancho) {
    if (!g_vivo) return;
    XRSLAMImage x;
    x.camera_id = 0;
    x.timeStamp = t;
    x.ext = nullptr;
    x.data = gris;
    x.channel = 1;
    x.stride = ancho;
    XRSLAMPushSensorData(XRSLAM_SENSOR_CAMERA, &x);
    XRSLAMRunOneFrame();
}

EMSCRIPTEN_KEEPALIVE int xr_estado() {
    if (!g_vivo) return 0;
    XRSLAMState e;
    XRSLAMGetResult(XRSLAM_RESULT_STATE, &e);
    return e == XRSLAM_STATE_TRACKING_SUCCESS ? 1 : e == XRSLAM_STATE_INITIALIZING ? 0 : 2;
}

EMSCRIPTEN_KEEPALIVE void xr_pose(double *salida, int cual) {
    XRSLAMPose p{};
    if (g_vivo) XRSLAMGetResult(cual == 1 ? XRSLAM_RESULT_CAMERA_POSE : XRSLAM_RESULT_BODY_POSE, &p);
    salida[0] = p.timestamp;
    for (int i = 0; i < 3; ++i) salida[1 + i] = p.translation[i];
    for (int i = 0; i < 4; ++i) salida[4 + i] = p.quaternion[i];
}

EMSCRIPTEN_KEEPALIVE int xr_puntos(double *salida, int max) {
    if (!g_vivo) return 0;
    XRSLAMLandmarks l{};
    XRSLAMGetResult(XRSLAM_RESULT_LANDMARKS, &l);
    int n = l.num_landmarks < max ? l.num_landmarks : max;
    for (int i = 0; i < n; ++i) {
        salida[i * 3] = l.landmarks[i].x;
        salida[i * 3 + 1] = l.landmarks[i].y;
        salida[i * 3 + 2] = l.landmarks[i].z;
    }
    return n;
}

EMSCRIPTEN_KEEPALIVE void xr_destruir() {
    if (g_vivo) XRSLAMDestroy();
    g_vivo = false;
}

} // extern "C"
