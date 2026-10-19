import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  appApi, money, shortDate, timeRange, downloadCsv, dayKey, BOOKING_STATUS, PAYMENT_LABELS, SPORT_LABELS, WEEKDAYS,
} from "../../config";
import type { Booking, ClientItem } from "../../config";
import BookingModal from "../../components/BookingModal";

interface ClientDetail extends ClientItem {
  bookings: Booking[];
  payments: { id: number; date: string; category: string; description: string | null; amount: number; payment_method: string }[];
  recurring: { id: number; weekday: number; weekday_label: string; start_time: string; duration_minutes: number; court_name: string | null; active: boolean }[];
}

interface Rules { frequent_visits: number; inactive_days: number; no_show_days: number; no_show_limit: number }

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "deuda", label: "Con deuda" },
  { key: "ausencias", label: "Con ausencias" },
  { key: "frecuentes", label: "Frecuentes" },
  { key: "inactivos", label: "Inactivos" },
  { key: "bloqueados", label: "Bloqueados" },
];

const EMPTY = { id: 0, name: "", phone: "", email: "", notes: "", blocked: false };

function Clientes() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [rules, setRules] = useState<Rules>({ frequent_visits: 4, inactive_days: 60, no_show_days: 90, no_show_limit: 2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(params.get("filtro") || "");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailTab, setDetailTab] = useState<"reservas" | "pagos">("reservas");
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);

  async function load() {
    try {
      const r = await appApi<{ clients: ClientItem[]; rules: Rules }>("/clients");
      setClients(r.clients);
      setRules(r.rules);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: number) {
    try {
      setDetail(await appApi<ClientDetail>(`/clients/${id}`));
      setDetailTab("reservas");
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo abrir la ficha");
    }
  }

  useEffect(() => { load(); }, [refreshKey]);
  useEffect(() => {
    const id = Number(params.get("id"));
    if (id) openDetail(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(key: string) {
    setFilter(key);
    setParams(key ? { filtro: key } : {}, { replace: true });
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const limit = new Date(Date.now() - rules.inactive_days * 86400000).toISOString();
    return clients.filter((c) => {
      const s = c.stats;
      if (q && !(c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (digits && (c.phone || "").includes(digits)))) return false;
      if (filter === "deuda") return s.debt > 0;
      if (filter === "ausencias") return s.no_shows > 0;
      if (filter === "frecuentes") return s.visits_recent >= rules.frequent_visits;
      if (filter === "inactivos") return !s.upcoming && (s.last_visit || "") < limit;
      if (filter === "bloqueados") return c.blocked;
      return true;
    });
  }, [clients, search, filter, rules]);

  const totalDebt = clients.reduce((sum, c) => sum + c.stats.debt, 0);

  function exportCsv() {
    const rows: (string | number | null)[][] = [["Nombre", "Teléfono", "Email", "Visitas", "Ausencias", "Cancelaciones", "Total gastado", "Deuda", "Última visita", "Cancha habitual", "Horario habitual", "Bloqueado", "Notas"]];
    visible.forEach((c) => rows.push([
      c.name, c.phone, c.email, c.stats.visits, c.stats.no_shows, c.stats.cancellations, c.stats.spent, c.stats.debt,
      c.stats.last_visit ? shortDate(c.stats.last_visit) : "", c.stats.usual_court, c.stats.usual_time, c.blocked ? "Sí" : "No", c.notes,
    ]));
    downloadCsv(`deportia-clientes-${dayKey(new Date())}.csv`, rows);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError("");
    const body = { name: form.name, phone: form.phone || null, email: form.email || null, notes: form.notes || null, blocked: form.blocked };
    try {
      const saved = form.id
        ? await appApi<ClientItem>(`/clients/${form.id}`, { method: "PUT", body })
        : await appApi<ClientItem>("/clients", { method: "POST", body });
      setForm(null);
      await load();
      if (detail && detail.id === saved.id) openDetail(saved.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlocked(c: ClientItem) {
    const msg = c.blocked
      ? `¿Desbloquear a ${c.name}? Va a poder reservar por la web otra vez.`
      : `¿Bloquear a ${c.name}? No va a poder reservar por la web y el sistema avisa al cargarle un turno.`;
    if (!confirm(msg)) return;
    try {
      await appApi(`/clients/${c.id}`, { method: "PUT", body: { blocked: !c.blocked } });
      await load();
      openDetail(c.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function importFromBookings() {
    if (!confirm("Se arman los clientes con los teléfonos de los turnos que ya están cargados. ¿Seguir?")) return;
    try {
      const r = await appApi<{ created: number; linked_bookings: number }>("/clients/import-from-bookings", { method: "POST" });
      alert(`Listo: ${r.created} cliente${r.created === 1 ? "" : "s"} nuevo${r.created === 1 ? "" : "s"} y ${r.linked_bookings} turno${r.linked_bookings === 1 ? "" : "s"} vinculado${r.linked_bookings === 1 ? "" : "s"}.`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo completar");
    }
  }

  function openForm(c?: ClientItem) {
    setFormError("");
    setForm(c ? { id: c.id, name: c.name, phone: c.phone || "", email: c.email || "", notes: c.notes || "", blocked: c.blocked } : { ...EMPTY });
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">CLIENTES</span>
          <h1>Clientes</h1>
          <p>Quién viene, cuánto, quién falta y quién debe.</p>
        </div>
        <div className="products-header-actions">
          <button className="secondary-button" onClick={importFromBookings}>Armar con turnos ya cargados</button>
          <button className="secondary-button" onClick={exportCsv} disabled={!visible.length}>Exportar CSV</button>
          <button className="primary-button" onClick={() => openForm()}>+ Nuevo cliente</button>
        </div>
      </div>

      <div className="dashboard-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div className="dashboard-card"><span>Clientes</span><strong>{clients.length}</strong></div>
        <div className="dashboard-card"><span>Con deuda</span><strong>{clients.filter((c) => c.stats.debt > 0).length}</strong><small>{money(totalDebt)} en total</small></div>
        <div className="dashboard-card"><span>Frecuentes</span><strong>{clients.filter((c) => c.stats.visits_recent >= rules.frequent_visits).length}</strong><small>{rules.frequent_visits}+ visitas en {rules.no_show_days} días</small></div>
      </div>

      <div className="dp-toolbar">
        <div className="dp-chip-filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={`dp-filter-chip ${filter === f.key ? "is-on" : ""}`} onClick={() => changeFilter(f.key)}
              title={f.key === "inactivos" ? `Sin venir hace ${rules.inactive_days} días` : undefined}>
              {f.key === "inactivos" ? `Inactivos hace ${rules.inactive_days} días` : f.label}
            </button>
          ))}
        </div>
        <input className="dp-search" placeholder="Buscar por nombre, teléfono o email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="products-table-container">
        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
        ) : clients.length === 0 ? (
          <div className="products-empty">
            <h3>Todavía no hay clientes</h3>
            <p>Se crean solos cuando cargás un turno con teléfono o alguien reserva por la web.</p>
            <button className="primary-button" onClick={importFromBookings}>Armar con los turnos ya cargados</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="products-empty"><p>No hay clientes para este filtro.</p></div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead><tr><th>Cliente</th><th>Visitas</th><th>Ausencias</th><th>Gastado</th><th>Deuda</th><th>Última visita</th><th>Habitual</th><th></th></tr></thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="dp-row-click" onClick={() => openDetail(c.id)}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.blocked && <span className="dp-pill dp-pill-red" style={{ marginLeft: 6 }}>Bloqueado</span>}
                      <br /><small className="dp-muted">{c.phone || "Sin teléfono"}</small>
                    </td>
                    <td>{c.stats.visits}</td>
                    <td>{c.stats.no_shows > 0
                      ? <span className={`dp-pill ${c.stats.no_shows_recent >= rules.no_show_limit ? "dp-pill-red" : "dp-pill-orange"}`}>{c.stats.no_shows}</span>
                      : "—"}</td>
                    <td>{money(c.stats.spent)}</td>
                    <td>{c.stats.debt > 0 ? <strong className="dp-red-text">{money(c.stats.debt)}</strong> : "—"}</td>
                    <td>{c.stats.last_visit ? shortDate(c.stats.last_visit) : "—"}</td>
                    <td><small className="dp-muted">{[c.stats.usual_court, c.stats.usual_time].filter(Boolean).join(" · ") || "—"}</small></td>
                    <td><button className="product-action-edit" onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}>Ver ficha</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ FICHA ============ */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="product-modal dp-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="dashboard-eyebrow">FICHA DEL CLIENTE</span>
                <h2 style={{ margin: "4px 0" }}>{detail.name}</h2>
                {detail.blocked && <span className="dp-pill dp-pill-red">Bloqueado</span>}
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>

            {detail.warnings.length > 0 && (
              <div className={`dp-alert ${detail.blocked ? "dp-alert-red" : ""}`} role="alert">
                <ul>{detail.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            <div className="dp-info-grid">
              <div><span>Teléfono</span><strong>{detail.phone ? <a href={`https://wa.me/${detail.phone}`} target="_blank" rel="noreferrer">{detail.phone}</a> : "—"}</strong></div>
              <div><span>Email</span><strong>{detail.email || "—"}</strong></div>
              <div><span>Veces que vino</span><strong>{detail.stats.visits}</strong></div>
              <div><span>Ausencias · cancelaciones</span><strong>{detail.stats.no_shows} · {detail.stats.cancellations}</strong></div>
              <div><span>Total gastado</span><strong>{money(detail.stats.spent)}</strong></div>
              <div><span>Deuda</span><strong className={detail.stats.debt > 0 ? "dp-red-text" : ""}>{money(detail.stats.debt)}</strong></div>
              <div><span>Última visita</span><strong>{detail.stats.last_visit ? shortDate(detail.stats.last_visit) : "—"}</strong></div>
              <div><span>Suele venir</span><strong>{[detail.stats.usual_time, detail.stats.usual_court, SPORT_LABELS[detail.stats.usual_sport || ""]].filter(Boolean).join(" · ") || "—"}</strong></div>
              {detail.notes && <div style={{ gridColumn: "1 / -1" }}><span>Notas</span><strong>{detail.notes}</strong></div>}
            </div>

            {detail.recurring.length > 0 && (
              <p className="dp-muted" style={{ margin: "12px 0 0" }}>
                Turnos fijos: {detail.recurring.map((r) => `${WEEKDAYS[r.weekday]} ${r.start_time} en ${r.court_name}${r.active ? "" : " (pausado)"}`).join(" · ")}
              </p>
            )}

            <div className="product-actions" style={{ margin: "16px 0 10px" }}>
              <button className={detailTab === "reservas" ? "primary-button" : "secondary-button"} onClick={() => setDetailTab("reservas")}>Reservas ({detail.bookings.length})</button>
              <button className={detailTab === "pagos" ? "primary-button" : "secondary-button"} onClick={() => setDetailTab("pagos")}>Pagos ({detail.payments.length})</button>
            </div>

            <div className="import-table-wrapper dp-scroll-box">
              {detailTab === "reservas" ? (
                detail.bookings.length === 0 ? <p className="dp-muted">Todavía no tiene reservas.</p> : (
                  <table className="import-table">
                    <thead><tr><th>Día</th><th>Horario</th><th>Cancha</th><th>Estado</th><th>Pago</th></tr></thead>
                    <tbody>
                      {detail.bookings.map((b) => (
                        <tr key={b.id} className="dp-row-click" onClick={() => setSelected(b)}>
                          <td>{shortDate(b.start_at)}</td>
                          <td>{timeRange(b.start_at, b.end_at)}</td>
                          <td>{b.court_name}</td>
                          <td><span className={`dp-pill dp-pill-${BOOKING_STATUS[b.status].tone}`}>{BOOKING_STATUS[b.status].label}</span></td>
                          <td>{b.status === "FINALIZADO" && Number(b.total_due) > 0
                            ? <strong className="dp-red-text">Falta {money(b.total_due)}</strong>
                            : b.paid ? "Pagado" : money(b.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : detail.payments.length === 0 ? <p className="dp-muted">Todavía no tiene pagos.</p> : (
                <table className="import-table">
                  <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead>
                  <tbody>
                    {detail.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{shortDate(p.date)}</td>
                        <td>{p.category}<br /><small className="dp-muted">{p.description || ""}</small></td>
                        <td>{PAYMENT_LABELS[p.payment_method] || p.payment_method}</td>
                        <td>{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button className={detail.blocked ? "secondary-button" : "product-action-delete"} onClick={() => toggleBlocked(detail)}>
                {detail.blocked ? "Desbloquear" : "Bloquear cliente"}
              </button>
              <button className="primary-button" onClick={() => openForm(detail)}>Editar datos</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ALTA / EDICIÓN ============ */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">CLIENTE</span><h2>{form.id ? "Editar cliente" : "Nuevo cliente"}</h2></div>
              <button className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Solo números" /></div>
              </div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Opcional" /></div>
              <div className="form-group"><label>Notas</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" /></div>
              <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                <label><input type="checkbox" checked={form.blocked} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} /> Bloqueado (no puede reservar por la web)</label>
              </div>
              {formError && <div className="login-error">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <BookingModal booking={selected} onClose={() => setSelected(null)}
          onChanged={() => { load(); if (detail) openDetail(detail.id); }} />
      )}
    </section>
  );
}

export default Clientes;
