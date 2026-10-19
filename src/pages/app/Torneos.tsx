import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  appApi, money, shortDate, hhmm, dayKey, parseDay, toLocalISO, downloadCsv, minutesLabel, getSessionUser,
  PAYMENT_METHODS, PAYMENT_LABELS, SPORT_LABELS,
} from "../../config";
import type { Court } from "../../config";
import LiveMatch from "../../components/torneos/LiveMatch";
import TournamentWizard from "../../components/torneos/TournamentWizard";
import {
  Bracket, colorOf, LiveCard, MatchLine, Podium, StandingsTable, StatsBlocks, TeamBadge,
} from "../../components/torneos/TournamentViews";
import {
  EVENT_ICON, FORMAT_LABEL, groupMatches, isDone, isLive, MATCH_STATUS, scoreNote, scoreText, scoreWords, sportLabel,
  STATUS_PILL, TEAM_COLORS, teamLabel, TIEBREAKER_LABEL, whenText,
} from "../../components/torneos/types";
import type {
  TournamentDetail, TournamentMatch, TournamentSummary, TournamentTeam,
} from "../../components/torneos/types";

interface TodayMatch {
  match_id: number; tournament_id: number; tournament: string; sport: string; home_team: string | null; away_team: string | null;
  start_at: string | null; court_name: string | null; status: string; home_score: number | null; away_score: number | null;
}

type ListTab = "curso" | "hoy" | "historial" | "inscripciones";
type Tab = "resumen" | "equipos" | "partidos" | "posiciones" | "stats" | "actividad";
type MatchFilter = "todos" | "pendientes" | "jugados";

interface ResultForm {
  match: TournamentMatch; home: string; away: string; sets: string[][]; hp: string; ap: string;
  wo: boolean; winner: string; reason: string;
}
interface TeamForm { id: number; name: string; color: string; contact_name: string; contact_phone: string; players: string }
interface ManyForm { date: string; time: string; duration: string; court_ids: number[]; group: string }

const EMPTY_TEAM: TeamForm = { id: 0, name: "", color: TEAM_COLORS[0], contact_name: "", contact_phone: "", players: "" };

/** "10 Messi" -> { number: 10, name: "Messi" } */
function parsePlayers(text: string): { name: string; number: number | null }[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const m = /^(\d{1,3})[\s.\-)]+(.+)$/.exec(line);
    return m ? { number: Number(m[1]), name: m[2].trim() } : { number: null, name: line };
  });
}

