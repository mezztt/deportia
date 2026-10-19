// Pantalla del partido: pensada para el recepcionista, con botones grandes y usable en el celular.
// - Antes de empezar: «Iniciar partido».
// - En juego: marcador con +1 por equipo (el minuto sale solo del reloj), tarjetas, entretiempo,
//   deshacer y finalizar (si hace falta ganador y empataron, pide penales).
// - Ya jugado: resultado, línea de tiempo con hora y usuario, y anotar a mano goles / tarjetas.
import { useEffect, useRef, useState } from "react";
import { appApi, shortDate, hhmm } from "../../config";
import { colorOf, TeamBadge, Timeline } from "./TournamentViews";
import {
  clockText, isDone, isLive, MATCH_STATUS, periodLabel, scoreNote, scoreWords, teamLabel, whenText,
} from "./types";
import type { TournamentDetail, TournamentEvent, TournamentMatch, TournamentPlayer } from "./types";

interface Props {
  t: TournamentDetail;
  matchId: number;
  /** FINALIZADO / CANCELADO: solo se puede mirar */
  readOnly: boolean;
  canManage: boolean;
  onChange: (d: TournamentDetail) => void;
  onClose: () => void;
  onResult: (m: TournamentMatch) => void;
  onSchedule: (m: TournamentMatch) => void;
}

const UNDOABLE = ["GOL", "AMARILLA", "ROJA", "ENTRETIEMPO", "REANUDA", "FIN_SET"];
const PLAY_EVENTS = ["INICIO", "GOL", "AMARILLA", "ROJA", "ENTRETIEMPO", "REANUDA", "FIN_SET", "FIN"];

