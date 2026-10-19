// Asistente para crear (o editar) un torneo en 4 pasos cortos.
import { useState } from "react";
import { appApi, minutesLabel, SPORTS, SPORT_LABELS } from "../../config";
import type { Court } from "../../config";
import { scoringOf, TIEBREAKER_LABEL } from "./types";
import type { Tiebreaker, TournamentDetail, TournamentFormat } from "./types";

interface Props {
  courts: Court[];
  /** torneo a editar (vacío = nuevo) */
  initial: TournamentDetail | null;
  onSaved: (d: TournamentDetail) => void;
  onClose: () => void;
}

const STEPS = ["Datos", "Formato", "Canchas y costos", "Reglas"];

const FORMATS: { id: TournamentFormat; title: string; text: string }[] = [
  { id: "LIGA", title: "Liga", text: "Todos contra todos. Gana el que suma más puntos." },
  { id: "ELIMINACION", title: "Eliminación directa", text: "El que pierde queda afuera. Si faltan equipos para completar la llave, los primeros pasan directo." },
  { id: "GRUPOS", title: "Grupos + eliminación", text: "Primero grupos todos contra todos; los mejores pasan a la llave (1° A vs 2° B…)." },
];

function TournamentWizard({ courts, initial, onSaved, onClose }: Props) {
  const editing = !!initial;
  const hasFixture = !!initial && initial.matches.length > 0;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState(() => ({
    name: initial?.name || "",
    sport: initial?.sport || "futbol",
    starts_on: initial?.starts_on || "",
    ends_on: initial?.ends_on || "",
    format: (initial?.format || "LIGA") as TournamentFormat,
    double_round: initial?.double_round || false,
    third_place: initial?.third_place || false,
    groups_count: String(initial?.groups_count || 2),
    qualify_per_group: String(initial?.qualify_per_group || 2),
    court_ids: initial ? (initial.court_ids || []) : courts.filter((c) => c.active && c.sport === "futbol").map((c) => c.id),
    match_minutes: String(initial?.match_minutes || 60),
    entry_fee: initial?.entry_fee ? String(initial.entry_fee) : "",
    prizes: initial?.prizes || "",
    points_win: String(initial?.points_win ?? 3),
    points_draw: String(initial?.points_draw ?? 1),
    points_loss: String(initial?.points_loss ?? 0),
    allow_draw: initial?.allow_draw ?? true,
    tiebreakers: (initial?.tiebreakers || ["DIF", "GF", "H2H"]) as Tiebreaker[],
    notes: initial?.notes || "",
  }));
  const set = (patch: Partial<typeof f>) => setF((old) => ({ ...old, ...patch }));

  const scoring = scoringOf(f.sport);
  const noDraw = scoring !== "GOLES";
  const sportCourts = courts.filter((c) => c.active);

  function pickSport(sport: string) {
    const nd = scoringOf(sport) !== "GOLES";
    set({
      sport, allow_draw: !nd,
      points_draw: nd ? "0" : f.points_draw === "0" ? "1" : f.points_draw,
      // canchas del deporte elegido, ya tildadas
      court_ids: courts.filter((c) => c.active && c.sport === sport).map((c) => c.id),
    });
  }

  function toggleCourt(id: number) {
    set({ court_ids: f.court_ids.includes(id) ? f.court_ids.filter((x) => x !== id) : [...f.court_ids, id] });
  }

  function moveTie(i: number, dir: -1 | 1) {
    const list = [...f.tiebreakers];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ tiebreakers: list });
  }

  /** Lo que falta para pasar de paso */
  function stepError(s: number): string {
    if (s === 0) {
      if (f.name.trim().length < 2) return "Escribí el nombre del torneo.";
      if (f.starts_on && f.ends_on && f.ends_on < f.starts_on) return "La fecha de fin no puede ser anterior a la de inicio.";
    }
    if (s === 1 && f.format === "GRUPOS") {
      const g = Number(f.groups_count), q = Number(f.qualify_per_group);
      if (!(g >= 2 && g <= 8)) return "La cantidad de grupos tiene que estar entre 2 y 8.";
      if (!(q >= 1 && q <= 4)) return "Por grupo pueden clasificar entre 1 y 4 equipos.";
    }
    if (s === 2 && f.entry_fee !== "" && Number(f.entry_fee) < 0) return "La inscripción no puede ser negativa.";
    if (s === 3 && [f.points_win, f.points_draw, f.points_loss].some((p) => p === "" || Number(p) < 0 || Number(p) > 20)) {
      return "Los puntos tienen que estar entre 0 y 20.";
    }
    return "";
  }

  function next() {
    const msg = stepError(step);
    setError(msg);
    if (!msg) setStep(step + 1);
  }

  async function save() {
    for (let s = 0; s < STEPS.length; s++) {
      const msg = stepError(s);
      if (msg) { setStep(s); setError(msg); return; }
    }
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = {
      name: f.name.trim(), starts_on: f.starts_on || null, ends_on: f.ends_on || null,
      court_ids: f.court_ids, match_minutes: Number(f.match_minutes) || null,
      entry_fee: Number(f.entry_fee || 0), prizes: f.prizes.trim() || null,
      points_win: Number(f.points_win), points_draw: Number(f.points_draw), points_loss: Number(f.points_loss),
      allow_draw: noDraw ? false : f.allow_draw, tiebreakers: f.tiebreakers, notes: f.notes.trim() || null,
    };
    if (!hasFixture) {
      // con el fixture armado, el formato y el deporte ya no se cambian
      Object.assign(body, {
        sport: f.sport, format: f.format, double_round: f.format === "ELIMINACION" ? false : f.double_round,
        third_place: f.format === "LIGA" ? false : f.third_place,
        groups_count: f.format === "GRUPOS" ? Number(f.groups_count) : null,
        qualify_per_group: f.format === "GRUPOS" ? Number(f.qualify_per_group) : null,
      });
    }
    try {
      const d = await appApi<TournamentDetail>(editing ? `/tournaments/${initial!.id}` : "/tournaments", { method: editing ? "PUT" : "POST", body });
      onSaved(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const last = step === STEPS.length - 1;
  const g = Number(f.groups_count) || 2, q = Number(f.qualify_per_group) || 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal tn-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="dashboard-eyebrow">{editing ? "EDITAR TORNEO" : "NUEVO TORNEO"} · PASO {step + 1} DE {STEPS.length}</span>
            <h2>{STEPS[step]}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <ol className="tn-steps" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "is-on" : i < step ? "is-done" : ""}>
              <button type="button" onClick={() => { if (i < step || !stepError(step)) { setError(""); setStep(i); } else setError(stepError(step)); }}>
                <b>{i < step ? "✓" : i + 1}</b><span>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <form className="product-form" onSubmit={(e) => { e.preventDefault(); if (last) save(); else next(); }}>
          {step === 0 && (
            <>
              <div className="form-group">
                <label htmlFor="tn-name">Nombre del torneo</label>
                <input id="tn-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej.: Liga de los jueves" maxLength={150} autoFocus required />
              </div>
              <div className="form-group">
                <label>Deporte</label>
                <div className="tn-choice-row">
                  {SPORTS.map((s) => (
                    <button key={s} type="button" disabled={hasFixture} className={`tn-chip ${f.sport === s ? "is-on" : ""}`} onClick={() => pickSport(s)}>{SPORT_LABELS[s]}</button>
                  ))}
                </div>
                {noDraw && <small className="dp-muted">{scoring === "SETS" ? "Se juega por sets: el resultado se carga set por set y no hay empate." : "Se anota por puntos (de a 1, 2 o 3) y no hay empate."}</small>}
              </div>
              <div className="form-row">
                <div className="form-group"><label htmlFor="tn-from">Empieza (opcional)</label><input id="tn-from" type="date" value={f.starts_on} onChange={(e) => set({ starts_on: e.target.value })} /></div>
                <div className="form-group"><label htmlFor="tn-to">Termina (opcional)</label><input id="tn-to" type="date" value={f.ends_on} min={f.starts_on || undefined} onChange={(e) => set({ ends_on: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {hasFixture && <p className="tn-note-box">El fixture ya está armado: para cambiar el formato hay que rehacer el fixture.</p>}
              <div className="tn-format-grid" role="radiogroup" aria-label="Formato">
                {FORMATS.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={f.format === o.id} disabled={hasFixture}
                    className={`tn-format ${f.format === o.id ? "is-on" : ""}`} onClick={() => set({ format: o.id })}>
                    <b>{o.title}</b><span>{o.text}</span>
                  </button>
                ))}
              </div>
              {f.format === "GRUPOS" && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="tn-groups">Cantidad de grupos</label>
                    <select id="tn-groups" value={f.groups_count} disabled={hasFixture} onChange={(e) => set({ groups_count: e.target.value })}>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} grupos</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="tn-qualify">Clasifican por grupo</label>
                    <select id="tn-qualify" value={f.qualify_per_group} disabled={hasFixture} onChange={(e) => set({ qualify_per_group: e.target.value })}>
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? "El 1°" : `Los ${n} primeros`}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                {f.format !== "ELIMINACION" && (
                  <label><input type="checkbox" checked={f.double_round} disabled={hasFixture} onChange={(e) => set({ double_round: e.target.checked })} /> Ida y vuelta{f.format === "GRUPOS" ? " en los grupos" : ""}</label>
                )}
                {f.format !== "LIGA" && (
                  <label><input type="checkbox" checked={f.third_place} disabled={hasFixture} onChange={(e) => set({ third_place: e.target.checked })} /> Partido por el tercer puesto</label>
                )}
              </div>
              <p className="tn-note-box">
                {f.format === "LIGA" && (f.double_round ? "Cada equipo juega dos veces contra cada rival (ida y vuelta)." : "Cada equipo juega una vez contra cada rival.")}
                {f.format === "ELIMINACION" && "Los cruces se arman solos. Si los equipos no son 4, 8, 16…, algunos pasan directo a la ronda siguiente."}
                {f.format === "GRUPOS" && `${g} grupos; pasan ${q * g} equipos a la llave. Los cruces se arman solos cuando termina la fase de grupos${q === 2 ? " (1° A vs 2° B, 1° B vs 2° A…)" : ""}.`}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label>Canchas que se van a usar</label>
                {sportCourts.length === 0 ? <small className="dp-muted">Todavía no hay canchas cargadas. Podés crear el torneo igual y elegirlas después.</small> : (
                  <div className="tn-choice-row">
                    {sportCourts.map((c) => (
                      <button key={c.id} type="button" aria-pressed={f.court_ids.includes(c.id)} className={`tn-chip ${f.court_ids.includes(c.id) ? "is-on" : ""}`} onClick={() => toggleCourt(c.id)}>
                        {f.court_ids.includes(c.id) ? "✓ " : ""}{c.name}
                      </button>
                    ))}
                  </div>
                )}
                <small className="dp-muted">Sirven para programar varios partidos de una. Cada partido programado bloquea su cancha en Turnos.</small>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tn-min">Duración de cada partido</label>
                  <select id="tn-min" value={f.match_minutes} onChange={(e) => set({ match_minutes: e.target.value })}>
                    {Array.from(new Set([Number(f.match_minutes), 30, 45, 60, 75, 90, 120, 150, 180])).sort((a, b) => a - b).map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                  </select>
                  <small className="dp-muted">Es el tiempo que se reserva la cancha.</small>
                </div>
                <div className="form-group">
                  <label htmlFor="tn-fee">Inscripción por equipo</label>
                  <div className="dp-input-suffix"><input id="tn-fee" type="number" min="0" step="any" inputMode="decimal" value={f.entry_fee} placeholder="0" onChange={(e) => set({ entry_fee: e.target.value })} /><span>$</span></div>
                  <small className="dp-muted">Si es gratis, dejalo vacío.</small>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="tn-prizes">Premios (opcional)</label>
                <textarea id="tn-prizes" rows={2} maxLength={500} value={f.prizes} placeholder="Ej.: Copa y medallas para el campeón, asado para el subcampeón" onChange={(e) => set({ prizes: e.target.value })} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-row">
                <div className="form-group"><label htmlFor="tn-pw">Puntos por victoria</label><input id="tn-pw" type="number" min="0" max="20" value={f.points_win} onChange={(e) => set({ points_win: e.target.value })} /></div>
                {!noDraw && f.allow_draw && (
                  <div className="form-group"><label htmlFor="tn-pd">Por empate</label><input id="tn-pd" type="number" min="0" max="20" value={f.points_draw} onChange={(e) => set({ points_draw: e.target.value })} /></div>
                )}
                <div className="form-group"><label htmlFor="tn-pl">Por derrota</label><input id="tn-pl" type="number" min="0" max="20" value={f.points_loss} onChange={(e) => set({ points_loss: e.target.value })} /></div>
              </div>
              {!noDraw && (
                <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                  <label><input type="checkbox" checked={f.allow_draw} onChange={(e) => set({ allow_draw: e.target.checked })} /> Los partidos de liga o de grupos pueden terminar empatados</label>
                </div>
              )}
              <div className="form-group">
                <label>Si dos equipos empatan en puntos, se define por (en este orden)</label>
                <ol className="tn-tiebreak">
                  <li className="is-fixed"><b>1</b><span>Puntos</span><small>siempre primero</small></li>
                  {f.tiebreakers.map((tb, i) => (
                    <li key={tb}>
                      <b>{i + 2}</b><span>{scoring === "GOLES" ? TIEBREAKER_LABEL[tb] : tb === "DIF" ? "Diferencia" : tb === "GF" ? "A favor" : TIEBREAKER_LABEL[tb]}</span>
                      <span className="tn-tiebreak-move">
                        <button type="button" disabled={i === 0} onClick={() => moveTie(i, -1)} aria-label="Subir">▲</button>
                        <button type="button" disabled={i === f.tiebreakers.length - 1} onClick={() => moveTie(i, 1)} aria-label="Bajar">▼</button>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="form-group">
                <label htmlFor="tn-notes">Reglamento o notas (opcional)</label>
                <textarea id="tn-notes" rows={2} maxLength={500} value={f.notes} placeholder="Ej.: tolerancia de 10 minutos, 2 tiempos de 25" onChange={(e) => set({ notes: e.target.value })} />
              </div>
            </>
          )}

          {error && <div className="login-error" role="alert">{error}</div>}
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="secondary-button" onClick={() => (step === 0 ? onClose() : (setError(""), setStep(step - 1)))}>{step === 0 ? "Cancelar" : "‹ Atrás"}</button>
            <div style={{ display: "flex", gap: 8 }}>
              {editing && !last && <button type="button" className="secondary-button" disabled={saving} onClick={save}>Guardar</button>}
              <button type="submit" className="primary-button" disabled={saving}>
                {last ? (saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear torneo") : "Siguiente ›"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TournamentWizard;
