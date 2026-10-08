// vorbis-opt ENTRADA SALIDA [ENTRADA SALIDA ...]: cada Ogg Vorbis rearmado con OptiVorbis. Los
// códigos de Huffman de cada libro de códigos pasan a ser los óptimos para ese archivo y se saca lo
// que no suena (comentarios, el texto del codificador): el audio decodificado es el mismo, muestra
// por muestra, y el archivo baja. Determinístico (sin números de serie al azar) para que el HTML
// único salga igual cada vez.
use std::fs::File;
use std::io::{BufReader, BufWriter};

use optivorbis::remuxer::ogg_to_ogg::Settings;
use optivorbis::{OggToOgg, Remuxer, VorbisCommentFieldsAction, VorbisOptimizerSettings, VorbisVendorStringAction};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() || args.len() % 2 != 0 {
        eprintln!("uso: vorbis-opt ENTRADA SALIDA [ENTRADA SALIDA ...]");
        std::process::exit(2);
    }
    let mut fallas = 0;
    for par in args.chunks(2) {
        let resultado = (|| -> Result<(), Box<dyn std::error::Error>> {
            let entrada = BufReader::new(File::open(&par[0])?);
            let mut salida = BufWriter::new(File::create(&par[1])?);
            let mut ajustes = Settings::default();
            ajustes.randomize_stream_serials = false;
            let mut optimizador = VorbisOptimizerSettings::default();
            optimizador.vendor_string_action = VorbisVendorStringAction::Empty;
            optimizador.comment_fields_action = VorbisCommentFieldsAction::Delete;
            OggToOgg::new(ajustes, optimizador).remux(entrada, &mut salida)?;
            Ok(())
        })();
        if let Err(e) = resultado {
            // el que no se puede (no es Vorbis, o algo raro) queda como estaba: lo decide quien llama
            eprintln!("{}: {}", par[0], e);
            let _ = std::fs::remove_file(&par[1]);
            fallas += 1;
        }
    }
    std::process::exit(if fallas > 0 { 1 } else { 0 });
}