function Torneos() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [params, setParams] = useSearchParams();
  const user = getSessionUser();
  const canManage = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";
  const isAdmin = user?.role === "ADMINISTRADOR";

  const [list, setList] = useState<TournamentSummary[]>([]);
  const [today, setToday] = useState<TodayMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialTab = params.get("tab");
  const [listTab, setListTab] = useState<ListTab>(
    initialTab === "hoy" || initialTab === "historial" || initialTab === "inscripciones" ? initialTab : "curso");
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [tab, setTab] = useState<Tab>("resumen");
  const [filter, setFilter] = useState<MatchFilter>("todos");
  const [courts, setCourts] = useState<Court[]>([]);
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [wizard, setWizard] = useState<null | { initial: TournamentDetail | null }>(null);
  const [liveId, setLiveId] = useState<number | null>(null);
  const [teamForm, setTeamForm] = useState<TeamForm | null>(null);
  const [quick, setQuick] = useState<TeamForm>(EMPTY_TEAM);
  const [payTeam, setPayTeam] = useState<TournamentTeam | null>(null);
  const [payMethod, setPayMethod] = useState("EFECTIVO");
  const [payAmount, setPayAmount] = useState("");
  const [sched, setSched] = useState<null | { match: TournamentMatch; court_id: string; date: string; time: string; duration: string }>(null);
  const [many, setMany] = useState<ManyForm | null>(null);
  const [gen, setGen] = useState<null | { shuffle: boolean }>(null);
  const [result, setResult] = useState<ResultForm | null>(null);
  const [modalError, setModalError] = useState("");
  const quickRef = useRef<HTMLInputElement>(null);

  async function loadList() {
    try {
      const [rows, todayRows] = await Promise.all([
        appApi<TournamentSummary[]>("/tournaments"),
        appApi<TodayMatch[]>("/tournaments/today").catch(() => [] as TodayMatch[]),
      ]);
      setList(rows);
      setToday(todayRows);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los torneos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    appApi<Court[]>("/courts").then(setCourts).catch(() => {});
    appApi<{ slug: string | null }>("/company").then((c) => setSlug(c.slug || "")).catch(() => {});
    const id = Number(params.get("t"));
    if (id) open(id, undefined, Number(params.get("m")) || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { loadList(); }, [refreshKey]);

  async function open(id: number, goTab?: Tab, matchId?: number) {
    try {
      const d = await appApi<TournamentDetail>(`/tournaments/${id}`);
      setT(d);
      setNotice("");
      setFilter("todos");
      setTab(goTab || (d.matches.length ? "resumen" : "equipos"));
      setLiveId(matchId || null);
      setParams({ t: String(id) }, { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo abrir el torneo");
    }
  }

  function backToList() {
    setT(null);
    setLiveId(null);
    setParams(listTab === "curso" ? {} : { tab: listTab }, { replace: true });
    loadList();
  }

  function pickListTab(next: ListTab) {
    setListTab(next);
    setParams(next === "curso" ? {} : { tab: next }, { replace: true });
  }

  function update(d: TournamentDetail) {
    setT(d);
  }

  const anyModal = !!(sched || result || payTeam || teamForm || many || gen);

  /** Llama al servidor; todas las acciones devuelven el torneo actualizado */
  async function act(path: string, method: string, body?: unknown, confirmText?: string): Promise<TournamentDetail | null> {
    if (confirmText && !confirm(confirmText)) return null;
    setBusy(true);
    setModalError("");
    try {
      const d = await appApi<TournamentDetail>(path, { method, body });
      setT(d);
      return d;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo completar";
      if (anyModal) setModalError(msg); else alert(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // =====================================================================
  // LISTA DE TORNEOS
  // =====================================================================
  if (!t) {
    const current = list.filter((x) => x.status === "BORRADOR" || x.status === "EN_CURSO");
    const history = list.filter((x) => x.status === "FINALIZADO" || x.status === "CANCELADO");
    const unpaid = list.filter((x) => (x.unpaid_teams || 0) > 0 && x.status !== "CANCELADO");
    const shown = listTab === "historial" ? history : listTab === "inscripciones" ? unpaid : current;

    return (
      <section className="products-page">
        <div className="products-header">
          <div>
            <span className="dashboard-eyebrow">TORNEOS</span>
            <h1>Torneos y ligas</h1>
            <p>Armá el torneo, jugá los partidos en vivo y el sistema lleva la tabla, la llave y los goleadores.</p>
          </div>
          {canManage && (
            <div className="products-header-actions">
              <button className="primary-button" onClick={() => setWizard({ initial: null })}>+ Nuevo torneo</button>
            </div>
          )}
        </div>

        <div className="tn-tabs" role="tablist" aria-label="Torneos">
          <button role="tab" aria-selected={listTab === "curso"} className={listTab === "curso" ? "is-on" : ""} onClick={() => pickListTab("curso")}>En curso <i>{current.length}</i></button>
          <button role="tab" aria-selected={listTab === "hoy"} className={listTab === "hoy" ? "is-on" : ""} onClick={() => pickListTab("hoy")}>Partidos de hoy <i>{today.length}</i></button>
          {unpaid.length > 0 && (
            <button role="tab" aria-selected={listTab === "inscripciones"} className={listTab === "inscripciones" ? "is-on" : ""} onClick={() => pickListTab("inscripciones")}>Inscripciones sin pagar <i>{unpaid.reduce((s, x) => s + (x.unpaid_teams || 0), 0)}</i></button>
          )}
          <button role="tab" aria-selected={listTab === "historial"} className={listTab === "historial" ? "is-on" : ""} onClick={() => pickListTab("historial")}>Historial <i>{history.length}</i></button>
        </div>

        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando torneos...</span></div>
        ) : error ? (
          <div className="products-empty"><h3>No se pudieron cargar los torneos</h3><p>{error}</p><button className="secondary-button" onClick={loadList}>Reintentar</button></div>
        ) : listTab === "hoy" ? (
          today.length === 0 ? (
            <div className="products-empty"><h3>Hoy no hay partidos de torneo</h3><p>Cuando haya partidos programados para hoy, aparecen acá para jugarlos con un toque.</p></div>
          ) : (
            <div className="tn-today">
              {today.map((m) => {
                const live = m.status === "EN_JUEGO" || m.status === "ENTRETIEMPO";
                return (
                  <button key={m.match_id} className={`tn-today-item ${live ? "is-live" : ""}`} onClick={() => open(m.tournament_id, "partidos", m.match_id)}>
                    <span className="tn-today-time">{m.start_at ? hhmm(m.start_at) : "—"}<small>{m.court_name || "Sin cancha"}</small></span>
                    <span className="tn-today-main">
                      <b>{m.home_team} {live ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : "vs"} {m.away_team}</b>
                      <small>{m.tournament} · {sportLabel(m.sport)}</small>
                    </span>
                    <span className={`tn-today-go ${live ? "is-live" : ""}`}>{live ? "Seguir en vivo ›" : "Jugar ›"}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : shown.length === 0 ? (
          <div className="products-empty">
            {listTab === "historial" ? (
              <><h3>Todavía no hay torneos terminados</h3><p>Cuando un torneo se cierra queda guardado acá con todo: fixture, resultados, tablas, goleadores y lo que pasó en cada partido.</p></>
            ) : listTab === "inscripciones" ? (
              <><h3>No hay inscripciones sin pagar</h3><p>Todos los equipos están al día.</p></>
            ) : (
              <>
                <h3>No hay torneos en curso</h3>
                <p>{canManage ? "Creá el primero: en cuatro pasos cortos queda listo para cargar los equipos." : "Cuando el encargado arme un torneo, lo vas a ver acá para cargar los partidos."}</p>
                {canManage && <button className="primary-button" onClick={() => setWizard({ initial: null })}>+ Nuevo torneo</button>}
              </>
            )}
          </div>
        ) : (
          <div className="tn-grid">
            {shown.map((x) => {
              const pill = STATUS_PILL[x.status];
              const pct = x.matches_count ? Math.round((x.played_count / x.matches_count) * 100) : 0;
              return (
                <button key={x.id} className="tn-tcard" onClick={() => open(x.id, listTab === "inscripciones" ? "equipos" : undefined)}>
                  <span className="tn-tcard-top">
                    <span className={`dp-pill dp-pill-${pill.tone}`}>{pill.label}</span>
                    {x.live_count > 0 && <span className="tn-live-dot">En juego</span>}
                  </span>
                  <b className="tn-tcard-name">{x.name}</b>
                  <span className="tn-tcard-sub">{SPORT_LABELS[x.sport] || x.sport} · {FORMAT_LABEL[x.format]}</span>
                  {x.champion ? (
                    <span className="tn-tcard-champ">🏆 {x.champion}</span>
                  ) : (
                    <span className="tn-tcard-sub">{x.teams_count} equipo{x.teams_count === 1 ? "" : "s"} · {x.matches_count ? `${x.played_count} de ${x.matches_count} partidos` : "sin fixture"}</span>
                  )}
                  <span className="dp-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                  <span className="tn-tcard-foot">
                    {(x.unpaid_teams || 0) > 0 && x.status !== "CANCELADO"
                      ? <span className="dp-pill dp-pill-orange">{x.unpaid_teams} sin pagar</span>
                      : <span>{x.finished_at ? `Terminó el ${shortDate(x.finished_at)}` : x.next_match_at ? `Próximo: ${shortDate(x.next_match_at)} ${hhmm(x.next_match_at)}` : x.starts_on ? `Empieza el ${shortDate(x.starts_on + "T00:00:00")}` : ""}</span>}
                    <span className="tn-tcard-go">Abrir ›</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {wizard && (
          <TournamentWizard courts={courts} initial={null} onClose={() => setWizard(null)}
            onSaved={(d) => { setWizard(null); setT(d); setTab("equipos"); setParams({ t: String(d.id) }, { replace: true }); loadList(); }} />
        )}
      </section>
    );
  }

  // =====================================================================
  // DETALLE DEL TORNEO
  // =====================================================================
  const tour = t;
  const closed = tour.status === "FINALIZADO" || tour.status === "CANCELADO";
  const editable = canManage && !closed;
  const w = scoreWords(tour.scoring, tour.sport);
  const hasFixture = tour.matches.length > 0;
  const real = tour.matches.filter((m) => !m.is_bye);
  const liveMatches = real.filter(isLive);
  const unscheduled = real.filter((m) => (m.status === "PENDIENTE" || m.status === "SUSPENDIDO") && !m.start_at && m.home_team_id && m.away_team_id);
  const upcoming = real.filter((m) => !isDone(m) && !isLive(m) && m.home_team_id && m.away_team_id)
    .sort((a, b) => (a.start_at || "9999").localeCompare(b.start_at || "9999")).slice(0, 5);
  const lastResults = real.filter(isDone).sort((a, b) => (b.finished_at || "").localeCompare(a.finished_at || "")).slice(0, 5);
  const nextMatch = tour.summary?.next_match_id ? real.find((m) => m.id === tour.summary!.next_match_id) : null;
  const publicUrl = slug ? `${window.location.origin}/r/${slug}/torneo/${tour.id}` : "";
  const isPublic = tour.status === "EN_CURSO" || tour.status === "FINALIZADO";
  const fee = tour.entry_fee || 0;
  const paidTeams = tour.teams.filter((x) => x.paid).length;
  const shownMatches = tour.matches.filter((m) =>
    filter === "todos" ? true : filter === "jugados" ? isDone(m) && !m.is_bye : !isDone(m) && !m.is_bye);
  const groups = groupMatches(shownMatches);
  const clockOf = (m: TournamentMatch) => m.clock_seconds;

  function copyLink() {
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---------- acción siguiente ----------
  function runNext() {
    const a = tour.next_action;
    if (!a) return;
    if (a.key === "equipos") { setTab("equipos"); setTimeout(() => quickRef.current?.focus(), 50); }
    else if (a.key === "fixture") { setModalError(""); setGen({ shuffle: true }); }
    else if (a.key === "programar") openMany();
    else if (a.key === "jugar" && a.match_id) setLiveId(a.match_id);
    else if (a.key === "fixture_ver") setTab("partidos");
    else if (a.key === "cerrar") closeTournament();
  }

  async function closeTournament() {
    if (!confirm(`¿Cerrar «${tour.name}»?\nQueda guardado en el Historial con todo lo que pasó y ya no se puede modificar (solo un administrador puede reabrirlo).`)) return;
    setBusy(true);
    try {
      setT(await appApi<TournamentDetail>(`/tournaments/${tour.id}/close`, { method: "POST", body: { force: false } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cerrar";
      if (/Quedan/.test(msg) && confirm(`${msg}\n\n¿Cerrar el torneo igual?`)) {
        await act(`/tournaments/${tour.id}/close`, "POST", { force: true });
      } else if (!/Quedan/.test(msg)) alert(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeTournament() {
    if (!confirm(`¿Eliminar «${tour.name}»? Solo se puede si todavía no se jugó ningún partido ni se cobró ninguna inscripción.`)) return;
    try {
      await appApi(`/tournaments/${tour.id}`, { method: "DELETE" });
      backToList();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  // ---------- equipos ----------
  async function addQuick(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = await act(`/tournaments/${tour.id}/teams`, "POST", {
      name: quick.name, color: quick.color, contact_name: quick.contact_name || null, contact_phone: quick.contact_phone || null,
    });
    if (d) {
      const used = d.teams.map((x) => x.color);
      setQuick({ ...EMPTY_TEAM, color: TEAM_COLORS.find((c) => !used.includes(c)) || TEAM_COLORS[d.teams.length % TEAM_COLORS.length] });
      quickRef.current?.focus();
    }
  }

  function openTeam(tm: TournamentTeam) {
    setModalError("");
    setTeamForm({ id: tm.id, name: tm.name, color: tm.color || TEAM_COLORS[0], contact_name: tm.contact_name || "", contact_phone: tm.contact_phone || "", players: "" });
  }

  async function saveTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!teamForm) return;
    let d = await act(`/tournaments/teams/${teamForm.id}`, "PUT", {
      name: teamForm.name, color: teamForm.color, contact_name: teamForm.contact_name, contact_phone: teamForm.contact_phone,
    });
    const players = parsePlayers(teamForm.players);
    if (d && players.length) d = await act(`/tournaments/teams/${teamForm.id}/players`, "POST", { players });
    if (d) setTeamForm(null);
  }

  // ---------- fixture ----------
  async function generate() {
    if (!gen) return;
    const played = real.some(isDone);
    if (played && !confirm("Ya hay resultados cargados. Si rehacés el fixture se pierden. ¿Seguir?")) return;
    const d = await act(`/tournaments/${tour.id}/generate-fixture?shuffle=${gen.shuffle ? "true" : "false"}${played ? "&force=true" : ""}`, "POST");
    if (d) { setGen(null); setTab("partidos"); setNotice("Fixture generado. Ahora podés programar los partidos (día, hora y cancha)."); }
  }

  // ---------- programar ----------
  function openSchedule(m: TournamentMatch) {
    setModalError("");
    const preferred = courts.filter((c) => (tour.court_ids || []).includes(c.id));
    const base = m.start_at ? new Date(m.start_at) : null;
    const court = courts.find((c) => c.id === m.court_id) || preferred[0] || courts.find((c) => c.sport === tour.sport) || courts[0];
    setSched({
      match: m,
      court_id: court ? String(court.id) : "",
      date: base ? dayKey(base) : tour.starts_on && tour.starts_on >= dayKey(new Date()) ? tour.starts_on : dayKey(new Date()),
      time: base ? hhmm(base) : "20:00",
      duration: String(m.duration_minutes || tour.match_minutes || court?.slot_minutes || 60),
    });
  }

  async function saveSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sched) return;
    const [h, mi] = sched.time.split(":").map(Number);
    const start = parseDay(sched.date);
    start.setHours(h, mi, 0, 0);
    const d = await act(`/tournaments/matches/${sched.match.id}/schedule`, "PUT", {
      court_id: Number(sched.court_id), start_at: toLocalISO(start), duration_minutes: Number(sched.duration),
    });
    if (d) setSched(null);
  }

  async function clearSchedule() {
    if (!sched) return;
    const d = await act(`/tournaments/matches/${sched.match.id}/schedule`, "PUT", { court_id: null, start_at: null }, "¿Quitar la programación? La cancha queda libre.");
    if (d) setSched(null);
  }

  async function suspendFromSchedule() {
    if (!sched) return;
    const reason = prompt("¿Por qué se suspende? (opcional)\nLa cancha queda libre y el partido queda para reprogramar.");
    if (reason === null) return;
    const d = await act(`/tournaments/matches/${sched.match.id}/suspend`, "POST", { reason });
    if (d) setSched(null);
  }

  function openMany() {
    setModalError("");
    const preferred = (tour.court_ids || []).filter((id) => courts.some((c) => c.id === id));
    setMany({
      date: tour.starts_on && tour.starts_on >= dayKey(new Date()) ? tour.starts_on : dayKey(new Date()),
      time: "20:00",
      duration: String(tour.match_minutes || 60),
      court_ids: preferred.length ? preferred : courts.filter((c) => c.sport === tour.sport && c.active).map((c) => c.id),
      group: "",
    });
  }

  async function saveMany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!many) return;
    const pool = many.group ? unscheduled.filter((m) => groupMatches([m])[0].key === many.group) : unscheduled;
    const d = await act(`/tournaments/${tour.id}/schedule-many`, "POST", {
      match_ids: pool.map((m) => m.id), date: many.date, time: many.time, court_ids: many.court_ids, duration_minutes: Number(many.duration),
    });
    if (d) {
      setMany(null);
      setTab("partidos");
      setNotice(`Se programaron ${d.scheduled} partido${d.scheduled === 1 ? "" : "s"}.${d.not_scheduled ? ` ${d.not_scheduled} quedaron sin lugar: programalos en otro día u horario.` : ""}`);
    }
  }

  // ---------- resultado ----------
  function openResult(m: TournamentMatch) {
    setModalError("");
    const done = isDone(m);
    setResult({
      match: m,
      home: done && m.home_score !== null ? String(m.home_score) : "",
      away: done && m.away_score !== null ? String(m.away_score) : "",
      sets: done && m.sets.length ? m.sets.map((s) => [String(s[0]), String(s[1])]) : [["", ""], ["", ""]],
      hp: m.home_pens !== null ? String(m.home_pens) : "", ap: m.away_pens !== null ? String(m.away_pens) : "",
      wo: m.status === "WO", winner: m.status === "WO" && m.winner_team_id ? String(m.winner_team_id) : "", reason: "",
    });
  }

  async function saveResult(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!result) return;
    const body: Record<string, unknown> = { status: result.wo ? "WO" : "JUGADO", reason: result.reason.trim() || null };
    if (result.wo) {
      body.winner_team_id = Number(result.winner);
    } else if (tour.scoring === "SETS") {
      body.sets = result.sets.filter((s) => s[0] !== "" && s[1] !== "").map((s) => [Number(s[0]), Number(s[1])]);
    } else {
      body.home_score = Number(result.home);
      body.away_score = Number(result.away);
      if (result.home === result.away && result.hp !== "" && result.ap !== "") {
        body.home_pens = Number(result.hp);
        body.away_pens = Number(result.ap);
      }
    }
    const d = await act(`/tournaments/matches/${result.match.id}/result`, "PUT", body);
    if (d) setResult(null);
  }

  async function clearResult() {
    if (!result) return;
    const d = await act(`/tournaments/matches/${result.match.id}/result`, "PUT", { status: "PENDIENTE" }, "¿Borrar el resultado de este partido? Queda registrado quién lo borró.");
    if (d) setResult(null);
  }

  // ---------- exportar ----------
  function exportFixture() {
    downloadCsv(`fixture-${tour.name}.csv`, [
      ["Etapa", "Local", "Resultado", "Visitante", "Aclaración", "Día", "Hora", "Cancha", "Estado"],
      ...real.map((m) => [
        `${m.round_label}${m.group_name ? ` · Grupo ${m.group_name}` : ""}`, teamLabel(m, "home"), scoreText(m), teamLabel(m, "away"), scoreNote(m),
        m.start_at ? shortDate(m.start_at) : "", m.start_at ? hhmm(m.start_at) : "", m.court_name || "", MATCH_STATUS[m.status].label,
      ]),
    ]);
  }

  function exportStandings() {
    const tables = tour.format === "GRUPOS" ? tour.groups.map((g) => ({ name: `Grupo ${g.name}`, rows: g.standings })) : [{ name: "", rows: tour.standings }];
    downloadCsv(`posiciones-${tour.name}.csv`, tables.flatMap((tb) => [
      ...(tb.name ? [[tb.name]] : []),
      ["#", "Equipo", "PJ", "G", "E", "P", "A favor", "En contra", "DIF", "PTS"],
      ...tb.rows.map((r) => [r.position, r.team, r.pj, r.g, r.e, r.p, r.gf, r.gc, r.dif, r.pts]),
    ]));
  }

  const resTie = !!result && !result.wo && tour.scoring !== "SETS" && result.home !== "" && result.home === result.away && result.match.needs_winner;

  function matchRow(m: TournamentMatch) {
    const ready = !!m.home_team_id && !!m.away_team_id;
    const st = MATCH_STATUS[m.status];
    const note = scoreNote(m);
    if (m.is_bye) {
      return (
        <li key={m.id} className="tn-match is-bye">
          <MatchLine m={m} teams={tour.teams} />
        </li>
      );
    }
    return (
      <li key={m.id} className={`tn-match ${isLive(m) ? "is-live" : ""}`}>
        <button type="button" className="tn-match-main" onClick={() => setLiveId(m.id)} title="Ver el partido">
          <span className={`tn-line-team ${m.winner_team_id && m.winner_team_id === m.home_team_id ? "is-winner" : ""}`}>
            <TeamBadge name={teamLabel(m, "home")} color={colorOf(tour.teams, m.home_team_id)} size={24} /><span>{teamLabel(m, "home")}</span>
          </span>
          <b className={`tn-line-score ${isLive(m) ? "is-live" : ""}`}>{scoreText(m)}</b>
          <span className={`tn-line-team is-away ${m.winner_team_id && m.winner_team_id === m.away_team_id ? "is-winner" : ""}`}>
            <span>{teamLabel(m, "away")}</span><TeamBadge name={teamLabel(m, "away")} color={colorOf(tour.teams, m.away_team_id)} size={24} />
          </span>
        </button>
        <div className="tn-match-meta">
          <span className="tn-match-info">
            {m.status !== "PENDIENTE" && <span className={`dp-pill dp-pill-${st.tone}`}>{st.label}</span>}
            {m.group_name && <span className="dp-pill dp-pill-gray">Grupo {m.group_name}</span>}
            <span className="tn-match-when">{isDone(m) ? [note, m.start_at ? whenText(m) : ""].filter(Boolean).join(" · ") : whenText(m)}</span>
          </span>
          {!closed && (
            <span className="tn-match-actions">
              {isLive(m) ? (
                <button className="primary-button tn-btn-sm" onClick={() => setLiveId(m.id)}>Seguir en vivo</button>
              ) : isDone(m) ? (
                <button className="product-action-edit" onClick={() => openResult(m)}>Corregir</button>
              ) : (
                <>
                  <button className="primary-button tn-btn-sm" disabled={!ready} title={ready ? undefined : "Todavía no están definidos los dos equipos"} onClick={() => setLiveId(m.id)}>▶ Jugar</button>
                  <button className="product-action-edit" disabled={!ready} onClick={() => openResult(m)}>Cargar resultado</button>
                </>
              )}
              {editable && !isDone(m) && !isLive(m) && (
                <button className="product-action-edit" onClick={() => openSchedule(m)}>{m.start_at ? "Reprogramar" : "Programar"}</button>
              )}
            </span>
          )}
        </div>
      </li>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "equipos", label: `Equipos (${tour.teams.length})` },
    { id: "partidos", label: `Partidos (${tour.played_count}/${tour.matches_count})` },
    { id: "posiciones", label: tour.format === "LIGA" ? "Posiciones" : tour.format === "GRUPOS" ? "Grupos y llave" : "Llave" },
    { id: "stats", label: tour.scoring === "GOLES" ? "Goleadores" : "Estadísticas" },
    ...(canManage ? [{ id: "actividad" as Tab, label: "Actividad" }] : []),
  ];

  return (
    <section className="products-page tn-page">
      <div className="products-header">
        <div>
          <button className="dp-link-button" onClick={backToList}>‹ Todos los torneos</button>
          <h1 style={{ marginTop: 4 }}>{tour.name}</h1>
          <p className="tn-head-sub">
            <span className={`dp-pill dp-pill-${STATUS_PILL[tour.status].tone}`}>{STATUS_PILL[tour.status].label}</span>
            <span>{sportLabel(tour.sport)} · {FORMAT_LABEL[tour.format]}{tour.format !== "ELIMINACION" && tour.double_round ? " · ida y vuelta" : ""}</span>
            {tour.starts_on && <span>· desde el {shortDate(tour.starts_on + "T00:00:00")}{tour.ends_on ? ` hasta el ${shortDate(tour.ends_on + "T00:00:00")}` : ""}</span>}
          </p>
        </div>
        {canManage && (
          <div className="products-header-actions">
            {editable && <button className="secondary-button" onClick={() => setWizard({ initial: tour })}>Editar</button>}
            {editable && tour.status === "EN_CURSO" && tour.next_action?.key !== "cerrar" && real.some(isDone) && (
              <button className="secondary-button" disabled={busy} onClick={closeTournament}>Cerrar torneo</button>
            )}
            {editable && (real.some(isDone) || paidTeams > 0 ? (
              <button className="product-action-delete" disabled={busy}
                onClick={() => act(`/tournaments/${tour.id}/cancel`, "POST", undefined, `¿Cancelar «${tour.name}»? Queda guardado en el Historial y se liberan las canchas reservadas.`)}>Cancelar torneo</button>
            ) : (
              <button className="product-action-delete" disabled={busy} onClick={removeTournament}>Eliminar</button>
            ))}
            {closed && isAdmin && (
              <button className="secondary-button" disabled={busy}
                onClick={() => act(`/tournaments/${tour.id}/reopen`, "POST", undefined, "¿Reabrir el torneo? Vuelve a estar en curso y se puede modificar. Queda registrado que lo reabriste.")}>Reabrir torneo</button>
            )}
          </div>
        )}
      </div>

      {closed && (
        <div className="tn-closed" role="status">
          <b>{tour.status === "FINALIZADO" ? "Torneo finalizado" : "Torneo cancelado"}{tour.finished_at ? ` el ${shortDate(tour.finished_at)}` : ""}.</b>{" "}
          Está guardado con todo lo que pasó y no se puede modificar.{isAdmin ? " Si hay que corregir algo, usá «Reabrir torneo»." : " Solo un administrador puede reabrirlo."}
        </div>
      )}

      <Podium t={tour} />

      {/* resumen para el que organiza */}
      {tour.summary && (
        <div className="tn-summary">
          <div className="tn-stat"><small>Equipos</small><b>{tour.summary.teams}</b>{tour.format === "GRUPOS" && <span>{tour.groups_count} grupos</span>}</div>
          <div className="tn-stat">
            <small>Partidos jugados</small><b>{tour.summary.matches_played}<i> / {tour.summary.matches_total}</i></b>
            <span className="dp-progress" aria-hidden="true"><span style={{ width: `${tour.summary.matches_total ? (tour.summary.matches_played / tour.summary.matches_total) * 100 : 0}%` }} /></span>
          </div>
          <div className="tn-stat"><small>{w.many}</small><b>{tour.summary.goals}</b></div>
          <div className="tn-stat">
            <small>Inscripciones</small>
            {fee > 0 ? (
              <><b>{money(tour.summary.collected)}</b><span className={tour.summary.pending_amount > 0 ? "is-warn" : ""}>
                {tour.summary.pending_amount > 0 ? `Falta cobrar ${money(tour.summary.pending_amount)} (${tour.summary.unpaid_teams})` : "Todos pagaron"}</span></>
            ) : <><b>Gratis</b><span>Sin costo de inscripción</span></>}
          </div>
          <div className="tn-stat is-wide">
            <small>Próximo partido</small>
            {nextMatch ? <><b className="is-text">{teamLabel(nextMatch, "home")} vs {teamLabel(nextMatch, "away")}</b><span>{whenText(nextMatch)}</span></>
              : <><b className="is-text">—</b><span>{hasFixture ? (closed ? "No quedan partidos" : "No hay partidos programados") : "Todavía no hay fixture"}</span></>}
          </div>
        </div>
      )}

      {/* un único botón: lo que toca hacer ahora */}
      {tour.next_action && (canManage || tour.next_action.key === "jugar") && (
        <div className="tn-next">
          <div><small>Lo que sigue</small><b>{tour.next_action.hint}</b></div>
          <button className="primary-button tn-next-btn" disabled={busy} onClick={runNext}>{tour.next_action.label} ›</button>
        </div>
      )}

      {notice && <div className="tn-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

      {isPublic && publicUrl && (
        <div className="dp-share-box">
          <div>
            <span className="dp-checkin-label">Link para compartir con los equipos (posiciones, fixture, llave, goleadores y marcador en vivo)</span>
            <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
          </div>
          <div className="tn-share-actions">
            <button className="secondary-button" onClick={copyLink}>{copied ? "¡Copiado!" : "Copiar link"}</button>
            <a className="secondary-button" href={`${publicUrl}?imprimir=1`} target="_blank" rel="noreferrer">Imprimir fixture y tabla</a>
          </div>
        </div>
      )}

      <div className="tn-tabs" role="tablist" aria-label="Secciones del torneo">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? "is-on" : ""} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>

      {/* ---------------- RESUMEN ---------------- */}
      {tab === "resumen" && (
        <>
          {liveMatches.length > 0 && (
            <div className="tn-livecards">
              {liveMatches.map((m) => <LiveCard key={m.id} m={m} teams={tour.teams} scoring={tour.scoring} clock={clockOf(m)} onOpen={() => setLiveId(m.id)} />)}
            </div>
          )}
          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading"><h2>Próximos partidos</h2></div>
              {upcoming.length === 0 ? <p className="tn-empty-line">{hasFixture ? "No quedan partidos por jugar." : "Todavía no hay fixture."}</p>
                : <div className="tn-lines">{upcoming.map((m) => <MatchLine key={m.id} m={m} teams={tour.teams} onOpen={() => setLiveId(m.id)} />)}</div>}
            </div>
            <div className="dashboard-section">
              <div className="section-heading"><h2>Últimos resultados</h2></div>
              {lastResults.length === 0 ? <p className="tn-empty-line">Todavía no se jugó ningún partido.</p>
                : <div className="tn-lines">{lastResults.map((m) => <MatchLine key={m.id} m={m} teams={tour.teams} onOpen={() => setLiveId(m.id)} />)}</div>}
            </div>
          </div>
          <div className="dashboard-section">
            <div className="section-heading"><h2>Datos del torneo</h2></div>
            <dl className="tn-info">
              <div><dt>Formato</dt><dd>{FORMAT_LABEL[tour.format]}{tour.format === "GRUPOS" ? ` · ${tour.groups_count} grupos, clasifican ${tour.qualify_per_group} por grupo` : ""}{tour.third_place ? " · con partido por el tercer puesto" : ""}</dd></div>
              <div><dt>Puntos</dt><dd>Victoria {tour.points_win}{tour.allow_draw ? ` · Empate ${tour.points_draw}` : ""} · Derrota {tour.points_loss}</dd></div>
              <div><dt>Desempate</dt><dd>Puntos › {tour.tiebreakers.map((x) => TIEBREAKER_LABEL[x]).join(" › ")}</dd></div>
              <div><dt>Partidos</dt><dd>{tour.match_minutes ? minutesLabel(tour.match_minutes) : "Duración según la cancha"}{(tour.court_ids || []).length ? ` · ${courts.filter((c) => (tour.court_ids || []).includes(c.id)).map((c) => c.name).join(", ")}` : ""}</dd></div>
              <div><dt>Inscripción</dt><dd>{fee > 0 ? `${money(fee)} por equipo · pagaron ${paidTeams} de ${tour.teams.length}` : "Sin costo"}</dd></div>
              {tour.prizes && <div><dt>Premios</dt><dd>{tour.prizes}</dd></div>}
              {tour.notes && <div><dt>Reglamento</dt><dd>{tour.notes}</dd></div>}
            </dl>
          </div>
        </>
      )}

      {/* ---------------- EQUIPOS ---------------- */}
      {tab === "equipos" && (
        <div className="dashboard-section">
          <div className="section-heading dp-heading-row">
            <div>
              <h2>Equipos</h2>
              <p>{fee > 0 ? `Inscripción ${money(fee)} · pagaron ${paidTeams} de ${tour.teams.length}` : "Sin costo de inscripción"}</p>
            </div>
            {editable && (
              <button className={hasFixture ? "secondary-button" : "primary-button"} disabled={busy || tour.teams.length < 2}
                title={tour.teams.length < 2 ? "Cargá al menos 2 equipos" : undefined} onClick={() => { setModalError(""); setGen({ shuffle: true }); }}>
                {hasFixture ? "Rehacer fixture" : "Generar fixture"}
              </button>
            )}
          </div>

          {editable && (!hasFixture ? (
            <form className="tn-quick" onSubmit={addQuick}>
              <div className="tn-quick-main">
                <input ref={quickRef} placeholder="Nombre del equipo" aria-label="Nombre del equipo" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} required maxLength={120} />
                <input placeholder="Delegado (opcional)" aria-label="Delegado" value={quick.contact_name} onChange={(e) => setQuick({ ...quick, contact_name: e.target.value })} maxLength={150} />
                <input type="tel" placeholder="Teléfono (opcional)" aria-label="Teléfono del delegado" value={quick.contact_phone} onChange={(e) => setQuick({ ...quick, contact_phone: e.target.value })} maxLength={50} />
                <button type="submit" className="primary-button" disabled={busy}>+ Agregar equipo</button>
              </div>
              <div className="tn-colors" role="radiogroup" aria-label="Color del equipo">
                <span>Color</span>
                {TEAM_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={quick.color === c} aria-label={`Color ${c}`} className={quick.color === c ? "is-on" : ""} style={{ background: c }} onClick={() => setQuick({ ...quick, color: c })} />
                ))}
              </div>
            </form>
          ) : (
            <p className="tn-note-box">El fixture ya está armado. Para sumar o sacar equipos hay que rehacer el fixture; si un equipo no se presenta, cargá sus partidos como W.O.</p>
          ))}

          {tour.teams.length === 0 ? (
            <p className="tn-empty-line">{editable ? "Todavía no hay equipos. Cargá el primero acá arriba: con el nombre alcanza." : "Todavía no hay equipos cargados."}</p>
          ) : (
            <ul className="tn-teams">
              {tour.teams.map((tm) => (
                <li key={tm.id} className="tn-team">
                  <TeamBadge name={tm.name} color={tm.color} size={40} />
                  <div className="tn-team-main">
                    <b>{tm.name}{tm.group_name ? <span className="dp-pill dp-pill-gray">Grupo {tm.group_name}</span> : null}</b>
                    <span>{[tm.contact_name, tm.contact_phone].filter(Boolean).join(" · ") || "Sin delegado cargado"} · {tm.players.length ? `${tm.players.length} jugador${tm.players.length === 1 ? "" : "es"}` : "sin lista de jugadores"}</span>
                  </div>
                  <div className="tn-team-pay">
                    {tm.paid ? <span className="dp-pill dp-pill-green">Pagó {money(tm.paid_amount)}</span>
                      : fee > 0 ? <span className="dp-pill dp-pill-orange">Debe {money(fee)}</span> : null}
                  </div>
                  <div className="tn-team-actions">
                    {!tm.paid && tour.status !== "CANCELADO" && (fee > 0 || !closed) && (
                      <button className="product-action-edit" onClick={() => { setModalError(""); setPayTeam(tm); setPayAmount(fee ? String(fee) : ""); }}>Cobrar inscripción</button>
                    )}
                    {tm.paid && canManage && (
                      <button className="product-action-edit" disabled={busy}
                        onClick={() => act(`/tournaments/teams/${tm.id}/unpay`, "POST", undefined, "¿Deshacer el cobro de la inscripción? Se borra el ingreso de Facturación.")}>Deshacer cobro</button>
                    )}
                    {editable && <button className="product-action-edit" onClick={() => openTeam(tm)}>Editar y jugadores</button>}
                    {editable && !hasFixture && (
                      <button className="product-action-delete" disabled={busy}
                        onClick={() => act(`/tournaments/teams/${tm.id}`, "DELETE", undefined, `¿Sacar a ${tm.name} del torneo?`)}>Sacar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------------- PARTIDOS ---------------- */}
      {tab === "partidos" && (
        !hasFixture ? (
          <div className="products-empty">
            <h3>Todavía no hay fixture</h3>
            <p>Cargá los equipos y tocá «Generar fixture»: el sistema arma todos los cruces.</p>
            <button className="primary-button" onClick={() => setTab("equipos")}>Ir a Equipos</button>
          </div>
        ) : (
          <>
            <div className="dp-toolbar tn-toolbar">
              <div className="tn-filter" role="group" aria-label="Filtrar partidos">
                {(["todos", "pendientes", "jugados"] as MatchFilter[]).map((x) => (
                  <button key={x} className={filter === x ? "is-on" : ""} aria-pressed={filter === x} onClick={() => setFilter(x)}>
                    {x === "todos" ? "Todos" : x === "pendientes" ? "Por jugar" : "Jugados"}
                  </button>
                ))}
              </div>
              <div className="tn-toolbar-actions">
                {editable && unscheduled.length > 0 && <button className="primary-button" onClick={openMany}>Programar varios ({unscheduled.length})</button>}
                <button className="secondary-button" onClick={exportFixture}>Exportar CSV</button>
              </div>
            </div>
            {!closed && <p className="dp-muted tn-hint">Tocá un partido para jugarlo en vivo o ver todo lo que pasó. Al programarlo, la cancha queda bloqueada en Turnos.</p>}
            {groups.length === 0 ? <p className="tn-empty-line">No hay partidos con ese filtro.</p> : (
              <div className="tn-rounds">
                {groups.map((r) => (
                  <div key={r.key} className="dashboard-section">
                    <div className="section-heading"><h2>{r.label}</h2></div>
                    <ul className="tn-match-list">{r.matches.map(matchRow)}</ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {/* ---------------- POSICIONES / LLAVE ---------------- */}
      {tab === "posiciones" && (
        <>
          {tour.format === "LIGA" && (
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Tabla de posiciones</h2><p>Desempata por: {tour.tiebreakers.map((x) => TIEBREAKER_LABEL[x].toLowerCase()).join(", ")}</p></div>
                <button className="secondary-button" onClick={exportStandings} disabled={!tour.standings.length}>Exportar CSV</button>
              </div>
              {tour.standings.length === 0 ? <p className="tn-empty-line">Cargá los equipos para ver la tabla.</p>
                : <StandingsTable rows={tour.standings} teams={tour.teams} allowDraw={tour.allow_draw} scoring={tour.scoring} />}
            </div>
          )}
          {tour.format === "GRUPOS" && (
            tour.groups.length === 0 ? <div className="products-empty"><p>Generá el fixture para armar los grupos.</p></div> : (
              <>
                <div className="dp-toolbar tn-toolbar">
                  <p className="dp-muted" style={{ margin: 0 }}>Los {tour.qualify_per_group === 1 ? "primeros" : `${tour.qualify_per_group} primeros`} de cada grupo (resaltados) pasan a la llave.</p>
                  <button className="secondary-button" onClick={exportStandings}>Exportar CSV</button>
                </div>
                <div className="tn-groups">
                  {tour.groups.map((g) => (
                    <div key={g.name} className="dashboard-section">
                      <div className="section-heading"><h2>Grupo {g.name}</h2></div>
                      <StandingsTable rows={g.standings} teams={tour.teams} allowDraw={tour.allow_draw} scoring={tour.scoring} qualify={tour.qualify_per_group || 0} />
                    </div>
                  ))}
                </div>
              </>
            )
          )}
          {tour.format !== "LIGA" && (
            !hasFixture ? (tour.format === "ELIMINACION" ? <div className="products-empty"><p>Generá el fixture para ver la llave.</p></div> : null) : (
              <div className="dashboard-section">
                <div className="section-heading"><h2>Llave</h2><p>El ganador avanza solo a la ronda siguiente</p></div>
                <Bracket matches={tour.matches} onPick={(m) => setLiveId(m.id)} />
              </div>
            )
          )}
        </>
      )}

      {/* ---------------- ESTADÍSTICAS ---------------- */}
      {tab === "stats" && <StatsBlocks t={tour} />}

      {/* ---------------- ACTIVIDAD ---------------- */}
      {tab === "actividad" && (
        <div className="dashboard-section">
          <div className="section-heading"><h2>Actividad del torneo</h2><p>Quién hizo cada cosa y cuándo. Lo de cada partido está en su línea de tiempo.</p></div>
          {(tour.log || []).length === 0 ? <p className="tn-empty-line">Sin movimientos todavía.</p> : (
            <ol className="tn-log">
              {[...(tour.log || [])].reverse().map((e) => (
                <li key={e.id}>
                  <span className="tn-tl-icon" aria-hidden="true">{EVENT_ICON[e.type] || "•"}</span>
                  <span className="tn-tl-body">
                    <span className="tn-tl-text">{e.detail || e.type}</span>
                    <span className="tn-tl-meta">{e.at ? `${shortDate(e.at)} ${hhmm(e.at)}` : ""}{e.user_name ? ` · ${e.user_name}` : ""}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* ---------- partido (en vivo / detalle) ---------- */}
      {liveId !== null && !result && !sched && (
        <LiveMatch t={tour} matchId={liveId} readOnly={closed} canManage={editable} onChange={update}
          onClose={() => setLiveId(null)} onResult={openResult} onSchedule={openSchedule} />
      )}

      {wizard && (
        <TournamentWizard courts={courts} initial={wizard.initial} onClose={() => setWizard(null)}
          onSaved={(d) => { setWizard(null); setT(d); }} />
      )}

      {/* ---------- generar fixture ---------- */}
      {gen && (
        <div className="modal-overlay" onClick={() => setGen(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FIXTURE</span><h2>{hasFixture ? "Rehacer el fixture" : "Generar el fixture"}</h2></div>
              <button className="modal-close" onClick={() => setGen(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="product-form">
              <p className="dp-muted" style={{ margin: 0 }}>
                {tour.teams.length} equipos · {FORMAT_LABEL[tour.format]}
                {tour.format === "GRUPOS" ? ` · ${tour.groups_count} grupos, pasan ${tour.qualify_per_group} por grupo` : ""}
                {tour.format !== "ELIMINACION" && tour.double_round ? " · ida y vuelta" : ""}. El sistema arma todos los cruces.
              </p>
              <div className="tn-format-grid is-two" role="radiogroup" aria-label="Orden de los equipos">
                <button type="button" role="radio" aria-checked={gen.shuffle} className={`tn-format ${gen.shuffle ? "is-on" : ""}`} onClick={() => setGen({ shuffle: true })}>
                  <b>Sorteo</b><span>Los cruces {tour.format === "GRUPOS" ? "y los grupos " : ""}salen al azar.</span>
                </button>
                <button type="button" role="radio" aria-checked={!gen.shuffle} className={`tn-format ${!gen.shuffle ? "is-on" : ""}`} onClick={() => setGen({ shuffle: false })}>
                  <b>Por orden de carga</b><span>{tour.format === "ELIMINACION" ? "Los primeros de la lista son cabezas de serie (y los que pasan directo)." : "Se respeta el orden en que cargaste los equipos."}</span>
                </button>
              </div>
              {hasFixture && <p className="tn-finish-warn">Se borra el fixture actual: partidos, programación y resultados. Las canchas reservadas se liberan.</p>}
              {modalError && <div className="login-error" role="alert">{modalError}</div>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setGen(null)}>Cancelar</button>
                <button className="primary-button" disabled={busy} onClick={generate}>{hasFixture ? "Rehacer fixture" : "Generar fixture"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- editar equipo y jugadores ---------- */}
      {teamForm && (() => {
        const current = tour.teams.find((x) => x.id === teamForm.id);
        return (
          <div className="modal-overlay" onClick={() => setTeamForm(null)}>
            <div className="product-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div><span className="dashboard-eyebrow">EQUIPO</span><h2>{current?.name || teamForm.name}</h2></div>
                <button className="modal-close" onClick={() => setTeamForm(null)} aria-label="Cerrar">×</button>
              </div>
              <form className="product-form" onSubmit={saveTeam}>
                <div className="form-group"><label htmlFor="tm-name">Nombre</label><input id="tm-name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required maxLength={120} /></div>
                <div className="tn-colors" role="radiogroup" aria-label="Color del equipo">
                  <span>Color</span>
                  {TEAM_COLORS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={teamForm.color === c} aria-label={`Color ${c}`} className={teamForm.color === c ? "is-on" : ""} style={{ background: c }} onClick={() => setTeamForm({ ...teamForm, color: c })} />
                  ))}
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="tm-del">Delegado</label><input id="tm-del" value={teamForm.contact_name} onChange={(e) => setTeamForm({ ...teamForm, contact_name: e.target.value })} maxLength={150} /></div>
                  <div className="form-group"><label htmlFor="tm-tel">Teléfono</label><input id="tm-tel" type="tel" value={teamForm.contact_phone} onChange={(e) => setTeamForm({ ...teamForm, contact_phone: e.target.value })} maxLength={50} /></div>
                </div>
                <div className="form-group">
                  <label>Jugadores ({current?.players.length || 0})</label>
                  {current && current.players.length > 0 && (
                    <ul className="tn-players">
                      {current.players.map((p) => (
                        <li key={p.id}>
                          <i>{p.number ?? "–"}</i><span>{p.name}</span>
                          <button type="button" aria-label={`Quitar a ${p.name}`} disabled={busy} onClick={() => act(`/tournaments/players/${p.id}`, "DELETE")}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <textarea rows={4} value={teamForm.players} onChange={(e) => setTeamForm({ ...teamForm, players: e.target.value })}
                    placeholder={"Agregá jugadores, uno por línea.\nSi querés, con el número adelante:\n10 Lionel\n9 Julián"} aria-label="Agregar jugadores, uno por línea" />
                  <small className="dp-muted">Es opcional. Sirve para elegir con un toque quién hizo cada gol.</small>
                </div>
                {modalError && <div className="login-error" role="alert">{modalError}</div>}
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setTeamForm(null)}>Cancelar</button>
                  <button type="submit" className="primary-button" disabled={busy}>Guardar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ---------- cobrar inscripción ---------- */}
      {payTeam && (
        <div className="modal-overlay" onClick={() => setPayTeam(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">INSCRIPCIÓN</span><h2>{payTeam.name}</h2></div>
              <button className="modal-close" onClick={() => setPayTeam(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="dp-pay-form">
              <div className="dp-pay-total"><span>Monto</span><input type="number" min="0" inputMode="decimal" aria-label="Monto" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <span className="dp-checkin-label">Método de pago</span>
              <div className="dp-method-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" className={`dp-method ${payMethod === m ? "is-on" : ""}`} onClick={() => setPayMethod(m)}>{PAYMENT_LABELS[m]}</button>
                ))}
              </div>
              <p className="dp-muted" style={{ margin: 0 }}>El cobro entra en Facturación como «Torneos», igual que los demás cobros del complejo.</p>
              {modalError && <div className="login-error" role="alert">{modalError}</div>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setPayTeam(null)}>Cancelar</button>
                <button className="primary-button dp-btn-green" disabled={busy || !Number(payAmount)}
                  onClick={async () => { if (await act(`/tournaments/teams/${payTeam.id}/pay`, "POST", { payment_method: payMethod, amount: Number(payAmount) })) setPayTeam(null); }}>
                  Registrar pago de {money(payAmount)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- programar partido ---------- */}
      {sched && (
        <div className="modal-overlay" onClick={() => setSched(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">{sched.match.round_label.toUpperCase()}</span><h2>{teamLabel(sched.match, "home")} vs {teamLabel(sched.match, "away")}</h2></div>
              <button className="modal-close" onClick={() => setSched(null)} aria-label="Cerrar">×</button>
            </div>
            {courts.length === 0 ? <div className="products-empty"><p>Primero creá una cancha desde el módulo Canchas.</p></div> : (
              <form className="product-form" onSubmit={saveSchedule}>
                <div className="form-group">
                  <label htmlFor="sc-court">Cancha</label>
                  <select id="sc-court" value={sched.court_id} onChange={(e) => setSched({ ...sched, court_id: e.target.value })}>
                    {courts.map((c) => <option key={c.id} value={c.id}>{c.name} · {SPORT_LABELS[c.sport] || c.sport}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="sc-date">Día</label><input id="sc-date" type="date" value={sched.date} onChange={(e) => setSched({ ...sched, date: e.target.value })} required /></div>
                  <div className="form-group"><label htmlFor="sc-time">Hora</label><input id="sc-time" type="time" step={300} value={sched.time} onChange={(e) => setSched({ ...sched, time: e.target.value })} required /></div>
                  <div className="form-group">
                    <label htmlFor="sc-dur">Duración</label>
                    <select id="sc-dur" value={sched.duration} onChange={(e) => setSched({ ...sched, duration: e.target.value })}>
                      {Array.from(new Set([Number(sched.duration), 30, 45, 60, 75, 90, 120, 150, 180])).sort((a, b) => a - b).map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                    </select>
                  </div>
                </div>
                <p className="dp-muted" style={{ margin: 0 }}>La cancha queda bloqueada para el partido (aparece en Turnos y en Canchas como «Torneo»). Si choca con un turno o con otro partido, te avisa.</p>
                {modalError && <div className="login-error" role="alert">{modalError}</div>}
                <div className="modal-actions tn-modal-split">
                  <div>
                    {sched.match.start_at && <button type="button" className="product-action-delete" disabled={busy} onClick={clearSchedule}>Quitar programación</button>}
                    {sched.match.status !== "SUSPENDIDO" && <button type="button" className="product-action-delete" disabled={busy} onClick={suspendFromSchedule}>Suspender partido</button>}
                  </div>
                  <div>
                    <button type="button" className="secondary-button" onClick={() => setSched(null)}>Cancelar</button>
                    <button type="submit" className="primary-button" disabled={busy}>Guardar y bloquear cancha</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---------- programar varios ---------- */}
      {many && (() => {
        const options = groupMatches(unscheduled);
        const count = many.group ? (options.find((o) => o.key === many.group)?.matches.length || 0) : unscheduled.length;
        return (
          <div className="modal-overlay" onClick={() => setMany(null)}>
            <div className="product-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div><span className="dashboard-eyebrow">PROGRAMAR</span><h2>Programar varios partidos</h2></div>
                <button className="modal-close" onClick={() => setMany(null)} aria-label="Cerrar">×</button>
              </div>
              <form className="product-form" onSubmit={saveMany}>
                <p className="dp-muted" style={{ margin: 0 }}>El sistema los acomoda uno atrás del otro desde la hora que elijas, en las canchas marcadas, salteando lo que ya esté ocupado y sin que un equipo juegue dos partidos a la vez.</p>
                <div className="form-group">
                  <label htmlFor="mn-group">Qué partidos</label>
                  <select id="mn-group" value={many.group} onChange={(e) => setMany({ ...many, group: e.target.value })}>
                    <option value="">Todos los que faltan programar ({unscheduled.length})</option>
                    {options.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.matches.length})</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="mn-date">Día</label><input id="mn-date" type="date" value={many.date} onChange={(e) => setMany({ ...many, date: e.target.value })} required /></div>
                  <div className="form-group"><label htmlFor="mn-time">Primer partido</label><input id="mn-time" type="time" step={300} value={many.time} onChange={(e) => setMany({ ...many, time: e.target.value })} required /></div>
                  <div className="form-group">
                    <label htmlFor="mn-dur">Duración</label>
                    <select id="mn-dur" value={many.duration} onChange={(e) => setMany({ ...many, duration: e.target.value })}>
                      {Array.from(new Set([Number(many.duration), 30, 45, 60, 75, 90, 120, 150, 180])).sort((a, b) => a - b).map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Canchas</label>
                  <div className="tn-choice-row">
                    {courts.filter((c) => c.active).map((c) => {
                      const on = many.court_ids.includes(c.id);
                      return (
                        <button key={c.id} type="button" aria-pressed={on} className={`tn-chip ${on ? "is-on" : ""}`}
                          onClick={() => setMany({ ...many, court_ids: on ? many.court_ids.filter((x) => x !== c.id) : [...many.court_ids, c.id] })}>{on ? "✓ " : ""}{c.name}</button>
                      );
                    })}
                  </div>
                </div>
                {modalError && <div className="login-error" role="alert">{modalError}</div>}
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setMany(null)}>Cancelar</button>
                  <button type="submit" className="primary-button" disabled={busy || !many.court_ids.length || !count}>Programar {count} partido{count === 1 ? "" : "s"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ---------- cargar / corregir resultado ---------- */}
      {result && (
        <div className="modal-overlay" onClick={() => setResult(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">{result.match.round_label.toUpperCase()}</span><h2>{isDone(result.match) ? "Corregir resultado" : "Cargar resultado"}</h2></div>
              <button className="modal-close" onClick={() => setResult(null)} aria-label="Cerrar">×</button>
            </div>
            <form className="product-form" onSubmit={saveResult}>
              {!result.wo && tour.scoring !== "SETS" && (
                <div className="dp-score-form">
                  <label><span>{result.match.home_team}</span>
                    <input type="number" min="0" inputMode="numeric" value={result.home} onChange={(e) => setResult({ ...result, home: e.target.value })} required autoFocus /></label>
                  <label><span>{result.match.away_team}</span>
                    <input type="number" min="0" inputMode="numeric" value={result.away} onChange={(e) => setResult({ ...result, away: e.target.value })} required /></label>
                </div>
              )}
              {!result.wo && tour.scoring === "SETS" && (
                <div className="tn-sets-form">
                  <div className="tn-sets-head"><span /><b>{result.match.home_team}</b><b>{result.match.away_team}</b></div>
                  {result.sets.map((s, i) => (
                    <div key={i} className="tn-sets-row">
                      <span>Set {i + 1}</span>
                      <input type="number" min="0" inputMode="numeric" aria-label={`Set ${i + 1} ${result.match.home_team}`} value={s[0]}
                        onChange={(e) => setResult({ ...result, sets: result.sets.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })} />
                      <input type="number" min="0" inputMode="numeric" aria-label={`Set ${i + 1} ${result.match.away_team}`} value={s[1]}
                        onChange={(e) => setResult({ ...result, sets: result.sets.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })} />
                    </div>
                  ))}
                  {result.sets.length < 5 && <button type="button" className="dp-link-button" onClick={() => setResult({ ...result, sets: [...result.sets, ["", ""]] })}>+ Agregar set</button>}
                </div>
              )}
              {resTie && tour.scoring === "GOLES" && (
                <>
                  <p className="tn-finish-warn">Empataron y tiene que haber un ganador: cargá los penales.</p>
                  <div className="dp-score-form">
                    <label><span>Penales {result.match.home_team}</span>
                      <input type="number" min="0" inputMode="numeric" value={result.hp} onChange={(e) => setResult({ ...result, hp: e.target.value })} required /></label>
                    <label><span>Penales {result.match.away_team}</span>
                      <input type="number" min="0" inputMode="numeric" value={result.ap} onChange={(e) => setResult({ ...result, ap: e.target.value })} required /></label>
                  </div>
                </>
              )}
              {resTie && tour.scoring === "PUNTOS" && <p className="tn-finish-warn">No puede terminar empatado: cargá el resultado con el suplementario.</p>}
              <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                <label><input type="checkbox" checked={result.wo} onChange={(e) => setResult({ ...result, wo: e.target.checked })} /> Un equipo no se presentó (W.O.)</label>
              </div>
              {result.wo && (
                <div className="form-group">
                  <label htmlFor="rs-winner">¿Quién gana?</label>
                  <select id="rs-winner" value={result.winner} onChange={(e) => setResult({ ...result, winner: e.target.value })} required>
                    <option value="">Elegí un equipo</option>
                    <option value={result.match.home_team_id || ""}>{result.match.home_team}</option>
                    <option value={result.match.away_team_id || ""}>{result.match.away_team}</option>
                  </select>
                </div>
              )}
              {isDone(result.match) && (
                <div className="form-group">
                  <label htmlFor="rs-reason">Motivo de la corrección (opcional)</label>
                  <input id="rs-reason" value={result.reason} onChange={(e) => setResult({ ...result, reason: e.target.value })} maxLength={200} placeholder="Ej.: se cargó mal un gol" />
                  <small className="dp-muted">Queda registrado quién corrigió el resultado y cuándo.</small>
                </div>
              )}
              {modalError && <div className="login-error" role="alert">{modalError}</div>}
              <div className="modal-actions tn-modal-split">
                <div>{isDone(result.match) && <button type="button" className="product-action-delete" disabled={busy} onClick={clearResult}>Borrar resultado</button>}</div>
                <div>
                  <button type="button" className="secondary-button" onClick={() => setResult(null)}>Cancelar</button>
                  <button type="submit" className="primary-button" disabled={busy || (resTie && tour.scoring === "PUNTOS")}>Guardar resultado</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Torneos;
