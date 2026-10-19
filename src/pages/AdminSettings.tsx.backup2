import { useState } from "react";
import type { FormEvent } from "react";

const API_URL = "https://locks-promised-method-hopes.trycloudflare.com";
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("velora_admin_token")}` };
}

function AdminSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/admin/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo cambiar la contraseña");
      alert("Contraseña actualizada.");
      setCurrentPassword(""); setNewPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT</span>
          <h1>Configuración</h1>
          <p>Cambiá tu contraseña del panel de control.</p>
        </div>
      </div>

      <div className="dashboard-section" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-group">
            <label>Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Contraseña nueva</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button type="submit" className="primary-button" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default AdminSettings;



