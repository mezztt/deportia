import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  appApi, money, hhmm, shortDate, dayKey, downloadCsv, getSessionUser, PAYMENT_LABELS, SPORTS, SPORT_LABELS,
} from "../../config";
import type { BookingItem, BuffetProduct } from "../../config";
import QuickSale from "../../components/QuickSale";

interface Summary {
  from: string; to: string; total: number; count: number; counter_total: number; booking_total: number;
  by_method: { method: string; total: number }[];
  ranking: { description: string; quantity: number; total: number }[];
  sales: BookingItem[];
  unpaid_total: number; unpaid_count: number;
  low_stock: BuffetProduct[];
}

type Tab = "ventas" | "productos";

const EMPTY = {
  id: 0, name: "", category: "Bebidas", price: "", sport: "", track_stock: false, stock: "0", min_stock: "", active: true,
};

function Buffet() {
  const { refreshKey } = useOutletContext<{ refreshKey: number }>();
  const [params, setParams] = useSearchParams();
  const user = getSessionUser();
  const canManage = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";

  const [tab, setTabState] = useState<Tab>(params.get("tab") === "productos" ? "productos" : "ventas");
  const [products, setProducts] = useState<BuffetProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [from, setFrom] = useState(dayKey(new Date()));
  const [to, setTo] = useState(dayKey(new Date()));
  const [error, setError] = useState("");
  const [selling, setSelling] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function setTab(t: Tab) {
    setTabState(t);
    setParams(t === "ventas" ? {} : { tab: t }, { replace: true });
  }

  async function loadProducts() {
    try {
      const r = await appApi<{ products: BuffetProduct[]; categories: string[] }>("/buffet/products?include_inactive=true");
      setProducts(r.products);
      setCategories(r.categories);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el buffet");
    }
  }

  async function loadSummary() {
    try {
      setSummary(await appApi<Summary>(`/buffet/summary?date_from=${from}&date_to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el buffet");
    }
  }

  useEffect(() => { loadProducts(); }, [refreshKey]);
  useEffect(() => { if (from && to) loadSummary(); }, [from, to, refreshKey]);

  const isToday = from === dayKey(new Date()) && to === from;
  const maxRank = Math.max(1, ...(summary?.ranking || []).map((r) => r.quantity));

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  function openForm(p?: BuffetProduct) {
    setFormError("");
    setForm(p ? {
      id: p.id, name: p.name, category: p.category, price: String(p.price), sport: p.sport || "",
      track_stock: p.track_stock, stock: String(p.stock), min_stock: p.min_stock !== null ? String(p.min_stock) : "", active: p.active,
    } : { ...EMPTY });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError("");
    const body = {
      name: form.name, category: form.category || "Otros", price: Number(form.price) || 0, sport: form.sport || null,
      track_stock: form.track_stock, stock: Number(form.stock) || 0,
      min_stock: form.min_stock === "" ? null : Number(form.min_stock), active: form.active,
    };
    try {
      if (form.id) await appApi(`/buffet/products/${form.id}`, { method: "PUT", body });
      else await appApi("/buffet/products", { method: "POST", body });
      setForm(null);
      await loadProducts();
      loadSummary();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form?.id || !confirm("¿Eliminar este producto? Si ya tuvo ventas, queda desactivado.")) return;
    try {
      const r = await appApi<{ detail: string }>(`/buffet/products/${form.id}`, { method: "DELETE" });
      alert(r.detail);
      setForm(null);
      loadProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  function exportSales() {
    if (!summary) return;
    const rows: (string | number | null)[][] = [["Fecha", "Hora", "Producto", "Cantidad", "Precio", "Total", "Método", "Origen"]];
    summary.sales.forEach((s) => rows.push([
      s.paid_at ? shortDate(s.paid_at) : "", s.paid_at ? hhmm(s.paid_at) : "", s.description, s.quantity, s.unit_price, s.total,
      PAYMENT_LABELS[s.payment_method || ""] || s.payment_method, s.booking_id ? "Turno" : "Mostrador",
    ]));
    downloadCsv(`deportia-buffet-ventas-${from}-a-${to}.csv`, rows);
  }

  function exportRanking() {
    if (!summary) return;
    const rows: (string | number | null)[][] = [["Producto", "Cantidad", "Total"]];
    summary.ranking.forEach((r) => rows.push([r.description, r.quantity, r.total]));
    downloadCsv(`deportia-buffet-ranking-${from}-a-${to}.csv`, rows);
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">BUFFET</span>
          <h1>Buffet y productos</h1>
          <p>Bebidas, alquileres y roturas: se suman al turno o se venden en el mostrador.</p>
        </div>
        <div className="products-header-actions">
          {canManage && <button className="secondary-button" onClick={() => openForm()}>+ Nuevo producto</button>}
          <button className="primary-button" onClick={() => setSelling(true)}>Venta rápida</button>
        </div>
      </div>
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="product-actions" style={{ marginBottom: 16 }}>
        <button className={tab === "ventas" ? "primary-button" : "secondary-button"} onClick={() => setTab("ventas")}>Ventas</button>
        <button className={tab === "productos" ? "primary-button" : "secondary-button"} onClick={() => setTab("productos")}>
          Productos ({products.filter((p) => p.active).length})
        </button>
      </div>

      {summary && summary.low_stock.length > 0 && (
        <div className="dp-alert" role="status">
          <strong>Stock bajo</strong>
          <ul>{summary.low_stock.map((p) => <li key={p.id}>{p.name}: quedan {p.stock}{p.min_stock !== null ? ` (mínimo ${p.min_stock})` : ""}</li>)}</ul>
        </div>
      )}

      {tab === "ventas" && (
        <>
          <div className="dp-toolbar">
            <div className="dp-filters">
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="Desde" />
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="Hasta" />
              {!isToday && <button className="secondary-button" onClick={() => { setFrom(dayKey(new Date())); setTo(dayKey(new Date())); }}>Hoy</button>}
            </div>
            <div className="product-actions">
              <button className="secondary-button" onClick={exportSales} disabled={!summary?.sales.length}>Exportar ventas</button>
            </div>
          </div>

          <div className="dashboard-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <div className="dashboard-card">
              <span>{isToday ? "Vendido hoy" : "Vendido en el período"}</span>
              <strong>{money(summary?.total)}</strong>
              <small>{summary?.count || 0} renglones cobrados</small>
            </div>
            <div className="dashboard-card">
              <span>En turnos · en mostrador</span>
              <strong>{money(summary?.booking_total)} · {money(summary?.counter_total)}</strong>
              <small>{(summary?.by_method || []).map((m) => `${PAYMENT_LABELS[m.method] || m.method} ${money(m.total)}`).join(" · ") || "Sin cobros"}</small>
            </div>
            <div className={`dashboard-card ${summary?.unpaid_total ? "dp-card-warn" : ""}`}>
              <span>Consumos sin cobrar</span>
              <strong>{money(summary?.unpaid_total)}</strong>
              <small>{summary?.unpaid_count || 0} turno{summary?.unpaid_count === 1 ? "" : "s"} · se cobran desde el turno</small>
            </div>
          </div>

          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Lo más vendido</h2><p>Por cantidad</p></div>
                <button className="secondary-button" onClick={exportRanking} disabled={!summary?.ranking.length}>Exportar CSV</button>
              </div>
              {!summary?.ranking.length ? <p className="dp-muted">Todavía no hay ventas en estas fechas.</p> : (
                <ul className="dp-hbars">
                  {summary.ranking.map((r) => (
                    <li key={r.description} title={`${r.description}: ${r.quantity} unidades · ${money(r.total)}`}>
                      <div className="dp-hbar-label"><span>{r.description}</span><strong>{r.quantity} · {money(r.total)}</strong></div>
                      <div className="dp-hbar-track"><div className="dp-hbar-fill" style={{ width: `${(r.quantity / maxRank) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dashboard-section">
              <div className="section-heading"><h2>{isToday ? "Ventas de hoy" : "Ventas del período"}</h2><p>Lo último primero</p></div>
              {!summary?.sales.length ? <p className="dp-muted">Todavía no se cobró nada.</p> : (
                <ul className="dp-list dp-scroll-box">
                  {summary.sales.map((s) => (
                    <li key={s.id} style={{ cursor: "default" }}>
                      <span className="dp-time-badge">{s.paid_at ? hhmm(s.paid_at) : "—"}</span>
                      <div className="dp-list-main">
                        <strong>{s.quantity}× {s.description}</strong>
                        <small>{s.booking_id ? "En un turno" : "Mostrador"} · {PAYMENT_LABELS[s.payment_method || ""] || "—"}</small>
                      </div>
                      <span className="dp-list-amount">{money(s.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "productos" && (
        <>
          <div className="dp-toolbar">
            <input className="dp-search" placeholder="Buscar producto o categoría" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="products-table-container">
            {products.length === 0 ? (
              <div className="products-empty">
                <h3>Todavía no hay productos</h3>
                <p>Cargá lo que vendés o cobrás aparte: bebidas, alquiler de paletas, pelotas rotas…</p>
                {canManage && <button className="primary-button" onClick={() => openForm()}>+ Cargar el primer producto</button>}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="products-empty"><p>No hay productos que coincidan.</p></div>
            ) : (
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead><tr><th>Producto</th><th>Categoría</th><th>Deporte</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {visibleProducts.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.category}</td>
                        <td>{p.sport ? SPORT_LABELS[p.sport] || p.sport : <span className="dp-muted">Todos</span>}</td>
                        <td>{money(p.price)}</td>
                        <td>{!p.track_stock ? <span className="dp-muted">No se controla</span>
                          : p.low_stock ? <span className="dp-pill dp-pill-red">{p.stock} · bajo</span> : p.stock}</td>
                        <td>{p.active ? <span className="dp-pill dp-pill-green">Activo</span> : <span className="dp-pill dp-pill-gray">Inactivo</span>}</td>
                        <td>{canManage && <button className="product-action-edit" onClick={() => openForm(p)}>Editar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {selling && <QuickSale onClose={() => setSelling(false)} onSold={() => { loadSummary(); loadProducts(); }} />}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">PRODUCTO</span><h2>{form.id ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Nombre</label><input value={form.name} placeholder="Ej: Gatorade, Pelota rota" onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label>Precio</label><input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Categoría</label>
                  <input list="dp-buffet-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  <datalist id="dp-buffet-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label>Se sugiere primero en</label>
                  <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
                    <option value="">Todas las canchas</option>
                    {SPORTS.map((s) => <option key={s} value={s}>Canchas de {SPORT_LABELS[s].toLowerCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="dp-inline-checks" style={{ paddingTop: 0 }}>
                <label><input type="checkbox" checked={form.track_stock} onChange={(e) => setForm({ ...form, track_stock: e.target.checked })} /> Controlar stock (descuenta al vender)</label>
                {form.id > 0 && <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Producto activo</label>}
              </div>
              {form.track_stock && (
                <div className="form-row">
                  <div className="form-group"><label>Stock actual</label><input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
                  <div className="form-group"><label>Avisar cuando queden</label><input type="number" min="0" value={form.min_stock} placeholder="Opcional" onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
                </div>
              )}
              {formError && <div className="login-error">{formError}</div>}
              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <div>{form.id > 0 && <button type="button" className="product-action-delete" onClick={remove}>Eliminar</button>}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancelar</button>
                  <button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Buffet;
