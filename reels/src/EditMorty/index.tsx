import React from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { Barrido, Grano, Temblor, Vineta } from "../MortyEdit/efectos";
import { TextoPerspectiva } from "../MortyEdit/TextoPerspectiva";

/**
 * El edit completo, parametrizado.
 *
 * No trae material propio: se le pasa el clip y sale el video. La idea es que
 * cambiar de escena no sea rehacer nada, sino cambiar una linea:
 *
 *   npx remotion render EditMorty out/morty.mp4 \
 *     --props='{"clip":"mi-escena.mp4","musica":"tema.m4a","titulo":"EVIL\nMORTY"}'
 *
 * Todo lo que un edit necesita esta acá adentro y ya probado: camara lenta,
 * el grade neon entrando en el drop, destellos tapando los cortes, temblor y
 * empuje colgados del mismo golpe, texto en perspectiva y la firma.
 */

export const editMortySchema = z.object({
  /** Archivo dentro de public/. Es LO UNICO que hay que cambiar por escena. */
  clip: z.string(),
  /** Musica, tambien dentro de public/. Vacio = sin musica. */
  musica: z.string(),
  /** Velocidad del clip. 0,4 es la camara lenta de los edits; 1 la deja normal. */
  velocidad: z.number().min(0.1).max(2),
  /** Cuadro donde entra el grade neon. Ahi tiene que caer el drop del tema. */
  drop: z.number().int(),
  /** Cuadros donde cae cada corte: destello, temblor y tiron de zoom. */
  golpes: z.array(z.number().int()),
  titulo: z.string(),
  remate: z.string(),
  colorTitulo: z.string(),
  colorRemate: z.string(),
});

export type EditMortyProps = z.infer<typeof editMortySchema>;

export const DURACION_EDIT = 360; // 12 s a 30 fps

// Fuente manuscrita de la firma, una sola vez.
let cargada = false;
const cargarFirma = async () => {
  if (cargada) return;
  cargada = true;
  const espera = delayRender();
  const f = new FontFace("FirmaManuscrita", `url('${staticFile("firma.ttf")}')`);
  await f.load();
  document.fonts.add(f);
  continueRender(espera);
};
cargarFirma();

/** 1 justo en el golpe, cayendo en `caida` cuadros. */
const cerca = (f: number, puntos: number[], caida: number) => {
  let v = 0;
  for (const p of puntos) {
    if (f >= p) v = Math.max(v, Math.max(0, 1 - (f - p) / caida));
  }
  return v;
};

/** La firma manuscrita, centrada y respirando. */
const Firma: React.FC = () => {
  const f = useCurrentFrame();
  const vivo = 0.5 + Math.sin(f / 16) * 0.1;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: "FirmaManuscrita, cursive",
          fontSize: 96,
          color: "#fff",
          opacity: vivo,
          textShadow: "0 0 26px rgba(0,0,0,.55), 0 4px 18px rgba(0,0,0,.45)",
        }}
      >
        ClaudEdits
      </div>
    </AbsoluteFill>
  );
};

export const EditMorty: React.FC<EditMortyProps> = ({
  clip,
  musica,
  velocidad,
  drop,
  golpes,
  titulo,
  remate,
  colorTitulo,
  colorRemate,
}) => {
  const f = useCurrentFrame();
  const golpe = cerca(f, golpes, 10);
  const destello = cerca(f, golpes, 4) * 0.85;
  const esNeon = f >= drop;

  // El empuje es continuo y ademas tira en cada golpe.
  const zoom = 1.05 + f * 0.0006 + golpe * 0.07;

  // Invertir y girar el tono deja el magenta/cian del genero. La saturacion
  // va alta porque invertir apaga mucho el color.
  const grade = esNeon
    ? "invert(1) hue-rotate(155deg) saturate(3.2) contrast(1.25) brightness(1.05)"
    : "saturate(1.12) contrast(1.06)";

  const src = staticFile(clip);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Temblor fuerza={golpe * 15 + 1}>
        {/* relleno borroso: llena el 9:16 si el clip no es vertical */}
        <AbsoluteFill>
          <OffthreadVideo
            src={src}
            muted
            playbackRate={velocidad}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.3)",
              filter: `blur(44px) brightness(0.4) ${grade}`,
            }}
          />
        </AbsoluteFill>

        {/* el clip, respetando su proporcion */}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <OffthreadVideo
            src={src}
            muted
            playbackRate={velocidad}
            style={{
              width: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${zoom})`,
              filter: grade,
            }}
          />
        </AbsoluteFill>

        {esNeon ? (
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(200deg, rgba(255,0,200,.28) 0%, rgba(0,240,255,.20) 55%, rgba(120,255,60,.18) 100%)",
              mixBlendMode: "overlay",
            }}
          />
        ) : null}
      </Temblor>

      <Sequence from={golpes[1] ?? 60} durationInFrames={72} name="titulo">
        <TextoPerspectiva
          texto={titulo}
          desde="izquierda"
          color={colorTitulo}
          tamano={180}
          y={-460}
          duracion={72}
        />
      </Sequence>

      <Sequence from={drop + 24} durationInFrames={66} name="remate">
        <TextoPerspectiva
          texto={remate}
          desde="derecha"
          color={colorRemate}
          tamano={112}
          y={450}
          duracion={66}
        />
      </Sequence>

      <Vineta fuerza={0.58} />
      <Barrido />
      <Grano opacidad={0.05} />
      <Firma />

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: destello, pointerEvents: "none" }} />

      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(f, [DURACION_EDIT - 18, DURACION_EDIT], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />

      {musica ? <Audio src={staticFile(musica)} volume={0.85} /> : null}
    </AbsoluteFill>
  );
};
