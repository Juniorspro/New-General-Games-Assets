// Localizador vacío para la versión web de XRSLAM.
//
// El localizador original (xrslam/src/xrslam/localizer) manda imágenes por
// HTTP a un servidor que tiene un mapa previo del lugar, para ubicarse en él.
// Acá no hay tal servidor, y su código trae un cliente HTTP con sockets que
// no tiene sentido en una página. Este archivo lo reemplaza en la
// compilación web: misma interfaz, nunca se activa (el núcleo sólo lo crea
// si la configuración pide "visual_localization_enable").
#ifndef XRSLAM_LOCALIZER_H
#define XRSLAM_LOCALIZER_H

#include <Eigen/Eigen>
#include <memory>
#include <mutex>
#include <vector>
#include <xrslam/xrslam.h>

namespace xrslam {

enum ScreenState { Portrait, Down, Left, Right };

class Localizer {
  public:
    explicit Localizer(std::shared_ptr<Config>) {}
    ~Localizer() = default;
    void test_connection() {}
    void add_pose_message(const double, const Pose &) {}
    void send_pose() {}
    Pose transform(const Pose &pose) { return pose; }
    bool is_initialized() const { return false; }
    void query_frame() {}
    void query_localization(std::shared_ptr<xrslam::Image>, Pose) {}
    void send_pose_message(double) {}
};

} // namespace xrslam

#endif
