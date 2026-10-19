import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  appApi, money, timeRange, hhmm, dayKey, parseDay, addDays, addMinutes, dayLabel, courtWindow, overlaps,
  getSessionUser, minutesLabel, COURT_STATUS, SPORTS, SPORT_LABELS,
} from "../../config";
import type { Booking, Court } from "../../config";
import CourtIcon from "../../components/CourtIcon";
import BookingModal from "../../components/BookingModal";
import BookingForm from "../../components/BookingForm";
import CourtPlan from "../../components/CourtPlan";

type SlotItem =
  | { kind: "free"; start: Date; end: Date; past: boolean }
  | { kind: "booking"; booking: Booking; start: Date; end: Date; state: "RESERVADA" | "OCUPADA" | "PASADO" };

const EMPTY_COURT = {
  name: "", sport: "futbol", description: "", players: "10", price_per_hour: "",
  slot_minutes: "60", open_time: "09:00", close_time: "24:00", sort_order: "0", active: true, covered: false,
};

const LIVE = "live";

/** Estado de una cancha en un momento (misma regla que el servidor) */
function statusAt(court: Court, bookings: Booking[], at: Date): { status: string; booking: Booking | null } {
  const mine = bookings.filter((b) => b.court_id === court.id && (b.status === "RESERVADO" || b.status === "EN_CURSO" || b.status === "PENDIENTE_PAGO"));
  const inUse = mine.find((b) => b.status === "EN_CURSO" && new Date(b.end_at) > at && addMinutes(new Date(b.start_at), -30) <= at);
  if (inUse) return { status: "OCUPADA", booking: inUse };
  const reserved = mine.find((b) => new Date(b.start_at) <= at && at < new Date(b.end_at));
  if (reserved) return { status: "RESERVADA", booking: reserved };
  const [open, close] = courtWindow(court, at);
  const [pOpen, pClose] = courtWindow(court, addDays(at, -1));
  const isOpen = (at >= open && at < close) || (at >= pOpen && at < pClose);
  return { status: isOpen ? "LIBRE" : "CERRADA", booking: null };
}

function buildTimeline(court: Court, bookings: Booking[], day: Date, now: Date, step = 30): SlotItem[] {
  const [open, close] = courtWindow(court, day);
  const dur = court.slot_minutes;
  const mine = bookings
    .filter((b) => b.court_id === court.id && b.status !== "CANCELADO")
    .map((b) => ({ b, s: new Date(b.start_at), e: new Date(b.end_at) }))
    .filter((x) => overlaps(x.s, x.e, open, close))
    .sort((a, b) => a.s.getTime() - b.s.getTime());

  const items: SlotItem[] = [];
  let t = new Date(open);
  let guard = 0;
  while (t < close && guard++ < 500) {
    const current = mine.find((x) => x.s <= t && t < x.e);
    if (current) {
      const live = current.b.status === "RESERVADO" || current.b.status === "EN_CURSO" || current.b.status === "PENDIENTE_PAGO";
      items.push({
        kind: "booking", booking: current.b, start: current.s, end: current.e,
        state: !live ? "PASADO" : current.b.status === "EN_CURSO" ? "OCUPADA" : "RESERVADA",
      });
      t = current.e > t ? new Date(current.e) : addMinutes(t, step);
      continue;
    }
    const next = mine.find((x) => x.s > t);
    const limit = next && next.s < close ? next.s : close;
    let s = new Date(t);
    let added = false;
    while (addMinutes(s, dur) <= limit) {
      items.push({ kind: "free", start: s, end: addMinutes(s, dur), past: s < now });
      s = addMinutes(s, step);
      added = true;
    }
    if (!added && limit > t) {
      // hueco más corto que un turno: se puede reservar a mano desde "Nuevo turno"
    }
    t = limit > t ? new Date(limit) : addMinutes(t, step);
  }
  return items;
}

