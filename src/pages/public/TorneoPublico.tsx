import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicApi, shortDate } from "../../config";
import { DeportiaLogo, PoweredBy } from "../../components/Brand";
import {
  Bracket, LiveCard, MatchLine, Podium, StandingsTable, StatsBlocks, Timeline,
} from "../../components/torneos/TournamentViews";
import { FORMAT_LABEL, groupMatches, isDone, isLive, sportLabel, TIEBREAKER_LABEL } from "../../components/torneos/types";
import type { TournamentDetail, TournamentMatch } from "../../components/torneos/types";

interface PublicTournament extends TournamentDetail {
  complex: { name: string; slug: string; address: string | null; city: string | null; phone: string | null; web_reservas: boolean };
}

type Section = "posiciones" | "fixture" | "llave" | "stats";

const STATUS_LABEL: Record<string, string> = { EN_CURSO: "En curso", FINALIZADO: "Finalizado" };
const PLAY = ["INICIO", "GOL", "AMARILLA", "ROJA", "ENTRETIEMPO", "REANUDA", "FIN_SET", "FIN"];

/**
 * Página pública de solo lectura para compartir con los equipos: posiciones, fixture, llave,
 * goleadores y marcador en vivo. Solo muestra nombres de equipos y jugadores.
 * Se actualiza sola: cada 15 s si hay un partido en juego, cada minuto si no.
 */
