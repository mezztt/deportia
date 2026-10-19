import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import {
  appApi, money, shortDate, timeRange, dayKey, parseDay, addDays, toLocalISO, hhmm,
  PAYMENT_METHODS, PAYMENT_LABELS,
} from "../../config";
import type { Booking } from "../../config";
import BookingModal from "../../components/BookingModal";

interface Summary {
  from: string; to: string;
  income: number; expense: number; balance: number;
  count_income: number; count_expense: number;
  by_method: { method: string; ingresos: number; egresos: number }[];
  by_category: { category: string; type: string; total: number }[];
  days: { date: string; ingresos: number; egresos: number }[];
  pending_count: number; pending_total: number;
}

interface Movement {
  id: number; type: "INGRESO" | "EGRESO"; category: string; description: string | null;
  amount: number; payment_method: string; date: string; booking_id: number | null;
}

type Period = "hoy" | "semana" | "mes" | "mes_anterior" | "custom";

function periodRange(p: Period, customFrom: string, customTo: string): [string, string] {
  const today = new Date();
  if (p === "hoy") return [dayKey(today), dayKey(today)];
  if (p === "semana") {
    const dow = (today.getDay() + 6) % 7; // lunes = 0
    return [dayKey(addDays(today, -dow)), dayKey(today)];
  }
  if (p === "mes") return [dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), dayKey(today)];
  if (p === "mes_anterior") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return [dayKey(first), dayKey(last)];
  }
  return [customFrom, customTo];
}

