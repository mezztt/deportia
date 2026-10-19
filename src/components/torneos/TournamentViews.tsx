// Vistas de solo lectura del torneo: se usan igual en el sistema y en la página pública.
import { hhmm } from "../../config";
import {
  bracketRounds, clockText, eventText, EVENT_ICON, initials, isDone, isLive, MATCH_STATUS, periodLabel,
  scoreNote, scoreText, scoreWords, teamLabel, whenText,
} from "./types";
import type { Scoring, StandingRow, TournamentDetail, TournamentEvent, TournamentMatch, TournamentTeam } from "./types";

/** Escudo simple: círculo del color del equipo con sus iniciales */
export function TeamBadge({ name, color, size = 28 }: { name: string; color?: string | null; size?: number }) {
  return (
    <span className="tn-badge" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: color || "#5b6b7d" }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function colorOf(teams: TournamentTeam[], id: number | null): string | null {
  return teams.find((x) => x.id === id)?.color || null;
}

/** Tabla de posiciones: PJ, G, E, P, a favor, en contra, diferencia y puntos */
export function StandingsTable({ rows, teams, allowDraw, scoring, qualify = 0 }: {
  rows: StandingRow[]; teams: TournamentTeam[]; allowDraw: boolean; scoring: Scoring; qualify?: number;
}) {
  const [f, c] = scoring === "SETS" ? ["SF", "SC"] : scoring === "PUNTOS" ? ["PF", "PC"] : ["GF", "GC"];
  return (
    <div className="tn-table-wrap">
      <table className="tn-table">
        <thead>
          <tr>
            <th>#</th><th className="is-team">Equipo</th><th title="Partidos jugados">PJ</th><th title="Ganados">G</th>
            {allowDraw && <th title="Empatados">E</th>}<th title="Perdidos">P</th>
            <th title="A favor">{f}</th><th title="En contra">{c}</th><th title="Diferencia">DIF</th><th title="Puntos">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className={qualify && r.position <= qualify ? "is-qualify" : ""}>
              <td>{r.position}</td>
              <td className="is-team"><span className="tn-team-cell"><TeamBadge name={r.team} color={colorOf(teams, r.team_id)} size={22} />{r.team}</span></td>
              <td>{r.pj}</td><td>{r.g}</td>{allowDraw && <td>{r.e}</td>}<td>{r.p}</td>
              <td>{r.gf}</td><td>{r.gc}</td><td>{r.dif > 0 ? `+${r.dif}` : r.dif}</td><td className="is-pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BracketSide({ m, side }: { m: TournamentMatch; side: "home" | "away" }) {
  const id = side === "home" ? m.home_team_id : m.away_team_id;
  const score = side === "home" ? m.home_score : m.away_score;
  const pens = side === "home" ? m.home_pens : m.away_pens;
  const won = !!m.winner_team_id && m.winner_team_id === id;
  const empty = !id;
  return (
    <span className={`tn-bracket-side ${won ? "is-winner" : ""} ${empty ? "is-empty" : ""}`}>
      <em>{m.is_bye && empty ? "Pasa directo" : teamLabel(m, side)}</em>
      <b>{m.is_bye || m.status === "PENDIENTE" ? "" : (score ?? "")}{pens !== null && pens !== undefined ? <i> ({pens})</i> : null}</b>
    </span>
  );
}

/** Llave visual: una columna por ronda; el ganador avanza solo. */
export function Bracket({ matches, onPick }: { matches: TournamentMatch[]; onPick?: (m: TournamentMatch) => void }) {
  const rounds = bracketRounds(matches);
  const third = matches.find((m) => m.stage === "TERCERO");
  if (!rounds.length) return null;
  const cell = (m: TournamentMatch) => {
    const playable = !m.is_bye && !!m.home_team_id && !!m.away_team_id;
    const body = (
      <>
        <BracketSide m={m} side="home" />
        <BracketSide m={m} side="away" />
        {!m.is_bye && (
          <small className={isLive(m) ? "is-live" : ""}>
            {isLive(m) ? "● En juego" : m.status === "SUSPENDIDO" ? "Suspendido" : isDone(m) ? (scoreNote(m) || "Final") : whenText(m)}
          </small>
        )}
      </>
    );
    return onPick && playable
      ? <button key={m.id} type="button" className="tn-bracket-match" onClick={() => onPick(m)}>{body}</button>
      : <div key={m.id} className="tn-bracket-match">{body}</div>;
  };
  return (
    <div className="tn-bracket-wrap">
      <div className="tn-bracket">
        {rounds.map((r) => (
          <div key={r.round} className="tn-bracket-col">
            <h4>{r.label}</h4>
            <div className="tn-bracket-matches">{r.matches.map(cell)}</div>
          </div>
        ))}
        {third && (
          <div className="tn-bracket-col is-third">
            <h4>Tercer puesto</h4>
            <div className="tn-bracket-matches">{cell(third)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Línea de tiempo del partido (lo más nuevo arriba). showUser: quién lo cargó y a qué hora. */
export function Timeline({ events, scoring, sport, showUser = false, onVoid, onPlayer }: {
  events: TournamentEvent[]; scoring: Scoring; sport: string; showUser?: boolean;
  onVoid?: (e: TournamentEvent) => void; onPlayer?: (e: TournamentEvent) => void;
}) {
  if (!events.length) return <p className="tn-empty-line">Todavía no pasó nada en este partido.</p>;
  return (
    <ol className="tn-timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={`${e.voided ? "is-void" : ""} ev-${e.type.toLowerCase()}`}>
          <span className="tn-tl-min">{scoring !== "SETS" && e.minute !== null && ["GOL", "AMARILLA", "ROJA", "ENTRETIEMPO", "FIN"].includes(e.type) ? `${e.minute}'` : ""}</span>
          <span className="tn-tl-icon" aria-hidden="true">{e.type === "GOL" && scoring !== "GOLES" ? "＋" : EVENT_ICON[e.type] || "•"}</span>
          <span className="tn-tl-body">
            <span className="tn-tl-text">{eventText(e, scoring, sport)}{e.voided ? " (anulado)" : ""}</span>
            {showUser && (
              <span className="tn-tl-meta">
                {e.at ? hhmm(e.at) : ""}{e.user_name ? ` · ${e.user_name}` : ""}
                {e.voided && e.voided_by ? ` · anuló ${e.voided_by}${e.voided_at ? ` ${hhmm(e.voided_at)}` : ""}` : ""}
              </span>
            )}
          </span>
          {!e.voided && onPlayer && e.type === "GOL" && scoring === "GOLES" && (
            <button type="button" className="tn-tl-action" onClick={() => onPlayer(e)}>{e.player_name ? "Cambiar" : "¿Quién?"}</button>
          )}
          {!e.voided && onVoid && ["GOL", "AMARILLA", "ROJA"].includes(e.type) && (
            <button type="button" className="tn-tl-action is-danger" onClick={() => onVoid(e)}>Anular</button>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Marcador grande de un partido en juego (página pública y resumen) */
export function LiveCard({ m, teams, scoring, clock, onOpen }: {
  m: TournamentMatch; teams: TournamentTeam[]; scoring: Scoring; clock: number; onOpen?: () => void;
}) {
  const body = (
    <>
      <span className="tn-livecard-top">
        <span className="tn-live-dot">{m.status === "ENTRETIEMPO" ? "Entretiempo" : "En juego"}</span>
        <span>{m.round_label}{m.group_name ? ` · Grupo ${m.group_name}` : ""}{m.court_name ? ` · ${m.court_name}` : ""}</span>
        <span className="tn-livecard-clock">{periodLabel(scoring, m.period)}{scoring !== "SETS" ? ` · ${clockText(clock)}` : ""}</span>
      </span>
      <span className="tn-livecard-score">
        <span className="tn-livecard-team"><TeamBadge name={m.home_team || "?"} color={colorOf(teams, m.home_team_id)} size={34} /><span>{m.home_team}</span></span>
        <b>{m.home_score ?? 0} - {m.away_score ?? 0}</b>
        <span className="tn-livecard-team is-away"><span>{m.away_team}</span><TeamBadge name={m.away_team || "?"} color={colorOf(teams, m.away_team_id)} size={34} /></span>
      </span>
      {scoring === "SETS" && (
        <span className="tn-livecard-sets">
          {m.sets.map((s, i) => <i key={i}>{s[0]}-{s[1]}</i>)}
          {m.current_set && <i className="is-current">{m.current_set[0]}-{m.current_set[1]}</i>}
        </span>
      )}
    </>
  );
  return onOpen
    ? <button type="button" className="tn-livecard" onClick={onOpen}>{body}</button>
    : <div className="tn-livecard">{body}</div>;
}

/** Fila de partido de solo lectura (próximos, últimos resultados, fixture público) */
export function MatchLine({ m, teams, onOpen }: { m: TournamentMatch; teams: TournamentTeam[]; onOpen?: () => void }) {
  const st = MATCH_STATUS[m.status];
  const note = scoreNote(m);
  const body = (
    <>
      <span className="tn-line-teams">
        <span className={`tn-line-team ${m.winner_team_id && m.winner_team_id === m.home_team_id ? "is-winner" : ""}`}>
          <TeamBadge name={teamLabel(m, "home")} color={colorOf(teams, m.home_team_id)} size={22} /><span>{teamLabel(m, "home")}</span>
        </span>
        <b className={`tn-line-score ${isLive(m) ? "is-live" : ""}`}>{scoreText(m)}</b>
        <span className={`tn-line-team is-away ${m.winner_team_id && m.winner_team_id === m.away_team_id ? "is-winner" : ""}`}>
          <span>{m.is_bye ? "" : teamLabel(m, "away")}</span>{!m.is_bye && <TeamBadge name={teamLabel(m, "away")} color={colorOf(teams, m.away_team_id)} size={22} />}
        </span>
      </span>
      {!m.is_bye && (
        <span className="tn-line-meta">
          {isLive(m) || m.status === "SUSPENDIDO" ? <span className={`dp-pill dp-pill-${st.tone}`}>{st.label}</span> : null}
          <span>{isDone(m) ? [note, m.start_at ? whenText(m) : ""].filter(Boolean).join(" · ") || "Final" : whenText(m)}</span>
        </span>
      )}
    </>
  );
  return onOpen && !m.is_bye
    ? <button type="button" className="tn-line" onClick={onOpen}>{body}</button>
    : <div className="tn-line">{body}</div>;
}

/** Goleadores, valla menos vencida y tarjetas */
export function StatsBlocks({ t }: { t: TournamentDetail }) {
  const w = scoreWords(t.scoring, t.sport);
  const against = t.scoring === "SETS" ? "sets en contra" : t.scoring === "PUNTOS" ? "puntos en contra" : "goles en contra";
  return (
    <div className="tn-stats">
      {t.scoring !== "SETS" && (
        <div className="tn-card">
          <h3>{w.scorers}</h3>
          {t.scorers.length === 0 ? <p className="tn-empty-line">Se arma solo cuando se anota quién hizo cada {w.one}.</p> : (
            <ol className="tn-rank">
              {t.scorers.slice(0, 15).map((s, i) => (
                <li key={`${s.team_id}-${s.player}`}>
                  <span className="tn-rank-pos">{i + 1}</span>
                  <span className="tn-rank-name"><b>{s.player}</b><small>{s.team}</small></span>
                  <span className="tn-rank-num">{s.goals}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div className="tn-card">
        <h3>{t.scoring === "GOLES" ? "Valla menos vencida" : "Mejor defensa"}</h3>
        {t.defense.length === 0 ? <p className="tn-empty-line">Aparece cuando se juegue el primer partido.</p> : (
          <ol className="tn-rank">
            {t.defense.slice(0, 8).map((d, i) => (
              <li key={d.team_id}>
                <span className="tn-rank-pos">{i + 1}</span>
                <span className="tn-rank-name"><b>{d.team}</b><small>{d.gc} {against} en {d.pj} partido{d.pj === 1 ? "" : "s"}</small></span>
                <span className="tn-rank-num">{d.avg.toLocaleString("es-AR")}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {t.scoring === "GOLES" && (
        <div className="tn-card">
          <h3>Tarjetas</h3>
          {t.cards.length === 0 ? <p className="tn-empty-line">Sin tarjetas cargadas.</p> : (
            <ol className="tn-rank">
              {t.cards.slice(0, 15).map((c) => (
                <li key={`${c.team_id}-${c.player}`}>
                  <span className="tn-rank-name"><b>{c.player}</b><small>{c.team}</small></span>
                  <span className="tn-cards">
                    {c.yellow > 0 && <span className="tn-card-y" title="Amarillas">{c.yellow}</span>}
                    {c.red > 0 && <span className="tn-card-r" title="Rojas">{c.red}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/** Podio del torneo finalizado (o campeón provisorio) */
export function Podium({ t }: { t: TournamentDetail }) {
  if (!t.champion) return null;
  return (
    <div className="tn-podium">
      <div className="tn-podium-main">
        <span className="tn-podium-cup" aria-hidden="true">🏆</span>
        <span><small>{t.status === "FINALIZADO" ? "Campeón" : "Ganó la final"}</small><b>{t.champion}</b></span>
      </div>
      {t.runner_up && <div className="tn-podium-other"><small>Subcampeón</small><b>{t.runner_up}</b></div>}
      {t.third && <div className="tn-podium-other"><small>Tercer puesto</small><b>{t.third}</b></div>}
    </div>
  );
}
