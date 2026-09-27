// lee w*h píxeles BGRA (w y h múltiplos de 4) por stdin y escribe los bloques ETC2 RGB por stdout
#include <cstddef>
#include <cstdint>
#include "ProcessRGB.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <vector>
int main(int argc, char** argv){
  if(argc < 3) return 2; const int w = atoi(argv[1]), h = atoi(argv[2]);
  std::vector<uint32_t> px((size_t)w*h); if(fread(px.data(), 4, px.size(), stdin) != px.size()) return 3;
  std::vector<uint64_t> out((size_t)w*h/16);
  CompressEtc2Rgb(px.data(), out.data(), (uint32_t)out.size(), w, false);
  fwrite(out.data(), 8, out.size(), stdout); return 0; }