function Facturacion() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [period, setPeriod] = useState<Period>("mes");
  const [customFrom, setCustomFrom] = useState(dayKey(addDays(new Date(), -7)));
  const [customTo, setCustomTo] = useState(dayKey(new Date()));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pending, setPending] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"movimientos" | "pendientes">("movimientos");
  const [typeFilter, setTypeFilter] = useState("");
  const [options, setOptions] = useState<{ income_categories: string[]; expense_categories: string[] }>({ income_categories: [], expense_categories: [] });
  const [form, setForm] = useState<null | { type: "INGRESO" | "EGRESO"; category: string; description: string; amount: string; payment_method: string; date: string; time: string }>(null);
  const [formError, setFormError] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);

  const [from, to] = periodRange(period, customFrom, customTo);

  async function load() {
    const qs = `date_from=${from}&date_to=${to}`;
    try {
      const [s, m, p] = await Promise.all([
        appApi<Summary>(`/finance/summary?${qs}`),
        appApi<Movement[]>(`/finance/movements?${qs}`),
        appApi<Booking[]>("/finance/pending"),
      ]);
      setSummary(s); setMovements(m); setPending(p);
    } catch { /* noop */ }
  }

  useEffect(() => { appApi("/finance/options").then(setOptions).catch(() => {}); }, []);
  useEffect(() => { load(); }, [from, to, refreshKey]);

  function openForm(type: "INGRESO" | "EGRESO") {
    setFormError("");
    const now = new Date();
    setForm({
      type,
      category: type === "INGRESO" ? options.income_categories[1] || "Otros ingresos" : options.expense_categories[0] || "Otros gastos",
      description: "", amount: "", payment_method: "EFECTIVO", date: dayKey(now), time: hhmm(now),
    });
  }

  async function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    const d = parseDay(form.date);
    const [h, m] = form.time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    try {
      await appApi("/finance/movements", {
        method: "POST",
        body: { ...form, amount: Number(form.amount), description: form.description || null, date: toLocalISO(d) },
      });
      setForm(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function removeMovement(m: Movement) {
    const msg = m.booking_id
      ? "Este ingreso es el cobro de un turno. Si lo borrás, el turno vuelve a quedar sin cobrar. ¿Seguir?"
      : "¿Borrar este movimiento?";
    if (!confirm(msg)) return;
    try {
      await appApi(`/finance/movements/${m.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo borrar");
    }
  }

  function exportCsv() {
    const rows = [["Fecha", "Hora", "Tipo", "Categoría", "Descripción", "Método", "Monto"]];
    movements.forEach((m) => rows.push([
      shortDate(m.date), hhmm(m.date), m.type, m.category, m.description || "",
      PAYMENT_LABELS[m.payment_method] || m.payment_method, String(m.type === "EGRESO" ? -m.amount : m.amount),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deportia-movimientos-${from}-a-${to}.csv`;
    a.click();
  }

  const visibleMovements = movements.filter((m) => !typeFilter || m.type === typeFilter);
  const maxDay = Math.max(1, ...(summary?.days || []).map((d) => Math.max(d.ingresos, d.egresos)));
  const showBars = (summary?.days.length || 0) > 1 && (summary?.days.length || 0) <= 62;
  const maxMethod = Math.max(1, ...(summary?.by_method || []).map((m) => m.ingresos));

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">FACTURACIÓN</span>
          <h1>Facturación</h1>
          <p>Cobros de turnos, otros ingresos y gastos del complejo.</p>
        </div>
        <div className="products-header-actions">
          <button className="secondary-button" onClick={() => openForm("EGRESO")}>− Cargar gasto</button>
          <button className="primary-button" onClick={() => openForm("INGRESO")}>+ Cargar ingreso</button>
        </div>
      </div>

      <div className="dp-toolbar">
        <div className="dp-chip-filters">
          {([["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mes_anterior", "Mes anterior"], ["custom", "Elegir fechas"]] as [Period, string][]).map(([k, l]) => (
            <button key={k} className={`dp-filter-chip ${period === k ? "is-on" : ""}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="dp-filters">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      {summary && (
        <>
          <div className="dashboard-cards">
            <div className="dashboard-card"><span>Ingresos</span><strong className="dp-green-text">{money(summary.income)}</strong><small>{summary.count_income} movimientos</small></div>
            <div className="dashboard-card"><span>Gastos</span><strong className="dp-red-text">{money(summary.expense)}</strong><small>{summary.count_expense} movimientos</small></div>
            <div className="dashboard-card"><span>Balance</span><strong>{money(summary.balance)}</strong><small>{shortDate(summary.from + "T00:00:00")} al {shortDate(summary.to + "T00:00:00")}</small></div>
            <div className={`dashboard-card ${summary.pending_count ? "dp-card-warn" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab("pendientes")}>
              <span>Turnos sin cobrar</span><strong>{money(summary.pending_total)}</strong><small>{summary.pending_count} {summary.pending_count === 1 ? "turno" : "turnos"} · ver ›</small>
            </div>
          </div>

          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Día a día</h2><p>Ingresos y gastos</p></div>
                <div className="dp-legend"><span><i style={{ background: "#22a05a" }} />Ingresos</span><span><i style={{ background: "#d64545" }} />Gastos</span></div>
              </div>
              {showBars ? (
                <div className="dp-bars dp-bars-double">
                  {summary.days.map((d) => (
                    <div key={d.date} className="dp-bar-col" title={`${d.date}: +${money(d.ingresos)} / −${money(d.egresos)}`}>
                      <div className="dp-bar-track dp-bar-pair">
                        <div className="dp-bar" style={{ height: `${(d.ingresos / maxDay) * 100}%` }} />
                        <div className="dp-bar dp-bar-red" style={{ height: `${(d.egresos / maxDay) * 100}%` }} />
                      </div>
                      <span className="dp-bar-label">{Number(d.date.slice(8))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dp-muted">Elegí un período de más de un día para ver el gráfico.</p>
              )}
            </div>

            <div className="dashboard-section">
              <div className="section-heading"><h2>Por método de pago</h2><p>Ingresos del período</p></div>
              {summary.by_method.length === 0 ? <p className="dp-muted">Sin movimientos.</p> : (
                <ul className="dp-usage">
                  {summary.by_method.map((m) => (
                    <li key={m.method}>
                      <div className="dp-usage-row"><span>{PAYMENT_LABELS[m.method] || m.method}</span><strong>{money(m.ingresos)}</strong></div>
                      <div className="dp-progress"><div style={{ width: `${(m.ingresos / maxMethod) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
              {summary.by_category.some((c) => c.type === "EGRESO") && (
                <>
                  <div className="section-heading" style={{ marginTop: 18 }}><h2>Gastos por categoría</h2></div>
                  <ul className="dp-list">
                    {summary.by_category.filter((c) => c.type === "EGRESO").map((c) => (
                      <li key={c.category} style={{ cursor: "default" }}>
                        <div className="dp-list-main"><strong>{c.category}</strong></div>
                        <span className="dp-list-amount dp-red-text">{money(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div className="dp-toolbar" style={{ marginTop: 18 }}>
        <div className="product-actions" style={{ width: "auto" }}>
          <button className={tab === "movimientos" ? "primary-button" : "secondary-button"} onClick={() => setTab("movimientos")}>Movimientos</button>
          <button className={tab === "pendientes" ? "primary-button" : "secondary-button"} onClick={() => setTab("pendientes")}>Por cobrar ({pending.length})</button>
        </div>
        {tab === "movimientos" && (
          <div className="dp-filters">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Ingresos y gastos</option>
              <option value="INGRESO">Solo ingresos</option>
              <option value="EGRESO">Solo gastos</option>
            </select>
            <button className="secondary-button" onClick={exportCsv} disabled={!movements.length}>Exportar Excel (CSV)</button>
          </div>
        )}
      </div>

      <div className="products-table-container">
        {tab === "movimientos" ? (
          visibleMovements.length === 0 ? (
            <div className="products-empty"><p>No hay movimientos en este período.</p></div>
          ) : (
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Detalle</th><th>Método</th><th>Monto</th><th></th></tr></thead>
                <tbody>
                  {visibleMovements.map((m) => (
                    <tr key={m.id}>
                      <td>{shortDate(m.date)}<br /><small className="dp-muted">{hhmm(m.date)}</small></td>
                      <td><span className={`dp-pill ${m.type === "INGRESO" ? "dp-pill-green" : "dp-pill-red"}`}>{m.type === "INGRESO" ? "Ingreso" : "Gasto"}</span></td>
                      <td>{m.category}</td>
                      <td>{m.description || "—"}</td>
                      <td>{PAYMENT_LABELS[m.payment_method] || m.payment_method}</td>
                      <td><strong className={m.type === "INGRESO" ? "dp-green-text" : "dp-red-text"}>{m.type === "INGRESO" ? "+" : "−"}{money(m.amount)}</strong></td>
                      <td><button className="product-action-delete" onClick={() => removeMovement(m)}>Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : pending.length === 0 ? (
          <div className="products-empty"><p>No hay turnos jugados sin cobrar. 🎉</p></div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead><tr><th>Día</th><th>Horario</th><th>Cancha</th><th>A nombre de</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id}>
                    <td>{shortDate(b.start_at)}</td>
                    <td>{timeRange(b.start_at, b.end_at)}</td>
                    <td>{b.court_name}</td>
                    <td>{b.customer_name}<br /><small className="dp-muted">{b.customer_phone || ""}</small></td>
                    <td><strong>{money(b.price)}</strong></td>
                    <td><button className="primary-button dp-btn-green" onClick={() => setSelected(b)}>$ Cobrar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <BookingModal booking={selected} onClose={() => setSelected(null)} onChanged={() => load()} />
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">{form.type === "INGRESO" ? "INGRESO" : "GASTO"}</span><h2>{form.type === "INGRESO" ? "Cargar ingreso" : "Cargar gasto"}</h2></div>
              <button className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={saveMovement}>
              <div className="form-row">
                <div className="form-group">
                  <label>Categoría</label>
                  <input list="dp-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
                  <datalist id="dp-categories">
                    {(form.type === "INGRESO" ? options.income_categories : options.expense_categories).map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group"><label>Monto</label><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              </div>
              <div className="form-group"><label>Detalle</label><input value={form.description} placeholder="Opcional" onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group">
                <label>Método de pago</label>
                <div className="dp-method-grid">
                  {PAYMENT_METHODS.map((m) => (
                    <button type="button" key={m} className={`dp-method ${form.payment_method === m ? "is-on" : ""}`} onClick={() => setForm({ ...form, payment_method: m })}>{PAYMENT_LABELS[m]}</button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Fecha</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="form-group"><label>Hora</label><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></div>
              </div>
              {formError && <div className="login-error">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancelar</button>
                <button type="submit" className="primary-button">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Facturacion;
