import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  appApi, money, timeRange, dayKey, parseDay, addDays, dayLabel, longDate, courtWindow, addMinutes, hhmm, shortDate,
  BOOKING_STATUS, PAYMENT_LABELS, SPORT_LABELS, SOURCE_TAGS,
} from "../../config";
import type { Booking, Court } from "../../config";
import BookingModal from "../../components/BookingModal";
import BookingForm from "../../components/BookingForm";
import RecurringPanel from "../../components/RecurringPanel";

type Tab = "dia" | "fijos" | "sin-cobrar";
const TABS: { key: Tab; label: string }[] = [
  { key: "dia", label: "Turnos del día" },
  { key: "fijos", label: "Turnos fijos" },
  { key: "sin-cobrar", label: "Sin cobrar" },
];

/** Etiqueta de origen: Web / Fijo / Torneo */
function SourceTag({ b }: { b: Booking }) {
  const tag = SOURCE_TAGS[b.source] || (b.recurring_id ? SOURCE_TAGS.FIJO : null);
  if (!tag) return null;
  return <span className={`dp-pill dp-pill-${tag.tone}`} style={{ marginLeft: 6 }}>{tag.label}</span>;
}

const STATUS_FILTERS = [
  { key: "", label: "Todos" },
  { key: "RESERVADO,PENDIENTE_PAGO", label: "Reservados" },
  { key: "EN_CURSO", label: "En curso" },
  { key: "FINALIZADO", label: "Finalizados" },
  { key: "AUSENTE,CANCELADO", label: "Cancelados / ausentes" },
];

const HOUR_PX = 64;

