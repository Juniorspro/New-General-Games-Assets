/* La capa propia: lo que reemplaza a cocos2d, libc y Android debajo del código traducido. */
#pragma once
#include "aos.h"
#include <stddef.h>

/* mem.c */
void aos_heap_init(void);
u64 aos_malloc(u64 n);
void aos_free(u64 p);
u64 aos_realloc(u64 p, u64 n);
u64 aos_calloc(u64 a, u64 b);
u64 aos_memalign(u64 al, u64 n);
u64 aos_malloc_size(u64 p);
void aos_heap_stats(u64 *usados, u64 *pico, u64 *tope);

/* hle_libc.c */
size_t aos_formatear(char *out, size_t cap, u64 fmt, int gr);

/* hle_cocos.c */
void aos_cocos_init(void);
u64 aos_string_nueva(const char *s);           /* std::string (COW de gnustl) en memoria del juego */
void aos_string_en(u64 dst, const char *s);    /* construye un std::string en dst */
const char *aos_string_c(u64 strobj);          /* el char* de un std::string */
void aos_string_liberar(u64 strobj);

/* El anfitrión: JavaScript en la web, nativo.c en las pruebas. */
void aos_log(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
u64 aos_ahora_ms(void);                        /* reloj de pared, milisegundos */
void aos_hora_local(s64 t, int tm[9]);         /* sec, min, hour, mday, mon, year-1900, wday, yday, isdst */
int aos_imagen(const char *ruta, int *w, int *h); /* id de la imagen (>=0) o -1 */
void aos_imagen_pedida(int img);               /* el juego cargó la imagen: se acomoda en el atlas (tablas.c) */
/* el anfitrión decodifica el WebP (off, len) de datos/imagenes.bin y lo sube a la página del atlas en x, y;
 * mientras haya alguna sin subir, el juego espera (como el original, que cargaba en el hilo de GL) */
void aos_imagen_subir(int img, int pagina, int x, int y, u32 off, u32 len);
void aos_atlas_vaciar(void);                   /* se tiran todas las páginas: se vuelve a subir lo que se use */
int aos_sonido_tocar(const char *ruta, int bucle, float volumen); /* id */
void aos_sonido_parar(int id);
void aos_sonido_todo(int que);                 /* 0 parar, 1 pausar, 2 seguir */
void aos_sonido_cargar(const char *ruta);
int aos_archivo_leer(const char *nombre, u8 **datos, u32 *largo); /* 1 si existe; *datos con malloc del anfitrión */
void aos_archivo_escribir(const char *nombre, const u8 *datos, u32 largo);
const char *aos_dato_texto(const char *clave);              /* NULL si no está */
void aos_dato_poner_texto(const char *clave, const char *v);
void aos_vibrar(int ms);
