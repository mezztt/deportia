import { useEffect, useState } from "react";
import { startTour } from "../../components/tour/Tour";
import type { FormEvent } from "react";
import { adminApi, adminDownload, calcPricing, usd, BILLABLE_MODULES } from "../../config";
import type { BillingSettings } from "../../config";
import { DEFAULT_BRAND_LINKS } from "../../config";
import { resetBrandLinks } from "../../components/Brand";

function AdminSettings() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState<BillingSettings | null>(null);
  const [savingPrices, setSavingPrices] = useState(false);
  const [brand, setBrand] = useState({ system_instagram_url: "", mezztt_instagram_url: "", mezztt_site_url: "" });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function downloadBackup() {
    setDownloading(true);
    setBackupMsg(null);
    try {
      const name = await adminDownload("/admin/backup", "deportia-backup.json");
      setBackupMsg({ ok: true, text: `Copia descargada: ${name}` });
    } catch (error) {
      setBackupMsg({ ok: false, text: error instanceof Error ? error.message : "No se pudo descargar la copia." });
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    adminApi<{ email: string }>("/admin/me").then((d) => setEmail(d.email)).catch(() => {});
    adminApi<BillingSettings>("/admin/billing-settings").then((d) => { setPrices(d); applyBrand(d); }).catch(() => {});
  }, []);

  function applyBrand(d: BillingSettings) {
    setBrand({
      system_instagram_url: d.system_instagram_url || "",
      mezztt_instagram_url: d.mezztt_instagram_url || "",
      mezztt_site_url: d.mezztt_site_url || "",
    });
  }

  async function handleBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBrandMsg(null);
    const body = {
      system_instagram_url: brand.system_instagram_url.trim(),
      mezztt_instagram_url: brand.mezztt_instagram_url.trim(),
      mezztt_site_url: brand.mezztt_site_url.trim(),
    };
    if (Object.values(body).some((v) => v && !/^https?:\/\//i.test(v))) {
      setBrandMsg({ ok: false, text: "Los enlaces tienen que empezar con http:// o https://" });
      return;
    }
    setSavingBrand(true);
    try {
      const updated = await adminApi<BillingSettings>("/admin/billing-settings", { method: "PUT", body });
      applyBrand(updated);
      resetBrandLinks();
      setBrandMsg({ ok: true, text: "Enlaces guardados. Ya se ven en el login, el menú y las páginas públicas." });
    } catch (error) {
      setBrandMsg({ ok: false, text: error instanceof Error ? error.message : "No se pudieron guardar los enlaces." });
    } finally {
      setSavingBrand(false);
    }
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi("/admin/me/password", {
        method: "PUT",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      alert("Contraseña actualizada.");
      setCurrentPassword(""); setNewPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prices) return;
    setSavingPrices(true);
    try {
      const updated = await adminApi<BillingSettings>("/admin/billing-settings", {
        method: "PUT",
        body: {
          setup: Number(prices.setup),
          module_price: Number(prices.module_price),
          web_price: Number(prices.web_price),
        },
      });
      setPrices(updated);
      alert("Precios guardados.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudieron guardar los precios.");
    } finally {
      setSavingPrices(false);
    }
  }

  // ejemplo: complejo con Turnos, Canchas y Facturación + web de reservas
  const example = calcPricing(["turnos", "canchas", "facturacion", "web_reservas"], prices, false);

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · DEPORTIA</span>
          <h1>Configuración</h1>
          <p>Tu cuenta del panel, los precios de Deportia, la marca y la copia de seguridad.</p>
        </div>
      </div>

      <div className="dashboard-section" style={{ marginBottom: 16 }}>
        <div className="section-heading"><h2>Recorrido por el panel</h2><p>Volvé a ver el recorrido por el sistema.</p></div>
        <button type="button" className="secondary-button" onClick={startTour}>¿Cómo funcionamos?</button>
      </div>

      <div className="dp-grid-2">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Tu cuenta</h2><p>{email || "—"}</p></div>
          <form onSubmit={handlePassword} className="product-form">
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

        <div className="dashboard-section">
          <div className="section-heading"><h2>Precios (USD)</h2><p>Se usan en cotizaciones, facturas y el abono sugerido</p></div>
          {!prices ? <p className="dp-muted">Cargando…</p> : (
            <form onSubmit={handlePrices} className="product-form">
              <div className="form-group">
                <label>Configuración inicial (se cobra una sola vez)</label>
                <input type="number" min="0" value={prices.setup} onChange={(e) => setPrices({ ...prices, setup: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Precio por módulo, inicial y por mes ({BILLABLE_MODULES.length} módulos disponibles)</label>
                <input type="number" min="0" value={prices.module_price} onChange={(e) => setPrices({ ...prices, module_price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Web de reservas, inicial y por mes</label>
                <input type="number" min="0" value={prices.web_price} onChange={(e) => setPrices({ ...prices, web_price: e.target.value })} />
              </div>
              <p className="dp-muted" style={{ fontSize: 11 }}>
                Inicio, Configuración y Usuarios no se cobran. Ejemplo con Turnos, Canchas, Facturación y web:
                pago inicial {usd(example.initialTotal)} (una sola vez) y abono mensual {usd(example.monthlyTotal)}, más IVA.
              </p>
              <button type="submit" className="primary-button" disabled={savingPrices} style={{ alignSelf: "flex-start" }}>
                {savingPrices ? "Guardando..." : "Guardar precios"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="dashboard-section" style={{ marginBottom: 16 }}>
        <div className="section-heading"><h2>Marca y redes</h2><p>Los enlaces que se ven en el login, el menú y el pie de las páginas públicas</p></div>
        <form onSubmit={handleBrand} className="product-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="brand-sys-ig">Instagram de Deportia</label>
              <input id="brand-sys-ig" type="url" inputMode="url" value={brand.system_instagram_url} placeholder={DEFAULT_BRAND_LINKS.system_instagram_url}
                onChange={(e) => setBrand({ ...brand, system_instagram_url: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="brand-mz-ig">Instagram de Mezztt</label>
              <input id="brand-mz-ig" type="url" inputMode="url" value={brand.mezztt_instagram_url} placeholder={DEFAULT_BRAND_LINKS.mezztt_instagram_url}
                onChange={(e) => setBrand({ ...brand, mezztt_instagram_url: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="brand-mz-site">Página de Mezztt</label>
              <input id="brand-mz-site" type="url" inputMode="url" value={brand.mezztt_site_url} placeholder="https://mezztt.site"
                onChange={(e) => setBrand({ ...brand, mezztt_site_url: e.target.value })} />
            </div>
          </div>
          <p className="dp-muted" style={{ fontSize: 11, margin: 0 }}>
            Si dejás un campo vacío se usa el enlace por defecto (el que ves en gris). Mientras no haya página, «Mezztt» lleva a su Instagram.
          </p>
          {brandMsg && <div className={brandMsg.ok ? "dp-ok-msg" : "login-error"}>{brandMsg.text}</div>}
          <button type="submit" className="primary-button" disabled={savingBrand} style={{ alignSelf: "flex-start" }}>
            {savingBrand ? "Guardando..." : "Guardar enlaces"}
          </button>
        </form>
      </div>

      <div className="dashboard-section">
        <div className="section-heading"><h2>Copia de seguridad</h2><p>Solo la ves vos desde el panel</p></div>
        <p className="dp-muted" style={{ fontSize: 12, marginTop: 0 }}>
          Descarga un archivo con todos los datos de todos los complejos (canchas, turnos, clientes, cobros, torneos y más).
          Guardalo en un lugar seguro: sirve para recuperar la información si pasa algo con el servidor.
        </p>
        <button type="button" className="primary-button" onClick={downloadBackup} disabled={downloading}>
          {downloading ? "Preparando la copia..." : "Descargar copia"}
        </button>
        {backupMsg && <p className={backupMsg.ok ? "dp-ok-msg" : "dp-red-text"} style={{ fontSize: 12, marginBottom: 0 }}>{backupMsg.text}</p>}
      </div>
    </section>
  );
}

export default AdminSettings;
