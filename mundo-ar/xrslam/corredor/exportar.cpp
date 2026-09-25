// Pasa una secuencia EuRoC a dos binarios que Node lee sin decodificar PNG:
//
//   cuadros.bin  "XRCU" · n · ancho · alto (int32) · por cuadro: t (double) + ancho×alto bytes
//   imu.bin      por muestra 7 doubles: t, wx, wy, wz, ax, ay, az
//
// Las imágenes salen SIN la distorsión del lente, igual que las recibe
// XRSLAM en el corredor nativo: así la versión web y la nativa ven lo mismo.
//
//   exportar <sensor.yaml> <carpeta mav0> <carpeta de salida>
#include <opencv2/calib3d.hpp>
#include <opencv2/core/persistence.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

#include <cstdint>
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

static std::vector<std::vector<std::string>> leerCsv(const std::string &ruta) {
    std::vector<std::vector<std::string>> filas;
    std::ifstream f(ruta);
    std::string linea;
    while (std::getline(f, linea)) {
        if (linea.empty() || linea[0] == '#') continue;
        if (linea.back() == '\r') linea.pop_back();
        std::vector<std::string> celdas;
        std::stringstream ss(linea);
        std::string c;
        while (std::getline(ss, c, ',')) celdas.push_back(c);
        filas.push_back(celdas);
    }
    return filas;
}

int main(int argc, char **argv) {
    if (argc < 4) { std::fprintf(stderr, "uso: exportar <sensor.yaml> <mav0> <salida>\n"); return 2; }
    const std::string mav0 = argv[2], dst = argv[3];
    cv::FileStorage fs(argv[1], cv::FileStorage::READ);
    cv::FileNode cam = fs["cam0"];
    std::vector<double> in, dist, res;
    cam["intrinsics"] >> in;
    cam["distortion"] >> dist;
    cam["resolution"] >> res;
    int conDist = (int)cam["camera_distortion_flag"];
    cv::Mat K = (cv::Mat_<double>(3, 3) << in[0], 0, in[2], 0, in[1], in[3], 0, 0, 1);
    cv::Mat D = (cv::Mat_<double>(4, 1) << dist[0], dist[1], dist[2], dist[3]);
    const int w = (int)res[0], h = (int)res[1];
    cv::Mat mx, my;
    if (conDist) cv::initUndistortRectifyMap(K, D, cv::Mat(), K, cv::Size(w, h), CV_32FC1, mx, my);

    auto imgs = leerCsv(mav0 + "/cam0/data.csv");
    FILE *fc = std::fopen((dst + "/cuadros.bin").c_str(), "wb");
    int32_t cab[4] = {0x55435258 /* "XRCU" */, (int32_t)imgs.size(), w, h};
    std::fwrite(cab, sizeof cab, 1, fc);
    for (auto &c : imgs) {
        double t = std::stod(c[0]) * 1e-9;
        cv::Mat g = cv::imread(mav0 + "/cam0/data/" + c[1], cv::IMREAD_GRAYSCALE);
        if (conDist) { cv::Mat r; cv::remap(g, r, mx, my, cv::INTER_LINEAR); g = r; }
        std::fwrite(&t, sizeof t, 1, fc);
        std::fwrite(g.data, 1, (size_t)w * h, fc);
    }
    std::fclose(fc);

    FILE *fi = std::fopen((dst + "/imu.bin").c_str(), "wb");
    auto imus = leerCsv(mav0 + "/imu0/data.csv");
    for (auto &c : imus) {
        double m[7] = {std::stod(c[0]) * 1e-9};
        for (int i = 1; i < 7; ++i) m[i] = std::stod(c[i]);
        std::fwrite(m, sizeof m, 1, fi);
    }
    std::fclose(fi);
    std::printf("%zu cuadros de %dx%d · %zu muestras de IMU\n", imgs.size(), w, h, imus.size());
    return 0;
}
