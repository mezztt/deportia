import { useEffect, useMemo, useState } from "react";
import { MailCompose } from "./MailCenter";
import AppDesktop from "./AppDesktop";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  adminApi, money, usd, shortDate, splitList, systemStatus, calcPricing,
  ALL_MODULES, CORE_MODULES, MODULE_LABELS, MODULE_HINTS, SPORTS, SPORT_LABELS, PAYMENT_STATUS_LABELS,
} from "../../config";
import type { BillingSettings, SystemItem, PaymentItem } from "../../config";
import CourtIcon from "../../components/CourtIcon";
import { RUBROS, RUBRO_SPORTS } from "../../rubros";

interface SystemUser { id: number; name: string; email: string; role: string; active: boolean }

type DetailTab = "info" | "pagos" | "usuarios" | "mail" | "app" | "seguridad";

const EMPTY_FORM = {
  company_name: "", slug: "", email: "", phone: "", address: "", city: "",
  sports: [] as string[],
  rubro: "",
  enabled_modules: ["turnos", "canchas"] as string[],
  client_price: "", payment_status: "al_dia", payment_due_date: "",
  billed: false, apply_iva: true, notes: "",
  admin_name: "Administrador", admin_email: "", admin_password: "",
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function slugPreview(text: string) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function Complejos() {
  const [params, setParams] = useSearchParams();
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activos" | "inactivos">("activos");
  const [search, setSearch] = useState("");

  // alta
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // detalle
  const [detail, setDetail] = useState<SystemItem | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [edit, setEdit] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [closePassword, setClosePassword] = useState("");

  // precios del panel: para sugerir el abono según los módulos tildados
  const [prices, setPrices] = useState<BillingSettings | null>(null);
  useEffect(() => { adminApi<BillingSettings>("/admin/billing-settings").then(setPrices).catch(() => {}); }, []);

  /** Abono mensual y pago inicial sugeridos para los módulos tildados (el precio que se guarda se edita a mano) */
  function SuggestedPrice({ modules, iva, onUse }: { modules: string[]; iva: boolean; onUse: (v: string) => void }) {
    if (!prices) return null;
    const p = calcPricing(modules, prices, iva);
    return (
      <div className="dp-suggested-price">
        <div>
          <span>Abono mensual sugerido</span>
          <strong>{usd(p.monthlyTotal)}</strong>
          <small>
            {p.modulesCount} módulo{p.modulesCount === 1 ? "" : "s"} × {usd(prices.module_price)}{p.webTotal > 0 ? ` + web ${usd(p.webTotal)}` : ""}{iva ? " + IVA" : ""}
            {" · "}Pago inicial (una vez, con configuración): {usd(p.initialTotal)}
          </small>
        </div>
        <button type="button" className="secondary-button" onClick={() => onUse(String(p.monthlyTotal))}>Usar este precio</button>
      </div>
    );
  }

  async function loadSystems() {
    setLoading(true);
    try {
      const list = await adminApi<SystemItem[]>("/admin/systems");
      setSystems(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSystems().then((list) => {
      if (params.get("nuevo")) openForm();
      const id = Number(params.get("id"));
      const found = id ? list.find((s) => s.id === id) : undefined;
      if (found) openDetail(found);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearParams() {
    if (params.toString()) setParams({}, { replace: true });
  }

  // ---------------- ALTA ----------------
  function openForm() {
    setForm({ ...EMPTY_FORM, sports: [], enabled_modules: ["turnos", "canchas"] });
    setShowForm(true);
  }

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi("/admin/systems", {
        method: "POST",
        body: {
          ...form,
          rubro: form.rubro || null,
          slug: form.slug || null,
          client_price: form.client_price ? Number(form.client_price) : null,
          payment_due_date: form.payment_due_date || null,
        },
      });
      setShowForm(false);
      clearParams();
      setTab("activos");
      await loadSystems();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo crear el complejo.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- DETALLE ----------------
  async function openDetail(s: SystemItem) {
    setDetail(s);
    setDetailTab("info");
    setEdit({
      name: s.name, slug: s.slug || "", email: s.email || "", phone: s.phone || "",
      address: s.address || "", city: s.city || "",
      sports: splitList(s.sports), rubro: s.rubro || "", enabled_modules: splitList(s.enabled_modules),
      client_price: s.client_price ?? "", payment_status: s.payment_status,
      payment_due_date: s.payment_due_date ? s.payment_due_date.slice(0, 10) : "",
      billed: s.billed, apply_iva: s.apply_iva, notes: s.notes || "",
    });
    setNewPassword(""); setClosePassword(""); setResetUserId("");
    setPayAmount(s.client_price ? String(s.client_price) : ""); setPayNotes("");
    const [p, u] = await Promise.all([
      adminApi<PaymentItem[]>(`/admin/systems/${s.id}/payments`).catch(() => []),
      adminApi<SystemUser[]>(`/admin/systems/${s.id}/users`).catch(() => []),
    ]);
    setPayments(p);
    setUsers(u);
  }

  function closeDetail() {
    setDetail(null);
    clearParams();
  }

  async function saveInfo() {
    if (!detail || !edit) return;
    try {
      const updated = await adminApi<SystemItem>(`/admin/systems/${detail.id}`, {
        method: "PUT",
        body: {
          ...edit,
          rubro: edit.rubro || null,
          slug: edit.slug || null,
          client_price: edit.client_price === "" ? null : Number(edit.client_price),
          payment_due_date: edit.payment_due_date || null,
        },
      });
      setDetail(updated);
      await loadSystems();
      alert("Cambios guardados.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  async function addPayment() {
    if (!detail || !payAmount) return;
    try {
      await adminApi(`/admin/systems/${detail.id}/payments`, {
        method: "POST",
        body: { amount: Number(payAmount), method: payMethod, notes: payNotes || null },
      });
      setPayNotes("");
      setPayments(await adminApi<PaymentItem[]>(`/admin/systems/${detail.id}/payments`));
      const list = await loadSystems();
      const fresh = list.find((s) => s.id === detail.id);
      if (fresh) {
        setDetail(fresh);
        setEdit((e: any) => ({
          ...e,
          payment_status: fresh.payment_status,
          payment_due_date: fresh.payment_due_date ? fresh.payment_due_date.slice(0, 10) : "",
        }));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo registrar el pago.");
    }
  }

  async function doSecurityReset() {
    if (!detail || !newPassword) return;
    if (!confirm("Se van a cerrar TODAS las sesiones del complejo. ¿Seguir?")) return;
    try {
      const data = await adminApi<{ detail: string }>(`/admin/systems/${detail.id}/security-reset`, {
        method: "POST",
        body: { new_password: newPassword, user_id: resetUserId ? Number(resetUserId) : null },
      });
      alert(data.detail);
      setNewPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo resetear.");
    }
  }

  async function toggleActive() {
    if (!detail || !closePassword) return;
    try {
      const data = await adminApi<{ detail: string; archived: boolean }>(`/admin/systems/${detail.id}/toggle-active`, {
        method: "POST",
        body: { password: closePassword },
      });
      alert(`Complejo ahora: ${data.detail}`);
      setTab(data.archived ? "inactivos" : "activos");
      closeDetail();
      await loadSystems();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return systems
      .filter((s) => (tab === "activos" ? !s.archived : s.archived))
      .filter((s) => !q || [s.name, s.city, s.slug].some((v) => (v || "").toLowerCase().includes(q)));
  }, [systems, tab, search]);

  const counts = {
    activos: systems.filter((s) => !s.archived).length,
    inactivos: systems.filter((s) => s.archived).length,
  };

  // ---------------- UI ----------------
  function ModulePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    return (
      <div className="dp-module-grid">
        {CORE_MODULES.map((m) => (
          <label key={m} className="dp-module-option is-core">
            <input type="checkbox" checked readOnly disabled />
            <div><strong>{MODULE_LABELS[m]}</strong><small>Incluido siempre</small></div>
          </label>
        ))}
        {ALL_MODULES.map((m) => (
          <label key={m} className={`dp-module-option ${value.includes(m) ? "is-on" : ""}`}>
            <input type="checkbox" checked={value.includes(m)} onChange={() => onChange(toggle(value, m))} />
            <div><strong>{MODULE_LABELS[m]}</strong><small>{MODULE_HINTS[m]}</small></div>
          </label>
        ))}
      </div>
    );
  }

  /** Tipo de negocio: en el alta, al elegirlo se tildan los módulos (y deportes) sugeridos; después se pueden cambiar a mano. */
  function RubroSelect({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: boolean }) {
    const current = RUBROS.find((r) => r.key === value);
    return (
      <div className="form-group">
        <label>Tipo de negocio</label>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Sin definir</option>
          {RUBROS.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
        </select>
        {current && <small className="dp-muted">{current.tagline}</small>}
        {hint && current && (
          <small className="dp-muted">Sugerido para {current.label}: {current.modules.map((m) => MODULE_LABELS[m] || m).join(", ")}</small>
        )}
      </div>
    );
  }

  function SportPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    return (
      <div className="dp-sport-picker">
        {SPORTS.map((s) => (
          <button
            type="button"
            key={s}
            className={`dp-sport-option ${value.includes(s) ? "is-on" : ""}`}
            onClick={() => onChange(toggle(value, s))}
          >
            <CourtIcon sport={s} width={58} />
            <span>{SPORT_LABELS[s]}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · DEPORTIA</span>
          <h1>Complejos</h1>
          <p>Todos los complejos que tienen Deportia, con su estado en vivo.</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={openForm}>+ Nuevo complejo</button>
        </div>
      </div>

      <div className="dp-toolbar">
        <div className="product-actions">
          <button className={tab === "activos" ? "primary-button" : "secondary-button"} onClick={() => setTab("activos")}>
            Activos ({counts.activos})
          </button>
          <button className={tab === "inactivos" ? "primary-button" : "secondary-button"} onClick={() => setTab("inactivos")}>
            Inactivos ({counts.inactivos})
          </button>
        </div>
        <input className="dp-search" placeholder="Buscar por nombre, ciudad o link…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : systems.length === 0 ? (
        <div className="products-empty">
          <div className="products-empty-icon">◯</div>
          <h3>Todavía no creaste ningún complejo</h3>
          <p>Creá el primero y se genera su usuario administrador.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="products-empty"><p>No hay complejos {tab} que coincidan.</p></div>
      ) : (
        <div className="dp-systems-grid">
          {visible.map((s) => {
            const st = systemStatus(s);
            const sports = splitList(s.sports);
            const mods = splitList(s.enabled_modules);
            return (
              <div key={s.id} className="dashboard-card dp-system-card" onClick={() => openDetail(s)}>
                <div className="dp-system-top">
                  <span className="dp-status"><span className={`dp-dot ${st.tone}`} />{st.label}</span>
                  {s.billed && <span className="dp-tag">Factura</span>}
                </div>
                <strong className="dp-system-name">{s.name}</strong>
                <small className="dp-muted">{s.city || "Sin ciudad"}{s.slug ? ` · /${s.slug}` : ""}</small>

                <div className="dp-system-sports">
                  {sports.length === 0 ? <small className="dp-muted">Sin deportes cargados</small> :
                    sports.map((sp) => <CourtIcon key={sp} sport={sp} width={40} />)}
                </div>

                <div className="dp-chips">
                  {mods.map((m) => <span key={m} className="dp-chip">{MODULE_LABELS[m] || m}</span>)}
                </div>

                <div className="dp-system-foot">
                  <span>{s.client_price ? `${money(s.client_price)}/mes` : "Sin precio"}</span>
                  <span>{s.payment_due_date ? `Vence ${shortDate(s.payment_due_date)}` : PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ MODAL ALTA ============ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); clearParams(); }}>
          <div className="product-modal dp-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">NUEVO</span><h2>Nuevo complejo</h2></div>
              <button className="modal-close" onClick={() => { setShowForm(false); clearParams(); }}>×</button>
            </div>

            <form onSubmit={createSystem} className="product-form">
              <h4 className="dp-form-title">Datos del complejo</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre del complejo</label>
                  <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Link de la web de reservas</label>
                  <input
                    value={form.slug}
                    placeholder={slugPreview(form.company_name) || "mi-complejo"}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                  <small className="dp-muted">{window.location.host}/r/{slugPreview(form.slug || form.company_name) || "…"}</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="form-group"><label>Email de contacto</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>

              <RubroSelect
                value={form.rubro}
                hint
                onChange={(v) => {
                  const r = RUBROS.find((x) => x.key === v);
                  setForm({
                    ...form,
                    rubro: v,
                    enabled_modules: r ? r.modules : form.enabled_modules,
                    sports: r && form.sports.length === 0 ? RUBRO_SPORTS[v] ?? [] : form.sports,
                  });
                }}
              />

              <div className="form-group">
                <label>Deportes que ofrece</label>
                <SportPicker value={form.sports} onChange={(v) => setForm({ ...form, sports: v })} />
              </div>

              <h4 className="dp-form-title">Módulos</h4>
              <ModulePicker value={form.enabled_modules} onChange={(v) => setForm({ ...form, enabled_modules: v })} />

              <h4 className="dp-form-title">Abono</h4>
              <SuggestedPrice modules={form.enabled_modules} iva={form.apply_iva} onUse={(v) => setForm({ ...form, client_price: v })} />
              <div className="form-row">
                <div className="form-group">
                  <label>Precio mensual</label>
                  <input type="number" min="0" value={form.client_price} onChange={(e) => setForm({ ...form, client_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Estado de pago</label>
                  <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                    <option value="al_dia">Al día</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Próximo vencimiento</label>
                  <input type="date" value={form.payment_due_date} onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>¿Se factura? / IVA</label>
                  <div className="dp-inline-checks">
                    <label><input type="checkbox" checked={form.billed} onChange={(e) => setForm({ ...form, billed: e.target.checked })} /> Se factura</label>
                    <label><input type="checkbox" checked={form.apply_iva} onChange={(e) => setForm({ ...form, apply_iva: e.target.checked })} /> Aplicar IVA 21%</label>
                  </div>
                </div>
              </div>

              <h4 className="dp-form-title">Usuario administrador del complejo</h4>
              <div className="form-row">
                <div className="form-group"><label>Nombre</label><input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required /></div>
                <div className="form-group"><label>Email (para entrar)</label><input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Contraseña inicial</label><input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required /></div>
                <div className="form-group"><label>Notas internas</label><input value={form.notes} placeholder="Opcional" onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => { setShowForm(false); clearParams(); }}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Creando..." : "Crear complejo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODAL DETALLE ============ */}
      {detail && edit && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="product-modal dp-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="dashboard-eyebrow">COMPLEJO #{detail.id} · ALTA {shortDate(detail.created_at)}</span>
                <h2>{detail.name}</h2>
                <span className="dp-status" style={{ marginTop: 6 }}>
                  <span className={`dp-dot ${systemStatus(detail).tone}`} />{systemStatus(detail).label}
                </span>
              </div>
              <button className="modal-close" onClick={closeDetail}>×</button>
            </div>

            <div className="product-actions" style={{ marginBottom: 20 }}>
              {(["info", "pagos", "usuarios", "mail", "app", "seguridad"] as DetailTab[]).map((t) => (
                <button key={t} className={detailTab === t ? "primary-button" : "secondary-button"} onClick={() => setDetailTab(t)}>
                  {{ info: "Info", pagos: `Pagos (${payments.length})`, usuarios: `Usuarios (${users.length})`, mail: "Enviar mail", app: "App de escritorio", seguridad: "Seguridad" }[t]}
                </button>
              ))}
            </div>

            {detailTab === "info" && (
              <div className="product-form">
                <div className="form-row">
                  <div className="form-group"><label>Nombre</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Link web de reservas</label>
                    <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
                    <small className="dp-muted">{window.location.host}/r/{slugPreview(edit.slug) || "…"}</small>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Ciudad</label><input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
                  <div className="form-group"><label>Dirección</label><input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Teléfono</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
                  <div className="form-group"><label>Email</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
                </div>
                <RubroSelect value={edit.rubro} onChange={(v) => setEdit({ ...edit, rubro: v })} />
                <div className="form-group">
                  <label>Deportes</label>
                  <SportPicker value={edit.sports} onChange={(v) => setEdit({ ...edit, sports: v })} />
                </div>
                <div className="form-group">
                  <label>Módulos</label>
                  <ModulePicker value={edit.enabled_modules} onChange={(v) => setEdit({ ...edit, enabled_modules: v })} />
                </div>
                <SuggestedPrice modules={edit.enabled_modules} iva={edit.apply_iva} onUse={(v) => setEdit({ ...edit, client_price: v })} />
                <div className="form-row">
                  <div className="form-group"><label>Precio mensual</label><input type="number" value={edit.client_price} onChange={(e) => setEdit({ ...edit, client_price: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Estado de pago</label>
                    <select value={edit.payment_status} onChange={(e) => setEdit({ ...edit, payment_status: e.target.value })}>
                      <option value="al_dia">Al día</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="vencido">Vencido</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Próximo vencimiento</label><input type="date" value={edit.payment_due_date} onChange={(e) => setEdit({ ...edit, payment_due_date: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Facturación</label>
                    <div className="dp-inline-checks">
                      <label><input type="checkbox" checked={edit.billed} onChange={(e) => setEdit({ ...edit, billed: e.target.checked })} /> Se factura</label>
                      <label><input type="checkbox" checked={edit.apply_iva} onChange={(e) => setEdit({ ...edit, apply_iva: e.target.checked })} /> IVA 21%</label>
                    </div>
                  </div>
                </div>
                <div className="form-group"><label>Notas internas</label><input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
                <div className="modal-actions">
                  <button className="primary-button" type="button" onClick={saveInfo}>Guardar cambios</button>
                </div>
              </div>
            )}

            {detailTab === "pagos" && (
              <div className="product-form">
                <div className="form-row">
                  <div className="form-group"><label>Monto</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
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
                <div className="form-group"><label>Notas</label><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcional" /></div>
                <p className="dp-muted" style={{ fontSize: 11 }}>
                  Al registrar el pago, el complejo queda "Al día" y el vencimiento pasa al mes siguiente.
                </p>
                <button className="primary-button" type="button" onClick={addPayment} style={{ alignSelf: "flex-start" }}>Registrar pago</button>

                <div className="import-table-wrapper" style={{ marginTop: 16 }}>
                  {payments.length === 0 ? <p className="dp-muted">Sin pagos todavía.</p> : (
                    <table className="import-table">
                      <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Notas</th></tr></thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>{shortDate(p.payment_date)}</td>
                            <td>{money(p.amount)}</td>
                            <td>{p.method || "—"}</td>
                            <td>{p.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {detailTab === "usuarios" && (
              <div className="import-table-wrapper">
                <table className="import-table">
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                        <td>{u.active ? "Activo" : "Inactivo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="dp-muted" style={{ fontSize: 11, marginTop: 10 }}>
                  Los usuarios los crea el propio complejo desde su módulo Usuarios. Desde acá podés resetear contraseñas en Seguridad.
                </p>
              </div>
            )}

            {detailTab === "mail" && <MailCompose companyId={detail.id} status={(detail as any).payment_status} dueDate={(detail as any).payment_due_date} />}
          {detailTab === "app" && <AppDesktop companyId={detail.id} users={users} />}
            {detailTab === "seguridad" && (
              <div className="product-form">
                <p className="dp-danger-text">
                  Cierra TODAS las sesiones activas del complejo y cambia la contraseña del usuario elegido.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Usuario</label>
                    <select value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                      <option value="">Administrador principal</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Contraseña nueva</label><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                </div>
                <button className="product-action-delete" type="button" onClick={doSecurityReset} style={{ alignSelf: "flex-start" }}>
                  Cerrar sesiones y resetear
                </button>

                <hr className="dp-hr" />

                <p className="dp-danger-text">
                  {detail.archived
                    ? "Reactivar este complejo (vuelve a Activos y sus usuarios pueden entrar de nuevo)."
                    : "Dar de baja este complejo (pasa a Inactivos y sus usuarios no van a poder entrar)."}
                </p>
                <div className="form-group">
                  <label>Tu contraseña del panel</label>
                  <input type="password" value={closePassword} onChange={(e) => setClosePassword(e.target.value)} />
                </div>
                <button className="product-action-delete" type="button" onClick={toggleActive} style={{ alignSelf: "flex-start" }}>
                  {detail.archived ? "Reactivar complejo" : "Dar de baja complejo"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Complejos;
