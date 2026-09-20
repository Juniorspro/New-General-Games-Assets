import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { loadFont } from "../load-font";
import { Barrido, Grano, Temblor, Vineta } from "../MortyEdit/efectos";
import { Tipografia } from "../Tipografia";

/**
 * El motor final: junta todo lo que se fue probando por separado.
 *
 *   clip -> camara lenta -> grade neon en el drop -> tipografia que invierte
 *   y se viene encima -> mascota difuminada detras -> destellos y temblor
 *
 * Es el unico que hay que usar para un video nuevo. Los anteriores quedan
 * como banco de pruebas de cada pieza.
 */

loadFont();

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

export const editCompletoSchema = z.object({
  clip: z.string(),
  musica: z.string(),
  velocidad: z.number().min(0.1).max(2),
  drop: z.number().int(),
  golpes: z.array(z.number().int()),
  palabras: z.array(z.object({ texto: z.string(), desde: z.number().int(), dura: z.number().int() })),
  mascota: z.string(),
});

export type EditCompletoProps = z.infer<typeof editCompletoSchema>;

export const DURACION_COMPLETO = 150; // 5 s: lo que da el clip a 0,4x

const cerca = (f: number, puntos: number[], caida: number) => {
  let v = 0;
  for (const p of puntos) {
    if (f >= p) v = Math.max(v, Math.max(0, 1 - (f - p) / caida));
  }
  return v;
};

const Firma: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 120,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "FirmaManuscrita, cursive",
          fontSize: 62,
          color: "#fff",
          opacity: 0.45 + Math.sin(f / 16) * 0.08,
          textShadow: "0 0 22px rgba(0,0,0,.6)",
        }}
      >
        ClaudEdits
      </div>
    </AbsoluteFill>
  );
};

export const EditCompleto: React.FC<EditCompletoProps> = ({
  clip,
  velocidad,
  drop,
  golpes,
  palabras,
  mascota,
}) => {
  const f = useCurrentFrame();
  const golpe = cerca(f, golpes, 10);
  const destello = cerca(f, golpes, 4) * 0.8;
  const esNeon = f >= drop;
  const zoom = 1.05 + f * 0.0006 + golpe * 0.07;

  const grade = esNeon
    ? "invert(1) hue-rotate(155deg) saturate(3.1) contrast(1.22) brightness(1.04)"
    : "saturate(1.14) contrast(1.08)";

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 1. el clip. El temblor envuelve SOLO al video: si envolviera tambien
             al texto, la tipografia perderia el fondo contra el que invierte. */}
      <Temblor fuerza={golpe * 14 + 1}>
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile(clip)}
            muted
            playbackRate={velocidad}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              filter: grade,
            }}
          />
        </AbsoluteFill>
        {esNeon ? (
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(200deg, rgba(255,0,200,.26) 0%, rgba(0,240,255,.19) 55%, rgba(120,255,60,.17) 100%)",
              mixBlendMode: "overlay",
            }}
          />
        ) : null}
      </Temblor>

      {/* 2. la mascota: chica y translucida, la cabeza arriba de la linea del
             texto, para que el video se siga leyendo alrededor */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img
          src={staticFile(mascota)}
          style={{
            // Sobre material movido y con detalle, 0.5 de opacidad es una
            // mancha. Con 0.3 se lee como profundidad y no tapa el aereo.
            width: "72%",
            marginTop: "-18%",
            filter: "blur(14px) brightness(1.06)",
            opacity: 0.3,
          }}
        />
      </AbsoluteFill>

      {/* 3. el texto, que invierte todo lo de arriba */}
      {palabras.map((p, i) => (
        <Sequence key={i} from={p.desde} durationInFrames={p.dura} name={p.texto}>
          <Tipografia texto={p.texto} duracion={p.dura} altura={62} tamano={124} />
        </Sequence>
      ))}

      <Vineta fuerza={0.6} />
      <Barrido />
      <Grano opacidad={0.05} />
      <Firma />

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: destello, pointerEvents: "none" }} />
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(f, [DURACION_COMPLETO - 16, DURACION_COMPLETO], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
