import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Barrido, Grano, Temblor, Vineta } from "../MortyEdit/efectos";

/**
 * Demostracion de la tecnica, sobre material propio.
 *
 * Es lo que hace un edit de TikTok y no tiene nada que ver con pegarle letras
 * encima a un video ya editado:
 *
 *  1. camara lenta de verdad (el clip se reproduce a 0,4x),
 *  2. un grade neon que entra EN el golpe y no antes,
 *  3. destellos blancos tapando cada corte,
 *  4. temblor y empuje colgados del mismo golpe,
 *  5. la firma en fuente manuscrita, centrada, viva todo el video.
 */

export const DURACION_TECNICA = 300; // 10 s a 30 fps

// Una sola vez: la fuente manuscrita de la firma.
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

/** Donde cae cada corte. El destello y el temblor salen de acá. */
const CORTES = [0, 84, 150, 216];
const ENTRA_NEON = 150; // el drop

const cerca = (f: number, puntos: number[], caida: number) => {
  let v = 0;
  for (const p of puntos) {
    if (f >= p) v = Math.max(v, Math.max(0, 1 - (f - p) / caida));
  }
  return v;
};

const Trozo: React.FC<{ archivo: string; neon: boolean }> = ({ archivo, neon }) => {
  const f = useCurrentFrame();
  const zoom = 1.06 + f * 0.0012;

  // El neon: invertir y girar el tono deja el magenta/cian del genero.
  // saturate alto porque invertir apaga mucho el color.
  const grade = neon
    ? "invert(1) hue-rotate(155deg) saturate(3.2) contrast(1.25) brightness(1.05)"
    : "saturate(1.15) contrast(1.08)";

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(archivo)}
          muted
          playbackRate={0.4}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            filter: grade,
          }}
        />
      </AbsoluteFill>
      {neon ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(200deg, rgba(255,0,200,.30) 0%, rgba(0,240,255,.22) 55%, rgba(120,255,60,.20) 100%)",
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** La firma: manuscrita, centrada, con respiracion. */
const FirmaManuscrita: React.FC = () => {
  const f = useCurrentFrame();
  const vivo = 0.5 + Math.sin(f / 16) * 0.1;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: "FirmaManuscrita, cursive",
          fontSize: 96,
          color: "#ffffff",
          opacity: vivo,
          letterSpacing: 1,
          textShadow: "0 0 26px rgba(0,0,0,.55), 0 4px 18px rgba(0,0,0,.45)",
        }}
      >
        ClaudEdits
      </div>
    </AbsoluteFill>
  );
};

export const Tecnica: React.FC = () => {
  const f = useCurrentFrame();
  const golpe = cerca(f, CORTES, 10);

  // El destello tapa el corte: sube de golpe y cae en tres cuadros.
  const destello = cerca(f, CORTES, 4) * 0.9;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Temblor fuerza={golpe * 16 + 1}>
        <Sequence from={0} durationInFrames={84} name="1">
          <Trozo archivo="t1.mp4" neon={false} />
        </Sequence>
        <Sequence from={84} durationInFrames={66} name="2">
          <Trozo archivo="t2.mp4" neon={false} />
        </Sequence>
        <Sequence from={ENTRA_NEON} durationInFrames={66} name="3-neon">
          <Trozo archivo="t3.mp4" neon />
        </Sequence>
        <Sequence from={216} durationInFrames={84} name="4-neon">
          <Trozo archivo="t1.mp4" neon />
        </Sequence>
      </Temblor>

      <Vineta fuerza={0.55} />
      <Barrido />
      <Grano opacidad={0.05} />
      <FirmaManuscrita />

      {/* los destellos, encima de todo */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: destello, pointerEvents: "none" }} />

      {/* cierre a negro */}
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(f, [DURACION_TECNICA - 18, DURACION_TECNICA], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
