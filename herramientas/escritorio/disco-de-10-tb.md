# El "disco de 10 TB": cómo se hace y por qué no lo uses

Sí se puede hacer que esta máquina muestre 10 TB. Tarda treinta segundos.
**Y es una mentira que corrompe datos en silencio.** Está medido acá el
2026-09-16, incluida la parte donde se rompe.

## Cómo se hace

```bash
truncate -s 10T /opt/almacen.img          # archivo disperso: 10 TB de direcciones, 0 bytes reales
mkfs.ext4 -q -m 0 -i 67108864 -O ^has_journal \
  -E lazy_itable_init=1,lazy_journal_init=1,nodiscard /opt/almacen.img
mkdir -p /mnt/almacen
mount -o loop /opt/almacen.img /mnt/almacen
df -h /mnt/almacen
```

```
/dev/loop0       10T   24K   10T   1% /mnt/almacen
```

Cuesta 144 MB de metadatos. El archivo es *sparse*: reserva 10 TB de
direcciones, no de bytes, y sólo ocupa lo que se le escriba encima.

## Por qué no sirve

**Porque abajo sigue estando el mismo disco de siempre.** Escribiendo 5 GB
adentro del volumen "de 10 TB":

| | antes | después |
|---|---|---|
| `/mnt/almacen` (el falso) | 10T libres | **10T libres** |
| `/` (el real) | 9,3 GB libres | **4,4 GB libres** |

El volumen no se entera de nada. Sigue diciendo que le sobran 10 TB mientras el
disco real se vacía debajo.

## La parte grave

Le pedí 6 GB más cuando quedaban 4,4 GB reales. Esto es lo que pasó:

```
codigo de salida: 0
```

**`dd` dijo que salió todo bien.** El volumen informó 11 GB escritos. Pero el
kernel, en `dmesg`:

```
EXT4-fs (loop0): failed to convert unwritten extents to written extents
                 -- potential data loss!  (inode 13, error -5)
```

O sea: **no falla, corrompe.** Un disco normal que se llena contesta
`No space left on device` y el programa se entera. Este acepta la escritura,
devuelve éxito, y los datos no están. Cualquier cosa que guardes ahí — un
render de Blender, un modelo, un backup — puede volver silenciosamente rota, y
no hay ningún error que lo delate hasta que abrís el archivo.

Encima deja la máquina al 100% y a partir de ahí falla todo lo demás: en la
prueba, hasta un `pwd` contestó `write error: No space left on device`.

Se recupera desmontando y borrando la imagen:

```bash
umount /mnt/almacen; rm -f /opt/almacen.img      # volvio a 9,4 GB al instante
```

## Lo que sí da capacidad de verdad

El límite real de esta máquina es una **cuota de ~38 GB**. `df` muestra 252 GB
porque ese es el disco del host, no lo tuyo: por eso "Avail" llega a 0 con
"Used" bajo. Ningún truco local lo cambia — el espacio no está.

Para guardar de verdad más de eso hay que sacar los datos de la máquina:

| opción | qué hace falta |
|---|---|
| **Cloudflare R2** + `rclone` | habilitar R2 en el panel (ya figura pendiente en el ARRANQUE) y el token de Cloudflare, que en esta sesión no está |
| cualquier S3 compatible | `apt install rclone` (1.60.1 disponible) y las credenciales |
| el repo | para lo chico y versionable, que es lo que ya se hace |

Eso sí da terabytes reales, se monta parecido y no miente: cuando no hay lugar,
avisa.
