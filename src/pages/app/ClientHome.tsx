import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { appApi, money, timeRange, getSessionUser, COURT_STATUS, BOOKING_STATUS } from "../../config";
import type { Booking, Court } from "../../config";
import CourtIcon from "../../components/CourtIcon";
import BookingModal from "../../components/BookingModal";
import BookingForm from "../../components/BookingForm";
import QuickSale from "../../components/QuickSale";
import { canAccess } from "./ClientLayout";

interface PendingItem { key: string; module: string; label: string; count: number; to: string; amount: number | null; hint: string | null }

interface Overview {
  now: string;
  today_count: number;
  in_progress: number;
  waiting: number;
  income_today: number;
  income_month: number;
  pending_count: number;
  pending_total: number;
  occupancy: number;
  courts: { id: number; name: string; sport: string; status: string; booking: Booking | null }[];
  upcoming: Booking[];
  courts_count: number;
}

function ClientHome() {
  const navigate = useNavigate();
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const user = getSessionUser();
  const seeMoney = canAccess(user, "facturacion");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [selling, setSelling] = useState(false);
  const canSell = canAccess(user, "buffet");

  async function load() {
    try {
      setData(await appApi<Overview>("/dashboard"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    }
    // Pendientes: solo lo que este usuario puede ver y resolver
    appApi<{ items: PendingItem[] }>("/dashboard/pending")
      .then((r) => setPending(r.items.filter((i) => canAccess(user, i.module))))
      .catch(() => setPending(null));
  }

  useEffect(() => {
    load();
    appApi<Court[]>("/courts").then(setCourts).catch(() => {});
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (refreshKey) load(); }, [refreshKey]);

  async function searchCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeError("");
    try {
      setSelected(await appApi<Booking>(`/bookings/by-code/${encodeURIComponent(code.trim())}`));
      setCode("");
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "No encontrado");
    }
  }

  if (error && !data) {
    return <section className="products-page"><div className="products-empty"><h3>No se pudo cargar el inicio</h3><p>{error}</p></div></section>;
  }
  if (!data) {
    return <section className="products-page"><div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div></section>;
  }

  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">INICIO</span>
          <h1>{greeting}, {user?.name?.split(" ")[0]}</h1>
          <p>Así está el complejo ahora.</p>
        </div>
        <div className="products-header-actions" data-tour="inicio-acciones">
          <form onSubmit={searchCode} className="dp-code-search">
            <input placeholder="Código del turno" value={code} maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="secondary-button" type="submit">Buscar</button>
          </form>
          {canSell && <button className="secondary-button" onClick={() => setSelling(true)}>Venta rápida</button>}
          <button className="primary-button" onClick={() => setCreating(true)}>+ Nuevo turno</button>
        </div>
      </div>
      {codeError && <div className="login-error" style={{ marginBottom: 16 }}>{codeError}</div>}

      {/* ---------- Pendientes: lo que requiere acción hoy ---------- */}
      {pending && (
        <div className="dashboard-section dp-pending" data-tour="pendientes">
          <div className="section-heading dp-heading-row">
            <div><h2>Pendientes</h2><p>Lo que conviene resolver hoy</p></div>
            {pending.length === 0 && <span className="dp-pill dp-pill-green">Todo al día</span>}
          </div>
          {pending.length === 0 ? (
            <p className="dp-muted" style={{ margin: 0 }}>Todo al día: no hay nada pendiente.</p>
          ) : (
            <div className="dp-pending-grid">
              {pending.map((i) => (
                <button key={i.key} className="dp-pending-item" onClick={() => navigate(i.to)}>
                  <span className="dp-pending-count">{i.count}</span>
                  <span className="dp-pending-text">
                    <strong>{i.label}</strong>
                    {((seeMoney && i.amount) || i.hint) && <small>{seeMoney && i.amount ? money(i.amount) : i.hint}</small>}
                  </span>
                  <span className="dp-pending-go" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span>Turnos de hoy</span>
          <strong>{data.today_count}</strong>
          <small>Ocupación del día {data.occupancy}%</small>
          <div className="dp-progress"><div style={{ width: `${data.occupancy}%` }} /></div>
        </div>
        <div className="dashboard-card">
          <span>Jugando ahora</span>
          <strong>{data.in_progress}</strong>
          <small>{data.waiting > 0 ? `${data.waiting} por llegar` : "Nadie esperando"}</small>
        </div>
        {seeMoney ? (
          <>
            <div className="dashboard-card">
              <span>Cobrado hoy</span>
              <strong>{money(data.income_today)}</strong>
              <small>Este mes {money(data.income_month)}</small>
            </div>
            <div className={`dashboard-card ${data.pending_count ? "dp-card-warn" : ""}`}>
              <span>Por cobrar</span>
              <strong>{money(data.pending_total)}</strong>
              <small>{data.pending_count} turno{data.pending_count === 1 ? "" : "s"} jugado{data.pending_count === 1 ? "" : "s"} sin pagar</small>
            </div>
          </>
        ) : (
          <div className="dashboard-card">
            <span>Canchas</span>
            <strong>{data.courts_count}</strong>
            <small>Activas en el complejo</small>
          </div>
        )}
      </div>

      <div className="dp-grid-2">
        <div className="dashboard-section">
          <div className="section-heading dp-heading-row">
            <div><h2>Canchas ahora</h2><p>Tocá una para ver sus horarios</p></div>
            <div className="dp-legend">
              {["LIBRE", "RESERVADA", "OCUPADA"].map((s) => (
                <span key={s}><i style={{ background: COURT_STATUS[s].color }} />{COURT_STATUS[s].label}</span>
              ))}
            </div>
          </div>
          {data.courts.length === 0 ? (
            <div className="products-empty">
              <p>Todavía no hay canchas.</p>
              {canAccess(user, "canchas") && <button className="primary-button" onClick={() => navigate("/app/canchas")}>Crear canchas</button>}
            </div>
          ) : (
            <div className="dp-mini-courts">
              {data.courts.map((c) => (
                <button key={c.id} className="dp-mini-court"
                  onClick={() => (c.booking ? setSelected(c.booking) : navigate(`/app/canchas?court=${c.id}`))}>
                  <CourtIcon sport={c.sport} width={120} fill={COURT_STATUS[c.status].color} />
                  <strong>{c.name}</strong>
                  <small className={`dp-status-text st-${c.status.toLowerCase()}`}>
                    {COURT_STATUS[c.status].label}
                    {c.booking && ` · ${timeRange(c.booking.start_at, c.booking.end_at)}`}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-heading dp-heading-row">
            <div><h2>Próximos turnos de hoy</h2><p>En curso y por llegar</p></div>
            {canAccess(user, "turnos") && <button className="secondary-button" onClick={() => navigate("/app/turnos")}>Ver todos</button>}
          </div>
          {data.upcoming.length === 0 ? (
            <p className="dp-muted">No quedan turnos para hoy.</p>
          ) : (
            <ul className="dp-list">
              {data.upcoming.map((b) => (
                <li key={b.id} onClick={() => setSelected(b)}>
                  <span className="dp-time-badge">{timeRange(b.start_at, b.end_at)}</span>
                  <div className="dp-list-main">
                    <strong>{b.customer_name}</strong>
                    <small>{b.court_name} · {b.players_count ? `${b.players_count} personas` : "—"}</small>
                  </div>
                  <span className={`dp-pill dp-pill-${BOOKING_STATUS[b.status].tone}`}>{BOOKING_STATUS[b.status].label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selected && (
        <BookingModal
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
          onEdit={(b) => { setSelected(null); setEditing(b); }}
        />
      )}
      {selling && <QuickSale onClose={() => setSelling(false)} onSold={() => load()} />}
      {(creating || editing) && (
        <BookingForm
          courts={courts}
          booking={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(b) => { setCreating(false); setEditing(null); load(); setSelected(b); }}
        />
      )}
    </section>
  );
}

export default ClientHome;