function TorneoPublico() {
  const { slug = "", id = "" } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<PublicTournament | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section | null>(null);
  const [openMatch, setOpenMatch] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const fetchedAt = useRef<number>(Date.now());
  const printed = useRef<boolean>(false);
  const hasLive = !!t && t.live_count > 0;

  async function load() {
    try {
      const d = await publicApi<PublicTournament>(`/public/complexes/${slug}/tournaments/${id}`);
      fetchedAt.current = Date.now();
      setT(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No encontramos el torneo");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  useEffect(() => {
    const i = setInterval(load, hasLive ? 15000 : 60000);
    const tick = hasLive ? setInterval(() => setTick((x) => x + 1), 1000) : null;
    return () => { clearInterval(i); if (tick) clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id, hasLive]);

  // link «Imprimir fixture y tabla» del sistema: abre el diálogo de impresión una sola vez
  useEffect(() => {
    if (t && !printed.current && new URLSearchParams(window.location.search).get("imprimir")) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [t]);

  useEffect(() => { if (t) document.title = `${t.name} · ${t.complex.name}`; }, [t]);

  if (error && !t) {
    return <main className="pub-page"><div className="pub-empty"><h1>Torneo no encontrado</h1><p>{error}</p></div></main>;
  }
  if (!t) return <main className="pub-page"><div className="pub-empty"><div className="products-loading-spinner" /></div></main>;

  const tour = t;
  const real = tour.matches.filter((m) => !m.is_bye);
  const live = real.filter(isLive);
  const hasTables = tour.format !== "ELIMINACION";
  const hasBracket = tour.format !== "LIGA" && tour.matches.some((m) => m.stage === "LLAVE");
  const sections: { id: Section; label: string }[] = [
    ...(hasTables ? [{ id: "posiciones" as Section, label: tour.format === "GRUPOS" ? "Grupos" : "Posiciones" }] : []),
    ...(hasBracket ? [{ id: "llave" as Section, label: "Llave" }] : []),
    { id: "fixture", label: "Fixture" },
    { id: "stats", label: tour.scoring === "GOLES" ? "Goleadores" : "Estadísticas" },
  ];
  const current: Section = section && sections.some((s) => s.id === section) ? section : sections[0].id;
  const rounds = groupMatches(tour.matches.filter((m) => !m.is_bye || m.stage === "LLAVE"));
  const clockOf = (m: TournamentMatch) => m.clock_seconds + (m.clock_running ? (Date.now() - (fetchedAt.current ?? Date.now())) / 1000 : 0);
  const cls = (s: Section, print = false) => `pub-tour-card tn-pub-section ${current === s ? "" : "is-hidden"} ${print ? "tn-print" : "tn-noprint"}`;

  return (
    <main className="pub-page pub-tour-page">
      <div className="pub-tour">
        <header className="pub-tour-head">
          <div className="pub-tour-brand"><DeportiaLogo size={28} /><span>{tour.complex.name}</span></div>
          <h1>{tour.name}</h1>
          <p>
            {sportLabel(tour.sport)} · {FORMAT_LABEL[tour.format]} · {STATUS_LABEL[tour.status] || tour.status} · {tour.played_count} de {tour.matches_count} partidos jugados
          </p>
          {tour.prizes && <p className="pub-tour-prizes">🏅 {tour.prizes}</p>}
        </header>

        <Podium t={tour} />

        {live.length > 0 && (
          <section className="tn-livecards tn-noprint" aria-label="Partidos en juego">
            {live.map((m) => <LiveCard key={m.id} m={m} teams={tour.teams} scoring={tour.scoring} clock={clockOf(m)} />)}
            <p className="tn-live-auto">El marcador se actualiza solo cada 15 segundos.</p>
          </section>
        )}

        <nav className="tn-tabs tn-noprint" role="tablist" aria-label="Secciones">
          {sections.map((s) => (
            <button key={s.id} role="tab" aria-selected={current === s.id} className={current === s.id ? "is-on" : ""} onClick={() => setSection(s.id)}>{s.label}</button>
          ))}
        </nav>

        {hasTables && (
          <section className={cls("posiciones", true)}>
            {tour.format === "LIGA" ? (
              <>
                <h2>Tabla de posiciones</h2>
                {tour.standings.length === 0 ? <p>Todavía no hay equipos cargados.</p>
                  : <StandingsTable rows={tour.standings} teams={tour.teams} allowDraw={tour.allow_draw} scoring={tour.scoring} />}
              </>
            ) : tour.groups.length === 0 ? <p>Los grupos todavía no están armados.</p> : tour.groups.map((g) => (
              <div key={g.name} className="tn-pub-group">
                <h2>Grupo {g.name}</h2>
                <StandingsTable rows={g.standings} teams={tour.teams} allowDraw={tour.allow_draw} scoring={tour.scoring} qualify={tour.qualify_per_group || 0} />
              </div>
            ))}
            <p className="tn-pub-note">
              Victoria {tour.points_win}{tour.allow_draw ? ` · empate ${tour.points_draw}` : ""} · derrota {tour.points_loss}. Desempata por {tour.tiebreakers.map((x) => TIEBREAKER_LABEL[x].toLowerCase()).join(", ")}.
              {tour.format === "GRUPOS" ? ` Pasan a la llave los ${tour.qualify_per_group === 1 ? "primeros" : `${tour.qualify_per_group} primeros`} de cada grupo.` : ""}
            </p>
          </section>
        )}

        {hasBracket && (
          <section className={cls("llave", true)}>
            <h2>Llave</h2>
            <Bracket matches={tour.matches} />
          </section>
        )}

        <section className={cls("fixture", true)}>
          <h2 className="tn-print-only">Fixture</h2>
          {rounds.length === 0 ? <p>El fixture todavía no está cargado.</p> : rounds.map((r) => (
            <div key={r.key} className="tn-pub-round">
              <h3>{r.label}</h3>
              <div className="tn-lines">
                {r.matches.map((m) => {
                  const events = m.events.filter((e) => PLAY.includes(e.type));
                  const canOpen = (isDone(m) || isLive(m)) && events.length > 0;
                  return (
                    <div key={m.id}>
                      <MatchLine m={m} teams={tour.teams} onOpen={canOpen ? () => setOpenMatch(openMatch === m.id ? null : m.id) : undefined} />
                      {openMatch === m.id && canOpen && (
                        <div className="tn-pub-timeline tn-noprint"><Timeline events={events} scoring={tour.scoring} sport={tour.sport} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="tn-pub-note tn-noprint">Tocá un partido jugado para ver cómo fue.</p>
        </section>

        <section className={`tn-pub-section tn-noprint ${current === "stats" ? "" : "is-hidden"}`}>
          <StatsBlocks t={tour} />
        </section>

        <div className="tn-pub-actions tn-noprint">
          <button className="pub-cta pub-cta-outline" onClick={() => window.print()}>Imprimir fixture y tabla</button>
          {tour.complex.web_reservas && (
            <button className="pub-cta" onClick={() => navigate(`/r/${tour.complex.slug}`)}>Reservar una cancha en {tour.complex.name}</button>
          )}
        </div>

        <p className="tn-pub-privacy">
          {tour.complex.name}{[tour.complex.address, tour.complex.city].filter(Boolean).length ? ` · ${[tour.complex.address, tour.complex.city].filter(Boolean).join(", ")}` : ""}.
          {" "}Acá solo se muestran nombres de equipos y jugadores. Si querés que se corrija o se quite un nombre, pedíselo al complejo.{" "}
          <span className="tn-noprint">Leé la <Link to="/legal/privacidad">Política de privacidad</Link>.</span>
          <span className="tn-print-only"> Impreso el {shortDate(tour.now)}.</span>
        </p>
      </div>
      <footer className="pub-footer tn-noprint"><PoweredBy /></footer>
    </main>
  );
}

export default TorneoPublico;
