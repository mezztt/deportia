import { useEffect, useState } from "react";
import { adminApi, usd, shortDate, splitList, calcPricing, calcPlans, ALL_MODULES, BILLABLE_MODULES, MODULE_LABELS } from "../../config";
import type { BillingSettings, SystemItem } from "../../config";

const QUOTE_STATUSES = ["TODAS", "BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA"];
const STATUS_LABEL = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function ModuleCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
      <input type="checkbox" style={{ width: 14, height: 14, flexShrink: 0 }} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function toggle(list: string[], m: string) {
  return list.includes(m) ? list.filter((x) => x !== m) : [...list, m];
}

function AdminBilling() {
  const [tab, setTab] = useState<"cotizaciones" | "facturas">("cotizaciones");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);

  // nueva cotización
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [modules, setModules] = useState<string[]>(["turnos", "canchas"]);
  const [applyIva, setApplyIva] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState("");

  // edición cotización
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editIva, setEditIva] = useState(true);
  const [editStatus, setEditStatus] = useState("BORRADOR");
  const [savingQuote, setSavingQuote] = useState(false);

  // facturas
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceSystemId, setInvoiceSystemId] = useState("");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceOwnerName, setInvoiceOwnerName] = useState("");

  const [quoteFilter, setQuoteFilter] = useState("TODAS");
  const [invoiceFilter, setInvoiceFilter] = useState<"activos" | "inactivos">("activos");

  async function load() {
    const [q, i, s, bs] = await Promise.all([
      adminApi<any[]>("/admin/quotes").catch(() => []),
      adminApi<any[]>("/admin/invoices").catch(() => []),
      adminApi<SystemItem[]>("/admin/systems").catch(() => []),
      adminApi<BillingSettings>("/admin/billing-settings").catch(() => null),
    ]);
    setQuotes(q); setInvoices(i); setSystems(s); setSettings(bs);
  }
  useEffect(() => { load(); }, []);

  // vista previa mientras armás la cotización: pago inicial (una vez) y abono mensual
  function preview(mods: string[], iva: boolean) {
    return calcPricing(mods, settings, iva);
  }

  async function createQuote() {
    if (!clientName || !businessName) { alert("Completá cliente y complejo."); return; }
    try {
      await adminApi("/admin/quotes", {
        method: "POST",
        body: { client_name: clientName, business_name: businessName, email: email || null, modules, apply_iva: applyIva, delivery_date: deliveryDate || null },
      });
      setClientName(""); setBusinessName(""); setEmail(""); setModules(["turnos", "canchas"]); setDeliveryDate("");
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo crear");
    }
  }

  async function deleteQuote(id: number) {
    if (!confirm("¿Borrar esta cotización? No se puede deshacer.")) return;
    try {
      await adminApi(`/admin/quotes/${id}`, { method: "DELETE" });
      setSelectedQuote(null);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  function openQuote(q: any) {
    setSelectedQuote(q);
    setEditModules(splitList(q.modules));
    setEditIva(q.apply_iva);
    setEditStatus(q.status);
  }

  async function saveQuote() {
    if (!selectedQuote) return;
    setSavingQuote(true);
    try {
      const updated = await adminApi(`/admin/quotes/${selectedQuote.id}`, {
        method: "PUT",
        body: { modules: editModules, apply_iva: editIva, status: editStatus },
      });
      setSelectedQuote(updated);
      await load();
    } catch {
      alert("No se pudo guardar.");
    } finally {
      setSavingQuote(false);
    }
  }

  /** Renglones del documento. La configuración solo va en el pago inicial (cotizaciones), nunca en la factura mensual. */
  function buildLineItems(doc: any, withSetup: boolean) {
    const items: { label: string; price: number }[] = withSetup
      ? [{ label: "Configuración inicial (una sola vez)", price: Number(settings?.setup ?? settings?.base_cost ?? 0) }]
      : [];
    for (const m of splitList(doc.modules)) {
      if (BILLABLE_MODULES.includes(m)) items.push({ label: `Módulo ${MODULE_LABELS[m]}`, price: Number(settings?.module_price ?? 0) });
      if (m === "web_reservas") items.push({ label: "Web de reservas", price: Number(settings?.web_price ?? 0) });
    }
    return items;
  }

  function printDocument(title: string, docNumber: string, toName: string, businessLabel: string, doc: any) {
    const isQuote = title === "Cotización";
    const plans = calcPlans(doc.monthly_total);
    const rows = buildLineItems(doc, isQuote).map((it) => `
      <tr><td>${it.label}</td><td style="text-align:center">1</td>
      <td style="text-align:right">${usd(it.price)}</td><td style="text-align:right">${usd(it.price)}</td></tr>`).join("");
    const totals = isQuote ? `
          <p class="t-title">Pago inicial (una sola vez)</p>
          <p>Subtotal: ${usd(doc.subtotal)}</p>
          ${doc.apply_iva ? `<p>IVA 21%: ${usd(doc.iva_amount)}</p>` : ""}
          <p><strong>Total pago inicial: ${usd(doc.total)}</strong></p>
          <p class="t-title">Abono mensual (desde el segundo mes)</p>
          <p>Subtotal: ${usd(doc.monthly_subtotal)}</p>
          ${doc.apply_iva ? `<p>IVA 21%: ${usd(doc.monthly_iva)}</p>` : ""}
          <p><strong>Total por mes: ${usd(doc.monthly_total)}</strong></p>
          <p class="t-title">Planes de suscripción</p>
          <p>Mensual: ${usd(doc.monthly_total)} por mes</p>
          <p>Trimestral: ${usd(plans.quarterly)} (1 mes gratis)</p>
          <p>Anual: ${usd(plans.annual)} (2 meses gratis, ahorrás ${usd(plans.savings)})</p>
          <p class="note">El pago inicial incluye la configuración y el primer mes. El abono mensual son los módulos y la web, sin configuración.</p>` : `
          <p class="t-title">Abono mensual</p>
          <p>Subtotal: ${usd(doc.subtotal)}</p>
          ${doc.apply_iva ? `<p>IVA 21%: ${usd(doc.iva_amount)}</p>` : ""}
          <p><strong>Total: ${usd(doc.total)}</strong></p>`;

    // el panel no emite comprobantes fiscales: lo impreso es un resumen interno
    const printTitle = isQuote ? "Cotización" : "Resumen de abono mensual";
    const html = `
      <html><head><title>${printTitle} ${docNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 36px; color: #241f1b; }
        h1 { font-size: 22px; margin-bottom: 2px; }
        .sub { color: #5b5148; font-size: 12px; margin-bottom: 24px; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .legal { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #5b5148; text-align: center; }
        p { font-size: 13px; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
        th { background: #f4efe7; text-align: left; }
        .totales { margin-top: 16px; text-align: right; font-size: 14px; }
        .totales .t-title { margin-top: 14px; font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: #5b5148; }
        .totales .note { font-size: 11px; color: #5b5148; margin-top: 12px; }
      </style></head>
      <body>
        <div class="brand">
          <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#0f2536"/><path d="M17 18 H23 A8.5 8.5 0 0 1 23 35 H17 Z" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="37" cy="11" r="3" fill="#22a05a"/></svg>
          <h1>Deportia · ${printTitle}</h1>
        </div>
        <div class="sub">N° ${docNumber} · ${new Date().toLocaleDateString("es-AR")}</div>
        <p><strong>Cliente:</strong> ${toName || "—"}</p>
        <p><strong>Complejo:</strong> ${businessLabel}</p>
        <table>
          <thead><tr><th>Ítem</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totales">${totals}
        </div>
        <p class="legal">Documento no válido como factura · Deportia by Mezztt</p>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Habilitá las ventanas emergentes."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function generateInvoice() {
    if (!invoiceSystemId) return;
    setGeneratingInvoice(true);
    try {
      await adminApi(`/admin/systems/${invoiceSystemId}/generate-invoice`, { method: "POST" });
      setShowInvoiceForm(false);
      setInvoiceSystemId("");
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo generar la factura.");
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function setInvoiceStatus(inv: any, status: string) {
    try {
      const updated = await adminApi(`/admin/invoices/${inv.id}/status`, { method: "PUT", body: { status } });
      setSelectedInvoice(updated);
      await load();
    } catch {
      alert("No se pudo actualizar.");
    }
  }

  async function openInvoice(inv: any) {
    setSelectedInvoice(inv);
    setInvoiceOwnerName("");
    try {
      const users = await adminApi<any[]>(`/admin/systems/${inv.company_id}/users`);
      const owner = users.find((u) => u.role === "ADMINISTRADOR") || users[0];
      if (owner) setInvoiceOwnerName(owner.name);
    } catch { /* sin titular */ }
  }

  const systemName = (id: number) => systems.find((s) => s.id === id)?.name || `Complejo #${id}`;
  const filteredQuotes = quotes.filter((q) => quoteFilter === "TODAS" || q.status === quoteFilter);
  const filteredInvoices = invoices.filter((inv) => {
    const archived = systems.find((s) => s.id === inv.company_id)?.archived ?? false;
    return invoiceFilter === "activos" ? !archived : archived;
  });

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · DEPORTIA</span>
          <h1>Facturación</h1>
          <p>Cotizaciones para complejos nuevos y facturas mensuales.</p>
        </div>
        {tab === "facturas" && (
          <div className="products-header-actions">
            <button className="primary-button" onClick={() => setShowInvoiceForm(true)}>+ Nueva factura</button>
          </div>
        )}
      </div>

      <div className="product-actions" style={{ marginBottom: 20 }}>
        <button className={tab === "cotizaciones" ? "primary-button" : "secondary-button"} onClick={() => setTab("cotizaciones")}>Cotizaciones</button>
        <button className={tab === "facturas" ? "primary-button" : "secondary-button"} onClick={() => setTab("facturas")}>Facturas</button>
      </div>

      {tab === "cotizaciones" && (
        <>
          <div className="dashboard-section" style={{ marginBottom: 20 }}>
            <div className="section-heading"><h2>Nueva cotización</h2></div>
            <div className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Cliente</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div className="form-group"><label>Complejo</label><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="form-group"><label>Entrega estimada</label><input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Módulos (Inicio, Configuración y Usuarios van incluidos y no se cobran)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {ALL_MODULES.map((m) => (
                    <ModuleCheckbox key={m} label={MODULE_LABELS[m]} checked={modules.includes(m)} onChange={() => setModules(toggle(modules, m))} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <ModuleCheckbox label="Aplicar IVA 21%" checked={applyIva} onChange={() => setApplyIva(!applyIva)} />
                <div className="dp-price-preview">
                  <span>Pago inicial <strong>{usd(preview(modules, applyIva).initialTotal)}</strong></span>
                  <span>Abono mensual <strong>{usd(preview(modules, applyIva).monthlyTotal)}</strong></span>
                </div>
              </div>
              <p className="dp-muted" style={{ fontSize: 11, margin: 0 }}>
                Pago inicial = configuración {usd(settings?.setup ?? 0)} (una sola vez) + {usd(settings?.module_price ?? 0)} por módulo + web {usd(settings?.web_price ?? 0)}.
                El abono mensual es lo mismo sin la configuración{applyIva ? ". Los totales incluyen IVA 21%." : "."}
              </p>
              <p className="dp-muted" style={{ fontSize: 12, margin: 0 }}>
                Trimestral: {usd(calcPlans(preview(modules, applyIva).monthlyTotal).quarterly)} (1 mes gratis) · Anual: {usd(calcPlans(preview(modules, applyIva).monthlyTotal).annual)} (2 meses gratis)
              </p>
              <button className="primary-button" onClick={createQuote} style={{ alignSelf: "flex-start" }}>Crear cotización</button>
            </div>
          </div>

          <div className="product-actions" style={{ marginBottom: 12 }}>
            {QUOTE_STATUSES.map((s) => (
              <button key={s} className={quoteFilter === s ? "primary-button" : "secondary-button"} onClick={() => setQuoteFilter(s)}>
                {s === "TODAS" ? "Todas" : STATUS_LABEL(s)}
              </button>
            ))}
          </div>

          <div className="products-table-container">
            {filteredQuotes.length === 0 ? (
              <div className="products-empty"><p>No hay cotizaciones para este filtro.</p></div>
            ) : (
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead><tr><th>Fecha</th><th>Complejo</th><th>Módulos</th><th>Pago inicial</th><th>Abono mensual</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {filteredQuotes.map((q) => (
                      <tr key={q.id}>
                        <td>{shortDate(q.created_at)}</td>
                        <td>
                          {q.business_name}
                          {String(q.notes || "").startsWith("Pedido desde la web") && <span className="dp-badge dp-badge-enviada" style={{ marginLeft: 6 }}>Web</span>}
                          <br /><small className="dp-muted">{q.client_name}</small>
                        </td>
                        <td style={{ fontSize: 11 }}>{splitList(q.modules).map((m) => MODULE_LABELS[m] || m).join(", ") || "—"}</td>
                        <td>{usd(q.total)}</td>
                        <td>{usd(q.monthly_total)}</td>
                        <td><span className={`dp-badge dp-badge-${q.status.toLowerCase()}`}>{STATUS_LABEL(q.status)}</span></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="product-action-edit" onClick={() => openQuote(q)}>Ver</button>
                          {q.status === "BORRADOR" && (
                            <button className="product-action-delete" onClick={() => deleteQuote(q.id)} style={{ marginLeft: 6 }}>Borrar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "facturas" && (
        <>
          <div className="product-actions" style={{ marginBottom: 12 }}>
            <button className={invoiceFilter === "activos" ? "primary-button" : "secondary-button"} onClick={() => setInvoiceFilter("activos")}>Complejos activos</button>
            <button className={invoiceFilter === "inactivos" ? "primary-button" : "secondary-button"} onClick={() => setInvoiceFilter("inactivos")}>Dados de baja</button>
          </div>

          <div className="products-table-container">
            {filteredInvoices.length === 0 ? (
              <div className="products-empty"><p>No hay facturas para este filtro.</p></div>
            ) : (
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead><tr><th>Período</th><th>Complejo</th><th>Abono mensual</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.period}</td>
                        <td>{systemName(inv.company_id)}</td>
                        <td>{usd(inv.total)}</td>
                        <td><span className={`dp-badge dp-badge-${inv.status.toLowerCase()}`}>{STATUS_LABEL(inv.status)}</span></td>
                        <td><button className="product-action-edit" onClick={() => openInvoice(inv)}>Ver</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL COTIZACIÓN */}
      {selectedQuote && (
        <div className="modal-overlay" onClick={() => setSelectedQuote(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">COTIZACIÓN #{selectedQuote.id}</span><h2>{selectedQuote.business_name}</h2></div>
              <button className="modal-close" onClick={() => setSelectedQuote(null)}>×</button>
            </div>
            <div className="product-form">
              <div className="form-group"><label>Cliente</label><p>{selectedQuote.client_name}{selectedQuote.email ? ` — ${selectedQuote.email}` : ""}{selectedQuote.phone ? ` — ${selectedQuote.phone}` : ""}</p></div>
              {selectedQuote.notes && (
                <div className="form-group"><label>Mensaje</label><p style={{ whiteSpace: "pre-wrap" }}>{selectedQuote.notes}</p></div>
              )}
              <div className="form-group">
                <label>Módulos</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {ALL_MODULES.map((m) => (
                    <ModuleCheckbox key={m} label={MODULE_LABELS[m]} checked={editModules.includes(m)} onChange={() => setEditModules(toggle(editModules, m))} />
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Estado</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {QUOTE_STATUSES.slice(1).map((s) => <option key={s} value={s}>{STATUS_LABEL(s)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>IVA</label>
                  <ModuleCheckbox label="Aplicar IVA 21%" checked={editIva} onChange={() => setEditIva(!editIva)} />
                </div>
              </div>
              <div className="import-table-wrapper">
                <table className="import-table">
                  <thead><tr><th></th><th>Pago inicial (una vez)</th><th>Abono mensual</th></tr></thead>
                  <tbody>
                    <tr><td>Guardado</td><td>{usd(selectedQuote.total)}</td><td>{usd(selectedQuote.monthly_total)}</td></tr>
                    <tr>
                      <td><strong>Con cambios</strong></td>
                      <td><strong>{usd(preview(editModules, editIva).initialTotal)}</strong></td>
                      <td><strong>{usd(preview(editModules, editIva).monthlyTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="dp-muted" style={{ fontSize: 12, margin: 0 }}>
                Trimestral: {usd(calcPlans(preview(editModules, editIva).monthlyTotal).quarterly)} (1 mes gratis)<br />
                Anual: {usd(calcPlans(preview(editModules, editIva).monthlyTotal).annual)} (2 meses gratis, ahorrás {usd(calcPlans(preview(editModules, editIva).monthlyTotal).savings)})
              </p>
              <p className="dp-muted" style={{ fontSize: 11, margin: 0 }}>
                El pago inicial incluye la configuración ({usd(settings?.setup ?? 0)}, una sola vez). El abono mensual no{editIva ? ". Totales con IVA 21%." : "."}
              </p>
              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary-button" onClick={() => printDocument("Cotización", `#${selectedQuote.id}`, selectedQuote.client_name, selectedQuote.business_name, selectedQuote)}>Imprimir</button>
                  {selectedQuote.status === "BORRADOR" && (
                    <button className="product-action-delete" onClick={() => deleteQuote(selectedQuote.id)}>Borrar</button>
                  )}
                </div>
                <button className="primary-button" onClick={saveQuote} disabled={savingQuote}>{savingQuote ? "Guardando..." : "Guardar cambios"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA FACTURA */}
      {showInvoiceForm && (
        <div className="modal-overlay" onClick={() => setShowInvoiceForm(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FACTURAS</span><h2>Nueva factura mensual</h2></div>
              <button className="modal-close" onClick={() => setShowInvoiceForm(false)}>×</button>
            </div>
            <div className="product-form">
              <div className="form-group">
                <label>Complejo</label>
                <select value={invoiceSystemId} onChange={(e) => setInvoiceSystemId(e.target.value)}>
                  <option value="">Elegí un complejo</option>
                  {systems.filter((s) => s.billed && !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <p className="dp-muted" style={{ fontSize: 11 }}>
                Solo aparecen complejos activos marcados como "se factura". Se factura el abono mensual: los módulos que tiene habilitados y la web, sin la configuración (esa se cobra una sola vez al inicio).
              </p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowInvoiceForm(false)}>Cancelar</button>
                <button className="primary-button" onClick={generateInvoice} disabled={generatingInvoice || !invoiceSystemId}>
                  {generatingInvoice ? "Generando..." : "Generar factura"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE FACTURA */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FACTURA {selectedInvoice.period}</span><h2>{systemName(selectedInvoice.company_id)}</h2></div>
              <button className="modal-close" onClick={() => setSelectedInvoice(null)}>×</button>
            </div>
            <div className="product-form">
              <div className="form-group"><label>Titular</label><p>{invoiceOwnerName || "—"}</p></div>
              <div className="import-table-wrapper">
                <table className="import-table">
                  <thead><tr><th>Ítem</th><th>Precio</th></tr></thead>
                  <tbody>
                    {buildLineItems(selectedInvoice, false).map((it, idx) => <tr key={idx}><td>{it.label}</td><td>{usd(it.price)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <p style={{ textAlign: "right" }}>
                Subtotal: {usd(selectedInvoice.subtotal)}<br />
                {selectedInvoice.apply_iva && <>IVA: {usd(selectedInvoice.iva_amount)}<br /></>}
                <strong>Total del mes: {usd(selectedInvoice.total)}</strong>
              </p>
              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <button className="secondary-button" onClick={() => printDocument("Factura", selectedInvoice.period, invoiceOwnerName, systemName(selectedInvoice.company_id), selectedInvoice)}>Imprimir</button>
                {selectedInvoice.status === "PENDIENTE" ? (
                  <button className="primary-button" onClick={() => setInvoiceStatus(selectedInvoice, "PAGADA")}>Marcar pagada</button>
                ) : (
                  <button className="secondary-button" onClick={() => setInvoiceStatus(selectedInvoice, "PENDIENTE")}>Volver a pendiente</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminBilling;
