// Tipos y helpers compartidos del módulo Torneos (pantalla del complejo y página pública)
import { hhmm, SPORT_LABELS } from "../../config";

export type TournamentFormat = "LIGA" | "ELIMINACION" | "GRUPOS";
export type TournamentStatus = "BORRADOR" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";
export type MatchStatus = "PENDIENTE" | "EN_JUEGO" | "ENTRETIEMPO" | "JUGADO" | "WO" | "SUSPENDIDO";
/** GOLES (fútbol, hockey) · PUNTOS (básquet) · SETS (pádel, tenis, vóley) */
export type Scoring = "GOLES" | "PUNTOS" | "SETS";
export type Tiebreaker = "DIF" | "GF" | "H2H";

export interface TournamentSummary {
  id: number; name: string; sport: string; format: TournamentFormat; double_round: boolean;
  status: TournamentStatus; starts_on: string | null; ends_on: string | null;
  points_win: number; points_draw: number; points_loss: number; allow_draw: boolean;
  entry_fee?: number; notes?: string | null; court_ids?: number[]; prizes: string | null; match_minutes: number | null;
  tiebreakers: Tiebreaker[]; third_place: boolean; groups_count: number | null; qualify_per_group: number | null;
  scoring: Scoring; finished_at: string | null;
  teams_count: number; matches_count: number; played_count: number;
  champion: string | null; live_count: number;
  /** solo en la lista */
  unpaid_teams?: number; next_match_at?: string | null;
}

export interface TournamentPlayer { id: number; name: string; number: number | null }

export interface TournamentTeam {
  id: number; name: string; color: string | null; group_name: string | null; players: TournamentPlayer[];
  contact_name?: string | null; contact_phone?: string | null;
  paid?: boolean; paid_amount?: number | null; paid_at?: string | null;
}

export interface TournamentEvent {
  id: number; match_id: number | null; type: string; team_id: number | null; team: string | null;
  player_name: string | null; minute: number | null; period: number | null; value: number; detail: string | null; at: string | null;
  user_name?: string | null; voided?: boolean; voided_by?: string | null; voided_at?: string | null;
}

export interface TournamentMatch {
  id: number; stage: "LIGA" | "GRUPOS" | "LLAVE" | "TERCERO"; group_name: string | null;
  round: number; order: number; round_label: string;
  home_team_id: number | null; home_team: string | null; away_team_id: number | null; away_team: string | null;
  home_label: string | null; away_label: string | null;
  court_id: number | null; court_name: string | null; start_at: string | null; duration_minutes: number | null;
  booking_id: number | null; home_score: number | null; away_score: number | null;
  home_pens: number | null; away_pens: number | null; sets: number[][]; current_set: number[] | null;
  status: MatchStatus; winner_team_id: number | null; is_bye: boolean; needs_winner: boolean;
  period: number | null; clock_seconds: number; clock_running: boolean;
  started_at: string | null; finished_at: string | null; notes: string | null;
  events: TournamentEvent[];
  edited?: { by: string | null; at: string; detail: string | null } | null;
}

export interface StandingRow {
  position: number; team_id: number; team: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; dif: number; pts: number;
}

export interface NextAction { key: "equipos" | "fixture" | "programar" | "jugar" | "fixture_ver" | "cerrar"; label: string; hint: string; match_id?: number }

export interface TournamentDetail extends TournamentSummary {
  now: string;
  runner_up: string | null; third: string | null; champion_team_id: number | null;
  teams: TournamentTeam[]; matches: TournamentMatch[]; standings: StandingRow[];
  groups: { name: string; standings: StandingRow[] }[];
  scorers: { player: string; team_id: number; team: string | null; goals: number }[];
  cards: { player: string; team_id: number; team: string | null; yellow: number; red: number }[];
  defense: { team_id: number; team: string; pj: number; gc: number; avg: number }[];
  // solo adentro del sistema
  summary?: {
    teams: number; matches_total: number; matches_played: number; goals: number; collected: number;
    pending_amount: number; unpaid_teams: number; unscheduled: number; next_match_id: number | null;
  };
  next_action?: NextAction | null;
  log?: TournamentEvent[];
  scheduled?: number; not_scheduled?: number;
}

