# Arma el MP4 desde los PNG ya renderizados, con el editor de video de Blender.
# Volver a renderizar con salida FFMPEG costaria los 6,5 minutos de nuevo; el
# secuenciador solo lee las imagenes y las codifica: segundos.
import bpy, os, glob

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
esc.sequence_editor_create()

archivos = sorted(glob.glob("/tmp/pelota/f_*.png"))
carpeta = os.path.dirname(archivos[0])
tira = esc.sequence_editor.sequences.new_image(
    name="pelota", filepath=archivos[0], channel=1, frame_start=1)
for a in archivos[1:]:
    tira.elements.append(os.path.basename(a))

esc.frame_start, esc.frame_end = 1, len(archivos)
esc.render.fps = 24
esc.render.resolution_x, esc.render.resolution_y = 800, 450
esc.render.image_settings.file_format = "FFMPEG"
esc.render.ffmpeg.format = "MPEG4"
esc.render.ffmpeg.codec = "H264"
esc.render.ffmpeg.constant_rate_factor = "HIGH"
esc.render.ffmpeg.ffmpeg_preset = "GOOD"
esc.render.filepath = "/tmp/pelota_video"
bpy.ops.render.render(animation=True)
print("VIDEO LISTO", len(archivos), "cuadros")
