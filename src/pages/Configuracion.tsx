import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

interface Company {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  currency: string;
  subscription_status: string;
}

const API_URL = "http://127.0.0.1:8020";

function authHeaders() {
  const token = localStorage.getItem("velora_token");
  return { Authorization: `Bearer ${token}` };
}

function Configuracion() {
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");

  async function loadCompany() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/company`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("No se pudo cargar la empresa");
      const data: Company = await response.json();
      setCompany(data);
      setName(data.name);
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setCountry(data.country || "");
      setCurrency(data.currency);
    } catch (error) {
      console.error("Error cargando empresa:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompany();
  }, []);

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/company`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          country: country || null,
          currency,
        }),
      });

      if (!response.ok) throw new Error("No se pudo guardar");
      await loadCompany();
      alert("Datos de la empresa actualizados.");
    } catch (error) {
      console.error("Error guardando empresa:", error);
      alert("No se pudo guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">SISTEMA</span>
          <h1>Configuración</h1>
          <p>Datos de tu empresa y preferencias generales.</p>
        </div>
      </div>

      {loading ? (
        <div className="products-loading">
          <div className="products-loading-spinner" />
          <span>Cargando...</span>
        </div>
      ) : (
        <>
          {/* DATOS DE LA EMPRESA */}
          <div className="dashboard-section" style={{ marginBottom: 20 }}>
            <div className="section-heading">
              <h2>Datos de la empresa</h2>
              <p>Esta información aparece en tus comprobantes y en el panel.</p>
            </div>

            <form onSubmit={saveCompany} className="product-form" style={{ maxWidth: 560 }}>
              <div className="form-group">
                <label>Nombre de la empresa</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>País</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {company && (
                <div className="form-group">
                  <label>Estado de suscripción</label>
                  <p style={{ fontSize: 13, color: "#5f554d" }}>
                    {company.subscription_status}
                  </p>
                </div>
              )}

              <button type="submit" className="primary-button" disabled={saving} style={{ alignSelf: "flex-start" }}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </div>

          {/* ACCESOS RÁPIDOS */}
          <div className="dashboard-section" style={{ marginBottom: 20 }}>
            <div className="section-heading">
              <h2>Depósitos</h2>
              <p>Los depósitos se administran dentro del módulo Stock.</p>
            </div>
            <button className="secondary-button" onClick={() => navigate("/stock")}>
              Ir a Stock →
            </button>
          </div>

<div className="dashboard-section" style={{ marginBottom: 20 }}>
  <div className="section-heading">
    <h2>Apariencia</h2>
  </div>
  <div className="product-actions" style={{ justifyContent: "flex-start" }}>
    <button
      className="secondary-button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("velora_theme", "light");
      }}
    >
      Claro
    </button>
    <button
      className="secondary-button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("velora_theme", "dark");
      }}
    >
      Oscuro
    </button>
  </div>
</div>

  
        </>
      )}
    </section>
  );
}

export default Configuracion;



