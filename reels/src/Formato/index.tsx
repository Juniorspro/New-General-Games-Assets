import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "../load-font";
import { FondoBlanco, FondoTopografico } from "./fondos";

/**
 * El formato de video-comentario: narracion con subtitulo palabra por palabra,
 * la mascota reaccionando, y recortes que entran y salen.
 *
 * Todo sale de dos listas —el guion y los inserts—, asi que hacer un video
 * nuevo es escribir datos, no tocar el codigo.
 */

loadFont();

const insertSchema = z.object({
  tipo: z.enum(["sticker", "panel", "video"]),
  archivo: z.string(),
  desde: z.number().int(),
  dura: z.number().int(),
  /** Porcentaje del ancho/alto, 50 = centro. */
  x: z.number(),
  y: z.number(),
  ancho: z.number(),
  /** Inclinacion en grados, para que no quede todo derecho. */
  giro: z.number().default(0),
});

export const formatoSchema = z.object({
  fondo: z.enum(["blanco", "topografico"]),
  /** Una entrada por palabra: el subtitulo va de a una, sincronizado. */
  guion: z.array(z.object({ palabra: z.string(), desde: z.number().int() })),
  inserts: z.array(insertSchema),
  audio: z.string(),
});

export type FormatoProps = z.infer<typeof formatoSchema>;

/**
 * Reparte un texto en cuadros, a `porPalabra` cuadros cada una.
 * Sirve para arrancar: despues se corrigen a mano las que caen mal.
 */
export const repartir = (texto: string, desde: number, porPalabra = 11) =>
  texto
    .trim()
    .split(/\s+/)
    .map((palabra, i) => ({ palabra, desde: desde + i * porPalabra }));

/** El subtitulo: una palabra por vez, con el golpe de entrada. */
const Palabra: React.FC<{ texto: string }> = ({ texto }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ent = spring({ frame: f, fps, config: { damping: 12, mass: 0.35 } });
  // Entra apenas mas grande y se acomoda: es lo que le da el golpe.
  const escala = interpolate(ent, [0, 1], [1.35, 1]);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 430 }}>
      <div
        style={{
          fontFamily: "TheBoldFont, sans-serif",
          fontSize: 104,
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: -1,
          transform: `scale(${escala})`,
          WebkitTextStroke: "14px #000",
          paintOrder: "stroke fill",
          textShadow: "0 8px 0 rgba(0,0,0,.35)",
        }}
      >
        {texto}
      </div>
    </AbsoluteFill>
  );
};

/** Un recorte que entra de golpe: sticker, captura o video. */
const Insert: React.FC<{ i: z.infer<typeof insertSchema> }> = ({ i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ent = spring({ frame: f, fps, config: { damping: 11, mass: 0.4 } });
  const sale = interpolate(f, [i.dura - 7, i.dura], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const escala = interpolate(ent, [0, 1], [0.55, 1]) * (1 - sale * 0.25);
  const opac = (1 - sale) * interpolate(ent, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  const comun: React.CSSProperties = {
    width: `${i.ancho}%`,
    height: "auto",
    display: "block",
    // los paneles llevan marco; los stickers ya vienen recortados
    ...(i.tipo === "sticker"
      ? { filter: "drop-shadow(0 10px 22px rgba(0,0,0,.28))" }
      : {
          borderRadius: 18,
          boxShadow: "0 18px 50px rgba(0,0,0,.45)",
          border: "4px solid rgba(255,255,255,.9)",
        }),
  };

  return (
    <AbsoluteFill style={{ opacity: opac, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${i.x}%`,
          top: `${i.y}%`,
          width: "100%",
          transform: `translate(-50%, -50%) scale(${escala}) rotate(${i.giro}deg)`,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {i.tipo === "video" ? (
          <OffthreadVideo src={staticFile(i.archivo)} muted style={comun} />
        ) : (
          <Img src={staticFile(i.archivo)} style={comun} />
        )}
      </div>
    </AbsoluteFill>
  );
};

export const Formato: React.FC<FormatoProps> = ({ fondo, guion, inserts, audio: _audio }) => {
  return (
    <AbsoluteFill>
      {fondo === "blanco" ? <FondoBlanco /> : <FondoTopografico />}

      {inserts.map((i, n) => (
        <Sequence key={n} from={i.desde} durationInFrames={i.dura} name={`insert-${n}`}>
          <Insert i={i} />
        </Sequence>
      ))}

      {guion.map((g, n) => {
        const hasta = guion[n + 1]?.desde ?? g.desde + 12;
        return (
          <Sequence key={n} from={g.desde} durationInFrames={hasta - g.desde} name={g.palabra}>
            <Palabra texto={g.palabra} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
