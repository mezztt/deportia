import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  appApi, money, dayKey, parseDay, minutesLabel, SPORT_LABELS, WEEKDAYS, weekdayIndex,
} from "../config";
import type { Booking, Court, RecurringItem } from "../config";

interface Props {
  courts: Court[];
  refreshKey?: number;
  /** abrir el detalle de una reserva generada por el fijo */
  onOpenBooking?: (b: Booking) => void;
}

interface FormState {
  id: number | null;
  court_id: string;
  weekday: string;
  start_time: string;
  duration_minutes: string;
  customer_name: string;
  customer_phone: string;
  players_count: string;
  price_mode: "AUTO" | "FIXED";
  fixed_price: string;
  starts_on: string;
  ends_on: string;
  apply_from: string;
  notes: string;
}

const DURATIONS = [30, 60, 90, 120, 150, 180];
const STATE_PILL: Record<string, { label: string; tone: string }> = {
  ACTIVO: { label: "Activo", tone: "green" },
  PAUSADO: { label: "Pausado", tone: "orange" },
  BAJA: { label: "Dado de baja", tone: "gray" },
};

function shortDay(key: string): string {
  const d = parseDay(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Sección "Turnos fijos": el grupo que juega todas las semanas el mismo día y hora. */
function RecurringPanel({ courts, refreshKey, onOpenBooking }: Props) {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [weeks, setWeeks] = useState(8);
  const [loading, setLoading] = useState(true);
  const [showEnded, setShowEnded] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  async function load() {
    try {
      const r = await appApi<{ weeks_ahead: number; items: RecurringItem[] }>(`/recurring?include_ended=${showEnded}`);
      setItems(r.items);
      setWeeks(r.weeks_ahead || 8);
      setListError("");
    } catch (e) {
      setListError(e instanceof Error ? e.message : "No se pudieron cargar los turnos fijos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showEnded, refreshKey]);

  function openNew() {
    const c = courts[0];
    setError("");
    setForm({
      id: null, court_id: String(c?.id || ""), weekday: String(weekdayIndex(new Date())), start_time: "21:00",
      duration_minutes: String(c?.slot_minutes || 60), customer_name: "", customer_phone: "", players_count: "",
      price_mode: "AUTO", fixed_price: "", starts_on: dayKey(new Date()), ends_on: "", apply_from: dayKey(new Date()), notes: "",
    });
  }

  function openEdit(r: RecurringItem) {
    setError("");
    setForm({
      id: r.id, court_id: String(r.court_id), weekday: String(r.weekday), start_time: r.start_time,
      duration_minutes: String(r.duration_minutes), customer_name: r.customer_name, customer_phone: r.customer_phone || "",
      players_count: r.players_count ? String(r.players_count) : "", price_mode: r.price_mode,
      fixed_price: r.fixed_price !== null ? String(r.fixed_price) : "", starts_on: r.starts_on, ends_on: r.ends_on || "",
      apply_from: dayKey(new Date()), notes: r.notes || "",
    });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const common = {
      court_id: Number(form.court_id),
      weekday: Number(form.weekday),
      start_time: form.start_time,
      duration_minutes: Number(form.duration_minutes),
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      players_count: form.players_count ? Number(form.players_count) : null,
      price_mode: form.price_mode,
      fixed_price: form.price_mode === "FIXED" ? Number(form.fixed_price || 0) : null,
      ends_on: form.ends_on || null,
      notes: form.notes || null,
    };
    try {
      const res = form.id
        ? await appApi<{ new_conflicts: { date: string; detail: string }[] }>(`/recurring/${form.id}`, { method: "PUT", body: { ...common, apply_from: form.apply_from || null } })
        : await appApi<{ new_conflicts: { date: string; detail: string }[] }>("/recurring", { method: "POST", body: { ...common, starts_on: form.starts_on || null } });
      setForm(null);
      await load();
      if (res.new_conflicts.length) {
        alert(`Guardado. Estas fechas ya estaban ocupadas y no se reservaron:\n${res.new_conflicts.map((c) => `• ${shortDay(c.date)} · ${c.detail}`).join("\n")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function action(path: string, body?: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await appApi(path, { method: "POST", body });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo completar");
    }
  }

  async function openDate(bookingId: number | null) {
    if (!bookingId || !onOpenBooking) return;
    try {
      onOpenBooking(await appApi<Booking>(`/bookings/${bookingId}`));
    } catch { /* noop */ }
  }

  const formCourt = form ? courts.find((c) => c.id === Number(form.court_id)) : undefined;
  const durations = Array.from(new Set([...(formCourt ? [formCourt.slot_minutes] : []), ...DURATIONS])).sort((a, b) => a - b);

  return (
    <>
      <div className="dp-toolbar">
        <p className="dp-muted" style={{ margin: 0, maxWidth: 560 }}>
          Para los grupos que juegan siempre el mismo día y hora. Se cargan una vez y el sistema reserva solo las próximas {weeks} semanas, sin seña.
        </p>
        <div className="product-actions">
          <label className="dp-check-inline">
            <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /> Ver dados de baja
          </label>
          <button className="primary-button" onClick={openNew} disabled={!courts.length}>+ Nuevo turno fijo</button>
        </div>
      </div>
      {listError && <div className="login-error" style={{ marginBottom: 12 }}>{listError}</div>}

      <div className="products-table-container">
        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
        ) : items.length === 0 ? (
          <div className="products-empty">
            <h3>Todavía no hay turnos fijos</h3>
            <p>Cargá el grupo de los martes a las 21 una sola vez y olvidate de anotarlo cada semana.</p>
            <button className="primary-button" onClick={openNew} disabled={!courts.length}>+ Nuevo turno fijo</button>
          </div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr><th>Día y hora</th><th>Cancha</th><th>A nombre de</th><th>Próximas fechas</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{WEEKDAYS[r.weekday]} {r.start_time}</strong><br />
                      <small className="dp-muted">{minutesLabel(r.duration_minutes)} · {r.price_mode === "FIXED" ? money(r.fixed_price) : "precio de la cancha"}</small>
                    </td>
                    <td>{r.court_name}<br /><small className="dp-muted">{SPORT_LABELS[r.court_sport || ""] || ""}</small></td>
                    <td>{r.customer_name}<br /><small className="dp-muted">{r.customer_phone || ""}{r.players_count ? ` · ${r.players_count} personas` : ""}</small></td>
                    <td>
                      <div className="dp-date-chips">
                        {r.next_dates.map((d) => (
                          <button key={d.date} className="dp-date-chip" title="Ver esta fecha" onClick={() => openDate(d.booking_id)}>{shortDay(d.date)}</button>
                        ))}
                        {r.conflicts.map((c) => (
                          <button key={c.date} className="dp-date-chip is-conflict"
                            title={`${c.detail || "Ocupado"}. Tocá para reintentar.`}
                            onClick={() => action(`/recurring/${r.id}/retry-date`, { date: c.date }, `El ${shortDay(c.date)} no se reservó: ${c.detail || "la cancha estaba ocupada"}.\n¿Reintentar ahora?`)}>
                            ⚠ {shortDay(c.date)}
                          </button>
                        ))}
                        {r.state === "ACTIVO" && r.next_dates.length === 0 && r.conflicts.length === 0 && <small className="dp-muted">Sin fechas próximas</small>}
                        {r.state !== "ACTIVO" && <small className="dp-muted">—</small>}
                      </div>
                      {r.conflicts.length > 0 && (
                        <small className="dp-red-text">{r.conflicts.length} fecha{r.conflicts.length === 1 ? "" : "s"} en conflicto</small>
                      )}
                    </td>
                    <td><span className={`dp-pill dp-pill-${STATE_PILL[r.state].tone}`}>{STATE_PILL[r.state].label}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.state !== "BAJA" && (
                        <>
                          <button className="product-action-edit" onClick={() => openEdit(r)}>Editar</button>{" "}
                          {r.state === "ACTIVO" ? (
                            <button className="product-action-edit"
                              onClick={() => action(`/recurring/${r.id}/pause`, undefined, "¿Pausar este turno fijo? Se liberan las fechas futuras hasta que lo reanudes.")}>
                              Pausar
                            </button>
                          ) : (
                            <button className="product-action-edit" onClick={() => action(`/recurring/${r.id}/resume`)}>Reanudar</button>
                          )}{" "}
                          <button className="product-action-delete"
                            onClick={() => action(`/recurring/${r.id}/end`, undefined, "¿Dar de baja este turno fijo? Se cancelan las reservas futuras que todavía no se jugaron.")}>
                            Dar de baja
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <p className="dp-muted" style={{ marginTop: 10 }}>
          Para cancelar una sola semana, tocá la fecha y elegí «Cancelar turno»: esa fecha no se vuelve a reservar.
        </p>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">TURNO FIJO</span><h2>{form.id ? "Editar turno fijo" : "Nuevo turno fijo"}</h2></div>
              <button className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={save}>
              <div className="form-group">
                <label>Cancha</label>
                <select value={form.court_id} onChange={(e) => {
                  const c = courts.find((x) => x.id === Number(e.target.value));
                  setForm({ ...form, court_id: e.target.value, duration_minutes: form.id ? form.duration_minutes : String(c?.slot_minutes || 60) });
                }}>
                  {courts.map((c) => <option key={c.id} value={c.id}>{c.name} · {SPORT_LABELS[c.sport] || c.sport}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Día</label>
                  <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                    {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Hora</label><input type="time" step={900} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required /></div>
                <div className="form-group">
                  <label>Duración</label>
                  <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
                    {durations.map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>A nombre de</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="Opcional" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Personas</label><input type="number" min="1" value={form.players_count} onChange={(e) => setForm({ ...form, players_count: e.target.value })} placeholder="Opcional" /></div>
                <div className="form-group">
                  <label>Precio de cada fecha</label>
                  <select value={form.price_mode} onChange={(e) => setForm({ ...form, price_mode: e.target.value as "AUTO" | "FIXED" })}>
                    <option value="AUTO">El de la cancha y la franja</option>
                    <option value="FIXED">Precio fijo</option>
                  </select>
                </div>
                {form.price_mode === "FIXED" && (
                  <div className="form-group"><label>Precio fijo</label><input type="number" min="0" value={form.fixed_price} onChange={(e) => setForm({ ...form, fixed_price: e.target.value })} required /></div>
                )}
              </div>
              <div className="form-row">
                {form.id ? (
                  <div className="form-group">
                    <label>Cambios de día, hora o cancha desde</label>
                    <input type="date" value={form.apply_from} min={dayKey(new Date())} onChange={(e) => setForm({ ...form, apply_from: e.target.value })} />
                    <small className="dp-muted">Las fechas anteriores quedan como estaban.</small>
                  </div>
                ) : (
                  <div className="form-group"><label>Empieza</label><input type="date" value={form.starts_on} min={dayKey(new Date())} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></div>
                )}
                <div className="form-group">
                  <label>Termina</label>
                  <input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
                  <small className="dp-muted">Vacío = sin fecha de fin.</small>
                </div>
              </div>
              <div className="form-group"><label>Notas</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" /></div>

              {error && <div className="login-error">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear turno fijo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default RecurringPanel;