export const STATUS_PILL: Record<string, { label: string; tone: string }> = {
  BORRADOR: { label: "En preparación", tone: "gray" },
  EN_CURSO: { label: "En curso", tone: "green" },
  FINALIZADO: { label: "Finalizado", tone: "blue" },
  CANCELADO: { label: "Cancelado", tone: "red" },
};

export const FORMAT_LABEL: Record<string, string> = {
  LIGA: "Liga", ELIMINACION: "Eliminación directa", GRUPOS: "Grupos + eliminación",
};

export const MATCH_STATUS: Record<string, { label: string; tone: string }> = {
  PENDIENTE: { label: "Por jugar", tone: "gray" },
  EN_JUEGO: { label: "En juego", tone: "red" },
  ENTRETIEMPO: { label: "Entretiempo", tone: "orange" },
  JUGADO: { label: "Final", tone: "green" },
  WO: { label: "W.O.", tone: "blue" },
  SUSPENDIDO: { label: "Suspendido", tone: "orange" },
};

export const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  DIF: "Diferencia de gol", GF: "Goles a favor", H2H: "Resultado entre sí",
};

/** Deportes sin empate y con otro tipo de marcador (igual que el servidor) */
export function scoringOf(sport: string): Scoring {
  if (["padel", "tenis", "voley"].includes(sport)) return "SETS";
  if (sport === "basquet") return "PUNTOS";
  return "GOLES";
}

/** Cómo se llama lo que se suma en cada deporte */
export function scoreWords(scoring: Scoring, sport: string): { one: string; many: string; plus: string; scorers: string } {
  if (scoring === "PUNTOS") return { one: "punto", many: "Puntos", plus: "PUNTO", scorers: "Anotadores" };
  if (scoring === "SETS") {
    const game = sport === "voley" ? "punto" : "game";
    return { one: game, many: "Sets", plus: game.toUpperCase(), scorers: "" };
  }
  return { one: "gol", many: "Goles", plus: "GOL", scorers: "Goleadores" };
}

export const isLive = (m: TournamentMatch) => m.status === "EN_JUEGO" || m.status === "ENTRETIEMPO";
export const isDone = (m: TournamentMatch) => m.status === "JUGADO" || m.status === "WO";

export function teamLabel(m: TournamentMatch, side: "home" | "away"): string {
  const name = side === "home" ? m.home_team : m.away_team;
  if (name) return name;
  const label = side === "home" ? m.home_label : m.away_label;
  if (label) return label;
  return m.is_bye ? "—" : "A definir";
}

/** "2 - 1", "2 - 2 (4-3 pen.)", "vs", "W.O." */
export function scoreText(m: TournamentMatch): string {
  if (m.is_bye) return "Pasa directo";
  if (m.status === "PENDIENTE" || m.status === "SUSPENDIDO") {
    return m.status === "SUSPENDIDO" && m.started_at ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : "vs";
  }
  if (m.status === "WO" && m.home_score === null) return "W.O.";
  return `${m.home_score ?? 0} - ${m.away_score ?? 0}`;
}

/** Aclaración del resultado: penales, sets, W.O. */
export function scoreNote(m: TournamentMatch): string {
  const bits: string[] = [];
  if (m.sets?.length) bits.push(m.sets.map((s) => `${s[0]}-${s[1]}`).join("  "));
  if (m.home_pens !== null && m.away_pens !== null) bits.push(`${m.home_pens}-${m.away_pens} en penales`);
  if (m.status === "WO" && !m.is_bye) bits.push("no se presentó un equipo");
  return bits.join(" · ");
}

export function whenText(m: TournamentMatch): string {
  if (!m.start_at) return m.status === "SUSPENDIDO" ? "Suspendido · a reprogramar" : "Día y hora a confirmar";
  const d = new Date(m.start_at);
  const day = d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric" });
  return `${day} · ${hhmm(d)} hs${m.court_name ? ` · ${m.court_name}` : ""}`;
}

