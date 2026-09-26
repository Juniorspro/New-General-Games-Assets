# XRSLAM para Mundo AR: toma la biblioteca de XRSLAM (openxrlab/xrslam,
# Apache-2.0) desde afuera del repo (XRSLAM_SRC) y arma sólo lo que hace falta:
# el núcleo, la interfaz en C y nuestro corredor sin ventana. El reproductor
# original pide GLFW/OpenGL y no se arma.
cmake_minimum_required(VERSION 3.13 FATAL_ERROR)
project(mundo-ar-xrslam CXX)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
if(NOT XRSLAM_SRC)
  message(FATAL_ERROR "Falta -DXRSLAM_SRC=<carpeta de openxrlab/xrslam>")
endif()
set(XR ${XRSLAM_SRC})

# Las macros "superbuild" de XRSLAM buscan cmake/ en CMAKE_SOURCE_DIR; acá
# apuntan al árbol de XRSLAM (se definen antes: las suyas sólo se definen si
# no existen).
function(superbuild_option n)
  include("${XR}/cmake/options/${n}.cmake")
endfunction()
function(superbuild_depend n)
  include("${XR}/cmake/depends/${n}.cmake")
endfunction()
function(superbuild_extern n)
  include("${XR}/cmake/external/${n}.cmake")
endfunction()
list(APPEND CMAKE_MODULE_PATH "${XR}/cmake/Modules")
include(FetchContent)

superbuild_option(cpp17)
superbuild_option(modern-cpp)

if(EMSCRIPTEN)
  # ── versión web ──
  # OpenCV: el mínimo compilado a wasm (opencv-wasm.sh), declarado a mano
  # porque find_package no busca fuera del sysroot de Emscripten.
  if(NOT OPENCV_WASM)
    message(FATAL_ERROR "Falta -DOPENCV_WASM=<instalación de opencv-wasm.sh>")
  endif()
  add_library(depends::opencv INTERFACE IMPORTED GLOBAL)
  target_include_directories(depends::opencv INTERFACE ${OPENCV_WASM}/include/opencv4)
  foreach(m video calib3d features2d flann imgproc core)
    target_link_libraries(depends::opencv INTERFACE ${OPENCV_WASM}/lib/libopencv_${m}.a)
  endforeach()
  file(GLOB zlib_wasm ${OPENCV_WASM}/lib/opencv4/3rdparty/libzlib.a)
  target_link_libraries(depends::opencv INTERFACE ${zlib_wasm})
  # Ceres: el mismo commit que pide XRSLAM, sin hilos (el navegador no tiene
  # std::thread sin SharedArrayBuffer) y sin LAPACK.
  superbuild_depend(eigen)
  include(${CMAKE_CURRENT_SOURCE_DIR}/web/ceres-web.cmake)
  include(${CMAKE_CURRENT_SOURCE_DIR}/web/spdlog-web.cmake)
endif()
option(XRSLAM_DEBUG "..." OFF)
option(XRSLAM_ENABLE_DEBUG_INSPECTION "..." OFF)
option(XRSLAM_ENABLE_THREADING "..." OFF)

add_subdirectory(${XR}/xrslam xrslam)
add_subdirectory(${XR}/xrslam-extra xrslam-extra)
# La interfaz en C se arma acá: su CMakeLists copia archivos a CMAKE_SOURCE_DIR
# (que sería este repo).
add_library(xrslam STATIC
  ${XR}/xrslam-interface/src/XRSLAMInternal.cpp
  ${XR}/xrslam-interface/src/XRSLAMManager.cpp)
target_include_directories(xrslam PUBLIC ${XR}/xrslam-interface/include PRIVATE ${XR}/xrslam-interface/src ${XR}/xrslam/src)
target_link_libraries(xrslam PUBLIC xrslam-extra-opencv-image xrslam-extra-yaml-config)

if(EMSCRIPTEN)
  # El localizador original habla HTTP con un servidor de mapas: afuera.
  get_target_property(fuentes xrslam-core SOURCES)
  list(FILTER fuentes EXCLUDE REGEX "localizer/localizer\\.cpp$")
  set_property(TARGET xrslam-core PROPERTY SOURCES ${fuentes})
  target_include_directories(xrslam-core BEFORE PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/web/sin-localizador)

  add_executable(xrslam-web web/puente.cpp)
  target_link_libraries(xrslam-web PRIVATE xrslam)
  set_target_properties(xrslam-web PROPERTIES OUTPUT_NAME xrslam SUFFIX ".mjs")
  target_link_options(xrslam-web PRIVATE
    -O3 -msimd128 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=XRSLAM
    -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB
    # La pila de Emscripten es de 64 KB; Ceres y Eigen ponen matrices grandes
    # en la pila (Linux da 8 MB): con 64 KB se pisa la memoria.
    -sSTACK_SIZE=8MB
    -sEXPORTED_FUNCTIONS=_xr_crear,_xr_imu,_xr_giro,_xr_acel,_xr_imagen,_xr_estado,_xr_pose,_xr_puntos,_xr_destruir,_malloc,_free
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPF64,stringToNewUTF8)
else()
  add_executable(corredor corredor/corredor.cpp)
  target_link_libraries(corredor PRIVATE xrslam depends::opencv)
  add_executable(exportar corredor/exportar.cpp)
  target_link_libraries(exportar PRIVATE depends::opencv)
endif()
