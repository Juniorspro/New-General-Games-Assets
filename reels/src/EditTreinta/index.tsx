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
  useVideoConfig,
} from "remotion";
import { loadFont } from "../load-font";
import { ruido } from "../MortyEdit/efectos";
import { Tipografia } from "../Tipografia";

/**
 * Edit de 30 s sobre material propio, con los numeros de la RECETA.
 *
 * Los CORTES ya vienen hechos en la base (base30.mp4), concatenados en ffmpeg
 * sobre la grilla de 121,2 BPM: un corte cada 3 pulsos = 89 cuadros a 60 fps =
 * 0,67 cortes/s, que es el centro del rango medido para edits.
 *
 * Acá arriba va solo lo que el navegador hace mejor: texto que invierte el
 * fondo, destellos, temblor y firma. Una capa de video, no veinte.
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

export const FPS_30 = 60;
export const CORTE = 89;                  // cuadros entre corte y corte
export const PLANOS = 20;
export const DURACION_30 = CORTE * PLANOS; // 1780 cuadros ≈ 29,7 s

const GOLPES = Array.from({ length: PLANOS }, (_, i) => i * CORTE);

/**
 * El texto NO cae en todos los cortes.
 *
 * La referencia del oficio es clara: una paleta corta de recursos coordinados
 * manda mas que el truco en cada golpe. Con veinte cortes, ocho momentos de
 * texto dejan respirar; veinte serian ruido y ademas nadie llega a leerlos.
 * Cada uno dura 84 cuadros (1,4 s), suficiente para leerlo dos veces.
 */
const PALABRAS = [
  { texto: "TODO", golpe: 1 },
  { texto: "ESTO", golpe: 2 },
  { texto: "LO CORTO", golpe: 4 },
  { texto: "UNA MAQUINA", golpe: 6 },
  { texto: "SOBRE", golpe: 9 },
  { texto: "EL BEAT", golpe: 10 },
  { texto: "NO A OJO", golpe: 13 },
  { texto: "ClaudEdits", golpe: 17 },
];

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
        paddingTop: 130,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "FirmaManuscrita, cursive",
          fontSize: 58,
          color: "#fff",
          opacity: 0.38 + Math.sin(f / 34) * 0.06,
          textShadow: "0 0 24px rgba(0,0,0,.65)",
        }}
      >
        ClaudEdits
      </div>
    </AbsoluteFill>
  );
};

export const EditTreinta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const golpe = cerca(f, GOLPES, fps * 0.26);
  // El destello es CORTO: 0.1 s. Sostenido mas tiempo, quema el blanco y sube
  // el clipping, que es justo lo que la medicion marco como el problema.
  const destello = cerca(f, GOLPES, fps * 0.1) * 0.7;

  const tx = ruido(f, 1) * golpe * 11;
  const ty = ruido(f, 2) * golpe * 11;
  const giro = ruido(f, 3) * golpe * 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{ transform: `translate(${tx}px, ${ty}px) rotate(${giro}deg) scale(1.045)` }}
      >
        <OffthreadVideo
          src={staticFile("base30.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {PALABRAS.map((p, i) => (
        <Sequence
          key={i}
          from={p.golpe * CORTE + 4}
          durationInFrames={84}
          name={p.texto}
        >
          <Tipografia texto={p.texto} duracion={84} altura={63} tamano={118} />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.04,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundPosition: `${(f * 43) % 220}px ${(f * 61) % 220}px`,
        }}
      />

      <Firma />

      <AbsoluteFill
        style={{ backgroundColor: "#fff", opacity: destello, pointerEvents: "none" }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(f, [DURACION_30 - fps * 0.5, DURACION_30], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />

      <Audio src={staticFile("base30.m4a")} volume={0.92} />
    </AbsoluteFill>
  );
};
