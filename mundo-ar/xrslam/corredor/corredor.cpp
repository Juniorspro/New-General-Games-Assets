// Corredor sin ventana de XRSLAM: lee una secuencia EuRoC (formato ASL), le
// pasa a XRSLAM la cámara y la IMU en orden de tiempo, y escribe la
// trayectoria del cuerpo en formato TUM (t x y z qx qy qz qw) más el tiempo
// que tardó cada cuadro.
//
//   corredor <slam.yaml> <sensor.yaml> <carpeta mav0> <salida.tum> [cuadros max]
#include <XRSLAM.h>

#include <xrslam/extra/yaml_config.h>

#include <opencv2/calib3d.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Imagen { double t; std::string archivo; };
struct Imu { double t; double w[3]; double a[3]; };

static std::vector<std::vector<std::string>> leerCsv(const std::string &ruta) {
    std::vector<std::vector<std::string>> filas;
    std::ifstream f(ruta);
    std::string linea;
    while (std::getline(f, linea)) {
        if (linea.empty() || linea[0] == '#') continue;
        if (!linea.empty() && linea.back() == '\r') linea.pop_back();
        std::vector<std::string> celdas;
        std::stringstream ss(linea);
        std::string c;
        while (std::getline(ss, c, ',')) celdas.push_back(c);
        filas.push_back(celdas);
    }
    return filas;
}

int main(int argc, char **argv) {
    if (argc < 5) {
        std::fprintf(stderr, "uso: corredor <slam.yaml> <sensor.yaml> <mav0> <salida.tum> [cuadros]\n");
        return 2;
    }
    const std::string mav0 = argv[3];
    const size_t tope = argc > 5 ? std::stoul(argv[5]) : SIZE_MAX;

    std::vector<Imagen> imagenes;
    for (auto &c : leerCsv(mav0 + "/cam0/data.csv"))
        imagenes.push_back({std::stod(c[0]) * 1e-9, mav0 + "/cam0/data/" + c[1]});
    std::vector<Imu> imus;
    for (auto &c : leerCsv(mav0 + "/imu0/data.csv")) {
        Imu m;
        m.t = std::stod(c[0]) * 1e-9;
        for (int i = 0; i < 3; ++i) { m.w[i] = std::stod(c[1 + i]); m.a[i] = std::stod(c[4 + i]); }
        imus.push_back(m);
    }
    if (imagenes.empty() || imus.empty()) {
        std::fprintf(stderr, "no encontré imágenes o IMU en %s\n", mav0.c_str());
        return 1;
    }

    void *config = nullptr;
    if (!XRSLAMCreate(argv[1], argv[2], "", "mundo-ar", &config)) {
        std::fprintf(stderr, "XRSLAMCreate falló\n");
        return 1;
    }

    // XRSLAM espera la imagen SIN la distorsión del lente (así lo hace su
    // reproductor). El mapa se calcula una vez y cada cuadro es un remap.
    auto *yaml = reinterpret_cast<xrslam::extra::YamlConfig *>(config);
    cv::Mat mapaX, mapaY;
    if (yaml->camera_distortion_flag()) {
        xrslam::vector<4> D = yaml->camera_distortion();
        xrslam::matrix<3> K = yaml->camera_intrinsic();
        xrslam::vector<2> res = yaml->camera_resolution();
        cv::Mat k = (cv::Mat_<double>(3, 3) << K(0, 0), K(0, 1), K(0, 2), K(1, 0), K(1, 1), K(1, 2), K(2, 0), K(2, 1), K(2, 2));
        cv::Mat d = (cv::Mat_<double>(4, 1) << D[0], D[1], D[2], D[3]);
        cv::initUndistortRectifyMap(k, d, cv::Mat(), k, cv::Size((int)res[0], (int)res[1]), CV_32FC1, mapaX, mapaY);
    }

    std::ofstream salida(argv[4]);
    salida.setf(std::ios::fixed);
    salida.precision(6);
    std::ofstream tiempos(std::string(argv[4]) + ".tiempos");
    size_t k = 0, bien = 0, cuadros = 0;
    double totalMs = 0, peorMs = 0;
    for (const Imagen &im : imagenes) {
        if (cuadros >= tope) break;
        cv::Mat gris = cv::imread(im.archivo, cv::IMREAD_GRAYSCALE);
        if (gris.empty()) { std::fprintf(stderr, "no pude leer %s\n", im.archivo.c_str()); continue; }
        if (!mapaX.empty()) { cv::Mat r; cv::remap(gris, r, mapaX, mapaY, cv::INTER_LINEAR); gris = r; }
        // El reloj abarca la IMU también: XRSLAM procesa una imagen recién
        // cuando le llega la IMU que la cubre, o sea adentro de estos envíos.
        auto t0 = std::chrono::steady_clock::now();
        // Toda la IMU hasta el momento de esta imagen, antes que la imagen.
        while (k < imus.size() && imus[k].t <= im.t) {
            XRSLAMGyroscope g{{imus[k].w[0], imus[k].w[1], imus[k].w[2]}, imus[k].t};
            XRSLAMAcceleration a{{imus[k].a[0], imus[k].a[1], imus[k].a[2]}, imus[k].t};
            XRSLAMPushSensorData(XRSLAM_SENSOR_GYROSCOPE, &g);
            XRSLAMPushSensorData(XRSLAM_SENSOR_ACCELERATION, &a);
            ++k;
        }
        XRSLAMImage x;
        x.camera_id = 0;
        x.timeStamp = im.t;
        x.ext = nullptr;
        x.data = gris.data;
        x.channel = 1;
        x.stride = (int)gris.step[0];
        XRSLAMPushSensorData(XRSLAM_SENSOR_CAMERA, &x);
        XRSLAMRunOneFrame();
        double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
        totalMs += ms; peorMs = std::max(peorMs, ms); ++cuadros;
        tiempos << im.t << " " << ms << "\n";

        XRSLAMState estado;
        XRSLAMGetResult(XRSLAM_RESULT_STATE, &estado);
        if (estado == XRSLAM_STATE_TRACKING_SUCCESS) {
            XRSLAMPose p;
            XRSLAMGetResult(XRSLAM_RESULT_BODY_POSE, &p);
            double nq = p.quaternion[0] * p.quaternion[0] + p.quaternion[1] * p.quaternion[1] +
                        p.quaternion[2] * p.quaternion[2] + p.quaternion[3] * p.quaternion[3];
            if (p.timestamp > 0 && nq > 0.5) {
                salida << p.timestamp << " " << p.translation[0] << " " << p.translation[1] << " " << p.translation[2] << " "
                       << p.quaternion[0] << " " << p.quaternion[1] << " " << p.quaternion[2] << " " << p.quaternion[3] << "\n";
                ++bien;
            }
        }
    }
    XRSLAMDestroy();
    std::printf("cuadros %zu · con pose %zu · %.1f ms de promedio · %.1f ms el peor\n", cuadros, bien,
                totalMs / std::max<size_t>(1, cuadros), peorMs);
    return 0;
}
