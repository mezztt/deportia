import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { appApi, getSessionUser, ROLE_LABELS } from "../../config";

interface AppUser { id: number; name: string; email: string; role: string; active: boolean }

const ROLE_HINTS: Record<string, string> = {
  ADMINISTRADOR: "Todo: canchas, turnos, facturación, usuarios y configuración",
  ENCARGADO: "Canchas, turnos y facturación",
  RECEPCION: "Turnos y canchas (check-in y cobros), sin ver la facturación",
};

function Usuarios() {
  const me = getSessionUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<null | { id?: number; name: string; email: string; password: string; role: string }>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try { setUsers(await appApi<AppUser[]>("/users")); } catch { /* noop */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setError("");
    try {
      if (form.id) await appApi(`/users/${form.id}`, { method: "PUT", body: { name: form.name, role: form.role } });
      else await appApi("/users", { method: "POST", body: { name: form.name, email: form.email, password: form.password, role: form.role } });
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function toggle(u: AppUser) {
    if (u.id === me?.id) { alert("No podés desactivar tu propio usuario."); return; }
    if (!confirm(u.active ? `¿Desactivar a ${u.name}? No va a poder entrar.` : `¿Reactivar a ${u.name}?`)) return;
    try {
      await appApi(`/users/${u.id}`, { method: "PUT", body: { active: !u.active } });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo cambiar");
    }
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">USUARIOS</span>
          <h1>Usuarios</h1>
          <p>Las personas que usan el sistema del complejo.</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={() => { setError(""); setForm({ name: "", email: "", password: "", role: "RECEPCION" }); }}>+ Nuevo usuario</button>
        </div>
      </div>

      <div className="products-table-container">
        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{u.id === me?.id && <span className="dp-pill dp-pill-blue" style={{ marginLeft: 6 }}>Vos</span>}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role] || u.role}</td>
                    <td>{u.active ? <span className="dp-pill dp-pill-green">Activo</span> : <span className="dp-pill dp-pill-gray">Inactivo</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="product-action-edit" onClick={() => { setError(""); setForm({ id: u.id, name: u.name, email: u.email, password: "", role: u.role }); }}>Editar</button>
                      {u.id !== me?.id && (
                        <button className={u.active ? "product-action-delete" : "secondary-button"} style={{ marginLeft: 6 }} onClick={() => toggle(u)}>
                          {u.active ? "Desactivar" : "Reactivar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">{form.id ? "EDITAR" : "NUEVO"}</span><h2>{form.id ? form.name : "Nuevo usuario"}</h2></div>
              <button className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <form className="product-form" onSubmit={save}>
              <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              {!form.id && (
                <div className="form-row">
                  <div className="form-group"><label>Email (para entrar)</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="form-group"><label>Contraseña</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={4} /></div>
                </div>
              )}
              <div className="form-group">
                <label>Rol</label>
                <div className="dp-module-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {Object.keys(ROLE_LABELS).map((r) => (
                    <label key={r} className={`dp-module-option ${form.role === r ? "is-on" : ""}`}>
                      <input type="radio" name="role" checked={form.role === r} disabled={form.id === me?.id}
                        onChange={() => setForm({ ...form, role: r })} />
                      <div><strong>{ROLE_LABELS[r]}</strong><small>{ROLE_HINTS[r]}</small></div>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="login-error">{error}</div>}
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

export default Usuarios;
