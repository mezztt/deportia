import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  publicApi, money, dayKey, parseDay, addDays, addMinutes, hhmm, timeRange, toLocalISO, courtWindow,
  overlaps, minutesLabel, computePrice, SPORT_LABELS, dayLabel,
} from "../../config";
import type { PriceBand } from "../../config";
import CourtIcon from "../../components/CourtIcon";
import CourtPlan from "../../components/CourtPlan";
import { DeportiaLogo, PoweredBy, useLightPage } from "../../components/Brand";
import ConsumerRights from "../../components/ConsumerRights";

interface PublicCourt {
  id: number; name: string; sport: string; description: string | null; players: number;
  price_per_hour: number; slot_minutes: number; price: number; open_time: string; close_time: string;
  covered?: boolean; map_x?: number | null; map_y?: number | null; map_w?: number | null; map_h?: number | null;
}
interface PublicComplex {
  name: string; slug: string; address: string | null; city: string | null; phone: string | null;
  email: string | null; sports: string[]; courts: PublicCourt[]; max_days_ahead: number; now: string;
  deposit: { percent: number; hold_minutes: number; policy?: string } | null;
  price_bands: PriceBand[];
}
interface Availability {
  date: string; now: string;
  courts: { id: number; open_at: string; close_at: string; busy: { start: string; end: string; in_use: boolean }[] }[];
}

type CourtState = "LIBRE" | "RESERVADA" | "OCUPADA" | "CERRADA" | "PASADO";
const STATE_COLOR: Record<CourtState, string> = {
  LIBRE: "#22a05a", RESERVADA: "#e08a1e", OCUPADA: "#d64545", CERRADA: "#9aa9b6", PASADO: "#b8c4ce",
};
// fondos para etiquetas con texto blanco (contraste ≥ 4.5)
const STATE_SOLID: Record<CourtState, string> = {
  LIBRE: "#1a7f47", RESERVADA: "#b3540a", OCUPADA: "#c0392b", CERRADA: "#5b6b7d", PASADO: "#5b6b7d",
};
const STATE_LABEL: Record<CourtState, string> = {
  LIBRE: "Libre", RESERVADA: "Reservada", OCUPADA: "Reservada", CERRADA: "Cerrada a esa hora", PASADO: "Horario pasado",
};

const PLAN_PALETTE = Object.fromEntries((Object.keys(STATE_COLOR) as CourtState[]).map((k) => [k, { color: STATE_COLOR[k], solid: STATE_SOLID[k], label: STATE_LABEL[k] }]));

export const MY_BOOKINGS_KEY = "deportia_mis_reservas";

export function readMyBookings(): { slug: string; code: string; start_at: string; court: string }[] {
  try { return JSON.parse(localStorage.getItem(MY_BOOKINGS_KEY) || "[]"); } catch { return []; }
}

