import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "../load-font";
import { ruido } from "../MortyEdit/efectos";
import { Tipografia } from "../Tipografia";

/**
 * Edit de pelea a 4K vertical, hecho con imagenes FIJAS.
 *
 * Todo el movimiento hay que fabricarlo: empuje de camara por toma, temblor
 * sobre los golpes, destellos tapando los cortes y lineas de velocidad. Una
 * foto quieta con un buen empuje se lee como plano filmado; una foto quieta
 * sin nada se lee como una foto.
 *
 * A 2160x3840 cada filtro cuesta cuatro veces mas que a 1080x1920, asi que el
 * desenfoque se usa con cuentagotas y las lineas de velocidad son un gradiente
 * conico y no una imagen.
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

export const FPS_BATALLA = 60;
export const DURACION_BATALLA = 360; // 6 s

export const editBatallaSchema = z.object({
  tomas: z.array(
    z.object({
      archivo: z.string(),
      desde: z.number().int(),
      dura: z.number().int(),
      /** Cuanto empuja la camara durante la toma. */
      zoomDesde: z.number(),
      zoomHasta: z.number(),
      /** Desplazamiento lateral en porcentaje, para que no sea solo escala. */
      panX: z.number(),
      panY: z.number(),
      /** Lineas de velocidad radiales encima. */
      velocidad: z.boolean(),
    }),
  ),
  golpes: z.array(z.number().int()),
  palabras: z.array(z.object({ texto: z.string(), desde: z.number().int(), dura: z.number().int() })),
});

export type EditBatallaProps = z.infer<typeof editBatallaSchema>;

const cerca = (f: number, puntos: number[], caida: number) => {
  let v = 0;
  for (const p of puntos) {
    if (f >= p) v = Math.max(v, Math.max(0, 1 - (f - p) / caida));
  }
  return v;
};

/** Lineas de velocidad radiales, dibujadas con un gradiente conico. */
const Velocidad: React.FC<{ fuerza: number }> = ({ fuerza }) => {
  const f = useCurrentFrame();
  if (fuerza < 0.01) return null;
  const rayas = Array.from({ length: 36 }, (_, i) =>
    `transparent ${i * 10}deg, rgba(255,255,255,.55) ${i * 10 + 1.2}deg, transparent ${i * 10 + 2.4}deg`,
  ).join(", ");
  return (
    <AbsoluteFill
      style={{
        opacity: fuerza * 0.5,
        pointerEvents: "none",
        background: `conic-gradient(from ${f * 0.6}deg at 50% 46%, ${rayas})`,
        // el centro limpio: las lineas nacen afuera y no tapan al personaje
        WebkitMaskImage:
          "radial-gradient(circle at 50% 46%, transparent 26%, black 62%)",
        maskImage: "radial-gradient(circle at 50% 46%, transparent 26%, black 62%)",
      }}
    />
  );
};

/** Una toma: la imagen fija con su empuje de camara. */
const Toma: React.FC<{ t: EditBatallaProps["tomas"][0] }> = ({ t }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, t.dura], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const escala = interpolate(p, [0, 1], [t.zoomDesde, t.zoomHasta]);
  const x = interpolate(p, [0, 1], [0, t.panX]);
  const y = interpolate(p, [0, 1], [0, t.panY]);

  // Entrada: un pestañeo de sobreexposicion en los primeros cuadros.
  const entra = interpolate(f, [0, 5], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#05060a" }}>
      <Img
        src={staticFile(t.archivo)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${escala}) translate(${x}%, ${y}%)`,
          filter: "contrast(1.12) saturate(1.22)",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: entra * 0.55 }} />
    </AbsoluteFill>
  );
};

export const EditBatalla: React.FC<EditBatallaProps> = ({ tomas, golpes, palabras }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const golpe = cerca(f, golpes, fps * 0.3);
  const destello = cerca(f, golpes, fps * 0.1) * 0.85;

  // El temblor: dos ruidos distintos para que no oscile en diagonal.
  const tx = ruido(f, 1) * golpe * 26;
  const ty = ruido(f, 2) * golpe * 26;
  const giro = ruido(f, 3) * golpe * 1.1;

  const tomaViva = tomas.find((t) => f >= t.desde && f < t.desde + t.dura);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{ transform: `translate(${tx}px, ${ty}px) rotate(${giro}deg) scale(1.06)` }}
      >
        {tomas.map((t, i) => (
          <Sequence key={i} from={t.desde} durationInFrames={t.dura} name={`toma-${i}`}>
            <Toma t={t} />
          </Sequence>
        ))}
        {tomaViva?.velocidad ? <Velocidad fuerza={0.35 + golpe * 0.65} /> : null}
      </AbsoluteFill>

      {palabras.map((p, i) => (
        <Sequence key={i} from={p.desde} durationInFrames={p.dura} name={p.texto}>
          <Tipografia texto={p.texto} duracion={p.dura} altura={64} tamano={230} />
        </Sequence>
      ))}

      {/* viñeta y grano propios, a escala 4K */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,.72) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.045,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundPosition: `${(f * 41) % 300}px ${(f * 59) % 300}px`,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 220,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "FirmaManuscrita, cursive",
            fontSize: 120,
            color: "#fff",
            opacity: 0.4 + Math.sin(f / 32) * 0.07,
            textShadow: "0 0 40px rgba(0,0,0,.7)",
          }}
        >
          ClaudEdits
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: destello, pointerEvents: "none" }} />
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(
            f,
            [DURACION_BATALLA - fps * 0.3, DURACION_BATALLA],
            [0, 1],
            { extrapolateLeft: "clamp" },
          ),
        }}
      />
    </AbsoluteFill>
  );
};