function LiveMatch({ t, matchId, readOnly, canManage, onChange, onClose, onResult, onSchedule }: Props) {
  const m = t.matches.find((x) => x.id === matchId) || null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const fetchedAt = useRef<number>(Date.now());
  // después de un gol o una tarjeta: ¿quién fue? (opcional)
  const [ask, setAsk] = useState<TournamentEvent | null>(null);
  const [askName, setAskName] = useState("");
  const [finishing, setFinishing] = useState<null | { hp: string; ap: string }>(null);
  const [note, setNote] = useState<null | { type: string; team_id: string; player: string; minute: string }>(null);

  // el reloj corre en la pantalla; cada 20 s se vuelve a pedir el partido por si lo tocan desde otro lado
  useEffect(() => { fetchedAt.current = Date.now(); }, [t]);
  // la pantalla del partido ocupa todo: lo de atrás no se desplaza
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);
  useEffect(() => {
    const tick = setInterval(() => setTick((x) => x + 1), 1000);
    const poll = setInterval(() => {
      appApi<TournamentDetail>(`/tournaments/${t.id}`).then(onChange).catch(() => {});
    }, 20000);
    return () => { clearInterval(tick); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);

  if (!m) return null;
  const match = m;
  const scoring = t.scoring;
  const w = scoreWords(scoring, t.sport);
  const live = isLive(match);
  const done = isDone(match);
  const ready = !!match.home_team_id && !!match.away_team_id;
  const seconds = match.clock_seconds + (match.clock_running ? (Date.now() - (fetchedAt.current ?? Date.now())) / 1000 : 0);
  const playEvents = match.events.filter((e) => PLAY_EVENTS.includes(e.type));
  const lastEvent = [...playEvents].reverse().find((e) => !e.voided) || null;
  const canUndo = live && !!lastEvent && UNDOABLE.includes(lastEvent.type);
  const tied = (match.home_score ?? 0) === (match.away_score ?? 0);
  const playersOf = (teamId: number | null): TournamentPlayer[] => t.teams.find((x) => x.id === teamId)?.players || [];

  async function call(path: string, method: string, body?: unknown): Promise<TournamentDetail | null> {
    setBusy(true);
    setError("");
    try {
      const d = await appApi<TournamentDetail>(path, { method, body });
      onChange(d);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const act = (action: string, extra: Record<string, unknown> = {}) =>
    call(`/tournaments/matches/${match.id}/live`, "POST", { action, ...extra });

  /** Suma al instante; después (sin apuro) se puede decir quién fue */
  async function score(teamId: number | null, value = 1) {
    setAsk(null);
    const d = await act("goal", { team_id: teamId, value });
    if (d && scoring === "GOLES") askAbout(d, teamId, "GOL");
  }

  async function card(teamId: number | null, type: "AMARILLA" | "ROJA") {
    setAsk(null);
    const d = await act("card", { team_id: teamId, card: type });
    if (d) askAbout(d, teamId, type);
  }

  function askAbout(d: TournamentDetail, teamId: number | null, type: string) {
    const fresh = d.matches.find((x) => x.id === match.id);
    const ev = [...(fresh?.events || [])].reverse().find((e) => e.type === type && e.team_id === teamId && !e.voided);
    setAskName("");
    setAsk(ev || null);
  }

  async function setPlayer(ev: TournamentEvent, player: { id?: number; name?: string }) {
    const d = await call(`/tournaments/events/${ev.id}/player`, "PUT", { player_id: player.id ?? null, player_name: player.name ?? null });
    if (d) setAsk(null);
  }

  async function undo() {
    setAsk(null);
    await act("undo");
  }

  async function finish() {
    if (!finishing) return;
    const body: Record<string, unknown> = {};
    if (finishing.hp !== "" && finishing.ap !== "") { body.home_pens = Number(finishing.hp); body.away_pens = Number(finishing.ap); }
    const d = await act("finish", body);
    if (d) { setFinishing(null); setAsk(null); }
  }

  async function suspend() {
    const reason = prompt("¿Por qué se suspende? (opcional: lluvia, corte de luz...)\nLa cancha queda libre y el partido se puede reprogramar. El marcador se guarda.");
    if (reason === null) return;
    await call(`/tournaments/matches/${match.id}/suspend`, "POST", { reason });
  }

  async function saveNote() {
    if (!note) return;
    const d = await call(`/tournaments/matches/${match.id}/events`, "POST", {
      type: note.type, team_id: Number(note.team_id), player_name: note.player.trim(),
      minute: note.minute === "" ? null : Number(note.minute),
    });
    if (d) setNote(null);
  }

  const side = (which: "home" | "away") => {
    const teamId = which === "home" ? match.home_team_id : match.away_team_id;
    const name = teamLabel(match, which);
    const sc = which === "home" ? match.home_score : match.away_score;
    const cur = match.current_set ? match.current_set[which === "home" ? 0 : 1] : 0;
    const won = !!match.winner_team_id && match.winner_team_id === teamId;
    return (
      <div className={`tn-live-team ${won ? "is-winner" : ""}`}>
        <span className="tn-live-name"><TeamBadge name={name} color={colorOf(t.teams, teamId)} size={36} /><span>{name}</span></span>
        {scoring === "SETS" && live ? (
          <>
            <span className="tn-live-score" aria-label={`${w.one}s de ${name} en este set`}>{cur}</span>
            <span className="tn-live-sub">Sets ganados: {sc ?? 0}</span>
          </>
        ) : (
          <span className="tn-live-score" aria-label={`Marcador de ${name}`}>{match.status === "PENDIENTE" && !match.started_at ? "–" : (sc ?? 0)}</span>
        )}
        {live && !readOnly && (
          scoring === "PUNTOS" ? (
            <span className="tn-live-plus-row">
              {[1, 2, 3].map((v) => (
                <button key={v} type="button" className="tn-live-plus" disabled={busy || match.status !== "EN_JUEGO"} onClick={() => score(teamId, v)}>+{v}</button>
              ))}
            </span>
          ) : (
            <button type="button" className="tn-live-plus" disabled={busy || match.status !== "EN_JUEGO"} onClick={() => score(teamId)}>
              +1 <i>{w.plus}</i>
            </button>
          )
        )}
        {live && !readOnly && scoring === "GOLES" && (
          <span className="tn-live-cards">
            <button type="button" className="tn-live-cardbtn is-yellow" disabled={busy} onClick={() => card(teamId, "AMARILLA")}>Amarilla</button>
            <button type="button" className="tn-live-cardbtn is-red" disabled={busy} onClick={() => card(teamId, "ROJA")}>Roja</button>
          </span>
        )}
      </div>
    );
  };

  const st = MATCH_STATUS[match.status];

  return (
    <div className="tn-live" role="dialog" aria-modal="true" aria-label="Partido">
      <div className="tn-live-inner">
        <header className="tn-live-head">
          <button type="button" className="tn-live-back" onClick={onClose}>‹ Volver al torneo</button>
          <span className={`dp-pill dp-pill-${st.tone}`}>{st.label}</span>
        </header>

        <div className="tn-live-title">
          <span>{t.name}</span>
          <b>{match.round_label}{match.group_name ? ` · Grupo ${match.group_name}` : ""}</b>
          <span>{whenText(match)}</span>
        </div>

        {(live || match.started_at) && (
          <div className={`tn-live-clock ${match.clock_running ? "is-running" : ""}`}>
            <span>{match.status === "ENTRETIEMPO" ? (scoring === "PUNTOS" ? "Descanso" : "Entretiempo") : done ? "Final" : periodLabel(scoring, match.period)}</span>
            {scoring !== "SETS" && <b>{clockText(seconds)}</b>}
          </div>
        )}

        <div className="tn-live-board">
          {side("home")}
          <span className="tn-live-vs" aria-hidden="true">{done || live || match.started_at ? "–" : "vs"}</span>
          {side("away")}
        </div>

        {(match.sets.length > 0 || scoreNote(match)) && (
          <p className="tn-live-note">
            {scoring === "SETS" && match.sets.length > 0 ? `Sets: ${match.sets.map((s) => `${s[0]}-${s[1]}`).join("   ")}` : scoreNote(match)}
            {scoring === "SETS" && match.home_pens !== null ? ` · ${scoreNote(match)}` : ""}
          </p>
        )}
        {match.status === "SUSPENDIDO" && <p className="tn-live-note is-warn">Partido suspendido{match.notes ? `: ${match.notes}` : ""}. {match.started_at ? "El marcador quedó guardado." : ""}</p>}
        {match.edited && <p className="tn-live-note">Resultado corregido por {match.edited.by || "—"} el {shortDate(match.edited.at)} a las {hhmm(match.edited.at)}.</p>}

        {error && <div className="login-error" role="alert">{error}</div>}

        {/* ¿quién fue? (opcional) */}
        {ask && !readOnly && (
          <div className="tn-live-ask">
            <div className="tn-live-ask-head">
              <b>{ask.type === "GOL" ? `Gol de ${ask.team || ""}` : `${ask.type === "ROJA" ? "Roja" : "Amarilla"} para ${ask.team || ""}`}{ask.minute ? ` · ${ask.minute}'` : ""}</b>
              <button type="button" className="tn-live-skip" onClick={() => setAsk(null)}>Saltar</button>
            </div>
            <span className="tn-live-ask-q">{ask.type === "GOL" ? "¿Quién lo hizo?" : "¿A quién?"} (opcional)</span>
            {playersOf(ask.team_id).length > 0 && (
              <div className="tn-live-players">
                {playersOf(ask.team_id).map((p) => (
                  <button key={p.id} type="button" disabled={busy} onClick={() => setPlayer(ask, { id: p.id })}>
                    {p.number !== null && <i>{p.number}</i>}{p.name}
                  </button>
                ))}
              </div>
            )}
            <form className="tn-live-ask-form" onSubmit={(e) => { e.preventDefault(); if (askName.trim()) setPlayer(ask, { name: askName.trim() }); }}>
              <input value={askName} onChange={(e) => setAskName(e.target.value)} placeholder="Escribir el nombre" aria-label="Nombre del jugador" maxLength={120} />
              <button type="submit" className="secondary-button" disabled={busy || !askName.trim()}>Guardar</button>
            </form>
          </div>
        )}

        {/* acciones */}
        {!readOnly && !match.is_bye && (
          <div className="tn-live-actions">
            {!live && !done && (
              ready ? (
                <>
                  <button type="button" className="tn-live-main" disabled={busy} onClick={() => act("start")}>
                    ▶ {match.started_at ? "Retomar partido" : "Iniciar partido"}
                  </button>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => onResult(match)}>Cargar el resultado sin jugar en vivo</button>
                  {canManage && <button type="button" className="secondary-button" disabled={busy} onClick={() => onSchedule(match)}>{match.start_at ? "Reprogramar" : "Programar día, hora y cancha"}</button>}
                </>
              ) : <p className="tn-live-note">Todavía no están definidos los dos equipos de este partido.</p>
            )}
            {live && (
              <>
                <div className="tn-live-row">
                  <button type="button" className="tn-live-btn" disabled={busy || !canUndo} onClick={undo}
                    title={canUndo && lastEvent ? `Deshacer: ${lastEvent.type === "GOL" ? `${w.one} de ${lastEvent.team || ""}` : lastEvent.type.toLowerCase()}` : "No hay nada para deshacer"}>
                    ↶ Deshacer
                  </button>
                  {scoring === "SETS" ? (
                    <button type="button" className="tn-live-btn" disabled={busy} onClick={() => act("end_set")}>✔ Terminar set</button>
                  ) : match.status === "EN_JUEGO" ? (
                    <button type="button" className="tn-live-btn" disabled={busy} onClick={() => act("halftime")}>⏸ {scoring === "PUNTOS" ? "Descanso" : "Entretiempo"}</button>
                  ) : (
                    <button type="button" className="tn-live-btn is-go" disabled={busy} onClick={() => act("resume")}>▶ Reanudar</button>
                  )}
                </div>
                <button type="button" className="tn-live-main is-finish" disabled={busy} onClick={() => { setError(""); setFinishing({ hp: "", ap: "" }); }}>🏁 Finalizar partido</button>
                <button type="button" className="tn-live-link" disabled={busy} onClick={suspend}>Suspender partido (lluvia, corte de luz…)</button>
              </>
            )}
            {done && (
              <div className="tn-live-row">
                <button type="button" className="tn-live-btn" disabled={busy} onClick={() => onResult(match)}>✎ Corregir resultado</button>
                {match.status === "JUGADO" && scoring === "GOLES" && (
                  <button type="button" className="tn-live-btn" disabled={busy}
                    onClick={() => { setError(""); setNote({ type: "GOL", team_id: String(match.home_team_id), player: "", minute: "" }); }}>＋ Anotar goleador o tarjeta</button>
                )}
              </div>
            )}
          </div>
        )}

        {note && (
          <form className="tn-live-ask" onSubmit={(e) => { e.preventDefault(); saveNote(); }}>
            <div className="tn-live-ask-head"><b>Anotar a mano</b><button type="button" className="tn-live-skip" onClick={() => setNote(null)}>Cerrar</button></div>
            <div className="tn-live-noteform">
              <label>Qué<select value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
                <option value="GOL">Gol</option><option value="AMARILLA">Amarilla</option><option value="ROJA">Roja</option>
              </select></label>
              <label>Equipo<select value={note.team_id} onChange={(e) => setNote({ ...note, team_id: e.target.value })}>
                <option value={String(match.home_team_id)}>{match.home_team}</option>
                <option value={String(match.away_team_id)}>{match.away_team}</option>
              </select></label>
              <label>Jugador<input list="tn-note-players" value={note.player} onChange={(e) => setNote({ ...note, player: e.target.value })} required maxLength={120} /></label>
              <label>Minuto<input type="number" min="0" max="300" value={note.minute} onChange={(e) => setNote({ ...note, minute: e.target.value })} placeholder="—" /></label>
              <datalist id="tn-note-players">{playersOf(Number(note.team_id)).map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </div>
            <button type="submit" className="primary-button" disabled={busy || !note.player.trim()}>Guardar anotación</button>
          </form>
        )}

        <section className="tn-live-timeline">
          <h3>Línea de tiempo</h3>
          <Timeline events={[...match.events].sort((a, b) => a.id - b.id)} scoring={scoring} sport={t.sport} showUser
            onPlayer={!readOnly && (live || done) ? (e) => { setAskName(e.player_name || ""); setAsk(e); } : undefined}
            onVoid={!readOnly && match.status === "JUGADO" ? (e) => { if (confirm(e.type === "GOL" && e.detail !== "Anotado a mano" ? "¿Anular este gol? Si el resultado salió de los goles anotados en vivo, se corrige solo (también la tabla y los goleadores)." : "¿Anular esta anotación? El resultado no cambia.")) call(`/tournaments/events/${e.id}/void`, "POST"); } : undefined} />
        </section>
      </div>

      {/* confirmar el final */}
      {finishing && (
        <div className="modal-overlay" onClick={() => setFinishing(null)}>
          <div className="product-modal tn-finish" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FINALIZAR PARTIDO</span><h2>¿Confirmás el resultado?</h2></div>
              <button className="modal-close" onClick={() => setFinishing(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="product-form">
              <div className="tn-finish-score">
                <span>{match.home_team}</span><b>{match.home_score ?? 0} - {match.away_score ?? 0}</b><span>{match.away_team}</span>
              </div>
              {scoring === "SETS" && match.current_set && (match.current_set[0] > 0 || match.current_set[1] > 0) && (
                <p className="dp-muted" style={{ margin: 0 }}>El set en juego ({match.current_set[0]}-{match.current_set[1]}) se cierra y se cuenta.</p>
              )}
              {scoring === "GOLES" && tied && match.needs_winner && (
                <>
                  <p className="tn-finish-warn">Empataron y tiene que haber un ganador: cargá los penales.</p>
                  <div className="dp-score-form">
                    <label><span>Penales {match.home_team}</span>
                      <input type="number" min="0" inputMode="numeric" value={finishing.hp} onChange={(e) => setFinishing({ ...finishing, hp: e.target.value })} /></label>
                    <label><span>Penales {match.away_team}</span>
                      <input type="number" min="0" inputMode="numeric" value={finishing.ap} onChange={(e) => setFinishing({ ...finishing, ap: e.target.value })} /></label>
                  </div>
                </>
              )}
              {scoring === "PUNTOS" && tied && match.needs_winner && (
                <p className="tn-finish-warn">Están empatados: sumá los puntos del suplementario antes de finalizar.</p>
              )}
              {error && <div className="login-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setFinishing(null)}>Seguir jugando</button>
                <button type="button" className="primary-button dp-btn-green" onClick={finish}
                  disabled={busy || (tied && match.needs_winner && scoring !== "SETS" && (scoring === "PUNTOS" || finishing.hp === "" || finishing.ap === ""))}>
                  Sí, finalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveMatch;
