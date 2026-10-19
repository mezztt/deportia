import type { ReactNode } from "react";

/**
 * Cancha vista desde arriba, según el deporte.
 * Se usa en el panel (chips de deportes) y después en el módulo Canchas
 * y en la web de reservas (con color según estado: libre / reservada / ocupada).
 */
interface CourtIconProps {
  sport: string;
  width?: number;
  /** color de fondo del césped / piso */
  fill?: string;
  /** color de las líneas */
  stroke?: string;
}

const DEFAULT_FILLS: Record<string, string> = {
  futbol: "#3f8f4e",
  padel: "#2f6fa3",
  tenis: "#c0673d",
  basquet: "#c98a4b",
  voley: "#d6a64a",
  hockey: "#2f7d74",
};

function CourtIcon({ sport, width = 64, fill, stroke = "#ffffff" }: CourtIconProps) {
  const W = 120;
  const H = 76;
  const bg = fill || DEFAULT_FILLS[sport] || "#3f8f4e";
  const sw = 1.6;
  const common = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" as const };

  let lines: ReactNode = null;

  switch (sport) {
    case "futbol":
      lines = (
        <>
          <rect x={6} y={6} width={108} height={64} {...common} />
          <line x1={60} y1={6} x2={60} y2={70} {...common} />
          <circle cx={60} cy={38} r={10} {...common} />
          <rect x={6} y={22} width={16} height={32} {...common} />
          <rect x={98} y={22} width={16} height={32} {...common} />
          <rect x={6} y={30} width={6} height={16} {...common} />
          <rect x={108} y={30} width={6} height={16} {...common} />
        </>
      );
      break;
    case "padel":
      lines = (
        <>
          <rect x={10} y={10} width={100} height={56} {...common} />
          <line x1={60} y1={6} x2={60} y2={70} {...common} strokeWidth={2.4} />
          <line x1={32} y1={10} x2={32} y2={66} {...common} />
          <line x1={88} y1={10} x2={88} y2={66} {...common} />
          <line x1={32} y1={38} x2={88} y2={38} {...common} />
        </>
      );
      break;
    case "tenis":
      lines = (
        <>
          <rect x={8} y={8} width={104} height={60} {...common} />
          <line x1={8} y1={16} x2={112} y2={16} {...common} />
          <line x1={8} y1={60} x2={112} y2={60} {...common} />
          <line x1={60} y1={4} x2={60} y2={72} {...common} strokeWidth={2.4} />
          <line x1={34} y1={16} x2={34} y2={60} {...common} />
          <line x1={86} y1={16} x2={86} y2={60} {...common} />
          <line x1={34} y1={38} x2={86} y2={38} {...common} />
        </>
      );
      break;
    case "basquet":
      lines = (
        <>
          <rect x={6} y={6} width={108} height={64} {...common} />
          <line x1={60} y1={6} x2={60} y2={70} {...common} />
          <circle cx={60} cy={38} r={8} {...common} />
          <rect x={6} y={28} width={20} height={20} {...common} />
          <rect x={94} y={28} width={20} height={20} {...common} />
          <path d="M6 14 A 30 24 0 0 1 6 62" {...common} />
          <path d="M114 14 A 30 24 0 0 0 114 62" {...common} />
        </>
      );
      break;
    case "voley":
      lines = (
        <>
          <rect x={12} y={10} width={96} height={56} {...common} />
          <line x1={60} y1={6} x2={60} y2={70} {...common} strokeWidth={2.4} />
          <line x1={44} y1={10} x2={44} y2={66} {...common} />
          <line x1={76} y1={10} x2={76} y2={66} {...common} />
        </>
      );
      break;
    case "hockey":
      lines = (
        <>
          <rect x={6} y={6} width={108} height={64} {...common} />
          <line x1={60} y1={6} x2={60} y2={70} {...common} />
          <line x1={33} y1={6} x2={33} y2={70} {...common} strokeDasharray="3 3" />
          <line x1={87} y1={6} x2={87} y2={70} {...common} strokeDasharray="3 3" />
          <path d="M6 20 A 18 18 0 0 1 6 56" {...common} />
          <path d="M114 20 A 18 18 0 0 0 114 56" {...common} />
        </>
      );
      break;
    default:
      lines = (
        <>
          <rect x={8} y={8} width={104} height={60} {...common} />
          <line x1={60} y1={8} x2={60} y2={68} {...common} />
        </>
      );
  }

  return (
    <svg
      width={width}
      height={(width * H) / W}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cancha de ${sport}`}
      style={{ display: "block", borderRadius: 6 }}
    >
      <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} />
      {lines}
    </svg>
  );
}

export default CourtIcon;
