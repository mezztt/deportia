import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface SystemItem {
  id: number;
  name: string;
  subscription_status: string;
  enabled_modules: string | null;
  client_price: number | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  created_at: string;
}

interface PaymentItem {
  id: number;
  amount: number;
  payment_date: string;
  method: string | null;
  notes: string | null;
}

const API_URL = "http://127.0.0.1:8020";
const ALL_MODULES = [
  "clientes", "proveedores", "productos", "stock", "pedidos", "entregas",
  "facturacion", "cuentas", "compras", "pos", "caja", "reportes",
];

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("velora_admin_token")}` };
}

function statusColor(status: string) {
  return status === "active" ? "#3fae5c" : "#a05c50";
}

function Sistemas() {
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("al_dia");
  const [dueDate, setDueDate] = useState("");
  const [billed, setBilled] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<SystemItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "pagos" | "seguridad">("info");
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function loadSystems() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/systems`, { headers: authHeaders() });
      if (!response.ok) throw new Error();
      setSystems(await response.json());
    } catch {
      console.error("No se pudieron cargar los sistemas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSystems(); }, []);

  function toggleModule(id: string) {
    setModules((c) => (c.includes(id) ? c.filter((m) => m !== id) : [...c, id]));
  }

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/admin/systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          company_name: companyName,
          enabled_modules: modules,
          client_price: price ? Number(price) : null,
          payment_status: paymentStatus,
          payment_due_date: dueDate || null,
          billed,
          admin_email: adminEmail,
          admin_password: adminPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo crear el sistema");
      setShowForm(false);
      setCompanyName(""); setModules([]); setPrice(""); setAdminEmail(""); setAdminPassword("");
      await loadSystems();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo crear el sistema.");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(system: SystemItem) {
    setDetail(system);
    setDetailTab("info");
    setNewPassword("");
    try {
      const response = await fetch(`${API_URL}/admin/systems/${system.id}/payments`, { headers: authHeaders() });
      if (response.ok) setPayments(await response.json());
    } catch {
      setPayments([]);
    }
  }

  async function addPayment() {
    if (!detail || !payAmount) return;
    try {
      const response = await fetch(`${API_URL}/admin/systems/${detail.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod, notes: payNotes || null }),
      });
      if (!response.ok) throw new Error();
      setPayAmount(""); setPayNotes("");
      const refreshed = await fetch(`${API_URL}/admin/systems/${detail.id}/payments`, { headers: authHeaders() });
      setPayments(await refreshed.json());
      await loadSystems();
    } catch {
      alert("No se pudo registrar el pago.");
    }
  }

  async function doSecurityReset() {
    if (!detail || !newPassword) return;
    try {
      const response = await fetch(`${API_URL}/admin/systems/${detail.id}/security-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo resetear");
      alert(data.detail);
      setNewPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo resetear.");
    }
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT</span>
          <h1>Sistemas</h1>
          <p>Todos los sistemas que creaste, con su estado en vivo.</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={() => setShowForm(true)}>+ Nuevo sistema</button>
        </div>
      </div>

      {loading ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : systems.length === 0 ? (
        <div className="products-empty">
          <div className="products-empty-icon">◯</div>
          <h3>Todavía no creaste ningún sistema</h3>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {systems.map((s) => (
            <div
              key={s.id}
              className="dashboard-card"
              style={{ cursor: "pointer" }}
              onClick={() => openDetail(s)}
            >
              <div className="dashboard-card-top">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: statusColor(s.subscription_status),
                      display: "inline-block",
                    }}
                  />
                  {s.subscription_status === "active" ? "Activo" : "Inactivo"}
                </span>
              </div>
              <strong style={{ fontSize: 18 }}>{s.name}</strong>
              <small>
                {s.client_price ? `$${s.client_price}/mes` : "Sin precio"} ·{" "}
                {s.payment_status === "al_dia" ? "Al día" : s.payment_status}
              </small>
              <p style={{ fontSize: 11, color: "#9a8b7d", marginTop: 10 }}>
                {(s.enabled_modules || "").split(",").filter(Boolean).length} módulos habilitados
              </p>
              {s.payment_due_date && (
                <p style={{ fontSize: 11, color: "#9a8b7d" }}>
                  Vence: {new Date(s.payment_due_date).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">NUEVO</span><h2>Nuevo sistema</h2></div>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={createSystem} className="product-form">
              <div className="form-group">
                <label>Nombre de la empresa (cliente)</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Módulos habilitados</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ALL_MODULES.map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <input type="checkbox" checked={modules.includes(m)} onChange={() => toggleModule(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio mensual</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Estado de pago</label>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="al_dia">Al día</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Próximo vencimiento</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>¿Se factura?</label>
                  <select value={billed ? "si" : "no"} onChange={(e) => setBilled(e.target.value === "si")}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email del admin (para el cliente)</label>
                  <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Contraseña inicial</label>
                  <input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Creando..." : "Crear sistema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">SISTEMA</span><h2>{detail.name}</h2></div>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>

            <div className="product-actions" style={{ marginBottom: 20 }}>
              <button className={detailTab === "info" ? "primary-button" : "secondary-button"} onClick={() => setDetailTab("info")}>Info</button>
              <button className={detailTab === "pagos" ? "primary-button" : "secondary-button"} onClick={() => setDetailTab("pagos")}>Pagos</button>
              <button className={detailTab === "seguridad" ? "primary-button" : "secondary-button"} onClick={() => setDetailTab("seguridad")}>Seguridad</button>
            </div>

            {detailTab === "info" && (
              <div className="product-form">
                <div className="form-group"><label>Estado</label><p>{detail.subscription_status === "active" ? "Activo" : "Inactivo"}</p></div>
                <div className="form-group"><label>Módulos</label><p style={{ fontSize: 12 }}>{detail.enabled_modules || "—"}</p></div>
                <div className="form-group"><label>Precio</label><p>{detail.client_price ? `$${detail.client_price}/mes` : "—"}</p></div>
                <div className="form-group"><label>Estado de pago</label><p>{detail.payment_status}</p></div>
              </div>
            )}

            {detailTab === "pagos" && (
              <div className="product-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto</label>
                    <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Método</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option>Transferencia</option>
                      <option>Efectivo</option>
                      <option>Mercado Pago</option>
                      <option>Otro</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcional" />
                </div>
                <button className="primary-button" type="button" onClick={addPayment} style={{ alignSelf: "flex-start" }}>
                  Registrar pago
                </button>

                <div className="import-table-wrapper" style={{ marginTop: 16 }}>
                  <table className="import-table">
                    <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Notas</th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{new Date(p.payment_date).toLocaleDateString("es-AR")}</td>
                          <td>${p.amount}</td>
                          <td>{p.method || "—"}</td>
                          <td>{p.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailTab === "seguridad" && (
              <div className="product-form">
                <p style={{ fontSize: 13, color: "#8a5c48" }}>
                  Cierra TODAS las sesiones activas de este sistema y cambia la contraseña del administrador.
                </p>
                <div className="form-group">
                  <label>Contraseña nueva</label>
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <button className="product-action-delete" type="button" onClick={doSecurityReset} style={{ alignSelf: "flex-start" }}>
                  Cerrar sesiones y resetear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Sistemas;