function Canchas() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [params, setParams] = useSearchParams();
  const user = getSessionUser();
  const canManage = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";

  const [courts, setCourts] = useState<Court[]>([]);
  const [allCourts, setAllCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [day, setDay] = useState(dayKey(new Date()));
  const [moment, setMoment] = useState<string>(LIVE); // LIVE o "HH:MM"
  const [showTimes, setShowTimes] = useState(false);
  const [view, setView] = useState<"plano" | "tarjetas">(() => {
    // en celular el plano queda chico: se arranca con tarjetas, salvo que la persona haya elegido otra cosa
    try { const v = localStorage.getItem("dp_canchas_view"); if (v === "tarjetas" || v === "plano") return v; } catch { /* sin storage */ }
    return typeof window !== "undefined" && window.innerWidth < 640 ? "tarjetas" : "plano";
  });
  const chooseView = (v: "plano" | "tarjetas") => { setView(v); try { localStorage.setItem("dp_canchas_view", v); } catch { /* sin storage */ } };
  const [now, setNow] = useState(new Date());
  const [selectedCourt, setSelectedCourt] = useState<number | null>(Number(params.get("court")) || null);
  const [loading, setLoading] = useState(true);

  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [newBooking, setNewBooking] = useState<{ courtId: number; start: Date } | null>(null);

  const [courtForm, setCourtForm] = useState<typeof EMPTY_COURT | null>(null);
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [courtError, setCourtError] = useState("");
  const [showManage, setShowManage] = useState(false);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  const dayDate = parseDay(day);
  const isToday = day === dayKey(now);

  async function loadCourts() {
    try {
      const all = await appApi<Court[]>("/courts?include_inactive=true");
      setAllCourts(all);
      const act = all.filter((c) => c.active);
      setCourts(act);
      setSelectedCourt((cur) => (cur && act.some((c) => c.id === cur) ? cur : act[0]?.id ?? null));
    } catch { /* noop */ }
  }

  async function loadBookings() {
    try {
      // traemos también el día anterior por canchas que cierran después de medianoche
      const prev = dayKey(addDays(dayDate, -1));
      setBookings(await appApi<Booking[]>(`/bookings?date=${prev}&date_to=${day}`));
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCourts(); }, []);
  useEffect(() => { loadBookings(); }, [day, refreshKey]);
  useEffect(() => {
    const t = setInterval(() => { setNow(new Date()); loadBookings(); }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // momento que se está mirando
  const at = useMemo(() => {
    if (moment === LIVE && isToday) return now;
    const [h, m] = (moment === LIVE ? "12:00" : moment).split(":").map(Number);
    const d = new Date(dayDate);
    d.setHours(h, m, 0, 0);
    return d;
  }, [moment, day, now]);

  const timeOptions = useMemo(() => {
    if (!courts.length) return [];
    const opens = courts.map((c) => courtWindow(c, dayDate));
    const from = new Date(Math.min(...opens.map((w) => w[0].getTime())));
    const to = new Date(Math.max(...opens.map((w) => w[1].getTime())));
    const out: Date[] = [];
    for (let t = from; t < to; t = addMinutes(t, 30)) out.push(t);
    return out;
  }, [courts, day]);

  const court = courts.find((c) => c.id === selectedCourt) || null;
  const timeline = useMemo(() => (court ? buildTimeline(court, bookings, dayDate, now) : []), [court, bookings, day, now]);

  function upsertBooking(b: Booking) {
    setBookings((list) => (list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? b : x)) : [...list, b]));
  }

  async function searchCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeError("");
    try {
      const b = await appApi<Booking>(`/bookings/by-code/${encodeURIComponent(code.trim())}`);
      setDay(b.start_at.slice(0, 10));
      setSelectedCourt(b.court_id);
      setOpenBooking(b);
      setCode("");
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "No encontrado");
    }
  }

  // ---------- ABM de canchas ----------
  function openCourtForm(c?: Court) {
    setCourtError("");
    if (c) {
      setEditingCourtId(c.id);
      setCourtForm({
        name: c.name, sport: c.sport, description: c.description || "", players: String(c.players),
        price_per_hour: String(Number(c.price_per_hour)), slot_minutes: String(c.slot_minutes),
        open_time: c.open_time, close_time: c.close_time, sort_order: String(c.sort_order), active: c.active, covered: !!c.covered,
      });
    } else {
      setEditingCourtId(null);
      setCourtForm({ ...EMPTY_COURT, name: `Cancha ${allCourts.length + 1}`, sort_order: String(allCourts.length) });
    }
  }

  async function saveCourt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!courtForm) return;
    setCourtError("");
    const body = {
      ...courtForm,
      players: Number(courtForm.players) || 1,
      price_per_hour: Number(courtForm.price_per_hour) || 0,
      slot_minutes: Number(courtForm.slot_minutes) || 60,
      sort_order: Number(courtForm.sort_order) || 0,
      description: courtForm.description || null,
    };
    try {
      if (editingCourtId) await appApi(`/courts/${editingCourtId}`, { method: "PUT", body });
      else {
        const created = await appApi<Court>("/courts", { method: "POST", body });
        setSelectedCourt(created.id);
      }
      setCourtForm(null);
      await loadCourts();
    } catch (err) {
      setCourtError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function deleteCourt() {
    if (!editingCourtId || !confirm("¿Eliminar esta cancha? Si tiene turnos, queda desactivada.")) return;
    try {
      const r = await appApi<{ detail: string }>(`/courts/${editingCourtId}`, { method: "DELETE" });
      alert(r.detail);
      setCourtForm(null);
      await loadCourts();
    } catch (err) {
      setCourtError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  const momentLabel = moment === LIVE && isToday ? `Ahora · ${hhmm(now)}` : `${dayLabel(dayDate)} · ${hhmm(at)}`;

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">CANCHAS / ZONAS</span>
          <h1>Canchas</h1>
          <p>Verde libre · naranja reservada · rojo en uso.</p>
        </div>
        <div className="products-header-actions">
          <form onSubmit={searchCode} className="dp-code-search">
            <input placeholder="Código del turno" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="secondary-button" type="submit">Buscar</button>
          </form>
          {canManage && <button className="secondary-button" onClick={() => setShowManage(true)}>Administrar canchas</button>}
          {canManage && <button className="primary-button" onClick={() => openCourtForm()}>+ Nueva cancha</button>}
        </div>
      </div>
      {codeError && <div className="login-error" style={{ marginBottom: 14 }}>{codeError}</div>}

      {/* ---------- Día + persiana de horarios ---------- */}
      <div className="dp-toolbar">
        <div className="dp-day-nav">
          <button className="secondary-button" onClick={() => { setDay(dayKey(addDays(dayDate, -1))); setMoment("12:00"); }}>‹</button>
          <button className={isToday ? "primary-button" : "secondary-button"} onClick={() => { setDay(dayKey(new Date())); setMoment(LIVE); }}>Hoy</button>
          <button className="secondary-button" onClick={() => { setDay(dayKey(addDays(dayDate, 1))); setMoment(moment === LIVE ? "18:00" : moment); }}>›</button>
          <input type="date" value={day} onChange={(e) => { if (e.target.value) { setDay(e.target.value); if (e.target.value !== dayKey(new Date()) && moment === LIVE) setMoment("18:00"); } }} />
        </div>
        <div className="dp-blind">
          <button className="dp-blind-toggle" onClick={() => setShowTimes(!showTimes)}>
            <span className={`dp-live-dot ${moment === LIVE && isToday ? "on" : ""}`} />
            {momentLabel} <span className="dp-blind-caret">{showTimes ? "▴" : "▾"}</span>
          </button>
        </div>
      </div>
      {showTimes && (
        <div className="dp-blind-panel">
          {isToday && (
            <button className={`dp-time-chip ${moment === LIVE ? "is-on" : ""}`} onClick={() => { setMoment(LIVE); setShowTimes(false); }}>
              ● Ahora
            </button>
          )}
          {timeOptions.map((t) => (
            <button key={t.getTime()}
              className={`dp-time-chip ${moment === hhmm(t) ? "is-on" : ""} ${isToday && t < addMinutes(now, -30) ? "is-past" : ""}`}
              onClick={() => { setMoment(hhmm(t)); setShowTimes(false); }}>
              {hhmm(t)}
            </button>
          ))}
        </div>
      )}

      {loading && !courts.length ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : courts.length === 0 ? (
        <div className="products-empty">
          <div className="products-empty-icon">▦</div>
          <h3>Todavía no hay canchas</h3>
          <p>Creá tus canchas o zonas: deporte, precio por hora, duración del turno y horario.</p>
          {canManage && <button className="primary-button" onClick={() => openCourtForm()}>+ Crear la primera cancha</button>}
        </div>
      ) : (
        <>
          <div className="dp-view-toggle" role="group" aria-label="Cómo ver las canchas">
            <button type="button" aria-pressed={view === "plano"} onClick={() => chooseView("plano")}>Plano</button>
            <button type="button" aria-pressed={view === "tarjetas"} onClick={() => chooseView("tarjetas")}>Tarjetas</button>
          </div>
          {view === "plano" && (
            <CourtPlan courts={courts} statusFor={(c) => statusAt(c, bookings, at)} selectedId={selectedCourt}
              onSelect={(id) => { setSelectedCourt(id); setParams({ court: String(id) }, { replace: true }); }}
              onOpenBooking={setOpenBooking} canManage={canManage} onSaved={loadCourts} />
          )}
          {/* ---------- Tablero: canchas vistas desde arriba ---------- */}
          {view === "tarjetas" && <div className="dp-court-board">
            {courts.map((c) => {
              const { status, booking } = statusAt(c, bookings, at);
              const color = COURT_STATUS[status].color;
              const next = bookings
                .filter((b) => b.court_id === c.id && (b.status === "RESERVADO" || b.status === "PENDIENTE_PAGO") && new Date(b.start_at) > at)
                .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
              return (
                <div key={c.id} className={`dp-court-card ${selectedCourt === c.id ? "is-selected" : ""}`}
                  style={{ borderColor: selectedCourt === c.id ? color : undefined }}
                  onClick={() => { setSelectedCourt(c.id); setParams({ court: String(c.id) }, { replace: true }); }}>
                  <div className="dp-court-visual">
                    <CourtIcon sport={c.sport} width={220} fill={color} />
                    {status === "OCUPADA" && <span className="dp-court-flag">EN USO</span>}
                  </div>
                  <div className="dp-court-info">
                    <div>
                      <strong>{c.name}</strong>
                      <small>{SPORT_LABELS[c.sport]} · {c.players} jugadores · {money(c.price_per_hour)}/h</small>
                    </div>
                    <span className="dp-pill" style={{ background: COURT_STATUS[status].solid, color: "#fff" }}>{COURT_STATUS[status].label}</span>
                  </div>
                  {booking ? (
                    <button className="dp-court-booking" onClick={(e) => { e.stopPropagation(); setOpenBooking(booking); }}>
                      <span>{timeRange(booking.start_at, booking.end_at)} · <b>{booking.customer_name}</b>{booking.players_count ? ` · ${booking.players_count}p` : ""}{booking.recurring_id ? " · Fijo" : ""}</span>
                      <span>{booking.status === "PENDIENTE_PAGO" ? "Esperando seña" : status === "RESERVADA" ? "Confirmar código ›" : booking.paid ? "Pagado ✓" : "Cobrar ›"}</span>
                    </button>
                  ) : (
                    <div className="dp-court-next">{next ? `Próximo: ${timeRange(next.start_at, next.end_at)} · ${next.customer_name}` : "Sin próximos turnos"}</div>
                  )}
                  {canManage && (
                    <button className="dp-court-gear" title="Editar cancha" onClick={(e) => { e.stopPropagation(); openCourtForm(c); }}>⚙</button>
                  )}
                </div>
              );
            })}
          </div>}

          {/* ---------- Horarios de la cancha elegida ---------- */}
          {court && (
            <div className="dashboard-section" style={{ marginTop: 18 }}>
              <div className="section-heading dp-heading-row">
                <div>
                  <h2>{court.name} · horarios de {dayLabel(dayDate).toLowerCase()}</h2>
                  <p>Turnos de {minutesLabel(court.slot_minutes)} · abre {court.open_time} a {court.close_time} · {money((Number(court.price_per_hour) * court.slot_minutes) / 60)} el turno</p>
                </div>
                <div className="dp-legend">
                  <span><i style={{ background: COURT_STATUS.LIBRE.color }} />Disponible</span>
                  <span><i style={{ background: COURT_STATUS.RESERVADA.color }} />Reservado</span>
                  <span><i style={{ background: COURT_STATUS.OCUPADA.color }} />En uso</span>
                </div>
              </div>
              {timeline.length === 0 ? (
                <p className="dp-muted">La cancha no tiene horarios este día.</p>
              ) : (
                <div className="dp-slots">
                  {timeline.map((it, i) =>
                    it.kind === "free" ? (
                      <button key={i} className={`dp-slot free ${it.past ? "past" : ""}`} disabled={it.past}
                        onClick={() => setNewBooking({ courtId: court.id, start: it.start })}>
                        <strong>{timeRange(it.start, it.end)}</strong>
                        <small>{it.past ? "Pasado" : "Disponible · reservar"}</small>
                      </button>
                    ) : (
                      <button key={i} className={`dp-slot ${it.state === "OCUPADA" ? "busy" : it.state === "RESERVADA" ? "reserved" : "done"}`}
                        onClick={() => setOpenBooking(it.booking)}>
                        <strong>{timeRange(it.start, it.end)}</strong>
                        <small>
                          {it.state === "OCUPADA" ? "En uso" : it.state === "RESERVADA" ? (it.booking.status === "PENDIENTE_PAGO" ? "Esperando seña" : "Reservado") : it.booking.status === "AUSENTE" ? "No vinieron" : "Jugado"}
                          {" · "}{it.booking.customer_name}
                        </small>
                        {(it.booking.recurring_id || it.booking.source === "TORNEO") && (
                          <span className="dp-slot-tag">{it.booking.recurring_id ? "Fijo" : "Torneo"}</span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------- Modales ---------- */}
      {openBooking && (
        <BookingModal booking={openBooking} onClose={() => setOpenBooking(null)} onChanged={upsertBooking}
          onEdit={(b) => { setOpenBooking(null); setEditBooking(b); }} />
      )}
      {(newBooking || editBooking) && (
        <BookingForm
          courts={courts}
          booking={editBooking}
          initialCourtId={newBooking?.courtId}
          initialStart={newBooking?.start}
          onClose={() => { setNewBooking(null); setEditBooking(null); }}
          onSaved={(b) => { setNewBooking(null); setEditBooking(null); upsertBooking(b); loadBookings(); }}
        />
      )}

      {showManage && (
        <div className="modal-overlay" onClick={() => setShowManage(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">CANCHAS</span><h2>Administrar canchas</h2></div>
              <button className="modal-close" onClick={() => setShowManage(false)}>×</button>
            </div>
            <div className="import-table-wrapper">
              <table className="import-table">
                <thead><tr><th></th><th>Cancha</th><th>Precio/h</th><th>Turno</th><th>Horario</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {allCourts.map((c) => (
                    <tr key={c.id}>
                      <td><CourtIcon sport={c.sport} width={44} /></td>
                      <td><strong>{c.name}</strong><br /><small className="dp-muted">{SPORT_LABELS[c.sport]}</small></td>
                      <td>{money(c.price_per_hour)}</td>
                      <td>{minutesLabel(c.slot_minutes)}</td>
                      <td>{c.open_time}–{c.close_time}</td>
                      <td>{c.active ? <span className="dp-pill dp-pill-green">Activa</span> : <span className="dp-pill dp-pill-gray">Inactiva</span>}</td>
                      <td><button className="product-action-edit" onClick={() => { setShowManage(false); openCourtForm(c); }}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {courtForm && (
        <div className="modal-overlay" onClick={() => setCourtForm(null)}>
          <div className="product-modal dp-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">{editingCourtId ? "EDITAR" : "NUEVA"}</span><h2>{editingCourtId ? courtForm.name : "Nueva cancha"}</h2></div>
              <button className="modal-close" onClick={() => setCourtForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={saveCourt}>
              <div className="dp-court-form-top">
                <CourtIcon sport={courtForm.sport} width={180} />
                <div style={{ flex: 1, display: "grid", gap: 12 }}>
                  <div className="form-group"><label>Nombre</label><input value={courtForm.name} onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })} required /></div>
                  <div className="form-group"><label>Descripción</label><input value={courtForm.description} placeholder="Ej: Fútbol 5 · sintético · techada" onChange={(e) => setCourtForm({ ...courtForm, description: e.target.value })} /></div>
                </div>
              </div>
              <div className="form-group">
                <label>Deporte</label>
                <div className="dp-sport-picker">
                  {SPORTS.map((s) => (
                    <button type="button" key={s} className={`dp-sport-option ${courtForm.sport === s ? "is-on" : ""}`}
                      onClick={() => setCourtForm({ ...courtForm, sport: s })}>
                      <CourtIcon sport={s} width={58} /><span>{SPORT_LABELS[s]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Precio por hora</label><input type="number" min="0" value={courtForm.price_per_hour} onChange={(e) => setCourtForm({ ...courtForm, price_per_hour: e.target.value })} required /></div>
                <div className="form-group">
                  <label>Duración del turno</label>
                  <select value={courtForm.slot_minutes} onChange={(e) => setCourtForm({ ...courtForm, slot_minutes: e.target.value })}>
                    {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Jugadores</label><input type="number" min="1" value={courtForm.players} onChange={(e) => setCourtForm({ ...courtForm, players: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Abre</label><input type="time" step={1800} value={courtForm.open_time} onChange={(e) => setCourtForm({ ...courtForm, open_time: e.target.value })} required /></div>
                <div className="form-group">
                  <label>Cierra</label>
                  <input value={courtForm.close_time} placeholder="24:00" onChange={(e) => setCourtForm({ ...courtForm, close_time: e.target.value })} required pattern="^([01]?\d|2[0-4]):[0-5]\d$" />
                  <small className="dp-muted">24:00 = medianoche · 02:00 = 2 de la mañana</small>
                </div>
                <div className="form-group"><label>Orden</label><input type="number" value={courtForm.sort_order} onChange={(e) => setCourtForm({ ...courtForm, sort_order: e.target.value })} /></div>
              </div>
              <div className="dp-inline-checks">
                <label><input type="checkbox" checked={courtForm.covered} onChange={(e) => setCourtForm({ ...courtForm, covered: e.target.checked })} /> Cancha techada (se marca con otro color en el plano)</label>
              </div>
              {editingCourtId && (
                <div className="dp-inline-checks">
                  <label><input type="checkbox" checked={courtForm.active} onChange={(e) => setCourtForm({ ...courtForm, active: e.target.checked })} /> Cancha activa (se puede reservar)</label>
                </div>
              )}
              {courtError && <div className="login-error">{courtError}</div>}
              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <div>{editingCourtId && <button type="button" className="product-action-delete" onClick={deleteCourt}>Eliminar</button>}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary-button" onClick={() => setCourtForm(null)}>Cancelar</button>
                  <button type="submit" className="primary-button">{editingCourtId ? "Guardar" : "Crear cancha"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Canchas;
