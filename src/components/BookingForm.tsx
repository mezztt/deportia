import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  appApi, money, dayKey, hhmm, parseDay, toLocalISO, minutesLabel, computePrice, SPORT_LABELS,
  getSessionUser, hasModule, weekdayIndex, shortDate, WEEKDAYS,
} from "../config";
import type { Booking, ClientAlert, ComplexSettings, Court, PriceBand, RecurringItem } from "../config";

interface ClientHit { id: number; name: string; phone: string | null; blocked: boolean }

interface Props {
  courts: Court[];
  /** para editar un turno existente */
  booking?: Booking | null;
  /** valores iniciales al crear (ej: tocaste un horario libre en Canchas) */
  initialCourtId?: number;
  initialStart?: Date;
  onClose: () => void;
  onSaved: (b: Booking) => void;
}

const DURATIONS = [30, 60, 90, 120, 150, 180];

function BookingForm({ courts, booking, initialCourtId, initialStart, onClose, onSaved }: Props) {
  const editing = !!booking;
  const startDefault = booking ? new Date(booking.start_at) : initialStart || nextHalfHour();
  const [courtId, setCourtId] = useState<number>(booking?.court_id || initialCourtId || courts[0]?.id || 0);
  const court = courts.find((c) => c.id === courtId);
  const [date, setDate] = useState(dayKey(startDefault));
  const [time, setTime] = useState(hhmm(startDefault));
  const [duration, setDuration] = useState<number>(
    booking ? Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000) : court?.slot_minutes || 60
  );
  const [name, setName] = useState(booking?.customer_name || "");
  const [phone, setPhone] = useState(booking?.customer_phone || "");
  const [players, setPlayers] = useState(booking?.players_count ? String(booking.players_count) : "");
  const [price, setPrice] = useState(booking ? String(booking.price) : "");
  const [notes, setNotes] = useState(booking?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // turno fijo: "Repetir todas las semanas" (solo al crear)
  const [repeat, setRepeat] = useState(false);

  // módulo Clientes: autocompletar y avisos (ausencias, deuda, bloqueo)
  const withClients = hasModule(getSessionUser(), "clientes");
  const [clientId, setClientId] = useState<number | null>(booking?.client_id ?? null);
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [alertInfo, setAlertInfo] = useState<ClientAlert | null>(null);

  useEffect(() => {
    if (!withClients || !showHits) return;
    const q = (name.trim().length >= 2 ? name : phone).trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      appApi<ClientHit[]>(`/clients/search?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [name, phone, showHits]);

  useEffect(() => {
    if (!withClients) return;
    const digits = phone.replace(/\D/g, "");
    if (!clientId && digits.length < 6) { setAlertInfo(null); return; }
    const qs = clientId ? `client_id=${clientId}` : `phone=${encodeURIComponent(phone)}`;
    const t = setTimeout(() => {
      appApi<ClientAlert>(`/clients/alert?${qs}`).then(setAlertInfo).catch(() => setAlertInfo(null));
    }, 300);
    return () => clearTimeout(t);
  }, [phone, clientId]);

  function pickClient(c: ClientHit) {
    setName(c.name);
    setPhone(c.phone || "");
    setClientId(c.id);
    setShowHits(false);
  }

  const [bands, setBands] = useState<PriceBand[]>([]);
  useEffect(() => {
    appApi<ComplexSettings>("/settings")
      .then((st) => setBands(st.price_bands_enabled ? st.bands : []))
      .catch(() => {});
  }, []);

  const autoPrice = useMemo(() => {
    if (!court) return 0;
    const [h, m] = time.split(":").map(Number);
    const start = parseDay(date);
    start.setHours(h || 0, m || 0, 0, 0);
    return computePrice(court.price_per_hour, duration, start, bands);
  }, [court, duration, date, time, bands]);

  function changeCourt(id: number) {
    setCourtId(id);
    const c = courts.find((x) => x.id === id);
    if (c && !editing) setDuration(c.slot_minutes);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!court) return;
    setSaving(true);
    setError("");
    const [h, m] = time.split(":").map(Number);
    const start = parseDay(date);
    start.setHours(h, m, 0, 0);
    const body = {
      court_id: courtId,
      start_at: toLocalISO(start),
      duration_minutes: duration,
      customer_name: name,
      customer_phone: phone || null,
      players_count: players ? Number(players) : null,
      price: price === "" ? null : Number(price),
      notes: notes || null,
    };
    try {
      if (!editing && repeat) {
        // turno fijo: se carga una vez y el sistema reserva todas las semanas
        const res = await appApi<{ recurring: RecurringItem; booking: Booking | null; new_conflicts: { date: string; detail: string }[] }>("/recurring", {
          method: "POST",
          body: {
            court_id: courtId,
            weekday: weekdayIndex(start),
            start_time: time,
            duration_minutes: duration,
            customer_name: name,
            customer_phone: phone || null,
            players_count: players ? Number(players) : null,
            client_id: clientId,
            price_mode: price === "" ? "AUTO" : "FIXED",
            fixed_price: price === "" ? null : Number(price),
            starts_on: date,
            notes: notes || null,
          },
        });
        if (res.new_conflicts.length) {
          alert(`Turno fijo creado. Estas fechas ya estaban ocupadas y no se reservaron:\n${res.new_conflicts.map((c) => `• ${shortDate(c.date + "T00:00:00")} · ${c.detail}`).join("\n")}`);
        }
        if (res.booking) onSaved(res.booking);
        else onClose();
        return;
      }
      const saved = editing
        ? await appApi<Booking>(`/bookings/${booking!.id}`, { method: "PUT", body })
        : await appApi<Booking>("/bookings", { method: "POST", body: { ...body, client_id: clientId } });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const durations = Array.from(new Set([...(court ? [court.slot_minutes] : []), ...DURATIONS])).sort((a, b) => a - b);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="dashboard-eyebrow">{editing ? `TURNO · CÓDIGO ${booking!.code}` : "NUEVO TURNO"}</span>
            <h2>{editing ? "Editar turno" : "Reservar cancha"}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {courts.length === 0 ? (
          <div className="products-empty"><p>Primero creá una cancha desde el módulo Canchas.</p></div>
        ) : (
          <form className="product-form" onSubmit={submit}>
            <div className="form-group">
              <label>Cancha</label>
              <select value={courtId} onChange={(e) => changeCourt(Number(e.target.value))}>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {SPORT_LABELS[c.sport] || c.sport}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Día</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div className="form-group"><label>Hora</label><input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required /></div>
              <div className="form-group">
                <label>Duración</label>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {durations.map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group dp-suggest-wrap">
                <label>A nombre de</label>
                <input value={name} required autoComplete="off"
                  onChange={(e) => { setName(e.target.value); setClientId(null); setShowHits(true); }}
                  onBlur={() => setTimeout(() => setShowHits(false), 200)} />
                {withClients && showHits && hits.length > 0 && (
                  <div className="dp-suggest">
                    {hits.map((c) => (
                      <button type="button" key={c.id} onMouseDown={(e) => { e.preventDefault(); pickClient(c); }}>
                        <strong>{c.name}</strong>
                        <small>{c.phone || "Sin teléfono"}{c.blocked ? " · Bloqueado" : ""}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input value={phone} autoComplete="off" placeholder={withClients ? "Para reconocer al cliente" : "Opcional"}
                  onChange={(e) => { setPhone(e.target.value); setClientId(null); setShowHits(true); }}
                  onBlur={() => setTimeout(() => setShowHits(false), 200)} />
              </div>
            </div>
            {withClients && alertInfo && alertInfo.warnings.length > 0 && (
              <div className={`dp-alert ${alertInfo.client?.blocked ? "dp-alert-red" : ""}`} role="alert">
                <strong>⚠ Ojo con {alertInfo.client?.name}</strong>
                <ul>{alertInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Personas</label>
                <input type="number" min="1" value={players} onChange={(e) => setPlayers(e.target.value)} placeholder={court ? String(court.players) : ""} />
              </div>
              <div className="form-group">
                <label>Precio</label>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={`${money(autoPrice)} (automático)`} />
              </div>
            </div>
            <div className="form-group"><label>Notas</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
            {!editing && (
              <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                <label>
                  <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                  Repetir todas las semanas (turno fijo)
                </label>
              </div>
            )}
            {!editing && repeat && (
              <p className="dp-muted" style={{ margin: 0 }}>
                Queda reservado todos los {WEEKDAYS[weekdayIndex(parseDay(date))].toLowerCase()} a las {time}, sin seña.
                {price === "" ? " Cada fecha toma el precio de la cancha y la franja." : ` Precio fijo de ${money(price)} por fecha.`}
                {" "}Lo administrás en Turnos › Turnos fijos.
              </p>
            )}

            {error && <div className="login-error">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : repeat ? "Crear turno fijo" : `Reservar · ${money(price === "" ? autoPrice : price)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

export default BookingForm;