function Reservar() {
  useLightPage();
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [complex, setComplex] = useState<PublicComplex | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sport, setSport] = useState("");
  const [day, setDay] = useState(dayKey(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [blindOpen, setBlindOpen] = useState(false);
  const [planView, setPlanView] = useState(() => typeof window === "undefined" || window.innerWidth >= 700); // en celular chico arranca la lista (el plano se ve muy chiquito)
  const [avail, setAvail] = useState<Availability | null>(null);
  const [checkout, setCheckout] = useState<PublicCourt | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", players: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    publicApi<PublicComplex>(`/public/complexes/${slug}`)
      .then((c) => {
        setComplex(c);
        setSport(c.sports[0] || "");
        document.title = `Reservar · ${c.name}`;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  async function loadAvailability() {
    try { setAvail(await publicApi<Availability>(`/public/complexes/${slug}/availability?date=${day}`)); } catch { /* noop */ }
  }
  useEffect(() => {
    if (!complex) return;
    loadAvailability();
    const t = setInterval(loadAvailability, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complex, day]);

  const dayDate = parseDay(day);
  const now = new Date();
  const courts = useMemo(() => (complex?.courts || []).filter((c) => c.sport === sport), [complex, sport]);

  function stateFor(c: PublicCourt, t: Date): CourtState {
    const end = addMinutes(t, c.slot_minutes);
    const [open, close] = courtWindow(c, dayDate);
    if (t < open || end > close) return "CERRADA";
    if (t < now) return "PASADO";
    const info = avail?.courts.find((x) => x.id === c.id);
    const clash = info?.busy.find((b) => overlaps(t, end, new Date(b.start), new Date(b.end)));
    if (clash) return clash.in_use ? "OCUPADA" : "RESERVADA";
    return "LIBRE";
  }

  // la "persiana": todos los horarios del día con cuántas canchas libres hay
  const times = useMemo(() => {
    if (!courts.length) return [];
    const wins = courts.map((c) => courtWindow(c, dayDate));
    const from = new Date(Math.min(...wins.map((w) => w[0].getTime())));
    const to = new Date(Math.max(...wins.map((w) => w[1].getTime())));
    const out: { t: Date; free: number }[] = [];
    for (let t = new Date(from); t < to; t = addMinutes(t, 30)) {
      const free = courts.filter((c) => stateFor(c, t) === "LIBRE").length;
      const anyOpen = courts.some((c) => stateFor(c, t) !== "CERRADA");
      if (anyOpen && t >= addMinutes(now, -5)) out.push({ t: new Date(t), free }); // los horarios pasados no se muestran
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts, avail, day]);

  // elige automáticamente el primer horario con lugar
  useEffect(() => {
    if (!times.length) { setTime(null); return; }
    if (time && times.some((x) => toLocalISO(x.t) === time)) return;
    const first = times.find((x) => x.free > 0) || times[0];
    setTime(toLocalISO(first.t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times]);

  // time guarda la fecha+hora completa (sirve para turnos después de medianoche)
  const selectedTime = useMemo(() => (time ? new Date(time) : null), [time]);

  const priceAt = (c: PublicCourt, t: Date | null) => computePrice(c.price_per_hour, c.slot_minutes, t, complex?.price_bands);
  const depositFor = (price: number) => (complex?.deposit ? Math.round((price * complex.deposit.percent) / 100) : 0);

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checkout || !selectedTime) return;
    setSending(true);
    setError("");
    try {
      const ticket = await publicApi<{ code: string; start_at: string; court: { name: string }; deposit: { payment_url: string | null } | null }>(
        `/public/complexes/${slug}/bookings`,
        {
          method: "POST",
          body: {
            court_id: checkout.id,
            start_at: toLocalISO(selectedTime),
            customer_name: form.name,
            customer_phone: form.phone,
            customer_email: form.email || null,
            players_count: form.players ? Number(form.players) : null,
            return_base: window.location.origin,
          },
        }
      );
      try {
        const list = readMyBookings().filter((x) => x.code !== ticket.code);
        list.unshift({ slug, code: ticket.code, start_at: ticket.start_at, court: ticket.court?.name || "" });
        localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(list.slice(0, 10)));
      } catch { /* sin almacenamiento */ }
      if (ticket.deposit?.payment_url) {
        window.location.href = ticket.deposit.payment_url; // a Mercado Pago a pagar la seña
        return;
      }
      navigate(`/r/${slug}/turno/${ticket.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reservar");
      loadAvailability();
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="pub-page"><div className="pub-empty"><h1>Complejo no encontrado</h1><p>Revisá el link que te pasaron.</p></div></main>
    );
  }
  if (!complex) {
    return <main className="pub-page"><div className="pub-empty"><div className="products-loading-spinner" /></div></main>;
  }

  const myBookings = readMyBookings().filter((b) => b.slug === slug && new Date(b.start_at) > addMinutes(now, -120));
  const days = Array.from({ length: Math.min(complex.max_days_ahead, 14) }, (_, i) => addDays(new Date(), i));
  const phoneDigits = (complex.phone || "").replace(/\D/g, "");
  const complexContact = [[complex.address, complex.city].filter(Boolean).join(", "), complex.phone ? `tel. ${complex.phone}` : ""].filter(Boolean).join(" · ");

  return (
    <main className="pub-page">
      <ConsumerRights slug={complex.slug} complexPhone={complex.phone} />
      <header className="pub-hero">
        <div className="pub-hero-grass" aria-hidden="true" />
        <div className="pub-hero-lights" aria-hidden="true" />
        <div className="pub-hero-inner">
          <div className="pub-topbar">
            <div className="pub-brand"><DeportiaLogo size={30} /><span>Reservas online</span></div>
            {phoneDigits && <a className="pub-wa" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
          </div>
          <span className="pub-kicker">⚡ Reservá tu cancha en menos de un minuto</span>
          <h1>{complex.name}</h1>
          {(complex.address || complex.city) && <p className="pub-address">📍 {[complex.address, complex.city].filter(Boolean).join(", ")}</p>}
          <div className="pub-hero-tags">
            {complex.sports.map((sp) => (
              <span key={sp} className="pub-hero-tag" data-contrast-ignore><CourtIcon sport={sp} width={26} />{SPORT_LABELS[sp] || sp}</span>
            ))}
            {complex.deposit && <span className="pub-hero-tag is-mp">Seña con Mercado Pago</span>}
          </div>
          <ol className="pub-hero-steps">
            <li><b>1</b>Elegí deporte y día</li>
            <li><b>2</b>Elegí horario y cancha</li>
            <li><b>3</b>Mostrá tu código y a jugar</li>
          </ol>
        </div>
      </header>

      <div className="pub-content">
        {myBookings.length > 0 && (
          <div className="pub-mine">
            <strong>Tus reservas</strong>
            {myBookings.map((b) => (
              <button key={b.code} onClick={() => navigate(`/r/${slug}/turno/${b.code}`)}>
                {dayLabel(new Date(b.start_at))} {hhmm(b.start_at)} · {b.court} · <b>{b.code}</b> ›
              </button>
            ))}
          </div>
        )}

        {complex.sports.length === 0 ? (
          <div className="pub-empty"><p>Este complejo todavía no cargó canchas.</p></div>
        ) : (
          <>
            {/* 1. Deporte */}
            <section className="pub-step">
              <h2><span>1</span> Elegí el deporte</h2>
              <div className="pub-sports">
                {complex.sports.map((s) => (
                  <button key={s} className={`pub-sport ${sport === s ? "is-on" : ""}`} onClick={() => { setSport(s); setTime(null); }}>
                    <CourtIcon sport={s} width={70} />
                    <span>{SPORT_LABELS[s] || s}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Día */}
            <section className="pub-step">
              <h2><span>2</span> Elegí el día</h2>
              <div className="pub-days">
                {days.map((d) => (
                  <button key={dayKey(d)} className={`pub-day ${day === dayKey(d) ? "is-on" : ""}`} onClick={() => { setDay(dayKey(d)); setTime(null); }}>
                    <small>{dayLabel(d).split(" ")[0]}</small>
                    <strong>{d.getDate()}</strong>
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Horario: persiana */}
            <section className="pub-step pub-sticky">
              <h2><span>3</span> Elegí el horario</h2>
              <button className="pub-blind" onClick={() => setBlindOpen(!blindOpen)}>
                <span>🕒 {selectedTime ? `${dayLabel(dayDate)} · ${hhmm(selectedTime)} hs` : "Sin horarios disponibles"}</span>
                <span>{blindOpen ? "Cerrar ▴" : "Ver todos los horarios ▾"}</span>
              </button>
              {blindOpen && (
                <div className="pub-blind-panel">
                  {times.length === 0 && <p className="dp-muted">No hay horarios este día.</p>}
                  {times.map(({ t, free }) => (
                    <button key={t.getTime()} disabled={free === 0}
                      className={`pub-time ${time === toLocalISO(t) ? "is-on" : ""} ${free === 0 ? "is-full" : ""}`}
                      onClick={() => { setTime(toLocalISO(t)); setBlindOpen(false); }}>
                      <strong>{hhmm(t)}</strong>
                      <small>{free === 0 ? (t < now ? "pasado" : "completo") : `${free} libre${free > 1 ? "s" : ""}`}</small>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Cancha */}
            <section className="pub-step">
              <h2><span>4</span> Elegí la cancha</h2>
              <div className="pub-legend">
                <span><i style={{ background: STATE_COLOR.LIBRE }} />Libre</span>
                <span><i style={{ background: STATE_COLOR.RESERVADA }} />Reservada</span>
              </div>
              <div className="dp-view-toggle" role="group" aria-label="Cómo ver las canchas">
                <button type="button" aria-pressed={planView} onClick={() => setPlanView(true)}>Plano</button>
                <button type="button" aria-pressed={!planView} onClick={() => setPlanView(false)}>Lista</button>
              </div>
              {planView && selectedTime && (
                <CourtPlan fit courts={courts as never} palette={PLAN_PALETTE} selectedId={null} onSelect={() => {}} onOpenBooking={() => {}}
                  canManage={false} onSaved={() => {}}
                  statusFor={(c) => ({ status: stateFor(c as unknown as PublicCourt, selectedTime), booking: null })}
                  caption={(c) => `${money(priceAt(c as unknown as PublicCourt, selectedTime))} · ${minutesLabel((c as unknown as PublicCourt).slot_minutes)}`}
                  canPick={(st) => st === "LIBRE"}
                  onPick={(c) => { setError(""); setCheckout(c as unknown as PublicCourt); }} />
              )}
              <div className="pub-courts" style={planView ? { display: "none" } : undefined}>
                {selectedTime && courts.map((c) => {
                  const st = stateFor(c, selectedTime);
                  const free = st === "LIBRE";
                  return (
                    <button key={c.id} className={`pub-court ${free ? "is-free" : "is-taken"}`} disabled={!free}
                      onClick={() => { setError(""); setCheckout(c); }}>
                      <CourtIcon sport={c.sport} width={260} fill={STATE_COLOR[st]} />
                      <div className="pub-court-info">
                        <div>
                          <strong>{c.name}</strong>
                          <small>{c.description || `${SPORT_LABELS[c.sport]} · ${c.players} jugadores`}</small>
                        </div>
                        <div className="pub-court-price">
                          <strong>{money(priceAt(c, selectedTime))}</strong>
                          <small>{minutesLabel(c.slot_minutes)}</small>
                        </div>
                      </div>
                      <span className="pub-court-state" style={{ background: STATE_SOLID[st] }}>
                        {free ? `Libre · ${timeRange(selectedTime, addMinutes(selectedTime, c.slot_minutes))}` : STATE_LABEL[st]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Checkout */}
      {checkout && selectedTime && (
        <div className="pub-sheet-overlay" onClick={() => setCheckout(null)}>
          <div className="pub-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pub-sheet-handle" />
            <h2>Confirmá tu reserva</h2>
            <div className="pub-summary">
              <CourtIcon sport={checkout.sport} width={96} />
              <div>
                <strong>{checkout.name}</strong>
                <span>{dayLabel(dayDate, false)} · {timeRange(selectedTime, addMinutes(selectedTime, checkout.slot_minutes))}</span>
                <span>{SPORT_LABELS[checkout.sport]} · {minutesLabel(checkout.slot_minutes)}</span>
              </div>
              <div className="pub-summary-total"><small>Total</small><strong>{money(priceAt(checkout, selectedTime))}</strong></div>
            </div>
            {complex.deposit && (
              <div className="pub-deposit">
                <div><span>Seña ({complex.deposit.percent}%) ahora con Mercado Pago</span><strong>{money(depositFor(priceAt(checkout, selectedTime)))}</strong></div>
                <div><span>Pagás en el complejo</span><strong>{money(priceAt(checkout, selectedTime) - depositFor(priceAt(checkout, selectedTime)))}</strong></div>
                <small>Tenés {complex.deposit.hold_minutes} minutos para pagar la seña. Si no, la cancha se libera.</small>
              </div>
            )}
            {complex.deposit?.policy && (
              <div className="pub-policy">
                <strong>Cancelación y devolución de la seña</strong>
                <p>{complex.deposit.policy}</p>
              </div>
            )}
            <form className="pub-form" onSubmit={confirm}>
              <label>Nombre y apellido<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" /></label>
              <label>Celular<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required autoComplete="tel" placeholder="11 2345 6789" /></label>
              <div className="pub-form-row">
                <label>Cuántos son<input type="number" min="1" max="50" value={form.players} placeholder={String(checkout.players)} onChange={(e) => setForm({ ...form, players: e.target.value })} /></label>
                <label>Email (opcional)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
              </div>
              <p className="pub-note">
                {complex.deposit
                  ? "La reserva se confirma cuando se acredita la seña. Al llegar, mostrá el código al encargado."
                  : "Se paga en el complejo. Al llegar, mostrá el código de tu reserva al encargado."}
              </p>
              <p className="pub-consent">
                Al confirmar aceptás que <b>{complex.name}</b>{complexContact ? ` (${complexContact})` : ""} use estos datos para gestionar tu reserva
                {complex.deposit ? " y la política de cancelación de la seña" : ""}. Leé la <Link to="/legal/privacidad">Política de privacidad</Link> y
                los <Link to="/legal/terminos">Términos</Link>.
              </p>
              {error && <div className="login-error">{error}</div>}
              <button className={`pub-cta ${complex.deposit ? "pub-cta-mp" : ""}`} type="submit" disabled={sending}>
                {sending
                  ? (complex.deposit ? "Yendo a Mercado Pago..." : "Reservando...")
                  : complex.deposit
                    ? `Pagar seña de ${money(depositFor(priceAt(checkout, selectedTime)))} con Mercado Pago`
                    : `Reservar · ${money(priceAt(checkout, selectedTime))}`}
              </button>
              <button className="pub-link" type="button" onClick={() => setCheckout(null)}>Volver</button>
            </form>
          </div>
        </div>
      )}

      <footer className="pub-footer"><PoweredBy /></footer>
    </main>
  );
}

export default Reservar;