/** Segundos de juego -> "12:05" */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function periodLabel(scoring: Scoring, period: number | null): string {
  const p = period || 1;
  if (scoring === "SETS") return `Set ${p}`;
  if (scoring === "PUNTOS") return `${p}° período`;
  return p === 1 ? "1er tiempo" : p === 2 ? "2do tiempo" : `${p}° tiempo`;
}

export interface MatchGroup { key: string; label: string; matches: TournamentMatch[] }

/** Partidos agrupados por etapa y fecha / ronda, en el orden en que se juegan */
export function groupMatches(matches: TournamentMatch[]): MatchGroup[] {
  const out: MatchGroup[] = [];
  matches.forEach((m) => {
    const knockout = m.stage === "LLAVE" || m.stage === "TERCERO";
    const key = knockout ? `K-${m.stage === "TERCERO" ? "T" : m.round}` : `R-${m.round}`;
    let g = out.find((x) => x.key === key);
    if (!g) { g = { key, label: m.round_label, matches: [] }; out.push(g); }
    g.matches.push(m);
  });
  return out;
}

/** Rondas de la llave (sin el tercer puesto), para dibujar el cuadro */
export function bracketRounds(matches: TournamentMatch[]): { round: number; label: string; matches: TournamentMatch[] }[] {
  const out: { round: number; label: string; matches: TournamentMatch[] }[] = [];
  matches.filter((m) => m.stage === "LLAVE").forEach((m) => {
    let g = out.find((x) => x.round === m.round);
    if (!g) { g = { round: m.round, label: m.round_label, matches: [] }; out.push(g); }
    g.matches.push(m);
  });
  out.forEach((g) => g.matches.sort((a, b) => a.order - b.order));
  return out.sort((a, b) => a.round - b.round);
}

export function eventText(e: TournamentEvent, scoring: Scoring, sport: string): string {
  const who = e.player_name ? ` · ${e.player_name}` : "";
  const team = e.team ? ` de ${e.team}` : "";
  const w = scoreWords(scoring, sport);
  switch (e.type) {
    case "INICIO": return e.detail || "Empezó el partido";
    case "GOL": return scoring === "PUNTOS" ? `+${e.value} ${e.team || ""}${who}` : `${w.one.charAt(0).toUpperCase() + w.one.slice(1)}${team}${who}`;
    case "AMARILLA": return `Tarjeta amarilla${team ? ` · ${e.team}` : ""}${who}`;
    case "ROJA": return `Tarjeta roja${team ? ` · ${e.team}` : ""}${who}`;
    case "ENTRETIEMPO": return scoring === "PUNTOS" ? "Descanso" : "Entretiempo";
    case "REANUDA": return "Se reanudó el partido";
    case "FIN_SET": return e.detail || "Fin del set";
    case "FIN": return e.detail || "Final del partido";
    default: return e.detail || e.type;
  }
}

export const EVENT_ICON: Record<string, string> = {
  INICIO: "▶", GOL: "⚽", AMARILLA: "🟨", ROJA: "🟥", ENTRETIEMPO: "⏸", REANUDA: "▶", FIN_SET: "✔", FIN: "🏁",
  RESULTADO: "✎", CORRECCION: "✎", PROGRAMADO: "🗓", SUSPENDIDO: "⛔", CREADO: "＋", FIXTURE: "▦", INSCRIPCION: "$",
  CIERRE: "🏆", REABIERTO: "↺", CANCELADO: "✕",
};

export function sportLabel(sport: string): string {
  return SPORT_LABELS[sport] || sport;
}

/** Iniciales para el escudo simple del equipo */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((x) => /[\p{L}\d]/u.test(x));
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/** Colores sugeridos para el escudo (todos dan buen contraste con texto blanco) */
export const TEAM_COLORS = ["#1a7f47", "#c0392b", "#2a5f8f", "#b3540a", "#6b3fa0", "#0f2536", "#a3195b", "#00707a", "#5b6b7d", "#8a6d00"];