function Turnos() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [params, setParams] = useSearchParams();
  const initialTab = (TABS.find((t) => t.key === params.get("tab"))?.key || "dia") as Tab;
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [day, setDay] = useState(params.get("dia") || dayKey(new Date()));
  const [view, setView] = useState<"lista" | "agenda">("lista");
  const [status, setStatus] = useState(params.get("estado") || "");
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [fixedKey, setFixedKey] = useState(0);

  function setTab(t: Tab) {
    setTabState(t);
    setParams(t === "dia" ? {} : { tab: t }, { replace: true });
  }

  async function loadUnpaid() {
    try { setUnpaid(await appApi<Booking[]>("/bookings/unpaid")); } catch { setUnpaid([]); }
  }
  useEffect(() => { if (tab === "sin-cobrar") loadUnpaid(); }, [tab, refreshKey]);
  const [courtFilter, setCourtFilter] = useState("");
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState<{ courtId?: number; start?: Date } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setBookings(await appApi<Booking[]>(`/bookings?date=${day}`));
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { appApi<Court[]>("/courts").then(setCourts).catch(() => {}); }, []);
  useEffect(() => { load(); }, [day, refreshKey]);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) =>
      (!status || status.split(",").includes(b.status)) &&
      (!courtFilter || b.court_id === Number(courtFilter)) &&
      (!q || [b.customer_name, b.customer_phone, b.code].some((v) => (v || "").toLowerCase().includes(q)))
    );
  }, [bookings, status, courtFilter, search]);

  const active = bookings.filter((b) => b.status !== "CANCELADO" && b.status !== "AUSENTE");
  const players = active.reduce((s, b) => s + (b.players_count || 0), 0);
  const toCollect = active.filter((b) => !b.paid).reduce((s, b) => s + Number(b.remaining ?? b.price), 0);
  const dayDate = parseDay(day);

  function onChanged(updated: Booking) {
    setBookings((list) => list.map((b) => (b.id === updated.id ? updated : b)));
    if (tab === "sin-cobrar") loadUnpaid();
    if (tab === "fijos") setFixedKey((k) => k + 1);
  }

  // ---------- Agenda ----------
  const agenda = useMemo(() => {
    const visibleCourts = courts.filter((c) => !courtFilter || c.id === Number(courtFilter));
    if (!visibleCourts.length) return null;
    const windows = visibleCourts.map((c) => courtWindow(c, dayDate));
    const from = new Date(Math.min(...windows.map((w) => w[0].getTime())));
    const to = new Date(Math.max(...windows.map((w) => w[1].getTime())));
    from.setMinutes(0, 0, 0);
    const hours: Date[] = [];
    for (let t = new Date(from); t < to; t = addMinutes(t, 60)) hours.push(t);
    return { courts: visibleCourts, from, to, hours, windows };
  }, [courts, courtFilter, day]);

  const pxFor = (d: Date) => agenda ? ((d.getTime() - agenda.from.getTime()) / 3600000) * HOUR_PX : 0;

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">TURNOS</span>
          <h1>Turnos</h1>
          <p>{longDate(dayDate)}</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={() => setCreating({})}>+ Nuevo turno</button>
        </div>
      </div>

      <div className="product-actions" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "primary-button" : "secondary-button"} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "fijos" && (
        <RecurringPanel courts={courts} refreshKey={refreshKey + fixedKey} onOpenBooking={setSelected} />
      )}

      {tab === "sin-cobrar" && (
        <div className="products-table-container">
          {unpaid.length === 0 ? (
            <div className="products-empty"><h3>Todo cobrado</h3><p>No hay turnos jugados con cancha o consumos sin cobrar.</p></div>
          ) : (
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead><tr><th>Día</th><th>Horario</th><th>Cancha</th><th>A nombre de</th><th>Cancha</th><th>Consumos</th><th>Falta cobrar</th><th></th></tr></thead>
                <tbody>
                  {unpaid.map((b) => (
                    <tr key={b.id} className="dp-row-click" onClick={() => setSelected(b)}>
                      <td>{shortDate(b.start_at)}</td>
                      <td><strong>{timeRange(b.start_at, b.end_at)}</strong></td>
                      <td>{b.court_name}</td>
                      <td>{b.customer_name}<SourceTag b={b} /><br /><small className="dp-muted">{b.customer_phone || ""}</small></td>
                      <td>{b.paid || b.source === "TORNEO" ? "—" : money(b.remaining)}</td>
                      <td>{b.items_unpaid ? money(b.items_unpaid) : "—"}</td>
                      <td><strong className="dp-red-text">{money(b.total_due)}</strong></td>
                      <td><button className="product-action-edit" onClick={(e) => { e.stopPropagation(); setSelected(b); }}>Cobrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "dia" && (<>
      <div className="dp-toolbar">
        <div className="dp-day-nav">
          <button className="secondary-button" onClick={() => setDay(dayKey(addDays(dayDate, -1)))}>‹</button>
          <button className={day === dayKey(new Date()) ? "primary-button" : "secondary-button"} onClick={() => setDay(dayKey(new Date()))}>Hoy</button>
          <button className="secondary-button" onClick={() => setDay(dayKey(addDays(dayDate, 1)))}>›</button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <span className="dp-muted">{dayLabel(dayDate)}</span>
        </div>
        <div className="product-actions">
          <button className={view === "lista" ? "primary-button" : "secondary-button"} onClick={() => setView("lista")}>Lista</button>
          <button className={view === "agenda" ? "primary-button" : "secondary-button"} onClick={() => setView("agenda")}>Agenda</button>
        </div>
      </div>

      <div className="dashboard-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div className="dashboard-card"><span>Turnos del día</span><strong>{active.length}</strong></div>
        <div className="dashboard-card"><span>Personas</span><strong>{players}</strong></div>
        <div className="dashboard-card"><span>Sin cobrar</span><strong>{money(toCollect)}</strong></div>
      </div>

      <div className="dp-toolbar">
        <div className="dp-chip-filters">
          {STATUS_FILTERS.map((f) => (
            <button key={f.key} className={`dp-filter-chip ${status === f.key ? "is-on" : ""}`} onClick={() => setStatus(f.key)}>{f.label}</button>
          ))}
        </div>
        <div className="dp-filters">
          <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}>
            <option value="">Todas las canchas</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="dp-search" placeholder="Nombre, teléfono o código" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {view === "lista" ? (
        <div className="products-table-container">
          {loading && bookings.length === 0 ? (
            <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
          ) : filtered.length === 0 ? (
            <div className="products-empty"><p>No hay turnos para mostrar.</p></div>
          ) : (
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr><th>Horario</th><th>Cancha</th><th>A nombre de</th><th>Personas</th><th>Estado</th><th>Pago</th><th>Código</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="dp-row-click" onClick={() => setSelected(b)}>
                      <td><strong>{timeRange(b.start_at, b.end_at)}</strong></td>
                      <td>{b.court_name}<br /><small className="dp-muted">{SPORT_LABELS[b.court_sport || ""]}</small></td>
                      <td>{b.customer_name}<SourceTag b={b} /><br /><small className="dp-muted">{b.customer_phone || ""}</small></td>
                      <td>{b.players_count ?? "—"}</td>
                      <td><span className={`dp-pill dp-pill-${BOOKING_STATUS[b.status].tone}`}>{BOOKING_STATUS[b.status].label}</span></td>
                      <td>{b.source === "TORNEO"
                        ? <span className="dp-muted">—</span>
                        : b.paid
                          ? <span className="dp-pill dp-pill-green">{PAYMENT_LABELS[b.payment_method || ""] || "Pagado"}</span>
                          : <span className="dp-muted">{money(b.price)}</span>}
                        {!!b.items_unpaid && (
                          <><br /><small className={b.status === "FINALIZADO" ? "dp-red-text" : "dp-muted"}>
                            {b.status === "FINALIZADO" ? `Falta cobrar ${money(b.total_due)}` : `+ ${money(b.items_unpaid)} consumos`}
                          </small></>
                        )}</td>
                      <td><code className="dp-code-sm">{b.code}</code></td>
                      <td><button className="product-action-edit" onClick={(e) => { e.stopPropagation(); setSelected(b); }}>Ver</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : !agenda ? (
        <div className="products-empty"><p>No hay canchas creadas.</p></div>
      ) : (
        <div className="dashboard-section dp-agenda-wrap">
          <div className="dp-agenda" style={{ gridTemplateColumns: `56px repeat(${agenda.courts.length}, minmax(140px, 1fr))` }}>
            <div className="dp-agenda-head" />
            {agenda.courts.map((c) => <div key={c.id} className="dp-agenda-head"><strong>{c.name}</strong><small>{SPORT_LABELS[c.sport]}</small></div>)}

            <div className="dp-agenda-hours" style={{ height: agenda.hours.length * HOUR_PX }}>
              {agenda.hours.map((h) => <span key={h.getTime()} style={{ top: pxFor(h) }}>{hhmm(h)}</span>)}
            </div>
            {agenda.courts.map((c, i) => {
              const [open, close] = agenda.windows[i];
              return (
                <div key={c.id} className="dp-agenda-col" style={{ height: agenda.hours.length * HOUR_PX }}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const mins = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30;
                    const start = addMinutes(agenda.from, mins);
                    if (start >= open && start < close) setCreating({ courtId: c.id, start });
                  }}>
                  {agenda.hours.map((h) => <div key={h.getTime()} className="dp-agenda-line" style={{ top: pxFor(h) }} />)}
                  <div className="dp-agenda-closed" style={{ top: 0, height: Math.max(0, pxFor(open)) }} />
                  <div className="dp-agenda-closed" style={{ top: pxFor(close), bottom: 0 }} />
                  {filtered.filter((b) => b.court_id === c.id).map((b) => {
                    const s = new Date(b.start_at), e = new Date(b.end_at);
                    return (
                      <div key={b.id} className={`dp-agenda-item tone-${BOOKING_STATUS[b.status].tone}`}
                        style={{ top: pxFor(s), height: Math.max(22, pxFor(e) - pxFor(s) - 2) }}
                        onClick={(ev) => { ev.stopPropagation(); setSelected(b); }}>
                        <strong>{b.customer_name}</strong>
                        <small>{timeRange(s, e)}{b.players_count ? ` · ${b.players_count}p` : ""}{b.recurring_id ? " · Fijo" : b.source === "TORNEO" ? " · Torneo" : ""}</small>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="dp-muted" style={{ marginTop: 10 }}>Tocá un espacio vacío para reservar en ese horario.</p>
        </div>
      )}

      </>)}

      {selected && (
        <BookingModal
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
          onEdit={(b) => { setSelected(null); setEditing(b); }}
        />
      )}
      {(creating || editing) && (
        <BookingForm
          courts={courts}
          booking={editing}
          initialCourtId={creating?.courtId}
          initialStart={creating?.start}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={(b) => {
            setCreating(null); setEditing(null);
            setDay(b.start_at.slice(0, 10));
            load();
            if (b.recurring_id) setFixedKey((k) => k + 1);
          }}
        />
      )}
    </section>
  );
}

export default Turnos;
