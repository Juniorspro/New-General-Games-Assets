# spdlog para la web: 1.14.1 en lugar del 1.3.1 que fija XRSLAM. El fmt que
# trae el 1.3.1 usa std::char_traits de un tipo propio, y la libc++ de
# Emscripten ya no lo acepta. XRSLAM usa spdlog en un solo lugar (debug.cpp).
if(NOT TARGET depends::spdlog)
  FetchContent_Declare(
    depends-spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG        v1.14.1
  )
  FetchContent_GetProperties(depends-spdlog)
  if(NOT depends-spdlog_POPULATED)
    FetchContent_Populate(depends-spdlog)
  endif()
  set(SPDLOG_BUILD_EXAMPLE OFF CACHE BOOL "" FORCE)
  add_subdirectory(${depends-spdlog_SOURCE_DIR} ${depends-spdlog_BINARY_DIR})
  add_library(depends::spdlog INTERFACE IMPORTED GLOBAL)
  target_link_libraries(depends::spdlog INTERFACE spdlog::spdlog options::modern-cpp)
endif()
